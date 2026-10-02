'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHmac, randomBytes } = require('node:crypto');
const { MissionExecutor } = require('../src/executor');

const key = randomBytes(32).toString('hex');
const command = { command_id: 'cmd_test', trace_id: 'trace_test', action: 'execute_task', objective: 'Prepare bounded report', run_mode: 'live', approval_status: 'approved', idempotency_key: 'idem-test', agent_id: 'worker:research', context: {} };
function token(overrides = {}) {
  const payload = Buffer.from(JSON.stringify({ jti: 'passport-1', owner: 'owner:test', subject: 'worker:research', purpose: command.objective, scopes: ['execute:mission'], exp: Math.floor(Date.now() / 1000) + 60, ...overrides })).toString('base64url');
  return `${payload}.${createHmac('sha256', key).update(payload).digest('base64url')}`;
}
function fixture(fetchImpl) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mission-test-'));
  return { dataDir, executor: new MissionExecutor({ dataDir, passportKey: key, routerUrl: 'http://router.test/missions', routerToken: 'private-test-token', retryBaseMs: 0, fetch: fetchImpl }) };
}

test('executes through OpenMinis and persists a completion receipt', async () => {
  let calls = 0;
  const { dataDir, executor } = fixture(async (_url, options) => { calls++; assert.equal(options.headers.authorization, 'Bearer private-test-token'); return { ok: true, json: async () => ({ receipt_id: 'worker-receipt-1', status: 'completed', output: { summary: 'done' } }) }; });
  const receipt = await executor.execute(command, token());
  assert.equal(receipt.status, 'completed'); assert.equal(receipt.route.router, 'openminis'); assert.equal(calls, 1);
  assert.equal(fs.readFileSync(path.join(dataDir, 'audit.jsonl'), 'utf8').includes(receipt.receipt_id), true);
});

test('returns the durable receipt for an idempotent replay without another dispatch', async () => {
  let calls = 0; const { executor } = fixture(async () => { calls++; return { ok: true, json: async () => ({ receipt_id: 'worker-1', status: 'completed' }) }; });
  const first = await executor.execute(command, token()); const replay = await executor.execute(command, token());
  assert.equal(calls, 1); assert.equal(replay.receipt_id, first.receipt_id); assert.equal(replay.replayed, true);
});

test('fails closed for expired, revoked, mismatched-purpose, and insufficient-scope passports', async () => {
  const { dataDir, executor } = fixture(async () => assert.fail('must not dispatch'));
  for (const claims of [{ exp: 1 }, { purpose: 'different task' }, { scopes: ['read:mission'] }]) await assert.rejects(executor.execute({ ...command, idempotency_key: `idem-${JSON.stringify(claims)}` }, token(claims)), /passport_/);
  fs.writeFileSync(path.join(dataDir, 'revoked-passports.json'), JSON.stringify(['passport-1']));
  await assert.rejects(executor.execute({ ...command, idempotency_key: 'revoked' }, token()), /passport_revoked/);
});

test('requires explicit live approval and rejects heartbeat-only worker responses', async () => {
  const { executor } = fixture(async () => ({ ok: true, json: async () => ({ status: 'running', heartbeat: true }) }));
  await assert.rejects(executor.execute({ ...command, run_mode: 'dry_run' }, token()), /live_approval_required/);
  await assert.rejects(executor.execute(command, token()), /worker_completion_receipt_invalid/);
});

test('bounds transient retries', async () => {
  let calls = 0; const { executor } = fixture(async () => { calls++; return { ok: false, status: 503 }; });
  await assert.rejects(executor.execute(command, token()), /worker_unavailable/); assert.equal(calls, 3);
});

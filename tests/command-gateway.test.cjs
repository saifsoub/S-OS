const assert = require('node:assert/strict');
const { test } = require('node:test');
const vm = require('node:vm');
const workflow = require('../workflows/s-agentos-command-gateway.json');

function runNode(name, input, env = { S_AGENTOS_OPERATOR_KEY: 'test-only-operator-key' }) {
  const node = workflow.nodes.find((entry) => entry.name === name);
  const result = vm.runInNewContext(`(function () { ${node.parameters.jsCode}\n})()`, {
    $input: { first: () => ({ json: input }) }, process: { env },
  }, { timeout: 1000 });
  return JSON.parse(JSON.stringify(result[0].json));
}
function authenticate(headers, overrides = {}, env) {
  return runNode('Code — Extract & Validate Auth', {
    headers, body: { action: 'execute_task', objective: 'Bounded task', ...overrides },
    transport_metadata: 'must not propagate',
  }, env);
}

test('operator key and Bearer auth preserve the normalized command', () => {
  for (const headers of [
    { 'X-AgentOS-Key': 'test-only-operator-key' },
    { Authorization: 'Bearer test-only-operator-key' },
    { AUTHORIZATION: ['bearer test-only-operator-key'] },
  ]) {
    const result = authenticate(headers, { context: { project: 'example' }, trace_id: 'trace_test' });
    assert.equal(result.authValid, true);
    assert.equal(result.command.trace_id, 'trace_test');
    assert.deepEqual(result.command.context, { project: 'example' });
    assert.equal(result.command.run_mode, 'draft');
  }
});

test('auth output does not copy transport headers, cookies, or raw input', () => {
  const result = authenticate({ 'X-AgentOS-Key': 'test-only-operator-key', Cookie: 'session-secret' });
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes('test-only-operator-key'), false);
  assert.equal(serialized.includes('session-secret'), false);
  assert.equal(result.body, undefined);
  assert.equal(result.headers, undefined);
  assert.equal(result.transport_metadata, undefined);
});

test('missing, wrong, bare Authorization and unconfigured credentials fail closed', () => {
  for (const headers of [{}, { 'X-AgentOS-Key': 'wrong' }, { Authorization: 'test-only-operator-key' }]) {
    assert.equal(authenticate(headers).authValid, false);
  }
  assert.equal(authenticate({ 'X-AgentOS-Key': 'test-only-operator-key' }, {}, {}).authValid, false);
});

test('unapproved live writes and invalid envelopes are rejected', () => {
  assert.equal(authenticate({}, { run_mode: 'live' }).validationValid, false);
  assert.equal(authenticate({}, { objective: '' }).validationValid, false);
  assert.equal(authenticate({}, { action: 'unknown' }).validationValid, false);
});

test('gateway does not infer server execution or side-effect state', () => {
  const input = authenticate({ 'X-AgentOS-Key': 'test-only-operator-key' }, {
    run_mode: 'live', approval_status: 'approved', idempotency_key: 'bounded-fixture',
  });
  const result = runNode('Code — Route Command', input);
  assert.equal(result.ok, true);
  assert.equal(result.code, 200);
  assert.equal(result.result.accepted_by_gateway, true);
  assert.equal(result.result.gateway_status, 'route_resolved');
  assert.equal(result.result.server_execution_status, 'not_observed_by_gateway');
  assert.equal(result.result.side_effects_status, 'not_observed_by_gateway');
  assert.equal(result.result.side_effects_enabled, undefined);
  assert.equal(result.idempotency_key, 'bounded-fixture');
});

test('draft route is reported without making server-level claims', () => {
  const result = runNode('Code — Route Command', authenticate({}, { action: 'evolve_agent' }));
  assert.equal(result.ok, true);
  assert.equal(result.route, 'evolution_engine');
  assert.equal(result.result.accepted_by_gateway, true);
  assert.equal(result.result.server_execution_status, 'not_observed_by_gateway');
  assert.equal(result.result.side_effects_status, 'not_observed_by_gateway');
});

test('health reports gateway state separately from server state', () => {
  const result = runNode('Code — Route Command', authenticate({}, { action: 'health_check' }));
  assert.equal(result.ok, true);
  assert.equal(result.result.status, 'gateway_available');
  assert.equal(result.result.server_status, 'not_checked_by_gateway');
  assert.equal(result.result.dispatch_status, 'not_checked_by_gateway');
  assert.equal(result.result.side_effects_status, 'not_checked_by_gateway');
});

test('HTTP response nodes use the n8n responseCode contract', () => {
  for (const [name, code] of [
    ['Respond to Webhook — Auth Error', 401],
    ['Respond to Webhook — Validation Error', 400],
    ['Respond to Webhook — Command Result', '={{ $json.code || 200 }}'],
  ]) {
    const parameters = workflow.nodes.find((node) => node.name === name).parameters;
    assert.equal(parameters.respondWith, 'json');
    assert.equal(parameters.options.responseCode, code);
    assert.equal(parameters.statusCode, undefined);
  }
});

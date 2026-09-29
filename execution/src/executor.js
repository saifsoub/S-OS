'use strict';
const { createHash, randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { verifyPassport } = require('./passport');

const safeName = value => createHash('sha256').update(String(value)).digest('hex');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

class MissionExecutor {
  constructor(options) {
    this.dataDir = options.dataDir;
    this.passportKey = options.passportKey;
    this.routerUrl = options.routerUrl;
    this.routerToken = options.routerToken;
    this.fetch = options.fetch || fetch;
    this.maxRetries = Math.min(Math.max(Number(options.maxRetries ?? 2), 0), 3);
    this.retryBaseMs = Math.max(Number(options.retryBaseMs ?? 250), 0);
    fs.mkdirSync(path.join(this.dataDir, 'receipts'), { recursive: true });
  }

  revoked() {
    try { return new Set(JSON.parse(fs.readFileSync(path.join(this.dataDir, 'revoked-passports.json'), 'utf8'))); }
    catch (error) { if (error.code === 'ENOENT') return new Set(); throw error; }
  }

  receiptPath(key) { return path.join(this.dataDir, 'receipts', `${safeName(key)}.json`); }
  existing(key) { try { return JSON.parse(fs.readFileSync(this.receiptPath(key), 'utf8')); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } }
  persist(key, receipt) {
    const target = this.receiptPath(key); const temporary = `${target}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(receipt)}\n`, { mode: 0o600 }); fs.renameSync(temporary, target);
    fs.appendFileSync(path.join(this.dataDir, 'audit.jsonl'), `${JSON.stringify({ at: receipt.completed_at, receipt_id: receipt.receipt_id, command_id: receipt.command_id, status: receipt.status, passport_jti: receipt.authority.passport_jti })}\n`, { mode: 0o600 });
  }

  async execute(command, passportToken) {
    if (command?.action !== 'execute_task') throw Object.assign(new Error('execute_task_required'), { statusCode: 400 });
    if (command.run_mode !== 'live' || command.approval_status !== 'approved') throw Object.assign(new Error('live_approval_required'), { statusCode: 400 });
    if (!command.idempotency_key) throw Object.assign(new Error('idempotency_key_required'), { statusCode: 400 });
    const prior = this.existing(command.idempotency_key);
    if (prior) return { ...prior, replayed: true };
    const passport = verifyPassport(passportToken, this.passportKey, command, this.revoked());
    if (!this.routerUrl) throw Object.assign(new Error('openminis_not_configured'), { statusCode: 503 });
    const startedAt = new Date().toISOString(); let response; let attempts = 0;
    while (attempts <= this.maxRetries) {
      attempts += 1;
      try {
        response = await this.fetch(this.routerUrl, { method: 'POST', headers: { 'content-type': 'application/json', ...(this.routerToken ? { authorization: `Bearer ${this.routerToken}` } : {}) }, body: JSON.stringify({ mission_id: command.command_id, trace_id: command.trace_id, objective: command.objective, worker: passport.subject, context: command.context || {}, passport: passportToken }) });
        if (response.ok) break;
        if (response.status < 500 && response.status !== 429) throw Object.assign(new Error('worker_rejected_mission'), { statusCode: 502 });
      } catch (error) { if (error.statusCode || attempts > this.maxRetries) throw error; }
      if (attempts <= this.maxRetries) await sleep(this.retryBaseMs * 2 ** (attempts - 1));
    }
    if (!response?.ok) throw Object.assign(new Error('worker_unavailable'), { statusCode: 503 });
    const workerReceipt = await response.json();
    if (!workerReceipt?.receipt_id || !['completed', 'failed'].includes(workerReceipt.status)) throw Object.assign(new Error('worker_completion_receipt_invalid'), { statusCode: 502 });
    const receipt = { receipt_id: `rcpt_${randomUUID()}`, command_id: command.command_id, trace_id: command.trace_id, idempotency_key: command.idempotency_key, status: workerReceipt.status, started_at: startedAt, completed_at: new Date().toISOString(), attempts, route: { router: 'openminis', worker: passport.subject }, authority: { owner: passport.owner, purpose: passport.purpose, passport_jti: passport.jti, expires_at: new Date(passport.exp * 1000).toISOString() }, worker_receipt: workerReceipt, replayed: false };
    this.persist(command.idempotency_key, receipt); return receipt;
  }

  getReceipt(id) {
    for (const file of fs.readdirSync(path.join(this.dataDir, 'receipts'))) { const receipt = JSON.parse(fs.readFileSync(path.join(this.dataDir, 'receipts', file))); if (receipt.receipt_id === id) return receipt; }
    return null;
  }
}
module.exports = { MissionExecutor };

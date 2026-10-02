'use strict';
const http = require('node:http');
const { timingSafeEqual } = require('node:crypto');
const { MissionExecutor } = require('./executor');
const config = { port: Number(process.env.PORT || 8790), host: process.env.HOST || '127.0.0.1', operatorKey: process.env.S_AGENTOS_OPERATOR_KEY || '', dataDir: process.env.MISSION_DATA_DIR || './data' };
const executor = new MissionExecutor({ dataDir: config.dataDir, passportKey: process.env.S_PASSPORT_HMAC_KEY || '', routerUrl: process.env.OPENMINIS_URL || '', routerToken: process.env.OPENMINIS_AUTH_TOKEN || '', maxRetries: process.env.MISSION_MAX_RETRIES, retryBaseMs: process.env.MISSION_RETRY_BASE_MS });
const equal = (a, b) => { const x = Buffer.from(a || ''), y = Buffer.from(b || ''); return x.length === y.length && x.length > 0 && timingSafeEqual(x, y); };
const send = (res, code, value) => { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(value)); };
const auth = req => equal(req.headers['x-agentos-key'], config.operatorKey) || equal(String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''), config.operatorKey);
const body = req => new Promise((resolve, reject) => { let raw = ''; req.on('data', c => { raw += c; if (raw.length > 1_000_000) req.destroy(); }); req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { reject(Object.assign(new Error('invalid_json'), { statusCode: 400 })); } }); req.on('error', reject); });
const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') return send(res, 200, { status: 'ready', component: 'mission-executor', completion_evidence: false });
    if (!auth(req)) return send(res, 401, { error: 'unauthorized' });
    if (req.method === 'POST' && req.url === '/v1/missions') return send(res, 200, await executor.execute(await body(req), req.headers['s-passport']));
    if (req.method === 'GET' && req.url.startsWith('/v1/receipts/')) { const found = executor.getReceipt(decodeURIComponent(req.url.slice(13))); return send(res, found ? 200 : 404, found || { error: 'receipt_not_found' }); }
    return send(res, 404, { error: 'not_found' });
  } catch (error) { return send(res, error.statusCode || 500, { error: error.message === 'worker_unavailable' ? error.message : error.message, completion_evidence: false }); }
});
if (require.main === module) server.listen(config.port, config.host);
module.exports = { server };

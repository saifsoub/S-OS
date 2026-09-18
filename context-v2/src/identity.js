'use strict';
const crypto = require('crypto');

function timingSafeEqualString(a, b) {
  const aa = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  if (!aa.length || aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function parseBearer(req) {
  const h = String(req.headers.authorization || '');
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : '';
}

function loadPrincipalKeys() {
  let map = {};
  if (process.env.S_CONTEXT_PRINCIPAL_KEYS) {
    try { map = JSON.parse(process.env.S_CONTEXT_PRINCIPAL_KEYS); }
    catch { throw new Error('S_CONTEXT_PRINCIPAL_KEYS must be valid JSON'); }
  }
  return map;
}

function authenticate(req) {
  const token = parseBearer(req);
  if (!token) return { authenticated: false, principal: 'anonymous' };

  const operator = process.env.S_CONTEXT_OPERATOR_KEY || '';
  if (operator && timingSafeEqualString(token, operator)) {
    return { authenticated: true, principal: 'human:owner', authn: 'operator' };
  }

  const keys = loadPrincipalKeys();
  for (const [principal, key] of Object.entries(keys)) {
    if (timingSafeEqualString(token, key)) return { authenticated: true, principal, authn: 'principal-key' };
  }
  return { authenticated: false, principal: 'anonymous' };
}

module.exports = { authenticate };

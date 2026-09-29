'use strict';
const { createHmac, timingSafeEqual } = require('node:crypto');

function decodePart(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

function verifyPassport(token, key, command, revoked = new Set(), now = Date.now()) {
  if (!key || !token || typeof token !== 'string') throw Object.assign(new Error('passport_required'), { statusCode: 403 });
  const parts = token.split('.');
  if (parts.length !== 2) throw Object.assign(new Error('passport_invalid'), { statusCode: 403 });
  const expected = createHmac('sha256', key).update(parts[0]).digest();
  let supplied;
  try { supplied = Buffer.from(parts[1], 'base64url'); } catch { supplied = Buffer.alloc(0); }
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw Object.assign(new Error('passport_invalid'), { statusCode: 403 });
  }
  let passport;
  try { passport = decodePart(parts[0]); } catch { throw Object.assign(new Error('passport_invalid'), { statusCode: 403 }); }
  if (!passport.jti || revoked.has(passport.jti)) throw Object.assign(new Error('passport_revoked'), { statusCode: 403 });
  if (!passport.owner || !passport.subject || !passport.purpose) throw Object.assign(new Error('passport_claims_invalid'), { statusCode: 403 });
  if (!Number.isFinite(passport.exp) || passport.exp * 1000 <= now) throw Object.assign(new Error('passport_expired'), { statusCode: 403 });
  if (!Array.isArray(passport.scopes) || !passport.scopes.includes('execute:mission')) throw Object.assign(new Error('passport_scope_denied'), { statusCode: 403 });
  if (passport.purpose !== command.objective) throw Object.assign(new Error('passport_purpose_mismatch'), { statusCode: 403 });
  if (command.agent_id && passport.subject !== command.agent_id) throw Object.assign(new Error('passport_subject_mismatch'), { statusCode: 403 });
  return passport;
}

module.exports = { verifyPassport };

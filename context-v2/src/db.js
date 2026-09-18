'use strict';
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(",")} }`.replace(' }','}');
  return JSON.stringify(value);
}
function j(v) { return JSON.stringify(v ?? null); }
function p(v, fallback = null) { try { return v == null ? fallback : JSON.parse(v); } catch { return fallback; } }
function now() { return Math.floor(Date.now() / 1000); }
function iso() { return new Date().toISOString(); }

class ContextDB {
  constructor(file = process.env.S_CONTEXT_DB || path.resolve(__dirname, '../data/context-v2.sqlite')) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    this.migrate();
    this.bootstrap();
  }

  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS contexts (
        id TEXT PRIMARY KEY, version INTEGER NOT NULL DEFAULT 1, sections_json TEXT NOT NULL,
        updated_at TEXT NOT NULL, history_json TEXT NOT NULL DEFAULT '[]'
      );
      CREATE TABLE IF NOT EXISTS drafts (
        id TEXT PRIMARY KEY, context_id TEXT NOT NULL, section TEXT NOT NULL, op TEXT NOT NULL,
        value_json TEXT NOT NULL, author TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '',
        base_version INTEGER NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL,
        decided_by TEXT, decided_at TEXT, decision_reason TEXT,
        FOREIGN KEY(context_id) REFERENCES contexts(id)
      );
      CREATE TABLE IF NOT EXISTS sources (
        id TEXT PRIMARY KEY, config_json TEXT NOT NULL DEFAULT '{}', caps_json TEXT NOT NULL DEFAULT '[]',
        reliability REAL NOT NULL DEFAULT 0.5, registered_at TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY, canonical_name TEXT, aliases_json TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS entity_aliases (
        source TEXT NOT NULL, native_id TEXT NOT NULL, entity_id TEXT NOT NULL,
        PRIMARY KEY(source, native_id), FOREIGN KEY(entity_id) REFERENCES entities(id)
      );
      CREATE TABLE IF NOT EXISTS claims (
        id TEXT PRIMARY KEY, context_id TEXT NOT NULL, section TEXT NOT NULL, entity_id TEXT NOT NULL,
        attr TEXT NOT NULL, value_json TEXT NOT NULL, source TEXT NOT NULL,
        observed_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, confidence REAL NOT NULL,
        provenance_json TEXT NOT NULL DEFAULT '{}'
      );
      CREATE INDEX IF NOT EXISTS idx_claim_lookup ON claims(context_id, section, expires_at);
      CREATE TABLE IF NOT EXISTS grants (
        id TEXT PRIMARY KEY, principal TEXT NOT NULL, source TEXT NOT NULL, cap TEXT NOT NULL,
        constraints_json TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
        max_uses INTEGER, uses INTEGER NOT NULL DEFAULT 0, revoked_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_grant_lookup ON grants(principal, source, cap, expires_at);
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY, principal TEXT NOT NULL, refs_json TEXT NOT NULL DEFAULT '[]',
        state_json TEXT NOT NULL DEFAULT '{}', updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS actions (
        id TEXT PRIMARY KEY, principal TEXT NOT NULL, source TEXT NOT NULL, cap TEXT NOT NULL,
        args_json TEXT NOT NULL, grant_id TEXT, status TEXT NOT NULL, result_json TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audit (
        seq INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, type TEXT NOT NULL, actor TEXT NOT NULL,
        target TEXT, payload_json TEXT NOT NULL DEFAULT '{}', prev_hash TEXT NOT NULL, hash TEXT NOT NULL
      );
    `);
  }

  bootstrap() {
    const row = this.db.prepare('SELECT id FROM contexts WHERE id=?').get('s-master');
    if (!row) {
      this.db.prepare('INSERT INTO contexts(id,version,sections_json,updated_at,history_json) VALUES(?,?,?,?,?)')
        .run('s-master', 1, j({
          training: { text: 'S/ Context v2 canonical training material.' },
          decisions: [], tasks: [], topics: []
        }), iso(), '[]');
      this.appendAudit('context.created', 'system:bootstrap', 's-master', { version: 1 });
    }
  }

  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const out = fn(); this.db.exec('COMMIT'); return out; }
    catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }

  appendAudit(type, actor, target = null, payload = {}) {
    const last = this.db.prepare('SELECT hash FROM audit ORDER BY seq DESC LIMIT 1').get();
    const prev = last?.hash || 'GENESIS';
    const at = iso();
    const material = { at, type, actor, target, payload };
    const hash = crypto.createHash('sha256').update(prev + stable(material)).digest('hex');
    this.db.prepare('INSERT INTO audit(at,type,actor,target,payload_json,prev_hash,hash) VALUES(?,?,?,?,?,?,?)')
      .run(at, type, actor, target, j(payload), prev, hash);
    return { at, type, actor, target, payload, prevHash: prev, hash };
  }

  verifyAudit() {
    const rows = this.db.prepare('SELECT * FROM audit ORDER BY seq').all();
    let prev = 'GENESIS';
    for (const r of rows) {
      if (r.prev_hash !== prev) return { ok: false, seq: r.seq, reason: 'prev_hash_mismatch' };
      const payload = p(r.payload_json, {});
      const material = { at: r.at, type: r.type, actor: r.actor, target: r.target, payload };
      const expected = crypto.createHash('sha256').update(prev + stable(material)).digest('hex');
      if (expected !== r.hash) return { ok: false, seq: r.seq, reason: 'hash_mismatch' };
      prev = r.hash;
    }
    return { ok: true, entries: rows.length, head: prev };
  }

  getContext(id) {
    const r = this.db.prepare('SELECT * FROM contexts WHERE id=?').get(id);
    if (!r) return null;
    return { id:r.id, version:r.version, sections:p(r.sections_json,{}), updatedAt:r.updated_at, history:p(r.history_json,[]) };
  }

  createContext(id, sections, actor) {
    return this.transaction(() => {
      if (this.getContext(id)) throw Object.assign(new Error('context_exists'), { statusCode:409 });
      this.db.prepare('INSERT INTO contexts(id,version,sections_json,updated_at,history_json) VALUES(?,?,?,?,?)').run(id,1,j(sections||{}),iso(),'[]');
      this.appendAudit('context.created', actor, id, { version:1 });
      return this.getContext(id);
    });
  }

  deriveEntity(source, nativeId, canonicalName = null) {
    const existing = this.db.prepare('SELECT entity_id FROM entity_aliases WHERE source=? AND native_id=?').get(source, String(nativeId));
    if (existing) return existing.entity_id;
    const id = 'e:' + crypto.createHash('sha256').update(`${source}/${nativeId}`).digest('hex').slice(0, 16);
    this.db.prepare('INSERT OR IGNORE INTO entities(id,canonical_name,aliases_json,created_at) VALUES(?,?,?,?)').run(id, canonicalName, '[]', iso());
    this.db.prepare('INSERT OR REPLACE INTO entity_aliases(source,native_id,entity_id) VALUES(?,?,?)').run(source, String(nativeId), id);
    return id;
  }

  registerSource({ id, config = {}, caps = [], reliability = 0.5 }, actor) {
    if (!id) throw Object.assign(new Error('source id required'), { statusCode:400 });
    this.db.prepare(`INSERT INTO sources(id,config_json,caps_json,reliability,registered_at,enabled)
      VALUES(?,?,?,?,?,1) ON CONFLICT(id) DO UPDATE SET config_json=excluded.config_json,caps_json=excluded.caps_json,reliability=excluded.reliability,enabled=1`)
      .run(id,j(config),j(caps),Number(reliability),iso());
    this.appendAudit('source.registered', actor, id, { caps, reliability:Number(reliability) });
    return { id, config, caps, reliability:Number(reliability) };
  }

  getSource(id) {
    const r=this.db.prepare('SELECT * FROM sources WHERE id=? AND enabled=1').get(id); if(!r) return null;
    return {id:r.id,config:p(r.config_json,{}),caps:p(r.caps_json,[]),reliability:r.reliability};
  }

  ingestClaim(input, actor) {
    const src = this.getSource(input.source); if(!src) throw Object.assign(new Error('unknown_source'),{statusCode:404});
    const confidence = input.confidence == null ? src.reliability : Number(input.confidence);
    if (!(confidence >= 0 && confidence <= 1)) throw Object.assign(new Error('confidence must be 0..1'),{statusCode:400});
    const ttl = Number(input.ttl_seconds ?? 300); if (!(ttl > 0)) throw Object.assign(new Error('ttl_seconds must be > 0'),{statusCode:400});
    const entityId = input.entity_id || this.deriveEntity(input.source, input.native_id, input.canonical_name || null);
    const id = crypto.randomUUID(); const observed = now();
    this.db.prepare(`INSERT INTO claims(id,context_id,section,entity_id,attr,value_json,source,observed_at,expires_at,confidence,provenance_json)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(id,input.context_id,input.section,entityId,input.attr,j(input.value),input.source,observed,observed+ttl,confidence,j(input.provenance||{}));
    this.appendAudit('claim.ingested', actor, input.context_id, { claimId:id, section:input.section, entityId, attr:input.attr, source:input.source, expiresAt:observed+ttl });
    return { id, entityId, observedAt:observed, expiresAt:observed+ttl, confidence };
  }

  liveClaims(contextId, section) {
    return this.db.prepare('SELECT * FROM claims WHERE context_id=? AND section=? AND expires_at>? ORDER BY observed_at DESC').all(contextId,section,now()).map(r=>({
      id:r.id,contextId:r.context_id,section:r.section,entityId:r.entity_id,attr:r.attr,value:p(r.value_json),source:r.source,
      observedAt:r.observed_at,expiresAt:r.expires_at,confidence:r.confidence,provenance:p(r.provenance_json,{})
    }));
  }

  grant(input, actor) {
    const ttl=Number(input.ttl_seconds??3600); if(!(ttl>0)) throw Object.assign(new Error('ttl_seconds must be > 0'),{statusCode:400});
    const id='g:'+crypto.randomUUID(); const created=now(); const maxUses=input.max_uses==null?null:Number(input.max_uses);
    this.db.prepare('INSERT INTO grants(id,principal,source,cap,constraints_json,created_at,expires_at,max_uses,uses) VALUES(?,?,?,?,?,?,?,?,0)')
      .run(id,input.principal,input.source,input.cap,j(input.constraints||{}),created,created+ttl,maxUses);
    this.appendAudit('grant.created',actor,id,{principal:input.principal,source:input.source,cap:input.cap,expiresAt:created+ttl,maxUses});
    return {id,principal:input.principal,source:input.source,cap:input.cap,constraints:input.constraints||{},expiresAt:created+ttl,maxUses,uses:0};
  }

  revokeGrant(id, actor) {
    const r=this.db.prepare('UPDATE grants SET revoked_at=? WHERE id=? AND revoked_at IS NULL').run(now(),id);
    if(!r.changes) throw Object.assign(new Error('grant_not_found_or_revoked'),{statusCode:404});
    this.appendAudit('grant.revoked',actor,id,{}); return {id,revoked:true};
  }

  findGrant(principal, source, cap, args = {}, consume = false) {
    if (principal === 'human:owner') return { id:'implicit:owner', principal, source, cap, constraints:{}, implicit:true };
    const rows=this.db.prepare(`SELECT * FROM grants WHERE principal=? AND source=? AND cap=? AND revoked_at IS NULL AND expires_at>? AND (max_uses IS NULL OR uses<max_uses) ORDER BY expires_at ASC`).all(principal,source,cap,now());
    for(const r of rows){
      const constraints=p(r.constraints_json,{}); let ok=true;
      for(const [k,v] of Object.entries(constraints)) if(String(args[k])!==String(v)){ok=false;break;}
      if(!ok) continue;
      if(consume) this.db.prepare('UPDATE grants SET uses=uses+1 WHERE id=?').run(r.id);
      return {id:r.id,principal:r.principal,source:r.source,cap:r.cap,constraints,expiresAt:r.expires_at,maxUses:r.max_uses,uses:r.uses+(consume?1:0)};
    }
    return null;
  }

  assertContextPermission(principal, contextId, action, section='*') {
    if(principal==='human:owner') return {id:'implicit:owner'};
    const source=`context:${contextId}`;
    return this.findGrant(principal,source,`${action}:${section}`) || this.findGrant(principal,source,`${action}:*`) || (()=>{throw Object.assign(new Error('permission_denied'),{statusCode:403});})();
  }

  createDraft({contextId,section,op='replace',value,reason=''},author){
    return this.transaction(()=>{
      const doc=this.getContext(contextId); if(!doc) throw Object.assign(new Error('context_not_found'),{statusCode:404});
      this.assertContextPermission(author,contextId,'write',section);
      const id=crypto.randomUUID();
      this.db.prepare('INSERT INTO drafts(id,context_id,section,op,value_json,author,reason,base_version,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
        .run(id,contextId,section,op,j(value),author,reason,doc.version,'pending',iso());
      this.appendAudit('draft.created',author,contextId,{draftId:id,section,baseVersion:doc.version});
      return this.getDraft(id);
    });
  }
  getDraft(id){const r=this.db.prepare('SELECT * FROM drafts WHERE id=?').get(id); if(!r)return null;return {id:r.id,contextId:r.context_id,section:r.section,op:r.op,value:p(r.value_json),author:r.author,reason:r.reason,baseVersion:r.base_version,status:r.status,createdAt:r.created_at,decidedBy:r.decided_by,decidedAt:r.decided_at,decisionReason:r.decision_reason};}

  approveDraft(id,approver){
    return this.transaction(()=>{
      const d=this.getDraft(id); if(!d) throw Object.assign(new Error('draft_not_found'),{statusCode:404});
      if(d.status!=='pending') throw Object.assign(new Error('draft_not_pending'),{statusCode:409});
      if(d.author===approver) throw Object.assign(new Error('separation_of_duties'),{statusCode:403});
      this.assertContextPermission(approver,d.contextId,'approve',d.section);
      const doc=this.getContext(d.contextId); if(doc.version!==d.baseVersion) throw Object.assign(new Error('stale_draft'),{statusCode:409});
      const history=doc.history.concat([{version:doc.version,at:doc.updatedAt,sections:doc.sections}]);
      const sections=JSON.parse(JSON.stringify(doc.sections));
      if(d.op==='merge' && d.value && typeof d.value==='object' && !Array.isArray(d.value)) sections[d.section]={...(sections[d.section]||{}),...d.value};
      else sections[d.section]=d.value;
      const updated=iso();
      this.db.prepare('UPDATE contexts SET version=?,sections_json=?,updated_at=?,history_json=? WHERE id=?').run(doc.version+1,j(sections),updated,j(history),doc.id);
      this.db.prepare('UPDATE drafts SET status=?,decided_by=?,decided_at=? WHERE id=?').run('approved',approver,updated,id);
      this.appendAudit('draft.approved',approver,d.contextId,{draftId:id,section:d.section,newVersion:doc.version+1});
      return {draft:this.getDraft(id),canonicalVersion:doc.version+1};
    });
  }

  rejectDraft(id,actor,reason=''){
    return this.transaction(()=>{
      const d=this.getDraft(id); if(!d) throw Object.assign(new Error('draft_not_found'),{statusCode:404});
      if(d.status!=='pending') throw Object.assign(new Error('draft_not_pending'),{statusCode:409});
      this.assertContextPermission(actor,d.contextId,'approve',d.section);
      const at=iso(); this.db.prepare('UPDATE drafts SET status=?,decided_by=?,decided_at=?,decision_reason=? WHERE id=?').run('rejected',actor,at,reason,id);
      this.appendAudit('draft.rejected',actor,d.contextId,{draftId:id,reason}); return this.getDraft(id);
    });
  }

  syncSession(input, principal){
    const id=input.session_id||crypto.randomUUID(); this.db.prepare(`INSERT INTO sessions(id,principal,refs_json,state_json,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET principal=excluded.principal,refs_json=excluded.refs_json,state_json=excluded.state_json,updated_at=excluded.updated_at`).run(id,principal,j(input.context_refs||[]),j(input.state||{}),iso());
    this.appendAudit('session.synced',principal,id,{refs:input.context_refs||[]}); return this.getSession(id);
  }
  getSession(id){const r=this.db.prepare('SELECT * FROM sessions WHERE id=?').get(id);return r?{id:r.id,principal:r.principal,contextRefs:p(r.refs_json,[]),state:p(r.state_json,{}),updatedAt:r.updated_at}:null;}

  recordAction(input, principal) {
    return this.transaction(()=>{
      const grant=this.findGrant(principal,input.source,input.cap,input.args||{},true);
      if(!grant) throw Object.assign(new Error('no_active_grant'),{statusCode:403});
      const id=crypto.randomUUID(); const status=input.status||'recorded';
      this.db.prepare('INSERT INTO actions(id,principal,source,cap,args_json,grant_id,status,result_json,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run(id,principal,input.source,input.cap,j(input.args||{}),grant.id,status,j(input.result??null),iso());
      this.appendAudit('action.recorded',principal,input.source,{actionId:id,cap:input.cap,grantId:grant.id,status});
      return {id,principal,source:input.source,cap:input.cap,args:input.args||{},grantId:grant.id,status,result:input.result??null};
    });
  }
}

module.exports = { ContextDB, now };

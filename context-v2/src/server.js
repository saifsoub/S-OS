'use strict';
const http=require('http');
const {ContextDB}=require('./db');
const {compileContext}=require('./compiler');
const {authenticate}=require('./identity');
const PORT=Number(process.env.PORT||8787); const HOST=process.env.HOST||'0.0.0.0'; const db=new ContextDB();
function send(res,status,body){const data=JSON.stringify(body,null,2);res.writeHead(status,{'content-type':'application/json; charset=utf-8','content-length':Buffer.byteLength(data)});res.end(data);}
function body(req){return new Promise((resolve,reject)=>{let s='';req.on('data',c=>{s+=c;if(s.length>1_000_000){reject(Object.assign(new Error('body_too_large'),{statusCode:413}));req.destroy();}});req.on('end',()=>{if(!s)return resolve({});try{resolve(JSON.parse(s));}catch{reject(Object.assign(new Error('invalid_json'),{statusCode:400}));}});req.on('error',reject);});}
function requireAuth(req){const a=authenticate(req);if(!a.authenticated)throw Object.assign(new Error('unauthorized'),{statusCode:401});return a.principal;}
function requireOwner(req){const p=requireAuth(req);if(p!=='human:owner')throw Object.assign(new Error('owner_required'),{statusCode:403});return p;}
const server=http.createServer(async(req,res)=>{try{
  const u=new URL(req.url,'http://local');
  if(req.method==='GET'&&u.pathname==='/health'){const audit=db.verifyAudit();return send(res,200,{status:'ok',service:'s-context-v2',version:'2.0.0',auditOk:audit.ok});}
  if(req.method==='GET'&&u.pathname==='/v2/audit/verify'){requireOwner(req);return send(res,200,db.verifyAudit());}
  if(req.method==='POST'&&u.pathname==='/v2/context/compile'){const p=requireAuth(req);return send(res,200,compileContext(db,await body(req),p));}
  if(req.method==='POST'&&u.pathname==='/v2/contexts'){const p=requireOwner(req),b=await body(req);return send(res,201,db.createContext(b.id,b.sections||{},p));}
  if(req.method==='POST'&&u.pathname==='/v2/drafts'){const p=requireAuth(req);return send(res,201,db.createDraft(await body(req),p));}
  let m=u.pathname.match(/^\/v2\/drafts\/([^/]+)\/(approve|reject)$/); if(req.method==='POST'&&m){const p=requireAuth(req),b=await body(req);return send(res,200,m[2]==='approve'?db.approveDraft(m[1],p):db.rejectDraft(m[1],p,b.reason||''));}
  if(req.method==='POST'&&u.pathname==='/v2/sources'){const p=requireOwner(req);return send(res,201,db.registerSource(await body(req),p));}
  if(req.method==='POST'&&u.pathname==='/v2/claims'){const p=requireAuth(req),b=await body(req);const src=db.getSource(b.source);if(!src)throw Object.assign(new Error('unknown_source'),{statusCode:404});if(p!=='human:owner'){const g=db.findGrant(p,b.source,'claim:ingest',b,false);if(!g)throw Object.assign(new Error('claim_ingest_not_granted'),{statusCode:403});}return send(res,201,db.ingestClaim(b,p));}
  if(req.method==='POST'&&u.pathname==='/v2/grants'){const p=requireOwner(req);return send(res,201,db.grant(await body(req),p));}
  m=u.pathname.match(/^\/v2\/grants\/([^/]+)\/revoke$/); if(req.method==='POST'&&m){const p=requireOwner(req);return send(res,200,db.revokeGrant(m[1],p));}
  if(req.method==='POST'&&u.pathname==='/v2/sessions'){const p=requireAuth(req);return send(res,200,db.syncSession(await body(req),p));}
  if(req.method==='POST'&&u.pathname==='/v2/actions/record'){const p=requireAuth(req);return send(res,201,db.recordAction(await body(req),p));}
  return send(res,404,{error:'not_found'});
}catch(e){return send(res,e.statusCode||500,{error:e.message});}});
server.listen(PORT,HOST,()=>console.log(`S/Context v2 listening on ${HOST}:${PORT}`));

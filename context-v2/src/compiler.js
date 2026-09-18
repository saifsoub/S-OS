'use strict';

const CITATION = /^@context\/([A-Za-z0-9._\/-]+)(?:#([A-Za-z0-9._\/-]+))?$/;
function parseCitation(citation){const m=String(citation||'').trim().match(CITATION);if(!m)throw Object.assign(new Error('invalid_citation'),{statusCode:400});return{id:m[1],section:m[2]||null};}
function approxTokens(v){return Math.ceil(JSON.stringify(v).length/4);}

function aggregateClaims(claims){
  const groups=new Map();
  for(const c of claims){const k=`${c.entityId}\u0000${c.attr}`;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(c);}
  const live={}; const conflicts=[]; const provenance=[];
  for(const [key,cs] of groups){
    const [entityId,attr]=key.split('\u0000');
    const byValue=new Map();
    for(const c of cs){const vk=JSON.stringify(c.value);if(!byValue.has(vk))byValue.set(vk,[]);byValue.get(vk).push(c);provenance.push({claimId:c.id,entityId:c.entityId,attr:c.attr,source:c.source,observedAt:c.observedAt,expiresAt:c.expiresAt,confidence:c.confidence,provenance:c.provenance});}
    if(byValue.size>1){
      conflicts.push({entityId,attr,candidates:[...byValue.entries()].map(([v,items])=>({value:JSON.parse(v),sources:items.map(x=>x.source),confidence:combine(items.map(x=>x.confidence))}))});
      continue;
    }
    const [[v,items]]=[...byValue.entries()];
    live[entityId]||={}; live[entityId][attr]={value:JSON.parse(v),confidence:combine(items.map(x=>x.confidence)),sources:[...new Set(items.map(x=>x.source))],observedAt:Math.max(...items.map(x=>x.observedAt)),expiresAt:Math.min(...items.map(x=>x.expiresAt))};
  }
  return {live,conflicts,provenance};
}
function combine(xs){let miss=1;for(const x of xs)miss*=1-Number(x);return Number((1-miss).toFixed(4));}

function compileContext(db,{citation,max_tokens=3000,freshness_seconds=null,session_id=null,include=['canonical','live','session'],version=null},principal){
  const {id,section}=parseCitation(citation); const doc=db.getContext(id); if(!doc)throw Object.assign(new Error('context_not_found'),{statusCode:404});
  if(version!=null && Number(version)!==Number(doc.version))throw Object.assign(new Error(`version_mismatch:${doc.version}`),{statusCode:409});
  db.assertContextPermission(principal,id,'read',section||'*');
  if(section && !(section in doc.sections))throw Object.assign(new Error('section_not_found'),{statusCode:404});
  const canonical=section?doc.sections[section]:doc.sections;
  const canonicalTokens=approxTokens(canonical); if(canonicalTokens>Number(max_tokens))throw Object.assign(new Error(`context_budget_exceeded:canonical_requires_${canonicalTokens}`),{statusCode:413});
  let remaining=Math.max(0,Number(max_tokens)-canonicalTokens);
  let claims=[]; if(section && include.includes('live')) claims=db.liveClaims(id,section);
  const hadLiveClaims=claims.length>0;
  let staleByRequirement=false;
  if(freshness_seconds!=null){const min=Math.floor(Date.now()/1000)-Number(freshness_seconds);const fresh=claims.filter(c=>c.observedAt>=min);staleByRequirement=hadLiveClaims && fresh.length===0;claims=fresh;}
  const agg=aggregateClaims(claims);
  let live=agg.live, conflicts=agg.conflicts, provenance=agg.provenance;
  const liveItems=[]; for(const [entity,attrs] of Object.entries(live))for(const [attr,payload] of Object.entries(attrs))liveItems.push({entity,attr,payload});
  liveItems.sort((a,b)=>(b.payload.confidence-a.payload.confidence)||(b.payload.observedAt-a.payload.observedAt));
  const kept={}; for(const item of liveItems){const cost=approxTokens(item);if(cost>remaining)continue;remaining-=cost;(kept[item.entity]||={})[item.attr]=item.payload;} live=kept;
  const keptKeys=new Set(Object.entries(kept).flatMap(([e,attrs])=>Object.keys(attrs).map(a=>`${e}\u0000${a}`)));
  conflicts=conflicts.filter(x=>approxTokens(x)<=remaining).map(x=>{remaining-=approxTokens(x);return x;});
  const conflictKeys=new Set(conflicts.map(x=>`${x.entityId}\u0000${x.attr}`));
  provenance=provenance.filter(x=>keptKeys.has(`${x.entityId}\u0000${x.attr}`)||conflictKeys.has(`${x.entityId}\u0000${x.attr}`));
  let session=null; if(session_id && include.includes('session')){const s=db.getSession(session_id);if(s && (s.principal===principal||principal==='human:owner')){const cost=approxTokens(s.state);if(cost<=remaining){session=s.state;remaining-=cost;}}}
  const now=Math.floor(Date.now()/1000); const liveExpiries=provenance.map(x=>x.expiresAt);
  const freshness=conflicts.length?'conflict':provenance.length?(Math.min(...liveExpiries)>now?'fresh':'stale'):(staleByRequirement?'stale':'unknown');
  const bundle={
    citation, canonicalVersion:doc.version, canonicalUpdatedAt:doc.updatedAt,
    context:{canonical:include.includes('canonical')?canonical:undefined,live:include.includes('live')?live:undefined,session:include.includes('session')?session:undefined},
    freshness:{status:freshness,asOf:new Date().toISOString(),expiresAt:liveExpiries.length?new Date(Math.min(...liveExpiries)*1000).toISOString():null},
    conflicts, provenance,
    policy:{principal,scope:`read:${section||"*"}`},
    budget:{tokensRequested:Number(max_tokens),tokensEstimatedUsed:Number(max_tokens)-remaining,canonicalTokens}
  };
  db.appendAudit('context.compiled',principal,id,{citation,version:doc.version,section,claims:provenance.length,conflicts:conflicts.length,tokensEstimatedUsed:bundle.budget.tokensEstimatedUsed});
  return bundle;
}
module.exports={compileContext,parseCitation,aggregateClaims};

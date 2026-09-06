import { z } from 'zod';
import { calculatePrice, createSnapshot, decisionSchema, draftSchema, settingsSchema, LIMITATIONS, type Decision, type OwnerRequest, type PublishedVersion, type RequestStatus, type ReviewRecord, type Settings, type Snapshot } from '../shared/domain';

export interface Env {
  DB: D1Database; ASSETS: Fetcher; ENVIRONMENT?: string; ALLOW_TEST_PROTECTION?: string;
  TURNSTILE_SECRET_KEY?: string; TURNSTILE_SITE_KEY?: string; RETENTION_DAYS?: string;
  MAX_WORKSPACES?: string; MAX_REQUESTS_PER_WORKSPACE?: string; MAX_VERSIONS_PER_REQUEST?: string;
  RATE_LIMIT_PER_MINUTE?: string; CREATE_LIMIT_PER_HOUR?: string; PUBLISH_LIMIT_PER_HOUR?: string;
}
type WorkspaceRow = {id:string;settings_json:string;created_at:string;expires_at:string};
type RequestRow = {id:string;workspace_id:string;reference:string;draft_json:string;status:RequestStatus;revision:number;current_version_id:string|null;current_version:number;created_at:string;updated_at:string;retain_until:string;creation_key:string;creation_hash:string};
type VersionRow = {id:string;request_id:string;version_number:number;snapshot_json:string;content_hash:string;status:PublishedVersion['status'];published_at:string;expires_at:string;token_hash:string;access_revoked:number;publish_key:string;publish_hash:string};
type DecisionRow = {version_id:string;action:Decision['action'];respondent_name:string;comment:string;acknowledged:number;idempotency_key:string;payload_hash:string;decided_at:string};
class HttpError extends Error { constructor(public status:number,message:string,public code='request_failed'){super(message);} }
const now = () => new Date().toISOString();
const DAY=86_400_000;
const bounded = (value:string|undefined,fallback:number,min:number,max:number) => Math.min(max,Math.max(min,Number.isFinite(Number(value)) && value ? Math.floor(Number(value)):fallback));
const retentionDays=(env:Env)=>bounded(env.RETENTION_DAYS,90,1,365);
const testProtection=(env:Env)=>(env.ENVIRONMENT==='test'||env.ENVIRONMENT==='local')&&env.ALLOW_TEST_PROTECTION==='true';
const after=(milliseconds:number)=>new Date(Date.now()+milliseconds).toISOString();
const minDate=(...values:string[])=>values.sort()[0]!;
function token():string { const b=crypto.getRandomValues(new Uint8Array(32));return btoa(String.fromCharCode(...b)).replaceAll('+','-').replaceAll('/','_').replaceAll('=',''); }
async function hash(value:string):Promise<string> { return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(b=>b.toString(16).padStart(2,'0')).join(''); }
function cookie(name:string,value:string,path:string,seconds:number):string {return `${name}=${value}; Path=${path}; Max-Age=${seconds}; HttpOnly; Secure; SameSite=Strict`;}
function readCookie(request:Request,name:string):string|undefined { const value=(request.headers.get('cookie')??'').split(';').map(v=>v.trim()).find(v=>v.startsWith(`${name}=`))?.slice(name.length+1);return value&&/^[A-Za-z0-9_-]{43}$/.test(value)?value:undefined; }
const reviewCookie=(id:string)=>`cpl_review_${id.replaceAll('-','')}`;
function json(value:unknown,status=200,headers:HeadersInit={}):Response {const body=JSON.stringify(value);if(body.length>5_000_000)throw new HttpError(413,'Export individual requests to stay within the export size limit.','output_limit');return new Response(body,{status,headers:{'Content-Type':'application/json; charset=utf-8',...headers}});}
const safeHeaders: Record<string,string> = {
  'Cache-Control':'no-store, private','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','X-Robots-Tag':'noindex, nofollow, noarchive',
  'Permissions-Policy':'camera=(), microphone=(), geolocation=(), payment=()',
  'Content-Security-Policy':"default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
};
function secured(response:Response):Response {const h=new Headers(response.headers);for(const[k,v]of Object.entries(safeHeaders))h.set(k,v);return new Response(response.body,{status:response.status,statusText:response.statusText,headers:h});}
async function body<T>(request:Request,schema:z.ZodType<T>):Promise<T> {
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new HttpError(415,'Use a JSON request.','content_type');
  const reader=request.body?.getReader();if(!reader)throw new HttpError(400,'A JSON body is required.','validation');
  let size=0;const chunks:Uint8Array[]=[];
  for(;;){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>65_536){await reader.cancel();throw new HttpError(413,'This request exceeds the 64 KB input limit.','input_limit');}chunks.push(next.value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try{return schema.parse(JSON.parse(new TextDecoder().decode(bytes)));}catch(error){if(error instanceof z.ZodError)throw error;throw new HttpError(400,'Invalid JSON.','validation');}
}
function checkOrigin(request:Request):void {
  if((request.headers.get('cookie')?.length??0)>16384)throw new HttpError(431,'Request headers are too large.','input_limit');
  if(request.headers.get('sec-fetch-site')==='cross-site')throw new HttpError(403,'Same-origin access is required.','csrf');
  if(!['GET','HEAD'].includes(request.method)){
    if(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('x-cpl-request')!=='1')throw new HttpError(403,'Same-origin request verification failed.','csrf');
  }
}
async function rate(db:D1Database,key:string,limit:number,windowMs:number):Promise<void> {
  const window=Math.floor(Date.now()/windowMs);const reset=new Date((window+1)*windowMs).toISOString();
  const row=await db.prepare('INSERT INTO rate_limits(key,count,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count<? RETURNING count').bind(`${key}:${window}`,reset,limit).first();
  if(!row)throw new HttpError(429,'Too many requests. Please wait before trying again.','rate_limit');
}
async function protect(request:Request,env:Env,turnstileToken:string|undefined,action:string):Promise<void> {
  if(testProtection(env))return;
  if(!env.TURNSTILE_SECRET_KEY||!env.TURNSTILE_SITE_KEY)throw new HttpError(503,'Abuse protection is not configured. Saving new work and publishing are unavailable.','protection_unavailable');
  if(!turnstileToken)throw new HttpError(400,'Complete the security check before continuing.','challenge_required');
  const data=new URLSearchParams({secret:env.TURNSTILE_SECRET_KEY,response:turnstileToken});
  const ip=request.headers.get('cf-connecting-ip');if(ip)data.set('remoteip',ip);
  let result:{success?:boolean;hostname?:string;action?:string};
  try{const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:data,signal:AbortSignal.timeout(8000)});if(!response.ok)throw new Error();result=await response.json();}catch{throw new HttpError(503,'The security check is unavailable. Your work has not been published.','protection_unavailable');}
  if(!result.success||result.hostname!==new URL(request.url).hostname||result.action!==action)throw new HttpError(400,'The security check expired or failed. Please try again.','challenge_failed');
}
function workspace(row:WorkspaceRow){return{id:row.id,createdAt:row.created_at,settings:JSON.parse(row.settings_json) as Settings};}
async function owner(request:Request,env:Env):Promise<WorkspaceRow>{
  const value=readCookie(request,'cpl_owner');if(!value)throw new HttpError(401,'Private workspace access is required.','unauthorized');
  const row=await env.DB.prepare('SELECT w.id,w.settings_json,w.created_at,w.expires_at FROM owner_sessions s JOIN workspaces w ON w.id=s.workspace_id WHERE s.token_hash=? AND s.expires_at>? AND w.expires_at>?').bind(await hash(value),now(),now()).first<WorkspaceRow>();
  if(!row)throw new HttpError(401,'Private workspace access is required.','unauthorized');return row;
}
async function authorizedMutation(request:Request,env:Env,workspaceId:string,statements:D1PreparedStatement[]):Promise<D1Result[]> {
  const value=readCookie(request,'cpl_owner');
  if(!value)throw new HttpError(401,'Private workspace access is required.','unauthorized');
  const guardId=crypto.randomUUID();
  try {
    const results=await env.DB.batch([
      env.DB.prepare('INSERT INTO owner_mutation_guards(id,workspace_id,session_hash) VALUES(?,?,?)').bind(guardId,workspaceId,await hash(value)),
      ...statements,
      env.DB.prepare('DELETE FROM owner_mutation_guards WHERE id=?').bind(guardId),
    ]);
    if(!results[0]?.meta.changes||!results.at(-1)?.meta.changes)throw new HttpError(503,'Authorization could not be confirmed. No success has been recorded.','storage_unavailable');
    return results.slice(1,-1);
  } catch(error) {
    if(String(error).includes('owner_session_invalid'))throw new HttpError(401,'This owner session expired or was revoked. Reopen your private workspace before continuing.','unauthorized');
    throw error;
  }
}
async function ownerWrite(request:Request,env:Env,workspaceId:string,statement:D1PreparedStatement):Promise<D1Result>{return(await authorizedMutation(request,env,workspaceId,[statement]))[0]!;}
async function owned(env:Env,workspaceId:string,id:string):Promise<RequestRow>{
  const row=await env.DB.prepare('SELECT * FROM requests WHERE id=? AND workspace_id=? AND retain_until>?').bind(id,workspaceId,now()).first<RequestRow>();if(!row)throw new HttpError(404,'Record unavailable.','not_found');return row;
}
function decision(row:DecisionRow,version:VersionRow):Decision{return{action:row.action,respondentName:row.respondent_name,comment:row.comment,acknowledged:!!row.acknowledged,decidedAt:row.decided_at,timezone:'UTC',versionId:row.version_id,versionNumber:version.version_number,contentHash:version.content_hash};}
async function publicVersion(env:Env,row:VersionRow):Promise<PublishedVersion>{
  const d=await env.DB.prepare('SELECT * FROM decisions WHERE version_id=?').bind(row.id).first<DecisionRow>();
  return{id:row.id,versionNumber:row.version_number,status:row.status==='awaiting'&&row.expires_at<=now()?'expired':row.status,accessRevoked:!!row.access_revoked,publishedAt:row.published_at,expiresAt:row.expires_at,contentHash:row.content_hash,snapshot:JSON.parse(row.snapshot_json),decision:d?decision(d,row):null};
}
async function ownerRecord(env:Env,row:RequestRow):Promise<OwnerRequest>{
  const result=await env.DB.prepare('SELECT * FROM versions WHERE request_id=? ORDER BY version_number').bind(row.id).all<VersionRow>();
  const versions=await Promise.all(result.results.map(v=>publicVersion(env,v)));const draft=draftSchema.parse(JSON.parse(row.draft_json));
  const current=versions.find(v=>v.id===row.current_version_id);const status=row.status==='awaiting'&&current?.status==='expired'?'expired':row.status;
  return{id:row.id,reference:row.reference,jobTitle:current?.snapshot.jobTitle??draft.jobTitle,customerName:current?.snapshot.customerName??draft.customerName,status,createdAt:row.created_at,updatedAt:row.updated_at,retainUntil:row.retain_until,totalCents:current?.snapshot.totalCents??calculatePrice(draft).totalCents,currentVersion:row.current_version,revision:row.revision,draft,versions};
}
async function reviewAuth(request:Request,env:Env,id:string):Promise<VersionRow>{
  const value=readCookie(request,reviewCookie(id));if(!value)throw new HttpError(401,'This private review link is unavailable or expired.','unauthorized');
  const row=await env.DB.prepare('SELECT v.* FROM review_sessions s JOIN versions v ON v.id=s.version_id JOIN requests r ON r.id=v.request_id WHERE s.token_hash=? AND s.version_id=? AND s.capability_hash=v.token_hash AND s.expires_at>? AND v.access_revoked=0 AND v.expires_at>? AND r.retain_until>?').bind(await hash(value),id,now(),now(),now()).first<VersionRow>();
  if(!row)throw new HttpError(401,'This private review link is unavailable or expired.','unauthorized');return row;
}
async function reviewRecord(env:Env,v:VersionRow):Promise<ReviewRecord>{const row=await env.DB.prepare('SELECT reference,retain_until FROM requests WHERE id=?').bind(v.request_id).first<{reference:string;retain_until:string}>();if(!row)throw new HttpError(404,'Record unavailable.','not_found');return{...await publicVersion(env,v),requestId:v.request_id,reference:row.reference,retainUntil:row.retain_until,limitations:LIMITATIONS};}
const tokenSchema=z.object({token:z.string().regex(/^[A-Za-z0-9_-]{43}$/)}).strict();
const revisionSchema=z.object({revision:z.number().int().positive()}).strict();
const challengeSchema=z.object({turnstileToken:z.string().max(2048).optional()}).strict();
const publishSchema=z.object({revision:z.number().int().positive(),expiryDays:z.number().int().min(1).max(90),idempotencyKey:z.string().uuid(),turnstileToken:z.string().max(2048).optional()}).strict();
function conflict():never{throw new HttpError(409,'The request changed or is no longer eligible. Refresh before continuing.','stale');}
async function api(request:Request,env:Env):Promise<Response>{
  const url=new URL(request.url);const path=url.pathname;const method=request.method;checkOrigin(request);
  if(path==='/api/config'&&method==='GET')return json({turnstileSiteKey:env.TURNSTILE_SITE_KEY??null,protectionRequired:!testProtection(env),retentionDays:retentionDays(env),defaultExpiryDays:7});
  if(!env.DB)throw new HttpError(503,'Private storage is unavailable. No changes were saved.','storage_unavailable');
  const ipHash=await hash(request.headers.get('cf-connecting-ip')??'local');
  await rate(env.DB,`traffic:${ipHash}`,bounded(env.RATE_LIMIT_PER_MINUTE,180,1,1000),60_000);
  if(path==='/api/workspaces'&&method==='POST'){
    const existingOwner=readCookie(request,'cpl_owner')?await owner(request,env):undefined;
    const input=await body(request,challengeSchema);await rate(env.DB,`create:${ipHash}`,bounded(env.CREATE_LIMIT_PER_HOUR,5,1,100),3_600_000);
    if(existingOwner){const recovery=token();await ownerWrite(request,env,existingOwner.id,env.DB.prepare('UPDATE workspaces SET recovery_hash=? WHERE id=?').bind(await hash(recovery),existingOwner.id));return json({workspace:workspace(existingOwner),managementLink:`${url.origin}/recover#${recovery}`},201);}
    await protect(request,env,input.turnstileToken,'create');
    const id=crypto.randomUUID(),recovery=token(),session=token(),expiry=after(retentionDays(env)*DAY);
    const results=await env.DB.batch([
      env.DB.prepare('INSERT INTO workspaces(id,recovery_hash,expires_at) SELECT ?,?,? WHERE (SELECT COUNT(*) FROM workspaces)<?').bind(id,await hash(recovery),expiry,bounded(env.MAX_WORKSPACES,1000,1,10000)),
      env.DB.prepare('INSERT INTO owner_sessions(token_hash,workspace_id,expires_at) SELECT ?,id,? FROM workspaces WHERE id=?').bind(await hash(session),minDate(after(7*DAY),expiry),id),
    ]);
    if(!results[0]?.meta.changes||!results[1]?.meta.changes)throw new HttpError(429,'Hosted workspace capacity has been reached.','quota');
    const row=await env.DB.prepare('SELECT id,settings_json,created_at,expires_at FROM workspaces WHERE id=?').bind(id).first<WorkspaceRow>();
    return json({workspace:workspace(row!),managementLink:`${url.origin}/recover#${recovery}`},201,{'Set-Cookie':cookie('cpl_owner',session,'/api',7*86400)});
  }
  if(path==='/api/recover'&&method==='POST'){
    const input=await body(request,tokenSchema);await rate(env.DB,`recover:${ipHash}`,20,3_600_000);
    const row=await env.DB.prepare('SELECT id,settings_json,created_at,expires_at FROM workspaces WHERE recovery_hash=? AND expires_at>?').bind(await hash(input.token),now()).first<WorkspaceRow>();
    if(!row)throw new HttpError(401,'This private management link is unavailable or expired.','unauthorized');
    const session=token();await env.DB.prepare('INSERT INTO owner_sessions(token_hash,workspace_id,expires_at) SELECT ?,id,? FROM workspaces WHERE id=? AND recovery_hash=? AND expires_at>?').bind(await hash(session),minDate(after(7*DAY),row.expires_at),row.id,await hash(input.token),now()).run().then(result=>{if(!result.meta.changes)throw new HttpError(401,'This management link changed.','unauthorized');});
    return json({workspace:workspace(row)},200,{'Set-Cookie':cookie('cpl_owner',session,'/api',7*86400)});
  }
  const reviewMatch=path.match(/^\/api\/review\/([a-f0-9-]{36})(?:\/(exchange|decision|export))?$/);
  if(reviewMatch){
    const id=reviewMatch[1]!,action=reviewMatch[2];
    if(action==='exchange'&&method==='POST'){
      const input=await body(request,tokenSchema);await rate(env.DB,`exchange:${ipHash}`,40,3_600_000);const capabilityHash=await hash(input.token);
      const v=await env.DB.prepare('SELECT v.* FROM versions v JOIN requests r ON r.id=v.request_id WHERE v.id=? AND v.token_hash=? AND v.access_revoked=0 AND v.expires_at>? AND r.retain_until>?').bind(id,capabilityHash,now(),now()).first<VersionRow>();
      if(!v)throw new HttpError(401,'This private review link is unavailable or expired.','unauthorized');
      const session=token();const result=await env.DB.prepare('INSERT INTO review_sessions(token_hash,version_id,capability_hash,expires_at) SELECT ?,v.id,v.token_hash,? FROM versions v JOIN requests r ON r.id=v.request_id WHERE v.id=? AND v.token_hash=? AND v.access_revoked=0 AND v.expires_at>? AND r.retain_until>?').bind(await hash(session),minDate(after(DAY),v.expires_at),id,capabilityHash,now(),now()).run();if(!result.meta.changes)conflict();
      return json({review:await reviewRecord(env,v)},200,{'Set-Cookie':cookie(reviewCookie(id),session,`/api/review/${id}`,86400)});
    }
    const v=await reviewAuth(request,env,id);
    if((!action||action==='export')&&method==='GET')return json(action==='export'?{format:'CPL Extra Work Approval customer record',exportedAt:now(),timezone:'UTC',review:await reviewRecord(env,v)}:{review:await reviewRecord(env,v)});
    if(action==='decision'&&method==='POST'){
      const input=await body(request,decisionSchema);const payloadHash=await hash(JSON.stringify(input));
      const existing=await env.DB.prepare('SELECT * FROM decisions WHERE version_id=?').bind(id).first<DecisionRow>();
      if(existing){if(existing.idempotency_key!==input.idempotencyKey||existing.payload_hash!==payloadHash)conflict();return json({review:await reviewRecord(env,v),receipt:decision(existing,v)});}
      try{await env.DB.prepare('INSERT INTO decisions(version_id,action,respondent_name,comment,acknowledged,idempotency_key,payload_hash,authorized_capability_hash,authorized_session_hash) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,input.action,input.respondentName,input.comment,input.acknowledged?1:0,input.idempotencyKey,payloadHash,v.token_hash,await hash(readCookie(request,reviewCookie(id))!)).run();}catch(error){
        const retried=await env.DB.prepare('SELECT * FROM decisions WHERE version_id=?').bind(id).first<DecisionRow>();if(retried&&retried.idempotency_key===input.idempotencyKey&&retried.payload_hash===payloadHash){const fresh=await env.DB.prepare('SELECT * FROM versions WHERE id=?').bind(id).first<VersionRow>();return json({review:await reviewRecord(env,fresh!),receipt:decision(retried,v)});}if(String(error).includes('stale_decision')||String(error).includes('UNIQUE'))conflict();throw error;
      }
      const fresh=await env.DB.prepare('SELECT * FROM versions WHERE id=?').bind(id).first<VersionRow>();const stored=await env.DB.prepare('SELECT * FROM decisions WHERE version_id=?').bind(id).first<DecisionRow>();
      return json({review:await reviewRecord(env,fresh!),receipt:decision(stored!,fresh!)});
    }
    throw new HttpError(404,'Record unavailable.','not_found');
  }
  const w=await owner(request,env);
  if(path==='/api/session'&&method==='GET')return json({workspace:workspace(w),csrf:'1'});
  if(path==='/api/settings'&&method==='PUT'){const settings=await body(request,settingsSchema);await ownerWrite(request,env,w.id,env.DB.prepare('UPDATE workspaces SET settings_json=? WHERE id=?').bind(JSON.stringify(settings),w.id));return json({workspace:{...workspace(w),settings}});}
  if(path==='/api/recovery/rotate'&&method==='POST'){await body(request,z.object({}).strict());const recovery=token();await ownerWrite(request,env,w.id,env.DB.prepare('UPDATE workspaces SET recovery_hash=? WHERE id=?').bind(await hash(recovery),w.id));return json({managementLink:`${url.origin}/recover#${recovery}`});}
  if(path==='/api/sessions/revoke'&&method==='POST'){await body(request,z.object({}).strict());await ownerWrite(request,env,w.id,env.DB.prepare('DELETE FROM owner_sessions WHERE workspace_id=?').bind(w.id));return json({ok:true},200,{'Set-Cookie':cookie('cpl_owner','','/api',0)});}
  if(path==='/api/workspace'&&method==='DELETE'){await body(request,z.object({confirmation:z.literal('DELETE')}).strict());await ownerWrite(request,env,w.id,env.DB.prepare('DELETE FROM workspaces WHERE id=?').bind(w.id));return json({ok:true},200,{'Set-Cookie':cookie('cpl_owner','','/api',0)});}
  if(path==='/api/workspace/export'&&method==='GET'){
    const rows=await env.DB.prepare('SELECT * FROM requests WHERE workspace_id=? AND retain_until>? ORDER BY created_at DESC LIMIT 100').bind(w.id,now()).all<RequestRow>();return json({format:'CPL Extra Work Approval owner archive',exportedAt:now(),timezone:'UTC',workspace:workspace(w),requests:await Promise.all(rows.results.map(r=>ownerRecord(env,r))),limitations:LIMITATIONS});
  }
  if(path==='/api/requests'&&method==='GET'){
    const rows=await env.DB.prepare('SELECT r.*,v.expires_at AS current_expires,v.snapshot_json AS current_snapshot FROM requests r LEFT JOIN versions v ON v.id=r.current_version_id WHERE r.workspace_id=? AND r.retain_until>? ORDER BY r.created_at DESC LIMIT 100').bind(w.id,now()).all<RequestRow&{current_expires:string|null;current_snapshot:string|null}>();
    return json({requests:rows.results.map(r=>{const d=r.current_snapshot?JSON.parse(r.current_snapshot) as Snapshot:draftSchema.parse(JSON.parse(r.draft_json));return{id:r.id,reference:r.reference,jobTitle:d.jobTitle,customerName:d.customerName,status:r.status==='awaiting'&&r.current_expires&&r.current_expires<=now()?'expired':r.status,createdAt:r.created_at,updatedAt:r.updated_at,retainUntil:r.retain_until,totalCents:calculatePrice(d).totalCents,currentVersion:r.current_version,revision:r.revision};}),refreshedAt:now()});
  }
  if(path==='/api/requests'&&method==='POST'){
    const input=await body(request,z.object({draft:draftSchema,idempotencyKey:z.string().uuid()}).strict());calculatePrice(input.draft);const payloadHash=await hash(JSON.stringify(input.draft));
    const existing=await env.DB.prepare('SELECT * FROM requests WHERE workspace_id=? AND creation_key=?').bind(w.id,input.idempotencyKey).first<RequestRow>();if(existing){if(existing.retain_until<=now())throw new HttpError(404,'Record unavailable.','not_found');if(existing.creation_hash!==payloadHash)conflict();await authorizedMutation(request,env,w.id,[]);return json({request:await ownerRecord(env,existing)},201);}
    if(input.draft.linkedRequestId)await owned(env,w.id,input.draft.linkedRequestId);
    const id=crypto.randomUUID(),retainUntil=after(retentionDays(env)*DAY);const reference=`EW-${id.slice(0,8).toUpperCase()}`;
    const result=await ownerWrite(request,env,w.id,env.DB.prepare("INSERT INTO requests(id,workspace_id,reference,draft_json,retain_until,creation_key,creation_hash) SELECT ?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM requests WHERE workspace_id=?)<?").bind(id,w.id,reference,JSON.stringify(input.draft),retainUntil,input.idempotencyKey,payloadHash,w.id,bounded(env.MAX_REQUESTS_PER_WORKSPACE,20,1,100)));if(!result.meta.changes)throw new HttpError(429,'This workspace has reached its hosted request limit. Export and delete older records to continue.','quota');
    return json({request:await ownerRecord(env,await owned(env,w.id,id))},201);
  }
  const match=path.match(/^\/api\/requests\/([a-f0-9-]{36})(?:\/(publish|revoke|export|link\/rotate))?$/);
  if(match){
    const id=match[1]!,action=match[2];const row=await owned(env,w.id,id);
    if((!action||action==='export')&&method==='GET')return json(action==='export'?{format:'CPL Extra Work Approval owner record',exportedAt:now(),timezone:'UTC',request:await ownerRecord(env,row),limitations:LIMITATIONS}:{request:await ownerRecord(env,row)});
    if(!action&&method==='PUT'){
      const input=await body(request,z.object({draft:draftSchema,revision:z.number().int().positive()}).strict());calculatePrice(input.draft);if(input.draft.linkedRequestId)await owned(env,w.id,input.draft.linkedRequestId);
      const result=await ownerWrite(request,env,w.id,env.DB.prepare("UPDATE requests SET draft_json=?,revision=revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND workspace_id=? AND revision=? AND status!='approved' AND retain_until>strftime('%Y-%m-%dT%H:%M:%fZ','now')").bind(JSON.stringify(input.draft),id,w.id,input.revision));if(!result.meta.changes)conflict();return json({request:await ownerRecord(env,await owned(env,w.id,id))});
    }
    if(!action&&method==='DELETE'){const input=await body(request,revisionSchema);const result=await ownerWrite(request,env,w.id,env.DB.prepare('DELETE FROM requests WHERE id=? AND workspace_id=? AND revision=?').bind(id,w.id,input.revision));if(!result.meta.changes)conflict();return json({ok:true});}
    if(action==='revoke'&&method==='POST'){
      const input=await body(request,revisionSchema);const result=await ownerWrite(request,env,w.id,env.DB.prepare("UPDATE requests SET revoked_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),status=CASE WHEN status='awaiting' THEN 'revoked' ELSE status END,revision=revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND workspace_id=? AND revision=?").bind(id,w.id,input.revision));if(!result.meta.changes)conflict();return json({request:await ownerRecord(env,await owned(env,w.id,id))});
    }
    if(action==='link/rotate'&&method==='POST'){
      const input=await body(request,revisionSchema);const capability=token();
      const result=await ownerWrite(request,env,w.id,env.DB.prepare("UPDATE versions SET token_hash=? WHERE id=? AND status='awaiting' AND access_revoked=0 AND expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now') AND EXISTS(SELECT 1 FROM requests r WHERE r.id=versions.request_id AND r.workspace_id=? AND r.revision=? AND r.retain_until>strftime('%Y-%m-%dT%H:%M:%fZ','now'))").bind(await hash(capability),row.current_version_id,w.id,input.revision));
      if(!result.meta.changes)conflict();return json({request:await ownerRecord(env,await owned(env,w.id,id)),customerLink:`${url.origin}/review/${row.current_version_id}#${capability}`});
    }
    if(action==='publish'&&method==='POST'){
      const input=await body(request,publishSchema);const publishHash=await hash(JSON.stringify({revision:input.revision,expiryDays:input.expiryDays}));
      const existing=await env.DB.prepare('SELECT * FROM versions WHERE request_id=? AND publish_key=?').bind(id,input.idempotencyKey).first<VersionRow>();
      const capability=token();
      if(existing){if(existing.publish_hash!==publishHash||existing.status!=='awaiting'||existing.access_revoked||existing.expires_at<=now())conflict();const result=await ownerWrite(request,env,w.id,env.DB.prepare("UPDATE versions SET token_hash=? WHERE id=? AND status='awaiting' AND access_revoked=0 AND expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now')").bind(await hash(capability),existing.id));if(!result.meta.changes)conflict();return json({request:await ownerRecord(env,await owned(env,w.id,id)),customerLink:`${url.origin}/review/${existing.id}#${capability}`});}
      if(row.revision!==input.revision||row.status==='approved')conflict();
      let snapshot;try{snapshot=createSnapshot(draftSchema.parse(JSON.parse(row.draft_json)));}catch(error){throw new HttpError(400,error instanceof Error?error.message:'Complete the required fields.','validation');}
      await rate(env.DB,`publish:${w.id}`,bounded(env.PUBLISH_LIMIT_PER_HOUR,30,1,100),3_600_000);await protect(request,env,input.turnstileToken,'publish');
      const versionId=crypto.randomUUID(),snapshotJson=JSON.stringify(snapshot),expiresAt=minDate(after(input.expiryDays*DAY),row.retain_until);
      try{const result=await ownerWrite(request,env,w.id,env.DB.prepare("INSERT INTO versions(id,request_id,version_number,expected_revision,snapshot_json,content_hash,expires_at,token_hash,publish_key,publish_hash) SELECT ?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM versions WHERE request_id=?)<?").bind(versionId,id,row.current_version+1,input.revision,snapshotJson,await hash(snapshotJson),expiresAt,await hash(capability),input.idempotencyKey,publishHash,id,bounded(env.MAX_VERSIONS_PER_REQUEST,20,1,30)));if(!result.meta.changes)throw new HttpError(429,'This request has reached its version limit. Create a separate linked request.','quota');}catch(error){if(String(error).includes('stale_publication')||String(error).includes('UNIQUE'))conflict();throw error;}
      return json({request:await ownerRecord(env,await owned(env,w.id,id)),customerLink:`${url.origin}/review/${versionId}#${capability}`});
    }
  }
  throw new HttpError(404,'Record unavailable.','not_found');
}
export async function purge(env:Env):Promise<void>{
  const time=now();await env.DB.batch([
    env.DB.prepare('DELETE FROM requests WHERE id IN (SELECT id FROM requests WHERE retain_until<=? LIMIT 100)').bind(time),
    env.DB.prepare('DELETE FROM workspaces WHERE id IN (SELECT id FROM workspaces WHERE expires_at<=? LIMIT 25)').bind(time),
    env.DB.prepare('DELETE FROM owner_sessions WHERE token_hash IN (SELECT token_hash FROM owner_sessions WHERE expires_at<=? LIMIT 500)').bind(time),
    env.DB.prepare('DELETE FROM review_sessions WHERE token_hash IN (SELECT token_hash FROM review_sessions WHERE expires_at<=? LIMIT 500)').bind(time),
    env.DB.prepare('DELETE FROM rate_limits WHERE key IN (SELECT key FROM rate_limits WHERE reset_at<=? LIMIT 1000)').bind(time),
  ]);
}
export default {
  async fetch(request:Request,env:Env):Promise<Response>{
    try{const url=new URL(request.url),path=url.pathname;if(env.ENVIRONMENT==='production'&&url.protocol!=='https:'){if(path.startsWith('/api/'))throw new HttpError(400,'HTTPS is required for private API access.','https_required');return secured(new Response(null,{status:308,headers:{Location:`https://${url.host}${path}`}}));}if(path.startsWith('/api/'))return secured(await api(request,env));return secured(await env.ASSETS.fetch(request));}
    catch(error){if(error instanceof HttpError)return secured(json({error:error.message,code:error.code},error.status));if(error instanceof z.ZodError)return secured(json({error:error.issues.map(issue=>issue.message).slice(0,5).join(' '),code:'validation'},400));return secured(json({error:'Private storage is temporarily unavailable. No success has been confirmed. Retry with the same action to check its result.',code:'storage_unavailable'},503));}
  },
  async scheduled(_controller:ScheduledController,env:Env,context:ExecutionContext):Promise<void>{context.waitUntil(purge(env));},
} satisfies ExportedHandler<Env>;

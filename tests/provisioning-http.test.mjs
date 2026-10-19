import test from 'node:test';
import assert from 'node:assert/strict';
import {handleProvisioning,localProvisioningAvailable} from '../app/lib/provisioning-http.ts';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),origin='http://127.0.0.1:3000';
const command=()=>({action:'provision',schoolId:id(1),requestId:id(2),email:'synthetic@fixture.invalid',roles:['teacher'],subjectIds:['math'],reason:'Synthetic request',password:'PRIVATE-synthetic-pass'});
function fixture() {
  const c=command(),calls=[];let user=null;
  const journal={id:c.requestId,school_id:c.schoolId,actor_id:id(3),reserved_user_id:id(4),email:c.email,roles:c.roles,subject_ids:c.subjectIds,reason:c.reason,completed_at:null,completed_user_id:null};
  const deps={enabled:true,origin,authorize:async()=>{calls.push('authorize');return {actorId:id(3)};},reserve:async input=>{calls.push('reserve');assert.equal('password' in input,false);return id(4);},read:async()=>{calls.push('read');return structuredClone(journal);},claim:async()=>{calls.push('claim');return {status:'claimed',epoch:1,token:id(5),expiresAt:new Date(Date.now()+60000).toISOString()};},owns:async()=>true,lookup:async target=>{calls.push('lookup');assert.equal(target,id(4));return user?{status:'found',user}:{status:'missing'};},create:async(j,p)=>{calls.push('create');assert.equal(p,c.password);user={id:j.reserved_user_id,email:j.email,app_metadata:{tanaw_provision_request_id:j.id,tanaw_provision_school_id:j.school_id}};},finish:async()=>{calls.push('finish');journal.completed_at=new Date().toISOString();journal.completed_user_id=id(4);return id(4);}};
  return {c,calls,journal,deps};
}
const req=(c,headers={})=>new Request(origin+'/api/accounts/provision',{method:'POST',headers:{origin,'content-type':'application/json',...headers},body:JSON.stringify(c)});
const clean=async r=>{assert.equal(r.headers.get('cache-control'),'no-store, private');const text=await r.text();assert.doesNotMatch(text,/PRIVATE|password|token|epoch|reserved_user|actor_id|app_metadata/);return JSON.parse(text);};
test('HTTP provision uses immutable journal, exact Auth and fenced receipt; status does no privileged work',async()=>{
  const f=fixture(),r=await handleProvisioning(req(f.c),f.deps);assert.equal(r.status,200);assert.equal((await clean(r)).code,'account-complete');
  assert.equal(f.calls.filter(x=>x==='create').length,1);assert.ok(f.calls.indexOf('reserve')<f.calls.indexOf('claim'));
  f.calls.length=0;const status=await handleProvisioning(req({action:'status',schoolId:id(1),requestId:id(2)}),f.deps);assert.equal(status.status,200);await clean(status);assert.ok(f.calls.every(x=>['authorize','read'].includes(x)));
  f.calls.length=0;assert.equal((await handleProvisioning(req(f.c),f.deps)).status,200);assert.ok(!f.calls.includes('create')&&!f.calls.includes('claim'));
});
test('disabled, wrong-origin, anonymous and non-coordinator requests cannot reach privileged operations',async()=>{
  for(const mode of ['disabled','origin','anonymous','teacher']){const f=fixture();if(mode==='disabled')f.deps.enabled=false;if(mode==='anonymous')f.deps.authorize=async()=> 'unauthenticated';if(mode==='teacher')f.deps.authorize=async()=> 'denied';const r=await handleProvisioning(req(f.c,mode==='origin'?{origin:'https://attacker.invalid'}:{}),f.deps);assert.equal(r.status,mode==='disabled'?503:mode==='anonymous'?401:403);await clean(r);assert.ok(!f.calls.includes('reserve')&&!f.calls.includes('claim')&&!f.calls.includes('create'));}
});
test('strict request shape rejects actor/UUID/token injection, weak password, duplicate roles and malformed input',async()=>{
  for(const mutate of [c=>c.actorId=id(3),c=>c.reserved_user_id=id(4),c=>c.token=id(5),c=>c.password='short',c=>c.roles=['teacher','teacher'],c=>c.roles=['invented'],c=>c.subjectIds=['bad\nsubject'],c=>c.reason=' ',c=>c.email='padded@fixture.invalid ',c=>c.action='invented']){const f=fixture();mutate(f.c);const r=await handleProvisioning(req(f.c),f.deps);assert.equal(r.status,400);await clean(r);assert.deepEqual(f.calls,[]);}
  const f=fixture();assert.equal((await handleProvisioning(req(f.c,{'content-encoding':'gzip'}),f.deps)).status,415);
  const r=await handleProvisioning(req({...f.c,reason:'x'.repeat(9000)}),f.deps);assert.equal(r.status,413);await clean(r);assert.deepEqual(f.calls,[]);
});
test('mismatched journal scope, actor, reserved UUID or payload cannot create Auth',async()=>{
  for(const field of ['school_id','actor_id','reserved_user_id','email','reason','roles','subject_ids']){const f=fixture();f.journal[field]=['roles','subject_ids'].includes(field)?['different']:field==='email'?'other@fixture.invalid':field==='reason'?'Other reason':id(9);const r=await handleProvisioning(req(f.c),f.deps);assert.equal(r.status,404);await clean(r);assert.ok(!f.calls.includes('claim')&&!f.calls.includes('create'));}
});
test('busy or unknown ownership stays pending; no token or source error escapes',async()=>{
  for(const mode of ['busy','malformed','expired','lost']){const f=fixture();if(mode==='busy')f.deps.claim=async()=>({status:'busy',token:'PRIVATE'});if(mode==='malformed')f.deps.claim=async()=>({status:'claimed',epoch:0,token:'PRIVATE'});if(mode==='expired')f.deps.claim=async()=>({status:'claimed',epoch:1,token:id(5),expiresAt:new Date(Date.now()-1).toISOString()});if(mode==='lost')f.deps.owns=async()=>false;const r=await handleProvisioning(req(f.c),f.deps);assert.equal(r.status,202);await clean(r);assert.ok(!f.calls.includes('create')&&!f.calls.includes('finish'));}
});
test('lost finish response is pending; explicit status recovers durable receipt without another Auth write',async()=>{
  const f=fixture(),finish=f.deps.finish;f.deps.finish=async()=>{await finish();throw Error('PRIVATE uncertain response');};const r=await handleProvisioning(req(f.c),f.deps);assert.equal(r.status,202);await clean(r);
  f.calls.length=0;const status=await handleProvisioning(req({action:'status',schoolId:id(1),requestId:id(2)}),f.deps);assert.equal(status.status,200);await clean(status);assert.ok(!f.calls.includes('create')&&!f.calls.includes('finish'));
});
test('identity conflict and revocation cannot be presented as completed',async()=>{
  const f=fixture();f.deps.lookup=async()=>({status:'found',user:{id:id(9)}});const r=await handleProvisioning(req(f.c),f.deps);assert.equal(r.status,409);await clean(r);assert.ok(!f.calls.includes('finish'));
  const g=fixture(),authorize=g.deps.authorize;let checks=0;g.deps.authorize=async()=>++checks===1?authorize():'denied';const lost=await handleProvisioning(req(g.c),g.deps);assert.equal(lost.status,403);await clean(lost);
});
test('status of missing request is private; expected SQL denials/conflicts remain static',async()=>{
  const f=fixture();f.deps.read=async()=>null;assert.equal((await handleProvisioning(req({action:'status',schoolId:id(1),requestId:id(2)}),f.deps)).status,404);
  for(const [code,status]of [['42501',403],['22023',409],['40001',409],['PRIVATE',202]]){const g=fixture();g.deps.reserve=async()=>{throw {code,message:'PRIVATE'};};const r=await handleProvisioning(req(g.c),g.deps);assert.equal(r.status,status);await clean(r);assert.ok(!g.calls.includes('claim'));}
});
test('local activation requires both credentials, explicit flag and exact loopback backend/origin',()=>{
  const config={enabled:'1',origin,supabaseUrl:'http://127.0.0.1:55321',publicKey:'synthetic-public',serviceKey:'PRIVATE'};
  assert.equal(localProvisioningAvailable(config),true);
  for(const change of [{enabled:undefined},{publicKey:undefined},{serviceKey:undefined},{supabaseUrl:'https://hosted.invalid'},{supabaseUrl:'http://localhost:55321'},{origin:'https://school.invalid'},{origin:origin+'/'},{origin:origin+'/path'},{origin:'http://user:PRIVATE@127.0.0.1:3000'},{origin:'file:///tmp/app'}])assert.equal(localProvisioningAvailable({...config,...change}),false);
});
test('stream overflow and cancellation are bounded without starting authorization',async()=>{
  const f=fixture();let canceled=false;
  const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(8193));},cancel(){canceled=true;}});
  const request=new Request(origin+'/api/accounts/provision',{method:'POST',headers:{origin,'content-type':'application/json'},body:stream,duplex:'half'});
  assert.equal((await handleProvisioning(request,f.deps)).status,413);assert.ok(canceled);assert.deepEqual(f.calls,[]);
  const controller=new AbortController();const stalled=new ReadableStream({cancel(){return new Promise(()=>{});}});
  const waiting=handleProvisioning(new Request(origin+'/api/accounts/provision',{method:'POST',headers:{origin,'content-type':'application/json'},body:stalled,duplex:'half',signal:controller.signal}),f.deps);
  controller.abort();assert.equal((await waiting).status,408);assert.deepEqual(f.calls,[]);
});
test('process concurrency is bounded and a finish response alone is not completion evidence',async()=>{
  const f=fixture();let release;const gate=new Promise(resolve=>{release=resolve;});let started=0;
  f.deps.authorize=async()=>{started++;await gate;return 'denied';};
  const first=handleProvisioning(req(f.c),f.deps),second=handleProvisioning(req(f.c),f.deps);
  const deadline=Date.now()+1000;
  try {
    while(started<2&&Date.now()<deadline)await new Promise(resolve=>setImmediate(resolve));
    assert.equal(started,2,'Both admitted requests must reach the bounded gate');
    const busy=await handleProvisioning(req(f.c),f.deps);assert.equal(busy.status,429);await clean(busy);
  } finally {release();}
  assert.deepEqual((await Promise.all([first,second])).map(r=>r.status),[403,403]);
  const g=fixture();g.deps.finish=async()=>id(4);const pending=await handleProvisioning(req(g.c),g.deps);assert.equal(pending.status,202);assert.equal((await clean(pending)).code,'account-pending');
});
test('request cancellation during an ignored-abort reservation does not start later stages',async()=>{
  const f=fixture(),controller=new AbortController();let ready,release;
  const started=new Promise(resolve=>{ready=resolve;}),late=new Promise(resolve=>{release=resolve;});
  f.deps.reserve=async()=>{ready();await late;return id(4);};
  const request=new Request(origin+'/api/accounts/provision',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(f.c),signal:controller.signal});
  const waiting=handleProvisioning(request,f.deps);await started;controller.abort();
  const result=await waiting;assert.equal(result.status,202);await clean(result);release();await new Promise(resolve=>setImmediate(resolve));assert.ok(!f.calls.includes('claim')&&!f.calls.includes('create')&&!f.calls.includes('finish'));
});

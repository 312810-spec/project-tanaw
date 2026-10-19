import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileReservedAuthBounded} from '../app/lib/bounded-auth-recovery.ts';
const input = {userId:'00000000-0000-4000-8000-000000000001',requestId:'00000000-0000-4000-8000-000000000002',schoolId:'00000000-0000-4000-8000-000000000003',email:'synthetic@fixture.invalid'};
const user = () => ({id:input.userId,email:input.email,app_metadata:{tanaw_provision_request_id:input.requestId,tanaw_provision_school_id:input.schoolId}});
const pending = {status:'pending',userId:null};
const deferred = () => {let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
async function within(work) {
  let timer;
  try {return await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Recovery did not settle')),1000);})]);}
  finally {clearTimeout(timer);}
}
test('one total deadline settles ignored-abort stalls at each recovery phase',async()=>{
  for(const stall of ['ownership','lookup','create','finalLookup']) {
    const late=deferred(), signals=[];let reads=0,creates=0,checks=0;
    const out=await within(reconcileReservedAuthBounded(input,{
      ownsRequest:async s=>{signals.push(s);checks++;return stall==='ownership'?late.promise:true;},
      lookup:async(id,s)=>{assert.equal(id,input.userId);signals.push(s);reads++;return stall==='lookup'||(stall==='finalLookup'&&reads===2)?late.promise:{status:'missing'};},
      create:async s=>{signals.push(s);creates++;return stall==='create'?late.promise:undefined;},
    },{timeoutMs:20}));
    assert.deepEqual(out,pending);assert.ok(signals.length);assert.ok(signals.every(s=>s===signals[0]&&s.aborted));
    const before=[reads,creates,checks];late.resolve({status:'found',user:user()});
    await new Promise(resolve=>setImmediate(resolve));assert.deepEqual([reads,creates,checks],before,'No later provider stage starts after timeout');
  }
});
test('cancellation before start calls no adapter; cancellation during lookup withholds late success',async()=>{
  const first=new AbortController();first.abort();let calls=0;
  assert.deepEqual(await reconcileReservedAuthBounded(input,{ownsRequest:async()=>{calls++;return true;},lookup:async()=>{calls++;},create:async()=>{calls++;}},{timeoutMs:100,signal:first.signal}),pending);assert.equal(calls,0);
  const parent=new AbortController(), started=deferred(), late=deferred();let seen, creates=0;
  const work=reconcileReservedAuthBounded(input,{ownsRequest:async()=>true,lookup:async(_,s)=>{seen=s;started.resolve();return late.promise;},create:async()=>{creates++;}},{timeoutMs:1000,signal:parent.signal});
  await started.promise;parent.abort();assert.deepEqual(await within(work),pending);assert.ok(seen.aborted);
  late.resolve({status:'found',user:user()});await new Promise(resolve=>setImmediate(resolve));assert.equal(creates,0);
});
test('late creation can be recovered in a new invocation without creating again',async()=>{
  const late=deferred();let stored=null,creates=0;
  const deps={ownsRequest:async()=>true,lookup:async()=>stored?{status:'found',user:stored}:{status:'missing'},create:async()=>{creates++;await late.promise;stored=user();throw Error('PRIVATE late response');}};
  assert.deepEqual(await within(reconcileReservedAuthBounded(input,deps,{timeoutMs:20})),pending);
  late.resolve();await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(await reconcileReservedAuthBounded(input,deps,{timeoutMs:1000}),{status:'verified',userId:input.userId});assert.equal(creates,1);
});
test('deadline is shared across stages and abort-aware adapters receive cancellation',async()=>{
  let reads=0,creates=0,seen;
  const out=await within(reconcileReservedAuthBounded(input,{
    ownsRequest:async s=>{seen??=s;assert.equal(s,seen);return true;},
    lookup:async()=>++reads===1?{status:'missing'}:{status:'found',user:user()},
    create:async s=>{creates++;await new Promise((_,reject)=>s.addEventListener('abort',()=>reject(Error('PRIVATE cancellation')),{once:true}));},
  },{timeoutMs:20}));
  assert.deepEqual(out,pending);assert.ok(seen.aborted);assert.equal(reads,1);assert.equal(creates,1);
});
test('monotonic deadline prevents follow-up and verified output if JS delays timer delivery',async()=>{
  let reads=0;
  const out=await reconcileReservedAuthBounded(input,{ownsRequest:async()=>true,lookup:async()=>{reads++;const end=performance.now()+15;while(performance.now()<end){}return {status:'found',user:user()};},create:async()=>{throw Error('must not create');}},{timeoutMs:5});
  assert.deepEqual(out,pending);assert.equal(reads,1);
});
test('time consumed by an earlier stage is not renewed for the next stage',async()=>{
  let checks=0;
  const pause=()=>new Promise(resolve=>setTimeout(resolve,15));
  const out=await within(reconcileReservedAuthBounded(input,{
    ownsRequest:async()=>{checks++;if(checks===1)await pause();return true;},
    lookup:async()=>{await pause();return {status:'found',user:user()};},
    create:async()=>{throw Error('must not create');},
  },{timeoutMs:20}));
  assert.deepEqual(out,pending);
});
test('invalid budgets and invalid reservations call no provider',async()=>{
  let calls=0;const deps={ownsRequest:async()=>{calls++;return true;},lookup:async()=>{calls++;},create:async()=>{calls++;}};
  for(const options of [null,{},0,{timeoutMs:0},{timeoutMs:-1},{timeoutMs:1.5},{timeoutMs:30001},{timeoutMs:NaN},{timeoutMs:Infinity},{timeoutMs:20,signal:{}}])assert.deepEqual(await reconcileReservedAuthBounded(input,deps,options),pending);
  assert.deepEqual(await reconcileReservedAuthBounded({},deps,{timeoutMs:100}),{status:'invalidReservation',userId:null});assert.equal(calls,0);
});
test('normal recovery retains exact identity, ownership and private-error semantics',async()=>{
  let reads=0,creates=0;
  assert.deepEqual(await reconcileReservedAuthBounded(input,{ownsRequest:async()=>true,lookup:async()=>++reads===1?{status:'missing'}:{status:'found',user:user()},create:async()=>{creates++;throw Error('PRIVATE transport');}},{timeoutMs:1000}),{status:'verified',userId:input.userId});assert.equal(creates,1);
  for(const [deps,expected] of [
    [{ownsRequest:async()=>false,lookup:async()=>null,create:async()=>null},'ownershipLost'],
    [{ownsRequest:async()=>true,lookup:async()=>({status:'found',user:{...user(),id:input.schoolId}}),create:async()=>null},'identityConflict'],
    [{ownsRequest:async()=>true,lookup:async()=>{throw Error('PRIVATE');},create:async()=>null},'pending'],
  ]) {const out=await reconcileReservedAuthBounded(input,deps,{timeoutMs:1000});assert.deepEqual(out,{status:expected,userId:null});assert.doesNotMatch(JSON.stringify(out),/PRIVATE|email|metadata/);}
});

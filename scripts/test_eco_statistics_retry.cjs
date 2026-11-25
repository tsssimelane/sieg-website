const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('worker/earth-engine.js','utf8');
function server(sequence){let calls=0,permits=0,metrics=0;const delays=[],writes=[];
 const c={URL,URLSearchParams,Request,Response,Headers,TextEncoder,Date,Map,Set,JSON,Error,setTimeout:(fn,ms)=>{delays.push(ms);fn();},fetch:async()=>{calls++;const x=sequence.shift();if(x instanceof Error)throw x;return new Response(JSON.stringify({answer:x===200?42:null}),{status:x});},usageIsUnrestricted:async()=>true,usagePermit:async()=>{permits++;return {job:{id:'existing-analysis',service:'eco'},key:'existing-evaluation'};},usageType:()=> 'general',usagePaused:async()=>false,usageMetric:async()=>{metrics++;},usageTrialRelease:async()=>{},response:(data,status=200)=>Response.json(data,{status})};vm.createContext(c);vm.runInContext(source,c);c.geeAccessToken=async()=> 'server-only-test-token';
 const env={GEE_PROJECT_ID:'ee-gee023',GEE_SERVICE_ACCOUNT_JSON:JSON.stringify({type:'service_account',client_email:'test@example.gserviceaccount.com',private_key:'BEGIN PRIVATE KEY'}),BUCKET:{put:async(...args)=>writes.push(args),delete:async()=>{}}};
 const request=new Request('https://sieg.test/api/earth-engine/v1/projects/ee-gee023/value:compute',{method:'POST',headers:{Origin:'https://sieg.test','oai-authenticated-user-id':'owner'},body:JSON.stringify({expression:{test:true}})});
 return {run:()=>c.earthEngine(request,env),get calls(){return calls},get permits(){return permits},get metrics(){return metrics},writes,delays,c};
}
(async()=>{
 let s=server([503,503,200]),r=await s.run();assert.equal(r.status,200);assert.equal((await r.json()).answer,42);assert.equal(s.calls,3);assert.equal(s.permits,1,'Provider retries keep one permission/allowance reservation');assert.equal(s.metrics,1);assert.equal(s.writes.length,1,'Only final successful result is cached');assert.deepEqual(s.delays,[500,1000]);
 s=server([503,503,503]);r=await s.run();assert.equal(r.status,503);assert.equal(s.calls,3);assert.equal(JSON.parse(s.writes[0][1]).failed,true,'Failure is not cached as successful statistics');
 s=server([400,200]);r=await s.run();assert.equal(r.status,400);assert.equal(s.calls,1,'Invalid computation is not retried');
 s=server([new Error('network'),200]);r=await s.run();assert.equal(r.status,200);assert.equal(s.calls,2);
 let headerCalls=0;s.c.fetch=async()=>{headerCalls++;return new Response('',{status:503,headers:{'Retry-After':'60'}})};
 r=await s.c.geeComputeFetch('https://provider.test',{}, {wait:async()=>{throw Error('Must not retry early')}});assert.equal(r.status,503);assert.equal(headerCalls,1);
 const app=fs.readFileSync('enviro/assets/app.js','utf8'),helper=app.slice(app.indexOf('function temporaryStatisticsError'),app.indexOf('function drawChart'));
 let evaluations=0,changed=false;const messages=[],c={window:{SiegeUsage:{active:{id:'same-analysis'}}},request:7,ee:{Dictionary:x=>x},evaluate:async()=>{evaluations++;if(evaluations===1)throw Error('Server returned HTTP code: 503 for POST value:compute');return {area_ha:2}},status:t=>messages.push(t),setTimeout:fn=>{if(changed)c.request++;fn()},Promise,Error};vm.createContext(c);vm.runInContext(helper,c);
 assert.equal((await c.evaluateStatistics({area_ha:2},7)).area_ha,2);assert.equal(evaluations,2);assert.match(messages[0],/Retrying statistics/);
 evaluations=0;changed=true;await assert.rejects(c.evaluateStatistics({},7),/selected analysis changed/);assert.equal(evaluations,1,'Changing area/indicator cancels the stale retry');
 c.request=7;evaluations=0;c.evaluate=async()=>{evaluations++;throw Error('Permission denied')};await assert.rejects(c.evaluateStatistics({},7),/Permission denied/);assert.equal(evaluations,1);
 console.log('PASS: transient compute recovery, one allowance reservation, bounded retries, Retry-After, failure caching, statistics-only recovery and stale-request cancellation');
})().catch(error=>{console.error(error);process.exitCode=1});

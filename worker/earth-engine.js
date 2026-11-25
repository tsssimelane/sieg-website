// Server-only Earth Engine credentials. Never embed keys or Google access tokens in responses.
// Cache only completed values. Worker I/O promises belong to their creating request.
let geeTokenCache=null;
const geeLimits=new Map();
function geeConfig(env){if(!env.GEE_SERVICE_ACCOUNT_JSON||!env.GEE_PROJECT_ID)return null;const account=JSON.parse(env.GEE_SERVICE_ACCOUNT_JSON);if(!/^[a-z][a-z0-9-]{4,62}$/.test(env.GEE_PROJECT_ID)||account.type!=='service_account'||!account.client_email?.endsWith('.gserviceaccount.com')||!account.private_key?.includes('BEGIN PRIVATE KEY'))throw Error('Invalid server configuration');return {project:env.GEE_PROJECT_ID,account};}
function geeBase64(value){const bytes=typeof value==='string'?new TextEncoder().encode(value):new Uint8Array(value);let binary='';for(const b of bytes)binary+=String.fromCharCode(b);return btoa(binary).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');}
async function geeAccessToken(config){const cacheKey=config.project+'|'+config.account.client_email+'|'+config.account.private_key;if(geeTokenCache?.key===cacheKey&&geeTokenCache.expires>Date.now()+60000)return geeTokenCache.token;return await (async()=>{const now=Math.floor(Date.now()/1000),header=geeBase64(JSON.stringify({alg:'RS256',typ:'JWT'})),claim=geeBase64(JSON.stringify({iss:config.account.client_email,scope:'https://www.googleapis.com/auth/earthengine',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600})),unsigned=header+'.'+claim;const pem=config.account.private_key.replace(/-----[^-]+-----|\s/g,''),key=await crypto.subtle.importKey('pkcs8',Uint8Array.from(atob(pem),c=>c.charCodeAt(0)),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']),signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(unsigned));const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:unsigned+'.'+geeBase64(signature)}),signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Google service authorization failed');const data=await r.json();if(typeof data.access_token!=='string')throw Error('Google service authorization failed');geeTokenCache={key:cacheKey,token:data.access_token,expires:Date.now()+Number(data.expires_in||3600)*1000};return data.access_token;})();}
// value:compute is a read-only evaluation. Retry it inside the same authorized
// request so transient provider failures do not reserve another allowance.
async function geeComputeFetch(url,options,{wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),attempts=3}={}){
 const transient=new Set([429,500,502,503,504]);
 for(let attempt=0;attempt<attempts;attempt++){
  let result;
  try{result=await fetch(url,options);}catch(error){
   if(options.signal?.aborted||error?.name==='AbortError')throw error;
   if(attempt===attempts-1){const failure=Error('The analysis provider is temporarily unreachable. Retry this indicator; your paid access is retained.');failure.status=503;throw failure;}
   await wait(500*2**attempt);continue;
  }
  if(!transient.has(result.status)||attempt===attempts-1)return result;
  const retryAfter=result.headers.get('Retry-After');
  const requested=retryAfter===null?0:/^\d+(?:\.\d+)?$/.test(retryAfter)?Number(retryAfter)*1000:Math.max(0,Date.parse(retryAfter)-Date.now())||0;
  // Do not retry early when the provider asks for a longer pause.
  if(requested>10000)return result;
  await result.body?.cancel().catch(()=>{});
  await wait(Math.max(requested,500*2**attempt));
 }
}
async function earthEngine(request,env){const url=new URL(request.url);let config;try{config=geeConfig(env)}catch{return response({ready:false,error:'SIEG analysis service configuration needs administrator attention.'},503)}if(url.pathname==='/api/earth-engine/status')return response(config?{ready:true,project:config.project}:{ready:false,error:'SIEG’s shared analysis service is awaiting administrator configuration.'});if(!config)return response({error:{code:503,message:'SIEG’s shared analysis service is awaiting administrator configuration.'}},503);
// The existing private Site authenticates visitors; no Google account is required.
if(!request.headers.get('oai-authenticated-user-id'))return response({error:{code:401,message:'Sign in to SIEG to use analysis.'}},401);
if(!['GET','POST'].includes(request.method))return response({error:{code:405,message:'Method not allowed'}},405);
if(request.method==='POST'&&request.headers.get('Origin')!==url.origin)return response({error:{code:403,message:'Origin not allowed'}},403);
const path=url.pathname.slice('/api/earth-engine'.length),prefix='/v1/projects/'+config.project+'/';if(!path.startsWith(prefix))return response({error:{code:403,message:'Analysis project not allowed'}},403);const tail=path.slice(prefix.length);const allowed=request.method==='POST'?/^(value:compute|maps|thumbnails|tables)$/.test(tail):/^(algorithms|capabilities|maps\/[A-Za-z0-9_-]+\/tiles\/\d+\/\d+\/\d+|thumbnails\/[A-Za-z0-9_-]+:getPixels|tables\/[A-Za-z0-9_-]+:getFeatures)$/.test(tail);if(!allowed)return response({error:{code:403,message:'Analysis operation not allowed'}},403);
let adminUnrestricted=await usageIsUnrestricted(request,env)||usageToolAdmin(request,await usageJob(env,url.searchParams.get('analysis')));const identity=request.headers.get('oai-authenticated-user-id'),now=Date.now();if(geeLimits.size>2000)for(const [key,value] of geeLimits)if(value.until<now)geeLimits.delete(key);let limit=geeLimits.get(identity+'|'+request.method);if(!limit||limit.until<now){limit={count:0,until:now+60000};geeLimits.set(identity+'|'+request.method,limit)}if(!adminUnrestricted&&++limit.count>(request.method==='POST'?120:600))return response({error:{code:429,message:'Too many requests. Please wait a minute.'}},429);
let body,permit,job,type='general',operation=tail;const pausedResponse=()=>response({error:{code:503,message:'SIEG analysis is paused. Please try again later.'}},503);if(request.method==='POST'){if(Number(request.headers.get('Content-Length'))>8*1024*1024)return response({error:{code:413,message:'Analysis request too large'}},413);body=await request.text();if(new TextEncoder().encode(body).length>8*1024*1024)return response({error:{code:413,message:'Analysis request too large'}},413);try{JSON.parse(body)}catch{return response({error:{code:400,message:'Invalid analysis request'}},400)}}
try{
 if(request.method==='POST'){
 const parsed=JSON.parse(body);delete parsed.workloadTag;permit=await usagePermit(request,env,parsed,tail);job=permit.job;adminUnrestricted=adminUnrestricted||usageToolAdmin(request,job);if(job)type=usageType(job.service,url.searchParams.get('analysisType'));
 if(permit.paused){await usageMetric(env,job,operation,type,'paused');return pausedResponse();}
 if(permit.cached)await usageMetric(env,job,operation,type,permit.cached.pending?'pending':'cache');
 if(permit.cached)return response(permit.cached.pending?{error:{code:409,message:'This analysis request is already processing. Please wait briefly, then select the indicator again.'}}:permit.cached.data,permit.cached.status||409);
 if(permit.navigation){
 // Public boundary navigation has no daily allowance. Successful lookups are reused.
 const key='analysis/navigation/'+ANALYSIS_CACHE_EPOCH+'/'+await reportSHA(JSON.stringify(parsed)),cached=await env.BUCKET.get(key);
 if(cached){const c=JSON.parse(await cached.text());if(c.status>=200&&c.status<300)return response(c.data,c.status);await env.BUCKET.delete(key);}
 permit.key=key;
 }

 if(job&&tail==='value:compute')parsed.workloadTag='sieg-'+job.service+'-'+type+'-compute';
 body=JSON.stringify(parsed);
 }else if(!['algorithms','capabilities'].includes(tail)){
 const match=tail.match(/^(maps|thumbnails|tables)\/([^/:]+)/),mapId=match?.[2],record=mapId&&await reportRead(env,'analysis/resources/'+ANALYSIS_CACHE_EPOCH+'/'+match[1]+'/'+mapId);if(!record||record.owner!==identity)return response({error:{code:403,message:'Resource does not belong to your analysis.'}},403);
 job=await usageJob(env,record.job);adminUnrestricted=adminUnrestricted||usageToolAdmin(request,job);if(ADMIN_HYDRO_TOOLS.includes(job?.task)&&!usageToolAdmin(request,job))throw Error('Administrator Toolbox access required.');if(job)type=usageType(job.service,record.analysisType);operation=({maps:'map-tile',thumbnails:'thumbnail-pixels',tables:'table-features'})[match[1]];if(!job)return response({error:{code:403,message:'Analysis record unavailable.'}},403);if(!adminUnrestricted){if(record.adminUnrestricted||job.adminBypass)throw Error('Switch to Admin—no restrictions to view this admin result.');if(job.freeTrial){await usagePilotCheck(env,job);if(job.areaKm2>0.05+1e-9||match[1]!=='maps')throw Error('Free usage permits viewing the three maps within 5 ha only.');}else if(prepaid(job.service))await hydroRequirePaid(env,job);commerceCheck(job);usageHydroCheck(job,type);}
 }
 const query=new URLSearchParams(url.search);query.delete('analysis');query.delete('analysisType');query.delete('workloadTag');
 if(job&&request.method==='POST'&&tail!=='value:compute')query.set('workloadTag','sieg-'+job.service+'-'+type+'-'+tail);
 if(!adminUnrestricted&&!['algorithms','capabilities'].includes(tail)&&await usagePaused(env)){if(permit?.key&&job)await env.BUCKET.delete(permit.key);await usageMetric(env,job,operation,type,'paused');return pausedResponse();}
 const token=await geeAccessToken(config),upstream=await (tail==='value:compute'?geeComputeFetch:fetch)('https://earthengine.googleapis.com'+path+(query.size?'?'+query:''),{method:request.method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','X-Goog-User-Project':config.project},body,redirect:'manual'});
 if(request.method==='GET'){await usageMetric(env,job,operation,type,upstream.ok?'success':'failed');return new Response(upstream.body,{status:upstream.status,headers:{'Content-Type':upstream.headers.get('Content-Type')||'application/octet-stream','Cache-Control':'private, max-age=300'}});}
 if(!upstream.ok&&permit?.trialMapHash)await usageTrialRelease(env,job,permit.trialMapHash);
 const text=await upstream.text();let data;try{data=JSON.parse(text)}catch{data=null}
 if(permit?.key){if(!upstream.ok){if(job)await env.BUCKET.put(permit.key,JSON.stringify({failed:true,status:upstream.status,createdAt:Date.now()}));else await env.BUCKET.delete(permit.key);}else await env.BUCKET.put(permit.key,JSON.stringify({status:upstream.status,createdAt:Date.now(),data:data||{error:{message:'Upstream response unavailable'}}}));if(['maps','thumbnails','tables'].includes(tail)&&upstream.ok&&data?.name){const mid=data.name.split('/').pop();await env.BUCKET.put('analysis/resources/'+ANALYSIS_CACHE_EPOCH+'/'+tail+'/'+mid,JSON.stringify({owner:identity,job:permit.job.id,analysisType:type,adminUnrestricted:!!permit.adminUnrestricted}));}}
 await usageMetric(env,job,operation,type,upstream.ok?'success':'failed',permit?.retry);
 return new Response(text,{status:upstream.status,headers:{'Content-Type':upstream.headers.get('Content-Type')||'application/json','Cache-Control':'private, no-store'}})
 }catch(e){if(permit?.trialMapHash)await usageTrialRelease(env,job,permit.trialMapHash).catch(()=>{});if(permit?.key){if(job)await env.BUCKET.put(permit.key,JSON.stringify({failed:true,status:e.status||502,createdAt:Date.now()})).catch(()=>{});else await env.BUCKET.delete(permit.key).catch(()=>{});}await usageMetric(env,job,operation,type,'failed',permit?.retry);return response({error:{code:e.status||403,message:e.message||'Analysis unavailable. Contact support before retrying.'}},e.status||403)}}

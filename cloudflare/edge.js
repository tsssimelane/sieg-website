import {analyticsTrack} from '../worker/admin-analytics.js';
import {identityRequest,anonymousRequest} from './auth.js';
import serviceRoutes from './service-routes.json' with {type:'json'};
const legacyRoutes=new Map(Object.entries(serviceRoutes).flatMap(([slug,file])=>[[file,'/'+slug],[file.replace(/\.html$/,''),'/'+slug]]));
legacyRoutes.set('environmental-monitoring.html','/eco');legacyRoutes.set('environmental-monitoring','/eco');
export const RELEASE='2026-11-25.1';
const ADMIN='tss.simelane@gmail.com';
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export function returnPath(raw){
 if(typeof raw!=='string'||!raw.startsWith('/')||raw.startsWith('//')||/[\\\x00-\x20]/.test(raw))return '/';
 try{const u=new URL(raw,'https://sieg.invalid');return u.origin==='https://sieg.invalid'&&!/^\/(?:login|logout|signin-with-chatgpt)(?:[/?#]|$)/.test(raw)?u.pathname+u.search+u.hash:'/'}catch{return '/'}
}
function safeEnvironment(env){return env.SIEG_ENV==='staging'?{...env,REPORT_CHECKOUT_ENABLED:'false',WEEKLY_CROP_ENABLED:'false',BUSINESS_SUBSCRIPTIONS_ENABLED:'false',RESEND_API_KEY:undefined,PAYGATE_KEY:undefined,TWILIO_AUTH_TOKEN:undefined}:env}
export function createHandler(app,verifyAnalysis,{identify=identityRequest}={}){
 return async function handle(incoming,rawEnv,ctx){
  const env=safeEnvironment(rawEnv),url=new URL(incoming.url),path=url.pathname;
  if(['GET','HEAD'].includes(incoming.method)){
   const name=path.slice(1),redirect=legacyRoutes.get(name)||(/\/$/.test(name)&&serviceRoutes[name.slice(0,-1)]?'/'+name.slice(0,-1):null);
   if(redirect&&redirect!==path)return Response.redirect(url.origin+redirect+url.search,308);
  }
  if(path==='/api/health')return json({status:'ok',release:RELEASE,environment:env.SIEG_ENV==='staging'?'staging':'production'});
  if(path==='/signin-with-chatgpt')return Response.redirect(url.origin+'/login?return_to='+encodeURIComponent(returnPath(url.searchParams.get('return_to'))),302);
  let request,identityFailed=false;
  try{request=await identify(incoming,env)}catch{request=anonymousRequest(incoming);identityFailed=true}
  const owner=request.headers.get('oai-authenticated-user-id'),email=request.headers.get('oai-authenticated-user-email'),admin=!!owner&&email===ADMIN;
  if(path==='/api/account'&&incoming.method==='GET')return json({authenticated:!!owner,isAdmin:admin,signInUrl:'/login',release:RELEASE});
  if(path==='/login'){
   if(incoming.method!=='GET')return json({error:'Method not allowed.'},405);
   if(!owner)return new Response('Sign-in is not ready. Ask SIEG to verify the Cloudflare Access application for /login and its audience setting.',{status:401,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
   return Response.redirect(url.origin+returnPath(url.searchParams.get('return_to')),303);
  }
  if(path==='/logout')return Response.redirect(url.origin+'/cdn-cgi/access/logout',302);
  if(path==='/admin/launch'||path==='/resources.html'){
   if(!owner)return Response.redirect(url.origin+'/login?return_to='+encodeURIComponent(path),302);
   if(!admin)return new Response('Administrator access required.',{status:403,headers:{'Cache-Control':'no-store'}});
  }
  if(path.startsWith('/api/admin/')){
   if(!admin)return json({error:'Administrator access required.'},owner?403:401);
   if(path==='/api/admin/launch-status'&&incoming.method==='GET'){
    let database='missing';try{if(env.DB){await env.DB.prepare('SELECT id FROM siege_records LIMIT 1').first();database='verified'}}catch{database='unavailable'}
    let storage='missing';try{if(env.BUCKET){await env.BUCKET.head('geocoding/villages.json');storage='verified'}}catch{storage='unavailable'}
    let analysis='missing';if(env.GEE_SERVICE_ACCOUNT_JSON&&env.GEE_PROJECT_ID){try{const key=JSON.parse(env.GEE_SERVICE_ACCOUNT_JSON);analysis=key.type==='service_account'&&key.client_email&&key.private_key?'configured':'invalid'}catch{analysis='invalid'}}
    return json({release:RELEASE,environment:env.SIEG_ENV==='staging'?'staging':'production',database,storage,analysis,email:env.RESEND_API_KEY&&env.REPORT_FROM_EMAIL?'configured':'missing',payments:env.REPORT_CHECKOUT_ENABLED==='true'?(env.PAYGATE_ID&&env.PAYGATE_KEY?'configured':'missing'):'disabled',weekly:env.WEEKLY_CROP_ENABLED==='true'?'configured':'disabled',note:'Configured means credentials are present, not that delivery or payment has been verified.'});
   }
   if(path==='/api/admin/check-analysis'&&incoming.method==='POST'){
    if(incoming.headers.get('Origin')!==url.origin)return json({error:'Origin not allowed.'},403);
    // A minute-level guard bounds live provider checks without storing credentials or responses.
    if(!env.BUCKET)return json({error:'Storage must be configured first.'},503);
    const slot='launch-checks/'+Math.floor(Date.now()/60000);
    if(!await env.BUCKET.put(slot,'1',{onlyIf:{etagDoesNotMatch:'*'}}))return json({error:'Wait one minute before checking again.'},429);
    return json(await verifyAnalysis(env));
   }
   return json({error:'Not found.'},404);
  }
  if(path==='/mcp')return json({error:'This integration is not enabled on this host.'},503);
  if(identityFailed&&path.startsWith('/api/'))return json({error:'Your sign-in has expired. Sign in again.',signInUrl:'/login'},401);
  try{
   // Explicit root lookup preserves existing .html links without canonical redirects.
   if(path==='/')request=new Request(new URL('/index.html',url),request);
   if(path==='/admin/launch')request=new Request(new URL('/launch-admin.html',url),request);
   if(serviceRoutes[path.slice(1)]){const assetURL=new URL(url);assetURL.pathname='/'+serviceRoutes[path.slice(1)];request=new Request(assetURL,request);}
   const result=await app.fetch(request,env,ctx),headers=new Headers(result.headers);
   const tracking=analyticsTrack(incoming,env,result,path).catch(()=>{});if(ctx?.waitUntil)ctx.waitUntil(tracking);else await tracking;
   headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','strict-origin-when-cross-origin');
   return new Response(result.body,{status:result.status,statusText:result.statusText,headers});
  }catch(error){
   const reference=crypto.randomUUID();console.error(JSON.stringify({event:'sieg_request_failed',reference,path,type:error?.name||'Error'}));
   return json({error:'This request could not complete. Please retry or contact SIEG.',reference},503);
  }
 };
}

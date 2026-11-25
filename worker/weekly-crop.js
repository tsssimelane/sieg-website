const WEEKLY_KIND='weekly_crop';
const weeklyDay=86400000;
const weeklyISO=d=>new Date(d).toISOString().slice(0,10);
const weeklyDefaultSchedule={day:0,time:'07:00'};
function weeklySchedule(value){
 if(!Number.isInteger(value?.day)||value.day<0||value.day>6||typeof value.time!=='string'||!/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(value.time))throw Error('Choose a delivery day and time in your detected time zone.');
 return {day:value.day,time:value.time};
}
const weeklyClocks=new Map();
function weeklyClock(now,zone){
 let format=weeklyClocks.get(zone);
 if(!format){format=new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});weeklyClocks.set(zone,format)}
 const p=Object.fromEntries(format.formatToParts(new Date(now)).map(x=>[x.type,Number(x.value)]));
 const local=new Date(Date.UTC(p.year,p.month-1,p.day)),day=(local.getUTCDay()+6)%7;
 const monday=local.getTime()-day*weeklyDay;
 return {monday,week:weeklyISO(monday),minute:day*1440+p.hour*60+p.minute};
}
let weeklyCountryZones;
async function weeklyLocation(g){
 const ring=g.coordinates[0],xs=ring.map(p=>p[0]),ys=ring.map(p=>p[1]);
 const center=[(Math.min(...xs)+Math.max(...xs))/2,(Math.min(...ys)+Math.max(...ys))/2];
 const point=addressInside(center,g)?center:ring[0];
 const {country,countryCode}=await estateLocation(point[1],point[0]);
 const zones=(weeklyCountryZones??=estateJSON('assets/country-timezones.json'))[countryCode];
 if(!zones?.length)throw Error('No delivery time zone is available for this field location.');
 return {country,countryCode,zones};
}
function weeklyZone(location,requested){
 try{if(typeof requested!=='string'||requested.length>80)return null;return new Intl.DateTimeFormat('en',{timeZone:requested}).resolvedOptions().timeZone;}catch{return null;}
}
const weeklyNode=(functionName,args)=>({functionInvocationValue:{functionName,arguments:Object.fromEntries(Object.entries(args).map(([k,v])=>[k,v&&typeof v==='object'&&('functionInvocationValue' in v||'argumentReference' in v||'functionDefinitionValue' in v)?v:{constantValue:v}]))}});
function weeklyExpression(g,start,end){
 const f=weeklyNode,geometry=f('GeometryConstructors.'+g.type,{coordinates:g.coordinates,geodesic:false});
 let collection=f('ImageCollection.load',{id:'COPERNICUS/S2_SR_HARMONIZED'});
 collection=f('Collection.filter',{collection,filter:f('Filter.intersects',{leftField:'.geo',rightValue:geometry})});
 collection=f('Collection.filter',{collection,filter:f('Filter.dateRangeContains',{leftValue:f('DateRange',{start,end}),rightField:'system:time_start'})});
 const input={argumentReference:'scene'},select=(image,bandSelectors)=>f('Image.select',{input:image,bandSelectors});
 const scl=select(input,['SCL']);
 const good=[4,5,6,7].map(v=>f('Image.eq',{image1:scl,image2:f('Image.constant',{value:v})})).reduce((a,b)=>f('Image.or',{image1:a,image2:b}));
 const ndvi=f('Image.rename',{input:f('Image.normalizedDifference',{input,bandNames:['B8','B4']}),names:['NDVI']});
 const masked=f('Image.updateMask',{image:ndvi,mask:good});
 const mapped=f('Collection.map',{collection,baseAlgorithm:{functionDefinitionValue:{argumentNames:['scene'],body:'scene'}},dropNulls:false});
 // A masked seed keeps the NDVI band defined even when no acquisitions are available.
 const seed=f('Image.updateMask',{image:f('Image.rename',{input:f('Image.constant',{value:0}),names:['NDVI']}),mask:f('Image.constant',{value:0})});
 const all=f('Collection.merge',{collection1:mapped,collection2:f('ImageCollection.fromImages',{images:[]})});
 all.functionInvocationValue.arguments.collection2.functionInvocationValue.arguments.images={arrayValue:{values:[seed]}};
 const image=f('reduce.median',{collection:all});
 const support=f('Image.unmask',{input:f('Image.mask',{image}),value:f('Image.constant',{value:0}),sameFootprint:false});
 const combined=f('Image.addBands',{dstImg:image,srcImg:f('Image.rename',{input:support,names:['coverage']})});
 return {stats:{result:'stats',values:{scene:masked,stats:f('Image.reduceRegion',{image:combined,reducer:f('Reducer.mean',{}),geometry,scale:20,maxPixels:50000})}},map:{result:'map',values:{scene:masked,map:f('Image.clip',{input:image,geometry})}}};
}
async function weeklyCompute(env,expression,resource='value:compute',extra={}){
 const cfg=geeConfig(env),token=await geeAccessToken(cfg);
 const r=await fetch('https://earthengine.googleapis.com/v1/projects/'+cfg.project+'/'+resource,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','X-Goog-User-Project':cfg.project},body:JSON.stringify({expression,...extra}),signal:AbortSignal.timeout(28000)});
 if(!r.ok)throw Error('Satellite analysis is temporarily unavailable.');
 return resource==='value:compute'?(await r.json()).result:new Uint8Array(await r.arrayBuffer());
}
function weeklyMapGrid(g){
 const points=(g.type==='Polygon'?g.coordinates:g.coordinates.flat()).flat();
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),l=Math.min(...xs),r=Math.max(...xs),b=Math.min(...ys),t=Math.max(...ys);
 const width=Math.max(r-l,(t-b)*.8)*1.16,height=Math.max(t-b,(r-l)*.8)*1.16;
 return {dimensions:{width:320,height:320},affineTransform:{scaleX:width/320,scaleY:-height/320,translateX:(l+r-width)/2,translateY:(b+t+height)/2},crsCode:'EPSG:4326'};
}
function weeklyReady(env){try{return !!(env.DB&&env.BUCKET&&reportMailReady(env)&&geeConfig(env))}catch{return false}}
async function weeklyDeliver(env,record,day,sample){
 if(!weeklyReady(env)||await usagePaused(env))throw Error('Crop analysis or email delivery is temporarily unavailable.');
 const t=Date.parse(day+'T00:00:00Z'),start=weeklyISO(t-7*weeklyDay);
 const recent=weeklyExpression(record.data.geometry,start,day),old=weeklyExpression(record.data.geometry,weeklyISO(t-14*weeklyDay),start);
 const [a,b]=await Promise.all([weeklyCompute(env,recent.stats),weeklyCompute(env,old.stats)]);
 const valid=x=>Number.isFinite(x?.NDVI)&&x.coverage>=.5;
 const attachments=[];
 if(valid(a)){
  const bytes=await weeklyCompute(env,recent.map,'image:computePixels',{fileFormat:'PNG',grid:weeklyMapGrid(record.data.geometry),visualizationOptions:{ranges:[{min:-.1,max:.85}],paletteColors:['a95234','e7c26e','86b46b','086963']}});
  let raw='';for(const byte of bytes)raw+=String.fromCharCode(byte);
  attachments.push({filename:'sieg-field-ndvi-'+day+'.png',content:btoa(raw)});
 }
 const change=valid(a)&&valid(b)?a.NDVI-b.NDVI:null;
 const note=change===null?'No reliable comparison is available.':(change>=0?'+':'')+change.toFixed(2)+' NDVI versus the previous seven days.'+(change<=-.08?' Inspect patches with low NDVI on the map and compare them with field observations.':'');
 const summary=valid(a)?'Average NDVI: '+a.NDVI.toFixed(2)+'. Usable coverage: '+Math.round(a.coverage*100)+'%. '+note:'No reliable field reading this week. Clouds or limited satellite observations left less than half the field usable.';
 const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'sieg-weekly/'+record.id+'/'+(sample?'sample':day)},body:JSON.stringify({from:env.REPORT_FROM_EMAIL,to:[record.data.email],subject:'SIEG Fields · '+(sample?'Free crop monitoring sample':'Weekly crop monitoring')+' · '+day,text:'Field: '+(record.data.areaKm2*100).toFixed(2)+' ha\nSentinel-2 observation window: '+start+' to '+day+' (end exclusive).\n\n'+summary+'\n\nNDVI is a vegetation screening indicator. Check unusual areas on the ground.\n\nTo stop updates, use Weekly crop monitoring in SIEG Fields or contact support@sieg.ltd.',attachments}),signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('The crop update could not be emailed. Try again later.');
}
async function weeklyRecord(env,id){
 const row=await env.DB.prepare('SELECT body_json FROM siege_records WHERE kind=? AND id=?').bind(WEEKLY_KIND,id).first();return row?JSON.parse(row.body_json):null;
}
async function weeklyAPI(request,env){
 const owner=opsUser(request);
 if(!owner)return opsJSON({error:'Sign in to SIEG to manage crop monitoring.'},401);
 if(!env.DB||!env.BUCKET)return opsJSON({error:'Crop monitoring storage is unavailable.'},503);
 const id='WEEKLY-'+await reportSHA(owner),record=await weeklyRecord(env,id);
 if(request.method==='GET')return opsJSON({...await loginPlanPricing(request,env,{monthly:{price:149}},'SZL'),state:record?.state||'none',paidThrough:record?.data.paidThrough,schedule:record?.data.schedule||(record?weeklyDefaultSchedule:undefined),id:record?.state==='requested'?id:undefined});
 if(request.method!=='POST'||request.headers.get('Origin')!==new URL(request.url).origin)return opsJSON({error:'Request not allowed.'},403);
 try{
  const p=await opsBody(request);
  if(p.action==='stop'){if(record){record.state='stopped';await opsStore(env,WEEKLY_KIND,record)}return opsJSON({state:'stopped',message:'Weekly updates stopped.'})}
  if(p.action==='timezone'){
   const area=usageGeometry(p.geometry);
   if(area.geometry.type!=='Polygon'||area.areaKm2>.10000001)throw Error('Use one field polygon of 10 hectares or less.');
   return opsJSON(await weeklyLocation(area.geometry));
  }
  if(p.action==='schedule'){
   if(!['requested','active'].includes(record?.state))throw Error('Request a plan before changing its delivery schedule.');
   const schedule=weeklySchedule(p.schedule);
   const location=await weeklyLocation(record.data.geometry);
   const zone=weeklyZone(location,p.schedule.zone||record.data.schedule?.zone);
   if(!zone)return opsJSON({...location,error:'Choose a valid delivery time zone.'},422);
   Object.assign(schedule,{zone,country:location.country,countryCode:location.countryCode});
   const result=await env.DB.prepare("UPDATE siege_records SET body_json=json_set(body_json,'$.data.schedule',json(?)) WHERE kind=? AND id=? AND state IN ('requested','active')").bind(JSON.stringify(schedule),WEEKLY_KIND,id).run();
   if(!result.meta?.changes)throw Error('The plan changed. Reload and try again.');
   return opsJSON({state:record.state,paidThrough:record.data.paidThrough,schedule,message:'Delivery schedule saved.'});
  }
  if(!['sample','request'].includes(p.action)||p.consent!==true)throw Error('Confirm that the recipient agrees to receive updates.');
  const area=usageGeometry(p.geometry);if(area.geometry.type!=='Polygon'||area.areaKm2>.10000001)throw Error('Use one field polygon of 10 hectares or less.');
  const email=opsEmail(p.email);
  if(p.action==='sample'){
   if(!weeklyReady(env))return opsJSON({error:'Sample emails are not configured yet.'},503);
   if(record?.data.sampleSent)throw Error('Your account has already used its free sample.');
   const lock='weekly-crop/samples/'+id;
   if(!await env.BUCKET.put(lock,'1',{onlyIf:{etagDoesNotMatch:'*'}}))throw Error('A sample has already been sent or is being prepared.');
   try{await weeklyDeliver(env,{id,data:{...area,email}},weeklyISO(Date.now()),true)}catch(e){await env.BUCKET.delete(lock);throw e}
   return opsJSON({state:record?.state||'none',paidThrough:record?.data.paidThrough,message:'Your free crop update was sent.'});
  }
  if(record?.state==='active')throw Error('Stop your current plan before requesting a different field.');
  const schedule=weeklySchedule(p.schedule);
  const location=await weeklyLocation(area.geometry);
  const zone=weeklyZone(location,p.schedule.zone);
  if(!zone)return opsJSON({...location,error:'Choose a valid delivery time zone, then submit again.'},422);
  Object.assign(schedule,{zone,country:location.country,countryCode:location.countryCode});
  const {profile,prices}=await loginPlanPricing(request,env,{monthly:{price:149}},'SZL');
  if(!prices)throw Error('Local pricing is temporarily unavailable. Try again later.');
  await opsRate(request,env);
  await opsStore(env,WEEKLY_KIND,{id,owner,state:'requested',createdAt:new Date().toISOString(),data:{...area,email,schedule,price:prices.monthly,currency:profile.currency,billingCountry:profile.code,sampleSent:!!record?.data.sampleSent}});
  return opsJSON({id,state:'requested',schedule,message:'Plan request saved. Reference: '+id+'. No payment was taken.'});
 }catch(e){return opsJSON({error:e.message||'Crop monitoring request failed.'},400)}
}
async function weeklyRun(env,now=Date.now(),cursor=''){
 if(!weeklyReady(env)||env.WEEKLY_CROP_ENABLED!=='true')return {status:'configuration_missing'};
 if(cursor&&!/^WEEKLY-[a-f0-9]{64}$/.test(cursor))throw Error('Invalid crop monitoring cursor.');
 const {results}=await env.DB.prepare("SELECT id,body_json FROM siege_records WHERE kind=? AND state='active' AND json_extract(body_json,'$.data.paidThrough')>? AND id>? ORDER BY id LIMIT 31").bind(WEEKLY_KIND,new Date(now).toISOString(),cursor).all();
 let sent=0,failed=0,needsTimeZone=0,last=cursor,visited=0,attempted=0;
 for(const row of results.slice(0,30)){
  const item=JSON.parse(row.body_json),schedule=item.data.schedule;
  if(!schedule?.zone){needsTimeZone++;last=row.id;visited++;continue;}
  const {monday,week,minute}=weeklyClock(now,schedule.zone);
  const [hour,min]=schedule.time.split(':').map(Number);
  const due=schedule.day*1440+hour*60+min;
  if(minute<due||(item.data.lastAttempt||'')>=week){last=row.id;visited++;continue;}
  if(attempted>=2)break;
  last=row.id;visited++;
  const day=weeklyISO(monday+schedule.day*weeklyDay);
  const lock='weekly-crop/runs/'+week+'/'+item.id;
  if(!await env.BUCKET.put(lock,'1',{onlyIf:{etagDoesNotMatch:'*'}}))continue;
  attempted++;
  let outcome;
  try{await weeklyDeliver(env,item,day,false);sent++;outcome='sent'}catch{failed++;outcome='failed'}
  await env.DB.prepare("UPDATE siege_records SET body_json=json_set(body_json,'$.data.lastAttempt',?,'$.data.lastDelivery',?) WHERE kind=? AND id=?").bind(day,outcome,WEEKLY_KIND,item.id).run();
 }
 const more=visited<results.length;
 return {status:'ok',sent,failed,needsTimeZone,more,cursor:more?last:null};
}
async function weeklyAdmin(request,env){
 if(!opsAdmin(request))return opsJSON({error:'Administrator access required.'},403);
 if(!env.DB)return opsJSON({error:'Storage unavailable.'},503);
 if(request.method==='GET'){
  const {results}=await env.DB.prepare("SELECT id,state,created_at,json_extract(body_json,'$.data.price') AS price,json_extract(body_json,'$.data.currency') AS currency FROM siege_records WHERE kind=? AND state IN ('requested','active') ORDER BY created_at DESC LIMIT 100").bind(WEEKLY_KIND).all();
  return opsJSON({plans:results,ready:weeklyReady(env)});
 }
 if(request.method!=='POST'||request.headers.get('Origin')!==new URL(request.url).origin)return opsJSON({error:'Request not allowed.'},403);
 try{
  const p=await opsBody(request);
  if(!/^WEEKLY-[0-9a-f]{64}$/.test(p.id)||p.confirmPayment!==true)throw Error('Confirm receipt of the quoted subscription amount before activation.');
  if(!weeklyReady(env)||env.WEEKLY_CROP_ENABLED!=='true')throw Error('Set up and verify the weekly email delivery first.');
  const now=new Date(),start=now.toISOString(),current=await weeklyRecord(env,p.id);
  if(!['requested','active'].includes(current?.state))throw Error('Plan is no longer available.');
  if(!current.data.schedule?.zone)throw Error('Ask the subscriber to save their delivery time zone first.');
  const until=new Date(Math.max(now.getTime(),Date.parse(current.data.paidThrough)||0));
  const date=until.getUTCDate();until.setUTCDate(1);until.setUTCMonth(until.getUTCMonth()+1);
  const next=new Date(until);next.setUTCMonth(next.getUTCMonth()+1);next.setUTCDate(0);
  until.setUTCDate(Math.min(date,next.getUTCDate()));
  const paidThrough=until.toISOString();
  const updated=await env.DB.prepare("UPDATE siege_records SET state='active',body_json=json_set(body_json,'$.state','active','$.data.paidThrough',?,'$.data.activatedAt',?) WHERE kind=? AND id=? AND state=? AND body_json=?").bind(paidThrough,start,WEEKLY_KIND,p.id,current.state,JSON.stringify(current)).run();
  if(!updated.meta?.changes)throw Error('Plan changed. Refresh before trying again.');
  return opsJSON({state:'active',paidThrough});
 }catch(e){return opsJSON({error:e.message},400)}
}
async function weeklyMCP(request,env){
 let msg;try{msg=await request.json()}catch{return opsJSON({error:'Invalid JSON'},400)}
 const send=result=>opsJSON({jsonrpc:'2.0',id:msg.id??null,result});
 if(msg.method==='server/discover')return send({supportedVersions:['2026-07-28'],capabilities:{tools:{}}});
 if(msg.method==='tools/list')return send({tools:[{name:'run_expert_availability_reminders',description:'Send availability confirmation emails to opted-in SIEG Experts whose 90-day reminders are due. dryRun checks readiness and counts due profiles without sending.',inputSchema:{type:'object',properties:{dryRun:{type:'boolean'},cursor:{type:'string'}},additionalProperties:false}},{name:'run_weekly_crop_monitoring',description:'Process SIEG crop emails due at subscriber-selected weekly times for activated subscribers. dryRun checks configuration without sending.',inputSchema:{type:'object',properties:{dryRun:{type:'boolean'},cursor:{type:'string',description:'Continue with the cursor from a result with more=true.'}},additionalProperties:false}}]});
 if(msg.method!=='tools/call'||!['run_weekly_crop_monitoring','run_expert_availability_reminders'].includes(msg.params?.name))return opsJSON({jsonrpc:'2.0',id:msg.id??null,error:{code:-32601,message:'Method not found'}});
 if(!opsAdmin(request))return send({isError:true,content:[{type:'text',text:'SIEG administrator access required.'}]});
 if(msg.params.name==='run_expert_availability_reminders'){const output=await expertReminderRun(env,new URL(request.url).origin,msg.params.arguments||{});return send({isError:output.status==='configuration_missing',content:[{type:'text',text:JSON.stringify(output)}]});}
 const output=msg.params.arguments?.dryRun?{ready:weeklyReady(env)}:await weeklyRun(env,Date.now(),msg.params.arguments?.cursor||'');
 return send({content:[{type:'text',text:JSON.stringify(output)}]});
}

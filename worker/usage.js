function usageAnalysisYear(service,value,now=new Date()){return service==='irrigation'?now.getUTCFullYear():Number(value);}
const ANALYSIS_CACHE_EPOCH='20261120-reset-1';
// One source resolver keeps browser navigation and server authorisation in sync.
const MERIT_BASIN_ASSETS={"1":"projects/ee-gee023/assets/cat_pfaf_1_MERIT_Hydro_v07_Basins_v01","2":"projects/ee-gee023/assets/cat_pfaf_2_MERIT_Hydro_v07_Basins_v01","3":"projects/ee-gee023/assets/cat_pfaf_3_MERIT_Hydro_v07_Basins_v01","4":"projects/ee-gee023/assets/cat_pfaf_4_MERIT_Hydro_v07_Basins_v01","5":"projects/ee-gee023/assets/cat_pfaf_5_MERIT_Hydro_v07_Basins_v01","6":"projects/ee-gee023/assets/cat_pfaf_6_MERIT_Hydro_v07_Basins_v01","7":"projects/ee-gee023/assets/cat_pfaf_7_MERIT_Hydro_v07_Basins_v01","8":"projects/ee-gee023/assets/cat_pfaf_8_MERIT_Hydro_v07_Basins_v01","9":"projects/ee-gee023/assets/cat_pfaf_9_MERIT_Hydro_v07_Basins_v01"};
function hydroBasinAssets(env={}){
 let values=MERIT_BASIN_ASSETS;
 if(env.GEE_MERIT_BASINS_ASSETS){try{values=JSON.parse(env.GEE_MERIT_BASINS_ASSETS)}catch{return {}}}
 else if(env.GEE_MERIT_BASINS_ASSET){const asset=env.GEE_MERIT_BASINS_ASSET.trim();values={[asset.match(/cat_pfaf_([1-9])_/)?.[1]||'1']:asset};}
 if(!values||typeof values!=='object'||Array.isArray(values))return {};
 const entries=Object.entries(values);if(!entries.length||entries.some(([code,asset])=>!/^[1-9]$/.test(code)||typeof asset!=='string'||!/^projects\/[A-Za-z0-9_-]+\/assets\/[A-Za-z0-9_\/-]+$/.test(asset)))return {};
 return {...values};
}
function hydroBasinAsset(env={}){return hydroBasinAssets(env)['1']||null;}

// Durable, owner-scoped AOI authorisation and bounded, deduplicated processing.
const USAGE_LIMITS={irrigation:.5,fields:.5,eco:5,hydrology:5};
const HYDRO_LIMITS={preview:5,standard:5,wetlands:5};
async function usageAdminMode(request,env){
 if(!reportAdmin(request))return {admin:false,mode:'restricted'};
 const id='ADMIN-MODE:'+await reportSHA(reportOwner(request));
 const row=await env.DB.prepare("SELECT state FROM siege_records WHERE id=? AND kind='analysis_admin_mode' AND owner=?").bind(id,reportOwner(request)).first();
 return {admin:true,mode:row?.state==='restricted'?'restricted':'unrestricted'};
}
async function usageIsUnrestricted(request,env){return (await usageAdminMode(request,env)).mode==='unrestricted'}
const ADMIN_HYDRO_TOOLS=['catchment-delineation','wetland-mapping'];
function usageToolAdmin(request,j){return !!(reportAdmin(request)&&j?.adminTool&&j.owner===reportOwner(request)&&ADMIN_HYDRO_TOOLS.includes(j.task));}
function usageLimit(j){return j.service==='hydrology'?(j.task==='wetland-mapping'?Math.min(HYDRO_LIMITS[j.mode]||1,25):HYDRO_LIMITS[j.mode]||1):USAGE_LIMITS[j.service]}
function usageHydroCheck(j,type=''){if(j.service!=='hydrology')return;const area=usageGeometry(j.geometry).areaKm2;const limit=type==='wetland-mapping'?Math.min(usageLimit(j),25):usageLimit(j);if(area>limit+1e-6)throw Error('This '+area.toFixed(2)+' km² area exceeds the '+limit+' km² processing limit. Keep the complete catchment and request staff review.');}
const usageJSON=(d,s=200)=>Response.json(d,{status:s,headers:{'Cache-Control':'no-store'}});
async function usageJob(env,id){if(!/^ANALYSIS-[a-f0-9-]{36}$/.test(id||''))return null;const r=await env.DB.prepare("SELECT body_json FROM siege_records WHERE id=? AND kind='analysis'").bind(id).first();if(!r)return null;const j=JSON.parse(r.body_json);if(j.service==='eco'&&!j.freeTrial&&!j.freeClassification){const extra=await env.DB.prepare("SELECT body_json FROM siege_records WHERE id=? AND kind='analysis_extra' AND owner=?").bind('ECO-EXTRA:'+j.id,j.owner).first();if(extra){const d=JSON.parse(extra.body_json);j.reportItems=ecoReportItems([...d.baseItems,...(d.task?[d.task]:[])],j.task);j.extraServiceDecided=true;j.extraService=d.task;}}return j}
async function usageSave(env,j){await env.DB.prepare("UPDATE siege_records SET state=?,body_json=? WHERE id=? AND kind='analysis'").bind(j.state,JSON.stringify(j),j.id).run()}
function usagePublic(j,adminUnrestricted=false){return {adminUnrestricted,adminAnalysis:!!j.adminBypass,id:j.id,service:j.service,state:j.state,areaKm2:j.areaKm2,limitKm2:j.freeTrial?0.05:usageLimit(j),mode:j.mode,task:j.task,reportItems:j.reportItems||(j.service==='hydrology'?[j.task]:undefined),indicatorSelections:j.indicatorSelections,freeTrial:!!j.freeTrial,freeMapLimit:j.freeTrial?3:undefined,freeMapCount:j.freeMapHashes?.length||0,freeSuitability:!!j.freeSuitability,freeClassification:!!j.freeClassification,freeRestoration:!!j.freeRestoration,extraServiceDecided:!!j.extraServiceDecided,extraService:j.extraService,year:j.year,displayContext:j.displayContext,paymentVerified:!!j.paymentVerified,paymentOrder:j.paymentOrder,deliveryContact:j.paymentVerified?j.deliveryContact:undefined,amount:j.amount,currency:j.currency,method:j.method,createdAt:j.createdAt,policyVersion:j.policyVersion||1,expires:j.expires,geometry:j.geometry,hasSnapshot:!!j.hasSnapshot}}
function usageGeometry(g,unrestricted=false){
 if(g?.type==='Feature')g=g.geometry;
 if(!['Polygon','MultiPolygon'].includes(g?.type))throw Error('Finish a polygon or select one complete basin / Admin 2 boundary.');
 const polys=g.type==='Polygon'?[g.coordinates]:g.coordinates;if(!Array.isArray(polys)||!polys.length||(!unrestricted&&polys.length>100))throw Error('Invalid AOI.');let vertices=0,area=0;
 for(const rings of polys){if(!Array.isArray(rings)||!rings.length)throw Error('Invalid AOI rings.');let outer=0;
 for(let ri=0;ri<rings.length;ri++){const ring=rings[ri];if(!Array.isArray(ring)||ring.length<4)throw Error('Close every AOI ring.');vertices+=ring.length;if(vertices>10000&&!unrestricted)throw Error('Simplify this boundary to at most 10,000 vertices.');let sum=0;for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];if(!Array.isArray(a)||a.length!==2||!a.every(Number.isFinite)||Math.abs(a[0])>180||Math.abs(a[1])>(unrestricted?90:85))throw Error('Use valid WGS84 longitude / latitude coordinates.');if(Math.abs(a[0]-b[0])>180)throw Error('Antimeridian-crossing polygons are not supported.');sum+=(b[0]-a[0])*Math.PI/180*(2+Math.sin(a[1]*Math.PI/180)+Math.sin(b[1]*Math.PI/180));}if(ring[0][0]!==ring.at(-1)[0]||ring[0][1]!==ring.at(-1)[1])throw Error('AOI rings must be closed.');const size=Math.abs(sum*6371.0088**2/2);if(ri===0)outer=size;else outer-=size;}
 if(outer<=0)throw Error('Invalid AOI area.');area+=outer;}
 if(!Number.isFinite(area)||area<(unrestricted?1e-12:0.00001)||(!unrestricted&&area>50000))throw Error('AOI must be between 10 m² and 50,000 km². Contact SIEG for larger projects.');
 return {geometry:{type:g.type,coordinates:g.coordinates},areaKm2:area};
}

// Kept for legacy report callbacks; analysis access no longer depends on payment.
async function usageGrantForReport(env,order){if(order?.analysisPurchaseId)await hydroGrant(env,order);return;}

async function usageResetAnalysisCaches(request,env){
  if(request.method!=='POST')return usageJSON({error:'Method not allowed.'},405);
  const b=await request.json();if(b.resetId!==ANALYSIS_CACHE_EPOCH)throw Error('Unknown cache reset.');
  const prefixes=['analysis/cache/','analysis/navigation/','analysis/resources/','analysis/snapshots/'];let index=Number(b.prefixIndex||0),cursor=typeof b.cursor==='string'?b.cursor:undefined,deleted=0;
  if(!Number.isInteger(index)||index<0||index>=prefixes.length)throw Error('Invalid cache reset continuation.');
  for(let page=0;page<3&&index<prefixes.length;page++){
   const prefix=prefixes[index],listed=await env.BUCKET.list({prefix,limit:100,...(cursor?{cursor}:{})}),keys=listed.objects.map(item=>item.key).filter(key=>!key.startsWith(prefix+ANALYSIS_CACHE_EPOCH+'/'));
   for(let n=0;n<keys.length;n+=25)await Promise.all(keys.slice(n,n+25).map(key=>env.BUCKET.delete(key)));deleted+=keys.length;
   if(listed.truncated){cursor=listed.cursor;}else{index++;cursor=undefined;}
  }
  const complete=index>=prefixes.length;if(complete){await env.DB.prepare("UPDATE siege_records SET body_json=json_set(body_json,'$.hasSnapshot',json('false')) WHERE kind='analysis' AND coalesce(json_extract(body_json,'$.snapshotEpoch'),'')<>?").bind(ANALYSIS_CACHE_EPOCH).run();await env.BUCKET.put('analysis/cache-resets/'+ANALYSIS_CACHE_EPOCH+'.json',JSON.stringify({completedAt:new Date().toISOString()}));}
  return usageJSON({resetId:ANALYSIS_CACHE_EPOCH,deleted,complete,...(!complete?{prefixIndex:index,cursor:cursor||null}:{})});
}

async function usageAPI(request,env){const u=new URL(request.url),path=u.pathname,owner=reportOwner(request);try{
 if(!env.DB||!env.BUCKET)return usageJSON({error:'Analysis storage is unavailable.'},503);
 if(path==='/api/analysis/notify')return usageJSON({error:'Use the verified report-payment callback for prepaid analysis.'},410);
 if(path==='/api/analysis/dashboard')return await usageDashboardAPI(request,env);
 // This fixed, one-time maintenance operation uses the owner-private Sites platform
 // access boundary for service callers; it never grants access to user records.
 if(path==='/api/analysis/cache-reset-service'){
  if(request.method!=='POST')return usageJSON({error:'Method not allowed.'},405);
  if(request.headers.get('Origin')!==u.origin)return usageJSON({error:'Origin not allowed'},403);
  if(owner&&!(await usageAdminMode(request,env)).admin)return usageJSON({error:'Administrator access required.'},403);
  return usageResetAnalysisCaches(request,env);
 }
 if(!owner)return usageJSON({error:'Sign in to SIEG first.'},401);
 if(request.method==='POST'&&request.headers.get('Origin')!==u.origin)return usageJSON({error:'Origin not allowed'},403);
 const adminMode=await usageAdminMode(request,env),adminUnrestricted=adminMode.mode==='unrestricted';
 if(path==='/api/analysis/admin-tool'){
  if(!adminMode.admin)return usageJSON({error:'Administrator access required.'},403);
  if(request.method!=='POST')return usageJSON({error:'Method not allowed.'},405);
  const b=await request.json();if(!ADMIN_HYDRO_TOOLS.includes(b.task))return usageJSON({error:'Unknown Toolbox tool.'},400);
  const g=usageGeometry(b.geometry,true),year=Number(b.year||new Date().getUTCFullYear());
  if(!Number.isInteger(year)||year<2013||year>new Date().getUTCFullYear())throw Error('Choose a supported analysis year.');
  const j={id:'ANALYSIS-'+crypto.randomUUID(),owner,service:'hydrology',task:b.task,mode:'standard',year,...g,adminTool:true,adminBypass:true,method:'admin',amount:0,currency:'USD',state:'running',createdAt:new Date().toISOString(),expires:null,requestCount:0};
  await env.DB.prepare("INSERT INTO siege_records(id,kind,owner,state,created_at,body_json) VALUES(?,'analysis',?,?,?,?)").bind(j.id,owner,j.state,j.createdAt,JSON.stringify(j)).run();return usageJSON({...usagePublic(j,true),adminTool:true});
 }
 if(path==='/api/analysis/admin-mode'){if(!adminMode.admin)return usageJSON({error:'Administrator access required.'},403);if(request.method==='GET')return usageJSON(adminMode);if(request.method!=='POST')return usageJSON({error:'Method not allowed.'},405);const b=await request.json();if(!['restricted','unrestricted'].includes(b.mode))throw Error('Choose a valid admin mode.');const id='ADMIN-MODE:'+await reportSHA(owner);await env.DB.prepare("INSERT INTO siege_records(id,kind,owner,state,created_at,body_json) VALUES(?,'analysis_admin_mode',?,?,?,'{}') ON CONFLICT(id) DO UPDATE SET state=excluded.state,created_at=excluded.created_at").bind(id,owner,b.mode,new Date().toISOString()).run();return usageJSON({admin:true,mode:b.mode});}
 if(path==='/api/analysis/cache-reset'){if(!adminMode.admin)return usageJSON({error:'Administrator access required.'},403);return usageResetAnalysisCaches(request,env);}
 if(path==='/api/analysis/config')return usageJSON({policyVersion:3,sessionsUnlimited:true,freeTrial:{maps:3,areaKm2:.05,oncePerService:false,oneServicePerAccount:true},limits:USAGE_LIMITS,hydrologyLimits:HYDRO_LIMITS,paymentFirstServices:PREPAID_SERVICES,hydrologyPayment:'required-before-processing',cardEnabled:reportCardReady(env),prices:Object.fromEntries(Object.keys(USAGE_LIMITS).map(s=>[s,reportFee(env,s)])),currency:env.PAYGATE_CURRENCY||'USD',admin:adminMode.admin,adminEmail:adminMode.admin?request.headers.get('oai-authenticated-user-email'):undefined,adminMode:adminMode.mode,adminUnrestricted});
 if(path==='/api/analysis/test-history'){
  if(!adminMode.admin)return usageJSON({error:'Administrator access required.'},403);
  if(request.method!=='POST')return usageJSON({error:'Method not allowed.'},405);
  const action=(await request.json()).action;if(!['clear','restore'].includes(action))return usageJSON({error:'Choose clear or restore.'},400);
  const archived=action==='clear'?1:0;
  const result=await env.DB.prepare("UPDATE siege_records SET body_json=json_set(body_json,'$.historyArchived',?) WHERE kind='analysis' AND owner=? AND coalesce(json_extract(body_json,'$.adminBypass'),0)=1 AND coalesce(json_extract(body_json,'$.paymentVerified'),0)=0 AND json_extract(body_json,'$.paymentOrder') IS NULL AND coalesce(json_extract(body_json,'$.historyArchived'),0)!=?").bind(archived,owner,archived).run();
  return usageJSON({action,changed:result.meta?.changes||0});
 }
 if(path==='/api/analysis/jobs'&&request.method==='GET'){const rows=await env.DB.prepare("SELECT body_json FROM siege_records WHERE kind='analysis' AND owner=? AND coalesce(json_extract(body_json,'$.historyArchived'),0)=0 AND state!='admin_deleted' ORDER BY created_at DESC LIMIT 30").bind(owner).all();return usageJSON({jobs:rows.results.map(r=>usagePublic(JSON.parse(r.body_json),adminUnrestricted))})}
 if(path==='/api/analysis/admin'&&!reportAdmin(request))return usageJSON({error:'Administrator access required.'},403);
 if(path==='/api/analysis/admin'&&reportAdmin(request)){
 if(request.method==='GET'){const rows=await env.DB.prepare("SELECT body_json FROM siege_records WHERE kind='analysis' ORDER BY created_at DESC LIMIT 100").all();return usageJSON({jobs:rows.results.map(r=>usagePublic(JSON.parse(r.body_json)))})}
 if(request.method!=='POST')return usageJSON({error:'Method not allowed.'},405);
 const b=await request.json(),j=await usageJob(env,b.id);if(!j)return usageJSON({error:'Unknown request'},404);const previous=j.state;
 if(b.action==='restore'){
  if(j.state!=='admin_deleted'||!['awaiting_approval','queued'].includes(j.deletedFrom))return usageJSON({error:'Only deleted approval requests can be restored.'},409);
  j.state=j.deletedFrom;delete j.deletedFrom;delete j.deletedAt;delete j.deletedBy;
 }else{
  if(!['awaiting_approval','queued'].includes(j.state))return usageJSON({error:'Only pending approval requests can be changed.'},409);
  if(b.action==='delete'){
   if(j.paymentVerified||j.paymentOrder)return usageJSON({error:'Paid requests must be handled through the payment review workflow.'},409);
   j.deletedFrom=j.state;j.state='admin_deleted';j.deletedAt=new Date().toISOString();j.deletedBy=owner;
  }else if(b.action==='approve'){
   if(!b.confirmCostReview)throw Error('Confirm the AOI and processing-cost review first.');j.state=prepaid(j.service)?'awaiting_payment':'authorised';j.approvedBy=owner;j.approvedAt=new Date().toISOString();j.largeAreaApproved=j.areaKm2>usageLimit(j);
  }else return usageJSON({error:'Unknown action'},400);
 }
 const saved=await env.DB.prepare("UPDATE siege_records SET state=?,body_json=? WHERE id=? AND kind='analysis' AND state=? RETURNING id").bind(j.state,JSON.stringify(j),j.id,previous).first();if(!saved)return usageJSON({error:'This request changed. Refresh before trying again.'},409);return usageJSON(usagePublic(j));}

 const text=request.method==='POST'?await request.text():'';if(text.length>(adminUnrestricted?8*1024*1024:700000))return usageJSON({error:'Request too large'},413);const b=text?JSON.parse(text):{};
 if(['/api/analysis/free-trial','/api/analysis/free-suitability','/api/analysis/free-classification','/api/analysis/free-restoration'].includes(path)&&request.method==='POST'){
 const legacy={'/api/analysis/free-suitability':['fields','suitability'],'/api/analysis/free-classification':['eco','land-classification'],'/api/analysis/free-restoration':['hydrology','catchment-assessment']}[path];
 if(ADMIN_HYDRO_TOOLS.includes(b.task))return usageJSON({error:'This tool is available only in the admin Toolbox.'},403);
 const service=legacy?.[0]||b.service;if(!USAGE_LIMITS[service])throw Error('Choose a supported free-trial service.');const g=usageGeometry(b.geometry);if(g.areaKm2>0.05+1e-9)throw Error('Free usage is limited to 5 ha (50,000 m²). Reduce your boundary or choose paid analysis.');
 await usagePilotCheck(env,{owner,service});
 const year=usageAnalysisYear(service,b.year||new Date().getUTCFullYear());if(!Number.isInteger(year)||year<(service==='eco'?2019:service==='fields'?2017:1981)||year>new Date().getUTCFullYear())throw Error('Choose a supported analysis year.');
 const claim='FREE-TRIAL:'+service+':'+await reportSHA(owner),candidate='ANALYSIS-'+crypto.randomUUID();
 await env.DB.prepare("INSERT OR IGNORE INTO siege_records(id,kind,owner,state,created_at,body_json) VALUES(?,'free_trial',?,'claimed',?,?)").bind(claim,owner,new Date().toISOString(),JSON.stringify({id:candidate,geometry:g.geometry,year})).run();
 const winning=await env.DB.prepare("SELECT body_json FROM siege_records WHERE id=? AND kind='free_trial'").bind(claim).first(),bound=JSON.parse(winning.body_json);
 if(JSON.stringify(bound.geometry)!==JSON.stringify(g.geometry)||bound.year!==year)throw Error('Your one-time free usage for this service is assigned to its original 5 ha area and year. Choose paid analysis for another area.');
 let trial=await usageJob(env,bound.id);if(!trial){trial={id:bound.id,owner,service,task:commerceTask(service,legacy?.[1]||b.task),mode:'standard',year,...g,freeTrial:true,freeMapHashes:[],state:'authorised',expires:null,amount:0,currency:'USD',requestCount:0,createdAt:new Date().toISOString()};await env.DB.prepare("INSERT OR IGNORE INTO siege_records(id,kind,owner,state,created_at,body_json) VALUES(?,'analysis',?,?,?,?)").bind(trial.id,owner,trial.state,trial.createdAt,JSON.stringify(trial)).run();trial=await usageJob(env,trial.id);}return usageJSON(usagePublic(trial));
 }
 if(path==='/api/analysis/orders'&&request.method==='POST'){
 if(ADMIN_HYDRO_TOOLS.includes(b.task))return usageJSON({error:'Use the admin Toolbox for this tool.'},403);
 if(!USAGE_LIMITS[b.service])throw Error('Choose a valid service.');if(b.service==='hydrology'&&b.reportItems!==undefined)hydroSingleReportItem(b.reportItems,commerceTask('hydrology',b.task));const g=usageGeometry(b.geometry,adminUnrestricted);if(!adminUnrestricted&&g.areaKm2>USAGE_LIMITS[b.service]+1e-6)throw Error('The maximum boundary area for this service is '+(USAGE_LIMITS[b.service]*100).toLocaleString('en-US')+' ha ('+USAGE_LIMITS[b.service]+' km²).');if(!/^[a-f0-9-]{36}$/.test(b.requestId||''))throw Error('Invalid request reference.');const mode=b.service==='hydrology'?(b.mode==='standard'?'standard':'preview'):'standard',task=prepaid(b.service)?commerceTask(b.service,b.task):'general';const year=prepaid(b.service)?usageAnalysisYear(b.service,b.year):null;if(prepaid(b.service)&&(!Number.isInteger(year)||year<(b.service==='eco'?2019:b.service==='fields'?2017:1981)||year>new Date().getUTCFullYear()))throw Error('Choose one supported analysis year.');if(b.service==='fields'&&['weather','warning'].includes(task)&&year!==new Date().getUTCFullYear())throw Error('Weather forecasts and early warnings use the current year.');const reportItems=b.service==='fields'?fieldsReportItems(b.reportItems,task):b.service==='eco'?ecoReportItems(b.reportItems,task):b.service==='hydrology'?hydroSingleReportItem(b.reportItems,task):undefined;const identity=prepaid(b.service)?b.service+'-v6:'+mode+':'+task+':'+year+':'+(reportItems?.join(',')||'')+':'+JSON.stringify(g.geometry):b.requestId;const id='ANALYSIS-'+await reportSHA(owner+':'+(adminUnrestricted?'admin-unrestricted:':'')+identity).then(h=>h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20,32));let j=await usageJob(env,id);
 if(!j){const large=!adminUnrestricted&&g.areaKm2>usageLimit({service:b.service,mode,task});j={id,owner,adminBypass:adminUnrestricted,service:b.service,...(prepaid(b.service)?{mode,task,reportItems,indicatorSelections:analysisIndicatorChoices(b.indicatorSelections),year,displayContext:{countryCode:/^[A-Z]{2,3}$/.test(b.context?.countryCode||'')?b.context.countryCode:'',countryName:String(b.context?.countryName||'').slice(0,80)}}:{}),method:adminUnrestricted?'admin':prepaid(b.service)?'card':'report_later',policyVersion:prepaid(b.service)?6:3,...g,amount:adminUnrestricted?0:reportFee(env,prepaid(b.service)?commerceProduct({service:b.service,task}).service:b.service),currency:env.PAYGATE_CURRENCY||'USD',state:adminUnrestricted?'authorised':large?'queued':prepaid(b.service)?'awaiting_payment':'authorised',createdAt:new Date().toISOString(),requestCount:0};

 await env.DB.prepare("INSERT OR IGNORE INTO siege_records(id,kind,owner,state,created_at,body_json) VALUES(?,'analysis',?,?,?,?)").bind(id,owner,j.state,j.createdAt,JSON.stringify(j)).run();j=await usageJob(env,id);}
 return usageJSON(usagePublic(j,adminUnrestricted));}
 const j=await usageJob(env,b.id||u.searchParams.get('id'));if(!j||j.owner!==owner)return usageJSON({error:'Analysis request not found'},404);
 // Previously queued districts/basins may now run within the supported geometry range.
 // Oversized requests remain queued until staff review; approval never replaces payment.
 if(j.adminBypass&&!adminUnrestricted&&path!=='/api/analysis/snapshot')return usageJSON({error:'This is an unrestricted admin analysis. Switch to Admin—no restrictions or create a user-restricted request.'},403);
 if(path==='/api/analysis/status'){if(prepaid(j.service)&&j.paymentOrder){const o=await reportRead(env,reportKey(j.paymentOrder));if(o?.state==='paid')await hydroGrant(env,o);const current=await usageJob(env,j.id);return usageJSON(usagePublic(current,adminUnrestricted));}return usageJSON(usagePublic(j,adminUnrestricted));}
 if(path==='/api/analysis/extra-service'&&request.method==='POST'){
 if(j.service!=='eco'||j.freeTrial||j.freeClassification)throw Error('This option is for a paid Eco report.');
 const order=await hydroRequirePaid(env,j);if(order.filesReady)throw Error('This report is already finalized.');
 const task=b.task||null;if(task&&(!ECO_TASKS[task]||(j.reportItems||[j.task]).includes(task)))throw Error('Choose one service not already in the report.');
 if(j.extraServiceDecided)throw Error('Your extra-service choice is already confirmed.');
 const key='ECO-EXTRA:'+j.id,data={task,baseItems:j.reportItems||[j.task]};
 await env.DB.prepare("INSERT OR IGNORE INTO siege_records(id,kind,owner,state,created_at,body_json) VALUES(?,'analysis_extra',?,'confirmed',?,?)").bind(key,owner,new Date().toISOString(),JSON.stringify(data)).run();
 const current=await usageJob(env,j.id);if(current.extraService!==task)throw Error('An extra-service choice has already been confirmed.');return usageJSON(usagePublic(current,adminUnrestricted));
 }
 if(path==='/api/analysis/reserve-map'&&request.method==='POST'){if(!j.freeTrial||j.service!=='irrigation'||b.map!=='irrigation-layout')throw Error('Unsupported map reservation.');if(j.state!=='running')throw Error('Start your trial first.');if(!/^[a-f0-9]{64}$/.test(b.signature||''))throw Error('Invalid design signature.');await usageTrialMap(env,j,'local:'+b.signature);return usageJSON(usagePublic(await usageJob(env,j.id)));}
 if(path==='/api/analysis/start'&&request.method==='POST'){
 if((j.freeSuitability||j.freeClassification||j.freeRestoration)&&Date.now()>j.expires)throw Error('Your free view has expired.');
 if(prepaid(j.service)&&!adminUnrestricted&&!j.freeTrial&&!j.freeSuitability&&!j.freeClassification&&!j.freeRestoration){await hydroRequirePaid(env,j);try{commerceCheck(j)}catch(e){j.state='queued';await usageSave(env,j);return usageJSON({error:e.message},409)}}
 if(adminUnrestricted&&j.state==='queued')j.state='authorised';
 if(!['authorised','running'].includes(j.state))return usageJSON({error:'This area is awaiting review. Choose a smaller area or reopen an approved analysis.'},409);
 if(j.freeTrial){await env.DB.prepare("UPDATE siege_records SET state='running',body_json=json_set(body_json,'$.state','running') WHERE id=?").bind(j.id).run();return usageJSON(usagePublic(await usageJob(env,j.id),adminUnrestricted));}
 j.state='running';j.policyVersion=prepaid(j.service)?6:3;if(!j.freeTrial&&!j.freeSuitability&&!j.freeClassification&&!j.freeRestoration)j.expires=null;await usageSave(env,j);return usageJSON(usagePublic(j,adminUnrestricted));}
 if(path==='/api/analysis/snapshot'){
 if(request.method==='GET'){const r=await env.BUCKET.get('analysis/snapshots/'+ANALYSIS_CACHE_EPOCH+'/'+j.id);if(!r)return usageJSON({error:'No saved results yet'},404);return new Response(r.body,{headers:{'Content-Type':'application/json','Cache-Control':'no-store','Content-Disposition':'attachment; filename="'+j.id+'-results.json"'}})}
 if(request.method==='POST'){if(j.freeTrial)throw Error('Downloads and saved report summaries require paid analysis.');if(prepaid(j.service)&&!adminUnrestricted)await hydroRequirePaid(env,j);if(j.state!=='running')throw Error('This analysis is not active.');if(typeof b.text!=='string'||b.text.length>150000)throw Error('Results are too large.');await env.BUCKET.put('analysis/snapshots/'+ANALYSIS_CACHE_EPOCH+'/'+j.id,JSON.stringify({service:j.service,geometry:j.geometry,areaKm2:j.areaKm2,text:b.text,createdAt:new Date().toISOString(),note:'Saved interface summary. Consult the full report for sources and limitations.'}));j.hasSnapshot=true;await env.DB.prepare("UPDATE siege_records SET body_json=json_set(body_json,'$.hasSnapshot',json('true'),'$.snapshotEpoch',?) WHERE id=?").bind(ANALYSIS_CACHE_EPOCH,j.id).run();return usageJSON({saved:true})}}
 return usageJSON({error:'Not found'},404);
 }catch(e){return usageJSON({error:e.message||'Analysis authorisation failed'},400)}}
// Only bounded vector lookup expressions may run before a purchase.
function usageNavigation(body,env={}){const text=JSON.stringify(body);if(text.length>350000)return false;let valid=true,count=0;const assets=[];function walk(n){if(!n||typeof n!=='object')return;const f=n.functionInvocationValue;if(f){count++;if(!/^(?:Collection|Collection\.(?:loadTable|filter|map|geometry|limit|aggregate_array|first|size|merge|select|sort)|FeatureCollection|Feature|Feature\.(?:get|geometry|toDictionary|select)|Filter\.(?:.*)|Geometry(?:Constructors)?\.(?:.*)|ErrorMargin|List\.(?:distinct|sort|map)|Dictionary|String|Number|Date|Element\.get|AggregateFeatureCollection\.(?:array|count)|ObjectType|If)$/.test(f.functionName))valid=false;if(f.functionName==='Collection.loadTable')assets.push(f.arguments?.tableId?.constantValue);}for(const v of Object.values(n))if(v&&typeof v==='object')walk(v)}walk(body);return valid&&count<500&&assets.length>0&&assets.every(a=>typeof a==='string'&&(Object.values(hydroBasinAssets(env)).includes(a)||/FAO\/GAUL|WM\/geoLab\/geoBoundaries|WWF\/HydroSHEDS|projects\/ee-gee023\/assets\/(?:globalADM2|Eswatini_Admin1|Eswatini_Villages|Villages_New)/.test(a)));}
async function usagePermit(request,env,body,tail){
 const u=new URL(request.url),id=u.searchParams.get('analysis');
 // Boundary navigation is independent of any previously analysed AOI.
 if(tail==='value:compute'&&usageNavigation(body,env))return {navigation:true};
 if(!id)throw Error('Choose an analysis area before processing.');
 const j=await usageJob(env,id);if(!j||j.owner!==reportOwner(request)||j.state!=='running')throw Error('Analysis authorisation is required.');
 const adminUnrestricted=usageToolAdmin(request,j)||await usageIsUnrestricted(request,env);if(ADMIN_HYDRO_TOOLS.includes(j.task)&&!usageToolAdmin(request,j))throw Error('Administrator Toolbox access required.');if(j.adminBypass&&!adminUnrestricted)throw Error('Switch to Admin—no restrictions to reopen this analysis.');if(!adminUnrestricted){if(j.freeTrial){await usagePilotCheck(env,j);if(j.areaKm2>0.05+1e-9)throw Error('Free usage is limited to 5 ha.');if(!['maps','value:compute'].includes(tail))throw Error('Free usage includes map viewing only; downloads require paid analysis.');}else if(j.freeSuitability||j.freeClassification||j.freeRestoration){if(Date.now()>j.expires||j.requestCount>=60)throw Error('Your free view has expired.');if(j.freeRestoration)usageFreeRestorationExpression(body,tail,env);else if(j.freeClassification)usageFreeClassificationExpression(body,tail);else usageFreeSuitabilityExpression(body,tail);}else if(prepaid(j.service))await hydroRequirePaid(env,j);commerceCheck(j);usageHydroCheck(j,u.searchParams.get('analysisType'));}
 const trialMapHash=j.freeTrial&&tail==='maps'&&!usageContextMap(body)?await reportSHA(JSON.stringify(body)):null;if(j.freeTrial){if(tail!=='maps'&&j.requestCount>=60)throw Error('Free processing allowance reached. Your three generated maps remain viewable.');}
 // Reuse cached computations; analysis records have no session expiry.
 const hash=await reportSHA(JSON.stringify([...(adminUnrestricted?['admin-unrestricted']:[]),j.id,tail,body])),key='analysis/cache/'+ANALYSIS_CACHE_EPOCH+'/'+hash;
 let retry=false;const cached=await env.BUCKET.get(key);if(cached){const saved=JSON.parse(await cached.text());const stalePending=saved.pending&&(!saved.createdAt||Date.now()-saved.createdAt>10*60*1000);const staleResource=['maps','thumbnails','tables'].includes(tail)&&(!saved.createdAt||Date.now()-saved.createdAt>60*60*1000);if(saved.failed||stalePending||staleResource||(!saved.pending&&(saved.status<200||saved.status>=300))){retry=Boolean(saved.failed||stalePending);if(!adminUnrestricted&&await usagePaused(env))return {paused:true,job:j};await env.BUCKET.delete(key);}else return {cached:saved,job:j};}

 if(!adminUnrestricted&&await usagePaused(env))return {paused:true,job:j};

 if(!adminUnrestricted){
 // Bind all raster reductions and rendered maps to the selected geometry.
 const expr=body.expression;if(!expr?.values)throw Error('Unsupported analysis expression.');const values=expr.values;
 const geometry={functionInvocationValue:{functionName:j.geometry.type==='Polygon'?'GeometryConstructors.Polygon':'GeometryConstructors.MultiPolygon',arguments:{coordinates:{constantValue:j.geometry.coordinates},geodesic:{constantValue:false}}}};
 // Preserve the supplied dashboard's coarse-grid fallback, but derive its point
 // from the authorised AOI rather than trusting a client-supplied centroid.
 function reductionGeometry(value){let node=value;for(let i=0;i<8&&node?.valueReference;i++)node=values[node.valueReference];if(node?.functionInvocationValue?.functionName==='Geometry.centroid')return {functionInvocationValue:{functionName:'Geometry.centroid',arguments:{geometry,maxError:{functionInvocationValue:{functionName:'ErrorMargin',arguments:{value:{constantValue:100},unit:{constantValue:'meters'}}}}}}};return geometry;}
 function walk(n){if(!n||typeof n!=='object')return;const f=n.functionInvocationValue;if(f){const name=f.functionName,args=f.arguments||{};if(['Image.reduceRegion','Image.reduceRegions','Image.sample','Image.sampleRegions','Image.stratifiedSample','Image.reduceToVectors'].includes(name)){if(name==='Image.reduceToVectors'&&j.service==='hydrology'){if(j.task!=='wetland-mapping')throw Error('Purchase the wetland shapefile service before vectorisation.');usageHydroCheck(j,'wetland-mapping');args.geometry=geometry;args.maxPixels={constantValue:1000000};if(!args.scale?.constantValue||Number(args.scale.constantValue)<30)throw Error('Wetland shapefiles require a grid of at least 30 m.');}else if(['Image.reduceRegions','Image.sampleRegions','Image.reduceToVectors'].includes(name))throw Error('This processing operation requires staff review.');if(name==='Image.reduceRegion'){args.geometry=reductionGeometry(args.geometry);args.maxPixels={constantValue:10000000};args.bestEffort={constantValue:true};}else if(name!=='Image.reduceToVectors'){args.region=geometry;if(name==='Image.stratifiedSample')args.numPoints={constantValue:5000};else args.numPixels={constantValue:5000};}if(args.scale?.constantValue!==undefined&&Number(args.scale.constantValue)<10)throw Error('Minimum statistics scale is 10 m.');}if(name==='Image.sampleRectangle'&&j.service==='hydrology'){if(j.task!=='catchment-delineation')throw Error('Use the bounded catchment delineation task.');args.region=geometry;}if(name==='Image.clip')args.geometry=geometry;if(/export/i.test(name))throw Error('This processing operation requires staff review.');}for(const v of Object.values(n))if(v&&typeof v==='object')walk(v)}
 // Walk first, then inject a fresh root clip (no recursion into injected constants).
 walk(expr);
 if(['maps','thumbnails'].includes(tail)){const result=expr.result,root=values[result];if(!root)throw Error('Invalid map expression.');const source='siegeSource';values[source]=root;values[result]={functionInvocationValue:{functionName:'Image.clip',arguments:{input:{valueReference:source},geometry}}};}
 }
 if(trialMapHash)await usageTrialMap(env,j,trialMapHash);
 await env.DB.prepare("UPDATE siege_records SET body_json=json_set(body_json,'$.requestCount',coalesce(json_extract(body_json,'$.requestCount'),0)+1) WHERE id=? AND state='running'").bind(j.id).run();
 const reserved=await env.BUCKET.put(key,JSON.stringify({pending:true,createdAt:Date.now()}),{onlyIf:{etagDoesNotMatch:'*'}});if(!reserved){const other=await env.BUCKET.get(key);return {cached:other?JSON.parse(await other.text()):{pending:true},job:j};}return {key,job:j,retry,adminUnrestricted,trialMapHash};
}

// Durable admin controls and hourly summaries. No user IDs or coordinates are logged.
const usagePauseId='SIEG-ANALYSIS-PAUSE';
async function usagePaused(env){
 if(!env.DB)throw Error('Analysis controls are unavailable.');
 return (await env.DB.prepare("SELECT state FROM siege_records WHERE id=? AND kind='analysis_control'").bind(usagePauseId).first())?.state==='paused';
}
const USAGE_TYPES={
 fields:'soil-texture soil-salinity soil-organic-carbon bulk-density slope erodability irrigatability land-suitability ndvi soil-moisture pest-disease-stress refresh-climate-analysis',
 eco:'land-cover cover-change biodiversity-intactness-index-bii ecosystem-condition habitat-extent-and-loss habitat-fragmentation canopy-height land-productivity land-cover-degradation persistent-bare-ground erosion-susceptibility soil-organic-carbon restoration-recovery carbon-monoxide nitrogen-dioxide-no absorbing-aerosol-index built-up-cover built-up-expansion built-up-probability 30-day-activity fire-activity recent-thermal-detections peak-fire-radiative-power latest-detection-age',
 hydrology:'catchment-preparation water-availability water-balance drought flood-watch catchment-health rainfall evapotranspiration groundwater-recharge surface-water turbidity suitable-spots-for-wells demand-stress warnings-restoration wetland-mapping',
 irrigation:'terrain-and-soil'
};
function usageType(service,value){return USAGE_TYPES[service]?.split(' ').includes(value)?value:'general'}
async function usageMetric(env,job,operation,type,outcome,retry=false){
 if(!job)return;
 const hour=new Date().toISOString().slice(0,13)+':00:00.000Z',area=job.areaKm2||0;
 const d={service:job.service,operation,type,requests:1,areaTotal:area,areaMax:area,hits:+(outcome==='cache'),failed:+(outcome==='failed'),retries:+retry,paused:+(outcome==='paused'),pending:+(outcome==='pending')};
 try{await env.DB.prepare(`INSERT INTO siege_records(id,kind,owner,state,created_at,body_json)
 VALUES(?,'analysis_metric','system','active',?,?)
 ON CONFLICT(id) DO UPDATE SET body_json=json_set(siege_records.body_json,
 '$.requests',json_extract(siege_records.body_json,'$.requests')+1,
 '$.areaTotal',json_extract(siege_records.body_json,'$.areaTotal')+?,
 '$.areaMax',max(json_extract(siege_records.body_json,'$.areaMax'),?),
 '$.hits',json_extract(siege_records.body_json,'$.hits')+?,
 '$.failed',json_extract(siege_records.body_json,'$.failed')+?,
 '$.retries',json_extract(siege_records.body_json,'$.retries')+?,
 '$.paused',json_extract(siege_records.body_json,'$.paused')+?,
 '$.pending',json_extract(siege_records.body_json,'$.pending')+?)`)
 .bind('SIEG-METRIC:'+hour+':'+job.service+':'+operation+':'+type,hour,JSON.stringify(d),area,area,d.hits,d.failed,d.retries,d.paused,d.pending).run();}
 catch(e){console.error('Could not record Earth Engine usage',e.message);}
}
async function usageDashboardAPI(request,env){
 if(!reportAdmin(request))return usageJSON({error:'SIEG admin access required.'},403);
 if(!env.DB)return usageJSON({error:'Usage storage unavailable.'},503);
 const url=new URL(request.url);
 if(request.method==='POST'){
 if(request.headers.get('Origin')!==url.origin)return usageJSON({error:'Origin not allowed'},403);
 const {paused}=await request.json();if(typeof paused!=='boolean')return usageJSON({error:'Choose pause or resume.'},400);
 await env.DB.prepare("INSERT INTO siege_records(id,kind,owner,state,created_at,body_json) VALUES(?,'analysis_control','system',?,?,'{}') ON CONFLICT(id) DO UPDATE SET state=excluded.state, created_at=excluded.created_at")
 .bind(usagePauseId,paused?'paused':'enabled',new Date().toISOString()).run();
 return usageJSON({paused});
 }
 if(request.method!=='GET')return usageJSON({error:'Method not allowed'},405);
 const days=[1,7,30].includes(Number(url.searchParams.get('days')))?Number(url.searchParams.get('days')):7;
 const cutoff=new Date(Math.floor(Date.now()/3600000)*3600000-days*86400000).toISOString();
 const {results}=await env.DB.prepare(`SELECT json_extract(body_json,'$.service') service, json_extract(body_json,'$.operation') operation, coalesce(json_extract(body_json,'$.type'),'general') type,
 sum(json_extract(body_json,'$.requests')) requests, sum(json_extract(body_json,'$.hits')) hits,
 sum(json_extract(body_json,'$.failed')) failed, sum(json_extract(body_json,'$.retries')) retries,
 sum(json_extract(body_json,'$.paused')) paused, sum(json_extract(body_json,'$.pending')) pending,
 sum(json_extract(body_json,'$.areaTotal'))/sum(json_extract(body_json,'$.requests')) areaAverage,
 max(json_extract(body_json,'$.areaMax')) areaMax FROM siege_records WHERE kind='analysis_metric' AND created_at>=?
 GROUP BY service,type,operation ORDER BY service,type,operation`).bind(cutoff).all();
 return usageJSON({paused:await usagePaused(env),rows:results});
}

function usageFreeSuitabilityExpression(body,tail){
 if(!['value:compute','maps'].includes(tail))throw Error('The free view does not include exports.');
 const text=JSON.stringify(body);if(text.length>350000)throw Error('Free view expression too large.');
 const datasets=[];function walk(n){if(!n||typeof n!=='object')return;const f=n.functionInvocationValue;if(f&&['Image.load','ImageCollection.load','Collection.loadTable'].includes(f.functionName)){const id=f.arguments?.id?.constantValue;if(typeof id!=='string')throw Error('Unsupported free-view dataset.');datasets.push(id);}for(const v of Object.values(n))if(v&&typeof v==='object')walk(v);}walk(body);
 if(datasets.some(id=>! /^(projects\/soilgrids-isric\/(phh2o|clay|soc)_mean|OpenLandMap\/SOL\/SOL_(PH-H2O_USDA-4C1A2A|CLAY-WFRACTION_USDA-3A1A1A|ORGANIC-CARBON_USDA-6A1C)_M\/v02|COPERNICUS\/DEM\/GLO30_2024_1|USGS\/SRTMGL1_003|ESA\/WorldCover\/v200)$/.test(id)))throw Error('The free view is limited to land suitability.');
}

function usageFreeClassificationExpression(body,tail){
 if(!['value:compute','maps'].includes(tail))throw Error('The free view does not include exports.');
 if(JSON.stringify(body).length>350000)throw Error('Free view expression too large.');
 function walk(n){if(!n||typeof n!=='object')return;const f=n.functionInvocationValue;if(f&&['Image.load','ImageCollection.load','Collection.loadTable'].includes(f.functionName)){if(f.arguments?.id?.constantValue!=='GOOGLE/DYNAMICWORLD/V1')throw Error('The free view is limited to land classification.');}for(const v of Object.values(n))if(v&&typeof v==='object')walk(v);}walk(body);
}

function usageFreeRestorationExpression(body,tail,env={}){
 if(!['value:compute','maps'].includes(tail))throw Error('The free view does not include exports.');
 if(JSON.stringify(body).length>350000)throw Error('Free view expression too large.');
 const allowed=['ECMWF/ERA5_LAND/DAILY_AGGR','USGS/SRTMGL1_003','NOAA/NGDC/ETOPO1','OpenLandMap/SOL/SOL_CLAY-WFRACTION_USDA-3A1A1A_M/v02','ESA/WorldCover/v200'];
 function walk(n){if(!n||typeof n!=='object')return;const f=n.functionInvocationValue;if(f&&['Image.load','ImageCollection.load','Collection.loadTable'].includes(f.functionName)){const id=f.arguments?.id?.constantValue,table=f.arguments?.tableId?.constantValue;const boundary=f.functionName==='Collection.loadTable'&&typeof table==='string'&&(Object.values(hydroBasinAssets(env)).includes(table)||/^(WWF\/HydroSHEDS\/|FAO\/GAUL\/|WM\/geoLab\/geoBoundaries\/|projects\/ee-gee023\/assets\/(globalADM2|Eswatini_Admin1|Eswatini_Villages|Villages_New))/.test(table));if(!boundary&&!allowed.includes(id))throw Error('The free view is limited to infiltration restoration screening.');}for(const v of Object.values(n))if(v&&typeof v==='object')walk(v);}walk(body);
}

// A single conditional update prevents concurrent requests from claiming a fourth map.
function usageContextMap(body){let style=false,raster=false;function walk(n){if(!n||typeof n!=='object')return;const f=n.functionInvocationValue;if(f){if(['Collection.style','FeatureCollection.style'].includes(f.functionName))style=true;if(['Image.load','ImageCollection.load','Image.constant','Collection.loadTable'].includes(f.functionName))raster=true;}for(const v of Object.values(n))if(v&&typeof v==='object')walk(v)}walk(body);return style&&!raster;}
async function usagePilotCheck(env,j){const id='PILOT-SERVICE:'+await reportSHA(j.owner);await env.DB.prepare("INSERT OR IGNORE INTO siege_records(id,kind,owner,state,created_at,body_json) VALUES(?,'pilot_service',?,'claimed',?,?)").bind(id,j.owner,new Date().toISOString(),JSON.stringify({service:j.service})).run();const row=await env.DB.prepare("SELECT body_json FROM siege_records WHERE id=? AND kind='pilot_service'").bind(id).first();if(!row||JSON.parse(row.body_json).service!==j.service)throw Error('Your one-time pilot is assigned to another SIEG service. Choose paid analysis to use this service.');}
async function usageTrialMap(env,j,hash){
 await usagePilotCheck(env,j);if(j.areaKm2>0.05+1e-9)throw Error('Free usage is limited to 5 ha.');
 const row=await env.DB.prepare(`UPDATE siege_records SET body_json=CASE WHEN EXISTS(SELECT 1 FROM json_each(json_extract(body_json,'$.freeMapHashes')) WHERE value=?) THEN body_json ELSE json_insert(body_json,'$.freeMapHashes[#]',?) END WHERE id=? AND kind='analysis' AND json_extract(body_json,'$.freeTrial')=1 AND (json_array_length(json_extract(body_json,'$.freeMapHashes'))<3 OR EXISTS(SELECT 1 FROM json_each(json_extract(body_json,'$.freeMapHashes')) WHERE value=?)) RETURNING id`).bind(hash,hash,j.id,hash).first();
 if(!row)throw Error('Your three free maps for the selected service have been used. Reopen them or choose paid analysis for more maps.');
}

async function usageTrialRelease(env,j,hash){if(!j?.freeTrial||!hash)return;await env.DB.prepare(`UPDATE siege_records SET body_json=json_remove(body_json,'$.freeMapHashes['||(SELECT key FROM json_each(json_extract(body_json,'$.freeMapHashes')) WHERE value=? LIMIT 1)||']') WHERE id=? AND EXISTS(SELECT 1 FROM json_each(json_extract(body_json,'$.freeMapHashes')) WHERE value=?)`).bind(hash,j.id,hash).run();}

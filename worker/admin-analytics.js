// Aggregate only: no IP addresses, cookies, visitor identifiers or precise locations.
const ANALYTICS_SERVICES={fields:'SIEG Fields',irrigation:'SIEG Irrigate',hydrology:'SIEG Hydrology',eco:'SIEG Eco',property:'SIEG Estate',address:'SIEG Address',education:'SIEG Learn',experts:'SIEG Experts',business:'SIEG Business'};
const ANALYTICS_PAGES={'/fields':'fields','/agri.html':'fields','/irrigate':'irrigation','/irrigation.html':'irrigation','/hydrology':'hydrology','/hydrology.html':'hydrology','/eco':'eco','/eco.html':'eco','/estates':'property','/property.html':'property','/address':'address','/geocoding.html':'address','/learn':'education','/education.html':'education','/experts':'experts','/talent.html':'experts','/business':'business','/business.html':'business'};
const ANALYTICS_REQUESTS={'/api/property/listings':'property','/api/property/service-requests':'estate_requests','/api/experts/applications':'experts','/api/experts/briefs':'briefs','/api/operations/enquiries':'enquiries','/api/analysis/orders':'analysis','/api/education/pilot':'learn_pilot','/api/weekly-crop':'weekly_crop','/api/address/service-request':'enquiries'};
function analyticsGeo(request){const cf=request.cf||{};return {country:/^[A-Z]{2}$/.test(cf.country||'')?cf.country:'Unknown',continent:/^(AF|AN|AS|EU|NA|OC|SA)$/.test(cf.continent||'')?cf.continent:'Unknown'};}
async function analyticsTrack(request,env,response,path){
 if(!env.DB||env.SIEG_ENV==='staging'||!['sieg.ltd','www.sieg.ltd'].includes(new URL(request.url).hostname)||!response.ok)return;
 const geo=analyticsGeo(request),day=new Date().toISOString().slice(0,10);
 if(request.method==='GET'&&response.headers.get('Content-Type')?.includes('text/html')&&!/bot|crawler|spider|headless/i.test(request.headers.get('User-Agent')||'')){
  const service=ANALYTICS_PAGES[path]||(['/', '/index.html','/resources.html','/resources'].includes(path)?'other':null);if(!service)return;
  const id=['SITE-VISIT',day,geo.country,geo.continent,service].join(':');
  await env.DB.prepare("INSERT INTO siege_records(id,kind,owner,state,created_at,body_json) VALUES(?,'site_visit_aggregate','aggregate','active',?,?) ON CONFLICT(id) DO UPDATE SET body_json=json_set(body_json,'$.count',coalesce(json_extract(body_json,'$.count'),0)+1)").bind(id,day,JSON.stringify({...geo,service,count:1})).run();
 }
 const kind=request.method==='POST'&&ANALYTICS_REQUESTS[path];if(kind){let data;try{data=await response.clone().json()}catch{return}const id=data.id||data.request?.id;if(typeof id!=='string'||id.length>200)return;
 await env.DB.prepare("INSERT INTO siege_records(id,kind,owner,state,created_at,body_json) VALUES(?,'request_geography','aggregate','active',?,?) ON CONFLICT(id) DO NOTHING").bind('REQUEST-GEO:'+kind+':'+id,day,JSON.stringify(geo)).run();}
}
async function adminSummaryAPI(request,env){
 if(!opsAdmin(request))return opsJSON({error:'Administrator access required.'},403);if(request.method!=='GET')return opsJSON({error:'Method not allowed.'},405);if(!env.DB)return opsJSON({error:'Summary storage is not configured.'},503);
 const days=Number(new URL(request.url).searchParams.get('days')||30);if(![7,30,90,365].includes(days))return opsJSON({error:'Choose a supported period.'},400);
 const since=new Date(Date.now()-days*86400000).toISOString().slice(0,10);
 try{
 const visits=await env.DB.prepare("SELECT created_at,body_json FROM siege_records WHERE kind='site_visit_aggregate' AND created_at>=?").bind(since).all();
 const groups=await env.DB.prepare("SELECT r.kind,r.state,json_extract(r.body_json,'$.service') service,json_extract(r.body_json,'$.data.product') product,coalesce(json_extract(g.body_json,'$.country'),'Unknown') country,coalesce(json_extract(g.body_json,'$.continent'),'Unknown') continent,count(*) count FROM siege_records r LEFT JOIN siege_records g ON g.id='REQUEST-GEO:'||r.kind||':'||r.id AND g.kind='request_geography' WHERE r.kind IN ('analysis','property','experts','estate_requests','briefs','enquiries','learn_pilot','weekly_crop') AND r.created_at>=? AND r.state NOT IN ('draft','test_archived','cancelled','admin_deleted') AND coalesce(json_extract(r.body_json,'$.adminBypass'),0)=0 GROUP BY r.kind,r.state,service,product,country,continent").bind(since).all();
 const totals={visits:0,serviceVisits:0,requests:0,pending:0},countries=new Map(),continents=new Map(),services=new Map();
 const bucket=(map,key)=>{if(!map.has(key))map.set(key,{name:key,visits:0,serviceVisits:0,requests:0,pending:0});return map.get(key)};
 for(const name of Object.values(ANALYTICS_SERVICES))bucket(services,name);
 for(const row of visits.results||[]){const d=JSON.parse(row.body_json),n=Number(d.count)||0,service=d.service!=='other';for(const b of [totals,bucket(countries,d.country),bucket(continents,d.continent)]){b.visits+=n;if(service)b.serviceVisits+=n;}if(service)bucket(services,ANALYTICS_SERVICES[d.service]||d.service).serviceVisits+=n;}
 const pending=new Set(['new','requested','pending_review','awaiting_approval','awaiting_payment','awaiting_checkout','queued','authorised']);
 for(const row of groups.results||[]){const n=Number(row.count)||0,service=row.service||({property:'property',experts:'experts',estate_requests:'property',briefs:'experts',learn_pilot:'education',weekly_crop:'fields'}[row.kind])||row.product||'General enquiries';for(const b of [totals,bucket(countries,row.country),bucket(continents,row.continent),bucket(services,ANALYTICS_SERVICES[service]||service)]){b.requests+=n;if(pending.has(row.state))b.pending+=n;}}
 const sorted=map=>[...map.values()].sort((a,b)=>(b.visits+b.requests)-(a.visits+a.requests)||a.name.localeCompare(b.name));
 const first=await env.DB.prepare("SELECT min(created_at) started FROM siege_records WHERE kind='site_visit_aggregate'").first();
 const database=await adminDatabaseSummary(env);
 return opsJSON({database,days,since,scope:'sieg.ltd + www.sieg.ltd',trackingStarted:first?.started||null,totals,countries:sorted(countries),continents:sorted(continents),services:sorted(services),definition:'Visits are successful top-level page views, including repeat views, excluding known bots and preview/staging traffic. Requests are saved analysis orders, property/specialist submissions, enquiries, Learn and weekly crop requests created in this period. Pending counts those still awaiting review, payment or processing. Unknown geography includes older records and unavailable country data.'});
 }catch{return opsJSON({error:'The summary could not load. Please retry.'},503)}
}
export {analyticsTrack};

// Current database inventory is deliberately independent of the activity-period filter.
let adminPopulationCache=null,adminPopulationPending=null;
async function adminPopulation(){
 if(adminPopulationCache&&Date.now()-adminPopulationCache.at<86400000)return adminPopulationCache;
 if(adminPopulationPending)return adminPopulationPending;
 adminPopulationPending=(async()=>{try{const response=await fetch('https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&mrnev=1&per_page=400',{signal:AbortSignal.timeout(5000)});if(!response.ok)throw Error();const payload=await response.json();if(!Array.isArray(payload?.[1])||Number(payload[0]?.pages)>1)throw Error();const countries={};for(const row of payload[1]){if(/^[A-Z]{2}$/.test(row.country?.id||'')&&typeof row.value==='number'&&row.value>0&&/^\d{4}$/.test(row.date))countries[row.country.id]={value:row.value,year:Number(row.date)};}if(!Object.keys(countries).length)throw Error();adminPopulationCache={at:Date.now(),countries,status:'current'};return adminPopulationCache;}catch{return adminPopulationCache?{...adminPopulationCache,status:'cached'}:{countries:{},status:'unavailable'};}finally{adminPopulationPending=null;}})();return adminPopulationPending;
}
async function adminDatabaseSummary(env){
 const rows=async(sql,...args)=>(await env.DB.prepare(sql).bind(...args).all()).results||[];
 const inventory=await rows("SELECT kind,state,count(*) count FROM siege_records WHERE kind IN ('entrance_address','business_profile','experts','international_graduate','property','analysis','business_subscription','learn_pilot','weekly_crop') AND state NOT IN ('test_archived','admin_deleted') GROUP BY kind,state ORDER BY kind,state");
 // Reuse the public-directory predicate, including consent, billing, address ownership and expiry.
 const businesses=(await rows("SELECT count(*) registered FROM siege_records WHERE kind='business_profile'"))[0];
 const visible=await rows("SELECT coalesce(json_extract(a.body_json,'$.countryCode'),'Unknown') country,count(*) visible,sum(CASE WHEN json_extract(b.body_json,'$.paymentVerified')=1 AND json_extract(b.body_json,'$.active')=1 AND json_extract(b.body_json,'$.live')=1 AND json_extract(b.body_json,'$.paidUntil')>? THEN 1 ELSE 0 END) paid"+BUSINESS_PUBLIC_JOIN+" GROUP BY country",Date.now(),Date.now(),Date.now());
 const businessCountries=await rows("SELECT coalesce(json_extract(a.body_json,'$.countryCode'),'Unknown') country,count(*) registered FROM siege_records p LEFT JOIN siege_records a ON a.id=json_extract(p.body_json,'$.addressId') AND a.kind='entrance_address' AND a.owner=p.owner WHERE p.kind='business_profile' GROUP BY country");
 for(const row of businessCountries){const v=visible.find(v=>v.country===row.country);row.visible=Number(v?.visible||0);row.paid=Number(v?.paid||0);row.trial=row.visible-row.paid;row.unlisted=row.registered-row.visible;}
 const specialists=(await rows("SELECT count(*) registered,sum(CASE WHEN state='approved' THEN 1 ELSE 0 END) visible,sum(CASE WHEN state='approved' AND json_extract(body_json,'$.data.availability')='Available now' THEN 1 ELSE 0 END) available,sum(CASE WHEN state='pending_review' THEN 1 ELSE 0 END) pending FROM siege_records WHERE kind='experts' AND state NOT IN ('test_archived','admin_deleted')"))[0];
 const graduates=(await rows("SELECT count(DISTINCT owner) registered,count(*) records,count(DISTINCT CASE WHEN state='active' THEN owner END) visible,count(DISTINCT CASE WHEN state='active' AND json_extract(body_json,'$.data.availability')='Available now' THEN owner END) available,count(DISTINCT owner)-count(DISTINCT CASE WHEN json_extract(body_json,'$.data.availability') IS NOT NULL AND json_extract(body_json,'$.data.availability')!='Not stated' THEN owner END) unstated FROM siege_records WHERE kind='international_graduate' AND state NOT IN ('test_archived','admin_deleted')"))[0];
 const graduateCountries=await rows("SELECT coalesce(json_extract(body_json,'$.data.country'),'Unknown') country,count(DISTINCT owner) registered,count(*) records,count(DISTINCT CASE WHEN state='active' THEN owner END) visible,count(DISTINCT CASE WHEN state='active' AND json_extract(body_json,'$.data.availability')='Available now' THEN owner END) available FROM siege_records WHERE kind='international_graduate' AND state NOT IN ('test_archived','admin_deleted') GROUP BY country ORDER BY registered DESC,country");
 const population=graduateCountries.length?await adminPopulation():{countries:{},status:'not_requested'};
 for(const row of graduateCountries){row.population=population.countries[row.country]||null;row.availabilityRate=row.registered?Math.round(row.available/row.registered*1000)/10:0;}
 const business={registered:Number(businesses?.registered||0),visible:visible.reduce((n,r)=>n+Number(r.visible),0),paid:visible.reduce((n,r)=>n+Number(r.paid),0),countries:businessCountries};business.trial=business.visible-business.paid;business.unlisted=business.registered-business.visible;
 const subscriptions=await adminSubscriptionSummary(env);
 return {asOf:new Date().toISOString(),inventory,subscriptions,business,specialists,graduates,graduateCountries,population:{status:population.status,source:'World Bank · SP.POP.TOTL',url:'https://data.worldbank.org/indicator/SP.POP.TOTL',retrievedAt:population.at?new Date(population.at).toISOString():null},definition:'Current saved database records, independent of the activity period. Business counts are location profiles; visible listings meet the live directory rules. Graduate people are distinct accounts, with education records counted separately. Available means an active graduate profile or approved specialist explicitly marked Available now. Graduate geography is country of study, not nationality or current residence. A person may appear in multiple study countries, so country totals need not sum to the global total. Population is the latest non-empty World Bank total for each study country; missing values are unavailable, not zero. These voluntary registrations are not national graduate or labour-force estimates.'};
}

async function adminSubscriptionSummary(env){
 const specs=[
  {id:'business',title:'SIEG Business · annual',mode:'subscription',where:"kind='business_subscription'",note:'Verified paid billing records, including subscriptions whose profiles are not currently visible.'},
  {id:'studio',title:'Teacher Studio · monthly',mode:'subscription',where:"kind='learn_pilot' AND json_extract(body_json,'$.data.offer')='studio'",note:'Paid access activated by an administrator; active only until its saved access end date.'},
  {id:'weekly',title:'Weekly crop monitoring',mode:'subscription',where:"kind='weekly_crop'",note:'Monthly paid delivery period; expired periods are excluded from active plans.'},
  {id:'hydrology',title:'Monthly Water Summary',mode:'request',where:"kind='enquiries' AND json_extract(body_json,'$.data.product')='SIEG Hydrology · Monthly Water Summary'",note:'Enquiry records only. The platform does not record active paid subscriptions for this offer.'},
  {id:'sourcing',title:'Experts · business sourcing',mode:'waitlist',where:"kind='briefs' AND json_extract(body_json,'$.data.service')='business'",note:'Waitlist interest only; no subscription starts when a request is saved.'},
  {id:'school',title:'SIEG Learn · school pack',mode:'onboarding',where:"kind='learn_pilot' AND json_extract(body_json,'$.data.offer')='school'",note:'School onboarding requests. Active school access is managed separately and is not tracked here.'},
  {id:'pack',title:'Subject revision packs',mode:'one-off',where:"kind='learn_pilot' AND json_extract(body_json,'$.data.offer')='pack'",note:'One-off purchases, not recurring subscriptions. Active means unlocked pack access.'}
 ];
 const now=Date.now();
 return Promise.all(specs.map(async spec=>{
  const records=await env.DB.prepare("SELECT state,json_extract(body_json,'$.data.until') access_until,json_extract(body_json,'$.data.paidThrough') paid_through,json_extract(body_json,'$.paidUntil') business_until,json_extract(body_json,'$.trialUntil') trial_until,json_extract(body_json,'$.paymentVerified') verified,json_extract(body_json,'$.active') billing_active,json_extract(body_json,'$.live') live,count(*) count FROM siege_records WHERE ("+spec.where+") AND state NOT IN ('test_archived','admin_deleted','draft') GROUP BY state,access_until,paid_through,business_until,trial_until,verified,billing_active,live").all();
  const result={id:spec.id,title:spec.title,mode:spec.mode,note:spec.note,total:0,active:0,pending:0,expired:0,stopped:0,trial:0,other:0};
  for(const r of records.results||[]){const n=Number(r.count)||0;result.total+=n;let status='other';
   if(spec.id==='business'){
    if(r.verified===1&&r.billing_active===1&&r.live===1&&typeof r.business_until==='number'&&r.business_until>now)status='active';
    else if(typeof r.trial_until==='number'&&r.trial_until>now)status='trial';
    else if(['canceled','cancelled','stopped','incomplete_expired'].includes(r.state))status='stopped';
    else if((typeof r.business_until==='number'&&r.business_until>0&&r.business_until<=now)||(typeof r.trial_until==='number'&&r.trial_until>0&&r.trial_until<=now))status='expired';
    else if(['pending','unpaid','awaiting_payment','awaiting_checkout','past_due','incomplete'].includes(r.state))status='pending';
   }else if(spec.mode==='subscription'){
    const until=Date.parse(spec.id==='weekly'?r.paid_through:r.access_until);
    if(r.state==='active'&&until>now)status='active';else if(r.state==='active'&&Number.isFinite(until)&&until<=now)status='expired';
    else if(['requested','pending','awaiting_payment','awaiting_checkout'].includes(r.state))status='pending';else if(['stopped','cancelled','canceled'].includes(r.state))status='stopped';
   }else if(spec.mode==='one-off'&&r.state==='active')status='active';
   else if(['requested','new','pending','contacted','awaiting_payment','awaiting_checkout','pending_review'].includes(r.state))status='pending';
   else if(['stopped','cancelled','canceled','closed','rejected'].includes(r.state))status='stopped';
   result[status]+=n;
  }
  return result;
 }));
}

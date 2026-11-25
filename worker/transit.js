/* Smartphone-only Transit. Authenticated account identities are supplied by the host. */
const transitJSON=(v,s=200)=>Response.json(v,{status:s,headers:{'Cache-Control':'no-store'}});
function transitText(v,min=1,max=100){if(typeof v!=='string'||v.trim().length<min||v.trim().length>max)throw Error('Check the required text fields.');return v.trim()}
function transitPoint(v){if(!v||!Number.isFinite(v.lat)||!Number.isFinite(v.lon)||Math.abs(v.lat)>90||Math.abs(v.lon)>180)throw Error('Choose a valid location.');return {lat:v.lat,lon:v.lon}}
function transitDistance(a,b){const r=Math.PI/180,d=(b.lat-a.lat)*r,l=(b.lon-a.lon)*r,x=Math.sin(d/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(l/2)**2;return 6371000*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))}
function transitProgress(stops,p){
 let nearest=0,best=Infinity;for(let i=0;i<stops.length;i++){const d=transitDistance(p,stops[i]);if(d<best){best=d;nearest=i}}if(best<=30)return nearest;
 let segment=0,error=Infinity;const cos=Math.cos(p.lat*Math.PI/180);for(let i=0;i<stops.length-1;i++){const a=stops[i],b=stops[i+1],ax=(a.lon-p.lon)*cos,ay=a.lat-p.lat,bx=(b.lon-p.lon)*cos,by=b.lat-p.lat,dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy||1))),d=(ax+t*dx)**2+(ay+t*dy)**2;if(d<error){error=d;segment=i}}return segment+1;
}
async function transitNearby(db,account,p,routeRows){
 const found=[];for(const r of routeRows){for(const stop of (r.stops||JSON.parse(r.stops_json))){const distance=transitDistance(p,stop);if(distance<=30)found.push({id:stop.id,name:stop.name,lat:stop.lat,lon:stop.lon,routeId:r.id,distance,source:'Transit stop'})}}
 const delta=30/111000,lonDelta=delta/Math.max(.01,Math.cos(p.lat*Math.PI/180));
 const rows=(await db.prepare("SELECT id,body_json FROM siege_records WHERE kind='entrance_address' AND (owner=? OR state IN ('public','published')) AND json_extract(body_json,'$.addressType')='bus_stop' AND CAST(json_extract(body_json,'$.latitude') AS REAL) BETWEEN ? AND ? AND CAST(json_extract(body_json,'$.longitude') AS REAL) BETWEEN ? AND ? LIMIT 100").bind(account,p.lat-delta,p.lat+delta,p.lon-lonDelta,p.lon+lonDelta).all()).results;
 for(const row of rows){try{const a=JSON.parse(row.body_json),q={lat:a.latitude,lon:a.longitude};if(!Number.isFinite(q.lat)||!Number.isFinite(q.lon)||a.expiresAt&&Date.parse(a.expiresAt+'T23:59:59Z')<Date.now())continue;const distance=transitDistance(p,q);if(distance<=30)found.push({id:row.id,name:a.placeName||a.siegId||'Bus stop',...q,distance,source:'SIEG Address'})}catch{}}
 return found.sort((a,b)=>a.distance-b.distance);
}
function transitPickupKey(owner){return 'TRANSIT-PICKUP:'+owner;}
async function transitMine(db,owner,now){
 const waiting=await db.prepare('SELECT route_id,stop_id,destination,expires_at FROM transit_waiting WHERE owner=? AND expires_at>?').bind(owner,now).first();if(!waiting)return null;
 const row=await db.prepare("SELECT state,body_json FROM siege_records WHERE id=? AND kind='transit_pickup'").bind(transitPickupKey(owner)).first();if(!row)return waiting;const data=JSON.parse(row.body_json);if(data.expiresAt<=now||!['waiting','accepted'].includes(row.state))return waiting;
 const responses=(await db.prepare("SELECT body_json FROM siege_records WHERE kind='transit_pickup_response' AND state='full' AND json_extract(body_json,'$.requestId')=? LIMIT 20").bind(data.requestId).all()).results;
 return {...waiting,pickup:{requestId:data.requestId,status:row.state,plate:row.state==='accepted'?data.plate:null,updatedAt:data.respondedAt||data.createdAt,fullBuses:responses.map(row=>{const response=JSON.parse(row.body_json);return {plate:response.plate,respondedAt:response.respondedAt};})}};
}
async function transitPickupSignal(db,owner,routeId,stopId,destination,now,expiresAt){
 const record={requestId:crypto.randomUUID(),routeId,stopId,destination,createdAt:now,expiresAt};
 await db.prepare("INSERT INTO siege_records(id,kind,owner,state,created_at,body_json) VALUES(?,'transit_pickup',?,'waiting',?,?) ON CONFLICT(id) DO UPDATE SET state='waiting',created_at=excluded.created_at,body_json=excluded.body_json WHERE siege_records.state NOT IN ('waiting','accepted') OR json_extract(siege_records.body_json,'$.expiresAt')<=? OR json_extract(siege_records.body_json,'$.routeId')<>? OR json_extract(siege_records.body_json,'$.stopId')<>?").bind(transitPickupKey(owner),owner,new Date(now).toISOString(),JSON.stringify(record),now,routeId,stopId).run();
 const row=await db.prepare("SELECT state,body_json FROM siege_records WHERE id=? AND kind='transit_pickup'").bind(transitPickupKey(owner)).first();return {...JSON.parse(row.body_json),status:row.state};
}
async function transitAPI(request,env){
 const account=request.headers.get('oai-authenticated-user-id'),url=new URL(request.url),path=url.pathname.slice('/api/transit/'.length),now=Date.now();
 if(!account)return transitJSON({error:'Sign in to SIEG to use Transit.'},401);
 if(!env.DB)return transitJSON({error:'Transit storage is unavailable.'},503);
 if(!['GET','POST'].includes(request.method))return transitJSON({error:'Method not allowed.'},405);
 if(request.method==='POST'&&request.headers.get('Origin')!==url.origin)return transitJSON({error:'Origin not allowed.'},403);
 const deviceId=request.headers.get('X-SIEG-Device')||'';if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deviceId))return transitJSON({error:'Reopen Transit to register this browser automatically.'},400);
 const owner=account+':transit:'+deviceId.toLowerCase();
 try{
 const db=env.DB,profile=await db.prepare('SELECT role,plate,phone FROM transit_profiles WHERE owner=?').bind(owner).first();
 const transitAccount=await db.prepare('SELECT reference,first_name,surname,username,email,phone,created_at FROM transit_accounts WHERE owner=?').bind(account).first();
 if(path==='account'&&request.method==='GET'){const bundles=transitAccount?(await db.prepare("SELECT id,json_extract(body_json,'$.data.name') company FROM siege_records WHERE kind='enquiries' AND json_extract(body_json,'$.data.bundleAccessActive')=1 AND json_extract(body_json,'$.data.product')='SIEG Transit Bundle Access' AND EXISTS(SELECT 1 FROM json_each(json_extract(body_json,'$.data.accountReferences')) WHERE value=?) LIMIT 20").bind(transitAccount.reference).all()).results:[];return transitJSON({account:transitAccount,bundles});}
 if(path==='account-register'&&request.method==='POST'){
  if(transitAccount)return transitJSON({error:'You already have a Transit account. Please log in.'},409);
  const b=await request.json(),firstName=transitText(b.firstName,1,80),surname=transitText(b.surname,1,80),username=transitText(b.username,3,30).toLowerCase(),email=transitText(b.email,5,200).toLowerCase(),phone=transitText(b.phone,8,25).replace(/[ ()-]/g,'');
  if(!/^[a-z0-9][a-z0-9_.-]{2,29}$/.test(username))throw Error('Use 3–30 letters, numbers, dots, underscores or hyphens for your username.');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Enter a valid recovery email.');
  if(!/^\+[1-9]\d{7,14}$/.test(phone))throw Error('Enter a cellphone number with country code.');
  if(b.consent!==true)throw Error('Please agree to saving your account details.');
  const reference='SIEG-TR-'+crypto.randomUUID().replaceAll('-','').slice(0,12).toUpperCase();
  try{await db.prepare('INSERT INTO transit_accounts(owner,reference,first_name,surname,username,email,phone,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(account,reference,firstName,surname,username,email,phone,new Date(now).toISOString()).run()}catch(e){if(/unique|constraint/i.test(e.message))return transitJSON({error:'That username or email is already registered. Use Login or account recovery.'},409);throw e}
  await db.prepare("INSERT INTO transit_profiles(owner,name,phone,role,plate) VALUES(?,?,?,'commuter',NULL) ON CONFLICT(owner) DO UPDATE SET phone=excluded.phone").bind(owner,firstName+' '+surname,phone).run();
  return transitJSON({account:await db.prepare('SELECT reference,first_name,surname,username,email,phone,created_at FROM transit_accounts WHERE owner=?').bind(account).first()},201);
 }
 if(path==='account-login'&&request.method==='POST'){
  const b=await request.json();if(!transitAccount)return transitJSON({error:'Create your Transit account using Register first.'},409);
  if(String(b.username||'').trim().toLowerCase()!==transitAccount.username)return transitJSON({error:'Use the username linked to your signed-in SIEG account, or choose account recovery.'},403);
  return transitJSON({account:transitAccount});
 }
 if(['account-recovery','bundle-request'].includes(path)&&request.method==='POST'){
  const b=await request.json();if(b.consent!==true)throw Error('Please agree to saving this request.');
  const recent=await db.prepare("SELECT count(*) n FROM siege_records WHERE kind='enquiries' AND owner=? AND created_at>?").bind(account,new Date(now-900000).toISOString()).first();if(recent.n>=5)return transitJSON({error:'Please wait 15 minutes before sending more requests.'},429);
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(b.requestId||''))throw Error('A request reference is required.');
  let data;
  if(path==='account-recovery'){
   const email=transitText(b.email,5,200).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Enter your recovery email.');
   data={name:'Transit account recovery',product:'SIEG Transit Account Recovery',email,accountReference:String(b.reference||'').trim().slice(0,40),message:'Account recovery requested. Verify account ownership and saved email before making changes.',consent:true};
  }else{
   if(!transitAccount)return transitJSON({error:'Register your Transit account before requesting bundle access.'},403);
   if(!Array.isArray(b.references)||b.references.length<1||b.references.length>100)throw Error('Enter 1–100 account references.');
   const references=[...new Set(b.references.map(x=>String(x).trim().toUpperCase()))];if(references.some(x=>!/^SIEG-TR-[A-F0-9]{12}$/.test(x)))throw Error('Check the account reference format: SIEG-TR- followed by 12 characters.');
   const rows=(await db.prepare('SELECT reference FROM transit_accounts WHERE reference IN ('+references.map(()=>'?').join(',')+')').bind(...references).all()).results;
   if(rows.length!==references.length)throw Error('One or more account references could not be found. Check the list and try again.');
   data={name:transitText(b.company,2,150),product:'SIEG Transit Bundle Access',email:transitAccount.email,phone:transitAccount.phone,requesterReference:transitAccount.reference,accountReferences:references,seats:references.length,message:String(b.notes||'').trim().slice(0,1500),consent:true};
  }
  const id=b.requestId,createdAt=new Date(now).toISOString(),record={id,owner:account,createdAt,state:'new',data};await db.prepare("INSERT OR IGNORE INTO siege_records(id,kind,owner,state,created_at,body_json) VALUES(?,'enquiries',?,'new',?,?)").bind(id,account,createdAt,JSON.stringify(record)).run();
  return transitJSON({id,seats:data.seats,message:path==='account-recovery'?'Recovery request received. SIEG will verify the saved email and account ownership before making changes.':'Bundle access request saved for SIEG review. Access is not activated until approved.'});
 }
 if(path==='phone'&&request.method==='POST'){const b=await request.json(),phone=transitText(b.phone,8,25).replace(/[ ()-]/g,'');if(!/^\+[1-9]\d{7,14}$/.test(phone))throw Error('Enter a valid cellphone number with country code, e.g. +26876123456.');await db.prepare("INSERT INTO transit_profiles(owner,name,phone,role,plate) VALUES(?,'Device',?,'commuter',NULL) ON CONFLICT(owner) DO UPDATE SET phone=excluded.phone").bind(owner,phone).run();return transitJSON({registered:true});}
 if(path==='report-request'&&request.method==='POST'){const b=await request.json();if(b.consent!==true)throw Error('Consent is required.');const email=transitText(b.email,5,200);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Enter a valid email.');if(!/^[0-9a-f-]{36}$/i.test(b.requestId||''))throw Error('Request reference is required.');const id=b.requestId,createdAt=new Date(now).toISOString(),data={name:'SIEG Transit report request',product:'SIEG Transit Report',email,phone:profile?.phone||'',route:transitText(b.route,2,150),message:transitText(b.notes,2,1500),consent:true},record={id,owner:account,createdAt,state:'new',data};await db.prepare("INSERT OR IGNORE INTO siege_records(id,kind,owner,state,created_at,body_json) VALUES(?,'enquiries',?,'new',?,?)").bind(id,account,createdAt,JSON.stringify(record)).run();return transitJSON({id,message:'Request saved for SIEG review.'});}
 if(path==='me'&&request.method==='GET'){const saved=await db.prepare("SELECT body_json FROM siege_records WHERE id=? AND kind='transit_duty' AND owner=? AND state='on_duty'").bind('TRANSIT-DUTY:'+owner,owner).first();const waiting=await transitMine(db,owner,now);return transitJSON({profile,deviceRegistered:!!profile,duty:saved?JSON.parse(saved.body_json):null,waiting});}
 if(path==='device'&&request.method==='POST'){await db.prepare("UPDATE transit_profiles SET owner=?,name='Device' WHERE owner=? AND NOT EXISTS(SELECT 1 FROM transit_profiles WHERE owner=?)").bind(owner,account,owner).run();await db.prepare("INSERT OR IGNORE INTO transit_profiles(owner,name,phone,role,plate) VALUES(?,'Device','','commuter',NULL)").bind(owner).run();if(transitAccount)await db.prepare('UPDATE transit_profiles SET phone=? WHERE owner=?').bind(transitAccount.phone,owner).run();const current=await db.prepare('SELECT role,plate,phone FROM transit_profiles WHERE owner=?').bind(owner).first();return transitJSON({profile:current,deviceRegistered:true});}
 if(path==='register'&&request.method==='POST'){
  const b=await request.json();
  if(!['driver','commuter'].includes(b.role))throw Error('Choose driver or commuter.');
  const plate=b.role==='driver'?transitText(b.plate,3,20).toUpperCase().replace(/[^A-Z0-9]/g,''):null;if(b.role==='driver'&&plate.length<3)throw Error('Enter a valid bus number plate.');
  try{await db.prepare('INSERT INTO transit_profiles(owner,name,phone,role,plate) VALUES(?,?,?,?,?) ON CONFLICT(owner) DO UPDATE SET role=excluded.role,plate=excluded.plate').bind(owner,'Device','',b.role,plate).run()}catch(e){if(/unique|constraint/i.test(e.message))return transitJSON({error:'That number plate is already registered to another driver.'},409);throw e}
  if(b.role!=='driver')await db.prepare('DELETE FROM transit_positions WHERE owner=?').bind(owner).run();
  return transitJSON({saved:true});
 }
 if(!profile)return transitJSON({error:'Reopen Transit to register this device automatically.'},403);
 if(path==='routes'&&request.method==='GET'){const rows=(await db.prepare('SELECT id,name,stops_json FROM transit_routes ORDER BY name LIMIT 200').all()).results;return transitJSON({routes:rows.map(r=>({...r,stops:JSON.parse(r.stops_json),stops_json:undefined}))})}
 if(path==='routes'&&request.method==='POST'){
  if(profile.role!=='driver')return transitJSON({error:'Only drivers can register routes.'},403);
  const b=await request.json(),name=transitText(b.name,3,120);if(!Array.isArray(b.stops)||b.stops.length<2||b.stops.length>40)throw Error('Add 2–40 stops in travel order.');
  const stops=b.stops.map(s=>({id:crypto.randomUUID(),name:transitText(s.name,2,100),...transitPoint(s)}));for(let i=1;i<stops.length;i++)if(transitDistance(stops[i-1],stops[i])<20)throw Error('Consecutive stops must be at least 20 metres apart.');
  const id=crypto.randomUUID();await db.prepare('INSERT INTO transit_routes(id,owner,name,stops_json) VALUES(?,?,?,?)').bind(id,owner,name,JSON.stringify(stops)).run();return transitJSON({saved:true,id});
 }
 if(path==='nearby'&&request.method==='POST'){const b=await request.json(),p=transitPoint(b);if(b.source!=='scan'&&(!Number.isFinite(b.accuracy)||b.accuracy>30||b.accuracy<0))return transitJSON({stops:[],accuracyRequired:30,note:'Improve phone accuracy to 30 m or better to identify a stop.'});const routes=(await db.prepare('SELECT id,stops_json FROM transit_routes LIMIT 200').all()).results;return transitJSON({stops:await transitNearby(db,account,p,routes),radius:30});}
 if(path==='duty'&&request.method==='POST'){if(!transitAccount)return transitJSON({error:'Register your Transit account first.'},403);if(!profile?.phone)return transitJSON({error:'Register your cellphone using Account first.'},403);
  if(profile.role!=='driver')return transitJSON({error:'Save your bus number plate first.'},403);const b=await request.json(),route=await db.prepare('SELECT id FROM transit_routes WHERE id=?').bind(String(b.routeId)).first();if(!route)throw Error('Choose your bus route.');const tripId=crypto.randomUUID(),key='TRANSIT-DUTY:'+owner;
  await db.batch([db.prepare("INSERT INTO siege_records(id,kind,owner,state,created_at,body_json) VALUES(?,'transit_duty',?,'on_duty',?,?) ON CONFLICT(id) DO UPDATE SET state='on_duty',body_json=excluded.body_json").bind(key,owner,new Date(now).toISOString(),JSON.stringify({tripId,routeId:route.id,startedAt:now})),db.prepare("DELETE FROM transit_positions WHERE owner=? AND EXISTS(SELECT 1 FROM siege_records WHERE id=? AND json_extract(body_json,'$.tripId')=?)").bind(owner,key,tripId)]);await db.prepare("UPDATE siege_records SET state='waiting',body_json=json_remove(body_json,'$.driverOwner','$.tripId','$.plate','$.respondedAt') WHERE kind='transit_pickup' AND state='accepted' AND json_extract(body_json,'$.driverOwner')=? AND json_extract(body_json,'$.tripId')<>?").bind(owner,tripId).run();return transitJSON({tripId,routeId:route.id});
 }
 if(path==='stop'&&request.method==='POST'){const b=await request.json();if(typeof b.tripId!=='string')throw Error('Trip ID is required.');const key='TRANSIT-DUTY:'+owner;await db.batch([db.prepare("UPDATE siege_records SET state='off_duty' WHERE id=? AND owner=? AND json_extract(body_json,'$.tripId')=?").bind(key,owner,b.tripId),db.prepare("DELETE FROM transit_positions WHERE owner=? AND EXISTS(SELECT 1 FROM siege_records WHERE id=? AND state='off_duty' AND json_extract(body_json,'$.tripId')=?)").bind(owner,key,b.tripId)]);await db.prepare("UPDATE siege_records SET state='waiting',body_json=json_remove(body_json,'$.driverOwner','$.tripId','$.plate','$.respondedAt') WHERE kind='transit_pickup' AND state='accepted' AND json_extract(body_json,'$.driverOwner')=? AND json_extract(body_json,'$.tripId')=?").bind(owner,b.tripId).run();return transitJSON({stopped:true})}
 if(path==='cancel'&&request.method==='POST'){await db.batch([db.prepare('DELETE FROM transit_waiting WHERE owner=?').bind(owner),db.prepare("UPDATE siege_records SET state='cancelled' WHERE id=? AND kind='transit_pickup' AND owner=?").bind(transitPickupKey(owner),owner)]);return transitJSON({cancelled:true})}
 if(path==='position'&&request.method==='POST'){
  if(profile.role!=='driver')return transitJSON({error:'Driver registration required.'},403);
  const b=await request.json(),p=transitPoint(b),route=await db.prepare('SELECT * FROM transit_routes WHERE id=?').bind(String(b.routeId)).first();if(!route)throw Error('Select a saved route.');
  if(!Number.isFinite(b.accuracy)||b.accuracy<0||b.accuracy>150)throw Error('Phone location accuracy must be 150 m or better.');
  const stops=JSON.parse(route.stops_json),nextStop=transitProgress(stops,p),key='TRANSIT-DUTY:'+owner;const duty=await db.prepare("SELECT id FROM siege_records WHERE id=? AND state='on_duty' AND json_extract(body_json,'$.tripId')=? AND json_extract(body_json,'$.routeId')=?").bind(key,String(b.tripId),route.id).first();if(!duty)return transitJSON({error:'This trip has ended or was replaced. Go on duty again.'},409);
  const speed=Number.isFinite(b.speed)&&b.speed>=0&&b.speed<=40?b.speed:null;
  await db.prepare(`INSERT INTO transit_positions(owner,route_id,lat,lon,accuracy,speed,next_stop,updated_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM siege_records WHERE id=? AND state='on_duty' AND json_extract(body_json,'$.tripId')=?) ON CONFLICT(owner) DO UPDATE SET route_id=excluded.route_id,lat=excluded.lat,lon=excluded.lon,accuracy=excluded.accuracy,speed=excluded.speed,next_stop=excluded.next_stop,updated_at=excluded.updated_at WHERE excluded.updated_at-transit_positions.updated_at>=3000`).bind(owner,route.id,p.lat,p.lon,b.accuracy,speed,nextStop,now,key,String(b.tripId)).run();const nearby=b.accuracy<=30?await transitNearby(db,account,p,[{id:route.id,stops}]):[];return transitJSON({shared:true,updatedAt:now,nextStop,detectedStop:nearby[0]||null,accuracyRequired:b.accuracy>30?30:null});
 }
 if(path==='wait'&&request.method==='POST'){if(!transitAccount)return transitJSON({error:'Register your Transit account first.'},403);if(!profile?.phone)return transitJSON({error:'Register your cellphone using Account first.'},403);
  const b=await request.json(),route=await db.prepare('SELECT * FROM transit_routes WHERE id=?').bind(String(b.routeId)).first();if(!route)throw Error('Select a route.');const stop=JSON.parse(route.stops_json).find(s=>s.id===b.stopId);if(!stop)throw Error('Choose a stop on this route.');
  const p=transitPoint(b);if(!Number.isFinite(b.accuracy)||b.accuracy>30||b.accuracy<0||transitDistance(p,stop)>300)throw Error('Use your phone at the selected stop (within 300 m, accuracy 30 m or better).');
  const destination=transitText(b.destination,2,120),signal=await transitPickupSignal(db,owner,route.id,stop.id,destination,now,now+1800000),expires=signal.expiresAt;await db.prepare('INSERT INTO transit_waiting(owner,route_id,stop_id,destination,expires_at) VALUES(?,?,?,?,?) ON CONFLICT(owner) DO UPDATE SET route_id=excluded.route_id,stop_id=excluded.stop_id,destination=excluded.destination,expires_at=excluded.expires_at').bind(owner,route.id,stop.id,destination,expires).run();return transitJSON({waiting:true,expiresAt:expires,requestId:signal.requestId,status:signal.status});
 }
 if(['pickup-response','capacity'].includes(path)&&request.method==='POST'){
  if(profile.role!=='driver')return transitJSON({error:'Driver registration required.'},403);
  const b=await request.json(),dutyRow=await db.prepare("SELECT body_json FROM siege_records WHERE id=? AND owner=? AND kind='transit_duty' AND state='on_duty'").bind('TRANSIT-DUTY:'+owner,owner).first(),duty=dutyRow&&JSON.parse(dutyRow.body_json);
  if(!duty||duty.tripId!==b.tripId)return transitJSON({error:'Go on duty for the current trip before responding.'},409);
  if(path==='capacity'){
   if(typeof b.full!=='boolean')throw Error('Choose your bus capacity status.');
   await db.prepare("UPDATE siege_records SET body_json=json_set(body_json,'$.capacity',?) WHERE id=? AND owner=? AND state='on_duty' AND json_extract(body_json,'$.tripId')=?").bind(b.full?'full':'available','TRANSIT-DUTY:'+owner,owner,duty.tripId).run();return transitJSON({capacity:b.full?'full':'available'});
  }
  if(!['accept','full'].includes(b.action)||typeof b.requestId!=='string')throw Error('Choose Accept pickup or Bus is full.');
  const row=await db.prepare("SELECT id,owner,state,body_json FROM siege_records WHERE kind='transit_pickup' AND json_extract(body_json,'$.requestId')=?").bind(b.requestId).first(),pickup=row&&JSON.parse(row.body_json);
  if(!pickup||pickup.routeId!==duty.routeId||pickup.expiresAt<=now||row.owner===owner||!['waiting','accepted'].includes(row.state))return transitJSON({error:'This pickup is no longer available on your route.'},409);
  if(row.state==='accepted'){if(pickup.tripId===duty.tripId&&pickup.driverOwner===owner&&b.action==='accept')return transitJSON({status:'accepted',plate:profile.plate});return transitJSON({error:'A driver has already accepted this pickup.'},409);}
  if(b.action==='accept'){
   if(duty.capacity==='full')return transitJSON({error:'Mark seats available before accepting another pickup.'},409);
   const position=await db.prepare('SELECT lat,lon,next_stop,updated_at FROM transit_positions WHERE owner=? AND route_id=?').bind(owner,duty.routeId).first(),routeRow=await db.prepare('SELECT stops_json FROM transit_routes WHERE id=?').bind(duty.routeId).first(),stops=routeRow?JSON.parse(routeRow.stops_json):[];
   if(!position||now-position.updated_at>120000)return transitJSON({error:'Share a fresh phone location before accepting a pickup.'},409);
   if(stops.findIndex(stop=>stop.id===pickup.stopId)<position.next_stop&&transitDistance(position,stops.find(stop=>stop.id===pickup.stopId))>300)return transitJSON({error:'This boarding stop is behind your bus.'},409);
   const result=await db.prepare("UPDATE siege_records SET state='accepted',body_json=json_set(body_json,'$.driverOwner',?,'$.tripId',?,'$.plate',?,'$.respondedAt',?) WHERE id=? AND state='waiting' AND json_extract(body_json,'$.requestId')=? AND json_extract(body_json,'$.expiresAt')>? AND EXISTS(SELECT 1 FROM siege_records WHERE id=? AND state='on_duty' AND json_extract(body_json,'$.tripId')=? AND coalesce(json_extract(body_json,'$.capacity'),'available')<>'full')").bind(owner,duty.tripId,profile.plate,now,row.id,pickup.requestId,now,'TRANSIT-DUTY:'+owner,duty.tripId).run();
   if(Number(result.meta?.changes??result.changes??0)!==1)return transitJSON({error:'The pickup changed or another driver accepted it. Refresh your requests.'},409);
   return transitJSON({status:'accepted',plate:profile.plate,requestId:pickup.requestId});
  }
  const response={requestId:pickup.requestId,tripId:duty.tripId,routeId:duty.routeId,plate:profile.plate,respondedAt:now};
  await db.batch([db.prepare("UPDATE siege_records SET body_json=json_set(body_json,'$.capacity','full') WHERE id=? AND owner=? AND state='on_duty' AND json_extract(body_json,'$.tripId')=?").bind('TRANSIT-DUTY:'+owner,owner,duty.tripId),db.prepare("INSERT INTO siege_records(id,kind,owner,state,created_at,body_json) SELECT ?,'transit_pickup_response',?,'full',?,? WHERE EXISTS(SELECT 1 FROM siege_records WHERE id=? AND state='waiting' AND json_extract(body_json,'$.requestId')=? AND json_extract(body_json,'$.expiresAt')>?) ON CONFLICT(id) DO UPDATE SET body_json=excluded.body_json").bind('TRANSIT-RESPONSE:'+pickup.requestId+':'+duty.tripId,owner,new Date(now).toISOString(),JSON.stringify(response),row.id,pickup.requestId,now)]);
  return transitJSON({status:'full',plate:profile.plate,requestId:pickup.requestId});
 }
 if(path==='dashboard'&&request.method==='GET'){
  const routeId=url.searchParams.get('routeId')||'',route=await db.prepare('SELECT * FROM transit_routes WHERE id=?').bind(routeId).first();if(!route)return transitJSON({buses:[],waiting:[],mine:null});const stops=JSON.parse(route.stops_json);
  const rows=(await db.prepare('SELECT p.*,r.plate FROM transit_positions p JOIN transit_profiles r ON p.owner=r.owner WHERE p.route_id=? AND p.updated_at>?').bind(routeId,now-600000).all()).results;
  const duties=(await db.prepare("SELECT owner,body_json FROM siege_records WHERE kind='transit_duty' AND state='on_duty' AND json_extract(body_json,'$.routeId')=?").bind(routeId).all()).results,dutyByOwner=new Map(duties.map(row=>[row.owner,JSON.parse(row.body_json)]));
  const buses=rows.map(b=>{const stale=now-b.updated_at>120000,estimates={};let distance=transitDistance(b,stops[b.next_stop]);for(let i=b.next_stop;i<stops.length;i++){if(i>b.next_stop)distance+=transitDistance(stops[i-1],stops[i]);estimates[stops[i].id]=stale?null:Math.max(1,Math.ceil(distance/((b.speed>=2?b.speed:8.33)*60)))}return {plate:b.plate,capacity:dutyByOwner.get(b.owner)?.capacity||'available',lat:b.lat,lon:b.lon,accuracy:b.accuracy,updatedAt:b.updated_at,stale,nextStop:b.next_stop,estimates}});
  const waiting=(await db.prepare('SELECT stop_id,COUNT(*) AS count FROM transit_waiting WHERE route_id=? AND expires_at>? GROUP BY stop_id').bind(routeId,now).all()).results;
  const mine=await transitMine(db,owner,now);let pickupRequests=[],driverCapacity=null;
  const myDuty=profile.role==='driver'?dutyByOwner.get(owner):null;
  if(myDuty){
   // Bring existing waiting signals into the response workflow without exposing identities.
   const legacy=(await db.prepare('SELECT owner,route_id,stop_id,destination,expires_at FROM transit_waiting WHERE route_id=? AND expires_at>? LIMIT 100').bind(routeId,now).all()).results;
   for(const waiting of legacy)await transitPickupSignal(db,waiting.owner,waiting.route_id,waiting.stop_id,waiting.destination,now,waiting.expires_at);
   const requests=(await db.prepare("SELECT owner,state,body_json FROM siege_records WHERE kind='transit_pickup' AND state IN ('waiting','accepted') AND json_extract(body_json,'$.routeId')=? AND json_extract(body_json,'$.expiresAt')>? LIMIT 100").bind(routeId,now).all()).results;
   pickupRequests=requests.map(row=>({owner:row.owner,state:row.state,data:JSON.parse(row.body_json)})).filter(row=>row.owner!==owner&&(row.state==='waiting'||row.data.driverOwner===owner&&row.data.tripId===myDuty.tripId)).map(row=>({requestId:row.data.requestId,status:row.state,stopId:row.data.stopId,destination:row.data.destination,createdAt:row.data.createdAt,expiresAt:row.data.expiresAt}));
   driverCapacity=myDuty.capacity||'available';
  }
  return transitJSON({buses,waiting,mine,pickupRequests,driverCapacity,etaNote:'Approximate: distance via ordered stop coordinates and phone speed (30 km/h fallback). No traffic or road-routing data.'});
 }
 return transitJSON({error:'Not found.'},404);
 }catch(e){if(/no such table|database|SQLITE/i.test(e.message))return transitJSON({error:'Transit is temporarily unavailable.'},503);return transitJSON({error:e.message||'Transit request failed.'},400)}
}

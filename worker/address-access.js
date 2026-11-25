// Browser registration tokens stay in HttpOnly cookies. Public IDs cannot authorise capture.
const ADDRESS_UNIT_CENTS=25; // Legacy orders retain their original price.
const ADDRESS_BUNDLES=[{id:'starter',quantity:25,amount:500,label:'Starter'},{id:'team',quantity:100,amount:1500,label:'Team'},{id:'business',quantity:500,amount:5000,label:'Business'}];
const ADDRESS_LOCAL_SERVICES={assisted:{label:'Assisted address capture',amount:299},sign:{label:'Physical address sign',amount:599},business:{label:'Business address pack',amount:999}};
const ADDRESS_COOKIE='__Host-sieg-address-browser';
const addressSMSReady=env=>!!(env.TWILIO_ACCOUNT_SID&&env.TWILIO_AUTH_TOKEN&&env.TWILIO_VERIFY_SERVICE_SID);
const addressCheckoutReady=env=>env.REPORT_CHECKOUT_ENABLED==='true'&&!!env.PAYGATE_ID&&!!env.PAYGATE_KEY&&(!env.PAYGATE_CURRENCY||env.PAYGATE_CURRENCY==='USD');
function addressDevicePublic(d){return {id:d.id,freeRemaining:3-d.free_used,paidRemaining:d.purchased-d.paid_used,used:d.free_used+d.paid_used}}
async function addressDevice(request,env){const token=(request.headers.get('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(ADDRESS_COOKIE+'='))?.slice(ADDRESS_COOKIE.length+1);if(!/^[a-f0-9]{64}$/.test(token||''))return null;const d=await env.DB.prepare('SELECT * FROM address_devices WHERE token_hash=?').bind(await reportSHA(token)).first();if(!d||d.owner!==reportOwner(request))return null;return d}
async function addressAccess(request,env,user){const device=await addressDevice(request,env);const phone=await env.DB.prepare('SELECT phone,verified_until FROM address_phone_verifications WHERE owner=?').bind(user).first();const devices=await env.DB.prepare('SELECT * FROM address_devices WHERE owner=? ORDER BY created_at DESC LIMIT 50').bind(user).all();return {device:device?addressDevicePublic(device):null,devices:devices.results.map(addressDevicePublic),unitCents:ADDRESS_UNIT_CENTS,bundles:ADDRESS_BUNDLES,currency:'USD',smsEnabled:addressSMSReady(env),paymentEnabled:addressCheckoutReady(env),verifiedPhone:phone?.verified_until>Date.now()?phone.phone:null}}
async function addressTwilio(env,endpoint,fields){const r=await fetch('https://verify.twilio.com/v2/Services/'+encodeURIComponent(env.TWILIO_VERIFY_SERVICE_SID)+'/'+endpoint,{method:'POST',headers:{Authorization:'Basic '+btoa(env.TWILIO_ACCOUNT_SID+':'+env.TWILIO_AUTH_TOKEN),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(fields),signal:AbortSignal.timeout(20000)});let d;try{d=await r.json()}catch{}if(!r.ok)throw Error('Mobile verification unavailable or expired. Check the number and try again later.');return d}
async function addressGrantPaid(env,order){
 if(order.kind!=='address_capture'||order.state!=='paid')return;
 // D1 batch is transactional. A unique grant and credited flag make callback/status retries safe.
 const stmts=[];for(const item of order.allocations){stmts.push(env.DB.prepare('INSERT INTO address_credit_grants(order_id,device_id,quantity) SELECT ?,?,? WHERE EXISTS (SELECT 1 FROM address_devices WHERE id=? AND owner=?) ON CONFLICT DO NOTHING').bind(order.id,item.deviceId,item.quantity,item.deviceId,order.owner));stmts.push(env.DB.prepare('UPDATE address_devices SET purchased=purchased+? WHERE id=? AND owner=? AND EXISTS (SELECT 1 FROM address_credit_grants WHERE order_id=? AND device_id=? AND credited=0)').bind(item.quantity,item.deviceId,order.owner,order.id,item.deviceId));stmts.push(env.DB.prepare('UPDATE address_credit_grants SET credited=1 WHERE order_id=? AND device_id=?').bind(order.id,item.deviceId))}await env.DB.batch(stmts);order.creditsActivated=true;await reportSave(env,order);
}
async function addressPurchase(request,env,user,p){
 if(!Array.isArray(p.allocations)||!p.allocations.length||p.allocations.length>10)throw Error('Enter one to ten registered browser IDs and the number of addresses for each.');
 let total=0;const ids=new Set(),allocations=[];for(const a of p.allocations){if(!/^SIEG-DV-[a-f0-9-]{36}$/.test(a.deviceId||'')||!Number.isSafeInteger(a.quantity)||a.quantity<1||a.quantity>100000||ids.has(a.deviceId))throw Error('Enter distinct browser IDs with positive whole address counts.');const d=await env.DB.prepare('SELECT id FROM address_devices WHERE id=? AND owner=?').bind(a.deviceId,user).first();if(!d)throw Error('Register each browser under your SIEG account before buying credits for it.');ids.add(a.deviceId);total+=a.quantity;allocations.push({deviceId:a.deviceId,quantity:a.quantity})}if(total>100000)throw Error('Contact SIEG for orders above 100,000 addresses.');
 if(!/^[a-f0-9-]{36}$/.test(p.requestId||''))throw Error('Invalid purchase reference.');
 const id='SIEG-'+await reportSHA(user+':address-capture:'+p.requestId).then(h=>h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20,32));let order=await reportRead(env,reportKey(id));
 const bundle=ADDRESS_BUNDLES.find(b=>b.id===p.bundleId);
 if(order&&(order.owner!==user||order.kind!=='address_capture'||JSON.stringify(order.allocations)!==JSON.stringify(allocations)||order.bundleId!==p.bundleId))throw Error('This reference belongs to a different bundle. Start a new request.');
 if(!order){
  if(!bundle||total!==bundle.quantity)throw Error('Select a prepaid bundle and allocate exactly its capture quantity.');
  const phone=await env.DB.prepare('SELECT phone,verified_until FROM address_phone_verifications WHERE owner=?').bind(user).first();if(!phone||phone.verified_until<=Date.now())return response({error:'Verify your mobile number by SMS before requesting addresses.'},403);
  if(!addressCheckoutReady(env))return response({error:'Address payments are not connected yet. Contact support@sieg.ltd. No paid credits have been unlocked.'},503);
  if(p.expectedAmount!==bundle.amount)return response({error:'The price changed. Review the bundle total and retry.'},409);
  if(typeof p.email!=='string'||p.email.length>200||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)||p.consent!==true)throw Error('Provide a valid receipt email and agree to the purchase.');
  // Each owner can start at most one new checkout per ten seconds.
  const slot='address/purchase-slots/'+await reportSHA(user)+'/'+Math.floor(Date.now()/10000);if(!await env.BUCKET.put(slot,'1',{onlyIf:{etagDoesNotMatch:'*'}}))return response({error:'Wait a few seconds before starting another checkout.'},429);
  order={id,owner:user,service:'address',kind:'address_capture',method:'card',contact:{name:'SIEG Address client',email:p.email.trim(),phone:phone.phone,dial:'',consent:true},verifiedPhone:phone.phone,allocations,quantity:total,bundleId:bundle.id,unitCents:bundle.amount/bundle.quantity,amount:bundle.amount,currency:'USD',state:'awaiting_payment',createdAt:new Date().toISOString()};await reportSave(env,order);
 }
 if(order.state==='paid'){await addressGrantPaid(env,order);return response(reportPublic(order))}
 if(order.paymentRequestId&&order.state!=='awaiting_payment')return response({error:'This payment was cancelled or declined. Start a new request.',...reportPublic(order)},409);
 if(!order.paymentRequestId){const origin=new URL(request.url).origin,fields={PAYGATE_ID:env.PAYGATE_ID,REFERENCE:id,AMOUNT:String(order.amount),CURRENCY:'USD',RETURN_URL:origin+'/report-payment.html?order='+id,TRANSACTION_DATE:new Date().toISOString().replace('T',' ').slice(0,19),LOCALE:'en-za',COUNTRY:'SWZ',EMAIL:order.contact.email,PAY_METHOD:'CC',PAY_METHOD_DETAIL:'Visa',NOTIFY_URL:origin+'/api/reports/paygate/notify'};const result=await reportGateway(env,'initiate',fields);if(result.PAYGATE_ID!==env.PAYGATE_ID||result.REFERENCE!==id||!result.PAY_REQUEST_ID)throw Error('Checkout could not be created. No credits were unlocked.');order.paymentRequestId=result.PAY_REQUEST_ID;order.paymentChecksum=result.CHECKSUM;await reportSave(env,order)}
 return response({...reportPublic(order),checkout:{url:'https://secure.paygate.co.za/payweb3/process.trans',fields:{PAY_REQUEST_ID:order.paymentRequestId,CHECKSUM:order.paymentChecksum}}});
}
async function addressAccessAPI(request,env,user){
 const path=new URL(request.url).pathname;if(!env.DB)return response({error:'Address access storage unavailable.'},503);
 if(path==='/api/address/access'&&request.method==='GET')return response(await addressAccess(request,env,user));
 if(request.method!=='POST')return response({error:'Method not allowed.'},405);
 if(request.headers.get('Origin')!==new URL(request.url).origin)return response({error:'Origin not allowed.'},403);
 const raw=await request.text();if(raw.length>6000)return response({error:'Request too large.'},413);const p=JSON.parse(raw||'{}');
 if(path==='/api/address/service-request'){
  if(p.service==='business')return addressBusinessCheckout(request,env,user,p);
  if(p.countryCode!=='SZ')return response({error:'Assisted capture, physical signs and business address packs are available only within Eswatini. Use Request SIEG Address for prepaid digital capture bundles elsewhere.'},400);
  const offer=Object.hasOwn(ADDRESS_LOCAL_SERVICES,p.service)?ADDRESS_LOCAL_SERVICES[p.service]:null;if(!offer)throw Error('Select an Eswatini address service.');
  if(p.consent!==true)throw Error('Consent to storing your service request is required.');
  const data={name:opsText(p.name,'name',100),email:opsEmail(p.email),product:'SIEG Address / '+offer.label,countryCode:'SZ',service:p.service,amount:offer.amount,currency:'SZL',location:opsText(p.location,'service location in Eswatini',300),phone:opsText(p.phone,'contact number',40)};
  data.message=offer.label+' · SZL '+offer.amount+' · Eswatini only\nLocation: '+data.location+'\nPhone: '+data.phone+'\n'+opsText(p.notes||'','notes',1000,true);
  if(!/^[a-f0-9-]{36}$/.test(p.requestId||''))throw Error('Invalid service request reference.');
  const old=await opsRead(env,opsKey('enquiries',p.requestId));if(old){if(old.owner!==user)throw Error('Invalid service request reference.');return response({id:old.id,message:'Your request is saved. SIEG will confirm arrangements before payment.'})}
  if(!env.BUCKET)return response({error:'Service requests are temporarily unavailable. Please retry.'},503);
  await opsRate(request,env);await opsStore(env,'enquiries',{id:p.requestId,owner:user,createdAt:new Date().toISOString(),state:'new',data});
  return response({id:p.requestId,message:'Your request is saved. SIEG will confirm arrangements before payment.'},201);
 }
 if(path==='/api/address/access'){
  const known=await addressDevice(request,env);if(known)return response(await addressAccess(request,env,user));
  const count=await env.DB.prepare('SELECT count(*) AS n FROM address_devices WHERE owner=? AND created_at>?').bind(user,new Date(Date.now()-3600000).toISOString()).first();if(count.n>=10)return response({error:'Too many browser registrations. Try later.'},429);
  const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join(''),id='SIEG-DV-'+crypto.randomUUID();await env.DB.prepare('INSERT INTO address_devices(id,owner,token_hash,created_at) VALUES(?,?,?,?)').bind(id,user,await reportSHA(token),new Date().toISOString()).run();
  const r=response({...await addressAccess(request,env,user),device:addressDevicePublic({id,free_used:0,purchased:0,paid_used:0})});r.headers.set('Set-Cookie',ADDRESS_COOKIE+'='+token+'; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=31536000');return r;
 }
 if(path==='/api/address/purchase'){if(!env.BUCKET)return response({error:'Payment storage unavailable.'},503);return addressPurchase(request,env,user,p)}
 if(!['/api/address/phone/send','/api/address/phone/check'].includes(path))return response({error:'Not found.'},404);
 if(!addressSMSReady(env))return response({error:'SMS verification is not connected yet. Contact support@sieg.ltd.'},503);
 const phone=typeof p.phone==='string'?p.phone.replace(/[ ()-]/g,''):'';if(!/^\+[1-9]\d{7,14}$/.test(phone))throw Error('Enter your mobile number with its country code, e.g. +26876000000.');
 if(path.endsWith('/send')){
  const now=Date.now(),day=new Date().toISOString().slice(0,10);const row=await env.DB.prepare('INSERT INTO address_phone_verifications(owner,phone,day,sent_at,sends) VALUES(?,?,?,?,1) ON CONFLICT(owner) DO UPDATE SET phone=excluded.phone,day=excluded.day,sent_at=excluded.sent_at,sends=CASE WHEN day=excluded.day THEN sends+1 ELSE 1 END,attempts=0,verified_until=0 WHERE sent_at<? AND (day<>excluded.day OR sends<5) RETURNING owner').bind(user,phone,day,now,now-60000).first();if(!row)return response({error:'Wait one minute between codes. A maximum of five SMS requests is allowed per day.'},429);
  const d=await addressTwilio(env,'Verifications',{To:phone,Channel:'sms'});if(d.status!=='pending'||d.to!==phone)throw Error('SMS verification could not be started.');return response({sent:true});
 }
 const check=await env.DB.prepare('UPDATE address_phone_verifications SET attempts=attempts+1 WHERE owner=? AND phone=? AND sent_at>? AND attempts<5 AND verified_until=0 RETURNING owner').bind(user,phone,Date.now()-600000).first();if(!check)return response({error:'Code expired or too many attempts. Request a new SMS code.'},429);
 if(typeof p.code!=='string'||!/^\d{4,10}$/.test(p.code))throw Error('Enter the code from your SMS.');
 const d=await addressTwilio(env,'VerificationCheck',{To:phone,Code:p.code});if(d.status!=='approved'||d.to!==phone)return response({error:'The SMS code is incorrect.'},400);
 await env.DB.prepare('UPDATE address_phone_verifications SET verified_until=? WHERE owner=? AND phone=?').bind(Date.now()+1800000,user,phone).run();return response({verifiedPhone:phone});
}

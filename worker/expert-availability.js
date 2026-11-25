// Availability belongs to the signed-in profile owner. Reminders go only to their verified account email.
const EXPERT_AVAILABILITY=['Available now','Within 2 weeks','Within 1 month','Not currently available','Contact me'];
const expertReminderInterval=90*86400000;
function expertAvailabilityData(request,b,now=Date.now()){
 if(!EXPERT_AVAILABILITY.includes(b.availability))throw Error('Choose your availability for work.');
 if(typeof b.availabilityReminders!=='boolean')throw Error('Choose whether to receive availability reminders.');
 const reminderEmail=b.availabilityReminders?opsEmail(request.headers.get('oai-authenticated-user-email')||''):null;
 return {availability:b.availability,availabilityConfirmedAt:new Date(now).toISOString(),availabilityReminders:b.availabilityReminders,reminderEmail,nextReminderAt:b.availabilityReminders?new Date(now+expertReminderInterval).toISOString():null};
}
async function expertAvailabilityAPI(request,env){
 const owner=opsUser(request);if(!owner)return opsJSON({error:'Sign in to update your expert profile.'},401);
 if(request.method==='GET'){
  const {results}=await env.DB.prepare("SELECT body_json FROM siege_records WHERE kind='experts' AND owner=? AND state IN ('pending_review','approved') ORDER BY created_at DESC LIMIT 100").bind(owner).all();
  return opsJSON({profiles:results.map(({body_json})=>{const r=JSON.parse(body_json),d=r.data;return {id:r.id,name:d.name,trade:d.customTrade||d.trade,availability:d.availability,availabilityConfirmedAt:d.availabilityConfirmedAt,availabilityReminders:d.availabilityReminders===true,nextReminderAt:d.nextReminderAt};})});
 }
 if(request.method!=='POST'||request.headers.get('Origin')!==new URL(request.url).origin)return opsJSON({error:'Request not allowed.'},403);
 const b=await opsBody(request);if(!opsId(b.id))throw Error('Choose your submitted expert profile.');
 const data=expertAvailabilityData(request,b);
 const result=await env.DB.prepare("UPDATE siege_records SET body_json=json_set(json_remove(body_json,'$.data.reminderClaim'),'$.data.availability',?,'$.data.availabilityConfirmedAt',?,'$.data.availabilityReminders',json(?),'$.data.reminderEmail',?,'$.data.nextReminderAt',?) WHERE kind='experts' AND id=? AND owner=? AND state IN ('pending_review','approved')").bind(data.availability,data.availabilityConfirmedAt,JSON.stringify(data.availabilityReminders),data.reminderEmail,data.nextReminderAt,b.id,owner).run();
 if(!result.meta?.changes)return opsJSON({error:'This profile is unavailable or belongs to another account.'},404);
 return opsJSON({message:'Availability updated.',...data,reminderEmail:undefined});
}
async function expertReminderRun(env,origin,options={},now=Date.now()){
 const ready=!!(env.DB&&reportMailReady(env));
 if(!ready)return {status:'configuration_missing',ready:false,missing:[...(!env.DB?['profile storage']:[]),...(!reportMailReady(env)?['RESEND_API_KEY and REPORT_FROM_EMAIL']:[])]};
 const cursor=options.cursor||'';if(cursor&&!opsId(cursor))throw Error('Invalid reminder cursor.');
 const due=new Date(now).toISOString(),stale=new Date(now-15*60000).toISOString();
 const where="kind='experts' AND state IN ('pending_review','approved') AND json_extract(body_json,'$.data.availabilityReminders')=1 AND json_extract(body_json,'$.data.reminderEmail') IS NOT NULL AND json_extract(body_json,'$.data.nextReminderAt')<=? AND (json_extract(body_json,'$.data.reminderClaim.at') IS NULL OR json_extract(body_json,'$.data.reminderClaim.at')<?)";
 if(options.dryRun){const row=await env.DB.prepare('SELECT COUNT(*) AS count FROM siege_records WHERE '+where).bind(due,stale).first();return {status:'ready',ready:true,dueProfiles:Number(row?.count||0),intervalDays:90};}
 const {results}=await env.DB.prepare('SELECT id,body_json FROM siege_records WHERE '+where+' AND id>? ORDER BY id LIMIT 11').bind(due,stale,cursor).all();
 let sent=0,failed=0,skipped=0,last=cursor;
 for(const row of results.slice(0,10)){
  last=row.id;const record=JSON.parse(row.body_json),d=record.data,token=crypto.randomUUID();
  const claim=await env.DB.prepare("UPDATE siege_records SET body_json=json_set(body_json,'$.data.reminderClaim',json(?)) WHERE kind='experts' AND id=? AND body_json=?").bind(JSON.stringify({token,at:due}),row.id,row.body_json).run();
  if(!claim.meta?.changes){skipped++;continue;}
  try{
   const fresh=await env.DB.prepare("SELECT 1 AS ok FROM siege_records WHERE kind='experts' AND id=? AND json_extract(body_json,'$.data.reminderClaim.token')=? AND json_extract(body_json,'$.data.availabilityReminders')=1 AND state IN ('pending_review','approved')").bind(row.id,token).first();
   if(!fresh){skipped++;continue;}
   const email=opsEmail(d.reminderEmail),link=new URL('/talent-pool.html#my-expert-profiles',origin).href;
   const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'expert-availability/'+row.id+'/'+Date.parse(d.nextReminderAt)},body:JSON.stringify({from:env.REPORT_FROM_EMAIL,to:[email],subject:'SIEG Experts · Confirm your work availability',text:'Hello '+d.name+',\n\nIt is time to confirm your work availability for your '+(d.customTrade||d.trade)+' profile. Your last status was: '+d.availability+'.\n\nSign in with the account that submitted your profile, then update or confirm your availability here:\n'+link+'\n\nYou can update your status at any time or switch off these 90-day reminders in My availability.\n\nSIEG Experts\nsupport@sieg.ltd'}),signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw Error('Email delivery unavailable.');
   await env.DB.prepare("UPDATE siege_records SET body_json=json_set(json_remove(body_json,'$.data.reminderClaim'),'$.data.lastReminderAt',?,'$.data.nextReminderAt',?) WHERE kind='experts' AND id=? AND json_extract(body_json,'$.data.reminderClaim.token')=?").bind(due,new Date(now+expertReminderInterval).toISOString(),row.id,token).run();sent++;
  }catch{
   failed++;await env.DB.prepare("UPDATE siege_records SET body_json=json_remove(body_json,'$.data.reminderClaim') WHERE kind='experts' AND id=? AND json_extract(body_json,'$.data.reminderClaim.token')=?").bind(row.id,token).run();
  }
  await new Promise(resolve=>setTimeout(resolve,550));
 }
 return {status:'ok',ready:true,sent,failed,skipped,more:results.length>10,cursor:results.length>10?last:null};
}

const GRADUATE_KIND='international_graduate';
let graduateCountryCodes,graduateTradeGroups;
function graduateTrade(p){
 if(p.trade==='Other trade')return {trade:p.trade,subTrade:opsText(p.customSubTrade,'sub-trade or field of study',120)};
 graduateTradeGroups??=new Map(estateJSON('assets/expert-trades.json').map(g=>[g.label,new Set(g.trades)]));
 const options=graduateTradeGroups.get(p.trade);
 if(!options)throw Error('Select a valid trade.');
 if(!options.has(p.subTrade))throw Error('Select a sub-trade from the chosen trade.');
 return {trade:p.trade,subTrade:p.subTrade};
}
function graduateCountry(code){
 if(!graduateCountryCodes)graduateCountryCodes=new Set(JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(EMBEDDED_FILES['agri/assets/countries.json'][1]),c=>c.charCodeAt(0)))).map(c=>c.code));
 if(!graduateCountryCodes.has(code))throw Error('Choose the country where you graduated.');
 return code;
}
async function graduateAPI(request,env){
 const u=new URL(request.url),owner=opsUser(request),path=u.pathname;
 if(!owner)return opsJSON({error:'Sign in to view or register graduates.'},401);
 if(!env.DB)return opsJSON({error:'Graduate directory is temporarily unavailable.'},503);
 if(request.method!=='GET'&&request.headers.get('Origin')!==u.origin)return opsJSON({error:'Origin not allowed.'},403);
 try{
  if(request.method==='GET'&&path==='/api/graduates/universities'){
   const country=graduateCountry(u.searchParams.get('country'));
   const rows=await env.DB.prepare("SELECT DISTINCT json_extract(body_json,'$.data.university') AS name FROM siege_records WHERE kind=? AND state='active' AND json_extract(body_json,'$.data.country')=? ORDER BY name COLLATE NOCASE LIMIT 300").bind(GRADUATE_KIND,country).all();
   return opsJSON({universities:rows.results.map(x=>x.name)});
  }
  if(request.method==='GET'&&path==='/api/graduates/distribution'){
   const rows=await env.DB.prepare("SELECT json_extract(body_json,'$.data.country') AS country,COUNT(DISTINCT owner) AS count FROM siege_records WHERE kind=? AND state='active' GROUP BY country ORDER BY country").bind(GRADUATE_KIND).all();
   return opsJSON({countries:rows.results});
  }
  if(path==='/api/graduates/availability'){
   if(request.method!=='POST')return opsJSON({error:'Method not allowed.'},405);
   const p=await opsBody(request);if(!/^GRADUATE-[a-f0-9]{64}$/.test(p.id||'')||!['Available now','Within 2 weeks','Within 1 month','Not currently available','Contact me','Not stated'].includes(p.availability))throw Error('Choose a valid record and work availability.');
   const result=await env.DB.prepare("UPDATE siege_records SET body_json=json_set(body_json,'$.data.availability',?,'$.data.availabilityConfirmedAt',?) WHERE kind=? AND id=? AND owner=?").bind(p.availability,new Date().toISOString(),GRADUATE_KIND,p.id,owner).run();
   return result.meta?.changes?opsJSON({ok:true}):opsJSON({error:'Graduate record not found.'},404);
  }
  if(path!=='/api/graduates')return opsJSON({error:'Not found.'},404);
  if(request.method==='GET'){
   const offset=Math.max(0,Math.min(10000,Number.parseInt(u.searchParams.get('offset'),10)||0));
   const selected=u.searchParams.get('country')||'',country=selected?graduateCountry(selected):'';
   const q=(u.searchParams.get('q')||'').trim().slice(0,120).toLowerCase();
   const rows=await env.DB.prepare("SELECT id,owner,body_json FROM siege_records WHERE kind=? AND state='active' AND (?='' OR json_extract(body_json,'$.data.country')=?) AND (?='' OR instr(lower(json_extract(body_json,'$.search')),?)>0) ORDER BY created_at DESC,id DESC LIMIT 25 OFFSET ?").bind(GRADUATE_KIND,country,country,q,q,offset).all();
   return opsJSON({graduates:rows.results.slice(0,24).map(r=>({id:r.id,own:r.owner===owner,...JSON.parse(r.body_json).data})),nextOffset:rows.results.length>24?offset+24:null});
  }
  if(request.method==='POST'){
   const p=await opsBody(request);
   if(p.consent!==true)throw Error('Confirm that you are an Eswatini graduate and agree to share your details.');
   const email=opsEmail(p.email),year=Number(p.year);
   if(!Number.isInteger(year)||year<1900||year>new Date().getUTCFullYear())throw Error('Enter a valid graduation year.');
   const data={name:opsText(p.name,'given name',80),surname:opsText(p.surname,'surname',80),country:graduateCountry(p.country),university:opsText(p.university,'university',160),...graduateTrade(p),year};
   if(!['Diploma','Bachelor','Master','Doctorate','Postdoc'].includes(p.level))throw Error('Select a valid level of study.');
   const identity=Object.values(data).join(' ').toLowerCase(),id='GRADUATE-'+await reportSHA(JSON.stringify([owner,identity]));
   data.level=p.level;if(p.availability!==undefined&&!['Available now','Within 2 weeks','Within 1 month','Not currently available','Contact me','Not stated'].includes(p.availability))throw Error('Choose your work availability.');data.availability=p.availability||'Not stated';data.availabilityConfirmedAt=p.availability?new Date().toISOString():null;const search=identity+' '+p.level.toLowerCase();
   const existing=await env.DB.prepare('SELECT id,body_json FROM siege_records WHERE kind=? AND id=? AND owner=?').bind(GRADUATE_KIND,id,owner).first();
   if(existing){const record=JSON.parse(existing.body_json);if(record.contactEmail!==email||record.data.level!==data.level||p.availability!==undefined&&record.data.availability!==data.availability){await opsRate(request,env);if(p.availability===undefined){data.availability=record.data.availability||'Not stated';data.availabilityConfirmedAt=record.data.availabilityConfirmedAt||null;}await opsStore(env,GRADUATE_KIND,{...record,contactEmail:email,data,search});}return opsJSON({id,existing:true});}
   await opsRate(request,env);
   await opsStore(env,GRADUATE_KIND,{id,owner,state:'active',createdAt:new Date().toISOString(),contactEmail:email,search,data});
   return opsJSON({id},201);
  }
  if(request.method==='DELETE'){
   const id=u.searchParams.get('id');
   if(!/^GRADUATE-[a-f0-9]{64}$/.test(id||''))throw Error('Invalid graduate record.');
   const result=await env.DB.prepare('DELETE FROM siege_records WHERE kind=? AND id=? AND owner=?').bind(GRADUATE_KIND,id,owner).run();
   return result.meta?.changes?opsJSON({ok:true}):opsJSON({error:'Graduate record not found.'},404);
  }
  return opsJSON({error:'Method not allowed.'},405);
 }catch(e){return opsJSON({error:e.message||'Graduate request failed.'},400);}
}

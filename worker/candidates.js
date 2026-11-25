// Candidate CVs stay outside public profile data; only authenticated administrators can download them.
function candidateProfile(body,kind,data){
 const p=body.candidateProfile||{},text=(v,max)=>opsText(typeof v==='string'?v:'','candidate information',max,true);
 const raw=p.experience,experience=kind==='experts'?data.experience:raw===''||raw==null?null:Number(raw);
 if(experience!==null&&(!Number.isInteger(experience)||experience<0||experience>80))throw Error('Enter years of experience between 0 and 80.');
 return {experience,studyCountry:kind==='international_graduate'?data.country:text(p.studyCountry,100),qualification:kind==='international_graduate'?data.level:text(p.qualification,160),skills:kind==='experts'?(data.skills||[]).join(', '):text(p.skills,2000)};
}
async function candidateCVSave(env,cv,id,created){
 if(!cv)return null;
 if(!env.BUCKET)throw Error('CV storage is unavailable.');
 if(typeof cv!=='object'||typeof cv.bytes!=='string'||cv.bytes.length>Math.ceil(4*1024*1024/3)*4||!(/^[A-Za-z0-9+/]+={0,2}$/).test(cv.bytes))throw Error('Attach a PDF CV no larger than 4 MB.');
 const bytes=Uint8Array.from(atob(cv.bytes),c=>c.charCodeAt(0));
 if(bytes.length>4*1024*1024||new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw Error('Attach a valid PDF CV no larger than 4 MB.');
 const key='operations/candidate-cv/'+id+'/'+crypto.randomUUID()+'.pdf';await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:'application/pdf'}});created.push(key);return {key,name:(String(cv.name||'SIEG-CV.pdf').replace(/[^A-Za-z0-9._ -]/g,'_').slice(0,120)||'SIEG-CV.pdf'),size:bytes.length};
}
async function candidateAdmin(request,env,url){
 if(!opsAdmin(request))return opsJSON({error:'Administrator access required.'},403);
 if(!env.DB)return opsJSON({error:'Candidate register unavailable.'},503);
 const id=url.searchParams.get('id')||'';
 const validId=v=>opsId(v)||/^GRADUATE-[a-f0-9]{64}$/.test(v);
 if(url.pathname.endsWith('/cv')){
  if(request.method!=='GET'||!validId(id))return opsJSON({error:'Invalid CV request.'},400);
  const row=await env.DB.prepare("SELECT body_json FROM siege_records WHERE id=? AND kind IN ('experts','international_graduate')").bind(id).first();const cv=row&&JSON.parse(row.body_json).candidateCV;
  if(!cv||!env.BUCKET)return opsJSON({error:'CV not found.'},404);
  const file=await env.BUCKET.get(cv.key);if(!file)return opsJSON({error:'CV not found.'},404);
  return new Response(file.body,{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="'+cv.name+'"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }
 if(request.method==='POST'){
  if(request.headers.get('Origin')!==url.origin)return opsJSON({error:'Origin not allowed.'},403);
  const body=await opsBody(request);if(!validId(body.id)||typeof body.shortlisted!=='boolean')throw Error('Choose a candidate and shortlist action.');
  const row=await env.DB.prepare("UPDATE siege_records SET body_json=json_set(body_json,'$.candidateShortlisted',json(?)) WHERE id=? AND kind IN ('experts','international_graduate') RETURNING id").bind(body.shortlisted?'true':'false',body.id).first();
  return row?opsJSON({id:row.id,shortlisted:body.shortlisted}):opsJSON({error:'Candidate not found.'},404);
 }
 if(request.method!=='GET')return opsJSON({error:'Method not allowed.'},405);
 const param=k=>(url.searchParams.get(k)||'').trim().slice(0,160).toLowerCase(),kind=param('kind'),sector=param('sector'),country=param('country'),qualification=param('qualification'),q=param('q'),only=param('shortlisted')==='true',cursor=url.searchParams.get('cursor')||'',minRaw=param('experience'),min=minRaw===''?null:Number(minRaw);
 if(!['','experts','international_graduate'].includes(kind)||cursor&&!validId(cursor)||min!==null&&(!Number.isInteger(min)||min<0||min>80))throw Error('Choose valid candidate filters.');
 const catalogue=estateJSON('assets/expert-trades.json'),tradeMap=new Map(catalogue.flatMap(g=>g.trades.map(t=>[t.toLowerCase(),g.label])));const allowedTrades=catalogue.filter(g=>g.label.toLowerCase().includes(sector)).flatMap(g=>g.trades.map(t=>t.toLowerCase()));
 const countryList=estateJSON('assets/countries-global.json');const countryCodes=countryList.filter(c=>String(c.name||c.label||'').toLowerCase().includes(country)||String(c.code||'').toLowerCase()===country).map(c=>String(c.code||'').toLowerCase());
 const sql="SELECT id,kind,state,body_json FROM siege_records WHERE kind IN ('experts','international_graduate') AND (?='' OR kind=?) AND (?='' OR id>?) AND (?=0 OR json_extract(body_json,'$.candidateShortlisted')=1) AND (?='' OR instr(lower(coalesce(json_extract(body_json,'$.data.trade'),'')),?)>0 OR lower(json_extract(body_json,'$.data.trade')) IN (SELECT value FROM json_each(?))) AND (? IS NULL OR coalesce(json_extract(body_json,'$.candidateProfile.experience'),json_extract(body_json,'$.data.experience'),-1)>=?) AND (?='' OR instr(lower(coalesce(json_extract(body_json,'$.candidateProfile.studyCountry'),json_extract(body_json,'$.data.country'),'')),?)>0 OR lower(coalesce(json_extract(body_json,'$.candidateProfile.studyCountry'),json_extract(body_json,'$.data.country'),'')) IN (SELECT value FROM json_each(?))) AND (?='' OR instr(lower(coalesce(json_extract(body_json,'$.candidateProfile.qualification'),json_extract(body_json,'$.data.level'),'')),?)>0) AND (?='' OR instr(lower(coalesce(json_extract(body_json,'$.data.trade'),'')||' '||coalesce(json_extract(body_json,'$.data.subTrade'),'')||' '||coalesce(json_extract(body_json,'$.data.customTrade'),'')||' '||coalesce(json_extract(body_json,'$.candidateProfile.skills'),json_extract(body_json,'$.data.skills'),'')||' '||coalesce(json_extract(body_json,'$.data.university'),'')),?)>0) ORDER BY id LIMIT 51";
 const {results}=await env.DB.prepare(sql).bind(kind,kind,cursor,cursor,only?1:0,sector,sector,JSON.stringify(allowedTrades),min,min,country,country,JSON.stringify(countryCodes),qualification,qualification,q,q).all();
 const page=results.slice(0,50);return opsJSON({candidates:page.map(row=>{const r=JSON.parse(row.body_json),d=r.data||{},p=r.candidateProfile||{};return {id:row.id,kind:row.kind,state:row.state,name:[d.name,d.surname].filter(Boolean).join(' '),sector:tradeMap.get(String(d.trade).toLowerCase())||d.trade,trade:d.subTrade||d.customTrade||d.trade,experience:p.experience??d.experience??null,studyCountry:p.studyCountry||d.country||'',qualification:p.qualification||d.level||'',university:d.university||'',skills:p.skills||(Array.isArray(d.skills)?d.skills.join(', '):''),email:r.contactEmail||d.email||'',shortlisted:r.candidateShortlisted===true,cv:r.candidateCV?{name:r.candidateCV.name}:null}}),cursor:results.length>50?page.at(-1).id:null});
}

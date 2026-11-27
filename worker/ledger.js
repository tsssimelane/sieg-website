// Owner-scoped field records, stored separately from analysis purchases.
async function ledgerReportBoundary(env,owner,reference){
 const ref=String(reference||'').trim().toUpperCase();
 if(!/^SIEG-RPT-[A-F0-9]{32}$/.test(ref))throw Error('Enter the complete SIEG Fields report reference.');
 if(!env.BUCKET)throw Error('Report archive is unavailable.');
 const record=await reportRead(env,'reports/references/'+ref+'.json');
 if(!record||record.owner!==owner||record.service!=='fields'||record.state!=='ready')throw Error('Completed SIEG Fields report not found in your account.');
 let geometry=record.geometry;if(geometry?.type==='FeatureCollection')geometry={type:'MultiPolygon',coordinates:geometry.features.flatMap(f=>f.geometry?.type==='Polygon'?[f.geometry.coordinates]:f.geometry?.type==='MultiPolygon'?f.geometry.coordinates:[])};
 const boundary=usageGeometry(geometry);return {...boundary,reference:ref,year:record.year};
}
async function ledgerAPI(request,env){
 const owner=reportOwner(request),url=new URL(request.url);if(!owner)return opsJSON({error:'Sign in to save and retrieve your fields.'},401);if(!env.DB)return opsJSON({error:'Ledger storage is unavailable.'},503);
 const id=url.searchParams.get('id');
 try{
 if(request.method==='GET'){
  if(id){const row=await env.DB.prepare("SELECT body_json FROM siege_records WHERE kind='ledger_field' AND owner=? AND id=?").bind(owner,id).first();if(row)return opsJSON({field:JSON.parse(row.body_json)});if(/^SIEG-RPT-[A-F0-9]{32}$/i.test(id)){const r=await ledgerReportBoundary(env,owner,id);return opsJSON({report:{reference:r.reference,geometry:r.geometry,areaHa:r.areaKm2*100,year:r.year}});}return opsJSON({error:'Field not found.'},404);}
  const rows=await env.DB.prepare("SELECT body_json FROM siege_records WHERE kind='ledger_field' AND owner=? ORDER BY created_at DESC LIMIT 500").bind(owner).all();return opsJSON({fields:rows.results.map(r=>JSON.parse(r.body_json))});
 }
 if(request.method!=='POST')return opsJSON({error:'Method not allowed.'},405);
 if(request.headers.get('Origin')!==url.origin)return opsJSON({error:'Origin not allowed.'},403);
 const raw=await request.text();if(raw.length>1500000)throw Error('Field record is too large. Simplify your boundary.');
 const input=JSON.parse(raw),existing=input.id?await env.DB.prepare("SELECT body_json FROM siege_records WHERE kind='ledger_field' AND owner=? AND id=?").bind(owner,input.id).first():null;
 if(input.id&&!existing)return opsJSON({error:'Field not found.'},404);
 const previous=existing?JSON.parse(existing.body_json):null;
 const g=previous?{geometry:previous.geometry,areaKm2:previous.areaHa/100,reference:previous.reportReference}:await ledgerReportBoundary(env,owner,input.reportReference);
 const country=previous?.country||String(input.country||'').toUpperCase();if(!/^[A-Z]{2}$/.test(country))throw Error('Select a country code.');
 const name=previous?.name||g.reference||'',farm=opsText(input.farm||'','farm name',100,true);
 if(!Array.isArray(input.seasons)||input.seasons.length>100)throw Error('Invalid growing seasons.');
 const bounded=(v,max=100)=>String(v??'').slice(0,max),num=(v)=>{const n=Number(v);if(!Number.isFinite(n)||n<0||n>1e12)throw Error('Enter a valid non-negative quantity or price.');return n;};
 const seasons=input.seasons.map(s=>{
  if(!Array.isArray(s.operations)||s.operations.length>500||!Array.isArray(s.expenses)||s.expenses.length>2000)throw Error('Too many operations or expenses.');
  const area=g.areaKm2*100;if(!area)throw Error('Field boundary area is unavailable.');
  const operations=s.operations.map(o=>({id:bounded(o.id),type:bounded(o.type),item:bounded(o.item),unit:bounded(o.unit,30),rate:num(o.rate),area:num(o.area),repeats:num(o.repeats),price:num(o.price),date:bounded(o.date,20),done:!!o.done,remaining:num(o.remaining??0)}));
  if(operations.some(o=>o.area>area+0.00001))throw Error('Operation area cannot exceed the cultivated area.');
  const expenses=s.expenses.map(e=>({id:bounded(e.id),operation:bounded(e.operation),date:bounded(e.date,20),item:bounded(e.item),amount:num(e.amount),supplier:bounded(e.supplier),reference:bounded(e.reference),notes:bounded(e.notes,300)}));
  return {id:bounded(s.id),name:bounded(s.name),crop:bounded(s.crop),variety:bounded(s.variety),system:bounded(s.system),planting:bounded(s.planting,20),harvest:bounded(s.harvest,20),area,yield:s.yield==null?null:num(s.yield),price:s.price==null?null:num(s.price),currency:/^[A-Z]{3}$/.test(s.currency)?s.currency:'USD',assumptionSources:Object.fromEntries(['harvest','yield','price'].filter(k=>s.assumptionSources?.[k]).map(k=>[k,{kind:bounded(s.assumptionSources[k].kind,20),label:bounded(s.assumptionSources[k].label,500),url:bounded(s.assumptionSources[k].url,300)}])),operations,expenses};
 });
 const field={id:previous?.id||g.reference,reportReference:previous?.reportReference||g.reference||null,country,name,farm,geometry:g.geometry,areaHa:g.areaKm2*100,seasons,createdAt:previous?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
 if(previous&&input.updatedAt!==previous.updatedAt)return opsJSON({error:'This field was changed elsewhere. Refresh before saving.'},409);
 if(previous){const result=await env.DB.prepare("UPDATE siege_records SET body_json=? WHERE kind='ledger_field' AND owner=? AND id=? AND json_extract(body_json,'$.updatedAt')=?").bind(JSON.stringify(field),owner,field.id,previous.updatedAt).run();if(result.meta?.changes===0)return opsJSON({error:'Field changed elsewhere. Refresh before saving.'},409);}
 else await env.DB.prepare("INSERT INTO siege_records(id,kind,owner,state,created_at,body_json) VALUES(?,'ledger_field',?,'active',?,?)").bind(field.id,owner,field.createdAt,JSON.stringify(field)).run();
 return opsJSON({field});
 }catch(e){return opsJSON({error:e.message||'Unable to save field.'},400);}
}

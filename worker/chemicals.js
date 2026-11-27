// Private, owner-scoped agricultural input records. No treatment prescriptions.
const chemicalCategories=['Fertiliser','Herbicide','Insecticide','Fungicide','Biological input','Soil amendment','Other approved input'];
async function chemicalsAPI(request,env){
 const owner=reportOwner(request),url=new URL(request.url);
 if(!owner)return opsJSON({error:'Sign in to access your farm workspace.'},401);
 if(!env.DB)return opsJSON({error:'Farm record storage unavailable.'},503);
 const fieldsQuery=()=>env.DB.prepare("SELECT body_json FROM siege_records WHERE kind='ledger_field' AND owner=? ORDER BY created_at DESC LIMIT 500").bind(owner).all();
 try{
  if(request.method==='GET'){
   const [f,r]=await Promise.all([fieldsQuery(),env.DB.prepare("SELECT body_json FROM siege_records WHERE kind='chemical_record' AND owner=? ORDER BY created_at DESC LIMIT 2000").bind(owner).all()]);
   return opsJSON({fields:f.results.map(x=>JSON.parse(x.body_json)),records:r.results.map(x=>JSON.parse(x.body_json))});
  }
  if(request.method!=='POST')return opsJSON({error:'Method not allowed.'},405);
  if(request.headers.get('Origin')!==url.origin)return opsJSON({error:'Origin not allowed.'},403);
  const raw=await request.text();if(raw.length>20000)throw Error('Record is too large.');
  const x=JSON.parse(raw),field=await env.DB.prepare("SELECT body_json FROM siege_records WHERE kind='ledger_field' AND owner=? AND id=?").bind(owner,String(x.fieldId||'')).first();
  if(!field)throw Error('Select a registered field from your own Ledger account.');
  const f=JSON.parse(field.body_json),s=f.seasons.find(v=>v.id===x.seasonId);if(!s)throw Error('Select a saved growing season.');
  const str=(v,n=100)=>String(v??'').trim().slice(0,n),qty=v=>{const n=Number(v);if(!Number.isFinite(n)||n<0||n>1e9)throw Error('Invalid recorded quantity.');return n;};
  const type=str(x.type);if(!['receipt','application','inspection'].includes(type))throw Error('Invalid record type.');
  const date=str(x.date,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date)))throw Error('Choose a valid date.');
  const category=str(x.category),product=str(x.product),unit=str(x.unit,20);
  if(type!=='inspection'&&(!chemicalCategories.includes(category)||!product||!['kg','L','units'].includes(unit)))throw Error('Provide the recorded product, category and unit.');
  const quantity=type==='inspection'?0:qty(x.quantity);if(type!=='inspection'&&quantity<=0)throw Error('Record a positive actual quantity.');
  const record={id:crypto.randomUUID(),type,fieldId:f.id,reference:f.reportReference,seasonId:s.id,crop:s.crop,country:f.country,farm:f.farm,date,category:type==='inspection'?'':category,product:type==='inspection'?'':product,unit:type==='inspection'?'':unit,quantity,cost:type==='inspection'?0:qty(x.cost||0),currency:s.currency,person:str(x.person),notes:str(x.notes,500),createdAt:new Date().toISOString()};
  if(!record.person)throw Error('Enter the name of the person recording or performing the operation.');
  await env.DB.prepare("INSERT INTO siege_records(id,kind,owner,state,created_at,body_json) VALUES(?,'chemical_record',?,'active',?,?)").bind(record.id,owner,record.createdAt,JSON.stringify(record)).run();
  return opsJSON({record});
 }catch(e){return opsJSON({error:e.message||'Unable to save record.'},400);}
}

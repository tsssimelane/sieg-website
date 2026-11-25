(()=>{
 'use strict';
 const $=id=>document.getElementById(id),form=$('graduateForm'),country=$('graduateCountry'),university=$('graduateUniversity'),filter=$('graduateCountryFilter'),other=$('graduateOtherUniversity'),list=$('graduateList'),more=$('graduateMore'),labels=new Map();
 let universityRequest=0,listRequest=0,nextOffset=null,query='';
 const trade=$('graduateTrade'),subTrade=$('graduateSubTrade'),customSubTrade=$('graduateCustomSubTrade'),otherTrade='Other trade';
 const tradeGroups=new Map(JSON.parse($('expertTradeCatalogue').textContent).map(g=>[g.label,g.trades]));
 for(const label of [...tradeGroups.keys(),otherTrade])trade.add(new Option(label,label));
 function subTrades(){
  const custom=trade.value===otherTrade,options=tradeGroups.get(trade.value)||[];
  subTrade.replaceChildren(new Option(trade.value?'Select sub-trade':'Choose a trade first',''),...options.map(t=>new Option(t,t)));
  subTrade.disabled=!options.length;subTrade.closest('label').hidden=custom;
  $('graduateCustomSubTradeField').hidden=!custom;
  customSubTrade.disabled=!custom;customSubTrade.required=custom;customSubTrade.value='';
 }
 trade.addEventListener('change',subTrades);subTrades();
 const status=(id,text)=>$(id).textContent=text;
 $('graduateYear').max=String(new Date().getUTCFullYear());
 async function api(path,options){
  const res=await fetch('/api/graduates'+path,options),data=await res.json();
  if(!res.ok)throw Error(data.error||'Graduate directory unavailable.');
  return data;
 }
 const countriesReady=fetch('agri/assets/countries.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(rows=>{
  country.replaceChildren(new Option('Select country',''));
  const first=rows.find(c=>c.code==='SZ');
  for(const c of [...(first?[first]:[]),...rows.filter(c=>c.code!=='SZ')]){labels.set(c.code,c.name);country.add(new Option(c.name,c.code));filter.add(new Option(c.name,c.code));}
 }).catch(()=>{country.replaceChildren(new Option('Countries unavailable',''));status('graduateFormStatus','Country list could not load. Refresh to try again.');});
 function otherField(){const show=university.value==='__other';$('graduateOtherField').hidden=!show;other.disabled=!show;other.required=show;}
 async function universities(){
  const ticket=++universityRequest,code=country.value;
  university.replaceChildren(new Option(code?'Loading universities…':'Choose a country first',''));university.disabled=true;other.value='';otherField();
  if(!code)return;
  let names=[];
  try{names=(await api('/universities?country='+encodeURIComponent(code))).universities;}
  catch{if(ticket===universityRequest)status('graduateFormStatus','University suggestions could not load. You can enter the name manually.');}
  if(ticket!==universityRequest)return;
  university.replaceChildren(new Option('Select university',''));
  for(const name of names)university.add(new Option(name,name));
  university.add(new Option('Add a university…','__other'));university.disabled=false;
 }
 country.addEventListener('change',universities);university.addEventListener('change',otherField);
 function record(g){
  const el=document.createElement('article'),heading=document.createElement('h4'),education=document.createElement('p'),subject=document.createElement('p');
  el.className='graduate-record';heading.textContent=g.name+' '+g.surname;education.textContent=g.university+' · '+(labels.get(g.country)||g.country)+' · '+g.year;subject.textContent=[g.level,g.trade??g.department,g.subTrade??g.major].filter(Boolean).join(' · ');
  el.append(heading,education,subject);const availability=document.createElement('p');availability.className='graduate-availability';availability.textContent='Work availability: '+(g.availability||'Not stated')+(g.availabilityConfirmedAt?' · updated '+new Date(g.availabilityConfirmedAt).toLocaleDateString():'');el.append(availability);
  if(g.own){const label=document.createElement('label'),select=document.createElement('select'),save=document.createElement('button');label.textContent='Update work availability';for(const value of ['Not stated','Available now','Within 2 weeks','Within 1 month','Not currently available','Contact me'])select.add(new Option(value,value));select.value=g.availability||'Not stated';label.append(select);save.type='button';save.textContent='Save availability';save.onclick=async()=>{save.disabled=true;try{await api('/availability',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:g.id,availability:select.value})});await load();status('graduateListStatus','Availability updated.');}catch(e){status('graduateListStatus',e.message);save.disabled=false;}};el.append(label,save);const remove=document.createElement('button');remove.type='button';remove.textContent='Remove my record';remove.onclick=async()=>{
   if(!confirm('Remove this graduation record from the directory?'))return;
   remove.disabled=true;
   try{await api('?id='+encodeURIComponent(g.id),{method:'DELETE'});await Promise.all([load(),refreshMap()]);}
   catch(e){remove.disabled=false;status('graduateListStatus',e.message);}
  };el.append(remove);}
  return el;
 }
 async function load(append=false){
  const ticket=++listRequest,offset=append?nextOffset:0;
  if(offset===null)return;
  more.disabled=true;
  try{
   const d=await api('?'+new URLSearchParams({offset:String(offset),q:query,country:filter.value}));
   await countriesReady;if(ticket!==listRequest)return;
   if(!append)list.replaceChildren();
   list.append(...d.graduates.map(record));nextOffset=d.nextOffset;more.hidden=nextOffset===null;
   status('graduateListStatus',list.children.length?list.children.length+' record(s) shown':query||filter.value?'No matching graduates.':'No graduate records yet.');
  }catch(e){if(ticket===listRequest)status('graduateListStatus',e.message);}
  finally{if(ticket===listRequest)more.disabled=false;}
 }
 $('graduateSearchForm').onsubmit=e=>{e.preventDefault();query=$('graduateSearch').value.trim();load();};more.onclick=()=>load(true);filter.onchange=()=>{world.select(filter.value);load();};
 const candidateAttachment=window.SiegCandidateCV.mount(form,'graduate',form.querySelector('.graduate-consent'));
 form.onsubmit=async e=>{
  e.preventDefault();const button=form.querySelector('[type=submit]'),fields=new FormData(form);
  const p=Object.fromEntries(fields);p.consent=fields.has('consent');if(p.university==='__other')p.university=p.otherUniversity;delete p.otherUniversity;
  button.disabled=true;status('graduateFormStatus','Saving graduation record…');
  try{Object.assign(p,await candidateAttachment());const d=await api('',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)});form.reset();universities();subTrades();query='';filter.value='';world.select('');$('graduateSearch').value='';status('graduateFormStatus',d.existing?'This graduation record is already in the directory.':'Your graduation record was added.');await Promise.all([load(),refreshMap()]);}
  catch(e){status('graduateFormStatus',e.message);}
  finally{button.disabled=false;}
 };
 const world=window.SiegGraduateMap.mount($('graduateWorldMap'),$('graduateMapStatus'),labels,code=>{filter.value=code;filter.onchange();});
 async function refreshMap(){await countriesReady;await world.refresh(()=>api('/distribution'));}
 load();refreshMap();
})();

(()=>{
'use strict';
const offers={
 'location-report':{label:'Property location report',price:'E450',scope:'An automatic report of approved listings for your selected area, property category and Sale or Rental.'},
 'land-screening':{label:'Land and farm screening report',price:'E1,500',scope:'An automatic report of approved land or farm listings for your selected area and Sale or Rental.'},
 'assisted-listing':{label:'Assisted listing',price:'From E1,000',scope:'Available only for properties in Eswatini. Includes a site visit, photos, GPS capture and listing preparation. Travel outside Manzini and Matsapha is quoted separately.'}
};
const dialog=document.createElement('dialog');
dialog.className='entry-modal';
dialog.setAttribute('aria-labelledby','estateServiceHeading');
dialog.innerHTML='<button type="button" class="close-entry" style="float:right" aria-label="Close">×</button><h2 id="estateServiceHeading">Request SIEG Estate Report</h2><p>See the report fee in the payment window. Assisted listings are invoiced separately.</p><form><label>Service<select name="offer"></select></label><p id="estateOfferDescription"></p><div id="estateReportFilters"><label>Sale or Rental<select name="transaction" required><option value="sale">Sale</option><option value="rental">Rental</option></select></label><label>Country<select name="countryCode"></select></label><label>Administrative area (ADM2)<select name="admin2Id"></select></label><label id="estateManualArea" hidden>Administrative area name<input name="admin2Manual" maxlength="120" placeholder="District, municipality or equivalent"></label><p id="estateAreaStatus" role="status"></p><label>Property category<select name="category"><option value="">Choose a category</option><option>Residential</option><option>Commercial</option><option>Land</option><option>Agricultural</option></select></label></div><label>Property location <span id="estateLocationOptional">(optional)</span><input name="location" maxlength="240" placeholder="Village / town, or map coordinates"></label><label id="estateEswatiniOnly" class="estate-consent" hidden><input type="checkbox" name="eswatiniConfirmed" disabled> I confirm the property is located in Eswatini.</label><label>Your name<input name="name" autocomplete="name" required maxlength="100"></label><label>Email<input name="email" type="email" autocomplete="email" required maxlength="200"></label><label>Phone (optional)<input name="phone" type="tel" autocomplete="tel" maxlength="40"></label><label>What should we check? (optional)<textarea name="notes" maxlength="1500"></textarea></label><label class="estate-consent"><input type="checkbox" name="consent" required> I agree that SIEG may store this request and contact me about it.</label><p><span id="estatePaymentNote"></span></p><button type="submit" class="solid">Send request</button></form><p role="status" aria-live="polite"></p>';
document.body.append(dialog);
const form=dialog.querySelector('form'),fields=form.elements,status=dialog.querySelector('[role=status]'),submit=form.querySelector('[type=submit]'),close=dialog.querySelector('.close-entry');
let reference='',areaTicket=0,areasPending=false;
const country=fields.countryCode,area=fields.admin2Id,manual=fields.admin2Manual,category=fields.category,areaStatus=dialog.querySelector('#estateAreaStatus');
document.getElementById('propertyAssisted')?.addEventListener('click',()=>window.requestEstateService('assisted-listing'));
const isReport=()=>fields.offer.value!=='assisted-listing';
function countries(preferred='SZ'){country.replaceChildren(...estateCountries.map(c=>new Option(c.name,c.code)));country.value=preferred;if(!country.value)country.value='SZ';}
const areaCache=new Map();
close.onclick=()=>dialog.close();
Object.entries(offers).forEach(([id,offer])=>fields.offer.add(new Option(offer.label+' · '+offer.price,id)));
function describe(){
 const report=isReport(),offer=offers[fields.offer.value];
 dialog.querySelector('#estateOfferDescription').textContent=offer.scope;
 for(const option of fields.offer.options){const item=offers[option.value];option.textContent=item.label+' · '+(option.value!=='assisted-listing'?'Fee shown at checkout':item.price)}
 dialog.querySelector('#estateReportFilters').hidden=!report;
 dialog.querySelector('#estateLocationOptional').hidden=!report;
 fields.location.required=!report;
 dialog.querySelector('#estateEswatiniOnly').hidden=report;
 fields.eswatiniConfirmed.disabled=report;fields.eswatiniConfirmed.required=!report;
 fields.transaction.disabled=country.disabled=category.disabled=!report;
 dialog.querySelector('#estatePaymentNote').textContent=report?'Choose how to pay in the next window. For card payments, the report is generated after payment is verified. It covers SIEG Estate listings and does not verify title, value or legal boundaries.':'SIEG will confirm scope and invoice you separately.';
 submit.textContent=report?'Continue to payment':'Send request';country.required=category.required=report;
 syncArea();
}
function syncArea(){
 const report=isReport(),useManual=report&&area.value==='manual';
 area.disabled=!report;area.required=report;
 manual.disabled=!useManual;manual.required=useManual;
 dialog.querySelector('#estateManualArea').hidden=!useManual;
 submit.disabled=areasPending&&report||form.dataset.sending==='true';
}
async function loadAreas(preferred='',name=''){
 const ticket=++areaTicket,key=country.value;
 area.replaceChildren(new Option('Loading administrative areas…',''));
 areaStatus.textContent='';areasPending=true;syncArea();
 try{
  let list=areaCache.get(key);
  if(!list){
   const r=await fetch('../api/property/report-areas?country='+encodeURIComponent(key),{signal:AbortSignal.timeout(45000)}),d=await r.json();
   if(!r.ok)throw Error(d.error);
   list=d.areas;areaCache.set(key,list);
  }
  if(ticket!==areaTicket)return;
  area.replaceChildren(new Option('Choose an administrative area',''),...list.map(x=>new Option(x.name,x.id)),new Option('Enter area name manually','manual'));
  const match=list.find(x=>x.id===preferred)||list.find(x=>x.name===name);
  if(match)area.value=match.id;
  if(!list.length)areaStatus.textContent='No ADM2 areas are listed for this country. Enter the administrative area name.';
 }catch{
  if(ticket!==areaTicket)return;
  area.replaceChildren(new Option('Enter area name manually','manual'));
  manual.value=name;
  areaStatus.textContent='ADM2 areas could not be loaded. Enter the administrative area name or change the country and try again.';
 }finally{if(ticket===areaTicket){areasPending=false;syncArea()}}
}
area.onchange=()=>{reference='';syncArea()};category.onchange=fields.transaction.onchange=()=>{reference=''};
country.onchange=()=>{reference='';fields.location.value='';manual.value='';describe();loadAreas()};
fields.offer.onchange=()=>{if(!isReport()){if(country.value!=='SZ')fields.location.value='';reference='';fields.eswatiniConfirmed.checked=false;}describe();if(isReport()&&!area.options.length)loadAreas()};
window.requestEstateService=(offer='location-report',context={})=>{
 if(submit.disabled)return;
 form.reset();form.hidden=false;status.textContent='';
 fields.offer.value=offer;
 countries(context.countryCode||'SZ');category.value=context.category||'';fields.transaction.value=context.transaction||$('transaction').value||'sale';
 area.replaceChildren();++areaTicket;areasPending=false;
 fields.location.value=context.location||'';
 reference=context.listing||'';
 describe();
 if(isReport()){
  const ticket=areaTicket;
  loadAreas(context.admin2Id,context.admin2);
  estateCountriesReady.then(()=>{if(areaTicket!==ticket+1)return;const before=country.value;countries(context.countryCode||before);if(country.value!==before){describe();loadAreas(context.admin2Id,context.admin2)}});
 }
 if(!dialog.open)dialog.showModal();
};
document.getElementById('estateDrawerReport')?.addEventListener('click',()=>window.requestEstateService());
function openButton(label,callback){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=callback;return b}
window.addEventListener('message',e=>{
 if(e.origin!==location.origin||e.source!==parent)return;
 if(e.data?.type==='sieg-estate-open-assisted')window.requestEstateService('assisted-listing');
 if(e.data?.type==='sieg-estate-open-report'){
  const p=properties.find(row=>row.id===selected);
  window.requestEstateService(p&&['Agricultural','Land'].includes(p.type)?'land-screening':'location-report',reportContext(p));
 }
});
function reportContext(p){return p?{listing:p.state==='approved'?p.id:'',transaction:p.transaction||'sale',countryCode:p.countryCode||'SZ',admin2Id:p.admin2Id,admin2:p.admin2,category:p.type,location:[p.city,p.region,p.country||'Eswatini'].filter(Boolean).join(', ')}:{}}
const detail=report;
report=id=>{
 detail(id);
 const p=properties.find(row=>row.id===id);
 if(!p)return;
 const actions=document.createElement('div');actions.className='entry-actions';
 actions.append(openButton('Request SIEG Estate Report',()=>window.requestEstateService(['Agricultural','Land'].includes(p.type)?'land-screening':'location-report',reportContext(p))));
 $('dialogBody').append(actions);
};
form.onsubmit=async e=>{
 e.preventDefault();form.dataset.sending='true';syncArea();status.textContent='Sending request…';
 try{
  const body={...Object.fromEntries(new FormData(form)),listing:reference,consent:fields.consent.checked};
  if(!isReport()){body.countryCode='SZ';body.eswatiniConfirmed=fields.eswatiniConfirmed.checked;}
  const r=await fetch('../api/property/service-requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d=await r.json();
  if(!r.ok)throw Error(d.error||'Could not send the request.');
  if(isReport()){
   if(!window.SiegeDelivery?.open)throw Error("The payment window could not load. Refresh SIEG Estate and try again.");
   dialog.close();
   window.SiegeDelivery.open({kind:'report',service:'estate',estateRequestId:d.id,contact:body,selectedReports:[body.transaction==='rental'?'Rental':'Sale',body.category]});
  }else{form.hidden=true;status.textContent=d.message+' Reference: '+d.id+'.';}

 }catch(err){status.textContent=err.message;}
 finally{delete form.dataset.sending;syncArea();}
};
})();

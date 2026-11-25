(()=>{
 const form=document.getElementById('weeklyCropForm'),status=document.getElementById('weeklyCropStatus'),stop=document.getElementById('weeklyCropStop');
 const zoneField=document.getElementById('weeklyCropZoneField'),zoneNote=document.getElementById('weeklyCropZoneNote'),zoneSelect=form.elements.zone;
 const endpoint='/api/weekly-crop';
 const browserZone=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
 zoneSelect.replaceChildren(new Option(browserZone,browserZone));zoneField.hidden=true;zoneNote.textContent='Your time zone: '+browserZone.replaceAll('_',' ')+' · detected from your browser.';
 function display(d){
  if(d.profile){
   document.getElementById('weeklyCropPrice').textContent=d.prices?new Intl.NumberFormat(undefined,{style:'currency',currency:d.profile.currency,currencyDisplay:'code'}).format(d.prices.monthly):'Price unavailable';
   document.getElementById('weeklyCropPricingNote').textContent=d.prices?(d.profile.source==='fallback'?'USD display · location unavailable':d.profile.name+' · local pricing · '+d.profile.currency):'Local pricing is temporarily unavailable. Reload to retry.';
  }

  document.getElementById('weeklyCropSaveSchedule').hidden=!['requested','active'].includes(d.state);
  if(d.schedule){form.elements.day.value=String(d.schedule.day);form.elements.time.value=d.schedule.time;
   if(d.schedule.zone){zoneNote.textContent='Your time zone: '+browserZone.replaceAll('_',' ')+(d.schedule.zone!==browserZone?' · saved schedule uses '+d.schedule.zone+' until you save changes.':' · detected from your browser.');}
   else if(['requested','active'].includes(d.state))zoneNote.textContent='Save your schedule using your detected browser time zone.';
  }
  stop.hidden=!['requested','active'].includes(d.state);
  status.textContent=d.message||(d.state==='active'?'Weekly updates active through '+d.paidThrough.slice(0,10)+'.':d.state==='requested'?'Plan requested. Contact support@sieg.ltd for payment and activation. Reference: '+(d.id||'')+'':'');
 }
 fetch(endpoint,{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Pricing unavailable.');return d;}).then(display).catch(e=>{document.getElementById('weeklyCropPrice').textContent='—';document.getElementById('weeklyCropPricingNote').textContent=e.message;});
 async function send(data){
  for(const b of form.querySelectorAll('button'))b.disabled=true;stop.disabled=true;
  status.textContent='Working…';
  try{const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}),d=await r.json();if(d.zones?.length){
    zoneSelect.replaceChildren(new Option('Choose the field’s time zone',''),...d.zones.map(z=>new Option(z.replaceAll('_',' '),z)));
    zoneField.hidden=false;zoneNote.textContent=d.country+' has more than one time zone. Select the one for your field.';
    status.textContent=d.error||'';zoneSelect.focus();return;
   }if(!r.ok)throw Error(d.error);display(d);}
  catch(e){status.textContent=e.message||'Crop monitoring is temporarily unavailable.'}
  finally{for(const b of form.querySelectorAll('button'))b.disabled=false;stop.disabled=false;}
 }
 form.onsubmit=e=>{
  e.preventDefault();
  const action=e.submitter?.value||'request';
  const {day,time,email,consent}=form.elements;
  const schedule={day:Number(day.value),time:time.value,zone:zoneSelect.value};
  if(action!=='sample'&&(!day.reportValidity()||!time.reportValidity()))return;
  if(action==='schedule'){send({action,schedule});return;}
  if(!email.reportValidity()||!consent.reportValidity())return;
  const current=window.SiegeUsage?.getGeometry?.(),g=current?.toGeoJSON?current.toGeoJSON():current;
  if(!g){status.textContent='Draw or upload the field boundary first.';return;}
  send({action,email:email.value,consent:consent.checked,geometry:g,schedule});
 };
 stop.onclick=()=>send({action:'stop'});
})();

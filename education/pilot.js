(()=>{
 const $=id=>document.getElementById(id),form=$('learnPilotForm'),status=$('learnPilotStatus'),endpoint='/api/education/pilot';
 const titles={studio:'Teacher studio',pack:'Revision pack',school:'School pack'};
 let offer,profile,prices;
 const billingStatus=$('learnBillingStatus');
 const money=(amount,currency)=>new Intl.NumberFormat(undefined,{style:'currency',currency,currencyDisplay:'code'}).format(amount);
 const itemTitle=o=>o.offer==='pack'&&o.subject?o.subject+' · '+o.grade:titles[o.offer];
 function billing(d){
  profile=d.profile;prices=d.prices;
  for(const node of document.querySelectorAll('[data-learn-price]')){
   node.textContent=prices?money(prices[node.dataset.learnPrice],profile.currency):'—';
   const block=node.closest('.learn-plan-price-block');if(block){let base=block.querySelector('.learn-base-price');if(!base){base=document.createElement('small');base.className='learn-base-price';block.append(base);}base.textContent=d.basePrices&&profile?.currency!==d.baseCurrency?'Base: '+money(d.basePrices[node.dataset.learnPrice],d.baseCurrency):'';base.hidden=!base.textContent;}
  }
  billingStatus.textContent=profile?(prices?(profile.source==='fallback'?'USD base prices · location unavailable':profile.name+' · local pricing')+' · '+profile.currency:'Local pricing is temporarily unavailable. Try again later.'):'Local prices are loading.';
 }
 const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 async function api(path='',data){
  const r=await fetch(endpoint+path,data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{cache:'no-store'});
  const d=await r.json();if(!r.ok)throw Error(d.error||'Request unavailable.');return d;
 }
 function orders(list){
  $('learnPilotOrders').replaceChildren(...list.map(o=>{
   const row=el('p',itemTitle(o)+' · '+money(o.price,o.currency)+' · '+(o.state==='requested'?'Requested · Reference '+o.id:o.until?'Access through '+new Date(o.until).toLocaleDateString():'Access unlocked'));
   if(o.offer==='pack'&&o.state==='active'){const link=el('a','Download pack ↗');link.href=endpoint+'/pack?id='+encodeURIComponent(o.id);row.append(' · ',link);}
   return row;
  }));
 }
 document.querySelectorAll('[data-learn-offer]').forEach(button=>button.onclick=()=>{
  if(!profile||!prices){status.textContent='Local pricing is unavailable. Reload the page to try again.';return;}
  offer=button.dataset.learnOffer;form.reset();form.hidden=false;
  $('learnPilotTitle').textContent=titles[offer];$('learnPilotSchoolLabel').hidden=offer!=='school';form.elements.school.required=offer==='school';$('learnPilotPackFields').hidden=offer!=='pack';form.elements.subject.required=form.elements.grade.required=offer==='pack';
  form.scrollIntoView({block:'nearest'});form.elements[offer==='school'?'school':offer==='pack'?'subject':'teacher'].focus();
 });
 form.onsubmit=async e=>{
  e.preventDefault();const submit=form.querySelector('button');submit.disabled=true;
  try{const saved=await api('',{offer,teacher:form.elements.teacher.checked,school:form.elements.school.value,subject:form.elements.subject.value,grade:form.elements.grade.value});
   status.textContent=saved.state==='requested'?(offer==='school'?'School pack interest recorded.':saved.custom?'Request saved. SIEG will confirm when the pack is ready before asking for payment.':'Request saved. Contact support@sieg.ltd with your reference for payment instructions.'):'This offer is already unlocked.';
   form.hidden=true;orders((await api()).orders);
  }catch(e){status.textContent=e.message}finally{submit.disabled=false}
 };
 async function admin(){
  const d=await api('/admin'),list=$('learnPilotAdminList');
  list.replaceChildren(...d.orders.map(o=>{
   const box=el('article'),title=el('strong',itemTitle(o)+' · '+o.email),detail=el('p',money(o.price,o.currency)+' · '+o.state+(o.school?' · '+o.school:'')+' · '+o.id);
   box.append(title,detail);
   if(o.offer==='school'||o.state==='active'&&(!o.until||Date.parse(o.until)>Date.now()))return box;
   const f=el('form'),label=el('label','Verified payment reference'),input=el('input'),checkLabel=el('label','I confirmed receipt of '+money(o.price,o.currency)+' for this request.'),check=el('input'),submit=el('button','Activate access');
   input.required=true;input.maxLength=100;check.type='checkbox';check.required=true;checkLabel.className='learn-pilot-consent';label.append(input);checkLabel.prepend(check);f.append(label,checkLabel,submit);
   const pdf=el('input');if(o.custom){const l=el('label','Matching pack PDF (up to 4 MB)');pdf.type='file';pdf.accept='application/pdf,.pdf';pdf.required=true;l.append(pdf);f.prepend(l);}
   box.append(f);
   f.onsubmit=async e=>{e.preventDefault();submit.disabled=true;try{
    let payload={id:o.id,paymentReference:input.value,confirmPayment:check.checked};
    if(o.custom){const file=pdf.files[0];if(!file||file.size>4*1024*1024)throw Error('Choose a PDF of 4 MB or less.');
     const encoded=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('Could not read PDF.'));reader.readAsDataURL(file);});payload.pdf=encoded;}
    await api('/admin',payload);await admin();orders((await api()).orders);window.dispatchEvent(new Event('sieg-learn-access-changed'));}catch(e){status.textContent=e.message;submit.disabled=false;}};
   return box;
  }));$('learnPilotAdmin').hidden=false;
 }
 let loaded=false;document.querySelector('[data-view="teacher-plans"]').addEventListener('click',()=>{if(loaded)return;loaded=true;api().then(d=>{billing(d);orders(d.orders)}).catch(e=>{status.textContent=e.message});admin().catch(()=>{});});
})();

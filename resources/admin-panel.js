(() => {
'use strict';
const panel=document.getElementById('admin-panel'),nav=document.getElementById('adminPanelNav');
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
async function api(path,body){
 const r=await fetch(path,{cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 const d=await r.json();if(!r.ok)throw Error(d.error||'Request failed.');return d;
}
function organise(){
 const groups=[...panel.querySelectorAll('.admin-group')],links=[...panel.querySelectorAll('.admin-workspace-nav a')];
 function sync(){for(const a of links){const active=document.getElementById(a.getAttribute('aria-controls'))?.open;if(active)a.setAttribute('aria-current','true');else a.removeAttribute('aria-current');}}
 function reveal(target){if(!target)return;const chain=[];for(let n=target;n;n=n.parentElement)if(n.tagName==='DETAILS')chain.unshift(n);for(const n of chain)n.open=true;sync();}
 function hash(){let id;try{id=decodeURIComponent(location.hash.slice(1))}catch{return}const target=document.getElementById(id);if(target&&panel.contains(target))reveal(target);}
 for(const group of groups)group.addEventListener('toggle',sync);
 panel.addEventListener('click',event=>{const a=event.target.closest('a[href^="#"]');if(!a)return;const target=document.getElementById(a.getAttribute('href').slice(1));if(target&&panel.contains(target))reveal(target);});
 window.addEventListener('hashchange',hash);hash();sync();
}
function review(section){
 const kind=section.dataset.reviewKind,path='/api/operations/admin?kind='+encodeURIComponent(kind)+(section.dataset.reviewProduct?'&product='+encodeURIComponent(section.dataset.reviewProduct):section.dataset.reviewProductGroup?'&productGroup='+encodeURIComponent(section.dataset.reviewProductGroup):''),list=section.querySelector('[data-review-records]'),status=section.querySelector('[data-review-status]'),refresh=section.querySelector('[data-review-load]');
 function card(record){
  const entry=el('article');entry.className='resource-review-entry';entry.dataset.reviewState=record.state;const d=record.data||{},state=el('p',record.state.replaceAll('_',' '));state.className='admin-state';state.dataset.state=record.state;
  entry.append(el('h3',d.title||d.name||record.id),state,el('p','Submitted: '+new Date(record.createdAt).toLocaleDateString()));
  const fields=el('dl');for(const [k,v] of Object.entries(d)){
   if(v==null||v===''||['title',...(['estate_requests','briefs'].includes(kind)?[]:['name']),'photos','photo',...(kind==='briefs'?[]:['shortlist'])].includes(k))continue;
   const label=k.replace(/([A-Z])/g,' $1');fields.append(el('dt',label[0].toUpperCase()+label.slice(1)),el('dd',Array.isArray(v)?v.join(', '):typeof v==='object'?JSON.stringify(v):String(v)));
  }
  if(record.contactEmail)fields.append(el('dt','Account contact'),el('dd',record.contactEmail));
  entry.append(fields);
  for(const url of [...(Array.isArray(d.photos)?d.photos:[]),d.photo].filter(x=>typeof x==='string'&&(x.startsWith('/api/operations/media/')||x.startsWith('/api/property/media/')))){const img=el('img');img.src=url;img.alt='Submitted photo';img.loading='lazy';img.width=100;img.height=100;img.style.objectFit='cover';entry.append(img);}
  const actions=el('div');actions.className='resource-actions';
  const decisions=['estate_requests','briefs','enquiries'].includes(kind)?[...(kind==='enquiries'&&d.product==='SIEG Transit Bundle Access'?[['approved','Approve bundle access'],['revoked','Revoke bundle access']]:[]),['contacted','Mark contacted'],['closed','Close request']]:[['approved',kind==='address'?'Approve address review':['business','graduates'].includes(kind)?'Restore visibility eligibility':'Approve publication'],['rejected',kind==='address'?'Reject address review':['business','graduates'].includes(kind)?'Hide from directory':'Reject / unpublish']];
  for(const [action,label] of decisions){
   const button=el('button',label);button.type='button';button.disabled=record.state===action;
   button.onclick=async()=>{
    const controls=[...actions.querySelectorAll('button')];controls.forEach(b=>b.disabled=true);
    try{const result=await api(path,{id:record.id,action});record.state=result.state;state.textContent=result.state.replaceAll('_',' ');state.dataset.state=result.state;entry.dataset.reviewState=result.state;filter();status.textContent='Review saved.';}
    catch(e){status.textContent=e.message;}
    finally{controls.forEach((b,i)=>b.disabled=record.state===decisions[i][0]);}
   };actions.append(button);
  }
  entry.append(actions);return entry;
 }
 const select=section.querySelector('[data-review-filter]');function filter(){const value=select?.value||'all';for(const item of list.querySelectorAll('[data-review-state]'))item.hidden=value!=='all'&&item.dataset.reviewState!==value;}if(select)select.onchange=filter;
 async function load(cursor='',previous){
  refresh.disabled=true;if(previous)previous.disabled=true;status.textContent='Loading submissions…';
  try{
   const data=await api(path+(cursor?'&cursor='+encodeURIComponent(cursor):''));
   if(!cursor)list.replaceChildren();else previous?.remove();
   for(const record of data.records)list.append(card(record));
   if(data.cursor){const more=el('button','Load more');more.type='button';more.onclick=()=>load(data.cursor,more);list.append(more);}
   filter();status.textContent=data.records.length?list.querySelectorAll('[data-review-state]').length+' records loaded · filters apply to loaded records.':'No submissions to show.';
   refresh.textContent='Refresh submissions';
  }catch(e){status.textContent=e.message;if(previous)previous.disabled=false;}
  finally{refresh.disabled=false;}
 }
 refresh.onclick=()=>load();
 const disclosure=section.closest('details');
 disclosure?.addEventListener('toggle',()=>{if(disclosure.open&&refresh.textContent!=='Refresh submissions'&&!refresh.disabled)load()});
 if(disclosure?.open)load();
}
function moderation(){
 const path='/api/education/moderation',refresh=document.getElementById('learnModerationLoad'),status=document.getElementById('learnModerationStatus'),list=document.getElementById('learnModerationRecords');
 function card(flag){
  const entry=el('article');entry.className='resource-review-entry';
  entry.append(el('h3',flag.message?.nickname||'Study group message'),el('p','Report reason: '+flag.reason));
  entry.append(el('p',flag.message?.text||'The message is no longer available.'));
  const actions=el('div');actions.className='resource-actions';entry.append(actions);
  for(const [remove,label] of [[true,'Remove message'],[false,'Dismiss report']]){
   if(remove&&!flag.message)continue;
   const b=el('button',label);b.type='button';actions.append(b);
   b.onclick=async()=>{
    if(remove&&!confirm('Remove this message from its study group?'))return;
    const controls=[...actions.querySelectorAll('button')];controls.forEach(x=>x.disabled=true);
    try{await api(path,{flag:flag.id,remove});entry.remove();status.textContent=remove?'Message removed and report closed.':'Report dismissed.';if(!list.childElementCount)status.textContent+=' No more reports on this page.';}
    catch(e){status.textContent=e.message;controls.forEach(x=>x.disabled=false);}
   };
  }
  return entry;
 }
 refresh.onclick=async()=>{
  refresh.disabled=true;status.textContent='Loading reports…';
  try{const {flags}=await api(path);list.replaceChildren(...flags.map(card));status.textContent=flags.length?'Review the reports below.':'No reports awaiting review.';refresh.textContent='Refresh reports';}
  catch(e){status.textContent=e.message;}
  finally{refresh.disabled=false;}
 };
}
function businessSubscriptions(){
 const filter=document.getElementById('adminBusinessSubscriptionFilter'),loadButton=document.getElementById('adminBusinessSubscriptionLoad'),list=document.getElementById('adminBusinessSubscriptionRecords'),status=document.getElementById('adminBusinessSubscriptionStatus');let ticket=0;
 const labels={active:'Active paid',ending:'Paid · renewal stopped',trial:'Active trial',pending:'Pending payment',expired:'Expired',ended:'Ended',unpaid:'No paid plan'},date=value=>value?new Date(value).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}):'—';
 async function load(cursor='',more){const id=++ticket;loadButton.disabled=true;if(more)more.disabled=true;status.textContent='Loading business subscriptions…';try{const data=await api('/api/operations/admin?kind=business_subscriptions&status='+encodeURIComponent(filter.value)+(cursor?'&cursor='+encodeURIComponent(cursor):''));if(id!==ticket)return;if(!cursor)list.replaceChildren();else more?.remove();for(const r of data.records){const card=el('article');card.className='resource-review-entry';const state=el('p',labels[r.status]||r.status);state.className='admin-state';state.dataset.state=r.paidActive?'approved':r.status==='pending'?'pending_review':r.status==='expired'?'rejected':r.status;card.append(el('h3',r.name),state);const fields=el('dl');for(const [key,value] of [['Business reference',r.id],['Contact email',r.email||'—'],['Trade category',r.category||'—'],['Directory',r.visible?'Visible':'Not listed'],['Publication consent',r.publishConsent?'Granted':'Not granted'],['Moderation',r.adminHidden?'Hidden':'Not hidden'],['Payment receipt',r.paymentVerified?'Verified in saved billing record':'Not verified'],['Trial ends',date(r.trialUntil)],['Paid through',date(r.paidUntil)],['Renewal',r.renewal],['Last billing sync',date(r.syncedAt)]])fields.append(el('dt',key),el('dd',value));card.append(fields);list.append(card);}if(data.cursor){const more=el('button','Load more subscriptions');more.type='button';more.onclick=()=>load(data.cursor,more);list.append(more);}status.textContent=(list.querySelectorAll('article').length+' matching records loaded. ')+(data.billingAvailable?'':'Annual checkout is not currently enabled. ')+data.note;loadButton.textContent='Refresh subscriptions ↻';}catch(error){if(id===ticket)status.textContent=error.message;if(more)more.disabled=false;}finally{if(id===ticket)loadButton.disabled=false;}}
 loadButton.onclick=()=>load();filter.onchange=()=>load();
}
function paidQueues(){
 const money=(amount,currency)=>{try{return new Intl.NumberFormat(undefined,{style:'currency',currency}).format(amount)}catch{return currency+' '+amount}};
 for(const kind of ['Learn','Weekly']){
  const endpoint=kind==='Learn'?'/api/education/pilot/admin':'/api/weekly-crop/admin',button=document.getElementById('admin'+kind+'Load'),list=document.getElementById('admin'+kind+'Records'),status=document.getElementById('admin'+kind+'Status');
  async function load(){button.disabled=true;status.textContent='Loading requests…';try{const data=await api(endpoint),rows=data.orders||data.plans||[];list.replaceChildren();for(const row of rows){const card=el('article');card.className='resource-review-entry';card.append(el('h3',kind==='Learn'?({studio:'Teacher studio',pack:'Revision pack',school:'School pack'}[row.offer]||'Learn request'):'Weekly crop monitoring'),el('p',row.id),el('p',(row.email||'')+(row.school?' · '+row.school:'')+' · '+row.state+' · '+money(row.price,row.currency||'USD')));if(kind==='Learn'&&(row.offer==='school'||row.state==='active'&&(!row.until||Date.parse(row.until)>Date.now()))){card.append(el('p',row.offer==='school'?'Arrange separate school onboarding.':'Access already active.'));list.append(card);continue;}
   const form=el('form'),checkLabel=el('label','I verified receipt of '+money(row.price,row.currency||'USD')+' for this activation.'),check=el('input');check.type='checkbox';check.required=true;checkLabel.className='admin-confirm';checkLabel.prepend(check);let reference,pdf;
   if(kind==='Learn'){const label=el('label','Verified payment reference');reference=el('input');reference.required=true;reference.maxLength=100;label.append(reference);form.append(label);if(row.custom){const l=el('label','Matching revision pack PDF · up to 4 MB');pdf=el('input');pdf.type='file';pdf.accept='.pdf,application/pdf';pdf.required=true;l.append(pdf);form.append(l)}}
   const submit=el('button',kind==='Learn'?'Activate access':row.state==='active'?'Renew paid month':'Activate paid month');submit.type='submit';submit.disabled=kind==='Weekly'&&!data.ready;form.append(checkLabel,submit);if(kind==='Weekly'&&!data.ready)form.append(el('p','Email delivery configuration is not ready.'));
   form.onsubmit=async event=>{event.preventDefault();submit.disabled=true;try{const payload={id:row.id,confirmPayment:check.checked};if(reference)payload.paymentReference=reference.value.trim();if(pdf){const f=pdf.files[0];if(!f||f.size>4*1024*1024)throw Error('Choose a PDF up to 4 MB.');payload.pdf=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('Could not read PDF.'));reader.readAsDataURL(f)})}await api(endpoint,payload);await load();status.textContent='Access updated after your payment confirmation.';}catch(error){status.textContent=error.message;submit.disabled=false}};card.append(form);list.append(card);
  }status.textContent=rows.length?rows.length+' requests loaded.':'No requests to show.';}catch(error){status.textContent=error.message}finally{button.disabled=false}}
  button.onclick=load;
 }
}
function summary(){
 const period=document.getElementById('adminSummaryDays'),refresh=document.getElementById('adminSummaryRefresh'),status=document.getElementById('adminSummaryStatus'),metrics=document.getElementById('adminSummaryMetrics');let loaded=false,ticket=0;
 const format=n=>Number(n||0).toLocaleString(),continents={AF:'Africa',AN:'Antarctica',AS:'Asia',EU:'Europe',NA:'North America',OC:'Oceania',SA:'South America'};let names;try{names=new Intl.DisplayNames(['en'],{type:'region'})}catch{}
 function table(target,rows,kind){const host=document.getElementById(target);host.replaceChildren();if(!rows.length){host.append(el('p','No activity recorded for this period.'));return}const table=el('table'),head=el('thead'),tr=el('tr');for(const title of [kind==='country'?'Country':kind==='continent'?'Continent':'Service','Page views','Service views','Requests','Pending']){const th=el('th',title);th.scope='col';tr.append(th)}head.append(tr);table.append(head);const body=el('tbody');for(const row of rows){const tr=el('tr'),name=kind==='country'?(row.name==='Unknown'?'Unknown':names?.of(row.name)||row.name):kind==='continent'?(continents[row.name]||row.name):row.name;const title=el('th',name);title.scope='row';tr.append(title);for(const key of ['visits','serviceVisits','requests','pending'])tr.append(el('td',kind==='service'&&key==='visits'?'—':format(row[key])));body.append(tr)}table.append(body);host.append(table)}
 function database(data){if(!data)return;const host=document.getElementById('adminDatabaseCards');host.replaceChildren();const b=data.business,g=data.graduates,x=data.specialists;
  for(const entry of [{label:'SIEG Business',count:b.visible,total:b.registered,caption:'visible locations / registered profiles',details:[['Paid listings',b.paid],['7-day trial listings',b.trial],['Saved, not listed',b.unlisted]]},{label:'SIEG Experts',count:x.available,total:x.registered,caption:'available now / registered profiles',details:[['Approved profiles',x.visible],['Awaiting review',x.pending]]},{label:'International graduates',count:g.available,total:g.registered,caption:'available now / registered people',details:[['Visible people',g.visible],['Education records',g.records],['Availability not stated',g.unstated]]}]){const card=el('article');card.className='admin-register-card';card.append(el('h4',entry.label));const value=el('div');value.className='admin-register-value';value.append(el('strong',format(entry.count)),el('span','/ '+format(entry.total)));card.append(value,el('p',entry.caption));const ratio=el('progress');ratio.max=Math.max(Number(entry.total),1);ratio.value=Number(entry.count)||0;ratio.setAttribute('aria-label',entry.label+' '+entry.caption);card.append(ratio);const details=el('dl');for(const [label,n] of entry.details)details.append(el('dt',label),el('dd',format(n)));card.append(details);host.append(card);}
  const plans=document.getElementById('adminSubscriptionCards');plans.replaceChildren();for(const plan of data.subscriptions||[]){const card=el('article');card.className='admin-register-card admin-plan-card';card.dataset.plan=plan.id;const modes={subscription:'Subscription',request:'Enquiry only',waitlist:'Waitlist',onboarding:'Separate onboarding','one-off':'One-off access'},paid=plan.mode==='subscription'||plan.mode==='one-off';const badge=el('span',modes[plan.mode]);badge.className='admin-plan-badge';card.append(badge,el('h4',plan.title));const value=el('div');value.className='admin-register-value';value.append(el('strong',format(paid?plan.active:plan.pending)),el('span','/ '+format(plan.total)));card.append(value,el('p',paid?'active / saved plan records':'open requests / saved requests'));const details=el('dl');const fields=paid?[['Pending payment / activation',plan.pending],['Expired',plan.expired],['Stopped / closed',plan.stopped]]:[['Closed / stopped',plan.stopped]];if(plan.id==='business')fields.unshift(['Active trials',plan.trial]);if(plan.other)fields.push(['Other / check record',plan.other]);for(const [label,n] of fields)details.append(el('dt',label),el('dd',format(n)));card.append(details);const note=el('p',plan.note);note.className='admin-plan-note';card.append(note);plans.append(card);}
  const region=code=>code==='Unknown'?'Unknown':names?.of(code)||code;
  function records(id,headers,rows){const target=document.getElementById(id);target.replaceChildren();if(!rows.length){target.append(el('p','No saved records yet.'));return}const t=el('table'),head=el('thead'),tr=el('tr');for(const h of headers){const th=el('th',h);th.scope='col';tr.append(th)}head.append(tr);t.append(head);const body=el('tbody');for(const cells of rows){const tr=el('tr');cells.forEach((value,i)=>{const cell=el(i?'td':'th',value);if(!i)cell.scope='row';tr.append(cell)});body.append(tr)}t.append(body);target.append(t);}
  records('adminBusinessCountries',['Country','Registered','Visible','Paid','Trial','Not listed'],b.countries.map(r=>[region(r.country),...['registered','visible','paid','trial','unlisted'].map(k=>format(r[k]))]));
  records('adminGraduateCountries',['Country of study','Registered people','Available now','Available %','Visible people','Population · year'],data.graduateCountries.map(r=>[region(r.country),format(r.registered),format(r.available),r.availabilityRate+'%',format(r.visible),r.population?format(r.population.value)+' · '+r.population.year:'Unavailable']));
  const types={entrance_address:'SIEG Address · entrances',business_profile:'SIEG Business · locations',experts:'SIEG Experts · profiles',international_graduate:'International graduates · education records',property:'SIEG Estate · listings',analysis:'Analysis requests',business_subscription:'Business · billing records',learn_pilot:'Learn · plan / pack requests',weekly_crop:'Fields · crop-monitoring plans'};
  records('adminDatabaseInventory',['Register','State','Saved records'],data.inventory.map(r=>[types[r.kind]||r.kind,r.state.replaceAll('_',' '),format(r.count)]));
  const source=document.getElementById('adminPopulationSource');source.replaceChildren();const link=el('a',data.population.source);link.href=data.population.url;link.target='_blank';link.rel='noopener noreferrer';source.append(link,document.createTextNode(' · Latest reported year shown for each country. '+(data.population.status==='unavailable'?'Population source unavailable; database counts are still current.':data.population.status==='cached'?'Using cached population data.':'')));
  document.getElementById('adminDatabaseDefinition').textContent=data.definition+' Snapshot: '+new Date(data.asOf).toLocaleString();
 }
 async function load(){const id=++ticket;refresh.disabled=true;status.textContent='Loading platform activity…';try{const data=await api('/api/operations/admin-summary?days='+period.value);if(id!==ticket)return;loaded=true;database(data.database);metrics.replaceChildren();for(const [key,label,note] of [['visits','Website page views','sieg.ltd + www.sieg.ltd'],['serviceVisits','Service page views','Across the nine services'],['requests','Requested services','Saved requests in this period'],['pending','Pending requests','Awaiting the next step']]){const card=el('article');card.className='admin-summary-metric';card.dataset.metric=key;card.append(el('span',label),el('strong',format(data.totals[key])),el('small',note));metrics.append(card)}table('adminSummaryCountries',data.countries,'country');table('adminSummaryContinents',data.continents,'continent');table('adminSummaryServices',data.services,'service');document.getElementById('adminSummaryDefinition').textContent=data.definition+' Visit tracking '+(data.trackingStarted?'started '+data.trackingStarted+'.':'has no recorded visits yet.');status.textContent='Updated '+new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})+' · '+data.scope+' · requests created since '+data.since;}catch(error){if(id===ticket)status.textContent=error.message+' Previously loaded figures, if shown, have not been refreshed.';}finally{if(id===ticket)refresh.disabled=false}}
 refresh.onclick=load;period.onchange=load;panel.addEventListener('toggle',()=>{if(panel.open&&!loaded)load()});if(panel.open)load();
}
function inbox(){
 const refresh=document.getElementById('adminInboxRefresh');
 const status=document.getElementById('adminInboxStatus');
 const list=document.getElementById('adminInboxItems');
 async function load(){
  refresh.disabled=true;
  status.textContent='Checking review queues…';
  try{
   const {items}=await api('/api/operations/admin?kind=inbox');
   list.replaceChildren(...items.map(({id,label,count})=>{
    const item=el('li'),link=el('a',label+' · '+count);
    link.href='#'+id;
    item.append(link);
    return item;
   }));
   status.textContent=items.length?'Open a queue to review its submissions.':'No new items in the review queues.';
  }catch(error){status.textContent=error.message;}
  finally{refresh.disabled=false;}
 }
 refresh.onclick=load;
 panel.addEventListener('toggle',()=>{if(panel.open&&!refresh.disabled)load()});
 if(panel.open)load();
}
api('/api/geocoding/admin').then(d=>{
 if(d.isAdmin!==true)return;
 panel.hidden=nav.hidden=false;
 panel.querySelectorAll('[data-review-kind]').forEach(review);
 organise();moderation();businessSubscriptions();paidQueues();summary();inbox();
}).catch(()=>{});
})();

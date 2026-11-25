(()=>{'use strict';const el=id=>document.getElementById(id),catalogue=JSON.parse(el('expertTradeCatalogue').textContent),sectors=new Map(catalogue.flatMap(g=>g.trades.map(t=>[t,g.label]))),other='Other trade';
const norm=value=>value.trim().toLowerCase();
const canonicalTrade=new Map([...sectors.keys(),other].map(t=>[norm(t),t]));
function tradeOptions(input,groups,placeholder,allowOther=false){
 let list=input.nextElementSibling;
 if(list?.tagName!=='DATALIST'){list=node('datalist');list.id=input.id==='tradeFilter'?'expertDirectoryTrades':'expertFormTrades';input.after(list);input.setAttribute('list',list.id)}
 input.placeholder=placeholder;input.autocomplete='off';input.maxLength=100;
 list.replaceChildren(...groups.flatMap(g=>g.trades.map(t=>new Option(t,t))),...(allowOther?[new Option('Other trade',other)]:[]));
}
function customTrade(field){
 const label=node('label','Trade or specialty name'),input=node('input');input.name='customTrade';input.maxLength=100;label.append(input);field.closest('label').after(label);
 const update=()=>{
  const value=norm(field.value),trade=canonicalTrade.get(value),visible=trade===other;
  field.setCustomValidity(value&&!trade?'Choose a suggested trade, or enter Other trade.':'');
  label.hidden=!visible;input.disabled=!visible;input.required=visible;
 };
 field.addEventListener('input',update);field.addEventListener('change',()=>{field.value=canonicalTrade.get(norm(field.value))||field.value.trim();update()});update();
}let profiles=[],profileCursor=null,saved=new Set();try{const x=JSON.parse(localStorage.getItem('siege-talent-shortlist')||'[]');if(Array.isArray(x))saved=new Set(x.filter(v=>typeof v==='string'))}catch{}const dialog=el('talentDialog'),content=el('talentDialogContent');dialog.querySelector('.talent-close').onclick=()=>dialog.close();function node(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n}function button(text,fn){const b=node('button',text);b.type='button';b.onclick=fn;return b}function open(title){content.replaceChildren(node('h2',title));dialog.showModal()}function persist(){try{localStorage.setItem('siege-talent-shortlist',JSON.stringify([...saved]))}catch{}el('shortlistCount').textContent=saved.size}function toggle(p){saved.has(p.id)?saved.delete(p.id):saved.add(p.id);persist();render()}function rating(p){const count=Number.isInteger(p.reviewCount)&&p.reviewCount>0?p.reviewCount:0,avg=count&&Number.isFinite(p.rating)?Math.min(5,Math.max(1,p.rating)):null,box=node('div',undefined,'expert-rating'),stars=node('span',undefined,'expert-rating-stars'),empty=node('span','★★★★★'),fill=node('span','★★★★★','expert-rating-fill');stars.setAttribute('aria-hidden','true');fill.style.width=(avg?avg/5*100:0)+'%';stars.append(empty,fill);box.append(stars,node('span',avg?avg.toFixed(1)+' / 5 · '+count+' review'+(count===1?'':'s'):'Not yet rated','expert-rating-copy'));return box}
function review(p){open('Rate '+p.name);content.append(node('p','Share your experience working with this expert. Reviews are checked by SIEG before publication. One review per signed-in client.'));const f=node('form');for(const [label,name,type]of [['Your name','name','text'],['Contact email (private)','email','email']]){const l=node('label',label),input=node('input');input.type=type;input.name=name;input.required=true;input.maxLength=type==='email'?200:100;l.append(input);f.append(l)}const label=node('label','Rating'),select=node('select');select.name='rating';select.required=true;select.append(new Option('Choose a rating',''));for(let n=5;n>=1;n--)select.append(new Option(n+' '+(n===1?'star':'stars'),String(n)));label.append(select);const comments=node('label','Your review'),quote=node('textarea');quote.name='quote';quote.required=true;quote.maxLength=1200;comments.append(quote);const consent=node('label'),check=node('input');check.type='checkbox';check.required=true;check.className='expert-review-consent';consent.append(check,document.createTextNode('I worked with this expert and consent to publication of my name, rating and review. My email stays private.'));const submit=node('button','Submit review','btn'),status=node('p');submit.type='submit';status.setAttribute('role','status');f.append(label,comments,consent,submit,status);f.onsubmit=async e=>{e.preventDefault();submit.disabled=true;try{const d=Object.fromEntries(new FormData(f));const r=await fetch('/api/operations/testimonials',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expertId:p.id,service:'SIEG Experts',name:d.name,email:d.email,rating:Number(d.rating),quote:d.quote,consent:check.checked})}),data=await r.json();if(!r.ok)throw Error(data.error||'Review could not be submitted.');f.replaceChildren(node('h3','Review submitted'),node('p','Thank you. Your rating will appear after SIEG approves your review.'))}catch(err){status.textContent=err.message;submit.disabled=false}};content.append(f)}
function view(p){open(p.name);content.append(rating(p));if(p.illustrative===false)content.append(button('Rate this expert ☆',()=>review(p)));content.append(node('p',(p.illustrative===false?'SIEG reviewed submission · ':'Illustrative sample profile · ')+p.id),node('p',p.role+' / '+p.location+' / '+p.availability),node('p',p.illustrative===false?p.experience+' years experience':'Trade example — no experience or availability has been verified.'),node('p',p.skills.join(' · ')),node('p',p.illustrative===false?'Profile reviewed for directory publication. Credentials, references and availability must be confirmed before hiring.':'Qualifications, references, identity and availability have not been verified. This is a demonstration profile.'),button(saved.has(p.id)?'Remove from shortlist':'Add to shortlist',()=>{toggle(p);dialog.close()}))}function render(){const q=el('talentSearch').value.trim().toLowerCase(),trade=norm(el('tradeFilter').value),sector=el('sectorFilter').value,loc=el('locationFilter').value,avail=el('availabilityFilter').value;const rows=profiles.filter(p=>(!sector||(sectors.get(p.trade||p.role)||other)===sector)&&(!trade||norm(p.role).includes(trade)||norm(p.trade||p.role).includes(trade))&&(!loc||p.location===loc)&&(!avail||p.availability===avail)&&(!q||[p.name,p.role,p.location,...p.skills].join(' ').toLowerCase().includes(q)));el('talentCount').textContent=rows.length+' matching '+(sampleProfiles?'trade examples':'profiles')+' · '+sectors.size+' trades in the catalogue';const grid=el('talentGrid');grid.replaceChildren();grid.scrollLeft=0;requestAnimationFrame(updateSlider);if(!rows.length){grid.append(node('p','No profiles match. Try another trade, location or search.'));return}rows.forEach(p=>{const card=node('article',undefined,'talent-card');const list=node('ul');p.skills.forEach(s=>list.append(node('li',s)));const actions=node('div',undefined,'card-actions');const save=button(saved.has(p.id)?'Shortlisted ✓':'Shortlist +',()=>toggle(p));save.setAttribute('aria-pressed',String(saved.has(p.id)));save.setAttribute('aria-label',(saved.has(p.id)?'Remove ':'Shortlist ')+p.name);actions.append(button('View profile →',()=>view(p)),save);if(p.illustrative===false)actions.append(button('Rate expert ☆',()=>review(p)));else if(sampleAdmin)actions.append(button('Remove sample',()=>removeSample(p)));const avatar=node('div',p.initial,'talent-avatar');if(p.photo&&p.photo.startsWith('/api/operations/media/')){const image=node('img');image.src=p.photo;image.alt=p.name+' profile picture';image.style.cssText='width:100%;height:100%;object-fit:cover;border-radius:50%';avatar.replaceChildren(image)}card.append(avatar,node('h3',p.name),node('p',p.role+' · '+p.location,'meta'),rating(p),node('p',p.illustrative===false?p.experience+' years experience · Submitted profile':'Trade example · Not a listed professional','meta'),list,node('p',p.availability+' · '+(p.illustrative===false?'Reviewed for publication':'Illustrative'),'status'),actions);grid.append(card)})}function updateSlider(){const grid=el('talentGrid'),cards=[...grid.querySelectorAll('.talent-card')],count=cards.length;const max=grid.scrollWidth-grid.clientWidth;el('profilesPrev').disabled=!count||grid.scrollLeft<=2;el('profilesNext').disabled=!count||grid.scrollLeft>=max-2;const index=count?Math.min(count,Math.round(grid.scrollLeft/((cards[0].getBoundingClientRect().width||1)+20))+1):0;el('profilePosition').textContent=count?(sampleProfiles?'Trade example ':'Profile ')+index+' of '+count:'No profiles'}function slide(direction){const grid=el('talentGrid');grid.scrollBy({left:direction*grid.clientWidth,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}el('profilesPrev').onclick=()=>slide(-1);el('profilesNext').onclick=()=>slide(1);el('talentGrid').addEventListener('scroll',updateSlider,{passive:true});window.addEventListener('resize',updateSlider);el('talentGrid').addEventListener('keydown',e=>{if(e.target===el('talentGrid')&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();slide(e.key==='ArrowLeft'?-1:1)}});updateSlider();function download(text,name){const url=URL.createObjectURL(new Blob([text],{type:name.endsWith('.html')?'text/html;charset=utf-8':'text/plain;charset=utf-8'})),a=node('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}const matching={shortlist:'Request a specialist shortlist',quotes:'Request managed quote comparison',business:'Join the business sourcing waitlist'};function form(join,service=''){open(join?'Join SIEG Experts':matching[service]||'Submit a project brief');content.append(node('p',join?'Submit your profile for SIEG review. Approved profiles can appear in the directory; contact email stays private.':service==='business'?'Register interest. This does not start a subscription or charge you.':service?'Describe your project anywhere in Eswatini. SIEG will confirm scope, timing and payment with you.':'Send your requirements to SIEG for follow-up. This does not confirm a booking.'));const f=node('form');const fields=join?[['Name','text'],['Contact email','email'],['Trade','trade'],['Location','text'],['Years of experience','number'],['Experience and skills','textarea']]:[['Name','text'],['Contact email','email'],['Project location','text'],['Preferred start date (optional)','date'],['Budget / price range (optional)','text'],['Project requirements','textarea']];fields.forEach(([label,type])=>{const l=node('label',label),input=node(type==='textarea'?'textarea':'input');if(type!=='textarea')input.type='text';if(!['trade','textarea'].includes(type))input.type=type;if(type==='number'){input.min='0';input.max='80';input.step='1'}input.name=label;input.required=!label.includes('optional');input.maxLength=type==='textarea'?3000:200;l.append(input);f.append(l);if(type==='trade'){tradeOptions(input,catalogue,'Start typing a trade',true);customTrade(input)}});if(!join&&!service){const label=node('label','Trade (optional)'),select=node('input');select.name='trade';label.append(select);f.append(label);tradeOptions(select,catalogue,'Start typing a trade',true);customTrade(select)}if(service){
 const areaLabel=node('label','Region in Eswatini'),area=node('select'),tradeLabel=node('label',service==='business'?'Trade (optional)':'Trade'),trade=node('input');
 area.name='region';area.required=true;area.append(new Option('Choose a region',''),...['Hhohho','Lubombo','Manzini','Shiselweni'].map(name=>new Option(name)));
 trade.name='trade';trade.required=service!=='business';
 areaLabel.append(area);tradeLabel.append(trade);f.prepend(areaLabel,tradeLabel);
 tradeOptions(trade,catalogue,'Start typing a trade',true);
 if(service==='business')f.elements['Project location'].required=false;
}
if(join){
 const l=node('label','Availability for work'),select=node('select');select.name='availability';select.required=true;
 select.append(new Option('Choose availability',''),...['Available now','Within 2 weeks','Within 1 month','Not currently available','Contact me'].map(v=>new Option(v)));
 l.append(select);f.append(l);
 const reminderLabel=node('label',undefined,'expert-reminder-consent'),reminder=node('input');reminder.type='checkbox';reminder.name='availabilityReminders';reminder.checked=true;
 reminderLabel.append(reminder,document.createTextNode('Email my signed-in account every 90 days to confirm availability. I can turn reminders off at any time.'));f.append(reminderLabel);
}
let profilePhoto='',photoPending=false;
if(join){const l=node('label','Profile picture (optional)'),input=node('input'),preview=node('img');input.type='file';input.accept='image/jpeg,image/png,image/webp';preview.hidden=true;preview.className='profile-photo-preview';preview.alt='Selected profile picture';const help='JPG, PNG or WebP, maximum 5 MB. The background is replaced with white.',msg=node('p',help);msg.setAttribute('role','status');let photoRevision=0;
input.onchange=async()=>{
 const revision=++photoRevision;
 profilePhoto='';preview.hidden=true;
 const file=input.files[0];photoPending=!!file;
 if(!file){msg.textContent=help;return;}
 msg.textContent='Preparing your picture with a white background…';
 try{
  const processed=await window.SiegPortrait.prepare(file,800);
  if(revision!==photoRevision)return;
  profilePhoto=processed;preview.src=processed;preview.hidden=false;msg.textContent='Picture ready to submit.';
 }catch(error){if(revision===photoRevision)msg.textContent=error.message;}
 finally{if(revision===photoRevision)photoPending=false;}
};
l.append(input);f.append(l,preview,msg,button('Remove picture',()=>{photoRevision++;photoPending=false;profilePhoto='';preview.hidden=true;input.value='';msg.textContent=help;}));
f.addEventListener('submit',event=>{if(input.files.length&&!profilePhoto&&!photoPending){event.preventDefault();event.stopImmediatePropagation();msg.textContent='Choose another portrait or remove the picture before submitting.';}},true);
}
if(service)customTrade(f.elements.trade);const consent=node('label'),check=node('input');check.type='checkbox';check.required=true;check.style.cssText='width:18px;min-width:18px;height:18px;margin-right:8px';consent.append(check,document.createTextNode(join?'I consent to SIEG storing and reviewing my details and publishing my approved profile and picture.':'I consent to SIEG storing my contact details and project brief for follow-up.'));const submit=node('button',join?'Submit profile for review':service==='business'?'Register interest':service?'Send request':'Submit project brief','btn'),status=node('p');status.setAttribute('role','status');submit.type='submit';f.append(consent,submit,status);f.onsubmit=async e=>{e.preventDefault();if(photoPending){status.textContent='Wait for the picture to finish processing.';return}submit.disabled=true;try{const d=Object.fromEntries(new FormData(f)),payload=join?{name:d.Name,email:d['Contact email'],trade:canonicalTrade.get(norm(d.Trade)),customTrade:d.customTrade,location:d.Location,experience:Number(d['Years of experience']),skills:d['Experience and skills'],availability:d.availability,availabilityReminders:f.elements.availabilityReminders?.checked===true,photo:profilePhoto,consent:check.checked}:{name:d.Name,email:d['Contact email'],location:d['Project location'],start:d['Preferred start date (optional)'],service,region:d.region,trade:canonicalTrade.get(norm(d.trade||'')),customTrade:d.customTrade,budget:d['Budget / price range (optional)'],requirements:d['Project requirements'],shortlist:[...saved].filter(id=>!id.startsWith('TAL-')),consent:check.checked};const r=await fetch('/api/experts/'+(join?'applications':'briefs'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),result=await r.json();if(!r.ok)throw Error(result.error||'Submission failed.');f.replaceChildren(node('h3','Submission saved'),node('p',result.message),node('p','Reference: '+result.id));if(join)f.append(button('Update my availability',manageAvailability))}catch(err){status.textContent=err.message;submit.disabled=false}};content.append(f)}async function manageAvailability(){
 open('My work availability');const note=node('p','Loading your submitted profiles…');note.setAttribute('role','status');content.append(note);
 try{
  const r=await fetch('/api/experts/availability',{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error||'Could not load profiles.');
  note.textContent=d.profiles.length?'Changes appear on your approved profile immediately. Your contact details stay private.':'No submitted profiles found for this account. Join SIEG Experts to add one.';
  for(const profile of d.profiles){
   const f=node('form',undefined,'expert-availability-form');f.append(node('h3',profile.name+' · '+profile.trade));
   const label=node('label','Availability for work'),select=node('select');select.required=true;
   for(const value of ['Available now','Within 2 weeks','Within 1 month','Not currently available','Contact me'])select.add(new Option(value,value));select.value=profile.availability==='Contact SIEG'?'Contact me':profile.availability;label.append(select);
   const reminderLabel=node('label',undefined,'expert-reminder-consent'),reminder=node('input');reminder.type='checkbox';reminder.checked=profile.availabilityReminders===true;reminderLabel.append(reminder,document.createTextNode('Email my signed-in account every 90 days to confirm availability.'));
   const status=node('p',profile.availabilityConfirmedAt?'Last confirmed '+new Date(profile.availabilityConfirmedAt).toLocaleDateString():'Please confirm your current availability.');status.setAttribute('role','status');const submit=node('button','Save availability','btn');submit.type='submit';f.append(label,reminderLabel,submit,status);content.append(f);
   f.onsubmit=async event=>{event.preventDefault();submit.disabled=true;try{const res=await fetch('/api/experts/availability',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:profile.id,availability:select.value,availabilityReminders:reminder.checked})}),data=await res.json();if(!res.ok)throw Error(data.error||'Update failed.');status.textContent='Availability saved.'+(data.nextReminderAt?' Next reminder: '+new Date(data.nextReminderAt).toLocaleDateString()+'.':' Email reminders are off.');searchProfiles();}catch(e){status.textContent=e.message}finally{submit.disabled=false}};
  }
 }catch(e){note.textContent=e.message;}
}
el('manageExpertAvailability').onclick=manageAvailability;
if(location.hash==='#my-expert-profiles')manageAvailability();
function shortlist(){open('Your shortlist');const list=[...knownProfiles.values()].filter(p=>saved.has(p.id));content.append(node('p',saved.size+' profiles saved in this browser.'));list.forEach(p=>{const row=node('div',undefined,'shortlist-item');row.append(node('span',p.name+' · '+p.location),button('Remove',()=>{toggle(p);dialog.close();shortlist()}));content.append(row)});content.append(button('Prepare project brief →',()=>{dialog.close();form(false)}))}el('joinTalent').onclick=el('joinTalentBottom').onclick=()=>form(true);el('openShortlist').onclick=shortlist;for(const [id,service] of [['requestExpertShortlist','shortlist'],['requestExpertQuotes','quotes'],['requestExpertBusiness','business']])el(id).onclick=()=>form(false,service);const sectorFilter=el('sectorFilter'),tradeFilter=el('tradeFilter');
function filterTrades(){
 const sector=sectorFilter.value,groups=sector===other?[]:catalogue.filter(g=>!sector||g.label===sector);
 tradeFilter.value='';tradeOptions(tradeFilter,groups,'Start typing a trade',!sector||sector===other);
}
for(const g of [...catalogue,{label:other,trades:[]}]){
 sectorFilter.append(new Option(g.label,g.label));
 const b=button('',()=>{sectorFilter.value=g.label;filterTrades();searchProfiles();el('directory').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});tradeFilter.focus({preventScroll:true})});
 b.append(node('span',g.label),node('small',g.trades.length?g.trades.length+' trades':'Browse unlisted specialties'));
 el('tradeCategories').append(b);
}
const knownProfiles=new Map(),locationFilter=el('locationFilter');
let sampleProfiles=null,searchTimer,requestController,activeQuery='',sampleAdmin=false,hiddenSamples=new Set();
// Round-robin sectors so the slider shows a broad mix before repeating a sector.
async function removeSample(p){if(!confirm('Remove this sample for all visitors?'))return;try{const r=await fetch('/api/experts/samples',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:p.id})}),d=await r.json();if(!r.ok)throw Error(d.error||'Removal failed');hiddenSamples=new Set(d.hidden);sampleProfiles=catalogueSamples();profiles=sampleProfiles;knownProfiles.delete(p.id);saved.delete(p.id);persist();render();}catch(e){el('talentCount').textContent=e.message;}}
function catalogueSamples(){
 const rows=[],longest=Math.max(...catalogue.map(group=>group.trades.length));
 for(let index=0;index<longest;index++)for(const group of catalogue){
  const trade=group.trades[index];if(!trade)continue;
  rows.push({id:'TAL-'+trade.toLowerCase().replace(/[^a-z0-9]+/g,'-'),name:trade+' · Sample',role:trade,trade,sector:group.label,location:'Eswatini',availability:'Availability not verified',skills:[group.label,'Example listing for this trade','Join SIEG Experts to add your services'],initial:trade.split(/\s+/).slice(0,2).map(word=>word[0]).join('').toUpperCase(),experience:null,illustrative:true});
 }
 return rows.filter(p=>['Surveyors','Bricklayers','Electricians','Environmental engineering'].includes(p.trade)&&!hiddenSamples.has(p.id));
}

const more=button('Load more profiles',()=>loadProfiles(true));
more.hidden=true;document.querySelector('.profile-slider-controls').append(more);
function searchParams(){
 const params=new URLSearchParams();
 for(const [key,id] of [['q','talentSearch'],['trade','tradeFilter'],['sector','sectorFilter'],['availability','availabilityFilter'],['location','locationFilter']]){
  const value=el(id).value.trim();if(value)params.set(key,value);
 }
 return params;
}
async function loadProfiles(append=false){
 const params=searchParams(),query=params.toString();
 if(append){if(query!==activeQuery||!profileCursor)return;params.set('cursor',profileCursor)}
 requestController?.abort();const controller=new AbortController();requestController=controller;
 more.disabled=true;el('talentCount').textContent='Searching profiles…';
 try{
  const r=await fetch('/api/experts/profiles?'+params,{signal:controller.signal});
  if(!r.ok)throw Error('Directory unavailable');
  const d=await r.json();
  const sampleResponse=await fetch('/api/experts/samples',{signal:controller.signal,cache:'no-store'});if(!sampleResponse.ok)throw Error('Sample settings unavailable');const settings=await sampleResponse.json();sampleAdmin=settings.admin===true;hiddenSamples=new Set(settings.hidden||[]);
  if(controller.signal.aborted)return;
  if(!d.profiles.length&&!append&&!d.hasProfiles){
   sampleProfiles=catalogueSamples();
  }else if(d.hasProfiles||d.profiles.length)sampleProfiles=null;
  if(controller.signal.aborted)return;
  profiles=sampleProfiles|| (append?[...profiles,...d.profiles]:d.profiles);
  profileCursor=d.cursor;activeQuery=query;
  for(const p of profiles){
   knownProfiles.set(p.id,p);
   if(![...locationFilter.options].some(o=>o.value===p.location))locationFilter.add(new Option(p.location,p.location));
  }
  document.querySelector('.sample-note').textContent=sampleProfiles?'Four illustrative trade samples are available until removed by the administrator. These are not professionals available to hire. Browse the full trade catalogue above.':'Submitted profiles are reviewed for publication. Verify credentials and availability before hiring.';
  more.hidden=!profileCursor;render();
 }catch(error){if(!controller.signal.aborted)el('talentCount').textContent='Profiles could not load. Please try again.'}
 finally{if(requestController===controller)more.disabled=false}
}
function searchProfiles(){
 clearTimeout(searchTimer);requestController?.abort();more.hidden=true;render();
 searchTimer=setTimeout(()=>loadProfiles(),200);
}
filterTrades();sectorFilter.addEventListener('change',()=>{filterTrades();searchProfiles()});
const profileFilters=['talentSearch','tradeFilter','locationFilter','availabilityFilter'];
profileFilters.forEach(id=>el(id).addEventListener(['talentSearch','tradeFilter'].includes(id)?'input':'change',searchProfiles));
el('resetTalent').onclick=()=>{sectorFilter.value='';filterTrades();profileFilters.forEach(id=>el(id).value='');searchProfiles()};
persist();loadProfiles();
})();

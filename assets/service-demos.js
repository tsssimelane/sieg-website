(()=>{'use strict';function map(extra='',kind='fields'){const backgrounds={fields:'fields-tambuti.png',eco:'eco-forest.jpg',hydrology:'hydrology-rivers.png',estate:'estate-demo-homes.webp',address:'address-buildings.png'},credits={fields:'Tambuti · provided reference',eco:'NASA / USGS · example scene',hydrology:'River network · provided reference',estate:'AI-generated aerial imagery',address:'Provided satellite image · sample geocodes'};return '<div class="mini-map mini-map-'+kind+'"><img class="mini-map-background" src="assets/demos/'+backgrounds[kind]+'" alt="" loading="lazy" decoding="async"><svg class="mini-analysis-overlay" viewBox="0 0 300 190" preserveAspectRatio="none" aria-hidden="true">'+extra+'</svg><div class="mini-zoom" aria-hidden="true">+<br>−</div><div class="mini-legend"></div><span class="mini-map-credit">'+credits[kind]+'</span></div>'}function panel(id,title,markup){const el=document.querySelector('#'+id+' .product-visual');if(!el)return null;el.className='product-visual service-demo';el.innerHTML='<div class="mini-site"><div class="mini-header"><span class="mini-wordmark">sieg <span class="mini-brand">BEYOND THE VISION</span></span><span class="mini-preview">DEMO</span></div><div class="mini-title">'+title+'</div>'+markup+'</div><p class="demo-output" role="status" aria-live="polite"></p>';return {el,out:el.querySelector('.demo-output'),find:s=>el.querySelector(s)}}function tabs(labels){return '<div class="mini-tabs" role="tablist">'+labels.map((x,i)=>'<button type="button" role="tab" aria-selected="'+!i+'">'+x+'</button>').join('')+'</div>'}function selectTab(root,button){root.querySelectorAll('[role=tab]').forEach(x=>x.setAttribute('aria-selected',String(x===button)))}function legend(p,text){p.find('.mini-legend').replaceChildren();const dot=document.createElement('i');p.find('.mini-legend').append(dot,document.createTextNode(text))}function pin(p,x,y,label,text,callback){const b=document.createElement('button');b.type='button';b.className='mini-pin';if(p.el.closest('#property')||p.el.closest('#geocoding')){const number=document.createElement('span');number.className='mini-pin-number';number.textContent=label;b.append(number)}else b.textContent=label;b.style.left=x+'%';b.style.top=y+'%';b.setAttribute('aria-label',text);b.setAttribute('aria-pressed','false');b.onclick=()=>{p.el.querySelectorAll('.mini-pin').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));callback()};p.find('.mini-map').append(b)}
const plots='<g id="preview-plots" fill-opacity=".32" stroke="#f3f1d6" stroke-width="2"><path d="M95 45L152 53L146 95L99 87Z"/><path d="M155 54L207 67L196 108L150 96Z"/><path d="M100 91L146 99L160 145L117 137Z"/><path d="M151 102L196 113L181 157L164 146Z"/></g><path d="M89 39L214 62L187 165L112 145Z" fill="none" stroke="#176f73" stroke-dasharray="5 3" stroke-width="2"/>';
const fields=panel('suitability','SIEG Fields',tabs(['Overview','Soil','Suitability','Weather'])+
 '<div class="mini-demo-view mini-current-overview" data-demo-view="0"><div class="mini-current-hero"><div><small>01 / SIEG FIELDS</small><b>Understand your land.<br><em>Grow its potential.</em></b><p>Explore soil, terrain, climate and crop health.</p><a href="agri-intelligence.html">Explore your field ↗</a></div><img src="assets/service-photos/fields-v1.webp" alt="Green crop rows across rolling farmland in southern Africa" loading="lazy"></div><div class="mini-current-section"><div class="mini-ag-field"><strong>Sample field</strong><span>Tambuti · 18.4 hectares · Eswatini</span><small>Explore soil, suitability and weather tabs.</small></div></div></div>'+
 '<div class="mini-body" data-demo-view="1 2 3" hidden><div class="mini-sidebar"><strong>LOCATE YOUR AOI</strong><span class="mini-field">Eswatini ⌄</span><span class="mini-field">Tambuti · sample</span><span class="mini-indicator">Sample polygon<br>18.4 hectares</span><strong class="mini-metric">Soil texture</strong><span class="mini-muted">Select a tab to explore the map.</span></div>'+map(plots)+'</div>');
if(fields){
 const modes=[{name:'Soil texture',colors:['#b39469','#c4aa7b','#a88c65','#d2bf98'],legend:'Soil texture · sample',text:'Soil properties · illustrative overlay.'},{name:'Land suitability',colors:['#3d8767','#81aa73','#a3ba7e','#d0ca8d'],legend:'High → marginal suitability',text:'Suitability · illustrative zones change with your selected tab.'},{name:'Rainfall',colors:['#73a6b0','#82b9be','#4a8e9e','#abcfd0'],legend:'Rainfall · sample overlay',text:'Weather · sample rainfall overlay; open SIEG Fields for analysis.'}];
 demoViews(fields,['Explore the Fields introduction and sample field workspace.',...modes.map(m=>m.text)],i=>{if(!i)return;const mode=modes[i-1];fields.find('.mini-metric').textContent=mode.name;fields.el.querySelectorAll('#preview-plots path').forEach((n,j)=>n.setAttribute('fill',mode.colors[j]));legend(fields,mode.legend);});
}
function photoOverview(number,name,first,second,description,href,action,photo,alt,summary,detail){return '<div class="mini-demo-view mini-current-overview" data-demo-view="0"><div class="mini-current-hero"><div><small>'+number+' / SIEG '+name.toUpperCase()+'</small><b>'+first+'<br><em>'+second+'</em></b><p>'+description+'</p><a href="'+href+'">'+action+' ↗</a></div><img src="assets/service-photos/'+photo+'-v1.webp" alt="'+alt+'" loading="lazy"></div><div class="mini-current-section"><div class="mini-ag-field"><strong>'+summary+'</strong><span>'+detail+'</span><small>Interactive preview · illustrative data</small></div></div></div>';}
const eco=panel('environment','SIEG Eco',tabs(['Overview','Land cover','Biodiversity','Air quality'])+photoOverview('06','Eco','See the change.','Plan a healthier future.','Explore land cover, biodiversity and environmental pressures.','enviro-intelligence.html','Explore your environment','eco','Woodland and natural stream','Sample environmental area','Niepołomice Forest · Poland')+'<div class="mini-body" data-demo-view="1 2 3" hidden><div class="mini-sidebar"><strong>YOUR ANALYSIS AREA</strong><span class="mini-field">Poland · sample scene</span><span class="mini-field">Niepołomice Forest</span><span class="mini-field">AOI boundary selected</span><span class="mini-indicator">Environmental screening<br>Sample results</span><strong class="mini-metric">Land cover</strong><span class="mini-eco-metric">Forest · Cropland · Built area</span></div>'+map('<defs><clipPath id="eco-aoi-clip"><path d="M48 32L233 24L260 147L182 171L58 152Z"/></clipPath></defs><g id="eco-overlay" opacity=".42" clip-path="url(#eco-aoi-clip)"><path d="M80 30L151 28L145 55L173 79L164 111L191 136L179 173L65 154L57 114L95 94L77 66Z"/><path d="M148 24L233 20L252 91L221 101L191 78L170 75L143 52Z"/><path d="M196 92L256 82L270 151L181 176L193 132L165 113L174 85Z"/></g><path d="M48 32L233 24L260 147L182 171L58 152Z" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="4 2"/>','eco')+'</div>');if(eco){const names=['Land cover','Biodiversity','Air quality'],palettes=[['#4e8e62','#b4bd77','#7e9f6c'],['#4b957c','#8eb394','#c1d1aa'],['#b3bc86','#d0af78','#d2c99d']];demoViews(eco,['Explore the Eco introduction and sample workspace.',...names.map(n=>n+' · illustrative preview.')],index=>{if(!index)return;const i=index-1;eco.find('.mini-metric').textContent=names[i];eco.el.querySelectorAll('#eco-overlay path').forEach((n,j)=>n.setAttribute('fill',palettes[i][j]));legend(eco,names[i]+' · sample');eco.find('.mini-eco-metric').textContent=['Forest · Cropland · Built area','Habitat condition · screening proxy','Relative air-quality screening'][i];eco.out.textContent=names[i]+' · Sample overlay on a real satellite scene; not a live analysis.'});}
const hydro=panel('hydrology','SIEG Hydrology',tabs(['Overview','Basins','Rainfall','Water balance'])+photoOverview('05','Hydrology','Follow the water.','Understand the landscape.','Explore catchments, rainfall and water resources.','hydrology.html','Explore water insights','hydrology','A winding river in a green valley','Sample catchment','Eswatini · river basin context')+'<div class="mini-body" data-demo-view="1 2 3" hidden><div class="mini-sidebar"><strong>ANALYSIS AREA</strong><span class="mini-field">Eswatini ⌄</span><span class="mini-field">River basin ⌄</span><span class="mini-field">Year · 2025</span><strong class="mini-metric">Catchments</strong><span class="mini-muted">Locate a catchment</span></div>'+map('<g id="hydro-overlay" opacity=".18"><path d="M85 25L160 38L141 109L65 92Z"/><path d="M163 40L233 64L201 155L144 111Z"/></g><path d="M130 20Q105 80 160 112T179 185" fill="none" stroke="#377f9e" stroke-width="2" opacity=".65"/>','hydrology')+'</div>');if(hydro){const names=['Catchments','Annual rainfall','Climatic water balance'],colors=[['#72aab3','#a9c9bb'],['#4598bb','#83bdcf'],['#8dbdad','#dac68a']];demoViews(hydro,['Explore the Hydrology introduction and sample workspace.',...names.map(n=>n+' · illustrative preview.')],index=>{if(!index)return;const i=index-1;hydro.find('.mini-metric').textContent=names[i];hydro.el.querySelectorAll('#hydro-overlay path').forEach((n,j)=>n.setAttribute('fill',colors[i][j]));legend(hydro,names[i]+' · sample');hydro.out.textContent=names[i]+' preview · Illustrative overlay; open SIEG Hydrology for live analysis.'});}
const estate=panel('property','SIEG Estate',tabs(['All','Homes','Land'])+
 '<div class="mini-body"><div class="mini-sidebar"><div class="mini-listing">'+
 '<div class="mini-house-art"><img loading="lazy" alt=""></div>'+
 '<span class="mini-listing-tag">FOR SALE · SAMPLE</span><b class="listing-title"></b>'+
 '<span class="listing-price"></span><span class="listing-location">Manzini · sample</span>'+
 '<span class="listing-specs"></span><a class="mini-listing-open" href="/estates">Explore properties ↗</a>'+
 '</div></div>'+map('','estate')+'</div>');
if(estate){
 const properties=[
  {type:'Home',name:'Garden residence',price:'E 950,000',specs:'3 beds · 2 baths',photo:'assets/service-photos/estate-v1.webp',number:1,x:38,y:30},
  {type:'Land',name:'Smallholding',price:'E 420,000',specs:'1.2 ha · Agricultural land',photo:'assets/demos/estate-demo-land.webp',number:2,x:43,y:53},
  {type:'Home',name:'Family home',price:'E 1,450,000',specs:'4 beds · Garden',photo:'assets/demos/estate-home.jpg',number:3,x:67,y:72}
 ];
 const aerial=estate.find('.mini-map-background');
 const photo=estate.find('.mini-house-art img');
 function choose(property){
  estate.find('.listing-title').textContent=property.name;
  estate.find('.listing-price').textContent=property.price;
  estate.find('.listing-specs').textContent=property.specs;
  photo.src=property.photo;
  photo.alt='Illustrative image for '+property.name;
  estate.out.textContent=property.name+' · '+property.price+' · Illustrative listing.';
 }
 const filters=estate.el.querySelectorAll('[role=tab]');
 filters.forEach((button,index)=>button.onclick=()=>{
  selectTab(estate.el,button);
  const type=[null,'Home','Land'][index];
  aerial.src='assets/demos/estate-demo-'+(type==='Land'?'land':'homes')+'.webp';
  estate.el.querySelectorAll('.mini-pin').forEach(marker=>marker.remove());
  const visible=properties.filter(property=>!type||property.type===type);
  for(const property of visible){
   pin(estate,property.x,property.y,String(property.number),'View '+property.name,()=>choose(property));
  }
  estate.find('.mini-pin').setAttribute('aria-pressed','true');
  choose(visible[0]);
  legend(estate,'Select a property pin');
 });
 filters[0].click();
}
function demoViews(demo,notes,onSelect,initialView=0){
 if(!demo)return;
 const buttons=[...demo.el.querySelectorAll('[role=tab]')],views=[...demo.el.querySelectorAll('[data-demo-view]')];
 function select(i){
  selectTab(demo.el,buttons[i]);
  buttons.forEach((button,n)=>{button.tabIndex=n===i?0:-1;});
  views.forEach(view=>{view.hidden=!view.dataset.demoView.split(" ").includes(String(i));});
  demo.out.textContent=notes[i];
  onSelect?.(i);
 }
 buttons.forEach((button,i)=>{
  button.onclick=()=>select(i);
  button.onkeydown=event=>{
   const next={ArrowRight:(i+1)%buttons.length,ArrowLeft:(i+buttons.length-1)%buttons.length,Home:0,End:buttons.length-1}[event.key];
   if(next===undefined)return;
   event.preventDefault();select(next);buttons[next].focus();
  };
 });
 select(initialView);
}
// Agriculture demos use the same mini-site chrome, tabs and sample-data status.
const financeRows=(headers,rows)=>'<div class="mini-ag-table"><table><thead><tr>'+headers.map(v=>'<th>'+v+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(v=>'<td>'+v+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
const metrics=items=>'<div class="mini-ag-metrics">'+items.map(([label,value])=>'<div><small>'+label+'</small><b>'+value+'</b></div>').join('')+'</div>';
const registry='<div class="mini-ag-field"><strong>Registered field</strong><span>Sample field · 18.4 ha · Maize</span><small>2026/27 growing season · illustrative data</small></div>';
const ledger=panel('ledger','SIEG Ledger',tabs(['Overview','Operations','Budget','Expenses','Profitability'])+
 '<div class="mini-demo-view mini-current-overview" data-demo-view="0"><div class="mini-current-hero"><div><small>03 / SIEG LEDGER</small><b>Know your costs.<br><em>Grow your returns.</em></b><p>Plan operations and track seasonal finances.</p><a href="ledger.html">Open field ledger ↗</a></div><img src="assets/service-photos/ledger-v1.webp" alt="Farm managers reviewing records" loading="lazy"></div><div class="mini-current-section">'+registry+'</div></div>'+
 '<div class="mini-demo-view mini-ag-view" data-demo-view="1" hidden>'+registry+'<h4>Field operations · sample</h4>'+financeRows(['Operation','Status'],[['Land preparation','Completed'],['Planting','Completed'],['Field inspection','Upcoming']])+'</div>'+
 '<div class="mini-demo-view mini-ag-view" data-demo-view="2" hidden>'+metrics([['Planned budget','E 82,000'],['Current spending','E 34,000'],['Balance','E 48,000']])+'<h4>Budget utilisation</h4><div class="mini-ag-progress"><i style="width:41.46%"></i></div>'+financeRows(['Cost category','Planned'],[['Land preparation','E 22,000'],['Labour','E 30,000'],['Other costs','E 30,000']])+'</div>'+
 '<div class="mini-demo-view mini-ag-view" data-demo-view="3" hidden><h4>Actual expenditure · sample</h4>'+financeRows(['Expense','Recorded cost'],[['Land preparation','E 18,000'],['Labour','E 12,000'],['Other costs','E 4,000']])+'</div>'+
 '<div class="mini-demo-view mini-ag-view" data-demo-view="4" hidden>'+metrics([['Revenue','E 105,000'],['Forecast cost','E 82,000'],['Forecast profit','E 23,000']])+'<h4>Scenario comparison · illustrative</h4>'+financeRows(['Scenario','Profit / loss'],[['Pessimistic','− E 8,000'],['Expected','E 23,000'],['Optimistic','E 48,000']])+'</div>');
demoViews(ledger,['Explore the Ledger introduction and registered-field workspace.','Sample operation status; open Ledger to manage your own records.','Illustrative budget less spending; not realised profit.','Illustrative expenditure records.','Illustrative forecasts, not actual farm results.']);
const chemicals=panel('chemicals','SIEG Chemicals',tabs(['Overview','Inspections','Records','Inventory','Usage map'])+
 '<div class="mini-demo-view mini-current-overview" data-demo-view="0"><div class="mini-current-hero"><div><small>04 / SIEG CHEMICALS</small><b>Manage your inputs.<br><em>Farm responsibly.</em></b><p>Track inspections, inventory and recorded input activity.</p><a href="chemicals.html">Open input workspace ↗</a></div><img src="assets/service-photos/chemicals-v1.webp" alt="Farm personnel reviewing input inventory" loading="lazy"></div><div class="mini-current-section">'+registry+'</div></div>'+
 '<div class="mini-demo-view mini-ag-view" data-demo-view="1" hidden>'+registry+'<h4>Field inspection calendar</h4>'+financeRows(['Inspection','Status'],[['General crop condition','Due'],['Stock record review','Upcoming'],['Previous field inspection','Completed']])+'<small>Inspection reminders only.</small></div>'+
 '<div class="mini-demo-view mini-ag-view" data-demo-view="2" hidden>'+metrics([['Completed records','8'],['Inspections','3'],['Stock entries','5']])+'<h4>Recorded activities</h4>'+financeRows(['Activity','Record status'],[['Field inspection','Completed'],['Stock receipt','Recorded'],['Application record','Recorded']])+'</div>'+
 '<div class="mini-demo-view mini-ag-view" data-demo-view="3" hidden><h4>Stock register · sample</h4>'+financeRows(['Category','Status'],[['Fertiliser','Recorded'],['Soil amendment','Recorded'],['Other inputs','Recorded']])+'<small>Actual receipts and usage are recorded privately by field.</small></div>'+
 '<div class="mini-demo-view mini-ag-view" data-demo-view="4" hidden><h4>Country-level usage map</h4><div class="mini-ag-world"><svg viewBox="0 0 800 400" aria-label="Illustrative world map" role="img"></svg></div><small>Sample regional view · no individual farm locations.</small></div>');
demoViews(chemicals,['Explore the Chemicals introduction and linked field workspace.','Illustrative inspection reminders; no treatment prescriptions.','Sample activity record counts only.','Sample stock register; no actual farm data.','Country-level summary of sample application records.']);
if(chemicals)fetch('talent/world-map.json').then(r=>r.json()).then(rows=>{const svg=chemicals.find('.mini-ag-world svg');for(const [code,x,y,d] of rows){const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',d);p.setAttribute('fill',['SZ','ZA','TW'].includes(code)?'#218b8c':'#bfd4cb');p.setAttribute('stroke','#fff');p.setAttribute('stroke-width','.6');svg.append(p);}}).catch(()=>{});
const address=panel('geocoding','SIEG Address',tabs(['Locate','Sign + card','Share'])+
 '<div class="mini-address-body" data-demo-view="0"><div class="mini-locate"><b>Locate an entrance</b><span>Malkerns · sample pins</span></div>'+map('<path d="M0 158L65 158L70 91L141 91L141 47" fill="none" stroke="#fff" stroke-width="6"/><path d="M0 158L65 158L70 91L141 91L141 47" fill="none" stroke="#218b8c" stroke-width="3" stroke-dasharray="4 2"/>','address')+'</div>'+
 '<div class="mini-demo-view mini-real-address" data-demo-view="1" hidden><img class="mini-gate-photo" src="assets/service-photos/address-v1.webp" alt="Jacaranda entrance with a visible SIEG sign on the gate pillar" loading="lazy"><span class="mini-address-photo-caption">A sign at the entrance. Directions in your pocket.</span><a class="mini-address-digital-card" href="/address"><div><span class="mini-demo-kicker">SIEG ADDRESS · SAMPLE</span><b>Jacaranda, homestead</b><strong>SZ-HM 8KT564</strong><small>Malkerns · Manzini · Eswatini</small><small>Main entrance | E01</small></div><img src="geocoding/sample-address-qr.svg" alt="Demo entrance QR code"><span>Explore address cards ↗</span></a></div>'+
 '<div class="mini-demo-view" data-demo-view="2" hidden><p class="mini-demo-kicker">SHARE AN ENTRANCE</p><b>Give visitors a clear way to find you.</b><div class="mini-demo-chips"><span>Directions link</span><span>QR code</span><span>Printable card</span></div><p>Share the registered entrance pin with the people who need it.</p></div>');
if(address){
 ['001','003','005'].forEach((n,i)=>pin(address,[23.5,46.2,81.5][i],[45.2,24.5,33][i],n,'View sample entrance '+n,()=>{address.out.textContent='Sample entrance '+n+' · Malkerns, Manzini, Eswatini.';}));
 legend(address,'Entrance locations');
 const image=address.find('.mini-map-background'),mapEl=address.find('.mini-map'),anchors=[[.235,.452],[.462,.245],[.815,.33]];
 function alignHomes(){
  if(!image.naturalWidth||!mapEl.clientWidth)return;
  const w=mapEl.clientWidth,h=mapEl.clientHeight,scale=Math.max(w/image.naturalWidth,h/image.naturalHeight),iw=image.naturalWidth*scale,ih=image.naturalHeight*scale;
  mapEl.querySelectorAll('.mini-pin').forEach((button,i)=>{button.style.left=(anchors[i][0]*iw-(iw-w)/2)+'px';button.style.top=(anchors[i][1]*ih-(ih-h)/2)+'px';});
 }
 image.addEventListener('load',alignHomes);
 if(window.ResizeObserver)new ResizeObserver(alignHomes).observe(mapEl);
 demoViews(address,['Select a numbered pin to preview an entrance.','Physical sign + digital entrance card · samples only, not a registered address.','A registered card shares directions to its captured entrance.'],i=>{if(i===0)alignHomes();},1);
}
const experts=panel('talent','SIEG Experts',tabs(['Overview','Specialists','Graduates','Apply','Services'])+
 '<div class="mini-demo-view mini-current-overview" data-demo-view="0"><div class="mini-current-hero mini-current-experts"><div><small>SIEG / LOCAL EXPERTISE</small><b>Good projects start<br>with the right people.</b><p>Skilled tradespeople and technical specialists across Eswatini.</p><a href="talent-pool.html">Find a specialist ↗</a></div><aside><strong>PEOPLE WHO MAKE<br>PLACES WORK</strong><span class="mini-expert-mark">S<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 19 19 5M7 5h12v12"/></svg></span><small>Land · Industry · Services</small></aside></div><div class="mini-current-section"><b>What does your project need?</b><div class="mini-current-sectors"><span>Construction & finishing</span><span>Land, surveying & design</span><span>Agriculture, forestry & fisheries</span></div><small class="mini-expert-catalogue-count">Explore the trade catalogue</small></div></div>'+
 '<div class="mini-demo-view mini-expert-trades" data-demo-view="1" hidden><div class="mini-expert-overview"><span>Find the right skills</span><small>Browse free</small></div><div class="mini-profile-list"></div><div class="mini-slider"><button type="button" data-step="-1" aria-label="Previous sample trade">←</button><span class="mini-trade-counter"></span><button type="button" data-step="1" aria-label="Next sample trade">→</button></div></div>'+
 '<div class="mini-demo-view" data-demo-view="2" hidden><p class="mini-demo-kicker">INTERNATIONAL GRADUATES</p><label class="mini-graduate-filter">Study country <select aria-label="Sample study country"><option value="">All countries</option></select></label><svg class="mini-graduate-map" viewBox="0 0 720 314" role="group" aria-label="Sample graduate distribution by country"></svg><p class="mini-graduate-status"></p><strong class="mini-graduate-result"></strong></div>'+
 '<div class="mini-demo-view" data-demo-view="3" hidden><p class="mini-demo-kicker">JOIN THE DIRECTORY</p><b>Build your specialist profile</b><div class="mini-demo-chips"><span>Trade & experience</span><span>Location</span><span>Optional portrait</span></div><p>Add your skills, service area and availability. SIEG reviews profiles before publication.</p><a class="mini-expert-apply" href="talent-pool.html#joinTalentBottom">Create your profile ↗</a></div>'+
 '<div class="mini-demo-view mini-expert-services" data-demo-view="4" hidden><p class="mini-demo-kicker">HELP WITH YOUR NEXT PROJECT</p><a class="mini-expert-offer" href="talent-pool.html#expert-matching"><span><b>Specialist shortlist</b><small>Up to three available specialists</small></span><strong>SZL 149<small>/ request</small></strong></a><a class="mini-expert-offer" href="talent-pool.html#expert-matching"><span><b>Quote comparison</b><small>Compare written scopes and quotes</small></span><strong>SZL 449<small>/ request</small></strong></a><a class="mini-expert-offer" href="talent-pool.html#expert-matching"><span><b>Business sourcing</b><small>Proposed monthly plan · waitlist</small></span><strong>SZL 599<small>/ month</small></strong></a></div>');
if(experts){
 const trades=['Surveyors','Draughtsmen','Bricklayers','Carpenters','Plumbers','Electricians','Tilers','Housekeepers'],shortlisted=new Set();
 fetch('assets/expert-trades.json').then(r=>r.json()).then(groups=>{experts.find('.mini-expert-catalogue-count').textContent=groups.reduce((n,g)=>n+g.trades.length,0)+' trades across '+groups.length+' sectors';}).catch(()=>{});
 let index=0,graduateMap;
 const render=()=>{
  const list=experts.find('.mini-profile-list');list.replaceChildren();
  for(let i=0;i<2;i++){
   const trade=trades[(index+i)%trades.length],card=document.createElement('div');card.className='mini-profile';
   card.innerHTML='<img class="mini-avatar" src="assets/demos/expert-portrait-'+(i+1)+'.jpg" alt="Illustrative specialist portrait" loading="lazy"><span class="mini-profile-demo">SAMPLE PROFILE</span><b>'+trade+'</b><span>Eswatini</span><button type="button">Shortlist +</button>';
   const button=card.querySelector('button');
   function update(){const saved=shortlisted.has(trade);button.setAttribute('aria-pressed',String(saved));button.textContent=saved?'Shortlisted ✓':'Shortlist +';}
   button.onclick=()=>{if(shortlisted.has(trade))shortlisted.delete(trade);else shortlisted.add(trade);update();experts.out.textContent=shortlisted.size+' sample trades shortlisted.';};
   update();list.append(card);
  }
  experts.find('.mini-trade-counter').textContent=(index+1)+' / '+trades.length+' trades';
 };
 experts.el.querySelectorAll('[data-step]').forEach(button=>button.onclick=()=>{index=(index+Number(button.dataset.step)+trades.length)%trades.length;render();});
 const sample=[['TW','Taiwan',3],['ZA','South Africa',2],['GB','United Kingdom',1]],labels=new Map(sample.map(([code,label])=>[code,label])),country=experts.find('select');
 for(const [code,label] of sample)country.add(new Option(label,code));
 function choose(code){
  country.value=code;graduateMap?.select(code);
  const entry=sample.find(([id])=>id===code);
  experts.find('.mini-graduate-result').textContent=entry?entry[1]+' · '+entry[2]+' sample '+(entry[2]===1?'record':'records'):'6 sample records across 3 countries';
 }
 country.onchange=()=>choose(country.value);choose('');render();
 demoViews(experts,['The current SIEG Experts introduction and trade categories.','Browse and shortlist sample trades.','Explore illustrative graduation locations by country.','Profiles are reviewed before they appear in the directory.','Browse free. Matching requests are confirmed by SIEG before payment.'],i=>{
  if(i!==2||graduateMap||!window.SiegGraduateMap)return;
  graduateMap=window.SiegGraduateMap.mount(experts.find('.mini-graduate-map'),experts.find('.mini-graduate-status'),labels,choose);
  graduateMap.select(country.value);
  graduateMap.refresh(async()=>({countries:sample.map(([country,,count])=>({country,count}))}));
 });
}
const irrigate=panel('irrigation','SIEG Irrigate',tabs(['Overview','Layout','Equipment','Budget'])+photoOverview('02','Irrigate','Every drop matters.','Design it around your land.','Compare irrigation systems, layouts and preliminary costs.','irrigation.html','Plan your irrigation','irrigate','Sprinklers watering green crop rows','Sample irrigation design','Registered field · sprinkler layout')+
 '<div class="mini-irrigate-photo" data-demo-view="1 2" hidden><img src="assets/demos/irrigate-sprinkler-layout.png" alt="Satellite view of a field with sprinkler rows, valves, tank and pump house" loading="lazy" decoding="async"><span class="mini-irrigate-badge">Sprinkler layout</span></div>'+
 '<div class="mini-demo-view mini-irrigate-budget" data-demo-view="3" hidden><table><caption>Sample sprinkler budget · SZL</caption><thead><tr><th scope="col">Item</th><th scope="col">Amount</th></tr></thead><tbody><tr><td>Pump and tank</td><td>8,000</td></tr><tr><td>Pipes and fittings</td><td>5,500</td></tr><tr><td>Sprinklers and valves</td><td>3,000</td></tr><tr><td>Installation labour</td><td>2,000</td></tr></tbody><tfoot><tr><th scope="row">Sample total</th><td>18,500</td></tr></tfoot></table></div>');
demoViews(irrigate,['Explore the Irrigate introduction and sample design workspace.','Sample sprinkler layout · coloured rows distinguish irrigation zones.','Follow the supply route from the pump and tank to the valves and sprinkler rows.','Illustrative figures only. The full workspace calculates quantities and a budget for your design.'],i=>{if(i>0&&i<3)irrigate.find('.mini-irrigate-badge').textContent=['Sprinkler layout','Pump · tank · valves'][i-1];});
const learn=panel('education','SIEG Learn',tabs(['Overview','My books','Lesson studio','Study groups'])+
 '<div class="mini-demo-view mini-current-overview" data-demo-view="0"><div class="mini-current-hero mini-current-learn"><div><small>08 / SIEG LEARN</small><b>Teach with purpose.<br><em>Learn with confidence.</em></b><p>Books, lesson planning and study groups, together.</p><a href="education.html">Explore learning tools ↗</a></div><img src="assets/service-photos/learn-v1.webp" alt="Teacher supporting two students in a classroom" loading="lazy"></div><div class="mini-current-section"><b>Your learning workspace</b><div class="mini-current-nav"><span>My books</span><span>Lesson studio</span><span>Study groups</span></div><small>Create engaging materials, one topic at a time.</small></div></div>'+
 '<div class="mini-demo-view mini-library-preview" data-demo-view="1" hidden><div class="mini-current-nav"><span>My books</span><span>Lesson studio</span><span>Study groups</span></div><div class="mini-library-heading"><b>My books</b><a href="education.html">Add a book +</a></div><p>Keep your teaching PDFs together. Read online or choose pages for a lesson.</p><div class="mini-library-empty"><strong>▤</strong><b>Your library is ready.</b><span>Add a PDF book or start from your own notes.</span></div></div>'+
 '<div class="mini-demo-view mini-lesson-preview" data-demo-view="2" hidden><p class="mini-demo-kicker">LESSON STUDIO</p><b>From your materials to a lesson</b><div class="mini-current-fields"><span>Subject & grade</span><span>Topic or learning goal</span><span>Book pages, PDF or notes</span></div><small>Generate → Edit → PDF + PowerPoint</small><a class="mini-current-open" href="education.html">Open SIEG Learn ↗</a></div>'+
 '<div class="mini-demo-view mini-group-preview" data-demo-view="3" hidden><p class="mini-demo-kicker">SUBJECT STUDY GROUPS</p><b>Study and share ideas together</b><div class="mini-current-chat"><strong>English practice · Sample room</strong><p>Share a question or a page with your group.</p><p>Discuss it together, then add your notes.</p><small>Group chat · Attachments · Shared canvas</small></div><a class="mini-current-open" href="education.html">Explore study groups ↗</a></div>');
demoViews(learn,['The current SIEG Learn introduction and learning workspace.','Your personal book library starts empty until you add your own PDF.','Plan from a topic, book pages, PDF or your notes.','Sample discussion only. Open SIEG Learn to create or join a real group.']);


const transit=panel('transit','SIEG Transit',`
 <div class="mini-transit-search"><span class="mini-transit-location">●</span><div><small>YOUR JOURNEY</small><strong>Town centre <span>to</span> Industrial park</strong></div><span class="mini-transit-route-tag">R01</span></div>
 <div class="mini-transit-map" role="img" aria-label="Illustrative town street map with an animated sample bus, route and boarding stop">
 <svg viewBox="0 0 480 220" preserveAspectRatio="none" aria-hidden="true"><rect width="480" height="220" fill="#e9eee5"/><g fill="#d7e5cd"><path d="M0 0h100v64H0zM345 145h135v75H345zM280 0h70v43h-70z"/></g><path d="M410-20C340 40 402 80 357 125S290 175 300 240" fill="none" stroke="#b4dbe0" stroke-width="20"/>
 <g stroke="#d8d8cc" stroke-width="15" fill="none"><path d="M-10 76H490M-10 158H490M115-10V240M248-10V240M440-10V240"/></g><g stroke="#fffef9" stroke-width="11" fill="none"><path d="M-10 76H490M-10 158H490M115-10V240M248-10V240M440-10V240"/></g><g stroke="#fffdf8" stroke-width="5" fill="none"><path d="M-10 30H320M-10 117H480M-10 200H480M55-10V240M180-10V240M310-10V240M390-10V240"/></g><g fill="#d6d8cf"><path d="M66 90h32v17H66zM134 88h27v17h-27zM194 128h34v18h-34zM269 90h27v16h-27zM325 174h20v15h-20zM66 171h30v17H66zM132 171h30v17h-30zM265 46h32v18h-32z"/></g>
 <path d="M32 158H115V76H248V158H438" fill="none" stroke="#fff" stroke-width="10" stroke-linejoin="round"/><path d="M32 158H115V76H248V158H438" fill="none" stroke="#218b8c" stroke-width="5" stroke-linejoin="round"/>
 <g fill="#fff" stroke="#218b8c" stroke-width="3"><circle cx="32" cy="158" r="5"/><circle cx="115" cy="76" r="5"/><circle cx="248" cy="76" r="5"/><circle cx="438" cy="158" r="5"/></g><g font-family="Arial" font-size="10" fill="#526b70"><text x="15" y="184">Town centre</text><text x="128" y="61">Market street</text><text x="377" y="184">Industrial park</text><text x="15" y="48" fill="#778e70">Central park</text></g>
 </svg><div class="mini-transit-bus" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="17" rx="4" fill="white"/><rect x="7" y="6" width="10" height="7" rx="1" fill="#218b8c"/><circle cx="8" cy="17" r="1.5" fill="#123548"/><circle cx="16" cy="17" r="1.5" fill="#123548"/></svg></div><div class="mini-transit-you"><i></i>Your stop</div><span class="mini-transit-map-note">Illustrative route</span>
 </div>
 <div class="mini-transit-arrivals"><div class="mini-transit-arrivals-head"><strong>Approaching your stop</strong><button type="button" class="mini-transit-pause" aria-pressed="false">Pause demo</button></div><button type="button" class="mini-transit-option is-selected" data-bus="1" aria-pressed="true"><span class="mini-transit-number">01</span><span><strong>Town centre · Industrial park</strong><small>Bus SIEG 001 · 3 stops away</small></span><b>4 <small>min</small></b></button><button type="button" class="mini-transit-option" data-bus="2" aria-pressed="false"><span class="mini-transit-number">02</span><span><strong>Next bus on this route</strong><small>Bus SIEG 002 · 6 stops away</small></span><b>11 <small>min</small></b></button></div>`);
if(transit){transit.el.classList.add('mini-transit-demo');transit.out.textContent='Simulated bus movement and arrival estimates. Explore SIEG Transit for live services.';const pause=transit.find('.mini-transit-pause');pause.onclick=()=>{const paused=transit.el.classList.toggle('is-paused');pause.textContent=paused?'Play demo':'Pause demo';pause.setAttribute('aria-pressed',String(paused));};transit.el.querySelectorAll('[data-bus]').forEach(button=>button.onclick=()=>{transit.el.querySelectorAll('[data-bus]').forEach(b=>{b.classList.toggle('is-selected',b===button);b.setAttribute('aria-pressed',String(b===button));});transit.el.classList.toggle('is-second-bus',button.dataset.bus==='2');});}

for(const [demo,href] of [[ledger,'ledger.html'],[chemicals,'chemicals.html']]){
 if(!demo)continue;demo.el.classList.add('mini-dashboard-demo','mini-ag-dashboard-demo');
 const bar=document.createElement('div');bar.className='mini-dashboard-status';
 const link=document.createElement('a');link.href=href;link.textContent='Open workspace';bar.append(demo.out,link);demo.find('.mini-site').append(bar);
}
// Match the dashboard chrome while retaining the interactive sample layers.
const mapDemos=[
 [fields,'SIEG Fields','Services & analysis','Open workspace','agri-intelligence.html'],
 [irrigate,'SIEG Irrigate','Services & analysis','Open workspace','irrigation.html'],
 [hydro,'SIEG Hydrology','Services & analysis','Open workspace','hydrology.html'],
 [eco,'SIEG Eco','Services & analysis','Open workspace','enviro-intelligence.html'],
 [estate,'Property map','Filters & properties','Open Estate','property-explorer.html'],
 [address,'Entrance location','Address details','Open Address','geocoding.html'],
 [transit,'Journey workspace','Your journey','Open Transit','transit.html']
];
for(const [demo,title,drawerLabel,action,href] of mapDemos){
 if(!demo)continue;
 demo.el.classList.add('mini-dashboard-demo');
 if(demo!==transit)demo.el.classList.add('mini-map-workspace-demo');
 const site=demo.find('.mini-site');
 demo.find('.mini-title').textContent=title;
 const map=demo.find('.mini-map,.mini-irrigate-photo,.mini-transit-map');
 if(map){
  map.querySelector('.mini-zoom')?.remove();
  map.append(document.getElementById('demo-map-toolbar').content.cloneNode(true));
 }
 if(demo===irrigate&&map){
  const design=document.createElement('div');
  design.className='mini-design-workspace';
  design.dataset.demoView='1 2';
  design.hidden=map.hidden;
  const inputs=document.createElement('div');
  inputs.className='mini-sidebar';
  inputs.innerHTML='<span class="mini-field">Field boundary</span><span class="mini-field">Pump location</span><span class="mini-field">Sprinkler design</span>';
  map.replaceWith(design);
  delete map.dataset.demoView;
  design.append(inputs,map);
 }
 const sidebar=demo.find('.mini-sidebar,.mini-locate');
 if(sidebar){
  const heading=document.createElement('strong');
  heading.className='mini-dashboard-drawer-title';
  heading.textContent=drawerLabel;
  sidebar.prepend(heading);
 }
 const bar=document.createElement('div');
 bar.className='mini-dashboard-status';
 const link=document.createElement('a');
 link.href=href;
 link.textContent=action;
 bar.append(demo.out,link);
 site.append(bar);
 const state=document.createElement('p');
 state.className='mini-dashboard-ready';
 state.textContent='Interactive demo · sample data';
 if(demo===transit)site.append(state);
}
})();

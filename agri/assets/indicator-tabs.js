(()=>{'use strict';
 const list=document.getElementById('agriModules');
 const panel=document.getElementById('sidebarHost');
 const buttons=[...list.querySelectorAll('button[role="tab"]')];
 const labels={soil:'Soil properties',suitability:'Land Suitability',weather:'Climate',recommendations:'Suitable crops',monitoring:'Crop monitoring',yield:'Yield estimation',warning:'Early Warning'};
 window.SiegFieldsSelection={items:()=>buttons.filter(b=>document.getElementById('include-'+b.dataset.key)?.checked).map(b=>b.dataset.key),labels};
 const css=document.createElement('style');css.textContent='#agriModules .report-card{position:relative;min-width:0;display:flex}:root body .agri-indicator-grid #agriModules .report-card>button{width:100%;height:100%;min-height:108px!important;padding:20px 12px 44px!important;white-space:normal!important;line-height:1.4!important;font-size:16px!important}:root body .agri-indicator-grid #agriModules .report-card>.report-item-check{position:absolute;z-index:2;top:auto!important;bottom:5px;right:6px;left:auto!important;transform:none;display:inline-flex!important;align-items:center;justify-content:center;gap:5px!important;width:auto!important;min-width:0!important;min-height:28px!important;height:28px!important;margin:0!important;padding:7px!important;font:400 11px/1.2 Arial,sans-serif!important;white-space:nowrap;color:#174a4d;background:transparent;border:0!important;border-radius:5px;cursor:pointer}:root body .agri-indicator-grid #agriModules .report-item-check>input[type=checkbox]{appearance:auto!important;width:13px!important;height:13px!important;min-width:13px!important;min-height:13px!important;max-width:13px!important;flex:0 0 13px!important;margin:0!important;padding:0!important;accent-color:#218b8c}.fields-free-view{grid-column:1/-1;width:100%;margin:12px 0;padding:14px;border:1px solid #218b8c;border-radius:12px;background:#eef7f4;color:#123047}';document.head.append(css);
 const iconPaths={warning:'<path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5m0 3v1"/>',soil:'<path d="M4 7h16M4 12h16M4 17h16M7 7l3 5-3 5m9-10-3 5 3 5"/>',suitability:'<path d="m3 8 9-5 9 5-9 5-9-5Zm0 5 9 5 9-5M3 18l9 5 9-5"/>',weather:'<circle cx="9" cy="8" r="3"/><path d="M9 1v1M2 8H1m3-5L3 2m12 1 1-1M7 19h12a3 3 0 0 0 0-6 5 5 0 0 0-9-2 4 4 0 0 0-3 8Z"/>',recommendations:'<path d="M12 21V10m0 6C5 16 3 12 3 5c7 0 9 4 9 11Zm0-3c0-7 4-10 9-10 0 7-3 10-9 10Z"/>',monitoring:'<path d="M3 3v18h18M6 15l4-5 4 3 6-8"/><circle cx="20" cy="5" r="1"/>',yield:'<path d="M4 21V11h4v10m4 0V7h4v14m4 0V3M3 21h19M5 6l5-3 4 1 6-3"/>'};
 const polish=document.createElement('style');polish.textContent=':root body .agri-indicator-grid{gap:12px!important}:root body .agri-indicator-grid #agriModules .report-card>button{display:flex!important;flex-direction:column;gap:6px;min-height:108px!important;padding:12px 10px 30px!important;border:1px solid #d5e2dc!important;border-radius:14px!important;background:linear-gradient(145deg,#fafbf8,#f1f5ef)!important;color:#143447!important;box-shadow:0 3px 10px #12304705;transition:background .18s,border-color .18s,box-shadow .18s,transform .18s;font-weight:600!important}:root body .agri-indicator-grid #agriModules .report-card>button[aria-selected=true]{background:linear-gradient(140deg,#218e90,#17777d)!important;color:#fff!important;border-color:#218b8c!important;box-shadow:0 4px 10px #18777d1a}:root body .agri-indicator-grid #agriModules .service-icon{display:grid;place-items:center;width:28px;height:28px;flex:0 0 28px;border-radius:9px;background:#e1eeE8;color:#247d7a}:root body .agri-indicator-grid #agriModules button[aria-selected=true] .service-icon{background:#ffffff20;color:#fff}:root body .agri-indicator-grid #agriModules .service-icon svg{width:20px;height:20px}:root body .agri-indicator-grid #agriModules .service-title{display:block!important;width:100%!important;min-width:0!important;max-width:100%!important;font:600 14px/1.3 Arial,sans-serif!important;white-space:nowrap!important;overflow-wrap:normal!important;word-break:normal!important;text-wrap:balance;letter-spacing:0!important}:root body .agri-indicator-grid #agriModules .report-card:has(button[aria-selected=true]) .report-item-check{background:transparent}.report-card:has(button[aria-selected=true]) .report-item-check>input[type=checkbox]{accent-color:#fff}:root body .agri-indicator-grid #agriModules .report-card:focus-within{border-radius:16px;outline:2px solid #17878a;outline-offset:3px}@media(hover:hover){:root body .agri-indicator-grid #agriModules .report-card>button:hover{border-color:#7bb7af!important;box-shadow:0 6px 16px #14344712;transform:translateY(-2px)}}@media(prefers-reduced-motion:reduce){:root body .agri-indicator-grid #agriModules .report-card>button{transition:none;transform:none!important}}';document.head.append(polish);
 for(const b of buttons){const title=document.createElement('span');title.className='service-title';title.textContent=b.textContent.trim();const icon=document.createElement('span');icon.className='service-icon';icon.setAttribute('aria-hidden','true');icon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+iconPaths[b.dataset.key]+'</svg>';b.replaceChildren(icon,title);}
 for(const b of buttons){const card=document.createElement('div');card.className='report-card';b.before(card);card.append(b);const label=document.createElement('label'),input=document.createElement('input');label.className='report-item-check';input.type='checkbox';input.id='include-'+b.dataset.key;input.checked=b.dataset.key==='soil'||b.dataset.key==='recommendations';input.setAttribute('aria-label','Include '+labels[b.dataset.key]+' in report');label.title='Include in your report';label.append(input);card.append(label);}
 function fitServiceTitles(){for(const b of buttons){const title=b.querySelector('.service-title');if(!title||!title.clientWidth)continue;let size=14;title.style.setProperty('font-size',size+'px','important');while(title.scrollWidth>title.clientWidth+1&&size>10){size-=.5;title.style.setProperty('font-size',size+'px','important');}}}
 if(window.ResizeObserver){const observer=new ResizeObserver(fitServiceTitles);for(const b of buttons)observer.observe(b);}window.addEventListener('resize',fitServiceTitles);requestAnimationFrame(fitServiceTitles);
 const free=document.createElement('button');free.type='button';free.className='fields-free-view';free.innerHTML='<span>View Land Suitability</span><small>Free · once per account</small>';for(const [key,value]of Object.entries({display:'flex','flex-direction':'column','white-space':'normal',width:'100%','min-width':'0','max-width':'100%',height:'auto','font-size':'12px','line-height':'1.45',padding:'10px 12px','box-sizing':'border-box',gap:'3px'}))free.style.setProperty(key,value,'important');for(const line of free.children){line.style.setProperty('white-space','normal','important');line.style.setProperty('font-size','12px','important');line.style.setProperty('max-width','100%','important');}list.after(free);free.onclick=async()=>{free.disabled=true;try{if(window.SiegExplicitAnalysis){document.getElementById('siegFreeTrialStart')?.click();for(const input of list.querySelectorAll('input[type=checkbox]'))input.checked=input.id==='include-suitability';window.SiegIndicatorSelection?.restore([{group:'suitability',value:'Land suitability',label:'Land suitability'}]);return;}const g=window.siegeAgri?.getGeometry();if(!g)throw Error('Define your field boundary first.');if(await window.SiegeUsage.ensure(g,{freeSuitability:true,task:'suitability'})){buttons.find(b=>b.dataset.key==='suitability').click();window.showTab('suitability');const action=window.contentPanel?.el.querySelector('button');action?.click();}}catch(e){const n=document.getElementById('usageStatus');n.hidden=false;n.textContent=e.message;}finally{free.disabled=false;}};
 function choose(button){
  for(const item of buttons){
   const active=item===button;
   item.setAttribute('aria-selected',String(active));
   item.tabIndex=active?0:-1;
  }
  panel.hidden=button.dataset.key==='yield';const yieldPanel=document.getElementById('yieldPanel');if(yieldPanel)yieldPanel.hidden=button.dataset.key!=='yield';panel.setAttribute('aria-labelledby',button.id);
  const label=button.textContent.trim();
  const title=document.getElementById('previewTitle');
  const description=document.getElementById('previewDescription');
  if(title)title.textContent=label;
  if(description)description.textContent=button.dataset.description;
  list.dispatchEvent(new CustomEvent('sieg-indicator-change',{detail:{key:button.dataset.key,label}}));
 }
 for(const button of buttons)button.onclick=()=>choose(button);
 list.addEventListener('keydown',event=>{
  const i=buttons.indexOf(event.target);
  if(i<0)return;
  const last=buttons.length-1;
  const next={ArrowRight:i===last?0:i+1,ArrowLeft:i===0?last:i-1,Home:0,End:last}[event.key];
  if(next===undefined)return;
  event.preventDefault();
  buttons[next].focus();
  choose(buttons[next]);
 });
 document.addEventListener('DOMContentLoaded',()=>{
  const status=document.getElementById('fieldsConnectionStatus');
  const retry=document.getElementById('fieldsRetryAnalysis');
  if(status&&retry&&!retry.onclick){
   status.textContent='Analysis controls could not start. Reload the workspace to try again.';
   retry.onclick=()=>location.reload();
   retry.hidden=false;
  }
 },{once:true});
})();

/* Map-first service workspaces; reuse existing controls and their event handlers. */
(function(root){'use strict';
// Capture before each drawing handler so the first vertex is placed on imagery.
document.addEventListener('click',event=>{const button=event.target.closest?.('button,a');if(!button||button.disabled)return;const text=button.textContent.trim();if(!['draw','irDraw'].includes(button.id)&&!/^draw\s+(polygon|boundary|area|field)\b/i.test(text)&&!button.classList.contains('leaflet-draw-draw-polygon'))return;const satellite=document.getElementById('irSatellite')||document.getElementById('satelliteView');if(satellite){satellite.click();return;}const radio=[...document.querySelectorAll('input[type=radio]')].find(el=>/satellite/i.test(el.value)&&el.closest('.sieg-layers-menu,.transit-control-panel'));if(radio&&!radio.checked)radio.click();},true);
const icon=p=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">'+p+'</svg>';
const globe=icon('<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 7h14M5 17h14"/>');
const reportAreas=new Set();
function reportArea(canvas,host){
 let strip=host.querySelector('.map-bottom,.hydro-map-bottom,.map-caption,.sieg-report-status-strip');
 if(!strip){strip=document.createElement('div');strip.className='sieg-report-status-strip sieg-report-status-strip--new';const frame=canvas.closest('.ir-map-frame,.geo-map-section,.map-wrap,.siege-map-frame')||canvas.parentElement;frame.append(strip);const status=host.querySelector('#irStatus');if(status)strip.append(status);}
 strip.classList.add('sieg-report-status-strip');let actions=strip.querySelector('.sieg-map-report-actions');
 if(!actions){actions=document.createElement('div');actions.className='sieg-map-report-actions';actions.setAttribute('role','group');actions.setAttribute('aria-label','Report actions');strip.append(actions);}
 reportAreas.add({strip,actions});return actions;
}
function compactReportActions(){
 for(const {strip,actions}of reportAreas){
  const download=document.getElementById('siegReportDownload');if(download&&download.parentElement!==actions)actions.append(download);
  for(const id of ['fieldsInlineReportDownload','ecoInlineReportDownload'])document.getElementById(id)?.remove();
  const progress=document.getElementById('siegReportProgress');if(progress){let status=strip.querySelector('#status,#irStatus,#mapStatus,.sieg-report-status-message');if(!status){status=document.createElement('span');status.className='sieg-report-status-message';status.setAttribute('role','status');status.setAttribute('aria-live','polite');strip.append(status);}if(progress.textContent&&status.textContent!==progress.textContent)status.textContent=progress.textContent;if(!progress.hidden)progress.hidden=true;}
 }
}
root.SiegReportActions={refresh:compactReportActions};
function enhance(map){const canvas=map?.getContainer();if(!canvas||canvas.dataset.refreshMounted)return;if(!canvas.querySelector('.sieg-map-nav'))return;canvas.dataset.refreshMounted='true';canvas.classList.add('sieg-refreshed-map');
const corner=canvas.querySelector('.leaflet-top.leaflet-left');if(corner){for(const [key,value] of Object.entries({left:'auto',right:'14px',top:'14px',width:'max-content',alignItems:'flex-end'}))corner.style.setProperty(key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase()),value,'important');}
const nav=canvas.querySelector('.sieg-map-nav'),tools=canvas.querySelector('.sieg-map-tools'),layers=tools?.querySelector('details');
if(layers){nav.append(layers);tools.remove();}
const fit=nav.querySelector('.sieg-fit-map-control,.sieg-nav-fit')||[...nav.children].find(x=>x.querySelector('.sieg-fit-map-button'));
if(fit)fit.remove();
if(layers)nav.append(layers);
const analysis=!!canvas.closest('#shell,.dashboard,.ir-workspace'),estate=canvas.id==='map'&&!!document.getElementById('sidebar'),address=canvas.id==='geoMap';
if(!analysis&&!estate&&!address)return;
const host=canvas.closest('#shell,.dashboard,.ir-workspace,.geo-workspace,.shell');const panel=host?.querySelector('.agri-sidebar,.hydro-sidebar,.dashboard>aside,.ir-controls,.geo-panel,#sidebar');if(!host||!panel)return;
host.classList.add('sieg-map-first');if(analysis)host.classList.add('sieg-flush-panel');panel.classList.add('sieg-floating-panel');
const drawer=document.createElement('div');drawer.className='sieg-panel-drawer';host.append(drawer);drawer.append(panel);
const sizePanel=()=>{
 const box=canvas.getBoundingClientRect(),outer=host.getBoundingClientRect(),top=box.top-outer.top,left=box.left-outer.left;
 drawer.style.top=(top+(estate||analysis?0:62))+'px';drawer.style.left=left+'px';drawer.style.height=(estate||analysis?canvas.clientHeight:Math.max(140,canvas.clientHeight-72))+'px';if(estate)drawer.style.width=(canvas.clientWidth/3)+'px';
 for(const [key,value]of Object.entries({top:'0px',left:'0px',height:'100%','min-height':'0px','max-height':'100%',margin:'0px'}))panel.style.setProperty(key,value,'important');
 const opener=host.querySelector('.sieg-panel-toggle');if(opener){opener.style.setProperty('top',(top+10)+'px','important');opener.style.setProperty('left',left+'px','important');}
};sizePanel();if(root.ResizeObserver)new ResizeObserver(sizePanel).observe(canvas);

if(estate){const results=document.getElementById('results');if(results)panel.append(results);host.classList.add('sieg-estate-first');}
const title=analysis?'Services & analysis':estate?'Filters & properties':'Address details';
const toggle=document.createElement('button');toggle.type='button';toggle.className='sieg-panel-toggle';toggle.textContent=title;toggle.setAttribute('aria-expanded','true');toggle.setAttribute('aria-label','Show or hide '+title.toLowerCase());host.append(toggle);sizePanel();
const head=document.createElement('div');head.className='sieg-floating-head';const label=document.createElement('strong');label.textContent=title;const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Hide '+title.toLowerCase());head.append(label,close);panel.prepend(head);
if(analysis){
 const report=document.querySelector('#requestReport,#irReview,#requestHydrologyReport,#requestEnvironmentalReport');
 if(report){const card=report.closest('.sieg-report-request'),oldFooter=card?.closest('.sieg-report-footer'),footer=reportArea(canvas,host);report.title=report.textContent.trim();report.setAttribute('aria-label',report.title);report.textContent='Request report';const fineprint=card?.querySelector('.sieg-report-fineprint');if(fineprint){fineprint.classList.add('sieg-drawer-report-note');footer.append(fineprint)}footer.append(report);for(const id of ['fieldsReportRequestStatus','ecoReportRequestStatus','hydroReportRequestStatus']){const note=document.getElementById(id);if(note)footer.append(note);}card?.remove();if(oldFooter&&!oldFooter.children.length)oldFooter.remove();}
}
if(estate||address){
 const footer=reportArea(canvas,host);
 if(estate){const b=document.createElement('button');b.id='estateDrawerReport';b.type='button';b.className='sieg-report-button';b.textContent='Request report';b.setAttribute('aria-label','Request SIEG Estate Report');b.onclick=()=>window.requestEstateService?.();footer.append(b);}
 else{const b=document.getElementById('downloadGeocodes');if(b){const bar=b.closest('.service-action-bar');b.classList.add('sieg-report-button');b.textContent='Request address files';b.setAttribute('aria-label','Request SIEG Address files');footer.append(b);bar?.remove();}}
 compactReportActions();
}
const admin=host.querySelector('[aria-label="Admin operating mode"]');if(admin)panel.append(admin);compactReportActions();
for(const heading of panel.querySelectorAll('p,h2,h3,h4,.eyebrow')){if(heading.closest('.sieg-procedure'))continue;if(/^(?:\d+\s*)?(define your area|choose your service)$/i.test(heading.textContent.trim()))heading.remove();}


let hideTimer,pointerOver=false;function hovering(){return pointerOver||!!root.matchMedia?.('(hover: hover)').matches&&panel.matches(':hover')}function scheduleHide(){clearTimeout(hideTimer);if(hovering()||host.classList.contains('is-panel-hidden'))return;hideTimer=setTimeout(()=>{if(hovering())return;if(panel.contains(document.activeElement)||document.querySelector('dialog[open]')){scheduleHide();return;}set(false);},10000);}
function set(open){clearTimeout(hideTimer);host.classList.toggle('is-panel-hidden',!open);panel.inert=!open;toggle.setAttribute('aria-expanded',String(open));if(!open&&panel.contains(document.activeElement))toggle.focus({preventScroll:true});map.invalidateSize({pan:false,animate:false});if(open)scheduleHide();}
panel.addEventListener('pointerenter',event=>{if(event.pointerType==='touch')return;pointerOver=true;clearTimeout(hideTimer)});
panel.addEventListener('pointerleave',()=>{pointerOver=false;scheduleHide()});
panel.addEventListener('pointercancel',()=>{pointerOver=false;scheduleHide()});
for(const event of ['pointerdown','input','change','keydown','scroll'])panel.addEventListener(event,scheduleHide,{passive:true});
toggle.onclick=()=>set(host.classList.contains('is-panel-hidden'));close.onclick=()=>set(false);set(true);
// Keep the original controls alive for the layer menu's handlers and payment gates.
const menu=canvas.querySelector('.sieg-layer-services');if(menu){const ids=['agriModules','hydroModules','modules'];for(const id of ids){const original=document.getElementById(id);if(original&&menu.children.length){original.classList.add('sieg-duplicate-services');original.style.setProperty('display','none','important');original.setAttribute('aria-hidden','true');}}
const watch=new MutationObserver(()=>{if(menu.children.length)for(const id of ids){const original=document.getElementById(id);if(original){original.classList.add('sieg-duplicate-services');original.style.setProperty('display','none','important');original.setAttribute('aria-hidden','true');}}});watch.observe(menu,{childList:true});}
root.dispatchEvent(new Event('resize'));
}
root.SiegRefreshWorkspace=enhance;root.addEventListener('sieg-map-controls-ready',e=>enhance(e.detail.map));
function start(){for(const map of root.SiegWorkspaceMaps||[])enhance(map);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(window);

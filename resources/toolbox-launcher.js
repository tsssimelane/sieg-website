/* Compact launcher; reuse each live tool so inputs, maps and results survive closing. */
(async()=>{'use strict';
const toolbox=document.getElementById('sieg-toolbox');if(!toolbox)return;
// Admin tools are created only after the server verifies the signed-in role.
try{const response=await fetch('/api/analysis/config',{cache:'no-store'}),config=await response.json();if(response.ok&&config.admin===true){
 for(const [id,name,hint]of [['catchment-delineation','Catchment delineation','Trace upstream drainage and download catchment, river and stream shapefiles.'],['wetland-mapping','Wetland mapping','Screen water and wetland vegetation, then download shapefiles.']]){
  const section=document.createElement('section');section.id=id;section.className='resource-card admin-hydrology-tool';
  const heading=document.createElement('h2');heading.textContent=name;const intro=document.createElement('p');intro.textContent='Admin only · '+hint;
  const frame=document.createElement('iframe');frame.title=name+' — admin Toolbox';frame.dataset.src='hydrology/index.html?toolbox='+id;frame.style.cssText='display:block;width:100%;height:82dvh;min-height:640px;border:0;border-radius:16px';section.append(heading,intro,frame);toolbox.append(section);
 }
}}catch{/* Other local Toolbox tools remain available when admin verification fails. */}
const tools=[...toolbox.querySelectorAll('section.resource-card')].filter(el=>el.id);
const grid=document.createElement('div');grid.className='toolbox-launcher-grid';grid.setAttribute('aria-label','SIEG Toolbox tools');
const dialog=document.createElement('dialog');dialog.className='toolbox-window';dialog.id='toolboxWindow';dialog.setAttribute('aria-labelledby','toolboxWindowTitle');
const head=document.createElement('header');head.className='toolbox-window-header';
const title=document.createElement('h2');title.id='toolboxWindowTitle';
const close=document.createElement('button');close.type='button';close.className='toolbox-window-close';close.textContent='Close ×';close.setAttribute('aria-label','Close tool window');
const body=document.createElement('div');body.className='toolbox-window-body';head.append(title,close);dialog.append(head,body);document.querySelector('main.resources-page').append(dialog);
const entries=new Map();let current,opener;
function resizeMaps(){window.dispatchEvent(new Event('resize'));for(const map of window.SiegWorkspaceMaps||[])map.invalidateSize({pan:false,animate:false});}
function restore(){if(!current)return;current.marker.after(current.tool);current.tool.hidden=true;current=undefined;document.body.classList.remove('toolbox-window-open');if(entries.has(location.hash.slice(1)))history.replaceState(null,'','#sieg-toolbox');opener?.focus({preventScroll:true});}
function open(id,button){const entry=entries.get(id);if(!entry)return;toolbox.open=true;if(current&&current!==entry){current.marker.after(current.tool);current.tool.hidden=true;}current=entry;opener=button||entry.button;title.textContent=entry.name;body.append(entry.tool);entry.tool.hidden=false;const frame=entry.tool.querySelector('iframe[data-src]');if(frame&&!frame.getAttribute('src'))frame.src=frame.dataset.src;body.scrollTop=0;if(!dialog.open)dialog.showModal();document.body.classList.add('toolbox-window-open');history.replaceState(null,'','#'+id);requestAnimationFrame(()=>{resizeMaps();requestAnimationFrame(resizeMaps)});}
for(const tool of tools){
 const name=tool.querySelector('h2')?.textContent.trim()||tool.id;
 const button=document.createElement('button');button.type='button';button.className='toolbox-launcher';button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','toolboxWindow');
 const icon=document.createElement('span');icon.className='toolbox-launcher-icon';icon.setAttribute('aria-hidden','true');const original=tool.querySelector('.gps-tool-icon svg,.toolbox-icon svg');if(original)icon.append(original.cloneNode(true));else icon.textContent='◇';
 const label=document.createElement('strong');label.textContent=name;
 const hint=document.createElement('span');hint.className='toolbox-launcher-hint';hint.textContent=tool.querySelector('.toolbox-flow,.resource-tool-intro>span,p')?.textContent.trim()||'Open tool';
 const action=document.createElement('span');action.className='toolbox-launcher-open';action.textContent='Open tool ↗';button.append(icon,label,hint,action);grid.append(button);
 const marker=document.createComment('Tool home: '+tool.id);tool.before(marker);tool.hidden=true;const entry={tool,marker,button,name};entries.set(tool.id,entry);button.addEventListener('click',()=>open(tool.id,button));
}
for(const source of toolbox.querySelectorAll(':scope > .resource-grid'))source.hidden=true;
toolbox.querySelector('.toolbox-intro').after(grid);
close.addEventListener('click',()=>dialog.close());dialog.addEventListener('close',restore);
document.querySelectorAll('.resource-hero a').forEach(link=>{if(entries.has(link.hash.slice(1)))link.addEventListener('click',event=>{event.preventDefault();open(link.hash.slice(1),link)});});
window.addEventListener('hashchange',()=>{const id=location.hash.slice(1);if(entries.has(id))open(id);});
if(entries.has(location.hash.slice(1)))open(location.hash.slice(1));
})();

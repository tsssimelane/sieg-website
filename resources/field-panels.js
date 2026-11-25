/* Map-edge drawer. Hiding never stops GPS or discards form entries. */
(()=>{'use strict';const $=id=>document.getElementById(id),tool=$('mapping'),workflow=$('fieldWorkflow'),toggle=$('fieldPanelsToggle'),auto=$('fieldPanelsAuto'),map=$('fieldMap');
 const stage=document.createElement('div');stage.className='capture-map-stage';map.before(stage);stage.append(map);
 const panel=document.createElement('aside');panel.id='captureMapPanel';panel.className='capture-map-panel';panel.setAttribute('aria-label','Capture fields and questionnaire');
 const header=document.createElement('header');header.className='capture-panel-heading';const title=document.createElement('strong');title.textContent='Fields & capture';const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Close capture panel');header.append(title,close);
 const scroll=document.createElement('div');scroll.className='capture-panel-scroll';scroll.append(tool.querySelector('.field-setup-panel'),workflow);workflow.open=true;panel.append(header,scroll);stage.append(panel,toggle);toggle.classList.add('capture-map-tab');toggle.setAttribute('aria-controls',panel.id);
 let timer,inside=false,open=true;
 function clear(){clearTimeout(timer)}
 function sync(){panel.classList.toggle('is-closed',!open);panel.inert=!open;panel.setAttribute('aria-hidden',String(!open));toggle.setAttribute('aria-expanded',String(open));toggle.textContent='Fields & capture';toggle.setAttribute('aria-label',open?'Hide fields and capture panel':'Show fields and capture panel');toggle.title=open?'Hide capture panel':'Show capture panel';$('fieldWorkflowHint').textContent=auto.checked?'Auto-hide enabled':'Panel stays open';}
 function show(){open=true;sync();schedule(8000)}
 function hide(){if(panel.contains(document.activeElement))toggle.focus({preventScroll:true});open=false;sync();clear()}
 function schedule(delay=4000){clear();if(!auto.checked||!open)return;timer=setTimeout(()=>{if(inside||panel.contains(document.activeElement)||!document.hasFocus()||!panel.getClientRects().length){schedule();return;}hide()},delay)}
 toggle.onclick=()=>open?hide():show();close.onclick=hide;auto.onchange=()=>{sync();auto.checked?schedule():clear()};panel.addEventListener('pointerenter',()=>{inside=true;clear()});panel.addEventListener('pointerleave',()=>{inside=false;schedule()});panel.addEventListener('focusin',clear);panel.addEventListener('focusout',()=>schedule());panel.addEventListener('pointerdown',clear);window.addEventListener('pagehide',clear);window.SiegFieldPanels={show};sync();schedule(8000);
 if(window.L){L.DomEvent.disableClickPropagation(panel);L.DomEvent.disableClickPropagation(toggle);L.DomEvent.disableScrollPropagation(panel)}
})();

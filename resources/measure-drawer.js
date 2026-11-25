/* Reparent live measurement controls; drawer visibility never resets a measurement. */
(()=>{'use strict';const tool=document.getElementById('measure'),map=document.getElementById('measureMap'),workflow=tool?.querySelector('.measure-workflow');if(!map||!workflow)return;
 const stage=document.createElement('div');stage.className='measure-map-stage';map.before(stage);stage.append(map);
 const panel=document.createElement('aside');panel.id='measureDrawer';panel.className='measure-map-drawer';panel.setAttribute('aria-label','Measurement controls and results');
 const head=document.createElement('header');head.className='measure-drawer-heading';const title=document.createElement('strong');title.textContent='Measurement';const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Close measurement drawer');head.append(title,close);
 const scroll=document.createElement('div');scroll.className='measure-drawer-scroll';scroll.append(workflow);panel.append(head,scroll);
 const tab=document.createElement('button');tab.id='measureDrawerToggle';tab.type='button';tab.textContent='Measurement';tab.setAttribute('aria-controls',panel.id);stage.append(panel,tab);let open=true;
 function sync(){panel.classList.toggle('is-closed',!open);panel.inert=!open;panel.setAttribute('aria-hidden',String(!open));tab.setAttribute('aria-expanded',String(open));tab.setAttribute('aria-label',open?'Hide measurement drawer':'Show measurement drawer');tab.title=open?'Hide measurement drawer':'Show measurement drawer'}
 function hide(){if(panel.contains(document.activeElement))tab.focus({preventScroll:true});open=false;sync()}
 tab.onclick=()=>{open=!open;sync()};close.onclick=hide;sync();if(window.L){L.DomEvent.disableClickPropagation(panel);L.DomEvent.disableScrollPropagation(panel);L.DomEvent.disableClickPropagation(tab)}
})();

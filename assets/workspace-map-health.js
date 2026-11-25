(()=>{'use strict';
 const canvas=document.getElementById('map');
 const panel=document.getElementById('mapLoadStatus');
 if(!canvas||!panel)return;
 const message=panel.querySelector('span'),retry=panel.querySelector('button');
 const map=window.SiegReportMap;
 function show(text,canRetry=false){message.textContent=text;retry.hidden=!canRetry;panel.hidden=false;}
 if(!map){
  show('The map couldn’t start. Reload this workspace to try again.',true);
  retry.onclick=()=>location.reload();
  return;
 }
 const hasTiles=()=>[...canvas.querySelectorAll('.sieg-basemap-tiles img.leaflet-tile-loaded')].some(img=>img.naturalWidth>0);
 let timer;
 function refresh(){
  if(hasTiles()){clearTimeout(timer);panel.hidden=true;}
  else if(panel.hidden){show('Loading the basemap…');waitForTiles();}
 }
 function waitForTiles(){
  clearTimeout(timer);
  timer=setTimeout(()=>{if(!hasTiles())show('The basemap didn’t load. Try again or switch between Street and Satellite.',true);},12000);
 }
 retry.onclick=()=>{
  show('Loading the basemap…');
  map.invalidateSize({pan:false,debounceMoveend:true});
  map.eachLayer(layer=>{if(layer.options?.className==='sieg-basemap-tiles')layer.redraw?.();});
  waitForTiles();
 };
 if(window.L?.DomEvent)window.L.DomEvent.disableClickPropagation(panel);
 const watch=new MutationObserver(refresh);
 watch.observe(canvas,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
 if(window.ResizeObserver){
  let frame;
  new ResizeObserver(()=>{
   cancelAnimationFrame(frame);
   frame=requestAnimationFrame(()=>{if(canvas.clientWidth&&canvas.clientHeight)map.invalidateSize({pan:false,debounceMoveend:true});});
  }).observe(canvas);
 }
 waitForTiles();
 refresh();
})();

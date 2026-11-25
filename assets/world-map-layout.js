/* Keep the map canvas within the extent of a single Mercator world. */
(function(root){'use strict';
 const mounted=new WeakMap(),latitude=85.0511287798066;
 const worldBounds=[[-latitude,-180],[latitude,180]];
 root.L?.GridLayer.mergeOptions({noWrap:true});
 function metrics(width,height=width<=640?600:800){
  const zoom=Math.max(0,Math.ceil(Math.log2(Math.max(width,height)/256)));
  return {zoom,height};
 }
 function set(style,name,value){if(style.getPropertyValue(name)!==value)style.setProperty(name,value,'important')}
 function mount(map,{standardHeight=true,homeView}={}){
  if(mounted.has(map))return;
  const canvas=map.getContainer(),frame=canvas.closest('.siege-map-frame,.ir-map-frame,.map-wrap');
  const state={zoom:0,height:256,first:true,applying:false,homeView};mounted.set(map,state);
  function alignPanel(){
   if(!frame)return;
   const panel=root.document?.querySelector('.agri-sidebar,.hydro-sidebar,.dashboard>aside,.ir-controls,.geo-panel,#results');
   if(!panel||panel.classList.contains("sieg-floating-panel"))return;
   const height=frame.getBoundingClientRect().height;
   if(height<=0)return;
   set(panel.style,'box-sizing','border-box');
   for(const name of ['height','min-height','max-height'])set(panel.style,name,height+'px');
   set(panel.style,'margin-top','0px');
   const offset=frame.getBoundingClientRect().top-panel.getBoundingClientRect().top;
   if(Math.abs(offset)<24)set(panel.style,'margin-top',Math.max(0,offset)+'px');
   set(panel.style,'align-self','start');set(panel.style,'overflow-y','scroll');set(panel.style,'overflow-x','hidden');set(panel.style,'scrollbar-gutter','stable');
  }
  function apply(){
   if(state.applying)return;
   const width=canvas.clientWidth||frame?.clientWidth||0;if(!width)return;
   const desired=metrics(width,standardHeight?undefined:canvas.clientHeight),signature=width+'x'+desired.height+'@'+(frame?.querySelector('.siege-map-header,.map-tools')?.getBoundingClientRect().height||0);if(!state.first&&state.signature===signature)return;state.signature=signature;
   state.applying=true;
   try{
    const next=metrics(width,standardHeight?undefined:canvas.clientHeight),center=map.getCenter(),oldZoom=map.getZoom(),overview=state.first||(oldZoom<=state.zoom+.001&&Math.abs(center.lat)<1);
    state.zoom=next.zoom;state.height=next.height;
    if(standardHeight){
     set(canvas.style,'height',next.height+'px');set(canvas.style,'min-height',next.height+'px');set(canvas.style,'max-height',next.height+'px');set(canvas.style,'flex','none');
     if(frame){
      set(frame.style,'align-self','start');set(frame.style,'min-height','0px');set(frame.style,'max-height','none');
      if(root.getComputedStyle(canvas).position==='absolute'){
       const header=frame.querySelector('.siege-map-header,.map-tools'),headerHeight=header?.getBoundingClientRect().height||0;
       set(canvas.style,'top',headerHeight+'px');set(canvas.style,'bottom','auto');
       set(frame.style,'height',(headerHeight+next.height)+'px');
      }else set(frame.style,'height','auto');
     }
    }
    // Finish layout changes before constraining the map. setMinZoom can start
    // an animated zoom on a newly resized canvas and leave Leaflet mid-transition.
    map.stop();
    map.setMaxBounds(null);
    map.invalidateSize({pan:false,animate:false});
    if(overview)map.setView([0,0],next.zoom,{animate:false,reset:true});
    else if(oldZoom<next.zoom)map.setView([center.lat,center.lng],next.zoom,{animate:false,reset:true});
    map.setMinZoom(next.zoom);
    map.options.maxBoundsViscosity=1;
    map.setMaxBounds(worldBounds);
    if(!overview)map.panInsideBounds(map.options.maxBounds,{animate:false});
    state.first=false;
    if(standardHeight)root.requestAnimationFrame(alignPanel);
   }finally{state.applying=false}
  }
  let pending;
  function schedule(){if(pending)return;pending=root.requestAnimationFrame(()=>{pending=null;apply()})}
  if(root.ResizeObserver){const observer=new root.ResizeObserver(()=>{schedule();if(standardHeight)root.requestAnimationFrame(alignPanel)});observer.observe(canvas);if(frame)observer.observe(frame);state.observer=observer}
  root.addEventListener('resize',schedule);
  map.on('unload',()=>{state.observer?.disconnect();root.removeEventListener('resize',schedule);if(pending)root.cancelAnimationFrame(pending);mounted.delete(map)});
  state.apply=apply;apply();
 }
 function fit(map){mount(map);const state=mounted.get(map);state.apply();map.stop();if(state.homeView)state.homeView(map);else map.setView([0,0],state.zoom,{animate:false})}
 root.SiegWorldMap={mount,fit,metrics};
})(window);

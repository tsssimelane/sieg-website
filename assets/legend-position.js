/* AOI-aware legend placement shared by the four analysis workspaces. */
(function(root){'use strict';
function inRing(p,ring){let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
function inside(p,polys){return polys.some(poly=>inRing(p,poly[0])&&!poly.slice(1).some(hole=>inRing(p,hole)));}
// Exact segment/rectangle tests catch thin boundary lines missed by sampling.
function crosses(a,b,r){let lo=0,hi=1;const dx=b[0]-a[0],dy=b[1]-a[1];for(const [p,q]of [[-dx,a[0]-r.x],[dx,r.x+r.w-a[0]],[-dy,a[1]-r.y],[dy,r.y+r.h-a[1]]]){if(!p){if(q<0)return false;continue;}const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return false;}return true;}
function score(box,polys){const r={x:box.x-20,y:box.y-20,w:box.w+40,h:box.h+40};
 if([[r.x,r.y],[r.x+r.w,r.y],[r.x,r.y+r.h],[r.x+r.w,r.y+r.h]].some(p=>inside(p,polys)))return 1;
 for(const poly of polys)for(const ring of poly)for(let i=0;i<ring.length;i++)if(crosses(ring[i],ring[(i+1)%ring.length],r))return 1;
 return 0;
}
function choose(candidates,polys,obstacles=[]){return candidates.map((box,index)=>({box,index,cost:score(box,polys)+100*obstacles.reduce((s,r)=>s+Math.max(0,Math.min(box.x+box.w,r.x+r.w)-Math.max(box.x,r.x))*Math.max(0,Math.min(box.y+box.h,r.y+r.h)-Math.max(box.y,r.y))/(box.w*box.h),0)})).sort((a,b)=>a.cost-b.cost||a.index-b.index)[0];}
function polygons(g){if(g?.type==='Feature')return polygons(g.geometry);if(g?.type==='FeatureCollection')return g.features.flatMap(polygons);return g?.type==='Polygon'?[g.coordinates]:g?.type==='MultiPolygon'?g.coordinates:[];}
function mount(map=root.SiegReportMap){const host=map?.getContainer();if(!map||!host||host.dataset.legendPlacement)return;host.dataset.legendPlacement='true';let frame,fitKey;const resolved=new WeakMap(),homes=new WeakMap();
function update(allowFit=false){
 const legends=[...(host.closest('.sieg-map-first,.transit-map-stage,.measure-map-stage,.capture-map-stage')||host.parentElement||host).querySelectorAll('.map-panel.bottom-left,#legend,#irMapLegend,.sieg-adaptive-legend')];const irrigation=document.getElementById('irMapLegend');if(irrigation&&host.contains(irrigation)&&!legends.includes(irrigation))legends.push(irrigation);
 let geometry=root.SiegeUsage?.getGeometry?.();geometry=geometry?.siegLocalGeometry||geometry;if(geometry&&typeof geometry==='object'&&typeof geometry.evaluate==='function'){const object=geometry;if(!resolved.has(object)){resolved.set(object,null);object.evaluate((value,error)=>{if(!error){resolved.set(object,value);schedule(true)}});}geometry=resolved.get(object);}let geo=polygons(geometry);
 // Local Leaflet boundaries remain available even before EE geometry resolves.
 if(!geo.length)map.eachLayer(layer=>{if(layer.getLatLngs&&layer.toGeoJSON){try{geo.push(...polygons(layer.toGeoJSON()));}catch{}}});

 const projected=geo.map(poly=>poly.map(ring=>ring.map(p=>{const q=map.latLngToContainerPoint([p[1],p[0]]);return [q.x,q.y]}))),size=map.getSize(),container=host.getBoundingClientRect();
 for(const legend of legends){if(legend.hidden||!legend.textContent.trim()||!legend.getBoundingClientRect().height)continue;
 if(!homes.has(legend)){const style=getComputedStyle(legend);homes.set(legend,{right:style.right!=='auto'&&style.left==='auto',top:!legend.matches('.bottom-left,#legend,#irMapLegend')&&style.top!=='auto'&&style.bottom==='auto',drawerOpen:false});}
 const home=homes.get(legend);
 if(legend.parentElement!==host)host.append(legend);
 legend.classList.add('sieg-adaptive-legend');legend.style.setProperty('bottom','auto','important');legend.style.setProperty('height','auto','important');const w=Math.min(260,Math.max(140,size.x*.32)),h=Math.min(legend.scrollHeight||180,Math.max(100,size.y-170));
 legend.style.width=w+'px';legend.style.maxWidth=w+'px';legend.style.maxHeight=Math.max(100,size.y-170)+'px';
 const height=Math.min(legend.getBoundingClientRect().height,h),candidates=[];
 const scope=host.closest('.sieg-map-first,.transit-map-stage')||host.parentElement||host;
 const obstacles=[...scope.querySelectorAll('.leaflet-control,.sieg-map-upload-card:not([hidden]),.sieg-floating-panel,.sieg-panel-toggle,.sieg-map-popover,.sieg-tour:not([hidden]),.measure-map-drawer,.capture-map-panel,#transitDrawer,.transit-map-account:not([hidden])')].filter(el=>{if(el.contains(legend)||legend.contains(el)||el.hidden||el.closest('[inert]')&&!el.matches('.sieg-floating-panel,#transitDrawer,.measure-map-drawer,.capture-map-panel'))return false;const style=getComputedStyle(el),r=el.getBoundingClientRect();return !el.closest('.is-panel-hidden')&&style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)!==0&&r.width&&r.height&&r.right>container.left&&r.left<container.right&&r.bottom>container.top&&r.top<container.bottom;}).map(el=>{const r=el.getBoundingClientRect();const x=Math.max(0,r.left-container.left),y=Math.max(0,r.top-container.top),right=Math.min(size.x,r.right-container.left),bottom=Math.min(size.y,r.bottom-container.top);return {x:x-12,y:y-12,w:Math.max(0,right-x)+24,h:Math.max(0,bottom-y)+24}});
 // Keep placement at map corners, or corners of the area left by drawers.
 const xs=home.right?[size.x-w-14,14]:[14,size.x-w-14],ys=home.top?[14,size.y-height-32]:[size.y-height-32,14];
 const drawerOpen=[...scope.querySelectorAll('.sieg-floating-panel,.measure-map-drawer,.capture-map-panel,#transitDrawer')].some(el=>{const r=el.getBoundingClientRect(),style=getComputedStyle(el);return !el.hidden&&!el.closest('.is-panel-hidden')&&el.getAttribute('aria-hidden')!=='true'&&style.display!=='none'&&style.visibility!=='hidden'&&r.right>container.left+2&&r.left<container.right-2&&r.bottom>container.top&&r.top<container.bottom;});
 const returning=home.drawerOpen&&!drawerOpen;home.drawerOpen=drawerOpen;
 for(const r of obstacles){if(r.x<size.x/2)xs.push(r.x+r.w+8);if(r.x+r.w>size.x/2)xs.push(r.x-w-8);if(r.y<size.y/2)ys.push(r.y+r.h+8);if(r.y+r.h>size.y/2)ys.push(r.y-height-8);}
 for(const x of xs)for(const y of ys){if(x<8||x+w>size.x-8||y<8||y+height>size.y-8)continue;candidates.push({side:x<size.x/2?'left':'right',x,y,w,h:height});}
 if(!candidates.length)candidates.push({side:'left',x:8,y:12,w,h:height});
 let best=choose(candidates,projected,obstacles);const original={side:home.right?'right':'left',x:xs[0],y:ys[0],w,h:height};
 if(returning&&choose([original],[],obstacles).cost===0)best=choose([original],projected,obstacles);legend.style.setProperty('left',best.box.x+'px','important');legend.style.setProperty('right','auto','important');legend.style.setProperty('top',best.box.y+'px','important');legend.style.setProperty('bottom','auto','important');legend.dataset.legendSide=best.box.side;
 // If every corner is occupied by the AOI, make space once for this layout.
 const key=JSON.stringify([geo,size.x,size.y]);
 if(allowFit&&!root.SiegAreaSection?.complete&&score(best.box,projected)&&geo.length&&fitKey!==key&&root.SiegFitMap&&root.L){fitKey=key;root.SiegFitMap.area(map,root.L.latLngBounds(geo.flatMap(poly=>poly[0].map(p=>[p[1],p[0]]))));schedule(false);}


 }
}
function schedule(allowFit){cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>update(allowFit));}
map.on('move zoom resize layeradd layerremove',()=>schedule(false));document.addEventListener('sieg-area-state',()=>schedule(true));const scope=host.closest('.sieg-map-first,.transit-map-stage')||host.parentElement||host;
 new MutationObserver(changes=>{if(changes.every(c=>c.target.closest?.('.sieg-adaptive-legend')))return;schedule(false);}).observe(scope,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden','class','style','open','inert']});
 let until=0,moving;function follow(){cancelAnimationFrame(moving);until=performance.now()+650;function tick(){update(false);if(performance.now()<until)moving=requestAnimationFrame(tick);}moving=requestAnimationFrame(tick);}scope.addEventListener('transitionrun',follow);scope.addEventListener('transitionend',()=>schedule(false));scope.addEventListener('transitioncancel',()=>schedule(false));if(root.ResizeObserver)new ResizeObserver(()=>schedule(true)).observe(host);root.SiegLegendPlacement.refresh=()=>update(false);schedule(true);
}
root.SiegLegendPlacement={choose,score,inside,mount};if(typeof document!=='undefined'){const style=document.createElement('style');style.textContent='.sieg-adaptive-legend{position:absolute!important;z-index:480!important;box-sizing:border-box;overflow:auto;border:1px solid #cadbd4;border-radius:12px;background:rgba(255,255,255,.96);padding:12px!important;box-shadow:0 3px 14px #0b233818;font:12px/1.45 Arial;pointer-events:auto}.sieg-adaptive-legend .sieg-continuous-legend{font-size:12px!important}.sieg-adaptive-legend:empty{display:none}';document.head.append(style);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>mount());else mount();root.addEventListener?.('load',()=>{mount();for(const map of root.SiegWorkspaceMaps||[])mount(map);});}
})(typeof window!=='undefined'?window:globalThis);

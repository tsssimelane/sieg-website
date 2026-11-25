/* Pure trip matching, shared by the browser and tests. */
(function(root){
const norm=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function distance(a,b){const r=Math.PI/180,x=Math.sin((b.lat-a.lat)*r/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin((b.lon-a.lon)*r/2)**2;return 12742000*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))}
function match(routes,location,destination,target){const q=norm(destination);if(!q&&!target)return null;const namedStop=!target&&routes.some(r=>r.stops.some(s=>norm(s.name).includes(q)));const trips=[];for(const route of routes){for(let i=0;i<route.stops.length-1;i++){const downstream=route.stops.slice(i+1),serves=target?downstream.some(s=>distance(s,target)<1500):namedStop?downstream.some(s=>norm(s.name).includes(q)):norm(route.name).includes(q);if(serves)trips.push({route,stop:route.stops[i],distance:distance(location,route.stops[i])})}}return trips.sort((a,b)=>a.distance-b.distance)[0]||null}
root.SiegTransitJourney={distance,match};if(typeof module!=='undefined')module.exports=root.SiegTransitJourney;
})(typeof window!=='undefined'?window:globalThis);

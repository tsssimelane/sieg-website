/* One-shot navigation only. Never creates an AOI, starts analysis, or stores coordinates. */
(function(root){'use strict';
 const icon='<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/><path d="M12 1v4m0 14v4M1 12h4m14 0h4"/></svg>';
 function errorMessage(error){return error?.code===1?'Location permission was denied. Allow location in your browser, or move the map and draw/upload your boundary.':error?.code===3?'Location request timed out. Try again, or move the map and draw/upload your boundary.':'Your location is unavailable. Move the map and draw/upload your boundary.'}
 function pointFromPosition(position){const c=position?.coords;if(!c||![c.latitude,c.longitude].every(Number.isFinite)||Math.abs(c.latitude)>90||Math.abs(c.longitude)>180)throw Error('Invalid location');return {lat:c.latitude,lon:c.longitude,accuracy:Number.isFinite(c.accuracy)&&c.accuracy>=0?c.accuracy:null}}
 function inside(point,ring){let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit}return hit}
 function countryAt(point,rows,countries){const hits=new Set(),xy=[360+2*point.lon,170-2*point.lat];for(const [code,,,path]of rows){let found=false;for(const piece of path.split('M').slice(1)){const ring=piece.slice(0,-1).trim().split(/\s+/).map(p=>p.split(',').map(Number));if([xy[0],xy[0]-720,xy[0]+720].some(x=>inside([x,xy[1]],ring)))found=!found}if(found)hits.add(code)}return hits.size===1?countries.find(c=>c.code===[...hits][0])||null:null}
 let geography;
 async function countryFor(point){try{geography??=Promise.all(['/talent/world-map.json','/assets/countries-global.json'].map(async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('Country data unavailable');return r.json()})).catch(error=>{geography=null;throw error});const [rows,countries]=await geography;return countryAt(point,rows,countries)}catch{return null}}
 function mount({map,button,status,onLocated,foundMessage="Draw or upload your boundary to continue.",contextErrorMessage="Map zoomed to your location. Draw or upload a boundary to continue; location context could not be updated."}){
  if(!map||!button||!status)return;
  button.type='button';button.classList.add('sieg-current-location');button.innerHTML=icon;button.setAttribute('aria-label','Zoom to current location');button.title='Zoom to current location';button.setAttribute('aria-describedby',status.id);status.setAttribute('role','status');status.setAttribute('aria-live','polite');let locating=false,marker;
  root.document?.addEventListener('sieg-place-located',async event=>{const point=event.detail;if(!point||![point.lat,point.lon].every(Number.isFinite))return;try{await onLocated?.(point,await countryFor(point));root.document.dispatchEvent(new CustomEvent('sieg-current-location'));}catch{status.textContent='Place located. Draw or upload your boundary to continue.'}});
  button.onclick=()=>{
   if(locating)return;
   if(!root.isSecureContext){status.textContent='Location needs HTTPS. Open the secure website, or move the map manually.';return}
   if(!root.navigator?.geolocation){status.textContent='This browser does not provide location. Move the map and draw/upload your boundary.';return}
   locating=true;button.disabled=true;button.setAttribute('aria-busy','true');status.textContent='Finding your current location…';
   const done=()=>{locating=false;button.disabled=false;button.removeAttribute('aria-busy')};
   try{root.navigator.geolocation.getCurrentPosition(async position=>{
    let point;try{point=pointFromPosition(position)}catch{status.textContent=errorMessage();done();return}
    try{
     map.invalidateSize({pan:false});map.setView([point.lat,point.lon],point.accuracy&&point.accuracy>1000?13:16);
     marker?.remove();if(root.L?.circleMarker)marker=root.L.circleMarker([point.lat,point.lon],{radius:7,color:'#fff',weight:2,fillColor:'#168b8d',fillOpacity:1,interactive:false}).addTo(map);
     root.document?.dispatchEvent(new CustomEvent('sieg-location-selected',{detail:point}));
     status.textContent='Location found'+(point.accuracy!==null?' · approximate accuracy ±'+Math.round(point.accuracy)+' m':'')+'. '+foundMessage;
     // Only local static geography is fetched. Device coordinates are not sent to a geocoder.
     const country=await countryFor(point);await onLocated?.(point,country);root.document?.dispatchEvent(new CustomEvent('sieg-current-location'));
    }catch{status.textContent=contextErrorMessage}finally{done()}
   },error=>{status.textContent=errorMessage(error);done()},{enableHighAccuracy:true,timeout:15000,maximumAge:60000})}catch(error){status.textContent=errorMessage(error);done()}
  };
 }
 root.SiegCurrentLocation={mount,pointFromPosition,countryAt,errorMessage};
})(window);

const MAP_VILLAGE_ASSET='projects/ee-gee023/assets/Eswatini_Villages';
// The shared R2 index stores completed data; never share request-owned promises.
function mapPlaceNormalize(value){return String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');}
async function mapVillageIndex(env){
 const key='map-search/villages/Eswatini_Villages-v1.json',cached=await env.BUCKET.get(key);
 if(cached){const entry=await cached.json();if(Date.now()-entry.savedAt<7*86400000)return entry.results;}
 return await (async()=>{
  const config=typeof geeConfig==='function'&&geeConfig(env);if(!config)throw Error('Village source unavailable');
  const token=await geeAccessToken(config),results=[],seen=new Set();let pageToken='';
  for(let page=0;page<50;page++){
   const url=new URL('https://earthengine.googleapis.com/v1/'+MAP_VILLAGE_ASSET+':listFeatures');url.searchParams.set('pageSize','1000');if(pageToken)url.searchParams.set('pageToken',pageToken);
   const response=await fetch(url,{headers:{Authorization:'Bearer '+token,'X-Goog-User-Project':config.project},signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Village source unavailable');
   const data=await response.json();for(const feature of data.features||[]){const p=feature.properties||{},name=[p.Name,p.name,p.NAME,p.Village,p.village,p.VILLAGE].find(v=>typeof v==='string'&&v.trim()),c=feature.geometry?.coordinates;
    if(!name||feature.geometry?.type!=='Point'||!Array.isArray(c)||!c.slice(0,2).every(Number.isFinite)||c.length<2||Math.abs(c[0])>180||Math.abs(c[1])>90)continue;
    const id=mapPlaceNormalize(name)+'|'+c.slice(0,2).join(',');if(seen.has(id))continue;seen.add(id);results.push({label:name.trim()+', Eswatini',lon:c[0],lat:c[1]});
   }
   pageToken=data.nextPageToken||'';if(!pageToken)break;
  }
  if(pageToken||!results.length)throw Error('Village source needs administrator attention');
  await env.BUCKET.put(key,JSON.stringify({savedAt:Date.now(),results}));return results;
 })();
}
// Coordinate searches resolve without geocoding, storage, or external network calls.
export function mapSearchCoordinates(value){
 const input=String(value||'').trim().replace(/[−–]/g,'-').replace(/^\(\s*|\s*\)$/g,'');
 const decimal='[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
 const pair=new RegExp('^('+decimal+')\\s*[,;]\\s*('+decimal+')$|^('+decimal+')\\s+('+decimal+')$');
 const plain=input.match(pair);let lat,lon;
 if(plain){lat=Number(plain[1]??plain[3]);lon=Number(plain[2]??plain[4])}
 else{
  const directional=input.match(new RegExp('^('+decimal+')\\s*°?\\s*([NS])\\s*[,;]?\\s*('+decimal+')\\s*°?\\s*([EW])$','i'));
  if(directional){lat=Math.abs(Number(directional[1]))*(directional[2].toUpperCase()==='S'?-1:1);lon=Math.abs(Number(directional[3]))*(directional[4].toUpperCase()==='W'?-1:1)}
  else {
   const dms=input.match(/^(\d{1,3})\s*°\s*(\d{1,2})\s*['′]\s*(\d{1,2}(?:\.\d+)?)\s*["″]\s*([NS])\s*[,;]?\s*(\d{1,3})\s*°\s*(\d{1,2})\s*['′]\s*(\d{1,2}(?:\.\d+)?)\s*["″]\s*([EW])$/i);
   if(dms){if([dms[2],dms[3],dms[6],dms[7]].some(n=>Number(n)>=60))return {error:'Coordinate minutes and seconds must be below 60.'};lat=(Number(dms[1])+Number(dms[2])/60+Number(dms[3])/3600)*(dms[4].toUpperCase()==='S'?-1:1);lon=(Number(dms[5])+Number(dms[6])/60+Number(dms[7])/3600)*(dms[8].toUpperCase()==='W'?-1:1)}
   else if((/^[\d+.,;\s-]+$/.test(input)&&/[\d]/.test(input)&&/[,;]|\s/.test(input))||/^[-+\d].*°.*[NS].*[EW]$/i.test(input))return {error:'Enter two coordinates as latitude, longitude (e.g. -26.50, 31.38).'};
   else return null;
  }
 }
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return {error:'Latitude must be between -90 and 90; longitude between -180 and 180.'};
 return {lat,lon,label:lat.toFixed(6)+', '+lon.toFixed(6)};
}
/* Explicit place searches only. Location capture never calls this geocoder. */
export async function mapPlaceSearch(request,env){
 const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
 if(request.method!=='GET')return json({error:'Use GET for place search.'},405);
 const params=new URL(request.url).searchParams,eswatiniOnly=/^(SZ|SWZ|ESWATINI)$/i.test(params.get('country')||'');
 const query=(params.get('q')||'').trim().replace(/\s+/g,' ');
 if(query.length<2||query.length>160)return json({error:'Enter a place name or valid latitude, longitude.'},400);
 const coordinates=mapSearchCoordinates(query);if(coordinates)return coordinates.error?json({error:coordinates.error},400):json({results:[coordinates],coordinate:true,attribution:'Entered coordinates',source:'coordinates'});
 if(!env.BUCKET)return json({error:'Place search is unavailable. Move the map or use your location.'},503);
 try{
  let villageUnavailable=false;try{
   const villages=await mapVillageIndex(env),q=mapPlaceNormalize(query).replace(/(?:,?\s+)(?:eswatini|swaziland)$/,'');
   const matches=villages.filter(p=>mapPlaceNormalize(p.label.replace(/, Eswatini$/,'')).includes(q)).sort((a,b)=>Number(!mapPlaceNormalize(a.label).startsWith(q))-Number(!mapPlaceNormalize(b.label).startsWith(q))||a.label.localeCompare(b.label)).slice(0,10);
   if(matches.length||eswatiniOnly)return json({results:matches,attribution:'Eswatini villages · SIEG',source:MAP_VILLAGE_ASSET});
  }catch{villageUnavailable=true;if(eswatiniOnly)return json({error:'Eswatini village search is unavailable. Please retry or use your current location.'},503);}
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(query.toLowerCase())),hash=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join(''),key='map-search/cache/v2/'+hash;
  const cached=await env.BUCKET.get(key);if(cached){const entry=await cached.json();if(Date.now()-entry.savedAt<7*86400000)return json({results:entry.results,attribution:'OpenStreetMap contributors · Photon'});}
  const rateKey='map-search/provider-rate',previous=await env.BUCKET.get(rateKey);
  if(previous&&Date.now()-(await previous.json()).at<1200)return json({error:'Place search is busy. Please retry in a moment.'},429);
  const saved=await env.BUCKET.put(rateKey,JSON.stringify({at:Date.now()}),{onlyIf:previous?{etagMatches:previous.etag}:{etagDoesNotMatch:'*'}});
  if(!saved)return json({error:'Place search is busy. Please retry in a moment.'},429);
  const url=new URL(env.PLACE_SEARCH_URL||'https://photon.komoot.io/api/');if(url.protocol!=='https:'||url.username||url.password)throw Error('Invalid provider');
  url.searchParams.set('q',query);url.searchParams.set('limit','5');url.searchParams.set('lang','en');
  const upstream=await fetch(url,{headers:{Accept:'application/json','User-Agent':'SIEG Map Search/1.0 (https://www.sieg.ltd)'},signal:AbortSignal.timeout(8000)});
  if(!upstream.ok)throw Error('Provider unavailable');const raw=await upstream.json(),results=[];
  for(const feature of (Array.isArray(raw.features)?raw.features:[]).slice(0,5)){
   const c=feature.geometry?.coordinates,p=feature.properties||{};if(/^(SZ|SWZ)$/i.test(p.countrycode||'')||/^(eswatini|swaziland)$/i.test(p.country||''))continue;if(feature.geometry?.type!=='Point'||!Array.isArray(c)||c.length<2||!c.slice(0,2).every(Number.isFinite)||Math.abs(c[0])>180||Math.abs(c[1])>90)continue;
   const label=[...new Set([p.name,p.street,p.city,p.state,p.country].filter(v=>typeof v==='string'&&v.trim()))].join(', ').slice(0,240);if(!label)continue;
   results.push({label,lon:c[0],lat:c[1]});
  }
  await env.BUCKET.put(key,JSON.stringify({savedAt:Date.now(),results}));
  if(!results.length&&villageUnavailable)return json({error:'Eswatini village search is temporarily unavailable. Try again or use your current location.'},503);
  return json({results,attribution:'OpenStreetMap contributors · Photon'});
 }catch{return json({error:'Place search could not complete. Try another place name, move the map or use your location.'},503);}
}

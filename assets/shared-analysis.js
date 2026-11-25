(()=>{'use strict';let pending;window.SiegeAnalysis={message(error){const text=String(error?.message||error);return /(?:HTTP(?: code)?[: ]*|code["'\s:]*)(?:429|500|502|503|504)\b|temporar(?:ily|y) (?:unavailable|unreachable)/i.test(text)?'The analysis service is temporarily busy or unavailable. Automatic recovery could not finish; retry this indicator. Your area and paid access are retained.':/Permission.*earthengine\.(maps|thumbnails|tables)\.create.*denied/i.test(text)?'Google Earth Engine has blocked map or report generation. SIEG must update its service-account permissions. Your selected area is retained.':text},initialize(){if(pending)return pending;pending=(async()=>{const r=await fetch('../api/earth-engine/status',{cache:'no-store'}),config=await r.json();if(!r.ok||!config.ready)throw Error(config.error||'SIEG analysis is temporarily unavailable.');const base=location.origin+'/api/earth-engine';await new Promise((resolve,reject)=>ee.initialize(base+'/api',base,resolve,reject,null,config.project));window.SiegAnalysisReuse?.install(ee);return config;})().catch(error=>{pending=null;throw error});return pending;}}})();

// Shared, request-driven computation status directly below each service map.
(()=>{
 'use strict';
 if(typeof document==='undefined'||typeof document.createElement!=='function')return;
 const frame=document.getElementById('stage')||document.querySelector?.('.map-stage,.ir-map-frame,.geo-map-section,.map-wrap');
 if(!frame?.insertAdjacentElement)return;
 const bar=document.createElement('div');bar.className='gee-computation-status';bar.setAttribute('role','status');bar.setAttribute('aria-live','polite');bar.setAttribute('aria-atomic','true');
 const dot=document.createElement('span');dot.className='gee-computation-dot';dot.setAttribute('aria-hidden','true');const text=document.createElement('span');bar.append(dot,text);
 const column=document.createElement('div');column.className='sieg-map-status-column';const estateReportPanel=frame.nextElementSibling?.classList.contains('estate-report-panel')?frame.nextElementSibling:null;
 frame.insertAdjacentElement('beforebegin',column);column.append(frame);
 if(estateReportPanel)column.append(estateReportPanel);
 column.append(bar);
 const style=document.createElement('style');style.textContent='.sieg-map-status-column{display:flex;flex-direction:column;align-self:start;min-width:0;max-width:100%;width:100%}.sieg-map-status-column>.map-wrap{box-sizing:border-box;width:100%;min-width:0;max-width:100%;flex:none}.sieg-map-status-column>.gee-computation-status{box-sizing:border-box;width:100%;flex:none;margin:10px 0 0}.gee-computation-status{display:flex;align-items:center;justify-content:center;gap:9px;min-height:38px;margin:10px 0 14px;padding:9px 14px;border:1px solid #d4e3de;border-radius:10px;background:#f2f7f4;color:#42615f;font:12px/1.5 Arial,sans-serif;text-align:center}.gee-computation-dot{width:8px;height:8px;flex:none;border-radius:50%;background:#8aa8a0}.gee-computation-status[data-state=busy]{color:#176f73;background:#eaf5f2}.gee-computation-status[data-state=busy] .gee-computation-dot{background:#218b8c;animation:gee-computing 1.2s ease-in-out infinite}.gee-computation-status[data-state=error]{color:#933c2c;background:#fff3ed}.gee-computation-status[data-state=error] .gee-computation-dot{background:#b95b42}@keyframes gee-computing{50%{opacity:.3;transform:scale(.75)}}@media(prefers-reduced-motion:reduce){.gee-computation-dot{animation:none!important}}';document.head.append(style);
 const mapHost=document.getElementById('stage')||document.getElementById('geoMap')?.parentElement||document.querySelector?.('.map-wrap');
 const mapProgress=mapHost&&!/\/(?:enviro|hydrology|agri)\//.test(location.pathname)?document.createElement('div'):null;
 if(mapProgress){mapProgress.className='gis-map-progress';mapProgress.hidden=true;mapProgress.setAttribute('aria-hidden','true');mapHost.append(mapProgress)}
 const mapStyle=document.createElement('style');mapStyle.textContent='.gis-map-progress{position:absolute;bottom:0;left:0;right:0;z-index:650;min-height:56px;display:flex;align-items:center;padding:14px 24px;box-sizing:border-box;background:#0b2338ed;color:white;font:500 14px/1.5 Arial,sans-serif;border-radius:0 0 18px 18px;pointer-events:none}.gis-map-progress[hidden]{display:none}.map-wrap{position:relative}';document.head.append(mapStyle);
 let pending=0,failed=false,task='',generation=0;
 function paint(){const hydroProgress=(document.getElementById('hydroMapProgress')||document.getElementById('fieldsMapProgress'));if(hydroProgress){hydroProgress.hidden=!pending;hydroProgress.textContent=(task||'Computing analysis')+'…';const hydroStatus=document.getElementById('status');if(hydroStatus)hydroStatus.hidden=!!pending}if(mapProgress){mapProgress.hidden=!pending;mapProgress.textContent=(task||'Computing analysis')+'…'}bar.dataset.state=pending?'busy':failed?'error':'ready';bar.setAttribute('aria-busy',String(pending>0));text.textContent=pending?'Computation ongoing · '+pending+' '+(pending===1?'request':'requests')+' processing…':failed?'Computation finished with an error · check the analysis message and retry.':'Ready · select an area and indicator to begin.'}
 function begin(label){if(!pending){failed=false;task=label||'Computing '+(document.getElementById('resultTitle')?.textContent||document.getElementById('mapTitle')?.textContent||'analysis')}pending++;paint();const ticket=generation;let done=false;return ok=>{if(done||ticket!==generation)return;done=true;failed=failed||!ok;pending=Math.max(0,pending-1);paint();if(!pending&&!failed)text.textContent='Computation complete · results updated.'}}
 window.SiegeComputation={begin,reset(){generation++;pending=0;failed=false;task='';paint()}};
 function isCompute(method,url){try{const u=new URL(url,location.href);return (String(method).toUpperCase()==='POST'&&u.origin===location.origin&&u.pathname.startsWith('/api/earth-engine/'))||/overpass-api\.de|api\.open-meteo\.com/.test(u.hostname)}catch{return false}}
 if(typeof XMLHttpRequest!=='undefined'){
  const open=XMLHttpRequest.prototype.open,send=XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open=function(method,url,...rest){this.siegComputing=isCompute(method,url);return open.call(this,method,url,...rest)};
  XMLHttpRequest.prototype.send=function(...args){if(!this.siegComputing||!this.addEventListener)return send.apply(this,args);const finish=begin();this.addEventListener('loadend',()=>finish(this.status>=200&&this.status<300),{once:true});try{return send.apply(this,args)}catch(e){finish(false);throw e}};
 }
 if(typeof window.fetch==='function'){const original=window.fetch;window.fetch=async function(input,init){const method=init?.method||input?.method||'GET',url=typeof input==='string'||input instanceof URL?input:input?.url;if(!isCompute(method,url))return original.call(this,input,init);const finish=begin();try{const r=await original.call(this,input,init);finish(r.ok);return r}catch(e){finish(false);throw e}}}
 paint();
})();

// Reuse identical authorised EE work across map controls, charts and reports.
(function(root){'use strict';
 const cache=new Map(),installed=new WeakMap(),counters={started:0,shared:0,hits:0,failed:0};
 const stable=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
 function scope(){const job=root.SiegeUsage?.active;return ['20261120-reset-1',job?.id||'navigation',job?.service,job?.geometryHash||job?.geometry,job?.year,!!job?.adminUnrestricted,root.SiegeUsage?.adminMode?.()||'restricted'];}
 async function digest(value){const text=stable([scope(),value]);if(!root.crypto?.subtle)return text;const hash=await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join('');}
 function copy(value,seen=new WeakMap()){if(!value||typeof value!=='object')return value;if(seen.has(value))return seen.get(value);const proto=Object.getPrototypeOf(value);if(!Array.isArray(value)&&proto!==null&&proto!==Object.prototype&&proto?.constructor?.name!=='Object')return value;const result=Array.isArray(value)?[]:{};seen.set(value,result);for(const [key,item]of Object.entries(value))Object.defineProperty(result,key,{value:copy(item,seen),enumerable:true,writable:true,configurable:true});return result;}
 async function run(key,work,{ttl=300000,keep=()=>true}={}){
  let id;try{id=await digest(key);}catch{counters.started++;try{return copy(await work());}catch(error){counters.failed++;throw error;}}
  const now=Date.now(),saved=cache.get(id);
  if(saved&&(saved.pending||saved.expires>now)){counters[saved.pending?'shared':'hits']++;return copy(await saved.promise);}
  if(saved)cache.delete(id);
  for(const [key,value]of cache)if(!value.pending&&value.expires<=now)cache.delete(key);
  if(cache.size>=128){const oldest=[...cache].find(([,value])=>!value.pending);if(oldest)cache.delete(oldest[0]);}
  const entry={pending:true,expires:0};counters.started++;
  entry.promise=Promise.resolve().then(work).then(value=>{entry.pending=false;entry.expires=Date.now()+ttl;if(!keep(value)&&cache.get(id)===entry)cache.delete(id);return copy(value);},error=>{counters.failed++;if(cache.get(id)===entry)cache.delete(id);throw error;});
  if(cache.size<128)cache.set(id,entry);return copy(await entry.promise);
 }
 function install(ee=root.ee){
  for(const [prototype,method,callbackIndex]of [[ee?.ComputedObject?.prototype,'evaluate',0],[ee?.Image?.prototype,'getMap',1],[ee?.Image?.prototype,'getThumbURL',1],[ee?.Image?.prototype,'getDownloadURL',1],[ee?.FeatureCollection?.prototype,'getDownloadURL',1]]){
   if(!prototype||typeof prototype[method]!=='function')continue;let methods=installed.get(prototype);if(!methods){methods=new Set();installed.set(prototype,methods);}if(methods.has(method))continue;methods.add(method);
   const original=prototype[method];const wrapped=function(...args){const callback=args[callbackIndex];if(typeof callback!=='function'||typeof this.serialize!=='function')return original.apply(this,args);let graph;try{graph=this.serialize();if(typeof graph==='string')graph=JSON.parse(graph);}catch{return original.apply(this,args);}const object=this,params=args.slice(0,callbackIndex);
    run(['earth-engine',method,graph,params],()=>new Promise((resolve,reject)=>{const input=[...params,(value,error)=>error?reject(error):resolve(value)];original.apply(object,input);}),{ttl:method==='evaluate'?300000:60000}).then(value=>queueMicrotask(()=>callback(value,null)),error=>queueMicrotask(()=>callback(null,error)));
   };
   // EE's exported API registry keys parameter metadata by function.toString().
   // Retain the original identity used by that registry when wrapping a method.
   Object.defineProperties(wrapped,{toString:{value:original.toString.bind(original)},length:{value:original.length},name:{value:original.name}});
   if(original.signature)wrapped.signature=original.signature;
   prototype[method]=wrapped;
  }
 }
 root.SiegAnalysisReuse={run,install,clear:()=>cache.clear(),stats:()=>({...counters,entries:cache.size})};install();
 root.addEventListener?.('siege-admin-mode-changed',()=>cache.clear());root.addEventListener?.('load',()=>install());
})(typeof window!=='undefined'?window:globalThis);

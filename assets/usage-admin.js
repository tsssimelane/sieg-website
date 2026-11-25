(() => {
'use strict';
const $=id=>document.getElementById(id),host=$('usage-dashboard'),button=$('usagePause'),msg=$('usageMessage');
if(!host)return;
let paused=false;
async function api(path,body){
 const r=await fetch('/api/analysis/'+path,{cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 if(r.status===403||r.status===401)return null;
 const d=await r.json();if(!r.ok)throw Error(d.error||'Usage dashboard unavailable.');return d;
}
function update(value){paused=value;button.disabled=false;button.textContent=value?'Resume analysis':'Pause analysis';button.setAttribute('aria-pressed',String(value));}
const operations={'value:compute':'Compute statistics / values',maps:'Create map',thumbnails:'Create thumbnail',tables:'Create table','map-tile':'Fetch map tile','thumbnail-pixels':'Fetch thumbnail','table-features':'Fetch table features'};
function cell(row,type,value){const el=document.createElement(type);el.textContent=value;row.append(el);return el;}
async function load(){
 const data=await api('dashboard?days='+$('usageDays').value);if(!data)return;
 host.hidden=false;update(data.paused);msg.textContent=data.paused?'Analysis is paused.':'Analysis is enabled.';
 const summary=$('usageSummary');if(summary){summary.replaceChildren();for(const [label,value]of [['Requests',data.rows.reduce((n,r)=>n+(Number(r.requests)||0),0)],['Cache hits',data.rows.reduce((n,r)=>n+(Number(r.hits)||0),0)],['Failures',data.rows.reduce((n,r)=>n+(Number(r.failed)||0),0)],['Analysis',data.paused?'Paused':'Enabled']]){const card=document.createElement('div'),name=document.createElement('span'),number=document.createElement('strong');name.textContent=label;number.textContent=String(value);card.append(name,number);summary.append(card)}}const out=$('usageTable');out.replaceChildren();if(!data.rows.length){out.textContent='No tracked requests in this period. Tracking starts with this update.';return;}
 const table=document.createElement('table'),head=table.createTHead().insertRow(),body=table.createTBody();table.setAttribute('aria-label','Analysis usage by service and operation');
 for(const h of ['Service','Analysis type','Operation','Requests','Cache hits','Failures','Retries¹','Paused','In progress²','Mean AOI km²','Max AOI km²'])cell(head,'th',h).scope='col';
 for(const r of data.rows){const row=body.insertRow();for(const value of [r.service,r.type==='general'?'General':r.type.replaceAll('-',' '),operations[r.operation]||r.operation,r.requests,r.hits,r.failed,r.retries,r.paused,r.pending,r.areaAverage.toFixed(3),r.areaMax.toFixed(3)])cell(row,'td',value);}
 const p=document.createElement('p');p.textContent='¹ Repeat compute or creation calls following a failure or timeout. ² Duplicate calls while the original is still processing. Area statistics are per request.';
 out.append(table,p);
}
async function approvals(){
 const data=await api('admin');if(!data)return;const out=$('usageRequests');out.replaceChildren();
 const jobs=data.jobs.filter(j=>['queued','awaiting_approval'].includes(j.state));const deleted=data.jobs.filter(j=>j.state==='admin_deleted');if(!jobs.length&&!deleted.length){out.textContent='No large-area requests awaiting approval.';return;}
 const h=document.createElement('h3');h.textContent='Large areas awaiting approval';out.append(h);
 for(const j of jobs){const row=document.createElement('p');row.className='usage-approval-row';const download=document.createElement('a'),approve=document.createElement('button');row.textContent=j.service+' · '+j.areaKm2.toFixed(2)+' km² · ';download.href='data:application/geo+json,'+encodeURIComponent(JSON.stringify(j.geometry));download.download=j.id+'-AOI.geojson';download.textContent='Download boundary';approve.textContent='Approve area';approve.onclick=async()=>{if(!confirm('Have you reviewed the boundary and estimated processing cost?'))return;try{await api('admin',{id:j.id,action:'approve',confirmCostReview:true});await approvals()}catch(e){msg.textContent=e.message}};const remove=document.createElement('button');remove.textContent='Delete';remove.className='usage-delete';remove.onclick=async()=>{if(!confirm('Delete this pending approval request? You can restore it from Deleted approval requests.'))return;remove.disabled=approve.disabled=true;try{const result=await api('admin',{id:j.id,action:'delete'});if(!result)throw Error('Admin access required.');await approvals();msg.textContent='Request deleted. It can be restored below.';}catch(error){msg.textContent=error.message;remove.disabled=approve.disabled=false}};row.append(download,' ',approve,' ',remove);out.append(row);}
 if(deleted.length){const bin=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Deleted approval requests ('+deleted.length+')';bin.append(summary);for(const j of deleted){const row=document.createElement('p'),restore=document.createElement('button');row.className='usage-approval-row';row.textContent=j.service+' · '+j.areaKm2.toFixed(2)+' km²';restore.textContent='Restore request';restore.onclick=async()=>{restore.disabled=true;try{const result=await api('admin',{id:j.id,action:'restore'});if(!result)throw Error('Admin access required.');await approvals();msg.textContent='Request restored to its previous pending status.';}catch(error){msg.textContent=error.message;restore.disabled=false}};row.append(restore);bin.append(row)}out.append(bin)}
}
const refresh=()=>load().then(()=>{if(!host.hidden)return approvals()}).catch(e=>{msg.textContent=e.message});
$('usageRefresh').onclick=$('usageDays').onchange=refresh;
button.onclick=async()=>{if(!paused&&!confirm('Pause new Earth Engine analysis calls for all SIEG users?'))return;button.disabled=true;try{const data=await api('dashboard',{paused:!paused});if(!data)throw Error('Admin access required.');update(data.paused);await load();}catch(e){msg.textContent=e.message;}finally{button.disabled=false;}};
refresh();
})();

/* Load report dependencies and hand completed Eco batches to one PDF export. */
(function(root){'use strict';
const base=new URL('./',document.currentScript.src),loads=new Map();let pending,lastKey='';
function message(text){for(const id of ['status','usageStatus','ecoReportRequestStatus']){const node=document.getElementById(id);if(node){node.hidden=false;node.textContent=text;}}root.SiegeDelivery?.progress?.(text);}
function script(path,ready){if(ready())return Promise.resolve();if(loads.has(path))return loads.get(path);const work=new Promise((resolve,reject)=>{const tag=document.createElement('script'),timer=setTimeout(()=>reject(Error('Report tools did not load. Please retry Request report.')),25000);tag.src=new URL(path+'?v=20261122-eco-handoff',base).href;tag.onload=()=>{clearTimeout(timer);ready()?resolve():reject(Error('Report tools could not initialize. Please retry Request report.'));};tag.onerror=()=>{clearTimeout(timer);reject(Error('Report tools could not load. Please retry Request report.'));};document.head.append(tag);}).catch(error=>{loads.delete(path);throw error;});loads.set(path,work);return work;}
async function ready(){await script('report-kit-loader.js',()=>typeof root.SiegReportKitReady==='function');await root.SiegReportKitReady();await script('report-delivery.js',()=>typeof root.SiegeDelivery?.loadReport==='function');await script('../enviro/assets/report.js',()=>typeof root.SiegEcoDeliverPaid==='function');}
root.SiegEcoReportReady=ready;
root.SiegEcoScheduleReport=function(){
 const job=root.SiegeUsage?.active;if(!job||job.service!=='eco'||!job.paymentVerified&&!job.adminUnrestricted)return Promise.resolve(false);
 if(pending)return pending;
 message('Analysis complete. Preparing your report…');
 pending=(async()=>{
  const started=Date.now();await new Promise(resolve=>setTimeout(resolve,0));
  while(root.SiegEcoBatchRunning){if(root.SiegeUsage?.active?.id!==job.id)throw Error('The selected analysis changed. Request its report again.');if(Date.now()-started>180000)throw Error('Selected indicators are still running. Retry Request report when they finish.');await new Promise(resolve=>setTimeout(resolve,150));}
  if(root.SiegeUsage?.active?.id!==job.id)throw Error('The selected analysis changed. Request its report again.');
  const key=JSON.stringify([job.id,root.SiegIndicatorSelection?.items(),(root.siegeEnvironmentalEvaluations?.()||[]).map(s=>[s.result.p.module,s.result.p.indicator,s.result.p.year,s.result.values])]);
  if(lastKey===key&&root.SiegCompletedReports?.get(job.id)?.some(f=>f.type==='application/pdf'))return true;
  await ready();message('Analysis complete. Preparing your report…');
  await root.SiegEcoDeliverPaid(true);
  if(!root.SiegCompletedReports?.get(job.id)?.some(f=>f.type==='application/pdf'))throw Error('The PDF is not ready. Use Request SIEG Eco Report to retry without paying again.');
  lastKey=key;message('Report ready. Download your PDF report below.');return true;
 })().catch(error=>{message('Report preparation: '+error.message);throw error;}).finally(()=>{pending=null;});
 return pending;
};
})(window);

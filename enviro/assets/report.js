(()=>{'use strict';const escape=s=>window.SiegeReportKit.escape(s);
function analysisSettings({year,periodEnd,baseline,season,scale}){
 const date=periodEnd&&new Date(periodEnd+'T00:00:00Z');
 const endDate=date&&Number.isFinite(date.getTime())
  ?new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(date)
  :periodEnd;
 const rows=[
  ['Analysis year',year],
  ['Data period ends',endDate],
  ['Baseline year',baseline],
  ['Season',season],
  ['Analysis scale',Number.isFinite(scale)&&scale>0?scale+' m':null]
 ];
 return '<h3>Analysis settings</h3><table aria-label="Analysis settings"><thead><tr><th scope="col">Setting</th><th scope="col">Value</th></tr></thead><tbody>'+
  rows.map(([label,value])=>'<tr><th scope="row">'+escape(label)+'</th><td>'+escape(value)+'</td></tr>').join('')+
  '</tbody></table>';
}
function evaluationResults({d,values}){
 const number=new Intl.NumberFormat('en-GB',{maximumFractionDigits:2});
 const date=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
 const coverage={
  area_ha:['Selected area','ha','Total area inside the analysis boundary.'],
  observed_ha:['Observed area','ha','Area with source observations, including pixels that could not be classified.'],
  unassessed_ha:['Observed but unassessed area','ha','Observed area with insufficient confidence or repeatability for classification.'],
  valid_ha:[d.title==='Cover change'?'Comparable area':'Valid classified area','ha',d.title==='Cover change'?'Area classified in both periods.':'Area assigned a reliable land-cover class.'],
  valid_indicator_ha:['Area supporting the indicator','ha','Area with valid results on the indicator coverage grid.'],
  valid_pct:['Indicator coverage','%','Percentage of the selected area with valid indicator results.'],
  source_count:['Source records','', 'Number of records in the source collection for this analysis.'],
  latest_source_time:['Latest source observation','', 'Date of the most recent record in the source collection (UTC).']
 };
 const format=(value,unit,decimals)=>{
  if(typeof value!=='number')return value==null?'':typeof value==='object'?JSON.stringify(value):value;
  const rounded=decimals==null?number.format(value):value.toLocaleString('en-GB',{maximumFractionDigits:decimals});
  return (value>0&&Number(rounded)===0&&unit==='ha'?'<0.01':rounded)+(unit?' '+unit:'');
 };
 const classRows=(d.landClasses||[]).map((name,code)=>[code,name,format(values['class_'+code],'ha')]).filter(row=>row[2]!=='');
 const measures=Object.entries(values).filter(([key,value])=>value!=null&&!(classRows.length&&/^class_\d+$/.test(key))&&
  !(key==='valid_indicator_ha'&&value===values.valid_ha)).map(([key,value])=>{
  const card=d.cards?.find(c=>c.key===key),[label,unit,meaning]=coverage[key]||[card?.title||key.replaceAll('_',' '),card?.unit||'',''];
  const text=key.endsWith('_source_time')&&Number.isFinite(value)&&Math.abs(value)<=8.64e15?date.format(value):format(value,unit,card?.decimals);
  return [label,text,meaning];
 });
 const table=(head,rows)=>'<table><thead><tr>'+head.map(label=>'<th scope="col">'+escape(label)+'</th>').join('')+
  '</tr></thead><tbody>'+rows.map(([label,...cells])=>'<tr><th scope="row">'+escape(label)+'</th>'+
   cells.map(cell=>'<td>'+escape(cell)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
 const showMeaning=measures.some(row=>row[2]);
 const summary=table(['Measure','Value',...(showMeaning?['What it means']:[])],showMeaning?measures:measures.map(row=>row.slice(0,2)));
 const classes=classRows.length?'<h4>Land-cover classes</h4><p>Each value is the area assigned to that class in the analysis year, in hectares. Zero means no area was assigned to the class. Areas without a reliable classification are excluded from these totals.</p>'+
  table(['Class code','Land cover','Mapped area'],classRows):'';
 return '<h3>Evaluation results</h3>'+classes+summary;
}
let reportEvaluations=[];const options={kind:'report',service:'eco',version:'eco-temporal-v5-landcover-mode',validateFiles:files=>files.every(f=>f.reportMetadata?.version==='eco-temporal-v5-landcover-mode'),items:()=>{const a=window.SiegeUsage.active;reportEvaluations=(window.siegeEnvironmentalEvaluations?.()||[]).filter(s=>!window.SiegIndicatorSelection?.items().length||window.SiegIndicatorSelection.items().some(c=>Number(c.group)===s.result.p.module&&c.value===s.result.p.indicator)).filter(s=>!a||s.result.p.year===a.year&&(a.reportItems||[a.task]).some(task=>({'land-classification':0,biodiversity:1,'land-degradation':6,'air-quality':2,'urban-growth':4,'active-fires':5})[task]===s.result.p.module));return reportEvaluations.map((s,i)=>({id:String(i),label:s.result.d.title+' · '+s.result.p.year}))},build:async (contact,selected)=>{if(!window.SiegReportKitReady)throw Error('Report tools did not load. Reload this service and retry.');await window.SiegReportKitReady();const evaluations=reportEvaluations.filter((s,i)=>selected.includes(String(i)));if(!evaluations.length)throw Error('Complete at least one analysis for the selected area first.');const first=evaluations[0],geo=await window.SiegeReportKit.evaluate(first.geometry),sections=[],basemapSession={};for(let i=0;i<evaluations.length;i++){const snapshot=evaluations[i],result=snapshot.result;window.SiegeDelivery.progress('Preparing environmental evaluation '+(i+1)+' of '+evaluations.length+'…');if(!result.values||Object.keys(result.values).length===0)throw Error('No completed statistics for '+result.d.title+'. Run this indicator again.');const image=await window.siegeEcoReportMap(snapshot,basemapSession);if(!image)throw Error('No printable map was produced for '+result.d.title+'. Retry before submitting.');sections.push('<section><h2>'+escape(result.d.title)+'</h2><p>Source: '+escape(result.d.source)+'</p>'+(image?'<img src="'+image+'" alt="Analysed-area environmental map">':'')+evaluationResults(result)+analysisSettings(result.p)+'<h3>Interpretation and limitations</h3><pre>'+escape(snapshot.descriptions)+'</pre><h3>Chart observations</h3>'+(snapshot.chartHTML||'<p>No chart is defined for this indicator.</p>')+'</section>')}const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><title>SIEG Eco Environmental Report</title><style>body{font:14px Arial;line-height:1.7;color:#0b2338}img{max-width:100%}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style></head><body><h1>SIEG Eco Environmental Report</h1><p>'+escape(contact.name)+' · '+escape(contact.email)+'</p><p>Area: '+escape(first.result.p.areaName)+' / '+escape(first.country)+'</p><p>Includes '+evaluations.length+' completed indicator evaluations for this area in this session. Indicators not analysed are excluded. Results are decision-support screening and require professional interpretation.</p>'+sections.join('')+'<h2>Analysed geometry</h2><pre>'+escape(JSON.stringify(geo,null,2))+'</pre></body></html>';const report=await window.SiegeReportKit.wrap(html,{title:'SIEG Eco - Environmental Report',geometry:geo});return [await window.SiegeDelivery.file(report.replace('<html','<html data-report-version="eco-temporal-v5-landcover-mode"'),'SIEG_Eco_Report.html')]}};
// Report preparation drains checked indicators without invoking delivery or restoring the AOI.
options.prepareReport=async()=>{
 if(window.SiegIndicatorSelection?.items().length){
  if(window.SiegExplicitAnalysis&&!window.SiegExplicitAnalysis.ready())throw Error('Complete Start analysis first.');
 }
 const items=options.items();
 if(!items.length)throw Error('No completed indicators are available for this boundary. Run a selected indicator and retry the report.');
 const choices=window.SiegIndicatorSelection?.items()||[];
 const missing=choices.filter(choice=>!reportEvaluations.some(snapshot=>Number(choice.group)===snapshot.result.p.module&&choice.value===snapshot.result.p.indicator&&snapshot.result.values&&Object.keys(snapshot.result.values).length));
 if(missing.length)throw Error('These indicators still need to finish: '+missing.map(c=>c.label||c.value).join(', ')+'. Retry them, then request the report.');
 return true;
};
let extraPrompt=null;
function confirmEcoExtra(){if(extraPrompt)return extraPrompt;extraPrompt=(async()=>{const a=window.SiegeUsage.active;if(!a?.paymentVerified||a.extraServiceDecided)return true;if(a.paymentOrder){const r=await fetch('/api/reports/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:a.paymentOrder})});const status=await r.json();if(!r.ok)throw Error(status.error||'Payment status is unavailable.');if(status.filesReady)return true;}const labels=window.SiegEcoSelection?.labels||{},available=Object.keys(labels).filter(k=>!(a.reportItems||[a.task]).includes(k));if(!available.length){await window.SiegeUsage.addEcoService(null);return true;}return new Promise(resolve=>{const d=document.createElement('dialog');d.className='usage-dialog';d.setAttribute('aria-label','Choose your included extra service');const f=document.createElement('form'),h=document.createElement('h2'),p=document.createElement('p'),label=document.createElement('label'),select=document.createElement('select'),save=document.createElement('button'),later=document.createElement('button'),error=document.createElement('p');h.textContent='Add one extra service';p.textContent='Your payment includes one additional service for this area and year. Confirm your choice before the report is prepared.';label.textContent='Extra report service';select.setAttribute('aria-label','Extra report service');for(const key of available)select.add(new Option(labels[key],key));select.add(new Option('Continue without an extra service',''));label.append(select);save.type='submit';save.textContent='Confirm report services';later.type='button';later.textContent='Decide later';error.setAttribute('role','status');const finish=value=>{d.close();d.remove();resolve(value);};later.onclick=()=>finish(false);d.addEventListener('cancel',e=>{e.preventDefault();finish(false);});f.onsubmit=async e=>{e.preventDefault();save.disabled=later.disabled=true;try{const updated=await window.SiegeUsage.addEcoService(select.value||null);window.SiegEcoSelection?.restore(updated.reportItems);finish(true);}catch(e){error.textContent=e.message;save.disabled=later.disabled=false;}};f.append(h,p,label,save,later,error);d.append(f);document.body.append(d);d.showModal();});})();return extraPrompt.finally(()=>{extraPrompt=null;});}
window.SiegEcoDeliverPaid=async(force=false)=>{let a=window.SiegeUsage.active;if((!a?.paymentVerified&&!a?.adminUnrestricted)||a.service!=='eco')return;if(!await confirmEcoExtra())return;a=window.SiegeUsage.active;const items=options.items();const missing=(a.reportItems||[a.task]).filter(task=>!reportEvaluations.some(s=>({'land-classification':0,biodiversity:1,'land-degradation':6,'air-quality':2,'urban-growth':4,'active-fires':5})[task]===s.result.p.module));if(missing.length){const message='Complete an indicator for each selected report service: '+missing.map(k=>window.SiegEcoSelection?.labels[k]||k).join(', ')+'. Your paid access is retained.';if(force)throw Error(message);const n=document.getElementById('usageStatus');n.hidden=false;n.textContent=message;return;}if(!items.length)throw Error('Complete the purchased analysis before preparing your report.');window.SiegeDelivery.progress('Selected analyses complete. Preparing your PDF report…');return window.SiegeDelivery.loadReport(options,{automatic:true});};
window.SiegeDelivery.register?.(options);
const requestButton=document.getElementById('requestEnvironmentalReport');
const requestStatus=document.createElement('p');requestStatus.id='ecoReportRequestStatus';requestStatus.hidden=true;requestStatus.setAttribute('role','status');requestStatus.setAttribute('aria-live','polite');requestStatus.style.cssText='margin:12px 0;color:#176f73;font:14px/1.5 Arial;overflow-wrap:anywhere';requestButton.after(requestStatus);
requestButton.onclick=async()=>{if(requestButton.disabled)return;const label=requestButton.textContent;requestButton.disabled=true;requestButton.textContent='Preparing PDF…';requestStatus.hidden=false;requestStatus.textContent='Checking your selected results…';try{await window.SiegeDelivery.loadReport(options);}catch(error){requestStatus.textContent=error.message;const node=document.getElementById('usageStatus');if(node){node.hidden=false;node.textContent=error.message;}}finally{requestButton.disabled=false;requestButton.textContent=label;}};
})();

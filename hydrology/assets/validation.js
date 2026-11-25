/* Ground records stay in this browser. Only AOI-contained, dated pairs are compared. */
(()=>{'use strict';
function parseCSV(text){
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}
 else if(!quoted&&(c===','||c==='\n')){row.push(cell.trim());cell='';if(c==='\n'){if(row.some(Boolean))rows.push(row);row=[]}}
 else if(c!=='\r')cell+=c;}
 if(quoted)throw Error('CSV has an unclosed quoted field.');row.push(cell.trim());if(row.some(Boolean))rows.push(row);
 const header=(rows.shift()||[]).map(v=>v.replace(/^\uFEFF/,''));
 const required=['station','date','type','latitude','longitude','observed','estimated','unit'];
 if(required.some(k=>!header.includes(k)))throw Error('Required columns: '+required.join(', '));
 if(rows.length>2000)throw Error('Use at most 2,000 records.');
 const units={rainfall:'mm',river_flow:'m3/s',reservoir_level:'m',borehole_level:'m'};
 return rows.map((values,i)=>{const r=Object.fromEntries(header.map((h,j)=>[h,values[j]||'']));
  if(!r.station||!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||new Date(r.date+'T00:00:00Z').toISOString().slice(0,10)!==r.date)throw Error('Invalid station/date at row '+(i+2));
  if(r.time&&!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(r.time))throw Error('Use UTC time HH:MM[:SS] at row '+(i+2));
  for(const k of ['latitude','longitude','observed','estimated']){if(!r[k]||!Number.isFinite(Number(r[k])))throw Error('Invalid '+k+' at row '+(i+2));r[k]=Number(r[k])}
  if(Math.abs(r.latitude)>90||Math.abs(r.longitude)>180||units[r.type]!==r.unit)throw Error('Check coordinates, record type and units at row '+(i+2));return r;});
}
function metrics(rows){if(!rows.length)throw Error('No matching records.');const n=rows.length,bias=rows.reduce((s,r)=>s+r.estimated-r.observed,0)/n,mae=rows.reduce((s,r)=>s+Math.abs(r.estimated-r.observed),0)/n,rmse=Math.sqrt(rows.reduce((s,r)=>s+(r.estimated-r.observed)**2,0)/n);return {n,bias,mae,rmse};}
window.HydroValidation={parseCSV,metrics};
const input=document.getElementById('hydroGroundFile');if(!input)return;
let revision=0;
input.onchange=async()=>{const ticket=++revision,out=document.getElementById('hydroGroundStatus');window.hydroValidationSummary=null;
 try{const file=input.files[0];if(!file)return;if(file.size>1024*1024)throw Error('CSV limit: 1 MB.');
 if(!window.siegeHydrology?.canAnalyse()||!window.aoi)throw Error('Select and analyse a basin or polygon first.');
 const geometry=window.aoi,analysisYear=Number(window.year),rows=parseCSV(await file.text()).filter(r=>Number(r.date.slice(0,4))===analysisYear);
 if(!rows.length)throw Error('No records in the selected analysis year.');
 out.textContent='Checking records against the analysed boundary…';
 const fc=ee.FeatureCollection(rows.map(r=>ee.Feature(ee.Geometry.Point([r.longitude,r.latitude]),r))).filterBounds(geometry);
 const data=await new Promise((resolve,reject)=>fc.evaluate((v,e)=>e?reject(Error(e)):resolve(v)));
 if(ticket!==revision||geometry!==window.aoi||analysisYear!==Number(window.year))throw Error('Analysis area or year changed. Upload again.');
 const inside=(data.features||[]).map(f=>f.properties),groups=[];
 for(const type of [...new Set(inside.map(r=>r.type))]){const part=inside.filter(r=>r.type===type),m=metrics(part);groups.push({type,unit:part[0].unit,...m})}
 if(!groups.length)throw Error('No records within the analysed area.');
 const summary=groups.map(g=>g.type+' ('+g.unit+'): n='+g.n+', bias='+g.bias.toFixed(3)+', MAE='+g.mae.toFixed(3)+', RMSE='+g.rmse.toFixed(3)).join('\n');
 out.textContent=summary+'\nExcluded (outside AOI/year): '+(parseCSV(await file.text()).length-inside.length)+'. User-paired records; not an independent calibration or automatic satellite extraction.';
 window.hydroValidationSummary={geometry,year:analysisYear,summary:out.textContent};
 if(window.L&&window.hydroMapBridge?.measurements)window.hydroMapBridge.measurements(data);
 }catch(e){if(ticket===revision)out.textContent=e.message;}
};
document.getElementById('hydroGroundTemplate').onclick=()=>{const csv='station,date,time,type,latitude,longitude,observed,estimated,unit\n';const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'})),a=document.createElement('a');a.href=url;a.download='SIEG_Hydrology_Ground_Records.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
})();

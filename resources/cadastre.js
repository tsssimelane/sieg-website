const get=id=>document.getElementById(id),form=get('cadastreForm'),fileInput=get('cadastreFile'),tolerance=get('cadastreTolerance'),status=get('cadastreStatus'),polygons=get('cadastrePolygons'),issues=get('cadastreIssues');
let result;
function reset(){result=null;polygons.disabled=issues.disabled=true;status.hidden=true;}
fileInput.onchange=tolerance.oninput=reset;
function download(layer,name){
 if(!layer?.features.length)return;
 const url=URL.createObjectURL(new Blob([JSON.stringify(layer)],{type:'application/geo+json'})),a=document.createElement('a');
 a.href=url;a.download=name+'.geojson';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
polygons.onclick=()=>download(result?.polygons,'sieg-parcel-polygons');
issues.onclick=()=>download(result?.issues,'sieg-open-edges');
form.onsubmit=async event=>{
 event.preventDefault();reset();status.hidden=false;
 const file=fileInput.files[0];if(!file)return;
 if(file.size>10*1024*1024){status.textContent='Choose a file up to 10 MB.';return;}
 const button=form.querySelector('button');button.disabled=fileInput.disabled=tolerance.disabled=true;status.textContent='Checking boundaries and building polygons…';
 try{
  result=await new Promise((resolve,reject)=>{
   const worker=new Worker(new URL('./cadastre-worker.js?v=7000',import.meta.url),{type:'module'});
   const finish=()=>{clearTimeout(timer);worker.terminate();};
   const timer=setTimeout(()=>{finish();reject(Error('Processing timed out. Try a smaller area.'));},45000);
   worker.onmessage=({data})=>{finish();data.error?reject(Error(data.error)):resolve(data);};
   worker.onerror=()=>{finish();reject(Error('The boundary tool could not start. Reload Resources and try again.'));};
   worker.postMessage({file,tolerance:tolerance.valueAsNumber});
  });
  const r=result.report;
  status.textContent=(r.polygons?r.polygons+' polygons built. ':'No closed polygons found. ')+r.snapped+' vertices snapped · '+r.splitEdges+' segments split · '+r.duplicates+' duplicate edges removed · '+r.collapsed+' collapsed segments removed · '+r.unusedEdges+' open or connecting edges to review.';
  polygons.disabled=!r.polygons;issues.disabled=!r.unusedEdges;
 }catch(e){status.textContent=e.message;}
 finally{button.disabled=fileInput.disabled=tolerance.disabled=false;}
};

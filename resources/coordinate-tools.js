import {distanceNodes} from './distance-nodes.js';
import {coordinateTransform} from './coordinate-crs.js';
import {readWorkbookZip,openWorkbook,workbookHeaders,convertWorkbook} from './coordinate-workbook.js';
import {readReferenceShapefile} from './reference-shapefile.js';

const $=id=>document.getElementById(id);
const status=(id,text)=>{const el=$(id);el.hidden=!text;el.textContent=text;};
const download=(blob,name)=>{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);};
let nodes=null,book=null,result=null,openTicket=0;
function clearNodes(){nodes=null;$('nodeDownload').disabled=true;status('nodeStatus','');}
$('nodeForm').addEventListener('input',clearNodes);
$('nodeForm').onsubmit=async e=>{
 e.preventDefault();clearNodes();
 const file=$('nodeFile').files[0];if(!file)return;
 if(file.size>10*1024*1024)return status('nodeStatus','Choose a line file up to 10 MB.');
 const controls=[e.submitter,...['nodeFile','nodeSpacing','nodeUnit','nodeEnd'].map($)].filter(Boolean);
 controls.forEach(el=>el.disabled=true);status('nodeStatus','Generating nodes…');
 try{
  const input=/\.zip$/i.test(file.name)?await readReferenceShapefile(await file.arrayBuffer()):JSON.parse(await file.text());
  const {data,lines}=distanceNodes(input,$('nodeSpacing').valueAsNumber,$('nodeUnit').value,$('nodeEnd').checked);
  nodes=data;$('nodeDownload').disabled=false;
  status('nodeStatus',data.features.length.toLocaleString()+' nodes generated across '+lines.toLocaleString()+' line parts.');
 }catch(err){status('nodeStatus',err.message);}
 finally{controls.forEach(el=>el.disabled=false);}
};
$('nodeDownload').onclick=()=>{if(nodes)download(new Blob([JSON.stringify(nodes)],{type:'application/geo+json'}),'sieg-line-distance-nodes.geojson');};

function clearWorkbookResult(){result=null;$('coordDownload').disabled=true;}
function columns(){
 clearWorkbookResult();const x=$('coordX'),y=$('coordY');x.replaceChildren();y.replaceChildren();
 try{
  const headers=workbookHeaders(book,Number($('coordSheet').value));
  if(headers.length<2)throw Error('This worksheet needs at least two columns with headers in row 1.');
  for(const h of headers){x.add(new Option(h.col+' · '+h.label,h.col));y.add(new Option(h.col+' · '+h.label,h.col));}
  x.value=(headers.find(h=>/^(x|lon|lng|longitude|easting)$/i.test(h.label))||headers[0]).col;
  y.value=(headers.find(h=>/^(y|lat|latitude|northing)$/i.test(h.label)&&h.col!==x.value)||headers.find(h=>h.col!==x.value)).col;
  status('coordStatus','Choose the source and target coordinate systems, then convert.');
 }catch(e){status('coordStatus',e.message);}
}
$('coordSheet').onchange=columns;
$('coordForm').addEventListener('input',clearWorkbookResult);
$('coordFile').onchange=async()=>{
 const ticket=++openTicket,file=$('coordFile').files[0];book=null;clearWorkbookResult();$('coordForm').hidden=true;
 if(!file)return status('coordStatus','');
 if(!/\.xlsx$/i.test(file.name)||file.size>15*1024*1024)return status('coordStatus','Choose an .xlsx workbook up to 15 MB.');
 status('coordStatus','Opening workbook…');
 try{
  const opened=openWorkbook(await readWorkbookZip(await file.arrayBuffer()));if(ticket!==openTicket)return;
  book=opened;$('coordSheet').replaceChildren(...book.sheets.map((s,i)=>new Option(s.name,i)));
  $('coordForm').hidden=false;columns();
 }catch(e){if(ticket===openTicket)status('coordStatus',e.message);}
};
$('coordForm').onsubmit=async e=>{
 e.preventDefault();if(!book)return;clearWorkbookResult();
 const ticket=openTicket,form=$('coordForm'),controls=[...form.elements].filter(el=>!el.disabled);
 controls.forEach(el=>el.disabled=true);status('coordStatus','Converting coordinates…');
 try{
  const library=await import('../assets/vendor/shp-6.1.0.js?v=coordinate-crs'),project=library.default?.project||globalThis.SiegCoordinateProjection;
  if(ticket!==openTicket)return;
  if(!project)throw Error('Coordinate engine unavailable. Reload Resources.');
  const from=$('coordFrom').value.trim(),to=$('coordTo').value.trim();
  result=convertWorkbook(book,Number($('coordSheet').value),$('coordX').value,$('coordY').value,to,coordinateTransform(project,from,to));
  const {converted,skipped,X,Y}=result;
  status('coordStatus',converted.toLocaleString()+' rows converted into columns '+X+' and '+Y+'.'+(skipped?' '+skipped.toLocaleString()+' rows with missing or invalid coordinates were left blank.':''));
 }catch(e){if(ticket===openTicket)status('coordStatus',e.message);}
 finally{controls.forEach(el=>el.disabled=false);$('coordDownload').disabled=!result;}
};
$('coordDownload').onclick=()=>{
 if(!result)return;
 const name=$('coordFile').files[0].name.replace(/\.xlsx$/i,'');
 const zip=window.SiegZip([...result.files]);
 download(new Blob([zip],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),name+'-converted.xlsx');
};

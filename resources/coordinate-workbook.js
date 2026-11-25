const decoder=new TextDecoder(),encoder=new TextEncoder();
const MAX=60*1024*1024;
export async function readWorkbookZip(buffer){
 const v=new DataView(buffer),all=new Uint8Array(buffer),files=new Map();let end=-1;
 for(let i=all.length-22;i>=Math.max(0,all.length-65557);i--)if(v.getUint32(i,true)===0x06054b50&&i+22+v.getUint16(i+20,true)===all.length){end=i;break;}
 if(end<0||v.getUint16(end+4,true)||v.getUint16(end+6,true))throw Error('Choose a standard, unencrypted .xlsx workbook.');
 const count=v.getUint16(end+10,true);let p=v.getUint32(end+16,true),total=0;
 if(count>2500||p>end)throw Error('Workbook contains too many parts.');
 for(let i=0;i<count;i++){
  if(p+46>end||v.getUint32(p,true)!==0x02014b50)throw Error('Invalid workbook ZIP directory.');
  const flags=v.getUint16(p+8,true),method=v.getUint16(p+10,true),packed=v.getUint32(p+20,true),size=v.getUint32(p+24,true);
  const n=v.getUint16(p+28,true),e=v.getUint16(p+30,true),c=v.getUint16(p+32,true),o=v.getUint32(p+42,true);
  if((flags&1)||p+46+n+e+c>end||(total+=size)>MAX||o+30>end||v.getUint32(o,true)!==0x04034b50)throw Error('Invalid workbook ZIP or expanded size exceeds 60 MB.');
  const name=decoder.decode(all.subarray(p+46,p+46+n)),start=o+30+v.getUint16(o+26,true)+v.getUint16(o+28,true);
  if(start+packed>end||files.has(name)||![0,8].includes(method))throw Error('Unsupported workbook ZIP entry.');
  let data=all.subarray(start,start+packed);
  if(method===8){
   const reader=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(),expanded=new Uint8Array(size);let len=0;
   try{for(;;){const {value,done}=await reader.read();if(done)break;if(len+value.length>size)throw Error('Workbook ZIP entry exceeded its declared size.');expanded.set(value,len);len+=value.length;}if(len!==size)throw Error('Workbook ZIP entry size mismatch.');}
   finally{await reader.cancel().catch(()=>{});}
   data=expanded;
  }
  if(data.length!==size)throw Error('Invalid workbook ZIP entry size.');
  files.set(name,data);p+=46+n+e+c;
 }
 return files;
}
const children=(p,n)=>[...p.children].filter(x=>x.localName===n);
const child=(p,n)=>children(p,n)[0];
function xml(files,path){
 const bytes=files.get(path);if(!bytes)throw Error('Workbook is missing '+path+'.');
 const s=decoder.decode(bytes);if(/<!DOCTYPE/i.test(s))throw Error('Workbook XML contains an unsupported declaration.');
 const d=new DOMParser().parseFromString(s,'application/xml');
 if(d.getElementsByTagName('parsererror').length)throw Error('Could not read '+path+'.');return d;
}
function pathFor(target){
 if(!target||target.includes('\\')||target.includes(':')||target.includes('..'))return '';
 return target.startsWith('/')?target.slice(1):'xl/'+target;
}
export function openWorkbook(files){
 const w=xml(files,'xl/workbook.xml').documentElement,r=xml(files,'xl/_rels/workbook.xml.rels').documentElement;
 const relations=new Map(children(r,'Relationship').map(e=>[e.getAttribute('Id'),e]));
 const sheets=children(child(w,'sheets'),'sheet').flatMap(s=>{
  const id=[...s.attributes].find(a=>a.localName==='id')?.value,e=relations.get(id);
  const path=e?.getAttribute('Type')?.endsWith('/worksheet')?pathFor(e.getAttribute('Target')):'';
  return path&&files.has(path)?[{name:s.getAttribute('name'),path}]:[];
 });
 if(!sheets.length)throw Error('No worksheets found.');
 const stringsRel=[...relations.values()].find(e=>e.getAttribute('Type')?.endsWith('/sharedStrings')),stringsPath=pathFor(stringsRel?.getAttribute('Target'));
 const strings=stringsPath?children(xml(files,stringsPath).documentElement,'si').map(textParts):[];
 return {files,sheets,strings};
}
function textParts(e){return [...e.getElementsByTagNameNS('*','t')].map(t=>t.textContent).join('');}
function cellValue(c,strings){
 if(!c)return '';
 const v=child(c,'v')?.textContent??'',type=c.getAttribute('t');
 if(type==='inlineStr')return textParts(c);
 if(type==='s')return strings[Number(v)]??'';
 if(type==='b'||type==='e'||type==='d')return '';
 return v;
}
function colNum(s){let n=0;for(const c of s)n=n*26+c.charCodeAt(0)-64;return n;}
function colName(n){let s='';while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s;}
const address=c=>/^([A-Z]{1,3})([1-9]\d*)$/.exec(c.getAttribute('r')||'');
function sheet(book,index){
 const {path}=book.sheets[index]||{};if(!path)throw Error('Choose a worksheet.');
 const doc=xml(book.files,path),root=doc.documentElement,data=child(root,'sheetData');
 if(!data)throw Error('Worksheet contains no data.');
 const rows=children(data,'row');if(rows.length>50001)throw Error('Use up to 50,000 data rows.');
 const header=rows.find(r=>r.getAttribute('r')==='1'||children(r,'c').some(c=>address(c)?.[2]==='1'));
 if(!header)throw Error('Put column headings in row 1.');
 return {path,doc,root,rows,header};
}
export function workbookHeaders(book,index){
 const {header}=sheet(book,index);
 return children(header,'c').flatMap(c=>{const m=address(c);if(!m)return [];return [{col:m[1],label:String(cellValue(c,book.strings)).trim()||m[1]}];});
}
function number(s){s=String(s).trim();return /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(s)?Number(s):NaN;}
export function convertWorkbook(book,index,xCol,yCol,target,transform){
 if(xCol===yCol||!/^\b[A-Z]{1,3}$/.test(xCol)||!/^\b[A-Z]{1,3}$/.test(yCol))throw Error('Choose two different coordinate columns.');
 const {path,doc,root,rows,header}=sheet(book,index);
 let max=0,last=1,converted=0,skipped=0,blank=0;
 for(const r of rows)for(const c of children(r,'c')){const a=address(c);if(a){max=Math.max(max,colNum(a[1]));last=Math.max(last,Number(a[2]));}}
 const dim=child(root,'dimension'),dimEnd=/([A-Z]{1,3})(\d+)$/.exec(dim?.getAttribute('ref')||'');
 if(dimEnd){max=Math.max(max,colNum(dimEnd[1]));last=Math.max(last,Number(dimEnd[2]));}
 if(max>16382)throw Error('The worksheet has no room for two additional columns.');
 const X=colName(max+1),Y=colName(max+2),ns=root.namespaceURI;
 const add=(row,ref,val,isHeader=false)=>{
  const c=doc.createElementNS(ns,'c');c.setAttribute('r',ref);
  if(isHeader){c.setAttribute('t','inlineStr');const is=doc.createElementNS(ns,'is'),t=doc.createElementNS(ns,'t');t.textContent=val;is.append(t);c.append(is);}
  else{const v=doc.createElementNS(ns,'v');v.textContent=String(val);c.append(v);}
  row.insertBefore(c,[...row.children].find(e=>e.localName!=='c')||null);
  row.removeAttribute('spans');
 };
 add(header,X+'1','X_EPSG_'+target,true);add(header,Y+'1','Y_EPSG_'+target,true);
 for(const r of rows){
  if(r===header)continue;
  const cells=children(r,'c'),row=r.getAttribute('r')||address(cells[0]||r)?.[2];if(!row||row==='1')continue;
  const x=cellValue(cells.find(c=>address(c)?.[1]===xCol),book.strings),y=cellValue(cells.find(c=>address(c)?.[1]===yCol),book.strings);
  if(!String(x).trim()&&!String(y).trim()){blank++;continue;}
  const out=transform(number(x),number(y));if(!out){skipped++;continue;}
  add(r,X+row,out[0]);add(r,Y+row,out[1]);converted++;
 }
 if(!converted)throw Error('No valid coordinate pairs found. Check the selected columns and source EPSG.');
 if(dim)dim.setAttribute('ref','A1:'+Y+last);
 const files=new Map(book.files);files.set(path,encoder.encode(new XMLSerializer().serializeToString(doc)));
 return {files,converted,skipped,blank,X,Y};
}

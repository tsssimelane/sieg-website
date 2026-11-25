// ESRI shapefile components and uncompressed ZIP, generated entirely on-device.
(() => {
'use strict';
const enc=new TextEncoder(), bytes=s=>enc.encode(s);
const buffer=n=>{const b=new Uint8Array(n);return [b,new DataView(b.buffer)]};
const box=p=>p.reduce(([x,y,X,Y],q)=>[Math.min(x,q.x),Math.min(y,q.y),Math.max(X,q.x),Math.max(Y,q.y)],[Infinity,Infinity,-Infinity,-Infinity]);
const writeBox=(v,i,b)=>b.forEach((n,k)=>v.setFloat64(i+k*8,n,true));
const header=(v,size,type,extent)=>{v.setInt32(0,9994);v.setInt32(24,size/2);v.setInt32(28,1000,true);v.setInt32(32,type,true);writeBox(v,36,extent)};
const fields=[['FIELD_ID',36],['FIELD_NAME',80],['NAME',100],['COUNTRY',80],['ADM1',100],['ADM2',100],['START_UTC',24],['END_UTC',24],['FIX_UTC',24],['ACCUR_M',10,'N'],['FEATURE_ID',36],['VERTEX',8,'N']];
function dbf(rows,columns=fields){
 const start=33+32*columns.length,width=1+columns.reduce((n,[,w])=>n+w,0),[b,v]=buffer(start+width*rows.length+1),now=new Date();
 b.set([3,now.getUTCFullYear()-1900,now.getUTCMonth()+1,now.getUTCDate()]);v.setUint32(4,rows.length,true);v.setUint16(8,start,true);v.setUint16(10,width,true);
 columns.forEach(([name,w,t='C'],i)=>{const o=32+i*32;b.set(bytes(name),o);b[o+11]=t.charCodeAt(0);b[o+16]=w;b[o+17]=name==='ACCUR_M'?1:0});b[start-1]=13;
 rows.forEach(({attributes},i)=>{let o=start+i*width;b.fill(32,o,o+width);o++;for(const [k,w,t] of columns){let s=String(attributes[k]??'');while(bytes(s).length>w)s=s.slice(0,-1);const data=bytes(s);b.set(data,t==='N'?o+w-data.length:o);o+=w}});b[b.length-1]=26;return b;
}
function shape(rows,type){
 const contentSizes=rows.map(r=>type===1?20:48+r.points.length*16);
 const [shp,v]=buffer(100+contentSizes.reduce((n,s)=>n+s+8,0)),[shx,x]=buffer(100+8*rows.length);
 const extent=rows.reduce((b,r)=>{const e=box(r.points);return [Math.min(b[0],e[0]),Math.min(b[1],e[1]),Math.max(b[2],e[2]),Math.max(b[3],e[3])] },[Infinity,Infinity,-Infinity,-Infinity]);
 header(v,shp.length,type,extent);header(x,shx.length,type,extent);
 let o=100;rows.forEach((r,i)=>{const size=contentSizes[i];x.setInt32(100+i*8,o/2);x.setInt32(104+i*8,size/2);v.setInt32(o,i+1);v.setInt32(o+4,size/2);v.setInt32(o+8,type,true);
 if(type===1){v.setFloat64(o+12,r.points[0].x,true);v.setFloat64(o+20,r.points[0].y,true)}
 else{writeBox(v,o+12,box(r.points));v.setInt32(o+44,1,true);v.setInt32(o+48,r.points.length,true);
 r.points.forEach((p,j)=>{v.setFloat64(o+56+16*j,p.x,true);v.setFloat64(o+64+16*j,p.y,true)})}
 o+=size+8;});return {shp,shx};
}
const crcTable=Uint32Array.from({length:256},(_,i)=>{for(let j=0;j<8;j++)i=(i>>>1)^((i&1)?0xedb88320:0);return i});
function zip(files){
 const out=[],directory=[];let offset=0,centralSize=0;
 for(const [name,data] of files){const label=bytes(name),[local,l]=buffer(30+label.length),[central,c]=buffer(46+label.length);
 let crc=0xffffffff;for(const b of data)crc=(crc>>>8)^crcTable[(crc^b)&255];crc^=0xffffffff;
 l.setUint32(0,0x04034b50,true);l.setUint16(4,20,true);l.setUint16(12,33,true);l.setUint32(14,crc,true);l.setUint32(18,data.length,true);l.setUint32(22,data.length,true);l.setUint16(26,label.length,true);local.set(label,30);
 c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);central.set(local.subarray(4,30),6);c.setUint32(42,offset,true);central.set(label,46);out.push(local,data);directory.push(central);offset+=local.length+data.length;centralSize+=central.length;}
 const [end,e]=buffer(22);e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,centralSize,true);e.setUint32(16,offset,true);
 return new Blob([...out,...directory,end],{type:'application/zip'});
}
window.SiegZip=zip;
const projection='GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433],AUTHORITY["EPSG","4326"]]';
function ring(points){const closed=[...points,points[0]],a=points[0];let sum=0;for(let i=1;i<closed.length;i++)sum+=(closed[i-1].x-a.x)*(closed[i].y-a.y)-(closed[i].x-a.x)*(closed[i-1].y-a.y);return sum>0?closed.reverse():closed}
window.SiegShapefile=(features,extraFiles=[])=>{
 const questions=new Map();for(const f of features)for(const q of f.survey?.schema||[])if(!questions.has(q.id))questions.set(q.id,{...q,column:'Q'+String(questions.size+1).padStart(3,'0')});
 if(questions.size>200)throw Error('Export this batch before adding more questionnaire fields.');
 const custom=[...questions.values()],columns=[...fields,...custom.map(q=>[q.column,250])];
 const layers={points:[1,[]],lines:[3,[]],polygons:[5,[]],gps_fixes:[1,[]]};
 for(const f of features){
 const a={FIELD_ID:f.field?.id||'',FIELD_NAME:f.field?.name||'',NAME:f.name,COUNTRY:f.admin.country,ADM1:f.admin.adm1,ADM2:f.admin.adm2,START_UTC:f.points[0].time,END_UTC:f.points.at(-1).time,FEATURE_ID:f.id,...Object.fromEntries(custom.map(q=>[q.column,String(f.survey?.answers?.[q.id]??'')]))};
 layers[f.type+'s'][1].push({points:f.type==='polygon'?ring(f.points):f.points,attributes:{...a,...(f.type==='point'?{FIX_UTC:f.points[0].time,ACCUR_M:f.points[0].accuracy.toFixed(1)}:{})}});
 f.points.forEach((p,i)=>layers.gps_fixes[1].push({points:[p],attributes:{...a,FIX_UTC:p.time,ACCUR_M:p.accuracy.toFixed(1),VERTEX:i+1}}));}
 const files=[];for(const [name,[type,rows]] of Object.entries(layers)){if(!rows.length)continue;const {shp,shx}=shape(rows,type);for(const [ext,data] of Object.entries({shp,shx,dbf:dbf(rows,columns),prj:bytes(projection),cpg:bytes('UTF-8')}))files.push([name+'.'+ext,data]);}files.push(['questionnaire-fields.json',bytes(JSON.stringify(custom,null,2))],...extraFiles);return zip(files);
};
})();

const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class Image{
 constructor(band,type,value,valid=true){Object.assign(this,{band,type,value,valid})}
 select(bands){assert.equal(bands[0],this.band);return this}
 toDouble(){return new Image(this.band,'Double',this.value,this.valid)}
 copyProperties(){return this}
 rename(band){return new Image(band,this.type,this.value,this.valid)}
 setDefaultProjection(crs,_,scale){this.crs=crs;this.scale=scale;return this}
}
class Collection{
 constructor(images){this.images=images}
 select(bands){return new Collection(this.images.map(im=>im.select(bands)))}
 map(fn){return new Collection(this.images.map(fn))}
 merge(other){return new Collection([...this.images,...other.images])}
 count(){const first=this.images[0];for(const im of this.images){if(im.type!==first.type||im.band!==first.band)throw Error('Expected a homogeneous image collection');}return new Image(first.band,'Integer',this.images.filter(im=>im.valid).length)}
}
const source=fs.readFileSync('enviro/assets/engine.js','utf8'),helper=source.slice(source.indexOf('function safeObservationCount('),source.indexOf('function ecoPeriodEnd('));
const c={CONFIG:{crs:'EPSG:4326'},ee:{ImageCollection:{fromImages:images=>new Collection(images)}},masked:(bands,scale)=>new Image(bands[0],'Float',0,false)};vm.createContext(c);vm.runInContext(helper,c);
const native=new Collection([new Image('label','Short<0,255>',0),new Image('label','Short<0,255>',4)]);
assert.throws(()=>native.merge(new Collection([c.masked(['label'],10)])).count(),/homogeneous/,'Fixture reproduces original integer/float mismatch even with masked seed');
let count=c.safeObservationCount(native,'label',10);assert.equal(count.value,2,'Water class zero remains a valid observation');assert.equal(count.band,'label');assert.equal(count.scale,10);
count=c.safeObservationCount(new Collection([new Image('landcover','Short<0,255>',1),new Image('landcover','Float',4)]),'landcover',10);assert.equal(count.value,2,'All source images are normalized, not just the seed');
count=c.safeObservationCount(new Collection([]),'label',10);assert.equal(count.value,0,'The empty seed contributes no observation');
count=c.safeObservationCount(new Collection([new Image('label','Short<0,255>',1,false)]),'label',10);assert.equal(count.value,0,'Cloud-masked scenes are not counted');
assert(source.includes("safeObservationCount(confident, 'landcover', 10)"));assert(source.includes("safeObservationCount(raw.source, 'label', 10)"));
console.log('PASS: reproduces original type mismatch; typed normalization fixes native labels, filtered land cover, mixed input types and empty collections without counting masked seeds');

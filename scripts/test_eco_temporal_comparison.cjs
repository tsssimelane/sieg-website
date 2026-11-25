const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class Img{
 constructor(bands,valid=true){this.bands=bands;this.valid=valid} value(){return Object.values(this.bands)[0]}
 select(keys){keys=Array.isArray(keys)?keys:[keys];return new Img(Object.fromEntries(keys.map(k=>[k,this.bands[k]])),this.valid)}
 rename(keys){keys=Array.isArray(keys)?keys:[keys];return new Img(Object.fromEntries(keys.map((k,i)=>[k,Object.values(this.bands)[i]])),this.valid)}
 toDouble(){return this}toByte(){return this}copyProperties(){return this}setDefaultProjection(){return this}
 reduce(){return new Img({max:Math.max(...Object.values(this.bands))},this.valid)}
 gte(n){return new Img({value:this.value()>=n?1:0},this.valid)}eq(other){return new Img({value:this.value()===(other instanceof Img?other.value():other)?1:0},this.valid&&(!(other instanceof Img)||other.valid))}
 and(other){return new Img({value:this.value()&&other.value()?1:0},this.valid&&other.valid)}or(other){return new Img({value:this.value()||other.value()?1:0},this.valid&&other.valid)}
 updateMask(m){return new Img(this.bands,this.valid&&m.valid&&!!m.value())}unmask(v){return this.valid?this:new Img(Object.fromEntries(Object.keys(this.bands).map(k=>[k,v])))}
 mask(){return new Img({mask:this.valid?1:0})}multiply(n){return new Img({value:this.value()*n},this.valid)}
 where(test,value){return new Img({value:test.valid&&test.value()?(value instanceof Img?value.value():value):this.value()},this.valid)}
}
class Col{
 constructor(images){this.images=images}map(fn){return new Col(this.images.map(fn))}select(keys){return this.map(i=>i.select(keys))}merge(other){return new Col([...this.images,...other.images])}
 count(){return new Img({landcover:this.images.filter(i=>i.valid).length},this.images.some(i=>i.valid))}
 reduce(method){const images=this.images.filter(i=>i.valid);if(!images.length)return new Img({value:0},false);const values=images.map(i=>i.value()),counts=new Map();for(const v of values)counts.set(v,(counts.get(v)||0)+1);return new Img({mode:[...counts].sort((a,b)=>b[1]-a[1]||a[0]-b[0])[0][0]})}
 mean(){const images=this.images.filter(i=>i.valid);return new Img({value:images.reduce((s,i)=>s+i.value(),0)/(images.length||1)},!!images.length)}
}
const scene=(label,confidence=.6)=>new Img({trees:label===1?confidence:1-confidence,crops:label===4?confidence:1-confidence,label});
const source=fs.readFileSync('enviro/assets/engine.js','utf8');let periods={};
const c={Img,Col,CONFIG:{confidence:.55,comparisonMinViews:2,comparisonAgreement:.6,crs:'EPSG:4326'},state:{analysisYear:2026},utcNow:new Date('2026-11-22'),cache:{},DW_BANDS:['trees','crops'],habitat:i=>i.eq(1),ee:{Image:{constant:values=>new Img(Object.fromEntries((Array.isArray(values)?values:[values]).map((v,i)=>['b'+i,v])))},ImageCollection:{fromImages:images=>new Col(images)},Reducer:{mode:()=> 'mode',max:()=> 'max'}},dwFor:year=>({source:new Col(periods[year]||[]),probability:new Img({trees:.5,crops:.5},!!periods[year]?.length)})};vm.createContext(c);
vm.runInContext(source.slice(source.indexOf('function masked('),source.indexOf('function ecoPeriodEnd(')),c);
vm.runInContext(source.slice(source.indexOf('function dwComparisonFor('),source.indexOf('function productivityChart(')),c);
function compare(old,now){periods={2019:old,2026:now};c.cache={};return c.coverDegradation({year:2026,baseline:2019,season:'Full year'});}
const current=[scene(1),scene(1),scene(1),scene(4),scene(4)],baseline=[...Array.from({length:7},()=>scene(4)),...Array.from({length:3},()=>scene(1))];
const maxMean=Math.max(...['trees','crops'].map(b=>current.reduce((s,i)=>s+i.bands[b],0)/current.length));assert(maxMean<.55,'Fixture reproduces dilution in the original mean-probability filter');
let result=compare(baseline,current);assert(result.image.valid);assert.equal(result.image.value(),2,'Repeated confident crop-to-tree observations retain the improvement signal');assert.equal(result.cur.observations.value(),5);assert.equal(result.cur.agreement.value(),.6);
result=compare(current,current);assert.equal(result.image.value(),0,'Consistent periods remain stable');
result=compare(current,[scene(1)]);assert.equal(result.image.valid,false,'One confident image is insufficient');
result=compare(current,[scene(1),scene(1),scene(4),scene(4)]);assert.equal(result.image.valid,false,'A tied/unstable period is not forced to a class');
result=compare(current,[scene(1,.5),scene(1,.5),scene(1,.5)]);assert.equal(result.image.valid,false);assert.equal(result.cur.observations.value(),0,'Weak observations never become confident via voting');
result=compare(current,[]);assert.equal(result.image.valid,false,'Missing data are not filled');
result=compare([scene(1),scene(1)],[scene(4),scene(4)]);assert.equal(result.image.value(),1,'Repeated habitat-to-crop observations retain degradation rule');
assert(source.includes('function dwFor(year, season)'),'Other land-cover products keep their existing composite');
console.log('PASS: actual comparison graph handles probability dilution, confident temporal modes, both-period support, ties, single observations, weak evidence, missing imagery and transition rules');
// Exercise the actual single-period land-cover descriptor using the same scene fixtures.
c.LC_NAMES=['Water','Trees','Grass','Flooded vegetation','Crops','Shrub and scrub','Built','Bare','Snow'];c.LC_COLORS=Array(9).fill('008080');c.descriptor=(image,title,units,vis,source,collection,categories)=>({image,title,units,vis,source,collection,categories,stats:{},cards:[],notes:[]});c.sumArea=mask=>mask.valid&&mask.value()?1:0;
vm.runInContext(source.slice(source.indexOf('function landCoverDisplay('),source.indexOf('function annualModelChart(')),c);
periods={2026:current};c.cache={};let land=c.landModule({year:2026,baseline:2019,season:'Full year',indicator:'Land cover',scale:10});assert.equal(land.image.valid,true);assert.equal(land.image.value(),1,'Annual probability dilution no longer hides the supported modal class');assert.equal(land.stats.valid_ha,1);assert.equal(land.stats.class_1,1);assert.equal(land.stats.changed_ha,undefined,'Single-year cover does not calculate an unrelated baseline');assert.equal(land.vis.max,9);assert.equal(land.categories[9].value,9);
periods={2026:[scene(1,.5),scene(1,.5),scene(1,.5)]};c.cache={};land=c.landModule({year:2026,baseline:2019,season:'Full year',indicator:'Land cover',scale:10});assert.equal(land.image.valid,true);assert.equal(land.image.value(),9,'Observed weak evidence is shown as unassessed, not hidden or assigned a class');assert.equal(land.stats.valid_ha,0);assert.equal(land.stats.unassessed_ha,1);assert.equal(land.supportMask.value(),0,'Unassessed pixels do not count as classified coverage');
periods={2026:[]};c.cache={};land=c.landModule({year:2026,baseline:2019,season:'Full year',indicator:'Land cover',scale:10});assert.equal(land.image.valid,false,'No-observation pixels stay transparent');assert.equal(land.stats.observed_ha,0);
assert.equal(c.landCoverDisplay({lc:new Img({landcover:0}),observed:new Img({observed:1})}).value(),0,'Water class zero remains a valid classification');
console.log('PASS: land-cover map and statistics share confident temporal classes; unassessed observations are explicit, absent data stay transparent, and class zero is retained');

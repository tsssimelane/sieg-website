const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('enviro/assets/engine.js','utf8');
const messages=[...source.matchAll(/d\.resultMessage = (function\(values\) \{[\s\S]*?\n  ?  ?\});/g)].map(m=>vm.runInNewContext('('+m[1]+')'));
assert.equal(messages.length,2);
const [fire,cover]=messages;
assert.match(fire({source_count:0,valid_indicator_ha:0}),/No VIIRS source records/);
assert.match(fire({source_count:2,valid_indicator_ha:0}),/No qualifying fire detections/);
assert.match(fire({source_count:2,valid_indicator_ha:1}),/Fire analysis complete/);
assert.match(cover({source_count:10,baseline_source_count:0,valid_indicator_ha:0}),/both periods need observations/);
assert.match(cover({valid_indicator_ha:1,comparable_ha:0}),/unassessed/);
assert.match(cover({valid_indicator_ha:1,comparable_ha:0.4}),/comparison complete/);
// Execute the actual display expression with masked scalar pixels. Uncertain observations
// are shown explicitly; absent observations remain masked, and confident classes survive.
class Pixel{
 constructor(value,valid=true){this.value=value;this.valid=valid}
 toByte(){return this} setDefaultProjection(){return this} rename(){return this}
 unmask(value){return new Pixel(this.valid?this.value:value)}
 where(test,value){return new Pixel(test.valid&&test.value&&value.valid?value.value:this.value,this.valid)}
 updateMask(mask){return new Pixel(this.value,this.valid&&mask.valid&&!!mask.value)}
}
const expression=source.match(/var display = ([\s\S]*?\.rename\('condition'\));/)[1];
function display(observed,confident,classification){return vm.runInNewContext(expression,{ee:{Image:{constant:n=>new Pixel(n)}},CONFIG:{crs:'EPSG:4326'},observed:new Pixel(observed),comparable:new Pixel(confident),cover:{image:new Pixel(classification,!!confident)}})}
for(const klass of [0,1,2]){const p=display(1,1,klass);assert.equal(p.value,klass);assert.equal(p.valid,true)}
assert.equal(display(1,0,0).value,3,'Paired low-confidence observations are unassessed');
assert.equal(display(0,0,0).valid,false,'Absent paired observations are never filled');
assert(source.includes('d.hideCoverage = true'),'Fire footprint must not be reported as sensor coverage');
console.log('PASS: fire no-detection vs unavailable source, land-cover confident/unassessed/missing pixels and result states');

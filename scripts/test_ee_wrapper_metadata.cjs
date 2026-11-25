const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
for(const service of ['agri','enviro','hydrology']){
 const c={console,setTimeout,clearTimeout,queueMicrotask,URL,URLSearchParams,TextEncoder,Map,location:{href:'https://sieg.test/'},navigator:{userAgent:'node'},addEventListener(){}};c.window=c;c.self=c;vm.createContext(c);vm.runInContext(fs.readFileSync(service+'/assets/ee.js','utf8'),c);
 const registry=c.EXPORTED_FN_INFO;assert(registry,'Real EE parameter registry is available');
 const methods=[[c.ee.Image.prototype,'getMap'],[c.ee.Image.prototype,'getThumbURL'],[c.ee.Image.prototype,'getDownloadURL'],[c.ee.ComputedObject.prototype,'evaluate'],[c.ee.FeatureCollection.prototype,'getDownloadURL']];
 const originals=methods.map(([p,key])=>({fn:p[key],metadata:registry[p[key].toString()]}));for(const {metadata} of originals)assert(metadata);
 const code=fs.readFileSync(process.argv[2]||'assets/shared-analysis.js','utf8');vm.runInContext(code.slice(code.indexOf('// Reuse identical authorised EE work')),c);
 methods.forEach(([p,key],i)=>{assert.notEqual(p[key],originals[i].fn);assert.equal(registry[p[key].toString()],originals[i].metadata,service+': '+key+' keeps real Earth Engine parameter lookup');assert.equal(p[key].length,originals[i].fn.length);});
 console.log('PASS:',service,'actual Earth Engine parameter registry survives all five wrapped report/map methods');
}

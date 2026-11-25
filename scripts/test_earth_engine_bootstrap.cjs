const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
for(const service of ['agri','hydrology']){
 let requests=0;
 const context={console,setTimeout,clearTimeout,URL,URLSearchParams,TextEncoder,Map,XMLHttpRequest:class{constructor(){requests++}open(){}setRequestHeader(){}send(){}},location:{href:'https://sieg.test/'},navigator:{userAgent:'node'}};
 context.window=context;context.self=context;vm.createContext(context);
 vm.runInContext(fs.readFileSync('agri/assets/ee.js','utf8'),context);
 const adapter=fs.readFileSync(service+'/assets/adapter.js','utf8');
 const bridge=adapter.slice(adapter.indexOf('window.Map='),adapter.indexOf('\n',adapter.indexOf('window.Map=')));
 vm.runInContext(bridge,context);
 assert.equal(typeof context.Map.addLayer,'function');
 assert.equal(vm.runInContext('new Map([["check",42]]).get("check")',context),42);
 context.ee.initialize('https://sieg.test/api/earth-engine/api','https://sieg.test/api/earth-engine',()=>{},()=>{},null,'ee-gee023');
 assert.equal(requests,1,'real Earth Engine client must reach XHR with map bridge installed');
 console.log('PASS:',service,'preserves native Map and Earth Engine initialization reaches transport');
}
(async()=>{let attempts=0;const context={window:{},location:{origin:'https://sieg.test'},fetch:async()=>({ok:true,json:async()=>({ready:true,project:'ee-gee023'})}),ee:{initialize(a,b,ok,fail){++attempts===1?fail(Error('Temporary failure')):ok()}}};vm.createContext(context);vm.runInContext(fs.readFileSync('assets/shared-analysis.js','utf8'),context);await assert.rejects(context.window.SiegeAnalysis.initialize(),/Temporary failure/);await context.window.SiegeAnalysis.initialize();assert.equal(attempts,2);console.log('PASS: initialization can recover after a failed attempt');})().catch(e=>{console.error(e);process.exitCode=1});

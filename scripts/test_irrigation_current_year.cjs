const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const base=Date;let today='2026-11-22T00:00:00Z';class Clock extends base{constructor(...args){super(...(args.length?args:[today]));}static now(){return new base(today).getTime();}}
const client=fs.readFileSync('assets/usage-control.js','utf8'),helper=client.slice(client.indexOf('function analysisYear('),client.indexOf('function matches('));
const c={service:'irrigation',window:{year:{value:'not-a-number'}},Date:Clock};vm.createContext(c);vm.runInContext(helper,c);
for(const year of [undefined,null,'',{},'bad',1900,2025,2099])assert.equal(c.analysisYear({year},{year:2099}),2026,'Irrigate ignores stale/shared/requested years');
today='2027-01-01T00:00:00Z';assert.equal(c.analysisYear(),2027,'Current year changes automatically at rollover');
c.service='eco';assert.equal(c.analysisYear({year:2024},{}),2024,'Other services retain their own selected periods');
const backend=fs.readFileSync('worker/usage.js','utf8'),server={Date:Clock};vm.createContext(server);vm.runInContext(backend.slice(0,backend.indexOf('\n')),server);
for(const year of [undefined,null,'bad',2025,2099])assert.equal(server.usageAnalysisYear('irrigation',year),2027,'Server chooses current year even with omitted/invalid client values');assert.equal(server.usageAnalysisYear('eco',2024),2024);
assert(backend.includes('usageAnalysisYear(b.service,b.year)'),'Order validation uses the automatic year');
const app=fs.readFileSync('irrigation/app.js','utf8');assert(app.includes("getScope=()=>({task:'irrigation-design',year:new Date().getUTCFullYear()})"));assert(app.includes('priced,new Date().toISOString().slice(0,10)'),'Daily report period cannot reuse yesterday’s PDF');
const report=fs.readFileSync('irrigation/report.js','utf8');assert(report.includes("period=created.slice(0,4)+'-01-01 to '+created.slice(0,10)"));assert(report.includes('Assessment period: current year to date'));assert(report.includes('not year-to-date measurements'),'Static source/daily assumptions are not mislabelled as current observations');
console.log('PASS: Irrigate client and server use current year automatically, omitted/invalid years cannot block processing, rollover and daily PDF refresh work, other services retain their periods');

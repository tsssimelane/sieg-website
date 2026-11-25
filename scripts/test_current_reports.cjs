const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const hydro=fs.readFileSync('hydrology/assets/dashboard.js','utf8'),eco=fs.readFileSync('enviro/assets/engine.js','utf8'),fields=fs.readFileSync('agri/assets/original-dashboard.js','utf8');
const frozen=Date.parse('2026-10-27T12:00:00Z');class Clock extends Date{constructor(...args){super(...(args.length?args:[frozen]))}static now(){return frozen}}
function date(value){const number=Number(value);return{millis:()=>number,valueOf:()=>number}}
const ee={Date:date,Number:n=>({min:v=>Math.min(Number(n),v)})};
const c={Date:Clock,ee,year:2026};vm.createContext(c);
vm.runInContext(hydro.match(/function hydroCutoff\(date\)\{[^\n]+/)[0]+'\n'+hydro.match(/function hydroMonthCount\(\)\{[\s\S]*?\n\}/)[0],c);
assert.equal(Number(c.hydroCutoff(Date.parse('2027-01-01'))),frozen);assert.equal(Number(c.hydroCutoff(Date.parse('2025-01-01'))),Date.parse('2025-01-01'));assert.equal(c.hydroMonthCount(),10);c.year=2025;assert.equal(c.hydroMonthCount(),12);
assert(hydro.includes('new Date().getUTCFullYear()'));assert(eco.includes('function ecoPeriodEnd(year)'));assert(eco.includes('ecoPeriodEnd(yy)'));
assert(!fields.includes("'2026-09-30'"));assert(fields.includes('function buildCurrentClimatePanel'));assert(fields.includes("latestDate.advance(1,'month')"));
for(const path of ['hydrology/assets/adapter.js','hydrology/assets/flood-watch.js'])assert(!fs.readFileSync(path,'utf8').includes("kind:'download'"),path);
assert(!hydro.includes('Export.table.toDrive'));assert(!hydro.includes('Export dam estimate'));assert(!fs.readFileSync('enviro/assets/app.js','utf8').includes("$('export')"));
const env=vm.createContext({console,TextEncoder});vm.runInContext(fs.readFileSync('worker/reports.js','utf8'),env);
const body={service:'fields',method:'collection',requestId:'12345678-1234-1234-1234-123456789012',contact:{name:'A',email:'a@example.com',dial:'+268',phone:'76000000',consent:true},files:[{filename:'Report.html',content:'report',encoding:'utf8'}]};
env.reportValidate(body);body.files[0].filename='Data.csv';assert.throws(()=>env.reportValidate(body),/report requests only/);body.service='address';env.reportValidate(body);
console.log('PASS: dynamic current year, current-date caps, no future months, latest rolling baseline, report-only RS controls and server rejection of raw exports; Address downloads retained.');

let selectedFieldsYear='2019';const fy=vm.createContext({Date:Clock,siegFieldsAnalysisYear:'2019',document:{getElementById:()=>({value:selectedFieldsYear})}});vm.runInContext(fields.split('\n').filter(line=>/^function fields(AnalysisYear|PeriodStart|PeriodEnd)/.test(line)).join('\n'),fy);assert.equal(fy.fieldsPeriodStart(),'2019-01-01T00:00:00.000Z');assert.equal(fy.fieldsPeriodEnd(),'2020-01-01T00:00:00.000Z');selectedFieldsYear='2026';fy.siegFieldsAnalysisYear=2026;assert.equal(Date.parse(fy.fieldsPeriodEnd()),frozen);console.log('PASS: Fields selected-year observation windows and current-year cutoff.');

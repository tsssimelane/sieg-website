const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const c={window:{},document:{getElementById:()=>null},Date,Number,Error};vm.createContext(c);vm.runInContext(fs.readFileSync('hydrology/assets/validation.js','utf8'),c);
const {parseCSV,metrics}=c.window.HydroValidation;
const head='station,date,type,latitude,longitude,observed,estimated,unit\n';
let rows=parseCSV(head+'"Gauge, A",2025-01-01,rainfall,-26,31,10,12,mm\nB,2025-02-01,rainfall,-26,31,20,18,mm');
assert.equal(rows.length,2);assert.equal(rows[0].station,'Gauge, A');assert.equal(metrics(rows).bias,0);assert.equal(metrics(rows).mae,2);assert.equal(metrics(rows).rmse,2);
assert.throws(()=>parseCSV(head+'A,2025-01-01,river_flow,-26,31,10,12,mm'),/units/);
assert.throws(()=>parseCSV(head+'A,2025-01-01,rainfall,-26,31,,12,mm'),/observed/);
assert.throws(()=>parseCSV(head+'A,2025-02-31,rainfall,-26,31,10,12,mm'),/date/);
console.log('PASS: CSV quoting, dates, units, missing values, paired bias/MAE/RMSE.');

assert.equal(parseCSV(head.replace('date,type','date,time,type')+'A,2025-01-01,13:45,river_flow,-26,31,10,12,m3/s')[0].time,'13:45');
assert.throws(()=>parseCSV(head.replace('date,type','date,time,type')+'A,2025-01-01,25:00,river_flow,-26,31,10,12,m3/s'),/UTC time/);

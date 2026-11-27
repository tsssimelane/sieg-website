import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('worker/chemicals.js','utf8');
test('requires authenticated owner and refuses missing storage',async()=>{
 const ctx={URL,reportOwner:()=>null,opsJSON:(d,status=200)=>({d,status})};vm.createContext(ctx);vm.runInContext(source,ctx);
 assert.equal((await ctx.chemicalsAPI({url:'https://test/api/chemicals/records'},{})).status,401);
 ctx.reportOwner=()=> 'owner';assert.equal((await ctx.chemicalsAPI({url:'https://test/api/chemicals/records'},{})).status,503);
});
test('records are bound to saved owners fields and seasons and no application rates are calculated',()=>{
 assert.match(source,/kind='ledger_field' AND owner=\? AND id=\?/);
 assert.match(source,/kind='chemical_record' AND owner=\?/);
 assert.match(source,/f\.seasons\.find\(v=>v\.id===x\.seasonId\)/);
 assert.doesNotMatch(source,/applicationRate|recommendedDose/);
 const h=fs.readFileSync('chemicals/content.html','utf8');
 assert.match(h,/Actual quantity/);assert.match(h,/does not recommend chemical treatments/);
});

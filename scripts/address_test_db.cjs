// Real SQLite JSON/transaction semantics, via Python's standard library.
const {spawnSync}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
function database(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sieg-address-test-')),file=path.join(dir,'test.sqlite');process.on('exit',()=>fs.rmSync(dir,{recursive:true,force:true}));const py=`import sqlite3,json,sys
p=json.load(sys.stdin)
c=sqlite3.connect(sys.argv[1]);c.row_factory=sqlite3.Row
try:
 if 'script' in p:c.executescript(p['script']);out=[]
 else:
  out=[]
  with c:
   for s in p['statements']:
    q=c.execute(s['sql'],s.get('args',[]));out.append({'results':[dict(x) for x in q.fetchall()], 'meta':{'changes':c.total_changes}})
 print(json.dumps(out))
finally:c.close()`;
function run(input){const r=spawnSync('python3',['-c',py,file],{input:JSON.stringify(input),encoding:'utf8'});if(r.status)throw Error(r.stderr);return JSON.parse(r.stdout)}
run({script:fs.readFileSync('drizzle/0000_siege_operations.sql','utf8')+'\n'+fs.readFileSync('drizzle/0002_address_capture_access.sql','utf8')});function prepare(sql){const obj={sql,args:[],bind(...args){return {...obj,args,first:async()=>run({statements:[{sql,args}]})[0].results[0]||null,all:async()=>run({statements:[{sql,args}]})[0],run:async()=>run({statements:[{sql,args}]})[0]}}};return obj.bind()}
return {prepare,batch:async statements=>run({statements:statements.map(({sql,args})=>({sql,args}))}),file};}
module.exports=database;

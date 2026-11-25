import fs from 'node:fs';import {spawnSync} from 'node:child_process';import {parse} from 'jsonc-parser';
const env=process.argv[2];if(!['staging','production'].includes(env)){console.error('Choose staging or production: npm run release:staging / npm run release:production');process.exit(1)}
const errors=[],base=parse(fs.readFileSync('wrangler.jsonc','utf8').replace(/^\uFEFF/,''),errors,{allowTrailingComma:true}),c=env==='staging'?base.env?.staging:base;
if(errors.length||!c){console.error('Invalid or missing configuration.');process.exit(1)}
if(!/^[a-f0-9]{64}$/i.test(c.vars?.CF_ACCESS_AUD||'')){console.error('Set a valid Access application AUD for '+env+'. Do not paste policy JSON.');process.exit(1)}
if(!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(c.vars?.CF_ACCESS_TEAM_DOMAIN||'')){console.error('Set the Access team domain.');process.exit(1)}
if(!c.d1_databases?.some(b=>b.binding==='DB'&&/^[a-f0-9-]{36}$/i.test(b.database_id||''))||!c.r2_buckets?.some(b=>b.binding==='BUCKET'&&b.bucket_name)){console.error('Configure the database and file storage before release.');process.exit(1)}
if(env==='staging'&&(c.d1_databases.some(b=>base.d1_databases?.some(p=>p.database_id===b.database_id))||c.r2_buckets.some(b=>base.r2_buckets?.some(p=>p.bucket_name===b.bucket_name))||c.routes?.length)){console.error('Staging must use separate storage and no production routes.');process.exit(1)}
const node=process.execPath,npm=process.env.npm_execpath;
function run(args){const r=spawnSync(node,args,{stdio:'inherit'});if(r.status!==0)process.exit(r.status??1)}
run([npm,'run','build']);run([npm,'run','check']);
run(['node_modules/wrangler/bin/wrangler.js','deploy',...(env==='staging'?['--env','staging']:[])]);

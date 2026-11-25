import fs from 'node:fs';import {parse} from 'jsonc-parser';
const filename='wrangler.jsonc',errors=[],config=parse(fs.readFileSync(filename,'utf8'),errors,{allowTrailingComma:true});if(errors.length)throw Error('Invalid configuration');
// CI settings are metadata, supplied as repository/environment variables, never credentials.
const env=process.argv[2];if(!['staging','production'].includes(env))throw Error('Choose staging or production');
const required=['CF_ACCOUNT_ID','CF_D1_DATABASE_ID','CF_ACCESS_TEAM_DOMAIN','CF_ACCESS_AUD','CF_R2_BUCKET_NAME'];for(const key of required)if(!process.env[key])throw Error('Missing deployment variable: '+key);
const account=process.env.CF_ACCOUNT_ID;
const existing=env==='staging'?config.env?.staging:config;if(!existing)throw Error('Run the configuration upgrade before setting up CI');
existing.vars={...existing.vars,CF_ACCESS_TEAM_DOMAIN:process.env.CF_ACCESS_TEAM_DOMAIN,CF_ACCESS_AUD:process.env.CF_ACCESS_AUD,SIEG_ENV:env};
existing.d1_databases=[{binding:'DB',database_name:env==='staging'?'sieg-staging':'sieg-production',database_id:process.env.CF_D1_DATABASE_ID,migrations_dir:'cloudflare/migrations'}];existing.r2_buckets=[{binding:'BUCKET',bucket_name:process.env.CF_R2_BUCKET_NAME}];config.account_id=account;
if(env==='staging'){existing.routes=[];existing.workers_dev=true;existing.vars.REPORT_CHECKOUT_ENABLED='false';existing.vars.WEEKLY_CROP_ENABLED='false'}else{existing.workers_dev=false;existing.preview_urls=false;existing.routes=[{pattern:'www.sieg.ltd',custom_domain:true}]}
fs.writeFileSync(filename,JSON.stringify(config,null,2)+'\n');console.log('CI metadata configured for '+env+'.');

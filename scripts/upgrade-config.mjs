import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {parse,printParseErrorCode} from 'jsonc-parser';
export function upgradeConfig(config){
 if(!config||!config.vars)throw Error('Your existing wrangler.jsonc must include vars.');
 const next=structuredClone(config);
 next.build={...next.build,command:'npm run build'};
 next.assets={...next.assets,directory:'cloudflare-dist/public',binding:'ASSETS',run_worker_first:true,html_handling:'none'};
 next.observability={...next.observability,enabled:true};
 next.vars.SIEG_ENV='production';
 // Do not change domains, database IDs, audience, account, fees, or feature toggles.
 next.env??={};
 if(!next.env.staging)next.env.staging={name:'sieg-beyond-the-vision-staging',routes:[],workers_dev:true,preview_urls:false,vars:{...next.vars,SIEG_ENV:'staging',REPORT_CHECKOUT_ENABLED:'false',WEEKLY_CROP_ENABLED:'false',CF_ACCESS_AUD:'REPLACE_WITH_STAGING_ACCESS_AUD'},d1_databases:[{binding:'DB',database_name:'sieg-staging',database_id:'REPLACE_WITH_STAGING_DATABASE_ID',migrations_dir:'cloudflare/migrations'}],r2_buckets:[{binding:'BUCKET',bucket_name:'sieg-staging-files'}]};
 return next;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const filename='wrangler.jsonc',errors=[],text=fs.readFileSync(filename,'utf8').replace(/^\uFEFF/,''),config=parse(text,errors,{allowTrailingComma:true});
 if(errors.length){console.error('Configuration has invalid JSON: '+printParseErrorCode(errors[0].error)+'. Fix it before updating.');process.exit(1)}
 const backup='wrangler.before-update.jsonc';if(fs.existsSync(backup)){console.error('Backup already exists: '+backup+'. Keep or rename it before running this update again.');process.exit(1)}
 const result=upgradeConfig(config);fs.copyFileSync(filename,backup,fs.constants.COPYFILE_EXCL);fs.writeFileSync(filename,JSON.stringify(result,null,2)+'\n');console.log('Configuration updated; original saved in '+backup+'. Existing production values preserved.');
}

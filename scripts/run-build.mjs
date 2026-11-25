import {spawnSync} from 'node:child_process';
const candidates=process.platform==='win32'?[['py',['-3']],['python',[]],['python3',[]]]:[['python3',[]],['python',[]]];
let chosen;
for(const [command,args] of candidates){const probe=spawnSync(command,[...args,'--version'],{encoding:'utf8',windowsHide:true});const match=(probe.stdout||'').match(/Python (\d+)\.(\d+)/);if(probe.status===0&&match&&Number(match[1])===3&&Number(match[2])>=10){chosen=[command,args];break}}
if(!chosen){console.error('Install Python 3.10 or newer, enable Add to PATH, and reopen your terminal.');process.exit(1)}
const result=spawnSync(chosen[0],[...chosen[1],'scripts/build_cloudflare.py'],{stdio:'inherit',windowsHide:true});process.exit(result.status??1);

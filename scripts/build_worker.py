"""Build the Python-generated website into one Worker ESM artifact."""
from pathlib import Path
import base64,gzip,json,mimetypes,shutil,subprocess,sys
root=Path(__file__).resolve().parent.parent
subprocess.run([sys.executable,str(root/'app.py'),'--build'],check=True,cwd=root)
out=root/'dist'
files={}
# Superseded covers/logos are retained in source, but no page references them.
unused_assets={'assets/company-folder-premium.png','assets/company-folder.png','assets/company-folder-20261030.png','assets/company-folder-sieg.png','assets/sieg-logo-white.svg','assets/sieg-logo-navy.svg'}
for p in out.rglob('*'):
 if p.is_file() and not p.relative_to(out).parts[0] in ['server','.openai'] and p.relative_to(out).as_posix() not in unused_assets and not any(part.startswith('.') for part in p.relative_to(out).parts):
  raw=p.read_bytes();packed=gzip.compress(raw,mtime=0);compressed=p.suffix.lower()!='.json' and len(packed)<len(raw)
  files[p.relative_to(out).as_posix()]=[mimetypes.guess_type(p.name)[0] or 'application/octet-stream',base64.b64encode(packed if compressed else raw).decode(),compressed]
unique=[];lookup={};paths={}
for name,value in files.items():
 key=tuple(value)
 if key not in lookup:lookup[key]=len(unique);unique.append(value)
 paths[name]=lookup[key]
source='const EMBEDDED_ASSETS='+json.dumps(unique,separators=(',',':'))+';\nconst EMBEDDED_FILES=Object.fromEntries(Object.entries('+json.dumps(paths,separators=(',',':'))+').map(([path,index])=>[path,EMBEDDED_ASSETS[index]]));\n'+(root/'worker/hydrology-commerce.js').read_text()+'\n'+(root/'worker/usage.js').read_text()+'\n'+(root/'worker/earth-engine.js').read_text()+'\n'+(root/'worker/reports.js').read_text()+'\n'+'const estateQRCode=(()=>{\n'+(root/'geocoding/vendor/qrcode.js').read_text()+'\nreturn qrcode;})();\n'+'const SIEGServerPDF=(()=>{const module={exports:{}},exports=module.exports;\n'+(root/'education/vendor/jspdf.umd.min.js').read_text()+'\nreturn module.exports.jsPDF;})();\n'+(root/'worker/report-pdf.js').read_text()+'\n'+(root/'worker/estate-location.js').read_text()+'\n'+(root/'worker/expert-availability.js').read_text()+'\n'+(root/'worker/admin-analytics.js').read_text().replace('export {analyticsTrack};','')+'\n'+(root/'worker/candidates.js').read_text()+'\n'+(root/'worker/operations.js').read_text()+'\n'+(root/'worker/graduates.js').read_text()+'\n'+(root/'worker/learn-community.js').read_text()+'\n'+'const LEARN_ENGLISH_PACK='+json.dumps((root/'worker/learn-pack.html').read_text())+';\n'+(root/'worker/learn-pilot.js').read_text()+'\n'+(root/'worker/education.js').read_text()+'\n'+(root/'geocoding/model.js').read_text()+'\n'+(root/'worker/address-access.js').read_text()+'\n'+(root/'worker/address-business.js').read_text()+'\n'+(root/'worker/address.js').read_text()+'\n'+(root/'worker/weekly-crop.js').read_text()+'\n'+(root/'worker/place-search.js').read_text()+'\n'+'const BUSINESS_TRADE_CATALOGUE='+json.dumps(json.loads((root/'assets/expert-trades.json').read_text()),separators=(',',':'))+';\n'+(root/'worker/business-directory.js').read_text()+'\n'+(root/'worker/transit.js').read_text()+'\n'+(root/'worker/index.js').read_text()
shutil.rmtree(out);(out/'server').mkdir(parents=True);(out/'.openai').mkdir()
(out/'server/index.js').write_text(source)
if (root/'.openai/hosting.json').exists():
 shutil.copyfile(root/'.openai/hosting.json',out/'.openai/hosting.json')
shutil.copytree(root/'drizzle',out/'drizzle',dirs_exist_ok=True)
print('Built embedded website and shared resource API')

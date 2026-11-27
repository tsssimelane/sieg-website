import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('Hydrology initializes without obsolete boundary-upload call',()=>{
 const s=fs.readFileSync('hydrology/assets/adapter.js','utf8');
 assert.doesNotMatch(s,/mountBoundaryUpload\s*\(/);
 assert.match(s,/function mountWorkspace\(\)/);
 assert.match(s,/engineLoaded\(\);selectModule\(selected\);map\.invalidateSize\(\)/);
});

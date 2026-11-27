import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../hydrology/assets/delineation-core.js';
const {normalizeWindow,normalizeCatchment,gridWindow}=globalThis.SiegDelineation;
test('local and repeated-world views resolve to the same bounded window',()=>{
 const local=normalizeWindow([31,-27,31.2,-26.8],[31.1,-26.9],'03');
 const wrapped=normalizeWindow([391,-27,391.2,-26.8],[31.1,-26.9],'03');
 assert.ok(local.extent.every((v,i)=>Math.abs(v-wrapped.extent[i])<1e-9));
 assert.equal(local.adjusted,false);
});
test('world view uses bounded native-cell window without false dateline truncation',()=>{
 const x=normalizeWindow([-250,-85,250,85],[31,-26],'03');
 assert.equal(x.adjusted,true);assert.equal(x.seam,false);
 const g=gridWindow(x.extent,[1/1200,0,-180,0,-1/1200,85]);
 assert.ok(g.width*g.height<=160000);
});
test('actual dateline window is explicitly limited',()=>{
 const x=normalizeWindow([179,-18,181,-16],[179.99,-17],'03');
 assert.equal(x.seam,true);assert.equal(x.extent[2],180);
});
test('wrap selected catchment without changing its shape; reject unsplit crossing',()=>{
 const poly={type:'Polygon',coordinates:[[[391,-27],[392,-27],[392,-26],[391,-27]]]};
 assert.deepEqual(normalizeCatchment(poly).coordinates,[[[31,-27],[32,-27],[32,-26],[31,-27]]]);
 assert.throws(()=>normalizeCatchment({type:'Polygon',coordinates:[[[179,0],[-179,0],[-179,1],[179,0]]]}),/dateline-split/);
 const split={type:'MultiPolygon',coordinates:[[[[180,0],[179,0],[179,1],[180,0]]],[[[-180,0],[-179,0],[-179,1],[-180,0]]]]};
 assert.deepEqual(normalizeCatchment(split),split);
});

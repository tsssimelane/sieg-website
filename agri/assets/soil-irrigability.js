/* Texture-only irrigation management screen; not a certified irrigability class. */
(function(root){'use strict';
const values=[1,2,3,4,5,6,7,8,9,10,11,12],classes=[1,1,1,1,1,2,2,2,2,2,3,3];
const palette=['B97745','218B8C','D6B75D'],labels=['Fine texture: check infiltration and drainage','Medium texture: check application rate','Coarse texture: check storage and deep drainage'];
const source='SIEG texture-only irrigation management screening · OpenLandMap USDA texture v02, surface b0, 250 m. Classes 1–5: fine; 6–10: medium; 11–12: coarse. Not an official irrigability rating. Verify infiltration, soil depth, drainage, salinity, slope and water supply before design. Missing source pixels remain unclassified.';
function image(ee,geometry){return ee.Image('OpenLandMap/SOL/SOL_TEXTURE-CLASS_USDA-TT_M/v02').select('b0').remap(values,classes).rename('irrigation_texture').clip(geometry);}
root.SiegSoilIrrigability={image,palette,labels,source};
})(typeof window==='undefined'?globalThis:window);

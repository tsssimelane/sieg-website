import {joinRaster,rasterGrid} from './raster-join-core.js';
import {definition} from './coordinate-crs.js';
import {readReferenceShapefile} from './reference-shapefile.js';

export async function rasterJoin({raster,vector,band,field,statistic}){
 if(!/\.tiff?$/i.test(raster.name)||raster.size>60*1024*1024)throw Error('Choose a GeoTIFF up to 60 MB.');
 if(vector.size>15*1024*1024)throw Error('Choose a vector file up to 15 MB.');
 const [lib,input]=await Promise.all([
  import('../assets/vendor/geotiff-2.1.4-beta.0.js'),
  /\.zip$/i.test(vector.name)?vector.arrayBuffer().then(readReferenceShapefile):vector.text().then(JSON.parse)
 ]);
 const crs=input?.crs?.properties?.name;
 if(crs&&!/(^|:)(4326|CRS84)$/i.test(crs))throw Error('Export the vector GeoJSON in WGS 84, or use a zipped shapefile.');
 const tiff=await (lib.default||globalThis.GeoTIFF).fromArrayBuffer(await raster.arrayBuffer());
 const image=await tiff.getImage(),width=image.getWidth(),height=image.getHeight(),bands=image.getSamplesPerPixel();
 if(width<1||height<1||width*height>12000000)throw Error('Use a raster with up to 12 million cells. Clip or resample larger rasters first.');
 if(width*height*bands>36000000)throw Error('This multiband raster is too large. Export the band you want as a single-band GeoTIFF.');
 if(!Number.isInteger(band)||band<1||band>bands)throw Error('This raster has '+bands+' band(s). Choose a band from 1 to '+bands+'.');
 const keys=image.getGeoKeys(),code=String(keys.ProjectedCSTypeGeoKey||keys.GeographicTypeGeoKey||'');
 let target;
 try{target=definition(code);}catch{throw Error('Unsupported or missing raster EPSG code. Export the GeoTIFF in WGS 84, Web Mercator, or WGS 84 UTM.');}
 const projection=await import('../assets/vendor/shp-6.1.0.js?v=coordinate-crs');
 const project=(projection.default?.project||globalThis.SiegCoordinateProjection)('EPSG:4326',target);
 const grid=rasterGrid(image.getFileDirectory(),keys.GTRasterTypeGeoKey===2);
 const values=(await image.readRasters({samples:[band-1]}))[0],raw=image.getGDALNoData();
 const nodata=values instanceof Float32Array&&raw!=null?Math.fround(raw):raw;
 return joinRaster(input,{width,height,values,nodata,project:(x,y)=>project.forward([x,y]),grid,field,statistic});
}
self.onmessage=async({data})=>{
 try{self.postMessage(await rasterJoin(data));}
 catch(error){self.postMessage({error:error.message||'Could not match the raster and vector.'});}
};

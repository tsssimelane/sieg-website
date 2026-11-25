"""Generate small, synthetic WGS84 shapefile fixtures for upload tests."""
import struct,zipfile
from pathlib import Path
pts=[(31.,-26.),(31.001,-26.),(31.001,-25.999),(31.,-25.999),(31.,-26.)]
body=struct.pack('<i4d3i',5,31,-26,31.001,-25.999,1,5,0)+b''.join(struct.pack('<2d',*p) for p in pts)
header=struct.pack('>7i',9994,0,0,0,0,0,(108+len(body))//2)+struct.pack('<2i8d',1000,5,31,-26,31.001,-25.999,0,0,0,0)
prj='GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]]'
for name,referenced in [('referenced',True),('missing-reference',False)]:
 with zipfile.ZipFile('/tmp/aoi-'+name+'.zip','w',zipfile.ZIP_DEFLATED) as z:
  z.writestr('field.shp',header+struct.pack('>2i',1,len(body)//2)+body)
  if referenced:z.writestr('field.prj',prj)

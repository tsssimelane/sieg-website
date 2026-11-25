"""Convert geoBoundaries CGAZ ADM0 GeoJSON to compact directory-map paths.

Source: https://www.geoboundaries.org/globalDownloads.html (CC BY 4.0).
The published CGAZ GeoJSON places each feature on its own line.
"""
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
codes = {c['iso3']: c['code'] for c in json.loads((root/'agri/assets/countries.json').read_text())}


def simplify(ring):
    # Screen-scale radial simplification, followed by coordinate rounding.
    points = []
    for lon, lat, *_ in ring[:-1]:
        point = (round(360+2*lon, 1), round(170-2*lat, 1))
        if not points or (point[0]-points[-1][0])**2+(point[1]-points[-1][1])**2 >= .25:
            points.append(point)
    return points if len(points) >= 3 else []


def area(ring):
    return abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(ring,ring[1:]+ring[:1])))/2


def marker(ring):
    y = (min(p[1] for p in ring)+max(p[1] for p in ring))/2
    xs = sorted(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1])
                for a,b in zip(ring,ring[1:]+ring[:1]) if (a[1]>y)!=(b[1]>y))
    if len(xs) < 2:
        return ring[0]
    left,right = max(zip(xs[::2],xs[1::2]),key=lambda pair:pair[1]-pair[0])
    return round((left+right)/2,1),round(y,1)


records={}
with open(sys.argv[1],encoding='utf-8') as source:
    for line in source:
        if not line.lstrip().startswith('{ "type": "Feature"'):
            continue
        f=json.loads(line.strip().rstrip(','))
        iso=f['properties']['shapeGroup']
        if iso=='ATA':
            continue
        code=codes.get(iso,iso)
        g=f['geometry']
        polygons=[g['coordinates']] if g['type']=='Polygon' else g['coordinates']
        paths=[]
        best=(0,None)
        for polygon in polygons:
            for index,ring in enumerate(polygon):
                pts=simplify(ring)
                if not pts:
                    if index==0:
                        break
                    continue
                a=area(pts)
                if index==0 and a>best[0]:
                    best=(a,pts)
                paths.append('M'+' '.join(f'{x:g},{y:g}' for x,y in pts)+'Z')
        if not best[1]:
            lon,lat,*_=polygons[0][0][0]
            point=(round(360+2*lon,1),round(170-2*lat,1))
        else:
            point=marker(best[1])
        old=records.get(code)
        if old:
            old[3]+=''.join(paths)
            if best[0]>old[4]:
                old[1:3]=point
                old[4]=best[0]
        else:
            records[code]=[code,*point,''.join(paths),best[0]]
assert len(records)>200 and 'SZ' in records and 'TW' in records
(root/'talent/world-map.json').write_text(json.dumps([r[:4] for r in records.values()],separators=(',',':'))+'\n')
print(f'Built {len(records)} geoBoundaries ADM0 map locations.')

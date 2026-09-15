"""Public-domain elevation -> unlit, georeferenced relief. No imagery/tiles.

Run with Python + rasterio/numpy/scipy/Pillow. Downloads 15 NOAA tiles into a
temporary cache (not the repository), then reads a spatial subset. The shader
uses measured slopes, not synthetic mountains. Tint is an illustrative atlas
palette, not a claim about ancient vegetation. No inferred route geography.
"""
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import urllib.request
import numpy as np
from PIL import Image, ImageDraw
import rasterio
from rasterio.windows import from_bounds
from scipy.ndimage import gaussian_filter, binary_fill_holes, distance_transform_edt

ROOT = Path(__file__).resolve().parent.parent
CACHE = Path(os.environ.get('YAHWEH_RELIEF_CACHE', '/tmp/yahweh-etopo-2022'))
CACHE.mkdir(exist_ok=True)
BASE = 'https://www.ngdc.noaa.gov/mgg/global/relief/ETOPO2022/data/15s/15s_surface_elev_gtif/'
WEST, SOUTH, EAST, NORTH = -5, 12, 50, 45
PPD = 120  # 30 arc seconds for the broad atlas; source is 15 arc seconds.
W, H = (EAST-WEST)*PPD, (NORTH-SOUTH)*PPD

def fetch(tile):
    lat, lon = tile
    name = f'ETOPO_2022_v1_15s_N{lat:02d}{"E" if lon >= 0 else "W"}{abs(lon):03d}_surface.tif'
    path = CACHE / name
    if not path.exists():
        urllib.request.urlretrieve(BASE+name, str(path)+'.part')
        Path(str(path)+'.part').replace(path)
    with rasterio.open(path) as ds:
        left, bottom, right, top = max(WEST,lon), max(SOUTH,lat-15), min(EAST,lon+15), min(NORTH,lat)
        win = from_bounds(left,bottom,right,top,ds.transform)
        data = ds.read(1,window=win,out_shape=((top-bottom)*PPD,(right-left)*PPD),resampling=rasterio.enums.Resampling.average)
        assert np.isfinite(data).all() and data.min() > -12000
    print(name, 'read', data.shape, flush=True)
    return (int((NORTH-top)*PPD),int((left-WEST)*PPD),data,{
        'url': BASE+name, 'sha256': hashlib.file_digest(path.open('rb'),'sha256').hexdigest()})

height = np.zeros((H,W),np.float32)
sources = []
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    for row,col,data,source in pool.map(fetch,[(lat,lon) for lat in (15,30,45) for lon in (-15,0,15,30,45)]):
        height[row:row+data.shape[0],col:col+data.shape[1]] = data
        sources.append(source)

# Closed sub-sea-level land depressions must NOT become invented seas.
land = binary_fill_holes(height >= 0)
# Elevation zero is not a coastline: intertidal zero cells otherwise create
# thousands of speckles. Use the project's attributed cartographic land rings.
coast_mask=Image.new('L',(W,H),0);coast_draw=ImageDraw.Draw(coast_mask)
for f in json.loads((ROOT/'public/data/ne_50m_land.geojson').read_text())['features']:
    geom=f['geometry'];polys=[geom['coordinates']] if geom['type']=='Polygon' else geom['coordinates']
    for poly in polys:
        if not any(WEST<=x<=EAST and SOUTH<=y<=NORTH for x,y,*_ in poly[0]):continue
        for i,ring in enumerate(poly):
            coast_draw.polygon([((x-WEST)*PPD,(NORTH-y)*PPD) for x,y,*_ in ring],fill=255 if i==0 else 0)
land=np.asarray(coast_mask)>0
# Vector inland waters include the Dead Sea, whose surface is below sea level.
water_mask = Image.new('L',(W,H),0)
draw = ImageDraw.Draw(water_mask)
def rings(geom):
    co=geom['coordinates']
    return co if geom['type']=='Polygon' else [r for poly in co for r in poly]
lake_path = ROOT/'public/data/ne_50m_lakes.geojson'
if lake_path.exists():
    for feature in json.loads(lake_path.read_text())['features']:
        for ring in rings(feature['geometry']):
            if any(WEST<=x<=EAST and SOUTH<=y<=NORTH for x,y,*_ in ring):
                draw.polygon([((x-WEST)*PPD,(NORTH-y)*PPD) for x,y,*_ in ring],fill=255)
lakes = np.asarray(water_mask)>0

lat = (NORTH-(np.arange(H)+.5)/PPD).astype(np.float32)[:,None]
# Slopes in metres/metre, with geographic pixel widths corrected by latitude.
dy,dx = np.gradient(gaussian_filter(height,.6))
dx /= 111320/PPD*np.cos(np.deg2rad(lat)); dy /= 111320/PPD
def shade(exaggeration):
    xx,yy=dx*exaggeration,dy*exaggeration
    return np.clip((-.62*xx-.48*yy+.62)/np.sqrt(xx*xx+yy*yy+1),0,1)
relief=shade(5.5)
macro = (height-gaussian_filter(height,18))/1800
shading=np.clip(.61+relief*.55+macro*.16,.38,1.13)
z=np.clip(height,0,4000)
low=np.array([.66,.54,.37],np.float32)
high=np.array([.60,.52,.43],np.float32)
rgb=low[None,None,:]+(high-low)[None,None,:]*np.clip(z/2600,0,1)[:,:,None]
# Northern Mediterranean climate tint is deliberately understated and labelled
# illustrative. It is not derived from present-day satellite vegetation.
green=np.clip((lat-31)/7,0,1)*np.exp(-z/2700)*.43
rgb=rgb*(1-green[:,:,None])+np.array([.34,.42,.27])*green[:,:,None]
rgb*=shading[:,:,None]
depth=np.clip(-height,0,4500)/4500
deep=np.array([.025,.14,.24]); shallow=np.array([.09,.39,.47])
sea=deep[None,None,:]+(shallow-deep)[None,None,:]*np.exp(-depth*5)[:,:,None]
sea*=np.clip(.82+relief*.24,.75,1.05)[:,:,None]
rgb=np.where(land[:,:,None],rgb,sea)
rgb[lakes]=[.045,.25,.33]
# Rivers are measured vector paths, never painted from an invented itinerary.
overlay=Image.new('RGBA',(W,H),(0,0,0,0)); riverdraw=ImageDraw.Draw(overlay)
rivers=ROOT/'public/data/ne_50m_rivers_lake_centerlines.geojson'
for f in json.loads(rivers.read_text())['features']:
    geom=f['geometry']; paths=[geom['coordinates']] if geom['type']=='LineString' else geom['coordinates']
    for path in paths:
        if any(WEST<=x<=EAST and SOUTH<=y<=NORTH for x,y,*_ in path):
            riverdraw.line([((x-WEST)*PPD,(NORTH-y)*PPD) for x,y,*_ in path],fill=(45,99,109,180),width=2)
alpha=np.ones((H,W),np.float32)
for axis,size in ((1,W),(0,H)):
    edge=np.minimum(np.arange(size),np.arange(size)[::-1])/(size*.09)
    edge=np.clip(edge,0,1); edge=edge*edge*(3-2*edge)
    alpha*=edge[None,:] if axis==1 else edge[:,None]
out=Image.fromarray(np.uint8(np.clip(rgb,0,.80)*255),'RGB').convert('RGBA')
out=Image.alpha_composite(out,overlay)
out.putalpha(Image.fromarray(np.uint8(alpha*255)))
output=ROOT/'public/data/terrain-color.webp'
out.save(output,quality=82,method=6)
assert output.stat().st_size<=3_000_000, output.stat().st_size
manifest={'source':'NOAA ETOPO 2022 v1, 15 arc-second surface elevation, CC0',
 'bounds':[WEST,SOUTH,EAST,NORTH],'width':W,'height':H,'displayArcSeconds':30,
 'shading':'NW directional, 5.5x vertical exaggeration baked into colour; unlit at runtime',
 'tint':'authored hypsometric atlas colours; not historical vegetation',
 'modernReliefCaveat':'Modern coastlines, lakes, reservoirs and channels are not a reconstruction of biblical-era geography.',
 'tiles':sources,'bytes':output.stat().st_size,'sha256':hashlib.file_digest(output.open('rb'),'sha256').hexdigest()}
(ROOT/'handoff/evidence/phase-2').mkdir(parents=True,exist_ok=True)
(ROOT/'handoff/evidence/phase-2/terrain-build.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({k:v for k,v in manifest.items() if k!='tiles'},indent=2))

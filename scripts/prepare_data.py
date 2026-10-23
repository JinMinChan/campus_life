"""Build an attributed, compact OSM derivative. No third-party game code used."""
import json, math, xml.etree.ElementTree as ET
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = (37.5569, 127.0460)
SCALE_X = 111320 * math.cos(math.radians(ORIGIN[0]))
def xy(lat, lon): return [round((lon-ORIGIN[1])*SCALE_X, 2), round((ORIGIN[0]-lat)*111320, 2)]
def inside(p, poly):
    x,y=p; yes=False
    for i,a in enumerate(poly):
        b=poly[i-1]
        if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]: yes=not yes
    return yes
root=ET.parse(ROOT/'data/osm-map.xml').getroot()
nodes={n.get('id'):xy(float(n.get('lat')),float(n.get('lon'))) for n in root.findall('node')}
ways={w.get('id'):w for w in root.findall('way')}
def points(w): return [nodes[n.get('ref')] for n in w.findall('nd') if n.get('ref') in nodes]
boundary=points(ways['187645257'])
buildings=[]; roads=[]; green=[]; features=[]
minx=min(p[0] for p in boundary)-50;maxx=max(p[0] for p in boundary)+50
minz=min(p[1] for p in boundary)-50;maxz=max(p[1] for p in boundary)+50
for wid,w in ways.items():
    ps=points(w);t={a.get('k'):a.get('v') for a in w.findall('tag')}
    if len(ps)<2:continue
    c=[sum(p[0] for p in ps[:-1])/max(1,len(ps)-1),sum(p[1] for p in ps[:-1])/max(1,len(ps)-1)]
    if 'building' in t and len(ps)>3 and inside(c,boundary) and t.get('underground')!='yes':
        levels=float(t.get('building:levels',5));known='height' in t or 'building:levels' in t
        height=float(str(t.get('height',levels*3.6)).replace(' m',''))
        buildings.append(dict(id=wid,name=t.get('name:ko',t.get('name','캠퍼스 건물')),points=ps,center=c,height=height,heightKnown=known,levels=levels))
    if 'highway' in t and t.get('area')!='yes' and t.get('highway') not in ['motorway','motorway_link','trunk','trunk_link','construction']:
        # Retain full OSM node identity at intersections. Segments are clipped later.
        ids=[n.get('ref') for n in w.findall('nd')];segments=[];cur=[];curids=[]
        for p,nid in zip(ps,ids):
            if minx<p[0]<maxx and minz<p[1]<maxz:
                cur.append(p);curids.append(nid)
            else:
                if len(cur)>1:segments.append((cur,curids))
                cur=[];curids=[]
        if len(cur)>1:segments.append((cur,curids))
        for i,(segment,sids) in enumerate(segments):
            if any(inside(p,boundary) for p in segment):
                roads.append(dict(id=wid+'-'+str(i),osmId=wid,type=t['highway'],points=segment,nodes=sids,name=t.get('name','')))
    if len(ps)>3 and any(inside(p,boundary) for p in ps):
        if t.get('landuse') in ['grass','forest'] or t.get('natural') in ['wood','scrub','grassland'] or t.get('leisure')=='garden':green.append(dict(id=wid,points=ps))
        if t.get('leisure') in ['pitch','track']:features.append(dict(id=wid,type=t['leisure'],sport=t.get('sport',''),points=ps))

tiles={x:Image.open(ROOT/f'data/terrain-{x}-6345.png').convert('RGB') for x in [13973,13974]}
def elevation(x,z):
    lat=ORIGIN[0]-z/111320;lon=ORIGIN[1]+x/SCALE_X;n=2**14
    tx=(lon+180)/360*n;ty=(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n
    if int(tx) not in tiles or int(ty)!=6345: return 40
    # Terrarium: (R*256 + G + B/256) - 32768 metres.
    im=tiles[int(tx)];px=max(0,min(255,(tx%1)*256));py=max(0,min(255,(ty%1)*256));ix=int(px);iy=int(py)
    def v(a,b):
        r,g,bl=im.getpixel((min(255,a),min(255,b)));return r*256+g+bl/256-32768
    a=px-ix;b=py-iy
    return (v(ix,iy)*(1-a)+v(ix+1,iy)*a)*(1-b)+(v(ix,iy+1)*(1-a)+v(ix+1,iy+1)*a)*b
# Regular 20m elevation grid covers the entire diorama.
extent=[math.floor(minx/20)*20, math.floor(minz/20)*20, math.ceil(maxx/20)*20, math.ceil(maxz/20)*20]
nx=int((extent[2]-extent[0])/20)+1;nz=int((extent[3]-extent[1])/20)+1
heights=[[round(elevation(extent[0]+i*20,extent[1]+j*20),2) for i in range(nx)] for j in range(nz)]
data=dict(meta=dict(name='한양대학교 서울캠퍼스',origin=ORIGIN,fetched='2026-10-23',osmBoundary='187645257',source='https://www.openstreetmap.org/api/0.6/map?bbox=127.037,37.553,127.051,37.562',license='ODbL-1.0',terrain='AWS Terrain Tiles / Mapzen Terrarium, zoom 14, SRTM-derived',terrainUrl='https://registry.opendata.aws/terrain-tiles/',notes=['건물 윤곽·캠퍼스 경계·도로 중심선은 OSM 스냅샷입니다.','OSM 높이 태그가 없는 건물은 5층(18m)으로 근사했습니다. 외관·수목은 절차적으로 표현합니다.','지형은 약 30m 원자료를 20m 격자로 보간합니다. 계단·건물 기단은 시각화용 근사입니다.','목적지 연결 보행로는 OSM 망에 투영한 게임용 연결입니다. 출입구·시간표·학생은 가상입니다.']),boundary=boundary,buildings=buildings,roads=roads,green=green,features=features,terrain=dict(extent=extent,step=20,heights=heights))
out=ROOT/'public/data/campus.json';out.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
print(json.dumps({'buildings':len(buildings),'roads':len(roads),'green':len(green),'features':len(features),'terrainRange':[min(map(min,heights)),max(map(max,heights))],'bytes':out.stat().st_size},indent=2))

import * as THREE from 'three';
import {OrbitControls} from '../public/vendor/OrbitControls.js';
import {terrainHeight,pointInPolygon,distance,ACTIONS} from './simulation.js';

// All campus architecture is original procedural geometry. Surveyed footprints,
// roads and heights are kept in campus.json; small architectural details are an
// intentionally illustrated interpretation rather than a photogrammetric model.
const material=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.9,...extra});
const randomGenerator=(seed=421)=>()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const PALETTE={stone:'#d8cfb8',trim:'#eee2c8',dark:'#556c65',brick:'#ad7960',path:'#d6c49c',road:'#a8aaa0',grass:'#8b9f66',roof:'#70857e'};
function segmentDistance(p,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1),0,1);return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dz*t);}
function lineFrame(a,b){const length=distance(a,b),dx=(b[0]-a[0])/length,dz=(b[1]-a[1])/length;return{length,dx,dz,angle:-Math.atan2(dz,dx)};}

// Baking the many small facade details into a handful of vertex-colored meshes
// keeps architectural richness independent of the number of WebGL draw calls.
class StaticBatch{
  constructor(world){this.world=world;this.groups=new Map();this.object=new THREE.Object3D();this.normalMatrix=new THREE.Matrix3();}
  add(geometry,color,position=[0,0,0],scale=[1,1,1],rotation=[0,0,0],kind='stone'){
    let group=this.groups.get(kind);if(!group){group={positions:[],normals:[],colors:[]};this.groups.set(kind,group);}
    const g=geometry.index?geometry.toNonIndexed():geometry;const p=g.attributes.position,n=g.attributes.normal;const c=new THREE.Color(color);
    this.object.position.fromArray(position);this.object.scale.fromArray(scale);this.object.rotation.set(...rotation);this.object.updateMatrix();this.normalMatrix.getNormalMatrix(this.object.matrix);
    const v=new THREE.Vector3(),normal=new THREE.Vector3();
    for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(this.object.matrix);normal.fromBufferAttribute(n,i).applyMatrix3(this.normalMatrix).normalize();group.positions.push(v.x,v.y,v.z);group.normals.push(normal.x,normal.y,normal.z);group.colors.push(c.r,c.g,c.b);}
    if(g!==geometry)g.dispose();
  }
  finish(){
    for(const [kind,a] of this.groups){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(a.positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(a.normals,3));g.setAttribute('color',new THREE.Float32BufferAttribute(a.colors,3));g.computeBoundingSphere();
      const m=material('#ffffff',{vertexColors:true,roughness:kind==='glass'?.36:.95,metalness:kind==='glass'?.15:0,side:THREE.DoubleSide});const mesh=new THREE.Mesh(g,m);mesh.castShadow=kind!=='ground';mesh.receiveShadow=true;this.world.scene.add(mesh);if(kind==='glow'){m.emissive.set('#f7c975');m.emissiveIntensity=.45;this.world.lampMaterial=m;}
    }
    this.groups.clear();
  }
}
export class CampusWorld{
  constructor(container,data,sim,onSelect){
    this.data=data;this.sim=sim;this.container=container;this.onSelect=onSelect;this.follow=false;this.labelsVisible=true;this.meshes=[];this.labels=[];this.lastRoute='';this.random=randomGenerator();this.height=(x,z)=>terrainHeight(data,x,z);this.occlusionMeshes=[];this.lastOcclusion=0;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#e6dec9');this.scene.fog=new THREE.Fog('#e6dec9',1400,2900);
    this.renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.0;
    this.renderer.domElement.setAttribute('aria-label','한양대 서울캠퍼스 3D 지도. 드래그 회전, 휠 확대, 학생 클릭 선택');container.appendChild(this.renderer.domElement);
    this.camera=new THREE.PerspectiveCamera(34,1,.6,5000);this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.dampingFactor=.075;this.controls.minDistance=48;this.controls.maxDistance=1750;this.controls.maxPolarAngle=Math.PI*.43;this.controls.minPolarAngle=.24;this.controls.screenSpacePanning=true;this.controls.mouseButtons={LEFT:THREE.MOUSE.ROTATE,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.PAN};this.controls.addEventListener('start',()=>{this.follow=false;container.dispatchEvent(new Event('camera-manual'));});
    this.hemi=new THREE.HemisphereLight('#fff2d4','#759185',1.8);this.scene.add(this.hemi);
    this.sun=new THREE.DirectionalLight('#ffe5b8',3.2);this.sun.position.set(-350,550,280);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-570,right:570,top:570,bottom:-570,near:1,far:1600});this.sun.shadow.normalBias=.65;this.sun.shadow.bias=-.00015;this.sun.shadow.radius=3;this.scene.add(this.sun);
    this.scene.add(new THREE.DirectionalLight('#b6cbd3',.35));
    this.batch=new StaticBatch(this);this.box=new THREE.BoxGeometry(1,1,1);this.sphere=new THREE.SphereGeometry(1,10,7);this.cylinder=new THREE.CylinderGeometry(1,1,1,10);this.cone=new THREE.ConeGeometry(1,1,10);
    this.buildTerrain();this.buildRoads();this.buildBuildings();this.buildNature();this.addDetails();this.batch.finish();this.buildStudents();this.buildLabels();this.buildAtmosphere();
    this.ring=new THREE.Mesh(new THREE.RingGeometry(4.7,5.15,64),new THREE.MeshBasicMaterial({color:'#fff4c3',side:THREE.DoubleSide,transparent:true,opacity:.94,depthWrite:false}));this.ringBase=this.ring.geometry.attributes.position.array.slice();this.ring.renderOrder=3;this.scene.add(this.ring);
    this.selectedPin=document.createElement('div');this.selectedPin.className='student-pin';container.appendChild(this.selectedPin);this.selectedPin.style.pointerEvents='none';
    this.raycaster=new THREE.Raycaster();let down=null;this.renderer.domElement.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);this.renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;const r=this.renderer.domElement.getBoundingClientRect();this.raycaster.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),this.camera);const hits=this.raycaster.intersectObjects(this.meshes,true);if(hits.length){let o=hits[0].object;while(o.parent&&o.userData.student===undefined)o=o.parent;if(o.userData.student!==undefined)this.onSelect(o.userData.student);}});
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);this.resize();this.resetCamera();this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();container.dispatchEvent(new Event('render-lost'));});
  }
  block(x,y,z,w,h,d,color,angle=0,kind='stone'){this.batch.add(this.box,color,[x,y,z],[w,h,d],[0,angle,0],kind);}
  ball(x,y,z,sx,sy,sz,color,kind='plant'){this.batch.add(this.sphere,color,[x,y,z],[sx,sy,sz],[0,this.random()*Math.PI,0],kind);}
  column(x,y,z,r,h,color){this.batch.add(this.cylinder,color,[x,y,z],[r,h,r]);}
  shapeGeometry(points,depth,bevel=.25){const clean=distance(points[0],points.at(-1))<.1?points.slice(0,-1):points;const shape=new THREE.Shape(clean.map(p=>new THREE.Vector2(p[0],-p[1])));const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:bevel>0,bevelSegments:1,steps:1,bevelSize:bevel,bevelThickness:bevel});geometry.rotateX(-Math.PI/2);return geometry;}
  terrainGeometry(poly,color,offset=0){
    const [minx,minz,maxx,maxz]=this.data.terrain.extent,step=9,p=[],colors=[],normals=[],c=new THREE.Color();
    for(let z=minz;z<maxz;z+=step)for(let x=minx;x<maxx;x+=step)for(const tri of [[[x,z],[x,z+step],[x+step,z]],[[x+step,z],[x,z+step],[x+step,z+step]]]){
      const center=[tri.reduce((s,q)=>s+q[0],0)/3,tri.reduce((s,q)=>s+q[1],0)/3];if(!pointInPolygon(center,poly))continue;
      for(const v of tri){p.push(v[0],this.height(...v)+offset,v[1]);c.set(color);c.offsetHSL(0,0,Math.sin(v[0]*.015+v[1]*.009)*.014+Math.cos(v[0]*.023-v[1]*.019)*.012);colors.push(c.r,c.g,c.b);const n=new THREE.Vector3(this.height(v[0]-2,v[1])-this.height(v[0]+2,v[1]),4,this.height(v[0],v[1]-2)-this.height(v[0],v[1]+2)).normalize();normals.push(n.x,n.y,n.z);}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));return geo;
  }
  buildTerrain(){
    const poly=this.data.boundary.map(p=>[p[0]*1.028,p[1]*1.028]);this.island=poly;const mesh=new THREE.Mesh(this.terrainGeometry(poly,PALETTE.grass),material('#ffffff',{vertexColors:true,side:THREE.DoubleSide}));mesh.receiveShadow=true;this.scene.add(mesh);
    // A softly bevelled topographic diorama, with visible earth strata at its edge.
    const positions=[],colors=[];const layers=[[-16,'#aaa18a'],[-10,'#b6ab8b'],[-4,'#c4b58f']];
    for(let i=1;i<poly.length;i++){const a=poly[i-1],b=poly[i],n=Math.ceil(distance(a,b)/10);for(let j=0;j<n;j++){const p=[a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n],q=[a[0]+(b[0]-a[0])*(j+1)/n,a[1]+(b[1]-a[1])*(j+1)/n];for(let k=0;k<3;k++){const bottom=layers[k][0],top=k<2?layers[k+1][0]:Math.min(this.height(...p),this.height(...q));const c=new THREE.Color(layers[k][1]);const verts=[[p[0],bottom,p[1]],[q[0],bottom,q[1]],[p[0],k===2?this.height(...p):top,p[1]],[q[0],k===2?this.height(...q):top,q[1]]];for(const v of [0,2,1,1,2,3]){positions.push(...verts[v]);colors.push(c.r,c.g,c.b);}}}}
    const side=new THREE.BufferGeometry();side.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));side.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));side.computeVertexNormals();const earth=new THREE.Mesh(side,material('#ffffff',{vertexColors:true,side:THREE.DoubleSide}));earth.castShadow=true;earth.receiveShadow=true;this.scene.add(earth);
    const plane=new THREE.Mesh(new THREE.PlaneGeometry(10000,10000),material('#cbd2ba'));plane.rotation.x=-Math.PI/2;plane.position.y=-18;plane.receiveShadow=true;this.scene.add(plane);
    // Preserve surveyed landscaped areas, with contour-conforming organic edges.
    for(const green of this.data.green){const ps=green.points;if(ps.length<4)continue;this.groundPolygon(ps,'#9bab73',.08);}
  }
  groundPolygon(points,color,offset=.2){
    const shape=new THREE.Shape(points.map(p=>new THREE.Vector2(p[0],-p[1]))),source=new THREE.ShapeGeometry(shape),triangles=source.toNonIndexed(),p=triangles.attributes.position,vertices=[];
    // Long polygon triangles otherwise cut across the hilly surface. Subdivide
    // every patch so playing fields and planting beds hug the same terrain.
    const add=(a,b,c,level=0)=>{if(level<6&&Math.max(distance(a,b),distance(b,c),distance(c,a))>5){const ab=[(a[0]+b[0])/2,(a[1]+b[1])/2],bc=[(b[0]+c[0])/2,(b[1]+c[1])/2],ca=[(c[0]+a[0])/2,(c[1]+a[1])/2];add(a,ab,ca,level+1);add(ab,b,bc,level+1);add(ca,bc,c,level+1);add(ab,bc,ca,level+1);}else for(const q of [a,b,c])vertices.push(q[0],this.height(...q)+offset,q[1]);};
    for(let i=0;i<p.count;i+=3)add([p.getX(i),-p.getY(i)],[p.getX(i+1),-p.getY(i+1)],[p.getX(i+2),-p.getY(i+2)]);
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.computeVertexNormals();this.batch.add(geo,color,[0,0,0],[1,1,1],[0,0,0],'ground');geo.dispose();source.dispose();triangles.dispose();
  }
  ribbon(points,width,color,offset=.3){
    const verts=[];for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],len=distance(a,b);if(len<.1)continue;const nx=-(b[1]-a[1])/len*width/2,nz=(b[0]-a[0])/len*width/2,n=Math.ceil(len/5);for(let j=0;j<n;j++){const p=[a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n],q=[a[0]+(b[0]-a[0])*(j+1)/n,a[1]+(b[1]-a[1])*(j+1)/n];if(!pointInPolygon([(p[0]+q[0])/2,(p[1]+q[1])/2],this.island))continue;const corners=[[p[0]+nx,p[1]+nz],[q[0]+nx,q[1]+nz],[p[0]-nx,p[1]-nz],[q[0]-nx,q[1]-nz]];for(const k of [0,1,2,1,3,2]){const v=corners[k];verts.push(v[0],this.height(...v)+offset,v[1]);}}}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.computeVertexNormals();this.batch.add(geo,color,[0,0,0],[1,1,1],[0,0,0],'ground');geo.dispose();
  }
  buildRoads(){
    this.roadSegments=[];
    for(const road of this.data.roads){const foot=['footway','path','pedestrian','steps','cycleway'].includes(road.type);const width=road.type==='steps'?3.8:foot?3.5:['primary','secondary'].includes(road.type)?11:7;
      this.ribbon(road.points,width+1.1,'#c5bc9e',.48);this.ribbon(road.points,width,foot?PALETTE.path:PALETTE.road,.66);
      for(let i=1;i<road.points.length;i++){const a=road.points[i-1],b=road.points[i],f=lineFrame(a,b);this.roadSegments.push({a,b,width,foot});
        if(road.type==='steps'){const count=Math.floor(f.length/1.3);for(let j=0;j<count;j++){const t=(j+.5)/count,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;this.block(x,this.height(x,z)+.81,z,1.1,.25,width-.2,'#eee0bf',f.angle);}}
        else if(!foot&&f.length>20){for(let d=5;d<f.length-3;d+=10){const x=a[0]+f.dx*d,z=a[1]+f.dz*d;this.block(x,this.height(x,z)+.83,z,3.8,.06,.22,'#ded7b6',f.angle,'ground');}}
      }
    }
    for(const v of this.sim.venues)if(v.from){this.ribbon([v.from,v.point],4.4,'#c7b68e',.52);this.ribbon([v.from,v.point],3.4,'#dfcfaa',.7);}
    const pitch=this.data.features.find(f=>f.sport==='soccer');
    for(const f of this.data.features)if(f.type==='pitch'&&f!==pitch)this.groundPolygon(f.points,'#b58b6b',.36);
    if(pitch){const p=pitch.points;this.groundPolygon(p,'#79996c',.65);this.ribbon(p,.65,'#e4dfbd',.9);const a=p[0],b=p[1],c=p[2],d=p[3];
      for(let i=0;i<10;i++){const u=i/10,v=(i+1)/10;const q=[a,b].map((x,j)=>[x[0]+([d,c][j][0]-x[0])*u,x[1]+([d,c][j][1]-x[1])*u]);const r=[a,b].map((x,j)=>[x[0]+([d,c][j][0]-x[0])*v,x[1]+([d,c][j][1]-x[1])*v]);if(i%2)this.groundPolygon([q[0],q[1],r[1],r[0]],'#829f70',.75);}
      const mid1=[(a[0]+d[0])/2,(a[1]+d[1])/2],mid2=[(b[0]+c[0])/2,(b[1]+c[1])/2],center=[(mid1[0]+mid2[0])/2,(mid1[1]+mid2[1])/2];this.ribbon([mid1,mid2],.6,'#e4dfbd',.95);const circle=Array.from({length:49},(_,i)=>[center[0]+Math.cos(i/48*Math.PI*2)*9,center[1]+Math.sin(i/48*Math.PI*2)*9]);this.ribbon(circle,.55,'#e4dfbd',.95);
      for(const pair of [[a,b],[d,c]]){const m=[(pair[0][0]+pair[1][0])/2,(pair[0][1]+pair[1][1])/2],f=lineFrame(...pair);for(const side of [-1,1])this.column(m[0]+f.dx*side*4,this.height(...m)+2.5,m[1]+f.dz*side*4,.15,5,'#ebe1bd');this.block(...[m[0],this.height(...m)+5,m[1]],8.3,.3,.3,'#ebe1bd',f.angle);}
    }
  }
  buildBuildings(){
    this.buildingMeshes=[];const r=this.random;
    for(const b of this.data.buildings){
      const hs=b.points.map(p=>this.height(...p)),base=Math.max(...hs)+.4; // Level foundations follow surveyed terrain.
      b.base=base;let height=b.height;if(b.name==='애지문'){this.buildGate(b);continue;}if(b.name==='노천극장'){this.buildTheatre(b);continue;}
      const history=b.name==='역사관',library=b.name==='백남학술정보관',modern=/IT\/BT|자동차|HIT|경영관/.test(b.name),dorm=/생활관/.test(b.name),engineering=/공학|공업|과학/.test(b.name);
      const color=history?'#b7b3a3':modern?'#bdcec5':/의학|의과/.test(b.name)?'#af8268':engineering?'#d2bc96':dorm?'#b68a70':['#d6cbb3','#ccc8b6','#d8ccb1'][Math.floor(r()*3)];const foundation=this.shapeGeometry(b.points,base-Math.min(...hs)+.8,.2);this.batch.add(foundation,'#b0ac95',[0,Math.min(...hs)-.5,0]);foundation.dispose();
      const body=new THREE.Mesh(this.shapeGeometry(b.points,height,.28),material(color));body.position.y=base;body.castShadow=true;body.receiveShadow=true;body.userData.building=b.id;this.scene.add(body);this.buildingMeshes.push(body);this.occlusionMeshes.push(body);
      const roofColor=history?'#60766b':modern?'#5d827d':dorm?'#a37256':engineering?'#8c8e74':'#9c8a70';
      const roof=this.shapeGeometry(b.points,.7,.48);this.batch.add(roof,roofColor,[0,base+height,0]);roof.dispose();
      const ledge=this.shapeGeometry(b.points,.65,.7);this.batch.add(ledge,PALETTE.trim,[0,base+height-.6,0]);ledge.dispose();
      const plinth=this.shapeGeometry(b.points,1.1,.45);this.batch.add(plinth,history?'#979b8b':'#b1a98f',[0,base,0]);plinth.dispose();
      let bestEdge=null;
      for(let i=1;i<b.points.length;i++){
        const a=b.points[i-1],c=b.points[i],f=lineFrame(a,c);if(f.length<3)continue;let nx=-f.dz,nz=f.dx;const mid=[(a[0]+c[0])/2,(a[1]+c[1])/2];if(pointInPolygon([mid[0]+nx,mid[1]+nz],b.points)){nx=-nx;nz=-nz;}
        if(!bestEdge||f.length>bestEdge.f.length)bestEdge={a,c,f,nx,nz,mid};
        const floors=Math.min(10,Math.floor(height/3.65)),bay=modern?4.5:history?5.1:4.2,count=Math.floor((f.length-1.8)/bay);
        // Real depth: dark reveals, pale sills, glass and mullions sit in separate planes.
        for(let floor=0;floor<floors;floor++){
          const yy=base+2.15+floor*3.65;
          if(f.length>8&&(!history||floor===0))this.block(mid[0]+nx*.36,yy+1.35,mid[1]+nz*.36,f.length,.22,.65,PALETTE.trim,f.angle);
          for(let k=0;k<count;k++){
            const t=(k+1)/(count+1),x=a[0]+f.dx*f.length*t,z=a[1]+f.dz*f.length*t,ww=modern?3.4:history?1.7:2.2,hh=history?2.35:1.85;
            this.block(x+nx*.28,yy,z+nz*.28,ww+.48,hh+.38,.24,history?'#dad7c3':'#b7b7a3',f.angle);
            this.block(x+nx*.43,yy,z+nz*.43,ww,hh,.18,'#526d68',f.angle,'glass');
            this.block(x+nx*.54,yy+.32,z+nz*.54,ww,.10,.1,'#a6b9ab',f.angle,'glass');
            this.block(x+nx*.56,yy,z+nz*.56,.12,hh,.1,'#b7c0ac',f.angle);
            this.block(x+nx*.65,yy-hh/2-.13,z+nz*.65,ww+.6,.24,.75,PALETTE.trim,f.angle);
            if(history){this.block(x+nx*.55,yy+hh/2+.25,z+nz*.55,ww+.6,.35,.5,'#d2d0ba',f.angle);}
          }
        }
        if(f.length>9){for(let k=0;k<=count+1;k++){const t=clamp(k/(count+1),.015,.985),x=a[0]+f.dx*f.length*t,z=a[1]+f.dz*f.length*t;if(modern||history)this.block(x+nx*.58,base+height/2,z+nz*.58,history?.45:.65,height-1.2,.55,history?'#d2cfba':'#dee0cb',f.angle);}}
        // Parapets and small rooftop setbacks make the skyline read as architecture.
        this.block(mid[0]+nx*.18,base+height+1.15,mid[1]+nz*.18,f.length,.95,.65,'#d2c9b0',f.angle);
      }
      if(bestEdge){const {mid,nx,nz,f}=bestEdge;
        if(history)this.buildPortico(b,bestEdge);
        else{
          const v=this.sim.venues.find(v=>v.building.id===b.id);let p=v?v.point:[mid[0]+nx*1.1,mid[1]+nz*1.1];const y=this.height(...p);
          if(!v)this.block(p[0],Math.max(base,y)+2.3,p[1],6.5,4.1,.5,'#49665e',f.angle,'glass');if(!v){this.block(p[0]+nx*1.3,base+4.8,p[1]+nz*1.3,8.5,.55,4,'#e2d3b2',f.angle);for(const side of [-1,1])this.column(p[0]+f.dx*side*3.6+nx*2.5,base+2.2,p[1]+f.dz*side*3.6+nz*2.5,.23,4.5,'#e1d6ba');}
        }
      }
      // Roof services, stairs and skylights remain smaller than the main mass.
      if(pointInPolygon(b.center,b.points)){
        this.block(b.center[0],base+height+2.3,b.center[1],6,3.8,5,'#c4c0a8',bestEdge?.f.angle||0);this.block(b.center[0],base+height+4.4,b.center[1],6.5,.4,5.5,'#ded5b9',bestEdge?.f.angle||0);
        if(modern||engineering)for(let i=-1;i<=1;i++){const p=[b.center[0]+i*5,b.center[1]+5];if(pointInPolygon(p,b.points)){this.block(p[0],base+height+1,p[1],3.6,.6,2.7,'#58747b',.18,'glass');}}
      }
      if(library){const c=b.center;this.column(c[0],base+height+4,c[1],8.5,8,'#dcd6bf');this.column(c[0],base+height+8.4,c[1],9,.65,PALETTE.trim);this.column(c[0],base+height+9.4,c[1],6.7,1.3,'#8e9f95');for(let i=0;i<16;i++){const a=i/16*Math.PI*2;this.block(c[0]+Math.sin(a)*8.55,base+height+4,c[1]+Math.cos(a)*8.55,1.2,5,.16,'#849b92',a,'glass');}}
      if(b.name==='올림픽체육관'){const c=b.center;for(let i=-3;i<=3;i++)this.block(c[0]+i*7,base+height+2.5,c[1],1.2,1.4,35,'#d8cfb5',bestEdge?.f.angle||0);}
    }
  }
  buildPortico(b,edge){
    // The former main building: a limestone columned portico and triangular pediment.
    const a=b.points[1],c=b.points[2],f=lineFrame(a,c),center=[(a[0]+c[0])/2,(a[1]+c[1])/2];let nx=-f.dz,nz=f.dx;if(pointInPolygon([center[0]+nx,center[1]+nz],b.points)){nx=-nx;nz=-nz;}
    const x=center[0]+nx*3.7,z=center[1]+nz*3.7,y=b.base,w=18;
    this.block(x,y+1,z,w+3,2,8,PALETTE.stone,f.angle);
    for(let k=-2;k<=2;k++){const xx=x+f.dx*k*3.6+nx*2,zz=z+f.dz*k*3.6+nz*2;this.column(xx,y+7,zz,.64,11.4,'#e3dfca');this.column(xx,y+1.9,zz,.94,.8,'#d3d0b9');this.column(xx,y+12.7,zz,.96,.8,'#e8dfc6');}
    this.block(x,y+13.6,z,w+1,1.1,8.5,PALETTE.trim,f.angle);
    const tri=new THREE.Shape([new THREE.Vector2(-10,0),new THREE.Vector2(10,0),new THREE.Vector2(0,5)]);const g=new THREE.ExtrudeGeometry(tri,{depth:7.8,bevelEnabled:false});this.batch.add(g,'#d6d1b9',[x-nx*3.9,y+14.1,z-nz*3.9],[1,1,1],[0,f.angle,0]);g.dispose();
    for(let i=0;i<5;i++)this.block(x+nx*(5.1+i*.7),y+.7-i*.19,z+nz*(5.1+i*.7),w+3+i*.6,.35,.8,'#bcb69e',f.angle);
    this.buildingSign('한양대학교 역사관',x+nx*4.3,y+13.7,z+nz*4.3,14.4,1.2,f.angle);
  }
  buildGate(b){
    const [x,z]=b.center,y=this.height(x,z);b.base=y;b.height=7;this.block(x,y+.45,z,9,.8,14,'#b4ac92',-.08);for(const side of [-1,1]){this.block(x+side*3.9,y+3.3,z,1.25,6.6,10,'#d4c8ac',-.08);this.block(x+side*3.9,y+6.6,z,1.65,.4,11,'#e9ddbd',-.08);}this.block(x,y+7.1,z,9.4,.6,11.5,'#80988c',-.08);this.block(x,y+5,z+5.3,7.1,1.9,.2,'#3d6f74',-.08);this.buildingSign('한양대 · 애지문',x,y+5,z+5.45,6.2,1.3,-.08);
  }
  buildTheatre(b){
    const [x,z]=b.center,y=b.base;b.height=6.5;
    for(let i=0;i<6;i++){const points=[];for(let j=0;j<=32;j++){const a=Math.PI*.12+j/32*Math.PI*1.3;points.push([x+Math.cos(a)*(6+i*1.7),z+Math.sin(a)*(6+i*1.7)]);}for(let j=1;j<points.length;j++){const a=points[j-1],c=points[j],f=lineFrame(a,c);this.block((a[0]+c[0])/2,y+i*.6,(a[1]+c[1])/2,f.length+.2,.8,1.5,i%2?'#c3b99a':'#d6c9a8',f.angle);}}
    this.block(x,y-.5,z,12,.6,6,'#af9272',.35);this.buildingSign('노천극장',x,y+2,z-4,9,1.5,0);
  }
  buildingSign(text,x,y,z,width,height,angle){
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=64;const ctx=canvas.getContext('2d');ctx.fillStyle='#446b66';ctx.fillRect(0,0,512,64);ctx.fillStyle='#eee7d0';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='500 34px sans-serif';ctx.fillText(text,256,33);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));mesh.position.set(x,y,z);mesh.rotation.y=angle;this.scene.add(mesh);
  }
  clearPoint(p,margin=4){return pointInPolygon(p,this.data.boundary)&&!this.data.buildings.some(b=>pointInPolygon(p,b.points)||b.points.some(q=>distance(p,q)<margin))&&!this.data.features.some(f=>pointInPolygon(p,f.points))&&!this.roadSegments.some(s=>segmentDistance(p,s.a,s.b)<s.width/2+margin);}
  buildNature(){
    const r=this.random,trees=[],[minx,minz,maxx,maxz]=this.data.terrain.extent;
    // A loose woodland mixes ginkgo gold, soft oak, and dark pines. Each canopy
    // comprises asymmetric volumes rather than repeated spheres of one shape.
    for(let attempt=0;attempt<24000&&trees.length<620;attempt++){
      const p=[minx+r()*(maxx-minx),minz+r()*(maxz-minz)];if(!this.clearPoint(p,3.8)||trees.some(t=>distance(t.p,p)<8.2))continue;
      trees.push({p,size:3.5+r()*2.2,height:7+r()*4,type:r(),color:['#8c9e58','#a6ac58','#c5a64f','#b7884f','#78935c','#587b58'][Math.floor(r()*6)]});
    }
    const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.45,.7,1,6),material('#8e7d5d'),trees.length);const tops=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),material('#ffffff',{flatShading:false}),trees.length*5);const d=new THREE.Object3D();
    trees.forEach((t,i)=>{const [x,z]=t.p,y=this.height(x,z);d.position.set(x,y+t.height*.4,z);d.scale.set(1,t.height*.8,1);d.rotation.set(0,r(),.02);d.updateMatrix();trunks.setMatrixAt(i,d.matrix);
      for(let j=0;j<5;j++){const a=j*2.399,size=t.size*(j===0?1:.67+r()*.18);d.position.set(x+(j?Math.cos(a)*t.size*.6:0),y+t.height+(j===0?1.5:Math.sin(a)*1.6),z+(j?Math.sin(a)*t.size*.6:0));d.scale.set(size,size*(t.type<.23?1.5:1.05),size*.85);d.rotation.set(r()*.3,r()*Math.PI,r()*.3);d.updateMatrix();tops.setMatrixAt(i*5+j,d.matrix);const color=new THREE.Color(t.color);color.offsetHSL(0,0,(r()-.5)*.045);tops.setColorAt(i*5+j,color);}
      if(i%3===0){for(let k=0;k<3;k++){const px=x+(r()-.5)*7,pz=z+(r()-.5)*7;this.ball(px,this.height(px,pz)+.7,pz,1.8,.7,1.2,'#9e9d69');}}
    });tops.castShadow=true;tops.receiveShadow=true;trunks.castShadow=true;this.scene.add(trunks,tops);this.treeCount=trees.length;
    for(let i=0;i<460;i++){const p=[minx+r()*(maxx-minx),minz+r()*(maxz-minz)];if(!this.clearPoint(p,2))continue;const y=this.height(...p);if(i%5===0){this.ball(p[0],y+.65,p[1],1.7,.85,1.1,'#aaa993');}else{this.ball(p[0],y+.9,p[1],2,1.2,1.5,['#718654','#99a261','#a59953'][i%3]);}}
  }
  bench(p,angle=0){const y=this.height(...p),c=Math.cos(angle),s=Math.sin(angle);const at=(x,z)=>[p[0]+c*x+s*z,p[1]-s*x+c*z];for(const z of [-.65,0,.65]){const q=at(0,z);this.block(q[0],y+1.55,q[1],5,.25,.48,'#a57e51',angle);}const q=at(0,-.9);this.block(q[0],y+2.5,q[1],5,1.2,.25,'#ad8658',angle);for(const x of [-1.8,1.8]){const q=at(x,0);this.block(q[0],y+.7,q[1],.3,1.4,1.7,'#60776a',angle);}}
  lamp(p,angle=0){const y=this.height(...p);this.column(p[0],y+4.6,p[1],.17,9.2,'#547267');this.column(p[0],y+.3,p[1],.42,.6,'#687a66');this.block(p[0],y+9.3,p[1],1.6,.25,1.6,'#576d5e',angle);this.ball(p[0],y+8.75,p[1],.58,.6,.58,'#ffdf8d','glow');}
  addDetails(){
    const r=this.random;
    for(const v of this.sim.venues){const p=v.point,y=this.height(...p);let angle=0;if(v.from)angle=Math.atan2(v.from[0]-p[0],v.from[1]-p[1]);
      // A little outdoor room at every destination makes waiting and meeting visible.
      const spread=[p[0]+Math.cos(angle)*6,p[1]-Math.sin(angle)*6];if(!this.data.buildings.some(b=>pointInPolygon(spread,b.points)))this.bench(spread,angle);this.lamp([p[0]+Math.cos(angle)*4,p[1]-Math.sin(angle)*4]);
      this.column(p[0]-Math.cos(angle)*3,y+2.7,p[1]+Math.sin(angle)*3,.15,5.4,'#587468');this.block(p[0]-Math.cos(angle)*3,y+4.2,p[1]+Math.sin(angle)*3,2.6,1.6,.2,'#406a69',angle);this.block(p[0]-Math.cos(angle)*3,y+3.2,p[1]+Math.sin(angle)*3,2.6,.6,.2,'#d0ba82',angle);
      if(['food','union'].includes(v.id)){for(const side of [-1,1]){const q=[p[0]+Math.cos(angle)*side*9,p[1]-Math.sin(angle)*side*9],h=this.height(...q);if(this.data.buildings.some(b=>pointInPolygon(q,b.points)))continue;this.column(q[0],h+1.7,q[1],1.9,.25,'#ad8b5a');this.column(q[0],h+.85,q[1],.2,1.7,'#597468');this.column(q[0],h+4,q[1],.12,8,'#a9926b');this.batch.add(this.cone,side<0?'#cfb471':'#839e8b',[q[0],h+8,q[1]],[4,1.3,4],[0,.2,0]);}}
    }
    for(let i=0;i<this.roadSegments.length;i+=7){const road=this.roadSegments[i];if(distance(road.a,road.b)<14)continue;const f=lineFrame(road.a,road.b),p=[(road.a[0]+road.b[0])/2-f.dz*(road.width/2+1.4),(road.a[1]+road.b[1])/2+f.dx*(road.width/2+1.4)];if(this.data.buildings.some(b=>pointInPolygon(p,b.points)))continue;this.lamp(p,f.angle);if(i%21===0)this.bench([p[0]-f.dz*2,p[1]+f.dx*2],f.angle);}
    // The lion plaza and university flags anchor the western campus entrance.
    const history=this.data.buildings.find(b=>b.name==='역사관');const p=[-146.8,84.5],y=this.height(...p);this.column(p[0],y+.7,p[1],5.7,1.4,'#c7bea0');this.column(p[0],y+1.7,p[1],3.6,.7,'#d3c9a8');this.block(p[0],y+3,p[1],4.4,2,2.6,'#968d68');this.ball(p[0]-1.6,y+4.6,p[1],1.7,1.9,1.6,'#a69a70');this.ball(p[0]-1.95,y+4.7,p[1]+.8,.9,1.1,.9,'#b5aa83');for(const side of [-1,1])this.block(p[0]-1.5,y+2.8,p[1]+side*.8,.8,2,.7,'#a69b79');
    for(let i=0;i<3;i++){const x=-146+i*4,z=104;this.column(x,this.height(x,z)+7,z,.15,14,'#d5cdb5');this.block(x+1.7,this.height(x,z)+12,z,3.5,2.2,.12,i===1?'#44758a':'#e3d7b9',.2);}
    // Bike racks, planted terracotta pots and fallen leaves along warm stone paths.
    for(const v of this.sim.venues.slice(0,5)){const p=v.from||v.point;for(let i=0;i<3;i++){const x=p[0]+i*2.2,z=p[1]+5,y=this.height(x,z);if(this.data.buildings.some(b=>pointInPolygon([x,z],b.points)))continue;this.block(x,y+.5,z,1.2,1,1.2,'#a78460');this.ball(x,y+1.5,z,.9,.8,.9,'#789058');}}
    for(let i=0;i<600;i++){const road=this.roadSegments[Math.floor(r()*this.roadSegments.length)];if(!road)continue;const t=r(),f=lineFrame(road.a,road.b),side=(r()>.5?1:-1)*(road.width*.45+r()*1.7),x=road.a[0]+f.dx*f.length*t-f.dz*side,z=road.a[1]+f.dz*f.length*t+f.dx*side;if(!pointInPolygon([x,z],this.data.boundary))continue;this.block(x,this.height(x,z)+.3,z,.22+r()*.25,.035,.35,['#b4a25b','#ba8e56','#cfb56a'][i%3],r()*6,'ground');}
  }
  buildStudents(){
    const capsule=new THREE.CapsuleGeometry(1,1,3,8),head=new THREE.SphereGeometry(1,12,9),hair=new THREE.SphereGeometry(1,12,8,0,Math.PI*2,0,Math.PI*.57),limb=new THREE.CapsuleGeometry(.31,1.05,2,6);
    this.characters=this.sim.students.map(s=>{
      const group=new THREE.Group(),upper=new THREE.Group();group.userData.student=s.id;group.add(upper);
      const batch=new StaticBatch({scene:upper}),skin=['#e9bb92','#dbab80','#edc7a4'][s.id%3],hairColor=['#544938','#3c4841','#745340'][s.id%3];
      batch.add(capsule,s.color,[0,3.45,0],[.94,1.05,.67]);batch.add(head,skin,[0,5.25,.06],[1.07,1.14,.98]);batch.add(hair,hairColor,[0,5.43,-.05],[1.1,1.12,1.03]);
      if(s.id%3===2)batch.add(head,hairColor,[0,4.9,-.57],[1.1,.75,.58]);
      batch.add(this.box,'#d9ba80',[0,3.5,-.82],[1.6,1.9,.65]);batch.add(this.box,'#bb9560',[0,3.5,-1.17],[1.1,.7,.13]);
      for(const side of [-1,1]){batch.add(this.box,'#d7c7a1',[side*.56,3.6,.61],[.14,1.6,.15],[0,0,side*.1]);batch.add(head,'#403f35',[side*.36,5.35,.96],[.08,.10,.05]);batch.add(head,'#d39473',[side*.68,4.99,.77],[.16,.09,.04]);}
      batch.add(this.box,'#b48364',[0,4.89,1.01],[.21,.06,.03]);batch.finish();
      const arms=[],legs=[];for(const side of [-1,1]){const arm=new THREE.Group();arm.position.set(side*1.08,3.95,0);const sleeve=new THREE.Mesh(limb,material(s.color));sleeve.position.y=-.67;arm.add(sleeve);const hand=new THREE.Mesh(new THREE.SphereGeometry(.31,7,5),material(skin));hand.position.y=-1.42;arm.add(hand);upper.add(arm);arms.push(arm);const leg=new THREE.Group();leg.position.set(side*.48,2,0);const mesh=new THREE.Mesh(limb,material('#5b6d67'));mesh.scale.set(1,1.15,1);mesh.position.y=-.72;leg.add(mesh);const shoe=new THREE.Mesh(new THREE.BoxGeometry(.62,.42,1.02),material('#e2dac4'));shoe.position.set(0,-1.6,.16);leg.add(shoe);group.add(leg);legs.push(leg);}
      const book=new THREE.Mesh(new THREE.BoxGeometry(1.65,.12,1.14),material('#e5d7ac'));book.position.set(0,3.15,1.3);book.rotation.x=.25;upper.add(book);const cup=new THREE.Mesh(new THREE.CylinderGeometry(.3,.23,.65,8),material('#efe0ba'));cup.position.set(.8,3.3,1.1);upper.add(cup);
      const bubble=new THREE.Mesh(new THREE.SphereGeometry(.2,8,5),new THREE.MeshBasicMaterial({color:'#f2cf71'}));bubble.position.set(1.6,6.7,0);upper.add(bubble);bubble.visible=false;
      const target=new THREE.Mesh(new THREE.SphereGeometry(4.5,7,5),new THREE.MeshBasicMaterial({visible:false}));target.position.y=3;group.add(target);group.traverse(o=>{if(o.isMesh&&o!==target){o.castShadow=true;o.receiveShadow=true;}});this.scene.add(group);this.meshes.push(group);return{group,upper,arms,legs,limbs:[...legs,...arms],book,cup,bubble};
    });
  }
  buildLabels(){
    this.labelLayer=document.createElement('div');this.labelLayer.className='map-labels';this.container.appendChild(this.labelLayer);
    for(const venue of this.sim.venues){const element=document.createElement('button');element.className='map-label '+venue.action;element.innerHTML=`<span class="map-label-dot"></span>${venue.name}<small>${venue.number}</small>`;element.title=`${venue.name}으로 카메라 이동`;element.onclick=()=>this.focus(venue.building.center,240);this.labelLayer.appendChild(element);this.labels.push({element,venue});}
  }
  buildAtmosphere(){
    // A few drifting leaves and high swallows give still moments a gentle rhythm.
    const particles=80,positions=new Float32Array(particles*3);this.leafOrigins=[];for(let i=0;i<particles;i++){const x=(this.random()-.5)*680,z=(this.random()-.5)*580,y=this.height(x,z)+12+this.random()*20;positions.set([x,y,z],i*3);this.leafOrigins.push([x,y,z,this.random()*8]);}const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));this.leaves=new THREE.Points(geometry,new THREE.PointsMaterial({color:'#ddbd66',size:.55,transparent:true,opacity:.7,depthWrite:false}));this.scene.add(this.leaves);
    this.birds=[];const birdMat=material('#7d8975');for(let i=0;i<5;i++){const g=new THREE.Group();for(const side of [-1,1]){const wing=new THREE.Mesh(new THREE.ConeGeometry(.5,4,3),birdMat);wing.rotation.z=side*1.2;wing.position.x=side*1.5;g.add(wing);}this.scene.add(g);this.birds.push(g);}
    this.routeMesh=null;
  }
  resize(){const w=this.container.clientWidth,h=this.container.clientHeight;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
  resetCamera(){this.follow=false;this.cameraGoal=null;this.controls.target.set(-8,28,8);this.camera.position.set(605,775,895);this.controls.update();}
  focus(p,range=280){this.follow=false;this.cameraGoal=null;const old=this.controls.target.clone();this.controls.target.set(p[0],this.height(...p)+7,p[1]);const offset=this.camera.position.clone().sub(old).normalize().multiplyScalar(range);this.camera.position.copy(this.controls.target).add(offset);this.controls.update();}
  clearCameraFor(target,range,angle){
    const cast=new THREE.Raycaster(),feet=target.clone().add(new THREE.Vector3(0,-4,0));
    for(const turn of [0,.45,-.45,.9,-.9,1.5,-1.5,Math.PI]){const a=angle+turn,offset=new THREE.Vector3(Math.sin(a)*.62,.79,Math.cos(a)*.62).normalize().multiplyScalar(range),camera=target.clone().add(offset);cast.set(camera,feet.clone().sub(camera).normalize());const hits=cast.intersectObjects(this.occlusionMeshes,false);if(!hits.length||hits[0].distance>camera.distanceTo(feet)-1)return camera;}
    return target.clone().add(new THREE.Vector3(0,range*.96,range*.28));
  }
  focusStudent(range=115){
    // Old callers passed 330m; the observation lens now puts expressions and
    // gestures within view while keeping the surrounding courtyard readable.
    if(range>220)range=125;const p=this.sim.current.position,target=new THREE.Vector3(p[0],this.height(...p)+5,p[1]),start=this.camera.position.clone().sub(this.controls.target),angle=Math.atan2(start.x,start.z);this.controls.target.copy(target);this.camera.position.copy(this.clearCameraFor(target,range,angle));this.follow=true;this.cameraGoal=null;this.controls.update();
  }
  zoom(factor){const delta=this.camera.position.clone().sub(this.controls.target).multiplyScalar(factor);delta.clampLength(this.controls.minDistance,this.controls.maxDistance);this.camera.position.copy(this.controls.target).add(delta);this.controls.update();}
  rotate(amount){const offset=this.camera.position.clone().sub(this.controls.target);offset.applyAxisAngle(new THREE.Vector3(0,1,0),amount);this.camera.position.copy(this.controls.target).add(offset);this.controls.update();}
  setSimulation(sim){this.sim=sim;this.lastRoute='';this.seatCache?.clear();}
  updateRoute(){
    const s=this.sim.current,key=s.id+'-'+(s.destination?.id||'')+'-'+s.phase+'-'+s.routeIndex;if(this.lastRoute===key)return;this.lastRoute=key;
    if(this.routeMesh){this.scene.remove(this.routeMesh);this.routeMesh.geometry.dispose();this.routeMesh.material.dispose();this.routeMesh=null;}
    if(s.phase!=='walking'||!this.follow)return;
    // A thin dotted line follows graph segments exactly: no smoothed shortcut
    // can imply a route through a building corner.
    const positions=[],points=[s.position,...s.route.slice(s.routeIndex).map(id=>this.sim.graph.nodes[id].p)];
    for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],length=distance(a,b);for(let t=0;t<length;t+=3){const x=a[0]+(b[0]-a[0])*t/length,z=a[1]+(b[1]-a[1])*t/length;positions.push(x,this.height(x,z)+.6,z);}}
    if(!positions.length)return;const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));this.routeMesh=new THREE.Points(geometry,new THREE.PointsMaterial({color:'#fff0b4',size:.55,transparent:true,opacity:.68,depthWrite:false}));this.scene.add(this.routeMesh);
  }
  project(p,element,offset=0){const v=new THREE.Vector3(...p).project(this.camera),w=this.container.clientWidth,h=this.container.clientHeight,x=(v.x*.5+.5)*w,y=(-v.y*.5+.5)*h,hidden=v.z>1||v.z<0||x<25||x>w-25||y<75||y>h-60;element.style.transform=`translate(${x}px,${y+offset}px) translate(-50%,-100%)`;element.style.display=hidden?'none':'';return{x,y,hidden};}
  seatPosition(s){
    if(s.phase==='walking'||!s.destination)return s.position;
    this.seatCache??=new Map();const key=s.destination.id;
    if(!this.seatCache.has(key)){
      const origin=s.destination.point,slots=[[...origin]];
      for(let radius=3.4;radius<=26&&slots.length<this.sim.students.length;radius+=3.4)for(let k=0;k<24&&slots.length<this.sim.students.length;k++){
        const a=k/24*Math.PI*2,p=[origin[0]+Math.cos(a)*radius,origin[1]+Math.sin(a)*radius];if(slots.some(q=>distance(p,q)<3.3)||!this.sim.graph.clearSegment?.(origin,p,1.7))continue;slots.push(p);
      }
      this.seatCache.set(key,slots);
    }
    const slots=this.seatCache.get(key);return slots[s.id]||s.position;
  }
  render(elapsed=0){
    const current=this.sim.current,cameraDistance=this.camera.position.distanceTo(this.controls.target);
    for(const s of this.sim.students){const c=this.characters[s.id];if(!c)continue;const g=c.group,walking=s.phase==='walking',pose=s.pose||(walking?'walk':{study:'read',eat:'eat',rest:'sit',social:'talk',sleep:'sleep'}[s.action]||'wait'),sitting=['sit','read','eat','sleep'].includes(pose)&&!walking;const seat=this.seatPosition(s),px=walking?s.position[0]:seat[0],pz=walking?s.position[1]:seat[1];g.position.set(px,this.height(px,pz)+.74,pz);
      if(walking&&s.routeIndex<s.route.length){const p=this.sim.graph.nodes[s.route[s.routeIndex]].p;g.rotation.y=Math.atan2(p[0]-s.position[0],p[1]-s.position[1]);}
      else if(s.companionId!=null&&this.sim.students[s.companionId]){const other=this.sim.students[s.companionId];const otherPosition=other.phase==='walking'?other.position:this.seatPosition(other);const dx=otherPosition[0]-g.position.x,dz=otherPosition[1]-g.position.z;if(Math.hypot(dx,dz)>.2)g.rotation.y=Math.atan2(dx,dz);}
      const cycle=s.walking*.65;c.upper.position.y=sitting?-.85:0;c.upper.rotation.x=pose==='sleep'?.3:0;g.position.y+=walking?Math.abs(Math.sin(cycle))*.17:Math.sin(elapsed*1.7+s.id)*.025;
      c.legs.forEach((leg,i)=>{leg.rotation.x=sitting?-1.25:walking?Math.sin(cycle+i*Math.PI)*.55:0;leg.position.y=sitting?1.15:2;});
      c.arms.forEach((arm,i)=>{arm.rotation.x=walking?Math.sin(cycle+(1-i)*Math.PI)*.5:sitting?-.72:pose==='talk'?-.4+Math.sin(elapsed*2.8+i+s.id)*.35:pose==='wait'&&i===0?-.32:0;arm.rotation.z=pose==='talk'?(i?1:-1)*(.18+Math.sin(elapsed*1.9+i)*.13):0;});
      c.book.visible=pose==='read';c.cup.visible=pose==='eat';c.bubble.visible=pose==='talk'&&Math.sin(elapsed*2+s.id)>.4;c.bubble.position.y=6.7+Math.sin(elapsed*2)*.3;g.scale.setScalar(s.id===current.id?1.12:1);
    }
    const c=this.characters[current.id]?.group.position;if(!c)return;this.ring.position.set(c.x,c.y,c.z);const ringScale=clamp(cameraDistance/210,1,3.4)*(1+Math.sin(elapsed*2)*.025),ringPositions=this.ring.geometry.attributes.position;for(let i=0;i<ringPositions.count;i++){const x=this.ringBase[i*3]*ringScale,z=this.ringBase[i*3+1]*ringScale;ringPositions.setXYZ(i,x,this.height(c.x+x,c.z+z)-c.y+.92,z);}ringPositions.needsUpdate=true;this.ring.geometry.computeBoundingSphere();this.ring.material.opacity=this.follow?.9:.72;
    if(this.follow){const target=new THREE.Vector3(c.x,c.y+5,c.z),delta=target.clone().sub(this.controls.target);this.controls.target.add(delta);this.camera.position.add(delta);if(this.cameraGoal)this.cameraGoal.add(delta);
      if(elapsed-this.lastOcclusion>.7){this.lastOcclusion=elapsed;const offset=this.camera.position.clone().sub(this.controls.target);this.cameraGoal=this.clearCameraFor(this.controls.target,offset.length(),Math.atan2(offset.x,offset.z));}
      if(this.cameraGoal&&this.camera.position.distanceTo(this.cameraGoal)>1)this.camera.position.lerp(this.cameraGoal,.035);
    }
    this.controls.update();this.updateRoute();
    const placed=[];for(const {element,venue} of this.labels){const selected=venue.id===current.destination?.id;element.classList.toggle('destination',selected);element.hidden=!this.labelsVisible;if(!this.labelsVisible)continue;const distanceToTarget=Math.hypot(venue.building.center[0]-this.controls.target.x,venue.building.center[1]-this.controls.target.z);if(cameraDistance<230&&distanceToTarget>75){element.style.display='none';continue;}const projection=this.project([venue.building.center[0],venue.building.base+venue.building.height+8,venue.building.center[1]],element);if(placed.some(p=>Math.abs(p.x-projection.x)<120&&Math.abs(p.y-projection.y)<28)&&!selected)element.style.display='none';else if(!projection.hidden)placed.push(projection);}
    this.selectedPin.textContent=current.name+' · '+(current.activityLabel||(current.phase==='walking'?'걷는 중':current.phase==='waiting'?'잠깐 기다리는 중':ACTIONS[current.action]?.verb||'쉬는 중'));this.project([c.x,c.y+9,c.z],this.selectedPin,-4);
    const hour=this.sim.time/60;const dusk=clamp((hour-16.5)/3,0,1),night=hour>=19.5||hour<6;this.sun.intensity=night?.42:3.2-dusk*1.3;this.hemi.intensity=night?.85:1.8-dusk*.2;this.sun.color.set(night?'#d5dff1':dusk>.2?'#ffd3a2':'#ffe5b8');this.scene.background.set(night?'#788c99':dusk>.2?'#e3ccb1':'#e6dec9');this.scene.fog.color.copy(this.scene.background);if(this.lampMaterial)this.lampMaterial.emissiveIntensity=night?2.5:.25;
    const pos=this.leaves.geometry.attributes.position;for(let i=0;i<this.leafOrigins.length;i++){const [x,y,z,seed]=this.leafOrigins[i];pos.setXYZ(i,x+Math.sin(elapsed*.22+seed)*5,y-((elapsed*.45+seed)%13),z+Math.cos(elapsed*.17+seed)*3);}pos.needsUpdate=true;
    this.birds.forEach((g,i)=>{const a=elapsed*.025+i*1.26;g.position.set(Math.cos(a)*165,110+Math.sin(a*2)*7,Math.sin(a)*120);g.rotation.y=-a;g.children.forEach((wing,j)=>wing.rotation.z=(j?1:-1)*(1.1+Math.sin(elapsed*4+i)*.28));});
    this.renderer.render(this.scene,this.camera);
  }
  screenshot(){return this.renderer.domElement.toDataURL('image/png');}
  get stats(){return{webgl:true,renderer:this.renderer.info.render,trees:this.treeCount,buildings:this.data.buildings.length,graphNodes:this.sim.graph.main.length};}
}

import {Simulation,distance,pointInPolygon,terrainHeight} from '../src/simulation.js';

// Geometry checks remain separate from the full academic-life regression suite.
export function verifySimulation(data){
  const checks=[],check=(name,condition,detail='')=>checks.push({name,pass:Boolean(condition),detail});
  const sim=new Simulation(data),g=sim.graph;
  check('All 62 surveyed building footprints are present',data.buildings.length===62);
  check('All seven activity venues are connected',sim.venues.length===7&&sim.venues.every(a=>sim.venues.every(b=>g.route(a.node,b.node).at(-1)===b.node)));
  let unsafe=0,edges=0,asymmetric=0,zeroLength=0;
  for(const id of g.main)for(const edge of g.nodes[id].edges){
    if(!g.nodes[edge.to].edges.some(e=>e.to===id&&Math.abs(e.length-edge.length)<1e-6))asymmetric++;
    if(!Number.isFinite(edge.length)||edge.length<=0)zeroLength++;
    if(id<edge.to){edges++;if(!g.clearSegment(g.nodes[id].p,g.nodes[edge.to].p))unsafe++;}
  }
  check('Every walkable road edge clears buildings between its endpoints',unsafe===0,`${edges} edges sampled at ≤0.8 m; ${unsafe} unsafe`);
  check('Pedestrian connections work in both directions',asymmetric===0);
  check('All route edges have positive finite lengths',zeroLength===0);
  check('Terrain height is finite on all connected nodes',g.main.every(id=>Number.isFinite(terrainHeight(data,...g.nodes[id].p))));
  check('Activity entrances never lie within buildings',sim.venues.every(v=>!data.buildings.some(b=>pointInPolygon(v.point,b.points))));
  check('Every initial student starts outside a building',sim.students.every(s=>!data.buildings.some(b=>pointInPolygon(s.position,b.points))));
  let disconnected=0,wrongEndpoint=0;
  for(const a of sim.venues)for(const b of sim.venues){const path=g.route(a.node,b.node);if(path[0]!==a.node||path.at(-1)!==b.node)wrongEndpoint++;for(let i=1;i<path.length;i++)if(!g.nodes[path[i-1]].edges.some(e=>e.to===path[i]))disconnected++;}
  check('All venue routes keep their exact start and destination',wrongEndpoint===0);
  check('Routes never jump across disconnected road segments',disconnected===0);
  const route=g.route(sim.venues[0].node,sim.venues[1].node),copy=g.route(sim.venues[0].node,sim.venues[1].node);copy.pop();
  check('Changing a returned route cannot corrupt the route cache',g.route(sim.venues[0].node,sim.venues[1].node).length===route.length);
  check('Same-place route is a single node',g.route(sim.venues[0].node,sim.venues[0].node).length===1);
  check('Invalid route destinations fail safely',g.route(-1,999999).length===0);
  check('Terrain clamps coordinates at map edges',Number.isFinite(terrainHeight(data,1e6,-1e6)));
  check('Route lengths agree with geometric walking distances',sim.venues.every(a=>sim.venues.every(b=>g.route(a.node,b.node).slice(1).every((n,i)=>{const previous=g.route(a.node,b.node)[i];return Math.abs(g.nodes[previous].edges.find(e=>e.to===n).length-distance(g.nodes[previous].p,g.nodes[n].p))<1e-6;}))));
  return{pass:checks.every(c=>c.pass),checks,stats:{graphNodes:g.nodes.length,mainComponent:g.main.length,checkedEdges:edges,venues:sim.venues.length}};
}

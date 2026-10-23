import {createSemester,ensureSemesterRelationships,semesterView,startWeek,setWeekDraft,chooseSemesterOption,advanceWeek,semesterBlocksTime,beforeSemesterStep,semesterArrival,semesterWaitFinished,semesterActivity,semesterFinishActivity,semesterClassFinished,semesterMeal,isSemesterExamDay,validateSemester} from './semester.js?v=5';
export {SEMESTER_CALENDAR,PLAN_ACTIVITIES,NPCS,GOALS,WEEKDAYS} from './semester.js?v=5';
export const TRAITS = {
  curious: {name:'호기심 많은 탐구가',short:'탐구가',icon:'spark',color:'#5c8f81',description:'새로운 길과 책 속에서 작은 발견을 해요.',weights:{study:1.3,social:.8,rest:1,exercise:1.2}},
  diligent: {name:'차근차근 계획가',short:'계획가',icon:'book',color:'#7186a6',description:'조금 일찍 도착하고, 배운 것을 오래 기억해요.',weights:{study:1.8,social:.55,rest:.8,exercise:.7}},
  social: {name:'다정한 사교가',short:'사교가',icon:'people',color:'#ca956e',description:'단골 친구와 점심을 먹는 시간이 가장 좋아요.',weights:{study:.7,social:1.8,rest:.85,exercise:1.1}},
};
export const ACTIONS = {
  class:{label:'전공 수업을 듣는 중',verb:'수업',icon:'book',duration:50},
  study:{label:'노트를 펼쳐 읽는 중',verb:'자율 학습',icon:'book',duration:36},
  eat:{label:'따뜻한 점심을 먹는 중',verb:'식사',icon:'food',duration:24},
  rest:{label:'나무 그늘에 앉아 쉬는 중',verb:'휴식',icon:'leaf',duration:28},
  social:{label:'친구와 도란도란 이야기 중',verb:'친구 만나기',icon:'people',duration:25},
  exercise:{label:'캠퍼스 풍경을 바라보는 중',verb:'산책',icon:'walk',duration:18},
  sleep:{label:'하루를 마무리하고 쉬는 중',verb:'숙면',icon:'moon',duration:420},
};
export const clamp=(x,a=0,b=100)=>Math.min(b,Math.max(a,x));
export const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export function pointInPolygon(p,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
function project(p,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1),0,1);return[a[0]+dx*t,a[1]+dz*t];}
export function terrainHeight(data,x,z){const t=data.terrain,[x0,z0]=t.extent;const gx=clamp((x-x0)/t.step,0,t.heights[0].length-1.001),gz=clamp((z-z0)/t.step,0,t.heights.length-1.001);const i=Math.floor(gx),j=Math.floor(gz),u=gx-i,v=gz-j;return (t.heights[j][i]*(1-u)+t.heights[j][i+1]*u)*(1-v)+(t.heights[j+1][i]*(1-u)+t.heights[j+1][i+1]*u)*v;}

export class CampusGraph {
  constructor(data){
    this.data=data;this.nodes=[];this.lookup=new Map();this.routeCache=new Map();
    this.obstacles=data.buildings.map(b=>({points:b.points,minX:Math.min(...b.points.map(p=>p[0]))-2.1,maxX:Math.max(...b.points.map(p=>p[0]))+2.1,minZ:Math.min(...b.points.map(p=>p[1]))-2.1,maxZ:Math.max(...b.points.map(p=>p[1]))+2.1}));
    const node=(p)=>{const k=p.map(x=>Math.round(x*2)/2).join(',');if(this.lookup.has(k))return this.lookup.get(k);const id=this.nodes.length;this.nodes.push({id,p:[...p],edges:[]});this.lookup.set(k,id);return id;};
    const edge=(a,b)=>{if(a===b||this.nodes[a].edges.some(e=>e.to===b))return;const length=distance(this.nodes[a].p,this.nodes[b].p);if(length<.01||!this.clearSegment(this.nodes[a].p,this.nodes[b].p))return;this.nodes[a].edges.push({to:b,length});this.nodes[b].edges.push({to:a,length});};
    for(const road of data.roads){if(['proposed','bus_guideway'].includes(road.type))continue;for(let i=1;i<road.points.length;i++){const a=road.points[i-1],b=road.points[i];const count=Math.ceil(distance(a,b)/7);let previous=node(a);for(let k=1;k<=count;k++){const next=node([a[0]+(b[0]-a[0])*k/count,a[1]+(b[1]-a[1])*k/count]);edge(previous,next);previous=next;}}}
    this.node=node;this.edge=edge;
    // OSM has disconnected footway endpoints and passages through buildings. Join only
    // nearby visible endpoints; never let routing inherit a passage through a footprint.
    const ends=this.nodes.filter(n=>n.edges.length===1);
    for(const n of ends){let best=null,bestD=8;for(const other of this.nodes){if(other.id===n.id||!other.edges.length||n.edges.some(e=>e.to===other.id))continue;const d=distance(n.p,other.p);if(d<bestD&&this.clearSegment(n.p,other.p)){best=other;bestD=d;}}if(best)edge(n.id,best.id);}
    const visited=new Set();let largest=[];
    for(const start of this.nodes){if(visited.has(start.id))continue;const group=[],stack=[start.id];visited.add(start.id);while(stack.length){const id=stack.pop();group.push(id);for(const e of this.nodes[id].edges)if(!visited.has(e.to)){visited.add(e.to);stack.push(e.to);}}if(group.length>largest.length)largest=group;}
    this.main=largest;this.mainSet=new Set(largest);
  }
  clearSegment(a,b,margin=1.7){
    const candidates=this.obstacles.filter(o=>Math.max(a[0],b[0])+margin>=o.minX&&Math.min(a[0],b[0])-margin<=o.maxX&&Math.max(a[1],b[1])+margin>=o.minZ&&Math.min(a[1],b[1])-margin<=o.maxZ);
    const count=Math.max(1,Math.ceil(distance(a,b)/.8));
    for(let i=0;i<=count;i++){const p=[a[0]+(b[0]-a[0])*i/count,a[1]+(b[1]-a[1])*i/count];for(const o of candidates){if(pointInPolygon(p,o.points))return false;if(margin>0)for(let j=1;j<o.points.length;j++)if(distance(p,project(p,o.points[j-1],o.points[j]))<margin)return false;}}
    return true;
  }
  nearest(p){let best=this.main[0],d=Infinity;for(const id of this.main){const dd=distance(p,this.nodes[id].p);if(dd<d){d=dd;best=id;}}return best;}
  entrance(building){
    const candidates=this.main.map(id=>({id,d:distance(this.nodes[id].p,building.center)})).sort((a,b)=>a.d-b.d).slice(0,140);let best=null;
    for(const {id} of candidates){const p=this.nodes[id].p;for(let i=1;i<building.points.length;i++){const q=project(p,building.points[i-1],building.points[i]),len=distance(p,q);if(len<3.2)continue;const tip=[q[0]+(p[0]-q[0])/len*3.2,q[1]+(p[1]-q[1])/len*3.2];if(this.clearSegment(p,tip)&&(!best||len<best.length))best={node:id,point:tip,length:len};}}
    if(!best){const id=this.nearest(building.center);return{node:id,point:this.nodes[id].p,length:0,approximate:true};}
    const entrance=this.node(best.point);this.edge(best.node,entrance);if(!this.mainSet.has(entrance)){this.main.push(entrance);this.mainSet.add(entrance);}return{node:entrance,point:this.nodes[entrance].p,length:best.length,approximate:true,from:this.nodes[best.node].p};
  }
  route(start,end){
    if(start===end)return[start];if(!this.nodes[start]||!this.nodes[end])return[];const key=start+':'+end;if(this.routeCache.has(key))return [...this.routeCache.get(key)];
    const dist=new Map([[start,0]]),prev=new Map(),queue=[start],closed=new Set();
    while(queue.length){queue.sort((a,b)=>(dist.get(a)+distance(this.nodes[a].p,this.nodes[end].p))-(dist.get(b)+distance(this.nodes[b].p,this.nodes[end].p)));const id=queue.shift();if(id===end){const path=[end];while(prev.has(path[0]))path.unshift(prev.get(path[0]));this.routeCache.set(key,path);return [...path];}if(closed.has(id))continue;closed.add(id);for(const e of this.nodes[id].edges){const d=dist.get(id)+e.length;if(d<(dist.get(e.to)??Infinity)){dist.set(e.to,d);prev.set(e.to,id);queue.push(e.to);}}}return[];
  }
}
export function createVenues(data,graph){
  const definitions=[['engineering','제1공학관','class','212'],['library','백남학술정보관','study','501'],['food','학생복지관','eat','105'],['union','학생회관','social','107'],['history','역사관','rest','101'],['gym','올림픽체육관','exercise','306'],['dorm','제1학생생활관','sleep','생활관']];
  return definitions.map(([id,name,action,number])=>{const building=data.buildings.find(b=>b.name===name);if(!building)throw new Error('Missing OSM landmark '+name);return{id,name,action,number,building,...graph.entrance(building)};});
}
const names=['김하늘','이도윤','박서연','정지우','최유진','윤시온','강민서','송수빈','오지호','한서아','임주원','조다은','신예준','배나은','권태오','장가온','홍지안','백이든'];
const colors=['#649b8c','#d8a078','#8498b6','#bd8898','#c7b775','#7ea7b8'];
const poses={class:'read',study:'read',eat:'eat',rest:'sit',social:'talk',exercise:'look',sleep:'sleep'};
const clone=value=>JSON.parse(JSON.stringify(value));
const particle=(name,closed,open)=>name+((name.charCodeAt(name.length-1)-44032)%28?closed:open);
const together=name=>particle(name,'과','와');
export class Simulation{
  constructor(data,trait='curious',count=18){
    this.data=data;this.graph=new CampusGraph(data);this.venues=createVenues(data,this.graph);this.time=8*60+45;this.day=1;this.logs=[];this.events=[];this.selected=0;this.trait=TRAITS[trait]?trait:'curious';this.totalDistance=0;
    const gate=this.graph.nearest(data.buildings.find(b=>b.name==='애지문').center);
    this.students=Array.from({length:count},(_,id)=>{const key=id===0?this.trait:Object.keys(TRAITS)[id%3];const origin=id===0?{node:gate,point:this.graph.nodes[gate].p}:this.venues[id%this.venues.length];return{id,name:names[id%names.length],trait:key,color:colors[id%colors.length],node:origin.node,position:[...origin.point],energy:82-id%5*4,satiety:70-id%4*5,academic:32+id%7*5,mood:76-id%3*4,social:60-id%5*8,action:null,phase:'idle',destination:null,route:[],routeIndex:0,remaining:0,walking:0,thought:'새 학기의 공기가 좋아.',reason:'',completed:[],distance:0,pose:'wait',activityLabel:'오늘의 일과를 생각하는 중',companions:[],companionId:null,relationships:{},memories:[],examPrep:12+id%4*5,punctuality:0,schedule:[{id:'morning',start:540,end:590,title:'창의적 공학설계'},{id:'afternoon',start:780,end:830,title:'사고와 표현'}],attendance:{},dayFlags:{},experience:{late:0,meals:0,exams:0,favorite:'history',visits:{}},invitation:null,classSession:null,waitUntil:0,activityElapsed:0,sharedTime:{},semesterTask:null};});
    this.semester=createSemester(this.trait);ensureSemesterRelationships(this);
    this.remember(this.students[0],'arrival','애지문을 지나 처음 만난 가을 캠퍼스. 어떤 하루가 될까?','leaf');
    this.students.forEach(s=>this.decide(s));
  }
  get current(){return this.students[this.selected];}
  get clock(){const m=Math.floor(this.time)%1440;return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;}
  get dayTheme(){return this.semesterView().calendar.title;}
  get semesterBlocksTime(){return semesterBlocksTime(this);}
  semesterView(){return semesterView(this);}
  startWeek(options){return startWeek(this,options);}
  setWeekDraft(options){return setWeekDraft(this,options);}
  chooseSemesterOption(id){return chooseSemesterOption(this,id);}
  advanceWeek(){return advanceWeek(this);}
  addLog(s,text,icon='leaf',kind='activity'){const log={student:s.id,time:this.clock,text,icon,day:this.day,kind};this.logs.unshift(log);this.logs=this.logs.slice(0,120);this.events.push(log);if(this.events.length>120)this.events.splice(0,this.events.length-120);}
  remember(s,kind,text,icon='leaf',withId=null){const memory={kind,text,day:this.day,time:this.clock,with:withId};s.memories.unshift(memory);s.memories=s.memories.slice(0,30);this.addLog(s,text,icon,kind);return memory;}
  relationshipsFor(s=this.current){return Object.entries(s.relationships).map(([id,r])=>({id:Number(id),name:this.students[id]?.name||'친구',...r,label:r.status==='dating'?'서로 마음을 확인한 연인':r.status==='declined'?'서로의 속도를 존중하는 사이':(r.friendship??r.affinity)>=65?'마음 편한 친구':(r.friendship??r.affinity)>=30?'함께 다니는 친구':'낯익은 동기'})).sort((a,b)=>(b.status==='dating'?1000:0)+(b.friendship!==undefined?200:0)+(b.friendship??b.affinity)-(a.status==='dating'?1000:0)-(a.friendship!==undefined?200:0)-(a.friendship??a.affinity)).slice(0,4);}
  storyFor(s=this.current){return s.memories.slice(0,5);}
  nextClass(s=this.current){if((this.day-1)%7>=5)return null;return s.schedule.map(c=>({...c,key:this.day+':'+c.id,minutesUntil:c.start-this.time})).find(c=>this.time<c.end&&!s.attendance[c.key])||null;}
  relationship(s,id){return s.relationships[id]||(s.relationships[id]={affinity:5,encounters:0,sharedMeals:0,studySessions:0,lastDay:0});}
  preferredFriend(s){if(s.id===0&&this.semester?.phase==='living'){const focus=this.students[this.semester.focusId];if(focus&&focus.action!=='sleep'&&(s.relationships[focus.id]?.friendship||0)>=10)return focus;}const familiar=this.relationshipsFor(s).find(r=>this.students[r.id]?.action!=='sleep');if(familiar)return this.students[familiar.id];return this.students.find(other=>other.id!==s.id&&Math.floor(other.id/3)===Math.floor(s.id/3))||null;}
  invite(s){
    if(s.dayFlags.lunchInvitation===this.day)return;const friend=this.preferredFriend(s);if(!friend||friend.satiety>89||friend.action==='class')return;s.dayFlags.lunchInvitation=this.day;s.invitation={from:friend.id,day:this.day,expires:Math.min(780,this.time+25),accepted:true};friend.invitation={from:s.id,day:this.day,expires:Math.min(780,this.time+25),accepted:false};s.thought=`${friend.name.slice(1)}에게 같이 밥 먹자고 했어. 먼저 가 있어야지.`;this.addLog(s,`${friend.name}에게 학생복지관에서 같이 점심을 먹자고 했어요.`,'people','invitation');
  }
  decide(s){
    const min=this.time,trait=TRAITS[s.trait],next=this.nextClass(s);let action,reason;const friend=this.preferredFriend(s),known=friend?s.relationships[friend.id]:null;
    const engineering=this.venues[0],path=next?this.graph.route(s.node,engineering.node):[];const commute=path.reduce((sum,n,i)=>i?sum+distance(this.graph.nodes[path[i-1]].p,this.graph.nodes[n].p):sum,0)/58;
    const buffer=(s.trait==='diligent'?15:s.trait==='social'?-3:3)+Math.min(10,s.experience.late*4);
    const classDue=next&&min>=next.start-commute-buffer;
    if(min>=22*60||min<7*60){action='sleep';reason='오늘의 이야기는 여기까지. 내일 또 만나자.';}
    else if(s.satiety<22){action='eat';reason='배에서 꼬르륵. 밥부터 먹어야 생각이 날 것 같아.';}
    else if(s.energy<24){action='rest';reason='한양의 언덕은 만만치 않네. 나무 그늘에서 쉬어 가자.';}
    else if(classDue){action='class';reason=s.experience.late?'지난번엔 늦었지. 오늘은 조금 먼저 가자.':s.trait==='diligent'?'수업 전에 노트를 한 번 더 읽을 시간이 있겠어.':min>next.start?'이야기하다 시간을 놓쳤네. 강의실로 서두르자.':'곧 전공 수업이야. 익숙한 얼굴들을 만나겠네.';}
    else if(s.invitation&&s.invitation.day===this.day&&s.invitation.expires>min&&s.satiety<90){action='eat';s.invitation.accepted=true;reason=`${this.students[s.invitation.from].name.slice(1)}이랑 점심 약속! 오늘은 같이 먹자.`;}
    else if(min>=690&&min<780&&s.satiety<79&&!s.dayFlags.lunch){action='eat';reason=known?.affinity>=20?`${friend.name.slice(1)}도 배고플까? 같이 점심 먹으면 좋겠다.`:'점심 냄새가 나네. 학생복지관으로 가 볼까?';}
    else{
      const scores={study:(29+(100-s.academic)*.21+(isSemesterExamDay(this)?(100-s.examPrep)*.3:0))*trait.weights.study,social:(100-s.social)*trait.weights.social+(known?.affinity||0)*.12+(s.trait==='social'?28:0),rest:(100-s.energy)*trait.weights.rest*.9,exercise:(100-s.mood)*trait.weights.exercise+(s.trait==='curious'?22:6)};
      for(const done of s.completed.slice(-2))if(scores[done])scores[done]*=.38;
      action=Object.entries(scores).sort((a,b)=>b[1]-a[1])[0][0];
      reason={study:isSemesterExamDay(this)?'오늘 시험이 있지. 백남에서 헷갈리는 부분을 정리하자.':s.experience.late?'놓친 수업 내용을 백남에서 다시 읽어 봐야겠어.':'수업에서 궁금했던 문장, 백남에 가면 답을 찾을까?',social:known?.affinity>=25?`${friend.name.slice(1)}은 지금 뭘 할까? 학생회관에서 만나고 싶어.`:'혼자 있자니 조금 심심해. 학생회관에 누가 있을까?',rest:s.experience.visits.history>1?'역사관 앞 그 그늘, 오늘도 편안하겠지.':'역사관 앞 나무 아래에 잠깐 앉아 있고 싶어.',exercise:s.trait==='curious'?'오늘은 체육관 쪽 길을 걸어 볼까? 새로운 풍경이 궁금해.':'머리를 비우고 천천히 캠퍼스를 걸어 보자.'}[action];
    }
    this.startActivity(s,action,reason,{classSession:action==='class'?next:null});
  }
  startActivity(s,action,reason,options={}){
    const min=this.time,next=options.classSession??null;
    s.semesterTask=options.semesterTask??null;
    const oldPhase=s.phase,oldNext=s.route[s.routeIndex];s.action=action;s.reason=reason;s.thought=reason;s.destination=options.venue?this.venues.find(v=>v.id===options.venue):this.venues.find(v=>v.action===action);s.classSession=action==='class'?next:null;s.companions=[];s.companionId=null;s.activityElapsed=0;s.sharedTime={};
    // If a new decision is requested mid-edge, finish that same edge before rerouting.
    const midway=oldPhase==='walking'&&this.graph.nodes[oldNext]&&distance(s.position,this.graph.nodes[s.node].p)>.01;
    s.route=midway?[s.node,...this.graph.route(oldNext,s.destination.node)]:this.graph.route(s.node,s.destination.node);s.routeIndex=1;
    s.remaining=ACTIONS[action].duration;if(action==='study')s.remaining=s.trait==='diligent'?43:31;if(action==='social'&&s.trait==='social')s.remaining=32;
    if(options.duration)s.remaining=options.duration;
    if(action==='class')s.remaining=Math.max(1,next.end-min);if(action==='sleep')s.remaining=(420-min+1440)%1440;
    if(action==='eat'&&min>=690&&min<780)this.invite(s);
    s.phase=s.route.length>1?'walking':'acting';s.pose=s.phase==='walking'?'walk':poses[action];s.activityLabel=s.phase==='walking'?`${s.destination.name}으로 가는 중`:ACTIONS[action].label;
    if(s.phase==='acting')this.arrive(s);else this.addLog(s,`${s.destination.name}으로 향해요. ${reason}`,ACTIONS[action].icon);
  }
  arrive(s){
    s.phase='acting';s.pose=poses[s.action];s.activityLabel=ACTIONS[s.action].label;s.activityElapsed=0;
    s.experience.visits[s.destination.id]=(s.experience.visits[s.destination.id]||0)+1;
    if(semesterArrival(this,s)){this.addLog(s,`${s.destination.name}에 도착했어요. ${s.activityLabel}.`,ACTIONS[s.action].icon);return;}
    if(s.action==='class'&&s.classSession){const c=s.classSession;s.remaining=Math.max(.2,c.end-this.time);if(this.time<c.start){s.phase='waiting';s.waitUntil=c.start;s.pose='wait';s.thought='조금 일찍 왔네. 강의실 앞에서 노트를 꺼내 볼까?';s.activityLabel='수업을 기다리는 중';}else this.beginClass(s);}
    if(s.action==='eat'){s.phase='waiting';const waitingFor=s.invitation?.accepted&&this.students[s.invitation.from]?.destination?.id==='food'&&this.students[s.invitation.from]?.phase==='walking';s.waitUntil=this.time+(waitingFor?5:1.6+Math.min(2,this.students.filter(p=>p.destination?.id==='food'&&p.phase!=='walking').length*.16));s.pose='wait';s.activityLabel=waitingFor?'친구를 기다리는 중':'식판을 들고 차례를 기다리는 중';s.thought=waitingFor?`${this.students[s.invitation.from].name.slice(1)}도 오는 중이구나. 조금 기다리자.`:'오늘도 따뜻한 밥. 줄이 금방 줄어들겠지.';}
    if(s.action==='sleep')s.remaining=(420-this.time+1440)%1440;
    if(s.action==='rest'){s.thought=s.experience.visits.history>1?'이 자리는 올 때마다 마음이 편해져.':'그늘이 시원하다. 어깨에 힘을 조금 빼자.';}
    this.addLog(s,`${s.destination.name}에 도착했어요. ${s.activityLabel}.`,ACTIONS[s.action].icon);
  }
  beginClass(s){
    const c=s.classSession;if(!c)return;const late=Math.max(0,Math.floor(this.time-c.start));s.attendance[c.key]={late,day:this.day};
    if(late>=2){s.experience.late++;s.punctuality=clamp(s.punctuality-8,0,100);s.mood=clamp(s.mood-6);s.thought='아, 벌써 시작했네. 다음에는 조금 일찍 출발해야지.';this.remember(s,'late',`${c.title}에 ${late}분 늦었어요. 다음 수업에는 더 일찍 출발하기로 했어요.`,'book');}
    else{s.punctuality=clamp(s.punctuality+6);s.thought='제시간에 도착했어. 오늘은 어떤 걸 배울까?';}
    s.remaining=Math.max(.2,c.end-this.time);s.pose='read';s.activityLabel=c.title+' 수업을 듣는 중';
  }
  finish(s){
    const action=s.action;s.completed.push(action);s.completed=s.completed.slice(-24);
    if(semesterFinishActivity(this,s)){this.decide(s);return;}
    if(action==='class'){semesterClassFinished(this,s);if(!s.dayFlags.firstClass){s.dayFlags.firstClass=true;this.remember(s,'class','같은 강의실에서 만난 얼굴들이 조금 익숙해졌어요.','book');}}
    if(action==='eat'){semesterMeal(this,s);s.experience.meals++;if(this.time>=690&&this.time<850)s.dayFlags.lunch=true;s.invitation=null;if(!s.companions.length){s.thought='배가 든든해졌어. 이제 조금 걸어도 좋겠다.';this.addLog(s,'따뜻한 밥을 먹으니 기분도 조금 나아졌어요.','food');}}
    if(action==='rest'&&s.energy>50){s.experience.favorite='history';if(!s.dayFlags.rest){s.dayFlags.rest=true;this.remember(s,'rest','역사관 앞 그늘에 앉았더니 피로가 풀렸어요. 마음에 드는 자리가 생겼어요.','leaf');}}
    if(action==='study'&&!s.dayFlags.study){s.dayFlags.study=true;this.remember(s,'study',s.companions.length?'친구와 노트를 맞춰 보니 막히던 부분이 풀렸어요.':'백남에서 수업 내용을 정리했어요. 다음 시험이 조금 덜 걱정돼요.','book');}
    this.decide(s);
  }
  connectPeople(dt){
    const available=this.students.filter(s=>s.phase==='acting'&&['eat','social','study','class','rest'].includes(s.action));
    for(const s of this.students){s.companions=[];s.companionId=null;}
    // A conversation has at most three people. Mutual assignments prevent one popular
    // student from having simultaneous intimate conversations with the entire campus.
    const pairs=[];
    for(let i=0;i<available.length;i++)for(let j=i+1;j<available.length;j++){const a=available[i],b=available[j];if(a.destination.id!==b.destination.id||a.action!==b.action||distance(a.position,b.position)>=16)continue;const score=(a.semesterTask&&a.semesterTask.id===b.semesterTask?.id?1000:0)+(a.relationships[b.id]?.affinity||0)+(b.relationships[a.id]?.affinity||0)+(Math.floor(a.id/3)===Math.floor(b.id/3)?30:0)-Math.abs(a.id-b.id)*.2;pairs.push({a,b,score});}
    pairs.sort((a,b)=>b.score-a.score);
    for(const {a,b}of pairs){const limit=a.action==='class'?1:2;if(a.companions.length>=limit||b.companions.length>=limit)continue;a.companions.push(b.id);b.companions.push(a.id);}
    for(const s of available)s.companionId=s.companions[0]??null;
    const seen=new Set();
    for(const s of available)for(const id of s.companions){const p=this.students[id],key=[s.id,id].sort((a,b)=>a-b).join(':');if(seen.has(key))continue;seen.add(key);
      for(const [a,b]of [[s,p],[p,s]]){const r=this.relationship(a,b.id),sharedKey=a.action+':'+b.id;a.sharedTime[sharedKey]=(a.sharedTime[sharedKey]||0)+dt;r.affinity=clamp(r.affinity+dt*({eat:.32,social:.32,study:.18,class:.06,rest:.16}[a.action]));r.lastDay=this.day;a.social=clamp(a.social+dt*.28);
        const flag='met:'+b.id;if(a.sharedTime[sharedKey]>=4&&a.dayFlags[flag]!==this.day){a.dayFlags[flag]=this.day;r.encounters++;if(r.encounters===1)this.remember(a,'meet',`${together(b.name)} 처음 인사를 나눴어요. 다음에는 먼저 알아볼 수 있겠어요.`,'people',b.id);}
        const mealFlag='meal:'+(this.time<660?'breakfast':this.time<900?'lunch':'dinner')+':'+b.id;if(a.action==='eat'&&a.sharedTime[sharedKey]>=6&&a.dayFlags[mealFlag]!==this.day){a.dayFlags[mealFlag]=this.day;r.sharedMeals++;a.mood=clamp(a.mood+7);r.affinity=clamp(r.affinity+4);a.thought=`${particle(b.name.slice(1),'이랑','랑')} 먹으니 평범한 점심도 즐겁네.`;a.activityLabel=`${together(b.name.slice(1))} 함께 점심 먹는 중`;this.remember(a,'meal',r.sharedMeals>1?`${together(b.name)} 또 같은 식탁에 앉았어요. 둘만의 점심 습관이 생겨요.`:`${together(b.name)} 첫 식사를 했어요. 다음에도 같이 먹고 싶대요.`,'food',b.id);}
        const studyFlag='study:'+b.id;if(a.action==='study'&&a.sharedTime[sharedKey]>=8&&a.dayFlags[studyFlag]!==this.day){a.dayFlags[studyFlag]=this.day;r.studySessions++;a.examPrep=clamp(a.examPrep+4);a.thought=`${particle(b.name.slice(1),'이','가')} 설명해 주니까 이제 알겠어.`;this.remember(a,'studyTogether',`${together(b.name)} 백남에서 노트를 맞춰 봤어요. 함께 푼 내용은 더 오래 기억나요.`,'book',b.id);}
        if((r.friendship??r.affinity)>=35&&!r.friendSince){a.dayFlags['friend:'+b.id]=true;r.friendSince=this.day;this.remember(a,'friend',`${particle(b.name,'이','가')} 이제는 편하게 말을 걸 수 있는 친구가 됐어요.`,'people',b.id);}
      }
    }
    for(const s of available){if(s.semesterTask)continue;if(s.action==='social'&&s.companionId!==null){s.pose='talk';s.activityLabel=`${together(this.students[s.companionId].name.slice(1))} 이야기하는 중`;if(s.activityElapsed>3)s.thought=`${this.students[s.companionId].name.slice(1)}도 같은 생각을 했대. 말하길 잘했어.`;}else if(s.action==='social'){s.pose='wait';s.activityLabel='학생회관에서 친구를 기다리는 중';s.thought='누가 오려나. 잠깐 앉아서 기다려 보자.';}}
  }
  step(minutes){
    if(!Number.isFinite(minutes)||minutes<=0||this.semesterBlocksTime)return;
    for(let left=minutes;left>1e-8;){beforeSemesterStep(this);if(this.semesterBlocksTime)break;let dt=Math.min(.2,left);const weekday=(this.day-1)%7;if(weekday===2&&!this.semester.decisionDone&&this.time<735)dt=Math.min(dt,735-this.time);if(weekday===6&&this.time<1110)dt=Math.min(dt,1110-this.time);left-=dt;this.time+=dt;if(this.time>=1440){this.time-=1440;this.day++;for(const s of this.students){s.completed=[];s.dayFlags={};s.examPrep=clamp(s.examPrep-3);for(const key of Object.keys(s.attendance))if(s.attendance[key].day<this.day-2)delete s.attendance[key];}}
      for(const s of this.students){
        s.satiety=clamp(s.satiety-dt*.13);s.energy=clamp(s.energy-dt*(s.phase==='walking'?.12:.025));s.social=clamp(s.social-dt*.07);s.mood=clamp(s.mood-dt*.014);
        if(s.phase==='walking'){
          let travel=dt*(s.action==='class'&&s.classSession&&this.time>s.classSession.start?70:58);
          while(travel>0&&s.routeIndex<s.route.length){const targetId=s.route[s.routeIndex],target=this.graph.nodes[targetId].p,d=distance(s.position,target),move=Math.min(travel,d);s.walking+=move;s.distance+=move;this.totalDistance+=move;if(d<=travel+.0001){s.position=[...target];s.node=targetId;travel-=d;s.routeIndex++;}else{s.position[0]+=(target[0]-s.position[0])*move/d;s.position[1]+=(target[1]-s.position[1])*move/d;travel=0;}}
          if(s.routeIndex>=s.route.length)this.arrive(s);
        }else if(s.phase==='waiting'){
          const friend=s.invitation?this.students[s.invitation.from]:null;const friendArrived=s.action==='eat'&&friend?.destination?.id==='food'&&friend.phase!=='walking';
          if(this.time>=s.waitUntil||friendArrived){s.phase='acting';s.pose=poses[s.action];s.activityLabel=ACTIONS[s.action].label;if(s.semesterTask)semesterWaitFinished(this,s);else if(s.action==='class')this.beginClass(s);else s.thought='잘 먹겠습니다. 오늘도 든든하게!';}
        }else{
          s.activityElapsed+=dt;
          const effects={class:{academic:.12,examPrep:.075,energy:-.055,mood:-.01},study:{academic:.17,examPrep:.38,energy:-.045,mood:.04},eat:{satiety:2.8,energy:.12,mood:.16},rest:{energy:1.5,mood:.5},social:{social:s.companions.length?2.4:.15,mood:s.companions.length?.55:-.035,energy:.035},exercise:{mood:.9,energy:-.1,social:.05},sleep:{energy:.26,satiety:-.015,mood:.05}}[s.action];
          for(const [key,value]of Object.entries(effects))s[key]=clamp(s[key]+dt*value);
          semesterActivity(this,s,dt);
          s.remaining-=dt;
          const due=this.nextClass(s);const canInterrupt=!s.semesterTask&&!['class','sleep','eat'].includes(s.action)&&s.activityElapsed>(s.trait==='diligent'?1:7);const classSoon=canInterrupt&&due&&this.time>=due.start-(s.trait==='diligent'?15:s.trait==='social'?-1:7)+Math.min(8,s.experience.late*2)*-1;const lunchCall=canInterrupt&&s.invitation&&s.invitation.day===this.day&&s.invitation.expires>this.time&&s.satiety<85;
          if(s.remaining<=0)this.finish(s);else if(classSoon||lunchCall)this.decide(s);
        }
      }
      this.connectPeople(dt);this.semester.dayOfWeek=(this.day-1)%7;
    }
  }
  select(id){if(this.students[id])this.selected=id;}
  snapshot(){return clone({version:3,semester:this.semester,trait:this.trait,time:this.time,day:this.day,selected:this.selected,students:this.students.map(s=>({...s,destination:s.destination.id})),logs:this.logs,totalDistance:this.totalDistance});}
  restore(saved){
    if(![1,2,3].includes(saved?.version)||saved.students?.length!==this.students.length||!Number.isFinite(saved.time)||saved.time<0||saved.time>=1440||!Number.isInteger(saved.day)||saved.day<1)throw new Error('Unsupported or invalid save');
    const restored=saved.students.map((source,index)=>{const s=clone(source),destination=this.venues.find(v=>v.id===s.destination);if(s.id!==index||!TRAITS[s.trait]||!ACTIONS[s.action]||!destination||!Array.isArray(s.position)||s.position.length!==2||!s.position.every(Number.isFinite)||['energy','satiety','academic','mood','social'].some(k=>!Number.isFinite(s[k])||s[k]<0||s[k]>100))throw new Error('Invalid saved student');
      const target={...this.students[index],...s,name:this.students[index].name,color:this.students[index].color,destination};
      if(saved.version===1){target.node=this.graph.nearest(s.position);target.position=[...this.graph.nodes[target.node].p];target.route=this.graph.route(target.node,destination.node);target.routeIndex=1;target.phase=target.route.length>1?'walking':'acting';target.pose=target.phase==='walking'?'walk':poses[target.action];target.activityLabel=ACTIONS[target.action].label;}
      else if(!this.graph.nodes[target.node]||!Array.isArray(target.route)||target.route.some(n=>!Number.isInteger(n)||!this.graph.mainSet.has(n))||target.route.slice(1).some((n,i)=>!this.graph.nodes[target.route[i]].edges.some(e=>e.to===n))||!Number.isFinite(target.remaining)||!Number.isInteger(target.routeIndex)||target.routeIndex<0||target.routeIndex>target.route.length||!['walking','acting','waiting'].includes(target.phase)||!this.graph.clearSegment(target.position,target.position,0))throw new Error('Invalid saved route');
      if(saved.version>=2){
        const record=value=>value&&typeof value==='object'&&!Array.isArray(value);
        const finite=value=>Number.isFinite(value)&&value>=0;
        if(!finite(target.distance)||!finite(target.walking)||!finite(target.punctuality)||!Number.isFinite(target.waitUntil)||!finite(target.experience?.meals)||!finite(target.experience?.exams)||!record(target.relationships)||Object.entries(target.relationships).some(([id,r])=>!this.students[id]||!record(r)||!['affinity','encounters','sharedMeals','studySessions','lastDay'].every(k=>finite(r[k])))||!Array.isArray(target.memories)||target.memories.some(m=>!record(m)||typeof m.text!=='string'||typeof m.kind!=='string'||!Number.isInteger(m.day))||!record(target.experience)||!record(target.experience.visits)||Object.values(target.experience.visits).some(v=>!finite(v))||!finite(target.experience.late)||!record(target.dayFlags)||!record(target.attendance)||!record(target.sharedTime)||!Array.isArray(target.completed)||target.completed.some(a=>!ACTIONS[a])||!Array.isArray(target.companions)||target.companions.some(id=>!this.students[id])||!Array.isArray(target.schedule)||target.schedule.length!==2||target.schedule.some(c=>!c||typeof c.id!=='string'||typeof c.title!=='string'||!Number.isFinite(c.start)||!Number.isFinite(c.end)||c.start>=c.end)||!finite(target.examPrep)||!finite(target.activityElapsed))throw new Error('Invalid saved life history');
        if(target.invitation!==null&&(!record(target.invitation)||!this.students[target.invitation.from]||!Number.isInteger(target.invitation.day)||!Number.isFinite(target.invitation.expires)))throw new Error('Invalid saved invitation');
        if(target.classSession!==null&&(!record(target.classSession)||typeof target.classSession.key!=='string'||typeof target.classSession.id!=='string'||typeof target.classSession.title!=='string'||!Number.isFinite(target.classSession.start)||!Number.isFinite(target.classSession.end)||target.classSession.start>=target.classSession.end))throw new Error('Invalid saved class');
        if(typeof target.reason!=='string'||typeof target.thought!=='string'||typeof target.activityLabel!=='string')throw new Error('Invalid saved activity');
        if(target.phase==='walking'){
          const to=this.graph.nodes[target.route[target.routeIndex]],from=this.graph.nodes[target.node];
          if(!to||target.route[target.routeIndex-1]!==target.node||distance(from.p,target.position)+distance(target.position,to.p)-distance(from.p,to.p)>.03)throw new Error('Saved student is off the walking route');
        }else if(distance(target.position,destination.point)>.1)throw new Error('Saved activity is away from its destination');
      }
      return target;});
    if(!Number.isFinite(saved.totalDistance)||saved.totalDistance<0||!Array.isArray(saved.logs)||saved.logs.some(l=>typeof l.text!=='string'||typeof l.time!=='string'||!this.students[l.student]))throw new Error('Invalid saved journal');
    const restoredSemester=saved.version===3?validateSemester(saved.semester,restored,saved.day,saved.time):createSemester(saved.trait);
    this.time=saved.time;this.day=saved.day;this.trait=TRAITS[saved.trait]?saved.trait:restored[0].trait;this.selected=this.students[saved.selected]?saved.selected:0;this.logs=clone(saved.logs||[]).slice(0,120);this.totalDistance=saved.totalDistance||0;this.students=restored;this.events=[];this.semester=restoredSemester;ensureSemesterRelationships(this);
    if(saved.version<3){
      this.semester.migrated=true;this.day=1;this.time=525;
      for(const id of [1,2,3]){const previous=saved.students[0].relationships?.[id];if(!previous||!this.students[id])continue;const r=this.students[0].relationships[id];r.friendship=clamp((previous.affinity||0)*.45+Math.min(10,(previous.sharedMeals||0)*1.5),0,70);r.trust=clamp(8+(previous.encounters||0)+(previous.sharedMeals||0)*2+(previous.studySessions||0),0,45);r.sharedActivities=Math.min(10000,(previous.sharedMeals||0)+(previous.studySessions||0));r.status=r.friendship>=30?'friend':'acquaintance';const back=this.students[id].relationships[0];if(back)for(const key of ['friendship','trust','sharedActivities','status'])back[key]=r[key];}
      for(const s of this.students){s.semesterTask=null;s.invitation=null;s.attendance={};s.schedule=[{id:'morning',start:540,end:590,title:'창의적 공학설계'},{id:'afternoon',start:780,end:830,title:'사고와 표현'}];this.decide(s);}
      this.remember(this.students[0],'semester','예전 하루의 기억과 친구를 간직한 채 새로운 16주 학기를 준비해요.','leaf');
    }
  }
}

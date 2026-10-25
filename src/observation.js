/** Quiet, deterministic direction for a student whose life the player observes. */
export const OBSERVATION_WISHES={
  scholar:{title:'궁금한 것을 끝까지 알아가고 싶어',description:'혼자 품었던 질문이 함께 배우는 시간과 작은 자신감으로 이어져요.'},
  friendship:{title:'편하게 웃을 친구가 생겼으면',description:'먼저 건넨 인사와 평범한 점심이 오래 믿을 수 있는 사이가 돼요.'},
  romance:{title:'서로 좋아하는 마음을 만나고 싶어',description:'서두르지 않고 알아가며, 서로 동의하는 마음과 함께할 시간을 찾아요.'},
  independent:{title:'내 생활을 스스로 꾸리고 싶어',description:'작은 근무와 생활의 선택을 거치며 나를 돌볼 여유를 만들어 가요.'},
};
const clone=value=>JSON.parse(JSON.stringify(value));
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const npcNames={1:'도윤',2:'서연',3:'지우'};
const together=name=>name+((name.charCodeAt(name.length-1)-44032)%28?'과':'와');
const current=sim=>sim.students[0];
const relationships=sim=>[1,2,3].map(id=>({id,...current(sim).relationships[id]}));
const relationship=(sim,id)=>current(sim).relationships[id];
const roles={study:'백남에서 노트를 펼치기',club:'학생회관에서 함께 만들기',work:'학생복지관에서 맡은 일 하기',friend:'역사관 앞에서 이야기 나누기',rest:'익숙한 그늘에서 쉬어 가기'};
const milestoneIds={scholar:['first-study','shared-notes','project-piece','first-exam','wish-realized'],friendship:['first-hello','shared-table','trusted-friend','friend-circle','wish-realized'],romance:['first-time','safe-trust','mutual-feelings','three-dates','wish-realized'],independent:['first-shift','own-money','standing-up','breathing-room','wish-realized']};
export function createObservation(sim,preferredId){
  const st=sim.semester;return{version:1,enabled:true,wishGoal:st.goal,preferredId,startedDay:sim.day,startedWeek:st.week,plans:[],choices:[],achieved:{},activityMinutes:{class:0,study:0,club:0,work:0,friend:0,rest:0,eat:0},earnedMoney:st.ledger.filter(l=>l.reason==='교내 아르바이트').reduce((n,l)=>n+Math.max(0,l.amount),0),recentMoment:null,lastEncouragement:null,pendingEncouragement:null,supportApplied:[],lastPlanReason:'',nextProgressAt:0,lastMomentDay:0};
}
function milestones(sim){
  const st=sim.semester,o=st.observation,rels=relationships(sim),focus=relationship(sim,st.focusId),name=npcNames[st.focusId];
  const max=k=>Math.max(0,...rels.map(r=>r[k]||0));const full=st.phase==='complete'&&st.ending?.success;
  const item=(id,title,detail,value)=>({id,title,detail,value:clamp(value)});
  if(st.goal==='scholar')return[
    item('first-study','백남에서 처음 펼친 노트','궁금했던 내용을 스스로 찾아 읽었어요.',current(sim).memories.some(m=>m.kind==='study')?1:(o?.activityMinutes.study||0)/25),
    item('shared-notes','같이 풀어 본 작은 질문','혼자 막혔던 부분을 친구와 노트를 맞춰 보며 배웠어요.',max('studySessions')),
    item('project-piece','내가 만든 과제의 한 조각','실제 복습과 협업이 손에 잡히는 결과물로 남기 시작했어요.',Math.max(...st.courses.map(c=>c.project))/25),
    item('first-exam','시험장에서 떠오른 배움','함께 공부했던 내용으로 첫 시험을 풀어 냈어요.',Math.max(0,...st.courses.map(c=>c.midterm||0))/55),
    item('wish-realized','한 학기만큼 자란 질문','112일의 배움이 나만의 자신감으로 남았어요.',full?1:0),
  ];
  if(st.goal==='friendship')return[
    item('first-hello','낯선 이름에 건넨 인사','같은 캠퍼스의 누군가와 처음 인사를 나눴어요.',max('encounters')),
    item('shared-table','함께 앉은 첫 식탁','평범한 밥 한 끼가 함께 기억하는 장면이 됐어요.',max('sharedMeals')),
    item('trusted-friend','먼저 떠오르는 친구','편하게 이야기하고 서로를 믿는 사람이 생겼어요.',Math.max(...rels.map(r=>Math.min((r.friendship||0)/35,(r.trust||0)/20)))),
    item('friend-circle','함께 웃을 우리','각자 다른 두 사람과 오랜 시간을 쌓았어요.',rels.filter(r=>r.friendship>=55&&r.trust>=35).length/2),
    item('wish-realized','캠퍼스에 남은 내 편','처음의 작은 인사가 한 학기의 우정이 되었어요.',full?1:0),
  ];
  if(st.goal==='romance')return[
    item('first-time','조금 더 알고 싶은 사람','같은 장소에서 함께 시간을 보내며 서로를 알아봤어요.',max('sharedActivities')),
    item('safe-trust','서두르지 않아도 괜찮아','작은 약속을 지키며 솔직하게 말할 수 있는 사이가 되었어요.',Math.min((focus?.friendship||0)/30,(focus?.trust||0)/25)),
    item('mutual-feelings','서로 확인한 마음','충분히 알아간 뒤, 두 사람이 같은 마음에 동의했어요.',rels.some(r=>r.status==='dating')?1:0),
    item('three-dates','우리만 아는 익숙한 길','연인이 된 뒤에도 실제로 만나 세 번의 데이트를 쌓았어요.',max('dates')/3),
    item('wish-realized','함께 걸은 한 계절','서로의 속도를 존중하며 한 학기를 함께 걸었어요.',full?1:0),
  ];
  return[
    item('first-shift','처음 맡아 본 내 일','학생복지관에서 맡은 일을 직접 해냈어요.',(o?.activityMinutes.work||0)/25),
    item('own-money','내가 마련한 생활비','실제 근무로 번 돈이 내 생활의 일부가 됐어요.',(o?.earnedMoney||0)/100000),
    item('standing-up','조금은 익숙해진 어른의 하루','근무와 회복을 스스로 챙기는 힘이 자랐어요.',st.growth.independence/35),
    item('breathing-room','나를 돌볼 여유','생활비와 자립의 힘을 함께 쌓아 조금 숨을 돌릴 수 있어요.',Math.min(st.money/300000,st.growth.independence/65)),
    item('wish-realized','내 힘으로 살아 본 학기','열여섯 주의 작은 선택이 나를 지탱하는 힘이 되었어요.',full?1:0),
  ];
}
export function refreshObservation(sim,force=false,record=true){
  const st=sim.semester,o=st.observation;if(!o?.enabled)return;
  const absolute=sim.day*1440+sim.time;if(!force&&absolute<o.nextProgressAt)return;o.nextProgressAt=absolute+2;
  for(const m of milestones(sim)){
    if(o.achieved[m.id])continue;if(m.value<1)break;
    o.achieved[m.id]={day:sim.day,week:st.week,detail:m.detail};o.recentMoment={title:m.title,text:m.detail,day:sim.day,week:st.week};
    if(record)sim.remember(current(sim),'wish',`${m.title}. ${m.detail}`,'spark');
  }
}
export function observationView(sim){
  const st=sim.semester,o=st.observation;if(!o?.enabled)return{enabled:false,wish:OBSERVATION_WISHES[st.goal],nextStep:'어떤 하루를 살고 싶은지 작은 바람 하나를 골라 주세요.',progress:0,milestones:[],recentMoment:null,canEncourage:false,lastEncouragement:null};
  const list=milestones(sim).map(m=>{const done=o.achieved[m.id];return{id:m.id,title:m.title,detail:done?.detail||m.detail,done:Boolean(done),...(done?{day:done.day,week:done.week}:{})};});
  const fractions=milestones(sim).map(m=>o.achieved[m.id]?1:m.value*.8);
  return{enabled:true,wish:OBSERVATION_WISHES[o.wishGoal],nextStep:nextObservationStep(sim),progress:clamp(fractions.reduce((n,v)=>n+v,0)/fractions.length),milestones:list,recentMoment:clone(o.recentMoment),canEncourage:st.phase!=='complete'&&o.lastEncouragement?.week!==st.week&&!o.pendingEncouragement,lastEncouragement:clone(o.lastEncouragement)};
}
export function nextObservationStep(sim){
  const st=sim.semester,o=st.observation,name=npcNames[st.focusId],r=relationship(sim,st.focusId);
  if(st.phase==='complete')return st.ending?.text||'한 계절의 장면들이 오래 기억에 남을 것 같아.';
  const next=st.commitments.filter(c=>!['completed','missed'].includes(c.status)&&(c.day>sim.day||c.day===sim.day&&c.end>=sim.time)).sort((a,b)=>a.day-b.day||a.start-b.start)[0];
  if(next?.conversation==='confess')return `${together(name)} 마주 앉아서, 서로 어떤 마음인지 천천히 이야기해 보고 싶어.`;
  if(next?.conversation==='date')return `${together(name)} 약속한 시간을 보내고 싶어. 익숙한 길도 같이 걸으면 다르겠지.`;
  if(next?.kind==='rest')return '오늘은 어깨에 힘을 조금 빼자. 그늘에서 쉬고 나면 다음 걸음이 가벼워질 거야.';
  if(next?.kind==='work')return '학생복지관에서 맡은 일을 끝내고, 이번 생활비는 내 손으로 조금 보태고 싶어.';
  if(next?.kind==='club')return `${together(name)} 학생회관에서 뭔가 같이 만들어 보고 싶어.`;
  if(next?.kind==='friend')return r?.status==='dating'?`${together(name)} 바쁜 하루 사이에도 잠깐 마주 앉고 싶어.`:`${together(name)} 역사관 앞에서 이야기하고 싶어. 오늘은 어떤 하루였을까?`;
  if(next?.kind==='study')return !o.achieved['shared-notes']&&st.goal==='scholar'?`${together(name)} 처음 노트를 맞춰 보고 싶어. 같이 보면 풀리는 문제가 있겠지.`:`백남에 가서 수업 중 궁금했던 부분을 조금 더 읽어 보고 싶어.`;
  if(sim.time>=1260||sim.time<420)return '오늘 있었던 일을 마음에 담고 푹 자자. 내일은 또 어떤 얼굴을 만날까?';
  return o.lastPlanReason||'평범한 하루 속에서 내게 소중한 장면을 조금씩 찾아가고 싶어.';
}
export function buildObservationPlan(sim){
  const st=sim.semester,o=st.observation,s=current(sim),trait=s.trait;
  let focusId=o.preferredId;
  if(st.goal==='friendship'){
    const order=trait==='diligent'?[1,2]:trait==='social'?[2,3]:[o.preferredId,o.preferredId===2?1:2];focusId=order[(st.week-1)%2];
    const other=order.find(id=>id!==focusId),r=relationship(sim,focusId),peer=relationship(sim,other);if(r.friendship>=70&&r.trust>=45&&(peer.friendship<55||peer.trust<35))focusId=other;
  }
  const partner=relationships(sim).find(r=>r.status==='dating');if(partner&&st.goal==='romance')focusId=partner.id;
  const r=relationship(sim,focusId),exam=[7,8,14,15,16].includes(st.week),tired=st.stress>=65||s.energy<35,poor=st.money<20000;
  const days=Array.from({length:7},(_,d)=>{
    let row;
    if(st.goal==='scholar')row=d<5?['study','study','study']:['study',trait==='social'?'friend':'rest','study'];
    else if(st.goal==='independent')row=d<5?['work','work','rest']:['work',trait==='diligent'?'study':trait==='social'?'club':'friend','rest'];
    else if(st.goal==='friendship')row=trait==='diligent'?['study','friend','friend']:trait==='curious'?['study','friend','club']:['friend','club','friend'];
    else if(r.status==='dating')row=trait==='diligent'?['study','friend','rest']:trait==='curious'?['study','friend',d%2?'rest':'club']:['club','friend','rest'];
    else row=trait==='diligent'?['study','friend','friend']:['friend','club','friend'];
    // Observable needs and prior results override the usual rhythm without asking the player.
    if(st.goal==='romance'&&focusId===3&&st.growth.independence<16&&d<4)row[0]='work';
    if(st.goal==='romance'&&focusId===1&&st.growth.knowledge<22&&d<4)row[0]='study';
    if(tired)row[2]='rest';
    if(poor&&d%2===0)row[0]='work';
    if(exam&&st.goal!=='scholar'&&d<3&&trait!=='social')row[0]='study';
    if(st.goal==='scholar'&&trait==='diligent'&&d===4&&!exam)row[2]='rest';
    if(st.goal==='friendship'&&d===6)row[2]=trait==='social'?'friend':'rest';
    return row;
  });
  const reason=tired?'이번 주에는 무리하지 않고, 해야 할 일 사이에 쉬는 시간을 챙기고 싶어.':poor?'지난번 식비가 빠듯했지. 이번에는 일을 조금 해 두고 마음 편히 밥을 먹고 싶어.':exam?'시험이 가까워졌네. 내 바람도 지키면서 헷갈린 부분을 조금씩 정리해 두자.':st.goal==='scholar'?`${together(npcNames[focusId])} 배운 것을 맞춰 보고 싶어. 매일 작은 질문 하나씩은 풀어 보자.`:st.goal==='independent'?'내 생활비를 조금씩 마련하되, 지치기 전에 쉬는 시간도 챙겨야지.':st.goal==='romance'?`${together(npcNames[focusId])} 조금 더 알아가고 싶어. 서로 편안한 속도로 만나자.`:`이번 주에는 ${together(npcNames[focusId])} 자주 마주 앉아 보고 싶어. 사소한 이야기부터 나누자.`;
  return{days,focusId,goal:st.goal,reason};
}
export function chooseObservationDecision(sim){
  const st=sim.semester,o=st.observation,ids=st.decision.options.map(v=>v.id),r=relationship(sim,st.focusId),s=current(sim);
  const has=id=>ids.includes(id),select=(id,reason)=>({id,reason});
  if((st.stress>70||s.energy<30)&&has('recover'))return select('recover','지금은 잘하려고 애쓰기보다 몸을 돌보는 게 먼저겠어.');
  if((st.stress>70||s.energy<30)&&has('steady'))return select('steady','잠깐 쉬고 들어가야 배운 것이 차분히 떠오를 것 같아.');
  if(has('date')&&r.status==='dating')return select('date',`${together(npcNames[st.focusId])} 약속한 시간을 실제로 함께 보내고 싶어.`);
  if(has('confess')){
    const minimum={1:['knowledge',20],2:['expression',20],3:['independence',15]}[st.focusId],ready=r.friendship>=45&&r.trust>=35&&r.romance>=20&&r.sharedActivities>=5&&st.week>=r.declinedUntil&&st.growth[minimum[0]]>=minimum[1];
    if(st.goal==='romance'&&ready&&!relationships(sim).some(x=>x.status==='dating'&&x.id!==st.focusId))return select('confess','함께 보낸 시간 덕분에 솔직해질 용기가 생겼어. 상대의 대답도 존중하면서 이야기하자.');
    return select('spend-time','마음을 서두르지 말고, 오늘도 서로의 이야기를 조금 더 들어 보자.');
  }
  if(has('extra-work'))return select(st.money<100000||st.goal==='independent'?'extra-work':'recover',st.money<100000||st.goal==='independent'?'이번 생활비는 내가 조금 더 보태 두고 싶어.':'당장 충분한 만큼, 오늘은 내 몸을 돌보자.');
  if(has('cram'))return select(st.stress>50?'steady':'cram',st.stress>50?'마음을 가라앉히고 평소처럼 시험을 보자.':'아직 헷갈리는 부분이 있어. 잠깐이라도 직접 노트를 펼쳐 보자.');
  if(has('lead'))return select(st.goal==='scholar'||s.trait==='diligent'?'lead':'support',st.goal==='scholar'||s.trait==='diligent'?'자료를 직접 정리해 보면 궁금했던 내용도 더 잘 알게 되겠지.':'함께 만든 내용을 다른 사람에게 설명하는 역할을 해 보고 싶어.');
  if(has('join'))return select('join','작은 역할부터 맡아 보면 자주 만날 얼굴들이 생기겠지.');
  if(has('host'))return select(st.goal==='romance'?'date':st.stress>65?'quiet':'host',st.goal==='romance'?'오늘의 가을 풍경을 함께 기억하고 싶어.':st.stress>65?'오늘은 조용히 쉬면서 축제의 소리를 들으면 좋겠어.':'누군가와 함께 만든 축제로 기억하고 싶어.');
  if(has('routine')&&st.goal==='scholar')return select('routine','오늘은 백남에서 내 질문을 한 번 더 붙잡아 보고 싶어.');
  if(has('introduce'))return select('introduce',`${npcNames[st.focusId]}에게 먼저 말을 걸어 보고 싶어. 처음엔 작은 인사면 충분하겠지.`);
  return select(ids[0],'지금 내 마음과 상황에 맞는 작은 선택부터 해 보자.');
}
export function observationTaskReason(sim,c,role){
  if(role==='partner')return `${together(current(sim).name.slice(1))} 만나기로 했지. 기다리게 하지 말아야겠다.`;
  if(c.encouraged==='rest')return '쉬어도 괜찮다는 말을 들으니 마음이 놓였어. 이번에는 정말 그늘에 앉아 쉬어 가자.';
  if(c.encouraged==='connect')return '누군가에게 먼저 말을 걸어 봐도 좋겠지. 친구 얼굴을 보면 반가울 것 같아.';
  if(c.encouraged==='believe')return '나를 믿어 준다는 말이 생각나네. 이번 일은 조금 더 차분히 해 보고 싶어.';
  if(c.conversation==='confess')return '충분히 알아간 것 같아. 내 마음을 말하되, 상대의 대답도 천천히 듣자.';
  if(c.conversation==='date')return `${together(npcNames[sim.semester.focusId])} 오늘도 약속한 시간을 함께 보내고 싶어.`;
  return{study:'수업에서 생긴 질문이 아직 남아 있어. 백남에서 노트를 펼쳐 보자.',club:'혼자 떠올린 생각을 친구들과 같이 만들어 보면 어떨까?',work:'이번 생활비는 내 손으로 조금 보태고 싶어. 맡은 일을 차근차근 해 보자.',friend:`${together(npcNames[sim.semester.focusId])} 잠깐 마주 앉고 싶어. 오늘은 무슨 이야기를 들려줄까?`,rest:'무리하지 않아도 괜찮아. 익숙한 나무 그늘에서 어깨에 힘을 빼자.'}[c.kind];
}
export function encourageObservation(sim,kind){
  const o=sim.semester.observation;if(!o?.enabled||sim.semester.phase==='complete')throw new Error('지금은 응원을 건넬 수 없어요.');
  if(!['rest','connect','believe'].includes(kind))throw new Error('건네고 싶은 응원을 다시 골라 주세요.');
  if(o.lastEncouragement?.week===sim.semester.week||o.pendingEncouragement)throw new Error('이번 주의 응원은 이미 마음에 담았어요.');
  o.lastEncouragement={kind,week:sim.semester.week};o.pendingEncouragement={kind,week:sim.semester.week};
}
export function applyObservationEncouragement(sim,c){
  const o=sim.semester.observation,pending=o?.pendingEncouragement;if(!o?.enabled||!pending||c.slot>=3)return;
  c.encouraged=pending.kind;
  if(pending.kind==='rest'){c.kind='rest';c.partnerId=null;c.alone=true;c.conversation=null;}
  if(pending.kind==='connect'){c.kind='friend';c.partnerId=sim.semester.focusId;c.alone=false;}
  if(pending.kind==='believe'){c.end+=5;c.duration+=5;}
  o.supportApplied.push({kind:pending.kind,week:pending.week,day:sim.day,commitmentId:c.id});o.pendingEncouragement=null;
}
export function observeActivity(sim,s,dt,c){
  const o=sim.semester.observation;if(!o?.enabled||s.id!==0)return;const kind=c?.kind??(s.action==='social'?'friend':s.action);if(Object.hasOwn(o.activityMinutes,kind))o.activityMinutes[kind]+=dt;refreshObservation(sim);
}
export function observeFinishedTask(sim,c){
  const st=sim.semester,o=st.observation;if(!o?.enabled)return;if(c.paid)o.earnedMoney+=c.paid;
  if(c.status==='completed'&&o.lastMomentDay!==sim.day){o.lastMomentDay=sim.day;o.recentMoment={title:c.conversation==='date'?'함께 걸은 오늘의 길':roles[c.kind],text:c.outcome,day:sim.day,week:st.week};}
  refreshObservation(sim,true);
}
export function validateObservation(o,st,day){
  if(o===undefined||o===null)return;
  const record=v=>v&&typeof v==='object'&&!Array.isArray(v),num=(v,a=0,b=Infinity)=>Number.isFinite(v)&&v>=a&&v<=b,integer=(v,a,b)=>Number.isInteger(v)&&v>=a&&v<=b;
  const keys=['version','enabled','wishGoal','preferredId','startedDay','startedWeek','plans','choices','achieved','activityMinutes','earnedMoney','recentMoment','lastEncouragement','pendingEncouragement','supportApplied','lastPlanReason','nextProgressAt','lastMomentDay'];
  if(!record(o)||Object.keys(o).some(k=>!keys.includes(k))||o.version!==1||o.enabled!==true||!Object.hasOwn(OBSERVATION_WISHES,o.wishGoal)||o.wishGoal!==st.goal||![1,2,3].includes(o.preferredId)||!integer(o.startedDay,1,day)||!integer(o.startedWeek,1,st.week)||!record(o.activityMinutes)||!['class','study','club','work','friend','rest','eat'].every(k=>num(o.activityMinutes[k],0,161280))||!num(o.earnedMoney,0,1e8)||!record(o.achieved)||!num(o.nextProgressAt,0,200000)||!integer(o.lastMomentDay,0,day)||typeof o.lastPlanReason!=='string')throw new Error('Invalid observation state');
  if(Object.entries(o.achieved).some(([id,a])=>!milestoneIds[o.wishGoal].includes(id)||!record(a)||!integer(a.day,1,day)||!integer(a.week,1,st.week)||typeof a.detail!=='string'))throw new Error('Invalid observed milestones');
  if(!Array.isArray(o.plans)||o.plans.length>16||o.plans.some(p=>!record(p)||!integer(p.week,1,st.week)||![1,2,3].includes(p.focusId)||typeof p.reason!=='string'||!Array.isArray(p.days)||p.days.length!==7||p.days.some(row=>!Array.isArray(row)||row.length!==3||row.some(k=>!Object.hasOwn(roles,k)))))throw new Error('Invalid autonomous plan history');
  if(!Array.isArray(o.choices)||o.choices.length>16||o.choices.some(c=>!record(c)||!integer(c.week,1,st.week)||!integer(c.day,1,day)||typeof c.id!=='string'||typeof c.reason!=='string'))throw new Error('Invalid autonomous choice history');
  for(const value of [o.lastEncouragement,o.pendingEncouragement])if(value!==null&&(!record(value)||!['rest','connect','believe'].includes(value.kind)||!integer(value.week,1,st.week)))throw new Error('Invalid encouragement');
  if(!Array.isArray(o.supportApplied)||o.supportApplied.length>16||o.supportApplied.some(v=>!record(v)||!['rest','connect','believe'].includes(v.kind)||!integer(v.week,1,st.week)||!integer(v.day,1,day)||typeof v.commitmentId!=='string'))throw new Error('Invalid applied encouragement');
  if(o.recentMoment!==null&&(!record(o.recentMoment)||typeof o.recentMoment.title!=='string'||typeof o.recentMoment.text!=='string'||!integer(o.recentMoment.day,1,day)||!integer(o.recentMoment.week,1,st.week)))throw new Error('Invalid observed moment');
}

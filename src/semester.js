/** Deterministic semester progression. Every result is earned by an observed action. */
export const PLAN_ACTIVITIES = {
  study:{id:'study',label:'깊이 공부하기',description:'백남에서 수업을 복습하고 과제를 쌓아요.',icon:'book',venue:'library',action:'study',duration:45},
  club:{id:'club',label:'동아리 모임',description:'학생회관에서 함께 만들고 표현해요.',icon:'people',venue:'union',action:'social',duration:45},
  work:{id:'work',label:'교내 아르바이트',description:'학생복지관의 일을 돕고 근무한 만큼 벌어요. 45분 근무 22,000원.',icon:'bolt',venue:'food',action:'social',duration:45},
  friend:{id:'friend',label:'친구와 시간 보내기',description:'마음을 두는 사람과 같은 장소에서 이야기를 나눠요.',icon:'heart',venue:'history',action:'social',duration:45},
  rest:{id:'rest',label:'나를 돌보는 시간',description:'역사관 앞 그늘에서 체력과 마음의 여유를 되찾아요.',icon:'leaf',venue:'history',action:'rest',duration:45},
};
export const GOALS = {
  scholar:{id:'scholar',label:'배움이 남는 학기',description:'두 과목의 평균 75점 이상, 지식 성장 65 이상을 바라봐요.'},
  friendship:{id:'friendship',label:'오래 갈 친구',description:'두 사람과 우정 55 · 신뢰 35 이상인 관계를 만들어요.'},
  romance:{id:'romance',label:'서로를 알아가는 마음',description:'서로 동의한 연애와 세 번 이상의 데이트, 신뢰 40 이상을 바라봐요.'},
  independent:{id:'independent',label:'내 힘으로 살아가기',description:'자립 성장 65 이상과 학기 말 생활비 30만 원을 마련해요.'},
};
export const NPCS = [
  {id:1,name:'이도윤',short:'도윤',description:'조용히 노트를 나누는 계획가. 큰 말보다 지킨 약속을 기억해요.',interest:'책과 설계',likes:['study','rest'],boundary:'서두르는 고백보다 꾸준한 신뢰를 원해요.',growth:'knowledge',minimum:20},
  {id:2,name:'박서연',short:'서연',description:'사진과 동아리를 좋아하는 사교가. 함께 만든 장면을 오래 간직해요.',interest:'사진과 공연',likes:['club','friend'],boundary:'자기 생각을 나누고, 서로의 시간을 존중해 주세요.',growth:'expression',minimum:20},
  {id:3,name:'정지우',short:'지우',description:'학업과 아르바이트를 함께 해내는 동기. 작은 배려와 책임감에 마음을 열어요.',interest:'독립과 캠퍼스 산책',likes:['work','friend'],boundary:'약속을 가볍게 넘기지 않고 거절도 존중해 주세요.',growth:'independence',minimum:15},
];
const titles=[['낯선 이름들이 익숙해지는 주','orientation','첫인사를 나누고 나만의 생활 리듬을 찾아요.'],['함께할 동아리를 찾는 주','club','학생회관에서 한 학기 동안 함께할 사람들을 만나요.'],['작은 습관이 생기는 주','routine','계획이 하루하루의 선택이 되기 시작해요.'],['함께 만드는 첫 과제','project','역할을 나누고 끝까지 해낼 약속을 정해요.'],['말하지 못했던 마음','connection','같이 보낸 시간 위에 조금 더 솔직한 대화를 얹어요.'],['나의 속도를 찾는 주','balance','무리한 약속과 필요한 휴식 사이에서 균형을 찾아요.'],['중간 점검과 과제 마감','deadline','쌓아 둔 공부와 협업이 첫 결과로 남아요.'],['중간고사','midterm','월요일부터 쌓은 준비가 수요일 두 시험에 반영돼요.'],['다시 고르는 방향','reset','성적과 마음을 돌아보고 후반부의 일상을 정해요.'],['가을 축제','festival','학생회관의 작은 축제를 함께 준비하고 즐겨요.'],['익숙해서 더 소중한 시간','connection','편안해진 관계도 함께하는 시간이 필요해요.'],['깊어지는 계절','balance','생활비, 공부, 마음의 여유를 다시 살펴요.'],['마지막 팀 과제','project','서로의 몫을 믿고 학기 끝의 결과물을 만들어요.'],['기말 준비','preparation','당장의 성과보다 꾸준히 정리해 둔 노트가 힘이 돼요.'],['한 학기를 돌아보며','farewell','함께 보낸 장면들이 나만의 대학생활이 되었어요.'],['기말고사와 종강','final','수요일 시험, 일요일 마지막 기록으로 열여섯 주를 마쳐요.']];
export const SEMESTER_CALENDAR=titles.map(([title,event,description],i)=>({week:i+1,title,event,description}));
export const WEEKDAYS=['월요일','화요일','수요일','목요일','금요일','토요일','일요일'];
const bound=(n,min=0,max=100)=>Math.max(min,Math.min(max,n));
const copy=value=>JSON.parse(JSON.stringify(value));
const withName=name=>name+((name.charCodeAt(name.length-1)-44032)%28?'과':'와');
const topicName=name=>name+((name.charCodeAt(name.length-1)-44032)%28?'은':'는');
const clock=n=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}`;
const person=(sim,id)=>sim.students.find(s=>s.id===id);
const mine=sim=>sim.students[0];
const BASE_REL={trust:8,friendship:5,romance:0,status:'acquaintance',sharedActivities:0,dates:0,lastWeek:0,declinedUntil:0,neglectedWeeks:0,lastConversation:null};

export function createSemester(trait='curious'){
  const plan=trait==='diligent'?['study','study','rest']:trait==='social'?['club','friend','rest']:['study','friend','rest'];
  return{version:1,week:1,dayOfWeek:0,phase:'planning',plan,days:Array.from({length:7},()=>[...plan]),focusId:1,goal:trait==='social'?'friendship':'scholar',growth:{knowledge:15,expression:12,independence:10},money:80000,stress:18,courses:[{id:'foundation',title:'창의적 공학설계',knowledge:18,attendance:0,attendedMinutes:0,midterm:null,final:null,project:0,grade:null},{id:'seminar',title:'사고와 표현',knowledge:18,attendance:0,attendedMinutes:0,midterm:null,final:null,project:0,grade:null}],history:[],decision:null,report:null,ending:null,commitments:[],decisionDone:false,choices:[],ledger:[],flags:{club:false,projectRole:'support'},weekStart:null,weekStats:{classMinutes:[0,0],studyMinutes:0,workMinutes:0,sharedMinutes:{},meals:0,completed:[],missed:[],highlights:[]},pendingConversation:null,migrated:false};
}
export function ensureSemesterRelationships(sim){
  for(const npc of NPCS){if(!person(sim,npc.id))continue;const r=sim.relationship(mine(sim),npc.id);for(const [k,v]of Object.entries(BASE_REL))if(r[k]===undefined)r[k]=v;const reverse=sim.relationship(person(sim,npc.id),0);for(const [k,v]of Object.entries(BASE_REL))if(reverse[k]===undefined)reverse[k]=v;}
}
function relation(sim,id){if(mine(sim).relationships[id]?.trust===undefined)ensureSemesterRelationships(sim);return mine(sim).relationships[id];}
function mirror(sim,id){const r=relation(sim,id),back=sim.relationship(person(sim,id),0);for(const k of Object.keys(BASE_REL))back[k]=r[k];}
function note(sim,kind,text,icon='leaf',withId=null){sim.remember(mine(sim),kind,text,icon,withId);const highlights=sim.semester.weekStats.highlights;if(!highlights.includes(text))highlights.push(text);}
function money(sim,amount,reason){const st=sim.semester;const applied=Math.max(-st.money,Math.round(amount));st.money+=applied;st.ledger.push({week:st.week,day:sim.day,time:sim.clock,amount:applied,reason});st.ledger=st.ledger.slice(-180);return applied;}
function addGrowth(st,key,n){st.growth[key]=bound(st.growth[key]+n);}
function courseGrade(c){return Math.round((c.midterm??0)*.35+(c.final??0)*.4+c.project*.15+c.attendance*.1);}
function relationLabel(r){return r.status==='dating'?'서로 마음을 확인한 연인':r.status==='declined'?'서로의 속도를 존중하는 사이':r.friendship>=70&&r.trust>=45?'오래 믿고 싶은 친구':r.friendship>=35?'함께 시간을 쌓는 친구':'알아가는 동기';}
export function semesterView(sim){
  ensureSemesterRelationships(sim);const st=sim.semester;const view=copy(st);
  view.calendar=SEMESTER_CALENDAR[st.week-1];view.calendarAll=SEMESTER_CALENDAR;view.dayOfWeek=Math.max(0,Math.min(6,sim.day-(st.week-1)*7-1));view.dayLabel=WEEKDAYS[view.dayOfWeek];view.absoluteDay=sim.day;view.totalDays=112;view.clock=sim.clock;view.weekProgress=Math.min(1,(view.dayOfWeek+(sim.time/1440))/7);
  view.allCommitments=view.commitments;view.commitments=view.commitments.filter(c=>c.day===sim.day);view.npcs=NPCS.map(n=>{const r=copy(relation(sim,n.id));return{...n,relationship:r,stage:r.status,label:relationLabel(r)};});
  view.courses=view.courses.map((c,i)=>{const sessions=(st.week-1)*5+Math.min(view.dayOfWeek,5)+(view.dayOfWeek<5&&sim.time>=[540,780][i]?1:0);return{...c,attendance:sessions?bound(c.attendedMinutes/(sessions*50)*100):0,grade:st.phase==='complete'?courseGrade(c):c.grade};});view.goalInfo=GOALS[st.goal];view.isWeekend=view.dayOfWeek>=5;
  return view;
}
export function semesterBlocksTime(sim){return sim.semester.phase!=='living'||Boolean(sim.semester.decision);}
function makeCommitments(st){
  return st.days.flatMap((slots,d)=>slots.map((kind,i)=>({id:`w${st.week}-d${d}-s${i}`,kind,day:(st.week-1)*7+d+1,slot:i,start:[615,840,960][i],end:[660,885,1005][i],duration:45,status:'pending',minutes:0,sharedMinutes:0,partnerId:null,paid:0,outcome:'',dispatchedAt:null,partnerDispatched:false,conversation:null,projectPower:1})));
}
export function setWeekDraft(sim,options={}){
  const st=sim.semester;if(st.phase!=='planning')throw new Error('주간 준비 중에만 계획을 고칠 수 있어요.');
  const days=options.days??st.days,focus=options.focusId??st.focusId,goal=options.goal??st.goal;
  if(!Array.isArray(days)||days.length!==7||days.some(row=>!Array.isArray(row)||row.length!==3||row.some(k=>!Object.hasOwn(PLAN_ACTIVITIES,k)))||!NPCS.some(n=>n.id===focus)||!Object.hasOwn(GOALS,goal))throw new Error('주간 계획을 다시 확인해 주세요.');
  st.days=copy(days);st.plan=[...days[0]];st.focusId=focus;st.goal=goal;return semesterView(sim);
}
export function startWeek(sim,options={}){
  const st=sim.semester;if(st.phase!=='planning')throw new Error('이번 주 계획은 준비 화면에서 정할 수 있어요.');
  const slots=options.slots??st.plan,days=options.days??(options.slots?Array.from({length:7},()=>[...slots]):st.days);
  if(!Array.isArray(days)||days.length!==7||days.some(row=>!Array.isArray(row)||row.length!==3||row.some(k=>!Object.hasOwn(PLAN_ACTIVITIES,k))))throw new Error('월요일부터 일요일까지 하루 세 가지 계획을 골라 주세요.');
  const focus=options.focusId??st.focusId,goal=options.goal??st.goal;if(!NPCS.some(n=>n.id===focus)||!person(sim,focus)||!Object.hasOwn(GOALS,goal))throw new Error('함께할 사람과 학기 목표를 다시 골라 주세요.');
  st.days=copy(days);st.plan=[...days[0]];st.focusId=focus;st.goal=goal;st.phase='living';st.decision=null;st.decisionDone=false;st.report=null;st.pendingConversation=null;st.weekStats={classMinutes:[0,0],studyMinutes:0,workMinutes:0,sharedMinutes:{},meals:0,completed:[],missed:[],highlights:[]};
  st.weekStart={growth:copy(st.growth),money:st.money,stress:st.stress,relationships:NPCS.map(n=>({id:n.id,...copy(relation(sim,n.id))}))};st.commitments=makeCommitments(st);
  money(sim,100000,'이번 주 생활비');money(sim,-30000,'한 주의 교통·생활 준비');note(sim,'week',`${st.week}주차. 월요일부터 일요일까지 직접 살아갈 일곱 날의 계획을 세웠어요.`,'journal');
  for(const s of sim.students){s.semesterTask=null;s.invitation=null;}
  return semesterView(sim);
}
function finishWeek(sim){
  const st=sim.semester;if(st.phase!=='living')return;
  for(const c of st.commitments){if(!['completed','missed'].includes(c.status)){c.status='missed';c.outcome='약속한 시간을 끝까지 보내지 못했어요.';st.weekStats.missed.push(`${WEEKDAYS[(c.day-1)%7]} ${PLAN_ACTIVITIES[c.kind].label}`);}}
  for(const npc of NPCS){const r=relation(sim,npc.id),shared=st.weekStats.sharedMinutes[npc.id]||0;if(shared<35){r.trust=bound(r.trust-(r.status==='dating'?6:1));r.friendship=bound(r.friendship-2);if(r.status==='dating'){r.neglectedWeeks++;r.romance=bound(r.romance-5);if(r.neglectedWeeks>=2)note(sim,'distance',`${withName(npc.name)} 두 주 동안 제대로 시간을 보내지 못했어요. 다음에는 관계를 어떻게 이어갈지 이야기해야 해요.`,'heart',npc.id);}}else r.neglectedWeeks=0;r.status=r.status==='dating'||r.status==='declined'?r.status:r.friendship>=65&&r.trust>=40?'close':r.friendship>=30?'friend':'acquaintance';mirror(sim,npc.id);}
  for(let i=0;i<st.courses.length;i++){const c=st.courses[i];c.attendance=bound(c.attendedMinutes/(st.week*250)*100);if([8,16].includes(st.week)&&c[st.week===8?'midterm':'final']===null){c[st.week===8?'midterm':'final']=0;note(sim,'exam',`${c.title} 시험에 참석하지 못했어요. 이번 시험 점수는 0점으로 남아요.`,'book');}c.grade=st.week===16?courseGrade(c):null;}
  const report={week:st.week,title:`${st.week}주차 · ${SEMESTER_CALENDAR[st.week-1].title}`,summary:`일곱 날 동안 ${st.weekStats.completed.length}개의 약속을 지켰고, ${st.weekStats.missed.length}개는 끝내지 못했어요.`,highlights:st.weekStats.highlights.slice(-7),growth:Object.fromEntries(Object.keys(st.growth).map(k=>[k,Math.round((st.growth[k]-st.weekStart.growth[k])*10)/10])),moneyDelta:st.money-st.weekStart.money,stressDelta:Math.round(st.stress-st.weekStart.stress),courses:copy(st.courses),relationships:NPCS.map(n=>({id:n.id,name:n.name,...copy(relation(sim,n.id)),label:relationLabel(relation(sim,n.id))})),completed:[...st.weekStats.completed],missed:[...st.weekStats.missed],days:7,firstDay:(st.week-1)*7+1,lastDay:st.week*7};
  st.report=report;st.history.push(copy(report));st.phase=st.week===16?'complete':'review';st.decision=null;
  if(st.week===16){const average=st.courses.reduce((n,c)=>n+courseGrade(c),0)/2,rels=NPCS.map(n=>relation(sim,n.id));const success={scholar:average>=75&&st.growth.knowledge>=65,friendship:rels.filter(r=>r.friendship>=55&&r.trust>=35).length>=2,romance:rels.some(r=>r.status==='dating'&&r.dates>=3&&r.trust>=40),independent:st.money>=300000&&st.growth.independence>=65}[st.goal];
    const endingTitles={scholar:'나의 질문이 자란 학기',friendship:'캠퍼스에 내 편이 생겼다',romance:'함께 걷게 된 계절',independent:'내 생활을 꾸려 가는 사람'};
    st.ending={title:success?endingTitles[st.goal]:'완벽하지 않아도, 나만의 한 학기',text:success?'처음 정한 바람이 매일의 행동과 만남을 거쳐 현실이 되었어요.':'바라던 모습과 조금 달라도 112일 동안 쌓은 배움과 관계는 사라지지 않아요.',goal:st.goal,success,highlights:[`두 과목 평균 ${average.toFixed(1)}점`,`기억에 남은 친구 ${rels.filter(r=>r.friendship>=35).length}명`,`학기 말 생활비 ${Math.round(st.money).toLocaleString('ko-KR')}원`,'112일의 캠퍼스 생활을 마쳤어요. 다음은 겨울방학이에요.']};
    note(sim,'ending',st.ending.title+' · 열여섯 주의 이야기가 완성됐어요.','leaf');
  }
}
export function advanceWeek(sim){
  const old=sim.semester;if(old.phase!=='review'||old.week>=16)throw new Error('주간 기록을 마친 뒤 다음 주로 갈 수 있어요.');
  old.week++;old.dayOfWeek=0;old.phase='planning';old.decision=null;old.report=null;old.pendingConversation=null;old.commitments=[];old.stress=bound(old.stress-7);
  sim.day=(old.week-1)*7+1;sim.time=525;
  for(const c of old.courses)c.knowledge=bound(c.knowledge-3);
  const gate=sim.graph.nearest(sim.data.buildings.find(b=>b.name==='애지문').center);
  for(const s of sim.students){s.semesterTask=null;s.invitation=null;s.phase='idle';s.node=s.id===0?gate:sim.venues[s.id%sim.venues.length].node;s.position=[...sim.graph.nodes[s.node].p];s.route=[];s.routeIndex=0;s.energy=bound(85-old.stress*.25);s.satiety=78;s.social=bound(s.social+12);s.completed=[];s.dayFlags={};s.classSession=null;sim.decide(s);}
  return semesterView(sim);
}
function buildDecision(sim){
  const st=sim.semester,npc=NPCS.find(n=>n.id===st.focusId),r=relation(sim,npc.id),event=SEMESTER_CALENDAR[st.week-1].event;
  const option=(id,label,description)=>({id,label,description});let title,text,options;
  if(['midterm','final','preparation'].includes(event)){title=event==='preparation'?'남은 시험 준비 시간':'시험 앞의 짧은 틈';text=`${st.courses[0].title}와 ${st.courses[1].title}. 준비와 휴식 중 지금 필요한 것은 무엇일까요?`;options=[option('steady','숨을 고르고 평소대로','점심 뒤 25분을 쉬며 긴장을 낮추고 예정한 생활을 이어가요.'),option('cram','헷갈리는 부분을 한 번 더','점심 뒤 실제로 도서관에 들러 25분 복습해요. 조금 더 피곤해져요.')];}
  else if(event==='club'){title='같이 만들어 볼래?';text='학생회관의 작은 동아리에서 이번 학기 활동을 함께하자는 제안이 왔어요.';options=[option('join','작은 역할부터 맡기','오늘 오후 동아리 모임에서 실제로 일을 나눠요. 앞으로 표현 활동이 조금 익숙해져요.'),option('explore','여유 있게 둘러보기','오늘 오후 친구와 이야기하며 내 생활에 맞는지 살펴요.')];}
  else if(['project','deadline'].includes(event)){title='이번 과제에서 나의 몫';text=`${withName(npc.name)} 준비할 결과물이 있어요. 실제로 함께 보내는 시간이 과제 진도와 신뢰에 남아요.`;options=[option('lead','설계와 자료 정리를 맡기','오후에 함께 공부하며 과제를 진전시켜요. 공부와 책임이 조금 늘어요.'),option('support','팀의 설명과 발표 돕기','오후에 학생회관에서 협업해요. 표현과 관계를 함께 쌓아요.'),option('solo','혼자 맡은 부분부터 완성','오후에 혼자 자료를 정리해요. 함께 쌓는 신뢰는 줄지만 자기 몫에 집중해요.')];}
  else if(event==='festival'){title='가을 축제를 보내는 방법';text='수업 뒤 학생회관에서 작은 공연을 준비하고 있어요. 오늘의 기억은 누구와 만들까요?';options=[option('host','무대 뒤에서 함께 돕기','오후 동아리 활동으로 공연 준비를 돕고 표현 경험을 쌓아요.'),option('date',r.status==='dating'?'연인과 축제 산책':'친구와 축제 구경','오후에 함께 만나요. 연인이라면 서로 동의한 데이트가 돼요.'),option('quiet','조용한 그늘에서 쉬기','오늘 오후는 쉬어 가요. 무리한 약속 대신 내 컨디션을 돌봐요.')];}
  else if(r.status==='dating'){title=r.neglectedWeeks>=2?'우리, 요즘 조금 멀어진 것 같아':'함께 걷는 시간을 정할까요?';text=`${topicName(npc.name)} ${npc.interest}을 좋아해요. 이번 선택도 실제로 함께 보낸 시간이 되어야 관계에 남아요.`;options=[option('date','우리 둘의 시간을 만들기','오후의 약속을 데이트로 바꾸고 함께 만나요.'),option('support','좋아하는 일을 함께하기','상대가 좋아하는 활동을 함께하며 신뢰를 회복해요.'),option('give-space','서로의 시간을 존중하기','오늘 오후는 혼자 쉬어요. 거절 없이 상대의 마음을 대신 정하지 않아요.')];}
  else if(st.goal==='romance'||r.friendship>=25&&st.money>=25000){title='조금 더 솔직해져도 될까?';text=`${withName(npc.name)}의 우정 ${Math.round(r.friendship)}, 신뢰 ${Math.round(r.trust)}. ${npc.boundary}`;options=[option('spend-time','오늘도 함께 알아가기','오후에 만나 서로의 이야기를 들어요. 마음을 서두르지 않아요.'),option('confess','만나서 내 마음 전하기','오후에 직접 만나 고백해요. 충분한 신뢰와 경험이 없다면 상대는 거절할 수 있어요.'),option('give-space','오늘은 각자의 시간','오후에 혼자 쉬며 상대의 속도를 존중해요.')];}
  else if(st.goal==='independent'||st.money<25000){title='이번 주 생활비를 바라보며';text=`지금 쓸 수 있는 돈은 ${Math.round(st.money).toLocaleString('ko-KR')}원이에요. 일과 회복 중 어디에 시간을 둘까요?`;options=[option('extra-work','한 번 더 일하기','오후에 학생복지관에서 실제로 근무한 만큼 돈을 벌어요.'),option('recover','지금은 컨디션 챙기기','오후를 휴식으로 바꿔 피로와 스트레스를 줄여요.')];}
  else{title=st.week===1?'먼저 인사해 볼까요?':'나에게 맞는 이번 주';text=st.week===1?'낯선 캠퍼스의 얼굴들이 조금씩 익숙해져요. 오늘 오후에 무엇을 해볼까요?':'공부, 사람, 그리고 내 마음. 오늘 필요한 한 가지를 정해요.';options=[option('introduce','먼저 말을 걸기','오후에 마음을 두는 동기를 만나 천천히 이야기를 나눠요.'),option('routine','내 리듬을 지키기','오후에 백남에서 공부하며 내 생활의 중심을 잡아요.'),option('recover','잠깐 쉬어 가기','오후에 역사관 그늘에서 에너지를 회복해요.')];}
  return{id:`week-${st.week}`,title,text,options};
}
export function chooseSemesterOption(sim,id){
  const st=sim.semester,d=st.decision;if(!d||!d.options.some(o=>o.id===id))throw new Error('지금 열려 있는 이야기에서 선택해 주세요.');
  const target=st.commitments.find(c=>c.day===sim.day&&c.slot===1&&c.status==='pending');if(!target)throw new Error('오늘 오후 약속을 찾을 수 없어요.');
  const npc=NPCS.find(n=>n.id===st.focusId),r=relation(sim,npc.id);
  const kind={introduce:'friend',routine:'study',recover:'rest',join:'club',explore:'friend',lead:'study',support:r.status==='dating'?npc.likes[0]:'club',solo:'study',host:'club',date:'friend',quiet:'rest','spend-time':'friend',confess:'friend','give-space':'rest','extra-work':'work'}[id];
  if(kind)target.kind=kind;
  if(id==='join')st.flags.club=true;
  if(['lead','support','solo'].includes(id)&&['project','deadline'].includes(SEMESTER_CALENDAR[st.week-1].event)){st.flags.projectRole=id;target.projectPower=id==='lead'?1.6:id==='support'?1.3:1.1;target.alone=id==='solo';}
  if(['steady','cram'].includes(id)){const start=sim.time+3;st.commitments.push({id:`w${st.week}-choice`,kind:id==='steady'?'rest':'study',day:sim.day,slot:3,start,end:start+25,duration:25,status:'pending',minutes:0,sharedMinutes:0,partnerId:null,paid:0,outcome:'',dispatchedAt:null,partnerDispatched:false,conversation:null,projectPower:1,alone:true,examReview:id==='cram'});}
  if(id==='confess'||id==='date'||id==='support'&&r.status==='dating'){target.conversation=id;target.partnerId=npc.id;st.pendingConversation={kind:id,npcId:npc.id,commitmentId:target.id,resolved:false};}
  if(id==='give-space'){r.trust=bound(r.trust+1);r.lastConversation='서로의 시간을 존중하기로 했어요.';mirror(sim,npc.id);}
  const selected=d.options.find(o=>o.id===id);st.choices.push({week:st.week,day:sim.day,time:sim.clock,id,label:selected.label});st.decision=null;st.decisionDone=true;note(sim,'choice',`${selected.label}. 선택한 이야기는 오늘 오후의 실제 행동으로 이어져요.`,'spark');
  return semesterView(sim);
}
function assignTask(sim,s,c,role){
  const def=PLAN_ACTIVITIES[c.kind],label=c.conversation==='date'?'약속한 데이트':c.conversation==='confess'?'마음을 전할 약속':def.label;
  s.semesterTask={id:c.id,kind:c.kind,role,start:c.start,end:c.end};
  sim.startActivity(s,def.action,role==='partner'?`${withName(mine(sim).name.slice(1))} ${clock(c.start)}에 만나기로 했어. 약속 장소로 가자.`:`${clock(c.start)}에는 ${label}. 계획한 시간을 직접 살아 보자.`,{venue:def.venue,duration:c.duration,semesterTask:s.semesterTask});
}
function dispatch(sim,c){
  const st=sim.semester,s=mine(sim);c.status='traveling';c.dispatchedAt=sim.time;
  if(s.energy<12&&st.stress>80&&c.kind!=='rest'){c.originalKind=c.kind;c.kind='rest';c.forcedRest=true;note(sim,'overload','너무 지쳐 약속 대신 쉬기로 했어요. 계획을 덜어 내야 할 것 같아요.','leaf');}
  if(c.partnerId===null&&!c.alone&&['friend','study','club'].includes(c.kind))c.partnerId=st.focusId;
  if(c.partnerId===null&&!c.alone&&c.kind==='work'&&st.focusId===3)c.partnerId=3;
  assignTask(sim,s,c,'player');
}
export function beforeSemesterStep(sim){
  const st=sim.semester;if(st.phase!=='living'||st.decision)return;
  st.dayOfWeek=Math.max(0,Math.min(6,sim.day-(st.week-1)*7-1));
  if(st.dayOfWeek===6&&sim.time>=1110){finishWeek(sim);return;}
  if(st.dayOfWeek===2&&sim.time>=735&&!st.decisionDone){st.decision=buildDecision(sim);return;}
  for(const c of st.commitments){if(c.day!==sim.day)continue;
    if(c.status==='pending'&&sim.time>c.end+20){c.status='missed';c.outcome='다른 일과로 약속 시간을 놓쳤어요.';st.weekStats.missed.push(`${WEEKDAYS[st.dayOfWeek]} ${PLAN_ACTIVITIES[c.kind].label}`);continue;}
    if(c.status==='pending'&&sim.time>=c.start-12&&!mine(sim).semesterTask&&!(mine(sim).action==='class'&&mine(sim).phase!=='walking'&&sim.time<(mine(sim).classSession?.end||0)))dispatch(sim,c);
    if(['traveling','active'].includes(c.status)&&c.partnerId!==null&&!c.partnerDispatched){const partner=person(sim,c.partnerId);if(partner&&!partner.semesterTask&&!(partner.action==='class'&&partner.phase!=='walking'&&sim.time<(partner.classSession?.end||0))){c.partnerDispatched=true;assignTask(sim,partner,c,'partner');}}
  }
}
export function semesterArrival(sim,s){
  if(!s.semesterTask)return false;const c=sim.semester.commitments.find(c=>c.id===s.semesterTask.id);if(!c){s.semesterTask=null;return false;}
  s.remaining=Math.max(1,c.end-sim.time);s.activityElapsed=0;s.pose=c.kind==='work'?'talk':c.kind==='rest'?'sit':c.kind==='study'?'read':'talk';s.activityLabel=c.kind==='work'?'학생복지관에서 근무하는 중':c.conversation==='date'?'약속한 데이트를 하는 중':PLAN_ACTIVITIES[c.kind].label;
  if(sim.time<c.start){s.phase='waiting';s.waitUntil=c.start;s.pose='wait';s.activityLabel='약속한 시간을 기다리는 중';s.thought='조금 일찍 왔네. 천천히 기다리자.';}else{s.phase='acting';if(s.semesterTask.role==='player')c.status='active';s.thought=c.kind==='work'?'맡은 일을 차근차근 해 보자.':c.kind==='friend'?'오늘은 네 이야기를 조금 더 듣고 싶어.':'약속한 이 시간에 집중해 보자.';}
  return true;
}
export function semesterWaitFinished(sim,s){if(s.semesterTask)semesterArrival(sim,s);}
function resolveConversation(sim,c){
  const st=sim.semester,pending=st.pendingConversation;if(!pending||pending.resolved||pending.commitmentId!==c.id||c.sharedMinutes<15)return;
  const npc=NPCS.find(n=>n.id===pending.npcId),r=relation(sim,npc.id);pending.resolved=true;
  if(pending.kind==='confess'){
    const existingPartner=NPCS.find(n=>n.id!==npc.id&&relation(sim,n.id).status==='dating');
    if(existingPartner){r.lastConversation='이미 이어 가는 관계를 먼저 정직하게 정리해야 해요.';note(sim,'boundary',`${withName(existingPartner.name)}의 관계를 이어 가고 있어요. 다른 사람에게 고백하기 전에 현재의 약속을 먼저 돌아보기로 했어요.`,'heart',npc.id);mirror(sim,npc.id);return;}
    const ready=st.week>=r.declinedUntil&&r.friendship>=45&&r.trust>=35&&r.romance>=20&&r.sharedActivities>=5&&st.growth[npc.growth]>=npc.minimum;
    if(ready){r.status='dating';r.lastConversation='서로의 마음을 확인하고 천천히 만나기로 했어요.';r.trust=bound(r.trust+3);r.romance=bound(r.romance+5);note(sim,'romance',`${npc.name}도 같은 마음이라고 답했어요. 서로 동의하며 천천히 만나기로 했어요.`,'heart',npc.id);}
    else{const repeated=st.week<r.declinedUntil;r.status='declined';r.declinedUntil=st.week+2;r.lastConversation='아직은 친구로 알아가고 싶다고 했어요.';r.trust=bound(r.trust-(repeated?5:1));note(sim,'boundary',`${topicName(npc.name)} 아직 친구로 알아가고 싶다고 했어요. 대답을 존중하고 서두르지 않기로 했어요.`,'heart',npc.id);}
  }else if(pending.kind==='date'){
    if(r.status==='dating'){r.dates++;r.romance=bound(r.romance+3);r.trust=bound(r.trust+2);r.neglectedWeeks=0;note(sim,'date',`${withName(npc.name)} 약속한 데이트를 했어요. 오늘 함께 걸은 시간이 둘의 기억에 남았어요.`,'heart',npc.id);}
    else note(sim,'friend',`${withName(npc.name)} 함께 시간을 보냈어요. 서로의 마음을 정하기 전에는 친구로서의 약속이에요.`,'people',npc.id);
  }else if(pending.kind==='support'){r.trust=bound(r.trust+3);r.neglectedWeeks=0;note(sim,'care',`${npc.name}가 좋아하는 일을 함께했어요. 말보다 함께한 시간이 믿음이 되었어요.`,'heart',npc.id);}
  mirror(sim,npc.id);
}
function naturalContact(sim,s,dt,commitment){
  const st=sim.semester,stats=st.weekStats;stats.naturalMinutes??={};stats.naturalSessions??={};
  for(const id of new Set(s.companions)){
    if(!NPCS.some(n=>n.id===id))continue;const other=person(sim,id);
    if(!other||other.phase!=='acting'||other.action!==s.action||other.destination.id!==s.destination.id||Math.hypot(other.position[0]-s.position[0],other.position[1]-s.position[1])>=16)continue;
    // A scheduled conversation is already accounted for below. Casual company with a
    // different person still matters, but never grants the same pair a second award.
    if(commitment&&other.semesterTask?.id===commitment.id&&commitment.partnerId===id)continue;
    const r=relation(sim,id);
    if(s.action==='class'){r.friendship=bound(r.friendship+dt*.0008);mirror(sim,id);continue;}
    if(!['eat','study','social','rest'].includes(s.action))continue;
    const dayKey=sim.day+':'+id,sessionKey=dayKey+':'+s.action,previous=stats.naturalMinutes[dayKey]||0,credited=Math.min(dt,Math.max(0,90-previous));
    stats.naturalMinutes[dayKey]=Math.min(90,previous+dt);stats.sharedMinutes[id]=(stats.sharedMinutes[id]||0)+dt;
    r.friendship=bound(r.friendship+credited*.006);r.trust=bound(r.trust+credited*.0025);r.lastWeek=st.week;r.affinity=Math.max(r.affinity,r.friendship);
    const session=stats.naturalSessions[sessionKey]||(stats.naturalSessions[sessionKey]={minutes:0,counted:false});session.minutes+=dt;
    if(!session.counted&&session.minutes>=20){session.counted=true;r.sharedActivities++;}
    mirror(sim,id);
  }
}
export function semesterActivity(sim,s,dt){
  const st=sim.semester;if(st.phase!=='living'||s.id!==0)return;
  const c=s.semesterTask?st.commitments.find(c=>c.id===s.semesterTask.id):null;
  naturalContact(sim,s,dt,c);
  const stressEfficiency=st.stress>80?.6:st.stress>60?.82:1;
  if(s.action==='class'&&s.classSession){const i=s.classSession.id==='morning'?0:1,course=st.courses[i];course.attendedMinutes+=dt;st.weekStats.classMinutes[i]+=dt;course.knowledge=bound(course.knowledge+dt*.013*stressEfficiency);addGrowth(st,'knowledge',dt*.0015);st.stress=bound(st.stress+dt*.004);}
  if(s.action==='study'){st.weekStats.studyMinutes+=dt;const index=st.weekStats.studyMinutes%100<50?0:1;st.courses[index].knowledge=bound(st.courses[index].knowledge+dt*(c?.kind==='study'?.009:.0015)*stressEfficiency);addGrowth(st,'knowledge',dt*(c?.kind==='study'?.004:.0007));if([4,5,6,7,13,14,15].includes(st.week))st.courses[index].project=bound(st.courses[index].project+dt*(c?.kind==='study'?.016:.0015)*(c?.projectPower||1));}
  if(!c)return;
  c.status='active';c.minutes+=dt;
  if(c.kind==='work'){st.weekStats.workMinutes+=dt;addGrowth(st,'independence',dt*.009);st.stress=bound(st.stress+dt*.06);s.energy=bound(s.energy-dt*.09);s.activityLabel='학생복지관에서 근무하는 중';s.pose='talk';}
  if(c.kind==='club'){addGrowth(st,'expression',dt*.009*(st.flags.club?1.15:1));st.stress=bound(st.stress+dt*.003);if([4,5,6,7,13,14,15].includes(st.week))st.courses[1].project=bound(st.courses[1].project+dt*.025*(c.projectPower||1));}
  if(c.kind==='rest'){st.stress=bound(st.stress-dt*.045);s.energy=bound(s.energy+dt*.15);}
  if(c.kind==='study')st.stress=bound(st.stress+dt*.009);
  if(c.kind==='friend')addGrowth(st,'expression',dt*.004);
  const partner=c.partnerId===null?null:person(sim,c.partnerId);
  if(partner?.phase==='acting'&&partner.semesterTask?.id===c.id&&partner.destination.id===s.destination.id){
    c.sharedMinutes+=dt;st.weekStats.sharedMinutes[c.partnerId]=(st.weekStats.sharedMinutes[c.partnerId]||0)+dt;const r=relation(sim,c.partnerId),npc=NPCS.find(n=>n.id===c.partnerId),liked=npc.likes.includes(c.kind);r.friendship=bound(r.friendship+dt*(liked?.01:.007));r.trust=bound(r.trust+dt*.004);if(['friend','club'].includes(c.kind)&&r.trust>=15)r.romance=bound(r.romance+dt*(liked?.006:.004));r.lastWeek=st.week;r.affinity=Math.max(r.affinity,r.friendship);mirror(sim,c.partnerId);s.companionId=c.partnerId;if(!s.companions.includes(c.partnerId))s.companions.unshift(c.partnerId);s.activityLabel=c.conversation==='date'?`${withName(npc.short)} 데이트 중`:`${withName(npc.short)} ${{friend:'이야기하는 중',club:'동아리 활동 중',study:'함께 공부하는 중',work:'함께 근무하는 중',rest:'쉬는 중'}[c.kind]}`;resolveConversation(sim,c);
  }
}
export function semesterFinishActivity(sim,s){
  if(!s.semesterTask)return false;const task=s.semesterTask,c=sim.semester.commitments.find(c=>c.id===task.id),st=sim.semester;s.semesterTask=null;if(!c)return false;
  if(task.role==='partner')return true;
  if(c.minutes>=Math.min(25,c.duration*.55)&&!c.forcedRest){c.status='completed';const title=`${WEEKDAYS[(c.day-1)%7]} ${clock(c.start)} ${PLAN_ACTIVITIES[c.kind].label}`;st.weekStats.completed.push(title);
    if(c.kind==='work'){c.paid=money(sim,Math.round(22000*Math.min(1,Math.round(c.minutes)/45)/100)*100,'교내 아르바이트');c.outcome=`${Math.round(c.minutes)}분 근무하고 ${c.paid.toLocaleString('ko-KR')}원을 벌었어요.`;}
    else c.outcome=`${Math.round(c.minutes)}분 동안 ${PLAN_ACTIVITIES[c.kind].label}를 실제로 했어요.`;
    if(c.partnerId!==null&&c.sharedMinutes>=20){const r=relation(sim,c.partnerId);r.sharedActivities++;r.trust=bound(r.trust+.1);r.friendship=bound(r.friendship+.1);mirror(sim,c.partnerId);c.outcome+=` ${withName(person(sim,c.partnerId).name)} ${Math.round(c.sharedMinutes)}분을 함께했어요.`;}
    if(c.conversation&&!st.pendingConversation?.resolved)c.outcome+=' 아직 충분히 이야기하지 못해 마음을 전하지 못했어요.';
  }else{c.status='missed';c.outcome=c.forcedRest?'지쳐서 계획 대신 회복이 필요했어요.':'약속한 활동에 충분한 시간을 보내지 못했어요.';st.weekStats.missed.push(`${WEEKDAYS[(c.day-1)%7]} ${PLAN_ACTIVITIES[c.originalKind||c.kind].label}`);if(c.partnerId!==null){const r=relation(sim,c.partnerId);r.trust=bound(r.trust-2);mirror(sim,c.partnerId);}}
  sim.addLog(s,c.outcome,PLAN_ACTIVITIES[c.kind].icon,'commitment');if(c.kind==='work'||c.conversation)note(sim,'commitment',c.outcome,PLAN_ACTIVITIES[c.kind].icon,c.partnerId);
  return true;
}
export function semesterClassFinished(sim,s){
  if(s.id!==0||!s.classSession)return;const st=sim.semester;if(![8,16].includes(st.week)||st.dayOfWeek!==2)return;
  const i=s.classSession.id==='morning'?0:1,c=st.courses[i],key=st.week===8?'midterm':'final';if(c[key]!==null)return;
  const attended=s.activityElapsed,preparation=c.knowledge*.6+st.growth.knowledge*.24+c.project*.08+s.examPrep*.08;const readiness=bound(1-st.stress*.0035,.5,1);c[key]=Math.round(bound(preparation*readiness*Math.min(1,attended/40)+5));s.experience.exams++;note(sim,'exam',`${c.title} ${key==='midterm'?'중간':'기말'}고사 ${c[key]}점. 실제 수업·복습·과제와 오늘의 컨디션이 반영됐어요.`,'book');
}
export function semesterMeal(sim,s){
  if(s.id!==0||sim.semester.phase!=='living')return;const st=sim.semester,short=st.money<4500;
  money(sim,-4500,short?'학생 지원 식사':'학생 식사');st.weekStats.meals++;st.stress=bound(st.stress+(short?2:-1));
  if(short&&!st.weekStats.supportMeal){st.weekStats.supportMeal=true;note(sim,'budget','생활비가 빠듯해서 학생 지원 식사로 끼니를 챙겼어요. 다음 계획에는 일과 생활비를 조금 더 생각해 보려 해요.','food');s.thought='밥은 챙겼지만 생활비가 걱정돼. 다음에는 근무 시간을 조금 넣어 볼까?';}
}
export function isSemesterExamDay(sim){return[8,16].includes(sim.semester.week)&&sim.semester.dayOfWeek===2;}

/** Strict validation is run before Simulation mutates anything during import. */
export function validateSemester(saved,students,day,time){
  const rec=v=>v&&typeof v==='object'&&!Array.isArray(v),num=(v,a=0,b=Infinity)=>Number.isFinite(v)&&v>=a&&v<=b,integer=(v,a,b)=>Number.isInteger(v)&&v>=a&&v<=b;
  const allowedKeys=Object.keys(createSemester());if(!rec(saved)||Object.keys(saved).some(k=>!allowedKeys.includes(k)))throw new Error('Unknown semester state field');
  if(!rec(saved)||saved.version!==1||!integer(saved.week,1,16)||!integer(saved.dayOfWeek,0,6)||!['planning','living','review','complete'].includes(saved.phase)||!Object.hasOwn(GOALS,saved.goal)||!NPCS.some(n=>n.id===saved.focusId)||!rec(saved.growth)||Object.values(saved.growth).length!==3||!['knowledge','expression','independence'].every(k=>num(saved.growth[k],0,100))||!num(saved.money,0,1e8)||!num(saved.stress,0,100))throw new Error('Invalid semester state');
  if(!Array.isArray(saved.plan)||saved.plan.length!==3||saved.plan.some(k=>!Object.hasOwn(PLAN_ACTIVITIES,k))||!Array.isArray(saved.days)||saved.days.length!==7||saved.days.some(row=>!Array.isArray(row)||row.length!==3||row.some(k=>!Object.hasOwn(PLAN_ACTIVITIES,k))))throw new Error('Invalid semester plan');
  if(!integer(day,(saved.week-1)*7+1,saved.week*7)||saved.dayOfWeek!==day-(saved.week-1)*7-1)throw new Error('Semester day does not match calendar');
  if(!Array.isArray(saved.courses)||saved.courses.length!==2||saved.courses.some((c,i)=>!rec(c)||c.id!==['foundation','seminar'][i]||typeof c.title!=='string'||!num(c.knowledge,0,100)||!num(c.attendance,0,100)||!num(c.attendedMinutes,0,16000)||!num(c.project,0,100)||['midterm','final','grade'].some(k=>c[k]!==null&&!num(c[k],0,100))))throw new Error('Invalid course results');
  if(!Array.isArray(saved.history)||saved.history.length>16||saved.history.some((r,i)=>!rec(r)||r.week!==i+1||typeof r.title!=='string'||!Array.isArray(r.highlights)||!Array.isArray(r.completed)||!Array.isArray(r.missed)))throw new Error('Invalid weekly history');
  const expected=saved.phase==='review'||saved.phase==='complete'?saved.week:saved.week-1;if(saved.history.length!==expected)throw new Error('Incomplete weekly history');
  if(!Array.isArray(saved.commitments)||saved.commitments.length>23||new Set(saved.commitments.map(c=>c.id)).size!==saved.commitments.length||saved.commitments.some(c=>!rec(c)||typeof c.id!=='string'||!Object.hasOwn(PLAN_ACTIVITIES,c.kind)||!integer(c.day,(saved.week-1)*7+1,saved.week*7)||!num(c.start,0,1439)||!num(c.end,c.start,1440)||!num(c.duration,1,90)||!['pending','traveling','active','completed','missed'].includes(c.status)||!num(c.minutes,0,100)||!num(c.sharedMinutes,0,c.minutes+.01)||c.partnerId!==null&&!NPCS.some(n=>n.id===c.partnerId)||!num(c.paid,0,50000)))throw new Error('Invalid semester commitments');
  if(!rec(saved.weekStats)||!Array.isArray(saved.weekStats.classMinutes)||saved.weekStats.classMinutes.length!==2||saved.weekStats.classMinutes.some(n=>!num(n))||!num(saved.weekStats.studyMinutes)||!num(saved.weekStats.workMinutes)||!rec(saved.weekStats.sharedMinutes)||Object.values(saved.weekStats.sharedMinutes).some(n=>!num(n))||!Array.isArray(saved.weekStats.completed)||!Array.isArray(saved.weekStats.missed)||!Array.isArray(saved.weekStats.highlights))throw new Error('Invalid week activity totals');
  if(saved.weekStats.naturalMinutes!==undefined&&(!rec(saved.weekStats.naturalMinutes)||Object.values(saved.weekStats.naturalMinutes).some(n=>!num(n,0,90))))throw new Error('Invalid natural contact totals');
  if(saved.weekStats.naturalSessions!==undefined&&(!rec(saved.weekStats.naturalSessions)||Object.values(saved.weekStats.naturalSessions).some(s=>!rec(s)||!num(s.minutes,0,10080)||typeof s.counted!=='boolean')))throw new Error('Invalid natural contact history');
  if(saved.decision!==null&&(!rec(saved.decision)||typeof saved.decision.id!=='string'||typeof saved.decision.title!=='string'||typeof saved.decision.text!=='string'||!Array.isArray(saved.decision.options)||saved.decision.options.length<1||saved.decision.options.some(o=>typeof o.id!=='string'||typeof o.label!=='string'||typeof o.description!=='string')))throw new Error('Invalid pending decision');
  if(saved.report!==null&&(!rec(saved.report)||saved.report.week!==saved.week||typeof saved.report.title!=='string'||typeof saved.report.summary!=='string'||!Array.isArray(saved.report.highlights)||saved.report.highlights.some(v=>typeof v!=='string')||!Array.isArray(saved.report.completed)||!Array.isArray(saved.report.missed)||!rec(saved.report.growth)||!['knowledge','expression','independence'].every(k=>Number.isFinite(saved.report.growth[k]))||!Number.isFinite(saved.report.moneyDelta)||!Number.isFinite(saved.report.stressDelta)))throw new Error('Invalid weekly report');
  if(['review','complete'].includes(saved.phase)&&saved.report===null)throw new Error('Missing weekly report');
  if(saved.phase==='complete'&&(saved.week!==16||!rec(saved.ending)||typeof saved.ending.title!=='string'||typeof saved.ending.text!=='string'||typeof saved.ending.success!=='boolean'||!Object.hasOwn(GOALS,saved.ending.goal)||!Array.isArray(saved.ending.highlights)||saved.ending.highlights.some(v=>typeof v!=='string')))throw new Error('Invalid semester ending');
  if(saved.weekStart!==null&&(!rec(saved.weekStart)||!rec(saved.weekStart.growth)||!['knowledge','expression','independence'].every(k=>num(saved.weekStart.growth[k],0,100))||!num(saved.weekStart.money,0,1e8)||!num(saved.weekStart.stress,0,100)||!Array.isArray(saved.weekStart.relationships)))throw new Error('Invalid week baseline');
  if(!Array.isArray(saved.choices)||!Array.isArray(saved.ledger)||!rec(saved.flags)||typeof saved.decisionDone!=='boolean'||saved.phase==='living'&&!rec(saved.weekStart))throw new Error('Invalid semester records');
  const optionIds=['introduce','routine','recover','join','explore','lead','support','solo','host','date','quiet','spend-time','confess','give-space','extra-work','steady','cram'];
  if(saved.choices.length>16||saved.choices.some(c=>!rec(c)||!integer(c.week,1,16)||!integer(c.day,1,112)||!optionIds.includes(c.id)||typeof c.label!=='string')||saved.ledger.length>180||saved.ledger.some(l=>!rec(l)||!integer(l.week,1,16)||!integer(l.day,1,112)||!num(l.amount,-1e8,1e8)||typeof l.reason!=='string')||typeof saved.flags.club!=='boolean'||!['lead','support','solo'].includes(saved.flags.projectRole)||typeof saved.migrated!=='boolean')throw new Error('Invalid semester choice or ledger');
  if(saved.decision&&(saved.phase!=='living'||saved.decisionDone||saved.dayOfWeek!==2||Math.abs(time-735)>.01||saved.decision.options.some(o=>!optionIds.includes(o.id))))throw new Error('Decision outside its calendar boundary');
  for(const n of NPCS){const r=students[0]?.relationships[n.id];if(!rec(r)||!['trust','friendship','romance'].every(k=>num(r[k],0,100))||!integer(r.sharedActivities,0,10000)||!integer(r.dates,0,1000)||!integer(r.lastWeek,0,16)||!integer(r.declinedUntil,0,18)||!integer(r.neglectedWeeks,0,16)||!['acquaintance','friend','close','dating','declined'].includes(r.status))throw new Error('Invalid semester relationship');}
  for(const s of students)if(s.semesterTask!==null&&s.semesterTask!==undefined){const task=s.semesterTask;if(!rec(task)||!saved.commitments.some(c=>c.id===task.id)||!['player','partner'].includes(task.role)||!Object.hasOwn(PLAN_ACTIVITIES,task.kind)||task.role==='player'&&!saved.commitments.some(c=>c.id===task.id&&['active','traveling'].includes(c.status)))throw new Error('Invalid active semester task');}
  if(saved.pendingConversation!==null&&(!rec(saved.pendingConversation)||!['confess','date','support'].includes(saved.pendingConversation.kind)||!NPCS.some(n=>n.id===saved.pendingConversation.npcId)||typeof saved.pendingConversation.resolved!=='boolean'||!saved.commitments.some(c=>c.id===saved.pendingConversation.commitmentId)))throw new Error('Invalid pending conversation');
  return copy(saved);
}

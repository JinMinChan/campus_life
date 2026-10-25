import {Simulation,distance,pointInPolygon} from '../src/simulation.js';

const copy=value=>JSON.parse(JSON.stringify(value));
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const clock=sim=>sim.day*1440+sim.time;
const withoutObservation=snapshot=>{const value=copy(snapshot);delete value.semester.observation;return value;};

function milestoneHasEvidence(id,sim){
  const st=sim.semester,ob=st.observation,relationships=Object.values(sim.students[0].relationships),main=[1,2,3].map(n=>sim.students[0].relationships[n]);
  const conditions={
    'first-study':()=>ob.activityMinutes.study>=25||sim.students[0].memories.some(m=>m.kind==='study'),
    'shared-notes':()=>relationships.some(r=>r.studySessions>=1),
    'project-piece':()=>st.courses.some(c=>c.project>=25),
    'first-exam':()=>st.courses.some(c=>c.midterm!==null&&c.midterm>=55),
    'first-hello':()=>relationships.some(r=>r.encounters>=1),
    'shared-table':()=>relationships.some(r=>r.sharedMeals>=1),
    'trusted-friend':()=>main.some(r=>r.friendship>=35&&r.trust>=20),
    'friend-circle':()=>main.filter(r=>r.friendship>=55&&r.trust>=35).length>=2,
    'first-time':()=>main.some(r=>r.sharedActivities>=1),
    'safe-trust':()=>main.some(r=>r.friendship>=30&&r.trust>=25),
    'mutual-feelings':()=>main.some(r=>r.status==='dating'),
    'three-dates':()=>main.some(r=>r.dates>=3),
    'first-shift':()=>ob.activityMinutes.work>=25,
    'own-money':()=>ob.earnedMoney>=100000,
    'standing-up':()=>st.growth.independence>=35,
    'breathing-room':()=>st.growth.independence>=65&&st.money>=300000,
    'wish-realized':()=>st.phase==='complete'&&st.ending?.success===true,
  };
  return Boolean(conditions[id]?.());
}

/** Deterministic tests shared by Node and the browser; no manual-mode API is used in full runs. */
export function verifyObservation(data){
  const started=performance.now(),checks=[];
  const check=(name,condition,detail='')=>checks.push({name,pass:Boolean(condition),detail});
  const attempt=(name,run)=>{try{run();}catch(error){check(name,false,error.stack||String(error));}};
  const make=(trait='curious')=>new Simulation(data,trait);
  const strategies={
    scholar:{trait:'diligent',focusId:1},
    friendship:{trait:'social',focusId:2},
    romance:{trait:'social',focusId:2},
    independent:{trait:'curious',focusId:3},
  };
  const stats={strategies:{},positionSamples:0,collisions:0,offRoute:0,invalidStates:0,manualChoices:0,encouragementsInFullRuns:0};
  const completed={},checkpoints={};
  const snapshotSample=sim=>{
    for(const student of sim.students){
      stats.positionSamples++;
      if(data.buildings.some(b=>pointInPolygon(student.position,b.points)))stats.collisions++;
      if(!student.position.every(Number.isFinite)||['energy','satiety','academic','mood','social'].some(key=>!Number.isFinite(student[key])||student[key]<0||student[key]>100))stats.invalidStates++;
      if(student.phase==='walking'){
        const from=sim.graph.nodes[student.node],to=sim.graph.nodes[student.route[student.routeIndex]];
        if(!from||!to||distance(from.p,student.position)+distance(student.position,to.p)-distance(from.p,to.p)>.03)stats.offRoute++;
      }
    }
  };

  attempt('Starting observation is an explicit, valid transition',()=>{
    const sim=make(),before=sim.snapshot();
    for(const options of [{goal:'not-a-goal'},{focusId:999}]){
      let rejected=false;try{sim.startObservation(options);}catch{rejected=true;}
      check('Invalid observation setup is rejected atomically: '+JSON.stringify(options),rejected&&equal(before,sim.snapshot()));
    }
    sim.startObservation({goal:'scholar',focusId:1});
    const view=sim.semesterView(),observation=view.observation;
    check('One start opens a living semester with no blocking planner',observation.enabled===true&&view.phase==='living'&&!sim.semesterBlocksTime);
    check('The observer can see a concrete wish and next step',typeof observation.wish?.title==='string'&&observation.wish.title.length>0&&typeof observation.wish.description==='string'&&observation.wish.description.length>0&&typeof observation.nextStep==='string'&&observation.nextStep.length>0);
    check('Initial milestone progress is bounded and has no fabricated achievements',Number.isFinite(observation.progress)&&observation.progress>=0&&observation.progress<=1&&Array.isArray(observation.milestones)&&observation.milestones.length>=3&&observation.milestones.every(m=>!m.done));
    const atRest=sim.snapshot();sim.step(0);sim.step(-1);sim.step(NaN);
    check('Zero or invalid elapsed time never advances observation',equal(atRest,sim.snapshot()));
  });

  attempt('Autonomous plans react to personality, wishes and present circumstances',()=>{
    const traitPlans={};
    for(const trait of ['curious','diligent','social']){const sim=make(trait);sim.startObservation({goal:'scholar',focusId:1});traitPlans[trait]=copy(sim.semesterView().days);}
    check('The same academic wish still leaves room for different personalities',new Set(Object.values(traitPlans).map(plan=>JSON.stringify(plan))).size>=2,JSON.stringify(traitPlans));
    const goalPlans={};
    for(const goal of Object.keys(strategies)){const sim=make('curious');sim.startObservation({goal,focusId:2});goalPlans[goal]=copy(sim.semesterView().days);}
    check('Different wishes create different self-chosen weekly activities',new Set(Object.values(goalPlans).map(plan=>JSON.stringify(plan))).size>=3,JSON.stringify(goalPlans));
    const calm=make('diligent'),tired=make('diligent');tired.semester.stress=90;tired.students[0].energy=12;
    calm.startObservation({goal:'scholar',focusId:1});tired.startObservation({goal:'scholar',focusId:1});
    const restCount=sim=>sim.semesterView().days.flat().filter(kind=>kind==='rest').length;
    check('A student under real fatigue and stress leaves more room for recovery',restCount(tired)>restCount(calm),`${restCount(tired)} versus ${restCount(calm)} rest slots`);
    stats.planExamples={traitPlans,goalPlans,calm:calm.semesterView().days,tired:tired.semesterView().days};
  });

  attempt('Legacy version 3 saves retain their exact manual-mode phase before opt-in',()=>{
    const sim=make(),fixtures={planning:sim.snapshot()};
    sim.startWeek({slots:['study','friend','rest'],focusId:1,goal:'scholar'});sim.step(13);fixtures.living=sim.snapshot();
    sim.step(100000);fixtures.decision=sim.snapshot();
    sim.chooseSemesterOption(sim.semesterView().decision.options[0].id);sim.step(100000);fixtures.review=sim.snapshot();
    for(const [label,source]of Object.entries(fixtures)){
      const legacy=withoutObservation(source),restored=make();restored.restore(legacy);
      check(label+': old version 3 data restores without changing time, memories, decisions or history',equal(restored.snapshot(),legacy)&&restored.semesterView().observation.enabled===false);
      const oldTime=clock(restored),oldHistory=copy(restored.semester.history);
      restored.startObservation();restored.step(17);
      check(label+': opting into observation continues forward from the existing life',restored.semesterView().observation.enabled&&clock(restored)>oldTime&&oldHistory.every((report,index)=>equal(report,restored.semester.history[index]))&&!restored.semesterBlocksTime);
    }
  });

  attempt('Encouragement is optional, limited, and affects a real upcoming action',()=>{
    const base=make('diligent');base.startObservation({goal:'scholar',focusId:1});base.step(13);
    const baseline=base.snapshot();
    for(const kind of ['rest','connect','believe']){
      const sim=make(),control=make();sim.restore(baseline);control.restore(baseline);
      const before=copy({growth:sim.semester.growth,money:sim.semester.money,stress:sim.semester.stress,energy:sim.current.energy,mood:sim.current.mood});
      sim.encourage(kind);
      check(kind+': encouragement records the current week and consumes one optional opportunity',sim.semesterView().observation.lastEncouragement?.kind===kind&&sim.semesterView().observation.lastEncouragement.week===1&&!sim.semesterView().observation.canEncourage);
      check(kind+': encouragement does not award instantaneous growth, money or restored needs',equal(before,{growth:sim.semester.growth,money:sim.semester.money,stress:sim.semester.stress,energy:sim.current.energy,mood:sim.current.mood}));
      const once=sim.snapshot();try{sim.encourage(kind==='rest'?'connect':'rest');}catch{}
      check(kind+': a second encouragement in the same week changes nothing',equal(once,sim.snapshot()));
      const restored=make();restored.restore(once);sim.step(600);restored.step(600);control.step(600);
      check(kind+': a pending encouragement survives saving into the identical future',equal(sim.snapshot(),restored.snapshot()));
      const record=sim.semester.observation.supportApplied.find(s=>s.kind===kind&&s.week===1),task=sim.semester.commitments.find(c=>c.id===record?.commitmentId);
      check(kind+': the effect is applied to an activity that was physically performed',Boolean(record)&&task?.status==='completed'&&task.minutes>=25,JSON.stringify({record,task}));
      const outcomes=state=>({growth:state.semester.growth,money:state.semester.money,stress:state.semester.stress,relationships:[1,2,3].map(id=>state.students[0].relationships[id]),completed:state.semester.weekStats.completed});
      check(kind+': encouragement makes a measurable difference after the actual activity',!equal(outcomes(sim),outcomes(control)));
      for(let i=0;sim.semester.week===1&&i<700;i++)sim.step(17);
      check(kind+': a new week restores the optional opportunity without asking for a decision',sim.semester.week===2&&sim.semesterView().observation.canEncourage&&!sim.semesterBlocksTime);
    }
  });

  attempt('Malformed observation saves are rejected atomically',()=>{
    const sim=make();sim.startObservation({goal:'romance',focusId:2});sim.step(13);
    const stable=sim.snapshot();
    const corruptions=[
      ['unsupported version',bad=>bad.semester.observation.version=999],
      ['invalid enabled flag',bad=>bad.semester.observation.enabled='yes'],
      ['unknown wish',bad=>bad.semester.observation.wishGoal='everything'],
      ['unknown preferred friend',bad=>bad.semester.observation.preferredId=999],
      ['impossible start day',bad=>bad.semester.observation.startedDay=113],
      ['malformed plans',bad=>bad.semester.observation.plans={}],
      ['malformed choices',bad=>bad.semester.observation.choices={}],
      ['malformed milestone records',bad=>bad.semester.observation.achieved=[]],
      ['non-finite activity time',bad=>bad.semester.observation.activityMinutes.study=NaN],
      ['negative earned income',bad=>bad.semester.observation.earnedMoney=-1],
      ['unknown unlocked milestone',bad=>bad.semester.observation.achieved['invented-ending']={day:1,week:1,detail:'invalid'}],
      ['future encouragement',bad=>bad.semester.observation.lastEncouragement={kind:'rest',week:17}],
      ['malformed applied support',bad=>bad.semester.observation.supportApplied={}],
    ];
    for(const [label,mutate]of corruptions){const bad=copy(stable);mutate(bad);let rejected=false;try{sim.restore(bad);}catch{rejected=true;}check('Invalid observation save leaves the current life untouched: '+label,rejected&&equal(stable,sim.snapshot()));}
  });

  for(const [goal,configuration]of Object.entries(strategies))attempt(goal+' uninterrupted 112-day observation',()=>{
    const sim=make(configuration.trait),days=new Set([1]),weeks=new Map(),actions={},unlocks=[],seenMilestones=new Set();
    sim.startObservation({goal,focusId:configuration.focusId});
    let steps=0,blocked=0,visibleChoices=0,invalidProgress=0,prematureDates=0;
    const unsupportedMilestones=[];
    while(sim.semester.phase!=='complete'&&steps++<11000){
      const before=clock(sim),view=sim.semesterView(),observation=view.observation;
      days.add(sim.day);
      if(!weeks.has(view.week))weeks.set(view.week,{week:view.week,days:copy(view.days),focusId:view.focusId});
      if(sim.semesterBlocksTime)blocked++;
      if(view.decision)visibleChoices++;
      if(!Number.isFinite(observation.progress)||observation.progress<0||observation.progress>1)invalidProgress++;
      for(const milestone of observation.milestones)if(milestone.done&&!seenMilestones.has(milestone.id)){
        seenMilestones.add(milestone.id);unlocks.push({id:milestone.id,day:sim.day,week:view.week,record:copy(milestone)});
        if(!Number.isInteger(milestone.day)||milestone.day>sim.day||milestone.day<1||!Number.isInteger(milestone.week)||milestone.week>view.week||milestone.week!==Math.ceil(milestone.day/7))prematureDates++;
        if(!milestoneHasEvidence(milestone.id,sim))unsupportedMilestones.push(milestone.id);
      }
      if(goal==='scholar'&&view.week===3&&view.dayOfWeek===2&&sim.time>=700&&sim.time<735&&!checkpoints.decision)checkpoints.decision={goal,saved:sim.snapshot(),future:null,remaining:88,boundary:'choice'};
      if(goal==='romance'&&view.week===8&&view.dayOfWeek===6&&sim.time>=1000&&!checkpoints.relationship)checkpoints.relationship={goal,saved:sim.snapshot(),future:null,remaining:88,boundary:'plan'};
      sim.step(17);
      for(const checkpoint of Object.values(checkpoints))if(checkpoint.goal===goal&&checkpoint.remaining>0){checkpoint.remaining--;if(checkpoint.remaining===0)checkpoint.future=sim.snapshot();}
      if(clock(sim)===before&&sim.semester.phase!=='complete')throw new Error(`Observation stopped at week ${view.week}, day ${sim.day}, ${sim.clock}; phase=${sim.semester.phase}`);
      actions[sim.current.action]=(actions[sim.current.action]||0)+1;
      snapshotSample(sim);
    }
    const final=sim.semesterView(),observation=final.observation;
    for(const milestone of observation.milestones)if(milestone.done&&!seenMilestones.has(milestone.id)&&!milestoneHasEvidence(milestone.id,sim))unsupportedMilestones.push(milestone.id);
    days.add(sim.day);
    check(goal+': all 112 days pass after just one start, without any player choice',final.phase==='complete'&&equal([...days].sort((a,b)=>a-b),Array.from({length:112},(_,i)=>i+1)),`${days.size} days; ${steps} observation samples`);
    check(goal+': no planner, review or Wednesday choice interrupts observation',blocked===0&&visibleChoices===0,`${blocked} blocked states; ${visibleChoices} unresolved choices`);
    check(goal+': every week produces its own plan and retained review',weeks.size===16&&final.history.length===16&&final.history.every((r,i)=>r.week===i+1&&r.days===7));
    check(goal+': all 16 weekly decisions are explicitly recorded as autonomous',sim.semester.observation.choices.length===16&&sim.semester.choices.length===16&&sim.semester.observation.choices.every(c=>typeof c.reason==='string'&&c.reason.length>0)&&sim.semester.observation.plans.length===16);
    check(goal+': actual activities and course results occur without supervision',['class','eat','sleep'].every(action=>actions[action]>0)&&final.courses.every(c=>Number.isFinite(c.midterm)&&Number.isFinite(c.final)&&Number.isFinite(c.grade))&&sim.current.distance>1000,JSON.stringify(actions));
    check(goal+': the selected long-term wish is achievable with no encouragement',final.ending?.goal===goal&&final.ending?.success===true,JSON.stringify({ending:final.ending,growth:final.growth,courses:final.courses,relationships:final.npcs.map(n=>({id:n.id,...n.relationship})),money:final.money}));
    check(goal+': progress and milestone dates remain valid throughout the semester',invalidProgress===0&&prematureDates===0,JSON.stringify({invalidProgress,prematureDates,unlocks}));
    check(goal+': a first earned milestone appears within the first three actual days',observation.milestones.some(m=>m.done&&m.day>=1&&m.day<=3),JSON.stringify(observation.milestones.map(m=>({id:m.id,day:m.day,done:m.done}))));
    check(goal+': every unlocked milestone is supported by actual activity, relationship or academic results',unsupportedMilestones.length===0&&observation.milestones.every(m=>m.done)&&observation.progress===1,JSON.stringify({unsupportedMilestones,milestones:observation.milestones}));
    check(goal+': the observer receives recorded moments while life progresses',observation.recentMoment!==null&&typeof observation.recentMoment?.title==='string'&&typeof observation.recentMoment?.text==='string'&&observation.recentMoment.day<=sim.day&&observation.recentMoment.week<=16);
    const saved=sim.snapshot(),restored=make();restored.restore(saved);sim.step(1000000);restored.step(1000000);
    check(goal+': completion is the only permanent stop and survives saving',sim.semesterBlocksTime&&equal(saved,sim.snapshot())&&equal(saved,restored.snapshot()));
    completed[goal]=sim;
    stats.strategies[goal]={days:days.size,goalSuccess:final.ending?.success,grades:final.courses.map(c=>c.grade),growth:copy(final.growth),money:final.money,stress:final.stress,plans:[...weeks.values()],actions,milestones:copy(observation.milestones),unlocks,relationships:final.npcs.map(n=>({id:n.id,name:n.name,...copy(n.relationship)})),ending:copy(final.ending)};
  });

  attempt('Saved observation resumes into exactly the same life',()=>{
    for(const [label,checkpoint]of Object.entries(checkpoints)){
      const restored=make();restored.restore(checkpoint.saved);
      check(label+': observation state and milestones roundtrip exactly',equal(restored.snapshot(),checkpoint.saved));
      for(let i=0;i<88;i++)restored.step(17);
      check(label+': the restored student makes the same later plans and choices',equal(restored.snapshot(),checkpoint.future)&&restored.semester.observation.enabled);
      const key=checkpoint.boundary==='choice'?'choices':'plans';
      check(label+': the saved future comparison crosses a real automatic '+checkpoint.boundary,checkpoint.future.semester.observation[key].length>checkpoint.saved.semester.observation[key].length);
    }
    check('Both a midweek-decision and a relationship-review checkpoint were exercised',Boolean(checkpoints.decision)&&Boolean(checkpoints.relationship));
  });

  attempt('A completed old semester is never restarted by observation migration',()=>{
    const legacy=withoutObservation(completed.scholar.snapshot()),sim=make();sim.restore(legacy);sim.startObservation();sim.step(1000000);
    check('An old completed semester keeps its ending, results and clock',equal(withoutObservation(sim.snapshot()),legacy)&&sim.semester.phase==='complete'&&sim.day===112);
  });

  check('Observed students never enter a building',stats.positionSamples>0&&stats.collisions===0,`${stats.positionSamples} sampled positions; ${stats.collisions} collisions`);
  check('Observed students keep finite needs and remain on connected pedestrian edges',stats.invalidStates===0&&stats.offRoute===0,`${stats.invalidStates} invalid states; ${stats.offRoute} off-route samples`);
  return{pass:checks.every(c=>c.pass),checks,stats,runtimeMs:Math.round(performance.now()-started)};
}

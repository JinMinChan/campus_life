import {Simulation,distance,pointInPolygon} from '../src/simulation.js';

const copy=value=>JSON.parse(JSON.stringify(value));
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const clock=sim=>sim.day*1440+sim.time;

/** The same deterministic checks run in Node and the browser test page. */
export function verifySemester(data){
  const checks=[];
  const check=(name,condition,detail='')=>checks.push({name,pass:Boolean(condition),detail});
  const attempt=(name,run)=>{try{run();}catch(error){check(name,false,error.stack||String(error));}};
  const simulations={},branchSnapshots={};
  const make=(trait='curious')=>new Simulation(data,trait);
  const options=sim=>sim.semesterView().decision?.options||[];
  const pick=(sim,preferred=[])=>{
    const available=options(sim).filter(option=>!option.disabled);
    const option=preferred.map(id=>available.find(o=>o.id===id)).find(Boolean)||available[0];
    if(!option)throw new Error('A pending decision has no selectable option.');
    sim.chooseSemesterOption(option.id);
    return option.id;
  };
  const choices={
    scholar:['routine','lead','cram','quiet','give-space','spend-time'],
    friendship:['spend-time','support','join','introduce','host'],
    independent:['extra-work','solo','give-space','steady','recover'],
    romance:['date','confess','spend-time','support'],
  };
  const strategies={
    scholar:{trait:'diligent',slots:['study','study','rest'],focusId:1,goal:'scholar'},
    friendship:{trait:'social',slots:['friend','club','friend'],focusId:2,goal:'friendship'},
    independent:{trait:'curious',slots:['work','work','rest'],focusId:3,goal:'independent'},
    romance:{trait:'social',slots:['friend','club','friend'],focusId:2,goal:'romance'},
  };
  const stats={strategies:{},positionSamples:0,collisions:0,offRoute:0,invalidNeeds:0,invalidResources:0,stalledWalking:0};
  const sample=(sim,previous)=>{
    for(const student of sim.students){
      stats.positionSamples++;
      if(data.buildings.some(building=>pointInPolygon(student.position,building.points)))stats.collisions++;
      if(!student.position.every(Number.isFinite)||['energy','satiety','academic','mood','social'].some(key=>!Number.isFinite(student[key])||student[key]<0||student[key]>100))stats.invalidNeeds++;
      if(student.phase==='walking'){
        const from=sim.graph.nodes[student.node],to=sim.graph.nodes[student.route[student.routeIndex]];
        if(!from||!to||distance(from.p,student.position)+distance(student.position,to.p)-distance(from.p,to.p)>.03)stats.offRoute++;
        if(previous&&previous[student.id].phase==='walking'&&distance(previous[student.id].position,student.position)<.001)stats.stalledWalking++;
      }
    }
  };

  attempt('Semester initialization and planning time lock',()=>{
    const sim=make(),before=sim.snapshot(),view=sim.semesterView();
    check('A new student starts in week 1 with a pending weekly plan',view.week===1&&view.phase==='planning');
    sim.step(100000);
    check('Planning blocks simulated time and all world state',sim.semesterBlocksTime&&equal(before,sim.snapshot()));
    const invalid=[{slots:['study','rest']},{slots:['study','invented','rest']},{slots:['study','work','rest'],focusId:999},{slots:['study','work','rest'],goal:'invented'}];
    for(const plan of invalid){let rejected=false;try{sim.startWeek({...strategies.scholar,...plan});}catch{rejected=true;}check('Invalid weekly plan is rejected atomically: '+JSON.stringify(plan),rejected&&equal(before,sim.snapshot()));}
  });

  attempt('An unstarted seven-day planning draft is saved and restored',()=>{
    const sim=make(),days=Array.from({length:7},(_,i)=>i<5?['study','friend','rest']:['work','club','rest']);
    sim.setWeekDraft({days,focusId:3,goal:'independent'});
    const saved=sim.snapshot(),restored=make();restored.restore(saved);
    check('Editing a weekly draft preserves all seven different days and keeps planning paused',sim.semester.phase==='planning'&&equal(sim.semesterView().days,days)&&sim.semester.focusId===3&&sim.semester.goal==='independent'&&sim.semesterBlocksTime);
    check('A planning draft roundtrips exactly before starting the week',equal(saved,restored.snapshot()));
    restored.startWeek();
    check('Starting after restore executes the saved draft without replacing it with defaults',equal(restored.semesterView().days,days)&&restored.semester.focusId===3&&restored.semester.goal==='independent'&&restored.semester.commitments.length===21);
  });

  attempt('Lifecycle boundaries and exact save continuation',()=>{
    const sim=make();sim.startWeek(strategies.scholar);sim.step(.13);
    const resume=(label,minutes,act)=>{
      const saved=sim.snapshot(),restored=make();restored.restore(saved);
      check(label+' save restores exactly',equal(restored.snapshot(),saved));
      if(act){act(sim);act(restored);}
      sim.step(minutes);restored.step(minutes);
      check(label+' save continues into an identical future',equal(sim.snapshot(),restored.snapshot()));
    };
    check('The first living scene contains an actual moving student',sim.students.some(s=>s.phase==='walking'));
    let stalled=0,movingSamples=0;
    for(let i=0;i<100;i++){
      const before=sim.students.map(s=>({phase:s.phase,action:s.action,destination:s.destination.id,position:[...s.position]}));sim.step(.05);
      for(const s of sim.students)if(before[s.id].phase==='walking'&&s.phase==='walking'&&before[s.id].action===s.action&&before[s.id].destination===s.destination.id){movingSamples++;if(distance(before[s.id].position,s.position)<.001)stalled++;}
    }
    check('Unblocked walkers keep moving at short time intervals',movingSamples>0&&stalled===0,`${movingSamples} samples at 0.05 minute intervals; ${stalled} stalls`);
    resume('Mid-walk',12);
    sim.step(100000);
    check('A large step stops exactly at Wednesday 12:15 for the pending choice',Boolean(sim.semesterView().decision)&&sim.semesterView().phase==='living'&&sim.semesterBlocksTime&&sim.day===3&&Math.abs(sim.time-735)<1e-6);
    const decision=sim.snapshot();sim.step(100000);
    check('A pending choice cannot be bypassed by fast-forward',equal(decision,sim.snapshot()));
    resume('Pending decision',18,target=>pick(target));
    sim.step(100000);
    check('Time stops exactly at Sunday 18:30 without spilling into week 2',sim.semesterView().phase==='review'&&sim.semesterView().week===1&&sim.semesterBlocksTime&&sim.day===7&&Math.abs(sim.time-1110)<1e-6);
    const review=sim.snapshot();sim.step(100000);
    check('Weekly review remains unchanged until the player advances',equal(review,sim.snapshot()));
    resume('Weekly review',0,target=>target.advanceWeek());
    check('Advancing review opens week 2 planning instead of starting automatically',sim.semesterView().phase==='planning'&&sim.semesterView().week===2&&sim.semesterBlocksTime);
  });

  attempt('Version 2 migration and corrupt version 3 atomic rejection',()=>{
    const original=make('social'),legacy=copy(original.snapshot());
    delete legacy.semester;legacy.version=2;
    for(const student of legacy.students){
      delete student.semesterTask;
      for(const relationship of Object.values(student.relationships))for(const key of ['trust','friendship','romance','status','sharedActivities','dates','lastWeek','declinedUntil','neglectedWeeks','lastConversation'])delete relationship[key];
    }
    legacy.students[0].relationships[2]={affinity:82,encounters:12,sharedMeals:6,studySessions:3,lastDay:7,friendSince:2};
    legacy.students[2].relationships[0]=copy(legacy.students[0].relationships[2]);
    legacy.students[0].memories.unshift({kind:'friend',text:'박서연과 여러 번 점심을 함께 먹은 기억.',day:7,time:'12:00',with:2});
    const migrated=make('diligent');migrated.restore(legacy);
    check('Version 2 world saves migrate to a fresh semester planning state',migrated.snapshot().version===3&&migrated.semesterView().phase==='planning'&&migrated.semesterView().week===1);
    const retainedRelations=Object.entries(legacy.students[0].relationships).every(([id,relationship])=>Object.entries(relationship).every(([key,value])=>equal(value,migrated.current.relationships[id][key])));
    check('Version 2 migration preserves personality, accumulated memories and relationships',migrated.current.trait===legacy.students[0].trait&&legacy.students[0].memories.slice(0,29).every(memory=>migrated.current.memories.some(m=>equal(memory,m)))&&retainedRelations);
    check('A real version 2 friendship remains recognizable in the new relationship system',migrated.current.relationships[2].friendship>=30&&migrated.current.relationships[2].trust>=30&&migrated.current.relationships[2].status==='friend'&&migrated.current.relationships[2].sharedActivities>=9);
    migrated.startWeek(strategies.friendship);migrated.step(3);
    check('A migrated student resumes actual movement safely',migrated.current.position.every(Number.isFinite)&&!data.buildings.some(b=>pointInPolygon(migrated.current.position,b.points))&&!migrated.semesterBlocksTime);
    const stable=migrated.snapshot(),corruptions=[
      ['missing semester',bad=>delete bad.semester],
      ['out-of-range week',bad=>bad.semester.week=17],
      ['fractional week',bad=>bad.semester.week=1.5],
      ['unknown semester phase',bad=>bad.semester.phase='teleporting'],
      ['unknown relationship focus',bad=>bad.semester.focusId=999],
      ['unknown goal',bad=>bad.semester.goal='everything'],
      ['invalid growth',bad=>bad.semester.growth.knowledge=NaN],
      ['invalid money',bad=>bad.semester.money=NaN],
      ['out-of-range stress',bad=>bad.semester.stress=101],
      ['missing courses',bad=>bad.semester.courses=[]],
      ['malformed history',bad=>bad.semester.history={}],
      ['malformed commitments',bad=>bad.semester.commitments={}],
      ['missing calendar day',bad=>bad.semester.days.pop()],
      ['invalid semester relationship',bad=>bad.students[0].relationships[2].friendship=NaN],
      ['invalid world position',bad=>bad.students[0].position=[]],
    ];
    for(const [label,change]of corruptions){const bad=copy(stable);change(bad);let rejected=false;try{migrated.restore(bad);}catch{rejected=true;}check('Corrupt version 3 save rejected atomically: '+label,rejected&&equal(stable,migrated.snapshot()));}
  });

  attempt('Personality still changes autonomous behavior under the same weekly plan',()=>{
    const patterns={};
    for(const trait of ['curious','diligent','social']){
      const sim=make(trait),actions={};sim.startWeek({slots:['rest','rest','rest'],focusId:1,goal:'independent'});
      for(let steps=0;sim.semesterView().phase==='living'&&steps<700;steps++){
        if(sim.semesterView().decision){pick(sim,['give-space','rest']);continue;}
        sim.step(17);actions[sim.current.action]=(actions[sim.current.action]||0)+1;
      }
      patterns[trait]=actions;
    }
    check('The diligent student independently chooses more study than the explorer',(patterns.diligent.study||0)>(patterns.curious.study||0),JSON.stringify(patterns));
    check('The social student independently seeks more conversation than the planner',(patterns.social.social||0)>(patterns.diligent.social||0),JSON.stringify(patterns));
    stats.personalityPatterns=patterns;
  });

  attempt('A seven-day plan earns outcomes only through its scheduled activities',()=>{
    const sim=make('diligent'),days=Array.from({length:7},()=>['rest','rest','rest']);
    days[5]=['work','work','work'];days[6]=['club','friend','rest'];
    sim.startWeek({days,focusId:2,goal:'independent'});
    check('The complete Monday-to-Sunday plan is retained without copying one day over another',equal(sim.semesterView().days,days));
    sim.step(100);
    check('Scheduling future work grants neither advance wages nor independence',sim.semester.growth.independence===10&&sim.semester.commitments.filter(c=>c.kind==='work').every(c=>c.status==='pending'&&c.paid===0));
    while(sim.semester.phase==='living'){if(sim.semester.decision)pick(sim,['recover']);else sim.step(100000);}
    const tasks=sim.semester.commitments,work=tasks.filter(c=>c.kind==='work');
    check('Saturday jobs are actually performed and paid after time spent working',work.length===3&&work.every(c=>c.day===6&&c.status==='completed'&&c.minutes>=25&&c.paid>0&&c.paid<=22000*Math.min(1,c.minutes/45)+1),JSON.stringify(work.map(c=>({day:c.day,minutes:c.minutes,paid:c.paid,status:c.status}))));
    check('Sunday plans produce an actual club meeting and shared friend activity',tasks.some(c=>c.day===7&&c.kind==='club'&&c.status==='completed'&&c.sharedMinutes>=20)&&tasks.some(c=>c.day===7&&c.kind==='friend'&&c.status==='completed'&&c.sharedMinutes>=20));
    check('The weekly report accounts for seven real days and all planned commitments',sim.semester.report.days===7&&sim.semester.report.firstDay===1&&sim.semester.report.lastDay===7&&sim.semester.report.completed.length+sim.semester.report.missed.length===21);
  });

  attempt('Unplanned companionship is real relationship progress, without counting planned time twice',()=>{
    const sim=make(),before=copy(sim.students[0].relationships[1]);
    sim.startWeek({slots:['rest','rest','rest'],focusId:1,goal:'scholar'});
    while(sim.semester.phase==='living'){if(sim.semester.decision)pick(sim,['recover','give-space']);else sim.step(100000);}
    const friend=sim.students[0].relationships[1];
    check('At least five naturally shared meals grow friendship and trust without planned meetings',friend.sharedMeals-before.sharedMeals>=5&&friend.friendship>before.friendship+1&&friend.trust>before.trust+.5&&sim.semester.commitments.every(c=>c.partnerId!==1),JSON.stringify({before,after:friend}));
    check('Natural shared meals retain meaningful shared time and relationship experience',sim.semester.weekStats.sharedMinutes[1]>=100&&friend.sharedActivities>=5&&Object.values(sim.semester.weekStats.naturalMinutes).some(n=>n>0),JSON.stringify({sharedMinutes:sim.semester.weekStats.sharedMinutes[1],sharedActivities:friend.sharedActivities}));
    check('Natural relationship growth stays bounded for each person and calendar day',Object.values(sim.semester.weekStats.naturalMinutes).every(minutes=>minutes>=0&&minutes<=90.001));
    const saved=sim.snapshot(),restored=make();restored.restore(saved);
    check('Naturally earned relationships and their daily credit records survive saving exactly',equal(saved,restored.snapshot()));
    const planned=make();planned.startWeek({slots:['friend','rest','rest'],focusId:2,goal:'romance'});
    for(let i=0;i<120;i++){
      const task=planned.current.semesterTask,partner=planned.students[2];
      if(task&&planned.current.phase==='acting'&&partner.phase==='acting'&&partner.semesterTask?.id===task.id)break;
      planned.step(1);
    }
    const taskId=planned.current.semesterTask?.id,commitment=planned.semester.commitments.find(c=>c.id===taskId),naturalBefore=planned.semester.weekStats.naturalMinutes[planned.day+':2']||0,sharedBefore=commitment?.sharedMinutes||0;
    planned.step(1);
    const naturalAfter=planned.semester.weekStats.naturalMinutes[planned.day+':2']||0;
    check('A scheduled meeting counts shared time once, without also claiming natural-contact credit',Boolean(commitment)&&commitment.sharedMinutes>sharedBefore+.9&&naturalBefore===naturalAfter,JSON.stringify({sharedBefore,sharedAfter:commitment?.sharedMinutes,naturalBefore,naturalAfter}));
  });

  attempt('An early confession is resolved by an actual meeting and can be rejected',()=>{
    const sim=make('social');sim.startWeek({slots:['rest','rest','rest'],focusId:2,goal:'romance'});sim.step(100000);
    const before=copy(sim.students[0].relationships[2]),pending=sim.snapshot();
    let rejected=false;try{sim.chooseSemesterOption('not-a-real-option');}catch{rejected=true;}
    check('An unknown choice is rejected without dismissing or altering the pending decision',rejected&&equal(pending,sim.snapshot()));
    sim.chooseSemesterOption('confess');
    check('Clicking confess does not instantly create affection or a relationship',equal(before,sim.students[0].relationships[2])&&sim.semester.pendingConversation?.resolved===false);
    const saved=sim.snapshot(),restored=make();restored.restore(saved);sim.step(100000);restored.step(100000);
    const relation=sim.students[0].relationships[2],meeting=sim.semester.commitments.find(c=>c.conversation==='confess');
    check('A queued conversation survives saving and produces the identical outcome',equal(sim.snapshot(),restored.snapshot()));
    check('The confession outcome requires both students to physically spend time at the appointment',meeting?.status==='completed'&&meeting.sharedMinutes>=15&&sim.semester.pendingConversation?.resolved===true,JSON.stringify(meeting));
    check('Insufficient mutual experience produces rejection and a persistent boundary',relation.status==='declined'&&relation.declinedUntil>sim.semester.week&&typeof relation.lastConversation==='string',JSON.stringify(relation));
    sim.advanceWeek();
    check('A declined confession still affects the next week',sim.students[0].relationships[2].status==='declined'&&sim.students[0].relationships[2].declinedUntil>=3);
  });

  for(const [name,strategy] of Object.entries(strategies))attempt(name+' complete-semester strategy',()=>{
    const sim=make(strategy.trait),observed=new Set(),weekNumbers=[],days=new Set(),weekendClasses=[],weekly=[];
    let iterations=0;
    while(sim.semesterView().phase!=='complete'&&iterations++<14000){
      const view=sim.semesterView();
      days.add(sim.day);
      if(!Number.isFinite(view.money)||!Number.isFinite(view.stress)||view.stress<0||view.stress>100||Object.values(view.growth).some(v=>!Number.isFinite(v)||v<0||v>100))stats.invalidResources++;
      if(view.phase==='planning'){
        if(name==='romance'&&!branchSnapshots.datingPlanning&&view.npcs.find(n=>n.id===2).relationship.status==='dating')branchSnapshots.datingPlanning=sim.snapshot();
        weekNumbers.push(view.week);sim.startWeek(name==='friendship'?{...strategy,focusId:view.week%2?1:2}:strategy);
      }else if(view.decision){
        if(name==='scholar'&&view.week===4||name==='independent'&&view.week===8)branchSnapshots[view.week]=sim.snapshot();
        let preferred=choices[name]||[];
        if(name==='romance'){
          const npc=view.npcs.find(n=>n.id===view.focusId),r=npc.relationship;
          const ready=r.friendship>=45&&r.trust>=35&&r.romance>=20&&r.sharedActivities>=5&&view.week>=r.declinedUntil&&view.growth[npc.growth]>=npc.minimum;
          preferred=r.status==='dating'?['date','support']:ready?['confess','spend-time']:['spend-time','join','support'];
        }
        const id=pick(sim,preferred);weekly.push({week:view.week,choice:id});
      }else if(view.phase==='review'){
        weekly.push({week:view.week,review:copy(view.report)});sim.advanceWeek();
      }else{
        const previous=sim.students.map(s=>({phase:s.phase,position:[...s.position]}));
        const before=clock(sim);sim.step(17);
        if(clock(sim)===before&&!sim.semesterBlocksTime)throw new Error('Living semester stopped making progress.');
        observed.add(sim.current.action);
        if((sim.day-1)%7>=5&&sim.current.action==='class'&&sim.current.phase!=='walking')weekendClasses.push({day:sim.day,time:sim.time});
        sample(sim,previous);
      }
    }
    const final=sim.semesterView();
    check(name+': all 16 weeks are played exactly once',equal(weekNumbers,Array.from({length:16},(_,i)=>i+1)),JSON.stringify(weekNumbers));
    check(name+': all 112 calendar days actually occur',equal([...days].sort((a,b)=>a-b),Array.from({length:112},(_,i)=>i+1)),`${days.size} distinct observed days`);
    check(name+': weekends do not contain scheduled classes',weekendClasses.length===0,JSON.stringify(weekendClasses.slice(0,5)));
    check(name+': completion has a persistent final report',final.phase==='complete'&&Boolean(final.report));
    check(name+': all 16 weeks retain review results including the final week',final.history?.length===16&&weekly.filter(w=>w.review).length===15,`${final.history?.length} stored reports; ${weekly.filter(w=>w.review).length} intermediate reviews`);
    const beforeExams=final.history.filter(report=>report.week<8),afterMidterm=final.history.filter(report=>report.week>=8&&report.week<16);
    check(name+': midterms happen in week 8 and finals in week 16',beforeExams.every(r=>r.courses.every(c=>c.midterm===null&&c.final===null))&&afterMidterm.every(r=>r.courses.every(c=>Number.isFinite(c.midterm)&&c.final===null))&&final.courses.every(c=>Number.isFinite(c.midterm)&&Number.isFinite(c.final)&&Number.isFinite(c.grade)));
    check(name+': the final report evaluates the chosen semester goal',final.ending?.goal===strategy.goal&&typeof final.ending?.success==='boolean'&&final.ending?.highlights?.length>=3,JSON.stringify(final.ending));
    const finalSnapshot=sim.snapshot(),restored=make();restored.restore(finalSnapshot);sim.step(100000);restored.step(100000);
    check(name+': completed semester is stable and roundtrips through saving',equal(finalSnapshot,sim.snapshot())&&equal(finalSnapshot,restored.snapshot()));
    simulations[name]=sim;
    stats.strategies[name]={growth:copy(final.growth),money:final.money,stress:final.stress,actions:[...observed],courses:copy(final.courses),relationships:copy(final.npcs),report:copy(final.report),ending:copy(final.ending),weekly};
  });

  check('Whole-semester movement never enters building footprints',stats.positionSamples>0&&stats.collisions===0,`${stats.positionSamples} sampled student positions; ${stats.collisions} collisions`);
  check('Whole-semester walking stays on connected graph edges',stats.offRoute===0,`${stats.offRoute} invalid route samples`);
  check('Whole-semester students retain finite positions and bounded needs',stats.invalidNeeds===0,`${stats.invalidNeeds} invalid samples`);
  check('Growth, stress, and money remain valid throughout all strategies',stats.invalidResources===0,`${stats.invalidResources} invalid resource states`);

  attempt('Plans create materially different lives',()=>{
    const scholar=simulations.scholar.semesterView(),friends=simulations.friendship.semesterView(),worker=simulations.independent.semesterView(),romance=simulations.romance.semesterView();
    const relation=(view,id)=>view.npcs.find(npc=>npc.id===id)?.relationship;
    check('A study-heavy semester builds more knowledge than paid-work weeks',scholar.growth.knowledge>worker.growth.knowledge+5,`${scholar.growth.knowledge} versus ${worker.growth.knowledge}`);
    check('Clubs and friends develop more expression than isolated study',friends.growth.expression>scholar.growth.expression+5,`${friends.growth.expression} versus ${scholar.growth.expression}`);
    check('Actual paid shifts create meaningful additional money',worker.money>scholar.money+200000,`${worker.money} versus ${scholar.money} won`);
    check('Paid work develops independence beyond study-only plans',worker.growth.independence>scholar.growth.independence+5,`${worker.growth.independence} versus ${scholar.growth.independence}`);
    check('Academic planning materially improves final course results',scholar.courses.reduce((n,c)=>n+c.grade,0)>worker.courses.reduce((n,c)=>n+c.grade,0)+6,JSON.stringify({scholar:scholar.courses.map(c=>c.grade),work:worker.courses.map(c=>c.grade)}));
    check('Spending time with a chosen friend changes that specific relationship',relation(friends,2).friendship>relation(scholar,2).friendship+10&&relation(friends,2).sharedActivities>=10,JSON.stringify({social:relation(friends,2),study:relation(scholar,2)}));
    check('The romance path reaches a mutual relationship through real shared activities',relation(romance,2).status==='dating'&&relation(romance,2).dates>0&&relation(romance,2).sharedActivities>=10,JSON.stringify(relation(romance,2)));
    for(const [name,view]of Object.entries({scholar,friends,worker,romance}))check('A sustained matching strategy can achieve its semester goal: '+name,view.ending.success===true,JSON.stringify(view.ending));
  });

  attempt('Choosing differently changes actual future state',()=>{
    for(const week of [4,8]){
      const a=make(),b=make();a.restore(branchSnapshots[week]);b.restore(branchSnapshots[week]);
      const available=options(a).filter(option=>!option.disabled);
      if(available.length<2)throw new Error(`Week ${week} lacks two alternative choices.`);
      a.chooseSemesterOption(available[0].id);b.chooseSemesterOption(available[1].id);
      a.step(100000);b.step(100000);
      const result=sim=>{const view=sim.semesterView();return{growth:view.growth,money:view.money,stress:view.stress,courses:view.courses,relationships:view.npcs.map(npc=>npc.relationship)};};
      check(`Week ${week} choices produce different growth, resources, grades or relationships`,!equal(result(a),result(b)),`${available[0].id} versus ${available[1].id}`);
    }
  });

  attempt('An established relationship responds to neglect and to time spent together',()=>{
    const sim=make();sim.restore(branchSnapshots.datingPlanning);
    sim.startWeek({slots:['rest','rest','rest'],focusId:1,goal:'romance'});
    while(sim.semester.phase==='living'){if(sim.semester.decision)pick(sim,['give-space','quiet','steady','recover']);else sim.step(100000);}
    check('Naturally sharing meals with a partner prevents a false neglect penalty',sim.semester.weekStats.sharedMinutes[2]>=35&&sim.students[0].relationships[2].neglectedWeeks===0,JSON.stringify({actualSharedMinutes:sim.semester.weekStats.sharedMinutes[2],relationship:sim.students[0].relationships[2]}));
    sim.advanceWeek();
    const before=copy(sim.students[0].relationships[2]);
    for(let week=0;week<2;week++){
      sim.startWeek({slots:['rest','rest','rest'],focusId:1,goal:'romance'});
      // An explicit absence fixture keeps this NPC physically asleep at the dorm.
      // Missing a plan alone is not neglect: freely shared meals must also count.
      const partner=sim.students[2],dorm=sim.venues.find(v=>v.id==='dorm');
      Object.assign(partner,{node:dorm.node,position:[...dorm.point],destination:dorm,route:[dorm.node],routeIndex:1,phase:'acting',action:'sleep',remaining:20000,pose:'sleep',classSession:null,invitation:null,semesterTask:null,activityElapsed:0,companions:[],companionId:null});
      while(sim.semester.phase==='living'){if(sim.semester.decision)pick(sim,['give-space','quiet','steady','recover']);else sim.step(100000);}
      check(`Controlled absence week ${week+1} has no actual shared quality time`,(sim.semester.weekStats.sharedMinutes[2]||0)===0);
      sim.advanceWeek();
    }
    const neglected=copy(sim.students[0].relationships[2]);
    check('Two weeks without an actual meeting reduce trust and retain relationship tension',neglected.neglectedWeeks>=2&&neglected.trust<before.trust-10&&neglected.romance<before.romance,JSON.stringify({before,neglected}));
    const saved=sim.snapshot(),restored=make();restored.restore(saved);
    check('Relationship neglect persists through saving and reopening',equal(neglected,restored.students[0].relationships[2]));
    sim.startWeek({slots:['friend','club','friend'],focusId:2,goal:'romance'});
    while(sim.semester.phase==='living'){if(sim.semester.decision)pick(sim,['support','date','spend-time']);else sim.step(100000);}
    const recovered=sim.students[0].relationships[2];
    check('Returning to shared activities rebuilds trust and resolves the neglect counter',recovered.status==='dating'&&recovered.neglectedWeeks===0&&recovered.trust>neglected.trust,JSON.stringify({neglected,recovered}));
  });

  return{pass:checks.every(c=>c.pass),checks,stats};
}

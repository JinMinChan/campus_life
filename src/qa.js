import {Simulation,pointInPolygon} from './simulation.js?v=5';
const $=id=>document.getElementById(id);
export async function runQA(api){
 const checks=[],check=(name,condition,detail='')=>checks.push({name,pass:Boolean(condition),detail});
 try{
  $('next-step').click();document.querySelector('[data-trait="curious"]').click();$('start').click();api.setPaused(true);
  let sim=api.sim,world=api.world;
  check('Campus and personality selection starts a new autonomous student',api.state.started&&sim.current.trait==='curious'&&$('setup').hidden);
  const planning=JSON.stringify(sim.snapshot());sim.step(120);check('A new semester waits for the player plan',sim.semester.phase==='planning'&&JSON.stringify(sim.snapshot())===planning);
  api.updateUI();
  if(['semester','relationships'].includes(api.params.get('view'))){
    document.querySelector('[data-focus="2"]').click();document.querySelector('[data-goal="romance"]').click();
    for(let day=0;day<7;day++)for(let slot=0;slot<3;slot++){document.querySelector(`[data-plan-day="${day}"][data-slot="${slot}"]`).click();document.querySelector(`[data-activity="${['friend','club','friend'][slot]}"]`).click();}
  }
  const friday=document.querySelector('[data-plan-day="4"][data-slot="2"]');if(friday){friday.click();document.querySelector('[data-activity="work"]').click();}
  document.getElementById('semester-start-week').click();
  check('The seven-day planner preserves a specific Friday activity',sim.semester.days?.[4]?.[2]==='work');
  check('Weekly planner starts actual campus life',sim.semester.phase==='living'&&!api.semesterUI.isOpen);
  const initial=sim.current.position.slice();sim.step(1);check('Student moves along campus path',Math.hypot(initial[0]-sim.current.position[0],initial[1]-sim.current.position[1])>1);
  world.render();const character=world.characters[sim.selected].group.position;
  check('3D student follows simulation position',Math.abs(character.x-sim.current.position[0])<.1&&Math.abs(character.z-sim.current.position[1])<.1);
  check('Selected walking point outside building footprints',!sim.data.buildings.some(b=>pointInPolygon(sim.current.position,b.points)));
  check('Walking route reaches destination',sim.current.route.at(-1)===sim.current.destination.node);
  $('follow').click();check('Follow control follows selected student',world.follow);
  check('Follow is close enough to read student gestures',world.camera.position.distanceTo(world.controls.target)<180);
  $('labels').click();check('Labels toggle off',!world.labelsVisible);$('labels').click();
  const c=world.camera.position.clone();$('zoom-in').click();check('Zoom changes camera position',world.camera.position.distanceTo(c)>1);
  const c2=world.camera.position.clone();$('rotate-left').click();check('Rotation changes camera position',world.camera.position.distanceTo(c2)>1);
  $('roster-toggle').click();document.querySelector('[data-student="2"]').click();check('Roster selects and follows another student',sim.selected===2&&world.follow);
  $('my-student').click();check('My student control returns to protagonist',sim.selected===0);
  for(const rate of [1,3,12]){document.querySelector(`[data-speed="${rate}"]`).click();check(`Speed ${rate} is selected and indicated`,api.state.speed===rate&&document.querySelector(`[data-speed="${rate}"]`).getAttribute('aria-pressed')==='true');}
  $('pause').click();check('Resume toggles playback',!api.state.paused);$('pause').click();check('Pause freezes playback state',api.state.paused);
  const freeze=sim.time;await new Promise(r=>setTimeout(r,200));check('Paused render loop does not advance simulation',sim.time===freeze);
  $('details-toggle').click();check('Details expand with decision reasons',!$('student-details').hidden&&$('decision-reason').textContent.length>10);$('details-toggle').click();
  $('memory-toggle').click();check('Persistent memory view opens',!$('memory-entries').hidden);$('memory-toggle').click();
  $('photo').click();check('Photo view hides UI',document.body.classList.contains('photo-mode'));$('exit-photo').click();
  check('Photo view returns to controls',!document.body.classList.contains('photo-mode'));
  const before=api.snapshot();api.restoreSnapshot(JSON.parse(JSON.stringify(before)));sim=api.sim;world=api.world;
  const restoredSave=api.snapshot(),sameLife=JSON.stringify({...before,ui:null})===JSON.stringify({...restoredSave,ui:null}),sameControls=['speed','paused','follow','labelsVisible'].every(k=>before.ui[k]===restoredSave.ui[k]),sameCamera=['camera','target'].every(k=>before.ui[k].every((n,i)=>Math.abs(n-restoredSave.ui[k][i])<1e-7));
  check('Save restores exact life state, playback and camera within numeric precision',sameLife&&sameControls&&sameCamera);
  const testKey='hanyang-days-qa-only',encoded=JSON.stringify(api.snapshot());
  try{localStorage.setItem(testKey,encoded);const persisted=JSON.parse(localStorage.getItem(testKey)),restored=new Simulation(sim.data,persisted.trait);restored.restore(persisted);check('Browser localStorage persists relationships, memory and position',JSON.stringify(restored.snapshot().students)===JSON.stringify(sim.snapshot().students));}finally{localStorage.removeItem(testKey);}
  const safe=JSON.stringify(api.snapshot());let rejected=false;try{api.restoreSnapshot({version:2,students:[]});}catch{rejected=true;}
  check('Corrupt import is rejected without replacing current game',rejected&&JSON.stringify(api.snapshot())===safe);
  $('help').click();check('Help opens and pauses game',$('info-dialog').open&&api.state.paused);$('close-info').click();
  check('Data source notes are available',$('data-notes').children.length>=4);
  world.resetCamera();world.render();check('Overview renders all campus buildings',world.stats.buildings===62);check('WebGL renders substantial scene',world.renderer.info.render.triangles>1000);
  check('No caught runtime errors',api.state.errors.length===0);
  document.getElementById('semester-open').click();document.querySelector('[data-tab="calendar"]').click();check('Academic calendar opens in the semester notebook',api.semesterUI.isOpen&&document.body.textContent.includes('중간고사'));document.querySelector('#semester-notebook [data-do="close"]').click();
  const weekStart=sim.semester.week;sim.step(100000);api.updateUI();
  check('Weekly decision interrupts actual multi-day life',Boolean(sim.semester.decision)&&sim.semesterBlocksTime&&sim.day===3);
  const decisionSaved=api.snapshot();api.restoreSnapshot(JSON.parse(JSON.stringify(decisionSaved)));sim=api.sim;
  check('Saving restores a pending decision',JSON.stringify(sim.snapshot().semester)===JSON.stringify(decisionSaved.semester));
  const option=document.querySelector('[data-semester-option]:not([disabled])');if(!option)throw new Error('No visible semester option control');option.click();
  check('Choosing a decision through UI resumes the week',!sim.semester.decision&&!api.semesterUI.isOpen);
  sim.step(100000);api.updateUI();
  check('Weekly review follows all seven actual days',sim.semester.phase==='review'&&sim.day===7&&api.semesterUI.isOpen);
  document.getElementById('semester-next').click();
  check('Weekly review opens the following weekly planner',sim.semester.week===weekStart+1&&sim.semester.phase==='planning');
  if(api.params.get('view')!=='planner')document.getElementById('semester-start-week').click();
  if(['semester','relationships'].includes(api.params.get('view'))){
    let turns=0;while(sim.semester.phase!=='complete'&&turns++<100){
      api.updateUI();if(sim.semester.phase==='planning')document.getElementById('semester-start-week').click();
      else if(sim.semester.decision){const r=sim.students[0].relationships[2];const preferred=r.status==='dating'?'date':r.friendship>=45&&r.trust>=35&&r.romance>=20&&r.sharedActivities>=5&&sim.semester.growth.expression>=20?'confess':'spend-time';(document.querySelector(`[data-semester-option="${preferred}"]:not([disabled])`)||document.querySelector('[data-semester-option]:not([disabled])')).click();}
      else if(sim.semester.phase==='review')document.getElementById('semester-next').click();
      else sim.step(100000);
    }api.updateUI();check('Sixteen-week UI flow reaches the final report after 112 days',sim.semester.phase==='complete'&&sim.day===112);
    check('A full semester develops an actual mutual romance',sim.students[0].relationships[2]?.status==='dating'&&sim.students[0].relationships[2]?.dates>=3);
    const ending=api.snapshot();api.restoreSnapshot(JSON.parse(JSON.stringify(ending)));sim=api.sim;check('Final semester report survives save and restore',JSON.stringify(sim.snapshot().semester)===JSON.stringify(ending.semester));
  }
  // Capture meaningful initial observation; no fabricated events or forced story state.
  document.querySelector('[data-speed="1"]').click();api.setPaused(true);world.resetCamera();
  if(api.params.get('view')==='close')world.focusStudent(100);
  if(api.params.get('view')==='story'){sim.step(200);world.focusStudent(110);}
  api.updateUI();
  if(api.params.get('view')==='relationships'){
    document.querySelector('[data-do="ending-notebook"]').click();document.querySelector('[data-tab="friends"]').click();
    await new Promise(resolve=>setTimeout(resolve,100));api.updateUI();
    const partner=document.querySelector('.semester-friend-card.dating');
    check('Completed relationship notebook keeps its selected tab after queued close events',api.semesterUI.isOpen&&document.querySelector('[data-tab="friends"]').getAttribute('aria-pressed')==='true');
    check('Completed relationship notebook shows the actual partner',partner?.textContent.includes('박서연')&&partner?.textContent.includes('연인')&&document.querySelectorAll('.semester-friend-card').length===3);
  }
  world.render();api.toast();
  const report={pass:checks.every(c=>c.pass),checks,world:world.stats,semester:{week:sim.semester.week,day:sim.day,phase:sim.semester.phase},clock:sim.clock,studentPosition:sim.current.position,render:{calls:world.renderer.info.render.calls,triangles:world.renderer.info.render.triangles},errors:api.state.errors};
  const pre=document.createElement('pre');pre.id='qa-results';pre.hidden=true;pre.textContent=JSON.stringify(report);document.body.append(pre);document.body.dataset.qa=report.pass?'pass':'fail';
 }catch(error){const pre=document.createElement('pre');pre.id='qa-results';pre.hidden=true;pre.textContent=JSON.stringify({pass:false,checks,error:String(error),stack:error.stack,errors:api.state.errors});document.body.append(pre);document.body.dataset.qa='fail';console.error(error);}
}

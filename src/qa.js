import {Simulation,pointInPolygon} from './simulation.js?v=6';
const $=id=>document.getElementById(id);
export async function runQA(api){
 const checks=[],check=(name,condition,detail='')=>checks.push({name,pass:Boolean(condition),detail});
 try{
  $('next-step').click();document.querySelector('[data-trait="curious"]').click();$('start').click();api.setPaused(true);
  let sim=api.sim,world=api.world;
  check('Campus and personality selection starts a new autonomous student',api.state.started&&sim.current.trait==='curious'&&$('setup').hidden);
  const planning=JSON.stringify(sim.snapshot());sim.step(120);check('Only the initial wish choice waits for the player',sim.semester.phase==='planning'&&JSON.stringify(sim.snapshot())===planning);
  const unanswered=api.snapshot();api.restoreSnapshot(JSON.parse(JSON.stringify(unanswered)));sim=api.sim;world=api.world;
  check('Saving before the first wish preserves that unanswered choice',sim.semester.phase==='planning'&&!sim.semester.observation?.enabled&&api.semesterUI.isOpen);
  api.updateUI();
  check('The opening asks for one wish instead of a 21-cell schedule',document.querySelectorAll('[data-wish]').length===4&&document.querySelectorAll('[data-plan-day]').length===0);
  if(['semester','relationships'].includes(api.params.get('view')))document.querySelector('[data-wish="romance"]').click();
  if(api.params.get('view')==='wish'){
    check('A single start button is available',Boolean($('semester-start-week')));
    return finish();
  }
  $('semester-start-week').click();
  check('Choosing a wish starts autonomous observation',sim.semester.observation?.enabled&&sim.semester.phase==='living'&&!api.semesterUI.isOpen);
  check('The student prepares all seven actual days',sim.semester.days.length===7&&sim.semester.days.every(day=>day.length===3));
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
  $('semester-open').click();document.querySelector('[data-tab="calendar"]').click();document.querySelector('.observation-calendar > summary')?.click();check('The optional notebook keeps the academic calendar',api.semesterUI.isOpen&&document.querySelector('#semester-notebook').textContent.includes('중간고사'));
  api.setPaused(false);const frozenInNotebook=sim.time;await new Promise(r=>setTimeout(r,200));check('Reading the optional notebook pauses the visible campus',sim.time===frozenInNotebook);api.setPaused(true);
  $('semester-close').click();
  const observedDays=new Set();let guard=0;
  while(sim.day<=7&&guard++<900){observedDays.add(sim.day);sim.step(17);api.updateUI();if(api.semesterUI.isOpen)throw new Error('A compulsory popup interrupted observation');}
  check('Every day Monday to Sunday is actually observed',observedDays.size===7);
  check('Wednesday decisions are made without a player response',sim.semester.choices.some(c=>c.week===1));
  check('A completed week continues into the next week without a planning popup',sim.semester.week===2&&sim.semester.phase==='living'&&!api.semesterUI.isOpen);
  check('Actual accomplishments create persistent milestones',sim.semesterView().observation.milestones.some(m=>m.done));
  $('semester-open').click();document.querySelector('[data-tab="plan"]').click();
  document.querySelector('.wish-encouragement > summary').click();
  const encouragement=document.querySelector('[data-encourage="believe"]');encouragement.click();
  check('An optional encouragement is recorded for this week',sim.semesterView().observation.lastEncouragement?.week===sim.semester.week);
  check('Encouragement cannot become a repeated click chore',Array.from(document.querySelectorAll('[data-encourage]')).every(button=>button.disabled));
  $('semester-close').click();
  const observedSave=api.snapshot();api.restoreSnapshot(JSON.parse(JSON.stringify(observedSave)));sim=api.sim;
  check('Wish, actual milestones and encouragement survive save restoration',JSON.stringify(sim.snapshot().semester)===JSON.stringify(observedSave.semester));
  check('Reloading an observing student does not reopen a compulsory notebook',!api.semesterUI.isOpen);
  if(['semester','relationships'].includes(api.params.get('view'))){
    sim.step(200000);api.updateUI();
    check('One initial wish reaches the ending after 112 real days with no intervening choices',sim.semester.phase==='complete'&&sim.day===112&&sim.semester.history.length===16);
    check('An ending does not interrupt the camera with a modal',!api.semesterUI.isOpen);
    check('Independent choices can develop an actual mutual romance',sim.students[0].relationships[2]?.status==='dating'&&sim.students[0].relationships[2]?.dates>=3);
    const ending=api.snapshot();api.restoreSnapshot(JSON.parse(JSON.stringify(ending)));sim=api.sim;check('The final observed semester survives save restoration',JSON.stringify(sim.snapshot().semester)===JSON.stringify(ending.semester));
  }
  // Capture meaningful initial observation; no fabricated events or forced story state.
  document.querySelector('[data-speed="1"]').click();api.setPaused(true);world.resetCamera();
  if(api.params.get('view')==='close')world.focusStudent(100);
  if(api.params.get('view')==='story'){sim.step(200);world.focusStudent(110);}
  api.updateUI();
  if(['journal','semester','relationships'].includes(api.params.get('view'))){
    $('semester-open').click();
    if(api.params.get('view')==='relationships'){
      document.querySelector('[data-tab="friends"]').click();
      await new Promise(resolve=>setTimeout(resolve,100));api.updateUI();
      const partner=document.querySelector('.semester-friend-card.dating');
      check('The relationship tab survives queued dialog events',api.semesterUI.isOpen&&document.querySelector('[data-tab="friends"]').getAttribute('aria-pressed')==='true');
      check('The notebook shows the actual partner',partner?.textContent.includes('박서연')&&partner?.textContent.includes('연인'));
    }
  }
  finish();
  function finish(){
  world.render();api.toast();
  const dialog=$('semester-notebook'),bounds=dialog.getBoundingClientRect();
  check('The notebook stays within the actual browser viewport',!dialog.open||(bounds.left>=0&&bounds.right<=window.innerWidth+.5&&bounds.top>=0&&bounds.bottom<=window.innerHeight+.5));
  const report={pass:checks.every(c=>c.pass),checks,viewport:{width:window.innerWidth,height:window.innerHeight},world:world.stats,semester:{week:sim.semester.week,day:sim.day,phase:sim.semester.phase},clock:sim.clock,studentPosition:sim.current.position,render:{calls:world.renderer.info.render.calls,triangles:world.renderer.info.render.triangles},errors:api.state.errors};
  const pre=document.createElement('pre');pre.id='qa-results';pre.hidden=true;pre.textContent=JSON.stringify(report);document.body.append(pre);document.body.dataset.qa=report.pass?'pass':'fail';
  }
 }catch(error){const pre=document.createElement('pre');pre.id='qa-results';pre.hidden=true;pre.textContent=JSON.stringify({pass:false,checks,error:String(error),stack:error.stack,errors:api.state.errors});document.body.append(pre);document.body.dataset.qa='fail';console.error(error);}
}

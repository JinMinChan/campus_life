import {Simulation,TRAITS,ACTIONS,clamp,pointInPolygon} from './simulation.js?v=3';
import {CampusWorld} from './world.js?v=3';
const $=id=>document.getElementById(id);
const shapes={
  campus:'<path d="M3 21V8l9-5 9 5v13M7 21v-8h10v8M2 21h20M7 8h.01M12 8h.01M17 8h.01M12 3V1"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  leaf:'<path d="M20 3c0 10-1 15-8 15-5 0-8-5-5-9S16 7 20 3ZM4 22c2-6 5-9 10-12"/>',
  book:'<path d="M12 5C8 2 3 3 2 4v15c3-2 7-2 10 1 3-3 7-3 10-1V4c-1-1-6-2-10 1Zm0 0v15M5 8h4M5 12h4m6-4h4m-4 4h4"/>',
  food:'<path d="M6 2v8m-3-8v5c0 4 6 4 6 0V2M6 11v11M18 2c-4 3-4 8 0 9V2Zm0 9v11"/>',
  people:'<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m2 4c3 0 4 3 4 6"/>',
  walk:'<circle cx="14" cy="4" r="2"/><path d="m12 8-4 6 4 3-2 5m3-13 3 5h4M4 12l4-1m4 6 5 4M12 8l3 2"/>',
  moon:'<path d="M20 14A9 9 0 0 1 10 3a9 9 0 1 0 10 11Z"/>',
  spark:'<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5ZM20 2v4m-2-2h4"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3h.01"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',
  pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  focus:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><circle cx="12" cy="12" r="4"/>',
  journal:'<path d="M6 3h14v18H6a3 3 0 0 1 0-6h14M6 3a3 3 0 0 0-3 3v12M8 7h8m-8 4h5"/>',
  pause:'<path d="M8 5v14M16 5v14" stroke-width="3"/>',play:'<path d="m8 4 12 8-12 8Z"/>',
  rotate:'<path d="M4 10a8 8 0 1 1 0 6M4 4v6h6"/>',home:'<path d="m3 11 9-8 9 8M5 10v11h14V10M9 21v-7h6v7"/>',
  heart:'<path d="M20 4c-3-2-6 0-8 3-2-3-5-5-8-3-6 5 2 12 8 16C18 16 26 9 20 4Z"/>',
  save:'<path d="M5 3h12l4 4v14H3V3Zm2 0v6h9V3M7 21v-8h10v8"/>',
  camera:'<path d="M3 7h5l2-3h4l2 3h5v13H3Z"/><circle cx="12" cy="13" r="4"/>',
  bolt:'<path d="m14 2-9 12h6l-1 8 9-12h-6Z"/>',
};
const icon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true">${shapes[name]||shapes.leaf}</svg>`;
function icons(root=document){root.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));}
icons();
let sim,world,speed=1,paused=false,started=false,chosen='curious',last=performance.now(),uiElapsed=0,saveElapsed=0,toastTimer,infoPreviousPaused=false,setupPreviousPaused=false;
const SAVE='hanyang-days-v2',LEGACY_SAVE='hanyang-days-v1';
const params=new URLSearchParams(location.search),qa=params.has('qa'),fresh=params.has('fresh');
const errors=[],performanceSamples=[];
let frameCount=0,perfStart=performance.now(),fps=0,lastSaved=null,rosterKey='',journalKey='',saveFailed=false;
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
window.addEventListener('error',e=>errors.push(e.message));
window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
const statDefs=[['energy','체력','bolt','#86a172'],['satiety','포만','food','#c3a06a'],['academic','학업','book','#88a6b4'],['mood','기분','heart','#bf958b']];
$('stats').innerHTML=statDefs.map(([key,label,name,color])=>`<div class="stat" style="--stat-color:${color}" id="stat-${key}"><div class="stat-head"><span>${icon(name)}${label}</span><strong id="value-${key}">0</strong></div><div class="stat-track"><div class="stat-fill" id="fill-${key}"></div></div></div>`).join('');
$('trait-options').innerHTML=Object.entries(TRAITS).map(([key,t])=>`<button class="trait-option ${key===chosen?'chosen':''}" data-trait="${key}" style="--trait-color:${t.color}" aria-pressed="${key===chosen}">${icon(t.icon)}<span><strong>${t.name}</strong><small>${t.description}</small></span><span class="trait-check">✓</span></button>`).join('');
document.querySelectorAll('[data-trait]').forEach(button=>button.onclick=()=>{chosen=button.dataset.trait;document.querySelectorAll('[data-trait]').forEach(b=>{b.classList.toggle('chosen',b===button);b.setAttribute('aria-pressed',String(b===button));});});
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3000);}
function snapshot(){return {...sim.snapshot(),ui:{speed,paused:$('info-dialog').open?infoPreviousPaused:!$('setup').hidden?setupPreviousPaused:paused,follow:world.follow,labelsVisible:world.labelsVisible,camera:world.camera.position.toArray(),target:world.controls.target.toArray()}};}
function save(manual=false){
  if(!started){if(manual)toast('학생의 하루를 시작하면 저장할 수 있어요.');return false;}
  if(qa){if(manual)toast('검증 화면에서는 기존 저장을 보호해요.');return false;}
  try{localStorage.setItem(SAVE,JSON.stringify(snapshot()));lastSaved=sim.clock;saveFailed=false;$('save-label').textContent='저장됨';$('save').title=`DAY ${sim.day} ${lastSaved} · 이 브라우저에 저장했어요`;if(manual)toast('친구와 기억까지, 지금의 하루를 저장했어요.');return true;}
  catch{if(manual||!saveFailed)toast('브라우저 저장 공간을 사용할 수 없어요. 안내에서 파일로 저장해 주세요.');saveFailed=true;$('save-label').textContent='파일 저장';return false;}
}
function restoreSnapshot(saved){
  const next=new Simulation(sim.data,saved.trait);next.restore(saved);
  sim=next;world.setSimulation(sim);world.cameraGoal=null;world.lastOcclusion=0;started=true;
  speed=[1,3,12].includes(saved.ui?.speed)?saved.ui.speed:1;paused=Boolean(saved.ui?.paused);
  world.labelsVisible=saved.ui?.labelsVisible!==false;
  $('labels').classList.toggle('active',world.labelsVisible);$('labels').setAttribute('aria-pressed',String(world.labelsVisible));
  const safeVector=v=>Array.isArray(v)&&v.length===3&&v.every(n=>Number.isFinite(n)&&Math.abs(n)<10000);
  if(safeVector(saved.ui?.camera)&&safeVector(saved.ui?.target)){world.camera.position.fromArray(saved.ui.camera);world.controls.target.fromArray(saved.ui.target);world.controls.update();}
  else world.resetCamera();
  world.follow=Boolean(saved.ui?.follow);
  document.querySelectorAll('.speed').forEach(b=>{const active=Number(b.dataset.speed)===speed;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
  $('setup').hidden=true;document.body.classList.remove('is-setting');journalKey='';rosterKey='';updatePause();updateUI();
}
function friendsFor(s){return Object.entries(s.relationships||{}).map(([id,r])=>({...r,student:sim.students[Number(id)]})).filter(r=>r.student&&r.affinity>0).sort((a,b)=>b.affinity-a.affinity);}
function updateUI(){
  if(!sim||!world)return;
  const s=sim.current,t=TRAITS[s.trait],action=ACTIONS[s.action]||ACTIONS.rest,walking=s.phase==='walking';
  $('clock').textContent=sim.clock;$('day').textContent=`가을학기 · DAY ${String(sim.day).padStart(2,'0')}`;
  const hour=sim.time/60;document.querySelector('.season small').textContent=hour<7?'모두 잠든 고요한 새벽':hour<12?'빛이 스며드는 아침':hour<17?'나무 그늘이 깊어지는 오후':hour<20?'노을이 머무르는 저녁':'작은 불빛이 남은 캠퍼스';
  $('student-name').innerHTML=`${escape(s.name)} <small>1학년</small>`;$('student-role').innerHTML=`<i class="live-dot"></i>${s.id===0?'나의 학생':'같은 캠퍼스의 친구'}`;
  $('student-trait').textContent=t.name;$('portrait').style.setProperty('--student-color',s.color);$('thought').textContent=s.thought||s.reason;
  $('phase-label').textContent=walking?'지금 향하는 곳':s.phase==='waiting'?'잠깐 기다리는 중':'지금 이 순간';
  $('activity').textContent=walking?`${s.destination.name}으로 가는 길`:(s.activityLabel||action.label);
  $('activity-icon').innerHTML=icon(walking?'walk':action.icon);
  const companions=(s.companions||[]).map(id=>sim.students[id]?.name).filter(Boolean);
  $('activity-detail').textContent=walking?`${({class:'수업을 들으러',study:'책을 읽으러',eat:'밥을 먹으러',rest:'잠깐 쉬러',social:'친구를 만나러',exercise:'바람을 쐬러',sleep:'잠을 자러'})[s.action]}, 자기만의 속도로`:`${s.destination.name}${companions.length?' · '+companions.slice(0,2).join(', ')+' 함께':''}`;
  $('decision-reason').textContent=`지금의 선택 · ${s.reason}`;
  for(const [key,label] of statDefs){const value=Math.round(s[key]);$(`value-${key}`).textContent=value;$(`fill-${key}`).style.width=value+'%';$(`stat-${key}`).title=`${label} ${value}/100`;$(`stat-${key}`).setAttribute('aria-label',`${label} ${value}/100`);}
  $('distance').textContent=s.distance>1000?`${(s.distance/1000).toFixed(1)} km`:`${Math.round(s.distance)} m`;$('completed').textContent=s.completed.length;
  const friends=friendsFor(s),best=friends[0];
  $('relationship-preview').innerHTML=best?`${icon('people')} <strong>${escape(best.student.name)}</strong> · ${best.affinity>=60?'마음이 통하는 친구':best.affinity>=30?'함께 있으면 편한 사이':'조금씩 익숙해지는 사이'}${best.sharedMeals?` · 함께한 밥 ${best.sharedMeals}번`:''}`:'아직은 낯선 얼굴들. 오늘은 누구와 마주칠까요?';
  if(!$('student-details').hidden){
    $('relationships').innerHTML=friends.slice(0,3).map(r=>`<div class="friend-row"><i style="background:${escape(r.student.color)}"></i>${escape(r.student.name)}<small>마주친 날 ${r.encounters||1}번 · 친밀 ${Math.round(r.affinity)}</small></div>`).join('');
    $('student-memories').innerHTML=(s.memories||[]).slice(0,4).map(m=>`<div class="memory-entry"><small>DAY ${m.day} · ${escape(m.time||'')}</small>${escape(m.text)}</div>`).join('');
    const next=sim.nextClass?.(s);$('schedule-preview').textContent=next?`다음 수업 · ${next.name||next.title||'전공 수업'}${Number.isFinite(next.start)?' '+String(Math.floor(next.start/60)).padStart(2,'0')+':'+String(next.start%60).padStart(2,'0'):''}${s.examPrep!=null?' · 시험 준비 '+Math.round(s.examPrep)+'%':''}`:`오늘의 수업을 마쳤어요${s.examPrep!=null?' · 시험 준비 '+Math.round(s.examPrep)+'%':''}`;
  }
  const logs=sim.logs.filter(l=>l.student===s.id).slice(0,3),memories=(s.memories||[]).slice(0,8);
  const nextJournal=JSON.stringify([s.id,logs,memories]);
  if(journalKey!==nextJournal){journalKey=nextJournal;$('diary-entries').innerHTML=logs.map(l=>`<div class="diary-entry"><time class="diary-time">${escape(l.time)}</time><i class="diary-dot"></i><p>${escape(l.text)}</p></div>`).join('');$('memory-entries').innerHTML=memories.length?memories.map(m=>`<div class="memory-entry"><small>DAY ${m.day} · ${escape(m.time||'')}</small>${escape(m.text)}</div>`).join(''):'<p class="memory-entry">함께한 식사와 수업, 작지만 오래 남을 순간들이 이곳에 쌓여요.</p>';}
  $('population').textContent=paused?'잠시 멈춘 캠퍼스의 시간':`${sim.students.length}명의 작은 하루가 흐릅니다`;
  $('follow').setAttribute('aria-pressed',String(world.follow));$('follow').setAttribute('aria-label',world.follow?'학생 추적 멈추기':'이 학생 따라가기');$('follow').title=world.follow?'따라가는 중 · F로 해제':'가까이 따라가기 · F';
  if(!$('roster').hidden)updateRoster();
}
function updateRoster(){
  const key=sim.students.map(s=>`${s.id}-${s.phase}-${s.action}`).join(',')+sim.selected;if(key===rosterKey)return;rosterKey=key;
  $('roster-list').innerHTML=sim.students.map(s=>`<button class="roster-row ${s.id===sim.selected?'selected':''}" data-student="${s.id}" style="--student-color:${escape(s.color)}"><span class="roster-color">${escape(s.name[0])}</span><span><strong>${escape(s.name)}${s.id===0?' · 내 학생':''}</strong><small>${TRAITS[s.trait].name}</small></span><span>${s.phase==='walking'?'걷는 중':s.phase==='waiting'?'기다리는 중':ACTIONS[s.action]?.verb||'쉬는 중'}</span></button>`).join('');
}
$('roster-list').addEventListener('click',e=>{const b=e.target.closest('[data-student]');if(!b)return;selectStudent(Number(b.dataset.student));$('roster').hidden=true;$('roster-toggle').setAttribute('aria-expanded','false');});
function selectStudent(id){sim.select(id);world.lastRoute='';world.focusStudent(110);updateUI();toast(`${sim.current.name}의 걸음에 함께해요.`);}
function showSetup(){setupPreviousPaused=paused;paused=true;$('setup').hidden=false;$('campus-step').hidden=false;$('trait-step').hidden=true;$('setup-close').hidden=!started;document.body.classList.add('is-setting');$('setup-step').textContent='A LITTLE CAMPUS LIFE';updatePause();}
function closeSetup(){if(!started)return;$('setup').hidden=true;document.body.classList.remove('is-setting');paused=setupPreviousPaused;updatePause();}
$('next-step').onclick=$('choose-campus').onclick=()=>{$('campus-step').hidden=true;$('trait-step').hidden=false;$('setup-step').textContent='THE FIRST PAGE · 하늘의 첫날';};
$('back-step').onclick=()=>{$('campus-step').hidden=false;$('trait-step').hidden=true;$('setup-step').textContent='A LITTLE CAMPUS LIFE';};
$('setup-close').onclick=closeSetup;
$('start').onclick=()=>{sim=new Simulation(sim.data,chosen);world.setSimulation(sim);started=true;paused=false;speed=1;journalKey='';rosterKey='';document.querySelectorAll('.speed').forEach(b=>{b.classList.toggle('active',b.dataset.speed==='1');b.setAttribute('aria-pressed',String(b.dataset.speed==='1'));});$('setup').hidden=true;document.body.classList.remove('is-setting');world.resetCamera();updatePause();updateUI();save();toast('하늘의 첫날. 이제 하루가 스스로 흘러갑니다.');};
function updatePause(){$('pause').innerHTML=icon(paused?'play':'pause');$('pause').setAttribute('aria-label',paused?'계속 재생':'일시정지');$('pause').setAttribute('aria-pressed',String(paused));}
$('pause').onclick=()=>{if(!started)return;paused=!paused;updatePause();updateUI();};
document.querySelectorAll('.speed').forEach(b=>b.onclick=()=>{speed=Number(b.dataset.speed);document.querySelectorAll('.speed').forEach(o=>{o.classList.toggle('active',o===b);o.setAttribute('aria-pressed',String(o===b));});toast(`${speed}배속 · 현실 1초에 게임 ${speed}분`);});
$('follow').onclick=()=>{if(world.follow)world.follow=false;else world.focusStudent(110);updateUI();};
$('my-student').onclick=()=>selectStudent(0);
$('labels').onclick=()=>{world.labelsVisible=!world.labelsVisible;$('labels').classList.toggle('active',world.labelsVisible);$('labels').setAttribute('aria-pressed',String(world.labelsVisible));};
$('roster-toggle').onclick=()=>{$('roster').hidden=!$('roster').hidden;$('roster-toggle').setAttribute('aria-expanded',String(!$('roster').hidden));updateRoster();};
$('roster-close').onclick=()=>{$('roster').hidden=true;$('roster-toggle').setAttribute('aria-expanded','false');};
$('details-toggle').onclick=()=>{$('student-details').hidden=!$('student-details').hidden;$('details-toggle').setAttribute('aria-expanded',String(!$('student-details').hidden));$('details-toggle').innerHTML=$('student-details').hidden?'자세히 <span>＋</span>':'접기 <span>−</span>';updateUI();};
$('diary-toggle').onclick=()=>{const collapsed=document.querySelector('.diary').classList.toggle('collapsed');$('diary-toggle').setAttribute('aria-expanded',String(!collapsed));};
$('memory-toggle').onclick=()=>{$('memory-entries').hidden=!$('memory-entries').hidden;$('diary-entries').hidden=!$('memory-entries').hidden;$('memory-toggle').innerHTML=$('memory-entries').hidden?'쌓인 기억 보기 <span>↗</span>':'오늘의 기록 보기 <span>↙</span>';};
$('zoom-in').onclick=()=>world.zoom(.8);$('zoom-out').onclick=()=>world.zoom(1.25);$('rotate-left').onclick=()=>world.rotate(-Math.PI/8);
$('reset-camera').onclick=()=>{world.resetCamera();updateUI();};
$('new-day').onclick=()=>{const prior=infoPreviousPaused;$('info-dialog').close();showSetup();setupPreviousPaused=prior;};
function photo(enabled){document.body.classList.toggle('photo-mode',enabled);$('exit-photo').hidden=!enabled;}
$('photo').onclick=()=>photo(true);$('exit-photo').onclick=()=>photo(false);
function showInfo(){infoPreviousPaused=paused;paused=true;updatePause();$('info-dialog').showModal();}
$('help').onclick=$('sources').onclick=showInfo;$('close-info').onclick=()=>$('info-dialog').close();
$('info-dialog').addEventListener('close',()=>{if($('setup').hidden)paused=infoPreviousPaused;updatePause();});
$('save').onclick=()=>save(true);
$('export-save').onclick=()=>{if(!started){toast('먼저 학생의 하루를 시작해 주세요.');return;}const contents=JSON.stringify(snapshot(),null,2),url=URL.createObjectURL(new Blob([contents],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`hanyang-day-${sim.day}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('친구와 기억을 파일로 간직했어요.');};
$('import-save').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>3*1024*1024)throw new Error('File too large');const saved=JSON.parse(await file.text());restoreSnapshot(saved);infoPreviousPaused=paused;$('info-dialog').close();save();toast('저장 파일의 학생과 기억을 다시 만났어요.');}catch{toast('올바른 한양의 하루 저장 파일이 아니에요. 현재 하루는 유지됩니다.');}e.target.value='';});
document.addEventListener('keydown',e=>{if(e.code==='Escape'){photo(false);return;}if(!started||!$('setup').hidden||$('info-dialog').open||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName))return;if(e.code==='Space'){if(['BUTTON','A'].includes(document.activeElement.tagName))return;e.preventDefault();$('pause').click();}else if(e.code==='KeyF')$('follow').click();else if(e.code==='KeyH')$('reset-camera').click();else if(e.code==='KeyQ')world.rotate(-.15);else if(e.code==='KeyE')world.rotate(.15);else if(['Equal','NumpadAdd'].includes(e.code))world.zoom(.9);else if(['Minus','NumpadSubtract'].includes(e.code))world.zoom(1.1);});
window.addEventListener('beforeunload',()=>save());
document.addEventListener('visibilitychange',()=>{if(document.hidden)save();last=performance.now();perfStart=last;frameCount=0;});
function frame(now){
  const dt=Math.min((now-last)/1000,.15);last=now;
  try{if(started&&!paused&&!document.hidden)sim.step(dt*speed);world.render(now/1000);}catch(error){paused=true;updatePause();errors.push(String(error));console.error(error);toast('하루를 잠시 멈췄어요. 저장 파일을 내보내고 새로고침해 주세요.');return;}
  uiElapsed+=dt;saveElapsed+=dt;frameCount++;
  if(uiElapsed>.35){updateUI();uiElapsed=0;}
  if(saveElapsed>6){save();saveElapsed=0;}
  if(now-perfStart>=2000){fps=Math.round(frameCount*1000/(now-perfStart));performanceSamples.push(fps);if(performanceSamples.length>90)performanceSamples.shift();perfStart=now;frameCount=0;$('runtime-diagnostics').textContent=JSON.stringify({version:2,ready:true,clock:sim.clock,day:sim.day,speed,paused,selected:sim.selected,follow:world.follow,action:sim.current.action,phase:sim.current.phase,position:sim.current.position,fps,averageFps:Math.round(performanceSamples.reduce((a,b)=>a+b,0)/performanceSamples.length),world:world.stats,renderCalls:world.renderer.info.render.calls,triangles:world.renderer.info.render.triangles,errors,lastSaved,relationships:friendsFor(sim.current).length,memories:sim.current.memories?.length||0,story:sim.logs.filter(l=>l.student===sim.selected).slice(0,5)});}
  requestAnimationFrame(frame);
}
async function boot(){
  try{
    const response=await fetch('./public/data/campus.json');if(!response.ok)throw new Error('캠퍼스 데이터 읽기 실패');const data=await response.json();sim=new Simulation(data);world=new CampusWorld($('world'),data,sim,selectStudent);
    $('world').addEventListener('camera-manual',()=>{if(started)updateUI();});
    $('world').addEventListener('render-lost',()=>{paused=true;updatePause();toast('3D 연결이 끊겼어요. 저장한 뒤 페이지를 새로고침해 주세요.');});
    $('data-summary').textContent=`실제 건물 ${data.buildings.length}개 · 길 ${data.roads.length}개 · ${world.treeCount}그루의 나무`;$('data-notes').innerHTML=data.meta.notes.map(n=>`<li>${escape(n)}</li>`).join('');
    if(!fresh&&!qa){try{const raw=localStorage.getItem(SAVE)||localStorage.getItem(LEGACY_SAVE);if(raw){restoreSnapshot(JSON.parse(raw));toast('그날의 걸음과 친구들을 이어갑니다.');}}catch{toast('저장 파일을 읽지 못했어요. 새 하루를 열되 기존 파일은 보관합니다.');}}
    $('loading').hidden=true;updateUI();if(!started)showSetup();else updatePause();world.render();last=performance.now();requestAnimationFrame(frame);document.body.dataset.ready='true';
    if(qa){const {runQA}=await import('./qa.js');await runQA({get sim(){return sim;},get world(){return world;},get state(){return {speed,paused,started,errors,performanceSamples};},snapshot,restoreSnapshot,updateUI,params,toast:()=>{clearTimeout(toastTimer);$('toast').hidden=true;},setPaused(value){paused=value;updatePause();}});}
  }catch(error){console.error(error);errors.push(String(error));$('loading').hidden=false;$('loading').innerHTML=`<div class="error-card"><h2>캠퍼스를 열지 못했어요</h2><p>WebGL을 지원하는 최신 브라우저에서 다시 열어 주세요.</p><p>${escape(error)}</p><a href="./">다시 열기 →</a></div>`;document.body.dataset.ready='error';}
}
boot();

import { SEMESTER_CALENDAR, NPCS } from './semester.js?v=6';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number = value => Math.round(Number(value) || 0);
const won = value => `${number(value).toLocaleString('ko-KR')}원`;
const colors = ['#d7a57e','#8da0bd','#b98d9d'];
const wishes = {
  scholar:{icon:'▤',title:'궁금한 것을 끝까지 알아가고 싶어',description:'수업에서 품은 질문이, 나만의 답이 되는 순간까지.'},
  friendship:{icon:'✦',title:'편하게 웃을 친구가 생겼으면',description:'같이 밥 먹고, 별일 없는 하루도 나눌 사람이 있기를.'},
  romance:{icon:'♡',title:'서로 좋아하는 마음을 만나고 싶어',description:'서두르지 않고 알아가다, 함께 걷는 사이가 되기를.'},
  independent:{icon:'↗',title:'내 생활을 스스로 꾸리고 싶어',description:'낯설고 서툴러도, 내 하루를 내가 돌볼 수 있기를.'},
};
const encouragements = {
  rest:{icon:'☘',label:'오늘은 좀 쉬어도 돼',description:'몸과 마음을 돌보는 시간을 응원해요.'},
  connect:{icon:'♡',label:'먼저 말 걸어봐',description:'친구에게 다가갈 작은 용기를 건네요.'},
  believe:{icon:'✦',label:'너다운 속도면 충분해',description:'지금까지의 걸음을 믿어 주세요.'},
};
const growthLabels = {knowledge:'배움의 깊이',expression:'나를 표현하는 마음',independence:'스스로 살아가는 힘'};
const growthWords = n => n>=70?'어느새, 제법 단단해졌어요':n>=40?'조금씩 자신감이 생겼어요':'처음의 서툼을 배워 가요';
const stages = {acquaintance:'조금씩 알아가는 동기',friend:'함께 다니는 친구',close:'마음 편한 사이',dating:'같은 마음으로 걷는 연인',declined:'서로의 속도를 존중하는 사이'};

/** The notebook observes a life. Only the very first wish needs an answer. */
export function createSemesterUI({getSim,onChange=()=>{},onSkip=()=>{},onExport=()=>{},onOpen=()=>{},onClose=()=>{}}) {
  const hud=document.createElement('aside');
  hud.id='semester-hud';hud.className='semester-hud hud glass';hud.setAttribute('aria-label','하늘의 작은 바람');
  const dialog=document.createElement('dialog');
  dialog.id='semester-notebook';dialog.className='semester-notebook observation-notebook';dialog.setAttribute('aria-labelledby','semester-heading');
  document.body.append(hud,dialog);
  let view=null,tab='plan',lastSim=null,stateKey='',hudKey='',draft=null,opened=false,error='',returnFocus=null;
  const read=()=>getSim()?.semesterView?.()||null;
  const enabled=()=>Boolean(view?.observation?.enabled);
  const mandatory=()=>Boolean(view&&view.phase==='planning'&&!enabled());
  const currentWish=()=>view?.observation?.wish||wishes[view?.goal]||wishes.scholar;
  const milestones=()=>view?.observation?.milestones||[];
  const portrait=(npc,large=false)=>`<span class="semester-portrait ${large?'large':''}" style="--friend-color:${colors[(npc.id-1)%3]}" aria-hidden="true"><i class="hair"></i><i class="face"></i><i class="shirt"></i></span>`;
  const chip=(text,kind='')=>`<span class="semester-chip ${kind}">${escape(text)}</span>`;
  const progressDots=()=>`<span class="wish-progress-dots" aria-label="바람에 다가간 순간 ${milestones().filter(m=>m.done).length}개">${milestones().map(m=>`<i class="${m.done?'done':''}" title="${escape(m.title)}${m.done?' · 기억에 남았어요':''}"></i>`).join('')}</span>`;
  const momentDate=m=>m?.day?`${number(m.day)}일째${m.week?` · ${number(m.week)}주`:''}`:m?.week?`${number(m.week)}주`:'';

  function show(nextTab=tab) {
    view=read();if(!view)return;
    tab=['plan','calendar','growth','friends'].includes(nextTab)?nextTab:'plan';
    if(!draft)draft={goal:view.goal,focusId:view.focusId};
    if(!opened){returnFocus=document.activeElement;opened=true;onOpen();render(true);dialog.showModal();}
    else render(true);
  }
  function close(force=false) {
    if(!opened||(!force&&mandatory()))return false;
    opened=false;dialog.close();onClose();
    if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});
    return true;
  }
  function action(fn,{dismiss=false}={}) {
    try{fn();error='';view=read();if(dismiss)close(true);onChange();update(true);}
    catch(e){error=e?.message||'마음을 전하지 못했어요. 잠시 뒤 다시 시도해 주세요.';render();}
  }
  function header() {
    const first=mandatory();
    const title=first?'하늘이 품을 작은 바람 하나.':view.phase==='complete'?'하늘의 한 학기가 남았다.':'하늘을 지켜보는 작은 수첩';
    return `<header class="semester-header"><div class="semester-heading-row"><span class="semester-kicker">HANYANG DAYS <i>·</i> 한 사람의 작은 날들</span>${first?chip('첫 마음','quiet'):`<button class="semester-close" id="semester-close" data-do="close" aria-label="관찰 수첩 닫기">×</button>`}</div><div class="semester-title-row"><div><h2 id="semester-heading">${title}</h2><p>${first?'어떤 날들을 살아갈지, 처음의 마음만 골라 주세요.':'조금씩 달라지는 마음과, 곁에 남는 사람들.'}</p></div>${first?'<span class="wish-heading-flower" aria-hidden="true">✺</span>':`<span class="semester-page-number"><strong>${String(view.week).padStart(2,'0')}</strong><span>번째 주</span></span>`}</div></header>`;
  }
  function tabs() {
    return `<nav class="semester-tabs" aria-label="관찰 수첩 메뉴">${[['plan','작은 바람'],['friends','우리 사이'],['calendar','지나온 날들']].map(([id,text])=>`<button data-tab="${id}" class="${tab===id?'active':''}" aria-pressed="${tab===id}">${text}</button>`).join('')}<button data-tab="growth" class="semester-detail-tab ${tab==='growth'?'active':''}" aria-pressed="${tab==='growth'}">자라난 마음</button></nav>`;
  }
  function firstWish() {
    return `<section class="wish-introduction"><p class="semester-intro">수업도, 점심도, 친구를 만나는 일도 하늘이 스스로 해나가요.<br>곁에서 그 작은 바람이 어떤 이야기가 되는지 지켜봐 주세요.</p><div class="wish-choices" aria-label="하늘의 작은 바람">${Object.entries(wishes).map(([id,w])=>`<button class="wish-choice ${draft.goal===id?'chosen':''}" data-wish="${id}" aria-pressed="${draft.goal===id}"><span class="wish-choice-icon" aria-hidden="true">${w.icon}</span><span><strong>${escape(w.title)}</strong><small>${escape(w.description)}</small></span><i aria-hidden="true">${draft.goal===id?'✓':''}</i></button>`).join('')}</div><p class="wish-first-note"><span aria-hidden="true">☘</span>가만히 지켜봐도 만남과 기억이 쌓여요. 가끔, 응원 한마디면 충분해요.</p></section>`;
  }
  function milestoneList() {
    const list=milestones();
    return `<ol class="wish-milestones" aria-label="실제 생활에서 자라난 작은 바람">${list.map(m=>`<li class="${m.done?'done':''}" data-milestone="${escape(m.id)}" data-complete="${Boolean(m.done)}"><span class="milestone-seed" aria-hidden="true">${m.done?'✦':'·'}</span><div><strong>${escape(m.title)}</strong><p>${m.done?escape(m.detail):'앞으로 만나고 싶은 장면이에요.'}</p>${m.done&&momentDate(m)?`<small>${momentDate(m)}에 남은 기억</small>`:''}</div></li>`).join('')||'<li><span class="milestone-seed" aria-hidden="true">·</span><div><strong>이제 첫 걸음이 시작돼요.</strong><p>직접 살아낸 장면들이 이곳에 남습니다.</p></div></li>'}</ol>`;
  }
  function encouragement() {
    const o=view.observation||{},last=o.lastEncouragement;
    if(view.phase==='complete')return '';
    return `<details class="wish-encouragement"><summary><span>가끔, 한마디 건네기</span><small>${last?.week===view.week?'이번 주의 마음을 전했어요':'원할 때만 펼쳐요'} <b>＋</b></small></summary><p>한 주에 한 번, 작은 마음을 건넬 수 있어요. 응원 없이도 하늘의 하루는 이어집니다.</p><div>${Object.entries(encouragements).map(([kind,e])=>`<button data-encourage="${kind}" ${o.canEncourage?'':'disabled'} title="${escape(e.description)}"><span aria-hidden="true">${e.icon}</span>${e.label}</button>`).join('')}</div>${last?.week===view.week?`<p class="encouragement-sent" role="status">“${escape(encouragements[last.kind]?.label||'곁에서 응원해')}”라고 전했어요.</p>`:''}</details>`;
  }
  function home() {
    if(mandatory())return firstWish();
    const w=currentWish(),o=view.observation||{},moment=o.recentMoment;
    const thought=getSim()?.students?.[0]?.thought;
    return `<section class="wish-home"><div class="wish-home-title"><span class="wish-ink-symbol" aria-hidden="true">${wishes[view.goal]?.icon||'✦'}</span><div><span class="semester-kicker">하늘이 마음에 품은 것</span><h3>${escape(w.title)}</h3><p>${escape(w.description)}</p></div></div><div class="wish-next-step"><span>요즘, 하늘은</span><p id="wish-next-step">${escape(o.nextStep||thought||'익숙해질 캠퍼스의 길을 천천히 걸어요.')}</p></div><div class="wish-story-columns"><div><div class="wish-section-label">작은 바람에 다가가는 순간들 ${progressDots()}</div>${milestoneList()}</div><aside class="wish-moment"><span class="semester-kicker">${moment?'최근, 마음에 남은 장면':'아직 쓰이지 않은 한 페이지'}</span><span class="wish-moment-flower" aria-hidden="true">✺</span><h4>${escape(moment?.title||'처음에는 작은 걸음부터.')}</h4><p>${escape(moment?.text||thought||'낯설던 길이 익숙해지고, 처음 만난 얼굴이 반가워질 거예요.')}</p><small>${momentDate(moment)}</small></aside></div>${encouragement()}<div class="wish-quiet-links"><button data-tab="friends">곁에 있는 사람들 <span>↗</span></button><button data-tab="growth">하늘이 달라진 만큼 <span>↗</span></button></div></section>`;
  }
  function friends() {
    const memories=getSim()?.students?.[0]?.memories||[];
    return `<section class="semester-full-page"><div class="semester-section-title"><span class="semester-kicker">THE PEOPLE IN MY DAYS</span><h3>어느새, 서로의 하루에 들어온 사람들.</h3></div><div class="semester-friends-grid">${(view.npcs||NPCS).map(n=>{const r=n.relationship||{},memory=memories.find(m=>m.with===n.id);return `<article class="semester-friend-card ${r.status==='dating'?'dating':''}"><div class="semester-friend-top">${portrait(n,true)}<div><h4>${escape(n.name)}</h4><span>${escape(n.interest||n.short)}</span></div></div>${chip(stages[r.status]||n.label||'조금씩 알아가는 사이',r.status==='dating'?'rose':'')}<p class="semester-friend-description">${escape(n.description)}</p><blockquote class="friend-shared-memory">${escape(memory?.text||(r.sharedActivities?`${number(r.sharedActivities)}번의 함께한 시간. 별일 없던 하루에도 이 사람이 조금씩 스며들었어요.`:'아직은 조금 낯선 얼굴. 어떤 순간을 함께하게 될까요?'))}</blockquote><p class="semester-boundary">“${escape(n.boundary||'우리, 서로의 속도로 알아가요.')}”</p><details class="friend-details"><summary>우리의 거리 살펴보기 <span>＋</span></summary><dl><div><dt>우정</dt><dd>${number(r.friendship)}</dd></div><div><dt>믿음</dt><dd>${number(r.trust)}</dd></div><div><dt>설렘</dt><dd>${number(r.romance)}</dd></div></dl><p>${r.dates?`둘만의 데이트 ${number(r.dates)}번 · `:''}함께한 활동 ${number(r.sharedActivities)}번</p></details></article>`;}).join('')}</div><p class="semester-footnote">마음을 전하는 일도, 서로의 대답도 하늘과 친구들이 살아가는 이야기 안에서 생겨요.</p></section>`;
  }
  function calendar() {
    const history=[...(view.history||[])].reverse();
    return `<section class="semester-full-page"><div class="semester-section-title"><span class="semester-kicker">PAGES WE HAVE LIVED</span><h3>언덕을 오르내리며, 남은 날들.</h3></div><div class="observation-history">${history.map(r=>`<article><span class="history-week">${String(r.week).padStart(2,'0')}<small>WEEK</small></span><div><h4>${escape(SEMESTER_CALENDAR.find(c=>c.week===r.week)?.title||r.title)}</h4><p>${escape(r.highlights?.at(-1)||r.summary)}</p>${r.highlights?.length?`<details><summary>이 주의 기억 더 보기 <span>＋</span></summary>${r.highlights.slice(-4).map(h=>`<p>${escape(h)}</p>`).join('')}</details>`:''}</div></article>`).join('')||`<div class="history-first-page"><span aria-hidden="true">▤</span><h4>아직, 첫 페이지를 쓰는 중이에요.</h4><p>${escape(view.calendar?.description||'처음의 마음을 품고, 캠퍼스에 하루가 시작됩니다.')}</p></div>`}</div><details class="observation-calendar"><summary>캠퍼스가 맞이할 계절들 <span>＋</span></summary><div class="semester-calendar-grid">${SEMESTER_CALENDAR.map(c=>`<article class="semester-calendar-card ${c.week<view.week||view.phase==='complete'?'done':''} ${c.week===view.week?'current':''}"><span>${c.week}주 ${c.week<view.week||view.phase==='complete'?'✓':''}</span><h4>${escape(c.title)}</h4><p>${escape(c.description)}</p></article>`).join('')}</div><p class="semester-footnote">게임 속 16주 학사 일정입니다. 평일과 주말을 모두 살아가며 112일의 기억을 쌓아요.</p></details></section>`;
  }
  function growth() {
    return `<section class="semester-full-page"><div class="semester-section-title"><span class="semester-kicker">A LITTLE MORE LIKE MYSELF</span><h3>하루를 살아낸 만큼, 조금 다른 하늘.</h3></div><div class="observation-growth">${Object.entries(growthLabels).map(([key,title],i)=>`<article><span aria-hidden="true">${['▤','✦','↗'][i]}</span><div><h4>${title}</h4><p>${growthWords(view.growth?.[key])}</p></div><small>${number(view.growth?.[key])}</small></article>`).join('')}</div><div class="observation-balance"><span>지금의 마음</span><p>${view.stress>65?'바쁜 날이 이어졌어요. 하늘도 잠깐 쉴 곳을 찾고 있어요.':view.stress>35?'하고 싶은 일과 쉬어 갈 시간을 맞춰 가는 중이에요.':'한결 가벼운 마음으로, 익숙한 하루를 보내고 있어요.'}</p></div><details class="observation-grades"><summary>수업과 생활의 기록 <span>＋</span></summary><div class="semester-course-grid">${(view.courses||[]).map(c=>`<article class="semester-course"><div><h4>${escape(c.title)}</h4><strong>${c.grade==null?'수강 중':`${number(c.grade)}점`}</strong></div><dl><div><dt>출석</dt><dd>${number(c.attendance)}%</dd></div><div><dt>중간고사</dt><dd>${c.midterm==null?'아직':`${number(c.midterm)}점`}</dd></div><div><dt>기말고사</dt><dd>${c.final==null?'아직':`${number(c.final)}점`}</dd></div><div><dt>프로젝트</dt><dd>${number(c.project)}%</dd></div></dl></article>`).join('')}</div><p class="observation-money">스스로 꾸려 가는 생활비 <strong>${won(view.money)}</strong></p></details></section>`;
  }
  function ending() {
    const e=view.ending||{},w=currentWish();
    return `<section class="semester-ending-page"><div class="semester-ending-emblem" aria-hidden="true">✦<span>16</span>✦</div><span class="semester-kicker">THE FIRST CHAPTER, COMPLETED</span><h3>${escape(e.title||'한양에서 보낸, 나의 첫 학기')}</h3><p class="semester-ending-text">${escape(e.text||'낯설던 언덕에 나만의 기억과 반가운 사람들이 남았어요.')}</p><div class="ending-wish"><span>처음의 작은 바람</span><p>“${escape(w.title)}”</p></div>${milestoneList()}<div class="semester-ending-people">${(view.npcs||[]).map(n=>`<article>${portrait(n)}<div><strong>${escape(n.name)}</strong><small>${escape(stages[n.relationship?.status]||n.label)}</small></div></article>`).join('')}</div><details class="ending-details"><summary>학기가 남긴 기록 <span>＋</span></summary>${(e.highlights||[]).map(text=>`<p>${escape(text)}</p>`).join('')}</details><p class="semester-footnote">112일을 함께 걸었어요. 수첩은 언제든 다시 펼쳐 볼 수 있습니다.</p></section>`;
  }
  function footer() {
    if(mandatory())return `<footer class="semester-footer"><p>이제, 하늘의 하루가 스스로 이어져요.</p><button class="semester-primary" id="semester-start-week" data-do="start">작은 바람 지켜보기 <span>→</span></button></footer>`;
    return `<footer class="semester-footer"><button class="semester-export" data-do="export">기억을 파일로 간직하기 <span>↗</span></button><button class="semester-primary" data-do="close">다시, 하늘 곁으로 <span>↗</span></button></footer>`;
  }
  function render(resetScroll=false) {
    if(!view)return;
    const scrollTop=resetScroll?0:(dialog.querySelector('.semester-paper-body')?.scrollTop||0);
    const expanded=[...dialog.querySelectorAll('details[open]')].map(el=>el.className);
    dialog.dataset.phase=mandatory()?'wish':view.phase;
    dialog.classList.toggle('choosing-wish',mandatory());
    const page=mandatory()?firstWish():view.phase==='complete'&&tab==='plan'?ending():({plan:home,friends,calendar,growth}[tab])();
    dialog.innerHTML=`${header()}${mandatory()?'':tabs()}<div class="semester-paper-body">${page}</div>${error?`<p class="semester-error" role="alert">${escape(error)}</p>`:''}${footer()}`;
    if(!resetScroll){dialog.querySelector('.semester-paper-body').scrollTop=scrollTop;for(const el of dialog.querySelectorAll('details'))if(expanded.includes(el.className))el.open=true;}
  }
  function update(force=false) {
    const sim=getSim(),next=read();
    if(!next||document.body.classList.contains('is-setting')){hud.hidden=true;return;}
    hud.hidden=false;
    const newSim=sim!==lastSim;
    view=next;
    if(!draft||newSim)draft={goal:view.goal,focusId:view.focusId};
    lastSim=sim;
    const o=view.observation||{},key=[view.week,view.phase,o.enabled,o.milestones?.map(m=>`${m.id}:${m.done}`).join(','),o.recentMoment?.text,o.lastEncouragement?.week,o.lastEncouragement?.kind].join('|');
    const changed=stateKey!==key;stateKey=key;
    const w=currentWish(),nextStep=o.nextStep||'첫 마음을 품고 캠퍼스를 걸어볼까요?',hKey=[key,nextStep,view.dayOfWeek].join('|');
    if(hudKey!==hKey){hudKey=hKey;hud.innerHTML=`<button id="semester-open" aria-label="관찰 수첩 열기"><span class="semester-hud-symbol" aria-hidden="true">${wishes[view.goal]?.icon||'✦'}</span><span class="semester-hud-copy"><small>${view.phase==='complete'?'우리의 첫 학기가 남았어요':'하늘의 작은 바람'}</small><strong>${escape(w.title)}</strong><em>${escape(view.phase==='complete'?'어떤 기억이 남았는지 펼쳐보기':nextStep)}</em>${progressDots()}</span><span class="semester-hud-open" aria-hidden="true">↗</span></button>${enabled()&&view.phase!=='complete'?'<button id="semester-skip" class="semester-skip" title="45분의 생활을 이어 봐요. 하늘은 스스로 선택하며 살아갑니다.">다음 장면 <span>→</span></button>':''}`;}
    if(changed)error='';
    if(mandatory()&&!opened)show('plan');
    else if(opened&&(changed||force||newSim))render(newSim);
  }
  hud.addEventListener('click',event=>{if(event.target.closest('#semester-skip')){if(enabled()&&view.phase!=='complete'){onSkip();update();}return;}show('plan');});
  dialog.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button||button.disabled)return;
    if(button.dataset.tab){tab=button.dataset.tab;render(true);return;}
    if(button.dataset.wish&&mandatory()){draft.goal=button.dataset.wish;if(draft.goal==='romance')draft.focusId=2;render();return;}
    if(button.dataset.encourage){action(()=>getSim().encourage(button.dataset.encourage));return;}
    if(button.dataset.do==='start')action(()=>getSim().startObservation({goal:draft.goal,focusId:draft.focusId}),{dismiss:true});
    if(button.dataset.do==='close')close();
    if(button.dataset.do==='export')onExport();
  });
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  // A native close event is queued; an earlier close must not reset a reopened notebook.
  dialog.addEventListener('close',()=>{if(opened&&!dialog.open){opened=false;onClose();}});
  return {update,open:show,close,get isOpen(){return opened;},get isMandatory(){return mandatory();},destroy(){close(true);hud.remove();dialog.remove();}};
}

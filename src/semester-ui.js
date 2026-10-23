import { SEMESTER_CALENDAR, PLAN_ACTIVITIES, NPCS, GOALS } from './semester.js?v=5';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number = value => Math.round(Number(value) || 0);
const percent = value => Math.max(0, Math.min(100, number(value)));
const won = value => `${number(value).toLocaleString('ko-KR')}원`;
const signed = value => `${Number(value) > 0 ? '+' : ''}${number(value)}`;
const shortLabels = {study:'공부',club:'동아리',work:'알바',friend:'친구',rest:'휴식'};
const glyphs = {study:'▤',club:'✦',work:'₩',friend:'♡',rest:'☘',scholar:'▤',friendship:'✦',romance:'♡',independent:'↗'};
const growthLabels = {knowledge:'배움의 깊이',expression:'표현력',independence:'생활력'};
const colors = ['#d7a57e','#8da0bd','#b98d9d'];
const clock = min => `${String(Math.floor(min / 60)).padStart(2,'0')}:${String(min % 60).padStart(2,'0')}`;

/** A quiet notebook around the autonomous campus, with pauses only at meaningful choices. */
export function createSemesterUI({getSim,onChange = () => {},onSkip = () => {},onExport = () => {},onOpen = () => {},onClose = () => {}}) {
  const hud = document.createElement('aside');
  hud.id = 'semester-hud';
  hud.className = 'semester-hud hud glass';
  hud.setAttribute('aria-label','한 학기 진행 상황');
  const dialog = document.createElement('dialog');
  dialog.id = 'semester-notebook';
  dialog.className = 'semester-notebook';
  dialog.setAttribute('aria-labelledby','semester-heading');
  document.body.append(hud,dialog);
  let view = null, tab = 'plan', lastSim = null, stateKey = '', hudKey = '', draft = null;
  let activeSlot = 0, activeDay = 0, opened = false, finalDismissed = false, error = '';
  let returnFocus = null;

  const mandatory = () => Boolean(view && (view.phase === 'planning' || view.phase === 'review' || view.decision));
  const read = () => getSim()?.semesterView?.() || null;
  const weekdays = ['월','화','수','목','금','토','일'];
  const makeDraft = model => ({slots:[...model.plan],days:(model.days || weekdays.map(()=>model.plan)).map(day=>[...day]),focusId:model.focusId,goal:model.goal});
  const person = id => view?.npcs?.find(n => n.id === Number(id)) || NPCS.find(n => n.id === Number(id));
  const activity = id => PLAN_ACTIVITIES[id] || PLAN_ACTIVITIES.rest;
  const label = id => activity(id).label;
  const marks = () => `<div class="semester-progress" aria-label="16주 중 ${number(view.week)}주차">${SEMESTER_CALENDAR.map(c=>`<i class="${c.week < view.week || view.phase === 'complete' ? 'done' : c.week === view.week ? 'current' : ''}" title="${c.week}주 · ${escape(c.title)}"></i>`).join('')}</div>`;
  const portrait = (npc,large = false) => `<span class="semester-portrait ${large?'large':''}" style="--friend-color:${colors[(npc.id-1)%3]}" aria-hidden="true"><i class="hair"></i><i class="face"></i><i class="shirt"></i><b>${npc.id === 1 ? '·' : npc.id === 2 ? '✦' : '♡'}</b></span>`;
  const chip = (text,kind='') => `<span class="semester-chip ${kind}">${escape(text)}</span>`;
  const bar = (title,value,kind='') => `<div class="semester-meter ${kind}"><div><span>${escape(title)}</span><strong>${number(value)}<small>/100</small></strong></div><i><b style="width:${percent(value)}%"></b></i></div>`;

  function show(nextTab = tab) {
    view = read();
    if (!view) return;
    tab = ['plan','calendar','growth','friends'].includes(nextTab) ? nextTab : 'plan';
    if (!draft) draft = makeDraft(view);
    if (!opened) {
      returnFocus = document.activeElement;
      opened = true;
      onOpen();
      render();
      dialog.showModal();
    } else render();
  }

  function close(force = false) {
    if (!opened || (!force && mandatory())) return false;
    if (view?.phase === 'complete') finalDismissed = true;
    opened = false;
    dialog.close();
    onClose();
    if (returnFocus?.isConnected) returnFocus.focus({preventScroll:true});
    return true;
  }

  function action(fn) {
    try {
      fn();
      error = '';
      view = read();
      if (view.phase === 'living' && !view.decision) close(true);
      onChange();
      update(true);
    } catch (e) {
      error = e?.message || '선택을 기록하지 못했어요. 다시 선택해 주세요.';
      render();
    }
  }

  function saveDraft() {
    const sim=getSim();
    if (sim.setWeekDraft) sim.setWeekDraft({days:draft.days.map(day=>[...day]),focusId:draft.focusId,goal:draft.goal});
    view=read();
    onChange();
    render();
  }

  function header() {
    const decision = view.decision;
    const review = view.phase === 'review';
    const complete = view.phase === 'complete';
    const title = decision ? '잠깐, 마음이 머문 순간.' : complete ? '우리의 한 학기가 남았다.' : review ? '한 주가, 나의 이야기가 됐다.' : view.phase === 'planning' ? '이번 주, 어떤 날을 살아볼까?' : '하늘의 대학생활 노트';
    const subtitle = decision ? '이 작은 선택이, 다음 만남에 남아요.' : complete ? '성적표 밖에도 오래 간직할 순간들이 있어요.' : review ? '캠퍼스에서 보낸 시간을 다음 주의 마음으로.' : '계획은 작은 방향. 그 사이의 하루는 하늘이 살아가요.';
    return `<header class="semester-header"><div class="semester-heading-row"><span class="semester-kicker">HANYANG DAYS <i>·</i> 나의 첫 학기</span>${mandatory()?chip('시간을 잠시 멈췄어요','quiet'):`<button class="semester-close" id="semester-close" data-do="close" aria-label="학기 노트 닫기">×</button>`}</div><div class="semester-title-row"><div><h2 id="semester-heading">${title}</h2><p>${subtitle}</p></div><div class="semester-page-number"><strong>${String(view.week).padStart(2,'0')}</strong><span>/ 16 weeks</span></div></div>${marks()}</header>`;
  }

  function tabs() {
    return `<nav class="semester-tabs" aria-label="학기 노트 메뉴">${[['plan','주간 계획'],['calendar','학사 달력'],['growth','성장과 성적'],['friends','우리 사이']].map(([id,text])=>`<button data-tab="${id}" class="${tab===id?'active':''}" aria-pressed="${tab===id}">${text}</button>`).join('')}</nav>`;
  }

  function aside() {
    const focus = person(draft.focusId);
    const next = SEMESTER_CALENDAR.find(c=>c.week>view.week && ['midterm','final','festival','project'].some(k=>String(c.event).includes(k))) || SEMESTER_CALENDAR[Math.min(15,view.week)];
    return `<aside class="semester-margin"><div class="semester-margin-title">WEEK ${String(view.week).padStart(2,'0')}</div><h3>${escape(view.calendar?.title || '')}</h3><p>${escape(view.calendar?.description || '')}</p><div class="semester-stamp" aria-hidden="true">HANYANG<br><b>한양의<br>작은 날들</b><br>MY FIRST SEMESTER</div><div class="semester-margin-note"><span>이번 주, 마음이 향하는 곳</span><strong>${escape(focus?.name || '친구들')} <i>함께</i></strong><p>${escape(GOALS[draft.goal]?.description || '')}</p></div><div class="semester-resource-row"><span>용돈</span><strong>${won(view.money)}</strong></div><div class="semester-resource-row"><span>마음의 여유</span><strong>${view.stress > 65 ? '쉬어갈 때' : view.stress > 35 ? '조금 바쁜 마음' : '한결 가벼움'}</strong></div><div class="semester-soft-line"><i style="width:${100-percent(view.stress)}%"></i></div>${next ? `<div class="semester-next-note"><span>곧 만나게 될 날</span><strong>${next.week}주 · ${escape(next.title)}</strong></div>` : ''}</aside>`;
  }

  function plan() {
    const editable = view.phase === 'planning';
    const days = editable ? draft.days : (view.days || weekdays.map(()=>view.plan));
    const commitments = view.commitments || [];
    const status = {completed:'기억에 남았어요',missed:'다음 기회에',active:'지금 함께하는 중',traveling:'만나러 가는 중',pending:'오늘의 약속'};
    const grid = `<div class="semester-week-scroll" tabindex="0" aria-label="월요일부터 일요일까지 주간 계획표"><div class="semester-week-grid"><span class="semester-grid-corner">나의 한 주</span>${weekdays.map((name,d)=>`<button class="semester-grid-day ${activeDay===d?'selected':''} ${d>4?'weekend':''}" data-day="${d}" aria-label="${name}요일 계획"><strong>${name}</strong><small>${d>4?'자유로운 날':'수업 있는 날'}</small></button>`).join('')}${[0,1,2].map(i=>`<span class="semester-grid-time">${['10:15','14:00','16:00'][i]}<small>${['오전','오후','늦은 오후'][i]}</small></span>${weekdays.map((_,d)=>{const id=days[d][i],a=activity(id);return `<button data-plan-day="${d}" data-slot="${i}" data-semester-slot="${d}-${i}" class="semester-grid-cell ${editable&&activeDay===d&&activeSlot===i?'selected':''} ${!editable&&d===view.dayOfWeek?'today':''}" aria-label="${weekdays[d]}요일 ${i+1}번째 계획: ${escape(a.label)}" aria-pressed="${editable&&activeDay===d&&activeSlot===i}" ${editable?'':'disabled'}><span>${glyphs[id]}</span><strong>${escape(shortLabels[id] || a.label)}</strong></button>`;}).join('')}`).join('')}</div></div>`;
    return `<div class="semester-two-columns"><section class="semester-main-page"><div class="semester-section-title"><div><span class="semester-kicker">SEVEN DAYS, YOUR OWN RHYTHM</span><h3>${editable?'월요일부터 일요일까지, 나만의 리듬':'하늘에게 건넨 이번 주의 방향'}</h3></div>${chip(editable?'7일의 계획':'지금 '+weekdays[view.dayOfWeek||0]+'요일')}</div><p class="semester-intro">${editable?'한 학기 16주, 112일을 하루하루 살아갑니다. 평일에는 수업을 듣고, 하루 세 번의 여유 시간은 직접 정해 주세요. 주말에는 수업 없이 나만의 시간을 보내요.':'계획한 일을 향해 걷고, 친구를 만나고, 필요할 땐 쉬어 갑니다. 매일의 계획을 따라 일요일 저녁까지 한 주가 이어져요.'}</p>${grid}<p class="semester-grid-hint">↔ 계획표를 옆으로 밀면 일요일까지 볼 수 있어요.</p>${editable?`<div class="semester-activity-picker"><div class="semester-picker-label"><span>${weekdays[activeDay]}요일 · ${activeSlot+1}번째 계획</span><button data-do="copy-day" class="semester-copy-day">이 하루를 일주일에 적용 ↗</button></div><div class="semester-activities">${Object.entries(PLAN_ACTIVITIES).map(([id,a])=>`<button data-activity="${id}" aria-label="${escape(a.label)} 선택" aria-pressed="${days[activeDay][activeSlot]===id}" class="${days[activeDay][activeSlot]===id?'chosen':''}"><span>${glyphs[id]}</span><strong>${escape(shortLabels[id] || a.label)}</strong></button>`).join('')}</div><p class="semester-activity-description"><span>${glyphs[days[activeDay][activeSlot]]}</span>${escape(activity(days[activeDay][activeSlot]).description)}</p></div>`:`<div class="semester-current-plan">${commitments.map(c=>`<p><time>${clock(c.start)}</time><span>${escape(label(c.kind))}</span><small class="${c.status==='completed'?'fulfilled':''}">${escape(c.outcome || status[c.status] || '')}</small></p>`).join('')}</div>`}<div class="semester-plan-balance"><div><span>계획한 근무를 모두 마치면</span><strong>+${won(days.flat().filter(id=>id==='work').length*22000)}</strong></div><p>주간 생활비 +100,000원 · 교통·생활 −30,000원<br>식사 한 번 4,500원 · 근무는 실제 일한 만큼</p></div><div class="semester-section-title compact"><h3>${editable?'조금 더 가까워지고 싶은 사람':'이번 주 함께할 사람'}</h3><small>함께하는 계획에서 만나요</small></div><div class="semester-focus-picker">${NPCS.map(n=>`<button data-focus="${n.id}" class="${draft.focusId===n.id?'chosen':''}" aria-pressed="${draft.focusId===n.id}" ${editable?'':'disabled'}>${portrait(n)}<span><strong>${escape(n.name)}</strong><small>${escape(n.interest || n.short)}</small></span>${draft.focusId===n.id?'<b>✓</b>':''}</button>`).join('')}</div><div class="semester-section-title compact"><h3>이번 학기, 남기고 싶은 것</h3></div><div class="semester-goal-picker">${Object.entries(GOALS).map(([id,g])=>`<button data-goal="${id}" aria-pressed="${draft.goal===id}" class="${draft.goal===id?'chosen':''}" ${editable?'':'disabled'}><span>${glyphs[id]}</span>${escape(g.label)}</button>`).join('')}</div><p class="semester-muted">${escape(GOALS[draft.goal]?.description || '')}</p></section>${aside()}</div>`;
  }

  function calendar() {
    return `<section class="semester-full-page"><div class="semester-section-title"><div><span class="semester-kicker">THE RHYTHM OF CAMPUS</span><h3>처음의 인사부터, 마지막 시험까지</h3></div>${chip('가상의 16주 학사 일정')}</div><p class="semester-intro">바쁜 시험 주간, 시끌벅적한 축제, 함께 만든 발표. 학사의 흐름은 그 주의 선택과 실제 생활에 영향을 줍니다.</p><div class="semester-calendar-grid">${SEMESTER_CALENDAR.map(c=>{const done=c.week<view.week||view.phase==='complete';const current=c.week===view.week;const report=view.history?.find(r=>r.week===c.week);return `<article class="semester-calendar-card ${done?'done':''} ${current?'current':''}"><div><span>${String(c.week).padStart(2,'0')} <small>WEEK</small></span><b>${done?'✓':current?'지금':'·'}</b></div><h4>${escape(c.title)}</h4><p>${escape(report?.summary || c.description)}</p></article>`;}).join('')}</div><p class="semester-footnote">실제 학교의 공식 일정과는 다른, 게임 속 학기입니다. 월요일부터 일요일까지 모두 시뮬레이션하며, 112일의 기억을 쌓습니다.</p></section>`;
  }

  function growth() {
    const completed = view.history?.length || 0;
    return `<section class="semester-full-page"><div class="semester-section-title"><div><span class="semester-kicker">SMALL EFFORTS, REAL CHANGE</span><h3>하루하루가 쌓여, 나라는 사람이 되다</h3></div>${chip(`${completed}주의 기록`)}</div><p class="semester-intro">수업에 도착하고, 노트를 펼치고, 사람들 앞에서 말하고, 스스로 생활한 시간이 남아 있어요.</p><div class="semester-growth-grid">${Object.entries(growthLabels).map(([key,title],i)=>`<article class="semester-growth-card"><span>${['▤','✦','↗'][i]}</span>${bar(title,view.growth?.[key])}<p>${['수업과 자율 학습, 시험 준비로 깊어져요.','동아리와 사람들 앞에서 나누는 대화로 자라요.','아르바이트와 꾸준한 생활을 통해 단단해져요.'][i]}</p></article>`).join('')}</div><div class="semester-section-title compact"><h3>이번 학기의 두 과목</h3><small>성적은 공부와 출석, 프로젝트의 결과예요</small></div><div class="semester-course-grid">${(view.courses||[]).map(c=>`<article class="semester-course"><div class="semester-course-heading"><h4>${escape(c.title)}</h4><strong>${c.grade==null?'수강 중':`${number(c.grade)}점`}</strong></div>${bar('이해도',c.knowledge)}<dl><div><dt>출석</dt><dd>${number(c.attendance)}%</dd></div><div><dt>중간고사</dt><dd>${c.midterm==null?'아직':`${number(c.midterm)}점`}</dd></div><div><dt>기말고사</dt><dd>${c.final==null?'아직':`${number(c.final)}점`}</dd></div><div><dt>프로젝트</dt><dd>${number(c.project)}%</dd></div></dl></article>`).join('')}</div><div class="semester-life-balance"><div><span>생활비를 스스로 꾸려가는 중</span><strong>${won(view.money)}</strong><p>식사와 만남에는 용돈이, 아르바이트에는 시간이 들어요.</p></div><div>${bar('스트레스',view.stress,'stress')}<p>${view.stress>65?'계속 달려왔다면 쉬는 계획도 필요해요.':'잘 쉬어 가는 것도, 한 학기를 살아가는 방법.'}</p></div></div>${view.history?.length?`<div class="semester-section-title compact"><h3>최근, 달라진 것들</h3></div><div class="semester-recent-growth">${view.history.slice(-3).reverse().map(r=>`<article><span>${r.week}주</span><div><strong>${escape(r.title)}</strong><p>${escape(r.summary)}</p></div></article>`).join('')}</div>`:''}</section>`;
  }

  function friends() {
    const stages = {acquaintance:'낯익은 동기',friend:'함께 다니는 친구',close:'마음 편한 사이',dating:'연인',declined:'천천히 다시, 친구로'};
    return `<section class="semester-full-page"><div class="semester-section-title"><div><span class="semester-kicker">THE PEOPLE IN MY DAYS</span><h3>같은 길을 걷다, 서로의 하루에 들어오다</h3></div>${chip('세 사람, 서로 다른 마음')}</div><p class="semester-intro">함께한 시간이 친밀함으로, 지킨 약속이 믿음으로 남아요. 마음은 한 번의 선택으로 정해지지 않고, 각자의 속도로 자랍니다.</p><div class="semester-friends-grid">${(view.npcs||NPCS).map(n=>{const r=n.relationship||{};return `<article class="semester-friend-card ${r.status==='dating'?'dating':''}"><div class="semester-friend-top">${portrait(n,true)}<div><h4>${escape(n.name)}</h4><span>${escape(n.interest || n.short)}</span></div></div>${chip(stages[r.status] || n.stage || '처음 만난 사이',r.status==='dating'?'rose':'')}<p class="semester-friend-description">${escape(n.description)}</p><div class="semester-friend-values">${bar('우정',r.friendship)}${bar('서로의 믿음',r.trust)}${bar('설레는 마음',r.romance,'romance')}</div><div class="semester-friend-memories"><span>함께한 활동 <strong>${number(r.sharedActivities)}번</strong></span><span>둘만의 데이트 <strong>${number(r.dates)}번</strong></span></div><p class="semester-friend-preference"><strong>좋아하는 시간</strong>${(n.likes||[]).map(id=>escape(label(id))).join(' · ')}</p><p class="semester-boundary">“${escape(n.boundary || '서로의 속도를 존중하며 가까워지고 싶어.')}”</p></article>`;}).join('')}</div><div class="semester-relationship-note"><span>♡</span><p>함께 보내는 시간과 믿음이 쌓이면, 마음을 전할 기회가 생겨요. 사귀게 된 뒤에도 약속을 지키고 서로를 챙기는 시간은 계속됩니다.</p></div></section>`;
  }

  function decision() {
    const d = view.decision;
    const focus = person(view.focusId);
    return `<section class="semester-decision-page"><div class="semester-decision-art" aria-hidden="true"><span class="semester-decision-ring"></span>${focus?portrait(focus,true):''}<b>✦</b></div><span class="semester-kicker">WEEK ${String(view.week).padStart(2,'0')} · 마음이 움직이는 순간</span><h3>${escape(d.title)}</h3><p class="semester-decision-text">${escape(d.text)}</p><div class="semester-decision-options">${d.options.map((o,i)=>`<button data-option="${escape(o.id)}" data-semester-option="${escape(o.id)}"><span class="decision-number">0${i+1}</span><span><strong>${escape(o.label)}</strong><small>${escape(o.description)}</small></span><b>↗</b></button>`).join('')}</div><p class="semester-footnote">선택하면 실제 활동과 관계에 반영되고, 하늘의 하루가 다시 이어집니다.</p></section>`;
  }

  function review() {
    const r = view.report || view.history?.at(-1) || {};
    const focus = person(view.focusId);
    return `<section class="semester-review-page"><div class="semester-review-hero"><span class="semester-review-flower" aria-hidden="true">✺</span><div><span class="semester-kicker">A WEEK TO REMEMBER</span><h3>${escape(r.title || view.calendar?.title)}</h3><p>${escape(r.summary || '배우고, 만나고, 쉬어 가며 한 주를 살아냈어요.')}</p></div></div><div class="semester-review-deltas">${Object.entries(growthLabels).map(([key,title])=>`<div><span>${title}</span><strong>${signed(r.growth?.[key])}</strong></div>`).join('')}<div><span>생활비 변화</span><strong>${Number(r.moneyDelta)>0?'+':''}${won(r.moneyDelta)}</strong></div></div><div class="semester-review-columns"><div><h4>이 주에 남은 장면들</h4><div class="semester-highlight-list">${(r.highlights||[]).map(text=>`<p><span>✦</span>${escape(text)}</p>`).join('') || '<p><span>·</span>익숙한 길을 걷고, 조금 더 나다운 하루를 보냈어요.</p>'}</div>${r.missed?.length?`<div class="semester-missed-note"><strong>다음엔 조금 다르게</strong><p>${r.missed.map(t=>escape(PLAN_ACTIVITIES[t]?.label || t)).join(' · ')}</p><small>늦은 도착이나 부족한 체력 때문에 놓친 계획이에요. 쉬는 시간도 계획해 보세요.</small></div>`:''}</div><div class="semester-review-friend"><span class="semester-kicker">이번 주, 우리의 거리</span>${focus?`${portrait(focus,true)}<h4>${escape(focus.name)}</h4><p>${escape(focus.label || focus.stage || '조금씩 서로의 하루를 알아가는 중')}</p>${bar('서로의 믿음',focus.relationship?.trust)}<small>함께한 활동 ${number(focus.relationship?.sharedActivities)}번</small>`:''}</div></div><p class="semester-footnote">지금의 성장, 친구와의 기억, 일곱 날의 선택이 다음 주로 이어집니다.</p></section>`;
  }

  function ending() {
    const e = view.ending || {};
    const partner = view.npcs?.find(n=>n.relationship?.status === 'dating');
    return `<section class="semester-ending-page"><div class="semester-ending-emblem" aria-hidden="true">✦<span>16</span>✦</div><span class="semester-kicker">THE FIRST CHAPTER, COMPLETED</span><h3>${escape(e.title || '한양에서 보낸, 나의 첫 학기')}</h3><p class="semester-ending-text">${escape(e.text || '처음엔 낯설던 언덕에, 나를 알아보는 얼굴들과 나만의 기억이 남았어요.')}</p><div class="semester-ending-goal">${glyphs[view.goal] || '✦'} <span>${escape(GOALS[view.goal]?.label || '나만의 학기')}</span>${chip(e.success?'마음먹은 곳에 닿았어요':'또 다른 이야기가 남았어요',e.success?'green':'quiet')}</div><div class="semester-ending-grades">${(view.courses||[]).map(c=>`<article><span>${escape(c.title)}</span><strong>${c.grade==null?'수료':`${number(c.grade)}점`}</strong><small>중간 ${number(c.midterm)} · 기말 ${number(c.final)} · 프로젝트 ${number(c.project)}</small></article>`).join('')}</div><div class="semester-ending-people"><span>함께 걸었던 사람들</span><div>${(view.npcs||[]).map(n=>`<article>${portrait(n)}<strong>${escape(n.name)}</strong><small>${escape(n.relationship?.status==='dating'?'우리, 연인':n.label || n.stage || '같은 캠퍼스의 친구')}</small></article>`).join('')}</div></div><div class="semester-ending-highlights">${(e.highlights||[]).map(text=>`<p><span>✦</span>${escape(text)}</p>`).join('')}</div><div class="semester-summer-note"><span>다음 계절을 앞두고</span><p>${partner?`${escape(partner.name)}과(와) 함께 걸을 다음 계절도 궁금해져요. 이번 학기의 마음과 약속은 기록에 그대로 남아 있어요.`:'계절은 바뀌어도, 이 언덕에서 배운 것과 가까워진 사람들은 남아 있어요.'}</p><small>이야기는 한 학기까지입니다. 저장한 기록과 학기 노트는 계속 돌아볼 수 있어요.</small></div></section>`;
  }

  function footer() {
    if (view.decision) return '';
    if (view.phase === 'review') return `<footer class="semester-footer"><p>좋았던 날도, 아쉬운 날도 다음 계획의 힌트가 돼요.</p><button class="semester-primary" id="semester-next" data-do="next">${view.week===16?'학기 결산 보기':'다음 주 계획하기'} <span>→</span></button></footer>`;
    if (view.phase === 'complete') return `<footer class="semester-footer"><button class="semester-secondary" data-do="ending-notebook">기록 더 살펴보기</button><button class="semester-primary" data-do="close">캠퍼스에 여운 남기기 <span>↗</span></button></footer>`;
    if (view.phase === 'planning') return `<footer class="semester-footer"><p><span class="semester-tiny-dot"></span>계획을 마치면 캠퍼스의 시간이 흘러요.</p><button class="semester-primary" id="semester-start-week" data-do="start">${view.week}주차 시작하기 <span>→</span></button></footer>`;
    return `<footer class="semester-footer"><p>노트를 덮으면, 하늘의 하루가 이어집니다.</p><button class="semester-primary" data-do="close">캠퍼스로 돌아가기 <span>↗</span></button></footer>`;
  }

  let showEnding = true;
  function render(resetScroll = false) {
    if (!view) return;
    const scrollTop = resetScroll ? 0 : (dialog.querySelector('.semester-paper-body')?.scrollTop || 0);
    const scrollLeft = resetScroll ? 0 : (dialog.querySelector('.semester-week-scroll')?.scrollLeft || 0);
    const special = Boolean(view.decision || view.phase==='review' || (view.phase==='complete' && showEnding));
    dialog.classList.toggle('semester-special',special);
    dialog.dataset.phase = view.decision?'decision':view.phase;
    dialog.innerHTML = `${header()}${special?'':tabs()}<div class="semester-paper-body">${view.decision?decision():view.phase==='review'?review():view.phase==='complete'&&showEnding?ending():({plan,calendar,growth,friends}[tab])()}</div>${error?`<p class="semester-error" role="alert">${escape(error)}</p>`:''}${footer()}<button class="semester-export" data-do="export" title="친구와 기억, 112일의 계획까지 저장 파일로 간직해요">학기 저장 파일 내려받기 ↗</button>`;
    const body=dialog.querySelector('.semester-paper-body'), week=dialog.querySelector('.semester-week-scroll');
    if(body) body.scrollTop=scrollTop;
    if(week) week.scrollLeft=scrollLeft;
  }

  function update(force = false) {
    const sim = getSim();
    const next = read();
    if (!next || document.body.classList.contains('is-setting')) {hud.hidden=true;return;}
    hud.hidden=false;
    const newSim = sim !== lastSim;
    const key = `${next.week}|${next.dayOfWeek}|${next.phase}|${next.decision?.id || ''}`;
    const changed = stateKey !== key || newSim;
    view = next;
    if (!draft || newSim || (changed && next.phase==='planning')) {
      draft = makeDraft(next);
      activeSlot=0;activeDay=next.dayOfWeek||0;
    }
    if (newSim) {finalDismissed=false;showEnding=true;}
    lastSim=sim;
    stateKey=key;
    const hKey = [view.week,view.dayOfWeek,view.phase,view.calendar?.title,view.decision?.id,view.commitments?.map(c=>c.status).join(',')].join('|');
    if (hudKey!==hKey) {
      hudKey=hKey;
      const nextCommitment=view.commitments?.find(c=>!['completed','missed'].includes(c.status));
      hud.innerHTML=`<button id="semester-open" aria-label="학기 노트 열기"><span class="semester-hud-week"><strong>${String(view.week).padStart(2,'0')}</strong><small>/16</small></span><span class="semester-hud-copy"><small>${view.phase==='complete'?'완성된 첫 학기':view.phase==='planning'?'새로운 한 주':view.phase==='review'?'이번 주를 돌아보며':`${weekdays[view.dayOfWeek||0]}요일 · ${view.absoluteDay||getSim().day}일째`}</small><strong>${escape(view.calendar?.title || '나의 첫 학기')}</strong><em>${view.decision?'마음이 머문 순간':view.phase==='complete'?'우리의 이야기를 다시 펼치기':nextCommitment?`${clock(nextCommitment.start)} · ${escape(label(nextCommitment.kind))}`:'계획 · 성장 · 우리 사이'}</em></span><span class="semester-hud-open">▤<small>노트</small></span></button><button id="semester-skip" class="semester-skip" title="45분을 요약 진행해요. 중요한 선택 앞에서는 멈춥니다." ${view.phase!=='living'||view.decision?'disabled':''}>다음 장면 <span>→</span></button><div class="semester-hud-progress"><i style="width:${((view.week-1+(view.phase==='complete'?1:0))/16)*100}%"></i></div>`;
    }
    if (changed) error='';
    if (mandatory() || (view.phase==='complete'&&!finalDismissed)) {
      if (!opened) show('plan');
      else if (changed || force) render(changed);
    } else if (opened && (changed || force)) render();
  }

  hud.addEventListener('click',event=>{if(event.target.closest('#semester-skip')){if(view.phase==='living'&&!view.decision){onSkip();update();}return;}showEnding=true;show();});
  dialog.addEventListener('click',event=>{
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    if (button.dataset.tab) {tab=button.dataset.tab;render(true);return;}
    if (button.dataset.day!==undefined) {activeDay=Number(button.dataset.day);render();return;}
    if (button.dataset.slot!==undefined && view.phase==='planning') {activeSlot=Number(button.dataset.slot);activeDay=Number(button.dataset.planDay);render();dialog.querySelector('.semester-activity-picker')?.scrollIntoView({block:'nearest',behavior:'smooth'});return;}
    if (button.dataset.activity && view.phase==='planning') {draft.days[activeDay][activeSlot]=button.dataset.activity;draft.slots=[...draft.days[0]];saveDraft();return;}
    if (button.dataset.focus && view.phase==='planning') {draft.focusId=Number(button.dataset.focus);saveDraft();return;}
    if (button.dataset.goal && view.phase==='planning') {draft.goal=button.dataset.goal;saveDraft();return;}
    if (button.dataset.option) {action(()=>getSim().chooseSemesterOption(button.dataset.option));return;}
    if (button.dataset.do==='copy-day') {draft.days=weekdays.map(()=>[...draft.days[activeDay]]);draft.slots=[...draft.days[0]];saveDraft();return;}
    if (button.dataset.do==='export') {onExport();return;}
    if (button.dataset.do==='start') action(()=>getSim().startWeek({slots:[...draft.slots],days:draft.days.map(day=>[...day]),focusId:draft.focusId,goal:draft.goal}));
    if (button.dataset.do==='next') action(()=>getSim().advanceWeek());
    if (button.dataset.do==='close') close();
    if (button.dataset.do==='ending-notebook') {showEnding=false;tab='growth';render(true);}
  });
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  // Native close events are queued: an earlier close must not reset a reopened notebook.
  dialog.addEventListener('close',()=>{if(opened&&!dialog.open){opened=false;onClose();}});

  return {update,open:show,close, get isOpen(){return opened;},get isMandatory(){return mandatory();},destroy(){close(true);hud.remove();dialog.remove();}};
}

// DS Journal — план/факт дневник обучения
// v0.1 MVP — 11.06.2026

(function() {
  'use strict';

  // ============================================================
  // ХРАНИЛИЩЕ
  // ============================================================
  const K_SESSIONS = 'dsj_sessions_v1';   // [{id,date,start,end,pauses,solo,project,done,diffS,diffM,repeat7,notes}]
  const K_PLANS = 'dsj_plans_v1';         // { 'YYYY-MM-DD': [{id,text,est,done}] }
  const K_DEADLINES = 'dsj_deadlines_v1'; // [{id,title,date}]
  const K_TIMER = 'dsj_timer_v1';         // {startTs,pausedAt,pausedTotal}

  let sessions = load(K_SESSIONS, []);
  let plans = load(K_PLANS, {});
  let deadlines = load(K_DEADLINES, null);
  let timer = load(K_TIMER, null);
  let editingSessionId = null;
  let currentScreen = 'today';
  let timerTick = null;

  // стартовые дедлайны — версионируемый сид (новые версии доезжают
  // до телефона, где localStorage уже заполнен)
  const K_DLSEED = 'dsj_dlseed_v1';
  const DL_SEEDS = [
    { v: 1, key: 'DSB7', title: 'DSB7 финиш (ex05 + повторы + peer-review)', date: '2026-06-16' },
    { v: 2, key: 'DSB8', title: 'DSB8 SQL — финиш', date: '2026-06-23' },
    { v: 2, key: 'DSB9', title: 'DSB9 — финиш', date: '2026-06-30' },
    { v: 2, key: 'DSB10', title: 'DSB10 ML — финиш', date: '2026-07-07' },
    { v: 2, key: 'DSB11', title: 'DSB11 ML — финиш', date: '2026-07-13' },
    { v: 2, key: 'DSB12', title: 'DSB12 Team-проект (Food&nutrition) — финиш', date: '2026-07-18' },
    { v: 1, key: 'вся программа', title: 'Вся программа DSB — жёсткий дедлайн', date: '2026-07-26' }
  ];
  const DLSEED_CUR = 2;
  (function migrateDeadlines() {
    if (deadlines === null) deadlines = [];
    const haveVer = Number(localStorage.getItem(K_DLSEED) || 0);
    if (haveVer >= DLSEED_CUR) return;
    DL_SEEDS.forEach(s => {
      if (s.v <= haveVer) return; // эта версия уже сеялась
      // ключ не должен быть частью другого ("DSB8" внутри "DSB8–12")
      const re = new RegExp(s.key + '(?![\\d–-])');
      if (deadlines.some(x => re.test(x.title))) return; // уже есть/правился вручную
      deadlines.push({ id: uid(), title: s.title, date: s.date });
    });
    localStorage.setItem(K_DLSEED, String(DLSEED_CUR));
    save(K_DEADLINES, deadlines);
  })();

  function load(key, def) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : def;
    } catch (e) { return def; }
  }
  function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function todayKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
      '-' + String(d.getDate()).padStart(2, '0');
  }

  // ============================================================
  // ВРЕМЯ: helpers
  // ============================================================
  function hm(date) { // Date -> 'HH:MM'
    return String(date.getHours()).padStart(2, '0') + ':' +
           String(date.getMinutes()).padStart(2, '0');
  }

  // чистые минуты сессии: конец - старт - паузы (поддержка перехода через полночь)
  function netMinutes(s) {
    const [sh, sm] = s.start.split(':').map(Number);
    const [eh, em] = s.end.split(':').map(Number);
    let mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins < 0) mins += 24 * 60;
    return Math.max(0, mins - (Number(s.pauses) || 0));
  }

  function fmtMin(m) {
    m = Math.round(m);
    const h = Math.floor(m / 60);
    return h > 0 ? h + ' ч ' + (m % 60) + ' мин' : m + ' мин';
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ============================================================
  // ЭКРАНЫ
  // ============================================================
  const TITLES = { today: 'Сегодня', journal: 'Журнал', deadlines: 'Дедлайны', more: 'Ещё', 'session-form': 'Сессия' };

  function showScreen(name) {
    currentScreen = name;
    document.querySelectorAll('.screen').forEach(s => s.hidden = true);
    document.getElementById(name).hidden = false;
    document.getElementById('screen-title').textContent = TITLES[name] || 'DS Journal';
    document.querySelectorAll('#tabbar .tab').forEach(t =>
      t.classList.toggle('active', t.dataset.screen === name));
    if (name === 'today') renderToday();
    if (name === 'journal') renderJournal();
    if (name === 'deadlines') renderDeadlines();
  }

  // ============================================================
  // СЕГОДНЯ: план
  // ============================================================
  function todayPlan() {
    const key = todayKey();
    if (!plans[key]) plans[key] = [];
    return plans[key];
  }

  function renderToday() {
    // план
    const list = document.getElementById('plan-list');
    list.innerHTML = '';
    const plan = todayPlan();
    plan.forEach(t => {
      const li = document.createElement('li');
      li.className = 'plan-item' + (t.done ? ' done' : '');
      li.innerHTML =
        `<span class="plan-check">${t.done ? '✅' : '⬜'}</span>` +
        `<span class="plan-text">${escapeHtml(t.text)}</span>` +
        `<span class="plan-est">${t.est ? t.est + 'м' : ''}</span>` +
        `<button class="plan-del" title="удалить">✕</button>`;
      li.querySelector('.plan-check').addEventListener('click', () => {
        t.done = !t.done; save(K_PLANS, plans); renderToday();
      });
      li.querySelector('.plan-del').addEventListener('click', () => {
        plans[todayKey()] = todayPlan().filter(x => x.id !== t.id);
        save(K_PLANS, plans); renderToday();
      });
      list.appendChild(li);
    });
    if (plan.length === 0) {
      list.innerHTML = '<li class="muted">План пуст — добавь задачи на день</li>';
    }
    const est = plan.reduce((a, t) => a + (Number(t.est) || 0), 0);
    const doneCnt = plan.filter(t => t.done).length;
    document.getElementById('plan-summary').textContent =
      plan.length ? `${doneCnt}/${plan.length} · план ${fmtMin(est)}` : '';

    // сессии за сегодня
    const box = document.getElementById('today-sessions');
    box.innerHTML = '';
    const todays = sessions.filter(s => s.date === todayKey());
    todays.forEach(s => box.appendChild(sessionCard(s)));
    const total = todays.reduce((a, s) => a + netMinutes(s), 0);
    const solo = todays.reduce((a, s) => a + (Number(s.solo) || 0), 0);
    document.getElementById('today-total').textContent = todays.length
      ? `${fmtMin(total)} · самост. ${total ? Math.round(solo / total * 100) : 0}%`
      : '';

    renderTimer();
  }

  function sessionCard(s) {
    const div = document.createElement('div');
    div.className = 'session-card';
    const net = netMinutes(s);
    const soloPct = net ? Math.round((Number(s.solo) || 0) / net * 100) : 0;
    div.innerHTML =
      `<div class="session-top"><strong>${escapeHtml(s.project || '—')}</strong>` +
      `<span>${s.start}–${s.end} · ${fmtMin(net)}</span></div>` +
      `<div class="session-done">${escapeHtml(s.done || '')}</div>` +
      `<div class="session-meta">самост. ${soloPct}%` +
      (s.diffS ? ` · сложн. ${s.diffS}${s.diffM ? '/' + s.diffM : ''}` : '') +
      (s.repeat7 ? ` · повтор-7д: ${s.repeat7}` : '') + `</div>`;
    div.addEventListener('click', () => openSessionForm(s.id));
    return div;
  }

  // ============================================================
  // ТАЙМЕР
  // ============================================================
  function renderTimer() {
    const stateEl = document.getElementById('timer-state');
    const badge = document.getElementById('timer-badge');
    const bStart = document.getElementById('btn-timer-start');
    const bPause = document.getElementById('btn-timer-pause');
    const bStop = document.getElementById('btn-timer-stop');

    clearInterval(timerTick);
    if (!timer) {
      stateEl.textContent = 'не запущена';
      badge.hidden = true;
      bStart.hidden = false; bPause.hidden = true; bStop.hidden = true;
      return;
    }
    bStart.hidden = true; bPause.hidden = false; bStop.hidden = false;
    bPause.textContent = timer.pausedAt ? '▶ Продолжить' : '⏸ Пауза';

    const update = () => {
      const now = timer.pausedAt || Date.now();
      const mins = Math.floor((now - timer.startTs - timer.pausedTotal) / 60000);
      const txt = Math.floor(mins / 60) + ':' + String(mins % 60).padStart(2, '0');
      stateEl.textContent = (timer.pausedAt ? 'на паузе · ' : 'идёт · ') + txt;
      badge.textContent = (timer.pausedAt ? '⏸ ' : '⏱ ') + txt;
      badge.hidden = false;
    };
    update();
    if (!timer.pausedAt) timerTick = setInterval(update, 15000);
  }

  function timerStart() {
    timer = { startTs: Date.now(), pausedAt: null, pausedTotal: 0 };
    save(K_TIMER, timer);
    renderTimer();
  }

  function timerPause() {
    if (!timer) return;
    if (timer.pausedAt) {
      timer.pausedTotal += Date.now() - timer.pausedAt;
      timer.pausedAt = null;
    } else {
      timer.pausedAt = Date.now();
    }
    save(K_TIMER, timer);
    renderTimer();
  }

  function timerStop() {
    if (!timer) return;
    if (timer.pausedAt) { // закрыть висящую паузу
      timer.pausedTotal += Date.now() - timer.pausedAt;
      timer.pausedAt = null;
    }
    const start = new Date(timer.startTs);
    const end = new Date();
    const pausesMin = Math.round(timer.pausedTotal / 60000);
    timer = null;
    save(K_TIMER, timer);
    openSessionForm(null, { start: hm(start), end: hm(end), pauses: pausesMin });
  }

  // ============================================================
  // ФОРМА СЕССИИ
  // ============================================================
  function openSessionForm(sessionId, prefill) {
    editingSessionId = sessionId;
    const s = sessionId ? sessions.find(x => x.id === sessionId) : null;
    const p = s || prefill || {};
    document.getElementById('sf-title').textContent = s ? 'Правка сессии' : 'Запись сессии';
    document.getElementById('sf-project').value = p.project || lastProject() || '';
    document.getElementById('sf-start').value = p.start || '';
    document.getElementById('sf-end').value = p.end || '';
    document.getElementById('sf-pauses').value = p.pauses || 0;
    document.getElementById('sf-solo').value = p.solo || 0;
    document.getElementById('sf-done').value = p.done || '';
    document.getElementById('sf-diff-s').value = p.diffS || '';
    document.getElementById('sf-diff-m').value = p.diffM || '';
    document.getElementById('sf-repeat7').value = p.repeat7 || '';
    document.getElementById('sf-notes').value = p.notes || '';
    document.getElementById('btn-session-delete').hidden = !s;

    // подсказки проектов из истории
    const dl = document.getElementById('sf-project-options');
    dl.innerHTML = '';
    [...new Set(sessions.map(x => x.project).filter(Boolean))].slice(-8).forEach(name => {
      const o = document.createElement('option');
      o.value = name;
      dl.appendChild(o);
    });

    showScreen('session-form');
  }

  function lastProject() {
    const last = sessions[sessions.length - 1];
    return last ? last.project : '';
  }

  function saveSessionForm() {
    const start = document.getElementById('sf-start').value;
    const end = document.getElementById('sf-end').value;
    if (!start || !end) { alert('Укажи старт и конец'); return; }
    const data = {
      project: document.getElementById('sf-project').value.trim(),
      start, end,
      pauses: Number(document.getElementById('sf-pauses').value) || 0,
      solo: Number(document.getElementById('sf-solo').value) || 0,
      done: document.getElementById('sf-done').value.trim(),
      diffS: document.getElementById('sf-diff-s').value,
      diffM: document.getElementById('sf-diff-m').value,
      repeat7: document.getElementById('sf-repeat7').value,
      notes: document.getElementById('sf-notes').value.trim()
    };
    if (editingSessionId) {
      Object.assign(sessions.find(x => x.id === editingSessionId), data);
    } else {
      sessions.push(Object.assign({ id: uid(), date: todayKey() }, data));
    }
    save(K_SESSIONS, sessions);
    editingSessionId = null;
    showScreen('today');
  }

  function deleteSession() {
    if (!editingSessionId) return;
    if (!confirm('Удалить запись?')) return;
    sessions = sessions.filter(x => x.id !== editingSessionId);
    save(K_SESSIONS, sessions);
    editingSessionId = null;
    showScreen('today');
  }

  // ============================================================
  // ЖУРНАЛ: лента план vs факт
  // ============================================================
  // дни: i дней назад → массив ключей [от..до)
  function dayKeysBack(from, to) {
    const keys = [];
    for (let i = from; i < to; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      keys.push(todayKey(d));
    }
    return keys;
  }

  function rangeStats(dayKeys) {
    const ss = sessions.filter(s => dayKeys.includes(s.date));
    const fact = ss.reduce((a, s) => a + netMinutes(s), 0);
    const solo = ss.reduce((a, s) => a + (Number(s.solo) || 0), 0);
    let planned = 0;
    dayKeys.forEach(k => {
      planned += (plans[k] || []).reduce((a, t) => a + (Number(t.est) || 0), 0);
    });
    return { fact, solo, planned, sessions: ss };
  }

  // дельта к прошлому периоду: "↑ +1.2" / "↓ −15%"
  function deltaText(cur, prev, suffix) {
    if (prev === 0 && cur === 0) return '';
    const d = cur - prev;
    if (Math.abs(d) < 0.05) return '= как раньше';
    const arrow = d > 0 ? '↑' : '↓';
    const sign = d > 0 ? '+' : '−';
    return `${arrow} ${sign}${Math.abs(d).toFixed(suffix === '%' ? 0 : 1)}${suffix} к пред. неделе`;
  }

  function setDelta(id, cur, prev, suffix) {
    const el = document.getElementById(id);
    el.textContent = deltaText(cur, prev, suffix);
    el.className = 'stat-delta ' + (cur > prev ? 'up' : cur < prev ? 'down' : '');
  }

  function renderJournal() {
    // эта неделя vs прошлая
    const thisW = rangeStats(dayKeysBack(0, 7));
    const prevW = rangeStats(dayKeysBack(7, 14));

    const hoursCur = thisW.fact / 60, hoursPrev = prevW.fact / 60;
    document.getElementById('jstat-week').textContent = hoursCur.toFixed(1);
    setDelta('jdelta-week', hoursCur, hoursPrev, ' ч');

    const soloCur = thisW.fact ? Math.round(thisW.solo / thisW.fact * 100) : 0;
    const soloPrev = prevW.fact ? Math.round(prevW.solo / prevW.fact * 100) : 0;
    document.getElementById('jstat-solo').textContent = soloCur + '%';
    setDelta('jdelta-solo', soloCur, soloPrev, '%');

    const planCur = thisW.planned ? Math.round(thisW.fact / thisW.planned * 100) : null;
    const planPrev = prevW.planned ? Math.round(prevW.fact / prevW.planned * 100) : null;
    document.getElementById('jstat-plan').textContent = planCur === null ? '—' : planCur + '%';
    if (planCur !== null && planPrev !== null) setDelta('jdelta-plan', planCur, planPrev, '%');
    else document.getElementById('jdelta-plan').textContent = '';

    // streak: дни подряд с сессиями (начиная с сегодня или вчера)
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const has = sessions.some(s => s.date === todayKey(d));
      if (has) streak++;
      else if (i > 0) break; // сегодня может ещё не быть — не рвём
    }
    document.getElementById('jstat-streak').textContent = streak;

    renderTrendChart();
    renderMastery();
    renderProjects();

    // лента по дням
    const feed = document.getElementById('journal-feed');
    feed.innerHTML = '';
    const days = [...new Set([...sessions.map(s => s.date), ...Object.keys(plans)])]
      .sort().reverse().slice(0, 30);
    if (days.length === 0) {
      feed.innerHTML = '<p class="muted">Записей пока нет</p>';
      return;
    }
    days.forEach(day => {
      const daySessions = sessions.filter(s => s.date === day);
      const dayPlan = plans[day] || [];
      const fact = daySessions.reduce((a, s) => a + netMinutes(s), 0);
      const planned = dayPlan.reduce((a, t) => a + (Number(t.est) || 0), 0);
      const solo = daySessions.reduce((a, s) => a + (Number(s.solo) || 0), 0);
      if (!daySessions.length && !dayPlan.length) return;

      const block = document.createElement('div');
      block.className = 'jr-block';
      let bar = '';
      if (planned > 0) {
        const pct = Math.min(100, Math.round(fact / planned * 100));
        bar = `<div class="pf-bar"><div class="pf-fill${pct >= 100 ? ' full' : ''}" style="width:${pct}%"></div></div>` +
              `<div class="muted-sm">план ${fmtMin(planned)} → факт ${fmtMin(fact)} (${pct}%)</div>`;
      } else {
        bar = `<div class="muted-sm">факт ${fmtMin(fact)} (план не ставился)</div>`;
      }
      block.innerHTML =
        `<div class="jr-block-head"><h2>${day}</h2>` +
        `<span class="muted-sm">самост. ${fact ? Math.round(solo / fact * 100) : 0}%</span></div>` + bar;
      daySessions.forEach(s => block.appendChild(sessionCard(s)));
      feed.appendChild(block);
    });
  }

  // ============================================================
  // ТЕНДЕНЦИИ
  // ============================================================
  const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

  function renderTrendChart() {
    const box = document.getElementById('trend-chart');
    box.innerHTML = '';
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = todayKey(d);
      const fact = sessions.filter(s => s.date === key)
        .reduce((a, s) => a + netMinutes(s), 0);
      const planned = (plans[key] || []).reduce((a, t) => a + (Number(t.est) || 0), 0);
      days.push({ key, wd: WD[d.getDay()], fact, planned });
    }
    const max = Math.max(60, ...days.map(d => d.fact));
    days.forEach(d => {
      const col = document.createElement('div');
      col.className = 'tcol';
      const h = d.fact ? Math.max(4, Math.round(d.fact / max * 64)) : 2;
      const cls = !d.fact ? 'empty' : !d.planned ? 'plain'
        : d.fact >= d.planned ? 'good' : 'under';
      col.innerHTML =
        `<div class="tval">${d.fact ? (d.fact / 60).toFixed(1) : ''}</div>` +
        `<div class="tbar ${cls}" style="height:${h}px"></div>` +
        `<div class="tday">${d.wd}</div>`;
      box.appendChild(col);
    });
  }

  function renderMastery() {
    const box = document.getElementById('trend-mastery');
    const keys = dayKeysBack(0, 14);
    const learn = sessions.filter(s => keys.includes(s.date) && s.repeat7);
    if (!learn.length) {
      box.innerHTML = '<p class="muted">Нет учебных записей с ответом «повторю через 7 дней?»</p>';
      return;
    }
    const n = { 'да': 0, 'частично': 0, 'нет': 0 };
    learn.forEach(s => { if (n[s.repeat7] !== undefined) n[s.repeat7]++; });
    const total = learn.length;
    const pct = k => Math.round(n[k] / total * 100);
    box.innerHTML =
      `<div class="mbar">` +
      `<div class="m-yes" style="width:${pct('да')}%"></div>` +
      `<div class="m-part" style="width:${pct('частично')}%"></div>` +
      `<div class="m-no" style="width:${pct('нет')}%"></div>` +
      `</div>` +
      `<div class="muted-sm">да ${n['да']} · частично ${n['частично']} · нет ${n['нет']}` +
      ` — цель: «да» растёт, «нет» уходит в повторы</div>`;
  }

  function renderProjects() {
    const box = document.getElementById('trend-projects');
    box.innerHTML = '';
    const keys = dayKeysBack(0, 7);
    const byProj = {};
    sessions.filter(s => keys.includes(s.date)).forEach(s => {
      const p = s.project || '—';
      byProj[p] = (byProj[p] || 0) + netMinutes(s);
    });
    const rows = Object.entries(byProj).sort((a, b) => b[1] - a[1]).slice(0, 6);
    if (!rows.length) {
      box.innerHTML = '<p class="muted">Записей за неделю нет</p>';
      return;
    }
    const max = rows[0][1];
    rows.forEach(([name, mins]) => {
      const row = document.createElement('div');
      row.className = 'proj-row';
      row.innerHTML =
        `<div class="proj-name">${escapeHtml(name)}</div>` +
        `<div class="proj-bar"><div style="width:${Math.round(mins / max * 100)}%"></div></div>` +
        `<div class="proj-min muted-sm">${fmtMin(mins)}</div>`;
      box.appendChild(row);
    });
  }

  // ============================================================
  // ДЕДЛАЙНЫ
  // ============================================================
  function renderDeadlines() {
    const box = document.getElementById('deadline-list');
    box.innerHTML = '';
    const today = todayKey();
    deadlines.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach(dl => {
      const days = Math.round((new Date(dl.date) - new Date(today)) / 86400000);
      const cls = days < 0 ? 'over' : days <= 3 ? 'soon' : '';
      const div = document.createElement('div');
      div.className = 'deadline-item ' + cls;
      div.innerHTML =
        `<div><div class="dl-title">${escapeHtml(dl.title)}</div>` +
        `<div class="muted-sm">${dl.date}</div></div>` +
        `<div class="dl-days">${days < 0 ? 'просрочен' : days === 0 ? 'сегодня!' : days + ' дн'}</div>` +
        `<button class="plan-del">✕</button>`;
      div.querySelector('.plan-del').addEventListener('click', () => {
        if (!confirm('Удалить дедлайн?')) return;
        deadlines = deadlines.filter(x => x.id !== dl.id);
        save(K_DEADLINES, deadlines);
        renderDeadlines();
      });
      box.appendChild(div);
    });
    if (deadlines.length === 0) box.innerHTML = '<p class="muted">Дедлайнов нет</p>';
  }

  // ============================================================
  // ЭКСПОРТ
  // ============================================================
  function exportMarkdown() {
    const day = todayKey();
    const todays = sessions.filter(s => s.date === day);
    if (!todays.length) {
      document.getElementById('export-md-out').value = 'Сегодня нет записанных сессий.';
      return;
    }
    const lines = [];
    todays.forEach(s => {
      const net = netMinutes(s);
      const soloPct = net ? Math.round((Number(s.solo) || 0) / net * 100) : 0;
      lines.push(`### ${day} — ${s.project || '—'}`);
      lines.push(`- Старт–конец: ${s.start}–${s.end} (мск), паузы ${s.pauses || 0} мин`);
      lines.push(`- Чистое время: ${fmtMin(net)}; самостоятельно: ${fmtMin(Number(s.solo) || 0)} (${soloPct}%)`);
      if (s.diffS) lines.push(`- Сложность: ${s.diffS}${s.diffM ? '/' + s.diffM : ''} (студент/наставник)`);
      if (s.repeat7) lines.push(`- Повторю через 7 дней: ${s.repeat7}`);
      if (s.done) lines.push(`- Сделано: ${s.done}`);
      if (s.notes) lines.push(`- Заметки: ${s.notes}`);
      lines.push('');
    });
    const md = lines.join('\n');
    document.getElementById('export-md-out').value = md;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(md).then(() => {
        document.getElementById('btn-export-md').textContent = '✅ Скопировано';
        setTimeout(() => {
          document.getElementById('btn-export-md').textContent = 'Скопировать markdown за сегодня';
        }, 1500);
      }).catch(() => {});
    }
  }

  function exportJson() {
    const data = JSON.stringify({
      version: '0.1', exported: new Date().toISOString(),
      sessions, plans, deadlines
    }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dsjournal_backup_${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJson(file) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.sessions) { sessions = data.sessions; save(K_SESSIONS, sessions); }
        if (data.plans) { plans = data.plans; save(K_PLANS, plans); }
        if (data.deadlines) { deadlines = data.deadlines; save(K_DEADLINES, deadlines); }
        alert('Импорт выполнен');
        showScreen('today');
      } catch (err) {
        alert('Файл повреждён');
      }
    };
    reader.readAsText(file);
  }

  // ============================================================
  // СОБЫТИЯ
  // ============================================================
  function bindEvents() {
    document.querySelectorAll('#tabbar .tab').forEach(t =>
      t.addEventListener('click', () => showScreen(t.dataset.screen)));

    document.getElementById('btn-plan-add').addEventListener('click', () => {
      const text = document.getElementById('plan-text').value.trim();
      if (!text) return;
      todayPlan().push({
        id: uid(), text,
        est: Number(document.getElementById('plan-est').value) || 0,
        done: false
      });
      save(K_PLANS, plans);
      document.getElementById('plan-text').value = '';
      document.getElementById('plan-est').value = '';
      renderToday();
    });

    document.getElementById('btn-timer-start').addEventListener('click', timerStart);
    document.getElementById('btn-timer-pause').addEventListener('click', timerPause);
    document.getElementById('btn-timer-stop').addEventListener('click', timerStop);

    document.getElementById('btn-session-manual').addEventListener('click', () => openSessionForm(null));
    document.getElementById('btn-session-save').addEventListener('click', saveSessionForm);
    document.getElementById('btn-session-cancel').addEventListener('click', () => {
      editingSessionId = null;
      showScreen('today');
    });
    document.getElementById('btn-session-delete').addEventListener('click', deleteSession);

    document.getElementById('btn-dl-add').addEventListener('click', () => {
      const title = document.getElementById('dl-title').value.trim();
      const date = document.getElementById('dl-date').value;
      if (!title || !date) return;
      deadlines.push({ id: uid(), title, date });
      save(K_DEADLINES, deadlines);
      document.getElementById('dl-title').value = '';
      document.getElementById('dl-date').value = '';
      renderDeadlines();
    });

    document.getElementById('btn-export-md').addEventListener('click', exportMarkdown);
    document.getElementById('btn-export-json').addEventListener('click', exportJson);
    document.getElementById('btn-import-json').addEventListener('click', () =>
      document.getElementById('import-file').click());
    document.getElementById('import-file').addEventListener('change', e => {
      if (e.target.files.length) importJson(e.target.files[0]);
    });
  }

  // ============================================================
  // SERVICE WORKER + СТАРТ
  // ============================================================
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  function init() {
    bindEvents();
    showScreen('today');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

  /* Loop — carbon glass instrument.
   Pure vanilla JS, persisted to localStorage. No build step. */
(() => {
  'use strict';

  const STORE_KEY = 'loop.v1';
  const MODE_LABELS = { focus: 'time to focus', short: 'short break', long: 'long break' };
  const MODE_TAB_LABELS = { focus: 'Focus', short: 'Short Break', long: 'Long Break' };
  const RULER_RANGE = { focus: [5, 90], short: [1, 30], long: [5, 45] };
  const DIAL_TICKS = 60;
  const MAX_TASK_PIPS = 8;

  const DEFAULT_SETTINGS = { focus: 25, short: 5, long: 15, rounds: 4, autoStart: false, sound: true };

  /* 5x7 dot-matrix glyphs (colon is 1 column) */
  const GLYPHS = {
    '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
    '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
    '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
    '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
    '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
    '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
    '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
    '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
    '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
    '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
    ':': ['0', '0', '1', '0', '1', '0', '0'],
  };

  /* ---------- State ---------- */
  const load = () => {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
    catch { return {}; }
  };

  const saved = load();
  const state = {
    settings: { ...DEFAULT_SETTINGS, ...(saved.settings || {}) },
    tasks: saved.tasks || [],
    stats: saved.stats || { totalSeconds: 0, days: {}, lastDay: null, streak: 0 },
    mode: 'focus',
    round: 1,
    running: false,
    remaining: 0,
    activeTaskId: saved.activeTaskId || null,
    pomoEstimate: 1,
    view: 'timer',
  };

  const save = () => {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      settings: state.settings,
      tasks: state.tasks,
      stats: state.stats,
      activeTaskId: state.activeTaskId,
    }));
  };

  /* ---------- DOM ---------- */
  const $ = (id) => document.getElementById(id);
  const els = {
    matrixTime: $('matrixTime'),
    sessionLabel: $('sessionLabel'),
    dial: $('dial'),
    dialTicks: $('dialTicks'),
    startBtn: $('startBtn'),
    startLabel: $('startLabel'),
    resetBtn: $('resetBtn'),
    skipBtn: $('skipBtn'),
    roundCount: $('roundCount'),
    focusedToday: $('focusedToday'),
    streakChip: $('streakChip'),
    chips: document.querySelectorAll('.mode-chip'),
    chipGlider: $('chipGlider'),
    ruler: $('ruler'),
    rulerTicks: $('rulerTicks'),
    rulerFill: $('rulerFill'),
    rulerHandle: $('rulerHandle'),
    rulerValue: $('rulerValue'),
    taskForm: $('taskForm'),
    taskInput: $('taskInput'),
    taskList: $('taskList'),
    emptyTasks: $('emptyTasks'),
    taskSummary: $('taskSummary'),
    pomoCount: $('pomoCount'),
    dock: $('dock'),
    dockBubble: $('dockBubble'),
    zenHint: $('zenHint'),
  };

  const svgIcon = (path, stroke = true) => {
    const attrs = stroke
      ? 'fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"'
      : 'fill="currentColor"';
    return `<svg viewBox="0 0 24 24"><path d="${path}" ${attrs}/></svg>`;
  };
  const ICON_CHECK = svgIcon('M4.5 12.5l5 5L19.5 7');
  const ICON_X = svgIcon('M6 6l12 12M18 6L6 18');

  /* ---------- Sound (tactile ticks + chime) ---------- */
  let audioCtx = null;
  const audio = () => {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch { /* no audio */ }
    }
    return audioCtx;
  };

  function tickSound(freq = 1900, gainVal = 0.035) {
    if (!state.settings.sound) return;
    const ctx = audio();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(gainVal, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.06);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.07);
  }

  function chime() {
    if (!state.settings.sound) return;
    const ctx = audio();
    if (!ctx) return;
    [660, 880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.16;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.55);
    });
  }

  /* ---------- Dot-matrix time ---------- */
  let matrixDots = []; // per char: array of dot elements
  let matrixTemplate = '';

  function buildMatrix(str) {
    matrixTemplate = str.replace(/\d/g, '8');
    els.matrixTime.innerHTML = '';
    matrixDots = [];
    [...str].forEach((ch) => {
      const grid = GLYPHS[ch] || GLYPHS['0'];
      const cols = grid[0].length;
      const char = document.createElement('div');
      char.className = 'm-char' + (cols === 1 ? ' m-colon' : '');
      const dots = [];
      for (let row = 0; row < 7; row++) {
        for (let col = 0; col < cols; col++) {
          const dot = document.createElement('span');
          dot.className = 'm-dot';
          char.appendChild(dot);
          dots.push(dot);
        }
      }
      els.matrixTime.appendChild(char);
      matrixDots.push(dots);
    });
  }

  function renderMatrix(str) {
    if (str.replace(/\d/g, '8') !== matrixTemplate) buildMatrix(str);
    [...str].forEach((ch, idx) => {
      const grid = GLYPHS[ch] || GLYPHS['0'];
      const cols = grid[0].length;
      const dots = matrixDots[idx];
      for (let row = 0; row < 7; row++) {
        for (let col = 0; col < cols; col++) {
          dots[row * cols + col].classList.toggle('on', grid[row][col] === '1');
        }
      }
    });
  }

  /* ---------- Dial bezel ---------- */
  const dialTickEls = [];
  function buildDial() {
    const radius = 160;
    for (let i = 0; i < DIAL_TICKS; i++) {
      const tick = document.createElement('span');
      tick.className = 'dial-tick' + (i % 5 === 0 ? ' major' : '');
      const angle = i * (360 / DIAL_TICKS);
      tick.style.transform = `translate(-50%, -50%) rotate(${angle}deg) translateY(-${radius}px)`;
      els.dialTicks.appendChild(tick);
      dialTickEls.push(tick);
    }
  }

  function renderDial() {
    const total = modeSeconds(state.mode);
    const elapsed = total ? 1 - state.remaining / total : 0;
    const lit = Math.round(elapsed * DIAL_TICKS);
    dialTickEls.forEach((tick, i) => {
      tick.classList.toggle('lit', i < lit);
      tick.classList.toggle('head', state.running && i === Math.min(lit, DIAL_TICKS - 1));
    });
  }

  /* ---------- Timer engine ---------- */
  let ticker = null;
  let endAt = 0;

  const modeSeconds = (mode) => state.settings[mode] * 60;

  function setMode(mode, { resetRound = false } = {}) {
    state.mode = mode;
    if (resetRound) state.round = 1;
    state.remaining = modeSeconds(mode);
    document.body.dataset.mode = mode;
    els.chips.forEach((c) => c.classList.toggle('is-active', c.dataset.set === mode));
    els.sessionLabel.textContent = MODE_LABELS[mode];
    moveChipGlider();
    buildRuler();
    render();
  }

  function render() {
    const m = Math.floor(state.remaining / 60);
    const s = state.remaining % 60;
    const time = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    renderMatrix(time);
    renderDial();
    renderRulerProgress();
    document.title = state.running ? `${time} — ${MODE_TAB_LABELS[state.mode]}` : 'Loop';

    els.startLabel.textContent = state.running ? 'Pause' : 'Start';
    els.roundCount.innerHTML = `${state.round}<i>/${state.settings.rounds}</i>`;
    els.focusedToday.innerHTML = `${todayMinutes()}<i>min</i>`;
    els.streakChip.innerHTML = `${state.stats.streak || 0}<i>days</i>`;
    document.body.classList.toggle('is-running', state.running);
  }

  function start() {
    if (state.running) return pause();
    state.running = true;
    endAt = Date.now() + state.remaining * 1000;
    ticker = setInterval(tick, 250);
    tickSound(1400, 0.045);
    render();
  }

  function pause() {
    state.running = false;
    clearInterval(ticker);
    tickSound(900, 0.04);
    render();
  }

  function tick() {
    const left = Math.round((endAt - Date.now()) / 1000);
    if (left !== state.remaining) {
      state.remaining = Math.max(0, left);
      render();
    }
    if (left <= 0) complete();
  }

  function reset() {
    state.running = false;
    clearInterval(ticker);
    state.remaining = modeSeconds(state.mode);
    tickSound(700, 0.035);
    render();
  }

  function complete() {
    state.running = false;
    clearInterval(ticker);
    chime();
    notify();
    flash();

    if (state.mode === 'focus') {
      recordFocus(state.settings.focus);
      incrementActiveTask();
      const isLong = state.round % state.settings.rounds === 0;
      const next = isLong ? 'long' : 'short';
      state.round = isLong ? 1 : state.round + 1;
      setMode(next);
    } else {
      setMode('focus');
    }
    save();
    if (state.settings.autoStart) start();
  }

  function skip() {
    pause();
    if (state.mode === 'focus') {
      const isLong = state.round % state.settings.rounds === 0;
      state.round = isLong ? 1 : state.round + 1;
      setMode(isLong ? 'long' : 'short');
    } else {
      setMode('focus');
    }
  }

  function flash() {
    document.body.classList.add('flash');
    els.dial.classList.add('pop');
    setTimeout(() => {
      document.body.classList.remove('flash');
      els.dial.classList.remove('pop');
    }, 700);
  }

  /* ---------- Ruler (session length scrubber) ---------- */
  function rulerRange() { return RULER_RANGE[state.mode]; }

  function minuteToPct(min) {
    const [lo, hi] = rulerRange();
    return ((min - lo) / (hi - lo)) * 100;
  }

  function buildRuler() {
    const [lo, hi] = rulerRange();
    els.rulerTicks.innerHTML = '';
    for (let m = lo; m <= hi; m++) {
      const tick = document.createElement('span');
      tick.className = 'r-tick' + (m % 5 === 0 ? ' major' : '');
      tick.style.left = `${minuteToPct(m)}%`;
      els.rulerTicks.appendChild(tick);
      const isLabeled = m === lo || m === hi || (m % 15 === 0 && m - lo >= 5 && hi - m >= 5);
      if (isLabeled) {
        const label = document.createElement('span');
        label.className = 'r-label';
        label.style.left = `${minuteToPct(m)}%`;
        label.textContent = m;
        els.rulerTicks.appendChild(label);
      }
    }
    positionRulerHandle();
  }

  function positionRulerHandle() {
    const pct = minuteToPct(state.settings[state.mode]);
    els.rulerHandle.style.left = `${pct}%`;
    els.rulerValue.style.left = `${pct}%`;
    els.rulerValue.innerHTML = `${state.settings[state.mode]}<em>min</em>`;
  }

  function renderRulerProgress() {
    const pct = minuteToPct(state.settings[state.mode]);
    if (state.running || state.remaining < modeSeconds(state.mode)) {
      const total = modeSeconds(state.mode);
      const elapsed = total ? 1 - state.remaining / total : 0;
      els.rulerFill.style.width = `${pct * elapsed}%`;
    } else {
      els.rulerFill.style.width = '0%';
    }
  }

  let dragMinute = null;
  function rulerFromEvent(e) {
    const [lo, hi] = rulerRange();
    const rect = els.ruler.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    return Math.round(lo + frac * (hi - lo));
  }

  function applyRulerMinute(min) {
    if (min === state.settings[state.mode]) return;
    state.settings[state.mode] = min;
    if (!state.running) state.remaining = modeSeconds(state.mode);
    tickSound(2100, 0.02);
    positionRulerHandle();
    render();
  }

  els.ruler.addEventListener('pointerdown', (e) => {
    if (state.running) return;
    els.ruler.setPointerCapture(e.pointerId);
    dragMinute = rulerFromEvent(e);
    applyRulerMinute(dragMinute);
  });
  els.ruler.addEventListener('pointermove', (e) => {
    if (dragMinute === null) return;
    const min = rulerFromEvent(e);
    if (min !== dragMinute) {
      dragMinute = min;
      applyRulerMinute(min);
    }
  });
  els.ruler.addEventListener('pointerup', () => {
    if (dragMinute === null) return;
    dragMinute = null;
    save();
  });

  /* ---------- Stats ---------- */
  const todayKey = () => new Date().toISOString().slice(0, 10);
  const todayMinutes = () => Math.round((state.stats.days[todayKey()] || 0) / 60);

  function recordFocus(minutes) {
    const secs = minutes * 60;
    const key = todayKey();
    state.stats.days[key] = (state.stats.days[key] || 0) + secs;
    state.stats.totalSeconds += secs;
    updateStreak(key);
  }

  function updateStreak(key) {
    if (state.stats.lastDay === key) return;
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    state.stats.streak = state.stats.lastDay === yesterday ? state.stats.streak + 1 : 1;
    state.stats.lastDay = key;
  }

  function renderStats() {
    $('statToday').innerHTML = `${todayMinutes()}<i>m</i>`;
    const sessionsToday = Math.floor((state.stats.days[todayKey()] || 0) / (state.settings.focus * 60));
    $('statSessions').textContent = sessionsToday;
    $('statTotal').innerHTML = `${(state.stats.totalSeconds / 3600).toFixed(1)}<i>h</i>`;
    $('statStreak').innerHTML = `${state.stats.streak || 0}<i>d</i>`;

    const bars = $('weekBars');
    bars.innerHTML = '';
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      days.push({
        key: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2),
      });
    }
    let weekSecs = 0;
    const max = Math.max(3600, ...days.map((d) => state.stats.days[d.key] || 0));
    days.forEach((d, i) => {
      const secs = state.stats.days[d.key] || 0;
      weekSecs += secs;
      const col = document.createElement('div');
      col.className = 'bar-col';
      const shell = document.createElement('div');
      shell.className = 'bar-shell';
      const bar = document.createElement('div');
      bar.className = 'bar' + (i === 6 ? ' today' : '');
      bar.style.height = `${Math.max(4, (secs / max) * 100)}%`;
      bar.title = `${Math.round(secs / 60)} min`;
      shell.appendChild(bar);
      const mins = document.createElement('div');
      mins.className = 'bar-min';
      mins.textContent = secs ? `${Math.round(secs / 60)}m` : '·';
      const lab = document.createElement('div');
      lab.className = 'bar-label';
      lab.textContent = d.label;
      col.append(shell, mins, lab);
      bars.appendChild(col);
    });
    $('weekTotal').textContent = `${Math.round(weekSecs / 60)} min total`;
  }

  /* ---------- Tasks ---------- */
  const taskComplete = (t) => t.completed || t.done >= t.est;

  function addTask(text, pomos) {
    state.tasks.push({ id: Date.now().toString(36), text, pomos, done: 0, est: pomos });
    save();
    renderTasks();
  }

  function incrementActiveTask() {
    const task = state.tasks.find((t) => t.id === state.activeTaskId && !taskComplete(t));
    if (!task) return;
    task.done += 1;
    if (task.done >= task.est) task.completed = true;
    renderTasks();
  }

  function taskPips(t) {
    const wrap = document.createElement('span');
    wrap.className = 'task-pips';
    if (t.est > MAX_TASK_PIPS) {
      const text = document.createElement('span');
      text.className = 'pip-text';
      text.textContent = `${t.done}/${t.est}`;
      wrap.appendChild(text);
      return wrap;
    }
    for (let i = 0; i < t.est; i++) {
      const pip = document.createElement('span');
      pip.className = 'task-pip' + (i < t.done ? ' fill' : '');
      wrap.appendChild(pip);
    }
    return wrap;
  }

  function renderTasks() {
    els.taskList.innerHTML = '';
    const doneCount = state.tasks.filter(taskComplete).length;
    els.taskSummary.textContent = `${doneCount}/${state.tasks.length} done`;
    els.emptyTasks.hidden = state.tasks.length > 0;

    state.tasks.forEach((t) => {
      const li = document.createElement('li');
      li.className = 'task-item';
      if (taskComplete(t)) li.classList.add('done');
      if (t.id === state.activeTaskId && !taskComplete(t)) li.classList.add('active-task');
      li.title = 'Tap to set as active task';
      li.onclick = () => {
        state.activeTaskId = t.id;
        tickSound(1600, 0.025);
        save();
        renderTasks();
      };

      const check = document.createElement('button');
      check.className = 'task-check' + (taskComplete(t) ? ' checked' : '');
      check.innerHTML = ICON_CHECK;
      check.title = 'Toggle complete';
      check.onclick = (e) => {
        e.stopPropagation();
        const nowDone = !taskComplete(t);
        t.completed = nowDone;
        if (nowDone) t.done = Math.max(t.done, t.est);
        else t.done = Math.min(t.done, t.est - 1);
        tickSound(nowDone ? 2200 : 1100, 0.035);
        save();
        renderTasks();
      };

      const span = document.createElement('span');
      span.className = 'task-text';
      span.textContent = t.text;

      const del = document.createElement('button');
      del.className = 'task-del';
      del.innerHTML = ICON_X;
      del.title = 'Delete';
      del.onclick = (e) => {
        e.stopPropagation();
        state.tasks = state.tasks.filter((x) => x.id !== t.id);
        if (state.activeTaskId === t.id) state.activeTaskId = null;
        tickSound(600, 0.03);
        save();
        renderTasks();
      };

      li.append(check, span, taskPips(t), del);
      els.taskList.appendChild(li);
    });
  }

  /* ---------- Steppers ---------- */
  function bindStepper(wrapId, get, set, min, max, displayId) {
    $(wrapId).querySelectorAll('.step-btn').forEach((btn) => {
      btn.onclick = () => {
        const next = Math.min(max, Math.max(min, get() + parseInt(btn.dataset.step, 10)));
        set(next);
        $(displayId).textContent = next;
        tickSound(1800, 0.025);
      };
    });
    $(displayId).textContent = get();
  }

  /* ---------- Switches ---------- */
  function bindSwitch(id, get, set) {
    const el = $(id);
    el.setAttribute('aria-checked', String(get()));
    el.onclick = () => {
      set(!get());
      el.setAttribute('aria-checked', String(get()));
      tickSound(get() ? 2000 : 1000, 0.035);
      save();
    };
  }

  /* ---------- Views / dock ---------- */
  function setView(view) {
    state.view = view;
    document.body.dataset.view = view;
    const buttons = [...els.dock.querySelectorAll('.dock-btn')];
    buttons.forEach((b) => b.classList.toggle('is-active', b.dataset.view === view));
    const idx = buttons.findIndex((b) => b.dataset.view === view);
    els.dockBubble.style.transform = `translateX(${idx * 64}px)`; // 58px btn + 6px gap
    if (view === 'stats') renderStats();
    if (view === 'settings') syncSettingsView();
    tickSound(1700, 0.02);
  }

  els.dock.querySelectorAll('.dock-btn').forEach((btn) => {
    btn.onclick = () => setView(btn.dataset.view);
  });

  function syncSettingsView() {
    $('roundsCount').textContent = state.settings.rounds;
    $('autoSwitch').setAttribute('aria-checked', String(state.settings.autoStart));
    $('soundSwitch').setAttribute('aria-checked', String(state.settings.sound));
  }

  /* ---------- Zen mode ---------- */
  function toggleZen(on) {
    const enable = on ?? !document.body.classList.contains('zen');
    document.body.classList.toggle('zen', enable);
    if (enable) setView('timer');
  }

  els.dial.addEventListener('click', () => {
    if (document.body.classList.contains('zen')) start();
  });

  /* ---------- Alerts ---------- */
  function notify() {
    const msg = state.mode === 'focus' ? 'Focus session done — take a break.' : 'Break over — back to focus.';
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Loop', { body: msg });
    }
  }

  function requestNotify() {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  }

  /* ---------- Specular sheen tracking ---------- */
  document.addEventListener('pointermove', (e) => {
    const glass = e.target.closest?.('.glass');
    if (!glass) return;
    const rect = glass.getBoundingClientRect();
    glass.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    glass.style.setProperty('--my', `${e.clientY - rect.top}px`);
  }, { passive: true });

  /* ---------- Wire up ---------- */
  els.startBtn.onclick = () => { requestNotify(); start(); };
  els.resetBtn.onclick = reset;
  els.skipBtn.onclick = skip;

  function moveChipGlider() {
    const active = [...els.chips].find((c) => c.classList.contains('is-active'));
    if (!active) return;
    els.chipGlider.style.transform = `translateX(${active.offsetLeft - 5}px)`;
    els.chipGlider.style.width = `${active.offsetWidth}px`;
  }

  els.chips.forEach((chip) => {
    chip.onclick = () => {
      pause();
      setMode(chip.dataset.set);
      tickSound(1500, 0.03);
    };
  });

  els.taskForm.onsubmit = (e) => {
    e.preventDefault();
    const text = els.taskInput.value.trim();
    if (!text) return;
    addTask(text, state.pomoEstimate);
    els.taskInput.value = '';
    state.pomoEstimate = 1;
    $('pomoCount').textContent = 1;
    tickSound(2000, 0.035);
    els.taskInput.focus();
  };

  bindStepper('pomoStepper',
    () => state.pomoEstimate, (v) => { state.pomoEstimate = v; }, 1, 20, 'pomoCount');
  bindStepper('roundsStepper',
    () => state.settings.rounds,
    (v) => { state.settings.rounds = v; save(); render(); },
    1, 12, 'roundsCount');
  bindSwitch('autoSwitch',
    () => state.settings.autoStart, (v) => { state.settings.autoStart = v; });
  bindSwitch('soundSwitch',
    () => state.settings.sound, (v) => { state.settings.sound = v; });

  $('zenBtn').onclick = () => toggleZen();

  /* double-press to confirm stats reset */
  let resetArmTimer = null;
  $('resetStats').onclick = (e) => {
    const btn = e.currentTarget;
    if (btn.classList.contains('armed')) {
      state.stats = { totalSeconds: 0, days: {}, lastDay: null, streak: 0 };
      save();
      btn.classList.remove('armed');
      btn.textContent = 'Reset all stats';
      clearTimeout(resetArmTimer);
      render();
    } else {
      btn.classList.add('armed');
      btn.textContent = 'Tap again to confirm';
      resetArmTimer = setTimeout(() => {
        btn.classList.remove('armed');
        btn.textContent = 'Reset all stats';
      }, 3000);
    }
  };

  /* ---------- Keyboard ---------- */
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea')) return;
    const key = e.key.toLowerCase();
    if (e.code === 'Space') { e.preventDefault(); start(); }
    else if (key === 'r') reset();
    else if (key === 's') skip();
    else if (key === 'f') toggleZen();
    else if (key === 't') { setView('tasks'); setTimeout(() => els.taskInput.focus(), 50); e.preventDefault(); }
    else if (key === '1') setView('timer');
    else if (key === '2') setView('tasks');
    else if (key === '3') setView('stats');
    else if (key === '4') setView('settings');
    else if (e.key === 'Escape') {
      if (document.body.classList.contains('zen')) toggleZen(false);
      else setView('timer');
    }
  });

  window.addEventListener('resize', () => { moveChipGlider(); });

  /* ---------- Init ---------- */
  buildDial();
  buildMatrix('00:00');
  setMode('focus', { resetRound: true });
  renderTasks();
  syncSettingsView();
  render();
  requestAnimationFrame(moveChipGlider);
})();

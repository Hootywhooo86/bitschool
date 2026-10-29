/* ---------------- Grown-ups ---------------- */
let parentTab = 'progress';

function screenParent() {
  if (sessionStorage.getItem('bitschool.parent') !== '1') return parentGate();
  const tabs = [['progress', 'PROGRESS'], ['words', 'PROBLEM WORDS'], ['recordings', 'RECORDINGS'], ['check', 'CHECK ANSWERS'], ['settings', 'SETTINGS']];
  const waiting = Store.state.pending.filter(p => p.status === 'waiting').length;
  view().innerHTML = `
    <section class="panel">
      <h1>${icon('chart')} Grown-ups</h1>
      <div class="tabs">${tabs.map(([k, l]) => `<button class="btn alt ${parentTab === k ? 'on' : ''}" data-tab="${k}"><span>${l}${k === 'check' && waiting ? ' (' + waiting + ')' : ''}</span></button>`).join('')}
        <button class="btn warn" data-lock><span>LOCK 🔒</span></button></div>
      <div id="ptab"></div>
    </section>`;
  $$('[data-tab]').forEach(b => b.onclick = () => { parentTab = b.dataset.tab; screenParent(); });
  $('[data-lock]').onclick = () => { sessionStorage.removeItem('bitschool.parent'); go('home'); };
  ({ progress: tabProgress, words: tabWords, recordings: tabRecordings, check: tabCheck, settings: tabSettings })[parentTab]($('#ptab'));
}

function parentGate() {
  const a = 6 + Math.floor(Math.random() * 4), b = 6 + Math.floor(Math.random() * 4);
  view().innerHTML = `
    <section class="panel center">
      ${icon('chart', 160)}
      <h1>Grown-ups only</h1>
      <p class="lead">What is ${a} × ${b}?</p>
      <input class="input narrow" type="number" inputmode="numeric" aria-label="Answer">
      <div class="row wrap-row center-row">
        <button class="btn" data-ok><span>OPEN</span></button>
        <button class="btn alt" data-go="home"><span>BACK</span></button>
      </div>
    </section>`;
  const inp = $('input', view());
  const ok = () => { if (+inp.value === a * b) { sessionStorage.setItem('bitschool.parent', '1'); screenParent(); } else { toast('Not quite — ask a grown-up'); inp.value = ''; } };
  $('[data-ok]').onclick = ok;
  inp.addEventListener('keydown', e => e.key === 'Enter' && ok());
  inp.focus();
}

// Single-series line chart: 2px line, 10px markers, hover/tap tooltip, table view underneath.
function lineChart(id, title, pts, { unit = '', goal = null, max = null } = {}) {
  if (pts.length < 2) return `<div class="chart-card"><h3>${esc(title)}</h3><p class="muted">Read at least two stories to see this chart.</p></div>`;
  const W = 640, H = 260, L = 48, R = 16, T = 16, B = 34;
  const top = max || Math.ceil(Math.max(...pts.map(p => p.y), goal || 0) * 1.15 / 10) * 10 || 10;
  const x = i => L + (W - L - R) * (pts.length === 1 ? 0.5 : i / (pts.length - 1));
  const y = v => T + (H - T - B) * (1 - v / top);
  const grid = [0, 0.25, 0.5, 0.75, 1].map(f => `<line x1="${L}" x2="${W - R}" y1="${y(top * f)}" y2="${y(top * f)}" class="grid"/><text x="${L - 8}" y="${y(top * f) + 4}" class="axis" text-anchor="end">${Math.round(top * f)}</text>`).join('');
  const goalLine = goal ? `<line x1="${L}" x2="${W - R}" y1="${y(goal)}" y2="${y(goal)}" class="goal"/><text x="${W - R}" y="${y(goal) - 6}" class="axis" text-anchor="end">goal ${goal}${unit}</text>` : '';
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join('');
  const dots = pts.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.y)}" r="5" class="dot"/><circle cx="${x(i)}" cy="${y(p.y)}" r="16" class="hit" data-tip="${esc(p.label + ': ' + p.y + unit)}"/>`).join('');
  return `
    <div class="chart-card" id="${id}">
      <h3>${esc(title)}</h3>
      <div class="chart-wrap">
        <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">
          ${grid}${goalLine}
          <path d="${path}" class="line"/>${dots}
          <text x="${L}" y="${H - 8}" class="axis">${esc(pts[0].date)}</text>
          <text x="${W - R}" y="${H - 8}" class="axis" text-anchor="end">${esc(pts[pts.length - 1].date)}</text>
        </svg>
        <div class="tip" hidden></div>
      </div>
      <details><summary class="btn alt"><span>SHOW AS TABLE</span></summary>
        <table class="data"><tr><th>Story</th><th>${esc(title)}</th></tr>${pts.map(p => `<tr><td>${esc(p.label)}</td><td>${p.y}${unit}</td></tr>`).join('')}</table>
      </details>
    </div>`;
}
function wireCharts(el) {
  $$('.chart-wrap', el).forEach(w => {
    const tip = $('.tip', w);
    $$('.hit', w).forEach(c => {
      const show = () => {
        const r = c.getBoundingClientRect(), wr = w.getBoundingClientRect();
        tip.textContent = c.dataset.tip; tip.hidden = false;
        tip.style.left = Math.min(wr.width - 160, Math.max(0, r.left - wr.left - 60)) + 'px';
        tip.style.top = (r.top - wr.top - 44) + 'px';
      };
      c.addEventListener('pointerenter', show); c.addEventListener('click', show);
      c.addEventListener('pointerleave', () => tip.hidden = true);
    });
  });
}

function tabProgress(el) {
  const s = Store.state;
  const lessons = s.sessions.filter(x => !x.placement);
  const withRead = lessons.filter(x => x.wpm != null);
  const last5 = withRead.slice(-5);
  const avg = (a, k) => a.length ? Math.round(a.reduce((t, x) => t + x[k], 0) / a.length) : '—';
  const spec = levelSpec(s.level);
  const weekAgo = Date.now() - 7 * DAY;
  const pts = k => withRead.slice(-30).map(x => ({ y: x[k], label: levelName(x.level) + ' · ' + x.title, date: fmtDate(x.at) }));
  el.innerHTML = `
    <div class="tiles-row">
      <div class="stat"><b>${s.placed ? spec.name : '—'}</b><span>LEVEL</span></div>
      <div class="stat"><b>${avg(last5, 'wpm')}</b><span>WPM (LAST 5) · GOAL ${spec.wpmGoal}</span></div>
      <div class="stat"><b>${avg(last5, 'accuracy')}${last5.length ? '%' : ''}</b><span>ACCURACY (LAST 5)</span></div>
      <div class="stat"><b>${lessons.length}</b><span>STORIES READ</span></div>
      <div class="stat"><b>${lessons.filter(x => x.at > weekAgo).length}</b><span>THIS WEEK</span></div>
    </div>
    ${lineChart('wpmChart', 'Reading speed (words per minute)', pts('wpm'), { goal: spec.wpmGoal })}
    ${lineChart('accChart', 'Accuracy (% of words read right)', pts('accuracy'), { unit: '%', max: 100 })}
    <h2 class="sub-h">Level changes</h2>
    ${s.history.length ? `<table class="data"><tr><th>Date</th><th>From</th><th>To</th><th>Why</th></tr>${s.history.slice().reverse().map(h => `<tr><td>${fmtDate(h.at)}</td><td>${levelName(h.from)}</td><td>${levelName(h.to)}</td><td>${esc(h.why)}</td></tr>`).join('')}</table>` : '<p class="muted">No level changes yet.</p>'}
    <h2 class="sub-h">Recent stories</h2>
    ${s.sessions.length ? `<table class="data"><tr><th>Date</th><th>Level</th><th>Story</th><th>WPM</th><th>Accuracy</th><th>Score</th><th></th></tr>
      ${s.sessions.slice(-40).reverse().map(x => `<tr><td>${fmtDate(x.at)}</td><td>${levelName(x.level)}</td><td>${esc(x.title)}${x.placement ? ' <i class="muted">(placement)</i>' : ''}</td><td>${x.wpm ?? '—'}</td><td>${x.accuracy != null ? x.accuracy + '%' : '—'}</td><td>${x.score != null ? x.score + '%' : '—'}</td><td>${x.passed ? '✓ pass' : '✗'}</td></tr>`).join('')}</table>` : '<p class="muted">Nothing read yet.</p>'}`;
  wireCharts(el);
}

function tabWords(el) {
  const list = Object.entries(Store.state.words).map(([k, w]) => ({ k, ...w })).sort((a, b) => (b.misses * 2 + b.looked) - (a.misses * 2 + a.looked));
  el.innerHTML = list.length ? `
    <p class="muted">Words missed or skipped while reading, wrong in fill-in-the-blank, or tapped for a meaning. They return in Word Review until they are learned (6 stars).</p>
    <div class="word-list">${list.map(w => `
      <div class="word-row">
        <b class="w-big">${esc(w.word)}</b>
        <span>${w.misses} missed · ${w.looked} looked up · ${'★'.repeat(w.box)}${'☆'.repeat(Math.max(0, REVIEW_DAYS.length - w.box))}${w.meaning ? '<br><i class="muted">' + esc(w.meaning) + '</i>' : ''}</span>
        <button class="btn alt square" data-hear="${esc(w.word)}" aria-label="Hear ${esc(w.word)}">${icon('speaker')}</button>
        <button class="btn warn" data-del="${esc(w.k)}"><span>REMOVE</span></button>
      </div>`).join('')}</div>` : '<p class="muted">No problem words yet.</p>';
  $$('[data-hear]', el).forEach(b => b.onclick = () => Speech.say(b.dataset.hear, { rate: 0.7 }));
  $$('[data-del]', el).forEach(b => b.onclick = () => { delete Store.state.words[b.dataset.del]; Store.save(); tabWords(el); });
}

function tabRecordings(el) {
  const recs = Store.state.sessions.filter(x => x.recId).reverse();
  el.innerHTML = recs.length ? recs.map(x => `
    <div class="rec-row" data-id="${x.id}">
      <div><b>${esc(x.title)}</b><br><span class="muted">${new Date(x.at).toLocaleString()} · ${levelName(x.level)} · ${x.wpm ?? '—'} WPM · ${x.accuracy ?? '—'}%</span>
        ${x.missed && x.missed.length ? `<br><span class="muted">Missed: ${x.missed.map(esc).join(', ')}</span>` : ''}</div>
      <div class="row wrap-row">
        <button class="btn" data-play="${x.recId}"><span>▶ PLAY</span></button>
        <button class="btn warn" data-delrec="${x.id}"><span>DELETE</span></button>
      </div>
      <div class="player"></div>
    </div>`).join('') : '<p class="muted">Recordings appear here after he reads a story out loud (the microphone must be allowed).</p>';
  $$('[data-play]', el).forEach(b => b.onclick = async () => {
    const box = $('.player', b.closest('.rec-row'));
    const blob = await Blobs.get(b.dataset.play).catch(() => null);
    if (!blob) { box.innerHTML = '<p class="muted">This recording is missing.</p>'; return; }
    const url = URL.createObjectURL(blob);
    box.innerHTML = `<audio controls src="${url}"></audio>`;
    $('audio', box).play().catch(() => {});
    onLeave(() => URL.revokeObjectURL(url));
  });
  $$('[data-delrec]', el).forEach(b => b.onclick = async () => {
    const x = Store.state.sessions.find(s => s.id === b.dataset.delrec);
    if (!x || !confirm('Delete this recording?')) return;
    await Blobs.del(x.recId).catch(() => {});
    x.recId = null; Store.save(); tabRecordings(el);
  });
}

function tabCheck(el) {
  const list = Store.state.pending.slice().reverse();
  el.innerHTML = list.length ? `<p class="muted">Handwritten answers wait here when no handwriting model is set. Mark them right or not yet.</p>` + list.map(p => `
    <div class="check-row" data-id="${p.id}">
      <p><b>${esc(p.title)}</b> · ${levelName(p.level)} · ${fmtDate(p.at)}</p>
      <p>Q: ${esc(p.q)}<br><i class="muted">A good answer includes: ${esc(p.idea)}</i></p>
      <img class="hand" alt="Handwritten answer">
      ${p.status === 'waiting' ? `<div class="row wrap-row"><button class="btn" data-mark="right"><span>RIGHT ✓</span></button><button class="btn warn" data-mark="wrong"><span>NOT YET ✗</span></button></div>`
        : `<p class="${p.status === 'right' ? 'good' : 'bad'}">Marked ${p.status === 'right' ? 'right ✓' : 'not yet ✗'}</p>`}
    </div>`).join('') : '<p class="muted">No handwritten answers to check.</p>';
  $$('.check-row', el).forEach(async row => {
    const src = await Blobs.get(row.dataset.id).catch(() => null);
    if (src) $('img', row).src = src; else $('img', row).replaceWith(Object.assign(document.createElement('p'), { className: 'muted', textContent: '(image missing)' }));
    $$('[data-mark]', row).forEach(b => b.onclick = () => {
      const p = Store.state.pending.find(x => x.id === row.dataset.id);
      p.status = b.dataset.mark;
      Store.state.sessions.forEach(s => (s.questions || []).forEach(q => { if (q.pending === p.id) q.correct = p.status === 'right'; }));
      Store.save(); screenParent();
    });
  });
}

function tabSettings(el) {
  const s = Store.state, st = s.settings, m = st.model;
  el.innerHTML = `
    <h2 class="sub-h">Reader</h2>
    <div class="row wrap-row"><input class="input grow" data-name value="${esc(s.child.name)}" placeholder="Reader's name" aria-label="Reader's name"><button class="btn" data-savename><span>SAVE NAME</span></button></div>

    <h2 class="sub-h">Level</h2>
    <div class="row wrap-row">
      <button class="btn alt" data-lv="-1"><span>− DOWN</span></button>
      <div class="stat"><b>${levelName(s.level)}</b><span>${esc(levelSpec(s.level).grade)}</span></div>
      <button class="btn alt" data-lv="1"><span>UP +</span></button>
      <button class="btn alt" data-go="placement"><span>RETAKE PLACEMENT</span></button>
    </div>

    <h2 class="sub-h">Moving up</h2>
    <p class="muted">Like Kumon: a story is passed when the score (40% read-aloud accuracy, 60% questions and tasks) reaches the pass mark.</p>
    <div class="row wrap-row">
      <button class="btn alt" data-mark="-5"><span>− 5</span></button>
      <div class="stat"><b>${st.passMark}%</b><span>PASS MARK</span></div>
      <button class="btn alt" data-mark="5"><span>+ 5</span></button>
      <button class="btn alt" data-passes="-1"><span>−</span></button>
      <div class="stat"><b>${st.passesNeeded}</b><span>PASSES IN A ROW TO MOVE UP</span></div>
      <button class="btn alt" data-passes="1"><span>+</span></button>
    </div>
    <div class="row wrap-row"><button class="btn alt ${st.allowSkipRead ? 'on' : ''}" data-skip><span>SKIP READ-ALOUD ALLOWED: ${st.allowSkipRead ? 'ON' : 'OFF'}</span></button></div>

    <h2 class="sub-h">Story writer (local model)</h2>
    <p class="muted">Stories, open-answer checking and word meanings come from a model running on this computer — nothing is sent to the internet. Default: Qwen through <a href="https://ollama.com" target="_blank" rel="noopener">Ollama</a>.</p>
    <div class="form-grid">
      <label>Server type<select class="input" data-api><option value="ollama" ${m.api === 'ollama' ? 'selected' : ''}>Ollama</option><option value="openai" ${m.api === 'openai' ? 'selected' : ''}>OpenAI-compatible (LM Studio, llama.cpp)</option></select></label>
      <label>Address<input class="input" data-endpoint value="${esc(m.endpoint)}"></label>
      <label>Story model<input class="input" data-modelname list="modelList" value="${esc(m.name)}"></label>
      <label>Handwriting model (optional, needs vision, e.g. qwen2.5vl:7b)<input class="input" data-vision list="modelList" value="${esc(m.vision)}"></label>
      <datalist id="modelList">${Model.models.map(x => `<option value="${esc(x)}">`).join('')}</datalist>
    </div>
    <div class="row wrap-row">
      <button class="btn" data-savemodel><span>SAVE & TEST</span></button>
      <button class="btn alt" data-sample><span>WRITE A SAMPLE STORY</span></button>
    </div>
    <p class="status-line" data-mstatus>${modelStatus()}</p>
    <details class="help"><summary class="btn alt"><span>HOW TO SET UP QWEN</span></summary>
      <ol>
        <li>Install Ollama from ollama.com.</li>
        <li>Download a model: <code>ollama pull qwen3:8b</code> (or <code>qwen2.5:7b</code> on smaller computers).</li>
        <li>Let this page talk to it: start Ollama with <code>OLLAMA_ORIGINS=*</code> set (on a Mac: <code>launchctl setenv OLLAMA_ORIGINS "*"</code>, then restart Ollama).</li>
        <li>Press SAVE & TEST above. On a tablet, use the computer's address, e.g. <code>http://192.168.1.20:11434</code>, and start Ollama with <code>OLLAMA_HOST=0.0.0.0</code>.</li>
      </ol></details>

    <h2 class="sub-h">Data</h2>
    <p class="muted">Everything is saved on this device only. ${s.outbox.length} family-feed events are queued for the 128bit family timeline.</p>
    <div class="row wrap-row">
      <button class="btn alt" data-export><span>EXPORT DATA</span></button>
      <button class="btn warn" data-resetall><span>RESET EVERYTHING</span></button>
    </div>`;
  const rerender = () => { Store.save(); updateTop(); tabSettings(el); };
  $('[data-savename]', el).onclick = () => { s.child.name = $('[data-name]', el).value.trim().slice(0, 30); Store.save(); toast('Name saved'); };
  $$('[data-lv]', el).forEach(b => b.onclick = () => {
    const to = Math.max(0, Math.min(LEVEL_COUNT - 1, s.level + +b.dataset.lv));
    if (to === s.level) return;
    s.history.push({ at: Date.now(), from: s.level, to, why: 'set by grown-up' });
    s.level = to; s.placed = true; s.passStreak = 0; rerender();
  });
  $$('[data-mark]', el).forEach(b => b.onclick = () => { st.passMark = Math.max(50, Math.min(100, st.passMark + +b.dataset.mark)); rerender(); });
  $$('[data-passes]', el).forEach(b => b.onclick = () => { st.passesNeeded = Math.max(1, Math.min(5, st.passesNeeded + +b.dataset.passes)); rerender(); });
  $('[data-skip]', el).onclick = () => { st.allowSkipRead = !st.allowSkipRead; rerender(); };
  $('[data-savemodel]', el).onclick = async () => {
    m.api = $('[data-api]', el).value; m.endpoint = $('[data-endpoint]', el).value.trim(); m.name = $('[data-modelname]', el).value.trim(); m.vision = $('[data-vision]', el).value.trim();
    Store.save();
    $('[data-mstatus]', el).textContent = 'Testing…';
    await Model.ping();
    const missing = Model.online && Model.models.length && !Model.models.some(x => x === m.name || x.split(':')[0] === m.name);
    tabSettings(el);
    $('[data-mstatus]', el).innerHTML = Model.online ? (missing ? `⚠ Connected, but "${esc(m.name)}" is not downloaded. Available: ${Model.models.map(esc).join(', ')}` : modelStatus())
      : '✗ Could not reach the model at ' + esc(m.endpoint) + '. Is it running, with OLLAMA_ORIGINS set?';
    if (Model.online) prefetch();
  };
  $('[data-sample]', el).onclick = async () => {
    if (!Model.online) { toast('Connect the story writer first'); return; }
    const b = $('[data-sample]', el); b.disabled = true; $('span', b).textContent = 'WRITING…';
    try {
      const p = preparePassage(await Model.writeStory(s.level));
      const mm = modal(`<h2>${esc(p.title)} <span class="pill">${levelName(p.level)}</span></h2>
        <p class="muted">${words(p.text).length} words (target ${levelSpec(p.level).words})</p>
        <div class="story small">${esc(p.text).replace(/\n/g, '<br>')}</div>
        <ol>${p.questions.map(q => `<li>${esc(q.q)}${q.type === 'mc' ? ' — <b>' + esc(q.choices[q.answer]) + '</b>' : ''}</li>`).join('')}</ol>
        <div class="row wrap-row"><button class="btn" data-keep><span>USE FOR NEXT LESSON</span></button><button class="btn alt" data-close><span>CLOSE</span></button></div>`);
      $('[data-keep]', mm.el).onclick = () => { (s.cache[p.level] = s.cache[p.level] || []).unshift(p); Store.save(); mm.close(); toast('Saved for the next lesson'); };
      $('[data-close]', mm.el).onclick = mm.close;
    } catch (e) { toast('Story writer error: ' + e.message); }
    b.disabled = false; $('span', b).textContent = 'WRITE A SAMPLE STORY';
  };
  $('[data-export]', el).onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' }));
    a.download = 'bitschool-reading-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $('[data-resetall]', el).onclick = async () => {
    if (!confirm('Erase all progress, words and recordings on this device?')) return;
    Store.reset(); await Blobs.clear().catch(() => {}); applyTheme(); sessionStorage.removeItem('bitschool.parent'); go('home'); updateTop();
  };
}

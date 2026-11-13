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
      <div class="stat"><b>${lessons.length}</b><span>SHEETS DONE</span></div>
      <div class="stat"><b>${Store.today().sheets} / ${s.settings.dailyGoal}</b><span>TODAY</span></div>
      <div class="stat"><b>${Store.streak()}</b><span>DAY STREAK</span></div>
      <div class="stat"><b>${lessons.filter(x => x.at > weekAgo).length}</b><span>THIS WEEK</span></div>
    </div>
    ${s.placed ? goalHTML() : ''}
    ${s.placed ? `<h2 class="sub-h">Current booklet</h2>${bookletHTML(Booklet.get())}<p class="muted">${Booklet.passedCount()} of ${Booklet.get().size} sheets passed. Odd sheets are Word Work, even sheets are Stories.</p>` : ''}
    ${lineChart('wpmChart', 'Reading speed (words per minute)', pts('wpm'), { goal: spec.wpmGoal })}
    ${lineChart('accChart', 'Accuracy (% of words read right)', pts('accuracy'), { unit: '%', max: 100 })}
    <h2 class="sub-h">Level changes</h2>
    ${s.history.length ? `<table class="data"><tr><th>Date</th><th>From</th><th>To</th><th>Why</th></tr>${s.history.slice().reverse().map(h => `<tr><td>${fmtDate(h.at)}</td><td>${levelName(h.from)}</td><td>${levelName(h.to)}</td><td>${esc(h.why)}</td></tr>`).join('')}</table>` : '<p class="muted">No level changes yet.</p>'}
    <h2 class="sub-h">Recent stories</h2>
    ${s.sessions.length ? `<table class="data"><tr><th>Date</th><th>Level</th><th>Sheet</th><th>Time</th><th>WPM</th><th>Accuracy</th><th>Score</th><th></th></tr>
      ${s.sessions.slice(-40).reverse().map(x => `<tr><td>${fmtDate(x.at)}</td><td>${levelName(x.level)}</td><td>${x.sheet ? '#' + x.sheet + ' ' : ''}${esc(x.title)}${x.placement ? ' <i class="muted">(placement)</i>' : ''}</td><td>${x.sheetSeconds ? fmtTime(x.sheetSeconds) : '—'}</td><td>${x.wpm ?? '—'}</td><td>${x.accuracy != null ? x.accuracy + '%' : '—'}</td><td>${x.score != null ? x.score + '%' : '—'}</td><td>${x.passed ? '✓ pass' : '✗'}</td></tr>`).join('')}</table>` : '<p class="muted">Nothing read yet.</p>'}`;
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
    <h2 class="sub-h">128bit family account</h2>
    ${Account.signedIn() ? `
      <p>Signed in as <b>${esc(Account.session.email || '')}</b>. His progress saves to the account automatically: level, booklet, scores, streak, words, story ideas and settings.</p>
      <p class="status-line" data-sync>${Account.statusText()}</p>
      <div class="row wrap-row"><button class="btn" data-savenow><span>SAVE NOW</span></button><button class="btn alt" data-signout><span>SIGN OUT</span></button></div>`
    : `
      <p class="muted">Sign in with the same email and password as 128bit Play. His progress then saves to the account and comes back on any device or after reinstalling. Recordings, handwriting pictures and the downloaded story writer stay on each device.</p>
      <div class="form-grid">
        <label>Email<input class="input" data-email type="email" autocomplete="username" autocapitalize="off"></label>
        <label>Password<input class="input" data-password type="password" autocomplete="current-password"></label>
      </div>
      <div class="row wrap-row"><button class="btn" data-signin><span>SIGN IN</span></button></div>
      <p class="status-line" data-signinmsg></p>`}

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
    <p class="muted">Like Kumon: each level is a booklet of sheets that alternate Word Work and Stories. A sheet passes at the pass mark (a Story sheet scores 40% read-aloud accuracy and 60% questions and tasks); a sheet below it comes back until it passes. Passing every sheet in the booklet moves him up one level.</p>
    <div class="row wrap-row">
      <button class="btn alt" data-mark="-5"><span>− 5</span></button>
      <div class="stat"><b>${st.passMark}%</b><span>PASS MARK</span></div>
      <button class="btn alt" data-mark="5"><span>+ 5</span></button>
      <button class="btn alt" data-goal="-1"><span>−</span></button>
      <div class="stat"><b>${st.dailyGoal}</b><span>SHEETS A DAY (DAILY GOAL)</span></div>
      <button class="btn alt" data-goal="1"><span>+</span></button>
      <button class="btn alt" data-sheets="-2"><span>−</span></button>
      <div class="stat"><b>${st.sheetsPerBooklet}</b><span>SHEETS PER BOOKLET</span></div>
      <button class="btn alt" data-sheets="2"><span>+</span></button>
    </div>
    <div class="row wrap-row"><button class="btn alt ${st.allowSkipRead ? 'on' : ''}" data-skip><span>SKIP READ-ALOUD ALLOWED: ${st.allowSkipRead ? 'ON' : 'OFF'}</span></button>
      <button class="btn alt ${st.motion !== false ? 'on' : ''}" data-motion><span>ANIMATIONS: ${st.motion !== false ? 'ON' : 'OFF'}</span></button></div>
    <p class="muted">Animations also stay off when this device is set to reduce motion.</p>

    <h2 class="sub-h">Reading voice</h2>
    <p class="muted">The voice that reads stories and words to him. The most natural-sounding voice on this device is picked automatically; choose another here. More voices: on Android, Settings → Text-to-speech → install voice data; on Windows, Settings → Time & language → Speech.</p>
    <div class="row wrap-row">
      <select class="input grow" data-voice aria-label="Reading voice"><option>Loading voices…</option></select>
      <button class="btn alt" data-voicetest>${icon('speaker')}<span>HEAR IT</span></button>
    </div>
    <div class="row wrap-row">
      <button class="btn alt" data-speed="-0.1"><span>SLOWER</span></button>
      <div class="stat"><b>${Math.round(st.voiceSpeed * 100)}%</b><span>VOICE SPEED</span></div>
      <button class="btn alt" data-speed="0.1"><span>FASTER</span></button>
    </div>

    <h2 class="sub-h">Listening</h2>
    ${listenHTML()}

    <h2 class="sub-h">Story ideas</h2>
    <p class="muted">Before each Story sheet he picks what it's about: superheroes, missions, space bugs, robots and more. Add his favorites here, like a hero, game or show. Stories stay kid-safe: action is fine, but no blood, nobody dies, no swearing, and any story that slips is thrown out and rewritten.</p>
    <div class="idea-list">${st.storyIdeas.map((t, k) => `<span class="idea-chip">${esc(t)}<button class="btn warn" data-delidea="${k}"><span>REMOVE</span></button></span>`).join('') || '<p class="muted">No ideas added yet.</p>'}</div>
    <div class="row wrap-row"><input class="input grow" data-idea maxlength="60" placeholder="Like: Spider-Man, Helldivers, Call of Duty" aria-label="Story idea"><button class="btn" data-addidea><span>ADD IDEA</span></button></div>
    <div class="row wrap-row"><button class="btn alt ${st.ownIdeas ? 'on' : ''}" data-ownideas><span>HE CAN TYPE HIS OWN IDEAS: ${st.ownIdeas ? 'ON' : 'OFF'}</span></button></div>

    <h2 class="sub-h">How stories are written</h2>
    <p class="muted">Tell the story writer how you want his stories. It follows this for every new story, inside his level and the kid-safe rules. You can also change any single story before he reads it (✎ CHANGE THIS STORY), or type your own in the story picker.</p>
    <textarea class="input" data-style rows="3" maxlength="400" placeholder="Like: Make them funny. Put our dog Max in them. Use lots of 'sh' and 'ch' words. Less fighting, more teamwork.">${esc(st.storyStyle)}</textarea>
    <div class="row wrap-row"><button class="btn" data-savestyle><span>SAVE INSTRUCTIONS</span></button></div>
    <div class="row wrap-row">
      <button class="btn alt ${st.useName ? 'on' : ''}" data-usename><span>${esc((s.child.name || 'HIS NAME').toUpperCase())} IS THE HERO: ${st.useName ? 'ON' : 'OFF'}</span></button>
    </div>
    <div class="row wrap-row">
      ${['shorter', 'normal', 'longer'].map(k => `<button class="btn alt ${st.storyLength === k ? 'on' : ''}" data-length="${k}"><span>${k === 'normal' ? 'LENGTH FOR HIS LEVEL' : k.toUpperCase()}</span></button>`).join('')}
    </div>
    <div class="row wrap-row"><input class="input grow" data-practice value="${esc(st.practiceWords.join(', '))}" placeholder="Words to practice in stories, like: ship, chase, shell"><button class="btn" data-savepractice><span>SAVE WORDS</span></button></div>

    <h2 class="sub-h">Story writer</h2>
    <p class="muted">Stories, open-answer checking and word meanings come from an AI model. On this device or a home computer, nothing is sent to the internet except the one-time model download. A cloud AI writes much faster (seconds instead of a minute or two on a phone) but needs internet and its own key, and costs a little per story.</p>
    <div class="row wrap-row">
      <button class="btn alt ${m.api === 'device' ? 'on' : ''}" data-where="device"><span>ON THIS DEVICE</span></button>
      <button class="btn alt ${m.api === 'cloud' ? 'on' : ''}" data-where="cloud"><span>CLOUD AI</span></button>
      <button class="btn alt ${m.api === 'ollama' || m.api === 'openai' ? 'on' : ''}" data-where="computer"><span>ON A COMPUTER (OLLAMA)</span></button>
    </div>
    ${m.api === 'device' ? deviceModelsHTML() : m.api === 'cloud' ? cloudHTML() : `
    <div class="form-grid">
      <label>Server type<select class="input" data-api><option value="ollama" ${m.api === 'ollama' ? 'selected' : ''}>Ollama</option><option value="openai" ${m.api === 'openai' ? 'selected' : ''}>OpenAI-compatible (LM Studio, llama.cpp)</option></select></label>
      <label>Address<input class="input" data-endpoint value="${esc(m.endpoint)}"></label>
      <label>Story model<input class="input" data-modelname list="modelList" value="${esc(m.name)}"></label>
      <label>Handwriting model (optional, needs vision, e.g. qwen3.5:4b)<input class="input" data-vision list="modelList" value="${esc(m.vision)}"></label>
      <datalist id="modelList">${Model.models.map(x => `<option value="${esc(x)}">`).join('')}</datalist>
    </div>
    <div class="row wrap-row"><button class="btn" data-savemodel><span>SAVE & TEST</span></button></div>
    <details class="help"><summary class="btn alt"><span>HOW TO SET UP OLLAMA</span></summary>
      <ol>
        <li>Install Ollama from ollama.com on a computer.</li>
        <li>Download a model: <code>ollama pull qwen3.5:4b</code> (or <code>qwen3.5:9b</code> on a strong computer).</li>
        <li>Let the app talk to it: start Ollama with <code>OLLAMA_ORIGINS=*</code> set (on a Mac: <code>launchctl setenv OLLAMA_ORIGINS "*"</code>, then restart Ollama).</li>
        <li>From a phone or tablet, use the computer's address, e.g. <code>http://192.168.1.20:11434</code>, and start Ollama with <code>OLLAMA_HOST=0.0.0.0</code>. Then press SAVE & TEST.</li>
      </ol></details>`}
    <div class="row wrap-row"><button class="btn alt" data-sample><span>WRITE A SAMPLE STORY</span></button></div>
    <p class="status-line" data-mstatus>${modelStatus()}</p>

    <h2 class="sub-h">Data</h2>
    <p class="muted">Progress is saved on this device${Account.signedIn() ? ' and in the 128bit account' : ''}. ${s.outbox.length} family-feed events are queued for the 128bit family timeline.</p>
    <div class="row wrap-row">
      <button class="btn alt" data-export><span>EXPORT DATA</span></button>
      <button class="btn warn" data-resetall><span>RESET EVERYTHING</span></button>
    </div>`;
  const rerender = () => { Store.save(); updateTop(); tabSettings(el); };
  Voices.all().then(list => {
    const sel = $('[data-voice]', el);
    if (!sel) return;
    const cur = Voices.chosenNow();
    sel.innerHTML = list.length ? list.map(v => `<option value="${esc(v.name)}" ${cur && v.name === cur.name ? 'selected' : ''}>${esc(Voices.label(v))}</option>`).join('') : '<option>No English voices found</option>';
    sel.onchange = () => { st.voice = sel.value; Store.save(); Speech.say('Hi! I will read your stories with this voice.'); };
  });
  $('[data-voicetest]', el).onclick = () => Speech.say('Sam ran up the hill. The sun was hot, so he got a cold sip of water.');
  $$('[data-speed]', el).forEach(b => b.onclick = () => { st.voiceSpeed = Math.round(Math.max(0.6, Math.min(1.4, st.voiceSpeed + +b.dataset.speed)) * 10) / 10; rerender(); Speech.say('This is my new speed.'); });
  if ($('[data-signin]', el)) $('[data-signin]', el).onclick = async () => {
    const email = $('[data-email]', el).value.trim(), password = $('[data-password]', el).value;
    if (!email || !password) return toast('Enter the email and password');
    const msg = $('[data-signinmsg]', el), b = $('[data-signin]', el);
    b.disabled = true; msg.textContent = 'Signing in…';
    try {
      const how = await Account.signIn(email, password);
      toast(how === 'pulled' ? 'Signed in — progress loaded from the account' : 'Signed in — progress saved to the account');
      applyTheme(); updateTop(); tabSettings(el);
    } catch (e) { msg.textContent = '✗ ' + e.message; b.disabled = false; }
  };
  if ($('[data-savenow]', el)) $('[data-savenow]', el).onclick = async () => {
    try { await Account.save(); toast('Saved'); } catch (e) { toast("Couldn't save: " + e.message); }
  };
  if ($('[data-signout]', el)) $('[data-signout]', el).onclick = async () => {
    if (!confirm('Sign out? His progress stays saved in the account, and on this device.')) return;
    await Account.signOut(); tabSettings(el);
  };
  $('[data-savename]', el).onclick = () => { s.child.name = $('[data-name]', el).value.trim().slice(0, 30); Store.save(); toast('Name saved'); };
  $$('[data-lv]', el).forEach(b => b.onclick = () => {
    const to = Math.max(0, Math.min(LEVEL_COUNT - 1, s.level + +b.dataset.lv));
    if (to === s.level) return;
    s.history.push({ at: Date.now(), from: s.level, to, why: 'set by grown-up' });
    s.level = to; s.placed = true; s.booklet = null; rerender();
  });
  $$('[data-mark]', el).forEach(b => b.onclick = () => { st.passMark = Math.max(50, Math.min(100, st.passMark + +b.dataset.mark)); rerender(); });
  $$('[data-goal]', el).forEach(b => b.onclick = () => { st.dailyGoal = Math.max(1, Math.min(6, st.dailyGoal + +b.dataset.goal)); rerender(); });
  $$('[data-sheets]', el).forEach(b => b.onclick = () => { st.sheetsPerBooklet = Math.max(2, Math.min(10, st.sheetsPerBooklet + +b.dataset.sheets)); rerender(); });
  $('[data-skip]', el).onclick = () => { st.allowSkipRead = !st.allowSkipRead; rerender(); };
  const addIdea = () => {
    const t = $('[data-idea]', el).value.trim().slice(0, 60);
    if (!t) return toast('Type an idea first');
    if (!st.storyIdeas.some(x => x.toLowerCase() === t.toLowerCase())) st.storyIdeas.push(t);
    rerender(); toast('Added: ' + t);
  };
  $('[data-addidea]', el).onclick = addIdea;
  // New instructions apply to stories written from now on, so stories written ahead are dropped.
  const restyle = msg => { s.cache = {}; rerender(); toast(msg); };
  $('[data-savestyle]', el).onclick = () => { st.storyStyle = $('[data-style]', el).value.trim().slice(0, 400); restyle('Saved — new stories will follow it'); };
  $('[data-usename]', el).onclick = () => { if (!s.child.name && !st.useName) return toast('Save his name under Reader first'); st.useName = !st.useName; restyle(st.useName ? 'He is the hero of new stories' : 'Stories use other characters'); };
  $$('[data-length]', el).forEach(b => b.onclick = () => { st.storyLength = b.dataset.length; restyle('Story length saved'); });
  $('[data-savepractice]', el).onclick = () => { st.practiceWords = $('[data-practice]', el).value.split(/[,;\n]/).map(w => w.trim()).filter(Boolean).slice(0, 15); restyle('Practice words saved'); };
  $('[data-idea]', el).addEventListener('keydown', e => e.key === 'Enter' && addIdea());
  $$('[data-delidea]', el).forEach(b => b.onclick = () => { st.storyIdeas.splice(+b.dataset.delidea, 1); rerender(); });
  $('[data-ownideas]', el).onclick = () => { st.ownIdeas = !st.ownIdeas; rerender(); };
  $$('[data-where]', el).forEach(b => b.onclick = async () => {
    const where = b.dataset.where;
    if (where === 'device') {
      if (!Device.available()) { toast('Downloading a model works in the Android and Windows apps'); return; }
      m.api = 'device';
    } else if (where === 'cloud') m.api = 'cloud';
    else if (m.api === 'device' || m.api === 'cloud') m.api = 'ollama';
    Store.save(); await Model.ping(); tabSettings(el); prefetch();
  });
  $('[data-motion]', el).onclick = () => { st.motion = st.motion === false; applyMotion(); rerender(); };
  wireCloud(el, () => tabSettings(el));
  wireDeviceModels(el, () => tabSettings(el));
  wireListen(el, () => tabSettings(el));
  if ($('[data-savemodel]', el)) $('[data-savemodel]', el).onclick = async () => {
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
    if (!Model.online) { toast(m.api === 'device' ? 'Download a story writer first' : 'Connect the story writer first'); return; }
    const b = $('[data-sample]', el); b.disabled = true; $('span', b).textContent = 'WRITING…';
    try {
      const p = preparePassage(await Model.writeStory(s.level, n => { $('span', b).textContent = 'WRITING… ' + n; }));
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
    // The cloud AI key stays on this device: never in an exported file.
    const out = JSON.parse(JSON.stringify(s));
    if (out.settings.model.cloud) out.settings.model.cloud.key = '';
    a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
    a.download = 'bitschool-reading-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $('[data-resetall]', el).onclick = async () => {
    if (!confirm('Erase all progress, words and recordings on this device?' + (Account.signedIn() ? ' This device signs out first, so the copy in the 128bit account is NOT erased.' : ''))) return;
    if (Account.signedIn()) { clearTimeout(Account.timer); Account.session = null; Account.status = 'signed-out'; Account.keep(); }
    Store.reset(); await Blobs.clear().catch(() => {}); applyTheme(); sessionStorage.removeItem('bitschool.parent'); go('home'); updateTop();
  };
}

// The models a grown-up can download onto this device, with progress while downloading.
function deviceModelsHTML() {
  if (!Device.available()) return '<p class="muted">Downloading a story writer onto the device works in the Android and Windows apps. In a web browser, use a computer with Ollama.</p>';
  const st = Device.state, rec = Device.recommended(), sel = Device.selected();
  const gb = b => (b / 1e9).toFixed(1) + ' GB';
  return `
    <div data-llmproblem></div>
    <p class="muted">This ${Device.isPC() ? 'computer' : 'device'}: ${st.ram ? gb(st.ram) + ' memory · ' : ''}${st.freeSpace ? gb(st.freeSpace) + ' free space' : ''}</p>
    <div class="model-list">${DEVICE_MODELS.map(dm => {
      const has = Device.has(dm), dl = Device.downloading && Device.downloading.id === dm.id;
      const lowRam = st.ram && st.ram < dm.ramGB * 0.9e9;
      return `<div class="model-card ${sel === dm ? 'on' : ''}" data-model="${dm.id}">
        <div class="model-head"><b>${esc(dm.name)}</b>${dm === rec ? '<span class="pill">RECOMMENDED HERE</span>' : ''}${sel === dm && has ? '<span class="pill">IN USE ✓</span>' : ''}</div>
        <p>${esc(dm.note)}</p>
        <p class="muted">${gb(dm.size)} download · needs about ${dm.ramGB} GB memory${lowRam ? ' — <b class="bad">more than this device has</b>' : ''}</p>
        <div class="bar ${dl ? '' : 'hidden'}"><i style="width:${dl ? Math.round(Device.downloading.loaded / Device.downloading.total * 100) : 0}%"></i></div>
        <p class="muted dl-text">${dl ? 'Downloading… ' + Math.round(Device.downloading.loaded / Device.downloading.total * 100) + '%' : has ? 'Downloaded ✓' : ''}</p>
        <div class="row wrap-row">
          ${dl ? '<button class="btn warn" data-dlcancel><span>STOP DOWNLOAD</span></button>'
            : has ? `${sel !== dm ? '<button class="btn" data-use><span>USE THIS ONE</span></button>' : ''}<button class="btn warn" data-del><span>DELETE</span></button>`
            : `<button class="btn" data-dl ${Device.downloading ? 'disabled' : ''}><span>DOWNLOAD</span></button>`}
        </div>
      </div>`;
    }).join('')}</div>`;
}

function wireDeviceModels(el, rerender) {
  const m = Store.state.settings.model;
  showLlmProblem(el, rerender);
  $$('[data-model]', el).forEach(card => {
    const dm = Device.model(card.dataset.model);
    const go = (sel, fn) => { const b = $(sel, card); if (b) b.onclick = fn; };
    go('[data-dl]', async () => {
      if (Device.state.ram && Device.state.ram < dm.ramGB * 0.9e9 && !confirm(dm.name + ' needs more memory than this device has and may not run. Download anyway?')) return;
      const bar = $('.bar', card), text = $('.dl-text', card);
      bar.classList.remove('hidden');
      $('[data-dl]', card).outerHTML = '<button class="btn warn" data-dlcancel><span>STOP DOWNLOAD</span></button>';
      $('[data-dlcancel]', card).onclick = () => Device.cancel();
      try {
        await Device.download(dm, p => {
          const pct = Math.round(p.loaded / p.total * 100);
          $('i', bar).style.width = pct + '%';
          text.textContent = `Downloading… ${pct}% (${(p.loaded / 1e9).toFixed(2)} of ${(p.total / 1e9).toFixed(2)} GB)`;
        });
        if (!Device.has(Device.selected())) m.device = dm.id; // the first download becomes the one in use
        Store.save();
        toast(dm.name + ' downloaded');
        await Model.ping(); prefetch();
      } catch (e) { toast(e.message + (e.message === 'Download stopped' ? '' : ' — press DOWNLOAD to resume')); }
      rerender();
    });
    go('[data-dlcancel]', () => Device.cancel());
    go('[data-use]', async () => { m.device = dm.id; Store.save(); await Model.ping(); rerender(); prefetch(); });
    go('[data-del]', async () => {
      if (!confirm('Delete ' + dm.name + ' from this device? You can download it again later.')) return;
      await Device.remove(dm);
      if (m.device === dm.id) m.device = '';
      Store.save(); await Model.ping(); rerender();
    });
  });
}

// How the app hears him read: the phone's own recognizer, or Whisper on the phone (downloaded once).
function listenHTML() {
  const st = Store.state.settings, can = !!nativePlugin('Whisper');
  const using = LISTEN_MODELS.find(m => m.id === st.listener && Device.has(m));
  if (!can) return '<p class="muted">Whisper listening is in the Android app. Here the app uses this device\'s own listener' + (IN_ELECTRON ? ' (none on Windows, so a grown-up helps)' : '') + '.</p>';
  const gb = b => (b / 1e6).toFixed(0) + ' MB';
  return `
    <p class="muted">How the app hears him read aloud. Whisper runs on this phone and is given the story he's reading, so it hears kids far better than the phone's own listener. In tests with a child-like voice, pauses and background noise it heard 92–95% of the story. One-time download; works without internet after.</p>
    <div class="row wrap-row">
      <button class="btn alt ${!using ? 'on' : ''}" data-listener="phone"><span>PHONE'S LISTENER</span></button>
      ${LISTEN_MODELS.filter(m => Device.has(m)).map(m => `<button class="btn alt ${using === m ? 'on' : ''}" data-listener="${m.id}"><span>${esc(m.name.toUpperCase())}</span></button>`).join('')}
    </div>
    <div class="model-list">${LISTEN_MODELS.map(m => {
      const has = Device.has(m), dl = Device.downloading && Device.downloading.id === m.id;
      return `<div class="model-card ${using === m ? 'on' : ''}" data-lmodel="${m.id}">
        <div class="model-head"><b>${esc(m.name)}</b>${m.id === 'whisper-base' ? '<span class="pill">RECOMMENDED</span>' : ''}${using === m ? '<span class="pill">IN USE ✓</span>' : ''}</div>
        <p>${esc(m.note)}</p>
        <p class="muted">${gb(m.size)} download</p>
        <div class="bar ${dl ? '' : 'hidden'}"><i style="width:0%"></i></div>
        <p class="muted dl-text">${has ? 'Downloaded ✓' : ''}</p>
        <div class="row wrap-row">${has ? `${using !== m ? '<button class="btn" data-luse><span>USE THIS ONE</span></button>' : ''}<button class="btn warn" data-ldel><span>DELETE</span></button>`
          : `<button class="btn" data-ldl ${Device.downloading ? 'disabled' : ''}><span>DOWNLOAD</span></button>`}</div>
      </div>`;
    }).join('')}</div>`;
}

function wireListen(el, rerender) {
  const st = Store.state.settings;
  $$('[data-listener]', el).forEach(b => b.onclick = () => { st.listener = b.dataset.listener; Store.save(); rerender(); toast(st.listener === 'phone' ? "Using the phone's listener" : 'Using Whisper to listen'); });
  $$('[data-lmodel]', el).forEach(card => {
    const m = LISTEN_MODELS.find(x => x.id === card.dataset.lmodel);
    const on = (sel, fn) => { const b = $(sel, card); if (b) b.onclick = fn; };
    on('[data-ldl]', async () => {
      const bar = $('.bar', card), text = $('.dl-text', card);
      bar.classList.remove('hidden');
      $('[data-ldl]', card).outerHTML = '<button class="btn warn" data-lstop><span>STOP DOWNLOAD</span></button>';
      $('[data-lstop]', card).onclick = () => Device.cancel();
      try {
        await Device.download(m, p => { const pct = Math.round(p.loaded / p.total * 100); $('i', bar).style.width = pct + '%'; text.textContent = `Downloading… ${pct}%`; });
        st.listener = m.id; Store.save(); toast(m.name + ' downloaded — using it to listen');
      } catch (e) { toast(e.message + (e.message === 'Download stopped' ? '' : ' — press DOWNLOAD to resume')); }
      rerender();
    });
    on('[data-luse]', () => { st.listener = m.id; Store.save(); rerender(); });
    on('[data-ldel]', async () => {
      if (!confirm('Delete ' + m.name + '? You can download it again later.')) return;
      await Device.remove(m);
      if (st.listener === m.id) st.listener = 'phone';
      Store.save(); rerender();
    });
  });
}

// The cloud story writer: Claude, or an OpenAI-style service (Groq, OpenAI, OpenRouter, Gemini…), with
// the grown-up's own key.
let cloudModelList = [];
function cloudHTML() {
  const c = Cloud.cfg(), claude = c.provider === 'claude';
  const svc = CLOUD_SERVICES.find(x => x.id === c.service) || CLOUD_SERVICES[0];
  return `
    <div class="row wrap-row">
      <button class="btn alt ${claude ? 'on' : ''}" data-provider="claude"><span>CLAUDE</span></button>
      <button class="btn alt ${!claude ? 'on' : ''}" data-provider="openai"><span>GROQ, OPENAI & OTHERS</span></button>
    </div>
    ${claude ? `
      <div class="model-list">${CLOUD_MODELS.map(cm => `<div class="model-card ${c.name === cm.id ? 'on' : ''}">
        <div class="model-head"><b>${esc(cm.name)}</b>${c.name === cm.id ? '<span class="pill">IN USE ✓</span>' : ''}</div>
        <p>${esc(cm.note)}</p>
        ${c.name === cm.id ? '' : `<div class="row wrap-row"><button class="btn" data-cloudmodel="${cm.id}"><span>USE THIS ONE</span></button></div>`}
      </div>`).join('')}</div>
      <p class="muted">Prices are rough guesses for one story with its questions. Get a key at console.anthropic.com.</p>` : `
      <div class="row wrap-row">${CLOUD_SERVICES.map(x => `<button class="btn alt ${svc === x ? 'on' : ''}" data-service="${x.id}"><span>${esc(x.name.toUpperCase())}</span></button>`).join('')}</div>
      ${svc.note ? `<p class="muted">${esc(svc.note)}</p>` : ''}
      ${svc.keys ? `<p class="muted">Get a key at ${esc(svc.keys)}</p>` : ''}
      <div class="form-grid">
        <label>Address${svc.id === 'other' ? ' (like https://api.example.com/v1)' : ''}<input class="input" data-cloudendpoint value="${esc(c.endpoint || svc.endpoint)}" ${svc.id === 'other' ? '' : 'readonly'}></label>
        <label>Model${cloudModelList.length ? '' : ' (press LOAD MODELS after the key)'}
          ${cloudModelList.length ? `<select class="input" data-cloudname>${cloudModelList.map(id => `<option value="${esc(id)}" ${id === c.name ? 'selected' : ''}>${esc(id)}</option>`).join('')}</select>`
            : `<input class="input" data-cloudname value="${esc(c.name)}" placeholder="Loaded from the service">`}</label>
      </div>`}
    <div class="form-grid">
      <label>API key<input class="input" type="password" autocomplete="off" data-cloudkey placeholder="${c.key ? 'Saved — type a new one to change it' : 'Paste the key here'}"></label>
    </div>
    <div class="row wrap-row">${claude ? '' : '<button class="btn alt" data-cloudlist><span>LOAD MODELS</span></button>'}<button class="btn" data-cloudsave><span>SAVE & TEST</span></button>${c.key ? '<button class="btn warn" data-cloudforget><span>REMOVE KEY</span></button>' : ''}</div>
    <p class="muted">The key is kept only on this ${Device.isPC() ? 'computer' : 'device'}. It isn't saved to the 128bit account or in exported data. Each story request (his level, the topic he picked, your story instructions, and his name if you turned that on) goes to the cloud AI. ${Device.ready() ? 'Without internet, the story writer downloaded on this device takes over.' : 'Without internet, the built-in stories are used.'}</p>`;
}

// A good default from a service's model list: a strong general model that can write JSON.
function pickCloudModel(list) {
  const prefs = [/gpt-oss-120b/, /llama-3\.3-70b/, /kimi-k2/, /llama-4-maverick/, /gpt-5-mini/, /gpt-4\.1-mini/, /gpt-4o-mini/, /gemini-[\d.]+-flash$/, /flash/];
  for (const re of prefs) { const m = list.find(id => re.test(id) && !/guard|whisper|tts|embed|audio|vision-preview/i.test(id)); if (m) return m; }
  return list.find(id => !/guard|whisper|tts|embed|audio/i.test(id)) || list[0] || '';
}

function wireCloud(el, rerender) {
  const c = Cloud.cfg();
  const status = msg => { const m = $('[data-mstatus]', el); if (m) m.textContent = msg; };
  // Reads what the grown-up typed into the form.
  const takeForm = () => {
    const key = $('[data-cloudkey]', el) && $('[data-cloudkey]', el).value.trim();
    if (key) c.key = key;
    if (c.provider === 'openai') {
      const svc = CLOUD_SERVICES.find(x => x.id === c.service) || CLOUD_SERVICES[0];
      c.endpoint = svc.id === 'other' ? $('[data-cloudendpoint]', el).value.trim() : svc.endpoint;
      const nm = $('[data-cloudname]', el); if (nm) c.name = nm.value.trim();
    }
    Store.save();
  };
  const loadModels = async () => {
    takeForm();
    if (!c.key) { toast('Paste the API key first'); return false; }
    if (!c.endpoint) { toast('Fill in the address'); return false; }
    status('Getting the list of models…');
    try {
      cloudModelList = await Cloud.models(c);
      if (!cloudModelList.length) throw new Error('The service listed no models');
      if (!cloudModelList.includes(c.name)) c.name = pickCloudModel(cloudModelList);
      Store.save(); rerender();
      status(`✓ ${cloudModelList.length} models found. Using ${c.name} — change it above if you like, then press SAVE & TEST.`);
      return true;
    } catch (e) { status('✗ ' + e.message); return false; }
  };
  $$('[data-provider]', el).forEach(b => b.onclick = () => {
    c.provider = b.dataset.provider; cloudModelList = [];
    c.name = c.provider === 'claude' ? 'claude-opus-5-5' : '';
    if (c.provider === 'openai') c.endpoint = (CLOUD_SERVICES.find(x => x.id === c.service) || CLOUD_SERVICES[0]).endpoint;
    Store.save(); rerender();
  });
  $$('[data-service]', el).forEach(b => b.onclick = () => {
    c.service = b.dataset.service; cloudModelList = []; c.name = '';
    c.endpoint = (CLOUD_SERVICES.find(x => x.id === c.service) || {}).endpoint || '';
    Store.save(); rerender();
  });
  $$('[data-cloudmodel]', el).forEach(b => b.onclick = () => { c.name = b.dataset.cloudmodel; Store.save(); rerender(); toast('Using ' + CLOUD_MODELS.find(x => x.id === c.name).name); });
  if ($('[data-cloudlist]', el)) $('[data-cloudlist]', el).onclick = loadModels;
  if ($('[data-cloudname]', el)) $('[data-cloudname]', el).onchange = () => { takeForm(); toast('Using ' + c.name); };
  const save = $('[data-cloudsave]', el);
  if (save) save.onclick = async () => {
    takeForm();
    if (!c.key) return toast('Paste the API key first');
    if (c.provider === 'openai' && !c.name && !(await loadModels())) return;
    save.disabled = true;
    status('Testing… asking ' + (c.provider === 'claude' ? 'Claude' : c.name) + ' for a tiny answer');
    try {
      await Cloud.test();
      await Model.ping(); rerender();
      status('✓ The cloud AI answered. New stories will be written in seconds.');
      prefetch();
    } catch (e) { status('✗ ' + e.message); save.disabled = false; }
  };
  const forget = $('[data-cloudforget]', el);
  if (forget) forget.onclick = async () => { c.key = ''; cloudModelList = []; Store.save(); await Model.ping(); rerender(); toast('Key removed from this device'); };
}

// If the story writer stopped on this device: when, why, and a report a grown-up can copy and send.
async function showLlmProblem(el, rerender) {
  const box = $('[data-llmproblem]', el);
  if (!box) return;
  const p = await Device.problem();
  if (!p || (!p.crashes && !p.problem)) return;
  const off = p.crashes >= p.max;
  box.innerHTML = `<div class="panel feedback ${off ? 'bad' : 'wait'}">
    <p>${off ? 'The story writer kept stopping on this device, so it is turned off. The app uses the built-in stories (or the Cloud AI, if you set one up).'
      : 'The story writer stopped last time. It now runs in safe mode (a simpler, slower setting) and tries again.'}
      <br><span class="muted">${esc(p.problem)}</span></p>
    <div class="row wrap-row">
      ${off ? '<button class="btn" data-llmretry><span>TRY AGAIN</span></button>' : ''}
      <button class="btn alt" data-llmreport><span>SHOW DETAILS</span></button>
    </div></div>`;
  if ($('[data-llmretry]', box)) $('[data-llmretry]', box).onclick = async () => { await Device.clearProblem(); await Model.ping(); toast('The story writer will try again'); rerender(); };
  $('[data-llmreport]', box).onclick = () => {
    const report = `bitschool ${typeof APP_VERSION !== 'undefined' ? APP_VERSION : ''}\nModel: ${(Device.selected() || {}).name || '-'}\nDevice: ${p.device}\nStopped: ${p.problem}\nCrashes in a row: ${p.crashes}, safe mode: ${p.safe}\n\n${p.log}`;
    const mm = modal(`<h2>Story writer report</h2><p class="muted">Copy this and send it to whoever helps with the app.</p>
      <textarea class="input" rows="12" readonly>${esc(report)}</textarea>
      <div class="row wrap-row center-row"><button class="btn" data-x="copy"><span>COPY</span></button><button class="btn alt" data-x="close"><span>CLOSE</span></button></div>`);
    $('[data-x=close]', mm.el).onclick = mm.close;
    $('[data-x=copy]', mm.el).onclick = async () => {
      const ta = $('textarea', mm.el);
      try { await navigator.clipboard.writeText(report); } catch (e) { ta.select(); document.execCommand('copy'); }
      toast('Copied');
    };
  };
}

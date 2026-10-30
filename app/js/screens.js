const view = () => $('#view');
const go = name => { location.hash = '#/' + name; };

function tile(goTo, ic, label, sub = '', cls = '') {
  return `<button class="tile ${cls}" data-go="${goTo}">${icon(ic)}<b>${esc(label)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</button>`;
}

/* ---------------- Home ---------------- */
function screenHome() {
  const s = Store.state, spec = levelSpec(s.level), due = Store.dueWords().length;
  const name = s.child.name;
  const book = s.placed ? Booklet.get() : null, nextNo = s.placed ? Booklet.next() : 0;
  view().innerHTML = `
    <section class="hero panel">
      <div class="hero-art">${icon('apple', 160, 'bitschool apple')}</div>
      <div class="hero-text">
        <div class="eyebrow">BITSCHOOL READING</div>
        <h1>${name ? 'Hi, ' + esc(name) + '!' : 'Hi, reader!'}</h1>
        ${s.placed ? `
          <div class="level-big" aria-label="Your level">${spec.name}</div>
          <p class="muted">${esc(spec.grade)} · pass mark ${s.settings.passMark}%</p>
          ${bookletHTML(book)}
          <div class="bar" role="progressbar" aria-valuemin="1" aria-valuemax="80" aria-valuenow="${s.level + 1}"><i style="width:${(s.level + 1) / LEVEL_COUNT * 100}%"></i></div>
          <p class="muted">Level ${s.level + 1} of ${LEVEL_COUNT} · A-1 to H-10</p>`
        : '<p class="lead">Start with the placement test. It finds the level that fits — not too easy, not too hard.</p>'}
      </div>
    </section>
    <section class="tiles">
      ${!s.placed ? tile('placement', 'flag', 'PLACEMENT TEST', 'Start here — find your level', 'hot') : ''}
      ${tile('lesson', 'book', "TODAY'S SHEET", s.placed ? `Sheet ${nextNo} of ${book.size} · ${Booklet.kind(nextNo) === 'words' ? 'Word Work' : 'Story'}` : 'Unlocks after placement', s.placed ? 'hot' : 'dim')}
      ${tile('review', 'star', 'WORD REVIEW', due ? due + ' word' + (due > 1 ? 's' : '') + ' to practice' : 'All caught up')}
      ${s.placed ? tile('placement', 'flag', 'RETAKE PLACEMENT', 'Check the level again') : ''}
      ${tile('colors', 'palette', 'COLORS', 'Make it yours')}
      ${tile('parent', 'chart', 'GROWN-UPS', 'Progress & settings')}
    </section>
    <p class="status-line" id="modelStatus">${modelStatus()}</p>`;
}

// The booklet for this level: one square per sheet, filled in when passed.
function bookletHTML(book) {
  if (!book) return '';
  const cells = [];
  for (let n = 1; n <= book.size; n++) {
    const r = book.sheets[n];
    cells.push(`<span class="sheet-cell ${r ? (r.passed ? 'done' : 'redo') : ''}" title="Sheet ${n}: ${Booklet.kind(n) === 'words' ? 'Word Work' : 'Story'}${r ? ' — ' + r.score + '%' : ''}">${n}</span>`);
  }
  return `<div class="booklet" aria-label="Booklet ${levelName(book.level)}: ${Booklet.passedCount()} of ${book.size} sheets passed">
    <span class="booklet-label">BOOKLET ${levelName(book.level)}</span>${cells.join('')}</div>`;
}

function modelStatus() {
  const m = Store.state.settings.model;
  if (m.api === 'device') {
    const dm = Device.selected();
    if (Model.online) return `✓ Story writer ready — ${esc(dm.name)} on this device writes new stories for each level.`;
    return Device.available() ? '○ No story writer downloaded yet — using the built-in stories. Download one in Grown-ups → Settings.'
      : '○ Story writer offline — using the built-in stories.';
  }
  return Model.online ? `✓ Story writer online — ${esc(m.name)} writes new stories for each level.`
    : '○ Story writer offline — using the built-in stories. Grown-ups can connect a local model in Settings.';
}

/* ---------------- Getting a passage ---------------- */
let prefetching = null;
async function getPassage(level, onWait, onProgress, topic) {
  const s = Store.state;
  const matches = p => !topic || p.topic === topic;
  const take = () => { const c = s.cache[level] || [], i = c.findIndex(matches); if (i < 0) return null; const p = c.splice(i, 1)[0]; s.cache[level] = c; Store.save(); return p; };
  // A story being written in the background is often the one we need: wait for it rather than start another.
  if (!(s.cache[level] || []).some(matches) && prefetching) { onWait && onWait(); await prefetching; }
  const cached = take();
  if (cached) return cached;
  if (Model.online) {
    onWait && onWait();
    try { return await Model.writeStory(level, onProgress, topic); }
    catch (e) { toast('The story writer had trouble — using a built-in story'); }
  }
  const b = builtinFor(level, s.usedBuiltins);
  s.usedBuiltins = [...s.usedBuiltins.filter(x => x !== b.id), b.id].slice(-12);
  Store.save();
  return b;
}
// Write the next stories in the background so he does not wait: his last pick for this level, then the next level.
function prefetch() {
  if (prefetching || !Model.online || !Store.state.placed) return prefetching;
  prefetching = (async () => {
    try {
      const st = Store.state, fav = st.storyPicks[0];
      for (const lv of [st.level, Math.min(LEVEL_COUNT - 1, st.level + 1)]) {
        const c = st.cache[lv] || [];
        if (c.some(p => !fav || p.topic === fav)) continue;
        const p = await Model.writeStory(lv, null, fav);
        (st.cache[lv] = st.cache[lv] || []).push(p);
        Store.save();
      }
    } catch (e) {}
    prefetching = null;
  })();
  return prefetching;
}

function loadingHTML(text) {
  return `<div class="loading panel">${icon('apple', 160)}<h2>${esc(text)}</h2><p class="muted">The story writer is making something just for this level.</p><p class="muted" id="writeProgress"></p></div>`;
}

/* ---------------- Placement ---------------- */
const GRADES = [['Pre-K', 0], ['Kindergarten', 1], ['1st grade', 4], ['2nd grade', 6], ['3rd grade', 8], ['4th grade', 10], ['5th grade', 12], ['6th grade +', 14]];

function screenPlacement() {
  const probes = BUILTIN.slice().sort((a, b) => a.level - b.level);
  view().innerHTML = `
    <section class="panel center">
      ${icon('flag', 160)}
      <h1>Placement Test</h1>
      <p class="lead">You'll read a few short stories out loud and answer two questions after each. Some will feel easy and some will feel hard — that is how we find the right level. Just do your best!</p>
      <h2 class="sub-h">What grade is the reader in?</h2>
      <div class="grid-buttons">${GRADES.map(([g, k]) => `<button class="btn alt" data-start="${k}"><span>${g}</span></button>`).join('')}</div>
    </section>`;
  $$('[data-start]', view()).forEach(b => b.onclick = () => run(+b.dataset.start));

  function run(start) {
    let lo = -1, hi = probes.length, gallop = 2, count = 0, idx = start;
    const results = [];
    probe();

    function probe() {
      count++;
      const p = preparePassage({ ...probes[idx], source: 'builtin' });
      view().innerHTML = `
        <section class="panel">
          <div class="task-head"><span class="pill">PLACEMENT · STORY ${count}</span></div>
          <div id="stage"></div>
        </section>`;
      const stage = $('#stage');
      mountReader(stage, p, {
        nextLabel: 'QUESTIONS ▶',
        onDone: read => mountQuestions(stage, p, { mcOnly: true, onDone: answers => {
          const right = answers.filter(a => a.correct).length;
          const pass = right === answers.length && (read.skipped || read.accuracy >= 90);
          results.push({ level: p.level, pass, read, right });
          Store.state.sessions.push({ id: uid(), at: Date.now(), placement: true, level: p.level, title: p.title, source: 'builtin',
            wpm: read.wpm || null, accuracy: read.skipped ? null : read.accuracy, recId: read.recId || null, missed: read.missed, passed: pass, mode: read.mode });
          (read.missed || []).forEach(w => Store.missWord(w));
          Store.save();
          if (pass) lo = idx; else hi = idx;
          let next = null;
          if (hi - lo > 1 && count < 7) {
            if (hi === probes.length) next = Math.min(probes.length - 1, lo + gallop);
            else if (lo === -1) next = Math.max(0, hi - gallop);
            else next = Math.floor((lo + hi) / 2);
            gallop *= 2;
          }
          if (next === null) return finish();
          idx = next;
          view().innerHTML = `
            <section class="panel center">
              ${icon('star', 160)}
              <h1>${pass ? 'Great reading!' : 'Good effort!'}</h1>
              <p class="lead">Next story coming up.</p>
              <button class="btn" data-next><span>NEXT STORY ▶</span></button>
            </section>`;
          $('[data-next]').onclick = probe;
        } }),
      });
    }

    function finish() {
      const s = Store.state;
      const level = lo >= 0 ? probes[lo].level : 0;
      const from = s.level;
      s.level = level; s.placed = true; s.booklet = null;
      s.history.push({ at: Date.now(), from, to: level, why: 'placement' });
      s.placements.push({ at: Date.now(), level, probes: results.map(r => ({ level: r.level, pass: r.pass })) });
      Store.event('placement.done', { level: levelName(level) });
      Store.save();
      view().innerHTML = `
        <section class="panel center">
          ${icon('trophy', 160)}
          <h1>Your level is</h1>
          <div class="level-big">${levelName(level)}</div>
          <p class="lead">${esc(levelSpec(level).grade)} reading. Each level is a booklet of ${s.settings.sheetsPerBooklet} sheets — Word Work and Stories. Pass every sheet with ${s.settings.passMark}% or more to move up one level.</p>
          <div class="result-list">${results.map(r => `<div class="result-row ${r.pass ? 'good' : 'bad'}"><b>${levelName(r.level)}</b><span>${r.right}/2 questions${r.read.skipped ? '' : ' · ' + r.read.accuracy + '% words · ' + r.read.wpm + ' WPM'}</span><span>${r.pass ? 'PASSED' : 'TOO HARD'}</span></div>`).join('')}</div>
          <div class="row wrap-row center-row">
            <button class="btn" data-go="lesson"><span>START READING ▶</span></button>
            <button class="btn alt" data-go="home"><span>HOME</span></button>
          </div>
        </section>`;
      prefetch();
    }
  }
}

/* ---------------- Sheets ---------------- */
// Today's work: the next sheet in this level's booklet.
function screenSheet() {
  const s = Store.state;
  if (!s.placed) { toast('Take the placement test first'); return go('placement'); }
  const n = Booklet.next();
  return Booklet.kind(n) === 'words' ? screenWordWork(n) : screenLesson(n);
}

function sheetHeader(kind, n, level) {
  const b = Booklet.get();
  return `<div class="lesson-meta"><span class="pill">${kind === 'words' ? 'WORD WORK' : 'STORY'} · SHEET ${n} OF ${b.size}</span><span class="pill">LEVEL ${levelName(level)}</span>
    ${b.sheets[n] && !b.sheets[n].passed ? '<span class="muted">Let\'s try this sheet again.</span>' : ''}</div>`;
}

function screenWordWork(n) {
  const s = Store.state, level = s.level;
  view().innerHTML = `<section class="panel">${sheetHeader('words', n, level)}<div id="stage"></div></section>`;
  const stage = $('#stage');
  mountWordWork(stage, level, n, { onDone: results => {
    const score = Math.round(results.reduce((t, r) => t + r.score, 0) / results.length * 100);
    const outcome = Booklet.record(n, 'words', score);
    s.sessions.push({ id: uid(), at: Date.now(), level, kind: 'words', sheet: n, title: 'Word Work · sheet ' + n, score, passed: outcome.passed, skills: results });
    s.sessions = s.sessions.slice(-300);
    Store.event('worksheet.done', { level: levelName(level), sheet: n, kind: 'words', score, passed: outcome.passed });
    Store.save();
    sheetDone(stage, 'words', n, score, outcome, results.map(r => `<div class="result-row ${r.score === 1 ? 'good' : r.score > 0 ? '' : 'bad'}"><b>${esc(r.skill)}</b><span>${r.score === 1 ? '✓' : r.score > 0 ? '½' : '✗'}</span></div>`).join(''));
  } });
}

// The end of any sheet: score, what happens next in the booklet, and the way on.
function sheetDone(stage, kind, n, score, o, detailHTML = '') {
  const s = Store.state;
  const stars = score >= 95 ? 3 : score >= o.mark ? 2 : score >= 60 ? 1 : 0;
  const b = Booklet.get();
  stage.innerHTML = `
    <div class="center">
      ${o.up ? icon('trophy', 160) : ''}
      <h1>${o.up ? 'BOOKLET DONE — LEVEL UP!' : o.passed ? 'Sheet passed!' : 'Nice work — this sheet comes back next time.'}</h1>
      ${o.up ? `<div class="level-big">${levelName(o.from)} → ${levelName(o.to)}</div>` : ''}
      <div class="stars">${[0, 1, 2].map(i => `<span class="${i < stars ? '' : 'off'}">${icon('star')}</span>`).join('')}</div>
      <div class="tiles-row"><div class="stat"><b>${score}%</b><span>SCORE (PASS ${o.mark}%)</span></div>${kind === 'story' ? '' : ''}</div>
      ${detailHTML ? `<div class="result-list">${detailHTML}</div>` : ''}
      ${o.up ? '<p class="lead">You passed every sheet in the booklet. A new booklet starts at the next level.</p>'
        : `<p class="lead">${Booklet.passedCount()} of ${b.size} sheets passed in booklet ${levelName(b.level)}.${o.passed ? '' : ` Score ${o.mark}% or more to pass a sheet — every try makes you stronger!`}</p>`}
      ${o.up ? '' : bookletHTML(b)}
      <div class="row wrap-row center-row">
        <button class="btn" data-again><span>NEXT SHEET ▶</span></button>
        <button class="btn alt" data-go="home"><span>HOME</span></button>
      </div>
    </div>`;
  if (o.up || o.passed) Speech.say(o.up ? 'You finished the booklet! Level up!' : 'Sheet passed! Great job!');
  $('[data-again]', stage).onclick = () => screenSheet();
  updateTop();
  prefetch();
}

/* ---------------- Story sheets ---------------- */
const STEPS = [['warmup', 'WORDS'], ['read', 'READ'], ['questions', 'QUESTIONS'], ['circle', 'CIRCLE'], ['blank', 'BLANK'], ['order', 'ORDER'], ['done', 'DONE']];

function screenLesson(n) {
  const s = Store.state;
  if (!s.placed) { toast('Take the placement test first'); return go('placement'); }
  if (!n) n = Booklet.next();
  // With a story writer he picks what the story is about; the built-in stories are fixed.
  if (Model.online) storyPicker(n, topic => runStory(n, topic));
  else runStory(n, null);
}

function storyPicker(n, onPick) {
  const s = Store.state, st = s.settings, level = s.level;
  const ready = topic => (s.cache[level] || []).some(p => p.topic === topic);
  const choices = [
    ...st.storyIdeas.map(idea => ({ topic: idea, name: idea.toUpperCase(), icon: 'star' })),
    ...STORY_THEMES,
  ];
  view().innerHTML = `
    <section class="panel">
      ${sheetHeader('story', n, level)}
      <h1>Pick your story!</h1>
      <p class="muted">The story writer makes a new story about what you pick.</p>
      <div class="tiles">
        ${choices.map((c, k) => `<button class="tile ${ready(c.topic) ? 'hot' : ''}" data-pick="${k}">${icon(c.icon)}<b>${esc(c.name)}</b><span>${ready(c.topic) ? 'Ready now!' : 'Takes a minute to write'}</span></button>`).join('')}
        ${st.ownIdeas ? `<button class="tile" data-own>${icon('palette')}<b>MY OWN IDEA</b><span>Type or say it</span></button>` : ''}
        <button class="tile" data-surprise>${icon('book')}<b>SURPRISE ME</b><span>${(s.cache[level] || []).length ? 'Ready now!' : 'Any story'}</span></button>
      </div>
    </section>`;
  const pick = topic => {
    if (topic) { s.storyPicks = [topic, ...s.storyPicks.filter(t => t !== topic)].slice(0, 10); Store.save(); }
    onPick(topic);
  };
  $$('[data-pick]').forEach(b => b.onclick = () => pick(choices[+b.dataset.pick].topic));
  $('[data-surprise]').onclick = () => pick(null);
  if ($('[data-own]')) $('[data-own]').onclick = () => {
    const m = modal(`
      <h2>What should your story be about?</h2>
      <input class="input" maxlength="60" placeholder="Like: a dragon who loves pizza" aria-label="Your story idea">
      <div class="row wrap-row center-row">
        ${Speech.canListen ? `<button class="btn alt" data-x="say">${icon('mic')}<span>SAY IT</span></button>` : ''}
        <button class="btn" data-x="go"><span>WRITE MY STORY ▶</span></button>
        <button class="btn alt" data-x="close"><span>BACK</span></button>
      </div>`);
    const inp = $('input', m.el);
    inp.focus();
    const goOwn = () => { const t = inp.value.trim(); if (!t) return toast('Type an idea first'); m.close(); pick(t); };
    $('[data-x=go]', m.el).onclick = goOwn;
    inp.addEventListener('keydown', e => e.key === 'Enter' && goOwn());
    $('[data-x=close]', m.el).onclick = m.close;
    if ($('[data-x=say]', m.el)) $('[data-x=say]', m.el).onclick = async () => {
      toast('Listening… say your idea');
      try { const said = await Speech.listenOnce(); if (said) inp.value = said; } catch (e) { toast('Could not listen: ' + e.message); }
    };
  };
}

async function runStory(n, topic) {
  const s = Store.state;
  const level = s.level;
  view().innerHTML = loadingHTML('Getting your story ready…');
  const raw = await getPassage(level, () => { view().innerHTML = loadingHTML('Writing a new ' + levelName(level) + ' story' + (topic ? ' about ' + topic : '') + '…'); },
    n => { const el = $('#writeProgress'); if (el) el.textContent = 'About ' + Math.min(99, Math.round(n / (levelSpec(level).words * 1.4 + 250) * 100)) + '% written'; }, topic);
  if (!location.hash.includes('lesson')) return; // left while waiting
  const p = preparePassage(raw);
  const due = Store.dueWords(5);
  const steps = STEPS.map(x => x[0]).filter(k => (k !== 'warmup' || due.length) && (k !== 'blank' || p.blank) && (k !== 'order' || p.order));
  const res = { read: null, questions: [], circle: null, blank: null, order: null };
  let at = 0;

  view().innerHTML = `
    <section class="panel">
      <div class="pips">${steps.map(k => `<span class="pip" data-step="${k}">${STEPS.find(x => x[0] === k)[1]}</span>`).join('')}</div>
      ${sheetHeader('story', n, level)}
      <p class="muted">${p.source === 'model' ? 'A new story written for this level' : 'Built-in story'}</p>
      <div id="stage"></div>
    </section>`;
  const stage = $('#stage');
  step();

  function step() {
    const k = steps[at];
    $$('.pip').forEach((x, i) => { x.classList.toggle('on', i === at); x.classList.toggle('past', i < at); });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const nextStep = () => { at++; step(); };
    if (k === 'warmup') mountReviewCards(stage, due, { title: 'Warm-up words', onDone: nextStep });
    if (k === 'read') mountReader(stage, p, { onDone: r => { res.read = r; nextStep(); } });
    if (k === 'questions') mountQuestions(stage, p, { onDone: r => { res.questions = r; nextStep(); } });
    if (k === 'circle') mountCircle(stage, p, { onDone: r => { res.circle = r.correct; nextStep(); } });
    if (k === 'blank') mountBlank(stage, p, { onDone: r => { res.blank = r.correct; nextStep(); } });
    if (k === 'order') mountOrder(stage, p, { onDone: r => { res.order = r.correct; nextStep(); } });
    if (k === 'done') done();
  }

  function done() {
    const items = [...res.questions.map(q => q.correct), res.circle, res.blank, res.order].filter(v => v === true || v === false);
    const taskPct = items.length ? Math.round(items.filter(Boolean).length / items.length * 100) : 0;
    const read = res.read && !res.read.skipped ? res.read : null;
    const score = Math.round(read ? 0.4 * read.accuracy + 0.6 * taskPct : taskPct);
    const outcome = Booklet.record(n, 'story', score), passed = outcome.passed, from = level;
    (read ? read.missed : []).forEach(w => Store.missWord(w));
    const session = {
      id: uid(), at: Date.now(), level: from, title: p.title, passageId: p.id, source: p.source, topic: p.topic || '',
      kind: 'story', sheet: n, text: p.text, wpm: read ? read.wpm : null, accuracy: read ? read.accuracy : null, seconds: read ? read.seconds : null,
      mode: read ? read.mode : 'skipped', recId: read ? read.recId : null, missed: read ? read.missed : [],
      taskPct, score, passed, questions: res.questions, circle: res.circle, blank: res.blank, order: res.order,
    };
    s.sessions.push(session);
    s.sessions = s.sessions.slice(-300);
    Store.event('reading.session', { level: levelName(from), score, wpm: session.wpm, accuracy: session.accuracy, passed });
    Store.save();
    sheetDone(stage, 'story', n, score, outcome, (read ? `<div class="result-row"><b>Reading</b><span>${read.accuracy}% of words · ${read.wpm} words a minute</span></div>` : '')
      + `<div class="result-row"><b>Questions & tasks</b><span>${taskPct}%</span></div>`);
  }
}

/* ---------------- Word review ---------------- */
function mountReviewCards(el, list, { title = 'Word Review', onDone }) {
  let i = 0, right = 0;
  card();
  function card() {
    if (i >= list.length) {
      el.innerHTML = `<div class="center">${icon('star', 160)}<h1>${right} of ${list.length} words read!</h1>
        <p class="lead">Words you know move further apart. Tricky ones come back next time.</p>
        <button class="btn" data-fin><span>${title === 'Warm-up words' ? 'ON TO THE STORY ▶' : 'DONE'}</span></button></div>`;
      $('[data-fin]', el).onclick = onDone;
      return;
    }
    const w = list[i];
    const learned = '★'.repeat(w.box) + '☆'.repeat(Math.max(0, REVIEW_DAYS.length - w.box));
    el.innerHTML = `
      <div class="task-head"><span class="pill">${esc(title.toUpperCase())} · ${i + 1} OF ${list.length}</span>${title === 'Warm-up words' ? '<button class="btn alt" data-skip><span>SKIP WARM-UP</span></button>' : ''}</div>
      <div class="word-card">
        <div class="big-word">${esc(w.word)}</div>
        <p class="muted" aria-label="Progress">${learned}</p>
        <p class="meaning">${w.meaning ? esc(w.meaning) : ''}</p>
      </div>
      <div class="row wrap-row center-row">
        <button class="btn alt" data-hear>${icon('speaker')}<span>HEAR IT</span></button>
        ${Speech.canListen ? `<button class="btn alt" data-say>${icon('mic')}<span>SAY IT</span></button>` : ''}
        <button class="btn" data-ok><span>I READ IT ✓</span></button>
        <button class="btn warn" data-no><span>TRICKY ✗</span></button>
      </div>
      <div class="fb"></div>`;
    const answer = ok => { Store.reviewWord(w.k, ok); if (ok) right++; i++; card(); };
    $('[data-hear]', el).onclick = () => Speech.say(w.word, { rate: 0.7 });
    $('[data-ok]', el).onclick = () => answer(true);
    $('[data-no]', el).onclick = () => { Speech.say(w.word, { rate: 0.7 }); answer(false); };
    if ($('[data-skip]', el)) $('[data-skip]', el).onclick = onDone;
    if ($('[data-say]', el)) $('[data-say]', el).onclick = async () => {
      const fb = $('.fb', el);
      fb.innerHTML = '<div class="feedback wait"><p>Listening…</p></div>';
      try {
        const said = await Speech.listenOnce(6000);
        const ok = words(said).some(x => sameWord(speechNorm(x), speechNorm(w.word)));
        fb.innerHTML = `<div class="feedback ${ok ? 'good' : 'bad'}"><p>${ok ? 'Yes! You said it.' : said ? 'I heard “' + esc(said) + '”. Listen and try again.' : 'I did not hear you. Try again.'}</p></div>`;
        if (ok) setTimeout(() => answer(true), 900); else Speech.say(w.word, { rate: 0.7 });
      } catch (e) { fb.innerHTML = `<div class="feedback bad"><p>Could not listen (${esc(e.message)}).</p></div>`; }
    };
  }
}

function screenReview() {
  let list = Store.dueWords(10);
  const all = Object.entries(Store.state.words).map(([k, w]) => ({ k, ...w }));
  view().innerHTML = `<section class="panel"><div id="stage"></div></section>`;
  const stage = $('#stage');
  if (!list.length) {
    stage.innerHTML = `<div class="center">${icon('star', 160)}<h1>All caught up!</h1>
      <p class="lead">${all.length ? 'No words are due right now. Practice anyway?' : 'Words you miss or tap while reading will show up here.'}</p>
      <div class="row wrap-row center-row">
        ${all.length ? '<button class="btn" data-any><span>PRACTICE ANYWAY</span></button>' : ''}
        <button class="btn alt" data-go="home"><span>HOME</span></button>
      </div></div>`;
    if ($('[data-any]', stage)) $('[data-any]', stage).onclick = () => mountReviewCards(stage, shuffle(all).slice(0, 8), { onDone: () => go('home') });
    return;
  }
  mountReviewCards(stage, list, { onDone: () => go('home') });
}

/* ---------------- Colors ---------------- */
function screenColors() {
  const st = Store.state.settings;
  const fields = [['bg', 'Background'], ['panel', 'Panels'], ['accent', 'Buttons'], ['accent2', 'Highlights'], ['ink', 'Text'], ['apple', 'Apple']];
  view().innerHTML = `
    <section class="panel">
      <h1>${icon('palette')} Colors</h1>
      <h2 class="sub-h">Pick a theme</h2>
      <div class="swatches">${Object.entries(THEMES).map(([k, t]) => `
        <button class="swatch ${st.themeName === k ? 'on' : ''}" data-theme="${k}" style="background:${t.bg};color:${t.ink};border-color:${t.accent}">
          <span class="sw-dots"><i style="background:${t.accent}"></i><i style="background:${t.accent2}"></i><i style="background:${t.apple}"></i></span>
          <b>${esc(t.name)}</b></button>`).join('')}</div>
      <h2 class="sub-h">Or mix your own</h2>
      <div class="pickers">${fields.map(([k, label]) => `
        <label class="picker"><input type="color" data-color="${k}" value="${st.theme[k]}"><span>${label}</span></label>`).join('')}</div>
      <h2 class="sub-h">Story text size</h2>
      <div class="row wrap-row">
        <button class="btn alt" data-size="-2"><span>A −</span></button>
        <div class="stat"><b>${st.readSize}px</b><span>TEXT SIZE</span></div>
        <button class="btn alt" data-size="2"><span>A +</span></button>
      </div>
      <div class="story small preview"><p><span class="w read">The</span> <span class="w read">red</span> <span class="w stumble">apple</span> <span class="w">fell</span> <span class="w skipped">down.</span></p></div>
      <div class="row wrap-row">
        <button class="btn" data-go="home"><span>DONE ✓</span></button>
        <button class="btn alt" data-reset><span>RESET COLORS</span></button>
      </div>
    </section>`;
  const save = () => { applyTheme(); Store.save(); };
  $$('[data-theme]').forEach(b => b.onclick = () => { st.theme = { ...THEMES[b.dataset.theme] }; st.themeName = b.dataset.theme; save(); screenColors(); });
  $$('[data-color]').forEach(inp => inp.oninput = () => { st.theme[inp.dataset.color] = inp.value; st.themeName = 'custom'; save(); $$('.swatch').forEach(x => x.classList.remove('on')); });
  $$('[data-size]').forEach(b => b.onclick = () => { st.readSize = Math.max(20, Math.min(56, st.readSize + +b.dataset.size)); save(); screenColors(); });
  $('[data-reset]').onclick = () => { st.theme = { ...THEMES.chalkboard }; st.themeName = 'chalkboard'; st.readSize = 30; save(); screenColors(); };
}

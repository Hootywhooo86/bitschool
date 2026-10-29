// Kumon-style booklets: each level is a booklet of numbered sheets that alternate Word Work
// (standalone exercises from the curated word bank) and Story sheets (a reading lesson).
// A sheet below the pass mark is done again; passing every sheet moves the reader up a level.

const pick = a => a[Math.floor(Math.random() * a.length)];
const sample = (a, n) => shuffle(a).slice(0, n);
const NEUTRAL = ['table', 'pencil', 'river', 'window', 'basket', 'ladder', 'button', 'carpet'];
const POS_NAME = { n: 'a noun (a person, place or thing)', v: 'a verb (an action word)', adj: 'an adjective (a describing word)', adv: 'an adverb (tells how)' };
// Words that are commonly more than one kind of word ("plant" is a noun and a verb), so a
// "which word is a verb?" question could have two right answers. They stay out of those questions.
const DUAL_POS = new Set(('dream rain smile harvest whisper tumble shelter scratch jump stop clap plant drum dig hop run nest duck ship map cup bus ' +
  'float garden results journey weather steer drifting route debate discount cluster volunteer wet red fast quiet hot sit melt bake web fox ' +
  'folded painted crowded gather recover appear compare transformed assumed countered').split(' '));
const band = level => Math.floor(level / 10);
const pairs = list => list.map(x => x.split(' '));
const near = (level, lo, hi) => { const b = band(level); return b >= lo && b <= hi; };
// Words from this band and the one before, so sheets mix new and review words.
const wordsFor = level => bankWords(band(level)).concat(band(level) > 0 ? bankWords(band(level) - 1) : []);

// Each generator returns one exercise, or null if it can't make a good one here.
const GENERATORS = {
  firstSound: { bands: [0, 1], make(level) {
    const pool = bankWords(0).concat(bankWords(1)).map(w => w.w).filter(w => /^[bcdfghjklmnprstvwz][aeiou]/.test(w));
    const t = pick(pool), same = shuffle(pool.filter(w => w !== t && w[0] === t[0]))[0];
    if (!same) return null;
    const others = sample(pool.filter(w => w[0] !== t[0]), 2);
    return choice('Sounds', `Which word starts with the same sound as “${t}”?`, t, same, others);
  } },
  rhyme: { bands: [0, 2], make() {
    const fams = WORD_FAMILIES.map(f => f.split(' '));
    const fam = pick(fams), [t, r] = sample(fam, 2);
    const others = sample(fams.filter(f => f !== fam).flat(), 2);
    return choice('Rhymes', `Which word rhymes with “${t}”?`, t, r, others);
  } },
  missingLetter: { bands: [0, 2], make(level) {
    const w = pick(wordsFor(level).filter(x => /^[a-z]{3,5}$/.test(x.w) && /[aeiou]/.test(x.w.slice(1))));
    if (!w) return null;
    const i = w.w.slice(1).search(/[aeiou]/) + 1;
    const right = w.w[i], wrong = sample('aeiou'.split('').filter(v => v !== right), 2);
    const ex = choice('Spelling', `${w.def[0].toUpperCase() + w.def.slice(1)}:  ${w.w.slice(0, i)} _ ${w.w.slice(i + 1)}`, w.def, right, wrong);
    ex.say = w.def; ex.word = w.w; ex.explain = `The word is “${w.w}”.`;
    return ex;
  } },
  dictation: { bands: [0, 7], make(level) {
    const ws = bankWords(band(level)).filter(x => band(level) > 0 || x.w.length <= 4);
    const w = pick(ws);
    return { type: 'type', skill: 'Hear it, spell it', prompt: 'Listen, then type the word you hear.', say: `${w.w}. ${w.ex} ${w.w}.`, answer: w.w, word: w.w, sayFirst: true };
  } },
  wordMeaning: { bands: [0, 7], make(level) {
    const ws = sample(bankWords(band(level)), 3), w = ws[0];
    if (band(level) < 3) return choice('Word meaning', `Which word means “${w.def}”?`, w.def, w.w, ws.slice(1).map(x => x.w));
    return choice('Word meaning', `What does “${w.w}” mean?`, w.w, w.def, ws.slice(1).map(x => x.def));
  } },
  contextClue: { bands: [4, 7], make(level) {
    const ws = sample(bankWords(band(level)), 3), w = ws[0];
    const ex = choice('Context clues', `Read: “${w.ex}” What does “${w.w}” mean here?`, w.ex, w.def, ws.slice(1).map(x => x.def));
    ex.highlight = w.w;
    return ex;
  } },
  matchWords: { bands: [0, 7], make(level) {
    const ws = sample(bankWords(band(level)), band(level) < 2 ? 3 : 4);
    return { type: 'match', skill: 'Match words', prompt: 'Match each word to what it means. Tap a word, then its meaning.', pairs: ws.map(w => [w.w, w.def]) };
  } },
  buildSentence: { bands: [0, 5], make(level) {
    const s = pick(bankSentences(band(level)).filter(x => words(x.s).length >= 3 && words(x.s).length <= 9));
    return { type: 'build', skill: 'Build a sentence', prompt: 'Tap the words in order to build the sentence.', say: s.s, tiles: words(s.s) };
  } },
  punctuation: { bands: [1, 4], make(level) {
    const s = pick(bankSentences(band(level)));
    const marks = [['.', 'period  .'], ['?', 'question mark  ?'], ['!', 'exclamation mark  !']];
    const ex = { type: 'choice', skill: 'Punctuation', prompt: `Which mark ends this sentence?  “${s.s.slice(0, -1)} __”`, say: s.s,
      options: marks.map(m => m[1]), answer: marks.findIndex(m => m[0] === s.mark) };
    ex.explain = s.mark === '?' ? 'It asks something, so it ends with a question mark.' : s.mark === '!' ? 'It shows strong feeling, so it ends with an exclamation mark.' : 'It tells something, so it ends with a period.';
    return ex;
  } },
  capitals: { bands: [1, 3], make(level) {
    const s = pick(bankSentences(band(level))).s, ws = words(s);
    const lowerFirst = ws[0][0].toLowerCase() + ws[0].slice(1) + ' ' + ws.slice(1).join(' ');
    const name = ws.slice(1).findIndex(w => /^[A-Z]/.test(w)) + 1;
    const wrong2 = name > 0 ? ws.map((w, i) => i === name ? w[0].toLowerCase() + w.slice(1) : w).join(' ')
      : ws.map((w, i) => i === ws.length - 1 ? w[0].toUpperCase() + w.slice(1) : w).join(' ');
    if (lowerFirst === s || wrong2 === s) return null;
    const ex = choice('Capital letters', 'Which sentence is written correctly?', s, s, [lowerFirst, wrong2]);
    ex.explain = 'A sentence starts with a capital letter, and names always have one.';
    return ex;
  } },
  partOfSpeech: { bands: [2, 5], make(level) {
    const ws = bankWords(band(level)).filter(w => w.pos !== 'adv' && !DUAL_POS.has(w.w));
    const pos = pick(['n', 'v', 'adj']);
    const t = pick(ws.filter(w => w.pos === pos)), others = sample(ws.filter(w => w.pos !== pos), 2);
    if (!t || others.length < 2) return null;
    const ex = choice('Kinds of words', `Which word is ${POS_NAME[pos]}?`, pos, t.w, others.map(w => w.w));
    ex.explain = `“${t.w}” is ${POS_NAME[pos]}: ${t.ex}`;
    return ex;
  } },
  plurals: { bands: [2, 3], make() {
    const [one, many] = pick(pairs(PLURALS));
    const wrong = [...new Set([one + 's', one + 'es', one.replace(/y$/, 'ys'), one.replace(/f$/, 'fs'), many + 's'])].filter(x => x !== many && x !== one);
    return choice('Plurals', `One ${one}, two ____.`, one, many, sample(wrong, 2));
  } },
  pastTense: { bands: [2, 4], make() {
    const [now, past] = pick(pairs(PAST));
    const wrong = [...new Set([now + 'ed', now + 'ing', now + 's', now.replace(/e$/, '') + 'ed'])].filter(x => x !== past);
    return choice('Past tense', `Today I ${now}. Yesterday I ____.`, now, past, sample(wrong, 2));
  } },
  synonyms: { bands: [3, 7], make() {
    const [a, b] = sample(pick(pairs(SYNONYMS)), 2);
    const opposite = pairs(ANTONYMS).find(p => p.includes(a));
    const wrong = [opposite ? opposite.find(x => x !== a) : pick(NEUTRAL), pick(NEUTRAL)];
    return choice('Same meaning', `Which word means the same as “${a}”?`, a, b, [...new Set(wrong)].length < 2 ? sample(NEUTRAL, 2) : wrong);
  } },
  antonyms: { bands: [3, 7], make() {
    const [a, b] = sample(pick(pairs(ANTONYMS)), 2);
    const same = pairs(SYNONYMS).find(p => p.includes(a));
    const wrong = [same ? same.find(x => x !== a) : pick(NEUTRAL), pick(NEUTRAL)];
    return choice('Opposites', `Which word means the opposite of “${a}”?`, a, b, [...new Set(wrong)].length < 2 ? sample(NEUTRAL, 2) : wrong);
  } },
  compound: { bands: [3, 4], make() {
    const [a, b, c] = pick(pairs(COMPOUNDS));
    if (Math.random() < 0.5) return { type: 'type', skill: 'Compound words', prompt: `Put the two words together:  ${a} + ${b} = ?`, answer: c, say: `${a}, ${b}` };
    const splits = [`${a} + ${b}`, `${c.slice(0, a.length - 1)} + ${c.slice(a.length - 1)}`, `${c.slice(0, a.length + 1)} + ${c.slice(a.length + 1)}`];
    return choice('Compound words', `Which two words make “${c}”?`, c, splits[0], splits.slice(1));
  } },
  contractions: { bands: [3, 5], make() {
    const [long, short] = pick(CONTRACTIONS).split('|');
    const i = short.indexOf("'");
    const wrong = [short.replace("'", ''), short.slice(0, i - 1) + "'" + short.slice(i - 1).replace("'", '')].filter(x => x !== short);
    return choice('Contractions', `Which is the short way to write “${long}”?`, long, short, [...new Set(wrong)]);
  } },
  affixes: { bands: [5, 7], make() {
    const all = AFFIXES.map(a => a.split('|'));
    const [x, y, meaning] = pick(all);
    const word = x + y;
    const others = sample(all.filter(a => a[2] !== meaning), 2).map(a => a[2]);
    return choice('Prefixes and suffixes', `What does “${word}” mean?`, word, meaning, others);
  } },
  factOpinion: { bands: [5, 7], make() {
    const [s, kind] = pick(FACT_OPINION).split('|');
    const ex = { type: 'choice', skill: 'Fact or opinion', prompt: `“${s}” Is this a fact or an opinion?`, say: s, options: ['Fact', 'Opinion'], answer: kind === 'fact' ? 0 : 1 };
    ex.explain = kind === 'fact' ? 'A fact can be checked and proven true.' : 'An opinion is what someone thinks or feels.';
    return ex;
  } },
  figurative: { bands: [6, 7], make() {
    const [s, kind] = pick(FIGURATIVE).split('|');
    const ex = { type: 'choice', skill: 'Figurative language', prompt: `“${s}” Is this a simile, a metaphor, or neither?`, say: s, options: ['Simile', 'Metaphor', 'Neither'], answer: ['simile', 'metaphor', 'neither'].indexOf(kind) };
    ex.explain = 'A simile compares with “like” or “as”. A metaphor says one thing is another.';
    return ex;
  } },
  writeSentence: { bands: [2, 7], make(level) {
    const w = pick(bankWords(band(level)));
    return { type: 'write', skill: 'Write a sentence', prompt: `Write your own sentence using the word “${w.w}”.`, say: `Write a sentence using the word ${w.w}.`, word: w.w, minWords: band(level) < 4 ? 4 : 6, hint: w.ex };
  } },
};

// A multiple-choice exercise with the right answer mixed in.
function choice(skill, prompt, say, right, wrong) {
  const options = shuffle([right, ...wrong.filter(w => w !== right).slice(0, 2)]);
  return { type: 'choice', skill, prompt, say: say === undefined ? prompt : say, options, answer: options.indexOf(right) };
}

// Six exercises, each from a different skill that suits this level.
function makeWordWork(level, count = 6) {
  const fits = Object.entries(GENERATORS).filter(([, g]) => near(level, g.bands[0], g.bands[1]));
  const out = [];
  for (const [id, g] of shuffle(fits)) {
    if (out.length >= count) break;
    for (let tries = 0; tries < 4; tries++) {
      const ex = g.make(level);
      if (ex && (ex.type !== 'choice' || (ex.options.length >= 2 && new Set(ex.options).size === ex.options.length && ex.answer >= 0))) { out.push({ id, ...ex }); break; }
    }
  }
  // Spelling and sentence-building early, writing last, so a sheet ramps up.
  const order = ['firstSound', 'rhyme', 'missingLetter', 'wordMeaning', 'matchWords', 'dictation', 'punctuation', 'capitals', 'partOfSpeech',
    'plurals', 'pastTense', 'synonyms', 'antonyms', 'compound', 'contractions', 'contextClue', 'affixes', 'factOpinion', 'figurative', 'buildSentence', 'writeSentence'];
  return out.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}

/* ---------------- Booklets ---------------- */
const Booklet = {
  get() {
    const s = Store.state;
    if (!s.booklet || s.booklet.level !== s.level) s.booklet = { level: s.level, sheets: {} };
    s.booklet.size = s.settings.sheetsPerBooklet;
    return s.booklet;
  },
  kind(n) { return n % 2 === 1 ? 'words' : 'story'; },
  // The first sheet not yet passed: a sheet below the mark comes back until it's passed.
  next() {
    const b = this.get();
    for (let n = 1; n <= b.size; n++) if (!(b.sheets[n] && b.sheets[n].passed)) return n;
    return 1;
  },
  passedCount() { const b = this.get(); let k = 0; for (let n = 1; n <= b.size; n++) if (b.sheets[n] && b.sheets[n].passed) k++; return k; },
  // Records a finished sheet; moves up a level when the whole booklet is passed.
  record(n, kind, score) {
    const s = Store.state, b = this.get(), mark = s.settings.passMark;
    const prev = b.sheets[n] || { tries: 0 };
    const passed = score >= mark;
    b.sheets[n] = { kind, score: Math.max(score, prev.passed ? prev.score : 0), passed: passed || !!prev.passed, tries: prev.tries + 1, at: Date.now() };
    const from = s.level;
    let up = false;
    if (this.passedCount() >= b.size && s.level < LEVEL_COUNT - 1) {
      s.level++; up = true;
      s.history.push({ at: Date.now(), from, to: s.level, why: `booklet ${levelName(from)} passed` });
      Store.event('level.up', { from: levelName(from), to: levelName(s.level) });
      s.booklet = null;
    }
    return { passed, up, from, to: s.level, mark };
  },
};

/* ---------------- Exercise screens ---------------- */
function mountWordWork(el, level, sheetNo, { onDone }) {
  const list = makeWordWork(level);
  const results = [];
  let i = 0;
  show();

  function show() {
    if (i >= list.length) return onDone(results);
    const ex = list[i];
    el.innerHTML = `
      <div class="task-head"><span class="pill">${esc(ex.skill.toUpperCase())} · ${i + 1} OF ${list.length}</span></div>
      <div class="q-row">${ex.say ? speakBtn(ex.say) : ''}<h2 class="q">${promptHTML(ex)}</h2></div>
      <div class="ex-body"></div><div class="fb"></div>`;
    wireSay(el);
    if (ex.sayFirst) Speech.say(ex.say, { rate: 0.75 });
    ({ choice: exChoice, type: exType, match: exMatch, build: exBuild, write: exWrite })[ex.type]($('.ex-body', el), ex, done);
  }
  function promptHTML(ex) {
    let h = esc(ex.prompt);
    if (ex.highlight) h = h.replace(new RegExp('\\b' + ex.highlight + '\\b'), m => `<mark>${m}</mark>`);
    return h;
  }
  // score: 1 right first time, 0.5 right on the second try, 0 otherwise.
  function done(score, text) {
    const ex = list[i];
    results.push({ skill: ex.skill, id: ex.id, score });
    if (score < 1 && ex.word) Store.missWord(ex.word);
    const fb = $('.fb', el);
    fb.innerHTML = `<div class="feedback ${score === 1 ? 'good' : score > 0 ? 'wait' : 'bad'}"><p>${esc(text)}</p><button class="btn" data-next><span>NEXT ▶</span></button></div>`;
    Speech.say(score === 1 ? 'Great job!' : score > 0 ? 'Good fixing!' : 'Let\'s learn this one.');
    fb.scrollIntoView({ block: 'center', behavior: 'smooth' });
    $('[data-next]', fb).onclick = () => { i++; show(); };
  }
}

function exChoice(body, ex, done) {
  body.innerHTML = `<div class="choices">${ex.options.map((o, k) => `<button class="btn choice" data-k="${k}"><span>${esc(o)}</span></button>`).join('')}</div>`;
  $$('[data-k]', body).forEach(b => b.onclick = () => {
    const k = +b.dataset.k, ok = k === ex.answer;
    $$('[data-k]', body).forEach(x => { x.disabled = true; if (+x.dataset.k === ex.answer) x.classList.add('right'); });
    if (!ok) b.classList.add('wrong');
    done(ok ? 1 : 0, (ok ? 'Yes! ' : 'The answer is: ' + ex.options[ex.answer] + '. ') + (ex.explain || ''));
  });
}

function exType(body, ex, done) {
  let tries = 0;
  body.innerHTML = `<input class="input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Your answer">
    <div class="row wrap-row">${ex.say ? `<button class="btn alt" data-again>${icon('speaker')}<span>HEAR IT AGAIN</span></button>` : ''}<button class="btn" data-check><span>CHECK</span></button></div>
    <p class="hint muted"></p>`;
  const input = $('input', body);
  if ($('[data-again]', body)) $('[data-again]', body).onclick = () => Speech.say(ex.say, { rate: 0.75 });
  const check = () => {
    if (!norm(input.value)) return toast('Type your answer first');
    const ok = norm(input.value) === norm(ex.answer);
    tries++;
    if (ok || tries >= 2) {
      input.disabled = true; $('[data-check]', body).disabled = true;
      done(ok ? (tries === 1 ? 1 : 0.5) : 0, ok ? `Yes! “${ex.answer}”.` : `It is spelled “${ex.answer}”. It goes on your practice list.`);
    } else $('.hint', body).textContent = `Not quite. Hint: it starts with “${ex.answer.slice(0, ex.answer.length > 5 ? 2 : 1)}”. Try again.`;
  };
  $('[data-check]', body).onclick = check;
  input.addEventListener('keydown', e => e.key === 'Enter' && check());
}

function exMatch(body, ex, done) {
  const left = shuffle(ex.pairs.map(p => p[0])), right = shuffle(ex.pairs.map(p => p[1]));
  let picked = null, mistakes = 0, matched = 0;
  body.innerHTML = `<div class="match-grid"><div class="match-col">${left.map(w => `<button class="btn alt" data-l="${esc(w)}"><span>${esc(w)}</span></button>`).join('')}</div>
    <div class="match-col">${right.map(d => `<button class="btn alt match-def" data-r="${esc(d)}"><span>${esc(d)}</span></button>`).join('')}</div></div>`;
  $$('[data-l]', body).forEach(b => b.onclick = () => { $$('[data-l]', body).forEach(x => x.classList.remove('on')); b.classList.add('on'); picked = b; Speech.say(b.dataset.l, { rate: 0.8 }); });
  $$('[data-r]', body).forEach(b => b.onclick = () => {
    if (!picked) return toast('Tap a word first');
    const ok = ex.pairs.some(p => p[0] === picked.dataset.l && p[1] === b.dataset.r);
    if (ok) {
      [picked, b].forEach(x => { x.disabled = true; x.classList.remove('on'); x.classList.add('right'); });
      picked = null; matched++;
      if (matched === ex.pairs.length) done(mistakes === 0 ? 1 : mistakes === 1 ? 0.5 : 0, mistakes ? `All matched, with ${mistakes} mix-up${mistakes > 1 ? 's' : ''}.` : 'All matched — no mix-ups!');
    } else { mistakes++; b.classList.add('wrong'); setTimeout(() => b.classList.remove('wrong'), 600); }
  });
}

function exBuild(body, ex, done) {
  let tries = 0;
  const tiles = shuffle(ex.tiles.map((t, k) => ({ t, k })));
  while (tiles.length > 1 && tiles.every((x, k) => x.k === k)) tiles.reverse();
  body.innerHTML = `<div class="build-line" aria-label="Your sentence"></div><div class="build-tiles"></div>
    <div class="row wrap-row"><button class="btn alt" data-clear><span>START OVER</span></button><button class="btn" data-check><span>CHECK</span></button></div>`;
  const line = $('.build-line', body), pool = $('.build-tiles', body);
  const render = placed => {
    line.innerHTML = placed.map(x => `<button class="btn wtile" data-p="${x.k}"><span>${esc(x.t)}</span></button>`).join('') || '<p class="muted">Tap the words below.</p>';
    pool.innerHTML = tiles.filter(x => !placed.includes(x)).map(x => `<button class="btn alt wtile" data-t="${x.k}"><span>${esc(x.t)}</span></button>`).join('');
    $$('[data-t]', pool).forEach(b => b.onclick = () => { placed.push(tiles.find(x => x.k === +b.dataset.t)); render(placed); });
    $$('[data-p]', line).forEach(b => b.onclick = () => { placed.splice(placed.findIndex(x => x.k === +b.dataset.p), 1); render(placed); });
    state.placed = placed;
  };
  const state = { placed: [] };
  render([]);
  $('[data-clear]', body).onclick = () => render([]);
  $('[data-check]', body).onclick = () => {
    if (state.placed.length < tiles.length) return toast('Use all the words');
    const built = state.placed.map(x => x.t).join(' '), ok = built === ex.tiles.join(' ');
    tries++;
    if (ok || tries >= 2) {
      $$('button', body).forEach(b => b.disabled = true);
      done(ok ? (tries === 1 ? 1 : 0.5) : 0, ok ? 'Yes! ' + built : 'The sentence is: ' + ex.tiles.join(' '));
    } else { toast('Not quite — look at the capital letter and the end mark. Try again!'); render([]); }
  };
}

function exWrite(body, ex, done) {
  let tries = 0;
  body.innerHTML = `<textarea class="input" rows="3" placeholder="Write your sentence…" aria-label="Your sentence"></textarea>
    <div class="row wrap-row">${Speech.canListen ? `<button class="btn alt" data-say>${icon('mic')}<span>SAY IT</span></button>` : ''}<button class="btn" data-check><span>CHECK</span></button></div>
    <p class="hint muted">Example: ${esc(ex.hint)}</p>`;
  const ta = $('textarea', body);
  if ($('[data-say]', body)) $('[data-say]', body).onclick = async () => {
    toast('Listening… say your sentence');
    try { const said = await Speech.listenOnce(); if (said) ta.value = said.charAt(0).toUpperCase() + said.slice(1) + (/[.!?]$/.test(said) ? '' : '.'); } catch (e) { toast('Could not listen: ' + e.message); }
  };
  $('[data-check]', body).onclick = () => {
    const t = ta.value.trim();
    if (!t) return toast('Write a sentence first');
    const stem = norm(ex.word).slice(0, Math.max(3, norm(ex.word).length - 2));
    const missing = [];
    if (!words(t).some(w => norm(w).startsWith(stem))) missing.push(`use the word “${ex.word}”`);
    if (words(t).length < ex.minWords) missing.push(`write at least ${ex.minWords} words`);
    if (!/^[A-Z"“]/.test(t)) missing.push('start with a capital letter');
    if (!/[.!?]["”]?$/.test(t)) missing.push('end with . ? or !');
    tries++;
    if (!missing.length || tries >= 2) {
      ta.disabled = true; $$('button', body).forEach(b => b.disabled = true);
      done(!missing.length ? (tries === 1 ? 1 : 0.5) : 0, !missing.length ? 'Great sentence!' : 'Good try! Next time remember to ' + missing.join(' and ') + '.');
    } else $('.hint', body).textContent = 'Almost! Please ' + missing.join(' and ') + '.';
  };
}

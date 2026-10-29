// In the Android app the phone's own recognizer and voice are used (the WebView has neither).
// The Windows app has no speech recognition, so reading uses grown-up helper mode there.
const NATIVE = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
const IN_ELECTRON = /Electron/.test(navigator.userAgent);
const SR = NATIVE ? nativeRecognizer() : IN_ELECTRON ? null : (window.SpeechRecognition || window.webkitSpeechRecognition);
const NativeTTS = NATIVE ? window.Capacitor.registerPlugin('TextToSpeech') : null;
const NUMBERS = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty'.split(' ');

// Wraps the Android speech plugin in the same shape as the browser's SpeechRecognition.
function nativeRecognizer() {
  const plugin = window.Capacitor.registerPlugin('SpeechRecognition');
  return class NativeRecognition {
    constructor() { this.lang = 'en-US'; this.continuous = false; this.interimResults = false; this._text = ''; this._handles = []; this._live = false; }
    async start() {
      this._live = true; this._text = '';
      try {
        const perm = await plugin.requestPermissions();
        if (perm.speechRecognition !== 'granted') return this._fail('not-allowed');
        this._handles.push(await plugin.addListener('partialResults', d => { if (this._live) { this._text = (d.matches || [])[0] || this._text; this._emit(false); } }));
        this._handles.push(await plugin.addListener('listeningState', d => { if (d.status === 'stopped') setTimeout(() => this._end(), 600); }));
        await plugin.start({ language: this.lang, partialResults: true, popup: false, maxResults: 1 });
        // The recognizer can stop on silence without an event; notice that too.
        this._watch = setInterval(async () => { try { if (!(await plugin.isListening()).listening) setTimeout(() => this._end(), 600); } catch (e) {} }, 1500);
      } catch (e) { this._fail(String((e && e.message) || e)); }
    }
    _emit(isFinal) { if (this.onresult) this.onresult({ results: [Object.assign([{ transcript: this._text }], { isFinal })] }); }
    _end() { if (!this._live) return; this._live = false; if (this._text) this._emit(true); this._cleanup(); if (this.onend) this.onend(); }
    _fail(error) { this._live = false; this._cleanup(); if (this.onerror) this.onerror({ error }); if (this.onend) this.onend(); }
    _cleanup() { clearInterval(this._watch); this._handles.forEach(h => h.remove()); this._handles = []; }
    stop() { plugin.stop().catch(() => {}); setTimeout(() => this._end(), 400); }
    abort() { this._live = false; this._cleanup(); plugin.stop().catch(() => {}); }
  };
}

const Speech = {
  canListen: !!SR,
  canSpeak: !!NativeTTS || 'speechSynthesis' in window,
  // The Android recognizer and the recorder cannot share the microphone, so recordings there come from helper mode.
  canRecordWhileListening: !NATIVE,
  stop() {
    if (NativeTTS) NativeTTS.stop().catch(() => {});
    else if (window.speechSynthesis) speechSynthesis.cancel();
  },
  say(text, { rate = 0.9, onboundary, onend } = {}) {
    if (!this.canSpeak) { toast('This device cannot read aloud'); return; }
    this.stop();
    if (NativeTTS) {
      let h;
      (async () => {
        if (onboundary) h = await NativeTTS.addListener('onRangeStart', r => onboundary({ charIndex: r.start }));
        try { await NativeTTS.speak({ text, lang: 'en-US', rate, category: 'playback' }); } catch (e) {}
        if (h) h.remove();
        if (onend) onend();
      })();
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.rate = rate; u.lang = 'en-US';
    if (onboundary) u.onboundary = onboundary;
    if (onend) { u.onend = onend; u.onerror = onend; }
    speechSynthesis.speak(u);
    return u;
  },
  // One spoken answer, as text.
  listenOnce(timeout = 10000) {
    return new Promise((res, rej) => {
      if (!SR) return rej(new Error('Speech recognition is not available in this browser'));
      const r = new SR();
      r.lang = 'en-US'; r.interimResults = false; r.maxAlternatives = 1;
      let said = '';
      const timer = setTimeout(() => r.stop(), timeout);
      r.onresult = e => { said = [...e.results].map(x => x[0].transcript).join(' '); };
      r.onerror = e => { clearTimeout(timer); rej(new Error(e.error)); };
      r.onend = () => { clearTimeout(timer); res(said); };
      r.start();
      onLeave(() => r.abort());
    });
  },
};

function speechNorm(w) {
  const n = norm(w);
  return /^\d+$/.test(n) && NUMBERS[+n] ? NUMBERS[+n] : n;
}
function sameWord(a, b) {
  if (a === b) return true;
  if (a.length >= 4 && b.length >= 4 && levenshtein(a, b) <= 1) return true;
  return a.replace(/s$/, '') === b.replace(/s$/, '');
}

// Follows the reader through the passage. Heard words are matched to the text a few words ahead;
// jumped-over words are skipped, and a word reached only after wrong attempts is a stumble.
function align(toks, heard) {
  const status = toks.map(() => 'unread');
  let p = 0, wrong = 0;
  for (const h of heard) {
    if (!h) continue;
    let hit = -1;
    for (let j = p; j < Math.min(p + 4, toks.length); j++) if (sameWord(toks[j].n, h)) { hit = j; break; }
    if (hit < 0) {
      if (p > 0 && sameWord(toks[p - 1].n, h)) continue; // a repeat is fine
      wrong++; continue;
    }
    for (let k = p; k < hit; k++) status[k] = 'skipped';
    status[hit] = wrong > 0 ? 'stumble' : 'read';
    p = hit + 1; wrong = 0;
  }
  return { status, p };
}

function tokenize(text) {
  const toks = [];
  String(text).split(/\n\s*\n/).forEach((para, pi) => words(para).forEach(raw => toks.push({ raw, n: speechNorm(raw), para: pi })));
  return toks.filter(t => t.n);
}

function storyHTML(toks, title) {
  let html = title ? `<h2 class="story-title">${esc(title)}</h2>` : '', para = -1;
  toks.forEach((t, i) => {
    if (t.para !== para) { html += (para >= 0 ? '</p>' : '') + '<p>'; para = t.para; }
    html += `<span class="w" data-i="${i}">${esc(t.raw)}</span> `;
  });
  return html + '</p>';
}

async function startRecorder() {
  if (!navigator.mediaDevices || !window.MediaRecorder) return null;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream), chunks = [];
    rec.ondataavailable = e => e.data.size && chunks.push(e.data);
    rec.start(1000);
    const stop = () => new Promise(res => {
      if (rec.state === 'inactive') return res(null);
      rec.onstop = () => { stream.getTracks().forEach(t => t.stop()); res(chunks.length ? new Blob(chunks, { type: rec.mimeType || 'audio/webm' }) : null); };
      rec.stop();
    });
    onLeave(() => { if (rec.state !== 'inactive') rec.stop(); stream.getTracks().forEach(t => t.stop()); });
    return { stop };
  } catch (e) { return null; }
}

// Read-aloud check. With speech recognition the app follows along by itself; without it,
// a grown-up taps the words that were missed (helper mode).
function mountReader(el, passage, { onDone, nextLabel = 'NEXT ▶' }) {
  const toks = tokenize(passage.text);
  const settings = Store.state.settings;
  let mode = Speech.canListen ? 'mic' : 'helper';
  let running = false, finished = false, t0 = 0, firstHeard = 0, lastHeard = 0, timer, recog, recorder;
  let doneHeard = [], sessionHeard = [], state = { status: toks.map(() => 'unread'), p: 0 };
  const helperMissed = new Set();

  el.innerHTML = `
    <div class="row wrap-row">
      <button class="btn" data-r="start">${icon('mic')}<span>START READING</span></button>
      <button class="btn alt" data-r="listen">${icon('speaker')}<span>LISTEN FIRST</span></button>
      <button class="btn alt" data-r="mode"><span data-r-mode></span></button>
      <button class="btn warn hidden" data-r="done"><span>I'M DONE</span></button>
      ${settings.allowSkipRead ? '<button class="btn alt" data-r="skip"><span>SKIP READING</span></button>' : ''}
    </div>
    <div class="stats-line"><span data-r-time>0:00</span><span data-r-wpm>— WPM</span><span data-r-hint></span></div>
    <div class="story">${storyHTML(toks, passage.title)}</div>
    <div class="read-result hidden"></div>`;
  const spans = $$('.w', el);
  const btn = n => $(`[data-r="${n}"]`, el);

  function paintMode() {
    $('[data-r-mode]', el).textContent = mode === 'mic' ? 'MODE: APP LISTENS' : 'MODE: GROWN-UP HELPS';
    $('[data-r-hint]', el).textContent = running ? (mode === 'mic' ? 'Read out loud — the words light up as you go.' : 'Grown-up: tap each word he misses or skips.')
      : 'Tap any word to hear it and see what it means.';
  }
  paintMode();

  function paint() {
    spans.forEach((s, i) => {
      const st = mode === 'helper' ? (helperMissed.has(i) ? 'skipped' : 'unread') : state.status[i];
      s.className = 'w ' + st + (running && mode === 'mic' && i === state.p ? ' cur' : '');
    });
  }

  function heardAll() { return doneHeard.concat(sessionHeard); }
  function onResult(e) {
    sessionHeard = [];
    let finals = [];
    for (const r of e.results) {
      const ws = words(r[0].transcript).map(speechNorm).filter(Boolean);
      sessionHeard.push(...ws);
      if (r.isFinal) finals.push(...ws);
    }
    recog._finals = finals;
    if (!firstHeard && sessionHeard.length) firstHeard = Date.now();
    const before = state.p;
    state = align(toks, heardAll());
    if (state.p > before) lastHeard = Date.now();
    paint();
    const cur = spans[Math.min(state.p, spans.length - 1)];
    if (cur && state.p !== before) cur.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (state.p >= toks.length) setTimeout(() => running && finish(), 900);
  }

  function startRecog() {
    recog = new SR();
    recog.lang = 'en-US'; recog.continuous = true; recog.interimResults = true;
    recog._finals = [];
    recog.onresult = onResult;
    recog.onerror = e => {
      if (['not-allowed', 'service-not-allowed', 'audio-capture', 'network'].includes(e.error)) {
        toast(e.error === 'network' ? 'Listening needs the internet here — switching to grown-up helper mode' : 'Microphone blocked — switching to grown-up helper mode');
        mode = 'helper'; paintMode(); paint();
      }
    };
    recog.onend = () => {
      // Recognition stops on its own after a pause; keep listening until the reader is done.
      doneHeard = doneHeard.concat(recog._finals || []); sessionHeard = [];
      if (running && mode === 'mic') setTimeout(() => { if (running) startRecog(); }, 150);
    };
    try { recog.start(); } catch (e) {}
  }

  async function start() {
    if (running) return;
    Speech.stop();
    running = true; finished = false; t0 = Date.now(); firstHeard = lastHeard = 0;
    doneHeard = []; sessionHeard = []; helperMissed.clear(); state = { status: toks.map(() => 'unread'), p: 0 };
    $('.read-result', el).classList.add('hidden');
    btn('start').classList.add('hidden'); btn('listen').classList.add('hidden'); btn('mode').classList.add('hidden');
    btn('done').classList.remove('hidden');
    paintMode(); paint();
    recorder = mode === 'mic' && !Speech.canRecordWhileListening ? null : await startRecorder();
    if (mode === 'mic') startRecog();
    timer = setInterval(tick, 500);
  }

  function tick() {
    const secs = (Date.now() - t0) / 1000;
    $('[data-r-time]', el).textContent = fmtTime(secs);
    const good = mode === 'mic' ? state.status.filter(s => s === 'read' || s === 'stumble').length : 0;
    const span = ((lastHeard || Date.now()) - (firstHeard || t0)) / 60000;
    if (mode === 'mic' && good > 3 && span > 0) $('[data-r-wpm]', el).textContent = Math.round(good / span) + ' WPM';
  }

  async function finish() {
    if (!running) return;
    running = false; finished = true; clearInterval(timer);
    if (recog) { recog.onend = null; try { recog.stop(); } catch (e) {} }
    const end = Date.now();
    let status;
    if (mode === 'mic') status = state.status.map(s => s === 'unread' ? 'skipped' : s);
    else status = toks.map((_, i) => helperMissed.has(i) ? 'skipped' : 'read');
    state.status = status;
    const read = status.filter(s => s === 'read').length, stumble = status.filter(s => s === 'stumble').length;
    const accuracy = Math.round((read + stumble * 0.5) / toks.length * 100);
    const minutes = mode === 'mic' && firstHeard ? Math.max((lastHeard || end) - firstHeard, 1000) / 60000 : (end - t0) / 60000;
    const wpm = Math.min(300, Math.round((read + stumble) / Math.max(minutes, 5 / 60))); // a tap on DONE right away is not a reading speed
    const missed = [...new Set(status.map((s, i) => s !== 'read' ? toks[i].raw.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '') : null).filter(Boolean))];
    let recId = null;
    if (recorder) {
      const blob = await recorder.stop();
      if (blob) { recId = 'rec-' + uid(); try { await Blobs.put(recId, blob); } catch (e) { recId = null; } }
    }
    paint();
    btn('done').classList.add('hidden'); btn('start').classList.remove('hidden'); btn('listen').classList.remove('hidden'); btn('mode').classList.remove('hidden');
    $('span', btn('start')).textContent = 'READ AGAIN';
    paintMode();
    const result = { mode, seconds: Math.round((end - t0) / 1000), wpm, accuracy, total: toks.length, missed, recId, skipped: false };
    const box = $('.read-result', el);
    box.classList.remove('hidden');
    box.innerHTML = `
      <div class="tiles-row">
        <div class="stat"><b>${wpm}</b><span>WORDS / MIN</span></div>
        <div class="stat"><b>${accuracy}%</b><span>ACCURACY</span></div>
        <div class="stat"><b>${fmtTime(result.seconds)}</b><span>TIME</span></div>
      </div>
      ${missed.length ? `<p class="muted">Words to practice: ${missed.map(w => `<button class="chip" data-word="${esc(w)}">${esc(w)}</button>`).join(' ')}</p>` : '<p class="good">Every word read! ⭐</p>'}
      <button class="btn" data-r="next"><span>${esc(nextLabel)}</span></button>`;
    $$('[data-word]', box).forEach(b => b.onclick = () => showWord(b.dataset.word, passage));
    $('[data-r="next"]', box).onclick = () => onDone(result);
    box.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  btn('start').onclick = start;
  btn('done').onclick = finish;
  btn('mode').onclick = () => {
    if (!Speech.canListen) { toast('This browser cannot listen — try Chrome or Edge. Grown-up helper mode is on.'); return; }
    mode = mode === 'mic' ? 'helper' : 'mic'; paintMode();
  };
  btn('listen').onclick = () => {
    let starts = [], pos = 0;
    const text = toks.map(t => { starts.push(pos); pos += t.raw.length + 1; return t.raw; }).join(' ');
    Speech.say(text, {
      rate: 0.85,
      onboundary: e => { let i = starts.findIndex((s, k) => e.charIndex >= s && (k === starts.length - 1 || e.charIndex < starts[k + 1])); spans.forEach((s, k) => s.classList.toggle('tts', k === i)); },
      onend: () => spans.forEach(s => s.classList.remove('tts')),
    });
  };
  if (btn('skip')) btn('skip').onclick = () => { running = false; clearInterval(timer); onDone({ skipped: true, missed: [] }); };
  spans.forEach((s, i) => s.onclick = () => {
    if (running && mode === 'helper') { helperMissed.has(i) ? helperMissed.delete(i) : helperMissed.add(i); paint(); }
    else if (!running) showWord(toks[i].raw, passage);
  });
  onLeave(() => { running = false; clearInterval(timer); if (recog) { recog.onend = null; try { recog.abort(); } catch (e) {} } });
}

// Tap a word: hear it, see its meaning. Looked-up words come back in Word Review.
async function showWord(raw, passage) {
  const word = raw.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9'’]+$/g, '');
  const k = norm(word);
  if (!k) return;
  const sentence = passage ? (passage.sentences || splitSentences(passage.text)).find(s => words(s).some(w => norm(w) === k)) || '' : '';
  const m = modal(`
    <div class="big-word">${esc(word)}</div>
    <p class="meaning">…</p>
    <div class="row wrap-row">
      <button class="btn" data-x="hear">${icon('speaker')}<span>HEAR IT</span></button>
      <button class="btn alt" data-x="close"><span>GOT IT</span></button>
    </div>`);
  $('[data-x=hear]', m.el).onclick = () => Speech.say(word, { rate: 0.7 });
  $('[data-x=close]', m.el).onclick = m.close;
  Speech.say(word, { rate: 0.7 });
  Store.missWord(word, 'looked');
  const entry = Store.state.words[k];
  let meaning = (passage && passage.vocab && passage.vocab[k]) || (entry && entry.meaning) || '';
  if (!meaning && Model.online) { try { meaning = await Model.define(word, sentence); } catch (e) {} }
  if (entry && meaning) entry.meaning = meaning;
  Store.save();
  $('.meaning', m.el).textContent = meaning || 'No meaning saved yet — ask a grown-up, or turn on the story writer in Grown-ups.';
}

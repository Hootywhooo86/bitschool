// In the Android app the phone's own recognizer and voice are used (the WebView has neither).
// The Windows app has no speech recognition, so reading uses grown-up helper mode there.
// Capacitor's Android bridge injects each native plugin as window.Capacitor.Plugins.<Name>.
const NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const nativePlugin = name => (NATIVE && window.Capacitor.Plugins && window.Capacitor.Plugins[name]) || null;
const IN_ELECTRON = /Electron/.test(navigator.userAgent);
const PHONE_SR = nativePlugin('Listen') ? streamRecognizer('Listen', 1500) : nativePlugin('SpeechRecognition') ? nativeRecognizer() : NATIVE || IN_ELECTRON ? null : (window.SpeechRecognition || window.webkitSpeechRecognition);
// Whisper models for listening (downloaded in Settings, run on the phone by WhisperPlugin.java).
const WHISPER_HF = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/';
const LISTEN_MODELS = [
  { id: 'whisper-base', name: 'Whisper base', file: 'ggml-base.en-q8_0.bin', url: WHISPER_HF + 'ggml-base.en-q8_0.bin', size: 81781811, ramGB: 2, note: 'Best listening. Hears kids reading far better than the phone\'s own listener, especially with pauses and background noise.' },
  { id: 'whisper-tiny', name: 'Whisper tiny', file: 'ggml-tiny.en-q8_0.bin', url: WHISPER_HF + 'ggml-tiny.en-q8_0.bin', size: 43550795, ramGB: 1, note: 'Lighter and faster, for older phones. Nearly as good.' },
];
let whisperClass = null;
// The listener in use: Whisper when it's chosen and downloaded, else the phone's own.
function currentSR() {
  const st = Store.state && Store.state.settings, m = st && LISTEN_MODELS.find(x => x.id === st.listener);
  if (m && nativePlugin('Whisper') && Device.has(m)) {
    if (!whisperClass || whisperClass.model !== m) { whisperClass = streamRecognizer('Whisper', 20000, m); whisperClass.model = m; }
    return whisperClass;
  }
  return PHONE_SR;
}
const NativeTTS = nativePlugin('TextToSpeech');
const NUMBERS = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty'.split(' ');

// The app's own Android listeners, in the shape of the browser's SpeechRecognition. Listen
// (ListenPlugin.java) keeps the phone's recognizer running through pauses; Whisper (WhisperPlugin.java)
// records the microphone and transcribes on the phone, steered by the story text. Both number each
// utterance, so everything heard is kept. stop() resolves once the last words are in (and, for Whisper,
// with the recording).
function streamRecognizer(name, settleMs, model) {
  const plugin = nativePlugin(name);
  let warned = false;
  return class StreamRecognition {
    constructor() { this.lang = 'en-US'; this.continuous = false; this.interimResults = false; this._text = {}; this._final = {}; this._handles = []; this._live = false; }
    async start() {
      this._live = true; this._text = {}; this._final = {};
      const on = async (event, fn) => { this._handles.push(await plugin.addListener(event, fn)); };
      try {
        await on('partial', d => { if (this._live) { this._text[d.utterance] = d.text; this._emit(); } });
        await on('final', d => { if (this._live) { if (d.text) this._text[d.utterance] = d.text; this._final[d.utterance] = true; this._emit(); if (!this.continuous && model && d.text) this.stop(); } });
        await on('error', d => this._fail(d.error));
        await on('warning', d => { if (d.error === 'network' && !warned) { warned = true; toast('Listening works best with internet on this phone'); } });
        await on('end', () => this._end());
        // Whisper and the story writer would share the phone's processor: writing waits while it listens.
        if (model) Device.pause(true);
        await plugin.start(model ? { file: model.file, story: this.story || '' } : { language: this.lang, continuous: this.continuous, expect: this.expect || [] });
      } catch (e) { this._fail(String((e && e.message) || e)); }
    }
    _emit() {
      const keys = Object.keys(this._text).map(Number).sort((a, b) => a - b);
      const results = keys.map(k => Object.assign([{ transcript: this._text[k] }], { isFinal: !!this._final[k] }));
      if (this.onresult) this.onresult({ results });
    }
    _end() {
      if (model) Device.pause(false);
      if (this._settle) { this._settle(); this._settle = null; }
      if (!this._live) return;
      this._live = false;
      Object.keys(this._text).forEach(k => { this._final[k] = true; });
      this._emit(); this._cleanup();
      if (this.onend) this.onend();
    }
    _fail(error) { this._live = false; this._cleanup(); if (this.onerror) this.onerror({ error }); if (this.onend) this.onend(); }
    _cleanup() { if (model) Device.pause(false); this._handles.forEach(h => h.remove()); this._handles = []; }
    stop() {
      if (!this._live) return Promise.resolve({}); // already finished: nothing to wait for
      const ended = new Promise(res => { this._settle = res; setTimeout(res, settleMs); });
      const stopped = plugin.stop().catch(() => ({}));
      return Promise.all([stopped, ended]).then(([r]) => { this._end(); return r || {}; });
    }
    abort() { this._live = false; this._cleanup(); plugin.abort().catch(() => {}); }
  };
}

// Wraps the community Android speech plugin in the same shape as the browser's SpeechRecognition.
function nativeRecognizer() {
  const plugin = nativePlugin('SpeechRecognition');
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

// Reading voices: the grown-up's pick from Settings, or the most natural-sounding English voice installed.
const Voices = {
  list: null,
  async all() {
    if (this.list) return this.list;
    let raw = [];
    try {
      if (NativeTTS) raw = ((await NativeTTS.getSupportedVoices()).voices || []).map((v, index) => ({ index, name: v.name || v.voiceURI, lang: v.lang, local: v.localService }));
      else if (window.speechSynthesis) {
        let vs = speechSynthesis.getVoices();
        if (!vs.length) vs = await new Promise(res => { speechSynthesis.onvoiceschanged = () => res(speechSynthesis.getVoices()); setTimeout(() => res(speechSynthesis.getVoices()), 1500); });
        raw = vs.map((voice, index) => ({ index, name: voice.name, lang: voice.lang, local: voice.localService, voice }));
      }
    } catch (e) {}
    this.list = raw.filter(v => /^en[-_]/i.test(v.lang || '')).sort((a, b) => this.score(b) - this.score(a));
    return this.list;
  },
  // Higher is more natural: neural/network voices first, then US English.
  score(v) {
    const n = (v.name || '').toLowerCase();
    return (/neural|natural|premium|enhanced|wavenet|network|online/.test(n) ? 4 : 0) + (/google/.test(n) ? 1 : 0)
      + (/^en[-_]us/i.test(v.lang) ? 2 : 0) + (/compact|espeak/.test(n) ? -3 : 0);
  },
  async chosen() {
    const all = await this.all(), want = Store.state && Store.state.settings.voice;
    return all.find(v => v.name === want) || all[0] || null;
  },
  chosenNow() {
    if (!this.list) { this.all(); return null; }
    const want = Store.state && Store.state.settings.voice;
    return this.list.find(v => v.name === want) || this.list[0] || null;
  },
  label(v) { return (v.name || '').replace(/^Microsoft |^Google /, '') + ' · ' + v.lang + (/network|online|natural|neural/i.test(v.name) ? ' · natural' : ''); },
};

const Speech = {
  get canListen() { return !!currentSR(); },
  canSpeak: !!NativeTTS || 'speechSynthesis' in window,
  // The Android recognizer and the recorder cannot share the microphone, so recordings there come from helper mode.
  // The phone's recognizer and a recorder can't share the microphone; Whisper records for itself.
  canRecordWhileListening: !nativePlugin('Listen') && !nativePlugin('SpeechRecognition'),
  stop() {
    if (NativeTTS) NativeTTS.stop().catch(() => {});
    else if (window.speechSynthesis) speechSynthesis.cancel();
  },
  say(text, { rate, onboundary, onend } = {}) {
    if (!this.canSpeak) { toast('This device cannot read aloud'); return; }
    this.stop();
    // Callers pass their own pace (slow for single words); the grown-up's speed setting scales it.
    rate = (rate || 0.9) * ((Store.state && Store.state.settings.voiceSpeed) || 1);
    if (NativeTTS) {
      let h;
      (async () => {
        if (onboundary) h = await NativeTTS.addListener('onRangeStart', r => onboundary({ charIndex: r.start }));
        const v = await Voices.chosen();
        try { await NativeTTS.speak({ text, lang: (v && v.lang) || 'en-US', rate, category: 'playback', ...(v ? { voice: v.index } : {}) }); } catch (e) {}
        if (h) h.remove();
        if (onend) onend();
      })();
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.rate = rate; u.lang = 'en-US';
    const v = Voices.chosenNow();
    if (v && v.voice) { u.voice = v.voice; u.lang = v.lang; }
    if (onboundary) u.onboundary = onboundary;
    if (onend) { u.onend = onend; u.onerror = onend; }
    speechSynthesis.speak(u);
    return u;
  },
  // One spoken answer, as text.
  listenOnce(timeout = 10000) {
    return new Promise((res, rej) => {
      const R = currentSR();
      if (!R) return rej(new Error('Speech recognition is not available in this browser'));
      const r = new R();
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
// A rough "sounds like" key: silent letters dropped, look-alike sounds merged, vowels after the
// first letter removed. So read/red, there/their, knight/night, phone/fone share a key.
function soundKey(w) {
  let k = w.replace(/^kn|^gn|^pn/, 'n').replace(/^wr/, 'r').replace(/^wh/, 'w').replace(/ph/g, 'f').replace(/ck/g, 'k')
    .replace(/gh/g, '').replace(/c(?=[eiy])/g, 's').replace(/c/g, 'k').replace(/q/g, 'k').replace(/x/g, 'ks').replace(/z/g, 's')
    .replace(/(.)\1+/g, '$1');
  return k[0] + k.slice(1).replace(/[aeiouyw]/g, '');
}
function sameWord(a, b) {
  if (a === b) return true;
  if (a.length >= 4 && b.length >= 4 && levenshtein(a, b) <= 1) return true;
  if (a.replace(/s$/, '') === b.replace(/s$/, '')) return true;
  // Sound-alikes must also share their first vowel, so cat/kit or cat/cut stay different words.
  const v = w => (w.slice(1).match(/[aeiou]/) || [''])[0];
  return a.length >= 3 && b.length >= 3 && Math.abs(a.length - b.length) <= 2 && soundKey(a) === soundKey(b) && v(a) === v(b);
}
// Contractions said as two words ("did not" for "didn't").
const LONG_FORM = { dont: 'donot', cant: 'cannot', isnt: 'isnot', didnt: 'didnot', doesnt: 'doesnot', wasnt: 'wasnot', wont: 'willnot',
  couldnt: 'couldnot', wouldnt: 'wouldnot', shouldnt: 'shouldnot', arent: 'arenot', werent: 'werenot', havent: 'havenot', hasnt: 'hasnot',
  im: 'iam', its: 'itis', youre: 'youare', theyre: 'theyare', were: 'weare', ill: 'iwill', well: 'wewill', lets: 'letus', thats: 'thatis', whats: 'whatis' };
// One story word heard as two ("sun flower"), or a contraction said in full.
function sameJoined(tok, a, b) { const j = a + b; return tok === j || LONG_FORM[tok] === j || (j.length >= 6 && levenshtein(tok, j) <= 1); }

// Follows the reader through the passage. Heard words are matched a few words ahead; jumped-over
// words are skipped, and a word reached only after wrong attempts is a stumble. When the recognizer
// drops a stretch of audio, the reader is found again further ahead (two heard words in a row, or one
// long word, matching the story), and the words in between are "unheard": the app missed them, so
// they don't count against him.
const RESYNC_WINDOW = 40;
function align(toks, heard) {
  const status = toks.map(() => 'unread');
  let p = 0, wrong = 0;
  for (let i = 0; i < heard.length; i++) {
    const h = heard[i];
    if (!h) continue;
    let hit = -1, jump = false, extra = 0, pair = -1;
    for (let j = p; j < Math.min(p + 4, toks.length); j++) if (sameWord(toks[j].n, h)) { hit = j; break; }
    // "sun flower" for "sunflower", "did not" for "didn't".
    if (hit < 0 && heard[i + 1]) for (let j = p; j < Math.min(p + 3, toks.length); j++) if (sameJoined(toks[j].n, h, heard[i + 1])) { hit = j; extra = 1; break; }
    // "sunflower" for "sun flower" in the story: one heard word covers two story words.
    if (hit < 0) for (let j = p; j < Math.min(p + 3, toks.length - 1); j++) if (sameJoined(h, toks[j].n, toks[j + 1].n)) { hit = j + 1; pair = j; break; }
    if (hit < 0) {
      const next = heard[i + 1];
      for (let j = p + 4; j < Math.min(p + RESYNC_WINDOW, toks.length); j++) {
        if (!sameWord(toks[j].n, h)) continue;
        const confirmed = next ? (j + 1 < toks.length && sameWord(toks[j + 1].n, next)) : h.length >= 5;
        if (confirmed || (h.length >= 6 && !STOPWORDS.has(h))) { hit = j; jump = true; break; }
      }
    }
    if (hit < 0) {
      // Re-reading the last few words is fine, not a stumble.
      if ([1, 2, 3].some(back => p - back >= 0 && sameWord(toks[p - back].n, h))) continue;
      wrong++; continue;
    }
    i += extra;
    for (let k = p; k < hit; k++) status[k] = jump ? 'unheard' : 'skipped';
    if (pair >= 0) status[pair] = 'read';
    status[hit] = wrong > 0 && !jump ? 'stumble' : 'read';
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

// Keeps the screen on while he reads. Android app: the Listen plugin sets the window's keep-screen-on
// flag; browsers that support it get a screen wake lock.
let wakeLock = null;
async function keepAwake(on) {
  const listen = nativePlugin('Listen');
  try {
    if (listen) await listen.keepScreenOn({ on });
    else if (on && navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen');
    else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) {}
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
  let fixing = false, lastRun = { seconds: 0, minutes: 1 }, lastRecId = null, reachedEnd = false;

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
      const st = finished || mode === 'mic' ? state.status[i] : helperMissed.has(i) ? 'skipped' : 'unread';
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
    if (state.p >= toks.length && !reachedEnd) {
      reachedEnd = true;
      $('[data-r-hint]', el).textContent = 'You read to the end! Tap I\'M DONE when you\'re finished.';
      btn('done').classList.add('pulse');
    }
  }

  function startRecog() {
    recog = new (currentSR())();
    recog.story = passage.text;
    recog.lang = 'en-US'; recog.continuous = true; recog.interimResults = true;
    // The story's words: the Android listener biases the phone's recognizer toward them (Android 13+).
    recog.expect = [...new Set(toks.map(t => t.raw.replace(/^[^A-Za-z0-9']+|[^A-Za-z0-9']+$/g, '')))].filter(Boolean).slice(0, 300);
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
    running = true; finished = false; fixing = false; reachedEnd = false; lastRecId = null; t0 = Date.now(); firstHeard = lastHeard = 0;
    btn('done').classList.remove('pulse');
    keepAwake(true);
    doneHeard = []; sessionHeard = []; helperMissed.clear(); state = { status: toks.map(() => 'unread'), p: 0 };
    $('.read-result', el).classList.add('hidden');
    btn('start').classList.add('hidden'); btn('listen').classList.add('hidden'); btn('mode').classList.add('hidden');
    btn('done').classList.remove('hidden');
    paintMode(); paint();
    recorder = mode === 'mic' && !Speech.canRecordWhileListening ? null : await startRecorder();
    // I'M DONE tapped while the recorder was still starting: the reading is already over.
    if (!running) { if (recorder) recorder.stop().catch(() => {}); recorder = null; return; }
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
    running = false; finished = true; fixing = false; clearInterval(timer);
    keepAwake(false); btn('done').classList.remove('pulse');
    const end = Date.now();
    let heardAudio = null;
    if (recog && mode === 'mic') {
      recog.onend = null;
      $('[data-r-hint]', el).textContent = 'Checking the last words…';
      try { const r = await recog.stop(); if (r && r.wav) heardAudio = new Blob([Uint8Array.from(atob(r.wav), ch => ch.charCodeAt(0))], { type: 'audio/wav' }); } catch (e) {}
    }
    // Words after the last one heard: the app may have stopped hearing him, so they're "unheard".
    if (mode === 'mic') state.status = state.status.map(s => s === 'unread' ? 'unheard' : s);
    else state.status = toks.map((_, i) => helperMissed.has(i) ? 'skipped' : 'read');
    const minutes = mode === 'mic' && firstHeard ? Math.max((lastHeard || end) - firstHeard, 1000) / 60000 : (end - t0) / 60000;
    const blob = recorder ? await recorder.stop() : heardAudio;
    if (blob) { lastRecId = 'rec-' + uid(); try { await Blobs.put(lastRecId, blob); } catch (e) { lastRecId = null; } }
    lastRun = { seconds: Math.round((end - t0) / 1000), minutes };
    btn('done').classList.add('hidden'); btn('start').classList.remove('hidden'); btn('listen').classList.remove('hidden'); btn('mode').classList.remove('hidden');
    $('span', btn('start')).textContent = 'READ AGAIN';
    paintMode(); paint(); showResult();
    $('.read-result', el).scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  // Scores from the word marks. Words the app didn't hear only count once a grown-up says how they went.
  function resultNow() {
    const st = state.status, n = k => st.filter(x => x === k).length;
    const read = n('read'), stumble = n('stumble'), skipped = n('skipped'), unheard = n('unheard');
    const judged = read + stumble + skipped;
    const accuracy = judged ? Math.round((read + stumble * 0.5) / judged * 100) : 0;
    const wpm = Math.min(300, Math.round((read + stumble) / Math.max(lastRun.minutes, 5 / 60))); // a tap on DONE right away is not a reading speed
    const missed = [...new Set(st.map((s, i) => s === 'skipped' || s === 'stumble' ? toks[i].raw.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '') : null).filter(Boolean))];
    return { mode, seconds: lastRun.seconds, wpm, accuracy, total: toks.length, heard: judged, unheard, missed, recId: lastRecId, skipped: false };
  }

  function showResult() {
    const result = resultNow(), box = $('.read-result', el);
    const mostlyMissed = result.unheard > toks.length * 0.25;
    box.classList.remove('hidden');
    box.innerHTML = `
      <div class="tiles-row">
        <div class="stat"><b>${result.wpm}</b><span>WORDS / MIN</span></div>
        <div class="stat"><b>${result.accuracy}%</b><span>ACCURACY</span></div>
        <div class="stat"><b>${fmtTime(result.seconds)}</b><span>TIME</span></div>
      </div>
      ${result.unheard ? `<div class="feedback wait"><p>${mostlyMissed ? 'The app missed a lot of your reading — sorry!' : `The app didn't hear ${result.unheard} word${result.unheard > 1 ? 's' : ''} (dotted).`} A grown-up can fix it — no need to read it again.</p></div>
        <div class="row wrap-row"><button class="btn" data-r="allread"><span>HE READ THEM — MARK AS READ</span></button></div>` : ''}
      <div class="row wrap-row"><button class="btn alt ${fixing ? 'on' : ''}" data-r="fix"><span>${fixing ? 'DONE FIXING' : 'GROWN-UP: FIX WORDS'}</span></button></div>
      ${fixing ? '<p class="muted">Tap a word to switch it between read (green) and missed (red).</p>' : ''}
      ${result.missed.length ? `<p class="muted">Words to practice: ${result.missed.map(w => `<button class="chip" data-word="${esc(w)}">${esc(w)}</button>`).join(' ')}</p>` : result.unheard ? '' : '<p class="good">Every word read! ⭐</p>'}
      <button class="btn" data-r="next"><span>${esc(nextLabel)}</span></button>`;
    $$('[data-word]', box).forEach(b => b.onclick = () => showWord(b.dataset.word, passage));
    if ($('[data-r="allread"]', box)) $('[data-r="allread"]', box).onclick = () => { state.status = state.status.map(s => s === 'unheard' ? 'read' : s); paint(); showResult(); };
    $('[data-r="fix"]', box).onclick = () => { fixing = !fixing; showResult(); };
    $('[data-r="next"]', box).onclick = () => onDone(resultNow());
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
    else if (finished && fixing) { state.status[i] = state.status[i] === 'read' ? 'skipped' : 'read'; paint(); showResult(); }
    else if (!running) showWord(toks[i].raw, passage);
  });
  onLeave(() => { running = false; keepAwake(false); clearInterval(timer); if (recog) { recog.onend = null; try { recog.abort(); } catch (e) {} } });
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

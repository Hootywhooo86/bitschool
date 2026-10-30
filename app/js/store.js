// Everything stays on this device: settings and progress in localStorage,
// recordings and handwriting in IndexedDB.
const THEMES = {
  chalkboard: { name: 'Chalkboard', bg: '#0b0b16', panel: '#141428', accent: '#22c55e', accent2: '#facc15', ink: '#f4f1ff', apple: '#ff3b3b' },
  apple:      { name: 'Apple Red',  bg: '#1a0b0b', panel: '#2a1414', accent: '#ff5d5d', accent2: '#ffd166', ink: '#fff4f0', apple: '#ff3b3b' },
  ocean:      { name: 'Ocean',      bg: '#06141f', panel: '#0d2233', accent: '#38bdf8', accent2: '#fde047', ink: '#eef8ff', apple: '#ff4d6d' },
  grape:      { name: 'Grape',      bg: '#120a1f', panel: '#1f1433', accent: '#c084fc', accent2: '#fbbf24', ink: '#f8f0ff', apple: '#ff3b5c' },
  sunny:      { name: 'Sunny',      bg: '#fff8e7', panel: '#ffffff', accent: '#16a34a', accent2: '#d97706', ink: '#1c1917', apple: '#e11d1d' },
  contrast:   { name: 'High Contrast', bg: '#000000', panel: '#000000', accent: '#ffff00', accent2: '#00ffff', ink: '#ffffff', apple: '#ff0000' },
};

const DAY = 864e5;
const REVIEW_DAYS = [0, 1, 2, 4, 8, 16]; // Leitner boxes; box 6 means learned.

const Store = {
  key: 'bitschool.reading.v1',
  state: null,
  defaults() {
    return {
      child: { name: '' },
      placed: false, level: 0, booklet: null,
      settings: {
        passMark: 85, sheetsPerBooklet: 6, dailyGoal: 2, storyIdeas: [], ownIdeas: true, allowSkipRead: false, readSize: 30,
        theme: { ...THEMES.chalkboard }, themeName: 'chalkboard',
        model: { endpoint: 'http://localhost:11434', api: Device.available() ? 'device' : 'ollama', name: 'qwen3:8b', vision: '', device: '' },
      },
      sessions: [], storyPicks: [], days: {}, words: {}, cache: {}, usedBuiltins: [], pending: [], history: [], outbox: [], placements: [],
    };
  },
  load() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(this.key)); } catch (e) {}
    const d = this.defaults();
    this.state = s ? { ...d, ...s, settings: { ...d.settings, ...s.settings, model: { ...d.settings.model, ...(s.settings || {}).model } } } : d;
    // A phone can't reach Ollama at its own "localhost", so older Android installs move to the on-device writer.
    const m = this.state.settings.model;
    if (NATIVE && Device.available() && m.api === 'ollama' && /localhost|127\.0\.0\.1/.test(m.endpoint)) m.api = 'device';
    return this.state;
  },
  save() {
    try { localStorage.setItem(this.key, JSON.stringify(this.state)); }
    catch (e) { // Full: drop the oldest saved story text first.
      this.state.sessions.slice(0, -50).forEach(x => delete x.text);
      try { localStorage.setItem(this.key, JSON.stringify(this.state)); } catch (e2) { toast('Storage is full — export and reset in Grown-ups'); }
    }
  },
  reset() { localStorage.removeItem(this.key); this.load(); },

  // A missed, stumbled or looked-up word goes back to box 0 and is due at the next session.
  missWord(raw, why = 'missed') {
    const k = norm(raw);
    if (!k || k.length < 2) return;
    const w = this.state.words[k] || (this.state.words[k] = { word: raw.replace(/[^A-Za-z0-9'’-]/g, '').toLowerCase(), misses: 0, looked: 0, box: 0, due: 0, first: Date.now() });
    if (why === 'looked') w.looked++; else w.misses++;
    w.box = 0; w.due = Date.now(); w.last = Date.now();
  },
  reviewWord(k, ok) {
    const w = this.state.words[k];
    if (!w) return;
    w.box = ok ? w.box + 1 : 0;
    w.due = Date.now() + (REVIEW_DAYS[w.box] ?? 99) * DAY;
    w.last = Date.now();
    this.save();
  },
  dueWords(n = 99) {
    const now = Date.now();
    return Object.entries(this.state.words).filter(([, w]) => w.box < REVIEW_DAYS.length && w.due <= now)
      .sort((a, b) => (b[1].misses + b[1].looked) - (a[1].misses + a[1].looked)).slice(0, n).map(([k, w]) => ({ k, ...w }));
  },
  // Daily goal: every finished sheet (booklet or practice) counts toward today's goal.
  dayKey(t = Date.now()) {
    const d = new Date(t);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  },
  today() { return this.state.days[this.dayKey()] || { sheets: 0, seconds: 0 }; },
  // A past day keeps the goal it was played under, so changing the goal never erases earned days.
  goalMet(key) {
    const d = this.state.days[key];
    if (!d) return false;
    return d.sheets >= (key === this.dayKey() || !d.goal ? this.state.settings.dailyGoal : d.goal);
  },
  // Days in a row with the goal met, counting today only once it is met.
  streak() {
    let n = 0, t = Date.now();
    if (!this.goalMet(this.dayKey(t))) t -= DAY;
    while (this.goalMet(this.dayKey(t))) { n++; t -= DAY; }
    return n;
  },
  // Returns true when this sheet is the one that meets today's goal.
  logSheet(seconds) {
    const k = this.dayKey(), d = this.state.days[k] || (this.state.days[k] = { sheets: 0, seconds: 0 });
    d.sheets++; d.seconds += seconds || 0; d.goal = this.state.settings.dailyGoal;
    return d.sheets === this.state.settings.dailyGoal;
  },

  // The 128bit family feed: queued here until the app signs in to the shared feed.
  event(type, data) {
    this.state.outbox.push({ app: 'bitschool', type, at: Date.now(), data });
    this.state.outbox = this.state.outbox.slice(-200);
  },
};

const Blobs = {
  db: null,
  open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((res, rej) => {
      const r = indexedDB.open('bitschool', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('blobs');
      r.onsuccess = () => res(this.db = r.result);
      r.onerror = () => rej(r.error);
    });
  },
  async tx(mode, fn) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const t = db.transaction('blobs', mode), req = fn(t.objectStore('blobs'));
      t.oncomplete = () => res(req && req.result);
      t.onerror = () => rej(t.error);
    });
  },
  put(id, blob) { return this.tx('readwrite', s => s.put(blob, id)); },
  get(id) { return this.tx('readonly', s => s.get(id)); },
  del(id) { return this.tx('readwrite', s => s.delete(id)); },
  clear() { return this.tx('readwrite', s => s.clear()); },
};

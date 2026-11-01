// The 128bit family account (Supabase): sign in with the same email and password as the other
// 128bit apps. Progress saves under its own app key with the shared get_settings / put_settings
// functions, and events go to the shared family feed (log_events).
const ACCOUNT = {
  url: 'https://wvflpwtaszpstmjpkrhu.supabase.co',
  key: 'sb_publishable_dO8uP74cTV1tbuqESgxysw_323C7lWh', // publishable: safe in an app, the database checks every call
  app: 'bitschool-reading',
};
// Device-only things that never leave this device: story-writer setup, stories written ahead, recordings.
const LOCAL_ONLY = ['cache', 'outbox', 'usedBuiltins'];

const Account = {
  storeKey: 'bitschool.account.v1',
  session: null, // { access_token, refresh_token, expires_at, email }
  status: 'signed-out', // signed-out | saving | saved | offline | error
  lastSaved: 0,
  timer: null,

  load() {
    try { this.session = JSON.parse(localStorage.getItem(this.storeKey)); } catch (e) {}
    this.lastSaved = (this.session && this.session.lastSaved) || 0;
    if (this.session) this.status = 'saved';
  },
  keep() {
    try {
      if (this.session) localStorage.setItem(this.storeKey, JSON.stringify({ ...this.session, lastSaved: this.lastSaved }));
      else localStorage.removeItem(this.storeKey);
    } catch (e) {}
  },
  signedIn() { return !!this.session; },

  async auth(path, body) {
    const r = await fetch(ACCOUNT.url + '/auth/v1/' + path, {
      method: 'POST', headers: { apikey: ACCOUNT.key, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error_description || j.msg || j.message || 'Sign-in failed (' + r.status + ')');
    return j;
  },
  use(j) {
    this.session = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + (j.expires_in || 3600) * 1000, email: (j.user && j.user.email) || (this.session && this.session.email) };
    this.keep();
  },
  async token() {
    if (!this.session) throw new Error('Not signed in');
    if (Date.now() > this.session.expires_at - 60000) this.use(await this.auth('token?grant_type=refresh_token', { refresh_token: this.session.refresh_token }));
    return this.session.access_token;
  },
  async rpc(name, args) {
    const call = async () => fetch(ACCOUNT.url + '/rest/v1/rpc/' + name, {
      method: 'POST', signal: AbortSignal.timeout(20000),
      headers: { apikey: ACCOUNT.key, Authorization: 'Bearer ' + await this.token(), 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    let r = await call();
    if (r.status === 401 && this.session) { this.session.expires_at = 0; r = await call(); } // token expired early
    const text = await r.text();
    if (!r.ok) { let m = text; try { m = JSON.parse(text).message || m; } catch (e) {} throw new Error(m || 'Account error ' + r.status); }
    return text ? JSON.parse(text) : null;
  },

  // What gets saved: progress and settings, without device-only parts or story texts.
  snapshot() {
    const s = JSON.parse(JSON.stringify(Store.state));
    LOCAL_ONLY.forEach(k => delete s[k]);
    delete s.settings.model;
    s.sessions = (s.sessions || []).map(x => { delete x.text; delete x.recId; return x; });
    s.pending = (s.pending || []).filter(p => p.status !== 'waiting');
    return { savedAt: Date.now(), device: navigator.userAgent.slice(0, 80), state: s };
  },
  // Puts saved progress on this device, keeping this device's own parts.
  apply(remote) {
    const local = Store.state;
    const keep = { model: local.settings.model };
    LOCAL_ONLY.forEach(k => { keep[k] = local[k]; });
    const merged = { ...Store.defaults(), ...remote.state };
    merged.settings = { ...Store.defaults().settings, ...remote.state.settings, model: keep.model };
    LOCAL_ONLY.forEach(k => { merged[k] = keep[k]; });
    // Story texts and recordings for sessions this device already has stay attached.
    const byId = Object.fromEntries((local.sessions || []).map(x => [x.id, x]));
    merged.sessions = (merged.sessions || []).map(x => byId[x.id] ? { ...x, text: byId[x.id].text, recId: byId[x.id].recId } : x);
    Store.state = merged;
    Store.save(true);
    this.lastSaved = remote.savedAt; this.keep();
  },
  progressOf(st) { return { level: st.placed ? levelName(st.level) : 'not placed', sheets: (st.sessions || []).filter(x => !x.placement).length }; },

  async signIn(email, password) {
    this.use(await this.auth('token?grant_type=password', { email, password }));
    const remote = await this.rpc('get_settings', { app_key: ACCOUNT.app });
    const local = this.progressOf(Store.state), hasLocal = Store.state.placed || local.sheets > 0;
    if (remote && remote.state) {
      const r = this.progressOf(remote.state);
      const useRemote = !hasLocal || confirm(`This account already has bitschool progress (level ${r.level}, ${r.sheets} sheets).\n\nOK = use the account's progress on this device\nCancel = keep this device's progress (level ${local.level}, ${local.sheets} sheets) and save it to the account`);
      if (useRemote) { this.apply(remote); this.status = 'saved'; return 'pulled'; }
    }
    await this.save();
    return 'pushed';
  },
  async signOut() {
    try { await this.save(); } catch (e) {}
    try { await fetch(ACCOUNT.url + '/auth/v1/logout', { method: 'POST', headers: { apikey: ACCOUNT.key, Authorization: 'Bearer ' + this.session.access_token } }); } catch (e) {}
    this.session = null; this.status = 'signed-out'; this.keep();
  },

  // Saves a few seconds after the last change, so a burst of changes is one save.
  queue() {
    if (!this.session) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.save().catch(() => {}), 4000);
  },
  async save() {
    if (!this.session) return;
    clearTimeout(this.timer);
    this.status = 'saving'; this.paint();
    try {
      // Another device saved since this one last synced: merge rather than overwrite its progress.
      const remote = await this.rpc('get_settings', { app_key: ACCOUNT.app });
      if (remote && remote.state && remote.savedAt > this.lastSaved) {
        const local = Store.state;
        Store.state = mergeProgress(local, remote.state);
        LOCAL_ONLY.forEach(k => { Store.state[k] = local[k]; });
        Store.state.settings.model = local.settings.model;
        Store.save(true);
      }
      const snap = this.snapshot();
      await this.rpc('put_settings', { new_data: snap, app_key: ACCOUNT.app });
      this.lastSaved = snap.savedAt; this.keep();
      await this.sendEvents();
      this.status = 'saved';
    } catch (e) {
      this.status = navigator.onLine === false || /fetch|network|timeout|abort/i.test(e.message) ? 'offline' : 'error';
      this.error = e.message;
      throw e;
    } finally { this.paint(); }
  },
  // On start: if the account has newer progress (another device), use it.
  async pull() {
    if (!this.session) return false;
    try {
      const remote = await this.rpc('get_settings', { app_key: ACCOUNT.app });
      if (remote && remote.state && remote.savedAt > this.lastSaved) { this.apply(remote); this.status = 'saved'; this.paint(); return true; }
      this.status = 'saved'; this.paint();
    } catch (e) { this.status = 'offline'; this.paint(); }
    return false;
  },
  // The 128bit family feed: what he did, for the family timeline.
  async sendEvents() {
    const out = Store.state.outbox || [];
    if (!out.length) return;
    const batch = out.slice(0, 200).map(e => ({ id: 'bitschool-' + e.at + '-' + e.type, app: e.app, type: e.type, at: e.at, data: e.data }));
    await this.rpc('log_events', { events: batch });
    Store.state.outbox = out.slice(batch.length);
    Store.save(true);
  },

  statusText() {
    if (!this.session) return '';
    const when = this.lastSaved ? new Date(this.lastSaved).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'not yet';
    return { saving: '☁ Saving…', saved: `☁ Saved to 128bit account · ${when}`, offline: `☁ Offline — saves when back online (last ${when})`, error: `☁ Couldn't save: ${this.error || 'unknown error'}` }[this.status] || '';
  },
  paint() { $$('[data-sync]').forEach(el => { el.textContent = this.statusText(); }); },
};

// Combines two copies of his progress so nothing earned on either device is lost:
// every sheet, the best day counts, the newest word reviews, and the copy with the higher level.
function mergeProgress(a, b) {
  const ahead = (b.placed && !a.placed) || (b.level || 0) > (a.level || 0) ? b : a;
  const out = { ...Store.defaults(), ...b, ...pickKeys(ahead, ['placed', 'level', 'booklet', 'history', 'placements']) };
  const seen = new Map();
  [...(a.sessions || []), ...(b.sessions || [])].forEach(x => { if (!seen.has(x.id)) seen.set(x.id, x); });
  out.sessions = [...seen.values()].sort((x, y) => x.at - y.at).slice(-300);
  out.days = { ...(a.days || {}) };
  Object.entries(b.days || {}).forEach(([k, d]) => { if (!out.days[k] || d.sheets > out.days[k].sheets) out.days[k] = d; });
  out.words = { ...(a.words || {}) };
  Object.entries(b.words || {}).forEach(([k, w]) => { if (!out.words[k] || (w.last || 0) > (out.words[k].last || 0)) out.words[k] = w; });
  out.storyPicks = [...new Set([...(a.storyPicks || []), ...(b.storyPicks || [])])].slice(0, 10);
  out.settings = { ...Store.defaults().settings, ...b.settings };
  return out;
}
function pickKeys(o, keys) { return Object.fromEntries(keys.map(k => [k, o[k]])); }

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fmtTime = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
const fmtDate = t => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

// Things to stop (microphone, speech, timers) when leaving a screen.
let leaving = [];
function onLeave(fn) { leaving.push(fn); }
function leave() { leaving.forEach(f => { try { f(); } catch (e) {} }); leaving = []; }

function modal(html) {
  const m = document.createElement('div');
  m.className = 'overlay';
  m.innerHTML = `<div class="modal">${html}</div>`;
  document.body.appendChild(m);
  const close = () => { m.remove(); window.speechSynthesis && speechSynthesis.cancel(); };
  m.addEventListener('click', e => { if (e.target === m) close(); });
  onLeave(close);
  return { el: m, close };
}

function levenshtein(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

// Theme: six chosen colors; everything else is mixed from them so any choice stays readable.
function hexToRgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function rgbToHex(c) { return '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join(''); }
function mix(a, b, t) { const x = hexToRgb(a), y = hexToRgb(b); return rgbToHex(x.map((v, i) => v + (y[i] - v) * t)); }
function luminance(h) { const c = hexToRgb(h).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; }
function onColor(h) { return luminance(h) > 0.35 ? '#0b0b16' : '#ffffff'; }

function applyTheme() {
  const t = Store.state.settings.theme, r = document.documentElement.style;
  const light = luminance(t.bg) > 0.4;
  const vars = {
    '--bg': t.bg, '--panel': t.panel, '--accent': t.accent, '--accent2': t.accent2, '--ink': t.ink, '--apple': t.apple,
    '--panel2': mix(t.panel, t.ink, 0.08), '--line': mix(t.panel, t.ink, 0.18), '--muted': mix(t.ink, t.bg, 0.4),
    '--accent-deep': mix(t.accent, '#000000', 0.38), '--accent2-deep': mix(t.accent2, '#000000', 0.38),
    '--apple-deep': mix(t.apple, '#000000', 0.4), '--on-accent': onColor(t.accent), '--on-accent2': onColor(t.accent2),
    '--bad': light ? '#dc2626' : '#ff5d5d', '--on-bad': light ? '#ffffff' : '#0b0b16',
    '--outline': light ? '#1c1917' : '#000000', '--shadow': light ? 'rgba(0,0,0,.25)' : '#000000',
    '--read-size': Store.state.settings.readSize + 'px',
  };
  Object.entries(vars).forEach(([k, v]) => r.setProperty(k, v));
  document.querySelector('meta[name=theme-color]').content = t.bg;
}

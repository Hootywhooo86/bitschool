// Fun, short animations: star bursts for right answers, confetti for big moments, and the switch that
// turns them all off (Grown-ups → Settings, or the device's "reduce motion" setting).
// Every picture used here is a 128px pixel icon, like the rest of the app.
const FX = {
  on() {
    const st = Store.state && Store.state.settings;
    return !(st && st.motion === false) && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  },
  layer() {
    let l = $('#fx');
    if (!l) { l = document.createElement('div'); l.id = 'fx'; l.setAttribute('aria-hidden', 'true'); document.body.appendChild(l); }
    return l;
  },
  // A picture that flies from (x, y) by (dx, dy), spinning, then disappears.
  fly(html, x, y, dx, dy, ms = 900, cls = '') {
    const p = document.createElement('div');
    p.className = 'fx-bit ' + cls;
    p.innerHTML = html;
    p.style.left = x + 'px'; p.style.top = y + 'px';
    p.style.setProperty('--dx', dx + 'px'); p.style.setProperty('--dy', dy + 'px');
    p.style.setProperty('--spin', Math.round((Math.random() - 0.5) * 540) + 'deg');
    p.style.animationDuration = ms + 'ms';
    this.layer().appendChild(p);
    setTimeout(() => p.remove(), ms + 50);
  },
  // Stars bursting out of an element (a right answer).
  burst(el, n = 4) {
    if (!this.on() || !el) return;
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2 - 64, y = r.top + Math.min(r.height, 120) / 2 - 64;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.6;
      this.fly(icon('star'), x, y, Math.cos(a) * 170, Math.sin(a) * 130 - 60, 750 + Math.random() * 250, 'fx-star');
    }
  },
  // "+1" floating up from an element.
  float(el, text) {
    if (!this.on() || !el) return;
    const r = el.getBoundingClientRect(), t = document.createElement('div');
    t.className = 'fx-float'; t.textContent = text;
    t.style.left = (r.left + r.width / 2) + 'px'; t.style.top = (r.top + 10) + 'px';
    this.layer().appendChild(t);
    setTimeout(() => t.remove(), 1300);
  },
  // Pixel stars and apples raining down the screen (level up, daily goal).
  confetti(n = 14) {
    if (!this.on()) return;
    const w = innerWidth, pics = ['star', 'apple', 'star', 'trophy'];
    for (let i = 0; i < n; i++) {
      setTimeout(() => this.fly(icon(pics[i % pics.length]), Math.random() * (w - 128), -140, (Math.random() - 0.5) * 160, innerHeight + 200, 1800 + Math.random() * 900, 'fx-fall'), i * 120);
    }
  },
};

// Animations on or off for the whole app.
function applyMotion() { document.body.classList.toggle('calm', !FX.on()); }

// Any right answer anywhere (story questions, worksheets, circle, fill-in, order) gets a star burst and
// a "+1"; the wobble for a wrong answer is in the stylesheet.
new MutationObserver(list => {
  if (!FX.on()) return;
  for (const m of list) for (const n of m.addedNodes) {
    if (n.nodeType !== 1) continue;
    const good = n.matches('.feedback.good') ? n : n.querySelector && n.querySelector('.feedback.good');
    if (good) { FX.burst(good); FX.float(good, '+1'); }
  }
}).observe(document.getElementById('view'), { childList: true, subtree: true });

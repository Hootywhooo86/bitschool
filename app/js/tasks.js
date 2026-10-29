// The activities after reading: questions, circle/underline, fill in the blank, sentence order.
// Each calls onDone with its result when the child moves on.

// A drawing surface for the stylus, a finger or a mouse. Returns the strokes drawn.
function makePad(canvas, { width = 6, onStroke } = {}) {
  const ctx = canvas.getContext('2d');
  const strokes = [];
  let cur = null;
  function fit() {
    const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    canvas.width = r.width * dpr; canvas.height = r.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redraw();
  }
  function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = ctx.lineJoin = 'round'; ctx.lineWidth = width;
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--apple').trim() || '#ff3b3b';
    strokes.forEach(s => { ctx.beginPath(); s.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke(); });
  }
  const pt = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  canvas.addEventListener('pointerdown', e => { e.preventDefault(); canvas.setPointerCapture(e.pointerId); cur = [pt(e)]; strokes.push(cur); });
  canvas.addEventListener('pointermove', e => { if (!cur) return; cur.push(pt(e)); redraw(); });
  const end = () => { if (cur && cur.length > 1 && onStroke) onStroke(cur); cur = null; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  requestAnimationFrame(fit);
  window.addEventListener('resize', fit);
  onLeave(() => window.removeEventListener('resize', fit));
  return { strokes, clear() { strokes.length = 0; redraw(); }, redraw, empty: () => !strokes.length };
}

function speakBtn(text) { return `<button class="btn alt square" data-say="${esc(text)}" aria-label="Read it to me">${icon('speaker')}</button>`; }
function wireSay(el) { $$('[data-say]', el).forEach(b => b.onclick = () => Speech.say(b.dataset.say)); }

function mountQuestions(el, passage, { onDone, mcOnly = false }) {
  const qs = passage.questions.filter(q => !mcOnly || q.type === 'mc');
  const results = [];
  let i = 0;
  show();

  function show() {
    if (i >= qs.length) return onDone(results);
    const q = qs[i];
    el.innerHTML = `
      <div class="task-head"><span class="pill">QUESTION ${i + 1} OF ${qs.length}</span></div>
      <div class="q-row">${speakBtn(q.q)}<h2 class="q">${esc(q.q)}</h2></div>
      <div class="q-body"></div>
      <details class="peek"><summary class="btn alt"><span>LOOK BACK AT THE STORY</span></summary><div class="story small">${esc(passage.text).replace(/\n/g, '<br>')}</div></details>`;
    wireSay(el);
    q.type === 'mc' ? mc(q) : open(q);
  }

  function next(r) { results.push(r); i++; show(); }

  function feedback(ok, text) {
    const f = document.createElement('div');
    f.className = 'feedback ' + (ok === true ? 'good' : ok === false ? 'bad' : 'wait');
    f.innerHTML = `<p>${esc(text)}</p><button class="btn" data-next><span>NEXT ▶</span></button>`;
    $('.q-body', el).appendChild(f);
    f.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return f;
  }

  function mc(q) {
    const body = $('.q-body', el);
    body.innerHTML = `<div class="choices">${q.choices.map((c, k) => `<button class="btn choice" data-k="${k}"><span>${esc(c)}</span></button>`).join('')}</div>`;
    $$('[data-k]', body).forEach(b => b.onclick = () => {
      const k = +b.dataset.k, ok = k === q.answer;
      $$('[data-k]', body).forEach(x => { x.disabled = true; if (+x.dataset.k === q.answer) x.classList.add('right'); });
      if (!ok) b.classList.add('wrong');
      const f = feedback(ok, ok ? 'Yes! That\'s right.' : 'Not quite. The answer is: ' + q.choices[q.answer]);
      Speech.say(ok ? 'Yes!' : 'Not quite.');
      $('[data-next]', f).onclick = () => next({ q: q.q, type: 'mc', answer: q.choices[k], correct: ok });
    });
  }

  function open(q) {
    const body = $('.q-body', el);
    let mode = 'type', pad;
    body.innerHTML = `
      <div class="row wrap-row modes">
        <button class="btn alt" data-m="type"><span>⌨ TYPE IT</span></button>
        <button class="btn alt" data-m="write"><span>✏ WRITE IT</span></button>
        <button class="btn alt" data-m="say">${icon('mic')}<span>SAY IT</span></button>
      </div>
      <div class="answer-area"></div>
      <button class="btn" data-check><span>CHECK MY ANSWER</span></button>`;
    const area = $('.answer-area', body);
    function setMode(m) {
      mode = m;
      $$('[data-m]', body).forEach(b => b.classList.toggle('on', b.dataset.m === m));
      if (m === 'write') {
        area.innerHTML = `<canvas class="pad" aria-label="Write your answer here"></canvas><button class="btn alt" data-clear><span>CLEAR</span></button>`;
        pad = makePad($('canvas', area), { width: 5 });
        $('[data-clear]', area).onclick = () => pad.clear();
      } else {
        const prev = $('textarea', area) ? $('textarea', area).value : '';
        area.innerHTML = `<textarea class="input" rows="3" placeholder="${m === 'say' ? 'Tap SAY IT and talk — your words show up here.' : 'Type your answer…'}">${esc(prev)}</textarea>`;
        if (m === 'say') listen();
      }
    }
    async function listen() {
      if (!Speech.canListen) { toast('This browser cannot listen — type or write instead'); return setMode('type'); }
      toast('Listening… say your answer');
      try {
        const said = await Speech.listenOnce();
        const ta = $('textarea', area);
        if (ta && said) ta.value = (ta.value ? ta.value + ' ' : '') + said;
        if (!said) toast('I did not hear anything — tap SAY IT to try again');
      } catch (e) { toast('Could not listen: ' + e.message); }
    }
    $$('[data-m]', body).forEach(b => b.onclick = () => b.dataset.m === 'say' && mode === 'say' ? listen() : setMode(b.dataset.m));
    setMode('type');

    $('[data-check]', body).onclick = async () => {
      const check = $('[data-check]', body);
      let answer = '', image = null;
      if (mode === 'write') {
        if (pad.empty()) return toast('Write your answer first');
        image = $('canvas', area).toDataURL('image/png');
        if (Model.online && Model.cfg().vision) {
          check.disabled = true; $('span', check).textContent = 'READING YOUR WRITING…';
          try { answer = await Model.readHandwriting(image.split(',')[1]); } catch (e) {}
        }
      } else answer = $('textarea', area).value.trim();
      if (!answer && !image) return toast('Answer first, then check');

      check.disabled = true;
      let verdict;
      if (!answer && image) {
        // No handwriting reader: save it for a grown-up to mark.
        const id = 'img-' + uid();
        try { await Blobs.put(id, image); } catch (e) {}
        Store.state.pending.push({ id, at: Date.now(), title: passage.title, level: passage.level, q: q.q, idea: q.idea, status: 'waiting' });
        Store.save();
        check.remove();
        const f = feedback(null, 'Saved! A grown-up will check your writing.');
        $('[data-next]', f).onclick = () => next({ q: q.q, type: 'open', answer: '(handwriting)', correct: null, pending: id });
        return;
      }
      $('span', check).textContent = 'THINKING…';
      if (Model.online) { try { verdict = await Model.judge(passage, q, answer); } catch (e) {} }
      if (!verdict) verdict = keywordJudge(q, answer);
      check.remove();
      const f = feedback(verdict.correct, (verdict.correct ? '✓ ' : '') + verdict.feedback);
      Speech.say(verdict.feedback);
      $('[data-next]', f).onclick = () => next({ q: q.q, type: 'open', answer, correct: verdict.correct, mode });
    };
  }
}

// Circle or underline: the stroke is matched to the words (or sentences) it lands on.
function mountCircle(el, passage, { onDone }) {
  const c = passage.circle;
  const isIdea = c.kind === 'idea';
  const items = isIdea ? c.sentences : words(c.sentence);
  const targetSet = isIdea ? new Set([c.target]) : new Set(items.map((w, k) => c.targets.some(t => norm(t) === norm(w)) ? k : -1).filter(k => k >= 0));
  let tries = 0;
  const hits = new Set();
  el.innerHTML = `
    <div class="task-head"><span class="pill">${isIdea ? 'UNDERLINE IT' : 'CIRCLE IT'}</span></div>
    <div class="q-row">${speakBtn(c.prompt)}<h2 class="q">${esc(c.prompt)}</h2></div>
    <p class="muted">Use your stylus or finger to ${isIdea ? 'underline' : 'circle'} the answer.</p>
    <div class="circle-area ${isIdea ? 'idea' : ''}">
      <div class="circle-text">${items.map((t, k) => `<span class="ci" data-ci="${k}">${esc(t)}</span>`).join(isIdea ? '' : ' ')}</div>
      <canvas class="circle-pad"></canvas>
    </div>
    <div class="row wrap-row">
      <button class="btn alt" data-clear><span>CLEAR</span></button>
      <button class="btn" data-check><span>CHECK</span></button>
    </div>
    <div class="fb"></div>`;
  wireSay(el);
  const area = $('.circle-area', el);
  const spans = $$('.ci', el);

  function hitTest(stroke) {
    const xs = stroke.map(p => p.x), ys = stroke.map(p => p.y);
    const box = { l: Math.min(...xs), r: Math.max(...xs), t: Math.min(...ys), b: Math.max(...ys) };
    const a = area.getBoundingClientRect();
    const rects = spans.map(s => { const r = s.getBoundingClientRect(); return { l: r.left - a.left, r: r.right - a.left, t: r.top - a.top, b: r.bottom - a.top }; });
    const lineH = rects[0].b - rects[0].t;
    const underline = (box.b - box.t) < lineH * 0.6;
    const cy = (box.t + box.b) / 2;
    const found = [];
    rects.forEach((r, k) => {
      const overlap = Math.max(0, Math.min(r.r, box.r) - Math.max(r.l, box.l)) / Math.max(1, Math.min(r.r - r.l, isIdea ? 400 : 1e9));
      if (underline) { if (overlap > (isIdea ? 0.3 : 0.5) && cy > r.t + (r.b - r.t) * 0.35 && cy < r.b + Math.min(lineH * 0.8, 40)) found.push(k); }
      else {
        const mx = (r.l + r.r) / 2, my = (r.t + r.b) / 2;
        if (mx > box.l - 4 && mx < box.r + 4 && my > box.t - 4 && my < box.b + 4) found.push(k);
      }
    });
    // A sentence block is one hit: pick the nearest if a stroke touched several.
    if (isIdea && found.length > 1) found.splice(0, found.length, found.sort((x, y) => Math.abs((rects[x].t + rects[x].b) / 2 - cy) - Math.abs((rects[y].t + rects[y].b) / 2 - cy))[0]);
    found.forEach(k => hits.add(k));
    spans.forEach((s, k) => s.classList.toggle('hit', hits.has(k)));
  }
  const pad = makePad($('canvas', area), { width: 5, onStroke: hitTest });
  $('[data-clear]', el).onclick = () => { pad.clear(); hits.clear(); spans.forEach(s => s.className = 'ci'); $('.fb', el).innerHTML = ''; };
  $('[data-check]', el).onclick = () => {
    if (!hits.size) return toast(isIdea ? 'Underline a sentence first' : 'Circle a word first');
    const extra = [...hits].filter(k => !targetSet.has(k) && (isIdea || !STOPWORDS.has(norm(items[k]))));
    const ok = [...targetSet].every(k => hits.has(k)) && !extra.length;
    tries++;
    const fb = $('.fb', el);
    if (ok || tries >= 2) {
      spans.forEach((s, k) => s.classList.toggle('answer', targetSet.has(k)));
      fb.innerHTML = `<div class="feedback ${ok ? 'good' : 'bad'}"><p>${ok ? 'You got it!' : 'Here is the answer, shown in color.'}</p><button class="btn" data-next><span>NEXT ▶</span></button></div>`;
      Speech.say(ok ? 'You got it!' : 'Here is the answer.');
      $('[data-check]', el).disabled = true;
      $('[data-next]', fb).onclick = () => onDone({ correct: ok && tries === 1, tries });
    } else {
      fb.innerHTML = `<div class="feedback bad"><p>Not quite — clear it and try once more.</p></div>`;
      Speech.say('Not quite. Try once more.');
    }
  };
}

function mountBlank(el, passage, { onDone }) {
  const b = passage.blank;
  let tries = 0;
  el.innerHTML = `
    <div class="task-head"><span class="pill">FILL IN THE BLANK</span></div>
    <div class="q-row">${speakBtn(b.before + ' blank ' + b.after)}<h2 class="q">Type the missing word.</h2></div>
    <p class="blank-line">${esc(b.before)}<span class="gap">______</span>${esc(b.after)}</p>
    <input class="input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Missing word">
    <div class="row wrap-row"><button class="btn" data-check><span>CHECK</span></button></div>
    <div class="fb"></div>`;
  wireSay(el);
  const input = $('input', el);
  const check = () => {
    const got = norm(input.value), want = norm(b.answer);
    if (!got) return toast('Type a word first');
    const ok = got === want || (want.length >= 5 && levenshtein(got, want) <= 1);
    tries++;
    const fb = $('.fb', el);
    if (ok || tries >= 2) {
      $('.gap', el).textContent = b.answer; $('.gap', el).classList.add(ok ? 'right' : 'wrong');
      if (!ok) Store.missWord(b.answer);
      fb.innerHTML = `<div class="feedback ${ok ? 'good' : 'bad'}"><p>${ok ? (got === want ? 'Perfect!' : 'Yes! It is spelled “' + esc(b.answer) + '”.') : 'The word was “' + esc(b.answer) + '”. It goes on your practice list.'}</p><button class="btn" data-next><span>NEXT ▶</span></button></div>`;
      $('[data-check]', el).disabled = true; input.disabled = true;
      $('[data-next]', fb).onclick = () => onDone({ correct: ok && tries === 1, answer: input.value });
    } else {
      fb.innerHTML = `<div class="feedback bad"><p>Try again! Hint: it starts with “${esc(b.answer[0])}”.</p></div>`;
    }
  };
  $('[data-check]', el).onclick = check;
  input.addEventListener('keydown', e => e.key === 'Enter' && check());
}

// Drag sentences into story order (or tap two to swap them).
function mountOrder(el, passage, { onDone }) {
  const right = passage.order;
  let mixed = shuffle(right);
  while (mixed.every((s, k) => s === right[k])) mixed = shuffle(right);
  let tries = 0, picked = null;
  el.innerHTML = `
    <div class="task-head"><span class="pill">PUT IT IN ORDER</span></div>
    <div class="q-row">${speakBtn('Put the sentences in the order they happened in the story.')}<h2 class="q">Drag the sentences into story order.</h2></div>
    <p class="muted">Drag with your finger or stylus — or tap two sentences to swap them.</p>
    <ol class="order-list">${mixed.map(s => `<li class="order-item" data-s="${esc(s)}"><span class="grip">⋮⋮</span><span>${esc(s)}</span></li>`).join('')}</ol>
    <div class="row wrap-row"><button class="btn" data-check><span>CHECK</span></button></div>
    <div class="fb"></div>`;
  wireSay(el);
  const list = $('.order-list', el);
  $$('.order-item', list).forEach(row => {
    let startY = 0, moved = 0, dragging = false;
    row.addEventListener('pointerdown', e => { dragging = true; moved = 0; startY = e.clientY; row.setPointerCapture(e.pointerId); row.classList.add('drag'); });
    row.addEventListener('pointermove', e => {
      if (!dragging) return;
      const gap = 12;
      moved = Math.max(moved, Math.abs(e.clientY - startY));
      const next = row.nextElementSibling, prev = row.previousElementSibling;
      if (next && e.clientY > next.getBoundingClientRect().top + next.offsetHeight / 2) { list.insertBefore(next, row); startY += next.offsetHeight + gap; }
      else if (prev && e.clientY < prev.getBoundingClientRect().top + prev.offsetHeight / 2) { list.insertBefore(prev, row.nextElementSibling); startY -= prev.offsetHeight + gap; }
      row.style.transform = `translateY(${e.clientY - startY}px)`;
    });
    const end = () => {
      if (!dragging) return;
      dragging = false; row.style.transform = ''; row.classList.remove('drag');
      if (moved < 8) { // a tap
        if (!picked) { picked = row; row.classList.add('picked'); }
        else if (picked === row) { row.classList.remove('picked'); picked = null; }
        else {
          const a = picked, b = row, marker = document.createElement('li');
          list.insertBefore(marker, a); list.insertBefore(a, b); list.insertBefore(b, marker); marker.remove();
          a.classList.remove('picked'); picked = null;
        }
      }
    };
    row.addEventListener('pointerup', end);
    row.addEventListener('pointercancel', end);
  });
  $('[data-check]', el).onclick = () => {
    const now = $$('.order-item', list).map(r => r.dataset.s);
    const ok = now.every((s, k) => s === right[k]);
    tries++;
    const fb = $('.fb', el);
    $$('.order-item', list).forEach((r, k) => { r.classList.toggle('right', r.dataset.s === right[k]); r.classList.toggle('wrong', r.dataset.s !== right[k]); });
    if (ok || tries >= 2) {
      if (!ok) { // show the right order
        right.forEach(s => list.appendChild($$('.order-item', list).find(r => r.dataset.s === s)));
        $$('.order-item', list).forEach(r => { r.classList.remove('wrong'); r.classList.add('right'); });
      }
      fb.innerHTML = `<div class="feedback ${ok ? 'good' : 'bad'}"><p>${ok ? 'Perfect order!' : 'Here is the story order.'}</p><button class="btn" data-next><span>NEXT ▶</span></button></div>`;
      $('[data-check]', el).disabled = true;
      $('[data-next]', fb).onclick = () => onDone({ correct: ok && tries === 1 });
    } else fb.innerHTML = `<div class="feedback bad"><p>The green ones are in the right spot. Move the others and check again.</p></div>`;
  };
}

const ROUTES = { home: screenHome, placement: screenPlacement, lesson: screenLesson, review: screenReview, parent: screenParent, colors: screenColors };

function updateTop() {
  const s = Store.state;
  $('#topLevel').textContent = s.placed ? levelName(s.level) : 'NEW';
  $('#homeBtn').classList.toggle('hidden', (location.hash.replace(/^#\/?/, '') || 'home') === 'home');
}

function route() {
  leave();
  Speech.stop();
  $$('.overlay').forEach(o => o.remove());
  const name = location.hash.replace(/^#\/?/, '') || 'home';
  try { (ROUTES[name] || screenHome)(); }
  catch (e) { showProblem(e); }
  updateTop();
  window.scrollTo(0, 0);
}

// A failure shows on screen (with a way home) instead of leaving a page that does nothing.
function showProblem(e) {
  console.error(e);
  view().innerHTML = `<section class="panel center">${icon('apple', 160)}<h1>Something went wrong</h1>
    <p class="lead">${esc((e && e.message) || e)}</p><button class="btn" data-go="home"><span>HOME</span></button></section>`;
}
window.addEventListener('error', e => toast('Problem: ' + e.message));
window.addEventListener('unhandledrejection', e => toast('Problem: ' + ((e.reason && e.reason.message) || e.reason)));

document.addEventListener('click', e => {
  const b = e.target.closest('[data-go]');
  if (!b) return;
  const to = b.dataset.go;
  if (('#/' + to) === location.hash) route(); else go(to);
});

Store.load();
applyTheme();
window.addEventListener('hashchange', route);
route();
Model.ping().then(() => {
  const ms = $('#modelStatus');
  if (ms) ms.innerHTML = modelStatus();
  prefetch();
});

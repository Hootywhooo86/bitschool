const ROUTES = { home: screenHome, placement: screenPlacement, lesson: screenLesson, review: screenReview, parent: screenParent, colors: screenColors };

function updateTop() {
  const s = Store.state;
  $('#topLevel').textContent = s.placed ? levelName(s.level) : 'NEW';
  $('#homeBtn').classList.toggle('hidden', (location.hash.replace(/^#\/?/, '') || 'home') === 'home');
}

function route() {
  leave();
  if (window.speechSynthesis) speechSynthesis.cancel();
  $$('.overlay').forEach(o => o.remove());
  const name = location.hash.replace(/^#\/?/, '') || 'home';
  (ROUTES[name] || screenHome)();
  updateTop();
  window.scrollTo(0, 0);
}

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

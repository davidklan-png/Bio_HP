/* Site-wide JS: theme toggle, nav active state, scroll fade-in */
(function () {
  const STORAGE_KEY = 'kk-theme';
  const root = document.documentElement;

  // Apply saved theme early
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') {
    root.setAttribute('data-theme', saved);
  } else {
    root.setAttribute('data-theme', 'dark');
  }

  function setTheme(t) {
    root.setAttribute('data-theme', t);
    localStorage.setItem(STORAGE_KEY, t);
    updateThemeBtn();
  }

  function updateThemeBtn() {
    const btn = document.querySelector('[data-theme-toggle]');
    if (!btn) return;
    const cur = root.getAttribute('data-theme');
    btn.setAttribute('aria-label', cur === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    btn.innerHTML = cur === 'dark'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  }

  document.addEventListener('DOMContentLoaded', function () {
    updateThemeBtn();
    const btn = document.querySelector('[data-theme-toggle]');
    if (btn) btn.addEventListener('click', function () {
      const cur = root.getAttribute('data-theme');
      setTheme(cur === 'dark' ? 'light' : 'dark');
    });

    // Mark active nav link
    const path = window.location.pathname.replace(/\/index\.html$/, '/').replace(/\/$/, '') || '/';
    document.querySelectorAll('.nav__link').forEach(function (a) {
      const href = a.getAttribute('href') || '';
      const norm = href.replace(/\/index\.html$/, '/').replace(/\/$/, '') || '/';
      if (norm === path) a.classList.add('is-active');
    });

    // Scroll-fade-in
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('[data-fade]').forEach(function (el) { io.observe(el); });
  });
})();

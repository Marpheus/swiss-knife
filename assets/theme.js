/* Theme toggle and the entrance animation. Same behaviour as marpheus.dev,
   generalised to bind to whichever .theme button a page happens to have. */
(function () {
  var root = document.documentElement;

  function current() {
    if (root.dataset.theme) return root.dataset.theme;
    return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function apply(theme) {
    root.dataset.theme = theme;
    try {
      localStorage.setItem('theme', theme);
    } catch (e) {}
    document.querySelectorAll('.theme').forEach(function (b) {
      b.setAttribute('aria-pressed', String(theme === 'light'));
    });
  }

  document.querySelectorAll('.theme').forEach(function (btn) {
    btn.setAttribute('aria-pressed', String(current() === 'light'));
    btn.addEventListener('click', function () {
      apply(current() === 'light' ? 'dark' : 'light');
    });
  });

  /* stagger the entrance in source order — the delay lives in a custom
     property because a CSP without 'unsafe-inline' rules out style attributes,
     and setting it through CSSOM is not subject to that restriction. */
  var revealed = document.querySelectorAll('[data-reveal]');
  revealed.forEach(function (el, i) {
    el.style.setProperty('--i', i);
  });

  requestAnimationFrame(function () {
    root.classList.add('ready');
  });
})();

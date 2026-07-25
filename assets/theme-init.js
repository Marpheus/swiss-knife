/* Runs blocking in <head>, before the first paint, so a chosen theme never
   flashes the other one. Kept in its own file because the CSP on every page
   forbids inline scripts. */
(function () {
  document.documentElement.classList.add('js');
  try {
    var t = localStorage.getItem('theme');
    if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  } catch (e) {}
})();

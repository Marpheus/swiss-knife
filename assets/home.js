/* The homepage: one row per tool, plus a filter.
   Runs before theme.js so the generated list takes part in the stagger. */
(function () {
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };

  var host = document.getElementById('tools');
  if (!host || !window.SK) return;

  host.innerHTML = '<ul class="cards" data-reveal>' + SK.tools.map(card).join('') + '</ul>';

  function card(t) {
    return (
      '<li class="card"' +
      ' data-hay="' +
      esc((t.name + ' ' + t.slug + ' ' + t.note + ' ' + (t.keys || '')).toLowerCase()) +
      '">' +
      '<a href="/' +
      esc(t.slug) +
      '/">' +
      '<span class="card-title">' +
      esc(t.name) +
      '</span>' +
      '<span class="card-note">' +
      esc(t.note) +
      '</span>' +
      '</a></li>'
    );
  }

  /* ── filter ──────────────────────────────────────────────────── */

  var input = document.getElementById('find');
  var counter = document.getElementById('find-count');
  var none = document.getElementById('no-hits');
  var cards = Array.from(host.querySelectorAll('.card'));

  function filter() {
    var q = input.value.trim().toLowerCase();
    var shown = 0;

    cards.forEach(function (li) {
      var hit = !q || li.dataset.hay.indexOf(q) !== -1;
      li.hidden = !hit;
      if (hit) shown++;
    });

    none.hidden = shown > 0;
    counter.textContent = q ? shown + '/' + cards.length : '';
  }

  input.addEventListener('input', filter);

  /* typing anywhere on the page lands in the filter — the page is a search box */
  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape' && input.value) {
      input.value = '';
      filter();
      return;
    }
    if (document.activeElement === input) return;
    if (e.key.length === 1 && /\S/.test(e.key)) {
      input.focus();
    }
  });

  /* ↵ in the filter opens the first hit */
  input.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var first = host.querySelector('.card:not([hidden]) a[href]');
    if (first) location.href = first.getAttribute('href');
  });
})();

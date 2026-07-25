/* The homepage: one section per group, one row per tool, plus a filter.
   Runs before theme.js so the generated sections take part in the stagger. */
(function () {
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };

  var host = document.getElementById('groups');
  if (!host || !window.SK) return;

  host.innerHTML = SK.groups.map(function (g) {
    var tools = SK.tools.filter(function (t) { return t.group === g.id; });
    if (!tools.length) return '';
    var live = tools.filter(function (t) { return t.status === 'live'; }).length;

    return '<section class="group" data-reveal data-group="' + esc(g.id) + '">' +
      '<h2 class="section-title">' +
        '<span>' + esc(g.title) + '</span>' +
        '<span class="rule" aria-hidden="true"></span>' +
        '<span class="count">' + pad(live) + '/' + pad(tools.length) + '</span>' +
      '</h2>' +
      '<ul class="cards">' + tools.map(card).join('') + '</ul>' +
    '</section>';
  }).join('');

  function card(t) {
    var soon = t.status !== 'live';
    /* no href on the unbuilt ones: they shouldn't be focusable or clickable */
    var open = soon ? '<a aria-disabled="true">' : '<a href="/' + esc(t.slug) + '/">';
    return '<li class="card"' + (soon ? ' data-soon' : '') +
      ' data-hay="' + esc((t.name + ' ' + t.slug + ' ' + t.note + ' ' + (t.keys || '')).toLowerCase()) + '">' +
      open +
        '<span class="card-title">' + esc(t.name) + '</span>' +
        '<span class="card-note">' + esc(t.note) + '</span>' +
        '<span class="card-meta">' + (soon ? 'soon' : 'live') + '</span>' +
      '</a></li>';
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  /* ── filter ──────────────────────────────────────────────────── */

  var input = document.getElementById('find');
  var counter = document.getElementById('find-count');
  var none = document.getElementById('no-hits');
  var cards = Array.from(host.querySelectorAll('.card'));
  var sections = Array.from(host.querySelectorAll('.group'));

  function filter() {
    var q = input.value.trim().toLowerCase();
    var shown = 0;

    cards.forEach(function (li) {
      var hit = !q || li.dataset.hay.indexOf(q) !== -1;
      li.hidden = !hit;
      if (hit) shown++;
    });

    /* a section with nothing left in it goes too */
    sections.forEach(function (s) {
      s.hidden = !s.querySelector('.card:not([hidden])');
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

  /* ↵ in the filter opens the first live hit */
  input.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var first = host.querySelector('.card:not([hidden]):not([data-soon]) a[href]');
    if (first) location.href = first.getAttribute('href');
  });
})();

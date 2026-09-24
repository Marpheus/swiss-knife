/* regex — pattern, matches, groups, replace preview.

   Everything that could take unbounded time runs in a worker with a deadline
   (see regex-worker.js); the main thread only compiles the pattern, which is
   cheap and gives a good syntax error for free. */
(function () {
  var ui = SK.ui,
    B = SK.bytes;
  var $ = ui.$;

  var els = {
    pattern: $('#pattern'),
    flags: $('#flags'),
    input: $('#in'),
    hl: $('#hl'),
    groups: $('#groups-view'),
    replaced: $('#replaced'),
    replacement: $('#replacement'),
    replaceField: $('#replace-field'),
    label: $('#out-label'),
    count: $('#hit-count'),
    size: $('#in-size')
  };

  var store = ui.store('regex');
  var status = ui.status($('#status'));
  var view = store.get('view', 'matches');
  var last = null; /* the most recent result, for copy */
  var gutter = ui.gutter(els.input);

  var DEADLINE = 1500; /* ms before we assume the pattern has run away */
  var RENDER_CAP = 120000; /* characters of highlighted text we will build */

  var SAMPLE = {
    pattern: '(?<user>[\\w.+-]+)@(?<host>[\\w-]+\\.[\\w.]+)',
    flags: 'gi',
    text:
      'Ping ada@example.com or Grace.Hopper+navy@navy.mil.\n' +
      'Not an address: @nope, mail@, a b@c.\n' +
      '\\w is ascii only, so this one is skipped: jánoš@čsfd.cz'
  };

  /* ── the worker, and the fallback when there cannot be one ───── */

  var worker = null;
  var workerBroken = false; /* file:// origins cannot spawn one */
  var seq = 0;
  var pending = 0;
  var timer = null;

  function spawn() {
    if (worker || workerBroken) return worker;
    try {
      worker = new Worker('/regex/regex-worker.js');
      worker.onmessage = function (e) {
        clearTimeout(timer);
        pending = 0;
        e.data.ok ? show(e.data.result) : status.err(e.data.error);
      };
      worker.onerror = function () {
        /* most likely the file could not be loaded at all */
        workerBroken = true;
        worker = null;
        clearTimeout(timer);
        run();
      };
    } catch (e) {
      workerBroken = true;
    }
    return worker;
  }

  function dispatch(job) {
    if (workerBroken || !spawn()) {
      /* no safety net available: run inline and accept the risk */
      try {
        show(inline(job));
      } catch (e) {
        status.err(e.message);
      }
      return;
    }
    clearTimeout(timer);
    var id = ++seq;
    pending = id;
    worker.postMessage(job);
    timer = setTimeout(function () {
      if (pending !== id) return;
      worker.terminate();
      worker = null;
      pending = 0;
      last = null;
      status.err('the pattern is taking too long — it probably backtracks catastrophically');
      status.stats({});
    }, DEADLINE);
  }

  /* same logic as the worker, used only when a worker is impossible */
  function inline(job) {
    var flags = job.flags.indexOf('g') === -1 ? job.flags + 'g' : job.flags;
    var re = new RegExp(job.pattern, flags),
      m,
      out = [];
    while ((m = re.exec(job.text)) !== null) {
      out.push({
        index: m.index,
        end: m.index + m[0].length,
        text: m[0],
        groups: Array.prototype.slice.call(m, 1),
        named: m.groups ? Object.assign({}, m.groups) : null
      });
      if (m[0] === '') re.lastIndex++;
      if (out.length >= 5000) break;
      if (job.flags.indexOf('g') === -1) break;
    }
    return {
      matches: out,
      truncated: out.length >= 5000,
      replaced:
        job.replacement == null
          ? null
          : job.text.replace(new RegExp(job.pattern, job.flags), job.replacement)
    };
  }

  /* ── run ─────────────────────────────────────────────────────── */

  function run() {
    var pattern = els.pattern.value;
    var flags = els.flags.value;
    var text = els.input.value;

    store.set('pattern', pattern);
    store.set('flags', flags);
    store.set('input', text);
    store.set('replacement', els.replacement.value);
    els.size.textContent = text ? B.human(B.fromText(text).length) : '';
    gutter.set(text);

    if (!pattern) {
      last = null;
      clear();
      status.info('write a pattern to begin');
      status.stats({});
      return;
    }

    /* compiling is safe — only matching can run away */
    try {
      new RegExp(pattern, flags);
    } catch (e) {
      last = null;
      clear();
      status.err(String(e.message).replace(/^Invalid regular expression:?\s*/, ''));
      status.stats({});
      return;
    }

    if (!text) {
      last = null;
      clear();
      status.info('pattern compiles — add some text to test it against');
      status.stats({});
      return;
    }

    dispatch({
      pattern: pattern,
      flags: flags,
      text: text,
      replacement: view === 'replace' ? els.replacement.value : null
    });
  }

  function clear() {
    els.hl.textContent = '';
    els.groups.textContent = '';
    els.replaced.textContent = '';
    els.count.textContent = '';
  }

  function show(res) {
    last = res;
    var n = res.matches.length;
    els.count.textContent =
      n + (n === 1 ? ' match' : ' matches') + (res.truncated ? ' (capped)' : '');

    if (view === 'matches') renderHighlight(res);
    else if (view === 'groups') renderGroups(res);
    else els.replaced.textContent = res.replaced == null ? '' : res.replaced;

    if (!n) {
      status.info('no matches');
    } else if (res.truncated) {
      status.info('showing the first ' + n + ' matches');
    } else {
      status.ok(n + (n === 1 ? ' match' : ' matches'));
    }

    var groupCount = n ? res.matches[0].groups.length : 0;
    status.stats({
      matches: n,
      groups: groupCount,
      covered: n ? pct(res) + '%' : '0%'
    });
  }

  function pct(res) {
    var chars = res.matches.reduce(function (a, m) {
      return a + m.text.length;
    }, 0);
    return Math.round((chars / Math.max(els.input.value.length, 1)) * 100);
  }

  /* ── views ───────────────────────────────────────────────────── */

  function renderHighlight(res) {
    var text = els.input.value;
    var capped = text.length > RENDER_CAP;
    var limit = capped ? RENDER_CAP : text.length;

    var html = '';
    var at = 0;
    for (var i = 0; i < res.matches.length; i++) {
      var m = res.matches[i];
      if (m.index >= limit) break;
      html += ui.esc(text.slice(at, m.index));
      /* alternate the style so two touching matches stay distinguishable */
      html +=
        '<mark class="' +
        (i % 2 ? 'alt' : '') +
        '" title="match ' +
        (i + 1) +
        ' at ' +
        m.index +
        '">' +
        (m.text === '' ? '&#8203;' : ui.esc(m.text)) +
        '</mark>';
      at = Math.max(m.end, m.index);
    }
    html += ui.esc(text.slice(at, limit));
    if (capped)
      html += '\n\n… the rest is not highlighted (text over ' + RENDER_CAP + ' characters)';
    els.hl.innerHTML = html;
  }

  function renderGroups(res) {
    if (!res.matches.length) {
      els.groups.innerHTML = '<p class="p-none">no matches</p>';
      return;
    }
    var names = res.matches[0].named ? Object.keys(res.matches[0].named) : [];
    var arity = res.matches[0].groups.length;

    var head = '<tr><th>#</th><th>at</th><th>match</th>';
    for (var g = 0; g < arity; g++) {
      var nm = names.length === arity ? names[g] : null;
      head += '<th>' + (nm ? ui.esc(nm) : '$' + (g + 1)) + '</th>';
    }
    head += '</tr>';

    var rows = res.matches
      .map(function (m, i) {
        var tds =
          '<td class="k">' +
          (i + 1) +
          '</td><td class="k">' +
          m.index +
          '</td>' +
          '<td>' +
          cell(m.text) +
          '</td>';
        for (var g = 0; g < arity; g++) tds += '<td>' + cell(m.groups[g]) + '</td>';
        return '<tr>' + tds + '</tr>';
      })
      .join('');

    els.groups.innerHTML =
      '<table class="kv"><thead>' + head + '</thead><tbody>' + rows + '</tbody></table>';
  }

  function cell(v) {
    if (v === undefined) return '<span class="muted">undefined</span>';
    if (v === '') return '<span class="muted">empty</span>';
    return ui.esc(v);
  }

  /* ── view switching ──────────────────────────────────────────── */

  ui.$$('.seg [data-view]').forEach(function (b) {
    b.addEventListener('click', function () {
      view = b.dataset.view;
      store.set('view', view);
      syncView();
      run();
    });
  });

  function syncView() {
    ui.$$('.seg [data-view]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.view === view));
    });
    els.hl.hidden = view !== 'matches';
    els.groups.hidden = view !== 'groups';
    els.replaced.hidden = view !== 'replace';
    els.replaceField.hidden = view !== 'replace';
    els.label.textContent = view;
  }

  /* ── wiring ──────────────────────────────────────────────────── */

  var go = ui.debounce(run, 160);
  [els.pattern, els.flags, els.input, els.replacement].forEach(function (el) {
    el.addEventListener('input', go);
  });

  $('#sample').addEventListener('click', function () {
    els.pattern.value = SAMPLE.pattern;
    els.flags.value = SAMPLE.flags;
    els.input.value = SAMPLE.text;
    run();
  });

  $('#clear').addEventListener('click', function () {
    els.input.value = '';
    store.set('input', '');
    run();
    els.input.focus();
  });

  $('#copy').addEventListener('click', function () {
    if (!last) return ui.toast('nothing to copy');
    if (view === 'replace') return ui.copy(last.replaced || '');
    if (view === 'matches')
      return ui.copy(
        last.matches
          .map(function (m) {
            return m.text;
          })
          .join('\n')
      );
    /* groups copy as tab-separated rows, ready to paste into a sheet */
    ui.copy(
      last.matches
        .map(function (m) {
          return [m.index, m.text]
            .concat(
              m.groups.map(function (g) {
                return g === undefined ? '' : g;
              })
            )
            .join('\t');
        })
        .join('\n')
    );
  });

  ui.acceptDrop($('#in-pane'), function (file) {
    ui.readText(file).then(function (t) {
      els.input.value = t;
      run();
    });
  });

  ui.keys({ 'mod+enter': run });

  /* ── restore ─────────────────────────────────────────────────── */

  els.pattern.value = store.get('pattern', '');
  els.flags.value = store.get('flags', 'g');
  els.input.value = store.get('input', '');
  els.replacement.value = store.get('replacement', '');
  syncView();
  run();
})();

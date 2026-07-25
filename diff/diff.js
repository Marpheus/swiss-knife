/* diff — compare two texts.

   The comparison itself is SK.myers (assets/myers.js); this file is the
   presentation: hunks with context, side-by-side or unified, word-level
   emphasis inside a changed line, and a unified patch for the clipboard. */
(function () {
  var ui = SK.ui, B = SK.bytes;
  var $ = ui.$;

  var els = {
    a: $('#a'), b: $('#b'),
    out: $('#diff'),
    tally: $('#tally'),
    aSize: $('#a-size'), bSize: $('#b-size'),
    ws: $('#ws'), cs: $('#case'), all: $('#all')
  };

  var store = ui.store('diff');
  var status = ui.status($('#status'));
  var layout = store.get('layout', 'unified');
  var grain = store.get('grain', 'line');
  var patch = '';

  var CONTEXT = 3;        /* unchanged lines kept either side of a change */
  var MAX_D = 3000;       /* edit distance past which we stop looking */

  var gutters = { a: ui.gutter(els.a), b: ui.gutter(els.b) };

  var SAMPLE = {
    a: 'server:\n  host: localhost\n  port: 8080\n  tls: false\n\nlogging:\n  level: info\n  format: text\n\nfeatures:\n  - search\n  - export\n',
    b: 'server:\n  host: 0.0.0.0\n  port: 8443\n  tls: true\n\nlogging:\n  level: debug\n  format: json\n  colour: auto\n\nfeatures:\n  - search\n  - export\n  - webhooks\n'
  };

  function myers(a, b) { return SK.myers(a, b, MAX_D); }

  /* ── comparison keys ─────────────────────────────────────────── */

  /* The diff runs over normalised copies so "ignore whitespace" and
     "ignore case" change what counts as equal without changing what is shown. */
  function norm(s) {
    var out = s;
    if (els.ws.checked) out = out.replace(/\s+/g, ' ').trim();
    if (els.cs.checked) out = out.toLowerCase();
    return out;
  }

  /* ── run ─────────────────────────────────────────────────────── */

  function run() {
    var aText = els.a.value, bText = els.b.value;
    store.set('a', aText);
    store.set('b', bText);
    els.aSize.textContent = aText ? lines(aText).length + ' lines' : '';
    els.bSize.textContent = bText ? lines(bText).length + ' lines' : '';
    gutters.a.set(aText);
    gutters.b.set(bText);

    if (!aText && !bText) {
      els.out.textContent = '';
      els.tally.textContent = '';
      patch = '';
      status.clear();
      status.stats({});
      return;
    }

    grain === 'word' ? runWords(aText, bText) : runLines(aText, bText);
  }

  function lines(t) {
    var arr = t.split('\n');
    /* a trailing newline is a terminator, not an empty final line */
    if (arr.length > 1 && arr[arr.length - 1] === '') arr.pop();
    return arr;
  }

  function runLines(aText, bText) {
    var A = lines(aText), Bl = lines(bText);
    var script = myers(A.map(norm), Bl.map(norm));

    if (script === null) {
      els.out.innerHTML = '<div class="gap">these two are too different to line up — ' +
        'showing them as one wholesale replacement</div>';
      renderRows(A.map(function (_, i) { return { op: -1, ai: i, bi: null }; })
        .concat(Bl.map(function (_, i) { return { op: 1, ai: null, bi: i }; })), A, Bl);
      status.info('too far apart for a line-by-line diff');
      status.stats({ '−': A.length, '+': Bl.length });
      return;
    }

    var adds = 0, dels = 0;
    script.forEach(function (e) { if (e.op === 1) adds++; else if (e.op === -1) dels++; });

    renderRows(script, A, Bl);
    buildPatch(script, A, Bl);

    els.tally.innerHTML = '<span class="tag ok">+' + adds + '</span> ' +
                          '<span class="tag err">−' + dels + '</span>';
    if (!adds && !dels) status.ok(aText === bText ? 'identical' : 'identical, once the ignored differences are set aside');
    else status.info(adds + ' added, ' + dels + ' removed');
    status.stats({ before: A.length, after: Bl.length });
  }

  /* word mode diffs the whole text as a token stream instead of by line */
  function runWords(aText, bText) {
    var A = tokens(aText), Bt = tokens(bText);
    var script = myers(A.map(norm), Bt.map(norm));

    if (script === null) {
      status.info('too far apart to compare word by word');
      status.stats({});
      els.out.textContent = '';
      return;
    }

    var html = '', adds = 0, dels = 0;
    script.forEach(function (e) {
      if (e.op === 0) html += ui.esc(A[e.ai]);
      else if (e.op === 1) { adds++; html += '<ins>' + ui.esc(Bt[e.bi]) + '</ins>'; }
      else { dels++; html += '<del>' + ui.esc(A[e.ai]) + '</del>'; }
    });

    els.out.className = 'diff';
    els.out.innerHTML = '<div class="wordflow">' + html + '</div>';
    patch = bText;
    els.tally.innerHTML = '<span class="tag ok">+' + adds + '</span> ' +
                          '<span class="tag err">−' + dels + '</span>';
    status.info(adds + ' words added, ' + dels + ' removed');
    status.stats({ before: A.length + ' tokens', after: Bt.length + ' tokens' });
  }

  /* keep the separators as tokens so the text can be rebuilt exactly */
  function tokens(t) {
    return t.split(/(\s+|\b)/).filter(function (s) { return s !== ''; });
  }

  /* ── rendering ───────────────────────────────────────────────── */

  function renderRows(script, A, Bl) {
    var groups = els.all.checked ? [{ from: 0, to: script.length }] : hunks(script);
    var html = '';
    var shown = 0;

    groups.forEach(function (g, gi) {
      if (gi === 0 && g.from > 0) html += gapRow(g.from);
      else if (gi > 0) html += gapRow(g.from - groups[gi - 1].to);

      chunk(script.slice(g.from, g.to)).forEach(function (c) {
        if (c.t === 'eq') {
          html += layout === 'split'
            ? splitRow(c.e.ai, ui.esc(A[c.e.ai]), c.e.bi, ui.esc(Bl[c.e.bi]), 'eq', 'eq')
            : uniRow(c.e.ai, c.e.bi, 'eq', ui.esc(A[c.e.ai]));
          return;
        }

        /* Removals and additions at the same position within a changed block
           are usually the same line edited, so they are paired and the words
           that moved get marked. Pairing positionally matters: taking "the
           removal just before this addition" would match the last removed
           line with the first added one, which is rarely the right pair. */
        var pairs = pairUp(c.dels, c.adds, A, Bl);

        if (layout === 'split') {
          pairs.forEach(function (p) {
            html += splitRow(
              p.del ? p.del.ai : null,
              p.del ? (p.mark ? p.mark.a : ui.esc(A[p.del.ai])) : null,
              p.add ? p.add.bi : null,
              p.add ? (p.mark ? p.mark.b : ui.esc(Bl[p.add.bi])) : null,
              p.del ? 'del' : 'void', p.add ? 'add' : 'void');
          });
        } else {
          /* unified keeps git's order: everything removed, then everything added */
          pairs.forEach(function (p) {
            if (p.del) html += uniRow(p.del.ai, null, 'del',
              p.mark ? p.mark.a : ui.esc(A[p.del.ai]));
          });
          pairs.forEach(function (p) {
            if (p.add) html += uniRow(null, p.add.bi, 'add',
              p.mark ? p.mark.b : ui.esc(Bl[p.add.bi]));
          });
        }
      });
    });

    if (groups.length && groups[groups.length - 1].to < script.length) {
      html += gapRow(script.length - groups[groups.length - 1].to);
    }
    if (!html) html = '<div class="gap">no differences</div>';

    els.out.className = 'diff' + (layout === 'split' ? ' split' : '');
    els.out.innerHTML = html;
  }

  /* a run of changes collected together, so a block can be judged as a whole */
  function chunk(entries) {
    var out = [], i = 0;
    while (i < entries.length) {
      if (entries[i].op === 0) { out.push({ t: 'eq', e: entries[i] }); i++; continue; }
      var dels = [], adds = [];
      while (i < entries.length && entries[i].op !== 0) {
        (entries[i].op === -1 ? dels : adds).push(entries[i]);
        i++;
      }
      out.push({ t: 'ch', dels: dels, adds: adds });
    }
    return out;
  }

  function pairUp(dels, adds, A, Bl) {
    var out = [];
    var n = Math.max(dels.length, adds.length);
    for (var i = 0; i < n; i++) {
      var d = dels[i] || null, a = adds[i] || null;
      out.push({ del: d, add: a, mark: d && a ? intraline(A[d.ai], Bl[a.bi]) : null });
    }
    return out;
  }

  function uniRow(ai, bi, cls, body) {
    return '<div class="row ' + cls + '">' +
      '<span class="ln">' + (ai === null ? '' : ai + 1) + '</span>' +
      '<span class="ln">' + (bi === null ? '' : bi + 1) + '</span>' +
      '<span class="tx">' + body + '</span></div>';
  }

  /* aHtml and bHtml arrive already escaped — the caller may have marked them */
  function splitRow(ai, aHtml, bi, bHtml, aCls, bCls) {
    return '<div class="row">' +
      '<span class="ln">' + (ai === null ? '' : ai + 1) + '</span>' +
      '<span class="tx ' + aCls + '">' + (aHtml || '') + '</span>' +
      '<span class="ln">' + (bi === null ? '' : bi + 1) + '</span>' +
      '<span class="tx ' + bCls + '">' + (bHtml || '') + '</span></div>';
  }

  function gapRow(n) {
    return n > 0 ? '<div class="gap">⋯ ' + n + ' unchanged ' + (n === 1 ? 'line' : 'lines') + '</div>' : '';
  }

  /* Which words inside a changed line actually changed — or null when the two
     lines have too little in common to be one edit, in which case marking
     them would scatter noise across two unrelated lines. The diff itself
     decides: it knows exactly how much of the text survived. */
  var SAME_ENOUGH = 0.3;

  function intraline(aLine, bLine) {
    if (aLine == null || bLine == null) return null;
    var A = tokens(aLine), Bt = tokens(bLine);
    /* on a very long line the token diff would dominate the frame */
    if (A.length + Bt.length > 800) return null;

    var script = myers(A.map(norm), Bt.map(norm));
    if (script === null) return null;

    var outA = '', outB = '', kept = 0;
    script.forEach(function (e) {
      if (e.op === 0) {
        outA += ui.esc(A[e.ai]);
        outB += ui.esc(Bt[e.bi]);
        kept += A[e.ai].length;
      } else if (e.op === -1) {
        outA += '<del>' + ui.esc(A[e.ai]) + '</del>';
      } else {
        outB += '<ins>' + ui.esc(Bt[e.bi]) + '</ins>';
      }
    });

    var total = aLine.length + bLine.length;
    if (!total || (2 * kept) / total < SAME_ENOUGH) return null;
    return { a: outA, b: outB };
  }

  /* the runs worth showing: every change, plus CONTEXT lines around it */
  function hunks(script) {
    var out = [];
    var i = 0;
    while (i < script.length) {
      if (script[i].op === 0) { i++; continue; }
      var from = Math.max(0, i - CONTEXT);
      var to = i;
      /* extend while changes keep coming within twice the context */
      while (to < script.length) {
        if (script[to].op !== 0) { to++; continue; }
        var run = 0;
        while (to + run < script.length && script[to + run].op === 0) run++;
        if (run > CONTEXT * 2 || to + run >= script.length) break;
        to += run;
      }
      to = Math.min(script.length, to + CONTEXT);
      if (out.length && from <= out[out.length - 1].to) out[out.length - 1].to = to;
      else out.push({ from: from, to: to });
      i = to;
    }
    return out;
  }

  /* ── unified patch, for the clipboard ────────────────────────── */

  function buildPatch(script, A, Bl) {
    var groups = hunks(script);
    if (!groups.length) { patch = ''; return; }

    var lines = ['--- before', '+++ after'];
    groups.forEach(function (g) {
      var aStart = null, bStart = null, aCount = 0, bCount = 0;
      var body = [];
      for (var i = g.from; i < g.to; i++) {
        var e = script[i];
        if (e.ai !== null && aStart === null) aStart = e.ai;
        if (e.bi !== null && bStart === null) bStart = e.bi;
        if (e.op === 0) { body.push(' ' + A[e.ai]); aCount++; bCount++; }
        else if (e.op === -1) { body.push('-' + A[e.ai]); aCount++; }
        else { body.push('+' + Bl[e.bi]); bCount++; }
      }
      lines.push('@@ -' + ((aStart === null ? 0 : aStart + 1)) + ',' + aCount +
                 ' +' + ((bStart === null ? 0 : bStart + 1)) + ',' + bCount + ' @@');
      lines.push.apply(lines, body);
    });
    patch = lines.join('\n') + '\n';
  }

  /* ── wiring ──────────────────────────────────────────────────── */

  ui.$$('.seg [data-layout]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      layout = btn.dataset.layout;
      store.set('layout', layout);
      sync();
      run();
    });
  });
  ui.$$('.seg [data-grain]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      grain = btn.dataset.grain;
      store.set('grain', grain);
      sync();
      run();
    });
  });

  function sync() {
    ui.$$('.seg [data-layout]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.layout === layout));
    });
    ui.$$('.seg [data-grain]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.grain === grain));
    });
    /* the layout switch has nothing to act on when diffing word by word */
    ui.$$('.seg [data-layout]').forEach(function (b) { b.disabled = grain === 'word'; });
  }

  var go = ui.debounce(run, 160);
  els.a.addEventListener('input', go);
  els.b.addEventListener('input', go);
  [els.ws, els.cs, els.all].forEach(function (box) {
    box.addEventListener('change', function () {
      store.set(box.id, box.checked ? '1' : '');
      run();
    });
  });

  $('#swap').addEventListener('click', function () {
    var t = els.a.value;
    els.a.value = els.b.value;
    els.b.value = t;
    run();
  });
  $('#sample').addEventListener('click', function () {
    els.a.value = SAMPLE.a;
    els.b.value = SAMPLE.b;
    run();
  });
  $('#copy').addEventListener('click', function () {
    if (!patch) return ui.toast('nothing to copy');
    ui.copy(patch);
  });
  $('#clear').addEventListener('click', function () {
    els.a.value = '';
    els.b.value = '';
    store.set('a', ''); store.set('b', '');
    run();
    els.a.focus();
  });

  ui.acceptDrop($('#a-pane'), function (f) {
    ui.readText(f).then(function (t) { els.a.value = t; run(); });
  });
  ui.acceptDrop($('#b-pane'), function (f) {
    ui.readText(f).then(function (t) { els.b.value = t; run(); });
  });

  ui.keys({
    'mod+enter': run,
    'mod+shift+c': function () { ui.copy(patch); }
  });

  /* ── restore ─────────────────────────────────────────────────── */

  els.ws.checked = store.get('ws', '') === '1';
  els.cs.checked = store.get('case', '') === '1';
  els.all.checked = store.get('all', '') === '1';
  els.a.value = store.get('a', '');
  els.b.value = store.get('b', '');
  sync();
  run();
})();

/* json — format, minify, validate, browse.

   The interesting part is the error reporting. Engines describe a broken
   document badly and differently from each other, so when JSON.parse rejects
   one we walk it ourselves (see scan) to find out where and why, then mark
   that line in the gutter. */
(function () {
  var ui = SK.ui, B = SK.bytes;
  var $ = ui.$;

  var els = {
    input:   $('#in'),
    out:     $('#out'),
    tree:    $('#tree'),
    label:   $('#out-label'),
    indent:  $('#indent'),
    indentF: $('#indent-field'),
    sort:    $('#sort'),
    size:    $('#in-size'),
    wrap:    $('#wrap-toggle')
  };

  var store = ui.store('json');
  var status = ui.status($('#status'));
  var mode = store.get('mode', 'format');
  var lastText = '';   /* what copy and download hand over */

  var lines = { in: ui.gutter(els.input), out: ui.gutter(els.out) };

  var SAMPLE = JSON.stringify({
    id: 'a3f1',
    name: 'swiss-knife',
    offline: true,
    tools: ['json', 'regex', 'base64', 'jwt', 'diff'],
    limits: { maxUploadBytes: 0, telemetry: null },
    updated: '2026-07-25T09:12:00Z'
  }, null, 2);

  /* ── mode switching ──────────────────────────────────────────── */

  ui.$$('.seg [data-mode]').forEach(function (b) {
    b.addEventListener('click', function () {
      mode = b.dataset.mode;
      store.set('mode', mode);
      syncMode();
      run();
    });
  });

  function syncMode() {
    ui.$$('.seg [data-mode]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
    });
    /* indent and key order only mean something when we re-print the document */
    var reprints = mode === 'format' || mode === 'tree';
    els.indentF.hidden = mode !== 'format';
    els.sort.closest('.opt').hidden = !reprints;

    var treeMode = mode === 'tree';
    els.tree.hidden = !treeMode;
    els.out.hidden = treeMode;
    els.label.textContent = treeMode ? 'tree' : 'output';
    syncOutGutter();
  }

  /* the output numbers only line up while the output is unwrapped text, and
     numbering the placeholder of an empty pane is just noise */
  function syncOutGutter() {
    lines.out.show(mode !== 'tree' &&
                   !els.out.classList.contains('wrap-on') &&
                   els.out.textContent !== '');
  }

  function setOut(text) {
    els.out.textContent = text;
    lines.out.set(text);
    syncOutGutter();
  }

  /* ── the work ────────────────────────────────────────────────── */

  function run() {
    var text = els.input.value;
    store.set('input', text);
    els.size.textContent = text ? B.human(B.fromText(text).length) : '';
    lines.in.set(text);
    lines.in.flag(null);

    if (!text.trim()) {
      lastText = '';
      setOut('');
      els.tree.textContent = '';
      status.clear();
      status.stats({});
      return;
    }

    if (mode === 'stringify') {
      /* the input is treated as raw text here, not as json */
      lastText = JSON.stringify(text);
      setOut(lastText);
      status.ok('escaped as a json string');
      status.stats({ chars: lastText.length });
      return;
    }

    if (mode === 'parse') {
      var quoted = text.trim();
      /* accept a bare escaped body as well as a properly quoted literal */
      if (quoted[0] !== '"') quoted = '"' + quoted.replace(/"/g, '\\"') + '"';
      try {
        var unescaped = JSON.parse(quoted);
        if (typeof unescaped !== 'string') throw new Error('that is not a string literal');
        lastText = unescaped;
        setOut(lastText);
        status.ok('unescaped');
        status.stats({ chars: lastText.length });
      } catch (e) {
        fail(text, e);
      }
      return;
    }

    var value;
    try {
      value = JSON.parse(text);
    } catch (e) {
      fail(text, e);
      return;
    }

    if (els.sort.checked) value = sortKeys(value);

    var report = describe(value);

    if (mode === 'minify') {
      lastText = JSON.stringify(value);
      setOut(lastText);
    } else if (mode === 'format') {
      var ind = els.indent.value === '\\t' ? '\t' : Number(els.indent.value);
      lastText = JSON.stringify(value, null, ind);
      setOut(lastText);
    } else {
      lastText = JSON.stringify(value, null, 2);
      renderTree(value);
    }

    status.ok('valid json');
    status.stats({
      type: report.type,
      nodes: report.nodes,
      depth: report.depth,
      out: B.human(B.fromText(lastText).length)
    });
  }

  function fail(text, err) {
    lastText = '';
    setOut('');
    els.tree.textContent = '';
    status.stats({});

    var found = scan(text);
    if (found) {
      var at = offsetToLineCol(text, found.at);
      /* the gutter marks the line so it does not have to be counted to */
      lines.in.flag(at.line);
      status.err(found.what + ' — line ' + at.line + ', column ' + at.col);
    } else {
      /* our scanner disagreed with the engine; say what the engine said */
      status.err(String(err.message).replace(/^JSON\.parse:\s*/, ''));
    }
  }

  function offsetToLineCol(text, offset) {
    var rows = text.slice(0, Math.min(offset, text.length)).split('\n');
    return { line: rows.length, col: rows[rows.length - 1].length + 1 };
  }

  /* ── finding the syntax error ────────────────────────────────── */

  /* Engines are unhelpful here and inconsistent with each other: current V8
     answers an unclosed array with a quoted snippet and no position at all,
     older V8 gives a byte offset, SpiderMonkey gives line and column. So when
     JSON.parse rejects a document we walk it ourselves — a plain recursive
     descent over RFC 8259 — purely to find out where and why.

     Returns {at, what} for the first problem, or null if it somehow parses. */
  function scan(src) {
    var i = 0;

    function err(what, at) {
      var e = new Error(what);
      e.at = at == null ? i : at;
      e.what = what;
      throw e;
    }
    function ws() {
      while (i < src.length && (src[i] === ' ' || src[i] === '\t' || src[i] === '\n' || src[i] === '\r')) i++;
    }
    function here() {
      if (i >= src.length) return 'end of input';
      var c = src[i];
      return c === '\n' ? 'a line break' : JSON.stringify(c);
    }

    function value(depth) {
      if (depth > 2000) err('nesting is too deep to check');
      ws();
      if (i >= src.length) err('unexpected end of input');
      var c = src[i];
      if (c === '{') return object(depth);
      if (c === '[') return array(depth);
      if (c === '"') return string();
      if (c === '-' || (c >= '0' && c <= '9')) return number();
      if (src.startsWith('true', i))  { i += 4; return; }
      if (src.startsWith('false', i)) { i += 5; return; }
      if (src.startsWith('null', i))  { i += 4; return; }
      /* the three mistakes people actually make, named for what they are */
      if (c === "'") err('single quotes are not valid json — use double quotes');
      if (/[A-Za-z_$]/.test(c)) {
        var word = /^[A-Za-z_$][\w$]*/.exec(src.slice(i))[0];
        err('unquoted value ' + JSON.stringify(word));
      }
      err('expected a value, found ' + here());
    }

    function object(depth) {
      i++;  /* { */
      ws();
      if (src[i] === '}') { i++; return; }
      for (;;) {
        ws();
        if (i >= src.length) err('unexpected end of input — the object is never closed');
        if (src[i] === '}') err('trailing comma before ' + here());
        if (src[i] !== '"') err('expected a quoted key, found ' + here());
        string();
        ws();
        if (src[i] !== ':') err('expected ":" after the key, found ' + here());
        i++;
        value(depth + 1);
        ws();
        if (src[i] === ',') { i++; continue; }
        if (src[i] === '}') { i++; return; }
        if (i >= src.length) err('unexpected end of input — the object is never closed');
        err('expected "," or "}", found ' + here());
      }
    }

    function array(depth) {
      i++;  /* [ */
      ws();
      if (src[i] === ']') { i++; return; }
      for (;;) {
        ws();
        if (src[i] === ']') err('trailing comma before ' + here());
        value(depth + 1);
        ws();
        if (src[i] === ',') { i++; continue; }
        if (src[i] === ']') { i++; return; }
        if (i >= src.length) err('unexpected end of input — the array is never closed');
        err('expected "," or "]", found ' + here());
      }
    }

    function string() {
      var open = i;
      i++;  /* " */
      for (;;) {
        if (i >= src.length) err('unterminated string', open);
        var c = src[i];
        if (c === '"') { i++; return; }
        if (c === '\n') err('unterminated string — a line break needs to be written as \\n', i);
        if (c === '\\') {
          i++;
          var e = src[i];
          if (e === undefined) err('unterminated string', open);
          if ('"\\/bfnrt'.indexOf(e) !== -1) { i++; continue; }
          if (e === 'u') {
            if (!/^[0-9a-fA-F]{4}/.test(src.slice(i + 1, i + 5))) {
              err('\\u needs four hex digits', i - 1);
            }
            i += 5;
            continue;
          }
          err('invalid escape "\\' + e + '"', i - 1);
        }
        if (c < ' ') err('a raw control character has to be escaped', i);
        i++;
      }
    }

    function number() {
      var start = i;
      var m = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(src.slice(i));
      if (!m || !m[0]) err('invalid number', start);
      /* catch what the regex stopped short of: 01, 1., .5, 1e */
      var after = src[i + m[0].length];
      if (after !== undefined && /[0-9.eE+\-]/.test(after)) {
        err('invalid number ' + JSON.stringify(src.slice(start, start + m[0].length + 1)), start);
      }
      i += m[0].length;
    }

    try {
      value(0);
      ws();
      if (i < src.length) err('unexpected content after the document — found ' + here());
      return null;
    } catch (e) {
      if (e.what == null) throw e;
      return { at: e.at, what: e.what };
    }
  }

  function sortKeys(v) {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (v && typeof v === 'object') {
      return Object.keys(v).sort().reduce(function (acc, k) {
        acc[k] = sortKeys(v[k]);
        return acc;
      }, {});
    }
    return v;
  }

  /* node and depth counts, without recursing so deep that we blow the stack
     on a pathological document */
  function describe(root) {
    var nodes = 0, depth = 0;
    var stack = [[root, 1]];
    while (stack.length) {
      var frame = stack.pop();
      var v = frame[0], d = frame[1];
      nodes++;
      if (d > depth) depth = d;
      if (Array.isArray(v)) {
        for (var i = 0; i < v.length; i++) stack.push([v[i], d + 1]);
      } else if (v && typeof v === 'object') {
        for (var k in v) if (Object.prototype.hasOwnProperty.call(v, k)) stack.push([v[k], d + 1]);
      }
    }
    return { nodes: nodes, depth: depth, type: kind(root) };
  }

  function kind(v) {
    if (v === null) return 'null';
    if (Array.isArray(v)) return 'array';
    return typeof v;
  }

  /* ── tree ────────────────────────────────────────────────────── */

  /* Children are built when a node is first opened. A 20 MB document would
     otherwise mean a million elements up front for a view of the top level. */
  function renderTree(value) {
    els.tree.textContent = '';
    var root = document.createElement('ul');
    root.appendChild(node(null, value, true));
    els.tree.appendChild(root);
  }

  function node(key, value, open) {
    var li = document.createElement('li');
    var branch = value !== null && typeof value === 'object';

    if (!branch) {
      if (key !== null) li.append(keySpan(key), text(': '));
      li.appendChild(leaf(value));
      return li;
    }

    var isArr = Array.isArray(value);
    var count = isArr ? value.length : Object.keys(value).length;

    var details = document.createElement('details');
    if (open) details.open = true;

    var summary = document.createElement('summary');
    if (key !== null) summary.append(keySpan(key), text(': '));
    summary.append(
      text(isArr ? '[' : '{'),
      meta(count + (count === 1 ? ' item' : ' items')),
      text(isArr ? ']' : '}')
    );
    details.appendChild(summary);

    var kids = document.createElement('ul');
    details.appendChild(kids);

    var filled = false;
    var fill = function () {
      if (filled) return;
      filled = true;
      if (isArr) {
        value.forEach(function (v, i) { kids.appendChild(node(String(i), v, false)); });
      } else {
        Object.keys(value).forEach(function (k) { kids.appendChild(node(k, value[k], false)); });
      }
    };
    details.addEventListener('toggle', function () { if (details.open) fill(); });
    if (open) fill();

    li.appendChild(details);
    return li;
  }

  function keySpan(k) {
    var s = document.createElement('span');
    s.className = 'jkey';
    s.textContent = JSON.stringify(k);
    return s;
  }

  function leaf(v) {
    var s = document.createElement('span');
    s.className = v === null ? 'jnull' : typeof v === 'string' ? 'jstr'
      : typeof v === 'number' ? 'jnum' : 'jbool';
    s.textContent = JSON.stringify(v);
    return s;
  }

  function meta(t) {
    var s = document.createElement('span');
    s.className = 'jmeta';
    s.textContent = ' ' + t + ' ';
    return s;
  }

  function text(t) { return document.createTextNode(t); }

  /* ── wiring ──────────────────────────────────────────────────── */

  els.input.addEventListener('input', ui.debounce(run, 120));
  els.indent.addEventListener('change', function () {
    store.set('indent', els.indent.value);
    run();
  });
  els.sort.addEventListener('change', function () {
    store.set('sort', els.sort.checked ? '1' : '');
    run();
  });

  els.wrap.addEventListener('click', function () {
    var on = els.wrap.getAttribute('aria-pressed') !== 'true';
    els.wrap.setAttribute('aria-pressed', String(on));
    els.out.classList.toggle('wrap-on', on);
    store.set('wrap', on ? '1' : '');
    syncOutGutter();
  });

  $('#copy').addEventListener('click', function () { ui.copy(lastText); });
  $('#save').addEventListener('click', function () {
    if (!lastText) return ui.toast('nothing to download');
    ui.download(lastText, 'data.json', 'application/json;charset=utf-8');
  });
  $('#clear').addEventListener('click', function () {
    els.input.value = '';
    store.set('input', '');
    run();
    els.input.focus();
  });
  $('#sample').addEventListener('click', function () {
    els.input.value = SAMPLE;
    run();
  });

  ui.acceptDrop($('#in-pane'), function (file) {
    ui.readText(file).then(function (t) {
      els.input.value = t;
      run();
    });
  });

  ui.keys({
    'mod+enter': run,
    'mod+shift+c': function () { ui.copy(lastText); }
  });

  /* ── restore ─────────────────────────────────────────────────── */

  els.indent.value = store.get('indent', '2');
  els.sort.checked = store.get('sort', '') === '1';
  if (store.get('wrap', '') === '1') {
    els.wrap.setAttribute('aria-pressed', 'true');
    els.out.classList.add('wrap-on');
  }
  els.input.value = store.get('input', '');
  syncMode();
  run();
})();

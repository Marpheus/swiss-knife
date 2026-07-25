/* Shared behaviour: the bits every tool would otherwise rewrite.
   Copy, download, file drop, autosave, the status line, the ⌘K palette. */
window.SK = window.SK || {};

SK.ui = (function () {
  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.from((root || document).querySelectorAll(sel)); };

  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms == null ? 120 : ms);
    };
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ── toast ───────────────────────────────────────────────────── */

  var toastEl, toastTimer;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    /* force a reflow so the class change animates even on repeat calls */
    void toastEl.offsetWidth;
    toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('on'); }, 1400);
  }

  /* ── copy & download ─────────────────────────────────────────── */

  function copy(text) {
    if (!text) { toast('nothing to copy'); return; }
    var done = function () { toast('copied'); };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
    } else {
      fallbackCopy(text, done);
    }
  }

  /* execCommand still covers plain http origins, where the async API is absent */
  function fallbackCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.className = 'off-screen';
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    ok ? done() : toast('copy blocked by the browser');
  }

  function download(data, filename, type) {
    var blob = data instanceof Blob ? data
      : new Blob([data], { type: type || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    /* revoke on the next tick — Safari needs the URL alive during the click */
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ── file drop ───────────────────────────────────────────────── */

  /* Highlights the pane while a file is over it and hands back the File.
     Counter, not a boolean: dragleave fires for every child element. */
  function acceptDrop(pane, onFile) {
    var depth = 0;
    pane.addEventListener('dragenter', function (e) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (++depth === 1) pane.classList.add('dropping');
    });
    pane.addEventListener('dragover', function (e) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });
    pane.addEventListener('dragleave', function () {
      if (--depth <= 0) { depth = 0; pane.classList.remove('dropping'); }
    });
    pane.addEventListener('drop', function (e) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      pane.classList.remove('dropping');
      var f = e.dataTransfer.files[0];
      if (f) onFile(f);
    });
  }

  function hasFiles(e) {
    var dt = e.dataTransfer;
    return !!dt && Array.prototype.indexOf.call(dt.types || [], 'Files') !== -1;
  }

  function readText(file) {
    return file.text ? file.text() : new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
      r.readAsText(file);
    });
  }

  function readBytes(file) {
    return (file.arrayBuffer ? file.arrayBuffer() : new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
      r.readAsArrayBuffer(file);
    })).then(function (buf) { return new Uint8Array(buf); });
  }

  /* ── remembering what you typed ──────────────────────────────── */

  /* Per-tool, per-field. Capped: a pasted 5 MB log shouldn't wedge
     localStorage for every other tool. */
  var SAVE_CAP = 200000;

  function store(tool) {
    var prefix = 'sk:' + tool + ':';
    return {
      get: function (key, fallback) {
        try {
          var v = localStorage.getItem(prefix + key);
          return v === null ? fallback : v;
        } catch (e) { return fallback; }
      },
      set: function (key, value) {
        try {
          if (value == null || value === '') localStorage.removeItem(prefix + key);
          else if (String(value).length <= SAVE_CAP) localStorage.setItem(prefix + key, value);
          else localStorage.removeItem(prefix + key);
        } catch (e) { /* private mode, or full — not worth reporting */ }
      },
      clear: function () {
        try {
          Object.keys(localStorage)
            .filter(function (k) { return k.indexOf(prefix) === 0; })
            .forEach(function (k) { localStorage.removeItem(k); });
        } catch (e) {}
      }
    };
  }

  /* ── line numbers ────────────────────────────────────────────── */

  /* A gutter beside a textarea or <pre>. It exists so that "line 8, column 5"
     in an error message is something you can look at rather than count to —
     and clicking a number selects that line in the input.

     It relies on the gutter and the text sharing a font size and line height
     (both set in tool.css) and on the text not wrapping: with wrapping on,
     one logical line can occupy several visual ones and the numbers would
     drift, so the gutter hides itself instead of lying. */
  var GUTTER_CAP = 50000;   /* beyond this the numbers stop being useful and
                               the string starts to cost real memory */

  function gutter(target) {
    var body = target.parentNode;

    var el = document.createElement('div');
    el.className = 'gutter';
    el.setAttribute('aria-hidden', 'true');

    /* One text run rather than an element per line, and not for tidiness:
       a stack of block boxes each rounds its own height to 1/64 px, which
       over two thousand lines walks the numbers three quarters of a line out
       of step with the text. A single run is laid out by the same code path
       as the text beside it and stays within half a pixel. */
    var nums = document.createElement('div');
    nums.className = 'gnums';

    /* the line an error points at, drawn over the top of its number */
    var badge = document.createElement('div');
    badge.className = 'gbad';
    badge.hidden = true;

    el.append(nums, badge);
    if (target.tagName === 'TEXTAREA') {
      el.classList.add('clickable');
      el.title = 'click a number to select that line';
    }
    body.insertBefore(el, body.firstChild);

    var count = 0;
    var flagged = null;
    var visible = true;

    target.addEventListener('scroll', function () { el.scrollTop = target.scrollTop; });

    el.addEventListener('click', function (e) {
      if (target.tagName !== 'TEXTAREA') return;
      var m = metrics();
      var y = e.clientY - el.getBoundingClientRect().top + el.scrollTop - m.top;
      select(Math.floor(y / m.line) + 1);
    });

    /* read from the text, not from the gutter, so the two cannot disagree */
    function metrics() {
      var cs = getComputedStyle(target);
      return { line: parseFloat(cs.lineHeight), top: parseFloat(cs.paddingTop) };
    }

    function render(n) {
      n = Math.max(1, Math.min(n, GUTTER_CAP));
      if (n === count) return;
      var out = [];
      for (var i = 1; i <= n; i++) out.push(i);
      nums.textContent = out.join('\n');
      count = n;
      resize();
      place();
    }

    /* the gutter floats over the text, so the text has to be pushed clear of
       it by however wide the numbers have become */
    function resize() {
      if (!visible) return;
      var cs = getComputedStyle(el);
      el.style.width =
        (nums.scrollWidth + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)) + 'px';
      /* offsetWidth, so the floor from min-width and the border are counted */
      target.style.paddingLeft = (el.offsetWidth + 8) + 'px';
    }

    function place() {
      if (!flagged || flagged > count) { badge.hidden = true; return; }
      var m = metrics();
      badge.hidden = false;
      badge.textContent = flagged;
      badge.style.top = (m.top + (flagged - 1) * m.line) + 'px';
    }

    function select(line) {
      var rows = target.value.split('\n');
      if (line < 1 || line > rows.length) return;
      var pos = 0;
      for (var i = 0; i < line - 1; i++) pos += rows[i].length + 1;
      target.focus();
      target.setSelectionRange(pos, pos + rows[line - 1].length);
    }

    return {
      /* count the lines in `text` and draw that many numbers */
      set: function (text) {
        render(text ? text.split('\n').length : 1);
      },
      /* single out one line — the one an error points at */
      flag: function (line) {
        flagged = line || null;
        place();
      },
      /* off while the text wraps, or while the pane shows something else:
         with wrapping on, one line of text can occupy several visual rows
         and the numbers would be a lie */
      show: function (on) {
        visible = on;
        el.hidden = !on;
        if (on) resize();
        else target.style.paddingLeft = '';   /* back to the stylesheet's value */
      },
      visible: function () { return visible; },
      select: select
    };
  }

  /* ── status line ─────────────────────────────────────────────── */

  /* status(el) → .ok('valid') / .err('…') / .info('…') / .stats({lines: 3}) */
  function status(el) {
    var msg = document.createElement('span');
    msg.className = 'msg';
    var stats = document.createElement('span');
    stats.className = 'stat';
    el.textContent = '';
    el.append(msg, stats);

    function say(kind, text) {
      msg.className = 'msg' + (kind ? ' ' + kind : '');
      msg.textContent = text || '';
      msg.hidden = !text;
    }
    return {
      ok:   function (t) { say('ok', t); },
      err:  function (t) { say('err', t); },
      info: function (t) { say('', t); },
      clear: function () { say('', ''); },
      stats: function (obj) {
        stats.innerHTML = Object.keys(obj).map(function (k) {
          return esc(k) + ' <b>' + esc(obj[k]) + '</b>';
        }).join('&nbsp;&nbsp; ');
      }
    };
  }

  /* ── command palette ─────────────────────────────────────────── */

  var palette = null;

  function buildPalette() {
    var el = document.createElement('div');
    el.className = 'palette';
    el.hidden = true;
    el.innerHTML =
      '<div class="palette-box" role="dialog" aria-modal="true" aria-label="Jump to a tool">' +
        '<input type="text" placeholder="jump to a tool…" autocomplete="off" spellcheck="false" aria-controls="p-list">' +
        '<ul id="p-list" role="listbox"></ul>' +
      '</div>';
    document.body.appendChild(el);

    var input = $('input', el);
    var list = $('ul', el);
    var hits = [];
    var cursor = 0;
    var lastFocus = null;

    function render(q) {
      var query = q.trim().toLowerCase();
      hits = (SK.tools || []).filter(function (t) {
        if (!query) return true;
        return (t.name + ' ' + t.slug + ' ' + t.note + ' ' + (t.keys || ''))
          .toLowerCase().indexOf(query) !== -1;
      });
      /* live tools first, otherwise registry order */
      hits.sort(function (a, b) {
        return (a.status === 'live' ? 0 : 1) - (b.status === 'live' ? 0 : 1);
      });
      cursor = 0;
      if (!hits.length) {
        list.innerHTML = '<li class="p-none">nothing matches</li>';
        return;
      }
      list.innerHTML = hits.map(function (t, i) {
        var inner = t.status === 'live'
          ? '<a href="/' + esc(t.slug) + '/">' + row(t) + '</a>'
          : '<span>' + row(t) + '</span>';
        return '<li role="option" aria-selected="' + (i === 0) + '"' +
               (t.status === 'live' ? '' : ' data-soon') + '>' + inner + '</li>';
      }).join('');
      mark();
    }

    function row(t) {
      return '<span class="p-name">' + esc(t.name) + '</span>' +
             '<span class="p-note">' + esc(t.note) + '</span>' +
             (t.status === 'live' ? '' : '<span class="tag">soon</span>');
    }

    function mark() {
      $$('li', list).forEach(function (li, i) {
        li.setAttribute('aria-selected', String(i === cursor));
      });
      var sel = list.children[cursor];
      if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: 'nearest' });
    }

    function open() {
      lastFocus = document.activeElement;
      el.hidden = false;
      input.value = '';
      render('');
      input.focus();
    }

    function close() {
      el.hidden = true;
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    function go() {
      var t = hits[cursor];
      if (t && t.status === 'live') location.href = '/' + t.slug + '/';
      else if (t) toast(t.name + ' — not built yet');
    }

    input.addEventListener('input', function () { render(input.value); });

    el.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (hits.length) { cursor = (cursor + 1) % hits.length; mark(); }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (hits.length) { cursor = (cursor - 1 + hits.length) % hits.length; mark(); }
      } else if (e.key === 'Enter') { e.preventDefault(); go(); }
    });

    /* clicking the backdrop, but not the box, dismisses */
    el.addEventListener('mousedown', function (e) { if (e.target === el) close(); });

    list.addEventListener('mousemove', function (e) {
      var li = e.target.closest('li');
      if (!li || !li.parentNode) return;
      var i = Array.prototype.indexOf.call(list.children, li);
      if (i >= 0 && i !== cursor) { cursor = i; mark(); }
    });

    list.addEventListener('click', function (e) {
      if (e.target.closest('li[data-soon]')) { e.preventDefault(); go(); }
    });

    return { open: open, close: close, el: el };
  }

  function openPalette() {
    if (!palette) palette = buildPalette();
    palette.open();
  }

  /* ── keyboard ────────────────────────────────────────────────── */

  function keys(map) {
    document.addEventListener('keydown', function (e) {
      var mod = e.metaKey || e.ctrlKey;
      if (mod && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openPalette();
        return;
      }
      if (!map) return;
      for (var combo in map) {
        var parts = combo.split('+');
        var wantMod = parts.indexOf('mod') !== -1;
        var wantShift = parts.indexOf('shift') !== -1;
        var key = parts[parts.length - 1];
        if (wantMod === mod && wantShift === e.shiftKey &&
            e.key.toLowerCase() === key) {
          e.preventDefault();
          map[combo](e);
          return;
        }
      }
    });
  }

  /* wires the header's jump button once the deferred scripts have run */
  document.addEventListener('DOMContentLoaded', function () {
    var jump = document.getElementById('jump');
    if (jump) jump.addEventListener('click', openPalette);
  });

  return {
    $: $, $$: $$, esc: esc, debounce: debounce,
    toast: toast, copy: copy, download: download,
    acceptDrop: acceptDrop, readText: readText, readBytes: readBytes,
    store: store, status: status, gutter: gutter,
    openPalette: openPalette, keys: keys
  };
})();

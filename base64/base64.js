/* base64 — text or files, both directions.

   Two things this gets right that a one-liner in the console does not:
   btoa only accepts latin-1, so anything with diacritics or an emoji has to
   go through TextEncoder first; and decoded bytes are not necessarily text,
   so a binary result is offered as a download instead of being mangled. */
(function () {
  var ui = SK.ui, B = SK.bytes;
  var $ = ui.$;

  var els = {
    input:    $('#in'),
    out:      $('#out'),
    inLabel:  $('#in-label'),
    outLabel: $('#out-label'),
    size:     $('#in-size'),
    urlsafe:  $('#urlsafe'),
    wrap76:   $('#wrap76'),
    datauri:  $('#datauri'),
    filebar:  $('#filebar'),
    fname:    $('#fname'),
    file:     $('#file'),
    wrap:     $('#wrap-toggle')
  };

  var store = ui.store('base64');
  var status = ui.status($('#status'));
  var mode = store.get('mode', 'auto');

  /* when a file is loaded it, not the textarea, is the input */
  var loaded = null;      /* { name, type, bytes } */
  var result = null;      /* { text, bytes, filename, mime } */

  /* ── mode ────────────────────────────────────────────────────── */

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
  }

  /* Auto mode guesses from the input. Base64 is a subset of plain text, so
     the guess is deliberately conservative: it has to be a well-formed,
     reasonably long base64 body before we assume decoding was meant. */
  function direction() {
    if (mode !== 'auto') return mode;
    if (loaded) return 'encode';
    var s = els.input.value.trim();
    if (!s) return 'encode';
    if (/^data:[^,]*;base64,/i.test(s)) return 'decode';
    var body = s.replace(/\s+/g, '');
    if (body.length < 8 || body.length % 4 === 1) return 'encode';
    if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(body)) return 'encode';
    /* "deadbeef" is valid base64 too; require a hint that it is not prose */
    if (/^[a-z]+$/.test(body) || /^[A-Za-z]+$/.test(body) && body.length < 24) return 'encode';
    return 'decode';
  }

  /* ── run ─────────────────────────────────────────────────────── */

  function run() {
    var dir = direction();
    els.inLabel.textContent = dir === 'encode' ? 'input — plain' : 'input — base64';
    els.outLabel.textContent = dir === 'encode' ? 'output — base64' : 'output — plain';

    var text = els.input.value;
    if (!loaded) store.set('input', text);

    if (!loaded && !text) {
      result = null;
      els.out.textContent = '';
      status.clear();
      status.stats({});
      els.size.textContent = '';
      return;
    }

    dir === 'encode' ? encode(text) : decode(text);
  }

  function encode(text) {
    var bytes = loaded ? loaded.bytes : B.fromText(text);
    els.size.textContent = B.human(bytes.length);

    var b64 = B.toBase64(bytes, {
      url: els.urlsafe.checked,
      wrap: els.wrap76.checked ? 76 : 0
    });

    var out = b64;
    if (els.datauri.checked) {
      var mime = loaded ? (loaded.type || 'application/octet-stream') : 'text/plain;charset=utf-8';
      /* a data uri is not wrapped — line breaks would break the url */
      out = 'data:' + mime + ';base64,' + b64.replace(/\s+/g, '');
    }

    result = { text: out, bytes: null, filename: (loaded ? loaded.name : 'encoded') + '.txt', mime: 'text/plain' };
    els.out.textContent = out;

    status.ok(loaded ? 'encoded ' + loaded.name : 'encoded');
    status.stats({
      in: B.human(bytes.length),
      out: B.human(B.fromText(out).length),
      growth: '+' + Math.round((out.length / Math.max(bytes.length, 1) - 1) * 100) + '%'
    });
  }

  function decode(text) {
    var src = text.trim();
    var mime = null;
    var m = /^data:([^,]*?);base64,(.*)$/is.exec(src);
    if (m) { mime = m[1]; src = m[2]; }

    var bytes;
    try {
      bytes = B.fromBase64(src);
    } catch (e) {
      result = null;
      els.out.textContent = '';
      status.err(e.message);
      status.stats({});
      return;
    }

    els.size.textContent = B.human(B.fromText(text).length);

    var asText = null;
    try {
      asText = B.toTextStrict(bytes);
    } catch (e) { /* not utf-8 — treat it as binary */ }

    /* a NUL or a stray control character means it is not text either */
    if (asText !== null && /[\x00-\x08\x0e-\x1f]/.test(asText)) asText = null;

    if (asText !== null) {
      result = { text: asText, bytes: bytes, filename: 'decoded.txt', mime: mime || 'text/plain' };
      els.out.textContent = asText;
      status.ok('decoded' + (mime ? ' — data uri, ' + mime : ''));
    } else {
      var name = guessName(bytes, mime);
      result = { text: null, bytes: bytes, filename: name.file, mime: name.mime };
      els.out.textContent = preview(bytes);
      status.info('binary — ' + name.label + '. use download to keep it intact');
    }

    status.stats({ bytes: bytes.length, size: B.human(bytes.length) });
  }

  /* first bytes are enough to name the common formats */
  function guessName(b, mime) {
    var sigs = [
      { magic: [0x89, 0x50, 0x4e, 0x47], label: 'png image',  file: 'decoded.png',  mime: 'image/png' },
      { magic: [0xff, 0xd8, 0xff],       label: 'jpeg image', file: 'decoded.jpg',  mime: 'image/jpeg' },
      { magic: [0x47, 0x49, 0x46, 0x38], label: 'gif image',  file: 'decoded.gif',  mime: 'image/gif' },
      { magic: [0x25, 0x50, 0x44, 0x46], label: 'pdf',        file: 'decoded.pdf',  mime: 'application/pdf' },
      { magic: [0x50, 0x4b, 0x03, 0x04], label: 'zip archive',file: 'decoded.zip',  mime: 'application/zip' },
      { magic: [0x1f, 0x8b],             label: 'gzip',       file: 'decoded.gz',   mime: 'application/gzip' }
    ];
    for (var i = 0; i < sigs.length; i++) {
      var s = sigs[i];
      if (s.magic.every(function (v, j) { return b[j] === v; })) return s;
    }
    return { label: 'unrecognised data', file: 'decoded.bin', mime: mime || 'application/octet-stream' };
  }

  /* a hexdump of the head, so a binary result still shows something */
  function preview(b) {
    var lines = [];
    var max = Math.min(b.length, 512);
    for (var off = 0; off < max; off += 16) {
      var chunk = b.subarray(off, Math.min(off + 16, max));
      var hex = B.toHex(chunk, ' ').padEnd(47, ' ');
      var ascii = Array.from(chunk).map(function (c) {
        return c >= 32 && c < 127 ? String.fromCharCode(c) : '.';
      }).join('');
      lines.push(off.toString(16).padStart(8, '0') + '  ' + hex + '  ' + ascii);
    }
    if (b.length > max) lines.push('… ' + (b.length - max) + ' more bytes');
    return lines.join('\n');
  }

  /* ── files ───────────────────────────────────────────────────── */

  function load(file) {
    ui.readBytes(file).then(function (bytes) {
      loaded = { name: file.name, type: file.type, bytes: bytes };
      els.filebar.hidden = false;
      els.fname.textContent = file.name + ' — ' + B.human(bytes.length);
      els.input.value = '';
      els.input.placeholder = 'using the loaded file — unload to type instead';
      els.input.disabled = true;
      if (mode === 'decode') { mode = 'encode'; store.set('mode', mode); syncMode(); }
      run();
    }, function () { ui.toast('could not read that file'); });
  }

  function unload() {
    loaded = null;
    els.filebar.hidden = true;
    els.input.disabled = false;
    els.input.placeholder = 'type or paste — or drop a file to encode it';
    els.file.value = '';
    run();
    els.input.focus();
  }

  $('#pick').addEventListener('click', function () { els.file.click(); });
  els.file.addEventListener('change', function () {
    if (els.file.files[0]) load(els.file.files[0]);
  });
  $('#unload').addEventListener('click', unload);
  ui.acceptDrop($('#in-pane'), load);

  /* ── wiring ──────────────────────────────────────────────────── */

  els.input.addEventListener('input', ui.debounce(run, 120));
  [els.urlsafe, els.wrap76, els.datauri].forEach(function (box) {
    box.addEventListener('change', function () {
      store.set(box.id, box.checked ? '1' : '');
      run();
    });
  });

  els.wrap.addEventListener('click', function () {
    var on = els.wrap.getAttribute('aria-pressed') !== 'true';
    els.wrap.setAttribute('aria-pressed', String(on));
    els.out.classList.toggle('wrap-on', on);
    store.set('wrap', on ? '1' : '');
  });

  /* send the output back round as the next input */
  $('#swap').addEventListener('click', function () {
    if (!result || result.text === null) return ui.toast('binary output cannot be swapped');
    if (loaded) unload();
    els.input.value = result.text;
    if (mode !== 'auto') {
      mode = mode === 'encode' ? 'decode' : 'encode';
      store.set('mode', mode);
      syncMode();
    }
    run();
  });

  $('#copy').addEventListener('click', function () {
    if (!result) return ui.toast('nothing to copy');
    if (result.text === null) return ui.toast('binary — use download');
    ui.copy(result.text);
  });

  $('#save').addEventListener('click', function () {
    if (!result) return ui.toast('nothing to download');
    var data = result.text !== null && result.bytes === null
      ? result.text
      : new Blob([result.bytes], { type: result.mime });
    ui.download(data, result.filename, result.mime);
  });

  $('#clear').addEventListener('click', function () {
    if (loaded) return unload();
    els.input.value = '';
    store.set('input', '');
    run();
    els.input.focus();
  });

  ui.keys({
    'mod+enter': run,
    'mod+shift+c': function () { if (result && result.text !== null) ui.copy(result.text); }
  });

  /* ── restore ─────────────────────────────────────────────────── */

  els.urlsafe.checked = store.get('urlsafe', '') === '1';
  els.wrap76.checked  = store.get('wrap76', '') === '1';
  els.datauri.checked = store.get('datauri', '') === '1';
  if (store.get('wrap', '1') !== '1') {
    els.wrap.setAttribute('aria-pressed', 'false');
    els.out.classList.remove('wrap-on');
  }
  els.input.value = store.get('input', '');
  syncMode();
  run();
})();

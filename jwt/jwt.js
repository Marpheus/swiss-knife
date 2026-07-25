/* jwt — decode the claims, read the dates, check the signature.

   Verification runs on WebCrypto in this tab. That matters more here than
   anywhere else on the site: pasting a live bearer token into a website is
   handing it over, and the usual advice is to never do it. Here the token,
   the secret and the key all stay in the page. */
(function () {
  var ui = SK.ui, B = SK.bytes;
  var $ = ui.$;

  var els = {
    input:  $('#in'),
    out:    $('#decoded'),
    key:    $('#key'),
    keyRow: $('#key-row'),
    verify: $('#verify'),
    b64secret: $('#b64secret'),
    b64opt: $('#b64secret-opt'),
    alg:    $('#alg-tag'),
    size:   $('#in-size')
  };

  var store = ui.store('jwt');
  var status = ui.status($('#status'));
  var payloadText = '';
  var runId = 0;   /* verification is async; only the latest run may report */

  /* a token signed with the secret "swiss-knife", so verify can be tried out */
  var SAMPLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
    'eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6Ik1hcm9zIiwicm9sZSI6WyJhZG1pbiJdLCJpYXQiOjE3ODI4OTcxMjAsImV4cCI6MTc5ODc5NDcyMH0.' +
    'qtgXbxpqYAkzYiLqoKG1YX9H37l7HZUeHeZQ2zsf-uo';

  /* ── decode ──────────────────────────────────────────────────── */

  function run() {
    var raw = els.input.value.trim();
    store.set('input', raw);
    els.size.textContent = raw ? raw.length + ' chars' : '';
    els.alg.textContent = '';
    runId++;

    if (!raw) {
      els.out.textContent = '';
      status.clear();
      status.stats({});
      payloadText = '';
      return;
    }

    /* tolerate what people actually paste */
    var token = raw.replace(/^["']|["']$/g, '').replace(/^Bearer\s+/i, '').replace(/\s+/g, '');
    var parts = token.split('.');

    if (parts.length !== 3) {
      els.out.innerHTML = '';
      status.err(parts.length < 3
        ? 'a jwt has three dot-separated parts — this has ' + parts.length
        : 'too many dots — this is not a jwt');
      status.stats({});
      return;
    }

    var header, payload;
    try {
      header = JSON.parse(B.b64urlDecode(parts[0]));
    } catch (e) {
      els.out.innerHTML = '';
      status.err('the header is not valid base64url json');
      status.stats({});
      return;
    }
    try {
      payload = JSON.parse(B.b64urlDecode(parts[1]));
    } catch (e) {
      /* the header still tells us something, so show what we have */
      render(header, null, parts);
      status.err('the payload is not valid base64url json');
      status.stats({});
      return;
    }

    payloadText = JSON.stringify(payload, null, 2);
    render(header, payload, parts);

    var alg = String(header.alg || '');
    els.alg.innerHTML = '<span class="tag">' + ui.esc(alg || 'no alg') + '</span>';

    var life = lifetime(payload);
    status.stats({
      alg: alg || '—',
      claims: Object.keys(payload).length,
      size: raw.length + ' chars'
    });

    if (alg.toLowerCase() === 'none') {
      /* nothing to verify, and the fact itself is the finding */
      base = { kind: 'err', text: 'alg is "none" — this token is unsigned and proves nothing' };
    } else if (life.expired) {
      base = { kind: 'err', text: 'expired ' + life.expiredAgo };
    } else if (life.notYet) {
      base = { kind: 'err', text: 'not valid yet — nbf is ' + life.nbfIn };
    } else {
      base = { kind: 'ok', text: 'decoded' + (life.expiresIn ? ' — expires ' + life.expiresIn : '') };
    }
    say(base, null);

    if (els.verify.checked && alg.toLowerCase() !== 'none') check(token, parts, header, runId);
  }

  /* The expiry and the signature are separate findings and a token can fail
     both, so they are shown side by side rather than one overwriting the
     other — an expired token with a good signature is a different problem
     from a live token with a bad one. */
  var base = null;

  function say(head, tail) {
    var kind = (head && head.kind === 'err') || (tail && tail.kind === 'err') ? 'err'
      : (head && head.kind === 'ok') && (!tail || tail.kind === 'ok') ? 'ok' : '';
    var text = [head && head.text, tail && tail.text].filter(Boolean).join('  ·  ');
    kind === 'err' ? status.err(text) : kind === 'ok' ? status.ok(text) : status.info(text);
  }

  /* ── the panels ──────────────────────────────────────────────── */

  function render(header, payload, parts) {
    var blocks = [
      block('header', JSON.stringify(header, null, 2)),
      payload === null ? '' : block('payload', JSON.stringify(payload, null, 2)),
      payload === null ? '' : claims(payload),
      block('signature', parts[2] || '(empty)')
    ];
    els.out.innerHTML = blocks.join('');
  }

  function block(title, body) {
    return '<div class="block"><div class="block-head">' + ui.esc(title) + '</div>' +
           '<pre>' + ui.esc(body) + '</pre></div>';
  }

  /* the claims that mean something specific, spelled out */
  var KNOWN = {
    iss: 'issuer', sub: 'subject', aud: 'audience', exp: 'expires',
    nbf: 'not before', iat: 'issued at', jti: 'jwt id',
    azp: 'authorised party', scope: 'scope', client_id: 'client'
  };
  var TIME_CLAIMS = ['exp', 'nbf', 'iat', 'auth_time', 'updated_at'];

  function claims(payload) {
    var rows = Object.keys(payload).map(function (k) {
      var v = payload[k];
      var note = KNOWN[k] ? '<span class="muted"> — ' + KNOWN[k] + '</span>' : '';
      var val;

      if (TIME_CLAIMS.indexOf(k) !== -1 && typeof v === 'number') {
        var d = new Date(v * 1000);
        val = isNaN(d) ? ui.esc(String(v))
          : ui.esc(d.toISOString().replace('T', ' ').replace('.000Z', ' UTC')) +
            ' <span class="muted">(' + ui.esc(relative(d)) + ')</span>';
      } else if (typeof v === 'object' && v !== null) {
        val = ui.esc(JSON.stringify(v));
      } else {
        val = ui.esc(String(v));
      }
      return '<tr><td class="k">' + ui.esc(k) + note + '</td><td>' + val + '</td></tr>';
    }).join('');

    return '<div class="block"><div class="block-head">claims</div>' +
           '<table class="kv"><tbody>' + rows + '</tbody></table></div>';
  }

  function lifetime(payload) {
    var now = Date.now();
    var out = { expired: false, notYet: false, expiresIn: '', expiredAgo: '', nbfIn: '' };
    if (typeof payload.exp === 'number') {
      var exp = new Date(payload.exp * 1000);
      if (exp.getTime() <= now) { out.expired = true; out.expiredAgo = relative(exp); }
      else out.expiresIn = relative(exp);
    }
    if (typeof payload.nbf === 'number') {
      var nbf = new Date(payload.nbf * 1000);
      if (nbf.getTime() > now) { out.notYet = true; out.nbfIn = relative(nbf); }
    }
    return out;
  }

  var RELATIVE = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  var UNITS = [
    ['year', 31536000000], ['month', 2592000000], ['week', 604800000],
    ['day', 86400000], ['hour', 3600000], ['minute', 60000], ['second', 1000]
  ];

  function relative(date) {
    var diff = date.getTime() - Date.now();
    for (var i = 0; i < UNITS.length; i++) {
      var abs = Math.abs(diff);
      if (abs >= UNITS[i][1] || i === UNITS.length - 1) {
        return RELATIVE.format(Math.round(diff / UNITS[i][1]), UNITS[i][0]);
      }
    }
    return '';
  }

  /* ── verification ────────────────────────────────────────────── */

  var ALGS = {
    HS256: { name: 'HMAC', hash: 'SHA-256' },
    HS384: { name: 'HMAC', hash: 'SHA-384' },
    HS512: { name: 'HMAC', hash: 'SHA-512' },
    RS256: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    RS384: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-384' },
    RS512: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-512' },
    PS256: { name: 'RSA-PSS', hash: 'SHA-256', salt: 32 },
    PS384: { name: 'RSA-PSS', hash: 'SHA-384', salt: 48 },
    PS512: { name: 'RSA-PSS', hash: 'SHA-512', salt: 64 },
    ES256: { name: 'ECDSA', hash: 'SHA-256', curve: 'P-256' },
    ES384: { name: 'ECDSA', hash: 'SHA-384', curve: 'P-384' },
    ES512: { name: 'ECDSA', hash: 'SHA-512', curve: 'P-521' }
  };

  function check(token, parts, header, id) {
    var alg = String(header.alg || '').toUpperCase();
    var spec = ALGS[alg];
    var keyText = els.key.value.trim();

    if (!spec) {
      note(id, 'err', alg ? 'cannot verify ' + alg + ' here' : 'the header has no alg');
      return;
    }
    if (!keyText) {
      note(id, '', 'add the key above to check the signature');
      return;
    }

    var signed = B.fromText(parts[0] + '.' + parts[1]);
    var sig;
    try {
      sig = B.fromBase64(parts[2]);
    } catch (e) {
      note(id, 'err', 'the signature is not valid base64url');
      return;
    }

    importKey(spec, keyText).then(function (key) {
      var params = spec.name === 'RSA-PSS' ? { name: 'RSA-PSS', saltLength: spec.salt }
        : spec.name === 'ECDSA' ? { name: 'ECDSA', hash: spec.hash }
        : { name: spec.name };
      return crypto.subtle.verify(params, key, sig, signed);
    }).then(function (ok) {
      note(id, ok ? 'ok' : 'err',
        ok ? 'signature verified — ' + alg : 'signature does NOT match this key');
    }).catch(function (e) {
      note(id, 'err', 'could not verify — ' + (e.message || e));
    });
  }

  function importKey(spec, keyText) {
    if (spec.name === 'HMAC') {
      var raw = els.b64secret.checked ? B.fromBase64(keyText) : B.fromText(keyText);
      return crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: spec.hash }, false, ['verify']);
    }

    var algo = spec.name === 'ECDSA'
      ? { name: 'ECDSA', namedCurve: spec.curve }
      : { name: spec.name, hash: spec.hash };

    if (keyText[0] === '{') {
      var jwk = JSON.parse(keyText);
      return crypto.subtle.importKey('jwk', jwk, algo, false, ['verify']);
    }

    if (/BEGIN CERTIFICATE/.test(keyText)) {
      return Promise.reject(new Error('that is a certificate — paste the public key inside it (BEGIN PUBLIC KEY)'));
    }
    if (/BEGIN RSA PUBLIC KEY/.test(keyText)) {
      return Promise.reject(new Error('that is a PKCS#1 key — convert it to PKCS#8 (BEGIN PUBLIC KEY)'));
    }
    if (/PRIVATE KEY/.test(keyText)) {
      return Promise.reject(new Error('that is a private key — verification wants the public one'));
    }
    if (!/BEGIN PUBLIC KEY/.test(keyText)) {
      return Promise.reject(new Error('expected a PEM public key or a JWK'));
    }

    var der = B.fromBase64(keyText.replace(/-----[^-]+-----/g, ''));
    return crypto.subtle.importKey('spki', der, algo, false, ['verify']);
  }

  /* verification lands late; ignore anything from a superseded run */
  function note(id, kind, text) {
    if (id !== runId) return;
    say(base, { kind: kind, text: text });
  }

  /* ── wiring ──────────────────────────────────────────────────── */

  els.input.addEventListener('input', ui.debounce(run, 120));
  els.key.addEventListener('input', ui.debounce(function () {
    /* the key is a secret; it is deliberately not remembered between visits */
    run();
  }, 200));

  els.verify.addEventListener('change', function () {
    els.keyRow.hidden = !els.verify.checked;
    els.b64opt.hidden = !els.verify.checked;
    store.set('verify', els.verify.checked ? '1' : '');
    if (els.verify.checked) els.key.focus();
    run();
  });

  els.b64secret.addEventListener('change', run);

  $('#sample').addEventListener('click', function () {
    els.input.value = SAMPLE;
    if (!els.verify.checked) {
      els.verify.checked = true;
      els.keyRow.hidden = false;
      els.b64opt.hidden = false;
    }
    els.key.value = 'swiss-knife';
    run();
  });

  $('#copy').addEventListener('click', function () { ui.copy(payloadText); });
  $('#clear').addEventListener('click', function () {
    els.input.value = '';
    els.key.value = '';
    store.set('input', '');
    run();
    els.input.focus();
  });

  ui.acceptDrop($('#in-pane'), function (file) {
    ui.readText(file).then(function (t) { els.input.value = t.trim(); run(); });
  });

  ui.keys({
    'mod+enter': run,
    'mod+shift+c': function () { ui.copy(payloadText); }
  });

  /* ── restore ─────────────────────────────────────────────────── */

  els.verify.checked = store.get('verify', '') === '1';
  els.keyRow.hidden = !els.verify.checked;
  els.b64opt.hidden = !els.verify.checked;
  els.input.value = store.get('input', '');
  run();
})();

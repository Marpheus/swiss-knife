/* Byte plumbing shared by the tools.

   The point of most of this is that btoa/atob only speak latin-1: feed them
   "č" or an emoji and they throw. Everything below routes through
   TextEncoder/TextDecoder so any input survives the round trip. */
window.SK = window.SK || {};

SK.bytes = (function () {
  var enc = new TextEncoder();
  var dec = new TextDecoder('utf-8', { fatal: false });
  var strictDec = new TextDecoder('utf-8', { fatal: true });

  function fromText(str) {
    return enc.encode(str);
  }
  function toText(bytes) {
    return dec.decode(bytes);
  }

  /* Throws if the bytes are not valid UTF-8 — used to decide whether a
     decoded blob can be shown as text or has to stay a download. */
  function toTextStrict(bytes) {
    return strictDec.decode(bytes);
  }

  /* Chunked so a multi-megabyte file doesn't blow the argument limit of
     String.fromCharCode.apply. */
  function toBinaryString(bytes) {
    var out = '';
    var step = 0x8000;
    for (var i = 0; i < bytes.length; i += step) {
      out += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
    }
    return out;
  }

  function toBase64(bytes, opts) {
    opts = opts || {};
    var b64 = btoa(toBinaryString(bytes));
    if (opts.url) b64 = b64.replace(/\+/g, '-').replace(/\//g, '_');
    if (opts.url && !opts.pad) b64 = b64.replace(/=+$/, '');
    if (opts.wrap) b64 = b64.replace(new RegExp('.{1,' + opts.wrap + '}', 'g'), '$&\n').trim();
    return b64;
  }

  /* Tolerant on the way in: accepts either alphabet, ignores whitespace,
     and re-pads. Throws a readable error on anything genuinely malformed. */
  function fromBase64(str) {
    var s = String(str).replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
    if (!s) return new Uint8Array(0);
    if (/[^A-Za-z0-9+/=]/.test(s)) {
      var bad = s.match(/[^A-Za-z0-9+/=]/)[0];
      throw new Error('not base64: unexpected character ' + JSON.stringify(bad));
    }
    s = s.replace(/=+$/, '');
    if (s.length % 4 === 1) throw new Error('not base64: truncated input');
    while (s.length % 4) s += '=';
    var bin = atob(s);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function toHex(bytes, sep) {
    var out = [];
    for (var i = 0; i < bytes.length; i++) {
      out.push(bytes[i].toString(16).padStart(2, '0'));
    }
    return out.join(sep || '');
  }

  function fromHex(str) {
    var s = String(str).replace(/(0x)|[\s:,-]/gi, '');
    if (s.length % 2) throw new Error('hex needs an even number of digits');
    if (/[^0-9a-f]/i.test(s)) throw new Error('not hex');
    var out = new Uint8Array(s.length / 2);
    for (var i = 0; i < out.length; i++) out[i] = parseInt(s.substr(i * 2, 2), 16);
    return out;
  }

  /* base64url of a UTF-8 string and back — the JWT encoding */
  function b64urlEncode(str) {
    return toBase64(fromText(str), { url: true });
  }
  function b64urlDecode(str) {
    return toText(fromBase64(str));
  }

  function human(n) {
    if (n < 1024) return n + ' B';
    var units = ['kB', 'MB', 'GB', 'TB'];
    var i = -1;
    do {
      n /= 1024;
      i++;
    } while (n >= 1024 && i < units.length - 1);
    return (n < 10 ? n.toFixed(1) : Math.round(n)) + ' ' + units[i];
  }

  return {
    fromText: fromText,
    toText: toText,
    toTextStrict: toTextStrict,
    toBase64: toBase64,
    fromBase64: fromBase64,
    toHex: toHex,
    fromHex: fromHex,
    b64urlEncode: b64urlEncode,
    b64urlDecode: b64urlDecode,
    human: human
  };
})();

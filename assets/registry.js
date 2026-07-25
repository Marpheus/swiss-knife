/* The one list of tools.
   The homepage builds its cards from it, every tool page builds its header
   from it, and the ⌘K palette indexes it. Adding a tool is one entry here
   plus a folder — nothing else needs touching.

   status: 'live' — shipped, 'soon' — planned, listed but not linked.
   keys:   extra search terms for the palette, beyond name and note. */
window.SK = window.SK || {};

SK.groups = [
  { id: 'core',    title: 'core' },
  { id: 'dev',     title: 'dev essentials' },
  { id: 'text',    title: 'text' },
  { id: 'data',    title: 'data formats' },
  { id: 'web',     title: 'web & crypto' },
  { id: 'misc',    title: 'misc' }
];

SK.tools = [
  /* ── core ─────────────────────────────────────────────────────── */
  { slug: 'json',   group: 'core', status: 'live',
    name: 'json',   note: 'format, minify, validate, sort keys, browse as a tree',
    keys: 'pretty print beautify parse escape stringify' },
  { slug: 'regex',  group: 'core', status: 'live',
    name: 'regex',  note: 'test a pattern, see every match and capture group',
    keys: 'regexp pattern match replace groups flags' },
  { slug: 'base64', group: 'core', status: 'live',
    name: 'base64', note: 'encode and decode text or files, utf-8 safe',
    keys: 'b64 base64url atob btoa data uri' },
  { slug: 'jwt',    group: 'core', status: 'live',
    name: 'jwt',    note: 'decode claims, read the dates, verify the signature',
    keys: 'token json web bearer hs256 rs256 claims exp' },
  { slug: 'diff',   group: 'core', status: 'live',
    name: 'diff',   note: 'compare two texts, line or word level',
    keys: 'compare changes patch unified split merge' },

  /* ── dev essentials ───────────────────────────────────────────── */
  { slug: 'hash',      group: 'dev', status: 'soon',
    name: 'hash',      note: 'md5, sha-1/256/512, hmac, crc32 — text or file',
    keys: 'digest checksum sha md5 hmac' },
  { slug: 'uuid',      group: 'dev', status: 'soon',
    name: 'uuid',      note: 'v4, v7 and ulid, in bulk, with timestamps decoded',
    keys: 'guid ulid nanoid random id' },
  { slug: 'url',       group: 'dev', status: 'soon',
    name: 'url',       note: 'encode, decode and take a query string apart',
    keys: 'percent encoding querystring params uri' },
  { slug: 'timestamp', group: 'dev', status: 'soon',
    name: 'timestamp', note: 'unix ↔ iso 8601 ↔ human, across time zones',
    keys: 'epoch date time utc iso8601 relative' },

  /* ── text ─────────────────────────────────────────────────────── */
  { slug: 'case',   group: 'text', status: 'soon',
    name: 'case',   note: 'camel, pascal, snake, kebab, constant, title',
    keys: 'camelcase snakecase kebab slug capitalise' },
  { slug: 'lines',  group: 'text', status: 'soon',
    name: 'lines',  note: 'sort, dedupe, reverse, number, trim, join, split',
    keys: 'sort unique dedupe shuffle prefix suffix' },
  { slug: 'stats',  group: 'text', status: 'soon',
    name: 'text stats', note: 'characters, words, bytes, frequency, reading time',
    keys: 'count words characters length frequency' },
  { slug: 'escape', group: 'text', status: 'soon',
    name: 'escape', note: 'json string, html entities, url, sql, shell, regex',
    keys: 'unescape quote entities encode special characters' },
  { slug: 'lorem',  group: 'text', status: 'soon',
    name: 'lorem',  note: 'placeholder text by words, sentences or paragraphs',
    keys: 'ipsum dummy placeholder filler' },

  /* ── data formats ─────────────────────────────────────────────── */
  { slug: 'csv',      group: 'data', status: 'soon',
    name: 'csv',      note: 'csv ↔ json with a table preview',
    keys: 'tsv spreadsheet delimiter table excel' },
  { slug: 'markdown', group: 'data', status: 'soon',
    name: 'markdown', note: 'preview as you type, sanitised output',
    keys: 'md preview render readme' },

  /* ── web & crypto ─────────────────────────────────────────────── */
  { slug: 'qr',      group: 'web', status: 'soon',
    name: 'qr',      note: 'generate a code, export svg or png',
    keys: 'barcode scan wifi vcard' },
  { slug: 'image',   group: 'web', status: 'soon',
    name: 'image',   note: 'to data uri, with resize and format conversion',
    keys: 'base64 png jpeg webp resize convert favicon' },
  { slug: 'color',   group: 'web', status: 'soon',
    name: 'color',   note: 'hex, rgb, hsl, oklch and a wcag contrast check',
    keys: 'colour palette contrast accessibility' },
  { slug: 'cron',    group: 'web', status: 'soon',
    name: 'cron',    note: 'read an expression in plain english, see the next runs',
    keys: 'crontab schedule quartz' },
  { slug: 'gzip',    group: 'web', status: 'soon',
    name: 'gzip',    note: 'compress and decompress, natively',
    keys: 'deflate zlib compress brotli' },
  { slug: 'unicode', group: 'web', status: 'soon',
    name: 'unicode', note: 'code points, normalisation, invisible character hunt',
    keys: 'utf8 codepoint nfc nfd emoji homoglyph zero width' },
  { slug: 'password', group: 'web', status: 'soon',
    name: 'password', note: 'passwords and passphrases with an entropy estimate',
    keys: 'random generate secret passphrase entropy' },
  { slug: 'encrypt',  group: 'web', status: 'soon',
    name: 'encrypt',  note: 'aes-gcm with a passphrase, shareable as text',
    keys: 'decrypt aes pbkdf2 secret cipher' },

  /* ── misc ────────────────────────────────────────────── */
  { slug: 'curl',      group: 'misc', status: 'soon',
    name: 'curl',      note: 'turn a curl command into fetch or okhttp',
    keys: 'http request convert httpie' },
  { slug: 'cidr',      group: 'misc', status: 'soon',
    name: 'cidr',      note: 'subnet maths, ranges and host counts',
    keys: 'ip subnet netmask network vlsm' },
  { slug: 'sql',       group: 'misc', status: 'soon',
    name: 'sql',       note: 'format a query so it can be read',
    keys: 'format beautify query database' },
  { slug: 'dotenv',    group: 'misc', status: 'soon',
    name: 'dotenv',    note: '.env ↔ json, both directions',
    keys: 'env environment variables config' },
  { slug: 'ref',       group: 'misc', status: 'soon',
    name: 'reference', note: 'http status codes, mime types, ports',
    keys: 'cheatsheet lookup table codes' },
  { slug: 'human',     group: 'misc', status: 'soon',
    name: 'humanize',  note: 'durations and byte sizes, read either way',
    keys: 'bytes duration format size ms seconds' }
];

SK.tool = function (slug) {
  return SK.tools.find(function (t) { return t.slug === slug; }) || null;
};

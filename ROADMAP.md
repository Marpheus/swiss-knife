# roadmap

The list of tools also lives in `assets/registry.js`, which is what the
homepage and the ⌘K palette read. Ticking something off here means adding a
folder and flipping that entry's `status` from `soon` to `live`.

## shipped

- [x] **json** — format, minify, validate with the bad line marked in the
      gutter, sort keys, escape/unescape as a string literal, collapsible tree
- [x] **regex** — matches, capture groups (named too), replace preview,
      runs in a worker with a deadline so a runaway pattern cannot hang the tab
- [x] **base64** — text and files, UTF-8 safe, base64url, wrapping, data URIs,
      binary results detected by magic bytes and offered as a download
- [x] **jwt** — claims with dates and relative times, expiry state, signature
      verification for HS/RS/PS/ES via WebCrypto with a secret, PEM or JWK
- [x] **diff** — Myers, unified and side by side, word-level marks inside a
      changed line, hunks with context, unified patch to the clipboard

## phase 2 — dev essentials

- [ ] **hash** — md5, sha-1/256/384/512, hmac, crc32; text or file
- [ ] **uuid** — v4, v7, ulid, in bulk, with the embedded timestamp decoded
- [ ] **url** — encode/decode, take a query string apart and put it back
- [ ] **timestamp** — unix (s and ms) ↔ ISO 8601 ↔ human, several time zones

## phase 3 — text

- [ ] **case** — camel, pascal, snake, kebab, constant, title, sentence
- [ ] **lines** — sort, dedupe, reverse, shuffle, number, trim, join, split
- [ ] **text stats** — characters, words, bytes, frequency, reading time
- [ ] **escape** — json string, html entities, url, sql, shell, regex, C/Java
- [ ] **lorem** — by words, sentences or paragraphs

## phase 4 — data formats

- [ ] **csv** — csv ↔ json, RFC 4180, custom delimiter, table preview
- [ ] **markdown** — preview, output sanitised

## phase 5 — web & crypto

- [ ] **qr** — own encoder, svg and png export
- [ ] **image** — to data URI, resize and convert through canvas
- [ ] **color** — hex, rgb, hsl, oklch, WCAG contrast check
- [ ] **cron** — the expression in plain english plus the next runs
- [ ] **gzip** — compress and decompress through CompressionStream
- [ ] **unicode** — code points, NFC/NFD, invisible characters, homoglyphs
- [ ] **password** — passwords and passphrases with an entropy estimate
- [ ] **encrypt** — AES-GCM with a passphrase over PBKDF2

## phase 6 — misc

- [ ] **curl** — curl command into fetch or okhttp
- [ ] **cidr** — subnet maths, ranges, host counts
- [ ] **sql** — format a query
- [ ] **dotenv** — .env ↔ json
- [ ] **reference** — http status codes, mime types, ports
- [ ] **humanize** — durations and byte sizes, both directions

## house rules

- No dependencies, no build step. If an algorithm is needed, it gets written
  here or vendored as one readable file.
- Nothing may leave the page. Every page carries a CSP with
  `connect-src 'none'`, so a network call is not merely absent — it is
  refused by the browser.
- One entry in `assets/registry.js`, one folder, one `index.html` reusing
  `#bar` / `#tool-head` / `#foot`, one script. Shared behaviour belongs in
  `assets/ui.js`; shared looks belong in `assets/tool.css`.
- Anywhere a message can say "line 8", the pane gets `SK.ui.gutter` so nobody
  has to count.

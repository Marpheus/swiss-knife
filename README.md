# tools

[![CI](https://github.com/Marpheus/swiss-knife/actions/workflows/ci.yml/badge.svg)](https://github.com/Marpheus/swiss-knife/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Text and data tools that run entirely in the browser, live at
[tools.marpheus.dev](https://tools.marpheus.dev) and in the same visual
language as [marpheus.dev](https://marpheus.dev).

The point is the thing CyberChef and jwt.io cannot offer: a JWT, a payload or
a log pasted here is never uploaded, because the page is technically incapable
of uploading it. Every page carries

```
Content-Security-Policy: default-src 'self'; connect-src 'none'; …
```

so `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon` and remote
scripts/images are refused by the browser itself. Open DevTools and try —
each one raises a `securitypolicyviolation`.

<!-- screenshot: add one at docs/screenshot.png and uncomment
![The json tool](docs/screenshot.png)
-->

## features

- **json**: format (2, 4 or tab indent), minify, sort keys, browse as a
  tree, and convert to and from a JSON string. When the input is invalid, a
  hand-written scanner finds the fault and marks the line in the gutter.
- **regex**: matches, capture groups and a replace preview. Matching runs
  in a worker that is killed after 1.5 s, so a catastrophically backtracking
  pattern cannot hang the tab.
- **base64**: text and files, UTF-8 safe, with options for URL-safe output,
  76-column wrapping and data URIs. PNG, JPEG, GIF, PDF, zip and gzip results
  are recognised by their magic bytes and offered as a download.
- **jwt**: claims with readable dates, expiry and not-before checks, and
  signature verification for HS, RS, PS and ES at 256/384/512 through
  WebCrypto. The key can be a secret (optionally base64), a PEM public key or
  a JWK. The key is never remembered.
- **diff**: by line or by word, unified or side by side, with ignore
  whitespace, ignore case, and a unified patch to copy. It uses Myers,
  written out in `assets/myers.js`.

Across all of them: ⌘K / Ctrl+K opens a palette of tools, a file can be
dropped onto the input, results copy with one click (json and base64 also
download), there is a light and a dark theme, and what you type is kept in
`localStorage` per tool (up to 200,000 characters per field) so a reload
loses nothing. It never leaves the browser.

## tech stack

Plain HTML, CSS and JavaScript. No framework, no build step, no runtime
dependencies and no backend. Browser APIs do the heavy lifting: WebCrypto for
signatures, a Web Worker for regex, and `TextEncoder`/`TextDecoder` for
bytes. ESLint and Prettier are dev-only tooling. Nothing they install is
served.

## getting started

Any static server will do. Paths are absolute, so serve from the folder root:

```sh
npm start                 # python3 -m http.server 8080
```

For the tooling you need Node (version in `.nvmrc`):

```sh
npm ci
npm run lint              # ESLint
npm run format            # Prettier, rewriting files
npm run format:check      # Prettier, checking only (what CI runs)
npm test                  # the Myers diff against a brute-force LCS
```

CI runs lint, the format check and the tests on every push and pull request.

## deploying

The repository is the site. `netlify.toml` publishes it as is with the CSP
and the other security headers sent as real headers, and returns 404 for the
files that only belong to the repo (tests, README, tooling).

Anywhere else, the requirements are that `/` serves `index.html`, that
`404.html` is wired up as the not-found page, and that it is served from a
domain root, which a subdomain gives you. Filenames carry no content hash,
so serve everything with a revalidating cache header.

## layout

```
index.html            the list of tools
404.html
assets/
  base.css            tokens, chrome, cards — shared with marpheus.dev
  tool.css            the shell every tool borrows
  registry.js         the one list of tools; everything else reads it
  chrome.js           builds a tool page's header and footer from it
  ui.js               copy, download, file drop, autosave, status line,
                      line-number gutters, ⌘K
  bytes.js            UTF-8 safe base64, hex, sizes
  myers.js            the diff algorithm, on its own so it can be tested
  theme-init.js       runs before first paint so the theme never flashes
  theme.js            the toggle and the entrance animation
  home.js             the homepage list and its filter
json/ regex/ base64/ jwt/ diff/
test/                 node tests, not served
```

## adding a tool

1. Add an entry to `assets/registry.js`. The homepage and the ⌘K palette pick
   it up immediately.
2. Copy the closest existing `index.html`. Keep the CSP block, the
   `#bar` / `#tool-head` / `#foot` placeholders and the script order —
   `registry.js` and `chrome.js` load synchronously so the header is there
   before the first paint; everything else is deferred.
3. Write `<slug>/<slug>.js`. Take `SK.ui` for the plumbing and put anything
   another tool might want in `assets/`.

Shared looks belong in `assets/tool.css`, not in a per-tool stylesheet — that
is what keeps the set looking like one set.

## credits

No third-party code ships with the site. The diff follows Eugene W. Myers,
[_An O(ND) Difference Algorithm and Its Variations_](https://doi.org/10.1007/BF01840446)
(Algorithmica, 1986). Linting and formatting by [ESLint](https://eslint.org)
and [Prettier](https://prettier.io).

## license

[MIT](LICENSE)

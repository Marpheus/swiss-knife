# swiss-knife

Text and data tools that run entirely in the browser, in the same visual
language as [marpheus.dev](https://marpheus.dev). Meant for
`tools.marpheus.dev`.

The point is the thing CyberChef and jwt.io cannot offer: a JWT, a payload or
a log pasted here is never uploaded, because the page is technically incapable
of uploading it. Every page carries

```
Content-Security-Policy: default-src 'self'; connect-src 'none'; …
```

so `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon` and remote
scripts/images are refused by the browser itself. Open DevTools and try —
each one raises a `securitypolicyviolation`.

## running it

No build, no dependencies, no backend. Any static server will do:

```sh
python3 -m http.server 8080
```

## deploying

Upload the folder. The only requirements are that `/` serves `index.html`,
that `404.html` is wired up as the not-found page, and that it is served from
a domain root (paths are absolute, e.g. `/assets/base.css`), which a subdomain
gives you.

Serve `.js` and `.css` with a normal cache header and the HTML with a short
one; there are no hashed filenames.

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
```

## adding a tool

1. Flip its entry in `assets/registry.js` from `status: 'soon'` to `'live'`
   (or add one). The homepage and the ⌘K palette pick it up immediately.
2. Copy the closest existing `index.html`. Keep the CSP block, the
   `#bar` / `#tool-head` / `#foot` placeholders and the script order —
   `registry.js` and `chrome.js` load synchronously so the header is there
   before the first paint; everything else is deferred.
3. Write `<slug>/<slug>.js`. Take `SK.ui` for the plumbing and put anything
   another tool might want in `assets/`.

Shared looks belong in `assets/tool.css`, not in a per-tool stylesheet — that
is what keeps the set looking like one set.

`ROADMAP.md` has the queue.

## testing

The parts worth checking are the ones with an algorithm behind them. The diff
is verified against a brute-force LCS on random inputs:

```sh
node test/myers.test.js
```

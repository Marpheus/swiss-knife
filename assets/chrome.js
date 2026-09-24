/* Header and footer for tool pages, built from the registry.

   Loaded synchronously in the middle of <body> rather than deferred, so the
   bar exists before the first paint and nothing pops in. Reads the slug from
   <body data-tool="…">. */
(function () {
  var slug = document.body.dataset.tool;
  var tool = (window.SK && SK.tool(slug)) || { name: slug, note: '' };

  var bar = document.getElementById('bar');
  if (bar) {
    bar.className = 'bar';
    bar.innerHTML =
      '<a class="crumb" href="/">tools</a>' +
      '<span class="crumb-sep" aria-hidden="true">/</span>' +
      '<span class="crumb-now">' +
      esc(tool.name) +
      '</span>' +
      '<span class="spacer"></span>' +
      '<button class="jump" type="button" id="jump">' +
      '<span class="jump-word">jump to</span><kbd>⌘K</kbd>' +
      '</button>' +
      '<button class="theme" type="button" aria-label="Switch colour theme" aria-pressed="false">' +
      '<span class="dial" aria-hidden="true"></span>' +
      '</button>';
  }

  var head = document.getElementById('tool-head');
  if (head) {
    head.className = 'tool-head';
    head.innerHTML =
      '<h1 class="tool-name">' +
      esc(tool.name) +
      '</h1>' +
      '<p class="tool-note">' +
      esc(tool.note) +
      '</p>';
  }

  var foot = document.getElementById('foot');
  if (foot) {
    foot.className = 'foot';
    foot.innerHTML =
      '<p class="vow">nothing here leaves your browser</p>' + '<p><a href="/">all tools</a></p>';
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
})();

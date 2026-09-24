/* Runs the pattern away from the UI thread.

   A regex tester is the one tool where the user is expected to write something
   broken, and /(a+)+$/ against a long line of a's will hang a thread for
   longer than anyone will wait. JavaScript has no way to interrupt a running
   match, so the only real defence is to run it somewhere that can be killed:
   the main thread gives this worker a deadline and terminates it if it passes. */
self.onmessage = function (e) {
  var job = e.data;
  try {
    self.postMessage({ ok: true, result: work(job) });
  } catch (err) {
    self.postMessage({ ok: false, error: String((err && err.message) || err) });
  }
};

var MAX_MATCHES = 5000;

function work(job) {
  var flags = job.flags.indexOf('g') === -1 ? job.flags + 'g' : job.flags;
  var re = new RegExp(job.pattern, flags);
  var text = job.text;

  var matches = [];
  var truncated = false;
  var m;

  while ((m = re.exec(text)) !== null) {
    matches.push({
      index: m.index,
      end: m.index + m[0].length,
      text: m[0],
      groups: Array.prototype.slice.call(m, 1),
      named: m.groups ? Object.assign({}, m.groups) : null
    });

    /* a pattern that can match nothing would otherwise never advance */
    if (m[0] === '') re.lastIndex++;
    if (matches.length >= MAX_MATCHES) {
      truncated = true;
      break;
    }
    /* without the g flag the caller only wanted the first hit */
    if (job.flags.indexOf('g') === -1) break;
  }

  var replaced = null;
  if (job.replacement !== null && job.replacement !== undefined) {
    var reR = new RegExp(job.pattern, job.flags);
    replaced = text.replace(reR, job.replacement);
  }

  return { matches: matches, truncated: truncated, replaced: replaced };
}

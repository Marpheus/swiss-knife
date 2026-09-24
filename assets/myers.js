/* Myers' O(ND) difference algorithm — the one git uses.

   Written out rather than pulled from a package: this site ships no
   dependencies, and it is about eighty lines. Two practical additions on top
   of the paper: identical prefixes and suffixes are trimmed before the search
   starts, and the search abandons past a set edit distance so two unrelated
   files cannot eat the tab.

   SK.myers(a, b) takes two arrays of comparable primitives and returns a flat
   edit script — [{op, ai, bi}] with op 0 keep, -1 remove, 1 add — or null if
   the two are further apart than maxD allows. */
window.SK = window.SK || {};

SK.myers = (function () {
  var DEFAULT_MAX_D = 3000;

  function diff(a, b, maxD) {
    var n = a.length,
      m = b.length;

    /* the ends usually agree; taking them out first shrinks the search a lot */
    var pre = 0;
    while (pre < n && pre < m && a[pre] === b[pre]) pre++;
    var post = 0;
    while (post < n - pre && post < m - pre && a[n - 1 - post] === b[m - 1 - post]) post++;

    var mid = search(
      a.slice(pre, n - post),
      b.slice(pre, m - post),
      maxD == null ? DEFAULT_MAX_D : maxD
    );
    if (mid === null) return null;

    var script = [];
    var i;
    for (i = 0; i < pre; i++) script.push({ op: 0, ai: i, bi: i });
    for (i = 0; i < mid.length; i++) {
      var e = mid[i];
      script.push({
        op: e.op,
        ai: e.ai === null ? null : e.ai + pre,
        bi: e.bi === null ? null : e.bi + pre
      });
    }
    for (i = 0; i < post; i++) script.push({ op: 0, ai: n - post + i, bi: m - post + i });
    return script;
  }

  function search(a, b, maxD) {
    var n = a.length,
      m = b.length;
    if (!n && !m) return [];
    if (!n)
      return b.map(function (_, i) {
        return { op: 1, ai: null, bi: i };
      });
    if (!m)
      return a.map(function (_, i) {
        return { op: -1, ai: i, bi: null };
      });

    var max = Math.min(n + m, maxD);
    var off = n + m;
    var v = new Int32Array(2 * (n + m) + 1);
    var trace = [];

    for (var d = 0; d <= max; d++) {
      /* only the diagonals this step can reach are worth keeping, which is
         what makes the trace O(D²) rather than O(D·(N+M)) */
      trace.push(v.slice(off - d, off + d + 1));
      for (var k = -d; k <= d; k += 2) {
        var x;
        if (k === -d || (k !== d && v[off + k - 1] < v[off + k + 1])) x = v[off + k + 1];
        else x = v[off + k - 1] + 1;
        var y = x - k;
        while (x < n && y < m && a[x] === b[y]) {
          x++;
          y++;
        }
        v[off + k] = x;
        if (x >= n && y >= m) return backtrack(trace, d, n, m);
      }
    }
    return null;
  }

  /* Walks the trace backwards from the bottom-right corner. At each step the
     frontier tells us which of the two neighbouring diagonals we came from;
     everything between that point and here was a run of equal elements. */
  function backtrack(trace, d, n, m) {
    var out = [];
    var x = n,
      y = m;

    for (; d > 0; d--) {
      var v = trace[d]; /* the frontier as it stood before step d ran */
      var k = x - y;
      var down = k === -d || (k !== d && at(v, d, k - 1) < at(v, d, k + 1));
      var kPrev = down ? k + 1 : k - 1;
      var xStart = at(v, d, kPrev);
      var yStart = xStart - kPrev;
      var xMid = down ? xStart : xStart + 1;
      var yMid = xMid - k;

      while (x > xMid && y > yMid) {
        x--;
        y--;
        out.push({ op: 0, ai: x, bi: y });
      }
      if (down) {
        y--;
        out.push({ op: 1, ai: null, bi: y });
      } else {
        x--;
        out.push({ op: -1, ai: x, bi: null });
      }
      x = xStart;
      y = yStart;
    }
    while (x > 0 && y > 0) {
      x--;
      y--;
      out.push({ op: 0, ai: x, bi: y });
    }

    return out.reverse();
  }

  /* trace[d] only stores diagonals -d … d, so index into it accordingly */
  function at(row, d, k) {
    var i = k + d;
    return i < 0 || i >= row.length ? -1 : row[i];
  }

  return diff;
})();

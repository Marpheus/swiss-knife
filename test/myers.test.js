/* Checks SK.myers against a brute-force LCS on random inputs.
   Two properties must hold for every case:
     1. applying the script to `a` reproduces `b` exactly
     2. the number of kept elements equals the true LCS length (i.e. the
        script is minimal, which is the entire point of Myers) */
const fs = require('fs');
const path = require('path').join(__dirname, '..', 'assets', 'myers.js');
/* in a browser `window` is the global object, so mirror that here */
global.window = global;
eval(fs.readFileSync(path, 'utf8'));
const myers = global.SK.myers;

function lcsLen(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Int32Array(b.length + 1));
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  return dp[a.length][b.length];
}

function apply(script, a, b) {
  const out = [];
  for (const e of script) {
    if (e.op === 0) out.push(a[e.ai]);
    else if (e.op === 1) out.push(b[e.bi]);
  }
  return out;
}

function checkIndices(script, a, b) {
  // ai must walk a in order and cover every removal/keep exactly once
  let ai = 0, bi = 0;
  for (const e of script) {
    if (e.op === 0) {
      if (e.ai !== ai || e.bi !== bi) return `index drift at keep: ${e.ai}/${ai} ${e.bi}/${bi}`;
      if (a[e.ai] !== b[e.bi]) return `keep of unequal items: ${a[e.ai]} vs ${b[e.bi]}`;
      ai++; bi++;
    } else if (e.op === -1) {
      if (e.ai !== ai || e.bi !== null) return `bad remove entry at ${ai}`;
      ai++;
    } else {
      if (e.bi !== bi || e.ai !== null) return `bad add entry at ${bi}`;
      bi++;
    }
  }
  if (ai !== a.length || bi !== b.length) return `did not consume both: ${ai}/${a.length} ${bi}/${b.length}`;
  return null;
}

let fails = 0, cases = 0;
const alphabets = ['ab', 'abc', 'abcdefgh'];

for (let round = 0; round < 4000; round++) {
  const alpha = alphabets[round % alphabets.length];
  const n = Math.floor(Math.random() * 14);
  const m = Math.floor(Math.random() * 14);
  const a = Array.from({ length: n }, () => alpha[Math.floor(Math.random() * alpha.length)]);
  const b = Array.from({ length: m }, () => alpha[Math.floor(Math.random() * alpha.length)]);

  const script = myers(a, b);
  cases++;
  if (script === null) { console.log('NULL for', a.join(''), b.join('')); fails++; continue; }

  const rebuilt = apply(script, a, b).join('');
  const kept = script.filter(e => e.op === 0).length;
  const want = lcsLen(a, b);
  const idx = checkIndices(script, a, b);

  if (rebuilt !== b.join('') || kept !== want || idx) {
    fails++;
    if (fails <= 5) {
      console.log('FAIL a=%j b=%j', a.join(''), b.join(''));
      console.log('  rebuilt=%j want=%j', rebuilt, b.join(''));
      console.log('  kept=%d lcs=%d indices=%s', kept, want, idx || 'ok');
      console.log('  script=', JSON.stringify(script));
    }
  }
}

// a few shapes worth pinning down explicitly
const edge = [
  [[], []], [[], ['a']], [['a'], []], [['a'], ['a']],
  [['a', 'b', 'c'], ['a', 'b', 'c']],
  [['a', 'b', 'c'], ['x', 'y', 'z']],
  ['ABCABBA'.split(''), 'CBABAC'.split('')],   // the example from Myers' paper
];
for (const [a, b] of edge) {
  cases++;
  const s = myers(a, b);
  const rebuilt = apply(s, a, b).join('');
  const kept = s.filter(e => e.op === 0).length;
  const want = lcsLen(a, b);
  const idx = checkIndices(s, a, b);
  if (rebuilt !== b.join('') || kept !== want || idx) {
    fails++;
    console.log('EDGE FAIL', a.join(''), b.join(''), rebuilt, kept, want, idx);
  }
}

// the give-up path
const big = Array.from({ length: 500 }, (_, i) => 'x' + i);
const other = Array.from({ length: 500 }, (_, i) => 'y' + i);
console.log('maxD guard returns null:', myers(big, other, 50) === null);

// and that it still finishes a large but similar pair quickly
const base = Array.from({ length: 20000 }, (_, i) => 'line ' + i);
const edited = base.slice();
for (let i = 0; i < 40; i++) edited[Math.floor(Math.random() * edited.length)] = 'changed ' + i;
const t0 = Date.now();
const bigScript = myers(base, edited);
console.log('20k lines, 40 edits:', bigScript ? (Date.now() - t0) + 'ms' : 'gave up');

console.log(`\n${cases - fails}/${cases} passed`);
process.exit(fails ? 1 : 0);

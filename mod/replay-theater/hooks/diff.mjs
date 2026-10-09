// Pure diff helpers for Replay Theater: line diffs, word highlights, counts.

export const MAX_DIFF_LINES = 12;
const MAX_LCS_LINES = 400;

export function splitLines(text) {
  if (text === undefined || text === null || text === "") return [];
  const lines = String(text).split("\n");
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

// LCS over two arrays: [op, item] pairs, " " kept, "-" from a, "+" from b.
function lcs(a, b) {
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push([" ", a[i]]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push(["-", a[i++]]);
    else out.push(["+", b[j++]]);
  }
  while (i < n) out.push(["-", a[i++]]);
  while (j < m) out.push(["+", b[j++]]);
  return out;
}

// A line diff. Lines shared at the start and end are set aside and the
// middle gets an LCS diff, so unchanged lines show as context; a middle too
// large for LCS falls back to all-removed then all-added.
export function diffLines(oldText, newText) {
  const a = splitLines(oldText);
  const b = splitLines(newText);
  let pre = 0, post = 0;
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
  while (post < a.length - pre && post < b.length - pre && a[a.length - 1 - post] === b[b.length - 1 - post]) post++;
  const midA = a.slice(pre, a.length - post), midB = b.slice(pre, b.length - post);
  const mid = midA.length > MAX_LCS_LINES || midB.length > MAX_LCS_LINES
    ? [...midA.map((t) => ["-", t]), ...midB.map((t) => ["+", t])]
    : lcs(midA, midB);
  const pairs = [...a.slice(0, pre).map((t) => [" ", t]), ...mid, ...a.slice(a.length - post).map((t) => [" ", t])];
  return addWords(trimContext(pairs.map(([op, t]) => ({ op, t }))));
}

// Keep one line of context around each change, so a long file's Write shows
// the changed lines, not the whole file.
function trimContext(lines) {
  if (!lines.some((l) => l.op !== " ")) return lines.slice(0, MAX_DIFF_LINES);
  const keep = lines.map((l, k) =>
    l.op !== " " || lines[k - 1]?.op && lines[k - 1].op !== " " || lines[k + 1]?.op && lines[k + 1].op !== " ");
  const out = [];
  let skipped = false;
  lines.forEach((l, k) => {
    if (keep[k]) { if (skipped && out.length) out.push({ op: "~", t: "⋯" }); out.push(l); skipped = false; }
    else skipped = true;
  });
  return out;
}

// Splits two lines into segments and marks the words that changed.
export function wordDiff(oldLine, newLine) {
  const tok = (s) => s.match(/\w+|\s+|[^\w\s]/g) ?? [];
  const before = [], after = [];
  const push = (list, t, changed) => {
    const last = list[list.length - 1];
    if (last && last.changed === changed) last.t += t; else list.push({ t, changed });
  };
  for (const [op, t] of lcs(tok(oldLine), tok(newLine))) {
    if (op !== "+") push(before, t, op === "-");
    if (op !== "-") push(after, t, op === "+");
  }
  return { before, after };
}

// In each run of removed lines followed by added lines, pairs them up in
// order and gives each paired line `segs`, its words marked changed or not.
function addWords(lines) {
  for (let k = 0; k < lines.length; ) {
    let d = k; while (lines[d]?.op === "-") d++;
    let a = d; while (lines[a]?.op === "+") a++;
    const pairs = Math.min(d - k, a - d);
    for (let p = 0; p < pairs; p++) {
      const { before, after } = wordDiff(lines[k + p].t, lines[d + p].t);
      lines[k + p].segs = before;
      lines[d + p].segs = after;
    }
    k = a > k ? a : k + 1;
  }
  return lines;
}

export function countChanges(diff) {
  let add = 0, del = 0;
  for (const l of diff) { if (l.op === "+") add++; else if (l.op === "-") del++; }
  return { add, del };
}

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// "4 edits in 4 files" and the turn's total added and removed lines.
export function summary(steps) {
  const files = new Set(steps.map((s) => s.file)).size;
  let add = 0, del = 0;
  for (const s of steps) { const c = countChanges(s.diff); add += c.add; del += c.del; }
  return { title: `${plural(steps.length, "edit")} in ${plural(files, "file")}`, add, del };
}

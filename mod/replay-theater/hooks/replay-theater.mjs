// Copyright 2026 Anthropic PBC
// SPDX-License-Identifier: Apache-2.0
//
// Replay Theater: records the file edits Claude makes in a turn, then lets you
// step through them in a pane, one diff at a time.
//
// Claude Code 2.1.280 function hooks. Load with --plugin-dir.

import { diffLines, countChanges, summary } from "./diff.mjs";

const PANE_ID = "replay-theater";
const MAX_TIMELINE = 8;
const PANE_COLUMNS = 120;
const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit"]);
// Dark diff tints, so white text stays readable: line, then changed word.
const ADD_LINE = "#0e1d14", ADD_WORD = "#183a23";
const DEL_LINE = "#200e10", DEL_WORD = "#461b20";
const EXPLAIN_ROWS = 8;

// Module state. `pending` fills during a turn; `replay` is the last finished
// turn's steps, the ones the pane shows.
const state = { pending: [], replay: [], index: 0, isOpen: false, inBand: false, turns: 0 };

function relPath(cwd, path) {
  if (!path) return "(unknown file)";
  if (cwd && path.startsWith(cwd + "/")) return path.slice(cwd.length + 1);
  return path;
}

// Turns one tool call into one or more steps.
async function stepsFor($, e) {
  let cwd = "";
  try { cwd = await $.session.cwd(); } catch { /* keep the full path */ }
  const file = relPath(cwd, e.file_path);
  if (e.tool === "Edit") {
    return [{ tool: "Edit", file, diff: diffLines(e.old_string, e.new_string), note: e.replace_all ? "replace all" : "" }];
  }
  if (e.tool === "MultiEdit" && Array.isArray(e.edits)) {
    return e.edits.map((ed, k) => ({
      tool: "MultiEdit", file, diff: diffLines(ed.old_string, ed.new_string), note: `edit ${k + 1} of ${e.edits.length}`,
    }));
  }
  if (e.tool === "Write") {
    let before = "";
    let isNew = true;
    try {
      if (e.file_path && (await $.fs.exists(e.file_path))) {
        before = await $.fs.read(e.file_path);
        isNew = false;
      }
    } catch { /* unreadable: show it as a new file */ }
    return [{ tool: "Write", file, diff: diffLines(before, e.content), note: isNew ? "new file" : "rewrite" }];
  }
  return [];
}

// Words in a Bash command that look like file paths, made absolute. Globs,
// variables and flags are skipped, so files reached that way aren't seen.
function bashPaths(command, cwd) {
  const words = String(command ?? "").split(/[\s;|&<>()]+/).map((w) => w.replace(/^['"]|['"]$/g, ""));
  const paths = words.filter((w) => /[./]/.test(w) && !/^-|[$*?{}`'"=]/.test(w) && !/^\.+$/.test(w));
  return [...new Set(paths.map((p) => (p.startsWith("/") || !cwd ? p : `${cwd}/${p}`)))].slice(0, 20);
}

// Each named file's text before a Bash command runs; null when it doesn't exist.
async function snapshot($, paths) {
  const texts = new Map();
  for (const path of paths) {
    try { texts.set(path, (await $.fs.exists(path)) ? await $.fs.read(path) : null); } catch { /* a folder or unreadable */ }
  }
  return texts;
}

// The files a Bash command changed, as steps.
async function bashSteps($, cwd, before) {
  const steps = [];
  for (const [path, old] of before) {
    try {
      if (!(await $.fs.exists(path))) continue;
      const now = await $.fs.read(path);
      if (now !== old) steps.push({ tool: "Bash", file: relPath(cwd, path), diff: diffLines(old ?? "", now), note: old === null ? "new file" : "bash" });
    } catch { /* unreadable */ }
  }
  return steps;
}

// A step's diff as unified-diff hunks; each "⋯" gap starts a new hunk.
// Line numbers count from 1 within the edit, not the file.
function unifiedDiff(lines) {
  const hunks = [];
  let h = null, a = 1, b = 1;
  for (const l of lines) {
    if (l.op === "~" || !h) {
      h = { a, b, old: 0, new: 0, body: [] };
      hunks.push(h);
      if (l.op === "~") continue;
    }
    h.body.push(l.op + l.t);
    if (l.op !== "+") { h.old++; a++; }
    if (l.op !== "-") { h.new++; b++; }
  }
  return hunks.filter((x) => x.body.length)
    .map((x) => `@@ -${x.a},${x.old} +${x.b},${x.new} @@\n${x.body.join("\n")}`).join("\n");
}

// The unslop skill's rules, for the explain prompt. Empty if it's missing.
async function unslopRules($) {
  try {
    const text = await $.fs.read(`${await $.env.get("HOME")}/.claude/skills/unslop/SKILL.md`);
    return text.replace(/^---[\s\S]*?---\s*/, "");
  } catch { return ""; }
}

// Asks the model, over this conversation, what one edit's changed lines do.
// The answer (or the failure) is kept on the step, so it's asked once.
async function explain($, step) {
  if (step.explain) return;
  step.explain = { pending: true };
  $.ui.invalidate("ui.render");
  const rules = await unslopRules($);
  const r = await $.model.fork({ prompt:
    `Explain this edit to ${step.file} to a non-technical person: what it changes and why, in everyday words. ` +
    `Describe what the edit does as a whole, not line by line. Avoid jargon and code names; if one can't be avoided, say what it means in a few words. ` +
    `Simplify as much as you can: a small edit needs a sentence or two, a complex one as much as it takes. Markdown, no preamble.` +
    (rules ? `\n\nWrite it following these rules:\n\n${rules}` : "") +
    `\n\n\`\`\`diff\n${unifiedDiff(step.diff)}\n\`\`\`` })
    .catch((err) => ({ isAnswered: false, reason: String(err?.message ?? err) }));
  step.explain = r.isAnswered ? { text: r.text.trim() } : { error: `Couldn't explain (${r.reason}).` };
  $.ui.invalidate("ui.render");
}

function hintText() {
  const n = state.replay.length;
  return `${n} edit${n === 1 ? "" : "s"} in the last turn`;
}

async function openReplay($) {
  if (!state.replay.length) return false;
  state.index = 0;
  state.isOpen = true;
  // The pane only takes the keyboard while nothing else holds it. Hide the
  // band first (it held the keys if its button was pressed), then open.
  $.ui.invalidate("ui.render");
  await $.clock.sleep(200);
  const rows = Math.min(60, 18 + Math.min(state.replay.length, MAX_TIMELINE) + Math.max(...state.replay.map((s) => s.diff.length)) + EXPLAIN_ROWS);
  const placed = await $.ui.open({ id: PANE_ID, title: "Replay Theater", focus: true, closeOnEscape: true, rows, columns: PANE_COLUMNS });
  // No room for a pane (a narrow terminal): draw the replay in the band.
  state.inBand = placed?.isPlaced === false;
  $.ui.invalidate("ui.render");
  return true;
}

// The replay view: a summary, a timeline of every edit, then the current
// edit's diff. Drawn in the Pane, or in the band above the prompt when the
// surface can't place a pane (there without the timeline).
function replayView($, e, inBand) {
  const { Box, Text, Button, Markdown } = $.ui.resolve(e);
  // The desktop draws hotkeys as chips on its buttons, so it gets none.
  const hotkey = (h) => (e.surface === "desktop" ? {} : { hotkey: h });
  const total = state.replay.length;
  if (!total) return Text({ dimColor: true, children: "No edits to replay." });
  const k = Math.max(0, Math.min(state.index, total - 1));
  const step = state.replay[k];
  const last = k === total - 1;
  const go = (to) => { state.index = Math.max(0, Math.min(to, total - 1)); $.ui.invalidate("ui.render"); };
  const close = () => {
    state.isOpen = false;
    if (!state.inBand) $.ui.close({ id: PANE_ID });
    state.inBand = false;
    $.ui.invalidate("ui.render");
  };
  const split = (file) => {
    const cut = file.lastIndexOf("/");
    return cut < 0 ? { name: file, dir: "" } : { name: file.slice(cut + 1), dir: file.slice(0, cut) };
  };

  // Summary.
  const sum = summary(state.replay);
  const reviewed = state.replay.filter((s) => s.reviewed).length;
  const header = Text({ key: "title", children: [
    Text({ bold: true, children: sum.title }),
    ", ",
    Text({ color: "green", children: `+${sum.add}` }),
    " ",
    Text({ color: "red", children: `−${sum.del}` }),
    reviewed ? `, ${reviewed} of ${total} reviewed` : "",
  ] });

  // Timeline: the current step gets a › pointer and a bold name, reviewed
  // steps a green check and a dim name, the rest a dim number. Long turns show a window of steps. Names, folders and
  // counts are padded to the widest in the window, so the columns line up.
  const lo = Math.max(0, Math.min(k - Math.floor(MAX_TIMELINE / 2), total - MAX_TIMELINE));
  const hi = Math.min(total, lo + MAX_TIMELINE);
  const rows = state.replay.slice(lo, hi).map((s) => ({ ...split(s.file), c: countChanges(s.diff) }));
  const widest = (f) => Math.max(...rows.map(f));
  const nameW = widest((r) => r.name.length);
  const dirW = widest((r) => r.dir.length);
  const addW = widest((r) => String(r.c.add).length) + 1;
  const delW = widest((r) => String(r.c.del).length) + 1;
  // The label runs from the name to the counts: the row's width less the
  // paddings, pointer, badge, counts, five gaps and two spare cells.
  const cols = Math.min(e.props?.bodyColumns ?? e.viewport?.columns ?? 64, PANE_COLUMNS);
  const labelW = Math.max(nameW + 1 + dirW, cols - 3 - 1 - 3 - addW - delW - 5 - 2);
  const timeline = [];
  if (lo > 0) timeline.push(Text({ key: "above", dimColor: true, children: `    ⋮ ${lo} earlier` }));
  for (let n = lo; n < hi; n++) {
    const { name, dir, c } = rows[n - lo];
    const current = n === k;
    const done = !!state.replay[n].reviewed;
    const label = `${name.padEnd(nameW)} ${dir}`.padEnd(labelW);
    timeline.push(Box({
      key: `row${n}`, flexDirection: "row", gap: 1, paddingRight: 1,
      children: [
        Text({ children: current ? "›" : " " }),
        done ? Text({ color: "green", children: " ✓ " }) : Text({ bold: current, dimColor: !current, children: ` ${n + 1} ` }),
        // You're already on the current step, so its name isn't a button.
        current ? Text({ bold: true, children: label })
          : Button({ key: `go${n}`, label, plain: true, dimColor: done, onPress: () => go(n) }),
        Box({ flexGrow: 1 }),
        Text({ color: "green", children: `+${c.add}`.padStart(addW) }),
        Text({ color: "red", children: `−${c.del}`.padStart(delW) }),
      ],
    }));
  }
  if (hi < total) timeline.push(Text({ key: "below", dimColor: true, children: `    ⋮ ${total - hi} more` }));

  // The current edit's diff: whole lines tinted, changed words brighter.
  const diffRows = step.diff.map((l, n) => {
    if (l.op !== "+" && l.op !== "-") {
      return Text({ key: `d${n}`, dimColor: true, wrap: "truncate-end", children: `  ${l.t}` });
    }
    const added = l.op === "+";
    const segs = l.segs ?? [{ t: l.t, changed: false }];
    return Box({
      key: `d${n}`, flexDirection: "row", backgroundColor: added ? ADD_LINE : DEL_LINE,
      children: [Text({ wrap: "truncate-end", children: [
        Text({ bold: true, color: added ? "green" : "red", children: added ? "+ " : "− " }),
        ...segs.map((g, i) => Text({
          key: `w${i}`, backgroundColor: g.changed ? (added ? ADD_WORD : DEL_WORD) : undefined,
          children: g.t,
        })),
      ] })],
    });
  });
  if (!step.diff.length) diffRows.push(Text({ key: "empty", dimColor: true, children: "  (no line changes)" }));

  return Box({
    flexDirection: "column", paddingX: 1, gap: inBand ? 0 : 1,
    children: [
      header,
      inBand ? null : Box({ flexDirection: "column", children: timeline }),
      Box({ flexDirection: "row", gap: 1, children: [
        Text({ key: "step-heading", dimColor: true, children: `Edit ${k + 1} of ${total} ·` }),
        Text({ key: "step-name", bold: true, children: split(step.file).name }),
        step.note ? Text({ key: "step-note", dimColor: true, children: step.note }) : null,
      ] }),
      // Buttons that don't fit wrap to another row, a blank line apart.
      Box({ key: "buttons", flexDirection: "row", flexWrap: "wrap", columnGap: 2, rowGap: 1, children: [
        Button({ key: "prev", label: "Previous", ...hotkey("p"), variant: "secondary", dimColor: k === 0, onPress: () => go(k - 1) }),
        Button({ key: "next", label: last ? "Done" : "Next", ...hotkey("n"), variant: "secondary", onPress: () => (last ? close() : go(k + 1)) }),
        // Marks the edit and moves on; on a reviewed edit, removes the mark.
        Button({ key: "reviewed", label: step.reviewed ? "Unreview" : "Reviewed", ...hotkey("v"), variant: "primary", autoFocus: true,
          onPress: () => { step.reviewed = !step.reviewed; go(step.reviewed ? k + 1 : k); } }),
        Button({ key: "explain", label: step.explain?.pending ? "Explaining…" : step.explain?.text ? "Explained" : "Explain",
          ...hotkey("e"), variant: "secondary", dimColor: !!step.explain?.text, onPress: () => { explain($, step); } }),
        Button({ key: "close", label: "Close", ...hotkey("c"), role: "dismiss", dimColor: true, onPress: close }),
      ] }),
      Box({ key: "diff", flexDirection: "column", borderStyle: "round", borderColor: "gray", children: diffRows }),
      step.explain?.text ? Box({ flexDirection: "column", children: [
        Text({ key: "explain-label", dimColor: true, children: "Explanation" }),
        Markdown({ key: "explain-text", text: step.explain.text }),
      ] }) : null,
      step.explain?.error ? Text({ key: "explain-error", wrap: "wrap", color: "red", children: step.explain.error }) : null,
    ],
  });
}

export function register(on, options) {
  // Slash command: /replay opens the pane.
  on("session.start", async ($, e, next) => {
    const r = await next(e);
    await $.command.register({ name: "replay", description: "Replay Theater: step through the last turn's file edits" });
    return r;
  });

  on("command.run", { command: "replay" }, async ($, e) => {
    const opened = await openReplay($);
    return { text: opened ? `Replay Theater: ${state.replay.length} edits` : "Replay Theater: no edits in the last turn." };
  });

  // Record each edit, then let it run. Never blocks the call.
  on("tool.call", async ($, e, next) => {
    if (EDIT_TOOLS.has(e.tool)) {
      try {
        const steps = await stepsFor($, e);
        state.pending.push(...steps);
      } catch { /* recording must never stop the edit */ }
    }
    if (e.tool !== "Bash") return next(e);
    // Bash: compare the files named in the command before and after it runs.
    let cwd = "", before = new Map();
    try {
      cwd = await $.session.cwd();
      before = await snapshot($, bashPaths(e.command, cwd));
    } catch { /* recording must never stop the command */ }
    const r = await next(e);
    try { state.pending.push(...(await bashSteps($, cwd, before))); } catch { /* as above */ }
    return r;
  });

  on("turn.start", ($, e, next) => {
    if (!e.agentId) state.pending = [];
    return next(e);
  });

  // At the end of a main-loop turn, the pending edits become the replay.
  on("turn.complete", async ($, e, next) => {
    const r = await next(e);
    if (e.agentId || !state.pending.length) return r;
    state.replay = state.pending;
    state.pending = [];
    state.index = 0;
    state.turns++;
    $.ui.invalidate("ui.render");
    return r;
  });

  // The band above the prompt: the hint and a button that opens the pane.
  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    if (state.isOpen && state.inBand) return replayView($, e, true);
    if (!state.replay.length || state.isOpen) return next(e);
    const { Box, Text, Button } = $.ui.resolve(e);
    const hint = Box({
      key: "replay-hint", flexDirection: "row", gap: 2, paddingX: 1,
      children: [
        Text({ color: "magenta", bold: true, children: hintText() }),
        Button({ key: "open-replay", label: "Replay", ...(e.surface !== "desktop" && { hotkey: "r" }), onPress: () => openReplay($) }),
      ],
    });
    // Another mod's band, such as hud, stays under the hint.
    const beneath = await next(e);
    return beneath ? Box({ flexDirection: "column", children: [hint, beneath] }) : hint;
  });

  // The pane.
  on("ui.render", { component: "Pane" }, ($, e, next) => {
    if (e.requestId !== PANE_ID) return next(e);
    return replayView($, e, false);
  });

  // The person closed the pane (Escape): keep our flag in step.
  on("ui.close", ($, e, next) => {
    if (e.id === PANE_ID || e.requestId === PANE_ID) state.isOpen = false;
    $.ui.invalidate("ui.render");
    return next(e);
  });
}

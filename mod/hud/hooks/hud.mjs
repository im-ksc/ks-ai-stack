// HUD: a band above the prompt. Expanded: the branch, a verdict on the usage
// limits and the cost, then the 5h and weekly limits beside the context
// (character bars in a terminal, SVG bars in the desktop app).
// Collapsed: one line, with each bar drawn as a circle.

import { atom, read, update } from "claude-code";

const todos = atom({ plugin: "hud", key: "todos" }, []);
const tasks = atom({ plugin: "hud", key: "tasks" }, {});
const branch = atom({ plugin: "hud", key: "branch" }, null);
const budget = atom({ plugin: "hud", key: "budget" }, {});
const tokens = atom({ plugin: "hud", key: "tokens" }, { input: 0, output: 0 });
const isHidden = atom({ plugin: "hud", key: "isHidden" }, false);
const isCollapsed = atom({ plugin: "hud", key: "isCollapsed" }, false);
const minute = atom({ plugin: "hud", key: "minute" }, 0); // bumped so countdowns redraw

async function refreshBranch($) {
  try {
    const name = (await $.process.run(["git", "branch", "--show-current"], { timeoutMs: 5000 })).stdout.trim();
    if (!name) return update($, branch, () => null);
    const status = await $.process.run(["git", "status", "--porcelain"], { timeoutMs: 5000 });
    await update($, branch, () => ({ name, isDirty: status.stdout.trim() !== "" }));
  } catch {
    await update($, branch, () => null); // not a repo, or no git
  }
}

// Filled cells of a `width`-cell bar at `percent`.
const cells = (percent, width) => Math.max(0, Math.min(width, Math.round((percent / 100) * width)));

// Theme colour for how much of a budget is used.
const level = (used) => (used >= 90 ? "error" : used >= 70 ? "warning" : "success");

// The desktop draws bars as SVG, an image that can't read theme names: hex
// for the level colours and the context groups, a grey track for either theme.
const HEX = { success: "#4ade80", warning: "#f5c04a", error: "#f87171", Messages: "#5ec8e5", Tools: "#a78bfa", Other: "#8b93a1" };
const TRACK = "rgba(128,128,128,0.25)";

// A rounded bar the width of its column: [percent, colour] segments laid end to end.
function svgBar(Svg, alt, segments, tick = null) {
  let x = 0;
  const rects = segments.map(([w, fill]) => {
    const rect = `<rect x="${x}%" width="${w}%" height="8" fill="${fill}"/>`;
    x += w;
    return rect;
  });
  if (tick !== null) rects.push(`<rect x="${Math.min(99, tick)}%" width="2" height="8" fill="rgba(160,160,160,0.9)"/>`);
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="8"><clipPath id="r"><rect width="100%" height="8" rx="4"/></clipPath><g clip-path="url(#r)"><rect width="100%" height="8" fill="${TRACK}"/>${rects.join("")}</g></svg>`;
  return Svg({ alt, height: 8, source });
}

// A bar in one glyph, for the collapsed line: ○ ◔ ◑ ◕ ●.
const circle = (percent) => "○◔◑◕●"[Math.max(0, Math.min(4, Math.round(percent / 25)))];

// 1.2M, 38k, 950.
function count(n) {
  if (n >= 999_500) return `${(n / 1e6).toFixed(1)}M`; // not "1000k"
  if (n >= 1e3) return `${Math.round(n / 1e3)}k`;
  return String(n);
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const clock = (time) => {
  const d = new Date(time);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
// "14:50" today, "Wednesday 09:00" on another day.
const when = (time, now) =>
  new Date(time).toDateString() === new Date(now).toDateString() ? clock(time) : `${DAYS[new Date(time).getDay()]} ${clock(time)}`;

// Two units at most: "2d 20h", "3h 5m", "23m".
function span(ms) {
  const m = Math.max(0, Math.round(ms / 60e3));
  if (m >= 1440) return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`;
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m}m`;
}

const WINDOWS = { five_hour: { ms: 5 * 3600e3, name: "5-hour" }, seven_day: { ms: 7 * 86400e3, name: "weekly" } };

// How far through its window a limit is, 0 to 1, or null when that isn't
// known yet: no reset time, or under 10% in, too early to project from.
function pace(limit, now) {
  if (!limit.resetsAt) return null;
  const f = 1 - (Date.parse(limit.resetsAt) - now) / WINDOWS[limit.kind].ms;
  return f >= 0.1 ? Math.min(1, f) : null;
}

// One sentence on the limits: reached, running out before the reset, or on track.
function verdict(limits, now) {
  const reached = limits.find((l) => l.percentUsed >= 100);
  if (reached) {
    const name = WINDOWS[reached.kind].name;
    const reset = reached.resetsAt ? ` Resets ${when(reached.resetsAt, now)}.` : "";
    return { color: "error", text: `${name[0].toUpperCase()}${name.slice(1)} limit reached.${reset}` };
  }
  const runsOut = limits.flatMap((l) => {
    const f = pace(l, now);
    if (f === null || l.percentUsed <= 0) return [];
    const reset = Date.parse(l.resetsAt);
    const start = reset - WINDOWS[l.kind].ms;
    const out = start + ((now - start) * 100) / l.percentUsed;
    return out < reset ? [{ l, out, reset }] : [];
  }).sort((a, b) => a.out - b.out)[0];
  if (runsOut) {
    const { l, out, reset } = runsOut;
    return {
      color: level(Math.max(70, l.percentUsed)),
      text: `At this pace the ${WINDOWS[l.kind].name} limit runs out around ${when(out, now)}, ${span(reset - out)} before it resets.`,
    };
  }
  const weekly = limits.find((l) => l.kind === "seven_day" && l.resetsAt);
  return { color: "success", text: weekly ? `On track. You should reach ${DAYS[new Date(weekly.resetsAt).getDay()]}'s reset with room to spare.` : "On track." };
}

// The context breakdown in three groups, each in the colour /context gives its largest row.
function groups(categories) {
  const named = { Messages: [], Tools: [], Other: [] };
  for (const c of categories.filter((c) => c.kind === "used")) {
    named[c.name === "Messages" ? "Messages" : /tool/i.test(c.name) ? "Tools" : "Other"].push(c);
  }
  return Object.entries(named).map(([name, rows]) => ({
    name,
    tokens: rows.reduce((sum, c) => sum + c.tokens, 0),
    color: rows.sort((a, b) => b.tokens - a.tokens)[0]?.color ?? "inactive",
  }));
}

function todoProgress(items) {
  if (!items.length) return null;
  return { done: items.filter((t) => t.status === "completed").length, total: items.length };
}

// [glyph, colour] cells merged into one Text per run of a colour; no colour draws dim.
function runs(Text, list) {
  const out = [];
  for (const [glyph, color] of list) {
    const last = out.at(-1);
    if (last && last.color === color) last.text += glyph;
    else out.push({ text: glyph, color });
  }
  return out.map(({ text, color }) => Text(color ? { color, children: text } : { dimColor: true, children: text }));
}

let ticker; // the minute timer

export function register(on) {
  on("session.start", async ($, e, next) => {
    const r = await next(e);
    await $.command.register({ name: "hud", description: "Hide or show the HUD band above the prompt" });
    const hidden = (await $.store.get("isHidden")) === true;
    await update($, isHidden, () => hidden);
    const collapsed = (await $.store.get("isCollapsed")) === true;
    await update($, isCollapsed, () => collapsed);
    await refreshBranch($);
    ticker?.cancel(); // session.start fires again on /clear and resume
    ticker = $.clock.every(60e3, () => update($, minute, (n) => n + 1));
    return r;
  });

  on("command.run", { command: "hud" }, async ($) => {
    const hidden = !(await read($, isHidden));
    await update($, isHidden, () => hidden);
    await $.store.set("isHidden", hidden);
    return { text: hidden ? "HUD hidden. Run /hud to show it again." : "HUD shown." };
  });

  // /clear starts the conversation over: its todos and token counts with it.
  on("session.end", async ($, e, next) => {
    if (e.reason === "clear") {
      await update($, todos, () => []);
      await update($, tasks, () => ({}));
      await update($, tokens, () => ({ input: 0, output: 0 }));
    }
    return next(e);
  });

  on("tool.call", async ($, e, next) => {
    const r = await next(e);
    if (e.tool === "Bash") await refreshBranch($);
    // Todos from the main loop only: a subagent keeps a list of its own.
    if (r.deny || r.isError || e.agentId) return r;
    if (e.tool === "TodoWrite") await update($, todos, () => e.todos);
    if (e.tool === "TaskCreate" && r.result?.task?.id) {
      const task = { content: e.subject, status: "pending", activeForm: e.activeForm };
      await update($, tasks, (all) => ({ ...all, [r.result.task.id]: task }));
    }
    if (e.tool === "TaskUpdate") {
      await update($, tasks, (all) => {
        const { [e.taskId]: task, ...rest } = all;
        if (!task || e.status === "deleted") return rest;
        const { subject, status, activeForm } = e;
        return { ...rest, [e.taskId]: { content: subject ?? task.content, status: status ?? task.status, activeForm: activeForm ?? task.activeForm } };
      });
    }
    return r;
  });

  // Subagent turns count too: their tokens are in /cost as well.
  on("turn.complete", async ($, e, next) => {
    const u = e.usage;
    if (u) {
      const input = u.input_tokens + u.cache_creation_input_tokens + u.cache_read_input_tokens;
      await update($, tokens, (t) => ({ input: t.input + input, output: t.output + u.output_tokens }));
    }
    return next(e);
  });

  on("session.measure", async ($, e, next) => {
    let contextPercent = e.context.percent === undefined ? undefined : Math.round(e.context.percent);
    let contextLimit = e.context.window;
    let isToCompact = false;
    let contextGroups;
    if (e.context.tokens !== undefined) {
      try {
        // The local estimate: no API request. Absent threshold means auto-compact is off.
        const breakdown = (await $.session.usage({ breakdown: "summary" })).context.breakdown;
        if (breakdown?.categories) contextGroups = groups(breakdown.categories);
        if (breakdown?.autoCompactThreshold) {
          contextLimit = breakdown.autoCompactThreshold;
          contextPercent = Math.round((e.context.tokens / contextLimit) * 100);
          isToCompact = true;
        }
      } catch { /* keep the window's percent */ }
    }
    const limit = (kind) => e.rateLimits.find((l) => l.kind === kind);
    await update($, budget, () => ({
      contextPercent, contextTokens: e.context.tokens, contextLimit, isToCompact, contextGroups,
      costUsd: e.cost?.usd, fiveHour: limit("five_hour"), weekly: limit("seven_day"),
    }));
    return next(e);
  });

  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, isHidden))) return next(e);
    const { Box, Text, Button, Svg } = $.ui.resolve(e);
    const isDesktop = e.surface === "desktop"; // draws bars as SVG and hotkeys as chips, so none
    const dim = (children) => Text({ dimColor: true, children });
    await read($, minute); // redraw each minute
    const now = Date.now();

    const b = await read($, branch);
    const collapsed = await read($, isCollapsed);
    const { contextPercent, contextTokens, contextLimit, isToCompact, contextGroups, costUsd, fiveHour, weekly } = await read($, budget);
    const t = await read($, tokens);
    const limits = [["5 Hour", "5h", fiveHour], ["Weekly", "wk", weekly]].filter(([, , l]) => l);
    const hasContext = contextPercent !== undefined;
    const sep = dim(" │ ");
    const line = (key, children) => Box({ key, children: Text({ children }) }); // a Text takes no key

    const toggle = async () => {
      await update($, isCollapsed, () => !collapsed);
      await $.store.set("isCollapsed", !collapsed);
    };
    // The desktop shades every button but a plain one, so a bigger triangle is drawn and a
    // chromeless button laid over it takes the click.
    const triangle = () => Box({ key: "collapse-box", width: 3, height: 1, children: [
      Box({ key: "glyph", position: "absolute", top: 0, left: 0, width: 3, height: 1, alignItems: "center", justifyContent: "center",
        children: Svg({ alt: collapsed ? "Expand" : "Collapse", width: 12, height: 8,
          source: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="8"><path d="${collapsed ? "M1 7 6 1 11 7z" : "M1 1h10L6 7z"}" fill="#a0a0a0"/></svg>` }) }),
      Box({ key: "press", position: "absolute", top: 0, left: 0, children: Button({ key: "collapse", label: "   ", plain: true, onPress: toggle }) }),
    ] });
    const buttons = [
      Button({ key: "compact", label: "Compact", ...(!isDesktop && { hotkey: "c" }), variant: "secondary", onPress: async () => {
        try {
          await $.session.compact();
        } catch (err) {
          $.ui.toast(e.props.isWorking ? "Compact runs between turns. Try again when this one ends." : `Compact failed: ${err?.message ?? err}`);
        }
      } }),
      isDesktop ? triangle() : Button({ key: "collapse", label: collapsed ? "▸" : "▾", hotkey: "h", onPress: toggle }),
    ];
    // Parts kept whole; the one marked `shrinks` is cut with … when the row is too narrow.
    const row = (key, parts) => Box({
      key, flexDirection: "row",
      children: [
        ...parts.map(({ shrinks, children }, i) => Box({
          key: `part${i}`, flexShrink: shrinks ? 1 : 0, children: Text({ wrap: "truncate-end", children }),
        })),
        Box({ key: "gap", flexGrow: 1, minWidth: 2 }),
        ...buttons.flatMap((button, i) => (i ? [Text({ children: " " }), button] : [button])),
      ],
    });
    const join = (parts, between) => parts.flatMap((p, i) => (i ? [{ children: between }, p] : [p]));
    const cost = costUsd === undefined ? null : [`$${costUsd.toFixed(2)} · ${count(t.input)}`, dim(" in · "), count(t.output), dim(" out")];

    let lines;
    if (collapsed) {
      const todo = todoProgress([...(await read($, todos)), ...Object.values(await read($, tasks))]);
      const percentChip = (label, percent, text = `${Math.round(percent)}%`) =>
        [dim(`${label} `), Text({ color: level(percent), children: circle(percent) }), ` ${text}`];
      const parts = [
        b && `⎇ ${b.name}${b.isDirty ? "*" : ""}`,
        todo && [circle((todo.done / todo.total) * 100), ` ${todo.done}/${todo.total}`],
        ...limits.map(([, short, l]) => percentChip(short, l.percentUsed)),
        hasContext && percentChip("ctx", contextPercent),
        costUsd !== undefined && `$${costUsd.toFixed(2)}`,
      ].filter(Boolean);
      // Nothing to show still draws the buttons, so a collapsed band can be expanded.
      lines = [row("head", join(parts.map((children) => ({ children })), "  "))];
    } else {
      const v = limits.length ? verdict(limits.map(([, , l]) => l), now) : null;
      const parts = [
        b && { children: `⎇ ${b.name}${b.isDirty ? "*" : ""}` },
        v && { shrinks: true, children: Text({ color: v.color, children: v.text }) },
        cost && { children: cost },
      ].filter(Boolean);
      if (!parts.length && !hasContext) return next(e);
      const isWide = isDesktop || (e.props.bodyColumns ?? 120) >= 80;
      const half = Math.floor(((e.props.bodyColumns ?? 120) - 3) / 2);
      const barWidth = isWide ? half - 14 : 16;

      // Each limit: its bar with a ┃ at how far through the window it is, and the pace below.
      const limitRows = limits.flatMap(([label, , l]) => {
        const used = l.percentUsed;
        const f = pace(l, now);
        const n = cells(used, barWidth);
        const tick = f === null ? -1 : Math.min(barWidth - 1, Math.floor(f * barWidth));
        const bar = runs(Text, Array.from({ length: barWidth }, (_, i) => (i === tick ? ["┃", "text"] : i < n ? ["━", level(used)] : ["─", null])));
        const resets = l.resetsAt ? `resets in ${span(Date.parse(l.resetsAt) - now)}` : null;
        const percent = Text({ color: level(used), children: `${String(Math.round(used)).padStart(3)}%` });
        if (!isWide) return [line(l.kind, [`${label} `, ...bar, " ", percent, resets ? dim(` · ${span(Date.parse(l.resetsAt) - now)}`) : ""])];
        const projected = f === null ? null : `On pace for ~${Math.round(used / f)}%`;
        const head = isDesktop
          ? Box({ key: l.kind, flexDirection: "row", children: [
            Box({ key: "label", width: 7, flexShrink: 0, children: Text({ children: label }) }),
            Box({ key: "bar", flexGrow: 1, children: svgBar(Svg, `${label} ${Math.round(used)}% used`,
              [[Math.min(100, used), HEX[level(used)]]], f === null ? null : Math.round(f * 100)) }),
            Text({ children: " " }), percent,
          ] })
          : line(l.kind, [`${label} `, ...bar, " ", percent]);
        return [
          head,
          line(`${l.kind}-pace`, dim(`  ${[projected, resets].filter(Boolean).join(" · ")}`)),
        ];
      });

      // The context: one bar split by group against the auto-compact point (or the window).
      const contextRows = [];
      if (hasContext) {
        const width = isWide ? half : barWidth;
        const filled = cells(contextPercent, width);
        const total = contextGroups?.reduce((sum, g) => sum + g.tokens, 0);
        let bar;
        if (total) {
          let done = 0, before = 0;
          bar = contextGroups.flatMap((g) => {
            done += g.tokens;
            const upTo = Math.round((done / total) * filled);
            const these = Array.from({ length: upTo - before }, () => ["█", g.color]);
            before = upTo;
            return these;
          });
        } else {
          bar = Array.from({ length: filled }, () => ["█", level(contextPercent)]);
        }
        bar = runs(Text, [...bar, ...Array.from({ length: width - filled }, () => ["░", null])]);
        const percent = Text({ color: level(contextPercent), children: `${contextPercent}% ${isToCompact ? "to compact" : "used"}` });
        const left = contextTokens !== undefined && contextLimit ? `${count(Math.max(0, contextLimit - contextTokens))} left of ${count(contextLimit)}` : "";
        const name = (g) => Text({ color: isDesktop ? HEX[g.name] : g.color, children: g.name });
        const spread = (key, a, z) => Box({ key, flexDirection: "row", justifyContent: "space-between", width: isDesktop ? "100%" : width, children: [Text({ children: a }), dim(z)] });
        if (isDesktop) {
          const filledPercent = Math.min(100, contextPercent);
          const segments = total
            ? contextGroups.map((g) => [+((g.tokens / total) * filledPercent).toFixed(2), HEX[g.name]])
            : [[filledPercent, HEX[level(contextPercent)]]];
          contextRows.push(svgBar(Svg, `Context ${contextPercent}% ${isToCompact ? "to compact" : "used"}`, segments));
        } else if (isWide) contextRows.push(line("context-bar", bar));
        if (isWide) {
          contextRows.push(spread("context-label", ["Context ", percent], left));
          for (const g of contextGroups ?? []) contextRows.push(spread(g.name, name(g), count(g.tokens)));
        } else {
          contextRows.push(line("context", ["Context ", ...bar, " ", percent]));
        }
      }

      lines = [row("head", join(parts, sep))];
      if (isWide) {
        const column = (key, children) => children.length && Box({ key, flexDirection: "column", justifyContent: "space-between", width: isDesktop ? "50%" : half, children });
        const columns = [column("limits", limitRows), column("context-column", contextRows)].filter(Boolean);
        if (columns.length) lines.push(Box({ key: "body", flexDirection: "row", gap: 3, marginTop: isDesktop ? 0.5 : 1, children: columns }));
      } else {
        lines.push(...limitRows, ...contextRows);
      }
    }

    const beneath = await next(e); // another mod's band, kept under this one
    return Box({ flexDirection: "column", children: [...lines, beneath].filter(Boolean) });
  });
}

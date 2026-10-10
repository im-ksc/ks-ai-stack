// HUD: a three-line band above the prompt: the work (branch, todo progress),
// context and cost, and the 5h and weekly usage limits.

import { atom, read, update } from "claude-code";

const todos = atom({ plugin: "hud", key: "todos" }, []);
const tasks = atom({ plugin: "hud", key: "tasks" }, {});
const branch = atom({ plugin: "hud", key: "branch" }, null);
const budget = atom({ plugin: "hud", key: "budget" }, {});
const tokens = atom({ plugin: "hud", key: "tokens" }, { input: 0, output: 0 });
const isHidden = atom({ plugin: "hud", key: "isHidden" }, false);

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

// 1.2M, 38k, 950.
function count(n) {
  if (n >= 999_500) return `${(n / 1e6).toFixed(1)}M`; // not "1000k"
  if (n >= 1e3) return `${Math.round(n / 1e3)}k`;
  return String(n);
}

const clock = (iso) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

function todoProgress(items) {
  if (!items.length) return null;
  const done = items.filter((t) => t.status === "completed").length;
  const current = items.find((t) => t.status === "in_progress");
  return { done, total: items.length, label: current && (current.activeForm || current.content) };
}

export function register(on) {
  on("session.start", async ($, e, next) => {
    const r = await next(e);
    await $.command.register({ name: "hud", description: "Hide or show the HUD band above the prompt" });
    const hidden = (await $.store.get("isHidden")) === true;
    await update($, isHidden, () => hidden);
    await refreshBranch($);
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
    let contextPercent = e.context.percent;
    let contextLimit = e.context.window;
    if (e.context.tokens !== undefined) {
      try {
        // The local estimate: no API request. Absent threshold means auto-compact is off.
        const threshold = (await $.session.usage({ breakdown: "summary" })).context.breakdown?.autoCompactThreshold;
        if (threshold) {
          contextLimit = threshold;
          contextPercent = Math.round((e.context.tokens / threshold) * 100);
        }
      } catch { /* keep the window's percent */ }
    }
    const limit = (kind) => e.rateLimits.find((l) => l.kind === kind);
    await update($, budget, () => ({
      contextPercent, contextTokens: e.context.tokens, contextLimit,
      costUsd: e.cost?.usd, fiveHour: limit("five_hour"), weekly: limit("seven_day"),
    }));
    return next(e);
  });

  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, isHidden))) return next(e);
    const { Box, Text } = $.ui.resolve(e);
    const dim = (children) => Text({ dimColor: true, children });
    // A 10-cell bar: the used part in the level colour, the rest dim.
    const gauge = (used) => {
      const n = cells(used, 10);
      return [Text({ color: level(used), children: "━".repeat(n) }), dim("─".repeat(10 - n))];
    };

    const b = await read($, branch);
    const todo = todoProgress([...(await read($, todos)), ...Object.values(await read($, tasks))]);
    const work = []; // each part is a Text's children
    if (b) work.push([`⎇ ${b.name}${b.isDirty ? "*" : ""}`]);
    if (todo) {
      const n = cells((todo.done / todo.total) * 100, 5);
      work.push(["▰".repeat(n), dim("▱".repeat(5 - n)), ` ${todo.done}/${todo.total}`, todo.label ? `  ${todo.label}` : ""]);
    }

    const { contextPercent, contextTokens, contextLimit, costUsd, fiveHour, weekly } = await read($, budget);
    const t = await read($, tokens);
    const spend = [];
    if (contextPercent !== undefined) {
      const fraction = contextTokens !== undefined && contextLimit ? `  ${count(contextTokens)}/${count(contextLimit)}` : "";
      spend.push([dim("ctx "), ...gauge(contextPercent), ` ${contextPercent}%${fraction}`]);
    }
    if (costUsd !== undefined) spend.push([`$${costUsd.toFixed(2)}  ${count(t.input)}`, dim(" in · "), count(t.output), dim(" out")]);
    const limits = [];
    if (fiveHour) {
      const reset = fiveHour.resetsAt ? [dim("  reset "), clock(fiveHour.resetsAt)] : [];
      limits.push([dim("5h  "), ...gauge(fiveHour.percentUsed), ` ${Math.round(fiveHour.percentUsed)}%`, ...reset]);
    }
    if (weekly) limits.push([dim("wk "), ...gauge(weekly.percentUsed), ` ${Math.round(weekly.percentUsed)}%`]);

    const lines = [["work", work], ["spend", spend], ["limits", limits]].filter(([, parts]) => parts.length);
    if (!lines.length) return next(e);
    return Box({
      flexDirection: "column",
      children: lines.map(([key, parts]) => Box({
        key, flexDirection: "row", gap: 3,
        children: parts.map((children) => Text({ children })),
      })),
    });
  });
}

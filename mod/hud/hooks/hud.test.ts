import { test, expect, type TestBody } from "claude-code/testing";

type Engine = Parameters<TestBody>[0];
type On = Parameters<TestBody>[1];

// Stand in for git: the branch name, then the porcelain status.
function git(on: On, branch: string, status: string) {
  on("process.run", (_$, e) => {
    const out = e.argv.includes("--show-current") ? `${branch}\n` : status;
    return { value: { exitCode: 0, stdout: out, stderr: "", isStdoutTruncated: false, isStderrTruncated: false } } as never;
  });
}

async function band($: Engine, surface: "terminal" | "desktop" = "terminal") {
  return $.ui.mount({ plugin: "hud", surface, component: "AbovePrompt", requestId: "band", props: { hasSurvey: false } as never });
}

// What the engine draws when the mod hands the band on.
const ENGINE = { type: "Text", props: {}, children: ["engine"] };

test("the band shows the branch with a dirty mark", async ($, on) => {
  on("ui.render", () => ENGINE as never);
  on("store.get", () => ({ value: undefined }) as never);
  on("command.register", () => ({ value: undefined }) as never);
  git(on, "feat/hud", " M a.js\n");
  on("session.start", () => ({ cwd: "/p" }));
  await $.session.start({ cwd: "/p" } as never);
  for (const surface of ["terminal", "desktop"] as const) {
    const ui = await band($, surface);
    expect(await ui.find({ type: "Text", text: "⎇ feat/hud*" })).toBeDefined();
    await ui.unmount();
  }
});

test("todo progress counts TodoWrite and Task items and names the one in progress", async ($, on) => {
  on("ui.render", () => ENGINE as never);
  on("tool.call", (_$, e) => ({ result: e.tool === "TaskCreate" ? { task: { id: "7", subject: "x" } } : {} }) as never);
  await $.tool.call({ tool: "TodoWrite", todos: [
    { content: "Write tests", status: "completed", activeForm: "Writing tests" },
    { content: "Run tests", status: "in_progress", activeForm: "Running tests" },
    { content: "Ship", status: "pending", activeForm: "Shipping" },
  ] });
  await $.tool.call({ tool: "TaskCreate", subject: "Docs", description: "", activeForm: "Writing docs" });
  await $.tool.call({ tool: "TaskUpdate", taskId: "7", status: "completed" });
  const ui = await band($);
  // 2 of 4 done fills 2.5 of 5 cells, rounded to 3.
  expect(await ui.find({ type: "Text", text: "▓▓▓░░ 2/4 · Running tests" })).toBeDefined();
  await ui.unmount();
});

test("a subagent's todos and a deleted task don't count", async ($, on) => {
  on("ui.render", () => ENGINE as never);
  on("tool.call", (_$, e) => ({ result: e.tool === "TaskCreate" ? { task: { id: "1", subject: "x" } } : {} }) as never);
  await $.tool.call({ tool: "TodoWrite", agentId: "sub", todos: [{ content: "a", status: "pending", activeForm: "a" }] } as never);
  await $.tool.call({ tool: "TaskCreate", subject: "Gone", description: "" });
  await $.tool.call({ tool: "TaskUpdate", taskId: "1", status: "deleted" });
  const ui = await band($);
  expect(await ui.find({ type: "Text", text: "engine" })).toBeDefined();
  await ui.unmount();
});

test("a Bash call refreshes the branch", async ($, on) => {
  on("ui.render", () => ENGINE as never);
  on("tool.call", () => ({ result: {} }) as never);
  git(on, "main", "");
  await $.tool.call({ tool: "Bash", command: "git checkout main", agentId: "sub" } as never);
  const ui = await band($);
  expect(await ui.find({ type: "Text", text: "⎇ main" })).toBeDefined();
  await ui.unmount();
});

test("the budget line shows context to auto-compact, cost, tokens and limits", async ($, on) => {
  on("ui.render", () => ENGINE as never);
  on("session.measure", (_$, e) => ({ changed: e.changed }));
  on("session.usage", () => ({ value: { startedAt: 0, rateLimits: [], context: { window: 200000, breakdown: { autoCompactThreshold: 160000 } } } }) as never);
  on("turn.complete", () => ({ text: "" }));
  const usage = { input_tokens: 1000, cache_creation_input_tokens: 200000, cache_read_input_tokens: 900000, output_tokens: 30000, model: "m" };
  await $.turn.complete({ turnId: "t1", reason: "answer", answer: "", durationMs: 1, isAborted: false, usage });
  await $.turn.complete({ turnId: "t2", agentId: "sub", reason: "answer", answer: "", durationMs: 1, isAborted: false, usage: { ...usage, input_tokens: 99000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 8000 } });
  await $.session.measure({
    context: { tokens: 96000, window: 200000, percent: 48 },
    rateLimits: [
      { kind: "five_hour", percentUsed: 23, resetsAt: "2026-10-10T15:40:00Z" },
      { kind: "seven_day", percentUsed: 92, resetsAt: "2026-10-12T00:00:00Z" },
    ],
    cost: { usd: 0.4249 },
    changed: ["context", "rateLimits", "cost"],
  });
  for (const surface of ["terminal", "desktop"] as const) {
    const ui = await band($, surface);
    // 96k of a 160k auto-compact point is 60%, not the window's 48%.
    expect((await ui.find({ type: "Text", text: "ctx ▓▓▓░░ 60%" }))?.props.color).toBe("success");
    expect(await ui.find({ type: "Text", text: "$0.42 1.2M in/38k out" })).toBeDefined();
    expect((await ui.find({ type: "Text", text: /^5h ▓░░░ 77% left \(\d\d:\d\d\)$/ }))?.props.color).toBe("success");
    expect((await ui.find({ type: "Text", text: "wk ▓▓▓▓ 8% left" }))?.props.color).toBe("error");
    await ui.unmount();
  }
});

test("without a subscription or auto-compact the line falls back", async ($, on) => {
  on("ui.render", () => ENGINE as never);
  on("session.measure", (_$, e) => ({ changed: e.changed }));
  on("session.usage", () => ({ value: { startedAt: 0, rateLimits: [], context: { window: 200000, breakdown: {} } } }) as never);
  await $.session.measure({ context: { tokens: 150000, window: 200000, percent: 75 }, rateLimits: [], cost: { usd: 3 }, changed: ["context", "cost"] });
  const ui = await band($);
  expect((await ui.find({ type: "Text", text: "ctx ▓▓▓▓░ 75%" }))?.props.color).toBe("warning");
  expect(await ui.find({ type: "Text", text: "$3.00 0 in/0 out" })).toBeDefined();
  expect(await ui.find({ type: "Text", text: /^5h|^wk/ })).toBeUndefined();
  await ui.unmount();
});

test("/hud hides and shows the band, and the choice is kept across sessions", async ($, on) => {
  const stored = new Map<string, unknown>();
  on("store.get", (_$, e) => ({ value: stored.get(e.key) }) as never);
  on("store.set", (_$, e) => { stored.set(e.key, e.value); return { value: undefined } as never; });
  on("command.register", () => ({ value: undefined }) as never);
  on("ui.render", () => ENGINE as never);
  git(on, "main", "");
  on("session.start", () => ({ cwd: "/p" }));
  await $.session.start({ cwd: "/p" } as never);
  expect((await $.command.run({ command: "hud", args: "" } as never)).text).toMatch(/hidden/);
  let ui = await band($);
  expect(await ui.find({ type: "Text", text: "engine" })).toBeDefined();
  await ui.unmount();
  expect(stored.get("isHidden")).toBe(true);
  expect((await $.command.run({ command: "hud", args: "" } as never)).text).toMatch(/shown/);
  ui = await band($);
  expect(await ui.find({ type: "Text", text: "⎇ main" })).toBeDefined();
  await ui.unmount();
});

test("a hidden band stays hidden in a new session", async ($, on) => {
  on("store.get", (_$, e) => ({ value: e.key === "isHidden" ? true : undefined }) as never);
  on("command.register", () => ({ value: undefined }) as never);
  on("ui.render", () => ENGINE as never);
  git(on, "main", "");
  on("session.start", () => ({ cwd: "/p" }));
  await $.session.start({ cwd: "/p" } as never);
  const ui = await band($);
  expect(await ui.find({ type: "Text", text: "engine" })).toBeDefined();
  await ui.unmount();
});

test("/clear empties the todos and token counts", async ($, on) => {
  on("ui.render", () => ENGINE as never);
  on("tool.call", () => ({ result: {} }) as never);
  on("session.end", (_$, e) => ({ sessionId: e.sessionId }) as never);
  on("session.measure", (_$, e) => ({ changed: e.changed }));
  on("turn.complete", () => ({ text: "" }));
  await $.tool.call({ tool: "TodoWrite", todos: [{ content: "a", status: "pending", activeForm: "a" }] });
  await $.turn.complete({ turnId: "t1", reason: "answer", answer: "", durationMs: 1, isAborted: false, usage: { input_tokens: 5000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 2000, model: "m" } });
  await $.session.end({ reason: "clear", sessionId: "s1" } as never);
  await $.session.measure({ context: { window: 200000 }, rateLimits: [], cost: { usd: 0 }, changed: ["cost"] });
  const ui = await band($);
  expect(await ui.find({ type: "Text", text: /\d\/\d/ })).toBeUndefined();
  expect(await ui.find({ type: "Text", text: "$0.00 0 in/0 out" })).toBeDefined();
  await ui.unmount();
});

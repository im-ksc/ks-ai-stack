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

async function band($: Engine, surface: "terminal" | "desktop" = "terminal", bodyColumns = 120) {
  return $.ui.mount({ plugin: "hud", surface, component: "AbovePrompt", requestId: "band", props: { hasSurvey: false, isWorking: false, bodyColumns } as never });
}

// The colour of the innermost Text showing `text`.
async function colorOf(ui: Awaited<ReturnType<typeof band>>, text: RegExp) {
  return (await ui.findAll({ type: "Text", text })).map((t) => t.props.color).filter(Boolean).at(-1);
}

// A store the test can read back.
function store(on: On, stored = new Map<string, unknown>()) {
  on("store.get", (_$, e) => ({ value: stored.get(e.key) }) as never);
  on("store.set", (_$, e) => { stored.set(e.key, e.value); return { value: undefined } as never; });
  return stored;
}

const HOUR = 3600e3;
// Limits read `hoursLeft` before their reset.
const limits = (fiveHour: [number, number], weekly: [number, number]) => [
  { kind: "five_hour", percentUsed: fiveHour[0], resetsAt: new Date(Date.now() + fiveHour[1] * HOUR).toISOString() },
  { kind: "seven_day", percentUsed: weekly[0], resetsAt: new Date(Date.now() + weekly[1] * HOUR).toISOString() },
];
const BREAKDOWN = {
  autoCompactThreshold: 160000,
  categories: [
    { name: "System prompt", tokens: 16000, color: "permission", kind: "used", isDeferred: false },
    { name: "System tools", tokens: 20000, color: "inactive", kind: "used", isDeferred: false },
    { name: "Messages", tokens: 60000, color: "promptBorder", kind: "used", isDeferred: false },
    { name: "Free space", tokens: 100000, color: "subtle", kind: "free", isDeferred: false },
  ],
};

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
    expect((await ui.find({ type: "Text", text: /^⎇/ }))?.text).toBe("⎇ feat/hud*");
    await ui.unmount();
  }
});

test("another mod's band still shows under the HUD", async ($, on) => {
  on("ui.render", () => ENGINE as never);
  on("store.get", () => ({ value: undefined }) as never);
  on("command.register", () => ({ value: undefined }) as never);
  git(on, "main", "");
  on("session.start", () => ({ cwd: "/p" }));
  await $.session.start({ cwd: "/p" } as never);
  const ui = await band($);
  expect((await ui.find({ type: "Text", text: /^⎇/ }))?.text).toBe("⎇ main");
  expect(await ui.find({ type: "Text", text: "engine" })).toBeDefined();
  await ui.unmount();
});

test("collapsed, todo progress counts TodoWrite and Task items", async ($, on) => {
  on("ui.render", () => ENGINE as never);
  store(on);
  git(on, "main", "");
  on("tool.call", (_$, e) => ({ result: e.tool === "TaskCreate" ? { task: { id: "7", subject: "x" } } : {} }) as never);
  await $.tool.call({ tool: "TodoWrite", todos: [
    { content: "Write tests", status: "completed", activeForm: "Writing tests" },
    { content: "Run tests", status: "in_progress", activeForm: "Running tests" },
    { content: "Ship", status: "pending", activeForm: "Shipping" },
  ] });
  await $.tool.call({ tool: "TaskCreate", subject: "Docs", description: "", activeForm: "Writing docs" });
  await $.tool.call({ tool: "TaskUpdate", taskId: "7", status: "completed" });
  await $.tool.call({ tool: "Bash", command: "true" } as never);
  const ui = await band($);
  await ui.press({ key: "collapse" });
  // 2 of 4 done is half a circle.
  expect((await ui.find({ key: "head" }))?.text).toMatch(/^⎇ main {2}◑ 2\/4/);
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
  expect((await ui.find({ type: "Text", text: /^⎇/ }))?.text).toBe("⎇ main");
  await ui.unmount();
});

test("expanded: verdict and cost in the headline, limits beside the context", async ($, on) => {
  on("ui.render", () => ENGINE as never);
  on("session.measure", (_$, e) => ({ changed: e.changed }));
  on("session.usage", () => ({ value: { startedAt: 0, rateLimits: [], context: { window: 200000, breakdown: BREAKDOWN } } }) as never);
  on("turn.complete", () => ({ text: "" }));
  const usage = { input_tokens: 1000, cache_creation_input_tokens: 200000, cache_read_input_tokens: 900000, output_tokens: 30000, model: "m" };
  await $.turn.complete({ turnId: "t1", reason: "answer", answer: "", durationMs: 1, isAborted: false, usage });
  await $.turn.complete({ turnId: "t2", agentId: "sub", reason: "answer", answer: "", durationMs: 1, isAborted: false, usage: { ...usage, input_tokens: 99000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 8000 } });
  // 5h: 23% three hours in, on pace for 38%. Weekly: 92% five days in, out before the reset.
  await $.session.measure({
    context: { tokens: 96000, window: 200000, percent: 48 },
    rateLimits: limits([23, 2], [92, 48]),
    cost: { usd: 0.4249 },
    changed: ["context", "rateLimits", "cost"],
  });
  for (const surface of ["terminal", "desktop"] as const) {
    const ui = await band($, surface);
    expect((await ui.find({ type: "Text", text: /^\$/ }))?.text).toBe("$0.42 · 1.2M in · 38k out");
    expect((await ui.find({ type: "Text", text: /^At this pace/ }))?.text)
      .toMatch(/^At this pace the weekly limit runs out around .+, \d+[dh] \d+[hm] before it resets\.$/);
    expect(await colorOf(ui, /^At this pace/)).toBe("error");
    expect((await ui.find({ key: "five_hour" }))?.text).toMatch(/^5 Hour [━─┃]{44}  23%$/);
    expect((await ui.find({ key: "five_hour-pace" }))?.text).toBe("  On pace for ~38% · resets in 2h 0m");
    expect((await ui.find({ key: "seven_day-pace" }))?.text).toBe("  On pace for ~129% · resets in 2d 0h");
    // 96k of a 160k auto-compact point is 60%, not the window's 48%.
    expect((await ui.find({ type: "Text", text: /^Context/ }))?.text).toBe("Context 60% to compact");
    expect((await ui.find({ type: "Text", text: /left of/ }))?.text).toBe("64k left of 160k");
    expect((await ui.find({ key: "context-bar" }))?.text).toMatch(/^█{35}░{23}$/);
    expect(await colorOf(ui, /^█{22}$/)).toBe("promptBorder"); // 60k of 96k's 35 cells
    expect((await ui.find({ key: "Messages" }))?.text).toBe("Messages60k");
    expect((await ui.find({ key: "Tools" }))?.text).toBe("Tools20k");
    expect((await ui.find({ key: "Other" }))?.text).toBe("Other16k");
    await ui.unmount();
  }
});

test("on track, the verdict names the weekly reset's day", async ($, on) => {
  on("ui.render", () => ENGINE as never);
  on("session.measure", (_$, e) => ({ changed: e.changed }));
  const rateLimits = limits([10, 4.75], [20, 100]);
  await $.session.measure({ context: { window: 200000 }, rateLimits, cost: { usd: 0 }, changed: ["rateLimits"] });
  const ui = await band($);
  const day = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(rateLimits[1].resetsAt).getDay()];
  expect((await ui.find({ type: "Text", text: /^On track/ }))?.text).toBe(`On track. You should reach ${day}'s reset with room to spare.`);
  expect(await colorOf(ui, /^On track/)).toBe("success");
  // Under 10% into the 5-hour window: no tick and no projection yet.
  expect((await ui.find({ key: "five_hour" }))?.text).toMatch(/^5 Hour [━─]{44}  10%$/);
  expect((await ui.find({ key: "five_hour-pace" }))?.text).toBe("  resets in 4h 45m");
  await ui.unmount();
});

test("a reached limit says when it resets", async ($, on) => {
  on("ui.render", () => ENGINE as never);
  on("session.measure", (_$, e) => ({ changed: e.changed }));
  await $.session.measure({ context: { window: 200000 }, rateLimits: limits([40, 3], [100, 30]), cost: { usd: 0 }, changed: ["rateLimits"] });
  const ui = await band($);
  expect((await ui.find({ type: "Text", text: /limit reached/ }))?.text).toMatch(/^Weekly limit reached\. Resets (\w+day )?\d\d:\d\d\.$/);
  expect(await colorOf(ui, /limit reached/)).toBe("error");
  await ui.unmount();
});

test("a narrow terminal stacks the bars and drops the detail rows", async ($, on) => {
  on("ui.render", () => ENGINE as never);
  on("session.measure", (_$, e) => ({ changed: e.changed }));
  on("session.usage", () => ({ value: { startedAt: 0, rateLimits: [], context: { window: 200000, breakdown: BREAKDOWN } } }) as never);
  await $.session.measure({ context: { tokens: 96000, window: 200000, percent: 48 }, rateLimits: limits([23, 2], [92, 48]), cost: { usd: 1 }, changed: ["context", "rateLimits", "cost"] });
  const ui = await band($, "terminal", 80);
  expect((await ui.find({ key: "five_hour" }))?.text).toMatch(/^5 Hour [━─┃]{16}  23% · 2h 0m$/);
  expect((await ui.find({ key: "context" }))?.text).toMatch(/^Context [█░]{16} 60% to compact$/);
  expect(await ui.find({ key: "five_hour-pace" })).toBeUndefined();
  expect(await ui.find({ key: "Messages" })).toBeUndefined();
  await ui.unmount();
});

test("without a subscription or auto-compact the band falls back", async ($, on) => {
  on("ui.render", () => ENGINE as never);
  on("session.measure", (_$, e) => ({ changed: e.changed }));
  on("session.usage", () => ({ value: { startedAt: 0, rateLimits: [], context: { window: 200000, breakdown: {} } } }) as never);
  await $.session.measure({ context: { tokens: 150000, window: 200000, percent: 75 }, rateLimits: [], cost: { usd: 3 }, changed: ["context", "cost"] });
  const ui = await band($);
  expect((await ui.find({ type: "Text", text: /^Context/ }))?.text).toBe("Context 75% used");
  expect((await ui.find({ type: "Text", text: /left of/ }))?.text).toBe("50k left of 200k");
  expect((await ui.find({ key: "context-bar" }))?.text).toMatch(/^█{44}░{14}$/);
  expect((await ui.find({ type: "Text", text: /^\$/ }))?.text).toBe("$3.00 · 0 in · 0 out");
  expect(await ui.find({ key: "limits" })).toBeUndefined();
  expect(await ui.find({ type: "Text", text: /^On track/ })).toBeUndefined();
  await ui.unmount();
});

test("collapsed, the band is one line of circles, kept across sessions", async ($, on) => {
  const stored = store(on);
  on("command.register", () => ({ value: undefined }) as never);
  on("ui.render", () => ENGINE as never);
  on("session.measure", (_$, e) => ({ changed: e.changed }));
  on("session.usage", () => ({ value: { startedAt: 0, rateLimits: [], context: { window: 200000, breakdown: BREAKDOWN } } }) as never);
  git(on, "main", "");
  on("session.start", () => ({ cwd: "/p" }));
  await $.session.start({ cwd: "/p" } as never);
  await $.session.measure({ context: { tokens: 48000, window: 200000, percent: 24 }, rateLimits: limits([81, 1], [20, 100]), cost: { usd: 0.42 }, changed: ["context", "rateLimits", "cost"] });
  let ui = await band($);
  expect((await ui.find({ key: "collapse" }))?.props.label).toBe("▾");
  await ui.press({ key: "collapse" });
  expect(stored.get("isCollapsed")).toBe(true);
  expect((await ui.find({ key: "head" }))?.text).toMatch(/^⎇ main {2}5h ◕ 81% {2}wk ◔ 20% {2}ctx ◔ 30% {2}\$0\.42/);
  expect((await ui.find({ key: "collapse" }))?.props.label).toBe("▸");
  expect(await ui.find({ key: "body" })).toBeUndefined();
  await ui.unmount();
  await $.session.start({ cwd: "/p" } as never);
  ui = await band($);
  expect((await ui.find({ key: "collapse" }))?.props.label).toBe("▸");
  await ui.press({ key: "collapse" });
  expect(await ui.find({ key: "body" })).toBeDefined();
  await ui.unmount();
});

test("Compact compacts the conversation", async ($, on) => {
  let compacts = 0;
  on("ui.render", () => ENGINE as never);
  on("tool.call", () => ({ result: {} }) as never);
  on("session.compact", () => { compacts++; return { skip: "test" } as never; });
  git(on, "main", "");
  await $.tool.call({ tool: "Bash", command: "true" } as never);
  const ui = await band($);
  await ui.press({ key: "compact" });
  expect(compacts).toBe(1);
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
  expect((await ui.find({ type: "Text", text: /^⎇/ }))?.text).toBe("⎇ main");
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
  store(on);
  await $.tool.call({ tool: "TodoWrite", todos: [{ content: "a", status: "pending", activeForm: "a" }] });
  await $.turn.complete({ turnId: "t1", reason: "answer", answer: "", durationMs: 1, isAborted: false, usage: { input_tokens: 5000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 2000, model: "m" } });
  await $.session.end({ reason: "clear", sessionId: "s1" } as never);
  await $.session.measure({ context: { window: 200000 }, rateLimits: [], cost: { usd: 0 }, changed: ["cost"] });
  const ui = await band($);
  expect((await ui.find({ type: "Text", text: /^\$/ }))?.text).toBe("$0.00 · 0 in · 0 out");
  await ui.press({ key: "collapse" });
  expect(await ui.find({ type: "Text", text: /^[○◔◑◕●] \d/ })).toBeUndefined();
  await ui.unmount();
});

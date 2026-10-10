import { test, expect } from "claude-code/testing";
import { diffLines, wordDiff, summary } from "./diff.mjs";
declare const setTimeout: (fn: (...args: unknown[]) => void, ms: number) => unknown;

test("changed words are marked inside a changed line", async () => {
  const { before, after } = wordDiff("function greet(name) {", "function welcome(name) {");
  expect(before.filter((s) => s.changed).map((s) => s.t)).toEqual(["greet"]);
  expect(after.filter((s) => s.changed).map((s) => s.t)).toEqual(["welcome"]);
});

test("a line diff pairs removed and added lines for word highlights", async () => {
  const diff = diffLines("a\nlet x = 1;\nb", "a\nlet y = 1;\nb");
  expect(diff.map((l) => l.op)).toEqual([" ", "-", "+", " "]);
  expect(diff[1].segs.find((s) => s.changed).t).toBe("x");
});

test("summary counts edits, files and lines", async () => {
  const steps = [
    { file: "src/a.js", diff: diffLines("1", "2") },
    { file: "src/a.js", diff: diffLines("x", "y\nz") },
    { file: "README.md", diff: diffLines("", "hi") },
  ];
  expect(summary(steps)).toEqual({ title: "3 edits in 2 files", add: 4, del: 2 });
});

test("the pane draws the timeline and steps through edits", async ($, on) => {
  // Stand in for the engine beneath the mod.
  on("turn.start", () => ({ turnId: "t1" }));
  on("turn.complete", () => ({ text: "" }));
  on("tool.call", () => ({ result: "ok" }) as never);
  await $.turn.start({ turnId: "t1" } as never);
  await $.tool.call({ tool: "Write", file_path: "/p/README.md", content: "# Hi\n" });
  await $.tool.call({ tool: "Edit", file_path: "/p/src/greet.js", old_string: "function greet(", new_string: "function welcome(" });
  await $.turn.complete({ turnId: "t1", reason: "answer", answer: "", durationMs: 1, isAborted: false });
  for (const surface of ["terminal", "desktop"] as const) {
    const ui = await $.ui.mount({ plugin: "replay-theater", surface, component: "Pane", requestId: "replay-theater", props: {} as never });
    expect((await ui.find({ type: "Text", text: /2 edits in 2 files/ }))).toBeDefined();
    expect(await ui.find({ type: "Text", text: /THE EDITS|EDIT 1 OF/ })).toBeUndefined();
    expect(await ui.find({ type: "Text", text: /^README\.md$/ })).toBeDefined();
    expect((await ui.find({ key: "prev" }))?.props.dimColor).toBe(true);
    expect((await ui.find({ key: "next" }))?.props.label).toBe("Next");
    await ui.press({ key: "next" });
    expect(await ui.find({ type: "Text", text: /^greet\.js$/ })).toBeDefined();
    expect((await ui.find({ key: "prev" }))?.props.dimColor).toBe(false);
    // The current row: a pointer, a bold name, no background or pink.
    expect((await ui.find({ key: "row1" }))?.props.backgroundColor).toBeUndefined();
    expect(await ui.find({ type: "Text", text: /^›$/ })).toBeDefined();
    expect((await ui.find({ type: "Text", text: /^greet\.js +\S*src +$/ }))?.props.bold).toBe(true);
    // One line per edit, no connector rows between them.
    expect(await ui.find({ type: "Text", text: /^\s*│\s*$/ })).toBeUndefined();
    // No divider; a heading names the edit above its diff.
    expect(await ui.find({ type: "Text", text: /^─+$/ })).toBeUndefined();
    expect((await ui.find({ type: "Text", text: /^Edit 2 of \d+ ·$/ }))?.props.dimColor).toBe(true);
    // Changed lines use a dark tint, and there's no legend.
    expect((await ui.find({ key: "d1" }))?.props.backgroundColor).toMatch(/^#[0-3]/);
    expect(await ui.find({ type: "Code" })).toBeUndefined();
    expect(await ui.find({ type: "Text", text: /Changed word/ })).toBeUndefined();
    // The row's button covers the name, the folder and the gap up to the counts.
    const rowLabel = (await ui.find({ key: "go0" }))?.props.label as string;
    expect(rowLabel).toMatch(/^README\.md +\/p +$/);
    expect(rowLabel.length).toBeGreaterThan(30);
    for (const [key, label] of [["prev", "Previous"], ["next", "Done"], ["explain", "Explain"], ["close", "Close"]]) {
      expect((await ui.find({ key }))?.props.label).toBe(label);
    }
    expect(await ui.find({ key: "open" })).toBeUndefined();
    await ui.press({ key: "go0" });
    expect(await ui.find({ type: "Text", text: /^README\.md$/ })).toBeDefined();
    await ui.unmount();
  }
});

test("Explain asks the model about the current edit and keeps the answer", async ($, on) => {
  on("turn.start", () => ({ turnId: "t1" }));
  on("turn.complete", () => ({ text: "" }));
  on("tool.call", () => ({ result: "ok" }) as never);
  on("env.get", () => ({ value: "/home/me" }) as never);
  on("fs.read", (_$, e) => (String((e as { path: string }).path) === "/home/me/.claude/skills/unslop/SKILL.md"
    ? { value: "---\nname: unslop\n---\n\nAvoid em dashes." } : { value: "" }) as never);
  const asked: string[] = [];
  let answer!: (r: unknown) => void;
  on("model.fork", (_$, e) => {
    asked.push(e.prompt);
    return new Promise((r) => { answer = (v) => r({ value: v }); }) as never;
  });
  await $.turn.start({ turnId: "t1" } as never);
  await $.tool.call({ tool: "Edit", file_path: "/p/a.js", old_string: "let x = 1;", new_string: "let y = 1;" });
  await $.tool.call({ tool: "Edit", file_path: "/p/b.js", old_string: "1", new_string: "2" });
  await $.turn.complete({ turnId: "t1", reason: "answer", answer: "", durationMs: 1, isAborted: false });
  const ui = await $.ui.mount({ plugin: "replay-theater", surface: "terminal", component: "Pane", requestId: "replay-theater", props: {} as never });
  await ui.press({ key: "explain" });
  expect(asked.length).toBe(1);
  expect(asked[0]).toContain("a.js");
  expect(asked[0]).toContain("+let y = 1;");
  expect(asked[0]).toMatch(/as simply as/);
  expect(asked[0]).toContain("Avoid em dashes");
  expect(asked[0]).not.toContain("name: unslop");
  expect((await ui.find({ key: "explain" }))?.props.label).toBe("Explaining…");
  answer({ isAnswered: true, text: "**Renames** x to y.", usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } });
  await new Promise((r) => setTimeout(r, 10));
  expect((await ui.find({ type: "Markdown" }))?.props.text).toBe("**Renames** x to y.");
  expect(await ui.find({ type: "Text", text: /^Explanation$/ })).toBeDefined();
  expect((await ui.find({ key: "explain" }))?.props.label).toBe("Explained");
  // Going away and back shows the saved answer without a second call.
  await ui.press({ key: "next" });
  expect(await ui.find({ type: "Markdown" })).toBeUndefined();
  await ui.press({ key: "prev" });
  expect(await ui.find({ type: "Markdown" })).toBeDefined();
  await ui.press({ key: "explain" });
  expect(asked.length).toBe(1);
  await ui.unmount();
});

test("the band names the edit count and Done closes the pane", async ($, on) => {
  const closed: string[] = [];
  on("ui.render", () => ({ type: "Box", props: {}, children: [] }) as never); // nothing else draws in the band
  on("ui.close", (_$, e) => { closed.push(String((e as { id: string }).id)); return { value: undefined } as never; });
  on("turn.start", () => ({ turnId: "t1" }));
  on("turn.complete", () => ({ text: "" }));
  on("tool.call", () => ({ result: "ok" }) as never);
  await $.turn.start({ turnId: "t1" } as never);
  await $.tool.call({ tool: "Edit", file_path: "/p/a.js", old_string: "1", new_string: "2" });
  await $.turn.complete({ turnId: "t1", reason: "answer", answer: "", durationMs: 1, isAborted: false });
  const band = await $.ui.mount({ plugin: "replay-theater", surface: "terminal", component: "AbovePrompt", props: {} as never });
  expect(await band.find({ type: "Text", text: /^1 edit in the last turn$/ })).toBeDefined();
  await band.unmount();
  const ui = await $.ui.mount({ plugin: "replay-theater", surface: "terminal", component: "Pane", requestId: "replay-theater", props: {} as never });
  expect((await ui.find({ key: "next" }))?.props.label).toBe("Done");
  await ui.press({ key: "next" });
  expect(closed).toContain("replay-theater");
  await ui.unmount();
});

test("another mod's band still shows under the hint", async ($, on) => {
  on("ui.render", () => ({ type: "Text", props: {}, children: ["other band"] }) as never);
  on("turn.start", () => ({ turnId: "t1" }));
  on("turn.complete", () => ({ text: "" }));
  on("tool.call", () => ({ result: "ok" }) as never);
  await $.turn.start({ turnId: "t1" } as never);
  await $.tool.call({ tool: "Edit", file_path: "/p/a.js", old_string: "1", new_string: "2" });
  await $.turn.complete({ turnId: "t1", reason: "answer", answer: "", durationMs: 1, isAborted: false });
  const band = await $.ui.mount({ plugin: "replay-theater", surface: "terminal", component: "AbovePrompt", props: {} as never });
  expect(await band.find({ type: "Text", text: /^1 edit in the last turn$/ })).toBeDefined();
  expect(await band.find({ type: "Text", text: "other band" })).toBeDefined();
  await band.unmount();
});

test("Reviewed ticks the edit, dims its row and moves on", async ($, on) => {
  on("turn.start", () => ({ turnId: "t1" }));
  on("turn.complete", () => ({ text: "" }));
  on("tool.call", () => ({ result: "ok" }) as never);
  await $.turn.start({ turnId: "t1" } as never);
  for (const f of ["a", "b", "c"]) await $.tool.call({ tool: "Edit", file_path: `/p/${f}.js`, old_string: "1", new_string: "2" });
  await $.turn.complete({ turnId: "t1", reason: "answer", answer: "", durationMs: 1, isAborted: false });
  const ui = await $.ui.mount({ plugin: "replay-theater", surface: "terminal", component: "Pane", requestId: "replay-theater", props: {} as never });
  expect(await ui.find({ type: "Text", text: /reviewed/ })).toBeUndefined();
  expect((await ui.find({ key: "reviewed" }))?.props.label).toBe("Reviewed");
  await ui.press({ key: "reviewed" });
  // Moved on to b.js; a.js is ticked green and dimmed.
  expect(await ui.find({ type: "Text", text: /^b\.js$/ })).toBeDefined();
  expect((await ui.find({ type: "Text", text: /^ ✓ $/ }))?.props.color).toBe("green");
  expect((await ui.find({ key: "go0" }))?.props.dimColor).toBe(true);
  // Unreviewed rows, earlier or later, show their number and aren't dimmed.
  expect((await ui.find({ key: "go2" }))?.props.dimColor).toBe(false);
  expect(await ui.find({ type: "Text", text: /1 of 3 reviewed/ })).toBeDefined();
  // On the last edit it marks and stays.
  await ui.press({ key: "go2" });
  await ui.press({ key: "reviewed" });
  expect(await ui.find({ type: "Text", text: /^c\.js$/ })).toBeDefined();
  expect((await ui.find({ key: "reviewed" }))?.props.label).toBe("Unreview");
  expect(await ui.find({ type: "Text", text: /2 of 3 reviewed/ })).toBeDefined();
  // Unreview removes the mark and stays.
  await ui.press({ key: "reviewed" });
  expect(await ui.find({ type: "Text", text: /^c\.js$/ })).toBeDefined();
  expect((await ui.find({ key: "reviewed" }))?.props.label).toBe("Reviewed");
  expect(await ui.find({ type: "Text", text: /1 of 3 reviewed/ })).toBeDefined();
  // b.js was passed but not reviewed: its number, not a tick.
  expect(await ui.find({ type: "Text", text: /^ 2 $/ })).toBeDefined();
  await ui.unmount();
});

test("the pane uses up to 120 columns and its buttons wrap", async ($, on) => {
  on("turn.start", () => ({ turnId: "t1" }));
  on("turn.complete", () => ({ text: "" }));
  on("tool.call", () => ({ result: "ok" }) as never);
  await $.turn.start({ turnId: "t1" } as never);
  await $.tool.call({ tool: "Edit", file_path: "/p/a.js", old_string: "1", new_string: "2" });
  await $.turn.complete({ turnId: "t1", reason: "answer", answer: "", durationMs: 1, isAborted: false });
  const label = async (bodyColumns: number) => {
    const ui = await $.ui.mount({ plugin: "replay-theater", surface: "terminal", component: "Pane", requestId: "replay-theater", props: { bodyColumns } as never });
    const l = (await ui.find({ type: "Text", text: /^a\.js +\/p +$/ }))?.text as string;
    const row = await ui.find({ key: "buttons" });
    // No spacer before Close: the only growing box is the one edit row's.
    const growers = (await ui.findAll({ type: "Box" })).filter((b) => b.props.flexGrow === 1);
    const keys = (await ui.findAll({ type: "Button" })).map((x) => String(x.key)).filter((k) => !k.startsWith("go"));
    await ui.unmount();
    return { l, row, keys, growers: growers.length };
  };
  const wide = await label(120), huge = await label(200);
  await label(57);
  expect(wide.l.length).toBeGreaterThan(95);
  expect(huge.l.length).toBe(wide.l.length);
  expect(wide.row?.props).toMatchObject({ flexWrap: "wrap", rowGap: 1 });
  expect(wide.growers).toBe(1);
  expect(wide.keys).toEqual(["prev", "next", "reviewed", "explain", "close"]);
});

test("Bash commands that change files named in them are recorded", async ($, on) => {
  const files: Record<string, string> = { "/p/src/cart.js": "let a = 1;\n" };
  on("turn.start", () => ({ turnId: "t1" }));
  on("turn.complete", () => ({ text: "" }));
  on("session.cwd", () => ({ value: "/p" }) as never);
  on("fs.exists", (_$, e) => ({ value: (e as { path: string }).path in files }) as never);
  on("fs.read", (_$, e) => ({ value: files[(e as { path: string }).path] ?? "" }) as never);
  on("tool.call", (_$, e) => {
    const cmd = String((e as { command?: string }).command);
    if (cmd.startsWith("sed")) files["/p/src/cart.js"] = "let b = 1;\n";
    if (cmd.startsWith("cat")) files["/p/src/new.js"] = "export {};\n";
    return { result: "ok" } as never;
  });
  await $.turn.start({ turnId: "t1" } as never);
  await $.tool.call({ tool: "Bash", command: "sed -i '' 's/a/b/' src/cart.js" } as never);
  await $.tool.call({ tool: "Bash", command: "cat > src/new.js <<'X'\nexport {};\nX" } as never);
  await $.tool.call({ tool: "Bash", command: "ls src/cart.js" } as never);
  await $.turn.complete({ turnId: "t1", reason: "answer", answer: "", durationMs: 1, isAborted: false });
  const ui = await $.ui.mount({ plugin: "replay-theater", surface: "terminal", component: "Pane", requestId: "replay-theater", props: {} as never });
  expect(await ui.find({ type: "Text", text: /2 edits in 2 files/ })).toBeDefined();
  expect(await ui.find({ type: "Text", text: /^cart\.js$/ })).toBeDefined();
  expect(await ui.find({ type: "Text", text: /^bash$/ })).toBeDefined();
  await ui.press({ key: "next" });
  expect(await ui.find({ type: "Text", text: /^new\.js$/ })).toBeDefined();
  expect(await ui.find({ type: "Text", text: /^new file$/ })).toBeDefined();
  await ui.unmount();
});

test("a small change in a large file diffs as that change", async () => {
  const old = Array.from({ length: 500 }, (_, i) => `line ${i}`).join("\n");
  const diff = diffLines(old, old.replace("line 250", "LINE 250"));
  expect(diff.map((l: { op: string }) => l.op)).toEqual([" ", "-", "+", " "]);
});

test("the whole diff shows, under the buttons", async ($, on) => {
  on("turn.start", () => ({ turnId: "t1" }));
  on("turn.complete", () => ({ text: "" }));
  on("tool.call", () => ({ result: "ok" }) as never);
  const lines = Array.from({ length: 30 }, (_, i) => `l${i}`).join("\n");
  await $.turn.start({ turnId: "t1" } as never);
  await $.tool.call({ tool: "Write", file_path: "/p/a.js", content: lines });
  await $.turn.complete({ turnId: "t1", reason: "answer", answer: "", durationMs: 1, isAborted: false });
  const ui = await $.ui.mount({ plugin: "replay-theater", surface: "terminal", component: "Pane", requestId: "replay-theater", props: {} as never });
  expect(await ui.find({ key: "d29" })).toBeDefined();
  expect(await ui.find({ key: "more" })).toBeUndefined();
  const boxes = (await ui.findAll({ type: "Box" })).map((b) => String(b.key));
  expect(boxes.indexOf("buttons")).toBeLessThan(boxes.indexOf("diff"));
  expect(boxes.indexOf("buttons")).toBeGreaterThan(-1);
  await ui.unmount();
});

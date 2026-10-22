// Updates the local mods clone and the global skills from main.
// Usage: node scripts/sync.mjs [mods|skills]   (no argument runs both)
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, delimiter, join, resolve } from "node:path";

const REPO = "https://github.com/im-ksc/ks-ai-stack.git";
const CLONE = join(homedir(), ".claude", "mods", "ks-ai-stack");

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (r.status !== 0) fail(`${cmd} ${args.join(" ")} failed`);
}

function git(...args) {
  const r = spawnSync("git", ["-C", CLONE, ...args], { encoding: "utf8" });
  if (r.status !== 0) fail(`git ${args.join(" ")} failed: ${r.stderr.trim()}`);
  return r.stdout.trim();
}

function fail(msg) {
  console.error(`sync: ${msg}`);
  process.exit(1);
}

function syncMods() {
  if (!existsSync(CLONE)) {
    run("git", ["clone", REPO, CLONE]);
  } else {
    const branch = git("branch", "--show-current");
    if (branch !== "main") fail(`${CLONE} is on "${branch}", not main. Switch it to main first.`);
    if (git("status", "--porcelain")) fail(`${CLONE} has local changes. Commit or discard them first.`);
    run("git", ["-C", CLONE, "pull", "--ff-only"]);
  }
  checkPluginDirs();
  console.log("Restart Claude Code to load mod changes.");
}

// Claude Code loads the mods only from folders named in CLAUDE_CODE_PLUGIN_DIRS,
// set in the shell or in the "env" block of ~/.claude/settings.json.
function checkPluginDirs() {
  const mods = readdirSync(join(CLONE, "mod"), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => join(CLONE, "mod", d.name));
  const listed = new Set(
    [process.env.CLAUDE_CODE_PLUGIN_DIRS, settingsPluginDirs()]
      .flatMap((v) => (v ?? "").split(delimiter))
      .filter((d) => d.trim())
      .map((d) => resolve(d.trim()))
  );
  const missing = mods.filter((m) => !listed.has(m));
  if (!missing.length) return;
  console.warn(`\nsync: Claude Code won't load these mods: ${missing.map((m) => basename(m)).join(", ")}.`);
  console.warn(`Set this in ~/.claude/settings.json under "env" (add any other folders you already list):`);
  console.warn(`  "CLAUDE_CODE_PLUGIN_DIRS": ${JSON.stringify(mods.join(delimiter))}\n`);
}

function settingsPluginDirs() {
  try {
    const settings = JSON.parse(readFileSync(join(homedir(), ".claude", "settings.json"), "utf8"));
    return settings.env?.CLAUDE_CODE_PLUGIN_DIRS;
  } catch {
    return undefined;
  }
}

function syncSkills() {
  // npx is a .cmd shim on Windows, which needs a shell to run. Only fixed args go
  // through the shell, so paths with spaces (the clone path) never do.
  run("npx", ["skills", "update", "-g"], { shell: process.platform === "win32" });
}

const step = process.argv[2];
if (step && step !== "mods" && step !== "skills") fail(`unknown step "${step}". Use mods, skills or nothing.`);
if (step !== "skills") syncMods();
if (step !== "mods") syncSkills();

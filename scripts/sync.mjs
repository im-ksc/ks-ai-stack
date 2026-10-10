// Updates the local mods clone and the global skills from main.
// Usage: node scripts/sync.mjs [mods|skills]   (no argument runs both)
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const REPO = "https://github.com/im-ksc/ks-ai-stack.git";
const CLONE = join(homedir(), ".claude", "mods", "ks-ai-stack");

function run(cmd, args, opts = {}) {
  // npx is a .cmd shim on Windows, which needs a shell to run.
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32", ...opts });
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
    console.log(`\nCloned to ${CLONE}. To load replay-theater, set this in ~/.claude/settings.json under "env":`);
    console.log(`  "CLAUDE_CODE_PLUGIN_DIRS": "${join(CLONE, "mod", "replay-theater")}"`);
  } else {
    const branch = git("branch", "--show-current");
    if (branch !== "main") fail(`${CLONE} is on "${branch}", not main. Switch it to main first.`);
    if (git("status", "--porcelain")) fail(`${CLONE} has local changes. Commit or discard them first.`);
    run("git", ["-C", CLONE, "pull", "--ff-only"]);
  }
  console.log("Restart Claude Code to load mod changes.");
}

function syncSkills() {
  run("npx", ["skills", "update", "-g"]);
}

const step = process.argv[2];
if (step && step !== "mods" && step !== "skills") fail(`unknown step "${step}". Use mods, skills or nothing.`);
if (step !== "skills") syncMods();
if (step !== "mods") syncSkills();

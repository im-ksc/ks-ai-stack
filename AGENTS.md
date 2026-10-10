# AGENTS.md

Personal Claude Code mods (plugins built on function hooks), published as one plugin marketplace, plus the owner's agent skills. The repo has one owner and no other contributors. Keep changes small and in the style of what's already here.

## Layout

- `.claude-plugin/marketplace.json`: the marketplace manifest. It lists every mod.
- `.agents/skills/<name>/`: agent skills, one per folder. Codex and Gemini CLI read this path. `.claude/skills` is a symlink to it for Claude Code, so never replace it with a real folder.
- `scripts/sync.mjs` and `package.json`: `pnpm sync` updates the owner's local mods clone and global skills from `main`. Keep it dependency-free so it runs on Windows too.
- `mod/<name>/`: one mod per folder, itself a plugin:
  - `.claude-plugin/plugin.json`: the mod's name, version, description and author (`imksc`).
  - `hooks/hooks.json`: lists the hook modules (`"modules": ["./<name>.mjs"]`).
  - `hooks/*.mjs`: hook code in plain ESM JavaScript. Tests are `*.test.ts`, placed beside the code they test.
  - `tsconfig.json` extends `.claude-plugin/types/tsconfig.json`. Claude Code generates that types folder when it loads the mod, and git ignores it, so never commit or hand-edit it.
  - `README.md`, and `demo/` for a GIF if the mod has one.

For the mod API (`on(...)`, `$.ui`, `$.fs`, `$.model`, panes, bands, commands), use the `plugin-authoring` skill and the generated types. Don't guess at the API from memory.

## Checks

Run these from the repo root before every commit. Both must pass:

```bash
claude plugin validate .                    # marketplace manifest
claude plugin validate ./mod/<name>         # each mod you touched
claude plugin test ./mod/<name>             # runs its *.test.ts, if any
```

Tests import from `claude-code/testing` and run inside the Claude Code binary. The root `package.json` only holds the sync scripts. Don't add dependencies, Jest or Vitest.

## Adding a mod

1. Create `mod/<name>/` with the layout above, and start the version at `0.1.0`.
2. Add an entry to `.claude-plugin/marketplace.json` with `"source": "./mod/<name>"`, plus the same version and description as `plugin.json`.
3. In the root `README.md`, add a `### <name>` section under **Mods**, like the existing ones: one or two sentences, its GIF if it has one, its `claude plugin install <name>@ks-ai-stack` line, and a link to its README. If the mod's license differs from the others, update **License**.
4. Write `mod/<name>/README.md` with the same sections as `mod/replay-theater/README.md`. Tests are optional, but if the mod has them, they must pass.

## Changing a mod

- Every user-visible change bumps the version: patch for fixes, minor for features. Bump it in **both** `mod/<name>/.claude-plugin/plugin.json` and the mod's entry in `marketplace.json`, and keep the two equal.
- Update the mod's README whenever behaviour, keys or limitations change.

## Mods brought in from elsewhere

Some mods started as copies from other repos (`replay-theater` came from `anthropics/claude-code-playground`). When working on one:

- Change its README's install and run steps to use this repo (`im-ksc/ks-ai-stack`, marketplace `ks-ai-stack`, path `mod/<name>`), not the upstream one.
- Keep the original copyright and SPDX license headers in the source files. Don't remove or rewrite them.

## Skills

The repo is the source of truth for the owner's skills. Edit them in `.agents/skills/`, never in `~/.agents/skills`, which `npx skills update -g` overwrites from `main`.

- Most skills are forks of upstream repos and many have local edits. Don't run `npx skills add` or `npx skills update` inside this repo: that would pull upstream over the edits. Merge upstream changes by hand.
- When you add or remove a skill, update the table in `.agents/skills/README.md`, including its source and license. Keep any upstream `LICENSE` file in the skill's folder.

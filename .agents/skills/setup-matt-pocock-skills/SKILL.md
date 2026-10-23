---
name: setup-matt-pocock-skills
description: "Configure a repo's triage labels and domain docs for the engineering skills."
disable-model-invocation: true
---

# Setup Matt Pocock's Skills

Scaffold optional per-repo configuration for the engineering skills:

- **Triage labels**: the strings used for the three remaining triage roles
- **Domain docs**: where the selected glossary and ADRs live, and the consumer rules for reading them

This is a prompt-driven skill, not a deterministic script. Explore, present what you found, confirm with the user, then write.

## Process

### 1. Explore

Look at the current repo to understand its starting state. Read whatever exists; don't assume:

- `AGENTS.md` and `CLAUDE.md` at the repo root: does either exist? Is there already an `## Agent skills` section in either?
- `GLOSSARY.md` and `GLOSSARY-MAP.md`, plus legacy `CONTEXT.md` and `CONTEXT-MAP.md`, at the repo root. Follow the [glossary rules](domain.md) to resolve the authoritative document.
- `docs/adr/` and any `src/*/docs/adr/` directories
- `docs/agents/`: does this skill's prior output already exist?
- Is the `triage` skill installed? (a `triage` skill folder alongside this one, or `triage` in your available skills.) This decides whether the label section runs.
- Monorepo signals: a `pnpm-workspace.yaml`, a `workspaces` field in `package.json`, or a populated `packages/*` with its own `src/`. These are present only in a genuinely large multi-package repo; their absence means single-context, which is almost every repo.

### 2. Present findings and ask

Summarise what's present and what's missing. Then take the sections in order. One section, one answer, then the next.

Lead each section with the recommended answer so the user can accept it in a word. Give a one-line explainer only when the choice genuinely branches; skip the section entirely when exploration already settled it (triage labels when `triage` isn't installed, domain layout when there's no monorepo).

Published work uses [Plane Engineering](./issue-tracker-plane.md). This setup does not choose a tracker.

**Triage label vocabulary.** Skip this section entirely if the `triage` skill isn't installed (exploration told you), since an uninstalled skill needs no labels.

If it is installed, ask exactly one question:

> Do you want to keep the default triage labels? (recommended: **yes**)

The defaults are `needs-triage`, `needs-info`, and `wontfix`. On **yes**, write them as-is. If the user says no because the tracker uses other names, collect the overrides so `triage` applies those labels instead of creating duplicates. Accepted work uses the tracker's workflow state, not a readiness label.

**Domain docs.** Keep an existing or explicitly configured glossary convention. If both conventions exist without a clear authority, ask before writing. For a new project, default to **single-context**, one `GLOSSARY.md` and `docs/adr/` at the repo root.

Offer **multi-context**, a root `GLOSSARY-MAP.md` pointing to per-context glossaries, only when exploration found monorepo signals. Then confirm the layout. Keep existing `CONTEXT` maps and filenames in place.

### 3. Confirm and edit

Show the user a draft of:

- The `## Agent skills` block to add to whichever of `CLAUDE.md` / `AGENTS.md` is being edited (see step 4 for selection rules)
- The contents of `docs/agents/domain.md` and `docs/agents/triage-labels.md` (the last only when `triage` is installed)

Let them edit before writing.

### 4. Write

**Pick the file to edit:**

- If `CLAUDE.md` exists, edit it.
- Else if `AGENTS.md` exists, edit it.
- If neither exists, ask the user which one to create; don't pick for them.

Never create `AGENTS.md` when `CLAUDE.md` already exists (or vice versa); always edit the one that's already there.

If an `## Agent skills` block already exists in the chosen file, update its contents in-place rather than appending a duplicate. Don't overwrite user edits to the surrounding sections.

The block:

```markdown
## Agent skills

### Triage labels

[one-line summary of the label vocabulary]. See `docs/agents/triage-labels.md`.

### Domain docs

[one-line summary of layout and the authoritative glossary or map path]. See `docs/agents/domain.md`.
```

Include the `### Triage labels` sub-block, and write `docs/agents/triage-labels.md`, only when `triage` is installed and its label section ran. When it isn't, both are omitted.

Then write the docs files using the seed templates in this skill folder as a starting point:

- [triage-labels.md](./triage-labels.md): label mapping (only if `triage` is installed)
- [domain.md](./domain.md): domain doc consumer rules + layout. Record the selected glossary or map location in the generated guide so later sessions reuse it.

### 5. Done

Tell the user the setup is complete and which engineering skills will now read from these files. Mention they can edit `docs/agents/*.md` directly later; re-running this skill is only necessary if they want to change labels or domain layout.

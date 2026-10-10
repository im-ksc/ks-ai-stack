# HUD

A Claude Code mod that draws a two-line band above the prompt. The first line shows the work: the git branch and todo progress. The second line shows the budget: context used, the session's cost and tokens, and how much of the 5-hour and weekly usage limits is left.

```text
⎇ feat/hud*  ▓▓▓░░ 3/5 · Running tests
ctx ▓▓▓░░ 61%  $0.42 1.2M in/38k out  5h ▓░░░ 77% left (15:40)  wk ▓▓░░ 52% left
```

## What this shows

| Part | What it reads |
| --- | --- |
| `⎇ feat/hud*` | `git branch --show-current`, and `*` when `git status --porcelain` lists changes. Read at session start and after every Bash call. Hidden outside a git repository and on a detached HEAD. |
| `▓▓▓░░ 3/5 · Running tests` | The todo list Claude keeps with TodoWrite, and the tasks it keeps with TaskCreate and TaskUpdate, counted together. The text is the in-progress item. Subagents' todos aren't counted. Hidden when there are no todos. |
| `ctx ▓▓▓░░ 61%` | Context used, measured against the point where auto-compact runs. With auto-compact off, it's measured against the model's context window. |
| `$0.42 1.2M in/38k out` | The cost `/cost` reports. On a Pro or Max subscription this is what the same tokens would cost at API prices, not a charge. Input counts uncached, cache-write and cache-read tokens. Subagents' tokens are included. |
| `5h ▓░░░ 77% left (15:40)` | The 5-hour usage window: the bar fills with use, the text shows what's left and when the window resets, in local time. |
| `wk ▓▓░░ 52% left` | The weekly usage window, without the reset time. |

The context, 5-hour and weekly parts are green below 70% used, yellow from 70%, and red from 90%.

`/hud` hides or shows the band. The choice is kept across sessions.

The patterns it demonstrates:

- An `AbovePrompt` band drawn from `$.state` values, so it redraws by itself when a value changes.
- Reading the engine's own figures from `session.measure` and `$.session.usage()`, instead of computing cost or context.
- Watching tool results in `tool.call` after `next(e)`, without changing them.
- A slash command whose setting is kept in `$.store`.

## How it was built

- **Model:** built with Claude in Claude Code. The mod itself doesn't call a model.
- **Prompt(s):**

  > I want a mod that will show a band above prompt input.
  >
  > 1. Show progress bar of todo
  > 2. Show context bar before auto-compact/limit
  > 3. Show branch it's working on
  > 4. Show rough estimation of cost incurred based on token input/output and model used?
  > 5. Show 5hr and weekly usage remaining

- **Transcript:** not shared.
- **Iterations:**
  - The request asked for a cost estimate from tokens and a price table. The engine already reports the session's cost per model, so the band shows that figure and the token counts beside it.
  - The layout, colours, the dirty mark and the `/hud` toggle were settled in an interview before building.
  - Tested with `claude plugin test` only. It hasn't been tried in a live terminal yet.

## Run it

**Requirements:**

- Claude Code 2.1.296 or later. The mod was built and tested against 2.1.296.
- `git` on the `PATH` for the branch part.
- The usage limits appear only on a Pro or Max subscription, after the session's first response.

No environment variables or configuration.

**Steps:**

1. Clone this repository:

   ```bash
   git clone https://github.com/im-ksc/ks-ai-stack.git
   cd ks-ai-stack
   ```

2. Check the plugin and run its tests:

   ```bash
   claude plugin validate ./mod/hud
   claude plugin test ./mod/hud
   ```

3. Try it for one session:

   ```bash
   claude --plugin-dir ./mod/hud
   ```

   Or install it, with the other mods here, from the marketplace at the repository root (see the [root README](../../README.md)):

   ```bash
   claude plugin marketplace add ./
   claude plugin install hud@ks-ai-stack --scope user
   ```

4. Ask Claude for something that makes a todo list. The band fills in as the turn runs.
5. Type `/hud` to hide the band, and again to show it.

## Notes / limitations

- The context, cost and usage parts appear after the session's first response. Before that the engine has no reading.
- The context percentage uses the engine's local estimate of the auto-compact point, which sends no API request.
- Todos and token counts are kept for the session. `/clear` empties them. After `--resume` the token counts start from zero while the cost doesn't, because the cost comes from the engine's ledger.
- The branch isn't refreshed when you change branches outside Claude Code. It updates after Claude's next Bash call or the next session.
- The band above the prompt is shared. If another mod also draws there, only one of them shows.
- A gateway's `spend_limit` window isn't shown.

## Dependencies

| Name | Version | License (SPDX) | Source |
| --- | --- | --- | --- |
| None | | | |

## Third-party notices

None.

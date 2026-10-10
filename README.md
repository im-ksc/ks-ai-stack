# ks-claude-code-mods

Claude Code mods by imksc. Each one lives in `mod/<name>`.

## Install

```bash
claude plugin marketplace add im-ksc/ks-claude-code-mods
claude plugin install replay-theater@ks-claude-code-mods
```

Restart Claude Code after installing.

## Mods

![Replay Theater stepping through a three-file rename](mod/replay-theater/demo/replay-theater.gif)

- [replay-theater](mod/replay-theater): step through the file edits Claude made in the last turn, one diff at a time. Run `/replay`.

## Skills

[`.agents/skills`](.agents/skills) holds the agent skills I use with Claude Code, Codex and Gemini CLI. Sessions opened on this repo load them automatically. To install them globally:

```bash
npx skills add im-ksc/ks-claude-code-mods -g
```

Run `npx skills update -g` to pull later changes from `main`.

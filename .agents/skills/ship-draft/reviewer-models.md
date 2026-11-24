# Reviewer model selection

Resolve this before any shipping mutations. Use the invoking host's native agent tool first, with one explicitly selected model. Honor an invocation-time model override when supported.

## Codex

Discover the available Luna-family identifiers from the current tool or runtime model inventory and select one explicitly. Do not infer availability from an example identifier or inherit the parent model. Use a fresh context and provide all review inputs.

When the spawn tool requires it for a model override, set `fork_turns: "none"`. Follow the current tool schema for model and reasoning controls. The skill does not require changing user or project model configuration.

## Claude Code

Use the native Agent tool's per-invocation `model: "sonnet"` when supported, or the explicitly requested supported override. Use a fresh reviewer, not a resumed conversation.

Claude hooks, forced-model settings, and unavailable-model substitution can change the actual model. Check relevant configuration presence and capability without exposing credentials. A requested Sonnet alias alone does not prove Sonnet ran.

## Other hosts and CLI fallback

If the invoking host cannot select the requested mid-tier model natively, inspect installed CLI help for a supported fresh-session route. Use an available Luna or Sonnet route, or the user's explicit override; do not silently use the parent or a more expensive fallback. If no route is supported, report the missing capability and stop before committing or publishing.

Verified flag shapes are examples, not permanent version assumptions:

- Codex: `codex exec --model <available-luna-id> --sandbox read-only --json -`, with the fresh review prompt supplied through stdin.
- Claude: `claude -p --model sonnet --output-format json --tools Read,Glob,Grep --strict-mcp-config`, with the fresh prompt through stdin and a prepared pinned snapshot and diff to read. With this supported flag, load no MCP configuration for the reviewer.

Inspect the installed help and supported per-run settings before constructing the command. Disable automatic model fallback or switching for this review where supported, without changing persistent settings or bypassing approvals. Do not resume an old session. Supply context through a prompt file or stdin, preserving literal text and paths. Use restricted read-only tools where available; if the reader cannot inspect the pinned material, report the review as incomplete.

## Verify and report

Record the requested model. Inspect runtime-provided agent/session metadata or structured output for the actual model, such as Claude's `modelUsage` or an exposed agent model field. Do not trust a reviewer's self-reported identity as verification. An alias resolving to its documented model version is normal; substitution outside the selected model or family is not.

If actual metadata shows a substitution, report requested and observed models and mark the review incomplete. Do not rerun automatically. If the runtime exposes only the requested model, return the findings with an explicit caveat that the actual model was not independently verified. Never label selection-only metadata as actual-model proof.

References for behavior and supported controls:

- [OpenAI subagent documentation](https://learn.chatgpt.com/docs/agent-configuration/subagents)
- [Claude subagents and model selection](https://code.claude.com/docs/en/sub-agents#choose-a-model)
- [Claude CLI reference](https://code.claude.com/docs/en/cli-reference)
- [Claude model configuration](https://code.claude.com/docs/en/model-config)

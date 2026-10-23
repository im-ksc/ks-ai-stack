# Skills

Agent skills shared by Claude Code, Codex and Gemini CLI. Claude Code reads them through the `.claude/skills` symlink.

Most skills started as copies of upstream repos. The copies here are forks: many have local edits. The reviewed Matt Pocock baseline and local exceptions are recorded below. To take an upstream change, diff it against the copy here and merge by hand.

| Skill | Source | License |
| --- | --- | --- |
| ask-matt | [mattpocock/skills](https://github.com/mattpocock/skills) | MIT |
| bro | [backnotprop/pstack](https://github.com/backnotprop/pstack) | MIT |
| code-review | [mattpocock/skills](https://github.com/mattpocock/skills) | MIT |
| codebase-design | [mattpocock/skills](https://github.com/mattpocock/skills) | MIT |
| commit | local | |
| diagnosing-bugs | [mattpocock/skills](https://github.com/mattpocock/skills) | MIT |
| domain-modeling | [mattpocock/skills](https://github.com/mattpocock/skills) | MIT |
| frontend-design | [anthropics/skills](https://github.com/anthropics/skills) | Apache-2.0 (`LICENSE.txt`) |
| grill-me | [mattpocock/skills](https://github.com/mattpocock/skills) | MIT |
| grill-with-docs | [mattpocock/skills](https://github.com/mattpocock/skills) | MIT |
| grilling | [mattpocock/skills](https://github.com/mattpocock/skills) | MIT |
| handoff | [mattpocock/skills](https://github.com/mattpocock/skills) | MIT |
| how | [backnotprop/pstack](https://github.com/backnotprop/pstack) | MIT |
| impeccable | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | Apache-2.0 |
| implement | [mattpocock/skills](https://github.com/mattpocock/skills) | MIT |
| implement-spec | [mattpocock/skills](https://github.com/mattpocock/skills) | MIT |
| improve-codebase-architecture | [mattpocock/skills](https://github.com/mattpocock/skills) | MIT |
| lazy | local | |
| ponytail | [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) | MIT |
| pr | [mattpocock/skills](https://github.com/mattpocock/skills) | MIT |
| prototype | [mattpocock/skills](https://github.com/mattpocock/skills) | MIT |
| research | [mattpocock/skills](https://github.com/mattpocock/skills) | MIT |
| resolving-merge-conflicts | [mattpocock/skills](https://github.com/mattpocock/skills) | MIT |
| retro | [mattpocock/skills](https://github.com/mattpocock/skills) | MIT |
| setup-matt-pocock-skills | [mattpocock/skills](https://github.com/mattpocock/skills) | MIT |
| ship | local | |
| tdd | [mattpocock/skills](https://github.com/mattpocock/skills) | MIT |
| teach | [mattpocock/skills](https://github.com/mattpocock/skills) | MIT |
| to-questionnaire | [mattpocock/skills](https://github.com/mattpocock/skills) | MIT |
| to-spec | [mattpocock/skills](https://github.com/mattpocock/skills) | MIT |
| to-tickets | [mattpocock/skills](https://github.com/mattpocock/skills) | MIT |
| triage | [mattpocock/skills](https://github.com/mattpocock/skills) | MIT |
| typescript-best-practices | [backnotprop/pstack](https://github.com/backnotprop/pstack) | MIT |
| unslop | [backnotprop/pstack](https://github.com/backnotprop/pstack) | MIT |
| wait-what | [mattpocock/skills](https://github.com/mattpocock/skills) | MIT |
| wayfinder | [mattpocock/skills](https://github.com/mattpocock/skills) | MIT |
| wizard | [mattpocock/skills](https://github.com/mattpocock/skills) | MIT |
| writing-for-agents | [mattpocock/skills](https://github.com/mattpocock/skills) | MIT |

## Matt Pocock merge baseline

Reviewed on 2026-10-23 against [5beb35b040e3de97e54fa9e386d7e42d15c295c2](https://github.com/mattpocock/skills/tree/5beb35b040e3de97e54fa9e386d7e42d15c295c2). This records the upstream revision reviewed, including deliberately skipped changes. It is not a claim that the copies match upstream. For the next merge, compare upstream changes since that revision with these local copies and reconcile by intent. The original import revision was not recorded.

Local differences to preserve:

- `/lazy` plans and stops for a separate `/implement` invocation. `/implement` applies ponytail and validates; reviews, commits, and pushes need separate requests.
- Explicit `/implement-spec` invocation authorizes its local branches, commits, merges, and final review. Pushes, PR creation or readiness changes, and tracker changes need explicit requests.
- Published work uses Plane Engineering. New specs, tickets, and maps require publication approval; declined publication uses the invoking skill's local fallback. Specs use Backlog without readiness labels; accepted triage uses Todo.
- Interviews prefer the harness question tool when available and permitted.
- New projects use `GLOSSARY` names. Existing `CONTEXT` glossaries remain supported in place. The [domain guide](setup-matt-pocock-skills/domain.md) defines selection and ambiguity handling.
- Keep the flat skill layout, the Claude symlink, and `resolving-merge-conflicts`, which upstream removed. Upstream skills outside the catalog are not installed.

The added [implement-spec](implement-spec/LICENSE), [pr](pr/LICENSE), and [retro](retro/LICENSE) copies retain Matt Pocock's MIT notice. The PR skill also retains its [upstream credits](pr/CREDITS.md).

Run the wizard helper regression checks with `python3 .agents/skills/wizard/template.test.py`. They use dummy values and temporary files without contacting services or opening a browser.

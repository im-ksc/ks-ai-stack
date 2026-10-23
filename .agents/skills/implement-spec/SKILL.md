---
name: implement-spec
description: "Implement a spec's ticket graph through parallel worktrees and integrate it on one branch."
disable-model-invocation: true
---

# Implement spec

Implement an approved spec and its tickets on one **integration branch**. Tickets form a **task graph**. The **frontier** contains tickets whose blockers have completed and whose work has been integrated.

Explicit invocation authorizes task-owned local integration and worker branches, local commits and merges, one final two-axis review, and fixes to its findings. Pushes, PR creation or readiness changes, and tracker changes require an explicit user request. Otherwise, read the tracker and report completion without modifying it.

Use [Plane Engineering](../setup-matt-pocock-skills/issue-tracker-plane.md) for `ENG-N` references or the approved local spec and ticket files. Read full work items and comments or linked local context. Resolve the project glossary using the [glossary rules](../setup-matt-pocock-skills/domain.md).

Communicate with subagents through **context pointers** to the spec, tickets, research, and commits. Run independent implementers in the background where supported. Use the harness's worktree and subagent tools when available.

## Steps

1. Read the spec and tickets. Validate their blocking relationships, identify the frontier, and record the integration base commit for the final review. Missing blockers or cycles must be resolved before dependent work starts.
2. If tickets need shared exploration, use an exploration subagent. Save its notes outside the repo at a location accessible to later subagents.
3. Inspect the current checkout and preserve unrelated changes. Create a task-owned integration branch from the agreed starting revision, following repository branch conventions. Use an isolated integration worktree when the current checkout contains unrelated work. If the starting revision is unclear, resolve it before creating workers.
4. Dispatch implementer subagents for the frontier, each in its own task-owned worktree and branch based on the integration tip. Each implementer reads [ponytail](../ponytail/SKILL.md), applies its default level unless overridden, uses [tdd](../tdd/SKILL.md) where appropriate at the agreed seams, and runs the relevant validation. It commits only its ticket changes with normal hooks and merges the latest integration tip into its branch before reporting done. If its checkout is unexpectedly dirty or based elsewhere, preserve that work and correct the starting point without a destructive reset.
5. Integrate each completed ticket with a merger subagent. Serialize merges into the integration branch, resolve conflicts by intent, and run the affected checks. A failed worker or integration does not complete the ticket or unblock its dependents.
6. Recompute the frontier after each successful integration and dispatch newly unblocked tickets. Track completed work in the orchestration session even when tracker writes have not been authorized.
7. Once all ticket work is integrated, run the full required validation and [code-review](../code-review/SKILL.md) against the recorded base commit. Resolve actionable findings through an implementer subagent, integrate the fixes, and rerun the affected checks.
8. If the user explicitly requested publication, follow that request. When opening a PR, use [pr](../pr/SKILL.md) and describe the completed spec and tickets. Create a draft only after the branch has a diff. Changing readiness or closing tracker items also requires an explicit request. Without those requests, report the local integration branch, validation, completed ticket identifiers, and any outstanding publication or tracker actions.
9. Remove only task-owned worker worktrees after confirming their changes are integrated and no uncommitted work remains. Keep the integration checkout available for review. Preserve any failed or dirty worktree that still contains needed work and report its location.

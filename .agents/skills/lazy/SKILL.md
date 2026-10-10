---
name: lazy
description: Interview or draft a spec, then stop until the user manually invokes /implement.
disable-model-invocation: true
---

# Lazy

Use this flow when the user explicitly invokes `/lazy` for a project change.

**Implementation gate:** `/lazy` is a planning session. You may inspect the workspace, interview the user, and create spec artifacts through `/to-spec`. Stop before editing source, configuration, skills, or other files to implement the requested change. The user must invoke `/implement` in a separate message after the `/lazy` handoff before you make those edits. A request to "update" or "fix" something in the `/lazy` prompt does not satisfy this gate.

1. Check whether the request states the intended behavior and scope without leaving user decisions open. Find facts in the workspace yourself. An unknown implementation detail alone does not require an interview.
2. If decisions remain open, run the interview in this session. In a project working directory, use [grill-with-docs](../grill-with-docs/SKILL.md) by following [grilling](../grilling/SKILL.md) and [domain-modeling](../domain-modeling/SKILL.md). Otherwise, use [grill-me](../grill-me/SKILL.md) by following `grilling`. Read and apply the linked instructions directly when the Skill tool is unavailable. Finish the interview, including its shared-understanding confirmation, before continuing.
3. Once the request is clear, choose a handoff. Use the same gate whether the request was clear at the start or became clear through grilling:
   - If the expected result and scope are clear, and the work can be implemented and verified in one session without preserving decisions in a spec, suggest that the user run `/implement` manually in this session, then stop.
   - Otherwise, read [to-spec](../to-spec/SKILL.md) and follow its workflow in this session. If the project workspace is unavailable, draft the spec from the conversation and show it to the user. Ask them to open the project before checking the codebase and test seams or saving or publishing the spec. Once the workspace is available, finish `/to-spec`. Give the user the Plane item or local spec path for review, then stop. The user starts `/implement` manually after reviewing it.

Read [unslop](../unslop/SKILL.md) and apply it to every draft, question, spec, and final response in this flow.

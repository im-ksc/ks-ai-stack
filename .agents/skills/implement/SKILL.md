---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
disable-model-invocation: true
---

Implement the work described by the user in the spec or tickets.

`/implement` authorizes implementation and validation only. Commit only when the user explicitly requests a commit. Push only when the user explicitly requests a push.

If passed a ticket reference, read it and state its title before building. Ask if the reference is ambiguous.

Use [Plane Engineering](../setup-matt-pocock-skills/issue-tracker-plane.md) for `ENG-N` references. Read the full work item and comments before building. If given a local spec or ticket path, read that file and its linked local context.

For coding work, read [ponytail](../ponytail/SKILL.md) and apply it throughout the implementation. Use its default level unless the user selects another.

Use /tdd where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

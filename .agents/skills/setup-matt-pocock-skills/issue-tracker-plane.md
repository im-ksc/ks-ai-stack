# Issue tracker: Plane Engineering

Use Plane Engineering for published specs, tickets, wayfinder maps, implementation references, reviews, and triage. Repo tracker configuration does not change this choice. When the user declines publication of new work, use the local path specified by the invoking skill.

Use Plane MCP tools. List projects and select the one named `Engineering` with identifier `ENG`; resolve its current ID before project-scoped calls. If it is unavailable, report the missing connection or project instead of creating a substitute. Resolve state and label IDs from the project when needed.

## Work items

- Create a spec with `workitem create` in Engineering's `Backlog` state. Put the full spec in its description. Return its `ENG-N` identifier and project location for review, with a direct link when available. Leave labels unset.
- Read an `ENG-N` reference with `workitem retrieve_by_identifier`, then read its discussion with `workitem_comment list`.
- Create each approved ticket with `workitem create`. If it came from a Plane spec, set `parent` to the spec's work item ID. For blockers, call `workitem_relation create` on the dependent item with `relation_type=blocked_by` and the blocker IDs. Leave labels unset.
- For an accepted triage request, post the agent brief with `workitem_comment create` and move the item to `Todo` with `workitem update`. Resolve or create the remaining triage labels only when a triage outcome needs one. A rejected item moves to `Cancelled` after its explanation and rejection record.
- For triage categories, use the project's existing `bug` and `enhancements` labels when they match the request. Do not create a duplicate `enhancement` label.
- Use `workitem list`, `workitem search`, and `workitem_comment list` for discovery. Keep project operations inside `ENG` unless the user names another project.

## Wayfinding operations

- Create the map as an Engineering work item. Create each decision ticket with the map's ID as `parent` and use Plane's native `blocked_by` relation for dependencies.
- Find children with `workitem list` and `childOf("ENG-N")`, then inspect relations and assignees to find open, unblocked, unclaimed tickets.
- Claim a ticket with `workitem manage_assignee`. On resolution, post the answer with `workitem_comment create`, move it to `Done`, and update the map's Decisions-so-far section.
- Resolve or create `wayfinder:map` and `wayfinder:<type>` labels only when that flow uses them.

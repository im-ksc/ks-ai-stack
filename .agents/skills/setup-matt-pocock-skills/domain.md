# Domain docs

How the engineering skills consume a project's glossary and architecture decisions.

## Choose the glossary

1. Follow an explicit glossary location in the project's `AGENTS.md`, `CLAUDE.md`, or `docs/agents/domain.md`. When this file is installed as that project guide, record the selected location here.
2. Otherwise, inspect `GLOSSARY.md` and `GLOSSARY-MAP.md`, plus the legacy `CONTEXT.md` and `CONTEXT-MAP.md`. A map points to the relevant per-context glossaries. Continue reading and updating an existing convention in place.
3. If both conventions exist without a configured authority, ask which is authoritative before writing. Read both as needed to identify the ambiguity. Do not rename files or maintain duplicate glossaries automatically.
4. When no glossary is configured and neither convention exists, use `GLOSSARY.md` for a new glossary, or `GLOSSARY-MAP.md` for a confirmed multi-context layout. Create these lazily when a term is resolved, not just because they are absent.

References to the project glossary in these skills mean the selected file, even when its name is `CONTEXT.md`. A `/teach` workspace's learning glossary is separate; it does not override the configured project glossary.

## Before exploring, read these

- The selected glossary, or the relevant glossaries linked from its map.
- `docs/adr/` decisions that touch the area under discussion. In multi-context repos, also check `src/<context>/docs/adr/` for context-scoped decisions.

Proceed silently when these documents are absent. `/domain-modeling` creates them lazily when terms or decisions are resolved.

## File structure

Most repos use one root `GLOSSARY.md` and `docs/adr/`. Multi-context repos use a root `GLOSSARY-MAP.md` pointing to each context's glossary and, where needed, its own ADR directory. Existing `CONTEXT` layouts follow the same structure and keep their names.

## Use the glossary's vocabulary

When output names a domain concept, use the term as defined in the selected glossary. Avoid synonyms the glossary rejects. A missing concept may be invented language to reconsider or a real gap for `/domain-modeling`.

## Flag ADR conflicts

If a proposal contradicts an existing ADR, name the decision and explain why it may need reopening instead of silently overriding it.

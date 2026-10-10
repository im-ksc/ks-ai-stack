---
name: commit
description: Create one conventional commit for the current task's changes.
disable-model-invocation: true
---

# Commit

When the user invokes `/commit`, create one local commit for the current task. Invocation authorizes the commit once its scope is clear.

## Workflow

1. Read applicable repository instructions and commit-message configuration. Inspect Git status, staged and unstaged diffs, relevant untracked files, and recent commit messages. If this is not a Git repository, ask for the repository location.
2. Identify the current task's changes from the conversation and actual diff. Ask when ownership or scope is unclear. Preserve unrelated staged and unstaged changes. Use selective staging or an isolated index to keep them out of the commit. If there are no task changes to commit, report that and stop.
3. Follow compatible repository conventions and required checks. Reuse current verification results where applicable. Run normal commit hooks without bypassing them. If a check fails, report the failure and resolve task-related failures before retrying; ask before changing unrelated work.
4. Write the message using the embedded rules below. Create one commit even when the task has several purposes; choose the type that best describes its overall intent and explain other changes in the body when useful.
5. Inspect the exact diff selected for the commit before committing. Commit only that selection. For a multiline message, write it to a temporary file and use `git commit --file` with that file. Keep literal text intact.
6. Verify the resulting commit and remaining Git status. Report its short hash and subject, and mention any remaining changes. Stop after the local commit. Push or amend only when the user explicitly requests it.

## Conventional Commits 1.0.0

These rules are embedded for use without browsing. Adapted from [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/), licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).

```text
<type>[optional scope][optional !]: <description>

[optional body]

[optional footers]
```

- Require a type, colon, space, and short description. An optional scope names a codebase section in parentheses.
- Use `feat` for new features and `fix` for bug fixes. Other types are allowed, including `build`, `chore`, `ci`, `docs`, `style`, `refactor`, `perf`, and `test`.
- `fix` corresponds to PATCH, `feat` to MINOR, and any breaking change to MAJOR. Other types imply no version bump by themselves.
- Mark breaking changes with `!` immediately before the colon, an uppercase `BREAKING CHANGE: <explanation>` footer, or both. When using only `!`, describe the break in the subject. `BREAKING-CHANGE` is an equivalent footer token.
- Separate the optional body and footer section with blank lines. The body may contain multiple paragraphs.
- Footers use `token: value` or `token #value`. Replace spaces in tokens with hyphens, except `BREAKING CHANGE`. Values may span lines until another footer begins.
- Casing is flexible except uppercase breaking-change tokens. Prefer consistent lowercase types.

Example:

```text
feat(api)!: require a token for exports

BREAKING CHANGE: anonymous export requests now fail authentication.
```

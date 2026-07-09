# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues. Use the `gh` CLI for issue operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`
- **Read an issue**: `gh issue view <number> --comments`
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments`
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v`; `gh` does this automatically when run inside a clone.

## Pull requests as a triage surface

**PRs as a request surface: no.**

Do not pull external PRs into the triage queue unless this setting is changed.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Wayfinding operations

Used by `/wayfinder`. The map is a single issue with child issues as tickets.

- **Map**: create one issue labelled `wayfinder:map`.
- **Child ticket**: create a GitHub issue and link it to the map using sub-issues where available; otherwise include `Part of #<map>` at the top of the child body.
- **Blocking**: prefer GitHub native issue dependencies. If unavailable, use a `Blocked by: #<n>, #<n>` line at the top of the child body.
- **Claim**: assign the ticket to the driving developer.
- **Resolve**: comment with the answer, close the ticket, then record the decision pointer on the map.

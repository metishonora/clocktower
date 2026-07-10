# Clocktower Agent Guide

## Working style

- Write progress updates in Korean using caveman lite style when the user requests caveman.
- Keep updates concise, but include changed files, commands, test results, blockers, and required decisions.
- Do not revert user changes in a dirty worktree unless the user explicitly asks for that.
- Prefer the smallest change that satisfies the requested behavior and follows the existing code style.

## Code-change completion checklist

When finishing a requested code change, run the relevant tests, perform a code review pass, commit the finished work, and push the branch unless the user asks otherwise or the operation is blocked.

This checklist applies to code changes only. Do not run tests, code review, commit, or push for ordinary questions, planning, research, or documentation-only updates unless the user explicitly requests it.

When using the `implement` skill, TDD is encouraged but not mandatory. Use TDD where it fits a clear, pre-agreed seam; otherwise implement with focused validation and explain why TDD was skipped.

- When closing a ticket, include regression coverage for the changed behavior when practical. Prefer the smallest test that would fail before the fix. If no regression test is added, state why in the completion note.
- For Rust changes, run `cargo test --workspace`.
- For web changes, run `pnpm --dir web test` and `pnpm --dir web build` when relevant.
- For local dev-server validation, bind to `0.0.0.0`.
- If commit or push is blocked by unrelated worktree changes, permissions, or network access, report the blocker clearly.

## Product context

- Read `CONTEXT.md` before making domain or product changes.
- Clocktower is a personal-use, iPad-first Storyteller aid for Trouble Brewing.
- Rust owns deterministic domain logic; TypeScript owns UI, browser storage, and PWA behavior.
- Use English canonical terms in code and project docs. Korean is for user-facing UI messages.
- Confirmed events are the source of truth. Draft input must not mutate game state.
- Reveal screens must receive only currently shown player-facing information, not the full Grimoire.

## Agent skills

### Issue tracker

Issues, specs, and tickets live in GitHub Issues; external PRs are not a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default mattpocock/skills triage labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repo: read root `CONTEXT.md` and relevant ADRs under `docs/adr/` if present. See `docs/agents/domain.md`.

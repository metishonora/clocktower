# Clocktower Agent Guide

## Working style

- Keep `main` deployable. Start normal code work from an updated `develop` in a dedicated issue branch and worktree.
- Issue branches target `develop`; releases target `main` through `develop`.
- Branch hotfixes from `main` and merge them back into `develop`.
- When explicitly closing an issue, stop its review server and remove its clean issue worktree after merge and push. If the worktree is dirty or unmerged, preserve it and report the blocker; never force removal.
- Keep live-play UI concise for a rule-literate Storyteller. Prefer actionable values and add explanatory copy only for validation, failure, recovery, destructive actions, or explicit requests.
- For Rust domain changes, follow `ARCHITECTURE.md`, including keeping script-specific character rules in `characters/<script_name>.rs`.

## Prototype review

- Have `prototype_reviewer` verify new or materially revised prototypes before user review.

## Test server lifecycle

- For Clocktower, use only `node scripts/test-server-manager.mjs` as the fallback manager entrypoint; direct server or process commands are prohibited.
- `.codex/web-server.json` and the shared manager own profiles, ports, binding, process ownership, verification, URLs, and session cleanup. Never terminate an unrecorded or unverified process.
- Keep review servers running across turns while the review remains active. Stop them through the lifecycle manager when the review concludes, the worktree or phase changes, the server is replaced, or the user requests it. A turn boundary alone is not a reason to stop.

## Completion

- Changes limited to the test-server manager, its lifecycle hooks, or server-operator configuration require focused manager tests and a real start/HTTP/stop smoke test.
- For relevant web changes, run `pnpm --dir web build`.

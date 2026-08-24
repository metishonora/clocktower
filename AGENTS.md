# Clocktower Agent Guide

## Working style

- Keep `main` deployable. Start normal code work from an updated `develop` in a dedicated issue branch and worktree.
- Issue branches target `develop`; releases target `main` through `develop`.
- Branch hotfixes from `main` and merge them back into `develop`.
- Keep live-play UI concise for a rule-literate Storyteller. Prefer actionable values and add explanatory copy only for validation, failure, recovery, destructive actions, or explicit requests.
- For Rust domain changes, follow `ARCHITECTURE.md`, including keeping script-specific character rules in `characters/<script_name>.rs`.

## Prototype workflow

- Use prototypes before production implementation for material new UI, interaction changes, or unresolved visual decisions. Small, explicitly specified changes may proceed directly with focused visual and interaction validation.
- Align prototypes with the current `develop` app shell and target viewports. Use only the fixture state needed for review, keep review controls outside the production-like screen, and avoid unnecessary fake behavior.
- Record approved and rejected decisions in the issue plan and retain the approved prototype as the visual baseline. Compare the production UI against it for agreed states and viewports, and surface necessary deviations before acceptance.
- Prototype approval covers UI and interaction only; production acceptance uses the real entry and runtime. Skip full regression suites for isolated prototypes unless shared production code or configuration changes.

## Test server lifecycle

- Delegate requested Clocktower test-server operations to `web_server_operator`. If it is unavailable, use only `node scripts/test-server-manager.mjs`; agent unavailability must not block the operation, and direct server or process commands are prohibited.
- `.codex/web-server.json` and the shared manager own profiles, ports, binding, process ownership, verification, URLs, and session cleanup. Never terminate an unrecorded or unverified process.

## Completion

- Changes limited to the test-server manager, its lifecycle hooks, or server-operator configuration require focused manager tests and a real start/HTTP/stop smoke test. Do not run full application regression suites unless application runtime or build behavior changes.
- For Rust changes, run `cargo test --workspace`.
- For relevant web changes, run `pnpm --dir web test` and `pnpm --dir web build`.

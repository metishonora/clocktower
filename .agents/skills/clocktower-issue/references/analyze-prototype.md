# Analysis and prototype

## Analyze

1. Inspect the issue, comments, relevant specifications, architecture, existing plans, implementation, and tests.
2. Summarize current behavior, requested outcome, scope, non-goals, dependencies, and likely ownership boundaries.
3. Ask only decisions that materially affect behavior, UI, compatibility, or implementation. Group questions, explain impact, and include a recommendation when useful.
4. Record answers and approval in the issue plan before advancing.

Do not edit production or prototype code while unresolved requirements remain.

## Prototype

Skip this phase when no UI or product decision needs visual approval, and record why.

1. Use the issue branch and worktree recorded in the checkpoint; do not create a separate prototype branch.
2. Write only a lightweight prototype plan covering the decision to review, variants, fixture states, and target viewports.
3. Build a disposable static visual harness matching the current `develop` app shell, layout, styles, and target viewport. Do not invent a separate visual shell.
4. Reuse production presentation components and styles when practical. Use only minimal hard-coded fixture state; do not build mock APIs, stores, or domain behavior or connect real store, WASM, persistence, or commands.
5. Keep development controls and notes outside the production-like screen.
6. Before approval, skip TDD, full regression suites, and production completion checks. Verify rendering, review interactions, and target viewports. Run focused checks only when shared or production code, routing, state, or build configuration changed.
7. Start the review server with `.agents/skills/clocktower-issue/scripts/test-server.sh start <number> <worktree> [port]`. Give the user its explicit Tailscale URL and keep it alive after the response.
8. Record approved placement, copy, states, and rejected variants. Do not treat prototype code as production-ready.

# #220 test design

Baseline: approved Spec v3 C01–C38/S1-a–g and approved plan. Implementation behavior is not an oracle.

- Existing #197 authoring/file/identity tests and #209 R0–R11 scenarios retain their approved expectations. Only superseded source-screen success copy/intermediate navigation and existing-game refusal expectations change, with independent preservation checks before valid activation.
- New application tests cross real WASM, canonical session and real IndexedDB transactions (fake-indexeddb API implementation), rather than testing the previous Setup-only fallback. Observe durable slots, immutable file identity, replayed step and event count; ensure invalid imports never adopt a valid prefix.
- New writer tests control delayed writes, revoke former owners, compare persisted histories after activation and check cross-owner writes against the DB. The wrong implementation that merely updates UI ownership must fail durable-record assertions.
- New first-night tests exercise public/conceal/commit, no duplicate retry, Undo, history projection, invalid input and stale proposals against real core results. Numeric expectations come from an explicit five-seat arrangement: chef/empath/clockmaker/poisoner/imp, not a value calculated by the controller under test.
- New Production browser tests use downloaded/imported JSON and visible controls, then observe IndexedDB and reload. They do not import controllers into the browser. They cover source/review, empty setup, reveal focus isolation, Day boundary, JSON resume, viewport access and runtime-load failure.
- Existing official browser paths and runtime suites remain the regression baseline. Viewport checks are not physical-device validation. All 45 cases will be mapped to evidence or an explicit gap in the result report.

White-box risks to strengthen: preserved setup session after failed write, claim-before-write ordering, comparison against normalized stored snapshots, proposal reused after Undo, a hidden editor retaining asynchronous work after handoff, foreign tab writes, and public reveal appearing before canonical confirmation. These identify test boundaries; expected outcomes remain Spec v3's no stale writes/partial adoption/exposure/duplicate events.

# Issue #151 — Trouble Brewing bug-report plan

## Accepted product decisions

- Replace the Trouble Brewing Setup and live-flow GitHub issue links with the approved in-app report
  dialog from Issue #136. Do not add GitHub authentication, automatic issue creation, or a backend.
- Preserve the approved S&V information structure and interaction: optional symptom, privacy summary,
  collapsed exact preview, explicit original-GameFile disclosure, email handoff, copy/download recovery,
  oversized JSON attachment flow, focus trap, and focus return.
- Extract one shared report component and report contract. Keep the existing S&V serialized output and
  exported compatibility surfaces stable rather than duplicating a TB-specific implementation.
- Use the full script name in TB report identity:
  - subject: `[Clocktower Trouble Brewing] 버그 제보`
  - Markdown header: `# Clocktower Trouble Brewing 버그 제보`
  - report type: `clocktower.trouble-brewing.bug-report`
  - download prefix: `clocktower-trouble-brewing-bug-report-`
  - script ID: `troubleBrewing`
- Keep `reportSchemaVersion: 2` and the serialized reproduction-context fields `activeTab`,
  `replayPhase`, `currentStepId`, `currentStepType`, and `eventCount`.
- During unconfirmed Setup, capture only the canonical GameFile and minimal reproduction context.
  Do not collect, attach, or derive a diagnostic payload from `SetupDraft`. The resulting canonical
  fixture may contain zero events.
- Keep the schema-v3 reproduction fixture privacy policy from Issue #136: fixed redacted game name,
  seat-labelled player names, schema-valid empty `notes`, name-redacted summaries and symptom, exact
  canonical identifiers/timestamps, and no `ui`. Include the original GameFile only after explicit
  opt-in with the approved warning.
- Reuse the configured S&V report recipient and delivery policy, including the build-time override.
- Apply the approved Trouble Brewing forest/parchment/gold/rust visual identity to both Night and Day
  dialog states. Layout, copy hierarchy, and action behavior remain shared with S&V.

## Issue #152 baseline review

Issue #152 is merged into `develop` at `98c2424` and is part of the Issue #151 branch baseline.

- Canonical Trouble Brewing reminder projections are derived replay state rather than a new GameFile
  field. Their source events remain ordinary report-fixture data, so reminders can be derived again
  after importing and replaying the redacted fixture without adding a diagnostic collection source.
- Player annotation `notes` and player names remain governed by the existing redaction contract.
- The locked Spy live-Grimoire flow keeps the shell visible but disables all utilities, including bug
  reporting. Issue #151 must preserve that approved interaction lock rather than adding a report entry
  during Spy reveal or its ended handoff. No Spy-only transient context field is introduced.
- Use the post-#152 production shell and theme styles as the prototype and production visual baseline.
  No #152 change requires collecting `RuleState`, reveal payloads, reminder projections, or browser
  session state outside the canonical GameFile.

## Prototype review scope

- Development-only route: `?prototype=issue-151-tb-bug-report`.
- Review the production-aligned `설정 · 밤`, `라이브 · 밤`, and `라이브 · 낮` specimens.
- Review the approved normal flow plus email-unavailable, oversized, copy-failure, and download-failure
  recovery states. These controls remain outside the production-like screen and have no delivery or
  persistence behavior.
- Review desktop/iPad and 360/390px mobile bottom-sheet layout. Header and actions stay fixed while the
  dialog body scrolls.
- The prototype settles Trouble Brewing visual adaptation only. It does not approve new fields,
  collection sources, delivery behavior, or a second implementation of the report contract.
- Retain the approved prototype route as the visual baseline until production acceptance. Record the
  user's approval or rejected visual decisions in this document before production implementation.

## Production acceptance plan

1. Characterize the existing S&V report serialization and dialog behavior before extracting shared
   code, keeping its subject, report type, body, attachment, filename, and recovery flows unchanged.
2. Extract script-neutral report, delivery, and dialog contracts with script identity/theme adapters;
   retain S&V compatibility wrappers where existing imports depend on them.
3. Wire a point-in-time report snapshot into both Trouble Brewing early-return branches. Setup derives
   `activeTab` from the visible setup stage; live uses the visible shared stage plus canonical replay
   phase/current step. Closing returns focus to the mounted trigger.
4. Build a redacted TB fixture from `spy-grimoire-reveal.json`, which contains player names,
   summaries, annotations, and the canonical events used by the post-#152 reminder projection.
   Validate TypeScript import and real WASM replay, preserve machine identifiers and timestamps, and
   confirm the expected official automatic reminders are derived again from the redacted stream.
5. Cover Setup/live entry, Night/Day theme, configured and missing email, oversized payload,
   email/copy/download failures, original opt-in, default privacy, removal of both direct GitHub
   links, and continued utility lock during Spy reveal. Run existing S&V regressions plus required web
   test/build checks.
6. Compare production against the approved prototype at the agreed desktop, iPad, and mobile states
   before requesting production acceptance.

## Rejected or deferred

- Do not collect unconfirmed `SetupDraft`, transient selection state, `RuleState`, reveal payloads,
  global console output, other tabs, or browser storage as additional diagnostic data.
- Do not rename serialized context fields or increment the report schema solely for TB support.
- Do not abbreviate Trouble Brewing to `TB` in user-facing or attachment report identity.
- Do not redesign the approved S&V information hierarchy or delivery recovery flow in this issue.
- Sanitizing additional S&V free-text event fields is a separate privacy-contract change and is not
  folded into the Trouble Brewing extraction.

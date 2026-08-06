# Issue #136 — S&V bug-report plan

## Accepted product decisions

- Support Sects & Violets only. Trouble Brewing and shared presentation extraction are out of scope.
- Keep the user in the app: `버그 제보` opens a review dialog beside the existing
  `저장 / 불러오기` entry.
- Generate an AI-reconstructable report instead of requiring a GitHub account or a public issue.
- Open the user's mail composer with the report in the message body; never submit data silently.
- The default report contains a directly importable, schema-v3 S&V reproduction fixture, the
  user's optional problem description, agreed environment metadata, and minimal replay context.
- Replace the game name with a fixed redacted value, replace player names with seat-based labels,
  and empty note values before preview, copy, download, or mail composition.
- Show the exact report before handoff. The user can cancel without changing game state.
- Keep the dialog header to the `버그 제보` title and close button. Do not show an eyebrow or
  introductory paragraph.
- Provide one optional `무슨 문제가 있었나요?` field. Do not request a separate expected result
  and do not mark the description as required.
- Move initial focus to the close button so opening the dialog does not summon a mobile keyboard.
- Keep the header and actions visible while the middle dialog body scrolls independently.
- Offer report copy and download recovery when mail composition is unavailable.
- When the full `mailto:` payload is too large, offer `보고서 파일 저장` as a valid redacted JSON
  attachment and `메일 전송` with metadata only. The user attaches the saved JSON in their mail app.
- Original GameFile JSON is excluded by default. It may only be exposed as an explicit optional
  diagnostic for serialization, import, or persistence bugs, with a separate privacy warning.
- Keep the preview collapsed initially. Hide `보고서 복사` in the normal short-mail flow and show
  it only when mail composition needs recovery. Use the JSON save action in the oversized flow and
  the approved disclosure copy for optional original JSON.
- Send the production email handoff to `metishonora@icloud.com`, with a build-time override kept
  available for operational changes.

## Rejected or deferred decisions

- Do not require GitHub login and do not open a GitHub issue composer in the primary flow.
- Do not create GitHub issues automatically and do not add a server-side token or submission
  endpoint in this issue.
- Do not collect global console output, unrelated browser storage, data from other tabs, or
  transient UI state without a separately approved diagnostic contract.
- Do not add Trouble Brewing support in this issue.
- Do not show the rejected `AI 재현용 보고서` eyebrow, introductory explanation, required badge,
  or `어떻게 되어야 했나요?` field.

## Diagnostic contract

The human-readable message has five sections:

1. User report: optional problem description.
2. Environment: report schema, GameFile schema, script, page URL, user agent, viewport and build
   identity when available.
3. Privacy handling: fixed game name, seat-based player names, and removed Storyteller notes.
4. Reproduction context: active tab, replay phase, current step ID/type, and event count only.
5. Reproduction fixture: a complete schema-v3 GameFile with no `ui`, containing canonical game
   metadata and ordered events including their timestamps.

Redaction happens before formatting. Fields named `name` use the seat label when the player can be
identified and a generic redacted marker otherwise. The fixture game name is `Redacted bug report`,
and fields named `notes` use the schema-valid empty string. The report separately states that notes
were removed. Known setup names are replaced in the optional symptom and fields named `summary`.
Other strings are preserved because they may be event IDs, cross-event references, character IDs,
step IDs, discriminants, or other schema values—even when their text happens to equal a player name.
The report contract is `reportSchemaVersion: 2`; `[게임 구성]` and `[확정 이벤트]` are not duplicated
outside `[재현 Fixture]`.

## Acceptance criteria

1. An S&V Storyteller can open `버그 제보` beside `저장 / 불러오기` without changing tabs or game
   state.
2. The dialog accepts an optional problem description, explains included and excluded data, and
   previews the exact outgoing report.
3. The default report's structured fixture passes S&V GameFile import and canonical replay without
   Codex inventing fields, timestamps, or causal decisions that existed in the stream.
4. No original player name or note remains in privacy-bearing `name`, `notes`, `summary`, or symptom
   fields. Machine identifiers and schema values remain exact even when their text equals a player
   name.
5. Email handoff occurs only after an explicit user action. Cancel leaves the report draft and game
   untouched according to the approved dialog behavior.
6. Unsupported mail composition preserves the report and exposes copy/download recovery. An
   oversized payload exposes a JSON report download and a metadata-only mail handoff.
7. The feature remains usable at mobile, iPad and desktop target widths. Opening focuses the close
   button, a long middle section scrolls between fixed header/actions, and closing returns focus to
   the trigger.
8. S&V report formatting, redaction, mail fallback and dialog behavior have focused regressions;
   `pnpm --dir web test` and `pnpm --dir web build` pass.

## Prototype review

The S&V bug-report UI and interaction decisions above were approved before production integration.

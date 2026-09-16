# #205 · Scenario authoring review

## Current user decisions · 2026-09-09

- Remove `저장본을 연다`. Scenario selection now has only `새롭게 작성한다` and `JSON에서 불러온다`.
- Scenarios are not automatically saved or separately kept inside the app. `시나리오 저장` means JSON file download, reused through JSON import.
- Remove internal storage candidates, saved-record lists, copy/replacement/recovery dialogs, and save-during-new-grimoire options from this prototype.
- Game-progress autosave is a separate concern and is not changed by this decision.
- These explicit user decisions supersede the initial internal-storage interpretation in this prototype and the corresponding provisional #205 Intent/Spec requirements. The issue documents will be reconciled with approved prototype results; they have not been rewritten during this UI edit.

## Scope and entry

Entry: `/clocktower/issue-205-scenario.html`.

Scenario selection → Character selection → first-night order → final review. Existing #197/#202 presentation remains the baseline. This review covers scenario JSON save/import, unified JSON entry, resume eligibility and errors; new/resumed grimoire actions stop at the review-only boundary. Storyteller console, actual Setup and game execution are excluded from this gate.

Standalone HTML and prototype-local files only. No production entry, shared configuration, storage, runtime, WASM or real file I/O is changed. The #197 presentational CharacterPoolSheet, catalog presentation, manuscript and CSS are reused read-only. The order panel is an isolated copy and its representative data comes from an existing #209 fixture, not a new rules source.

## Review behavior

- Resume requires the loaded-game fixture's exact scenario. Name, pool and order changes hide it; exact restoration makes it available again.
- First-night/console behaviors are not finalized by this editor review.

## Review controls

The bottom dock is outside the product surface. It selects simulated file-selection outcomes, direct authoring/resume/error fixtures, one failed download, and restoration of the original game scenario. All state resets on reload.

`JSON 파일 선택` consumes the outcome selected in the dock. No native chooser, parsing, download, IndexedDB or session calls are made. Success/failure messages show proposed feedback only.

## Verification history

- Initial manual review: desktop 1280×720, tablet 820×1180, mobile 390×844; 47-character review, search, reorder, resume restoration and error states.
- Fixed mobile source centering and removed unrelated final-review style overrides. Boundary feedback is confined to the dock.
- Initial independent prototype_reviewer passed all four preflight criteria. The removed internal-storage flows are no longer part of the review.
- Focused TypeScript no-emit diagnostics pass after removal. No prototype tests, regression suites or Production/WASM builds were run.
- Physical Safari/iOS devices were not used. Review server remains running through the lifecycle manager.

## User revision — compact source panel

- Remove the meaningless star decoration from new authoring.
- Fit the source panel height to its content instead of stretching it between top and bottom viewport edges, leaving the background visible below.
- Use a compact 44px-minimum JSON selection button without decorative upload icon. Preserve file feedback and two-choice navigation.
- Remove the `스크립트 선택으로` button at the user’s request; retain the forward action.
- Verified compact new/JSON source states at mobile 390×844 and desktop 1280×720; independent prototype_reviewer passed all four preflight criteria for this revision.
- Restore the compact source panel to the bottom of the product viewport on desktop and mobile, as requested; retain its content-sized height.
- Scenario save means an immediate JSON download; this prototype only simulates its request feedback.
- Remove the new-grimoire confirmation dialog: `새 마도서 쓰기` now goes directly to the simulated game-settings boundary, including when a previous game is loaded.

## User revision — direct JSON import

- Use one JSON entry point without purpose selection or an official-grimoire branch/dialog.
- Remove helper copy, imported filename/progress summary, and the intermediate review button from the source panel. Successful import opens final review immediately; failure stays at file selection with an error, cancellation stays unchanged.
- Review fixtures retain scenario-only JSON and JSON with game progress to inspect resume availability; both use the same import flow.

## User approval — 2026-09-09

The user approved the scenario authoring review screen and its current interactions after the direct JSON import revision. Approved: compact bottom source panel, new/JSON choices, unified immediate import-to-review, no filename/intermediate confirmation or official branch, immediate scenario JSON download intent, and new-grimoire entry without a confirmation dialog. This approval covers the scenario editor gate; Storyteller console and actual game setup/runtime remain outside this prototype.

## Next phase direction — console design

- User requests the custom scenario editor-to-console transition to show a loading screen following the existing TB/SNV transition pattern.
- User requests full console design next as part of the #205 connected UI review, rather than limiting this issue to JSON file controls. The scenario editor gate remains approved.

## Console theme experiment — 2026-09-09

User requested a visual-only grimoire theme first, then explicitly asked to try UI on the generated open-book image. Independent entry: `/clocktower/issue-205-console.html`. This is a theme feasibility experiment, not approval of detailed console interactions. Desktop uses two pages; mobile uses a vertically scrolling parchment surface. Seat selection, information tabs and draft notes are local mock interactions; action buttons only report their intended destination in the external review footer. Existing editor remains unchanged. No actual game, storage or loading integration is included in this narrowed experiment.

Generated image from the built-in image tool was copied to `assets/grimoire-theme-v1.png`; original remains under Codex generated_images. Character artwork and ability copy reuse the existing catalog. Manually checked desktop and mobile rendering and seat/tab interactions; focused TypeScript diagnostics passed, no automated tests or production build run.

## Story-writing console prototype — 2026-09-09

User approved a narrow prototype based on their four hand-drawn references: first-night prose → minion information reveal → demon bluff selection → demon information reveal → next paragraph. Entry: `/clocktower/issue-205-story.html`.

The manuscript is a responsive content surface with a subtle procedural grain, ink lines and existing NanumPenScript lettering. This avoids the rejected fixed illustrated book background. Character illustrations reuse the catalog. Completed actions remain as past-tense prose; the current paragraph contains the interaction. Three of six illustrative bluff choices must be selected before reveal. Player reveal replaces the narrator's page entirely; hiding information precedes returning to the record. Repeat viewing does not advance past the current completed stage. The example stops at the next chef paragraph. Review controls remain outside the product paper.

All people, roles and information are local presentation fixtures, not runtime rule resolution. No production/editor modifications, saving, real game or first-night execution were added. Root manually verified the complete flow on mobile 390×844 and initial desktop rendering, selected-count gating and narrator DOM removal during reveal. TypeScript diagnostics only; no automated tests or production build.

## Paused for #218 — 2026-09-09

User split full grimoire theme design into #218. #205 is blocked by #218 on GitHub and remains open; approved scenario editor decisions are preserved. Story prototype, three screenshots and four user sketches are archived in codex/issue-218-prototype at 301dfbf34bd60665a2b968fe40c5a4f5b4197e9b. Reference 1: Potion Craft; reference 3: The Boat. Old #205 server stopped via manager; #218 server kept on port10218, /clocktower/issue-218-story.html. Resume #205 after #218 approval, reconcile provisional Intent/Spec then continue integration.

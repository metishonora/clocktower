# Issue #200 approved custom scenario prototype

## Review URL

- `/clocktower/?prototype=issue-200-custom-script`
- The bottom dock is review-only and sits outside the candidate product scene.
- Use `넓게 보기` to force the 1440px desktop canvas on a mobile viewport, following the viewport-switch pattern from `da67387` (`codex/prototype-wide-layout`).

## Approved entry

- The review route begins on the real Production `ScriptLanding` and adds one third `Custom Scenario` choice without changing the two official choices.
- The selected fourth logo direction is preserved: oversized navy blackletter lettering layered over curled parchment with a tall navy quill and ink flourish.
- Choosing `Custom Scenario` opens the approved three-step manuscript flow directly. Returning from its first scene restores the script landing, so the entry and editor form one bounded review path.

## Current visual direction

- One fixed centered camera axis, one Storyteller, one desk, and one stable two-candle light direction.
- The camera retreats along the desk across three product steps: scenario, Character, and review. Game Setup is the destination after this flow, not a fourth scene.
- One continuous manuscript unfolds toward the viewer. Completed sections remain visible and diminish into depth; the active section stays in the foreground.
- The Storyteller keeps exactly the same seated writing pose because every state uses one shared master artwork.
- The prototype changes only the scale of that master image around one fixed vanishing point. It does not pan sideways or swap generated frames. The three desktop scales are `1.48×`, `1.23×`, and `1×`, ending at the former fourth-step distance.

## Current script-selection study

- Step 1 uses the chapter mark `Ⅰ. 시나리오 선택`, horizontal `새롭게 작성한다 / 기존 시나리오를 불러온다` choices, and an underlined `다음으로` action.
- The approved material direction is `B · 비치는 판`: one explicit floating rectangular artifact with a restrained charcoal tint. The manuscript artwork stays clearly visible and supplies the surface texture beneath the UI.
- The transparent board deliberately keeps a plain rectangular perimeter so the background manuscript, rather than the panel silhouette, carries most of the texture. The opaque blackened-vellum and bright-ivory candidates are superseded.
- Ornament belongs to the single outer frame. The two choices remain unboxed and horizontally aligned inside it, so the interface has one strong silhouette instead of a collection of independently decorated components.
- The type system follows invitation hierarchy: a spaced serif chapter heading, readable serif actions, and one oxblood ink stroke for the active state. The earlier smoky, thread, arcane-circle, and ink-wash variants were removed because they did not create meaningfully different compositions.
- The compact composition avoids explanatory copy, metadata, icons, and nested card surfaces. It stays independent of the artwork crop so desktop and mobile share the same readable hierarchy.
- Selection never shifts the text and draws only a clear, irregular crimson-ink stroke beneath the chosen word.
- A temporary edge-free brightening treatment previews the intended parchment readability without regenerating the artwork yet.
- `새롭게 작성한다` keeps the normal Step 1 → Step 2 path. `기존 시나리오를 불러온다` changes the underlined action to `JSON 파일을 선택한다`; a successfully parsed Clocktower game file skips Step 2 and retreats directly to Step 3 review.
- The import study accepts canonical schema versions 2–4. Official TB/S&V files resolve to the full official script roster, while schema-v4 custom files use `game.script.definition.characterIds`. Invalid or unsupported files remain on Step 1 with one compact recovery message.
- Confirming a new script or successfully importing a file starts the camera retreat immediately. Completed Step 1 copy is intentionally removed so the next active screen can use the full manuscript field.

## Current character-selection study

- Step 2 continues the approved transparent-board material at a larger scale after the camera retreats; Step 1 copy is not retained.
- The board contains the scenario name, Townsfolk/Outsider/Minion/Demon tabs with per-kind counts, TB/S&V source filters, name search, Character tokens, and previous/continue actions.
- The redundant top-right `selected / catalog` total is removed. The four kind tabs remain the only visible count summary.
- After kind, source, and name filters are applied, the visible Character tokens are ordered by their Korean display names using Korean collation.
- Character search matches both the Korean display name and the official English name; the active kind and source filters still scope the result.
- Search and filters are mutually exclusive modes: entering a non-empty query clears the kind and source filters so all 47 Characters are searched; choosing any kind or source filter clears the query. An open Character summary closes on either change.
- Character metadata and official token art come from the issue #193 custom registry and the existing TB/S&V catalogs. The local prototype state supports all 47 registry Characters without Core or persistence.
- Selecting a token strengthens its kind-colored ring and adds a small oxblood check. It does not add a card background or per-Character source badge.
- Kind color is now explicit and consistent across kind tabs, token rings, selected glows, and the detail strip: Townsfolk blue, Outsider teal, Minion magenta, and Demon red. The two good kinds and two evil kinds retain family resemblance without sharing the same accent.
- Clicking a token keeps the existing select/deselect action and opens one compact summary strip on the same footer row as `이전으로 / 선택 완료`. The strip shows token art, Korean and English names, kind, source, and a clamped ability summary; closing it does not change selection.
- The summary and navigation now share one stable footer row instead of taking height from the internally scrolling Character grid. On mobile the strip tightens its token and close control and clamps the ability to one line, preserving more complete token rows above it.
- Choosing `새롭게 작성한다` enters Step 2 with an empty name and selection. Imported game JSON bypasses Step 2; this screen is used only when composing or revising a new script.
- Step 2 intentionally presents no validation, error, or warning copy while the Storyteller is still composing. `선택 완료` always opens review; missing name, an empty selection, and missing Character kinds are deferred to Step 3 review.
- With no transient notice lane, `이전으로` and `선택 완료` stay anchored at the bottom-right of the board.
- The grid scrolls inside the board. At narrow mobile heights the filters and actions remain fixed while the Character pool receives the remaining space.

## Current review study

- Step 3 is the single place that evaluates the draft. The decorative `THIRD TURN` eyebrow is removed; the chapter heading alone names the screen.
- Its summary shows the scenario name, total selected Characters, the four kind counts, and source counts for every source currently present in the registry. Beneath it, every selected Character is listed by kind with token art plus Korean and English names.
- On mobile, the summary and selected roster share one internal scroll area, so the compact roster receives more usable height and the Storyteller can scroll back to the counts when needed. Findings and actions remain fixed below it. Desktop retains the summary and roster as separate grid rows.
- Missing scenario name and an empty Character selection are blocking findings for a newly composed script. An imported file may omit the scenario name: review displays `이름 없음` without a finding and still permits `새 게임` or resume. A selected roster is internally compared with the standard full-script recommended minimum of 13 Townsfolk, 4 Outsiders, 4 Minions, and 4 Demons; each shortfall is a non-blocking warning. The visible warning names only the deficient kind (for example, `외지인 수가 부족합니다.`) rather than exposing the numeric threshold or calculation.
- This review does not infer a playable range or judge balance from edition/source ratios. Exact in-play distribution remains a Setup concern because player count and Character setup modifiers can alter it.
- The footer is now `돌아간다 / 새 게임 / 이어서 진행`. `돌아간다` always opens Step 2 with the current name and Character pool intact, including drafts loaded from JSON, so the Storyteller may revise part of an imported configuration before reviewing it again. `새 게임` is the primary action for a fresh script; `이어서 진행` appears as the primary action only when the imported event stream contains `setupConfirmed` and does not contain `gameEnded`.
- For an active imported game, adding or removing Characters that have never appeared in the event stream preserves `이어서 진행`. Removing a Character referenced by an assignment or confirmed event is allowed as an edit, but review then explains that only `새 게임` is available and hides `이어서 진행`; restoring every referenced Character restores resume eligibility.
- `새 게임` and `이어서 진행` remain boundary actions in this prototype; routing into the production game runtime is intentionally outside this UI-decision study.
- This is the approved information-structure baseline for the later Production review screen, using the same transparent-board material.

## Visual references

- Dark-fantasy interface boards: https://moontribe.artstation.com/projects/JvRobd
- World-specific motifs concentrated in the outer frame: https://cseperkepapp.artstation.com/projects/A9Qx9o
- Natural textures, restrained borders, and legibility-led typography: https://jaikarpothula007.artstation.com/projects/zxg5K2
- One strong floating menu silhouette over atmospheric artwork: https://www.behance.net/gallery/55110421/Dark-Fantasy-Game-Menu

## Current artwork revision

- The selected `v6` master uses the approved occult-queen Storyteller direction: shadowed hood, sculpted antique-gold ceremonial armor, a fitted oxblood bodice, stronger mature silhouette, quill hand, crimson fate-threads, and long pointed nails.
- The manuscript is no longer treated as a blank live-UI writing surface. It is a dense physical artifact filled with occult notes, diagrams, portraits, corrections, seals, and thread-linked relationships; the interactive UI remains on its independent translucent board.
- Candlelight falls naturally across the manuscript instead of illuminating the paper uniformly. The high-resolution source remains 1672×941 with the same centered one-point perspective and responsive zoom geometry as the previous master.
- This artwork is the approved visual baseline for the later Production implementation.

## Current review evidence

- Checked the consolidated Production landing → `Custom Scenario` entry → three-step manuscript flow and the first-scene return to the landing on the final review route.
- Browser-checked at 1440×900, 1179×439, 390×844, and 320×568 without page-level clipping or overflow; the Character pool owns the internal scroll area on short screens, and kind/source filters retain a 44px minimum touch target.
- Checked both Step 1 entry paths, scenario-name entry, kind and source filters, Character selection, Step 2 completion from an incomplete draft, and consolidated validation on Step 3.
- Checked English queries (`fortune`, `no dashii`), token selection plus detail opening, detail close without deselection, and the shared mobile detail/action footer row. The Character grid remains visible while the detail is open.
- Checked the Step 3 roster with the eight-Character saved fixture and the 47-Character maximum at 1440×900 and 390×844. All selected Characters remain in the grouped roster; desktop lets the roster scroll independently, while mobile scrolls summary and roster together. Findings plus actions remain visible without page overflow.
- Checked search/filter exclusivity in both directions: a cross-kind English query resets kind/source and finds its result, while either a kind or source choice clears the query. Verified four distinct computed kind colors and a 47-result all-kind catalog at 1440×900 and 390×844.
- Checked schema-v2 JSON import with an active setup, direct Step 1 → Step 3 transition, the three-action resume footer, an unnamed file that shows `이름 없음` without blocking `새 게임`, a completed file that omits `이어서 진행`, and malformed JSON that stays on Step 1 with an error. The mobile three-action footer fits at 390×844 without horizontal overflow.
- Checked an active imported game through the edit/review loop: removing an unused candidate keeps `이어서 진행`; removing an event-referenced Character leaves `새 게임`, hides resume, and shows the new-game-only explanation; restoring that Character restores resume.
- Final repository verification: `pnpm --dir web test` passed 173 unit and 604 integration tests; `pnpm --dir web build` completed and kept the development-only prototype out of the Production bundle.
- Final `prototype_reviewer` audit passed Production landing fidelity, bounded decision scope, review-frame separation, and prototype test scope.
- No presentation-only automated test was added; the shared Production surface remains covered by the full web suite, while exact prototype presentation is covered by browser and `prototype_reviewer` evidence.

## Prototype boundary

This is the approved UI and interaction baseline, not a Production implementation. It uses the real TB/S&V Character registry and assets plus prototype-only review rules, but intentionally omits persistence, production-grade validation, roster assignment, and final Setup behavior. Those boundaries remain work for Epic #190 after the Epic #189 foundation is complete.

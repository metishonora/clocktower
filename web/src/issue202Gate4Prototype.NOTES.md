# Issue 202 · Gate 4 prototype

## Review scope

- Treat the approved Gate 3 first/other order editor as the preceding visual and interaction baseline.
- Keep Character and night-order review read-only, remove the dedicated Character edit action, and allow only the scenario name to be edited in place.
- Restore the approved #200-style Character review: composition counts plus a grouped list of every selected Character with icon and name.
- Omit first/other night order summaries from final review; Step 3 remains reachable through the previous-step action.
- Compare product action hierarchy and feedback for new draft, continuable current-game definition, mismatched draft, exact restoration, and invalid order states.
- Keep review fixture controls outside the product stage.
- Keep edit and footer action hit areas at least 44px high on narrow touch layouts.
- At tablet widths, use larger composition, roster, warning, progress, and action typography; reflow the roster into wider auto-fit rows so the larger names remain readable rather than truncating.
- On mobile, keep only the chapter title fixed while scenario name, composition counts, the full Character roster, progress, warnings, outcome actions, and the explicitly labelled previous-step return action move through one continuous vertical review scroll.

## Approved interaction decisions · 2026-09-06

- Remove the general status notice panel and use the cleared space for three large outcome actions: `시나리오 저장`, `새 마도서 쓰기`, and `마도서 이어 쓰기`.
- Starting a new grimoire is primary for a new or changed definition; continuing is primary only when the draft matches the active game's definition.
- When continuing is available, show a compact previous-progress panel with day phase and living/dead counts so the target game is identifiable.
- Increase typography across composition, roster, progress, navigation, and outcome actions. In invalid fixtures, show only a single `…이/가 올바르지 않습니다.` blocking reason in a centered lower warning while keeping all unavailable actions disabled.
- Let the scenario name be edited directly in composition information. An empty name is a blocking error shown before Character and order validation; changing a continuable scenario name makes it differ from the active game and removes the continue path.
- Show non-blocking Character-pool shortage guidance against the existing 15-player scenario recommendation (Townsfolk 13, Outsider 4, Minion 4, Demon 4). This is candidate-pool breadth, not the 9/2/3/1 actual roster selected during Setup.
- Omit source-script counts from final review composition information.
- Omit the upper-right state badge; normal states need no extra label, while invalid state is communicated by the centered lower reason alert.
- Do not expose detailed validation types or error counts in final review. Validate Character configuration first and show only `Character 설정이 올바르지 않습니다.`; only after that passes, show `밤 행동 순서가 올바르지 않습니다.` for any order structural or reconciliation failure.
- Empty Character selection can be created by the current Step 2 baseline unless Step 2 blocks forward navigation. Duplicate, unknown, missing, boundary, and unreconciled-order failures are defensive states expected from malformed import, legacy/corrupt data, or an implementation fault rather than the move-only Step 3 UI.
- `이어서 진행` appears only when the draft exactly matches the current game's definition; it returns after exact restoration.
- A mismatched draft does not mutate the existing game and offers only a new-game path.
- Invalid order disables save and new-game actions and points back to Step 3 recovery.
- Final review is the terminal scenario-authoring step. `새 마도서 쓰기` opens a new grimoire directly; seat, player, and actual-roster setup belongs to the game flow rather than scenario authoring.

## Rejected follow-on Gate

- Discard the proposed Setup projection Gate. Showing seats, players, and the actual roster after final scenario review mixes per-game setup into scenario authoring without another scenario decision to make.
- Do not retain the rejected Gate files or navigation. The approved prototype ends at Gate 4 and hands off directly to the grimoire flow.

## Prototype boundary

- Typed local fixtures only; no Rust, WASM, persistence, runtime identity comparison, save, or game activation behavior.
- New- and existing-grimoire destinations are bounded silhouettes. There is no further scenario-authoring Gate after final review.
- No prototype-only tests or shared production/configuration changes.

# Issue #179 Bad Moon Rising UI prototype review outcome

## Review identity

- Status: UI shell review decisions complete
- Reviewed through: 2026-08-27
- Scope: development-only BMR Setup, Grimoire, and Play examples
- Production route, persistence, canonical commands, and Character automation: excluded

The retained prototypes document the decisions made during review and provide runnable examples for
later Production integration. Product requirements below, rather than fixture-specific copy or
Character details, are the handoff contract.

## Product requirements retained from review

### BMR shell and theme

- Use a red Blood Moon direction distinct from Trouble Brewing and Sects & Violets.
- Night uses dark burgundy surfaces; Day uses a light parchment surface with readable burgundy accents.
- Replace the generic Day/Night icon with one flat celestial disc: Blood Moon red at Night and sun gold
  at Day, with a visible soft two-stage glow.
- Keep the celestial disc and Undo in separate header space at mobile, tablet, and desktop-site widths.
- Keep review controls and fixture descriptions outside the Production-like frame.

### Setup

- Hide the Godfather adjustment control until Godfather is selected.
- Revealing the desktop/tablet adjustment participates in layout so the distribution content moves with it.
- On mobile, place a compact adjustment control with the role-detail area rather than the Minion heading.
- Use explicit `외지인 +1` and `외지인 -1` labels.
- Select a mandatory single option immediately; require input only when multiple valid choices exist.
- Do not repeat the chosen correction below the effective distribution.

### Grimoire

- Reuse the established rectangular assignment and confirmed-game interaction.
- After confirmation, the Grimoire is read-only; returning to assignment requires destructive confirmation.
- Open Player details through the established S&V desktop slide-over / mobile bottom-sheet pattern.
- Do not add a generic `현재 상태 · 생존` row. Keep the existing attached-token area for implemented
  Character and status tokens.
- Use the existing reminder-token area for script-specific state instead of adding parallel status cards.

### Play and results

- Keep the current task dominant and the roster-filtered official phase order secondary.
- Let the phase list follow page flow without a nested scroll region.
- A manual Character step exposes only `처리 완료` and `해당 없음`; do not add a `수동 처리` badge or
  simulated automated result.
- The current Character identity is display-only and does not open a new hint/detail action.
- Execution survival stays in the existing vote/result UI rather than creating another phase or result screen.
- Ordered outcomes use the existing Grimoire `completedSelection` flow. Target confirmation and result
  review remain in the Grimoire, with `다음` as the handoff back to progress.
- Preserve outcome order and make the actual `사망` / `생존` result readable without adding decorative
  outcome borders that differ from the established row treatment.

### Private Reveal boundary

- Reuse the existing S&V full-screen Reveal boundary with the BMR theme.
- The player-facing Reveal covers Storyteller controls and contains information for its current recipient only.
- Character-specific payload, preview, recipient order, validation, and copy are defined with the Character
  that produces the Reveal.

## Rejected additions

- A separate Execution-survival task or result screen
- A progress-tab result card after Grimoire target selection
- A Character hint/detail dialog opened from the Play current task
- Prototype-only manual-state badges
- A separate public-state / actual-state card beside reminder tokens
- Detailed Lunatic/Shabaloth Reveal content in the shared shell prototype

The rejected Survival and detailed Reveal implementations are not exposed by a development entry. Their
NOTES files retain the decision history.

## Character implementation handoff

The following remain with their Character or Domain integration work:

- Lunatic Actual/Shown data, fake Demon Reveal, real Demon information, target order, and copy
- Zombuul official reminder-token content, actual-death transition, nomination behavior, and ghost vote
- Shabaloth target selection, ordered Death resolution, and later Resurrection
- Professor Resurrection inputs and result
- Mastermind extra-Day trigger, phase presentation, execution handling, and win condition
- protection candidates, applied/prevented/bypassed source audit, public announcement, and canonical commands
- official Character token artwork and all Character-specific validation, persistence, and replay

## Retained development examples

- `issue-179-bmr-shell` — Setup and Godfather behavior
- `issue-179-bmr-grimoire` — 7/15-Player assignment
- `issue-179-bmr-grimoire-confirmed` — read-only details and return confirmation
- `issue-179-bmr-lunatic-identity` — Actual/Shown identity shell example
- `issue-179-bmr-zombuul-state` — reminder-token-area shell example
- `issue-179-bmr-first-night` — official order and manual current task
- `issue-179-bmr-ordered-death` — ordered results in the Grimoire

All entries are guarded by `import.meta.env.DEV`; Production builds and landing navigation do not expose them.

## Verification

- `pnpm --dir web test` — passed: 160 unit tests and 592 integration tests
- `pnpm --dir web build` — passed
- Production `dist` search — no Issue #179 prototype identifier or entry present
- `git diff --check` — passed

## Production acceptance handoff

When the real BMR adapter and Character implementations are connected, verify:

1. Setup arithmetic and mandatory Godfather selection against real Domain state.
2. Read-only confirmation, Player details, and destructive return through the real session path.
3. Official first/later-night order and manual-step actions with canonical state.
4. Existing vote/result and Grimoire result handoffs with real survival and ordered outcomes.
5. Storyteller-information isolation in every player-facing Reveal.
6. Day/Night contrast, celestial-disc/Undo separation, primary-action visibility, safe area, focus, and
   overflow at 360 × 800, 390 × 844, 768 × 1024, 1024 × 768, and 1440 × 900.
7. Trouble Brewing and Sects & Violets behavior remains unchanged.

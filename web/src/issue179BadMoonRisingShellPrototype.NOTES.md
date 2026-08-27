# Issue #179 Bad Moon Rising shell prototype review notes

## Current slice

- Stage: 1 — Setup only
- Status: Approved on 2026-08-24
- Entry: `/clocktower/trouble-brewing/?prototype=issue-179-bmr-shell`
- Production-like frame: `Bad Moon Rising` header, utility chrome, `직업 / 마도서 / 진행`, Setup
- Review controls: outside the Production-like frame
- Data: fixture-only; no BMR Production session, persistence, route, or Character automation

## Accepted Setup decisions

- Use a flat celestial disc outside the phase-action icons: Blood Moon red at Night and sun gold at
  Day, with a visible two-stage outer glow and no border, rays, inner gradient, or dimensional shading.
- Hide the Godfather adjustment surface until Godfather is selected. On larger viewports, reveal it by
  expanding layout height so the effective distribution moves with it; do not repeat adjustment copy
  below the distribution.
- On mobile, hide the large adjustment surface and attach a compact adjustment row to the fixed
  role-detail surface. Use the exact labels `외지인 +1` and `외지인 -1`.
- Automatically select the adjustment when only one option is valid. Require an explicit choice only
  when both directions are valid.
- Keep review controls outside the Production-like screen.

## Shared shell revision requested on 2026-08-24

- On tablet-width screens, move the celestial disc farther left so neither the disc nor its glow
  overlaps the Undo button. Keep the approved flat disc and glow treatment unchanged.

## Revision requested on 2026-08-24

- Hide the entire Godfather adjustment surface until Godfather is selected; reveal it in place when
  Godfather enters the roster.
- Remove the repeated adjustment summary below the effective distribution.
- Replace the separate decorative Blood Moon and generic phase icon with one header celestial mark.
- On theme change, let the Blood Moon set while the sun rises for Day, and reverse the motion for Night.

## Follow-up clarification on 2026-08-24

- The animated, dimensional celestial icon was rejected. Remove the generic phase icon entirely and
  keep the original flat background disc.
- Use the same unshaded disc for both themes; only its Blood Moon red / sun gold color changes.
- Restore a low-opacity outer glow around both flat discs without adding inner shading or depth.
- The Godfather adjustment reveal must animate layout height so the distribution visibly moves with
  the appearing or disappearing surface, rather than only fading the adjustment surface itself.
- On mobile, do not place the adjustment in the Minion group heading. Attach a compact adjustment row
  to the fixed role-detail surface so it remains available at any catalog scroll position; keep the
  full adjustment and distribution layout on larger viewports.
- When only one Godfather adjustment is valid, select it immediately. Require a manual choice only
  when both adjustment directions are valid.

## Approved before implementation

- BMR uses a red Blood Moon visual direction.
- Night uses near-black burgundy and a crimson moon; Day uses bone/parchment and muted burgundy.
- The flat moon/sun keeps a dedicated position to the left of undo on desktop-site viewports; the
  existing pad and mobile offsets remain independent.
- Brand red and destructive/error red must remain distinguishable by value, copy, and shape.
- Private Reveal will reuse the Sects & Violets full-screen handoff when that slice is reviewed.
- Setup confirmation leaves the Grimoire read-only; returning to assignment requires destructive
  confirmation when the Grimoire slice is reviewed.
- Zombuul will use explicit `alive → apparent dead/actual alive → actual dead` Storyteller states.

## This review decides

- Blood Moon Day/Night brand direction in the current Production shell.
- Player count, Demon selection, Godfather choice, effective distribution, Character catalog and
  role-detail hierarchy.
- Whether the automatically selected Godfather option at 7 Players and its effective distribution are clear.
- Whether both valid options at 9 Players can be compared without a second explanatory screen.
- Mobile placement of distribution, catalog and the fixed Confirm surface.

## Deferred until this slice is approved

- Grimoire assignment, Lunatic Actual/Shown identity and confirmed read-only details
- first/later-night Play and explicit manual steps
- survival and ordered Death/Resurrection presentation
- private Reveal
- Zombuul apparent/actual Death presentation
- Mastermind extra Day

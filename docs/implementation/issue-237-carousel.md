# Issue #237 — Carousel implementation

Status: functional implementation available for review; the eight deviations
identified by the UI parity audit have been corrected and verified. See
[UI parity audit](issue-237-ui-parity-audit.md) for scope and evidence.

## Scope and authority

Reusable custom-runtime support for Balloonist, Nightwatchman, Pixie, Zealot,
Boffin and Marionette. Kazali is deferred. No game-specific roster, seating,
recommended ability, or two-game scenario is part of this implementation.
The issue body predates the completed prototype review; the decisions below
supersede its conflicting Pixie, Zealot and notification wording.

Approved visual reference: `codex/issue-237-prototype`,
`web/src/prototypes/issue237/`. Production must not import prototype code or
fixtures. Preserve the existing product around the reviewed changes.

## Reviewed behavior

- Setup controls use the role-detail footer above role confirmation. Dropdowns
  start at `선택 필요`; selecting a value confirms the draft choice without a
  separate button. Invalid Jinx choices are omitted and rejected by Core.
- Balloonist: +0/+1 Outsider selection; keep the current roster and let the
  Storyteller correct its composition. No redundant explanatory paragraph.
- Boffin: select an on-script, not-in-play good ability (excluding Drunk).
  Initial selection belongs to role setup, not seating. New Demons use the
  existing progress identity/ability presentation, recipient and dropdown,
  with a confirmation button. No Boffin-player input. Actual Demon identity
  and original ability are retained.
  If multiple living Demons require a recipient choice, use a recipient
  dropdown in that same screen; keep the recipient read-only when only one
  is eligible. User approved this recommendation on 2026-09-19.
- Boffin reminder: existing seat `+1` and detail token; `<role> 능력`, role
  icon, `과학자가 부여함`. Inactive grant has an X. No bespoke tiny role token.
- Boffin private reveal: the source sees `악마에게 부여한 능력`, followed by
  the granted character icon and name; the Demon sees `과학자가 부여한 능력`,
  followed by the same icon and name. No duplicate footer or `능력` suffix on
  the character name. Recipient context is projected with the saved notification,
  not guessed from the player's current character or the reveal sequence.
  Reuse the existing character-reveal identity layout and its 150–220px icon,
  not the small information-source icon style.
- Nightwatchman: `오늘 사용하지 않음` finishes this occurrence without spending
  the ability or another confirmation. Native and acquired instances share
  the same implementation and retain separate usage/provenance.
- Pixie: first information reveals only the learned Townsfolk, not its player.
  Mutable madness assessment is a Mutant-style free action with
  `충분히 집착함` / `집착하지 않음`. At the marked player's death, use the
  assessment at that event to grant immediately or fail; do not ask again.
  Remove the free action afterwards. Preserve the originally learned role
  through changes to the marked player's identity. Tokens belong to that
  player: `집착` becomes `능력 가짐` on success, and disappears on failure.
- Zealot: when the ability is effective and at least five players live, select
  and lock the required vote, highlight red and label `강제 투표`. Reset keeps
  it selected; totals include it. Remove the long obligation notice.
- Marionette: select its believed good role in the same setup footer; retain
  actual identity/alignment separately. Validate only final initial Demon
  adjacency, including random seating. No extra physical-bag workflow.
- Marionette simulation uses the Drunk presentation, with an orange
  `꼭두각시` Storyteller badge. Do not invent an evil-team exclusion phase.
  Separate other Minions' information from the Demon's information.
- In-play Marionette creation uses the ordinary progress UI and a believed-role
  dropdown. Privately reveal the change to the affected player, then return to
  the Storyteller and explicitly reveal the Marionette to the Demon, in the
  same continuation. Never automatically expose the second recipient's secret.
  Preserve the identity-changing effect's alignment semantics.
- The standalone `새 악마에게 통지` prototype scene is discarded; this does
  not itself remove mandatory character-rule knowledge or reveal isolation.

## Architecture and verification

Character policy belongs to `characters/carousel.rs`, with existing typed
registries for actions, reminders, effects and Jinxes. Core produces legal
choices, confirmed facts and narrow Reveal payloads; UI owns only drafts and
presentation. Reuse ability provenance, simulation guidance, event validation,
replay and causal Undo. Tokens remain projections, not canonical facts.

Acceptance covers native and acquired abilities, impairment/recovery, death and
identity changes, malicious/invalid replay, original TB/SnV regressions, setup
and seating, private reveals, Undo, save/reload and file round trips. Do not
publish catalog entries as supported until their production flow works.

Required Jinx pairs: Balloonist/Marionette, Boffin/Drunk, Marionette/Mathematician.
Update the pinned official snapshot and verify full supported-catalog coverage.
Reference/PDF and Korean wording are included; off-catalog partners are not.

## Pixie exceptional information — approved 2026-09-19

User approved selecting the learned Townsfolk independently of the marked
player under Vortox or poison/drunkenness, using the existing information
controls. Keep the private Reveal limited to the learned character; never
reveal the marked player. Core owns the legal dropdown options:

- Effective Vortox: only on-script Townsfolk characters not currently in play.
  This restriction also applies when the Pixie is poisoned or drunk.
- Poison/drunkenness without effective Vortox: on-script Townsfolk characters,
  whether in play or not; truthful information is allowed, not mandatory.
- Neither: ordinary truthful information about the marked Townsfolk. Do not
  expose an unnecessary independent learned-character selector.

Persist the marked player and the originally learned character separately.
When the marked player dies, a living, sober and healthy Pixie with sufficient
madness gains the ability originally shown, even if that information was false
or the marked player has another character. Vortox does not suppress this
acquisition. If the Pixie is poisoned/drunk at the death event, no ability is
actually granted, and later recovery must not retroactively grant it. Preserve
the reviewed immediate resolution, reminder cleanup and no extra acquisition
question or private acquisition announcement.

Rule check requested 2026-09-19: Pixie's first sentence explicitly grants
starting information ("You start knowing 1 in-play Townsfolk"); it is not a
notification of the Pixie's own identity. An effective Vortox forces that
information to be false. Poison/drunkenness alone allows, but does not require,
false information. Ability acquisition is a separate non-information effect;
Vortox must not be implemented as suppressing it. The official Pixie page
also says acquisition is not explicitly announced to the Pixie.
Sources: https://wiki.bloodontheclocktower.com/Pixie,
https://wiki.bloodontheclocktower.com/Vortox,
https://wiki.bloodontheclocktower.com/States.

## Implementation checkpoint

All six characters are available to reusable custom scenarios. Official TB/SnV
runtime remains separate. No scenario-specific roster or game progression was
added. Kazali remains out of scope.

- Carousel-owned rules, registered actions, source-bound ability grants,
  simulation, reminders, Korean presentation and official assets are connected
  to production setup, progress, private reveals and saved continuations.
- Balloonist uses Core-derived +0/+1 setup choices and per-night registered
  character type. Marionette/Balloonist setup and invalid saved choices are
  validated in Core, not only in the dropdown.
- Nightwatchman preserves one-use state across native/acquired abilities and
  temporary impairment. Deferral advances immediately; impaired use consumes
  the ability without falsely sending a real notification.
- Pixie persists the marked player separately from the originally learned role.
  The approved Vortox/impairment choices, mutable madness assessment,
  immediate death-time acquisition/failure, simulation and reminder cleanup
  are connected. There is no acquisition confirmation or acquisition reveal.
- Boffin uses the setup footer initially and the existing progress screen for
  a new Demon. Its native Demon ability is preserved. Source inactivity
  suspends the grant without resetting use history; old historical grants
  cannot activate after their recipient's identity changes.
- Marionette validates initial adjacency and its believed good role, separates
  evil-team knowledge, and reuses Drunk-style fake actions with an orange badge.
  Midgame creation privately reveals the apparent role before notifying the
  Demon; each recipient remains separately concealed.
- Zealot votes are Core-derived, locked and included in totals; reset preserves
  the required votes.
- Supported Jinx handlers and Korean reference text cover Boffin/Drunk,
  Marionette/Balloonist and Marionette/Mathematician.
- Character rules and architecture notes reflect the source-bound model.
  Production code does not import prototype code.

The earlier prototype-only checkpoint is superseded. No merge, issue closure or deployment
has been performed. The review server serves the production build from the
issue worktree, not the retained prototype.

Review URL: http://100.91.205.43:10237/clocktower/

## Final verification — 2026-09-19

- Rust: 251 custom-domain tests (including 26 Carousel tests) and six
  custom-WASM tests passed.
- Web: 876 integration tests across 116 files and 166 unit tests passed.
  The integration suite includes 12 new Carousel production-component tests.
- Isolated custom-runtime verification passed with official runtime source and
  artifacts absent: custom native/WASM, 353 custom-web tests and 13 fixture
  tests. Final source-boundary and architecture checks also passed.
- Seven real-browser tests passed against the final optimized production build:
  390px/1280px private Nightwatchman/Boffin reveals, immediate Nightwatchman
  deferral, Marionette fake-ability presentation and private Pixie information.
  Final mobile screenshots were inspected for readable names and controls.
- Production build, PWA contract, formatting and diff whitespace checks passed.
  Chromium and optimized WASM required sandbox escalation; neither optimizer
  nor validation was disabled.
- The server operator verified HTTP 200 and exact equality with the latest
  dist index and its seven referenced assets, without restarting the server.
  The review server is retained with keep=true.
- Existing legacy tests were aligned with already-shipped ghost-vote/death
  accessibility labels; application death behavior was not reverted. Action
  catalog expectations now include Carousel, and Washerwoman-specific tests
  select that character explicitly rather than Pixie's same-named action.

Build output still contains existing unused-code warnings. No failed tests
remain in the verification suites above. Browser coverage is targeted, not an
exhaustive simulation of every possible multi-character game.

## Review corrections — 2026-09-20

- Mayor and Saint victory conditions now follow the actual alignment of the
  ability owner, including a Demon receiving the ability from Boffin. Evil Mayor
  victory is not suppressed by the Evil Twin restriction on good victories.
- Daytime acquired actions check grant availability separately from ability
  impairment. A poisoned Boffin suspends the granted action; poisoning only the
  Demon does not invalidate the good ability. Recovery preserves its unused state.
- Daytime Sweetheart, Barber and Klutz death effects require an active grant at
  the death snapshot. Sweetheart malfunction evidence uses that same boundary.
- Marionette's simulated Artist/Savant information is not forced false by Vortox.
  Both day and night consult the real source of simulated guidance.
- Core projects ability-scoped impairment metadata to progress UI. The
  Nightwatchman-specific presentation exception has been removed; Empath and
  native-versus-granted poison cases have regression coverage too.
- Reveal integration fixtures use the actual seat/name identity contract, fixing
  the TypeScript errors that previously prevented the formal integration command.
- Frozen compatibility tests exclude only the new projection field, while
  retaining their existing state, event, proposal and stored-session comparisons.

Verification: 258 custom-domain tests, six custom-WASM tests, 902 web integration
tests, 166 web unit tests, 353 custom-web tests and seven production-browser tests passed. The fixture
runtime passed 109 Rust tests and 13 web tests. Production build, architecture and
source-boundary checks, PWA verification and diff whitespace checks passed.
The existing review server was verified against the latest dist index and seven
referenced assets without restarting; it remains available with keep=true.

## Finalize follow-up — 2026-09-20

The acceptance issue's remaining random-placement limitation is corrected:
Carousel projects the required character adjacency through setup distribution;
the setup controller applies the supplied relationship after shuffling without
hardcoding character rules. Seats, names, selected roles and the believed role
are retained. Five- and thirteen-player regression cases cover both one- and
three-Minion games. Manual invalid placement remains rejected by Core.

The user reconfirmed the policy in `docs/workflows/ci.md`: character logic and
UI regression suites are local validation, not additions to default CI. The
proposed Carousel-specific CI additions were withdrawn; local tests remain.
The user subsequently authorized removing previously reintroduced regression
steps too. `validate.yml` is restored to build, PWA verification and the four
production startup smoke tests; no test files or local commands were removed.

After the placement correction, custom-domain 258, custom-WASM six, custom-web
353, Carousel UI 40, and production-browser 11 tests passed locally. The last
browser run includes the four CI smoke cases and seven Carousel cases. TypeScript,
production build, PWA, architecture and source-boundary checks also passed.

# #220 · Approved editor to conventional grimoire prototype

## Scope confirmed 2026-09-10

The user agreed to show the final approved #205 editor connected to the existing SnV-shaped grimoire: final review → loading → role/seat setup → first-night task/reveal/continue, and exact-match imported-game resume. No story UI design or new production behavior is authorized by this prototype review.

Entry: `/clocktower/issue-220-prototype.html`. Previous `/clocktower/issue-220-grimoire.html` remains the earlier partial real-Setup experiment and is not this review.

## Preserved and changed

Copied #205 ScenarioPrototype, OrderPanel, firstNight fixture and CSS. New/JSON choices, direct import-to-review, immediate simulated JSON download, no new-grimoire confirmation, exact-match resume and restoration remain. Only the prototype boundary callbacks now reach the local grimoire, with TB/SnV loading markup and styling. Review sample pool contains the representative mixed roles; this is fixture data, not a change to the editor's allowed catalog.

The grimoire reuses shared ProductionApplicationShell, SetupPresentation, RoleCatalog, GrimoirePresentation, RectangularGrimoireBoard, PlayPresentation, SectsAndVioletsReveal and their styles read-only. Setup view is a local copy of the earlier #220 composition, driven entirely by presentation fixture state. No production code, configuration, WASM, session, file I/O, or persistent storage is modified or called by this entry.

## Review states

- Editor: new, JSON scenario, JSON game, invalid/cancel file, exact-match resume, changed draft, restoration.
- Setup: candidate pool passed as selectable roles with no initial actual roster; count choices; name/seat/actual/shown inputs; assignment and transition.
- Representative first night: 5-player chef/empath/clockmaker/poisoner/imp, with approved scenario order projected to these fixture actors. System information, three bluff choices, target choice, numeric information, conceal before continuing, and dawn endpoint. These are manually editable presentation examples, not calculated results or validation of character-specific rules.
- Resume: local imported-game fixture starts at demon information, with the same scenario and five assigned players. Refresh resets everything.
- Prototype tools are outside the product surface. They can populate the five-player roster/seat fixture after starting a new grimoire. Other character task interactions are not invented by this prototype; unsupported tasks stop at a review boundary.

## Preflight

Focused TypeScript no-emit check on the prototype entry and its imports passed. No tests, regression suites, production builds, or rule verification run (prototype skill boundary).

Initial visual preflight was blocked by a locked Mac. After user resumed, Safari native CUA opened the external HTTP URL and root performed the following real UI interactions:

- Desktop final review → loading → empty actual roster from the 25-character candidate pool → select chef/empath/clockmaker/poisoner/imp → assign seats → Setup confirm → minion information → reveal → conceal → next → three bluff selection gate.
- Mobile 390×600 CSS viewport (prototype-only iframe in Safari, not an iPhone): source, review, edit name causing resume to disappear, exact restoration causing resume to return, resume into demon information → three bluffs → public reveal → conceal → poison target → chef/empath/clockmaker numeric reveals → dawn → grimoire seats.
- Reveals replace the accessible product tree; root is inert while player information is visible. Closing restores the console. Mobile frames scroll to lower controls.
- Reused the missing existing SnV numeric-information stylesheet after visual inspection; final number capture supersedes the earlier small-number capture.

Evidence: `docs/prototypes/issue-220/connection/`. `desktop-transition.png` captures the actual loading overlay. Independent reviewer is checking final captures. No automated tests or production builds were run. Physical iPad/iPhone and every character's specific first-night interaction are outside the verified representative set.

Independent `prototype_reviewer` final verdict: **Pass, no remaining blocker in the representative connection scope.** Confirmed preserved editor, loading/empty Setup, desktop/mobile seats, public reveal/conceal/continue, restored exact-match resume and isolated review tools. User approval of this new connection is still pending.

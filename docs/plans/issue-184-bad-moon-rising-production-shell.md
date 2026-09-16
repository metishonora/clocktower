# Issue #184 Bad Moon Rising manual Production shell plan

## Status

Production implementation complete and verified on 2026-08-29. The UI baseline was approved after
comparison with the Trouble Brewing and Sects & Violets Production implementations. Technical
session, canonical replay, Undo, import/export, and recovery behavior follows the existing Sects &
Violets Production implementation unless BMR's script contract requires a narrower adapter.

## Objective

Add a direct-only `/clocktower/bad-moon-rising/` Production entry that lets a Storyteller run the
real canonical flow without Character automation:

`Setup -> seating -> first Night -> manual Day -> later Night -> repeat`

The UI must present Rust/WASM `ReplayState` facts and must not infer Character outcomes, targets, or
success from presentation state.

## Decisions

- Store the combined canonical GameFile, Setup draft, and durable presentation state through
  `IndexedDbWebSessionStorageDriver(BAD_MOON_RISING)`, using `session:badMoonRising` like S&V.
- Treat Issue #184's `latest:badMoonRising` wording as the latest BMR session concept, not as a new
  physical key for the combined web-session snapshot.
- Preserve roster, seat assignments, names, and Lunatic Shown identity when destructively returning
  from a confirmed game to seating; clear canonical progress and transient interaction state.
- Persist only durable navigation state. Dialogs, pending Reveal state, and unfinished target or bluff
  selections are reconstructed or cleared after reload.
- Allow Shown Character input only for an Actual Lunatic and permit any BMR Demon, including one
  that is not in play, following the official Lunatic setup rule.
- Use the canonical `day*:manual -> day*:toNight` bridge. Do not expose S&V nomination, voting,
  Character-aware Day, or game-end behavior.
- Reuse shared Production presentation components. Keep BMR catalog, labels, command mapping, and
  theme styles behind BMR-owned adapters and files.

## Approved UI baseline

- The confirmed Grimoire center shows the canonical phase, elapsed phase time, and a Progress call to
  action. It does not add a separate `확정` label.
- Confirmed Player details reuse the shared Production desktop slide-over and mobile bottom-sheet
  structure. BMR adds only the Actual/Shown Lunatic comparison that the script requires.
- Do not fabricate life-state or attached-token sections. The attached-token area is omitted when
  canonical replay has no tokens.
- Role information remains inspectable after seating confirmation, including Characters not in the
  active roster. Confirmed seating does not expose randomize or reset controls.
- Desktop and tablet Progress keep the current task and phase order side by side; mobile stacks them
  vertically.

## Acceptance invariants and evidence

| Invariant | Strongest practical evidence |
| --- | --- |
| Direct BMR route exists while landing still exposes only TB/S&V | Production build input and landing/build assertions |
| 7/9/15 Setup uses WASM distribution and preserves the selected Godfather choice | Focused adapter tests plus real-WASM create/replay integration |
| Confirmed seating is read-only and destructive return clears canonical progress only | Production component interaction test |
| Current task and order come from canonical `currentStep`/`phaseOverview` | Real-WASM first Night -> Day -> later Night browser integration |
| Manual steps expose only handled/not-applicable outcomes | Production interaction and command assertions |
| Reload, new game, Undo, export/import keep canonical and presentation aligned | Web-session lifecycle integration tests |
| TB/S&V data cannot enter the BMR session | Cross-script import and stored-session rejection tests |
| Production code and bundle do not depend on Issue #179 fixtures or review controls | Architecture/build search assertion |
| Core actions remain visible at target mobile, tablet, and desktop sizes | Playwright viewport checks and rendered review |
| Existing TB/S&V behavior remains unchanged | Existing web test suite and Production build |

## Verification record

- `pnpm --dir web test`: 160 unit tests and 601 integration tests passed.
- `pnpm --dir web build`: Production build completed with the direct BMR HTML, CSS, and JavaScript
  entries.
- `pnpm --dir web run test:browser:run -- production.spec.ts`: 5 Production-route tests passed,
  including BMR mobile, desktop, iPad portrait, and iPad landscape checks.
- `cargo test --workspace`: 375 domain tests and 4 WASM tests passed.
- BMR Production source imports and built BMR assets contain no Issue #179 prototype dependency or
  review-control reference.

## Implementation sequence

1. Add focused failing tests for Setup choice, canonical progression, lifecycle isolation, direct entry,
   landing non-exposure, and prototype exclusion.
2. Add BMR-owned Setup/session/presentation types and adapters around the existing CoreAdapter,
   CanonicalSessionController, and web-session storage.
3. Add the BMR HTML, React entry, App, and Vite multi-page input without changing the landing scripts.
4. Connect the real 25-Character catalog, 7-15 distribution, Godfather options, Actual/Shown identity,
   names, and seating to `createGame`.
5. Reuse rectangular Grimoire and Player-detail presentation for editable assignment and confirmed
   read-only inspection.
6. Render canonical Evil Information, manual Character steps, phase transitions, and phase overview;
   keep Character-specific results and unsupported Day behavior absent.
7. Connect autosave/reload, new game, canonical Undo, BMR export/import, and cross-script rejection.
8. Apply the approved blood-moon Day/Night theme in BMR-owned CSS and verify the target viewports.
9. Run focused tests, all web tests, Production build, Rust workspace tests, and a separate
   invariant-to-evidence review.

## Non-goals

- Any BMR Character ability automation or new Character command/event
- Protection, ordered Death UI, Resurrection, Zombuul actual/apparent Death, ghost vote, Mastermind
  extra Day, or win-condition behavior
- Lunatic fake Demon Reveal or Character-specific private Reveal content
- Landing exposure or final Character/script/PWA assets
- Trouble Brewing or Sects & Violets product behavior changes

# Issue 10: Manual Tokens and Player Notes

## Status

Approved on 2026-07-17. Production implementation must pause after the development-only UI
prototype until the product interaction is approved.

## Approved Scope

Issue #10 adds manual display-only System Tokens, Trouble Brewing Script Tokens, and one free-text
Note per Player through the existing Command, Proposal, Confirmed Event, replay, persistence, and
Undo flow.

Character, alive/dead, and ghost-vote correction are excluded. Existing Undo is the MVP recovery
path for incorrectly confirmed rule actions. Manual tokens never change phase order, rule state,
ability resolution, voting eligibility, or win conditions.

Corrections remain unavailable after a confirmed game end. The Storyteller must Undo the game-end
event before editing annotations.

## Stable Contract

The UI sends one `correctPlayerAnnotations` Command for one Player. Its payload contains the Player
ID, expected event count, complete System Token ID list, complete Script Token reference list, and
complete Note. Rust validates and canonicalizes the draft, then returns one
`playerAnnotationsCorrected` Confirmed Event containing the complete resulting annotation state.

Replay applies annotation events in order. Removing the latest annotation event and replaying
restores the preceding annotations. Annotation events are phase-neutral and cannot advance, rewind,
or regenerate a phase step.

Rust rejects stale commands, unknown Players or token IDs, duplicate tokens, Notes longer than
1,000 characters, and no-op corrections. Schema version 2 remains current.

## Token Catalog

The initial manual System Token catalog is:

- drunk
- poisoned
- protected
- noAbility
- abilitySpent
- needsFollowUp

These tokens are visibly identified as manual. Existing Rust-derived Poison and Protection badges
remain automatic rule-state projections and are not overridden by manual tokens.

Trouble Brewing Script Tokens retain both source Character and reminder ID:

- butler: master
- drunk: isTheDrunk
- fortuneTeller: redHerring
- imp: dead
- investigator: minion, wrong
- librarian: outsider, wrong
- monk: safe
- poisoner: poisoned
- scarletWoman: isTheDemon
- slayer: noAbility
- undertaker: diedToday
- virgin: noAbility
- washerwoman: townsfolk, wrong

One Player cannot hold the same exact token twice. Different Players may hold the same token, and
the app does not enforce physical component counts or require the source Character to be in play.

## Prototype UI Contract

A development-only prototype must establish the interaction before production implementation:

- a long-press entry path on each confirmed Grimoire seat, without a separate edit icon;
- no collision with voting or current-step seat selection;
- one Player sheet/dialog with separate System Token, Script Token, and Note sections;
- explicit Cancel and `수정 확정` actions;
- disabled confirmation for an unchanged draft and during busy or protected Reveal state;
- compact automatic status badges attached to the left or right card edge, using semantic colors
  and no `자동` prefix, so they do not cover the Character label;
- Korean display labels for all Trouble Brewing Script Tokens;
- high-contrast, larger manual System and Script Tokens outside the Player card like physical
  Grimoire reminder tokens, with at most two labels plus an overflow count;
- up to two lines of Note content previewed along the bottom of the Player card;
- initial focus on the sheet itself after long-press so no token choice is focused accidentally;
- draft preservation on proposal failure and draft discard on Cancel.

The prototype must be reviewed before wiring production state.

## Test-First Implementation

1. Add black-box Rust tests for canonical Proposal creation, replay replacement, Undo restoration,
   phase and rule-state neutrality, and strict invalid/stale/no-op rejection. Confirm each new test
   fails for the intended missing behavior before production code changes.
2. Add strict WASM/TypeScript contract coverage for the new Command, Event, Player fields, and
   malformed imported events.
3. Add store behavior covering propose, canonical append, autosave, reload/import, failures without
   append, and generic live Undo.
4. Add production UI behavior for entry, editing, Cancel, Confirm, token overflow, Note indicator,
   voting interaction isolation, and Undo restoration.
5. Run `cargo test --workspace`, `pnpm --dir web test`, and `pnpm --dir web build`, then perform a
   correctness/regression review focused on phase neutrality, automatic-rule-state separation,
   replay/import, and missing coverage.

## Completion

After prototype approval and production completion, review the final diff, commit the branch, and
push `codex/issue-10`.

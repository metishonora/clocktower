# Issue 115: Sects & Violets session lifecycle

## Approved product contract

The user approved this contract on 2026-07-22. It replaces the issue's earlier requirement to
persist and undo exactly one Confirmed Event at a time.

### New game

- Reset role selection, seating, canonical progress, and transient presentation state.
- Replace the previous autosave with a fresh default baseline.
- Require destructive confirmation. Cancellation changes nothing.

### Return to seating

- Preserve the selected roster, seat assignments, Player names, and alignment presentation.
- Remove all canonical game progress and transient play state.
- Replace the previous autosave with the preserved-setup, no-progress baseline.
- Require destructive confirmation. Cancellation changes nothing.

### Session autosave

- Autosave exists to recover deliberate user input after refresh or route re-entry.
- Save after meaningful mutations such as a select/checkbox choice, a completed decision, a
  Player-name edit after debounce/blur, or a canonical status mutation.
- Do not save navigation-only clicks, modal/Reveal visibility, focus, scrolling, or a merely
  selected seat.
- Persist the active top-level page at the time of a meaningful mutation. Loading restores that
  page, but navigation without a later mutation does not itself update the saved page.
- Show only `자동 저장 중…`, `자동 저장 완료 HH:mm:ss`, or `자동 저장 실패`.
- A failed save is not retried automatically and has no extra warning copy. The next meaningful
  mutation attempts to save the latest session again.
- Autosave failure does not block in-memory play.

### Phase checkpoints and JSON

- A checkpoint is one completed character action or shared operational phase step, not a whole Day
  or Night.
- All canonical events produced by that action and its follow-ups belong to the same checkpoint.
- Setup confirmation is a baseline checkpoint and is not a generic live-play Undo target.
- Export includes the complete canonical history only through the latest completed checkpoint.
  In-progress input after it is excluded.
- Import performs parse, schema, script-identity, and complete replay validation before replacement
  confirmation. Only an approved valid candidate is installed and autosaved.
- Import restores the checkpoint's saved top-level page. Legacy S&V files without checkpoint
  metadata infer one checkpoint per existing event.

### Phase Undo

- Undo discards in-progress draft state and removes the latest completed post-setup checkpoint as a
  whole.
- Replay the complete remaining prefix, autosave it, and keep the same top-level page selected.
- The current action shown inside that page may move back as a result of replay.
- Confirmation identifies the checkpoint summary. Cancellation changes nothing.

## Ownership boundaries

- #115 owns the S&V session snapshot, restore, save feedback, JSON lifecycle, reset lifecycles, and
  phase-checkpoint Undo state/callback.
- #120 consumes the latest checkpoint summary and Undo callback when it adds the full event-log
  presentation.
- #116 supplies canonical phase/action completion boundaries for later Day and Night orchestration.
- Character issues add state-specific checkpoint replay regressions; #111 verifies combinations.

## Implementation direction

- Keep the approved S&V UI shell isolated from Trouble Brewing feature components.
- Reuse the script-aware IndexedDB and GameFile validation boundary.
- Persist a validated S&V session metadata block alongside the canonical GameFile. Rust continues to
  replay only canonical events.
- Track explicit checkpoint event counts so future multi-event character actions can be undone as
  one action without guessing from event types.
- Keep transient overlays and focus outside persisted data.
- Coalesce saves that are requested while a save is already running. After a failure, clear the
  queued attempt and wait for the next meaningful mutation.

## Test-first acceptance sequence

1. Meaningful setup input autosaves and reports a completion time; navigation alone does not save.
2. Reload restores setup draft and the top-level page captured by the latest meaningful mutation.
3. A failed save reports failure, does not retry by itself, and the next mutation saves the latest
   session.
4. Setup and phase completion append one checkpoint and autosave once without duplicate events.
5. Export trims in-progress data to the last completed checkpoint; valid import replays before
   replacement and restores its page.
6. Invalid import and replacement cancellation preserve memory and the last saved session.
7. New game and return-to-seating cancellation preserve state; confirmation writes the correct
   baseline.
8. Phase Undo cancellation preserves state; confirmation removes one checkpoint group, clears
   drafts, replays, autosaves, and keeps the selected page.
9. S&V and Trouble Brewing storage keys remain isolated.

## Verification

- Focused S&V lifecycle tests during implementation.
- `cargo test --workspace`.
- `pnpm --dir web test`.
- `pnpm --dir web build`.
- Additional review for save races, stale snapshot installation, checkpoint boundaries, invalid
  import preservation, and unintended Trouble Brewing changes.

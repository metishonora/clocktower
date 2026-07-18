# Issue 43: Latest Live-Play Undo

## Status and approved product decisions

This plan is ready for handoff, but production implementation is still gated by the issue's
development-only prototype review. The next worker must not start production changes until the
user has seen the placement comparison and explicitly approved the final placement and wording.

The user approved these requirements on 2026-07-16:

- Initial setup recovery is needed only before post-setup play begins. Once a post-setup event
  exists, `설정 다시 수정` is not offered; `새 설정` remains the way to abandon a game and start
  over.
- Generic live-play Undo is hidden when `setupConfirmed` is the only Confirmed Event.
- When a post-setup event exists but a command or replay transition is busy, the Undo action remains
  visible and is disabled.
- Live-play Undo uses an in-app protected confirmation dialog rather than `window.confirm`.
- Confirmed Undo clears all unconfirmed workflow state: proposal feedback, current-step selections,
  nomination/vote drafts, and pending or active Reveal presentation tied to the removed event.
- Cancelling the dialog changes no event, replayed state, persistence, or transient draft.

The initial prototype wording is:

- action: `최근 행동 되돌리기`;
- dialog title: `최근 확정 행동을 되돌릴까요?`;
- target line: `되돌릴 항목: {latestEvent.summary}`;
- actions: `취소` and `되돌리기`.

This wording is a prototype candidate, not final production approval. The final placement and exact
copy must be confirmed after the prototype is reviewed.

## Current baseline and scope

The current web store exposes one `undoLatestEvent` action. It lives in `ConfirmedSetup`, uses the
setup-specific confirmation `설정 확정을 되돌리고 다시 수정할까요?`, and removes whichever event
is latest. That implementation already clears `proposalResult` and `pendingConfirmedReveal`, while
the app clears an active Reveal when the pending Reveal disappears. The public intent and
eligibility are nevertheless incorrect because setup recovery and live-play Undo share the same
action.

Issue 43 is a TypeScript/web workflow change. No Rust domain event, schema version, compensating
event, Redo state, or arbitrary historical-event selection is added. A successful Undo removes one
existing suffix event from the GameFile, replays the remaining log, and autosaves that resulting
GameFile.

## Stable behavioral contract

### Live-play Undo

- The removable event is exactly the current last Confirmed Event when its type is not
  `setupConfirmed`.
- The UI obtains both the event ID and its existing human-readable `summary`; it does not recreate
  a summary from event payload fields.
- The action is rendered in normal live play and in the confirmed Reveal follow-up pane whenever a
  removable event exists.
- The action is hidden if there is no event or if `setupConfirmed` is the only event.
- The rendered action is disabled while a command is busy or replay has not caught up to the
  current GameFile event count.
- Opening the dialog changes nothing. Cancelling it only closes the dialog.
- Confirming rechecks that the displayed event is still the current removable event. It must never
  remove a newer event than the one named in the dialog.
- A successful confirmation removes exactly that one event, updates `updatedAt`, replays the
  remaining GameFile, and lets the existing persistence path autosave it.
- Undo appends no event and records no separate audit entry; the removed event disappears from the
  event log.
- While the removal/replay transition is unresolved, another Undo cannot start.
- If the event is no longer eligible when confirmation is attempted, leave the GameFile unchanged,
  close or invalidate the stale dialog, and surface compact failure feedback rather than removing a
  different event.

The store-facing public seam should keep display eligibility separate from command eligibility so
the UI can show a disabled action during transitions. The intended shape is equivalent to:

```ts
latestLiveUndoEvent?: Pick<GameEvent, "id" | "summary">;
canUndoLatestLiveEvent: boolean;
undoLatestLiveEvent(expectedEventId: string): void;
```

Names may follow existing project conventions, but the event-ID guard and separate visible/disabled
signals are part of the contract.

### Initial setup recovery

- Setup recovery remains a separately named setup action, `설정 다시 수정`, with setup-specific
  confirmation copy.
- It is offered only when the sole event is `setupConfirmed` and replay is ready.
- Confirming removes that setup event, seeds editable Draft Input from the confirmed Players, clears
  transient UI, replays the empty GameFile, and autosaves it through the existing path.
- Once any post-setup event exists, setup recovery is hidden. It never removes a live-play event and
  never discards the whole live event log.
- After repeated live Undo reaches the setup-only state, generic Undo disappears and setup recovery
  becomes available again.

The production store must expose separate public actions and eligibility checks for live Undo and
setup recovery. They may share a small private suffix-removal helper, but confirmation copy,
eligibility, UI cleanup, and caller intent must remain explicit.

### Transient UI cleanup

Confirmed live Undo clears all state derived from or drafted against the removed event's successor
context:

- `proposalResult`, including success, warning, and error presentation;
- `pendingConfirmedReveal` and any full-screen `activeRevealPayload` associated with it;
- phase input selections and suggestion state;
- nomination and vote draft state, including cases where replay returns to a step with the same
  step ID;
- any app-owned public-action dialog/draft introduced on current `main`.

Feature components must not reach into the store. Use an app-wired reset signal or explicit feature
callbacks so feature-owned draft lifecycle stays in its owning hook/component. Do not rely only on a
changed step ID: removing an event can replay to the same Discussion step ID, so event-log revision
must also invalidate drafts.

Closing the Undo confirmation without confirming does not fire this reset path.

## Prototype decision gate

Create an isolated development-only prototype following the existing prototype routing and notes
conventions. It must not import production feature components as dependencies, mutate the real game
store, call persistence, or become production code.

The prototype must compare at least:

1. **Variant A — current-action placement:** a persistent `최근 행동 되돌리기` action attached to
   the phase/current-action surface.
2. **Variant B — latest-event placement:** the same action attached to the latest-event/event-log
   surface, with the newest summary visually associated with it.

For both variants provide controls or scenarios for:

- normal live play with a post-setup latest event;
- a pending confirmed Reveal follow-up where next-step input is hidden;
- opening the protected dialog and seeing the exact latest event summary;
- cancelling without visible state change;
- confirming in a mocked interaction so the latest item disappears and the UI returns to its prior
  replayed state;
- the setup-only state, where generic Undo is absent;
- a busy/replaying state, where an otherwise eligible Undo remains visible but disabled.

Keep the live-play surface concise. Do not add explanatory paragraphs to production candidates; the
prototype may use a clearly separated development banner and scenario switcher.

Suggested prototype files:

- `web/src/livePlayUndoPrototype.tsx`;
- `web/src/livePlayUndoPrototype.css`;
- `web/src/livePlayUndoPrototype.NOTES.md`;
- `web/test/livePlayUndoPrototype.test.tsx`;
- a development route such as `?prototype=live-play-undo` and a matching package script.

Prototype tests should verify both placements, both required live states, summary-bearing dialog
copy, cancellation, mocked confirmation, setup-only absence, and busy disabled behavior.

Stop after the prototype is available. Give the user its URL and a concise comparison, then obtain
explicit approval of:

- Variant A, Variant B, or a specific requested refinement;
- action label;
- dialog title, target formatting, and confirm/cancel labels.

Record that decision in this plan before production test or implementation delegation begins.

## Sequential test-first production handoff

After prototype approval, Sol freezes the final UI wording/placement and performs the required
sequential handoff in the dedicated issue worktree.

1. Give `luna_logic_worker` only the approved requirements, stable behavioral contract above,
   existing public interfaces, and test conventions. Do not send the production change map below
   and do not permit production-source edits.
2. The test worker adds the smallest black-box workflow/regression coverage at stable React/store
   seams and demonstrates failures caused by the old setup-only Undo behavior. Harness,
   environment, or unrelated failures do not satisfy the gate.
3. Sol reviews the test diff, personally reruns the focused cases, and verifies the failure is for
   the intended missing behavior. Freeze those tests before implementation.
4. Only then assign a separate `luna_worker` to production implementation. The implementer may add
   coupled unit tests but must not weaken, delete, or rewrite the approved behavioral tests without
   Sol approval.
5. Test and implementation workers operate sequentially in the same issue worktree. Do not run
   behavioral-test writing and production-source changes in parallel.

Required black-box coverage:

- normal live-play discoverability and latest-summary confirmation;
- cancellation preserving events, replayed state, autosave history, Reveal state, and drafts;
- confirmation removing exactly one latest event, calling replay, updating the event log/current
  state, and autosaving the reduced GameFile;
- two consecutive Undos each removing only one event;
- generic Undo hidden with setup-only and setup recovery available there;
- setup recovery hidden after the first post-setup event and never acting as generic Undo;
- eligible Undo disabled during a command and during a replay/event-count mismatch;
- pending-Reveal Undo remaining discoverable and clearing the pending follow-up;
- active Reveal state being cleared when its source event is removed;
- proposal feedback, phase selections, suggestion state, nomination/vote drafts, and same-step-ID
  drafts being reset only after confirmed Undo;
- a stale dialog/event-ID guard refusing to remove a different latest event.

Prefer one high-level production workflow test for the visible contract plus focused store/hook tests
for transition and reset edge cases. Do not assert private helper structure or CSS implementation.

## Production change map

Use this section only after the failing behavioral test has been approved.

### Store and transition ownership

- In `web/src/gameStore.ts`, replace the public catch-all `undoLatestEvent` with explicit live Undo
  and setup-recovery actions and their independent eligibility projections.
- Derive replay readiness by comparing the successful replay state's event count with the current
  GameFile event count, in addition to the existing command `busy` flag.
- Recheck expected event ID and event type inside the live Undo action before slicing.
- Keep removal immutable, change only the one-event suffix and `updatedAt`, and reuse the existing
  GameFile replay/autosave pipeline. Do not call `propose` and do not create a compensating event.
- Clear store-owned transient state only on confirmed, eligible removal.
- Preserve compact load/replay error reporting and prevent overlapping removal transitions.

### App and feature ownership

- In `web/src/main.tsx`, compose the approved live Undo surface, its dialog state, active Reveal
  cleanup, and the feature-draft reset signal through narrow props.
- Add a feature-owned production component for the approved Undo action/dialog if the selected
  placement is shared by normal phase and pending-Reveal composition. The component receives only
  the target summary/ID, disabled state, and callbacks; it must not import the store.
- If Variant A is approved, `PhaseControl` renders the same narrow Undo action in both
  `CurrentStepPane` and `ConfirmedRevealFollowup` without duplicating behavior.
- If Variant B is approved, `EventLog` owns the latest-event presentation/action while `main.tsx`
  retains dialog/store orchestration; ensure the collapsed log still leaves Undo discoverable.
- Rename `ConfirmedSetup` props from generic Undo semantics to setup-recovery semantics and hide
  that action once a post-setup event exists.
- Extend feature draft lifecycle only as needed to accept the app-owned event-log reset revision.
  Keep nomination, phase-input, voting, and public-action drafts in their existing owner modules.
- Add accessible dialog behavior: initial focus on the safe cancel action, focus containment, Escape
  as cancel, backdrop/close behavior consistent with project dialogs, and focus restoration to the
  Undo trigger.
- Add only the CSS required for the approved iPad-first placement, destructive emphasis, disabled
  state, and dialog. Do not add generic explanatory copy or a UI library.

Likely production files, subject to the approved variant:

- `web/src/gameStore.ts` and `web/src/gameStore.test.ts`;
- `web/src/main.tsx`;
- `web/src/features/setup/ConfirmedSetup.tsx`;
- `web/src/features/phase-control/PhaseControl.tsx` or
  `web/src/features/event-log/EventLog.tsx`;
- a small feature-owned Undo dialog/action component;
- `web/src/features/voting/useNominationDraft.ts` or another existing draft owner if a reset seam is
  required;
- `web/src/styles.css`;
- `web/test/clocktowerApp.integration.test.tsx` and focused component tests.

No Rust, Wasm contract, GameEvent schema, or storage schema change is expected.

## Worktree, verification, and completion

The next worker should begin from the latest remote `main`. The current primary checkout was
observed to be locally divergent (`main` ahead by one commit and behind by two), so it must not
discard or overwrite that local commit. Resolve or escalate the divergence, pull the latest `main`
as project guidance requires, then create a dedicated issue worktree and `codex/issue-43` branch.

After prototype work:

- run the prototype-focused test and `pnpm --dir web build`;
- run the dev server bound to `0.0.0.0` and inspect both variants at a 1366 x 1024 iPad landscape
  viewport plus a usable narrow/portrait layout;
- stop for user approval and update the plan with the selected placement and final wording.

After production implementation:

- run focused accepted regression tests first;
- run `pnpm --dir web test`;
- run `pnpm --dir web build`;
- validate normal, pending-Reveal, setup-only, busy, cancel, repeated Undo, and setup-recovery paths
  in the local app with the server bound to `0.0.0.0`;
- review the full diff for accidental setup/live intent merging, removal of more than one event,
  missing stale-ID guards, replay/autosave races, retained transient drafts, Reveal leakage, and
  unnecessary live-play copy;
- commit the finished approved work and push `codex/issue-43` unless blocked;
- report the prototype decision, regression coverage, tests/build results, commit, pushed branch,
  and any blocked checklist item.

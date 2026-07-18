# Issue 51: Current-Day Elapsed Runtime

## Status

Requirements and implementation plan approved by the user on 2026-07-16. Production UI remains
gated on approval of a development-only prototype at the target iPad viewport.

Issue #51 was updated to clarify that this is a transient live-session timer. Elapsed runtime is
not historical game data and is not reconstructed across app sessions.

## Approved Requirement Decisions

- The primary device is an iPad Pro 12.9-inch (5th generation) in landscape, using a 1366 x 1024
  CSS viewport for prototype and production validation.
- Placement and compact formatting must be approved through a prototype before production work.
- The default display omits an hour field and uses `MM:SS`.
- The timer is scoped to the current app session. Loading, importing, refreshing, or reopening a
  game that is already in Day starts a new timer at `00:00`.
- Confirming the canonical Night-to-Day transition during the active session starts the timer at
  `00:00`.
- The timer continues across Whisper, Discussion, Nomination/Voting, Execution, and Storyteller
  follow-up surfaces in the same Day.
- Background time is included while the same app session survives; returning to the foreground
  must catch the display up to wall-clock time.
- Setup and Night do not show a Day timer. The full-screen player Reveal also hides it, while the
  underlying same-session timer continues.
- The feature has no countdown target, controls, alarm, sound, notification, subphase history, or
  analytics.
- Timer ticks must not create Commands or Confirmed Events, trigger replay, or write browser
  storage.

## Transient Time Contract

The timer is UI-only state and must not be added to any persisted or canonical domain contract.

- Do not derive the start from `GameEvent.createdAt`.
- Do not add or repair event timestamps for this feature.
- Do not persist a Day-start timestamp or elapsed value in IndexedDB or exported JSON.
- Do not change the Rust domain, WASM JSON boundary, `GameFile`, Confirmed Event, or `ReplayState`
  schema.
- Existing and imported games do not require timestamp migration or recovery.

The start rules are:

1. When replay first exposes Day during an app session, record the injected clock's current value
   as that session's Day start and display `00:00`.
2. A current-step or subphase change while replay remains in the same Day keeps the existing start.
3. Entering Setup or Night clears the active Day start and hides the display.
4. A later transition back into Day records a new start and displays `00:00`.
5. Replacing the loaded game through a successful import creates a new transient game-session
   revision. If the imported replay is already in Day, it receives a fresh start even when the
   previously displayed game was also in Day.
6. A page refresh or app reopen naturally creates a new React session and therefore a new Day
   start when the loaded replay exposes Day.

Elapsed display is always calculated from `clock.now() - dayStartedAt`. Interval callbacks only
request a re-render; they are not the source of elapsed time. This makes Safari timer throttling in
the background harmless. A foreground visibility event requests an immediate refresh rather than
waiting for the next interval callback.

## Prototype Decision Gate

Create an isolated development-only prototype, available through a dedicated query parameter, and
bind its local server to `0.0.0.0`.

At 1366 x 1024, compare:

1. a distinct `낮 경과 12:34` value at the right side of the phase-panel header while retaining the
   existing input-kind badge; and
2. a compact inline runtime beneath the phase/step title.

The prototype must show representative values `00:00`, `05:07`, `42:17`, and `60:00`, plus the
following workflow surfaces:

- Whisper;
- Discussion;
- Nomination/Voting;
- Execution;
- confirmed Storyteller follow-up;
- Night and Setup without a stale timer; and
- full-screen Reveal without the timer.

The baseline format is `MM:SS` with at least two minute digits. Minutes continue beyond 59, so one
hour is `60:00` rather than introducing an hour column. The prototype review may change placement
or this overflow presentation, but production implementation must not begin until the user
approves the final visual contract.

## Stable Web Contract

Keep the elapsed-time primitive narrow and injectable:

```ts
type DayRuntimeClock = {
  now: () => number;
};
```

Production uses a browser clock backed by `Date.now`. Tests supply a mutable deterministic clock.
The interval scheduler can use the existing browser APIs and test fake timers; elapsed time must
still come only from the injected clock.

The phase-control surface receives already-derived display state. It must not inspect events,
timestamps, storage, or the game store to decide when a Day began.

## Web Production Change Map

- `web/src/gameStore.ts`
  - expose the current replay phase to app composition;
  - maintain only a transient game-session revision for successful whole-game replacement/import;
  - do not store a runtime value or timestamp and do not change autosave data.
- `web/src/main.tsx`
  - own the runtime hook above the full-screen Reveal return path so Reveal can hide the display
    without unmounting or restarting the timer;
  - inject the production clock by default and allow tests to pass a deterministic clock;
  - pass narrow runtime display data into phase control.
- `web/src/features/phase-control/dayRuntime.ts`
  - own the pure `MM:SS` formatter, clock type, and elapsed-time clamping rules.
- `web/src/features/phase-control/useDayRuntime.ts`
  - own session start/clear/reset behavior, the one-second render interval, and immediate
    `visibilitychange` refresh;
  - preserve the start across current-step changes within the same Day.
- `web/src/features/phase-control/PhaseControl.tsx`
  - render the approved compact value in both the normal current-step pane and confirmed
    Storyteller follow-up;
  - omit it from Setup, Night, and player-facing Reveal.
- `web/src/styles.css`
  - apply the approved fixed-width, compact treatment without adding explanatory live-play copy;
  - verify that the existing phase title and input-kind badge remain scannable at 1366 x 1024.
- development prototype files and `web/src/main.tsx`
  - add the isolated prototype route and representative state controls without making prototype
    components production dependencies.

File names may be combined if the implementation remains clearer, but the ownership boundaries
above must remain: the store signals game replacement, app composition owns timer lifetime, and
phase control only renders UI state.

## Test-First Development

Use one continuous work stream; do not split testing and implementation across agents or perform a
sequential worker handoff.

After prototype approval:

1. Freeze the approved visual contract and the transient time rules in this plan.
2. Write the smallest black-box web integration or regression test at the existing
   `ClocktowerApp` seam before editing production code.
3. Run the new test alone and confirm it fails because the runtime behavior is missing. Harness,
   environment, or unrelated failures do not satisfy this gate.
4. Implement the smallest production change that makes the approved test pass without weakening,
   deleting, or rewriting it.
5. If the behavioral test is incorrect, explain the requirement or test error before changing it.
6. Refactor only after the behavioral test passes, then add implementation-coupled unit coverage
   where it reduces ambiguity.

Required behavioral coverage:

- an already-Day stored game begins at `00:00` for the new app session;
- an active-session transition into Day begins at `00:00`;
- injected clock advancement updates the visible `MM:SS` value;
- Whisper-to-Discussion and other same-Day step changes do not reset the start;
- time advanced while backgrounded appears immediately after foregrounding;
- full-screen Reveal hides the runtime and returning preserves elapsed time;
- Setup and Night hide and clear the runtime;
- the next Day starts again at `00:00`;
- successful import into an already-Day game starts a fresh timer;
- timer ticks do not increase core replay/propose calls, saved-game writes, or confirmed-event
  count; and
- formatting covers `00:00`, ordinary minutes, seconds padding, and minutes beyond 59.

Use an injected mutable clock and controlled fake timers. Tests must not wait for real seconds or
depend on wall-clock timing.

## Worktree and Branch Preparation

Before prototype code work:

1. preserve the current local `main` commit `19dc330` while updating it with the latest remote
   `main` through a rebase pull;
2. create a dedicated issue worktree and `codex/issue-51` branch from the clean latest
   `origin/main`; and
3. keep all prototype, test, and production changes in that issue worktree.

Do not reset or discard the local-only `main` commit. Stop and report any rebase or unrelated
worktree conflict rather than resolving it destructively.

## Verification and Completion

After the prototype is approved and production implementation is complete:

- run the new behavioral test directly;
- run `pnpm --dir web test`;
- run `pnpm --dir web build`;
- run `git diff --check`;
- bind local visual validation to `0.0.0.0` and inspect the 1366 x 1024 landscape viewport;
- exercise Day entry, each Day subphase, same-session background/foreground, full-screen Reveal,
  Night hiding, next-Day reset, stored-game startup, and JSON import;
- review the diff for accidental event timestamp work, persistence/schema changes, replay or
  autosave activity on ticks, timer reset during Reveal, stale Night display, timing-dependent
  tests, and unnecessary explanatory copy;
- commit the finished work and push `codex/issue-51`; and
- report the prototype decision, regression coverage, verification commands, final commit, pushed
  branch, and any blocked checklist item.

No Rust files are expected to change. If implementation reveals that a Rust or WASM contract
change is necessary, stop and obtain user approval because that would contradict the approved
transient UI-only scope.

# Issue 82: Unsupported Autosave Recovery

## Status and approved product decisions

Implemented on `codex/issue-82` on 2026-07-19. The focused Clocktower app integration tests,
`pnpm --dir web test`, and `pnpm --dir web build` pass with the behavior below.

The user approved the following product decisions on 2026-07-19:

- Keep the existing initial-setup UI, `새 게임` label, and `JSON 가져오기` action.
- Do not add recovery-specific explanatory copy, a new recovery button, or another confirmation
  dialog.
- Clicking the existing `새 게임` button is the user's explicit choice to replace an incompatible
  autosave. That click clears the recovery error and writes a current-schema new game.
- An incompatible autosave cannot be inspected as a valid `GameFile`, so it does not contribute to
  `hasConfirmedEvents`. The existing confirmed-event replacement confirmation therefore does not
  appear for this recovery-only case. This is intentional.
- While incompatible autosave recovery is pending, the setup draft remains editable, but
  `설정 확정` must not be allowed to bypass the explicit `새 게임` or successful JSON-import
  recovery choice.
- A user-selected incompatible JSON file reports a file error without replacing the current valid
  game or event log.

No UI prototype is required because placement, labels, and interaction surfaces remain unchanged.

## Problem and current behavior

`IndexedDbGameStorageDriver.loadLatestGame` reads the single `latest` value and validates it before
returning a typed `GameFile`. A value whose root `schemaVersion` is not `2` throws
`지원하지 않는 게임 파일 버전입니다.` before the store receives a game.

`useGameStore` currently records both initial-load failures and autosave-write failures in the same
`storageError` state. The autosave effect is disabled whenever that state is present. This provides
partial protection: the initial in-memory empty game does not immediately overwrite the invalid
stored value, and clicking `새 게임` clears the error and causes a schema-version-2 empty game to
be saved.

The incomplete path is setup confirmation. The setup surface becomes editable after the failed
load, but confirming a completed draft appends the setup event without clearing `storageError`.
Autosave remains disabled, the unsupported-version error remains visible, and the newly confirmed
game is not persisted.

The import workflow has a separate ordering problem. It asks for current-game replacement
confirmation before parsing and replay-validating the selected JSON. An incompatible file can
therefore show a destructive confirmation before its file error, and cancelling that confirmation
prevents the actual file error from being reported.

## Scope

This is a TypeScript/web persistence workflow change. It does not add schema migration, preserve a
backup copy, expose raw IndexedDB data for download, or change Rust replay/domain contracts.

In scope:

- distinguish an unresolved initial autosave recovery condition from an autosave write failure;
- keep the setup draft editable while preventing setup confirmation from bypassing recovery;
- resolve recovery through the existing `새 게임` action or a successfully validated import;
- validate explicit imports before asking whether to replace a valid current game;
- add initial IndexedDB and explicit-import regression coverage;
- preserve the existing normal current-version and empty-storage behavior.

Out of scope:

- schema-version migration or partial event-log recovery;
- automatic deletion, automatic overwrite, or automatic backup of incompatible data;
- saved-game lists or recovery-file export;
- new user-facing wording, buttons, dialogs, or notification layouts;
- changes to the database name, object-store name, key, or IndexedDB database version.

## Stable behavioral contract

### Initial autosave load

- Empty storage behaves exactly as today: setup opens normally and the current schema-version-2
  empty game may be autosaved through the existing path.
- A valid schema-version-2 stored game is fully validated, replayed, loaded, and autosaved exactly
  as today.
- An incompatible or replay-invalid stored game is rejected as a whole. No event prefix is loaded.
- Until the user makes a recovery choice, the raw stored value is neither deleted nor overwritten.
- The existing Korean error remains visible through the current `Status`/event-log feedback.
- Player-count controls, seat selection, names, character assignments, layout editing, and JSON
  import remain usable.
- `설정 확정` is disabled while autosave recovery is unresolved, even when the draft itself is
  complete. The store command must also guard this condition so a non-UI caller cannot bypass it.
- Do not reuse the general `busy` flag to block recovery: doing so would disable the whole setup
  form and violate the editable-setup requirement.

### Existing `새 게임` recovery

- Clicking `새 게임` while recovery is pending does not show an additional confirmation dialog.
  The button click itself is the explicit replacement choice.
- The action clears the recovery condition and visible load error, clears transient proposal and
  Reveal state as it already does, creates a fresh schema-version-2 `GameFile`, and allows the
  existing autosave effect to persist it.
- The prior incompatible value remains intact until this click. After the click and successful
  save, the `latest` key contains the new current-version game.
- The existing replacement confirmation remains unchanged when an actually loaded current game has
  confirmed events. Recovery-only state must not pretend that the rejected file supplied typed
  confirmed events.
- A save failure after the recovery choice is an autosave write error, not a return to the original
  incompatible-autosave recovery state.

### Explicit JSON import

Use this order for a selected file:

1. Parse and structurally validate the complete JSON, including `schemaVersion`.
2. Replay-validate the complete candidate `GameFile`.
3. If and only if the candidate is valid and the current in-memory game has confirmed events, ask
   whether to replace the current game.
4. On approval, atomically install the candidate in store state, clear any initial autosave
   recovery condition, and let it autosave.

Failure and cancellation behavior:

- Parse, schema, event validation, or replay failure reports only the candidate-file error.
- An invalid candidate never opens the replacement confirmation.
- Invalid import preserves the current `gameFile`, replay result, confirmed event log, stored latest
  game, setup draft derived from the current game, and session revision.
- Cancelling replacement of a valid candidate preserves the same state and performs no autosave.
- A valid import while initial autosave recovery is pending is an explicit recovery choice. It
  clears the recovery condition and replaces the incompatible stored value only after full
  validation succeeds.

## Store state and public seam

Represent initial recovery separately from write errors. Exact names may follow local conventions,
but the store needs the equivalent of:

```ts
autosaveRecoveryError?: string;
storageWriteError?: string;
autosaveRecoveryRequired: boolean;
canConfirmSetup: boolean;
```

Required invariants:

- the autosave effect is gated by unresolved initial recovery, not by unrelated transient file
  import feedback;
- clearing a write error does not implicitly approve replacement of an incompatible stored value;
- `resetSetup` explicitly resolves initial recovery;
- successful import explicitly resolves initial recovery;
- failed import does not resolve it;
- `confirmSetup` returns without proposing or mutating the `GameFile` while recovery is required;
- displayed error priority remains deterministic when file-import feedback and storage feedback
  coexist.

The app should pass a narrow setup-confirmation eligibility value to `SetupForm`. Do not let the
feature component import the store or infer persistence state from error-message text.

## Test-first implementation sequence

### 1. Initial IndexedDB regression

Add the smallest integration test that uses `IndexedDbGameStorageDriver` with an isolated test
`IDBFactory`. Seed the production database/object-store/key boundary with a raw game whose
`schemaVersion` is `1` before rendering `ClocktowerApp`.

If the existing test environment does not provide IndexedDB, add `fake-indexeddb` as a test-only
development dependency rather than weakening the test to a driver that merely throws a prepared
error. Give each test its own `IDBFactory` so database cleanup and cross-test ordering are not
global concerns.

The test must first fail against current production behavior for the intended missing contract and
prove all of the following:

- the unsupported-version error is shown;
- setup editing controls remain enabled;
- a completed draft cannot invoke `core.propose` through `설정 확정` before recovery;
- the raw schema-version-1 value is still stored before recovery;
- clicking the existing `새 게임` action shows no new confirmation;
- the error disappears and the `latest` value becomes a schema-version-2 game with an empty event
  log after autosave completes.

Do not replace the existing invalid-replay-log test; it covers the distinct path where storage
validation succeeds and Rust replay rejects the complete log.

### 2. Explicit incompatible-import regression

Starting from a valid loaded game with confirmed events, upload a JSON file whose root
`schemaVersion` is unsupported. The test must first fail because current production asks for
replacement confirmation before validation.

Assert that:

- the unsupported-version error is displayed;
- `window.confirm` is not called;
- the original event log remains visible and unchanged;
- the original `GameFile` remains the latest stored value;
- the invalid candidate is not passed to replay and no autosave is triggered by the failure.

Keep the existing successful-import test to ensure a valid candidate still asks for replacement
confirmation when confirmed events exist and installs only after approval.

### 3. Production change

After both regression tests fail for their intended behavioral reasons:

1. Split initial autosave recovery state from autosave write-error state in `useGameStore`.
2. Expose a narrow recovery/confirmation eligibility value to the setup surface.
3. Disable only `설정 확정` during recovery and add the matching store-level guard.
4. Make the existing `resetSetup` resolve recovery without adding copy or a dialog.
5. Reorder import into validate, replay, confirm, then install.
6. Clear recovery only on successful new-game or import replacement.
7. Refactor only after the focused tests pass.

Likely production files:

- `web/src/gameStore.ts`;
- `web/src/main.tsx`;
- `web/src/features/setup/SetupForm.tsx`.

Likely test/support files:

- `web/test/clocktowerApp.integration.test.tsx`;
- `web/test/clocktowerAppHarness.ts` if a narrow helper is useful;
- `web/package.json` and the workspace lockfile only if `fake-indexeddb` is required.

`web/src/gameStorage.ts` should change only if a typed storage-load result or testable validation
boundary is necessary. Do not weaken `validateGameFile` or accept schema version 1.

## Verification and review

Run in this order:

1. the focused initial-autosave and incompatible-import regression tests;
2. `pnpm --dir web test`;
3. `pnpm --dir web build`.

Then review the diff specifically for:

- any render/effect race that could autosave the initial empty in-memory game before recovery is
  established;
- accidentally clearing recovery on failed or cancelled import;
- asking for replacement confirmation before complete candidate validation;
- disabling the full setup form instead of only confirmation;
- overwriting the old raw value before the existing `새 게임` click or successful import;
- changing normal empty-storage/current-version autosave behavior;
- duplicate saves or stale error priority after recovery;
- tests that mock away the IndexedDB validation boundary named in the issue.

Because this change crosses initial load, autosave, import, and setup confirmation, perform the
additional correctness/regression review required for a cross-cutting workflow before committing.

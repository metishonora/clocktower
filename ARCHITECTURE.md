# Clocktower System Architecture

## Purpose

This document records system-level design decisions for the Clocktower Storyteller app.

Requirements stay in `CONTEXT.md`. UX and visual design direction stay in `DESIGN_BRIEF.md`.

## Architecture Shape

Use a static iPad-first PWA with a Rust domain core compiled to WebAssembly and a TypeScript UI.

- TypeScript owns UI, draft input, reveal mode, browser storage, export/import, and PWA shell.
- Rust owns canonical domain behavior: commands, event validation, confirmed event creation, replay, derived state, warnings, and step generation.
- IndexedDB stores confirmed events as the source of truth.
- Current game state is rebuilt by replaying confirmed events.

Build and deploy as static files over HTTPS.

```text
Rust WebAssembly build -> web asset
Vite build -> static dist
HTTPS host -> iPad Safari -> Add to Home Screen
```

Do not require a localhost server during play.

## Rust and TypeScript Boundary

Keep the WebAssembly boundary small and JSON-based for MVP.

```ts
core.propose(gameFileJson, commandJson) -> proposalJson
core.replay(gameFileJson) -> stateJson
core.setupDistribution(requestJson) -> distributionJson
```

`propose` checks the schema version, validates a Storyteller command against the current event log, and returns a proposal containing the canonical event, warnings, computed result, and follow-up step hints when relevant.

`replay` checks the schema version and rebuilds the current rules state, visible step overview, and warnings from confirmed events.

`setupDistribution` is a read-only setup draft query. It owns Trouble Brewing setup distribution rules, including Baron adjustment, before the setup draft is complete enough to become a `createGame` command. Its draft input is limited to player count and assigned Actual Character IDs; Rust derives all rule effects from that input. Keep this API limited to deterministic setup guidance that has no confirmed event.

Keep the Rust WebAssembly API stateless for MVP. Calls that depend on confirmed game state receive the current `GameFile`; setup draft queries receive only their draft input.

If repeated replay becomes slow on real iPad hardware, add a stateful Rust session API as a measured optimization.

## Core API Errors

WebAssembly calls should return JSON result objects instead of throwing for expected failures.

```ts
type CoreResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: CoreError };

type CoreError = {
  code: string;
  messageKo: string;
};
```

Use `CoreError` for invalid commands, unsupported schema versions, malformed input, and replay failures.

Reserve panics or thrown exceptions for bugs and unrecoverable adapter failures.

## Rust Core Structure

Keep domain logic independent from WebAssembly glue.

```text
TypeScript UI
  -> WebAssembly adapter: JSON in/out
    -> Rust domain core: commands, events, replay, rules, steps
```

The Rust domain core should be testable without a browser or WebAssembly runtime.

The WebAssembly adapter should only translate JSON requests/responses and map errors into UI-readable results.

Use this repository shape when implementation starts:

```text
crates/domain
crates/wasm
web
```

- `crates/domain`: pure Rust domain logic.
- `crates/wasm`: WebAssembly adapter for JSON in/out.
- `web`: React/Vite PWA.

## TypeScript App Structure

Keep the TypeScript side thin and UI-focused.

Use React with Vite for the PWA frontend. Use plain CSS or scoped CSS files; do not add a UI component library for MVP.

```text
app shell
game store
wasm client
screens/components
```

- The app shell owns PWA startup, routing, install/offline behavior, and global layout.
- The game store owns loaded event logs, draft UI state, current replay result, autosave status, undo, import, and export.
- The wasm client owns calls to `propose` and `replay`.
- Screens and components own rendering, input collection, selection state, and reveal mode presentation.

Screens should not create canonical events directly. They should send Storyteller commands through the game store to the Rust core.

Do not add a routing library for MVP. Use app screen state for setup, play, reveal, import, and export surfaces.

Add routing only if URL-addressable screens become useful.

## Step Data

Rust replay returns semantic step data for the current phase.

```ts
type CurrentStep = {
  id: string;
  phase: "firstNight" | "day" | "night";
  kind: string;
  actorId?: string;
  requiredInput: InputSpec[];
  canSkip: boolean;
};

type PhaseOverviewItem = {
  id: string;
  kind: string;
  actorId?: string;
  status: "waiting" | "current" | "complete" | "skipped" | "needsFollowUp";
};
```

TypeScript maps semantic step data to Korean labels and instructions.

Do not persist generated step lists. Replay should derive `currentStep` and `phaseOverview` from confirmed events.

## Messages and Warnings

Rust may return short Korean messages for MVP.

Use this for:

- confirmed event summaries
- compact warning messages
- compact proposal messages

Avoid putting layout-specific long copy in Rust. If the same rule result needs different wording for a banner, reveal screen, and log row, TypeScript should own those screen-specific strings.

Rust warnings should still include stable codes and severity so the UI can style and filter them without parsing Korean text.

## Reveal Data

Reveal screens must render from a narrow reveal payload, not from the full game state.

```ts
type RevealPayload = {
  kind: string;
  targetPlayerIds?: string[];
  characterIds?: string[];
  value?: string | number | boolean;
  messageKo?: string;
};
```

Rust proposals may include reveal payloads for player-facing information.

TypeScript should pass only the reveal payload into reveal mode. Do not pass the full grimoire state, event log, or derived rules state into the reveal screen.

For MVP, keep one app store with the full replay result, but isolate `RevealScreen` by props. `RevealScreen` should receive only `RevealPayload` and close/return callbacks.

Do not split public and secret stores for MVP. Add that only if reveal code becomes hard to audit.

## Confirmed Events

Rust creates canonical confirmed events. TypeScript only stores confirmed events returned by Rust.

TypeScript may keep draft UI state, such as selected seats, vote toggles, preview state, and open panels. Draft state is not persisted.

Use a command/proposal/event flow.

```text
UI draft
  -> Storyteller command
  -> Rust propose
  -> Proposal
  -> Storyteller confirm
  -> append Proposal.event
  -> Rust replay
```

`Proposal` should contain the canonical event when the command can be confirmed, plus warnings, computed preview information, and follow-up step hints when relevant.

TypeScript must not append an event that did not come from a proposal returned by Rust.

Manual corrections use the same command/proposal/event flow.

Correction commands should be limited to explicit game-state edits such as character correction, alive/dead status, ghost vote status, notes, and token add/remove.

Do not let TypeScript patch derived rules state directly.

## Persistence

Autosave stores the confirmed event log in IndexedDB.

Undo removes the latest confirmed event and calls `replay` again.

JSON export/import moves the confirmed event log between devices.

Do not store rules-state snapshots for MVP. The event log is the only persisted game state; current state is always produced by `replay`.

If replay becomes slow on real iPad hardware, add snapshots as a measured optimization.

TypeScript owns all browser storage.

Use a small IndexedDB wrapper without a storage dependency for MVP.

```text
database: clocktower
object store: game
key: latest
value: GameFile
```

```ts
type GameFile = {
  schemaVersion: 1;
  exportedAt?: string;
  game: {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    events: GameEvent[];
  };
};
```

IndexedDB stores one `GameFile` without `exportedAt`.

Export reads the stored `GameFile`, adds `exportedAt`, and writes JSON.

Import reads a `GameFile`, checks the basic JSON shape and schema version, calls Rust `replay` to verify the event log, then replaces the stored game and opens it.

Only keep the latest stored game for MVP. Starting a new game or importing a game replaces the current stored game after user confirmation.

Do not build a saved game list or merge imported events for MVP.

If the current stored game has confirmed events, starting a new game or importing a game must ask for confirmation before replacement.

Do not create automatic backup copies for MVP.

## Deferred

- Web Worker for the Rust core. Add only if replay/propose blocks the UI on real iPad hardware.
- Native wrapper such as Capacitor. Add only if PWA storage or lifecycle behavior becomes a real problem.
- Generic rules DSL. Out of scope for Trouble Brewing MVP.

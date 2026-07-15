# Spy Grimoire Reveal prototype (issue #42)

This development-only prototype evaluates one flow: the Storyteller previews a
narrow Spy payload, explicitly opens a full-screen read-only circular grimoire,
and closes it back to the unchanged preview. Variant B is intentionally absent.

## Run

```sh
pnpm prototype:spy-grimoire-reveal
```

Open `http://localhost:5173/?prototype=spy-grimoire-reveal`. The prototype is
routed only while Vite is running in development mode.

The layout targets the fifth-generation 12.9-inch iPad Pro in landscape at
1366 × 1024 CSS pixels. Use the 5, 10, and 15 player switches to evaluate seat
density; the 15-player fixture also includes a long Korean name and several
reminder tokens.

The reveal uses a slightly horizontal oval rather than a strict circle so the
15-player cards can stay close to the 10-player card size. The center remains
empty. Prototype reminders are limited to active state that adds information
(`중독` and `보호`); role, ability, audit, and duplicated status labels are not
repeated as tags.

## Data boundary

The player-facing component accepts only this local prototype contract:

```ts
{
  kind: "spyGrimoire";
  players: Array<{
    playerId: string;
    seat: number;
    name: string;
    characterId: string;
    alive: boolean;
    ghostVoteUsed: boolean;
    reminderTokens: Array<{ id: string; labelKo: string }>;
  }>;
}
```

It does not accept `ReplayState`, the production `Player` object, a store,
event log, Storyteller notes, `shownCharacter`, or the current phase step. The
fixture and reveal state are local to this prototype. Opening or closing the
reveal cannot write production game state.

This contract is not a production WASM or Reveal contract. A later integration
decision must define how the approved fields are computed and transferred
without broadening the player-facing boundary.

## Approved direction (2026-07-15)

The user approved the visual Spy Grimoire Reveal after reviewing the 5, 10,
and 15 Player scenarios at the target iPad viewport.

- Keep the dedicated preview, handoff, eye-closing return, and read-only Reveal.
- Use the slightly horizontal oval with 160-pixel 15-Player cards.
- Keep the center empty.
- Show actual Character, alive/dead, and ghost-vote state directly on each card.
- Limit visible reminder tags to poisoned and protected state.
- Exclude role, ability, audit, death, and ghost-vote duplication from tags.
- Keep the narrow payload boundary described above.

Production integration is tracked in
[issue #48](https://github.com/metishonora/clocktower/issues/48).

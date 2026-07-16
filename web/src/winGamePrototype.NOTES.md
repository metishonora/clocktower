# Win Game Prototype

Run `pnpm prototype:win-game`, then open:

`http://localhost:5173/?prototype=win-game`

This is a development-only product prototype for issue #12. It does not call Rust, create a
Command, append a Confirmed Event, persist state, or reuse production state. The scenario switcher
covers a single warning, simultaneous good/evil warnings, Mayor, Saint, and warning-free manual
game end.

Review decisions:

- Win warnings sit above the current-step card and use one explicit `게임 종료 확인` action.
- A single rules-owned condition locks confirmation to its winning alignment. Simultaneous
  good/evil warnings and warning-free manual game end let the Storyteller choose `선` or `악`.
- The dialog does not ask for a reason.
- Ended state replaces current-step inputs while retaining the Grimoire, event log, and Undo.
- The ended card emphasizes only `게임 종료` and `선팀/악팀 승리`; audit detail stays in the event
  log.

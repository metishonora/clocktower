# Issue 107 · Philosopher ability prototype

## Fixture boundary

- Review-only fixture: no WASM, store, persistence, replay, or canonical event path.
- The compact state strip is outside the production-like `<main>`.
- The live screen reuses the current develop S&V shell and progress-card classes.

## Visible decisions

- Selection uses one compact control containing all 17 good S&V characters; deferral remains a secondary action.
- Before acquisition, the actor uses the develop information-task order: character icon, character name, player name, then character summary.
- After acquisition, the Philosopher remains the actor but its summary is removed; the acquired-ability card owns the acquired icon, name, and summary.
- Binary `취함 있음/없음` copy is not shown on the progress surface.
- Self-selection uses the same Philosopher identity, player name, summary, and `취함` badge layout as another drunk character.
- The normal `마도서` tab is interactive in the fixture. Only when the acquired character is out of play, the Philosopher seat is displayed as that character and owns a `철학자임` reminder token.
- Reminder tokens follow the existing develop presentation: the seat shows an inward `+N` badge, and the complete token appears in the player's detail panel with source character, source icon, and token label.
- If the acquired character is in play, the Philosopher seat keeps its Philosopher token and the original character's seat owns a `취함 · 철학자` reminder token. Self-selection likewise keeps the Philosopher display and owns only that drunk token.

## Review focus

1. Select versus a custom character-picker sheet for the 17-character choice.
2. Acquired-ability card placement on the normal progress card.
3. Official physical-grimoire split using the develop UI: swap plus `철학자임` only for an out-of-play character; otherwise keep the Philosopher token and mark the original character drunk.

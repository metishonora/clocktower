# Issue 135 · Temporarily inactive reminder tokens prototype

## Fixture boundary

- Review-only fixture: no WASM, canonical event, persistence, Undo, or replay path.
- Review controls live outside the production-like S&V Grimoire screen.
- The screen reuses the current token, seat, character asset, and responsive layout styles.

## Agreed semantics represented here

- Only drunk/poisoned source abilities turn their still-applicable reminder tokens inactive.
- An inactive token remains part of the seat's unchanged `+N` total.
- Player details show an X over the full token and expose the full inactive reason to assistive technology.
- Deterministic target changes continue while the source is impaired: when the former nearest No Dashii Townsfolk becomes an Outsider, the X token moves to the new nearest Townsfolk.
- Recovery keeps the current target and removes only the X.
- Losing the source ability through character change, death without ability retention, normal expiry, or another non-impairment lifetime rule removes the token instead of showing X.
- Manual tokens and historical/spent reminders are unaffected.

## Review sequence

1. `정상`: No Dashii poison is active on the current nearest Townsfolk.
2. `노 다시 취함`: the same placement remains and receives X.
3. `대상 직업 변경`: the former target becomes an Outsider, so X poison moves to the new nearest Townsfolk.
4. `취함 해제`: the moved token remains and becomes active.

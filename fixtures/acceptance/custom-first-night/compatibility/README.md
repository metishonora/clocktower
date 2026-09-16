# Production compatibility records

Captured from develop `d35389e` using an ordinary `clocktower-wasm` build.
No `custom-runtime-fixtures` feature was enabled.

- `production-trace.json`: exact requests, Proposals, GameFiles and replay responses.
- `definition-record.json`: existing repository save/load output.
- `session-record.json`: existing session storage save/load output during first night.
- `first-night.game.json`, `day.game.json`: canonical records at two progress points.

The explicit order puts DemonInfo before MinionInfo. The roster has only Characters
without implemented first-night Character actions; all three bluffs are in the pool
and absent from the roster. Dusk is an order entry with no confirmable Step under
#206. Every expected transition was selected explicitly; no unexpected Step was
skipped. Replay and proposal comparisons use deterministic baseline timestamps.

These records freeze pre-separation behavior. Do not regenerate them from the new
runtime to make compatibility tests pass. The envelopes were created and checked
using the existing custom repository and session modules with fake-indexeddb.

# Independent custom runtime and SnV first-night acceptance

Implementation baseline: `d35389e` (develop, PR #211).
Approved [Spec](https://github.com/metishonora/clocktower/issues/207#issuecomment-5576373478)
and [Plan](https://github.com/metishonora/clocktower/issues/207#issuecomment-5577278232).

## Execution status

- Task 0: complete; baseline captured and read-only test-contract review incorporated.
- Task 1: Rust/WASM separation implemented; Production compatibility verified.
- Task 2: complete; independent TypeScript, storage, test/build paths and dependency guards verified.
- Task 3: common source, cause, typed facts, resolver input and scheduler contracts implemented and verified; ordering clarification approved.
- Tasks 4–7: not started. No new SnV Production handlers yet.
- Separation checkpoint: passed at `ca357fd`. Subsequent behavior changes stay inside custom ownership.

## Compatibility boundary

`fixtures/acceptance/custom-first-night/compatibility/` contains records captured from
an ordinary Production WASM build of the baseline. These are not fixture-handler
outcomes and must not be regenerated from the new implementation to mask drift.
Capture includes the complete definition, repository/session envelopes, commands,
proposals, and every replay prefix from Setup through Day.

Preserve schema-v4 custom GameFile; repository/session envelope version 1; the
`clocktower` IndexedDB database and `game` store; `custom-definition:` and
`session:custom:` keys; metadata outside the runtime definition; exact ordered
snapshot comparison; atomic import; unreadable-record protection; and autosave
failure semantics. Official v2/v3/v4 records stay on the official runtime.

## Test migration inventory

| Existing evidence | Destination / retained assertion |
| --- | --- |
| Rust #192 custom GameFile contracts | Independent custom JSON boundary; keep official-format rejection cases at official boundary. |
| Rust #193 catalog | Custom-owned TB/SnV catalog, kinds, membership, duplicates and unknown IDs. |
| Rust #194 Setup | Custom normalization, roster distribution, Baron/Fang Gu/Vigormortis deltas and insufficient-pool errors. |
| Rust #195 first-night plan/runtime | Explicit complete order, movable system information, no runtime default filling, unsupported active actions. |
| Rust #198 immutable definition | Exact snapshot and removed Setup order fields; official serialization unaffected. |
| Rust #206 action/event/state/scheduler/replay | Move helpers and assertions into custom crate; retain fixture/Production distinction. |
| WASM custom tests | New custom WASM; official WASM retains official entrypoint and wrong-boundary rejection tests. |
| Web custom registry/repository/session | Custom-owned parser, adapter, controller and IndexedDB tests. |
| Web core custom FirstNight/GameFile/identity/stream cases | Split custom cases into custom test suite; leave official cases with official types. |
| Web #206 fixture WASM tests | Independent custom fixture build and harness; no Production alias. |
| Web #206 Production isolation | SnV unimplemented expectation changes only when real handlers are added; unsupported TB and fixture-result rejection remain. |

Migration preserves test intent, not helper dependency on official types. Mixed
files must be split, not deleted wholesale. No new custom test calls official SnV
runtime to compute its expected answer.

## Acceptance contracts

| ID | Stimulus / setup | Expected observation | Strongest evidence |
| --- | --- | --- | --- |
| C01 | Baseline stored Production custom records | Same definition, event meanings, current Step, overview and Reveal at each prefix; Day reached | Frozen records through new JSON + real WASM/session |
| C02 | Definition order omitted, duplicated, incomplete, out-of-pool or changed at Setup | Whole request rejected; no synthesized order or adopted prefix | JSON boundary |
| C03 | Definition edited after session creation, then exactly reverted | Session snapshot preserved; resume only on exact equality; metadata ignored | IndexedDB + session |
| C04 | Corrupt record, initialization failure, failed save, malformed import | Missing/corrupt/operational failure distinguished; prior canonical session survives; explicit recovery only | Real session with controlled storage failures |
| I01 | Custom build with official source and generated output absent | Catalog, Setup, first-night and replay run | Isolated temporary workspace |
| I02 | Official harness with custom WASM absent | TB/SnV/BMR retain entry, normal replay and stored-record save/load/resume | Official-only loading and IndexedDB harness at separation checkpoint |
| I03 | Direct, transitive, type-only, dynamic or re-export cross-boundary dependency | Dependency guard fails | Guard negative fixtures |
| I04 | Fixture result at Production Rust/TS boundaries | Rejected, no fallback | Default custom WASM + parser |
| I05 | Custom WASM initialization failure | Custom error, no official initialization or record mutation | Adapter failure isolation |
| I06 | Both runtimes installed; normal official app routing | Each official script selects only official runtime and preserves storage interpretation | App loading paths at separation checkpoint |
| I07 | Active unsupported TB action in custom definition | Explicit unavailable-handler error; no official fallback | Production custom WASM |
| A01 | SnV catalog entries, absent owners, 1 owner, distinct acquired/base instances | Exactly one Production handler per 9 refs; 0/1/N Steps in deterministic order | Registry + public replay |
| A02 | Repeated proposal/read and malformed stale command | Events, instance IDs, use and cursor unchanged; rejection atomic | JSON + session |
| A03 | Genuine new instance versus impairment/reprojection | New instance does not inherit old use; unchanged instance does not reset use | Pure provenance contract + replay |
| P01 | Healthy Philosopher defers, acquires, or selects self | Defer completes this occurrence without spending; acquisition spends and preserves Character/alignment; self-drunk is distinct | Production proposal/replay |
| P02 | Philosopher chooses while impaired | Spent, no actual grant, no duplicate drunkenness; simulation source references actual failed choice | Production event, RuleState and Step |
| P03 | Failed Philosopher choice followed by same-night recovery | Uncompleted simulation disappears; completed delivered information preserved; no retroactive grant/rechoose | No Dashii/Snake Charmer Production sequence |
| P04 | Healthy acquisition then impairment/recovery/source loss | Grant identity retained across impairment, effects suspend/recover; actual source loss removes current ownership | Rule facts + reachable Production sequences |
| T01 | Acquired Clockmaker / recurring action before and after its slot / non-first-night ability | Immediate then cursor resume / pending join / no past-slot insertion / grant only | Scheduler + Production acquisition |
| S01 | Base or Philosopher Snake Charmer chooses living Demon | Current identities and alignments swap atomically; former Demon poisoned, becomes Philosopher when actor was Philosopher | Production event/replay + individual Reveal |
| S02 | Impaired actor or non-Demon target, or swap-created Snake Charmer | No invalid effect; no recursive swap; other unfinished owners reevaluated | Production sequence + scheduler |
| E01 | Evil Twin paired to good Snake Charmer who swaps into evil | Source event + old relationship identify one immediate repair; first snapshot retained; ordinary cursor resumes | Production sequence |
| E02 | Repair repeated projection, conditions cease, name-only change or twin death | Same cause deduplicated; unnecessary pending removed; no repair from name/death alone | Pure follow-up contracts + replay |
| E03 | Undo repair, then its causal event | First restores prior relationship and pending repair; second removes cause-dependent work | Real session Undo |
| D01 | No Dashii location/Townsfolk neighbors change; impairment sources overlap | Current nearest Townsfolk targets updated; other impairment sources retained | Production swap sequence + rule facts |
| W02 | Two Witch or two Cerenovus sources assign concurrently | Both source-specific assignments coexist in replay and persist into Day | Production and bounded multi-source fact contracts |
| W01 | Witch/Cerenovus assignment; impaired source; source/target identity changes | Target, exact source, day, instruction and effect distinguished; facts survive Day; no nomination/madness execution feature | Production + bounded fact contracts |
| F01 | Healthy Clockmaker, Dreamer, Seamstress | Current distance; good+evil pair with actual/registration truth; current alignment comparison; self/duplicate invalid targets rejected | Explicit expected results |
| F02 | Impairment, Vortox, judgment-specific registration | Only allowed delivery accepted; Vortox false information holds with impairment; Player identity remains unchanged | Input/result mutation tests |
| F04 | Clockmaker/Mathematician number, Dreamer pair, Seamstress boolean under healthy, impaired and Vortox states | Each shape independently enforces its permitted result set; Dreamer judgment applies only to that check and leaves Player identity unchanged | Production per-shape acceptance |
| F03 | No legal information candidates in pool | Explicit rejection; no invented candidate or official fallback | Boundary fixture |
| M01 | Impaired but correct information, genuinely failed effect, multiple causes for one Player | Impairment alone not counted; failure evidence kept; subject Player counted once | Explicit audit and number expectations |
| M02 | Multiple Mathematicians at distinct confirmation prefixes | Each sees preceding facts; own Mathematician malfunction excluded; earlier delivered value not overwritten | Production acquisition + information |
| M03 | Failed Philosopher acquisition and subsequent simulated information | Real grant absent; evidence attributed to actual source/choice, never phantom acquired instance | Event + audit assertions |
| R01 | Every delivered information/identity notification | Minimal payload only, no computed truth, impairment source, Grimoire or secret acquisition provenance | Exact Reveal key/value assertions |
| R02 | Save/load, Undo, forged result/source/cause or later-event reference | Same valid prefix produces same facts/progress/information; invalid log wholly rejected | Real WASM + IndexedDB/controller |
| R04 | Mutate one field of valid input: dead Snake Charmer target, out-of-pool/non-good Philosopher or Cerenovus choice, invalid opposed Evil Twin target | Atomic rejection; no adopted event, use, effect or cursor change | Character-specific Production mutation tests |
| R03 | Pending regular/immediate/follow-up work versus Dawn | Cannot finish early; Day keeps confirmed facts and does not reopen first night | Public command/replay |

## Fixture discipline

Production acceptance uses explicit definitions and commands returned by the real
custom boundary. Helpers never fill missing orders, choose expected outcomes by
calling the implementation, silently skip unexpected Steps, or swallow unavailable
handlers. Pure scheduler tests may inject facts for otherwise unreachable states;
label these separately from Production acceptance. Malformed variants start from
a known valid event and change one contract field; test failures must not be caused
only by a missing Setup or another earlier invalidity.

Representative Production sequences:

1. Philosopher acquires Clockmaker, receives immediate information, normal cursor resumes.
2. Impaired Philosopher chooses Seamstress; a different Snake Charmer swaps with No Dashii;
   Philosopher recovers before Seamstress slot, so failed-choice simulation is removed.
   A separate ordering confirms simulation first and checks history survives recovery.
3. Evil Twin pairs with good Snake Charmer; Snake Charmer swaps with Demon; relation repair
   runs once before ordinary progress. Undo repair and causal swap separately.
4. Correct information while impaired, a genuinely failed ability, impaired original
   Mathematician receiving incorrect information, then acquired Mathematician. Audit uses
   each confirmation prefix and deduplicates the affected Player.
5. Save/load valid session, reject mutated import, then verify old session is unchanged.

## Rule-source qualification and unresolved cases

The approved failed-Philosopher simulation/recovery behavior applies official general
state rules plus community Philosopher interpretation. It is not represented as a
separately verified official character ruling. Preserve this distinction in tests/docs.
Other Character rules and timing follow the approved Spec and its cited sources.

If review/implementation reveals that the recorded Plan needs changing, stop the affected
work and ask the user with the exact conflict, affected sections and recommended change.
Do not silently broaden the implementation or send first-night exceptions out of scope.

## Validation record

- Baseline Production WASM build completed from develop `d35389e` without fixture features.
- Captured five replay prefixes (empty, Setup, DemonInfo, MinionInfo, Day) and four Proposals.
- Repeated proposals were equal and left the input GameFile unchanged.
- Existing definition repository and session storage both roundtripped the captured envelopes through IndexedDB.
- Existing Rust #206 contract suite: 28 passed, 0 failed.
- Read-only `test_contract_reviewer`: no blocker or Plan decision required; explicit coverage additions incorporated as I02/I06/I07/F04/W02/R04.
- Task 1: independent custom domain tests 73 passed; fixture-feature tests 77 passed (before three additional compatibility tests); custom WASM adapter tests 6 passed.
- Fresh independent Production WASM matches all five replay prefixes, four proposals, and all 47 catalog entries in order.
- Official Rust/WASM test targets compile after removal of custom dispatch and exports. Full official regression remains assigned to the Task 2 checkpoint.
- An automatic approval review rejected a bundled unused-code cleanup/build command. That cleanup was not executed; the source-preserving WASM build was separately approved and passed. Unused-code warnings remain for review.

- Task 2: custom web 62 tests, custom fixture WASM/session 13 tests, boundary negative fixtures 10 tests passed.
- A fresh temporary workspace containing no official source or WASM passed custom Rust (73 domain + 6 WASM), fixture-feature domain (80), both WASM builds, custom TypeScript, and all custom web tests.
- Official checkpoint: Rust domain 381 and WASM 4 tests passed; web unit 166 passed. Web integration initially passed 604/605: the remaining custom success case was migrated to the custom suite and replaced by an explicit official-boundary rejection; both tests in the affected official file passed on recheck.
- A separate official-only workspace without custom source or WASM passed TB/SnV/BMR create, replay, real IndexedDB game/session save/load/resume, and legacy v2/v3 parsing checks.
- Release web build (including both independent WASM artifacts) and PWA contract verification passed.
- Dependency guard passes across Cargo, Rust source includes and resolved TypeScript imports, including transitive, type-only, dynamic, alias and symlink cases.

## Approved ordering clarification (2026-09-08)

Task 3 testing found an inconsistency in Plan §4.2: it names seat/owner/ability/source/instance ordering while also requiring preservation of #206. The actual #206 scheduler compares origin source first, then seat, then owner/instance; its real WASM fixture explicitly expects the original owner at seat 2 before the acquired owner at seat 1. Applying seat-first ordering produced [p1,p2] instead of [p2,p1] in `web/test/custom/runtime.fixture.test.ts`.

The user approved preserving the existing #206 order after rule research. Original owners precede acquired owners, with the existing source/seat/owner/instance comparison retained. This is the application's fixed policy, not a uniquely mandated rules order. No Storyteller order-selection feature is added. The Spec and Plan wording is corrected accordingly.

Other Task 3 verification so far: normal custom domain 79 + WASM 6 passed; fixture-feature domain 86 passed; custom TypeScript/web 64 passed. A fresh Production WASM build passed. Fixture WASM tests initially passed 12/13; the remaining failure is the ordering conflict described above, not a weakened or removed assertion. Recheck after comparator restoration is recorded separately when complete.

- After restoring the existing comparator: fixture-feature Rust 86, fresh fixture WASM/session 13, custom TypeScript/web 64 and dependency-guard negative fixtures 10 passed. No official implementation file changed after `ca357fd`. The ordering decision is resolved; Task 3 can now be committed.

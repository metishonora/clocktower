# Issue #138: ability ownership and presentation boundaries

## Decisions

- Persisted schema-v3 events remain unchanged. Ability origin is replay-derived.
- Use `identityBound` and `acquired` as the two ability origins.
- A Player's `actualCharacter` is canonical identity only. It must not be replaced for UI display.
- An out-of-play Philosopher acquisition keeps the existing physical Grimoire policy: the seat
  displays the acquired Character token plus the `철학자임` reminder.
- Progress shows owner identity and acting ability in detail. Grimoire handoff shows the acting
  Character icon/title only. Seat and public Reveal keep their existing physical/public policies.
- The first migration is Sects & Violets. Trouble Brewing behavior is unchanged.

## Model boundary

`AbilityUseRef` remains the stable ability-instance identity used by persisted events. Replay adds:

```text
AbilityOrigin = identityBound
              | acquired(acquisitionEventId, source AbilityUseRef)

AbilityActor = canonical Player identity
             + acting AbilityUseRef
             + AbilityOrigin
             + ability source event
```

`PhaseStep`, `PhaseOverviewItem`, `AvailableDayAction`, and `PendingDeathConsequence` carry the exact
acting reference and origin. Consumers must not rediscover them by comparing Character IDs or by
searching the grant list.

## Surface policy

| Surface | Identity | Acting ability | Physical token/reminder |
| --- | --- | --- | --- |
| Progress | detailed | detailed | not inferred |
| Grimoire handoff | only when needed for actor context | icon/title | unchanged |
| Seat/detail | canonical identity remains in data | not shown as a second detail card | acquired token + canonical reminders |
| Public Reveal | never leaks private identity | reveal payload only | not read from Grimoire state |

Shared React elements are limited to `AbilityOwnerIdentity` and `ActingAbilityIdentity`; surface
composition owns layout and information density.

## Minimum coverage matrix

The matrix is pairwise rather than a full Cartesian product. Each row must be represented by a
JSON-boundary or production UI test.

| Ownership | Health/state | Timing | In play | Required assertion |
| --- | --- | --- | --- | --- |
| identityBound | healthy | first Night | yes | origin and instance are exact |
| acquired | healthy | acquisition Night, earlier order | either | waits until next eligible phase |
| acquired | healthy | acquisition Night, later order | either | runs in canonical order |
| acquired | healthy | later Night | either | recurring hook returns |
| acquired | healthy | day | either | exact day-action ability reference |
| acquired | healthy | death | either | exact death-trigger ability reference |
| acquired | poisoned | selection | either | use is spent with no grant |
| acquired | self-drunk | selection | yes | no recursive grant |
| acquired | healthy | while source alive | yes | original owner is drunk |
| acquired | source dead | subsequent phase | yes | grant stops; original owner recovers |
| acquired | healthy | any supported hook | no | physical acquired token + Philosopher reminder |
| acquired | healthy | every good Character category | either | catalog/hook coverage cannot omit a new role |

The catalog contract enumerates all 17 good S&V Characters and verifies that each has at least one
scheduled-Night, day-action, madness, or death hook. Day-action and death-consequence consumers are
generated from that centralized Character policy rather than local string arrays.

## Save and viewport verification

- Acceptance fixtures are imported as real schema-v3 GameFiles and replayed through the WASM
  boundary; synthetic ReplayState alone is insufficient for acceptance.
- Each acceptance fixture test records the expected current step, owner, ability instance, and
  origin assertions. Seat token and reminder assertions remain in their owning projection tests.
- Production React tests cover the replay-shaped ability context; existing handoff, seat, and public
  Reveal suites retain their surface-specific policies.
- Manual browser acceptance for this migration uses 390×844 mobile, 820×1180 tablet, and
  1440×1000 desktop viewports.
  They assert no horizontal overflow and verify that progress detail is absent from Grimoire
  handoff composition.
- Pull requests run Rust workspace tests, web tests, and the production build in
  `.github/workflows/validate.yml`.

## Migration and risks

1. Add replay-derived origin without changing persisted events.
2. Replace projected Player clones with `AbilityActor` in S&V rule queries.
3. Add exact ability references to non-step projections.
4. Move web consumers to the exact origin and add an explicit seat token field.
5. Replace role arrays with centralized hook metadata and lock the full good catalog in tests.
6. Add real save fixtures, record browser viewport checks, and automate them when a production
   browser harness is introduced.

Risks are forged origin/reference combinations, a stale active grant after source death, identity
transition semantics, and a new Character being added to the catalog without every relevant hook.
Replay validates or derives the first three; the catalog and state matrix fail on the fourth.

## Completion conditions

- No S&V rule path clones a Player and overwrites `actualCharacter` to represent an ability.
- No production web surface detects acquisition by comparing Character IDs.
- All affected projections expose the exact acting ability and origin.
- Seat token presentation does not mutate canonical Player identity.
- The 17-good-Character catalog and state/timing matrix pass at the JSON boundary.
- A representative real save fixture, mobile/tablet/desktop checks, full Rust/web tests, and the
  production build pass.

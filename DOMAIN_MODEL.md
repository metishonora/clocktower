# Clocktower Domain Model

## Purpose and status

This document defines shared domain concepts, their relationships, and state ownership.
Use it when specifying work across issues. These are conceptual boundaries, not a required
class hierarchy, module layout, or new persistence format.

The model was established during [Issue #206](https://github.com/metishonora/clocktower/issues/206).
Issue #206's custom first-night runtime now implements this responsibility model. Its
event-by-event fold in `crates/custom-domain/src/game.rs` validates each event, calculates next `CustomGameFacts`
through `crates/custom-domain/src/reducer.rs`, calculates next `FirstNightProgress` through
`crates/custom-domain/src/first_night/runtime.rs`, and adopts both only when processing succeeds. The public
`RuleState`, current Step, and phase overview come from `crates/custom-domain/src/projection.rs`; the aggregate,
progress, and completion Step/Reveal snapshots remain replay-derived in memory and are not
persisted. The broader model remains conceptual outside this custom first-night runtime, and
existing official scenario runtimes are unchanged. Issue-specific behavior and acceptance
conditions remain in the approved issue spec.

Issue #207 places this runtime in the independent `clocktower-custom-domain` crate. Facts include
source-specific Philosopher choices/use, twin relationships, Witch curses, Cerenovus instructions,
durable impairment sources, and confirmed malfunction evidence. Initial assignment and current
effect validity are distinct. Day retains first-night facts without executing nominations or madness.

An occurrence is either an actual ability instance or a simulated action tied to a failed
Philosopher choice. Twin repairs additionally carry the causal event and prior relationship event.
Completion snapshots preserve the original delivered information. Mathematician reads the preceding
audit prefix, counts subjects once and excludes its own malfunction. Audit attribution for simulation
uses the real Philosopher source. Information truth, permitted delivery and actual delivery are
separate; the approved Vortox policy tests falsity against actual facts before registration.

Related documents:

- [CONTEXT.md](CONTEXT.md): product context and concise domain vocabulary.
- [ARCHITECTURE.md](ARCHITECTURE.md): implementation architecture and system contracts.
- [Domain documentation guide](docs/agents/domain.md): how agents use these references.

## Game and its representations

A **Game** is one play session using a particular scenario. It is the consistency boundary
for participants, abilities, effects, phase, and progress through actions.

Distinguish three representations:

| Representation | Meaning |
| --- | --- |
| Game record | The scenario reference or snapshot and ordered Confirmed Events that determine the game |
| Current game state | Facts and progress reconstructed through a particular confirmed-event prefix |
| Public projection | Output needed by callers and presentation, such as the current Step, overview, and Reveal data |

Here, public means exposed across the domain boundary, not visible to every Player.
Player-facing Reveal remains restricted to the information being delivered.

Current game state includes two related parts:

- **Game facts:** Player identity and life status, ability instances, acquired abilities,
  applicable effects, and other confirmed rule facts.
- **Progress:** the current phase, position within its action order, completed action
  occurrences, and pending immediate actions.

These parts can be calculated separately, but the result of one event must be accepted as
one coherent state. Do not expose changed abilities with outdated progress, or completed
progress without the corresponding game facts.

Current state is derived, not another persisted source of truth. The conceptual Game is
broader than any existing DTO named `Game`, `GameState`, or `ReplayState`.

## Scenario definition

A **Scenario definition** specifies the Character pool and confirmed action order used by a
custom Game. A custom Game uses its embedded definition snapshot throughout that game.

The definition owns the allowed composition and order. It does not own the current roster,
ability owners, action occurrences, or completion history. Membership in the Character pool
does not imply that a corresponding ability is currently present or able to act.

The definition selects Character and action identities; it does not contain their complete
rule implementations. Runtime progress refers to the confirmed order rather than creating
an independently editable copy. The current custom first-night contract requires an explicit
complete order; an authoring default is not a runtime replacement for a missing order.

## Player, Character, and Ability instance

| Concept | Identity and boundary |
| --- | --- |
| Player | A particular participant in a Game; remains the same Player through Character changes |
| Character | A Character type and the definition of its abilities and actions |
| Ability instance | A concrete ability held by a Player through a particular source |

Actual Character, Shown Character, and alignment are distinct Player facts. An acquired
ability does not by itself replace the Player's identity.

Distinguish identity-bound abilities from acquired abilities. Acting provenance identifies
the owning Player, the Character whose ability is used, and the particular ability instance;
its origin explains how that instance arose.

Two Players using the same Character ability do not share an instance. A replacement or newly
acquired instance must not inherit an old instance's completion merely because its Character
matches. Conversely, an unrelated state change must not arbitrarily create a new instance.
Rules determine whether an instance survives or is replaced, and confirmed facts make that
identity reproducible during replay.

## Night

A **Night** is a phase occurrence within a Game in which night actions are processed. It is
not the action order itself and not a frozen list of Steps.

Its progress describes whether it has started or ended, which order position has been passed,
which action occurrences are complete, and which immediate actions remain pending.

A Night refers to the scenario's applicable order and reads current game facts. It does not
maintain a second copy of Players, abilities, or effects. Night progress belongs within the
Game consistency boundary rather than being an independent source of truth.

Issue #206 applies this model to first night only. Later-night ordinals, repeated cycles,
and execution in a future night require their own contracts.

## Action definition, Action occurrence, and Step

Use these terms explicitly when the distinction matters:

| Concept | Meaning |
| --- | --- |
| Action definition | The stable semantic action: what is done |
| Action occurrence | A concrete instance of performing that action in a phase, with its actor and ability provenance when applicable |
| Step | A projection of the input, confirmation, or information needed to progress an action |

The scenario orders action definitions. Current facts and participation rules produce zero,
one, or multiple action occurrences for a definition. Progress concerns these concrete
occurrences, not just the definition or the Player.

An occurrence's identity must distinguish otherwise similar actions by different ability
instances. This is a conceptual requirement, not a decision to add a persisted occurrence
object or prescribe an identifier format.

A Step is output, not the owner of game facts or the canonical record of execution. Do not
equate the lifetime of a rendered Step with the lifetime of an ability or an action definition.
This model does not prescribe a universal one-to-one mapping between actions, Steps, and events.

System actions may have no Player or ability instance. Do not manufacture ability ownership
to make them fit Character actions.

Use **Action occurrence**, not **Action execution**, for the concrete domain concept.
**Execution** already means the outcome of the day's nomination and vote process in
[the glossary](CONTEXT.md#language).

## Command, Proposal, and Confirmed Event

| Concept | Meaning |
| --- | --- |
| Command | A Storyteller request evaluated against the current game |
| Proposal | A candidate canonical event and associated results produced by evaluating a Command |
| Confirmed Event | A fact accepted into this Game's ordered record |

A valid Command or returned Proposal does not by itself alter the confirmed record.
Confirmation is the boundary at which the candidate becomes part of that record.

Events describe confirmed facts, not instructions to patch an arbitrary object. Action
confirmation must be attributable to the appropriate action occurrence and its provenance.
Setup and phase transitions are also events; not every event represents a Character ability.

Replay evaluates each event against its preceding state and reconstructs its consequences.
Later changes must not reinterpret a past action as performed by a new identity or ability,
or replace previously Delivered Information with a newly calculated result.

An event may affect both game facts and Night progress. These are consequences of one fact,
not separately confirmed histories.

## Rule and rule facts

A **Rule** defines how to interpret facts and inputs. It is not inherently a mutable entity
with its own lifecycle.

Rules answer different questions:

- Is a scenario, roster, input, or event valid?
- Does an ability participate in this action under current conditions?
- What result does a permitted action produce?
- What facts follow from the confirmed result?
- When may a newly available action participate in progress?

The consequences of rules are game facts. For example, an impairment's target, source, and
duration are facts; how that impairment affects a particular ability is a rule.
Existing output named `RuleState` represents rule-related facts, not the rules themselves.

Ability ownership, participation in an action, and effectiveness of that action are distinct
questions. Shared code must not collapse them into one universal active/inactive condition.
Character-specific exceptions belong to Character rules rather than accumulating as branches
in common orchestration. This distinction does not require a general rules DSL.

## State transition and component responsibilities

Handlers, reducers, schedulers, and sessions are collaborators around the domain model,
not additional domain entities. For the Issue #206 custom first-night runtime, separate
calculation from adoption of a result:

| Collaborator | Responsibility |
| --- | --- |
| Action handler | Interpret a concrete action request using read-only context and propose the canonical fact to confirm |
| Event validation | Establish that the event is permitted by the preceding facts and current action |
| Reducer | Calculate next game facts from previous facts and the validated event |
| Scheduler | Calculate next Night progress and action candidates using the event, game facts, and applicable participation/timing rules |
| Runtime orchestration | Connect these calculations and accept a coherent next state only when processing succeeds |
| Projector | Calculate output from the coherent game state and confirmed history where needed |
| Application session | Adopt the successful game record and returned projection, and coordinate persistence |

A reducer does not own or mutate the caller's previous state. Equal inputs produce equal
results. It does not save data, select the next action, or invoke another handler.
Scheduler progress is explicit input/output rather than hidden mutable state between calls.
Validation is a responsibility here, not a requirement for a separate component per event.

The runtime may use a returned state as the next iteration's input. That adoption does not
give orchestration permission to invent its own game rules or patch domain facts. Likewise,
the session records successful results; it does not implement game rules in presentation code.

```text
Previous game facts + previous Night progress + event
  -> validate against the preceding state/current action
  -> calculate next game facts
  -> calculate next Night progress
  -> accept the coherent next state
  -> project output
```

During replay, adopting intermediate states is local calculation, not a new confirmation or
storage operation. If processing fails, the caller must not receive a partially successful
replacement game. Proposal and read-only projection must not advance the confirmed record.

## Use in issue specifications

Use this model to state which facts, progress, or outputs an issue changes. Specify behavioral
choices separately: activation timing, queue ordering, public overview behavior, accepted event
contracts, and supported Character rules are not settled solely by these definitions.

In particular, this document neither approves all of the Issue #206 draft spec nor expands
its first-night scope. It introduces no new schema, snapshots, migration, or official runtime
refactoring requirement.

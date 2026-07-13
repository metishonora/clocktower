# Clocktower Storyteller App Context

## Goal

Build a personal-use iPad-first local app that helps a Blood on the Clocktower Storyteller run Trouble Brewing without missing character order, state changes, or information reveals.

This is a live Storyteller aid, not a public player app and not a full rules authority. The app should track true game state, compute deterministic results, warn about relevant conditions, and let the Storyteller confirm choices and overrides.

## Scope

- Trouble Brewing only.
- All 22 Trouble Brewing characters.
- 5-15 players.
- No Travellers.
- No Fabled.
- Manual setup only. No random assignment.
- Personal/local use only.
- Default delivery target is a PWA installed from iPad Safari.
- The app should not require the user to run a localhost server.
- Local-only persistence.

Out of scope for MVP:

- Accounts, servers, sync, or multiplayer.
- User-facing localhost runtime.
- Random character distribution.
- Custom scripts or house rules.
- Full replay UI.
- Redo stack.
- Generic rules DSL.
- Traveller/Fabled support.

## Language

Use English canonical terms in code and project documents. Korean is used for user-facing UI messages.

**Storyteller**:
The app user who runs the game and sees the full truth.
_Avoid_: Host, admin, moderator

**Player**:
A game participant seated in the circle.
_Avoid_: User

**Grimoire**:
The Storyteller-facing complete game state, including secret character and token information.
_Avoid_: Board, table

**Grimoire Peek**:
A temporary read-only overlay for quickly checking the full Grimoire state during phase control.
It can include seat order, alive/dead state, Actual Character, important tokens, and current phase progress.
It should not include long rules text, editing forms, or the full event log.
_Avoid_: Phase Overview, rules help

**Actual Character**:
The character a player truly has in the game state.
_Avoid_: Real character, assigned character

**Shown Character**:
The character a player was shown or believes they are, which can differ from the actual character for the Drunk.
_Avoid_: Display character, fake character

**Confirmed Event**:
A Storyteller-confirmed game event stored as the source of truth.
_Avoid_: Action, log item, transaction

**Draft Input**:
Unconfirmed UI input that can be changed or discarded without affecting game state.
_Avoid_: Temporary event

**Command**:
A Storyteller intent sent to the Rust core for validation.
_Avoid_: Event request, UI action

**Proposal**:
A Rust-generated candidate result of a command, including the canonical event when confirmation is valid.
_Avoid_: Preview event

**Reveal**:
A player-facing information display that must contain only the information currently being shown.
_Avoid_: Public view, player screen

**Execution**:
The Storyteller-confirmed result of the day's nomination and vote process.
_Avoid_: Death

**Death**:
A change to a player's alive/dead state.
_Avoid_: Execution

**Announcement**:
A public communication that a player died.
_Avoid_: Death

**Registration Judgment**:
A specific rule judgment where Spy or Recluse may register differently from their actual character or alignment.
_Avoid_: Registration override as player state

**System Token**:
A rule-affecting token such as poisoned, drunk, or protected.
_Avoid_: Reminder

**Script Token**:
A Trouble Brewing character reminder token such as Monk protected, Butler master, or Poisoner poisoned.
_Avoid_: System token

**Note**:
Free text attached to a player with no rules impact.
_Avoid_: Token

## Relationships

- A **Storyteller** manages one current game.
- A **Player** has one **Actual Character** and may have a different **Shown Character**.
- A **Confirmed Event** changes derived game state when replayed.
- A **Command** can produce a **Proposal**; a confirmed **Proposal** appends a **Confirmed Event**.
- An **Execution** may cause **Death**, but **Death** can also happen without **Execution**.
- A **Death** may require a later **Announcement**.
- A **Registration Judgment** belongs to a specific rule check, not to a player globally.
- A **Reveal** must not receive the full **Grimoire**.

## Technical Direction

Use a Rust core with a TypeScript UI.

- Rust owns deterministic domain logic:
  - event types
  - reducer/replay
  - Trouble Brewing script rules
  - step generation
  - validation and warnings
- TypeScript owns the UI:
  - iPad layout
  - seat map
  - forms and reveal screens
  - browser storage integration
  - PWA install/offline shell

Compile the Rust core to WebAssembly for the PWA. The user should open an HTTPS-hosted static app, add it to the iPad Home Screen, and use it like an app. A local dev server is for developers only.

Keep the Rust core isolated enough that the PWA could later be wrapped with Capacitor or replaced by a native shell if browser storage or lifecycle limits become a real problem.

## Core Product Requirements

The app must provide at least:

- Grimoire-style seat map with player position, character, and state.
- Night/day guide with current step and full overview.
- Character-specific prompts for required choices.
- Confirm-based actions.
- Automatic state updates after confirm.
- Follow-up steps for triggered effects.
- Information reveal screen that shows only the current player-facing information.
- Autosave of confirmed events.
- Load by replaying confirmed events.
- Unlimited undo by popping confirmed events one at a time.
- Manual state correction event.
- Human-readable event log.

## Design Principles

- Storyteller stays in control.
- The app does not recommend discretionary choices.
- The app only computes results that are determined by current state and confirmed choices.
- If a player is drunk or poisoned, show the true value to the Storyteller and let the Storyteller choose the displayed value.
- If Spy/Recluse registration matters, let the Storyteller choose the registration for that specific judgment.
- Strong guide, soft authority: warnings and confirmations, not hard blocks unless the choice is invalid by rule.

## Runtime Flow

1. Create game.
2. Enter player count, names, and seating order.
3. Manually assign actual characters.
4. Enter shown characters where needed, especially Drunk.
5. Validate setup with warnings only.
6. Start first night.
7. Generate visible steps from state and the Trouble Brewing script.
8. For each step:
   - show current action and overview
   - collect Storyteller/player choice if needed
   - preview result if deterministic
   - confirm event
   - apply reducer
   - generate follow-up steps if needed
9. Run day:
   - nominations
   - vote overlay on seat map
   - vote confirm
   - ghost vote spending
   - execution confirm
   - win-condition warning if applicable
10. Repeat night/day until Storyteller confirms game end.

## Persistence Model

Use event sourcing lite.

- Confirmed events are the source of truth.
- Current state is derived by replaying events.
- Autosave stores confirmed events only.
- Browser storage should use IndexedDB by default.
- `localStorage` is acceptable only for small settings or a temporary prototype.
- JSON export/import is required for backup and device migration.
- Draft input does not need to persist.
- Undo removes the latest confirmed event and replays.
- Manual corrections are normal events and can be undone.
- Event display can use a stored Korean summary, but replay must use machine-readable payload.

Example event shape:

```ts
type GameEvent = {
  id: string;
  type: string;
  phase: string;
  actorId?: string;
  payload: Record<string, unknown>;
  summary: string;
  createdAt: string;
};
```

## State Model

Player state should include:

```ts
type Player = {
  id: string;
  seat: number;
  name: string;
  actualCharacter: string;
  shownCharacter: string;
  alignment: "good" | "evil";
  alive: boolean;
  ghostVoteUsed: boolean;
  deathAnnounced: boolean;
  notes: string;
};
```

Important distinctions:

- `actualCharacter`: true character in the Grimoire.
- `shownCharacter`: character the player believes or was shown, needed for Drunk.
- `alignment`: independent of character, kept now for future script support.
- `registrationOverride`: not player state. Store it per judgment event when Spy/Recluse can register differently.
- `execution` and `death` are separate concepts.
- Night deaths apply immediately to rules state. Public announcement is separate.

Tokens:

- system tokens: rule-affecting state such as poisoned, drunk, protected.
- script tokens: Trouble Brewing character reminders such as Monk protected, Butler master, Poisoner poisoned.
- note: free text, no rules impact.

Effect tokens should preserve their source when relevant, because an effect can end if the source dies, becomes drunk, or becomes poisoned.

## Phase Events

Phase transitions are confirmed events:

- `START_GAME`
- `START_FIRST_NIGHT`
- `END_NIGHT_START_DAY`
- `END_DAY_START_NIGHT`
- `END_GAME`

Phase transitions can expire tokens, clear daily records, increment counters, and create announcement steps.

## Step Generation

For MVP, Trouble Brewing can display a stable night/day overview with status badges:

- waiting
- current
- complete
- skipped
- needs follow-up

Internally, steps should be generated from `state + events + script`, not saved by list index. Save events by actor/action/type/payload so future scripts can support dynamic ordering, character changes, or inserted immediate actions.

## Reveal Screen

The reveal screen is player-facing only when the Storyteller needs to show information.

Requirements:

- Full-screen.
- Shows only the current information.
- Hides seat map, logs, state, and other secrets.
- Has a clear close/return path for the Storyteller.
- Preview and reveal are separate states.

## Day Flow

Nominations:

- Record nominator and nominee.
- Trigger Virgin if applicable.
- Track nominations for the day.

Voting:

- Use seat map overlay.
- Tap players to toggle vote.
- Count votes automatically.
- Show ghost votes that will be spent.
- On confirm, spend valid ghost votes.
- Show current execution candidate, but final execution requires Storyteller confirm.

Execution:

- Confirm execution or no execution.
- Apply death if applicable.
- Trigger Undertaker info for next night.
- Check Saint and Demon win conditions.

## Win Conditions

The app detects and warns, but never auto-ends.

MVP conditions:

- Demon dead -> good win warning.
- Two living players -> evil win warning.
- Saint executed -> evil win warning.
- Mayor condition -> Storyteller confirm.

Game end is a confirmed event and remains undoable.

## Trouble Brewing Character Checklist

Townsfolk:

- Washerwoman: Storyteller-selected info reveal.
- Librarian: Storyteller-selected info reveal, including possible zero Outsiders.
- Investigator: Storyteller-selected info reveal.
- Chef: compute true neighboring evil pair count; Storyteller selects displayed number if drunk/poisoned or registration override applies.
- Empath: compute true living evil neighbors; Storyteller selects displayed number if needed.
- Fortune Teller: choose two players; compute Demon/red-herring/Recluse/Spy-sensitive result; Storyteller selects displayed yes/no if needed.
- Undertaker: reveal character of executed-dead player from previous day; support Spy/Recluse registration and drunk/poisoned display override.
- Monk: choose another player; apply protection if sober/healthy/alive.
- Ravenkeeper: if killed at night, create follow-up reveal to choose a player and learn character.
- Virgin: first Townsfolk nomination can execute nominator immediately; once per game.
- Slayer: once per game shot; if target registers as Demon, target dies; spent even if drunk/poisoned.
- Soldier: cannot die from Demon attack while sober/healthy.
- Mayor: if no execution and exactly three alive, warn for Mayor win; Demon attack may bounce to another player by Storyteller choice.

Outsiders:

- Butler: choose master each night; voting warning/helper.
- Drunk: actual character is Drunk; shown character is another character; drunk state affects shown ability.
- Recluse: can register as evil/Minion/Demon for specific judgments.
- Saint: if executed, evil win warning.

Minions:

- Poisoner: choose a player each night; poison until dusk while Poisoner ability remains active.
- Spy: sees Grimoire; can register as good/Townsfolk/Outsider for specific judgments.
- Scarlet Woman: if Demon dies with enough players alive, create follow-up to become Demon.
- Baron: setup validation for +2 Outsiders.

Demon:

- Imp: choose kill target each night; apply death unless prevented; self-kill can trigger Scarlet Woman transfer.

## Major Risks

- Drunk/poisoned handling: ability is inactive, but players may still wake and receive false information.
- Spy/Recluse registration: must be judgment-specific, not global.
- Immediate death: abilities are usually lost immediately on death.
- Persistent effects: source death/drunkenness/poisoning can end effects.
- Once-per-game abilities: spent even when drunk/poisoned.
- Execution and death must remain separate.
- Storyteller discretion must remain easy, not buried behind automation.

## References

- Trouble Brewing: https://wiki.bloodontheclocktower.com/Trouble_Brewing
- Rules Explanation: https://wiki.bloodontheclocktower.com/Rules_Explanation
- States: https://wiki.bloodontheclocktower.com/States
- Abilities: https://wiki.bloodontheclocktower.com/Abilities
- Setup: https://wiki.bloodontheclocktower.com/Setup

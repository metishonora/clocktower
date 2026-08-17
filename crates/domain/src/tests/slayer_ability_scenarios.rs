use super::support::*;
use crate::*;
use serde_json::{json, Value};

#[test]
fn healthy_slayer_shot_uses_a_separate_undoable_death_confirmation() {
    let game = slayer_discussion_game();
    let before = call_replay(&game);
    assert_eq!(before["ok"], true, "fixture replay failed as {before}");
    assert_eq!(before["value"]["currentStep"]["stepType"], "discussion");
    let proposal = call_propose(
        &game,
        json!({
            "type": "useSlayerAbility",
            "payload": {
                "discussionStepId": "day:discussion",
                "expectedEventCount": event_count(&game),
                "actorPlayerId": "player-1",
                "targetPlayerId": "player-5",
                "targetRegistration": { "kind": "canonical" }
            }
        }),
    );

    assert_eq!(proposal["ok"], true, "proposal failed as {proposal}");
    assert_eq!(proposal["value"]["event"]["type"], "slayerAbilityUsed");
    assert_eq!(
        proposal["value"]["event"]["payload"],
        json!({
            "discussionStepId": "day:discussion",
            "actorPlayerId": "player-1",
            "targetPlayerId": "player-5",
            "impairmentContext": { "kind": "healthy" },
            "registrationContext": { "kind": "canonical", "registeredAsDemon": true },
            "outcome": { "kind": "deathPending", "playerId": "player-5" }
        })
    );

    let game_after_shot = with_event(&game, proposal["value"]["event"].clone());
    let pending = call_replay(&game_after_shot);
    assert_eq!(pending["ok"], true, "replay failed as {pending}");
    assert_eq!(
        pending["value"]["ruleState"]["slayerAbility"],
        json!({ "actorPlayerId": "player-1", "spent": true, "canUseNow": false })
    );
    assert_eq!(pending["value"]["players"][4]["alive"], true);
    assert_eq!(
        pending["value"]["currentStep"]["id"],
        "day:discussion:slayerDeath"
    );
    assert_eq!(pending["value"]["currentStep"]["phase"], "day");
    assert_eq!(pending["value"]["currentStep"]["stepType"], "slayerDeath");
    assert_eq!(pending["value"]["currentStep"]["playerId"], "player-5");
    assert_eq!(
        pending["value"]["currentStep"]["requiredInput"],
        json!({
            "kind": "slayerDeathDecision",
            "playerId": "player-5",
            "survivalAllowed": false,
            "optional": false
        })
    );

    let death = call_propose(
        &game_after_shot,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "day:discussion:slayerDeath",
                "input": { "died": true }
            }
        }),
    );
    assert_eq!(death["ok"], true, "death proposal failed as {death}");
    assert_eq!(death["value"]["event"]["type"], "deathConfirmed");
    assert_eq!(
        death["value"]["event"]["payload"],
        json!({ "stepId": "day:discussion:slayerDeath", "playerId": "player-5" })
    );

    let confirmed = call_replay(&with_event(
        &game_after_shot,
        death["value"]["event"].clone(),
    ));
    assert_eq!(confirmed["ok"], true, "death replay failed as {confirmed}");
    assert_eq!(confirmed["value"]["players"][4]["alive"], false);
    assert_eq!(confirmed["value"]["currentStep"]["id"], "day:discussion");

    let undone = call_replay(&game_after_shot);
    assert_eq!(undone["value"]["players"][4]["alive"], true);
    assert_eq!(undone["value"]["currentStep"]["stepType"], "slayerDeath");

    let shot_undone = call_replay(&game);
    assert_eq!(
        shot_undone["value"]["ruleState"]["slayerAbility"],
        json!({ "actorPlayerId": "player-1", "spent": false, "canUseNow": true })
    );
}

#[test]
fn slayer_rejects_wrong_phase_stale_invalid_and_repeated_commands() {
    let discussion_game = slayer_discussion_game();

    let mut whisper_events = discussion_game["game"]["events"]
        .as_array()
        .unwrap()
        .clone();
    whisper_events.pop();
    let whisper_game = game_with_events(Value::Array(whisper_events));
    assert_error_code(
        &call_propose(
            &whisper_game,
            slayer_command(&whisper_game, "player-1", "player-5", "canonical"),
        ),
        "SLAYER_WRONG_PHASE",
    );

    let mut stale = slayer_command(&discussion_game, "player-1", "player-5", "canonical");
    stale["payload"]["expectedEventCount"] = json!(event_count(&discussion_game) - 1);
    assert_error_code(&call_propose(&discussion_game, stale), "STALE_COMMAND");

    assert_error_code(
        &call_propose(
            &discussion_game,
            slayer_command(&discussion_game, "player-2", "player-5", "canonical"),
        ),
        "INVALID_SLAYER_ACTOR",
    );
    assert_error_code(
        &call_propose(
            &discussion_game,
            slayer_command(&discussion_game, "player-1", "missing", "canonical"),
        ),
        "INVALID_SLAYER_TARGET",
    );

    let miss = call_propose(
        &discussion_game,
        slayer_command(&discussion_game, "player-1", "player-2", "canonical"),
    );
    assert_eq!(miss["ok"], true, "first use failed as {miss}");
    let used_game = with_event(&discussion_game, miss["value"]["event"].clone());
    assert_error_code(
        &call_propose(
            &used_game,
            slayer_command(&used_game, "player-1", "player-5", "canonical"),
        ),
        "SLAYER_ALREADY_USED",
    );

    let invalid_registration = json!({
        "type": "useSlayerAbility",
        "payload": {
            "discussionStepId": "day:discussion",
            "expectedEventCount": event_count(&discussion_game),
            "actorPlayerId": "player-1",
            "targetPlayerId": "player-2",
            "targetRegistration": { "kind": "recluseAsDemon", "registeredCharacterId": "imp" }
        }
    });
    assert_error_code(
        &call_propose(&discussion_game, invalid_registration),
        "INVALID_SLAYER_REGISTRATION",
    );
}

#[test]
fn poisoned_and_dead_target_shots_are_spent_without_a_death() {
    let mut poisoned_game = slayer_discussion_game();
    poisoned_game["game"]["events"][3] = json!({
        "id": "evt-firstNight:poisoner",
        "type": "nightActionResolved",
        "phase": "firstNight",
        "payload": {
            "stepId": "firstNight:poisoner",
            "actorPlayerId": "player-4",
            "resolution": {
                "kind": "poison",
                "targetPlayerId": "player-1",
                "applied": true
            }
        },
        "summary": "독 지정 확정",
        "createdAt": "2026-01-01T00:00:00.000Z"
    });
    let poisoned = call_propose(
        &poisoned_game,
        slayer_command(&poisoned_game, "player-1", "player-5", "canonical"),
    );
    assert_eq!(poisoned["ok"], true, "poisoned shot failed as {poisoned}");
    assert_eq!(
        poisoned["value"]["event"]["payload"]["impairmentContext"],
        json!({
            "kind": "poisoned",
            "sourcePlayerId": "player-4",
            "sourceEventId": "evt-firstNight:poisoner"
        })
    );
    assert_eq!(
        poisoned["value"]["event"]["payload"]["outcome"],
        json!({ "kind": "noEffect", "reason": "actorPoisoned" })
    );
    let poisoned_replay = call_replay(&with_event(
        &poisoned_game,
        poisoned["value"]["event"].clone(),
    ));
    assert_eq!(
        poisoned_replay["value"]["currentStep"]["id"],
        "day:discussion"
    );
    assert_eq!(poisoned_replay["value"]["players"][4]["alive"], true);
    assert_eq!(
        poisoned_replay["value"]["ruleState"]["slayerAbility"]["spent"],
        true
    );

    let mut dead_events = slayer_discussion_game()["game"]["events"]
        .as_array()
        .unwrap()
        .clone();
    dead_events.insert(7, death_event("player-5"));
    let dead_target_game = game_with_events(Value::Array(dead_events));
    let dead_target = call_propose(
        &dead_target_game,
        slayer_command(&dead_target_game, "player-1", "player-5", "canonical"),
    );
    assert_eq!(
        dead_target["ok"], true,
        "dead-target shot failed as {dead_target}"
    );
    assert_eq!(
        dead_target["value"]["event"]["payload"]["outcome"],
        json!({ "kind": "noEffect", "reason": "targetAlreadyDead" })
    );
}

#[test]
fn replay_rejects_forged_slayer_context_and_outcome() {
    let game = slayer_discussion_game();
    let proposal = call_propose(
        &game,
        slayer_command(&game, "player-1", "player-5", "canonical"),
    );
    assert_eq!(proposal["ok"], true, "proposal failed as {proposal}");
    let mut forged_event = proposal["value"]["event"].clone();
    forged_event["payload"]["outcome"] = json!({ "kind": "noEffect", "reason": "targetNotDemon" });
    assert_error_code(
        &call_replay(&with_event(&game, forged_event)),
        "REPLAY_FAILED",
    );
}

#[test]
fn recluse_registration_is_explicit_and_scoped_to_each_shot() {
    let game = recluse_discussion_game();
    let canonical = call_propose(
        &game,
        slayer_command(&game, "player-1", "player-2", "canonical"),
    );
    assert_eq!(
        canonical["ok"], true,
        "canonical Recluse shot failed as {canonical}"
    );
    assert_eq!(
        canonical["value"]["event"]["payload"]["registrationContext"],
        json!({ "kind": "recluseDecision", "registeredAsDemon": false })
    );
    assert_eq!(
        canonical["value"]["event"]["payload"]["outcome"],
        json!({ "kind": "noEffect", "reason": "targetNotDemon" })
    );

    let demon_registration = json!({
        "type": "useSlayerAbility",
        "payload": {
            "discussionStepId": "day:discussion",
            "expectedEventCount": event_count(&game),
            "actorPlayerId": "player-1",
            "targetPlayerId": "player-2",
            "targetRegistration": { "kind": "recluseAsDemon", "registeredCharacterId": "imp" }
        }
    });
    let registered = call_propose(&game, demon_registration);
    assert_eq!(
        registered["ok"], true,
        "registered Recluse shot failed as {registered}"
    );
    assert_eq!(
        registered["value"]["event"]["payload"]["registrationContext"],
        json!({
            "kind": "recluseDecision",
            "registeredAsDemon": true,
            "registeredCharacterId": "imp"
        })
    );
    assert_eq!(
        registered["value"]["event"]["payload"]["outcome"],
        json!({ "kind": "deathPending", "playerId": "player-2" })
    );
}

#[test]
fn poisoned_recluse_cannot_register_as_the_demon_to_the_slayer() {
    let game = poisoned_recluse_discussion_game();
    let rejected = call_propose(
        &game,
        json!({
            "type": "useSlayerAbility",
            "payload": {
                "discussionStepId": "day:discussion",
                "expectedEventCount": event_count(&game),
                "actorPlayerId": "player-1",
                "targetPlayerId": "player-2",
                "targetRegistration": {
                    "kind": "recluseAsDemon",
                    "registeredCharacterId": "imp"
                }
            }
        }),
    );
    assert_eq!(
        rejected["ok"], false,
        "poisoned registration succeeded as {rejected}"
    );
    assert_eq!(rejected["error"]["code"], "INVALID_SLAYER_REGISTRATION");

    let canonical = call_propose(
        &game,
        slayer_command(&game, "player-1", "player-2", "canonical"),
    );
    assert_eq!(
        canonical["ok"], true,
        "canonical shot failed as {canonical}"
    );
    assert_eq!(
        canonical["value"]["event"]["payload"]["outcome"],
        json!({ "kind": "noEffect", "reason": "targetNotDemon" })
    );
}

fn slayer_discussion_game() -> Value {
    game_with_events(json!([
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Slayer", "actualCharacter": "slayer", "shownCharacter": "slayer" },
            { "id": "player-2", "seat": 2, "name": "Chef", "actualCharacter": "chef", "shownCharacter": "chef" },
            { "id": "player-3", "seat": 3, "name": "Empath", "actualCharacter": "empath", "shownCharacter": "empath" },
            { "id": "player-4", "seat": 4, "name": "Poisoner", "actualCharacter": "poisoner", "shownCharacter": "poisoner" },
            { "id": "player-5", "seat": 5, "name": "Imp", "actualCharacter": "imp", "shownCharacter": "imp" }
        ])),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event("phaseStepSkipped", "firstNight:poisoner"),
        phase_event("phaseStepConfirmed", "firstNight:chef"),
        phase_event("phaseStepConfirmed", "firstNight:empath"),
        phase_event("phaseStepConfirmed", "firstNight:toDay"),
        phase_event("phaseStepConfirmed", "day:announceDeaths"),
        phase_event("phaseStepConfirmed", "day:whisper")
    ]))
}

fn recluse_discussion_game() -> Value {
    game_with_events(json!([
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Slayer", "actualCharacter": "slayer", "shownCharacter": "slayer" },
            { "id": "player-2", "seat": 2, "name": "Recluse", "actualCharacter": "recluse", "shownCharacter": "recluse" },
            { "id": "player-3", "seat": 3, "name": "Empath", "actualCharacter": "empath", "shownCharacter": "empath" },
            { "id": "player-4", "seat": 4, "name": "Poisoner", "actualCharacter": "poisoner", "shownCharacter": "poisoner" },
            { "id": "player-5", "seat": 5, "name": "Imp", "actualCharacter": "imp", "shownCharacter": "imp" }
        ])),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event("phaseStepSkipped", "firstNight:poisoner"),
        phase_event("phaseStepConfirmed", "firstNight:empath"),
        phase_event("phaseStepConfirmed", "firstNight:toDay"),
        phase_event("phaseStepConfirmed", "day:announceDeaths"),
        phase_event("phaseStepConfirmed", "day:whisper")
    ]))
}

fn poisoned_recluse_discussion_game() -> Value {
    game_with_events(json!([
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Slayer", "actualCharacter": "slayer", "shownCharacter": "slayer" },
            { "id": "player-2", "seat": 2, "name": "Recluse", "actualCharacter": "recluse", "shownCharacter": "recluse" },
            { "id": "player-3", "seat": 3, "name": "Empath", "actualCharacter": "empath", "shownCharacter": "empath" },
            { "id": "player-4", "seat": 4, "name": "Poisoner", "actualCharacter": "poisoner", "shownCharacter": "poisoner" },
            { "id": "player-5", "seat": 5, "name": "Imp", "actualCharacter": "imp", "shownCharacter": "imp" }
        ])),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        {
            "id": "evt-firstNight:poisoner",
            "type": "nightActionResolved",
            "phase": "firstNight",
            "payload": {
                "stepId": "firstNight:poisoner",
                "actorPlayerId": "player-4",
                "resolution": {
                    "kind": "poison",
                    "targetPlayerId": "player-2",
                    "applied": true
                }
            },
            "summary": "독 지정 확정",
            "createdAt": "2026-01-01T00:00:00.000Z"
        },
        phase_event("phaseStepConfirmed", "firstNight:empath"),
        phase_event("phaseStepConfirmed", "firstNight:toDay"),
        phase_event("phaseStepConfirmed", "day:announceDeaths"),
        phase_event("phaseStepConfirmed", "day:whisper")
    ]))
}

fn call_propose(game: &Value, command: Value) -> Value {
    serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap()
}

fn call_replay(game: &Value) -> Value {
    serde_json::from_str(&replay_json(&game.to_string())).unwrap()
}

fn event_count(game: &Value) -> usize {
    game["game"]["events"].as_array().unwrap().len()
}

fn slayer_command(
    game: &Value,
    actor_player_id: &str,
    target_player_id: &str,
    registration_kind: &str,
) -> Value {
    json!({
        "type": "useSlayerAbility",
        "payload": {
            "discussionStepId": "day:discussion",
            "expectedEventCount": event_count(game),
            "actorPlayerId": actor_player_id,
            "targetPlayerId": target_player_id,
            "targetRegistration": { "kind": registration_kind }
        }
    })
}

fn assert_error_code(result: &Value, expected: &str) {
    assert_eq!(result["ok"], false, "expected {expected}, got {result}");
    assert_eq!(
        result["error"]["code"], expected,
        "unexpected error {result}"
    );
}

fn with_event(game: &Value, event: Value) -> Value {
    let mut events = game["game"]["events"].as_array().unwrap().clone();
    events.push(event);
    game_with_events(Value::Array(events))
}

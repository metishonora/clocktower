use super::support::*;
use crate::*;
use serde_json::{json, Value};

#[test]
fn monk_protection_does_not_prevent_an_attack_on_the_following_night() {
    let game = game_with_events(json!([
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Target", "actualCharacter": "soldier", "shownCharacter": "soldier" },
            { "id": "player-2", "seat": 2, "name": "Chef", "actualCharacter": "chef", "shownCharacter": "chef" },
            { "id": "player-3", "seat": 3, "name": "Empath", "actualCharacter": "empath", "shownCharacter": "empath" },
            { "id": "player-4", "seat": 4, "name": "Monk", "actualCharacter": "monk", "shownCharacter": "monk" },
            { "id": "player-5", "seat": 5, "name": "Imp", "actualCharacter": "imp", "shownCharacter": "imp" }
        ])),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event("phaseStepConfirmed", "firstNight:chef"),
        phase_event("phaseStepConfirmed", "firstNight:empath"),
        phase_event("phaseStepConfirmed", "firstNight:toDay"),
        phase_event("phaseStepConfirmed", "day:announceDeaths"),
        phase_event("phaseStepConfirmed", "day:whisper"),
        phase_event("phaseStepConfirmed", "day:discussion"),
        phase_event("phaseStepSkipped", "day:nomination:1"),
        no_execution_event("day:execution"),
        phase_event("phaseStepConfirmed", "day:toNight"),
        monk_protection_event("night:monk", "player-4", "player-1"),
        phase_event("phaseStepSkipped", "night:imp"),
        phase_event("phaseStepConfirmed", "night:empath"),
        phase_event("phaseStepConfirmed", "night:toDay"),
        cycle_phase_event("phaseStepConfirmed", "day2:announceDeaths"),
        cycle_phase_event("phaseStepConfirmed", "day2:whisper"),
        cycle_phase_event("phaseStepConfirmed", "day2:discussion"),
        cycle_phase_event("phaseStepSkipped", "day2:nomination:1"),
        no_execution_event("day2:execution"),
        cycle_phase_event("phaseStepConfirmed", "day2:toNight"),
        cycle_phase_event("phaseStepSkipped", "night2:monk")
    ]));
    let before_attack = replay_game(&game);
    assert_eq!(
        before_attack["ok"], true,
        "replay failed as {before_attack}"
    );
    assert_eq!(before_attack["value"]["currentStep"]["id"], "night2:imp");
    assert!(
        before_attack["value"]["ruleState"]
            .get("activeProtection")
            .is_none(),
        "prior-night Monk protection remained active: {before_attack}"
    );

    let proposal = propose(
        &game,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "night2:imp",
                "input": { "playerIds": ["player-1"] }
            }
        }),
    );
    assert_eq!(proposal["ok"], true, "proposal failed as {proposal}");
    assert_eq!(
        proposal["value"]["event"]["payload"]["resolution"]["outcome"],
        json!({ "kind": "death", "playerId": "player-1" })
    );

    let after_attack = replay_with_event(&game, proposal["value"]["event"].clone());
    assert_eq!(after_attack["ok"], true, "replay failed as {after_attack}");
    assert_eq!(after_attack["value"]["players"][0]["alive"], false);
}

#[test]
fn poison_ends_when_its_source_dies_before_the_later_information_step() {
    let game = game_with_events(json!([
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Empath", "actualCharacter": "empath", "shownCharacter": "empath" },
            { "id": "player-2", "seat": 2, "name": "Chef", "actualCharacter": "chef", "shownCharacter": "chef" },
            { "id": "player-3", "seat": 3, "name": "Soldier", "actualCharacter": "soldier", "shownCharacter": "soldier" },
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
        phase_event("phaseStepConfirmed", "day:whisper"),
        phase_event("phaseStepConfirmed", "day:discussion"),
        phase_event("phaseStepSkipped", "day:nomination:1"),
        no_execution_event("day:execution"),
        phase_event("phaseStepConfirmed", "day:toNight"),
        poison_event("night:poisoner", "player-4", "player-1"),
        imp_death_event("night:imp", "player-5", "player-4")
    ]));
    let replayed = replay_game(&game);
    assert_eq!(replayed["ok"], true, "replay failed as {replayed}");
    assert_eq!(replayed["value"]["currentStep"]["id"], "night:empath");
    assert!(
        replayed["value"]["ruleState"].get("activePoison").is_none(),
        "poison remained after its source died: {replayed}"
    );
    assert_eq!(
        replayed["value"]["currentStep"]["informationPrompt"]["activeReasons"],
        json!([])
    );
    assert_eq!(
        replayed["value"]["currentStep"]["informationPrompt"]["deliveryMode"],
        "fixed"
    );
    assert_eq!(
        replayed["value"]["currentStep"]["informationPrompt"]["numberChoices"],
        json!([{ "value": 1, "isComputed": true, "registrationJudgments": [] }])
    );

    let proposal = propose(
        &game,
        json!({
            "type": "confirmStep",
            "payload": { "stepId": "night:empath" }
        }),
    );
    assert_eq!(proposal["ok"], true, "fixed delivery failed as {proposal}");
    assert_eq!(
        proposal["value"]["event"]["payload"]["information"]["deliveryContext"],
        json!({ "type": "fixed" })
    );
}

fn propose(game: &Value, command: Value) -> Value {
    serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap()
}

fn replay_game(game: &Value) -> Value {
    serde_json::from_str(&replay_json(&game.to_string())).unwrap()
}

fn replay_with_event(game: &Value, event: Value) -> Value {
    let mut events = game["game"]["events"].as_array().unwrap().clone();
    events.push(event);
    replay_game(&game_with_events(Value::Array(events)))
}

fn cycle_phase_event(event_type: &str, step_id: &str) -> Value {
    let mut event = phase_event(event_type, step_id);
    event["phase"] = json!(if step_id.starts_with("day") {
        "day"
    } else {
        "night"
    });
    event
}

fn monk_protection_event(step_id: &str, actor_player_id: &str, target_player_id: &str) -> Value {
    json!({
        "id": format!("evt-{step_id}"),
        "type": "nightActionResolved",
        "phase": "night",
        "payload": {
            "stepId": step_id,
            "actorPlayerId": actor_player_id,
            "resolution": {
                "kind": "monkProtection",
                "targetPlayerId": target_player_id,
                "applied": true
            }
        },
        "summary": "수도승 보호 확정",
        "createdAt": "2026-01-01T00:00:00.000Z"
    })
}

fn poison_event(step_id: &str, actor_player_id: &str, target_player_id: &str) -> Value {
    json!({
        "id": format!("evt-{step_id}"),
        "type": "nightActionResolved",
        "phase": "night",
        "payload": {
            "stepId": step_id,
            "actorPlayerId": actor_player_id,
            "resolution": {
                "kind": "poison",
                "targetPlayerId": target_player_id,
                "applied": true
            }
        },
        "summary": "독 지정 확정",
        "createdAt": "2026-01-01T00:00:00.000Z"
    })
}

fn imp_death_event(step_id: &str, actor_player_id: &str, target_player_id: &str) -> Value {
    json!({
        "id": format!("evt-{step_id}"),
        "type": "nightActionResolved",
        "phase": "night",
        "payload": {
            "stepId": step_id,
            "actorPlayerId": actor_player_id,
            "resolution": {
                "kind": "impAttack",
                "targetPlayerId": target_player_id,
                "outcome": { "kind": "death", "playerId": target_player_id }
            }
        },
        "summary": "임프 공격 사망 확정",
        "createdAt": "2026-01-01T00:00:00.000Z"
    })
}

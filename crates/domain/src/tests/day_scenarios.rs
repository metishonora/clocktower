use super::support::*;
use crate::*;
use serde_json::{json, Value};

#[test]
fn day_after_death_uses_nomination_vote_steps() {
    let game = game_with_events(json!([
        setup_event(),
        death_event("player-2"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event("phaseStepConfirmed", "firstNight:washerwoman"),
        phase_event("phaseStepConfirmed", "firstNight:chef"),
        phase_event("phaseStepConfirmed", "firstNight:empath"),
        phase_event("phaseStepConfirmed", "firstNight:fortuneTeller"),
        phase_event("phaseStepConfirmed", "firstNight:toDay"),
        phase_event("phaseStepConfirmed", "day:announceDeaths")
    ]));

    let actual: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();

    assert_eq!(actual["ok"], true);
    assert_eq!(actual["value"]["currentStep"]["id"], "day:nomination:1");
    assert_eq!(
        actual["value"]["currentStep"]["requiredInput"]["kind"],
        "nominationVote"
    );
    assert_eq!(actual["value"]["players"][1]["alive"], false);
}

#[test]
fn confirming_nomination_vote_spends_valid_ghost_votes_and_updates_candidate() {
    let game = game_with_events(json!([
        setup_event(),
        death_event("player-2"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event("phaseStepConfirmed", "firstNight:washerwoman"),
        phase_event("phaseStepConfirmed", "firstNight:chef"),
        phase_event("phaseStepConfirmed", "firstNight:empath"),
        phase_event("phaseStepConfirmed", "firstNight:fortuneTeller"),
        phase_event("phaseStepConfirmed", "firstNight:toDay"),
        phase_event("phaseStepConfirmed", "day:announceDeaths")
    ]));
    let command = json!({
        "type": "confirmStep",
        "payload": {
            "stepId": "day:nomination:1",
            "input": {
                "nominatorId": "player-1",
                "nomineeId": "player-5",
                "voterIds": ["player-1", "player-2", "player-3"]
            }
        }
    });

    let proposal: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

    assert_eq!(proposal["ok"], true);
    assert_eq!(
        proposal["value"]["event"]["type"],
        "nominationVoteConfirmed"
    );
    assert_eq!(proposal["value"]["preview"]["voteCount"], 3);
    assert_eq!(
        proposal["value"]["preview"]["ghostVoteSpentPlayerIds"],
        json!(["player-2"])
    );
    assert_eq!(
        proposal["value"]["preview"]["updatesExecutionCandidate"],
        true
    );

    let mut events = game["game"]["events"].as_array().unwrap().clone();
    events.push(proposal["value"]["event"].clone());
    let replayed: Value = serde_json::from_str(&replay_json(
        &game_with_events(Value::Array(events)).to_string(),
    ))
    .unwrap();

    assert_eq!(replayed["ok"], true);
    assert_eq!(replayed["value"]["players"][1]["ghostVoteUsed"], true);
    assert_eq!(
        replayed["value"]["dayState"]["executionCandidate"],
        json!({ "nomineeId": "player-5", "voteCount": 3 })
    );
    assert_eq!(replayed["value"]["currentStep"]["id"], "day:nomination:2");
}

#[test]
fn execution_confirmation_is_separate_from_death_state() {
    let game = game_with_events(json!([
        setup_event(),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event("phaseStepConfirmed", "firstNight:washerwoman"),
        phase_event("phaseStepConfirmed", "firstNight:chef"),
        phase_event("phaseStepConfirmed", "firstNight:empath"),
        phase_event("phaseStepConfirmed", "firstNight:fortuneTeller"),
        phase_event("phaseStepConfirmed", "firstNight:toDay"),
        phase_event("phaseStepConfirmed", "day:announceDeaths"),
        nomination_vote_event(
            "day:nomination:1",
            "player-1",
            "player-5",
            ["player-1", "player-2", "player-3"]
        ),
        phase_event("phaseStepSkipped", "day:nomination:2")
    ]));
    let command = json!({
        "type": "confirmStep",
        "payload": {
            "stepId": "day:execution",
            "input": { "execute": true }
        }
    });

    let proposal: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

    assert_eq!(proposal["ok"], true);
    assert_eq!(proposal["value"]["event"]["type"], "executionConfirmed");

    let mut events = game["game"]["events"].as_array().unwrap().clone();
    events.push(proposal["value"]["event"].clone());
    let replayed: Value = serde_json::from_str(&replay_json(
        &game_with_events(Value::Array(events)).to_string(),
    ))
    .unwrap();

    assert_eq!(replayed["ok"], true);
    assert_eq!(
        replayed["value"]["dayState"]["confirmedExecution"]["playerId"],
        "player-5"
    );
    assert_eq!(replayed["value"]["players"][4]["alive"], true);
}

#[test]
fn no_execution_requires_explicit_confirmation() {
    let game = game_with_events(json!([
        setup_event(),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event("phaseStepConfirmed", "firstNight:washerwoman"),
        phase_event("phaseStepConfirmed", "firstNight:chef"),
        phase_event("phaseStepConfirmed", "firstNight:empath"),
        phase_event("phaseStepConfirmed", "firstNight:fortuneTeller"),
        phase_event("phaseStepConfirmed", "firstNight:toDay"),
        phase_event("phaseStepConfirmed", "day:announceDeaths"),
        phase_event("phaseStepSkipped", "day:nomination:1")
    ]));
    let command = json!({
        "type": "confirmStep",
        "payload": {
            "stepId": "day:execution",
            "input": { "execute": false }
        }
    });

    let actual: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

    assert_eq!(actual["ok"], true);
    assert_eq!(actual["value"]["event"]["type"], "noExecutionConfirmed");
}

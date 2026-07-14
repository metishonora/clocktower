use super::support::*;
use crate::*;
use serde_json::{json, Value};

#[test]
fn replay_derives_current_step_and_phase_overview_after_setup() {
    let game = game_with_events(json!([setup_event()]));

    let actual: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();

    assert_eq!(actual["ok"], true);
    assert_eq!(actual["value"]["phase"], "firstNight");
    assert_eq!(actual["value"]["currentStep"]["id"], "firstNight:demonInfo");
    assert_eq!(
        actual["value"]["currentStep"]["requiredInput"]["kind"],
        "characterIds"
    );
    assert_eq!(
        actual["value"]["currentStep"]["requiredInput"]["target"],
        "characters"
    );
    assert_eq!(
        actual["value"]["currentStep"]["requiredInput"]["maxSelections"],
        3
    );
    assert_eq!(actual["value"]["currentStep"]["canSkip"], false);
    assert_eq!(
        actual["value"]["phaseOverview"][0]["id"],
        "firstNight:demonInfo"
    );
    assert_eq!(actual["value"]["phaseOverview"][0]["status"], "current");
    assert_eq!(actual["value"]["phaseOverview"][1]["status"], "waiting");
}

#[test]
fn replay_marks_confirmed_skipped_and_follow_up_phase_steps() {
    let game = game_with_events(json!([
        setup_event(),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event("phaseStepConfirmed", "firstNight:washerwoman"),
        phase_event("phaseStepSkipped", "firstNight:chef"),
        phase_event("phaseStepNeedsFollowUp", "firstNight:empath")
    ]));

    let actual: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();

    assert_eq!(actual["ok"], true);
    assert_eq!(actual["value"]["currentStep"]["id"], "firstNight:empath");
    assert_eq!(actual["value"]["phaseOverview"][0]["status"], "complete");
    assert_eq!(actual["value"]["phaseOverview"][1]["status"], "complete");
    assert_eq!(actual["value"]["phaseOverview"][2]["status"], "skipped");
    assert_eq!(
        actual["value"]["phaseOverview"][3]["status"],
        "needsFollowUp"
    );
    assert_eq!(actual["value"]["phaseOverview"][4]["status"], "waiting");
}

#[test]
fn confirming_current_step_returns_canonical_event_and_advances_replay() {
    let game = game_with_events(json!([setup_event()]));
    let command = json!({
        "type": "confirmStep",
        "payload": { "stepId": "firstNight:demonInfo" }
    });

    let proposal: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();
    let mut events = game["game"]["events"].as_array().unwrap().clone();
    events.push(proposal["value"]["event"].clone());
    let replayed: Value = serde_json::from_str(&replay_json(
        &game_with_events(Value::Array(events)).to_string(),
    ))
    .unwrap();

    assert_eq!(proposal["ok"], true);
    assert_eq!(proposal["value"]["event"]["type"], "phaseStepConfirmed");
    assert_eq!(
        proposal["value"]["event"]["payload"]["stepId"],
        "firstNight:demonInfo"
    );
    assert_eq!(
        replayed["value"]["currentStep"]["id"],
        "firstNight:washerwoman"
    );
}

#[test]
fn skipping_is_rejected_for_non_skippable_phase_transition_steps() {
    let game = game_with_events(json!([
        setup_event(),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event("phaseStepConfirmed", "firstNight:washerwoman"),
        phase_event("phaseStepConfirmed", "firstNight:chef"),
        phase_event("phaseStepConfirmed", "firstNight:empath"),
        phase_event("phaseStepConfirmed", "firstNight:fortuneTeller")
    ]));
    let command = json!({
        "type": "skipStep",
        "payload": { "stepId": "firstNight:toDay" }
    });

    let actual: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

    assert_eq!(actual["ok"], false);
    assert_eq!(actual["error"]["code"], "STEP_CANNOT_BE_SKIPPED");
}

#[test]
fn phase_transition_confirmation_moves_from_first_night_to_day() {
    let game = game_with_events(json!([
        setup_event(),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event("phaseStepConfirmed", "firstNight:washerwoman"),
        phase_event("phaseStepConfirmed", "firstNight:chef"),
        phase_event("phaseStepConfirmed", "firstNight:empath"),
        phase_event("phaseStepConfirmed", "firstNight:fortuneTeller"),
        phase_event("phaseStepConfirmed", "firstNight:toDay")
    ]));

    let actual: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();

    assert_eq!(actual["ok"], true);
    assert_eq!(actual["value"]["phase"], "day");
    assert_eq!(actual["value"]["currentStep"]["id"], "day:announceDeaths");
    assert_eq!(actual["value"]["phaseOverview"][0]["status"], "current");
}

#[test]
fn phase_transition_confirmation_moves_from_night_to_next_day() {
    let game = game_with_events(json!([
        setup_event(),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event("phaseStepConfirmed", "firstNight:washerwoman"),
        phase_event("phaseStepConfirmed", "firstNight:chef"),
        phase_event("phaseStepConfirmed", "firstNight:empath"),
        phase_event("phaseStepConfirmed", "firstNight:fortuneTeller"),
        phase_event("phaseStepConfirmed", "firstNight:toDay"),
        phase_event("phaseStepConfirmed", "day:announceDeaths"),
        phase_event("phaseStepSkipped", "day:nomination:1"),
        no_execution_event("day:execution"),
        phase_event("phaseStepConfirmed", "day:toNight"),
        phase_event("phaseStepConfirmed", "night:imp"),
        phase_event("phaseStepConfirmed", "night:fortuneTeller"),
        phase_event("phaseStepConfirmed", "night:toDay")
    ]));

    let actual: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();

    assert_eq!(actual["ok"], true);
    assert_eq!(actual["value"]["phase"], "day");
    assert_eq!(actual["value"]["currentStep"]["id"], "day2:announceDeaths");
}

#[test]
fn replay_rejects_invalid_phase_step_events() {
    let game = game_with_events(json!([
        setup_event(),
        phase_event("phaseStepConfirmed", "firstNight:notARealStep")
    ]));

    let actual: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();

    assert_eq!(actual["ok"], false);
    assert_eq!(actual["error"]["code"], "REPLAY_FAILED");
}

#[test]
fn replay_rejects_phase_step_events_without_step_id() {
    let game = game_with_events(json!([
        setup_event(),
        {
            "id": "evt-missing-step-id",
            "type": "phaseStepConfirmed",
            "phase": "firstNight",
            "payload": {},
            "summary": "missing step id",
            "createdAt": "2026-01-01T00:00:00.000Z"
        }
    ]));

    let actual: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();

    assert_eq!(actual["ok"], false);
    assert_eq!(actual["error"]["code"], "MALFORMED_EVENT");
}

#[test]
fn replay_rejects_out_of_order_phase_step_events() {
    let game = game_with_events(json!([
        setup_event(),
        phase_event("phaseStepConfirmed", "firstNight:washerwoman")
    ]));

    let actual: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();

    assert_eq!(actual["ok"], false);
    assert_eq!(actual["error"]["code"], "REPLAY_FAILED");
}

#[test]
fn replay_rejects_phase_step_events_before_setup() {
    let game = game_with_events(json!([
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        setup_event()
    ]));

    let actual: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();

    assert_eq!(actual["ok"], false);
    assert_eq!(actual["error"]["code"], "REPLAY_FAILED");
}

#[test]
fn replay_rejects_phase_step_events_with_unknown_player_input() {
    let game = game_with_events(json!([
        setup_event(),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event_with_input(
            "phaseStepConfirmed",
            "firstNight:washerwoman",
            json!({ "playerIds": ["player-1", "not-a-player"] })
        )
    ]));

    let actual: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();

    assert_eq!(actual["ok"], false);
    assert_eq!(actual["error"]["code"], "INVALID_STEP_INPUT");
}

#[test]
fn replay_rejects_skipped_non_skippable_phase_transition_events() {
    let game = game_with_events(json!([
        setup_event(),
        phase_event("phaseStepSkipped", "firstNight:toDay")
    ]));

    let actual: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();

    assert_eq!(actual["ok"], false);
    assert_eq!(actual["error"]["code"], "REPLAY_FAILED");
}

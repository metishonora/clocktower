use super::support::*;
use crate::*;
use serde_json::{json, Value};

#[test]
fn imp_outcome_reason_is_a_strict_tagged_contract() {
    let game = game_with_events(json!([setup_event(), {
        "id": "forged", "type": "nightActionResolved", "phase": "night",
        "payload": { "stepId": "night:imp", "actorPlayerId": "player-5", "resolution": {
            "kind": "impAttack", "targetPlayerId": "player-1",
            "outcome": { "kind": "noDeath", "reason": "inventedReason" }
        }}, "summary": "forged", "createdAt": "2026-01-01T00:00:00.000Z"
    }]));
    let replayed: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();
    assert_eq!(replayed["ok"], false);
    assert_eq!(replayed["error"]["code"], "MALFORMED_EVENT");
}

#[test]
fn legacy_generic_night_action_event_remains_parseable_without_retroactive_death() {
    let game = game_with_events(json!([
        setup_event(),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event("phaseStepConfirmed", "firstNight:washerwoman"),
        phase_event("phaseStepConfirmed", "firstNight:chef"),
        phase_event("phaseStepConfirmed", "firstNight:empath"),
        phase_event("phaseStepConfirmed", "firstNight:fortuneTeller"),
        phase_event("phaseStepConfirmed", "firstNight:toDay"),
        phase_event("phaseStepConfirmed", "day:announceDeaths"),
        phase_event("phaseStepConfirmed", "day:whisper"),
        phase_event("phaseStepConfirmed", "day:discussion"),
        phase_event("phaseStepSkipped", "day:nomination:1"),
        no_execution_event("day:execution"),
        phase_event("phaseStepConfirmed", "day:toNight"),
        phase_event("phaseStepConfirmed", "night:imp")
    ]));
    let replayed: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();
    assert_eq!(replayed["ok"], true, "{replayed}");
    assert!(replayed["value"]["players"]
        .as_array()
        .unwrap()
        .iter()
        .all(|p| p["alive"] == true));
}

use super::support::*;
use crate::*;
use serde_json::{json, Value};

#[test]
fn replay_empty_game_file_returns_core_result() {
    let actual: Value = serde_json::from_str(&replay_json(EMPTY_GAME)).unwrap();

    assert_eq!(
        actual,
        json!({
            "ok": true,
            "value": {
                "schemaVersion": 2,
                "eventCount": 0,
                "phase": "setup",
                "players": [],
                "currentStep": null,
                "phaseOverview": [],
                "warnings": [],
                "ruleState": { "unannouncedNightDeathPlayerIds": [] },
                "gameEnd": null
            }
        })
    );
}

#[test]
fn propose_smoke_command_returns_core_result() {
    let actual: Value =
        serde_json::from_str(&propose_json(EMPTY_GAME, r#"{ "type": "smoke" }"#)).unwrap();

    assert_eq!(actual["ok"], true);
    assert_eq!(actual["value"]["event"]["type"], "smokeConfirmed");
    assert_eq!(actual["value"]["preview"]["messageKo"], "코어 계약 정상");
}

#[test]
fn command_errors_distinguish_unsupported_and_malformed_payloads() {
    let unsupported: Value =
        serde_json::from_str(&propose_json(EMPTY_GAME, r#"{ "type": "notACommand" }"#)).unwrap();
    let malformed: Value = serde_json::from_str(&propose_json(
        EMPTY_GAME,
        r#"{ "type": "createGame", "payload": {} }"#,
    ))
    .unwrap();

    assert_eq!(unsupported["error"]["code"], "UNSUPPORTED_COMMAND");
    assert_eq!(malformed["error"]["code"], "MALFORMED_COMMAND");
}

#[test]
fn event_errors_distinguish_unsupported_and_malformed_payloads() {
    let unsupported_game = game_with_events(json!([{
        "id": "event-1",
        "type": "notAnEvent",
        "phase": "setup",
        "payload": {},
        "summary": "unsupported",
        "createdAt": "2026-01-01T00:00:00.000Z"
    }]));
    let malformed_game = game_with_events(json!([{
        "id": "event-1",
        "type": "deathConfirmed",
        "phase": "night",
        "payload": {},
        "summary": "malformed",
        "createdAt": "2026-01-01T00:00:00.000Z"
    }]));

    let unsupported: Value =
        serde_json::from_str(&replay_json(&unsupported_game.to_string())).unwrap();
    let malformed: Value = serde_json::from_str(&replay_json(&malformed_game.to_string())).unwrap();

    assert_eq!(unsupported["error"]["code"], "UNSUPPORTED_EVENT");
    assert_eq!(malformed["error"]["code"], "MALFORMED_EVENT");
}

#[test]
fn execution_survival_is_a_known_v2_event_with_a_strict_payload_contract() {
    let malformed_game = game_with_events(json!([{
        "id": "event-1",
        "type": "executionSurvivalConfirmed",
        "phase": "day",
        "payload": { "stepId": "day:executionDeath" },
        "summary": "malformed execution survival",
        "createdAt": "2026-01-01T00:00:00.000Z"
    }]));

    let actual: Value = serde_json::from_str(&replay_json(&malformed_game.to_string())).unwrap();

    assert_eq!(actual["ok"], false);
    assert_eq!(actual["error"]["code"], "MALFORMED_EVENT");
    assert!(actual.get("value").is_none());
}

#[test]
fn malformed_delivered_information_is_rejected_at_json_boundaries() {
    let malformed_command = json!({
        "type": "confirmStep",
        "payload": {
            "stepId": "firstNight:chef",
            "deliveredResult": { "kind": "number", "value": "one" }
        }
    });
    let command_actual: Value =
        serde_json::from_str(&propose_json(EMPTY_GAME, &malformed_command.to_string())).unwrap();
    assert_eq!(command_actual["error"]["code"], "MALFORMED_COMMAND");

    let malformed_event = game_with_events(json!([{
        "id": "event-1",
        "type": "phaseStepConfirmed",
        "phase": "firstNight",
        "payload": {
            "stepId": "firstNight:chef",
            "input": null,
            "information": {
                "targetPlayerIds": [],
                "computedResult": { "kind": "unknown" },
                "deliveredResult": { "kind": "number", "value": 1 },
                "deliveryContext": { "type": "fixed" }
            }
        },
        "summary": "malformed information",
        "createdAt": "2026-01-01T00:00:00.000Z"
    }]));
    let event_actual: Value =
        serde_json::from_str(&replay_json(&malformed_event.to_string())).unwrap();
    assert_eq!(event_actual["error"]["code"], "MALFORMED_EVENT");
}

#[test]
fn schema_v1_fixture_is_rejected_without_partial_replay() {
    let fixture = include_str!("../../../../fixtures/schema-v1-game.json");
    let actual: Value = serde_json::from_str(&replay_json(fixture)).unwrap();

    assert_eq!(actual["ok"], false);
    assert_eq!(actual["error"]["code"], "UNSUPPORTED_SCHEMA_VERSION");
    assert!(actual.get("value").is_none());
}

#[test]
fn public_json_entrypoints_keep_representative_wire_strings() {
    assert_eq!(
        replay_json(EMPTY_GAME),
        r#"{"ok":true,"value":{"schemaVersion":2,"eventCount":0,"phase":"setup","players":[],"currentStep":null,"phaseOverview":[],"warnings":[],"ruleState":{"unannouncedNightDeathPlayerIds":[]},"gameEnd":null}}"#
    );
    assert_eq!(
        propose_json(EMPTY_GAME, r#"{ "type": "smoke" }"#),
        r#"{"ok":true,"value":{"event":{"id":"smoke-event","type":"smokeConfirmed","payload":{"source":"smoke"},"phase":"setup","summary":"스모크 명령 확인","createdAt":"1970-01-01T00:00:00.000Z"},"warnings":[],"followUpSteps":[],"preview":{"messageKo":"코어 계약 정상"}}}"#
    );
    assert_eq!(
        setup_distribution_json(r#"{"playerCount":7,"actualCharacters":["baron"]}"#),
        r#"{"ok":true,"value":{"Townsfolk":3,"Outsider":2,"Minion":1,"Demon":1}}"#
    );
}

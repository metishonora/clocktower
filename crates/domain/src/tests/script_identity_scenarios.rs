use crate::{propose_json, replay_json, setup_distribution_json};
use serde_json::{json, Value};

fn game(schema_version: u32, script_id: Option<&str>, events: Value) -> Value {
    let mut game = json!({
        "id": "game-script-contract",
        "name": "Script contract",
        "createdAt": "2026-07-21T00:00:00.000Z",
        "updatedAt": "2026-07-21T00:00:00.000Z",
        "events": events,
    });
    if let Some(script_id) = script_id {
        game["scriptId"] = json!(script_id);
    }
    json!({ "schemaVersion": schema_version, "game": game })
}

#[test]
fn legacy_v2_without_script_id_replays_as_trouble_brewing() {
    let actual: Value =
        serde_json::from_str(&replay_json(&game(2, None, json!([])).to_string())).unwrap();

    assert_eq!(actual["ok"], true, "{actual}");
    assert_eq!(actual["value"]["schemaVersion"], 2);
    assert_eq!(actual["value"]["scriptId"], "troubleBrewing");
    assert_eq!(actual["value"]["phase"], "setup");
}

#[test]
fn explicit_v3_trouble_brewing_replays_with_canonical_identity() {
    let actual: Value = serde_json::from_str(&replay_json(
        &game(3, Some("troubleBrewing"), json!([])).to_string(),
    ))
    .unwrap();

    assert_eq!(actual["ok"], true, "{actual}");
    assert_eq!(actual["value"]["schemaVersion"], 3);
    assert_eq!(actual["value"]["scriptId"], "troubleBrewing");
}

#[test]
fn v3_requires_a_known_script_id() {
    for candidate in [
        game(3, None, json!([])),
        game(3, Some("badScript"), json!([])),
    ] {
        let actual: Value = serde_json::from_str(&replay_json(&candidate.to_string())).unwrap();
        assert_eq!(actual["ok"], false, "{candidate}");
        assert_eq!(actual["error"]["code"], "MALFORMED_GAME_FILE");
    }
}

#[test]
fn schema_v2_cannot_claim_a_script_identity() {
    let actual: Value = serde_json::from_str(&replay_json(
        &game(2, Some("sectsAndViolets"), json!([])).to_string(),
    ))
    .unwrap();

    assert_eq!(actual["ok"], false, "{actual}");
    assert_eq!(actual["error"]["code"], "MALFORMED_GAME_FILE");
}

#[test]
fn empty_sects_and_violets_game_replays_without_entering_tb_rules() {
    let actual: Value = serde_json::from_str(&replay_json(
        &game(3, Some("sectsAndViolets"), json!([])).to_string(),
    ))
    .unwrap();

    assert_eq!(actual["ok"], true, "{actual}");
    assert_eq!(actual["value"]["scriptId"], "sectsAndViolets");
    assert_eq!(actual["value"]["phase"], "setup");
    assert_eq!(actual["value"]["currentStep"], Value::Null);
}

#[test]
fn sects_and_violets_event_log_is_not_replayed_as_trouble_brewing() {
    let setup = json!({
        "id": "setup-1",
        "type": "setupConfirmed",
        "payload": { "players": [
            { "id": "player-1", "seat": 1, "name": "A", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
            { "id": "player-2", "seat": 2, "name": "B", "actualCharacter": "chef", "shownCharacter": "chef" },
            { "id": "player-3", "seat": 3, "name": "C", "actualCharacter": "empath", "shownCharacter": "empath" },
            { "id": "player-4", "seat": 4, "name": "D", "actualCharacter": "poisoner", "shownCharacter": "poisoner" },
            { "id": "player-5", "seat": 5, "name": "E", "actualCharacter": "imp", "shownCharacter": "imp" }
        ]},
        "phase": "setup",
        "summary": "setup",
        "createdAt": "2026-07-21T00:00:00.000Z"
    });
    let actual: Value = serde_json::from_str(&replay_json(
        &game(3, Some("sectsAndViolets"), json!([setup])).to_string(),
    ))
    .unwrap();

    assert_eq!(actual["ok"], false, "{actual}");
    assert_eq!(actual["error"]["code"], "EVENT_NOT_SUPPORTED_BY_SCRIPT");
}

#[test]
fn sects_and_violets_commands_do_not_fall_through_to_tb_validation() {
    let empty = game(3, Some("sectsAndViolets"), json!([]));
    let create = json!({
        "type": "createGame",
        "payload": { "players": [
            { "seat": 1, "name": "A", "actualCharacter": "washerwoman" },
            { "seat": 2, "name": "B", "actualCharacter": "chef" },
            { "seat": 3, "name": "C", "actualCharacter": "empath" },
            { "seat": 4, "name": "D", "actualCharacter": "poisoner" },
            { "seat": 5, "name": "E", "actualCharacter": "imp" }
        ]}
    });
    let created: Value =
        serde_json::from_str(&propose_json(&empty.to_string(), &create.to_string())).unwrap();
    assert_eq!(created["error"]["code"], "SCRIPT_NOT_IMPLEMENTED");

    let slayer = json!({
        "type": "useSlayerAbility",
        "payload": {
            "discussionStepId": "day:1:discussion",
            "expectedEventCount": 0,
            "actorPlayerId": "player-1",
            "targetPlayerId": "player-2",
            "targetRegistration": { "kind": "canonical" }
        }
    });
    let used: Value =
        serde_json::from_str(&propose_json(&empty.to_string(), &slayer.to_string())).unwrap();
    assert_eq!(used["error"]["code"], "COMMAND_NOT_SUPPORTED_BY_SCRIPT");

    let smoked: Value =
        serde_json::from_str(&propose_json(&empty.to_string(), r#"{ "type": "smoke" }"#)).unwrap();
    assert_eq!(smoked["error"]["code"], "COMMAND_NOT_SUPPORTED_BY_SCRIPT");
}

#[test]
fn setup_distribution_requires_script_and_keeps_script_specific_behavior_separate() {
    let missing: Value = serde_json::from_str(&setup_distribution_json(
        r#"{"playerCount":7,"actualCharacters":[]}"#,
    ))
    .unwrap();
    assert_eq!(missing["error"]["code"], "MALFORMED_REQUEST");

    let tb: Value = serde_json::from_str(&setup_distribution_json(
        r#"{"scriptId":"troubleBrewing","playerCount":7,"actualCharacters":["baron"]}"#,
    ))
    .unwrap();
    assert_eq!(tb["value"]["Townsfolk"], 3);
    assert_eq!(tb["value"]["Outsider"], 2);

    let empty_sv: Value = serde_json::from_str(&setup_distribution_json(
        r#"{"scriptId":"sectsAndViolets","playerCount":7,"actualCharacters":[]}"#,
    ))
    .unwrap();
    assert_eq!(empty_sv["value"]["Townsfolk"], 5);
    assert_eq!(empty_sv["value"]["Outsider"], 0);

    let sv_character: Value = serde_json::from_str(&setup_distribution_json(
        r#"{"scriptId":"sectsAndViolets","playerCount":7,"actualCharacters":["clockmaker"]}"#,
    ))
    .unwrap();
    assert_eq!(sv_character["error"]["code"], "SCRIPT_NOT_IMPLEMENTED");
}

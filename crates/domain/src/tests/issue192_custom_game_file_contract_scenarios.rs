use crate::replay_json;
use serde_json::{json, Value};

fn game_v4(script: Value) -> Value {
    json!({
        "schemaVersion": 4,
        "game": {
            "script": script,
            "id": "game-custom-contract",
            "name": "Contract game",
            "createdAt": "2026-09-02T00:00:00.000Z",
            "updatedAt": "2026-09-02T00:00:00.000Z",
            "events": []
        }
    })
}

fn custom_definition(character_ids: Value) -> Value {
    json!({
        "type": "custom",
        "definition": {
            "id": "custom-stable-id",
            "name": "Mixed roster",
            "characterIds": character_ids
        }
    })
}

fn replay(value: &Value) -> Value {
    serde_json::from_str(&replay_json(&value.to_string())).unwrap()
}

#[test]
fn schema_v4_official_references_replay_without_changing_rule_ownership() {
    for script_id in ["troubleBrewing", "sectsAndViolets", "badMoonRising"] {
        let actual = replay(&game_v4(json!({
            "type": "official",
            "scriptId": script_id
        })));

        assert_eq!(actual["ok"], true, "{script_id}: {actual}");
        assert_eq!(actual["value"]["schemaVersion"], 4);
        assert_eq!(actual["value"]["scriptId"], script_id);
        assert_eq!(actual["value"]["phase"], "setup");
    }
}

#[test]
fn structurally_valid_custom_snapshot_enters_custom_setup_without_official_dispatch() {
    let actual = replay(&game_v4(custom_definition(json!([
        "washerwoman",
        "clockmaker",
        "imp"
    ]))));

    assert_eq!(actual["ok"], true, "{actual}");
    assert_eq!(actual["value"]["phase"], "setup");
    assert_eq!(actual["value"]["script"]["type"], "custom");
    assert!(actual["value"].get("scriptId").is_none());
}

#[test]
fn canonical_custom_character_ids_reach_custom_setup() {
    let actual = replay(&game_v4(custom_definition(json!(["imp", "clockmaker"]))));

    assert_eq!(actual["ok"], true, "{actual}");
    assert_eq!(actual["value"]["phase"], "setup");
}

#[test]
fn malformed_custom_definition_fields_are_rejected_explicitly() {
    let candidates = [
        custom_definition(json!(["washerwoman", ""])),
        json!({
            "type": "custom",
            "definition": {
                "id": " ",
                "name": "Mixed roster",
                "characterIds": []
            }
        }),
        json!({
            "type": "custom",
            "definition": {
                "id": "custom-stable-id",
                "name": "\n\t",
                "characterIds": []
            }
        }),
        json!({
            "type": "custom",
            "definition": {
                "id": "custom-stable-id",
                "name": "Mixed roster",
                "characterIds": "washerwoman"
            }
        }),
        json!({
            "type": "custom",
            "definition": {
                "id": "custom-stable-id",
                "name": "Mixed roster",
                "characterIds": [],
                "revision": 1
            }
        }),
        json!({
            "type": "custom",
            "definition": {
                "id": "custom-stable-id",
                "name": "Mixed roster",
                "characterIds": [],
                "customScriptSchemaVersion": 1
            }
        }),
    ];

    for candidate in candidates {
        let actual = replay(&game_v4(candidate));
        assert_eq!(
            actual["error"]["code"], "MALFORMED_CUSTOM_SCRIPT_DEFINITION",
            "{actual}"
        );
    }
}

#[test]
fn duplicate_custom_character_ids_are_rejected_explicitly() {
    let actual = replay(&game_v4(custom_definition(json!([
        "washerwoman",
        "clockmaker",
        "washerwoman"
    ]))));

    assert_eq!(
        actual["error"]["code"], "DUPLICATE_CUSTOM_SCRIPT_CHARACTER",
        "{actual}"
    );
}

#[test]
fn empty_custom_character_list_is_structurally_valid() {
    let actual = replay(&game_v4(custom_definition(json!([]))));

    assert_eq!(actual["ok"], true, "{actual}");
    assert_eq!(actual["value"]["phase"], "setup");
}

#[test]
fn schema_v4_rejects_mixed_missing_and_unknown_script_references() {
    let mut mixed = game_v4(json!({
        "type": "official",
        "scriptId": "troubleBrewing"
    }));
    mixed["game"]["scriptId"] = json!("troubleBrewing");

    let candidates = [
        mixed,
        game_v4(json!({ "type": "unknown", "scriptId": "troubleBrewing" })),
        game_v4(json!({ "type": "official", "scriptId": "notOfficial" })),
        game_v4(json!({
            "type": "official",
            "scriptId": "troubleBrewing",
            "definition": {
                "id": "custom-stable-id",
                "name": "Mixed roster",
                "characterIds": []
            }
        })),
        game_v4(json!({
            "type": "custom",
            "scriptId": "troubleBrewing",
            "definition": {
                "id": "custom-stable-id",
                "name": "Mixed roster",
                "characterIds": []
            }
        })),
        game_v4(json!({ "type": "official" })),
        game_v4(json!({ "type": "custom" })),
        json!({
            "schemaVersion": 4,
            "game": {
                "id": "missing-script",
                "name": "Missing",
                "createdAt": "2026-09-02T00:00:00.000Z",
                "updatedAt": "2026-09-02T00:00:00.000Z",
                "events": []
            }
        }),
    ];

    for candidate in candidates {
        let actual = replay(&candidate);
        assert_eq!(actual["error"]["code"], "MALFORMED_GAME_FILE", "{actual}");
    }
}

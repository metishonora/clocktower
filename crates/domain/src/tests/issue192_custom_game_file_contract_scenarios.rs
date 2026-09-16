use crate::{propose_json, replay_json};
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

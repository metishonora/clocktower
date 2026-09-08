use crate::{propose_json, replay_json};
use serde_json::{json, Value};
fn custom_event() -> Value {
    json!({
        "id": "custom-action-1",
        "type": "customActionConfirmed",
        "phase": "firstNight",
        "payload": {
            "stepId": "firstNight:fixture:player-1:setup-1",
            "actionRef": {
                "kind": "character",
                "characterId": "washerwoman",
                "actionId": "learnTownsfolk"
            },
            "abilityUse": {
                "ownerPlayerId": "player-1",
                "characterId": "washerwoman",
                "abilityInstanceId": "setup-1:player-1"
            },
            "input": null,
            "result": { "kind": "noEffect" }
        },
        "summary": "custom action",
        "createdAt": "2026-09-07T00:00:00.000Z"
    })
}
#[test]
fn official_game_rejects_custom_action_events_without_changing_official_event_shape() {
    let response: Value = serde_json::from_str(&crate::replay_json(
        &json!({
            "schemaVersion": 2,
            "game": {
                "id": "official-206",
                "name": "Official",
                "createdAt": "2026-09-07T00:00:00.000Z",
                "updatedAt": "2026-09-07T00:00:00.000Z",
                "events": [custom_event()]
            }
        })
        .to_string(),
    ))
    .unwrap();
    assert_eq!(response["error"]["code"], "EVENT_NOT_SUPPORTED_BY_SCRIPT");

    let official = crate::replay_json(
        r#"{
          "schemaVersion": 2,
          "game": {
            "id": "official-206-empty",
            "name": "Official",
            "createdAt": "2026-09-07T00:00:00.000Z",
            "updatedAt": "2026-09-07T00:00:00.000Z",
            "events": []
          }
        }"#,
    );
    assert!(official.contains(r#""scriptId":"troubleBrewing""#));
}

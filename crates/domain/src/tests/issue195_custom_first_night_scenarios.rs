use crate::{propose_json, replay_json};
use serde_json::{json, Value};
fn system(action_id: &str) -> Value {
    json!({ "kind": "system", "actionId": action_id })
}
fn propose_command(game: &Value, command: Value) -> Value {
    serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap()
}
#[test]
fn custom_definition_plan_replays_while_official_setup_shape_stays_exact() {
    let official = json!({
        "schemaVersion": 4,
        "game": {
            "script": { "type": "official", "scriptId": "troubleBrewing" },
            "id": "official-regression",
            "name": "Official regression",
            "createdAt": "2026-09-04T00:00:00.000Z",
            "updatedAt": "2026-09-04T00:00:00.000Z",
            "events": [],
        }
    });
    let official_create = propose_command(
        &official,
        json!({
            "type": "createGame",
            "payload": {
                "players": [
                    { "seat": 1, "name": "A", "actualCharacter": "washerwoman" },
                    { "seat": 2, "name": "B", "actualCharacter": "chef" },
                    { "seat": 3, "name": "C", "actualCharacter": "empath" },
                    { "seat": 4, "name": "D", "actualCharacter": "fortuneTeller" },
                    { "seat": 5, "name": "E", "actualCharacter": "soldier" },
                    { "seat": 6, "name": "F", "actualCharacter": "poisoner" },
                    { "seat": 7, "name": "G", "actualCharacter": "imp" }
                ]
            }
        }),
    );
    assert_eq!(official_create["ok"], true, "{official_create}");
    assert!(official_create["value"]["event"]["payload"]
        .get("firstNightOrderPlan")
        .is_none(),);

    let mut official_with_custom_provenance = official;
    official_with_custom_provenance["game"]["events"] = json!([
        official_create["value"]["event"].clone(),
        {
            "id": "phase-step-2",
            "type": "phaseStepConfirmed",
            "phase": "firstNight",
            "payload": {
                "stepId": "firstNight:minionInfo",
                "actionRef": system("minionInfo")
            },
            "summary": "custom provenance must not enter an official runtime",
            "createdAt": "2026-09-04T00:00:00.000Z"
        }
    ]);
    let rejected: Value =
        serde_json::from_str(&replay_json(&official_with_custom_provenance.to_string())).unwrap();
    assert_eq!(
        rejected["error"]["code"], "EVENT_NOT_SUPPORTED_BY_SCRIPT",
        "{rejected}",
    );
}

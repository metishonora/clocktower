use crate::{propose_json, replay_json};
use serde_json::{json, Value};

use super::support::snv_demon_bluff_input;

fn setup_event() -> Value {
    json!({
        "id": "setup-issue-103",
        "type": "setupConfirmed",
        "phase": "setup",
        "payload": { "players": [
            { "id": "player-1", "seat": 1, "name": "Sweetheart", "actualCharacter": "oracle", "shownCharacter": "oracle" },
            { "id": "player-2", "seat": 2, "name": "Barber", "actualCharacter": "barber", "shownCharacter": "barber" },
            { "id": "player-3", "seat": 3, "name": "Klutz", "actualCharacter": "klutz", "shownCharacter": "klutz" },
            { "id": "player-4", "seat": 4, "name": "Clockmaker", "actualCharacter": "clockmaker", "shownCharacter": "clockmaker" },
            { "id": "player-5", "seat": 5, "name": "Savant", "actualCharacter": "cerenovus", "shownCharacter": "cerenovus" },
            { "id": "player-6", "seat": 6, "name": "Pit-Hag", "actualCharacter": "pitHag", "shownCharacter": "pitHag" },
            { "id": "player-7", "seat": 7, "name": "Vigormortis", "actualCharacter": "vigormortis", "shownCharacter": "vigormortis" }
        ] },
        "summary": "issue 103 setup",
        "createdAt": "2026-07-28T00:00:00.000Z"
    })
}

fn game(events: Vec<Value>) -> Value {
    json!({
        "schemaVersion": 3,
        "game": {
            "id": "game-issue-103",
            "name": "Death consequences",
            "scriptId": "sectsAndViolets",
            "createdAt": "2026-07-28T00:00:00.000Z",
            "updatedAt": "2026-07-28T00:00:00.000Z",
            "events": events
        }
    })
}

fn replay(events: &[Value]) -> Value {
    serde_json::from_str(&replay_json(&game(events.to_vec()).to_string())).unwrap()
}

fn propose(events: &[Value], command: Value) -> Value {
    serde_json::from_str(&propose_json(
        &game(events.to_vec()).to_string(),
        &command.to_string(),
    ))
    .unwrap()
}

fn append(events: &mut Vec<Value>, command: Value) -> Value {
    let proposal = propose(events, command);
    assert_eq!(proposal["ok"], true, "proposal failed: {proposal}");
    events.push(proposal["value"]["event"].clone());
    proposal
}

fn default_command(state: &Value, demon_target: &str) -> Value {
    let step = &state["value"]["currentStep"];
    let step_id = step["id"].as_str().expect("step id");
    match step["requiredInput"]["kind"].as_str().unwrap_or("none") {
        "madnessAssignment" => {
            json!({"type":"confirmStep","payload":{"stepId":step_id,"input":{"playerIds":["player-4"],"characterId":"clockmaker"}}})
        }
        "nomination" => json!({ "type": "skipStep", "payload": { "stepId": step_id } }),
        "executionDecision" => {
            json!({ "type": "confirmStep", "payload": { "stepId": step_id, "input": { "execute": false } } })
        }
        "characterTransformation" => json!({
            "type": "confirmStep",
            "payload": { "stepId": step_id, "input": { "playerIds": ["player-6"], "characterIds": ["pitHag"] } }
        }),
        "characterIds" if step_id == "firstNight:demonInfo" => json!({
            "type": "confirmStep",
            "payload": { "stepId": step_id, "input": snv_demon_bluff_input(step) }
        }),
        "playerIds" if step_id.contains(":demon:") => json!({
            "type": "confirmStep",
            "payload": { "stepId": step_id, "input": { "playerIds": [demon_target] } }
        }),
        "playerIds" if step["character"] == "dreamer" => {
            let check = &step["informationPrompt"]["targetChecks"][0];
            json!({
                "type": "confirmStep",
                "payload": {
                    "stepId": step_id,
                    "input": { "playerIds": check["targetPlayerIds"] },
                    "deliveredResult": check["choices"][0]["result"]
                }
            })
        }
        "number" => json!({
            "type": "confirmStep",
            "payload": {
                "stepId": step_id,
                "input": null,
                "deliveredResult": {
                    "kind": "number",
                    "value": step["informationPrompt"]["numberChoices"][0]["value"].as_u64().unwrap_or(100)
                }
            }
        }),
        _ if step["support"] == "manual" => json!({
            "type": "resolveManualStep",
            "payload": { "stepId": step_id, "outcome": "handled" }
        }),
        _ => json!({ "type": "confirmStep", "payload": { "stepId": step_id, "input": null } }),
    }
}

fn advance_until(
    events: &mut Vec<Value>,
    demon_target: &str,
    wanted: impl Fn(&Value) -> bool,
) -> Value {
    for _ in 0..96 {
        let state = replay(events);
        assert_eq!(state["ok"], true, "replay failed: {state}");
        if wanted(&state) {
            return state;
        }
        let command = default_command(&state, demon_target);
        let proposal = propose(events, command.clone());
        assert_eq!(
            proposal["ok"], true,
            "proposal failed for state {state} with {command}: {proposal}"
        );
        events.push(proposal["value"]["event"].clone());
    }
    panic!("wanted state was not reached")
}

#[test]
fn official_old_cerenovus_madness_must_not_revive_on_reacquisition() {
    let mut events = vec![setup_event()];
    let pit = advance_until(&mut events, "player-1", |s| {
        s["value"]["currentStep"]["character"] == "pitHag" && s["value"]["phase"] == "night"
    });
    let assignments = |s: &Value| {
        s["value"]["madnessAssignments"]
            .as_array()
            .into_iter()
            .flatten()
            .filter(|a| a["sourceCharacterId"] == "cerenovus")
            .cloned()
            .collect::<Vec<_>>()
    };
    let before = assignments(&pit);
    assert_eq!(before.len(), 1);
    let old_id = before[0]["assignmentId"].clone();
    append(
        &mut events,
        json!({"type":"confirmStep","payload":{"stepId":pit["value"]["currentStep"]["id"],"input":{"playerIds":["player-5"],"characterIds":["artist"]}}}),
    );
    assert!(assignments(&replay(&events)).is_empty());
    let pit = advance_until(&mut events, "player-1", |s| {
        s["value"]["currentStep"]["character"] == "pitHag" && s["value"]["phase"] == "night"
    });
    append(
        &mut events,
        json!({"type":"confirmStep","payload":{"stepId":pit["value"]["currentStep"]["id"],"input":{"playerIds":["player-5"],"characterIds":["cerenovus"]}}}),
    );
    let after = replay(&events);
    assert_eq!(after["ok"], true, "{after}");
    assert_eq!(after["value"]["players"][4]["actualCharacter"], "cerenovus");
    let stale = assignments(&after);
    assert!(
        stale.is_empty(),
        "BUG: old Cerenovus assignment {old_id} revived on new instance: {stale:?}"
    );
}

use crate::{propose_json, replay_json};
use serde_json::{json, Value};

use super::support::snv_demon_bluff_input;

fn setup_event(players: Value) -> Value {
    json!({
        "id": "setup-1",
        "type": "setupConfirmed",
        "phase": "setup",
        "payload": { "players": players },
        "summary": "초기 설정 확정: 7명",
        "createdAt": "2026-07-23T00:00:00.000Z"
    })
}

fn standard_setup() -> Value {
    setup_event(json!([
        { "id": "player-1", "seat": 1, "name": "Snake", "actualCharacter": "snakeCharmer", "shownCharacter": "snakeCharmer" },
        { "id": "player-2", "seat": 2, "name": "Clock", "actualCharacter": "clockmaker", "shownCharacter": "clockmaker" },
        { "id": "player-3", "seat": 3, "name": "Dreamer", "actualCharacter": "dreamer", "shownCharacter": "dreamer" },
        { "id": "player-4", "seat": 4, "name": "Seamstress", "actualCharacter": "seamstress", "shownCharacter": "seamstress" },
        { "id": "player-5", "seat": 5, "name": "Mathematician", "actualCharacter": "mathematician", "shownCharacter": "mathematician" },
        { "id": "player-6", "seat": 6, "name": "Pit-Hag", "actualCharacter": "pitHag", "shownCharacter": "pitHag" },
        { "id": "player-7", "seat": 7, "name": "Vigormortis", "actualCharacter": "vigormortis", "shownCharacter": "vigormortis" }
    ]))
}

fn game(events: Vec<Value>) -> Value {
    json!({
        "schemaVersion": 3,
        "game": {
            "id": "game-issue-101",
            "name": "Snake Charmer",
            "scriptId": "sectsAndViolets",
            "createdAt": "2026-07-23T00:00:00.000Z",
            "updatedAt": "2026-07-23T00:00:00.000Z",
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

fn advance_to_snake_charmer(events: &mut Vec<Value>, later_night_only: bool) -> Value {
    for _ in 0..96 {
        let state = replay(events);
        assert_eq!(state["ok"], true, "replay failed: {state}");
        let step = &state["value"]["currentStep"];
        if step["character"] == "snakeCharmer"
            && (!later_night_only || state["value"]["phase"] == "night")
        {
            return state;
        }
        let step_id = step["id"].as_str().expect("step id");
        let command = if step["requiredInput"]["kind"] == "nomination" {
            json!({ "type": "skipStep", "payload": { "stepId": step_id } })
        } else if step["requiredInput"]["kind"] == "executionDecision" {
            json!({ "type": "confirmStep", "payload": { "stepId": step_id, "input": { "execute": false } } })
        } else if step["requiredInput"]["kind"] == "characterTransformation" {
            json!({ "type": "confirmStep", "payload": { "stepId": step_id, "input": { "playerIds": ["player-6"], "characterIds": ["pitHag"] } } })
        } else if step_id == "firstNight:demonInfo" {
            json!({ "type": "confirmStep", "payload": { "stepId": step_id, "input": snv_demon_bluff_input(step) } })
        } else if step["support"] == "manual" {
            json!({ "type": "resolveManualStep", "payload": { "stepId": step_id, "outcome": "handled" } })
        } else if step["id"].as_str().is_some_and(|id| id.contains(":demon:")) {
            json!({ "type": "confirmStep", "payload": { "stepId": step_id, "input": { "playerIds": ["player-2"] } } })
        } else if step["character"] == "dreamer" {
            let check = &step["informationPrompt"]["targetChecks"][0];
            json!({ "type": "confirmStep", "payload": { "stepId": step_id, "input": { "playerIds": check["targetPlayerIds"] }, "deliveredResult": check["choices"][0]["result"] } })
        } else if step["character"] == "seamstress" {
            json!({ "type": "skipStep", "payload": { "stepId": step_id } })
        } else {
            json!({ "type": "confirmStep", "payload": { "stepId": step_id, "input": null } })
        };
        append(events, command);
    }
    panic!("did not reach Snake Charmer step");
}

fn advance_to_character(events: &mut Vec<Value>, character: &str) -> Value {
    for _ in 0..48 {
        let state = replay(events);
        assert_eq!(state["ok"], true, "replay failed: {state}");
        let step = &state["value"]["currentStep"];
        if step["character"] == character {
            return state;
        }
        let step_id = step["id"].as_str().expect("step id");
        let command = if step["requiredInput"]["kind"] == "nomination" {
            json!({ "type": "skipStep", "payload": { "stepId": step_id } })
        } else if step["requiredInput"]["kind"] == "executionDecision" {
            json!({ "type": "confirmStep", "payload": { "stepId": step_id, "input": { "execute": false } } })
        } else if step["requiredInput"]["kind"] == "characterTransformation" {
            json!({ "type": "confirmStep", "payload": { "stepId": step_id, "input": { "playerIds": [step["playerId"]], "characterIds": ["pitHag"] } } })
        } else if step["character"] == "dreamer" {
            let check = &step["informationPrompt"]["targetChecks"][0];
            json!({ "type": "confirmStep", "payload": { "stepId": step_id, "input": { "playerIds": check["targetPlayerIds"] }, "deliveredResult": check["choices"][0]["result"] } })
        } else if step["character"] == "seamstress" {
            json!({ "type": "skipStep", "payload": { "stepId": step_id } })
        } else if step["support"] == "manual" {
            json!({ "type": "resolveManualStep", "payload": { "stepId": step_id, "outcome": "handled" } })
        } else {
            json!({ "type": "confirmStep", "payload": { "stepId": step_id, "input": null } })
        };
        append(events, command);
    }
    panic!("did not reach {character}");
}

fn snake_step_id(state: &Value) -> &str {
    state["value"]["currentStep"]["id"]
        .as_str()
        .expect("Snake Charmer step id")
}

#[test]
fn official_snake_poison_ends_on_source_change() {
    let mut events = vec![standard_setup()];
    let first_snake = advance_to_snake_charmer(&mut events, false);
    append(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": snake_step_id(&first_snake),
                "input": { "playerIds": ["player-6"] }
            }
        }),
    );
    let snake = advance_to_snake_charmer(&mut events, true);
    let swap = append(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": snake_step_id(&snake),
                "input": { "playerIds": ["player-7"] }
            }
        }),
    );
    assert_eq!(
        swap["value"]["event"]["payload"]["outcome"]["kind"], "swap",
        "{swap}"
    );

    let pit_hag = advance_to_character(&mut events, "pitHag");
    let change = append(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": pit_hag["value"]["currentStep"]["id"],
                "input": { "playerIds": ["player-7"], "characterIds": ["witch"] }
            }
        }),
    );
    assert_eq!(
        change["value"]["event"]["payload"]["outcome"]["kind"], "changed",
        "{change}"
    );

    let after = replay(&events);
    assert_eq!(after["ok"], true, "{after}");
    assert!(
        !after["value"]["ruleState"]["activeImpairments"]
            .as_array()
            .is_some_and(|a| a
                .iter()
                .any(|i| i["playerId"] == "player-7" && i["sourceCharacterId"] == "snakeCharmer")),
        "BUG: official runtime retains Snake Charmer poison after character replacement"
    );
}

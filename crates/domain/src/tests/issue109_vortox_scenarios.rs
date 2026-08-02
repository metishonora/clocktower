use crate::{propose_json, replay_json};
use serde_json::{json, Value};

use super::support::snv_demon_bluff_input;

fn setup_event() -> Value {
    json!({
        "id": "setup-109",
        "type": "setupConfirmed",
        "phase": "setup",
        "payload": { "players": [
            { "id": "player-1", "seat": 1, "name": "Dreamer", "actualCharacter": "dreamer", "shownCharacter": "dreamer" },
            { "id": "player-2", "seat": 2, "name": "Seamstress", "actualCharacter": "seamstress", "shownCharacter": "seamstress" },
            { "id": "player-3", "seat": 3, "name": "Sage", "actualCharacter": "sage", "shownCharacter": "sage" },
            { "id": "player-4", "seat": 4, "name": "Clockmaker", "actualCharacter": "clockmaker", "shownCharacter": "clockmaker" },
            { "id": "player-5", "seat": 5, "name": "Oracle", "actualCharacter": "oracle", "shownCharacter": "oracle" },
            { "id": "player-6", "seat": 6, "name": "Evil Twin", "actualCharacter": "evilTwin", "shownCharacter": "evilTwin" },
            { "id": "player-7", "seat": 7, "name": "Vortox", "actualCharacter": "vortox", "shownCharacter": "vortox" }
        ]},
        "summary": "초기 설정 확정: 7명",
        "createdAt": "2026-07-31T00:00:00.000Z"
    })
}

fn game(events: &[Value]) -> Value {
    json!({
        "schemaVersion": 3,
        "game": {
            "id": "game-issue-109",
            "name": "Issue 109 Vortox",
            "scriptId": "sectsAndViolets",
            "createdAt": "2026-07-31T00:00:00.000Z",
            "updatedAt": "2026-07-31T00:00:00.000Z",
            "events": events
        }
    })
}

fn replay(events: &[Value]) -> Value {
    serde_json::from_str(&replay_json(&game(events).to_string())).unwrap()
}

fn propose(events: &[Value], command: Value) -> Value {
    serde_json::from_str(&propose_json(
        &game(events).to_string(),
        &command.to_string(),
    ))
    .unwrap()
}

fn append(events: &mut Vec<Value>, command: Value) -> Value {
    let proposal = propose(events, command);
    assert_eq!(proposal["ok"], true, "{proposal}");
    events.push(proposal["value"]["event"].clone());
    proposal
}

fn advance_until(events: &mut Vec<Value>, target: &str) -> Value {
    for _ in 0..160 {
        let state = replay(events);
        assert_eq!(state["ok"], true, "{state}");
        let step = &state["value"]["currentStep"];
        if step["id"] == target {
            return state;
        }
        let id = step["id"].as_str().expect("current step id");
        let command = if step["requiredInput"]["kind"] == "nomination" {
            json!({ "type": "skipStep", "payload": { "stepId": id } })
        } else if step["requiredInput"]["kind"] == "executionDecision" {
            json!({ "type": "confirmStep", "payload": { "stepId": id, "input": { "execute": false } } })
        } else if id == "firstNight:demonInfo" {
            json!({ "type": "confirmStep", "payload": { "stepId": id, "input": snv_demon_bluff_input(step) } })
        } else if step["character"] == "vortox" {
            json!({ "type": "confirmStep", "payload": { "stepId": id, "input": { "playerIds": ["player-3"] } } })
        } else if step["character"] == "evilTwin" {
            json!({ "type": "confirmStep", "payload": { "stepId": id, "input": { "playerIds": ["player-1"] } } })
        } else if matches!(
            step["character"].as_str(),
            Some("dreamer" | "seamstress" | "sage")
        ) {
            let check = &step["informationPrompt"]["targetChecks"][0];
            let input = if step["character"] == "sage" {
                Value::Null
            } else {
                json!({ "playerIds": check["targetPlayerIds"] })
            };
            json!({ "type": "confirmStep", "payload": {
                "stepId": id,
                "input": input,
                "deliveredResult": check["choices"][0]["result"]
            }})
        } else if step["informationPrompt"]["deliveryMode"] == "selectable" {
            let delivered = if step["informationPrompt"]["computedResult"]["kind"] == "number" {
                let value = step["informationPrompt"]["numberChoices"][0]["value"]
                    .as_u64()
                    .unwrap_or(100);
                json!({ "kind": "number", "value": value })
            } else {
                json!({ "kind": "boolean", "value": step["informationPrompt"]["booleanChoices"][0]["value"] })
            };
            json!({ "type": "confirmStep", "payload": { "stepId": id, "input": null, "deliveredResult": delivered } })
        } else if step["support"] == "manual" {
            json!({ "type": "resolveManualStep", "payload": { "stepId": id, "outcome": "handled" } })
        } else {
            json!({ "type": "confirmStep", "payload": { "stepId": id, "input": null } })
        };
        append(events, command);
    }
    panic!("did not reach {target}");
}

#[test]
fn vortox_numeric_information_accepts_an_obviously_false_safe_integer() {
    let mut events = vec![setup_event()];
    let state = advance_until(&mut events, "firstNight:clockmaker");
    let truth = state["value"]["currentStep"]["informationPrompt"]["computedResult"]["value"]
        .as_u64()
        .unwrap();

    let accepted = propose(
        &events,
        json!({ "type": "confirmStep", "payload": {
            "stepId": "firstNight:clockmaker",
            "input": null,
            "deliveredResult": { "kind": "number", "value": 100 }
        }}),
    );
    assert_eq!(accepted["ok"], true, "{accepted}");

    let max_safe = propose(
        &events,
        json!({ "type": "confirmStep", "payload": {
            "stepId": "firstNight:clockmaker",
            "input": null,
            "deliveredResult": { "kind": "number", "value": 9_007_199_254_740_991_u64 }
        }}),
    );
    assert_eq!(max_safe["ok"], true, "{max_safe}");

    let unsafe_integer = propose(
        &events,
        json!({ "type": "confirmStep", "payload": {
            "stepId": "firstNight:clockmaker",
            "input": null,
            "deliveredResult": { "kind": "number", "value": 9_007_199_254_740_992_u64 }
        }}),
    );
    assert_eq!(unsafe_integer["ok"], false, "{unsafe_integer}");

    let truthful = propose(
        &events,
        json!({ "type": "confirmStep", "payload": {
            "stepId": "firstNight:clockmaker",
            "input": null,
            "deliveredResult": { "kind": "number", "value": truth }
        }}),
    );
    assert_eq!(truthful["ok"], false, "{truthful}");
}

#[test]
fn no_execution_with_an_active_vortox_creates_an_evil_forced_game_end() {
    let mut events = vec![setup_event()];
    advance_until(&mut events, "day:execution");
    let no_execution = append(
        &mut events,
        json!({ "type": "confirmStep", "payload": {
            "stepId": "day:execution",
            "input": { "execute": false }
        }}),
    );

    let state = replay(&events);
    assert_eq!(
        state["value"]["pendingGameEnd"],
        json!({
            "sourceEventId": no_execution["value"]["event"]["id"],
            "winningTeam": "evil",
            "cause": "vortoxNoExecution",
            "reasonKo": "보르톡스가 존재하지만 낮에 아무도 처형되지 않았습니다."
        })
    );

    let blocked = propose(
        &events,
        json!({ "type": "confirmStep", "payload": {
            "stepId": "day:toNight", "input": null
        }}),
    );
    assert_eq!(blocked["ok"], false, "{blocked}");

    let expected_event_count = events.len();
    let ended = append(
        &mut events,
        json!({ "type": "endGame", "payload": {
            "winningTeam": "evil", "expectedEventCount": expected_event_count
        }}),
    );
    assert_eq!(
        ended["value"]["event"]["payload"]["source"],
        json!({
            "kind": "vortoxNoExecution",
            "sourceEventId": no_execution["value"]["event"]["id"]
        })
    );
    assert_eq!(replay(&events)["value"]["gameEnd"]["winningTeam"], "evil");

    events.pop();
    assert_eq!(
        replay(&events)["value"]["pendingGameEnd"]["winningTeam"],
        "evil"
    );
}

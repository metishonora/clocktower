use crate::{propose_json, replay_json};
use serde_json::{json, Value};

use super::support::snv_demon_bluff_input;

fn setup_event() -> Value {
    json!({
        "id": "setup-98",
        "type": "setupConfirmed",
        "phase": "setup",
        "payload": { "players": [
            { "id": "player-1", "seat": 1, "name": "Dreamer", "actualCharacter": "dreamer", "shownCharacter": "dreamer" },
            { "id": "player-2", "seat": 2, "name": "Seamstress", "actualCharacter": "seamstress", "shownCharacter": "seamstress" },
            { "id": "player-3", "seat": 3, "name": "Sage", "actualCharacter": "sage", "shownCharacter": "sage" },
            { "id": "player-4", "seat": 4, "name": "Clockmaker", "actualCharacter": "clockmaker", "shownCharacter": "clockmaker" },
            { "id": "player-5", "seat": 5, "name": "Oracle", "actualCharacter": "oracle", "shownCharacter": "oracle" },
            { "id": "player-6", "seat": 6, "name": "Evil Twin", "actualCharacter": "evilTwin", "shownCharacter": "evilTwin" },
            { "id": "player-7", "seat": 7, "name": "Fang Gu", "actualCharacter": "fangGu", "shownCharacter": "fangGu" }
        ]},
        "summary": "초기 설정 확정: 7명",
        "createdAt": "2026-07-25T00:00:00.000Z"
    })
}

fn game(events: Vec<Value>) -> Value {
    json!({
        "schemaVersion": 3,
        "game": {
            "id": "game-issue-98",
            "name": "Issue 98 targeted information",
            "scriptId": "sectsAndViolets",
            "createdAt": "2026-07-25T00:00:00.000Z",
            "updatedAt": "2026-07-25T00:00:00.000Z",
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
    assert_eq!(proposal["ok"], true, "{proposal}");
    events.push(proposal["value"]["event"].clone());
    proposal
}

fn advance_until(events: &mut Vec<Value>, target: &str) -> Value {
    for _ in 0..128 {
        let state = replay(events);
        assert_eq!(state["ok"], true, "{state}");
        let step = &state["value"]["currentStep"];
        if step["id"] == target {
            return state;
        }
        let id = step["id"].as_str().expect("current step id");
        let vortox_active = state["value"]["players"].as_array().is_some_and(|players| {
            players
                .iter()
                .any(|player| player["actualCharacter"] == "vortox")
        });
        let command = if vortox_active {
            super::support::snv_day_execution_command(&state, "player-4")
                .unwrap_or_else(|| default_advance_command(step, id))
        } else {
            default_advance_command(step, id)
        };
        append(events, command);
    }
    panic!("did not reach {target}");
}

fn default_advance_command(step: &Value, id: &str) -> Value {
    if step["requiredInput"]["kind"] == "nomination" {
        json!({ "type": "skipStep", "payload": { "stepId": id } })
    } else if step["requiredInput"]["kind"] == "executionDecision" {
        json!({ "type": "confirmStep", "payload": { "stepId": id, "input": { "execute": false } } })
    } else if id == "firstNight:demonInfo" {
        json!({ "type": "confirmStep", "payload": { "stepId": id, "input": snv_demon_bluff_input(step) } })
    } else if matches!(
        step["character"].as_str(),
        Some("fangGu" | "vigormortis" | "noDashii" | "vortox")
    ) {
        json!({ "type": "confirmStep", "payload": { "stepId": id, "input": { "playerIds": ["player-3"] } } })
    } else if step["character"] == "evilTwin" {
        json!({ "type": "confirmStep", "payload": { "stepId": id, "input": { "playerIds": ["player-1"] } } })
    } else if step["character"] == "dreamer" {
        let check = &step["informationPrompt"]["targetChecks"][0];
        json!({ "type": "confirmStep", "payload": {
            "stepId": id,
            "input": { "playerIds": check["targetPlayerIds"] },
            "deliveredResult": check["choices"][0]["result"]
        }})
    } else if step["character"] == "seamstress" {
        json!({ "type": "skipStep", "payload": { "stepId": id } })
    } else if step["character"] == "sage" {
        let check = &step["informationPrompt"]["targetChecks"][0];
        json!({ "type": "confirmStep", "payload": {
            "stepId": id,
            "input": null,
            "deliveredResult": check["choices"][0]["result"]
        }})
    } else if step["informationPrompt"]["deliveryMode"] == "selectable"
        && step["informationPrompt"]["computedResult"]["kind"] == "number"
    {
        let value = step["informationPrompt"]["numberChoices"][0]["value"]
            .as_u64()
            .unwrap_or(100);
        json!({ "type": "confirmStep", "payload": { "stepId": id, "input": null, "deliveredResult": { "kind": "number", "value": value } } })
    } else if step["informationPrompt"]["deliveryMode"] == "selectable"
        && step["informationPrompt"]["computedResult"]["kind"] == "boolean"
    {
        json!({ "type": "confirmStep", "payload": { "stepId": id, "input": null, "deliveredResult": { "kind": "boolean", "value": step["informationPrompt"]["booleanChoices"][0]["value"] } } })
    } else if step["support"] == "manual" {
        json!({ "type": "resolveManualStep", "payload": { "stepId": id, "outcome": "handled" } })
    } else {
        json!({ "type": "confirmStep", "payload": { "stepId": id, "input": null } })
    }
}

#[test]
fn dreamer_uses_the_target_truth_and_all_opposite_alignment_characters() {
    let mut events = vec![setup_event()];
    let state = advance_until(&mut events, "firstNight:dreamer");
    let step = &state["value"]["currentStep"];
    assert_eq!(step["support"], "automated");
    assert_eq!(step["requiredInput"]["kind"], "playerIds");
    assert!(!step["requiredInput"]["allowedPlayerIds"]
        .as_array()
        .unwrap()
        .contains(&json!("player-1")));
    let check = step["informationPrompt"]["targetChecks"]
        .as_array()
        .unwrap()
        .iter()
        .find(|check| check["targetPlayerIds"] == json!(["player-2"]))
        .unwrap();
    assert_eq!(
        check["computedResult"],
        json!({ "kind": "character", "characterId": "seamstress" })
    );
    assert_eq!(check["choices"].as_array().unwrap().len(), 8);

    let proposal = append(
        &mut events,
        json!({ "type": "confirmStep", "payload": {
            "stepId": "firstNight:dreamer",
            "input": { "playerIds": ["player-2"] },
            "deliveredResult": { "kind": "characterPair", "characterIds": ["seamstress", "evilTwin"] }
        }}),
    );
    assert_eq!(
        proposal["value"]["event"]["payload"]["information"]["targetPlayerIds"],
        json!(["player-2"])
    );
    assert_eq!(
        proposal["value"]["event"]["summary"],
        "1번 Dreamer(꿈꾸는 자)가 2번 Seamstress(재봉사)의 캐릭터 후보를 확인했습니다. (실제 재봉사 · 능력 선택)"
    );
    assert_eq!(
        proposal["value"]["revealPayload"],
        json!({
            "kind": "dreamerInformation",
            "characterIds": ["seamstress", "evilTwin"]
        })
    );
}

#[test]
fn vortox_dreamer_can_choose_only_pairs_that_exclude_the_target_truth() {
    let mut setup = setup_event();
    setup["payload"]["players"][6]["actualCharacter"] = json!("vortox");
    setup["payload"]["players"][6]["shownCharacter"] = json!("vortox");
    let mut events = vec![setup];
    let state = advance_until(&mut events, "firstNight:dreamer");
    let check = state["value"]["currentStep"]["informationPrompt"]["targetChecks"]
        .as_array()
        .unwrap()
        .iter()
        .find(|check| check["targetPlayerIds"] == json!(["player-2"]))
        .unwrap();
    let choices = check["choices"].as_array().unwrap();
    assert_eq!(choices.len(), 128);
    assert!(choices.iter().all(|choice| choice["result"]["characterIds"]
        .as_array()
        .unwrap()
        .iter()
        .all(|character| character != "seamstress")));

    let truthful = propose(
        &events,
        json!({ "type": "confirmStep", "payload": {
            "stepId": "firstNight:dreamer",
            "input": { "playerIds": ["player-2"] },
            "deliveredResult": { "kind": "characterPair", "characterIds": ["seamstress", "evilTwin"] }
        }}),
    );
    assert_eq!(truthful["ok"], false, "{truthful}");
}

#[test]
fn vortox_oracle_excludes_and_rejects_the_truthful_number() {
    let mut setup = setup_event();
    setup["payload"]["players"][6]["actualCharacter"] = json!("vortox");
    setup["payload"]["players"][6]["shownCharacter"] = json!("vortox");
    let mut events = vec![setup];
    let state = advance_until(&mut events, "night:oracle");
    let prompt = &state["value"]["currentStep"]["informationPrompt"];
    let truth = prompt["computedResult"]["value"].as_u64().unwrap();
    assert!(prompt["activeReasons"]
        .as_array()
        .unwrap()
        .iter()
        .any(|reason| reason["type"] == "vortox"));
    assert_eq!(
        prompt["numberConstraint"],
        json!({ "min": 0, "max": 9_007_199_254_740_991_u64, "excludedValues": [truth] })
    );

    let truthful = propose(
        &events,
        json!({ "type": "confirmStep", "payload": {
            "stepId": "night:oracle",
            "input": null,
            "deliveredResult": { "kind": "number", "value": truth }
        }}),
    );
    assert_eq!(truthful["ok"], false, "{truthful}");
}

#[test]
fn seamstress_compares_two_other_players_and_a_completed_use_does_not_return() {
    let mut events = vec![setup_event()];
    advance_until(&mut events, "firstNight:seamstress");
    let state = replay(&events);
    let step = &state["value"]["currentStep"];
    assert_eq!(step["support"], "automated");
    assert_eq!(step["canSkip"], true);
    let check = step["informationPrompt"]["targetChecks"]
        .as_array()
        .unwrap()
        .iter()
        .find(|check| check["targetPlayerIds"] == json!(["player-1", "player-6"]))
        .unwrap();
    assert_eq!(
        check["computedResult"],
        json!({ "kind": "boolean", "value": false })
    );

    let proposal = append(
        &mut events,
        json!({ "type": "confirmStep", "payload": {
            "stepId": "firstNight:seamstress",
            "input": { "playerIds": ["player-1", "player-6"] }
        }}),
    );
    assert_eq!(
        proposal["value"]["revealPayload"],
        json!({
            "kind": "seamstressInformation",
            "targetPlayers": [
                { "playerId": "player-1", "seat": 1, "name": "Dreamer" },
                { "playerId": "player-6", "seat": 6, "name": "Evil Twin" }
            ],
            "sameAlignment": false
        })
    );
    let completed = replay(&events);
    assert!(completed["value"]["ruleState"]["automaticReminders"]
        .as_array()
        .unwrap()
        .contains(&json!({
            "playerId": "player-2",
            "characterId": "seamstress",
            "tokenId": "noAbility",
            "label": "능력 없음",
            "description": "재봉사 능력을 이미 사용했습니다."
        })));
    let undone = replay(&events[..events.len() - 1]);
    assert!(!undone["value"]["ruleState"]["automaticReminders"]
        .as_array()
        .unwrap()
        .iter()
        .any(|reminder| reminder["characterId"] == "seamstress"));

    let later = advance_until(&mut events, "night:toDay");
    assert!(!later["value"]["phaseOverview"]
        .as_array()
        .unwrap()
        .iter()
        .any(|item| item["character"] == "seamstress"));
}

#[test]
fn seamstress_skip_does_not_place_the_no_ability_reminder() {
    let mut events = vec![setup_event()];
    advance_until(&mut events, "firstNight:seamstress");
    append(
        &mut events,
        json!({ "type": "skipStep", "payload": { "stepId": "firstNight:seamstress" } }),
    );

    let skipped = replay(&events);
    assert!(!skipped["value"]["ruleState"]["automaticReminders"]
        .as_array()
        .unwrap()
        .iter()
        .any(|reminder| reminder["characterId"] == "seamstress"));
    let later = advance_until(&mut events, "night:seamstress");
    assert_eq!(later["value"]["currentStep"]["character"], "seamstress");
}

#[test]
fn sage_exists_only_after_a_demon_kill_and_preserves_the_chosen_candidate_order() {
    let mut events = vec![setup_event()];
    let state = advance_until(&mut events, "night:sage");
    let step = &state["value"]["currentStep"];
    assert_eq!(step["support"], "automated");
    assert_eq!(
        step["informationPrompt"]["computedResult"],
        json!({
            "kind": "player", "playerId": "player-7"
        })
    );

    let proposal = append(
        &mut events,
        json!({ "type": "confirmStep", "payload": {
            "stepId": "night:sage",
            "input": null,
            "deliveredResult": { "kind": "playerPair", "playerIds": ["player-1", "player-7"] }
        }}),
    );
    assert_eq!(
        proposal["value"]["revealPayload"],
        json!({
            "kind": "sageInformation",
            "candidatePlayers": [
                { "playerId": "player-1", "seat": 1, "name": "Dreamer" },
                { "playerId": "player-7", "seat": 7, "name": "Fang Gu" }
            ]
        })
    );
    let replayed = replay(&events);
    assert_eq!(replayed["ok"], true, "{replayed}");
}

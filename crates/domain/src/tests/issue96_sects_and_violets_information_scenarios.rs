use crate::{propose_json, replay_json};
use serde_json::{json, Value};

use super::support::snv_demon_bluff_input;

fn setup_event() -> Value {
    json!({
        "id": "setup-1",
        "type": "setupConfirmed",
        "phase": "setup",
        "payload": { "players": [
            { "id": "player-1", "seat": 1, "name": "Clockmaker", "actualCharacter": "clockmaker", "shownCharacter": "clockmaker" },
            { "id": "player-2", "seat": 2, "name": "Flowergirl", "actualCharacter": "flowergirl", "shownCharacter": "flowergirl" },
            { "id": "player-3", "seat": 3, "name": "Town Crier", "actualCharacter": "townCrier", "shownCharacter": "townCrier" },
            { "id": "player-4", "seat": 4, "name": "Oracle", "actualCharacter": "oracle", "shownCharacter": "oracle" },
            { "id": "player-5", "seat": 5, "name": "Dreamer", "actualCharacter": "dreamer", "shownCharacter": "dreamer" },
            { "id": "player-6", "seat": 6, "name": "Pit-Hag", "actualCharacter": "pitHag", "shownCharacter": "pitHag" },
            { "id": "player-7", "seat": 7, "name": "Fang Gu", "actualCharacter": "fangGu", "shownCharacter": "fangGu" }
        ]},
        "summary": "초기 설정 확정: 7명",
        "createdAt": "2026-07-24T00:00:00.000Z"
    })
}

fn game(events: Vec<Value>) -> Value {
    json!({
        "schemaVersion": 3,
        "game": {
            "id": "game-issue-96",
            "name": "Issue 96 information",
            "scriptId": "sectsAndViolets",
            "createdAt": "2026-07-24T00:00:00.000Z",
            "updatedAt": "2026-07-24T00:00:00.000Z",
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

fn confirm_current(events: &mut Vec<Value>) {
    let state = replay(events);
    let step = &state["value"]["currentStep"];
    let input = if step["id"] == "firstNight:demonInfo" {
        snv_demon_bluff_input(step)
    } else {
        Value::Null
    };
    let proposal = propose(
        events,
        json!({
            "type": "confirmStep",
            "payload": { "stepId": step["id"], "input": input }
        }),
    );
    assert_eq!(proposal["ok"], true, "{proposal}");
    events.push(proposal["value"]["event"].clone());
}

fn append_command(events: &mut Vec<Value>, command: Value) -> Value {
    let proposal = propose(events, command);
    assert_eq!(proposal["ok"], true, "{proposal}");
    events.push(proposal["value"]["event"].clone());
    proposal
}

fn advance_until(events: &mut Vec<Value>, target_step_id: &str) -> Value {
    for _ in 0..96 {
        let state = replay(events);
        assert_eq!(state["ok"], true, "{state}");
        let step = &state["value"]["currentStep"];
        if step["id"] == target_step_id {
            return state;
        }
        let step_id = step["id"].as_str().unwrap();
        let command = if step["requiredInput"]["kind"] == "nomination" {
            json!({ "type": "skipStep", "payload": { "stepId": step_id } })
        } else if step["requiredInput"]["kind"] == "executionDecision" {
            json!({ "type": "confirmStep", "payload": { "stepId": step_id, "input": { "execute": false } } })
        } else if step_id == "firstNight:demonInfo" {
            json!({ "type": "confirmStep", "payload": { "stepId": step_id, "input": snv_demon_bluff_input(step) } })
        } else if matches!(
            step["character"].as_str(),
            Some("fangGu" | "vigormortis" | "noDashii" | "vortox")
        ) {
            json!({ "type": "confirmStep", "payload": { "stepId": step_id, "input": { "playerIds": ["player-5"] } } })
        } else if step["requiredInput"]["kind"] == "characterTransformation" {
            json!({ "type": "confirmStep", "payload": { "stepId": step_id, "input": { "playerIds": ["player-6"], "characterIds": ["pitHag"] } } })
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
        append_command(events, command);
    }
    panic!("did not reach {target_step_id}");
}

#[test]
fn clockmaker_uses_the_actual_circular_demon_minion_distance_and_persists_the_reveal() {
    let mut events = vec![setup_event()];
    confirm_current(&mut events); // Minion information
    confirm_current(&mut events); // Demon information

    let before = replay(&events);
    assert_eq!(
        before["value"]["currentStep"]["id"],
        "firstNight:clockmaker"
    );
    assert_eq!(before["value"]["currentStep"]["support"], "automated");
    assert_eq!(
        before["value"]["currentStep"]["informationPrompt"],
        json!({
            "computedResult": { "kind": "number", "value": 1 },
            "deliveryMode": "fixed",
            "activeReasons": [],
            "registrationCandidatePlayerIds": [],
            "numberChoices": [
                { "value": 1, "isComputed": true, "registrationJudgments": [] }
            ],
            "setupInfoRegistrationOptions": []
        })
    );

    let proposal = propose(
        &events,
        json!({
            "type": "confirmStep",
            "payload": { "stepId": "firstNight:clockmaker", "input": null }
        }),
    );
    assert_eq!(proposal["ok"], true, "{proposal}");
    assert_eq!(
        proposal["value"]["event"]["payload"]["information"],
        json!({
            "actor": { "playerId": "player-1", "characterId": "clockmaker" },
            "targetPlayerIds": [],
            "computedResult": { "kind": "number", "value": 1 },
            "deliveredResult": { "kind": "number", "value": 1 },
            "deliveryContext": { "type": "fixed" }
        })
    );
    assert_eq!(
        proposal["value"]["revealPayload"],
        json!({ "kind": "numericInformation", "characterId": "clockmaker", "value": 1 })
    );
}

#[test]
fn clockmaker_uses_the_nearer_direction_when_the_official_example_distance_is_three() {
    let mut setup = setup_event();
    setup["payload"]["players"][3]["actualCharacter"] = json!("pitHag");
    setup["payload"]["players"][3]["shownCharacter"] = json!("pitHag");
    setup["payload"]["players"][5]["actualCharacter"] = json!("oracle");
    setup["payload"]["players"][5]["shownCharacter"] = json!("oracle");
    let mut events = vec![setup];
    confirm_current(&mut events);
    confirm_current(&mut events);

    let before = replay(&events);
    assert_eq!(
        before["value"]["currentStep"]["id"],
        "firstNight:clockmaker"
    );
    assert_eq!(
        before["value"]["currentStep"]["informationPrompt"]["computedResult"],
        json!({ "kind": "number", "value": 3 })
    );
}

#[test]
fn preceding_day_actions_drive_boolean_information_and_atomic_reminders() {
    let mut events = vec![setup_event()];
    advance_until(&mut events, "day:nomination:1");

    let initial = replay(&events);
    assert_eq!(
        initial["value"]["ruleState"]["automaticReminders"],
        json!([
            { "playerId": "player-2", "characterId": "flowergirl", "tokenId": "demonDidNotVote", "label": "악마 투표 안 함", "description": "오늘 악마가 처형 투표에 참여하지 않았습니다." },
            { "playerId": "player-3", "characterId": "townCrier", "tokenId": "minionDidNotNominate", "label": "하수인 지목 안 함", "description": "오늘 하수인이 처형 지목에 나서지 않았습니다." }
        ])
    );

    append_command(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "day:nomination:1",
                "input": { "nominatorId": "player-6", "nomineeId": "player-1" }
            }
        }),
    );
    let after_nomination = replay(&events);
    assert_eq!(
        after_nomination["value"]["ruleState"]["automaticReminders"][1]["label"],
        "하수인 지목함"
    );
    let before_nomination = replay(&events[..events.len() - 1]);
    assert_eq!(
        before_nomination["value"]["ruleState"]["automaticReminders"][1]["label"],
        "하수인 지목 안 함"
    );

    append_command(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "day:nomination:1:vote",
                "input": { "voterIds": ["player-7"] }
            }
        }),
    );
    let after_vote = replay(&events);
    assert_eq!(
        after_vote["value"]["ruleState"]["automaticReminders"][0]["label"],
        "악마 투표함"
    );
    let before_vote = replay(&events[..events.len() - 1]);
    assert_eq!(
        before_vote["value"]["ruleState"]["automaticReminders"][0]["label"],
        "악마 투표 안 함"
    );

    let flowergirl = advance_until(&mut events, "night:flowergirl");
    assert_eq!(
        flowergirl["value"]["currentStep"]["informationPrompt"]["booleanChoices"],
        json!([{ "value": true, "isComputed": true, "registrationJudgments": [] }])
    );
    let flowergirl_proposal = append_command(
        &mut events,
        json!({ "type": "confirmStep", "payload": { "stepId": "night:flowergirl", "input": null } }),
    );
    assert_eq!(
        flowergirl_proposal["value"]["revealPayload"],
        json!({ "kind": "booleanInformation", "characterId": "flowergirl", "value": true })
    );

    let town_crier = replay(&events);
    assert_eq!(town_crier["value"]["currentStep"]["id"], "night:townCrier");
    assert_eq!(
        town_crier["value"]["currentStep"]["informationPrompt"]["computedResult"],
        json!({ "kind": "boolean", "value": true })
    );
    append_command(
        &mut events,
        json!({ "type": "confirmStep", "payload": { "stepId": "night:townCrier", "input": null } }),
    );

    let oracle = replay(&events);
    assert_eq!(oracle["value"]["currentStep"]["id"], "night:oracle");
    assert_eq!(
        oracle["value"]["currentStep"]["informationPrompt"]["computedResult"],
        json!({ "kind": "number", "value": 0 })
    );
    assert_eq!(
        oracle["value"]["ruleState"]["automaticReminders"][0]["label"],
        "악마 투표함"
    );
    append_command(
        &mut events,
        json!({ "type": "confirmStep", "payload": { "stepId": "night:oracle", "input": null } }),
    );
    let next_day = advance_until(&mut events, "day2:announceDeaths");
    assert_eq!(
        next_day["value"]["ruleState"]["automaticReminders"][0]["label"],
        "악마 투표 안 함"
    );
    assert_eq!(
        next_day["value"]["ruleState"]["automaticReminders"][1]["label"],
        "하수인 지목 안 함"
    );
}

#[test]
fn execution_without_a_demon_vote_yields_false_and_good_deaths_leave_oracle_at_zero() {
    let mut events = vec![setup_event()];
    advance_until(&mut events, "day:nomination:1");
    append_command(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "day:nomination:1",
                "input": { "nominatorId": "player-5", "nomineeId": "player-1" }
            }
        }),
    );
    append_command(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "day:nomination:1:vote",
                "input": { "voterIds": ["player-1", "player-2", "player-3", "player-4"] }
            }
        }),
    );
    append_command(
        &mut events,
        json!({ "type": "skipStep", "payload": { "stepId": "day:nomination:2" } }),
    );
    append_command(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": { "stepId": "day:execution", "input": { "execute": true } }
        }),
    );
    append_command(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": { "stepId": "day:executionDeath", "input": { "died": true } }
        }),
    );

    let flowergirl = advance_until(&mut events, "night:flowergirl");
    assert_eq!(
        flowergirl["value"]["currentStep"]["informationPrompt"]["computedResult"],
        json!({ "kind": "boolean", "value": false })
    );
    let proposal = append_command(
        &mut events,
        json!({ "type": "confirmStep", "payload": { "stepId": "night:flowergirl", "input": null } }),
    );
    assert_eq!(
        proposal["value"]["revealPayload"],
        json!({ "kind": "booleanInformation", "characterId": "flowergirl", "value": false })
    );

    append_command(
        &mut events,
        json!({ "type": "confirmStep", "payload": { "stepId": "night:townCrier", "input": null } }),
    );
    let oracle = replay(&events);
    assert_eq!(oracle["value"]["currentStep"]["id"], "night:oracle");
    assert_eq!(
        oracle["value"]["currentStep"]["informationPrompt"]["computedResult"],
        json!({ "kind": "number", "value": 0 })
    );
}

#[test]
fn an_information_character_killed_before_their_wake_position_has_no_step() {
    let mut events = vec![setup_event()];
    let demon = advance_until(&mut events, "night:demon:player-7");
    assert_eq!(demon["value"]["currentStep"]["character"], "fangGu");
    append_command(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "night:demon:player-7",
                "input": { "playerIds": ["player-2"] }
            }
        }),
    );

    let after = replay(&events);
    assert_eq!(after["value"]["players"][1]["alive"], false);
    assert!(after["value"]["phaseOverview"]
        .as_array()
        .unwrap()
        .iter()
        .all(|step| step["id"] != "night:flowergirl"));
}

#[test]
fn forged_clockmaker_information_is_rejected_by_proposal_and_replay() {
    let mut events = vec![setup_event()];
    confirm_current(&mut events);
    confirm_current(&mut events);

    let rejected = propose(
        &events,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "firstNight:clockmaker",
                "input": null,
                "deliveredResult": { "kind": "number", "value": 3 }
            }
        }),
    );
    assert_eq!(rejected["ok"], false);
    assert_eq!(rejected["error"]["code"], "INVALID_DELIVERED_INFORMATION");

    let valid = propose(
        &events,
        json!({ "type": "confirmStep", "payload": { "stepId": "firstNight:clockmaker", "input": null } }),
    );
    let mut forged = valid["value"]["event"].clone();
    forged["payload"]["information"]["computedResult"]["value"] = json!(3);
    events.push(forged);
    let replayed = replay(&events);
    assert_eq!(replayed["ok"], false);
    assert_eq!(replayed["error"]["code"], "REPLAY_FAILED");
}

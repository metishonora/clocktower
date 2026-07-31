use crate::{propose_json, replay_json};
use serde_json::{json, Value};

use super::support::snv_demon_bluff_input;

fn setup_event() -> Value {
    json!({
        "id": "setup-112",
        "type": "setupConfirmed",
        "phase": "setup",
        "payload": { "players": [
            { "id": "player-1", "seat": 1, "name": "Clockmaker", "actualCharacter": "clockmaker", "shownCharacter": "clockmaker" },
            { "id": "player-2", "seat": 2, "name": "Dreamer", "actualCharacter": "dreamer", "shownCharacter": "dreamer" },
            { "id": "player-3", "seat": 3, "name": "Artist", "actualCharacter": "artist", "shownCharacter": "artist" },
            { "id": "player-4", "seat": 4, "name": "Klutz", "actualCharacter": "klutz", "shownCharacter": "klutz" },
            { "id": "player-5", "seat": 5, "name": "Sweetheart", "actualCharacter": "sweetheart", "shownCharacter": "sweetheart" },
            { "id": "player-6", "seat": 6, "name": "Pit-Hag", "actualCharacter": "pitHag", "shownCharacter": "pitHag" },
            { "id": "player-7", "seat": 7, "name": "Fang Gu", "actualCharacter": "fangGu", "shownCharacter": "fangGu" }
        ]},
        "summary": "초기 설정 확정: 7명",
        "createdAt": "2026-07-29T00:00:00.000Z"
    })
}

fn game(events: Vec<Value>) -> Value {
    json!({
        "schemaVersion": 3,
        "game": {
            "id": "game-112",
            "name": "Fang Gu jump",
            "scriptId": "sectsAndViolets",
            "createdAt": "2026-07-29T00:00:00.000Z",
            "updatedAt": "2026-07-29T00:00:00.000Z",
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

fn append_current_resolution(events: &mut Vec<Value>) {
    let state = replay(events);
    assert_eq!(state["ok"], true, "replay failed: {state}");
    let step = &state["value"]["currentStep"];
    let command = if step["requiredInput"]["kind"] == "nomination" {
        json!({ "type": "skipStep", "payload": { "stepId": step["id"] } })
    } else if step["requiredInput"]["kind"] == "executionDecision" {
        json!({ "type": "confirmStep", "payload": { "stepId": step["id"], "input": { "execute": false } } })
    } else if step["requiredInput"]["kind"] == "characterTransformation" {
        json!({ "type": "confirmStep", "payload": {
            "stepId": step["id"],
            "input": { "playerIds": ["player-6"], "characterIds": ["pitHag"] }
        } })
    } else if step["id"] == "firstNight:demonInfo" {
        json!({ "type": "confirmStep", "payload": {
            "stepId": step["id"], "input": snv_demon_bluff_input(step)
        } })
    } else if step["informationPrompt"]["deliveryMode"] == "selectable"
        && step["informationPrompt"]["computedResult"]["kind"] == "number"
    {
        json!({ "type": "confirmStep", "payload": {
            "stepId": step["id"], "input": null,
            "deliveredResult": { "kind": "number", "value": step["informationPrompt"]["numberChoices"][0]["value"] }
        } })
    } else if step["informationPrompt"]["deliveryMode"] == "selectable"
        && step["informationPrompt"]["computedResult"]["kind"] == "boolean"
    {
        json!({ "type": "confirmStep", "payload": {
            "stepId": step["id"], "input": null,
            "deliveredResult": { "kind": "boolean", "value": step["informationPrompt"]["booleanChoices"][0]["value"] }
        } })
    } else if step["character"] == "dreamer" {
        let check = &step["informationPrompt"]["targetChecks"][0];
        json!({ "type": "confirmStep", "payload": {
            "stepId": step["id"],
            "input": { "playerIds": check["targetPlayerIds"] },
            "deliveredResult": check["choices"][0]["result"]
        } })
    } else if step["character"] == "seamstress" {
        json!({ "type": "skipStep", "payload": { "stepId": step["id"] } })
    } else if step["support"] == "manual" {
        json!({ "type": "resolveManualStep", "payload": { "stepId": step["id"], "outcome": "handled" } })
    } else {
        json!({ "type": "confirmStep", "payload": { "stepId": step["id"], "input": null } })
    };
    let result = propose(events, command);
    assert_eq!(result["ok"], true, "proposal failed: {result}");
    events.push(result["value"]["event"].clone());
}

fn advance_to_demon(events: &mut Vec<Value>) -> Value {
    for _ in 0..64 {
        let state = replay(events);
        assert_eq!(state["ok"], true, "replay failed: {state}");
        if state["value"]["currentStep"]["id"] == "night:demon:player-7" {
            return state;
        }
        append_current_resolution(events);
    }
    panic!("did not reach Fang Gu action")
}

fn confirm_attack(events: &mut Vec<Value>, target_player_id: &str) -> Value {
    let state = replay(events);
    let step = &state["value"]["currentStep"];
    assert!(step["id"].as_str().is_some_and(|id| id.contains(":demon:")));
    let proposal = propose(
        events,
        json!({ "type": "confirmStep", "payload": {
            "stepId": step["id"],
            "input": { "playerIds": [target_player_id] }
        } }),
    );
    assert_eq!(proposal["ok"], true, "attack failed: {proposal}");
    events.push(proposal["value"]["event"].clone());
    proposal
}

fn has_fang_gu_once_reminder(state: &Value) -> bool {
    state["value"]["ruleState"]["automaticReminders"]
        .as_array()
        .is_some_and(|reminders| {
            reminders.iter().any(|reminder| {
                reminder["characterId"] == "fangGu" && reminder["tokenId"] == "once"
            })
        })
}

#[test]
fn first_living_actual_outsider_attack_is_one_atomic_fang_gu_jump() {
    let mut events = vec![setup_event()];
    let before = advance_to_demon(&mut events);
    let proposal = propose(
        &events,
        json!({ "type": "confirmStep", "payload": {
            "stepId": before["value"]["currentStep"]["id"],
            "input": { "playerIds": ["player-5"] }
        } }),
    );
    assert_eq!(proposal["ok"], true, "jump proposal failed: {proposal}");
    assert_eq!(
        proposal["value"]["event"]["payload"]["resolution"]["outcome"]["kind"],
        "fangGuJump"
    );
    events.push(proposal["value"]["event"].clone());

    let after = replay(&events);
    assert_eq!(after["ok"], true, "jump replay failed: {after}");
    let players = after["value"]["players"].as_array().unwrap();
    let old_fang_gu = players
        .iter()
        .find(|player| player["id"] == "player-7")
        .unwrap();
    let new_fang_gu = players
        .iter()
        .find(|player| player["id"] == "player-5")
        .unwrap();
    assert_eq!(old_fang_gu["alive"], false);
    assert_eq!(new_fang_gu["alive"], true);
    assert_eq!(new_fang_gu["actualCharacter"], "fangGu");
    assert_eq!(new_fang_gu["shownCharacter"], "fangGu");
    assert_eq!(new_fang_gu["alignment"], "evil");
    assert_eq!(
        new_fang_gu["abilityInstance"]["sourceEventId"],
        proposal["value"]["event"]["id"]
    );
    assert_eq!(
        after["value"]["ruleState"]["unannouncedNightDeathPlayerIds"],
        json!(["player-7"])
    );
    assert_eq!(
        after["value"]["ruleState"]["automaticReminders"],
        json!([{
            "playerId": "player-5",
            "characterId": "fangGu",
            "tokenId": "once",
            "label": "한 번",
            "description": "첫 외지인 이동이 사용되었습니다."
        }])
    );
    assert_eq!(
        after["value"]["pendingIdentityReveals"],
        json!([{
            "sourceEventId": proposal["value"]["event"]["id"],
            "sequence": 1,
            "payload": {
                "kind": "characterChange",
                "playerId": "player-5",
                "alignment": "evil",
                "characterId": "fangGu"
            }
        }])
    );
    assert!(after["value"]["pendingDeathConsequences"]
        .as_array()
        .is_none_or(Vec::is_empty));
}

#[test]
fn new_fang_gu_waits_until_the_next_night_and_later_outsiders_die_normally() {
    let mut events = vec![setup_event()];
    advance_to_demon(&mut events);
    let jump = confirm_attack(&mut events, "player-5");
    assert_eq!(
        jump["value"]["event"]["payload"]["resolution"]["outcome"]["kind"],
        "fangGuJump"
    );

    let after_jump = replay(&events);
    assert_ne!(
        after_jump["value"]["currentStep"]["id"],
        "night:demon:player-5"
    );
    for _ in 0..96 {
        let state = replay(&events);
        if state["value"]["currentStep"]["id"] == "night2:demon:player-5" {
            break;
        }
        append_current_resolution(&mut events);
    }
    let next_night = replay(&events);
    assert_eq!(
        next_night["value"]["currentStep"]["id"],
        "night2:demon:player-5"
    );

    let second_attack = confirm_attack(&mut events, "player-4");
    assert_eq!(
        second_attack["value"]["event"]["payload"]["resolution"]["outcome"]["kind"],
        "deaths"
    );
    let after_second_attack = replay(&events);
    let klutz = after_second_attack["value"]["players"]
        .as_array()
        .unwrap()
        .iter()
        .find(|player| player["id"] == "player-4")
        .unwrap();
    assert_eq!(klutz["alive"], false);
    assert_eq!(
        after_second_attack["value"]["ruleState"]["automaticReminders"],
        json!([{
            "playerId": "player-5",
            "characterId": "fangGu",
            "tokenId": "once",
            "label": "한 번",
            "description": "첫 외지인 이동이 사용되었습니다."
        }])
    );
}

#[test]
fn undo_restores_the_whole_jump_and_tampered_atomic_witnesses_are_rejected() {
    let mut events = vec![setup_event()];
    advance_to_demon(&mut events);
    let before_jump_len = events.len();
    let jump = confirm_attack(&mut events, "player-5");

    let undone = replay(&events[..before_jump_len]);
    assert_eq!(undone["ok"], true, "undo replay failed: {undone}");
    assert_eq!(undone["value"]["currentStep"]["id"], "night:demon:player-7");
    assert_eq!(
        undone["value"]["players"][4]["actualCharacter"],
        "sweetheart"
    );
    assert_eq!(undone["value"]["players"][4]["alignment"], "good");
    assert_eq!(undone["value"]["players"][4]["alive"], true);
    assert_eq!(undone["value"]["players"][6]["alive"], true);
    assert!(!has_fang_gu_once_reminder(&undone));
    assert!(!undone["value"]["pendingIdentityReveals"]
        .as_array()
        .is_some_and(|reveals| reveals.iter().any(|reveal| {
            reveal["payload"]["kind"] == "characterChange"
                && reveal["payload"]["playerId"] == "player-5"
                && reveal["payload"]["characterId"] == "fangGu"
        })));

    for (field, replacement) in [
        ("sourceAbilityInstanceId", json!("forged-instance")),
        ("death.playerId", json!("player-1")),
        ("identityTransition.after.alignment", json!("good")),
    ] {
        let mut tampered = jump["value"]["event"].clone();
        let outcome = &mut tampered["payload"]["resolution"]["outcome"];
        match field {
            "sourceAbilityInstanceId" => outcome[field] = replacement,
            "death.playerId" => outcome["death"]["playerId"] = replacement,
            "identityTransition.after.alignment" => {
                outcome["identityTransition"]["after"]["alignment"] = replacement
            }
            _ => unreachable!(),
        }
        let mut forged_events = events[..before_jump_len].to_vec();
        forged_events.push(tampered);
        let rejected = replay(&forged_events);
        assert_eq!(rejected["ok"], false, "forged {field} replayed: {rejected}");
        assert_eq!(rejected["error"]["code"], "REPLAY_FAILED");
    }
}

#[test]
fn legacy_deaths_outcome_remains_replayable_without_inventing_a_jump() {
    let mut events = vec![setup_event()];
    advance_to_demon(&mut events);
    let proposal = propose(
        &events,
        json!({ "type": "confirmStep", "payload": {
            "stepId": "night:demon:player-7",
            "input": { "playerIds": ["player-5"] }
        } }),
    );
    let mut legacy = proposal["value"]["event"].clone();
    legacy["payload"]["resolution"]["outcome"] = json!({
        "kind": "deaths",
        "deaths": [{
            "playerId": "player-5",
            "cause": {
                "kind": "demonAttack",
                "actorPlayerId": "player-7",
                "actorCharacterId": "fangGu",
                "targetPlayerId": "player-5"
            }
        }]
    });
    events.push(legacy);

    let replayed = replay(&events);
    assert_eq!(replayed["ok"], true, "legacy outcome failed: {replayed}");
    assert_eq!(
        replayed["value"]["players"][4]["actualCharacter"],
        "sweetheart"
    );
    assert_eq!(replayed["value"]["players"][4]["alive"], false);
    assert_eq!(replayed["value"]["players"][6]["alive"], true);
    assert!(!has_fang_gu_once_reminder(&replayed));
}

#[test]
fn dawn_announces_only_the_old_fang_gu_without_revealing_the_jump() {
    let mut events = vec![setup_event()];
    advance_to_demon(&mut events);
    confirm_attack(&mut events, "player-5");

    for _ in 0..32 {
        let state = replay(&events);
        if state["value"]["currentStep"]["stepType"] == "announcement" {
            break;
        }
        append_current_resolution(&mut events);
    }
    let before = replay(&events);
    assert_eq!(before["value"]["currentStep"]["id"], "day2:announceDeaths");
    let announcement = propose(
        &events,
        json!({ "type": "confirmStep", "payload": {
            "stepId": "day2:announceDeaths", "input": null
        } }),
    );
    assert_eq!(
        announcement["ok"], true,
        "announcement failed: {announcement}"
    );
    assert_eq!(
        announcement["value"]["event"]["payload"],
        json!({ "stepId": "day2:announceDeaths", "playerIds": ["player-7"] })
    );
    let summary = announcement["value"]["event"]["summary"].as_str().unwrap();
    assert!(summary.contains("Fang Gu"));
    assert!(!summary.contains("팡 구 이동"));
    assert!(!summary.contains("Sweetheart"));
    assert!(!summary.contains("player-5"));
}

#[test]
fn official_fang_gu_example_one_replays_as_one_json_acceptance_scenario() {
    let fixture: Value = serde_json::from_str(include_str!(
        "../../../../fixtures/issue-112-fang-gu-example-1.json"
    ))
    .unwrap();
    assert_eq!(fixture["id"], "fangGu-example-1");
    let mut events = vec![fixture["setupEvent"].clone()];

    for attack in fixture["attacks"].as_array().unwrap() {
        for _ in 0..128 {
            let state = replay(&events);
            assert_eq!(state["ok"], true, "scenario replay failed: {state}");
            if state["value"]["currentStep"]["id"]
                .as_str()
                .is_some_and(|step_id| step_id.contains(":demon:"))
            {
                break;
            }
            append_current_resolution(&mut events);
        }
        let result = confirm_attack(&mut events, attack["targetPlayerId"].as_str().unwrap());
        assert_eq!(
            result["value"]["event"]["payload"]["resolution"]["outcome"]["kind"],
            attack["expectedOutcome"]
        );
        let state = replay(&events);
        let dead_player = state["value"]["players"]
            .as_array()
            .unwrap()
            .iter()
            .find(|player| player["id"] == attack["expectedDeadPlayerId"])
            .unwrap();
        assert_eq!(dead_player["alive"], false);
    }

    let final_state = replay(&events);
    assert_eq!(
        final_state["ok"], true,
        "final replay failed: {final_state}"
    );
    assert_eq!(
        final_state["value"]["players"][4]["actualCharacter"],
        "fangGu"
    );
    assert_eq!(final_state["value"]["players"][4]["alive"], true);
    assert_eq!(final_state["value"]["players"][6]["alive"], false);
    assert_eq!(final_state["value"]["players"][3]["alive"], false);
    assert!(
        final_state["value"]["pendingDeathConsequences"]
            .as_array()
            .is_none_or(|consequences| consequences
                .iter()
                .all(|consequence| { consequence["actorPlayerId"] != "player-5" })),
        "Sweetheart incorrectly triggered: {final_state}"
    );
    assert!(has_fang_gu_once_reminder(&final_state));
}

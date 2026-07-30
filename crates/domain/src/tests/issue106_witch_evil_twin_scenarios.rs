use crate::{propose_json, replay_json};
use serde_json::{json, Value};

fn setup_event() -> Value {
    json!({
        "id": "setup-106",
        "type": "setupConfirmed",
        "phase": "setup",
        "payload": { "players": [
            { "id": "player-1", "seat": 1, "name": "Clockmaker", "actualCharacter": "clockmaker", "shownCharacter": "clockmaker" },
            { "id": "player-2", "seat": 2, "name": "Dreamer", "actualCharacter": "dreamer", "shownCharacter": "dreamer" },
            { "id": "player-3", "seat": 3, "name": "Savant", "actualCharacter": "savant", "shownCharacter": "savant" },
            { "id": "player-4", "seat": 4, "name": "Artist", "actualCharacter": "artist", "shownCharacter": "artist" },
            { "id": "player-5", "seat": 5, "name": "Sage", "actualCharacter": "sage", "shownCharacter": "sage" },
            { "id": "player-6", "seat": 6, "name": "Sweetheart", "actualCharacter": "sweetheart", "shownCharacter": "sweetheart" },
            { "id": "player-7", "seat": 7, "name": "Evil Twin", "actualCharacter": "evilTwin", "shownCharacter": "evilTwin" },
            { "id": "player-8", "seat": 8, "name": "Witch", "actualCharacter": "witch", "shownCharacter": "witch" },
            { "id": "player-9", "seat": 9, "name": "Vortox", "actualCharacter": "vortox", "shownCharacter": "vortox" }
        ] },
        "summary": "issue 106 setup",
        "createdAt": "2026-07-29T00:00:00.000Z"
    })
}

fn game(events: &[Value]) -> Value {
    json!({
        "schemaVersion": 3,
        "game": {
            "id": "game-106",
            "name": "Witch and Evil Twin",
            "scriptId": "sectsAndViolets",
            "createdAt": "2026-07-29T00:00:00.000Z",
            "updatedAt": "2026-07-29T00:00:00.000Z",
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
    let proposal = propose(events, command.clone());
    assert_eq!(
        proposal["ok"], true,
        "proposal failed for {command}: {proposal}"
    );
    events.push(proposal["value"]["event"].clone());
    proposal
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
        let command = if step["support"] == "manual" {
            json!({ "type": "resolveManualStep", "payload": { "stepId": step_id, "outcome": "handled" } })
        } else if step["requiredInput"]["kind"] == "number" {
            json!({
                "type": "confirmStep",
                "payload": {
                    "stepId": step_id,
                    "input": null,
                    "deliveredResult": {
                        "kind": "number",
                        "value": step["informationPrompt"]["numberChoices"][0]["value"]
                    }
                }
            })
        } else if step["requiredInput"]["kind"] == "playerIds" {
            let allowed = step["requiredInput"]["allowedPlayerIds"]
                .as_array()
                .expect("allowed players");
            let count = step["requiredInput"]["minSelections"].as_u64().unwrap_or(1) as usize;
            let player_ids = allowed.iter().take(count).cloned().collect::<Vec<_>>();
            let delivered = step["informationPrompt"]["targetChecks"]
                .as_array()
                .and_then(|checks| {
                    checks
                        .iter()
                        .find(|check| check["targetPlayerIds"] == json!(player_ids))
                })
                .and_then(|check| check["choices"].as_array())
                .and_then(|choices| choices.first())
                .map(|choice| choice["result"].clone());
            let mut payload = json!({ "stepId": step_id, "input": { "playerIds": player_ids } });
            if let Some(delivered) = delivered {
                payload["deliveredResult"] = delivered;
            }
            json!({ "type": "confirmStep", "payload": payload })
        } else {
            json!({ "type": "confirmStep", "payload": { "stepId": step_id, "input": null } })
        };
        append(events, command);
    }
    panic!("did not reach {character}")
}

fn advance_to_nomination(events: &mut Vec<Value>, witch_target: &str) -> Value {
    for _ in 0..96 {
        let state = replay(events);
        assert_eq!(state["ok"], true, "replay failed: {state}");
        let step = &state["value"]["currentStep"];
        if step["requiredInput"]["kind"] == "nomination" {
            return state;
        }
        let step_id = step["id"].as_str().expect("step id");
        let command = if step["character"] == "evilTwin" {
            json!({ "type": "confirmStep", "payload": { "stepId": step_id, "input": { "playerIds": ["player-1"] } } })
        } else if step["character"] == "witch" {
            json!({ "type": "confirmStep", "payload": { "stepId": step_id, "input": { "playerIds": [witch_target] } } })
        } else if step["support"] == "manual" {
            json!({ "type": "resolveManualStep", "payload": { "stepId": step_id, "outcome": "handled" } })
        } else if step["requiredInput"]["kind"] == "number" {
            json!({
                "type": "confirmStep",
                "payload": {
                    "stepId": step_id,
                    "input": null,
                    "deliveredResult": {
                        "kind": "number",
                        "value": step["informationPrompt"]["numberChoices"][0]["value"]
                    }
                }
            })
        } else if step["requiredInput"]["kind"] == "playerIds" {
            let allowed = step["requiredInput"]["allowedPlayerIds"]
                .as_array()
                .expect("allowed players");
            let count = step["requiredInput"]["minSelections"].as_u64().unwrap_or(1) as usize;
            let player_ids = allowed.iter().take(count).cloned().collect::<Vec<_>>();
            let delivered = step["informationPrompt"]["targetChecks"]
                .as_array()
                .and_then(|checks| {
                    checks
                        .iter()
                        .find(|check| check["targetPlayerIds"] == json!(player_ids))
                })
                .and_then(|check| check["choices"].as_array())
                .and_then(|choices| choices.first())
                .map(|choice| choice["result"].clone());
            let mut payload = json!({ "stepId": step_id, "input": { "playerIds": player_ids } });
            if let Some(delivered) = delivered {
                payload["deliveredResult"] = delivered;
            }
            json!({ "type": "confirmStep", "payload": payload })
        } else {
            json!({ "type": "confirmStep", "payload": { "stepId": step_id, "input": null } })
        };
        append(events, command);
    }
    panic!("did not reach nomination")
}

#[test]
fn evil_twin_pair_and_witch_curse_are_canonical_targeted_night_actions() {
    let mut events = vec![setup_event()];

    let twin = advance_to_character(&mut events, "evilTwin");
    let twin_step = &twin["value"]["currentStep"];
    assert_eq!(twin_step["support"], "automated");
    assert_eq!(twin_step["requiredInput"]["kind"], "playerIds");
    assert!(twin_step["requiredInput"]["allowedPlayerIds"]
        .as_array()
        .unwrap()
        .iter()
        .any(|id| id == "player-1"));
    assert!(!twin_step["requiredInput"]["allowedPlayerIds"]
        .as_array()
        .unwrap()
        .iter()
        .any(|id| id == "player-8"));

    let pair = append(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": { "stepId": twin_step["id"], "input": { "playerIds": ["player-1"] } }
        }),
    );
    assert_eq!(pair["value"]["event"]["type"], "evilTwinPairAssigned");
    assert_eq!(
        pair["value"]["event"]["payload"]["twinPlayerId"],
        "player-1"
    );

    let witch = advance_to_character(&mut events, "witch");
    let witch_step = &witch["value"]["currentStep"];
    assert_eq!(witch_step["support"], "automated");
    assert_eq!(witch_step["requiredInput"]["kind"], "playerIds");
    assert!(
        witch_step["requiredInput"]["allowedPlayerIds"]
            .as_array()
            .unwrap()
            .iter()
            .any(|id| id == "player-8"),
        "Witch may curse herself"
    );

    let curse = append(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": { "stepId": witch_step["id"], "input": { "playerIds": ["player-8"] } }
        }),
    );
    assert_eq!(curse["value"]["event"]["type"], "witchCurseAssigned");
    assert_eq!(
        curse["value"]["event"]["payload"]["targetPlayerId"],
        "player-8"
    );
}

#[test]
fn witch_death_interrupts_then_resumes_the_same_nomination_vote() {
    let mut events = vec![setup_event()];
    let nomination = advance_to_nomination(&mut events, "player-1");
    let nomination_step_id = nomination["value"]["currentStep"]["id"]
        .as_str()
        .unwrap()
        .to_string();

    let started = append(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": nomination_step_id,
                "input": { "nominatorId": "player-1", "nomineeId": "player-2" }
            }
        }),
    );
    assert_eq!(
        started["value"]["event"]["payload"]["witchResolution"]["kind"],
        "deathPending"
    );

    let pending = replay(&events);
    assert_eq!(pending["value"]["currentStep"]["stepType"], "witchDeath");
    assert_eq!(pending["value"]["currentStep"]["playerId"], "player-1");
    assert_eq!(
        pending["value"]["dayState"]["activeNomination"]["nominatorId"],
        "player-1"
    );
    assert_eq!(
        pending["value"]["dayState"]["activeNomination"]["nomineeId"],
        "player-2"
    );

    let death_step_id = pending["value"]["currentStep"]["id"].as_str().unwrap();
    let death = append(
        &mut events,
        json!({ "type": "confirmStep", "payload": { "stepId": death_step_id, "input": null } }),
    );
    assert_eq!(death["value"]["event"]["type"], "deathConfirmed");
    assert_eq!(death["value"]["event"]["payload"]["playerId"], "player-1");

    let vote = replay(&events);
    assert_eq!(
        vote["value"]["currentStep"]["requiredInput"]["kind"],
        "nominationVote"
    );
    assert_eq!(
        vote["value"]["dayState"]["activeNomination"]["nominatorId"],
        "player-1"
    );
    assert_eq!(
        vote["value"]["dayState"]["activeNomination"]["nomineeId"],
        "player-2"
    );
    assert_eq!(
        vote["value"]["players"]
            .as_array()
            .unwrap()
            .iter()
            .find(|player| player["id"] == "player-1")
            .unwrap()["alive"],
        false
    );
}

#[test]
fn executing_the_good_twin_forces_evil_victory() {
    let mut events = vec![setup_event()];
    let nomination = advance_to_nomination(&mut events, "player-3");
    assert_eq!(
        nomination["value"]["ruleState"]["evilTwinRelationships"][0]["twinPlayerId"],
        "player-1"
    );
    let nomination_step_id = nomination["value"]["currentStep"]["id"]
        .as_str()
        .unwrap()
        .to_string();
    append(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": nomination_step_id,
                "input": { "nominatorId": "player-2", "nomineeId": "player-1" }
            }
        }),
    );
    let vote = replay(&events);
    let vote_step_id = vote["value"]["currentStep"]["id"].as_str().unwrap();
    append(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": vote_step_id,
                "input": { "voterIds": ["player-1", "player-2", "player-3", "player-4", "player-5"] }
            }
        }),
    );
    let next_nomination = replay(&events);
    let next_nomination_id = next_nomination["value"]["currentStep"]["id"]
        .as_str()
        .unwrap();
    append(
        &mut events,
        json!({ "type": "skipStep", "payload": { "stepId": next_nomination_id } }),
    );
    let execution = replay(&events);
    let execution_step_id = execution["value"]["currentStep"]["id"].as_str().unwrap();
    append(
        &mut events,
        json!({ "type": "confirmStep", "payload": { "stepId": execution_step_id, "input": { "execute": true } } }),
    );
    let death = replay(&events);
    assert_eq!(death["value"]["currentStep"]["stepType"], "executionDeath");
    let death_step_id = death["value"]["currentStep"]["id"].as_str().unwrap();
    append(
        &mut events,
        json!({ "type": "confirmStep", "payload": { "stepId": death_step_id, "input": { "died": true } } }),
    );

    let forced = replay(&events);
    assert_eq!(
        forced["value"]["pendingForcedGameEnd"]["winningTeam"],
        "evil"
    );
    let rejected = propose(
        &events,
        json!({ "type": "skipStep", "payload": { "stepId": "day:toNight" } }),
    );
    assert_eq!(rejected["ok"], false);

    let expected_event_count = events.len();
    let ended = append(
        &mut events,
        json!({
            "type": "endGame",
            "payload": { "winningTeam": "evil", "expectedEventCount": expected_event_count }
        }),
    );
    assert_eq!(
        ended["value"]["event"]["payload"]["source"]["kind"],
        "evilTwinExecution"
    );
}

#[test]
fn a_twin_who_changes_to_the_same_alignment_requires_a_new_opposing_twin() {
    let mut setup = setup_event();
    setup["payload"]["players"][0]["actualCharacter"] = json!("sweetheart");
    setup["payload"]["players"][0]["shownCharacter"] = json!("sweetheart");
    setup["payload"]["players"][8]["actualCharacter"] = json!("fangGu");
    setup["payload"]["players"][8]["shownCharacter"] = json!("fangGu");
    let mut events = vec![setup];

    let day = advance_to_nomination(&mut events, "player-6");
    let nomination_id = day["value"]["currentStep"]["id"].as_str().unwrap();
    append(
        &mut events,
        json!({ "type": "skipStep", "payload": { "stepId": nomination_id } }),
    );
    let execution = replay(&events);
    let execution_id = execution["value"]["currentStep"]["id"].as_str().unwrap();
    append(
        &mut events,
        json!({ "type": "confirmStep", "payload": { "stepId": execution_id, "input": { "execute": false } } }),
    );
    let to_night = replay(&events);
    let to_night_id = to_night["value"]["currentStep"]["id"].as_str().unwrap();
    append(
        &mut events,
        json!({ "type": "confirmStep", "payload": { "stepId": to_night_id, "input": null } }),
    );

    let fang_gu = advance_to_character(&mut events, "fangGu");
    let fang_gu_step_id = fang_gu["value"]["currentStep"]["id"].as_str().unwrap();
    append(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": { "stepId": fang_gu_step_id, "input": { "playerIds": ["player-1"] } }
        }),
    );

    let repair = advance_to_character(&mut events, "evilTwin");
    assert!(
        repair["value"]["currentStep"]["id"]
            .as_str()
            .unwrap()
            .contains(":ability:"),
        "{repair}"
    );
    let allowed = repair["value"]["currentStep"]["requiredInput"]["allowedPlayerIds"]
        .as_array()
        .unwrap();
    assert!(!allowed.contains(&json!("player-1")));
    assert!(allowed.contains(&json!("player-2")));
}

#[test]
fn a_witch_acquired_after_night_deaths_is_not_backfilled_into_first_night_at_three_alive() {
    let fixture: Value = serde_json::from_str(include_str!(
        "../../../../fixtures/acceptance/sects-and-violets/issue-106-night-three-living.json"
    ))
    .unwrap();

    let result: Value = serde_json::from_str(&replay_json(&fixture.to_string())).unwrap();

    assert_eq!(result["ok"], true, "{result}");
    assert_eq!(
        result["value"]["players"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|player| player["alive"] == true)
            .count(),
        3
    );
    assert_ne!(result["value"]["currentStep"]["character"], "witch");
    assert!(
        result["value"]["currentStep"]["id"]
            .as_str()
            .is_some_and(|id| id.starts_with("night3:")),
        "{result}"
    );
}

use std::collections::HashSet;

use crate::{
    propose_json,
    replay::{reset_tb_operation_counts, tb_operation_counts},
    replay_json, suggest_phase_input_json,
};
use serde_json::{json, Value};

fn setup_event() -> Value {
    json!({
        "id": "tb-setup-long-session",
        "type": "setupConfirmed",
        "phase": "setup",
        "payload": { "players": [
            { "id": "player-1", "seat": 1, "name": "Washer", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
            { "id": "player-2", "seat": 2, "name": "Chef", "actualCharacter": "chef", "shownCharacter": "chef" },
            { "id": "player-3", "seat": 3, "name": "Empath", "actualCharacter": "empath", "shownCharacter": "empath" },
            { "id": "player-4", "seat": 4, "name": "Monk", "actualCharacter": "monk", "shownCharacter": "monk" },
            { "id": "player-5", "seat": 5, "name": "Fortune Teller", "actualCharacter": "fortuneTeller", "shownCharacter": "fortuneTeller" },
            { "id": "player-6", "seat": 6, "name": "Saint", "actualCharacter": "saint", "shownCharacter": "saint" },
            { "id": "player-7", "seat": 7, "name": "Recluse", "actualCharacter": "recluse", "shownCharacter": "recluse" },
            { "id": "player-8", "seat": 8, "name": "Poisoner", "actualCharacter": "poisoner", "shownCharacter": "poisoner" },
            { "id": "player-9", "seat": 9, "name": "Imp", "actualCharacter": "imp", "shownCharacter": "imp" }
        ] },
        "summary": "Issue 140 TB long session setup",
        "createdAt": "2026-08-06T00:00:00.000Z"
    })
}

fn game(events: &[Value]) -> Value {
    json!({
        "schemaVersion": 3,
        "game": {
            "id": "game-issue-140",
            "name": "Issue 140 TB long session",
            "scriptId": "troubleBrewing",
            "createdAt": "2026-08-06T00:00:00.000Z",
            "updatedAt": "2026-08-06T00:00:00.000Z",
            "events": events
        }
    })
}

fn six_cycle_fixture() -> Value {
    serde_json::from_str(include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../fixtures/acceptance/trouble-brewing/issue-140-six-cycle-session.json"
    )))
    .expect("issue 140 fixture")
}

fn fixture_at_day(cycle: usize) -> Vec<Value> {
    let events = six_cycle_fixture()["game"]["events"]
        .as_array()
        .expect("fixture events")
        .clone();
    let wanted = if cycle == 1 {
        "day:announceDeaths".to_string()
    } else {
        format!("day{cycle}:announceDeaths")
    };
    let event_count = (0..events.len())
        .find(|event_count| replay(&events[..*event_count])["value"]["currentStep"]["id"] == wanted)
        .expect("fixture day checkpoint");
    events[..event_count].to_vec()
}

fn replay(events: &[Value]) -> Value {
    serde_json::from_str(&replay_json(&game(events).to_string())).expect("replay response")
}

fn append(events: &mut Vec<Value>, command: Value) {
    let command_for_error = command.clone();
    let proposed: Value = serde_json::from_str(&propose_json(
        &game(events).to_string(),
        &command.to_string(),
    ))
    .expect("proposal response");
    assert_eq!(
        proposed["ok"], true,
        "proposal failed for {command_for_error}: {proposed}"
    );
    events.push(proposed["value"]["event"].clone());
}

fn suggested_input(events: &[Value], step_id: &str) -> Option<Value> {
    let response: Value = serde_json::from_str(&suggest_phase_input_json(
        &game(events).to_string(),
        &json!({
            "stepId": step_id,
            "currentInput": null,
            "choiceToken": 0
        })
        .to_string(),
    ))
    .expect("suggestion response");
    (response["ok"] == true).then(|| response["value"]["input"].clone())
}

fn cycle_from_step(step_id: &str, phase: &str) -> usize {
    let prefix = step_id.split(':').next().expect("phase prefix");
    let suffix = prefix.strip_prefix(phase).expect("matching phase");
    if suffix.is_empty() {
        1
    } else {
        suffix.parse().expect("cycle suffix")
    }
}

fn command_for_current_step(events: &[Value], state: &Value) -> Value {
    let step = &state["value"]["currentStep"];
    let step_id = step["id"].as_str().expect("current step id");
    let event_count = events.len();

    if let Some(check) = step["informationPrompt"]["targetChecks"]
        .as_array()
        .and_then(|checks| checks.first())
    {
        return json!({
            "type": "confirmStep",
            "payload": {
                "stepId": step_id,
                "expectedEventCount": event_count,
                "input": { "playerIds": check["targetPlayerIds"].clone() },
                "deliveredResult": check["choices"][0]["result"].clone(),
                "registrationJudgments": check["choices"][0]["registrationJudgments"].clone()
            }
        });
    }

    match step["requiredInput"]["kind"].as_str().unwrap_or("none") {
        "nomination" => {
            let cycle = cycle_from_step(step_id, "day");
            if (cycle == 1 || cycle == 6)
                && state["value"]["dayState"]["nominations"]
                    .as_array()
                    .is_some_and(Vec::is_empty)
            {
                let nominee_id = if cycle == 6 { "player-6" } else { "player-7" };
                json!({
                    "type": "confirmStep",
                    "payload": {
                        "stepId": step_id,
                        "expectedEventCount": event_count,
                        "input": { "nominatorId": "player-1", "nomineeId": nominee_id }
                    }
                })
            } else {
                json!({ "type": "skipStep", "payload": { "stepId": step_id, "expectedEventCount": event_count } })
            }
        }
        "nominationVote" => json!({
            "type": "confirmStep",
            "payload": {
                "stepId": step_id,
                "expectedEventCount": event_count,
                "input": { "voterIds": state["value"]["players"].as_array().expect("players").iter().filter(|player| player["alive"] == true).map(|player| player["id"].clone()).collect::<Vec<_>>() }
            }
        }),
        "executionDecision" => json!({
            "type": "confirmStep",
            "payload": {
                "stepId": step_id,
                "expectedEventCount": event_count,
                "input": { "execute": state["value"]["dayState"]["executionCandidate"].is_object() }
            }
        }),
        "executionDeathDecision" | "slayerDeathDecision" => json!({
            "type": "confirmStep",
            "payload": {
                "stepId": step_id,
                "expectedEventCount": event_count,
                "input": { "died": true }
            }
        }),
        "demonSuccession" => json!({
            "type": "confirmStep",
            "payload": {
                "stepId": step_id,
                "expectedEventCount": event_count,
                "input": {
                    "successorPlayerId": step["requiredInput"]["demonSuccession"]["successorPlayerId"]
                        .as_str()
                        .unwrap_or("player-8")
                }
            }
        }),
        "playerIds" if step["character"] == "imp" => {
            let cycle = cycle_from_step(step_id, "night");
            let target = if cycle == 2 { "player-9" } else { "player-7" };
            json!({
                "type": "confirmStep",
                "payload": {
                    "stepId": step_id,
                    "expectedEventCount": event_count,
                    "input": { "playerIds": [target] }
                }
            })
        }
        "playerIds" => {
            let required = &step["requiredInput"];
            let minimum = required["minSelections"].as_u64().unwrap_or(1) as usize;
            let player_ids = required["allowedPlayerIds"]
                .as_array()
                .expect("player selection has allowedPlayerIds")
                .iter()
                .take(minimum)
                .cloned()
                .collect::<Vec<_>>();
            assert_eq!(
                player_ids.len(),
                minimum,
                "not enough allowed players for {step_id}"
            );
            json!({
                "type": "confirmStep",
                "payload": {
                    "stepId": step_id,
                    "expectedEventCount": event_count,
                    "input": { "playerIds": player_ids }
                }
            })
        }
        "characterIds" => {
            let required = &step["requiredInput"];
            let minimum = required["minSelections"].as_u64().unwrap_or(0) as usize;
            let character_ids = required["allowedCharacterIds"]
                .as_array()
                .expect("character selection has allowedCharacterIds")
                .iter()
                .take(minimum)
                .cloned()
                .collect::<Vec<_>>();
            json!({
                "type": "confirmStep",
                "payload": {
                    "stepId": step_id,
                    "expectedEventCount": event_count,
                    "input": { "characterIds": character_ids }
                }
            })
        }
        _ => json!({
            "type": "confirmStep",
            "payload": {
                "stepId": step_id,
                "expectedEventCount": event_count,
                "input": suggested_input(events, step_id)
            }
        }),
    }
}

fn advance_to_day(target_cycle: usize) -> Vec<Value> {
    let mut events = vec![setup_event()];
    let wanted = if target_cycle == 1 {
        "day:announceDeaths".to_string()
    } else {
        format!("day{target_cycle}:announceDeaths")
    };
    for _ in 0..512 {
        let state = replay(&events);
        assert_eq!(state["ok"], true, "replay failed: {state}");
        if state["value"]["currentStep"]["id"] == wanted {
            return events;
        }
        let command = command_for_current_step(&events, &state);
        append(&mut events, command);
    }
    panic!("day {target_cycle} was not reached")
}

#[test]
fn one_three_and_six_cycle_tb_prefixes_replay_with_linear_structural_counts() {
    for cycle in [1, 3, 6] {
        let events = fixture_at_day(cycle);
        reset_tb_operation_counts();
        let state = replay(&events);
        assert_eq!(state["ok"], true, "cycle {cycle} replay failed: {state}");
        let (player_passes, event_applications, phase_builds) = tb_operation_counts();
        assert_eq!(player_passes, 1, "cycle {cycle} rebuilt Players");
        assert_eq!(event_applications, events.len() - 1);
        assert!(
            phase_builds <= events.len() + 1,
            "cycle {cycle}: {phase_builds} phase builds for {} events",
            events.len()
        );
        for prefix in 0..=events.len() {
            let replayed = replay(&events[..prefix]);
            assert_eq!(
                replayed["ok"], true,
                "cycle {cycle} prefix {prefix}: {replayed}"
            );
            assert_eq!(replayed["value"]["eventCount"], prefix);
        }
    }
}

#[test]
fn tb_proposal_builds_one_validated_replay_context() {
    let events = fixture_at_day(3);
    let state = replay(&events);
    let command = command_for_current_step(&events, &state);
    reset_tb_operation_counts();
    let proposed: Value = serde_json::from_str(&propose_json(
        &game(&events).to_string(),
        &command.to_string(),
    ))
    .expect("proposal response");
    assert_eq!(proposed["ok"], true, "proposal failed: {proposed}");
    let (player_passes, event_applications, phase_builds) = tb_operation_counts();
    assert_eq!(player_passes, 1);
    assert_eq!(event_applications, events.len() - 1);
    assert!(phase_builds <= events.len() + 1);
}

#[test]
fn six_cycle_tb_session_covers_required_lifecycle_events_and_rules_owned_game_end_source() {
    let mut events = advance_to_day(6);
    for _ in 0..64 {
        let state = replay(&events);
        if state["value"]["warnings"]
            .as_array()
            .is_some_and(|warnings| {
                warnings
                    .iter()
                    .any(|warning| warning["code"] == "SAINT_EXECUTED_EVIL_WIN")
            })
        {
            break;
        }
        let command = command_for_current_step(&events, &state);
        append(&mut events, command);
    }
    let warning_state = replay(&events);
    assert!(warning_state["value"]["warnings"]
        .as_array()
        .is_some_and(|warnings| warnings
            .iter()
            .any(|warning| warning["code"] == "SAINT_EXECUTED_EVIL_WIN")));
    let expected_event_count = events.len();
    append(
        &mut events,
        json!({
            "type": "endGame",
            "payload": { "winningTeam": "evil", "expectedEventCount": expected_event_count }
        }),
    );
    if std::env::var("UPDATE_ISSUE140_TB_FIXTURE").as_deref() == Ok("1") {
        let path = concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../fixtures/acceptance/trouble-brewing/issue-140-six-cycle-session.json"
        );
        std::fs::write(
            path,
            format!(
                "{}\n",
                serde_json::to_string_pretty(&game(&events)).unwrap()
            ),
        )
        .expect("write issue 140 fixture");
    }
    let fixture = six_cycle_fixture();
    assert_eq!(
        game(&events),
        fixture,
        "six-cycle generator drifted from its fixture"
    );
    let ended = replay(&events);
    assert_eq!(ended["value"]["gameEnd"]["winningTeam"], "evil");
    assert_eq!(ended["value"]["gameEnd"]["cause"], "saintExecution");
    let source_event_id = events.last().expect("game end")["payload"]["source"]["sourceEventId"]
        .as_str()
        .expect("rules-owned game end source");
    assert_eq!(
        events.last().expect("game end")["payload"]["source"]["kind"],
        "saintExecution"
    );
    assert!(events
        .iter()
        .any(|event| { event["id"] == source_event_id && event["type"] == "deathConfirmed" }));
    assert_eq!(replay(&events[..events.len() - 1]), warning_state);

    let event_types = events
        .iter()
        .filter_map(|event| event["type"].as_str())
        .collect::<HashSet<_>>();
    for required in [
        "setupConfirmed",
        "phaseStepConfirmed",
        "nominationStarted",
        "nominationVoteConfirmed",
        "executionConfirmed",
        "deathConfirmed",
        "nightActionResolved",
        "demonSuccessionConfirmed",
        "gameEnded",
    ] {
        assert!(event_types.contains(required), "missing {required}");
    }
}

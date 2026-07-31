use std::collections::HashSet;

use crate::{
    characters::{
        reset_snv_event_application_count, reset_snv_phase_step_build_count,
        reset_snv_replay_player_pass_count, snv_event_application_count,
        snv_phase_step_build_count, snv_replay_player_pass_count,
    },
    propose_json, replay_json,
};
use serde_json::{json, Value};

use super::support::snv_demon_bluff_input;

fn setup_event() -> Value {
    json!({
        "id": "setup-long-session",
        "type": "setupConfirmed",
        "phase": "setup",
        "payload": { "players": [
            { "id": "player-1", "seat": 1, "name": "Pit-Hag", "actualCharacter": "pitHag", "shownCharacter": "pitHag" },
            { "id": "player-2", "seat": 2, "name": "Savant", "actualCharacter": "savant", "shownCharacter": "savant" },
            { "id": "player-3", "seat": 3, "name": "Philosopher", "actualCharacter": "philosopher", "shownCharacter": "philosopher" },
            { "id": "player-4", "seat": 4, "name": "Artist", "actualCharacter": "artist", "shownCharacter": "artist" },
            { "id": "player-5", "seat": 5, "name": "Mutant", "actualCharacter": "mutant", "shownCharacter": "mutant" },
            { "id": "player-6", "seat": 6, "name": "Sage", "actualCharacter": "sage", "shownCharacter": "sage" },
            { "id": "player-7", "seat": 7, "name": "Fang Gu", "actualCharacter": "fangGu", "shownCharacter": "fangGu" }
        ] },
        "summary": "long session setup",
        "createdAt": "2026-07-27T00:00:00.000Z"
    })
}

fn game(events: &[Value]) -> Value {
    json!({
        "schemaVersion": 3,
        "game": {
            "id": "game-issue-130",
            "name": "Architecture long session",
            "scriptId": "sectsAndViolets",
            "createdAt": "2026-07-27T00:00:00.000Z",
            "updatedAt": "2026-07-27T00:00:00.000Z",
            "events": events
        }
    })
}

fn replay(events: &[Value]) -> Value {
    serde_json::from_str(&replay_json(&game(events).to_string())).expect("replay response")
}

fn append(events: &mut Vec<Value>, command: Value) {
    let proposed: Value = serde_json::from_str(&propose_json(
        &game(events).to_string(),
        &command.to_string(),
    ))
    .expect("proposal response");
    assert_eq!(proposed["ok"], true, "proposal failed: {proposed}");
    events.push(proposed["value"]["event"].clone());
}

fn command_for_current_step(state: &Value, event_count: usize) -> Value {
    let step = &state["value"]["currentStep"];
    let step_id = step["id"].as_str().expect("current step id");
    if step["support"] == "manual" {
        return json!({
            "type": "resolveManualStep",
            "payload": {
                "stepId": step_id,
                "outcome": "handled",
                "expectedEventCount": event_count
            }
        });
    }

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
        "characterIds" if step_id == "firstNight:demonInfo" => json!({
            "type": "confirmStep",
            "payload": {
                "stepId": step_id,
                "expectedEventCount": event_count,
                "input": snv_demon_bluff_input(step)
            }
        }),
        "nomination"
            if state["value"]["dayState"]["nominations"]
                .as_array()
                .is_some_and(Vec::is_empty) =>
        {
            json!({
                "type": "confirmStep",
                "payload": {
                    "stepId": step_id,
                    "expectedEventCount": event_count,
                    "input": {
                        "nominatorId": state["value"]["dayState"]["eligibleNominatorIds"][0].clone(),
                        "nomineeId": state["value"]["dayState"]["eligibleNomineeIds"][0].clone()
                    }
                }
            })
        }
        "nomination" => json!({
            "type": "skipStep",
            "payload": { "stepId": step_id, "expectedEventCount": event_count }
        }),
        "nominationVote" => json!({
            "type": "confirmStep",
            "payload": {
                "stepId": step_id,
                "expectedEventCount": event_count,
                "input": { "voterIds": [] }
            }
        }),
        "executionDecision" => json!({
            "type": "confirmStep",
            "payload": {
                "stepId": step_id,
                "expectedEventCount": event_count,
                "input": { "execute": false }
            }
        }),
        "characterTransformation" => json!({
            "type": "confirmStep",
            "payload": {
                "stepId": step_id,
                "expectedEventCount": event_count,
                "input": {
                    "playerIds": ["player-2"],
                    "characterIds": ["dreamer"]
                }
            }
        }),
        "playerIds" if step_id.contains(":demon:") => json!({
            "type": "confirmStep",
            "payload": {
                "stepId": step_id,
                "expectedEventCount": event_count,
                "input": { "playerIds": ["player-6"] }
            }
        }),
        "playerIds" if step["stepType"] == "pitHagArbitraryDeaths" => json!({
            "type": "confirmStep",
            "payload": {
                "stepId": step_id,
                "expectedEventCount": event_count,
                "input": { "playerIds": [] }
            }
        }),
        _ => json!({
            "type": "confirmStep",
            "payload": {
                "stepId": step_id,
                "expectedEventCount": event_count,
                "input": null,
                "deliveredResult": step["informationPrompt"]["computedResult"].clone()
            }
        }),
    }
}

fn advance_to_day(target_cycle: usize) -> (Vec<Value>, Value) {
    let mut events = vec![setup_event()];
    let mut state_before_last = replay(&events);
    let wanted_step_id = if target_cycle == 1 {
        "day:announceDeaths".to_string()
    } else {
        format!("day{target_cycle}:announceDeaths")
    };
    for _ in 0..256 {
        let state = replay(&events);
        assert_eq!(state["ok"], true, "replay failed: {state}");
        if state["value"]["currentStep"]["id"] == wanted_step_id {
            return (events, state_before_last);
        }
        if let Some(assignment) =
            state["value"]["madnessAssignments"]
                .as_array()
                .and_then(|assignments| {
                    assignments.iter().find(|assignment| {
                        assignment["status"] == "unchecked" && assignment["canCheck"] == true
                    })
                })
        {
            state_before_last = state.clone();
            let event_count = events.len();
            append(
                &mut events,
                json!({
                    "type": "recordMadnessCheck",
                    "payload": {
                        "assignmentId": assignment["assignmentId"].clone(),
                        "expectedEventCount": event_count,
                        "result": "clear"
                    }
                }),
            );
            continue;
        }
        state_before_last = state.clone();
        let event_count = events.len();
        append(&mut events, command_for_current_step(&state, event_count));
    }
    panic!("day {target_cycle} was not reached");
}

#[test]
fn a_six_cycle_snv_session_has_replayable_unique_prefixes_and_exact_undo() {
    let (events, state_before_last) = advance_to_day(6);
    assert!(
        events.len() > 40,
        "fixture is not a long session: {}",
        events.len()
    );

    let mut ids = HashSet::new();
    for event in &events {
        assert!(
            ids.insert(event["id"].as_str().expect("event id")),
            "duplicate event id: {}",
            event["id"]
        );
    }
    let event_types = events
        .iter()
        .filter_map(|event| event["type"].as_str())
        .collect::<HashSet<_>>();
    for required in [
        "nominationStarted",
        "nominationVoteConfirmed",
        "nightActionResolved",
        "madnessCheckRecorded",
        "pitHagTransformationResolved",
    ] {
        assert!(
            event_types.contains(required),
            "long fixture is missing {required}"
        );
    }
    let replayed = replay(&events);
    assert!(
        replayed["value"]["players"]
            .as_array()
            .is_some_and(|players| players.iter().any(|player| {
                player["abilityInstance"]["sourceEventId"] != "setup"
                    && player["identityHistory"]
                        .as_array()
                        .is_some_and(|history| !history.is_empty())
            })),
        "long fixture is missing a changed identity and acquired ability instance"
    );

    for event_count in 1..=events.len() {
        let prefix_state = replay(&events[..event_count]);
        assert_eq!(
            prefix_state["ok"], true,
            "prefix {event_count} failed: {prefix_state}"
        );
        assert_eq!(prefix_state["value"]["eventCount"], event_count);
    }

    let undone = replay(&events[..events.len() - 1]);
    assert_eq!(undone, state_before_last);
}

#[test]
fn long_session_replay_keeps_current_operation_budgets_at_one_three_and_six_cycles() {
    for cycle in [1, 3, 6] {
        let (events, _) = advance_to_day(cycle);
        reset_snv_replay_player_pass_count();
        reset_snv_event_application_count();
        reset_snv_phase_step_build_count();

        let replayed = replay(&events);

        assert_eq!(
            replayed["ok"], true,
            "cycle {cycle} replay failed: {replayed}"
        );
        assert_eq!(
            snv_replay_player_pass_count(),
            1,
            "cycle {cycle} rebuilt the player timeline"
        );
        assert_eq!(
            snv_event_application_count(),
            events.len() - 1,
            "cycle {cycle} did not apply every post-setup event exactly once"
        );
        assert!(
            snv_phase_step_build_count() <= events.len() * 4,
            "cycle {cycle} built {} phase sequences for {} events",
            snv_phase_step_build_count(),
            events.len(),
        );
    }
}

#[test]
fn import_rejects_duplicate_event_ids_before_replay() {
    let mut events = vec![setup_event()];
    events.push(json!({
        "id": "setup-long-session",
        "type": "playerAnnotationsUpdated",
        "phase": "setup",
        "payload": {
            "playerId": "player-1",
            "systemTokenIds": [],
            "scriptTokens": [],
            "notes": "duplicate id"
        },
        "summary": "duplicate",
        "createdAt": "2026-07-27T00:00:01.000Z"
    }));

    let result = replay(&events);

    assert_eq!(result["error"]["code"], "DUPLICATE_EVENT_ID", "{result}");
}

#[test]
fn import_rejects_a_missing_source_event_reference() {
    let mut events = vec![setup_event()];
    events.push(json!({
        "id": "orphan-deaths",
        "type": "pitHagArbitraryDeathsConfirmed",
        "phase": "night",
        "payload": {
            "stepId": "night:pitHagArbitraryDeaths",
            "sourceTransformationEventId": "missing-transformation",
            "deaths": []
        },
        "summary": "orphan",
        "createdAt": "2026-07-27T00:00:01.000Z"
    }));

    let result = replay(&events);

    assert_eq!(
        result["error"]["code"], "INVALID_EVENT_REFERENCE",
        "{result}"
    );
}

#[test]
fn import_rejects_a_source_reference_that_points_forward_in_history() {
    let mut events = vec![setup_event()];
    events.push(json!({
        "id": "deaths-before-transformation",
        "type": "pitHagArbitraryDeathsConfirmed",
        "phase": "night",
        "payload": {
            "stepId": "night:pitHagArbitraryDeaths",
            "sourceTransformationEventId": "later-transformation",
            "deaths": []
        },
        "summary": "forward reference",
        "createdAt": "2026-07-27T00:00:01.000Z"
    }));
    events.push(json!({
        "id": "later-transformation",
        "type": "pitHagTransformationResolved",
        "phase": "night",
        "payload": {
            "stepId": "night:pitHag:player-1",
            "actorPlayerId": "player-1",
            "targetPlayerId": "player-2",
            "characterId": "dreamer",
            "outcome": { "kind": "noChange", "reason": "characterAlreadyInPlay" }
        },
        "summary": "later transformation",
        "createdAt": "2026-07-27T00:00:02.000Z"
    }));

    let result = replay(&events);

    assert_eq!(
        result["error"]["code"], "INVALID_EVENT_REFERENCE",
        "{result}"
    );
}

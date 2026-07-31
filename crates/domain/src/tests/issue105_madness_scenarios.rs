use crate::{propose_json, replay_json};
use serde_json::{json, Value};

fn setup_event() -> Value {
    json!({
        "id": "setup-1",
        "type": "setupConfirmed",
        "phase": "setup",
        "payload": { "players": [
            { "id": "player-1", "seat": 1, "name": "민지", "actualCharacter": "savant", "shownCharacter": "savant" },
            { "id": "player-2", "seat": 2, "name": "현우", "actualCharacter": "artist", "shownCharacter": "artist" },
            { "id": "player-3", "seat": 3, "name": "서준", "actualCharacter": "juggler", "shownCharacter": "juggler" },
            { "id": "player-4", "seat": 4, "name": "도윤", "actualCharacter": "mutant", "shownCharacter": "mutant" },
            { "id": "player-5", "seat": 5, "name": "유나", "actualCharacter": "witch", "shownCharacter": "witch" },
            { "id": "player-6", "seat": 6, "name": "하린", "actualCharacter": "cerenovus", "shownCharacter": "cerenovus" },
            { "id": "player-7", "seat": 7, "name": "준호", "actualCharacter": "fangGu", "shownCharacter": "fangGu" }
        ]},
        "summary": "초기 설정 확정: 7명",
        "createdAt": "2026-07-26T00:00:00.000Z"
    })
}

fn phase_event(event_type: &str, step_id: &str) -> Value {
    let payload = if event_type == "manualPhaseStepResolved" {
        json!({ "stepId": step_id, "outcome": "handled" })
    } else {
        json!({ "stepId": step_id, "input": null })
    };
    json!({
        "id": format!("evt-{step_id}"),
        "type": event_type,
        "phase": step_id.split(':').next().unwrap(),
        "payload": payload,
        "summary": step_id,
        "createdAt": "2026-07-26T00:00:00.000Z"
    })
}

fn cerenovus_assignment_event() -> Value {
    json!({
        "id": "evt-ceren-assignment",
        "type": "madnessAssigned",
        "phase": "firstNight",
        "payload": {
            "stepId": "firstNight:cerenovus",
            "sourcePlayerId": "player-6",
            "targetPlayerId": "player-4",
            "requiredCharacterId": "clockmaker"
        },
        "summary": "세레노버스 집착 지정: 4번 도윤 · 시계공",
        "createdAt": "2026-07-26T00:01:00.000Z"
    })
}

fn first_night_before_cerenovus() -> Vec<Value> {
    vec![
        setup_event(),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event("manualPhaseStepResolved", "firstNight:witch"),
    ]
}

fn first_day_events() -> Vec<Value> {
    let mut events = first_night_before_cerenovus();
    events.push(cerenovus_assignment_event());
    events.push(phase_event("phaseStepConfirmed", "firstNight:toDay"));
    events
}

fn game(events: Vec<Value>) -> Value {
    json!({
        "schemaVersion": 3,
        "game": {
            "id": "game-issue-105",
            "name": "Issue 105 madness",
            "scriptId": "sectsAndViolets",
            "createdAt": "2026-07-26T00:00:00.000Z",
            "updatedAt": "2026-07-26T00:10:00.000Z",
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

fn check_command(events: &[Value], assignment_id: &str, result: &str) -> Value {
    json!({
        "type": "recordMadnessCheck",
        "payload": {
            "assignmentId": assignment_id,
            "expectedEventCount": events.len(),
            "result": result
        }
    })
}

fn execute_command(events: &[Value], assignment_id: &str) -> Value {
    json!({
        "type": "executeMadness",
        "payload": {
            "assignmentId": assignment_id,
            "expectedEventCount": events.len()
        }
    })
}

fn append_proposal(events: &mut Vec<Value>, command: Value) -> Value {
    let proposal = propose(events, command);
    assert_eq!(proposal["ok"], true, "proposal failed as {proposal}");
    events.push(proposal["value"]["event"].clone());
    proposal
}

fn append_check(events: &mut Vec<Value>, assignment_id: &str, result: &str) -> Value {
    let command = check_command(events, assignment_id, result);
    append_proposal(events, command)
}

fn append_execution(events: &mut Vec<Value>, assignment_id: &str) -> Value {
    let command = execute_command(events, assignment_id);
    append_proposal(events, command)
}

fn assignment<'a>(state: &'a Value, assignment_id: &str) -> &'a Value {
    state["value"]["madnessAssignments"]
        .as_array()
        .unwrap()
        .iter()
        .find(|assignment| assignment["assignmentId"] == assignment_id)
        .unwrap()
}

#[test]
fn cerenovus_night_action_confirms_an_explicit_good_character_assignment() {
    let mut events = first_night_before_cerenovus();
    let before = replay(&events);
    assert_eq!(before["value"]["currentStep"]["id"], "firstNight:cerenovus");
    assert_eq!(
        before["value"]["currentStep"]["requiredInput"]["kind"],
        "madnessAssignment"
    );

    let assigned = propose(
        &events,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "firstNight:cerenovus",
                "input": { "playerIds": ["player-4"], "characterId": "clockmaker" }
            }
        }),
    );
    assert_eq!(assigned["ok"], true, "{assigned}");
    assert_eq!(assigned["value"]["event"]["type"], "madnessAssigned");
    assert_eq!(
        assigned["value"]["event"]["payload"],
        json!({
            "stepId": "firstNight:cerenovus",
            "sourcePlayerId": "player-6",
            "targetPlayerId": "player-4",
            "requiredCharacterId": "clockmaker"
        })
    );
    events.push(assigned["value"]["event"].clone());
    let after = replay(&events);
    assert_eq!(
        after["value"]["pendingIdentityReveals"],
        json!([{
            "sourceEventId": assigned["value"]["event"]["id"],
            "sequence": 1,
            "payload": {
                "kind": "madnessAssignment",
                "playerId": "player-4",
                "characterId": "clockmaker"
            }
        }])
    );

    let evil_character = propose(
        &first_night_before_cerenovus(),
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "firstNight:cerenovus",
                "input": { "playerIds": ["player-4"], "characterId": "witch" }
            }
        }),
    );
    assert_eq!(evil_character["error"]["code"], "INVALID_STEP_INPUT");
}

#[test]
fn overlapping_assignments_replay_independently_and_violation_latches_until_undo() {
    let mut events = first_day_events();
    let initial = replay(&events);
    assert_eq!(initial["ok"], true, "{initial}");
    assert_eq!(
        initial["value"]["madnessAssignments"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
    assert_eq!(
        assignment(&initial, "mutant:player-4:setup-1")["status"],
        "unchecked"
    );
    assert_eq!(
        assignment(&initial, "evt-ceren-assignment")["requiredCharacterId"],
        "clockmaker"
    );

    append_check(&mut events, "mutant:player-4:setup-1", "clear");
    let clear_events = events.clone();
    let clear = replay(&events);
    assert_eq!(
        assignment(&clear, "mutant:player-4:setup-1")["status"],
        "clear"
    );

    let duplicate = propose(
        &events,
        check_command(&events, "mutant:player-4:setup-1", "clear"),
    );
    assert_eq!(duplicate["error"]["code"], "MADNESS_CHECK_UNCHANGED");

    append_check(&mut events, "mutant:player-4:setup-1", "violation");
    let violated = replay(&events);
    assert_eq!(
        assignment(&violated, "mutant:player-4:setup-1")["status"],
        "violated"
    );
    assert_eq!(
        assignment(&violated, "evt-ceren-assignment")["status"],
        "unchecked"
    );
    assert_eq!(
        assignment(&violated, "mutant:player-4:setup-1")["canExecute"],
        true
    );

    let latched = propose(
        &events,
        check_command(&events, "mutant:player-4:setup-1", "clear"),
    );
    assert_eq!(latched["error"]["code"], "MADNESS_VIOLATION_LATCHED");

    let undone = replay(&clear_events);
    assert_eq!(
        assignment(&undone, "mutant:player-4:setup-1")["status"],
        "clear"
    );
}

#[test]
fn madness_execution_can_be_confirmed_without_a_check_event() {
    let mut events = first_day_events();
    let execution = append_execution(&mut events, "evt-ceren-assignment");

    assert_eq!(
        execution["value"]["event"]["type"],
        "madnessExecutionConfirmed"
    );
    assert!(execution["value"]["event"]["payload"]
        .get("checkEventId")
        .is_none());

    let pending = replay(&events);
    assert_eq!(pending["ok"], true, "{pending}");
    assert_eq!(
        pending["value"]["pendingMadnessExecution"]["assignmentId"],
        "evt-ceren-assignment"
    );
}

#[test]
fn cerenovus_assignment_clears_when_its_source_dies() {
    let mut events = first_day_events();
    for step_id in ["day:announceDeaths", "day:whisper", "day:discussion"] {
        events.push(phase_event("phaseStepConfirmed", step_id));
    }
    append_proposal(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "day:nomination:1",
                "input": { "nominatorId": "player-1", "nomineeId": "player-6" }
            }
        }),
    );
    append_proposal(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "day:nomination:1:vote",
                "input": { "voterIds": ["player-1", "player-2", "player-3", "player-4"] }
            }
        }),
    );
    append_proposal(
        &mut events,
        json!({ "type": "skipStep", "payload": { "stepId": "day:nomination:2" } }),
    );
    append_proposal(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": { "stepId": "day:execution", "input": { "execute": true } }
        }),
    );

    let pending = replay(&events);
    let death_step_id = pending["value"]["currentStep"]["id"].as_str().unwrap();
    append_proposal(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": { "stepId": death_step_id, "input": { "died": true } }
        }),
    );

    let after_death = replay(&events);
    assert_eq!(after_death["value"]["players"][5]["alive"], false);
    let assignments = after_death["value"]["madnessAssignments"]
        .as_array()
        .expect("the living Mutant assignment remains available");
    assert!(assignments
        .iter()
        .any(|assignment| assignment["sourceCharacterId"] == "mutant"));
    assert!(!assignments
        .iter()
        .any(|assignment| assignment["sourceCharacterId"] == "cerenovus"));
}

#[test]
fn daytime_madness_execution_ends_the_day_and_requires_death_confirmation() {
    let mut events = first_day_events();
    append_check(&mut events, "evt-ceren-assignment", "violation");
    let execution = append_execution(&mut events, "evt-ceren-assignment");
    assert_eq!(
        execution["value"]["event"]["type"],
        "madnessExecutionConfirmed"
    );
    assert_eq!(
        execution["value"]["event"]["payload"]["interruptedStepId"],
        "day:announceDeaths"
    );

    let pending = replay(&events);
    assert_eq!(pending["ok"], true, "{pending}");
    assert_eq!(pending["value"]["phase"], "day");
    assert_eq!(
        pending["value"]["currentStep"]["stepType"],
        "executionDeath"
    );
    assert_eq!(pending["value"]["currentStep"]["playerId"], "player-4");
    assert_eq!(
        pending["value"]["pendingMadnessExecution"]["sourceCharacterId"],
        "cerenovus"
    );
    assert!(pending["value"]["phaseOverview"]
        .as_array()
        .unwrap()
        .iter()
        .any(|step| { step["id"] == "day:announceDeaths" && step["status"] == "skipped" }));

    let death_step_id = pending["value"]["currentStep"]["id"].as_str().unwrap();
    append_proposal(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": { "stepId": death_step_id, "input": { "died": true } }
        }),
    );
    let resumed = replay(&events);
    assert_eq!(resumed["value"]["phase"], "night");
    assert_eq!(resumed["value"]["currentStep"]["id"], "night:witch");
    assert_eq!(resumed["value"]["players"][3]["alive"], false);
    assert!(resumed["value"].get("pendingMadnessExecution").is_none());
    assert!(
        resumed["value"].get("madnessAssignments").is_none(),
        "the executed Cerenovus reminder and the dead target's Mutant action must be cleared"
    );
}

#[test]
fn nighttime_madness_execution_returns_to_the_interrupted_night_step() {
    let mut events = first_day_events();
    append_check(&mut events, "mutant:player-4:setup-1", "violation");
    for step_id in ["day:announceDeaths", "day:whisper", "day:discussion"] {
        events.push(phase_event("phaseStepConfirmed", step_id));
    }
    events.push(json!({
        "id": "evt-day-nominations-closed",
        "type": "phaseStepSkipped",
        "phase": "day",
        "payload": { "stepId": "day:nomination:1" },
        "summary": "지명 종료",
        "createdAt": "2026-07-26T00:03:00.000Z"
    }));
    events.push(json!({
        "id": "evt-day-no-execution",
        "type": "noExecutionConfirmed",
        "phase": "day",
        "payload": { "stepId": "day:execution", "input": { "execute": false, "playerId": null } },
        "summary": "처형 없음",
        "createdAt": "2026-07-26T00:04:00.000Z"
    }));
    events.push(phase_event("phaseStepConfirmed", "day:toNight"));
    let before = replay(&events);
    assert_eq!(before["value"]["currentStep"]["id"], "night:witch");

    append_execution(&mut events, "mutant:player-4:setup-1");
    let pending = replay(&events);
    assert_eq!(pending["value"]["phase"], "night");
    assert_eq!(
        pending["value"]["pendingMadnessExecution"]["interruptedStepId"],
        "night:witch"
    );
    assert!(pending["value"]["phaseOverview"]
        .as_array()
        .unwrap()
        .iter()
        .any(|step| { step["id"] == "night:witch" && step["status"] == "interrupted" }));

    let death_step_id = pending["value"]["currentStep"]["id"].as_str().unwrap();
    append_proposal(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": { "stepId": death_step_id, "input": { "died": true } }
        }),
    );
    let resumed = replay(&events);
    assert_eq!(resumed["value"]["phase"], "night");
    assert_eq!(resumed["value"]["currentStep"]["id"], "night:witch");
    assert_eq!(resumed["value"]["phaseOverview"][0]["status"], "current");
    assert!(
        resumed["value"].get("madnessAssignments").is_none(),
        "the executed Mutant reminder must be cleared once its target is dead"
    );
}

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
            { "id": "player-5", "seat": 5, "name": "유나", "actualCharacter": "klutz", "shownCharacter": "klutz" },
            { "id": "player-6", "seat": 6, "name": "하린", "actualCharacter": "evilTwin", "shownCharacter": "evilTwin" },
            { "id": "player-7", "seat": 7, "name": "준호", "actualCharacter": "fangGu", "shownCharacter": "fangGu" }
        ]},
        "summary": "초기 설정 확정: 7명",
        "createdAt": "2026-07-25T00:00:00.000Z"
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
        "createdAt": "2026-07-25T00:00:00.000Z"
    })
}

fn first_day_events() -> Vec<Value> {
    vec![
        setup_event(),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event("manualPhaseStepResolved", "firstNight:evilTwin"),
        phase_event("phaseStepConfirmed", "firstNight:toDay"),
    ]
}

fn game(events: Vec<Value>) -> Value {
    json!({
        "schemaVersion": 3,
        "game": {
            "id": "game-issue-102",
            "name": "Issue 102 day actions",
            "scriptId": "sectsAndViolets",
            "createdAt": "2026-07-25T00:00:00.000Z",
            "updatedAt": "2026-07-25T00:05:00.000Z",
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

fn day_action_command(events: &[Value], actor_player_id: &str, record: Value) -> Value {
    json!({
        "type": "recordDayAction",
        "payload": {
            "dayId": "day",
            "expectedEventCount": events.len(),
            "actorPlayerId": actor_player_id,
            "record": record
        }
    })
}

#[test]
fn first_day_exposes_only_the_three_available_character_actions() {
    let state = replay(&first_day_events());
    assert_eq!(state["ok"], true, "{state}");
    assert_eq!(state["value"]["phase"], "day");
    assert_eq!(
        state["value"]["availableDayActions"],
        json!([
            { "actorPlayerId": "player-1", "characterId": "savant", "dayId": "day", "activeReasons": [] },
            { "actorPlayerId": "player-2", "characterId": "artist", "dayId": "day", "activeReasons": [] },
            { "actorPlayerId": "player-3", "characterId": "juggler", "dayId": "day", "activeReasons": [] }
        ])
    );
    assert!(state["value"].get("dayActionRecords").is_none());
}

#[test]
fn artist_question_is_replayable_once_per_game_and_undo_restores_the_opportunity() {
    let events = first_day_events();
    let proposal = propose(
        &events,
        day_action_command(
            &events,
            "player-2",
            json!({
                "kind": "artist",
                "question": "악마가 홀수 번호 좌석에 있나요?",
                "answer": "no",
                "truthful": true
            }),
        ),
    );
    assert_eq!(proposal["ok"], true, "{proposal}");
    assert_eq!(proposal["value"]["event"]["type"], "dayActionRecorded");
    assert_eq!(proposal["value"]["revealPayload"], Value::Null);

    let mut used_events = events.clone();
    used_events.push(proposal["value"]["event"].clone());
    let used = replay(&used_events);
    assert_eq!(used["ok"], true, "{used}");
    assert_eq!(
        used["value"]["dayActionRecords"][0],
        json!({
            "eventId": "day-action-6",
            "dayId": "day",
            "actorPlayerId": "player-2",
            "characterId": "artist",
            "activeReasons": [],
            "record": {
                "kind": "artist",
                "question": "악마가 홀수 번호 좌석에 있나요?",
                "answer": "no",
                "truthful": true
            }
        })
    );
    assert!(used["value"]["availableDayActions"]
        .as_array()
        .unwrap()
        .iter()
        .all(|action| action["characterId"] != "artist"));

    let repeated = propose(
        &used_events,
        day_action_command(
            &used_events,
            "player-2",
            json!({ "kind": "artist", "question": "다시 질문", "answer": "yes", "truthful": true }),
        ),
    );
    assert_eq!(repeated["error"]["code"], "DAY_ACTION_UNAVAILABLE");

    let undone = replay(&events);
    assert!(undone["value"]["availableDayActions"]
        .as_array()
        .unwrap()
        .iter()
        .any(|action| action["characterId"] == "artist"));
}

#[test]
fn healthy_artist_and_savant_truth_flags_are_validated_without_calculating_semantics() {
    let events = first_day_events();
    let artist_false = propose(
        &events,
        day_action_command(
            &events,
            "player-2",
            json!({
                "kind": "artist",
                "question": "어떤 질문인가요?",
                "answer": "yes",
                "truthful": false
            }),
        ),
    );
    assert_eq!(artist_false["error"]["code"], "INVALID_DAY_ACTION_RECORD");

    let savant_both_true = propose(
        &events,
        day_action_command(
            &events,
            "player-1",
            json!({
                "kind": "savant",
                "statements": [
                    { "text": "첫 문장", "truthful": true },
                    { "text": "둘째 문장", "truthful": true }
                ]
            }),
        ),
    );
    assert_eq!(
        savant_both_true["error"]["code"],
        "INVALID_DAY_ACTION_RECORD"
    );
}

#[test]
fn impaired_day_actions_expose_poison_reason_and_allow_any_truth_pattern() {
    let mut events = first_day_events();
    events[0]["payload"]["players"][2]["actualCharacter"] = json!("noDashii");
    events[0]["payload"]["players"][2]["shownCharacter"] = json!("noDashii");
    let state = replay(&events);
    assert_eq!(state["ok"], true, "{state}");
    assert_eq!(
        state["value"]["availableDayActions"]
            .as_array()
            .unwrap()
            .iter()
            .find(|action| action["characterId"] == "artist")
            .unwrap()["activeReasons"],
        json!([{ "type": "poisoned", "poisonerPlayerId": "player-3", "poisonEventId": "setup-1" }])
    );

    let artist = propose(
        &events,
        day_action_command(
            &events,
            "player-2",
            json!({
                "kind": "artist",
                "question": "",
                "answer": "unknown",
                "truthful": false
            }),
        ),
    );
    assert_eq!(artist["ok"], true, "{artist}");

    let savant = propose(
        &events,
        day_action_command(
            &events,
            "player-1",
            json!({
                "kind": "savant",
                "statements": [
                    { "text": "", "truthful": true },
                    { "text": "둘째 문장", "truthful": true }
                ]
            }),
        ),
    );
    assert_eq!(savant["ok"], true, "{savant}");
}

#[test]
fn vortox_day_actions_require_false_truth_flags_and_persist_canonical_reason() {
    let mut events = first_day_events();
    events[0]["payload"]["players"][6]["actualCharacter"] = json!("vortox");
    events[0]["payload"]["players"][6]["shownCharacter"] = json!("vortox");
    let state = replay(&events);
    assert_eq!(state["ok"], true, "{state}");
    assert_eq!(
        state["value"]["availableDayActions"][0]["activeReasons"],
        json!([{ "type": "vortox", "demonPlayerId": "player-7" }])
    );

    let artist_true = propose(
        &events,
        day_action_command(
            &events,
            "player-2",
            json!({
                "kind": "artist",
                "question": "질문",
                "answer": "no",
                "truthful": true
            }),
        ),
    );
    assert_eq!(artist_true["error"]["code"], "INVALID_DAY_ACTION_RECORD");

    let artist_false = propose(
        &events,
        day_action_command(
            &events,
            "player-2",
            json!({
                "kind": "artist",
                "question": "질문",
                "answer": "no",
                "truthful": false
            }),
        ),
    );
    assert_eq!(artist_false["ok"], true, "{artist_false}");
    assert_eq!(
        artist_false["value"]["event"]["payload"]["activeReasons"],
        json!([{ "type": "vortox", "demonPlayerId": "player-7" }])
    );

    let mut tampered = events;
    tampered.push(artist_false["value"]["event"].clone());
    tampered[5]["payload"]["activeReasons"] = json!([]);
    let replayed = replay(&tampered);
    assert_eq!(replayed["ok"], false, "{replayed}");
    assert_eq!(replayed["error"]["code"], "REPLAY_FAILED");
}

#[test]
fn savant_records_two_statements_with_delivered_truth_metadata() {
    let events = first_day_events();
    let recorded = propose(
        &events,
        day_action_command(
            &events,
            "player-1",
            json!({
                "kind": "savant",
                "statements": [
                    { "text": "문장 1", "truthful": true },
                    { "text": "문장 2", "truthful": false }
                ]
            }),
        ),
    );
    assert_eq!(recorded["ok"], true, "{recorded}");
    assert_eq!(
        recorded["value"]["event"]["payload"]["record"],
        json!({
            "kind": "savant",
            "statements": [
                { "text": "문장 1", "truthful": true },
                { "text": "문장 2", "truthful": false }
            ]
        })
    );

    let too_many = propose(
        &events,
        day_action_command(
            &events,
            "player-1",
            json!({
                "kind": "savant",
                "statements": [
                    { "text": "문장 1", "truthful": true },
                    { "text": "문장 2", "truthful": false },
                    { "text": "문장 3", "truthful": true }
                ]
            }),
        ),
    );
    assert_eq!(too_many["error"]["code"], "MALFORMED_COMMAND");
}

#[test]
fn juggler_count_is_limited_to_five_and_drives_that_nights_information() {
    let mut events = first_day_events();
    let invalid = propose(
        &events,
        day_action_command(
            &events,
            "player-3",
            json!({ "kind": "juggler", "correctCount": 6 }),
        ),
    );
    assert_eq!(invalid["error"]["code"], "INVALID_DAY_ACTION_RECORD");

    let recorded = propose(
        &events,
        day_action_command(
            &events,
            "player-3",
            json!({ "kind": "juggler", "correctCount": 3 }),
        ),
    );
    assert_eq!(recorded["ok"], true, "{recorded}");
    events.push(recorded["value"]["event"].clone());

    for step_id in ["day:announceDeaths", "day:whisper", "day:discussion"] {
        events.push(phase_event("phaseStepConfirmed", step_id));
    }
    events.push(json!({
        "id": "evt-day-nomination-closed",
        "type": "phaseStepSkipped",
        "phase": "day",
        "payload": { "stepId": "day:nomination:1" },
        "summary": "지명 종료",
        "createdAt": "2026-07-25T00:10:00.000Z"
    }));
    events.push(json!({
        "id": "evt-day-no-execution",
        "type": "noExecutionConfirmed",
        "phase": "day",
        "payload": { "stepId": "day:execution", "input": { "execute": false, "playerId": null } },
        "summary": "처형 없음",
        "createdAt": "2026-07-25T00:11:00.000Z"
    }));
    events.push(phase_event("phaseStepConfirmed", "day:toNight"));

    let before_demon = replay(&events);
    assert_eq!(before_demon["ok"], true, "{before_demon}");
    assert!(before_demon["value"]["phaseOverview"]
        .as_array()
        .unwrap()
        .iter()
        .any(|step| step["id"] == "night:juggler"));

    let demon = propose(
        &events,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": before_demon["value"]["currentStep"]["id"],
                "input": { "playerIds": ["player-4"] }
            }
        }),
    );
    assert_eq!(demon["ok"], true, "{demon}");
    events.push(demon["value"]["event"].clone());

    let juggler = replay(&events);
    assert_eq!(juggler["ok"], true, "{juggler}");
    assert_eq!(juggler["value"]["currentStep"]["id"], "night:juggler");
    assert_eq!(
        juggler["value"]["currentStep"]["informationPrompt"]["computedResult"],
        json!({ "kind": "number", "value": 3 })
    );

    let revealed = propose(
        &events,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "night:juggler",
                "input": null,
                "deliveredResult": { "kind": "number", "value": 3 }
            }
        }),
    );
    assert_eq!(revealed["ok"], true, "{revealed}");
    assert_eq!(
        revealed["value"]["event"]["payload"]["information"]["computedResult"],
        json!({ "kind": "number", "value": 3 })
    );
    assert_eq!(
        revealed["value"]["event"]["payload"]["information"]["deliveredResult"],
        json!({ "kind": "number", "value": 3 })
    );
    assert_eq!(
        revealed["value"]["revealPayload"],
        json!({ "kind": "numericInformation", "characterId": "juggler", "value": 3 })
    );

    let mut legacy_events = events;
    legacy_events.push(phase_event("phaseStepConfirmed", "night:juggler"));
    let legacy = replay(&legacy_events);
    assert_eq!(legacy["ok"], true, "{legacy}");
}

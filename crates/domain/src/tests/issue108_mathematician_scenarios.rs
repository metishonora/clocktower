use crate::{propose_json, replay_json};
use serde_json::{json, Value};

use super::support::snv_demon_bluff_input;

fn setup_event(demon: &str) -> Value {
    let demon_name = if demon == "vortox" {
        "Vortox"
    } else {
        "No Dashii"
    };
    json!({
        "id": "setup-108",
        "type": "setupConfirmed",
        "phase": "setup",
        "payload": { "players": [
            { "id": "player-1", "seat": 1, "name": "Math", "actualCharacter": "mathematician", "shownCharacter": "mathematician" },
            { "id": "player-2", "seat": 2, "name": "Evil Twin", "actualCharacter": "evilTwin", "shownCharacter": "evilTwin" },
            { "id": "player-3", "seat": 3, "name": "Clockmaker", "actualCharacter": "clockmaker", "shownCharacter": "clockmaker" },
            { "id": "player-4", "seat": 4, "name": "Cerenovus", "actualCharacter": "cerenovus", "shownCharacter": "cerenovus" },
            { "id": "player-5", "seat": 5, "name": "Demon", "actualCharacter": demon, "shownCharacter": demon },
            { "id": "player-6", "seat": 6, "name": "Pit Hag", "actualCharacter": "pitHag", "shownCharacter": "pitHag" },
            { "id": "player-7", "seat": 7, "name": "Savant", "actualCharacter": "savant", "shownCharacter": "savant" },
            { "id": "player-8", "seat": 8, "name": "Oracle", "actualCharacter": "oracle", "shownCharacter": "oracle" }
        ]},
        "summary": format!("초기 설정 확정: {demon_name}"),
        "createdAt": "2026-08-01T00:00:00.000Z"
    })
}

fn setup_event_oracle_poison() -> Value {
    json!({
        "id": "setup-108-oracle",
        "type": "setupConfirmed",
        "phase": "setup",
        "payload": { "players": [
            { "id": "player-1", "seat": 1, "name": "Math", "actualCharacter": "mathematician", "shownCharacter": "mathematician" },
            { "id": "player-2", "seat": 2, "name": "Evil Twin", "actualCharacter": "evilTwin", "shownCharacter": "evilTwin" },
            { "id": "player-3", "seat": 3, "name": "Cerenovus", "actualCharacter": "cerenovus", "shownCharacter": "cerenovus" },
            { "id": "player-4", "seat": 4, "name": "Clockmaker", "actualCharacter": "clockmaker", "shownCharacter": "clockmaker" },
            { "id": "player-5", "seat": 5, "name": "Demon", "actualCharacter": "noDashii", "shownCharacter": "noDashii" },
            { "id": "player-6", "seat": 6, "name": "Pit Hag", "actualCharacter": "pitHag", "shownCharacter": "pitHag" },
            { "id": "player-7", "seat": 7, "name": "Oracle", "actualCharacter": "oracle", "shownCharacter": "oracle" },
            { "id": "player-8", "seat": 8, "name": "Savant", "actualCharacter": "savant", "shownCharacter": "savant" }
        ]},
        "summary": "초기 설정 확정: 수학자 공식 예시 1",
        "createdAt": "2026-08-01T00:00:00.000Z"
    })
}

fn game(events: &[Value]) -> Value {
    json!({
        "schemaVersion": 3,
        "game": {
            "id": "game-issue-108",
            "name": "Issue 108 Mathematician",
            "scriptId": "sectsAndViolets",
            "createdAt": "2026-08-01T00:00:00.000Z",
            "updatedAt": "2026-08-01T00:00:00.000Z",
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
        "proposal={proposal}, command={command}"
    );
    events.push(proposal["value"]["event"].clone());
    proposal
}

fn first_computed_choice(check: &Value) -> Value {
    check["choices"]
        .as_array()
        .expect("target information choices")
        .iter()
        .find(|choice| choice["isComputed"] == true)
        .expect("truthful target information choice")["result"]
        .clone()
}

fn first_false_choice(check: &Value) -> Value {
    check["choices"]
        .as_array()
        .expect("target information choices")
        .iter()
        .find(|choice| choice["isComputed"] == false)
        .expect("an impaired target information choice")["result"]
        .clone()
}

fn computed_number(step: &Value) -> u64 {
    step["informationPrompt"]["computedResult"]["value"]
        .as_u64()
        .expect("computed numeric information")
}

fn false_number(step: &Value) -> u64 {
    let truth = computed_number(step);
    step["informationPrompt"]["numberChoices"]
        .as_array()
        .expect("number choices")
        .iter()
        .find_map(|choice| {
            let value = choice["value"].as_u64()?;
            (value != truth).then_some(value)
        })
        .unwrap_or_else(|| if truth == 0 { 1 } else { truth - 1 })
}

fn confirm_information(events: &mut Vec<Value>, step: &Value, delivered: Option<Value>) -> Value {
    let step_id = step["id"].as_str().expect("step id");
    let mut payload = json!({ "stepId": step_id, "input": null });
    if let Some(check) = step["informationPrompt"]["targetChecks"]
        .as_array()
        .and_then(|checks| checks.first())
    {
        payload["input"] = json!({ "playerIds": check["targetPlayerIds"].clone() });
    }
    if let Some(delivered) = delivered {
        payload["deliveredResult"] = delivered;
    }
    append(events, json!({ "type": "confirmStep", "payload": payload }))
}

fn command_for_step(step: &Value) -> Value {
    let id = step["id"].as_str().expect("current step id");
    let kind = step["requiredInput"]["kind"].as_str().unwrap_or("none");
    if kind == "nomination" {
        return json!({ "type": "skipStep", "payload": { "stepId": id } });
    }
    if kind == "executionDecision" {
        return json!({ "type": "confirmStep", "payload": { "stepId": id, "input": { "execute": false } } });
    }
    if id == "firstNight:demonInfo" {
        return json!({ "type": "confirmStep", "payload": { "stepId": id, "input": snv_demon_bluff_input(step) } });
    }
    if kind == "madnessAssignment" {
        return json!({ "type": "confirmStep", "payload": { "stepId": id,
            "input": { "playerIds": ["player-1"], "characterId": "clockmaker" }
        }});
    }
    if kind == "characterTransformation" {
        return json!({ "type": "confirmStep", "payload": {
            "stepId": id,
            "input": { "playerIds": [step["playerId"].clone()], "characterIds": ["pitHag"] }
        }});
    }
    if kind == "playerIds" {
        let character = step["character"].as_str().unwrap_or_default();
        if matches!(character, "fangGu" | "vigormortis" | "noDashii" | "vortox") {
            return json!({ "type": "confirmStep", "payload": {
                "stepId": id, "input": { "playerIds": ["player-8"] }
            }});
        }
        if character == "dreamer" {
            let check = &step["informationPrompt"]["targetChecks"][0];
            return json!({ "type": "confirmStep", "payload": {
                "stepId": id,
                "input": { "playerIds": check["targetPlayerIds"].clone() },
                "deliveredResult": first_computed_choice(check)
            }});
        }
        let player_id = step["requiredInput"]["allowedPlayerIds"]
            .as_array()
            .and_then(|ids| ids.first())
            .cloned()
            .unwrap_or_else(|| json!("player-1"));
        return json!({ "type": "confirmStep", "payload": {
            "stepId": id, "input": { "playerIds": [player_id] }
        }});
    }
    if step["support"] == "manual" {
        return json!({ "type": "resolveManualStep", "payload": { "stepId": id, "outcome": "handled" } });
    }
    if step["informationPrompt"]["deliveryMode"] == "selectable" {
        let computed = &step["informationPrompt"]["computedResult"];
        if computed["kind"] == "number" {
            return json!({ "type": "confirmStep", "payload": {
                "stepId": id,
                "input": null,
                "deliveredResult": { "kind": "number", "value": computed_number(step) }
            }});
        }
    }
    json!({ "type": "confirmStep", "payload": { "stepId": id, "input": null } })
}

fn advance_until(events: &mut Vec<Value>, wanted: impl Fn(&Value) -> bool) -> Value {
    let mut last_id = String::new();
    for _ in 0..64 {
        let state = replay(events);
        assert_eq!(state["ok"], true, "{state}");
        last_id = state["value"]["currentStep"]["id"]
            .as_str()
            .unwrap_or_default()
            .to_string();
        if wanted(&state) {
            return state;
        }
        let command = command_for_step(&state["value"]["currentStep"]);
        append(events, command);
    }
    panic!("wanted phase step was not reached (last step {last_id})")
}

fn advance_to_math(events: &mut Vec<Value>) -> Value {
    advance_until(events, |state| {
        state["value"]["currentStep"]["character"] == "mathematician"
    })
}

fn advance_to_clockmaker(events: &mut Vec<Value>) -> Value {
    advance_until(events, |state| {
        state["value"]["currentStep"]["character"] == "clockmaker"
    })
}

fn execute_nominee(events: &mut Vec<Value>, nominee_id: &str, day_prefix: &str) {
    let announce = advance_until(events, |state| {
        state["value"]["currentStep"]["id"] == day_prefix
    });
    let day_step = &announce["value"]["currentStep"];
    confirm_information(events, day_step, None);
    let whisper = replay(events);
    confirm_information(events, &whisper["value"]["currentStep"], None);
    let discussion = replay(events);
    confirm_information(events, &discussion["value"]["currentStep"], None);
    let nomination = replay(events);
    let nomination_id = nomination["value"]["currentStep"]["id"].as_str().unwrap();
    append(
        events,
        json!({ "type": "confirmStep", "payload": {
            "stepId": nomination_id,
            "input": { "nominatorId": "player-1", "nomineeId": nominee_id }
        }}),
    );
    let vote = replay(events);
    let threshold = vote["value"]["dayState"]["executionVoteThreshold"]
        .as_u64()
        .unwrap() as usize;
    let voters = vote["value"]["players"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|player| player["alive"] == true && player["id"] != nominee_id)
        .filter_map(|player| player["id"].as_str())
        .take(threshold)
        .map(str::to_string)
        .collect::<Vec<_>>();
    append(
        events,
        json!({ "type": "confirmStep", "payload": {
            "stepId": vote["value"]["currentStep"]["id"],
            "input": { "voterIds": voters }
        }}),
    );
    let after_vote = replay(events);
    if after_vote["value"]["currentStep"]["requiredInput"]["kind"] == "nomination" {
        append(
            events,
            json!({ "type": "skipStep", "payload": {
                "stepId": after_vote["value"]["currentStep"]["id"]
            }}),
        );
    }
    let execution = replay(events);
    assert_eq!(
        execution["value"]["currentStep"]["requiredInput"]["kind"],
        "executionDecision"
    );
    append(
        events,
        json!({ "type": "confirmStep", "payload": {
            "stepId": execution["value"]["currentStep"]["id"],
            "input": { "execute": true }
        }}),
    );
    let death = replay(events);
    append(
        events,
        json!({ "type": "confirmStep", "payload": {
            "stepId": death["value"]["currentStep"]["id"],
            "input": { "died": true }
        }}),
    );
}

fn audit_records(state: &Value) -> &Vec<Value> {
    state["value"]["currentStep"]["informationPrompt"]["mathematicianAudit"]["records"]
        .as_array()
        .expect("Mathematician audit records")
}

fn mathematician_reminders(state: &Value) -> Vec<&Value> {
    state["value"]["ruleState"]["automaticReminders"]
        .as_array()
        .expect("automatic reminders")
        .iter()
        .filter(|reminder| {
            reminder["characterId"] == "mathematician" && reminder["tokenId"] == "abnormal"
        })
        .collect()
}

#[test]
fn first_night_mathematician_starts_at_zero() {
    let mut events = vec![setup_event("noDashii")];
    let math = advance_to_math(&mut events);
    let step = &math["value"]["currentStep"];
    assert_eq!(step["id"], "firstNight:mathematician");
    assert_eq!(step["support"], "automated");
    assert_eq!(
        step["informationPrompt"]["computedResult"],
        json!({ "kind": "number", "value": 0 })
    );
    assert!(audit_records(&math).is_empty());
}

#[test]
fn impaired_truthful_information_is_normal_but_a_false_value_is_audit_evidence() {
    let mut truthful_events = vec![setup_event("noDashii")];
    let clockmaker = advance_to_clockmaker(&mut truthful_events);
    let clockmaker_step = &clockmaker["value"]["currentStep"];
    assert!(clockmaker_step["informationPrompt"]["activeReasons"]
        .as_array()
        .unwrap()
        .iter()
        .any(|reason| reason["type"] == "poisoned"));
    let truthful = computed_number(clockmaker_step);
    confirm_information(
        &mut truthful_events,
        clockmaker_step,
        Some(json!({ "kind": "number", "value": truthful })),
    );
    let truthful_math = advance_to_math(&mut truthful_events);
    assert!(audit_records(&truthful_math).is_empty());

    let mut false_events = vec![setup_event("noDashii")];
    let false_clockmaker = advance_to_clockmaker(&mut false_events);
    let false_step = &false_clockmaker["value"]["currentStep"];
    let false_value = false_number(false_step);
    confirm_information(
        &mut false_events,
        false_step,
        Some(json!({ "kind": "number", "value": false_value })),
    );
    let false_math = advance_to_math(&mut false_events);
    let records = audit_records(&false_math);
    assert_eq!(records.len(), 1);
    assert_eq!(records[0]["subjectPlayerId"], "player-3");
    assert_eq!(records[0]["characterId"], "clockmaker");
    assert_eq!(records[0]["evidence"].as_array().unwrap().len(), 1);
    assert_eq!(
        records[0]["evidence"][0]["outcome"]["kind"],
        "incorrectInformation"
    );

    let reminders = mathematician_reminders(&false_math);
    assert_eq!(reminders.len(), 1);
    assert_eq!(reminders[0]["playerId"], "player-3");
    assert_eq!(reminders[0]["label"], "비정상");

    confirm_information(&mut false_events, &false_math["value"]["currentStep"], None);
    assert!(mathematician_reminders(&replay(&false_events)).is_empty());
    assert_eq!(
        mathematician_reminders(&replay(&false_events[..false_events.len() - 1])).len(),
        1,
        "undoing the Mathematician confirmation restores the reminder"
    );
}

#[test]
fn abnormal_reminders_are_not_projected_without_a_living_mathematician() {
    let mut setup = setup_event("noDashii");
    setup["payload"]["players"][0]["actualCharacter"] = json!("dreamer");
    setup["payload"]["players"][0]["shownCharacter"] = json!("dreamer");
    let mut events = vec![setup];

    let clockmaker = advance_to_clockmaker(&mut events);
    let step = &clockmaker["value"]["currentStep"];
    confirm_information(
        &mut events,
        step,
        Some(json!({ "kind": "number", "value": false_number(step) })),
    );

    assert!(mathematician_reminders(&replay(&events)).is_empty());
}

#[test]
fn subject_player_is_deduplicated_when_two_abnormal_events_share_the_same_player() {
    let mut events = vec![setup_event("noDashii")];

    // Reach the first day, then continue to day two without recording Savant's action yet.
    advance_until(&mut events, |state| state["value"]["phase"] == "day");
    advance_until(&mut events, |state| {
        state["value"]["phase"] == "day"
            && state["value"]["currentStep"]["id"]
                .as_str()
                .is_some_and(|id| id.starts_with("day2:"))
    });

    let day = replay(&events);
    let action = day["value"]["availableDayActions"]
        .as_array()
        .unwrap()
        .iter()
        .find(|action| action["actorPlayerId"] == "player-7" && action["characterId"] == "savant")
        .expect("poisoned Savant action");
    assert_eq!(action["activeReasons"][0]["type"], "poisoned");
    let expected_event_count = events.len();
    let record = append(
        &mut events,
        json!({ "type": "recordDayAction", "payload": {
            "dayId": action["dayId"],
            "expectedEventCount": expected_event_count,
            "actorPlayerId": "player-7",
            "record": { "kind": "savant", "statements": [
                { "text": "first", "truthful": true },
                { "text": "second", "truthful": true }
            ] }
        }}),
    );
    assert_eq!(
        record["value"]["event"]["payload"]["activeReasons"][0]["type"],
        "poisoned"
    );

    // On the following night the Pit Hag changes this same player into Dreamer.
    advance_until(&mut events, |state| {
        state["value"]["currentStep"]["id"]
            .as_str()
            .is_some_and(|id| id.starts_with("night2:pitHag"))
    });
    let pit_hag = replay(&events);
    append(
        &mut events,
        json!({ "type": "confirmStep", "payload": {
            "stepId": pit_hag["value"]["currentStep"]["id"],
            "input": { "playerIds": ["player-7"], "characterIds": ["dreamer"] }
        }}),
    );
    let dreamer = advance_until(&mut events, |state| {
        state["value"]["currentStep"]["id"]
            .as_str()
            .is_some_and(|id| id.starts_with("night2:") && id.ends_with(":dreamer"))
    });
    let dreamer_step = &dreamer["value"]["currentStep"];
    let check = &dreamer_step["informationPrompt"]["targetChecks"][0];
    assert!(dreamer_step["informationPrompt"]["activeReasons"]
        .as_array()
        .unwrap()
        .iter()
        .any(|reason| reason["type"] == "poisoned"));
    confirm_information(&mut events, dreamer_step, Some(first_false_choice(check)));

    let math = advance_to_math(&mut events);
    let records = audit_records(&math);
    assert_eq!(records.len(), 1, "records must be keyed by subject player");
    assert_eq!(records[0]["subjectPlayerId"], "player-7");
    assert_eq!(records[0]["evidence"].as_array().unwrap().len(), 2);
    assert_eq!(
        records[0]["evidence"][0]["outcome"]["kind"],
        "invalidSavantPattern"
    );
    assert_eq!(
        records[0]["evidence"][1]["outcome"]["kind"],
        "incorrectInformation"
    );
}

#[test]
fn vortox_false_information_counts_and_mathematician_may_deliver_a_false_number() {
    let mut events = vec![setup_event("vortox")];
    let clockmaker = advance_to_clockmaker(&mut events);
    let clockmaker_step = &clockmaker["value"]["currentStep"];
    assert!(clockmaker_step["informationPrompt"]["activeReasons"]
        .as_array()
        .unwrap()
        .iter()
        .any(|reason| reason["type"] == "vortox"));
    let false_value = computed_number(clockmaker_step) + 1;
    confirm_information(
        &mut events,
        clockmaker_step,
        Some(json!({ "kind": "number", "value": false_value })),
    );
    let math = advance_to_math(&mut events);
    let prompt = &math["value"]["currentStep"]["informationPrompt"];
    assert_eq!(
        prompt["computedResult"],
        json!({ "kind": "number", "value": 1 })
    );
    assert!(prompt["numberChoices"].as_array().unwrap().is_empty());
    assert_eq!(audit_records(&math).len(), 1);

    let delivered_false = if prompt["computedResult"]["value"] == 0 {
        1
    } else {
        0
    };
    let confirmed = confirm_information(
        &mut events,
        &math["value"]["currentStep"],
        Some(json!({ "kind": "number", "value": delivered_false })),
    );
    let information = &confirmed["value"]["event"]["payload"]["information"];
    assert_eq!(
        information["computedResult"],
        json!({ "kind": "number", "value": 1 })
    );
    assert_eq!(
        information["deliveredResult"],
        json!({ "kind": "number", "value": delivered_false })
    );
    assert_eq!(information["deliveryContext"]["type"], "discretionary");
}

#[test]
fn mathematician_window_resets_after_dawn() {
    let mut events = vec![setup_event("noDashii")];
    let clockmaker = advance_to_clockmaker(&mut events);
    let clockmaker_step = &clockmaker["value"]["currentStep"];
    let false_value = false_number(clockmaker_step);
    confirm_information(
        &mut events,
        clockmaker_step,
        Some(json!({ "kind": "number", "value": false_value })),
    );
    let first_math = advance_to_math(&mut events);
    assert_eq!(audit_records(&first_math).len(), 1);
    confirm_information(&mut events, &first_math["value"]["currentStep"], None);

    let next_math = advance_until(&mut events, |state| {
        state["value"]["currentStep"]["id"] == "night2:mathematician"
    });
    assert_eq!(audit_records(&next_math).len(), 0);
    assert_eq!(
        next_math["value"]["currentStep"]["informationPrompt"]["computedResult"],
        json!({ "kind": "number", "value": 0 })
    );
}

#[test]
fn official_example_one_poisoned_oracle_false_three_to_two_is_counted() {
    let mut events = vec![setup_event_oracle_poison()];

    // The official example has three evil players executed on successive days.
    advance_until(&mut events, |state| state["value"]["phase"] == "day");
    execute_nominee(&mut events, "player-2", "day:announceDeaths");
    execute_nominee(&mut events, "player-3", "day2:announceDeaths");
    execute_nominee(&mut events, "player-6", "day3:announceDeaths");

    let oracle = advance_until(&mut events, |state| {
        state["value"]["currentStep"]["character"] == "oracle"
    });
    let oracle_step = &oracle["value"]["currentStep"];
    assert!(oracle_step["informationPrompt"]["activeReasons"]
        .as_array()
        .unwrap()
        .iter()
        .any(|reason| reason["type"] == "poisoned"));
    assert_eq!(
        oracle_step["informationPrompt"]["computedResult"],
        json!({ "kind": "number", "value": 3 })
    );
    confirm_information(
        &mut events,
        oracle_step,
        Some(json!({ "kind": "number", "value": 2 })),
    );

    let math = advance_to_math(&mut events);
    let records = audit_records(&math);
    assert_eq!(records.len(), 1);
    assert_eq!(records[0]["subjectPlayerId"], "player-7");
    assert_eq!(records[0]["characterId"], "oracle");
    assert_eq!(records[0]["evidence"].as_array().unwrap().len(), 1);
    let evidence = &records[0]["evidence"][0];
    assert_eq!(evidence["outcome"]["kind"], "incorrectInformation");
    assert_eq!(
        evidence["outcome"]["computedResult"],
        json!({ "kind": "number", "value": 3 })
    );
    assert_eq!(
        evidence["outcome"]["deliveredResult"],
        json!({ "kind": "number", "value": 2 })
    );
}

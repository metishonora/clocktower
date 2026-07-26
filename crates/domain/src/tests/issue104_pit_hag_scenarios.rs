use crate::{propose_json, replay_json};
use serde_json::{json, Value};

fn setup_event() -> Value {
    json!({
        "id": "setup-1",
        "type": "setupConfirmed",
        "phase": "setup",
        "payload": { "players": [
            { "id": "player-1", "seat": 1, "name": "Pit-Hag", "actualCharacter": "pitHag", "shownCharacter": "pitHag" },
            { "id": "player-2", "seat": 2, "name": "Fang Gu", "actualCharacter": "fangGu", "shownCharacter": "fangGu" },
            { "id": "player-3", "seat": 3, "name": "Barber", "actualCharacter": "barber", "shownCharacter": "barber" },
            { "id": "player-4", "seat": 4, "name": "Sweetheart", "actualCharacter": "sweetheart", "shownCharacter": "sweetheart" },
            { "id": "player-5", "seat": 5, "name": "Sage", "actualCharacter": "sage", "shownCharacter": "sage" },
            { "id": "player-6", "seat": 6, "name": "Klutz", "actualCharacter": "klutz", "shownCharacter": "klutz" },
            { "id": "player-7", "seat": 7, "name": "Mutant", "actualCharacter": "mutant", "shownCharacter": "mutant" }
        ] },
        "summary": "initial setup",
        "createdAt": "2026-07-26T00:00:00.000Z"
    })
}

fn game(events: Vec<Value>) -> Value {
    json!({
        "schemaVersion": 3,
        "game": {
            "id": "game-issue-104",
            "name": "Pit-Hag",
            "scriptId": "sectsAndViolets",
            "createdAt": "2026-07-26T00:00:00.000Z",
            "updatedAt": "2026-07-26T00:00:00.000Z",
            "events": events
        }
    })
}

fn replay(events: &[Value]) -> Value {
    serde_json::from_str(&replay_json(&game(events.to_vec()).to_string())).unwrap()
}

fn append(events: &mut Vec<Value>, command: Value) -> Value {
    let proposal: Value = serde_json::from_str(&propose_json(
        &game(events.clone()).to_string(),
        &command.to_string(),
    ))
    .unwrap();
    assert_eq!(proposal["ok"], true, "proposal failed: {proposal}");
    events.push(proposal["value"]["event"].clone());
    proposal
}

fn advance_to_pit_hag(events: &mut Vec<Value>) -> Value {
    for _ in 0..48 {
        let state = replay(events);
        assert_eq!(state["ok"], true, "replay failed: {state}");
        let step = &state["value"]["currentStep"];
        if state["value"]["phase"] == "night" && step["character"] == "pitHag" {
            return state;
        }
        let step_id = step["id"].as_str().expect("step id");
        let command = if step["requiredInput"]["kind"] == "nomination" {
            json!({ "type": "skipStep", "payload": { "stepId": step_id } })
        } else if step["requiredInput"]["kind"] == "executionDecision" {
            json!({ "type": "confirmStep", "payload": { "stepId": step_id, "input": { "execute": false } } })
        } else if step["support"] == "manual" {
            json!({ "type": "resolveManualStep", "payload": { "stepId": step_id, "outcome": "handled" } })
        } else {
            json!({ "type": "confirmStep", "payload": { "stepId": step_id, "input": null } })
        };
        append(events, command);
    }
    panic!("did not reach Pit-Hag step");
}

#[test]
fn pit_hag_requires_one_player_and_one_script_character() {
    let mut events = vec![setup_event()];
    let state = advance_to_pit_hag(&mut events);
    let step = &state["value"]["currentStep"];

    assert_eq!(step["id"], "night:pitHag:player-1");
    assert_eq!(step["support"], "automated");
    assert_eq!(step["requiredInput"]["kind"], "characterTransformation");
    assert_eq!(
        step["requiredInput"]["allowedPlayerIds"],
        json!(["player-1", "player-2", "player-3", "player-4", "player-5", "player-6", "player-7"]),
        "dead players must remain valid transformation targets"
    );
    let characters = step["requiredInput"]["allowedCharacterIds"]
        .as_array()
        .expect("character allowlist");
    assert!(characters.iter().any(|id| id == "mutant"));
    assert!(characters.iter().any(|id| id == "noDashii"));
}

#[test]
fn transformation_is_atomic_retains_alignment_and_existing_character_is_no_change() {
    let mut events = vec![setup_event()];
    let state = advance_to_pit_hag(&mut events);
    let step_id = state["value"]["currentStep"]["id"]
        .as_str()
        .unwrap()
        .to_string();
    let changed = append(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": step_id,
                "input": { "playerIds": ["player-7"], "characterIds": ["dreamer"] }
            }
        }),
    );
    assert_eq!(
        changed["value"]["event"]["type"],
        "pitHagTransformationResolved"
    );
    assert_eq!(
        changed["value"]["event"]["payload"]["outcome"]["kind"],
        "changed"
    );
    assert_eq!(
        changed["value"]["event"]["payload"]["outcome"]["createdDemon"],
        false
    );

    let after = replay(&events);
    assert_eq!(after["ok"], true, "replay failed: {after}");
    let target = after["value"]["players"]
        .as_array()
        .unwrap()
        .iter()
        .find(|player| player["id"] == "player-7")
        .unwrap();
    assert_eq!(target["actualCharacter"], "dreamer");
    assert_eq!(target["shownCharacter"], "dreamer");
    assert_eq!(
        target["alignment"], "good",
        "the target keeps their alignment"
    );
    assert_eq!(target["identityHistory"].as_array().map(Vec::len), Some(1));
    assert_eq!(
        after["value"]["pendingIdentityReveals"],
        json!([{
            "sourceEventId": changed["value"]["event"]["id"],
            "sequence": 1,
            "payload": {
                "kind": "characterChange",
                "playerId": "player-7",
                "alignment": "good",
                "characterId": "dreamer"
            }
        }])
    );
    assert!(
        after["value"]["phaseOverview"]
            .as_array()
            .unwrap()
            .iter()
            .any(|step| step["id"] == "night:dreamer"),
        "a newly created later-waking character acts this night: {after}"
    );

    let mut no_change_events = vec![setup_event()];
    let state = advance_to_pit_hag(&mut no_change_events);
    let no_change = append(
        &mut no_change_events,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": state["value"]["currentStep"]["id"],
                "input": { "playerIds": ["player-7"], "characterIds": ["sage"] }
            }
        }),
    );
    assert_eq!(
        no_change["value"]["event"]["payload"]["outcome"],
        json!({ "kind": "noChange", "reason": "characterAlreadyInPlay" })
    );
    let after_no_change = replay(&no_change_events);
    assert_eq!(
        after_no_change["value"]["players"][6]["actualCharacter"],
        "mutant"
    );
    assert!(after_no_change["value"]["pendingIdentityReveals"].is_null());
}

#[test]
fn creating_a_demon_records_both_intents_then_requires_arbitrary_deaths() {
    let mut events = vec![setup_event()];
    let state = advance_to_pit_hag(&mut events);
    append(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": state["value"]["currentStep"]["id"],
                "input": { "playerIds": ["player-7"], "characterIds": ["noDashii"] }
            }
        }),
    );

    for (actor_id, target_id) in [("player-2", "player-3"), ("player-7", "player-4")] {
        let demon = replay(&events);
        assert_eq!(
            demon["value"]["currentStep"]["id"],
            format!("night:demon:{actor_id}")
        );
        let intent = append(
            &mut events,
            json!({
                "type": "confirmStep",
                "payload": {
                    "stepId": demon["value"]["currentStep"]["id"],
                    "input": { "playerIds": [target_id] }
                }
            }),
        );
        assert_eq!(intent["value"]["event"]["type"], "nightActionResolved");
        assert_eq!(
            intent["value"]["event"]["payload"]["resolution"]["outcome"],
            json!({ "kind": "noEffect", "reason": "pitHagCreatedDemon" })
        );
        assert!(
            replay(&events)["value"]["players"]
                .as_array()
                .unwrap()
                .iter()
                .all(|player| player["alive"] == true),
            "demon selections are intents; the Storyteller decides deaths afterward"
        );
    }

    let after_demon_intents = replay(&events);
    let overview_ids = after_demon_intents["value"]["phaseOverview"]
        .as_array()
        .expect("phase overview")
        .iter()
        .map(|step| step["id"].as_str().expect("overview step id"))
        .collect::<Vec<_>>();
    let arbitrary_deaths_index = overview_ids
        .iter()
        .position(|id| *id == "night:pitHagArbitraryDeaths")
        .expect("arbitrary deaths step");
    let to_day_index = overview_ids
        .iter()
        .position(|id| *id == "night:toDay")
        .expect("to-day step");
    assert_eq!(
        arbitrary_deaths_index + 1,
        to_day_index,
        "unpredictable deaths must be the final actionable night step"
    );

    let follow_up = loop {
        let state = replay(&events);
        if state["value"]["currentStep"]["id"] == "night:pitHagArbitraryDeaths" {
            break state;
        }
        let step = &state["value"]["currentStep"];
        assert_ne!(step["id"], "night:toDay", "skipped unpredictable deaths");
        let command = if step["support"] == "manual" {
            json!({ "type": "resolveManualStep", "payload": { "stepId": step["id"], "outcome": "handled" } })
        } else {
            json!({ "type": "confirmStep", "payload": { "stepId": step["id"], "input": null } })
        };
        append(&mut events, command);
    };
    assert_eq!(
        follow_up["value"]["currentStep"]["id"],
        "night:pitHagArbitraryDeaths"
    );
    assert_eq!(
        follow_up["value"]["currentStep"]["requiredInput"]["kind"],
        "playerIds"
    );
    assert_eq!(
        follow_up["value"]["currentStep"]["requiredInput"]["minSelections"],
        0
    );
    assert_eq!(
        follow_up["value"]["currentStep"]["requiredInput"]["zeroAllowed"],
        true
    );

    let mut zero_deaths_events = events.clone();
    let zero = append(
        &mut zero_deaths_events,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "night:pitHagArbitraryDeaths",
                "input": { "playerIds": [] }
            }
        }),
    );
    assert_eq!(zero["value"]["event"]["payload"]["deaths"], json!([]));

    let deaths = append(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "night:pitHagArbitraryDeaths",
                "input": { "playerIds": ["player-3", "player-4"] }
            }
        }),
    );
    assert_eq!(
        deaths["value"]["event"]["type"],
        "pitHagArbitraryDeathsConfirmed"
    );
    assert_eq!(
        deaths["value"]["event"]["payload"]["deaths"]
            .as_array()
            .map(Vec::len),
        Some(2)
    );
    assert_eq!(
        deaths["value"]["event"]["payload"]["deaths"][0]["cause"]["kind"],
        "pitHagArbitraryDeath"
    );
    let after_deaths = replay(&events);
    assert_eq!(after_deaths["ok"], true, "replay failed: {after_deaths}");
    assert_eq!(
        after_deaths["value"]["ruleState"]["unannouncedNightDeathPlayerIds"],
        json!(["player-3", "player-4"])
    );
    assert_eq!(after_deaths["value"]["players"][2]["alive"], false);
    assert_eq!(after_deaths["value"]["players"][3]["alive"], false);

    events.pop();
    let undone = replay(&events);
    assert_eq!(
        undone["value"]["currentStep"]["id"],
        "night:pitHagArbitraryDeaths"
    );
    assert!(undone["value"]["players"]
        .as_array()
        .unwrap()
        .iter()
        .all(|player| player["alive"] == true));
}

#[test]
fn historical_manual_pit_hag_events_remain_replayable() {
    let mut events = vec![setup_event()];
    advance_to_pit_hag(&mut events);
    events.push(json!({
        "id": "legacy-pit-hag",
        "type": "manualPhaseStepResolved",
        "phase": "night",
        "payload": { "stepId": "night:pitHag", "outcome": "handled" },
        "summary": "legacy manual Pit-Hag",
        "createdAt": "2026-07-26T00:00:00.000Z"
    }));

    let state = replay(&events);
    assert_eq!(state["ok"], true, "legacy replay failed: {state}");
    assert_eq!(state["value"]["currentStep"]["id"], "night:demon:player-2");
}

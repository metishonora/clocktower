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

fn setup_event_for_creation(character: &str) -> Value {
    let mut setup = setup_event();
    for index in 1..7 {
        if setup["payload"]["players"][index]["actualCharacter"] == character {
            let replacement = if character == "fangGu" {
                "vortox"
            } else {
                "savant"
            };
            setup["payload"]["players"][index]["actualCharacter"] = json!(replacement);
            setup["payload"]["players"][index]["shownCharacter"] = json!(replacement);
        }
    }
    setup
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

fn advance_to(events: &mut Vec<Value>, wanted: impl Fn(&Value) -> bool) -> Value {
    for _ in 0..96 {
        let state = replay(events);
        assert_eq!(state["ok"], true, "replay failed: {state}");
        if wanted(&state) {
            return state;
        }
        let step = &state["value"]["currentStep"];
        let step_id = step["id"].as_str().expect("current step id");
        let command = match step["requiredInput"]["kind"].as_str().unwrap_or("none") {
            "nomination" => json!({ "type": "skipStep", "payload": { "stepId": step_id } }),
            "executionDecision" => {
                json!({ "type": "confirmStep", "payload": { "stepId": step_id, "input": { "execute": false } } })
            }
            "playerIds" if step_id.contains(":demon:") => {
                json!({ "type": "confirmStep", "payload": { "stepId": step_id, "input": { "playerIds": ["player-6"] } } })
            }
            "characterTransformation" => json!({
                "type": "confirmStep",
                "payload": {
                    "stepId": step_id,
                    "input": { "playerIds": [step["playerId"]], "characterIds": ["pitHag"] }
                }
            }),
            "number" => json!({
                "type": "confirmStep",
                "payload": {
                    "stepId": step_id,
                    "input": null,
                    "deliveredResult": step["informationPrompt"]["numberChoices"][0]["result"]
                }
            }),
            _ if step["support"] == "manual" => {
                json!({ "type": "resolveManualStep", "payload": { "stepId": step_id, "outcome": "handled" } })
            }
            _ => json!({ "type": "confirmStep", "payload": { "stepId": step_id, "input": null } }),
        };
        append(events, command);
    }
    panic!("wanted phase step was not reached");
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
fn every_script_character_has_the_expected_same_night_schedule_when_created() {
    let all_characters = [
        "clockmaker",
        "dreamer",
        "snakeCharmer",
        "mathematician",
        "flowergirl",
        "townCrier",
        "oracle",
        "savant",
        "seamstress",
        "philosopher",
        "artist",
        "juggler",
        "sage",
        "mutant",
        "sweetheart",
        "barber",
        "klutz",
        "evilTwin",
        "witch",
        "cerenovus",
        "pitHag",
        "fangGu",
        "vigormortis",
        "noDashii",
        "vortox",
    ];
    let acts_this_night = [
        "clockmaker",
        "dreamer",
        "mathematician",
        "flowergirl",
        "townCrier",
        "oracle",
        "seamstress",
        "evilTwin",
        "fangGu",
        "vigormortis",
        "noDashii",
        "vortox",
    ];

    for character in all_characters {
        let mut events = vec![setup_event_for_creation(character)];
        let pit_hag = advance_to_pit_hag(&mut events);
        let changed = append(
            &mut events,
            json!({
                "type": "confirmStep",
                "payload": {
                    "stepId": pit_hag["value"]["currentStep"]["id"],
                    "input": { "playerIds": ["player-7"], "characterIds": [character] }
                }
            }),
        );

        if character == "pitHag" {
            assert_eq!(
                changed["value"]["event"]["payload"]["outcome"]["kind"],
                "noChange"
            );
            continue;
        }

        let after = replay(&events);
        let has_step = after["value"]["phaseOverview"]
            .as_array()
            .unwrap()
            .iter()
            .any(|step| step["character"] == character && step["playerId"] == "player-7");
        assert_eq!(
            has_step,
            acts_this_night.contains(&character),
            "unexpected same-night schedule for {character}: {after}"
        );
    }
}

#[test]
fn a_new_mutant_gets_a_fresh_madness_assignment() {
    let mut events = vec![setup_event_for_creation("mutant")];
    let pit_hag = advance_to_pit_hag(&mut events);
    let changed = append(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": pit_hag["value"]["currentStep"]["id"],
                "input": { "playerIds": ["player-7"], "characterIds": ["mutant"] }
            }
        }),
    );

    let after = replay(&events);
    assert_eq!(after["ok"], true, "replay failed: {after}");
    assert_eq!(
        after["value"]["madnessAssignments"],
        json!([{
            "assignmentId": format!(
                "mutant:player-7:{}",
                changed["value"]["event"]["id"].as_str().unwrap()
            ),
            "sourcePlayerId": "player-7",
            "sourceCharacterId": "mutant",
            "targetPlayerId": "player-7",
            "status": "unchecked",
            "sourceEffective": true,
            "canCheck": false,
            "canExecute": true
        }])
    );
}

#[test]
fn newly_created_day_action_characters_are_available_on_the_following_day() {
    for character in ["artist", "savant"] {
        let mut events = vec![setup_event_for_creation(character)];
        let pit_hag = advance_to_pit_hag(&mut events);
        append(
            &mut events,
            json!({
                "type": "confirmStep",
                "payload": {
                    "stepId": pit_hag["value"]["currentStep"]["id"],
                    "input": { "playerIds": ["player-7"], "characterIds": [character] }
                }
            }),
        );

        let next_day = advance_to(&mut events, |state| {
            state["value"]["phase"] == "day"
                && state["value"]["currentStep"]["id"]
                    .as_str()
                    .is_some_and(|id| id.starts_with("day2:"))
        });
        assert!(next_day["value"]["availableDayActions"]
            .as_array()
            .unwrap()
            .iter()
            .any(|action| {
                action["actorPlayerId"] == "player-7"
                    && action["characterId"] == character
                    && action["dayId"] == "day2"
            }));
    }
}

#[test]
fn newly_created_earlier_waking_characters_wait_until_the_next_night() {
    for character in ["philosopher", "snakeCharmer", "witch", "cerenovus"] {
        let mut events = vec![setup_event_for_creation(character)];
        let pit_hag = advance_to_pit_hag(&mut events);
        append(
            &mut events,
            json!({
                "type": "confirmStep",
                "payload": {
                    "stepId": pit_hag["value"]["currentStep"]["id"],
                    "input": { "playerIds": ["player-7"], "characterIds": [character] }
                }
            }),
        );

        let next_night = advance_to(&mut events, |state| {
            state["value"]["phase"] == "night"
                && state["value"]["currentStep"]["id"]
                    .as_str()
                    .is_some_and(|id| id.starts_with("night2:"))
        });
        assert!(next_night["value"]["phaseOverview"]
            .as_array()
            .unwrap()
            .iter()
            .any(|step| step["character"] == character && step["playerId"] == "player-7"));
    }
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
        target["abilityInstance"]["id"],
        format!(
            "{}:player-7",
            changed["value"]["event"]["id"].as_str().unwrap()
        )
    );
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
            .any(|step| {
                step["id"]
                    .as_str()
                    .is_some_and(|id| id.contains(":ability:pit-hag-11:player-7:dreamer"))
            }),
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
fn a_transformed_player_killed_before_their_wake_order_loses_the_new_ability_step() {
    let mut events = vec![setup_event()];
    let pit_hag = advance_to_pit_hag(&mut events);
    append(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": pit_hag["value"]["currentStep"]["id"],
                "input": { "playerIds": ["player-7"], "characterIds": ["dreamer"] }
            }
        }),
    );

    let before_attack = replay(&events);
    assert_eq!(before_attack["value"]["currentStep"]["character"], "fangGu");
    assert!(before_attack["value"]["phaseOverview"]
        .as_array()
        .unwrap()
        .iter()
        .any(|step| step["character"] == "dreamer" && step["playerId"] == "player-7"));

    append(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": before_attack["value"]["currentStep"]["id"],
                "input": { "playerIds": ["player-7"] }
            }
        }),
    );

    let after_attack = replay(&events);
    let target = after_attack["value"]["players"]
        .as_array()
        .unwrap()
        .iter()
        .find(|player| player["id"] == "player-7")
        .unwrap();
    assert_eq!(target["alive"], false);
    assert!(
        after_attack["value"]["phaseOverview"]
            .as_array()
            .unwrap()
            .iter()
            .all(|step| !(step["character"] == "dreamer" && step["playerId"] == "player-7")),
        "dead transformed players must not retain ordinary ability steps: {after_attack}"
    );
}

#[test]
fn newly_created_death_trigger_characters_act_only_after_they_die() {
    for character in ["sweetheart", "barber", "sage"] {
        let mut events = vec![setup_event_for_creation(character)];
        let pit_hag = advance_to_pit_hag(&mut events);
        append(
            &mut events,
            json!({
                "type": "confirmStep",
                "payload": {
                    "stepId": pit_hag["value"]["currentStep"]["id"],
                    "input": { "playerIds": ["player-7"], "characterIds": [character] }
                }
            }),
        );
        let before_death = replay(&events);
        assert!(before_death["value"]["phaseOverview"]
            .as_array()
            .unwrap()
            .iter()
            .all(|step| !(step["character"] == character && step["playerId"] == "player-7")));

        append(
            &mut events,
            json!({
                "type": "confirmStep",
                "payload": {
                    "stepId": before_death["value"]["currentStep"]["id"],
                    "input": { "playerIds": ["player-7"] }
                }
            }),
        );
        let after_death = replay(&events);
        assert_eq!(after_death["value"]["currentStep"]["character"], character);
        assert_eq!(after_death["value"]["currentStep"]["playerId"], "player-7");
        if character == "sage" {
            assert!(after_death["value"]["currentStep"]["informationPrompt"].is_object());
        }
    }
}

#[test]
fn a_dead_transformed_earlier_waking_character_does_not_return_next_night() {
    let mut events = vec![setup_event_for_creation("witch")];
    let pit_hag = advance_to_pit_hag(&mut events);
    append(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": pit_hag["value"]["currentStep"]["id"],
                "input": { "playerIds": ["player-7"], "characterIds": ["witch"] }
            }
        }),
    );
    let demon = replay(&events);
    append(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": demon["value"]["currentStep"]["id"],
                "input": { "playerIds": ["player-7"] }
            }
        }),
    );

    let next_night = advance_to(&mut events, |state| {
        state["value"]["phase"] == "night"
            && state["value"]["currentStep"]["id"]
                .as_str()
                .is_some_and(|id| id.starts_with("night2:"))
    });
    assert!(next_night["value"]["phaseOverview"]
        .as_array()
        .unwrap()
        .iter()
        .all(|step| !(step["character"] == "witch" && step["playerId"] == "player-7")));
}

#[test]
fn a_transformed_minion_killed_by_vigormortis_keeps_their_ability() {
    let mut setup = setup_event_for_creation("witch");
    setup["payload"]["players"][1]["actualCharacter"] = json!("vigormortis");
    setup["payload"]["players"][1]["shownCharacter"] = json!("vigormortis");
    let mut events = vec![setup];
    let pit_hag = advance_to_pit_hag(&mut events);
    append(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": pit_hag["value"]["currentStep"]["id"],
                "input": { "playerIds": ["player-7"], "characterIds": ["witch"] }
            }
        }),
    );
    let demon = replay(&events);
    append(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": demon["value"]["currentStep"]["id"],
                "input": { "playerIds": ["player-7"] }
            }
        }),
    );

    let next_night = advance_to(&mut events, |state| {
        state["value"]["phase"] == "night"
            && state["value"]["currentStep"]["id"]
                .as_str()
                .is_some_and(|id| id.starts_with("night2:"))
    });
    assert!(next_night["value"]["phaseOverview"]
        .as_array()
        .unwrap()
        .iter()
        .any(|step| step["character"] == "witch" && step["playerId"] == "player-7"));
}

#[test]
fn a_new_juggler_acts_on_their_first_day_then_learns_the_result_that_night() {
    let mut events = vec![setup_event()];
    let pit_hag = advance_to_pit_hag(&mut events);
    append(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": pit_hag["value"]["currentStep"]["id"],
                "input": { "playerIds": ["player-7"], "characterIds": ["juggler"] }
            }
        }),
    );

    let changed = replay(&events);
    assert!(changed["value"]["phaseOverview"]
        .as_array()
        .unwrap()
        .iter()
        .all(|step| !(step["character"] == "juggler" && step["playerId"] == "player-7")));

    let first_day = advance_to(&mut events, |state| {
        state["value"]["phase"] == "day"
            && state["value"]["currentStep"]["id"]
                .as_str()
                .is_some_and(|id| id.starts_with("day2:"))
    });
    assert!(first_day["value"]["availableDayActions"]
        .as_array()
        .unwrap()
        .iter()
        .any(|action| {
            action["actorPlayerId"] == "player-7"
                && action["characterId"] == "juggler"
                && action["dayId"] == "day2"
        }));

    let expected_event_count = events.len();
    append(
        &mut events,
        json!({
            "type": "recordDayAction",
            "payload": {
                "dayId": "day2",
                "expectedEventCount": expected_event_count,
                "actorPlayerId": "player-7",
                "record": { "kind": "juggler", "correctCount": 3 }
            }
        }),
    );

    let information = advance_to(&mut events, |state| {
        state["value"]["currentStep"]["character"] == "juggler"
            && state["value"]["currentStep"]["playerId"] == "player-7"
    });
    assert_eq!(
        information["value"]["currentStep"]["informationPrompt"]["computedResult"],
        json!({ "kind": "number", "value": 3 })
    );
}

#[test]
fn creating_clockmaker_reveals_the_change_then_runs_start_knowing_immediately() {
    let mut events = vec![setup_event()];
    let pit_hag = advance_to_pit_hag(&mut events);
    let changed = append(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": pit_hag["value"]["currentStep"]["id"],
                "input": { "playerIds": ["player-7"], "characterIds": ["clockmaker"] }
            }
        }),
    );

    let after = replay(&events);
    assert_eq!(after["ok"], true, "replay failed: {after}");
    assert_eq!(after["value"]["currentStep"]["character"], "clockmaker");
    assert_eq!(after["value"]["currentStep"]["playerId"], "player-7");
    assert!(after["value"]["currentStep"]["id"]
        .as_str()
        .unwrap()
        .contains(changed["value"]["event"]["id"].as_str().unwrap()));
    assert_eq!(
        after["value"]["pendingIdentityReveals"][0]["payload"],
        json!({
            "kind": "characterChange",
            "playerId": "player-7",
            "alignment": "good",
            "characterId": "clockmaker"
        })
    );
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

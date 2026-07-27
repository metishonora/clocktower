use crate::{propose_json, replay_json};
use serde_json::{json, Value};

fn setup_event() -> Value {
    json!({
        "id": "setup-1", "type": "setupConfirmed", "phase": "setup",
        "payload": { "players": [
            { "id": "player-1", "seat": 1, "name": "Pit-Hag", "actualCharacter": "pitHag", "shownCharacter": "pitHag" },
            { "id": "player-2", "seat": 2, "name": "Clock", "actualCharacter": "clockmaker", "shownCharacter": "clockmaker" },
            { "id": "player-3", "seat": 3, "name": "Dreamer", "actualCharacter": "dreamer", "shownCharacter": "dreamer" },
            { "id": "player-4", "seat": 4, "name": "Seamstress", "actualCharacter": "seamstress", "shownCharacter": "seamstress" },
            { "id": "player-5", "seat": 5, "name": "Math", "actualCharacter": "mathematician", "shownCharacter": "mathematician" },
            { "id": "player-6", "seat": 6, "name": "Mutant", "actualCharacter": "mutant", "shownCharacter": "mutant" },
            { "id": "player-7", "seat": 7, "name": "Vortox", "actualCharacter": "vortox", "shownCharacter": "vortox" }
        ]},
        "summary": "setup", "createdAt": "2026-07-27T00:00:00.000Z"
    })
}

fn game(events: Vec<Value>) -> Value {
    json!({
        "schemaVersion": 3,
        "game": {
            "id": "game-129", "name": "ability instances", "scriptId": "sectsAndViolets",
            "createdAt": "2026-07-27T00:00:00.000Z", "updatedAt": "2026-07-27T00:00:00.000Z",
            "events": events
        }
    })
}

fn replay(events: &[Value]) -> Value {
    serde_json::from_str(&replay_json(&game(events.to_vec()).to_string())).unwrap()
}

fn append(events: &mut Vec<Value>, command: Value) -> Value {
    let result: Value = serde_json::from_str(&propose_json(
        &game(events.clone()).to_string(),
        &command.to_string(),
    ))
    .unwrap();
    assert_eq!(result["ok"], true, "proposal failed: {result}");
    events.push(result["value"]["event"].clone());
    result
}

fn advance_to(events: &mut Vec<Value>, wanted: impl Fn(&Value) -> bool) -> Value {
    advance_to_with_demon_target(events, wanted, "player-6")
}

fn advance_to_with_demon_target(
    events: &mut Vec<Value>,
    wanted: impl Fn(&Value) -> bool,
    demon_target_id: &str,
) -> Value {
    for _ in 0..96 {
        let state = replay(events);
        assert_eq!(
            state["ok"],
            true,
            "replay failed after {} events; last event: {}; result: {state}",
            events.len(),
            events.last().unwrap()
        );
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
            "playerIds" if step["id"].as_str().is_some_and(|id| id.contains(":demon:")) => {
                json!({ "type": "confirmStep", "payload": { "stepId": step_id, "input": { "playerIds": [demon_target_id] } } })
            }
            "playerIds" if step["character"] == "dreamer" => {
                let check = &step["informationPrompt"]["targetChecks"][0];
                json!({ "type": "confirmStep", "payload": { "stepId": step_id, "input": { "playerIds": check["targetPlayerIds"] }, "deliveredResult": check["choices"][0]["result"] } })
            }
            "playerIds" if step["character"] == "seamstress" => {
                json!({ "type": "skipStep", "payload": { "stepId": step_id } })
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
                    "stepId": step_id, "input": null,
                    "deliveredResult": { "kind": "number", "value": step["informationPrompt"]["numberChoices"][0]["value"] }
                }
            }),
            _ if step["support"] == "manual" => {
                json!({ "type": "resolveManualStep", "payload": { "stepId": step_id, "outcome": "handled" } })
            }
            _ => json!({ "type": "confirmStep", "payload": { "stepId": step_id, "input": null } }),
        };
        append(events, command);
    }
    panic!("wanted phase step was not reached")
}

fn transition_event(
    event_id: &str,
    step: &Value,
    kind: &str,
    player_id: &str,
    before_character: &str,
    after_character: &str,
    alive: (bool, bool),
) -> Value {
    json!({
        "id": event_id, "type": "playerTransitioned", "phase": step["phase"],
        "payload": {
            "stepId": step["id"],
            "sourcePlayerId": step["playerId"],
            "sourceCharacterId": step["character"],
            "transitions": [{
                "kind": kind, "playerId": player_id,
                "before": { "actualCharacter": before_character, "shownCharacter": before_character, "alignment": "good", "alive": alive.0 },
                "after": { "actualCharacter": after_character, "shownCharacter": after_character, "alignment": "good", "alive": alive.1 }
            }]
        },
        "summary": "player transition", "createdAt": "2026-07-27T00:00:00.000Z"
    })
}

#[test]
fn character_change_creates_a_fresh_instance_reveals_identity_then_runs_start_knowing_now() {
    let mut events = vec![setup_event()];
    events.push(json!({
        "id": "annotations-2", "type": "playerAnnotationsUpdated", "phase": "setup",
        "payload": {
            "playerId": "player-6", "systemTokenIds": ["abilitySpent", "poisoned"],
            "scriptTokens": [{ "characterId": "mutant", "tokenId": "madness" }], "notes": "keep"
        },
        "summary": "annotations", "createdAt": "2026-07-27T00:00:00.000Z"
    }));
    let pit_hag = advance_to(&mut events, |state| {
        state["value"]["phase"] == "night" && state["value"]["currentStep"]["character"] == "pitHag"
    });
    let source = &pit_hag["value"]["currentStep"];
    events.push(transition_event(
        "transition-clock",
        source,
        "characterChange",
        "player-6",
        "mutant",
        "clockmaker",
        (true, true),
    ));

    let changed = replay(&events);
    assert_eq!(changed["ok"], true, "replay failed: {changed}");
    let player = changed["value"]["players"]
        .as_array()
        .unwrap()
        .iter()
        .find(|player| player["id"] == "player-6")
        .unwrap();
    assert_eq!(player["abilityInstance"]["id"], "transition-clock:player-6");
    assert_eq!(
        player["systemTokenIds"],
        json!(["abilitySpent", "poisoned"])
    );
    assert_eq!(
        player["scriptTokens"],
        json!([{ "characterId": "mutant", "tokenId": "madness" }])
    );
    assert_eq!(player["notes"], "keep");
    assert_eq!(
        changed["value"]["pendingIdentityReveals"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
    assert_eq!(changed["value"]["currentStep"]["character"], "clockmaker");
    assert_eq!(changed["value"]["currentStep"]["playerId"], "player-6");
    assert!(changed["value"]["currentStep"]["id"]
        .as_str()
        .unwrap()
        .contains("transition-clock"));
}

#[test]
fn resurrection_restores_life_and_ghost_vote_without_an_identity_reveal_and_is_announced_at_dawn() {
    let mut events = vec![setup_event()];
    let first_pit_hag = advance_to(&mut events, |state| {
        state["value"]["phase"] == "night" && state["value"]["currentStep"]["character"] == "pitHag"
    });
    append(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": first_pit_hag["value"]["currentStep"]["id"],
                "input": {
                    "playerIds": [first_pit_hag["value"]["currentStep"]["playerId"]],
                    "characterIds": ["pitHag"]
                }
            }
        }),
    );
    let nomination = advance_to(&mut events, |state| {
        state["value"]["currentStep"]["id"]
            .as_str()
            .is_some_and(|id| id.starts_with("day2:nomination:"))
            && state["value"]["currentStep"]["requiredInput"]["kind"] == "nomination"
    });
    let nomination_id = nomination["value"]["currentStep"]["id"].as_str().unwrap();
    append(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": { "stepId": nomination_id, "input": { "nominatorId": "player-1", "nomineeId": "player-2" } }
        }),
    );
    let vote = replay(&events);
    append(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": { "stepId": vote["value"]["currentStep"]["id"], "input": { "voterIds": ["player-6"] } }
        }),
    );
    let spent = replay(&events);
    assert_eq!(spent["value"]["players"][5]["ghostVoteUsed"], true);
    let night_two_pit_hag = advance_to(&mut events, |state| {
        state["value"]["currentStep"]["id"]
            .as_str()
            .is_some_and(|id| id.starts_with("night2:pitHag"))
    });
    let dead = night_two_pit_hag["value"]["players"]
        .as_array()
        .unwrap()
        .iter()
        .find(|player| player["id"] == "player-6")
        .unwrap();
    assert_eq!(dead["alive"], false);
    events.push(transition_event(
        "transition-revive",
        &night_two_pit_hag["value"]["currentStep"],
        "resurrection",
        "player-6",
        "mutant",
        "mutant",
        (false, true),
    ));

    let revived = replay(&events);
    assert_eq!(revived["ok"], true, "replay failed: {revived}");
    let player = revived["value"]["players"]
        .as_array()
        .unwrap()
        .iter()
        .find(|player| player["id"] == "player-6")
        .unwrap();
    assert_eq!(player["alive"], true);
    assert_eq!(player["ghostVoteUsed"], false);
    assert_eq!(
        player["abilityInstance"]["id"],
        "transition-revive:player-6"
    );
    assert!(revived["value"].get("pendingIdentityReveals").is_none());
    assert_eq!(
        revived["value"]["ruleState"]["unannouncedNightResurrectionPlayerIds"],
        json!(["player-6"])
    );

    let dawn = advance_to_with_demon_target(
        &mut events,
        |state| {
            state["value"]["currentStep"]["id"]
                .as_str()
                .is_some_and(|id| id == "day3:announceDeaths")
        },
        "player-5",
    );
    let announced = append(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": { "stepId": dawn["value"]["currentStep"]["id"], "input": null }
        }),
    );
    assert_eq!(
        announced["value"]["event"]["payload"]["resurrectedPlayerIds"],
        json!(["player-6"])
    );
    assert!(announced["value"]["event"]["summary"]
        .as_str()
        .unwrap()
        .contains("부활: 6번 Mutant"));
    let after_announcement = replay(&events);
    assert!(after_announcement["value"]["ruleState"]
        .get("unannouncedNightResurrectionPlayerIds")
        .is_none());

    let later_pit_hag = advance_to(&mut events, |state| {
        state["value"]["currentStep"]["id"]
            .as_str()
            .is_some_and(|id| id.starts_with("night4:pitHag"))
    });
    let dead_again = later_pit_hag["value"]["players"]
        .as_array()
        .unwrap()
        .iter()
        .find(|player| player["id"] == "player-6")
        .unwrap();
    assert_eq!(dead_again["alive"], false);
    events.push(transition_event(
        "transition-revive-again",
        &later_pit_hag["value"]["currentStep"],
        "resurrection",
        "player-6",
        "mutant",
        "mutant",
        (false, true),
    ));
    assert_eq!(
        replay(&events)["value"]["ruleState"]["unannouncedNightResurrectionPlayerIds"],
        json!(["player-6"]),
        "the same player must be announced after every resurrection"
    );
}

#[test]
fn a_new_dreamer_waits_for_its_remaining_normal_order_and_runs_exactly_once() {
    let mut events = vec![setup_event()];
    let pit_hag = advance_to(&mut events, |state| {
        state["value"]["phase"] == "night" && state["value"]["currentStep"]["character"] == "pitHag"
    });
    events.push(transition_event(
        "transition-dreamer",
        &pit_hag["value"]["currentStep"],
        "characterChange",
        "player-2",
        "clockmaker",
        "dreamer",
        (true, true),
    ));
    let changed = replay(&events);
    assert_eq!(changed["ok"], true, "replay failed: {changed}");
    assert_ne!(
        changed["value"]["currentStep"]["character"], "dreamer",
        "the remaining normal order must not be skipped"
    );

    let dreamer = advance_to(&mut events, |state| {
        state["value"]["currentStep"]["character"] == "dreamer"
            && state["value"]["currentStep"]["playerId"] == "player-2"
    });
    assert!(dreamer["value"]["currentStep"]["id"]
        .as_str()
        .unwrap()
        .contains("transition-dreamer"));
    let matching = dreamer["value"]["phaseOverview"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|step| step["character"] == "dreamer" && step["playerId"] == "player-2")
        .count();
    assert_eq!(matching, 1);
}

#[test]
fn an_ordinary_ability_whose_order_passed_waits_until_the_next_night() {
    let mut events = vec![setup_event()];
    let mathematician = advance_to(&mut events, |state| {
        state["value"]["phase"] == "night"
            && state["value"]["currentStep"]["character"] == "mathematician"
    });
    events.push(transition_event(
        "transition-late-dreamer",
        &mathematician["value"]["currentStep"],
        "characterChange",
        "player-5",
        "mathematician",
        "dreamer",
        (true, true),
    ));
    let after = replay(&events);
    assert_eq!(after["ok"], true, "replay failed: {after}");
    assert_eq!(after["value"]["currentStep"]["id"], "night:toDay");
    assert!(after["value"]["phaseOverview"]
        .as_array()
        .unwrap()
        .iter()
        .all(|step| { !(step["character"] == "dreamer" && step["playerId"] == "player-5") }));

    let next_night = advance_to(&mut events, |state| {
        state["value"]["currentStep"]["id"]
            .as_str()
            .is_some_and(|id| id.starts_with("night2"))
            && state["value"]["currentStep"]["character"] == "dreamer"
            && state["value"]["currentStep"]["playerId"] == "player-5"
    });
    assert!(next_night["value"]["currentStep"]["id"]
        .as_str()
        .unwrap()
        .contains("transition-late-dreamer"));
}

#[test]
fn once_per_game_usage_is_scoped_to_the_latest_ability_acquisition() {
    let mut setup = setup_event();
    setup["payload"]["players"][1]["actualCharacter"] = json!("artist");
    setup["payload"]["players"][1]["shownCharacter"] = json!("artist");
    let mut events = vec![setup];
    let first_day = advance_to(&mut events, |state| state["value"]["phase"] == "day");
    assert!(first_day["value"]["availableDayActions"]
        .as_array()
        .unwrap()
        .iter()
        .any(|action| action["actorPlayerId"] == "player-2" && action["characterId"] == "artist"));
    let expected_event_count = events.len();
    append(
        &mut events,
        json!({
            "type": "recordDayAction",
            "payload": {
                "dayId": "day", "expectedEventCount": expected_event_count, "actorPlayerId": "player-2",
                "record": { "kind": "artist", "question": "test", "answer": "yes" }
            }
        }),
    );

    let mathematician = advance_to(&mut events, |state| {
        state["value"]["phase"] == "night"
            && state["value"]["currentStep"]["character"] == "mathematician"
    });
    events.push(transition_event(
        "transition-away",
        &mathematician["value"]["currentStep"],
        "characterChange",
        "player-2",
        "artist",
        "mutant",
        (true, true),
    ));
    let next_pit_hag = advance_to(&mut events, |state| {
        state["value"]["currentStep"]["id"]
            .as_str()
            .is_some_and(|id| id.starts_with("night2:pitHag"))
    });
    events.push(transition_event(
        "transition-new-artist",
        &next_pit_hag["value"]["currentStep"],
        "characterChange",
        "player-2",
        "mutant",
        "artist",
        (true, true),
    ));
    let next_day = advance_to(&mut events, |state| {
        state["value"]["phase"] == "day"
            && state["value"]["currentStep"]["id"]
                .as_str()
                .is_some_and(|id| id.starts_with("day3:"))
    });
    assert!(next_day["value"]["availableDayActions"]
        .as_array()
        .unwrap()
        .iter()
        .any(|action| action["actorPlayerId"] == "player-2" && action["characterId"] == "artist"));
}

#[test]
fn multiple_character_changes_have_stable_ordered_reveals() {
    let mut events = vec![setup_event()];
    let pit_hag = advance_to(&mut events, |state| {
        state["value"]["phase"] == "night" && state["value"]["currentStep"]["character"] == "pitHag"
    });
    events.push(json!({
        "id": "transition-swap", "type": "playerTransitioned", "phase": "night",
        "payload": {
            "stepId": pit_hag["value"]["currentStep"]["id"],
            "sourcePlayerId": pit_hag["value"]["currentStep"]["playerId"],
            "sourceCharacterId": "pitHag",
            "transitions": [
                {
                    "kind": "characterChange", "playerId": "player-2",
                    "before": { "actualCharacter": "clockmaker", "shownCharacter": "clockmaker", "alignment": "good", "alive": true },
                    "after": { "actualCharacter": "dreamer", "shownCharacter": "dreamer", "alignment": "good", "alive": true }
                },
                {
                    "kind": "characterChange", "playerId": "player-3",
                    "before": { "actualCharacter": "dreamer", "shownCharacter": "dreamer", "alignment": "good", "alive": true },
                    "after": { "actualCharacter": "clockmaker", "shownCharacter": "clockmaker", "alignment": "good", "alive": true }
                }
            ]
        },
        "summary": "two character changes", "createdAt": "2026-07-27T00:00:00.000Z"
    }));

    let replayed = replay(&events);
    assert_eq!(replayed["ok"], true, "replay failed: {replayed}");
    assert_eq!(
        replayed["value"]["pendingIdentityReveals"],
        json!([
            {
                "sourceEventId": "transition-swap", "sequence": 1,
                "payload": { "kind": "characterChange", "playerId": "player-2", "alignment": "good", "characterId": "dreamer" }
            },
            {
                "sourceEventId": "transition-swap", "sequence": 2,
                "payload": { "kind": "characterChange", "playerId": "player-3", "alignment": "good", "characterId": "clockmaker" }
            }
        ])
    );
}

#[test]
fn removing_a_transition_event_restores_identity_instance_reveal_and_step() {
    let mut events = vec![setup_event()];
    let pit_hag = advance_to(&mut events, |state| {
        state["value"]["phase"] == "night" && state["value"]["currentStep"]["character"] == "pitHag"
    });
    let before_event_count = events.len();
    events.push(transition_event(
        "transition-undo",
        &pit_hag["value"]["currentStep"],
        "characterChange",
        "player-6",
        "mutant",
        "clockmaker",
        (true, true),
    ));
    assert_eq!(
        replay(&events)["value"]["players"][5]["actualCharacter"],
        "clockmaker"
    );

    events.truncate(before_event_count);
    let undone = replay(&events);
    assert_eq!(undone["ok"], true, "replay failed: {undone}");
    assert_eq!(undone["value"]["players"][5]["actualCharacter"], "mutant");
    assert_eq!(
        undone["value"]["players"][5]["abilityInstance"]["id"],
        "setup:player-6"
    );
    assert!(undone["value"].get("pendingIdentityReveals").is_none());
    assert_eq!(
        undone["value"]["currentStep"]["id"],
        pit_hag["value"]["currentStep"]["id"]
    );
}

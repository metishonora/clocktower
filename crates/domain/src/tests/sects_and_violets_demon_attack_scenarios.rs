use crate::{propose_json, replay_json};
use serde_json::{json, Value};

const DEMONS: [&str; 4] = ["fangGu", "vigormortis", "noDashii", "vortox"];

fn setup_event(demon: &str) -> Value {
    json!({
        "id": "setup-1",
        "type": "setupConfirmed",
        "phase": "setup",
        "payload": { "players": [
            { "id": "player-1", "seat": 1, "name": "Flowergirl", "actualCharacter": "flowergirl", "shownCharacter": "flowergirl" },
            { "id": "player-2", "seat": 2, "name": "Town Crier", "actualCharacter": "townCrier", "shownCharacter": "townCrier" },
            { "id": "player-3", "seat": 3, "name": "Oracle", "actualCharacter": "oracle", "shownCharacter": "oracle" },
            { "id": "player-4", "seat": 4, "name": "Savant", "actualCharacter": "savant", "shownCharacter": "savant" },
            { "id": "player-5", "seat": 5, "name": "Artist", "actualCharacter": "artist", "shownCharacter": "artist" },
            { "id": "player-6", "seat": 6, "name": "Pit-Hag", "actualCharacter": "pitHag", "shownCharacter": "pitHag" },
            { "id": "player-7", "seat": 7, "name": "Demon", "actualCharacter": demon, "shownCharacter": demon }
        ]},
        "summary": "초기 설정 확정: 7명",
        "createdAt": "2026-07-22T00:00:00.000Z"
    })
}

fn game(demon: &str, events: Vec<Value>) -> Value {
    json!({
        "schemaVersion": 3,
        "game": {
            "id": format!("game-snv-{demon}"),
            "name": "S&V baseline Demon attack",
            "scriptId": "sectsAndViolets",
            "createdAt": "2026-07-22T00:00:00.000Z",
            "updatedAt": "2026-07-22T00:00:00.000Z",
            "events": events
        }
    })
}

fn replay(demon: &str, events: &[Value]) -> Value {
    serde_json::from_str(&replay_json(&game(demon, events.to_vec()).to_string())).unwrap()
}

fn propose(demon: &str, events: &[Value], command: Value) -> Value {
    serde_json::from_str(&propose_json(
        &game(demon, events.to_vec()).to_string(),
        &command.to_string(),
    ))
    .unwrap()
}

fn append_current_resolution(demon: &str, events: &mut Vec<Value>) -> Value {
    let state = replay(demon, events);
    assert_eq!(state["ok"], true, "replay failed: {state}");
    let step = &state["value"]["currentStep"];
    let command = if step["requiredInput"]["kind"] == "nomination" {
        json!({
            "type": "skipStep",
            "payload": { "stepId": step["id"] }
        })
    } else if step["requiredInput"]["kind"] == "executionDecision" {
        json!({
            "type": "confirmStep",
            "payload": { "stepId": step["id"], "input": { "execute": false } }
        })
    } else if step["requiredInput"]["kind"] == "characterTransformation" {
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": step["id"],
                "input": { "playerIds": ["player-6"], "characterIds": ["pitHag"] }
            }
        })
    } else if step["support"] == "manual" {
        json!({
            "type": "resolveManualStep",
            "payload": { "stepId": step["id"], "outcome": "handled" }
        })
    } else if step["informationPrompt"]["deliveryMode"] == "selectable"
        && step["informationPrompt"]["computedResult"]["kind"] == "number"
    {
        json!({ "type": "confirmStep", "payload": { "stepId": step["id"], "input": null, "deliveredResult": { "kind": "number", "value": step["informationPrompt"]["numberChoices"][0]["value"] } } })
    } else if step["informationPrompt"]["deliveryMode"] == "selectable"
        && step["informationPrompt"]["computedResult"]["kind"] == "boolean"
    {
        json!({ "type": "confirmStep", "payload": { "stepId": step["id"], "input": null, "deliveredResult": { "kind": "boolean", "value": step["informationPrompt"]["booleanChoices"][0]["value"] } } })
    } else {
        json!({
            "type": "confirmStep",
            "payload": { "stepId": step["id"], "input": null }
        })
    };
    let proposal = propose(demon, events, command);
    assert_eq!(
        proposal["ok"], true,
        "proposal failed from {state}: {proposal}"
    );
    events.push(proposal["value"]["event"].clone());
    state
}

fn advance_to_demon(demon: &str, events: &mut Vec<Value>) -> Value {
    for _ in 0..32 {
        let state = replay(demon, events);
        assert_eq!(state["ok"], true, "replay failed: {state}");
        if state["value"]["currentStep"]["character"]
            .as_str()
            .is_some_and(|character| DEMONS.contains(&character))
        {
            return state;
        }
        append_current_resolution(demon, events);
    }
    panic!("did not reach the baseline Demon action");
}

fn confirm_attack(demon: &str, events: &mut Vec<Value>, target_player_id: &str) -> Value {
    let before = advance_to_demon(demon, events);
    let step_id = before["value"]["currentStep"]["id"]
        .as_str()
        .unwrap()
        .to_string();
    let proposal = propose(
        demon,
        events,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": step_id,
                "input": { "playerIds": [target_player_id] }
            }
        }),
    );
    assert_eq!(
        proposal["ok"], true,
        "attack failed from {before}: {proposal}"
    );
    events.push(proposal["value"]["event"].clone());
    proposal
}

fn advance_to_step(demon: &str, events: &mut Vec<Value>, expected_step_id: &str) -> Value {
    for _ in 0..96 {
        let state = replay(demon, events);
        assert_eq!(state["ok"], true, "replay failed: {state}");
        if state["value"]["currentStep"]["id"] == expected_step_id {
            return state;
        }
        append_current_resolution(demon, events);
    }
    panic!("did not reach {expected_step_id}");
}

fn confirm_vigormortis_minion_attack(
    events: &mut Vec<Value>,
    minion_player_id: &str,
    poison_target_player_id: &str,
) -> Value {
    let before = advance_to_demon("vigormortis", events);
    let step_id = before["value"]["currentStep"]["id"]
        .as_str()
        .unwrap()
        .to_string();
    let proposal = propose(
        "vigormortis",
        events,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": step_id,
                "input": { "playerIds": [minion_player_id, poison_target_player_id] }
            }
        }),
    );
    assert_eq!(
        proposal["ok"], true,
        "Vigormortis Minion attack failed from {before}: {proposal}"
    );
    events.push(proposal["value"]["event"].clone());
    proposal
}

#[test]
fn all_four_snv_demons_share_one_canonical_baseline_attack_contract() {
    for demon in DEMONS {
        let mut events = vec![setup_event(demon)];
        let before = advance_to_demon(demon, &mut events);
        assert_eq!(before["value"]["currentStep"]["id"], "night:demon:player-7");
        assert_eq!(before["value"]["currentStep"]["character"], demon);
        assert_eq!(before["value"]["currentStep"]["playerId"], "player-7");
        assert_eq!(before["value"]["currentStep"]["support"], "automated");
        assert_eq!(
            before["value"]["currentStep"]["requiredInput"]["allowedPlayerIds"],
            json!([
                "player-1", "player-2", "player-3", "player-4", "player-5", "player-6", "player-7"
            ]),
            "dead and self targets remain rule-valid"
        );

        let proposal = confirm_attack(demon, &mut events, "player-4");
        assert_eq!(proposal["value"]["event"]["type"], "nightActionResolved");
        assert_eq!(
            proposal["value"]["event"]["payload"],
            json!({
                "stepId": "night:demon:player-7",
                "actorPlayerId": "player-7",
                "actorCharacterId": demon,
                "resolution": {
                    "kind": "demonAttack",
                    "targetPlayerId": "player-4",
                    "outcome": {
                        "kind": "deaths",
                        "deaths": [{
                            "playerId": "player-4",
                            "cause": {
                                "kind": "demonAttack",
                                "actorPlayerId": "player-7",
                                "actorCharacterId": demon,
                                "targetPlayerId": "player-4"
                            }
                        }]
                    }
                }
            })
        );

        let after = replay(demon, &events);
        assert_eq!(after["ok"], true, "replay failed: {after}");
        assert_eq!(after["value"]["players"][3]["alive"], false);
        assert_eq!(
            after["value"]["ruleState"]["unannouncedNightDeathPlayerIds"],
            json!(["player-4"])
        );

        let undone = replay(demon, &events[..events.len() - 1]);
        assert_eq!(undone["value"]["players"][3]["alive"], true);
        assert_eq!(undone["value"]["currentStep"]["id"], "night:demon:player-7");
    }
}

#[test]
fn a_dead_target_is_a_legal_audited_no_effect_and_does_not_die_twice() {
    let demon = "vortox";
    let mut events = vec![setup_event(demon)];
    confirm_attack(demon, &mut events, "player-4");

    for _ in 0..48 {
        let state = replay(demon, &events);
        let step = &state["value"]["currentStep"];
        if step["id"] == "night2:demon:player-7" {
            break;
        }
        append_current_resolution(demon, &mut events);
    }
    let proposal = confirm_attack(demon, &mut events, "player-4");
    assert_eq!(
        proposal["value"]["event"]["payload"]["resolution"]["outcome"],
        json!({ "kind": "noEffect", "reason": "targetAlreadyDead" })
    );

    let replayed = replay(demon, &events);
    assert_eq!(replayed["ok"], true, "replay failed: {replayed}");
    assert_eq!(
        replayed["value"]["ruleState"]["unannouncedNightDeathPlayerIds"],
        Value::Array(vec![])
    );

    for _ in 0..32 {
        let state = replay(demon, &events);
        if state["value"]["currentStep"]["stepType"] == "announcement" {
            break;
        }
        append_current_resolution(demon, &mut events);
    }
    let announcement = propose(
        demon,
        &events,
        json!({
            "type": "confirmStep",
            "payload": { "stepId": "day3:announceDeaths", "input": null }
        }),
    );
    assert_eq!(
        announcement["ok"], true,
        "empty announcement failed: {announcement}"
    );
    assert_eq!(
        announcement["value"]["event"]["payload"],
        json!({ "stepId": "day3:announceDeaths", "playerIds": [] })
    );
}

#[test]
fn a_self_attack_kills_the_demon_and_surfaces_the_existing_good_win_warning() {
    let demon = "noDashii";
    let mut events = vec![setup_event(demon)];
    confirm_attack(demon, &mut events, "player-7");

    let replayed = replay(demon, &events);
    assert_eq!(replayed["ok"], true, "replay failed: {replayed}");
    assert_eq!(replayed["value"]["players"][6]["alive"], false);
    assert!(replayed["value"]["warnings"]
        .as_array()
        .unwrap()
        .iter()
        .any(|warning| warning["code"] == "DEMON_DEAD_GOOD_WIN"));
}

#[test]
fn dawn_announcement_is_canonical_replayable_and_publicly_hides_the_cause() {
    let demon = "fangGu";
    let mut events = vec![setup_event(demon)];
    confirm_attack(demon, &mut events, "player-4");

    for _ in 0..32 {
        let state = replay(demon, &events);
        if state["value"]["currentStep"]["stepType"] == "announcement" {
            break;
        }
        append_current_resolution(demon, &mut events);
    }
    let before = replay(demon, &events);
    assert_eq!(before["value"]["currentStep"]["id"], "day2:announceDeaths");
    assert_eq!(
        before["value"]["ruleState"]["unannouncedNightDeathPlayerIds"],
        json!(["player-4"])
    );

    let announcement = propose(
        demon,
        &events,
        json!({
            "type": "confirmStep",
            "payload": { "stepId": "day2:announceDeaths", "input": null }
        }),
    );
    assert_eq!(
        announcement["ok"], true,
        "announcement failed: {announcement}"
    );
    assert_eq!(
        announcement["value"]["event"]["type"],
        "nightDeathsAnnounced"
    );
    assert_eq!(
        announcement["value"]["event"]["payload"],
        json!({ "stepId": "day2:announceDeaths", "playerIds": ["player-4"] })
    );
    assert!(announcement["value"]["event"]["summary"]
        .as_str()
        .unwrap()
        .contains("Savant"));
    assert!(!announcement["value"]["event"]["summary"]
        .as_str()
        .unwrap()
        .contains("fangGu"));

    events.push(announcement["value"]["event"].clone());
    let after = replay(demon, &events);
    assert_eq!(
        after["value"]["ruleState"]["unannouncedNightDeathPlayerIds"],
        Value::Array(vec![])
    );
    assert_eq!(after["value"]["players"][3]["deathAnnounced"], true);

    let undone = replay(demon, &events[..events.len() - 1]);
    assert_eq!(undone["value"]["currentStep"]["id"], "day2:announceDeaths");
    assert_eq!(undone["value"]["players"][3]["deathAnnounced"], false);
}

#[test]
fn historical_manual_demon_steps_remain_replayable_after_automation() {
    let demon = "vortox";
    let mut events = vec![setup_event(demon)];
    let before = advance_to_demon(demon, &mut events);
    assert_eq!(before["value"]["currentStep"]["id"], "night:demon:player-7");
    events.push(json!({
        "id": "legacy-manual-vortox",
        "type": "manualPhaseStepResolved",
        "phase": "night",
        "payload": { "stepId": "night:vortox", "outcome": "handled" },
        "summary": "수동 단계 처리: night:vortox",
        "createdAt": "2026-07-21T00:00:00.000Z"
    }));

    let replayed = replay(demon, &events);
    assert_eq!(replayed["ok"], true, "legacy replay failed: {replayed}");
    assert_ne!(
        replayed["value"]["currentStep"]["id"],
        "night:demon:player-7"
    );
    let demon_status = replayed["value"]["phaseOverview"]
        .as_array()
        .unwrap()
        .iter()
        .find(|step| step["id"] == "night:demon:player-7")
        .map(|step| &step["status"]);
    assert_eq!(demon_status, Some(&json!("manualComplete")));

    for _ in 0..32 {
        let state = replay(demon, &events);
        if state["value"]["currentStep"]["id"] == "night:toDay" {
            break;
        }
        append_current_resolution(demon, &mut events);
    }
    append_current_resolution(demon, &mut events);
    events.push(json!({
        "id": "legacy-manual-day-2",
        "type": "manualPhaseStepResolved",
        "phase": "day",
        "payload": { "stepId": "day2:manual", "outcome": "handled" },
        "summary": "수동 단계 처리: day2:manual",
        "createdAt": "2026-07-21T00:00:00.000Z"
    }));
    let day = replay(demon, &events);
    assert_eq!(day["ok"], true, "legacy day replay failed: {day}");
    assert_eq!(day["value"]["currentStep"]["id"], "night2:pitHag:player-6");
}

#[test]
fn replay_rejects_a_tampered_demon_death_audit() {
    let demon = "vortox";
    let mut events = vec![setup_event(demon)];
    confirm_attack(demon, &mut events, "player-4");
    events.last_mut().unwrap()["payload"]["resolution"]["outcome"]["deaths"][0]["cause"]
        ["actorCharacterId"] = json!("noDashii");

    let replayed = replay(demon, &events);
    assert_eq!(replayed["error"]["code"], "REPLAY_FAILED");
}

#[test]
fn no_dashii_continuously_poisons_the_nearest_townsfolk_even_when_dead() {
    let mut events = vec![setup_event("noDashii")];
    let initial = replay("noDashii", &events);
    assert_eq!(
        initial["value"]["ruleState"]["activeImpairments"],
        json!([
            {
                "kind": "poisoned",
                "playerId": "player-1",
                "sourceEventId": "setup-1",
                "sourceCharacterId": "noDashii",
                "expires": "never"
            },
            {
                "kind": "poisoned",
                "playerId": "player-5",
                "sourceEventId": "setup-1",
                "sourceCharacterId": "noDashii",
                "expires": "never"
            }
        ])
    );

    confirm_attack("noDashii", &mut events, "player-5");
    let after_death = replay("noDashii", &events);
    assert_eq!(after_death["value"]["players"][4]["alive"], false);
    assert!(after_death["value"]["ruleState"]["activeImpairments"]
        .as_array()
        .unwrap()
        .iter()
        .any(|impairment| impairment["playerId"] == "player-5"));

    let mut transformed_events = vec![setup_event("noDashii")];
    advance_to_step("noDashii", &mut transformed_events, "night:pitHag:player-6");
    let transformation = propose(
        "noDashii",
        &transformed_events,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "night:pitHag:player-6",
                "input": { "playerIds": ["player-5"], "characterIds": ["klutz"] }
            }
        }),
    );
    assert_eq!(transformation["ok"], true, "{transformation}");
    transformed_events.push(transformation["value"]["event"].clone());
    let recalculated = replay("noDashii", &transformed_events);
    let poisoned_ids = recalculated["value"]["ruleState"]["activeImpairments"]
        .as_array()
        .unwrap()
        .iter()
        .map(|impairment| impairment["playerId"].as_str().unwrap())
        .collect::<Vec<_>>();
    assert_eq!(poisoned_ids, vec!["player-1", "player-4"]);
}

#[test]
fn vigormortis_records_one_neighbor_choice_and_keeps_it_while_the_townsfolk_is_valid() {
    let mut events = vec![setup_event("vigormortis")];
    let before = advance_to_demon("vigormortis", &mut events);
    assert_eq!(
        before["value"]["currentStep"]["requiredInput"]["dependentPlayerSelections"],
        json!([{
            "triggerPlayerId": "player-6",
            "selectionIndex": 1,
            "allowedPlayerIds": ["player-1", "player-5"]
        }])
    );

    let attack = confirm_vigormortis_minion_attack(&mut events, "player-6", "player-5");
    let source_event_id = attack["value"]["event"]["id"].as_str().unwrap();
    assert_eq!(
        attack["value"]["event"]["payload"]["resolution"]["outcome"]["vigormortisEffect"],
        json!({
            "minionPlayerId": "player-6",
            "sourceAbilityInstanceId": "setup:player-7",
            "poisonTargetPlayerId": "player-5"
        })
    );
    let active = replay("vigormortis", &events);
    assert!(active["value"]["ruleState"]["activeImpairments"]
        .as_array()
        .unwrap()
        .iter()
        .any(|impairment| impairment["playerId"] == "player-5"
            && impairment["sourceEventId"] == source_event_id));

    advance_to_step("vigormortis", &mut events, "night2:demon:player-7");
    confirm_attack("vigormortis", &mut events, "player-5");
    let dead_target = replay("vigormortis", &events);
    assert_eq!(dead_target["value"]["players"][4]["alive"], false);
    assert!(dead_target["value"]["pendingVigormortisPoisonChoices"].is_null());
    assert!(dead_target["value"]["ruleState"]["activeImpairments"]
        .as_array()
        .unwrap()
        .iter()
        .any(|impairment| impairment["playerId"] == "player-5"
            && impairment["sourceCharacterId"] == "vigormortis"));
}

#[test]
fn vigormortis_exposes_a_canonical_replacement_only_after_the_target_becomes_invalid() {
    let mut events = vec![setup_event("vigormortis")];
    let attack = confirm_vigormortis_minion_attack(&mut events, "player-6", "player-5");
    let source_event_id = attack["value"]["event"]["id"].as_str().unwrap().to_string();

    advance_to_step("vigormortis", &mut events, "night2:pitHag:player-6");
    let transformation = propose(
        "vigormortis",
        &events,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "night2:pitHag:player-6",
                "input": { "playerIds": ["player-5"], "characterIds": ["klutz"] }
            }
        }),
    );
    assert_eq!(transformation["ok"], true, "{transformation}");
    events.push(transformation["value"]["event"].clone());

    let pending = replay("vigormortis", &events);
    assert_eq!(
        pending["value"]["pendingVigormortisPoisonChoices"],
        json!([{
            "sourceEventId": source_event_id,
            "vigormortisPlayerId": "player-7",
            "minionPlayerId": "player-6",
            "previousTargetPlayerId": "player-5",
            "allowedPlayerIds": ["player-1", "player-4"],
            "reason": "targetNotTownsfolk"
        }])
    );
    assert!(!pending["value"]["ruleState"]["activeImpairments"]
        .as_array()
        .unwrap()
        .iter()
        .any(|impairment| impairment["sourceEventId"] == source_event_id));

    let replacement = propose(
        "vigormortis",
        &events,
        json!({
            "type": "resolveVigormortisPoison",
            "payload": {
                "sourceEventId": source_event_id,
                "targetPlayerId": "player-4",
                "expectedEventCount": events.len()
            }
        }),
    );
    assert_eq!(replacement["ok"], true, "{replacement}");
    assert_eq!(
        replacement["value"]["event"]["type"],
        "vigormortisPoisonTargetChanged"
    );
    events.push(replacement["value"]["event"].clone());

    let resolved = replay("vigormortis", &events);
    assert!(resolved["value"]["pendingVigormortisPoisonChoices"].is_null());
    assert!(resolved["value"]["ruleState"]["activeImpairments"]
        .as_array()
        .unwrap()
        .iter()
        .any(|impairment| impairment["playerId"] == "player-4"
            && impairment["sourceEventId"] == source_event_id));
}

#[test]
fn vigormortis_effect_ends_when_the_killed_minion_resurrects_or_stops_being_a_minion() {
    let mut resurrected_events = vec![setup_event("vigormortis")];
    let attack = confirm_vigormortis_minion_attack(&mut resurrected_events, "player-6", "player-5");
    let source_event_id = attack["value"]["event"]["id"].as_str().unwrap();
    let pit_hag_step = advance_to_step(
        "vigormortis",
        &mut resurrected_events,
        "night2:pitHag:player-6",
    );
    resurrected_events.push(json!({
        "id": "resurrect-minion",
        "type": "playerTransitioned",
        "phase": "night",
        "payload": {
            "stepId": pit_hag_step["value"]["currentStep"]["id"],
            "sourcePlayerId": "player-6",
            "sourceCharacterId": "pitHag",
            "transitions": [{
                "kind": "resurrection",
                "playerId": "player-6",
                "before": {
                    "actualCharacter": "pitHag", "shownCharacter": "pitHag",
                    "alignment": "evil", "alive": false
                },
                "after": {
                    "actualCharacter": "pitHag", "shownCharacter": "pitHag",
                    "alignment": "evil", "alive": true
                }
            }]
        },
        "summary": "하수인 부활",
        "createdAt": "2026-07-28T00:00:00.000Z"
    }));
    let resurrected = replay("vigormortis", &resurrected_events);
    assert_eq!(resurrected["ok"], true, "{resurrected}");
    assert!(!resurrected["value"]["ruleState"]["activeImpairments"]
        .as_array()
        .unwrap()
        .iter()
        .any(|impairment| impairment["sourceEventId"] == source_event_id));

    let mut changed_events = vec![setup_event("vigormortis")];
    let attack = confirm_vigormortis_minion_attack(&mut changed_events, "player-6", "player-5");
    let source_event_id = attack["value"]["event"]["id"].as_str().unwrap();
    advance_to_step("vigormortis", &mut changed_events, "night2:pitHag:player-6");
    let change = propose(
        "vigormortis",
        &changed_events,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "night2:pitHag:player-6",
                "input": { "playerIds": ["player-6"], "characterIds": ["klutz"] }
            }
        }),
    );
    assert_eq!(change["ok"], true, "{change}");
    changed_events.push(change["value"]["event"].clone());
    let changed = replay("vigormortis", &changed_events);
    assert_eq!(changed["ok"], true, "{changed}");
    assert!(!changed["value"]["ruleState"]["activeImpairments"]
        .as_array()
        .unwrap()
        .iter()
        .any(|impairment| impairment["sourceEventId"] == source_event_id));
    assert!(changed["value"]["pendingVigormortisPoisonChoices"].is_null());
}

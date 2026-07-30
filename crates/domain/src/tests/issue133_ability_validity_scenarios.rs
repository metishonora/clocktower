use crate::{propose_json, replay_json};
use serde_json::{json, Value};

use super::support::snv_demon_bluff_input;

fn setup_event(demon: &str) -> Value {
    json!({
        "id": "setup-issue-133",
        "type": "setupConfirmed",
        "phase": "setup",
        "payload": { "players": [
            { "id": "player-1", "seat": 1, "name": "Sweetheart", "actualCharacter": "sweetheart", "shownCharacter": "sweetheart" },
            { "id": "player-2", "seat": 2, "name": "Clockmaker", "actualCharacter": "clockmaker", "shownCharacter": "clockmaker" },
            { "id": "player-3", "seat": 3, "name": "Flowergirl", "actualCharacter": "flowergirl", "shownCharacter": "flowergirl" },
            { "id": "player-4", "seat": 4, "name": "Town Crier", "actualCharacter": "townCrier", "shownCharacter": "townCrier" },
            { "id": "player-5", "seat": 5, "name": "Oracle", "actualCharacter": "oracle", "shownCharacter": "oracle" },
            { "id": "player-6", "seat": 6, "name": "Pit-Hag", "actualCharacter": "pitHag", "shownCharacter": "pitHag" },
            { "id": "player-7", "seat": 7, "name": "Demon", "actualCharacter": demon, "shownCharacter": demon }
        ] },
        "summary": "issue 133 setup",
        "createdAt": "2026-07-29T00:00:00.000Z"
    })
}

fn game(events: &[Value]) -> Value {
    json!({
        "schemaVersion": 3,
        "game": {
            "id": "game-issue-133",
            "name": "S&V ability validity",
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

fn assert_replay_failed(events: &[Value]) {
    let state = replay(events);
    assert_eq!(
        state["ok"], false,
        "forged replay unexpectedly passed: {state}"
    );
    assert_eq!(state["error"]["code"], "REPLAY_FAILED");
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

fn default_command(state: &Value, demon_targets: &[&str]) -> Value {
    let step = &state["value"]["currentStep"];
    let step_id = step["id"].as_str().expect("step id");
    match step["requiredInput"]["kind"].as_str().unwrap_or("none") {
        "characterIds" if step_id == "firstNight:demonInfo" => json!({
            "type": "confirmStep",
            "payload": { "stepId": step_id, "input": snv_demon_bluff_input(step) }
        }),
        "nomination" => json!({ "type": "skipStep", "payload": { "stepId": step_id } }),
        "executionDecision" => json!({
            "type": "confirmStep",
            "payload": { "stepId": step_id, "input": { "execute": false } }
        }),
        "characterTransformation" => json!({
            "type": "confirmStep",
            "payload": {
                "stepId": step_id,
                "input": { "playerIds": ["player-6"], "characterIds": ["pitHag"] }
            }
        }),
        "playerIds" if step_id.contains(":demon:") => json!({
            "type": "confirmStep",
            "payload": { "stepId": step_id, "input": { "playerIds": demon_targets } }
        }),
        "playerIds" => json!({
            "type": "confirmStep",
            "payload": {
                "stepId": step_id,
                "input": { "playerIds": [step["requiredInput"]["allowedPlayerIds"][0].clone()] }
            }
        }),
        _ if step["informationPrompt"]["deliveryMode"] == "selectable"
            && step["informationPrompt"]["computedResult"]["kind"] == "number" =>
        {
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
        }
        _ if step["informationPrompt"]["deliveryMode"] == "selectable"
            && step["informationPrompt"]["computedResult"]["kind"] == "boolean" =>
        {
            json!({
                "type": "confirmStep",
                "payload": {
                    "stepId": step_id,
                    "input": null,
                    "deliveredResult": {
                        "kind": "boolean",
                        "value": step["informationPrompt"]["booleanChoices"][0]["value"]
                    }
                }
            })
        }
        _ if step["support"] == "manual" => json!({
            "type": "resolveManualStep",
            "payload": { "stepId": step_id, "outcome": "handled" }
        }),
        _ => json!({
            "type": "confirmStep",
            "payload": { "stepId": step_id, "input": null }
        }),
    }
}

fn advance_until(
    events: &mut Vec<Value>,
    demon_targets: &[&str],
    wanted: impl Fn(&Value) -> bool,
) -> Value {
    for _ in 0..128 {
        let state = replay(events);
        assert_eq!(state["ok"], true, "replay failed: {state}");
        if wanted(&state) {
            return state;
        }
        append(events, default_command(&state, demon_targets));
    }
    panic!(
        "wanted state was not reached; final state: {}",
        replay(events)
    )
}

fn attack(events: &mut Vec<Value>, targets: &[&str]) -> Value {
    let state = advance_until(events, targets, |state| {
        state["value"]["currentStep"]["id"]
            .as_str()
            .is_some_and(|id| id.contains(":demon:"))
    });
    append(events, default_command(&state, targets))
}

fn apply_sweetheart_drunk(events: &mut Vec<Value>, target_player_id: &str) {
    attack(events, &["player-1"]);
    let pending = replay(events);
    let step_id = pending["value"]["pendingDeathConsequences"][0]["stepId"]
        .as_str()
        .expect("Sweetheart pending step");
    append(
        events,
        json!({
            "type": "resolveSweetheartConsequence",
            "payload": {
                "stepId": step_id,
                "targetPlayerId": target_player_id,
                "expectedEventCount": events.len()
            }
        }),
    );
}

#[test]
fn sweetheart_drunk_no_dashii_stops_poisoning_neighbors() {
    let mut events = vec![setup_event("noDashii")];
    apply_sweetheart_drunk(&mut events, "player-7");

    let state = replay(&events);
    assert_eq!(state["ok"], true, "replay failed: {state}");
    assert!(state["value"]["ruleState"]["activeImpairments"]
        .as_array()
        .unwrap()
        .iter()
        .all(|impairment| impairment["sourceCharacterId"] != "noDashii"));
}

#[test]
fn sweetheart_drunk_vigormortis_stops_retaining_and_poisoning_from_an_existing_kill() {
    let mut events = vec![setup_event("vigormortis")];
    attack(&mut events, &["player-6", "player-5"]);
    apply_sweetheart_drunk(&mut events, "player-7");

    let state = replay(&events);
    assert_eq!(state["ok"], true, "replay failed: {state}");
    assert!(state["value"]["ruleState"]["activeImpairments"]
        .as_array()
        .unwrap()
        .iter()
        .all(|impairment| impairment["sourceCharacterId"] != "vigormortis"));
    assert!(state["value"]["ruleState"]["automaticReminders"]
        .as_array()
        .unwrap()
        .iter()
        .all(|reminder| reminder["tokenId"] != "hasAbility"));
    assert!(state["value"]["pendingVigormortisPoisonChoices"].is_null());
}

#[test]
fn sweetheart_drunk_vortox_stops_forcing_false_townsfolk_information() {
    let mut events = vec![setup_event("vortox")];
    apply_sweetheart_drunk(&mut events, "player-7");
    let information = advance_until(&mut events, &["player-5"], |state| {
        state["value"]["currentStep"]["informationPrompt"]["computedResult"].is_object()
    });

    assert!(
        information["value"]["currentStep"]["informationPrompt"]["activeReasons"]
            .as_array()
            .unwrap()
            .iter()
            .all(|reason| reason["type"] != "vortox")
    );
}

#[test]
fn no_dashii_derived_poison_uses_source_bound_lifetime() {
    let events = vec![setup_event("noDashii")];
    let state = replay(&events);
    let no_dashii_impairments = state["value"]["ruleState"]["activeImpairments"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|impairment| impairment["sourceCharacterId"] == "noDashii")
        .collect::<Vec<_>>();
    assert!(!no_dashii_impairments.is_empty());
    assert!(no_dashii_impairments
        .iter()
        .all(|impairment| impairment["expires"] == "whileSourceAbilityActive"));
}

#[test]
fn vigormortis_derived_poison_uses_source_bound_lifetime() {
    let mut events = vec![setup_event("vigormortis")];
    attack(&mut events, &["player-6", "player-5"]);
    let state = replay(&events);
    let vigormortis_impairment = state["value"]["ruleState"]["activeImpairments"]
        .as_array()
        .unwrap()
        .iter()
        .find(|impairment| impairment["sourceCharacterId"] == "vigormortis")
        .expect("Vigormortis poison");
    assert_eq!(
        vigormortis_impairment["expires"],
        "whileSourceAbilityActive"
    );
}

fn consequence_setup_event() -> Value {
    let mut setup = setup_event("noDashii");
    setup["payload"]["players"][1]["name"] = json!("Barber");
    setup["payload"]["players"][1]["actualCharacter"] = json!("barber");
    setup["payload"]["players"][1]["shownCharacter"] = json!("barber");
    setup["payload"]["players"][2]["name"] = json!("Klutz");
    setup["payload"]["players"][2]["actualCharacter"] = json!("klutz");
    setup["payload"]["players"][2]["shownCharacter"] = json!("klutz");
    setup
}

fn confirm_pit_hag_arbitrary_deaths(events: &mut Vec<Value>, player_ids: &[&str]) {
    let pit_hag = advance_until(events, &["player-4"], |state| {
        state["value"]["currentStep"]["id"] == "night:pitHag:player-6"
    });
    append(
        events,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": pit_hag["value"]["currentStep"]["id"],
                "input": { "playerIds": ["player-5"], "characterIds": ["vortox"] }
            }
        }),
    );
    let arbitrary_deaths = advance_until(events, &["player-4"], |state| {
        state["value"]["currentStep"]["id"] == "night:pitHagArbitraryDeaths"
    });
    append(
        events,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": arbitrary_deaths["value"]["currentStep"]["id"],
                "input": { "playerIds": player_ids }
            }
        }),
    );
}

#[test]
fn healthy_barber_trigger_remains_effective_after_sweetheart_drunk_is_applied() {
    let mut events = vec![consequence_setup_event()];
    confirm_pit_hag_arbitrary_deaths(&mut events, &["player-1", "player-2"]);

    let sweetheart = replay(&events);
    assert_eq!(
        sweetheart["value"]["pendingDeathConsequences"][0]["kind"],
        "sweetheart"
    );
    let sweetheart_step = sweetheart["value"]["pendingDeathConsequences"][0]["stepId"]
        .as_str()
        .unwrap();
    let expected_event_count = events.len();
    append(
        &mut events,
        json!({
            "type": "resolveSweetheartConsequence",
            "payload": {
                "stepId": sweetheart_step,
                "targetPlayerId": "player-2",
                "expectedEventCount": expected_event_count
            }
        }),
    );

    let barber = replay(&events);
    let pending = &barber["value"]["pendingDeathConsequences"][0];
    assert_eq!(pending["kind"], "barber");
    assert_eq!(pending["actorImpairedAtTrigger"], false);
    assert_eq!(
        pending["eligibleChooserPlayerIds"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
    let proposal = propose(
        &events,
        json!({
            "type": "resolveBarberConsequence",
            "payload": {
                "stepId": pending["stepId"],
                "chooserDemonPlayerId": pending["eligibleChooserPlayerIds"][0],
                "decision": { "kind": "decline" },
                "expectedEventCount": events.len()
            }
        }),
    );
    assert_eq!(proposal["ok"], true, "proposal failed: {proposal}");
    assert_eq!(
        proposal["value"]["event"]["payload"]["outcome"],
        json!({ "kind": "declined" })
    );
}

#[test]
fn barber_allows_an_eligible_demon_to_swap_themself_when_multiple_demons_live() {
    let mut events = vec![consequence_setup_event()];
    confirm_pit_hag_arbitrary_deaths(&mut events, &["player-2"]);

    let state = replay(&events);
    let pending = &state["value"]["pendingDeathConsequences"][0];
    assert_eq!(pending["kind"], "barber");
    assert_eq!(
        pending["eligibleChooserPlayerIds"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
    let expected_event_count = events.len();
    let proposal = append(
        &mut events,
        json!({
            "type": "resolveBarberConsequence",
            "payload": {
                "stepId": pending["stepId"],
                "chooserDemonPlayerId": "player-7",
                "decision": { "kind": "swap", "playerIds": ["player-7", "player-4"] },
                "expectedEventCount": expected_event_count
            }
        }),
    );
    assert_eq!(
        proposal["value"]["event"]["payload"]["outcome"]["kind"],
        "swapped"
    );
    let after = replay(&events);
    let players = after["value"]["players"].as_array().unwrap();
    assert_eq!(
        players
            .iter()
            .find(|player| player["id"] == "player-7")
            .unwrap()["actualCharacter"],
        "townCrier"
    );
    assert_eq!(
        players
            .iter()
            .find(|player| player["id"] == "player-4")
            .unwrap()["actualCharacter"],
        "noDashii"
    );
}

#[test]
fn healthy_barber_with_no_living_demon_emits_canonical_no_effect() {
    let mut events = vec![consequence_setup_event()];
    confirm_pit_hag_arbitrary_deaths(&mut events, &["player-2", "player-5", "player-7"]);

    let state = replay(&events);
    let pending = &state["value"]["pendingDeathConsequences"][0];
    assert_eq!(pending["kind"], "barber");
    assert_eq!(pending["actorImpairedAtTrigger"], false);
    assert!(pending["eligibleChooserPlayerIds"]
        .as_array()
        .unwrap()
        .is_empty());
    let proposal = propose(
        &events,
        json!({
            "type": "resolveBarberConsequence",
            "payload": {
                "stepId": pending["stepId"],
                "expectedEventCount": events.len()
            }
        }),
    );
    assert_eq!(proposal["ok"], true, "proposal failed: {proposal}");
    assert_eq!(
        proposal["value"]["event"]["payload"]["outcome"],
        json!({ "kind": "noEffect", "reason": "noLivingDemon" })
    );
    assert!(proposal["value"]["event"]["payload"]
        .get("chooserDemonPlayerId")
        .is_none());
    assert!(proposal["value"]["event"]["payload"]
        .get("decision")
        .is_none());
}

#[test]
fn trigger_impaired_barber_proposes_target_free_canonical_no_effect() {
    let mut events = vec![consequence_setup_event()];
    apply_sweetheart_drunk(&mut events, "player-2");
    attack(&mut events, &["player-2"]);

    let state = replay(&events);
    let pending = &state["value"]["pendingDeathConsequences"][0];
    assert_eq!(pending["kind"], "barber");
    assert_eq!(pending["actorImpairedAtTrigger"], true);
    let proposal = propose(
        &events,
        json!({
            "type": "resolveBarberConsequence",
            "payload": {
                "stepId": pending["stepId"],
                "expectedEventCount": events.len()
            }
        }),
    );
    assert_eq!(proposal["ok"], true, "proposal failed: {proposal}");
    assert_eq!(
        proposal["value"]["event"]["payload"],
        json!({
            "stepId": pending["stepId"],
            "trigger": {
                "sourceEventId": pending["sourceEventId"],
                "deathSequence": pending["deathSequence"],
                "playerId": pending["actorPlayerId"],
                "sourceAbilityInstanceId": pending["sourceAbilityInstanceId"]
            },
            "outcome": { "kind": "noEffect", "reason": "actorImpairedAtDeath" }
        })
    );

    let mut canonical = events.clone();
    canonical.push(proposal["value"]["event"].clone());
    assert_eq!(replay(&canonical)["ok"], true);

    let mut forged = canonical;
    forged.last_mut().unwrap()["payload"]["chooserDemonPlayerId"] = json!("player-7");
    assert_replay_failed(&forged);
}

#[test]
fn trigger_impaired_klutz_proposes_target_free_canonical_no_effect() {
    let mut events = vec![consequence_setup_event()];
    apply_sweetheart_drunk(&mut events, "player-3");
    attack(&mut events, &["player-3"]);
    let announcement = advance_until(&mut events, &["player-4"], |state| {
        state["value"]["currentStep"]["id"]
            .as_str()
            .is_some_and(|id| id.ends_with(":announceDeaths"))
    });
    append(&mut events, default_command(&announcement, &["player-4"]));

    let state = replay(&events);
    let pending = &state["value"]["pendingDeathConsequences"][0];
    assert_eq!(pending["kind"], "klutz");
    assert_eq!(pending["actorImpairedAtTrigger"], true);
    let proposal = propose(
        &events,
        json!({
            "type": "resolveKlutzConsequence",
            "payload": {
                "stepId": pending["stepId"],
                "expectedEventCount": events.len()
            }
        }),
    );
    assert_eq!(proposal["ok"], true, "proposal failed: {proposal}");
    assert_eq!(
        proposal["value"]["event"]["payload"],
        json!({
            "stepId": pending["stepId"],
            "trigger": {
                "sourceEventId": pending["sourceEventId"],
                "deathSequence": pending["deathSequence"],
                "playerId": pending["actorPlayerId"],
                "sourceAbilityInstanceId": pending["sourceAbilityInstanceId"]
            },
            "outcome": { "kind": "actorImpaired" }
        })
    );

    let mut canonical = events.clone();
    canonical.push(proposal["value"]["event"].clone());
    assert_eq!(replay(&canonical)["ok"], true);

    let mut forged = canonical;
    forged.last_mut().unwrap()["payload"]["targetPlayerId"] = json!("player-4");
    assert_replay_failed(&forged);
}

#[test]
fn trigger_impaired_sweetheart_rejects_a_forged_unused_target() {
    let mut setup = setup_event("vortox");
    setup["payload"]["players"][0]["name"] = json!("Snake Charmer");
    setup["payload"]["players"][0]["actualCharacter"] = json!("snakeCharmer");
    setup["payload"]["players"][0]["shownCharacter"] = json!("snakeCharmer");
    let mut events = vec![setup];

    let snake_charmer = advance_until(&mut events, &["player-4"], |state| {
        state["value"]["currentStep"]["id"] == "firstNight:snakeCharmer:player-1"
    });
    append(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": snake_charmer["value"]["currentStep"]["id"],
                "input": { "playerIds": ["player-7"] }
            }
        }),
    );

    let pit_hag = advance_until(&mut events, &["player-4"], |state| {
        state["value"]["currentStep"]["id"] == "night:pitHag:player-6"
    });
    append(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": pit_hag["value"]["currentStep"]["id"],
                "input": { "playerIds": ["player-7"], "characterIds": ["sweetheart"] }
            }
        }),
    );
    attack(&mut events, &["player-7"]);

    let state = replay(&events);
    let pending = &state["value"]["pendingDeathConsequences"][0];
    assert_eq!(pending["kind"], "sweetheart");
    assert_eq!(pending["actorImpairedAtTrigger"], true);
    let proposal = propose(
        &events,
        json!({
            "type": "resolveSweetheartConsequence",
            "payload": {
                "stepId": pending["stepId"],
                "expectedEventCount": events.len()
            }
        }),
    );
    assert_eq!(proposal["ok"], true, "proposal failed: {proposal}");
    assert!(proposal["value"]["event"]["payload"]
        .get("targetPlayerId")
        .is_none());

    let mut canonical = events.clone();
    canonical.push(proposal["value"]["event"].clone());
    assert_eq!(replay(&canonical)["ok"], true);

    let mut forged = canonical;
    forged.last_mut().unwrap()["payload"]["targetPlayerId"] = json!("player-2");
    assert_replay_failed(&forged);
}

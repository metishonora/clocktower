use crate::{propose_json, replay_json};
use serde_json::{json, Value};

use super::support::snv_demon_bluff_input;

fn setup_event(demon: &str) -> Value {
    json!({
        "id": "setup-107",
        "type": "setupConfirmed",
        "phase": "setup",
        "payload": { "players": [
            { "id": "player-1", "seat": 1, "name": "Philosopher", "actualCharacter": "philosopher", "shownCharacter": "philosopher" },
            { "id": "player-2", "seat": 2, "name": "Artist", "actualCharacter": "artist", "shownCharacter": "artist" },
            { "id": "player-3", "seat": 3, "name": "Clockmaker", "actualCharacter": "clockmaker", "shownCharacter": "clockmaker" },
            { "id": "player-4", "seat": 4, "name": "Oracle", "actualCharacter": "oracle", "shownCharacter": "oracle" },
            { "id": "player-5", "seat": 5, "name": "Snake Charmer", "actualCharacter": "snakeCharmer", "shownCharacter": "snakeCharmer" },
            { "id": "player-6", "seat": 6, "name": "Mathematician", "actualCharacter": "mathematician", "shownCharacter": "mathematician" },
            { "id": "player-7", "seat": 7, "name": "Cerenovus", "actualCharacter": "cerenovus", "shownCharacter": "cerenovus" },
            { "id": "player-8", "seat": 8, "name": "Demon", "actualCharacter": demon, "shownCharacter": demon }
        ]},
        "summary": "초기 설정 확정: 철학자 회귀",
        "createdAt": "2026-08-04T00:00:00.000Z"
    })
}

fn setup_with_in_play_good_character(character_id: &str) -> Value {
    let mut setup = setup_event("fangGu");
    let fillers = [
        "clockmaker",
        "dreamer",
        "snakeCharmer",
        "mathematician",
        "flowergirl",
        "townCrier",
        "oracle",
        "savant",
        "seamstress",
        "artist",
        "juggler",
        "sage",
        "mutant",
        "sweetheart",
        "barber",
        "klutz",
    ]
    .into_iter()
    .filter(|candidate| *candidate != character_id)
    .take(4)
    .collect::<Vec<_>>();
    for (index, assigned) in std::iter::once(character_id).chain(fillers).enumerate() {
        setup["payload"]["players"][index + 1]["actualCharacter"] = json!(assigned);
        setup["payload"]["players"][index + 1]["shownCharacter"] = json!(assigned);
    }
    setup
}

fn game(events: &[Value]) -> Value {
    json!({
        "schemaVersion": 3,
        "game": {
            "id": "game-issue-107",
            "name": "Issue 107 Philosopher",
            "scriptId": "sectsAndViolets",
            "createdAt": "2026-08-04T00:00:00.000Z",
            "updatedAt": "2026-08-04T00:00:00.000Z",
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

fn philosopher_step(events: &[Value]) -> Value {
    let state = replay(events);
    assert_eq!(state["ok"], true, "replay failed: {state}");
    let step = state["value"]["currentStep"].clone();
    assert_eq!(step["character"], "philosopher", "state={state}");
    assert_eq!(step["playerId"], "player-1", "state={state}");
    step
}

fn acquisition_proposal(events: &[Value], character_id: &str) -> Value {
    let step = philosopher_step(events);
    propose(
        events,
        json!({ "type": "confirmStep", "payload": {
            "stepId": step["id"],
            "expectedEventCount": events.len(),
            "input": { "characterIds": [character_id] }
        }}),
    )
}

fn append_acquisition(events: &mut Vec<Value>, character_id: &str) -> Value {
    let proposal = acquisition_proposal(events, character_id);
    assert_eq!(
        proposal["ok"], true,
        "Philosopher acquisition is not implemented: {proposal}"
    );
    let event = proposal["value"]["event"].clone();
    events.push(event.clone());
    event
}

fn append_default_current_step(events: &mut Vec<Value>) -> Value {
    let state = replay(events);
    assert_eq!(state["ok"], true, "replay failed: {state}");
    let step = &state["value"]["currentStep"];
    let step_id = step["id"].clone();
    let command = if step_id == "firstNight:demonInfo" {
        json!({ "type": "confirmStep", "payload": {
            "stepId": step_id,
            "expectedEventCount": events.len(),
            "input": snv_demon_bluff_input(step)
        }})
    } else if step["requiredInput"]["kind"] == "nomination" {
        json!({ "type": "skipStep", "payload": {
            "stepId": step_id,
            "expectedEventCount": events.len()
        }})
    } else if step["requiredInput"]["kind"] == "executionDecision" {
        json!({ "type": "confirmStep", "payload": {
            "stepId": step_id,
            "expectedEventCount": events.len(),
            "input": { "execute": false }
        }})
    } else if let Some(check) = step["informationPrompt"]["targetChecks"]
        .as_array()
        .and_then(|checks| checks.first())
    {
        json!({ "type": "confirmStep", "payload": {
            "stepId": step_id,
            "expectedEventCount": events.len(),
            "input": { "playerIds": check["targetPlayerIds"].clone() },
            "deliveredResult": check["choices"][0]["result"].clone(),
            "registrationJudgments": check["choices"][0]["registrationJudgments"].clone()
        }})
    } else if step["informationPrompt"]["deliveryMode"] == "selectable"
        && step["informationPrompt"]["computedResult"]["kind"] == "number"
    {
        json!({ "type": "confirmStep", "payload": {
            "stepId": step_id,
            "expectedEventCount": events.len(),
            "input": null,
            "deliveredResult": {
                "kind": "number",
                "value": step["informationPrompt"]["numberChoices"][0]["value"].clone()
            }
        }})
    } else if step["informationPrompt"]["deliveryMode"] == "selectable"
        && step["informationPrompt"]["computedResult"]["kind"] == "boolean"
    {
        json!({ "type": "confirmStep", "payload": {
            "stepId": step_id,
            "expectedEventCount": events.len(),
            "input": null,
            "deliveredResult": {
                "kind": "boolean",
                "value": step["informationPrompt"]["booleanChoices"][0]["value"].clone()
            }
        }})
    } else if matches!(
        step["character"].as_str(),
        Some("fangGu" | "vigormortis" | "noDashii" | "vortox")
    ) {
        json!({ "type": "confirmStep", "payload": {
            "stepId": step_id,
            "expectedEventCount": events.len(),
            "input": { "playerIds": ["player-2"] }
        }})
    } else if step["requiredInput"]["kind"] == "playerIds" {
        let count = step["requiredInput"]["minSelections"]
            .as_u64()
            .expect("minimum selections") as usize;
        let player_ids = step["requiredInput"]["allowedPlayerIds"]
            .as_array()
            .expect("allowed players")
            .iter()
            .take(count)
            .cloned()
            .collect::<Vec<_>>();
        json!({ "type": "confirmStep", "payload": {
            "stepId": step_id,
            "expectedEventCount": events.len(),
            "input": { "playerIds": player_ids }
        }})
    } else if step["requiredInput"]["kind"] == "madnessAssignment" {
        json!({ "type": "confirmStep", "payload": {
            "stepId": step_id,
            "expectedEventCount": events.len(),
            "input": {
                "playerIds": [step["requiredInput"]["allowedPlayerIds"][0].clone()],
                "characterId": step["requiredInput"]["allowedCharacterIds"][0].clone()
            }
        }})
    } else {
        json!({ "type": "confirmStep", "payload": {
            "stepId": step_id,
            "expectedEventCount": events.len(),
            "input": null
        }})
    };
    let proposal = propose(events, command);
    assert_eq!(
        proposal["ok"], true,
        "default proposal failed for step {step}: {proposal}"
    );
    events.push(proposal["value"]["event"].clone());
    state
}

fn advance_to_later_night(events: &mut Vec<Value>) -> Value {
    for _ in 0..20 {
        let state = replay(events);
        if state["value"]["phase"] == "night" {
            return state;
        }
        append_default_current_step(events);
    }
    panic!("later Night was not reached: {}", replay(events));
}

fn advance_to_day(events: &mut Vec<Value>) -> Value {
    for _ in 0..15 {
        let state = replay(events);
        if state["value"]["phase"] == "day" {
            return state;
        }
        append_default_current_step(events);
    }
    panic!("Day was not reached: {}", replay(events));
}

fn has_reminder(state: &Value, player_id: &str, token_id: &str) -> bool {
    state["value"]["ruleState"]["automaticReminders"]
        .as_array()
        .is_some_and(|reminders| {
            reminders.iter().any(|reminder| {
                reminder["playerId"] == player_id
                    && reminder["characterId"] == "philosopher"
                    && reminder["tokenId"] == token_id
            })
        })
}

fn automatic_reminder<'a>(
    state: &'a Value,
    player_id: &str,
    character_id: &str,
    token_id: &str,
) -> Option<&'a Value> {
    state["value"]["ruleState"]["automaticReminders"]
        .as_array()?
        .iter()
        .find(|reminder| {
            reminder["playerId"] == player_id
                && reminder["characterId"] == character_id
                && reminder["tokenId"] == token_id
        })
}

fn has_impairment(state: &Value, player_id: &str, source_event_id: &str) -> bool {
    state["value"]["ruleState"]["activeImpairments"]
        .as_array()
        .is_some_and(|impairments| {
            impairments.iter().any(|impairment| {
                impairment["kind"] == "drunk"
                    && impairment["playerId"] == player_id
                    && impairment["sourceEventId"] == source_event_id
                    && impairment["sourceCharacterId"] == "philosopher"
            })
        })
}

fn philosopher_grant<'a>(state: &'a Value, character_id: &str) -> &'a Value {
    state["value"]["ruleState"]["abilityGrants"]
        .as_array()
        .expect("ability grants projection")
        .iter()
        .find(|grant| grant["ownerPlayerId"] == "player-1" && grant["characterId"] == character_id)
        .expect("active Philosopher grant")
}

#[test]
fn philosopher_step_exposes_the_good_catalog_and_defers_without_spending() {
    let mut events = vec![setup_event("vortox")];
    let step = philosopher_step(&events);
    assert_eq!(step["requiredInput"]["kind"], "characterIds");
    assert_eq!(step["requiredInput"]["minSelections"], 1);
    assert_eq!(step["requiredInput"]["maxSelections"], 1);
    assert_eq!(
        step["requiredInput"]["allowedCharacterIds"],
        json!([
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
            "klutz"
        ])
    );
    assert_eq!(step["canSkip"], true);

    let proposal = propose(
        &events,
        json!({ "type": "skipStep", "payload": {
            "stepId": step["id"],
            "expectedEventCount": events.len()
        }}),
    );
    assert_eq!(proposal["ok"], true, "defer proposal failed: {proposal}");
    assert_eq!(
        proposal["value"]["event"]["type"],
        "philosopherAbilityResolved"
    );
    assert_eq!(
        proposal["value"]["event"]["payload"]["outcome"]["kind"],
        "deferred"
    );
    events.push(proposal["value"]["event"].clone());
    let after = replay(&events);
    assert_eq!(after["ok"], true, "defer replay failed: {after}");
    assert!(after["value"]["ruleState"]["abilityGrants"]
        .as_array()
        .is_some_and(Vec::is_empty));
}

#[test]
fn out_of_play_dreamer_grant_keeps_identity_and_waits_for_its_first_night_order() {
    let mut events = vec![setup_event("vortox")];
    let base_ability_id = replay(&events)["value"]["players"][0]["abilityInstance"]["id"]
        .as_str()
        .unwrap()
        .to_string();
    let event = append_acquisition(&mut events, "dreamer");
    assert_eq!(event["type"], "philosopherAbilityResolved");
    assert_eq!(event["payload"]["selectedCharacterId"], "dreamer");
    assert_eq!(event["payload"]["actor"]["ownerPlayerId"], "player-1");
    assert_eq!(event["payload"]["actor"]["characterId"], "philosopher");
    assert_eq!(
        event["payload"]["actor"]["abilityInstanceId"],
        base_ability_id
    );
    assert_eq!(event["payload"]["outcome"]["kind"], "acquired");

    let after = replay(&events);
    assert_eq!(after["ok"], true, "acquisition replay failed: {after}");
    let philosopher = &after["value"]["players"][0];
    assert_eq!(philosopher["actualCharacter"], "philosopher");
    assert_eq!(philosopher["shownCharacter"], "philosopher");
    assert_eq!(philosopher["abilityInstance"]["id"], base_ability_id);

    let grant = philosopher_grant(&after, "dreamer");
    assert_eq!(grant["sourceEventId"], event["id"]);
    assert_eq!(grant["sourceAbilityInstanceId"], base_ability_id);
    assert_eq!(
        grant["abilityInstanceId"],
        event["payload"]["outcome"]["grantedAbilityInstanceId"]
    );
    assert_eq!(after["value"]["currentStep"]["id"], "firstNight:minionInfo");
    let overview = after["value"]["phaseOverview"].as_array().unwrap();
    let clockmaker_index = overview
        .iter()
        .position(|step| step["character"] == "clockmaker")
        .unwrap();
    let dreamer_index = overview
        .iter()
        .position(|step| step["character"] == "dreamer" && step["playerId"] == "player-1")
        .unwrap();
    let mathematician_index = overview
        .iter()
        .position(|step| step["character"] == "mathematician")
        .unwrap();
    assert!(clockmaker_index < dreamer_index);
    assert!(dreamer_index < mathematician_index);
    assert!(has_reminder(&after, "player-1", "isThePhilosopher"));
    assert!(!has_impairment(
        &after,
        "player-2",
        event["id"].as_str().unwrap()
    ));
}

#[test]
fn in_play_artist_grant_drinks_only_the_original_artist() {
    let mut events = vec![setup_event("vortox")];
    let event = append_acquisition(&mut events, "artist");
    let after = replay(&events);
    assert_eq!(after["ok"], true, "Artist grant replay failed: {after}");
    philosopher_grant(&after, "artist");

    assert_eq!(
        after["value"]["players"][0]["actualCharacter"],
        "philosopher"
    );
    assert!(has_impairment(
        &after,
        "player-2",
        event["id"].as_str().unwrap()
    ));
    assert!(has_reminder(&after, "player-2", "drunk"));
    assert!(!has_reminder(&after, "player-1", "isThePhilosopher"));
    assert!(!has_reminder(&after, "player-1", "drunk"));
}

#[test]
fn every_in_play_good_character_is_drunk_while_the_philosopher_grant_is_active() {
    for character_id in [
        "clockmaker",
        "dreamer",
        "snakeCharmer",
        "mathematician",
        "flowergirl",
        "townCrier",
        "oracle",
        "savant",
        "seamstress",
        "artist",
        "juggler",
        "sage",
        "mutant",
        "sweetheart",
        "barber",
        "klutz",
    ] {
        let mut events = vec![setup_with_in_play_good_character(character_id)];
        let acquisition = append_acquisition(&mut events, character_id);
        let state = replay(&events);
        let source_event_id = acquisition["id"].as_str().expect("acquisition event id");
        assert!(
            has_impairment(&state, "player-2", source_event_id),
            "character={character_id}, state={state}"
        );
        assert!(
            has_reminder(&state, "player-2", "drunk"),
            "character={character_id}, state={state}"
        );
    }
}

#[test]
fn self_selection_is_terminal_self_drunk_without_a_recursive_grant() {
    let mut events = vec![setup_event("vortox")];
    let event = append_acquisition(&mut events, "philosopher");
    assert_eq!(event["payload"]["outcome"]["kind"], "selfDrunk");

    let after = replay(&events);
    assert_eq!(after["ok"], true, "self selection replay failed: {after}");
    assert!(after["value"]["ruleState"]["abilityGrants"]
        .as_array()
        .is_some_and(Vec::is_empty));
    assert!(has_impairment(
        &after,
        "player-1",
        event["id"].as_str().unwrap()
    ));
    assert!(has_reminder(&after, "player-1", "drunk"));
    assert!(!has_reminder(&after, "player-1", "isThePhilosopher"));
    assert_ne!(after["value"]["currentStep"]["character"], "philosopher");
}

#[test]
fn poisoned_selection_consumes_the_use_as_no_effect_without_a_grant() {
    let mut events = vec![setup_event("noDashii")];
    let before = replay(&events);
    assert!(before["value"]["ruleState"]["activeImpairments"]
        .as_array()
        .is_some_and(|impairments| impairments.iter().any(|impairment| {
            impairment["kind"] == "poisoned" && impairment["playerId"] == "player-1"
        })));

    let event = append_acquisition(&mut events, "dreamer");
    assert_eq!(event["payload"]["selectedCharacterId"], "dreamer");
    assert_eq!(event["payload"]["outcome"]["kind"], "noEffect");
    assert!(event["payload"]["outcome"]["impairments"]
        .as_array()
        .is_some_and(|impairments| impairments
            .iter()
            .any(|impairment| impairment["kind"] == "poisoned")));

    let after = replay(&events);
    assert_eq!(after["ok"], true, "no-effect replay failed: {after}");
    assert!(after["value"]["ruleState"]["abilityGrants"]
        .as_array()
        .is_some_and(Vec::is_empty));
    assert!(!has_reminder(&after, "player-1", "isThePhilosopher"));
    assert_ne!(after["value"]["currentStep"]["character"], "dreamer");
}

#[test]
fn in_play_town_crier_grant_returns_on_the_following_night_with_its_grant_identity() {
    let mut events = vec![setup_event("fangGu")];
    events[0]["payload"]["players"][1]["actualCharacter"] = json!("townCrier");
    events[0]["payload"]["players"][1]["shownCharacter"] = json!("townCrier");
    let acquisition = append_acquisition(&mut events, "townCrier");
    let grant_id = acquisition["payload"]["outcome"]["grantedAbilityInstanceId"]
        .as_str()
        .expect("grant id");

    let later_night = advance_to_later_night(&mut events);
    let granted_step = later_night["value"]["phaseOverview"]
        .as_array()
        .expect("Night overview")
        .iter()
        .find(|step| step["character"] == "townCrier" && step["playerId"] == "player-1");

    assert!(granted_step.is_some(), "state={later_night}");
    let granted_step_id = granted_step.unwrap()["id"].as_str().unwrap().to_string();
    for _ in 0..10 {
        let state = replay(&events);
        if state["value"]["currentStep"]["id"] == granted_step_id {
            assert_eq!(
                state["value"]["currentStep"]["abilityUse"]["abilityInstanceId"],
                grant_id
            );
            return;
        }
        append_default_current_step(&mut events);
    }
    panic!(
        "granted Town Crier step was not reached: {}",
        replay(&events)
    );
}

#[test]
fn granted_day_abilities_and_mutant_are_exposed_for_the_philosopher_owner() {
    for character_id in ["artist", "savant", "juggler"] {
        let mut events = vec![setup_event("fangGu")];
        append_acquisition(&mut events, character_id);
        let day = advance_to_day(&mut events);
        assert!(
            day["value"]["availableDayActions"]
                .as_array()
                .is_some_and(|actions| actions.iter().any(|action| {
                    action["actorPlayerId"] == "player-1" && action["characterId"] == character_id
                })),
            "character={character_id}, state={day}"
        );
        let record = match character_id {
            "artist" => json!({
                "kind": "artist",
                "question": "테스트 질문",
                "answer": "yes",
                "truthful": true
            }),
            "savant" => json!({
                "kind": "savant",
                "statements": [
                    { "text": "참", "truthful": true },
                    { "text": "거짓", "truthful": false }
                ]
            }),
            "juggler" => json!({ "kind": "juggler", "correctCount": 1 }),
            _ => unreachable!(),
        };
        let proposal = propose(
            &events,
            json!({ "type": "recordDayAction", "payload": {
                "dayId": "day",
                "expectedEventCount": events.len(),
                "actorPlayerId": "player-1",
                "record": record
            }}),
        );
        assert_eq!(proposal["ok"], true, "character={character_id}, {proposal}");
        events.push(proposal["value"]["event"].clone());
        let replayed = replay(&events);
        assert!(replayed["value"]["dayActionRecords"]
            .as_array()
            .is_some_and(|records| records.iter().any(|record| {
                record["actorPlayerId"] == "player-1" && record["characterId"] == character_id
            })));

        if character_id == "juggler" {
            let night = advance_to_later_night(&mut events);
            assert!(night["value"]["phaseOverview"]
                .as_array()
                .is_some_and(|steps| steps.iter().any(|step| {
                    step["character"] == "juggler" && step["playerId"] == "player-1"
                })));
        }
    }

    let mut mutant_events = vec![setup_event("fangGu")];
    append_acquisition(&mut mutant_events, "mutant");
    let mutant_day = advance_to_day(&mut mutant_events);
    assert!(
        mutant_day["value"]["madnessAssignments"]
            .as_array()
            .is_some_and(|assignments| assignments.iter().any(|assignment| {
                assignment["sourcePlayerId"] == "player-1"
                    && assignment["sourceCharacterId"] == "mutant"
                    && assignment["sourceEffective"] == true
            })),
        "state={mutant_day}"
    );
}

#[test]
fn immediate_and_deferred_once_per_game_grants_keep_their_official_timing() {
    let mut clockmaker_events = vec![setup_event("fangGu")];
    let clockmaker_grant = append_acquisition(&mut clockmaker_events, "clockmaker");
    let clockmaker = replay(&clockmaker_events);
    assert_eq!(
        clockmaker["value"]["currentStep"]["character"],
        "clockmaker"
    );
    assert_eq!(clockmaker["value"]["currentStep"]["playerId"], "player-1");
    assert_eq!(
        clockmaker["value"]["currentStep"]["abilityUse"]["abilityInstanceId"],
        clockmaker_grant["payload"]["outcome"]["grantedAbilityInstanceId"]
    );

    let mut seamstress_events = vec![setup_event("fangGu")];
    append_acquisition(&mut seamstress_events, "seamstress");
    for _ in 0..15 {
        let state = replay(&seamstress_events);
        if state["value"]["phase"] == "day" {
            break;
        }
        let step = &state["value"]["currentStep"];
        if step["character"] == "seamstress" && step["playerId"] == "player-1" {
            let proposal = propose(
                &seamstress_events,
                json!({ "type": "skipStep", "payload": {
                    "stepId": step["id"],
                    "expectedEventCount": seamstress_events.len()
                }}),
            );
            assert_eq!(proposal["ok"], true, "{proposal}");
            seamstress_events.push(proposal["value"]["event"].clone());
        } else {
            append_default_current_step(&mut seamstress_events);
        }
    }
    let seamstress_night = advance_to_later_night(&mut seamstress_events);
    assert!(seamstress_night["value"]["phaseOverview"]
        .as_array()
        .is_some_and(|steps| steps
            .iter()
            .any(|step| { step["character"] == "seamstress" && step["playerId"] == "player-1" })));
}

#[test]
fn every_recurring_night_grant_is_scheduled_again_after_the_acquisition_night() {
    for character_id in [
        "dreamer",
        "snakeCharmer",
        "mathematician",
        "flowergirl",
        "townCrier",
        "oracle",
    ] {
        let mut events = vec![setup_event("fangGu")];
        append_acquisition(&mut events, character_id);
        let later_night = advance_to_later_night(&mut events);
        assert!(
            later_night["value"]["phaseOverview"]
                .as_array()
                .is_some_and(|steps| steps.iter().any(|step| {
                    step["character"] == character_id && step["playerId"] == "player-1"
                })),
            "character={character_id}, state={later_night}"
        );
    }
}

#[test]
fn acquired_day_status_reminders_follow_the_effective_ability_owner() {
    for character_id in ["flowergirl", "townCrier"] {
        let mut out_of_play_events = vec![setup_event("fangGu")];
        append_acquisition(&mut out_of_play_events, character_id);
        let out_of_play_day = advance_to_day(&mut out_of_play_events);
        assert!(
            automatic_reminder(
                &out_of_play_day,
                "player-1",
                character_id,
                if character_id == "flowergirl" {
                    "demonDidNotVote"
                } else {
                    "minionDidNotNominate"
                }
            )
            .is_some(),
            "out-of-play grant did not own {character_id} reminder: {out_of_play_day}"
        );

        let mut in_play_events = vec![setup_with_in_play_good_character(character_id)];
        append_acquisition(&mut in_play_events, character_id);
        let in_play_day = advance_to_day(&mut in_play_events);
        let token_id = if character_id == "flowergirl" {
            "demonDidNotVote"
        } else {
            "minionDidNotNominate"
        };
        assert!(
            automatic_reminder(&in_play_day, "player-1", character_id, token_id).is_some(),
            "Philosopher did not own duplicated {character_id} reminder: {in_play_day}"
        );
        assert!(
            automatic_reminder(&in_play_day, "player-2", character_id, token_id).is_none(),
            "drunk original retained duplicated {character_id} reminder: {in_play_day}"
        );

        let after_philosopher_death = kill_philosopher_on_the_following_night(&mut in_play_events);
        assert!(
            automatic_reminder(&after_philosopher_death, "player-1", character_id, token_id)
                .is_none(),
            "dead Philosopher retained {character_id} reminder: {after_philosopher_death}"
        );
        assert!(
            automatic_reminder(&after_philosopher_death, "player-2", character_id, token_id)
                .is_some(),
            "sobered original did not regain {character_id} reminder: {after_philosopher_death}"
        );
    }
}

#[test]
fn acquired_artist_and_juggler_reminders_use_the_granted_ability_owner_and_lifetime() {
    let mut artist_events = vec![setup_with_in_play_good_character("artist")];
    append_acquisition(&mut artist_events, "artist");
    advance_to_day(&mut artist_events);
    let artist = propose(
        &artist_events,
        json!({ "type": "recordDayAction", "payload": {
            "dayId": "day",
            "expectedEventCount": artist_events.len(),
            "actorPlayerId": "player-1",
            "record": {
                "kind": "artist",
                "question": "악마가 홀수 좌석에 있나요?",
                "answer": "yes",
                "truthful": true
            }
        }}),
    );
    assert_eq!(artist["ok"], true, "{artist}");
    artist_events.push(artist["value"]["event"].clone());
    let artist_used = replay(&artist_events);
    assert!(
        automatic_reminder(&artist_used, "player-1", "artist", "noAbility").is_some(),
        "state={artist_used}"
    );
    let artist_after_death = kill_philosopher_on_the_following_night(&mut artist_events);
    assert!(
        automatic_reminder(&artist_after_death, "player-1", "artist", "noAbility").is_none(),
        "inactive grant retained Artist reminder: {artist_after_death}"
    );

    let mut juggler_events = vec![setup_with_in_play_good_character("juggler")];
    append_acquisition(&mut juggler_events, "juggler");
    advance_to_day(&mut juggler_events);
    let juggler = propose(
        &juggler_events,
        json!({ "type": "recordDayAction", "payload": {
            "dayId": "day",
            "expectedEventCount": juggler_events.len(),
            "actorPlayerId": "player-1",
            "record": { "kind": "juggler", "correctCount": 3 }
        }}),
    );
    assert_eq!(juggler["ok"], true, "{juggler}");
    juggler_events.push(juggler["value"]["event"].clone());
    let juggler_day = replay(&juggler_events);
    let reminder = automatic_reminder(&juggler_day, "player-1", "juggler", "correct")
        .expect("granted Juggler reminder");
    assert_eq!(reminder["count"], 3);
    assert!(automatic_reminder(&juggler_day, "player-2", "juggler", "correct").is_none());

    advance_to_later_night(&mut juggler_events);
    loop {
        let state = replay(&juggler_events);
        let step = &state["value"]["currentStep"];
        if step["character"] == "juggler" && step["playerId"] == "player-1" {
            assert!(automatic_reminder(&state, "player-1", "juggler", "correct").is_some());
            append_default_current_step(&mut juggler_events);
            break;
        }
        append_default_current_step(&mut juggler_events);
    }
    let after_information = replay(&juggler_events);
    assert!(
        automatic_reminder(&after_information, "player-1", "juggler", "correct").is_none(),
        "state={after_information}"
    );
}

#[test]
fn acquired_barber_pending_consequence_owns_a_temporary_reminder() {
    let mut events = vec![setup_event("fangGu")];
    append_acquisition(&mut events, "barber");
    let pending = kill_philosopher_on_the_following_night(&mut events);
    assert!(
        automatic_reminder(&pending, "player-1", "barber", "haircutsTonight").is_some(),
        "state={pending}"
    );
    let consequence = &pending["value"]["pendingDeathConsequences"][0];
    let resolved = propose(
        &events,
        json!({
            "type": "resolveBarberConsequence",
            "payload": {
                "stepId": consequence["stepId"],
                "chooserDemonPlayerId": consequence["eligibleChooserPlayerIds"][0],
                "decision": { "kind": "decline" },
                "expectedEventCount": events.len()
            }
        }),
    );
    assert_eq!(resolved["ok"], true, "{resolved}");
    events.push(resolved["value"]["event"].clone());
    let after = replay(&events);
    assert!(automatic_reminder(&after, "player-1", "barber", "haircutsTonight").is_none());
}

#[test]
fn granted_mathematician_counts_an_abnormal_original_mathematician_instance() {
    let mut events = vec![setup_event("fangGu")];
    append_acquisition(&mut events, "mathematician");

    let original = loop {
        let state = replay(&events);
        let step = &state["value"]["currentStep"];
        if step["character"] == "mathematician" && step["playerId"] == "player-6" {
            break state;
        }
        append_default_current_step(&mut events);
    };
    let original_step = &original["value"]["currentStep"];
    assert_eq!(
        original_step["informationPrompt"]["activeReasons"],
        json!([{ "type": "drunk" }])
    );
    let proposal = propose(
        &events,
        json!({ "type": "confirmStep", "payload": {
            "stepId": original_step["id"],
            "expectedEventCount": events.len(),
            "input": null,
            "deliveredResult": { "kind": "number", "value": 1 }
        }}),
    );
    assert_eq!(
        proposal["ok"], true,
        "false information proposal failed: {proposal}"
    );
    events.push(proposal["value"]["event"].clone());

    let acquired = replay(&events);
    assert_eq!(
        acquired["value"]["currentStep"]["abilityUse"]["abilityInstanceId"],
        "phase-2:player-1"
    );
    assert_eq!(
        acquired["value"]["currentStep"]["informationPrompt"]["computedResult"],
        json!({ "kind": "number", "value": 1 })
    );
    let records = acquired["value"]["currentStep"]["informationPrompt"]["mathematicianAudit"]
        ["records"]
        .as_array()
        .expect("Mathematician audit records");
    assert_eq!(records.len(), 1);
    assert_eq!(records[0]["subjectPlayerId"], "player-6");
    assert_eq!(records[0]["abilityInstanceId"], "setup:player-6");
    assert!(acquired["value"]["ruleState"]["automaticReminders"]
        .as_array()
        .is_some_and(|reminders| reminders.iter().any(|reminder| {
            reminder["playerId"] == "player-6"
                && reminder["characterId"] == "mathematician"
                && reminder["tokenId"] == "abnormal"
        })));
}

#[test]
fn granted_snake_charmer_action_uses_the_canonical_no_swap_and_swap_paths() {
    let mut events = vec![setup_event("fangGu")];
    append_acquisition(&mut events, "snakeCharmer");
    advance_to_later_night(&mut events);
    for _ in 0..10 {
        let state = replay(&events);
        let step = &state["value"]["currentStep"];
        if step["character"] == "snakeCharmer" && step["playerId"] == "player-1" {
            let no_swap = propose(
                &events,
                json!({ "type": "confirmStep", "payload": {
                    "stepId": step["id"],
                    "expectedEventCount": events.len(),
                    "input": { "playerIds": ["player-2"] }
                }}),
            );
            assert_eq!(no_swap["ok"], true, "{no_swap}");
            assert_eq!(
                no_swap["value"]["event"]["payload"]["outcome"],
                json!({ "kind": "noSwap", "reason": "targetNotDemon" })
            );
            let mut no_swap_events = events.clone();
            no_swap_events.push(no_swap["value"]["event"].clone());
            assert_eq!(replay(&no_swap_events)["ok"], true);

            let swap = propose(
                &events,
                json!({ "type": "confirmStep", "payload": {
                    "stepId": step["id"],
                    "expectedEventCount": events.len(),
                    "input": { "playerIds": ["player-8"] }
                }}),
            );
            assert_eq!(swap["ok"], true, "{swap}");
            assert_eq!(swap["value"]["event"]["type"], "snakeCharmerActionResolved");
            let mut swapped_events = events.clone();
            swapped_events.push(swap["value"]["event"].clone());
            let swapped = replay(&swapped_events);
            assert_eq!(swapped["ok"], true, "{swapped}");
            assert_eq!(swapped["value"]["players"][0]["actualCharacter"], "fangGu");
            assert_eq!(swapped["value"]["players"][0]["alignment"], "evil");
            assert_eq!(
                swapped["value"]["players"][7]["actualCharacter"],
                "philosopher"
            );
            assert_eq!(swapped["value"]["players"][7]["alignment"], "good");
            return;
        }
        append_default_current_step(&mut events);
    }
    panic!(
        "granted Snake Charmer step was not reached: {}",
        replay(&events)
    );
}

fn kill_philosopher_on_the_following_night(events: &mut Vec<Value>) -> Value {
    advance_to_later_night(events);
    for _ in 0..10 {
        let state = replay(events);
        let step = &state["value"]["currentStep"];
        if matches!(
            step["character"].as_str(),
            Some("fangGu" | "vigormortis" | "noDashii" | "vortox")
        ) {
            let proposal = propose(
                events,
                json!({ "type": "confirmStep", "payload": {
                    "stepId": step["id"],
                    "expectedEventCount": events.len(),
                    "input": { "playerIds": ["player-1"] }
                }}),
            );
            assert_eq!(proposal["ok"], true, "Demon proposal failed: {proposal}");
            events.push(proposal["value"]["event"].clone());
            return replay(events);
        }
        append_default_current_step(events);
    }
    panic!("Demon step was not reached: {}", replay(events));
}

#[test]
fn every_granted_death_ability_uses_the_existing_trigger_path() {
    for (character_id, consequence_kind) in [
        ("sweetheart", Some("sweetheart")),
        ("barber", Some("barber")),
        ("sage", None),
    ] {
        let mut events = vec![setup_event("fangGu")];
        append_acquisition(&mut events, character_id);
        let after_death = kill_philosopher_on_the_following_night(&mut events);
        if let Some(kind) = consequence_kind {
            assert!(
                after_death["value"]["pendingDeathConsequences"]
                    .as_array()
                    .is_some_and(|pending| pending.iter().any(|trigger| {
                        trigger["kind"] == kind && trigger["actorPlayerId"] == "player-1"
                    })),
                "character={character_id}, state={after_death}"
            );
        } else {
            assert!(
                after_death["value"]["phaseOverview"]
                    .as_array()
                    .is_some_and(|steps| steps.iter().any(|step| {
                        step["character"] == "sage" && step["playerId"] == "player-1"
                    })),
                "state={after_death}"
            );
        }
    }

    let mut klutz_events = vec![setup_event("fangGu")];
    append_acquisition(&mut klutz_events, "klutz");
    kill_philosopher_on_the_following_night(&mut klutz_events);
    for _ in 0..12 {
        let state = replay(&klutz_events);
        if state["value"]["currentStep"]["id"] == "day2:announceDeaths" {
            append_default_current_step(&mut klutz_events);
            break;
        }
        append_default_current_step(&mut klutz_events);
    }
    let after_announcement = replay(&klutz_events);
    assert!(
        after_announcement["value"]["pendingDeathConsequences"]
            .as_array()
            .is_some_and(|pending| pending.iter().any(|trigger| {
                trigger["kind"] == "klutz" && trigger["actorPlayerId"] == "player-1"
            })),
        "state={after_announcement}"
    );
}

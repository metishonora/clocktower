//! Reachable Production JSON relationships; every step is explicitly confirmed.
use super::issue207_acquisition::{confirm, propose, replay};
use serde_json::{json, Value};
pub(super) fn game(minion: &str) -> Value {
    let pool = vec![
        "snakeCharmer",
        "artist",
        "savant",
        "juggler",
        "sage",
        minion,
        "imp",
        "soldier",
        "mayor",
        "virgin",
    ];
    let (action_id, before_snake) = match minion {
        "evilTwin" => ("learnTwin", true),
        "witch" => ("chooseCursedPlayer", true),
        "cerenovus" => ("assignMadness", true),
        _ => panic!("explicit minion required"),
    };
    assert!(before_snake);
    let order = json!([{"kind":"system","actionId":"dusk"},{"kind":"system","actionId":"minionInfo"},{"kind":"system","actionId":"demonInfo"},{"kind":"character","characterId":minion,"actionId":action_id},{"kind":"character","characterId":"snakeCharmer","actionId":"choosePlayer"},{"kind":"system","actionId":"dawn"}]);
    let mut game = json!({"schemaVersion":4,"game":{"id":"relationships","name":"relationships","script":{"type":"custom","definition":{"id":"relationships","name":"relationships","characterIds":pool,"firstNightOrder":order}},"createdAt":"2026-09-08T00:00:00Z","updatedAt":"2026-09-08T00:00:00Z","events":[]}});
    let roster = [
        "snakeCharmer",
        "artist",
        "savant",
        "juggler",
        "sage",
        minion,
        "imp",
    ];
    let players=roster.iter().enumerate().map(|(i,c)|json!({"id":format!("p{}",i+1),"seat":i+1,"name":format!("P{}",i+1),"actualCharacter":c})).collect::<Vec<_>>();
    let command = json!({"type":"createGame","payload":{"players":players}});
    let result: Value = serde_json::from_str(&crate::propose_json(
        &game.to_string(),
        &command.to_string(),
    ))
    .unwrap();
    assert_eq!(result["ok"], true, "{result}");
    game["game"]["events"]
        .as_array_mut()
        .unwrap()
        .push(result["value"]["event"].clone());
    assert_eq!(
        replay(&game)["currentStep"]["id"],
        "firstNight:system:minionInfo"
    );
    confirm(&mut game, Value::Null);
    assert_eq!(
        replay(&game)["currentStep"]["id"],
        "firstNight:system:demonInfo"
    );
    confirm(
        &mut game,
        json!({"characterIds":["soldier","mayor","virgin"]}),
    );
    game
}
#[test]
fn twin_swap_creates_separate_assignment_and_delivery_with_causal_undo() {
    let mut game = game("evilTwin");
    assert_eq!(
        replay(&game)["currentStep"]["actionRef"]["actionId"],
        "assignTwin"
    );
    assert_eq!(propose(&game, json!({"playerIds":["p7"]}))["ok"], false);
    let assignment = confirm(&mut game, json!({"playerIds":["p1"]}));
    assert_eq!(
        replay(&game)["currentStep"]["actionRef"]["actionId"],
        "learnTwin"
    );
    let proposal = propose(&game, Value::Null);
    assert_eq!(
        proposal["value"]["revealPayload"],
        json!({"kind":"evilTwinPair","players":[{"playerId":"p6","seat":6,"name":"P6","alignment":"evil","characterId":"evilTwin"},{"playerId":"p1","seat":1,"name":"P1","alignment":"good","characterId":"snakeCharmer"}]})
    );
    let first = confirm(&mut game, Value::Null);
    assert_eq!(
        first["payload"]["result"]["relationshipEventId"],
        assignment["id"]
    );
    let before_swap = game.clone();
    let swap = confirm(&mut game, json!({"playerIds":["p7"]}));
    assert_eq!(
        replay(&game)["currentStep"]["actionCause"],
        json!({"kind":"requiredPreparation","triggerEventId":swap["id"],"previousPreparationEventId":assignment["id"]})
    );
    let pending = game.clone();
    let repair = propose(&game, json!({"playerIds":["p2"]}));
    let reassignment = confirm(&mut game, json!({"playerIds":["p2"]}));
    let before_delivery = game.clone();
    assert_eq!(
        replay(&game)["currentStep"]["actionCause"],
        json!({"kind":"delivery","preparationEventId":reassignment["id"]})
    );
    confirm(&mut game, Value::Null);
    assert_eq!(replay(&game)["currentStep"]["id"], "firstNight:system:dawn");
    assert_eq!(
        replay(&game)["ruleState"]["twinRelationships"][1]["targetPlayerId"],
        "p2"
    );
    for expected in [&before_delivery, &pending, &before_swap] {
        game["game"]["events"].as_array_mut().unwrap().pop();
        assert_eq!(replay(&game), replay(expected));
    }
    let mut forged = pending;
    let mut bad = repair["value"]["event"].clone();
    bad["payload"]["actionCause"]["triggerEventId"] = assignment["id"].clone();
    forged["game"]["events"].as_array_mut().unwrap().push(bad);
    let result: Value = serde_json::from_str(&crate::replay_json(&forged.to_string())).unwrap();
    assert_eq!(result["ok"], false);
}
#[test]
fn bounded_twin_assignment_ignores_name_and_death_but_repairs_same_alignment() {
    use super::issue207_impairments::{facts, source};
    use crate::{
        contracts::TwinRelationship, first_night::ActionContext, model::Alignment,
        rules::CustomRuleService, state::FirstNightProgress,
    };
    let (definition, mut state) = facts(&["evilTwin", "snakeCharmer", "artist", "imp"]);
    state.prefix_event_id = "trigger".into();
    state.twin_relationships.push(TwinRelationship {
        source_event_id: "pair".into(),
        ability_use: source(&state, 0),
        target_player_id: "p2".into(),
        effective: true,
    });
    let registrations = crate::characters::sects_and_violets::registrations();
    let entry=registrations.iter().find(|r|matches!(&r.spec.action_ref,crate::contracts::FirstNightActionRef::Character{action_id,..}if action_id=="assignTwin")).unwrap();
    let candidates = |facts: &crate::state::CustomGameFacts| {
        let rules = CustomRuleService::new(&definition, facts);
        entry
            .handler
            .required_occurrences(
                &ActionContext {
                    event_id: "",
                    rule_service: &rules,
                },
                &FirstNightProgress::default(),
            )
            .unwrap()
    };
    assert!(candidates(&state).is_empty());
    state.players[1].name = "renamed".into();
    state.players[1].alive = false;
    assert!(candidates(&state).is_empty());
    state.players[1].alignment = Alignment::Evil;
    assert_eq!(candidates(&state).len(), 1);
    state.players[1].alignment = Alignment::Good;
    assert!(candidates(&state).is_empty());
}

// Bounded registry/reducer evidence, not a claim that multiple alignment changes are
// reachable in one Production first night. Assignments themselves use real handlers.
#[test]
fn repair_rejects_an_older_real_assignment_as_previous_preparation() {
    use super::issue207_impairments::facts;
    use crate::{
        contracts::{ActionCause, GameEvent, GameEventKind},
        first_night::{
            action_registry, ActionContext, ActionEventDraft, ActionInput, ValidatedActionEvent,
        },
        model::{Alignment, Phase, StepInputFields},
        reducer::reduce_custom_facts,
        rules::CustomRuleService,
        state::FirstNightProgress,
    };
    let (definition, mut state) = facts(&["evilTwin", "snakeCharmer", "artist", "monk", "imp"]);
    let registry = action_registry().unwrap();
    let mut assignment_ids: Vec<String> = Vec::new();
    for (index, target) in ["p2", "p3", "p4"].into_iter().enumerate() {
        let rules = CustomRuleService::new(&definition, &state);
        let event_id = format!("assignment-{index}");
        let context = ActionContext {
            event_id: &event_id,
            rule_service: &rules,
        };
        let entry = crate::characters::sects_and_violets::registrations().into_iter()
            .find(|entry| matches!(&entry.spec.action_ref, crate::contracts::FirstNightActionRef::Character { action_id, .. } if action_id == "assignTwin"))
            .unwrap();
        let occurrences = entry
            .handler
            .required_occurrences(&context, &FirstNightProgress::default())
            .unwrap();
        assert_eq!(occurrences.len(), 1);
        let occurrence = &occurrences[0];
        let input = ActionInput {
            input: Some(StepInputFields {
                player_ids: Some(vec![target.into()]),
                ..Default::default()
            }),
            delivered_result: None,
            registration_judgments: vec![],
        };
        let draft = registry
            .propose_input(&occurrence.action_ref, &context, occurrence, &input)
            .unwrap();
        let ActionEventDraft::Custom(draft) = draft else {
            panic!("custom assignment");
        };
        let event = GameEvent {
            id: event_id.clone(),
            kind: GameEventKind::CustomActionConfirmed {
                payload: draft.into_payload(),
            },
            phase: Phase::FirstNight,
            summary: "twin assignment".into(),
            created_at: "2026-09-09T00:00:00Z".into(),
        };
        if index == 2 {
            assert_eq!(state.twin_relationships.len(), 2);
            assert_eq!(
                occurrence.action_cause,
                Some(ActionCause::RequiredPreparation {
                    trigger_event_id: state.prefix_event_id.clone(),
                    previous_preparation_event_id: Some(assignment_ids[1].clone()),
                })
            );
            let before = serde_json::to_value(&state.twin_relationships).unwrap();
            let mut forged = event.clone();
            let GameEventKind::CustomActionConfirmed { payload } = &mut forged.kind else {
                unreachable!()
            };
            let Some(ActionCause::RequiredPreparation {
                previous_preparation_event_id,
                ..
            }) = &mut payload.action_cause
            else {
                panic!("repair cause");
            };
            *previous_preparation_event_id = Some(assignment_ids[0].clone());
            assert_eq!(
                registry
                    .validate_event(occurrence, &context, &forged)
                    .unwrap_err()
                    .code,
                "INVALID_FIRST_NIGHT_ACTION_PROVENANCE"
            );
            assert_eq!(
                serde_json::to_value(&state.twin_relationships).unwrap(),
                before
            );
        }
        // The unmodified candidate remains valid after the rejected stale reference.
        let ValidatedActionEvent::Custom(validated) = registry
            .validate_event(occurrence, &context, &event)
            .unwrap()
        else {
            panic!("custom event");
        };
        state = reduce_custom_facts(&definition, &state, &validated).unwrap();
        assignment_ids.push(event_id);
        if index < 2 {
            // Only this alignment transition is injected; no fabricated preparation record.
            state.players[index + 1].alignment = Alignment::Evil;
            state.prefix_event_id = format!("alignment-change-{index}");
        }
    }
    assert_eq!(
        state.twin_relationships.last().unwrap().target_player_id,
        "p4"
    );
}

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
fn twin_swap_creates_one_causal_repair_and_undo_restores_both_prefixes() {
    let mut game = game("evilTwin");
    assert_eq!(replay(&game)["currentStep"]["character"], "evilTwin");
    assert_eq!(propose(&game, json!({"playerIds":["p7"]}))["ok"], false);
    let proposal = propose(&game, json!({"playerIds":["p1"]}));
    assert_eq!(
        proposal["value"]["revealPayload"],
        json!({"kind":"evilTwinPair","players":[{"playerId":"p6","seat":6,"name":"P6","alignment":"evil","characterId":"evilTwin"},{"playerId":"p1","seat":1,"name":"P1","alignment":"good","characterId":"snakeCharmer"}]})
    );
    let first = confirm(&mut game, json!({"playerIds":["p1"]}));
    let before_swap = game.clone();
    let swap = confirm(&mut game, json!({"playerIds":["p7"]}));
    let state = replay(&game);
    assert_eq!(state["currentStep"]["character"], "evilTwin");
    assert_eq!(
        state["currentStep"]["followUpCause"],
        json!({"triggerEventId":swap["id"],"relationshipEventId":first["id"]})
    );
    let pending = game.clone();
    let repair = propose(&game, json!({"playerIds":["p2"]}));
    assert_eq!(repair, propose(&game, json!({"playerIds":["p2"]})));
    confirm(&mut game, json!({"playerIds":["p2"]}));
    let state = replay(&game);
    assert_eq!(state["currentStep"]["id"], "firstNight:system:dawn");
    assert_eq!(
        state["ruleState"]["twinRelationships"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
    assert_eq!(
        state["ruleState"]["twinRelationships"][0]["effective"],
        false
    );
    assert_eq!(
        state["ruleState"]["twinRelationships"][1]["targetPlayerId"],
        "p2"
    );
    game["game"]["events"].as_array_mut().unwrap().pop();
    assert_eq!(replay(&game), replay(&pending));
    game["game"]["events"].as_array_mut().unwrap().pop();
    assert_eq!(replay(&game), replay(&before_swap));
    let mut forged = pending.clone();
    let mut bad = repair["value"]["event"].clone();
    bad["payload"]["followUpCause"]["triggerEventId"] = json!(first["id"]);
    forged["game"]["events"].as_array_mut().unwrap().push(bad);
    let result: Value = serde_json::from_str(&crate::replay_json(&forged.to_string())).unwrap();
    assert_eq!(result["ok"], false);
}

#[test]
fn bounded_twin_followup_ignores_name_and_death_and_disappears_when_no_longer_needed() {
    use super::issue207_impairments::{facts, source};
    use crate::{
        contracts::{
            CustomActionConfirmedPayload, CustomActionResult, FirstNightActionRef, GameEvent,
            GameEventKind, TwinRelationship,
        },
        event::CustomFactChanges,
        first_night::{ActionContext, FollowUpContext, ValidatedActionEvent, ValidatedCustomEvent},
        model::{Alignment, Phase},
        rules::CustomRuleService,
        state::{ActionOccurrence, ConfirmedActionFact},
    };
    let (definition, mut before) = facts(&["evilTwin", "snakeCharmer", "artist", "imp"]);
    let twin_source = source(&before, 0);
    before.twin_relationships.push(TwinRelationship {
        source_event_id: "pair".into(),
        ability_use: twin_source,
        effective: true,
        target_player_id: "p2".into(),
    });
    let action_ref = FirstNightActionRef::Character {
        character_id: "snakeCharmer".into(),
        action_id: "choosePlayer".into(),
    };
    let occurrence = ActionOccurrence::character(action_ref.clone(), source(&before, 1)).unwrap();
    let payload = CustomActionConfirmedPayload {
        step_id: occurrence.step_id().unwrap(),
        action_ref,
        ability_use: occurrence.ability_use.clone(),
        simulation_source: None,
        follow_up_cause: None,
        input: None,
        result: CustomActionResult::NoEffect,
        delivered_result: None,
        registration_judgments: vec![],
    };
    let event = ValidatedActionEvent::Custom(ValidatedCustomEvent::for_tests(
        GameEvent {
            id: "trigger".into(),
            phase: Phase::FirstNight,
            summary: "bounded transition".into(),
            created_at: "t".into(),
            kind: GameEventKind::CustomActionConfirmed {
                payload: payload.clone(),
            },
        },
        payload,
        CustomFactChanges::default(),
    ));
    let entry=crate::characters::sects_and_violets::registrations().into_iter().find(|r|matches!(&r.spec.action_ref,FirstNightActionRef::Character{character_id,..}if character_id=="evilTwin")).unwrap();
    let followup = entry.handler.follow_up_rule().unwrap();
    let mut changed = before.clone();
    changed.players[1].name = "renamed".into();
    changed.players[1].alive = false;
    assert!(followup
        .candidates(&FollowUpContext {
            previous_facts: &before,
            next_facts: &changed,
            event: &event,
            event_stream_index: 1
        })
        .unwrap()
        .is_empty());
    let mut changed = before.clone();
    changed.players[1].alignment = Alignment::Evil;
    changed.confirmed_actions.push(ConfirmedActionFact {
        event_id: "trigger".into(),
        occurrence,
        result: CustomActionResult::NoEffect,
    });
    let candidates = followup
        .candidates(&FollowUpContext {
            previous_facts: &before,
            next_facts: &changed,
            event: &event,
            event_stream_index: 1,
        })
        .unwrap();
    assert_eq!(candidates.len(), 1);
    assert!(followup
        .candidates(&FollowUpContext {
            previous_facts: &changed,
            next_facts: &changed,
            event: &event,
            event_stream_index: 2
        })
        .unwrap()
        .is_empty());
    let rules = CustomRuleService::new(&definition, &changed);
    let context = ActionContext {
        rule_service: &rules,
        event_id: "",
    };
    let first = entry
        .handler
        .project_occurrence(&entry.spec, &context, &candidates[0])
        .unwrap()
        .unwrap();
    assert_eq!(first.id, candidates[0].step_id().unwrap());
    changed.players[1].alignment = Alignment::Good;
    let rules = CustomRuleService::new(&definition, &changed);
    let context = ActionContext {
        rule_service: &rules,
        event_id: "",
    };
    assert!(entry
        .handler
        .project_occurrence(&entry.spec, &context, &candidates[0])
        .unwrap()
        .is_none());
    changed.players[1].alignment = Alignment::Evil;
    changed.players[0].alive = false;
    let rules = CustomRuleService::new(&definition, &changed);
    let context = ActionContext {
        rule_service: &rules,
        event_id: "",
    };
    assert!(entry
        .handler
        .project_occurrence(&entry.spec, &context, &candidates[0])
        .unwrap()
        .is_none());
}

//! Restricted real-handler preparation contracts. Full WASM/play sequences are separate.
#![cfg(not(feature = "custom-runtime-fixtures"))]
use super::issue207_impairments::facts;
use crate::{contracts::*, first_night::*, rules::CustomRuleService, state::FirstNightProgress};
use serde_json::json;
#[test]
fn red_herring_preparation_uses_its_own_action_and_does_not_complete_check_demon() {
    let (definition, facts) = facts(&["fortuneTeller", "artist", "imp"]);
    let rules = CustomRuleService::new(&definition, &facts);
    let context = ActionContext {
        event_id: "prepare",
        rule_service: &rules,
    };
    let registry = action_registry().unwrap();
    let action = FirstNightActionRef::Character {
        character_id: "fortuneTeller".into(),
        action_id: "assignRedHerring".into(),
    };
    let entry = registry.lookup(&action).unwrap();
    let occurrence = entry
        .handler
        .required_occurrences(&context, &FirstNightProgress::default())
        .unwrap()
        .remove(0);
    let input = |id: &str| ActionInput {
        input: serde_json::from_value(json!({"playerIds":[id]})).unwrap(),
        delivered_result: None,
        registration_judgments: vec![],
    };
    assert!(registry
        .propose_input(&action, &context, &occurrence, &input("p3"))
        .is_err());
    let draft = registry
        .propose_input(&action, &context, &occurrence, &input("p2"))
        .unwrap();
    let event = GameEvent {
        id: "prepare".into(),
        phase: crate::model::Phase::FirstNight,
        summary: "prepare".into(),
        created_at: "t".into(),
        kind: draft.into_event_kind(),
    };
    let ValidatedActionEvent::Custom(validated) = registry
        .validate_event(&occurrence, &context, &event)
        .unwrap()
    else {
        panic!()
    };
    let next = crate::reducer::reduce_custom_facts(&definition, &facts, &validated).unwrap();
    let mut changed = next.clone();
    changed.players[1].alignment = crate::model::Alignment::Evil;
    let changed_rules = CustomRuleService::new(&definition, &changed);
    let changed_context = ActionContext {
        event_id: "reassign",
        rule_service: &changed_rules,
    };
    assert_eq!(
        entry
            .handler
            .required_occurrences(&changed_context, &FirstNightProgress::default())
            .unwrap()
            .len(),
        1
    );
    changed.players[1].alignment = crate::model::Alignment::Good;
    changed.active_impairments.push(ActiveImpairment {
        kind: ImpairmentKind::Poisoned,
        player_id: "p1".into(),
        source_event_id: "poison".into(),
        source_character_id: "poisoner".into(),
        expires: ImpairmentExpiry::Never,
    });
    let changed_rules = CustomRuleService::new(&definition, &changed);
    let changed_context = ActionContext {
        event_id: "poison",
        rule_service: &changed_rules,
    };
    assert!(entry
        .handler
        .required_occurrences(&changed_context, &FirstNightProgress::default())
        .unwrap()
        .is_empty());
    assert_eq!(next.preparations.len(), 1);
    assert_eq!(next.confirmed_actions[0].occurrence.action_ref, action);
    assert!(!next.confirmed_actions.iter().any(|f|matches!(&f.occurrence.action_ref,FirstNightActionRef::Character{action_id,..}if action_id=="checkDemon")));
}

#[test]
fn prepared_false_information_reaches_mathematician_without_an_invented_answer() {
    use crate::{model::*, state::*};
    for false_information in [false, true] {
        let (definition, mut state) =
            facts(&["washerwoman", "artist", "savant", "mathematician", "imp"]);
        let demon = super::issue207_impairments::source(&state, 4);
        state.durable_impairments.push(DurableImpairment {
            source_ability_use: demon,
            impairment: ActiveImpairment {
                kind: ImpairmentKind::Poisoned,
                player_id: "p1".into(),
                source_event_id: "poison".into(),
                source_character_id: "imp".into(),
                expires: ImpairmentExpiry::Never,
            },
        });
        crate::effects::resolve_effects(&definition, &mut state).unwrap();
        let registry = action_registry().unwrap();
        let action = FirstNightActionRef::Character {
            character_id: "washerwoman".into(),
            action_id: "prepareInformation".into(),
        };
        let rules = CustomRuleService::new(&definition, &state);
        let context = ActionContext {
            event_id: "prepare",
            rule_service: &rules,
        };
        let occurrence = registry
            .lookup(&action)
            .unwrap()
            .handler
            .required_occurrences(&context, &FirstNightProgress::default())
            .unwrap()
            .remove(0);
        let input = ActionInput { input: serde_json::from_value(json!({"playerIds":["p1","p2"],"characterId":if false_information {"savant"} else {"artist"},"correctPlayerId":"p2"})).unwrap(), delivered_result: None, registration_judgments: vec![] };
        let draft = registry
            .propose_input(&action, &context, &occurrence, &input)
            .unwrap();
        let event = GameEvent {
            id: "prepare".into(),
            phase: Phase::FirstNight,
            summary: "prepare".into(),
            created_at: "t".into(),
            kind: draft.into_event_kind(),
        };
        let ValidatedActionEvent::Custom(validated) = registry
            .validate_event(&occurrence, &context, &event)
            .unwrap()
        else {
            panic!()
        };
        state = crate::reducer::reduce_custom_facts(&definition, &state, &validated).unwrap();
        assert!(
            state.malfunction_audit.is_empty(),
            "preparation is not delivery"
        );
        let action = FirstNightActionRef::Character {
            character_id: "washerwoman".into(),
            action_id: "learnTownsfolk".into(),
        };
        let occurrence = ActionOccurrence::character(
            action.clone(),
            super::issue207_impairments::source(&state, 0),
        )
        .unwrap();
        let rules = CustomRuleService::new(&definition, &state);
        let context = ActionContext {
            event_id: "deliver",
            rule_service: &rules,
        };
        let draft = registry
            .propose_input(
                &action,
                &context,
                &occurrence,
                &ActionInput {
                    input: None,
                    delivered_result: None,
                    registration_judgments: vec![],
                },
            )
            .unwrap();
        let event = GameEvent {
            id: "deliver".into(),
            phase: Phase::FirstNight,
            summary: "deliver".into(),
            created_at: "t".into(),
            kind: draft.into_event_kind(),
        };
        let ValidatedActionEvent::Custom(validated) = registry
            .validate_event(&occurrence, &context, &event)
            .unwrap()
        else {
            panic!()
        };
        state = crate::reducer::reduce_custom_facts(&definition, &state, &validated).unwrap();
        let rules = CustomRuleService::new(&definition, &state);
        let context = ActionContext {
            event_id: "math",
            rule_service: &rules,
        };
        let action = FirstNightActionRef::Character {
            character_id: "mathematician".into(),
            action_id: "learnCount".into(),
        };
        let entry = registry.lookup(&action).unwrap();
        let step = entry
            .handler
            .project(&entry.spec, &context)
            .unwrap()
            .remove(0);
        let value = serde_json::to_value(step).unwrap();
        assert_eq!(
            value["informationPrompt"]["computedResult"]["value"],
            if false_information { 1 } else { 0 }
        );
        if false_information {
            let audit = value["informationPrompt"]["mathematicianAudit"].to_string();
            assert!(!audit.contains("computedResult"), "{audit}");
            assert!(
                audit.contains("deliveredResult") && audit.contains("poison"),
                "{audit}"
            );
        }
    }
}
#[test]
fn healthy_fortune_teller_can_check_self_and_dead_poisoned_actual_demon() {
    use crate::{model::*, state::*};
    let (definition, mut state) = facts(&["fortuneTeller", "artist", "imp"]);
    let source = super::issue207_impairments::source(&state, 0);
    state.preparations.push(ConfirmedActionFact {
        event_id: "red".into(),
        occurrence: ActionOccurrence::character(
            FirstNightActionRef::Character {
                character_id: "fortuneTeller".into(),
                action_id: "assignRedHerring".into(),
            },
            source.clone(),
        )
        .unwrap(),
        result: CustomActionResult::RedHerringAssigned {
            target_player_id: "p2".into(),
        },
        registration_judgments: vec![],
    });
    state.players[2].alive = false;
    state.active_impairments.push(ActiveImpairment {
        kind: ImpairmentKind::Poisoned,
        player_id: "p3".into(),
        source_event_id: "poison".into(),
        source_character_id: "poisoner".into(),
        expires: ImpairmentExpiry::Never,
    });
    let rules = CustomRuleService::new(&definition, &state);
    let context = ActionContext {
        event_id: "check",
        rule_service: &rules,
    };
    let action = FirstNightActionRef::Character {
        character_id: "fortuneTeller".into(),
        action_id: "checkDemon".into(),
    };
    let o = ActionOccurrence::character(action.clone(), source).unwrap();
    let draft = action_registry()
        .unwrap()
        .propose_input(
            &action,
            &context,
            &o,
            &ActionInput {
                input: serde_json::from_value(json!({"playerIds":["p1","p3"]})).unwrap(),
                delivered_result: None,
                registration_judgments: vec![],
            },
        )
        .unwrap();
    let ActionEventDraft::Custom(draft) = draft else {
        panic!()
    };
    let CustomActionResult::InformationDelivered { information, .. } = draft.result else {
        panic!()
    };
    assert_eq!(
        information.delivered_result,
        InformationResult::Boolean { value: true }
    );
    assert!(!state.players[2].alive);
    assert_eq!(state.players[2].actual_character, "imp");
    assert_eq!(state.players[2].alignment, Alignment::Evil);
}

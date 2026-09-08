//! Contract-only tests: no stub Production handler substitutes for implementation.
use crate::{
    contracts::*,
    first_night::{catalog, plan_for_definition, plan_for_draft},
    model::{AbilityInstanceId, AbilityUseRef},
    state::ActionOccurrence,
};
use serde_json::json;
#[test]
fn additional_actions_never_become_required_definition_order_entries() {
    let pool = catalog::ORDERED_ACTIONS
        .iter()
        .map(|(c, _)| c.to_string())
        .chain(["drunk".into(), "mutant".into()])
        .collect();
    let draft = CustomScriptDefinitionDraft {
        id: "208".into(),
        name: "208".into(),
        character_ids: pool,
        first_night_order: None,
    };
    let order = plan_for_draft(&draft).unwrap().plan;
    assert_eq!(order.0.len(), 22);
    let definition = CustomScriptDefinition {
        id: draft.id,
        name: draft.name,
        character_ids: draft.character_ids,
        first_night_order: order,
    };
    assert!(plan_for_definition(&definition).is_ok());
    let all = catalog::ORDERED_ACTIONS
        .iter()
        .copied()
        .chain(catalog::ADDITIONAL_ACTIONS.iter().map(|(c, a, _)| (*c, *a)))
        .collect::<std::collections::HashSet<_>>();
    assert_eq!(all.len(), 25);
    for (c, a, _) in catalog::ADDITIONAL_ACTIONS {
        let mut altered = definition.clone();
        altered.first_night_order.0.insert(
            1,
            FirstNightActionRef::Character {
                character_id: c.into(),
                action_id: a.into(),
            },
        );
        assert!(plan_for_definition(&altered).is_err(), "{c}:{a}");
    }
}
fn source(c: &str) -> AbilityUseRef {
    AbilityUseRef {
        owner_player_id: "p1".into(),
        character_id: c.into(),
        ability_instance_id: AbilityInstanceId::new("setup", "p1"),
    }
}
#[test]
fn new_guidance_cannot_claim_both_real_and_simulated_ownership() {
    let action = FirstNightActionRef::Character {
        character_id: "empath".into(),
        action_id: "learnEvilNeighbors".into(),
    };
    let sim = PhilosopherSimulationSource {
        selection_event_id: "setup".into(),
        source_ability_use: source("drunk"),
        guidance: Some(GuidanceCause::InitialDrunk),
    };
    let occurrence =
        ActionOccurrence::from_parts(action.clone(), None, Some(sim.clone()), None).unwrap();
    assert_eq!(occurrence.actor_player_id(), Some("p1"));
    assert!(ActionOccurrence::from_parts(
        action.clone(),
        Some(source("empath")),
        Some(sim.clone()),
        None
    )
    .is_err());
    let mut forged = sim;
    forged.source_ability_use = source("philosopher");
    assert!(ActionOccurrence::from_parts(action, None, Some(forged), None).is_err());
}
#[test]
fn optional_prefix_and_preparation_delivery_have_distinct_identities() {
    let action = FirstNightActionRef::Character {
        character_id: "mutant".into(),
        action_id: "resolveMadnessExecution".into(),
    };
    let make = |id: &str| {
        ActionOccurrence::from_all_parts(
            action.clone(),
            Some(source("mutant")),
            None,
            None,
            Some(ActionCause::Optional {
                prefix_event_id: id.into(),
            }),
        )
    };
    assert_ne!(
        make("e1").unwrap().step_id().unwrap(),
        make("e2").unwrap().step_id().unwrap()
    );
    assert!(make(" ").is_err());
}
#[test]
fn new_result_and_cause_types_reject_unknown_fields_and_kinds() {
    for value in [
        json!({"kind":"mutantExecution","execute":true,"executed":true,"died":true,"winner":"evil"}),
        json!({"kind":"untypedPreparation","value":0}),
    ] {
        assert!(serde_json::from_value::<CustomActionResult>(value).is_err());
    }
    assert!(serde_json::from_value::<ActionCause>(
        json!({"kind":"optional","prefixEventId":"e1","cursor":7})
    )
    .is_err());
    assert!(serde_json::from_value::<CustomGameEnd>(
        json!({"winningAlignment":"evil","reason":"unknown","sourceEventId":"e1"})
    )
    .is_err());
}

#[cfg(not(feature = "custom-runtime-fixtures"))]
#[test]
fn production_registers_exactly_the_twenty_five_declared_character_actions() {
    let actual = crate::characters::trouble_brewing::registrations()
        .into_iter()
        .chain(crate::characters::sects_and_violets::registrations())
        .map(|r| r.spec.action_ref)
        .collect::<Vec<_>>();
    assert_eq!(actual.len(), 25);
    for (c, a) in catalog::ORDERED_ACTIONS
        .iter()
        .copied()
        .chain(catalog::ADDITIONAL_ACTIONS.iter().map(|(c, a, _)| (*c, *a)))
    {
        assert_eq!(
            actual
                .iter()
                .filter(|r| **r
                    == FirstNightActionRef::Character {
                        character_id: c.into(),
                        action_id: a.into()
                    })
                .count(),
            1
        );
    }
}

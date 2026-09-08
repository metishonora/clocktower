use crate::{
    boundary::parse_event,
    contracts::{FirstNightActionRef, FollowUpCause, PhilosopherSimulationSource},
    model::{AbilityInstanceId, AbilityUseRef},
    state::{ActionOccurrence, FirstNightProgress},
};
use serde_json::json;
fn action(id: &str) -> FirstNightActionRef {
    FirstNightActionRef::Character {
        character_id: id.into(),
        action_id: "test".into(),
    }
}
fn source(id: &str) -> AbilityUseRef {
    AbilityUseRef {
        owner_player_id: "p1".into(),
        character_id: id.into(),
        ability_instance_id: AbilityInstanceId::new("setup", "p1"),
    }
}
#[test]
fn actual_and_simulated_sources_are_exclusive_and_have_distinct_completion_keys() {
    let actual = ActionOccurrence::character(action("dreamer"), source("dreamer")).unwrap();
    let simulation = PhilosopherSimulationSource {
        selection_event_id: "choice:1".into(),
        source_ability_use: source("philosopher"),
    };
    assert!(ActionOccurrence::from_parts(
        action("dreamer"),
        Some(source("dreamer")),
        Some(simulation.clone()),
        None
    )
    .is_err());
    assert!(ActionOccurrence::from_parts(action("dreamer"), None, None, None).is_err());
    let simulated =
        ActionOccurrence::from_parts(action("dreamer"), None, Some(simulation), None).unwrap();
    assert_ne!(actual.identity(), simulated.identity());
    assert_ne!(actual.step_id().unwrap(), simulated.step_id().unwrap());
    let mut progress = FirstNightProgress::default();
    progress.completed_occurrences.push(actual.identity());
    assert!(!progress.is_completed(&simulated));
    assert_eq!(simulated.actor_player_id(), Some("p1"));
}
#[test]
fn followup_identity_preserves_the_prior_relationship_and_encodes_lengths() {
    let base = ActionOccurrence::character(action("evilTwin"), source("evilTwin")).unwrap();
    let first = ActionOccurrence::from_parts(
        action("evilTwin"),
        base.ability_use.clone(),
        None,
        Some(FollowUpCause {
            trigger_event_id: "a:b".into(),
            relationship_event_id: "c".into(),
        }),
    )
    .unwrap();
    let second = ActionOccurrence::from_parts(
        action("evilTwin"),
        base.ability_use.clone(),
        None,
        Some(FollowUpCause {
            trigger_event_id: "a".into(),
            relationship_event_id: "b:c".into(),
        }),
    )
    .unwrap();
    assert_ne!(base.identity(), first.identity());
    assert_ne!(first.step_id().unwrap(), second.step_id().unwrap());
    assert!(ActionOccurrence::from_parts(
        action("dreamer"),
        Some(source("dreamer")),
        None,
        first.follow_up_cause
    )
    .is_err());
}
#[test]
fn simulation_wire_cannot_carry_real_effect_or_both_sources() {
    let mut event = json!({"id":"e2","phase":"firstNight","type":"customActionConfirmed","summary":"test","createdAt":"t","payload":{"stepId":"simulation","actionRef":{"kind":"character","characterId":"dreamer","actionId":"learnCharacters"},"simulationSource":{"selectionEventId":"e1","sourceAbilityUse":source("philosopher")},"input":null,"result":{"kind":"simulation","information":null,"spent":false}}});
    assert!(parse_event(event.clone()).is_ok());
    event["payload"]["abilityUse"] = json!(source("dreamer"));
    assert!(parse_event(event.clone()).is_err());
    event["payload"]
        .as_object_mut()
        .unwrap()
        .remove("abilityUse");
    event["payload"]["result"] =
        json!({"kind":"snakeCharmer","targetPlayerId":"p2","outcome":"swapped"});
    assert!(parse_event(event).is_err());
}

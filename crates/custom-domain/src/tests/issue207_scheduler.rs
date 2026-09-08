//! Source/cause completion and explicit projection contracts independent of Character outcomes.
use crate::{
    contracts::FirstNightActionRef,
    first_night::{ActionContext, ActionRegistry, FirstNightRuleService},
    rules::CustomRuleService,
    state::FirstNightProgress,
};
#[test]
fn recovered_simulation_does_not_erase_its_completed_identity() {
    let (context, mut facts) = super::issue207_rule_state::failed_choice();
    let action = FirstNightActionRef::Character {
        character_id: "dreamer".into(),
        action_id: "learnCharacters".into(),
    };
    let occurrence = CustomRuleService::new(&context, &facts)
        .simulation_occurrences(&action)
        .unwrap()
        .remove(0);
    let mut progress = FirstNightProgress::default();
    progress.completed_occurrences.push(occurrence.identity());
    facts.active_impairments.clear();
    assert!(CustomRuleService::new(&context, &facts)
        .simulation_occurrences(&action)
        .unwrap()
        .is_empty());
    assert!(progress.is_completed(&occurrence));
}
#[test]
fn explicit_occurrence_projection_cannot_fall_back_to_an_unregistered_action() {
    let (context, facts) = super::issue207_rule_state::failed_choice();
    let rules = CustomRuleService::new(&context, &facts);
    let action = FirstNightActionRef::Character {
        character_id: "dreamer".into(),
        action_id: "learnCharacters".into(),
    };
    let occurrence = rules.simulation_occurrences(&action).unwrap().remove(0);
    let registry = ActionRegistry::new(vec![]).unwrap();
    assert!(registry
        .project_occurrence(
            &ActionContext {
                rule_service: &rules,
                event_id: "candidate"
            },
            &occurrence
        )
        .is_err());
}

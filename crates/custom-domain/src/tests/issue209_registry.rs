//! Internal defect detection. Real handlers are retained except for the explicit unknown-identity double.
use crate::first_night::{action_registry, catalog, ActionRegistry};

#[test]
fn production_builder_covers_all_declared_actions_and_categories() {
    let registry = action_registry().unwrap();
    assert_eq!(catalog::production_actions().len(), 29);
    for (action, ordered) in catalog::production_actions() {
        assert_eq!(
            registry
                .lookup(&action)
                .unwrap()
                .spec
                .participates_in_first_night,
            ordered
        );
    }
    registry.validate_production_completeness().unwrap();
}

#[test]
fn every_missing_registration_including_non_ordered_candidates_is_detected() {
    for (action, _) in catalog::production_actions() {
        let mut registry = action_registry().unwrap();
        registry.remove_for_tests(&action);
        assert_eq!(
            registry
                .validate_production_completeness()
                .unwrap_err()
                .code,
            "FIRST_NIGHT_ACTION_HANDLER_UNAVAILABLE",
            "{action:?}"
        );
    }
}

#[test]
fn additional_actions_cannot_be_misclassified_as_regular_even_with_a_real_handler() {
    for (action, ordered) in catalog::production_actions() {
        if ordered {
            continue;
        }
        let mut entry = crate::characters::trouble_brewing::registrations()
            .into_iter()
            .chain(crate::characters::sects_and_violets::registrations())
            .find(|entry| entry.spec.action_ref == action)
            .unwrap();
        entry.spec.participates_in_first_night = true;
        let mut registry = action_registry().unwrap();
        registry.remove_for_tests(&action);
        registry.register(entry).unwrap();
        assert_eq!(
            registry
                .validate_production_completeness()
                .unwrap_err()
                .code,
            "FIRST_NIGHT_ACTION_REGISTRATION_INVALID",
            "{action:?}"
        );
    }
}

#[test]
fn partial_constructor_remains_available_but_cannot_claim_production_completeness() {
    let partial = ActionRegistry::new(vec![]).unwrap();
    assert_eq!(
        partial.validate_production_completeness().unwrap_err().code,
        "FIRST_NIGHT_ACTION_HANDLER_UNAVAILABLE"
    );
    let fixtures = crate::first_night::fixture_action_registry().unwrap();
    assert_eq!(
        fixtures
            .validate_production_completeness()
            .unwrap_err()
            .code,
        "FIRST_NIGHT_ACTION_HANDLER_UNAVAILABLE"
    );
}

#[test]
fn duplicate_and_mismatched_specs_are_rejected_before_composition() {
    let mut entries = crate::characters::trouble_brewing::registrations();
    entries.extend(crate::characters::trouble_brewing::registrations());
    assert_eq!(
        ActionRegistry::new(entries).err().unwrap().code,
        "FIRST_NIGHT_ACTION_REGISTRATION_INVALID"
    );
    let mut entries = crate::characters::trouble_brewing::registrations();
    entries[0].spec.action_ref = entries[1].spec.action_ref.clone();
    assert_eq!(
        ActionRegistry::new(entries).err().unwrap().code,
        "FIRST_NIGHT_ACTION_REGISTRATION_INVALID"
    );
}

#[test]
fn an_unexpected_identity_is_invalid_even_when_spec_and_handler_agree() {
    use crate::{
        contracts::FirstNightActionRef,
        error::CoreError,
        event::CustomFactChanges,
        first_night::{
            ActionContext, ActionEventDraft, ActionHandler, ActionSpec, RegisteredAction,
        },
        model::{PhaseStep, PhaseStepSupport, RequiredInputKind, StepInput},
        state::ActionOccurrence,
    };
    // Registration-only double: no fake outcome can enter a production scenario.
    struct UnknownHandler(FirstNightActionRef);
    impl ActionHandler for UnknownHandler {
        fn action_ref(&self) -> &FirstNightActionRef {
            &self.0
        }
        fn project(
            &self,
            _: &ActionSpec,
            _: &ActionContext<'_>,
        ) -> Result<Vec<PhaseStep>, CoreError> {
            panic!("registration only")
        }
        fn propose(
            &self,
            _: &ActionSpec,
            _: &ActionContext<'_>,
            _: &ActionOccurrence,
            _: &StepInput,
        ) -> Result<ActionEventDraft, CoreError> {
            panic!("registration only")
        }
        fn validate_event(
            &self,
            _: &ActionSpec,
            _: &ActionContext<'_>,
            _: &ActionOccurrence,
            _: &ActionEventDraft,
        ) -> Result<CustomFactChanges, CoreError> {
            panic!("registration only")
        }
    }
    let action = FirstNightActionRef::Character {
        character_id: "empath".into(),
        action_id: "unknownAction".into(),
    };
    let mut registry = action_registry().unwrap();
    registry
        .register(RegisteredAction {
            spec: ActionSpec {
                action_ref: action.clone(),
                participates_in_first_night: true,
                required_input_kind: RequiredInputKind::None,
                support: PhaseStepSupport::Automated,
            },
            handler: Box::new(UnknownHandler(action)),
        })
        .unwrap();
    assert_eq!(
        registry
            .validate_production_completeness()
            .unwrap_err()
            .code,
        "FIRST_NIGHT_ACTION_REGISTRATION_INVALID"
    );
}

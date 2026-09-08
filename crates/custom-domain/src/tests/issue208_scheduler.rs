//! Restricted scheduler contracts with test-owned handlers, not Production acceptance.
use crate::{
    contracts::*, event::CustomFactChanges, first_night::*, model::*, rules::CustomRuleService,
    state::*,
};
struct Additional {
    action: FirstNightActionRef,
    optional: bool,
}
impl Additional {
    fn occurrence(&self, context: &ActionContext<'_>) -> ActionOccurrence {
        let facts = context.rule_service.facts().unwrap();
        let instance = context
            .rule_service
            .try_owned_instances(&self.action)
            .unwrap()
            .remove(0);
        let prefix = facts
            .confirmed_actions
            .last()
            .map(|e| e.event_id.clone())
            .unwrap_or("setup".into());
        ActionOccurrence::from_all_parts(
            self.action.clone(),
            Some(instance.ability_use),
            None,
            None,
            Some(if self.optional {
                ActionCause::Optional {
                    prefix_event_id: prefix,
                }
            } else {
                ActionCause::InitialPreparation {
                    source_event_id: "setup".into(),
                }
            }),
        )
        .unwrap()
    }
    fn step(&self, context: &ActionContext<'_>) -> PhaseStep {
        let o = self.occurrence(context);
        let mut step = crate::input::simple_step(
            Phase::FirstNight,
            "test",
            "additional",
            StepType::Character,
            crate::input::required_none(),
            false,
        );
        step.id = o.step_id().unwrap();
        step.action_ref = Some(o.action_ref);
        step.ability_use = o.ability_use;
        step.action_cause = o.action_cause;
        step
    }
}
impl ActionHandler for Additional {
    fn action_ref(&self) -> &FirstNightActionRef {
        &self.action
    }
    fn project(
        &self,
        _: &ActionSpec,
        c: &ActionContext<'_>,
    ) -> Result<Vec<PhaseStep>, crate::error::CoreError> {
        Ok(vec![self.step(c)])
    }
    fn required_occurrences(
        &self,
        c: &ActionContext<'_>,
        _: &FirstNightProgress,
    ) -> Result<Vec<ActionOccurrence>, crate::error::CoreError> {
        Ok(if self.optional {
            vec![]
        } else {
            vec![self.occurrence(c)]
        })
    }
    fn optional_occurrences(
        &self,
        c: &ActionContext<'_>,
        _: &FirstNightProgress,
    ) -> Result<Vec<ActionOccurrence>, crate::error::CoreError> {
        Ok(if self.optional {
            vec![self.occurrence(c)]
        } else {
            vec![]
        })
    }
    fn propose(
        &self,
        _: &ActionSpec,
        _: &ActionContext<'_>,
        _: &ActionOccurrence,
        _: &StepInput,
    ) -> Result<ActionEventDraft, crate::error::CoreError> {
        unreachable!()
    }
    fn validate_event(
        &self,
        _: &ActionSpec,
        _: &ActionContext<'_>,
        _: &ActionOccurrence,
        _: &ActionEventDraft,
    ) -> Result<CustomFactChanges, crate::error::CoreError> {
        Ok(CustomFactChanges::default())
    }
}
fn event(o: &ActionOccurrence, id: &str) -> ValidatedActionEvent {
    let payload = CustomActionConfirmedPayload {
        step_id: o.step_id().unwrap(),
        action_ref: o.action_ref.clone(),
        ability_use: o.ability_use.clone(),
        simulation_source: None,
        follow_up_cause: None,
        action_cause: o.action_cause.clone(),
        input: None,
        result: CustomActionResult::NoEffect,
        delivered_result: None,
        registration_judgments: vec![],
    };
    let event = GameEvent {
        id: id.into(),
        phase: Phase::FirstNight,
        summary: "contract".into(),
        created_at: "t".into(),
        kind: GameEventKind::CustomActionConfirmed {
            payload: payload.clone(),
        },
    };
    ValidatedActionEvent::Custom(ValidatedCustomEvent::for_tests(
        event,
        payload,
        CustomFactChanges::default(),
    ))
}
#[test]
fn required_preparation_precedes_dawn_and_optional_confirmation_does_not_consume_it() {
    let (definition, facts) = super::issue207_impairments::facts(&["fortuneTeller", "mutant"]);
    let mut registry = action_registry().unwrap();
    for (character, id, optional) in [
        ("fortuneTeller", "assignRedHerring", false),
        ("mutant", "resolveMadnessExecution", true),
    ] {
        let action = FirstNightActionRef::Character {
            character_id: character.into(),
            action_id: id.into(),
        };
        registry.remove_for_tests(&action);
        registry
            .register(RegisteredAction {
                spec: ActionSpec {
                    action_ref: action.clone(),
                    participates_in_first_night: false,
                    required_input_kind: RequiredInputKind::None,
                    support: PhaseStepSupport::Automated,
                },
                handler: Box::new(Additional { action, optional }),
            })
            .unwrap();
    }
    let rules = CustomRuleService::new(&definition, &facts);
    let context = ActionContext {
        event_id: "",
        rule_service: &rules,
    };
    let plan = FirstNightOrderPlan(vec![FirstNightActionRef::system("dawn")]);
    let activation = NoActionActivation;
    let scheduler = NightScheduler::new(&plan, &registry, &activation);
    let initial = scheduler.initial_progress(&context).unwrap();
    assert_eq!(initial.required_queue.len(), 1);
    assert!(initial.available_occurrences.is_empty());
    let prep = initial.next_occurrence().unwrap().clone();
    let next = scheduler
        .advance(&initial, &context, &context, &event(&prep, "prepare"))
        .unwrap();
    assert_eq!(
        next.next_occurrence().unwrap().action_ref,
        FirstNightActionRef::system("dawn")
    );
    assert_eq!(next.available_occurrences.len(), 1);
    let choice = next.available_occurrences[0].clone();
    let after = scheduler
        .advance(&next, &context, &context, &event(&choice, "choice"))
        .unwrap();
    assert_eq!(after.cursor, next.cursor);
    assert_eq!(after.next_occurrence(), next.next_occurrence());
    assert!(!after.ended);
    assert!(scheduler
        .advance(&after, &context, &context, &event(&choice, "duplicate"))
        .is_err());
}

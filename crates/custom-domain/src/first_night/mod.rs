mod activation;
#[cfg(any(test, feature = "custom-runtime-fixtures"))]
mod fixtures;
mod plan;
mod registry;
mod runtime;
mod system;

pub(crate) use activation::{
    ActivationContext, ActivationDecision, ActivationRule, FirstNightActivationRule,
    FollowUpContext, FollowUpRule, NoActionActivation,
};
pub(crate) use plan::{plan_for_definition, plan_for_draft};
#[cfg(test)]
pub(crate) use registry::fixture_action_registry;
#[allow(unused_imports)]
pub(crate) use registry::{
    action_registry, system_action_registry, ActionContext, ActionEventDraft, ActionHandler,
    ActionInput, ActionRegistry, ActionSpec, ActiveAbilityInstance, CustomRuleService,
    FirstNightRuleService, RegisteredAction, SystemActionEventDraft, ValidatedActionEvent,
    ValidatedCustomEvent, ValidatedSystemActionEvent,
};
pub(crate) use runtime::{
    advance_progress, advance_progress_with_snapshot, initial_progress, project_occurrence_step,
    project_pending_steps, NightScheduler, ProjectedOccurrenceStep,
};

/// Select the separately owned Production SnV or fixture activation policy. Both traverse
/// the same custom runtime fold without registering fixture outcomes in Production.
pub(crate) fn activation_rule() -> Box<dyn ActivationRule> {
    #[cfg(feature = "custom-runtime-fixtures")]
    {
        Box::new(fixtures::FixtureActivation)
    }
    #[cfg(not(feature = "custom-runtime-fixtures"))]
    {
        Box::new(crate::characters::sects_and_violets::SnvActivation)
    }
}

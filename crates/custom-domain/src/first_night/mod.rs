mod activation;
#[cfg(any(test, feature = "custom-runtime-fixtures"))]
mod fixtures;
mod plan;
mod registry;
mod runtime;
mod system;

pub(crate) use activation::{
    ActivationContext, ActivationDecision, ActivationRule, FirstNightActivationRule,
    NoActionActivation,
};
pub(crate) use plan::{plan_for_definition, plan_for_draft};
#[cfg(test)]
pub(crate) use registry::fixture_action_registry;
#[allow(unused_imports)]
pub(crate) use registry::{
    action_registry, system_action_registry, ActionContext, ActionEventDraft, ActionHandler,
    ActionRegistry, ActionSpec, ActiveAbilityInstance, CustomRuleService, FirstNightRuleService,
    RegisteredAction, SystemActionEventDraft, ValidatedActionEvent, ValidatedCustomEvent,
    ValidatedSystemActionEvent,
};
pub(crate) use runtime::{
    advance_progress, advance_progress_with_snapshot, initial_progress, project_occurrence_step,
    project_pending_steps, NightScheduler, ProjectedOccurrenceStep,
};

/// Select the activation policy for this build. Production has no Character-specific policy yet;
/// the dedicated fixture build supplies its own rule so fixture replay still traverses the exact
/// runtime fold without teaching production code about fixture outcomes.
pub(crate) fn activation_rule() -> Box<dyn ActivationRule> {
    #[cfg(feature = "custom-runtime-fixtures")]
    {
        Box::new(fixtures::FixtureActivation)
    }
    #[cfg(not(feature = "custom-runtime-fixtures"))]
    {
        Box::new(NoActionActivation)
    }
}

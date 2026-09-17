//! Scheduled Storyteller resolution. Character rules own eligibility and effects; this action
//! owns its independent position in the night plan and canonical confirmation boundary.
use super::{ActionContext, ActionEventDraft, ActionHandler, ActionSpec, RegisteredAction};
use crate::{
    contracts::FirstNightActionRef,
    error::{CoreError, ErrorKind},
    event::{CustomActionEventDraft, CustomFactChanges},
    input::{required_none, simple_step},
    model::{Phase, PhaseStep, PhaseStepSupport, RequiredInputKind, StepInput, StepType},
    state::ActionOccurrence,
};

struct NightDeathsHandler {
    action_ref: FirstNightActionRef,
}
fn invalid() -> CoreError {
    ErrorKind::InvalidFirstNightActionProvenance.into_error()
}
impl ActionHandler for NightDeathsHandler {
    fn action_ref(&self) -> &FirstNightActionRef {
        &self.action_ref
    }
    fn project(
        &self,
        _: &ActionSpec,
        context: &ActionContext<'_>,
    ) -> Result<Vec<PhaseStep>, CoreError> {
        let Some(facts) = context.rule_service.facts() else {
            return Ok(vec![]);
        };
        if !context
            .rule_service
            .definition()
            .is_some_and(|d| d.scheduled_night_deaths)
            || crate::night_deaths::pending_sources(facts).is_empty()
        {
            return Ok(vec![]);
        }
        let targets: Vec<_> = facts
            .players
            .iter()
            .filter(|p| p.alive)
            .map(|p| p.id.clone())
            .collect();
        let mut required = required_none();
        required.kind = RequiredInputKind::PlayerIds;
        required.target = Some(crate::model::InputTarget::Players);
        required.min_selections = Some(0);
        required.max_selections = Some(targets.len() as u8);
        required.allowed_player_ids = Some(targets);
        let mut step = simple_step(
            Phase::Night,
            "firstNight:system",
            "resolveNightDeaths",
            StepType::Character,
            required,
            false,
        );
        step.action_ref = Some(self.action_ref.clone());
        Ok(vec![step])
    }
    fn propose(
        &self,
        _: &ActionSpec,
        context: &ActionContext<'_>,
        occurrence: &ActionOccurrence,
        input: &StepInput,
    ) -> Result<ActionEventDraft, CoreError> {
        let (result, _) =
            crate::night_deaths::resolve(context.rule_service.facts().ok_or_else(invalid)?, input)?;
        Ok(ActionEventDraft::Custom(CustomActionEventDraft {
            action_ref: self.action_ref.clone(),
            step_id: occurrence.step_id()?,
            ability_use: None,
            simulation_source: None,
            follow_up_cause: None,
            action_cause: None,
            input: input.clone(),
            delivered_result: None,
            registration_judgments: vec![],
            result,
        }))
    }
    fn validate_event(
        &self,
        spec: &ActionSpec,
        context: &ActionContext<'_>,
        occurrence: &ActionOccurrence,
        draft: &ActionEventDraft,
    ) -> Result<CustomFactChanges, CoreError> {
        let ActionEventDraft::Custom(actual) = draft else {
            return Err(invalid());
        };
        let ActionEventDraft::Custom(expected) =
            self.propose(spec, context, occurrence, &actual.input)?
        else {
            unreachable!()
        };
        if actual.result != expected.result
            || actual.delivered_result.is_some()
            || !actual.registration_judgments.is_empty()
        {
            return Err(invalid());
        }
        let (_, changes) = crate::night_deaths::resolve(
            context.rule_service.facts().ok_or_else(invalid)?,
            &actual.input,
        )?;
        Ok(changes)
    }
}
pub(crate) fn registration() -> RegisteredAction {
    let action_ref = FirstNightActionRef::system("resolveNightDeaths");
    RegisteredAction {
        spec: ActionSpec {
            action_ref: action_ref.clone(),
            participates_in_first_night: false,
            required_input_kind: RequiredInputKind::PlayerIds,
            support: PhaseStepSupport::Automated,
            prerequisites: vec![],
            continuation_sources: vec![],
        },
        handler: Box::new(NightDeathsHandler { action_ref }),
    }
}

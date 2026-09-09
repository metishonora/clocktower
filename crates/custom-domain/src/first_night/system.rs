use crate::{
    contracts::{FirstNightActionRef, SystemFirstNightActionId},
    error::{CoreError, ErrorKind},
    input::{phase_transition_step, required_characters, required_none, simple_step},
    model::{Phase, PhaseStep, PhaseStepSupport, RequiredInputKind, StepInput, StepType},
    state::ActionOccurrence,
};

use super::{
    ActionContext, ActionEventDraft, ActionHandler, ActionSpec, RegisteredAction,
    SystemActionEventDraft,
};
use crate::event::CustomFactChanges;

struct SystemHandler {
    action_ref: FirstNightActionRef,
}

impl SystemHandler {
    fn action_id(&self) -> SystemFirstNightActionId {
        let FirstNightActionRef::System { action_id } = self.action_ref else {
            unreachable!()
        };
        action_id
    }
}

impl ActionHandler for SystemHandler {
    fn action_ref(&self) -> &FirstNightActionRef {
        &self.action_ref
    }

    fn project(
        &self,
        _spec: &ActionSpec,
        context: &ActionContext<'_>,
    ) -> Result<Vec<PhaseStep>, CoreError> {
        let step = match self.action_id() {
            SystemFirstNightActionId::Dusk => return Ok(Vec::new()),
            SystemFirstNightActionId::MinionInfo if !context.rule_service.has_minion() => {
                return Ok(Vec::new())
            }
            SystemFirstNightActionId::MinionInfo => simple_step(
                Phase::FirstNight,
                "firstNight:system",
                "minionInfo",
                StepType::EvilInfo,
                required_none(),
                false,
            ),
            SystemFirstNightActionId::DemonInfo if !context.rule_service.has_demon() => {
                return Ok(Vec::new())
            }
            SystemFirstNightActionId::DemonInfo => simple_step(
                Phase::FirstNight,
                "firstNight:system",
                "demonInfo",
                StepType::EvilInfo,
                required_characters(
                    3,
                    3,
                    Some(context.rule_service.legal_demon_bluff_character_ids()),
                    true,
                ),
                false,
            ),
            SystemFirstNightActionId::Dawn => phase_transition_step(
                Phase::FirstNight,
                "firstNight:system",
                "dawn",
                RequiredInputKind::Day,
            ),
            SystemFirstNightActionId::Unknown => {
                return Err(ErrorKind::FirstNightActionHandlerUnavailable.into_error())
            }
        };
        Ok(vec![PhaseStep {
            simulation_source: None,
            follow_up_cause: None,
            action_cause: None,
            action_ref: Some(self.action_ref.clone()),
            ..step
        }])
    }

    fn propose(
        &self,
        _spec: &ActionSpec,
        context: &ActionContext<'_>,
        occurrence: &ActionOccurrence,
        input: &StepInput,
    ) -> Result<ActionEventDraft, CoreError> {
        validate_occurrence(&self.action_ref, occurrence)?;
        validate_input(self.action_id(), context, input)?;
        Ok(ActionEventDraft::System(SystemActionEventDraft {
            action_ref: self.action_ref.clone(),
            step_id: occurrence.step_id()?,
            input: input.clone(),
        }))
    }

    fn validate_event(
        &self,
        _spec: &ActionSpec,
        context: &ActionContext<'_>,
        occurrence: &ActionOccurrence,
        draft: &ActionEventDraft,
    ) -> Result<CustomFactChanges, CoreError> {
        validate_occurrence(&self.action_ref, occurrence)?;
        let ActionEventDraft::System(draft) = draft else {
            return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
        };
        if draft.action_ref != self.action_ref || draft.step_id != occurrence.step_id()? {
            return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
        }
        validate_input(self.action_id(), context, &draft.input)?;
        Ok(CustomFactChanges::default())
    }
}

fn validate_occurrence(
    action_ref: &FirstNightActionRef,
    occurrence: &ActionOccurrence,
) -> Result<(), CoreError> {
    if occurrence.action_ref != *action_ref
        || occurrence.ability_use.is_some()
        || occurrence.step_id()?.trim().is_empty()
    {
        return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
    }
    Ok(())
}

fn validate_input(
    action_id: SystemFirstNightActionId,
    context: &ActionContext<'_>,
    input: &StepInput,
) -> Result<(), CoreError> {
    let required = match action_id {
        SystemFirstNightActionId::DemonInfo => required_characters(
            3,
            3,
            Some(context.rule_service.legal_demon_bluff_character_ids()),
            true,
        ),
        // The legacy phase validator treats these system steps as non-targeted inputs. Keep that
        // behavior so the new handler boundary does not change existing system payload meaning.
        SystemFirstNightActionId::Dusk
        | SystemFirstNightActionId::MinionInfo
        | SystemFirstNightActionId::Dawn
        | SystemFirstNightActionId::Unknown => crate::input::required_none(),
    };
    crate::input::validate_required_input(&required, input, &[])
}

pub(super) fn registrations() -> Vec<RegisteredAction> {
    super::catalog::SYSTEM_ACTIONS
        .into_iter()
        .map(|action_id| {
            let required_input_kind = match action_id {
                SystemFirstNightActionId::DemonInfo => RequiredInputKind::CharacterIds,
                SystemFirstNightActionId::Dawn => RequiredInputKind::Day,
                _ => RequiredInputKind::None,
            };
            let action_ref = FirstNightActionRef::System { action_id };
            RegisteredAction {
                spec: ActionSpec {
                    action_ref: action_ref.clone(),
                    participates_in_first_night: true,
                    required_input_kind,
                    support: PhaseStepSupport::Automated,
                },
                handler: Box::new(SystemHandler { action_ref }),
            }
        })
        .collect()
}

use crate::{
    contracts::{FirstNightActionRef, SystemFirstNightActionId},
    error::{CoreError, ErrorKind},
    model::{Phase, PhaseStep, PhaseStepSupport, RequiredInputKind, StepType},
    phase::{phase_transition_step, required_characters, required_none, simple_step},
};

use super::{ActionContext, ActionHandler, ActionSpec, ConfirmedActionEvent, RegisteredAction};

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
            action_ref: Some(self.action_ref.clone()),
            ..step
        }])
    }

    fn propose(
        &self,
        _spec: &ActionSpec,
        _context: &ActionContext<'_>,
        step: &PhaseStep,
    ) -> Result<ConfirmedActionEvent, CoreError> {
        if step.action_ref.as_ref() != Some(&self.action_ref) {
            return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
        }
        Ok(ConfirmedActionEvent {
            action_ref: self.action_ref.clone(),
            step_id: step.id.clone(),
            ability_use: step.ability_use.clone(),
        })
    }

    fn validate_event(
        &self,
        _spec: &ActionSpec,
        _context: &ActionContext<'_>,
        event: &ConfirmedActionEvent,
    ) -> Result<(), CoreError> {
        if event.action_ref != self.action_ref || event.ability_use.is_some() {
            return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
        }
        Ok(())
    }
}

pub(super) fn registrations() -> Vec<RegisteredAction> {
    [
        (SystemFirstNightActionId::Dusk, RequiredInputKind::None),
        (
            SystemFirstNightActionId::MinionInfo,
            RequiredInputKind::None,
        ),
        (
            SystemFirstNightActionId::DemonInfo,
            RequiredInputKind::CharacterIds,
        ),
        (SystemFirstNightActionId::Dawn, RequiredInputKind::Day),
    ]
    .into_iter()
    .map(|(action_id, required_input_kind)| {
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

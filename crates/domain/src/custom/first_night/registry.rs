use std::{collections::HashMap, fmt};

use crate::{
    contracts::{FirstNightActionRef, FirstNightOrderPlan},
    error::{CoreError, ErrorKind},
    model::{AbilityOrigin, AbilityUseRef, PhaseStep, PhaseStepSupport, RequiredInputKind},
};

use super::system;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ActionSpec {
    pub(crate) action_ref: FirstNightActionRef,
    pub(crate) participates_in_first_night: bool,
    pub(crate) required_input_kind: RequiredInputKind,
    pub(crate) support: PhaseStepSupport,
}

#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(not(test), allow(dead_code))]
pub(crate) struct ActiveAbilityInstance {
    pub(crate) seat: u8,
    pub(crate) ability_use: AbilityUseRef,
    pub(crate) ability_origin: AbilityOrigin,
}

pub(crate) trait FirstNightRuleService {
    #[cfg_attr(not(test), allow(dead_code))]
    fn active_instances(&self, action_ref: &FirstNightActionRef) -> Vec<ActiveAbilityInstance>;
    fn has_minion(&self) -> bool;
    fn has_demon(&self) -> bool;
    fn legal_demon_bluff_character_ids(&self) -> Vec<String>;
}

pub(crate) struct ActionContext<'a> {
    pub(crate) rule_service: &'a dyn FirstNightRuleService,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ConfirmedActionEvent {
    pub(crate) action_ref: FirstNightActionRef,
    pub(crate) step_id: String,
    pub(crate) ability_use: Option<AbilityUseRef>,
}

pub(crate) trait ActionHandler {
    fn action_ref(&self) -> &FirstNightActionRef;
    fn project(
        &self,
        spec: &ActionSpec,
        context: &ActionContext<'_>,
    ) -> Result<Vec<PhaseStep>, CoreError>;
    fn propose(
        &self,
        spec: &ActionSpec,
        context: &ActionContext<'_>,
        step: &PhaseStep,
    ) -> Result<ConfirmedActionEvent, CoreError>;
    fn validate_event(
        &self,
        spec: &ActionSpec,
        context: &ActionContext<'_>,
        event: &ConfirmedActionEvent,
    ) -> Result<(), CoreError>;
}

pub(crate) struct RegisteredAction {
    pub(crate) spec: ActionSpec,
    pub(crate) handler: Box<dyn ActionHandler>,
}

impl fmt::Debug for RegisteredAction {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("RegisteredAction")
            .field("spec", &self.spec)
            .field("handler_action_ref", self.handler.action_ref())
            .finish()
    }
}

pub(crate) struct ActionRegistry {
    entries: HashMap<FirstNightActionRef, RegisteredAction>,
}

impl fmt::Debug for ActionRegistry {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("ActionRegistry")
            .field("action_refs", &self.entries.keys().collect::<Vec<_>>())
            .finish()
    }
}

impl ActionRegistry {
    pub(crate) fn new(entries: Vec<RegisteredAction>) -> Result<Self, CoreError> {
        let mut registry = Self {
            entries: HashMap::with_capacity(entries.len()),
        };
        for entry in entries {
            registry.register(entry)?;
        }
        Ok(registry)
    }

    pub(crate) fn register(&mut self, entry: RegisteredAction) -> Result<(), CoreError> {
        if entry.spec.action_ref != *entry.handler.action_ref()
            || !entry.spec.participates_in_first_night
            || self.entries.contains_key(&entry.spec.action_ref)
        {
            return Err(ErrorKind::FirstNightActionRegistrationInvalid.into_error());
        }
        self.entries.insert(entry.spec.action_ref.clone(), entry);
        Ok(())
    }

    pub(crate) fn lookup(
        &self,
        action_ref: &FirstNightActionRef,
    ) -> Result<&RegisteredAction, CoreError> {
        self.entries
            .get(action_ref)
            .ok_or_else(|| ErrorKind::FirstNightActionHandlerUnavailable.into_error())
    }

    pub(crate) fn propose(
        &self,
        action_ref: &FirstNightActionRef,
        context: &ActionContext<'_>,
        step: &PhaseStep,
    ) -> Result<ConfirmedActionEvent, CoreError> {
        let entry = self.lookup(action_ref)?;
        entry.handler.propose(&entry.spec, context, step)
    }

    pub(crate) fn validate_event(
        &self,
        action_ref: &FirstNightActionRef,
        context: &ActionContext<'_>,
        event: &ConfirmedActionEvent,
    ) -> Result<(), CoreError> {
        let entry = self.lookup(action_ref)?;
        entry.handler.validate_event(&entry.spec, context, event)
    }

    pub(crate) fn project(
        &self,
        action_ref: &FirstNightActionRef,
        context: &ActionContext<'_>,
    ) -> Result<Vec<PhaseStep>, CoreError> {
        let entry = self.lookup(action_ref)?;
        entry.handler.project(&entry.spec, context)
    }
}

pub(crate) fn system_action_registry() -> Result<ActionRegistry, CoreError> {
    ActionRegistry::new(system::registrations())
}

#[allow(dead_code)]
pub(crate) fn registry_supports_plan(
    registry: &ActionRegistry,
    plan: &FirstNightOrderPlan,
) -> Result<(), CoreError> {
    for action_ref in &plan.0 {
        registry.lookup(action_ref)?;
    }
    Ok(())
}

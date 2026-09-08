use std::{collections::HashMap, fmt};

use crate::{
    contracts::{
        CustomActionConfirmedPayload, FirstNightActionRef, FirstNightOrderPlan, GameEvent,
        GameEventKind, PhaseStepEventPayload,
    },
    error::{CoreError, ErrorKind},
    event::{self, CustomActionEventDraft, CustomFactChanges},
    model::{
        AbilityOrigin, AbilityUseRef, PhaseStep, PhaseStepSupport, RequiredInputKind, StepInput,
    },
    state::{ActionOccurrence, CustomGameFacts},
};

use super::system;

/// Stable declaration for one first-night action. Character-specific handlers own the meaning of
/// the required input and result kinds; the registry owns shared identity and registration checks.
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

/// Read-only facts needed by first-night handlers. Participation and effectiveness stay as
/// separate decisions in the handler that owns an action; this trait has no universal
/// `alive && !impaired` policy.
pub(crate) trait FirstNightRuleService {
    #[cfg_attr(not(test), allow(dead_code))]
    fn active_instances(&self, action_ref: &FirstNightActionRef) -> Vec<ActiveAbilityInstance>;
    fn try_active_instances(
        &self,
        action_ref: &FirstNightActionRef,
    ) -> Result<Vec<ActiveAbilityInstance>, CoreError>;
    /// Return all currently owned instances, independently of whether the action participates
    /// under a Character-specific condition.  The default keeps older rule fixtures source
    /// compatible; custom production rules override it with their provenance-aware ownership
    /// query so activation can distinguish a new instance from a participation change.
    fn try_owned_instances(
        &self,
        action_ref: &FirstNightActionRef,
    ) -> Result<Vec<ActiveAbilityInstance>, CoreError> {
        self.try_active_instances(action_ref)
    }
    /// Expose the backing facts when a rule service has them.  Older synthetic rule fixtures only
    /// implement instance queries, so the scheduler treats `None` as an unavailable optional view
    /// rather than forcing those fixtures to invent a second facts store.
    fn facts(&self) -> Option<&CustomGameFacts> {
        None
    }
    fn has_minion(&self) -> bool;
    fn has_demon(&self) -> bool;
    fn legal_demon_bluff_character_ids(&self) -> Vec<String>;

    /// Validate membership in the resolved custom definition. Implementations must return the
    /// stable membership error rather than silently accepting an out-of-pool Character.
    fn validate_character_membership(&self, character_id: &str) -> Result<(), CoreError>;
}

pub(crate) use FirstNightRuleService as CustomRuleService;

pub(crate) struct ActionContext<'a> {
    pub(crate) rule_service: &'a dyn FirstNightRuleService,
}

/// Event facts after custom-envelope, occurrence, membership, ownership, and handler validation.
///
/// This type is owned by the registry rather than the wire-contract module so its constructor is
/// private to the semantic validation boundary.  Action handlers can return drafts, but they
/// cannot construct this value or its `Custom` enum variant.  The event module re-exports the
/// type for reducer consumers without exposing a construction path.
#[derive(Debug, Clone)]
pub(crate) struct ValidatedCustomEvent {
    id: String,
    phase: crate::model::Phase,
    summary: String,
    created_at: String,
    payload: CustomActionConfirmedPayload,
    fact_changes: event::CustomFactChanges,
}

impl ValidatedCustomEvent {
    fn new(
        event: GameEvent,
        payload: CustomActionConfirmedPayload,
        fact_changes: event::CustomFactChanges,
    ) -> Self {
        Self {
            id: event.id,
            phase: event.phase,
            summary: event.summary,
            created_at: event.created_at,
            payload,
            fact_changes,
        }
    }

    pub(crate) fn id(&self) -> &str {
        &self.id
    }

    pub(crate) fn phase(&self) -> crate::model::Phase {
        self.phase
    }

    pub(crate) fn summary(&self) -> &str {
        &self.summary
    }

    pub(crate) fn created_at(&self) -> &str {
        &self.created_at
    }

    pub(crate) fn payload(&self) -> &CustomActionConfirmedPayload {
        &self.payload
    }

    pub(crate) fn action_ref(&self) -> &FirstNightActionRef {
        &self.payload.action_ref
    }

    pub(crate) fn ability_use(&self) -> &AbilityUseRef {
        &self.payload.ability_use
    }

    pub(crate) fn step_id(&self) -> &str {
        &self.payload.step_id
    }

    pub(crate) fn fact_changes(&self) -> &event::CustomFactChanges {
        &self.fact_changes
    }

    /// Construct a validated event for reducer contract tests only. Production code must use the
    /// registry's semantic validation boundary; this test-only seam keeps fixture fact reducers
    /// independently verifiable without adding a production trust bypass.
    #[cfg(test)]
    pub(crate) fn for_tests(
        event: GameEvent,
        payload: CustomActionConfirmedPayload,
        fact_changes: event::CustomFactChanges,
    ) -> Self {
        Self::new(event, payload, fact_changes)
    }
}

/// A candidate event proposed by a handler. System actions retain their existing
/// `phaseStepConfirmed` wire shape; Character actions use the canonical custom envelope.
#[derive(Debug, Clone)]
pub(crate) enum ActionEventDraft {
    System(SystemActionEventDraft),
    Custom(CustomActionEventDraft),
}

#[derive(Debug, Clone)]
pub(crate) struct SystemActionEventDraft {
    pub(crate) action_ref: FirstNightActionRef,
    pub(crate) step_id: String,
    pub(crate) input: StepInput,
}

impl ActionEventDraft {
    pub(crate) fn action_ref(&self) -> &FirstNightActionRef {
        match self {
            Self::System(draft) => &draft.action_ref,
            Self::Custom(draft) => &draft.action_ref,
        }
    }

    pub(crate) fn step_id(&self) -> &str {
        match self {
            Self::System(draft) => &draft.step_id,
            Self::Custom(draft) => &draft.step_id,
        }
    }

    pub(crate) fn input(&self) -> &StepInput {
        match self {
            Self::System(draft) => &draft.input,
            Self::Custom(draft) => &draft.input,
        }
    }

    /// Convert a handler-owned draft into the canonical wire event kind. Keeping this conversion
    /// beside the draft means the runtime only supplies event metadata; it cannot assemble a
    /// system payload with a different shape than replay validation accepts.
    pub(crate) fn into_event_kind(self) -> GameEventKind {
        match self {
            Self::System(draft) => GameEventKind::PhaseStepConfirmed {
                payload: Box::new(PhaseStepEventPayload {
                    step_id: draft.step_id,
                    action_ref: Some(draft.action_ref),
                    ability_use: None,
                    input: draft.input,
                    information: None,
                }),
            },
            Self::Custom(draft) => GameEventKind::CustomActionConfirmed {
                payload: draft.into_payload(),
            },
        }
    }
}

/// Result of common validation. A custom event is only constructible after the registry boundary;
/// neither handlers nor wire deserializers can mint a `ValidatedCustomEvent`.
#[derive(Debug, Clone)]
pub(crate) enum ValidatedActionEvent {
    System(ValidatedSystemActionEvent),
    Custom(ValidatedCustomEvent),
}

/// Trusted system event data after common validation. Its fields are private so callers cannot
/// manufacture a validated value by constructing the enum variant directly.
#[derive(Debug, Clone)]
pub(crate) struct ValidatedSystemActionEvent {
    event_id: String,
    action_ref: FirstNightActionRef,
    step_id: String,
    input: StepInput,
}

impl ValidatedSystemActionEvent {
    fn new(event_id: String, draft: SystemActionEventDraft) -> Self {
        Self {
            event_id,
            action_ref: draft.action_ref,
            step_id: draft.step_id,
            input: draft.input,
        }
    }

    pub(crate) fn event_id(&self) -> &str {
        &self.event_id
    }

    pub(crate) fn action_ref(&self) -> &FirstNightActionRef {
        &self.action_ref
    }

    pub(crate) fn step_id(&self) -> &str {
        &self.step_id
    }

    pub(crate) fn input(&self) -> &StepInput {
        &self.input
    }
}

impl ValidatedActionEvent {
    pub(crate) fn event_id(&self) -> &str {
        match self {
            Self::System(event) => event.event_id(),
            Self::Custom(event) => event.id(),
        }
    }

    pub(crate) fn occurrence(&self) -> Result<ActionOccurrence, CoreError> {
        match self {
            Self::System(event) => ActionOccurrence::system(event.action_ref.clone()),
            Self::Custom(event) => {
                ActionOccurrence::character(event.action_ref().clone(), event.ability_use().clone())
            }
        }
    }

    pub(crate) fn step_id(&self) -> &str {
        match self {
            Self::System(draft) => draft.step_id(),
            Self::Custom(event) => event.step_id(),
        }
    }

    pub(crate) fn action_ref(&self) -> &FirstNightActionRef {
        match self {
            Self::System(draft) => draft.action_ref(),
            Self::Custom(event) => event.action_ref(),
        }
    }

    pub(crate) fn input(&self) -> &StepInput {
        match self {
            Self::System(event) => event.input(),
            Self::Custom(event) => &event.payload.input,
        }
    }
}

/// A handler is pure: it receives a concrete occurrence, read-only facts and the command's typed
/// input, then returns a canonical draft. It never receives mutable game state, a cursor, or a
/// queue.
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
        occurrence: &ActionOccurrence,
        input: &StepInput,
    ) -> Result<ActionEventDraft, CoreError>;
    fn validate_event(
        &self,
        spec: &ActionSpec,
        context: &ActionContext<'_>,
        occurrence: &ActionOccurrence,
        draft: &ActionEventDraft,
    ) -> Result<CustomFactChanges, CoreError>;

    /// Validate a draft with the confirmed event identity available.  Existing handlers keep the
    /// four argument method as their compatibility seam; fixture handlers that establish
    /// source-event provenance may override this method.  The event ID is never accepted from a
    /// command payload or used to bypass the common validation above.
    fn validate_event_with_id(
        &self,
        spec: &ActionSpec,
        context: &ActionContext<'_>,
        occurrence: &ActionOccurrence,
        draft: &ActionEventDraft,
        _event_id: &str,
    ) -> Result<CustomFactChanges, CoreError> {
        self.validate_event(spec, context, occurrence, draft)
    }
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

    /// Propose a draft and immediately run the same common plus action-specific validation that
    /// replay uses. This keeps a handler from returning a draft that could never be confirmed.
    pub(crate) fn propose(
        &self,
        action_ref: &FirstNightActionRef,
        context: &ActionContext<'_>,
        occurrence: &ActionOccurrence,
        input: &StepInput,
    ) -> Result<ActionEventDraft, CoreError> {
        let entry = self.lookup(action_ref)?;
        validate_occurrence_reference(action_ref, occurrence)?;
        let draft = entry
            .handler
            .propose(&entry.spec, context, occurrence, input)?;
        if draft.input() != input {
            return Err(ErrorKind::InvalidStepInput.into_error());
        }
        self.validate_draft(entry, context, occurrence, &draft)?;
        let _fact_changes =
            entry
                .handler
                .validate_event(&entry.spec, context, occurrence, &draft)?;
        Ok(draft)
    }

    /// Validate a persisted event against the preceding occurrence. The returned custom event is
    /// the only trusted value accepted by a reducer; malformed or mismatched wire values never
    /// cross this boundary.
    pub(crate) fn validate_event(
        &self,
        occurrence: &ActionOccurrence,
        context: &ActionContext<'_>,
        event: &GameEvent,
    ) -> Result<ValidatedActionEvent, CoreError> {
        let action_ref = &occurrence.action_ref;
        let entry = self.lookup(action_ref)?;
        let draft = draft_from_wire_event(event)?;
        self.validate_draft(entry, context, occurrence, &draft)?;
        let fact_changes = entry.handler.validate_event_with_id(
            &entry.spec,
            context,
            occurrence,
            &draft,
            &event.id,
        )?;

        match draft {
            ActionEventDraft::System(draft) => Ok(ValidatedActionEvent::System(
                ValidatedSystemActionEvent::new(event.id.clone(), draft),
            )),
            ActionEventDraft::Custom(_) => Ok(ValidatedActionEvent::Custom(validate_custom_event(
                event,
                fact_changes,
            )?)),
        }
    }

    fn validate_draft(
        &self,
        entry: &RegisteredAction,
        context: &ActionContext<'_>,
        occurrence: &ActionOccurrence,
        draft: &ActionEventDraft,
    ) -> Result<(), CoreError> {
        validate_occurrence_reference(&entry.spec.action_ref, occurrence)?;
        if draft.action_ref() != &entry.spec.action_ref
            || draft.step_id().trim().is_empty()
            || draft.step_id() != occurrence.step_id()?.as_str()
        {
            return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
        }

        match (
            &entry.spec.action_ref,
            occurrence.ability_use.as_ref(),
            draft,
        ) {
            (FirstNightActionRef::System { .. }, None, ActionEventDraft::System(_)) => {}
            (
                FirstNightActionRef::Character { character_id, .. },
                Some(expected_ability),
                ActionEventDraft::Custom(custom),
            ) => {
                context
                    .rule_service
                    .validate_character_membership(character_id)?;
                context
                    .rule_service
                    .validate_character_membership(&expected_ability.character_id)?;
                if expected_ability.character_id != *character_id
                    || custom.ability_use != *expected_ability
                    || custom.action_ref != entry.spec.action_ref
                    || !context
                        .rule_service
                        .try_active_instances(&entry.spec.action_ref)?
                        .iter()
                        .any(|instance| instance.ability_use == *expected_ability)
                {
                    return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
                }
            }
            _ => return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error()),
        }
        Ok(())
    }

    pub(crate) fn project(
        &self,
        action_ref: &FirstNightActionRef,
        context: &ActionContext<'_>,
    ) -> Result<Vec<PhaseStep>, CoreError> {
        let entry = self.lookup(action_ref)?;
        let steps = entry.handler.project(&entry.spec, context)?;
        for step in &steps {
            let Some(step_action_ref) = step.action_ref.as_ref() else {
                return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
            };
            if step_action_ref != action_ref {
                return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
            }
            let occurrence = occurrence_from_step(step)?;
            if occurrence.action_ref != *action_ref {
                return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
            }
        }
        Ok(steps)
    }
}

fn validate_occurrence_reference(
    action_ref: &FirstNightActionRef,
    occurrence: &ActionOccurrence,
) -> Result<(), CoreError> {
    if occurrence.action_ref != *action_ref {
        return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
    }
    match (&occurrence.action_ref, &occurrence.ability_use) {
        (FirstNightActionRef::System { .. }, None)
        | (FirstNightActionRef::Character { .. }, Some(_)) => Ok(()),
        _ => Err(ErrorKind::InvalidFirstNightActionProvenance.into_error()),
    }
}

fn occurrence_from_step(step: &PhaseStep) -> Result<ActionOccurrence, CoreError> {
    let action_ref = step
        .action_ref
        .clone()
        .ok_or_else(|| ErrorKind::InvalidFirstNightActionProvenance.into_error())?;
    let occurrence = match action_ref {
        FirstNightActionRef::System { .. } => ActionOccurrence::system(action_ref)?,
        action_ref @ FirstNightActionRef::Character { .. } => ActionOccurrence::character(
            action_ref,
            step.ability_use
                .clone()
                .ok_or_else(|| ErrorKind::InvalidFirstNightActionProvenance.into_error())?,
        )?,
    };
    if occurrence.step_id()? != step.id {
        return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
    }
    Ok(occurrence)
}

fn draft_from_wire_event(event: &GameEvent) -> Result<ActionEventDraft, CoreError> {
    if event.id.trim().is_empty() || event.phase != crate::model::Phase::FirstNight {
        return Err(ErrorKind::MalformedEvent.into_error());
    }
    match &event.kind {
        GameEventKind::PhaseStepConfirmed { payload } => {
            let action_ref = payload
                .action_ref
                .clone()
                .ok_or_else(|| ErrorKind::InvalidFirstNightActionProvenance.into_error())?;
            if payload.ability_use.is_some() || payload.information.is_some() {
                return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
            }
            Ok(ActionEventDraft::System(SystemActionEventDraft {
                action_ref,
                step_id: payload.step_id.clone(),
                input: payload.input.clone(),
            }))
        }
        GameEventKind::CustomActionConfirmed { payload } => {
            Ok(ActionEventDraft::Custom(CustomActionEventDraft {
                step_id: payload.step_id.clone(),
                action_ref: payload.action_ref.clone(),
                ability_use: payload.ability_use.clone(),
                input: payload.input.clone(),
                result: payload.result.clone(),
            }))
        }
        _ => Err(ErrorKind::EventNotSupportedByScript.into_error()),
    }
}

/// Build the exact registry used by the custom runtime. Production has system registrations only
/// until Character handlers arrive in their owning script modules. Feature-gated fixture
/// registrations are additive and never enter the default bundle.
pub(crate) fn action_registry() -> Result<ActionRegistry, CoreError> {
    #[allow(unused_mut)]
    let mut entries = system::registrations();
    #[cfg(feature = "custom-runtime-fixtures")]
    entries.extend(super::fixtures::registrations());
    ActionRegistry::new(entries)
}

fn validate_custom_event(
    event: &GameEvent,
    fact_changes: CustomFactChanges,
) -> Result<ValidatedCustomEvent, CoreError> {
    let GameEventKind::CustomActionConfirmed { payload } = &event.kind else {
        return Err(ErrorKind::EventNotSupportedByScript.into_error());
    };
    event::validate_custom_event_shape(event)?;
    Ok(ValidatedCustomEvent::new(
        event.clone(),
        payload.clone(),
        fact_changes,
    ))
}

/// Test setup may opt into fixture handlers without changing existing system-only scenarios. The
/// explicit opt-in mirrors the feature-gated generated-WASM build.
#[cfg(test)]
pub(crate) fn fixture_action_registry() -> Result<ActionRegistry, CoreError> {
    #[allow(unused_mut)]
    let mut entries = system::registrations();
    entries.extend(super::fixtures::registrations());
    ActionRegistry::new(entries)
}

/// Historical name retained for system-only callers while the composed builder is introduced. It
/// follows the feature flag, so production callers never gain fixture behavior accidentally.
pub(crate) fn system_action_registry() -> Result<ActionRegistry, CoreError> {
    action_registry()
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

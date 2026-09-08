//! Canonical event contracts for custom Character actions.
//!
//! The wire event is intentionally separate from the internal validated value.  A JSON payload
//! can be parsed into `CustomActionConfirmedPayload`, but only the custom runtime's common
//! validation boundary may construct a `ValidatedCustomEvent` for reducer/scheduler use.

use crate::{
    contracts::{
        ActiveImpairment, CustomActionConfirmedPayload, CustomActionResult, FirstNightActionRef,
        GameEvent, GameEventKind,
    },
    error::{CoreError, ErrorKind},
    model::{AbilityUseRef, Phase, PlayerIdentityTransition, StepInput},
};

/// Facts that a validated custom action may establish for the replay-derived facts aggregate.
///
/// This is deliberately a finite, typed collection.  It is an internal hand-off between the
/// validation boundary and the reducer; it is not a wire payload, a generic patch language, or a
/// command for changing cursor/progress state.  The fields remain private so only the validation
/// boundary can construct a trusted value in production.  Test-only constructors below let the
/// reducer contract tests exercise the same seam without making fixture outcomes part of the
/// production event schema.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub(crate) struct CustomFactChanges {
    identity_changes: Vec<PlayerIdentityTransition>,
    ability_grants: Vec<AbilityGrantChange>,
    ability_removals: Vec<AbilityUseRef>,
    life_changes: Vec<PlayerLifeChange>,
    impairment_additions: Vec<ActiveImpairment>,
    impairment_removals: Vec<ActiveImpairment>,
    snv: SnvFactChanges,
    audit: Vec<crate::state::MalfunctionEvidence>,
    preparation: bool,
    poisoner_choice: Option<crate::contracts::TargetAssignment>,
    master_choice: Option<crate::contracts::TargetAssignment>,
    game_end: Option<crate::contracts::CustomGameEnd>,
}

/// Finite facts calculated by an SnV resolver. These become trusted only after registry validation.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub(crate) struct SnvFactChanges {
    pub(crate) spent: Option<crate::contracts::AbilityUseRecord>,
    pub(crate) philosopher_choice: Option<crate::contracts::PhilosopherChoiceFact>,
    pub(crate) twin_relationship: Option<crate::contracts::TwinRelationship>,
    pub(crate) witch_curse: Option<crate::contracts::WitchCurse>,
    pub(crate) madness_assignment: Option<crate::contracts::MadnessAssignment>,
    pub(crate) durable_impairments: Vec<crate::state::DurableImpairment>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct AbilityGrantChange {
    pub(crate) owner_player_id: String,
    pub(crate) character_id: String,
    pub(crate) source: AbilityUseRef,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct PlayerLifeChange {
    pub(crate) player_id: String,
    pub(crate) alive: bool,
}

impl CustomFactChanges {
    pub(crate) fn with_audit(mut self, audit: Vec<crate::state::MalfunctionEvidence>) -> Self {
        self.audit = audit;
        self
    }
    pub(crate) fn audit(&self) -> &[crate::state::MalfunctionEvidence] {
        &self.audit
    }
    pub(crate) fn with_preparation(mut self) -> Self {
        self.preparation = true;
        self
    }
    pub(crate) fn preparation(&self) -> bool {
        self.preparation
    }
    pub(crate) fn with_poisoner(mut self, choice: crate::contracts::TargetAssignment) -> Self {
        self.poisoner_choice = Some(choice);
        self
    }
    pub(crate) fn poisoner_choice(&self) -> Option<&crate::contracts::TargetAssignment> {
        self.poisoner_choice.as_ref()
    }
    pub(crate) fn with_master(mut self, choice: crate::contracts::TargetAssignment) -> Self {
        self.master_choice = Some(choice);
        self
    }
    pub(crate) fn master_choice(&self) -> Option<&crate::contracts::TargetAssignment> {
        self.master_choice.as_ref()
    }
    pub(crate) fn with_execution(
        mut self,
        death: Option<PlayerLifeChange>,
        game_end: Option<crate::contracts::CustomGameEnd>,
    ) -> Self {
        self.life_changes = death.into_iter().collect();
        self.game_end = game_end;
        self
    }
    pub(crate) fn game_end(&self) -> Option<&crate::contracts::CustomGameEnd> {
        self.game_end.as_ref()
    }

    pub(crate) fn resolved(
        identity_changes: Vec<PlayerIdentityTransition>,
        ability_grants: Vec<AbilityGrantChange>,
        snv: SnvFactChanges,
    ) -> Self {
        Self {
            identity_changes,
            ability_grants,
            snv,
            ..Self::default()
        }
    }
    pub(crate) fn snv(&self) -> &SnvFactChanges {
        &self.snv
    }

    pub(crate) fn is_empty(&self) -> bool {
        self.audit.is_empty()
            && !self.preparation
            && self.poisoner_choice.is_none()
            && self.master_choice.is_none()
            && self.game_end.is_none()
            && self.identity_changes.is_empty()
            && self.ability_grants.is_empty()
            && self.ability_removals.is_empty()
            && self.life_changes.is_empty()
            && self.impairment_additions.is_empty()
            && self.impairment_removals.is_empty()
            && self.snv == SnvFactChanges::default()
    }

    pub(crate) fn identity_changes(&self) -> &[PlayerIdentityTransition] {
        &self.identity_changes
    }

    pub(crate) fn ability_grants(&self) -> &[AbilityGrantChange] {
        &self.ability_grants
    }

    pub(crate) fn ability_removals(&self) -> &[AbilityUseRef] {
        &self.ability_removals
    }

    pub(crate) fn life_changes(&self) -> &[PlayerLifeChange] {
        &self.life_changes
    }

    pub(crate) fn impairment_additions(&self) -> &[ActiveImpairment] {
        &self.impairment_additions
    }

    pub(crate) fn impairment_removals(&self) -> &[ActiveImpairment] {
        &self.impairment_removals
    }

    #[cfg(test)]
    pub(crate) fn test_identity_change(transition: PlayerIdentityTransition) -> Self {
        Self {
            identity_changes: vec![transition],
            ..Self::default()
        }
    }

    #[cfg(test)]
    pub(crate) fn test_ability_grant(change: AbilityGrantChange) -> Self {
        Self {
            ability_grants: vec![change],
            ..Self::default()
        }
    }

    /// Fixed state-changing fixture constructor.  It is compiled only for the contract tests and
    /// the dedicated fixture WASM bundle; production handlers cannot manufacture fixture facts.
    #[cfg(feature = "custom-runtime-fixtures")]
    pub(crate) fn fixture_ability_grant(change: AbilityGrantChange) -> Self {
        Self {
            ability_grants: vec![change],
            ..Self::default()
        }
    }

    /// Fixed identity transition constructor for the fixture WASM build.  The before/after
    /// values are still assembled by the handler from the preceding facts; callers cannot pass a
    /// generic patch through this seam.
    #[cfg(feature = "custom-runtime-fixtures")]
    pub(crate) fn fixture_identity_change(transition: PlayerIdentityTransition) -> Self {
        Self {
            identity_changes: vec![transition],
            ..Self::default()
        }
    }

    #[cfg(feature = "custom-runtime-fixtures")]
    pub(crate) fn fixture_ability_removal(ability_use: AbilityUseRef) -> Self {
        Self {
            ability_removals: vec![ability_use],
            ..Self::default()
        }
    }

    #[cfg(feature = "custom-runtime-fixtures")]
    pub(crate) fn fixture_life_change(change: PlayerLifeChange) -> Self {
        Self {
            life_changes: vec![change],
            ..Self::default()
        }
    }

    #[cfg(feature = "custom-runtime-fixtures")]
    pub(crate) fn fixture_impairment_addition(impairment: ActiveImpairment) -> Self {
        Self {
            impairment_additions: vec![impairment],
            ..Self::default()
        }
    }

    #[cfg(feature = "custom-runtime-fixtures")]
    pub(crate) fn fixture_impairment_removal(impairment: ActiveImpairment) -> Self {
        Self {
            impairment_removals: vec![impairment],
            ..Self::default()
        }
    }

    #[cfg(test)]
    pub(crate) fn test_ability_removal(ability_use: AbilityUseRef) -> Self {
        Self {
            ability_removals: vec![ability_use],
            ..Self::default()
        }
    }

    #[cfg(test)]
    pub(crate) fn test_life_change(change: PlayerLifeChange) -> Self {
        Self {
            life_changes: vec![change],
            ..Self::default()
        }
    }

    #[cfg(test)]
    pub(crate) fn test_impairment_addition(impairment: ActiveImpairment) -> Self {
        Self {
            impairment_additions: vec![impairment],
            ..Self::default()
        }
    }

    #[cfg(test)]
    pub(crate) fn test_impairment_removal(impairment: ActiveImpairment) -> Self {
        Self {
            impairment_removals: vec![impairment],
            ..Self::default()
        }
    }

    #[cfg(test)]
    pub(crate) fn test_with(
        identity_changes: Vec<PlayerIdentityTransition>,
        ability_grants: Vec<AbilityGrantChange>,
        ability_removals: Vec<AbilityUseRef>,
        life_changes: Vec<PlayerLifeChange>,
        impairment_additions: Vec<ActiveImpairment>,
        impairment_removals: Vec<ActiveImpairment>,
    ) -> Self {
        Self {
            identity_changes,
            ability_grants,
            ability_removals,
            life_changes,
            impairment_additions,
            impairment_removals,
            ..Self::default()
        }
    }
}

/// A canonical draft produced by a custom action handler before the event envelope is validated.
/// It remains an internal value and is never accepted directly from JSON.
#[derive(Debug, Clone)]
pub(crate) struct CustomActionEventDraft {
    pub(crate) step_id: String,
    pub(crate) action_ref: FirstNightActionRef,
    pub(crate) ability_use: Option<AbilityUseRef>,
    pub(crate) input: StepInput,
    pub(crate) result: CustomActionResult,
    pub(crate) simulation_source: Option<crate::contracts::PhilosopherSimulationSource>,
    pub(crate) follow_up_cause: Option<crate::contracts::FollowUpCause>,
    pub(crate) action_cause: Option<crate::contracts::ActionCause>,
    pub(crate) delivered_result: Option<crate::model::InformationResult>,
    pub(crate) registration_judgments: Vec<crate::model::RegistrationJudgment>,
}

impl CustomActionEventDraft {
    pub(crate) fn into_payload(self) -> CustomActionConfirmedPayload {
        CustomActionConfirmedPayload {
            simulation_source: self.simulation_source,
            follow_up_cause: self.follow_up_cause,
            action_cause: self.action_cause,
            delivered_result: self.delivered_result,
            registration_judgments: self.registration_judgments,
            step_id: self.step_id,
            action_ref: self.action_ref,
            ability_use: self.ability_use,
            input: self.input,
            result: self.result,
        }
    }
}

// `ValidatedCustomEvent` is owned by the registry module.  Keeping only this re-export here lets
// reducer/tests continue to use the event namespace while the private constructor remains outside
// all action-handler modules.  A wire value can be shaped here, but it cannot become trusted here.
pub(crate) use crate::first_night::ValidatedCustomEvent;

/// Check invariants that are intrinsic to the custom envelope itself.  This intentionally returns
/// no trusted event value: preceding-state, current-occurrence, membership, and action-specific
/// validation are required before a `ValidatedCustomEvent` can be constructed by the runtime.
pub(crate) fn validate_custom_event_shape(event: &GameEvent) -> Result<(), CoreError> {
    let GameEventKind::CustomActionConfirmed { payload } = &event.kind else {
        return Err(ErrorKind::EventNotSupportedByScript.into_error());
    };
    validate_envelope_fields(event.phase, payload)
}

fn validate_envelope_fields(
    phase: Phase,
    payload: &CustomActionConfirmedPayload,
) -> Result<(), CoreError> {
    if phase != Phase::FirstNight
        || !matches!(payload.action_ref, FirstNightActionRef::Character { .. })
    {
        return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
    }
    let simulation_result = matches!(
        payload.result,
        CustomActionResult::Simulation { .. } | CustomActionResult::SimulationChoice { .. }
    );
    if (simulation_result && payload.simulation_source.is_none())
        || (payload.simulation_source.is_some()
            && !simulation_result
            && !matches!(
                payload.result,
                CustomActionResult::InformationPrepared { .. }
                    | CustomActionResult::PreparedInformationDelivered { .. }
            ))
    {
        return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
    }
    let _occurrence = crate::state::ActionOccurrence::from_all_parts(
        payload.action_ref.clone(),
        payload.ability_use.clone(),
        payload.simulation_source.clone(),
        payload.follow_up_cause.clone(),
        payload.action_cause.clone(),
    )?;
    if payload.step_id.trim().is_empty() {
        return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
    }
    Ok(())
}

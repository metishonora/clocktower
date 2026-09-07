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
    pub(crate) fn is_empty(&self) -> bool {
        self.identity_changes.is_empty()
            && self.ability_grants.is_empty()
            && self.ability_removals.is_empty()
            && self.life_changes.is_empty()
            && self.impairment_additions.is_empty()
            && self.impairment_removals.is_empty()
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
        }
    }
}

/// A canonical draft produced by a custom action handler before the event envelope is validated.
/// It remains an internal value and is never accepted directly from JSON.
#[derive(Debug, Clone)]
pub(crate) struct CustomActionEventDraft {
    pub(crate) step_id: String,
    pub(crate) action_ref: FirstNightActionRef,
    pub(crate) ability_use: AbilityUseRef,
    pub(crate) input: StepInput,
    pub(crate) result: CustomActionResult,
}

impl CustomActionEventDraft {
    pub(crate) fn into_payload(self) -> CustomActionConfirmedPayload {
        CustomActionConfirmedPayload {
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
pub(crate) use crate::custom::first_night::ValidatedCustomEvent;

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
        || payload.step_id.trim().is_empty()
        || !matches!(payload.action_ref, FirstNightActionRef::Character { .. })
        || payload.ability_use.owner_player_id.trim().is_empty()
        || payload.ability_use.character_id.trim().is_empty()
        || payload
            .ability_use
            .ability_instance_id
            .as_str()
            .trim()
            .is_empty()
    {
        return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
    }
    let FirstNightActionRef::Character { character_id, .. } = &payload.action_ref else {
        unreachable!("custom event action refs are Character refs")
    };
    if character_id != &payload.ability_use.character_id {
        return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
    }
    Ok(())
}

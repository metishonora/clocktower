//! Replay-derived state used by the custom first-night runtime.
//!
//! These types deliberately do not implement `Serialize` or `Deserialize`.  A custom game is
//! reconstructed from its definition snapshot and confirmed event prefix; the facts and progress
//! below are an in-memory aggregate for one replay calculation.

use crate::{
    contracts::{ActiveImpairment, FirstNightActionRef, RevealPayload},
    model::{AbilityGrant, AbilityOrigin, AbilityUseRef, Phase, PhaseStep, Player},
};

/// The facts that can be observed by custom rules while a confirmed event prefix is replayed.
///
/// A Player owns the current identity-bound ability instance.  Acquired instances and temporary
/// impairments are kept separately so a Character change cannot accidentally rewrite an acquired
/// ability or an impairment's provenance.
#[derive(Debug, Default, Clone)]
pub(crate) struct CustomGameFacts {
    pub(crate) players: Vec<Player>,
    pub(crate) ability_grants: Vec<AbilityGrant>,
    pub(crate) active_impairments: Vec<ActiveImpairment>,
    /// Internal provenance ledger for current and historical ability instances.  `AbilityGrant`
    /// remains the existing public projection; this ledger retains the exact source use so a grant
    /// can still be explained after its source Player changes identity.
    pub(crate) ability_provenance: Vec<AbilityProvenance>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct AbilityProvenance {
    pub(crate) ability_use: AbilityUseRef,
    pub(crate) origin: AbilityOrigin,
}

impl CustomGameFacts {
    pub(crate) fn from_players(players: Vec<Player>) -> Self {
        let ability_provenance = players
            .iter()
            .map(|player| AbilityProvenance {
                ability_use: AbilityUseRef {
                    owner_player_id: player.id.clone(),
                    character_id: player.actual_character.clone(),
                    ability_instance_id: player.ability_instance.id.clone(),
                },
                origin: AbilityOrigin::IdentityBound,
            })
            .collect();
        Self {
            players,
            ability_grants: Vec::new(),
            active_impairments: Vec::new(),
            ability_provenance,
        }
    }

    pub(crate) fn with_players_and_facts(
        players: Vec<Player>,
        ability_grants: Vec<AbilityGrant>,
        active_impairments: Vec<ActiveImpairment>,
        ability_provenance: Vec<AbilityProvenance>,
    ) -> Self {
        Self {
            players,
            ability_grants,
            active_impairments,
            ability_provenance,
        }
    }

    pub(crate) fn player(&self, player_id: &str) -> Option<&Player> {
        self.players.iter().find(|player| player.id == player_id)
    }
}

/// A concrete first-night action identity.
///
/// The action definition alone is not enough to identify a completion: two Players or two
/// ability instances may use the same action.  System actions intentionally have no owner or
/// ability instance.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ActionOccurrence {
    pub(crate) action_ref: FirstNightActionRef,
    pub(crate) ability_use: Option<AbilityUseRef>,
}

impl ActionOccurrence {
    /// Reconstruct the occurrence identity projected by a public first-night step.  The step ID
    /// is checked against the identity-derived value so callers cannot substitute a cursor or
    /// arbitrary display ID for the actor/instance provenance.
    pub(crate) fn from_step(step: &PhaseStep) -> Result<Self, crate::error::CoreError> {
        let action_ref = step.action_ref.clone().ok_or_else(|| {
            crate::error::ErrorKind::InvalidFirstNightActionProvenance.into_error()
        })?;
        let occurrence = match action_ref {
            FirstNightActionRef::System { .. } => Self::system(action_ref)?,
            action_ref @ FirstNightActionRef::Character { .. } => Self::character(
                action_ref,
                step.ability_use.clone().ok_or_else(|| {
                    crate::error::ErrorKind::InvalidFirstNightActionProvenance.into_error()
                })?,
            )?,
        };
        if occurrence.step_id()? != step.id {
            return Err(crate::error::ErrorKind::InvalidFirstNightActionProvenance.into_error());
        }
        Ok(occurrence)
    }

    pub(crate) fn system(action_ref: FirstNightActionRef) -> Result<Self, crate::error::CoreError> {
        if !matches!(
            action_ref,
            FirstNightActionRef::System {
                action_id: crate::contracts::SystemFirstNightActionId::Dusk
                    | crate::contracts::SystemFirstNightActionId::MinionInfo
                    | crate::contracts::SystemFirstNightActionId::DemonInfo
                    | crate::contracts::SystemFirstNightActionId::Dawn
            }
        ) {
            return Err(crate::error::ErrorKind::InvalidFirstNightActionProvenance.into_error());
        }
        Ok(Self {
            action_ref,
            ability_use: None,
        })
    }

    pub(crate) fn character(
        action_ref: FirstNightActionRef,
        ability_use: AbilityUseRef,
    ) -> Result<Self, crate::error::CoreError> {
        let FirstNightActionRef::Character { character_id, .. } = &action_ref else {
            return Err(crate::error::ErrorKind::InvalidFirstNightActionProvenance.into_error());
        };
        if character_id != &ability_use.character_id
            || ability_use.owner_player_id.trim().is_empty()
            || ability_use.ability_instance_id.as_str().trim().is_empty()
        {
            return Err(crate::error::ErrorKind::InvalidFirstNightActionProvenance.into_error());
        }
        Ok(Self {
            action_ref,
            ability_use: Some(ability_use),
        })
    }

    pub(crate) fn actor_player_id(&self) -> Option<&str> {
        self.ability_use
            .as_ref()
            .map(|ability_use| ability_use.owner_player_id.as_str())
    }

    /// Stable identity used by completion and queue de-duplication.
    pub(crate) fn identity(&self) -> ActionOccurrenceIdentity {
        ActionOccurrenceIdentity {
            action_ref: self.action_ref.clone(),
            ability_use: self.ability_use.clone(),
        }
    }

    /// Derive the public first-night Step ID from this occurrence's identity.
    ///
    /// The exact action reference and ability instance are retained in the occurrence even when a
    /// caller only needs the Step ID.  This keeps Step IDs a projection rather than a source of
    /// truth for facts or progress.
    pub(crate) fn step_id(&self) -> Result<String, crate::error::CoreError> {
        match (&self.action_ref, &self.ability_use) {
            (FirstNightActionRef::System { action_id }, None) => Ok(format!(
                "firstNight:system:{}",
                system_action_id(action_id)?
            )),
            (
                FirstNightActionRef::Character {
                    character_id,
                    action_id,
                },
                Some(ability_use),
            ) => Ok(format!(
                "firstNight:{character_id}:{action_id}:owner{}:{}:instance{}:{}",
                ability_use.owner_player_id.len(),
                ability_use.owner_player_id,
                ability_use.ability_instance_id.as_str().len(),
                ability_use.ability_instance_id.as_str(),
            )),
            _ => Err(crate::error::ErrorKind::InvalidFirstNightActionProvenance.into_error()),
        }
    }
}

/// The identity portion of an Action occurrence.  It is independent of a projected Step's
/// wording or required input, and is therefore safe to use as a completion key.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ActionOccurrenceIdentity {
    pub(crate) action_ref: FirstNightActionRef,
    pub(crate) ability_use: Option<AbilityUseRef>,
}

pub(crate) type ActionOccurrenceKey = ActionOccurrenceIdentity;

/// The projection captured at the point an occurrence was confirmed.
///
/// The wire event remains the source of truth for replay.  This snapshot only exists while one
/// replay is running so a later identity/ability change cannot make a completed overview row use a
/// different Step or overwrite a system information Reveal with newer facts.
#[derive(Debug, Clone)]
pub(crate) struct CompletedActionSnapshot {
    pub(crate) step: PhaseStep,
    pub(crate) reveal_payload: Option<RevealPayload>,
}

/// A completed occurrence retained for replay-derived overview/history output.  The event ID and
/// confirmed Step ID are kept together with the occurrence so later fact changes cannot cause a
/// completed row to be reinterpreted as another instance.  `snapshot` is deliberately internal and
/// is never serialized into a GameFile or public DTO.
#[derive(Debug, Clone)]
pub(crate) struct CompletedActionOccurrence {
    pub(crate) occurrence: ActionOccurrence,
    pub(crate) event_id: String,
    pub(crate) step_id: String,
    pub(crate) snapshot: Option<CompletedActionSnapshot>,
}

// PhaseStep and RevealPayload are output-only models and intentionally do not derive equality.
// Progress still needs value equality for the pure scheduler contract tests, so compare snapshots
// through their canonical serialized values without making those public models part of the
// internal state contract.
impl PartialEq for CompletedActionOccurrence {
    fn eq(&self, other: &Self) -> bool {
        self.occurrence == other.occurrence
            && self.event_id == other.event_id
            && self.step_id == other.step_id
            && snapshot_eq(self.snapshot.as_ref(), other.snapshot.as_ref())
    }
}

impl Eq for CompletedActionOccurrence {}

fn snapshot_eq(
    left: Option<&CompletedActionSnapshot>,
    right: Option<&CompletedActionSnapshot>,
) -> bool {
    match (left, right) {
        (None, None) => true,
        (Some(left), Some(right)) => {
            serde_json::to_value(&left.step).ok() == serde_json::to_value(&right.step).ok()
                && serde_json::to_value(&left.reveal_payload).ok()
                    == serde_json::to_value(&right.reveal_payload).ok()
        }
        _ => false,
    }
}

pub(crate) type ActionCompletion = CompletedActionOccurrence;

/// First-night progress reconstructed from the same event prefix as `CustomGameFacts`.
///
/// The legacy runtime currently has a smaller progress type in `first_night/runtime.rs`; this
/// state-owned scaffold is intentionally separate until that runtime is migrated.  No field is a
/// persistence contract.
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub(crate) struct FirstNightProgress {
    pub(crate) cursor: usize,
    pub(crate) current_occurrences: Vec<ActionOccurrence>,
    pub(crate) completed_occurrences: Vec<ActionOccurrenceIdentity>,
    pub(crate) immediate_queue: Vec<ActionOccurrence>,
    pub(crate) completed_history: Vec<CompletedActionOccurrence>,
    /// Occurrences explicitly rejected by an activation rule for this night.  Keeping these keys
    /// separate from completion history prevents a later projection from re-admitting a
    /// `Defer`/`NoAction` instance while preserving the meaning of completed rows.
    pub(crate) excluded_occurrences: Vec<ActionOccurrenceIdentity>,
    pub(crate) ended: bool,
}

impl FirstNightProgress {
    pub(crate) fn is_completed(&self, occurrence: &ActionOccurrence) -> bool {
        self.completed_occurrences.contains(&occurrence.identity())
    }

    pub(crate) fn is_excluded(&self, occurrence: &ActionOccurrence) -> bool {
        self.excluded_occurrences.contains(&occurrence.identity())
    }

    pub(crate) fn is_terminal(&self, occurrence: &ActionOccurrence) -> bool {
        self.is_completed(occurrence) || self.is_excluded(occurrence)
    }

    /// Return the next occurrence to expose to a caller.  Immediate work always precedes the
    /// current ordered entry, while the ordered cursor itself never moves backwards.
    pub(crate) fn next_occurrence(&self) -> Option<&ActionOccurrence> {
        self.immediate_queue
            .first()
            .or_else(|| self.current_occurrences.first())
    }
}

/// A coherent, replay-derived custom state aggregate.  Facts and progress are calculated from the
/// same confirmed prefix and are adopted together by runtime orchestration.
#[derive(Debug, Clone)]
pub(crate) struct CustomGameState {
    pub(crate) phase: Phase,
    pub(crate) facts: CustomGameFacts,
    pub(crate) progress: FirstNightProgress,
}

impl Default for CustomGameState {
    fn default() -> Self {
        Self {
            phase: Phase::Setup,
            facts: CustomGameFacts::default(),
            progress: FirstNightProgress::default(),
        }
    }
}

impl CustomGameState {
    pub(crate) fn new(facts: CustomGameFacts) -> Self {
        Self {
            phase: Phase::Setup,
            facts,
            progress: FirstNightProgress::default(),
        }
    }

    pub(crate) fn with_first_night(facts: CustomGameFacts, progress: FirstNightProgress) -> Self {
        Self {
            phase: Phase::FirstNight,
            facts,
            progress,
        }
    }
}

fn system_action_id(
    action_id: &crate::contracts::SystemFirstNightActionId,
) -> Result<&'static str, crate::error::CoreError> {
    use crate::contracts::SystemFirstNightActionId;

    match action_id {
        SystemFirstNightActionId::Dusk => Ok("dusk"),
        SystemFirstNightActionId::MinionInfo => Ok("minionInfo"),
        SystemFirstNightActionId::DemonInfo => Ok("demonInfo"),
        SystemFirstNightActionId::Dawn => Ok("dawn"),
        SystemFirstNightActionId::Unknown => {
            Err(crate::error::ErrorKind::InvalidFirstNightActionProvenance.into_error())
        }
    }
}

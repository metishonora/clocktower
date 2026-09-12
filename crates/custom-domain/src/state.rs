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
    pub(crate) prefix_event_id: String,
    pub(crate) poisoner_choices: Vec<crate::contracts::TargetAssignment>,
    pub(crate) master_choices: Vec<crate::contracts::TargetAssignment>,
    pub(crate) preparations: Vec<ConfirmedActionFact>,
    pub(crate) game_end: Option<crate::contracts::CustomGameEnd>,
    pub(crate) players: Vec<Player>,
    pub(crate) ability_grants: Vec<AbilityGrant>,
    pub(crate) active_impairments: Vec<ActiveImpairment>,
    /// Internal provenance ledger for current and historical ability instances.  `AbilityGrant`
    /// remains the existing public projection; this ledger retains the exact source use so a grant
    /// can still be explained after its source Player changes identity.
    pub(crate) ability_provenance: Vec<AbilityProvenance>,
    pub(crate) ability_uses: Vec<crate::contracts::AbilityUseRecord>,
    pub(crate) philosopher_choices: Vec<crate::contracts::PhilosopherChoiceFact>,
    pub(crate) twin_relationships: Vec<crate::contracts::TwinRelationship>,
    pub(crate) witch_curses: Vec<crate::contracts::WitchCurse>,
    pub(crate) madness_assignments: Vec<crate::contracts::MadnessAssignment>,
    pub(crate) durable_impairments: Vec<DurableImpairment>,
    pub(crate) confirmed_actions: Vec<ConfirmedActionFact>,
    pub(crate) malfunction_audit: Vec<MalfunctionEvidence>,
    pub(crate) pending_identity_reveals: Vec<crate::contracts::PendingIdentityReveal>,
    pub(crate) vortox_sources: Vec<AbilityUseRef>,
    pub(crate) resolved_impairments: Vec<DurableImpairment>,
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
            ..Self::default()
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
            ..Self::default()
        }
    }

    pub(crate) fn player(&self, player_id: &str) -> Option<&Player> {
        self.players.iter().find(|player| player.id == player_id)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct DurableImpairment {
    pub(crate) impairment: ActiveImpairment,
    pub(crate) source_ability_use: AbilityUseRef,
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ConfirmedActionFact {
    pub(crate) registration_judgments: Vec<crate::model::RegistrationJudgment>,
    pub(crate) event_id: String,
    pub(crate) occurrence: ActionOccurrence,
    pub(crate) result: crate::contracts::CustomActionResult,
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum MalfunctionOutcome {
    IncorrectInformation {
        delivered_result: crate::model::InformationResult,
    },
    EffectFailure {
        effect: FailedEffect,
    },
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum FailedEffect {
    PoisonerPoison,
    ButlerMaster,
    MutantExecution,
    PhilosopherAcquisition,
    SnakeCharmerSwap,
    WitchCurse,
    CerenovusMadness,
    EvilTwinRelationship,
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct MalfunctionEvidence {
    pub(crate) cause_details: Vec<crate::model::DeliveryReason>,
    pub(crate) event_id: String,
    pub(crate) occurrence: ActionOccurrence,
    pub(crate) subject_player_id: String,
    pub(crate) outcome: MalfunctionOutcome,
    pub(crate) causes: Vec<AbilityUseRef>,
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
    pub(crate) simulation_source: Option<crate::contracts::PhilosopherSimulationSource>,
    pub(crate) follow_up_cause: Option<crate::contracts::FollowUpCause>,
    pub(crate) action_cause: Option<crate::contracts::ActionCause>,
}

/// One concrete source. Public DTOs preserve the legacy actual-ability field.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum ActionSource {
    ActualAbility(AbilityUseRef),
    PhilosopherSimulation(crate::contracts::PhilosopherSimulationSource),
}

impl ActionOccurrence {
    pub(crate) fn from_step(step: &PhaseStep) -> Result<Self, crate::error::CoreError> {
        let occurrence = Self::from_all_parts(
            step.action_ref.clone().ok_or_else(invalid_occurrence)?,
            step.ability_use.clone(),
            step.simulation_source.clone(),
            step.follow_up_cause.clone(),
            step.action_cause.clone(),
        )?;
        if occurrence.step_id()? != step.id {
            return Err(invalid_occurrence());
        }
        Ok(occurrence)
    }

    pub(crate) fn from_parts(
        action_ref: FirstNightActionRef,
        ability_use: Option<AbilityUseRef>,
        simulation_source: Option<crate::contracts::PhilosopherSimulationSource>,
        follow_up_cause: Option<crate::contracts::FollowUpCause>,
    ) -> Result<Self, crate::error::CoreError> {
        Self::from_all_parts(
            action_ref,
            ability_use,
            simulation_source,
            follow_up_cause,
            None,
        )
    }

    pub(crate) fn from_all_parts(
        action_ref: FirstNightActionRef,
        ability_use: Option<AbilityUseRef>,
        simulation_source: Option<crate::contracts::PhilosopherSimulationSource>,
        follow_up_cause: Option<crate::contracts::FollowUpCause>,
        action_cause: Option<crate::contracts::ActionCause>,
    ) -> Result<Self, crate::error::CoreError> {
        let value = Self {
            action_ref,
            ability_use,
            simulation_source,
            follow_up_cause,
            action_cause,
        };
        match (
            &value.action_ref,
            &value.ability_use,
            &value.simulation_source,
        ) {
            (FirstNightActionRef::System { action_id }, None, None) => {
                system_action_id(action_id)?;
                if value.follow_up_cause.is_some() || value.action_cause.is_some() {
                    return Err(invalid_occurrence());
                }
            }
            (FirstNightActionRef::Character { character_id, .. }, Some(source), None)
                if character_id == &source.character_id && valid_source(source) => {}
            (FirstNightActionRef::Character { .. }, None, Some(source))
                if (source.source_ability_use.character_id == "philosopher"
                    || (source.guidance.is_some()
                        && source.source_ability_use.character_id == "drunk"))
                    && valid_source(&source.source_ability_use)
                    && !source.selection_event_id.trim().is_empty() => {}
            _ => return Err(invalid_occurrence()),
        }
        if let Some(cause) = &value.follow_up_cause {
            if cause.trigger_event_id.trim().is_empty()
                || cause.relationship_event_id.trim().is_empty()
                || !matches!(&value.action_ref, FirstNightActionRef::Character { character_id, .. } if character_id == "evilTwin")
                || value.simulation_source.is_some()
            {
                return Err(invalid_occurrence());
            }
        }
        if value.action_cause.is_some() && value.follow_up_cause.is_some() {
            return Err(invalid_occurrence());
        }
        if let Some(cause) = &value.action_cause {
            use crate::contracts::ActionCause;
            let valid = match cause {
                ActionCause::InitialPreparation { source_event_id } => {
                    !source_event_id.trim().is_empty()
                }
                ActionCause::RequiredPreparation {
                    trigger_event_id,
                    previous_preparation_event_id,
                } => {
                    !trigger_event_id.trim().is_empty()
                        && previous_preparation_event_id
                            .as_ref()
                            .is_none_or(|id| !id.trim().is_empty())
                }
                ActionCause::Delivery {
                    preparation_event_id,
                } => !preparation_event_id.trim().is_empty(),
                ActionCause::Optional { prefix_event_id } => !prefix_event_id.trim().is_empty(),
            };
            if !valid {
                return Err(invalid_occurrence());
            }
        }
        if let Some(source) = &value.simulation_source {
            use crate::contracts::GuidanceCause;
            let valid = match &source.guidance {
                None => source.source_ability_use.character_id == "philosopher",
                Some(GuidanceCause::InitialDrunk | GuidanceCause::AcquiredDrunk) => {
                    source.source_ability_use.character_id == "drunk"
                }
                Some(GuidanceCause::Choice { parent_event_id }) => {
                    !parent_event_id.trim().is_empty()
                }
            };
            if !valid {
                return Err(invalid_occurrence());
            }
        }
        Ok(value)
    }

    pub(crate) fn system(action_ref: FirstNightActionRef) -> Result<Self, crate::error::CoreError> {
        if !matches!(action_ref, FirstNightActionRef::System { .. }) {
            return Err(invalid_occurrence());
        }
        Self::from_parts(action_ref, None, None, None)
    }

    pub(crate) fn character(
        action_ref: FirstNightActionRef,
        ability_use: AbilityUseRef,
    ) -> Result<Self, crate::error::CoreError> {
        Self::from_parts(action_ref, Some(ability_use), None, None)
    }

    pub(crate) fn source(&self) -> Option<ActionSource> {
        self.ability_use
            .clone()
            .map(ActionSource::ActualAbility)
            .or_else(|| {
                self.simulation_source
                    .clone()
                    .map(ActionSource::PhilosopherSimulation)
            })
    }

    pub(crate) fn actor_player_id(&self) -> Option<&str> {
        self.ability_use
            .as_ref()
            .map(|source| source.owner_player_id.as_str())
            .or_else(|| {
                self.simulation_source
                    .as_ref()
                    .map(|source| source.source_ability_use.owner_player_id.as_str())
            })
    }

    pub(crate) fn identity(&self) -> ActionOccurrenceIdentity {
        ActionOccurrenceIdentity {
            action_ref: self.action_ref.clone(),
            ability_use: self.ability_use.clone(),
            simulation_source: self.simulation_source.clone(),
            follow_up_cause: self.follow_up_cause.clone(),
            action_cause: self.action_cause.clone(),
        }
    }

    pub(crate) fn step_id(&self) -> Result<String, crate::error::CoreError> {
        let mut id = match (&self.action_ref, &self.ability_use, &self.simulation_source) {
            (FirstNightActionRef::System { action_id }, None, None) => {
                format!("firstNight:system:{}", system_action_id(action_id)?)
            }
            (
                FirstNightActionRef::Character {
                    character_id,
                    action_id,
                },
                Some(source),
                None,
            ) => format!(
                "firstNight:{character_id}:{action_id}:owner{}:{}:instance{}:{}",
                source.owner_player_id.len(),
                source.owner_player_id,
                source.ability_instance_id.as_str().len(),
                source.ability_instance_id.as_str()
            ),
            (
                FirstNightActionRef::Character {
                    character_id,
                    action_id,
                },
                None,
                Some(source),
            ) => format!(
                "firstNight:{character_id}:{action_id}:simulation{}{}{}",
                encode_part(&source.selection_event_id),
                encode_part(&source.source_ability_use.owner_player_id),
                encode_part(source.source_ability_use.ability_instance_id.as_str())
            ),
            _ => return Err(invalid_occurrence()),
        };
        if let Some(cause) = &self.follow_up_cause {
            id.push_str(&format!(
                ":followUp{}{}",
                encode_part(&cause.trigger_event_id),
                encode_part(&cause.relationship_event_id)
            ));
        }
        if let Some(cause) = &self.action_cause {
            if self.follow_up_cause.is_some() {
                return Err(invalid_occurrence());
            }
            id.push_str(":cause");
            id.push_str(&encode_part(
                &serde_json::to_string(cause).map_err(|_| invalid_occurrence())?,
            ));
        }
        Ok(id)
    }
}

fn encode_part(value: &str) -> String {
    format!("{}:{value}", value.len())
}
fn valid_source(source: &AbilityUseRef) -> bool {
    !source.owner_player_id.trim().is_empty()
        && !source.character_id.trim().is_empty()
        && !source.ability_instance_id.as_str().trim().is_empty()
}
fn invalid_occurrence() -> crate::error::CoreError {
    crate::error::ErrorKind::InvalidFirstNightActionProvenance.into_error()
}

/// The identity portion of an Action occurrence.  It is independent of a projected Step's
/// wording or required input, and is therefore safe to use as a completion key.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ActionOccurrenceIdentity {
    pub(crate) action_ref: FirstNightActionRef,
    pub(crate) ability_use: Option<AbilityUseRef>,
    pub(crate) simulation_source: Option<crate::contracts::PhilosopherSimulationSource>,
    pub(crate) follow_up_cause: Option<crate::contracts::FollowUpCause>,
    pub(crate) action_cause: Option<crate::contracts::ActionCause>,
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
    pub(crate) immediate_origins: Vec<(ActionOccurrenceIdentity, String)>,
    pub(crate) required_queue: Vec<ActionOccurrence>,
    pub(crate) available_occurrences: Vec<ActionOccurrence>,
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
        self.required_queue
            .first()
            .or_else(|| self.immediate_queue.first())
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

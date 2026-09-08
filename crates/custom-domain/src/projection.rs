//! Public custom-game projections derived from the replay aggregate.
//!
//! Projection deliberately receives facts and first-night progress as separate read-only values.
//! It never feeds a displayed Step or RuleState back into replay, and it keeps completion snapshots
//! tied to the prefix in which their events were confirmed.

use crate::{
    characters::ResolvedScriptContext,
    contracts::{
        FirstNightActionRef, FirstNightOrderPlan, RevealIdentity, RevealPayload, RuleState,
    },
    error::{CoreError, ErrorKind},
    first_night::{project_pending_steps, ActionContext, ActionRegistry},
    model::{CharacterKind, PhaseOverviewItem, PhaseStep, PhaseStepStatus, StepInput},
    state::{CustomGameFacts, FirstNightProgress},
};

/// The public first-night values calculated from one coherent facts/progress prefix.
#[derive(Debug)]
pub(crate) struct FirstNightProjection {
    pub(crate) current_step: Option<PhaseStep>,
    pub(crate) phase_overview: Vec<PhaseOverviewItem>,
}

/// Project actual custom facts into the existing public RuleState shape. Fields for rules that are
/// not part of the custom runtime remain at their established empty values.
pub(crate) fn rule_state(facts: &CustomGameFacts) -> RuleState {
    let mut state = RuleState::default();
    if !facts.active_impairments.is_empty() {
        state.active_impairments = Some(facts.active_impairments.clone());
    }
    if !facts.ability_grants.is_empty() {
        state.ability_grants = Some(facts.ability_grants.clone());
    }
    state.ability_uses = facts.ability_uses.clone();
    state.philosopher_choices = facts.philosopher_choices.clone();
    state.witch_curses = facts.witch_curses.clone();
    state.twin_relationships = facts.twin_relationships.clone();
    state
}

/// Build the current Step and overview from the same scheduler eligibility helper used by the
/// runtime fold. Completed rows use their replay-time snapshot; only pending rows are projected
/// from current facts.
pub(crate) fn first_night(
    plan: &FirstNightOrderPlan,
    registry: &ActionRegistry,
    context: &ActionContext<'_>,
    progress: &FirstNightProgress,
) -> Result<FirstNightProjection, CoreError> {
    let pending = project_pending_steps(plan, registry, context, progress)?;
    let next_identity = progress
        .next_occurrence()
        .map(|occurrence| occurrence.identity());
    let current_step = match progress.next_occurrence() {
        Some(next) => pending
            .iter()
            .find(|projected| projected.occurrence.identity() == next.identity())
            .map(|projected| projected.step.clone())
            .ok_or_else(|| ErrorKind::InvalidFirstNightActionProvenance.into_error())
            .map(Some)?,
        None => None,
    };

    let mut rows = Vec::new();
    for (sequence, completion) in progress.completed_history.iter().enumerate() {
        let snapshot = completion
            .snapshot
            .as_ref()
            .ok_or_else(|| ErrorKind::InvalidFirstNightActionProvenance.into_error())?;
        let entry_index = plan
            .0
            .iter()
            .position(|action_ref| Some(action_ref) == snapshot.step.action_ref.as_ref())
            .ok_or_else(|| ErrorKind::InvalidFirstNightActionProvenance.into_error())?;
        rows.push(OverviewRow {
            entry_index,
            sequence,
            pending: false,
            step: snapshot.step.clone(),
            status: PhaseStepStatus::Complete,
        });
    }

    for (sequence, projected) in pending.into_iter().enumerate() {
        let entry_index = plan
            .0
            .iter()
            .position(|action_ref| *action_ref == projected.occurrence.action_ref)
            .ok_or_else(|| ErrorKind::InvalidFirstNightActionProvenance.into_error())?;
        let status = if next_identity
            .as_ref()
            .is_some_and(|identity| *identity == projected.occurrence.identity())
        {
            PhaseStepStatus::Current
        } else {
            PhaseStepStatus::Waiting
        };
        rows.push(OverviewRow {
            entry_index,
            sequence,
            pending: true,
            step: projected.step,
            status,
        });
    }

    rows.sort_by(|left, right| {
        left.entry_index
            .cmp(&right.entry_index)
            .then_with(|| left.pending.cmp(&right.pending))
            .then_with(|| left.sequence.cmp(&right.sequence))
    });
    Ok(FirstNightProjection {
        current_step,
        phase_overview: rows
            .into_iter()
            .map(|row| overview(row.step, row.status))
            .collect(),
    })
}

/// Assemble the safe Reveal payload for a system information action. The caller supplies facts
/// from immediately before the confirmation, so a later identity change cannot rewrite a prior
/// completed meaning.
pub(crate) fn system_reveal(
    action_ref: &FirstNightActionRef,
    facts: &CustomGameFacts,
    context: &ResolvedScriptContext,
    input: &StepInput,
) -> Option<RevealPayload> {
    let identities = |kind: CharacterKind| {
        let mut values = facts
            .players
            .iter()
            .filter(|player| context.character_kind(&player.actual_character) == Some(kind))
            .map(|player| RevealIdentity {
                seat: player.seat,
                name: player.name.clone(),
            })
            .collect::<Vec<_>>();
        values.sort_by_key(|player| player.seat);
        values
    };
    match action_ref {
        FirstNightActionRef::System {
            action_id: crate::contracts::SystemFirstNightActionId::MinionInfo,
        } => Some(RevealPayload::MinionInformation {
            kind: "minionInformation",
            demon_players: identities(CharacterKind::Demon),
            minion_players: identities(CharacterKind::Minion),
        }),
        FirstNightActionRef::System {
            action_id: crate::contracts::SystemFirstNightActionId::DemonInfo,
        } => Some(RevealPayload::DemonInformation {
            kind: "demonInformation",
            minion_players: identities(CharacterKind::Minion),
            bluff_character_ids: input
                .as_ref()
                .and_then(|value| value.character_ids.clone())
                .unwrap_or_default(),
        }),
        _ => None,
    }
}

/// Project a typed custom information result into the existing generic Reveal DTOs.  This keeps
/// the fixture/runtime bridge independent of Character-specific message rules: a numeric result
/// carries only its action's declared Character ID and value, while unsupported result shapes
/// simply have no generic public Reveal projection.
pub(crate) fn custom_information_reveal(
    action_ref: &FirstNightActionRef,
    result: &crate::model::InformationResult,
) -> Option<RevealPayload> {
    let FirstNightActionRef::Character { character_id, .. } = action_ref else {
        return None;
    };
    match result {
        crate::model::InformationResult::Number { value } => {
            Some(RevealPayload::NumericInformation {
                kind: "numericInformation",
                character_id: character_id.clone(),
                value: *value,
            })
        }
        crate::model::InformationResult::CharacterPair { character_ids } => {
            Some(RevealPayload::DreamerInformation {
                kind: "dreamerInformation",
                character_ids: character_ids.clone(),
            })
        }
        _ => None,
    }
}

/// Select the Reveal projection for one already validated event.  System events use the
/// pre-event fact view; custom information results use the generic typed-result mapping above.
/// Keeping this choice here means proposal and replay snapshots cannot drift in how they expose
/// the same event.
pub(crate) fn event_reveal(
    action_ref: &FirstNightActionRef,
    facts: &CustomGameFacts,
    context: &ResolvedScriptContext,
    input: &StepInput,
    custom_result: Option<&crate::contracts::CustomActionResult>,
) -> Option<RevealPayload> {
    match custom_result {
        Some(crate::contracts::CustomActionResult::Information { value }) => {
            custom_information_reveal(action_ref, value)
        }
        Some(_) => None,
        None => system_reveal(action_ref, facts, context, input),
    }
}

fn overview(step: PhaseStep, status: PhaseStepStatus) -> PhaseOverviewItem {
    PhaseOverviewItem {
        simulation_source: step.simulation_source.clone(),
        follow_up_cause: step.follow_up_cause.clone(),
        id: step.id,
        phase: step.phase,
        step_type: step.step_type,
        character: step.character,
        player_id: step.player_id,
        ability_use: step.ability_use,
        ability_origin: step.ability_origin,
        required_input: step.required_input,
        can_skip: step.can_skip,
        support: step.support,
        information_prompt: step.information_prompt,
        action_ref: step.action_ref,
        status,
    }
}

struct OverviewRow {
    entry_index: usize,
    sequence: usize,
    pending: bool,
    step: PhaseStep,
    status: PhaseStepStatus,
}

use std::collections::{HashMap, HashSet};

use crate::{
    contracts::{GameEvent, GameEventKind},
    error::{CoreError, ErrorKind},
    model::{
        ConfirmedExecution, DayState, ExecutionCandidate, InputTarget, NominationRecord,
        NominationVoteInput, Phase, PhaseStep, PhaseStepStatus, Player, RequiredInput,
        RequiredInputKind, StepInput, StepType,
    },
    phase::{phase_prefix, phase_transition_step, required_none, simple_step, step_status},
};

pub(crate) fn day_steps(
    cycle: usize,
    statuses: &HashMap<String, PhaseStepStatus>,
) -> Vec<PhaseStep> {
    let prefix = phase_prefix("day", cycle);
    let mut steps = vec![simple_step(
        Phase::Day,
        &prefix,
        "announceDeaths",
        StepType::Announcement,
        required_none(),
        false,
    )];

    let mut nomination_number = 1;
    loop {
        let nomination_id = format!("{prefix}:nomination:{nomination_number}");
        match step_status(&nomination_id, statuses) {
            PhaseStepStatus::Complete => {
                steps.push(nomination_step(&prefix, nomination_number));
                nomination_number += 1;
            }
            PhaseStepStatus::Skipped => {
                steps.push(nomination_step(&prefix, nomination_number));
                break;
            }
            PhaseStepStatus::Waiting
            | PhaseStepStatus::Current
            | PhaseStepStatus::NeedsFollowUp => {
                steps.push(nomination_step(&prefix, nomination_number));
                break;
            }
        }
    }

    steps.push(simple_step(
        Phase::Day,
        &prefix,
        "execution",
        StepType::Execution,
        RequiredInput {
            kind: RequiredInputKind::ExecutionDecision,
            target: Some(InputTarget::Execution),
            min_selections: None,
            max_selections: None,
            setup_info: None,
            character_kind: None,
            allowed_character_ids: None,
            zero_allowed: false,
            optional: false,
        },
        false,
    ));
    steps.push(phase_transition_step(
        Phase::Day,
        &prefix,
        "toNight",
        RequiredInputKind::Night,
    ));
    steps
}

pub(crate) fn nomination_step(prefix: &str, nomination_number: usize) -> PhaseStep {
    PhaseStep {
        id: format!("{prefix}:nomination:{nomination_number}"),
        phase: Phase::Day,
        step_type: StepType::Nomination,
        character: None,
        player_id: None,
        required_input: RequiredInput {
            kind: RequiredInputKind::NominationVote,
            target: Some(InputTarget::Players),
            min_selections: Some(0),
            max_selections: None,
            setup_info: None,
            character_kind: None,
            allowed_character_ids: None,
            zero_allowed: false,
            optional: true,
        },
        can_skip: true,
        information_prompt: None,
    }
}

pub(crate) fn nomination_record(
    step: &PhaseStep,
    players: &[Player],
    typed_input: &StepInput,
    events: &[GameEvent],
) -> Result<NominationRecord, CoreError> {
    let input = nomination_input(typed_input)?;
    let voter_ids = nomination_participants(&input, players, &HashSet::new())?;
    let ghost_vote_spent_player_ids = voter_ids
        .iter()
        .filter_map(|player_id| {
            players
                .iter()
                .find(|player| &player.id == player_id && !player.alive && !player.ghost_vote_used)
                .map(|player| player.id.clone())
        })
        .collect::<Vec<_>>();
    let vote_count = voter_ids.len();
    let prefix = step_prefix(&step.id)?;
    let current_candidate = replay_day_state(events, &prefix)?.execution_candidate;
    let majority = execution_vote_threshold(players);
    let updates_execution_candidate = vote_count >= majority
        && current_candidate
            .as_ref()
            .is_none_or(|candidate| vote_count > candidate.vote_count);

    Ok(NominationRecord {
        step_id: step.id.clone(),
        nominator_id: input.nominator_id,
        nominee_id: input.nominee_id,
        voter_ids,
        vote_count,
        ghost_vote_spent_player_ids,
        updates_execution_candidate,
    })
}

pub(crate) fn nomination_participants(
    input: &NominationVoteInput,
    players: &[Player],
    allowed_spent_ghost_ids: &HashSet<&str>,
) -> Result<Vec<String>, CoreError> {
    let roster = players
        .iter()
        .map(|player| (player.id.as_str(), player))
        .collect::<HashMap<_, _>>();
    if !roster.contains_key(input.nominator_id.as_str())
        || !roster.contains_key(input.nominee_id.as_str())
    {
        return Err(ErrorKind::InvalidStepInput.into_error());
    }

    let mut unique_voter_ids = HashSet::new();
    let mut voter_ids = Vec::new();
    for voter_id in &input.voter_ids {
        let Some(voter) = roster.get(voter_id.as_str()) else {
            return Err(ErrorKind::InvalidStepInput.into_error());
        };
        if !unique_voter_ids.insert(voter_id.as_str()) {
            return Err(ErrorKind::InvalidStepInput.into_error());
        }
        if !voter.alive
            && voter.ghost_vote_used
            && !allowed_spent_ghost_ids.contains(voter_id.as_str())
        {
            return Err(ErrorKind::GhostVoteAlreadySpent.into_error());
        }
        voter_ids.push(voter_id.clone());
    }

    Ok(voter_ids)
}

pub(crate) fn execution_vote_threshold(players: &[Player]) -> usize {
    let alive_count = players.iter().filter(|player| player.alive).count();
    (alive_count / 2) + 1
}

pub(crate) fn replay_day_state(events: &[GameEvent], prefix: &str) -> Result<DayState, CoreError> {
    let mut nominations = Vec::new();
    let mut execution_candidate = None;
    let mut confirmed_execution = None;

    for event in events {
        let step_id = match &event.kind {
            GameEventKind::NominationVoteConfirmed { payload } => Some(payload.step_id.as_str()),
            GameEventKind::ExecutionConfirmed { payload }
            | GameEventKind::NoExecutionConfirmed { payload } => Some(payload.step_id.as_str()),
            _ => None,
        };
        if !step_id.is_some_and(|step_id| step_id.starts_with(prefix)) {
            continue;
        }

        match &event.kind {
            GameEventKind::NominationVoteConfirmed { payload } => {
                let record = payload.input.clone();
                if record.updates_execution_candidate {
                    execution_candidate = Some(ExecutionCandidate {
                        nominee_id: record.nominee_id.clone(),
                        vote_count: record.vote_count,
                    });
                }
                nominations.push(record);
            }
            GameEventKind::ExecutionConfirmed { payload } => {
                let player_id = payload
                    .input
                    .player_id
                    .clone()
                    .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
                confirmed_execution = Some(ConfirmedExecution {
                    player_id: Some(player_id),
                });
            }
            GameEventKind::NoExecutionConfirmed { .. } => {
                confirmed_execution = Some(ConfirmedExecution { player_id: None });
            }
            _ => {}
        }
    }

    Ok(DayState {
        nominations,
        execution_candidate,
        confirmed_execution,
    })
}

pub(crate) fn step_prefix(step_id: &str) -> Result<String, CoreError> {
    let Some((prefix, _)) = step_id.split_once(':') else {
        return Err(ErrorKind::ReplayFailed.into_error());
    };
    Ok(prefix.to_string())
}
pub(crate) fn validate_nomination_record_input(
    record: &NominationRecord,
    players: &[Player],
) -> Result<(), CoreError> {
    let input = NominationVoteInput {
        nominator_id: record.nominator_id.clone(),
        nominee_id: record.nominee_id.clone(),
        voter_ids: record.voter_ids.clone(),
    };
    let allowed_spent_ghost_ids = record
        .ghost_vote_spent_player_ids
        .iter()
        .map(String::as_str)
        .collect::<HashSet<_>>();
    nomination_participants(&input, players, &allowed_spent_ghost_ids)?;
    Ok(())
}

pub(crate) fn nomination_input(value: &StepInput) -> Result<NominationVoteInput, CoreError> {
    let value = value
        .as_ref()
        .ok_or_else(|| ErrorKind::MalformedCommand.into_error())?;
    Ok(NominationVoteInput {
        nominator_id: value
            .nominator_id
            .clone()
            .ok_or_else(|| ErrorKind::MalformedCommand.into_error())?,
        nominee_id: value
            .nominee_id
            .clone()
            .ok_or_else(|| ErrorKind::MalformedCommand.into_error())?,
        voter_ids: value
            .voter_ids
            .clone()
            .ok_or_else(|| ErrorKind::MalformedCommand.into_error())?,
    })
}

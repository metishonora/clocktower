use std::collections::HashMap;

use crate::{
    contracts::{GameEvent, GameEventKind, GameFile, ReplayState},
    day::{day_steps, replay_day_state, step_prefix, validate_nomination_record_input},
    error::{CoreError, ErrorKind},
    information::{information_prompt, validate_confirmed_information},
    model::{Phase, PhaseOverviewItem, PhaseStep, PhaseStepStatus, Player, RequiredInputKind},
    night::{first_night_steps, night_steps},
    phase::{step_status, validate_required_input},
    setup::{player_from_setup_input, validate_setup_inputs, validate_setup_warnings},
};

pub(crate) fn replay(game_file: GameFile) -> Result<ReplayState, CoreError> {
    let players = replay_players(&game_file.game.events)?;
    let warnings = validate_setup_warnings(&players);
    let phase_state = replay_phase_state(&players, &game_file.game.events)?;
    let day_state = if phase_state.phase == Phase::Day {
        current_day_prefix(&phase_state)
            .map(|prefix| replay_day_state(&game_file.game.events, &prefix))
            .transpose()?
    } else {
        None
    };

    Ok(ReplayState {
        schema_version: game_file.schema_version,
        event_count: game_file.game.events.len(),
        phase: phase_state.phase,
        players,
        current_step: phase_state.current_step,
        phase_overview: phase_state.phase_overview,
        day_state,
        warnings,
    })
}

pub(crate) fn replay_players(events: &[GameEvent]) -> Result<Vec<Player>, CoreError> {
    if events.is_empty() {
        return Ok(Vec::new());
    };
    if !matches!(events[0].kind, GameEventKind::SetupConfirmed { .. })
        || events
            .iter()
            .skip(1)
            .any(|event| matches!(event.kind, GameEventKind::SetupConfirmed { .. }))
    {
        return Err(ErrorKind::ReplayFailed.into_error());
    }

    let GameEventKind::SetupConfirmed { payload } = &events[0].kind else {
        return Err(ErrorKind::ReplayFailed.into_error());
    };

    validate_setup_inputs(&payload.players)?;
    let mut players = payload
        .players
        .iter()
        .map(player_from_setup_input)
        .collect::<Result<Vec<_>, _>>()?;

    for event in events.iter().skip(1) {
        match &event.kind {
            GameEventKind::DeathConfirmed { payload } => {
                let player_id = payload.player_id.as_str();
                let Some(player) = players.iter_mut().find(|player| player.id == player_id) else {
                    return Err(ErrorKind::ReplayFailed.into_error());
                };
                player.alive = false;
            }
            GameEventKind::NominationVoteConfirmed { payload } => {
                for player_id in &payload.input.ghost_vote_spent_player_ids {
                    let Some(player) = players.iter_mut().find(|player| &player.id == player_id)
                    else {
                        return Err(ErrorKind::ReplayFailed.into_error());
                    };
                    if player.alive || player.ghost_vote_used {
                        return Err(ErrorKind::ReplayFailed.into_error());
                    }
                    player.ghost_vote_used = true;
                }
            }
            _ => {}
        }
    }

    Ok(players)
}
pub(crate) struct PhaseReplayState {
    pub(crate) phase: Phase,
    pub(crate) current_step: Option<PhaseStep>,
    pub(crate) phase_overview: Vec<PhaseOverviewItem>,
}

pub(crate) fn replay_phase_state(
    players: &[Player],
    events: &[GameEvent],
) -> Result<PhaseReplayState, CoreError> {
    if players.is_empty() {
        return Ok(PhaseReplayState {
            phase: Phase::Setup,
            current_step: None,
            phase_overview: Vec::new(),
        });
    }

    let step_statuses = phase_step_statuses(events, players)?;
    for (phase, steps) in phase_sequences_with_statuses(players, events.len() + 2, &step_statuses) {
        let phase_complete = steps
            .iter()
            .all(|step| step_status(&step.id, &step_statuses).is_done());
        if phase_complete {
            continue;
        }

        let mut current_step = steps
            .iter()
            .find(|step| !step_status(&step.id, &step_statuses).is_done())
            .cloned();
        if let Some(step) = current_step.as_mut() {
            step.information_prompt = information_prompt(step, players, events);
        }
        let current_step_id = current_step.as_ref().map(|step| step.id.as_str());
        let phase_overview = steps
            .into_iter()
            .map(|step| {
                let status = match step_status(&step.id, &step_statuses) {
                    PhaseStepStatus::Complete => PhaseStepStatus::Complete,
                    PhaseStepStatus::Skipped => PhaseStepStatus::Skipped,
                    PhaseStepStatus::NeedsFollowUp => PhaseStepStatus::NeedsFollowUp,
                    PhaseStepStatus::Waiting if Some(step.id.as_str()) == current_step_id => {
                        PhaseStepStatus::Current
                    }
                    PhaseStepStatus::Waiting | PhaseStepStatus::Current => PhaseStepStatus::Waiting,
                };

                PhaseOverviewItem {
                    id: step.id,
                    phase: step.phase,
                    step_type: step.step_type,
                    character: step.character,
                    player_id: step.player_id,
                    required_input: step.required_input,
                    can_skip: step.can_skip,
                    information_prompt: step.information_prompt,
                    status,
                }
            })
            .collect();

        return Ok(PhaseReplayState {
            phase,
            current_step,
            phase_overview,
        });
    }

    Ok(PhaseReplayState {
        phase: Phase::Night,
        current_step: None,
        phase_overview: Vec::new(),
    })
}

pub(crate) fn phase_step_statuses(
    events: &[GameEvent],
    players: &[Player],
) -> Result<HashMap<String, PhaseStepStatus>, CoreError> {
    let mut statuses = HashMap::new();
    for (event_index, event) in events.iter().enumerate() {
        let (status, step_id, event_input) = match &event.kind {
            GameEventKind::PhaseStepConfirmed { payload } => (
                PhaseStepStatus::Complete,
                payload.step_id.as_str(),
                Some(&payload.input),
            ),
            GameEventKind::NominationVoteConfirmed { payload } => {
                (PhaseStepStatus::Complete, payload.step_id.as_str(), None)
            }
            GameEventKind::ExecutionConfirmed { payload }
            | GameEventKind::NoExecutionConfirmed { payload } => {
                (PhaseStepStatus::Complete, payload.step_id.as_str(), None)
            }
            GameEventKind::PhaseStepSkipped { payload } => {
                (PhaseStepStatus::Skipped, payload.step_id.as_str(), None)
            }
            GameEventKind::PhaseStepNeedsFollowUp { payload } => (
                PhaseStepStatus::NeedsFollowUp,
                payload.step_id.as_str(),
                None,
            ),
            _ => continue,
        };
        let Some((_, _, Some(step))) = current_phase_steps(players, events.len() + 2, &statuses)
        else {
            return Err(ErrorKind::ReplayFailed.into_error());
        };
        if step.id != step_id {
            return Err(ErrorKind::ReplayFailed.into_error());
        }
        if matches!(status, PhaseStepStatus::Skipped) && !step.can_skip {
            return Err(ErrorKind::ReplayFailed.into_error());
        }
        if let Some(input) = event_input {
            if let GameEventKind::PhaseStepConfirmed { payload } = &event.kind {
                let players_at_event = replay_players(&events[..event_index])?;
                if step.required_input.kind != RequiredInputKind::SetupInfo {
                    validate_required_input(&step.required_input, input, &players_at_event)?;
                }
                validate_confirmed_information(
                    &step,
                    &players_at_event,
                    &events[..event_index],
                    input,
                    payload.information.as_ref(),
                )?;
            } else {
                validate_required_input(&step.required_input, input, players)?;
            }
        }
        if let GameEventKind::NominationVoteConfirmed { payload } = &event.kind {
            validate_nomination_record_input(&payload.input, players)?;
        }
        statuses.insert(step_id.to_string(), status);
    }
    Ok(statuses)
}

pub(crate) fn phase_sequences_with_statuses(
    players: &[Player],
    max_cycles: usize,
    statuses: &HashMap<String, PhaseStepStatus>,
) -> Vec<(Phase, Vec<PhaseStep>)> {
    let mut sequences = vec![(Phase::FirstNight, first_night_steps(players))];
    for cycle in 1..=max_cycles.max(1) {
        sequences.push((Phase::Day, day_steps(cycle, statuses)));
        sequences.push((Phase::Night, night_steps(players, cycle)));
    }
    sequences
}

pub(crate) fn current_phase_steps(
    players: &[Player],
    max_cycles: usize,
    statuses: &HashMap<String, PhaseStepStatus>,
) -> Option<(Phase, Vec<PhaseStep>, Option<PhaseStep>)> {
    for (phase, steps) in phase_sequences_with_statuses(players, max_cycles, statuses) {
        let phase_complete = steps
            .iter()
            .all(|step| step_status(&step.id, statuses).is_done());
        if phase_complete {
            continue;
        }

        let current_step = steps
            .iter()
            .find(|step| !step_status(&step.id, statuses).is_done())
            .cloned();
        return Some((phase, steps, current_step));
    }

    None
}

pub(crate) fn current_day_prefix(phase_state: &PhaseReplayState) -> Option<String> {
    phase_state
        .current_step
        .as_ref()
        .and_then(|step| step_prefix(&step.id).ok())
        .or_else(|| {
            phase_state
                .phase_overview
                .first()
                .and_then(|step| step_prefix(&step.id).ok())
        })
}

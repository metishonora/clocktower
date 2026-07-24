use std::collections::{HashMap, HashSet};

use crate::{
    contracts::{GameEvent, GameEventKind, VirginResolution},
    error::{CoreError, ErrorKind},
    model::{
        ActiveNomination, ConfirmedExecution, DayState, ExecutionCandidate, ExecutionStanding,
        InputTarget, NominationInput, NominationRecord, NominationVoteInput, Phase, PhaseStep,
        PhaseStepStatus, Player, RegistrationJudgment, RequiredInput, RequiredInputKind, StepInput,
        StepType,
    },
    phase::{phase_prefix, phase_transition_step, required_none, simple_step, step_status},
};

pub(crate) fn day_steps(
    cycle: usize,
    statuses: &HashMap<String, PhaseStepStatus>,
    executed_player_id: Option<String>,
    events: &[GameEvent],
    players: &[Player],
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
    steps.push(simple_step(
        Phase::Day,
        &prefix,
        "whisper",
        StepType::Whisper,
        required_none(),
        false,
    ));
    steps.push(simple_step(
        Phase::Day,
        &prefix,
        "discussion",
        StepType::Discussion,
        required_none(),
        false,
    ));

    let mut nomination_number = 1;
    loop {
        let nomination_id = format!("{prefix}:nomination:{nomination_number}");
        match step_status(&nomination_id, statuses) {
            PhaseStepStatus::Complete
            | PhaseStepStatus::ManualComplete
            | PhaseStepStatus::NotApplicable => {
                steps.push(nomination_step_for_players(
                    &prefix,
                    nomination_number,
                    players,
                ));
                if let Some(nominator_id) = virgin_execution_nominator(events, &nomination_id) {
                    steps.push(virgin_death_step(&nomination_id, nominator_id));
                    steps.push(phase_transition_step(
                        Phase::Day,
                        &prefix,
                        "toNight",
                        RequiredInputKind::Night,
                    ));
                    return steps;
                }
                if legacy_nomination_complete(events, &nomination_id) {
                    nomination_number += 1;
                    continue;
                }
                let vote = nomination_vote_step(&nomination_id);
                let vote_done = step_status(&vote.id, statuses).is_done();
                steps.push(vote);
                if vote_done {
                    nomination_number += 1;
                    continue;
                }
                break;
            }
            PhaseStepStatus::Skipped => {
                steps.push(nomination_step_for_players(
                    &prefix,
                    nomination_number,
                    players,
                ));
                break;
            }
            PhaseStepStatus::Waiting
            | PhaseStepStatus::Current
            | PhaseStepStatus::NeedsFollowUp => {
                steps.push(nomination_step_for_players(
                    &prefix,
                    nomination_number,
                    players,
                ));
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
            allowed_player_ids: None,
            player_registration_options: None,
            zero_allowed: false,
            supports_random_suggestion: false,
            player_id: None,
            survival_allowed: None,
            execution_survival_allowed: false,
            mayor_decision: None,
            demon_succession: None,
            optional: false,
        },
        false,
    ));
    let execution_needs_death_confirmation = executed_player_id.as_ref().is_none_or(|player_id| {
        players
            .iter()
            .any(|player| player.id == *player_id && player.alive)
    });
    if execution_needs_death_confirmation {
        steps.push(PhaseStep {
            id: format!("{prefix}:executionDeath"),
            phase: Phase::Day,
            step_type: StepType::ExecutionDeath,
            character: None,
            player_id: executed_player_id,
            required_input: RequiredInput {
                kind: RequiredInputKind::ExecutionDeathDecision,
                target: Some(InputTarget::Execution),
                min_selections: None,
                max_selections: None,
                setup_info: None,
                character_kind: None,
                allowed_character_ids: None,
                allowed_player_ids: None,
                player_registration_options: None,
                zero_allowed: false,
                supports_random_suggestion: false,
                player_id: None,
                survival_allowed: None,
                execution_survival_allowed: false,
                mayor_decision: None,
                demon_succession: None,
                optional: false,
            },
            can_skip: false,
            support: crate::model::PhaseStepSupport::Automated,
            information_prompt: None,
            pre_action_reveal: None,
        });
    }
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
            kind: RequiredInputKind::Nomination,
            target: Some(InputTarget::Players),
            min_selections: None,
            max_selections: None,
            setup_info: None,
            character_kind: None,
            allowed_character_ids: None,
            allowed_player_ids: None,
            player_registration_options: None,
            zero_allowed: false,
            supports_random_suggestion: false,
            player_id: None,
            survival_allowed: None,
            execution_survival_allowed: false,
            mayor_decision: None,
            demon_succession: None,
            optional: true,
        },
        can_skip: true,
        support: crate::model::PhaseStepSupport::Automated,
        information_prompt: None,
        pre_action_reveal: None,
    }
}

fn nomination_step_for_players(
    prefix: &str,
    nomination_number: usize,
    players: &[Player],
) -> PhaseStep {
    let mut step = nomination_step(prefix, nomination_number);
    step.required_input.player_registration_options = Some(
        players
            .iter()
            .filter(|player| player.alive && player.actual_character == "spy")
            .map(|player| RegistrationJudgment {
                player_id: player.id.clone(),
                registered_as: crate::model::RegistrationValue::Townsfolk,
                character_id: None,
            })
            .collect(),
    );
    step
}

pub(crate) fn nomination_vote_step(nomination_step_id: &str) -> PhaseStep {
    PhaseStep {
        id: format!("{nomination_step_id}:vote"),
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
            allowed_player_ids: None,
            player_registration_options: None,
            zero_allowed: false,
            supports_random_suggestion: false,
            player_id: None,
            survival_allowed: None,
            execution_survival_allowed: false,
            mayor_decision: None,
            demon_succession: None,
            optional: true,
        },
        can_skip: false,
        support: crate::model::PhaseStepSupport::Automated,
        information_prompt: None,
        pre_action_reveal: None,
    }
}

fn virgin_death_step(nomination_step_id: &str, player_id: String) -> PhaseStep {
    PhaseStep {
        id: format!("{nomination_step_id}:virginDeath"),
        phase: Phase::Day,
        step_type: StepType::ExecutionDeath,
        character: Some("virgin".into()),
        player_id: Some(player_id.clone()),
        required_input: RequiredInput {
            kind: RequiredInputKind::ExecutionDeathDecision,
            target: Some(InputTarget::Execution),
            min_selections: None,
            max_selections: None,
            setup_info: None,
            character_kind: None,
            allowed_character_ids: None,
            allowed_player_ids: None,
            player_registration_options: None,
            zero_allowed: false,
            supports_random_suggestion: false,
            player_id: Some(player_id),
            survival_allowed: None,
            execution_survival_allowed: false,
            mayor_decision: None,
            demon_succession: None,
            optional: false,
        },
        can_skip: false,
        support: crate::model::PhaseStepSupport::Automated,
        information_prompt: None,
        pre_action_reveal: None,
    }
}

fn virgin_execution_nominator(events: &[GameEvent], nomination_step_id: &str) -> Option<String> {
    events.iter().find_map(|event| match &event.kind {
        GameEventKind::NominationStarted { payload }
            if payload.step_id == nomination_step_id
                && matches!(
                    payload.virgin_resolution,
                    VirginResolution::SpentAndNominatorExecuted { .. }
                ) =>
        {
            Some(payload.nominator_id.clone())
        }
        _ => None,
    })
}

fn legacy_nomination_complete(events: &[GameEvent], nomination_step_id: &str) -> bool {
    events.iter().any(|event| {
        matches!(
            &event.kind,
            GameEventKind::NominationVoteConfirmed { payload }
                if payload.step_id == nomination_step_id && payload.nomination_event_id.is_none()
        )
    })
}

pub(crate) fn nomination_record(
    step: &PhaseStep,
    players: &[Player],
    typed_input: &StepInput,
    events: &[GameEvent],
) -> Result<(NominationRecord, ActiveNomination), CoreError> {
    let prefix = step_prefix(&step.id)?;
    let prior = replay_day_state(events, players, &prefix)?;
    let active = prior
        .active_nomination
        .ok_or_else(|| ErrorKind::InvalidStepInput.into_error())?;
    if step.id != format!("{}:vote", active.step_id) {
        return Err(ErrorKind::InvalidStepInput.into_error());
    }
    let voter_ids = typed_input
        .as_ref()
        .and_then(|input| input.voter_ids.clone())
        .ok_or_else(|| ErrorKind::MalformedCommand.into_error())?;
    let input = NominationVoteInput {
        nominator_id: active.nominator_id.clone(),
        nominee_id: active.nominee_id.clone(),
        voter_ids,
    };
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
    Ok((
        NominationRecord {
            step_id: active.step_id.clone(),
            nominator_id: input.nominator_id,
            nominee_id: input.nominee_id,
            voter_ids,
            vote_count,
            ghost_vote_spent_player_ids,
        },
        active,
    ))
}

pub(crate) fn nomination_start_input(value: &StepInput) -> Result<NominationInput, CoreError> {
    let value = value
        .as_ref()
        .ok_or_else(|| ErrorKind::MalformedCommand.into_error())?;
    Ok(NominationInput {
        nominator_id: value
            .nominator_id
            .clone()
            .ok_or_else(|| ErrorKind::MalformedCommand.into_error())?,
        nominee_id: value
            .nominee_id
            .clone()
            .ok_or_else(|| ErrorKind::MalformedCommand.into_error())?,
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
    alive_count.div_ceil(2).max(1)
}

pub(crate) fn execution_standing(
    players: &[Player],
    nominations: &[NominationRecord],
) -> ExecutionStanding {
    let highest_vote_count = nominations
        .iter()
        .map(|record| record.vote_count)
        .max()
        .unwrap_or(0);
    let execution_vote_threshold = execution_vote_threshold(players);
    let leaders = nominations
        .iter()
        .filter(|record| record.vote_count == highest_vote_count)
        .collect::<Vec<_>>();
    let execution_candidate =
        if highest_vote_count >= execution_vote_threshold && leaders.len() == 1 {
            Some(ExecutionCandidate {
                nominee_id: leaders[0].nominee_id.clone(),
                vote_count: highest_vote_count,
            })
        } else {
            None
        };

    ExecutionStanding {
        execution_vote_threshold,
        highest_vote_count,
        execution_candidate,
    }
}

pub(crate) fn nomination_eligibility(
    players: &[Player],
    nominations: &[NominationRecord],
) -> (Vec<String>, Vec<String>) {
    let used_nominator_ids = nominations
        .iter()
        .map(|record| record.nominator_id.as_str())
        .collect::<HashSet<_>>();
    let used_nominee_ids = nominations
        .iter()
        .map(|record| record.nominee_id.as_str())
        .collect::<HashSet<_>>();

    let eligible_nominator_ids = players
        .iter()
        .filter(|player| player.alive && !used_nominator_ids.contains(player.id.as_str()))
        .map(|player| player.id.clone())
        .collect();
    let eligible_nominee_ids = players
        .iter()
        .filter(|player| !used_nominee_ids.contains(player.id.as_str()))
        .map(|player| player.id.clone())
        .collect();

    (eligible_nominator_ids, eligible_nominee_ids)
}

pub(crate) fn validate_nomination_roles(
    players: &[Player],
    nominations: &[NominationRecord],
    nominator_id: &str,
    nominee_id: &str,
) -> Result<(), CoreError> {
    let (eligible_nominator_ids, eligible_nominee_ids) =
        nomination_eligibility(players, nominations);
    if !eligible_nominator_ids.iter().any(|id| id == nominator_id)
        || !eligible_nominee_ids.iter().any(|id| id == nominee_id)
    {
        return Err(ErrorKind::InvalidStepInput.into_error());
    }
    Ok(())
}

pub(crate) fn validate_nomination_start_roles(
    players: &[Player],
    events: &[GameEvent],
    prefix: &str,
    nominator_id: &str,
    nominee_id: &str,
) -> Result<(), CoreError> {
    let state = replay_day_state(events, players, prefix)?;
    if !state
        .eligible_nominator_ids
        .iter()
        .any(|id| id == nominator_id)
        || !state.eligible_nominee_ids.iter().any(|id| id == nominee_id)
    {
        return Err(ErrorKind::InvalidStepInput.into_error());
    }
    Ok(())
}

pub(crate) fn replay_day_state(
    events: &[GameEvent],
    players: &[Player],
    prefix: &str,
) -> Result<DayState, CoreError> {
    let mut nominations = Vec::new();
    let mut started = Vec::<ActiveNomination>::new();
    let mut completed_nomination_event_ids = HashSet::new();
    let mut confirmed_execution = None;

    for event in events {
        let step_id = match &event.kind {
            GameEventKind::NominationStarted { payload } => Some(payload.step_id.as_str()),
            GameEventKind::NominationVoteConfirmed { payload } => Some(payload.step_id.as_str()),
            GameEventKind::ExecutionConfirmed { payload }
            | GameEventKind::NoExecutionConfirmed { payload } => Some(payload.step_id.as_str()),
            _ => None,
        };
        if !step_id.is_some_and(|step_id| step_id.starts_with(prefix)) {
            continue;
        }

        match &event.kind {
            GameEventKind::NominationStarted { payload } => {
                started.push(ActiveNomination {
                    event_id: event.id.clone(),
                    step_id: payload.step_id.clone(),
                    nominator_id: payload.nominator_id.clone(),
                    nominee_id: payload.nominee_id.clone(),
                });
            }
            GameEventKind::NominationVoteConfirmed { payload } => {
                let (step_id, nominator_id, nominee_id) =
                    if let Some(event_id) = payload.nomination_event_id.as_ref() {
                        let active = started
                            .iter()
                            .find(|nomination| &nomination.event_id == event_id)
                            .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
                        completed_nomination_event_ids.insert(event_id.clone());
                        (
                            active.step_id.clone(),
                            active.nominator_id.clone(),
                            active.nominee_id.clone(),
                        )
                    } else {
                        (
                            payload.step_id.clone(),
                            payload
                                .nominator_id
                                .clone()
                                .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?,
                            payload
                                .nominee_id
                                .clone()
                                .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?,
                        )
                    };
                let record = NominationRecord {
                    step_id,
                    nominator_id,
                    nominee_id,
                    voter_ids: payload.voter_ids.clone(),
                    vote_count: payload.voter_ids.len(),
                    ghost_vote_spent_player_ids: payload.ghost_vote_spent_player_ids.clone(),
                };
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

    let standing = execution_standing(players, &nominations);

    let mut consumed = nominations
        .iter()
        .map(|record| (record.nominator_id.clone(), record.nominee_id.clone()))
        .collect::<Vec<_>>();
    for nomination in &started {
        if !consumed.iter().any(|(nominator, nominee)| {
            nominator == &nomination.nominator_id && nominee == &nomination.nominee_id
        }) {
            consumed.push((
                nomination.nominator_id.clone(),
                nomination.nominee_id.clone(),
            ));
        }
    }
    let (eligible_nominator_ids, eligible_nominee_ids) =
        nomination_eligibility_from_pairs(players, &consumed);
    let active_nomination = started.into_iter().find(|nomination| {
        !completed_nomination_event_ids.contains(&nomination.event_id)
            && events.iter().any(|event| matches!(
                &event.kind,
                GameEventKind::NominationStarted { payload }
                    if payload.step_id == nomination.step_id
                        && !matches!(payload.virgin_resolution, VirginResolution::SpentAndNominatorExecuted { .. })
            ))
    });

    Ok(DayState {
        nominations,
        eligible_nominator_ids,
        eligible_nominee_ids,
        execution_vote_threshold: standing.execution_vote_threshold,
        highest_vote_count: standing.highest_vote_count,
        execution_candidate: standing.execution_candidate,
        confirmed_execution,
        active_nomination,
    })
}

fn nomination_eligibility_from_pairs(
    players: &[Player],
    nominations: &[(String, String)],
) -> (Vec<String>, Vec<String>) {
    let used_nominator_ids = nominations
        .iter()
        .map(|(nominator, _)| nominator.as_str())
        .collect::<HashSet<_>>();
    let used_nominee_ids = nominations
        .iter()
        .map(|(_, nominee)| nominee.as_str())
        .collect::<HashSet<_>>();
    (
        players
            .iter()
            .filter(|player| player.alive && !used_nominator_ids.contains(player.id.as_str()))
            .map(|player| player.id.clone())
            .collect(),
        players
            .iter()
            .filter(|player| !used_nominee_ids.contains(player.id.as_str()))
            .map(|player| player.id.clone())
            .collect(),
    )
}

pub(crate) fn step_prefix(step_id: &str) -> Result<String, CoreError> {
    let Some((prefix, _)) = step_id.split_once(':') else {
        return Err(ErrorKind::ReplayFailed.into_error());
    };
    Ok(prefix.to_string())
}
pub(crate) fn validate_nomination_event_input(
    payload: &crate::contracts::NominationEventPayload,
    players: &[Player],
    events: &[GameEvent],
) -> Result<(), CoreError> {
    let (nominator_id, nominee_id) = if let Some(event_id) = payload.nomination_event_id.as_ref() {
        let started = events
            .iter()
            .find_map(|event| match &event.kind {
                GameEventKind::NominationStarted { payload } if &event.id == event_id => {
                    Some(payload)
                }
                _ => None,
            })
            .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
        if payload.step_id != format!("{}:vote", started.step_id) {
            return Err(ErrorKind::ReplayFailed.into_error());
        }
        (started.nominator_id.clone(), started.nominee_id.clone())
    } else {
        (
            payload
                .nominator_id
                .clone()
                .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?,
            payload
                .nominee_id
                .clone()
                .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?,
        )
    };
    let input = NominationVoteInput {
        nominator_id,
        nominee_id,
        voter_ids: payload.voter_ids.clone(),
    };
    let allowed_spent_ghost_ids = payload
        .ghost_vote_spent_player_ids
        .iter()
        .map(String::as_str)
        .collect::<HashSet<_>>();
    nomination_participants(&input, players, &allowed_spent_ghost_ids)?;
    let expected = payload
        .voter_ids
        .iter()
        .filter(|id| {
            players
                .iter()
                .any(|player| &player.id == *id && !player.alive)
        })
        .cloned()
        .collect::<HashSet<_>>();
    let actual = payload
        .ghost_vote_spent_player_ids
        .iter()
        .cloned()
        .collect::<HashSet<_>>();
    if expected != actual || actual.len() != payload.ghost_vote_spent_player_ids.len() {
        return Err(ErrorKind::InvalidStepInput.into_error());
    }
    Ok(())
}

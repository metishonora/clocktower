use crate::{
    contracts::{
        Command, CreateGamePayload, ExecutionEventInput, ExecutionEventPayload, GameEvent,
        GameEventKind, GameFile, NominationEventPayload, PhaseStepCommandPayload,
        PhaseStepEventPayload, Proposal, SetupEventPayload, SmokeEventPayload, StepIdPayload,
    },
    day::{nomination_record, replay_day_state, step_prefix},
    error::{CoreError, ErrorKind},
    information::confirmed_information,
    messages::{
        execution_event_summary, execution_preview, nomination_closed_event_summary,
        nomination_closed_preview, nomination_vote_event_summary, nomination_vote_preview,
        phase_step_event_summary, phase_step_preview, phase_step_reveal_payload,
        setup_event_summary, setup_preview, smoke_event_summary, smoke_preview,
    },
    model::{
        ExecutionDecisionInput, Phase, PhaseStep, Player, RequiredInputKind, StepInput, StepType,
    },
    phase::validate_required_input,
    replay::{replay_phase_state, replay_players},
    setup::{
        normalized_setup_player, player_from_setup_input, validate_setup_inputs,
        validate_setup_warnings,
    },
};

pub(crate) fn propose(game_file: GameFile, command: Command) -> Result<Proposal, CoreError> {
    match command {
        Command::Smoke => Ok(Proposal {
            event: GameEvent {
                id: "smoke-event".to_string(),
                kind: GameEventKind::SmokeConfirmed {
                    payload: SmokeEventPayload {
                        source: "smoke".to_string(),
                    },
                },
                phase: Phase::Setup,
                summary: smoke_event_summary(),
                created_at: "1970-01-01T00:00:00.000Z".to_string(),
            },
            warnings: Vec::new(),
            follow_up_steps: Vec::new(),
            preview: smoke_preview(),
            reveal_payload: None,
        }),
        Command::CreateGame { payload } => propose_create_game(&game_file, payload),
        Command::ConfirmStep { payload } => propose_phase_step(&game_file, payload, false),
        Command::SkipStep { payload } => propose_phase_step(&game_file, payload, true),
    }
}

pub(crate) fn propose_create_game(
    game_file: &GameFile,
    payload: CreateGamePayload,
) -> Result<Proposal, CoreError> {
    if !game_file.game.events.is_empty() {
        return Err(ErrorKind::GameAlreadyHasEvents.into_error());
    }

    validate_setup_inputs(&payload.players)?;

    let players = payload
        .players
        .iter()
        .map(normalized_setup_player)
        .collect::<Result<Vec<_>, _>>()?;
    let derived_players = players
        .iter()
        .map(player_from_setup_input)
        .collect::<Result<Vec<_>, _>>()?;
    let warnings = validate_setup_warnings(&derived_players);
    let count = players.len();

    Ok(Proposal {
        event: GameEvent {
            id: format!("setup-{}", game_file.game.events.len() + 1),
            kind: GameEventKind::SetupConfirmed {
                payload: SetupEventPayload { players },
            },
            phase: Phase::Setup,
            summary: setup_event_summary(count),
            created_at: game_file
                .game
                .updated_at
                .clone()
                .unwrap_or_else(|| "1970-01-01T00:00:00.000Z".to_string()),
        },
        warnings,
        follow_up_steps: Vec::new(),
        preview: setup_preview(count),
        reveal_payload: None,
    })
}

pub(crate) fn propose_phase_step(
    game_file: &GameFile,
    payload: PhaseStepCommandPayload,
    skip: bool,
) -> Result<Proposal, CoreError> {
    let players = replay_players(&game_file.game.events)?;
    let phase_state = replay_phase_state(&players, &game_file.game.events)?;
    let Some(current_step) = phase_state.current_step else {
        return Err(ErrorKind::NoCurrentStep.into_error());
    };

    if payload.step_id != current_step.id {
        return Err(ErrorKind::StaleStep.into_error());
    }
    if skip && !current_step.can_skip {
        return Err(ErrorKind::StepCannotBeSkipped.into_error());
    }
    if skip && current_step.step_type == StepType::Nomination {
        return propose_nomination_closed(game_file, &current_step);
    }
    if skip && (payload.delivered_result.is_some() || !payload.registration_judgments.is_empty()) {
        return Err(ErrorKind::UnexpectedDeliveredInformation.into_error());
    }
    if !skip && current_step.required_input.kind != RequiredInputKind::SetupInfo {
        validate_required_input(&current_step.required_input, &payload.input, &players)?;
    }
    if !skip && current_step.step_type == StepType::Nomination {
        return propose_nomination_vote(game_file, &current_step, &players, payload.input);
    }
    if !skip && current_step.step_type == StepType::Execution {
        return propose_execution_decision(game_file, &current_step, &players, payload.input);
    }

    let event_count = game_file.game.events.len() + 1;
    let information = if skip {
        None
    } else {
        confirmed_information(
            &current_step,
            &players,
            &game_file.game.events,
            &payload.input,
            payload.delivered_result,
            payload.registration_judgments,
        )?
    };
    let event_input = if skip { None } else { Some(payload.input) };
    let summary = phase_step_event_summary(
        &current_step,
        &players,
        event_input.as_ref().unwrap_or(&None),
        information.as_ref(),
        skip,
    );
    let kind = if let Some(input) = event_input {
        GameEventKind::PhaseStepConfirmed {
            payload: Box::new(PhaseStepEventPayload {
                step_id: current_step.id.clone(),
                input,
                information,
            }),
        }
    } else {
        GameEventKind::PhaseStepSkipped {
            payload: StepIdPayload {
                step_id: current_step.id.clone(),
            },
        }
    };

    let event = GameEvent {
        id: format!("phase-step-{event_count}"),
        kind,
        phase: current_step.phase,
        summary,
        created_at: game_file
            .game
            .updated_at
            .clone()
            .unwrap_or_else(|| "1970-01-01T00:00:00.000Z".to_string()),
    };
    let reveal_payload = match &event.kind {
        GameEventKind::PhaseStepConfirmed { payload } => {
            payload.information.as_ref().and_then(|information| {
                phase_step_reveal_payload(&current_step, &information.delivered_result, &players)
            })
        }
        _ => None,
    };

    Ok(Proposal {
        event,
        warnings: Vec::new(),
        follow_up_steps: Vec::new(),
        preview: phase_step_preview(skip),
        reveal_payload,
    })
}

pub(crate) fn propose_nomination_closed(
    game_file: &GameFile,
    current_step: &PhaseStep,
) -> Result<Proposal, CoreError> {
    let event_count = game_file.game.events.len() + 1;

    Ok(Proposal {
        event: GameEvent {
            id: format!("nomination-closed-{event_count}"),
            kind: GameEventKind::PhaseStepSkipped {
                payload: StepIdPayload {
                    step_id: current_step.id.clone(),
                },
            },
            phase: current_step.phase,
            summary: nomination_closed_event_summary(),
            created_at: game_file
                .game
                .updated_at
                .clone()
                .unwrap_or_else(|| "1970-01-01T00:00:00.000Z".to_string()),
        },
        warnings: Vec::new(),
        follow_up_steps: Vec::new(),
        preview: nomination_closed_preview(),
        reveal_payload: None,
    })
}

pub(crate) fn propose_nomination_vote(
    game_file: &GameFile,
    current_step: &PhaseStep,
    players: &[Player],
    input: StepInput,
) -> Result<Proposal, CoreError> {
    let record = nomination_record(current_step, players, &input, &game_file.game.events)?;
    let event_count = game_file.game.events.len() + 1;

    Ok(Proposal {
        event: GameEvent {
            id: format!("nomination-vote-{event_count}"),
            kind: GameEventKind::NominationVoteConfirmed {
                payload: NominationEventPayload {
                    step_id: current_step.id.clone(),
                    input: record.clone(),
                },
            },
            phase: current_step.phase,
            summary: nomination_vote_event_summary(players, &record),
            created_at: game_file
                .game
                .updated_at
                .clone()
                .unwrap_or_else(|| "1970-01-01T00:00:00.000Z".to_string()),
        },
        warnings: Vec::new(),
        follow_up_steps: Vec::new(),
        preview: nomination_vote_preview(&record),
        reveal_payload: None,
    })
}

pub(crate) fn propose_execution_decision(
    game_file: &GameFile,
    current_step: &PhaseStep,
    players: &[Player],
    input: StepInput,
) -> Result<Proposal, CoreError> {
    let decision = ExecutionDecisionInput {
        execute: input
            .as_ref()
            .and_then(|input| input.execute)
            .ok_or_else(|| ErrorKind::MalformedCommand.into_error())?,
    };
    let prefix = step_prefix(&current_step.id)?;
    let day_state = replay_day_state(&game_file.game.events, &prefix)?;
    let event_count = game_file.game.events.len() + 1;
    let player_id = if decision.execute {
        Some(
            day_state
                .execution_candidate
                .ok_or_else(|| ErrorKind::NoExecutionCandidate.into_error())?
                .nominee_id,
        )
    } else {
        None
    };
    let kind = if player_id.is_some() {
        GameEventKind::ExecutionConfirmed {
            payload: ExecutionEventPayload {
                step_id: current_step.id.clone(),
                input: ExecutionEventInput {
                    execute: decision.execute,
                    player_id: player_id.clone(),
                },
            },
        }
    } else {
        GameEventKind::NoExecutionConfirmed {
            payload: ExecutionEventPayload {
                step_id: current_step.id.clone(),
                input: ExecutionEventInput {
                    execute: decision.execute,
                    player_id: None,
                },
            },
        }
    };
    let summary = execution_event_summary(players, player_id.as_deref());

    Ok(Proposal {
        event: GameEvent {
            id: format!("execution-{event_count}"),
            kind,
            phase: current_step.phase,
            summary,
            created_at: game_file
                .game
                .updated_at
                .clone()
                .unwrap_or_else(|| "1970-01-01T00:00:00.000Z".to_string()),
        },
        warnings: Vec::new(),
        follow_up_steps: Vec::new(),
        preview: execution_preview(decision.execute),
        reveal_payload: None,
    })
}

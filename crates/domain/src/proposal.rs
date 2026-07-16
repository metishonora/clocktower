use crate::{
    contracts::{
        Command, CreateGamePayload, DeathEventPayload, ExecutionEventInput, ExecutionEventPayload,
        ExecutionSurvivalEventPayload, GameEvent, GameEventKind, GameFile, ImpAttackOutcome,
        ImpNoDeathReason, ImpPreventionReason, NightActionResolution, NightActionResolvedPayload,
        NightDeathsAnnouncedPayload, NominationEventPayload, PhaseStepCommandPayload,
        PhaseStepEventPayload, Proposal, RedHerringAssignedPayload, SetupEventPayload,
        SmokeEventPayload, StepIdPayload,
    },
    day::{execution_standing, nomination_record, replay_day_state, step_prefix},
    error::{CoreError, ErrorKind},
    information::{actor_is_impaired, confirmed_information},
    messages::{
        execution_death_event_summary, execution_death_preview, execution_event_summary,
        execution_preview, execution_survival_event_summary, nomination_closed_event_summary,
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
use serde_json::json;

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
    if !skip && current_step.step_type == StepType::ExecutionDeath {
        return propose_execution_death(game_file, &current_step, &players, payload.input);
    }
    if !skip
        && current_step.step_type == StepType::Announcement
        && current_step.id.ends_with(":announceDeaths")
    {
        let announced = game_file
            .game
            .events
            .iter()
            .flat_map(|e| match &e.kind {
                GameEventKind::NightDeathsAnnounced { payload } => payload.player_ids.clone(),
                _ => vec![],
            })
            .collect::<Vec<_>>();
        let player_ids = game_file
            .game
            .events
            .iter()
            .filter_map(|e| match &e.kind {
                GameEventKind::NightActionResolved { payload } => match &payload.resolution {
                    NightActionResolution::ImpAttack {
                        outcome: ImpAttackOutcome::Death { player_id },
                        ..
                    } => Some(player_id.clone()),
                    _ => None,
                },
                _ => None,
            })
            .filter(|id| !announced.contains(id))
            .collect();
        return Ok(simple_typed_proposal(
            game_file,
            &current_step,
            GameEventKind::NightDeathsAnnounced {
                payload: NightDeathsAnnouncedPayload {
                    step_id: current_step.id.clone(),
                    player_ids,
                },
            },
        ));
    }

    if !skip && current_step.step_type == StepType::RedHerringAssignment {
        let player_id = payload
            .input
            .as_ref()
            .and_then(|i| i.player_ids.as_ref())
            .and_then(|ids| ids.first())
            .cloned()
            .ok_or_else(|| ErrorKind::InvalidStepInput.into_error())?;
        return Ok(simple_typed_proposal(
            game_file,
            &current_step,
            GameEventKind::RedHerringAssigned {
                payload: RedHerringAssignedPayload {
                    step_id: current_step.id.clone(),
                    player_id,
                    registration_judgments: payload.registration_judgments,
                },
            },
        ));
    }
    if !skip
        && matches!(
            current_step.character.as_deref(),
            Some("poisoner" | "monk" | "imp")
        )
    {
        let target = payload
            .input
            .as_ref()
            .and_then(|i| i.player_ids.as_ref())
            .and_then(|ids| ids.first())
            .cloned()
            .ok_or_else(|| ErrorKind::InvalidStepInput.into_error())?;
        let actor = current_step
            .player_id
            .clone()
            .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
        let actual = players
            .iter()
            .find(|p| p.id == actor)
            .map(|p| p.actual_character.as_str());
        let impaired = actor_is_impaired(&current_step, &players, &game_file.game.events);
        let resolution = match current_step.character.as_deref() {
            Some("poisoner") => {
                let applied = actual == Some("poisoner") && !impaired;
                NightActionResolution::Poison {
                    target_player_id: target,
                    applied,
                    no_effect_reason: (!applied).then_some(if actual == Some("poisoner") {
                        crate::contracts::NightActionNoEffectReason::ActorImpaired
                    } else {
                        crate::contracts::NightActionNoEffectReason::NotActualCharacter
                    }),
                }
            }
            Some("monk") => {
                let applied = actual == Some("monk") && !impaired;
                NightActionResolution::MonkProtection {
                    target_player_id: target,
                    applied,
                    no_effect_reason: (!applied).then_some(if actual == Some("monk") {
                        crate::contracts::NightActionNoEffectReason::ActorImpaired
                    } else {
                        crate::contracts::NightActionNoEffectReason::NotActualCharacter
                    }),
                }
            }
            Some("imp") => {
                let alive = players.iter().any(|p| p.id == target && p.alive);
                let current_night_start = game_file.game.events.iter().rposition(|event| matches!(&event.kind, GameEventKind::PhaseStepConfirmed { payload } if payload.step_id.ends_with(":toNight")));
                let protection =
                    game_file
                        .game
                        .events
                        .iter()
                        .enumerate()
                        .rev()
                        .find_map(|(index, e)| match &e.kind {
                            GameEventKind::NightActionResolved { payload } => {
                                match &payload.resolution {
                                    NightActionResolution::MonkProtection {
                                        target_player_id,
                                        applied: true,
                                        ..
                                    } if target_player_id == &target
                                        && current_night_start
                                            .is_some_and(|boundary| index > boundary) =>
                                    {
                                        Some(e.id.clone())
                                    }
                                    _ => None,
                                }
                            }
                            _ => None,
                        });
                let outcome = if actual != Some("imp") {
                    ImpAttackOutcome::NoDeath {
                        reason: ImpNoDeathReason::NotActualCharacter,
                    }
                } else if impaired {
                    ImpAttackOutcome::NoDeath {
                        reason: ImpNoDeathReason::ActorImpaired,
                    }
                } else if !alive {
                    ImpAttackOutcome::NoDeath {
                        reason: ImpNoDeathReason::AlreadyDead,
                    }
                } else if let Some(source_event_id) = protection {
                    ImpAttackOutcome::Prevented {
                        reason: ImpPreventionReason::MonkProtection,
                        source_event_id,
                    }
                } else {
                    ImpAttackOutcome::Death {
                        player_id: target.clone(),
                    }
                };
                NightActionResolution::ImpAttack {
                    target_player_id: target,
                    outcome,
                }
            }
            _ => unreachable!(),
        };
        return Ok(night_action_proposal(
            game_file,
            &current_step,
            &players,
            actor,
            resolution,
        ));
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

fn simple_typed_proposal(game_file: &GameFile, step: &PhaseStep, kind: GameEventKind) -> Proposal {
    Proposal {
        event: GameEvent {
            id: format!("phase-step-{}", game_file.game.events.len() + 1),
            kind,
            phase: step.phase,
            summary: format!("{} 확정", step.id),
            created_at: game_file
                .game
                .updated_at
                .clone()
                .unwrap_or_else(|| "1970-01-01T00:00:00.000Z".into()),
        },
        warnings: vec![],
        follow_up_steps: vec![],
        preview: phase_step_preview(false),
        reveal_payload: None,
    }
}

fn night_action_proposal(
    game_file: &GameFile,
    step: &PhaseStep,
    players: &[Player],
    actor: String,
    resolution: NightActionResolution,
) -> Proposal {
    let target_id = match &resolution {
        NightActionResolution::Poison {
            target_player_id, ..
        }
        | NightActionResolution::MonkProtection {
            target_player_id, ..
        }
        | NightActionResolution::ImpAttack {
            target_player_id, ..
        } => target_player_id,
    };
    let label = players
        .iter()
        .find(|p| p.id == *target_id)
        .map(|p| format!("{}번 {}", p.seat, p.name))
        .unwrap_or_else(|| target_id.clone());
    let actor_label = players
        .iter()
        .find(|p| p.id == actor)
        .map(|p| format!("{}번 {}", p.seat, p.name))
        .unwrap_or_else(|| actor.clone());
    let mut warnings = vec![];
    let mut follow_up_steps = vec![];
    let summary = match &resolution {
        NightActionResolution::ImpAttack { outcome, .. } => match outcome {
            ImpAttackOutcome::Death { player_id } => {
                if players
                    .iter()
                    .any(|p| p.id == *player_id && p.actual_character == "ravenkeeper")
                {
                    follow_up_steps.push(json!({ "kind": "ravenkeeperReveal", "stepId": format!("{}:ravenkeeper", step.id.rsplit_once(':').unwrap().0), "playerId": player_id }));
                }
                format!("임프 공격: {label} · 사망")
            }
            ImpAttackOutcome::Prevented { .. } => {
                warnings.push(crate::model::CoreWarning {
                    code: "DEMON_ATTACK_PREVENTED".into(),
                    severity: "warning",
                    message_ko: "수도승 보호로 사망하지 않았습니다.".into(),
                });
                format!("임프 공격: {label} · 사망 없음 (수도승 보호)")
            }
            ImpAttackOutcome::NoDeath {
                reason: ImpNoDeathReason::AlreadyDead,
            } => {
                warnings.push(crate::model::CoreWarning {
                    code: "DEMON_ATTACK_TARGET_ALREADY_DEAD".into(),
                    severity: "warning",
                    message_ko: "이미 사망한 대상입니다.".into(),
                });
                format!("임프 공격: {label} · 사망 없음 (이미 사망)")
            }
            ImpAttackOutcome::NoDeath {
                reason: ImpNoDeathReason::ActorImpaired,
            } => {
                warnings.push(crate::model::CoreWarning {
                    code: "NIGHT_ACTION_NO_EFFECT".into(),
                    severity: "warning",
                    message_ko: "중독 또는 술취함으로 효과가 없습니다.".into(),
                });
                format!("임프 공격: {label} · 사망 없음 ({actor_label} 중독)")
            }
            ImpAttackOutcome::NoDeath {
                reason: ImpNoDeathReason::NotActualCharacter,
            } => {
                warnings.push(crate::model::CoreWarning {
                    code: "NIGHT_ACTION_NO_EFFECT".into(),
                    severity: "warning",
                    message_ko: "실제 캐릭터 능력이 아니어서 효과가 없습니다.".into(),
                });
                format!("임프 공격: {label} · 사망 없음 ({actor_label} 실제 임프 아님)")
            }
        },
        NightActionResolution::Poison { applied: false, .. }
        | NightActionResolution::MonkProtection { applied: false, .. } => {
            warnings.push(crate::model::CoreWarning {
                code: "NIGHT_ACTION_NO_EFFECT".into(),
                severity: "warning",
                message_ko: "행동이 기록되었지만 효과가 없습니다.".into(),
            });
            format!("{} · 효과 없음", step.id)
        }
        _ => format!("{} 확정", step.id),
    };
    Proposal {
        event: GameEvent {
            id: format!("phase-step-{}", game_file.game.events.len() + 1),
            kind: GameEventKind::NightActionResolved {
                payload: NightActionResolvedPayload {
                    step_id: step.id.clone(),
                    actor_player_id: actor,
                    resolution,
                },
            },
            phase: step.phase,
            summary,
            created_at: game_file
                .game
                .updated_at
                .clone()
                .unwrap_or_else(|| "1970-01-01T00:00:00.000Z".into()),
        },
        warnings,
        follow_up_steps,
        preview: phase_step_preview(false),
        reveal_payload: None,
    }
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
    let prefix = step_prefix(&current_step.id)?;
    let mut projected_nominations =
        replay_day_state(&game_file.game.events, players, &prefix)?.nominations;
    projected_nominations.push(record.clone());
    let standing = execution_standing(players, &projected_nominations);
    let event_count = game_file.game.events.len() + 1;

    Ok(Proposal {
        event: GameEvent {
            id: format!("nomination-vote-{event_count}"),
            kind: GameEventKind::NominationVoteConfirmed {
                payload: NominationEventPayload {
                    step_id: current_step.id.clone(),
                    nominator_id: record.nominator_id.clone(),
                    nominee_id: record.nominee_id.clone(),
                    voter_ids: record.voter_ids.clone(),
                    ghost_vote_spent_player_ids: record.ghost_vote_spent_player_ids.clone(),
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
        preview: nomination_vote_preview(&record, &standing),
        reveal_payload: None,
    })
}

pub(crate) fn propose_execution_death(
    game_file: &GameFile,
    current_step: &PhaseStep,
    players: &[Player],
    input: StepInput,
) -> Result<Proposal, CoreError> {
    let died = input
        .as_ref()
        .and_then(|input| input.died)
        .ok_or_else(|| ErrorKind::MalformedCommand.into_error())?;
    let player_id = current_step
        .player_id
        .clone()
        .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
    let player = players
        .iter()
        .find(|player| player.id == player_id && player.alive)
        .ok_or_else(|| ErrorKind::InvalidStepInput.into_error())?;
    if !died && !current_step.required_input.execution_survival_allowed {
        return Err(ErrorKind::ExecutionSurvivalNotAllowed.into_error());
    }

    let event_count = game_file.game.events.len() + 1;
    let (kind, summary) = if died {
        (
            GameEventKind::DeathConfirmed {
                payload: DeathEventPayload {
                    player_id: player.id.clone(),
                    step_id: Some(current_step.id.clone()),
                },
            },
            execution_death_event_summary(players, &player.id),
        )
    } else {
        (
            GameEventKind::ExecutionSurvivalConfirmed {
                payload: ExecutionSurvivalEventPayload {
                    step_id: current_step.id.clone(),
                    player_id: player.id.clone(),
                },
            },
            execution_survival_event_summary(players, &player.id),
        )
    };

    Ok(Proposal {
        event: GameEvent {
            id: format!("execution-death-{event_count}"),
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
        preview: execution_death_preview(),
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
    let day_state = replay_day_state(&game_file.game.events, players, &prefix)?;
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

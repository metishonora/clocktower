use crate::{
    contracts::{
        Command, CreateGamePayload, DeathEventPayload, DemonSuccessionConfirmedPayload,
        EndGameCommandPayload, ExecutionEventInput, ExecutionEventPayload,
        ExecutionSurvivalEventPayload, GameEndedPayload, GameEvent, GameEventKind, GameFile,
        ImpAttackOutcome, ImpNoDeathReason, NightActionResolution, NightActionResolvedPayload,
        NightDeathsAnnouncedPayload, NominationEventPayload, NominationStartedPayload,
        PhaseStepCommandPayload, PhaseStepEventPayload, PlayerAnnotationsUpdatedPayload, Proposal,
        RedHerringAssignedPayload, RevealPayload, SetupEventPayload, SlayerAbilityUsedPayload,
        SlayerImpairmentContext, SlayerNoEffectReason, SlayerOutcome, SmokeEventPayload,
        StepIdPayload, UpdatePlayerAnnotationsCommandPayload, UseSlayerAbilityCommandPayload,
        VirginResolution,
    },
    day::{
        execution_standing, nomination_record, nomination_start_input, replay_day_state,
        step_prefix, validate_nomination_start_roles,
    },
    error::{CoreError, ErrorKind},
    information::{actor_is_impaired, confirmed_information},
    messages::{
        execution_death_event_summary, execution_death_preview, execution_event_summary,
        execution_preview, execution_survival_event_summary, nomination_closed_event_summary,
        nomination_closed_preview, nomination_vote_event_summary, nomination_vote_preview,
        phase_step_event_summary, phase_step_preview, phase_step_reveal_payload,
        player_ability_label, player_verbose_label, setup_event_summary, setup_preview,
        smoke_event_summary, smoke_preview,
    },
    model::{
        Alignment, ExecutionDecisionInput, Phase, PhaseStep, Player, RequiredInputKind, StepInput,
        StepType,
    },
    phase::validate_required_input,
    replay::{replay_rule_state, trouble_brewing_replay_context, TbReplayContext},
    setup::{
        normalized_setup_player_for_script, player_from_setup_input_for_script,
        validate_setup_inputs_for_script, validate_setup_warnings_for_script,
    },
};
use serde_json::json;

pub(crate) fn propose(game_file: GameFile, command: Command) -> Result<Proposal, CoreError> {
    let rules = crate::characters::rules(game_file.script_id);
    rules.validate_command(&command)?;
    if command
        .expected_event_count()
        .is_some_and(|expected| expected != game_file.game.events.len())
    {
        return Err(ErrorKind::StaleCommand.into_error());
    }
    if game_file
        .game
        .events
        .iter()
        .any(|event| matches!(event.kind, GameEventKind::GameEnded { .. }))
    {
        return Err(ErrorKind::GameAlreadyEnded.into_error());
    }
    rules.propose(&game_file, command)
}

pub(crate) fn propose_trouble_brewing(
    game_file: &GameFile,
    command: Command,
) -> Result<Proposal, CoreError> {
    let context = trouble_brewing_replay_context(&game_file.game.events)?;
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
        Command::CreateGame { .. } => unreachable!("createGame is dispatched by ScriptRules"),
        Command::ConfirmStep { payload } => propose_phase_step(game_file, &context, payload, false),
        Command::SkipStep { payload } => propose_phase_step(game_file, &context, payload, true),
        Command::ResolveManualStep { .. } => {
            Err(ErrorKind::CommandNotSupportedByScript.into_error())
        }
        Command::UseSlayerAbility { payload } => {
            propose_slayer_ability(game_file, &context, payload)
        }
        Command::RecordDayAction { .. } => Err(ErrorKind::CommandNotSupportedByScript.into_error()),
        Command::RecordMadnessCheck { .. } | Command::ExecuteMadness { .. } => {
            Err(ErrorKind::CommandNotSupportedByScript.into_error())
        }
        Command::ResolveVigormortisPoison { .. } => {
            Err(ErrorKind::CommandNotSupportedByScript.into_error())
        }
        Command::ResolveSweetheartConsequence { .. }
        | Command::ResolveBarberConsequence { .. }
        | Command::ResolveKlutzConsequence { .. } => {
            Err(ErrorKind::CommandNotSupportedByScript.into_error())
        }
        Command::EndGame { payload } => propose_end_game(game_file, &context, payload),
        Command::UpdatePlayerAnnotations { payload } => {
            propose_player_annotations(game_file, &context, payload)
        }
    }
}

fn propose_player_annotations(
    game_file: &GameFile,
    context: &TbReplayContext,
    payload: UpdatePlayerAnnotationsCommandPayload,
) -> Result<Proposal, CoreError> {
    if payload.expected_event_count != game_file.game.events.len() {
        return Err(ErrorKind::StaleCommand.into_error());
    }
    let players = &context.players;
    crate::annotations::validate_player_annotations(
        players,
        &payload.player_id,
        &payload.system_token_ids,
        &payload.script_tokens,
        &payload.notes,
    )?;
    let player = players
        .iter()
        .find(|player| player.id == payload.player_id)
        .expect("validated annotation player should exist");
    if player.system_token_ids == payload.system_token_ids
        && player.script_tokens == payload.script_tokens
        && player.notes == payload.notes
    {
        return Err(ErrorKind::InvalidPlayerAnnotations.into_error());
    }
    let phase = context.phase_state.phase;
    let token_count = payload.system_token_ids.len() + payload.script_tokens.len();
    let summary = format!(
        "플레이어 표시 수정: {}번 {} · 수동 토큰 {token_count}개 · Notes {}",
        player.seat,
        player.name,
        if payload.notes.is_empty() {
            "없음"
        } else {
            "수정"
        },
    );
    Ok(Proposal {
        event: GameEvent {
            id: format!("player-annotations-{}", game_file.game.events.len() + 1),
            kind: GameEventKind::PlayerAnnotationsUpdated {
                payload: PlayerAnnotationsUpdatedPayload {
                    player_id: payload.player_id,
                    system_token_ids: payload.system_token_ids,
                    script_tokens: payload.script_tokens,
                    notes: payload.notes,
                },
            },
            phase,
            summary: summary.clone(),
            created_at: game_file
                .game
                .updated_at
                .clone()
                .unwrap_or_else(|| "1970-01-01T00:00:00.000Z".into()),
        },
        warnings: vec![],
        follow_up_steps: vec![],
        preview: json!({ "messageKo": summary }),
        reveal_payload: None,
    })
}

fn propose_end_game(
    game_file: &GameFile,
    context: &TbReplayContext,
    payload: EndGameCommandPayload,
) -> Result<Proposal, CoreError> {
    if payload.expected_event_count != game_file.game.events.len() {
        return Err(ErrorKind::StaleCommand.into_error());
    }
    if game_file.game.events.is_empty() {
        return Err(ErrorKind::NoCurrentStep.into_error());
    }
    let phase = context.phase_state.phase;
    let team_label = match payload.winning_team {
        Alignment::Good => "선한 팀",
        Alignment::Evil => "악한 팀",
    };
    let source = context
        .rules_owned_game_ends
        .iter()
        .find(|candidate| candidate.winning_team == payload.winning_team)
        .map(|candidate| candidate.source.clone());
    Ok(Proposal {
        event: GameEvent {
            id: format!("game-ended-{}", game_file.game.events.len() + 1),
            kind: GameEventKind::GameEnded {
                payload: GameEndedPayload {
                    winning_team: payload.winning_team,
                    source,
                },
            },
            phase,
            summary: format!("게임 종료 · {team_label} 승리"),
            created_at: game_file
                .game
                .updated_at
                .clone()
                .unwrap_or_else(|| "1970-01-01T00:00:00.000Z".into()),
        },
        warnings: vec![],
        follow_up_steps: vec![],
        preview: json!({ "messageKo": format!("게임 종료 · {team_label} 승리") }),
        reveal_payload: None,
    })
}

fn propose_slayer_ability(
    game_file: &GameFile,
    context: &TbReplayContext,
    payload: UseSlayerAbilityCommandPayload,
) -> Result<Proposal, CoreError> {
    if payload.expected_event_count != game_file.game.events.len() {
        return Err(ErrorKind::StaleCommand.into_error());
    }
    let players = &context.players;
    let Some(step) = context.phase_state.current_step.as_ref() else {
        return Err(ErrorKind::SlayerWrongPhase.into_error());
    };
    if step.step_type != StepType::Discussion || step.id != payload.discussion_step_id {
        return Err(ErrorKind::SlayerWrongPhase.into_error());
    }
    if game_file
        .game
        .events
        .iter()
        .any(|event| matches!(event.kind, GameEventKind::SlayerAbilityUsed { .. }))
    {
        return Err(ErrorKind::SlayerAlreadyUsed.into_error());
    }
    let actor = players
        .iter()
        .find(|player| {
            player.id == payload.actor_player_id
                && player.alive
                && player.actual_character == "slayer"
        })
        .ok_or_else(|| ErrorKind::InvalidSlayerActor.into_error())?;
    let target = players
        .iter()
        .find(|player| player.id == payload.target_player_id)
        .ok_or_else(|| ErrorKind::InvalidSlayerTarget.into_error())?;
    let rule_state = &context.rule_state;
    let registration_context = crate::characters::slayer_registration(
        target,
        &payload.target_registration,
        rule_state.active_poison.as_ref(),
    )?;
    let impairment_context = rule_state
        .active_poison
        .as_ref()
        .filter(|poison| poison.player_id == actor.id)
        .map(|poison| SlayerImpairmentContext::Poisoned {
            source_player_id: poison.source_player_id.clone(),
            source_event_id: poison.source_event_id.clone(),
        })
        .unwrap_or(SlayerImpairmentContext::Healthy);
    let registered_as_demon = match &registration_context {
        crate::contracts::SlayerRegistrationContext::Canonical {
            registered_as_demon,
        }
        | crate::contracts::SlayerRegistrationContext::RecluseDecision {
            registered_as_demon,
            ..
        } => *registered_as_demon,
    };
    let outcome = if matches!(impairment_context, SlayerImpairmentContext::Poisoned { .. }) {
        SlayerOutcome::NoEffect {
            reason: SlayerNoEffectReason::ActorPoisoned,
        }
    } else if !target.alive {
        SlayerOutcome::NoEffect {
            reason: SlayerNoEffectReason::TargetAlreadyDead,
        }
    } else if !registered_as_demon {
        SlayerOutcome::NoEffect {
            reason: SlayerNoEffectReason::TargetNotDemon,
        }
    } else {
        SlayerOutcome::DeathPending {
            player_id: target.id.clone(),
        }
    };
    let actor_label = format!("{}번 {}", actor.seat, actor.name);
    let target_label = format!("{}번 {}", target.seat, target.name);
    let pending = matches!(outcome, SlayerOutcome::DeathPending { .. });
    Ok(Proposal {
        event: GameEvent {
            id: format!("slayer-ability-{}", game_file.game.events.len() + 1),
            kind: GameEventKind::SlayerAbilityUsed {
                payload: SlayerAbilityUsedPayload {
                    discussion_step_id: payload.discussion_step_id,
                    actor_player_id: actor.id.clone(),
                    target_player_id: target.id.clone(),
                    impairment_context,
                    registration_context,
                    outcome,
                },
            },
            phase: Phase::Day,
            summary: format!(
                "처단자: {actor_label} → {target_label} · {}",
                if pending {
                    "사망 확인 필요"
                } else {
                    "아무 일도 없음"
                }
            ),
            created_at: game_file
                .game
                .updated_at
                .clone()
                .unwrap_or_else(|| "1970-01-01T00:00:00.000Z".into()),
        },
        warnings: vec![],
        follow_up_steps: if pending {
            vec![
                json!({ "kind": "slayerDeath", "stepId": format!("{}:slayerDeath", step.id), "playerId": target.id }),
            ]
        } else {
            vec![]
        },
        preview: json!({ "messageKo": if pending { "사망 확인 필요" } else { "아무 일도 일어나지 않음" } }),
        reveal_payload: None,
    })
}

pub(crate) fn propose_create_game(
    game_file: &GameFile,
    payload: CreateGamePayload,
) -> Result<Proposal, CoreError> {
    if !game_file.game.events.is_empty() {
        return Err(ErrorKind::GameAlreadyHasEvents.into_error());
    }

    validate_setup_inputs_for_script(game_file.script_id, &payload.players)?;

    let players = payload
        .players
        .iter()
        .map(|player| normalized_setup_player_for_script(game_file.script_id, player))
        .collect::<Result<Vec<_>, _>>()?;
    let derived_players = players
        .iter()
        .map(|player| player_from_setup_input_for_script(game_file.script_id, player))
        .collect::<Result<Vec<_>, _>>()?;
    let warnings = validate_setup_warnings_for_script(game_file.script_id, &derived_players);
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
    context: &TbReplayContext,
    payload: PhaseStepCommandPayload,
    skip: bool,
) -> Result<Proposal, CoreError> {
    let players = &context.players;
    let Some(current_step) = context.phase_state.current_step.as_ref() else {
        return Err(ErrorKind::NoCurrentStep.into_error());
    };

    if payload.step_id != current_step.id {
        return Err(ErrorKind::StaleStep.into_error());
    }
    if skip && !current_step.can_skip {
        return Err(ErrorKind::StepCannotBeSkipped.into_error());
    }
    if skip && current_step.step_type == StepType::Nomination {
        return propose_nomination_closed(game_file, current_step);
    }
    if skip && (payload.delivered_result.is_some() || !payload.registration_judgments.is_empty()) {
        return Err(ErrorKind::UnexpectedDeliveredInformation.into_error());
    }
    if !skip
        && current_step.character.as_deref() == Some("butler")
        && current_step.player_id.as_ref().is_some_and(|actor_id| {
            payload
                .input
                .as_ref()
                .and_then(|input| input.player_ids.as_ref())
                .is_some_and(|ids| ids.iter().any(|id| id == actor_id))
        })
    {
        return Err(ErrorKind::InvalidButlerMaster.into_error());
    }
    if !skip && current_step.required_input.kind != RequiredInputKind::SetupInfo {
        validate_required_input(&current_step.required_input, &payload.input, players)?;
    }
    if !skip && current_step.required_input.kind == RequiredInputKind::Nomination {
        return propose_nomination_started(
            game_file,
            current_step,
            players,
            payload.input,
            payload.registration_judgments,
            crate::contracts::WitchNominationResolution::NotApplicable,
        );
    }
    if !skip && current_step.required_input.kind == RequiredInputKind::NominationVote {
        return propose_nomination_vote(game_file, current_step, players, payload.input);
    }
    if !skip && current_step.step_type == StepType::DemonSuccession {
        return propose_demon_succession(
            game_file,
            current_step,
            players,
            context.pending_demon_succession.as_ref(),
            payload.input,
        );
    }
    if !skip && current_step.step_type == StepType::Execution {
        return propose_execution_decision(game_file, current_step, players, payload.input);
    }
    if !skip
        && matches!(
            current_step.step_type,
            StepType::ExecutionDeath | StepType::SlayerDeath
        )
    {
        return propose_execution_death(game_file, current_step, players, payload.input);
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
            .collect::<Vec<_>>();
        let summary = night_deaths_summary(players, &player_ids);
        return Ok(simple_typed_proposal(
            game_file,
            current_step,
            GameEventKind::NightDeathsAnnounced {
                payload: NightDeathsAnnouncedPayload {
                    step_id: current_step.id.clone(),
                    player_ids,
                    resurrected_player_ids: vec![],
                },
            },
            summary,
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
        let summary = format!(
            "{}가 {}를 레드 헤링으로 지정했습니다.",
            current_step
                .player_id
                .as_deref()
                .map(|actor| player_ability_label(players, actor, "fortuneTeller"))
                .unwrap_or_else(|| "점쟁이".to_string()),
            player_verbose_label(players, &player_id)
        );
        return Ok(simple_typed_proposal(
            game_file,
            current_step,
            GameEventKind::RedHerringAssigned {
                payload: RedHerringAssignedPayload {
                    step_id: current_step.id.clone(),
                    player_id,
                    registration_judgments: payload.registration_judgments,
                },
            },
            summary,
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
        let impaired = actor_is_impaired(current_step, players, &game_file.game.events);
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
                let active_poison =
                    crate::night::active_night_poison(&game_file.game.events, players);
                let active_protection =
                    crate::night::active_night_protection(&game_file.game.events, players);
                crate::characters::resolve_imp_attack(
                    players,
                    &actor,
                    &target,
                    payload
                        .input
                        .as_ref()
                        .and_then(|input| input.mayor_decision.as_ref()),
                    active_poison.as_ref(),
                    active_protection.as_ref(),
                )?
            }
            _ => unreachable!(),
        };
        return Ok(night_action_proposal(
            game_file,
            current_step,
            players,
            actor,
            resolution,
        ));
    }

    let event_count = game_file.game.events.len() + 1;
    let information = if skip {
        None
    } else {
        confirmed_information(
            current_step,
            players,
            &game_file.game.events,
            &payload.input,
            payload.delivered_result,
            payload.registration_judgments,
        )?
    };
    let event_input = if skip { None } else { Some(payload.input) };
    let summary = phase_step_event_summary(
        current_step,
        players,
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
        GameEventKind::PhaseStepConfirmed { payload } => payload
            .information
            .as_ref()
            .and_then(|information| phase_step_reveal_payload(current_step, information, players)),
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

fn simple_typed_proposal(
    game_file: &GameFile,
    step: &PhaseStep,
    kind: GameEventKind,
    summary: String,
) -> Proposal {
    Proposal {
        event: GameEvent {
            id: format!("phase-step-{}", game_file.game.events.len() + 1),
            kind,
            phase: step.phase,
            summary,
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

fn night_deaths_summary(players: &[Player], player_ids: &[String]) -> String {
    if player_ids.is_empty() {
        "밤 사망 발표: 없음".to_string()
    } else {
        format!(
            "밤 사망 발표: {}",
            player_ids
                .iter()
                .map(|id| player_verbose_label(players, id))
                .collect::<Vec<_>>()
                .join(", ")
        )
    }
}

fn night_action_proposal(
    game_file: &GameFile,
    step: &PhaseStep,
    players: &[Player],
    actor: String,
    resolution: NightActionResolution,
) -> Proposal {
    let actor_label = player_ability_label(
        players,
        &actor,
        step.character.as_deref().unwrap_or("unknown"),
    );
    let mut warnings = vec![];
    let mut follow_up_steps = vec![];
    let summary = match &resolution {
        NightActionResolution::ImpAttack {
            target_player_id,
            mayor_context,
            outcome,
        } => {
            let selected = player_verbose_label(players, target_player_id);
            let bounce = match mayor_context {
                crate::contracts::MayorAttackContext::Bounced {
                    bounce_target_player_id,
                    ..
                } => format!(
                    " · {}에게 바운스",
                    player_verbose_label(players, bounce_target_player_id)
                ),
                _ => String::new(),
            };
            let outcome_label = match outcome {
                ImpAttackOutcome::Death { player_id } => {
                    if players
                        .iter()
                        .any(|p| p.id == *player_id && p.actual_character == "ravenkeeper")
                    {
                        follow_up_steps.push(json!({ "kind": "ravenkeeperReveal", "stepId": format!("{}:ravenkeeper", step.id.rsplit_once(':').unwrap().0), "playerId": player_id }));
                    }
                    "사망".to_string()
                }
                ImpAttackOutcome::Prevented { .. } => {
                    warnings.push(crate::model::CoreWarning {
                        code: "DEMON_ATTACK_PREVENTED".into(),
                        severity: "warning",
                        message_ko: "수도승 보호로 사망하지 않았습니다.".into(),
                        winning_team: None,
                    });
                    "사망 없음 (수도사 보호)".to_string()
                }
                ImpAttackOutcome::SoldierProtected { .. } => {
                    warnings.push(crate::model::CoreWarning {
                        code: "DEMON_ATTACK_PREVENTED".into(),
                        severity: "warning",
                        message_ko: "군인 보호로 사망하지 않았습니다.".into(),
                        winning_team: None,
                    });
                    "사망 없음 (군인 보호)".to_string()
                }
                ImpAttackOutcome::NoDeath {
                    reason: ImpNoDeathReason::AlreadyDead,
                } => {
                    warnings.push(crate::model::CoreWarning {
                        code: "DEMON_ATTACK_TARGET_ALREADY_DEAD".into(),
                        severity: "warning",
                        message_ko: "이미 사망한 대상입니다.".into(),
                        winning_team: None,
                    });
                    "사망 없음 (이미 사망)".to_string()
                }
                ImpAttackOutcome::NoDeath {
                    reason: ImpNoDeathReason::ActorImpaired,
                } => {
                    warnings.push(crate::model::CoreWarning {
                        code: "NIGHT_ACTION_NO_EFFECT".into(),
                        severity: "warning",
                        message_ko: "중독 또는 술취함으로 효과가 없습니다.".into(),
                        winning_team: None,
                    });
                    "사망 없음 (행동자 중독)".to_string()
                }
                ImpAttackOutcome::NoDeath {
                    reason: ImpNoDeathReason::NotActualCharacter,
                } => {
                    warnings.push(crate::model::CoreWarning {
                        code: "NIGHT_ACTION_NO_EFFECT".into(),
                        severity: "warning",
                        message_ko: "실제 캐릭터 능력이 아니어서 효과가 없습니다.".into(),
                        winning_team: None,
                    });
                    "사망 없음 (실제 임프 아님)".to_string()
                }
            };
            format!("{actor_label} → {selected} 공격{bounce} · {outcome_label}")
        }
        NightActionResolution::Poison {
            target_player_id,
            applied,
            no_effect_reason,
        }
        | NightActionResolution::MonkProtection {
            target_player_id,
            applied,
            no_effect_reason,
        } => {
            let is_poison = matches!(resolution, NightActionResolution::Poison { .. });
            if !applied {
                warnings.push(crate::model::CoreWarning {
                    code: "NIGHT_ACTION_NO_EFFECT".into(),
                    severity: "warning",
                    message_ko: "행동이 기록되었지만 효과가 없습니다.".into(),
                    winning_team: None,
                });
            }
            let result = if *applied {
                if is_poison {
                    "중독 적용"
                } else {
                    "수도사 보호 적용"
                }
                .to_string()
            } else {
                let reason = match no_effect_reason {
                    Some(crate::contracts::NightActionNoEffectReason::ActorImpaired) => {
                        "행동자 중독"
                    }
                    Some(crate::contracts::NightActionNoEffectReason::NotActualCharacter) => {
                        if is_poison {
                            "실제 독살범 아님"
                        } else {
                            "실제 수도사 아님"
                        }
                    }
                    None => "원인 불명",
                };
                format!("효과 없음 ({reason})")
            };
            format!(
                "{actor_label} → {} · {result}",
                player_verbose_label(players, target_player_id)
            )
        }
        NightActionResolution::DemonAttack { .. } => {
            unreachable!("S&V Demon attacks use the script-specific proposal path")
        }
    };
    Proposal {
        event: GameEvent {
            id: format!("phase-step-{}", game_file.game.events.len() + 1),
            kind: GameEventKind::NightActionResolved {
                payload: NightActionResolvedPayload {
                    step_id: step.id.clone(),
                    actor_player_id: actor,
                    actor_character_id: None,
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

pub(crate) fn propose_nomination_started(
    game_file: &GameFile,
    current_step: &PhaseStep,
    players: &[Player],
    input: StepInput,
    registration_judgments: Vec<crate::model::RegistrationJudgment>,
    witch_resolution: crate::contracts::WitchNominationResolution,
) -> Result<Proposal, CoreError> {
    let input = nomination_start_input(&input)?;
    let prefix = step_prefix(&current_step.id)?;
    validate_nomination_start_roles(
        players,
        &game_file.game.events,
        &prefix,
        &input.nominator_id,
        &input.nominee_id,
    )?;
    let rule_state = replay_rule_state(&game_file.game.events, players);
    let already_spent = game_file.game.events.iter().any(|event| {
        matches!(
            &event.kind,
            GameEventKind::NominationStarted { payload }
                if !matches!(payload.virgin_resolution, VirginResolution::NotApplicable)
        )
    });
    let virgin_resolution = crate::characters::virgin_resolution(
        players,
        &input.nominator_id,
        &input.nominee_id,
        &registration_judgments,
        already_spent,
        rule_state.active_poison.as_ref(),
    )?;
    let event_count = game_file.game.events.len() + 1;
    let event_id = format!("nomination-started-{event_count}");
    let immediate_execution = matches!(
        virgin_resolution,
        VirginResolution::SpentAndNominatorExecuted { .. }
    );

    Ok(Proposal {
        event: GameEvent {
            id: event_id,
            kind: GameEventKind::NominationStarted {
                payload: NominationStartedPayload {
                    step_id: current_step.id.clone(),
                    nominator_id: input.nominator_id.clone(),
                    nominee_id: input.nominee_id.clone(),
                    registration_judgments,
                    virgin_resolution,
                    witch_resolution,
                },
            },
            phase: current_step.phase,
            summary: format!(
                "지목 확정: {} → {}",
                player_verbose_label(players, &input.nominator_id),
                player_verbose_label(players, &input.nominee_id)
            ),
            created_at: game_file
                .game
                .updated_at
                .clone()
                .unwrap_or_else(|| "1970-01-01T00:00:00.000Z".to_string()),
        },
        warnings: Vec::new(),
        follow_up_steps: if immediate_execution {
            vec![json!({
                "kind": "virginDeath",
                "stepId": format!("{}:virginDeath", current_step.id),
                "playerId": input.nominator_id
            })]
        } else {
            vec![json!({
                "kind": "nominationVote",
                "stepId": format!("{}:vote", current_step.id)
            })]
        },
        preview: json!({
            "messageKo": if immediate_execution { "지목자를 즉시 처형합니다." } else { "지목을 확정하고 투표로 이동합니다." }
        }),
        reveal_payload: None,
    })
}

pub(crate) fn propose_nomination_vote(
    game_file: &GameFile,
    current_step: &PhaseStep,
    players: &[Player],
    input: StepInput,
) -> Result<Proposal, CoreError> {
    let (record, active) =
        nomination_record(current_step, players, &input, &game_file.game.events)?;
    let active_poison = crate::night::active_night_poison(&game_file.game.events, players);
    let butler_vote = crate::characters::butler_vote_state(
        players,
        &game_file.game.events,
        active_poison.as_ref(),
    );
    crate::characters::validate_butler_voters(butler_vote.as_ref(), &record.voter_ids)?;
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
                    nomination_event_id: Some(active.event_id),
                    nominator_id: None,
                    nominee_id: None,
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

fn propose_demon_succession(
    game_file: &GameFile,
    current_step: &PhaseStep,
    players: &[Player],
    pending: Option<&crate::replay::PendingDemonSuccession>,
    input: StepInput,
) -> Result<Proposal, CoreError> {
    let pending = pending.ok_or_else(|| ErrorKind::StaleStep.into_error())?;
    if current_step.id != format!("{}:demonSuccession", pending.trigger_event_id) {
        return Err(ErrorKind::StaleStep.into_error());
    }
    let successor_player_id = input
        .as_ref()
        .and_then(|input| input.successor_player_id.clone())
        .ok_or_else(|| ErrorKind::MissingStepInput.into_error())?;
    let allowed = match &pending.prompt {
        crate::model::DemonSuccessionPrompt::Fixed {
            successor_player_id: fixed,
            ..
        } => fixed == &successor_player_id,
        crate::model::DemonSuccessionPrompt::Selectable {
            allowed_player_ids, ..
        } => allowed_player_ids.contains(&successor_player_id),
    };
    let successor = players
        .iter()
        .find(|player| player.id == successor_player_id && player.alive)
        .ok_or_else(|| ErrorKind::InvalidStepInput.into_error())?;
    if !allowed {
        return Err(ErrorKind::InvalidStepInput.into_error());
    }
    let event_count = game_file.game.events.len() + 1;
    Ok(Proposal {
        event: GameEvent {
            id: format!("demon-succession-{event_count}"),
            kind: GameEventKind::DemonSuccessionConfirmed {
                payload: DemonSuccessionConfirmedPayload {
                    trigger_imp_death_event_id: pending.trigger_event_id.clone(),
                    death_cause: pending.death_cause,
                    previous_imp_player_id: pending.previous_imp_player_id.clone(),
                    successor_player_id: successor.id.clone(),
                    successor_previous_actual_character: successor.actual_character.clone(),
                    new_character: "imp".into(),
                    source: pending.source,
                },
            },
            phase: pending.phase,
            summary: format!(
                "악마 승계 확정: {} · 새 캐릭터 임프",
                player_verbose_label(players, &successor.id)
            ),
            created_at: game_file
                .game
                .updated_at
                .clone()
                .unwrap_or_else(|| "1970-01-01T00:00:00.000Z".into()),
        },
        warnings: vec![],
        follow_up_steps: vec![],
        preview: json!({ "messageKo": "새 임프를 확정합니다." }),
        reveal_payload: (pending.phase == Phase::Night).then(|| RevealPayload::CharacterChange {
            kind: "characterChange",
            player_id: successor.id.clone(),
            alignment: "evil".into(),
            character_id: "imp".into(),
        }),
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

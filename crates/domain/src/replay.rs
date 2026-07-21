use std::collections::HashMap;

use crate::{
    contracts::{
        ActiveRuleEffect, DemonDeathCause, DemonSuccessionConfirmedPayload, DemonSuccessionSource,
        GameEndState, GameEvent, GameEventKind, GameFile, ImpAttackOutcome, MayorAttackContext,
        NightActionNoEffectReason, NightActionResolution, ReplayState, RuleState,
        SlayerAbilityUsedPayload, SlayerImpairmentContext, SlayerNoEffectReason, SlayerOutcome,
        SlayerRegistrationContext, SlayerTargetRegistration, VirginResolution,
    },
    day::{
        day_steps, replay_day_state, step_prefix, validate_nomination_event_input,
        validate_nomination_roles, validate_nomination_start_roles,
    },
    error::{CoreError, ErrorKind},
    information::{actor_is_impaired, information_prompt, validate_confirmed_information},
    model::{
        Alignment, DemonSuccessionPrompt, InputTarget, MayorDecisionInput, Phase,
        PhaseOverviewItem, PhaseStep, PhaseStepStatus, Player, RegistrationJudgment, RequiredInput,
        RequiredInputKind, SlayerAbilityState, StepType, VirginAbilityState,
    },
    night::{first_night_steps, night_steps},
    phase::{step_status, validate_required_input},
    setup::{player_from_setup_input, validate_setup_inputs, validate_setup_warnings},
};

pub(crate) fn replay(game_file: GameFile) -> Result<ReplayState, CoreError> {
    crate::characters::rules(game_file.script_id).validate_replay_events(&game_file.game.events)?;
    let events = &game_file.game.events;
    let ended_positions = events
        .iter()
        .enumerate()
        .filter_map(|(index, event)| {
            matches!(event.kind, GameEventKind::GameEnded { .. }).then_some(index)
        })
        .collect::<Vec<_>>();
    if ended_positions.len() > 1
        || ended_positions
            .first()
            .is_some_and(|index| *index != events.len().saturating_sub(1))
    {
        return Err(ErrorKind::ReplayFailed.into_error());
    }
    let active_events = ended_positions
        .first()
        .map_or(events.as_slice(), |index| &events[..*index]);
    let players = replay_players(active_events)?;
    let mut warnings = validate_setup_warnings(&players);
    let phase_state = replay_phase_state(&players, active_events)?;
    let day_state = if phase_state.phase == Phase::Day {
        current_day_prefix(&phase_state)
            .map(|prefix| replay_day_state(active_events, &players, &prefix))
            .transpose()?
    } else {
        None
    };

    let mut rule_state = replay_rule_state(active_events, &players);
    if let Some(actor) = players
        .iter()
        .find(|player| player.actual_character == "slayer")
    {
        let spent = active_events
            .iter()
            .any(|event| matches!(event.kind, GameEventKind::SlayerAbilityUsed { .. }));
        let can_use_now = actor.alive
            && !spent
            && phase_state
                .current_step
                .as_ref()
                .is_some_and(|step| step.step_type == StepType::Discussion);
        rule_state.slayer_ability = Some(SlayerAbilityState {
            actor_player_id: actor.id.clone(),
            spent,
            can_use_now,
        });
    }
    if let Some(actor) = players
        .iter()
        .find(|player| player.actual_character == "virgin")
    {
        let spent_by_nomination_event_id =
            active_events.iter().find_map(|event| match &event.kind {
                GameEventKind::NominationStarted { payload }
                    if !matches!(payload.virgin_resolution, VirginResolution::NotApplicable) =>
                {
                    Some(event.id.clone())
                }
                _ => None,
            });
        rule_state.virgin_ability = Some(VirginAbilityState {
            actor_player_id: actor.id.clone(),
            spent: spent_by_nomination_event_id.is_some(),
            spent_by_nomination_event_id,
        });
    }
    if !rule_state.unannounced_night_death_player_ids.is_empty() {
        warnings.push(crate::model::CoreWarning {
            code: "NIGHT_DEATH_UNANNOUNCED".into(),
            severity: "warning",
            message_ko: "공개하지 않은 밤 사망이 있습니다.".into(),
            winning_team: None,
        });
    }
    if saint_executed_with_ability(active_events)? {
        warnings.push(crate::model::CoreWarning {
            code: "SAINT_EXECUTED_EVIL_WIN".into(),
            severity: "warning",
            message_ko: "성자 처형 사망: 악 승리 확인 필요".into(),
            winning_team: Some(Alignment::Evil),
        });
    }
    if !players.is_empty()
        && crate::characters::demon_dead_without_successor(
            &players,
            pending_demon_succession(active_events)?.is_some(),
        )
    {
        warnings.push(crate::model::CoreWarning {
            code: "DEMON_DEAD_GOOD_WIN".into(),
            severity: "warning",
            message_ko: "악마 사망: 선 승리 확인 필요".into(),
            winning_team: Some(Alignment::Good),
        });
    }
    if !players.is_empty() && players.iter().filter(|player| player.alive).count() <= 2 {
        warnings.push(crate::model::CoreWarning {
            code: "TWO_LIVING_PLAYERS_EVIL_WIN".into(),
            severity: "warning",
            message_ko: "생존자 2명: 악 승리 확인 필요".into(),
            winning_team: Some(Alignment::Evil),
        });
    }
    if mayor_win_condition_occurred(active_events)? {
        warnings.push(crate::model::CoreWarning {
            code: "MAYOR_GOOD_WIN".into(),
            severity: "warning",
            message_ko: "시장 무처형 조건: 선 승리 확인 필요".into(),
            winning_team: Some(Alignment::Good),
        });
    }
    let game_end = ended_positions
        .first()
        .map(|index| {
            let event = &events[*index];
            let GameEventKind::GameEnded { payload } = &event.kind else {
                unreachable!()
            };
            if event.phase != phase_state.phase {
                return Err(ErrorKind::ReplayFailed.into_error());
            }
            Ok(GameEndState {
                event_id: event.id.clone(),
                winning_team: payload.winning_team,
            })
        })
        .transpose()?;
    let (current_step, phase_overview) = if game_end.is_some() {
        (None, vec![])
    } else {
        (phase_state.current_step, phase_state.phase_overview)
    };
    Ok(ReplayState {
        schema_version: game_file.schema_version,
        script_id: game_file.script_id,
        event_count: events.len(),
        phase: phase_state.phase,
        players,
        current_step,
        phase_overview,
        day_state,
        warnings,
        rule_state,
        game_end,
    })
}

fn mayor_win_condition_occurred(events: &[GameEvent]) -> Result<bool, CoreError> {
    for (event_index, event) in events.iter().enumerate() {
        let GameEventKind::NoExecutionConfirmed { payload } = &event.kind else {
            continue;
        };
        let players = replay_players(&events[..event_index])?;
        let rule_state = replay_rule_state(&events[..event_index], &players);
        if !crate::characters::mayor_win_eligible(&players, rule_state.active_poison.as_ref()) {
            continue;
        }
        let prefix = step_prefix(&payload.step_id)?;
        let execution_occurred =
            events[..event_index]
                .iter()
                .any(|candidate| match &candidate.kind {
                    GameEventKind::ExecutionConfirmed { payload } => {
                        payload.step_id.starts_with(&prefix)
                    }
                    GameEventKind::DeathConfirmed { payload } => {
                        payload.step_id.as_deref().is_some_and(|step_id| {
                            step_id.starts_with(&prefix) && step_id.ends_with(":virginDeath")
                        })
                    }
                    _ => false,
                });
        if !execution_occurred {
            return Ok(true);
        }
    }
    Ok(false)
}

fn saint_executed_with_ability(events: &[GameEvent]) -> Result<bool, CoreError> {
    for (event_index, event) in events.iter().enumerate() {
        let GameEventKind::DeathConfirmed { payload } = &event.kind else {
            continue;
        };
        if !payload.step_id.as_deref().is_some_and(|step_id| {
            step_id.ends_with(":executionDeath") || step_id.ends_with(":virginDeath")
        }) {
            continue;
        }
        let players_before = replay_players(&events[..event_index])?;
        let Some(saint) = players_before.iter().find(|player| {
            player.id == payload.player_id && player.alive && player.actual_character == "saint"
        }) else {
            continue;
        };
        let rule_state = replay_rule_state(&events[..event_index], &players_before);
        if rule_state
            .active_poison
            .as_ref()
            .is_none_or(|poison| poison.player_id != saint.id)
        {
            return Ok(true);
        }
    }
    Ok(false)
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
            GameEventKind::NightActionResolved { payload } => {
                if let NightActionResolution::ImpAttack {
                    outcome: ImpAttackOutcome::Death { player_id },
                    ..
                } = &payload.resolution
                {
                    let Some(player) = players.iter_mut().find(|player| &player.id == player_id)
                    else {
                        return Err(ErrorKind::ReplayFailed.into_error());
                    };
                    if !player.alive {
                        return Err(ErrorKind::ReplayFailed.into_error());
                    }
                    player.alive = false;
                }
            }
            GameEventKind::NominationVoteConfirmed { payload } => {
                for player_id in &payload.ghost_vote_spent_player_ids {
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
            GameEventKind::DemonSuccessionConfirmed { payload } => {
                let Some(successor) = players
                    .iter_mut()
                    .find(|player| player.id == payload.successor_player_id)
                else {
                    return Err(ErrorKind::ReplayFailed.into_error());
                };
                successor.actual_character = "imp".into();
                successor.shown_character = "imp".into();
                successor.alignment = crate::model::Alignment::Evil;
            }
            GameEventKind::PlayerAnnotationsUpdated { payload } => {
                crate::annotations::validate_player_annotations(
                    &players,
                    &payload.player_id,
                    &payload.system_token_ids,
                    &payload.script_tokens,
                    &payload.notes,
                )?;
                let player = players
                    .iter_mut()
                    .find(|player| player.id == payload.player_id)
                    .expect("validated annotation player should exist");
                player.system_token_ids = payload.system_token_ids.clone();
                player.script_tokens = payload.script_tokens.clone();
                player.notes = payload.notes.clone();
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

#[derive(Debug, Clone)]
pub(crate) struct PendingDemonSuccession {
    pub(crate) trigger_event_id: String,
    pub(crate) phase: Phase,
    pub(crate) death_cause: DemonDeathCause,
    pub(crate) previous_imp_player_id: String,
    pub(crate) prompt: DemonSuccessionPrompt,
    pub(crate) source: DemonSuccessionSource,
}

pub(crate) fn pending_demon_succession(
    events: &[GameEvent],
) -> Result<Option<PendingDemonSuccession>, CoreError> {
    for (event_index, event) in events.iter().enumerate() {
        if events.iter().any(|candidate| {
            matches!(
                &candidate.kind,
                GameEventKind::DemonSuccessionConfirmed { payload }
                    if payload.trigger_imp_death_event_id == event.id
            )
        }) {
            continue;
        }
        let players_before = replay_players(&events[..event_index])?;
        let trigger = match &event.kind {
            GameEventKind::NightActionResolved { payload } => match &payload.resolution {
                NightActionResolution::ImpAttack {
                    target_player_id,
                    outcome: ImpAttackOutcome::Death { player_id },
                    ..
                } if target_player_id == &payload.actor_player_id
                    && player_id == &payload.actor_player_id
                    && players_before.iter().any(|player| {
                        player.id == payload.actor_player_id
                            && player.actual_character == "imp"
                            && player.alive
                    }) =>
                {
                    Some((DemonDeathCause::ImpSelfKill, player_id.clone()))
                }
                _ => None,
            },
            GameEventKind::DeathConfirmed { payload } => {
                let cause = if payload
                    .step_id
                    .as_deref()
                    .is_some_and(|step_id| step_id.ends_with(":slayerDeath"))
                {
                    Some(DemonDeathCause::Slayer)
                } else if payload.step_id.as_deref().is_some_and(|step_id| {
                    step_id.ends_with(":executionDeath") || step_id.ends_with(":virginDeath")
                }) {
                    Some(DemonDeathCause::Execution)
                } else {
                    None
                };
                cause.and_then(|cause| {
                    players_before
                        .iter()
                        .any(|player| {
                            player.id == payload.player_id
                                && player.actual_character == "imp"
                                && player.alive
                        })
                        .then(|| (cause, payload.player_id.clone()))
                })
            }
            _ => None,
        };
        let Some((death_cause, previous_imp_player_id)) = trigger else {
            continue;
        };
        let rule_state = replay_rule_state(&events[..event_index], &players_before);
        let fixed_scarlet_woman = crate::characters::scarlet_woman_successor(
            &players_before,
            rule_state.active_poison.as_ref(),
        );
        if let Some(successor) = fixed_scarlet_woman {
            return Ok(Some(PendingDemonSuccession {
                trigger_event_id: event.id.clone(),
                phase: event.phase,
                death_cause,
                previous_imp_player_id,
                prompt: DemonSuccessionPrompt::Fixed {
                    trigger_event_id: event.id.clone(),
                    successor_player_id: successor.id.clone(),
                },
                source: DemonSuccessionSource::ScarletWoman,
            }));
        }
        if death_cause == DemonDeathCause::ImpSelfKill {
            let allowed_player_ids =
                crate::characters::imp_self_kill_successor_ids(&players_before);
            if !allowed_player_ids.is_empty() {
                return Ok(Some(PendingDemonSuccession {
                    trigger_event_id: event.id.clone(),
                    phase: event.phase,
                    death_cause,
                    previous_imp_player_id,
                    prompt: DemonSuccessionPrompt::Selectable {
                        trigger_event_id: event.id.clone(),
                        allowed_player_ids,
                    },
                    source: DemonSuccessionSource::ImpSelfKill,
                }));
            }
        }
    }
    Ok(None)
}

fn demon_succession_step(pending: &PendingDemonSuccession) -> PhaseStep {
    let (target, min_selections, max_selections, allowed_player_ids, player_id) =
        match &pending.prompt {
            DemonSuccessionPrompt::Fixed {
                successor_player_id,
                ..
            } => (None, None, None, None, Some(successor_player_id.clone())),
            DemonSuccessionPrompt::Selectable {
                allowed_player_ids, ..
            } => (
                Some(InputTarget::Player),
                Some(1),
                Some(1),
                Some(allowed_player_ids.clone()),
                None,
            ),
        };
    PhaseStep {
        id: format!("{}:demonSuccession", pending.trigger_event_id),
        phase: pending.phase,
        step_type: StepType::DemonSuccession,
        character: Some("imp".into()),
        player_id,
        required_input: RequiredInput {
            kind: RequiredInputKind::DemonSuccession,
            target,
            min_selections,
            max_selections,
            setup_info: None,
            character_kind: None,
            allowed_character_ids: None,
            allowed_player_ids,
            player_registration_options: None,
            zero_allowed: false,
            supports_random_suggestion: false,
            player_id: None,
            survival_allowed: None,
            execution_survival_allowed: false,
            mayor_decision: None,
            demon_succession: Some(pending.prompt.clone()),
            optional: false,
        },
        can_skip: false,
        information_prompt: None,
        pre_action_reveal: None,
    }
}

fn validate_demon_succession_event(
    payload: &DemonSuccessionConfirmedPayload,
    prefix: &[GameEvent],
) -> Result<(), CoreError> {
    let pending =
        pending_demon_succession(prefix)?.ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
    let players = replay_players(prefix)?;
    let successor = players
        .iter()
        .find(|player| player.id == payload.successor_player_id && player.alive)
        .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
    let allowed = match &pending.prompt {
        DemonSuccessionPrompt::Fixed {
            successor_player_id,
            ..
        } => successor_player_id == &payload.successor_player_id,
        DemonSuccessionPrompt::Selectable {
            allowed_player_ids, ..
        } => allowed_player_ids.contains(&payload.successor_player_id),
    };
    if !allowed
        || payload.trigger_imp_death_event_id != pending.trigger_event_id
        || payload.death_cause != pending.death_cause
        || payload.previous_imp_player_id != pending.previous_imp_player_id
        || payload.successor_previous_actual_character != successor.actual_character
        || payload.new_character != "imp"
        || payload.source != pending.source
    {
        return Err(ErrorKind::ReplayFailed.into_error());
    }
    Ok(())
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

    let step_statuses = phase_step_statuses(events)?;
    if let Some(pending) = pending_demon_succession(events)? {
        let step = demon_succession_step(&pending);
        return Ok(PhaseReplayState {
            phase: pending.phase,
            current_step: Some(step.clone()),
            phase_overview: vec![PhaseOverviewItem {
                id: step.id,
                phase: step.phase,
                step_type: step.step_type,
                character: step.character,
                player_id: step.player_id,
                required_input: step.required_input,
                can_skip: false,
                information_prompt: None,
                status: PhaseStepStatus::Current,
            }],
        });
    }
    if let Some((discussion_step_id, player_id)) = pending_slayer_death(events) {
        let step = slayer_death_step(&discussion_step_id, &player_id);
        return Ok(PhaseReplayState {
            phase: Phase::Day,
            current_step: Some(step.clone()),
            phase_overview: vec![PhaseOverviewItem {
                id: step.id,
                phase: step.phase,
                step_type: step.step_type,
                character: None,
                player_id: step.player_id,
                required_input: step.required_input,
                can_skip: false,
                information_prompt: None,
                status: PhaseStepStatus::Current,
            }],
        });
    }
    for (phase, steps) in
        phase_sequences_with_statuses(players, events, events.len() + 2, &step_statuses)
    {
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
) -> Result<HashMap<String, PhaseStepStatus>, CoreError> {
    let mut statuses = HashMap::new();
    for (event_index, event) in events.iter().enumerate() {
        if let GameEventKind::DemonSuccessionConfirmed { payload } = &event.kind {
            validate_demon_succession_event(payload, &events[..event_index])?;
            let pending = pending_demon_succession(&events[..event_index])?
                .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
            if event.phase != pending.phase {
                return Err(ErrorKind::ReplayFailed.into_error());
            }
            continue;
        }
        if let GameEventKind::SlayerAbilityUsed { payload } = &event.kind {
            validate_slayer_event(payload, event.phase, &events[..event_index], &statuses)?;
            continue;
        }
        if let GameEventKind::DeathConfirmed { payload } = &event.kind {
            if payload
                .step_id
                .as_deref()
                .is_some_and(|id| id.ends_with(":slayerDeath"))
            {
                let Some((discussion_step_id, player_id)) =
                    pending_slayer_death(&events[..event_index])
                else {
                    return Err(ErrorKind::ReplayFailed.into_error());
                };
                if payload.step_id.as_deref()
                    != Some(format!("{discussion_step_id}:slayerDeath").as_str())
                    || payload.player_id != player_id
                    || event.phase != Phase::Day
                    || !replay_players(&events[..event_index])?
                        .iter()
                        .any(|player| player.id == player_id && player.alive)
                {
                    return Err(ErrorKind::ReplayFailed.into_error());
                }
                continue;
            }
        }
        // Schema-v2 compatibility: older logs may already contain a Fortune Teller check,
        // or may have closed a night, before issue #8 introduced these generated steps.
        let incoming_step_id = match &event.kind {
            GameEventKind::PhaseStepConfirmed { payload } => Some(payload.step_id.as_str()),
            GameEventKind::PhaseStepSkipped { payload } => Some(payload.step_id.as_str()),
            _ => None,
        };
        if incoming_step_id.is_some_and(|id| id.ends_with(":fortuneTeller")) {
            let prefix = incoming_step_id.unwrap().rsplit_once(':').unwrap().0;
            statuses
                .entry(format!("{prefix}:fortuneTellerRedHerring"))
                .or_insert(PhaseStepStatus::Skipped);
        }
        if incoming_step_id.is_some_and(|id| {
            id.starts_with("night")
                && matches!(
                    id.rsplit_once(':').map(|p| p.1),
                    Some("fortuneTeller" | "butler" | "spy" | "toDay")
                )
        }) {
            if let Some(prefix) = incoming_step_id.and_then(|id| id.rsplit_once(':').map(|p| p.0)) {
                let legacy_imp = events[..event_index].iter().any(|event| matches!(&event.kind,
                    GameEventKind::PhaseStepConfirmed { payload } if payload.step_id == format!("{prefix}:imp")));
                if legacy_imp {
                    statuses
                        .entry(format!("{prefix}:empath"))
                        .or_insert(PhaseStepStatus::Skipped);
                }
            }
        }
        if incoming_step_id.is_some_and(|id| id.starts_with("night") && id.ends_with(":undertaker"))
        {
            let cycle = incoming_step_id
                .and_then(|id| id.split(':').next())
                .map(|p| {
                    if p == "night" {
                        1
                    } else {
                        p.trim_start_matches("night").parse().unwrap_or(1)
                    }
                })
                .unwrap_or(1);
            if crate::night::previous_executed_death(&events[..event_index], cycle).is_none() {
                statuses.insert(
                    incoming_step_id.unwrap().to_string(),
                    PhaseStepStatus::Complete,
                );
                continue;
            }
        }
        let (status, step_id, event_input) = match &event.kind {
            GameEventKind::PhaseStepConfirmed { payload } => (
                PhaseStepStatus::Complete,
                payload.step_id.as_str(),
                Some(&payload.input),
            ),
            GameEventKind::NominationVoteConfirmed { payload } => {
                (PhaseStepStatus::Complete, payload.step_id.as_str(), None)
            }
            GameEventKind::NominationStarted { payload } => {
                (PhaseStepStatus::Complete, payload.step_id.as_str(), None)
            }
            GameEventKind::ExecutionConfirmed { payload }
            | GameEventKind::NoExecutionConfirmed { payload } => {
                (PhaseStepStatus::Complete, payload.step_id.as_str(), None)
            }
            GameEventKind::DeathConfirmed { payload } if payload.step_id.is_some() => (
                PhaseStepStatus::Complete,
                payload.step_id.as_deref().expect("checked above"),
                None,
            ),
            GameEventKind::ExecutionSurvivalConfirmed { payload } => {
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
            GameEventKind::RedHerringAssigned { payload } => {
                (PhaseStepStatus::Complete, payload.step_id.as_str(), None)
            }
            GameEventKind::NightActionResolved { payload } => {
                (PhaseStepStatus::Complete, payload.step_id.as_str(), None)
            }
            GameEventKind::NightDeathsAnnounced { payload } => {
                (PhaseStepStatus::Complete, payload.step_id.as_str(), None)
            }
            _ => continue,
        };
        let players_at_event = replay_players(&events[..event_index])?;
        let Some((_, _, Some(step))) = current_phase_steps(
            &players_at_event,
            &events[..event_index],
            events.len() + 2,
            &statuses,
        ) else {
            return Err(ErrorKind::ReplayFailed.into_error());
        };
        if step.id != step_id {
            return Err(ErrorKind::ReplayFailed.into_error());
        }
        if event.phase != step.phase {
            return Err(ErrorKind::ReplayFailed.into_error());
        }
        if matches!(status, PhaseStepStatus::Skipped) && !step.can_skip {
            return Err(ErrorKind::ReplayFailed.into_error());
        }
        match &event.kind {
            GameEventKind::NominationStarted { payload } => {
                let prefix = step_prefix(&payload.step_id)?;
                validate_nomination_start_roles(
                    &players_at_event,
                    &events[..event_index],
                    &prefix,
                    &payload.nominator_id,
                    &payload.nominee_id,
                )
                .map_err(|_| ErrorKind::ReplayFailed.into_error())?;
                let already_spent = events[..event_index].iter().any(|event| {
                    matches!(
                        &event.kind,
                        GameEventKind::NominationStarted { payload }
                            if !matches!(payload.virgin_resolution, VirginResolution::NotApplicable)
                    )
                });
                let rule_state = replay_rule_state(&events[..event_index], &players_at_event);
                let expected = crate::characters::virgin_resolution(
                    &players_at_event,
                    &payload.nominator_id,
                    &payload.nominee_id,
                    &payload.registration_judgments,
                    already_spent,
                    rule_state.active_poison.as_ref(),
                )
                .map_err(|_| ErrorKind::ReplayFailed.into_error())?;
                if step.required_input.kind != RequiredInputKind::Nomination
                    || payload.virgin_resolution != expected
                {
                    return Err(ErrorKind::ReplayFailed.into_error());
                }
            }
            GameEventKind::RedHerringAssigned { payload } => {
                let expected_judgments = if players_at_event
                    .iter()
                    .any(|p| p.id == payload.player_id && p.actual_character == "spy")
                {
                    vec![RegistrationJudgment {
                        player_id: payload.player_id.clone(),
                        registered_as: crate::model::RegistrationValue::Good,
                        character_id: None,
                    }]
                } else {
                    vec![]
                };
                if step.step_type != StepType::RedHerringAssignment
                    || payload.registration_judgments != expected_judgments
                    || !step
                        .required_input
                        .allowed_player_ids
                        .as_ref()
                        .is_some_and(|ids| ids.contains(&payload.player_id))
                    || events[..event_index]
                        .iter()
                        .any(|e| matches!(e.kind, GameEventKind::RedHerringAssigned { .. }))
                {
                    return Err(ErrorKind::ReplayFailed.into_error());
                }
            }
            GameEventKind::NightActionResolved { payload } => {
                if step.player_id.as_deref() != Some(payload.actor_player_id.as_str()) {
                    return Err(ErrorKind::ReplayFailed.into_error());
                }
                let target = match &payload.resolution {
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
                let actual = players_at_event
                    .iter()
                    .find(|p| p.id == payload.actor_player_id)
                    .map(|p| p.actual_character.as_str());
                let impaired = actor_is_impaired(&step, &players_at_event, &events[..event_index]);
                let expected = match step.character.as_deref() {
                    Some("poisoner") => {
                        let applied = actual == Some("poisoner") && !impaired;
                        NightActionResolution::Poison {
                            target_player_id: target.clone(),
                            applied,
                            no_effect_reason: (!applied).then_some(if actual == Some("poisoner") {
                                NightActionNoEffectReason::ActorImpaired
                            } else {
                                NightActionNoEffectReason::NotActualCharacter
                            }),
                        }
                    }
                    Some("monk") => {
                        let applied = actual == Some("monk") && !impaired;
                        NightActionResolution::MonkProtection {
                            target_player_id: target.clone(),
                            applied,
                            no_effect_reason: (!applied).then_some(if actual == Some("monk") {
                                NightActionNoEffectReason::ActorImpaired
                            } else {
                                NightActionNoEffectReason::NotActualCharacter
                            }),
                        }
                    }
                    Some("imp") => {
                        let NightActionResolution::ImpAttack { mayor_context, .. } =
                            &payload.resolution
                        else {
                            unreachable!()
                        };
                        let mayor_decision = match mayor_context {
                            MayorAttackContext::NotApplicable => None,
                            MayorAttackContext::MayorDies { .. } => {
                                Some(MayorDecisionInput::MayorDies)
                            }
                            MayorAttackContext::Bounced {
                                bounce_target_player_id,
                                ..
                            } => Some(MayorDecisionInput::Bounce {
                                target_player_id: bounce_target_player_id.clone(),
                            }),
                        };
                        let active_poison = crate::night::active_night_poison(
                            &events[..event_index],
                            &players_at_event,
                        );
                        let active_protection = crate::night::active_night_protection(
                            &events[..event_index],
                            &players_at_event,
                        );
                        crate::characters::resolve_imp_attack(
                            &players_at_event,
                            &payload.actor_player_id,
                            target,
                            mayor_decision.as_ref(),
                            active_poison.as_ref(),
                            active_protection.as_ref(),
                        )
                        .map_err(|_| ErrorKind::ReplayFailed.into_error())?
                    }
                    _ => return Err(ErrorKind::ReplayFailed.into_error()),
                };
                if payload.resolution != expected {
                    return Err(ErrorKind::ReplayFailed.into_error());
                }
                if !step
                    .required_input
                    .allowed_player_ids
                    .as_ref()
                    .is_some_and(|ids| ids.contains(target))
                {
                    return Err(ErrorKind::ReplayFailed.into_error());
                }
            }
            GameEventKind::NightDeathsAnnounced { payload } => {
                let announced = events[..event_index]
                    .iter()
                    .flat_map(|e| match &e.kind {
                        GameEventKind::NightDeathsAnnounced { payload } => {
                            payload.player_ids.clone()
                        }
                        _ => vec![],
                    })
                    .collect::<Vec<_>>();
                let expected = events[..event_index]
                    .iter()
                    .filter_map(|e| match &e.kind {
                        GameEventKind::NightActionResolved { payload } => match &payload.resolution
                        {
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
                if payload.player_ids != expected {
                    return Err(ErrorKind::ReplayFailed.into_error());
                }
            }
            GameEventKind::ExecutionConfirmed { payload } => {
                let prefix = step_prefix(&payload.step_id)?;
                let prior = replay_day_state(&events[..event_index], &players_at_event, &prefix)
                    .map_err(|_| ErrorKind::ReplayFailed.into_error())?;
                let expected_player_id = prior
                    .execution_candidate
                    .map(|candidate| candidate.nominee_id)
                    .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
                if step.step_type != StepType::Execution
                    || !payload.input.execute
                    || payload.input.player_id.as_deref() != Some(expected_player_id.as_str())
                    || !players_at_event
                        .iter()
                        .any(|player| player.id == expected_player_id && player.alive)
                {
                    return Err(ErrorKind::ReplayFailed.into_error());
                }
            }
            GameEventKind::NoExecutionConfirmed { payload } => {
                if step.step_type != StepType::Execution
                    || payload.input.execute
                    || payload.input.player_id.is_some()
                {
                    return Err(ErrorKind::ReplayFailed.into_error());
                }
            }
            GameEventKind::DeathConfirmed { payload } if payload.step_id.is_some() => {
                if step.step_type != crate::model::StepType::ExecutionDeath
                    || step.player_id.as_deref() != Some(payload.player_id.as_str())
                    || !players_at_event
                        .iter()
                        .any(|player| player.id == payload.player_id && player.alive)
                {
                    return Err(ErrorKind::ReplayFailed.into_error());
                }
            }
            GameEventKind::ExecutionSurvivalConfirmed { payload } => {
                if step.step_type != crate::model::StepType::ExecutionDeath
                    || step.player_id.as_deref() != Some(payload.player_id.as_str())
                    || !step.required_input.execution_survival_allowed
                    || !players_at_event
                        .iter()
                        .any(|player| player.id == payload.player_id && player.alive)
                {
                    return Err(ErrorKind::ReplayFailed.into_error());
                }
            }
            _ => {}
        }
        if let Some(input) = event_input {
            if let GameEventKind::PhaseStepConfirmed { payload } = &event.kind {
                if step.required_input.kind != RequiredInputKind::SetupInfo {
                    validate_replayed_required_input(&step, input, &players_at_event)?;
                }
                validate_confirmed_information(
                    &step,
                    &players_at_event,
                    &events[..event_index],
                    input,
                    payload.information.as_ref(),
                )?;
            } else {
                validate_required_input(&step.required_input, input, &players_at_event)?;
            }
        }
        if let GameEventKind::NominationVoteConfirmed { payload } = &event.kind {
            validate_nomination_event_input(payload, &players_at_event, &events[..event_index])?;
            if payload.nomination_event_id.is_none() {
                let prefix = step_prefix(&payload.step_id)?;
                let prior = replay_day_state(&events[..event_index], &players_at_event, &prefix)?;
                validate_nomination_roles(
                    &players_at_event,
                    &prior.nominations,
                    payload
                        .nominator_id
                        .as_deref()
                        .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?,
                    payload
                        .nominee_id
                        .as_deref()
                        .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?,
                )
                .map_err(|_| ErrorKind::ReplayFailed.into_error())?;
            }
        }
        statuses.insert(step_id.to_string(), status);
        if let GameEventKind::NoExecutionConfirmed { payload } = &event.kind {
            let prefix = step_prefix(&payload.step_id)?;
            statuses.insert(format!("{prefix}:executionDeath"), PhaseStepStatus::Skipped);
        }
    }
    Ok(statuses)
}

fn pending_slayer_death(events: &[GameEvent]) -> Option<(String, String)> {
    let (index, payload) =
        events
            .iter()
            .enumerate()
            .rev()
            .find_map(|(index, event)| match &event.kind {
                GameEventKind::SlayerAbilityUsed { payload } => Some((index, payload)),
                _ => None,
            })?;
    let SlayerOutcome::DeathPending { player_id } = &payload.outcome else {
        return None;
    };
    let step_id = format!("{}:slayerDeath", payload.discussion_step_id);
    (!events[index + 1..].iter().any(|event| matches!(&event.kind, GameEventKind::DeathConfirmed { payload } if payload.step_id.as_deref() == Some(step_id.as_str()))))
        .then(|| (payload.discussion_step_id.clone(), player_id.clone()))
}

fn slayer_death_step(discussion_step_id: &str, player_id: &str) -> PhaseStep {
    PhaseStep {
        id: format!("{discussion_step_id}:slayerDeath"),
        phase: Phase::Day,
        step_type: StepType::SlayerDeath,
        character: None,
        player_id: Some(player_id.into()),
        can_skip: false,
        information_prompt: None,
        pre_action_reveal: None,
        required_input: RequiredInput {
            kind: RequiredInputKind::SlayerDeathDecision,
            target: None,
            min_selections: None,
            max_selections: None,
            setup_info: None,
            character_kind: None,
            allowed_character_ids: None,
            allowed_player_ids: None,
            player_registration_options: None,
            zero_allowed: false,
            supports_random_suggestion: false,
            player_id: Some(player_id.into()),
            survival_allowed: Some(false),
            execution_survival_allowed: false,
            mayor_decision: None,
            demon_succession: None,
            optional: false,
        },
    }
}

fn validate_slayer_event(
    payload: &SlayerAbilityUsedPayload,
    phase: Phase,
    prefix: &[GameEvent],
    statuses: &HashMap<String, PhaseStepStatus>,
) -> Result<(), CoreError> {
    if prefix
        .iter()
        .any(|event| matches!(event.kind, GameEventKind::SlayerAbilityUsed { .. }))
        || phase != Phase::Day
    {
        return Err(ErrorKind::ReplayFailed.into_error());
    }
    let players = replay_players(prefix)?;
    let Some((_, _, Some(step))) =
        current_phase_steps(&players, prefix, prefix.len() + 2, statuses)
    else {
        return Err(ErrorKind::ReplayFailed.into_error());
    };
    if step.step_type != StepType::Discussion || step.id != payload.discussion_step_id {
        return Err(ErrorKind::ReplayFailed.into_error());
    }
    let actor = players
        .iter()
        .find(|player| {
            player.id == payload.actor_player_id
                && player.alive
                && player.actual_character == "slayer"
        })
        .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
    let target = players
        .iter()
        .find(|player| player.id == payload.target_player_id)
        .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
    let choice = match &payload.registration_context {
        SlayerRegistrationContext::Canonical { .. } => SlayerTargetRegistration::Canonical,
        SlayerRegistrationContext::RecluseDecision {
            registered_as_demon: true,
            registered_character_id: Some(id),
        } => SlayerTargetRegistration::RecluseAsDemon {
            registered_character_id: id.clone(),
        },
        SlayerRegistrationContext::RecluseDecision {
            registered_as_demon: false,
            registered_character_id: None,
        } => SlayerTargetRegistration::Canonical,
        _ => return Err(ErrorKind::ReplayFailed.into_error()),
    };
    let expected_registration = crate::characters::slayer_registration(target, &choice)
        .map_err(|_| ErrorKind::ReplayFailed.into_error())?;
    let rule = replay_rule_state(prefix, &players);
    let expected_impairment = rule
        .active_poison
        .as_ref()
        .filter(|poison| poison.player_id == actor.id)
        .map(|poison| SlayerImpairmentContext::Poisoned {
            source_player_id: poison.source_player_id.clone(),
            source_event_id: poison.source_event_id.clone(),
        })
        .unwrap_or(SlayerImpairmentContext::Healthy);
    let demon = match expected_registration {
        SlayerRegistrationContext::Canonical {
            registered_as_demon,
        }
        | SlayerRegistrationContext::RecluseDecision {
            registered_as_demon,
            ..
        } => registered_as_demon,
    };
    let expected_outcome = if matches!(
        expected_impairment,
        SlayerImpairmentContext::Poisoned { .. }
    ) {
        SlayerOutcome::NoEffect {
            reason: SlayerNoEffectReason::ActorPoisoned,
        }
    } else if !target.alive {
        SlayerOutcome::NoEffect {
            reason: SlayerNoEffectReason::TargetAlreadyDead,
        }
    } else if !demon {
        SlayerOutcome::NoEffect {
            reason: SlayerNoEffectReason::TargetNotDemon,
        }
    } else {
        SlayerOutcome::DeathPending {
            player_id: target.id.clone(),
        }
    };
    if payload.impairment_context != expected_impairment
        || payload.registration_context != expected_registration
        || payload.outcome != expected_outcome
    {
        return Err(ErrorKind::ReplayFailed.into_error());
    }
    Ok(())
}

pub(crate) fn replay_rule_state(events: &[GameEvent], players: &[Player]) -> RuleState {
    let red_herring_player_id = events.iter().find_map(|e| match &e.kind {
        GameEventKind::RedHerringAssigned { payload } => Some(payload.player_id.clone()),
        _ => None,
    });
    let last_to_night = events.iter().rposition(|e| matches!(&e.kind, GameEventKind::PhaseStepConfirmed { payload } if payload.step_id.ends_with(":toNight")));
    let last_to_day = events.iter().rposition(|e| matches!(&e.kind, GameEventKind::PhaseStepConfirmed { payload } if payload.step_id.ends_with(":toDay")));
    let active_poison = events
        .iter()
        .enumerate()
        .rev()
        .find_map(|(i, e)| match &e.kind {
            GameEventKind::NightActionResolved { payload }
                if matches!(
                    payload.resolution,
                    NightActionResolution::Poison { applied: true, .. }
                ) && last_to_night.is_none_or(|boundary| i > boundary) =>
            {
                let NightActionResolution::Poison {
                    target_player_id, ..
                } = &payload.resolution
                else {
                    unreachable!()
                };
                players
                    .iter()
                    .any(|p| {
                        p.id == payload.actor_player_id
                            && p.alive
                            && p.actual_character == "poisoner"
                    })
                    .then(|| ActiveRuleEffect {
                        player_id: target_player_id.clone(),
                        source_player_id: payload.actor_player_id.clone(),
                        source_event_id: e.id.clone(),
                    })
            }
            _ => None,
        });
    let active_protection = events
        .iter()
        .enumerate()
        .rev()
        .find_map(|(i, e)| match &e.kind {
            GameEventKind::NightActionResolved { payload }
                if matches!(
                    payload.resolution,
                    NightActionResolution::MonkProtection { applied: true, .. }
                ) && last_to_night.is_some_and(|boundary| i > boundary)
                    && last_to_day.is_none_or(|boundary| i > boundary) =>
            {
                let NightActionResolution::MonkProtection {
                    target_player_id, ..
                } = &payload.resolution
                else {
                    unreachable!()
                };
                players
                    .iter()
                    .any(|p| {
                        p.id == payload.actor_player_id && p.alive && p.actual_character == "monk"
                    })
                    .then(|| ActiveRuleEffect {
                        player_id: target_player_id.clone(),
                        source_player_id: payload.actor_player_id.clone(),
                        source_event_id: e.id.clone(),
                    })
            }
            _ => None,
        });
    let butler_vote = crate::characters::butler_vote_state(players, events, active_poison.as_ref());
    let announced = events
        .iter()
        .flat_map(|e| match &e.kind {
            GameEventKind::NightDeathsAnnounced { payload } => payload.player_ids.clone(),
            _ => vec![],
        })
        .collect::<Vec<_>>();
    let unannounced_night_death_player_ids = events
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
    RuleState {
        red_herring_player_id,
        active_poison,
        active_protection,
        unannounced_night_death_player_ids,
        slayer_ability: None,
        virgin_ability: None,
        butler_vote,
    }
}

fn validate_replayed_required_input(
    step: &PhaseStep,
    input: &crate::model::StepInput,
    players: &[Player],
) -> Result<(), CoreError> {
    let legacy_self_master = step.character.as_deref() == Some("butler")
        && step.player_id.as_ref().is_some_and(|actor_id| {
            input
                .as_ref()
                .and_then(|input| input.player_ids.as_ref())
                .is_some_and(|ids| ids.len() == 1 && ids.first() == Some(actor_id))
        });
    if !legacy_self_master {
        return validate_required_input(&step.required_input, input, players);
    }

    let mut legacy_input = step.required_input.clone();
    legacy_input.allowed_player_ids =
        Some(players.iter().map(|player| player.id.clone()).collect());
    validate_required_input(&legacy_input, input, players)
}

pub(crate) fn phase_sequences_with_statuses(
    players: &[Player],
    events: &[GameEvent],
    max_cycles: usize,
    statuses: &HashMap<String, PhaseStepStatus>,
) -> Vec<(Phase, Vec<PhaseStep>)> {
    let mut sequences = vec![(Phase::FirstNight, first_night_steps(players, events))];
    for cycle in 1..=max_cycles.max(1) {
        let prefix = crate::phase::phase_prefix("day", cycle);
        let executed_player_id = events.iter().find_map(|event| match &event.kind {
            GameEventKind::ExecutionConfirmed { payload }
                if payload.step_id == format!("{prefix}:execution") =>
            {
                payload.input.player_id.clone()
            }
            _ => None,
        });
        sequences.push((
            Phase::Day,
            day_steps(cycle, statuses, executed_player_id, events, players),
        ));
        sequences.push((Phase::Night, night_steps(players, events, cycle)));
    }
    sequences
}

pub(crate) fn current_phase_steps(
    players: &[Player],
    events: &[GameEvent],
    max_cycles: usize,
    statuses: &HashMap<String, PhaseStepStatus>,
) -> Option<(Phase, Vec<PhaseStep>, Option<PhaseStep>)> {
    for (phase, steps) in phase_sequences_with_statuses(players, events, max_cycles, statuses) {
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

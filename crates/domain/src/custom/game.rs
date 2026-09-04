use crate::{
    characters::{custom_demon_bluff_character_ids, resolve_custom_script, ResolvedScriptContext},
    contracts::{
        Command, FirstNightActionRef, GameEvent, GameEventKind, GameFile, PhaseStepCommandPayload,
        PhaseStepEventPayload, Proposal, ReplayScriptIdentity, ReplayState, RevealIdentity,
        RevealPayload, RuleState, ScriptReference,
    },
    error::{CoreError, ErrorKind},
    messages::{phase_step_event_summary, phase_step_preview},
    model::{AbilityOrigin, Phase, PhaseOverviewItem, PhaseStep, PhaseStepStatus, Player},
    phase::validate_required_input,
    setup::{player_from_setup_input_for_custom, validate_setup_inputs_for_custom},
};

use super::first_night::{
    compose_steps, plan_for_definition, reduce_progress, system_action_registry, validate_plan,
    ActionContext, ActiveAbilityInstance, ConfirmedActionEvent, FirstNightProgress,
    FirstNightRuleService,
};

struct CustomRuleService<'a> {
    context: &'a ResolvedScriptContext,
    players: &'a [Player],
}

impl FirstNightRuleService for CustomRuleService<'_> {
    fn active_instances(&self, action_ref: &FirstNightActionRef) -> Vec<ActiveAbilityInstance> {
        let FirstNightActionRef::Character { character_id, .. } = action_ref else {
            return Vec::new();
        };
        self.players
            .iter()
            .filter(|player| player.actual_character == *character_id)
            .map(|player| ActiveAbilityInstance {
                seat: player.seat,
                ability_use: crate::model::AbilityUseRef {
                    owner_player_id: player.id.clone(),
                    character_id: character_id.clone(),
                    ability_instance_id: player.ability_instance.id.clone(),
                },
                ability_origin: AbilityOrigin::IdentityBound,
            })
            .collect()
    }

    fn has_minion(&self) -> bool {
        self.players.iter().any(|player| {
            self.context.character_kind(&player.actual_character)
                == Some(crate::model::CharacterKind::Minion)
        })
    }

    fn has_demon(&self) -> bool {
        self.players.iter().any(|player| {
            self.context.character_kind(&player.actual_character)
                == Some(crate::model::CharacterKind::Demon)
        })
    }

    fn legal_demon_bluff_character_ids(&self) -> Vec<String> {
        custom_demon_bluff_character_ids(
            self.context,
            &self
                .players
                .iter()
                .map(|player| player.actual_character.clone())
                .collect::<Vec<_>>(),
        )
    }
}

struct ReplayComponents {
    players: Vec<Player>,
    current_step: Option<PhaseStep>,
    phase_overview: Vec<PhaseOverviewItem>,
    phase: Phase,
}

pub(crate) fn replay(game_file: GameFile) -> Result<ReplayState, CoreError> {
    let script = game_file.script.clone();
    if game_file.game.events.is_empty() {
        return Ok(ReplayState {
            schema_version: game_file.schema_version,
            script_identity: ReplayScriptIdentity::Custom { script },
            event_count: 0,
            phase: Phase::Setup,
            players: vec![],
            current_step: None,
            phase_overview: vec![],
            setup_choice_id: None,
            day_state: None,
            warnings: vec![],
            rule_state: RuleState::default(),
            game_end: None,
            pending_identity_reveals: vec![],
            available_day_actions: vec![],
            day_action_records: vec![],
            madness_assignments: vec![],
            pending_madness_execution: None,
            pending_vigormortis_poison_choices: vec![],
            pending_death_consequences: vec![],
            pending_game_end: None,
        });
    }
    let components = replay_components(&game_file)?;
    Ok(ReplayState {
        schema_version: game_file.schema_version,
        script_identity: ReplayScriptIdentity::Custom { script },
        event_count: game_file.game.events.len(),
        phase: components.phase,
        players: components.players,
        current_step: components.current_step,
        phase_overview: components.phase_overview,
        setup_choice_id: None,
        day_state: None,
        warnings: vec![],
        rule_state: RuleState::default(),
        game_end: None,
        pending_identity_reveals: vec![],
        available_day_actions: vec![],
        day_action_records: vec![],
        madness_assignments: vec![],
        pending_madness_execution: None,
        pending_vigormortis_poison_choices: vec![],
        pending_death_consequences: vec![],
        pending_game_end: None,
    })
}

pub(crate) fn propose(game_file: &GameFile, command: Command) -> Result<Proposal, CoreError> {
    match command {
        Command::CreateGame { payload } => crate::proposal::propose_create_game(game_file, payload),
        Command::ConfirmStep { payload } => propose_step(game_file, payload),
        _ => Err(ErrorKind::CommandNotSupportedByScript.into_error()),
    }
}

fn propose_step(
    game_file: &GameFile,
    payload: PhaseStepCommandPayload,
) -> Result<Proposal, CoreError> {
    let components = replay_components(game_file)?;
    let current_step = components
        .current_step
        .as_ref()
        .ok_or_else(|| ErrorKind::NoCurrentStep.into_error())?;
    if payload.step_id != current_step.id {
        return Err(ErrorKind::StaleStep.into_error());
    }
    validate_required_input(
        &current_step.required_input,
        &payload.input,
        &components.players,
    )?;
    if payload.delivered_result.is_some() || !payload.registration_judgments.is_empty() {
        return Err(ErrorKind::UnexpectedDeliveredInformation.into_error());
    }

    let ScriptReference::Custom { definition } = &game_file.script else {
        unreachable!()
    };
    let context = resolve_custom_script(definition)?;
    let rules = CustomRuleService {
        context: &context,
        players: &components.players,
    };
    let action_context = ActionContext {
        rule_service: &rules,
    };
    let registry = system_action_registry()?;
    let action_ref = current_step
        .action_ref
        .as_ref()
        .ok_or_else(|| ErrorKind::InvalidFirstNightActionProvenance.into_error())?;
    let handler_event = registry.propose(action_ref, &action_context, current_step)?;
    registry.validate_event(action_ref, &action_context, &handler_event)?;

    let summary = phase_step_event_summary(
        current_step,
        &components.players,
        &payload.input,
        None,
        false,
    );
    let reveal_payload = system_reveal(action_ref, &components.players, &context, &payload.input);
    Ok(Proposal {
        event: GameEvent {
            id: format!("phase-step-{}", game_file.game.events.len() + 1),
            kind: GameEventKind::PhaseStepConfirmed {
                payload: Box::new(PhaseStepEventPayload {
                    step_id: current_step.id.clone(),
                    action_ref: Some(handler_event.action_ref),
                    ability_use: handler_event.ability_use,
                    input: payload.input,
                    information: None,
                }),
            },
            phase: current_step.phase,
            summary,
            created_at: game_file
                .game
                .updated_at
                .clone()
                .unwrap_or_else(|| "1970-01-01T00:00:00.000Z".to_string()),
        },
        warnings: vec![],
        follow_up_steps: vec![],
        preview: phase_step_preview(false),
        reveal_payload,
    })
}

fn replay_components(game_file: &GameFile) -> Result<ReplayComponents, CoreError> {
    let ScriptReference::Custom { definition } = &game_file.script else {
        unreachable!()
    };
    let context = resolve_custom_script(definition)?;
    let Some(first) = game_file.game.events.first() else {
        return Err(ErrorKind::ReplayFailed.into_error());
    };
    let GameEventKind::SetupConfirmed { payload } = &first.kind else {
        return Err(ErrorKind::ReplayFailed.into_error());
    };
    if first.phase != Phase::Setup
        || payload.setup_choice_id.is_some()
        || game_file
            .game
            .events
            .iter()
            .skip(1)
            .any(|event| matches!(event.kind, GameEventKind::SetupConfirmed { .. }))
    {
        return Err(ErrorKind::ReplayFailed.into_error());
    }
    validate_setup_inputs_for_custom(&context, &payload.players)?;
    let players = payload
        .players
        .iter()
        .map(|player| player_from_setup_input_for_custom(&context, player))
        .collect::<Result<Vec<_>, _>>()?;
    let plan = payload
        .first_night_order_plan
        .clone()
        .unwrap_or(plan_for_definition(definition)?);
    validate_plan(&context, &plan)?;

    let rules = CustomRuleService {
        context: &context,
        players: &players,
    };
    let action_context = ActionContext {
        rule_service: &rules,
    };
    let registry = system_action_registry()?;
    let steps = compose_steps(&plan, &registry, &action_context)?;
    let mut progress = FirstNightProgress::default();
    for event in game_file.game.events.iter().skip(1) {
        let GameEventKind::PhaseStepConfirmed { payload } = &event.kind else {
            return Err(ErrorKind::EventNotSupportedByScript.into_error());
        };
        let expected = steps
            .iter()
            .find(|step| !progress.completed_step_ids.contains(&step.id))
            .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
        if event.phase != Phase::FirstNight || payload.step_id != expected.id {
            return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
        }
        let action_ref = payload
            .action_ref
            .clone()
            .ok_or_else(|| ErrorKind::InvalidFirstNightActionProvenance.into_error())?;
        if expected.action_ref.as_ref() != Some(&action_ref)
            || expected.ability_use != payload.ability_use
            || payload.information.is_some()
        {
            return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
        }
        validate_required_input(&expected.required_input, &payload.input, &players)?;
        let handler_event = ConfirmedActionEvent {
            action_ref: action_ref.clone(),
            step_id: payload.step_id.clone(),
            ability_use: payload.ability_use.clone(),
        };
        registry.validate_event(&action_ref, &action_context, &handler_event)?;
        progress = reduce_progress(&progress, &handler_event)?;
    }

    let current_step = steps
        .iter()
        .find(|step| !progress.completed_step_ids.contains(&step.id))
        .cloned();
    let phase = if current_step.is_some() {
        Phase::FirstNight
    } else {
        Phase::Day
    };
    let current_id = current_step.as_ref().map(|step| step.id.as_str());
    let phase_overview = if phase == Phase::FirstNight {
        steps
            .iter()
            .map(|step| {
                overview(
                    step,
                    if progress.completed_step_ids.contains(&step.id) {
                        PhaseStepStatus::Complete
                    } else if current_id == Some(step.id.as_str()) {
                        PhaseStepStatus::Current
                    } else {
                        PhaseStepStatus::Waiting
                    },
                )
            })
            .collect()
    } else {
        Vec::new()
    };
    Ok(ReplayComponents {
        players,
        current_step,
        phase_overview,
        phase,
    })
}

fn overview(step: &PhaseStep, status: PhaseStepStatus) -> PhaseOverviewItem {
    PhaseOverviewItem {
        id: step.id.clone(),
        phase: step.phase,
        step_type: step.step_type,
        character: step.character.clone(),
        player_id: step.player_id.clone(),
        ability_use: step.ability_use.clone(),
        ability_origin: step.ability_origin.clone(),
        required_input: step.required_input.clone(),
        can_skip: step.can_skip,
        support: step.support,
        information_prompt: step.information_prompt.clone(),
        action_ref: step.action_ref.clone(),
        status,
    }
}

fn system_reveal(
    action_ref: &FirstNightActionRef,
    players: &[Player],
    context: &ResolvedScriptContext,
    input: &crate::model::StepInput,
) -> Option<RevealPayload> {
    let identities = |kind| {
        players
            .iter()
            .filter(|player| context.character_kind(&player.actual_character) == Some(kind))
            .map(|player| RevealIdentity {
                seat: player.seat,
                name: player.name.clone(),
            })
            .collect::<Vec<_>>()
    };
    match action_ref {
        FirstNightActionRef::System {
            action_id: crate::contracts::SystemFirstNightActionId::MinionInfo,
        } => Some(RevealPayload::MinionInformation {
            kind: "minionInformation",
            demon_players: identities(crate::model::CharacterKind::Demon),
            minion_players: identities(crate::model::CharacterKind::Minion),
        }),
        FirstNightActionRef::System {
            action_id: crate::contracts::SystemFirstNightActionId::DemonInfo,
        } => Some(RevealPayload::DemonInformation {
            kind: "demonInformation",
            minion_players: identities(crate::model::CharacterKind::Minion),
            bluff_character_ids: input
                .as_ref()
                .and_then(|value| value.character_ids.clone())
                .unwrap_or_default(),
        }),
        _ => None,
    }
}

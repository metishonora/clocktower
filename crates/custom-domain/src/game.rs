use crate::{
    characters::resolve_custom_script,
    contracts::{
        Command, GameEvent, GameEventKind, GameFile, PhaseStepCommandPayload, Proposal,
        ReplayScriptIdentity, ReplayState, RuleState, ScriptReference,
    },
    error::{CoreError, ErrorKind},
    messages::{phase_step_event_summary, phase_step_preview},
    model::{Phase, PhaseOverviewItem, PhaseStep},
    setup::{player_from_setup_input_for_custom, validate_setup_inputs_for_custom},
};

use super::{
    first_night::{
        action_registry, activation_rule, plan_for_definition, project_occurrence_step,
        ActionContext, ActionEventDraft, ActionRegistry, ActivationRule, NightScheduler,
        ValidatedActionEvent,
    },
    projection::{event_reveal, first_night as project_first_night, rule_state},
    reducer::reduce_custom_facts,
    rules::CustomRuleService,
    state::{ActionOccurrence, CompletedActionSnapshot, CustomGameFacts, CustomGameState},
};

struct ReplayComponents {
    available_actions: Vec<PhaseStep>,
    state: CustomGameState,
    current_step: Option<PhaseStep>,
    phase_overview: Vec<PhaseOverviewItem>,
    phase: Phase,
}

/// Test-only read access to the completed snapshots produced by the real custom replay fold.
/// Nothing in this view is serialized or exported through WASM; it exists so contract tests can
/// verify that a historical Reveal remains tied to the facts prefix that confirmed it.
#[cfg(test)]
pub(crate) fn completed_snapshots_for_tests(
    game_file: GameFile,
) -> Result<Vec<CompletedActionSnapshot>, CoreError> {
    Ok(replay_components(&game_file)?
        .state
        .progress
        .completed_history
        .into_iter()
        .filter_map(|completion| completion.snapshot)
        .collect())
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

            warnings: vec![],
            rule_state: RuleState::default(),
            game_end: None,
            available_actions: vec![],
            pending_identity_reveals: vec![],
            madness_assignments: vec![],
        });
    }
    let components = replay_components(&game_file)?;
    Ok(ReplayState {
        schema_version: game_file.schema_version,
        script_identity: ReplayScriptIdentity::Custom { script },
        event_count: game_file.game.events.len(),
        phase: components.phase,
        players: components.state.facts.players.clone(),
        current_step: components.current_step,
        phase_overview: components.phase_overview,

        warnings: vec![],
        rule_state: rule_state(&components.state.facts),
        game_end: components.state.facts.game_end.clone(),
        available_actions: components.available_actions,
        pending_identity_reveals: components.state.facts.pending_identity_reveals.clone(),
        madness_assignments: components.state.facts.madness_assignments.clone(),
    })
}

pub(crate) fn propose(game_file: &GameFile, command: Command) -> Result<Proposal, CoreError> {
    match command {
        Command::CreateGame { payload } => crate::setup::propose_create_game(game_file, payload),
        Command::ConfirmStep { payload } => propose_step(game_file, payload),
        _ => Err(ErrorKind::CommandNotSupportedByScript.into_error()),
    }
}

fn propose_step(
    game_file: &GameFile,
    payload: PhaseStepCommandPayload,
) -> Result<Proposal, CoreError> {
    let components = replay_components(game_file)?;
    if components.current_step.is_none() && components.available_actions.is_empty() {
        return Err(ErrorKind::NoCurrentStep.into_error());
    }
    let current_step = components
        .current_step
        .as_ref()
        .filter(|s| s.id == payload.step_id)
        .or_else(|| {
            components
                .available_actions
                .iter()
                .find(|s| s.id == payload.step_id)
        })
        .ok_or_else(|| ErrorKind::StaleStep.into_error())?;
    if payload.step_id != current_step.id {
        return Err(ErrorKind::StaleStep.into_error());
    }

    let ScriptReference::Custom { definition } = &game_file.script else {
        unreachable!()
    };
    let context = resolve_custom_script(definition)?;
    let rules = CustomRuleService::new(&context, &components.state.facts);
    let event_id = format!("phase-step-{}", game_file.game.events.len() + 1);
    let action_context = ActionContext {
        event_id: &event_id,
        rule_service: &rules,
    };
    let registry = action_registry()?;
    let action_ref = current_step
        .action_ref
        .as_ref()
        .ok_or_else(|| ErrorKind::InvalidFirstNightActionProvenance.into_error())?;
    let occurrence = ActionOccurrence::from_step(current_step)?;
    registry.validate_input(
        &occurrence,
        current_step,
        &payload.input,
        &components.state.facts.players,
    )?;
    let handler_draft = registry.propose_input(
        action_ref,
        &action_context,
        &occurrence,
        &crate::first_night::ActionInput {
            input: payload.input.clone(),
            delivered_result: payload.delivered_result.clone(),
            registration_judgments: payload.registration_judgments.clone(),
        },
    )?;
    let summary = phase_step_event_summary(
        current_step,
        &components.state.facts.players,
        &payload.input,
        None,
        false,
    );

    let event = event_from_draft(
        event_id,
        current_step.phase,
        summary,
        game_file
            .game
            .updated_at
            .clone()
            .unwrap_or_else(|| "1970-01-01T00:00:00.000Z".to_string()),
        handler_draft,
    );

    // Proposal and replay intentionally cross the same event validation/reducer/scheduler fold.
    // The candidate state is discarded after validation; no proposal path can mint a different
    // event shape or bypass an atomic reducer/scheduler failure.
    let plan = plan_for_definition(definition)?;
    let activation = activation_rule();
    let candidate = apply_event(
        &context,
        &plan,
        &registry,
        activation.as_ref(),
        &components.state,
        &event,
    )?;
    if candidate.phase == Phase::FirstNight {
        let candidate_rules = CustomRuleService::new(&context, &candidate.facts);
        let candidate_context = ActionContext {
            event_id: "",
            rule_service: &candidate_rules,
        };
        project_first_night(&plan, &registry, &candidate_context, &candidate.progress)?;
    }
    let (event_input, custom_result) = match &event.kind {
        GameEventKind::PhaseStepConfirmed { payload } => (&payload.input, None),
        GameEventKind::CustomActionConfirmed { payload } => (&payload.input, Some(&payload.result)),
        _ => return Err(ErrorKind::EventNotSupportedByScript.into_error()),
    };
    let reveal_payload = event_reveal(
        action_ref,
        &components.state.facts,
        &context,
        event_input,
        custom_result,
        match &event.kind {
            GameEventKind::CustomActionConfirmed { payload } => payload
                .ability_use
                .as_ref()
                .map(|s| s.owner_player_id.as_str()),
            _ => None,
        },
    );
    Ok(Proposal {
        event,
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
    let plan = plan_for_definition(definition)?;
    let mut facts = CustomGameFacts::from_players(players);
    facts.prefix_event_id = first.id.clone();
    crate::effects::resolve_effects(&context, &mut facts)?;
    let initial_rules = CustomRuleService::new(&context, &facts);
    let initial_context = ActionContext {
        event_id: "",
        rule_service: &initial_rules,
    };
    let registry = action_registry()?;
    let activation = activation_rule();
    let scheduler = NightScheduler::new(&plan, &registry, activation.as_ref());
    let progress = scheduler.initial_progress(&initial_context)?;
    let mut state = CustomGameState::with_first_night(facts, progress);

    for event in game_file.game.events.iter().skip(1) {
        // apply_event returns an entirely new pair. The previous state remains untouched if
        // validation, reduction, projection, or scheduling rejects this event.
        state = apply_event(
            &context,
            &plan,
            &registry,
            activation.as_ref(),
            &state,
            event,
        )?;
    }

    let phase = if state.progress.ended && state.facts.game_end.is_none() {
        Phase::Day
    } else {
        Phase::FirstNight
    };
    let (current_step, phase_overview) = if phase == Phase::FirstNight {
        let rules = CustomRuleService::new(&context, &state.facts);
        let action_context = ActionContext {
            event_id: "",
            rule_service: &rules,
        };
        let projection = project_first_night(&plan, &registry, &action_context, &state.progress)?;
        (projection.current_step, projection.phase_overview)
    } else {
        (None, Vec::new())
    };
    let rules = CustomRuleService::new(&context, &state.facts);
    let action_context = ActionContext {
        event_id: "",
        rule_service: &rules,
    };
    let available_actions = state
        .progress
        .available_occurrences
        .iter()
        .map(|o| project_occurrence_step(&registry, &action_context, o))
        .collect::<Result<Vec<_>, _>>()?;
    state.phase = phase;
    Ok(ReplayComponents {
        available_actions,
        state,
        current_step,
        phase_overview,
        phase,
    })
}

fn apply_event(
    context: &crate::characters::ResolvedScriptContext,
    plan: &crate::contracts::FirstNightOrderPlan,
    registry: &ActionRegistry,
    activation: &dyn ActivationRule,
    previous: &CustomGameState,
    event: &GameEvent,
) -> Result<CustomGameState, CoreError> {
    if previous.phase != Phase::FirstNight
        || previous.progress.ended
        || previous.facts.game_end.is_some()
    {
        return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
    }
    let event_step_id = match &event.kind {
        GameEventKind::CustomActionConfirmed { payload } => &payload.step_id,
        GameEventKind::PhaseStepConfirmed { payload } => &payload.step_id,
        _ => return Err(ErrorKind::EventNotSupportedByScript.into_error()),
    };
    let occurrence = previous
        .progress
        .next_occurrence()
        .into_iter()
        .chain(previous.progress.available_occurrences.iter())
        .find(|o| o.step_id().is_ok_and(|id| id == *event_step_id))
        .cloned()
        .ok_or_else(|| ErrorKind::InvalidFirstNightActionProvenance.into_error())?;
    let previous_rules = CustomRuleService::new(context, &previous.facts);
    let previous_context = ActionContext {
        event_id: &event.id,
        rule_service: &previous_rules,
    };
    let validated = registry.validate_event(&occurrence, &previous_context, event)?;
    let expected_step = project_occurrence_step(registry, &previous_context, &occurrence)?;
    let event_input = validated.input();
    registry.validate_input(
        &occurrence,
        &expected_step,
        event_input,
        &previous.facts.players,
    )?;

    // Both pure transitions are calculated from the same pre-event prefix. Nothing is adopted
    // until both values and the historical snapshot have been computed successfully.
    let mut next_facts = match &validated {
        ValidatedActionEvent::System(_) => previous.facts.clone(),
        ValidatedActionEvent::Custom(custom) => {
            reduce_custom_facts(context, &previous.facts, custom)?
        }
    };
    next_facts.prefix_event_id = event.id.clone();
    let next_rules = CustomRuleService::new(context, &next_facts);
    let next_context = ActionContext {
        event_id: "",
        rule_service: &next_rules,
    };
    let snapshot = CompletedActionSnapshot {
        step: expected_step,
        reveal_payload: event_reveal(
            &occurrence.action_ref,
            &previous.facts,
            context,
            event_input,
            match &validated {
                ValidatedActionEvent::Custom(custom) => Some(&custom.payload().result),
                ValidatedActionEvent::System(_) => None,
            },
            occurrence.actor_player_id(),
        ),
    };
    let scheduler = NightScheduler::new(plan, registry, activation);
    let next_progress = scheduler.advance_with_snapshot(
        &previous.progress,
        &previous_context,
        &next_context,
        &validated,
        Some(snapshot),
    )?;
    let ended = next_progress.ended;
    Ok(CustomGameState {
        phase: if ended { Phase::Day } else { Phase::FirstNight },
        facts: next_facts,
        progress: next_progress,
    })
}

fn event_from_draft(
    id: String,
    phase: Phase,
    summary: String,
    created_at: String,
    draft: ActionEventDraft,
) -> GameEvent {
    GameEvent {
        id,
        kind: draft.into_event_kind(),
        phase,
        summary,
        created_at,
    }
}

use std::collections::HashMap;

use crate::{
    contracts::{
        Command, GameEvent, GameEventKind, GameFile, ManualPhaseStepOutcome,
        ManualPhaseStepResolvedPayload, PhaseStepEventPayload, Proposal, ReplayState, RuleState,
    },
    error::{CoreError, ErrorKind},
    model::{
        CharacterKind, Phase, PhaseOverviewItem, PhaseStep, PhaseStepStatus, PhaseStepSupport,
        Player, StepType,
    },
    phase::{phase_transition_step, required_none, simple_step, validate_required_input},
    setup::{
        player_from_setup_input_for_script, validate_setup_inputs_for_script,
        validate_setup_warnings_for_script,
    },
};
use serde_json::json;

const TOWNSFOLK: [&str; 13] = [
    "clockmaker",
    "dreamer",
    "snakeCharmer",
    "mathematician",
    "flowergirl",
    "townCrier",
    "oracle",
    "savant",
    "seamstress",
    "philosopher",
    "artist",
    "juggler",
    "sage",
];
const OUTSIDERS: [&str; 4] = ["mutant", "sweetheart", "barber", "klutz"];
const MINIONS: [&str; 4] = ["evilTwin", "witch", "cerenovus", "pitHag"];
const DEMONS: [&str; 4] = ["fangGu", "vigormortis", "noDashii", "vortox"];

pub(crate) fn character_kind(character: &str) -> Option<CharacterKind> {
    if TOWNSFOLK.contains(&character) {
        Some(CharacterKind::Townsfolk)
    } else if OUTSIDERS.contains(&character) {
        Some(CharacterKind::Outsider)
    } else if MINIONS.contains(&character) {
        Some(CharacterKind::Minion)
    } else if DEMONS.contains(&character) {
        Some(CharacterKind::Demon)
    } else {
        None
    }
}

fn character_step(phase: Phase, prefix: &str, character: &str, player: &Player) -> PhaseStep {
    PhaseStep {
        id: format!("{prefix}:{character}"),
        phase,
        step_type: StepType::Character,
        character: Some(character.to_string()),
        player_id: Some(player.id.clone()),
        required_input: required_none(),
        can_skip: false,
        support: PhaseStepSupport::Manual,
        information_prompt: None,
        pre_action_reveal: None,
    }
}

fn manual_day_step(cycle: usize) -> PhaseStep {
    let prefix = crate::phase::phase_prefix("day", cycle);
    PhaseStep {
        id: format!("{prefix}:manual"),
        phase: Phase::Day,
        step_type: StepType::Discussion,
        character: None,
        player_id: None,
        required_input: required_none(),
        can_skip: false,
        support: PhaseStepSupport::Manual,
        information_prompt: None,
        pre_action_reveal: None,
    }
}

fn later_night_steps(players: &[Player], cycle: usize) -> Vec<PhaseStep> {
    let prefix = crate::phase::phase_prefix("night", cycle);
    let mut steps = Vec::new();
    for character in [
        "philosopher",
        "snakeCharmer",
        "witch",
        "cerenovus",
        "pitHag",
        "fangGu",
        "noDashii",
        "vortox",
        "vigormortis",
        "barber",
        "sweetheart",
        "sage",
        "dreamer",
        "flowergirl",
        "townCrier",
        "oracle",
        "seamstress",
        "juggler",
        "mathematician",
    ] {
        if let Some(player) = players
            .iter()
            .find(|player| player.actual_character == character)
        {
            steps.push(character_step(Phase::Night, &prefix, character, player));
        }
    }
    steps.push(phase_transition_step(
        Phase::Night,
        &prefix,
        "toDay",
        crate::model::RequiredInputKind::Day,
    ));
    steps
}

fn phase_steps(players: &[Player], max_cycles: usize) -> Vec<PhaseStep> {
    let mut steps = first_night_steps(players);
    for cycle in 1..=max_cycles.max(1) {
        steps.push(manual_day_step(cycle));
        steps.extend(later_night_steps(players, cycle));
    }
    steps
}

fn first_night_steps(players: &[Player]) -> Vec<PhaseStep> {
    let mut steps = Vec::new();
    let player_for = |character: &str| {
        players
            .iter()
            .find(|player| player.actual_character == character)
    };

    if let Some(player) = player_for("philosopher") {
        steps.push(character_step(
            Phase::FirstNight,
            "firstNight",
            "philosopher",
            player,
        ));
    }
    if players
        .iter()
        .any(|player| character_kind(&player.actual_character) == Some(CharacterKind::Minion))
    {
        steps.push(simple_step(
            Phase::FirstNight,
            "firstNight",
            "minionInfo",
            StepType::EvilInfo,
            required_none(),
            false,
        ));
    }
    if players
        .iter()
        .any(|player| character_kind(&player.actual_character) == Some(CharacterKind::Demon))
    {
        steps.push(simple_step(
            Phase::FirstNight,
            "firstNight",
            "demonInfo",
            StepType::EvilInfo,
            required_none(),
            false,
        ));
    }
    for character in [
        "snakeCharmer",
        "evilTwin",
        "witch",
        "cerenovus",
        "clockmaker",
        "dreamer",
        "seamstress",
        "mathematician",
    ] {
        if let Some(player) = player_for(character) {
            steps.push(character_step(
                Phase::FirstNight,
                "firstNight",
                character,
                player,
            ));
        }
    }
    steps.push(phase_transition_step(
        Phase::FirstNight,
        "firstNight",
        "toDay",
        crate::model::RequiredInputKind::Day,
    ));
    steps
}

fn setup_players(events: &[GameEvent]) -> Result<Vec<Player>, CoreError> {
    let Some(GameEvent {
        kind: GameEventKind::SetupConfirmed { payload },
        ..
    }) = events.first()
    else {
        return Err(ErrorKind::ReplayFailed.into_error());
    };
    if events
        .iter()
        .skip(1)
        .any(|event| matches!(event.kind, GameEventKind::SetupConfirmed { .. }))
    {
        return Err(ErrorKind::ReplayFailed.into_error());
    }
    validate_setup_inputs_for_script(
        crate::contracts::ScriptId::SectsAndViolets,
        &payload.players,
    )
    .map_err(|_| ErrorKind::ReplayFailed.into_error())?;
    payload
        .players
        .iter()
        .map(|player| {
            player_from_setup_input_for_script(crate::contracts::ScriptId::SectsAndViolets, player)
                .map_err(|_| ErrorKind::ReplayFailed.into_error())
        })
        .collect()
}

fn phase_state(
    players: &[Player],
    events: &[GameEvent],
) -> Result<(Phase, Option<PhaseStep>, Vec<PhaseOverviewItem>), CoreError> {
    let steps = phase_steps(players, events.len() + 1);
    let mut statuses = HashMap::new();

    for event in events.iter().skip(1) {
        let (step_id, status) = match &event.kind {
            GameEventKind::PhaseStepConfirmed { payload } => {
                (&payload.step_id, PhaseStepStatus::Complete)
            }
            GameEventKind::ManualPhaseStepResolved { payload } => (
                &payload.step_id,
                match payload.outcome {
                    ManualPhaseStepOutcome::Handled => PhaseStepStatus::ManualComplete,
                    ManualPhaseStepOutcome::NotApplicable => PhaseStepStatus::NotApplicable,
                },
            ),
            _ => return Err(ErrorKind::ReplayFailed.into_error()),
        };
        let current = steps
            .iter()
            .find(|step| !statuses.contains_key(&step.id))
            .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
        if current.id != *step_id || current.phase != event.phase {
            return Err(ErrorKind::ReplayFailed.into_error());
        }
        match (&event.kind, current.support) {
            (GameEventKind::PhaseStepConfirmed { payload }, PhaseStepSupport::Automated) => {
                validate_required_input(&current.required_input, &payload.input, players)
                    .map_err(|_| ErrorKind::ReplayFailed.into_error())?;
            }
            (GameEventKind::ManualPhaseStepResolved { .. }, PhaseStepSupport::Manual) => {}
            _ => return Err(ErrorKind::ReplayFailed.into_error()),
        }
        statuses.insert(step_id.clone(), status);
    }

    let current = steps
        .iter()
        .find(|step| !statuses.contains_key(&step.id))
        .cloned();
    let phase = current.as_ref().map_or(Phase::Night, |step| step.phase);
    let current_id = current.as_ref().map(|step| step.id.as_str());
    let current_prefix = current_id.and_then(|id| id.split(':').next());
    let overview = if current.is_none() {
        vec![]
    } else {
        steps
            .into_iter()
            .filter(|step| step.id.split(':').next() == current_prefix)
            .map(|step| PhaseOverviewItem {
                status: statuses.get(&step.id).copied().unwrap_or_else(|| {
                    if Some(step.id.as_str()) == current_id {
                        PhaseStepStatus::Current
                    } else {
                        PhaseStepStatus::Waiting
                    }
                }),
                id: step.id,
                phase: step.phase,
                step_type: step.step_type,
                character: step.character,
                player_id: step.player_id,
                required_input: step.required_input,
                can_skip: step.can_skip,
                support: step.support,
                information_prompt: None,
            })
            .collect()
    };
    Ok((phase, current, overview))
}

pub(crate) fn replay(game_file: GameFile) -> Result<ReplayState, CoreError> {
    if game_file.game.events.is_empty() {
        return Ok(ReplayState {
            schema_version: game_file.schema_version,
            script_id: game_file.script_id,
            event_count: 0,
            phase: Phase::Setup,
            players: vec![],
            current_step: None,
            phase_overview: vec![],
            day_state: None,
            warnings: vec![],
            rule_state: RuleState::default(),
            game_end: None,
        });
    }
    let players = setup_players(&game_file.game.events)?;
    let warnings = validate_setup_warnings_for_script(game_file.script_id, &players);
    let (phase, current_step, phase_overview) = phase_state(&players, &game_file.game.events)?;
    Ok(ReplayState {
        schema_version: game_file.schema_version,
        script_id: game_file.script_id,
        event_count: game_file.game.events.len(),
        phase,
        players,
        current_step,
        phase_overview,
        day_state: None,
        warnings,
        rule_state: RuleState::default(),
        game_end: None,
    })
}

pub(crate) fn propose_phase_command(
    game_file: &GameFile,
    command: Command,
) -> Result<Proposal, CoreError> {
    let players = setup_players(&game_file.game.events)?;
    let (_, current_step, _) = phase_state(&players, &game_file.game.events)?;
    let current_step = current_step.ok_or_else(|| ErrorKind::NoCurrentStep.into_error())?;

    let (kind, summary) = match command {
        Command::ResolveManualStep { payload } => {
            if payload.step_id != current_step.id {
                return Err(ErrorKind::StaleStep.into_error());
            }
            if current_step.support != PhaseStepSupport::Manual {
                return Err(ErrorKind::StepIsAutomated.into_error());
            }
            (
                GameEventKind::ManualPhaseStepResolved {
                    payload: ManualPhaseStepResolvedPayload {
                        step_id: payload.step_id,
                        outcome: payload.outcome,
                    },
                },
                format!("수동 단계 처리: {}", current_step.id),
            )
        }
        Command::ConfirmStep { payload } => {
            if payload.step_id != current_step.id {
                return Err(ErrorKind::StaleStep.into_error());
            }
            if current_step.support == PhaseStepSupport::Manual {
                return Err(ErrorKind::StepRequiresManualResolution.into_error());
            }
            validate_required_input(&current_step.required_input, &payload.input, &players)?;
            (
                GameEventKind::PhaseStepConfirmed {
                    payload: Box::new(PhaseStepEventPayload {
                        step_id: payload.step_id,
                        input: payload.input,
                        information: None,
                    }),
                },
                format!("단계 확정: {}", current_step.id),
            )
        }
        _ => return Err(ErrorKind::CommandNotSupportedByScript.into_error()),
    };

    Ok(Proposal {
        event: GameEvent {
            id: format!("phase-{}", game_file.game.events.len() + 1),
            kind,
            phase: current_step.phase,
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

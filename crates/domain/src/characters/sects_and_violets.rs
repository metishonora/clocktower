use std::collections::HashMap;

#[cfg(test)]
use std::cell::Cell;

use crate::{
    contracts::{
        ActiveImpairment, ArtistAnswer, AutomaticReminder, AvailableDayAction, Command,
        ConfirmedDayActionRecord, DayActionRecord, DayActionRecordedPayload,
        DemonAttackNoEffectReason, DemonAttackOutcome, EndGameCommandPayload,
        ExecuteMadnessCommandPayload, GameEndState, GameEndedPayload, GameEvent, GameEventKind,
        GameFile, ImpairmentExpiry, ImpairmentKind, MadnessAssignedPayload, MadnessAssignmentState,
        MadnessCheckRecordedPayload, MadnessCheckResult, MadnessExecutionConfirmedPayload,
        MadnessStatus, ManualPhaseStepOutcome, ManualPhaseStepResolvedPayload,
        NightActionResolution, NightActionResolvedPayload, NightDeath, NightDeathCause,
        NightDeathsAnnouncedPayload, PendingIdentityReveal, PendingMadnessExecution,
        PhaseStepEventPayload, PitHagArbitraryDeathsConfirmedPayload, PitHagNoChangeReason,
        PitHagTransformationOutcome, PitHagTransformationResolvedPayload, Proposal,
        RecordDayActionCommandPayload, RecordMadnessCheckCommandPayload, ReplayState,
        RevealPayload, RuleState, SnakeCharmerActionOutcome, SnakeCharmerActionResolvedPayload,
        SnakeCharmerNoSwapReason,
    },
    day::{
        day_steps, replay_day_state, step_prefix, validate_nomination_event_input,
        validate_nomination_start_roles,
    },
    error::{CoreError, ErrorKind},
    model::{
        AbilityInstance, Alignment, BooleanInformationChoice, CharacterKind, ConfirmedInformation,
        CoreWarning, DeliveryContext, DeliveryReason, IdentityHistoryEntry, IdentityState,
        InformationActor, InformationDeliveryMode, InformationPrompt, InformationResult,
        InputTarget, NumberInformationChoice, Phase, PhaseOverviewItem, PhaseStep, PhaseStepStatus,
        PhaseStepSupport, Player, PlayerIdentityTransition, PlayerStateSnapshot, PlayerTransition,
        RequiredInput, RequiredInputKind, StepInput, StepType, TargetInformationCheck,
        TargetInformationChoice,
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

fn script_character_ids() -> Vec<String> {
    TOWNSFOLK
        .iter()
        .chain(OUTSIDERS.iter())
        .chain(MINIONS.iter())
        .chain(DEMONS.iter())
        .map(|character| (*character).to_string())
        .collect()
}

fn day_action_character(record: &DayActionRecord) -> &'static str {
    match record {
        DayActionRecord::Artist { .. } => "artist",
        DayActionRecord::Savant { .. } => "savant",
        DayActionRecord::Juggler { .. } => "juggler",
    }
}

fn validate_day_action_record(record: &DayActionRecord) -> Result<(), CoreError> {
    let valid_text = |value: &str, max: usize| {
        !value.is_empty() && value.trim() == value && value.chars().count() <= max
    };
    match record {
        DayActionRecord::Artist {
            question,
            answer: ArtistAnswer::Yes | ArtistAnswer::No | ArtistAnswer::Unknown,
        } => {
            if !valid_text(question, 500) {
                return Err(ErrorKind::InvalidDayActionRecord.into_error());
            }
        }
        DayActionRecord::Savant {
            reference_sentences,
        } => {
            if reference_sentences.len() > 2
                || reference_sentences
                    .iter()
                    .any(|sentence| !valid_text(sentence, 240))
                || reference_sentences
                    .windows(2)
                    .any(|pair| pair[0] == pair[1])
            {
                return Err(ErrorKind::InvalidDayActionRecord.into_error());
            }
        }
        DayActionRecord::Juggler { correct_count } if *correct_count > 5 => {
            return Err(ErrorKind::InvalidDayActionRecord.into_error());
        }
        DayActionRecord::Juggler { .. } => {}
    }
    Ok(())
}

fn day_action_is_available(
    actor: &Player,
    character_id: &str,
    day_id: &str,
    events: &[GameEvent],
) -> bool {
    if character_id == "juggler"
        && first_day_for_ability_instance(actor, events).as_deref() != Some(day_id)
    {
        return false;
    }
    let acquisition_index = events
        .iter()
        .position(|event| event.id == actor.ability_instance.source_event_id);
    !events
        .iter()
        .skip(acquisition_index.map_or(0, |index| index + 1))
        .any(|event| match &event.kind {
            GameEventKind::DayActionRecorded { payload }
                if payload.actor_player_id == actor.id && payload.character_id == character_id =>
            {
                character_id != "savant" || payload.day_id == day_id
            }
            _ => false,
        })
}

fn first_day_for_ability_instance(actor: &Player, events: &[GameEvent]) -> Option<String> {
    if actor.ability_instance.source_event_id == "setup" {
        return Some("day".into());
    }
    let (_, step_id, _) = transition_source(actor, events)?;
    let prefix = step_id.split(':').next()?;
    if prefix == "firstNight" {
        return Some("day".into());
    }
    if prefix.starts_with("day") {
        return Some(prefix.into());
    }
    let suffix = prefix.strip_prefix("night")?;
    let cycle = if suffix.is_empty() {
        1
    } else {
        suffix.parse::<usize>().ok()?
    };
    Some(format!("day{}", cycle + 1))
}

fn validate_day_action_payload(
    payload: &DayActionRecordedPayload,
    event_phase: Phase,
    current_step: &PhaseStep,
    players: &[Player],
    prior_events: &[GameEvent],
) -> Result<(), CoreError> {
    if event_phase != Phase::Day || current_step.phase != Phase::Day {
        return Err(ErrorKind::DayActionWrongPhase.into_error());
    }
    let current_day_id = step_prefix(&current_step.id)?;
    if payload.day_id != current_day_id {
        return Err(ErrorKind::DayActionWrongPhase.into_error());
    }
    validate_day_action_record(&payload.record)?;
    let expected_character = day_action_character(&payload.record);
    if payload.character_id != expected_character {
        return Err(ErrorKind::InvalidDayActionActor.into_error());
    }
    let actor = players
        .iter()
        .find(|player| player.id == payload.actor_player_id)
        .ok_or_else(|| ErrorKind::InvalidDayActionActor.into_error())?;
    if !actor.alive || actor.actual_character != expected_character {
        return Err(ErrorKind::InvalidDayActionActor.into_error());
    }
    if !day_action_is_available(actor, expected_character, &payload.day_id, prior_events) {
        return Err(ErrorKind::DayActionUnavailable.into_error());
    }
    Ok(())
}

fn available_day_actions(
    phase: Phase,
    current_step: Option<&PhaseStep>,
    players: &[Player],
    events: &[GameEvent],
) -> Vec<AvailableDayAction> {
    let Some(step) = current_step.filter(|step| phase == Phase::Day && step.phase == Phase::Day)
    else {
        return vec![];
    };
    let Ok(day_id) = step_prefix(&step.id) else {
        return vec![];
    };
    players
        .iter()
        .filter(|player| {
            player.alive
                && matches!(
                    player.actual_character.as_str(),
                    "artist" | "savant" | "juggler"
                )
                && day_action_is_available(player, &player.actual_character, &day_id, events)
        })
        .map(|player| AvailableDayAction {
            actor_player_id: player.id.clone(),
            character_id: player.actual_character.clone(),
            day_id: day_id.clone(),
        })
        .collect()
}

fn confirmed_day_action_records(events: &[GameEvent]) -> Vec<ConfirmedDayActionRecord> {
    events
        .iter()
        .filter_map(|event| match &event.kind {
            GameEventKind::DayActionRecorded { payload } => Some(ConfirmedDayActionRecord {
                event_id: event.id.clone(),
                day_id: payload.day_id.clone(),
                actor_player_id: payload.actor_player_id.clone(),
                character_id: payload.character_id.clone(),
                record: payload.record.clone(),
            }),
            _ => None,
        })
        .collect()
}

fn madness_execution_death_step_id(event_id: &str, interrupted_step_id: &str) -> String {
    let prefix = interrupted_step_id.split(':').next().unwrap_or("night");
    format!("{prefix}:madnessExecution:{event_id}:executionDeath")
}

fn pending_madness_execution_event<'a>(
    events: &'a [GameEvent],
) -> Option<(&'a GameEvent, &'a MadnessExecutionConfirmedPayload)> {
    let mut pending = None;
    for event in events {
        match &event.kind {
            GameEventKind::MadnessExecutionConfirmed { payload } => {
                pending = Some((event, payload));
            }
            GameEventKind::DeathConfirmed { payload } => {
                if pending.is_some_and(|(execution, madness)| {
                    payload.step_id.as_deref()
                        == Some(
                            madness_execution_death_step_id(
                                &execution.id,
                                &madness.interrupted_step_id,
                            )
                            .as_str(),
                        )
                }) {
                    pending = None;
                }
            }
            _ => {}
        }
    }
    pending
}

fn day_execution_occurred(day_id: &str, events: &[GameEvent]) -> bool {
    events.iter().any(|event| match &event.kind {
        GameEventKind::ExecutionConfirmed { payload } => {
            payload.step_id.starts_with(&format!("{day_id}:"))
        }
        GameEventKind::MadnessExecutionConfirmed { payload } => payload
            .interrupted_step_id
            .starts_with(&format!("{day_id}:")),
        _ => false,
    })
}

fn madness_assignments(
    phase: Phase,
    current_step: Option<&PhaseStep>,
    players: &[Player],
    events: &[GameEvent],
) -> Vec<MadnessAssignmentState> {
    let pending_execution = pending_madness_execution_event(events).is_some();
    let current_day_id = current_step
        .filter(|_| phase == Phase::Day)
        .and_then(|step| step.id.split(':').next());
    let execution_already_occurred =
        current_day_id.is_some_and(|day_id| day_execution_occurred(day_id, events));
    let impaired_players = active_snake_charmer_impairments(events)
        .into_iter()
        .map(|impairment| impairment.player_id)
        .collect::<std::collections::HashSet<_>>();

    let mut raw = events
        .iter()
        .find_map(|event| match &event.kind {
            GameEventKind::SetupConfirmed { payload } => Some((event, payload)),
            _ => None,
        })
        .into_iter()
        .flat_map(|(event, payload)| {
            payload
                .players
                .iter()
                .filter(|input| input.actual_character == "mutant")
                .filter_map(move |input| {
                    let player = input
                        .id
                        .as_deref()
                        .and_then(|id| players.iter().find(|player| player.id == id))
                        .or_else(|| players.iter().find(|player| player.seat == input.seat))?;
                    Some((
                        format!("mutant:{}:{}", player.id, event.id),
                        player.id.clone(),
                        "mutant".to_string(),
                        player.id.clone(),
                        None,
                    ))
                })
        })
        .collect::<Vec<_>>();

    raw.extend(
        players
            .iter()
            .filter(|player| {
                player.actual_character == "mutant"
                    && player.ability_instance.source_event_id != "setup"
            })
            .map(|player| {
                (
                    format!(
                        "mutant:{}:{}",
                        player.id, player.ability_instance.source_event_id
                    ),
                    player.id.clone(),
                    "mutant".to_string(),
                    player.id.clone(),
                    None,
                )
            }),
    );

    let mut latest_cerenovus = HashMap::<String, (&GameEvent, &MadnessAssignedPayload)>::new();
    for event in events {
        if let GameEventKind::MadnessAssigned { payload } = &event.kind {
            latest_cerenovus.insert(payload.source_player_id.clone(), (event, payload));
        }
    }
    let mut cerenovus = latest_cerenovus
        .into_values()
        .map(|(event, payload)| {
            (
                event.id.clone(),
                payload.source_player_id.clone(),
                "cerenovus".to_string(),
                payload.target_player_id.clone(),
                Some(payload.required_character_id.clone()),
            )
        })
        .collect::<Vec<_>>();
    cerenovus.sort_by_key(|(_, source_player_id, _, _, _)| {
        players
            .iter()
            .find(|player| &player.id == source_player_id)
            .map_or(u8::MAX, |player| player.seat)
    });
    raw.extend(cerenovus);

    raw.into_iter()
        .filter_map(
            |(
                assignment_id,
                source_player_id,
                source_character_id,
                target_player_id,
                required_character_id,
            )| {
                let source = players
                    .iter()
                    .find(|player| player.id == source_player_id)?;
                let target = players
                    .iter()
                    .find(|player| player.id == target_player_id)?;
                if !source.alive || !target.alive {
                    return None;
                }
                let source_effective = source.alive
                    && source.actual_character == source_character_id
                    && !impaired_players.contains(&source.id);
                let latest_check = events.iter().rev().find_map(|event| match &event.kind {
                    GameEventKind::MadnessCheckRecorded { payload }
                        if payload.assignment_id == assignment_id =>
                    {
                        Some((event, payload))
                    }
                    _ => None,
                });
                let status = match latest_check.map(|(_, payload)| payload.result) {
                    Some(MadnessCheckResult::Clear) => MadnessStatus::Clear,
                    Some(MadnessCheckResult::Violation) => MadnessStatus::Violated,
                    None => MadnessStatus::Unchecked,
                };
                let violation_check_event_id = latest_check.and_then(|(event, payload)| {
                    (payload.result == MadnessCheckResult::Violation).then(|| event.id.clone())
                });
                Some(MadnessAssignmentState {
                    assignment_id,
                    source_player_id,
                    source_character_id,
                    target_player_id,
                    required_character_id,
                    status,
                    source_effective,
                    can_check: phase == Phase::Day && target.alive && !pending_execution,
                    can_execute: source_effective
                        && target.alive
                        && !pending_execution
                        && !(phase == Phase::Day && execution_already_occurred),
                    violation_check_event_id,
                })
            },
        )
        .collect()
}

fn juggler_correct_count_for_night(
    night_prefix: &str,
    actor: &Player,
    events: &[GameEvent],
) -> Option<u8> {
    let suffix = night_prefix.strip_prefix("night")?;
    let day_id = format!("day{suffix}");
    let acquisition_index = events
        .iter()
        .position(|event| event.id == actor.ability_instance.source_event_id);
    events
        .iter()
        .skip(acquisition_index.map_or(0, |index| index + 1))
        .rev()
        .find_map(|event| match &event.kind {
            GameEventKind::DayActionRecorded { payload }
                if payload.day_id == day_id
                    && payload.actor_player_id == actor.id
                    && payload.character_id == "juggler" =>
            {
                match payload.record {
                    DayActionRecord::Juggler { correct_count } => Some(correct_count),
                    _ => None,
                }
            }
            _ => None,
        })
}

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

fn character_step(
    phase: Phase,
    prefix: &str,
    character: &str,
    player: &Player,
    players: &[Player],
) -> PhaseStep {
    let snake_charmer = character == "snakeCharmer";
    let pit_hag = character == "pitHag";
    let numeric_information = matches!(character, "clockmaker" | "oracle" | "juggler");
    let targeted_information = matches!(character, "dreamer" | "seamstress");
    let information = numeric_information
        || targeted_information
        || matches!(character, "flowergirl" | "townCrier" | "sage");
    PhaseStep {
        id: if snake_charmer || pit_hag {
            format!("{prefix}:{character}:{}", player.id)
        } else if player.ability_instance.source_event_id != "setup" {
            format!(
                "{prefix}:ability:{}:{}:{character}",
                player.ability_instance.source_event_id, player.id
            )
        } else {
            format!("{prefix}:{character}")
        },
        phase,
        step_type: StepType::Character,
        character: Some(character.to_string()),
        player_id: Some(player.id.clone()),
        required_input: if pit_hag {
            RequiredInput {
                kind: RequiredInputKind::CharacterTransformation,
                target: None,
                min_selections: Some(1),
                max_selections: Some(1),
                setup_info: None,
                character_kind: None,
                allowed_character_ids: Some(script_character_ids()),
                allowed_player_ids: Some(
                    players
                        .iter()
                        .map(|candidate| candidate.id.clone())
                        .collect(),
                ),
                player_registration_options: None,
                zero_allowed: false,
                supports_random_suggestion: false,
                player_id: None,
                survival_allowed: None,
                execution_survival_allowed: false,
                mayor_decision: None,
                demon_succession: None,
                optional: false,
            }
        } else if character == "cerenovus" {
            RequiredInput {
                kind: RequiredInputKind::MadnessAssignment,
                target: Some(InputTarget::Player),
                min_selections: Some(1),
                max_selections: Some(1),
                setup_info: None,
                character_kind: None,
                allowed_character_ids: Some(
                    TOWNSFOLK
                        .iter()
                        .chain(OUTSIDERS.iter())
                        .map(|id| (*id).to_string())
                        .collect(),
                ),
                allowed_player_ids: Some(
                    players
                        .iter()
                        .map(|candidate| candidate.id.clone())
                        .collect(),
                ),
                player_registration_options: None,
                zero_allowed: false,
                supports_random_suggestion: false,
                player_id: None,
                survival_allowed: None,
                execution_survival_allowed: false,
                mayor_decision: None,
                demon_succession: None,
                optional: false,
            }
        } else if snake_charmer || targeted_information {
            let selections = if character == "seamstress" { 2 } else { 1 };
            RequiredInput {
                kind: RequiredInputKind::PlayerIds,
                target: Some(InputTarget::Player),
                min_selections: Some(selections),
                max_selections: Some(selections),
                setup_info: None,
                character_kind: None,
                allowed_character_ids: None,
                allowed_player_ids: Some(
                    players
                        .iter()
                        .filter(|candidate| {
                            snake_charmer && candidate.alive
                                || targeted_information && candidate.id != player.id
                        })
                        .map(|candidate| candidate.id.clone())
                        .collect(),
                ),
                player_registration_options: None,
                zero_allowed: false,
                supports_random_suggestion: false,
                player_id: None,
                survival_allowed: None,
                execution_survival_allowed: false,
                mayor_decision: None,
                demon_succession: None,
                optional: false,
            }
        } else if numeric_information {
            RequiredInput {
                kind: RequiredInputKind::Number,
                target: Some(InputTarget::Number),
                ..required_none()
            }
        } else {
            required_none()
        },
        can_skip: character == "seamstress",
        support: if snake_charmer || pit_hag || information || character == "cerenovus" {
            PhaseStepSupport::Automated
        } else {
            PhaseStepSupport::Manual
        },
        information_prompt: None,
        pre_action_reveal: None,
    }
}

fn phase_prefix_order(prefix: &str) -> Option<usize> {
    if prefix == "firstNight" {
        return Some(0);
    }
    let (kind, cycle) = if let Some(rest) = prefix.strip_prefix("day") {
        (
            "day",
            if rest.is_empty() {
                1
            } else {
                rest.parse().ok()?
            },
        )
    } else if let Some(rest) = prefix.strip_prefix("night") {
        (
            "night",
            if rest.is_empty() {
                1
            } else {
                rest.parse().ok()?
            },
        )
    } else {
        return None;
    };
    Some(if kind == "day" {
        cycle * 2 - 1
    } else {
        cycle * 2
    })
}

fn transition_source<'a>(
    player: &Player,
    events: &'a [GameEvent],
) -> Option<(&'a GameEvent, &'a str, &'a str)> {
    if player.ability_instance.source_event_id == "setup" {
        return None;
    }
    events.iter().find_map(|event| match &event.kind {
        GameEventKind::PlayerTransitioned { payload }
            if event.id == player.ability_instance.source_event_id =>
        {
            Some((
                event,
                payload.step_id.as_str(),
                payload.source_character_id.as_str(),
            ))
        }
        GameEventKind::SnakeCharmerActionResolved { payload }
            if event.id == player.ability_instance.source_event_id =>
        {
            Some((event, payload.step_id.as_str(), "snakeCharmer"))
        }
        GameEventKind::PitHagTransformationResolved { payload }
            if event.id == player.ability_instance.source_event_id =>
        {
            Some((event, payload.step_id.as_str(), "pitHag"))
        }
        _ => None,
    })
}

fn ability_is_base_for_phase(player: &Player, prefix: &str, events: &[GameEvent]) -> bool {
    let Some((_, step_id, _)) = transition_source(player, events) else {
        return true;
    };
    let Some(source_prefix) = step_id.split(':').next() else {
        return false;
    };
    phase_prefix_order(source_prefix)
        .is_some_and(|source| phase_prefix_order(prefix).is_some_and(|target| source < target))
}

fn later_night_wake_rank(character: &str) -> Option<usize> {
    [
        "philosopher",
        "snakeCharmer",
        "witch",
        "cerenovus",
        "pitHag",
        "demon",
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
    ]
    .iter()
    .position(|candidate| {
        *candidate == character || (*candidate == "demon" && DEMONS.contains(&character))
    })
}

fn vigormortis_keeps_minion_ability(
    player: &Player,
    players: &[Player],
    events: &[GameEvent],
) -> bool {
    let acquisition_index = events
        .iter()
        .position(|event| event.id == player.ability_instance.source_event_id);
    character_kind(&player.actual_character) == Some(CharacterKind::Minion)
        && events
            .iter()
            .skip(acquisition_index.map_or(0, |index| index + 1))
            .any(|event| match &event.kind {
                GameEventKind::NightActionResolved { payload }
                    if payload.actor_character_id.as_deref() == Some("vigormortis")
                        && players.iter().any(|candidate| {
                            candidate.id == payload.actor_player_id
                                && candidate.alive
                                && candidate.actual_character == "vigormortis"
                        }) =>
                {
                    matches!(
                        &payload.resolution,
                        NightActionResolution::DemonAttack {
                            outcome: DemonAttackOutcome::Deaths { deaths },
                            ..
                        } if deaths.iter().any(|death| death.player_id == player.id)
                    )
                }
                _ => false,
            })
}

fn player_has_active_ability(player: &Player, players: &[Player], events: &[GameEvent]) -> bool {
    player.alive || vigormortis_keeps_minion_ability(player, players, events)
}

fn death_triggered_in_night_window(player: &Player, prefix: &str, events: &[GameEvent]) -> bool {
    let suffix = prefix.strip_prefix("night").unwrap_or_default();
    let day_prefix = format!("day{suffix}");
    let acquisition_index = events
        .iter()
        .position(|event| event.id == player.ability_instance.source_event_id);
    events
        .iter()
        .skip(acquisition_index.map_or(0, |index| index + 1))
        .any(|event| match &event.kind {
            GameEventKind::DeathConfirmed { payload } => {
                payload.player_id == player.id
                    && payload
                        .step_id
                        .as_deref()
                        .and_then(|step_id| step_id.split(':').next())
                        .is_some_and(|event_prefix| {
                            event_prefix == prefix || event_prefix == day_prefix
                        })
            }
            GameEventKind::NightActionResolved { payload }
                if payload.step_id.split(':').next() == Some(prefix) =>
            {
                matches!(
                    &payload.resolution,
                    NightActionResolution::DemonAttack {
                        outcome: DemonAttackOutcome::Deaths { deaths },
                        ..
                    } if deaths.iter().any(|death| death.player_id == player.id)
                )
            }
            GameEventKind::PitHagArbitraryDeathsConfirmed { payload }
                if payload.step_id.split(':').next() == Some(prefix) =>
            {
                payload
                    .deaths
                    .iter()
                    .any(|death| death.player_id == player.id)
            }
            _ => false,
        })
}

fn acquired_ability_is_available(
    player: &Player,
    character: &str,
    prefix: &str,
    players: &[Player],
    events: &[GameEvent],
) -> bool {
    match character {
        "barber" | "sweetheart" => death_triggered_in_night_window(player, prefix, events),
        "sage" => sage_killer(prefix, player, events).is_some(),
        "juggler" => {
            player_has_active_ability(player, players, events)
                && juggler_correct_count_for_night(prefix, player, events).is_some()
        }
        _ => player_has_active_ability(player, players, events),
    }
}

fn insert_acquired_ability_steps(
    steps: &mut Vec<PhaseStep>,
    phase: Phase,
    prefix: &str,
    players: &[Player],
    events: &[GameEvent],
) {
    let acquisitions = players
        .iter()
        .filter_map(|player| {
            let (event, step_id, source_character) = transition_source(player, events)?;
            if step_id.split(':').next()? != prefix {
                return None;
            }
            Some((player, event, step_id, source_character))
        })
        .collect::<Vec<_>>();

    for (player, event, source_step_id, source_character) in acquisitions {
        let character = player.actual_character.as_str();
        if !acquired_ability_is_available(player, character, prefix, players, events) {
            continue;
        }
        let start_knowing = matches!(character, "clockmaker" | "evilTwin");
        let should_run = if start_knowing {
            true
        } else if phase == Phase::Night {
            match (
                later_night_wake_rank(source_character),
                later_night_wake_rank(character),
            ) {
                (Some(source), Some(target)) => target > source,
                _ => false,
            }
        } else {
            false
        };
        if !should_run {
            continue;
        }

        let mut step = character_step(phase, prefix, character, player, players);
        if DEMONS.contains(&character) {
            step.required_input = RequiredInput {
                kind: RequiredInputKind::PlayerIds,
                target: Some(InputTarget::Player),
                min_selections: Some(1),
                max_selections: Some(1),
                allowed_player_ids: Some(
                    players
                        .iter()
                        .map(|candidate| candidate.id.clone())
                        .collect(),
                ),
                ..required_none()
            };
            step.support = PhaseStepSupport::Automated;
        }
        step.id = if DEMONS.contains(&character) {
            format!("{prefix}:demon:{}", player.id)
        } else {
            format!("{prefix}:ability:{}:{}:{character}", event.id, player.id)
        };
        let insert_at = if start_knowing {
            steps
                .iter()
                .position(|step| step.id == source_step_id)
                .map(|index| index + 1)
        } else {
            let target_rank = later_night_wake_rank(character).unwrap_or(usize::MAX);
            steps.iter().position(|step| {
                step.id.ends_with(":toDay")
                    || step
                        .character
                        .as_deref()
                        .and_then(later_night_wake_rank)
                        .is_some_and(|rank| rank > target_rank)
            })
        }
        .unwrap_or(steps.len());
        steps.insert(insert_at, step);
    }
}

fn demon_step(players: &[Player], events: &[GameEvent], prefix: &str) -> Option<PhaseStep> {
    let resolved_actor = events.iter().find_map(|event| match &event.kind {
        GameEventKind::NightActionResolved { payload }
            if payload.step_id == format!("{prefix}:demon")
                || payload.step_id.starts_with(&format!("{prefix}:demon:")) =>
        {
            payload
                .actor_character_id
                .as_ref()
                .map(|character| (payload.actor_player_id.as_str(), character.as_str()))
        }
        GameEventKind::ManualPhaseStepResolved { payload }
            if payload.step_id.starts_with(&format!("{prefix}:"))
                && DEMONS.iter().any(|demon| payload.step_id.ends_with(demon)) =>
        {
            players
                .iter()
                .find(|player| payload.step_id.ends_with(&player.actual_character))
                .map(|player| (player.id.as_str(), player.actual_character.as_str()))
        }
        _ => None,
    });
    let (actor, character) = resolved_actor.or_else(|| {
        players
            .iter()
            .find(|player| {
                player.alive
                    && DEMONS.contains(&player.actual_character.as_str())
                    && ability_is_base_for_phase(player, prefix, events)
            })
            .map(|player| (player.id.as_str(), player.actual_character.as_str()))
    })?;
    Some(PhaseStep {
        id: format!("{prefix}:demon:{actor}"),
        phase: Phase::Night,
        step_type: StepType::Character,
        character: Some(character.to_string()),
        player_id: Some(actor.to_string()),
        required_input: RequiredInput {
            kind: RequiredInputKind::PlayerIds,
            target: Some(InputTarget::Player),
            min_selections: Some(1),
            max_selections: Some(1),
            setup_info: None,
            character_kind: None,
            allowed_character_ids: None,
            allowed_player_ids: Some(players.iter().map(|player| player.id.clone()).collect()),
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
        support: PhaseStepSupport::Automated,
        information_prompt: None,
        pre_action_reveal: None,
    })
}

fn pit_hag_demon_creation<'a>(events: &'a [GameEvent], prefix: &str) -> Option<&'a GameEvent> {
    events.iter().find(|event| match &event.kind {
        GameEventKind::PitHagTransformationResolved { payload }
            if payload.step_id.starts_with(&format!("{prefix}:pitHag:")) =>
        {
            matches!(
                payload.outcome,
                PitHagTransformationOutcome::Changed {
                    created_demon: true,
                    ..
                }
            )
        }
        _ => false,
    })
}

fn pit_hag_arbitrary_deaths_step(
    players: &[Player],
    events: &[GameEvent],
    prefix: &str,
) -> Option<PhaseStep> {
    pit_hag_demon_creation(events, prefix)?;
    let living_ids = players
        .iter()
        .filter(|player| player.alive)
        .map(|player| player.id.clone())
        .collect::<Vec<_>>();
    Some(PhaseStep {
        id: format!("{prefix}:pitHagArbitraryDeaths"),
        phase: Phase::Night,
        step_type: StepType::PitHagArbitraryDeaths,
        character: None,
        player_id: None,
        required_input: RequiredInput {
            kind: RequiredInputKind::PlayerIds,
            target: Some(InputTarget::Players),
            min_selections: Some(0),
            max_selections: Some(living_ids.len().min(u8::MAX as usize) as u8),
            setup_info: None,
            character_kind: None,
            allowed_character_ids: None,
            allowed_player_ids: Some(living_ids),
            player_registration_options: None,
            zero_allowed: true,
            supports_random_suggestion: false,
            player_id: None,
            survival_allowed: None,
            execution_survival_allowed: false,
            mayor_decision: None,
            demon_succession: None,
            optional: false,
        },
        can_skip: false,
        support: PhaseStepSupport::Automated,
        information_prompt: None,
        pre_action_reveal: None,
    })
}

fn later_night_steps(players: &[Player], events: &[GameEvent], cycle: usize) -> Vec<PhaseStep> {
    #[cfg(test)]
    PHASE_STEP_BUILD_COUNT.with(|count| count.set(count.get() + 1));
    let prefix = crate::phase::phase_prefix("night", cycle);
    let mut steps = Vec::new();
    for character in [
        "philosopher",
        "snakeCharmer",
        "witch",
        "cerenovus",
        "pitHag",
    ] {
        let mut matching = players
            .iter()
            .filter(|player| {
                player.actual_character == character
                    && ability_is_base_for_phase(player, &prefix, events)
                    && player_has_active_ability(player, players, events)
                    && (character != "snakeCharmer"
                        || !became_snake_charmer_from_swap_in_phase(&player.id, &prefix, events))
            })
            .collect::<Vec<_>>();
        matching.sort_by_key(|player| player.seat);
        for player in matching {
            steps.push(character_step(
                Phase::Night,
                &prefix,
                character,
                player,
                players,
            ));
        }
    }
    if let Some(step) = demon_step(players, events, &prefix) {
        steps.push(step);
    }
    for character in [
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
        let mut matching = players
            .iter()
            .filter(|player| {
                player.actual_character == character
                    && ability_is_base_for_phase(player, &prefix, events)
                    && match character {
                        "barber" | "sweetheart" => {
                            death_triggered_in_night_window(player, &prefix, events)
                        }
                        "sage" => sage_killer(&prefix, player, events).is_some(),
                        _ => player_has_active_ability(player, players, events),
                    }
                    && (character != "juggler"
                        || juggler_correct_count_for_night(&prefix, player, events).is_some())
                    && (character != "seamstress" || !seamstress_already_used(player, events))
            })
            .collect::<Vec<_>>();
        matching.sort_by_key(|player| player.seat);
        for player in matching {
            steps.push(character_step(
                Phase::Night,
                &prefix,
                character,
                player,
                players,
            ));
        }
    }
    steps.push(phase_transition_step(
        Phase::Night,
        &prefix,
        "toDay",
        crate::model::RequiredInputKind::Day,
    ));
    insert_acquired_ability_steps(&mut steps, Phase::Night, &prefix, players, events);
    if let Some(step) = pit_hag_arbitrary_deaths_step(players, events, &prefix) {
        let insert_at = steps
            .iter()
            .position(|candidate| candidate.id.ends_with(":toDay"))
            .unwrap_or(steps.len());
        steps.insert(insert_at, step);
    }
    steps
}

fn current_phase_steps(
    players: &[Player],
    events: &[GameEvent],
    max_cycles: usize,
    statuses: &HashMap<String, PhaseStepStatus>,
) -> Option<(Phase, Vec<PhaseStep>, Option<PhaseStep>)> {
    let current_in = |phase, steps: Vec<PhaseStep>| {
        if steps
            .iter()
            .all(|step| crate::phase::step_status(&step.id, statuses).is_done())
        {
            return None;
        }
        let current = steps
            .iter()
            .find(|step| !crate::phase::step_status(&step.id, statuses).is_done())
            .cloned();
        Some((phase, steps, current))
    };

    if let Some(current) = current_in(Phase::FirstNight, first_night_steps(players, events)) {
        return Some(current);
    }
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
        if let Some(current) = current_in(
            Phase::Day,
            day_steps(cycle, statuses, executed_player_id, events, players),
        ) {
            return Some(current);
        }
        if let Some(current) = current_in(Phase::Night, later_night_steps(players, events, cycle)) {
            return Some(current);
        }
    }
    None
}

fn first_night_steps(players: &[Player], events: &[GameEvent]) -> Vec<PhaseStep> {
    #[cfg(test)]
    PHASE_STEP_BUILD_COUNT.with(|count| count.set(count.get() + 1));
    let mut steps = Vec::new();
    let players_for = |character: &str| {
        let mut matching = players
            .iter()
            .filter(|player| {
                player.actual_character == character
                    && ability_is_base_for_phase(player, "firstNight", events)
                    && ((!matches!(character, "clockmaker") || player.alive)
                        && (character != "snakeCharmer"
                            || (player.alive
                                && !became_snake_charmer_from_swap_in_phase(
                                    &player.id,
                                    "firstNight",
                                    events,
                                ))))
            })
            .collect::<Vec<_>>();
        matching.sort_by_key(|player| player.seat);
        matching
    };

    for player in players_for("philosopher") {
        steps.push(character_step(
            Phase::FirstNight,
            "firstNight",
            "philosopher",
            player,
            players,
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
        for player in players_for(character) {
            steps.push(character_step(
                Phase::FirstNight,
                "firstNight",
                character,
                player,
                players,
            ));
        }
    }
    steps.push(phase_transition_step(
        Phase::FirstNight,
        "firstNight",
        "toDay",
        crate::model::RequiredInputKind::Day,
    ));
    insert_acquired_ability_steps(&mut steps, Phase::FirstNight, "firstNight", players, events);
    steps
}

fn became_snake_charmer_from_swap_in_phase(
    player_id: &str,
    prefix: &str,
    events: &[GameEvent],
) -> bool {
    events.iter().any(|event| match &event.kind {
        GameEventKind::SnakeCharmerActionResolved { payload }
            if payload.target_player_id == player_id
                && payload
                    .step_id
                    .starts_with(&format!("{prefix}:snakeCharmer:")) =>
        {
            matches!(payload.outcome, SnakeCharmerActionOutcome::Swap { .. })
        }
        _ => false,
    })
}

fn is_information_character(character: Option<&str>) -> bool {
    matches!(
        character,
        Some(
            "clockmaker"
                | "dreamer"
                | "flowergirl"
                | "townCrier"
                | "oracle"
                | "seamstress"
                | "sage"
        )
    )
}

fn preceding_day_prefix(step_id: &str) -> Option<String> {
    let night_prefix = step_id.split(':').next()?;
    let suffix = night_prefix.strip_prefix("night")?;
    let cycle = if suffix.is_empty() {
        1
    } else {
        suffix.parse().ok()?
    };
    Some(crate::phase::phase_prefix("day", cycle))
}

fn clockmaker_distance(players: &[Player]) -> Option<usize> {
    let mut seated = players.iter().collect::<Vec<_>>();
    seated.sort_by_key(|player| player.seat);
    let demons = seated
        .iter()
        .enumerate()
        .filter_map(|(index, player)| {
            (character_kind(&player.actual_character) == Some(CharacterKind::Demon))
                .then_some(index)
        })
        .collect::<Vec<_>>();
    let minions = seated
        .iter()
        .enumerate()
        .filter_map(|(index, player)| {
            (character_kind(&player.actual_character) == Some(CharacterKind::Minion))
                .then_some(index)
        })
        .collect::<Vec<_>>();
    demons
        .iter()
        .flat_map(|demon| minions.iter().map(move |minion| demon.abs_diff(*minion)))
        .map(|distance| distance.min(seated.len() - distance))
        .min()
}

fn preceding_day_role_action(
    step: &PhaseStep,
    events: &[GameEvent],
    role: CharacterKind,
) -> Result<bool, CoreError> {
    let prefix =
        preceding_day_prefix(&step.id).ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
    day_role_action(&prefix, events, role)
}

fn day_role_action(
    prefix: &str,
    events: &[GameEvent],
    role: CharacterKind,
) -> Result<bool, CoreError> {
    for (event_index, event) in events.iter().enumerate() {
        let candidate_ids = match &event.kind {
            GameEventKind::NominationVoteConfirmed { payload }
                if role == CharacterKind::Demon
                    && payload.step_id.starts_with(&format!("{prefix}:")) =>
            {
                payload.voter_ids.clone()
            }
            GameEventKind::NominationStarted { payload }
                if role == CharacterKind::Minion
                    && payload.step_id.starts_with(&format!("{prefix}:")) =>
            {
                vec![payload.nominator_id.clone()]
            }
            _ => continue,
        };
        let players_at_event = replay_players(&events[..event_index])?;
        if candidate_ids.iter().any(|player_id| {
            players_at_event.iter().any(|player| {
                player.id == *player_id && character_kind(&player.actual_character) == Some(role)
            })
        }) {
            return Ok(true);
        }
    }
    Ok(false)
}

fn automatic_information_reminders(
    phase: Phase,
    current_step: Option<&PhaseStep>,
    players: &[Player],
    events: &[GameEvent],
) -> Result<Vec<AutomaticReminder>, CoreError> {
    let Some(step) = current_step else {
        return Ok(vec![]);
    };
    let day_prefix = match phase {
        Phase::Day => step.id.split(':').next().map(str::to_string),
        Phase::Night => preceding_day_prefix(&step.id),
        _ => None,
    };
    let Some(day_prefix) = day_prefix else {
        return Ok(vec![]);
    };
    let demon_voted = day_role_action(&day_prefix, events, CharacterKind::Demon)?;
    let minion_nominated = day_role_action(&day_prefix, events, CharacterKind::Minion)?;
    let mut reminders = vec![];
    for (character_id, triggered, false_token, false_label, true_token, true_label, description) in [
        (
            "flowergirl",
            demon_voted,
            "demonDidNotVote",
            "악마 투표 안 함",
            "demonVoted",
            "악마 투표함",
            if demon_voted {
                "오늘 악마가 처형 투표에 참여했습니다."
            } else {
                "오늘 악마가 처형 투표에 참여하지 않았습니다."
            },
        ),
        (
            "townCrier",
            minion_nominated,
            "minionDidNotNominate",
            "하수인 지목 안 함",
            "minionNominated",
            "하수인 지목함",
            if minion_nominated {
                "오늘 하수인이 처형 지목에 나섰습니다."
            } else {
                "오늘 하수인이 처형 지목에 나서지 않았습니다."
            },
        ),
    ] {
        let Some(player) = players
            .iter()
            .find(|player| player.alive && player.actual_character == character_id)
        else {
            continue;
        };
        reminders.push(AutomaticReminder {
            player_id: player.id.clone(),
            character_id: character_id.into(),
            token_id: if triggered { true_token } else { false_token }.into(),
            label: if triggered { true_label } else { false_label }.into(),
            description: description.into(),
        });
    }
    Ok(reminders)
}

fn snv_information_result(
    step: &PhaseStep,
    players: &[Player],
    events: &[GameEvent],
) -> Result<Option<InformationResult>, CoreError> {
    Ok(match step.character.as_deref() {
        Some("clockmaker") => {
            clockmaker_distance(players).map(|value| InformationResult::Number { value })
        }
        Some("flowergirl") => Some(InformationResult::Boolean {
            value: preceding_day_role_action(step, events, CharacterKind::Demon)?,
        }),
        Some("townCrier") => Some(InformationResult::Boolean {
            value: preceding_day_role_action(step, events, CharacterKind::Minion)?,
        }),
        Some("oracle") => Some(InformationResult::Number {
            value: players
                .iter()
                .filter(|player| !player.alive && player.alignment == Alignment::Evil)
                .count(),
        }),
        Some("juggler") => step
            .player_id
            .as_deref()
            .and_then(|player_id| players.iter().find(|player| player.id == player_id))
            .and_then(|player| {
                juggler_correct_count_for_night(
                    step.id.split(':').next().unwrap_or_default(),
                    player,
                    events,
                )
            })
            .map(|value| InformationResult::Number {
                value: usize::from(value),
            }),
        Some("sage") => step
            .player_id
            .as_deref()
            .and_then(|player_id| players.iter().find(|player| player.id == player_id))
            .and_then(|player| {
                sage_killer(
                    step.id.split(':').next().unwrap_or_default(),
                    player,
                    events,
                )
            })
            .map(|player_id| InformationResult::Player { player_id }),
        _ => None,
    })
}

fn snv_information_prompt(
    step: &PhaseStep,
    players: &[Player],
    events: &[GameEvent],
) -> Result<Option<InformationPrompt>, CoreError> {
    let active_reasons = active_information_reasons(step, players, events);
    let impaired = !active_reasons.is_empty();
    if matches!(step.character.as_deref(), Some("dreamer" | "seamstress")) {
        let target_checks = targeted_information_checks(step, players, impaired)?;
        return Ok(Some(InformationPrompt {
            computed_result: None,
            delivery_mode: if impaired || step.character.as_deref() == Some("dreamer") {
                InformationDeliveryMode::Selectable
            } else {
                InformationDeliveryMode::Fixed
            },
            active_reasons,
            registration_candidate_player_ids: vec![],
            number_choices: vec![],
            boolean_choices: vec![],
            setup_info_registration_options: vec![],
            target_checks,
        }));
    }
    let Some(computed_result) = snv_information_result(step, players, events)? else {
        return Ok(None);
    };
    if step.character.as_deref() == Some("sage") {
        let InformationResult::Player { player_id } = &computed_result else {
            return Err(ErrorKind::ReplayFailed.into_error());
        };
        let choices = sage_choices(players, player_id, impaired);
        return Ok(Some(InformationPrompt {
            computed_result: Some(computed_result.clone()),
            delivery_mode: InformationDeliveryMode::Selectable,
            active_reasons,
            registration_candidate_player_ids: vec![],
            number_choices: vec![],
            boolean_choices: vec![],
            setup_info_registration_options: vec![],
            target_checks: vec![TargetInformationCheck {
                target_player_ids: vec![],
                computed_result,
                choices,
            }],
        }));
    }
    let (number_choices, boolean_choices) = match computed_result {
        InformationResult::Number { value } => (
            if impaired {
                let range = if step.character.as_deref() == Some("clockmaker") {
                    1..=players.len() / 2
                } else if step.character.as_deref() == Some("juggler") {
                    0..=5
                } else {
                    0..=players.iter().filter(|player| !player.alive).count()
                };
                range
                    .map(|candidate| NumberInformationChoice {
                        value: candidate,
                        is_computed: candidate == value,
                        registration_judgments: vec![],
                    })
                    .collect()
            } else {
                vec![NumberInformationChoice {
                    value,
                    is_computed: true,
                    registration_judgments: vec![],
                }]
            },
            vec![],
        ),
        InformationResult::Boolean { value } => (
            vec![],
            if impaired {
                [false, true]
                    .into_iter()
                    .map(|candidate| BooleanInformationChoice {
                        value: candidate,
                        is_computed: candidate == value,
                        registration_judgments: vec![],
                    })
                    .collect()
            } else {
                vec![BooleanInformationChoice {
                    value,
                    is_computed: true,
                    registration_judgments: vec![],
                }]
            },
        ),
        _ => return Err(ErrorKind::ReplayFailed.into_error()),
    };
    Ok(Some(InformationPrompt {
        computed_result: Some(computed_result),
        delivery_mode: if impaired {
            InformationDeliveryMode::Selectable
        } else {
            InformationDeliveryMode::Fixed
        },
        active_reasons,
        registration_candidate_player_ids: vec![],
        number_choices,
        boolean_choices,
        setup_info_registration_options: vec![],
        target_checks: vec![],
    }))
}

fn active_information_reasons(
    step: &PhaseStep,
    players: &[Player],
    events: &[GameEvent],
) -> Vec<DeliveryReason> {
    let Some(actor_id) = step.player_id.as_deref() else {
        return vec![];
    };
    let mut reasons = active_snake_charmer_impairments(events)
        .into_iter()
        .filter(|impairment| impairment.player_id == actor_id)
        .filter_map(|impairment| {
            events.iter().find_map(|event| {
                if event.id != impairment.source_event_id {
                    return None;
                }
                let GameEventKind::SnakeCharmerActionResolved { payload } = &event.kind else {
                    return None;
                };
                Some(DeliveryReason::Poisoned {
                    poisoner_player_id: payload.actor_player_id.clone(),
                    poison_event_id: event.id.clone(),
                })
            })
        })
        .collect::<Vec<_>>();
    if step.character.as_deref().and_then(character_kind) == Some(CharacterKind::Townsfolk) {
        if let Some(vortox) = players
            .iter()
            .find(|player| player.alive && player.actual_character == "vortox")
        {
            reasons.push(DeliveryReason::Vortox {
                demon_player_id: vortox.id.clone(),
            });
        }
    }
    reasons
}

fn snv_confirmed_information(
    step: &PhaseStep,
    players: &[Player],
    events: &[GameEvent],
    input: &StepInput,
    delivered_result: Option<InformationResult>,
    registration_judgments: &[crate::model::RegistrationJudgment],
) -> Result<Option<ConfirmedInformation>, CoreError> {
    if matches!(
        step.character.as_deref(),
        Some("dreamer" | "seamstress" | "sage")
    ) {
        return confirmed_targeted_information(
            step,
            players,
            events,
            input,
            delivered_result,
            registration_judgments,
        );
    }
    let Some(computed_result) = snv_information_result(step, players, events)? else {
        return Ok(None);
    };
    if !registration_judgments.is_empty() {
        return Err(ErrorKind::InvalidRegistrationJudgment.into_error());
    }
    let reasons = active_information_reasons(step, players, events);
    let prompt = snv_information_prompt(step, players, events)?
        .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
    let delivered_result = if reasons.is_empty() {
        let delivered = delivered_result.unwrap_or_else(|| computed_result.clone());
        if delivered != computed_result {
            return Err(ErrorKind::InvalidDeliveredInformation.into_error());
        }
        delivered
    } else {
        let delivered =
            delivered_result.ok_or_else(|| ErrorKind::MissingDeliveredInformation.into_error())?;
        let legal = match &delivered {
            InformationResult::Number { value } => prompt
                .number_choices
                .iter()
                .any(|choice| choice.value == *value),
            InformationResult::Boolean { value } => prompt
                .boolean_choices
                .iter()
                .any(|choice| choice.value == *value),
            _ => false,
        };
        if !legal {
            return Err(ErrorKind::InvalidDeliveredInformation.into_error());
        }
        delivered
    };
    Ok(Some(ConfirmedInformation {
        actor: Some(InformationActor {
            player_id: step
                .player_id
                .clone()
                .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?,
            character_id: step
                .character
                .clone()
                .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?,
        }),
        target_player_ids: vec![],
        computed_result: Some(computed_result),
        delivered_result,
        delivery_context: if reasons.is_empty() {
            DeliveryContext::Fixed
        } else {
            DeliveryContext::Discretionary { reasons }
        },
    }))
}

fn targeted_information_checks(
    step: &PhaseStep,
    players: &[Player],
    impaired: bool,
) -> Result<Vec<TargetInformationCheck>, CoreError> {
    let actor_id = step
        .player_id
        .as_deref()
        .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
    let candidates = players
        .iter()
        .filter(|player| player.id != actor_id)
        .collect::<Vec<_>>();
    if step.character.as_deref() == Some("dreamer") {
        return Ok(candidates
            .into_iter()
            .map(|target| {
                let actual_good = matches!(
                    character_kind(&target.actual_character),
                    Some(CharacterKind::Townsfolk | CharacterKind::Outsider)
                );
                let choices = TOWNSFOLK
                    .iter()
                    .chain(OUTSIDERS.iter())
                    .flat_map(|good| {
                        MINIONS.iter().chain(DEMONS.iter()).filter_map(move |evil| {
                            (impaired
                                || actual_good && *good == target.actual_character
                                || !actual_good && *evil == target.actual_character)
                                .then(|| TargetInformationChoice {
                                    result: InformationResult::CharacterPair {
                                        character_ids: vec![(*good).into(), (*evil).into()],
                                    },
                                    is_computed: !impaired,
                                    registration_judgments: vec![],
                                })
                        })
                    })
                    .collect();
                TargetInformationCheck {
                    target_player_ids: vec![target.id.clone()],
                    computed_result: InformationResult::Character {
                        character_id: target.actual_character.clone(),
                    },
                    choices,
                }
            })
            .collect());
    }
    if step.character.as_deref() == Some("seamstress") {
        let mut checks = vec![];
        for (index, first) in candidates.iter().enumerate() {
            for second in candidates.iter().skip(index + 1) {
                let same = first.alignment == second.alignment;
                checks.push(TargetInformationCheck {
                    target_player_ids: vec![first.id.clone(), second.id.clone()],
                    computed_result: InformationResult::Boolean { value: same },
                    choices: if impaired {
                        [false, true]
                            .into_iter()
                            .map(|value| TargetInformationChoice {
                                result: InformationResult::Boolean { value },
                                is_computed: value == same,
                                registration_judgments: vec![],
                            })
                            .collect()
                    } else {
                        vec![TargetInformationChoice {
                            result: InformationResult::Boolean { value: same },
                            is_computed: true,
                            registration_judgments: vec![],
                        }]
                    },
                });
            }
        }
        return Ok(checks);
    }
    Err(ErrorKind::ReplayFailed.into_error())
}

fn sage_choices(
    players: &[Player],
    killer_id: &str,
    impaired: bool,
) -> Vec<TargetInformationChoice> {
    let mut choices = vec![];
    for first in players {
        for second in players {
            if first.id == second.id
                || (!impaired && first.id != killer_id && second.id != killer_id)
            {
                continue;
            }
            choices.push(TargetInformationChoice {
                result: InformationResult::PlayerPair {
                    player_ids: vec![first.id.clone(), second.id.clone()],
                },
                is_computed: !impaired,
                registration_judgments: vec![],
            });
        }
    }
    choices
}

fn confirmed_targeted_information(
    step: &PhaseStep,
    players: &[Player],
    events: &[GameEvent],
    input: &StepInput,
    delivered_result: Option<InformationResult>,
    registration_judgments: &[crate::model::RegistrationJudgment],
) -> Result<Option<ConfirmedInformation>, CoreError> {
    if !registration_judgments.is_empty() {
        return Err(ErrorKind::InvalidRegistrationJudgment.into_error());
    }
    let prompt = snv_information_prompt(step, players, events)?
        .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
    let targets = input
        .as_ref()
        .and_then(|value| value.player_ids.clone())
        .unwrap_or_default();
    let check = prompt
        .target_checks
        .iter()
        .find(|check| {
            check.target_player_ids.len() == targets.len()
                && check
                    .target_player_ids
                    .iter()
                    .all(|id| targets.contains(id))
        })
        .ok_or_else(|| ErrorKind::InvalidStepInput.into_error())?;
    let delivered = delivered_result
        .or_else(|| (check.choices.len() == 1).then(|| check.choices[0].result.clone()))
        .ok_or_else(|| ErrorKind::MissingDeliveredInformation.into_error())?;
    if !check
        .choices
        .iter()
        .any(|choice| choice.result == delivered)
    {
        return Err(ErrorKind::InvalidDeliveredInformation.into_error());
    }
    let mut reasons = active_information_reasons(step, players, events);
    if matches!(step.character.as_deref(), Some("dreamer" | "sage")) {
        reasons.push(DeliveryReason::AbilityChoice);
    }
    Ok(Some(ConfirmedInformation {
        actor: Some(InformationActor {
            player_id: step
                .player_id
                .clone()
                .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?,
            character_id: step
                .character
                .clone()
                .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?,
        }),
        target_player_ids: targets,
        computed_result: Some(check.computed_result.clone()),
        delivered_result: delivered,
        delivery_context: if reasons.is_empty() {
            DeliveryContext::Fixed
        } else {
            DeliveryContext::Discretionary { reasons }
        },
    }))
}

fn seamstress_already_used(player: &Player, events: &[GameEvent]) -> bool {
    let acquisition_index = events
        .iter()
        .position(|event| event.id == player.ability_instance.source_event_id);
    events.iter().skip(acquisition_index.map_or(0, |index| index + 1)).any(|event| matches!(&event.kind,
        GameEventKind::PhaseStepConfirmed { payload }
            if payload.information.as_ref().and_then(|info| info.actor.as_ref()).is_some_and(|actor| actor.player_id == player.id && actor.character_id == "seamstress")
    ))
}

fn sage_killer(prefix: &str, sage: &Player, events: &[GameEvent]) -> Option<String> {
    let acquisition_index = events
        .iter()
        .position(|event| event.id == sage.ability_instance.source_event_id);
    events
        .iter()
        .skip(acquisition_index.map_or(0, |index| index + 1))
        .find_map(|event| match &event.kind {
            GameEventKind::NightActionResolved { payload }
                if payload.step_id.starts_with(&format!("{prefix}:demon:")) =>
            {
                let NightActionResolution::DemonAttack {
                    outcome: DemonAttackOutcome::Deaths { deaths },
                    ..
                } = &payload.resolution
                else {
                    return None;
                };
                deaths.iter().find_map(|death| match &death.cause {
                    NightDeathCause::DemonAttack {
                        actor_player_id,
                        target_player_id,
                        ..
                    } if target_player_id == &sage.id => Some(actor_player_id.clone()),
                    _ => None,
                })
            }
            _ => None,
        })
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

fn identity_state(player: &Player) -> IdentityState {
    IdentityState {
        actual_character: player.actual_character.clone(),
        shown_character: player.shown_character.clone(),
        alignment: player.alignment,
    }
}

fn player_state(player: &Player) -> PlayerStateSnapshot {
    PlayerStateSnapshot {
        actual_character: player.actual_character.clone(),
        shown_character: player.shown_character.clone(),
        alignment: player.alignment,
        alive: player.alive,
    }
}

struct PlayerTimeline {
    current: Vec<Player>,
    before_event: Vec<Vec<Player>>,
}

fn replay_player_timeline(events: &[GameEvent]) -> Result<PlayerTimeline, CoreError> {
    #[cfg(test)]
    PLAYER_REPLAY_PASS_COUNT.with(|count| count.set(count.get() + 1));
    let mut players = setup_players(events)?;
    let mut active_impairments = Vec::<ActiveImpairment>::new();
    let mut before_event = Vec::with_capacity(events.len());
    if !events.is_empty() {
        before_event.push(players.clone());
    }
    for (event_index, event) in events.iter().enumerate().skip(1) {
        before_event.push(players.clone());
        match &event.kind {
            GameEventKind::DeathConfirmed { payload } => {
                let Some(player) = players
                    .iter_mut()
                    .find(|player| player.id == payload.player_id && player.alive)
                else {
                    return Err(ErrorKind::ReplayFailed.into_error());
                };
                player.alive = false;
            }
            GameEventKind::NominationVoteConfirmed { payload } => {
                for player_id in &payload.ghost_vote_spent_player_ids {
                    let Some(player) = players.iter_mut().find(|player| player.id == *player_id)
                    else {
                        return Err(ErrorKind::ReplayFailed.into_error());
                    };
                    if player.alive || player.ghost_vote_used {
                        return Err(ErrorKind::ReplayFailed.into_error());
                    }
                    player.ghost_vote_used = true;
                }
            }
            GameEventKind::PlayerAnnotationsUpdated { payload } => {
                let player = players
                    .iter_mut()
                    .find(|player| player.id == payload.player_id)
                    .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
                player.system_token_ids = payload.system_token_ids.clone();
                player.script_tokens = payload.script_tokens.clone();
                player.notes = payload.notes.clone();
            }
            GameEventKind::NightActionResolved { payload } => {
                let Some(actor_character_id) = payload.actor_character_id.as_deref() else {
                    return Err(ErrorKind::ReplayFailed.into_error());
                };
                let Some(actor) = players
                    .iter()
                    .find(|player| player.id == payload.actor_player_id)
                else {
                    return Err(ErrorKind::ReplayFailed.into_error());
                };
                if actor.actual_character != actor_character_id
                    || !DEMONS.contains(&actor_character_id)
                {
                    return Err(ErrorKind::ReplayFailed.into_error());
                }
                let NightActionResolution::DemonAttack {
                    target_player_id,
                    outcome,
                } = &payload.resolution
                else {
                    return Err(ErrorKind::ReplayFailed.into_error());
                };
                let Some(target) = players.iter().find(|player| player.id == *target_player_id)
                else {
                    return Err(ErrorKind::ReplayFailed.into_error());
                };
                match outcome {
                    DemonAttackOutcome::Deaths { deaths } => {
                        if deaths.is_empty() {
                            return Err(ErrorKind::ReplayFailed.into_error());
                        }
                        for death in deaths {
                            let NightDeathCause::DemonAttack {
                                actor_player_id,
                                actor_character_id: cause_character_id,
                                target_player_id: cause_target_id,
                            } = &death.cause
                            else {
                                return Err(ErrorKind::ReplayFailed.into_error());
                            };
                            if actor_player_id != &payload.actor_player_id
                                || cause_character_id != actor_character_id
                                || cause_target_id != target_player_id
                            {
                                return Err(ErrorKind::ReplayFailed.into_error());
                            }
                            let Some(player) = players
                                .iter_mut()
                                .find(|player| player.id == death.player_id)
                            else {
                                return Err(ErrorKind::ReplayFailed.into_error());
                            };
                            if !player.alive {
                                return Err(ErrorKind::ReplayFailed.into_error());
                            }
                            player.alive = false;
                        }
                    }
                    DemonAttackOutcome::NoEffect {
                        reason: DemonAttackNoEffectReason::TargetAlreadyDead,
                    } => {
                        if target.alive {
                            return Err(ErrorKind::ReplayFailed.into_error());
                        }
                    }
                    DemonAttackOutcome::NoEffect {
                        reason:
                            DemonAttackNoEffectReason::ActorImpaired
                            | DemonAttackNoEffectReason::NotActualCharacter,
                    } => {}
                    DemonAttackOutcome::NoEffect {
                        reason: DemonAttackNoEffectReason::PitHagCreatedDemon,
                    } => {
                        let prefix = payload
                            .step_id
                            .split(":demon:")
                            .next()
                            .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
                        if pit_hag_demon_creation(&events[..event_index], prefix).is_none() {
                            return Err(ErrorKind::ReplayFailed.into_error());
                        }
                    }
                }
            }
            GameEventKind::PitHagArbitraryDeathsConfirmed { payload } => {
                let source = events[..event_index]
                    .iter()
                    .find(|event| event.id == payload.source_transformation_event_id)
                    .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
                let GameEventKind::PitHagTransformationResolved {
                    payload: transformation,
                } = &source.kind
                else {
                    return Err(ErrorKind::ReplayFailed.into_error());
                };
                if !matches!(
                    transformation.outcome,
                    PitHagTransformationOutcome::Changed {
                        created_demon: true,
                        ..
                    }
                ) {
                    return Err(ErrorKind::ReplayFailed.into_error());
                }
                for death in &payload.deaths {
                    let NightDeathCause::PitHagArbitraryDeath {
                        actor_player_id,
                        source_transformation_event_id,
                    } = &death.cause
                    else {
                        return Err(ErrorKind::ReplayFailed.into_error());
                    };
                    if actor_player_id != &transformation.actor_player_id
                        || source_transformation_event_id != &source.id
                    {
                        return Err(ErrorKind::ReplayFailed.into_error());
                    }
                    let player = players
                        .iter_mut()
                        .find(|player| player.id == death.player_id)
                        .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
                    if !player.alive {
                        return Err(ErrorKind::ReplayFailed.into_error());
                    }
                    player.alive = false;
                }
            }
            GameEventKind::NightDeathsAnnounced { payload } => {
                if payload.player_ids != unannounced_night_death_player_ids(&events[..event_index])
                    || payload.resurrected_player_ids
                        != unannounced_night_resurrection_player_ids(&events[..event_index])
                {
                    return Err(ErrorKind::ReplayFailed.into_error());
                }
                if payload.resurrected_player_ids.iter().any(|player_id| {
                    !players
                        .iter()
                        .any(|player| player.id == *player_id && player.alive)
                }) {
                    return Err(ErrorKind::ReplayFailed.into_error());
                }
                for player_id in &payload.player_ids {
                    let Some(player) = players.iter_mut().find(|player| player.id == *player_id)
                    else {
                        return Err(ErrorKind::ReplayFailed.into_error());
                    };
                    if player.alive {
                        return Err(ErrorKind::ReplayFailed.into_error());
                    }
                    player.death_announced = true;
                }
            }
            GameEventKind::SnakeCharmerActionResolved { payload } => {
                let Some(actor) = players.iter().find(|player| {
                    player.id == payload.actor_player_id
                        && player.alive
                        && player.actual_character == "snakeCharmer"
                }) else {
                    return Err(ErrorKind::ReplayFailed.into_error());
                };
                if !payload
                    .step_id
                    .ends_with(&format!(":snakeCharmer:{}", actor.id))
                    && !payload
                        .step_id
                        .ends_with(&format!(":{}:snakeCharmer", actor.id))
                {
                    return Err(ErrorKind::ReplayFailed.into_error());
                }
                let actor_before = identity_state(actor);
                let actor_alignment = actor.alignment;
                let Some(target) = players
                    .iter()
                    .find(|player| player.id == payload.target_player_id && player.alive)
                else {
                    return Err(ErrorKind::ReplayFailed.into_error());
                };
                let target_before = identity_state(target);
                let target_alignment = target.alignment;
                let actor_impaired = active_impairments.iter().any(|impairment| {
                    impairment.player_id == payload.actor_player_id
                        && impairment.kind == ImpairmentKind::Poisoned
                });
                let target_is_demon =
                    character_kind(&target.actual_character) == Some(CharacterKind::Demon);

                if !target_is_demon {
                    if payload.outcome
                        != (SnakeCharmerActionOutcome::NoSwap {
                            reason: SnakeCharmerNoSwapReason::TargetNotDemon,
                        })
                    {
                        return Err(ErrorKind::ReplayFailed.into_error());
                    }
                    continue;
                }
                if actor_impaired {
                    if payload.outcome
                        != (SnakeCharmerActionOutcome::NoSwap {
                            reason: SnakeCharmerNoSwapReason::ActorImpaired,
                        })
                    {
                        return Err(ErrorKind::ReplayFailed.into_error());
                    }
                    continue;
                }

                let transitions = vec![
                    PlayerIdentityTransition {
                        player_id: payload.actor_player_id.clone(),
                        before: actor_before.clone(),
                        after: IdentityState {
                            actual_character: target_before.actual_character.clone(),
                            shown_character: target_before.shown_character.clone(),
                            alignment: target_alignment,
                        },
                    },
                    PlayerIdentityTransition {
                        player_id: payload.target_player_id.clone(),
                        before: target_before.clone(),
                        after: IdentityState {
                            actual_character: "snakeCharmer".into(),
                            shown_character: "snakeCharmer".into(),
                            alignment: actor_alignment,
                        },
                    },
                ];
                let impairment = ActiveImpairment {
                    kind: ImpairmentKind::Poisoned,
                    player_id: payload.target_player_id.clone(),
                    source_event_id: event.id.clone(),
                    source_character_id: "snakeCharmer".into(),
                    expires: ImpairmentExpiry::Never,
                };
                if payload.outcome
                    != (SnakeCharmerActionOutcome::Swap {
                        identity_transitions: transitions.clone(),
                        impairment: impairment.clone(),
                    })
                {
                    return Err(ErrorKind::ReplayFailed.into_error());
                }
                for transition in transitions {
                    let Some(player) = players
                        .iter_mut()
                        .find(|player| player.id == transition.player_id)
                    else {
                        return Err(ErrorKind::ReplayFailed.into_error());
                    };
                    if identity_state(player) != transition.before {
                        return Err(ErrorKind::ReplayFailed.into_error());
                    }
                    player.actual_character = transition.after.actual_character.clone();
                    player.shown_character = transition.after.shown_character.clone();
                    player.alignment = transition.after.alignment;
                    player.ability_instance = AbilityInstance {
                        id: format!("{}:{}", event.id, player.id),
                        character_id: player.actual_character.clone(),
                        source_event_id: event.id.clone(),
                    };
                    player.identity_history.push(IdentityHistoryEntry {
                        source_event_id: event.id.clone(),
                        phase: event.phase,
                        before: transition.before,
                        after: transition.after,
                    });
                }
                active_impairments.push(impairment);
            }
            GameEventKind::PitHagTransformationResolved { payload } => {
                let actor = players
                    .iter()
                    .find(|player| player.id == payload.actor_player_id)
                    .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
                if !payload.step_id.ends_with(&format!(":pitHag:{}", actor.id)) {
                    return Err(ErrorKind::ReplayFailed.into_error());
                }
                let target = players
                    .iter()
                    .find(|player| player.id == payload.target_player_id)
                    .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
                let target_before = identity_state(target);
                if character_kind(&payload.character_id).is_none() {
                    return Err(ErrorKind::ReplayFailed.into_error());
                }
                let character_already_in_play = players
                    .iter()
                    .any(|player| player.actual_character == payload.character_id);
                let actor_impaired = active_impairments.iter().any(|impairment| {
                    impairment.player_id == payload.actor_player_id
                        && impairment.kind == ImpairmentKind::Poisoned
                });
                let expected = if character_already_in_play {
                    PitHagTransformationOutcome::NoChange {
                        reason: PitHagNoChangeReason::CharacterAlreadyInPlay,
                    }
                } else if actor.actual_character != "pitHag" {
                    PitHagTransformationOutcome::NoChange {
                        reason: PitHagNoChangeReason::NotActualCharacter,
                    }
                } else if actor_impaired {
                    PitHagTransformationOutcome::NoChange {
                        reason: PitHagNoChangeReason::ActorImpaired,
                    }
                } else {
                    PitHagTransformationOutcome::Changed {
                        identity_transition: PlayerIdentityTransition {
                            player_id: target.id.clone(),
                            before: target_before.clone(),
                            after: IdentityState {
                                actual_character: payload.character_id.clone(),
                                shown_character: payload.character_id.clone(),
                                alignment: target.alignment,
                            },
                        },
                        created_demon: character_kind(&target.actual_character)
                            != Some(CharacterKind::Demon)
                            && character_kind(&payload.character_id) == Some(CharacterKind::Demon),
                    }
                };
                if payload.outcome != expected {
                    return Err(ErrorKind::ReplayFailed.into_error());
                }
                if let PitHagTransformationOutcome::Changed {
                    identity_transition,
                    ..
                } = &payload.outcome
                {
                    let target = players
                        .iter_mut()
                        .find(|player| player.id == identity_transition.player_id)
                        .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
                    target.actual_character = identity_transition.after.actual_character.clone();
                    target.shown_character = identity_transition.after.shown_character.clone();
                    target.ability_instance = AbilityInstance {
                        id: format!("{}:{}", event.id, target.id),
                        character_id: target.actual_character.clone(),
                        source_event_id: event.id.clone(),
                    };
                    target.identity_history.push(IdentityHistoryEntry {
                        source_event_id: event.id.clone(),
                        phase: event.phase,
                        before: identity_transition.before.clone(),
                        after: identity_transition.after.clone(),
                    });
                }
            }
            GameEventKind::PlayerTransitioned { payload } => {
                if payload.transitions.is_empty() {
                    return Err(ErrorKind::ReplayFailed.into_error());
                }
                let mut transitioned = std::collections::HashSet::new();
                for transition in &payload.transitions {
                    if !transitioned.insert(transition.player_id()) {
                        return Err(ErrorKind::ReplayFailed.into_error());
                    }
                    let player = players
                        .iter_mut()
                        .find(|player| player.id == transition.player_id())
                        .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
                    if player_state(player) != *transition.before() {
                        return Err(ErrorKind::ReplayFailed.into_error());
                    }
                    match transition {
                        PlayerTransition::CharacterChange { before, after, .. } => {
                            if before.alive != after.alive
                                || before.actual_character == after.actual_character
                                || character_kind(&after.actual_character).is_none()
                            {
                                return Err(ErrorKind::ReplayFailed.into_error());
                            }
                        }
                        PlayerTransition::Resurrection { before, after, .. } => {
                            if before.alive
                                || !after.alive
                                || before.actual_character != after.actual_character
                                || before.shown_character != after.shown_character
                                || before.alignment != after.alignment
                            {
                                return Err(ErrorKind::ReplayFailed.into_error());
                            }
                            player.ghost_vote_used = false;
                        }
                    }
                    let before_identity = identity_state(player);
                    player.actual_character = transition.after().actual_character.clone();
                    player.shown_character = transition.after().shown_character.clone();
                    player.alignment = transition.after().alignment;
                    player.alive = transition.after().alive;
                    player.ability_instance = AbilityInstance {
                        id: format!("{}:{}", event.id, player.id),
                        character_id: player.actual_character.clone(),
                        source_event_id: event.id.clone(),
                    };
                    let after_identity = identity_state(player);
                    if before_identity != after_identity {
                        player.identity_history.push(IdentityHistoryEntry {
                            source_event_id: event.id.clone(),
                            phase: event.phase,
                            before: before_identity,
                            after: after_identity,
                        });
                    }
                }
            }
            _ => {}
        }
    }
    Ok(PlayerTimeline {
        current: players,
        before_event,
    })
}

fn replay_players(events: &[GameEvent]) -> Result<Vec<Player>, CoreError> {
    Ok(replay_player_timeline(events)?.current)
}

#[cfg(test)]
thread_local! {
    static PLAYER_REPLAY_PASS_COUNT: Cell<usize> = const { Cell::new(0) };
    static PHASE_STEP_BUILD_COUNT: Cell<usize> = const { Cell::new(0) };
}

#[cfg(test)]
pub(crate) fn reset_replay_player_pass_count() {
    PLAYER_REPLAY_PASS_COUNT.with(|count| count.set(0));
}

#[cfg(test)]
pub(crate) fn replay_player_pass_count() -> usize {
    PLAYER_REPLAY_PASS_COUNT.with(Cell::get)
}

#[cfg(test)]
pub(crate) fn reset_phase_step_build_count() {
    PHASE_STEP_BUILD_COUNT.with(|count| count.set(0));
}

#[cfg(test)]
pub(crate) fn phase_step_build_count() -> usize {
    PHASE_STEP_BUILD_COUNT.with(Cell::get)
}

fn unannounced_night_death_player_ids(events: &[GameEvent]) -> Vec<String> {
    let mut deaths = Vec::new();
    for event in events {
        match &event.kind {
            GameEventKind::NightActionResolved { payload } => {
                if let NightActionResolution::DemonAttack {
                    outcome:
                        DemonAttackOutcome::Deaths {
                            deaths: event_deaths,
                        },
                    ..
                } = &payload.resolution
                {
                    for death in event_deaths {
                        if !deaths.contains(&death.player_id) {
                            deaths.push(death.player_id.clone());
                        }
                    }
                }
            }
            GameEventKind::PitHagArbitraryDeathsConfirmed { payload } => {
                for death in &payload.deaths {
                    if !deaths.contains(&death.player_id) {
                        deaths.push(death.player_id.clone());
                    }
                }
            }
            GameEventKind::NightDeathsAnnounced { payload } => {
                deaths.retain(|player_id| !payload.player_ids.contains(player_id));
            }
            _ => {}
        }
    }
    deaths
}

fn unannounced_night_resurrection_player_ids(events: &[GameEvent]) -> Vec<String> {
    let mut resurrections = Vec::new();
    for event in events {
        match &event.kind {
            GameEventKind::PlayerTransitioned { payload } => {
                for transition in &payload.transitions {
                    if matches!(transition, PlayerTransition::Resurrection { .. })
                        && !resurrections.iter().any(|id| id == transition.player_id())
                    {
                        resurrections.push(transition.player_id().to_string());
                    }
                }
            }
            GameEventKind::NightDeathsAnnounced { payload } => {
                resurrections.retain(|id| !payload.resurrected_player_ids.contains(id));
            }
            _ => {}
        }
    }
    resurrections
}

fn active_snake_charmer_impairments(events: &[GameEvent]) -> Vec<ActiveImpairment> {
    events
        .iter()
        .filter_map(|event| match &event.kind {
            GameEventKind::SnakeCharmerActionResolved { payload } => match &payload.outcome {
                SnakeCharmerActionOutcome::Swap { impairment, .. } => Some(impairment.clone()),
                SnakeCharmerActionOutcome::NoSwap { .. } => None,
            },
            _ => None,
        })
        .collect()
}

fn pending_identity_reveals(events: &[GameEvent]) -> Vec<PendingIdentityReveal> {
    let Some(event) = events.last() else {
        return vec![];
    };
    match &event.kind {
        GameEventKind::MadnessAssigned { payload } => vec![PendingIdentityReveal {
            source_event_id: event.id.clone(),
            sequence: 1,
            payload: RevealPayload::MadnessAssignment {
                kind: "madnessAssignment",
                player_id: payload.target_player_id.clone(),
                character_id: payload.required_character_id.clone(),
            },
        }],
        GameEventKind::PitHagTransformationResolved { payload } => {
            let PitHagTransformationOutcome::Changed {
                identity_transition,
                ..
            } = &payload.outcome
            else {
                return vec![];
            };
            vec![PendingIdentityReveal {
                source_event_id: event.id.clone(),
                sequence: 1,
                payload: RevealPayload::CharacterChange {
                    kind: "characterChange",
                    player_id: identity_transition.player_id.clone(),
                    alignment: match identity_transition.after.alignment {
                        Alignment::Good => "good".into(),
                        Alignment::Evil => "evil".into(),
                    },
                    character_id: identity_transition.after.shown_character.clone(),
                },
            }]
        }
        GameEventKind::SnakeCharmerActionResolved { payload } => {
            let SnakeCharmerActionOutcome::Swap {
                identity_transitions,
                ..
            } = &payload.outcome
            else {
                return vec![];
            };
            identity_transitions
                .iter()
                .enumerate()
                .map(|(index, transition)| PendingIdentityReveal {
                    source_event_id: event.id.clone(),
                    sequence: (index + 1) as u8,
                    payload: RevealPayload::CharacterChange {
                        kind: "characterChange",
                        player_id: transition.player_id.clone(),
                        alignment: match transition.after.alignment {
                            Alignment::Good => "good".into(),
                            Alignment::Evil => "evil".into(),
                        },
                        character_id: transition.after.shown_character.clone(),
                    },
                })
                .collect()
        }
        GameEventKind::PlayerTransitioned { payload } => payload
            .transitions
            .iter()
            .filter_map(|transition| match transition {
                PlayerTransition::CharacterChange {
                    player_id, after, ..
                } => Some(PendingIdentityReveal {
                    source_event_id: event.id.clone(),
                    sequence: 1,
                    payload: RevealPayload::CharacterChange {
                        kind: "characterChange",
                        player_id: player_id.clone(),
                        alignment: match after.alignment {
                            Alignment::Good => "good".into(),
                            Alignment::Evil => "evil".into(),
                        },
                        character_id: after.shown_character.clone(),
                    },
                }),
                PlayerTransition::Resurrection { .. } => None,
            })
            .enumerate()
            .map(|(index, mut reveal)| {
                reveal.sequence = (index + 1) as u8;
                reveal
            })
            .collect(),
        _ => vec![],
    }
}

fn phase_state(
    players: &[Player],
    events: &[GameEvent],
    players_before_event: &[Vec<Player>],
) -> Result<(Phase, Option<PhaseStep>, Vec<PhaseOverviewItem>), CoreError> {
    let mut statuses = HashMap::new();
    let mut pending_madness_overview: Option<(PendingMadnessExecution, Phase, Vec<PhaseStep>)> =
        None;

    for (event_index, event) in events.iter().enumerate().skip(1) {
        if let GameEventKind::PlayerAnnotationsUpdated { payload } = &event.kind {
            if !events[..event_index].iter().any(|candidate| matches!(
                &candidate.kind,
                GameEventKind::SetupConfirmed { payload: setup }
                    if setup.players.iter().any(|player| player.id.as_deref() == Some(payload.player_id.as_str()))
            )) {
                return Err(ErrorKind::ReplayFailed.into_error());
            }
            continue;
        }
        if let GameEventKind::MadnessCheckRecorded { payload } = &event.kind {
            if pending_madness_overview.is_some() {
                return Err(ErrorKind::ReplayFailed.into_error());
            }
            let players_at_event = players_before_event
                .get(event_index)
                .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
            let Some((phase, _, Some(current))) = current_phase_steps(
                players_at_event,
                &events[..event_index],
                events.len() + 2,
                &statuses,
            ) else {
                return Err(ErrorKind::ReplayFailed.into_error());
            };
            let assignments = madness_assignments(
                phase,
                Some(&current),
                players_at_event,
                &events[..event_index],
            );
            let assignment = assignments
                .iter()
                .find(|assignment| assignment.assignment_id == payload.assignment_id)
                .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
            if event.phase != Phase::Day
                || !assignment.can_check
                || assignment.source_player_id != payload.source_player_id
                || assignment.source_character_id != payload.source_character_id
                || assignment.target_player_id != payload.target_player_id
                || assignment.status == MadnessStatus::Violated
                || (assignment.status == MadnessStatus::Clear
                    && payload.result == MadnessCheckResult::Clear)
            {
                return Err(ErrorKind::ReplayFailed.into_error());
            }
            continue;
        }
        if let GameEventKind::MadnessExecutionConfirmed { payload } = &event.kind {
            if pending_madness_overview.is_some() {
                return Err(ErrorKind::ReplayFailed.into_error());
            }
            let players_at_event = players_before_event
                .get(event_index)
                .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
            let Some((phase, steps, Some(current))) = current_phase_steps(
                players_at_event,
                &events[..event_index],
                events.len() + 2,
                &statuses,
            ) else {
                return Err(ErrorKind::ReplayFailed.into_error());
            };
            let assignments = madness_assignments(
                phase,
                Some(&current),
                players_at_event,
                &events[..event_index],
            );
            let assignment = assignments
                .iter()
                .find(|assignment| assignment.assignment_id == payload.assignment_id)
                .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
            if event.phase != phase
                || !assignment.can_execute
                || assignment.source_player_id != payload.source_player_id
                || assignment.source_character_id != payload.source_character_id
                || assignment.target_player_id != payload.target_player_id
                || payload
                    .check_event_id
                    .as_deref()
                    .is_some_and(|check_event_id| {
                        assignment.violation_check_event_id.as_deref() != Some(check_event_id)
                    })
                || payload.interrupted_step_id != current.id
            {
                return Err(ErrorKind::ReplayFailed.into_error());
            }
            if phase == Phase::Day {
                for step in &steps {
                    if crate::phase::step_status(&step.id, &statuses).is_done() {
                        continue;
                    }
                    statuses.insert(
                        step.id.clone(),
                        if step.id.ends_with(":toNight") {
                            PhaseStepStatus::ManualComplete
                        } else {
                            PhaseStepStatus::Skipped
                        },
                    );
                }
            }
            pending_madness_overview = Some((
                PendingMadnessExecution {
                    event_id: event.id.clone(),
                    assignment_id: payload.assignment_id.clone(),
                    source_character_id: payload.source_character_id.clone(),
                    target_player_id: payload.target_player_id.clone(),
                    interrupted_step_id: payload.interrupted_step_id.clone(),
                },
                phase,
                steps,
            ));
            continue;
        }
        if let Some((pending, phase, _)) = pending_madness_overview.as_ref() {
            if let GameEventKind::DeathConfirmed { payload } = &event.kind {
                let expected_step_id = madness_execution_death_step_id(
                    &pending.event_id,
                    &pending.interrupted_step_id,
                );
                let players_at_event = players_before_event
                    .get(event_index)
                    .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
                if event.phase != *phase
                    || payload.step_id.as_deref() != Some(expected_step_id.as_str())
                    || payload.player_id != pending.target_player_id
                    || !players_at_event
                        .iter()
                        .any(|player| player.id == pending.target_player_id && player.alive)
                {
                    return Err(ErrorKind::ReplayFailed.into_error());
                }
                pending_madness_overview = None;
                continue;
            }
            return Err(ErrorKind::ReplayFailed.into_error());
        }
        if let GameEventKind::DayActionRecorded { payload } = &event.kind {
            let players_at_event = players_before_event
                .get(event_index)
                .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
            let Some((_, _, Some(current))) = current_phase_steps(
                players_at_event,
                &events[..event_index],
                events.len() + 2,
                &statuses,
            ) else {
                return Err(ErrorKind::ReplayFailed.into_error());
            };
            validate_day_action_payload(
                payload,
                event.phase,
                &current,
                players_at_event,
                &events[..event_index],
            )
            .map_err(|_| ErrorKind::ReplayFailed.into_error())?;
            continue;
        }
        if let GameEventKind::ManualPhaseStepResolved { payload } = &event.kind {
            if let Some(prefix) = payload.step_id.strip_suffix(":manual") {
                let players_at_event = players_before_event
                    .get(event_index)
                    .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
                let Some((phase, _, current)) = current_phase_steps(
                    players_at_event,
                    &events[..event_index],
                    events.len() + 2,
                    &statuses,
                ) else {
                    return Err(ErrorKind::ReplayFailed.into_error());
                };
                if phase != Phase::Day
                    || event.phase != Phase::Day
                    || !current.is_some_and(|step| step.id.starts_with(&format!("{prefix}:")))
                {
                    return Err(ErrorKind::ReplayFailed.into_error());
                }
                for suffix in [
                    "announceDeaths",
                    "whisper",
                    "discussion",
                    "execution",
                    "toNight",
                ] {
                    statuses.insert(
                        format!("{prefix}:{suffix}"),
                        PhaseStepStatus::ManualComplete,
                    );
                }
                statuses.insert(format!("{prefix}:nomination:1"), PhaseStepStatus::Skipped);
                statuses.insert(format!("{prefix}:executionDeath"), PhaseStepStatus::Skipped);
                continue;
            }
        }

        let (event_step_id, status) = match &event.kind {
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
            GameEventKind::NightActionResolved { payload } => {
                (&payload.step_id, PhaseStepStatus::Complete)
            }
            GameEventKind::NightDeathsAnnounced { payload } => {
                (&payload.step_id, PhaseStepStatus::Complete)
            }
            GameEventKind::SnakeCharmerActionResolved { payload } => {
                (&payload.step_id, PhaseStepStatus::Complete)
            }
            GameEventKind::PitHagTransformationResolved { payload } => {
                (&payload.step_id, PhaseStepStatus::Complete)
            }
            GameEventKind::PitHagArbitraryDeathsConfirmed { payload } => {
                (&payload.step_id, PhaseStepStatus::Complete)
            }
            GameEventKind::PlayerTransitioned { payload } => {
                (&payload.step_id, PhaseStepStatus::Complete)
            }
            GameEventKind::MadnessAssigned { payload } => {
                (&payload.step_id, PhaseStepStatus::Complete)
            }
            GameEventKind::NominationStarted { payload } => {
                (&payload.step_id, PhaseStepStatus::Complete)
            }
            GameEventKind::NominationVoteConfirmed { payload } => {
                (&payload.step_id, PhaseStepStatus::Complete)
            }
            GameEventKind::PhaseStepSkipped { payload } => {
                (&payload.step_id, PhaseStepStatus::Skipped)
            }
            GameEventKind::ExecutionConfirmed { payload }
            | GameEventKind::NoExecutionConfirmed { payload } => {
                (&payload.step_id, PhaseStepStatus::Complete)
            }
            GameEventKind::DeathConfirmed { payload } => (
                payload
                    .step_id
                    .as_ref()
                    .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?,
                PhaseStepStatus::Complete,
            ),
            _ => return Err(ErrorKind::ReplayFailed.into_error()),
        };
        let players_at_event = players_before_event
            .get(event_index)
            .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
        let Some((_, _, Some(current))) = current_phase_steps(
            players_at_event,
            &events[..event_index],
            events.len() + 2,
            &statuses,
        ) else {
            return Err(ErrorKind::ReplayFailed.into_error());
        };
        let legacy_dead_player = match &event.kind {
            GameEventKind::PhaseStepConfirmed { payload } => payload
                .information
                .as_ref()
                .and_then(|information| information.actor.as_ref())
                .and_then(|actor| {
                    players_at_event.iter().find(|player| {
                        player.id == actor.player_id
                            && !player.alive
                            && player.actual_character == actor.character_id
                    })
                }),
            GameEventKind::ManualPhaseStepResolved { .. } => {
                players_at_event.iter().find(|player| {
                    !player.alive
                        && event_step_id.ends_with(&format!(":{}", player.actual_character))
                })
            }
            _ => None,
        };
        let legacy_dead_character_step = current.id != *event_step_id
            && current.phase == event.phase
            && current.id.split(':').next() == event_step_id.split(':').next()
            && legacy_dead_player.is_some_and(|player| {
                event_step_id.ends_with(&format!(":{}", player.actual_character))
            });
        if legacy_dead_character_step {
            if let GameEventKind::PhaseStepConfirmed { payload } = &event.kind {
                let player =
                    legacy_dead_player.ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
                let prefix = event_step_id.split(':').next().unwrap_or_default();
                let legacy_step = character_step(
                    event.phase,
                    prefix,
                    &player.actual_character,
                    player,
                    &players_at_event,
                );
                validate_required_input(
                    &legacy_step.required_input,
                    &payload.input,
                    &players_at_event,
                )
                .map_err(|_| ErrorKind::ReplayFailed.into_error())?;
                if is_information_character(legacy_step.character.as_deref()) {
                    let expected = snv_confirmed_information(
                        &legacy_step,
                        &players_at_event,
                        &events[..event_index],
                        &payload.input,
                        payload
                            .information
                            .as_ref()
                            .map(|information| information.delivered_result.clone()),
                        &[],
                    )
                    .map_err(|_| ErrorKind::ReplayFailed.into_error())?;
                    if payload.information != expected {
                        return Err(ErrorKind::ReplayFailed.into_error());
                    }
                }
            }
            statuses.insert(event_step_id.clone(), status);
            continue;
        }
        let legacy_manual_demon =
            matches!(&event.kind, GameEventKind::ManualPhaseStepResolved { .. })
                && current
                    .character
                    .as_deref()
                    .is_some_and(|character| DEMONS.contains(&character))
                && current.character.as_ref().is_some_and(|character| {
                    let prefix = current.id.split(":demon:").next().unwrap_or_default();
                    event_step_id == &format!("{prefix}:{character}")
                });
        let legacy_player_scoped_step = current.player_id.as_ref().is_some_and(|player_id| {
            current
                .id
                .strip_suffix(&format!(":{player_id}"))
                .is_some_and(|legacy_id| legacy_id == *event_step_id)
        });
        let legacy_manual_snake_charmer =
            matches!(&event.kind, GameEventKind::ManualPhaseStepResolved { .. })
                && current.character.as_deref() == Some("snakeCharmer")
                && legacy_player_scoped_step;
        let legacy_manual_pit_hag =
            matches!(&event.kind, GameEventKind::ManualPhaseStepResolved { .. })
                && current.character.as_deref() == Some("pitHag")
                && legacy_player_scoped_step;
        let legacy_manual_information =
            matches!(&event.kind, GameEventKind::ManualPhaseStepResolved { .. })
                && is_information_character(current.character.as_deref());
        if (current.id != *event_step_id && !legacy_manual_demon && !legacy_player_scoped_step)
            || current.phase != event.phase
        {
            return Err(ErrorKind::ReplayFailed.into_error());
        }
        if matches!(status, PhaseStepStatus::Skipped) && !current.can_skip {
            return Err(ErrorKind::ReplayFailed.into_error());
        }
        match (&event.kind, current.support) {
            (GameEventKind::PhaseStepConfirmed { payload }, PhaseStepSupport::Automated) => {
                validate_required_input(&current.required_input, &payload.input, &players_at_event)
                    .map_err(|_| ErrorKind::ReplayFailed.into_error())?;
                if is_information_character(current.character.as_deref()) {
                    let expected = snv_confirmed_information(
                        &current,
                        &players_at_event,
                        &events[..event_index],
                        &payload.input,
                        payload
                            .information
                            .as_ref()
                            .map(|information| information.delivered_result.clone()),
                        &[],
                    )
                    .map_err(|_| ErrorKind::ReplayFailed.into_error())?;
                    if payload.information != expected {
                        return Err(ErrorKind::ReplayFailed.into_error());
                    }
                }
            }
            (GameEventKind::ManualPhaseStepResolved { .. }, PhaseStepSupport::Manual) => {}
            (GameEventKind::ManualPhaseStepResolved { .. }, PhaseStepSupport::Automated)
                if legacy_manual_demon
                    || legacy_manual_snake_charmer
                    || legacy_manual_pit_hag
                    || legacy_manual_information => {}
            (GameEventKind::NightActionResolved { payload }, PhaseStepSupport::Automated)
                if current
                    .character
                    .as_deref()
                    .is_some_and(|character| DEMONS.contains(&character))
                    && payload.actor_player_id
                        == current.player_id.as_deref().unwrap_or_default()
                    && payload.actor_character_id.as_deref() == current.character.as_deref()
                    && matches!(
                        payload.resolution,
                        NightActionResolution::DemonAttack { .. }
                    ) => {}
            (
                GameEventKind::SnakeCharmerActionResolved { payload },
                PhaseStepSupport::Automated,
            ) if current.character.as_deref() == Some("snakeCharmer")
                && current.player_id.as_deref() == Some(payload.actor_player_id.as_str()) =>
            {
                validate_required_input(
                    &current.required_input,
                    &Some(crate::model::StepInputFields {
                        player_ids: Some(vec![payload.target_player_id.clone()]),
                        ..Default::default()
                    }),
                    &players_at_event,
                )
                .map_err(|_| ErrorKind::ReplayFailed.into_error())?;
            }
            (
                GameEventKind::PitHagTransformationResolved { payload },
                PhaseStepSupport::Automated,
            ) if current.character.as_deref() == Some("pitHag")
                && current.player_id.as_deref() == Some(payload.actor_player_id.as_str()) =>
            {
                validate_required_input(
                    &current.required_input,
                    &Some(crate::model::StepInputFields {
                        player_ids: Some(vec![payload.target_player_id.clone()]),
                        character_ids: Some(vec![payload.character_id.clone()]),
                        ..Default::default()
                    }),
                    &players_at_event,
                )
                .map_err(|_| ErrorKind::ReplayFailed.into_error())?;
            }
            (
                GameEventKind::PitHagArbitraryDeathsConfirmed { payload },
                PhaseStepSupport::Automated,
            ) if current.step_type == StepType::PitHagArbitraryDeaths => {
                validate_required_input(
                    &current.required_input,
                    &Some(crate::model::StepInputFields {
                        player_ids: Some(
                            payload
                                .deaths
                                .iter()
                                .map(|death| death.player_id.clone())
                                .collect(),
                        ),
                        ..Default::default()
                    }),
                    &players_at_event,
                )
                .map_err(|_| ErrorKind::ReplayFailed.into_error())?;
                let source = pit_hag_demon_creation(
                    &events[..event_index],
                    current.id.split(':').next().unwrap_or_default(),
                )
                .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
                if payload.source_transformation_event_id != source.id {
                    return Err(ErrorKind::ReplayFailed.into_error());
                }
            }
            (GameEventKind::PlayerTransitioned { payload }, _)
                if current.player_id.as_deref() == Some(payload.source_player_id.as_str())
                    && current.character.as_deref()
                        == Some(payload.source_character_id.as_str()) => {}
            (GameEventKind::MadnessAssigned { payload }, PhaseStepSupport::Automated)
                if current.character.as_deref() == Some("cerenovus")
                    && current.player_id.as_deref() == Some(payload.source_player_id.as_str()) =>
            {
                validate_required_input(
                    &current.required_input,
                    &Some(crate::model::StepInputFields {
                        player_ids: Some(vec![payload.target_player_id.clone()]),
                        character_id: Some(payload.required_character_id.clone()),
                        ..Default::default()
                    }),
                    &players_at_event,
                )
                .map_err(|_| ErrorKind::ReplayFailed.into_error())?;
            }
            (GameEventKind::NightDeathsAnnounced { .. }, PhaseStepSupport::Automated)
                if current.step_type == StepType::Announcement => {}
            (GameEventKind::NominationStarted { payload }, PhaseStepSupport::Automated)
                if current.required_input.kind == RequiredInputKind::Nomination =>
            {
                let prefix = step_prefix(&payload.step_id)?;
                validate_nomination_start_roles(
                    &players_at_event,
                    &events[..event_index],
                    &prefix,
                    &payload.nominator_id,
                    &payload.nominee_id,
                )
                .map_err(|_| ErrorKind::ReplayFailed.into_error())?;
            }
            (GameEventKind::NominationVoteConfirmed { payload }, PhaseStepSupport::Automated)
                if current.required_input.kind == RequiredInputKind::NominationVote =>
            {
                validate_nomination_event_input(payload, &players_at_event, &events[..event_index])
                    .map_err(|_| ErrorKind::ReplayFailed.into_error())?;
            }
            (GameEventKind::PhaseStepSkipped { .. }, PhaseStepSupport::Automated)
                if current.step_type == StepType::Nomination => {}
            (GameEventKind::PhaseStepSkipped { .. }, PhaseStepSupport::Automated)
                if current.character.as_deref() == Some("seamstress") => {}
            (GameEventKind::ExecutionConfirmed { payload }, PhaseStepSupport::Automated)
                if current.step_type == StepType::Execution =>
            {
                let prefix = step_prefix(&payload.step_id)?;
                let expected =
                    replay_day_state(&events[..event_index], &players_at_event, &prefix)?
                        .execution_candidate
                        .map(|candidate| candidate.nominee_id)
                        .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
                if !payload.input.execute
                    || payload.input.player_id.as_deref() != Some(expected.as_str())
                {
                    return Err(ErrorKind::ReplayFailed.into_error());
                }
            }
            (GameEventKind::NoExecutionConfirmed { payload }, PhaseStepSupport::Automated)
                if current.step_type == StepType::Execution
                    && !payload.input.execute
                    && payload.input.player_id.is_none() => {}
            (GameEventKind::DeathConfirmed { payload }, PhaseStepSupport::Automated)
                if current.step_type == StepType::ExecutionDeath
                    && current.player_id.as_deref() == Some(payload.player_id.as_str()) => {}
            _ => return Err(ErrorKind::ReplayFailed.into_error()),
        }
        statuses.insert(current.id.clone(), status);
        if let GameEventKind::SnakeCharmerActionResolved { payload } = &event.kind {
            if matches!(payload.outcome, SnakeCharmerActionOutcome::Swap { .. }) {
                let prefix = current
                    .id
                    .split(":snakeCharmer:")
                    .next()
                    .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
                statuses.insert(
                    format!("{prefix}:snakeCharmer:{}", payload.target_player_id),
                    PhaseStepStatus::NotApplicable,
                );
                statuses.insert(
                    format!("firstNight:snakeCharmer:{}", payload.target_player_id),
                    PhaseStepStatus::NotApplicable,
                );
            }
        }
        if let GameEventKind::PitHagTransformationResolved { payload } = &event.kind {
            if matches!(payload.outcome, PitHagTransformationOutcome::Changed { .. })
                && matches!(
                    payload.character_id.as_str(),
                    "snakeCharmer"
                        | "evilTwin"
                        | "witch"
                        | "cerenovus"
                        | "clockmaker"
                        | "dreamer"
                        | "seamstress"
                        | "mathematician"
                )
            {
                let first_night_id = if payload.character_id == "snakeCharmer" {
                    format!("firstNight:snakeCharmer:{}", payload.target_player_id)
                } else {
                    format!("firstNight:{}", payload.character_id)
                };
                statuses.insert(first_night_id, PhaseStepStatus::NotApplicable);
            }
        }
        if let GameEventKind::NoExecutionConfirmed { payload } = &event.kind {
            let prefix = step_prefix(&payload.step_id)?;
            statuses.insert(format!("{prefix}:executionDeath"), PhaseStepStatus::Skipped);
        }
    }

    if let Some((pending, phase, steps)) = pending_madness_overview {
        let death_step = PhaseStep {
            id: madness_execution_death_step_id(&pending.event_id, &pending.interrupted_step_id),
            phase,
            step_type: StepType::ExecutionDeath,
            character: None,
            player_id: Some(pending.target_player_id.clone()),
            required_input: RequiredInput {
                kind: RequiredInputKind::ExecutionDeathDecision,
                target: Some(InputTarget::Execution),
                player_id: Some(pending.target_player_id.clone()),
                execution_survival_allowed: false,
                ..required_none()
            },
            can_skip: false,
            support: PhaseStepSupport::Automated,
            information_prompt: None,
            pre_action_reveal: None,
        };
        let mut overview = steps
            .into_iter()
            .map(|step| PhaseOverviewItem {
                status: if phase == Phase::Night && step.id == pending.interrupted_step_id {
                    PhaseStepStatus::Interrupted
                } else {
                    statuses
                        .get(&step.id)
                        .copied()
                        .unwrap_or(PhaseStepStatus::Waiting)
                },
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
            .collect::<Vec<_>>();
        let insert_at = overview
            .iter()
            .position(|step| step.id == pending.interrupted_step_id)
            .map_or(overview.len(), |index| index + 1);
        overview.insert(
            insert_at,
            PhaseOverviewItem {
                id: death_step.id.clone(),
                phase,
                step_type: StepType::ExecutionDeath,
                character: None,
                player_id: death_step.player_id.clone(),
                required_input: death_step.required_input.clone(),
                can_skip: false,
                support: PhaseStepSupport::Automated,
                information_prompt: None,
                status: PhaseStepStatus::Current,
            },
        );
        return Ok((phase, Some(death_step), overview));
    }

    let Some((phase, steps, mut current)) =
        current_phase_steps(players, events, events.len() + 2, &statuses)
    else {
        return Ok((Phase::Night, None, vec![]));
    };
    if let Some(step) = current.as_mut() {
        step.information_prompt = snv_information_prompt(step, players, events)?;
    }
    let current_id = current.as_ref().map(|step| step.id.as_str());
    let overview = if current.is_none() {
        vec![]
    } else {
        steps
            .into_iter()
            .map(|step| -> Result<PhaseOverviewItem, CoreError> {
                let information_prompt = if Some(step.id.as_str()) == current_id {
                    snv_information_prompt(&step, players, events)?
                } else {
                    None
                };
                Ok(PhaseOverviewItem {
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
                    information_prompt,
                })
            })
            .collect::<Result<Vec<_>, _>>()?
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
            pending_identity_reveals: vec![],
            available_day_actions: vec![],
            day_action_records: vec![],
            madness_assignments: vec![],
            pending_madness_execution: None,
        });
    }
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
    let initial_players = setup_players(active_events)?;
    let PlayerTimeline {
        current: players,
        before_event: players_before_event,
    } = replay_player_timeline(active_events)?;
    let mut warnings = validate_setup_warnings_for_script(game_file.script_id, &initial_players);
    let (phase, current_step, phase_overview) =
        phase_state(&players, active_events, &players_before_event)?;
    let day_state = if phase == Phase::Day {
        current_step
            .as_ref()
            .and_then(|step| step_prefix(&step.id).ok())
            .map(|prefix| replay_day_state(active_events, &players, &prefix))
            .transpose()?
    } else {
        None
    };
    let unannounced_night_death_player_ids = unannounced_night_death_player_ids(active_events);
    let unannounced_night_resurrection_player_ids =
        unannounced_night_resurrection_player_ids(active_events);
    if !unannounced_night_death_player_ids.is_empty() {
        warnings.push(CoreWarning {
            code: "NIGHT_DEATH_UNANNOUNCED".into(),
            severity: "warning",
            message_ko: "공개하지 않은 밤 사망이 있습니다.".into(),
            winning_team: None,
        });
    }
    if !players.is_empty()
        && !players.iter().any(|player| {
            player.alive && character_kind(&player.actual_character) == Some(CharacterKind::Demon)
        })
    {
        warnings.push(CoreWarning {
            code: "DEMON_DEAD_GOOD_WIN".into(),
            severity: "warning",
            message_ko: "악마 사망: 선 승리 확인 필요".into(),
            winning_team: Some(Alignment::Good),
        });
    }
    if !players.is_empty() && players.iter().filter(|player| player.alive).count() <= 2 {
        warnings.push(CoreWarning {
            code: "TWO_LIVING_PLAYERS_EVIL_WIN".into(),
            severity: "warning",
            message_ko: "생존자 2명: 악 승리 확인 필요".into(),
            winning_team: Some(Alignment::Evil),
        });
    }
    let rule_state = RuleState {
        unannounced_night_death_player_ids,
        unannounced_night_resurrection_player_ids,
        active_impairments: Some(active_snake_charmer_impairments(active_events)),
        automatic_reminders: automatic_information_reminders(
            phase,
            current_step.as_ref(),
            &players,
            active_events,
        )?,
        ..RuleState::default()
    };
    let pending_identity_reveals = pending_identity_reveals(active_events);
    let available_day_actions =
        available_day_actions(phase, current_step.as_ref(), &players, active_events);
    let day_action_records = confirmed_day_action_records(active_events);
    let madness_assignments =
        madness_assignments(phase, current_step.as_ref(), &players, active_events);
    let pending_madness_execution =
        pending_madness_execution_event(active_events).map(|(event, payload)| {
            PendingMadnessExecution {
                event_id: event.id.clone(),
                assignment_id: payload.assignment_id.clone(),
                source_character_id: payload.source_character_id.clone(),
                target_player_id: payload.target_player_id.clone(),
                interrupted_step_id: payload.interrupted_step_id.clone(),
            }
        });
    let game_end = ended_positions
        .first()
        .map(|index| {
            let event = &events[*index];
            let GameEventKind::GameEnded { payload } = &event.kind else {
                unreachable!()
            };
            if event.phase != phase {
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
        (current_step, phase_overview)
    };
    Ok(ReplayState {
        schema_version: game_file.schema_version,
        script_id: game_file.script_id,
        event_count: game_file.game.events.len(),
        phase,
        players,
        current_step,
        phase_overview,
        day_state,
        warnings,
        rule_state,
        game_end,
        pending_identity_reveals,
        available_day_actions,
        day_action_records,
        madness_assignments,
        pending_madness_execution,
    })
}

pub(crate) fn propose_phase_command(
    game_file: &GameFile,
    command: Command,
) -> Result<Proposal, CoreError> {
    if game_file
        .game
        .events
        .iter()
        .any(|event| matches!(event.kind, GameEventKind::GameEnded { .. }))
    {
        return Err(ErrorKind::GameAlreadyEnded.into_error());
    }
    let PlayerTimeline {
        current: players,
        before_event: players_before_event,
    } = replay_player_timeline(&game_file.game.events)?;
    let (_, current_step, _) =
        phase_state(&players, &game_file.game.events, &players_before_event)?;
    let current_step = current_step.ok_or_else(|| ErrorKind::NoCurrentStep.into_error())?;

    match command {
        Command::SkipStep { payload } => {
            if payload.step_id != current_step.id {
                return Err(ErrorKind::StaleStep.into_error());
            }
            if !current_step.can_skip {
                return Err(ErrorKind::StepCannotBeSkipped.into_error());
            }
            if current_step.step_type == StepType::Nomination {
                return crate::proposal::propose_nomination_closed(game_file, &current_step);
            }
            if current_step.character.as_deref() == Some("seamstress") {
                return Ok(phase_proposal(
                    game_file,
                    &current_step,
                    GameEventKind::PhaseStepSkipped {
                        payload: crate::contracts::StepIdPayload {
                            step_id: payload.step_id,
                        },
                    },
                    "재봉사 능력 보류".into(),
                    vec![],
                ));
            }
            Err(ErrorKind::CommandNotSupportedByScript.into_error())
        }
        Command::ResolveManualStep { payload } => {
            if payload.step_id != current_step.id {
                return Err(ErrorKind::StaleStep.into_error());
            }
            if current_step.support != PhaseStepSupport::Manual {
                return Err(ErrorKind::StepIsAutomated.into_error());
            }
            Ok(phase_proposal(
                game_file,
                &current_step,
                GameEventKind::ManualPhaseStepResolved {
                    payload: ManualPhaseStepResolvedPayload {
                        step_id: payload.step_id,
                        outcome: payload.outcome,
                    },
                },
                format!("수동 단계 처리: {}", current_step.id),
                vec![],
            ))
        }
        Command::ConfirmStep { payload } => {
            if payload.step_id != current_step.id {
                return Err(ErrorKind::StaleStep.into_error());
            }
            if current_step.support == PhaseStepSupport::Manual {
                return Err(ErrorKind::StepRequiresManualResolution.into_error());
            }
            validate_required_input(&current_step.required_input, &payload.input, &players)?;
            if current_step.required_input.kind == RequiredInputKind::Nomination {
                return crate::proposal::propose_nomination_started(
                    game_file,
                    &current_step,
                    &players,
                    payload.input,
                    payload.registration_judgments,
                );
            }
            if current_step.required_input.kind == RequiredInputKind::NominationVote {
                return crate::proposal::propose_nomination_vote(
                    game_file,
                    &current_step,
                    &players,
                    payload.input,
                );
            }
            if current_step.step_type == StepType::Execution {
                return crate::proposal::propose_execution_decision(
                    game_file,
                    &current_step,
                    &players,
                    payload.input,
                );
            }
            if current_step.step_type == StepType::ExecutionDeath {
                return crate::proposal::propose_execution_death(
                    game_file,
                    &current_step,
                    &players,
                    payload.input,
                );
            }
            if current_step.step_type == StepType::PitHagArbitraryDeaths {
                return propose_pit_hag_arbitrary_deaths(
                    game_file,
                    &current_step,
                    &players,
                    payload.input,
                );
            }
            if current_step.character.as_deref() == Some("snakeCharmer") {
                return propose_snake_charmer_action(
                    game_file,
                    &current_step,
                    &players,
                    payload.input,
                );
            }
            if current_step.character.as_deref() == Some("pitHag") {
                return propose_pit_hag_transformation(
                    game_file,
                    &current_step,
                    &players,
                    payload.input,
                );
            }
            if current_step.character.as_deref() == Some("cerenovus") {
                return propose_cerenovus_assignment(
                    game_file,
                    &current_step,
                    &players,
                    payload.input,
                );
            }
            if current_step
                .character
                .as_deref()
                .is_some_and(|character| DEMONS.contains(&character))
            {
                return propose_demon_attack(game_file, &current_step, &players, payload.input);
            }
            if current_step.step_type == StepType::Announcement {
                return propose_night_deaths_announcement(game_file, &current_step, &players);
            }
            if is_information_character(current_step.character.as_deref()) {
                let information = snv_confirmed_information(
                    &current_step,
                    &players,
                    &game_file.game.events,
                    &payload.input,
                    payload.delivered_result,
                    &payload.registration_judgments,
                )?
                .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
                let summary = crate::messages::phase_step_summary(
                    &current_step,
                    &players,
                    &payload.input,
                    Some(&information),
                )
                .unwrap_or_else(|| format!("정보 확정: {}", current_step.id));
                let reveal_payload = crate::messages::phase_step_reveal_payload(
                    &current_step,
                    &information,
                    &players,
                );
                let mut proposal = phase_proposal(
                    game_file,
                    &current_step,
                    GameEventKind::PhaseStepConfirmed {
                        payload: Box::new(PhaseStepEventPayload {
                            step_id: payload.step_id,
                            input: payload.input,
                            information: Some(information),
                        }),
                    },
                    summary,
                    vec![],
                );
                proposal.reveal_payload = reveal_payload;
                return Ok(proposal);
            }
            Ok(phase_proposal(
                game_file,
                &current_step,
                GameEventKind::PhaseStepConfirmed {
                    payload: Box::new(PhaseStepEventPayload {
                        step_id: payload.step_id,
                        input: payload.input,
                        information: None,
                    }),
                },
                format!("단계 확정: {}", current_step.id),
                vec![],
            ))
        }
        Command::RecordDayAction { payload } => {
            propose_day_action(game_file, &current_step, &players, payload)
        }
        Command::RecordMadnessCheck { payload } => {
            propose_madness_check(game_file, &current_step, &players, payload)
        }
        Command::ExecuteMadness { payload } => {
            propose_madness_execution(game_file, &current_step, &players, payload)
        }
        Command::EndGame { payload } => propose_end_game(game_file, &current_step, payload),
        _ => Err(ErrorKind::CommandNotSupportedByScript.into_error()),
    }
}

fn propose_end_game(
    game_file: &GameFile,
    current_step: &PhaseStep,
    payload: EndGameCommandPayload,
) -> Result<Proposal, CoreError> {
    if payload.expected_event_count != game_file.game.events.len() {
        return Err(ErrorKind::StaleCommand.into_error());
    }
    let team_label = match payload.winning_team {
        Alignment::Good => "선한 팀",
        Alignment::Evil => "악한 팀",
    };
    let summary = format!("게임 종료 · {team_label} 승리");
    Ok(Proposal {
        event: GameEvent {
            id: format!("game-ended-{}", game_file.game.events.len() + 1),
            kind: GameEventKind::GameEnded {
                payload: GameEndedPayload {
                    winning_team: payload.winning_team,
                },
            },
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

fn propose_cerenovus_assignment(
    game_file: &GameFile,
    step: &PhaseStep,
    players: &[Player],
    input: crate::model::StepInput,
) -> Result<Proposal, CoreError> {
    let source_player_id = step
        .player_id
        .clone()
        .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
    let fields = input.ok_or_else(|| ErrorKind::MissingStepInput.into_error())?;
    let target_player_id = fields
        .player_ids
        .and_then(|ids| ids.into_iter().next())
        .ok_or_else(|| ErrorKind::MissingStepInput.into_error())?;
    let required_character_id = fields
        .character_id
        .ok_or_else(|| ErrorKind::MissingStepInput.into_error())?;
    let target = players
        .iter()
        .find(|player| player.id == target_player_id)
        .ok_or_else(|| ErrorKind::InvalidStepInput.into_error())?;
    Ok(Proposal {
        event: GameEvent {
            id: format!("madness-assignment-{}", game_file.game.events.len() + 1),
            kind: GameEventKind::MadnessAssigned {
                payload: MadnessAssignedPayload {
                    step_id: step.id.clone(),
                    source_player_id,
                    target_player_id,
                    required_character_id: required_character_id.clone(),
                },
            },
            phase: step.phase,
            summary: format!(
                "세레노버스 집착 지정: {}번 {} · {}",
                target.seat, target.name, required_character_id
            ),
            created_at: game_file
                .game
                .updated_at
                .clone()
                .unwrap_or_else(|| "1970-01-01T00:00:00.000Z".into()),
        },
        warnings: vec![],
        follow_up_steps: vec![],
        preview: json!({ "messageKo": "세레노버스 집착 지정을 확정합니다." }),
        reveal_payload: None,
    })
}

fn propose_day_action(
    game_file: &GameFile,
    current_step: &PhaseStep,
    players: &[Player],
    payload: RecordDayActionCommandPayload,
) -> Result<Proposal, CoreError> {
    if payload.expected_event_count != game_file.game.events.len() {
        return Err(ErrorKind::StaleCommand.into_error());
    }
    let character_id = day_action_character(&payload.record).to_string();
    let canonical = DayActionRecordedPayload {
        day_id: payload.day_id,
        actor_player_id: payload.actor_player_id,
        character_id,
        record: payload.record,
    };
    validate_day_action_payload(
        &canonical,
        Phase::Day,
        current_step,
        players,
        &game_file.game.events,
    )?;
    let actor = players
        .iter()
        .find(|player| player.id == canonical.actor_player_id)
        .ok_or_else(|| ErrorKind::InvalidDayActionActor.into_error())?;
    let character_label = match canonical.character_id.as_str() {
        "artist" => "화가",
        "savant" => "백치천재",
        "juggler" => "곡예사",
        _ => return Err(ErrorKind::InvalidDayActionActor.into_error()),
    };
    Ok(Proposal {
        event: GameEvent {
            id: format!("day-action-{}", game_file.game.events.len() + 1),
            kind: GameEventKind::DayActionRecorded { payload: canonical },
            phase: Phase::Day,
            summary: format!(
                "{character_label} 자유 행동 기록: {}번 {}",
                actor.seat, actor.name
            ),
            created_at: game_file
                .game
                .updated_at
                .clone()
                .unwrap_or_else(|| "1970-01-01T00:00:00.000Z".into()),
        },
        warnings: vec![],
        follow_up_steps: vec![],
        preview: json!({ "messageKo": format!("{character_label} 자유 행동 기록 완료") }),
        reveal_payload: None,
    })
}

fn propose_madness_check(
    game_file: &GameFile,
    current_step: &PhaseStep,
    players: &[Player],
    payload: RecordMadnessCheckCommandPayload,
) -> Result<Proposal, CoreError> {
    if payload.expected_event_count != game_file.game.events.len() {
        return Err(ErrorKind::StaleCommand.into_error());
    }
    if current_step.phase != Phase::Day {
        return Err(ErrorKind::MadnessCheckWrongPhase.into_error());
    }
    let assignments = madness_assignments(
        current_step.phase,
        Some(current_step),
        players,
        &game_file.game.events,
    );
    let assignment = assignments
        .iter()
        .find(|assignment| assignment.assignment_id == payload.assignment_id)
        .ok_or_else(|| ErrorKind::MadnessAssignmentUnavailable.into_error())?;
    if assignment.status == MadnessStatus::Violated {
        return Err(ErrorKind::MadnessViolationLatched.into_error());
    }
    if !assignment.can_check {
        return Err(ErrorKind::MadnessAssignmentUnavailable.into_error());
    }
    if assignment.status == MadnessStatus::Clear && payload.result == MadnessCheckResult::Clear {
        return Err(ErrorKind::MadnessCheckUnchanged.into_error());
    }
    let target = players
        .iter()
        .find(|player| player.id == assignment.target_player_id)
        .ok_or_else(|| ErrorKind::MadnessAssignmentUnavailable.into_error())?;
    let result_label = match payload.result {
        MadnessCheckResult::Clear => "위반 없음",
        MadnessCheckResult::Violation => "위반 확인",
    };
    Ok(Proposal {
        event: GameEvent {
            id: format!("madness-check-{}", game_file.game.events.len() + 1),
            kind: GameEventKind::MadnessCheckRecorded {
                payload: MadnessCheckRecordedPayload {
                    assignment_id: assignment.assignment_id.clone(),
                    source_player_id: assignment.source_player_id.clone(),
                    source_character_id: assignment.source_character_id.clone(),
                    target_player_id: assignment.target_player_id.clone(),
                    result: payload.result,
                },
            },
            phase: Phase::Day,
            summary: format!(
                "광기 확인: {}번 {} · {result_label}",
                target.seat, target.name
            ),
            created_at: game_file
                .game
                .updated_at
                .clone()
                .unwrap_or_else(|| "1970-01-01T00:00:00.000Z".into()),
        },
        warnings: vec![],
        follow_up_steps: vec![],
        preview: json!({ "messageKo": format!("광기 {result_label}") }),
        reveal_payload: None,
    })
}

fn propose_madness_execution(
    game_file: &GameFile,
    current_step: &PhaseStep,
    players: &[Player],
    payload: ExecuteMadnessCommandPayload,
) -> Result<Proposal, CoreError> {
    if payload.expected_event_count != game_file.game.events.len() {
        return Err(ErrorKind::StaleCommand.into_error());
    }
    let assignments = madness_assignments(
        current_step.phase,
        Some(current_step),
        players,
        &game_file.game.events,
    );
    let assignment = assignments
        .iter()
        .find(|assignment| assignment.assignment_id == payload.assignment_id)
        .filter(|assignment| assignment.can_execute)
        .ok_or_else(|| ErrorKind::MadnessExecutionUnavailable.into_error())?;
    let target = players
        .iter()
        .find(|player| player.id == assignment.target_player_id && player.alive)
        .ok_or_else(|| ErrorKind::MadnessExecutionUnavailable.into_error())?;
    Ok(Proposal {
        event: GameEvent {
            id: format!("madness-execution-{}", game_file.game.events.len() + 1),
            kind: GameEventKind::MadnessExecutionConfirmed {
                payload: MadnessExecutionConfirmedPayload {
                    assignment_id: assignment.assignment_id.clone(),
                    check_event_id: assignment.violation_check_event_id.clone(),
                    source_player_id: assignment.source_player_id.clone(),
                    source_character_id: assignment.source_character_id.clone(),
                    target_player_id: assignment.target_player_id.clone(),
                    interrupted_step_id: current_step.id.clone(),
                },
            },
            phase: current_step.phase,
            summary: format!("광기 위반 처형: {}번 {}", target.seat, target.name),
            created_at: game_file
                .game
                .updated_at
                .clone()
                .unwrap_or_else(|| "1970-01-01T00:00:00.000Z".into()),
        },
        warnings: vec![],
        follow_up_steps: vec![],
        preview: json!({ "messageKo": "광기 위반 처형을 확정합니다." }),
        reveal_payload: None,
    })
}

fn propose_snake_charmer_action(
    game_file: &GameFile,
    step: &PhaseStep,
    players: &[Player],
    input: crate::model::StepInput,
) -> Result<Proposal, CoreError> {
    let actor_player_id = step
        .player_id
        .clone()
        .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
    let actor = players
        .iter()
        .find(|player| {
            player.id == actor_player_id
                && player.alive
                && player.actual_character == "snakeCharmer"
        })
        .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
    let target_player_id = input
        .as_ref()
        .and_then(|fields| fields.player_ids.as_ref())
        .and_then(|ids| ids.first())
        .cloned()
        .ok_or_else(|| ErrorKind::InvalidStepInput.into_error())?;
    let target = players
        .iter()
        .find(|player| player.id == target_player_id && player.alive)
        .ok_or_else(|| ErrorKind::InvalidStepInput.into_error())?;
    let event_id = format!("snake-charmer-{}", game_file.game.events.len() + 1);
    let actor_impaired = active_snake_charmer_impairments(&game_file.game.events)
        .iter()
        .any(|impairment| impairment.player_id == actor.id);
    let target_is_demon = character_kind(&target.actual_character) == Some(CharacterKind::Demon);
    let outcome = if !target_is_demon {
        SnakeCharmerActionOutcome::NoSwap {
            reason: SnakeCharmerNoSwapReason::TargetNotDemon,
        }
    } else if actor_impaired {
        SnakeCharmerActionOutcome::NoSwap {
            reason: SnakeCharmerNoSwapReason::ActorImpaired,
        }
    } else {
        SnakeCharmerActionOutcome::Swap {
            identity_transitions: vec![
                PlayerIdentityTransition {
                    player_id: actor.id.clone(),
                    before: identity_state(actor),
                    after: IdentityState {
                        actual_character: target.actual_character.clone(),
                        shown_character: target.shown_character.clone(),
                        alignment: target.alignment,
                    },
                },
                PlayerIdentityTransition {
                    player_id: target.id.clone(),
                    before: identity_state(target),
                    after: IdentityState {
                        actual_character: "snakeCharmer".into(),
                        shown_character: "snakeCharmer".into(),
                        alignment: actor.alignment,
                    },
                },
            ],
            impairment: ActiveImpairment {
                kind: ImpairmentKind::Poisoned,
                player_id: target.id.clone(),
                source_event_id: event_id.clone(),
                source_character_id: "snakeCharmer".into(),
                expires: ImpairmentExpiry::Never,
            },
        }
    };
    let summary = match outcome {
        SnakeCharmerActionOutcome::Swap { .. } => "뱀 조련사 교환 확정",
        SnakeCharmerActionOutcome::NoSwap { .. } => "뱀 조련사 선택 확정",
    };
    Ok(Proposal {
        event: GameEvent {
            id: event_id,
            kind: GameEventKind::SnakeCharmerActionResolved {
                payload: SnakeCharmerActionResolvedPayload {
                    step_id: step.id.clone(),
                    actor_player_id,
                    target_player_id,
                    outcome,
                },
            },
            phase: step.phase,
            summary: summary.into(),
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

fn phase_proposal(
    game_file: &GameFile,
    step: &PhaseStep,
    kind: GameEventKind,
    summary: String,
    warnings: Vec<CoreWarning>,
) -> Proposal {
    Proposal {
        event: GameEvent {
            id: format!("phase-{}", game_file.game.events.len() + 1),
            kind,
            phase: step.phase,
            summary: summary.clone(),
            created_at: game_file
                .game
                .updated_at
                .clone()
                .unwrap_or_else(|| "1970-01-01T00:00:00.000Z".into()),
        },
        warnings,
        follow_up_steps: vec![],
        preview: json!({ "messageKo": summary }),
        reveal_payload: None,
    }
}

fn propose_pit_hag_transformation(
    game_file: &GameFile,
    step: &PhaseStep,
    players: &[Player],
    input: crate::model::StepInput,
) -> Result<Proposal, CoreError> {
    let actor_player_id = step
        .player_id
        .clone()
        .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
    let actor = players
        .iter()
        .find(|player| player.id == actor_player_id)
        .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
    let fields = input
        .as_ref()
        .ok_or_else(|| ErrorKind::InvalidStepInput.into_error())?;
    let target_player_id = fields
        .player_ids
        .as_ref()
        .and_then(|ids| ids.first())
        .cloned()
        .ok_or_else(|| ErrorKind::InvalidStepInput.into_error())?;
    let character_id = fields
        .character_ids
        .as_ref()
        .and_then(|ids| ids.first())
        .cloned()
        .ok_or_else(|| ErrorKind::InvalidStepInput.into_error())?;
    let target = players
        .iter()
        .find(|player| player.id == target_player_id)
        .ok_or_else(|| ErrorKind::InvalidStepInput.into_error())?;
    let character_already_in_play = players
        .iter()
        .any(|player| player.actual_character == character_id);
    let actor_impaired = active_snake_charmer_impairments(&game_file.game.events)
        .iter()
        .any(|impairment| impairment.player_id == actor.id);
    let outcome = if character_already_in_play {
        PitHagTransformationOutcome::NoChange {
            reason: PitHagNoChangeReason::CharacterAlreadyInPlay,
        }
    } else if actor.actual_character != "pitHag" {
        PitHagTransformationOutcome::NoChange {
            reason: PitHagNoChangeReason::NotActualCharacter,
        }
    } else if actor_impaired {
        PitHagTransformationOutcome::NoChange {
            reason: PitHagNoChangeReason::ActorImpaired,
        }
    } else {
        PitHagTransformationOutcome::Changed {
            identity_transition: PlayerIdentityTransition {
                player_id: target.id.clone(),
                before: identity_state(target),
                after: IdentityState {
                    actual_character: character_id.clone(),
                    shown_character: character_id.clone(),
                    alignment: target.alignment,
                },
            },
            created_demon: character_kind(&target.actual_character) != Some(CharacterKind::Demon)
                && character_kind(&character_id) == Some(CharacterKind::Demon),
        }
    };
    let summary = match outcome {
        PitHagTransformationOutcome::Changed { .. } => "마귀할멈 직업 변경 확정",
        PitHagTransformationOutcome::NoChange { .. } => "마귀할멈 선택 확정 · 변경 없음",
    };
    Ok(Proposal {
        event: GameEvent {
            id: format!("pit-hag-{}", game_file.game.events.len() + 1),
            kind: GameEventKind::PitHagTransformationResolved {
                payload: PitHagTransformationResolvedPayload {
                    step_id: step.id.clone(),
                    actor_player_id,
                    target_player_id,
                    character_id,
                    outcome,
                },
            },
            phase: step.phase,
            summary: summary.into(),
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

fn propose_demon_attack(
    game_file: &GameFile,
    step: &PhaseStep,
    players: &[Player],
    input: crate::model::StepInput,
) -> Result<Proposal, CoreError> {
    let actor_player_id = step
        .player_id
        .clone()
        .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
    let actor_character_id = step
        .character
        .clone()
        .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
    let actor = players
        .iter()
        .find(|player| {
            player.id == actor_player_id
                && player.alive
                && player.actual_character == actor_character_id
        })
        .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
    let target_player_id = input
        .as_ref()
        .and_then(|fields| fields.player_ids.as_ref())
        .and_then(|ids| ids.first())
        .cloned()
        .ok_or_else(|| ErrorKind::InvalidStepInput.into_error())?;
    let target = players
        .iter()
        .find(|player| player.id == target_player_id)
        .ok_or_else(|| ErrorKind::InvalidStepInput.into_error())?;
    let prefix = step
        .id
        .split(":demon:")
        .next()
        .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
    let pit_hag_created_demon = pit_hag_demon_creation(&game_file.game.events, prefix).is_some();
    let (outcome, outcome_label, warnings) = if pit_hag_created_demon {
        (
            DemonAttackOutcome::NoEffect {
                reason: DemonAttackNoEffectReason::PitHagCreatedDemon,
            },
            "사망 대상 후보 기록",
            vec![],
        )
    } else if target.alive {
        (
            DemonAttackOutcome::Deaths {
                deaths: vec![NightDeath {
                    player_id: target_player_id.clone(),
                    cause: NightDeathCause::DemonAttack {
                        actor_player_id: actor_player_id.clone(),
                        actor_character_id: actor_character_id.clone(),
                        target_player_id: target_player_id.clone(),
                    },
                }],
            },
            "사망",
            vec![],
        )
    } else {
        (
            DemonAttackOutcome::NoEffect {
                reason: DemonAttackNoEffectReason::TargetAlreadyDead,
            },
            "이미 사망 · 추가 효과 없음",
            vec![CoreWarning {
                code: "DEMON_ATTACK_TARGET_ALREADY_DEAD".into(),
                severity: "warning",
                message_ko: "이미 사망한 대상입니다.".into(),
                winning_team: None,
            }],
        )
    };
    let summary = format!(
        "{}번 {}({}) → {}번 {} 공격 · {outcome_label}",
        actor.seat, actor.name, actor_character_id, target.seat, target.name,
    );
    Ok(phase_proposal(
        game_file,
        step,
        GameEventKind::NightActionResolved {
            payload: NightActionResolvedPayload {
                step_id: step.id.clone(),
                actor_player_id,
                actor_character_id: Some(actor_character_id),
                resolution: NightActionResolution::DemonAttack {
                    target_player_id,
                    outcome,
                },
            },
        },
        summary,
        warnings,
    ))
}

fn propose_pit_hag_arbitrary_deaths(
    game_file: &GameFile,
    step: &PhaseStep,
    players: &[Player],
    input: crate::model::StepInput,
) -> Result<Proposal, CoreError> {
    let player_ids = input
        .as_ref()
        .and_then(|fields| fields.player_ids.clone())
        .ok_or_else(|| ErrorKind::InvalidStepInput.into_error())?;
    let prefix = step
        .id
        .split(':')
        .next()
        .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
    let source = pit_hag_demon_creation(&game_file.game.events, prefix)
        .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
    let GameEventKind::PitHagTransformationResolved {
        payload: transformation,
    } = &source.kind
    else {
        return Err(ErrorKind::ReplayFailed.into_error());
    };
    let deaths = player_ids
        .iter()
        .map(|player_id| {
            let player = players
                .iter()
                .find(|player| player.id == *player_id && player.alive)
                .ok_or_else(|| ErrorKind::InvalidStepInput.into_error())?;
            Ok(NightDeath {
                player_id: player.id.clone(),
                cause: NightDeathCause::PitHagArbitraryDeath {
                    actor_player_id: transformation.actor_player_id.clone(),
                    source_transformation_event_id: source.id.clone(),
                },
            })
        })
        .collect::<Result<Vec<_>, CoreError>>()?;
    let summary = if deaths.is_empty() {
        "마귀할멈 임의 사망 확정 · 사망자 없음".to_string()
    } else {
        format!("마귀할멈 임의 사망 확정 · {}명", deaths.len())
    };
    Ok(phase_proposal(
        game_file,
        step,
        GameEventKind::PitHagArbitraryDeathsConfirmed {
            payload: PitHagArbitraryDeathsConfirmedPayload {
                step_id: step.id.clone(),
                source_transformation_event_id: source.id.clone(),
                deaths,
            },
        },
        summary,
        vec![],
    ))
}

fn propose_night_deaths_announcement(
    game_file: &GameFile,
    step: &PhaseStep,
    players: &[Player],
) -> Result<Proposal, CoreError> {
    let player_ids = unannounced_night_death_player_ids(&game_file.game.events);
    let resurrected_player_ids = unannounced_night_resurrection_player_ids(&game_file.game.events);
    let labels = |ids: &[String]| {
        ids.iter()
            .map(|player_id| {
                players
                    .iter()
                    .find(|player| player.id == *player_id)
                    .map(|player| format!("{}번 {}", player.seat, player.name))
                    .ok_or_else(|| ErrorKind::ReplayFailed.into_error())
            })
            .collect::<Result<Vec<_>, _>>()
    };
    let death_labels = labels(&player_ids)?;
    let resurrection_labels = labels(&resurrected_player_ids)?;
    let summary = format!(
        "밤 결과 · 사망자: {} · 부활: {}",
        if death_labels.is_empty() {
            "없음".into()
        } else {
            death_labels.join(", ")
        },
        if resurrection_labels.is_empty() {
            "없음".into()
        } else {
            resurrection_labels.join(", ")
        },
    );

    Ok(phase_proposal(
        game_file,
        step,
        GameEventKind::NightDeathsAnnounced {
            payload: NightDeathsAnnouncedPayload {
                step_id: step.id.clone(),
                player_ids,
                resurrected_player_ids,
            },
        },
        summary,
        vec![],
    ))
}

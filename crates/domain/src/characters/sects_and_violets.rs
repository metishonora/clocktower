use std::collections::HashMap;

use crate::{
    contracts::{
        ActiveImpairment, Command, DemonAttackNoEffectReason, DemonAttackOutcome, GameEvent,
        GameEventKind, GameFile, ImpairmentExpiry, ImpairmentKind, ManualPhaseStepOutcome,
        ManualPhaseStepResolvedPayload, NightActionResolution, NightActionResolvedPayload,
        NightDeath, NightDeathCause, NightDeathsAnnouncedPayload, PendingIdentityReveal,
        PhaseStepEventPayload, Proposal, ReplayState, RevealPayload, RuleState,
        SnakeCharmerActionOutcome, SnakeCharmerActionResolvedPayload, SnakeCharmerNoSwapReason,
    },
    day::{
        day_steps, replay_day_state, step_prefix, validate_nomination_event_input,
        validate_nomination_start_roles,
    },
    error::{CoreError, ErrorKind},
    model::{
        Alignment, CharacterKind, CoreWarning, IdentityHistoryEntry, IdentityState, InputTarget,
        Phase, PhaseOverviewItem, PhaseStep, PhaseStepStatus, PhaseStepSupport, Player,
        PlayerIdentityTransition, RequiredInput, RequiredInputKind, StepType,
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

fn character_step(
    phase: Phase,
    prefix: &str,
    character: &str,
    player: &Player,
    players: &[Player],
) -> PhaseStep {
    let snake_charmer = character == "snakeCharmer";
    PhaseStep {
        id: if snake_charmer {
            format!("{prefix}:{character}:{}", player.id)
        } else {
            format!("{prefix}:{character}")
        },
        phase,
        step_type: StepType::Character,
        character: Some(character.to_string()),
        player_id: Some(player.id.clone()),
        required_input: if snake_charmer {
            RequiredInput {
                kind: RequiredInputKind::PlayerIds,
                target: Some(InputTarget::Player),
                min_selections: Some(1),
                max_selections: Some(1),
                setup_info: None,
                character_kind: None,
                allowed_character_ids: None,
                allowed_player_ids: Some(
                    players
                        .iter()
                        .filter(|candidate| candidate.alive)
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
        } else {
            required_none()
        },
        can_skip: false,
        support: if snake_charmer {
            PhaseStepSupport::Automated
        } else {
            PhaseStepSupport::Manual
        },
        information_prompt: None,
        pre_action_reveal: None,
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
            .find(|player| player.alive && DEMONS.contains(&player.actual_character.as_str()))
            .map(|player| (player.id.as_str(), player.actual_character.as_str()))
    })?;
    Some(PhaseStep {
        id: format!("{prefix}:demon:{}", actor),
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

fn later_night_steps(players: &[Player], events: &[GameEvent], cycle: usize) -> Vec<PhaseStep> {
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
                    && (character != "snakeCharmer" || player.alive)
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
                    && (character != "snakeCharmer" || player.alive)
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
    steps
}

fn phase_sequences(
    players: &[Player],
    events: &[GameEvent],
    max_cycles: usize,
    statuses: &HashMap<String, PhaseStepStatus>,
) -> Vec<(Phase, Vec<PhaseStep>)> {
    let mut sequences = vec![(Phase::FirstNight, first_night_steps(players))];
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
        sequences.push((Phase::Night, later_night_steps(players, events, cycle)));
    }
    sequences
}

fn current_phase_steps(
    players: &[Player],
    events: &[GameEvent],
    max_cycles: usize,
    statuses: &HashMap<String, PhaseStepStatus>,
) -> Option<(Phase, Vec<PhaseStep>, Option<PhaseStep>)> {
    for (phase, steps) in phase_sequences(players, events, max_cycles, statuses) {
        if steps
            .iter()
            .all(|step| crate::phase::step_status(&step.id, statuses).is_done())
        {
            continue;
        }
        let current = steps
            .iter()
            .find(|step| !crate::phase::step_status(&step.id, statuses).is_done())
            .cloned();
        return Some((phase, steps, current));
    }
    None
}

fn first_night_steps(players: &[Player]) -> Vec<PhaseStep> {
    let mut steps = Vec::new();
    let players_for = |character: &str| {
        let mut matching = players
            .iter()
            .filter(|player| {
                player.actual_character == character
                    && (character != "snakeCharmer" || player.alive)
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

fn identity_state(player: &Player) -> IdentityState {
    IdentityState {
        actual_character: player.actual_character.clone(),
        shown_character: player.shown_character.clone(),
        alignment: player.alignment,
    }
}

fn replay_players(events: &[GameEvent]) -> Result<Vec<Player>, CoreError> {
    let mut players = setup_players(events)?;
    let mut active_impairments = Vec::<ActiveImpairment>::new();
    for (event_index, event) in events.iter().enumerate().skip(1) {
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
                            } = &death.cause;
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
                }
            }
            GameEventKind::NightDeathsAnnounced { payload } => {
                if payload.player_ids != unannounced_night_death_player_ids(&events[..event_index])
                {
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
                    player.identity_history.push(IdentityHistoryEntry {
                        source_event_id: event.id.clone(),
                        phase: event.phase,
                        before: transition.before,
                        after: transition.after,
                    });
                }
                active_impairments.push(impairment);
            }
            _ => {}
        }
    }
    Ok(players)
}

fn unannounced_night_death_player_ids(events: &[GameEvent]) -> Vec<String> {
    let mut deaths = Vec::new();
    let mut announced = Vec::new();
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
            GameEventKind::NightDeathsAnnounced { payload } => {
                for player_id in &payload.player_ids {
                    if !announced.contains(player_id) {
                        announced.push(player_id.clone());
                    }
                }
            }
            _ => {}
        }
    }
    deaths
        .into_iter()
        .filter(|player_id| !announced.contains(player_id))
        .collect()
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
    let GameEventKind::SnakeCharmerActionResolved { payload } = &event.kind else {
        return vec![];
    };
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

fn phase_state(
    players: &[Player],
    events: &[GameEvent],
) -> Result<(Phase, Option<PhaseStep>, Vec<PhaseOverviewItem>), CoreError> {
    let mut statuses = HashMap::new();

    for (event_index, event) in events.iter().enumerate().skip(1) {
        if let GameEventKind::ManualPhaseStepResolved { payload } = &event.kind {
            if let Some(prefix) = payload.step_id.strip_suffix(":manual") {
                let players_at_event = replay_players(&events[..event_index])?;
                let Some((phase, _, current)) = current_phase_steps(
                    &players_at_event,
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
        let players_at_event = replay_players(&events[..event_index])?;
        let Some((_, _, Some(current))) = current_phase_steps(
            &players_at_event,
            &events[..event_index],
            events.len() + 2,
            &statuses,
        ) else {
            return Err(ErrorKind::ReplayFailed.into_error());
        };
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
            }
            (GameEventKind::ManualPhaseStepResolved { .. }, PhaseStepSupport::Manual) => {}
            (GameEventKind::ManualPhaseStepResolved { .. }, PhaseStepSupport::Automated)
                if legacy_manual_demon || legacy_manual_snake_charmer => {}
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
        if let GameEventKind::NoExecutionConfirmed { payload } = &event.kind {
            let prefix = step_prefix(&payload.step_id)?;
            statuses.insert(format!("{prefix}:executionDeath"), PhaseStepStatus::Skipped);
        }
    }

    let Some((phase, steps, current)) =
        current_phase_steps(players, events, events.len() + 2, &statuses)
    else {
        return Ok((Phase::Night, None, vec![]));
    };
    let current_id = current.as_ref().map(|step| step.id.as_str());
    let overview = if current.is_none() {
        vec![]
    } else {
        steps
            .into_iter()
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
            pending_identity_reveals: vec![],
        });
    }
    let players = replay_players(&game_file.game.events)?;
    let mut warnings = validate_setup_warnings_for_script(game_file.script_id, &players);
    let (phase, current_step, phase_overview) = phase_state(&players, &game_file.game.events)?;
    let day_state = if phase == Phase::Day {
        current_step
            .as_ref()
            .and_then(|step| step_prefix(&step.id).ok())
            .map(|prefix| replay_day_state(&game_file.game.events, &players, &prefix))
            .transpose()?
    } else {
        None
    };
    let unannounced_night_death_player_ids =
        unannounced_night_death_player_ids(&game_file.game.events);
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
    let rule_state = RuleState {
        unannounced_night_death_player_ids,
        active_impairments: Some(active_snake_charmer_impairments(&game_file.game.events)),
        ..RuleState::default()
    };
    let pending_identity_reveals = pending_identity_reveals(&game_file.game.events);
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
        game_end: None,
        pending_identity_reveals,
    })
}

pub(crate) fn propose_phase_command(
    game_file: &GameFile,
    command: Command,
) -> Result<Proposal, CoreError> {
    let players = replay_players(&game_file.game.events)?;
    let (_, current_step, _) = phase_state(&players, &game_file.game.events)?;
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
            if current_step.character.as_deref() == Some("snakeCharmer") {
                return propose_snake_charmer_action(
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
        _ => Err(ErrorKind::CommandNotSupportedByScript.into_error()),
    }
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
    let (outcome, outcome_label, warnings) = if target.alive {
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

fn propose_night_deaths_announcement(
    game_file: &GameFile,
    step: &PhaseStep,
    players: &[Player],
) -> Result<Proposal, CoreError> {
    let player_ids = unannounced_night_death_player_ids(&game_file.game.events);
    let summary = if player_ids.is_empty() {
        "새벽 발표 · 사망자 없음".to_string()
    } else {
        let labels = player_ids
            .iter()
            .map(|player_id| {
                players
                    .iter()
                    .find(|player| player.id == *player_id)
                    .map(|player| format!("{}번 {}", player.seat, player.name))
                    .ok_or_else(|| ErrorKind::ReplayFailed.into_error())
            })
            .collect::<Result<Vec<_>, _>>()?;
        format!("새벽 사망 발표 · {}", labels.join(", "))
    };

    Ok(phase_proposal(
        game_file,
        step,
        GameEventKind::NightDeathsAnnounced {
            payload: NightDeathsAnnouncedPayload {
                step_id: step.id.clone(),
                player_ids,
            },
        },
        summary,
        vec![],
    ))
}

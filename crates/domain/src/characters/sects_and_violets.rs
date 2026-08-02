use std::collections::{HashMap, HashSet};

mod step_key;
use step_key::{PhaseKey as SnvPhaseKey, SemanticStep as SnvSemanticStep, StepKey as SnvStepKey};

#[cfg(test)]
use std::cell::Cell;

use crate::{
    contracts::{
        ActiveImpairment, ActiveWitchCurse, ArtistAnswer, AutomaticReminder, AvailableDayAction,
        BarberConsequenceOutcome, BarberConsequenceResolvedPayload, BarberDecision, Command,
        ConfirmedDayActionRecord, DayActionRecord, DayActionRecordedPayload, DeathConsequenceKind,
        DeathConsequenceNoEffectReason, DeathEventPayload, DeathTriggerRef,
        DemonAttackNoEffectReason, DemonAttackOutcome, EndGameCommandPayload,
        EvilTwinPairAssignedPayload, EvilTwinRelationship, EvilTwinRevealPlayer,
        ExecuteMadnessCommandPayload, GameEndCause, GameEndSource, GameEndState, GameEndedPayload,
        GameEvent, GameEventKind, GameFile, ImpairmentExpiry, ImpairmentKind, KlutzChoiceOutcome,
        KlutzChoiceResolvedPayload, MadnessAssignedPayload, MadnessAssignmentState,
        MadnessCheckRecordedPayload, MadnessCheckResult, MadnessExecutionConfirmedPayload,
        MadnessStatus, ManualPhaseStepOutcome, ManualPhaseStepResolvedPayload,
        NightActionResolution, NightActionResolvedPayload, NightDeath, NightDeathCause,
        NightDeathsAnnouncedPayload, PendingDeathConsequence, PendingGameEnd,
        PendingIdentityReveal, PendingMadnessExecution, PendingVigormortisPoisonChoice,
        PhaseStepEventPayload, PitHagArbitraryDeathsConfirmedPayload, PitHagNoChangeReason,
        PitHagTransformationOutcome, PitHagTransformationResolvedPayload, Proposal,
        RecordDayActionCommandPayload, RecordMadnessCheckCommandPayload, ReplayState,
        ResolveBarberConsequenceCommandPayload, ResolveKlutzConsequenceCommandPayload,
        ResolveSweetheartConsequenceCommandPayload, ResolveVigormortisPoisonCommandPayload,
        RevealPayload, RuleState, SnakeCharmerActionOutcome, SnakeCharmerActionResolvedPayload,
        SnakeCharmerNoSwapReason, SweetheartConsequenceOutcome,
        SweetheartConsequenceResolvedPayload, VigormortisEffect, VigormortisPoisonInvalidReason,
        VigormortisPoisonTargetChangedPayload, VirginResolution, WitchCurseAssignedPayload,
        WitchNominationResolution,
    },
    day::{
        day_steps, replay_day_state, step_prefix, validate_nomination_event_input,
        validate_nomination_start_roles,
    },
    error::{CoreError, ErrorKind},
    messages::game_end_reason_ko,
    model::{
        AbilityInstance, AbilityInstanceId, Alignment, BooleanInformationChoice, CharacterKind,
        ConfirmedInformation, CoreWarning, DeliveryContext, DeliveryReason, IdentityHistoryEntry,
        IdentityState, InformationActor, InformationDeliveryMode, InformationPrompt,
        InformationResult, InputTarget, NumberInformationChoice, NumberInformationConstraint,
        Phase, PhaseOverviewItem, PhaseStep, PhaseStepStatus, PhaseStepSupport, Player,
        PlayerIdentityTransition, PlayerStateSnapshot, PlayerTransition, RequiredInput,
        RequiredInputKind, StepInput, StepType, TargetInformationCheck, TargetInformationChoice,
    },
    phase::{
        phase_transition_step, required_characters, required_none, simple_step,
        validate_required_input,
    },
    setup::{
        player_from_setup_input_for_script, validate_setup_inputs_for_script,
        validate_setup_warnings_for_script,
    },
};
use serde_json::json;

#[derive(Debug, Copy, Clone, PartialEq, Eq, Hash)]
enum SnvCharacterId {
    Clockmaker,
    Dreamer,
    SnakeCharmer,
    Mathematician,
    Flowergirl,
    TownCrier,
    Oracle,
    Savant,
    Seamstress,
    Philosopher,
    Artist,
    Juggler,
    Sage,
    Mutant,
    Sweetheart,
    Barber,
    Klutz,
    EvilTwin,
    Witch,
    Cerenovus,
    PitHag,
    FangGu,
    Vigormortis,
    NoDashii,
    Vortox,
}

#[derive(Debug, Copy, Clone, PartialEq, Eq)]
enum CharacterInputPolicy {
    NoInput,
    Number,
    OnePlayer,
    TwoPlayers,
    MadnessAssignment,
    CharacterTransformation,
}

#[derive(Debug, Copy, Clone, PartialEq, Eq)]
enum AbilityActivityPolicy {
    WhileActive,
    OnDeath,
    KilledByDemon,
}

#[derive(Debug, Copy, Clone, PartialEq, Eq)]
enum SameNightAcquisitionPolicy {
    StartKnowingImmediately,
    WakeIfOrderPending,
    TriggerIfEligible,
    NextPhase,
}

#[derive(Debug, Copy, Clone, PartialEq, Eq)]
struct SnvCharacterMetadata {
    kind: CharacterKind,
    first_night_rank: Option<u8>,
    later_night_rank: Option<u8>,
    input: CharacterInputPolicy,
    support: PhaseStepSupport,
    activity: AbilityActivityPolicy,
    once_per_ability_instance: bool,
    same_night_acquisition: SameNightAcquisitionPolicy,
}

impl SnvCharacterId {
    const ALL: [Self; 25] = [
        Self::Clockmaker,
        Self::Dreamer,
        Self::SnakeCharmer,
        Self::Mathematician,
        Self::Flowergirl,
        Self::TownCrier,
        Self::Oracle,
        Self::Savant,
        Self::Seamstress,
        Self::Philosopher,
        Self::Artist,
        Self::Juggler,
        Self::Sage,
        Self::Mutant,
        Self::Sweetheart,
        Self::Barber,
        Self::Klutz,
        Self::EvilTwin,
        Self::Witch,
        Self::Cerenovus,
        Self::PitHag,
        Self::FangGu,
        Self::Vigormortis,
        Self::NoDashii,
        Self::Vortox,
    ];

    fn parse(value: &str) -> Option<Self> {
        Some(match value {
            "clockmaker" => Self::Clockmaker,
            "dreamer" => Self::Dreamer,
            "snakeCharmer" => Self::SnakeCharmer,
            "mathematician" => Self::Mathematician,
            "flowergirl" => Self::Flowergirl,
            "townCrier" => Self::TownCrier,
            "oracle" => Self::Oracle,
            "savant" => Self::Savant,
            "seamstress" => Self::Seamstress,
            "philosopher" => Self::Philosopher,
            "artist" => Self::Artist,
            "juggler" => Self::Juggler,
            "sage" => Self::Sage,
            "mutant" => Self::Mutant,
            "sweetheart" => Self::Sweetheart,
            "barber" => Self::Barber,
            "klutz" => Self::Klutz,
            "evilTwin" => Self::EvilTwin,
            "witch" => Self::Witch,
            "cerenovus" => Self::Cerenovus,
            "pitHag" => Self::PitHag,
            "fangGu" => Self::FangGu,
            "vigormortis" => Self::Vigormortis,
            "noDashii" => Self::NoDashii,
            "vortox" => Self::Vortox,
            _ => return None,
        })
    }

    const fn as_str(self) -> &'static str {
        match self {
            Self::Clockmaker => "clockmaker",
            Self::Dreamer => "dreamer",
            Self::SnakeCharmer => "snakeCharmer",
            Self::Mathematician => "mathematician",
            Self::Flowergirl => "flowergirl",
            Self::TownCrier => "townCrier",
            Self::Oracle => "oracle",
            Self::Savant => "savant",
            Self::Seamstress => "seamstress",
            Self::Philosopher => "philosopher",
            Self::Artist => "artist",
            Self::Juggler => "juggler",
            Self::Sage => "sage",
            Self::Mutant => "mutant",
            Self::Sweetheart => "sweetheart",
            Self::Barber => "barber",
            Self::Klutz => "klutz",
            Self::EvilTwin => "evilTwin",
            Self::Witch => "witch",
            Self::Cerenovus => "cerenovus",
            Self::PitHag => "pitHag",
            Self::FangGu => "fangGu",
            Self::Vigormortis => "vigormortis",
            Self::NoDashii => "noDashii",
            Self::Vortox => "vortox",
        }
    }

    const fn metadata(self) -> SnvCharacterMetadata {
        use AbilityActivityPolicy::{KilledByDemon, OnDeath, WhileActive};
        use CharacterInputPolicy::{
            CharacterTransformation, MadnessAssignment, NoInput, Number, OnePlayer, TwoPlayers,
        };
        use SameNightAcquisitionPolicy::{
            NextPhase, StartKnowingImmediately, TriggerIfEligible, WakeIfOrderPending,
        };
        let automated = PhaseStepSupport::Automated;
        let manual = PhaseStepSupport::Manual;
        match self {
            Self::Clockmaker => SnvCharacterMetadata {
                kind: CharacterKind::Townsfolk,
                first_night_rank: Some(7),
                later_night_rank: None,
                input: Number,
                support: automated,
                activity: WhileActive,
                once_per_ability_instance: false,
                same_night_acquisition: StartKnowingImmediately,
            },
            Self::Dreamer => SnvCharacterMetadata {
                kind: CharacterKind::Townsfolk,
                first_night_rank: Some(8),
                later_night_rank: Some(9),
                input: OnePlayer,
                support: automated,
                activity: WhileActive,
                once_per_ability_instance: false,
                same_night_acquisition: WakeIfOrderPending,
            },
            Self::SnakeCharmer => SnvCharacterMetadata {
                kind: CharacterKind::Townsfolk,
                first_night_rank: Some(3),
                later_night_rank: Some(1),
                input: OnePlayer,
                support: automated,
                activity: WhileActive,
                once_per_ability_instance: false,
                same_night_acquisition: WakeIfOrderPending,
            },
            Self::Mathematician => SnvCharacterMetadata {
                kind: CharacterKind::Townsfolk,
                first_night_rank: Some(10),
                later_night_rank: Some(15),
                input: NoInput,
                support: manual,
                activity: WhileActive,
                once_per_ability_instance: false,
                same_night_acquisition: WakeIfOrderPending,
            },
            Self::Flowergirl => SnvCharacterMetadata {
                kind: CharacterKind::Townsfolk,
                first_night_rank: None,
                later_night_rank: Some(10),
                input: NoInput,
                support: automated,
                activity: WhileActive,
                once_per_ability_instance: false,
                same_night_acquisition: WakeIfOrderPending,
            },
            Self::TownCrier => SnvCharacterMetadata {
                kind: CharacterKind::Townsfolk,
                first_night_rank: None,
                later_night_rank: Some(11),
                input: NoInput,
                support: automated,
                activity: WhileActive,
                once_per_ability_instance: false,
                same_night_acquisition: WakeIfOrderPending,
            },
            Self::Oracle => SnvCharacterMetadata {
                kind: CharacterKind::Townsfolk,
                first_night_rank: None,
                later_night_rank: Some(12),
                input: Number,
                support: automated,
                activity: WhileActive,
                once_per_ability_instance: false,
                same_night_acquisition: WakeIfOrderPending,
            },
            Self::Savant => SnvCharacterMetadata {
                kind: CharacterKind::Townsfolk,
                first_night_rank: None,
                later_night_rank: None,
                input: NoInput,
                support: manual,
                activity: WhileActive,
                once_per_ability_instance: false,
                same_night_acquisition: NextPhase,
            },
            Self::Seamstress => SnvCharacterMetadata {
                kind: CharacterKind::Townsfolk,
                first_night_rank: Some(9),
                later_night_rank: Some(13),
                input: TwoPlayers,
                support: automated,
                activity: WhileActive,
                once_per_ability_instance: true,
                same_night_acquisition: WakeIfOrderPending,
            },
            Self::Philosopher => SnvCharacterMetadata {
                kind: CharacterKind::Townsfolk,
                first_night_rank: Some(0),
                later_night_rank: Some(0),
                input: NoInput,
                support: manual,
                activity: WhileActive,
                once_per_ability_instance: false,
                same_night_acquisition: WakeIfOrderPending,
            },
            Self::Artist => SnvCharacterMetadata {
                kind: CharacterKind::Townsfolk,
                first_night_rank: None,
                later_night_rank: None,
                input: NoInput,
                support: manual,
                activity: WhileActive,
                once_per_ability_instance: true,
                same_night_acquisition: NextPhase,
            },
            Self::Juggler => SnvCharacterMetadata {
                kind: CharacterKind::Townsfolk,
                first_night_rank: None,
                later_night_rank: Some(14),
                input: Number,
                support: automated,
                activity: WhileActive,
                once_per_ability_instance: true,
                same_night_acquisition: TriggerIfEligible,
            },
            Self::Sage => SnvCharacterMetadata {
                kind: CharacterKind::Townsfolk,
                first_night_rank: None,
                later_night_rank: Some(8),
                input: NoInput,
                support: automated,
                activity: KilledByDemon,
                once_per_ability_instance: false,
                same_night_acquisition: TriggerIfEligible,
            },
            Self::Mutant => SnvCharacterMetadata {
                kind: CharacterKind::Outsider,
                first_night_rank: None,
                later_night_rank: None,
                input: NoInput,
                support: manual,
                activity: WhileActive,
                once_per_ability_instance: false,
                same_night_acquisition: NextPhase,
            },
            Self::Sweetheart => SnvCharacterMetadata {
                kind: CharacterKind::Outsider,
                first_night_rank: None,
                later_night_rank: Some(7),
                input: NoInput,
                support: manual,
                activity: OnDeath,
                once_per_ability_instance: false,
                same_night_acquisition: TriggerIfEligible,
            },
            Self::Barber => SnvCharacterMetadata {
                kind: CharacterKind::Outsider,
                first_night_rank: None,
                later_night_rank: Some(6),
                input: NoInput,
                support: manual,
                activity: OnDeath,
                once_per_ability_instance: false,
                same_night_acquisition: TriggerIfEligible,
            },
            Self::Klutz => SnvCharacterMetadata {
                kind: CharacterKind::Outsider,
                first_night_rank: None,
                later_night_rank: None,
                input: NoInput,
                support: manual,
                activity: OnDeath,
                once_per_ability_instance: false,
                same_night_acquisition: NextPhase,
            },
            Self::EvilTwin => SnvCharacterMetadata {
                kind: CharacterKind::Minion,
                first_night_rank: Some(4),
                later_night_rank: None,
                input: OnePlayer,
                support: automated,
                activity: WhileActive,
                once_per_ability_instance: false,
                same_night_acquisition: StartKnowingImmediately,
            },
            Self::Witch => SnvCharacterMetadata {
                kind: CharacterKind::Minion,
                first_night_rank: Some(5),
                later_night_rank: Some(2),
                input: OnePlayer,
                support: automated,
                activity: WhileActive,
                once_per_ability_instance: false,
                same_night_acquisition: WakeIfOrderPending,
            },
            Self::Cerenovus => SnvCharacterMetadata {
                kind: CharacterKind::Minion,
                first_night_rank: Some(6),
                later_night_rank: Some(3),
                input: MadnessAssignment,
                support: automated,
                activity: WhileActive,
                once_per_ability_instance: false,
                same_night_acquisition: WakeIfOrderPending,
            },
            Self::PitHag => SnvCharacterMetadata {
                kind: CharacterKind::Minion,
                first_night_rank: None,
                later_night_rank: Some(4),
                input: CharacterTransformation,
                support: automated,
                activity: WhileActive,
                once_per_ability_instance: false,
                same_night_acquisition: WakeIfOrderPending,
            },
            Self::FangGu => SnvCharacterMetadata {
                kind: CharacterKind::Demon,
                first_night_rank: None,
                later_night_rank: Some(5),
                input: OnePlayer,
                support: automated,
                activity: WhileActive,
                once_per_ability_instance: false,
                same_night_acquisition: WakeIfOrderPending,
            },
            Self::Vigormortis => SnvCharacterMetadata {
                kind: CharacterKind::Demon,
                first_night_rank: None,
                later_night_rank: Some(5),
                input: OnePlayer,
                support: automated,
                activity: WhileActive,
                once_per_ability_instance: false,
                same_night_acquisition: WakeIfOrderPending,
            },
            Self::NoDashii => SnvCharacterMetadata {
                kind: CharacterKind::Demon,
                first_night_rank: None,
                later_night_rank: Some(5),
                input: OnePlayer,
                support: automated,
                activity: WhileActive,
                once_per_ability_instance: false,
                same_night_acquisition: WakeIfOrderPending,
            },
            Self::Vortox => SnvCharacterMetadata {
                kind: CharacterKind::Demon,
                first_night_rank: None,
                later_night_rank: Some(5),
                input: OnePlayer,
                support: automated,
                activity: WhileActive,
                once_per_ability_instance: false,
                same_night_acquisition: WakeIfOrderPending,
            },
        }
    }
}

fn characters_of_kind(kind: CharacterKind) -> impl Iterator<Item = SnvCharacterId> {
    SnvCharacterId::ALL
        .into_iter()
        .filter(move |character| character.metadata().kind == kind)
}

fn is_demon(character: &str) -> bool {
    SnvCharacterId::parse(character).is_some_and(|id| id.metadata().kind == CharacterKind::Demon)
}

fn script_character_ids() -> Vec<String> {
    SnvCharacterId::ALL
        .iter()
        .map(|character| character.as_str().to_string())
        .collect()
}

fn legal_demon_bluff_character_ids(players: &[Player]) -> Vec<String> {
    let assigned = players
        .iter()
        .map(|player| player.actual_character.as_str())
        .collect::<HashSet<_>>();
    SnvCharacterId::ALL
        .iter()
        .copied()
        .filter(|character| {
            matches!(
                character.metadata().kind,
                CharacterKind::Townsfolk | CharacterKind::Outsider
            ) && !assigned.contains(character.as_str())
        })
        .map(|character| character.as_str().to_string())
        .collect()
}

pub(crate) fn phase_input_suggestion_pool(step: &PhaseStep, players: &[Player]) -> Vec<StepInput> {
    if !step.id.ends_with(":demonInfo")
        || step.required_input.kind != RequiredInputKind::CharacterIds
    {
        return Vec::new();
    }
    let legal = legal_demon_bluff_character_ids(players);
    let mut suggestions = Vec::new();
    for first in 0..legal.len() {
        for second in (first + 1)..legal.len() {
            for third in (second + 1)..legal.len() {
                suggestions.push(Some(crate::model::StepInputFields {
                    character_ids: Some(vec![
                        legal[first].clone(),
                        legal[second].clone(),
                        legal[third].clone(),
                    ]),
                    ..crate::model::StepInputFields::default()
                }));
            }
        }
    }
    suggestions
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
        value.is_empty() || (value.trim() == value && value.chars().count() <= max)
    };
    match record {
        DayActionRecord::Artist {
            question,
            answer: ArtistAnswer::Yes | ArtistAnswer::No | ArtistAnswer::Unknown,
            ..
        } => {
            if !valid_text(question, 500) {
                return Err(ErrorKind::InvalidDayActionRecord.into_error());
            }
        }
        DayActionRecord::Savant { statements } => {
            if statements
                .iter()
                .any(|statement| !valid_text(&statement.text, 500))
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

fn validate_day_action_truth(
    record: &DayActionRecord,
    active_reasons: &[DeliveryReason],
) -> Result<(), CoreError> {
    let vortox_active = active_reasons
        .iter()
        .any(|reason| matches!(reason, DeliveryReason::Vortox { .. }));
    let impaired = active_reasons.iter().any(|reason| {
        matches!(
            reason,
            DeliveryReason::Drunk | DeliveryReason::Poisoned { .. }
        )
    });
    match record {
        DayActionRecord::Artist { truthful, .. } => {
            if (*truthful && vortox_active) || (!*truthful && !vortox_active && !impaired) {
                return Err(ErrorKind::InvalidDayActionRecord.into_error());
            }
        }
        DayActionRecord::Savant { statements } => {
            let truthful_count = statements
                .iter()
                .filter(|statement| statement.truthful)
                .count();
            if (vortox_active && truthful_count != 0)
                || (!vortox_active && !impaired && truthful_count != 1)
            {
                return Err(ErrorKind::InvalidDayActionRecord.into_error());
            }
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
    let step = SnvStepKey::parse(step_id)?;
    match step.phase() {
        SnvPhaseKey::FirstNight | SnvPhaseKey::Day(1) => Some("day".into()),
        SnvPhaseKey::Day(cycle) => Some(format!("day{cycle}")),
        SnvPhaseKey::Night(cycle) => Some(format!("day{}", cycle + 1)),
    }
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
    let expected_reasons =
        day_action_active_reasons(actor, expected_character, players, prior_events);
    if payload.active_reasons != expected_reasons {
        return Err(ErrorKind::InvalidDayActionRecord.into_error());
    }
    validate_day_action_truth(&payload.record, &expected_reasons)?;
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
            active_reasons: day_action_active_reasons(
                player,
                &player.actual_character,
                players,
                events,
            ),
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
                active_reasons: payload.active_reasons.clone(),
                record: payload.record.clone(),
            }),
            _ => None,
        })
        .collect()
}

fn madness_execution_death_step_id(event_id: &str, interrupted_step_id: &str) -> String {
    let prefix = SnvStepKey::parse(interrupted_step_id).map_or("night", |step| step.phase_token());
    format!("{prefix}:madnessExecution:{event_id}:executionDeath")
}

fn pending_madness_execution_event(
    events: &[GameEvent],
) -> Option<(&GameEvent, &MadnessExecutionConfirmedPayload)> {
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
            SnvStepKey::parse(&payload.step_id).is_some_and(|step| step.is_in_phase(day_id))
        }
        GameEventKind::MadnessExecutionConfirmed { payload } => {
            SnvStepKey::parse(&payload.interrupted_step_id)
                .is_some_and(|step| step.is_in_phase(day_id))
        }
        GameEventKind::NominationStarted { payload }
            if matches!(
                payload.virgin_resolution,
                VirginResolution::SpentAndNominatorExecuted { .. }
            ) =>
        {
            SnvStepKey::parse(&payload.step_id).is_some_and(|step| step.is_in_phase(day_id))
        }
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
        .and_then(|step| SnvStepKey::parse(&step.id))
        .map(|step| step.phase_token());
    let execution_already_occurred =
        current_day_id.is_some_and(|day_id| day_execution_occurred(day_id, events));
    let ability_state = SnvAbilityState::build(players, events);
    let impaired_players = ability_state
        .active_impairments
        .iter()
        .map(|impairment| impairment.player_id.clone())
        .collect::<HashSet<_>>();

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
    SnvCharacterId::parse(character).map(|id| id.metadata().kind)
}

fn nearest_townsfolk_neighbors(players: &[Player], source_player_id: &str) -> Vec<String> {
    let mut seated = players.iter().collect::<Vec<_>>();
    seated.sort_by_key(|player| player.seat);
    let Some(source_index) = seated
        .iter()
        .position(|player| player.id == source_player_id)
    else {
        return vec![];
    };
    let mut neighbors = Vec::new();
    for direction in [1_isize, -1_isize] {
        for distance in 1..seated.len() {
            let index = (source_index as isize + direction * distance as isize)
                .rem_euclid(seated.len() as isize) as usize;
            let candidate = seated[index];
            if character_kind(&candidate.actual_character) == Some(CharacterKind::Townsfolk) {
                if !neighbors.iter().any(|id| id == &candidate.id) {
                    neighbors.push(candidate.id.clone());
                }
                break;
            }
        }
    }
    neighbors.sort_by_key(|id| {
        players
            .iter()
            .find(|player| player.id == *id)
            .map_or(u8::MAX, |player| player.seat)
    });
    neighbors
}

fn vigormortis_dependent_player_selections(
    players: &[Player],
) -> Vec<crate::model::DependentPlayerSelection> {
    players
        .iter()
        .filter(|player| {
            player.alive && character_kind(&player.actual_character) == Some(CharacterKind::Minion)
        })
        .map(|minion| crate::model::DependentPlayerSelection {
            trigger_player_id: minion.id.clone(),
            selection_index: 1,
            allowed_player_ids: nearest_townsfolk_neighbors(players, &minion.id),
        })
        .collect()
}

fn character_step(
    phase: Phase,
    prefix: &str,
    character: &str,
    player: &Player,
    players: &[Player],
) -> PhaseStep {
    let character_id = SnvCharacterId::parse(character).expect("validated S&V character");
    let metadata = character_id.metadata();
    let snake_charmer = character_id == SnvCharacterId::SnakeCharmer;
    let pit_hag = character_id == SnvCharacterId::PitHag;
    let targeted_information = matches!(
        character_id,
        SnvCharacterId::Dreamer | SnvCharacterId::Seamstress
    );
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
        required_input: if metadata.input == CharacterInputPolicy::CharacterTransformation {
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
                dependent_player_selections: vec![],
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
        } else if metadata.input == CharacterInputPolicy::MadnessAssignment {
            RequiredInput {
                kind: RequiredInputKind::MadnessAssignment,
                target: Some(InputTarget::Player),
                min_selections: Some(1),
                max_selections: Some(1),
                setup_info: None,
                character_kind: None,
                allowed_character_ids: Some(
                    characters_of_kind(CharacterKind::Townsfolk)
                        .chain(characters_of_kind(CharacterKind::Outsider))
                        .map(|id| id.as_str().to_string())
                        .collect(),
                ),
                allowed_player_ids: Some(
                    players
                        .iter()
                        .map(|candidate| candidate.id.clone())
                        .collect(),
                ),
                dependent_player_selections: vec![],
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
        } else if matches!(
            metadata.input,
            CharacterInputPolicy::OnePlayer | CharacterInputPolicy::TwoPlayers
        ) {
            let selections = if metadata.input == CharacterInputPolicy::TwoPlayers {
                2
            } else {
                1
            };
            let vigormortis = character_id == SnvCharacterId::Vigormortis;
            let evil_twin = character_id == SnvCharacterId::EvilTwin;
            let witch = character_id == SnvCharacterId::Witch;
            RequiredInput {
                kind: RequiredInputKind::PlayerIds,
                target: Some(InputTarget::Player),
                min_selections: Some(selections),
                max_selections: Some(if vigormortis { 2 } else { selections }),
                setup_info: None,
                character_kind: None,
                allowed_character_ids: None,
                allowed_player_ids: Some(
                    players
                        .iter()
                        .filter(|candidate| {
                            witch
                                || evil_twin
                                    && candidate.id != player.id
                                    && candidate.alignment != player.alignment
                                || snake_charmer && candidate.alive
                                || targeted_information && candidate.id != player.id
                                || metadata.kind == CharacterKind::Demon
                        })
                        .map(|candidate| candidate.id.clone())
                        .collect(),
                ),
                dependent_player_selections: if vigormortis {
                    vigormortis_dependent_player_selections(players)
                } else {
                    vec![]
                },
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
        } else if metadata.input == CharacterInputPolicy::Number {
            RequiredInput {
                kind: RequiredInputKind::Number,
                target: Some(InputTarget::Number),
                ..required_none()
            }
        } else {
            required_none()
        },
        can_skip: character_id == SnvCharacterId::Seamstress,
        support: metadata.support,
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
        GameEventKind::BarberConsequenceResolved { payload }
            if event.id == player.ability_instance.source_event_id
                && matches!(
                    &payload.outcome,
                    BarberConsequenceOutcome::Swapped {
                        identity_transitions
                    } if identity_transitions
                        .iter()
                        .any(|transition| transition.player_id == player.id)
                ) =>
        {
            Some((event, payload.step_id.as_str(), "barber"))
        }
        GameEventKind::NightActionResolved { payload }
            if event.id == player.ability_instance.source_event_id =>
        {
            match &payload.resolution {
                NightActionResolution::DemonAttack {
                    outcome:
                        DemonAttackOutcome::FangGuJump {
                            identity_transition,
                            ..
                        },
                    ..
                } if identity_transition.player_id == player.id => {
                    Some((event, payload.step_id.as_str(), "fangGu"))
                }
                _ => None,
            }
        }
        _ => None,
    })
}

fn ability_is_base_for_phase(player: &Player, prefix: &str, events: &[GameEvent]) -> bool {
    let Some((_, step_id, _)) = transition_source(player, events) else {
        return true;
    };
    let Some(source_step) = SnvStepKey::parse(step_id) else {
        return false;
    };
    phase_prefix_order(source_step.phase_token())
        .is_some_and(|source| phase_prefix_order(prefix).is_some_and(|target| source < target))
}

fn later_night_wake_rank(character: &str) -> Option<usize> {
    SnvCharacterId::parse(character)?
        .metadata()
        .later_night_rank
        .map(usize::from)
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
                        .and_then(SnvStepKey::parse)
                        .map(|step| step.phase_token())
                        .is_some_and(|event_prefix| {
                            event_prefix == prefix || event_prefix == day_prefix
                        })
            }
            GameEventKind::NightActionResolved { payload }
                if SnvStepKey::parse(&payload.step_id)
                    .is_some_and(|step| step.is_in_phase(prefix)) =>
            {
                matches!(
                    &payload.resolution,
                    NightActionResolution::DemonAttack {
                        outcome: DemonAttackOutcome::Deaths { deaths, .. },
                        ..
                    } if deaths.iter().any(|death| death.player_id == player.id)
                ) || matches!(
                    &payload.resolution,
                    NightActionResolution::DemonAttack {
                        outcome: DemonAttackOutcome::FangGuJump { death, .. },
                        ..
                    } if death.player_id == player.id
                )
            }
            GameEventKind::PitHagArbitraryDeathsConfirmed { payload }
                if SnvStepKey::parse(&payload.step_id)
                    .is_some_and(|step| step.is_in_phase(prefix)) =>
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
    ability_state: &SnvAbilityState,
    events: &[GameEvent],
) -> bool {
    let Some(metadata) = SnvCharacterId::parse(character).map(SnvCharacterId::metadata) else {
        return false;
    };
    match metadata.activity {
        AbilityActivityPolicy::OnDeath => death_triggered_in_night_window(player, prefix, events),
        AbilityActivityPolicy::KilledByDemon => sage_killer(prefix, player, events).is_some(),
        AbilityActivityPolicy::WhileActive if character == SnvCharacterId::Juggler.as_str() => {
            ability_state.has_active_ability(player)
                && juggler_correct_count_for_night(prefix, player, events).is_some()
        }
        AbilityActivityPolicy::WhileActive => ability_state.has_active_ability(player),
    }
}

fn insert_acquired_ability_steps(
    steps: &mut Vec<PhaseStep>,
    phase: Phase,
    prefix: &str,
    players: &[Player],
    events: &[GameEvent],
) {
    let ability_state = SnvAbilityState::build(players, events);
    let acquisitions = players
        .iter()
        .filter_map(|player| {
            let (event, step_id, source_character) = transition_source(player, events)?;
            if !SnvStepKey::parse(step_id)?.is_in_phase(prefix) {
                return None;
            }
            Some((player, event, step_id, source_character))
        })
        .collect::<Vec<_>>();

    for (player, event, source_step_id, source_character) in acquisitions {
        let character = player.actual_character.as_str();
        if character == "witch" && players.iter().filter(|player| player.alive).count() == 3 {
            continue;
        }
        if !acquired_ability_is_available(player, character, prefix, &ability_state, events) {
            continue;
        }
        let metadata = SnvCharacterId::parse(character)
            .expect("validated S&V character")
            .metadata();
        let start_knowing = matches!(
            metadata.same_night_acquisition,
            SameNightAcquisitionPolicy::StartKnowingImmediately
        );
        let should_run = match metadata.same_night_acquisition {
            SameNightAcquisitionPolicy::StartKnowingImmediately => true,
            SameNightAcquisitionPolicy::WakeIfOrderPending
            | SameNightAcquisitionPolicy::TriggerIfEligible
                if phase == Phase::Night =>
            {
                match (
                    later_night_wake_rank(source_character),
                    later_night_wake_rank(character),
                ) {
                    (Some(source), Some(target)) => target > source,
                    _ => false,
                }
            }
            SameNightAcquisitionPolicy::WakeIfOrderPending
            | SameNightAcquisitionPolicy::TriggerIfEligible
            | SameNightAcquisitionPolicy::NextPhase => false,
        };
        if !should_run {
            continue;
        }

        let mut step = character_step(phase, prefix, character, player, players);
        if is_demon(character) {
            let uses_vigormortis_poison_target =
                character == "vigormortis" && pit_hag_demon_creation(events, prefix).is_none();
            step.required_input = RequiredInput {
                kind: RequiredInputKind::PlayerIds,
                target: Some(InputTarget::Player),
                min_selections: Some(1),
                max_selections: Some(if uses_vigormortis_poison_target { 2 } else { 1 }),
                allowed_player_ids: Some(
                    players
                        .iter()
                        .map(|candidate| candidate.id.clone())
                        .collect(),
                ),
                dependent_player_selections: if uses_vigormortis_poison_target {
                    vigormortis_dependent_player_selections(players)
                } else {
                    vec![]
                },
                ..required_none()
            };
            step.support = PhaseStepSupport::Automated;
        }
        step.id = if is_demon(character) {
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
                SnvStepKey::parse(&step.id)
                    .is_some_and(|key| key.semantic_step() == SnvSemanticStep::ToDay)
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

fn insert_evil_twin_repair_steps(
    steps: &mut Vec<PhaseStep>,
    phase: Phase,
    prefix: &str,
    players: &[Player],
    events: &[GameEvent],
) {
    let ability_state = SnvAbilityState::build(players, events);
    let mut latest =
        HashMap::<AbilityInstanceId, (&GameEvent, &EvilTwinPairAssignedPayload)>::new();
    for event in events {
        if let GameEventKind::EvilTwinPairAssigned { payload } = &event.kind {
            latest.insert(payload.source_ability_instance_id.clone(), (event, payload));
        }
    }
    let mut repairs = latest
        .into_values()
        .filter_map(|(pair_event, pair)| {
            let actor = players.iter().find(|player| {
                player.id == pair.actor_player_id
                    && player.actual_character == "evilTwin"
                    && player.ability_instance.id == pair.source_ability_instance_id
                    && player.alive
                    && !ability_state.is_impaired(&player.id)
            })?;
            let twin = players
                .iter()
                .find(|player| player.id == pair.twin_player_id)?;
            let has_opposing_candidate = players.iter().any(|candidate| {
                candidate.id != actor.id && candidate.alignment != actor.alignment
            });
            (actor.alignment == twin.alignment && has_opposing_candidate).then(|| {
                let mut step = character_step(phase, prefix, "evilTwin", actor, players);
                step.id = format!("{prefix}:ability:{}:{}:evilTwin", pair_event.id, actor.id);
                (actor.seat, step)
            })
        })
        .collect::<Vec<_>>();
    repairs.sort_by_key(|(seat, _)| *seat);
    for (_, step) in repairs {
        let insert_at = steps
            .iter()
            .position(|candidate| {
                SnvStepKey::parse(&candidate.id)
                    .is_some_and(|key| key.semantic_step() == SnvSemanticStep::ToDay)
            })
            .unwrap_or(steps.len());
        steps.insert(insert_at, step);
    }
}

fn demon_step(players: &[Player], events: &[GameEvent], prefix: &str) -> Option<PhaseStep> {
    let resolved_actor = events.iter().find_map(|event| match &event.kind {
        GameEventKind::NightActionResolved { payload }
            if SnvStepKey::parse(&payload.step_id).is_some_and(|step| {
                step.is_in_phase(prefix)
                    && matches!(step.semantic_step(), SnvSemanticStep::Demon { .. })
            }) =>
        {
            payload
                .actor_character_id
                .as_ref()
                .map(|character| (payload.actor_player_id.as_str(), character.as_str()))
        }
        GameEventKind::ManualPhaseStepResolved { payload }
            if SnvStepKey::parse(&payload.step_id).is_some_and(|step| step.is_in_phase(prefix))
                && characters_of_kind(CharacterKind::Demon).any(|demon| {
                    SnvStepKey::parse(&payload.step_id)
                        .is_some_and(|step| step.tail() == demon.as_str())
                }) =>
        {
            players
                .iter()
                .find(|player| {
                    SnvStepKey::parse(&payload.step_id)
                        .is_some_and(|step| step.tail() == player.actual_character)
                })
                .map(|player| (player.id.as_str(), player.actual_character.as_str()))
        }
        _ => None,
    });
    let (actor, character) = resolved_actor.or_else(|| {
        players
            .iter()
            .find(|player| {
                player.alive
                    && is_demon(&player.actual_character)
                    && ability_is_base_for_phase(player, prefix, events)
            })
            .map(|player| (player.id.as_str(), player.actual_character.as_str()))
    })?;
    let uses_vigormortis_poison_target =
        character == "vigormortis" && pit_hag_demon_creation(events, prefix).is_none();
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
            max_selections: Some(if uses_vigormortis_poison_target { 2 } else { 1 }),
            setup_info: None,
            character_kind: None,
            allowed_character_ids: None,
            allowed_player_ids: Some(players.iter().map(|player| player.id.clone()).collect()),
            dependent_player_selections: if uses_vigormortis_poison_target {
                vigormortis_dependent_player_selections(players)
            } else {
                vec![]
            },
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
            if SnvStepKey::parse(&payload.step_id).is_some_and(|step| {
                step.is_in_phase(prefix)
                    && matches!(step.semantic_step(), SnvSemanticStep::PitHag { .. })
            }) =>
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
            dependent_player_selections: vec![],
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
    let ability_state = SnvAbilityState::build(players, events);
    let mut steps = Vec::new();
    let mut scheduled_characters = SnvCharacterId::ALL
        .iter()
        .copied()
        .filter(|character| character.metadata().later_night_rank.is_some())
        .collect::<Vec<_>>();
    scheduled_characters.sort_by_key(|character| character.metadata().later_night_rank);
    for character_id in scheduled_characters
        .iter()
        .copied()
        .filter(|character| character.metadata().later_night_rank < Some(5))
    {
        let character = character_id.as_str();
        let mut matching = players
            .iter()
            .filter(|player| {
                player.actual_character == character
                    && ability_is_base_for_phase(player, &prefix, events)
                    && ability_state.has_active_ability(player)
                    && (character != "witch"
                        || players.iter().filter(|candidate| candidate.alive).count() != 3)
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
    for character_id in scheduled_characters
        .iter()
        .copied()
        .filter(|character| character.metadata().later_night_rank > Some(5))
    {
        let character = character_id.as_str();
        let metadata = character_id.metadata();
        let mut matching = players
            .iter()
            .filter(|player| {
                player.actual_character == character
                    && ability_is_base_for_phase(player, &prefix, events)
                    && match metadata.activity {
                        AbilityActivityPolicy::OnDeath => {
                            death_triggered_in_night_window(player, &prefix, events)
                                && (character != "sweetheart"
                                    || !events.iter().any(|event| {
                                        matches!(
                                            &event.kind,
                                            GameEventKind::SweetheartConsequenceResolved { payload }
                                                if payload.trigger.source_ability_instance_id
                                                    == player.ability_instance.id
                                        )
                                    }))
                        }
                        AbilityActivityPolicy::KilledByDemon => {
                            sage_killer(&prefix, player, events).is_some()
                        }
                        AbilityActivityPolicy::WhileActive => {
                            ability_state.has_active_ability(player)
                        }
                    }
                    && (character_id != SnvCharacterId::Juggler
                        || juggler_correct_count_for_night(&prefix, player, events).is_some())
                    && (!metadata.once_per_ability_instance
                        || !ability_instance_already_used(character_id, player, events))
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
    insert_evil_twin_repair_steps(&mut steps, Phase::Night, &prefix, players, events);
    if let Some(step) = pit_hag_arbitrary_deaths_step(players, events, &prefix) {
        let insert_at = steps
            .iter()
            .position(|candidate| {
                SnvStepKey::parse(&candidate.id)
                    .is_some_and(|key| key.semantic_step() == SnvSemanticStep::ToDay)
            })
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
    let players_for = |character_id: SnvCharacterId| {
        let character = character_id.as_str();
        let mut matching = players
            .iter()
            .filter(|player| {
                player.actual_character == character
                    && ability_is_base_for_phase(player, "firstNight", events)
                    && ((character_id != SnvCharacterId::Clockmaker || player.alive)
                        && (character_id != SnvCharacterId::SnakeCharmer
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

    for player in players_for(SnvCharacterId::Philosopher) {
        steps.push(character_step(
            Phase::FirstNight,
            "firstNight",
            SnvCharacterId::Philosopher.as_str(),
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
            required_characters(3, 3, Some(legal_demon_bluff_character_ids(players)), true),
            false,
        ));
    }
    let mut scheduled_characters = SnvCharacterId::ALL
        .iter()
        .copied()
        .filter(|character| {
            character
                .metadata()
                .first_night_rank
                .is_some_and(|rank| rank >= 3)
        })
        .collect::<Vec<_>>();
    scheduled_characters.sort_by_key(|character| character.metadata().first_night_rank);
    for character_id in scheduled_characters {
        for player in players_for(character_id) {
            steps.push(character_step(
                Phase::FirstNight,
                "firstNight",
                character_id.as_str(),
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
                && SnvStepKey::parse(&payload.step_id).is_some_and(|step| {
                    step.is_in_phase(prefix)
                        && matches!(step.semantic_step(), SnvSemanticStep::SnakeCharmer { .. })
                }) =>
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
                | "juggler"
                | "seamstress"
                | "sage"
        )
    )
}

fn preceding_day_prefix(step_id: &str) -> Option<String> {
    let SnvPhaseKey::Night(cycle) = SnvStepKey::parse(step_id)?.phase() else {
        return None;
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

#[derive(Default)]
struct DayRoleActionIndex {
    demon_vote_prefixes: HashSet<String>,
    minion_nomination_prefixes: HashSet<String>,
}

impl DayRoleActionIndex {
    fn record(&mut self, event: &GameEvent, players: &[Player]) -> Result<(), CoreError> {
        let (step_id, candidate_ids, role) = match &event.kind {
            GameEventKind::NominationVoteConfirmed { payload } => (
                payload.step_id.as_str(),
                payload.voter_ids.as_slice(),
                CharacterKind::Demon,
            ),
            GameEventKind::NominationStarted { payload } => (
                payload.step_id.as_str(),
                std::slice::from_ref(&payload.nominator_id),
                CharacterKind::Minion,
            ),
            _ => return Ok(()),
        };
        if candidate_ids.iter().any(|player_id| {
            players.iter().any(|player| {
                player.id == *player_id && character_kind(&player.actual_character) == Some(role)
            })
        }) {
            let prefix = step_prefix(step_id)?;
            match role {
                CharacterKind::Demon => {
                    self.demon_vote_prefixes.insert(prefix);
                }
                CharacterKind::Minion => {
                    self.minion_nomination_prefixes.insert(prefix);
                }
                CharacterKind::Townsfolk | CharacterKind::Outsider => unreachable!(),
            }
        }
        Ok(())
    }

    fn contains(&self, prefix: &str, role: CharacterKind) -> bool {
        match role {
            CharacterKind::Demon => self.demon_vote_prefixes.contains(prefix),
            CharacterKind::Minion => self.minion_nomination_prefixes.contains(prefix),
            CharacterKind::Townsfolk | CharacterKind::Outsider => false,
        }
    }
}

fn preceding_day_role_action(
    step: &PhaseStep,
    day_role_actions: &DayRoleActionIndex,
    role: CharacterKind,
) -> Result<bool, CoreError> {
    let prefix =
        preceding_day_prefix(&step.id).ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
    Ok(day_role_actions.contains(&prefix, role))
}

fn automatic_information_reminders(
    phase: Phase,
    current_step: Option<&PhaseStep>,
    players: &[Player],
    day_role_actions: &DayRoleActionIndex,
) -> Result<Vec<AutomaticReminder>, CoreError> {
    let Some(step) = current_step else {
        return Ok(vec![]);
    };
    let day_prefix = match phase {
        Phase::Day => SnvStepKey::parse(&step.id).map(|key| key.phase_token().to_string()),
        Phase::Night => preceding_day_prefix(&step.id),
        _ => None,
    };
    let Some(day_prefix) = day_prefix else {
        return Ok(vec![]);
    };
    let demon_voted = day_role_actions.contains(&day_prefix, CharacterKind::Demon);
    let minion_nominated = day_role_actions.contains(&day_prefix, CharacterKind::Minion);
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

fn automatic_vigormortis_reminders(
    players: &[Player],
    ability_state: &SnvAbilityState,
) -> Vec<AutomaticReminder> {
    players
        .iter()
        .filter(|player| {
            !player.alive
                && ability_state
                    .retained_minion_player_ids
                    .contains(&player.id)
        })
        .map(|player| AutomaticReminder {
            player_id: player.id.clone(),
            character_id: "vigormortis".into(),
            token_id: "hasAbility".into(),
            label: "능력 있음".into(),
            description: "비고르모르티스에게 죽었지만 하수인 능력을 유지합니다.".into(),
        })
        .collect()
}

fn automatic_fang_gu_reminder(events: &[GameEvent]) -> Vec<AutomaticReminder> {
    events
        .iter()
        .find_map(|event| match &event.kind {
            GameEventKind::NightActionResolved { payload } => match &payload.resolution {
                NightActionResolution::DemonAttack {
                    outcome:
                        DemonAttackOutcome::FangGuJump {
                            identity_transition,
                            ..
                        },
                    ..
                } => Some(AutomaticReminder {
                    player_id: identity_transition.player_id.clone(),
                    character_id: "fangGu".into(),
                    token_id: "once".into(),
                    label: "한 번".into(),
                    description: "첫 외지인 이동이 사용되었습니다.".into(),
                }),
                _ => None,
            },
            _ => None,
        })
        .into_iter()
        .collect()
}

fn snv_information_result(
    step: &PhaseStep,
    players: &[Player],
    events: &[GameEvent],
    day_role_actions: &DayRoleActionIndex,
) -> Result<Option<InformationResult>, CoreError> {
    Ok(match step.character.as_deref() {
        Some("clockmaker") => clockmaker_distance(players).map(|value| InformationResult::Number {
            value: value as u64,
        }),
        Some("flowergirl") => Some(InformationResult::Boolean {
            value: preceding_day_role_action(step, day_role_actions, CharacterKind::Demon)?,
        }),
        Some("townCrier") => Some(InformationResult::Boolean {
            value: preceding_day_role_action(step, day_role_actions, CharacterKind::Minion)?,
        }),
        Some("oracle") => Some(InformationResult::Number {
            value: players
                .iter()
                .filter(|player| !player.alive && player.alignment == Alignment::Evil)
                .count() as u64,
        }),
        Some("juggler") => step
            .player_id
            .as_deref()
            .and_then(|player_id| players.iter().find(|player| player.id == player_id))
            .and_then(|player| {
                juggler_correct_count_for_night(
                    SnvStepKey::parse(&step.id).map_or("", |key| key.phase_token()),
                    player,
                    events,
                )
            })
            .map(|value| InformationResult::Number {
                value: u64::from(value),
            }),
        Some("sage") => step
            .player_id
            .as_deref()
            .and_then(|player_id| players.iter().find(|player| player.id == player_id))
            .and_then(|player| {
                sage_killer(
                    SnvStepKey::parse(&step.id).map_or("", |key| key.phase_token()),
                    player,
                    events,
                )
            })
            .map(|player_id| InformationResult::Player { player_id }),
        _ => None,
    })
}

fn snv_evil_information(
    step: &PhaseStep,
    players: &[Player],
    input: &StepInput,
) -> Result<ConfirmedInformation, CoreError> {
    let demon_player_ids = players
        .iter()
        .filter(|player| character_kind(&player.actual_character) == Some(CharacterKind::Demon))
        .map(|player| player.id.clone())
        .collect::<Vec<_>>();
    if demon_player_ids.len() != 1 {
        return Err(ErrorKind::InvalidEvilTeamState.into_error());
    }
    let minion_player_ids = players
        .iter()
        .filter(|player| character_kind(&player.actual_character) == Some(CharacterKind::Minion))
        .map(|player| player.id.clone())
        .collect::<Vec<_>>();
    let bluff_character_ids = if step.id.ends_with(":demonInfo") {
        input
            .as_ref()
            .and_then(|fields| fields.character_ids.clone())
            .ok_or_else(|| ErrorKind::MissingStepInput.into_error())?
    } else {
        Vec::new()
    };
    let result = InformationResult::TeamInfo {
        demon_player_ids,
        minion_player_ids,
        bluff_character_ids,
    };
    Ok(ConfirmedInformation {
        actor: None,
        target_player_ids: vec![],
        computed_result: Some(result.clone()),
        delivered_result: result,
        delivery_context: DeliveryContext::Fixed,
    })
}

fn snv_information_prompt(
    step: &PhaseStep,
    players: &[Player],
    events: &[GameEvent],
    day_role_actions: &DayRoleActionIndex,
) -> Result<Option<InformationPrompt>, CoreError> {
    let active_reasons = active_information_reasons(step, players, events);
    let impaired = !active_reasons.is_empty();
    let vortox_active = active_reasons
        .iter()
        .any(|reason| matches!(reason, DeliveryReason::Vortox { .. }));
    if matches!(step.character.as_deref(), Some("dreamer" | "seamstress")) {
        let target_checks = targeted_information_checks(step, players, impaired, vortox_active)?;
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
            number_constraint: None,
            boolean_choices: vec![],
            setup_info_registration_options: vec![],
            target_checks,
        }));
    }
    let Some(computed_result) = snv_information_result(step, players, events, day_role_actions)?
    else {
        return Ok(None);
    };
    if step.character.as_deref() == Some("sage") {
        let InformationResult::Player { player_id } = &computed_result else {
            return Err(ErrorKind::ReplayFailed.into_error());
        };
        let choices = sage_choices(players, player_id, impaired, vortox_active);
        return Ok(Some(InformationPrompt {
            computed_result: Some(computed_result.clone()),
            delivery_mode: InformationDeliveryMode::Selectable,
            active_reasons,
            registration_candidate_player_ids: vec![],
            number_choices: vec![],
            number_constraint: None,
            boolean_choices: vec![],
            setup_info_registration_options: vec![],
            target_checks: vec![TargetInformationCheck {
                target_player_ids: vec![],
                computed_result,
                choices,
            }],
        }));
    }
    let (number_choices, number_constraint, boolean_choices) = match computed_result {
        InformationResult::Number { value } => (
            if impaired && !vortox_active {
                let range = if step.character.as_deref() == Some("clockmaker") {
                    1..=players.len() / 2
                } else if step.character.as_deref() == Some("juggler") {
                    0..=5
                } else {
                    0..=players.iter().filter(|player| !player.alive).count()
                };
                range
                    .map(|candidate| NumberInformationChoice {
                        value: candidate as u64,
                        is_computed: candidate as u64 == value,
                        registration_judgments: vec![],
                    })
                    .collect()
            } else if vortox_active {
                vec![]
            } else {
                vec![NumberInformationChoice {
                    value,
                    is_computed: true,
                    registration_judgments: vec![],
                }]
            },
            vortox_active.then(|| NumberInformationConstraint {
                min: 0,
                max: crate::model::MAX_SAFE_INFORMATION_NUMBER,
                excluded_values: vec![value],
            }),
            vec![],
        ),
        InformationResult::Boolean { value } => (
            vec![],
            None,
            if impaired {
                [false, true]
                    .into_iter()
                    .filter(|candidate| !vortox_active || *candidate != value)
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
        number_constraint,
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
    active_reasons_for_actor(
        step.character.as_deref(),
        step.player_id.as_deref(),
        players,
        events,
    )
}

fn day_action_active_reasons(
    actor: &Player,
    character_id: &str,
    players: &[Player],
    events: &[GameEvent],
) -> Vec<DeliveryReason> {
    if !matches!(character_id, "artist" | "savant") {
        return vec![];
    }
    active_reasons_for_actor(Some(character_id), Some(actor.id.as_str()), players, events)
}

fn active_reasons_for_actor(
    character_id: Option<&str>,
    actor_id: Option<&str>,
    players: &[Player],
    events: &[GameEvent],
) -> Vec<DeliveryReason> {
    let Some(actor_id) = actor_id else {
        return vec![];
    };
    let ability_state = SnvAbilityState::build(players, events);
    let mut reasons = ability_state
        .active_impairments
        .iter()
        .cloned()
        .filter(|impairment| impairment.player_id == actor_id)
        .filter_map(|impairment| {
            if impairment.kind == ImpairmentKind::Drunk {
                return Some(DeliveryReason::Drunk);
            }
            let poisoner_player_id = match impairment.source_character_id.as_str() {
                "snakeCharmer" => events.iter().find_map(|event| match &event.kind {
                    GameEventKind::SnakeCharmerActionResolved { payload }
                        if event.id == impairment.source_event_id =>
                    {
                        Some(payload.actor_player_id.clone())
                    }
                    _ => None,
                }),
                "vigormortis" => events.iter().find_map(|event| match &event.kind {
                    GameEventKind::NightActionResolved { payload }
                        if event.id == impairment.source_event_id =>
                    {
                        Some(payload.actor_player_id.clone())
                    }
                    _ => None,
                }),
                "noDashii" => players.iter().find_map(|player| {
                    let source_event_id = if player.ability_instance.source_event_id == "setup" {
                        events.first().map(|event| event.id.as_str())
                    } else {
                        Some(player.ability_instance.source_event_id.as_str())
                    };
                    (player.actual_character == "noDashii"
                        && source_event_id == Some(impairment.source_event_id.as_str()))
                    .then(|| player.id.clone())
                }),
                _ => None,
            }?;
            Some(DeliveryReason::Poisoned {
                poisoner_player_id,
                poison_event_id: impairment.source_event_id,
            })
        })
        .collect::<Vec<_>>();
    if character_id.and_then(character_kind) == Some(CharacterKind::Townsfolk) {
        if let Some(vortox) = players
            .iter()
            .find(|player| ability_state.ability_functions(player, "vortox"))
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
    day_role_actions: &DayRoleActionIndex,
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
            day_role_actions,
            input,
            delivered_result,
            registration_judgments,
        );
    }
    let Some(computed_result) = snv_information_result(step, players, events, day_role_actions)?
    else {
        return Ok(None);
    };
    if !registration_judgments.is_empty() {
        return Err(ErrorKind::InvalidRegistrationJudgment.into_error());
    }
    let reasons = active_information_reasons(step, players, events);
    let prompt = snv_information_prompt(step, players, events, day_role_actions)?
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
            InformationResult::Number { value } => prompt.number_constraint.as_ref().map_or_else(
                || {
                    prompt
                        .number_choices
                        .iter()
                        .any(|choice| choice.value == *value)
                },
                |constraint| {
                    *value >= constraint.min
                        && *value <= constraint.max
                        && !constraint.excluded_values.contains(value)
                },
            ),
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
    vortox_active: bool,
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
        let good_characters = SnvCharacterId::ALL
            .iter()
            .copied()
            .filter(|id| {
                matches!(
                    id.metadata().kind,
                    CharacterKind::Townsfolk | CharacterKind::Outsider
                )
            })
            .collect::<Vec<_>>();
        let evil_characters = SnvCharacterId::ALL
            .iter()
            .copied()
            .filter(|id| {
                matches!(
                    id.metadata().kind,
                    CharacterKind::Minion | CharacterKind::Demon
                )
            })
            .collect::<Vec<_>>();
        return Ok(candidates
            .into_iter()
            .map(|target| {
                let actual_good = matches!(
                    character_kind(&target.actual_character),
                    Some(CharacterKind::Townsfolk | CharacterKind::Outsider)
                );
                let choices = good_characters
                    .iter()
                    .flat_map(|good| {
                        evil_characters
                            .iter()
                            .filter(move |evil| {
                                let truthful = actual_good
                                    && good.as_str() == target.actual_character
                                    || !actual_good && evil.as_str() == target.actual_character;
                                (impaired || truthful) && (!vortox_active || !truthful)
                            })
                            .map(move |evil| {
                                let truthful = actual_good
                                    && good.as_str() == target.actual_character
                                    || !actual_good && evil.as_str() == target.actual_character;
                                TargetInformationChoice {
                                    result: InformationResult::CharacterPair {
                                        character_ids: vec![
                                            good.as_str().into(),
                                            evil.as_str().into(),
                                        ],
                                    },
                                    is_computed: truthful,
                                    registration_judgments: vec![],
                                }
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
                            .filter(|value| !vortox_active || *value != same)
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
    vortox_active: bool,
) -> Vec<TargetInformationChoice> {
    let mut choices = vec![];
    for first in players {
        for second in players {
            let truthful = first.id == killer_id || second.id == killer_id;
            if first.id == second.id || (!impaired && !truthful) || (vortox_active && truthful) {
                continue;
            }
            choices.push(TargetInformationChoice {
                result: InformationResult::PlayerPair {
                    player_ids: vec![first.id.clone(), second.id.clone()],
                },
                is_computed: truthful,
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
    day_role_actions: &DayRoleActionIndex,
    input: &StepInput,
    delivered_result: Option<InformationResult>,
    registration_judgments: &[crate::model::RegistrationJudgment],
) -> Result<Option<ConfirmedInformation>, CoreError> {
    if !registration_judgments.is_empty() {
        return Err(ErrorKind::InvalidRegistrationJudgment.into_error());
    }
    let prompt = snv_information_prompt(step, players, events, day_role_actions)?
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

fn ability_instance_already_used(
    character: SnvCharacterId,
    player: &Player,
    events: &[GameEvent],
) -> bool {
    let acquisition_index = events
        .iter()
        .position(|event| event.id == player.ability_instance.source_event_id);
    events.iter().skip(acquisition_index.map_or(0, |index| index + 1)).any(|event| matches!(&event.kind,
        GameEventKind::PhaseStepConfirmed { payload }
            if payload.information.as_ref().and_then(|info| info.actor.as_ref()).is_some_and(|actor| actor.player_id == player.id && actor.character_id == character.as_str())
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
                if SnvStepKey::parse(&payload.step_id).is_some_and(|step| {
                    step.is_in_phase(prefix)
                        && matches!(step.semantic_step(), SnvSemanticStep::Demon { .. })
                }) =>
            {
                let NightActionResolution::DemonAttack {
                    outcome: DemonAttackOutcome::Deaths { deaths, .. },
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

fn apply_player_event(
    players: &mut [Player],
    active_impairments: &mut Vec<ActiveImpairment>,
    events: &[GameEvent],
    event_index: usize,
    event: &GameEvent,
) -> Result<(), CoreError> {
    #[cfg(test)]
    EVENT_APPLICATION_COUNT.with(|count| count.set(count.get() + 1));
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
                let Some(player) = players.iter_mut().find(|player| player.id == *player_id) else {
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
            if actor.actual_character != actor_character_id || !is_demon(actor_character_id) {
                return Err(ErrorKind::ReplayFailed.into_error());
            }
            let NightActionResolution::DemonAttack {
                target_player_id,
                outcome,
            } = &payload.resolution
            else {
                return Err(ErrorKind::ReplayFailed.into_error());
            };
            let Some(target) = players.iter().find(|player| player.id == *target_player_id) else {
                return Err(ErrorKind::ReplayFailed.into_error());
            };
            let actor_impaired =
                SnvAbilityState::build(players, &events[..event_index]).is_impaired(&actor.id);
            match outcome {
                DemonAttackOutcome::Deaths {
                    deaths,
                    vigormortis_effect,
                } => {
                    if actor_impaired || deaths.is_empty() {
                        return Err(ErrorKind::ReplayFailed.into_error());
                    }
                    let expected_vigormortis_effect = actor_character_id == "vigormortis"
                        && target.alive
                        && character_kind(&target.actual_character) == Some(CharacterKind::Minion);
                    if expected_vigormortis_effect {
                        let effect = vigormortis_effect
                            .as_ref()
                            .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
                        let candidates = nearest_townsfolk_neighbors(players, &target.id);
                        if effect.minion_player_id != target.id
                            || effect.source_ability_instance_id != actor.ability_instance.id
                            || (candidates.is_empty() && effect.poison_target_player_id.is_some())
                            || (!candidates.is_empty()
                                && !effect
                                    .poison_target_player_id
                                    .as_ref()
                                    .is_some_and(|target| candidates.contains(target)))
                        {
                            return Err(ErrorKind::ReplayFailed.into_error());
                        }
                    } else if vigormortis_effect.is_some() {
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
                DemonAttackOutcome::FangGuJump {
                    death,
                    source_ability_instance_id,
                    identity_transition,
                } => {
                    let expected_transition = PlayerIdentityTransition {
                        player_id: target.id.clone(),
                        before: identity_state(target),
                        after: IdentityState {
                            actual_character: "fangGu".into(),
                            shown_character: "fangGu".into(),
                            alignment: Alignment::Evil,
                        },
                    };
                    let expected_death = NightDeath {
                        player_id: actor.id.clone(),
                        cause: NightDeathCause::DemonAttack {
                            actor_player_id: actor.id.clone(),
                            actor_character_id: "fangGu".into(),
                            target_player_id: target.id.clone(),
                        },
                    };
                    let jump_already_used = events[..event_index].iter().any(|event| {
                        matches!(
                            &event.kind,
                            GameEventKind::NightActionResolved { payload }
                                if matches!(
                                    payload.resolution,
                                    NightActionResolution::DemonAttack {
                                        outcome: DemonAttackOutcome::FangGuJump { .. },
                                        ..
                                    }
                                )
                        )
                    });
                    let phase_prefix = SnvStepKey::parse(&payload.step_id)
                        .map(|step| step.phase_token())
                        .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
                    if actor_impaired
                        || actor_character_id != "fangGu"
                        || !target.alive
                        || character_kind(&target.actual_character) != Some(CharacterKind::Outsider)
                        || pit_hag_demon_creation(&events[..event_index], phase_prefix).is_some()
                        || jump_already_used
                        || source_ability_instance_id != &actor.ability_instance.id
                        || death != &expected_death
                        || identity_transition != &expected_transition
                    {
                        return Err(ErrorKind::ReplayFailed.into_error());
                    }
                    let old_fang_gu = players
                        .iter_mut()
                        .find(|player| player.id == death.player_id && player.alive)
                        .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
                    old_fang_gu.alive = false;
                    let new_fang_gu = players
                        .iter_mut()
                        .find(|player| player.id == identity_transition.player_id)
                        .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
                    new_fang_gu.actual_character =
                        identity_transition.after.actual_character.clone();
                    new_fang_gu.shown_character = identity_transition.after.shown_character.clone();
                    new_fang_gu.alignment = identity_transition.after.alignment;
                    new_fang_gu.ability_instance = AbilityInstance {
                        id: AbilityInstanceId::new(&event.id, &new_fang_gu.id),
                        character_id: new_fang_gu.actual_character.clone(),
                        source_event_id: event.id.clone(),
                    };
                    new_fang_gu.identity_history.push(IdentityHistoryEntry {
                        source_event_id: event.id.clone(),
                        phase: event.phase,
                        before: identity_transition.before.clone(),
                        after: identity_transition.after.clone(),
                    });
                }
                DemonAttackOutcome::NoEffect {
                    reason: DemonAttackNoEffectReason::TargetAlreadyDead,
                } => {
                    if target.alive {
                        return Err(ErrorKind::ReplayFailed.into_error());
                    }
                }
                DemonAttackOutcome::NoEffect {
                    reason: DemonAttackNoEffectReason::ActorImpaired,
                } => {
                    if !actor_impaired {
                        return Err(ErrorKind::ReplayFailed.into_error());
                    }
                }
                DemonAttackOutcome::NoEffect {
                    reason: DemonAttackNoEffectReason::NotActualCharacter,
                } => {}
                DemonAttackOutcome::NoEffect {
                    reason: DemonAttackNoEffectReason::PitHagCreatedDemon,
                } => {
                    let prefix = SnvStepKey::parse(&payload.step_id)
                        .map(|step| step.phase_token())
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
                let Some(player) = players.iter_mut().find(|player| player.id == *player_id) else {
                    return Err(ErrorKind::ReplayFailed.into_error());
                };
                if player.alive {
                    return Err(ErrorKind::ReplayFailed.into_error());
                }
                player.death_announced = true;
            }
        }
        GameEventKind::SweetheartConsequenceResolved { payload } => {
            if let SweetheartConsequenceOutcome::DrunkApplied { impairment } = &payload.outcome {
                if impairment.kind != ImpairmentKind::Drunk
                    || impairment.source_event_id != event.id
                    || impairment.source_character_id != "sweetheart"
                    || payload.target_player_id.as_deref() != Some(impairment.player_id.as_str())
                    || !players
                        .iter()
                        .any(|player| player.id == impairment.player_id)
                {
                    return Err(ErrorKind::ReplayFailed.into_error());
                }
                active_impairments.push(impairment.clone());
            }
        }
        GameEventKind::BarberConsequenceResolved { payload } => {
            if let BarberConsequenceOutcome::Swapped {
                identity_transitions,
            } = &payload.outcome
            {
                if identity_transitions.len() != 2
                    || identity_transitions[0].player_id == identity_transitions[1].player_id
                {
                    return Err(ErrorKind::ReplayFailed.into_error());
                }
                for transition in identity_transitions {
                    let player = players
                        .iter_mut()
                        .find(|player| player.id == transition.player_id)
                        .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
                    if identity_state(player) != transition.before
                        || transition.after.alignment != transition.before.alignment
                    {
                        return Err(ErrorKind::ReplayFailed.into_error());
                    }
                    player.actual_character = transition.after.actual_character.clone();
                    player.shown_character = transition.after.shown_character.clone();
                    player.ability_instance = AbilityInstance {
                        id: AbilityInstanceId::new(&event.id, &player.id),
                        character_id: player.actual_character.clone(),
                        source_event_id: event.id.clone(),
                    };
                    player.identity_history.push(IdentityHistoryEntry {
                        source_event_id: event.id.clone(),
                        phase: event.phase,
                        before: transition.before.clone(),
                        after: transition.after.clone(),
                    });
                }
            }
        }
        GameEventKind::KlutzChoiceResolved { .. } => {}
        GameEventKind::SnakeCharmerActionResolved { payload } => {
            let Some(actor) = players.iter().find(|player| {
                player.id == payload.actor_player_id
                    && player.alive
                    && player.actual_character == "snakeCharmer"
            }) else {
                return Err(ErrorKind::ReplayFailed.into_error());
            };
            if !SnvStepKey::parse(&payload.step_id).is_some_and(|step| {
                matches!(
                    step.semantic_step(),
                    SnvSemanticStep::SnakeCharmer { actor_id: Some(actor_id) }
                        if actor_id == actor.id
                )
            }) {
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
            let actor_impaired = SnvAbilityState::build(players, &events[..event_index])
                .is_impaired(&payload.actor_player_id);
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
                return Ok(());
            }
            if actor_impaired {
                if payload.outcome
                    != (SnakeCharmerActionOutcome::NoSwap {
                        reason: SnakeCharmerNoSwapReason::ActorImpaired,
                    })
                {
                    return Err(ErrorKind::ReplayFailed.into_error());
                }
                return Ok(());
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
                    id: AbilityInstanceId::new(&event.id, &player.id),
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
            if !SnvStepKey::parse(&payload.step_id).is_some_and(|step| {
                matches!(
                    step.semantic_step(),
                    SnvSemanticStep::PitHag { actor_id: Some(actor_id) }
                        if actor_id == actor.id
                )
            }) {
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
            let actor_impaired = SnvAbilityState::build(players, &events[..event_index])
                .is_impaired(&payload.actor_player_id);
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
                    id: AbilityInstanceId::new(&event.id, &target.id),
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
                    id: AbilityInstanceId::new(&event.id, &player.id),
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
    Ok(())
}

#[cfg(test)]
thread_local! {
    static PLAYER_REPLAY_PASS_COUNT: Cell<usize> = const { Cell::new(0) };
    static EVENT_APPLICATION_COUNT: Cell<usize> = const { Cell::new(0) };
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
pub(crate) fn reset_event_application_count() {
    EVENT_APPLICATION_COUNT.with(|count| count.set(0));
}

#[cfg(test)]
pub(crate) fn event_application_count() -> usize {
    EVENT_APPLICATION_COUNT.with(Cell::get)
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
                            ..
                        },
                    ..
                } = &payload.resolution
                {
                    for death in event_deaths {
                        if !deaths.contains(&death.player_id) {
                            deaths.push(death.player_id.clone());
                        }
                    }
                } else if let NightActionResolution::DemonAttack {
                    outcome: DemonAttackOutcome::FangGuJump { death, .. },
                    ..
                } = &payload.resolution
                {
                    if !deaths.contains(&death.player_id) {
                        deaths.push(death.player_id.clone());
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

fn base_snv_impairments(events: &[GameEvent]) -> Vec<ActiveImpairment> {
    let mut impairments = active_snake_charmer_impairments(events);
    impairments.extend(events.iter().filter_map(|event| match &event.kind {
        GameEventKind::SweetheartConsequenceResolved { payload } => match &payload.outcome {
            SweetheartConsequenceOutcome::DrunkApplied { impairment } => Some(impairment.clone()),
            SweetheartConsequenceOutcome::NoEffect { .. } => None,
        },
        _ => None,
    }));
    impairments
}

fn source_ability_functions_from_base(
    player: &Player,
    expected_character: &str,
    base_impairments: &[ActiveImpairment],
) -> bool {
    player.alive
        && player.actual_character == expected_character
        && !base_impairments
            .iter()
            .any(|impairment| impairment.player_id == player.id)
}

struct SnvAbilityState {
    active_impairments: Vec<ActiveImpairment>,
    retained_minion_player_ids: HashSet<String>,
    pending_vigormortis_poison_choices: Vec<PendingVigormortisPoisonChoice>,
}

impl SnvAbilityState {
    fn build(players: &[Player], events: &[GameEvent]) -> Self {
        let base_impairments = base_snv_impairments(events);
        let mut active_impairments = base_impairments.clone();
        let mut retained_minion_player_ids = HashSet::new();
        let mut pending_vigormortis_poison_choices = Vec::new();

        for no_dashii in players.iter().filter(|player| {
            source_ability_functions_from_base(player, "noDashii", &base_impairments)
        }) {
            let source_event_id = if no_dashii.ability_instance.source_event_id == "setup" {
                events
                    .first()
                    .map_or_else(|| "setup".into(), |event| event.id.clone())
            } else {
                no_dashii.ability_instance.source_event_id.clone()
            };
            for player_id in nearest_townsfolk_neighbors(players, &no_dashii.id) {
                active_impairments.push(ActiveImpairment {
                    kind: ImpairmentKind::Poisoned,
                    player_id,
                    source_event_id: source_event_id.clone(),
                    source_character_id: "noDashii".into(),
                    expires: ImpairmentExpiry::WhileSourceAbilityActive,
                });
            }
        }

        for (source_event_index, source_event) in events.iter().enumerate() {
            let GameEventKind::NightActionResolved { payload } = &source_event.kind else {
                continue;
            };
            let NightActionResolution::DemonAttack {
                outcome:
                    DemonAttackOutcome::Deaths {
                        vigormortis_effect: Some(effect),
                        ..
                    },
                ..
            } = &payload.resolution
            else {
                continue;
            };
            let Some(vigormortis) = players.iter().find(|player| {
                player.id == payload.actor_player_id
                    && source_ability_functions_from_base(player, "vigormortis", &base_impairments)
                    && player.ability_instance.id == effect.source_ability_instance_id
            }) else {
                continue;
            };
            let Some(minion) = players.iter().find(|player| {
                player.id == effect.minion_player_id
                    && !player.alive
                    && character_kind(&player.actual_character) == Some(CharacterKind::Minion)
            }) else {
                continue;
            };
            let current_target = events
                .iter()
                .filter_map(|event| match &event.kind {
                    GameEventKind::VigormortisPoisonTargetChanged { payload }
                        if payload.source_event_id == source_event.id =>
                    {
                        Some(payload.target_player_id.clone())
                    }
                    _ => None,
                })
                .next_back()
                .or_else(|| effect.poison_target_player_id.clone());
            let allowed_player_ids = nearest_townsfolk_neighbors(players, &minion.id);
            if current_target
                .as_ref()
                .is_some_and(|target| allowed_player_ids.contains(target))
            {
                active_impairments.push(ActiveImpairment {
                    kind: ImpairmentKind::Poisoned,
                    player_id: current_target.expect("checked target"),
                    source_event_id: source_event.id.clone(),
                    source_character_id: "vigormortis".into(),
                    expires: ImpairmentExpiry::WhileSourceAbilityActive,
                });
            } else if !allowed_player_ids.is_empty() {
                let reason = match current_target.as_deref() {
                    None => VigormortisPoisonInvalidReason::NoCurrentTarget,
                    Some(target)
                        if players.iter().any(|player| {
                            player.id == target
                                && character_kind(&player.actual_character)
                                    != Some(CharacterKind::Townsfolk)
                        }) =>
                    {
                        VigormortisPoisonInvalidReason::TargetNotTownsfolk
                    }
                    Some(_) => VigormortisPoisonInvalidReason::TargetNotNearestTownsfolk,
                };
                pending_vigormortis_poison_choices.push(PendingVigormortisPoisonChoice {
                    source_event_id: source_event.id.clone(),
                    vigormortis_player_id: vigormortis.id.clone(),
                    minion_player_id: minion.id.clone(),
                    previous_target_player_id: current_target,
                    allowed_player_ids,
                    reason,
                });
            }

            let acquisition_index = events
                .iter()
                .position(|event| event.id == minion.ability_instance.source_event_id);
            if source_event_index >= acquisition_index.map_or(0, |index| index + 1) {
                retained_minion_player_ids.insert(minion.id.clone());
            }
        }

        Self {
            active_impairments,
            retained_minion_player_ids,
            pending_vigormortis_poison_choices,
        }
    }

    fn is_impaired(&self, player_id: &str) -> bool {
        self.active_impairments
            .iter()
            .any(|impairment| impairment.player_id == player_id)
    }

    fn has_active_ability(&self, player: &Player) -> bool {
        player.alive || self.retained_minion_player_ids.contains(&player.id)
    }

    fn ability_functions(&self, player: &Player, expected_character: &str) -> bool {
        player.actual_character == expected_character
            && self.has_active_ability(player)
            && !self.is_impaired(&player.id)
    }
}

fn pending_identity_reveals(
    events: &[GameEvent],
    players: &[Player],
) -> Vec<PendingIdentityReveal> {
    let Some(event) = events.last() else {
        return vec![];
    };
    match &event.kind {
        GameEventKind::NightActionResolved { payload } => match &payload.resolution {
            NightActionResolution::DemonAttack {
                outcome:
                    DemonAttackOutcome::FangGuJump {
                        identity_transition,
                        ..
                    },
                ..
            } => vec![PendingIdentityReveal {
                source_event_id: event.id.clone(),
                sequence: 1,
                payload: RevealPayload::CharacterChange {
                    kind: "characterChange",
                    player_id: identity_transition.player_id.clone(),
                    alignment: "evil".into(),
                    character_id: "fangGu".into(),
                },
            }],
            _ => vec![],
        },
        GameEventKind::EvilTwinPairAssigned { payload } => {
            let Some(actor) = players
                .iter()
                .find(|player| player.id == payload.actor_player_id)
            else {
                return vec![];
            };
            let Some(twin) = players
                .iter()
                .find(|player| player.id == payload.twin_player_id)
            else {
                return vec![];
            };
            vec![PendingIdentityReveal {
                source_event_id: event.id.clone(),
                sequence: 1,
                payload: RevealPayload::EvilTwinPair {
                    kind: "evilTwinPair",
                    players: [actor, twin]
                        .into_iter()
                        .map(|player| EvilTwinRevealPlayer {
                            player_id: player.id.clone(),
                            seat: player.seat,
                            name: player.name.clone(),
                            alignment: player.alignment,
                            character_id: player.shown_character.clone(),
                        })
                        .collect(),
                },
            }]
        }
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
        GameEventKind::BarberConsequenceResolved { payload } => {
            let BarberConsequenceOutcome::Swapped {
                identity_transitions,
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

fn phase_token(phase: Phase) -> &'static str {
    match phase {
        Phase::Setup => "setup",
        Phase::FirstNight => "firstNight",
        Phase::Day => "day",
        Phase::Night => "night",
    }
}

fn death_event_for_player<'a>(
    events: &'a [GameEvent],
    player_id: &str,
) -> Option<(&'a GameEvent, u8)> {
    events.iter().rev().find_map(|event| match &event.kind {
        GameEventKind::DeathConfirmed { payload } if payload.player_id == player_id => {
            Some((event, 1))
        }
        GameEventKind::NightActionResolved { payload } => match &payload.resolution {
            NightActionResolution::DemonAttack {
                outcome: DemonAttackOutcome::Deaths { deaths, .. },
                ..
            } => deaths
                .iter()
                .position(|death| death.player_id == player_id)
                .map(|index| (event, (index + 1) as u8)),
            NightActionResolution::DemonAttack {
                outcome: DemonAttackOutcome::FangGuJump { death, .. },
                ..
            } if death.player_id == player_id => Some((event, 1)),
            _ => None,
        },
        GameEventKind::PitHagArbitraryDeathsConfirmed { payload } => payload
            .deaths
            .iter()
            .position(|death| death.player_id == player_id)
            .map(|index| (event, (index + 1) as u8)),
        _ => None,
    })
}

fn record_death_triggers(
    triggers: &mut Vec<PendingDeathConsequence>,
    players: &[Player],
    prior_events: &[GameEvent],
    event: &GameEvent,
) {
    let ability_state = SnvAbilityState::build(players, prior_events);
    let mut record = |player_id: &str,
                      source_event: &GameEvent,
                      death_sequence: u8,
                      kind: DeathConsequenceKind| {
        let Some(player) = players.iter().find(|player| player.id == player_id) else {
            return;
        };
        if triggers.iter().any(|trigger| {
            trigger.source_event_id == source_event.id
                && trigger.death_sequence == death_sequence
                && trigger.kind == kind
        }) {
            return;
        }
        let kind_token = match kind {
            DeathConsequenceKind::Sweetheart => "sweetheart",
            DeathConsequenceKind::Barber => "barber",
            DeathConsequenceKind::Klutz => "klutz",
        };
        triggers.push(PendingDeathConsequence {
            step_id: format!(
                "{}:death:{}:{death_sequence}:{kind_token}",
                phase_token(event.phase),
                source_event.id
            ),
            kind,
            source_event_id: source_event.id.clone(),
            death_sequence,
            actor_player_id: player.id.clone(),
            source_ability_instance_id: player.ability_instance.id.clone(),
            actor_impaired_at_trigger: ability_state.is_impaired(&player.id),
            actor_alignment_at_trigger: player.alignment,
            allowed_player_ids: match kind {
                DeathConsequenceKind::Klutz => players
                    .iter()
                    .filter(|candidate| candidate.alive)
                    .map(|candidate| candidate.id.clone())
                    .collect(),
                DeathConsequenceKind::Sweetheart | DeathConsequenceKind::Barber => players
                    .iter()
                    .map(|candidate| candidate.id.clone())
                    .collect(),
            },
            eligible_chooser_player_ids: players
                .iter()
                .filter(|candidate| {
                    candidate.alive
                        && character_kind(&candidate.actual_character) == Some(CharacterKind::Demon)
                })
                .map(|candidate| candidate.id.clone())
                .collect(),
        });
    };

    let deaths = match &event.kind {
        GameEventKind::DeathConfirmed { payload } => vec![(payload.player_id.as_str(), 1)],
        GameEventKind::NightActionResolved { payload } => match &payload.resolution {
            NightActionResolution::DemonAttack {
                outcome: DemonAttackOutcome::Deaths { deaths, .. },
                ..
            } => deaths
                .iter()
                .enumerate()
                .map(|(index, death)| (death.player_id.as_str(), (index + 1) as u8))
                .collect(),
            NightActionResolution::DemonAttack {
                outcome: DemonAttackOutcome::FangGuJump { death, .. },
                ..
            } => vec![(death.player_id.as_str(), 1)],
            _ => vec![],
        },
        GameEventKind::PitHagArbitraryDeathsConfirmed { payload } => payload
            .deaths
            .iter()
            .enumerate()
            .map(|(index, death)| (death.player_id.as_str(), (index + 1) as u8))
            .collect(),
        _ => vec![],
    };
    for (player_id, death_sequence) in deaths {
        let Some(player) = players.iter().find(|player| player.id == player_id) else {
            continue;
        };
        match player.actual_character.as_str() {
            "sweetheart" => record(
                player_id,
                event,
                death_sequence,
                DeathConsequenceKind::Sweetheart,
            ),
            "barber" => record(
                player_id,
                event,
                death_sequence,
                DeathConsequenceKind::Barber,
            ),
            "klutz" if event.phase == Phase::Day => record(
                player_id,
                event,
                death_sequence,
                DeathConsequenceKind::Klutz,
            ),
            _ => {}
        }
    }

    if let GameEventKind::NightDeathsAnnounced { payload } = &event.kind {
        for player_id in &payload.player_ids {
            let Some(player) = players
                .iter()
                .find(|player| player.id == *player_id && player.actual_character == "klutz")
            else {
                continue;
            };
            if let Some((source_event, sequence)) = death_event_for_player(prior_events, &player.id)
            {
                record(
                    &player.id,
                    source_event,
                    sequence,
                    DeathConsequenceKind::Klutz,
                );
            }
        }
    }
}

fn unresolved_death_consequences(
    triggers: &[PendingDeathConsequence],
    events: &[GameEvent],
    players: &[Player],
    current_step: Option<&PhaseStep>,
) -> Vec<PendingDeathConsequence> {
    let resolved = events
        .iter()
        .filter_map(|event| match &event.kind {
            GameEventKind::SweetheartConsequenceResolved { payload } => {
                Some((DeathConsequenceKind::Sweetheart, &payload.trigger))
            }
            GameEventKind::BarberConsequenceResolved { payload } => {
                Some((DeathConsequenceKind::Barber, &payload.trigger))
            }
            GameEventKind::KlutzChoiceResolved { payload } => {
                Some((DeathConsequenceKind::Klutz, &payload.trigger))
            }
            _ => None,
        })
        .collect::<Vec<_>>();
    let mut pending = triggers
        .iter()
        .filter(|trigger| {
            !resolved.iter().any(|(kind, resolved)| {
                *kind == trigger.kind
                    && resolved.source_event_id == trigger.source_event_id
                    && resolved.death_sequence == trigger.death_sequence
                    && resolved.player_id == trigger.actor_player_id
            })
        })
        .filter(|trigger| match trigger.kind {
            DeathConsequenceKind::Sweetheart | DeathConsequenceKind::Klutz => true,
            DeathConsequenceKind::Barber => current_step.is_some_and(|step| {
                let matching_barber_step = step.character.as_deref() == Some("barber")
                    && step.player_id.as_deref() == Some(trigger.actor_player_id.as_str());
                let after_barber_timing = step.phase == Phase::Night
                    && (step
                        .character
                        .as_deref()
                        .and_then(later_night_wake_rank)
                        .is_some_and(|rank| rank > later_night_wake_rank("barber").unwrap())
                        || SnvStepKey::parse(&step.id)
                            .is_some_and(|key| key.semantic_step() == SnvSemanticStep::ToDay));
                let trigger_was_after_barber_in_this_night = events.iter().any(|event| {
                    event.id == trigger.source_event_id
                        && matches!(
                            event.kind,
                            GameEventKind::PitHagArbitraryDeathsConfirmed { .. }
                        )
                        && same_phase_cycle_as_step(event, step)
                });
                matching_barber_step
                    || (after_barber_timing && !trigger_was_after_barber_in_this_night)
            }),
        })
        .cloned()
        .collect::<Vec<_>>();
    for consequence in &mut pending {
        consequence.allowed_player_ids = match consequence.kind {
            DeathConsequenceKind::Klutz => players
                .iter()
                .filter(|player| player.alive)
                .map(|player| player.id.clone())
                .collect(),
            _ => players.iter().map(|player| player.id.clone()).collect(),
        };
        consequence.eligible_chooser_player_ids = players
            .iter()
            .filter(|player| {
                player.alive
                    && character_kind(&player.actual_character) == Some(CharacterKind::Demon)
            })
            .map(|player| player.id.clone())
            .collect();
        if let Some(step) = current_step {
            let expected_character = match consequence.kind {
                DeathConsequenceKind::Sweetheart => Some("sweetheart"),
                DeathConsequenceKind::Barber => Some("barber"),
                DeathConsequenceKind::Klutz => None,
            };
            if expected_character.is_some_and(|character| {
                step.character.as_deref() == Some(character)
                    && step.player_id.as_deref() == Some(consequence.actor_player_id.as_str())
            }) {
                consequence.step_id = step.id.clone();
            }
        }
    }
    pending
}

fn same_phase_cycle_as_step(event: &GameEvent, step: &PhaseStep) -> bool {
    let event_step_id = match &event.kind {
        GameEventKind::PitHagArbitraryDeathsConfirmed { payload } => payload.step_id.as_str(),
        _ => return false,
    };
    match (
        SnvStepKey::parse(event_step_id),
        SnvStepKey::parse(&step.id),
    ) {
        (Some(event_key), Some(step_key)) => event_key.phase_token() == step_key.phase_token(),
        _ => false,
    }
}

fn pending_game_end(
    events_before: &[GameEvent],
    event: &GameEvent,
    players_before: &[Player],
    players_after: &[Player],
    death_triggers: &[PendingDeathConsequence],
) -> Option<PendingGameEnd> {
    let direct = match &event.kind {
        GameEventKind::KlutzChoiceResolved { payload } => match payload.outcome {
            KlutzChoiceOutcome::TeamLost { winning_team, .. } => {
                Some((winning_team, GameEndCause::KlutzChoice))
            }
            KlutzChoiceOutcome::Safe | KlutzChoiceOutcome::ActorImpaired => None,
        },
        GameEventKind::DeathConfirmed { payload }
            if payload
                .step_id
                .as_deref()
                .is_some_and(|step| step.ends_with(":executionDeath")) =>
        {
            let executed = players_before
                .iter()
                .find(|player| player.id == payload.player_id && player.alive)?;
            let ability_state = SnvAbilityState::build(players_before, events_before);
            let relationships =
                active_evil_twin_relationships(players_before, events_before, &ability_state);
            (executed.alignment == Alignment::Good
                && relationships
                    .iter()
                    .any(|relationship| relationship.twin_player_id == executed.id))
            .then_some((Alignment::Evil, GameEndCause::EvilTwinExecution))
        }
        GameEventKind::NoExecutionConfirmed { payload } => {
            let day_id = SnvStepKey::parse(&payload.step_id)?.phase_token();
            if day_execution_occurred(day_id, events_before) {
                None
            } else {
                let ability_state = SnvAbilityState::build(players_before, events_before);
                players_before
                    .iter()
                    .any(|player| ability_state.ability_functions(player, "vortox"))
                    .then_some((Alignment::Evil, GameEndCause::VortoxNoExecution))
            }
        }
        _ => None,
    };
    let candidate = direct.or_else(|| {
        let active_events = events_before
            .iter()
            .chain(std::iter::once(event))
            .cloned()
            .collect::<Vec<_>>();
        let unresolved_klutz =
            unresolved_death_consequences(death_triggers, &active_events, players_after, None)
                .iter()
                .any(|pending| pending.kind == DeathConsequenceKind::Klutz)
                || unannounced_night_death_player_ids(&active_events)
                    .iter()
                    .any(|player_id| {
                        players_after.iter().any(|player| {
                            player.id == *player_id && player.actual_character == "klutz"
                        })
                    });
        if unresolved_klutz {
            return None;
        }
        let ability_state = SnvAbilityState::build(players_after, &active_events);
        let relationships =
            active_evil_twin_relationships(players_after, &active_events, &ability_state);
        let good_can_win = !living_evil_twin_pair(players_after, &relationships);
        let demon_absent = good_can_win
            && !players_after.iter().any(|player| {
                player.alive
                    && character_kind(&player.actual_character) == Some(CharacterKind::Demon)
            });
        if demon_absent {
            Some((Alignment::Good, GameEndCause::DemonAbsent))
        } else if players_after.iter().filter(|player| player.alive).count() <= 2 {
            Some((Alignment::Evil, GameEndCause::TwoLivingPlayers))
        } else {
            None
        }
    });
    let (winning_team, cause) = candidate?;
    Some(PendingGameEnd {
        source_event_id: event.id.clone(),
        winning_team,
        cause,
        reason_ko: game_end_reason_ko(cause).into(),
    })
}

fn apply_replay_player_event(
    players: &mut [Player],
    active_impairments: &mut Vec<ActiveImpairment>,
    events: &[GameEvent],
    event_index: usize,
    event: &GameEvent,
    players_before: &[Player],
    death_triggers: &[PendingDeathConsequence],
    first_game_end: &mut Option<PendingGameEnd>,
) -> Result<(), CoreError> {
    apply_player_event(players, active_impairments, events, event_index, event)?;
    if first_game_end.is_none() {
        *first_game_end = pending_game_end(
            &events[..event_index],
            event,
            players_before,
            players,
            death_triggers,
        );
    }
    Ok(())
}

fn game_end_source(pending: &PendingGameEnd) -> GameEndSource {
    let source_event_id = pending.source_event_id.clone();
    match pending.cause {
        GameEndCause::DemonAbsent => GameEndSource::DemonAbsent { source_event_id },
        GameEndCause::TwoLivingPlayers => GameEndSource::TwoLivingPlayers { source_event_id },
        GameEndCause::KlutzChoice => GameEndSource::KlutzChoice { source_event_id },
        GameEndCause::EvilTwinExecution => GameEndSource::EvilTwinExecution { source_event_id },
        GameEndCause::VortoxNoExecution => GameEndSource::VortoxNoExecution { source_event_id },
    }
}

struct SnvReplayContext {
    initial_players: Vec<Player>,
    players: Vec<Player>,
    phase: Phase,
    current_step: Option<PhaseStep>,
    phase_overview: Vec<PhaseOverviewItem>,
    day_role_actions: DayRoleActionIndex,
    death_triggers: Vec<PendingDeathConsequence>,
    pending_game_end: Option<PendingGameEnd>,
}

fn replay_context(events: &[GameEvent]) -> Result<SnvReplayContext, CoreError> {
    #[cfg(test)]
    PLAYER_REPLAY_PASS_COUNT.with(|count| count.set(count.get() + 1));
    let mut players = setup_players(events)?;
    let initial_players = players.clone();
    let mut active_impairments = Vec::<ActiveImpairment>::new();
    let mut day_role_actions = DayRoleActionIndex::default();
    let mut statuses = HashMap::new();
    let mut pending_madness_overview: Option<(PendingMadnessExecution, Phase, Vec<PhaseStep>)> =
        None;
    let mut death_triggers = Vec::<PendingDeathConsequence>::new();
    let mut pending_game_end = None;

    for (event_index, event) in events.iter().enumerate().skip(1) {
        let players_before_event = players.clone();
        let players_at_event = players_before_event.as_slice();
        day_role_actions.record(event, players_at_event)?;
        record_death_triggers(
            &mut death_triggers,
            players_at_event,
            &events[..event_index],
            event,
        );
        if matches!(
            event.kind,
            GameEventKind::SweetheartConsequenceResolved { .. }
                | GameEventKind::BarberConsequenceResolved { .. }
                | GameEventKind::KlutzChoiceResolved { .. }
        ) {
            let Some((phase, _, current)) = current_phase_steps(
                players_at_event,
                &events[..event_index],
                events.len() + 2,
                &statuses,
            ) else {
                return Err(ErrorKind::ReplayFailed.into_error());
            };
            let pending = unresolved_death_consequences(
                &death_triggers,
                &events[..event_index],
                players_at_event,
                current.as_ref(),
            );
            let (step_id, trigger) = match &event.kind {
                GameEventKind::SweetheartConsequenceResolved { payload } => {
                    (&payload.step_id, &payload.trigger)
                }
                GameEventKind::BarberConsequenceResolved { payload } => {
                    (&payload.step_id, &payload.trigger)
                }
                GameEventKind::KlutzChoiceResolved { payload } => {
                    (&payload.step_id, &payload.trigger)
                }
                _ => unreachable!(),
            };
            let expected = pending
                .iter()
                .find(|consequence| consequence.step_id == *step_id)
                .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
            if event.phase != phase
                || trigger.source_event_id != expected.source_event_id
                || trigger.death_sequence != expected.death_sequence
                || trigger.player_id != expected.actor_player_id
                || trigger.source_ability_instance_id != expected.source_ability_instance_id
            {
                return Err(ErrorKind::ReplayFailed.into_error());
            }
            validate_death_consequence_event(
                event,
                expected,
                players_at_event,
                &events[..event_index],
            )?;
            if current.as_ref().is_some_and(|step| step.id == *step_id) {
                statuses.insert(step_id.clone(), PhaseStepStatus::Complete);
            }
            apply_replay_player_event(
                &mut players,
                &mut active_impairments,
                events,
                event_index,
                event,
                players_at_event,
                &death_triggers,
                &mut pending_game_end,
            )?;
            continue;
        }
        if let GameEventKind::PlayerAnnotationsUpdated { payload } = &event.kind {
            if !events[..event_index].iter().any(|candidate| matches!(
                &candidate.kind,
                GameEventKind::SetupConfirmed { payload: setup }
                    if setup.players.iter().any(|player| player.id.as_deref() == Some(payload.player_id.as_str()))
            )) {
                return Err(ErrorKind::ReplayFailed.into_error());
            }
            apply_replay_player_event(
                &mut players,
                &mut active_impairments,
                events,
                event_index,
                event,
                players_at_event,
                &death_triggers,
                &mut pending_game_end,
            )?;
            continue;
        }
        if let GameEventKind::VigormortisPoisonTargetChanged { payload } = &event.kind {
            let pending = SnvAbilityState::build(players_at_event, &events[..event_index])
                .pending_vigormortis_poison_choices
                .into_iter()
                .find(|choice| choice.source_event_id == payload.source_event_id)
                .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
            let Some((phase, _, _)) = current_phase_steps(
                players_at_event,
                &events[..event_index],
                events.len() + 2,
                &statuses,
            ) else {
                return Err(ErrorKind::ReplayFailed.into_error());
            };
            if event.phase != phase
                || payload.previous_target_player_id != pending.previous_target_player_id
                || !pending
                    .allowed_player_ids
                    .contains(&payload.target_player_id)
            {
                return Err(ErrorKind::ReplayFailed.into_error());
            }
            apply_replay_player_event(
                &mut players,
                &mut active_impairments,
                events,
                event_index,
                event,
                players_at_event,
                &death_triggers,
                &mut pending_game_end,
            )?;
            continue;
        }
        if let GameEventKind::MadnessCheckRecorded { payload } = &event.kind {
            if pending_madness_overview.is_some() {
                return Err(ErrorKind::ReplayFailed.into_error());
            }
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
            apply_replay_player_event(
                &mut players,
                &mut active_impairments,
                events,
                event_index,
                event,
                players_at_event,
                &death_triggers,
                &mut pending_game_end,
            )?;
            continue;
        }
        if let GameEventKind::MadnessExecutionConfirmed { payload } = &event.kind {
            if pending_madness_overview.is_some() {
                return Err(ErrorKind::ReplayFailed.into_error());
            }
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
                        if SnvStepKey::parse(&step.id)
                            .is_some_and(|key| key.semantic_step() == SnvSemanticStep::ToNight)
                        {
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
            apply_replay_player_event(
                &mut players,
                &mut active_impairments,
                events,
                event_index,
                event,
                players_at_event,
                &death_triggers,
                &mut pending_game_end,
            )?;
            continue;
        }
        if let Some((pending, phase, _)) = pending_madness_overview.as_ref() {
            if let GameEventKind::DeathConfirmed { payload } = &event.kind {
                let expected_step_id = madness_execution_death_step_id(
                    &pending.event_id,
                    &pending.interrupted_step_id,
                );
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
                apply_replay_player_event(
                    &mut players,
                    &mut active_impairments,
                    events,
                    event_index,
                    event,
                    players_at_event,
                    &death_triggers,
                    &mut pending_game_end,
                )?;
                continue;
            }
            return Err(ErrorKind::ReplayFailed.into_error());
        }
        if let GameEventKind::DayActionRecorded { payload } = &event.kind {
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
            apply_replay_player_event(
                &mut players,
                &mut active_impairments,
                events,
                event_index,
                event,
                players_at_event,
                &death_triggers,
                &mut pending_game_end,
            )?;
            continue;
        }
        if let GameEventKind::ManualPhaseStepResolved { payload } = &event.kind {
            if let Some(prefix) = payload.step_id.strip_suffix(":manual") {
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
                    || !current.is_some_and(|step| {
                        SnvStepKey::parse(&step.id).is_some_and(|step| step.is_in_phase(prefix))
                    })
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
                apply_replay_player_event(
                    &mut players,
                    &mut active_impairments,
                    events,
                    event_index,
                    event,
                    players_at_event,
                    &death_triggers,
                    &mut pending_game_end,
                )?;
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
            GameEventKind::WitchCurseAssigned { payload } => {
                (&payload.step_id, PhaseStepStatus::Complete)
            }
            GameEventKind::EvilTwinPairAssigned { payload } => {
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
                        && SnvStepKey::parse(event_step_id)
                            .is_some_and(|step| step.tail() == player.actual_character)
                })
            }
            _ => None,
        };
        let legacy_dead_character_step = current.id != *event_step_id
            && current.phase == event.phase
            && SnvStepKey::parse(&current.id)
                .zip(SnvStepKey::parse(event_step_id))
                .is_some_and(|(current, event)| current.phase() == event.phase())
            && legacy_dead_player.is_some_and(|player| {
                SnvStepKey::parse(event_step_id)
                    .is_some_and(|step| step.tail() == player.actual_character)
            });
        if legacy_dead_character_step {
            if let GameEventKind::PhaseStepConfirmed { payload } = &event.kind {
                let player =
                    legacy_dead_player.ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
                let prefix = SnvStepKey::parse(event_step_id).map_or("", |step| step.phase_token());
                let legacy_step = character_step(
                    event.phase,
                    prefix,
                    &player.actual_character,
                    player,
                    players_at_event,
                );
                validate_required_input(
                    &legacy_step.required_input,
                    &payload.input,
                    players_at_event,
                )
                .map_err(|_| ErrorKind::ReplayFailed.into_error())?;
                if is_information_character(legacy_step.character.as_deref()) {
                    let expected = snv_confirmed_information(
                        &legacy_step,
                        players_at_event,
                        &events[..event_index],
                        &day_role_actions,
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
            apply_replay_player_event(
                &mut players,
                &mut active_impairments,
                events,
                event_index,
                event,
                players_at_event,
                &death_triggers,
                &mut pending_game_end,
            )?;
            continue;
        }
        let legacy_manual_demon =
            matches!(&event.kind, GameEventKind::ManualPhaseStepResolved { .. })
                && current.character.as_deref().is_some_and(is_demon)
                && current.character.as_ref().is_some_and(|character| {
                    let prefix =
                        SnvStepKey::parse(&current.id).map_or("", |step| step.phase_token());
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
        let legacy_manual_witch_or_evil_twin =
            matches!(&event.kind, GameEventKind::ManualPhaseStepResolved { .. })
                && matches!(current.character.as_deref(), Some("witch" | "evilTwin"))
                && (legacy_player_scoped_step || current.id == *event_step_id);
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
                let legacy_evil_information = current.step_type == StepType::EvilInfo
                    && payload.input.is_none()
                    && payload.information.is_none();
                if !legacy_evil_information {
                    validate_required_input(
                        &current.required_input,
                        &payload.input,
                        players_at_event,
                    )
                    .map_err(|_| ErrorKind::ReplayFailed.into_error())?;
                }
                let legacy_juggler_without_information = current.character.as_deref()
                    == Some("juggler")
                    && payload.information.is_none();
                if current.step_type == StepType::EvilInfo && !legacy_evil_information {
                    let expected = snv_evil_information(&current, players_at_event, &payload.input)
                        .map(Some)
                        .map_err(|_| ErrorKind::ReplayFailed.into_error())?;
                    if payload.information != expected {
                        return Err(ErrorKind::ReplayFailed.into_error());
                    }
                } else if is_information_character(current.character.as_deref())
                    && !legacy_juggler_without_information
                {
                    let expected = snv_confirmed_information(
                        &current,
                        players_at_event,
                        &events[..event_index],
                        &day_role_actions,
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
                    || legacy_manual_witch_or_evil_twin
                    || legacy_manual_information => {}
            (GameEventKind::NightActionResolved { payload }, PhaseStepSupport::Automated)
                if current.character.as_deref().is_some_and(is_demon)
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
                    players_at_event,
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
                    players_at_event,
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
                    players_at_event,
                )
                .map_err(|_| ErrorKind::ReplayFailed.into_error())?;
                let source = pit_hag_demon_creation(
                    &events[..event_index],
                    SnvStepKey::parse(&current.id).map_or("", |step| step.phase_token()),
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
                    players_at_event,
                )
                .map_err(|_| ErrorKind::ReplayFailed.into_error())?;
            }
            (GameEventKind::WitchCurseAssigned { payload }, PhaseStepSupport::Automated)
                if current.character.as_deref() == Some("witch")
                    && current.player_id.as_deref() == Some(payload.actor_player_id.as_str()) =>
            {
                validate_required_input(
                    &current.required_input,
                    &Some(crate::model::StepInputFields {
                        player_ids: Some(vec![payload.target_player_id.clone()]),
                        ..Default::default()
                    }),
                    players_at_event,
                )
                .map_err(|_| ErrorKind::ReplayFailed.into_error())?;
                let actor = players_at_event
                    .iter()
                    .find(|player| player.id == payload.actor_player_id)
                    .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
                if actor.ability_instance.id != payload.source_ability_instance_id {
                    return Err(ErrorKind::ReplayFailed.into_error());
                }
            }
            (GameEventKind::EvilTwinPairAssigned { payload }, PhaseStepSupport::Automated)
                if current.character.as_deref() == Some("evilTwin")
                    && current.player_id.as_deref() == Some(payload.actor_player_id.as_str()) =>
            {
                validate_required_input(
                    &current.required_input,
                    &Some(crate::model::StepInputFields {
                        player_ids: Some(vec![payload.twin_player_id.clone()]),
                        ..Default::default()
                    }),
                    players_at_event,
                )
                .map_err(|_| ErrorKind::ReplayFailed.into_error())?;
                let actor = players_at_event
                    .iter()
                    .find(|player| player.id == payload.actor_player_id)
                    .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
                let twin = players_at_event
                    .iter()
                    .find(|player| player.id == payload.twin_player_id)
                    .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
                if actor.ability_instance.id != payload.source_ability_instance_id
                    || actor.alignment != payload.actor_alignment
                    || twin.alignment != payload.twin_alignment
                    || actor.alignment == twin.alignment
                {
                    return Err(ErrorKind::ReplayFailed.into_error());
                }
            }
            (GameEventKind::NightDeathsAnnounced { .. }, PhaseStepSupport::Automated)
                if current.step_type == StepType::Announcement => {}
            (GameEventKind::NominationStarted { payload }, PhaseStepSupport::Automated)
                if current.required_input.kind == RequiredInputKind::Nomination =>
            {
                let prefix = step_prefix(&payload.step_id)?;
                validate_nomination_start_roles(
                    players_at_event,
                    &events[..event_index],
                    &prefix,
                    &payload.nominator_id,
                    &payload.nominee_id,
                )
                .map_err(|_| ErrorKind::ReplayFailed.into_error())?;
                let expected_witch = witch_nomination_resolution(
                    &payload.step_id,
                    &payload.nominator_id,
                    players_at_event,
                    &events[..event_index],
                );
                if payload.witch_resolution != expected_witch {
                    return Err(ErrorKind::ReplayFailed.into_error());
                }
            }
            (GameEventKind::NominationVoteConfirmed { payload }, PhaseStepSupport::Automated)
                if current.required_input.kind == RequiredInputKind::NominationVote =>
            {
                validate_nomination_event_input(payload, players_at_event, &events[..event_index])
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
                let expected = replay_day_state(&events[..event_index], players_at_event, &prefix)?
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
            (GameEventKind::DeathConfirmed { payload }, PhaseStepSupport::Automated)
                if current.step_type == StepType::WitchDeath
                    && current.player_id.as_deref() == Some(payload.player_id.as_str()) => {}
            _ => return Err(ErrorKind::ReplayFailed.into_error()),
        }
        statuses.insert(current.id.clone(), status);
        if let GameEventKind::SnakeCharmerActionResolved { payload } = &event.kind {
            if matches!(payload.outcome, SnakeCharmerActionOutcome::Swap { .. }) {
                let prefix = SnvStepKey::parse(&current.id)
                    .map(|step| step.phase_token())
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
        apply_replay_player_event(
            &mut players,
            &mut active_impairments,
            events,
            event_index,
            event,
            players_at_event,
            &death_triggers,
            &mut pending_game_end,
        )?;
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
        return Ok(SnvReplayContext {
            initial_players,
            players,
            phase,
            current_step: Some(death_step),
            phase_overview: overview,
            day_role_actions,
            death_triggers,
            pending_game_end,
        });
    }

    let Some((phase, steps, mut current)) =
        current_phase_steps(&players, events, events.len() + 2, &statuses)
    else {
        return Ok(SnvReplayContext {
            initial_players,
            players,
            phase: Phase::Night,
            current_step: None,
            phase_overview: vec![],
            day_role_actions,
            death_triggers,
            pending_game_end,
        });
    };
    if let Some(step) = current.as_mut() {
        step.information_prompt =
            snv_information_prompt(step, &players, events, &day_role_actions)?;
    }
    let current_id = current.as_ref().map(|step| step.id.as_str());
    let overview = if current.is_none() {
        vec![]
    } else {
        steps
            .into_iter()
            .map(|step| -> Result<PhaseOverviewItem, CoreError> {
                let information_prompt = if Some(step.id.as_str()) == current_id {
                    snv_information_prompt(&step, &players, events, &day_role_actions)?
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
    Ok(SnvReplayContext {
        initial_players,
        players,
        phase,
        current_step: current,
        phase_overview: overview,
        day_role_actions,
        death_triggers,
        pending_game_end,
    })
}

fn validate_death_consequence_event(
    event: &GameEvent,
    pending: &PendingDeathConsequence,
    players: &[Player],
    _prior_events: &[GameEvent],
) -> Result<(), CoreError> {
    let failed = || ErrorKind::ReplayFailed.into_error();
    match (&event.kind, pending.kind) {
        (
            GameEventKind::SweetheartConsequenceResolved { payload },
            DeathConsequenceKind::Sweetheart,
        ) => {
            if pending.actor_impaired_at_trigger {
                if payload.target_player_id.is_some()
                    || payload.outcome
                        != (SweetheartConsequenceOutcome::NoEffect {
                            reason: DeathConsequenceNoEffectReason::ActorImpairedAtDeath,
                        })
                {
                    return Err(failed());
                }
            } else {
                let target_player_id = payload
                    .target_player_id
                    .as_ref()
                    .filter(|target| players.iter().any(|player| player.id == **target))
                    .ok_or_else(failed)?;
                let expected = SweetheartConsequenceOutcome::DrunkApplied {
                    impairment: ActiveImpairment {
                        kind: ImpairmentKind::Drunk,
                        player_id: target_player_id.clone(),
                        source_event_id: event.id.clone(),
                        source_character_id: "sweetheart".into(),
                        expires: ImpairmentExpiry::Never,
                    },
                };
                if payload.outcome != expected {
                    return Err(failed());
                }
            }
        }
        (GameEventKind::BarberConsequenceResolved { payload }, DeathConsequenceKind::Barber) => {
            let no_effect_reason = if pending.actor_impaired_at_trigger {
                Some(DeathConsequenceNoEffectReason::ActorImpairedAtDeath)
            } else if pending.eligible_chooser_player_ids.is_empty() {
                Some(DeathConsequenceNoEffectReason::NoLivingDemon)
            } else {
                None
            };
            if let Some(reason) = no_effect_reason {
                if payload.chooser_demon_player_id.is_some()
                    || payload.decision.is_some()
                    || payload.outcome != (BarberConsequenceOutcome::NoEffect { reason })
                {
                    return Err(failed());
                }
                return Ok(());
            }
            let chooser = payload
                .chooser_demon_player_id
                .as_ref()
                .filter(|chooser| pending.eligible_chooser_player_ids.contains(chooser))
                .ok_or_else(failed)?;
            let expected_outcome = match payload.decision.as_ref().ok_or_else(failed)? {
                BarberDecision::Decline => BarberConsequenceOutcome::Declined,
                BarberDecision::Swap { player_ids } => {
                    if player_ids.len() != 2 || player_ids[0] == player_ids[1] {
                        return Err(failed());
                    }
                    let first = players
                        .iter()
                        .find(|player| player.id == player_ids[0])
                        .ok_or_else(failed)?;
                    let second = players
                        .iter()
                        .find(|player| player.id == player_ids[1])
                        .ok_or_else(failed)?;
                    if [first, second].iter().any(|target| {
                        character_kind(&target.actual_character) == Some(CharacterKind::Demon)
                            && target.id != *chooser
                    }) {
                        return Err(failed());
                    }
                    if first.actual_character == second.actual_character
                        && first.shown_character == second.shown_character
                    {
                        BarberConsequenceOutcome::NoChangeSameCharacter
                    } else {
                        BarberConsequenceOutcome::Swapped {
                            identity_transitions: vec![
                                PlayerIdentityTransition {
                                    player_id: first.id.clone(),
                                    before: identity_state(first),
                                    after: IdentityState {
                                        actual_character: second.actual_character.clone(),
                                        shown_character: second.shown_character.clone(),
                                        alignment: first.alignment,
                                    },
                                },
                                PlayerIdentityTransition {
                                    player_id: second.id.clone(),
                                    before: identity_state(second),
                                    after: IdentityState {
                                        actual_character: first.actual_character.clone(),
                                        shown_character: first.shown_character.clone(),
                                        alignment: second.alignment,
                                    },
                                },
                            ],
                        }
                    }
                }
            };
            if payload.outcome != expected_outcome {
                return Err(failed());
            }
        }
        (GameEventKind::KlutzChoiceResolved { payload }, DeathConsequenceKind::Klutz) => {
            if pending.actor_impaired_at_trigger {
                if payload.target_player_id.is_some()
                    || payload.actor_alignment.is_some()
                    || payload.target_alignment.is_some()
                    || payload.outcome != KlutzChoiceOutcome::ActorImpaired
                {
                    return Err(failed());
                }
                return Ok(());
            }
            let target_player_id = payload
                .target_player_id
                .as_ref()
                .filter(|target| pending.allowed_player_ids.contains(target))
                .ok_or_else(failed)?;
            let target = players
                .iter()
                .find(|player| player.id == *target_player_id && player.alive)
                .ok_or_else(failed)?;
            let expected = if target.alignment == Alignment::Good {
                KlutzChoiceOutcome::Safe
            } else {
                KlutzChoiceOutcome::TeamLost {
                    losing_team: pending.actor_alignment_at_trigger,
                    winning_team: match pending.actor_alignment_at_trigger {
                        Alignment::Good => Alignment::Evil,
                        Alignment::Evil => Alignment::Good,
                    },
                }
            };
            if payload.actor_alignment != Some(pending.actor_alignment_at_trigger)
                || payload.target_alignment != Some(target.alignment)
                || payload.outcome != expected
            {
                return Err(failed());
            }
        }
        _ => return Err(failed()),
    }
    Ok(())
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
            pending_vigormortis_poison_choices: vec![],
            pending_death_consequences: vec![],
            pending_game_end: None,
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
    let SnvReplayContext {
        initial_players,
        players,
        phase,
        current_step,
        phase_overview,
        day_role_actions,
        death_triggers,
        pending_game_end,
    } = replay_context(active_events)?;
    let mut warnings = validate_setup_warnings_for_script(game_file.script_id, &initial_players);
    let day_state = if phase == Phase::Day {
        current_step
            .as_ref()
            .and_then(|step| step_prefix(&step.id).ok())
            .map(|prefix| replay_day_state(active_events, &players, &prefix))
            .transpose()?
    } else {
        None
    };
    let ability_state = SnvAbilityState::build(&players, active_events);
    let active_witch_curse = active_witch_curse(
        phase,
        current_step.as_ref(),
        &players,
        active_events,
        &ability_state,
    );
    let evil_twin_relationships =
        active_evil_twin_relationships(&players, active_events, &ability_state);
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
    let active_impairments = ability_state.active_impairments.clone();
    let pending_vigormortis_poison_choices =
        ability_state.pending_vigormortis_poison_choices.clone();
    let mut automatic_reminders =
        automatic_information_reminders(phase, current_step.as_ref(), &players, &day_role_actions)?;
    automatic_reminders.extend(automatic_vigormortis_reminders(&players, &ability_state));
    automatic_reminders.extend(automatic_fang_gu_reminder(active_events));
    if let Some(curse) = active_witch_curse.as_ref() {
        automatic_reminders.push(AutomaticReminder {
            player_id: curse.target_player_id.clone(),
            character_id: "witch".into(),
            token_id: "cursed".into(),
            label: "저주".into(),
            description: "다음 낮 지명하면 사망합니다.".into(),
        });
    }
    for relationship in &evil_twin_relationships {
        automatic_reminders.push(AutomaticReminder {
            player_id: relationship.twin_player_id.clone(),
            character_id: "evilTwin".into(),
            token_id: "twin".into(),
            label: "쌍둥이".into(),
            description: "사악한 쌍둥이와 연결되어 있습니다.".into(),
        });
    }
    let rule_state = RuleState {
        unannounced_night_death_player_ids,
        unannounced_night_resurrection_player_ids,
        active_impairments: Some(active_impairments),
        automatic_reminders,
        active_witch_curse,
        evil_twin_relationships,
        ..RuleState::default()
    };
    let pending_identity_reveals = pending_identity_reveals(active_events, &players);
    let pending_death_consequences = if !ended_positions.is_empty() {
        vec![]
    } else {
        unresolved_death_consequences(
            &death_triggers,
            active_events,
            &players,
            current_step.as_ref(),
        )
    };
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
            let rules_owned = pending_game_end.as_ref();
            let resolved = match (&payload.source, rules_owned) {
                (Some(source), Some(pending))
                    if *source == game_end_source(pending)
                        && payload.winning_team == pending.winning_team =>
                {
                    Some(pending)
                }
                (None, _) => None,
                _ => return Err(ErrorKind::ReplayFailed.into_error()),
            };
            Ok(GameEndState {
                event_id: event.id.clone(),
                winning_team: payload.winning_team,
                source_event_id: resolved.map(|pending| pending.source_event_id.clone()),
                cause: resolved.map(|pending| pending.cause),
                reason_ko: resolved.map(|pending| pending.reason_ko.clone()),
            })
        })
        .transpose()?;
    let (current_step, phase_overview) = if game_end.is_some() {
        (None, vec![])
    } else {
        (current_step, phase_overview)
    };
    let pending_game_end = game_end.is_none().then_some(pending_game_end).flatten();
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
        pending_vigormortis_poison_choices,
        pending_death_consequences,
        pending_game_end,
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
    let SnvReplayContext {
        players,
        phase,
        current_step,
        day_role_actions,
        death_triggers,
        pending_game_end,
        ..
    } = replay_context(&game_file.game.events)?;
    if let Some(pending) = pending_game_end {
        return match command {
            Command::EndGame { payload } if payload.winning_team == pending.winning_team => {
                propose_end_game(
                    game_file,
                    current_step.as_ref(),
                    phase,
                    payload,
                    Some(game_end_source(&pending)),
                )
            }
            _ => Err(ErrorKind::InvalidStepInput.into_error()),
        };
    }
    let pending_death_consequences = unresolved_death_consequences(
        &death_triggers,
        &game_file.game.events,
        &players,
        current_step.as_ref(),
    );
    if let Some(pending) = pending_death_consequences.first() {
        return match command {
            Command::ResolveSweetheartConsequence { payload }
                if pending.kind == DeathConsequenceKind::Sweetheart =>
            {
                propose_sweetheart_consequence(game_file, phase, &players, pending, payload)
            }
            Command::ResolveBarberConsequence { payload }
                if pending.kind == DeathConsequenceKind::Barber =>
            {
                propose_barber_consequence(game_file, phase, &players, pending, payload)
            }
            Command::ResolveKlutzConsequence { payload }
                if pending.kind == DeathConsequenceKind::Klutz =>
            {
                propose_klutz_consequence(game_file, phase, &players, pending, payload)
            }
            _ => Err(ErrorKind::InvalidStepInput.into_error()),
        };
    }
    let pending_vigormortis_choices =
        SnvAbilityState::build(&players, &game_file.game.events).pending_vigormortis_poison_choices;
    if let Command::ResolveVigormortisPoison { payload } = command {
        return propose_vigormortis_poison_target(
            game_file,
            phase,
            &players,
            &pending_vigormortis_choices,
            payload,
        );
    }
    if !pending_vigormortis_choices.is_empty() {
        return Err(ErrorKind::InvalidStepInput.into_error());
    }
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
                let witch_resolution = payload
                    .input
                    .as_ref()
                    .and_then(|fields| fields.nominator_id.as_deref())
                    .map(|nominator_id| {
                        witch_nomination_resolution(
                            &current_step.id,
                            nominator_id,
                            &players,
                            &game_file.game.events,
                        )
                    })
                    .unwrap_or(WitchNominationResolution::NotApplicable);
                return crate::proposal::propose_nomination_started(
                    game_file,
                    &current_step,
                    &players,
                    payload.input,
                    payload.registration_judgments,
                    witch_resolution,
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
            if current_step.step_type == StepType::WitchDeath {
                return propose_witch_death(game_file, &current_step, &players);
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
            if current_step.character.as_deref() == Some("evilTwin") {
                return propose_evil_twin_pair(game_file, &current_step, &players, payload.input);
            }
            if current_step.character.as_deref() == Some("witch") {
                return propose_witch_curse(game_file, &current_step, &players, payload.input);
            }
            if current_step.character.as_deref().is_some_and(is_demon) {
                return propose_demon_attack(game_file, &current_step, &players, payload.input);
            }
            if current_step.step_type == StepType::Announcement {
                return propose_night_deaths_announcement(game_file, &current_step, &players);
            }
            if current_step.step_type == StepType::EvilInfo {
                let information = snv_evil_information(&current_step, &players, &payload.input)?;
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
            if is_information_character(current_step.character.as_deref()) {
                let information = snv_confirmed_information(
                    &current_step,
                    &players,
                    &game_file.game.events,
                    &day_role_actions,
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
        Command::EndGame { .. } => Err(ErrorKind::InvalidStepInput.into_error()),
        _ => Err(ErrorKind::CommandNotSupportedByScript.into_error()),
    }
}

fn trigger_ref(pending: &PendingDeathConsequence) -> DeathTriggerRef {
    DeathTriggerRef {
        source_event_id: pending.source_event_id.clone(),
        death_sequence: pending.death_sequence,
        player_id: pending.actor_player_id.clone(),
        source_ability_instance_id: pending.source_ability_instance_id.clone(),
    }
}

fn consequence_event(
    game_file: &GameFile,
    phase: Phase,
    id_prefix: &str,
    kind: GameEventKind,
    summary: String,
) -> Proposal {
    Proposal {
        event: GameEvent {
            id: format!("{id_prefix}-{}", game_file.game.events.len() + 1),
            kind,
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
    }
}

fn propose_sweetheart_consequence(
    game_file: &GameFile,
    phase: Phase,
    players: &[Player],
    pending: &PendingDeathConsequence,
    payload: ResolveSweetheartConsequenceCommandPayload,
) -> Result<Proposal, CoreError> {
    if payload.step_id != pending.step_id {
        return Err(ErrorKind::StaleStep.into_error());
    }
    let event_id = format!("sweetheart-consequence-{}", game_file.game.events.len() + 1);
    let (target_player_id, outcome) = if pending.actor_impaired_at_trigger {
        (
            None,
            SweetheartConsequenceOutcome::NoEffect {
                reason: DeathConsequenceNoEffectReason::ActorImpairedAtDeath,
            },
        )
    } else {
        let target_player_id = payload
            .target_player_id
            .as_deref()
            .filter(|target| players.iter().any(|player| player.id == *target))
            .ok_or_else(|| ErrorKind::InvalidStepInput.into_error())?;
        (
            Some(target_player_id.to_string()),
            SweetheartConsequenceOutcome::DrunkApplied {
                impairment: ActiveImpairment {
                    kind: ImpairmentKind::Drunk,
                    player_id: target_player_id.to_string(),
                    source_event_id: event_id.clone(),
                    source_character_id: "sweetheart".into(),
                    expires: ImpairmentExpiry::Never,
                },
            },
        )
    };
    let summary = match outcome {
        SweetheartConsequenceOutcome::DrunkApplied { .. } => "사랑꾼 취함 적용",
        SweetheartConsequenceOutcome::NoEffect { .. } => "사랑꾼 효과 없음",
    };
    let mut proposal = consequence_event(
        game_file,
        phase,
        "sweetheart-consequence",
        GameEventKind::SweetheartConsequenceResolved {
            payload: SweetheartConsequenceResolvedPayload {
                step_id: payload.step_id,
                trigger: trigger_ref(pending),
                target_player_id,
                outcome,
            },
        },
        summary.into(),
    );
    proposal.event.id = event_id;
    Ok(proposal)
}

fn propose_barber_consequence(
    game_file: &GameFile,
    phase: Phase,
    players: &[Player],
    pending: &PendingDeathConsequence,
    payload: ResolveBarberConsequenceCommandPayload,
) -> Result<Proposal, CoreError> {
    if payload.step_id != pending.step_id {
        return Err(ErrorKind::StaleStep.into_error());
    }
    let chooser = payload.chooser_demon_player_id.as_ref();
    let outcome = if pending.actor_impaired_at_trigger {
        BarberConsequenceOutcome::NoEffect {
            reason: DeathConsequenceNoEffectReason::ActorImpairedAtDeath,
        }
    } else if pending.eligible_chooser_player_ids.is_empty() {
        BarberConsequenceOutcome::NoEffect {
            reason: DeathConsequenceNoEffectReason::NoLivingDemon,
        }
    } else {
        let chooser = chooser
            .map(String::as_str)
            .filter(|chooser| {
                pending
                    .eligible_chooser_player_ids
                    .iter()
                    .any(|eligible| eligible == chooser)
            })
            .ok_or_else(|| ErrorKind::InvalidStepInput.into_error())?;
        match payload
            .decision
            .as_ref()
            .ok_or_else(|| ErrorKind::InvalidStepInput.into_error())?
        {
            BarberDecision::Decline => BarberConsequenceOutcome::Declined,
            BarberDecision::Swap { player_ids } => {
                if player_ids.len() != 2 || player_ids[0] == player_ids[1] {
                    return Err(ErrorKind::InvalidStepInput.into_error());
                }
                let first = players
                    .iter()
                    .find(|player| player.id == player_ids[0])
                    .ok_or_else(|| ErrorKind::InvalidStepInput.into_error())?;
                let second = players
                    .iter()
                    .find(|player| player.id == player_ids[1])
                    .ok_or_else(|| ErrorKind::InvalidStepInput.into_error())?;
                if [first, second].iter().any(|target| {
                    character_kind(&target.actual_character) == Some(CharacterKind::Demon)
                        && target.id != chooser
                }) {
                    return Err(ErrorKind::InvalidStepInput.into_error());
                }
                if first.actual_character == second.actual_character
                    && first.shown_character == second.shown_character
                {
                    BarberConsequenceOutcome::NoChangeSameCharacter
                } else {
                    BarberConsequenceOutcome::Swapped {
                        identity_transitions: vec![
                            PlayerIdentityTransition {
                                player_id: first.id.clone(),
                                before: identity_state(first),
                                after: IdentityState {
                                    actual_character: second.actual_character.clone(),
                                    shown_character: second.shown_character.clone(),
                                    alignment: first.alignment,
                                },
                            },
                            PlayerIdentityTransition {
                                player_id: second.id.clone(),
                                before: identity_state(second),
                                after: IdentityState {
                                    actual_character: first.actual_character.clone(),
                                    shown_character: first.shown_character.clone(),
                                    alignment: second.alignment,
                                },
                            },
                        ],
                    }
                }
            }
        }
    };
    let summary = match outcome {
        BarberConsequenceOutcome::Swapped { .. } => "이발사 직업 교환",
        BarberConsequenceOutcome::Declined => "이발사 교환 거절",
        BarberConsequenceOutcome::NoChangeSameCharacter => "이발사 교환 · 동일 직업",
        BarberConsequenceOutcome::NoEffect { .. } => "이발사 효과 없음",
    };
    let no_effect = matches!(outcome, BarberConsequenceOutcome::NoEffect { .. });
    let chooser_demon_player_id = (!no_effect)
        .then_some(payload.chooser_demon_player_id)
        .flatten();
    let decision = (!no_effect).then_some(payload.decision).flatten();
    Ok(consequence_event(
        game_file,
        phase,
        "barber-consequence",
        GameEventKind::BarberConsequenceResolved {
            payload: BarberConsequenceResolvedPayload {
                step_id: payload.step_id,
                trigger: trigger_ref(pending),
                chooser_demon_player_id,
                decision,
                outcome,
            },
        },
        summary.into(),
    ))
}

fn propose_klutz_consequence(
    game_file: &GameFile,
    phase: Phase,
    players: &[Player],
    pending: &PendingDeathConsequence,
    payload: ResolveKlutzConsequenceCommandPayload,
) -> Result<Proposal, CoreError> {
    if payload.step_id != pending.step_id {
        return Err(ErrorKind::StaleStep.into_error());
    }
    let (target_player_id, actor_alignment, target_alignment, outcome) =
        if pending.actor_impaired_at_trigger {
            (None, None, None, KlutzChoiceOutcome::ActorImpaired)
        } else {
            let target_player_id = payload
                .target_player_id
                .as_deref()
                .filter(|target| {
                    pending
                        .allowed_player_ids
                        .iter()
                        .any(|allowed| allowed == target)
                })
                .ok_or_else(|| ErrorKind::InvalidStepInput.into_error())?;
            let target = players
                .iter()
                .find(|player| player.id == target_player_id && player.alive)
                .ok_or_else(|| ErrorKind::InvalidStepInput.into_error())?;
            let outcome = if target.alignment == Alignment::Good {
                KlutzChoiceOutcome::Safe
            } else {
                let winning_team = match pending.actor_alignment_at_trigger {
                    Alignment::Good => Alignment::Evil,
                    Alignment::Evil => Alignment::Good,
                };
                KlutzChoiceOutcome::TeamLost {
                    losing_team: pending.actor_alignment_at_trigger,
                    winning_team,
                }
            };
            (
                Some(target.id.clone()),
                Some(pending.actor_alignment_at_trigger),
                Some(target.alignment),
                outcome,
            )
        };
    Ok(consequence_event(
        game_file,
        phase,
        "klutz-choice",
        GameEventKind::KlutzChoiceResolved {
            payload: KlutzChoiceResolvedPayload {
                step_id: payload.step_id,
                trigger: trigger_ref(pending),
                target_player_id,
                actor_alignment,
                target_alignment,
                outcome,
            },
        },
        "얼뜨기 선택 확정".into(),
    ))
}

fn propose_vigormortis_poison_target(
    game_file: &GameFile,
    phase: Phase,
    players: &[Player],
    pending_choices: &[PendingVigormortisPoisonChoice],
    payload: ResolveVigormortisPoisonCommandPayload,
) -> Result<Proposal, CoreError> {
    let pending = pending_choices
        .iter()
        .find(|choice| choice.source_event_id == payload.source_event_id)
        .ok_or_else(|| ErrorKind::InvalidStepInput.into_error())?;
    if !pending
        .allowed_player_ids
        .contains(&payload.target_player_id)
    {
        return Err(ErrorKind::InvalidStepInput.into_error());
    }
    let target = players
        .iter()
        .find(|player| player.id == payload.target_player_id)
        .ok_or_else(|| ErrorKind::InvalidStepInput.into_error())?;
    let summary = format!(
        "비고르모르티스 중독 이동: {}번 {}",
        target.seat, target.name
    );
    Ok(Proposal {
        event: GameEvent {
            id: format!("vigormortis-poison-{}", game_file.game.events.len() + 1),
            kind: GameEventKind::VigormortisPoisonTargetChanged {
                payload: VigormortisPoisonTargetChangedPayload {
                    source_event_id: payload.source_event_id,
                    previous_target_player_id: pending.previous_target_player_id.clone(),
                    target_player_id: payload.target_player_id,
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
    _current_step: Option<&PhaseStep>,
    phase: Phase,
    payload: EndGameCommandPayload,
    source: Option<GameEndSource>,
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
                    source,
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

fn propose_witch_death(
    game_file: &GameFile,
    step: &PhaseStep,
    players: &[Player],
) -> Result<Proposal, CoreError> {
    let player_id = step
        .player_id
        .clone()
        .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
    let player = players
        .iter()
        .find(|player| player.id == player_id && player.alive)
        .ok_or_else(|| ErrorKind::InvalidStepInput.into_error())?;
    let nomination_step_id = step
        .id
        .strip_suffix(":witchDeath")
        .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
    let valid_trigger = game_file.game.events.iter().any(|event| matches!(
        &event.kind,
        GameEventKind::NominationStarted { payload }
            if payload.step_id == nomination_step_id
                && payload.nominator_id == player.id
                && matches!(payload.witch_resolution, WitchNominationResolution::DeathPending { .. })
    ));
    if !valid_trigger {
        return Err(ErrorKind::InvalidStepInput.into_error());
    }
    Ok(phase_proposal(
        game_file,
        step,
        GameEventKind::DeathConfirmed {
            payload: DeathEventPayload {
                player_id: player.id.clone(),
                step_id: Some(step.id.clone()),
            },
        },
        crate::messages::execution_death_event_summary(players, &player.id),
        vec![],
    ))
}

fn propose_evil_twin_pair(
    game_file: &GameFile,
    step: &PhaseStep,
    players: &[Player],
    input: crate::model::StepInput,
) -> Result<Proposal, CoreError> {
    let actor_player_id = step
        .player_id
        .clone()
        .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
    let twin_player_id = input
        .and_then(|fields| fields.player_ids)
        .and_then(|ids| ids.into_iter().next())
        .ok_or_else(|| ErrorKind::MissingStepInput.into_error())?;
    let actor = players
        .iter()
        .find(|player| player.id == actor_player_id)
        .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
    let twin = players
        .iter()
        .find(|player| player.id == twin_player_id)
        .ok_or_else(|| ErrorKind::InvalidStepInput.into_error())?;
    if actor.id == twin.id || actor.alignment == twin.alignment {
        return Err(ErrorKind::InvalidStepInput.into_error());
    }
    Ok(phase_proposal(
        game_file,
        step,
        GameEventKind::EvilTwinPairAssigned {
            payload: EvilTwinPairAssignedPayload {
                step_id: step.id.clone(),
                actor_player_id: actor.id.clone(),
                twin_player_id: twin.id.clone(),
                source_ability_instance_id: actor.ability_instance.id.clone(),
                actor_alignment: actor.alignment,
                twin_alignment: twin.alignment,
            },
        },
        format!(
            "쌍둥이 지정: {}번 {} · {}번 {}",
            actor.seat, actor.name, twin.seat, twin.name
        ),
        vec![],
    ))
}

fn propose_witch_curse(
    game_file: &GameFile,
    step: &PhaseStep,
    players: &[Player],
    input: crate::model::StepInput,
) -> Result<Proposal, CoreError> {
    let actor_player_id = step
        .player_id
        .clone()
        .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
    let target_player_id = input
        .and_then(|fields| fields.player_ids)
        .and_then(|ids| ids.into_iter().next())
        .ok_or_else(|| ErrorKind::MissingStepInput.into_error())?;
    let actor = players
        .iter()
        .find(|player| player.id == actor_player_id)
        .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
    let target = players
        .iter()
        .find(|player| player.id == target_player_id)
        .ok_or_else(|| ErrorKind::InvalidStepInput.into_error())?;
    let effective = !SnvAbilityState::build(players, &game_file.game.events).is_impaired(&actor.id);
    Ok(phase_proposal(
        game_file,
        step,
        GameEventKind::WitchCurseAssigned {
            payload: WitchCurseAssignedPayload {
                step_id: step.id.clone(),
                actor_player_id: actor.id.clone(),
                target_player_id: target.id.clone(),
                source_ability_instance_id: actor.ability_instance.id.clone(),
                effective,
            },
        },
        format!("마녀 저주 지정: {}번 {}", target.seat, target.name),
        vec![],
    ))
}

fn witch_nomination_resolution(
    nomination_step_id: &str,
    nominator_id: &str,
    players: &[Player],
    events: &[GameEvent],
) -> WitchNominationResolution {
    if players.iter().filter(|player| player.alive).count() == 3
        || !players
            .iter()
            .any(|player| player.id == nominator_id && player.alive)
    {
        return WitchNominationResolution::NotApplicable;
    }
    let nomination_day = nomination_step_id.split(':').next().unwrap_or_default();
    let ability_state = SnvAbilityState::build(players, events);
    events
        .iter()
        .rev()
        .find_map(|event| {
            let GameEventKind::WitchCurseAssigned { payload } = &event.kind else {
                return None;
            };
            if !payload.effective
                || payload.target_player_id != nominator_id
                || witch_curse_day(&payload.step_id).as_deref() != Some(nomination_day)
            {
                return None;
            }
            let actor = players.iter().find(|player| {
                player.id == payload.actor_player_id
                    && player.ability_instance.id == payload.source_ability_instance_id
            })?;
            ability_state.ability_functions(actor, "witch").then(|| {
                WitchNominationResolution::DeathPending {
                    curse_event_id: event.id.clone(),
                    witch_player_id: actor.id.clone(),
                    source_ability_instance_id: actor.ability_instance.id.clone(),
                }
            })
        })
        .unwrap_or(WitchNominationResolution::NotApplicable)
}

fn witch_curse_day(step_id: &str) -> Option<String> {
    let phase = step_id.split(':').next()?;
    if phase == "firstNight" {
        return Some("day".into());
    }
    let suffix = phase.strip_prefix("night")?;
    let night_cycle = if suffix.is_empty() {
        1
    } else {
        suffix.parse::<usize>().ok()?
    };
    let day_cycle = night_cycle + 1;
    Some(if day_cycle == 1 {
        "day".into()
    } else {
        format!("day{day_cycle}")
    })
}

fn active_witch_curse(
    phase: Phase,
    current_step: Option<&PhaseStep>,
    players: &[Player],
    events: &[GameEvent],
    ability_state: &SnvAbilityState,
) -> Option<ActiveWitchCurse> {
    if players.iter().filter(|player| player.alive).count() == 3 {
        return None;
    }
    let current_prefix = current_step
        .and_then(|step| step.id.split(':').next())
        .unwrap_or_default();
    events.iter().rev().find_map(|event| {
        let GameEventKind::WitchCurseAssigned { payload } = &event.kind else {
            return None;
        };
        let applies_to_day = witch_curse_day(&payload.step_id)?;
        let assignment_prefix = payload.step_id.split(':').next().unwrap_or_default();
        let in_lifetime = match phase {
            Phase::FirstNight | Phase::Night => current_prefix == assignment_prefix,
            Phase::Day => current_prefix == applies_to_day,
            Phase::Setup => false,
        };
        if !in_lifetime
            || events.iter().any(|candidate| {
                matches!(
                    &candidate.kind,
                    GameEventKind::NominationStarted { payload: nomination }
                        if matches!(
                            &nomination.witch_resolution,
                            WitchNominationResolution::DeathPending { curse_event_id, .. }
                                if curse_event_id == &event.id
                        )
                )
            })
        {
            return None;
        }
        let actor = players.iter().find(|player| {
            player.id == payload.actor_player_id
                && player.ability_instance.id == payload.source_ability_instance_id
        })?;
        if !payload.effective || !ability_state.ability_functions(actor, "witch") {
            return None;
        }
        Some(ActiveWitchCurse {
            source_event_id: event.id.clone(),
            source_player_id: actor.id.clone(),
            source_ability_instance_id: actor.ability_instance.id.clone(),
            target_player_id: payload.target_player_id.clone(),
            applies_to_day,
            effective: true,
        })
    })
}

fn active_evil_twin_relationships(
    players: &[Player],
    events: &[GameEvent],
    ability_state: &SnvAbilityState,
) -> Vec<EvilTwinRelationship> {
    let mut latest =
        HashMap::<AbilityInstanceId, (&GameEvent, &EvilTwinPairAssignedPayload)>::new();
    for event in events {
        if let GameEventKind::EvilTwinPairAssigned { payload } = &event.kind {
            latest.insert(payload.source_ability_instance_id.clone(), (event, payload));
        }
    }
    latest
        .into_values()
        .filter_map(|(event, payload)| {
            let actor = players.iter().find(|player| {
                player.id == payload.actor_player_id
                    && player.actual_character == "evilTwin"
                    && player.ability_instance.id == payload.source_ability_instance_id
                    && player.alive
            })?;
            let twin = players
                .iter()
                .find(|player| player.id == payload.twin_player_id)?;
            if actor.alignment == twin.alignment || ability_state.is_impaired(&actor.id) {
                return None;
            }
            Some(EvilTwinRelationship {
                source_event_id: event.id.clone(),
                ability_owner_player_id: actor.id.clone(),
                twin_player_id: twin.id.clone(),
                source_ability_instance_id: actor.ability_instance.id.clone(),
            })
        })
        .collect()
}

fn living_evil_twin_pair(players: &[Player], relationships: &[EvilTwinRelationship]) -> bool {
    relationships.iter().any(|relationship| {
        players
            .iter()
            .any(|player| player.id == relationship.ability_owner_player_id && player.alive)
            && players
                .iter()
                .any(|player| player.id == relationship.twin_player_id && player.alive)
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
    let actor = players
        .iter()
        .find(|player| player.id == payload.actor_player_id)
        .ok_or_else(|| ErrorKind::InvalidDayActionActor.into_error())?;
    let active_reasons =
        day_action_active_reasons(actor, &character_id, players, &game_file.game.events);
    let canonical = DayActionRecordedPayload {
        day_id: payload.day_id,
        actor_player_id: payload.actor_player_id,
        character_id,
        active_reasons,
        record: payload.record,
    };
    validate_day_action_payload(
        &canonical,
        Phase::Day,
        current_step,
        players,
        &game_file.game.events,
    )?;
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
    let actor_impaired =
        SnvAbilityState::build(players, &game_file.game.events).is_impaired(&actor.id);
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
    let actor_impaired =
        SnvAbilityState::build(players, &game_file.game.events).is_impaired(&actor.id);
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
    let selected_player_ids = input
        .as_ref()
        .and_then(|fields| fields.player_ids.as_ref())
        .cloned()
        .ok_or_else(|| ErrorKind::InvalidStepInput.into_error())?;
    let target_player_id = selected_player_ids
        .first()
        .cloned()
        .ok_or_else(|| ErrorKind::InvalidStepInput.into_error())?;
    let target = players
        .iter()
        .find(|player| player.id == target_player_id)
        .ok_or_else(|| ErrorKind::InvalidStepInput.into_error())?;
    let prefix = SnvStepKey::parse(&step.id)
        .map(|step| step.phase_token())
        .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
    let pit_hag_created_demon = pit_hag_demon_creation(&game_file.game.events, prefix).is_some();
    let actor_impaired =
        SnvAbilityState::build(players, &game_file.game.events).is_impaired(&actor.id);
    let vigormortis_effect = if actor_character_id == "vigormortis"
        && target.alive
        && character_kind(&target.actual_character) == Some(CharacterKind::Minion)
        && !pit_hag_created_demon
    {
        let candidates = nearest_townsfolk_neighbors(players, &target.id);
        let poison_target_player_id = selected_player_ids.get(1).cloned();
        if candidates.is_empty() {
            if poison_target_player_id.is_some() {
                return Err(ErrorKind::InvalidStepInput.into_error());
            }
        } else if !poison_target_player_id
            .as_ref()
            .is_some_and(|target| candidates.contains(target))
        {
            return Err(ErrorKind::InvalidStepInput.into_error());
        }
        Some(VigormortisEffect {
            minion_player_id: target.id.clone(),
            source_ability_instance_id: actor.ability_instance.id.clone(),
            poison_target_player_id,
        })
    } else {
        if selected_player_ids.len() != 1 {
            return Err(ErrorKind::InvalidStepInput.into_error());
        }
        None
    };
    let (outcome, outcome_label, warnings) = if pit_hag_created_demon {
        (
            DemonAttackOutcome::NoEffect {
                reason: DemonAttackNoEffectReason::PitHagCreatedDemon,
            },
            "사망 대상 후보 기록",
            vec![],
        )
    } else if actor_impaired {
        (
            DemonAttackOutcome::NoEffect {
                reason: DemonAttackNoEffectReason::ActorImpaired,
            },
            "취함/중독 · 사망 없음",
            vec![],
        )
    } else if target.alive
        && actor_character_id == "fangGu"
        && character_kind(&target.actual_character) == Some(CharacterKind::Outsider)
        && automatic_fang_gu_reminder(&game_file.game.events).is_empty()
    {
        (
            DemonAttackOutcome::FangGuJump {
                death: NightDeath {
                    player_id: actor_player_id.clone(),
                    cause: NightDeathCause::DemonAttack {
                        actor_player_id: actor_player_id.clone(),
                        actor_character_id: actor_character_id.clone(),
                        target_player_id: target_player_id.clone(),
                    },
                },
                source_ability_instance_id: actor.ability_instance.id.clone(),
                identity_transition: PlayerIdentityTransition {
                    player_id: target_player_id.clone(),
                    before: identity_state(target),
                    after: IdentityState {
                        actual_character: "fangGu".into(),
                        shown_character: "fangGu".into(),
                        alignment: Alignment::Evil,
                    },
                },
            },
            "팡 구 이동 · 기존 팡 구 사망",
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
                vigormortis_effect,
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
    let prefix = SnvStepKey::parse(&step.id)
        .map(|step| step.phase_token())
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

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use super::*;
    use crate::contracts::{Game, ScriptId};
    use serde_json::json;

    #[test]
    fn klutz_choice_uses_healthy_trigger_snapshot_even_when_currently_impaired() {
        let events: Vec<GameEvent> = serde_json::from_value(json!([
            {
                "id": "setup",
                "type": "setupConfirmed",
                "phase": "setup",
                "payload": { "players": [
                    { "id": "player-1", "seat": 1, "name": "Sweetheart", "actualCharacter": "sweetheart", "shownCharacter": "sweetheart" },
                    { "id": "player-2", "seat": 2, "name": "Barber", "actualCharacter": "barber", "shownCharacter": "barber" },
                    { "id": "player-3", "seat": 3, "name": "Klutz", "actualCharacter": "klutz", "shownCharacter": "klutz" },
                    { "id": "player-4", "seat": 4, "name": "Clockmaker", "actualCharacter": "clockmaker", "shownCharacter": "clockmaker" },
                    { "id": "player-5", "seat": 5, "name": "Savant", "actualCharacter": "savant", "shownCharacter": "savant" },
                    { "id": "player-6", "seat": 6, "name": "Pit-Hag", "actualCharacter": "pitHag", "shownCharacter": "pitHag" },
                    { "id": "player-7", "seat": 7, "name": "Vortox", "actualCharacter": "vortox", "shownCharacter": "vortox" }
                ] },
                "summary": "setup",
                "createdAt": "2026-07-29T00:00:00.000Z"
            },
            {
                "id": "sweetheart-2",
                "type": "sweetheartConsequenceResolved",
                "phase": "day",
                "payload": {
                    "stepId": "day:sweetheart",
                    "trigger": {
                        "sourceEventId": "death-1",
                        "deathSequence": 1,
                        "playerId": "sweetheart",
                        "sourceAbilityInstanceId": "setup:sweetheart"
                    },
                    "targetPlayerId": "player-3",
                    "outcome": {
                        "kind": "drunkApplied",
                        "impairment": {
                            "kind": "drunk",
                            "playerId": "player-3",
                            "sourceEventId": "sweetheart-2",
                            "sourceCharacterId": "sweetheart",
                            "expires": "never"
                        }
                    }
                },
                "summary": "사랑꾼 취함 적용",
                "createdAt": "2026-07-29T00:01:00.000Z"
            }
        ]))
        .unwrap();
        let players = setup_players(&events).unwrap();
        let game_file = GameFile {
            schema_version: 3,
            script_id: ScriptId::SectsAndViolets,
            game: Game {
                updated_at: None,
                events,
            },
        };
        let pending = PendingDeathConsequence {
            step_id: "day:death:klutz".into(),
            kind: DeathConsequenceKind::Klutz,
            source_event_id: "death-klutz".into(),
            death_sequence: 1,
            actor_player_id: "player-3".into(),
            source_ability_instance_id: AbilityInstanceId::new("setup", "player-3"),
            actor_impaired_at_trigger: false,
            actor_alignment_at_trigger: Alignment::Good,
            allowed_player_ids: vec!["player-7".into()],
            eligible_chooser_player_ids: vec![],
        };

        let proposal = propose_klutz_consequence(
            &game_file,
            Phase::Day,
            &players,
            &pending,
            ResolveKlutzConsequenceCommandPayload {
                step_id: pending.step_id.clone(),
                target_player_id: Some("player-7".into()),
                expected_event_count: game_file.game.events.len(),
            },
        )
        .unwrap();

        let GameEventKind::KlutzChoiceResolved { payload } = proposal.event.kind else {
            panic!("expected Klutz choice event");
        };
        assert_eq!(
            payload.outcome,
            KlutzChoiceOutcome::TeamLost {
                losing_team: Alignment::Good,
                winning_team: Alignment::Evil,
            }
        );
    }

    #[test]
    fn all_twenty_five_character_ids_have_exhaustive_typed_metadata() {
        let mut ids = HashSet::new();
        let mut kind_counts = [0; 4];
        for character in SnvCharacterId::ALL {
            assert_eq!(SnvCharacterId::parse(character.as_str()), Some(character));
            assert!(ids.insert(character.as_str()));
            let kind_index = match character.metadata().kind {
                CharacterKind::Townsfolk => 0,
                CharacterKind::Outsider => 1,
                CharacterKind::Minion => 2,
                CharacterKind::Demon => 3,
            };
            kind_counts[kind_index] += 1;

            let metadata = character.metadata();
            let _complete_policy = (
                metadata.input,
                metadata.support,
                metadata.activity,
                metadata.once_per_ability_instance,
                metadata.same_night_acquisition,
            );
        }

        assert_eq!(ids.len(), 25);
        assert_eq!(kind_counts, [13, 4, 4, 4]);
        assert_eq!(SnvCharacterId::parse("notACharacter"), None);
    }

    #[test]
    fn catalog_preserves_the_complete_first_and_later_night_scheduling_policy() {
        let mut first = SnvCharacterId::ALL
            .iter()
            .copied()
            .filter_map(|character| {
                character
                    .metadata()
                    .first_night_rank
                    .map(|rank| (rank, character.as_str()))
            })
            .collect::<Vec<_>>();
        first.sort_unstable();
        assert_eq!(
            first,
            [
                (0, "philosopher"),
                (3, "snakeCharmer"),
                (4, "evilTwin"),
                (5, "witch"),
                (6, "cerenovus"),
                (7, "clockmaker"),
                (8, "dreamer"),
                (9, "seamstress"),
                (10, "mathematician"),
            ]
        );

        let mut later = SnvCharacterId::ALL
            .iter()
            .copied()
            .filter_map(|character| {
                character
                    .metadata()
                    .later_night_rank
                    .map(|rank| (rank, character.as_str()))
            })
            .collect::<Vec<_>>();
        later.sort_unstable();
        assert_eq!(
            later.iter().map(|(_, id)| *id).collect::<HashSet<_>>(),
            [
                "philosopher",
                "snakeCharmer",
                "witch",
                "cerenovus",
                "pitHag",
                "fangGu",
                "vigormortis",
                "noDashii",
                "vortox",
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
            .into_iter()
            .collect(),
        );
        assert!(later
            .iter()
            .filter(|(rank, _)| *rank == 5)
            .all(|(_, id)| is_demon(id)));
    }

    #[test]
    fn later_night_does_not_schedule_a_base_witch_after_deaths_leave_three_alive() {
        let events: Vec<GameEvent> = serde_json::from_value(json!([{
            "id": "setup",
            "type": "setupConfirmed",
            "phase": "setup",
            "payload": { "players": [
                { "id": "player-1", "seat": 1, "name": "Clockmaker", "actualCharacter": "clockmaker", "shownCharacter": "clockmaker" },
                { "id": "player-2", "seat": 2, "name": "Dreamer", "actualCharacter": "dreamer", "shownCharacter": "dreamer" },
                { "id": "player-3", "seat": 3, "name": "Savant", "actualCharacter": "savant", "shownCharacter": "savant" },
                { "id": "player-4", "seat": 4, "name": "Artist", "actualCharacter": "artist", "shownCharacter": "artist" },
                { "id": "player-5", "seat": 5, "name": "Witch", "actualCharacter": "witch", "shownCharacter": "witch" },
                { "id": "player-6", "seat": 6, "name": "Sage", "actualCharacter": "sage", "shownCharacter": "sage" },
                { "id": "player-7", "seat": 7, "name": "Vortox", "actualCharacter": "vortox", "shownCharacter": "vortox" }
            ] },
            "summary": "setup",
            "createdAt": "2026-07-30T00:00:00.000Z"
        }]))
        .unwrap();
        let mut players = setup_players(&events).unwrap();
        for player in &mut players[..4] {
            player.alive = false;
        }

        let steps = later_night_steps(&players, &events, 1);

        assert_eq!(players.iter().filter(|player| player.alive).count(), 3);
        assert!(steps
            .iter()
            .all(|step| step.character.as_deref() != Some("witch")));
    }
}

use std::collections::{HashMap, HashSet};

mod step_key;
use step_key::{PhaseKey as BmrPhaseKey, StepKey as BmrStepKey};

use crate::{
    contracts::{
        Command, GameEvent, GameEventKind, GameFile, ManualPhaseStepOutcome,
        ManualPhaseStepResolvedPayload, PhaseStepEventPayload, Proposal, ReplayState, RuleState,
        ScriptId, SetupDistribution, SetupDistributionOption, SetupDistributionResult,
        StepIdPayload,
    },
    error::{CoreError, ErrorKind},
    messages::{phase_step_event_summary, phase_step_preview},
    model::{
        CharacterKind, Phase, PhaseOverviewItem, PhaseStep, PhaseStepStatus, PhaseStepSupport,
        Player, RequiredInputKind, StepType,
    },
    phase::{phase_prefix, phase_transition_step, required_characters, required_none, simple_step},
    setup::{
        player_from_setup_input_for_script, validate_setup_inputs_for_script,
        validate_setup_warnings_for_script,
    },
};
use serde_json::json;

const ADD_OUTSIDER: &str = "addOutsider";
const REMOVE_OUTSIDER: &str = "removeOutsider";

#[derive(Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub(crate) enum BmrCharacterId {
    Grandmother,
    Sailor,
    Chambermaid,
    Exorcist,
    Innkeeper,
    Gambler,
    Gossip,
    Courtier,
    Professor,
    Minstrel,
    TeaLady,
    Pacifist,
    Fool,
    Tinker,
    Moonchild,
    Goon,
    Lunatic,
    Godfather,
    DevilsAdvocate,
    Assassin,
    Mastermind,
    Zombuul,
    Pukka,
    Shabaloth,
    Po,
}

impl BmrCharacterId {
    pub(crate) const ALL: [Self; 25] = [
        Self::Grandmother,
        Self::Sailor,
        Self::Chambermaid,
        Self::Exorcist,
        Self::Innkeeper,
        Self::Gambler,
        Self::Gossip,
        Self::Courtier,
        Self::Professor,
        Self::Minstrel,
        Self::TeaLady,
        Self::Pacifist,
        Self::Fool,
        Self::Tinker,
        Self::Moonchild,
        Self::Goon,
        Self::Lunatic,
        Self::Godfather,
        Self::DevilsAdvocate,
        Self::Assassin,
        Self::Mastermind,
        Self::Zombuul,
        Self::Pukka,
        Self::Shabaloth,
        Self::Po,
    ];

    pub(crate) fn parse(value: &str) -> Option<Self> {
        Some(match value {
            "grandmother" => Self::Grandmother,
            "sailor" => Self::Sailor,
            "chambermaid" => Self::Chambermaid,
            "exorcist" => Self::Exorcist,
            "innkeeper" => Self::Innkeeper,
            "gambler" => Self::Gambler,
            "gossip" => Self::Gossip,
            "courtier" => Self::Courtier,
            "professor" => Self::Professor,
            "minstrel" => Self::Minstrel,
            "teaLady" => Self::TeaLady,
            "pacifist" => Self::Pacifist,
            "fool" => Self::Fool,
            "tinker" => Self::Tinker,
            "moonchild" => Self::Moonchild,
            "goon" => Self::Goon,
            "lunatic" => Self::Lunatic,
            "godfather" => Self::Godfather,
            "devilsAdvocate" => Self::DevilsAdvocate,
            "assassin" => Self::Assassin,
            "mastermind" => Self::Mastermind,
            "zombuul" => Self::Zombuul,
            "pukka" => Self::Pukka,
            "shabaloth" => Self::Shabaloth,
            "po" => Self::Po,
            _ => return None,
        })
    }

    pub(crate) const fn as_str(self) -> &'static str {
        match self {
            Self::Grandmother => "grandmother",
            Self::Sailor => "sailor",
            Self::Chambermaid => "chambermaid",
            Self::Exorcist => "exorcist",
            Self::Innkeeper => "innkeeper",
            Self::Gambler => "gambler",
            Self::Gossip => "gossip",
            Self::Courtier => "courtier",
            Self::Professor => "professor",
            Self::Minstrel => "minstrel",
            Self::TeaLady => "teaLady",
            Self::Pacifist => "pacifist",
            Self::Fool => "fool",
            Self::Tinker => "tinker",
            Self::Moonchild => "moonchild",
            Self::Goon => "goon",
            Self::Lunatic => "lunatic",
            Self::Godfather => "godfather",
            Self::DevilsAdvocate => "devilsAdvocate",
            Self::Assassin => "assassin",
            Self::Mastermind => "mastermind",
            Self::Zombuul => "zombuul",
            Self::Pukka => "pukka",
            Self::Shabaloth => "shabaloth",
            Self::Po => "po",
        }
    }

    pub(crate) const fn kind(self) -> CharacterKind {
        match self {
            Self::Grandmother
            | Self::Sailor
            | Self::Chambermaid
            | Self::Exorcist
            | Self::Innkeeper
            | Self::Gambler
            | Self::Gossip
            | Self::Courtier
            | Self::Professor
            | Self::Minstrel
            | Self::TeaLady
            | Self::Pacifist
            | Self::Fool => CharacterKind::Townsfolk,
            Self::Tinker | Self::Moonchild | Self::Goon | Self::Lunatic => CharacterKind::Outsider,
            Self::Godfather | Self::DevilsAdvocate | Self::Assassin | Self::Mastermind => {
                CharacterKind::Minion
            }
            Self::Zombuul | Self::Pukka | Self::Shabaloth | Self::Po => CharacterKind::Demon,
        }
    }
}

pub(crate) fn character_kind(character: &str) -> Option<CharacterKind> {
    BmrCharacterId::parse(character).map(BmrCharacterId::kind)
}

pub(crate) fn setup_distribution_result(
    base: SetupDistribution,
    actual_characters: &[String],
) -> SetupDistributionResult {
    if !has_godfather(actual_characters) {
        return SetupDistributionResult::Distribution(base);
    }
    SetupDistributionResult::Options {
        options: setup_options(base),
    }
}

pub(crate) fn selected_setup_distribution(
    base: SetupDistribution,
    actual_characters: &[String],
    setup_choice_id: Option<&str>,
) -> Result<SetupDistribution, CoreError> {
    if !has_godfather(actual_characters) {
        return if setup_choice_id.is_none() {
            Ok(base)
        } else {
            Err(ErrorKind::InvalidSetupChoice.into_error())
        };
    }
    setup_options(base)
        .into_iter()
        .find(|option| Some(option.id.as_str()) == setup_choice_id)
        .map(|option| option.distribution)
        .ok_or_else(|| ErrorKind::InvalidSetupChoice.into_error())
}

fn has_godfather(actual_characters: &[String]) -> bool {
    actual_characters
        .iter()
        .any(|character| character == BmrCharacterId::Godfather.as_str())
}

fn setup_options(base: SetupDistribution) -> Vec<SetupDistributionOption> {
    let mut options = vec![SetupDistributionOption {
        id: ADD_OUTSIDER.into(),
        distribution: SetupDistribution {
            townsfolk: base.townsfolk.saturating_sub(1),
            outsider: base.outsider + 1,
            ..base
        },
    }];
    if base.outsider > 0 {
        options.push(SetupDistributionOption {
            id: REMOVE_OUTSIDER.into(),
            distribution: SetupDistribution {
                townsfolk: base.townsfolk + 1,
                outsider: base.outsider - 1,
                ..base
            },
        });
    }
    options
}

#[derive(Debug, Copy, Clone)]
#[cfg_attr(not(test), allow(dead_code))]
struct ReminderMetadata {
    character: BmrCharacterId,
    token_id: &'static str,
    physical_count: u8,
}

// Registered now for the BMR script boundary; runtime reminder generation is intentionally
// deferred until the individual character rules are implemented.
#[cfg_attr(not(test), allow(dead_code))]
const REMINDER_INVENTORY: [ReminderMetadata; 34] = [
    reminder(BmrCharacterId::Grandmother, "grandchild", 1),
    reminder(BmrCharacterId::Grandmother, "dead", 1),
    reminder(BmrCharacterId::Sailor, "drunk", 1),
    reminder(BmrCharacterId::Exorcist, "chosen", 1),
    reminder(BmrCharacterId::Innkeeper, "safe", 2),
    reminder(BmrCharacterId::Innkeeper, "drunk", 1),
    reminder(BmrCharacterId::Gambler, "dead", 1),
    reminder(BmrCharacterId::Gossip, "dead", 1),
    reminder(BmrCharacterId::Courtier, "drunk1", 1),
    reminder(BmrCharacterId::Courtier, "drunk2", 1),
    reminder(BmrCharacterId::Courtier, "drunk3", 1),
    reminder(BmrCharacterId::Courtier, "noAbility", 1),
    reminder(BmrCharacterId::Professor, "alive", 1),
    reminder(BmrCharacterId::Professor, "noAbility", 1),
    reminder(BmrCharacterId::Minstrel, "everyoneIsDrunk", 1),
    reminder(BmrCharacterId::TeaLady, "cannotDie", 2),
    reminder(BmrCharacterId::Fool, "noAbility", 1),
    reminder(BmrCharacterId::Goon, "drunk", 1),
    reminder(BmrCharacterId::Lunatic, "chosen", 3),
    reminder(BmrCharacterId::Tinker, "dead", 1),
    reminder(BmrCharacterId::Moonchild, "dead", 1),
    reminder(BmrCharacterId::Godfather, "diedToday", 1),
    reminder(BmrCharacterId::Godfather, "dead", 1),
    reminder(BmrCharacterId::DevilsAdvocate, "survivesExecution", 1),
    reminder(BmrCharacterId::Assassin, "dead", 1),
    reminder(BmrCharacterId::Assassin, "noAbility", 1),
    reminder(BmrCharacterId::Zombuul, "diedToday", 1),
    reminder(BmrCharacterId::Zombuul, "dead", 1),
    reminder(BmrCharacterId::Pukka, "poisoned", 2),
    reminder(BmrCharacterId::Pukka, "dead", 1),
    reminder(BmrCharacterId::Shabaloth, "dead", 2),
    reminder(BmrCharacterId::Shabaloth, "alive", 1),
    reminder(BmrCharacterId::Po, "threeAttacks", 1),
    reminder(BmrCharacterId::Po, "dead", 3),
];

#[cfg_attr(not(test), allow(dead_code))]
const NO_REMINDER_CHARACTERS: [BmrCharacterId; 3] = [
    BmrCharacterId::Chambermaid,
    BmrCharacterId::Pacifist,
    BmrCharacterId::Mastermind,
];

#[cfg_attr(not(test), allow(dead_code))]
const fn reminder(
    character: BmrCharacterId,
    token_id: &'static str,
    physical_count: u8,
) -> ReminderMetadata {
    ReminderMetadata {
        character,
        token_id,
        physical_count,
    }
}

struct BmrReplayContext {
    players: Vec<Player>,
    setup_choice_id: Option<String>,
    phase: Phase,
    current_step: Option<PhaseStep>,
    phase_overview: Vec<PhaseOverviewItem>,
    warnings: Vec<crate::model::CoreWarning>,
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
    let context = replay_context(&game_file.game.events)?;
    Ok(ReplayState {
        schema_version: game_file.schema_version,
        script_id: game_file.script_id,
        event_count: game_file.game.events.len(),
        phase: context.phase,
        players: context.players,
        current_step: context.current_step,
        phase_overview: context.phase_overview,
        setup_choice_id: context.setup_choice_id,
        day_state: None,
        warnings: context.warnings,
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

fn replay_context(events: &[GameEvent]) -> Result<BmrReplayContext, CoreError> {
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
    validate_setup_inputs_for_script(ScriptId::BadMoonRising, &payload.players)
        .map_err(|_| ErrorKind::ReplayFailed.into_error())?;
    let players = payload
        .players
        .iter()
        .map(|player| {
            player_from_setup_input_for_script(ScriptId::BadMoonRising, player)
                .map_err(|_| ErrorKind::ReplayFailed.into_error())
        })
        .collect::<Result<Vec<_>, _>>()?;
    let warnings = validate_setup_warnings_for_script(
        ScriptId::BadMoonRising,
        &players,
        payload.setup_choice_id.as_deref(),
    )
    .map_err(|_| ErrorKind::ReplayFailed.into_error())?;
    let mut statuses = HashMap::new();
    for event in events.iter().skip(1) {
        let (phase, steps) = current_phase_steps(&players, &statuses, events.len() + 1);
        let current = steps
            .iter()
            .find(|step| !is_done(statuses.get(&step.id)))
            .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
        let (step_id, status) = match &event.kind {
            GameEventKind::PhaseStepConfirmed { payload } => {
                if current.support != PhaseStepSupport::Automated {
                    return Err(ErrorKind::ReplayFailed.into_error());
                }
                crate::phase::validate_required_input(
                    &current.required_input,
                    &payload.input,
                    &players,
                )
                .map_err(|_| ErrorKind::ReplayFailed.into_error())?;
                (&payload.step_id, PhaseStepStatus::Complete)
            }
            GameEventKind::ManualPhaseStepResolved { payload } => {
                if current.support != PhaseStepSupport::Manual {
                    return Err(ErrorKind::ReplayFailed.into_error());
                }
                let status = match payload.outcome {
                    ManualPhaseStepOutcome::Handled => PhaseStepStatus::ManualComplete,
                    ManualPhaseStepOutcome::NotApplicable => PhaseStepStatus::NotApplicable,
                };
                (&payload.step_id, status)
            }
            GameEventKind::PhaseStepSkipped { payload } if current.can_skip => {
                (&payload.step_id, PhaseStepStatus::Skipped)
            }
            _ => return Err(ErrorKind::ReplayFailed.into_error()),
        };
        let parsed =
            BmrStepKey::parse(step_id).ok_or_else(|| ErrorKind::ReplayFailed.into_error())?;
        let _typed_identity = (parsed.phase_token(), parsed.semantic_step());
        if current.id != *step_id
            || current.phase != event.phase
            || !phase_matches(parsed.phase(), phase)
        {
            return Err(ErrorKind::ReplayFailed.into_error());
        }
        statuses.insert(step_id.clone(), status);
    }
    let (phase, steps) = current_phase_steps(&players, &statuses, events.len() + 1);
    let current_step = steps
        .iter()
        .find(|step| !is_done(statuses.get(&step.id)))
        .cloned();
    let current_id = current_step.as_ref().map(|step| step.id.as_str());
    let phase_overview = steps
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
            ability_use: step.ability_use,
            ability_origin: step.ability_origin,
            required_input: step.required_input,
            can_skip: step.can_skip,
            support: step.support,
            information_prompt: step.information_prompt,
        })
        .collect();
    Ok(BmrReplayContext {
        players,
        setup_choice_id: payload.setup_choice_id.clone(),
        phase,
        current_step,
        phase_overview,
        warnings,
    })
}

fn phase_matches(key: BmrPhaseKey, phase: Phase) -> bool {
    matches!(
        (key, phase),
        (BmrPhaseKey::FirstNight, Phase::FirstNight)
            | (BmrPhaseKey::Day(_), Phase::Day)
            | (BmrPhaseKey::Night(_), Phase::Night)
    )
}

fn is_done(status: Option<&PhaseStepStatus>) -> bool {
    matches!(
        status,
        Some(
            PhaseStepStatus::Complete
                | PhaseStepStatus::ManualComplete
                | PhaseStepStatus::NotApplicable
                | PhaseStepStatus::Skipped
        )
    )
}

fn current_phase_steps(
    players: &[Player],
    statuses: &HashMap<String, PhaseStepStatus>,
    max_cycles: usize,
) -> (Phase, Vec<PhaseStep>) {
    let first = first_night_steps(players);
    if first.iter().any(|step| !is_done(statuses.get(&step.id))) {
        return (Phase::FirstNight, first);
    }
    for cycle in 1..=max_cycles.max(1) {
        let day = day_steps(cycle);
        if day.iter().any(|step| !is_done(statuses.get(&step.id))) {
            return (Phase::Day, day);
        }
        let night = later_night_steps(players, cycle);
        if night.iter().any(|step| !is_done(statuses.get(&step.id))) {
            return (Phase::Night, night);
        }
    }
    let cycle = max_cycles.max(1) + 1;
    (Phase::Day, day_steps(cycle))
}

fn first_night_steps(players: &[Player]) -> Vec<PhaseStep> {
    let mut steps = Vec::new();
    if has_kind(players, CharacterKind::Minion) {
        steps.push(simple_step(
            Phase::FirstNight,
            "firstNight",
            "minionInfo",
            StepType::EvilInfo,
            required_none(),
            false,
        ));
    }
    append_character_steps(
        &mut steps,
        Phase::FirstNight,
        "firstNight",
        players,
        BmrCharacterId::Lunatic,
        "lunatic",
    );
    if has_kind(players, CharacterKind::Demon) {
        steps.push(simple_step(
            Phase::FirstNight,
            "firstNight",
            "demonInfo",
            StepType::EvilInfo,
            required_characters(3, 3, Some(legal_demon_bluffs(players)), false),
            false,
        ));
    }
    for character in [
        BmrCharacterId::Sailor,
        BmrCharacterId::Courtier,
        BmrCharacterId::Godfather,
        BmrCharacterId::DevilsAdvocate,
        BmrCharacterId::Pukka,
        BmrCharacterId::Grandmother,
        BmrCharacterId::Chambermaid,
    ] {
        append_character_steps(
            &mut steps,
            Phase::FirstNight,
            "firstNight",
            players,
            character,
            character.as_str(),
        );
    }
    steps.push(phase_transition_step(
        Phase::FirstNight,
        "firstNight",
        "toDay",
        RequiredInputKind::Day,
    ));
    steps
}

fn day_steps(cycle: usize) -> Vec<PhaseStep> {
    let prefix = phase_prefix("day", cycle);
    let mut manual = simple_step(
        Phase::Day,
        &prefix,
        "manual",
        StepType::Discussion,
        required_none(),
        false,
    );
    manual.support = PhaseStepSupport::Manual;
    vec![
        manual,
        phase_transition_step(Phase::Day, &prefix, "toNight", RequiredInputKind::Night),
    ]
}

fn later_night_steps(players: &[Player], cycle: usize) -> Vec<PhaseStep> {
    let prefix = phase_prefix("night", cycle);
    let mut steps = Vec::new();
    for character in [
        BmrCharacterId::Sailor,
        BmrCharacterId::Innkeeper,
        BmrCharacterId::Courtier,
        BmrCharacterId::Gambler,
        BmrCharacterId::DevilsAdvocate,
        BmrCharacterId::Lunatic,
        BmrCharacterId::Exorcist,
        BmrCharacterId::Zombuul,
        BmrCharacterId::Pukka,
    ] {
        append_character_steps(
            &mut steps,
            Phase::Night,
            &prefix,
            players,
            character,
            character.as_str(),
        );
    }
    append_character_steps(
        &mut steps,
        Phase::Night,
        &prefix,
        players,
        BmrCharacterId::Shabaloth,
        "shabalothResurrection",
    );
    append_character_steps(
        &mut steps,
        Phase::Night,
        &prefix,
        players,
        BmrCharacterId::Shabaloth,
        "shabalothAttack",
    );
    for character in [
        BmrCharacterId::Po,
        BmrCharacterId::Assassin,
        BmrCharacterId::Godfather,
        BmrCharacterId::Professor,
        BmrCharacterId::Gossip,
        BmrCharacterId::Tinker,
        BmrCharacterId::Moonchild,
        BmrCharacterId::Grandmother,
        BmrCharacterId::Chambermaid,
    ] {
        append_character_steps(
            &mut steps,
            Phase::Night,
            &prefix,
            players,
            character,
            character.as_str(),
        );
    }
    steps.push(phase_transition_step(
        Phase::Night,
        &prefix,
        "toDay",
        RequiredInputKind::Day,
    ));
    steps
}

fn append_character_steps(
    steps: &mut Vec<PhaseStep>,
    phase: Phase,
    prefix: &str,
    players: &[Player],
    character: BmrCharacterId,
    step_name: &str,
) {
    let mut actors = players
        .iter()
        .filter(|player| player.actual_character == character.as_str())
        .collect::<Vec<_>>();
    actors.sort_by_key(|player| player.seat);
    let duplicate = actors.len() > 1;
    for player in actors {
        let id = if duplicate {
            format!("{prefix}:{step_name}:{}", player.id)
        } else {
            format!("{prefix}:{step_name}")
        };
        steps.push(PhaseStep {
            id,
            phase,
            step_type: StepType::Character,
            character: Some(character.as_str().into()),
            player_id: Some(player.id.clone()),
            ability_use: None,
            ability_origin: None,
            required_input: required_none(),
            can_skip: false,
            support: PhaseStepSupport::Manual,
            information_prompt: None,
            pre_action_reveal: None,
        });
    }
}

fn has_kind(players: &[Player], kind: CharacterKind) -> bool {
    players
        .iter()
        .any(|player| character_kind(&player.actual_character) == Some(kind))
}

fn legal_demon_bluffs(players: &[Player]) -> Vec<String> {
    let actual = players
        .iter()
        .map(|player| player.actual_character.as_str())
        .collect::<HashSet<_>>();
    BmrCharacterId::ALL
        .iter()
        .copied()
        .filter(|character| {
            matches!(
                character.kind(),
                CharacterKind::Townsfolk | CharacterKind::Outsider
            ) && !actual.contains(character.as_str())
        })
        .map(|character| character.as_str().to_string())
        .collect()
}

pub(crate) fn propose_phase_command(
    game_file: &GameFile,
    command: Command,
) -> Result<Proposal, CoreError> {
    let context = replay_context(&game_file.game.events)?;
    let current = context
        .current_step
        .ok_or_else(|| ErrorKind::NoCurrentStep.into_error())?;
    let (kind, summary, skip) = match command {
        Command::ConfirmStep { payload } => {
            if payload.step_id != current.id {
                return Err(ErrorKind::StaleStep.into_error());
            }
            if current.support == PhaseStepSupport::Manual {
                return Err(ErrorKind::StepRequiresManualResolution.into_error());
            }
            crate::phase::validate_required_input(
                &current.required_input,
                &payload.input,
                &context.players,
            )?;
            let summary =
                phase_step_event_summary(&current, &context.players, &payload.input, None, false);
            (
                GameEventKind::PhaseStepConfirmed {
                    payload: Box::new(PhaseStepEventPayload {
                        step_id: current.id.clone(),
                        input: payload.input,
                        information: None,
                    }),
                },
                summary,
                false,
            )
        }
        Command::SkipStep { payload } => {
            if payload.step_id != current.id {
                return Err(ErrorKind::StaleStep.into_error());
            }
            if !current.can_skip {
                return Err(ErrorKind::StepCannotBeSkipped.into_error());
            }
            (
                GameEventKind::PhaseStepSkipped {
                    payload: StepIdPayload {
                        step_id: current.id.clone(),
                    },
                },
                format!("단계 건너뜀: {}", current.id),
                true,
            )
        }
        Command::ResolveManualStep { payload } => {
            if payload.step_id != current.id {
                return Err(ErrorKind::StaleStep.into_error());
            }
            if current.support == PhaseStepSupport::Automated {
                return Err(ErrorKind::StepIsAutomated.into_error());
            }
            (
                GameEventKind::ManualPhaseStepResolved {
                    payload: ManualPhaseStepResolvedPayload {
                        step_id: current.id.clone(),
                        outcome: payload.outcome,
                    },
                },
                format!("수동 단계 처리: {}", current.id),
                false,
            )
        }
        _ => return Err(ErrorKind::CommandNotSupportedByScript.into_error()),
    };
    Ok(Proposal {
        event: GameEvent {
            id: format!("phase-step-{}", game_file.game.events.len() + 1),
            kind,
            phase: current.phase,
            summary,
            created_at: game_file
                .game
                .updated_at
                .clone()
                .unwrap_or_else(|| "1970-01-01T00:00:00.000Z".into()),
        },
        warnings: vec![],
        follow_up_steps: vec![],
        preview: if current.support == PhaseStepSupport::Manual {
            json!({ "messageKo": "현재 수동 단계를 처리합니다." })
        } else {
            phase_step_preview(skip)
        },
        reveal_payload: None,
    })
}

#[cfg(test)]
mod tests {
    use super::{BmrCharacterId, NO_REMINDER_CHARACTERS, REMINDER_INVENTORY};
    use crate::model::CharacterKind;
    use std::collections::HashSet;

    #[test]
    fn catalog_is_exact_unique_and_has_the_official_kind_distribution() {
        let ids = BmrCharacterId::ALL
            .iter()
            .map(|character| character.as_str())
            .collect::<Vec<_>>();
        assert_eq!(ids.len(), 25);
        assert_eq!(ids.iter().copied().collect::<HashSet<_>>().len(), 25);
        for id in ids {
            assert_eq!(BmrCharacterId::parse(id).unwrap().as_str(), id);
        }
        for (kind, expected) in [
            (CharacterKind::Townsfolk, 13),
            (CharacterKind::Outsider, 4),
            (CharacterKind::Minion, 4),
            (CharacterKind::Demon, 4),
        ] {
            assert_eq!(
                BmrCharacterId::ALL
                    .iter()
                    .filter(|character| character.kind() == kind)
                    .count(),
                expected
            );
        }
    }

    #[test]
    fn reminder_inventory_has_34_unique_products_42_physical_tokens_and_25_links() {
        assert_eq!(REMINDER_INVENTORY.len(), 34);
        assert_eq!(
            REMINDER_INVENTORY
                .iter()
                .map(|reminder| reminder.physical_count as usize)
                .sum::<usize>(),
            42
        );
        assert_eq!(
            REMINDER_INVENTORY
                .iter()
                .map(|reminder| (reminder.character, reminder.token_id))
                .collect::<HashSet<_>>()
                .len(),
            34
        );
        let linked = REMINDER_INVENTORY
            .iter()
            .map(|reminder| reminder.character)
            .collect::<HashSet<_>>();
        for character in BmrCharacterId::ALL {
            let expected = !NO_REMINDER_CHARACTERS.contains(&character);
            assert_eq!(linked.contains(&character), expected, "{character:?}");
        }
        assert_eq!(linked.len() + NO_REMINDER_CHARACTERS.len(), 25);
    }
}

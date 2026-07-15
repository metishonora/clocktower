use crate::model::{
    Alignment, CharacterKind, InformationPlayer, InformationResult, InputTarget, Phase, PhaseStep,
    Player, RegistrationJudgment, RegistrationValue, RequiredInput, RequiredInputKind,
    SetupInfoKind, StepInput, StepType,
};
use std::collections::{HashMap, HashSet};

const FIRST_NIGHT_ORDER: &[&str] = &[
    "poisoner",
    "washerwoman",
    "librarian",
    "investigator",
    "chef",
    "empath",
    "fortuneTeller",
    "butler",
    "spy",
];

const NIGHT_ORDER: &[&str] = &[
    "poisoner",
    "monk",
    "imp",
    "ravenkeeper",
    "undertaker",
    "fortuneTeller",
    "butler",
    "spy",
];

const TOWNSFOLK: &[&str] = &[
    "washerwoman",
    "librarian",
    "investigator",
    "chef",
    "empath",
    "fortuneTeller",
    "undertaker",
    "monk",
    "ravenkeeper",
    "virgin",
    "slayer",
    "soldier",
    "mayor",
];

const OUTSIDERS: &[&str] = &["butler", "drunk", "recluse", "saint"];

const MINIONS: &[&str] = &["poisoner", "spy", "scarletWoman", "baron"];

const DEMONS: &[&str] = &["imp"];

pub(crate) fn first_night_order() -> &'static [&'static str] {
    FIRST_NIGHT_ORDER
}

pub(crate) fn night_order() -> &'static [&'static str] {
    NIGHT_ORDER
}

pub(crate) fn has_actual_outsider(players: &[Player]) -> bool {
    players
        .iter()
        .any(|player| character_kind(&player.actual_character) == Some(CharacterKind::Outsider))
}

pub(crate) fn legal_demon_bluff_character_ids(players: &[Player]) -> Vec<String> {
    let assigned_actual_characters = players
        .iter()
        .map(|player| player.actual_character.as_str())
        .collect::<HashSet<_>>();

    TOWNSFOLK
        .iter()
        .chain(OUTSIDERS)
        .copied()
        .filter(|character_id| !assigned_actual_characters.contains(character_id))
        .map(str::to_string)
        .collect()
}

pub(crate) fn setup_info_character_is_represented(
    setup_info: SetupInfoKind,
    character_id: &str,
    candidate_player_ids: &[String],
    players: &[Player],
) -> bool {
    let required_kind = match setup_info {
        SetupInfoKind::Washerwoman => CharacterKind::Townsfolk,
        SetupInfoKind::Librarian => CharacterKind::Outsider,
        SetupInfoKind::Investigator => CharacterKind::Minion,
    };
    if character_kind(character_id) != Some(required_kind) {
        return false;
    }

    players.iter().any(|player| {
        player.actual_character == character_id && candidate_player_ids.contains(&player.id)
    })
}

fn awakening_character(player: &Player) -> &str {
    if player.actual_character == "drunk" {
        player.shown_character.as_str()
    } else {
        player.actual_character.as_str()
    }
}

pub(crate) fn evil_neighbor_pair_count(players: &[Player]) -> usize {
    let seated = seated_players(players);
    if seated.len() < 2 {
        return 0;
    }

    seated
        .iter()
        .enumerate()
        .filter(|(index, player)| {
            player.alignment == Alignment::Evil
                && seated[(index + 1) % seated.len()].alignment == Alignment::Evil
        })
        .count()
}

pub(crate) fn empath_evil_neighbor_count(players: &[Player], player_id: &str) -> Option<usize> {
    let seated = seated_players(players);
    let index = seated.iter().position(|player| player.id == player_id)?;
    let neighbor_indexes = alive_neighbor_indexes(&seated, index);

    Some(
        neighbor_indexes
            .iter()
            .filter(|neighbor_index| seated[**neighbor_index].alignment == Alignment::Evil)
            .count(),
    )
}

pub(crate) fn computed_information_result(
    step: &PhaseStep,
    players: &[Player],
    input: &StepInput,
) -> Option<InformationResult> {
    if step.step_type == StepType::EvilInfo {
        let demon_player_ids = players
            .iter()
            .filter(|player| character_kind(&player.actual_character) == Some(CharacterKind::Demon))
            .map(|player| player.id.clone())
            .collect();
        let minion_player_ids = players
            .iter()
            .filter(|player| {
                character_kind(&player.actual_character) == Some(CharacterKind::Minion)
            })
            .map(|player| player.id.clone())
            .collect();
        let bluff_character_ids = if step.id.ends_with(":demonInfo") {
            input
                .as_ref()
                .and_then(|value| value.character_ids.clone())
                .unwrap_or_default()
        } else {
            Vec::new()
        };
        return Some(InformationResult::TeamInfo {
            demon_player_ids,
            minion_player_ids,
            bluff_character_ids,
        });
    }

    match step.character.as_deref()? {
        "washerwoman" | "librarian" | "investigator" => {
            let input = input.as_ref()?;
            Some(InformationResult::SetupInfo {
                player_ids: input.player_ids.clone().unwrap_or_default(),
                character_id: input.character_id.clone(),
                zero_outsiders: input.zero_outsiders == Some(true),
            })
        }
        "chef" => Some(InformationResult::Number {
            value: evil_neighbor_pair_count(players),
        }),
        "empath" => Some(InformationResult::Number {
            value: empath_evil_neighbor_count(players, step.player_id.as_deref()?)?,
        }),
        "spy" => Some(InformationResult::SpyGrimoire {
            players: seated_players(players)
                .into_iter()
                .map(|player| InformationPlayer {
                    player_id: player.id.clone(),
                    seat: player.seat,
                    name: player.name.clone(),
                    character_id: player.actual_character.clone(),
                })
                .collect(),
        }),
        _ => None,
    }
}

pub(crate) fn registration_candidate_player_ids(
    step: &PhaseStep,
    players: &[Player],
) -> Vec<String> {
    let eligible_ids = match step.character.as_deref() {
        Some("empath") => {
            let Some(actor_id) = step.player_id.as_deref() else {
                return Vec::new();
            };
            let seated = seated_players(players);
            let Some(index) = seated.iter().position(|player| player.id == actor_id) else {
                return Vec::new();
            };
            alive_neighbor_indexes(&seated, index)
                .into_iter()
                .map(|index| seated[index].id.as_str())
                .collect::<HashSet<_>>()
        }
        Some("chef") => players.iter().map(|player| player.id.as_str()).collect(),
        _ => return Vec::new(),
    };

    players
        .iter()
        .filter(|player| {
            eligible_ids.contains(player.id.as_str())
                && matches!(player.actual_character.as_str(), "spy" | "recluse")
        })
        .map(|player| player.id.clone())
        .collect()
}

pub(crate) fn number_result_with_registration_judgments(
    step: &PhaseStep,
    players: &[Player],
    judgments: &[RegistrationJudgment],
) -> Option<usize> {
    let registered_alignment = |player: &Player| {
        judgments
            .iter()
            .find(|judgment| judgment.player_id == player.id)
            .and_then(|judgment| match judgment.registered_as {
                RegistrationValue::Good => Some(Alignment::Good),
                RegistrationValue::Evil => Some(Alignment::Evil),
                _ => None,
            })
            .unwrap_or(player.alignment)
    };

    match step.character.as_deref()? {
        "chef" => {
            let seated = seated_players(players);
            if seated.len() < 2 {
                return Some(0);
            }
            Some(
                seated
                    .iter()
                    .enumerate()
                    .filter(|(index, player)| {
                        registered_alignment(player) == Alignment::Evil
                            && registered_alignment(seated[(index + 1) % seated.len()])
                                == Alignment::Evil
                    })
                    .count(),
            )
        }
        "empath" => {
            let seated = seated_players(players);
            let actor_id = step.player_id.as_deref()?;
            let index = seated.iter().position(|player| player.id == actor_id)?;
            Some(
                alive_neighbor_indexes(&seated, index)
                    .iter()
                    .filter(|neighbor_index| {
                        registered_alignment(seated[**neighbor_index]) == Alignment::Evil
                    })
                    .count(),
            )
        }
        _ => None,
    }
}

pub(crate) fn alive_neighbor_indexes(players: &[&Player], index: usize) -> Vec<usize> {
    if players.len() < 2 {
        return Vec::new();
    }

    let mut indexes = Vec::new();
    for distance in 1..players.len() {
        let left = (index + players.len() - distance) % players.len();
        if players[left].alive {
            indexes.push(left);
            break;
        }
    }
    for distance in 1..players.len() {
        let right = (index + distance) % players.len();
        if players[right].alive && !indexes.contains(&right) {
            indexes.push(right);
            break;
        }
    }
    indexes
}

pub(crate) fn seated_players(players: &[Player]) -> Vec<&Player> {
    let mut seated = players.iter().collect::<Vec<_>>();
    seated.sort_by_key(|player| player.seat);
    seated
}

pub(crate) fn character_steps(
    phase: Phase,
    id_prefix: &str,
    players: &[Player],
    order: &[&str],
) -> Vec<PhaseStep> {
    let waking_characters = players
        .iter()
        .map(|player| (awakening_character(player), player.id.as_str()))
        .collect::<HashMap<_, _>>();
    let mut emitted = HashSet::new();

    order
        .iter()
        .filter_map(|character| {
            if !waking_characters.contains_key(character) || !emitted.insert(*character) {
                return None;
            }

            Some(PhaseStep {
                id: format!("{id_prefix}:{character}"),
                phase,
                step_type: StepType::Character,
                character: Some((*character).to_string()),
                player_id: waking_characters
                    .get(character)
                    .map(|player_id| (*player_id).to_string()),
                required_input: character_required_input(character),
                can_skip: true,
                information_prompt: None,
            })
        })
        .collect()
}

pub(crate) fn character_required_input(character: &str) -> RequiredInput {
    match character {
        "poisoner" | "monk" | "imp" | "ravenkeeper" | "butler" => required_players(1, 1),
        "washerwoman" => required_setup_info(
            SetupInfoKind::Washerwoman,
            CharacterKind::Townsfolk,
            2,
            2,
            false,
        ),
        "librarian" => required_setup_info(
            SetupInfoKind::Librarian,
            CharacterKind::Outsider,
            0,
            2,
            true,
        ),
        "investigator" => required_setup_info(
            SetupInfoKind::Investigator,
            CharacterKind::Minion,
            2,
            2,
            false,
        ),
        "fortuneTeller" => required_players(2, 2),
        "chef" => RequiredInput {
            kind: RequiredInputKind::Number,
            target: Some(InputTarget::Number),
            min_selections: Some(0),
            max_selections: None,
            setup_info: None,
            character_kind: None,
            allowed_character_ids: None,
            zero_allowed: false,
            optional: true,
        },
        _ => required_none(),
    }
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

pub(crate) fn is_townsfolk(character: &str) -> bool {
    matches!(character_kind(character), Some(CharacterKind::Townsfolk))
}

fn required_none() -> RequiredInput {
    RequiredInput {
        kind: RequiredInputKind::None,
        target: None,
        min_selections: None,
        max_selections: None,
        setup_info: None,
        character_kind: None,
        allowed_character_ids: None,
        zero_allowed: false,
        optional: false,
    }
}

fn required_players(min: u8, max: u8) -> RequiredInput {
    RequiredInput {
        kind: RequiredInputKind::PlayerIds,
        target: Some(if max == 1 {
            InputTarget::Player
        } else {
            InputTarget::Players
        }),
        min_selections: Some(min),
        max_selections: Some(max),
        setup_info: None,
        character_kind: None,
        allowed_character_ids: None,
        zero_allowed: false,
        optional: min == 0,
    }
}

fn required_setup_info(
    kind: SetupInfoKind,
    character_kind: CharacterKind,
    min: u8,
    max: u8,
    zero_allowed: bool,
) -> RequiredInput {
    RequiredInput {
        kind: RequiredInputKind::SetupInfo,
        target: Some(InputTarget::Players),
        min_selections: Some(min),
        max_selections: Some(max),
        setup_info: Some(kind),
        character_kind: Some(character_kind),
        allowed_character_ids: None,
        zero_allowed,
        optional: false,
    }
}

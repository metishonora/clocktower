use crate::model::{
    Alignment, CharacterKind, InputTarget, Phase, PhaseStep, Player, RequiredInput,
    RequiredInputKind, SetupInfoKind, StepType,
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

pub(crate) fn first_night_order() -> &'static [&'static str] {
    FIRST_NIGHT_ORDER
}

pub(crate) fn night_order() -> &'static [&'static str] {
    NIGHT_ORDER
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
            zero_allowed: false,
            optional: true,
        },
        _ => required_none(),
    }
}

pub(crate) fn character_kind(character: &str) -> Option<CharacterKind> {
    match character {
        "washerwoman" | "librarian" | "investigator" | "chef" | "empath" | "fortuneTeller"
        | "undertaker" | "monk" | "ravenkeeper" | "virgin" | "slayer" | "soldier" | "mayor" => {
            Some(CharacterKind::Townsfolk)
        }
        "butler" | "drunk" | "recluse" | "saint" => Some(CharacterKind::Outsider),
        "poisoner" | "spy" | "scarletWoman" | "baron" => Some(CharacterKind::Minion),
        "imp" => Some(CharacterKind::Demon),
        _ => None,
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
        zero_allowed,
        optional: false,
    }
}

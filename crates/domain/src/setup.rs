use crate::{
    characters::{character_kind, is_townsfolk},
    contracts::{ScriptId, SetupDistribution, SetupDistributionRequest, SetupPlayerInput},
    error::{CoreError, ErrorKind},
    messages::{duplicate_actual_character_warning, setup_distribution_warning},
    model::{CharacterKind, CoreWarning, Player},
};

pub(crate) fn setup_distribution(
    request: SetupDistributionRequest,
) -> Result<SetupDistribution, CoreError> {
    let rules = crate::characters::rules(request.script_id);
    if request.player_count < rules.minimum_player_count() || request.player_count > 15 {
        return Err(ErrorKind::InvalidPlayerCount.into_error());
    }

    Ok(rules.adjust_setup_distribution(
        base_distribution(request.player_count),
        &request.actual_characters,
    ))
}

pub(crate) fn validate_setup_inputs_for_script(
    script_id: ScriptId,
    players: &[SetupPlayerInput],
) -> Result<(), CoreError> {
    let rules = crate::characters::rules(script_id);
    if players.len() < rules.minimum_player_count() || players.len() > 15 {
        return Err(ErrorKind::InvalidPlayerCount.into_error());
    }

    validate_setup_input_contents(
        players,
        |character| rules.character_kind(character),
        |character| rules.is_townsfolk(character),
    )
}

pub(crate) fn validate_setup_inputs(players: &[SetupPlayerInput]) -> Result<(), CoreError> {
    if players.len() < 5 || players.len() > 15 {
        return Err(ErrorKind::InvalidPlayerCount.into_error());
    }

    validate_setup_input_contents(players, character_kind, is_townsfolk)
}

fn validate_setup_input_contents(
    players: &[SetupPlayerInput],
    kind: impl Fn(&str) -> Option<CharacterKind>,
    townsfolk: impl Fn(&str) -> bool,
) -> Result<(), CoreError> {
    let mut seats = Vec::with_capacity(players.len());
    for player in players {
        if player.name.trim().is_empty() {
            return Err(ErrorKind::InvalidPlayer.into_error());
        }
        if kind(&player.actual_character).is_none() {
            return Err(ErrorKind::UnknownCharacter.into_error());
        }
        if let Some(shown_character) = &player.shown_character {
            if kind(shown_character).is_none() {
                return Err(ErrorKind::UnknownCharacter.into_error());
            }
        }
        if player.actual_character == "drunk" {
            let Some(shown_character) = &player.shown_character else {
                return Err(ErrorKind::InvalidDrunkShownCharacter.into_error());
            };
            if !townsfolk(shown_character) {
                return Err(ErrorKind::InvalidDrunkShownCharacter.into_error());
            }
        }
        seats.push(player.seat);
    }

    seats.sort_unstable();
    for (index, seat) in seats.iter().enumerate() {
        if usize::from(*seat) != index + 1 {
            return Err(ErrorKind::InvalidSeating.into_error());
        }
    }

    Ok(())
}

pub(crate) fn normalized_setup_player_for_script(
    script_id: ScriptId,
    player: &SetupPlayerInput,
) -> Result<SetupPlayerInput, CoreError> {
    normalized_setup_player_with_townsfolk(player, |character| {
        crate::characters::rules(script_id).is_townsfolk(character)
    })
}

pub(crate) fn normalized_setup_player(
    player: &SetupPlayerInput,
) -> Result<SetupPlayerInput, CoreError> {
    normalized_setup_player_with_townsfolk(player, is_townsfolk)
}

fn normalized_setup_player_with_townsfolk(
    player: &SetupPlayerInput,
    townsfolk: impl Fn(&str) -> bool,
) -> Result<SetupPlayerInput, CoreError> {
    let shown_character = if player.actual_character == "drunk" {
        let shown_character = player
            .shown_character
            .clone()
            .ok_or_else(|| ErrorKind::InvalidDrunkShownCharacter.into_error())?;
        if !townsfolk(&shown_character) {
            return Err(ErrorKind::InvalidDrunkShownCharacter.into_error());
        }
        shown_character
    } else {
        player.actual_character.clone()
    };

    Ok(SetupPlayerInput {
        id: Some(
            player
                .id
                .clone()
                .unwrap_or_else(|| format!("player-{}", player.seat)),
        ),
        seat: player.seat,
        name: player.name.trim().to_string(),
        actual_character: player.actual_character.clone(),
        shown_character: Some(shown_character),
    })
}

pub(crate) fn player_from_setup_input_for_script(
    script_id: ScriptId,
    player: &SetupPlayerInput,
) -> Result<Player, CoreError> {
    let normalized = normalized_setup_player_for_script(script_id, player)?;
    player_from_normalized_setup_input(normalized, |character| {
        crate::characters::rules(script_id).character_kind(character)
    })
}

pub(crate) fn player_from_setup_input(player: &SetupPlayerInput) -> Result<Player, CoreError> {
    let normalized = normalized_setup_player(player)?;
    player_from_normalized_setup_input(normalized, character_kind)
}

fn player_from_normalized_setup_input(
    normalized: SetupPlayerInput,
    kind: impl Fn(&str) -> Option<CharacterKind>,
) -> Result<Player, CoreError> {
    let alignment = kind(&normalized.actual_character)
        .map(|kind| kind.alignment())
        .ok_or_else(|| ErrorKind::UnknownCharacter.into_error())?;

    let player_id = normalized.id.expect("normalized player should have an id");
    let ability_character = normalized.actual_character.clone();
    Ok(Player {
        id: player_id.clone(),
        seat: normalized.seat,
        name: normalized.name,
        actual_character: normalized.actual_character,
        shown_character: normalized
            .shown_character
            .expect("normalized player should have a shown character"),
        alignment,
        alive: true,
        ghost_vote_used: false,
        death_announced: false,
        system_token_ids: vec![],
        script_tokens: vec![],
        notes: String::new(),
        ability_instance: crate::model::AbilityInstance {
            id: format!("setup:{player_id}"),
            character_id: ability_character,
            source_event_id: "setup".into(),
        },
        identity_history: vec![],
    })
}

pub(crate) fn validate_setup_warnings_for_script(
    script_id: ScriptId,
    players: &[Player],
) -> Vec<CoreWarning> {
    validate_setup_warnings_with_rules(
        players,
        |character| crate::characters::rules(script_id).character_kind(character),
        |player_count, actual_characters| {
            crate::characters::rules(script_id)
                .adjust_setup_distribution(base_distribution(player_count), actual_characters)
        },
    )
}

pub(crate) fn validate_setup_warnings(players: &[Player]) -> Vec<CoreWarning> {
    validate_setup_warnings_with_rules(
        players,
        character_kind,
        |player_count, actual_characters| {
            crate::characters::rules(ScriptId::TroubleBrewing)
                .adjust_setup_distribution(base_distribution(player_count), actual_characters)
        },
    )
}

fn validate_setup_warnings_with_rules(
    players: &[Player],
    kind: impl Fn(&str) -> Option<CharacterKind>,
    expected: impl Fn(usize, &[String]) -> SetupDistribution,
) -> Vec<CoreWarning> {
    if players.is_empty() {
        return Vec::new();
    }

    let mut warnings = Vec::new();
    let actual = players
        .iter()
        .fold(SetupDistribution::empty(), |mut counts, player| {
            match kind(&player.actual_character) {
                Some(CharacterKind::Townsfolk) => counts.townsfolk += 1,
                Some(CharacterKind::Outsider) => counts.outsider += 1,
                Some(CharacterKind::Minion) => counts.minion += 1,
                Some(CharacterKind::Demon) => counts.demon += 1,
                None => {}
            }
            counts
        });
    let actual_character_ids = players
        .iter()
        .map(|player| player.actual_character.clone())
        .collect::<Vec<_>>();
    let expected = expected(players.len(), &actual_character_ids);

    if actual != expected {
        warnings.push(setup_distribution_warning(&expected));
    }

    let mut actual_characters = players
        .iter()
        .map(|player| player.actual_character.as_str())
        .collect::<Vec<_>>();
    actual_characters.sort_unstable();
    if actual_characters.windows(2).any(|pair| pair[0] == pair[1]) {
        warnings.push(duplicate_actual_character_warning());
    }

    warnings
}

impl SetupDistribution {
    pub(crate) fn empty() -> Self {
        Self {
            townsfolk: 0,
            outsider: 0,
            minion: 0,
            demon: 0,
        }
    }
}

#[cfg(test)]
pub(crate) fn expected_distribution(player_count: usize, has_baron: bool) -> SetupDistribution {
    let actual_characters = if has_baron {
        vec!["baron".to_string()]
    } else {
        vec![]
    };
    crate::characters::rules(ScriptId::TroubleBrewing)
        .adjust_setup_distribution(base_distribution(player_count), &actual_characters)
}

fn base_distribution(player_count: usize) -> SetupDistribution {
    match player_count {
        5 => SetupDistribution {
            townsfolk: 3,
            outsider: 0,
            minion: 1,
            demon: 1,
        },
        6 => SetupDistribution {
            townsfolk: 3,
            outsider: 1,
            minion: 1,
            demon: 1,
        },
        7 => SetupDistribution {
            townsfolk: 5,
            outsider: 0,
            minion: 1,
            demon: 1,
        },
        8 => SetupDistribution {
            townsfolk: 5,
            outsider: 1,
            minion: 1,
            demon: 1,
        },
        9 => SetupDistribution {
            townsfolk: 5,
            outsider: 2,
            minion: 1,
            demon: 1,
        },
        10 => SetupDistribution {
            townsfolk: 7,
            outsider: 0,
            minion: 2,
            demon: 1,
        },
        11 => SetupDistribution {
            townsfolk: 7,
            outsider: 1,
            minion: 2,
            demon: 1,
        },
        12 => SetupDistribution {
            townsfolk: 7,
            outsider: 2,
            minion: 2,
            demon: 1,
        },
        13 => SetupDistribution {
            townsfolk: 9,
            outsider: 0,
            minion: 3,
            demon: 1,
        },
        14 => SetupDistribution {
            townsfolk: 9,
            outsider: 1,
            minion: 3,
            demon: 1,
        },
        15 => SetupDistribution {
            townsfolk: 9,
            outsider: 2,
            minion: 3,
            demon: 1,
        },
        _ => SetupDistribution::empty(),
    }
}

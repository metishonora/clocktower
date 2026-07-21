use crate::{
    characters::{character_kind, is_townsfolk},
    contracts::{SetupDistribution, SetupDistributionRequest, SetupPlayerInput},
    error::{CoreError, ErrorKind},
    messages::{duplicate_actual_character_warning, setup_distribution_warning},
    model::{CharacterKind, CoreWarning, Player},
};

pub(crate) fn setup_distribution(
    request: SetupDistributionRequest,
) -> Result<SetupDistribution, CoreError> {
    if request.player_count < 5 || request.player_count > 15 {
        return Err(ErrorKind::InvalidPlayerCount.into_error());
    }

    let has_baron = crate::characters::rules(request.script_id)
        .setup_has_baron_adjustment(&request.actual_characters)?;
    Ok(expected_distribution(request.player_count, has_baron))
}

pub(crate) fn validate_setup_inputs(players: &[SetupPlayerInput]) -> Result<(), CoreError> {
    if players.len() < 5 || players.len() > 15 {
        return Err(ErrorKind::InvalidPlayerCount.into_error());
    }

    let mut seats = Vec::with_capacity(players.len());
    for player in players {
        if player.name.trim().is_empty() {
            return Err(ErrorKind::InvalidPlayer.into_error());
        }
        if character_kind(&player.actual_character).is_none() {
            return Err(ErrorKind::UnknownCharacter.into_error());
        }
        if let Some(shown_character) = &player.shown_character {
            if character_kind(shown_character).is_none() {
                return Err(ErrorKind::UnknownCharacter.into_error());
            }
        }
        if player.actual_character == "drunk" {
            let Some(shown_character) = &player.shown_character else {
                return Err(ErrorKind::InvalidDrunkShownCharacter.into_error());
            };
            if !is_townsfolk(shown_character) {
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

pub(crate) fn normalized_setup_player(
    player: &SetupPlayerInput,
) -> Result<SetupPlayerInput, CoreError> {
    let shown_character = if player.actual_character == "drunk" {
        let shown_character = player
            .shown_character
            .clone()
            .ok_or_else(|| ErrorKind::InvalidDrunkShownCharacter.into_error())?;
        if !is_townsfolk(&shown_character) {
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

pub(crate) fn player_from_setup_input(player: &SetupPlayerInput) -> Result<Player, CoreError> {
    let normalized = normalized_setup_player(player)?;
    let alignment = character_kind(&normalized.actual_character)
        .map(|kind| kind.alignment())
        .ok_or_else(|| ErrorKind::UnknownCharacter.into_error())?;

    Ok(Player {
        id: normalized.id.expect("normalized player should have an id"),
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
    })
}

pub(crate) fn validate_setup_warnings(players: &[Player]) -> Vec<CoreWarning> {
    if players.is_empty() {
        return Vec::new();
    }

    let mut warnings = Vec::new();
    let actual = players
        .iter()
        .fold(SetupDistribution::empty(), |mut counts, player| {
            match character_kind(&player.actual_character) {
                Some(CharacterKind::Townsfolk) => counts.townsfolk += 1,
                Some(CharacterKind::Outsider) => counts.outsider += 1,
                Some(CharacterKind::Minion) => counts.minion += 1,
                Some(CharacterKind::Demon) => counts.demon += 1,
                None => {}
            }
            counts
        });
    let expected = expected_distribution(
        players.len(),
        players
            .iter()
            .any(|player| player.actual_character.as_str() == "baron"),
    );

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

pub(crate) fn expected_distribution(player_count: usize, has_baron: bool) -> SetupDistribution {
    let distribution = match player_count {
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
    };

    if has_baron {
        SetupDistribution {
            townsfolk: distribution.townsfolk.saturating_sub(2),
            outsider: distribution.outsider + 2,
            ..distribution
        }
    } else {
        distribution
    }
}

use crate::{
    characters::ResolvedScriptContext,
    contracts::*,
    error::{CoreError, ErrorKind},
    messages::{setup_event_summary, setup_preview},
    model::*,
};
use std::collections::HashSet;
pub(crate) fn custom_setup_distribution(
    context: &ResolvedScriptContext,
    player_count: usize,
    actual_characters: &[String],
) -> Result<SetupDistribution, CoreError> {
    if actual_characters
        .iter()
        .any(|character| !context.contains(character))
    {
        return Err(ErrorKind::CharacterNotInScript.into_error());
    }

    let base = base_distribution(player_count);
    let requested_delta = context.setup_outsider_delta(actual_characters);
    let applied_delta = requested_delta.clamp(-(base.outsider as i32), base.townsfolk as i32);
    let expected = SetupDistribution {
        townsfolk: (base.townsfolk as i32 - applied_delta) as usize,
        outsider: (base.outsider as i32 + applied_delta) as usize,
        ..base
    };

    let enough_candidates = [
        (CharacterKind::Townsfolk, expected.townsfolk),
        (CharacterKind::Outsider, expected.outsider),
        (CharacterKind::Minion, expected.minion),
        (CharacterKind::Demon, expected.demon),
    ]
    .into_iter()
    .all(|(kind, required)| context.character_ids_of_kind(kind).len() >= required);
    if !enough_candidates {
        return Err(ErrorKind::InsufficientSetupRoster.into_error());
    }

    Ok(expected)
}

pub(crate) fn validate_setup_inputs_for_custom(
    context: &ResolvedScriptContext,
    players: &[SetupPlayerInput],
) -> Result<(), CoreError> {
    if players.len() < 5 || players.len() > 15 {
        return Err(ErrorKind::InvalidPlayerCount.into_error());
    }
    for player in players {
        validate_custom_character_membership(context, &player.actual_character)?;
        if let Some(shown_character) = player.shown_character.as_deref() {
            validate_custom_character_membership(context, shown_character)?;
        }
    }
    validate_setup_input_contents(
        players,
        |character| context.character_kind(character),
        |character| context.character_kind(character) == Some(CharacterKind::Townsfolk),
    )
}

/// Validate membership in the resolved custom definition, as distinct from membership in the
/// global Character catalog.  Setup, custom fact reduction, and later action validation share this
/// boundary so an otherwise known Character cannot enter a game that does not include it.
pub(crate) fn validate_custom_character_membership(
    context: &ResolvedScriptContext,
    character_id: &str,
) -> Result<(), CoreError> {
    if context.contains(character_id) {
        Ok(())
    } else {
        Err(ErrorKind::CharacterNotInScript.into_error())
    }
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

pub(crate) fn normalized_setup_player_for_custom(
    context: &ResolvedScriptContext,
    player: &SetupPlayerInput,
) -> Result<SetupPlayerInput, CoreError> {
    normalized_setup_player_with_townsfolk(player, |character| {
        context.character_kind(character) == Some(CharacterKind::Townsfolk)
    })
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

pub(crate) fn player_from_setup_input_for_custom(
    context: &ResolvedScriptContext,
    player: &SetupPlayerInput,
) -> Result<Player, CoreError> {
    let normalized = normalized_setup_player_for_custom(context, player)?;
    player_from_normalized_setup_input(normalized, |character| context.character_kind(character))
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
            id: crate::model::AbilityInstanceId::new("setup", &player_id),
            character_id: ability_character,
            source_event_id: "setup".into(),
        },
        identity_history: vec![],
    })
}

pub(crate) fn validate_new_setup_distribution(
    players: &[Player],
    kind: impl Fn(&str) -> Option<CharacterKind>,
    expected: SetupDistribution,
) -> Result<(), CoreError> {
    let mut unique = HashSet::with_capacity(players.len());
    if players
        .iter()
        .any(|player| !unique.insert(player.actual_character.as_str()))
    {
        return Err(ErrorKind::DuplicateActualCharacter.into_error());
    }

    let actual = actual_setup_distribution(players, kind);
    if actual != expected {
        return Err(ErrorKind::InvalidSetupDistribution.into_error());
    }
    Ok(())
}

fn actual_setup_distribution(
    players: &[Player],
    kind: impl Fn(&str) -> Option<CharacterKind>,
) -> SetupDistribution {
    players
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
        })
}

pub(crate) fn base_distribution(player_count: usize) -> SetupDistribution {
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

pub(crate) fn setup_distribution(
    request: SetupDistributionRequest,
) -> Result<SetupDistributionResult, CoreError> {
    if !(5..=15).contains(&request.player_count) {
        return Err(ErrorKind::InvalidPlayerCount.into_error());
    }
    let context = crate::characters::resolve_custom_script(&request.custom_definition)?;
    crate::first_night::plan_for_definition(&request.custom_definition)?;
    Ok(SetupDistributionResult::Distribution(
        custom_setup_distribution(&context, request.player_count, &request.actual_characters)?,
    ))
}
pub(crate) fn propose_create_game(
    game_file: &GameFile,
    payload: CreateGamePayload,
) -> Result<Proposal, CoreError> {
    if !game_file.game.events.is_empty() {
        return Err(ErrorKind::GameAlreadyHasEvents.into_error());
    }

    let setup_choice_id = payload.setup_choice_id.clone();
    let ScriptReference::Custom { definition } = &game_file.script;
    let players = {
        if setup_choice_id.is_some() {
            return Err(ErrorKind::InvalidSetupChoice.into_error());
        }
        let context = crate::characters::resolve_custom_script(definition)?;
        crate::first_night::plan_for_definition(definition)?;
        validate_setup_inputs_for_custom(&context, &payload.players)?;
        let players = payload
            .players
            .iter()
            .map(|player| normalized_setup_player_for_custom(&context, player))
            .collect::<Result<Vec<_>, _>>()?;
        let derived_players = players
            .iter()
            .map(|player| player_from_setup_input_for_custom(&context, player))
            .collect::<Result<Vec<_>, _>>()?;
        let actual_characters = derived_players
            .iter()
            .map(|player| player.actual_character.clone())
            .collect::<Vec<_>>();
        let expected = custom_setup_distribution(&context, players.len(), &actual_characters)?;
        validate_new_setup_distribution(
            &derived_players,
            |character| context.character_kind(character),
            expected,
        )?;
        players
    };
    let count = players.len();

    Ok(Proposal {
        event: GameEvent {
            id: format!("setup-{}", game_file.game.events.len() + 1),
            kind: GameEventKind::SetupConfirmed {
                payload: SetupEventPayload {
                    players,
                    setup_choice_id,
                },
            },
            phase: Phase::Setup,
            summary: setup_event_summary(count),
            created_at: game_file
                .game
                .updated_at
                .clone()
                .unwrap_or_else(|| "1970-01-01T00:00:00.000Z".to_string()),
        },
        warnings: vec![],
        follow_up_steps: Vec::new(),
        preview: setup_preview(count),
        reveal_payload: None,
    })
}

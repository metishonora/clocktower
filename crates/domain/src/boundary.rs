use std::collections::HashMap;

use serde::Serialize;
use serde_json::Value;

use crate::{
    contracts::{
        Command, Discriminator, Game, GameEvent, GameEventKind, GameFile,
        PhaseInputSuggestionRequest, RawGameFile, SetupDistributionRequest,
    },
    error::{CoreError, ErrorKind},
    identity::EventId,
};

pub(crate) fn replay_json(game_file_json: &str) -> String {
    to_json(parse_game_file(game_file_json).and_then(crate::replay::replay))
}

pub(crate) fn propose_json(game_file_json: &str, command_json: &str) -> String {
    let result = parse_game_file(game_file_json).and_then(|game_file| {
        let command = parse_command(command_json)?;
        crate::proposal::propose(game_file, command)
    });
    to_json(result)
}

pub(crate) fn setup_distribution_json(request_json: &str) -> String {
    let result = serde_json::from_str::<SetupDistributionRequest>(request_json)
        .map_err(|_| ErrorKind::MalformedRequest.into_error())
        .and_then(crate::setup::setup_distribution);
    to_json(result)
}

pub(crate) fn suggest_phase_input_json(game_file_json: &str, request_json: &str) -> String {
    let result = parse_game_file(game_file_json).and_then(|game_file| {
        let request = serde_json::from_str::<PhaseInputSuggestionRequest>(request_json)
            .map_err(|_| ErrorKind::MalformedRequest.into_error())?;
        crate::suggestion::suggest_phase_input(game_file, request)
    });
    to_json(result)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CoreResult<T: Serialize> {
    pub(crate) ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) value: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) error: Option<CoreError>,
}
pub(crate) fn parse_game_file(json: &str) -> Result<GameFile, CoreError> {
    let raw: RawGameFile =
        serde_json::from_str(json).map_err(|_| ErrorKind::MalformedGameFile.into_error())?;

    let script_id = match raw.schema_version {
        2 if raw.game.script_id.is_none() => crate::contracts::ScriptId::TroubleBrewing,
        2 => return Err(ErrorKind::MalformedGameFile.into_error()),
        3 => raw
            .game
            .script_id
            .ok_or_else(|| ErrorKind::MalformedGameFile.into_error())?,
        _ => return Err(ErrorKind::UnsupportedSchemaVersion.into_error()),
    };

    let events = raw
        .game
        .events
        .into_iter()
        .map(parse_event)
        .collect::<Result<Vec<_>, _>>()?;
    validate_event_references(&events)?;
    crate::characters::rules(script_id).validate_replay_events(&events)?;

    Ok(GameFile {
        schema_version: raw.schema_version,
        script_id,
        game: Game {
            updated_at: raw.game.updated_at,
            events,
        },
    })
}

fn validate_event_references(events: &[GameEvent]) -> Result<(), CoreError> {
    let mut prior_by_id: HashMap<EventId, &GameEventKind> = HashMap::with_capacity(events.len());
    for event in events {
        let current_id = EventId::parse(&event.id)?;
        if prior_by_id.contains_key(&current_id) {
            return Err(ErrorKind::DuplicateEventId.into_error());
        }
        let require_prior = |event_id: &str, expected: fn(&GameEventKind) -> bool| {
            EventId::parse(event_id)
                .ok()
                .and_then(|event_id| prior_by_id.get(&event_id))
                .filter(|kind| expected(kind))
                .ok_or_else(|| ErrorKind::InvalidEventReference.into_error())
                .map(|_| ())
        };
        match &event.kind {
            GameEventKind::NominationVoteConfirmed { payload } => {
                if let Some(event_id) = payload.nomination_event_id.as_deref() {
                    require_prior(event_id, |kind| {
                        matches!(kind, GameEventKind::NominationStarted { .. })
                    })?;
                }
            }
            GameEventKind::DemonSuccessionConfirmed { payload } => {
                require_prior(&payload.trigger_imp_death_event_id, |kind| {
                    matches!(
                        kind,
                        GameEventKind::DeathConfirmed { .. }
                            | GameEventKind::NightActionResolved { .. }
                    )
                })?
            }
            GameEventKind::MadnessExecutionConfirmed { payload } => {
                if let Some(event_id) = payload.check_event_id.as_deref() {
                    require_prior(event_id, |kind| {
                        matches!(kind, GameEventKind::MadnessCheckRecorded { .. })
                    })?;
                }
            }
            GameEventKind::PitHagArbitraryDeathsConfirmed { payload } => {
                require_prior(&payload.source_transformation_event_id, |kind| {
                    matches!(kind, GameEventKind::PitHagTransformationResolved { .. })
                })?;
                for death in &payload.deaths {
                    if let crate::contracts::NightDeathCause::PitHagArbitraryDeath {
                        source_transformation_event_id,
                        ..
                    } = &death.cause
                    {
                        require_prior(source_transformation_event_id, |kind| {
                            matches!(kind, GameEventKind::PitHagTransformationResolved { .. })
                        })?;
                    }
                }
            }
            GameEventKind::SnakeCharmerActionResolved { payload } => {
                if let crate::contracts::SnakeCharmerActionOutcome::Swap { impairment, .. } =
                    &payload.outcome
                {
                    if impairment.source_event_id != event.id {
                        require_prior(&impairment.source_event_id, |kind| {
                            matches!(kind, GameEventKind::SnakeCharmerActionResolved { .. })
                        })?;
                    }
                }
            }
            GameEventKind::VigormortisPoisonTargetChanged { payload } => {
                require_prior(&payload.source_event_id, |kind| {
                    matches!(kind, GameEventKind::NightActionResolved { .. })
                })?;
            }
            GameEventKind::SweetheartConsequenceResolved { payload } => {
                require_prior(&payload.trigger.source_event_id, is_death_source_event)?;
            }
            GameEventKind::BarberConsequenceResolved { payload } => {
                require_prior(&payload.trigger.source_event_id, is_death_source_event)?;
            }
            GameEventKind::KlutzChoiceResolved { payload } => {
                require_prior(&payload.trigger.source_event_id, is_death_source_event)?;
            }
            GameEventKind::GameEnded { payload } => {
                if let Some(source) = &payload.source {
                    use crate::contracts::GameEndSource;
                    match source {
                        GameEndSource::DemonAbsent { source_event_id }
                        | GameEndSource::TwoLivingPlayers { source_event_id } => {
                            require_prior(source_event_id, is_death_source_event)?;
                        }
                        GameEndSource::SaintExecution { source_event_id } => {
                            require_prior(source_event_id, |kind| {
                                matches!(kind, GameEventKind::DeathConfirmed { .. })
                            })?;
                        }
                        GameEndSource::MayorNoExecution { source_event_id }
                        | GameEndSource::VortoxNoExecution { source_event_id } => {
                            require_prior(source_event_id, |kind| {
                                matches!(kind, GameEventKind::NoExecutionConfirmed { .. })
                            })?;
                        }
                        GameEndSource::KlutzChoice { source_event_id } => {
                            require_prior(source_event_id, |kind| {
                                matches!(kind, GameEventKind::KlutzChoiceResolved { .. })
                            })?;
                        }
                        GameEndSource::WitchCurseDeath { source_event_id }
                        | GameEndSource::EvilTwinExecution { source_event_id } => {
                            require_prior(source_event_id, is_death_source_event)?;
                        }
                    }
                }
            }
            _ => {}
        }
        prior_by_id.insert(current_id, &event.kind);
    }
    Ok(())
}

fn is_death_source_event(kind: &GameEventKind) -> bool {
    matches!(
        kind,
        GameEventKind::DeathConfirmed { .. }
            | GameEventKind::NightActionResolved { .. }
            | GameEventKind::PitHagArbitraryDeathsConfirmed { .. }
    )
}

pub(crate) fn parse_command(json: &str) -> Result<Command, CoreError> {
    let value: Value =
        serde_json::from_str(json).map_err(|_| ErrorKind::MalformedCommand.into_error())?;
    let discriminator: Discriminator = serde_json::from_value(value.clone())
        .map_err(|_| ErrorKind::MalformedCommand.into_error())?;
    if !Command::DISCRIMINATORS.contains(&discriminator.kind.as_str()) {
        return Err(ErrorKind::UnsupportedCommand.into_error());
    }
    serde_json::from_value(value).map_err(|_| ErrorKind::MalformedCommand.into_error())
}

pub(crate) fn parse_event(value: Value) -> Result<GameEvent, CoreError> {
    let discriminator: Discriminator = serde_json::from_value(value.clone())
        .map_err(|_| ErrorKind::MalformedEvent.into_error())?;
    if !GameEventKind::DISCRIMINATORS.contains(&discriminator.kind.as_str()) {
        return Err(ErrorKind::UnsupportedEvent.into_error());
    }
    serde_json::from_value(value).map_err(|_| ErrorKind::MalformedEvent.into_error())
}

pub(crate) fn to_json<T: Serialize>(result: Result<T, CoreError>) -> String {
    let response = match result {
        Ok(value) => CoreResult {
            ok: true,
            value: Some(value),
            error: None,
        },
        Err(error) => CoreResult {
            ok: false,
            value: None,
            error: Some(error),
        },
    };

    serde_json::to_string(&response).expect("CoreResult serialization should not fail")
}

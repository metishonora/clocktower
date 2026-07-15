use serde::Serialize;
use serde_json::Value;

use crate::{
    contracts::{
        Command, Discriminator, Game, GameEvent, GameFile, PhaseInputSuggestionRequest,
        RawGameFile, SetupDistributionRequest,
    },
    error::{CoreError, ErrorKind},
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

    if raw.schema_version != 1 {
        return Err(ErrorKind::UnsupportedSchemaVersion.into_error());
    }

    let events = raw
        .game
        .events
        .into_iter()
        .map(parse_event)
        .collect::<Result<Vec<_>, _>>()?;

    Ok(GameFile {
        schema_version: raw.schema_version,
        game: Game {
            updated_at: raw.game.updated_at,
            events,
        },
    })
}

pub(crate) fn parse_command(json: &str) -> Result<Command, CoreError> {
    let value: Value =
        serde_json::from_str(json).map_err(|_| ErrorKind::MalformedCommand.into_error())?;
    let discriminator: Discriminator = serde_json::from_value(value.clone())
        .map_err(|_| ErrorKind::MalformedCommand.into_error())?;
    if !matches!(
        discriminator.kind.as_str(),
        "smoke" | "createGame" | "confirmStep" | "skipStep"
    ) {
        return Err(ErrorKind::UnsupportedCommand.into_error());
    }
    serde_json::from_value(value).map_err(|_| ErrorKind::MalformedCommand.into_error())
}

pub(crate) fn parse_event(value: Value) -> Result<GameEvent, CoreError> {
    let discriminator: Discriminator = serde_json::from_value(value.clone())
        .map_err(|_| ErrorKind::MalformedEvent.into_error())?;
    if !matches!(
        discriminator.kind.as_str(),
        "smokeConfirmed"
            | "setupConfirmed"
            | "phaseStepConfirmed"
            | "phaseStepSkipped"
            | "phaseStepNeedsFollowUp"
            | "nominationVoteConfirmed"
            | "executionConfirmed"
            | "noExecutionConfirmed"
            | "deathConfirmed"
    ) {
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

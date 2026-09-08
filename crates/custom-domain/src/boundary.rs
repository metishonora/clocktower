use crate::{
    contracts::*,
    error::{CoreError, ErrorKind},
    identity::EventId,
};
use serde::Serialize;
use serde_json::Value;
use std::collections::HashSet;
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CoreResult<T: Serialize> {
    pub(crate) ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) value: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) error: Option<CoreError>,
}

pub(crate) fn custom_first_night_plan_json(request_json: &str) -> String {
    let result = serde_json::from_str::<CustomFirstNightPlanRequest>(request_json)
        .map_err(|_| ErrorKind::MalformedRequest.into_error())
        .and_then(|request| crate::first_night::plan_for_draft(&request.custom_definition));
    to_json(result)
}

pub(crate) fn setup_distribution_json(request_json: &str) -> String {
    let result = serde_json::from_str::<SetupDistributionRequest>(request_json)
        .map_err(|_| ErrorKind::MalformedRequest.into_error())
        .and_then(crate::setup::setup_distribution);
    to_json(result)
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
    if discriminator.kind == "customActionConfirmed" {
        validate_custom_action_event_json(&value)?;
    }
    let event: GameEvent =
        serde_json::from_value(value).map_err(|_| ErrorKind::MalformedEvent.into_error())?;
    if matches!(event.kind, GameEventKind::CustomActionConfirmed { .. }) {
        crate::event::validate_custom_event_shape(&event)
            .map_err(|_| ErrorKind::MalformedEvent.into_error())?;
    }
    Ok(event)
}

fn validate_custom_action_event_json(value: &Value) -> Result<(), CoreError> {
    let object = value
        .as_object()
        .ok_or_else(|| ErrorKind::MalformedEvent.into_error())?;
    if !has_exact_json_keys(
        object,
        &["id", "type", "phase", "payload", "summary", "createdAt"],
    ) {
        return Err(ErrorKind::MalformedEvent.into_error());
    }
    let payload = object
        .get("payload")
        .and_then(Value::as_object)
        .ok_or_else(|| ErrorKind::MalformedEvent.into_error())?;
    for key in [
        "abilityUse",
        "simulationSource",
        "followUpCause",
        "actionCause",
        "deliveredResult",
    ] {
        if payload.get(key).is_some_and(Value::is_null) {
            return Err(ErrorKind::MalformedEvent.into_error());
        }
    }
    let _typed: CustomActionConfirmedPayload =
        serde_json::from_value(Value::Object(payload.clone()))
            .map_err(|_| ErrorKind::MalformedEvent.into_error())?;
    let ability_use = payload
        .get("abilityUse")
        .or_else(|| {
            payload
                .get("simulationSource")
                .and_then(|source| source.get("sourceAbilityUse"))
        })
        .and_then(Value::as_object)
        .ok_or_else(|| ErrorKind::MalformedEvent.into_error())?;
    if !has_exact_json_keys(
        ability_use,
        &["ownerPlayerId", "characterId", "abilityInstanceId"],
    ) {
        return Err(ErrorKind::MalformedEvent.into_error());
    }
    let input = payload
        .get("input")
        .ok_or_else(|| ErrorKind::MalformedEvent.into_error())?;
    validate_custom_step_input_json(input)?;

    validate_custom_action_result_json(
        payload
            .get("result")
            .ok_or_else(|| ErrorKind::MalformedEvent.into_error())?,
    )?;
    Ok(())
}

fn validate_custom_action_result_json(value: &Value) -> Result<(), CoreError> {
    let result = value
        .as_object()
        .ok_or_else(|| ErrorKind::MalformedEvent.into_error())?;
    match result.get("kind").and_then(Value::as_str) {
        Some(
            "philosopherDeferred"
            | "philosopherChoice"
            | "snakeCharmer"
            | "evilTwin"
            | "witch"
            | "cerenovus"
            | "seamstressDeferred"
            | "informationDelivered"
            | "simulationChoice"
            | "simulation"
            | "redHerringAssigned"
            | "informationPrepared"
            | "preparedInformationDelivered"
            | "twinAssigned"
            | "twinInformed"
            | "shownCharacterAssigned"
            | "poisoner"
            | "butler"
            | "mutantExecution",
        ) => {
            let typed: CustomActionResult = serde_json::from_value(value.clone())
                .map_err(|_| ErrorKind::MalformedEvent.into_error())?;
            let information = match typed {
                CustomActionResult::InformationDelivered { information, .. }
                | CustomActionResult::PreparedInformationDelivered { information, .. } => {
                    Some(information)
                }
                CustomActionResult::Simulation { information, .. } => information,
                _ => None,
            };
            if let Some(info) = information {
                validate_custom_information_result_json(
                    &serde_json::to_value(info.delivered_result)
                        .map_err(|_| ErrorKind::MalformedEvent.into_error())?,
                )?;
                if let Some(computed) = info.computed_result {
                    validate_custom_information_result_json(
                        &serde_json::to_value(computed)
                            .map_err(|_| ErrorKind::MalformedEvent.into_error())?,
                    )?;
                }
            }
            Ok(())
        }
        Some("noEffect") if has_exact_json_keys(result, &["kind"]) => Ok(()),
        Some("information") if has_exact_json_keys(result, &["kind", "value"]) => {
            validate_custom_information_result_json(
                result
                    .get("value")
                    .ok_or_else(|| ErrorKind::MalformedEvent.into_error())?,
            )
        }
        #[cfg(feature = "custom-runtime-fixtures")]
        Some("fixtureAbilityGranted")
            if has_exact_json_keys(result, &["kind", "targetCharacterId"])
                && result
                    .get("targetCharacterId")
                    .and_then(Value::as_str)
                    .is_some_and(|character_id| !character_id.trim().is_empty()) =>
        {
            Ok(())
        }
        #[cfg(feature = "custom-runtime-fixtures")]
        Some("fixtureIdentityChanged")
            if has_exact_json_keys(result, &["kind", "playerId", "targetCharacterId"])
                && result
                    .get("playerId")
                    .and_then(Value::as_str)
                    .is_some_and(|player_id| !player_id.trim().is_empty())
                && result
                    .get("targetCharacterId")
                    .and_then(Value::as_str)
                    .is_some_and(|character_id| !character_id.trim().is_empty()) =>
        {
            Ok(())
        }
        #[cfg(feature = "custom-runtime-fixtures")]
        Some("fixtureAbilityRemoved")
            if has_exact_json_keys(
                result,
                &["kind", "ownerPlayerId", "characterId", "abilityInstanceId"],
            ) && ["ownerPlayerId", "characterId", "abilityInstanceId"]
                .into_iter()
                .all(|field| {
                    result
                        .get(field)
                        .and_then(Value::as_str)
                        .is_some_and(|value| !value.trim().is_empty())
                }) =>
        {
            Ok(())
        }
        #[cfg(feature = "custom-runtime-fixtures")]
        Some("fixtureLifeChanged")
            if has_exact_json_keys(result, &["kind", "playerId", "alive"])
                && result
                    .get("playerId")
                    .and_then(Value::as_str)
                    .is_some_and(|player_id| !player_id.trim().is_empty())
                && result.get("alive").and_then(Value::as_bool).is_some() =>
        {
            Ok(())
        }
        #[cfg(feature = "custom-runtime-fixtures")]
        Some("fixtureImpairmentAdded")
            if has_exact_json_keys(result, &["kind", "playerId", "impairmentKind"])
                && result
                    .get("playerId")
                    .and_then(Value::as_str)
                    .is_some_and(|player_id| !player_id.trim().is_empty())
                && matches!(
                    result.get("impairmentKind").and_then(Value::as_str),
                    Some("poisoned") | Some("drunk")
                ) =>
        {
            Ok(())
        }
        #[cfg(feature = "custom-runtime-fixtures")]
        Some("fixtureImpairmentRemoved")
            if has_exact_json_keys(
                result,
                &[
                    "kind",
                    "playerId",
                    "impairmentKind",
                    "sourceEventId",
                    "sourceCharacterId",
                    "expires",
                ],
            ) && result
                .get("playerId")
                .and_then(Value::as_str)
                .is_some_and(|player_id| !player_id.trim().is_empty())
                && matches!(
                    result.get("impairmentKind").and_then(Value::as_str),
                    Some("poisoned") | Some("drunk")
                )
                && result
                    .get("sourceEventId")
                    .and_then(Value::as_str)
                    .is_some_and(|event_id| !event_id.trim().is_empty())
                && result
                    .get("sourceCharacterId")
                    .and_then(Value::as_str)
                    .is_some_and(|character_id| !character_id.trim().is_empty())
                && matches!(
                    result.get("expires").and_then(Value::as_str),
                    Some("never") | Some("whileSourceAbilityActive")
                ) =>
        {
            Ok(())
        }
        _ => Err(ErrorKind::MalformedEvent.into_error()),
    }
}

fn validate_custom_information_result_json(value: &Value) -> Result<(), CoreError> {
    let result = value
        .as_object()
        .ok_or_else(|| ErrorKind::MalformedEvent.into_error())?;
    let kind = result
        .get("kind")
        .and_then(Value::as_str)
        .ok_or_else(|| ErrorKind::MalformedEvent.into_error())?;
    let fields = match kind {
        "number" | "boolean" => &["kind", "value"][..],
        "character" => &["kind", "characterId"][..],
        "characterPair" => &["kind", "characterIds"][..],
        "player" => &["kind", "playerId"][..],
        "playerPair" => &["kind", "playerIds"][..],
        "setupInfo" => &["kind", "playerIds", "characterId", "zeroOutsiders"][..],
        "teamInfo" => &[
            "kind",
            "demonPlayerIds",
            "minionPlayerIds",
            "bluffCharacterIds",
        ][..],
        "spyGrimoire" => &["kind", "players"][..],
        _ => return Err(ErrorKind::MalformedEvent.into_error()),
    };
    if kind == "setupInfo" {
        let with_character = has_exact_json_keys(result, fields);
        let without_character =
            has_exact_json_keys(result, &["kind", "playerIds", "zeroOutsiders"]);
        if !with_character && !without_character {
            return Err(ErrorKind::MalformedEvent.into_error());
        }
    } else if !has_exact_json_keys(result, fields) {
        return Err(ErrorKind::MalformedEvent.into_error());
    }
    serde_json::from_value::<crate::model::InformationResult>(value.clone())
        .map_err(|_| ErrorKind::MalformedEvent.into_error())
        .map(|_| ())
}

fn validate_custom_step_input_json(value: &Value) -> Result<(), CoreError> {
    let Some(input) = value.as_object() else {
        if value.is_null() {
            return Ok(());
        }
        return Err(ErrorKind::MalformedEvent.into_error());
    };
    const ALLOWED_KEYS: &[&str] = &[
        "playerIds",
        "characterIds",
        "characterId",
        "zeroOutsiders",
        "correctPlayerId",
        "value",
        "trueValue",
        "displayedValue",
        "reason",
        "nominatorId",
        "nomineeId",
        "voterIds",
        "execute",
        "died",
        "mayorDecision",
        "successorPlayerId",
    ];
    if input
        .keys()
        .any(|key| !ALLOWED_KEYS.contains(&key.as_str()))
    {
        return Err(ErrorKind::MalformedEvent.into_error());
    }
    Ok(())
}

fn has_exact_json_keys(object: &serde_json::Map<String, Value>, expected: &[&str]) -> bool {
    object.len() == expected.len() && expected.iter().all(|key| object.contains_key(*key))
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

pub(crate) fn replay_json(json: &str) -> String {
    to_json(parse_game_file(json).and_then(crate::game::replay))
}
pub(crate) fn propose_json(json: &str, command: &str) -> String {
    to_json(parse_game_file(json).and_then(|game| {
        let command = parse_command(command)?;
        if command
            .expected_event_count()
            .is_some_and(|expected| expected != game.game.events.len())
        {
            return Err(ErrorKind::StaleCommand.into_error());
        }
        crate::game::propose(&game, command)
    }))
}
pub(crate) fn parse_game_file(json: &str) -> Result<GameFile, CoreError> {
    let raw: RawGameFile =
        serde_json::from_str(json).map_err(|_| ErrorKind::MalformedGameFile.into_error())?;
    if raw.schema_version != 4 {
        return Err(ErrorKind::UnsupportedSchemaVersion.into_error());
    }
    if raw.game.fields.contains_key("scriptId") {
        return Err(ErrorKind::MalformedGameFile.into_error());
    }
    let object = raw
        .game
        .fields
        .get("script")
        .and_then(Value::as_object)
        .ok_or_else(|| ErrorKind::MalformedGameFile.into_error())?;
    if object.len() != 2
        || object.get("type").and_then(Value::as_str) != Some("custom")
        || !object.contains_key("definition")
    {
        return Err(ErrorKind::MalformedGameFile.into_error());
    }
    let definition: CustomScriptDefinition =
        serde_json::from_value(object["definition"].clone())
            .map_err(|_| ErrorKind::MalformedCustomScriptDefinition.into_error())?;
    crate::first_night::plan_for_definition(&definition)?;
    let events = raw
        .game
        .events
        .into_iter()
        .map(parse_event)
        .collect::<Result<Vec<_>, _>>()?;
    let mut ids = HashSet::new();
    for event in &events {
        if !ids.insert(EventId::parse(&event.id)?) {
            return Err(ErrorKind::DuplicateEventId.into_error());
        }
    }
    Ok(GameFile {
        schema_version: 4,
        script: ScriptReference::Custom { definition },
        game: Game {
            updated_at: raw.game.updated_at,
            events,
        },
    })
}

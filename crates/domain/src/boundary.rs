use std::collections::HashMap;

use serde::Serialize;
use serde_json::Value;

use crate::{
    contracts::{
        Command, CustomFirstNightPlanRequest, CustomScriptDefinition, Discriminator, Game,
        GameEvent, GameEventKind, GameFile, PhaseInputSuggestionRequest, RawGameFile, ScriptId,
        ScriptReference, SetupDistributionRequest,
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

pub(crate) fn custom_first_night_plan_json(request_json: &str) -> String {
    let result = serde_json::from_str::<CustomFirstNightPlanRequest>(request_json)
        .map_err(|_| ErrorKind::MalformedRequest.into_error())
        .and_then(|request| crate::custom::first_night::plan_for_draft(&request.custom_definition));
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

    let has_legacy_script_id = raw.game.fields.contains_key("scriptId");
    let has_script_reference = raw.game.fields.contains_key("script");
    let script = match raw.schema_version {
        2 if !has_legacy_script_id && !has_script_reference => ScriptReference::Official {
            script_id: ScriptId::TroubleBrewing,
        },
        2 => return Err(ErrorKind::MalformedGameFile.into_error()),
        3 if has_legacy_script_id && !has_script_reference => ScriptReference::Official {
            script_id: parse_official_script_id(&raw.game.fields["scriptId"])?,
        },
        3 => return Err(ErrorKind::MalformedGameFile.into_error()),
        4 if !has_legacy_script_id && has_script_reference => {
            parse_script_reference(&raw.game.fields["script"])?
        }
        4 => return Err(ErrorKind::MalformedGameFile.into_error()),
        _ => return Err(ErrorKind::UnsupportedSchemaVersion.into_error()),
    };

    let events = raw
        .game
        .events
        .into_iter()
        .map(parse_event)
        .collect::<Result<Vec<_>, _>>()?;
    validate_event_references(&events)?;
    if let ScriptReference::Official { script_id } = &script {
        if events
            .iter()
            .any(|event| matches!(event.kind, GameEventKind::CustomActionConfirmed { .. }))
        {
            return Err(ErrorKind::EventNotSupportedByScript.into_error());
        }
        crate::characters::rules(*script_id).validate_replay_events(&events)?;
    }

    Ok(GameFile {
        schema_version: raw.schema_version,
        script,
        game: Game {
            updated_at: raw.game.updated_at,
            events,
        },
    })
}

fn parse_official_script_id(value: &Value) -> Result<ScriptId, CoreError> {
    serde_json::from_value(value.clone()).map_err(|_| ErrorKind::MalformedGameFile.into_error())
}

fn parse_script_reference(value: &Value) -> Result<ScriptReference, CoreError> {
    let object = value
        .as_object()
        .ok_or_else(|| ErrorKind::MalformedGameFile.into_error())?;
    let kind = object
        .get("type")
        .and_then(Value::as_str)
        .ok_or_else(|| ErrorKind::MalformedGameFile.into_error())?;

    match kind {
        "official" if object.len() == 2 && object.contains_key("scriptId") => {
            Ok(ScriptReference::Official {
                script_id: parse_official_script_id(&object["scriptId"])?,
            })
        }
        "custom" if object.len() == 2 && object.contains_key("definition") => {
            let definition =
                serde_json::from_value::<CustomScriptDefinition>(object["definition"].clone())
                    .map_err(|_| ErrorKind::MalformedCustomScriptDefinition.into_error())?;
            crate::custom::first_night::plan_for_definition(&definition)?;
            Ok(ScriptReference::Custom { definition })
        }
        _ => Err(ErrorKind::MalformedGameFile.into_error()),
    }
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
            GameEventKind::OrderedDeathResolved { payload } => {
                crate::death::validate_contract(payload)?;
                match &payload.source {
                    crate::contracts::OrderedDeathSource::Ability { .. } => {}
                    crate::contracts::OrderedDeathSource::Execution { execution_event_id } => {
                        let execution_id = EventId::parse(execution_event_id)
                            .map_err(|_| ErrorKind::InvalidEventReference.into_error())?;
                        let Some(GameEventKind::ExecutionConfirmed { payload: execution }) =
                            prior_by_id.get(&execution_id).copied()
                        else {
                            return Err(ErrorKind::InvalidEventReference.into_error());
                        };
                        let attempted_player = payload
                            .resolutions
                            .first()
                            .map(|resolution| resolution.attempt.target_player_id.as_str());
                        if payload.resolutions.len() != 1
                            || !execution.input.execute
                            || execution.input.player_id.as_deref() != attempted_player
                        {
                            return Err(ErrorKind::InvalidEventReference.into_error());
                        }
                    }
                    crate::contracts::OrderedDeathSource::Event {
                        source_event_id, ..
                    } => {
                        let source_id = EventId::parse(source_event_id)
                            .map_err(|_| ErrorKind::InvalidEventReference.into_error())?;
                        if !prior_by_id.contains_key(&source_id) {
                            return Err(ErrorKind::InvalidEventReference.into_error());
                        }
                    }
                }
            }
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
            | GameEventKind::OrderedDeathResolved { .. }
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
    if discriminator.kind == "customActionConfirmed" {
        validate_custom_action_event_json(&value)?;
    }
    let event: GameEvent =
        serde_json::from_value(value).map_err(|_| ErrorKind::MalformedEvent.into_error())?;
    if matches!(event.kind, GameEventKind::CustomActionConfirmed { .. }) {
        crate::custom::event::validate_custom_event_shape(&event)
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
    if !has_exact_json_keys(
        payload,
        &["stepId", "actionRef", "abilityUse", "input", "result"],
    ) {
        return Err(ErrorKind::MalformedEvent.into_error());
    }

    let action_ref = payload
        .get("actionRef")
        .and_then(Value::as_object)
        .ok_or_else(|| ErrorKind::MalformedEvent.into_error())?;
    if action_ref.get("kind").and_then(Value::as_str) != Some("character") {
        return Err(ErrorKind::MalformedEvent.into_error());
    }
    let ability_use = payload
        .get("abilityUse")
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

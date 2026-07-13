use std::collections::{HashMap, HashSet};

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GameFile {
    schema_version: u32,
    game: Game,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Game {
    updated_at: Option<String>,
    events: Vec<ConfirmedEvent>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ConfirmedEvent {
    #[serde(rename = "type")]
    event_type: String,
    payload: Value,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Command {
    #[serde(rename = "type")]
    command_type: String,
    #[serde(default)]
    payload: Value,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SetupPlayerInput {
    #[serde(default)]
    id: Option<String>,
    seat: u8,
    name: String,
    actual_character: String,
    #[serde(default)]
    shown_character: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateGamePayload {
    players: Vec<SetupPlayerInput>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SetupDistributionRequest {
    player_count: usize,
    #[serde(default)]
    actual_characters: Vec<String>,
}

#[derive(Debug, Serialize, PartialEq, Eq, Copy, Clone)]
#[serde(rename_all = "PascalCase")]
struct SetupDistribution {
    townsfolk: usize,
    outsider: usize,
    minion: usize,
    demon: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CoreResult<T: Serialize> {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    value: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<CoreError>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CoreError {
    code: &'static str,
    message_ko: &'static str,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReplayState {
    schema_version: u32,
    event_count: usize,
    phase: &'static str,
    players: Vec<Player>,
    current_step: Option<PhaseStep>,
    phase_overview: Vec<PhaseOverviewItem>,
    #[serde(skip_serializing_if = "Option::is_none")]
    day_state: Option<DayState>,
    warnings: Vec<CoreWarning>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Proposal {
    event: GameEvent,
    warnings: Vec<CoreWarning>,
    follow_up_steps: Vec<Value>,
    preview: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    reveal_payload: Option<RevealPayload>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RevealPayload {
    message_ko: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    preview_message_ko: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GameEvent {
    id: String,
    #[serde(rename = "type")]
    event_type: String,
    phase: String,
    payload: Value,
    summary: String,
    created_at: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct PhaseStep {
    id: String,
    phase: &'static str,
    step_type: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    character: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    player_id: Option<String>,
    required_input: RequiredInput,
    can_skip: bool,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RequiredInput {
    kind: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    target: Option<&'static str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    min_selections: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_selections: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    setup_info: Option<&'static str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    character_kind: Option<&'static str>,
    #[serde(skip_serializing_if = "is_false")]
    zero_allowed: bool,
    optional: bool,
}

fn is_false(value: &bool) -> bool {
    !*value
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PhaseOverviewItem {
    id: String,
    phase: &'static str,
    step_type: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    character: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    player_id: Option<String>,
    required_input: RequiredInput,
    can_skip: bool,
    status: &'static str,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PhaseStepCommandPayload {
    step_id: String,
    #[serde(default)]
    input: Value,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NominationVoteInput {
    nominator_id: String,
    nominee_id: String,
    voter_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExecutionDecisionInput {
    execute: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DayState {
    nominations: Vec<NominationRecord>,
    #[serde(skip_serializing_if = "Option::is_none")]
    execution_candidate: Option<ExecutionCandidate>,
    #[serde(skip_serializing_if = "Option::is_none")]
    confirmed_execution: Option<ConfirmedExecution>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct NominationRecord {
    step_id: String,
    nominator_id: String,
    nominee_id: String,
    voter_ids: Vec<String>,
    vote_count: usize,
    ghost_vote_spent_player_ids: Vec<String>,
    updates_execution_candidate: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ExecutionCandidate {
    nominee_id: String,
    vote_count: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ConfirmedExecution {
    #[serde(skip_serializing_if = "Option::is_none")]
    player_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Player {
    id: String,
    seat: u8,
    name: String,
    actual_character: String,
    shown_character: String,
    alignment: Alignment,
    alive: bool,
    ghost_vote_used: bool,
    death_announced: bool,
    notes: String,
}

#[derive(Debug, Serialize, PartialEq, Eq, Copy, Clone)]
#[serde(rename_all = "lowercase")]
enum Alignment {
    Good,
    Evil,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CoreWarning {
    code: String,
    severity: &'static str,
    message_ko: String,
}

pub fn replay_json(game_file_json: &str) -> String {
    let result = parse_game_file(game_file_json).and_then(|game_file| {
        let players = replay_players(&game_file.game.events)?;
        let warnings = validate_setup_warnings(&players);
        let phase_state = replay_phase_state(&players, &game_file.game.events)?;
        let day_state = if phase_state.phase == "day" {
            current_day_prefix(&phase_state)
                .map(|prefix| replay_day_state(&game_file.game.events, &prefix))
                .transpose()?
        } else {
            None
        };

        Ok(ReplayState {
            schema_version: game_file.schema_version,
            event_count: game_file.game.events.len(),
            phase: phase_state.phase,
            players,
            current_step: phase_state.current_step,
            phase_overview: phase_state.phase_overview,
            day_state,
            warnings,
        })
    });

    to_json(result)
}

pub fn propose_json(game_file_json: &str, command_json: &str) -> String {
    let result = parse_game_file(game_file_json).and_then(|game_file| {
        let command: Command = serde_json::from_str(command_json)
            .map_err(|_| error("MALFORMED_COMMAND", "명령 형식이 올바르지 않습니다."))?;

        match command.command_type.as_str() {
            "smoke" => Ok(Proposal {
                event: GameEvent {
                    id: "smoke-event".to_string(),
                    event_type: "smokeConfirmed".to_string(),
                    phase: "setup".to_string(),
                    payload: serde_json::json!({ "source": "smoke" }),
                    summary: "스모크 명령 확인".to_string(),
                    created_at: "1970-01-01T00:00:00.000Z".to_string(),
                },
                warnings: Vec::new(),
                follow_up_steps: Vec::new(),
                preview: serde_json::json!({ "messageKo": "코어 계약 정상" }),
                reveal_payload: None,
            }),
            "createGame" => propose_create_game(&game_file, command.payload),
            "confirmStep" => propose_phase_step(&game_file, command.payload, false),
            "skipStep" => propose_phase_step(&game_file, command.payload, true),
            _ => Err(error("UNSUPPORTED_COMMAND", "지원하지 않는 명령입니다.")),
        }
    });

    to_json(result)
}

pub fn setup_distribution_json(request_json: &str) -> String {
    let result = serde_json::from_str::<SetupDistributionRequest>(request_json)
        .map_err(|_| error("MALFORMED_REQUEST", "요청 형식이 올바르지 않습니다."))
        .and_then(|request| {
            if request.player_count < 5 || request.player_count > 15 {
                return Err(error(
                    "INVALID_PLAYER_COUNT",
                    "플레이어는 5명 이상 15명 이하이어야 합니다.",
                ));
            }

            Ok(expected_distribution(
                request.player_count,
                request
                    .actual_characters
                    .iter()
                    .any(|character| character.as_str() == "baron"),
            ))
        });

    to_json(result)
}

fn parse_game_file(json: &str) -> Result<GameFile, CoreError> {
    let game_file: GameFile = serde_json::from_str(json)
        .map_err(|_| error("MALFORMED_GAME_FILE", "게임 파일 형식이 올바르지 않습니다."))?;

    if game_file.schema_version != 1 {
        return Err(error(
            "UNSUPPORTED_SCHEMA_VERSION",
            "지원하지 않는 게임 파일 버전입니다.",
        ));
    }

    Ok(game_file)
}

fn to_json<T: Serialize>(result: Result<T, CoreError>) -> String {
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

fn error(code: &'static str, message_ko: &'static str) -> CoreError {
    CoreError { code, message_ko }
}

fn propose_create_game(game_file: &GameFile, payload: Value) -> Result<Proposal, CoreError> {
    if !game_file.game.events.is_empty() {
        return Err(error(
            "GAME_ALREADY_HAS_EVENTS",
            "이미 확정된 이벤트가 있는 게임입니다.",
        ));
    }

    let payload: CreateGamePayload = serde_json::from_value(payload)
        .map_err(|_| error("MALFORMED_COMMAND", "명령 형식이 올바르지 않습니다."))?;
    validate_setup_inputs(&payload.players)?;

    let players = payload
        .players
        .iter()
        .map(normalized_setup_player)
        .collect::<Result<Vec<_>, _>>()?;
    let derived_players = players
        .iter()
        .map(player_from_setup_input)
        .collect::<Result<Vec<_>, _>>()?;
    let warnings = validate_setup_warnings(&derived_players);
    let count = players.len();

    Ok(Proposal {
        event: GameEvent {
            id: format!("setup-{}", game_file.game.events.len() + 1),
            event_type: "setupConfirmed".to_string(),
            phase: "setup".to_string(),
            payload: serde_json::json!({ "players": players }),
            summary: format!("초기 설정 확정: {count}명"),
            created_at: game_file
                .game
                .updated_at
                .clone()
                .unwrap_or_else(|| "1970-01-01T00:00:00.000Z".to_string()),
        },
        warnings,
        follow_up_steps: Vec::new(),
        preview: serde_json::json!({
            "messageKo": format!("플레이어 {count}명 설정을 확정합니다.")
        }),
        reveal_payload: None,
    })
}

fn propose_phase_step(
    game_file: &GameFile,
    payload: Value,
    skip: bool,
) -> Result<Proposal, CoreError> {
    let payload: PhaseStepCommandPayload = serde_json::from_value(payload)
        .map_err(|_| error("MALFORMED_COMMAND", "명령 형식이 올바르지 않습니다."))?;
    let players = replay_players(&game_file.game.events)?;
    let phase_state = replay_phase_state(&players, &game_file.game.events)?;
    let Some(current_step) = phase_state.current_step else {
        return Err(error("NO_CURRENT_STEP", "진행할 현재 단계가 없습니다."));
    };

    if payload.step_id != current_step.id {
        return Err(error("STALE_STEP", "현재 단계와 일치하지 않는 명령입니다."));
    }
    if skip && !current_step.can_skip {
        return Err(error(
            "STEP_CANNOT_BE_SKIPPED",
            "건너뛸 수 없는 단계입니다.",
        ));
    }
    if skip && current_step.step_type == "nomination" {
        return propose_nomination_closed(game_file, &current_step);
    }
    if !skip {
        validate_required_input(&current_step.required_input, &payload.input, &players)?;
    }
    if !skip && current_step.step_type == "nomination" {
        return propose_nomination_vote(game_file, &current_step, &players, payload.input);
    }
    if !skip && current_step.step_type == "execution" {
        return propose_execution_decision(game_file, &current_step, &players, payload.input);
    }

    let event_type = if skip {
        "phaseStepSkipped"
    } else {
        "phaseStepConfirmed"
    };
    let summary_action = if skip { "건너뜀" } else { "확정" };
    let event_count = game_file.game.events.len() + 1;
    let reveal_payload = if skip {
        None
    } else {
        phase_step_reveal_payload(&current_step, &players, &payload.input)
    };
    let event_payload = if skip {
        serde_json::json!({ "stepId": current_step.id })
    } else {
        phase_step_event_payload(&current_step, &players, payload.input)
    };
    let summary = if skip {
        format!("단계 {summary_action}: {}", current_step.id)
    } else {
        phase_step_summary(
            &current_step,
            &players,
            event_payload.get("input").unwrap_or(&Value::Null),
        )
        .unwrap_or_else(|| format!("단계 {summary_action}: {}", current_step.id))
    };

    Ok(Proposal {
        event: GameEvent {
            id: format!("phase-step-{event_count}"),
            event_type: event_type.to_string(),
            phase: current_step.phase.to_string(),
            payload: event_payload,
            summary,
            created_at: game_file
                .game
                .updated_at
                .clone()
                .unwrap_or_else(|| "1970-01-01T00:00:00.000Z".to_string()),
        },
        warnings: Vec::new(),
        follow_up_steps: Vec::new(),
        preview: serde_json::json!({
            "messageKo": format!("현재 단계를 {summary_action}합니다.")
        }),
        reveal_payload,
    })
}

fn propose_nomination_closed(
    game_file: &GameFile,
    current_step: &PhaseStep,
) -> Result<Proposal, CoreError> {
    let event_count = game_file.game.events.len() + 1;

    Ok(Proposal {
        event: GameEvent {
            id: format!("nomination-closed-{event_count}"),
            event_type: "phaseStepSkipped".to_string(),
            phase: current_step.phase.to_string(),
            payload: serde_json::json!({ "stepId": current_step.id }),
            summary: "지명 종료".to_string(),
            created_at: game_file
                .game
                .updated_at
                .clone()
                .unwrap_or_else(|| "1970-01-01T00:00:00.000Z".to_string()),
        },
        warnings: Vec::new(),
        follow_up_steps: Vec::new(),
        preview: serde_json::json!({ "messageKo": "지명을 종료하고 처형 확인으로 이동합니다." }),
        reveal_payload: None,
    })
}

fn propose_nomination_vote(
    game_file: &GameFile,
    current_step: &PhaseStep,
    players: &[Player],
    input: Value,
) -> Result<Proposal, CoreError> {
    let record = nomination_record(current_step, players, &input, &game_file.game.events)?;
    let event_count = game_file.game.events.len() + 1;
    let nominee =
        player_label(players, &record.nominee_id).unwrap_or_else(|| "알 수 없음".to_string());
    let nominator =
        player_label(players, &record.nominator_id).unwrap_or_else(|| "알 수 없음".to_string());

    Ok(Proposal {
        event: GameEvent {
            id: format!("nomination-vote-{event_count}"),
            event_type: "nominationVoteConfirmed".to_string(),
            phase: current_step.phase.to_string(),
            payload: serde_json::json!({
                "stepId": current_step.id,
                "input": record
            }),
            summary: format!(
                "지명 투표 확정: {nominator} → {nominee}, {}표{}",
                record.vote_count,
                if record.updates_execution_candidate {
                    ", 처형 후보 갱신"
                } else {
                    ""
                }
            ),
            created_at: game_file
                .game
                .updated_at
                .clone()
                .unwrap_or_else(|| "1970-01-01T00:00:00.000Z".to_string()),
        },
        warnings: Vec::new(),
        follow_up_steps: Vec::new(),
        preview: serde_json::json!({
            "messageKo": format!("{}표로 지명 투표를 확정합니다.", record.vote_count),
            "voteCount": record.vote_count,
            "ghostVoteSpentPlayerIds": record.ghost_vote_spent_player_ids,
            "updatesExecutionCandidate": record.updates_execution_candidate
        }),
        reveal_payload: None,
    })
}

fn propose_execution_decision(
    game_file: &GameFile,
    current_step: &PhaseStep,
    players: &[Player],
    input: Value,
) -> Result<Proposal, CoreError> {
    let decision: ExecutionDecisionInput = serde_json::from_value(input)
        .map_err(|_| error("MALFORMED_COMMAND", "명령 형식이 올바르지 않습니다."))?;
    let prefix = step_prefix(&current_step.id)?;
    let day_state = replay_day_state(&game_file.game.events, &prefix)?;
    let event_count = game_file.game.events.len() + 1;
    let player_id = if decision.execute {
        Some(
            day_state
                .execution_candidate
                .ok_or_else(|| error("NO_EXECUTION_CANDIDATE", "처형 후보가 없습니다."))?
                .nominee_id,
        )
    } else {
        None
    };
    let event_type = if player_id.is_some() {
        "executionConfirmed"
    } else {
        "noExecutionConfirmed"
    };
    let summary = if let Some(player_id) = &player_id {
        format!(
            "처형 확정: {}",
            player_label(players, player_id).unwrap_or_else(|| player_id.to_string())
        )
    } else {
        "처형 없음 확정".to_string()
    };

    Ok(Proposal {
        event: GameEvent {
            id: format!("execution-{event_count}"),
            event_type: event_type.to_string(),
            phase: current_step.phase.to_string(),
            payload: serde_json::json!({
                "stepId": current_step.id,
                "input": {
                    "execute": decision.execute,
                    "playerId": player_id
                }
            }),
            summary,
            created_at: game_file
                .game
                .updated_at
                .clone()
                .unwrap_or_else(|| "1970-01-01T00:00:00.000Z".to_string()),
        },
        warnings: Vec::new(),
        follow_up_steps: Vec::new(),
        preview: serde_json::json!({
            "messageKo": if decision.execute { "처형을 확정합니다." } else { "처형 없음을 확정합니다." }
        }),
        reveal_payload: None,
    })
}

fn phase_step_event_payload(step: &PhaseStep, players: &[Player], input: Value) -> Value {
    if step.character.as_deref() == Some("chef") {
        let true_value = evil_neighbor_pair_count(players);
        let displayed_value = numeric_input_value(&input).unwrap_or(true_value);
        return serde_json::json!({
            "stepId": step.id,
            "input": {
                "trueValue": true_value,
                "displayedValue": displayed_value,
                "reason": numeric_input_reason(&input)
            }
        });
    }

    serde_json::json!({ "stepId": step.id, "input": input })
}

fn phase_step_reveal_payload(
    step: &PhaseStep,
    players: &[Player],
    input: &Value,
) -> Option<RevealPayload> {
    match step.step_type {
        "evilInfo" => return evil_info_reveal_payload(step, players, input),
        _ => {}
    }

    match step.character.as_deref()? {
        "washerwoman" => setup_info_reveal_payload("washerwoman", input, players),
        "librarian" => setup_info_reveal_payload("librarian", input, players),
        "investigator" => setup_info_reveal_payload("investigator", input, players),
        "chef" => Some(RevealPayload {
            message_ko: format!(
                "서로 이웃한 악 팀 쌍은 {}쌍입니다.",
                numeric_input_value(input).unwrap_or_else(|| evil_neighbor_pair_count(players))
            ),
            preview_message_ko: None,
        }),
        "empath" => Some(RevealPayload {
            message_ko: format!(
                "살아있는 양옆 이웃 중 악 팀은 {}명입니다.",
                empath_evil_neighbor_count(players, step.player_id.as_deref()?)?
            ),
            preview_message_ko: None,
        }),
        "spy" => Some(RevealPayload {
            message_ko: format!("스파이 그리모어:\n{}", grimoire_lines(players).join("\n")),
            preview_message_ko: Some("스파이 그리모어 Reveal 준비됨".to_string()),
        }),
        _ => None,
    }
}

fn phase_step_summary(step: &PhaseStep, players: &[Player], input: &Value) -> Option<String> {
    match step.character.as_deref()? {
        "washerwoman" | "librarian" | "investigator" => {
            setup_info_summary(step.character.as_deref()?, input, players)
        }
        "chef" => {
            let true_value = input
                .get("trueValue")
                .and_then(Value::as_u64)
                .map(|value| value as usize)
                .unwrap_or_else(|| evil_neighbor_pair_count(players));
            let displayed_value = input
                .get("displayedValue")
                .and_then(Value::as_u64)
                .map(|value| value as usize)
                .unwrap_or(true_value);
            Some(format!(
                "요리사 정보 확정: 실제 {true_value}쌍, 표시 {displayed_value}쌍{}",
                input
                    .get("reason")
                    .and_then(Value::as_str)
                    .map(|reason| format!(" ({})", chef_reason_label(reason)))
                    .unwrap_or_default()
            ))
        }
        _ => None,
    }
}

fn setup_info_summary(kind: &str, input: &Value, players: &[Player]) -> Option<String> {
    if kind == "librarian" && input.get("zeroOutsiders").and_then(Value::as_bool) == Some(true) {
        return Some("사서 정보 확정: 외부인 0명".to_string());
    }

    let character_id = input.get("characterId")?.as_str()?;
    let candidates = setup_info_candidate_labels(input, players)?;
    Some(format!(
        "{} 정보 확정: {} 중 {}",
        setup_info_label(kind),
        candidates.join(", "),
        character_label(character_id)
    ))
}

fn setup_info_reveal_payload(
    kind: &str,
    input: &Value,
    players: &[Player],
) -> Option<RevealPayload> {
    if kind == "librarian" && input.get("zeroOutsiders").and_then(Value::as_bool) == Some(true) {
        return Some(RevealPayload {
            message_ko: "사서 정보: 외부인은 0명입니다.".to_string(),
            preview_message_ko: None,
        });
    }

    let character_id = input.get("characterId")?.as_str()?;
    let candidates = setup_info_candidate_labels(input, players)?;
    Some(RevealPayload {
        message_ko: format!(
            "{} 정보: {} 중 한 명은 {}입니다.",
            setup_info_label(kind),
            candidates.join(" 또는 "),
            character_label(character_id)
        ),
        preview_message_ko: None,
    })
}

fn setup_info_candidate_labels(input: &Value, players: &[Player]) -> Option<Vec<String>> {
    input
        .get("playerIds")?
        .as_array()?
        .iter()
        .filter_map(Value::as_str)
        .map(|player_id| player_label(players, player_id))
        .collect()
}

fn evil_info_reveal_payload(
    step: &PhaseStep,
    players: &[Player],
    input: &Value,
) -> Option<RevealPayload> {
    let demons = players
        .iter()
        .filter(|player| {
            matches!(
                character_kind(&player.actual_character),
                Some(CharacterKind::Demon)
            )
        })
        .map(|player| player_character_label(player))
        .collect::<Vec<_>>();
    let minions = players
        .iter()
        .filter(|player| {
            matches!(
                character_kind(&player.actual_character),
                Some(CharacterKind::Minion)
            )
        })
        .map(|player| player_character_label(player))
        .collect::<Vec<_>>();

    if step.id.ends_with(":minionInfo") {
        return Some(RevealPayload {
            message_ko: format!(
                "하수인 정보:\n악마: {}\n하수인: {}",
                list_or_none(&demons),
                list_or_none(&minions)
            ),
            preview_message_ko: None,
        });
    }
    if step.id.ends_with(":demonInfo") {
        let bluffs = input
            .get("characterIds")
            .and_then(Value::as_array)
            .map(|character_ids| {
                character_ids
                    .iter()
                    .filter_map(Value::as_str)
                    .map(character_label)
                    .collect::<Vec<_>>()
                    .join(", ")
            })
            .filter(|bluffs| !bluffs.is_empty())
            .unwrap_or_else(|| "없음".to_string());
        return Some(RevealPayload {
            message_ko: format!(
                "악마 정보:\n하수인: {}\n블러프: {bluffs}",
                list_or_none(&minions)
            ),
            preview_message_ko: None,
        });
    }

    None
}

fn grimoire_lines(players: &[Player]) -> Vec<String> {
    seated_players(players)
        .iter()
        .map(|player| player_character_label(player))
        .collect()
}

fn list_or_none(values: &[String]) -> String {
    if values.is_empty() {
        "없음".to_string()
    } else {
        values.join(", ")
    }
}

fn player_character_label(player: &Player) -> String {
    format!(
        "{}번 {} - {}",
        player.seat,
        player.name,
        character_label(&player.actual_character)
    )
}

fn player_label(players: &[Player], player_id: &str) -> Option<String> {
    players
        .iter()
        .find(|player| player.id == player_id)
        .map(|player| format!("{}번 {}", player.seat, player.name))
}

fn setup_info_label(kind: &str) -> &'static str {
    match kind {
        "washerwoman" => "세탁부",
        "librarian" => "사서",
        "investigator" => "조사관",
        _ => "정보",
    }
}

fn chef_reason_label(reason: &str) -> &'static str {
    match reason {
        "drunk" => "술취함",
        "poisoned" => "중독",
        "registration" => "등록 판정",
        _ => "표시값 조정",
    }
}

fn numeric_input_value(input: &Value) -> Option<usize> {
    input
        .get("value")
        .or_else(|| input.get("displayedValue"))
        .and_then(Value::as_u64)
        .map(|value| value as usize)
}

fn numeric_input_reason(input: &Value) -> Option<&str> {
    input.get("reason").and_then(Value::as_str)
}

fn evil_neighbor_pair_count(players: &[Player]) -> usize {
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

fn empath_evil_neighbor_count(players: &[Player], player_id: &str) -> Option<usize> {
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

fn alive_neighbor_indexes(players: &[&Player], index: usize) -> Vec<usize> {
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

fn seated_players(players: &[Player]) -> Vec<&Player> {
    let mut seated = players.iter().collect::<Vec<_>>();
    seated.sort_by_key(|player| player.seat);
    seated
}

fn validate_required_input(
    input: &RequiredInput,
    value: &Value,
    players: &[Player],
) -> Result<(), CoreError> {
    if input.kind == "setupInfo" {
        return validate_setup_info_input(input.setup_info.unwrap_or_default(), value, players);
    }
    if input.kind == "number" {
        return validate_number_input(value);
    }
    if input.kind == "nominationVote" {
        return validate_nomination_vote_input(value, players);
    }
    if input.kind == "executionDecision" {
        return validate_execution_decision_input(value);
    }
    if input.target == Some("characters") {
        return validate_character_selection(input, value);
    }
    if input.target != Some("player") && input.target != Some("players") {
        return Ok(());
    }

    let player_ids = value
        .get("playerIds")
        .and_then(Value::as_array)
        .ok_or_else(|| error("MALFORMED_COMMAND", "명령 형식이 올바르지 않습니다."))?;
    if player_ids.iter().any(|player_id| !player_id.is_string()) {
        return Err(error("MALFORMED_COMMAND", "명령 형식이 올바르지 않습니다."));
    }
    let mut unique_player_ids = HashSet::new();
    let roster_player_ids = players
        .iter()
        .map(|player| player.id.as_str())
        .collect::<HashSet<_>>();
    for player_id in player_ids.iter().filter_map(Value::as_str) {
        if !unique_player_ids.insert(player_id) || !roster_player_ids.contains(player_id) {
            return Err(error(
                "INVALID_STEP_INPUT",
                "현재 단계 입력이 올바르지 않습니다.",
            ));
        }
    }

    let count = player_ids.len();
    if let Some(min) = input.min_selections {
        if count < usize::from(min) {
            return Err(error(
                "MISSING_STEP_INPUT",
                "현재 단계에 필요한 입력이 없습니다.",
            ));
        }
    }
    if let Some(max) = input.max_selections {
        if count > usize::from(max) {
            return Err(error(
                "TOO_MUCH_STEP_INPUT",
                "현재 단계 입력이 너무 많습니다.",
            ));
        }
    }

    Ok(())
}

struct PhaseReplayState {
    phase: &'static str,
    current_step: Option<PhaseStep>,
    phase_overview: Vec<PhaseOverviewItem>,
}

fn replay_phase_state(
    players: &[Player],
    events: &[ConfirmedEvent],
) -> Result<PhaseReplayState, CoreError> {
    if players.is_empty() {
        return Ok(PhaseReplayState {
            phase: "setup",
            current_step: None,
            phase_overview: Vec::new(),
        });
    }

    let step_statuses = phase_step_statuses(events, players)?;
    for (phase, steps) in phase_sequences_with_statuses(players, events.len() + 2, &step_statuses) {
        let phase_complete = steps
            .iter()
            .all(|step| step_status(&step.id, &step_statuses).is_done());
        if phase_complete {
            continue;
        }

        let current_step = steps
            .iter()
            .find(|step| !step_status(&step.id, &step_statuses).is_done())
            .cloned();
        let current_step_id = current_step.as_ref().map(|step| step.id.as_str());
        let phase_overview = steps
            .into_iter()
            .map(|step| {
                let status = match step_status(&step.id, &step_statuses) {
                    StepStatus::Complete => "complete",
                    StepStatus::Skipped => "skipped",
                    StepStatus::NeedsFollowUp => "needsFollowUp",
                    StepStatus::Open if Some(step.id.as_str()) == current_step_id => "current",
                    StepStatus::Open => "waiting",
                };

                PhaseOverviewItem {
                    id: step.id,
                    phase: step.phase,
                    step_type: step.step_type,
                    character: step.character,
                    player_id: step.player_id,
                    required_input: step.required_input,
                    can_skip: step.can_skip,
                    status,
                }
            })
            .collect();

        return Ok(PhaseReplayState {
            phase,
            current_step,
            phase_overview,
        });
    }

    Ok(PhaseReplayState {
        phase: "night",
        current_step: None,
        phase_overview: Vec::new(),
    })
}

#[derive(Debug, Copy, Clone)]
enum StepStatus {
    Open,
    Complete,
    Skipped,
    NeedsFollowUp,
}

impl StepStatus {
    fn is_done(self) -> bool {
        matches!(self, StepStatus::Complete | StepStatus::Skipped)
    }
}

fn step_status(step_id: &str, statuses: &HashMap<String, StepStatus>) -> StepStatus {
    statuses.get(step_id).copied().unwrap_or(StepStatus::Open)
}

fn phase_step_statuses(
    events: &[ConfirmedEvent],
    players: &[Player],
) -> Result<HashMap<String, StepStatus>, CoreError> {
    let mut statuses = HashMap::new();
    for event in events {
        let status = match event.event_type.as_str() {
            "phaseStepConfirmed"
            | "nominationVoteConfirmed"
            | "executionConfirmed"
            | "noExecutionConfirmed" => StepStatus::Complete,
            "phaseStepSkipped" => StepStatus::Skipped,
            "phaseStepNeedsFollowUp" => StepStatus::NeedsFollowUp,
            _ => continue,
        };
        let Some(step_id) = event.payload.get("stepId").and_then(Value::as_str) else {
            return Err(error("REPLAY_FAILED", "확정 이벤트를 재생할 수 없습니다."));
        };
        let Some((_, _, Some(step))) = current_phase_steps(players, events.len() + 2, &statuses)
        else {
            return Err(error("REPLAY_FAILED", "확정 이벤트를 재생할 수 없습니다."));
        };
        if step.id != step_id {
            return Err(error("REPLAY_FAILED", "확정 이벤트를 재생할 수 없습니다."));
        }
        if matches!(status, StepStatus::Skipped) && !step.can_skip {
            return Err(error("REPLAY_FAILED", "확정 이벤트를 재생할 수 없습니다."));
        }
        if matches!(status, StepStatus::Complete) {
            validate_required_input(
                &step.required_input,
                event.payload.get("input").unwrap_or(&Value::Null),
                players,
            )?;
        }
        statuses.insert(step_id.to_string(), status);
    }
    Ok(statuses)
}

fn phase_sequences_with_statuses(
    players: &[Player],
    max_cycles: usize,
    statuses: &HashMap<String, StepStatus>,
) -> Vec<(&'static str, Vec<PhaseStep>)> {
    let mut sequences = vec![("firstNight", first_night_steps(players))];
    for cycle in 1..=max_cycles.max(1) {
        sequences.push(("day", day_steps(cycle, statuses)));
        sequences.push(("night", night_steps(players, cycle)));
    }
    sequences
}

fn current_phase_steps(
    players: &[Player],
    max_cycles: usize,
    statuses: &HashMap<String, StepStatus>,
) -> Option<(&'static str, Vec<PhaseStep>, Option<PhaseStep>)> {
    for (phase, steps) in phase_sequences_with_statuses(players, max_cycles, statuses) {
        let phase_complete = steps
            .iter()
            .all(|step| step_status(&step.id, statuses).is_done());
        if phase_complete {
            continue;
        }

        let current_step = steps
            .iter()
            .find(|step| !step_status(&step.id, statuses).is_done())
            .cloned();
        return Some((phase, steps, current_step));
    }

    None
}

fn first_night_steps(players: &[Player]) -> Vec<PhaseStep> {
    let mut steps = Vec::new();
    if players.iter().any(|player| {
        matches!(
            character_kind(&player.actual_character),
            Some(CharacterKind::Minion)
        )
    }) {
        steps.push(simple_step(
            "firstNight",
            "firstNight",
            "minionInfo",
            "evilInfo",
            required_none(),
            false,
        ));
    }
    if players.iter().any(|player| {
        matches!(
            character_kind(&player.actual_character),
            Some(CharacterKind::Demon)
        )
    }) {
        steps.push(simple_step(
            "firstNight",
            "firstNight",
            "demonInfo",
            "evilInfo",
            required_characters(0, 3),
            false,
        ));
    }

    steps.extend(character_steps(
        "firstNight",
        "firstNight",
        players,
        &[
            "poisoner",
            "washerwoman",
            "librarian",
            "investigator",
            "chef",
            "empath",
            "fortuneTeller",
            "butler",
            "spy",
        ],
    ));
    steps.push(phase_transition_step(
        "firstNight",
        "firstNight",
        "toDay",
        "day",
    ));
    steps
}

fn day_steps(cycle: usize, statuses: &HashMap<String, StepStatus>) -> Vec<PhaseStep> {
    let prefix = phase_prefix("day", cycle);
    let mut steps = vec![simple_step(
        "day",
        &prefix,
        "announceDeaths",
        "announcement",
        required_none(),
        false,
    )];

    let mut nomination_number = 1;
    loop {
        let nomination_id = format!("{prefix}:nomination:{nomination_number}");
        match step_status(&nomination_id, statuses) {
            StepStatus::Complete => {
                steps.push(nomination_step(&prefix, nomination_number));
                nomination_number += 1;
            }
            StepStatus::Skipped => {
                steps.push(nomination_step(&prefix, nomination_number));
                break;
            }
            StepStatus::Open | StepStatus::NeedsFollowUp => {
                steps.push(nomination_step(&prefix, nomination_number));
                break;
            }
        }
    }

    steps.push(simple_step(
        "day",
        &prefix,
        "execution",
        "execution",
        RequiredInput {
            kind: "executionDecision",
            target: Some("execution"),
            min_selections: None,
            max_selections: None,
            setup_info: None,
            character_kind: None,
            zero_allowed: false,
            optional: false,
        },
        false,
    ));
    steps.push(phase_transition_step("day", &prefix, "toNight", "night"));
    steps
}

fn nomination_step(prefix: &str, nomination_number: usize) -> PhaseStep {
    PhaseStep {
        id: format!("{prefix}:nomination:{nomination_number}"),
        phase: "day",
        step_type: "nomination",
        character: None,
        player_id: None,
        required_input: RequiredInput {
            kind: "nominationVote",
            target: Some("players"),
            min_selections: Some(0),
            max_selections: None,
            setup_info: None,
            character_kind: None,
            zero_allowed: false,
            optional: true,
        },
        can_skip: true,
    }
}

fn night_steps(players: &[Player], cycle: usize) -> Vec<PhaseStep> {
    let prefix = phase_prefix("night", cycle);
    character_steps(
        "night",
        &prefix,
        players,
        &[
            "poisoner",
            "monk",
            "imp",
            "ravenkeeper",
            "undertaker",
            "fortuneTeller",
            "butler",
            "spy",
        ],
    )
    .into_iter()
    .chain([phase_transition_step("night", &prefix, "toDay", "day")])
    .collect()
}

fn character_steps(
    phase: &'static str,
    id_prefix: &str,
    players: &[Player],
    order: &[&str],
) -> Vec<PhaseStep> {
    let waking_characters = players
        .iter()
        .filter_map(|player| {
            awakening_character(player).map(|character| (character, player.id.as_str()))
        })
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
                step_type: "character",
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

fn character_required_input(character: &str) -> RequiredInput {
    match character {
        "poisoner" | "monk" | "imp" | "ravenkeeper" | "butler" => required_players(1, 1),
        "washerwoman" => required_setup_info("washerwoman", "Townsfolk", 2, 2, false),
        "librarian" => required_setup_info("librarian", "Outsider", 0, 2, true),
        "investigator" => required_setup_info("investigator", "Minion", 2, 2, false),
        "fortuneTeller" => required_players(2, 2),
        "chef" => RequiredInput {
            kind: "number",
            target: Some("number"),
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

fn simple_step(
    phase: &'static str,
    id_prefix: &str,
    name: &'static str,
    step_type: &'static str,
    required_input: RequiredInput,
    can_skip: bool,
) -> PhaseStep {
    PhaseStep {
        id: format!("{id_prefix}:{name}"),
        phase,
        step_type,
        character: None,
        player_id: None,
        required_input,
        can_skip,
    }
}

fn phase_transition_step(
    phase: &'static str,
    id_prefix: &str,
    name: &'static str,
    next_phase: &'static str,
) -> PhaseStep {
    PhaseStep {
        id: format!("{id_prefix}:{name}"),
        phase,
        step_type: "phaseTransition",
        character: None,
        player_id: None,
        required_input: RequiredInput {
            kind: next_phase,
            target: Some("phase"),
            min_selections: None,
            max_selections: None,
            setup_info: None,
            character_kind: None,
            zero_allowed: false,
            optional: false,
        },
        can_skip: false,
    }
}

fn phase_prefix(phase: &str, cycle: usize) -> String {
    if cycle <= 1 {
        phase.to_string()
    } else {
        format!("{phase}{cycle}")
    }
}

fn required_none() -> RequiredInput {
    RequiredInput {
        kind: "none",
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
        kind: if max == 1 { "playerIds" } else { "playerIds" },
        target: Some(if max == 1 { "player" } else { "players" }),
        min_selections: Some(min),
        max_selections: Some(max),
        setup_info: None,
        character_kind: None,
        zero_allowed: false,
        optional: min == 0,
    }
}

fn required_characters(min: u8, max: u8) -> RequiredInput {
    RequiredInput {
        kind: "characterIds",
        target: Some("characters"),
        min_selections: Some(min),
        max_selections: Some(max),
        setup_info: None,
        character_kind: None,
        zero_allowed: false,
        optional: min == 0,
    }
}

fn required_setup_info(
    kind: &'static str,
    character_kind: &'static str,
    min: u8,
    max: u8,
    zero_allowed: bool,
) -> RequiredInput {
    RequiredInput {
        kind: "setupInfo",
        target: Some("players"),
        min_selections: Some(min),
        max_selections: Some(max),
        setup_info: Some(kind),
        character_kind: Some(character_kind),
        zero_allowed,
        optional: false,
    }
}

fn validate_setup_info_input(
    setup_info: &str,
    value: &Value,
    players: &[Player],
) -> Result<(), CoreError> {
    if setup_info == "librarian"
        && value.get("zeroOutsiders").and_then(Value::as_bool) == Some(true)
    {
        let player_count = value
            .get("playerIds")
            .and_then(Value::as_array)
            .map_or(0, Vec::len);
        if player_count == 0 {
            return Ok(());
        }
        return Err(error(
            "INVALID_STEP_INPUT",
            "현재 단계 입력이 올바르지 않습니다.",
        ));
    }

    let player_ids = validate_player_ids(value, players)?;
    if player_ids.len() != 2 {
        return Err(error(
            "MISSING_STEP_INPUT",
            "현재 단계에 필요한 입력이 없습니다.",
        ));
    }

    let Some(character_id) = value.get("characterId").and_then(Value::as_str) else {
        return Err(error(
            "MISSING_STEP_INPUT",
            "현재 단계에 필요한 입력이 없습니다.",
        ));
    };
    let Some(kind) = character_kind(character_id) else {
        return Err(error("UNKNOWN_CHARACTER", "지원하지 않는 캐릭터입니다."));
    };

    let valid_kind = match setup_info {
        "washerwoman" => matches!(kind, CharacterKind::Townsfolk),
        "librarian" => matches!(kind, CharacterKind::Outsider),
        "investigator" => matches!(kind, CharacterKind::Minion),
        _ => false,
    };
    if !valid_kind {
        return Err(error(
            "INVALID_STEP_INPUT",
            "현재 단계 입력이 올바르지 않습니다.",
        ));
    }

    Ok(())
}

fn validate_number_input(value: &Value) -> Result<(), CoreError> {
    if value.is_null() {
        return Ok(());
    }

    let Some(number) = value.get("value").or_else(|| value.get("displayedValue")) else {
        return Err(error("MALFORMED_COMMAND", "명령 형식이 올바르지 않습니다."));
    };
    if number.as_u64().filter(|number| *number <= 15).is_some() {
        if let Some(reason) = value.get("reason").and_then(Value::as_str) {
            if !matches!(reason, "drunk" | "poisoned" | "registration") {
                return Err(error(
                    "INVALID_STEP_INPUT",
                    "현재 단계 입력이 올바르지 않습니다.",
                ));
            }
        }
        return Ok(());
    }

    Err(error(
        "INVALID_STEP_INPUT",
        "현재 단계 입력이 올바르지 않습니다.",
    ))
}

fn validate_character_selection(input: &RequiredInput, value: &Value) -> Result<(), CoreError> {
    let character_ids = value
        .get("characterIds")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    if character_ids
        .iter()
        .any(|character_id| !character_id.is_string())
    {
        return Err(error("MALFORMED_COMMAND", "명령 형식이 올바르지 않습니다."));
    }
    let mut unique_character_ids = HashSet::new();
    for character_id in character_ids.iter().filter_map(Value::as_str) {
        if !unique_character_ids.insert(character_id) || character_kind(character_id).is_none() {
            return Err(error(
                "INVALID_STEP_INPUT",
                "현재 단계 입력이 올바르지 않습니다.",
            ));
        }
    }

    let count = character_ids.len();
    if let Some(min) = input.min_selections {
        if count < usize::from(min) {
            return Err(error(
                "MISSING_STEP_INPUT",
                "현재 단계에 필요한 입력이 없습니다.",
            ));
        }
    }
    if let Some(max) = input.max_selections {
        if count > usize::from(max) {
            return Err(error(
                "TOO_MUCH_STEP_INPUT",
                "현재 단계 입력이 너무 많습니다.",
            ));
        }
    }

    Ok(())
}

fn validate_player_ids(value: &Value, players: &[Player]) -> Result<Vec<String>, CoreError> {
    let player_ids = value
        .get("playerIds")
        .and_then(Value::as_array)
        .ok_or_else(|| error("MALFORMED_COMMAND", "명령 형식이 올바르지 않습니다."))?;
    if player_ids.iter().any(|player_id| !player_id.is_string()) {
        return Err(error("MALFORMED_COMMAND", "명령 형식이 올바르지 않습니다."));
    }
    let mut unique_player_ids = HashSet::new();
    let roster_player_ids = players
        .iter()
        .map(|player| player.id.as_str())
        .collect::<HashSet<_>>();
    let mut valid_ids = Vec::new();
    for player_id in player_ids.iter().filter_map(Value::as_str) {
        if !unique_player_ids.insert(player_id) || !roster_player_ids.contains(player_id) {
            return Err(error(
                "INVALID_STEP_INPUT",
                "현재 단계 입력이 올바르지 않습니다.",
            ));
        }
        valid_ids.push(player_id.to_string());
    }

    Ok(valid_ids)
}

fn validate_nomination_vote_input(value: &Value, players: &[Player]) -> Result<(), CoreError> {
    let input: NominationVoteInput = serde_json::from_value(value.clone())
        .map_err(|_| error("MALFORMED_COMMAND", "명령 형식이 올바르지 않습니다."))?;
    let allowed_spent_ghost_ids = value
        .get("ghostVoteSpentPlayerIds")
        .and_then(Value::as_array)
        .map(|ids| ids.iter().filter_map(Value::as_str).collect::<HashSet<_>>())
        .unwrap_or_default();
    nomination_participants(&input, players, &allowed_spent_ghost_ids)?;
    Ok(())
}

fn validate_execution_decision_input(value: &Value) -> Result<(), CoreError> {
    serde_json::from_value::<ExecutionDecisionInput>(value.clone())
        .map(|_| ())
        .map_err(|_| error("MALFORMED_COMMAND", "명령 형식이 올바르지 않습니다."))
}

fn nomination_record(
    step: &PhaseStep,
    players: &[Player],
    input: &Value,
    events: &[ConfirmedEvent],
) -> Result<NominationRecord, CoreError> {
    let input: NominationVoteInput = serde_json::from_value(input.clone())
        .map_err(|_| error("MALFORMED_COMMAND", "명령 형식이 올바르지 않습니다."))?;
    let voter_ids = nomination_participants(&input, players, &HashSet::new())?;
    let ghost_vote_spent_player_ids = voter_ids
        .iter()
        .filter_map(|player_id| {
            players
                .iter()
                .find(|player| &player.id == player_id && !player.alive && !player.ghost_vote_used)
                .map(|player| player.id.clone())
        })
        .collect::<Vec<_>>();
    let vote_count = voter_ids.len();
    let prefix = step_prefix(&step.id)?;
    let current_candidate = replay_day_state(events, &prefix)?.execution_candidate;
    let majority = execution_vote_threshold(players);
    let updates_execution_candidate = vote_count >= majority
        && current_candidate
            .as_ref()
            .is_none_or(|candidate| vote_count > candidate.vote_count);

    Ok(NominationRecord {
        step_id: step.id.clone(),
        nominator_id: input.nominator_id,
        nominee_id: input.nominee_id,
        voter_ids,
        vote_count,
        ghost_vote_spent_player_ids,
        updates_execution_candidate,
    })
}

fn nomination_participants(
    input: &NominationVoteInput,
    players: &[Player],
    allowed_spent_ghost_ids: &HashSet<&str>,
) -> Result<Vec<String>, CoreError> {
    let roster = players
        .iter()
        .map(|player| (player.id.as_str(), player))
        .collect::<HashMap<_, _>>();
    if !roster.contains_key(input.nominator_id.as_str())
        || !roster.contains_key(input.nominee_id.as_str())
    {
        return Err(error(
            "INVALID_STEP_INPUT",
            "현재 단계 입력이 올바르지 않습니다.",
        ));
    }

    let mut unique_voter_ids = HashSet::new();
    let mut voter_ids = Vec::new();
    for voter_id in &input.voter_ids {
        let Some(voter) = roster.get(voter_id.as_str()) else {
            return Err(error(
                "INVALID_STEP_INPUT",
                "현재 단계 입력이 올바르지 않습니다.",
            ));
        };
        if !unique_voter_ids.insert(voter_id.as_str()) {
            return Err(error(
                "INVALID_STEP_INPUT",
                "현재 단계 입력이 올바르지 않습니다.",
            ));
        }
        if !voter.alive
            && voter.ghost_vote_used
            && !allowed_spent_ghost_ids.contains(voter_id.as_str())
        {
            return Err(error(
                "GHOST_VOTE_ALREADY_SPENT",
                "이미 유령표를 사용한 플레이어가 포함되어 있습니다.",
            ));
        }
        voter_ids.push(voter_id.clone());
    }

    Ok(voter_ids)
}

fn execution_vote_threshold(players: &[Player]) -> usize {
    let alive_count = players.iter().filter(|player| player.alive).count();
    (alive_count / 2) + 1
}

fn replay_day_state(events: &[ConfirmedEvent], prefix: &str) -> Result<DayState, CoreError> {
    let mut nominations = Vec::new();
    let mut execution_candidate = None;
    let mut confirmed_execution = None;

    for event in events {
        let step_id = event.payload.get("stepId").and_then(Value::as_str);
        if !step_id.is_some_and(|step_id| step_id.starts_with(prefix)) {
            continue;
        }

        match event.event_type.as_str() {
            "nominationVoteConfirmed" => {
                let record: NominationRecord = serde_json::from_value(
                    event.payload.get("input").cloned().unwrap_or(Value::Null),
                )
                .map_err(|_| error("REPLAY_FAILED", "확정 이벤트를 재생할 수 없습니다."))?;
                if record.updates_execution_candidate {
                    execution_candidate = Some(ExecutionCandidate {
                        nominee_id: record.nominee_id.clone(),
                        vote_count: record.vote_count,
                    });
                }
                nominations.push(record);
            }
            "executionConfirmed" => {
                let player_id = event
                    .payload
                    .get("input")
                    .and_then(|input| input.get("playerId"))
                    .and_then(Value::as_str)
                    .map(str::to_string)
                    .ok_or_else(|| error("REPLAY_FAILED", "확정 이벤트를 재생할 수 없습니다."))?;
                confirmed_execution = Some(ConfirmedExecution {
                    player_id: Some(player_id),
                });
            }
            "noExecutionConfirmed" => {
                confirmed_execution = Some(ConfirmedExecution { player_id: None });
            }
            _ => {}
        }
    }

    Ok(DayState {
        nominations,
        execution_candidate,
        confirmed_execution,
    })
}

fn current_day_prefix(phase_state: &PhaseReplayState) -> Option<String> {
    phase_state
        .current_step
        .as_ref()
        .and_then(|step| step_prefix(&step.id).ok())
        .or_else(|| {
            phase_state
                .phase_overview
                .first()
                .and_then(|step| step_prefix(&step.id).ok())
        })
}

fn step_prefix(step_id: &str) -> Result<String, CoreError> {
    let Some((prefix, _)) = step_id.split_once(':') else {
        return Err(error("REPLAY_FAILED", "확정 이벤트를 재생할 수 없습니다."));
    };
    Ok(prefix.to_string())
}

fn awakening_character(player: &Player) -> Option<&str> {
    if player.actual_character == "drunk" {
        Some(player.shown_character.as_str())
    } else {
        Some(player.actual_character.as_str())
    }
}

fn replay_players(events: &[ConfirmedEvent]) -> Result<Vec<Player>, CoreError> {
    if events.is_empty() {
        return Ok(Vec::new());
    };
    if events[0].event_type != "setupConfirmed"
        || events
            .iter()
            .skip(1)
            .any(|event| event.event_type == "setupConfirmed")
    {
        return Err(error("REPLAY_FAILED", "확정 이벤트를 재생할 수 없습니다."));
    }

    let payload: CreateGamePayload = serde_json::from_value(events[0].payload.clone())
        .map_err(|_| error("REPLAY_FAILED", "확정 이벤트를 재생할 수 없습니다."))?;

    validate_setup_inputs(&payload.players)?;
    let mut players = payload
        .players
        .iter()
        .map(player_from_setup_input)
        .collect::<Result<Vec<_>, _>>()?;

    for event in events.iter().skip(1) {
        match event.event_type.as_str() {
            "deathConfirmed" => {
                let player_id = event
                    .payload
                    .get("playerId")
                    .and_then(Value::as_str)
                    .ok_or_else(|| error("REPLAY_FAILED", "확정 이벤트를 재생할 수 없습니다."))?;
                let Some(player) = players.iter_mut().find(|player| player.id == player_id) else {
                    return Err(error("REPLAY_FAILED", "확정 이벤트를 재생할 수 없습니다."));
                };
                player.alive = false;
            }
            "nominationVoteConfirmed" => {
                let record: NominationRecord = serde_json::from_value(
                    event.payload.get("input").cloned().unwrap_or(Value::Null),
                )
                .map_err(|_| error("REPLAY_FAILED", "확정 이벤트를 재생할 수 없습니다."))?;
                for player_id in record.ghost_vote_spent_player_ids {
                    let Some(player) = players.iter_mut().find(|player| player.id == player_id)
                    else {
                        return Err(error("REPLAY_FAILED", "확정 이벤트를 재생할 수 없습니다."));
                    };
                    if player.alive || player.ghost_vote_used {
                        return Err(error("REPLAY_FAILED", "확정 이벤트를 재생할 수 없습니다."));
                    }
                    player.ghost_vote_used = true;
                }
            }
            _ => {}
        }
    }

    Ok(players)
}

fn validate_setup_inputs(players: &[SetupPlayerInput]) -> Result<(), CoreError> {
    if players.len() < 5 || players.len() > 15 {
        return Err(error(
            "INVALID_PLAYER_COUNT",
            "플레이어는 5명 이상 15명 이하이어야 합니다.",
        ));
    }

    let mut seats = Vec::with_capacity(players.len());
    for player in players {
        if player.name.trim().is_empty() {
            return Err(error("INVALID_PLAYER", "플레이어 이름을 입력해야 합니다."));
        }
        if character_kind(&player.actual_character).is_none() {
            return Err(error("UNKNOWN_CHARACTER", "지원하지 않는 캐릭터입니다."));
        }
        if let Some(shown_character) = &player.shown_character {
            if character_kind(shown_character).is_none() {
                return Err(error("UNKNOWN_CHARACTER", "지원하지 않는 캐릭터입니다."));
            }
        }
        if player.actual_character == "drunk" {
            let Some(shown_character) = &player.shown_character else {
                return Err(error(
                    "INVALID_DRUNK_SHOWN_CHARACTER",
                    "Drunk의 Shown Character는 마을주민이어야 합니다.",
                ));
            };
            if !is_townsfolk(shown_character) {
                return Err(error(
                    "INVALID_DRUNK_SHOWN_CHARACTER",
                    "Drunk의 Shown Character는 마을주민이어야 합니다.",
                ));
            }
        }
        seats.push(player.seat);
    }

    seats.sort_unstable();
    for (index, seat) in seats.iter().enumerate() {
        if usize::from(*seat) != index + 1 {
            return Err(error(
                "INVALID_SEATING",
                "좌석 번호는 1번부터 순서대로 배정해야 합니다.",
            ));
        }
    }

    Ok(())
}

fn normalized_setup_player(player: &SetupPlayerInput) -> Result<SetupPlayerInput, CoreError> {
    let shown_character = if player.actual_character == "drunk" {
        let shown_character = player.shown_character.clone().ok_or_else(|| {
            error(
                "INVALID_DRUNK_SHOWN_CHARACTER",
                "Drunk의 Shown Character는 마을주민이어야 합니다.",
            )
        })?;
        if !is_townsfolk(&shown_character) {
            return Err(error(
                "INVALID_DRUNK_SHOWN_CHARACTER",
                "Drunk의 Shown Character는 마을주민이어야 합니다.",
            ));
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

fn player_from_setup_input(player: &SetupPlayerInput) -> Result<Player, CoreError> {
    let normalized = normalized_setup_player(player)?;
    let alignment = character_kind(&normalized.actual_character)
        .map(|kind| kind.alignment())
        .ok_or_else(|| error("UNKNOWN_CHARACTER", "지원하지 않는 캐릭터입니다."))?;

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
        notes: String::new(),
    })
}

fn validate_setup_warnings(players: &[Player]) -> Vec<CoreWarning> {
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
        warnings.push(CoreWarning {
            code: "SETUP_DISTRIBUTION_MISMATCH".to_string(),
            severity: "warning",
            message_ko: format!(
                "Trouble Brewing 권장 구성은 마을주민 {}, 외부인 {}, 하수인 {}, 악마 {}명입니다.",
                expected.townsfolk, expected.outsider, expected.minion, expected.demon
            ),
        });
    }

    let mut actual_characters = players
        .iter()
        .map(|player| player.actual_character.as_str())
        .collect::<Vec<_>>();
    actual_characters.sort_unstable();
    if actual_characters.windows(2).any(|pair| pair[0] == pair[1]) {
        warnings.push(CoreWarning {
            code: "DUPLICATE_ACTUAL_CHARACTER".to_string(),
            severity: "warning",
            message_ko: "중복된 Actual Character가 있습니다.".to_string(),
        });
    }

    warnings
}

impl SetupDistribution {
    fn empty() -> Self {
        Self {
            townsfolk: 0,
            outsider: 0,
            minion: 0,
            demon: 0,
        }
    }
}

fn expected_distribution(player_count: usize, has_baron: bool) -> SetupDistribution {
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

#[derive(Debug, Copy, Clone)]
enum CharacterKind {
    Townsfolk,
    Outsider,
    Minion,
    Demon,
}

impl CharacterKind {
    fn alignment(self) -> Alignment {
        match self {
            CharacterKind::Townsfolk | CharacterKind::Outsider => Alignment::Good,
            CharacterKind::Minion | CharacterKind::Demon => Alignment::Evil,
        }
    }
}

fn character_kind(character: &str) -> Option<CharacterKind> {
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

fn is_townsfolk(character: &str) -> bool {
    matches!(character_kind(character), Some(CharacterKind::Townsfolk))
}

fn character_label(character: &str) -> &'static str {
    match character {
        "washerwoman" => "세탁부",
        "librarian" => "사서",
        "investigator" => "조사관",
        "chef" => "요리사",
        "empath" => "공감능력자",
        "fortuneTeller" => "점쟁이",
        "undertaker" => "장의사",
        "monk" => "수도사",
        "ravenkeeper" => "까마귀지기",
        "virgin" => "처녀",
        "slayer" => "학살자",
        "soldier" => "군인",
        "mayor" => "시장",
        "butler" => "집사",
        "drunk" => "술꾼",
        "recluse" => "은둔자",
        "saint" => "성자",
        "poisoner" => "독살자",
        "spy" => "스파이",
        "scarletWoman" => "붉은 여인",
        "baron" => "남작",
        "imp" => "임프",
        _ => "알 수 없음",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    const EMPTY_GAME: &str = r#"{
      "schemaVersion": 1,
      "game": {
        "id": "game-1",
        "name": "Smoke",
        "createdAt": "2026-01-01T00:00:00.000Z",
        "updatedAt": "2026-01-01T00:00:00.000Z",
        "events": []
      }
    }"#;

    #[test]
    fn replay_empty_game_file_returns_core_result() {
        let actual: Value = serde_json::from_str(&replay_json(EMPTY_GAME)).unwrap();

        assert_eq!(
            actual,
            json!({
                "ok": true,
                "value": {
                    "schemaVersion": 1,
                    "eventCount": 0,
                    "phase": "setup",
                    "players": [],
                    "currentStep": null,
                    "phaseOverview": [],
                    "warnings": []
                }
            })
        );
    }

    #[test]
    fn propose_smoke_command_returns_core_result() {
        let actual: Value =
            serde_json::from_str(&propose_json(EMPTY_GAME, r#"{ "type": "smoke" }"#)).unwrap();

        assert_eq!(actual["ok"], true);
        assert_eq!(actual["value"]["event"]["type"], "smokeConfirmed");
        assert_eq!(actual["value"]["preview"]["messageKo"], "코어 계약 정상");
    }

    #[test]
    fn propose_create_game_returns_setup_confirmed_event_with_warnings() {
        let command = json!({
            "type": "createGame",
            "payload": {
                "players": [
                    { "seat": 1, "name": "Ada", "actualCharacter": "washerwoman" },
                    { "seat": 2, "name": "Bert", "actualCharacter": "librarian" },
                    { "seat": 3, "name": "Cora", "actualCharacter": "investigator" },
                    { "seat": 4, "name": "Dev", "actualCharacter": "poisoner" },
                    { "seat": 5, "name": "Eve", "actualCharacter": "imp" }
                ]
            }
        });

        let actual: Value =
            serde_json::from_str(&propose_json(EMPTY_GAME, &command.to_string())).unwrap();

        assert_eq!(actual["ok"], true);
        assert_eq!(actual["value"]["event"]["type"], "setupConfirmed");
        assert_eq!(
            actual["value"]["event"]["payload"]["players"][0]["name"],
            "Ada"
        );
        assert_eq!(actual["value"]["warnings"], json!([]));
    }

    #[test]
    fn propose_create_game_returns_nonblocking_distribution_warnings() {
        let command = json!({
            "type": "createGame",
            "payload": {
                "players": [
                    { "seat": 1, "name": "Ada", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
                    { "seat": 2, "name": "Bert", "actualCharacter": "librarian", "shownCharacter": "librarian" },
                    { "seat": 3, "name": "Cora", "actualCharacter": "investigator", "shownCharacter": "investigator" },
                    { "seat": 4, "name": "Dev", "actualCharacter": "chef", "shownCharacter": "chef" },
                    { "seat": 5, "name": "Eve", "actualCharacter": "imp", "shownCharacter": "imp" }
                ]
            }
        });

        let actual: Value =
            serde_json::from_str(&propose_json(EMPTY_GAME, &command.to_string())).unwrap();

        assert_eq!(actual["ok"], true);
        assert_eq!(
            actual["value"]["warnings"][0]["code"],
            "SETUP_DISTRIBUTION_MISMATCH"
        );
    }

    #[test]
    fn expected_distribution_covers_baron_and_non_baron_representative_player_counts() {
        for (player_count, normal, baron) in [
            (
                5,
                SetupDistribution {
                    townsfolk: 3,
                    outsider: 0,
                    minion: 1,
                    demon: 1,
                },
                SetupDistribution {
                    townsfolk: 1,
                    outsider: 2,
                    minion: 1,
                    demon: 1,
                },
            ),
            (
                7,
                SetupDistribution {
                    townsfolk: 5,
                    outsider: 0,
                    minion: 1,
                    demon: 1,
                },
                SetupDistribution {
                    townsfolk: 3,
                    outsider: 2,
                    minion: 1,
                    demon: 1,
                },
            ),
            (
                10,
                SetupDistribution {
                    townsfolk: 7,
                    outsider: 0,
                    minion: 2,
                    demon: 1,
                },
                SetupDistribution {
                    townsfolk: 5,
                    outsider: 2,
                    minion: 2,
                    demon: 1,
                },
            ),
            (
                15,
                SetupDistribution {
                    townsfolk: 9,
                    outsider: 2,
                    minion: 3,
                    demon: 1,
                },
                SetupDistribution {
                    townsfolk: 7,
                    outsider: 4,
                    minion: 3,
                    demon: 1,
                },
            ),
        ] {
            assert_eq!(expected_distribution(player_count, false), normal);
            assert_eq!(expected_distribution(player_count, true), baron);
        }
    }

    #[test]
    fn setup_distribution_json_returns_baron_adjusted_counts() {
        let actual: Value = serde_json::from_str(&setup_distribution_json(
            r#"{ "playerCount": 7, "actualCharacters": ["baron"] }"#,
        ))
        .unwrap();

        assert_eq!(
            actual,
            json!({
                "ok": true,
                "value": {
                    "Townsfolk": 3,
                    "Outsider": 2,
                    "Minion": 1,
                    "Demon": 1
                }
            })
        );
    }

    #[test]
    fn propose_create_game_uses_baron_adjusted_distribution_warnings() {
        let command = json!({
            "type": "createGame",
            "payload": {
                "players": [
                    { "seat": 1, "name": "Ada", "actualCharacter": "washerwoman" },
                    { "seat": 2, "name": "Bert", "actualCharacter": "librarian" },
                    { "seat": 3, "name": "Cora", "actualCharacter": "chef" },
                    { "seat": 4, "name": "Dev", "actualCharacter": "butler" },
                    { "seat": 5, "name": "Eve", "actualCharacter": "drunk", "shownCharacter": "empath" },
                    { "seat": 6, "name": "Fay", "actualCharacter": "baron" },
                    { "seat": 7, "name": "Gus", "actualCharacter": "imp" }
                ]
            }
        });

        let actual: Value =
            serde_json::from_str(&propose_json(EMPTY_GAME, &command.to_string())).unwrap();

        assert_eq!(actual["ok"], true);
        assert_eq!(actual["value"]["warnings"], json!([]));
    }

    #[test]
    fn replay_uses_baron_adjusted_distribution_warnings() {
        let game = json!({
            "schemaVersion": 1,
            "game": {
                "id": "game-1",
                "name": "Setup",
                "createdAt": "2026-01-01T00:00:00.000Z",
                "updatedAt": "2026-01-01T00:00:00.000Z",
                "events": [{
                    "id": "evt-1",
                    "type": "setupConfirmed",
                    "phase": "setup",
                    "payload": {
                        "players": [
                            { "id": "player-1", "seat": 1, "name": "Ada", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
                            { "id": "player-2", "seat": 2, "name": "Bert", "actualCharacter": "librarian", "shownCharacter": "librarian" },
                            { "id": "player-3", "seat": 3, "name": "Cora", "actualCharacter": "chef", "shownCharacter": "chef" },
                            { "id": "player-4", "seat": 4, "name": "Dev", "actualCharacter": "butler", "shownCharacter": "butler" },
                            { "id": "player-5", "seat": 5, "name": "Eve", "actualCharacter": "drunk", "shownCharacter": "empath" },
                            { "id": "player-6", "seat": 6, "name": "Fay", "actualCharacter": "baron", "shownCharacter": "baron" },
                            { "id": "player-7", "seat": 7, "name": "Gus", "actualCharacter": "imp", "shownCharacter": "imp" }
                        ]
                    },
                    "summary": "초기 설정 확정: 7명",
                    "createdAt": "2026-01-01T00:00:00.000Z"
                }]
            }
        });

        let actual: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();

        assert_eq!(actual["ok"], true);
        assert_eq!(actual["value"]["warnings"], json!([]));
    }

    #[test]
    fn propose_create_game_derives_non_drunk_shown_character_from_actual_character() {
        let command = json!({
            "type": "createGame",
            "payload": {
                "players": [
                    { "seat": 1, "name": "Ada", "actualCharacter": "washerwoman", "shownCharacter": "chef" },
                    { "seat": 2, "name": "Bert", "actualCharacter": "librarian", "shownCharacter": "empath" },
                    { "seat": 3, "name": "Cora", "actualCharacter": "investigator", "shownCharacter": "mayor" },
                    { "seat": 4, "name": "Dev", "actualCharacter": "poisoner", "shownCharacter": "spy" },
                    { "seat": 5, "name": "Eve", "actualCharacter": "imp", "shownCharacter": "baron" }
                ]
            }
        });

        let actual: Value =
            serde_json::from_str(&propose_json(EMPTY_GAME, &command.to_string())).unwrap();

        assert_eq!(actual["ok"], true);
        assert_eq!(
            actual["value"]["event"]["payload"]["players"][0]["shownCharacter"],
            "washerwoman"
        );
        assert_eq!(
            actual["value"]["event"]["payload"]["players"][3]["shownCharacter"],
            "poisoner"
        );
    }

    #[test]
    fn propose_create_game_preserves_townsfolk_shown_character_for_drunk() {
        let command = json!({
            "type": "createGame",
            "payload": {
                "players": [
                    { "seat": 1, "name": "Ada", "actualCharacter": "drunk", "shownCharacter": "chef" },
                    { "seat": 2, "name": "Bert", "actualCharacter": "librarian", "shownCharacter": "librarian" },
                    { "seat": 3, "name": "Cora", "actualCharacter": "investigator", "shownCharacter": "investigator" },
                    { "seat": 4, "name": "Dev", "actualCharacter": "poisoner", "shownCharacter": "poisoner" },
                    { "seat": 5, "name": "Eve", "actualCharacter": "imp", "shownCharacter": "imp" }
                ]
            }
        });

        let actual: Value =
            serde_json::from_str(&propose_json(EMPTY_GAME, &command.to_string())).unwrap();

        assert_eq!(actual["ok"], true);
        assert_eq!(
            actual["value"]["event"]["payload"]["players"][0]["shownCharacter"],
            "chef"
        );
    }

    #[test]
    fn propose_create_game_rejects_non_townsfolk_shown_character_for_drunk() {
        let command = json!({
            "type": "createGame",
            "payload": {
                "players": [
                    { "seat": 1, "name": "Ada", "actualCharacter": "drunk", "shownCharacter": "imp" },
                    { "seat": 2, "name": "Bert", "actualCharacter": "librarian", "shownCharacter": "librarian" },
                    { "seat": 3, "name": "Cora", "actualCharacter": "investigator", "shownCharacter": "investigator" },
                    { "seat": 4, "name": "Dev", "actualCharacter": "poisoner", "shownCharacter": "poisoner" },
                    { "seat": 5, "name": "Eve", "actualCharacter": "imp", "shownCharacter": "imp" }
                ]
            }
        });

        let actual: Value =
            serde_json::from_str(&propose_json(EMPTY_GAME, &command.to_string())).unwrap();

        assert_eq!(actual["ok"], false);
        assert_eq!(actual["error"]["code"], "INVALID_DRUNK_SHOWN_CHARACTER");
    }

    #[test]
    fn replay_setup_confirmed_event_derives_player_state() {
        let game = json!({
            "schemaVersion": 1,
            "game": {
                "id": "game-1",
                "name": "Setup",
                "createdAt": "2026-01-01T00:00:00.000Z",
                "updatedAt": "2026-01-01T00:00:00.000Z",
                "events": [{
                    "id": "evt-1",
                    "type": "setupConfirmed",
                    "phase": "setup",
                    "payload": {
                        "players": [
                            { "id": "player-1", "seat": 1, "name": "Ada", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
                            { "id": "player-2", "seat": 2, "name": "Bert", "actualCharacter": "librarian", "shownCharacter": "librarian" },
                            { "id": "player-3", "seat": 3, "name": "Cora", "actualCharacter": "investigator", "shownCharacter": "investigator" },
                            { "id": "player-4", "seat": 4, "name": "Dev", "actualCharacter": "poisoner", "shownCharacter": "poisoner" },
                            { "id": "player-5", "seat": 5, "name": "Eve", "actualCharacter": "imp", "shownCharacter": "imp" }
                        ]
                    },
                    "summary": "초기 설정 확정: 5명",
                    "createdAt": "2026-01-01T00:00:00.000Z"
                }]
            }
        });

        let actual: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();

        assert_eq!(actual["ok"], true);
        assert_eq!(actual["value"]["players"][0]["id"], "player-1");
        assert_eq!(actual["value"]["players"][0]["alignment"], "good");
        assert_eq!(actual["value"]["players"][0]["alive"], true);
        assert_eq!(actual["value"]["players"][0]["ghostVoteUsed"], false);
        assert_eq!(actual["value"]["players"][0]["deathAnnounced"], false);
        assert_eq!(actual["value"]["players"][3]["alignment"], "evil");
    }

    #[test]
    fn replay_derives_current_step_and_phase_overview_after_setup() {
        let game = game_with_events(json!([setup_event()]));

        let actual: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();

        assert_eq!(actual["ok"], true);
        assert_eq!(actual["value"]["phase"], "firstNight");
        assert_eq!(actual["value"]["currentStep"]["id"], "firstNight:demonInfo");
        assert_eq!(
            actual["value"]["currentStep"]["requiredInput"]["kind"],
            "characterIds"
        );
        assert_eq!(
            actual["value"]["currentStep"]["requiredInput"]["target"],
            "characters"
        );
        assert_eq!(
            actual["value"]["currentStep"]["requiredInput"]["maxSelections"],
            3
        );
        assert_eq!(actual["value"]["currentStep"]["canSkip"], false);
        assert_eq!(
            actual["value"]["phaseOverview"][0]["id"],
            "firstNight:demonInfo"
        );
        assert_eq!(actual["value"]["phaseOverview"][0]["status"], "current");
        assert_eq!(actual["value"]["phaseOverview"][1]["status"], "waiting");
    }

    #[test]
    fn replay_returns_required_input_shape_for_player_selection_steps() {
        let game = game_with_events(json!([
            setup_event(),
            phase_event("phaseStepConfirmed", "firstNight:demonInfo")
        ]));

        let actual: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();

        assert_eq!(actual["ok"], true);
        assert_eq!(
            actual["value"]["currentStep"]["id"],
            "firstNight:washerwoman"
        );
        assert_eq!(
            actual["value"]["currentStep"]["requiredInput"]["target"],
            "players"
        );
        assert_eq!(
            actual["value"]["currentStep"]["requiredInput"]["minSelections"],
            2
        );
        assert_eq!(
            actual["value"]["currentStep"]["requiredInput"]["maxSelections"],
            2
        );
    }

    #[test]
    fn replay_marks_confirmed_skipped_and_follow_up_phase_steps() {
        let game = game_with_events(json!([
            setup_event(),
            phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
            phase_event("phaseStepConfirmed", "firstNight:washerwoman"),
            phase_event("phaseStepSkipped", "firstNight:chef"),
            phase_event("phaseStepNeedsFollowUp", "firstNight:empath")
        ]));

        let actual: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();

        assert_eq!(actual["ok"], true);
        assert_eq!(actual["value"]["currentStep"]["id"], "firstNight:empath");
        assert_eq!(actual["value"]["phaseOverview"][0]["status"], "complete");
        assert_eq!(actual["value"]["phaseOverview"][1]["status"], "complete");
        assert_eq!(actual["value"]["phaseOverview"][2]["status"], "skipped");
        assert_eq!(
            actual["value"]["phaseOverview"][3]["status"],
            "needsFollowUp"
        );
        assert_eq!(actual["value"]["phaseOverview"][4]["status"], "waiting");
    }

    #[test]
    fn confirming_current_step_returns_canonical_event_and_advances_replay() {
        let game = game_with_events(json!([setup_event()]));
        let command = json!({
            "type": "confirmStep",
            "payload": { "stepId": "firstNight:demonInfo" }
        });

        let proposal: Value =
            serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();
        let mut events = game["game"]["events"].as_array().unwrap().clone();
        events.push(proposal["value"]["event"].clone());
        let replayed: Value = serde_json::from_str(&replay_json(
            &game_with_events(Value::Array(events)).to_string(),
        ))
        .unwrap();

        assert_eq!(proposal["ok"], true);
        assert_eq!(proposal["value"]["event"]["type"], "phaseStepConfirmed");
        assert_eq!(
            proposal["value"]["event"]["payload"]["stepId"],
            "firstNight:demonInfo"
        );
        assert_eq!(
            replayed["value"]["currentStep"]["id"],
            "firstNight:washerwoman"
        );
    }

    #[test]
    fn confirming_chef_step_returns_reveal_payload() {
        let game = game_with_events(json!([
            setup_event(),
            phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
            phase_event("phaseStepConfirmed", "firstNight:washerwoman")
        ]));
        let command = json!({
            "type": "confirmStep",
            "payload": { "stepId": "firstNight:chef" }
        });

        let actual: Value =
            serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

        assert_eq!(actual["ok"], true);
        assert_eq!(
            actual["value"]["revealPayload"]["messageKo"],
            "서로 이웃한 악 팀 쌍은 0쌍입니다."
        );

        let mut events = game["game"]["events"].as_array().unwrap().clone();
        events.push(actual["value"]["event"].clone());
        let replayed: Value = serde_json::from_str(&replay_json(
            &game_with_events(Value::Array(events)).to_string(),
        ))
        .unwrap();
        assert_eq!(replayed["ok"], true);
    }

    #[test]
    fn confirming_washerwoman_information_logs_and_reveals_selected_setup_info() {
        let game = game_with_events(json!([
            setup_event(),
            phase_event("phaseStepConfirmed", "firstNight:demonInfo")
        ]));
        let command = json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "firstNight:washerwoman",
                "input": {
                    "playerIds": ["player-1", "player-2"],
                    "characterId": "chef"
                }
            }
        });

        let actual: Value =
            serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

        assert_eq!(actual["ok"], true);
        assert_eq!(
            actual["value"]["event"]["payload"]["input"]["characterId"],
            "chef"
        );
        assert_eq!(
            actual["value"]["event"]["summary"],
            "세탁부 정보 확정: 1번 Ada, 2번 Bert 중 요리사"
        );
        assert_eq!(
            actual["value"]["revealPayload"]["messageKo"],
            "세탁부 정보: 1번 Ada 또는 2번 Bert 중 한 명은 요리사입니다."
        );
    }

    #[test]
    fn confirming_librarian_zero_outsiders_logs_and_reveals_zero() {
        let game = game_with_events(json!([
            setup_event_with_players(json!([
                { "id": "player-1", "seat": 1, "name": "Ada", "actualCharacter": "librarian", "shownCharacter": "librarian" },
                { "id": "player-2", "seat": 2, "name": "Bert", "actualCharacter": "chef", "shownCharacter": "chef" },
                { "id": "player-3", "seat": 3, "name": "Cora", "actualCharacter": "empath", "shownCharacter": "empath" },
                { "id": "player-4", "seat": 4, "name": "Dev", "actualCharacter": "poisoner", "shownCharacter": "poisoner" },
                { "id": "player-5", "seat": 5, "name": "Eve", "actualCharacter": "imp", "shownCharacter": "imp" }
            ])),
            phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
            phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
            phase_event("phaseStepConfirmed", "firstNight:poisoner")
        ]));
        let command = json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "firstNight:librarian",
                "input": { "zeroOutsiders": true }
            }
        });

        let actual: Value =
            serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

        assert_eq!(actual["ok"], true);
        assert_eq!(
            actual["value"]["event"]["summary"],
            "사서 정보 확정: 외부인 0명"
        );
        assert_eq!(
            actual["value"]["revealPayload"]["messageKo"],
            "사서 정보: 외부인은 0명입니다."
        );
    }

    #[test]
    fn confirming_investigator_information_requires_minion_character_and_reveals_it() {
        let game = game_with_events(json!([
            setup_event_with_players(json!([
                { "id": "player-1", "seat": 1, "name": "Ada", "actualCharacter": "investigator", "shownCharacter": "investigator" },
                { "id": "player-2", "seat": 2, "name": "Bert", "actualCharacter": "chef", "shownCharacter": "chef" },
                { "id": "player-3", "seat": 3, "name": "Cora", "actualCharacter": "empath", "shownCharacter": "empath" },
                { "id": "player-4", "seat": 4, "name": "Dev", "actualCharacter": "poisoner", "shownCharacter": "poisoner" },
                { "id": "player-5", "seat": 5, "name": "Eve", "actualCharacter": "imp", "shownCharacter": "imp" }
            ])),
            phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
            phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
            phase_event("phaseStepConfirmed", "firstNight:poisoner")
        ]));
        let command = json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "firstNight:investigator",
                "input": {
                    "playerIds": ["player-2", "player-4"],
                    "characterId": "poisoner"
                }
            }
        });

        let actual: Value =
            serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

        assert_eq!(actual["ok"], true);
        assert_eq!(
            actual["value"]["revealPayload"]["messageKo"],
            "조사관 정보: 2번 Bert 또는 4번 Dev 중 한 명은 독살자입니다."
        );
    }

    #[test]
    fn confirming_chef_can_log_true_count_and_reveal_different_displayed_value() {
        let game = game_with_events(json!([
            setup_event_with_players(json!([
                { "id": "player-1", "seat": 1, "name": "Ada", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
                { "id": "player-2", "seat": 2, "name": "Bert", "actualCharacter": "chef", "shownCharacter": "chef" },
                { "id": "player-3", "seat": 3, "name": "Cora", "actualCharacter": "empath", "shownCharacter": "empath" },
                { "id": "player-4", "seat": 4, "name": "Dev", "actualCharacter": "poisoner", "shownCharacter": "poisoner" },
                { "id": "player-5", "seat": 5, "name": "Eve", "actualCharacter": "imp", "shownCharacter": "imp" }
            ])),
            phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
            phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
            phase_event("phaseStepConfirmed", "firstNight:poisoner"),
            phase_event("phaseStepConfirmed", "firstNight:washerwoman")
        ]));
        let command = json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "firstNight:chef",
                "input": { "value": 0, "reason": "registration" }
            }
        });

        let actual: Value =
            serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

        assert_eq!(actual["ok"], true);
        assert_eq!(actual["value"]["event"]["payload"]["input"]["trueValue"], 1);
        assert_eq!(
            actual["value"]["event"]["payload"]["input"]["displayedValue"],
            0
        );
        assert_eq!(
            actual["value"]["event"]["payload"]["input"]["reason"],
            "registration"
        );
        assert_eq!(
            actual["value"]["event"]["summary"],
            "요리사 정보 확정: 실제 1쌍, 표시 0쌍 (등록 판정)"
        );
        assert_eq!(
            actual["value"]["revealPayload"]["messageKo"],
            "서로 이웃한 악 팀 쌍은 0쌍입니다."
        );
    }

    #[test]
    fn demon_and_minion_information_steps_return_safe_reveal_payloads() {
        let game = game_with_events(json!([setup_event_with_minion()]));
        let minion_command = json!({
            "type": "confirmStep",
            "payload": { "stepId": "firstNight:minionInfo" }
        });

        let minion_actual: Value = serde_json::from_str(&propose_json(
            &game.to_string(),
            &minion_command.to_string(),
        ))
        .unwrap();

        assert_eq!(minion_actual["ok"], true);
        assert_eq!(
            minion_actual["value"]["revealPayload"]["messageKo"],
            "하수인 정보:\n악마: 5번 Eve - 임프\n하수인: 4번 Dev - 독살자"
        );

        let demon_game = game_with_events(json!([
            setup_event_with_minion(),
            phase_event("phaseStepConfirmed", "firstNight:minionInfo")
        ]));
        let demon_command = json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "firstNight:demonInfo",
                "input": { "characterIds": ["washerwoman", "librarian", "chef"] }
            }
        });
        let demon_actual: Value = serde_json::from_str(&propose_json(
            &demon_game.to_string(),
            &demon_command.to_string(),
        ))
        .unwrap();

        assert_eq!(demon_actual["ok"], true);
        assert_eq!(
            demon_actual["value"]["revealPayload"]["messageKo"],
            "악마 정보:\n하수인: 4번 Dev - 독살자\n블러프: 세탁부, 사서, 요리사"
        );
    }

    #[test]
    fn spy_step_reveals_grimoire_only_through_reveal_payload() {
        let game = game_with_events(json!([
            setup_event_with_players(json!([
                { "id": "player-1", "seat": 1, "name": "Ada", "actualCharacter": "chef", "shownCharacter": "chef" },
                { "id": "player-2", "seat": 2, "name": "Bert", "actualCharacter": "empath", "shownCharacter": "empath" },
                { "id": "player-3", "seat": 3, "name": "Cora", "actualCharacter": "fortuneTeller", "shownCharacter": "fortuneTeller" },
                { "id": "player-4", "seat": 4, "name": "Dev", "actualCharacter": "spy", "shownCharacter": "spy" },
                { "id": "player-5", "seat": 5, "name": "Eve", "actualCharacter": "imp", "shownCharacter": "imp" }
            ])),
            phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
            phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
            phase_event("phaseStepConfirmed", "firstNight:chef"),
            phase_event("phaseStepConfirmed", "firstNight:empath"),
            phase_event("phaseStepConfirmed", "firstNight:fortuneTeller")
        ]));
        let command = json!({
            "type": "confirmStep",
            "payload": { "stepId": "firstNight:spy" }
        });

        let actual: Value =
            serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

        assert_eq!(actual["ok"], true);
        assert_eq!(actual["value"]["event"]["payload"]["input"], Value::Null);
        assert!(actual["value"]["preview"]["messageKo"]
            .as_str()
            .unwrap()
            .contains("현재 단계를 확정합니다."));
        assert!(actual["value"]["revealPayload"]["messageKo"]
            .as_str()
            .unwrap()
            .contains("5번 Eve - 임프"));
        assert_eq!(
            actual["value"]["revealPayload"]["previewMessageKo"],
            "스파이 그리모어 Reveal 준비됨"
        );
    }

    #[test]
    fn confirming_empath_step_returns_reveal_payload() {
        let game = game_with_events(json!([
            setup_event(),
            phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
            phase_event("phaseStepConfirmed", "firstNight:washerwoman"),
            phase_event("phaseStepConfirmed", "firstNight:chef")
        ]));
        let command = json!({
            "type": "confirmStep",
            "payload": { "stepId": "firstNight:empath" }
        });

        let actual: Value =
            serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

        assert_eq!(actual["ok"], true);
        assert_eq!(
            actual["value"]["revealPayload"]["messageKo"],
            "살아있는 양옆 이웃 중 악 팀은 0명입니다."
        );
    }

    #[test]
    fn confirming_player_selection_step_requires_matching_input_shape() {
        let game = game_with_events(json!([
            setup_event(),
            phase_event("phaseStepConfirmed", "firstNight:demonInfo")
        ]));
        let command = json!({
            "type": "confirmStep",
            "payload": { "stepId": "firstNight:washerwoman", "input": { "playerIds": ["player-1"] } }
        });

        let actual: Value =
            serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

        assert_eq!(actual["ok"], false);
        assert_eq!(actual["error"]["code"], "MISSING_STEP_INPUT");
    }

    #[test]
    fn skipping_is_rejected_for_non_skippable_phase_transition_steps() {
        let game = game_with_events(json!([
            setup_event(),
            phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
            phase_event("phaseStepConfirmed", "firstNight:washerwoman"),
            phase_event("phaseStepConfirmed", "firstNight:chef"),
            phase_event("phaseStepConfirmed", "firstNight:empath"),
            phase_event("phaseStepConfirmed", "firstNight:fortuneTeller")
        ]));
        let command = json!({
            "type": "skipStep",
            "payload": { "stepId": "firstNight:toDay" }
        });

        let actual: Value =
            serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

        assert_eq!(actual["ok"], false);
        assert_eq!(actual["error"]["code"], "STEP_CANNOT_BE_SKIPPED");
    }

    #[test]
    fn phase_transition_confirmation_moves_from_first_night_to_day() {
        let game = game_with_events(json!([
            setup_event(),
            phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
            phase_event("phaseStepConfirmed", "firstNight:washerwoman"),
            phase_event("phaseStepConfirmed", "firstNight:chef"),
            phase_event("phaseStepConfirmed", "firstNight:empath"),
            phase_event("phaseStepConfirmed", "firstNight:fortuneTeller"),
            phase_event("phaseStepConfirmed", "firstNight:toDay")
        ]));

        let actual: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();

        assert_eq!(actual["ok"], true);
        assert_eq!(actual["value"]["phase"], "day");
        assert_eq!(actual["value"]["currentStep"]["id"], "day:announceDeaths");
        assert_eq!(actual["value"]["phaseOverview"][0]["status"], "current");
    }

    #[test]
    fn day_after_death_uses_nomination_vote_steps() {
        let game = game_with_events(json!([
            setup_event(),
            death_event("player-2"),
            phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
            phase_event("phaseStepConfirmed", "firstNight:washerwoman"),
            phase_event("phaseStepConfirmed", "firstNight:chef"),
            phase_event("phaseStepConfirmed", "firstNight:empath"),
            phase_event("phaseStepConfirmed", "firstNight:fortuneTeller"),
            phase_event("phaseStepConfirmed", "firstNight:toDay"),
            phase_event("phaseStepConfirmed", "day:announceDeaths")
        ]));

        let actual: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();

        assert_eq!(actual["ok"], true);
        assert_eq!(actual["value"]["currentStep"]["id"], "day:nomination:1");
        assert_eq!(
            actual["value"]["currentStep"]["requiredInput"]["kind"],
            "nominationVote"
        );
        assert_eq!(actual["value"]["players"][1]["alive"], false);
    }

    #[test]
    fn confirming_nomination_vote_spends_valid_ghost_votes_and_updates_candidate() {
        let game = game_with_events(json!([
            setup_event(),
            death_event("player-2"),
            phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
            phase_event("phaseStepConfirmed", "firstNight:washerwoman"),
            phase_event("phaseStepConfirmed", "firstNight:chef"),
            phase_event("phaseStepConfirmed", "firstNight:empath"),
            phase_event("phaseStepConfirmed", "firstNight:fortuneTeller"),
            phase_event("phaseStepConfirmed", "firstNight:toDay"),
            phase_event("phaseStepConfirmed", "day:announceDeaths")
        ]));
        let command = json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "day:nomination:1",
                "input": {
                    "nominatorId": "player-1",
                    "nomineeId": "player-5",
                    "voterIds": ["player-1", "player-2", "player-3"]
                }
            }
        });

        let proposal: Value =
            serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

        assert_eq!(proposal["ok"], true);
        assert_eq!(
            proposal["value"]["event"]["type"],
            "nominationVoteConfirmed"
        );
        assert_eq!(proposal["value"]["preview"]["voteCount"], 3);
        assert_eq!(
            proposal["value"]["preview"]["ghostVoteSpentPlayerIds"],
            json!(["player-2"])
        );
        assert_eq!(
            proposal["value"]["preview"]["updatesExecutionCandidate"],
            true
        );

        let mut events = game["game"]["events"].as_array().unwrap().clone();
        events.push(proposal["value"]["event"].clone());
        let replayed: Value = serde_json::from_str(&replay_json(
            &game_with_events(Value::Array(events)).to_string(),
        ))
        .unwrap();

        assert_eq!(replayed["ok"], true);
        assert_eq!(replayed["value"]["players"][1]["ghostVoteUsed"], true);
        assert_eq!(
            replayed["value"]["dayState"]["executionCandidate"],
            json!({ "nomineeId": "player-5", "voteCount": 3 })
        );
        assert_eq!(replayed["value"]["currentStep"]["id"], "day:nomination:2");
    }

    #[test]
    fn execution_confirmation_is_separate_from_death_state() {
        let game = game_with_events(json!([
            setup_event(),
            phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
            phase_event("phaseStepConfirmed", "firstNight:washerwoman"),
            phase_event("phaseStepConfirmed", "firstNight:chef"),
            phase_event("phaseStepConfirmed", "firstNight:empath"),
            phase_event("phaseStepConfirmed", "firstNight:fortuneTeller"),
            phase_event("phaseStepConfirmed", "firstNight:toDay"),
            phase_event("phaseStepConfirmed", "day:announceDeaths"),
            nomination_vote_event(
                "day:nomination:1",
                "player-1",
                "player-5",
                ["player-1", "player-2", "player-3"]
            ),
            phase_event("phaseStepSkipped", "day:nomination:2")
        ]));
        let command = json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "day:execution",
                "input": { "execute": true }
            }
        });

        let proposal: Value =
            serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

        assert_eq!(proposal["ok"], true);
        assert_eq!(proposal["value"]["event"]["type"], "executionConfirmed");

        let mut events = game["game"]["events"].as_array().unwrap().clone();
        events.push(proposal["value"]["event"].clone());
        let replayed: Value = serde_json::from_str(&replay_json(
            &game_with_events(Value::Array(events)).to_string(),
        ))
        .unwrap();

        assert_eq!(replayed["ok"], true);
        assert_eq!(
            replayed["value"]["dayState"]["confirmedExecution"]["playerId"],
            "player-5"
        );
        assert_eq!(replayed["value"]["players"][4]["alive"], true);
    }

    #[test]
    fn no_execution_requires_explicit_confirmation() {
        let game = game_with_events(json!([
            setup_event(),
            phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
            phase_event("phaseStepConfirmed", "firstNight:washerwoman"),
            phase_event("phaseStepConfirmed", "firstNight:chef"),
            phase_event("phaseStepConfirmed", "firstNight:empath"),
            phase_event("phaseStepConfirmed", "firstNight:fortuneTeller"),
            phase_event("phaseStepConfirmed", "firstNight:toDay"),
            phase_event("phaseStepConfirmed", "day:announceDeaths"),
            phase_event("phaseStepSkipped", "day:nomination:1")
        ]));
        let command = json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "day:execution",
                "input": { "execute": false }
            }
        });

        let actual: Value =
            serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

        assert_eq!(actual["ok"], true);
        assert_eq!(actual["value"]["event"]["type"], "noExecutionConfirmed");
    }

    #[test]
    fn phase_transition_confirmation_moves_from_night_to_next_day() {
        let game = game_with_events(json!([
            setup_event(),
            phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
            phase_event("phaseStepConfirmed", "firstNight:washerwoman"),
            phase_event("phaseStepConfirmed", "firstNight:chef"),
            phase_event("phaseStepConfirmed", "firstNight:empath"),
            phase_event("phaseStepConfirmed", "firstNight:fortuneTeller"),
            phase_event("phaseStepConfirmed", "firstNight:toDay"),
            phase_event("phaseStepConfirmed", "day:announceDeaths"),
            phase_event("phaseStepSkipped", "day:nomination:1"),
            no_execution_event("day:execution"),
            phase_event("phaseStepConfirmed", "day:toNight"),
            phase_event("phaseStepConfirmed", "night:imp"),
            phase_event("phaseStepConfirmed", "night:fortuneTeller"),
            phase_event("phaseStepConfirmed", "night:toDay")
        ]));

        let actual: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();

        assert_eq!(actual["ok"], true);
        assert_eq!(actual["value"]["phase"], "day");
        assert_eq!(actual["value"]["currentStep"]["id"], "day2:announceDeaths");
    }

    #[test]
    fn replay_rejects_invalid_phase_step_events() {
        let game = game_with_events(json!([
            setup_event(),
            phase_event("phaseStepConfirmed", "firstNight:notARealStep")
        ]));

        let actual: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();

        assert_eq!(actual["ok"], false);
        assert_eq!(actual["error"]["code"], "REPLAY_FAILED");
    }

    #[test]
    fn replay_rejects_phase_step_events_without_step_id() {
        let game = game_with_events(json!([
            setup_event(),
            {
                "id": "evt-missing-step-id",
                "type": "phaseStepConfirmed",
                "phase": "firstNight",
                "payload": {},
                "summary": "missing step id",
                "createdAt": "2026-01-01T00:00:00.000Z"
            }
        ]));

        let actual: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();

        assert_eq!(actual["ok"], false);
        assert_eq!(actual["error"]["code"], "REPLAY_FAILED");
    }

    #[test]
    fn replay_rejects_out_of_order_phase_step_events() {
        let game = game_with_events(json!([
            setup_event(),
            phase_event("phaseStepConfirmed", "firstNight:washerwoman")
        ]));

        let actual: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();

        assert_eq!(actual["ok"], false);
        assert_eq!(actual["error"]["code"], "REPLAY_FAILED");
    }

    #[test]
    fn replay_rejects_phase_step_events_before_setup() {
        let game = game_with_events(json!([
            phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
            setup_event()
        ]));

        let actual: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();

        assert_eq!(actual["ok"], false);
        assert_eq!(actual["error"]["code"], "REPLAY_FAILED");
    }

    #[test]
    fn replay_rejects_phase_step_events_with_unknown_player_input() {
        let game = game_with_events(json!([
            setup_event(),
            phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
            phase_event_with_input(
                "phaseStepConfirmed",
                "firstNight:washerwoman",
                json!({ "playerIds": ["player-1", "not-a-player"] })
            )
        ]));

        let actual: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();

        assert_eq!(actual["ok"], false);
        assert_eq!(actual["error"]["code"], "INVALID_STEP_INPUT");
    }

    #[test]
    fn replay_rejects_skipped_non_skippable_phase_transition_events() {
        let game = game_with_events(json!([
            setup_event(),
            phase_event("phaseStepSkipped", "firstNight:toDay")
        ]));

        let actual: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();

        assert_eq!(actual["ok"], false);
        assert_eq!(actual["error"]["code"], "REPLAY_FAILED");
    }

    #[test]
    fn propose_create_game_rejects_invalid_player_count() {
        let command = json!({
            "type": "createGame",
            "payload": { "players": [] }
        });

        let actual: Value =
            serde_json::from_str(&propose_json(EMPTY_GAME, &command.to_string())).unwrap();

        assert_eq!(actual["ok"], false);
        assert_eq!(actual["error"]["code"], "INVALID_PLAYER_COUNT");
    }

    fn game_with_events(events: Value) -> Value {
        json!({
            "schemaVersion": 1,
            "game": {
                "id": "game-1",
                "name": "Setup",
                "createdAt": "2026-01-01T00:00:00.000Z",
                "updatedAt": "2026-01-01T00:00:00.000Z",
                "events": events
            }
        })
    }

    fn setup_event() -> Value {
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Ada", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
            { "id": "player-2", "seat": 2, "name": "Bert", "actualCharacter": "chef", "shownCharacter": "chef" },
            { "id": "player-3", "seat": 3, "name": "Cora", "actualCharacter": "empath", "shownCharacter": "empath" },
            { "id": "player-4", "seat": 4, "name": "Dev", "actualCharacter": "fortuneTeller", "shownCharacter": "fortuneTeller" },
            { "id": "player-5", "seat": 5, "name": "Eve", "actualCharacter": "imp", "shownCharacter": "imp" }
        ]))
    }

    fn setup_event_with_minion() -> Value {
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Ada", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
            { "id": "player-2", "seat": 2, "name": "Bert", "actualCharacter": "chef", "shownCharacter": "chef" },
            { "id": "player-3", "seat": 3, "name": "Cora", "actualCharacter": "empath", "shownCharacter": "empath" },
            { "id": "player-4", "seat": 4, "name": "Dev", "actualCharacter": "poisoner", "shownCharacter": "poisoner" },
            { "id": "player-5", "seat": 5, "name": "Eve", "actualCharacter": "imp", "shownCharacter": "imp" }
        ]))
    }

    fn setup_event_with_players(players: Value) -> Value {
        json!({
            "id": "evt-1",
            "type": "setupConfirmed",
            "phase": "setup",
            "payload": { "players": players },
            "summary": "초기 설정 확정: 5명",
            "createdAt": "2026-01-01T00:00:00.000Z"
        })
    }

    fn death_event(player_id: &str) -> Value {
        json!({
            "id": format!("death-{player_id}"),
            "type": "deathConfirmed",
            "phase": "night",
            "payload": { "playerId": player_id },
            "summary": "사망 확정",
            "createdAt": "2026-01-01T00:00:00.000Z"
        })
    }

    fn nomination_vote_event<const N: usize>(
        step_id: &str,
        nominator_id: &str,
        nominee_id: &str,
        voter_ids: [&str; N],
    ) -> Value {
        let voter_ids = voter_ids.to_vec();
        let vote_count = voter_ids.len();
        json!({
            "id": format!("evt-{step_id}"),
            "type": "nominationVoteConfirmed",
            "phase": "day",
            "payload": {
                "stepId": step_id,
                "input": {
                    "stepId": step_id,
                    "nominatorId": nominator_id,
                    "nomineeId": nominee_id,
                    "voterIds": voter_ids,
                    "voteCount": vote_count,
                    "ghostVoteSpentPlayerIds": [],
                    "updatesExecutionCandidate": vote_count >= 3
                }
            },
            "summary": "지명 투표 확정",
            "createdAt": "2026-01-01T00:00:00.000Z"
        })
    }

    fn no_execution_event(step_id: &str) -> Value {
        json!({
            "id": format!("evt-{step_id}"),
            "type": "noExecutionConfirmed",
            "phase": "day",
            "payload": {
                "stepId": step_id,
                "input": { "execute": false, "playerId": null }
            },
            "summary": "처형 없음 확정",
            "createdAt": "2026-01-01T00:00:00.000Z"
        })
    }

    fn phase_event(event_type: &str, step_id: &str) -> Value {
        let input = if event_type == "phaseStepConfirmed" {
            if ["washerwoman", "librarian", "investigator", "fortuneTeller"]
                .iter()
                .any(|character| step_id.ends_with(character))
            {
                if step_id.ends_with("washerwoman") {
                    json!({ "playerIds": ["player-1", "player-2"], "characterId": "chef" })
                } else if step_id.ends_with("librarian") {
                    json!({ "playerIds": ["player-1", "player-2"], "characterId": "drunk" })
                } else if step_id.ends_with("investigator") {
                    json!({ "playerIds": ["player-1", "player-2"], "characterId": "poisoner" })
                } else {
                    json!({ "playerIds": ["player-1", "player-2"] })
                }
            } else if ["poisoner", "monk", "imp", "ravenkeeper", "butler"]
                .iter()
                .any(|character| step_id.ends_with(character))
            {
                json!({ "playerIds": ["player-1"] })
            } else {
                Value::Null
            }
        } else {
            Value::Null
        };

        phase_event_with_input(event_type, step_id, input)
    }

    fn phase_event_with_input(event_type: &str, step_id: &str, input: Value) -> Value {
        json!({
            "id": format!("evt-{step_id}"),
            "type": event_type,
            "phase": step_id.split(':').next().unwrap(),
            "payload": { "stepId": step_id, "input": input },
            "summary": step_id,
            "createdAt": "2026-01-01T00:00:00.000Z"
        })
    }
}

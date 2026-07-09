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
    warnings: Vec<CoreWarning>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Proposal {
    event: GameEvent,
    warnings: Vec<CoreWarning>,
    follow_up_steps: Vec<Value>,
    preview: Value,
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

        Ok(ReplayState {
            schema_version: game_file.schema_version,
            event_count: game_file.game.events.len(),
            phase: "setup",
            players,
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
            }),
            "createGame" => propose_create_game(&game_file, command.payload),
            _ => Err(error("UNSUPPORTED_COMMAND", "지원하지 않는 명령입니다.")),
        }
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
    })
}

fn replay_players(events: &[ConfirmedEvent]) -> Result<Vec<Player>, CoreError> {
    let Some(setup_event) = events
        .iter()
        .rev()
        .find(|event| event.event_type == "setupConfirmed")
    else {
        return Ok(Vec::new());
    };

    let payload: CreateGamePayload = serde_json::from_value(setup_event.payload.clone())
        .map_err(|_| error("REPLAY_FAILED", "확정 이벤트를 재생할 수 없습니다."))?;

    validate_setup_inputs(&payload.players)?;
    payload
        .players
        .iter()
        .map(player_from_setup_input)
        .collect::<Result<Vec<_>, _>>()
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
    let expected = expected_distribution(players.len());
    let actual = players.iter().fold((0, 0, 0, 0), |mut counts, player| {
        match character_kind(&player.actual_character) {
            Some(CharacterKind::Townsfolk) => counts.0 += 1,
            Some(CharacterKind::Outsider) => counts.1 += 1,
            Some(CharacterKind::Minion) => counts.2 += 1,
            Some(CharacterKind::Demon) => counts.3 += 1,
            None => {}
        }
        counts
    });

    if actual != expected {
        warnings.push(CoreWarning {
            code: "SETUP_DISTRIBUTION_MISMATCH".to_string(),
            severity: "warning",
            message_ko: format!(
                "Trouble Brewing 권장 구성은 마을주민 {}, 외부인 {}, 하수인 {}, 악마 {}명입니다.",
                expected.0, expected.1, expected.2, expected.3
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

fn expected_distribution(player_count: usize) -> (usize, usize, usize, usize) {
    match player_count {
        5 => (3, 0, 1, 1),
        6 => (3, 1, 1, 1),
        7 => (5, 0, 1, 1),
        8 => (5, 1, 1, 1),
        9 => (5, 2, 1, 1),
        10 => (7, 0, 2, 1),
        11 => (7, 1, 2, 1),
        12 => (7, 2, 2, 1),
        13 => (9, 0, 3, 1),
        14 => (9, 1, 3, 1),
        15 => (9, 2, 3, 1),
        _ => (0, 0, 0, 0),
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
}

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GameFile {
    schema_version: u32,
    game: Game,
}

#[derive(Debug, Deserialize)]
struct Game {
    events: Vec<Value>,
}

#[derive(Debug, Deserialize)]
struct Command {
    #[serde(rename = "type")]
    command_type: String,
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
    warnings: Vec<Value>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Proposal {
    event: GameEvent,
    warnings: Vec<Value>,
    follow_up_steps: Vec<Value>,
    preview: Value,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GameEvent {
    id: &'static str,
    #[serde(rename = "type")]
    event_type: &'static str,
    phase: &'static str,
    payload: Value,
    summary: &'static str,
    created_at: &'static str,
}

pub fn replay_json(game_file_json: &str) -> String {
    let result = parse_game_file(game_file_json).map(|game_file| ReplayState {
        schema_version: game_file.schema_version,
        event_count: game_file.game.events.len(),
        phase: "setup",
        warnings: Vec::new(),
    });

    to_json(result)
}

pub fn propose_json(game_file_json: &str, command_json: &str) -> String {
    let result = parse_game_file(game_file_json).and_then(|_| {
        let command: Command = serde_json::from_str(command_json)
            .map_err(|_| error("MALFORMED_COMMAND", "명령 형식이 올바르지 않습니다."))?;

        if command.command_type != "smoke" {
            return Err(error("UNSUPPORTED_COMMAND", "지원하지 않는 명령입니다."));
        }

        Ok(Proposal {
            event: GameEvent {
                id: "smoke-event",
                event_type: "smokeConfirmed",
                phase: "setup",
                payload: serde_json::json!({ "source": "smoke" }),
                summary: "스모크 명령 확인",
                created_at: "1970-01-01T00:00:00.000Z",
            },
            warnings: Vec::new(),
            follow_up_steps: Vec::new(),
            preview: serde_json::json!({ "messageKo": "코어 계약 정상" }),
        })
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
}

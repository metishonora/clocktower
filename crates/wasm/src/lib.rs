use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn replay(game_file_json: &str) -> String {
    clocktower_domain::replay_json(game_file_json)
}

#[wasm_bindgen]
pub fn propose(game_file_json: &str, command_json: &str) -> String {
    clocktower_domain::propose_json(game_file_json, command_json)
}

#[cfg(test)]
mod tests {
    use super::*;

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
    fn wasm_adapter_returns_replay_json() {
        assert!(replay(EMPTY_GAME).contains(r#""ok":true"#));
    }

    #[test]
    fn wasm_adapter_returns_propose_json() {
        assert!(propose(EMPTY_GAME, r#"{ "type": "smoke" }"#).contains("smokeConfirmed"));
    }
}

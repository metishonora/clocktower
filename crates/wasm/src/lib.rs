use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn replay(game_file_json: &str) -> String {
    clocktower_domain::replay_json(game_file_json)
}

#[wasm_bindgen]
pub fn propose(game_file_json: &str, command_json: &str) -> String {
    clocktower_domain::propose_json(game_file_json, command_json)
}

#[wasm_bindgen]
pub fn setup_distribution(request_json: &str) -> String {
    clocktower_domain::setup_distribution_json(request_json)
}

#[wasm_bindgen]
pub fn suggest_phase_input(game_file_json: &str, request_json: &str) -> String {
    clocktower_domain::suggest_phase_input_json(game_file_json, request_json)
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

    #[test]
    fn wasm_adapter_returns_setup_distribution_json() {
        assert!(
            setup_distribution(r#"{ "playerCount": 7, "actualCharacters": ["baron"] }"#)
                .contains(r#""Townsfolk":3"#)
        );
    }

    #[test]
    fn wasm_adapter_returns_phase_input_suggestion_json() {
        let game = r#"{
          "schemaVersion": 1,
          "game": {
            "id": "game-1",
            "name": "Suggestion",
            "createdAt": "2026-01-01T00:00:00.000Z",
            "updatedAt": "2026-01-01T00:00:00.000Z",
            "events": [{
              "id": "setup-1",
              "type": "setupConfirmed",
              "phase": "setup",
              "payload": { "players": [
                { "id": "p1", "seat": 1, "name": "A", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
                { "id": "p2", "seat": 2, "name": "B", "actualCharacter": "chef", "shownCharacter": "chef" },
                { "id": "p3", "seat": 3, "name": "C", "actualCharacter": "empath", "shownCharacter": "empath" },
                { "id": "p4", "seat": 4, "name": "D", "actualCharacter": "saint", "shownCharacter": "saint" },
                { "id": "p5", "seat": 5, "name": "E", "actualCharacter": "imp", "shownCharacter": "imp" }
              ]},
              "summary": "setup",
              "createdAt": "2026-01-01T00:00:00.000Z"
            }]
          }
        }"#;
        let request = r#"{ "stepId": "firstNight:demonInfo", "choiceToken": 0 }"#;
        let response = suggest_phase_input(game, request);
        assert!(response.contains(r#""ok":true"#));
        assert!(response.contains(r#""characterIds""#));
        assert!(!response.contains(r#""event""#));
        assert!(!response.contains(r#""revealPayload""#));
    }
}

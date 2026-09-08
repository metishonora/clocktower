use crate::{propose_json, replay_json};
use serde_json::{json, Value};
fn official_game(events: Value) -> Value {
    json!({
        "schemaVersion": 4,
        "game": {
            "script": {
                "type": "official",
                "scriptId": "troubleBrewing",
            },
            "id": "official-setup-game",
            "name": "Official setup game",
            "createdAt": "2026-09-04T00:00:00.000Z",
            "updatedAt": "2026-09-04T00:00:00.000Z",
            "events": events,
        }
    })
}
fn legacy_tb_game(events: Value) -> Value {
    json!({
        "schemaVersion": 2,
        "game": {
            "id": "legacy-tb-setup-game",
            "name": "Legacy Trouble Brewing setup game",
            "createdAt": "2026-01-01T00:00:00.000Z",
            "updatedAt": "2026-01-01T00:00:00.000Z",
            "events": events,
        }
    })
}
fn legacy_snv_game(events: Value) -> Value {
    json!({
        "schemaVersion": 3,
        "game": {
            "scriptId": "sectsAndViolets",
            "id": "legacy-snv-setup-game",
            "name": "Legacy Sects & Violets setup game",
            "createdAt": "2026-01-01T00:00:00.000Z",
            "updatedAt": "2026-01-01T00:00:00.000Z",
            "events": events,
        }
    })
}
fn propose_create(game: &Value, players: Value) -> Value {
    propose_create_with_choice(game, players, None)
}
fn propose_create_with_choice(
    game: &Value,
    players: Value,
    setup_choice_id: Option<&str>,
) -> Value {
    let mut payload = json!({ "players": players });
    if let Some(choice) = setup_choice_id {
        payload["setupChoiceId"] = json!(choice);
    }
    let command = json!({
        "type": "createGame",
        "payload": payload,
    });
    serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap()
}
fn setup_event(players: Value) -> Value {
    json!({
        "id": "setup-1",
        "type": "setupConfirmed",
        "phase": "setup",
        "payload": { "players": players },
        "summary": "초기 설정 확정: 5명",
        "createdAt": "2026-01-01T00:00:00.000Z",
    })
}
fn warning_codes(result: &Value) -> Vec<&str> {
    result["value"]["warnings"]
        .as_array()
        .expect("successful replay should return warnings")
        .iter()
        .filter_map(|warning| warning["code"].as_str())
        .collect()
}
#[test]
fn new_create_game_requires_exact_distribution_and_unique_actual_characters() {
    let mismatched_players = json!([
        { "seat": 1, "name": "Ada", "actualCharacter": "washerwoman" },
        { "seat": 2, "name": "Bert", "actualCharacter": "librarian" },
        { "seat": 3, "name": "Cora", "actualCharacter": "investigator" },
        { "seat": 4, "name": "Dev", "actualCharacter": "chef" },
        { "seat": 5, "name": "Eve", "actualCharacter": "imp" }
    ]);
    let duplicate_players = json!([
        { "seat": 1, "name": "Ada", "actualCharacter": "washerwoman" },
        { "seat": 2, "name": "Bert", "actualCharacter": "washerwoman" },
        { "seat": 3, "name": "Cora", "actualCharacter": "chef" },
        { "seat": 4, "name": "Dev", "actualCharacter": "poisoner" },
        { "seat": 5, "name": "Eve", "actualCharacter": "imp" }
    ]);

    let official_mismatch = propose_create(&official_game(json!([])), mismatched_players.clone());
    assert_eq!(
        official_mismatch["error"]["code"], "INVALID_SETUP_DISTRIBUTION",
        "{official_mismatch}"
    );
    let official_duplicate = propose_create(&official_game(json!([])), duplicate_players.clone());
    assert_eq!(
        official_duplicate["error"]["code"], "DUPLICATE_ACTUAL_CHARACTER",
        "{official_duplicate}"
    );
}
#[test]
fn legacy_replay_keeps_distribution_and_duplicate_warnings_compatible() {
    let mismatch_players = json!([
        { "id": "player-1", "seat": 1, "name": "Ada", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
        { "id": "player-2", "seat": 2, "name": "Bert", "actualCharacter": "librarian", "shownCharacter": "librarian" },
        { "id": "player-3", "seat": 3, "name": "Cora", "actualCharacter": "investigator", "shownCharacter": "investigator" },
        { "id": "player-4", "seat": 4, "name": "Dev", "actualCharacter": "chef", "shownCharacter": "chef" },
        { "id": "player-5", "seat": 5, "name": "Eve", "actualCharacter": "imp", "shownCharacter": "imp" }
    ]);
    let mismatch: Value = serde_json::from_str(&replay_json(
        &legacy_tb_game(json!([setup_event(mismatch_players)])).to_string(),
    ))
    .unwrap();
    assert_eq!(mismatch["ok"], true, "{mismatch}");
    assert!(warning_codes(&mismatch).contains(&"SETUP_DISTRIBUTION_MISMATCH"));

    let duplicate_players = json!([
        { "id": "player-1", "seat": 1, "name": "Ada", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
        { "id": "player-2", "seat": 2, "name": "Bert", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
        { "id": "player-3", "seat": 3, "name": "Cora", "actualCharacter": "chef", "shownCharacter": "chef" },
        { "id": "player-4", "seat": 4, "name": "Dev", "actualCharacter": "poisoner", "shownCharacter": "poisoner" },
        { "id": "player-5", "seat": 5, "name": "Eve", "actualCharacter": "imp", "shownCharacter": "imp" }
    ]);
    let duplicate: Value = serde_json::from_str(&replay_json(
        &legacy_tb_game(json!([setup_event(duplicate_players)])).to_string(),
    ))
    .unwrap();
    assert_eq!(duplicate["ok"], true, "{duplicate}");
    assert!(warning_codes(&duplicate).contains(&"DUPLICATE_ACTUAL_CHARACTER"));

    let snv_mismatch_players = json!([
        { "id": "player-1", "seat": 1, "name": "A", "actualCharacter": "clockmaker", "shownCharacter": "clockmaker" },
        { "id": "player-2", "seat": 2, "name": "B", "actualCharacter": "dreamer", "shownCharacter": "dreamer" },
        { "id": "player-3", "seat": 3, "name": "C", "actualCharacter": "snakeCharmer", "shownCharacter": "snakeCharmer" },
        { "id": "player-4", "seat": 4, "name": "D", "actualCharacter": "mathematician", "shownCharacter": "mathematician" },
        { "id": "player-5", "seat": 5, "name": "E", "actualCharacter": "flowergirl", "shownCharacter": "flowergirl" },
        { "id": "player-6", "seat": 6, "name": "F", "actualCharacter": "savant", "shownCharacter": "savant" },
        { "id": "player-7", "seat": 7, "name": "G", "actualCharacter": "vortox", "shownCharacter": "vortox" }
    ]);
    let snv_mismatch: Value = serde_json::from_str(&replay_json(
        &legacy_snv_game(json!([setup_event(snv_mismatch_players)])).to_string(),
    ))
    .unwrap();
    assert_eq!(snv_mismatch["ok"], true, "{snv_mismatch}");
    assert!(warning_codes(&snv_mismatch).contains(&"SETUP_DISTRIBUTION_MISMATCH"));
}
#[test]
fn strict_new_create_validation_covers_snv_and_bmr_with_setup_choice() {
    let snv_game = json!({
        "schemaVersion": 4,
        "game": {
            "script": { "type": "official", "scriptId": "sectsAndViolets" },
            "id": "strict-snv",
            "name": "Strict SnV",
            "createdAt": "2026-09-04T00:00:00.000Z",
            "updatedAt": "2026-09-04T00:00:00.000Z",
            "events": [],
        }
    });
    let snv_mismatch = propose_create(
        &snv_game,
        json!([
            { "seat": 1, "name": "A", "actualCharacter": "clockmaker" },
            { "seat": 2, "name": "B", "actualCharacter": "dreamer" },
            { "seat": 3, "name": "C", "actualCharacter": "snakeCharmer" },
            { "seat": 4, "name": "D", "actualCharacter": "mathematician" },
            { "seat": 5, "name": "E", "actualCharacter": "flowergirl" },
            { "seat": 6, "name": "F", "actualCharacter": "savant" },
            { "seat": 7, "name": "G", "actualCharacter": "vortox" }
        ]),
    );
    assert_eq!(
        snv_mismatch["error"]["code"], "INVALID_SETUP_DISTRIBUTION",
        "{snv_mismatch}"
    );
    let snv_duplicate = propose_create(
        &snv_game,
        json!([
            { "seat": 1, "name": "A", "actualCharacter": "clockmaker" },
            { "seat": 2, "name": "B", "actualCharacter": "clockmaker" },
            { "seat": 3, "name": "C", "actualCharacter": "snakeCharmer" },
            { "seat": 4, "name": "D", "actualCharacter": "mathematician" },
            { "seat": 5, "name": "E", "actualCharacter": "flowergirl" },
            { "seat": 6, "name": "F", "actualCharacter": "witch" },
            { "seat": 7, "name": "G", "actualCharacter": "vortox" }
        ]),
    );
    assert_eq!(
        snv_duplicate["error"]["code"], "DUPLICATE_ACTUAL_CHARACTER",
        "{snv_duplicate}"
    );

    let bmr_game = json!({
        "schemaVersion": 4,
        "game": {
            "script": { "type": "official", "scriptId": "badMoonRising" },
            "id": "strict-bmr",
            "name": "Strict BMR",
            "createdAt": "2026-09-04T00:00:00.000Z",
            "updatedAt": "2026-09-04T00:00:00.000Z",
            "events": [],
        }
    });
    let bmr_mismatch = propose_create_with_choice(
        &bmr_game,
        json!([
            { "seat": 1, "name": "A", "actualCharacter": "grandmother" },
            { "seat": 2, "name": "B", "actualCharacter": "sailor" },
            { "seat": 3, "name": "C", "actualCharacter": "chambermaid" },
            { "seat": 4, "name": "D", "actualCharacter": "exorcist" },
            { "seat": 5, "name": "E", "actualCharacter": "innkeeper" },
            { "seat": 6, "name": "F", "actualCharacter": "godfather" },
            { "seat": 7, "name": "G", "actualCharacter": "zombuul" }
        ]),
        Some("addOutsider"),
    );
    assert_eq!(
        bmr_mismatch["error"]["code"], "INVALID_SETUP_DISTRIBUTION",
        "{bmr_mismatch}"
    );
    let bmr_duplicate = propose_create_with_choice(
        &bmr_game,
        json!([
            { "seat": 1, "name": "A", "actualCharacter": "grandmother" },
            { "seat": 2, "name": "B", "actualCharacter": "grandmother" },
            { "seat": 3, "name": "C", "actualCharacter": "chambermaid" },
            { "seat": 4, "name": "D", "actualCharacter": "exorcist" },
            { "seat": 5, "name": "E", "actualCharacter": "tinker" },
            { "seat": 6, "name": "F", "actualCharacter": "godfather" },
            { "seat": 7, "name": "G", "actualCharacter": "zombuul" }
        ]),
        Some("addOutsider"),
    );
    assert_eq!(
        bmr_duplicate["error"]["code"], "DUPLICATE_ACTUAL_CHARACTER",
        "{bmr_duplicate}"
    );
}

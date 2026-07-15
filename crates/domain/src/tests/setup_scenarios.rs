use super::support::*;
use crate::{contracts::SetupDistribution, setup::expected_distribution, *};
use serde_json::{json, Value};

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
        "schemaVersion": 2,
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
        "schemaVersion": 2,
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

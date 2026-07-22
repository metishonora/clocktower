use crate::{propose_json, setup_distribution_json};
use serde_json::{json, Value};

const TOWNSFOLK: [&str; 13] = [
    "clockmaker",
    "dreamer",
    "snakeCharmer",
    "mathematician",
    "flowergirl",
    "townCrier",
    "oracle",
    "savant",
    "seamstress",
    "philosopher",
    "artist",
    "juggler",
    "sage",
];
const OUTSIDERS: [&str; 4] = ["mutant", "sweetheart", "barber", "klutz"];
const MINIONS: [&str; 4] = ["evilTwin", "witch", "cerenovus", "pitHag"];
const DEMONS: [&str; 4] = ["fangGu", "vigormortis", "noDashii", "vortox"];

fn empty_game(script_id: &str) -> Value {
    json!({
        "schemaVersion": 3,
        "game": {
            "id": "game-snv-setup",
            "name": "Sects & Violets setup",
            "scriptId": script_id,
            "createdAt": "2026-07-21T00:00:00.000Z",
            "updatedAt": "2026-07-21T00:00:00.000Z",
            "events": []
        }
    })
}

fn create_game(script_id: &str, character_ids: &[&str]) -> Value {
    let players = character_ids
        .iter()
        .enumerate()
        .map(|(index, character_id)| {
            json!({
                "seat": index + 1,
                "name": format!("Player {}", index + 1),
                "actualCharacter": character_id
            })
        })
        .collect::<Vec<_>>();
    let command = json!({
        "type": "createGame",
        "payload": { "players": players }
    });

    serde_json::from_str(&propose_json(
        &empty_game(script_id).to_string(),
        &command.to_string(),
    ))
    .unwrap()
}

#[test]
fn sects_and_violets_accepts_exactly_the_official_twenty_five_character_ids() {
    let base = [
        "clockmaker",
        "dreamer",
        "snakeCharmer",
        "mathematician",
        "flowergirl",
        "witch",
        "vortox",
    ];

    for (kind, ids, slot) in [
        ("Townsfolk", TOWNSFOLK.as_slice(), 0),
        ("Outsider", OUTSIDERS.as_slice(), 0),
        ("Minion", MINIONS.as_slice(), 5),
        ("Demon", DEMONS.as_slice(), 6),
    ] {
        for character_id in ids {
            let mut characters = base;
            characters[slot] = character_id;
            let actual = create_game("sectsAndViolets", &characters);
            assert_eq!(
                actual["ok"], true,
                "{kind} {character_id} should belong to S&V: {actual}"
            );
        }
    }

    let unknown = create_game(
        "sectsAndViolets",
        &[
            "notACharacter",
            "dreamer",
            "snakeCharmer",
            "mathematician",
            "flowergirl",
            "witch",
            "vortox",
        ],
    );
    assert_eq!(unknown["error"]["code"], "UNKNOWN_CHARACTER");
}

#[test]
fn setup_rejects_character_ids_from_the_other_script() {
    let tb_character_in_snv = create_game(
        "sectsAndViolets",
        &[
            "washerwoman",
            "dreamer",
            "snakeCharmer",
            "mathematician",
            "flowergirl",
            "witch",
            "vortox",
        ],
    );
    assert_eq!(tb_character_in_snv["error"]["code"], "UNKNOWN_CHARACTER");

    let snv_character_in_tb = create_game(
        "troubleBrewing",
        &[
            "clockmaker",
            "chef",
            "empath",
            "fortuneTeller",
            "poisoner",
            "scarletWoman",
            "imp",
        ],
    );
    assert_eq!(snv_character_in_tb["error"]["code"], "UNKNOWN_CHARACTER");
}

#[test]
fn sects_and_violets_supports_seven_to_fifteen_players_only() {
    for player_count in [6, 16] {
        let actual: Value = serde_json::from_str(&setup_distribution_json(
            &json!({
                "scriptId": "sectsAndViolets",
                "playerCount": player_count,
                "actualCharacters": []
            })
            .to_string(),
        ))
        .unwrap();
        assert_eq!(actual["error"]["code"], "INVALID_PLAYER_COUNT");
    }

    for player_count in [7, 15] {
        let actual: Value = serde_json::from_str(&setup_distribution_json(
            &json!({
                "scriptId": "sectsAndViolets",
                "playerCount": player_count,
                "actualCharacters": []
            })
            .to_string(),
        ))
        .unwrap();
        assert_eq!(actual["ok"], true, "{player_count} Players: {actual}");
    }
}

#[test]
fn sects_and_violets_applies_fang_gu_and_vigormortis_setup_adjustments() {
    for (player_count, character, townsfolk, outsider) in [
        (8, "fangGu", 4, 2),
        (8, "vigormortis", 6, 0),
        (7, "vigormortis", 5, 0),
    ] {
        let actual: Value = serde_json::from_str(&setup_distribution_json(
            &json!({
                "scriptId": "sectsAndViolets",
                "playerCount": player_count,
                "actualCharacters": [character]
            })
            .to_string(),
        ))
        .unwrap();

        assert_eq!(actual["value"]["Townsfolk"], townsfolk, "{actual}");
        assert_eq!(actual["value"]["Outsider"], outsider, "{actual}");
        assert_eq!(actual["value"]["Minion"], 1, "{actual}");
        assert_eq!(actual["value"]["Demon"], 1, "{actual}");
    }
}

use crate::{
    characters::{
        custom_ability_acquisition_character_ids, custom_demon_bluff_character_ids,
        custom_transformation_character_ids, resolve_custom_script,
    },
    contracts::CustomScriptDefinition,
    model::StepInputFields,
    phase::{required_characters, validate_character_selection},
    propose_json, replay_json, setup_distribution_json,
};
use serde_json::{json, Value};

fn definition(character_ids: &[&str]) -> Value {
    json!({
        "id": "custom-setup-contract",
        "name": "Custom setup contract",
        "characterIds": character_ids,
    })
}

fn custom_game(character_ids: &[&str], events: Value) -> Value {
    json!({
        "schemaVersion": 4,
        "game": {
            "script": {
                "type": "custom",
                "definition": definition(character_ids),
            },
            "id": "custom-setup-game",
            "name": "Custom setup game",
            "createdAt": "2026-09-04T00:00:00.000Z",
            "updatedAt": "2026-09-04T00:00:00.000Z",
            "events": events,
        }
    })
}

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

fn setup_distribution(
    character_ids: &[&str],
    player_count: usize,
    actual_characters: &[&str],
) -> Value {
    let request = json!({
        "customDefinition": definition(character_ids),
        "playerCount": player_count,
        "actualCharacters": actual_characters,
    });
    serde_json::from_str(&setup_distribution_json(&request.to_string())).unwrap()
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
fn custom_candidate_policy_scopes_bluffs_ability_acquisition_and_transformation() {
    let definition_order = [
        "washerwoman",
        "drunk",
        "clockmaker",
        "baron",
        "pitHag",
        "imp",
        "vortox",
    ];
    let context = resolve_custom_script(&CustomScriptDefinition {
        id: "custom-candidate-contract".into(),
        name: "Custom candidate contract".into(),
        character_ids: definition_order
            .iter()
            .map(|character_id| (*character_id).to_string())
            .collect(),
        first_night_order: None,
    })
    .unwrap();

    assert_eq!(
        custom_demon_bluff_character_ids(
            &context,
            &["washerwoman".to_string(), "baron".to_string()]
        ),
        ["drunk", "clockmaker"]
    );
    assert_eq!(
        custom_ability_acquisition_character_ids(&context),
        ["washerwoman", "drunk", "clockmaker"]
    );
    let transformation = custom_transformation_character_ids(&context);
    assert_eq!(transformation, definition_order);

    let required = required_characters(1, 1, Some(transformation), false);
    let forged = Some(StepInputFields {
        character_ids: Some(vec!["chef".into()]),
        ..StepInputFields::default()
    });
    let error = validate_character_selection(&required, &forged).unwrap_err();
    assert_eq!(error.code, "INVALID_STEP_INPUT");
}

#[test]
fn custom_setup_composes_modifier_deltas_independent_of_definition_and_actual_order() {
    let roster = [
        "washerwoman",
        "chef",
        "clockmaker",
        "dreamer",
        "drunk",
        "baron",
        "vigormortis",
    ];
    let reversed = roster.iter().rev().copied().collect::<Vec<_>>();

    let expected = json!({
        "ok": true,
        "value": {
            "Townsfolk": 4,
            "Outsider": 1,
            "Minion": 1,
            "Demon": 1,
        }
    });

    assert_eq!(setup_distribution(&roster, 7, &roster), expected);
    assert_eq!(setup_distribution(&reversed, 7, &roster), expected);
    assert_eq!(setup_distribution(&roster, 7, &reversed), expected);
    assert_eq!(setup_distribution(&reversed, 7, &reversed), expected);
}

#[test]
fn custom_setup_clamps_outsider_delta_at_zero_and_preserves_player_count() {
    let zero_outsider_roster = [
        "washerwoman",
        "chef",
        "empath",
        "clockmaker",
        "dreamer",
        "witch",
        "vigormortis",
    ];
    let zero = setup_distribution(&zero_outsider_roster, 7, &zero_outsider_roster);
    assert_eq!(
        zero,
        json!({
            "ok": true,
            "value": {
                "Townsfolk": 5,
                "Outsider": 0,
                "Minion": 1,
                "Demon": 1,
            }
        })
    );

    let mixed_roster = [
        "washerwoman",
        "chef",
        "clockmaker",
        "dreamer",
        "drunk",
        "baron",
        "vigormortis",
    ];
    let mixed = setup_distribution(&mixed_roster, 7, &mixed_roster);
    assert_eq!(mixed["value"]["Townsfolk"], 4);
    assert_eq!(mixed["value"]["Outsider"], 1);
    assert_eq!(
        ["Townsfolk", "Outsider", "Minion", "Demon"]
            .iter()
            .map(|kind| mixed["value"][kind].as_u64().unwrap())
            .sum::<u64>(),
        7
    );

    let one_outsider_roster = [
        "washerwoman",
        "chef",
        "empath",
        "clockmaker",
        "dreamer",
        "librarian",
        "witch",
        "vigormortis",
    ];
    let one = setup_distribution(&one_outsider_roster, 8, &one_outsider_roster);
    assert_eq!(one["value"]["Townsfolk"], 6, "{one}");
    assert_eq!(one["value"]["Outsider"], 0, "{one}");
}

#[test]
fn custom_setup_uses_only_actual_modifiers_and_composes_baron_with_fang_gu() {
    let definition_with_unassigned_baron =
        ["washerwoman", "chef", "empath", "poisoner", "baron", "imp"];
    let actual_without_baron = ["washerwoman", "chef", "empath", "poisoner", "imp"];
    assert_eq!(
        setup_distribution(&definition_with_unassigned_baron, 5, &actual_without_baron,),
        json!({
            "ok": true,
            "value": {
                "Townsfolk": 3,
                "Outsider": 0,
                "Minion": 1,
                "Demon": 1,
            }
        })
    );

    let baron_fang_gu = ["drunk", "recluse", "saint", "baron", "fangGu"];
    assert_eq!(
        setup_distribution(&baron_fang_gu, 5, &baron_fang_gu),
        json!({
            "ok": true,
            "value": {
                "Townsfolk": 0,
                "Outsider": 3,
                "Minion": 1,
                "Demon": 1,
            }
        })
    );
}

#[test]
fn custom_setup_request_arms_are_exact_and_mutually_exclusive() {
    let valid = setup_distribution(
        &["washerwoman", "chef", "empath", "poisoner", "imp"],
        5,
        &["washerwoman", "chef", "empath", "poisoner", "imp"],
    );
    assert_eq!(valid["ok"], true, "{valid}");

    let mixed_request = json!({
        "scriptId": "troubleBrewing",
        "customDefinition": definition(&["washerwoman", "chef", "empath", "poisoner", "imp"]),
        "playerCount": 5,
        "actualCharacters": ["washerwoman", "chef", "empath", "poisoner", "imp"],
    });
    let mixed: Value =
        serde_json::from_str(&setup_distribution_json(&mixed_request.to_string())).unwrap();
    assert_eq!(mixed["error"]["code"], "MALFORMED_REQUEST", "{mixed}");
}

#[test]
fn structurally_valid_definition_can_exist_when_a_player_count_roster_is_insufficient() {
    let character_ids = ["washerwoman", "chef", "empath", "poisoner", "baron", "imp"];
    let replayed: Value = serde_json::from_str(&replay_json(
        &custom_game(&character_ids, json!([])).to_string(),
    ))
    .unwrap();
    assert_eq!(
        replayed["ok"], true,
        "the definition should pass structural and registry validation: {replayed}"
    );

    let distribution = setup_distribution(&character_ids, 5, &["baron"]);
    assert_eq!(
        distribution["error"]["code"], "INSUFFICIENT_SETUP_ROSTER",
        "{distribution}"
    );
}

#[test]
fn custom_setup_rejects_actual_and_shown_characters_outside_the_definition() {
    let definition_ids = [
        "washerwoman",
        "librarian",
        "investigator",
        "poisoner",
        "imp",
    ];
    let out_of_scope_distribution = setup_distribution(
        &definition_ids,
        5,
        &["washerwoman", "librarian", "chef", "poisoner", "imp"],
    );
    assert_eq!(
        out_of_scope_distribution["error"]["code"], "CHARACTER_NOT_IN_SCRIPT",
        "{out_of_scope_distribution}"
    );

    let actual_outside = propose_create(
        &custom_game(&definition_ids, json!([])),
        json!([
            { "seat": 1, "name": "Ada", "actualCharacter": "washerwoman" },
            { "seat": 2, "name": "Bert", "actualCharacter": "librarian" },
            { "seat": 3, "name": "Cora", "actualCharacter": "chef" },
            { "seat": 4, "name": "Dev", "actualCharacter": "poisoner" },
            { "seat": 5, "name": "Eve", "actualCharacter": "imp" }
        ]),
    );
    assert_eq!(
        actual_outside["error"]["code"], "CHARACTER_NOT_IN_SCRIPT",
        "{actual_outside}"
    );

    let drunk_definition = ["washerwoman", "drunk", "saint", "baron", "imp"];
    let shown_outside = propose_create(
        &custom_game(&drunk_definition, json!([])),
        json!([
            { "seat": 1, "name": "Ada", "actualCharacter": "washerwoman" },
            { "seat": 2, "name": "Bert", "actualCharacter": "drunk", "shownCharacter": "chef" },
            { "seat": 3, "name": "Cora", "actualCharacter": "saint" },
            { "seat": 4, "name": "Dev", "actualCharacter": "baron" },
            { "seat": 5, "name": "Eve", "actualCharacter": "imp" }
        ]),
    );
    assert_eq!(
        shown_outside["error"]["code"], "CHARACTER_NOT_IN_SCRIPT",
        "{shown_outside}"
    );

    let non_drunk_shown_outside = propose_create(
        &custom_game(&definition_ids, json!([])),
        json!([
            { "seat": 1, "name": "Ada", "actualCharacter": "washerwoman", "shownCharacter": "chef" },
            { "seat": 2, "name": "Bert", "actualCharacter": "librarian" },
            { "seat": 3, "name": "Cora", "actualCharacter": "investigator" },
            { "seat": 4, "name": "Dev", "actualCharacter": "poisoner" },
            { "seat": 5, "name": "Eve", "actualCharacter": "imp" }
        ]),
    );
    assert_eq!(
        non_drunk_shown_outside["error"]["code"], "CHARACTER_NOT_IN_SCRIPT",
        "{non_drunk_shown_outside}"
    );

    let drunk_non_townsfolk = propose_create(
        &custom_game(&drunk_definition, json!([])),
        json!([
            { "seat": 1, "name": "Ada", "actualCharacter": "washerwoman" },
            { "seat": 2, "name": "Bert", "actualCharacter": "drunk", "shownCharacter": "baron" },
            { "seat": 3, "name": "Cora", "actualCharacter": "saint" },
            { "seat": 4, "name": "Dev", "actualCharacter": "baron" },
            { "seat": 5, "name": "Eve", "actualCharacter": "imp" }
        ]),
    );
    assert_eq!(
        drunk_non_townsfolk["error"]["code"], "INVALID_DRUNK_SHOWN_CHARACTER",
        "{drunk_non_townsfolk}"
    );
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

    let custom_ids = [
        "washerwoman",
        "librarian",
        "investigator",
        "chef",
        "poisoner",
        "imp",
    ];
    let custom_mismatch = propose_create(&custom_game(&custom_ids, json!([])), mismatched_players);
    assert_eq!(
        custom_mismatch["error"]["code"], "INVALID_SETUP_DISTRIBUTION",
        "{custom_mismatch}"
    );
    let custom_duplicate = propose_create(&custom_game(&custom_ids, json!([])), duplicate_players);
    assert_eq!(
        custom_duplicate["error"]["code"], "DUPLICATE_ACTUAL_CHARACTER",
        "{custom_duplicate}"
    );
}

#[test]
fn custom_create_game_accepts_an_exact_unique_distribution() {
    let ids = ["washerwoman", "clockmaker", "chef", "witch", "imp"];
    let actual = propose_create(
        &custom_game(&ids, json!([])),
        json!([
            { "seat": 1, "name": "Ada", "actualCharacter": "washerwoman" },
            { "seat": 2, "name": "Bert", "actualCharacter": "clockmaker" },
            { "seat": 3, "name": "Cora", "actualCharacter": "chef" },
            { "seat": 4, "name": "Dev", "actualCharacter": "witch" },
            { "seat": 5, "name": "Eve", "actualCharacter": "imp" }
        ]),
    );

    assert_eq!(actual["ok"], true, "{actual}");
    assert_eq!(actual["value"]["event"]["type"], "setupConfirmed");
    assert_eq!(actual["value"]["warnings"], json!([]));
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

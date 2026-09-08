use super::custom_first_night_fixture::complete_order_json;
use crate::{custom_first_night_plan_json, propose_json, replay_json};
use serde_json::{json, Value};

const MIXED_CHARACTERS: [&str; 18] = [
    "poisoner",
    "washerwoman",
    "librarian",
    "investigator",
    "chef",
    "empath",
    "fortuneTeller",
    "butler",
    "spy",
    "philosopher",
    "snakeCharmer",
    "evilTwin",
    "witch",
    "cerenovus",
    "clockmaker",
    "dreamer",
    "seamstress",
    "mathematician",
];

fn system(action_id: &str) -> Value {
    json!({ "kind": "system", "actionId": action_id })
}

fn character(character_id: &str, action_id: &str) -> Value {
    json!({
        "kind": "character",
        "characterId": character_id,
        "actionId": action_id,
    })
}

fn combined_default() -> Vec<Value> {
    vec![
        system("dusk"),
        character("philosopher", "chooseAbility"),
        system("minionInfo"),
        system("demonInfo"),
        character("poisoner", "choosePoisonTarget"),
        character("snakeCharmer", "choosePlayer"),
        character("evilTwin", "learnTwin"),
        character("witch", "chooseCursedPlayer"),
        character("cerenovus", "assignMadness"),
        character("washerwoman", "learnTownsfolk"),
        character("librarian", "learnOutsider"),
        character("investigator", "learnMinion"),
        character("chef", "learnEvilPairs"),
        character("empath", "learnEvilNeighbors"),
        character("fortuneTeller", "checkDemon"),
        character("butler", "chooseMaster"),
        character("clockmaker", "learnSteps"),
        character("dreamer", "learnCharacters"),
        character("seamstress", "compareAlignments"),
        character("spy", "inspectGrimoire"),
        character("mathematician", "learnCount"),
        system("dawn"),
    ]
}

fn definition(character_ids: &[&str], first_night_order: Option<&[Value]>) -> Value {
    let mut definition = json!({
        "id": "mixed-first-night",
        "name": "Mixed first night",
        "characterIds": character_ids,
    });
    if let Some(order) = first_night_order {
        definition["firstNightOrder"] = Value::Array(order.to_vec());
    }
    definition
}

fn definition_with_fixture_order(character_ids: &[&str]) -> Value {
    let order = complete_order_json(character_ids);
    definition(
        character_ids,
        Some(order.as_array().expect("test plan should be an array")),
    )
}

fn plan_query(definition: Value) -> Value {
    serde_json::from_str(&custom_first_night_plan_json(
        &json!({ "customDefinition": definition }).to_string(),
    ))
    .unwrap()
}

fn empty_game(definition: Value) -> Value {
    json!({
        "schemaVersion": 4,
        "game": {
            "script": { "type": "custom", "definition": definition },
            "id": "custom-first-night-game",
            "name": "Custom first night game",
            "createdAt": "2026-09-04T00:00:00.000Z",
            "updatedAt": "2026-09-04T00:00:00.000Z",
            "events": [],
        }
    })
}

#[test]
fn empty_game_does_not_synthesize_missing_definition_order() {
    let supplied = definition(&["imp"], None);
    let game = empty_game(supplied.clone());

    assert_eq!(game["game"]["script"]["definition"], supplied);

    let replay: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();
    assert_eq!(
        replay["error"]["code"], "MALFORMED_CUSTOM_SCRIPT_DEFINITION",
        "{replay}",
    );
}

fn setup_players() -> Value {
    json!([
        { "seat": 1, "name": "A", "actualCharacter": "washerwoman" },
        { "seat": 2, "name": "B", "actualCharacter": "chef" },
        { "seat": 3, "name": "C", "actualCharacter": "empath" },
        { "seat": 4, "name": "D", "actualCharacter": "clockmaker" },
        { "seat": 5, "name": "E", "actualCharacter": "dreamer" },
        { "seat": 6, "name": "F", "actualCharacter": "witch" },
        { "seat": 7, "name": "G", "actualCharacter": "vortox" }
    ])
}

const SYSTEM_ONLY_CHARACTERS: [&str; 12] = [
    "undertaker",
    "monk",
    "ravenkeeper",
    "virgin",
    "slayer",
    "scarletWoman",
    "imp",
    "soldier",
    "mayor",
    "saint",
    "recluse",
    "drunk",
];

fn system_only_draft() -> Value {
    definition(&SYSTEM_ONLY_CHARACTERS, None)
}

fn system_only_definition() -> Value {
    definition_with_fixture_order(&SYSTEM_ONLY_CHARACTERS)
}

fn system_only_players() -> Value {
    json!([
        { "seat": 1, "name": "A", "actualCharacter": "undertaker" },
        { "seat": 2, "name": "B", "actualCharacter": "monk" },
        { "seat": 3, "name": "C", "actualCharacter": "ravenkeeper" },
        { "seat": 4, "name": "D", "actualCharacter": "virgin" },
        { "seat": 5, "name": "E", "actualCharacter": "slayer" },
        { "seat": 6, "name": "F", "actualCharacter": "scarletWoman" },
        { "seat": 7, "name": "G", "actualCharacter": "imp" }
    ])
}

fn propose_command(game: &Value, command: Value) -> Value {
    serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap()
}

fn create_game(game: &Value) -> Value {
    let payload = json!({ "players": setup_players() });
    serde_json::from_str(&propose_json(
        &game.to_string(),
        &json!({ "type": "createGame", "payload": payload }).to_string(),
    ))
    .unwrap()
}

#[test]
fn combined_default_is_definition_order_independent_and_uses_global_order() {
    let forward = plan_query(definition(&MIXED_CHARACTERS, None));
    let reversed = plan_query(definition(
        &MIXED_CHARACTERS.iter().rev().copied().collect::<Vec<_>>(),
        None,
    ));

    assert_eq!(forward["ok"], true, "{forward}");
    assert_eq!(forward["value"]["source"], "default");
    assert_eq!(forward["value"]["plan"], Value::Array(combined_default()));
    assert_eq!(reversed["value"], forward["value"]);
}

#[test]
fn default_plan_contains_only_actions_from_the_definition_but_not_only_in_play_roles() {
    let first = plan_query(definition(
        &["poisoner", "philosopher", "vortox", "chef"],
        None,
    ));
    assert_eq!(
        first["value"]["plan"],
        json!([
            system("dusk"),
            character("philosopher", "chooseAbility"),
            system("minionInfo"),
            system("demonInfo"),
            character("poisoner", "choosePoisonTarget"),
            character("chef", "learnEvilPairs"),
            system("dawn"),
        ]),
    );

    let system_only = plan_query(system_only_draft());
    assert_eq!(
        system_only["value"]["plan"],
        json!([
            system("dusk"),
            system("minionInfo"),
            system("demonInfo"),
            system("dawn"),
        ]),
    );
}

#[test]
fn explicit_definition_order_wins_and_may_move_evil_information_entries() {
    let mut reordered = combined_default();
    let minion_info = reordered.remove(2);
    let demon_info = reordered.remove(2);
    let dawn = reordered.pop().unwrap();
    reordered.insert(1, demon_info);
    reordered.insert(7, minion_info);
    reordered.push(dawn);

    let actual = plan_query(definition(&MIXED_CHARACTERS, Some(&reordered)));
    assert_eq!(actual["ok"], true, "{actual}");
    assert_eq!(actual["value"]["source"], "definition");
    assert_eq!(actual["value"]["plan"], Value::Array(reordered));
}

#[test]
fn plan_validation_rejects_missing_duplicate_unknown_mismatch_and_bad_boundaries() {
    let valid = combined_default();
    let mut cases: Vec<(&str, Vec<Value>)> = Vec::new();

    let mut missing = valid.clone();
    missing.retain(|entry| entry != &character("chef", "learnEvilPairs"));
    cases.push(("missing", missing));

    let mut duplicate = valid.clone();
    duplicate.insert(2, character("philosopher", "chooseAbility"));
    cases.push(("duplicate", duplicate));

    let mut unknown = valid.clone();
    unknown.insert(2, character("notACharacter", "doSomething"));
    cases.push(("unknown", unknown));

    let mut mismatch = valid.clone();
    let chef = mismatch
        .iter_mut()
        .find(|entry| entry["characterId"] == "chef")
        .unwrap();
    chef["actionId"] = json!("learnTownsfolk");
    cases.push(("mismatch", mismatch));

    let mut bad_boundary = valid.clone();
    bad_boundary.swap(0, 1);
    cases.push(("boundary", bad_boundary));

    for (name, plan) in cases {
        let actual = plan_query(definition(&MIXED_CHARACTERS, Some(&plan)));
        assert_eq!(
            actual["error"]["code"], "INVALID_FIRST_NIGHT_ORDER_PLAN",
            "{name}: {actual}",
        );
    }
}

#[test]
fn setup_event_contains_roster_only_without_mutating_definition() {
    let mut pool = MIXED_CHARACTERS.to_vec();
    pool.push("vortox");
    let definition = definition_with_fixture_order(&pool);
    let game = empty_game(definition.clone());

    let proposed = create_game(&game);
    assert_eq!(proposed["ok"], true, "{proposed}");
    assert_eq!(
        proposed["value"]["event"]["payload"]["players"]
            .as_array()
            .expect("setup event players should be an array")
            .iter()
            .map(|player| (player["seat"].clone(), player["actualCharacter"].clone()))
            .collect::<Vec<_>>(),
        setup_players()
            .as_array()
            .expect("setup players should be an array")
            .iter()
            .map(|player| (player["seat"].clone(), player["actualCharacter"].clone()))
            .collect::<Vec<_>>(),
    );
    assert!(proposed["value"]["event"]["payload"]
        .get("firstNightOrderPlan")
        .is_none());
    assert_eq!(game["game"]["script"]["definition"], definition.clone());
}

#[test]
fn definition_order_controls_custom_replay_and_setup_does_not_override_it() {
    let definition = definition(
        &[
            "undertaker",
            "monk",
            "ravenkeeper",
            "virgin",
            "slayer",
            "scarletWoman",
            "imp",
            "soldier",
            "mayor",
            "saint",
            "recluse",
            "drunk",
        ],
        Some(&[
            system("dusk"),
            system("demonInfo"),
            system("minionInfo"),
            system("dawn"),
        ]),
    );
    let mut game = empty_game(definition);
    let create = propose_command(
        &game,
        json!({ "type": "createGame", "payload": { "players": system_only_players() } }),
    );
    assert_eq!(create["ok"], true, "{create}");
    assert_eq!(
        create["value"]["event"]["payload"]
            .get("firstNightOrderPlan")
            .is_none(),
        true,
    );
    game["game"]["events"] = json!([create["value"]["event"].clone()]);
    let replay: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();
    assert_eq!(replay["ok"], true, "{replay}",);
    assert_eq!(
        replay["value"]["currentStep"]["id"],
        "firstNight:system:demonInfo",
    );
}

#[test]
fn removed_setup_plan_is_rejected_in_commands_and_events_even_when_null() {
    let mut pool = MIXED_CHARACTERS.to_vec();
    pool.push("vortox");
    let game = empty_game(definition_with_fixture_order(&pool));
    let mut invalid = combined_default();
    invalid.retain(|entry| entry != &system("minionInfo"));

    for legacy_value in [Value::Array(invalid.clone()), Value::Null] {
        let command = json!({
            "type": "createGame",
            "payload": {
                "players": setup_players(),
                "firstNightOrderPlan": legacy_value,
            },
        });
        let proposal = propose_command(&game, command);
        assert_eq!(proposal["error"]["code"], "MALFORMED_COMMAND", "{proposal}");

        let mut imported = game.clone();
        imported["game"]["events"] = json!([{
            "id": "setup-1",
            "type": "setupConfirmed",
            "phase": "setup",
            "payload": {
                "players": setup_players(),
                "firstNightOrderPlan": legacy_value,
            },
            "summary": "초기 설정 확정: 7명",
            "createdAt": "2026-09-04T00:00:00.000Z",
        }]);
        let replay: Value = serde_json::from_str(&replay_json(&imported.to_string())).unwrap();
        assert_eq!(replay["error"]["code"], "MALFORMED_EVENT", "{replay}");
    }
}

#[test]
fn system_only_custom_game_replays_progress_and_event_removal_deterministically() {
    let mut game = empty_game(system_only_definition());
    let create = propose_command(
        &game,
        json!({ "type": "createGame", "payload": { "players": system_only_players() } }),
    );
    assert_eq!(create["ok"], true, "{create}");
    assert!(create["value"]["event"]["payload"]
        .get("firstNightOrderPlan")
        .is_none());
    game["game"]["events"] = json!([create["value"]["event"].clone()]);

    let after_setup: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();
    assert_eq!(after_setup["ok"], true, "{after_setup}");
    assert_eq!(after_setup["value"]["script"]["type"], "custom");
    assert_eq!(after_setup["value"]["phase"], "firstNight");
    assert_eq!(
        after_setup["value"]["currentStep"]["id"],
        "firstNight:system:minionInfo",
    );
    assert_eq!(
        after_setup["value"]["phaseOverview"]
            .as_array()
            .unwrap()
            .len(),
        3
    );

    let minion = propose_command(
        &game,
        json!({
            "type": "confirmStep",
            "payload": { "stepId": "firstNight:system:minionInfo", "expectedEventCount": 1 }
        }),
    );
    assert_eq!(minion["ok"], true, "{minion}");
    assert_eq!(
        minion["value"]["event"]["payload"]["actionRef"],
        system("minionInfo"),
    );
    game["game"]["events"]
        .as_array_mut()
        .unwrap()
        .push(minion["value"]["event"].clone());

    let after_minion: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();
    assert_eq!(
        after_minion["value"]["currentStep"]["id"],
        "firstNight:system:demonInfo",
    );

    let demon = propose_command(
        &game,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "firstNight:system:demonInfo",
                "expectedEventCount": 2,
                "input": { "characterIds": ["soldier", "mayor", "saint"] }
            }
        }),
    );
    assert_eq!(demon["ok"], true, "{demon}");
    game["game"]["events"]
        .as_array_mut()
        .unwrap()
        .push(demon["value"]["event"].clone());

    let after_demon: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();
    assert_eq!(
        after_demon["value"]["currentStep"]["id"],
        "firstNight:system:dawn"
    );

    let dawn = propose_command(
        &game,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "firstNight:system:dawn",
                "expectedEventCount": 3
            }
        }),
    );
    assert_eq!(dawn["ok"], true, "{dawn}");
    game["game"]["events"]
        .as_array_mut()
        .unwrap()
        .push(dawn["value"]["event"].clone());
    let day: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();
    assert_eq!(day["value"]["phase"], "day", "{day}");
    assert!(day["value"]["currentStep"].is_null());

    game["game"]["events"].as_array_mut().unwrap().pop();
    let after_dawn_undo: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();
    assert_eq!(after_dawn_undo["value"], after_demon["value"]);

    game["game"]["events"].as_array_mut().unwrap().pop();
    let after_undo: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();
    assert_eq!(
        after_undo["value"]["currentStep"],
        after_minion["value"]["currentStep"]
    );
    assert_eq!(
        after_undo["value"]["phaseOverview"],
        after_minion["value"]["phaseOverview"]
    );
}

#[test]
fn custom_boundary_rejects_stale_system_steps_and_forged_action_provenance() {
    let mut game = empty_game(system_only_definition());
    let create = propose_command(
        &game,
        json!({ "type": "createGame", "payload": { "players": system_only_players() } }),
    );
    game["game"]["events"] = json!([create["value"]["event"].clone()]);

    let stale = propose_command(
        &game,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "firstNight:system:demonInfo",
                "expectedEventCount": 1,
                "input": { "characterIds": ["soldier", "mayor", "saint"] }
            }
        }),
    );
    assert_eq!(stale["error"]["code"], "STALE_STEP", "{stale}");

    game["game"]["events"].as_array_mut().unwrap().push(json!({
        "id": "first-night-2",
        "type": "phaseStepConfirmed",
        "phase": "firstNight",
        "payload": {
            "stepId": "firstNight:system:minionInfo",
            "actionRef": system("demonInfo"),
        },
        "summary": "악의 팀 정보 확인",
        "createdAt": "2026-09-04T00:00:00.000Z",
    }));
    let forged: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();
    assert_eq!(
        forged["error"]["code"], "INVALID_FIRST_NIGHT_ACTION_PROVENANCE",
        "{forged}",
    );
}

#[test]
fn custom_definition_plan_replays_while_official_setup_shape_stays_exact() {
    let mut pool = MIXED_CHARACTERS.to_vec();
    pool.push("vortox");
    let game = empty_game(definition_with_fixture_order(&pool));
    let proposal = create_game(&game);
    assert_eq!(proposal["ok"], true, "{proposal}");

    let mut with_setup = game.clone();
    with_setup["game"]["events"] = json!([proposal["value"]["event"].clone()]);
    let custom_replay: Value = serde_json::from_str(&replay_json(&with_setup.to_string())).unwrap();
    #[cfg(not(feature = "custom-runtime-fixtures"))]
    {
        assert_eq!(custom_replay["ok"], true, "{custom_replay}");
        assert_eq!(
            custom_replay["value"]["currentStep"]["actionRef"]["actionId"],
            "prepareInformation"
        );
    }
    #[cfg(feature = "custom-runtime-fixtures")]
    assert_eq!(
        custom_replay["error"]["code"],
        "FIRST_NIGHT_ACTION_HANDLER_UNAVAILABLE"
    );
}

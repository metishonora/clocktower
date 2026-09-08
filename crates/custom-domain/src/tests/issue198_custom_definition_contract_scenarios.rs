use crate::{custom_first_night_plan_json, propose_json, replay_json};
use serde_json::{json, Value};

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

fn valid_plan() -> Value {
    json!([
        system("dusk"),
        system("minionInfo"),
        system("demonInfo"),
        character("washerwoman", "learnTownsfolk"),
        character("clockmaker", "learnSteps"),
        system("dawn"),
    ])
}

fn definition(plan: Option<Value>) -> Value {
    let mut definition = json!({
        "id": "issue-198-definition",
        "name": "Issue 198 definition",
        "characterIds": ["washerwoman", "clockmaker", "imp"],
    });
    if let Some(plan) = plan {
        definition["firstNightOrder"] = plan;
    }
    definition
}

fn custom_game(definition: Value) -> Value {
    json!({
        "schemaVersion": 4,
        "game": {
            "script": { "type": "custom", "definition": definition },
            "id": "issue-198-game",
            "name": "Issue 198 game",
            "createdAt": "2026-09-07T00:00:00.000Z",
            "updatedAt": "2026-09-07T00:00:00.000Z",
            "events": [],
        }
    })
}

fn setup_definition() -> Value {
    json!({
        "id": "issue-198-setup-definition",
        "name": "Issue 198 setup definition",
        "characterIds": [
            "washerwoman",
            "clockmaker",
            "chef",
            "drunk",
            "poisoner",
            "imp",
        ],
        "firstNightOrder": [
            system("dusk"),
            system("minionInfo"),
            system("demonInfo"),
            character("washerwoman", "learnTownsfolk"),
            character("clockmaker", "learnSteps"),
            character("chef", "learnEvilPairs"),
            character("poisoner", "choosePoisonTarget"),
            system("dawn"),
        ],
    })
}

fn setup_players() -> Value {
    json!([
        { "seat": 1, "name": "A", "actualCharacter": "washerwoman" },
        { "seat": 2, "name": "B", "actualCharacter": "clockmaker" },
        { "seat": 3, "name": "C", "actualCharacter": "chef" },
        {
            "seat": 4,
            "name": "D",
            "actualCharacter": "drunk",
            "shownCharacter": "washerwoman",
        },
        { "seat": 5, "name": "E", "actualCharacter": "imp" },
        { "seat": 6, "name": "F", "actualCharacter": "poisoner" },
    ])
}

fn authoring_query(definition: Value) -> Value {
    serde_json::from_str(&custom_first_night_plan_json(
        &json!({ "customDefinition": definition }).to_string(),
    ))
    .expect("custom first-night plan result should be JSON")
}

#[test]
fn issue198_complete_custom_definition_requires_first_night_order() {
    let result: Value =
        serde_json::from_str(&replay_json(&custom_game(definition(None)).to_string()))
            .expect("replay result should be JSON");

    assert_eq!(
        result["error"]["code"], "MALFORMED_CUSTOM_SCRIPT_DEFINITION",
        "{result}"
    );
}

#[test]
fn issue198_complete_definition_rejects_missing_duplicate_unknown_and_mismatched_actions() {
    let valid = valid_plan();
    let mut missing = valid.clone();
    missing
        .as_array_mut()
        .expect("plan should be an array")
        .retain(|entry| entry != &character("clockmaker", "learnSteps"));

    let mut duplicate = valid.clone();
    duplicate
        .as_array_mut()
        .expect("plan should be an array")
        .insert(1, system("dusk"));

    let mut unknown = valid.clone();
    unknown
        .as_array_mut()
        .expect("plan should be an array")
        .insert(1, character("notACharacter", "doSomething"));

    let mut mismatch = valid;
    mismatch
        .as_array_mut()
        .expect("plan should be an array")
        .iter_mut()
        .find(|entry| entry["characterId"] == "clockmaker")
        .expect("clockmaker action should be present")["actionId"] = json!("learnCount");

    for plan in [missing, duplicate, unknown, mismatch] {
        let result: Value = serde_json::from_str(&replay_json(
            &custom_game(definition(Some(plan))).to_string(),
        ))
        .expect("replay result should be JSON");
        assert_eq!(
            result["error"]["code"], "INVALID_FIRST_NIGHT_ORDER_PLAN",
            "{result}"
        );
    }
}

#[test]
fn issue198_authoring_draft_keeps_optional_order_and_deterministic_default() {
    let default_result = authoring_query(definition(None));
    assert_eq!(default_result["ok"], true, "{default_result}");
    assert_eq!(
        default_result["value"]["source"], "default",
        "{default_result}"
    );
    assert_eq!(
        default_result["value"]["plan"],
        valid_plan(),
        "{default_result}"
    );

    let explicit_plan = json!([
        system("dusk"),
        character("clockmaker", "learnSteps"),
        system("demonInfo"),
        character("washerwoman", "learnTownsfolk"),
        system("minionInfo"),
        system("dawn"),
    ]);
    let explicit_result = authoring_query(definition(Some(explicit_plan.clone())));
    assert_eq!(explicit_result["ok"], true, "{explicit_result}");
    assert_eq!(
        explicit_result["value"]["source"], "definition",
        "{explicit_result}"
    );
    assert_eq!(
        explicit_result["value"]["plan"], explicit_plan,
        "{explicit_result}"
    );
}

#[test]
fn issue198_setup_persists_roster_only_and_rejects_removed_plan_fields() {
    let game = custom_game(setup_definition());
    let create_command = json!({
        "type": "createGame",
        "payload": { "players": setup_players() },
    });
    let created: Value = serde_json::from_str(&propose_json(
        &game.to_string(),
        &create_command.to_string(),
    ))
    .expect("create-game result should be JSON");
    assert_eq!(created["ok"], true, "{created}");
    assert!(created["value"]["event"]["payload"]
        .get("firstNightOrderPlan")
        .is_none());

    for legacy_value in [valid_plan(), Value::Null] {
        let command = json!({
            "type": "createGame",
            "payload": {
                "players": setup_players(),
                "firstNightOrderPlan": legacy_value.clone(),
            },
        });
        let malformed_command: Value =
            serde_json::from_str(&propose_json(&game.to_string(), &command.to_string()))
                .expect("malformed command result should be JSON");
        assert_eq!(
            malformed_command["error"]["code"], "MALFORMED_COMMAND",
            "{malformed_command}",
        );

        let mut imported = game.clone();
        imported["game"]["events"] = json!([{
            "id": "setup-1",
            "type": "setupConfirmed",
            "phase": "setup",
            "payload": {
                "players": setup_players(),
                "firstNightOrderPlan": legacy_value,
            },
            "summary": "초기 설정 확정: 5명",
            "createdAt": "2026-09-07T00:00:00.000Z",
        }]);
        let malformed_event: Value = serde_json::from_str(&replay_json(&imported.to_string()))
            .expect("malformed event result should be JSON");
        assert_eq!(
            malformed_event["error"]["code"], "MALFORMED_EVENT",
            "{malformed_event}",
        );
    }
}

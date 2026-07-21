use super::support::*;
use crate::{propose_json, replay_json, suggest_phase_input_json};
use serde_json::{json, Value};
use std::collections::HashSet;

fn players() -> Value {
    json!([
        { "id": "player-1", "seat": 1, "name": "Ada", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
        { "id": "player-2", "seat": 2, "name": "Bert", "actualCharacter": "librarian", "shownCharacter": "librarian" },
        { "id": "player-3", "seat": 3, "name": "Cora", "actualCharacter": "investigator", "shownCharacter": "investigator" },
        { "id": "player-4", "seat": 4, "name": "Dev", "actualCharacter": "chef", "shownCharacter": "chef" },
        { "id": "player-5", "seat": 5, "name": "Eve", "actualCharacter": "drunk", "shownCharacter": "empath" },
        { "id": "player-6", "seat": 6, "name": "Fay", "actualCharacter": "baron", "shownCharacter": "baron" },
        { "id": "player-7", "seat": 7, "name": "Gus", "actualCharacter": "imp", "shownCharacter": "imp" }
    ])
}

fn game(events: Vec<Value>) -> Value {
    game_with_events(Value::Array(events))
}

fn response(game: &Value, request: Value) -> Value {
    serde_json::from_str(&suggest_phase_input_json(
        &game.to_string(),
        &request.to_string(),
    ))
    .unwrap()
}

#[test]
fn suggestion_query_returns_complete_deterministic_inputs_without_event_or_reveal() {
    let demon_game = game(vec![
        setup_event_with_players(players()),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
    ]);
    let request = json!({ "stepId": "firstNight:demonInfo", "choiceToken": 7 });
    let demon = response(&demon_game, request.clone());
    let repeated = response(&demon_game, request);
    assert_eq!(demon, repeated);
    assert_eq!(demon["ok"], true);
    assert_eq!(
        demon["value"]["input"]["characterIds"]
            .as_array()
            .unwrap()
            .len(),
        3
    );
    assert!(demon["value"].get("event").is_none());
    assert!(demon["value"].get("revealPayload").is_none());

    let washerwoman_game = game(vec![
        setup_event_with_players(players()),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
    ]);
    let washerwoman = response(
        &washerwoman_game,
        json!({ "stepId": "firstNight:washerwoman", "choiceToken": 0 }),
    );
    assert_eq!(
        washerwoman["value"]["input"]["playerIds"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
    assert!(washerwoman["value"]["input"]["characterId"].is_string());

    let librarian_game = game(vec![
        setup_event_with_players(players()),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event_with_input(
            "phaseStepConfirmed",
            "firstNight:washerwoman",
            json!({ "playerIds": ["player-1", "player-4"], "characterId": "washerwoman" }),
        ),
    ]);
    let librarian = response(
        &librarian_game,
        json!({ "stepId": "firstNight:librarian", "choiceToken": 0 }),
    );
    assert_eq!(librarian["value"]["input"]["characterId"], "drunk");
    assert!(librarian["value"]["input"]["playerIds"]
        .as_array()
        .unwrap()
        .contains(&json!("player-5")));

    let investigator_game = game(vec![
        setup_event_with_players(players()),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event_with_input(
            "phaseStepConfirmed",
            "firstNight:washerwoman",
            json!({ "playerIds": ["player-1", "player-4"], "characterId": "washerwoman" }),
        ),
        phase_event_with_input(
            "phaseStepConfirmed",
            "firstNight:librarian",
            json!({ "playerIds": ["player-4", "player-5"], "characterId": "drunk" }),
        ),
    ]);
    let investigator = response(
        &investigator_game,
        json!({ "stepId": "firstNight:investigator", "choiceToken": 0 }),
    );
    assert_eq!(investigator["value"]["input"]["characterId"], "baron");
    assert!(investigator["value"]["input"]["playerIds"]
        .as_array()
        .unwrap()
        .contains(&json!("player-6")));
}

#[test]
fn suggestion_uses_actual_characters_and_impaired_steps_can_receive_false_information_or_zero() {
    let impaired_players = json!([
        { "id": "player-1", "seat": 1, "name": "Ada", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
        { "id": "player-2", "seat": 2, "name": "Bert", "actualCharacter": "librarian", "shownCharacter": "librarian" },
        { "id": "player-3", "seat": 3, "name": "Cora", "actualCharacter": "drunk", "shownCharacter": "investigator" },
        { "id": "player-4", "seat": 4, "name": "Dev", "actualCharacter": "chef", "shownCharacter": "chef" },
        { "id": "player-5", "seat": 5, "name": "Eve", "actualCharacter": "empath", "shownCharacter": "empath" },
        { "id": "player-6", "seat": 6, "name": "Fay", "actualCharacter": "baron", "shownCharacter": "baron" },
        { "id": "player-7", "seat": 7, "name": "Gus", "actualCharacter": "imp", "shownCharacter": "imp" }
    ]);
    let investigator_game = game(vec![
        setup_event_with_players(impaired_players),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event_with_input(
            "phaseStepConfirmed",
            "firstNight:washerwoman",
            json!({ "playerIds": ["player-1", "player-2"], "characterId": "washerwoman" }),
        ),
        phase_event_with_input(
            "phaseStepConfirmed",
            "firstNight:librarian",
            json!({ "playerIds": ["player-2", "player-3"], "characterId": "drunk" }),
        ),
    ]);
    let actual = response(
        &investigator_game,
        json!({ "stepId": "firstNight:investigator", "choiceToken": 0 }),
    );
    assert_eq!(actual["value"]["input"]["characterId"], "poisoner");
    assert_eq!(
        actual["value"]["input"]["playerIds"],
        json!(["player-1", "player-2"])
    );

    let drunk_librarian_players = json!([
        { "id": "player-1", "seat": 1, "name": "Ada", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
        { "id": "player-2", "seat": 2, "name": "Bert", "actualCharacter": "drunk", "shownCharacter": "librarian" },
        { "id": "player-3", "seat": 3, "name": "Cora", "actualCharacter": "investigator", "shownCharacter": "investigator" },
        { "id": "player-4", "seat": 4, "name": "Dev", "actualCharacter": "chef", "shownCharacter": "chef" },
        { "id": "player-5", "seat": 5, "name": "Eve", "actualCharacter": "baron", "shownCharacter": "baron" },
        { "id": "player-6", "seat": 6, "name": "Fay", "actualCharacter": "imp", "shownCharacter": "imp" }
    ]);
    let librarian_game = game(vec![
        setup_event_with_players(drunk_librarian_players),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event_with_input(
            "phaseStepConfirmed",
            "firstNight:washerwoman",
            json!({ "playerIds": ["player-1", "player-4"], "characterId": "washerwoman" }),
        ),
    ]);
    let zero = response(
        &librarian_game,
        json!({ "stepId": "firstNight:librarian", "choiceToken": 0 }),
    );
    assert_eq!(zero["value"]["input"], json!({ "zeroOutsiders": true }));
}

#[test]
fn suggestion_excludes_semantically_identical_current_input_and_returns_stable_errors() {
    let current = game(vec![
        setup_event_with_players(players()),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
    ]);
    let first = response(
        &current,
        json!({ "stepId": "firstNight:washerwoman", "choiceToken": 0 }),
    );
    let first_input = first["value"]["input"].clone();
    let mut reversed = first_input.clone();
    reversed["playerIds"].as_array_mut().unwrap().reverse();
    let second = response(
        &current,
        json!({
            "stepId": "firstNight:washerwoman",
            "currentInput": reversed,
            "choiceToken": 0
        }),
    );
    assert_ne!(second["value"]["input"], first_input);

    let stale = response(
        &current,
        json!({ "stepId": "firstNight:librarian", "choiceToken": 0 }),
    );
    assert_eq!(stale["error"]["code"], "STALE_STEP");

    let unsupported_game = game(vec![setup_event_with_players(players())]);
    let unsupported = response(
        &unsupported_game,
        json!({ "stepId": "firstNight:minionInfo", "choiceToken": 0 }),
    );
    assert_eq!(unsupported["error"]["code"], "UNSUPPORTED_DRAFT_SUGGESTION");

    let no_current: Value = serde_json::from_str(&suggest_phase_input_json(
        EMPTY_GAME,
        r#"{ "stepId": "firstNight:demonInfo", "choiceToken": 0 }"#,
    ))
    .unwrap();
    assert_eq!(no_current["error"]["code"], "NO_CURRENT_STEP");

    let malformed: Value = serde_json::from_str(&suggest_phase_input_json(
        &current.to_string(),
        r#"{ "stepId": "firstNight:washerwoman" }"#,
    ))
    .unwrap();
    assert_eq!(malformed["error"]["code"], "MALFORMED_REQUEST");
}

#[test]
fn setup_info_suggestions_never_pair_duplicate_player_ids_and_remain_confirmable() {
    let duplicate_id_players = json!([
        { "id": "duplicate", "seat": 1, "name": "Ada", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
        { "id": "duplicate", "seat": 2, "name": "Bert", "actualCharacter": "chef", "shownCharacter": "chef" },
        { "id": "player-3", "seat": 3, "name": "Cora", "actualCharacter": "empath", "shownCharacter": "empath" },
        { "id": "player-4", "seat": 4, "name": "Dev", "actualCharacter": "poisoner", "shownCharacter": "poisoner" },
        { "id": "player-5", "seat": 5, "name": "Eve", "actualCharacter": "imp", "shownCharacter": "imp" }
    ]);
    let current = game(vec![
        setup_event_with_players(duplicate_id_players),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event_with_input(
            "phaseStepConfirmed",
            "firstNight:poisoner",
            json!({ "playerIds": ["player-3"] }),
        ),
    ]);
    let suggested = response(
        &current,
        json!({ "stepId": "firstNight:washerwoman", "choiceToken": 0 }),
    );
    let input = suggested["value"]["input"].clone();
    let player_ids = input["playerIds"].as_array().unwrap();
    assert_eq!(player_ids.len(), 2);
    assert_ne!(player_ids[0], player_ids[1]);

    let command = json!({
        "type": "confirmStep",
        "payload": {
            "stepId": "firstNight:washerwoman",
            "input": input
        }
    });
    let confirmed: Value =
        serde_json::from_str(&propose_json(&current.to_string(), &command.to_string())).unwrap();
    assert_eq!(confirmed["ok"], true);
}

#[test]
fn duplicate_only_player_ids_return_public_no_valid_suggestion_error() {
    let duplicate_only_players = json!([
        { "id": "duplicate", "seat": 1, "name": "Ada", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
        { "id": "duplicate", "seat": 2, "name": "Bert", "actualCharacter": "chef", "shownCharacter": "chef" },
        { "id": "duplicate", "seat": 3, "name": "Cora", "actualCharacter": "empath", "shownCharacter": "empath" },
        { "id": "duplicate", "seat": 4, "name": "Dev", "actualCharacter": "poisoner", "shownCharacter": "poisoner" },
        { "id": "duplicate", "seat": 5, "name": "Eve", "actualCharacter": "imp", "shownCharacter": "imp" }
    ]);
    let current = game(vec![
        setup_event_with_players(duplicate_only_players),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event_with_input(
            "phaseStepConfirmed",
            "firstNight:poisoner",
            json!({ "playerIds": ["duplicate"] }),
        ),
    ]);
    let suggested = response(
        &current,
        json!({ "stepId": "firstNight:washerwoman", "choiceToken": 0 }),
    );
    assert_eq!(suggested["error"]["code"], "NO_VALID_DRAFT_SUGGESTION");
    assert_eq!(
        suggested["error"]["messageKo"],
        "무작위 추천을 만들 수 없습니다. 실제 캐릭터 배정과 현재 단계 조건을 확인하세요."
    );
}

#[test]
fn poisoned_setup_information_uses_the_full_ability_shaped_pool() {
    let poisoned_players = json!([
        { "id": "player-1", "seat": 1, "name": "Ada", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
        { "id": "player-2", "seat": 2, "name": "Bert", "actualCharacter": "chef", "shownCharacter": "chef" },
        { "id": "player-3", "seat": 3, "name": "Cora", "actualCharacter": "empath", "shownCharacter": "empath" },
        { "id": "player-4", "seat": 4, "name": "Dev", "actualCharacter": "poisoner", "shownCharacter": "poisoner" },
        { "id": "player-5", "seat": 5, "name": "Eve", "actualCharacter": "imp", "shownCharacter": "imp" }
    ]);
    let current = game(vec![
        setup_event_with_players(poisoned_players),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event_with_input(
            "phaseStepConfirmed",
            "firstNight:poisoner",
            json!({ "playerIds": ["player-1"] }),
        ),
    ]);
    let replayed: Value = serde_json::from_str(&replay_json(&current.to_string())).unwrap();
    assert_eq!(
        replayed["value"]["currentStep"]["informationPrompt"]["activeReasons"][0]["type"],
        "poisoned"
    );

    let suggested_character_ids = (0..130)
        .map(|choice_token| {
            response(
                &current,
                json!({
                    "stepId": "firstNight:washerwoman",
                    "choiceToken": choice_token
                }),
            )["value"]["input"]["characterId"]
                .as_str()
                .unwrap()
                .to_string()
        })
        .collect::<HashSet<_>>();
    assert_eq!(
        suggested_character_ids,
        HashSet::from([
            "washerwoman".to_string(),
            "librarian".to_string(),
            "investigator".to_string(),
            "chef".to_string(),
            "empath".to_string(),
            "fortuneTeller".to_string(),
            "undertaker".to_string(),
            "monk".to_string(),
            "ravenkeeper".to_string(),
            "virgin".to_string(),
            "slayer".to_string(),
            "soldier".to_string(),
            "mayor".to_string(),
        ])
    );
}

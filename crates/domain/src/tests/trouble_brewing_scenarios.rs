use super::support::*;
use crate::*;
use serde_json::{json, Value};

#[test]
fn replay_returns_required_input_shape_for_player_selection_steps() {
    let game = game_with_events(json!([
        setup_event(),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo")
    ]));

    let actual: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();

    assert_eq!(actual["ok"], true);
    assert_eq!(
        actual["value"]["currentStep"]["id"],
        "firstNight:washerwoman"
    );
    assert_eq!(
        actual["value"]["currentStep"]["requiredInput"]["target"],
        "players"
    );
    assert_eq!(
        actual["value"]["currentStep"]["requiredInput"]["minSelections"],
        2
    );
    assert_eq!(
        actual["value"]["currentStep"]["requiredInput"]["maxSelections"],
        2
    );
}

#[test]
fn replay_derives_fixed_information_prompt_for_current_chef_step() {
    let game = game_with_events(json!([
        setup_event(),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event("phaseStepConfirmed", "firstNight:washerwoman")
    ]));

    let actual: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();

    assert_eq!(actual["ok"], true);
    assert_eq!(actual["value"]["currentStep"]["id"], "firstNight:chef");
    assert_eq!(
        actual["value"]["currentStep"]["informationPrompt"],
        json!({
            "computedResult": { "kind": "number", "value": 0 },
            "deliveryMode": "fixed",
            "activeReasons": [],
            "registrationCandidatePlayerIds": [],
            "numberChoices": [
                { "value": 0, "isComputed": true, "registrationJudgments": [] }
            ],
            "setupInfoRegistrationOptions": []
        })
    );
}

#[test]
fn confirming_chef_step_returns_reveal_payload() {
    let game = game_with_events(json!([
        setup_event(),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event("phaseStepConfirmed", "firstNight:washerwoman")
    ]));
    let command = json!({
        "type": "confirmStep",
        "payload": { "stepId": "firstNight:chef" }
    });

    let actual: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

    assert_eq!(actual["ok"], true);
    assert_eq!(
        actual["value"]["revealPayload"]["messageKo"],
        "서로 이웃한 악 팀 쌍은 0쌍입니다."
    );
    assert_eq!(
        actual["value"]["revealPayload"]["labelKo"],
        "서로 이웃한 악한 팀 쌍"
    );
    assert_eq!(actual["value"]["revealPayload"]["valueKo"], "0쌍");
    assert_eq!(
        actual["value"]["event"]["summary"],
        "요리사가 0쌍을 확인했습니다."
    );
    assert_eq!(
        actual["value"]["event"]["payload"]["information"],
        json!({
            "actor": { "playerId": "player-2", "characterId": "chef" },
            "targetPlayerIds": [],
            "computedResult": { "kind": "number", "value": 0 },
            "deliveredResult": { "kind": "number", "value": 0 },
            "deliveryContext": { "type": "fixed" }
        })
    );

    let mut events = game["game"]["events"].as_array().unwrap().clone();
    events.push(actual["value"]["event"].clone());
    let replayed: Value = serde_json::from_str(&replay_json(
        &game_with_events(Value::Array(events)).to_string(),
    ))
    .unwrap();
    assert_eq!(replayed["ok"], true);
}

#[test]
fn confirming_washerwoman_information_logs_and_reveals_selected_setup_info() {
    let game = game_with_events(json!([
        setup_event(),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo")
    ]));
    let command = json!({
        "type": "confirmStep",
        "payload": {
            "stepId": "firstNight:washerwoman",
            "input": {
                "playerIds": ["player-1", "player-2"],
                "characterId": "chef"
            }
        }
    });

    let actual: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

    assert_eq!(actual["ok"], true);
    assert_eq!(
        actual["value"]["event"]["payload"]["input"]["characterId"],
        "chef"
    );
    assert_eq!(
        actual["value"]["event"]["summary"],
        "세탁부 정보 확정: 1번 Ada, 2번 Bert 중 요리사"
    );
    assert_eq!(
        actual["value"]["revealPayload"]["messageKo"],
        "세탁부 정보: 1번 Ada 또는 2번 Bert 중 한 명은 요리사입니다."
    );
    assert!(actual["value"]["revealPayload"].get("labelKo").is_none());
    assert!(actual["value"]["revealPayload"].get("valueKo").is_none());
}

#[test]
fn confirming_washerwoman_information_rejects_character_not_represented_by_candidates() {
    let game = game_with_events(json!([
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Ada", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
            { "id": "player-2", "seat": 2, "name": "Bert", "actualCharacter": "drunk", "shownCharacter": "chef" },
            { "id": "player-3", "seat": 3, "name": "Cora", "actualCharacter": "empath", "shownCharacter": "empath" },
            { "id": "player-4", "seat": 4, "name": "Dev", "actualCharacter": "fortuneTeller", "shownCharacter": "fortuneTeller" },
            { "id": "player-5", "seat": 5, "name": "Eve", "actualCharacter": "imp", "shownCharacter": "imp" }
        ])),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo")
    ]));
    let command = json!({
        "type": "confirmStep",
        "payload": {
            "stepId": "firstNight:washerwoman",
            "input": {
                "playerIds": ["player-2", "player-3"],
                "characterId": "chef"
            }
        }
    });

    let actual: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

    assert_eq!(actual["ok"], false);
    assert_eq!(actual["error"]["code"], "INVALID_STEP_INPUT");
    assert!(actual.get("value").is_none());
}

#[test]
fn confirming_librarian_zero_outsiders_logs_and_reveals_zero() {
    let game = game_with_events(json!([
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Ada", "actualCharacter": "librarian", "shownCharacter": "librarian" },
            { "id": "player-2", "seat": 2, "name": "Bert", "actualCharacter": "chef", "shownCharacter": "chef" },
            { "id": "player-3", "seat": 3, "name": "Cora", "actualCharacter": "empath", "shownCharacter": "empath" },
            { "id": "player-4", "seat": 4, "name": "Dev", "actualCharacter": "poisoner", "shownCharacter": "poisoner" },
            { "id": "player-5", "seat": 5, "name": "Eve", "actualCharacter": "imp", "shownCharacter": "imp" }
        ])),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event_with_input(
            "phaseStepConfirmed",
            "firstNight:poisoner",
            json!({ "playerIds": ["player-2"] })
        )
    ]));
    let command = json!({
        "type": "confirmStep",
        "payload": {
            "stepId": "firstNight:librarian",
            "input": { "zeroOutsiders": true }
        }
    });

    let actual: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

    assert_eq!(actual["ok"], true);
    assert_eq!(
        actual["value"]["event"]["summary"],
        "사서 정보 확정: 외부인 0명"
    );
    assert_eq!(
        actual["value"]["revealPayload"]["messageKo"],
        "사서 정보: 외부인은 0명입니다."
    );
}

#[test]
fn confirming_librarian_information_uses_actual_drunk_instead_of_shown_townsfolk() {
    let game = game_with_events(json!([
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Ada", "actualCharacter": "librarian", "shownCharacter": "librarian" },
            { "id": "player-2", "seat": 2, "name": "Bert", "actualCharacter": "drunk", "shownCharacter": "chef" },
            { "id": "player-3", "seat": 3, "name": "Cora", "actualCharacter": "empath", "shownCharacter": "empath" },
            { "id": "player-4", "seat": 4, "name": "Dev", "actualCharacter": "poisoner", "shownCharacter": "poisoner" },
            { "id": "player-5", "seat": 5, "name": "Eve", "actualCharacter": "imp", "shownCharacter": "imp" }
        ])),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event_with_input(
            "phaseStepConfirmed",
            "firstNight:poisoner",
            json!({ "playerIds": ["player-3"] })
        )
    ]));
    let command = json!({
        "type": "confirmStep",
        "payload": {
            "stepId": "firstNight:librarian",
            "input": {
                "playerIds": ["player-2", "player-3"],
                "characterId": "drunk"
            }
        }
    });

    let actual: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

    assert_eq!(actual["ok"], true);
    assert_eq!(
        actual["value"]["revealPayload"]["messageKo"],
        "사서 정보: 2번 Bert 또는 3번 Cora 중 한 명은 술꾼입니다."
    );
}

#[test]
fn confirming_librarian_zero_outsiders_rejects_actual_drunk() {
    let game = game_with_events(json!([
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Ada", "actualCharacter": "librarian", "shownCharacter": "librarian" },
            { "id": "player-2", "seat": 2, "name": "Bert", "actualCharacter": "drunk", "shownCharacter": "chef" },
            { "id": "player-3", "seat": 3, "name": "Cora", "actualCharacter": "empath", "shownCharacter": "empath" },
            { "id": "player-4", "seat": 4, "name": "Dev", "actualCharacter": "poisoner", "shownCharacter": "poisoner" },
            { "id": "player-5", "seat": 5, "name": "Eve", "actualCharacter": "imp", "shownCharacter": "imp" }
        ])),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event_with_input(
            "phaseStepConfirmed",
            "firstNight:poisoner",
            json!({ "playerIds": ["player-3"] })
        )
    ]));
    let command = json!({
        "type": "confirmStep",
        "payload": {
            "stepId": "firstNight:librarian",
            "input": { "zeroOutsiders": true }
        }
    });

    let actual: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

    assert_eq!(actual["ok"], false);
    assert_eq!(actual["error"]["code"], "INVALID_STEP_INPUT");
    assert!(actual.get("value").is_none());
}

#[test]
fn confirming_librarian_zero_outsiders_rejects_character_context() {
    let game = game_with_events(json!([
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Ada", "actualCharacter": "librarian", "shownCharacter": "librarian" },
            { "id": "player-2", "seat": 2, "name": "Bert", "actualCharacter": "chef", "shownCharacter": "chef" },
            { "id": "player-3", "seat": 3, "name": "Cora", "actualCharacter": "empath", "shownCharacter": "empath" },
            { "id": "player-4", "seat": 4, "name": "Dev", "actualCharacter": "poisoner", "shownCharacter": "poisoner" },
            { "id": "player-5", "seat": 5, "name": "Eve", "actualCharacter": "imp", "shownCharacter": "imp" }
        ])),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event_with_input(
            "phaseStepConfirmed",
            "firstNight:poisoner",
            json!({ "playerIds": ["player-2"] })
        )
    ]));
    let command = json!({
        "type": "confirmStep",
        "payload": {
            "stepId": "firstNight:librarian",
            "input": { "zeroOutsiders": true, "characterId": "drunk" }
        }
    });

    let actual: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

    assert_eq!(actual["ok"], false);
    assert_eq!(actual["error"]["code"], "INVALID_STEP_INPUT");
    assert!(actual.get("value").is_none());
}

#[test]
fn confirming_investigator_information_requires_minion_character_and_reveals_it() {
    let game = game_with_events(json!([
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Ada", "actualCharacter": "investigator", "shownCharacter": "investigator" },
            { "id": "player-2", "seat": 2, "name": "Bert", "actualCharacter": "chef", "shownCharacter": "chef" },
            { "id": "player-3", "seat": 3, "name": "Cora", "actualCharacter": "empath", "shownCharacter": "empath" },
            { "id": "player-4", "seat": 4, "name": "Dev", "actualCharacter": "poisoner", "shownCharacter": "poisoner" },
            { "id": "player-5", "seat": 5, "name": "Eve", "actualCharacter": "imp", "shownCharacter": "imp" }
        ])),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event_with_input(
            "phaseStepConfirmed",
            "firstNight:poisoner",
            json!({ "playerIds": ["player-2"] })
        )
    ]));
    let command = json!({
        "type": "confirmStep",
        "payload": {
            "stepId": "firstNight:investigator",
            "input": {
                "playerIds": ["player-2", "player-4"],
                "characterId": "poisoner"
            }
        }
    });

    let actual: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

    assert_eq!(actual["ok"], true);
    assert_eq!(
        actual["value"]["revealPayload"]["messageKo"],
        "조사관 정보: 2번 Bert 또는 4번 Dev 중 한 명은 독살자입니다."
    );
}

#[test]
fn confirming_investigator_information_rejects_minion_outside_selected_candidates() {
    let game = game_with_events(json!([
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Ada", "actualCharacter": "investigator", "shownCharacter": "investigator" },
            { "id": "player-2", "seat": 2, "name": "Bert", "actualCharacter": "chef", "shownCharacter": "chef" },
            { "id": "player-3", "seat": 3, "name": "Cora", "actualCharacter": "empath", "shownCharacter": "empath" },
            { "id": "player-4", "seat": 4, "name": "Dev", "actualCharacter": "poisoner", "shownCharacter": "poisoner" },
            { "id": "player-5", "seat": 5, "name": "Eve", "actualCharacter": "imp", "shownCharacter": "imp" }
        ])),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event_with_input(
            "phaseStepConfirmed",
            "firstNight:poisoner",
            json!({ "playerIds": ["player-2"] })
        )
    ]));
    let command = json!({
        "type": "confirmStep",
        "payload": {
            "stepId": "firstNight:investigator",
            "input": {
                "playerIds": ["player-2", "player-3"],
                "characterId": "poisoner"
            }
        }
    });

    let actual: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

    assert_eq!(actual["ok"], false);
    assert_eq!(actual["error"]["code"], "INVALID_STEP_INPUT");
    assert!(actual.get("value").is_none());
}

#[test]
fn confirming_chef_can_log_true_count_and_reveal_different_displayed_value() {
    let game = game_with_events(json!([
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Ada", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
            { "id": "player-2", "seat": 2, "name": "Bert", "actualCharacter": "chef", "shownCharacter": "chef" },
            { "id": "player-3", "seat": 3, "name": "Cora", "actualCharacter": "empath", "shownCharacter": "empath" },
            { "id": "player-4", "seat": 4, "name": "Dev", "actualCharacter": "spy", "shownCharacter": "spy" },
            { "id": "player-5", "seat": 5, "name": "Eve", "actualCharacter": "imp", "shownCharacter": "imp" }
        ])),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event("phaseStepConfirmed", "firstNight:washerwoman")
    ]));
    let computed_truth = json!({
        "type": "confirmStep",
        "payload": { "stepId": "firstNight:chef" }
    });
    let computed_actual: Value = serde_json::from_str(&propose_json(
        &game.to_string(),
        &computed_truth.to_string(),
    ))
    .unwrap();
    assert_eq!(computed_actual["ok"], true);
    assert_eq!(
        computed_actual["value"]["event"]["payload"]["information"]["deliveryContext"],
        json!({ "type": "fixed" })
    );

    let command = json!({
        "type": "confirmStep",
        "payload": {
            "stepId": "firstNight:chef",
            "input": null,
            "deliveredResult": { "kind": "number", "value": 0 },
            "registrationJudgments": [
                { "playerId": "player-4", "registeredAs": "good" }
            ]
        }
    });

    let actual: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

    assert_eq!(actual["ok"], true);
    assert_eq!(
        actual["value"]["event"]["payload"]["information"]["computedResult"]["value"],
        1
    );
    assert_eq!(
        actual["value"]["event"]["payload"]["information"]["deliveredResult"]["value"],
        0
    );
    assert_eq!(
        actual["value"]["event"]["payload"]["information"]["deliveryContext"]["reasons"][0]
            ["judgments"][0]["playerId"],
        "player-4"
    );
    assert_eq!(
        actual["value"]["event"]["summary"],
        "요리사가 0쌍을 확인했습니다. (실제 1쌍 · 등록 판정)"
    );
    assert_eq!(
        actual["value"]["revealPayload"]["messageKo"],
        "서로 이웃한 악 팀 쌍은 0쌍입니다."
    );
    assert_eq!(actual["value"]["revealPayload"]["valueKo"], "0쌍");
}

#[test]
fn poisoned_chef_requires_explicit_delivery_and_reveal_uses_only_delivered_value() {
    let game = game_with_events(json!([
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Ada", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
            { "id": "player-2", "seat": 2, "name": "Bert", "actualCharacter": "chef", "shownCharacter": "chef" },
            { "id": "player-3", "seat": 3, "name": "Cora", "actualCharacter": "empath", "shownCharacter": "empath" },
            { "id": "player-4", "seat": 4, "name": "Dev", "actualCharacter": "poisoner", "shownCharacter": "poisoner" },
            { "id": "player-5", "seat": 5, "name": "Eve", "actualCharacter": "imp", "shownCharacter": "imp" }
        ])),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event_with_input(
            "phaseStepConfirmed",
            "firstNight:poisoner",
            json!({ "playerIds": ["player-2"] })
        ),
        phase_event("phaseStepConfirmed", "firstNight:washerwoman")
    ]));
    let missing = json!({
        "type": "confirmStep",
        "payload": { "stepId": "firstNight:chef" }
    });
    let missing_actual: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &missing.to_string())).unwrap();
    assert_eq!(
        missing_actual["error"]["code"],
        "MISSING_DELIVERED_INFORMATION"
    );

    let command = json!({
        "type": "confirmStep",
        "payload": {
            "stepId": "firstNight:chef",
            "deliveredResult": { "kind": "number", "value": 2 }
        }
    });
    let actual: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

    assert_eq!(actual["ok"], true);
    assert_eq!(
        actual["value"]["event"]["payload"]["information"]["computedResult"]["value"],
        1
    );
    assert_eq!(
        actual["value"]["event"]["payload"]["information"]["deliveredResult"]["value"],
        2
    );
    assert_eq!(
        actual["value"]["event"]["payload"]["information"]["deliveryContext"]["reasons"][0],
        json!({
            "type": "poisoned",
            "poisonerPlayerId": "player-4",
            "poisonEventId": "evt-firstNight:poisoner"
        })
    );
    assert_eq!(actual["value"]["revealPayload"]["valueKo"], "2쌍");
    assert!(!actual["value"]["revealPayload"]
        .to_string()
        .contains("computedResult"));

    let mut events = game["game"]["events"].as_array().unwrap().clone();
    events.push(actual["value"]["event"].clone());
    let replayed: Value = serde_json::from_str(&replay_json(
        &game_with_events(Value::Array(events)).to_string(),
    ))
    .unwrap();
    assert_eq!(replayed["ok"], true);
}

#[test]
fn drunk_information_actor_requires_explicit_delivery_and_records_reason() {
    let game = game_with_events(json!([
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Ada", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
            { "id": "player-2", "seat": 2, "name": "Bert", "actualCharacter": "drunk", "shownCharacter": "chef" },
            { "id": "player-3", "seat": 3, "name": "Cora", "actualCharacter": "empath", "shownCharacter": "empath" },
            { "id": "player-4", "seat": 4, "name": "Dev", "actualCharacter": "poisoner", "shownCharacter": "poisoner" },
            { "id": "player-5", "seat": 5, "name": "Eve", "actualCharacter": "imp", "shownCharacter": "imp" }
        ])),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event_with_input(
            "phaseStepConfirmed",
            "firstNight:poisoner",
            json!({ "playerIds": ["player-1"] })
        ),
        phase_event_with_input(
            "phaseStepConfirmed",
            "firstNight:washerwoman",
            json!({ "playerIds": ["player-2", "player-3"], "characterId": "empath" })
        )
    ]));
    let command = json!({
        "type": "confirmStep",
        "payload": {
            "stepId": "firstNight:chef",
            "deliveredResult": { "kind": "number", "value": 3 }
        }
    });

    let actual: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

    assert_eq!(actual["ok"], true);
    assert_eq!(
        actual["value"]["event"]["payload"]["information"]["deliveryContext"]["reasons"],
        json!([{ "type": "drunk" }])
    );
    assert_eq!(actual["value"]["revealPayload"]["valueKo"], "3쌍");
}

#[test]
fn fixed_information_rejects_storyteller_selected_delivery() {
    let game = game_with_events(json!([
        setup_event(),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event("phaseStepConfirmed", "firstNight:washerwoman")
    ]));
    let command = json!({
        "type": "confirmStep",
        "payload": {
            "stepId": "firstNight:chef",
            "deliveredResult": { "kind": "number", "value": 2 }
        }
    });

    let actual: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

    assert_eq!(actual["error"]["code"], "UNEXPECTED_DELIVERED_INFORMATION");
}

#[test]
fn demon_and_minion_information_steps_return_safe_reveal_payloads() {
    let game = game_with_events(json!([setup_event_with_minion()]));
    let minion_command = json!({
        "type": "confirmStep",
        "payload": { "stepId": "firstNight:minionInfo" }
    });

    let minion_actual: Value = serde_json::from_str(&propose_json(
        &game.to_string(),
        &minion_command.to_string(),
    ))
    .unwrap();

    assert_eq!(minion_actual["ok"], true);
    assert_eq!(
        minion_actual["value"]["revealPayload"]["messageKo"],
        "하수인 정보:\n악마: 5번 Eve - 임프\n하수인: 4번 Dev - 독살자"
    );

    let demon_game = game_with_events(json!([
        setup_event_with_minion(),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo")
    ]));
    let demon_command = json!({
        "type": "confirmStep",
        "payload": {
            "stepId": "firstNight:demonInfo",
            "input": { "characterIds": ["librarian", "investigator", "undertaker"] }
        }
    });
    let demon_actual: Value = serde_json::from_str(&propose_json(
        &demon_game.to_string(),
        &demon_command.to_string(),
    ))
    .unwrap();

    assert_eq!(demon_actual["ok"], true);
    assert_eq!(
        demon_actual["value"]["event"]["payload"]["information"]["computedResult"],
        json!({
            "kind": "teamInfo",
            "demonPlayerIds": ["player-5"],
            "minionPlayerIds": ["player-4"],
            "bluffCharacterIds": ["librarian", "investigator", "undertaker"]
        })
    );
    assert_eq!(
        demon_actual["value"]["event"]["payload"]["information"]["deliveredResult"],
        demon_actual["value"]["event"]["payload"]["information"]["computedResult"]
    );
    assert_eq!(
        demon_actual["value"]["event"]["payload"]["information"]["deliveryContext"],
        json!({ "type": "fixed" })
    );
    assert_eq!(
        demon_actual["value"]["revealPayload"]["messageKo"],
        "악마 정보:\n하수인: 4번 Dev - 독살자\n블러프: 사서, 조사관, 장의사"
    );
}

#[test]
fn demon_bluffs_accept_zero_through_three_unused_good_characters() {
    let game = game_with_events(json!([
        setup_event_with_minion(),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo")
    ]));
    let legal_bluffs = ["librarian", "investigator", "undertaker"];

    for count in 0..=legal_bluffs.len() {
        let command = json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "firstNight:demonInfo",
                "input": { "characterIds": &legal_bluffs[..count] }
            }
        });
        let actual: Value =
            serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

        assert_eq!(actual["ok"], true, "count {count} should be valid");
        assert_eq!(
            actual["value"]["event"]["payload"]["input"]["characterIds"],
            json!(&legal_bluffs[..count])
        );
    }
}

#[test]
fn demon_bluffs_reject_assigned_and_evil_characters() {
    let game = game_with_events(json!([
        setup_event_with_minion(),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo")
    ]));

    for illegal_bluff in ["washerwoman", "poisoner", "imp"] {
        let command = json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "firstNight:demonInfo",
                "input": { "characterIds": [illegal_bluff] }
            }
        });
        let actual: Value =
            serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

        assert_eq!(actual["ok"], false, "{illegal_bluff} should be rejected");
        assert_eq!(actual["error"]["code"], "INVALID_STEP_INPUT");
    }
}

#[test]
fn replay_rejects_a_historical_event_with_an_illegal_demon_bluff() {
    let game = game_with_events(json!([
        setup_event_with_minion(),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event_with_input(
            "phaseStepConfirmed",
            "firstNight:demonInfo",
            json!({ "characterIds": ["washerwoman"] })
        )
    ]));

    let actual: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();

    assert_eq!(actual["ok"], false);
    assert_eq!(actual["error"]["code"], "INVALID_STEP_INPUT");
}

#[test]
fn spy_step_reveals_grimoire_only_through_reveal_payload() {
    let game = game_with_events(json!([
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Ada", "actualCharacter": "chef", "shownCharacter": "chef" },
            { "id": "player-2", "seat": 2, "name": "Bert", "actualCharacter": "empath", "shownCharacter": "empath" },
            { "id": "player-3", "seat": 3, "name": "Cora", "actualCharacter": "fortuneTeller", "shownCharacter": "fortuneTeller" },
            { "id": "player-4", "seat": 4, "name": "Dev", "actualCharacter": "spy", "shownCharacter": "spy" },
            { "id": "player-5", "seat": 5, "name": "Eve", "actualCharacter": "imp", "shownCharacter": "imp" }
        ])),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event("phaseStepConfirmed", "firstNight:chef"),
        phase_event("phaseStepConfirmed", "firstNight:empath"),
        phase_event("phaseStepConfirmed", "firstNight:fortuneTeller")
    ]));
    let command = json!({
        "type": "confirmStep",
        "payload": { "stepId": "firstNight:spy" }
    });

    let actual: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

    assert_eq!(actual["ok"], true);
    assert_eq!(actual["value"]["event"]["payload"]["input"], Value::Null);
    assert!(actual["value"]["preview"]["messageKo"]
        .as_str()
        .unwrap()
        .contains("현재 단계를 확정합니다."));
    assert!(actual["value"]["revealPayload"]["messageKo"]
        .as_str()
        .unwrap()
        .contains("5번 Eve - 임프"));
    assert_eq!(
        actual["value"]["revealPayload"]["previewMessageKo"],
        "스파이 그리모어 Reveal 준비됨"
    );
}

#[test]
fn confirming_empath_step_returns_reveal_payload() {
    let game = game_with_events(json!([
        setup_event(),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event("phaseStepConfirmed", "firstNight:washerwoman"),
        phase_event("phaseStepConfirmed", "firstNight:chef")
    ]));
    let command = json!({
        "type": "confirmStep",
        "payload": { "stepId": "firstNight:empath" }
    });

    let actual: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

    assert_eq!(actual["ok"], true);
    assert_eq!(
        actual["value"]["revealPayload"]["messageKo"],
        "살아있는 양옆 이웃 중 악 팀은 0명입니다."
    );
    assert_eq!(
        actual["value"]["revealPayload"]["labelKo"],
        "살아있는 양옆 이웃 중 악한 팀"
    );
    assert_eq!(actual["value"]["revealPayload"]["valueKo"], "0명");
    assert_eq!(
        actual["value"]["event"]["summary"],
        "공감능력자가 0명을 확인했습니다."
    );
}

#[test]
fn confirming_player_selection_step_requires_matching_input_shape() {
    let game = game_with_events(json!([
        setup_event(),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo")
    ]));
    let command = json!({
        "type": "confirmStep",
        "payload": { "stepId": "firstNight:washerwoman", "input": { "playerIds": ["player-1"] } }
    });

    let actual: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

    assert_eq!(actual["ok"], false);
    assert_eq!(actual["error"]["code"], "INVALID_STEP_INPUT");
}

#[test]
fn chef_prompt_enumerates_sorted_registration_results_including_two_pairs() {
    let game = game_with_events(json!([
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Chef", "actualCharacter": "chef", "shownCharacter": "chef" },
            { "id": "player-2", "seat": 2, "name": "Recluse", "actualCharacter": "recluse", "shownCharacter": "recluse" },
            { "id": "player-3", "seat": 3, "name": "Imp", "actualCharacter": "imp", "shownCharacter": "imp" },
            { "id": "player-4", "seat": 4, "name": "Spy", "actualCharacter": "spy", "shownCharacter": "spy" },
            { "id": "player-5", "seat": 5, "name": "Empath", "actualCharacter": "empath", "shownCharacter": "empath" }
        ])),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo")
    ]));

    let actual: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();
    let choices = &actual["value"]["currentStep"]["informationPrompt"]["numberChoices"];
    assert_eq!(actual["ok"], true, "{actual}");

    assert_eq!(actual["value"]["currentStep"]["id"], "firstNight:chef");
    assert_eq!(
        choices
            .as_array()
            .unwrap()
            .iter()
            .map(|choice| choice["value"].as_u64().unwrap())
            .collect::<Vec<_>>(),
        vec![0, 1, 2]
    );
    assert_eq!(choices[1]["isComputed"], true);
    assert_eq!(choices[0]["isComputed"], false);
    assert_eq!(choices[2]["isComputed"], false);
    assert!(!choices[2]["registrationJudgments"]
        .as_array()
        .unwrap()
        .is_empty());
}

#[test]
fn recluse_next_to_imp_can_register_evil_for_chef() {
    let game = game_with_events(json!([
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Chef", "actualCharacter": "chef", "shownCharacter": "chef" },
            { "id": "player-2", "seat": 2, "name": "Good", "actualCharacter": "empath", "shownCharacter": "empath" },
            { "id": "player-3", "seat": 3, "name": "Recluse", "actualCharacter": "recluse", "shownCharacter": "recluse" },
            { "id": "player-4", "seat": 4, "name": "Imp", "actualCharacter": "imp", "shownCharacter": "imp" },
            { "id": "player-5", "seat": 5, "name": "Good 2", "actualCharacter": "fortuneTeller", "shownCharacter": "fortuneTeller" }
        ])),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo")
    ]));
    let command = json!({
        "type": "confirmStep",
        "payload": {
            "stepId": "firstNight:chef",
            "deliveredResult": { "kind": "number", "value": 1 },
            "registrationJudgments": [
                { "playerId": "player-3", "registeredAs": "evil" }
            ]
        }
    });

    let actual: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

    assert_eq!(actual["ok"], true);
    assert_eq!(
        actual["value"]["event"]["payload"]["information"]["computedResult"]["value"],
        0
    );
    assert_eq!(actual["value"]["revealPayload"]["valueKo"], "1쌍");
}

#[test]
fn poisoned_chef_prompt_exposes_full_script_range_and_rejects_out_of_range() {
    let game = game_with_events(json!([
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Chef", "actualCharacter": "chef", "shownCharacter": "chef" },
            { "id": "player-2", "seat": 2, "name": "Good", "actualCharacter": "empath", "shownCharacter": "empath" },
            { "id": "player-3", "seat": 3, "name": "Good 2", "actualCharacter": "fortuneTeller", "shownCharacter": "fortuneTeller" },
            { "id": "player-4", "seat": 4, "name": "Poisoner", "actualCharacter": "poisoner", "shownCharacter": "poisoner" },
            { "id": "player-5", "seat": 5, "name": "Imp", "actualCharacter": "imp", "shownCharacter": "imp" }
        ])),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event_with_input(
            "phaseStepConfirmed",
            "firstNight:poisoner",
            json!({ "playerIds": ["player-1"] })
        )
    ]));
    let replayed: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();
    let choices = replayed["value"]["currentStep"]["informationPrompt"]["numberChoices"]
        .as_array()
        .unwrap();
    assert_eq!(choices.len(), 6);
    assert_eq!(choices[0]["value"], 0);
    assert_eq!(choices[5]["value"], 5);

    let forged = json!({
        "type": "confirmStep",
        "payload": {
            "stepId": "firstNight:chef",
            "deliveredResult": { "kind": "number", "value": 6 }
        }
    });
    let rejected: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &forged.to_string())).unwrap();
    assert_eq!(rejected["ok"], false);
    assert_eq!(rejected["error"]["code"], "INVALID_DELIVERED_INFORMATION");
}

#[test]
fn poisoned_librarian_accepts_zero_and_records_delivered_only_information() {
    let game = game_with_events(json!([
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Librarian", "actualCharacter": "librarian", "shownCharacter": "librarian" },
            { "id": "player-2", "seat": 2, "name": "Drunk", "actualCharacter": "drunk", "shownCharacter": "chef" },
            { "id": "player-3", "seat": 3, "name": "Good", "actualCharacter": "empath", "shownCharacter": "empath" },
            { "id": "player-4", "seat": 4, "name": "Poisoner", "actualCharacter": "poisoner", "shownCharacter": "poisoner" },
            { "id": "player-5", "seat": 5, "name": "Imp", "actualCharacter": "imp", "shownCharacter": "imp" }
        ])),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event_with_input(
            "phaseStepConfirmed",
            "firstNight:poisoner",
            json!({ "playerIds": ["player-1"] })
        )
    ]));
    let command = json!({
        "type": "confirmStep",
        "payload": {
            "stepId": "firstNight:librarian",
            "input": { "zeroOutsiders": true }
        }
    });

    let actual: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

    assert_eq!(actual["ok"], true);
    let information = &actual["value"]["event"]["payload"]["information"];
    assert!(information.get("computedResult").is_none());
    assert_eq!(
        information["deliveredResult"],
        json!({
            "kind": "setupInfo",
            "playerIds": [],
            "zeroOutsiders": true
        })
    );
    assert_eq!(
        information["deliveryContext"]["reasons"][0]["type"],
        "poisoned"
    );

    for invalid_input in [
        json!({ "playerIds": ["player-2", "player-2"], "characterId": "drunk" }),
        json!({ "playerIds": ["player-2", "player-3"], "characterId": "chef" }),
        json!({ "playerIds": ["player-2", "player-3"], "characterId": "unknown" }),
        json!({ "zeroOutsiders": true, "playerIds": ["player-2"] }),
    ] {
        let invalid = json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "firstNight:librarian",
                "input": invalid_input
            }
        });
        let rejected: Value =
            serde_json::from_str(&propose_json(&game.to_string(), &invalid.to_string())).unwrap();
        assert_eq!(rejected["ok"], false, "{invalid}");
        assert!(rejected.get("value").is_none());
    }

    let mut events = game["game"]["events"].as_array().unwrap().clone();
    events.push(actual["value"]["event"].clone());
    let replayed: Value = serde_json::from_str(&replay_json(
        &game_with_events(Value::Array(events)).to_string(),
    ))
    .unwrap();
    assert_eq!(replayed["ok"], true);
}

#[test]
fn drunk_investigator_accepts_any_two_players_and_any_minion_without_true_pair() {
    let game = game_with_events(json!([
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Drunk", "actualCharacter": "drunk", "shownCharacter": "investigator" },
            { "id": "player-2", "seat": 2, "name": "Good", "actualCharacter": "chef", "shownCharacter": "chef" },
            { "id": "player-3", "seat": 3, "name": "Good 2", "actualCharacter": "empath", "shownCharacter": "empath" },
            { "id": "player-4", "seat": 4, "name": "Poisoner", "actualCharacter": "poisoner", "shownCharacter": "poisoner" },
            { "id": "player-5", "seat": 5, "name": "Imp", "actualCharacter": "imp", "shownCharacter": "imp" }
        ])),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event_with_input(
            "phaseStepConfirmed",
            "firstNight:poisoner",
            json!({ "playerIds": ["player-2"] })
        )
    ]));
    let command = json!({
        "type": "confirmStep",
        "payload": {
            "stepId": "firstNight:investigator",
            "input": {
                "playerIds": ["player-2", "player-3"],
                "characterId": "baron"
            }
        }
    });

    let actual: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

    assert_eq!(actual["ok"], true);
    let information = &actual["value"]["event"]["payload"]["information"];
    assert!(information.get("computedResult").is_none());
    assert_eq!(
        information["deliveryContext"]["reasons"],
        json!([{ "type": "drunk" }])
    );
    assert_eq!(
        actual["value"]["revealPayload"]["messageKo"],
        "조사관 정보: 2번 Good 또는 3번 Good 2 중 한 명은 남작입니다."
    );
}

#[test]
fn recluse_selection_expands_investigator_characters_with_concrete_registration() {
    let game = game_with_events(json!([
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Investigator", "actualCharacter": "investigator", "shownCharacter": "investigator" },
            { "id": "player-2", "seat": 2, "name": "Recluse", "actualCharacter": "recluse", "shownCharacter": "recluse" },
            { "id": "player-3", "seat": 3, "name": "Good", "actualCharacter": "chef", "shownCharacter": "chef" },
            { "id": "player-4", "seat": 4, "name": "Poisoner", "actualCharacter": "poisoner", "shownCharacter": "poisoner" },
            { "id": "player-5", "seat": 5, "name": "Imp", "actualCharacter": "imp", "shownCharacter": "imp" }
        ])),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event_with_input(
            "phaseStepConfirmed",
            "firstNight:poisoner",
            json!({ "playerIds": ["player-3"] })
        )
    ]));
    let replayed: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();
    assert_eq!(
        replayed["value"]["currentStep"]["informationPrompt"]["setupInfoRegistrationOptions"],
        json!([{
            "playerId": "player-2",
            "registeredAs": "minion",
            "characterIds": ["poisoner", "spy", "scarletWoman", "baron"]
        }])
    );

    let command = json!({
        "type": "confirmStep",
        "payload": {
            "stepId": "firstNight:investigator",
            "input": {
                "playerIds": ["player-2", "player-3"],
                "characterId": "baron"
            },
            "registrationJudgments": [{
                "playerId": "player-2",
                "registeredAs": "minion",
                "characterId": "baron"
            }]
        }
    });
    let actual: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();
    assert_eq!(actual["ok"], true);
    assert_eq!(
        actual["value"]["event"]["payload"]["information"]["computedResult"],
        actual["value"]["event"]["payload"]["information"]["deliveredResult"]
    );
    let mut events = game["game"]["events"].as_array().unwrap().clone();
    events.push(actual["value"]["event"].clone());
    let replayed_event: Value = serde_json::from_str(&replay_json(
        &game_with_events(Value::Array(events)).to_string(),
    ))
    .unwrap();
    assert_eq!(replayed_event["ok"], true);

    let mut forged = command.clone();
    forged["payload"]["registrationJudgments"][0]["characterId"] = json!("imp");
    let rejected: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &forged.to_string())).unwrap();
    assert_eq!(rejected["ok"], false);
    assert_eq!(rejected["error"]["code"], "INVALID_REGISTRATION_JUDGMENT");
}

#[test]
fn chef_prompt_marks_a_computed_truth_of_two_pairs() {
    let game = game_with_events(json!([
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Chef", "actualCharacter": "chef", "shownCharacter": "chef" },
            { "id": "player-2", "seat": 2, "name": "Imp", "actualCharacter": "imp", "shownCharacter": "imp" },
            { "id": "player-3", "seat": 3, "name": "Spy", "actualCharacter": "spy", "shownCharacter": "spy" },
            { "id": "player-4", "seat": 4, "name": "Good", "actualCharacter": "empath", "shownCharacter": "empath" },
            { "id": "player-5", "seat": 5, "name": "Good 2", "actualCharacter": "fortuneTeller", "shownCharacter": "fortuneTeller" },
            { "id": "player-6", "seat": 6, "name": "Poisoner", "actualCharacter": "poisoner", "shownCharacter": "poisoner" },
            { "id": "player-7", "seat": 7, "name": "Baron", "actualCharacter": "baron", "shownCharacter": "baron" },
            { "id": "player-8", "seat": 8, "name": "Monk", "actualCharacter": "monk", "shownCharacter": "monk" },
            { "id": "player-9", "seat": 9, "name": "Saint", "actualCharacter": "saint", "shownCharacter": "saint" },
            { "id": "player-10", "seat": 10, "name": "Butler", "actualCharacter": "butler", "shownCharacter": "butler" }
        ])),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event_with_input(
            "phaseStepConfirmed",
            "firstNight:poisoner",
            json!({ "playerIds": ["player-4"] })
        )
    ]));

    let actual: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();
    let choices = actual["value"]["currentStep"]["informationPrompt"]["numberChoices"]
        .as_array()
        .unwrap();
    let truth = choices
        .iter()
        .find(|choice| choice["isComputed"] == true)
        .unwrap();
    assert_eq!(truth["value"], 2);
    assert_eq!(truth["registrationJudgments"], json!([]));
}

#[test]
fn empath_prompt_enumerates_recluse_neighbor_registration() {
    let game = game_with_events(json!([
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Empath", "actualCharacter": "empath", "shownCharacter": "empath" },
            { "id": "player-2", "seat": 2, "name": "Recluse", "actualCharacter": "recluse", "shownCharacter": "recluse" },
            { "id": "player-3", "seat": 3, "name": "Good", "actualCharacter": "chef", "shownCharacter": "chef" },
            { "id": "player-4", "seat": 4, "name": "Good 2", "actualCharacter": "fortuneTeller", "shownCharacter": "fortuneTeller" },
            { "id": "player-5", "seat": 5, "name": "Imp", "actualCharacter": "imp", "shownCharacter": "imp" }
        ])),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event("phaseStepConfirmed", "firstNight:chef")
    ]));

    let actual: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();
    let choices = &actual["value"]["currentStep"]["informationPrompt"]["numberChoices"];
    assert_eq!(actual["value"]["currentStep"]["id"], "firstNight:empath");
    assert_eq!(choices[0]["value"], 1);
    assert_eq!(choices[0]["isComputed"], true);
    assert_eq!(choices[1]["value"], 2);
    assert_eq!(
        choices[1]["registrationJudgments"],
        json!([{ "playerId": "player-2", "registeredAs": "evil" }])
    );
}

#[test]
fn spy_expands_washerwoman_to_concrete_townsfolk_registration_only() {
    let game = game_with_events(json!([
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Washerwoman", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
            { "id": "player-2", "seat": 2, "name": "Spy", "actualCharacter": "spy", "shownCharacter": "spy" },
            { "id": "player-3", "seat": 3, "name": "Good", "actualCharacter": "chef", "shownCharacter": "chef" },
            { "id": "player-4", "seat": 4, "name": "Good 2", "actualCharacter": "empath", "shownCharacter": "empath" },
            { "id": "player-5", "seat": 5, "name": "Imp", "actualCharacter": "imp", "shownCharacter": "imp" }
        ])),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo")
    ]));
    let replayed: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();
    let option =
        &replayed["value"]["currentStep"]["informationPrompt"]["setupInfoRegistrationOptions"][0];
    assert_eq!(option["playerId"], "player-2");
    assert_eq!(option["registeredAs"], "townsfolk");
    assert!(option["characterIds"]
        .as_array()
        .unwrap()
        .iter()
        .any(|character_id| character_id == "fortuneTeller"));
    assert!(!option["characterIds"]
        .as_array()
        .unwrap()
        .iter()
        .any(|character_id| character_id == "drunk"));
}

#[test]
fn replay_preserves_legacy_alignment_registration_on_computed_truth() {
    let legacy_chef_event = json!({
        "id": "legacy-chef",
        "type": "phaseStepConfirmed",
        "phase": "firstNight",
        "payload": {
            "stepId": "firstNight:chef",
            "input": null,
            "information": {
                "actor": { "playerId": "player-1", "characterId": "chef" },
                "targetPlayerIds": [],
                "computedResult": { "kind": "number", "value": 1 },
                "deliveredResult": { "kind": "number", "value": 1 },
                "deliveryContext": {
                    "type": "discretionary",
                    "reasons": [{
                        "type": "registrationJudgment",
                        "judgments": [{ "playerId": "player-4", "registeredAs": "evil" }]
                    }]
                }
            }
        },
        "summary": "legacy",
        "createdAt": "2026-01-01T00:00:00.000Z"
    });
    let game = game_with_events(json!([
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Chef", "actualCharacter": "chef", "shownCharacter": "chef" },
            { "id": "player-2", "seat": 2, "name": "Empath", "actualCharacter": "empath", "shownCharacter": "empath" },
            { "id": "player-3", "seat": 3, "name": "Fortune", "actualCharacter": "fortuneTeller", "shownCharacter": "fortuneTeller" },
            { "id": "player-4", "seat": 4, "name": "Spy", "actualCharacter": "spy", "shownCharacter": "spy" },
            { "id": "player-5", "seat": 5, "name": "Imp", "actualCharacter": "imp", "shownCharacter": "imp" }
        ])),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        legacy_chef_event
    ]));

    let actual: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();
    assert_eq!(actual["ok"], true);
    assert_eq!(actual["value"]["currentStep"]["id"], "firstNight:empath");
}

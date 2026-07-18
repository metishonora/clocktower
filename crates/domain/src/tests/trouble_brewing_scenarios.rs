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
        actual["value"]["revealPayload"],
        json!({
            "kind": "numericInformation",
            "characterId": "chef",
            "value": 0
        })
    );
    assert_eq!(
        actual["value"]["event"]["summary"],
        "2번 Bert(요리사)가 서로 이웃한 악한 팀 0쌍을 확인했습니다."
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
        "1번 Ada(세탁부)가 1번 Ada(세탁부), 2번 Bert(요리사) 중 한 명을 요리사로 확인했습니다."
    );
    assert_eq!(
        actual["value"]["revealPayload"],
        json!({
            "kind": "setupInformation",
            "characterId": "washerwoman",
            "candidatePlayers": [
                { "playerId": "player-1", "seat": 1, "name": "Ada" },
                { "playerId": "player-2", "seat": 2, "name": "Bert" }
            ],
            "revealedCharacterId": "chef",
            "zeroOutsiders": false
        })
    );
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
        "1번 Ada(사서)가 외부인 없음을 확인했습니다."
    );
    assert_eq!(
        actual["value"]["revealPayload"],
        json!({
            "kind": "setupInformation",
            "characterId": "librarian",
            "candidatePlayers": [],
            "zeroOutsiders": true
        })
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
        actual["value"]["revealPayload"],
        json!({
            "kind": "setupInformation", "characterId": "librarian",
            "candidatePlayers": [
                { "playerId": "player-2", "seat": 2, "name": "Bert" },
                { "playerId": "player-3", "seat": 3, "name": "Cora" }
            ],
            "revealedCharacterId": "drunk", "zeroOutsiders": false
        })
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
        actual["value"]["revealPayload"],
        json!({
            "kind": "setupInformation", "characterId": "investigator",
            "candidatePlayers": [
                { "playerId": "player-2", "seat": 2, "name": "Bert" },
                { "playerId": "player-4", "seat": 4, "name": "Dev" }
            ],
            "revealedCharacterId": "poisoner", "zeroOutsiders": false
        })
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
        "2번 Bert(요리사)가 서로 이웃한 악한 팀 0쌍을 확인했습니다. (실제 1쌍 · 등록 판정)"
    );
    assert_eq!(
        actual["value"]["revealPayload"],
        json!({
            "kind": "numericInformation", "characterId": "chef", "value": 0
        })
    );
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
    assert_eq!(actual["value"]["revealPayload"]["value"], 2);
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
    assert_eq!(actual["value"]["revealPayload"]["value"], 3);
    assert_eq!(
        actual["value"]["event"]["summary"],
        "2번 Bert(요리사 능력, 실제 술꾼)가 서로 이웃한 악한 팀 3쌍을 확인했습니다. (실제 1쌍 · 술취함)"
    );
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
    let setup = setup_event_with_players(json!([
        { "id": "player-1", "seat": 1, "name": "Ada", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
        { "id": "player-2", "seat": 2, "name": "Bert", "actualCharacter": "chef", "shownCharacter": "chef" },
        { "id": "player-3", "seat": 3, "name": "Cora", "actualCharacter": "empath", "shownCharacter": "empath" },
        { "id": "player-6", "seat": 6, "name": "Finn", "actualCharacter": "baron", "shownCharacter": "baron" },
        { "id": "player-5", "seat": 5, "name": "Eve", "actualCharacter": "imp", "shownCharacter": "imp" },
        { "id": "player-4", "seat": 4, "name": "Dev", "actualCharacter": "poisoner", "shownCharacter": "poisoner" }
    ]));
    let game = game_with_events(json!([setup.clone()]));
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
        minion_actual["value"]["event"]["summary"],
        "하수인 정보 전달 · 악마: 5번 Eve(임프) · 하수인: 6번 Finn(남작), 4번 Dev(독살자)"
    );
    assert_eq!(
        minion_actual["value"]["revealPayload"],
        json!({
            "kind": "minionInformation",
            "demonPlayers": [{ "seat": 5, "name": "Eve" }],
            "minionPlayers": [
                { "seat": 4, "name": "Dev" },
                { "seat": 6, "name": "Finn" }
            ]
        })
    );
    let minion_reveal = minion_actual["value"]["revealPayload"].to_string();
    for forbidden in [
        "player-4",
        "player-6",
        "poisoner",
        "baron",
        "독살자",
        "남작",
    ] {
        assert!(!minion_reveal.contains(forbidden), "leaked {forbidden}");
    }

    let demon_game = game_with_events(json!([
        setup,
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
        demon_actual["value"]["event"]["summary"],
        "악마 정보 전달 · 하수인: 6번 Finn(남작), 4번 Dev(독살자) · 블러프: 사서, 조사관, 장의사"
    );
    assert_eq!(
        demon_actual["value"]["event"]["payload"]["information"]["computedResult"],
        json!({
            "kind": "teamInfo",
            "demonPlayerIds": ["player-5"],
            "minionPlayerIds": ["player-6", "player-4"],
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
        demon_actual["value"]["revealPayload"],
        json!({
            "kind": "demonInformation",
            "minionPlayers": [
                { "seat": 4, "name": "Dev" },
                { "seat": 6, "name": "Finn" }
            ],
            "bluffCharacterIds": ["librarian", "investigator", "undertaker"]
        })
    );
    let demon_reveal = demon_actual["value"]["revealPayload"].to_string();
    for forbidden in [
        "player-4",
        "player-6",
        "poisoner",
        "baron",
        "독살자",
        "남작",
    ] {
        assert!(!demon_reveal.contains(forbidden), "leaked {forbidden}");
    }
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
    assert_eq!(
        actual["value"]["event"]["summary"],
        "4번 Dev(스파이)가 마도서를 확인했습니다."
    );
    assert_eq!(actual["value"]["event"]["payload"]["input"], Value::Null);
    assert!(actual["value"]["preview"]["messageKo"]
        .as_str()
        .unwrap()
        .contains("현재 단계를 확정합니다."));
    let expected_players = json!([
        { "playerId": "player-1", "seat": 1, "name": "Ada", "characterId": "chef", "alive": true, "ghostVoteUsed": false, "reminderTokens": [] },
        { "playerId": "player-2", "seat": 2, "name": "Bert", "characterId": "empath", "alive": true, "ghostVoteUsed": false, "reminderTokens": [] },
        { "playerId": "player-3", "seat": 3, "name": "Cora", "characterId": "fortuneTeller", "alive": true, "ghostVoteUsed": false, "reminderTokens": [] },
        { "playerId": "player-4", "seat": 4, "name": "Dev", "characterId": "spy", "alive": true, "ghostVoteUsed": false, "reminderTokens": [] },
        { "playerId": "player-5", "seat": 5, "name": "Eve", "characterId": "imp", "alive": true, "ghostVoteUsed": false, "reminderTokens": [] }
    ]);
    assert_eq!(
        actual["value"]["revealPayload"],
        json!({ "kind": "spyGrimoire", "players": expected_players })
    );
    assert_eq!(
        actual["value"]["event"]["payload"]["information"]["deliveredResult"],
        json!({ "kind": "spyGrimoire", "players": expected_players })
    );
    assert!(actual["value"]["revealPayload"].get("messageKo").is_none());
    assert!(actual["value"]["revealPayload"]
        .get("previewMessageKo")
        .is_none());
}

#[test]
fn butler_selection_summary_names_actor_target_and_characters() {
    let game = game_with_events(json!([
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Chef", "actualCharacter": "chef", "shownCharacter": "chef" },
            { "id": "player-2", "seat": 2, "name": "Butler", "actualCharacter": "butler", "shownCharacter": "butler" },
            { "id": "player-3", "seat": 3, "name": "Empath", "actualCharacter": "empath", "shownCharacter": "empath" },
            { "id": "player-4", "seat": 4, "name": "Washer", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
            { "id": "player-5", "seat": 5, "name": "Imp", "actualCharacter": "imp", "shownCharacter": "imp" }
        ])),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event("phaseStepConfirmed", "firstNight:washerwoman"),
        phase_event("phaseStepConfirmed", "firstNight:chef"),
        phase_event("phaseStepConfirmed", "firstNight:empath")
    ]));
    let command = json!({
        "type": "confirmStep",
        "payload": {
            "stepId": "firstNight:butler",
            "input": { "playerIds": ["player-1"] }
        }
    });

    let actual: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

    assert_eq!(actual["ok"], true, "{actual:#}");
    assert_eq!(
        actual["value"]["event"]["summary"],
        "2번 Butler(집사) → 1번 Chef(요리사) · 주인 선택"
    );
}

#[test]
fn normal_night_spy_snapshot_uses_only_current_confirmed_poison_and_protection() {
    let game = game_with_events(json!([
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Chef", "actualCharacter": "chef", "shownCharacter": "chef" },
            { "id": "player-2", "seat": 2, "name": "Imp", "actualCharacter": "imp", "shownCharacter": "imp" },
            { "id": "player-3", "seat": 3, "name": "Spy", "actualCharacter": "spy", "shownCharacter": "spy" },
            { "id": "player-4", "seat": 4, "name": "Empath", "actualCharacter": "empath", "shownCharacter": "empath" },
            { "id": "player-5", "seat": 5, "name": "Fortune", "actualCharacter": "fortuneTeller", "shownCharacter": "fortuneTeller" },
            { "id": "player-6", "seat": 6, "name": "Poisoner", "actualCharacter": "poisoner", "shownCharacter": "poisoner" },
            { "id": "player-7", "seat": 7, "name": "Baron", "actualCharacter": "baron", "shownCharacter": "baron" },
            { "id": "player-8", "seat": 8, "name": "Monk", "actualCharacter": "monk", "shownCharacter": "monk" },
            { "id": "player-9", "seat": 9, "name": "Saint", "actualCharacter": "saint", "shownCharacter": "saint" },
            { "id": "player-10", "seat": 10, "name": "Butler", "actualCharacter": "butler", "shownCharacter": "butler" }
        ])),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event_with_input("phaseStepConfirmed", "firstNight:poisoner", json!({ "playerIds": ["player-9"] })),
        phase_event("phaseStepConfirmed", "firstNight:chef"),
        phase_event("phaseStepConfirmed", "firstNight:empath"),
        phase_event("phaseStepConfirmed", "firstNight:fortuneTeller"),
        phase_event("phaseStepConfirmed", "firstNight:butler"),
        phase_event("phaseStepConfirmed", "firstNight:spy"),
        phase_event("phaseStepConfirmed", "firstNight:toDay"),
        death_event("player-1"),
        phase_event("phaseStepConfirmed", "day:announceDeaths"),
        phase_event("phaseStepConfirmed", "day:whisper"),
        phase_event("phaseStepConfirmed", "day:discussion"),
        {
            "id": "evt-day:nomination:1",
            "type": "nominationVoteConfirmed",
            "phase": "day",
            "payload": {
                "stepId": "day:nomination:1",
                "nominatorId": "player-2",
                "nomineeId": "player-3",
                "voterIds": ["player-1", "player-2", "player-3", "player-4", "player-5", "player-6"],
                "ghostVoteSpentPlayerIds": ["player-1"]
            },
            "summary": "지명 투표 확정",
            "createdAt": "2026-01-01T00:00:00.000Z"
        },
        phase_event("phaseStepSkipped", "day:nomination:2"),
        no_execution_event("day:execution"),
        phase_event("phaseStepConfirmed", "day:toNight"),
        phase_event_with_input("phaseStepConfirmed", "night:poisoner", json!({ "playerIds": ["player-4"] })),
        phase_event_with_input("phaseStepConfirmed", "night:monk", json!({ "playerIds": ["player-4"] })),
        phase_event_with_input("phaseStepConfirmed", "night:imp", json!({ "playerIds": ["player-9"] })),
        phase_event("phaseStepConfirmed", "night:fortuneTeller"),
        phase_event("phaseStepConfirmed", "night:butler")
    ]));
    let command = json!({
        "type": "confirmStep",
        "payload": { "stepId": "night:spy" }
    });

    let actual: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

    assert_eq!(actual["ok"], true, "{actual:#}");
    let players = actual["value"]["revealPayload"]["players"]
        .as_array()
        .expect("Spy Reveal must contain structured players");
    assert_eq!(
        players
            .iter()
            .map(|player| player["seat"].as_u64().unwrap())
            .collect::<Vec<_>>(),
        (1..=10).collect::<Vec<_>>()
    );
    assert_eq!(players[0]["alive"], false);
    assert_eq!(players[0]["ghostVoteUsed"], true);
    assert_eq!(
        players[3]["reminderTokens"],
        json!(["poisoned", "protected"])
    );
    assert_eq!(players[8]["reminderTokens"], json!([]));
    assert_eq!(
        actual["value"]["event"]["payload"]["information"]["deliveredResult"],
        actual["value"]["revealPayload"]
    );
}

#[test]
fn skipped_poisoner_step_does_not_add_a_spy_reminder() {
    let game = game_with_events(json!([
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Chef", "actualCharacter": "chef", "shownCharacter": "chef" },
            { "id": "player-2", "seat": 2, "name": "Empath", "actualCharacter": "empath", "shownCharacter": "empath" },
            { "id": "player-3", "seat": 3, "name": "Poisoner", "actualCharacter": "poisoner", "shownCharacter": "poisoner" },
            { "id": "player-4", "seat": 4, "name": "Spy", "actualCharacter": "spy", "shownCharacter": "spy" },
            { "id": "player-5", "seat": 5, "name": "Imp", "actualCharacter": "imp", "shownCharacter": "imp" }
        ])),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event("phaseStepSkipped", "firstNight:poisoner"),
        phase_event("phaseStepConfirmed", "firstNight:chef"),
        phase_event("phaseStepConfirmed", "firstNight:empath")
    ]));
    let command = json!({
        "type": "confirmStep",
        "payload": { "stepId": "firstNight:spy" }
    });

    let actual: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

    assert_eq!(actual["ok"], true, "{actual:#}");
    assert!(actual["value"]["revealPayload"]["players"]
        .as_array()
        .expect("Spy Reveal must contain structured players")
        .iter()
        .all(|player| player["reminderTokens"] == json!([])));
}

#[test]
fn replay_keeps_legacy_schema_v1_spy_information_compatible() {
    let legacy_players = json!([
        { "playerId": "player-1", "seat": 1, "name": "Ada", "characterId": "chef" },
        { "playerId": "player-2", "seat": 2, "name": "Bert", "characterId": "empath" },
        { "playerId": "player-3", "seat": 3, "name": "Cora", "characterId": "fortuneTeller" },
        { "playerId": "player-4", "seat": 4, "name": "Dev", "characterId": "spy" },
        { "playerId": "player-5", "seat": 5, "name": "Eve", "characterId": "imp" }
    ]);
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
        phase_event("phaseStepConfirmed", "firstNight:fortuneTeller"),
        {
            "id": "legacy-spy-event",
            "type": "phaseStepConfirmed",
            "phase": "firstNight",
            "payload": {
                "stepId": "firstNight:spy",
                "input": null,
                "information": {
                    "actor": { "playerId": "player-4", "characterId": "spy" },
                    "targetPlayerIds": [],
                    "computedResult": { "kind": "spyGrimoire", "players": legacy_players },
                    "deliveredResult": { "kind": "spyGrimoire", "players": legacy_players },
                    "deliveryContext": { "type": "fixed" }
                }
            },
            "summary": "스파이 정보 확정",
            "createdAt": "2026-01-01T00:00:00.000Z"
        }
    ]));

    let actual: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();

    assert_eq!(actual["ok"], true, "{actual:#}");
    assert_eq!(actual["value"]["currentStep"]["id"], "firstNight:toDay");
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
        actual["value"]["revealPayload"],
        json!({
            "kind": "numericInformation", "characterId": "empath", "value": 0
        })
    );
    assert_eq!(
        actual["value"]["event"]["summary"],
        "3번 Cora(공감능력자)가 살아있는 양옆 이웃 중 악한 팀 0명을 확인했습니다."
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
    assert_eq!(actual["value"]["revealPayload"]["value"], 1);
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
        actual["value"]["revealPayload"],
        json!({
            "kind": "setupInformation", "characterId": "investigator",
            "candidatePlayers": [
                { "playerId": "player-2", "seat": 2, "name": "Good" },
                { "playerId": "player-3", "seat": 3, "name": "Good 2" }
            ],
            "revealedCharacterId": "baron", "zeroOutsiders": false
        })
    );
}

#[test]
fn drunk_setup_information_records_and_reveals_only_the_single_delivered_input() {
    for (shown_character, input, delivered_result, expected_reveal) in [
        (
            "washerwoman",
            json!({
                "playerIds": ["player-2", "player-3"],
                "characterId": "fortuneTeller"
            }),
            json!({
                "kind": "setupInfo",
                "playerIds": ["player-2", "player-3"],
                "characterId": "fortuneTeller",
                "zeroOutsiders": false
            }),
            json!({
                "kind": "setupInformation", "characterId": "washerwoman",
                "candidatePlayers": [
                    { "playerId": "player-2", "seat": 2, "name": "Chef" },
                    { "playerId": "player-3", "seat": 3, "name": "Empath" }
                ],
                "revealedCharacterId": "fortuneTeller", "zeroOutsiders": false
            }),
        ),
        (
            "librarian",
            json!({ "zeroOutsiders": true }),
            json!({
                "kind": "setupInfo",
                "playerIds": [],
                "zeroOutsiders": true
            }),
            json!({
                "kind": "setupInformation", "characterId": "librarian",
                "candidatePlayers": [], "zeroOutsiders": true
            }),
        ),
    ] {
        let game = game_with_events(json!([
            setup_event_with_players(json!([
                { "id": "player-1", "seat": 1, "name": "Drunk", "actualCharacter": "drunk", "shownCharacter": shown_character },
                { "id": "player-2", "seat": 2, "name": "Chef", "actualCharacter": "chef", "shownCharacter": "chef" },
                { "id": "player-3", "seat": 3, "name": "Empath", "actualCharacter": "empath", "shownCharacter": "empath" },
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
                "stepId": format!("firstNight:{shown_character}"),
                "input": input.clone()
            }
        });

        let actual: Value =
            serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

        assert_eq!(actual["ok"], true, "{shown_character}: {actual}");
        assert_eq!(actual["value"]["event"]["payload"]["input"], input);
        let information = &actual["value"]["event"]["payload"]["information"];
        assert!(information.get("computedResult").is_none());
        assert_eq!(information["deliveredResult"], delivered_result);
        assert_eq!(
            information["deliveryContext"]["reasons"],
            json!([{ "type": "drunk" }])
        );
        assert_eq!(actual["value"]["revealPayload"], expected_reveal);
    }
}

#[test]
fn replay_preserves_legacy_drunk_investigator_delivery_without_information() {
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
        ),
        phase_event_with_input(
            "phaseStepConfirmed",
            "firstNight:investigator",
            json!({
                "playerIds": ["player-2", "player-3"],
                "characterId": "baron"
            })
        )
    ]));

    let replayed: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();

    assert_eq!(replayed["ok"], true, "{replayed}");
    assert_eq!(replayed["value"]["currentStep"]["id"], "firstNight:chef");
}

#[test]
fn replay_preserves_legacy_poisoned_librarian_zero_without_information() {
    let game = game_with_events(json!([
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Librarian", "actualCharacter": "librarian", "shownCharacter": "librarian" },
            { "id": "player-2", "seat": 2, "name": "Drunk", "actualCharacter": "drunk", "shownCharacter": "chef" },
            { "id": "player-3", "seat": 3, "name": "Empath", "actualCharacter": "empath", "shownCharacter": "empath" },
            { "id": "player-4", "seat": 4, "name": "Poisoner", "actualCharacter": "poisoner", "shownCharacter": "poisoner" },
            { "id": "player-5", "seat": 5, "name": "Imp", "actualCharacter": "imp", "shownCharacter": "imp" }
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
            "firstNight:librarian",
            json!({ "zeroOutsiders": true })
        )
    ]));

    let replayed: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();

    assert_eq!(replayed["ok"], true, "{replayed}");
    assert_eq!(replayed["value"]["currentStep"]["id"], "firstNight:chef");
}

#[test]
fn replay_rejects_malformed_legacy_impaired_setup_inputs() {
    for invalid_input in [
        json!({ "playerIds": ["player-2", "unknown"], "characterId": "saint" }),
        json!({ "playerIds": ["player-2", "player-2"], "characterId": "saint" }),
        json!({ "playerIds": ["player-2"], "characterId": "saint" }),
        json!({ "playerIds": ["player-2", "player-3"], "characterId": "unknown" }),
        json!({ "playerIds": ["player-2", "player-3"], "characterId": "chef" }),
        json!({ "zeroOutsiders": true, "playerIds": ["player-2"] }),
    ] {
        let game = game_with_events(json!([
            setup_event_with_players(json!([
                { "id": "player-1", "seat": 1, "name": "Drunk", "actualCharacter": "drunk", "shownCharacter": "librarian" },
                { "id": "player-2", "seat": 2, "name": "Chef", "actualCharacter": "chef", "shownCharacter": "chef" },
                { "id": "player-3", "seat": 3, "name": "Empath", "actualCharacter": "empath", "shownCharacter": "empath" },
                { "id": "player-4", "seat": 4, "name": "Poisoner", "actualCharacter": "poisoner", "shownCharacter": "poisoner" },
                { "id": "player-5", "seat": 5, "name": "Imp", "actualCharacter": "imp", "shownCharacter": "imp" }
            ])),
            phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
            phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
            phase_event_with_input(
                "phaseStepConfirmed",
                "firstNight:poisoner",
                json!({ "playerIds": ["player-2"] })
            ),
            phase_event_with_input(
                "phaseStepConfirmed",
                "firstNight:librarian",
                invalid_input.clone()
            )
        ]));

        let replayed: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();

        assert_eq!(replayed["ok"], false, "{invalid_input}");
        assert_eq!(replayed["error"]["code"], "INVALID_STEP_INPUT");
    }
}

#[test]
fn replay_rejects_tampered_typed_drunk_setup_information() {
    let game = game_with_events(json!([
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Drunk", "actualCharacter": "drunk", "shownCharacter": "investigator" },
            { "id": "player-2", "seat": 2, "name": "Chef", "actualCharacter": "chef", "shownCharacter": "chef" },
            { "id": "player-3", "seat": 3, "name": "Empath", "actualCharacter": "empath", "shownCharacter": "empath" },
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
    let proposed: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();
    assert_eq!(proposed["ok"], true);
    let mut tampered_event = proposed["value"]["event"].clone();
    tampered_event["payload"]["information"]["deliveredResult"]["characterId"] =
        json!("scarletWoman");
    let mut events = game["game"]["events"].as_array().unwrap().clone();
    events.push(tampered_event);

    let replayed: Value = serde_json::from_str(&replay_json(
        &game_with_events(Value::Array(events)).to_string(),
    ))
    .unwrap();

    assert_eq!(replayed["ok"], false);
    assert_eq!(replayed["error"]["code"], "REPLAY_FAILED");
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

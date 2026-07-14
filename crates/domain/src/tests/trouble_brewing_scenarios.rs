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
    assert!(actual["value"]["event"]["payload"]["input"]["reason"].is_null());

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
        phase_event("phaseStepConfirmed", "firstNight:poisoner")
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
        phase_event("phaseStepConfirmed", "firstNight:poisoner")
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
fn confirming_chef_can_log_true_count_and_reveal_different_displayed_value() {
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
        phase_event("phaseStepConfirmed", "firstNight:poisoner"),
        phase_event("phaseStepConfirmed", "firstNight:washerwoman")
    ]));
    let command = json!({
        "type": "confirmStep",
        "payload": {
            "stepId": "firstNight:chef",
            "input": { "value": 0, "reason": "registration" }
        }
    });

    let actual: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

    assert_eq!(actual["ok"], true);
    assert_eq!(actual["value"]["event"]["payload"]["input"]["trueValue"], 1);
    assert_eq!(
        actual["value"]["event"]["payload"]["input"]["displayedValue"],
        0
    );
    assert_eq!(
        actual["value"]["event"]["payload"]["input"]["reason"],
        "registration"
    );
    assert_eq!(
        actual["value"]["event"]["summary"],
        "요리사 정보 확정: 실제 1쌍, 표시 0쌍 (등록 판정)"
    );
    assert_eq!(
        actual["value"]["revealPayload"]["messageKo"],
        "서로 이웃한 악 팀 쌍은 0쌍입니다."
    );
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
            "input": { "characterIds": ["washerwoman", "librarian", "chef"] }
        }
    });
    let demon_actual: Value = serde_json::from_str(&propose_json(
        &demon_game.to_string(),
        &demon_command.to_string(),
    ))
    .unwrap();

    assert_eq!(demon_actual["ok"], true);
    assert_eq!(
        demon_actual["value"]["revealPayload"]["messageKo"],
        "악마 정보:\n하수인: 4번 Dev - 독살자\n블러프: 세탁부, 사서, 요리사"
    );
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
    assert_eq!(actual["error"]["code"], "MISSING_STEP_INPUT");
}

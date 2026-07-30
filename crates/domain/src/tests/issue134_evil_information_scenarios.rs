use crate::{propose_json, replay_json, suggest_phase_input_json};
use serde_json::{json, Value};

fn setup_event() -> Value {
    json!({
        "id": "setup-134",
        "type": "setupConfirmed",
        "phase": "setup",
        "payload": { "players": [
            { "id": "p1", "seat": 1, "name": "가나다라마바사아자차카타파하", "actualCharacter": "clockmaker", "shownCharacter": "clockmaker" },
            { "id": "p2", "seat": 2, "name": "B", "actualCharacter": "dreamer", "shownCharacter": "dreamer" },
            { "id": "p3", "seat": 3, "name": "C", "actualCharacter": "snakeCharmer", "shownCharacter": "snakeCharmer" },
            { "id": "p4", "seat": 4, "name": "D", "actualCharacter": "mathematician", "shownCharacter": "mathematician" },
            { "id": "p5", "seat": 5, "name": "E", "actualCharacter": "flowergirl", "shownCharacter": "flowergirl" },
            { "id": "p6", "seat": 6, "name": "F", "actualCharacter": "townCrier", "shownCharacter": "townCrier" },
            { "id": "p7", "seat": 7, "name": "G", "actualCharacter": "oracle", "shownCharacter": "oracle" },
            { "id": "p8", "seat": 8, "name": "Minion Eight", "actualCharacter": "witch", "shownCharacter": "witch" },
            { "id": "p9", "seat": 9, "name": "Minion Nine", "actualCharacter": "cerenovus", "shownCharacter": "cerenovus" },
            { "id": "p10", "seat": 10, "name": "Demon Ten", "actualCharacter": "vortox", "shownCharacter": "vortox" }
        ]},
        "summary": "초기 설정 확정: 10명",
        "createdAt": "2026-07-31T00:00:00.000Z"
    })
}

fn game(events: Vec<Value>) -> Value {
    json!({
        "schemaVersion": 3,
        "game": {
            "id": "issue-134",
            "name": "issue 134",
            "scriptId": "sectsAndViolets",
            "createdAt": "2026-07-31T00:00:00.000Z",
            "updatedAt": "2026-07-31T00:00:00.000Z",
            "events": events
        }
    })
}

fn propose(game: &Value, step_id: &str, input: Value) -> Value {
    serde_json::from_str(&propose_json(
        &game.to_string(),
        &json!({
            "type": "confirmStep",
            "payload": { "stepId": step_id, "input": input }
        })
        .to_string(),
    ))
    .unwrap()
}

#[test]
fn snv_minion_and_demon_information_are_canonical_and_player_safe() {
    let initial = game(vec![setup_event()]);
    let minion = propose(&initial, "firstNight:minionInfo", Value::Null);
    assert_eq!(minion["ok"], true, "{minion}");
    assert_eq!(
        minion["value"]["event"]["payload"]["information"]["deliveredResult"],
        json!({
            "kind": "teamInfo",
            "demonPlayerIds": ["p10"],
            "minionPlayerIds": ["p8", "p9"],
            "bluffCharacterIds": []
        })
    );
    assert_eq!(
        minion["value"]["revealPayload"],
        json!({
            "kind": "minionInformation",
            "demonPlayers": [{ "seat": 10, "name": "Demon Ten" }],
            "minionPlayers": [
                { "seat": 8, "name": "Minion Eight" },
                { "seat": 9, "name": "Minion Nine" }
            ]
        })
    );

    let mut events = vec![setup_event(), minion["value"]["event"].clone()];
    let after_minion = game(events.clone());
    let replayed: Value = serde_json::from_str(&replay_json(&after_minion.to_string())).unwrap();
    assert_eq!(replayed["ok"], true, "{replayed}");
    assert_eq!(
        replayed["value"]["currentStep"]["id"],
        "firstNight:demonInfo"
    );
    assert_eq!(
        replayed["value"]["currentStep"]["requiredInput"]["minSelections"],
        3
    );
    assert_eq!(
        replayed["value"]["currentStep"]["requiredInput"]["maxSelections"],
        3
    );
    assert_eq!(
        replayed["value"]["currentStep"]["requiredInput"]["supportsRandomSuggestion"],
        true
    );

    let demon = propose(
        &after_minion,
        "firstNight:demonInfo",
        json!({ "characterIds": ["savant", "artist", "juggler"] }),
    );
    assert_eq!(demon["ok"], true, "{demon}");
    assert_eq!(
        demon["value"]["event"]["payload"]["information"]["deliveredResult"],
        json!({
            "kind": "teamInfo",
            "demonPlayerIds": ["p10"],
            "minionPlayerIds": ["p8", "p9"],
            "bluffCharacterIds": ["savant", "artist", "juggler"]
        })
    );
    assert_eq!(
        demon["value"]["revealPayload"],
        json!({
            "kind": "demonInformation",
            "minionPlayers": [
                { "seat": 8, "name": "Minion Eight" },
                { "seat": 9, "name": "Minion Nine" }
            ],
            "bluffCharacterIds": ["savant", "artist", "juggler"]
        })
    );
    let reveal = demon["value"]["revealPayload"].to_string();
    for forbidden in ["p8", "p9", "witch", "cerenovus", "마녀", "세레노버스"] {
        assert!(
            !reveal.contains(forbidden),
            "player payload leaked {forbidden}"
        );
    }

    events.push(demon["value"]["event"].clone());
    let round_trip: Value = serde_json::from_str(&replay_json(&game(events).to_string())).unwrap();
    assert_eq!(round_trip["ok"], true, "{round_trip}");
}

#[test]
fn snv_demon_bluffs_require_three_unique_unused_good_characters() {
    let minion = propose(
        &game(vec![setup_event()]),
        "firstNight:minionInfo",
        Value::Null,
    );
    let current = game(vec![setup_event(), minion["value"]["event"].clone()]);

    for input in [
        json!({ "characterIds": [] }),
        json!({ "characterIds": ["savant", "artist"] }),
        json!({ "characterIds": ["savant", "artist", "juggler", "sage"] }),
        json!({ "characterIds": ["savant", "savant", "juggler"] }),
        json!({ "characterIds": ["clockmaker", "artist", "juggler"] }),
        json!({ "characterIds": ["witch", "artist", "juggler"] }),
        json!({ "characterIds": ["washerwoman", "artist", "juggler"] }),
    ] {
        let actual = propose(&current, "firstNight:demonInfo", input);
        assert_eq!(actual["ok"], false, "{actual}");
    }
}

#[test]
fn snv_random_bluff_suggestion_uses_the_snv_legal_pool_without_mutating_game() {
    let minion = propose(
        &game(vec![setup_event()]),
        "firstNight:minionInfo",
        Value::Null,
    );
    let current = game(vec![setup_event(), minion["value"]["event"].clone()]);
    let suggested: Value = serde_json::from_str(&suggest_phase_input_json(
        &current.to_string(),
        &json!({ "stepId": "firstNight:demonInfo", "choiceToken": 11 }).to_string(),
    ))
    .unwrap();

    assert_eq!(suggested["ok"], true, "{suggested}");
    let ids = suggested["value"]["input"]["characterIds"]
        .as_array()
        .unwrap();
    assert_eq!(ids.len(), 3);
    assert_eq!(
        ids.iter().collect::<std::collections::HashSet<_>>().len(),
        3
    );
    for forbidden in ["clockmaker", "witch", "vortox", "washerwoman"] {
        assert!(!ids.contains(&json!(forbidden)), "suggested {forbidden}");
    }
    assert!(suggested["value"].get("event").is_none());
    assert!(suggested["value"].get("revealPayload").is_none());
}

#[test]
fn snv_replay_rejects_tampered_new_evil_information() {
    let minion = propose(
        &game(vec![setup_event()]),
        "firstNight:minionInfo",
        Value::Null,
    );
    let current = game(vec![setup_event(), minion["value"]["event"].clone()]);
    let demon = propose(
        &current,
        "firstNight:demonInfo",
        json!({ "characterIds": ["savant", "artist", "juggler"] }),
    );
    let mut tampered = demon["value"]["event"].clone();
    tampered["payload"]["information"]["deliveredResult"]["bluffCharacterIds"] =
        json!(["clockmaker", "artist", "juggler"]);
    let replayed: Value = serde_json::from_str(&replay_json(
        &game(vec![
            setup_event(),
            minion["value"]["event"].clone(),
            tampered,
        ])
        .to_string(),
    ))
    .unwrap();
    assert_eq!(replayed["ok"], false, "{replayed}");
}

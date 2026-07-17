use serde_json::{json, Value};

use crate::{propose_json, replay_json};

use super::support::{game_with_events, setup_event};

#[test]
fn player_annotations_are_one_canonical_replayable_and_undoable_event() {
    let game = game_with_events(json!([setup_event()]));
    let before = replay(&game);
    let proposal = propose(
        &game,
        json!({
            "type": "updatePlayerAnnotations",
            "payload": {
                "playerId": "player-2",
                "expectedEventCount": 1,
                "systemTokenIds": ["abilitySpent", "needsFollowUp"],
                "scriptTokens": [
                    { "characterId": "fortuneTeller", "tokenId": "redHerring" }
                ],
                "notes": "다음 낮에 개인 확인"
            }
        }),
    );

    assert_eq!(
        proposal["ok"], true,
        "annotation proposal failed as {proposal}"
    );
    assert_eq!(
        proposal["value"]["event"]["type"],
        "playerAnnotationsUpdated"
    );
    assert_eq!(
        proposal["value"]["event"]["phase"],
        before["value"]["phase"]
    );
    assert_eq!(
        proposal["value"]["event"]["payload"],
        json!({
            "playerId": "player-2",
            "systemTokenIds": ["abilitySpent", "needsFollowUp"],
            "scriptTokens": [
                { "characterId": "fortuneTeller", "tokenId": "redHerring" }
            ],
            "notes": "다음 낮에 개인 확인"
        })
    );

    let annotated_game = with_event(&game, proposal["value"]["event"].clone());
    let annotated = replay(&annotated_game);
    let player = &annotated["value"]["players"][1];
    assert_eq!(
        player["systemTokenIds"],
        json!(["abilitySpent", "needsFollowUp"])
    );
    assert_eq!(
        player["scriptTokens"],
        json!([{ "characterId": "fortuneTeller", "tokenId": "redHerring" }])
    );
    assert_eq!(player["notes"], "다음 낮에 개인 확인");
    assert_eq!(
        annotated["value"]["currentStep"],
        before["value"]["currentStep"]
    );
    assert_eq!(
        annotated["value"]["ruleState"],
        before["value"]["ruleState"]
    );

    let undone = replay(&game);
    assert_eq!(undone["value"]["players"][1]["systemTokenIds"], json!([]));
    assert_eq!(undone["value"]["players"][1]["scriptTokens"], json!([]));
    assert_eq!(undone["value"]["players"][1]["notes"], "");
}

#[test]
fn a_later_annotation_event_replaces_the_complete_player_annotation_snapshot() {
    let first = json!({
        "id": "player-annotations-2",
        "type": "playerAnnotationsUpdated",
        "phase": "firstNight",
        "payload": {
            "playerId": "player-2",
            "systemTokenIds": ["abilitySpent"],
            "scriptTokens": [{ "characterId": "fortuneTeller", "tokenId": "redHerring" }],
            "notes": "첫 메모"
        },
        "summary": "플레이어 표시 수정: 2번 Bert",
        "createdAt": "2026-01-01T00:00:00.000Z"
    });
    let game = game_with_events(json!([setup_event(), first]));
    let proposal = propose(
        &game,
        json!({
            "type": "updatePlayerAnnotations",
            "payload": {
                "playerId": "player-2",
                "expectedEventCount": 2,
                "systemTokenIds": ["protected"],
                "scriptTokens": [],
                "notes": "교체된 메모"
            }
        }),
    );
    assert_eq!(
        proposal["ok"], true,
        "replacement proposal failed as {proposal}"
    );

    let replayed = replay(&with_event(&game, proposal["value"]["event"].clone()));
    let player = &replayed["value"]["players"][1];
    assert_eq!(player["systemTokenIds"], json!(["protected"]));
    assert_eq!(player["scriptTokens"], json!([]));
    assert_eq!(player["notes"], "교체된 메모");
}

#[test]
fn annotation_commands_reject_stale_or_invalid_complete_snapshots() {
    let game = game_with_events(json!([setup_event()]));
    let cases = [
        (
            json!({
                "playerId": "player-2", "expectedEventCount": 0,
                "systemTokenIds": [], "scriptTokens": [], "notes": ""
            }),
            "STALE_COMMAND",
        ),
        (
            json!({
                "playerId": "missing", "expectedEventCount": 1,
                "systemTokenIds": [], "scriptTokens": [], "notes": ""
            }),
            "INVALID_PLAYER_ANNOTATIONS",
        ),
        (
            json!({
                "playerId": "player-2", "expectedEventCount": 1,
                "systemTokenIds": ["poisoned", "poisoned"], "scriptTokens": [], "notes": ""
            }),
            "INVALID_PLAYER_ANNOTATIONS",
        ),
        (
            json!({
                "playerId": "player-2", "expectedEventCount": 1,
                "systemTokenIds": [],
                "scriptTokens": [{ "characterId": "fortuneTeller", "tokenId": "notReal" }],
                "notes": ""
            }),
            "INVALID_PLAYER_ANNOTATIONS",
        ),
        (
            json!({
                "playerId": "player-2", "expectedEventCount": 1,
                "systemTokenIds": [], "scriptTokens": [], "notes": "가".repeat(1001)
            }),
            "INVALID_PLAYER_ANNOTATIONS",
        ),
    ];

    for (payload, expected_code) in cases {
        let actual = propose(
            &game,
            json!({ "type": "updatePlayerAnnotations", "payload": payload }),
        );
        assert_eq!(
            actual["error"]["code"], expected_code,
            "unexpected result: {actual}"
        );
    }
}

fn propose(game: &Value, command: Value) -> Value {
    serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap()
}

fn replay(game: &Value) -> Value {
    serde_json::from_str(&replay_json(&game.to_string())).unwrap()
}

fn with_event(game: &Value, event: Value) -> Value {
    let mut next = game.clone();
    next["game"]["events"].as_array_mut().unwrap().push(event);
    next
}

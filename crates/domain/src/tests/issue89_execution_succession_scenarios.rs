use crate::*;
use serde_json::{json, Value};

#[test]
fn executed_imp_succession_defers_the_character_change_reveal_until_the_new_imps_attack() {
    let mut game: Value = serde_json::from_str(include_str!(
        "../../../../fixtures/acceptance/trouble-brewing/scarlet-woman-succeeds-at-five-plus.json"
    ))
    .unwrap();

    let death = propose(
        &game,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "day:executionDeath",
                "input": { "died": true }
            }
        }),
    );
    assert_eq!(death["ok"], true, "execution death failed as {death}");
    append(&mut game, death["value"]["event"].clone());

    let pending = replay(&game);
    assert_eq!(pending["value"]["phase"], "day");
    assert_eq!(
        pending["value"]["currentStep"]["stepType"],
        "demonSuccession"
    );
    assert_eq!(
        pending["value"]["currentStep"]["requiredInput"]["demonSuccession"],
        json!({
            "kind": "fixed",
            "triggerEventId": death["value"]["event"]["id"],
            "successorPlayerId": "player-6"
        })
    );
    assert!(pending["value"]["currentStep"]["requiredInput"]
        .get("target")
        .is_none());
    assert!(!warning_codes(&pending).contains(&"DEMON_DEAD_GOOD_WIN"));

    let blocked = propose(
        &game,
        json!({
            "type": "confirmStep",
            "payload": { "stepId": "day:toNight", "input": null }
        }),
    );
    assert_eq!(blocked["error"]["code"], "STALE_STEP");

    let succession_step_id = pending["value"]["currentStep"]["id"].as_str().unwrap();
    let succession = propose(
        &game,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": succession_step_id,
                "input": { "successorPlayerId": "player-6" }
            }
        }),
    );
    assert_eq!(succession["ok"], true, "succession failed as {succession}");
    assert_eq!(
        succession["value"]["event"]["type"],
        "demonSuccessionConfirmed"
    );
    assert!(succession["value"].get("revealPayload").is_none());
    append(&mut game, succession["value"]["event"].clone());

    let transformed = replay(&game);
    assert_eq!(transformed["value"]["currentStep"]["id"], "day:toNight");
    assert_eq!(player(&transformed, "player-6")["actualCharacter"], "imp");
    assert_eq!(player(&transformed, "player-6")["shownCharacter"], "imp");
    assert_eq!(player(&transformed, "player-7")["alive"], false);

    let to_night = propose(
        &game,
        json!({
            "type": "confirmStep",
            "payload": { "stepId": "day:toNight", "input": null }
        }),
    );
    assert_eq!(
        to_night["ok"], true,
        "night transition failed as {to_night}"
    );
    append(&mut game, to_night["value"]["event"].clone());

    let mut night = replay(&game);
    while night["value"]["currentStep"]["id"] != "night:imp" {
        let step_id = night["value"]["currentStep"]["id"].as_str().unwrap();
        assert_eq!(night["value"]["currentStep"]["canSkip"], true);
        let skipped = propose(
            &game,
            json!({ "type": "skipStep", "payload": { "stepId": step_id } }),
        );
        assert_eq!(skipped["ok"], true, "skip before Imp failed as {skipped}");
        append(&mut game, skipped["value"]["event"].clone());
        night = replay(&game);
    }
    assert_eq!(night["value"]["currentStep"]["id"], "night:imp");
    assert_eq!(night["value"]["currentStep"]["playerId"], "player-6");
    assert_eq!(
        night["value"]["currentStep"]["preActionReveal"],
        json!({
            "kind": "characterChange",
            "sourceEventId": succession["value"]["event"]["id"],
            "playerId": "player-6",
            "alignment": "evil",
            "characterId": "imp"
        })
    );
}

fn propose(game: &Value, command: Value) -> Value {
    serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap()
}

fn replay(game: &Value) -> Value {
    serde_json::from_str(&replay_json(&game.to_string())).unwrap()
}

fn append(game: &mut Value, event: Value) {
    game["game"]["events"].as_array_mut().unwrap().push(event);
}

fn player<'a>(replayed: &'a Value, player_id: &str) -> &'a Value {
    replayed["value"]["players"]
        .as_array()
        .unwrap()
        .iter()
        .find(|player| player["id"] == player_id)
        .unwrap()
}

fn warning_codes(replayed: &Value) -> Vec<&str> {
    replayed["value"]["warnings"]
        .as_array()
        .unwrap()
        .iter()
        .filter_map(|warning| warning["code"].as_str())
        .collect()
}

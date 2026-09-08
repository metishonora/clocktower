//! Reachable Production JSON relationships; every step is explicitly confirmed.
use super::issue207_acquisition::{confirm, propose, replay};
use serde_json::{json, Value};
pub(super) fn game(minion: &str) -> Value {
    let pool = vec![
        "snakeCharmer",
        "artist",
        "savant",
        "juggler",
        "sage",
        minion,
        "imp",
        "soldier",
        "mayor",
        "virgin",
    ];
    let (action_id, before_snake) = match minion {
        "evilTwin" => ("learnTwin", true),
        "witch" => ("chooseCursedPlayer", true),
        "cerenovus" => ("assignMadness", true),
        _ => panic!("explicit minion required"),
    };
    assert!(before_snake);
    let order = json!([{"kind":"system","actionId":"dusk"},{"kind":"system","actionId":"minionInfo"},{"kind":"system","actionId":"demonInfo"},{"kind":"character","characterId":minion,"actionId":action_id},{"kind":"character","characterId":"snakeCharmer","actionId":"choosePlayer"},{"kind":"system","actionId":"dawn"}]);
    let mut game = json!({"schemaVersion":4,"game":{"id":"relationships","name":"relationships","script":{"type":"custom","definition":{"id":"relationships","name":"relationships","characterIds":pool,"firstNightOrder":order}},"createdAt":"2026-09-08T00:00:00Z","updatedAt":"2026-09-08T00:00:00Z","events":[]}});
    let roster = [
        "snakeCharmer",
        "artist",
        "savant",
        "juggler",
        "sage",
        minion,
        "imp",
    ];
    let players=roster.iter().enumerate().map(|(i,c)|json!({"id":format!("p{}",i+1),"seat":i+1,"name":format!("P{}",i+1),"actualCharacter":c})).collect::<Vec<_>>();
    let command = json!({"type":"createGame","payload":{"players":players}});
    let result: Value = serde_json::from_str(&crate::propose_json(
        &game.to_string(),
        &command.to_string(),
    ))
    .unwrap();
    assert_eq!(result["ok"], true, "{result}");
    game["game"]["events"]
        .as_array_mut()
        .unwrap()
        .push(result["value"]["event"].clone());
    assert_eq!(
        replay(&game)["currentStep"]["id"],
        "firstNight:system:minionInfo"
    );
    confirm(&mut game, Value::Null);
    assert_eq!(
        replay(&game)["currentStep"]["id"],
        "firstNight:system:demonInfo"
    );
    confirm(
        &mut game,
        json!({"characterIds":["soldier","mayor","virgin"]}),
    );
    game
}
#[test]
fn twin_swap_creates_one_causal_repair_and_undo_restores_both_prefixes() {
    let mut game = game("evilTwin");
    assert_eq!(replay(&game)["currentStep"]["character"], "evilTwin");
    assert_eq!(propose(&game, json!({"playerIds":["p7"]}))["ok"], false);
    let proposal = propose(&game, json!({"playerIds":["p1"]}));
    assert_eq!(
        proposal["value"]["revealPayload"],
        json!({"kind":"evilTwinPair","players":[{"playerId":"p6","seat":6,"name":"P6","alignment":"evil","characterId":"evilTwin"},{"playerId":"p1","seat":1,"name":"P1","alignment":"good","characterId":"snakeCharmer"}]})
    );
    let first = confirm(&mut game, json!({"playerIds":["p1"]}));
    let before_swap = game.clone();
    let swap = confirm(&mut game, json!({"playerIds":["p7"]}));
    let state = replay(&game);
    assert_eq!(state["currentStep"]["character"], "evilTwin");
    assert_eq!(
        state["currentStep"]["followUpCause"],
        json!({"triggerEventId":swap["id"],"relationshipEventId":first["id"]})
    );
    let pending = game.clone();
    let repair = propose(&game, json!({"playerIds":["p2"]}));
    assert_eq!(repair, propose(&game, json!({"playerIds":["p2"]})));
    confirm(&mut game, json!({"playerIds":["p2"]}));
    let state = replay(&game);
    assert_eq!(state["currentStep"]["id"], "firstNight:system:dawn");
    assert_eq!(
        state["ruleState"]["twinRelationships"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
    assert_eq!(
        state["ruleState"]["twinRelationships"][0]["effective"],
        false
    );
    assert_eq!(
        state["ruleState"]["twinRelationships"][1]["targetPlayerId"],
        "p2"
    );
    game["game"]["events"].as_array_mut().unwrap().pop();
    assert_eq!(replay(&game), replay(&pending));
    game["game"]["events"].as_array_mut().unwrap().pop();
    assert_eq!(replay(&game), replay(&before_swap));
    let mut forged = pending.clone();
    let mut bad = repair["value"]["event"].clone();
    bad["payload"]["followUpCause"]["triggerEventId"] = json!(first["id"]);
    forged["game"]["events"].as_array_mut().unwrap().push(bad);
    let result: Value = serde_json::from_str(&crate::replay_json(&forged.to_string())).unwrap();
    assert_eq!(result["ok"], false);
}

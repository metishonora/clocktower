//! Production JSON scenarios with explicit immutable definitions and explicit commands.
use serde_json::{json, Value};
const POOL: [&str; 10] = [
    "philosopher",
    "snakeCharmer",
    "artist",
    "savant",
    "juggler",
    "scarletWoman",
    "noDashii",
    "soldier",
    "mayor",
    "virgin",
];
pub(super) fn game(roster: &[&str]) -> Value {
    let order = json!([{"kind":"system","actionId":"dusk"},{"kind":"system","actionId":"minionInfo"},{"kind":"system","actionId":"demonInfo"},{"kind":"character","characterId":"philosopher","actionId":"chooseAbility"},{"kind":"character","characterId":"snakeCharmer","actionId":"choosePlayer"},{"kind":"system","actionId":"dawn"}]);
    let mut game = json!({"schemaVersion":4,"game":{"id":"snv-207","name":"SnV","script":{"type":"custom","definition":{"id":"snv-207","name":"SnV","characterIds":POOL,"firstNightOrder":order}},"createdAt":"2026-09-08T00:00:00Z","updatedAt":"2026-09-08T00:00:00Z","events":[]}});
    let players=roster.iter().enumerate().map(|(i,c)|json!({"id":format!("p{}",i+1),"seat":i+1,"name":format!("P{}",i+1),"actualCharacter":c})).collect::<Vec<_>>();
    let command = json!({"type":"createGame","payload":{"players":players}});
    let proposal: Value = serde_json::from_str(&crate::propose_json(
        &game.to_string(),
        &command.to_string(),
    ))
    .unwrap();
    assert_eq!(proposal["ok"], true, "{proposal}");
    game["game"]["events"]
        .as_array_mut()
        .unwrap()
        .push(proposal["value"]["event"].clone());
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
pub(super) fn replay(game: &Value) -> Value {
    let result: Value = serde_json::from_str(&crate::replay_json(&game.to_string())).unwrap();
    assert_eq!(result["ok"], true, "{result}");
    result["value"].clone()
}
pub(super) fn propose(game: &Value, input: Value) -> Value {
    let step = replay(game)["currentStep"].clone();
    let command = json!({"type":"confirmStep","payload":{"stepId":step["id"],"expectedEventCount":game["game"]["events"].as_array().unwrap().len(),"input":input}});
    serde_json::from_str(&crate::propose_json(
        &game.to_string(),
        &command.to_string(),
    ))
    .unwrap()
}
pub(super) fn confirm(game: &mut Value, input: Value) -> Value {
    let proposal = propose(game, input);
    assert_eq!(proposal["ok"], true, "{proposal}");
    let event = proposal["value"]["event"].clone();
    game["game"]["events"]
        .as_array_mut()
        .unwrap()
        .push(event.clone());
    replay(game);
    event
}
#[test]
fn philosopher_defers_acquires_and_self_drinks_without_changing_identity() {
    let initial = game(&[
        "philosopher",
        "snakeCharmer",
        "artist",
        "noDashii",
        "savant",
        "juggler",
        "scarletWoman",
    ]);
    let mut deferred = initial.clone();
    let event = confirm(&mut deferred, Value::Null);
    assert_eq!(event["payload"]["result"]["kind"], "philosopherDeferred");
    assert!(replay(&deferred)["ruleState"].get("abilityUses").is_none());
    let mut acquired = initial.clone();
    let before = replay(&acquired)["players"][0].clone();
    let proposal = propose(&acquired, json!({"characterIds":["artist"]}));
    assert_eq!(
        proposal,
        propose(&acquired, json!({"characterIds":["artist"]}))
    );
    assert_eq!(acquired, initial);
    confirm(&mut acquired, json!({"characterIds":["artist"]}));
    let state = replay(&acquired);
    assert_eq!(state["players"][0], before);
    assert_eq!(
        state["ruleState"]["abilityGrants"][0]["characterId"],
        "artist"
    );
    assert_eq!(
        state["ruleState"]["abilityUses"].as_array().unwrap().len(),
        1
    );
    let mut self_choice = initial.clone();
    confirm(&mut self_choice, json!({"characterIds":["philosopher"]}));
    let state = replay(&self_choice);
    assert!(state["ruleState"].get("abilityGrants").is_none());
    assert_eq!(
        state["ruleState"]["philosopherChoices"][0]["outcome"],
        "selfDrunk"
    );
    assert!(state["ruleState"]["activeImpairments"]
        .as_array()
        .unwrap()
        .iter()
        .any(|i| i["playerId"] == "p1" && i["kind"] == "drunk"));
    for input in [
        json!({"characterIds":["noDashii"]}),
        json!({"characterIds":["dreamer"]}),
        json!({"characterIds":["artist"],"playerIds":["p1"]}),
    ] {
        assert_eq!(propose(&initial, input)["ok"], false);
    }
}
#[test]
fn acquired_snake_preserves_original_owner_priority_and_swaps_actual_philosopher() {
    let mut game = game(&[
        "philosopher",
        "snakeCharmer",
        "artist",
        "noDashii",
        "savant",
        "juggler",
        "scarletWoman",
    ]);
    confirm(&mut game, json!({"characterIds":["snakeCharmer"]}));
    assert_eq!(replay(&game)["currentStep"]["playerId"], "p2");
    let failed = confirm(&mut game, json!({"playerIds":["p4"]}));
    assert_eq!(failed["payload"]["result"]["outcome"], "impaired");
    assert_eq!(replay(&game)["currentStep"]["playerId"], "p1");
    let before = game.clone();
    let event = confirm(&mut game, json!({"playerIds":["p4"]}));
    let state = replay(&game);
    assert_eq!(state["players"][0]["actualCharacter"], "noDashii");
    assert_eq!(state["players"][0]["alignment"], "evil");
    assert_eq!(state["players"][3]["actualCharacter"], "philosopher");
    assert_eq!(state["players"][3]["alignment"], "good");
    assert!(state["ruleState"].get("abilityGrants").is_none());
    assert_eq!(state["currentStep"]["id"], "firstNight:system:dawn");
    assert_eq!(
        state["pendingIdentityReveals"],
        json!([{"sourceEventId":event["id"],"sequence":0,"payload":{"kind":"characterChange","playerId":"p1","characterId":"noDashii","alignment":"evil"}},{"sourceEventId":event["id"],"sequence":1,"payload":{"kind":"characterChange","playerId":"p4","characterId":"philosopher","alignment":"good"}}])
    );
    let mut forged = game.clone();
    forged["game"]["events"]
        .as_array_mut()
        .unwrap()
        .last_mut()
        .unwrap()["payload"]["result"]["outcome"] = json!("notDemon");
    let rejected: Value = serde_json::from_str(&crate::replay_json(&forged.to_string())).unwrap();
    assert_eq!(rejected["ok"], false);
    game["game"]["events"].as_array_mut().unwrap().pop();
    assert_eq!(game, before);
}
#[test]
fn no_dashii_swap_recovers_failed_philosopher_and_removes_unfinished_simulation() {
    let mut game = game(&[
        "snakeCharmer",
        "artist",
        "savant",
        "philosopher",
        "noDashii",
        "scarletWoman",
        "juggler",
    ]);
    confirm(&mut game, json!({"characterIds":["snakeCharmer"]}));
    let state = replay(&game);
    assert_eq!(
        state["ruleState"]["philosopherChoices"][0]["outcome"],
        "failed"
    );
    assert!(state["ruleState"].get("abilityGrants").is_none());
    // Seats put the real source before the simulation, without changing existing source ordering.
    assert_eq!(state["currentStep"]["playerId"], "p1");
    confirm(&mut game, json!({"playerIds":["p5"]}));
    let state = replay(&game);
    assert!(!state["ruleState"]["activeImpairments"]
        .as_array()
        .unwrap()
        .iter()
        .any(|i| i["playerId"] == "p4"));
    assert_eq!(
        state["ruleState"]["philosopherChoices"][0]["outcome"],
        "failed"
    );
    assert!(state["ruleState"].get("abilityGrants").is_none());
    assert_eq!(state["currentStep"]["id"], "firstNight:system:dawn");
    confirm(&mut game, Value::Null);
    assert_eq!(replay(&game)["phase"], "day");
}

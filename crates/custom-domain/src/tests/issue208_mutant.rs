use super::issue207_acquisition::replay;
use super::issue207_information::take;
use super::issue208_information::{seed, start};
use serde_json::{json, Value};
fn optional(game: &Value, execute: bool) -> Value {
    let state = replay(game);
    let step = state["availableActions"]
        .as_array()
        .unwrap()
        .iter()
        .find(|s| s["character"] == "mutant")
        .unwrap();
    serde_json::from_str(&crate::propose_json(&game.to_string(),&json!({"type":"confirmStep","payload":{"stepId":step["id"],"expectedEventCount":game["game"]["events"].as_array().unwrap().len(),"input":{"execute":execute}}}).to_string())).unwrap()
}
#[test]
fn optional_good_twin_execution_ends_game_and_undo_restores_entire_prefix() {
    let mut game = start(&seed("mutant-good-twin"));
    take(
        &mut game,
        "assignTwin",
        json!({"playerIds":["mutant"]}),
        None,
        vec![],
    );
    let before = replay(&game);
    let proposal = optional(&game, true);
    assert_eq!(proposal["ok"], true, "{proposal}");
    assert_eq!(
        proposal["value"]["revealPayload"]["player"]["playerId"],
        "mutant"
    );
    assert!(proposal["value"]["revealPayload"]
        .get("winningAlignment")
        .is_none());
    game["game"]["events"]
        .as_array_mut()
        .unwrap()
        .push(proposal["value"]["event"].clone());
    let ended = replay(&game);
    assert_eq!(ended["gameEnd"]["winningAlignment"], "evil");
    assert_eq!(ended["gameEnd"]["reason"], "goodTwinExecuted");
    assert_eq!(ended["phase"], "firstNight");
    assert!(ended["currentStep"].is_null());
    assert!(ended["availableActions"]
        .as_array()
        .is_none_or(|v| v.is_empty()));
    let rejected:Value=serde_json::from_str(&crate::propose_json(&game.to_string(),&json!({"type":"confirmStep","payload":{"stepId":before["currentStep"]["id"],"expectedEventCount":game["game"]["events"].as_array().unwrap().len(),"input":null}}).to_string())).unwrap();
    assert_eq!(rejected["ok"], false);
    game["game"]["events"].as_array_mut().unwrap().pop();
    assert_eq!(replay(&game), before);
}
#[test]
fn declining_optional_execution_keeps_regular_step_and_changes_request_prefix() {
    let mut game = start(&seed("mutant-good-twin"));
    take(
        &mut game,
        "assignTwin",
        json!({"playerIds":["mutant"]}),
        None,
        vec![],
    );
    let before = replay(&game);
    let proposal = optional(&game, false);
    assert_eq!(proposal["ok"], true, "{proposal}");
    assert!(proposal["value"]["revealPayload"].is_null());
    game["game"]["events"]
        .as_array_mut()
        .unwrap()
        .push(proposal["value"]["event"].clone());
    let after = replay(&game);
    assert_eq!(after["currentStep"], before["currentStep"]);
    assert_ne!(after["availableActions"], before["availableActions"]);
    assert!(after["gameEnd"].is_null());
}
#[test]
fn poisoned_mutant_decision_has_no_execution_and_healthy_execution_resumes_original_step() {
    use super::issue208_information::{roster_game, system};
    for poisoned in [false, true] {
        let mut game = roster_game(&[
            ("mathematician", None),
            ("monk", None),
            ("virgin", None),
            ("slayer", None),
            ("soldier", None),
            ("mutant", None),
            ("poisoner", None),
            ("imp", None),
        ]);
        system(&mut game);
        take(
            &mut game,
            "choosePoisonTarget",
            json!({"playerIds":[if poisoned{"p6"}else{"p2"}]}),
            None,
            vec![],
        );
        let before = replay(&game);
        let result = optional(&game, true);
        assert_eq!(result["ok"], true, "{result}");
        assert_eq!(
            result["value"]["event"]["payload"]["result"]["executed"],
            !poisoned
        );
        game["game"]["events"]
            .as_array_mut()
            .unwrap()
            .push(result["value"]["event"].clone());
        let after = replay(&game);
        assert!(after["gameEnd"].is_null());
        assert_eq!(after["currentStep"]["id"], before["currentStep"]["id"]);
        assert_eq!(after["players"][5]["alive"], poisoned);
        assert_eq!(
            after["currentStep"]["informationPrompt"]["computedResult"]["value"],
            u64::from(poisoned)
        );
    }
}

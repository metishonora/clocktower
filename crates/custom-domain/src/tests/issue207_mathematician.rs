//! Production audit prefixes. No injected audit facts stand in for reachable play.
use super::issue207_acquisition::replay;
use super::issue207_information::{game, number, proposal, take, ORDER};
use serde_json::{json, Value};
#[test]
fn impaired_correct_information_is_not_counted_but_incorrect_information_is() {
    // No Dashii at 4 poisons Clockmaker at 3 and Artist at 5; Mathematician at 1 is healthy.
    let initial = game(
        &[
            "mathematician",
            "savant",
            "clockmaker",
            "noDashii",
            "artist",
            "juggler",
            "scarletWoman",
        ],
        &ORDER,
    );
    for (delivered, expected) in [(3, 0), (1, 1)] {
        let mut game = initial.clone();
        take(
            &mut game,
            "clockmaker",
            Value::Null,
            number(delivered),
            vec![],
        );
        let result = take(&mut game, "mathematician", Value::Null, None, vec![]);
        assert_eq!(result["revealPayload"]["value"], expected);
    }
}
#[test]
fn original_and_acquired_mathematicians_use_separate_confirmation_prefixes() {
    let mut game = game(
        &[
            "philosopher",
            "mathematician",
            "artist",
            "savant",
            "juggler",
            "scarletWoman",
            "imp",
        ],
        &ORDER,
    );
    take(
        &mut game,
        "philosopher",
        json!({"characterIds":["mathematician"]}),
        None,
        vec![],
    );
    assert_eq!(replay(&game)["currentStep"]["playerId"], "p2");
    let original = take(&mut game, "mathematician", Value::Null, number(2), vec![]);
    assert_eq!(
        original["event"]["payload"]["result"]["information"]["computedResult"]["value"],
        0
    );
    assert_eq!(replay(&game)["currentStep"]["playerId"], "p1");
    let acquired = take(&mut game, "mathematician", Value::Null, None, vec![]);
    assert_eq!(acquired["revealPayload"]["value"], 1);
    let snapshots = crate::game::completed_snapshots_for_tests(
        crate::boundary::parse_game_file(&game.to_string()).unwrap(),
    )
    .unwrap();
    let historical = snapshots
        .iter()
        .find(|s| s.step.player_id.as_deref() == Some("p2"))
        .unwrap();
    assert_eq!(
        serde_json::to_value(&historical.reveal_payload).unwrap(),
        json!({"kind":"numericInformation","characterId":"mathematician","value":2})
    );
}
#[test]
fn failed_philosopher_and_incorrect_simulated_information_count_one_real_player() {
    let order = [
        "philosopher",
        "seamstress",
        "snakeCharmer",
        "evilTwin",
        "witch",
        "cerenovus",
        "clockmaker",
        "dreamer",
        "mathematician",
    ];
    let mut game = game(
        &[
            "snakeCharmer",
            "artist",
            "mathematician",
            "philosopher",
            "noDashii",
            "scarletWoman",
            "savant",
        ],
        &order,
    );
    let choice = take(
        &mut game,
        "philosopher",
        json!({"characterIds":["seamstress"]}),
        None,
        vec![],
    );
    let state = replay(&game);
    assert!(state["currentStep"].get("abilityUse").is_none());
    assert_eq!(
        state["currentStep"]["simulationSource"]["selectionEventId"],
        choice["event"]["id"]
    );
    let simulation = take(
        &mut game,
        "seamstress",
        json!({"playerIds":["p2","p3"]}),
        Some(json!({"kind":"boolean","value":false})),
        vec![],
    );
    assert_eq!(
        simulation["event"]["payload"]["result"]["kind"],
        "simulation"
    );
    assert_eq!(simulation["event"]["payload"]["result"]["spent"], true);
    take(
        &mut game,
        "snakeCharmer",
        json!({"playerIds":["p5"]}),
        None,
        vec![],
    );
    let state = replay(&game);
    let records = state["currentStep"]["informationPrompt"]["mathematicianAudit"]["records"]
        .as_array()
        .unwrap();
    assert_eq!(records.len(), 1);
    assert_eq!(records[0]["subjectPlayerId"], "p4");
    assert_eq!(records[0]["characterId"], "philosopher");
    assert_eq!(
        records[0]["abilityInstanceId"],
        choice["event"]["payload"]["abilityUse"]["abilityInstanceId"]
    );
    assert_eq!(records[0]["evidence"].as_array().unwrap().len(), 2);
    let math = take(&mut game, "mathematician", Value::Null, None, vec![]);
    assert_eq!(math["revealPayload"]["value"], 1);
    assert!(replay(&game)["ruleState"].get("abilityGrants").is_none());
}
#[test]
fn vortox_still_forbids_truth_when_original_mathematician_is_philosopher_drunk() {
    let mut game = game(
        &[
            "philosopher",
            "mathematician",
            "artist",
            "savant",
            "juggler",
            "scarletWoman",
            "vortox",
        ],
        &ORDER,
    );
    take(
        &mut game,
        "philosopher",
        json!({"characterIds":["mathematician"]}),
        None,
        vec![],
    );
    assert_eq!(proposal(&game, Value::Null, number(0), vec![])["ok"], false);
    take(&mut game, "mathematician", Value::Null, number(2), vec![]);
    assert_eq!(proposal(&game, Value::Null, number(1), vec![])["ok"], false);
    take(&mut game, "mathematician", Value::Null, number(0), vec![]);
}

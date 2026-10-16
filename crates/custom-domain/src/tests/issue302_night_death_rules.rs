//! Public command/replay regressions for the cross-script Festival scenario.
use super::issue207_acquisition::confirm;
use super::issue225_nights::{day, propose, replay};
use super::issue237_carousel::configured_game;
use serde_json::{json, Value};

fn first_night(game: &mut Value) {
    for _ in 0..30 {
        let state = replay(game);
        if state["phase"] == "day" {
            return;
        }
        let step = &state["currentStep"];
        if !step["informationPrompt"]["computedResult"].is_null() {
            super::issue225_nights::step(
                game,
                step["actionRef"].clone(),
                Value::Null,
                Some(step["informationPrompt"]["computedResult"].clone()),
            );
            continue;
        }
        let input = match step["actionRef"]["actionId"].as_str().unwrap() {
            "demonInfo" => {
                json!({"characterIds":step["requiredInput"]["allowedCharacterIds"].as_array().unwrap()[..3]})
            }
            "choosePoisonTarget" => json!({"playerIds":["p1"]}),
            _ => Value::Null,
        };
        confirm(game, input);
    }
    panic!("first night did not finish");
}
fn game(roles: &[&str]) -> Value {
    let mut game = configured_game(roles, None, "nightwatchman");
    let scenario: Value = serde_json::from_str(include_str!(
        "../../../../fixtures/acceptance/issue302/festival.scenario.json"
    ))
    .unwrap();
    game["game"]["script"]["definition"] = scenario["scenario"].clone();
    game["game"]["script"]["definition"]["id"] = json!("festival-302");
    first_night(&mut game);
    game
}
fn execute(game: &mut Value, id: &str) {
    for _ in 0..3 {
        day(game, json!({"kind":"advance"}));
    }
    let state = replay(game);
    let actor = state["day"]["eligibleNominatorIds"][0].clone();
    day(
        game,
        json!({"kind":"nominate","nominatorId":actor,"nomineeId":id}),
    );
    let voters: Vec<_> = replay(game)["players"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|p| p["alive"] == true)
        .map(|p| p["id"].clone())
        .collect();
    day(game, json!({"kind":"vote","voterIds":voters}));
    day(game, json!({"kind":"closeNominations"}));
    day(game, json!({"kind":"confirmExecution"}));
    if !replay(game)["day"]["pendingDeath"].is_null() {
        day(game, json!({"kind":"confirmDeath"}));
    }
}
fn next_night(game: &mut Value) {
    day(game, json!({"kind":"beginNight"}));
}
fn finish_night(game: &mut Value) {
    while replay(game)["phase"] != "day" {
        confirm(game, Value::Null);
    }
}
fn roundtrip_and_undo(game: &Value, before: &Value) {
    crate::game::clear_replay_prefix_for_tests();
    let restored: Value = serde_json::from_str(&game.to_string()).unwrap();
    assert_eq!(replay(&restored), replay(game));
    let mut undo = restored;
    undo["game"]["events"]
        .as_array_mut()
        .unwrap()
        .truncate(before["game"]["events"].as_array().unwrap().len());
    assert_eq!(replay(&undo), replay(before));
}

#[test]
fn terminal_night_death_blocks_assassin_and_preserves_the_causal_winner() {
    let mut g = game(&["artist", "slayer", "fool", "assassin", "imp"]);
    execute(&mut g, "p1");
    next_night(&mut g);
    confirm(&mut g, json!({"playerIds":["p1"]}));
    finish_night(&mut g);
    execute(&mut g, "p2");
    next_night(&mut g);
    confirm(&mut g, json!({"playerIds":["p3"]}));
    finish_night(&mut g);
    super::issue225_nights::begin_night(&mut g);
    let before = g.clone();
    let death = confirm(&mut g, json!({"playerIds":["p3"]}));
    let state = replay(&g);
    assert_eq!(state["day"]["pendingGameEnd"]["winningAlignment"], "evil");
    assert_eq!(state["day"]["pendingGameEnd"]["sourceEventId"], death["id"]);
    assert!(state["currentStep"].is_null());
    assert!(state["availableActions"]
        .as_array()
        .is_none_or(Vec::is_empty));
    assert_eq!(
        propose(
            &g,
            json!({"type":"confirmStep","payload":{"stepId":"late-assassin","input":{"playerIds":["p5"]}}})
        )["ok"],
        false
    );
    day(&mut g, json!({"kind":"confirmGameEnd"}));
    assert_eq!(replay(&g)["gameEnd"]["winningAlignment"], "evil");
    assert_eq!(
        replay(&g)["latestUndoUnit"]["eventIds"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
    roundtrip_and_undo(&g, &before);
}

fn moonchild_mayor() -> Value {
    moonchild_with_minion("assassin")
}
fn moonchild_with_minion(minion: &str) -> Value {
    let mut g = game(&[
        "mayor",
        "artist",
        "slayer",
        "fool",
        "monk",
        "moonchild",
        minion,
        "imp",
    ]);
    execute(&mut g, "p6");
    let consequence = replay(&g)["day"]["consequences"][0]["id"].clone();
    day(
        &mut g,
        json!({"kind":"resolveConsequence","consequenceId":consequence,"playerId":"p1"}),
    );
    next_night(&mut g);
    if minion == "poisoner" {
        confirm(&mut g, json!({"playerIds":["p1"]}));
    }
    confirm(&mut g, json!({"playerIds":["p2"]})); // Monk protection is only against Demons.
    confirm(&mut g, json!({"playerIds":["p6"]}));
    if minion == "assassin" {
        confirm(&mut g, Value::Null);
    }
    assert_eq!(replay(&g)["currentStep"]["character"], "moonchild");
    g
}

#[test]
fn moonchild_direct_death_keeps_omitted_input_compatible() {
    let original = moonchild_mayor();
    for input in [Value::Null, json!({"mayorDecision":{"kind":"mayorDies"}})] {
        let mut g = original.clone();
        confirm(&mut g, input);
        assert_eq!(replay(&g)["players"][0]["alive"], false);
        roundtrip_and_undo(&g, &original);
    }
}

#[test]
fn moonchild_redirect_keeps_fool_protection_and_dead_target_semantics() {
    let original = moonchild_mayor();
    for target in ["p4", "p6"] {
        let mut g = original.clone();
        let e = confirm(
            &mut g,
            json!({"mayorDecision":{"kind":"bounce","targetPlayerId":target}}),
        );
        assert_eq!(e["payload"]["result"]["deaths"][0]["died"], false);
        assert_eq!(replay(&g)["players"][0]["alive"], true);
        if target == "p4" {
            assert_eq!(
                e["payload"]["result"]["deaths"][0]["prevention"]["source"]["characterId"],
                "fool"
            );
        } else {
            assert!(e["payload"]["result"]["deaths"][0]["prevention"].is_null());
        }
        roundtrip_and_undo(&g, &original);
    }
}

#[test]
fn redirect_rejects_self_unknown_and_poisoned_mayor_choices() {
    for (minion, targets) in [
        ("assassin", vec!["p1", "unknown"]),
        ("poisoner", vec!["p2"]),
    ] {
        let g = moonchild_with_minion(minion);
        let state = replay(&g);
        if minion == "poisoner" {
            assert!(state["currentStep"]["requiredInput"]["mayorDecision"].is_null());
        }
        for target in targets {
            let invalid = propose(
                &g,
                json!({"type":"confirmStep","payload":{
                    "stepId":state["currentStep"]["id"],"input":{"mayorDecision":{"kind":"bounce","targetPlayerId":target}}
                }}),
            );
            assert_eq!(invalid["ok"], false);
        }
        if minion == "poisoner" {
            let mut g = g;
            confirm(&mut g, Value::Null);
            assert_eq!(replay(&g)["players"][0]["alive"], false);
        }
    }
}

#[test]
fn moonchild_redirected_demon_death_ends_before_dawn() {
    let mut g = moonchild_mayor();
    let before = g.clone();
    let e = confirm(
        &mut g,
        json!({"mayorDecision":{"kind":"bounce","targetPlayerId":"p8"}}),
    );
    let state = replay(&g);
    assert_eq!(state["day"]["pendingGameEnd"]["winningAlignment"], "good");
    assert_eq!(state["day"]["pendingGameEnd"]["sourceEventId"], e["id"]);
    assert!(state["currentStep"].is_null());
    roundtrip_and_undo(&g, &before);
}

#[test]
fn assassin_scarlet_succession_settles_before_the_win_check() {
    let mut g = game(&[
        "mayor",
        "artist",
        "slayer",
        "fool",
        "monk",
        "gambler",
        "empath",
        "assassin",
        "scarletWoman",
        "imp",
    ]);
    execute(&mut g, "p2");
    next_night(&mut g);
    confirm(
        &mut g,
        json!({"playerIds":["p6"],"characterIds":["gambler"]}),
    );
    confirm(&mut g, json!({"playerIds":["p1"]}));
    confirm(&mut g, json!({"playerIds":["p2"]}));
    let before = g.clone();
    confirm(&mut g, json!({"playerIds":["p10"]}));
    let state = replay(&g);
    assert_eq!(state["players"][8]["actualCharacter"], "imp");
    assert_eq!(state["phase"], "night");
    assert!(state["day"]["pendingGameEnd"].is_null());
    roundtrip_and_undo(&g, &before);
}

#[test]
fn moonchild_mayor_redirects_to_a_monk_protected_target_and_replays() {
    let mut g = moonchild_mayor();
    let before = g.clone();
    let state = replay(&g);
    assert_eq!(
        state["currentStep"]["requiredInput"]["mayorDecision"]["mayorPlayerId"],
        "p1"
    );
    let event = confirm(
        &mut g,
        json!({"mayorDecision":{"kind":"bounce","targetPlayerId":"p2"}}),
    );
    assert_eq!(event["payload"]["result"]["deaths"][0]["playerId"], "p2");
    assert_eq!(event["payload"]["result"]["deaths"][0]["died"], true);
    let state = replay(&g);
    assert_eq!(state["players"][0]["alive"], true);
    assert_eq!(state["players"][1]["alive"], false);
    roundtrip_and_undo(&g, &before);
}

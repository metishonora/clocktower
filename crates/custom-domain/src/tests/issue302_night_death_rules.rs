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
    game_with_pool(roles, &[])
}
fn game_with_pool(roles: &[&str], extra: &[&str]) -> Value {
    let mut game = configured_game(roles, None, "nightwatchman");
    let scenario: Value = serde_json::from_str(include_str!(
        "../../../../fixtures/acceptance/issue302/festival.scenario.json"
    ))
    .unwrap();
    game["game"]["script"]["definition"] = scenario["scenario"].clone();
    game["game"]["script"]["definition"]["id"] = json!("festival-302");
    let definition = &mut game["game"]["script"]["definition"];
    let mut extended = false;
    for role in roles.iter().chain(extra) {
        let pool = definition["characterIds"].as_array_mut().unwrap();
        if !pool.contains(&json!(role)) {
            pool.push(json!(role));
            extended = true;
        }
    }
    if extended {
        let mut request = definition.clone();
        request.as_object_mut().unwrap().remove("firstNightOrder");
        request.as_object_mut().unwrap().remove("otherNightOrder");
        for (field, query) in [
            (
                "firstNightOrder",
                crate::custom_first_night_plan_json as fn(&str) -> String,
            ),
            ("otherNightOrder", crate::custom_other_night_plan_json),
        ] {
            let result: Value =
                serde_json::from_str(&query(&json!({"customDefinition":request}).to_string()))
                    .unwrap();
            assert_eq!(result["ok"], true, "{result}");
            definition[field] = result["value"]["plan"].clone();
        }
    }
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

#[test]
fn old_completed_night_keeps_its_dawn_confirmation_and_warm_cold_replay_agree() {
    // Recorded with develop d64e429 before immediate night endings were introduced.
    let full: Value = serde_json::from_str(include_str!(
        "../../../../fixtures/acceptance/issue302/legacy-night-end.game.json"
    ))
    .unwrap();
    let events = full["game"]["events"].as_array().unwrap();
    let terminal_count = events.len() - 2; // terminal attack, dawn, confirmation
    let expected_end = json!({"winningAlignment":"evil", "reason":"twoLivingPlayers", "sourceEventId":events[events.len()-2]["id"]});
    for count in terminal_count..=events.len() {
        let mut prefix = full.clone();
        prefix["game"]["events"]
            .as_array_mut()
            .unwrap()
            .truncate(count);
        crate::game::clear_replay_prefix_for_tests();
        let cold = replay(&prefix);
        let mut shorter = prefix.clone();
        shorter["game"]["events"].as_array_mut().unwrap().pop();
        replay(&shorter);
        assert_eq!(replay(&prefix), cold, "cached prefix length {}", count - 1);
        assert!(cold["currentStep"].is_null());
        if count == events.len() {
            assert_eq!(cold["gameEnd"], expected_end);
        } else {
            assert_eq!(cold["day"]["pendingGameEnd"]["winningAlignment"], "evil");
            assert_eq!(
                cold["day"]["pendingGameEnd"]["sourceEventId"],
                events[count - 1]["id"]
            );
        }
    }
}

#[test]
fn old_harmless_night_suffix_replays_but_an_assassin_winner_reversal_is_rejected() {
    let original: Value = serde_json::from_str(include_str!(
        "../../../../fixtures/acceptance/issue302/terminal-imp.game.json"
    ))
    .unwrap();
    let suffixes: Value = serde_json::from_str(include_str!(
        "../../../../fixtures/acceptance/issue302/legacy-night-end-suffixes.json"
    ))
    .unwrap();
    for label in ["skipped", "reversal"] {
        let mut g = original.clone();
        g["game"]["events"]
            .as_array_mut()
            .unwrap()
            .extend(suffixes[label].as_array().unwrap().iter().cloned());
        crate::game::clear_replay_prefix_for_tests();
        if label == "skipped" {
            assert_eq!(replay(&g)["gameEnd"]["winningAlignment"], "evil");
            // Undo the old dawn + confirmation, then the newly derived pending win is
            // still terminal; a legacy suffix never permits a new live Assassin action.
            let remaining = g["game"]["events"].as_array().unwrap().len() - 2;
            g["game"]["events"]
                .as_array_mut()
                .unwrap()
                .truncate(remaining);
            assert!(replay(&g)["currentStep"].is_null());
            assert_eq!(
                replay(&g)["day"]["pendingGameEnd"]["winningAlignment"],
                "evil"
            );
            assert_eq!(replay(&g)["gameEnd"], Value::Null);
        } else {
            assert_eq!(super::issue225_nights::result(&g)["ok"], false);
            let mut terminal = original.clone();
            terminal["game"]["events"]
                .as_array_mut()
                .unwrap()
                .push(suffixes[label][0].clone());
            replay(&terminal);
            assert_eq!(super::issue225_nights::result(&g)["ok"], false);
        }
    }
}

fn demon_to_twin(poisoned: bool) -> Value {
    let mut roster = vec![
        "artist",
        "slayer",
        "fool",
        "soldier",
        if poisoned { "poisoner" } else { "monk" },
        "pitHag",
        "imp",
    ];
    if poisoned {
        roster.extend(["empath", "gambler", "monk"]); // Ten players admit two Minions.
    }
    let mut g = game_with_pool(&roster, &["evilTwin"]);
    execute(&mut g, "p1");
    next_night(&mut g);
    while replay(&g)["currentStep"]["character"] != "pitHag" {
        let s = replay(&g);
        let input = match s["currentStep"]["character"].as_str().unwrap() {
            "poisoner" => json!({"playerIds":["p7"]}),
            "monk" => json!({"playerIds":["p2"]}),
            "gambler" => json!({"playerIds":["p9"],"characterIds":["gambler"]}),
            other => panic!("unexpected step: {other}"),
        };
        confirm(&mut g, input);
    }
    g
}

#[test]
fn last_demon_becoming_twin_sets_its_pair_before_deciding_good_victory() {
    for target in ["p2", "p1"] {
        let mut g = demon_to_twin(false);
        let before = g.clone();
        confirm(
            &mut g,
            json!({"playerIds":["p7"],"characterIds":["evilTwin"]}),
        );
        let state = replay(&g);
        assert!(state["day"]["pendingGameEnd"].is_null());
        assert_eq!(state["currentStep"]["actionRef"]["actionId"], "assignTwin");
        roundtrip_and_undo(&g, &before);
        let before_assignment = g.clone();
        let assigned = confirm(&mut g, json!({"playerIds":[target]}));
        let state = replay(&g);
        if target == "p1" {
            assert_eq!(state["day"]["pendingGameEnd"]["winningAlignment"], "good");
            assert_eq!(
                state["day"]["pendingGameEnd"]["sourceEventId"],
                assigned["id"]
            );
            assert!(state["currentStep"].is_null());
        } else {
            assert_eq!(state["phase"], "night");
            assert!(state["day"]["pendingGameEnd"].is_null());
        }
        roundtrip_and_undo(&g, &before_assignment);
    }
}

#[test]
fn an_impaired_new_twin_does_not_postpone_the_win() {
    let mut g = demon_to_twin(true);
    let before = g.clone();
    let changed = confirm(
        &mut g,
        json!({"playerIds":["p7"],"characterIds":["evilTwin"]}),
    );
    let state = replay(&g);
    assert!(state["currentStep"].is_null());
    assert_eq!(state["day"]["pendingGameEnd"]["winningAlignment"], "good");
    assert_eq!(
        state["day"]["pendingGameEnd"]["sourceEventId"],
        changed["id"]
    );
    roundtrip_and_undo(&g, &before);
}

#[test]
fn mathematician_counts_the_moonchild_redirect_once_even_with_fool_or_dead_target() {
    let mut original = game(&[
        "mayor",
        "artist",
        "slayer",
        "fool",
        "mathematician",
        "moonchild",
        "assassin",
        "imp",
    ]);
    execute(&mut original, "p6");
    let consequence = replay(&original)["day"]["consequences"][0]["id"].clone();
    day(
        &mut original,
        json!({"kind":"resolveConsequence","consequenceId":consequence,"playerId":"p1"}),
    );
    next_night(&mut original);
    confirm(&mut original, json!({"playerIds":["p6"]}));
    confirm(&mut original, Value::Null);
    assert_eq!(replay(&original)["currentStep"]["character"], "moonchild");
    for target in [None, Some("p2"), Some("p4"), Some("p6")] {
        let mut g = original.clone();
        let decision = target
            .map(|id| json!({"kind":"bounce","targetPlayerId":id}))
            .unwrap_or(json!({"kind":"mayorDies"}));
        let event = confirm(&mut g, json!({"mayorDecision":decision}));
        let state = replay(&g);
        assert_eq!(state["currentStep"]["character"], "mathematician");
        let prompt = &state["currentStep"]["informationPrompt"];
        assert_eq!(
            prompt["computedResult"]["value"],
            u8::from(target.is_some())
        );
        let records = prompt["mathematicianAudit"]["records"].as_array().unwrap();
        assert_eq!(records.len(), usize::from(target.is_some()));
        if target.is_some() {
            assert_eq!(records[0]["subjectPlayerId"], "p6");
            assert_eq!(records[0]["characterId"], "moonchild");
            assert!(records[0]["evidence"]
                .as_array()
                .unwrap()
                .iter()
                .all(|e| e["resolutionEventId"] == event["id"]
                    && e["outcome"]["effect"] == "moonchildDeath"));
        }
        roundtrip_and_undo(&g, &original);
    }
}

#[test]
fn demon_redirects_share_the_same_source_bound_mathematician_audit() {
    let mut original = game(&[
        "mayor",
        "artist",
        "slayer",
        "fool",
        "mathematician",
        "assassin",
        "imp",
    ]);
    execute(&mut original, "p2");
    next_night(&mut original);
    for target in [None, Some("p2"), Some("p3"), Some("p4")] {
        let mut g = original.clone();
        let decision = target
            .map(|id| json!({"kind":"bounce","targetPlayerId":id}))
            .unwrap_or(json!({"kind":"mayorDies"}));
        confirm(&mut g, json!({"playerIds":["p1"],"mayorDecision":decision}));
        confirm(&mut g, Value::Null);
        let state = replay(&g);
        assert_eq!(state["currentStep"]["character"], "mathematician");
        let prompt = &state["currentStep"]["informationPrompt"];
        assert_eq!(
            prompt["computedResult"]["value"],
            u8::from(target.is_some())
        );
        if target.is_some() {
            assert_eq!(
                prompt["mathematicianAudit"]["records"][0]["subjectPlayerId"],
                "p7"
            );
            assert_eq!(
                prompt["mathematicianAudit"]["records"][0]["characterId"],
                "imp"
            );
        }
        roundtrip_and_undo(&g, &original);
    }
}

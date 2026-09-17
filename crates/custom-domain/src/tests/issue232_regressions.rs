//! Defects reproduced by the composite #232 acceptance games.
use super::issue223_day::production;
use super::issue225_nights::{character, day, replay, step};
use serde_json::json;

#[test]
fn changing_an_existing_demon_also_requires_arbitrary_deaths() {
    let mut game = production(
        &[
            "soldier",
            "monk",
            "virgin",
            "slayer",
            "ravenkeeper",
            "pitHag",
            "imp",
        ],
        json!({}),
    );
    let definition = &mut game["game"]["script"]["definition"];
    definition["characterIds"]
        .as_array_mut()
        .unwrap()
        .push(json!("fangGu"));
    definition["otherNightOrder"] = super::other_order_json(&definition["characterIds"]);
    for _ in 0..3 {
        day(&mut game, json!({"kind":"advance"}));
    }
    day(&mut game, json!({"kind":"closeNominations"}));
    day(&mut game, json!({"kind":"confirmExecution"}));
    day(&mut game, json!({"kind":"beginNight"}));
    step(
        &mut game,
        character("monk", "protectPlayer"),
        json!({"playerIds":["p1"]}),
        None,
    );
    let change = step(
        &mut game,
        character("pitHag", "changeCharacter"),
        json!({"playerIds":["p7"],"characterIds":["fangGu"]}),
        None,
    );
    assert_eq!(change["payload"]["result"]["createdDemon"], true);
    assert_eq!(
        replay(&game)["currentStep"]["actionRef"],
        character("pitHag", "chooseDeaths")
    );
    let restored: serde_json::Value = serde_json::from_str(&game.to_string()).unwrap();
    assert_eq!(replay(&restored), replay(&game));
    let deaths = step(
        &mut game,
        character("pitHag", "chooseDeaths"),
        json!({"playerIds":[]}),
        None,
    );
    assert_eq!(
        replay(&game)["latestUndoUnit"]["eventIds"],
        json!([change["id"], deaths["id"]])
    );
}

#[test]
fn undertaker_reads_virgin_and_madness_executions_but_not_witch_deaths() {
    for cause in ["virgin", "madness", "witch"] {
        let minion = if cause == "witch" {
            "witch"
        } else {
            "cerenovus"
        };
        let inputs = if cause == "witch" {
            json!({"chooseCursedPlayer":{"playerIds":["p3"]}})
        } else {
            json!({"assignMadness":{"playerIds":["p3"],"characterId":"virgin"}})
        };
        let mut game = production(
            &[
                "undertaker",
                "virgin",
                "soldier",
                "slayer",
                "monk",
                minion,
                "imp",
            ],
            inputs,
        );
        if cause == "madness" {
            let id = replay(&game)["day"]["madness"][0]["id"].clone();
            day(
                &mut game,
                json!({"kind":"checkMadness","assignmentId":id,"violation":true}),
            );
            day(
                &mut game,
                json!({"kind":"executeMadness","assignmentId":id}),
            );
        } else {
            for _ in 0..3 {
                day(&mut game, json!({"kind":"advance"}));
            }
            day(
                &mut game,
                json!({"kind":"nominate","nominatorId":"p3","nomineeId":if cause=="virgin"{"p2"}else{"p4"}}),
            );
        }
        day(&mut game, json!({"kind":"confirmDeath"}));
        if cause == "witch" {
            day(&mut game, json!({"kind":"vote","voterIds":[]}));
            day(&mut game, json!({"kind":"closeNominations"}));
            day(&mut game, json!({"kind":"confirmExecution"}));
        }
        day(&mut game, json!({"kind":"beginNight"}));
        step(
            &mut game,
            character("monk", "protectPlayer"),
            json!({"playerIds":["p1"]}),
            None,
        );
        if cause == "witch" {
            step(
                &mut game,
                character("witch", "chooseCursedPlayer"),
                json!({"playerIds":["p4"]}),
                None,
            );
        } else {
            step(
                &mut game,
                character("cerenovus", "assignMadness"),
                json!({"playerIds":["p4"],"characterId":"virgin"}),
                None,
            );
        }
        step(
            &mut game,
            character("imp", "attackPlayer"),
            json!({"playerIds":["p5"]}),
            None,
        );
        if cause == "witch" {
            assert_eq!(
                replay(&game)["currentStep"]["actionRef"]["actionId"],
                "dawn"
            );
        } else {
            assert_eq!(
                replay(&game)["currentStep"]["actionRef"],
                character("undertaker", "learnExecutedCharacter")
            );
            let event = step(
                &mut game,
                character("undertaker", "learnExecutedCharacter"),
                json!(null),
                None,
            );
            assert_eq!(
                event["payload"]["result"]["information"]["deliveredResult"],
                json!({"kind":"character","characterId":"soldier"})
            );
            let reveal: serde_json::Value =
                serde_json::from_str(&crate::confirmed_event_reveal_json(
                    &game.to_string(),
                    event["id"].as_str().unwrap(),
                ))
                .unwrap();
            assert_eq!(reveal["value"]["revealedCharacterId"], "soldier");
            let restored: serde_json::Value = serde_json::from_str(&game.to_string()).unwrap();
            assert_eq!(replay(&restored), replay(&game));
        }
    }
}

fn replay_result(game: &serde_json::Value) -> serde_json::Value {
    serde_json::from_str(&crate::replay_json(&game.to_string())).unwrap()
}

#[test]
fn other_night_overview_keeps_juggler_in_order_before_and_after_confirmation() {
    let original: serde_json::Value = serde_json::from_str(include_str!(
        "../../../../fixtures/acceptance/custom-composite/G05-retained-minion.game.json"
    )).unwrap();
    let events = original["game"]["events"].as_array().unwrap();
    let juggler_index = events.iter().position(|event| {
        event["payload"]["actionRef"] == character("juggler", "learnJuggles")
    }).unwrap();
    let order = original["game"]["script"]["definition"]["otherNightOrder"]
        .as_array().unwrap();
    // Check the whole second night, including waiting, current and completed Juggler.
    let night_start = events[..juggler_index].iter().rposition(|event| {
        event["payload"]["input"]["kind"] == "beginNight"
    }).unwrap() + 1;
    let mut statuses = std::collections::BTreeSet::new();
    for count in night_start..=juggler_index + 1 {
        let mut game = original.clone();
        game["game"]["events"] = json!(&events[..count]);
        let result = replay(&game);
        let overview = result["phaseOverview"].as_array().unwrap();
        let positions: Vec<_> = overview.iter().filter_map(|row| {
            order.iter().position(|action| *action == row["actionRef"])
        }).collect();
        assert!(positions.windows(2).all(|pair| pair[0] <= pair[1]),
            "night order changed at prefix {count}: {positions:?}");
        let juggler = overview.iter().find(|row| row["character"] == "juggler").unwrap();
        statuses.insert(juggler["status"].as_str().unwrap().to_owned());
    }
    assert_eq!(statuses, ["waiting", "current", "complete"].map(str::to_owned).into());
}

#[test]
fn cached_replay_matches_full_replay_across_appends_undo_and_new_games() {
    let original: serde_json::Value = serde_json::from_str(include_str!(
        "../../../../fixtures/acceptance/custom-composite/G03-end-6.game.json"
    )).unwrap();
    let events = original["game"]["events"].as_array().unwrap();
    crate::game::clear_replay_prefix_for_tests();
    for count in (1..=events.len()).chain((1..events.len()).rev()) {
        let mut game = original.clone();
        game["game"]["events"] = json!(&events[..count]);
        let warm = replay_result(&game);
        assert_eq!(warm["ok"], true, "prefix {count}");
        crate::game::clear_replay_prefix_for_tests();
        assert_eq!(warm, replay_result(&game), "prefix {count}");
    }
    // A new game can reuse IDs and counts; its different setup contents must win.
    let mut changed = original.clone();
    changed["game"]["events"] = json!(&events[..1]);
    changed["game"]["events"][0]["payload"]["players"][0]["name"] = json!("다른 게임");
    let warm = replay_result(&changed);
    crate::game::clear_replay_prefix_for_tests();
    assert_eq!(warm, replay_result(&changed));
    assert_eq!(warm["value"]["players"][0]["name"], "다른 게임");
}

#[test]
fn cached_replay_never_accepts_modified_history_or_unvalidated_appends() {
    let original: serde_json::Value = serde_json::from_str(include_str!(
        "../../../../fixtures/acceptance/custom-composite/G03-end-6.game.json"
    )).unwrap();
    for append in [false, true] {
        assert_eq!(replay_result(&original)["ok"], true);
        let mut bad = original.clone();
        if append {
            let mut event = bad["game"]["events"].as_array().unwrap().last().unwrap().clone();
            event["id"] = json!("invalid-after-game-end");
            bad["game"]["events"].as_array_mut().unwrap().push(event);
        } else {
            // Keep the ID/count; forge the typed result of an already validated event.
            let event = bad["game"]["events"].as_array_mut().unwrap().iter_mut()
                .find(|e| e["type"] == "dayConfirmed" && e["payload"]["input"]["kind"] == "vote").unwrap();
            event["payload"]["result"]["countedVoterIds"] = json!([]);
        }
        let warm = replay_result(&bad);
        crate::game::clear_replay_prefix_for_tests();
        assert_eq!(warm, replay_result(&bad));
        assert_eq!(warm["ok"], false);
        assert_eq!(replay_result(&original)["ok"], true);
    }
    assert_eq!(replay_result(&original)["ok"], true);
    let mut changed = original.clone();
    changed["game"]["script"]["definition"]["name"] = json!("다른 시나리오");
    changed["game"]["updatedAt"] = json!("2026-09-17T00:00:00Z");
    let warm = replay_result(&changed);
    crate::game::clear_replay_prefix_for_tests();
    assert_eq!(warm, replay_result(&changed));
}

fn scheduled_deaths_game(demon_first: bool) -> serde_json::Value {
    let mut game = production(&["soldier", "monk", "empath", "slayer", "ravenkeeper", "pitHag", "imp"], json!({}));
    let d = &mut game["game"]["script"]["definition"];
    d["characterIds"].as_array_mut().unwrap().push(json!("fangGu"));
    d["nightOrderVersion"] = json!(2);
    let mut draft = d.clone();
    draft.as_object_mut().unwrap().remove("otherNightOrder");
    let order: serde_json::Value = serde_json::from_str(&crate::custom_other_night_plan_json(
        &json!({"customDefinition":draft}).to_string())).unwrap();
    assert_eq!(order["ok"], true, "{order}");
    d["otherNightOrder"] = order["value"]["plan"].clone();
    if demon_first {
        let entries = d["otherNightOrder"].as_array_mut().unwrap();
        let ph = entries.iter().position(|a| *a == character("pitHag","changeCharacter")).unwrap();
        let imp = entries.iter().position(|a| *a == character("imp","attackPlayer")).unwrap();
        entries.swap(ph,imp);
    }
    super::issue225_nights::begin_night(&mut game);
    step(&mut game,character("monk","protectPlayer"),json!({"playerIds":["p1"]}),None);
    game
}

#[test]
fn scheduled_deaths_wait_for_attacks_and_undo_independently_with_death_followups() {
    use super::issue225_nights::system;
    let mut game = scheduled_deaths_game(false);
    let change = step(&mut game,character("pitHag","changeCharacter"),json!({"playerIds":["p7"],"characterIds":["fangGu"]}),None);
    assert_eq!(replay(&game)["currentStep"]["actionRef"],character("fangGu","attackPlayer"));
    let attack = step(&mut game,character("fangGu","attackPlayer"),json!({"playerIds":["p4"]}),None);
    assert_eq!(attack["payload"]["result"]["died"],false);
    assert_eq!(replay(&game)["nightDeaths"], json!({"status":"pending",
        "sources":[{"eventId":change["id"],"abilityUse":change["payload"]["abilityUse"]}],
        "pendingAttackEventIds":[attack["id"]]}));
    let before = game.clone();
    let deaths = step(&mut game,system("resolveNightDeaths"),json!({"playerIds":["p4","p5"]}),None);
    assert_eq!(deaths["payload"]["result"]["sourceEventIds"],json!([change["id"]]));
    assert_eq!(replay(&game)["nightDeaths"]["status"], "resolved");
    assert_eq!(replay(&game)["nightDeaths"]["pendingAttackEventIds"], json!([]));
    assert_eq!(replay(&game)["players"][3]["alive"],false);
    assert_eq!(replay(&game)["currentStep"]["actionRef"],character("ravenkeeper","learnCharacter"));
    let raven = step(&mut game,character("ravenkeeper","learnCharacter"),json!({"playerIds":["p3"]}),None);
    assert_eq!(replay(&game)["latestUndoUnit"]["eventIds"],json!([deaths["id"],raven["id"]]));
    game["game"]["events"].as_array_mut().unwrap().truncate(before["game"]["events"].as_array().unwrap().len());
    assert_eq!(replay(&game),replay(&before));
    assert_eq!(replay(&game)["players"][6]["actualCharacter"],"fangGu");
    let no_deaths = step(&mut game,system("resolveNightDeaths"),json!({"playerIds":[]}),None);
    assert_eq!(replay(&game)["latestUndoUnit"]["eventIds"],json!([no_deaths["id"]]));
    assert_eq!(replay(&game)["currentStep"]["actionRef"],character("empath","learnEvilNeighbors"));
    let mut forged=game.clone();
    forged["game"]["events"].as_array_mut().unwrap().last_mut().unwrap()["payload"]["result"]["sourceEventIds"] = json!([attack["id"]]);
    assert_eq!(replay_result(&forged)["ok"],false);
}

#[test]
fn scheduled_deaths_do_not_rewrite_an_attack_before_activation() {
    use super::issue225_nights::system;
    let mut game = scheduled_deaths_game(true);
    step(&mut game,character("imp","attackPlayer"),json!({"playerIds":["p4"]}),None);
    assert_eq!(replay(&game)["players"][3]["alive"],false);
    step(&mut game,character("pitHag","changeCharacter"),json!({"playerIds":["p7"],"characterIds":["fangGu"]}),None);
    step(&mut game,character("fangGu","attackPlayer"),json!({"playerIds":["p3"]}),None);
    assert!(!replay(&game)["currentStep"]["requiredInput"]["allowedPlayerIds"].as_array().unwrap().contains(&json!("p4")));
    step(&mut game,system("resolveNightDeaths"),json!({"playerIds":[]}),None);
    assert_eq!(replay(&game)["players"][3]["alive"],false);
    assert_eq!(replay(&game)["players"][2]["alive"],true);
}

#[test]
fn scheduled_death_order_is_required_unique_and_after_the_trigger() {
    let game=scheduled_deaths_game(false);
    let order=game["game"]["script"]["definition"]["otherNightOrder"].as_array().unwrap();
    let index=order.iter().position(|a| a["actionId"]=="resolveNightDeaths").unwrap();
    assert_eq!(order[index-1],character("fangGu","attackPlayer"));
    for case in ["missing","duplicate","before","version"] {
        let mut bad=game.clone();
        let entries=bad["game"]["script"]["definition"]["otherNightOrder"].as_array_mut().unwrap();
        match case {
            "missing" => {entries.remove(index);},
            "duplicate" => entries.insert(index,entries[index].clone()),
            "before" => entries.swap(index,1),
            _ => bad["game"]["script"]["definition"]["nightOrderVersion"]=json!(3),
        }
        assert_eq!(replay_result(&bad)["ok"],false,"{case}");
    }
    let mut unused=game.clone();
    step(&mut unused,character("pitHag","changeCharacter"),json!({"playerIds":["p4"],"characterIds":["soldier"]}),None);
    step(&mut unused,character("imp","attackPlayer"),json!({"playerIds":["p4"]}),None);
    assert_eq!(replay(&unused)["currentStep"]["actionRef"],character("empath","learnEvilNeighbors"));
}

#[test]
fn moving_death_resolution_after_information_preserves_the_earlier_reveal() {
    use super::issue225_nights::system;
    let mut game=scheduled_deaths_game(false);
    let order=game["game"]["script"]["definition"]["otherNightOrder"].as_array_mut().unwrap();
    let death=order.iter().position(|a| a["actionId"]=="resolveNightDeaths").unwrap();
    let empath=order.iter().position(|a| a["characterId"]=="empath").unwrap();
    order.swap(death,empath);
    step(&mut game,character("pitHag","changeCharacter"),json!({"playerIds":["p7"],"characterIds":["fangGu"]}),None);
    step(&mut game,character("fangGu","attackPlayer"),json!({"playerIds":["p4"]}),None);
    let info=step(&mut game,character("empath","learnEvilNeighbors"),json!(null),None);
    let reveal_before=crate::confirmed_event_reveal_json(&game.to_string(),info["id"].as_str().unwrap());
    step(&mut game,system("resolveNightDeaths"),json!({"playerIds":["p2","p4"]}),None);
    assert_eq!(crate::confirmed_event_reveal_json(&game.to_string(),info["id"].as_str().unwrap()),reveal_before);
    assert_eq!(replay(&game)["currentStep"]["actionRef"],system("dawn"));
}

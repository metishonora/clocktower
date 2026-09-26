use super::issue223_day::production;
use super::issue225_nights::{begin_night, character, replay, step, system};
use serde_json::{json, Value};

fn game(outsider: &str, scheduled: bool) -> Value {
    let mut game = production(
        &[
            "soldier",
            "oracle",
            "virgin",
            "slayer",
            outsider,
            "ravenkeeper",
            "pitHag",
            "imp",
        ],
        json!({}),
    );
    let d = &mut game["game"]["script"]["definition"];
    d["characterIds"]
        .as_array_mut()
        .unwrap()
        .push(json!("vortox"));
    d.as_object_mut().unwrap().remove("otherNightOrder");
    if scheduled {
        d["nightOrderVersion"] = json!(2);
    }
    let order: Value = serde_json::from_str(&crate::custom_other_night_plan_json(
        &json!({"customDefinition": d}).to_string(),
    ))
    .unwrap();
    assert_eq!(order["ok"], true, "{order}");
    d["otherNightOrder"] = order["value"]["plan"].clone();
    begin_night(&mut game);
    step(
        &mut game,
        character("pitHag", "changeCharacter"),
        json!({"playerIds":["p7"],"characterIds":["vortox"]}),
        None,
    );
    if scheduled {
        for demon in ["imp", "vortox"] {
            step(
                &mut game,
                character(demon, "attackPlayer"),
                json!({"playerIds":["p1"]}),
                None,
            );
        }
    }
    game
}

fn deaths(game: &mut Value, scheduled: bool, ids: &[&str]) {
    step(
        game,
        if scheduled {
            system("resolveNightDeaths")
        } else {
            character("pitHag", "chooseDeaths")
        },
        json!({"playerIds":ids}),
        None,
    );
}

fn assert_reload(game: &Value) {
    let restored: Value = serde_json::from_str(&game.to_string()).unwrap();
    assert_eq!(replay(game), replay(&restored));
}

#[test]
fn simultaneous_sweetheart_death_can_disable_the_new_vortox_in_either_selection_order() {
    for scheduled in [false, true] {
        for ids in [["p8", "p5"], ["p5", "p8"]] {
            let mut game = game("sweetheart", scheduled);
            let before = game.clone();
            deaths(&mut game, scheduled, &ids);
            let drunk = step(
                &mut game,
                character("sweetheart", "makeDrunk"),
                json!({"playerIds":["p7"]}),
                None,
            );
            assert_eq!(
                drunk["payload"]["result"]["effective"], true,
                "scheduled={scheduled} deaths={ids:?}"
            );
            assert_reload(&game);
            // A previously saved false result cannot be silently reinterpreted:
            // strict replay must reject it instead of rewriting later reveals.
            let mut incorrect_history = game.clone();
            incorrect_history["game"]["events"]
                .as_array_mut()
                .unwrap()
                .last_mut()
                .unwrap()["payload"]["result"]["effective"] = json!(false);
            assert_eq!(
                super::issue225_nights::result(&incorrect_history)["ok"],
                false
            );
            if !scheduled {
                step(
                    &mut game,
                    character("vortox", "attackPlayer"),
                    json!({"playerIds":["p1"]}),
                    None,
                );
            }
            let oracle = step(
                &mut game,
                character("oracle", "learnDeadEvilCount"),
                Value::Null,
                Some(json!({"kind":"number","value":1})),
            );
            assert_eq!(
                oracle["payload"]["result"]["information"]["computedResult"],
                json!({"kind":"number","value":1})
            );
            game["game"]["events"]
                .as_array_mut()
                .unwrap()
                .truncate(before["game"]["events"].as_array().unwrap().len());
            assert_eq!(replay(&game), replay(&before));
        }
    }
}

#[test]
fn simultaneous_barber_death_can_swap_characters_in_either_selection_order() {
    for scheduled in [false, true] {
        for ids in [["p8", "p5"], ["p5", "p8"]] {
            let mut game = game("barber", scheduled);
            deaths(&mut game, scheduled, &ids);
            if !scheduled {
                step(
                    &mut game,
                    character("vortox", "attackPlayer"),
                    json!({"playerIds":["p1"]}),
                    None,
                );
            }
            let swap = step(
                &mut game,
                character("barber", "swapCharacters"),
                json!({"playerIds":["p1","p4"],"chooserPlayerId":"p7"}),
                None,
            );
            assert_eq!(swap["payload"]["result"]["effective"], true);
            assert_eq!(replay(&game)["players"][0]["actualCharacter"], "slayer");
            assert_reload(&game);
        }
    }
}

#[test]
fn new_vortox_forces_false_information_and_its_death_restores_truth() {
    for keep_vortox in [false, true] {
        let mut game = game("sweetheart", true);
        deaths(&mut game, true, &[if keep_vortox { "p8" } else { "p7" }]);
        let state = replay(&game);
        let prompt = &state["currentStep"]["informationPrompt"];
        assert_eq!(prompt["computedResult"], json!({"kind":"number","value":1}));
        assert_eq!(
            prompt["activeReasons"]
                .as_array()
                .unwrap()
                .iter()
                .any(|r| r["type"] == "vortox"),
            keep_vortox
        );
        step(
            &mut game,
            character("oracle", "learnDeadEvilCount"),
            Value::Null,
            Some(json!({"kind":"number","value":if keep_vortox {0} else {1}})),
        );
        assert_reload(&game);
    }
}

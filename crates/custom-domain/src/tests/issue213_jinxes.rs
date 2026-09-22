//! Public command/replay contracts for the official Jinx foundation.
use super::issue223_day::production;
use super::issue225_nights::{
    append, begin_night, character, propose, replay, result, step, system,
};
use serde_json::{json, Value};

#[test]
fn fang_gu_jump_suppresses_scarlet_succession_and_phantom_reveals() {
    let mut game = production(
        &[
            "saint",
            "soldier",
            "virgin",
            "slayer",
            "mayor",
            "scarletWoman",
            "fangGu",
        ],
        json!({}),
    );
    begin_night(&mut game);
    let before = game.clone();
    step(
        &mut game,
        character("fangGu", "attackPlayer"),
        json!({"playerIds":["p1"]}),
        None,
    );
    let state = replay(&game);
    assert_eq!(state["players"][0]["actualCharacter"], "fangGu");
    assert_eq!(state["players"][6]["alive"], false);
    assert_eq!(state["players"][5]["actualCharacter"], "scarletWoman");
    assert!(!state["pendingIdentityReveals"]
        .as_array()
        .unwrap()
        .iter()
        .any(|r| r["payload"]["playerId"] == "p6"));
    let loaded: Value = serde_json::from_str(&game.to_string()).unwrap();
    assert_eq!(replay(&loaded), state);
    game["game"]["events"].as_array_mut().unwrap().pop();
    assert_eq!(replay(&game), replay(&before));
}

#[test]
fn sage_recluse_choice_requires_exact_judgment_and_survives_replay() {
    let mut game = production(
        &[
            "sage",
            "recluse",
            "soldier",
            "virgin",
            "slayer",
            "scarletWoman",
            "imp",
            "mayor",
        ],
        json!({}),
    );
    begin_night(&mut game);
    step(
        &mut game,
        character("imp", "attackPlayer"),
        json!({"playerIds":["p1"]}),
        None,
    );
    let state = replay(&game);
    let choices = state["currentStep"]["informationPrompt"]["targetChecks"][0]["choices"]
        .as_array()
        .unwrap();
    let chosen = choices
        .iter()
        .find(|c| c["result"]["playerIds"] == json!(["p2", "p3"]))
        .expect("Recluse may register as the Demon to Sage");
    assert_eq!(
        chosen["registrationJudgments"],
        json!([{"playerId":"p2","registeredAs":"demon"}])
    );
    let mut cmd = json!({"type":"confirmStep","payload":{"stepId":state["currentStep"]["id"],"deliveredResult":chosen["result"]}});
    assert_eq!(propose(&game, cmd.clone())["ok"], false);
    cmd["payload"]["registrationJudgments"] = chosen["registrationJudgments"].clone();
    let before = game.clone();
    let event = append(&mut game, cmd);
    let reveal =
        crate::confirmed_event_reveal_json(&game.to_string(), event["id"].as_str().unwrap());
    let mut tampered = game.clone();
    tampered["game"]["events"]
        .as_array_mut()
        .unwrap()
        .last_mut()
        .unwrap()["payload"]["registrationJudgments"] = json!([]);
    assert_eq!(result(&tampered)["ok"], false);
    step(&mut game, system("dawn"), Value::Null, None);
    assert_eq!(
        crate::confirmed_event_reveal_json(&game.to_string(), event["id"].as_str().unwrap()),
        reveal
    );
    let restored: Value = serde_json::from_str(&game.to_string()).unwrap();
    assert_eq!(replay(&restored), replay(&game));
    game["game"]["events"]
        .as_array_mut()
        .unwrap()
        .truncate(before["game"]["events"].as_array().unwrap().len());
    assert_eq!(replay(&game), replay(&before));
}

#[test]
fn official_coverage_rejects_missing_duplicate_metadata_only_and_unknown_bindings() {
    use crate::jinxes::*;
    let source: Vec<OfficialGroup> =
        serde_json::from_str(include_str!("../../resources/jinxes.json")).unwrap();
    let supported = crate::characters::custom_script_catalog()
        .iter()
        .map(|c| c.id)
        .collect::<Vec<_>>();
    let bindings = character_registrations();
    assert_eq!(
        production_registry_related(&supported),
        vec![
            "balloonist--marionette",
            "boffin--drunk",
            "boffin--preacher",
            "chambermaid--mathematician",
            "drunk--mathematician",
            "fanggu--scarletwoman",
            "marionette--mathematician",
            "marionette--preacher",
            "recluse--sage"
        ]
    );
    for index in 0..bindings.len() {
        let mut missing = bindings.clone();
        missing.remove(index);
        assert!(JinxRegistry::new(&source, &supported, missing).is_err());
        let mut metadata_only = bindings.clone();
        metadata_only[index].rules.clear();
        assert!(JinxRegistry::new(&source, &supported, metadata_only).is_err());
        let mut unverified = bindings.clone();
        unverified[index].evidence = &[];
        assert!(JinxRegistry::new(&source, &supported, unverified).is_err());
    }
    let mut duplicate = bindings.clone();
    duplicate.push(bindings[0].clone());
    assert!(JinxRegistry::new(&source, &supported, duplicate).is_err());
    let mut unknown = bindings.clone();
    unknown[0].id = "unknown";
    assert!(JinxRegistry::new(&source, &supported, unknown).is_err());
    let context =
        crate::characters::resolve_custom_script_ids(&["sage".into(), "recluse".into()]).unwrap();
    assert_eq!(context.related_jinxes().len(), 1);
    assert_eq!(context.related_jinxes()[0].source_revision, SOURCE_REVISION);
    assert!(
        crate::characters::resolve_custom_script_ids(&["sage".into()])
            .unwrap()
            .related_jinxes()
            .is_empty()
    );
}
fn production_registry_related(ids: &[&str]) -> Vec<String> {
    crate::jinxes::production()
        .unwrap()
        .related(&ids.iter().map(|s| s.to_string()).collect::<Vec<_>>())
        .iter()
        .map(|m| m.id.clone())
        .collect()
}
#[test]
fn additional_catalog_pair_uses_the_same_registry_and_typed_dispatch() {
    use crate::jinxes::*;
    fn future_rule(c: &RegistrationContext<'_>) -> Option<crate::model::RegistrationJudgment> {
        (c.target_id == "future-player").then(|| crate::model::RegistrationJudgment {
            player_id: c.target_id.into(),
            registered_as: crate::model::RegistrationValue::Good,
            scope: None,
            character_id: None,
        })
    }
    let mut source: Vec<OfficialGroup> =
        serde_json::from_str(include_str!("../../resources/jinxes.json")).unwrap();
    source.push(OfficialGroup {
        id: "futurea".into(),
        jinx: vec![OfficialPair {
            id: "futureb".into(),
            reason: "Test-only future pair".into(),
        }],
    });
    let mut supported = crate::characters::custom_script_catalog()
        .iter()
        .map(|c| c.id)
        .collect::<Vec<_>>();
    supported.extend(["futureA", "futureB"]);
    assert!(JinxRegistry::new(&source, &supported, character_registrations()).is_err());
    let mut bindings = character_registrations();
    bindings.push(RegisteredJinx {
        id: "futurea--futureb",
        characters: ["futureA", "futureB"],
        evidence: &["additional_catalog_pair_uses_the_same_registry_and_typed_dispatch"],
        rules: vec![Rule::Registration(future_rule)],
    });
    bindings.reverse();
    let registry = JinxRegistry::new(&source, &supported, bindings).unwrap();
    assert_eq!(
        registry.related(&["futureB".into(), "futureA".into()])[0].id,
        "futurea--futureb"
    );
    assert!(registry.related(&["futureA".into()]).is_empty());
    let facts = crate::state::CustomGameFacts::from_players(vec![]);
    let observer =
        crate::state::ActionOccurrence::system(crate::contracts::FirstNightActionRef::System {
            action_id: crate::contracts::SystemFirstNightActionId::Dusk,
        })
        .unwrap();
    assert_eq!(
        registry
            .registrations(&RegistrationContext {
                facts: &facts,
                observer: &observer,
                target_id: "future-player"
            })
            .len(),
        1
    );
    assert!(registry
        .registrations(&RegistrationContext {
            facts: &facts,
            observer: &observer,
            target_id: "absent"
        })
        .is_empty());
    assert!(crate::characters::resolve_custom_script_ids(&["futureA".into()]).is_err());
}

#[test]
fn ordinary_fang_gu_death_still_allows_scarlet_succession() {
    let mut game = production(
        &[
            "saint",
            "soldier",
            "virgin",
            "slayer",
            "mayor",
            "scarletWoman",
            "fangGu",
        ],
        json!({}),
    );
    begin_night(&mut game);
    step(
        &mut game,
        character("fangGu", "attackPlayer"),
        json!({"playerIds":["p7"]}),
        None,
    );
    let state = replay(&game);
    assert_eq!(state["players"][5]["actualCharacter"], "fangGu");
    assert_eq!(state["players"][6]["alive"], false);
    assert_eq!(state["players"][0]["actualCharacter"], "saint");
}

fn sage_choices(game: &Value) -> Vec<Value> {
    replay(game)["currentStep"]["informationPrompt"]["targetChecks"][0]["choices"]
        .as_array()
        .unwrap()
        .clone()
}
#[test]
fn sage_jinx_uses_acquired_recluse_ability_and_current_impairment() {
    for (acquired, poisoned) in [(false, false), (false, true), (true, false), (true, true)] {
        let mut roster = vec![
            "sage", "recluse", "soldier", "virgin", "slayer", "poisoner", "imp", "mayor",
        ];
        if acquired {
            roster[1] = "philosopher";
            roster[7] = "saint";
        }
        let mut inputs = json!({"choosePoisonTarget":{"playerIds":["p3"]}});
        if acquired {
            inputs["chooseAbility"] = json!({"characterIds":["recluse"]});
        }
        let mut game = production(&roster, inputs);
        begin_night(&mut game);
        step(
            &mut game,
            character("poisoner", "choosePoisonTarget"),
            json!({"playerIds":[if poisoned {"p2"} else {"p3"}]}),
            None,
        );
        step(
            &mut game,
            character("imp", "attackPlayer"),
            json!({"playerIds":["p1"]}),
            None,
        );
        let offered = sage_choices(&game).iter().any(|c| {
            c["registrationJudgments"] == json!([{"playerId":"p2","registeredAs":"demon"}])
        });
        assert_eq!(
            offered, !poisoned,
            "acquired={acquired}, poisoned={poisoned}"
        );
        let mut cmd = json!({"type":"confirmStep","payload":{"stepId":replay(&game)["currentStep"]["id"],"deliveredResult":{"kind":"playerPair","playerIds":["p2","p3"]},"registrationJudgments":[{"playerId":"p2","registeredAs":"demon"}]}});
        assert_eq!(propose(&game, cmd.clone())["ok"], !poisoned);
        cmd["payload"]["registrationJudgments"][0]["playerId"] = json!("p4");
        assert_eq!(propose(&game, cmd)["ok"], false);
    }
}
#[test]
fn sage_does_not_use_a_lost_recluse_ability() {
    let mut game = production(
        &[
            "sage", "recluse", "soldier", "virgin", "slayer", "pitHag", "imp", "mayor",
        ],
        json!({}),
    );
    begin_night(&mut game);
    step(
        &mut game,
        character("pitHag", "changeCharacter"),
        json!({"playerIds":["p2"],"characterIds":["saint"]}),
        None,
    );
    step(
        &mut game,
        character("imp", "attackPlayer"),
        json!({"playerIds":["p1"]}),
        None,
    );
    assert!(sage_choices(&game)
        .iter()
        .all(|c| c["registrationJudgments"] == json!([])));
}

#[test]
fn dead_recluse_can_register_and_poisoned_sage_needs_no_invented_registration() {
    use super::issue225_nights::day;
    for poison_sage in [false, true] {
        let mut game = production(
            &[
                "sage", "recluse", "soldier", "virgin", "slayer", "poisoner", "imp", "mayor",
            ],
            json!({"choosePoisonTarget":{"playerIds":["p3"]}}),
        );
        for _ in 0..3 {
            day(&mut game, json!({"kind":"advance"}));
        }
        day(
            &mut game,
            json!({"kind":"nominate","nominatorId":"p1","nomineeId":"p2"}),
        );
        day(
            &mut game,
            json!({"kind":"vote","voterIds":["p1","p3","p4","p5","p6"]}),
        );
        day(&mut game, json!({"kind":"closeNominations"}));
        day(&mut game, json!({"kind":"confirmExecution"}));
        day(&mut game, json!({"kind":"confirmDeath"}));
        day(&mut game, json!({"kind":"beginNight"}));
        step(
            &mut game,
            character("poisoner", "choosePoisonTarget"),
            json!({"playerIds":[if poison_sage {"p1"} else {"p3"}]}),
            None,
        );
        step(
            &mut game,
            character("imp", "attackPlayer"),
            json!({"playerIds":["p1"]}),
            None,
        );
        assert_eq!(replay(&game)["players"][1]["alive"], false);
        let pair = sage_choices(&game)
            .into_iter()
            .find(|c| c["result"]["playerIds"] == json!(["p2", "p3"]))
            .unwrap();
        assert_eq!(
            pair["registrationJudgments"].as_array().unwrap().is_empty(),
            poison_sage
        );
    }
}

#[test]
fn drunk_information_across_nights() {
    let mut game = production(
        &[
            "drunk",
            "mathematician",
            "soldier",
            "virgin",
            "slayer",
            "poisoner",
            "imp",
            "mayor",
        ],
        json!({
            "assignShownCharacter":{"characterIds":["empath"]},
            "choosePoisonTarget":{"playerIds":["p4"]},
            "learnEvilNeighbors":{"deliveredResult":{"kind":"number","value":1}},
            "learnCount":{"deliveredResult":{"kind":"number","value":1}}
        }),
    );
    for (target, delivered, count) in [("p5", 1, 1), ("p4", 0, 0)] {
        begin_night(&mut game);
        step(
            &mut game,
            character("poisoner", "choosePoisonTarget"),
            json!({"playerIds":["p4"]}),
            None,
        );
        step(
            &mut game,
            character("imp", "attackPlayer"),
            json!({"playerIds":[target]}),
            None,
        );
        let before = game.clone();
        let delivery = step(
            &mut game,
            character("empath", "learnEvilNeighbors"),
            Value::Null,
            Some(json!({"kind":"number","value":delivered})),
        );
        let after = replay(&game);
        let prompt = &after["currentStep"]["informationPrompt"];
        assert_eq!(prompt["computedResult"]["value"], count);
        assert_eq!(
            prompt["mathematicianAudit"]["records"]
                .as_array()
                .unwrap()
                .len(),
            count
        );
        assert_eq!(
            delivery["payload"]["simulationSource"]["sourceAbilityUse"]["characterId"],
            "drunk"
        );
        let mut invalid_source = game.clone();
        invalid_source["game"]["events"]
            .as_array_mut()
            .unwrap()
            .last_mut()
            .unwrap()["payload"]["simulationSource"]["sourceAbilityUse"]["ownerPlayerId"] =
            json!("p3");
        assert_eq!(result(&invalid_source)["ok"], false);
        game["game"]["events"].as_array_mut().unwrap().pop();
        assert_eq!(replay(&game), replay(&before));
        game["game"]["events"]
            .as_array_mut()
            .unwrap()
            .push(delivery.clone());
        assert_eq!(replay(&game), after);
        step(
            &mut game,
            character("mathematician", "learnCount"),
            Value::Null,
            Some(json!({"kind":"number","value":count})),
        );
        let reveal =
            crate::confirmed_event_reveal_json(&game.to_string(), delivery["id"].as_str().unwrap());
        step(&mut game, system("dawn"), Value::Null, None);
        assert_eq!(
            crate::confirmed_event_reveal_json(&game.to_string(), delivery["id"].as_str().unwrap()),
            reveal
        );
    }
}
#[test]
fn drunk_failed_swap_is_detected_only_when_a_swap_should_have_happened() {
    for (target, count) in [("p7", 1), ("p3", 0)] {
        let mut game = production(
            &[
                "drunk",
                "mathematician",
                "soldier",
                "virgin",
                "slayer",
                "poisoner",
                "imp",
                "mayor",
            ],
            json!({
                "assignShownCharacter":{"characterIds":["snakeCharmer"]},
                "choosePoisonTarget":{"playerIds":["p4"]},
                "choosePlayer":{"playerIds":["p3"]},
                "learnCount":{"deliveredResult":{"kind":"number","value":0}}
            }),
        );
        begin_night(&mut game);
        step(
            &mut game,
            character("poisoner", "choosePoisonTarget"),
            json!({"playerIds":["p4"]}),
            None,
        );
        step(
            &mut game,
            character("snakeCharmer", "choosePlayer"),
            json!({"playerIds":[target]}),
            None,
        );
        step(
            &mut game,
            character("imp", "attackPlayer"),
            json!({"playerIds":["p5"]}),
            None,
        );
        let state = replay(&game);
        assert_eq!(state["players"][0]["actualCharacter"], "drunk");
        assert_eq!(state["players"][6]["actualCharacter"], "imp");
        assert_eq!(
            state["currentStep"]["informationPrompt"]["computedResult"]["value"],
            count
        );
    }
}

#[test]
fn drunk_day_information_is_counted_by_actual_failure_not_drunkenness() {
    use super::issue225_nights::day;
    for truthful in [false, true] {
        let mut game = production(
            &[
                "drunk",
                "mathematician",
                "soldier",
                "virgin",
                "slayer",
                "poisoner",
                "imp",
                "mayor",
            ],
            json!({
                "assignShownCharacter":{"characterIds":["artist"]},
                "choosePoisonTarget":{"playerIds":["p4"]},
                "learnCount":{"deliveredResult":{"kind":"number","value":0}}
            }),
        );
        let action_id = replay(&game)["day"]["availableActions"]
            .as_array()
            .unwrap()
            .iter()
            .find(|a| a["characterId"] == "artist")
            .unwrap()["id"]
            .clone();
        day(
            &mut game,
            json!({"kind":"useAbility","actionId":action_id,"record":{"kind":"artist","truthful":truthful,"answer":"yes","question":"Is P7 the Demon?"}}),
        );
        begin_night(&mut game);
        step(
            &mut game,
            character("poisoner", "choosePoisonTarget"),
            json!({"playerIds":["p4"]}),
            None,
        );
        step(
            &mut game,
            character("imp", "attackPlayer"),
            json!({"playerIds":["p5"]}),
            None,
        );
        assert_eq!(
            replay(&game)["currentStep"]["informationPrompt"]["computedResult"]["value"],
            if truthful { 0 } else { 1 }
        );
    }
}

#[test]
fn acquired_drunk_keeps_its_real_source_in_later_night_evidence() {
    let mut game = production(
        &[
            "philosopher",
            "mathematician",
            "soldier",
            "virgin",
            "slayer",
            "saint",
            "poisoner",
            "imp",
        ],
        json!({
            "chooseAbility":{"characterIds":["drunk"]},
            "assignShownCharacter":{"characterIds":["empath"]},
            "choosePoisonTarget":{"playerIds":["p4"]},
            "learnEvilNeighbors":{"deliveredResult":{"kind":"number","value":1}},
            "learnCount":{"deliveredResult":{"kind":"number","value":0}}
        }),
    );
    begin_night(&mut game);
    step(
        &mut game,
        character("poisoner", "choosePoisonTarget"),
        json!({"playerIds":["p4"]}),
        None,
    );
    step(
        &mut game,
        character("imp", "attackPlayer"),
        json!({"playerIds":["p5"]}),
        None,
    );
    let source = replay(&game)["currentStep"]["simulationSource"]["sourceAbilityUse"].clone();
    assert_eq!(source["characterId"], "drunk");
    assert_eq!(source["ownerPlayerId"], "p1");
    let event = step(
        &mut game,
        character("empath", "learnEvilNeighbors"),
        Value::Null,
        Some(json!({"kind":"number","value":0})),
    );
    let state = replay(&game);
    assert_eq!(state["players"][0]["actualCharacter"], "philosopher");
    assert_eq!(
        state["currentStep"]["informationPrompt"]["computedResult"]["value"],
        1
    );
    assert_eq!(
        event["payload"]["simulationSource"]["sourceAbilityUse"],
        source
    );
    assert_eq!(
        state["ruleState"]["abilityGrants"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
}

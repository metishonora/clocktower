//! #225 contract tests use public JSON boundaries and independent expected order entries.
//! The representative lifecycle is extended as character handlers are connected.
use serde_json::{json, Value};

fn system(id: &str) -> Value {
    json!({"kind":"system","actionId":id})
}
fn character(id: &str, action: &str) -> Value {
    json!({"kind":"character","characterId":id,"actionId":action})
}
fn result(game: &Value) -> Value {
    serde_json::from_str(&crate::replay_json(&game.to_string())).unwrap()
}
fn game() -> Value {
    let mut game: Value = serde_json::from_str(include_str!(
        "../../../../fixtures/acceptance/custom-first-night/compatibility/day.game.json"
    ))
    .unwrap();
    game["schemaVersion"] = json!(5);
    game["game"]["script"]["definition"]["otherNightOrder"] = json!([
        system("dusk"),
        character("monk", "protectPlayer"),
        character("imp", "attackPlayer"),
        character("undertaker", "learnExecutedCharacter"),
        system("dawn")
    ]);
    game
}
fn replay(game: &Value) -> Value {
    let r = result(game);
    assert_eq!(r["ok"], true, "{r}");
    r["value"].clone()
}
fn propose(game: &Value, command: Value) -> Value {
    serde_json::from_str(&crate::propose_json(
        &game.to_string(),
        &command.to_string(),
    ))
    .unwrap()
}
fn append(game: &mut Value, command: Value) -> Value {
    let before = game.clone();
    let proposal = propose(game, command.clone());
    assert_eq!(*game, before, "proposal must be pure");
    assert_eq!(proposal["ok"], true, "{proposal} command={command}");
    let event = proposal["value"]["event"].clone();
    game["game"]["events"]
        .as_array_mut()
        .unwrap()
        .push(event.clone());
    replay(game);
    event
}
fn day(game: &mut Value, input: Value) {
    let state = replay(game);
    append(
        game,
        json!({"type":"confirmDay","payload":{
            "stepId":state["day"]["stepId"],
            "expectedEventCount":game["game"]["events"].as_array().unwrap().len(),"input":input
        }}),
    );
}
fn begin_night(game: &mut Value) {
    for _ in 0..3 {
        day(game, json!({"kind":"advance"}));
    }
    day(game, json!({"kind":"closeNominations"}));
    day(game, json!({"kind":"confirmExecution"}));
    day(game, json!({"kind":"beginNight"}));
}
#[test]
fn complete_definition_preserves_both_orders_and_rejects_missing_other_order() {
    let complete = game();
    let state = replay(&complete);
    assert_eq!(
        state["script"]["definition"]["otherNightOrder"],
        complete["game"]["script"]["definition"]["otherNightOrder"]
    );
    let mut missing = complete.clone();
    missing["game"]["script"]["definition"]
        .as_object_mut()
        .unwrap()
        .remove("otherNightOrder");
    assert_eq!(
        result(&missing)["ok"],
        false,
        "completed files must not use authoring defaults"
    );
    assert_eq!(result(&complete)["ok"], true);
}
#[test]
fn other_night_exact_set_rejects_boundaries_duplicates_missing_and_trigger_entries() {
    let valid = game();
    replay(&valid); // positive control: errors cannot pass because every file is unsupported
    let order = valid["game"]["script"]["definition"]["otherNightOrder"]
        .as_array()
        .unwrap();
    let mut variants = vec![];
    let mut missing = order.clone();
    missing.remove(1);
    variants.push(missing);
    let mut duplicate = order.clone();
    duplicate.insert(1, duplicate[1].clone());
    variants.push(duplicate);
    let mut wrong_boundary = order.clone();
    wrong_boundary.swap(0, 1);
    variants.push(wrong_boundary);
    let mut first_only = order.clone();
    first_only.insert(1, system("minionInfo"));
    variants.push(first_only);
    let mut trigger = order.clone();
    trigger.insert(2, character("ravenkeeper", "learnCharacter"));
    variants.push(trigger);
    let mut unknown = order.clone();
    unknown[1] = character("monk", "unknown");
    variants.push(unknown);
    for variant in variants {
        let mut invalid = valid.clone();
        invalid["game"]["script"]["definition"]["otherNightOrder"] = json!(variant);
        assert_eq!(result(&invalid)["ok"], false, "{invalid}");
    }
    replay(&valid);
}
#[test]
fn next_night_exposes_a_roster_scoped_action_and_transition_undo_restores_day() {
    let mut game = game();
    let original_order = game["game"]["script"]["definition"].clone();
    begin_night(&mut game);
    let state = replay(&game);
    assert_eq!(state["phase"], "night");
    assert_eq!(
        state["currentStep"]["actionRef"],
        character("monk", "protectPlayer")
    );
    assert_eq!(state["currentStep"]["abilityUse"]["ownerPlayerId"], "p2");
    assert_eq!(game["game"]["script"]["definition"], original_order);
    let restored: Value = serde_json::from_str(&game.to_string()).unwrap();
    assert_eq!(replay(&restored), state);
    game["game"]["events"].as_array_mut().unwrap().pop();
    assert_eq!(replay(&game)["phase"], "day");
    assert_eq!(replay(&game)["day"]["stage"], "nightReady");
}

fn step(game: &mut Value, expected: Value, input: Value, delivered: Option<Value>) -> Value {
    let state = replay(game);
    assert_eq!(state["currentStep"]["actionRef"], expected, "{state}");
    let mut payload = json!({"stepId":state["currentStep"]["id"],
        "expectedEventCount":game["game"]["events"].as_array().unwrap().len(),"input":input});
    if let Some(value) = delivered {
        payload["deliveredResult"] = value;
    }
    append(game, json!({"type":"confirmStep","payload":payload}))
}
#[test]
fn repeated_nights_reset_progress_not_identity_and_reject_a_prior_nights_command() {
    let mut game = game();
    begin_night(&mut game);
    let second_night = replay(&game);
    let before = game.clone();
    let protection = step(
        &mut game,
        character("monk", "protectPlayer"),
        json!({"playerIds":["p1"]}),
        None,
    );
    step(
        &mut game,
        character("imp", "attackPlayer"),
        json!({"playerIds":["p1"]}),
        None,
    );
    assert_eq!(
        replay(&game)["players"][0]["alive"],
        true,
        "Monk protection must apply before attack"
    );
    step(&mut game, system("dawn"), Value::Null, None);
    assert_eq!(replay(&game)["day"]["day"], 2);
    begin_night(&mut game);
    let third_night = replay(&game);
    assert_eq!(
        third_night["currentStep"]["actionRef"],
        second_night["currentStep"]["actionRef"]
    );
    assert_eq!(
        third_night["currentStep"]["abilityUse"],
        second_night["currentStep"]["abilityUse"]
    );
    assert_ne!(
        third_night["currentStep"]["id"],
        second_night["currentStep"]["id"]
    );
    let rejected = propose(
        &game,
        json!({"type":"confirmStep","payload":{
        "stepId":protection["payload"]["stepId"],"input":{"playerIds":["p1"]}}}),
    );
    assert_eq!(rejected["ok"], false);
    assert_eq!(replay(&game), third_night);
    assert_eq!(replay(&before), second_night);
}
#[test]
fn death_trigger_survives_actor_death_reloads_and_undo_removes_the_causal_suffix() {
    let mut game = game();
    begin_night(&mut game);
    step(
        &mut game,
        character("monk", "protectPlayer"),
        json!({"playerIds":["p1"]}),
        None,
    );
    let before_attack = game.clone();
    let attack = step(
        &mut game,
        character("imp", "attackPlayer"),
        json!({"playerIds":["p3"]}),
        None,
    );
    let pending = replay(&game);
    assert_eq!(pending["players"][2]["alive"], false);
    assert_eq!(
        pending["currentStep"]["actionRef"],
        character("ravenkeeper", "learnCharacter")
    );
    assert_eq!(pending["currentStep"]["abilityUse"]["ownerPlayerId"], "p3");
    let restored: Value = serde_json::from_str(&game.to_string()).unwrap();
    assert_eq!(replay(&restored), pending);
    let delivery = step(
        &mut game,
        character("ravenkeeper", "learnCharacter"),
        json!({"playerIds":["p1"]}),
        Some(json!({"kind":"character","characterId":"undertaker"})),
    );
    let after = replay(&game);
    assert_eq!(
        after["latestUndoUnit"]["eventIds"],
        json!([attack["id"], delivery["id"]])
    );
    assert_eq!(after["currentStep"]["actionRef"], system("dawn"));
    let kept = game["game"]["events"].as_array().unwrap().len()
        - after["latestUndoUnit"]["eventIds"]
            .as_array()
            .unwrap()
            .len();
    game["game"]["events"]
        .as_array_mut()
        .unwrap()
        .truncate(kept);
    assert_eq!(game, before_attack);
    assert_eq!(replay(&game)["players"][2]["alive"], true);
}

#[test]
fn default_orders_are_authoring_only_and_independent_of_pool_order() {
    let query = |ids: Value, order: Option<Value>| {
        let mut draft = json!({"id":"draft","name":"Draft","characterIds":ids});
        if let Some(order) = order {
            draft["otherNightOrder"] = order;
        }
        serde_json::from_str::<Value>(&crate::custom_other_night_plan_json(
            &json!({"customDefinition":draft}).to_string(),
        ))
        .unwrap()
    };
    let expected = json!([
        system("dusk"),
        character("monk", "protectPlayer"),
        character("imp", "attackPlayer"),
        system("dawn")
    ]);
    let a = query(json!(["imp", "monk", "ravenkeeper"]), None);
    assert_eq!(a["value"], json!({"source":"default","plan":expected}));
    assert_eq!(query(json!(["ravenkeeper", "monk", "imp"]), None), a);
    let reverse = json!([
        system("dusk"),
        character("imp", "attackPlayer"),
        character("monk", "protectPlayer"),
        system("dawn")
    ]);
    assert_eq!(
        query(json!(["imp", "monk", "ravenkeeper"]), Some(reverse.clone()))["value"],
        json!({"source":"definition","plan":reverse})
    );
}

#[test]
fn pit_hag_acquisition_of_start_information_runs_even_outside_other_night_order() {
    let mut game = super::issue223_day::production(
        &[
            "soldier",
            "monk",
            "ravenkeeper",
            "virgin",
            "slayer",
            "pitHag",
            "imp",
        ],
        json!({}),
    );
    // Add an unowned start-knowing character through the complete authoring boundary,
    // before any of its actions have happened in the confirmed first-night prefix.
    let definition = &mut game["game"]["script"]["definition"];
    definition["characterIds"]
        .as_array_mut()
        .unwrap()
        .push(json!("chef"));
    let first: Value = serde_json::from_str(&crate::custom_first_night_plan_json(
        &json!({"customDefinition":{
        "id":definition["id"],"name":definition["name"],"characterIds":definition["characterIds"]}})
        .to_string(),
    ))
    .unwrap();
    definition["firstNightOrder"] = first["value"]["plan"].clone();
    begin_night(&mut game);
    step(
        &mut game,
        character("monk", "protectPlayer"),
        json!({"playerIds":["p1"]}),
        None,
    );
    let change = step(
        &mut game,
        character("pitHag", "changeCharacter"),
        json!({"playerIds":["p1"],"characterIds":["chef"]}),
        None,
    );
    let acquired = replay(&game);
    assert_eq!(
        acquired["currentStep"]["actionRef"],
        character("chef", "learnEvilPairs")
    );
    assert_eq!(acquired["currentStep"]["abilityUse"]["ownerPlayerId"], "p1");
    let info = step(
        &mut game,
        character("chef", "learnEvilPairs"),
        Value::Null,
        Some(json!({"kind":"number","value":1})),
    );
    assert_eq!(
        replay(&game)["latestUndoUnit"]["eventIds"],
        json!([change["id"], info["id"]])
    );
}

#[test]
fn corrupted_night_number_and_forged_attack_outcome_are_rejected_atomically() {
    let mut game = game();
    begin_night(&mut game);
    step(
        &mut game,
        character("monk", "protectPlayer"),
        json!({"playerIds":["p1"]}),
        None,
    );
    step(
        &mut game,
        character("imp", "attackPlayer"),
        json!({"playerIds":["p1"]}),
        None,
    );
    let valid = replay(&game);
    let mut forged = game.clone();
    forged["game"]["events"]
        .as_array_mut()
        .unwrap()
        .last_mut()
        .unwrap()["payload"]["result"]["died"] = json!(true);
    assert_eq!(result(&forged)["ok"], false);
    let mut other_cycle = game.clone();
    let id = &mut other_cycle["game"]["events"]
        .as_array_mut()
        .unwrap()
        .last_mut()
        .unwrap()["payload"]["stepId"];
    *id = json!(id.as_str().unwrap().replacen("night:2:", "night:3:", 1));
    assert_eq!(result(&other_cycle)["ok"], false);
    assert_eq!(replay(&game), valid);
}

#[test]
fn barber_and_sweetheart_deaths_keep_their_original_sources() {
    for outsider in ["barber", "sweetheart"] {
        let mut game = super::issue223_day::production(
            &[
                "soldier",
                "monk",
                "ravenkeeper",
                "virgin",
                "slayer",
                outsider,
                "scarletWoman",
                "imp",
            ],
            json!({}),
        );
        begin_night(&mut game);
        step(
            &mut game,
            character("monk", "protectPlayer"),
            json!({"playerIds":["p1"]}),
            None,
        );
        let death = step(
            &mut game,
            character("imp", "attackPlayer"),
            json!({"playerIds":["p6"]}),
            None,
        );
        let trigger = replay(&game)["currentStep"].clone();
        assert_eq!(trigger["abilityUse"]["ownerPlayerId"], "p6");
        assert_eq!(
            trigger["actionCause"],
            json!({"kind":"death","deathEventId":death["id"]})
        );
        if outsider == "barber" {
            step(
                &mut game,
                character("barber", "swapCharacters"),
                json!({"playerIds":["p1","p4"],"chooserPlayerId":"p8"}),
                None,
            );
            assert_eq!(replay(&game)["players"][0]["actualCharacter"], "virgin");
            assert_eq!(replay(&game)["players"][3]["actualCharacter"], "soldier");
        } else {
            step(
                &mut game,
                character("sweetheart", "makeDrunk"),
                json!({"playerIds":["p2"]}),
                None,
            );
            assert!(replay(&game)["ruleState"]["activeImpairments"]
                .as_array()
                .unwrap()
                .iter()
                .any(|e| e["playerId"] == "p2" && e["kind"] == "drunk"));
        }
        step(&mut game, system("dawn"), Value::Null, None);
        assert_eq!(replay(&game)["day"]["day"], 2);
    }
}

#[test]
fn vigor_killed_minion_acts_again_and_poison_retains_the_death_source() {
    let mut game = super::issue223_day::production(
        &[
            "soldier",
            "virgin",
            "slayer",
            "ravenkeeper",
            "undertaker",
            "monk",
            "witch",
            "vigormortis",
        ],
        json!({"chooseCursedPlayer":{"playerIds":["p1"]}}),
    );
    begin_night(&mut game);
    step(
        &mut game,
        character("monk", "protectPlayer"),
        json!({"playerIds":["p1"]}),
        None,
    );
    step(
        &mut game,
        character("witch", "chooseCursedPlayer"),
        json!({"playerIds":["p1"]}),
        None,
    );
    let death = step(
        &mut game,
        character("vigormortis", "attackPlayer"),
        json!({"playerIds":["p7"]}),
        None,
    );
    step(
        &mut game,
        character("vigormortis", "choosePoison"),
        json!({"playerIds":["p6"]}),
        None,
    );
    let state = replay(&game);
    assert_eq!(state["players"][6]["alive"], false);
    assert!(state["ruleState"]["activeImpairments"]
        .as_array()
        .unwrap()
        .iter()
        .any(|e| e["playerId"] == "p6" && e["sourceEventId"] == death["id"]));
    step(&mut game, system("dawn"), Value::Null, None);
    begin_night(&mut game);
    step(
        &mut game,
        character("monk", "protectPlayer"),
        json!({"playerIds":["p1"]}),
        None,
    );
    let witch = replay(&game)["currentStep"].clone();
    assert_eq!(witch["abilityUse"]["ownerPlayerId"], "p7");
    let event = step(
        &mut game,
        character("witch", "chooseCursedPlayer"),
        json!({"playerIds":["p2"]}),
        None,
    );
    assert_eq!(event["payload"]["result"]["effective"], true);
    assert_eq!(event["payload"]["result"]["day"], 3);
}

#[test]
fn later_information_uses_the_completed_day_and_frozen_reveals() {
    let mut game = super::issue223_day::production(
        &[
            "flowergirl",
            "townCrier",
            "oracle",
            "juggler",
            "monk",
            "scarletWoman",
            "imp",
        ],
        json!({}),
    );
    let jug = replay(&game)["day"]["availableActions"]
        .as_array()
        .unwrap()
        .iter()
        .find(|a| a["characterId"] == "juggler")
        .unwrap()["id"]
        .clone();
    day(
        &mut game,
        json!({"kind":"useAbility","actionId":jug,"record":{"kind":"juggler","correctCount":3}}),
    );
    for _ in 0..3 {
        day(&mut game, json!({"kind":"advance"}));
    }
    day(
        &mut game,
        json!({"kind":"nominate","nominatorId":"p6","nomineeId":"p1"}),
    );
    day(&mut game, json!({"kind":"vote","voterIds":["p7"]}));
    day(&mut game, json!({"kind":"closeNominations"}));
    day(&mut game, json!({"kind":"confirmExecution"}));
    day(&mut game, json!({"kind":"beginNight"}));
    step(
        &mut game,
        character("monk", "protectPlayer"),
        json!({"playerIds":["p1"]}),
        None,
    );
    step(
        &mut game,
        character("imp", "attackPlayer"),
        json!({"playerIds":["p1"]}),
        None,
    );
    for (c, a, expected) in [
        (
            "flowergirl",
            "learnDemonVoted",
            json!({"kind":"boolean","value":true}),
        ),
        (
            "townCrier",
            "learnMinionNominated",
            json!({"kind":"boolean","value":true}),
        ),
        (
            "oracle",
            "learnDeadEvilCount",
            json!({"kind":"number","value":0}),
        ),
        (
            "juggler",
            "learnJuggles",
            json!({"kind":"number","value":3}),
        ),
    ] {
        let event = step(&mut game, character(c, a), Value::Null, None);
        assert_eq!(
            event["payload"]["result"]["information"]["deliveredResult"],
            expected
        );
        let before: Value = serde_json::from_str(&crate::confirmed_event_reveal_json(
            &game.to_string(),
            event["id"].as_str().unwrap(),
        ))
        .unwrap();
        assert!(!before["value"].is_null());
        assert_ne!(before["value"]["kind"], "seamstressInformation");
    }
}

#[test]
fn sage_requires_a_valid_pair_and_freezes_the_delivered_reveal() {
    let mut game = super::issue223_day::production(
        &[
            "sage",
            "monk",
            "soldier",
            "virgin",
            "slayer",
            "scarletWoman",
            "imp",
        ],
        json!({}),
    );
    begin_night(&mut game);
    step(
        &mut game,
        character("monk", "protectPlayer"),
        json!({"playerIds":["p3"]}),
        None,
    );
    step(
        &mut game,
        character("imp", "attackPlayer"),
        json!({"playerIds":["p1"]}),
        None,
    );
    let pending = replay(&game)["currentStep"].clone();
    let invalid = propose(
        &game,
        json!({"type":"confirmStep","payload":{"stepId":pending["id"],"deliveredResult":{"kind":"playerPair","playerIds":["p2","p3"]}}}),
    );
    assert_eq!(invalid["ok"], false);
    let event = step(
        &mut game,
        character("sage", "learnDemon"),
        Value::Null,
        Some(json!({"kind":"playerPair","playerIds":["p2","p7"]})),
    );
    let reveal =
        crate::confirmed_event_reveal_json(&game.to_string(), event["id"].as_str().unwrap());
    assert!(reveal.contains("sageInformation"), "{reveal}");
    step(&mut game, system("dawn"), Value::Null, None);
    assert_eq!(
        crate::confirmed_event_reveal_json(&game.to_string(), event["id"].as_str().unwrap()),
        reveal
    );
}

#[test]
fn fang_gu_jump_is_once_per_game_even_after_a_new_instance() {
    let mut game = super::issue223_day::production(
        &[
            "saint", "recluse", "soldier", "monk", "virgin", "poisoner", "fangGu", "slayer",
        ],
        json!({"choosePoisonTarget":{"playerIds":["p3"]}}),
    );
    begin_night(&mut game);
    step(
        &mut game,
        character("poisoner", "choosePoisonTarget"),
        json!({"playerIds":["p3"]}),
        None,
    );
    step(
        &mut game,
        character("monk", "protectPlayer"),
        json!({"playerIds":["p3"]}),
        None,
    );
    let jump = step(
        &mut game,
        character("fangGu", "attackPlayer"),
        json!({"playerIds":["p1"]}),
        None,
    );
    assert_eq!(jump["payload"]["result"]["killedPlayerId"], "p7");
    assert_eq!(replay(&game)["players"][0]["actualCharacter"], "fangGu");
    step(&mut game, system("dawn"), Value::Null, None);
    begin_night(&mut game);
    step(
        &mut game,
        character("poisoner", "choosePoisonTarget"),
        json!({"playerIds":["p3"]}),
        None,
    );
    step(
        &mut game,
        character("monk", "protectPlayer"),
        json!({"playerIds":["p3"]}),
        None,
    );
    let attack = step(
        &mut game,
        character("fangGu", "attackPlayer"),
        json!({"playerIds":["p2"]}),
        None,
    );
    assert_eq!(attack["payload"]["result"]["killedPlayerId"], "p2");
    assert_eq!(replay(&game)["players"][0]["alive"], true);
}

#[test]
fn scarlet_woman_has_fixed_precedence_over_imp_starpass() {
    let mut game = super::issue223_day::production(
        &[
            "soldier",
            "monk",
            "virgin",
            "slayer",
            "baron",
            "scarletWoman",
            "imp",
            "saint",
            "recluse",
            "sage",
        ],
        json!({}),
    );
    begin_night(&mut game);
    step(
        &mut game,
        character("monk", "protectPlayer"),
        json!({"playerIds":["p1"]}),
        None,
    );
    let state = replay(&game);
    assert_eq!(
        propose(
            &game,
            json!({"type":"confirmStep","payload":{"stepId":state["currentStep"]["id"],"input":{"playerIds":["p7"],"successorPlayerId":"p5"}}})
        )["ok"],
        false
    );
    step(
        &mut game,
        character("imp", "attackPlayer"),
        json!({"playerIds":["p7"]}),
        None,
    );
    let state = replay(&game);
    assert_eq!(state["players"][4]["actualCharacter"], "baron");
    assert_eq!(state["players"][5]["actualCharacter"], "imp");
    assert_eq!(state["players"][6]["alive"], false);
    assert_eq!(state["currentStep"]["actionRef"], system("dawn"));
}

#[test]
fn pit_hag_demon_creation_requires_arbitrary_deaths_before_ordered_actions() {
    let mut game = super::issue223_day::production(
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
    let d = &mut game["game"]["script"]["definition"];
    d["characterIds"]
        .as_array_mut()
        .unwrap()
        .push(json!("fangGu"));
    d["otherNightOrder"] = crate::tests::other_order_json(&d["characterIds"]);
    begin_night(&mut game);
    step(
        &mut game,
        character("monk", "protectPlayer"),
        json!({"playerIds":["p1"]}),
        None,
    );
    let change = step(
        &mut game,
        character("pitHag", "changeCharacter"),
        json!({"playerIds":["p1"],"characterIds":["fangGu"]}),
        None,
    );
    assert_eq!(change["payload"]["result"]["createdDemon"], true);
    let deaths = step(
        &mut game,
        character("pitHag", "chooseDeaths"),
        json!({"playerIds":["p3"]}),
        None,
    );
    assert_eq!(
        replay(&game)["latestUndoUnit"]["eventIds"],
        json!([change["id"], deaths["id"]])
    );
    for demon in ["imp", "fangGu"] {
        let attack = step(
            &mut game,
            character(demon, "attackPlayer"),
            json!({"playerIds":["p3"]}),
            None,
        );
        assert_eq!(attack["payload"]["result"]["died"], false);
    }
    step(&mut game, system("dawn"), Value::Null, None);
}

#[test]
fn acquired_ordered_ability_joins_only_if_its_entry_is_still_pending() {
    for pending in [false, true] {
        let mut game = super::issue223_day::production(
            &[
                "soldier",
                "virgin",
                "slayer",
                "sage",
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
            .push(json!("monk"));
        d["otherNightOrder"] = crate::tests::other_order_json(&d["characterIds"]);
        if pending {
            d["otherNightOrder"].as_array_mut().unwrap().swap(1, 2);
        }
        begin_night(&mut game);
        step(
            &mut game,
            character("pitHag", "changeCharacter"),
            json!({"playerIds":["p1"],"characterIds":["monk"]}),
            None,
        );
        if pending {
            step(
                &mut game,
                character("monk", "protectPlayer"),
                json!({"playerIds":["p2"]}),
                None,
            );
        }
        let event = step(
            &mut game,
            character("imp", "attackPlayer"),
            json!({"playerIds":["p2"]}),
            None,
        );
        assert_eq!(event["payload"]["result"]["died"], !pending);
        step(&mut game, system("dawn"), Value::Null, None);
        begin_night(&mut game);
        if pending {
            step(
                &mut game,
                character("pitHag", "changeCharacter"),
                json!({"playerIds":["p3"],"characterIds":["slayer"]}),
                None,
            );
        }
        assert_eq!(
            replay(&game)["currentStep"]["actionRef"],
            character("monk", "protectPlayer")
        );
    }
}

#[test]
fn late_barber_death_is_immediate_and_cannot_be_skipped_by_dawn() {
    let mut game = super::issue223_day::production(
        &[
            "soldier",
            "monk",
            "ravenkeeper",
            "virgin",
            "slayer",
            "barber",
            "scarletWoman",
            "imp",
        ],
        json!({}),
    );
    game["game"]["script"]["definition"]["otherNightOrder"]
        .as_array_mut()
        .unwrap()
        .swap(2, 3);
    begin_night(&mut game);
    step(
        &mut game,
        character("monk", "protectPlayer"),
        json!({"playerIds":["p1"]}),
        None,
    );
    let attack = step(
        &mut game,
        character("imp", "attackPlayer"),
        json!({"playerIds":["p6"]}),
        None,
    );
    assert_eq!(
        replay(&game)["currentStep"]["actionRef"],
        character("barber", "swapCharacters")
    );
    let decline = step(
        &mut game,
        character("barber", "swapCharacters"),
        json!({"playerIds":[]}),
        None,
    );
    assert_eq!(
        replay(&game)["latestUndoUnit"]["eventIds"],
        json!([attack["id"], decline["id"]])
    );
    step(&mut game, system("dawn"), Value::Null, None);
}

#[test]
fn seamstress_use_remains_spent_across_nights() {
    let mut game = super::issue223_day::production(
        &[
            "seamstress",
            "monk",
            "soldier",
            "virgin",
            "ravenkeeper",
            "scarletWoman",
            "imp",
        ],
        json!({}),
    );
    begin_night(&mut game);
    step(
        &mut game,
        character("monk", "protectPlayer"),
        json!({"playerIds":["p3"]}),
        None,
    );
    step(
        &mut game,
        character("imp", "attackPlayer"),
        json!({"playerIds":["p3"]}),
        None,
    );
    let used = step(
        &mut game,
        character("seamstress", "compareAlignments"),
        json!({"playerIds":["p2","p7"]}),
        None,
    );
    assert_eq!(
        used["payload"]["result"]["information"]["deliveredResult"],
        json!({"kind":"boolean","value":false})
    );
    step(&mut game, system("dawn"), Value::Null, None);
    begin_night(&mut game);
    step(
        &mut game,
        character("monk", "protectPlayer"),
        json!({"playerIds":["p3"]}),
        None,
    );
    step(
        &mut game,
        character("imp", "attackPlayer"),
        json!({"playerIds":["p3"]}),
        None,
    );
    assert_eq!(replay(&game)["currentStep"]["actionRef"], system("dawn"));
}

#[test]
fn daytime_registration_uses_the_recorded_source_even_if_poisoned_tonight() {
    let mut game = super::issue223_day::production(
        &[
            "flowergirl",
            "townCrier",
            "oracle",
            "monk",
            "virgin",
            "recluse",
            "poisoner",
            "imp",
        ],
        json!({"choosePoisonTarget":{"playerIds":["p1"]}}),
    );
    for _ in 0..3 {
        day(&mut game, json!({"kind":"advance"}));
    }
    day(
        &mut game,
        json!({"kind":"nominate","nominatorId":"p6","nomineeId":"p3"}),
    );
    day(&mut game, json!({"kind":"vote","voterIds":["p6"]}));
    day(&mut game, json!({"kind":"closeNominations"}));
    day(&mut game, json!({"kind":"confirmExecution"}));
    day(&mut game, json!({"kind":"beginNight"}));
    step(
        &mut game,
        character("poisoner", "choosePoisonTarget"),
        json!({"playerIds":["p6"]}),
        None,
    );
    step(
        &mut game,
        character("monk", "protectPlayer"),
        json!({"playerIds":["p3"]}),
        None,
    );
    step(
        &mut game,
        character("imp", "attackPlayer"),
        json!({"playerIds":["p3"]}),
        None,
    );
    for (name, registered_as) in [("flowergirl", "demon"), ("townCrier", "minion")] {
        let state = replay(&game);
        let current = &state["currentStep"];
        assert_eq!(current["character"], name);
        assert_eq!(
            current["informationPrompt"]["computedResult"],
            json!({"kind":"boolean","value":false})
        );
        let event = append(
            &mut game,
            json!({"type":"confirmStep","payload":{"stepId":current["id"],"deliveredResult":{"kind":"boolean","value":true},"registrationJudgments":[{"playerId":"p6","registeredAs":registered_as}]}}),
        );
        assert_eq!(
            event["payload"]["result"]["information"]["deliveredResult"],
            json!({"kind":"boolean","value":true})
        );
    }
}

#[test]
fn demon_absence_at_dawn_uses_existing_day_end_confirmation_and_blocks_progress() {
    let mut game = super::issue223_day::production(
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
    begin_night(&mut game);
    step(
        &mut game,
        character("monk", "protectPlayer"),
        json!({"playerIds":["p1"]}),
        None,
    );
    step(
        &mut game,
        character("pitHag", "changeCharacter"),
        json!({"playerIds":["p7"],"characterIds":["saint"]}),
        None,
    );
    step(&mut game, system("dawn"), Value::Null, None);
    let state = replay(&game);
    assert_eq!(state["day"]["pendingGameEnd"]["winningAlignment"], "good");
    assert_eq!(
        propose(
            &game,
            json!({"type":"confirmDay","payload":{"stepId":state["day"]["stepId"],"expectedEventCount":game["game"]["events"].as_array().unwrap().len(),"input":{"kind":"advance"}}})
        )["ok"],
        false
    );
    day(&mut game, json!({"kind":"confirmGameEnd"}));
    let ended = replay(&game);
    assert_eq!(ended["gameEnd"]["winningAlignment"], "good");
    assert_eq!(
        propose(
            &game,
            json!({"type":"confirmDay","payload":{"stepId":ended["day"]["stepId"],"expectedEventCount":game["game"]["events"].as_array().unwrap().len(),"input":{"kind":"beginNight"}}})
        )["ok"],
        false
    );
}

#[test]
fn poisoned_sage_information_contributes_to_the_current_mathematician_audit() {
    let mut game = super::issue223_day::production(
        &[
            "sage",
            "mathematician",
            "monk",
            "soldier",
            "virgin",
            "recluse",
            "poisoner",
            "imp",
        ],
        json!({"choosePoisonTarget":{"playerIds":["p1"]}}),
    );
    begin_night(&mut game);
    step(
        &mut game,
        character("poisoner", "choosePoisonTarget"),
        json!({"playerIds":["p1"]}),
        None,
    );
    step(
        &mut game,
        character("monk", "protectPlayer"),
        json!({"playerIds":["p4"]}),
        None,
    );
    step(
        &mut game,
        character("imp", "attackPlayer"),
        json!({"playerIds":["p1"]}),
        None,
    );
    let information = step(
        &mut game,
        character("sage", "learnDemon"),
        Value::Null,
        Some(json!({"kind":"playerPair","playerIds":["p3","p4"]})),
    );
    let state = replay(&game);
    assert_eq!(
        state["currentStep"]["informationPrompt"]["computedResult"],
        json!({"kind":"number","value":1})
    );
    let audit = &state["currentStep"]["informationPrompt"]["mathematicianAudit"]["records"];
    assert_eq!(audit[0]["subjectPlayerId"], "p1");
    assert_eq!(
        audit[0]["evidence"][0]["resolutionEventId"],
        information["id"]
    );
    assert_eq!(audit[0]["evidence"][0]["phase"], "night");
}

#[test]
fn poisoned_retained_minion_still_receives_an_ineffective_action() {
    let mut game = super::issue223_day::production(
        &[
            "soldier",
            "virgin",
            "slayer",
            "ravenkeeper",
            "undertaker",
            "monk",
            "sage",
            "flowergirl",
            "poisoner",
            "witch",
            "vigormortis",
        ],
        json!({"choosePoisonTarget":{"playerIds":["p1"]},"chooseCursedPlayer":{"playerIds":["p1"]}}),
    );
    begin_night(&mut game);
    step(
        &mut game,
        character("poisoner", "choosePoisonTarget"),
        json!({"playerIds":["p1"]}),
        None,
    );
    step(
        &mut game,
        character("monk", "protectPlayer"),
        json!({"playerIds":["p1"]}),
        None,
    );
    step(
        &mut game,
        character("witch", "chooseCursedPlayer"),
        json!({"playerIds":["p1"]}),
        None,
    );
    step(
        &mut game,
        character("vigormortis", "attackPlayer"),
        json!({"playerIds":["p10"]}),
        None,
    );
    step(
        &mut game,
        character("vigormortis", "choosePoison"),
        json!({"playerIds":["p8"]}),
        None,
    );
    step(
        &mut game,
        character("flowergirl", "learnDemonVoted"),
        Value::Null,
        Some(json!({"kind":"boolean","value":false})),
    );
    step(&mut game, system("dawn"), Value::Null, None);
    begin_night(&mut game);
    step(
        &mut game,
        character("poisoner", "choosePoisonTarget"),
        json!({"playerIds":["p10"]}),
        None,
    );
    step(
        &mut game,
        character("monk", "protectPlayer"),
        json!({"playerIds":["p1"]}),
        None,
    );
    let event = step(
        &mut game,
        character("witch", "chooseCursedPlayer"),
        json!({"playerIds":["p2"]}),
        None,
    );
    assert_eq!(event["payload"]["result"]["effective"], false);
    assert_eq!(replay(&game)["players"][9]["alive"], false);
}

// #222 consumes explicit presentation metadata rather than duplicating attack rules in UI.
#[test]
fn issue222_attack_input_projects_mayor_and_self_succession_from_current_facts() {
    let mut g = super::issue223_day::production(&["mayor", "monk", "ravenkeeper", "virgin", "slayer", "spy", "imp"], json!({}));
    begin_night(&mut g);
    assert_eq!(replay(&g)["nightNumber"], 2);
    step(&mut g, character("monk", "protectPlayer"), json!({"playerIds":["p4"]}), None);
    let r = replay(&g);
    let options = r["currentStep"]["requiredInput"]["attackOptions"].as_array().unwrap();
    let mayor = options.iter().find(|o|o["targetPlayerId"]=="p1").unwrap();
    assert_eq!(mayor["mayorDecision"]["mayorPlayerId"], "p1");
    assert!(!mayor["mayorDecision"]["bounceTargetPlayerIds"].as_array().unwrap().contains(&json!("p1")));
    let own = options.iter().find(|o|o["targetPlayerId"]=="p7").unwrap();
    assert_eq!(own["successorPlayerIds"], json!(["p6"]));
    step(&mut g, character("imp", "attackPlayer"), json!({"playerIds":["p1"],"mayorDecision":{"kind":"bounce","targetPlayerId":"p4"}}), None);
    assert!(replay(&g)["players"][3]["alive"].as_bool().unwrap());
    step(&mut g, character("spy","inspectGrimoire"), Value::Null, None);
    step(&mut g, system("dawn"), Value::Null, None);
    begin_night(&mut g);assert_eq!(replay(&g)["nightNumber"],3);
    step(&mut g, character("monk", "protectPlayer"), json!({"playerIds":["p1"]}), None);
    let r = replay(&g);
    let options=r["currentStep"]["requiredInput"]["attackOptions"].as_array().unwrap();
    assert!(options.iter().find(|o|o["targetPlayerId"]=="p1").unwrap().get("mayorDecision").is_none());
}

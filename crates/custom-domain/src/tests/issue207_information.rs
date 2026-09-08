//! Real Production JSON information scenarios, with explicit script order and expected values.
use super::issue207_acquisition::replay;
use serde_json::{json, Value};
pub(super) const ORDER: [&str; 9] = [
    "philosopher",
    "snakeCharmer",
    "evilTwin",
    "witch",
    "cerenovus",
    "clockmaker",
    "dreamer",
    "seamstress",
    "mathematician",
];
pub(super) fn game(roster: &[&str], order: &[&str]) -> Value {
    let mut pool = vec![
        "philosopher",
        "snakeCharmer",
        "evilTwin",
        "witch",
        "cerenovus",
        "clockmaker",
        "dreamer",
        "seamstress",
        "mathematician",
        "artist",
        "savant",
        "juggler",
        "sage",
        "soldier",
        "mayor",
        "virgin",
        "scarletWoman",
        "imp",
        "noDashii",
        "vortox",
        "recluse",
    ];
    for character in roster {
        if !pool.contains(character) {
            pool.push(character);
        }
    }
    let mut plan = vec![
        json!({"kind":"system","actionId":"dusk"}),
        json!({"kind":"system","actionId":"minionInfo"}),
        json!({"kind":"system","actionId":"demonInfo"}),
    ];
    for character in order {
        let id = match *character {
            "philosopher" => "chooseAbility",
            "snakeCharmer" => "choosePlayer",
            "evilTwin" => "learnTwin",
            "witch" => "chooseCursedPlayer",
            "cerenovus" => "assignMadness",
            "clockmaker" => "learnSteps",
            "dreamer" => "learnCharacters",
            "seamstress" => "compareAlignments",
            "mathematician" => "learnCount",
            _ => panic!("explicit supported action"),
        };
        plan.push(json!({"kind":"character","characterId":character,"actionId":id}));
    }
    plan.push(json!({"kind":"system","actionId":"dawn"}));
    let mut game = json!({"schemaVersion":4,"game":{"id":"information207","name":"information207","script":{"type":"custom","definition":{"id":"information207","name":"information207","characterIds":pool,"firstNightOrder":plan}},"createdAt":"2026-09-08T00:00:00Z","updatedAt":"2026-09-08T00:00:00Z","events":[]}});
    let players=roster.iter().enumerate().map(|(i,c)|json!({"id":format!("p{}",i+1),"seat":i+1,"name":format!("P{}",i+1),"actualCharacter":c})).collect::<Vec<_>>();
    let result: Value = serde_json::from_str(&crate::propose_json(
        &game.to_string(),
        &json!({"type":"createGame","payload":{"players":players}}).to_string(),
    ))
    .unwrap();
    assert_eq!(result["ok"], true, "{result}");
    game["game"]["events"]
        .as_array_mut()
        .unwrap()
        .push(result["value"]["event"].clone());
    take(&mut game, "minionInfo", Value::Null, None, vec![]);
    take(
        &mut game,
        "demonInfo",
        json!({"characterIds":["soldier","mayor","virgin"]}),
        None,
        vec![],
    );
    game
}
pub(super) fn proposal(
    game: &Value,
    input: Value,
    delivered: Option<Value>,
    judgments: Vec<Value>,
) -> Value {
    let mut payload = json!({"stepId":replay(game)["currentStep"]["id"],"expectedEventCount":game["game"]["events"].as_array().unwrap().len(),"input":input});
    if let Some(delivered) = delivered {
        payload["deliveredResult"] = delivered;
    }
    if !judgments.is_empty() {
        payload["registrationJudgments"] = json!(judgments);
    }
    serde_json::from_str(&crate::propose_json(
        &game.to_string(),
        &json!({"type":"confirmStep","payload":payload}).to_string(),
    ))
    .unwrap()
}
pub(super) fn take(
    game: &mut Value,
    expected: &str,
    input: Value,
    delivered: Option<Value>,
    judgments: Vec<Value>,
) -> Value {
    let state = replay(game);
    let step = &state["currentStep"];
    assert!(
        step["character"] == expected || step["actionRef"]["actionId"] == expected,
        "expected {expected}, got {step}"
    );
    let result = proposal(game, input, delivered, judgments);
    assert_eq!(result["ok"], true, "{result}");
    game["game"]["events"]
        .as_array_mut()
        .unwrap()
        .push(result["value"]["event"].clone());
    replay(game);
    result["value"].clone()
}
pub(super) fn number(n: u64) -> Option<Value> {
    Some(json!({"kind":"number","value":n}))
}
#[test]
fn healthy_shapes_require_truth_keep_dreamer_discretion_and_exact_reveals() {
    let mut game = game(
        &[
            "clockmaker",
            "dreamer",
            "seamstress",
            "artist",
            "savant",
            "scarletWoman",
            "imp",
        ],
        &ORDER,
    );
    assert_eq!(proposal(&game, Value::Null, number(2), vec![])["ok"], false);
    let clock = take(&mut game, "clockmaker", Value::Null, None, vec![]);
    assert_eq!(
        clock["revealPayload"],
        json!({"kind":"numericInformation","characterId":"clockmaker","value":1})
    );
    assert_eq!(
        proposal(
            &game,
            json!({"playerIds":["p2"]}),
            Some(json!({"kind":"characterPair","characterIds":["dreamer","imp"]})),
            vec![]
        )["ok"],
        false
    );
    assert_eq!(
        proposal(&game, json!({"playerIds":["p4"]}), None, vec![])["ok"],
        false
    );
    for evil in ["imp", "scarletWoman"] {
        assert_eq!(
            proposal(
                &game,
                json!({"playerIds":["p4"]}),
                Some(json!({"kind":"characterPair","characterIds":["artist",evil]})),
                vec![]
            )["ok"],
            true
        );
    }
    let dream = take(
        &mut game,
        "dreamer",
        json!({"playerIds":["p4"]}),
        Some(json!({"kind":"characterPair","characterIds":["artist","imp"]})),
        vec![],
    );
    assert_eq!(
        dream["revealPayload"],
        json!({"kind":"dreamerInformation","characterIds":["artist","imp"]})
    );
    for ids in [json!(["p1", "p1"]), json!(["p1", "p3"])] {
        assert_eq!(
            proposal(&game, json!({"playerIds":ids}), None, vec![])["ok"],
            false
        );
    }
    let seam = take(
        &mut game,
        "seamstress",
        json!({"playerIds":["p1","p6"]}),
        None,
        vec![],
    );
    assert_eq!(
        seam["revealPayload"],
        json!({"kind":"seamstressInformation","targetPlayers":[{"playerId":"p1","seat":1,"name":"P1"},{"playerId":"p6","seat":6,"name":"P6"}],"sameAlignment":false})
    );
    assert_eq!(
        replay(&game)["ruleState"]["abilityUses"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
}
#[test]
fn vortox_rejects_actual_truth_for_every_information_shape() {
    let mut game = game(
        &[
            "clockmaker",
            "dreamer",
            "seamstress",
            "mathematician",
            "artist",
            "scarletWoman",
            "vortox",
        ],
        &ORDER,
    );
    assert_eq!(proposal(&game, Value::Null, number(1), vec![])["ok"], false);
    take(&mut game, "clockmaker", Value::Null, number(2), vec![]);
    assert_eq!(
        proposal(
            &game,
            json!({"playerIds":["p5"]}),
            Some(json!({"kind":"characterPair","characterIds":["artist","imp"]})),
            vec![]
        )["ok"],
        false
    );
    take(
        &mut game,
        "dreamer",
        json!({"playerIds":["p5"]}),
        Some(json!({"kind":"characterPair","characterIds":["savant","imp"]})),
        vec![],
    );
    assert_eq!(
        proposal(
            &game,
            json!({"playerIds":["p1","p2"]}),
            Some(json!({"kind":"boolean","value":true})),
            vec![]
        )["ok"],
        false
    );
    take(
        &mut game,
        "seamstress",
        json!({"playerIds":["p1","p2"]}),
        Some(json!({"kind":"boolean","value":false})),
        vec![],
    );
    assert_eq!(
        replay(&game)["currentStep"]["informationPrompt"]["computedResult"]["value"],
        3
    );
    assert_eq!(proposal(&game, Value::Null, number(3), vec![])["ok"], false);
    take(&mut game, "mathematician", Value::Null, number(0), vec![]);
}
#[test]
fn approved_vortox_policy_uses_actual_alignment_before_recluse_registration() {
    let mut game = game(
        &[
            "seamstress",
            "artist",
            "savant",
            "juggler",
            "sage",
            "recluse",
            "scarletWoman",
            "vortox",
        ],
        &ORDER,
    );
    let before = replay(&game)["players"].clone();
    let judgments = vec![json!({"playerId":"p6","registeredAs":"evil"})];
    let input = json!({"playerIds":["p2","p6"]});
    assert_eq!(
        proposal(
            &game,
            input.clone(),
            Some(json!({"kind":"boolean","value":true})),
            judgments.clone()
        )["ok"],
        false
    );
    take(
        &mut game,
        "seamstress",
        input,
        Some(json!({"kind":"boolean","value":false})),
        judgments,
    );
    assert_eq!(replay(&game)["players"], before);
}
#[test]
fn registration_is_scoped_and_counts_only_actual_information_error() {
    let mut game = game(
        &[
            "dreamer",
            "seamstress",
            "mathematician",
            "artist",
            "savant",
            "recluse",
            "scarletWoman",
            "imp",
        ],
        &ORDER,
    );
    let before = replay(&game)["players"].clone();
    take(
        &mut game,
        "dreamer",
        json!({"playerIds":["p6"]}),
        Some(json!({"kind":"characterPair","characterIds":["artist","imp"]})),
        vec![json!({"playerId":"p6","registeredAs":"demon","characterId":"imp"})],
    );
    take(
        &mut game,
        "seamstress",
        json!({"playerIds":["p4","p6"]}),
        None,
        vec![],
    );
    assert_eq!(replay(&game)["players"], before);
    let math = take(&mut game, "mathematician", Value::Null, None, vec![]);
    assert_eq!(math["revealPayload"]["value"], 1);
}
#[test]
fn acquired_clockmaker_runs_immediately_even_when_its_slot_has_passed() {
    let order = [
        "clockmaker",
        "philosopher",
        "snakeCharmer",
        "evilTwin",
        "witch",
        "cerenovus",
        "dreamer",
        "seamstress",
        "mathematician",
    ];
    let mut game = game(
        &[
            "philosopher",
            "artist",
            "savant",
            "juggler",
            "sage",
            "scarletWoman",
            "imp",
        ],
        &order,
    );
    take(
        &mut game,
        "philosopher",
        json!({"characterIds":["clockmaker"]}),
        None,
        vec![],
    );
    assert_eq!(replay(&game)["currentStep"]["playerId"], "p1");
    let result = take(&mut game, "clockmaker", Value::Null, None, vec![]);
    assert_eq!(result["revealPayload"]["value"], 1);
    assert_eq!(replay(&game)["currentStep"]["id"], "firstNight:system:dawn");
}

#[test]
fn every_impaired_information_shape_accepts_only_well_formed_allowed_values() {
    for character in ["clockmaker", "dreamer", "seamstress", "mathematician"] {
        let game = game(
            &[
                character,
                "noDashii",
                "artist",
                "savant",
                "juggler",
                "sage",
                "scarletWoman",
            ],
            &ORDER,
        );
        let (input, truth, wrong) = match character {
            "clockmaker" => (
                Value::Null,
                json!({"kind":"number","value":2}),
                json!({"kind":"number","value":1}),
            ),
            "mathematician" => (
                Value::Null,
                json!({"kind":"number","value":0}),
                json!({"kind":"number","value":1}),
            ),
            "dreamer" => (
                json!({"playerIds":["p4"]}),
                json!({"kind":"characterPair","characterIds":["savant","imp"]}),
                json!({"kind":"characterPair","characterIds":["artist","imp"]}),
            ),
            _ => (
                json!({"playerIds":["p4","p5"]}),
                json!({"kind":"boolean","value":true}),
                json!({"kind":"boolean","value":false}),
            ),
        };
        for value in [truth, wrong] {
            assert_eq!(
                proposal(&game, input.clone(), Some(value), vec![])["ok"],
                true,
                "{character}"
            );
        }
        assert_eq!(
            proposal(
                &game,
                input,
                Some(json!({"kind":"characterPair","characterIds":["artist","artist"]})),
                vec![]
            )["ok"],
            false
        );
    }
}
#[test]
fn vortox_requires_false_information_even_when_philosopher_drinks_the_original_owner() {
    for character in ["clockmaker", "dreamer", "seamstress"] {
        let mut game = game(
            &[
                "philosopher",
                character,
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
            json!({"characterIds":[character]}),
            None,
            vec![],
        );
        let (input, truth, wrong) = match character {
            "clockmaker" => (
                Value::Null,
                json!({"kind":"number","value":1}),
                json!({"kind":"number","value":2}),
            ),
            "dreamer" => (
                json!({"playerIds":["p3"]}),
                json!({"kind":"characterPair","characterIds":["artist","imp"]}),
                json!({"kind":"characterPair","characterIds":["savant","imp"]}),
            ),
            _ => (
                json!({"playerIds":["p3","p4"]}),
                json!({"kind":"boolean","value":true}),
                json!({"kind":"boolean","value":false}),
            ),
        };
        for expected_actor in if character == "clockmaker" {
            ["p1", "p2"]
        } else {
            ["p2", "p1"]
        } {
            assert_eq!(replay(&game)["currentStep"]["playerId"], expected_actor);
            assert_eq!(
                proposal(&game, input.clone(), Some(truth.clone()), vec![])["ok"],
                false
            );
            take(
                &mut game,
                character,
                input.clone(),
                Some(wrong.clone()),
                vec![],
            );
        }
    }
}
#[test]
fn seamstress_deferral_does_not_spend_and_replay_rejects_forged_information() {
    let mut game = game(
        &[
            "seamstress",
            "artist",
            "savant",
            "juggler",
            "sage",
            "scarletWoman",
            "imp",
        ],
        &ORDER,
    );
    let before = game.clone();
    take(&mut game, "seamstress", Value::Null, None, vec![]);
    assert!(replay(&game)["ruleState"].get("abilityUses").is_none());
    let mut forged = before;
    let result = proposal(&forged, json!({"playerIds":["p2","p3"]}), None, vec![]);
    let mut event = result["value"]["event"].clone();
    event["payload"]["result"]["information"]["deliveredResult"]["value"] = json!(false);
    forged["game"]["events"].as_array_mut().unwrap().push(event);
    let rejected: Value = serde_json::from_str(&crate::replay_json(&forged.to_string())).unwrap();
    assert_eq!(rejected["ok"], false);
}

#[test]
fn bounded_vortox_dreamer_without_a_false_pair_fails_without_inventing_characters() {
    use crate::{
        characters::{
            resolve_custom_script_ids,
            sects_and_violets::{registrations, resolve_effects},
        },
        contracts::SetupPlayerInput,
        first_night::ActionContext,
        rules::CustomRuleService,
        state::CustomGameFacts,
    };
    let definition = resolve_custom_script_ids(&["dreamer".into(), "vortox".into()]).unwrap();
    let players = ["dreamer", "vortox"]
        .iter()
        .enumerate()
        .map(|(i, c)| {
            crate::setup::player_from_setup_input_for_custom(
                &definition,
                &SetupPlayerInput {
                    id: Some(format!("p{i}")),
                    seat: (i + 1) as u8,
                    name: c.to_string(),
                    actual_character: c.to_string(),
                    shown_character: None,
                },
            )
            .unwrap()
        })
        .collect();
    let mut facts = CustomGameFacts::from_players(players);
    resolve_effects(&definition, &mut facts).unwrap();
    let rules = CustomRuleService::new(&definition, &facts);
    let context = ActionContext {
        rule_service: &rules,
        event_id: "",
    };
    let entry=registrations().into_iter().find(|r|matches!(&r.spec.action_ref,crate::contracts::FirstNightActionRef::Character{character_id,..}if character_id=="dreamer")).unwrap();
    assert!(entry.handler.project(&entry.spec, &context).is_err());
    assert_eq!(definition.character_ids(), vec!["dreamer", "vortox"]);
}

use super::issue207_acquisition::replay;
use super::issue225_nights::{day, step};
use super::issue237_carousel::configured_game;
use serde_json::{json, Value};

fn game() -> Value {
    let mut g = configured_game(
        &[
            "grandmother",
            "gambler",
            "fool",
            "noble",
            "soldier",
            "artist",
            "mayor",
            "moonchild",
            "golem",
            "devilsAdvocate",
            "assassin",
            "imp",
        ],
        None,
        "noble",
    );
    for _ in 0..30 {
        let state = replay(&g);
        if state["phase"] == "day" {
            break;
        }
        let s = &state["currentStep"];
        let input = match s["actionRef"]["actionId"].as_str().unwrap() {
            "demonInfo" => {
                json!({"characterIds":s["requiredInput"]["allowedCharacterIds"].as_array().unwrap()[..3]})
            }
            "minionInfo" | "dawn" => Value::Null,
            "protectExecution" => json!({"playerIds":["p5"]}),
            "learnGrandchild" => json!({"playerIds":["p4"]}),
            "learnPlayers" => json!({"playerIds":["p1","p2","p10"]}),
            _ => panic!("unexpected first night step: {s}"),
        };
        step(&mut g, s["actionRef"].clone(), input, None);
    }
    for _ in 0..3 {
        day(&mut g, json!({"kind":"advance"}));
    }
    g
}
fn nominate(g: &mut Value, target: &str) -> Value {
    day(
        g,
        json!({"kind":"nominate","nominatorId":"p9","nomineeId":target}),
    );
    g["game"]["events"]
        .as_array()
        .unwrap()
        .last()
        .unwrap()
        .clone()
}
fn alive(g: &Value, id: &str) -> bool {
    replay(g)["players"]
        .as_array()
        .unwrap()
        .iter()
        .find(|p| p["id"] == id)
        .unwrap()["alive"]
        .as_bool()
        .unwrap()
}
fn round_trip_and_undo(g: &Value, before: &Value, event_count: usize) {
    let loaded: Value = serde_json::from_str(&g.to_string()).unwrap();
    assert_eq!(replay(&loaded), replay(g));
    let mut undone = loaded;
    for _ in 0..event_count {
        undone["game"]["events"].as_array_mut().unwrap().pop();
    }
    assert_eq!(replay(&undone), replay(before));
}
fn next_night(g: &mut Value, attack: &str) {
    day(g, json!({"kind":"vote","voterIds":[]}));
    day(g, json!({"kind":"closeNominations"}));
    day(g, json!({"kind":"confirmExecution"}));
    day(g, json!({"kind":"beginNight"}));
    for _ in 0..30 {
        let state = replay(g);
        if state["phase"] == "day" {
            return;
        }
        let s = &state["currentStep"];
        let input = match s["actionRef"]["actionId"].as_str().unwrap() {
            "guessCharacter" => json!({"playerIds":["p2"],"characterIds":["gambler"]}),
            "protectExecution" => json!({"playerIds":["p6"]}),
            "attackPlayer" => json!({"playerIds":[attack]}),
            "killPlayer" | "resolveDeath" | "dusk" | "dawn" => Value::Null,
            _ => panic!("unexpected step: {s}"),
        };
        step(g, s["actionRef"].clone(), input, None);
    }
    panic!("day not reached");
}

#[test]
fn all_eight_golem_fool_preview_consumption_replay_undo_and_later_death() {
    let mut g = game();
    let before = g.clone();
    let state = replay(&g);
    let preview = state["day"]["golemNominationOptions"]
        .as_array()
        .unwrap()
        .iter()
        .find(|o| o["targetPlayerId"] == "p3")
        .unwrap();
    assert_eq!(preview["outcome"], "protected");
    let event = nominate(&mut g, "p3");
    assert_eq!(event["payload"]["result"]["golemEffects"], json!([preview]));
    assert!(alive(&g, "p3"));
    let state = replay(&g);
    for role in ["golem", "fool"] {
        assert!(state["ruleState"]["abilityUses"]
            .as_array()
            .unwrap()
            .iter()
            .any(|u| u["abilityUse"]["characterId"] == role));
    }
    assert_eq!(state["day"]["stage"], "voting");
    assert_eq!(state["latestUndoUnit"]["eventIds"], json!([event["id"]]));
    round_trip_and_undo(&g, &before, 1);
    next_night(&mut g, "p3");
    assert!(!alive(&g, "p3"));
}

#[test]
fn all_eight_golem_kills_noble_grandchild_without_grandmother_chain() {
    let mut g = game();
    let before = g.clone();
    assert!(g["game"]["events"]
        .as_array()
        .unwrap()
        .iter()
        .any(|e| e["payload"]["actionRef"]["characterId"] == "noble"));
    let event = nominate(&mut g, "p4");
    assert_eq!(event["payload"]["result"]["deathPlayerIds"], json!(["p4"]));
    assert!(!alive(&g, "p4"));
    assert!(alive(&g, "p1"));
    assert_eq!(replay(&g)["day"]["deaths"][0]["cause"]["cause"], "golem");
    round_trip_and_undo(&g, &before, 1);
}

#[test]
fn all_eight_golem_moonchild_choice_blocks_vote_and_resolves_that_night() {
    let mut g = game();
    let before = g.clone();
    let nomination = nominate(&mut g, "p8");
    let state = replay(&g);
    let c = state["day"]["consequences"]
        .as_array()
        .unwrap()
        .iter()
        .find(|c| c["source"]["characterId"] == "moonchild")
        .unwrap();
    let command = json!({"type":"confirmDay","payload":{"stepId":state["day"]["stepId"],
        "input":{"kind":"vote","voterIds":[]}}});
    let rejected: Value =
        serde_json::from_str(&crate::propose_json(&g.to_string(), &command.to_string())).unwrap();
    assert_eq!(rejected["ok"], false);
    day(
        &mut g,
        json!({"kind":"resolveConsequence","consequenceId":c["id"],"playerId":"p4"}),
    );
    let choice = g["game"]["events"].as_array().unwrap().last().unwrap();
    assert_eq!(
        replay(&g)["latestUndoUnit"]["eventIds"],
        json!([nomination["id"], choice["id"]])
    );
    round_trip_and_undo(&g, &before, 2);
    next_night(&mut g, "p5");
    assert!(!alive(&g, "p4"));
    assert!(alive(&g, "p1"));
    assert!(alive(&g, "p5"));
    let loaded: Value = serde_json::from_str(&g.to_string()).unwrap();
    assert_eq!(replay(&loaded), replay(&g));
}

// Regression expectations follow the Mathematician's "another character's ability"
// rule and the Fool/Assassin almanacs, not the current computed result.
fn review_until(g: &mut Value, stop: &str, inputs: Value) {
    for _ in 0..40 {
        let state = replay(g);
        if state["phase"] == stop || state["currentStep"]["character"] == stop {
            return;
        }
        let s = &state["currentStep"];
        let action = s["actionRef"]["actionId"].as_str().expect("active step");
        let input = if action == "demonInfo" {
            json!({"characterIds":s["requiredInput"]["allowedCharacterIds"].as_array().unwrap()[..3]})
        } else if let Some(input) = inputs.get(action) {
            input.clone()
        } else if s["requiredInput"]["optional"] == true
            || s["requiredInput"]["kind"] == "none"
            || matches!(action, "dawn" | "dusk" | "minionInfo")
        {
            Value::Null
        } else {
            panic!("missing input for {s}");
        };
        let computed = s["informationPrompt"]["computedResult"].clone();
        step(
            g,
            s["actionRef"].clone(),
            input,
            (!computed.is_null()).then_some(computed),
        );
    }
    panic!("did not reach {stop}");
}
fn review_act(g: &mut Value, input: Value) -> Value {
    let action = replay(g)["currentStep"]["actionRef"].clone();
    step(g, action, input, None)
}
fn math_subjects(g: &Value) -> Vec<String> {
    let s = replay(g);
    assert_eq!(s["currentStep"]["character"], "mathematician");
    s["currentStep"]["informationPrompt"]["mathematicianAudit"]["records"]
        .as_array()
        .unwrap()
        .iter()
        .map(|r| r["subjectPlayerId"].as_str().unwrap().into())
        .collect()
}
fn explanation(g: &Value, event: &Value) -> Value {
    replay(g)["ruleState"]["deathResolutions"]
        .as_array()
        .unwrap()
        .iter()
        .find(|r| r["eventId"] == event["id"])
        .unwrap()["explanations"]
        .clone()
}

#[test]
fn prevented_imp_death_counts_the_imp_and_round_trip_undo_restores_the_audit() {
    let mut g = configured_game(
        &[
            "fool",
            "mathematician",
            "soldier",
            "artist",
            "mayor",
            "assassin",
            "imp",
        ],
        None,
        "fool",
    );
    review_until(&mut g, "day", json!({}));
    super::issue225_nights::begin_night(&mut g);
    let before = g.clone();
    review_act(&mut g, json!({"playerIds":["p1"]}));
    review_act(&mut g, Value::Null);
    assert_eq!(math_subjects(&g), vec!["p7"]);
    assert_eq!(
        replay(&g)["currentStep"]["informationPrompt"]["computedResult"],
        json!({"kind":"number","value":1})
    );
    round_trip_and_undo(&g, &before, 2);
    // The spent Fool's next death is ordinary; the new dawn also clears the audit window.
    review_until(&mut g, "day", json!({}));
    super::issue225_nights::begin_night(&mut g);
    review_act(&mut g, json!({"playerIds":["p1"]}));
    review_act(&mut g, Value::Null);
    assert_eq!(math_subjects(&g), Vec::<String>::new());
}

#[test]
fn assassin_bypass_counts_the_healthy_fool_including_an_acquired_instance() {
    for acquired in [false, true] {
        let mut g = configured_game(
            &[
                if acquired { "philosopher" } else { "fool" },
                "mathematician",
                "soldier",
                "artist",
                "mayor",
                "assassin",
                "imp",
            ],
            None,
            "fool",
        );
        review_until(
            &mut g,
            "day",
            json!({"chooseAbility":{"characterIds":["fool"]}}),
        );
        super::issue225_nights::begin_night(&mut g);
        review_act(&mut g, json!({"playerIds":["p4"]}));
        let before = g.clone();
        let event = review_act(&mut g, json!({"playerIds":["p1"]}));
        assert_eq!(math_subjects(&g), vec!["p1"]);
        let explanations = explanation(&g, &event);
        assert_eq!(explanations[0]["reason"]["kind"], "bypassedProtection");
        assert_eq!(explanations[0]["reason"]["source"]["characterId"], "fool");
        assert_eq!(explanations[0]["reason"]["source"]["ownerPlayerId"], "p1");
        assert!(event["payload"]["result"].get("explanations").is_none());
        round_trip_and_undo(&g, &before, 1);
    }
}

#[test]
fn poisoned_or_spent_fool_has_no_active_protection_for_assassin_to_bypass() {
    let mut g = configured_game(
        &[
            "fool",
            "mathematician",
            "soldier",
            "artist",
            "mayor",
            "slayer",
            "ravenkeeper",
            "poisoner",
            "assassin",
            "imp",
        ],
        None,
        "fool",
    );
    review_until(
        &mut g,
        "day",
        json!({"choosePoisonTarget":{"playerIds":["p1"]}}),
    );
    super::issue225_nights::begin_night(&mut g);
    review_until(
        &mut g,
        "assassin",
        json!({"choosePoisonTarget":{"playerIds":["p1"]},"attackPlayer":{"playerIds":["p4"]}}),
    );
    let event = review_act(&mut g, json!({"playerIds":["p1"]}));
    assert_eq!(math_subjects(&g), Vec::<String>::new());
    assert!(explanation(&g, &event).is_null());

    let mut g = configured_game(
        &[
            "fool",
            "mathematician",
            "soldier",
            "artist",
            "mayor",
            "assassin",
            "imp",
        ],
        None,
        "fool",
    );
    review_until(&mut g, "day", json!({}));
    super::issue225_nights::begin_night(&mut g);
    review_act(&mut g, json!({"playerIds":["p1"]}));
    let event = review_act(&mut g, json!({"playerIds":["p1"]}));
    assert_eq!(math_subjects(&g), vec!["p7"]); // Only the preceding blocked Imp attack.
    assert!(explanation(&g, &event).is_null());
}

#[test]
fn golem_prevented_by_fool_counts_the_golem_with_day_evidence() {
    let mut g = configured_game(
        &[
            "golem",
            "mathematician",
            "fool",
            "soldier",
            "poisoner",
            "imp",
        ],
        None,
        "fool",
    );
    review_until(
        &mut g,
        "day",
        json!({"choosePoisonTarget":{"playerIds":["p4"]}}),
    );
    for _ in 0..3 {
        day(&mut g, json!({"kind":"advance"}));
    }
    let before = g.clone();
    day(
        &mut g,
        json!({"kind":"nominate","nominatorId":"p1","nomineeId":"p3"}),
    );
    round_trip_and_undo(&g, &before, 1);
    day(&mut g, json!({"kind":"vote","voterIds":[]}));
    day(&mut g, json!({"kind":"closeNominations"}));
    day(&mut g, json!({"kind":"confirmExecution"}));
    day(&mut g, json!({"kind":"beginNight"}));
    review_until(
        &mut g,
        "mathematician",
        json!({"choosePoisonTarget":{"playerIds":["p4"]},"attackPlayer":{"playerIds":["p5"]}}),
    );
    assert_eq!(math_subjects(&g), vec!["p1"]);
    let evidence = &replay(&g)["currentStep"]["informationPrompt"]["mathematicianAudit"]["records"]
        [0]["evidence"][0];
    assert_eq!(evidence["phase"], "day");
    assert_eq!(evidence["outcome"]["effect"], "golemDeath");
}

#[test]
fn dead_soldier_attack_explanation_is_frozen_at_the_attack_prefix() {
    let mut g = configured_game(
        &[
            "fool",
            "mathematician",
            "soldier",
            "artist",
            "mayor",
            "assassin",
            "imp",
        ],
        None,
        "fool",
    );
    review_until(&mut g, "day", json!({}));
    super::issue225_nights::begin_night(&mut g);
    review_act(&mut g, json!({"playerIds":["p4"]}));
    review_act(&mut g, json!({"playerIds":["p3"]}));
    review_until(&mut g, "day", json!({}));
    super::issue225_nights::begin_night(&mut g);
    let before = g.clone();
    let event = review_act(&mut g, json!({"playerIds":["p3"]}));
    assert_eq!(
        explanation(&g, &event),
        json!([{"playerId":"p3","reason":{"kind":"alreadyDead"}}])
    );
    round_trip_and_undo(&g, &before, 1);
}

#[test]
fn fool_blocks_a_witch_death_but_not_the_nomination_for_mathematician() {
    let mut g = configured_game(
        &[
            "fool",
            "mathematician",
            "soldier",
            "artist",
            "mayor",
            "witch",
            "imp",
        ],
        None,
        "fool",
    );
    review_until(
        &mut g,
        "day",
        json!({"chooseCursedPlayer":{"playerIds":["p1"]}}),
    );
    for _ in 0..3 {
        day(&mut g, json!({"kind":"advance"}));
    }
    day(
        &mut g,
        json!({"kind":"nominate","nominatorId":"p1","nomineeId":"p4"}),
    );
    day(&mut g, json!({"kind":"confirmDeath"}));
    assert!(alive(&g, "p1"));
    assert_eq!(replay(&g)["day"]["stage"], "voting");
    day(&mut g, json!({"kind":"vote","voterIds":[]}));
    day(&mut g, json!({"kind":"closeNominations"}));
    day(&mut g, json!({"kind":"confirmExecution"}));
    day(&mut g, json!({"kind":"beginNight"}));
    review_until(
        &mut g,
        "mathematician",
        json!({"chooseCursedPlayer":{"playerIds":["p3"]},"attackPlayer":{"playerIds":["p4"]}}),
    );
    assert_eq!(math_subjects(&g), vec!["p6"]);
    assert_eq!(
        replay(&g)["currentStep"]["informationPrompt"]["mathematicianAudit"]["records"][0]
            ["evidence"][0]["outcome"]["effect"],
        "witchDeath"
    );
}

#[test]
fn boffin_fool_protection_counts_a_blocked_slayer_shot_with_its_actual_source() {
    let mut g = configured_game(
        &[
            "slayer",
            "mathematician",
            "soldier",
            "artist",
            "mayor",
            "boffin",
            "imp",
        ],
        Some("fool"),
        "fool",
    );
    review_until(
        &mut g,
        "day",
        json!({"grantAbility":{"playerIds":["p7"],"characterIds":["fool"]}}),
    );
    let state = replay(&g);
    let action = state["day"]["availableActions"]
        .as_array()
        .unwrap()
        .iter()
        .find(|a| a["characterId"] == "slayer")
        .unwrap();
    day(
        &mut g,
        json!({"kind":"useAbility","actionId":action["id"],"record":{"kind":"slayer","targetPlayerId":"p7","recluseAsDemon":false}}),
    );
    let before = g.clone();
    day(&mut g, json!({"kind":"confirmDeath"}));
    let event = g["game"]["events"].as_array().unwrap().last().unwrap();
    assert!(alive(&g, "p7"));
    assert_eq!(
        explanation(&g, event)[0]["reason"]["source"]["ownerPlayerId"],
        "p7"
    );
    round_trip_and_undo(&g, &before, 1);
    super::issue225_nights::begin_night(&mut g);
    review_until(
        &mut g,
        "mathematician",
        json!({"attackPlayer":{"playerIds":["p4"]}}),
    );
    assert_eq!(math_subjects(&g), vec!["p1"]);
    assert_eq!(
        replay(&g)["currentStep"]["informationPrompt"]["mathematicianAudit"]["records"][0]
            ["evidence"][0]["outcome"]["effect"],
        "slayerDeath"
    );
}

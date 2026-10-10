use super::issue207_acquisition::replay;
use super::issue223_day::production;
use super::issue225_nights::day;
use serde_json::{json, Value};

fn game(target: &str, minion: &str, inputs: Value) -> Value {
    let mut g = production(
        &[
            "golem", target, "mayor", "soldier", minion, "imp", "virgin", "slayer", "artist",
        ],
        inputs,
    );
    for _ in 0..3 {
        day(&mut g, json!({"kind":"advance"}));
    }
    g
}
fn nominate(g: &mut Value, actor: &str, target: &str, registered: bool) -> Value {
    day(
        g,
        json!({"kind":"nominate","nominatorId":actor,"nomineeId":target,"recluseAsDemon":registered}),
    );
    g["game"]["events"]
        .as_array()
        .unwrap()
        .last()
        .unwrap()
        .clone()
}
fn reject(g: &Value, input: Value) {
    let c = json!({"type":"confirmDay","payload":{"stepId":replay(g)["day"]["stepId"],"expectedEventCount":g["game"]["events"].as_array().unwrap().len(),"input":input}});
    let r: Value =
        serde_json::from_str(&crate::propose_json(&g.to_string(), &c.to_string())).unwrap();
    assert_eq!(r["ok"], false, "{r}");
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
fn next_day(g: &mut Value) {
    next_day_with_poison(g, "p4");
}
fn next_day_with_poison(g: &mut Value, poisoned: &str) {
    day(g, json!({"kind":"closeNominations"}));
    day(g, json!({"kind":"confirmExecution"}));
    day(g, json!({"kind":"beginNight"}));
    for _ in 0..30 {
        let s = replay(g);
        if s["phase"] == "day" {
            for _ in 0..3 {
                day(g, json!({"kind":"advance"}));
            }
            return;
        }
        let step = &s["currentStep"];
        let input = match step["actionRef"]["actionId"].as_str().unwrap() {
            "attackPlayer" => json!({"playerIds":["p7"]}),
            "choosePoisonTarget" => json!({"playerIds":[poisoned]}),
            "dusk" | "dawn" => Value::Null,
            _ => panic!("unexpected step {step}"),
        };
        super::issue225_nights::step(g, step["actionRef"].clone(), input, None);
    }
    panic!("day not reached")
}
#[test]
fn golem_atomic_nomination_vote_ghost_usage_and_causal_undo() {
    let mut g = game(
        "saint",
        "poisoner",
        json!({"choosePoisonTarget":{"playerIds":["p4"]}}),
    );
    let before = g.clone();
    let preview = replay(&g)["day"]["golemNominationOptions"]
        .as_array()
        .unwrap()
        .iter()
        .find(|o| o["targetPlayerId"] == "p2")
        .unwrap()
        .clone();
    assert_eq!(preview["outcome"], "death");
    let e = nominate(&mut g, "p1", "p2", false);
    let s = replay(&g);
    assert_eq!(e["payload"]["result"]["golemEffects"], json!([preview]));
    assert_eq!(s["day"]["stage"], "voting");
    assert!(s["day"]["pendingDeath"].is_null());
    assert!(s["day"]["pendingGameEnd"].is_null());
    assert!(!alive(&g, "p2"));
    assert_eq!(s["day"]["executionVoteThreshold"], 4);
    assert_eq!(s["latestUndoUnit"]["eventIds"], json!([e["id"]]));
    assert!(s["ruleState"]["automaticReminders"]
        .as_array()
        .unwrap()
        .iter()
        .any(|t| t["characterId"] == "golem" && t["tokenId"] == "noAbility"));
    let saved: Value = serde_json::from_str(&g.to_string()).unwrap();
    assert_eq!(replay(&saved), s);
    day(&mut g, json!({"kind":"vote","voterIds":["p2"]}));
    assert_eq!(
        replay(&g)["day"]["nominations"][0]["ghostVoteSpentPlayerIds"],
        json!(["p2"])
    );
    g["game"]["events"].as_array_mut().unwrap().pop();
    g["game"]["events"].as_array_mut().unwrap().pop();
    assert_eq!(replay(&g), replay(&before));
}
#[test]
fn golem_demon_recluse_and_poison_consume_the_ability_without_death() {
    for (target, registered, poison, outcome) in [
        ("p6", false, false, "demon"),
        ("p2", true, false, "registeredDemon"),
        ("p2", false, true, "impaired"),
    ] {
        let mut g = game(
            "recluse",
            "poisoner",
            json!({"choosePoisonTarget":{"playerIds":[if poison{"p1"}else{"p4"}]}}),
        );
        let e = nominate(&mut g, "p1", target, registered);
        assert!(alive(&g, target));
        // Impairment wastes the kill, but does not suspend the nomination restriction.
        assert!(golem_reminder(&replay(&g), "p1")["inactiveReason"].is_null());
        assert_eq!(
            e["payload"]["result"]["golemEffects"][0]["outcome"],
            outcome
        );
        day(&mut g, json!({"kind":"vote","voterIds":[]}));
        next_day(&mut g);
        let s = replay(&g);
        assert_eq!(s["day"]["golemSpentNominatorIds"], json!(["p1"]));
        assert!(!s["day"]["eligibleNominatorIds"]
            .as_array()
            .unwrap()
            .contains(&json!("p1")));
        assert!(s["day"]["eligibleNomineeIds"]
            .as_array()
            .unwrap()
            .contains(&json!("p1")));
        reject(
            &g,
            json!({"kind":"nominate","nominatorId":"p1","nomineeId":"p3"}),
        );
    }
}
#[test]
fn golem_recluse_default_dies_and_invalid_registration_or_tampering_is_rejected() {
    let mut g = game(
        "recluse",
        "poisoner",
        json!({"choosePoisonTarget":{"playerIds":["p4"]}}),
    );
    reject(
        &g,
        json!({"kind":"nominate","nominatorId":"p1","nomineeId":"p3","recluseAsDemon":true}),
    );
    reject(
        &g,
        json!({"kind":"nominate","nominatorId":"p3","nomineeId":"p2","recluseAsDemon":true}),
    );
    nominate(&mut g, "p1", "p2", false);
    assert!(!alive(&g, "p2"));
    let last = g["game"]["events"]
        .as_array_mut()
        .unwrap()
        .last_mut()
        .unwrap();
    last["payload"]["result"]["golemEffects"][0]["outcome"] = json!("demon");
    let invalid: Value = serde_json::from_str(&crate::replay_json(&g.to_string())).unwrap();
    assert_eq!(invalid["ok"], false);
}
#[test]
fn golem_death_consequence_blocks_vote_and_shares_the_nomination_undo() {
    let mut g = game(
        "sweetheart",
        "poisoner",
        json!({"choosePoisonTarget":{"playerIds":["p4"]}}),
    );
    let e = nominate(&mut g, "p1", "p2", false);
    let s = replay(&g);
    let c = s["day"]["consequences"][0]["id"].clone();
    reject(&g, json!({"kind":"vote","voterIds":[]}));
    day(
        &mut g,
        json!({"kind":"resolveConsequence","consequenceId":c,"playerId":"p3"}),
    );
    let last = g["game"]["events"].as_array().unwrap().last().unwrap()["id"].clone();
    assert_eq!(
        replay(&g)["latestUndoUnit"]["eventIds"],
        json!([e["id"], last])
    );
    day(&mut g, json!({"kind":"vote","voterIds":["p2"]}));
}
#[test]
fn golem_and_witch_both_trigger_but_self_nomination_has_one_death() {
    for target in ["p1", "p2", "p5"] {
        let mut g = game(
            "saint",
            "witch",
            json!({"chooseCursedPlayer":{"playerIds":["p1"]}}),
        );
        let e = nominate(&mut g, "p1", target, false);
        assert!(!alive(&g, target));
        if target != "p1" {
            assert_eq!(replay(&g)["day"]["pendingDeath"]["cause"], "witch");
            day(&mut g, json!({"kind":"confirmDeath"}));
        }
        let s = replay(&g);
        assert!(!alive(&g, "p1"));
        assert_eq!(s["day"]["stage"], "voting");
        assert_eq!(s["latestUndoUnit"]["eventIds"][0], e["id"]);
        assert_eq!(
            s["day"]["deaths"].as_array().unwrap().len(),
            if target == "p1" { 1 } else { 2 }
        );
    }
}
#[test]
fn golem_acquired_by_philosopher_preserves_virgin_execution_and_both_triggered_effects() {
    let mut g = production(
        &[
            "philosopher",
            "virgin",
            "mayor",
            "soldier",
            "poisoner",
            "imp",
            "saint",
            "recluse",
            "artist",
        ],
        json!({"chooseAbility":{"characterIds":["golem"]},"choosePoisonTarget":{"playerIds":["p4"]}}),
    );
    for _ in 0..3 {
        day(&mut g, json!({"kind":"advance"}));
    }
    nominate(&mut g, "p1", "p2", false);
    assert!(!alive(&g, "p2"));
    assert_eq!(replay(&g)["day"]["pendingDeath"]["cause"], "virgin");
    day(&mut g, json!({"kind":"confirmDeath"}));
    let s = replay(&g);
    assert!(!alive(&g, "p1"));
    assert_eq!(s["day"]["stage"], "nightReady");
    assert_eq!(s["day"]["execution"]["died"], true);
}
#[test]
fn golem_final_three_death_requires_game_end_before_voting() {
    let mut g = production(&["golem", "saint", "artist", "baron", "imp"], json!({}));
    for _ in 0..3 {
        day(&mut g, json!({"kind":"advance"}));
    }
    nominate(&mut g, "p3", "p4", false);
    day(&mut g, json!({"kind":"vote","voterIds":["p1","p2","p3"]}));
    day(&mut g, json!({"kind":"closeNominations"}));
    day(&mut g, json!({"kind":"confirmExecution"}));
    day(&mut g, json!({"kind":"confirmDeath"}));
    day(&mut g, json!({"kind":"beginNight"}));
    loop {
        let s = replay(&g);
        if s["phase"] == "day" {
            break;
        }
        let step = &s["currentStep"];
        let input = if step["actionRef"]["actionId"] == "attackPlayer" {
            json!({"playerIds":["p3"]})
        } else {
            Value::Null
        };
        super::issue225_nights::step(&mut g, step["actionRef"].clone(), input, None);
    }
    for _ in 0..3 {
        day(&mut g, json!({"kind":"advance"}));
    }
    let e = nominate(&mut g, "p1", "p2", false);
    assert_eq!(
        replay(&g)["day"]["pendingGameEnd"]["reason"],
        "twoLivingPlayers"
    );
    reject(&g, json!({"kind":"vote","voterIds":[]}));
    day(&mut g, json!({"kind":"confirmGameEnd"}));
    assert_eq!(replay(&g)["gameEnd"]["winningAlignment"], "evil");
    assert_eq!(replay(&g)["latestUndoUnit"]["eventIds"][0], e["id"]);
}

#[test]
fn golem_witch_death_precedes_sweetheart_consequence_and_all_undo_together() {
    let mut g = game(
        "sweetheart",
        "witch",
        json!({"chooseCursedPlayer":{"playerIds":["p1"]}}),
    );
    let e = nominate(&mut g, "p1", "p2", false);
    assert_eq!(replay(&g)["day"]["pendingDeath"]["cause"], "witch");
    day(&mut g, json!({"kind":"confirmDeath"}));
    let c = replay(&g)["day"]["consequences"][0]["id"].clone();
    day(
        &mut g,
        json!({"kind":"resolveConsequence","consequenceId":c,"playerId":"p3"}),
    );
    let s = replay(&g);
    assert_eq!(s["day"]["stage"], "voting");
    assert_eq!(s["latestUndoUnit"]["eventIds"].as_array().unwrap().len(), 3);
    assert_eq!(s["latestUndoUnit"]["eventIds"][0], e["id"]);
}
fn boffin_game(poisoned: &str) -> Value {
    let mut g = super::issue237_carousel::configured_game(
        &[
            "artist",
            "virgin",
            "mayor",
            "soldier",
            "ravenkeeper",
            "slayer",
            "undertaker",
            "boffin",
            "poisoner",
            "imp",
        ],
        Some("golem"),
        "golem",
    );
    for _ in 0..30 {
        let s = replay(&g);
        if s["phase"] == "day" {
            break;
        }
        let step = &s["currentStep"];
        let input = match step["actionRef"]["actionId"].as_str().unwrap() {
            "demonInfo" => {
                json!({"characterIds":step["requiredInput"]["allowedCharacterIds"].as_array().unwrap()[..3]})
            }
            "choosePoisonTarget" => json!({"playerIds":[poisoned]}),
            "grantAbility" => json!({"playerIds":["p10"],"characterIds":["golem"]}),
            "dawn" => Value::Null,
            _ if step["requiredInput"]["optional"] == true
                || step["requiredInput"]["kind"] == "none" =>
            {
                Value::Null
            }
            _ => panic!("unexpected {step}"),
        };
        super::issue225_nights::step(&mut g, step["actionRef"].clone(), input, None);
    }
    for _ in 0..3 {
        day(&mut g, json!({"kind":"advance"}));
    }
    g
}

#[test]
fn golem_boffin_grant_ignores_demon_poison_but_is_suspended_with_its_provider() {
    for poisoned in ["p10", "p8"] {
        let mut g = boffin_game(poisoned);
        let e = nominate(&mut g, "p10", "p1", false);
        let s = replay(&g);
        if poisoned == "p10" {
            assert!(!alive(&g, "p1"));
            assert_eq!(
                e["payload"]["result"]["golemEffects"][0]["abilityImpairments"],
                json!([])
            );
            assert_eq!(s["day"]["golemSpentNominatorIds"], json!(["p10"]));
        } else {
            assert!(alive(&g, "p1"));
            assert!(e["payload"]["result"].get("golemEffects").is_none());
        }
        assert_eq!(s["players"][9]["actualCharacter"], "imp");
    }
}

#[test]
fn golem_mathematician_counts_only_poison_that_prevented_an_actual_death() {
    for (role, target, expected) in [("artist", "p3", 1), ("artist", "p6", 0), ("fool", "p3", 0)] {
        let mut g = production(
            &[
                "golem",
                "mathematician",
                role,
                "soldier",
                "poisoner",
                "imp",
            ],
            json!({"choosePoisonTarget":{"playerIds":["p1"]}}),
        );
        for _ in 0..3 {
            day(&mut g, json!({"kind":"advance"}));
        }
        nominate(&mut g, "p1", target, false);
        if role == "fool" {
            assert!(alive(&g, "p3"));
            assert!(!replay(&g)["ruleState"]["abilityUses"].as_array().unwrap().iter()
                .any(|u| u["abilityUse"]["characterId"] == "fool"));
        }
        day(&mut g, json!({"kind":"vote","voterIds":[]}));
        day(&mut g, json!({"kind":"closeNominations"}));
        day(&mut g, json!({"kind":"confirmExecution"}));
        day(&mut g, json!({"kind":"beginNight"}));
        for _ in 0..20 {
            let s = replay(&g);
            let step = &s["currentStep"];
            if step["character"] == "mathematician" {
                let records = step["informationPrompt"]["mathematicianAudit"]["records"]
                    .as_array()
                    .unwrap();
                assert_eq!(records.len(), expected);
                if expected == 1 {
                    assert_eq!(records[0]["subjectPlayerId"], "p1");
                    assert_eq!(records[0]["evidence"][0]["outcome"]["effect"], "golemDeath");
                }
                break;
            }
            let input = match step["actionRef"]["actionId"].as_str().unwrap() {
                "choosePoisonTarget" => json!({"playerIds":["p4"]}),
                "attackPlayer" => json!({"playerIds":["p5"]}),
                _ => panic!("unexpected {step}"),
            };
            super::issue225_nights::step(&mut g, step["actionRef"].clone(), input, None);
        }
    }
}

fn golem_reminder<'a>(state: &'a Value, owner: &str) -> &'a Value {
    let tokens = state["ruleState"]["automaticReminders"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|t| {
            t["characterId"] == "golem" && t["tokenId"] == "noAbility" && t["playerId"] == owner
        })
        .collect::<Vec<_>>();
    assert_eq!(tokens.len(), 1);
    tokens[0]
}

#[test]
fn golem_spent_reminder_suspends_and_recovers_with_the_boffin_grant() {
    // Poisoning the Demon must not disable its Boffin-granted ability.
    let mut g = boffin_game("p10");
    let used = nominate(&mut g, "p10", "p1", false);
    let active = golem_reminder(&replay(&g), "p10").clone();
    assert!(active["inactiveReason"].is_null());
    assert_eq!(active["sourceEventId"], used["id"]);
    day(&mut g, json!({"kind":"vote","voterIds":[]}));

    next_day_with_poison(&mut g, "p8");
    let suspended = replay(&g);
    let token = golem_reminder(&suspended, "p10");
    assert!(token["inactiveReason"]
        .as_str()
        .is_some_and(|r| !r.is_empty()));
    assert_eq!(token["sourceEventId"], used["id"]);
    assert_eq!(suspended["day"]["golemSpentNominatorIds"], json!([]));
    assert!(suspended["day"]["eligibleNominatorIds"]
        .as_array()
        .unwrap()
        .contains(&json!("p10")));
    let restored: Value = serde_json::from_str(&g.to_string()).unwrap();
    assert_eq!(replay(&restored), suspended);

    // A normal nomination during suspension must not replace the spent-use evidence.
    let normal = nominate(&mut g, "p10", "p2", false);
    assert!(normal["payload"]["result"].get("golemEffects").is_none());
    assert!(alive(&g, "p2"));
    day(&mut g, json!({"kind":"vote","voterIds":[]}));
    next_day_with_poison(&mut g, "p10");
    let recovered = replay(&g);
    assert_eq!(golem_reminder(&recovered, "p10"), &active);
    assert_eq!(recovered["day"]["golemSpentNominatorIds"], json!(["p10"]));
    assert!(!recovered["day"]["eligibleNominatorIds"]
        .as_array()
        .unwrap()
        .contains(&json!("p10")));
    reject(
        &g,
        json!({"kind":"nominate","nominatorId":"p10","nomineeId":"p2"}),
    );
}

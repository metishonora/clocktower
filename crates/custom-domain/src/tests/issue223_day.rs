use serde_json::{json, Value};
fn game() -> Value {
    serde_json::from_str(include_str!(
        "../../../../fixtures/acceptance/custom-first-night/compatibility/day.game.json"
    ))
    .unwrap()
}
fn replay(game: &Value) -> Value {
    let result: Value = serde_json::from_str(&crate::replay_json(&game.to_string())).unwrap();
    assert_eq!(result["ok"], true, "{result}");
    result["value"].clone()
}
fn command(game: &Value, input: Value) -> Value {
    let state = replay(game);
    json!({"type":"confirmDay","payload":{"stepId":state["day"]["stepId"],"expectedEventCount":game["game"]["events"].as_array().unwrap().len(),"input":input}})
}
fn confirm(game: &mut Value, input: Value) -> Value {
    let cmd = command(game, input);
    let result: Value =
        serde_json::from_str(&crate::propose_json(&game.to_string(), &cmd.to_string())).unwrap();
    assert_eq!(result["ok"], true, "{result}");
    let event = result["value"]["event"].clone();
    game["game"]["events"]
        .as_array_mut()
        .unwrap()
        .push(event.clone());
    replay(game);
    event
}
fn nominations(game: &mut Value) {
    for _ in 0..3 {
        confirm(game, json!({"kind":"advance"}));
    }
}
// Entering the production other-night plan requires production character handlers.
#[cfg(not(feature = "custom-runtime-fixtures"))]
#[test]
fn day_to_night_preserves_vote_evidence_execution_death_and_undo() {
    let mut game = game();
    assert_eq!(replay(&game)["day"]["stage"], "announcement");
    nominations(&mut game);
    confirm(
        &mut game,
        json!({"kind":"nominate","nominatorId":"p1","nomineeId":"p2"}),
    );
    confirm(
        &mut game,
        json!({"kind":"vote","voterIds":["p1","p2","p3","p4"]}),
    );
    let day = replay(&game)["day"].clone();
    assert_eq!(day["executionCandidateId"], "p2");
    assert_eq!(
        day["nominations"][0]["voteParticipants"][0]["characterId"],
        "undertaker"
    );
    confirm(&mut game, json!({"kind":"closeNominations"}));
    let execution = confirm(&mut game, json!({"kind":"confirmExecution"}));
    assert_eq!(replay(&game)["players"][1]["alive"], true);
    let death = confirm(&mut game, json!({"kind":"confirmDeath"}));
    let state = replay(&game);
    assert_eq!(state["players"][1]["alive"], false);
    assert_eq!(state["day"]["execution"]["died"], true);
    assert!(!state["day"]["availableActions"]
        .as_array()
        .unwrap()
        .iter()
        .any(|a| a["characterId"] == "slayer"));
    assert_eq!(
        state["latestUndoUnit"]["eventIds"],
        json!([execution["id"], death["id"]])
    );
    confirm(&mut game, json!({"kind":"beginNight"}));
    assert_eq!(replay(&game)["phase"], "night");
    game["game"]["events"].as_array_mut().unwrap().pop();
    assert_eq!(replay(&game)["day"]["stage"], "nightReady");
}
// Entering the production other-night plan requires production character handlers.
#[cfg(not(feature = "custom-runtime-fixtures"))]
#[test]
fn tied_votes_have_no_candidate_and_explicit_no_execution_can_end_day() {
    let mut game = game();
    nominations(&mut game);
    for (n, t) in [("p1", "p2"), ("p2", "p3")] {
        confirm(
            &mut game,
            json!({"kind":"nominate","nominatorId":n,"nomineeId":t}),
        );
        confirm(
            &mut game,
            json!({"kind":"vote","voterIds":["p1","p2","p3","p4"]}),
        );
    }
    assert!(replay(&game)["day"]["executionCandidateId"].is_null());
    confirm(&mut game, json!({"kind":"closeNominations"}));
    confirm(&mut game, json!({"kind":"confirmExecution"}));
    confirm(&mut game, json!({"kind":"beginNight"}));
    assert_eq!(replay(&game)["phase"], "night");
}
#[test]
fn stale_confirmation_duplicate_voters_and_tampered_evidence_are_rejected() {
    let mut game = game();
    let stale = command(&game, json!({"kind":"advance"}));
    confirm(&mut game, json!({"kind":"advance"}));
    let rejected: Value =
        serde_json::from_str(&crate::propose_json(&game.to_string(), &stale.to_string())).unwrap();
    assert_eq!(rejected["ok"], false);
    for _ in 0..2 {
        confirm(&mut game, json!({"kind":"advance"}));
    }
    confirm(
        &mut game,
        json!({"kind":"nominate","nominatorId":"p1","nomineeId":"p2"}),
    );
    let cmd = command(&game, json!({"kind":"vote","voterIds":["p1","p1"]}));
    let rejected: Value =
        serde_json::from_str(&crate::propose_json(&game.to_string(), &cmd.to_string())).unwrap();
    assert_eq!(rejected["ok"], false);
    confirm(&mut game, json!({"kind":"vote","voterIds":[]}));
    let last = game["game"]["events"]
        .as_array_mut()
        .unwrap()
        .last_mut()
        .unwrap();
    last["payload"]["result"]["participants"][0]["characterId"] = json!("imp");
    let rejected: Value = serde_json::from_str(&crate::replay_json(&game.to_string())).unwrap();
    assert_eq!(rejected["ok"], false);
}

#[cfg(not(feature = "custom-runtime-fixtures"))]
pub(super) fn production(roster: &[&str], inputs: Value) -> Value {
    let mut pool: Vec<&str> = roster.to_vec();
    for id in [
        "undertaker",
        "ravenkeeper",
        "mayor",
        "soldier",
        "virgin",
        "slayer",
        "saint",
        "recluse",
    ] {
        if !pool.contains(&id) {
            pool.push(id);
        }
    }
    let mut definition = json!({"id":"day-223","name":"낮 검증","characterIds":pool});
    let planned: Value = serde_json::from_str(&crate::custom_first_night_plan_json(
        &json!({"customDefinition":definition}).to_string(),
    ))
    .unwrap();
    assert_eq!(planned["ok"], true, "{planned}");
    definition["otherNightOrder"] = crate::tests::other_order_json(&definition["characterIds"]);
    definition["firstNightOrder"] = planned["value"]["plan"].clone();
    let mut game = json!({"schemaVersion":5,"game":{"id":"day-223","name":"낮 검증","script":{"type":"custom","definition":definition},"createdAt":"2026-09-13T00:00:00Z","updatedAt":"2026-09-13T00:00:00Z","events":[]}});
    let players:Vec<_>=roster.iter().enumerate().map(|(i,c)|{let mut p=json!({"id":format!("p{}",i+1),"seat":i+1,"name":format!("P{}",i+1),"actualCharacter":c});if *c=="drunk"{p["shownCharacter"]=inputs["assignShownCharacter"]["characterIds"][0].clone();}p}).collect();
    let created: Value = serde_json::from_str(&crate::propose_json(
        &game.to_string(),
        &json!({"type":"createGame","payload":{"players":players}}).to_string(),
    ))
    .unwrap();
    assert_eq!(created["ok"], true, "{created}");
    game["game"]["events"]
        .as_array_mut()
        .unwrap()
        .push(created["value"]["event"].clone());
    for _ in 0..40 {
        let state = replay(&game);
        if state["phase"] == "day" {
            return game;
        }
        let step = &state["currentStep"];
        let action = step["actionRef"]["actionId"].as_str().unwrap();
        let input = if action == "demonInfo" {
            json!({"characterIds":pool.iter().filter(|c|!roster.contains(c)).take(3).collect::<Vec<_>>()})
        } else {
            inputs.get(action).cloned().unwrap_or(Value::Null)
        };
        let mut payload = if input.get("deliveredResult").is_some() {
            input
        } else {
            json!({"input":input})
        };
        payload["stepId"] = step["id"].clone();
        let result: Value = serde_json::from_str(&crate::propose_json(
            &game.to_string(),
            &json!({"type":"confirmStep","payload":payload}).to_string(),
        ))
        .unwrap();
        assert_eq!(result["ok"], true, "{action}: {result}");
        game["game"]["events"]
            .as_array_mut()
            .unwrap()
            .push(result["value"]["event"].clone());
    }
    panic!("day not reached")
}
fn ability(game: &mut Value, character: &str, record: Value) -> Value {
    let state = replay(game);
    let id = state["day"]["availableActions"]
        .as_array()
        .unwrap()
        .iter()
        .find(|a| a["characterId"] == character)
        .unwrap()["id"]
        .clone();
    confirm(
        game,
        json!({"kind":"useAbility","actionId":id,"record":record}),
    )
}
#[test]
fn virgin_execution_skips_voting_and_latches_its_instance_use() {
    let mut game = game();
    nominations(&mut game);
    confirm(
        &mut game,
        json!({"kind":"nominate","nominatorId":"p1","nomineeId":"p4"}),
    );
    let state = replay(&game);
    assert_eq!(state["day"]["stage"], "executionDeath");
    assert_eq!(state["day"]["pendingDeath"]["cause"], "virgin");
    assert_eq!(state["day"]["execution"]["playerId"], "p1");
    confirm(&mut game, json!({"kind":"confirmDeath"}));
    let state = replay(&game);
    assert_eq!(state["day"]["stage"], "nightReady");
    assert_eq!(state["players"][0]["alive"], false);
    assert!(state["ruleState"]["abilityUses"]
        .as_array()
        .unwrap()
        .iter()
        .any(|u| u["abilityUse"]["characterId"] == "virgin"));
}
#[test]
fn slayer_demon_death_promotes_scarlet_woman_before_win_check() {
    let mut game = game();
    ability(
        &mut game,
        "slayer",
        json!({"kind":"slayer","targetPlayerId":"p7","recluseAsDemon":false}),
    );
    assert_eq!(replay(&game)["day"]["pendingDeath"]["cause"], "slayer");
    confirm(&mut game, json!({"kind":"confirmDeath"}));
    let state = replay(&game);
    assert_eq!(state["players"][6]["alive"], false);
    assert_eq!(state["players"][5]["actualCharacter"], "imp");
    assert!(state["day"]["pendingGameEnd"].is_null());
    assert_eq!(state["day"]["stage"], "announcement");
    assert!(!state["day"]["availableActions"]
        .as_array()
        .unwrap()
        .iter()
        .any(|a| a["characterId"] == "slayer"));
}
#[test]
#[cfg(not(feature = "custom-runtime-fixtures"))]
fn artist_savant_juggler_keep_ability_source_truth_and_usage() {
    let mut game = production(
        &[
            "artist",
            "savant",
            "juggler",
            "monk",
            "soldier",
            "scarletWoman",
            "imp",
        ],
        json!({}),
    );
    ability(
        &mut game,
        "artist",
        json!({"kind":"artist","question":"악마는 오른쪽인가?","answer":"no","truthful":true}),
    );
    ability(
        &mut game,
        "savant",
        json!({"kind":"savant","statements":[{"text":"A","truthful":true},{"text":"B","truthful":false}]}),
    );
    ability(
        &mut game,
        "juggler",
        json!({"kind":"juggler","correctCount":3}),
    );
    let state = replay(&game);
    assert_eq!(state["day"]["abilityRecords"].as_array().unwrap().len(), 3);
    assert_eq!(state["day"]["availableActions"], json!([]));
    assert_eq!(
        state["day"]["abilityRecords"][2]["record"]["correctCount"],
        3
    );
    assert_eq!(
        state["day"]["abilityRecords"][2]["action"]["abilityUse"]["ownerPlayerId"],
        "p3"
    );
}
#[test]
#[cfg(not(feature = "custom-runtime-fixtures"))]
fn vortox_forces_false_day_information_and_no_execution_requires_game_end() {
    let mut game = production(
        &[
            "artist", "savant", "juggler", "monk", "soldier", "poisoner", "vortox",
        ],
        json!({"choosePoisonTarget":{"playerIds":["p1"]}}),
    );
    let state = replay(&game);
    let action = &state["day"]["availableActions"]
        .as_array()
        .unwrap()
        .iter()
        .find(|a| a["characterId"] == "artist")
        .unwrap();
    let cmd = command(
        &game,
        json!({"kind":"useAbility","actionId":action["id"],"record":{"kind":"artist","question":"","answer":"yes","truthful":true}}),
    );
    let invalid: Value =
        serde_json::from_str(&crate::propose_json(&game.to_string(), &cmd.to_string())).unwrap();
    assert_eq!(invalid["ok"], false);
    ability(
        &mut game,
        "artist",
        json!({"kind":"artist","question":"","answer":"yes","truthful":false}),
    );
    nominations(&mut game);
    confirm(&mut game, json!({"kind":"closeNominations"}));
    confirm(&mut game, json!({"kind":"confirmExecution"}));
    assert_eq!(
        replay(&game)["day"]["pendingGameEnd"]["reason"],
        "vortoxNoExecution"
    );
    let cmd = command(&game, json!({"kind":"beginNight"}));
    let invalid: Value =
        serde_json::from_str(&crate::propose_json(&game.to_string(), &cmd.to_string())).unwrap();
    assert_eq!(invalid["ok"], false);
    confirm(&mut game, json!({"kind":"confirmGameEnd"}));
    assert_eq!(replay(&game)["gameEnd"]["winningAlignment"], "evil");
}
#[test]
#[cfg(not(feature = "custom-runtime-fixtures"))]
fn witch_death_resumes_the_same_nomination_and_dead_voter_spends_one_ghost_vote() {
    let mut game = production(
        &[
            "artist", "savant", "juggler", "monk", "soldier", "witch", "imp",
        ],
        json!({"chooseCursedPlayer":{"playerIds":["p1"]}}),
    );
    nominations(&mut game);
    confirm(
        &mut game,
        json!({"kind":"nominate","nominatorId":"p1","nomineeId":"p2"}),
    );
    assert_eq!(replay(&game)["day"]["pendingDeath"]["cause"], "witch");
    confirm(&mut game, json!({"kind":"confirmDeath"}));
    assert_eq!(replay(&game)["day"]["stage"], "voting");
    confirm(&mut game, json!({"kind":"vote","voterIds":["p1"]}));
    assert_eq!(replay(&game)["players"][0]["ghostVoteUsed"], true);
    confirm(
        &mut game,
        json!({"kind":"nominate","nominatorId":"p2","nomineeId":"p3"}),
    );
    let cmd = command(&game, json!({"kind":"vote","voterIds":["p1"]}));
    let invalid: Value =
        serde_json::from_str(&crate::propose_json(&game.to_string(), &cmd.to_string())).unwrap();
    assert_eq!(invalid["ok"], false);
}
#[test]
#[cfg(not(feature = "custom-runtime-fixtures"))]
fn sweetheart_and_klutz_use_death_time_sources_and_barber_is_handed_to_night() {
    for outsider in ["sweetheart", "klutz", "barber"] {
        let mut game = production(
            &[
                "artist",
                "savant",
                "juggler",
                "monk",
                "soldier",
                outsider,
                "scarletWoman",
                "imp",
            ],
            json!({}),
        );
        nominations(&mut game);
        confirm(
            &mut game,
            json!({"kind":"nominate","nominatorId":"p1","nomineeId":"p6"}),
        );
        confirm(
            &mut game,
            json!({"kind":"vote","voterIds":["p1","p2","p3","p4"]}),
        );
        confirm(&mut game, json!({"kind":"closeNominations"}));
        confirm(&mut game, json!({"kind":"confirmExecution"}));
        confirm(&mut game, json!({"kind":"confirmDeath"}));
        let state = replay(&game);
        let c = &state["day"]["consequences"][0];
        assert_eq!(c["source"]["characterId"], outsider);
        if outsider == "barber" {
            confirm(&mut game, json!({"kind":"beginNight"}));
            assert_eq!(replay(&game)["day"]["consequences"][0]["resolved"], false);
            continue;
        }
        confirm(
            &mut game,
            json!({"kind":"resolveConsequence","consequenceId":c["id"],"playerId":if outsider=="klutz"{"p8"}else{"p2"}}),
        );
        let state = replay(&game);
        if outsider == "klutz" {
            assert_eq!(state["day"]["pendingGameEnd"]["reason"], "klutzChoice");
        } else {
            assert!(state["ruleState"]["activeImpairments"]
                .as_array()
                .unwrap()
                .iter()
                .any(|e| e["playerId"] == "p2" && e["sourceCharacterId"] == "sweetheart"));
        }
    }
}

#[test]
fn manual_end_and_undo_restore_same_day_without_recomputing_votes() {
    let mut game = game();
    nominations(&mut game);
    confirm(
        &mut game,
        json!({"kind":"nominate","nominatorId":"p1","nomineeId":"p2"}),
    );
    confirm(&mut game, json!({"kind":"vote","voterIds":[]}));
    let before = replay(&game);
    confirm(
        &mut game,
        json!({"kind":"endGame","winningAlignment":"good"}),
    );
    assert_eq!(replay(&game)["gameEnd"]["reason"], "storytellerDecision");
    let rejected: Value = serde_json::from_str(&crate::propose_json(
        &game.to_string(),
        &command(&game, json!({"kind":"advance"})).to_string(),
    ))
    .unwrap();
    assert_eq!(rejected["ok"], false);
    game["game"]["events"].as_array_mut().unwrap().pop();
    assert_eq!(replay(&game), before);
}
#[test]
#[cfg(not(feature = "custom-runtime-fixtures"))]
fn butler_votes_require_master_and_night_expiry_is_reversible() {
    let mut game = production(
        &[
            "butler",
            "soldier",
            "mayor",
            "poisoner",
            "imp",
            "undertaker",
        ],
        json!({"chooseMaster":{"playerIds":["p2"]},"choosePoisonTarget":{"playerIds":["p3"]}}),
    );
    nominations(&mut game);
    assert_eq!(
        replay(&game)["day"]["voteDependencies"],
        json!([{"voterId":"p1","requiredVoterId":"p2"}])
    );
    confirm(
        &mut game,
        json!({"kind":"nominate","nominatorId":"p1","nomineeId":"p2"}),
    );
    let vote = confirm(
        &mut game,
        json!({"kind":"vote","voterIds":["p1","p3","p4"]}),
    );
    assert_eq!(
        vote["payload"]["result"]["countedVoterIds"],
        json!(["p3", "p4"])
    );
    confirm(&mut game, json!({"kind":"closeNominations"}));
    confirm(&mut game, json!({"kind":"confirmExecution"}));
    let before = replay(&game);
    confirm(&mut game, json!({"kind":"beginNight"}));
    let after = replay(&game);
    assert_eq!(after["day"]["voteDependencies"], json!([]));
    assert_eq!(after["ruleState"]["poisonerChoices"][0]["effective"], false);
    game["game"]["events"].as_array_mut().unwrap().pop();
    assert_eq!(replay(&game), before);
}
#[test]
#[cfg(not(feature = "custom-runtime-fixtures"))]
fn spent_day_ability_has_source_and_unhealthy_virgin_still_spends() {
    let mut game = production(
        &["virgin", "slayer", "soldier", "poisoner", "imp"],
        json!({"choosePoisonTarget":{"playerIds":["p1"]}}),
    );
    ability(
        &mut game,
        "slayer",
        json!({"kind":"slayer","targetPlayerId":"p3","recluseAsDemon":false}),
    );
    assert!(replay(&game)["ruleState"]["abilityUses"]
        .as_array()
        .unwrap()
        .iter()
        .any(|u| u["abilityUse"]["characterId"] == "slayer"));
    nominations(&mut game);
    confirm(
        &mut game,
        json!({"kind":"nominate","nominatorId":"p3","nomineeId":"p1"}),
    );
    let state = replay(&game);
    assert_eq!(state["day"]["stage"], "voting");
    assert!(state["ruleState"]["abilityUses"]
        .as_array()
        .unwrap()
        .iter()
        .any(|u| u["abilityUse"]["characterId"] == "virgin"));
}
#[test]
#[cfg(not(feature = "custom-runtime-fixtures"))]
fn saint_execution_wins_before_normal_population_check() {
    let mut game = production(
        &[
            "saint",
            "soldier",
            "mayor",
            "scarletWoman",
            "imp",
            "undertaker",
        ],
        json!({}),
    );
    nominations(&mut game);
    confirm(
        &mut game,
        json!({"kind":"nominate","nominatorId":"p2","nomineeId":"p1"}),
    );
    confirm(
        &mut game,
        json!({"kind":"vote","voterIds":["p2","p3","p4"]}),
    );
    confirm(&mut game, json!({"kind":"closeNominations"}));
    let root = confirm(&mut game, json!({"kind":"confirmExecution"}));
    confirm(&mut game, json!({"kind":"confirmDeath"}));
    assert_eq!(
        replay(&game)["day"]["pendingGameEnd"]["reason"],
        "saintExecuted"
    );
    confirm(&mut game, json!({"kind":"confirmGameEnd"}));
    assert_eq!(replay(&game)["latestUndoUnit"]["eventIds"][0], root["id"]);
}

#[test]
#[cfg(not(feature = "custom-runtime-fixtures"))]
fn daytime_false_information_retains_mathematician_evidence_and_undo_removes_it() {
    let mut game = production(
        &[
            "artist",
            "savant",
            "juggler",
            "mathematician",
            "soldier",
            "poisoner",
            "vortox",
        ],
        json!({"choosePoisonTarget":{"playerIds":["p1"]},"learnCount":{"input":null,"deliveredResult":{"kind":"number","value":1}}}),
    );
    ability(
        &mut game,
        "artist",
        json!({"kind":"artist","question":"질문","answer":"unknown","truthful":false}),
    );
    let state = replay(&game);
    assert!(state["ruleState"]["automaticReminders"]
        .as_array()
        .unwrap()
        .iter()
        .any(|r| r["characterId"] == "mathematician"
            && r["playerId"] == "p1"
            && r["sourceEventId"]
                == game["game"]["events"].as_array().unwrap().last().unwrap()["id"]));
    game["game"]["events"].as_array_mut().unwrap().pop();
    assert!(!replay(&game)["ruleState"]["automaticReminders"]
        .as_array()
        .unwrap()
        .iter()
        .any(|r| r["characterId"] == "mathematician"));
}

#[test]
#[cfg(not(feature = "custom-runtime-fixtures"))]
fn acquired_slayer_records_real_grant_and_demon_death_source() {
    let mut game = production(
        &["philosopher", "soldier", "mayor", "scarletWoman", "imp"],
        json!({"chooseAbility":{"characterIds":["slayer"]}}),
    );
    let action = replay(&game)["day"]["availableActions"]
        .as_array()
        .unwrap()
        .iter()
        .find(|a| a["characterId"] == "slayer")
        .unwrap()
        .clone();
    assert_eq!(action["abilityUse"]["ownerPlayerId"], "p1");
    assert_ne!(action["abilityUse"]["abilityInstanceId"], "setup:p1");
    assert!(action["simulationSource"].is_null());
    ability(
        &mut game,
        "slayer",
        json!({"kind":"slayer","targetPlayerId":"p5","recluseAsDemon":false}),
    );
    assert_eq!(
        replay(&game)["day"]["pendingDeath"]["source"],
        action["abilityUse"]
    );
    confirm(&mut game, json!({"kind":"confirmDeath"}));
    assert_eq!(replay(&game)["players"][3]["actualCharacter"], "imp");
}
#[test]
#[cfg(not(feature = "custom-runtime-fixtures"))]
fn cerenovus_judgment_and_execution_keep_assignment_and_end_day() {
    let mut game = production(
        &["soldier", "mayor", "undertaker", "cerenovus", "imp"],
        json!({"assignMadness":{"playerIds":["p1"],"characterId":"mayor"}}),
    );
    let assignment = replay(&game)["day"]["madness"][0].clone();
    assert_eq!(assignment["targetPlayerId"], "p1");
    confirm(
        &mut game,
        json!({"kind":"checkMadness","assignmentId":assignment["id"],"violation":true}),
    );
    assert_eq!(replay(&game)["day"]["madness"][0]["canCheck"], false);
    confirm(
        &mut game,
        json!({"kind":"executeMadness","assignmentId":assignment["id"]}),
    );
    assert_eq!(
        replay(&game)["day"]["pendingDeath"]["source"],
        assignment["source"]
    );
    confirm(&mut game, json!({"kind":"confirmDeath"}));
    assert_eq!(replay(&game)["day"]["stage"], "nightReady");
    assert_eq!(replay(&game)["day"]["execution"]["died"], true);
}

#[test]
#[cfg(not(feature = "custom-runtime-fixtures"))]
fn drunk_artist_guidance_does_not_invent_townsfolk_ability_or_vortox_obligation() {
    let mut game = production(
        &[
            "drunk",
            "artist",
            "soldier",
            "mayor",
            "undertaker",
            "ravenkeeper",
            "poisoner",
            "vortox",
        ],
        json!({"assignShownCharacter":{"characterIds":["artist"]},"choosePoisonTarget":{"playerIds":["p3"]}}),
    );
    let state = replay(&game);
    let action = state["day"]["availableActions"]
        .as_array()
        .unwrap()
        .iter()
        .find(|a| a["characterId"] == "artist" && a["actorPlayerId"] == "p1")
        .unwrap();
    assert!(action["abilityUse"].is_null());
    assert_eq!(
        action["simulationSource"]["sourceAbilityUse"]["characterId"],
        "drunk"
    );
    assert_eq!(action["vortox"], false);
    ability(
        &mut game,
        "artist",
        json!({"kind":"artist","question":"질문","answer":"yes","truthful":true}),
    );
    assert!(!replay(&game)["day"]["availableActions"]
        .as_array()
        .unwrap()
        .iter()
        .any(|a| a["characterId"] == "artist" && a["actorPlayerId"] == "p1"));
}

#[test]
#[cfg(not(feature = "custom-runtime-fixtures"))]
fn execution_reminder_requires_a_living_undertaker_source() {
    for (actual, shown, nominee, expected) in [
        ("recluse", "recluse", "p2", false),
        ("undertaker", "undertaker", "p2", true),
        ("drunk", "undertaker", "p2", true),
        ("undertaker", "undertaker", "p1", false),
    ] {
        let mut game = game();
        let player = &mut game["game"]["events"][0]["payload"]["players"][0];
        player["actualCharacter"] = json!(actual);
        player["shownCharacter"] = json!(shown);
        nominations(&mut game);
        confirm(
            &mut game,
            json!({"kind":"nominate","nominatorId":"p2","nomineeId":nominee}),
        );
        confirm(
            &mut game,
            json!({"kind":"vote","voterIds":["p1","p2","p3","p4"]}),
        );
        confirm(&mut game, json!({"kind":"closeNominations"}));
        confirm(&mut game, json!({"kind":"confirmExecution"}));
        confirm(&mut game, json!({"kind":"confirmDeath"}));
        let state = replay(&game);
        assert_eq!(state["day"]["execution"]["died"], true);
        let present = state["ruleState"]["automaticReminders"]
            .as_array()
            .into_iter()
            .flatten()
            .any(|r| r["characterId"] == "undertaker" && r["tokenId"] == "diedToday");
        assert_eq!(present, expected, "{actual}/{shown}, executed {nominee}");
    }
}

#[test]
#[cfg(not(feature = "custom-runtime-fixtures"))]
fn observer_tokens_track_actual_day_actions_under_vortox_and_undo() {
    let mut game = production(
        &[
            "flowergirl",
            "townCrier",
            "soldier",
            "scarletWoman",
            "vortox",
        ],
        json!({}),
    );
    let tokens = |game: &Value| -> Vec<String> {
        replay(game)["ruleState"]["automaticReminders"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|r| r["characterId"] == "flowergirl" || r["characterId"] == "townCrier")
            .map(|r| r["tokenId"].as_str().unwrap().to_owned())
            .collect()
    };
    assert_eq!(tokens(&game), ["demonDidNotVote", "minionDidNotNominate"]);
    nominations(&mut game);
    confirm(
        &mut game,
        json!({"kind":"nominate","nominatorId":"p4","nomineeId":"p3"}),
    );
    assert_eq!(tokens(&game), ["demonDidNotVote", "minionNominated"]);
    confirm(&mut game, json!({"kind":"vote","voterIds":["p5"]}));
    assert_eq!(tokens(&game), ["demonVoted", "minionNominated"]);
    game["game"]["events"].as_array_mut().unwrap().pop();
    assert_eq!(tokens(&game), ["demonDidNotVote", "minionNominated"]);
    game["game"]["events"].as_array_mut().unwrap().pop();
    assert_eq!(tokens(&game), ["demonDidNotVote", "minionDidNotNominate"]);
}

#[test]
#[cfg(not(feature = "custom-runtime-fixtures"))]
fn scarlet_successor_keeps_source_token_after_identity_changes_and_undo_removes_it() {
    let mut game = production(
        &["soldier", "mayor", "undertaker", "scarletWoman", "imp"],
        json!({}),
    );
    nominations(&mut game);
    confirm(
        &mut game,
        json!({"kind":"nominate","nominatorId":"p1","nomineeId":"p5"}),
    );
    confirm(
        &mut game,
        json!({"kind":"vote","voterIds":["p1","p2","p3"]}),
    );
    confirm(&mut game, json!({"kind":"closeNominations"}));
    confirm(&mut game, json!({"kind":"confirmExecution"}));
    let death = confirm(&mut game, json!({"kind":"confirmDeath"}));
    let state = replay(&game);
    assert_eq!(state["players"][3]["actualCharacter"], "imp");
    let token = state["ruleState"]["automaticReminders"]
        .as_array()
        .unwrap()
        .iter()
        .find(|r| r["characterId"] == "scarletWoman")
        .unwrap();
    assert_eq!(token["tokenId"], "isTheDemon");
    assert_eq!(token["playerId"], "p4");
    assert_eq!(token["sourceEventId"], death["id"]);
    game["game"]["events"].as_array_mut().unwrap().pop();
    assert!(replay(&game)["ruleState"]["automaticReminders"]
        .as_array()
        .is_none_or(|tokens| !tokens.iter().any(|r| r["characterId"] == "scarletWoman")));
}

#[test]
fn execution_target_is_derived_from_votes_and_cannot_be_overridden_or_cancelled() {
    let mut game = game();
    nominations(&mut game);
    confirm(
        &mut game,
        json!({"kind":"nominate","nominatorId":"p1","nomineeId":"p2"}),
    );
    confirm(
        &mut game,
        json!({"kind":"vote","voterIds":["p1","p2","p3","p4"]}),
    );
    confirm(&mut game, json!({"kind":"closeNominations"}));
    for input in [
        json!({"kind":"execute","playerId":null}),
        json!({"kind":"execute","playerId":"p3"}),
        json!({"kind":"confirmExecution","playerId":null}),
    ] {
        let cmd = command(&game, input);
        let result: Value =
            serde_json::from_str(&crate::propose_json(&game.to_string(), &cmd.to_string()))
                .unwrap();
        assert_eq!(result["ok"], false);
    }
    confirm(&mut game, json!({"kind":"confirmExecution"}));
    assert_eq!(replay(&game)["day"]["execution"]["playerId"], "p2");
}

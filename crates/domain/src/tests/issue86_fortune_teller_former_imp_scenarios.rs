use super::support::*;
use crate::*;
use serde_json::{json, Value};

#[test]
fn fortune_teller_detects_both_the_dead_former_imp_and_living_successor() {
    let game = game_at_imp_step();

    let self_kill = propose(
        &game,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "night:imp",
                "input": { "playerIds": ["player-7"] }
            }
        }),
    );
    assert_eq!(self_kill["ok"], true, "Imp self-kill failed as {self_kill}");
    let game = with_event(&game, self_kill["value"]["event"].clone());

    let pending = replay(&game);
    assert_eq!(pending["ok"], true, "succession replay failed as {pending}");
    assert_eq!(
        pending["value"]["currentStep"]["stepType"],
        "demonSuccession"
    );
    assert_eq!(
        pending["value"]["currentStep"]["requiredInput"]["demonSuccession"]["successorPlayerId"],
        "player-6"
    );
    assert!(!warning_codes(&pending).contains(&"DEMON_DEAD_GOOD_WIN"));

    let succession_step_id = pending["value"]["currentStep"]["id"]
        .as_str()
        .expect("succession step should have an id");
    let succession = propose(
        &game,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": succession_step_id,
                "input": { "successorPlayerId": "player-6" }
            }
        }),
    );
    assert_eq!(succession["ok"], true, "succession failed as {succession}");
    let game = with_event(&game, succession["value"]["event"].clone());

    let fortune_teller = replay(&game);
    assert_eq!(
        fortune_teller["ok"], true,
        "Fortune Teller replay failed as {fortune_teller}"
    );
    assert_eq!(
        fortune_teller["value"]["currentStep"]["id"],
        "night:fortuneTeller"
    );
    assert!(!warning_codes(&fortune_teller).contains(&"DEMON_DEAD_GOOD_WIN"));
    assert_eq!(player(&fortune_teller, "player-6")["alive"], true);
    assert_eq!(
        player(&fortune_teller, "player-6")["actualCharacter"],
        "imp"
    );
    assert_eq!(player(&fortune_teller, "player-7")["alive"], false);
    assert_eq!(
        player(&fortune_teller, "player-7")["actualCharacter"],
        "imp"
    );
    assert_eq!(
        fortune_teller["value"]["phaseOverview"]
            .as_array()
            .expect("phase overview should be an array")
            .iter()
            .filter(|step| step["id"] == "night:imp")
            .count(),
        0,
        "the successor must not receive a second Imp action in the same night"
    );

    assert_target_result(&fortune_teller, ["player-1", "player-7"], true);
    assert_target_result(&fortune_teller, ["player-1", "player-6"], true);
    assert_target_result(&fortune_teller, ["player-1", "player-3"], false);
    let target_checks = fortune_teller["value"]["currentStep"]["informationPrompt"]["targetChecks"]
        .as_array()
        .expect("target checks should be an array");
    assert_eq!(target_checks.len(), 21);
    assert!(target_checks.iter().all(|check| {
        let ids = check["targetPlayerIds"]
            .as_array()
            .expect("target ids should be an array");
        ids.len() == 2 && ids[0] != ids[1]
    }));

    let duplicate = propose(
        &game,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "night:fortuneTeller",
                "input": { "playerIds": ["player-7", "player-7"] }
            }
        }),
    );
    assert_eq!(duplicate["ok"], false);
    assert_eq!(duplicate["error"]["code"], "INVALID_STEP_INPUT");

    for (target_player_ids, expected_names) in [
        (["player-1", "player-7"], ["One", "Former Imp"]),
        (["player-1", "player-6"], ["One", "Scarlet"]),
    ] {
        let check = propose(
            &game,
            json!({
                "type": "confirmStep",
                "payload": {
                    "stepId": "night:fortuneTeller",
                    "input": { "playerIds": target_player_ids }
                }
            }),
        );
        assert_eq!(check["ok"], true, "Fortune Teller check failed as {check}");
        assert_eq!(
            check["value"]["event"]["payload"]["information"],
            json!({
                "actor": { "playerId": "player-5", "characterId": "fortuneTeller" },
                "targetPlayerIds": target_player_ids,
                "computedResult": { "kind": "boolean", "value": true },
                "deliveredResult": { "kind": "boolean", "value": true },
                "deliveryContext": { "type": "fixed" }
            })
        );
        assert_eq!(
            check["value"]["revealPayload"],
            json!({
                "kind": "fortuneTellerInformation",
                "targetPlayers": [
                    { "playerId": target_player_ids[0], "seat": 1, "name": expected_names[0] },
                    {
                        "playerId": target_player_ids[1],
                        "seat": if target_player_ids[1] == "player-6" { 6 } else { 7 },
                        "name": expected_names[1]
                    }
                ],
                "hasDemon": true
            })
        );
    }
}

#[test]
fn fortune_teller_recluse_choices_keep_canonical_and_demon_registration_witnesses() {
    let game = fortune_teller_recluse_game("fortuneTeller", "fortuneTeller");
    let replayed = replay(&game);
    assert_eq!(replayed["ok"], true, "replay failed as {replayed}");
    assert_eq!(
        replayed["value"]["currentStep"]["id"],
        "firstNight:fortuneTeller"
    );

    let checks = replayed["value"]["currentStep"]["informationPrompt"]["targetChecks"]
        .as_array()
        .expect("target checks should be an array");

    // The real Imp makes this pair's computed result true. The Recluse
    // registration must still be independently selectable with the same
    // boolean result, distinguished by its witness.
    let with_imp = target_check(checks, &["player-2", "player-3"]);
    assert_eq!(
        with_imp["computedResult"],
        json!({ "kind": "boolean", "value": true })
    );
    assert!(with_imp["choices"].as_array().unwrap().contains(&json!({
        "result": { "kind": "boolean", "value": true },
        "isComputed": true,
        "registrationJudgments": []
    })));
    assert!(with_imp["choices"].as_array().unwrap().contains(&json!({
        "result": { "kind": "boolean", "value": true },
        "isComputed": false,
        "registrationJudgments": [{
            "playerId": "player-2",
            "registeredAs": "demon"
        }]
    })));

    // A registered Recluse result must survive confirmation even when its
    // boolean value is identical to the canonical result.
    let registered = propose(
        &game,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "firstNight:fortuneTeller",
                "input": { "playerIds": ["player-2", "player-3"] },
                "deliveredResult": { "kind": "boolean", "value": true },
                "registrationJudgments": [{
                    "playerId": "player-2",
                    "registeredAs": "demon"
                }]
            }
        }),
    );
    assert_eq!(
        registered["ok"], true,
        "registered choice failed as {registered}"
    );
    assert_eq!(
        registered["value"]["event"]["payload"]["information"]["deliveryContext"],
        json!({
            "type": "discretionary",
            "reasons": [{
                "type": "registrationJudgment",
                "judgments": [{
                    "playerId": "player-2",
                    "registeredAs": "demon"
                }]
            }]
        })
    );
    let confirmed = replay(&with_event(&game, registered["value"]["event"].clone()));
    assert_eq!(
        confirmed["ok"], true,
        "registered event failed to replay: {confirmed}"
    );

    // With no actual Demon or red herring in the pair, the canonical choice
    // remains false while the Recluse witness still offers true.
    let without_demon = target_check(checks, &["player-2", "player-4"]);
    assert_eq!(
        without_demon["computedResult"],
        json!({ "kind": "boolean", "value": false })
    );
    assert!(without_demon["choices"]
        .as_array()
        .unwrap()
        .contains(&json!({
            "result": { "kind": "boolean", "value": false },
            "isComputed": true,
            "registrationJudgments": []
        })));
    assert!(without_demon["choices"]
        .as_array()
        .unwrap()
        .contains(&json!({
            "result": { "kind": "boolean", "value": true },
            "isComputed": false,
            "registrationJudgments": [{
                "playerId": "player-2",
                "registeredAs": "demon"
            }]
        })));
}

#[test]
fn impaired_fortune_teller_choices_have_no_recluse_registration_witnesses() {
    let game = fortune_teller_recluse_game("drunk", "fortuneTeller");
    let replayed = replay(&game);
    assert_eq!(replayed["ok"], true, "replay failed as {replayed}");

    let checks = replayed["value"]["currentStep"]["informationPrompt"]["targetChecks"]
        .as_array()
        .expect("target checks should be an array");
    let check = target_check(checks, &["player-2", "player-3"]);
    assert_eq!(
        check["computedResult"],
        json!({ "kind": "boolean", "value": true })
    );
    let choices = check["choices"].as_array().unwrap();
    assert_eq!(choices.len(), 2);
    assert_eq!(
        choices
            .iter()
            .map(|choice| choice["result"]["value"].as_bool().unwrap())
            .collect::<std::collections::HashSet<_>>(),
        [false, true].into_iter().collect()
    );
    assert!(choices
        .iter()
        .all(|choice| choice["registrationJudgments"] == json!([])));
}

fn game_at_imp_step() -> Value {
    game_with_events(json!([
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "One", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
            { "id": "player-2", "seat": 2, "name": "Two", "actualCharacter": "librarian", "shownCharacter": "librarian" },
            { "id": "player-3", "seat": 3, "name": "Three", "actualCharacter": "chef", "shownCharacter": "chef" },
            { "id": "player-4", "seat": 4, "name": "Four", "actualCharacter": "soldier", "shownCharacter": "soldier" },
            { "id": "player-5", "seat": 5, "name": "Fortune", "actualCharacter": "fortuneTeller", "shownCharacter": "fortuneTeller" },
            { "id": "player-6", "seat": 6, "name": "Scarlet", "actualCharacter": "scarletWoman", "shownCharacter": "scarletWoman" },
            { "id": "player-7", "seat": 7, "name": "Former Imp", "actualCharacter": "imp", "shownCharacter": "imp" }
        ])),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event("phaseStepSkipped", "firstNight:washerwoman"),
        phase_event("phaseStepSkipped", "firstNight:librarian"),
        phase_event("phaseStepSkipped", "firstNight:chef"),
        {
            "id": "red-herring",
            "type": "redHerringAssigned",
            "phase": "firstNight",
            "payload": {
                "stepId": "firstNight:fortuneTellerRedHerring",
                "playerId": "player-2",
                "registrationJudgments": []
            },
            "summary": "red herring",
            "createdAt": "2026-01-01T00:00:00.000Z"
        },
        phase_event("phaseStepSkipped", "firstNight:fortuneTeller"),
        phase_event("phaseStepConfirmed", "firstNight:toDay"),
        phase_event("phaseStepConfirmed", "day:announceDeaths"),
        phase_event("phaseStepConfirmed", "day:whisper"),
        phase_event("phaseStepConfirmed", "day:discussion"),
        phase_event("phaseStepSkipped", "day:nomination:1"),
        no_execution_event("day:execution"),
        phase_event("phaseStepConfirmed", "day:toNight")
    ]))
}

fn replay(game: &Value) -> Value {
    serde_json::from_str(&replay_json(&game.to_string())).unwrap()
}

fn fortune_teller_recluse_game(actual_fortune: &str, shown_fortune: &str) -> Value {
    let mut events = vec![
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Fortune", "actualCharacter": actual_fortune, "shownCharacter": shown_fortune },
            { "id": "player-2", "seat": 2, "name": "Recluse", "actualCharacter": "recluse", "shownCharacter": "recluse" },
            { "id": "player-3", "seat": 3, "name": "Imp", "actualCharacter": "imp", "shownCharacter": "imp" },
            { "id": "player-4", "seat": 4, "name": "Chef", "actualCharacter": "chef", "shownCharacter": "chef" },
            { "id": "player-5", "seat": 5, "name": "Empath", "actualCharacter": "empath", "shownCharacter": "empath" }
        ])),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event("phaseStepConfirmed", "firstNight:chef"),
        phase_event("phaseStepConfirmed", "firstNight:empath"),
    ];
    if actual_fortune == "fortuneTeller" {
        events.push(json!({
            "id": "red-herring",
            "type": "redHerringAssigned",
            "phase": "firstNight",
            "payload": {
                "stepId": "firstNight:fortuneTellerRedHerring",
                "playerId": "player-5",
                "registrationJudgments": []
            },
            "summary": "red herring",
            "createdAt": "2026-01-01T00:00:00.000Z"
        }));
    }
    game_with_events(Value::Array(events))
}

fn target_check<'a>(checks: &'a [Value], target_player_ids: &[&str; 2]) -> &'a Value {
    checks
        .iter()
        .find(|check| check["targetPlayerIds"] == json!(target_player_ids))
        .expect("target check should exist")
}

fn propose(game: &Value, command: Value) -> Value {
    serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap()
}

fn with_event(game: &Value, event: Value) -> Value {
    let mut next = game.clone();
    next["game"]["events"]
        .as_array_mut()
        .expect("game events should be an array")
        .push(event);
    next
}

fn warning_codes(replayed: &Value) -> Vec<&str> {
    replayed["value"]["warnings"]
        .as_array()
        .expect("warnings should be an array")
        .iter()
        .filter_map(|warning| warning["code"].as_str())
        .collect()
}

fn player<'a>(replayed: &'a Value, player_id: &str) -> &'a Value {
    replayed["value"]["players"]
        .as_array()
        .expect("players should be an array")
        .iter()
        .find(|player| player["id"] == player_id)
        .expect("player should exist")
}

fn assert_target_result(replayed: &Value, target_player_ids: [&str; 2], expected: bool) {
    let check = replayed["value"]["currentStep"]["informationPrompt"]["targetChecks"]
        .as_array()
        .expect("target checks should be an array")
        .iter()
        .find(|check| check["targetPlayerIds"] == json!(target_player_ids))
        .expect("target check should exist");
    assert_eq!(
        check["computedResult"],
        json!({ "kind": "boolean", "value": expected })
    );
}

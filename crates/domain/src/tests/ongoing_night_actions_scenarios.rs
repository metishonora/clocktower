use super::support::*;
use crate::*;
use serde_json::{json, Value};

#[test]
fn poisoner_resolution_is_typed_and_poison_expires_on_the_following_to_night() {
    let game = game_with_events(json!([
        setup_event_with_minion(),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo")
    ]));
    let command = json!({
        "type": "confirmStep",
        "payload": {
            "stepId": "firstNight:poisoner",
            "input": { "playerIds": ["player-2"] }
        }
    });

    let before_resolution = replay_game(&game);
    assert_eq!(
        before_resolution["value"]["currentStep"]["id"], "firstNight:poisoner",
        "fixture did not reach Poisoner: {before_resolution}"
    );
    let proposal = propose(&game, command);
    assert_eq!(
        proposal["ok"], true,
        "Poisoner proposal failed as {proposal}"
    );
    assert_eq!(proposal["value"]["event"]["type"], "nightActionResolved");
    assert_eq!(
        proposal["value"]["event"]["summary"],
        "4번 Dev(독살범) → 2번 Bert(요리사) · 중독 적용"
    );
    assert_eq!(
        proposal["value"]["event"]["payload"],
        json!({
            "stepId": "firstNight:poisoner",
            "actorPlayerId": "player-4",
            "resolution": {
                "kind": "poison",
                "targetPlayerId": "player-2",
                "applied": true
            }
        })
    );

    let poison_event = proposal["value"]["event"].clone();
    let poison_event_id = poison_event["id"].as_str().unwrap().to_string();
    let mut first_night_events = game["game"]["events"].as_array().unwrap().clone();
    first_night_events.extend([
        poison_event,
        phase_event("phaseStepConfirmed", "firstNight:washerwoman"),
        phase_event("phaseStepConfirmed", "firstNight:chef"),
        phase_event("phaseStepConfirmed", "firstNight:empath"),
    ]);

    let during_first_night = replay(first_night_events.clone());
    assert_active_poison(
        &during_first_night,
        "player-4",
        "player-2",
        &poison_event_id,
    );

    first_night_events.push(phase_event("phaseStepConfirmed", "firstNight:toDay"));
    let during_following_day = replay(first_night_events.clone());
    assert_active_poison(
        &during_following_day,
        "player-4",
        "player-2",
        &poison_event_id,
    );

    first_night_events.extend([
        phase_event("phaseStepConfirmed", "day:announceDeaths"),
        phase_event("phaseStepConfirmed", "day:whisper"),
        phase_event("phaseStepConfirmed", "day:discussion"),
        phase_event("phaseStepSkipped", "day:nomination:1"),
        no_execution_event("day:execution"),
        phase_event("phaseStepConfirmed", "day:toNight"),
    ]);
    let after_to_night = replay(first_night_events);
    assert_eq!(
        after_to_night["ok"], true,
        "replay failed as {after_to_night}"
    );
    assert!(
        after_to_night["value"]["ruleState"]
            .get("activePoison")
            .is_none(),
        "poison survived the following toNight: {after_to_night}"
    );
}

#[test]
fn imp_attack_atomically_kills_a_living_ravenkeeper_and_inserts_its_follow_up() {
    let game = game_with_events(json!([
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Raven", "actualCharacter": "ravenkeeper", "shownCharacter": "ravenkeeper" },
            { "id": "player-2", "seat": 2, "name": "Chef", "actualCharacter": "chef", "shownCharacter": "chef" },
            { "id": "player-3", "seat": 3, "name": "Washer", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
            { "id": "player-4", "seat": 4, "name": "Empath", "actualCharacter": "empath", "shownCharacter": "empath" },
            { "id": "player-5", "seat": 5, "name": "Imp", "actualCharacter": "imp", "shownCharacter": "imp" }
        ])),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event("phaseStepConfirmed", "firstNight:washerwoman"),
        phase_event("phaseStepConfirmed", "firstNight:chef"),
        phase_event("phaseStepConfirmed", "firstNight:empath"),
        phase_event("phaseStepConfirmed", "firstNight:toDay"),
        phase_event("phaseStepConfirmed", "day:announceDeaths"),
        phase_event("phaseStepConfirmed", "day:whisper"),
        phase_event("phaseStepConfirmed", "day:discussion"),
        phase_event("phaseStepSkipped", "day:nomination:1"),
        no_execution_event("day:execution"),
        phase_event("phaseStepConfirmed", "day:toNight")
    ]));
    let command = json!({
        "type": "confirmStep",
        "payload": {
            "stepId": "night:imp",
            "input": { "playerIds": ["player-1"] }
        }
    });

    let before_attack = replay_game(&game);
    assert_eq!(
        before_attack["ok"], true,
        "replay failed as {before_attack}"
    );
    assert_eq!(
        before_attack["value"]["currentStep"]["id"], "night:imp",
        "fixture did not reach Imp: {before_attack}"
    );
    let proposal = propose(&game, command);
    assert_eq!(
        proposal["ok"], true,
        "Imp proposal failed from {before_attack} as {proposal}"
    );
    assert_eq!(proposal["value"]["event"]["type"], "nightActionResolved");
    assert_eq!(
        proposal["value"]["event"]["payload"],
        json!({
            "stepId": "night:imp",
            "actorPlayerId": "player-5",
            "resolution": {
                "kind": "impAttack",
                "targetPlayerId": "player-1",
                "mayorContext": { "kind": "notApplicable" },
                "outcome": { "kind": "death", "playerId": "player-1" }
            }
        })
    );

    let replayed = replay_with_proposed_event(&game, &proposal);
    assert_eq!(replayed["ok"], true, "replay failed as {replayed}");
    assert_eq!(replayed["value"]["players"][0]["alive"], false);
    assert_eq!(replayed["value"]["currentStep"]["id"], "night:ravenkeeper");
}

#[test]
fn fortune_teller_assigns_a_red_herring_before_its_first_typed_boolean_check() {
    let game = game_with_events(json!([
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Fortune", "actualCharacter": "fortuneTeller", "shownCharacter": "fortuneTeller" },
            { "id": "player-2", "seat": 2, "name": "Chef", "actualCharacter": "chef", "shownCharacter": "chef" },
            { "id": "player-3", "seat": 3, "name": "Empath", "actualCharacter": "empath", "shownCharacter": "empath" },
            { "id": "player-4", "seat": 4, "name": "Washer", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
            { "id": "player-5", "seat": 5, "name": "Imp", "actualCharacter": "imp", "shownCharacter": "imp" }
        ])),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event("phaseStepConfirmed", "firstNight:washerwoman"),
        phase_event("phaseStepConfirmed", "firstNight:chef"),
        phase_event("phaseStepConfirmed", "firstNight:empath")
    ]));

    let before_assignment = replay_game(&game);
    assert_eq!(
        before_assignment["ok"], true,
        "replay failed as {before_assignment}"
    );
    assert_eq!(
        before_assignment["value"]["currentStep"]["id"],
        "firstNight:fortuneTellerRedHerring"
    );

    let assign = propose(
        &game,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "firstNight:fortuneTellerRedHerring",
                "input": { "playerIds": ["player-2"] }
            }
        }),
    );
    assert_eq!(assign["ok"], true, "assignment failed as {assign}");
    assert_eq!(assign["value"]["event"]["type"], "redHerringAssigned");
    assert_eq!(
        assign["value"]["event"]["summary"],
        "1번 Fortune(점쟁이)가 2번 Chef(요리사)를 레드 헤링으로 지정했습니다."
    );
    assert_eq!(
        assign["value"]["event"]["payload"],
        json!({
            "stepId": "firstNight:fortuneTellerRedHerring",
            "playerId": "player-2",
            "registrationJudgments": []
        })
    );

    let assigned_game = with_proposed_event(&game, &assign);
    let after_assignment = replay_game(&assigned_game);
    assert_eq!(
        after_assignment["ok"], true,
        "replay failed as {after_assignment}"
    );
    assert_eq!(
        after_assignment["value"]["currentStep"]["id"],
        "firstNight:fortuneTeller"
    );
    assert_eq!(
        after_assignment["value"]["ruleState"]["redHerringPlayerId"],
        "player-2"
    );

    let check = propose(
        &assigned_game,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "firstNight:fortuneTeller",
                "input": { "playerIds": ["player-2", "player-3"] }
            }
        }),
    );
    assert_eq!(check["ok"], true, "Fortune Teller check failed as {check}");
    assert_eq!(
        check["value"]["event"]["summary"],
        "1번 Fortune(점쟁이)가 2번 Chef(요리사), 3번 Empath(초공감자)를 확인: 악마 있음"
    );
    assert_eq!(
        check["value"]["event"]["payload"]["information"],
        json!({
            "actor": { "playerId": "player-1", "characterId": "fortuneTeller" },
            "targetPlayerIds": ["player-2", "player-3"],
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
                { "playerId": "player-2", "seat": 2, "name": "Chef" },
                { "playerId": "player-3", "seat": 3, "name": "Empath" }
            ],
            "hasDemon": true
        })
    );
}

#[test]
fn drunk_shown_fortune_teller_reveals_only_targets_and_delivered_result() {
    let game = game_with_events(json!([
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Fortune", "actualCharacter": "drunk", "shownCharacter": "fortuneTeller" },
            { "id": "player-2", "seat": 2, "name": "Chef", "actualCharacter": "chef", "shownCharacter": "chef" },
            { "id": "player-3", "seat": 3, "name": "Empath", "actualCharacter": "empath", "shownCharacter": "empath" },
            { "id": "player-4", "seat": 4, "name": "Poisoner", "actualCharacter": "poisoner", "shownCharacter": "poisoner" },
            { "id": "player-5", "seat": 5, "name": "Imp", "actualCharacter": "imp", "shownCharacter": "imp" }
        ])),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event("phaseStepSkipped", "firstNight:poisoner"),
        phase_event("phaseStepConfirmed", "firstNight:chef"),
        phase_event("phaseStepConfirmed", "firstNight:empath")
    ]));

    let replayed = replay_game(&game);
    assert_eq!(replayed["ok"], true, "replay failed as {replayed}");
    assert_eq!(
        replayed["value"]["currentStep"]["id"],
        "firstNight:fortuneTeller"
    );

    let proposal = propose(
        &game,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "firstNight:fortuneTeller",
                "input": { "playerIds": ["player-2", "player-5"] },
                "deliveredResult": { "kind": "boolean", "value": false }
            }
        }),
    );

    assert_eq!(proposal["ok"], true, "proposal failed as {proposal}");
    assert_eq!(
        proposal["value"]["event"]["payload"]["information"]["deliveryContext"],
        json!({ "type": "discretionary", "reasons": [{ "type": "drunk" }] })
    );
    assert_eq!(
        proposal["value"]["revealPayload"],
        json!({
            "kind": "fortuneTellerInformation",
            "targetPlayers": [
                { "playerId": "player-2", "seat": 2, "name": "Chef" },
                { "playerId": "player-5", "seat": 5, "name": "Imp" }
            ],
            "hasDemon": false
        })
    );
    let reveal = proposal["value"]["revealPayload"].to_string();
    assert!(!reveal.contains("drunk"));
    assert!(!reveal.contains("actualCharacter"));
    assert!(!reveal.contains("computedResult"));
    assert!(!reveal.contains("deliveryContext"));
}

#[test]
fn undertaker_is_generated_only_for_a_matching_executed_death_and_reports_character() {
    let no_execution = undertaker_day_events();
    let mut no_execution_events = no_execution.clone();
    no_execution_events.extend([
        phase_event("phaseStepSkipped", "day:nomination:1"),
        no_execution_event("day:execution"),
        phase_event("phaseStepConfirmed", "day:toNight"),
    ]);
    let without_execution = replay(no_execution_events);
    assert_eq!(
        without_execution["ok"], true,
        "replay failed as {without_execution}"
    );
    assert!(
        !overview_has_step(&without_execution, "night:undertaker"),
        "Undertaker was generated without an execution death: {without_execution}"
    );

    let mut executed_events = no_execution;
    executed_events.extend([
        nomination_vote_event(
            "day:nomination:1",
            "player-1",
            "player-2",
            ["player-1", "player-2", "player-3"],
        ),
        phase_event("phaseStepSkipped", "day:nomination:2"),
        execution_event("player-2"),
        execution_death_event("player-2"),
        phase_event("phaseStepConfirmed", "day:toNight"),
        phase_event("phaseStepSkipped", "night:imp"),
    ]);
    let after_imp_game = game_with_events(Value::Array(executed_events.clone()));
    let after_imp = replay_game(&after_imp_game);
    assert_eq!(after_imp["ok"], true, "replay failed as {after_imp}");
    assert_eq!(after_imp["value"]["currentStep"]["id"], "night:empath");
    let empath = propose(
        &after_imp_game,
        json!({
            "type": "confirmStep",
            "payload": { "stepId": "night:empath" }
        }),
    );
    assert_eq!(empath["ok"], true, "Empath proposal failed as {empath}");
    executed_events.push(empath["value"]["event"].clone());
    let executed_game = game_with_events(Value::Array(executed_events));
    let with_execution = replay_game(&executed_game);
    assert_eq!(
        with_execution["ok"], true,
        "replay failed as {with_execution}"
    );
    assert_eq!(
        with_execution["value"]["currentStep"]["id"],
        "night:undertaker"
    );
    assert_eq!(
        with_execution["value"]["currentStep"]["informationPrompt"]["targetChecks"],
        json!([{
            "targetPlayerIds": ["player-2"],
            "computedResult": { "kind": "character", "characterId": "chef" },
            "choices": [{
                "result": { "kind": "character", "characterId": "chef" },
                "isComputed": true,
                "registrationJudgments": []
            }]
        }])
    );

    let proposal = propose(
        &executed_game,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "night:undertaker"
            }
        }),
    );
    assert_eq!(
        proposal["ok"], true,
        "Undertaker proposal failed as {proposal}"
    );
    assert_eq!(
        proposal["value"]["event"]["summary"],
        "1번 Undertaker(장의사)가 2번 Chef(요리사)를 확인 · 처형된 플레이어의 캐릭터: 요리사"
    );
    assert_eq!(
        proposal["value"]["event"]["payload"]["information"],
        json!({
            "actor": { "playerId": "player-1", "characterId": "undertaker" },
            "targetPlayerIds": ["player-2"],
            "computedResult": { "kind": "character", "characterId": "chef" },
            "deliveredResult": { "kind": "character", "characterId": "chef" },
            "deliveryContext": { "type": "fixed" }
        })
    );
    assert_eq!(
        proposal["value"]["revealPayload"],
        json!({
            "kind": "characterInformation",
            "characterId": "undertaker",
            "targetPlayer": { "playerId": "player-2", "seat": 2, "name": "Chef" },
            "revealedCharacterId": "chef"
        })
    );
}

fn propose(game: &Value, command: Value) -> Value {
    serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap()
}

fn replay(events: Vec<Value>) -> Value {
    replay_game(&game_with_events(Value::Array(events)))
}

fn replay_game(game: &Value) -> Value {
    serde_json::from_str(&replay_json(&game.to_string())).unwrap()
}

fn with_proposed_event(game: &Value, proposal: &Value) -> Value {
    let mut events = game["game"]["events"].as_array().unwrap().clone();
    events.push(proposal["value"]["event"].clone());
    game_with_events(Value::Array(events))
}

fn replay_with_proposed_event(game: &Value, proposal: &Value) -> Value {
    replay_game(&with_proposed_event(game, proposal))
}

fn assert_active_poison(
    replayed: &Value,
    source_player_id: &str,
    target_player_id: &str,
    source_event_id: &str,
) {
    assert_eq!(replayed["ok"], true, "replay failed as {replayed}");
    assert_eq!(
        replayed["value"]["ruleState"]["activePoison"],
        json!({
            "playerId": target_player_id,
            "sourcePlayerId": source_player_id,
            "sourceEventId": source_event_id
        })
    );
}

fn overview_has_step(replayed: &Value, step_id: &str) -> bool {
    replayed["value"]["phaseOverview"]
        .as_array()
        .unwrap()
        .iter()
        .any(|step| step["id"] == step_id)
}

fn undertaker_day_events() -> Vec<Value> {
    vec![
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Undertaker", "actualCharacter": "undertaker", "shownCharacter": "undertaker" },
            { "id": "player-2", "seat": 2, "name": "Chef", "actualCharacter": "chef", "shownCharacter": "chef" },
            { "id": "player-3", "seat": 3, "name": "Empath", "actualCharacter": "empath", "shownCharacter": "empath" },
            { "id": "player-4", "seat": 4, "name": "Washer", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
            { "id": "player-5", "seat": 5, "name": "Imp", "actualCharacter": "imp", "shownCharacter": "imp" }
        ])),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event("phaseStepConfirmed", "firstNight:washerwoman"),
        phase_event("phaseStepConfirmed", "firstNight:chef"),
        phase_event("phaseStepConfirmed", "firstNight:empath"),
        phase_event("phaseStepConfirmed", "firstNight:toDay"),
        phase_event("phaseStepConfirmed", "day:announceDeaths"),
        phase_event("phaseStepConfirmed", "day:whisper"),
        phase_event("phaseStepConfirmed", "day:discussion"),
    ]
}

fn execution_event(player_id: &str) -> Value {
    json!({
        "id": "evt-day-execution",
        "type": "executionConfirmed",
        "phase": "day",
        "payload": {
            "stepId": "day:execution",
            "input": { "execute": true, "playerId": player_id }
        },
        "summary": "처형 확정",
        "createdAt": "2026-01-01T00:00:00.000Z"
    })
}

fn execution_death_event(player_id: &str) -> Value {
    json!({
        "id": "evt-day-execution-death",
        "type": "deathConfirmed",
        "phase": "day",
        "payload": { "stepId": "day:executionDeath", "playerId": player_id },
        "summary": "처형 사망 확정",
        "createdAt": "2026-01-01T00:00:00.000Z"
    })
}

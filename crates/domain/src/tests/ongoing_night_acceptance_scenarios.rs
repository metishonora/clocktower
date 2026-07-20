use super::support::*;
use crate::*;
use serde_json::{json, Value};

#[test]
fn poison_from_the_prior_night_is_not_a_delivery_reason_after_to_night() {
    let events = vec![
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Empath", "actualCharacter": "empath", "shownCharacter": "empath" },
            { "id": "player-2", "seat": 2, "name": "Chef", "actualCharacter": "chef", "shownCharacter": "chef" },
            { "id": "player-3", "seat": 3, "name": "Washer", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
            { "id": "player-4", "seat": 4, "name": "Poisoner", "actualCharacter": "poisoner", "shownCharacter": "poisoner" },
            { "id": "player-5", "seat": 5, "name": "Imp", "actualCharacter": "imp", "shownCharacter": "imp" }
        ])),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        poison_event("firstNight:poisoner", "player-4", "player-1"),
        phase_event("phaseStepConfirmed", "firstNight:washerwoman"),
        phase_event("phaseStepConfirmed", "firstNight:chef"),
        phase_event("phaseStepConfirmed", "firstNight:empath"),
        phase_event("phaseStepConfirmed", "firstNight:toDay"),
        phase_event("phaseStepConfirmed", "day:announceDeaths"),
        phase_event("phaseStepConfirmed", "day:whisper"),
        phase_event("phaseStepConfirmed", "day:discussion"),
        phase_event("phaseStepSkipped", "day:nomination:1"),
        no_execution_event("day:execution"),
        phase_event("phaseStepConfirmed", "day:toNight"),
        phase_event("phaseStepSkipped", "night:poisoner"),
        phase_event("phaseStepSkipped", "night:imp"),
    ];

    let replayed = replay(events);
    assert_eq!(replayed["ok"], true, "replay failed as {replayed}");
    assert_eq!(replayed["value"]["currentStep"]["id"], "night:empath");
    assert!(
        replayed["value"]["currentStep"]["informationPrompt"]["activeReasons"]
            .as_array()
            .unwrap()
            .iter()
            .all(|reason| reason["type"] != "poisoned"),
        "expired poison remained an active DeliveryReason: {replayed}"
    );
    assert!(
        replayed["value"]["ruleState"].get("activePoison").is_none(),
        "expired poison remained in ruleState: {replayed}"
    );
}

#[test]
fn ravenkeeper_target_checks_expose_exact_spy_and_recluse_registration_witnesses() {
    let events = ravenkeeper_check_events();
    let game = game_with_events(Value::Array(events));
    let replayed = replay_game(&game);
    assert_eq!(replayed["ok"], true, "replay failed as {replayed}");
    assert_eq!(replayed["value"]["currentStep"]["id"], "night:ravenkeeper");

    let checks = replayed["value"]["currentStep"]["informationPrompt"]["targetChecks"]
        .as_array()
        .unwrap();
    let spy_check = target_check(checks, "player-2");
    assert!(
        spy_check["choices"].as_array().unwrap().contains(&json!({
            "result": { "kind": "character", "characterId": "chef" },
            "isComputed": false,
            "registrationJudgments": [{
                "playerId": "player-2",
                "registeredAs": "townsfolk",
                "characterId": "chef"
            }]
        })),
        "Spy Townsfolk registration was absent: {spy_check}"
    );
    let recluse_check = target_check(checks, "player-3");
    assert!(
        recluse_check["choices"]
            .as_array()
            .unwrap()
            .contains(&json!({
                "result": { "kind": "character", "characterId": "imp" },
                "isComputed": false,
                "registrationJudgments": [{
                    "playerId": "player-3",
                    "registeredAs": "demon",
                    "characterId": "imp"
                }]
            })),
        "Recluse Demon registration was absent: {recluse_check}"
    );

    let forged = propose(
        &game,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "night:ravenkeeper",
                "input": { "playerIds": ["player-2"] },
                "deliveredResult": { "kind": "character", "characterId": "chef" },
                "registrationJudgments": [{
                    "playerId": "player-2",
                    "registeredAs": "townsfolk",
                    "characterId": "undertaker"
                }]
            }
        }),
    );
    assert_eq!(forged["ok"], false, "forged witness succeeded as {forged}");
    assert_eq!(forged["error"]["code"], "INVALID_REGISTRATION_JUDGMENT");

    let valid = propose(
        &game,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "night:ravenkeeper",
                "input": { "playerIds": ["player-2"] },
                "deliveredResult": { "kind": "character", "characterId": "chef" },
                "registrationJudgments": [{
                    "playerId": "player-2",
                    "registeredAs": "townsfolk",
                    "characterId": "chef"
                }]
            }
        }),
    );
    assert_eq!(valid["ok"], true, "valid witness failed as {valid}");
    assert_eq!(
        valid["value"]["event"]["summary"],
        "1번 Raven(까마귀지기)가 2번 Spy(첩자)를 확인 · 대상의 캐릭터: 요리사 (실제 첩자 · 등록 판정)"
    );
    assert_eq!(
        valid["value"]["revealPayload"],
        json!({
            "kind": "characterInformation",
            "characterId": "ravenkeeper",
            "targetPlayer": { "playerId": "player-2", "seat": 2, "name": "Spy" },
            "revealedCharacterId": "chef"
        })
    );
}

#[test]
fn undertaker_target_check_exposes_exact_spy_registration_witness() {
    let events = undertaker_spy_events();
    let game = game_with_events(Value::Array(events));
    let replayed = replay_game(&game);
    assert_eq!(replayed["ok"], true, "replay failed as {replayed}");
    assert_eq!(replayed["value"]["currentStep"]["id"], "night:undertaker");
    let checks = replayed["value"]["currentStep"]["informationPrompt"]["targetChecks"]
        .as_array()
        .unwrap();
    let spy_check = target_check(checks, "player-2");
    assert!(
        spy_check["choices"].as_array().unwrap().contains(&json!({
            "result": { "kind": "character", "characterId": "chef" },
            "isComputed": false,
            "registrationJudgments": [{
                "playerId": "player-2",
                "registeredAs": "townsfolk",
                "characterId": "chef"
            }]
        })),
        "Undertaker lacked the Spy registration alternative: {spy_check}"
    );
}

#[test]
fn target_checks_with_registration_alternatives_are_selectable() {
    let game = game_with_events(Value::Array(undertaker_spy_events()));
    let replayed = replay_game(&game);
    assert_eq!(replayed["ok"], true, "replay failed as {replayed}");
    assert_eq!(
        replayed["value"]["currentStep"]["informationPrompt"]["deliveryMode"],
        "selectable"
    );
}

#[test]
fn announcing_night_deaths_clears_exactly_the_replayed_unannounced_ids() {
    let game = game_with_events(Value::Array(announce_death_events()));
    let before = replay_game(&game);
    assert_eq!(before["ok"], true, "replay failed as {before}");
    assert_eq!(before["value"]["currentStep"]["id"], "day2:announceDeaths");
    assert_eq!(
        before["value"]["ruleState"]["unannouncedNightDeathPlayerIds"],
        json!(["player-1"])
    );

    let proposal = propose(
        &game,
        json!({
            "type": "confirmStep",
            "payload": { "stepId": "day2:announceDeaths" }
        }),
    );
    assert_eq!(proposal["ok"], true, "proposal failed as {proposal}");
    assert_eq!(proposal["value"]["event"]["type"], "nightDeathsAnnounced");
    assert_eq!(
        proposal["value"]["event"]["summary"],
        "밤 사망 발표: 1번 Raven(까마귀지기)"
    );
    assert_eq!(
        proposal["value"]["event"]["payload"],
        json!({ "stepId": "day2:announceDeaths", "playerIds": ["player-1"] })
    );

    let confirmed = replay_with_event(&game, proposal["value"]["event"].clone());
    assert_eq!(confirmed["ok"], true, "replay failed as {confirmed}");
    assert_eq!(
        confirmed["value"]["ruleState"]["unannouncedNightDeathPlayerIds"],
        json!([])
    );
}

#[test]
fn confirming_no_night_deaths_emits_the_empty_canonical_event_without_changing_players() {
    let game = game_with_events(Value::Array(empty_announce_death_events()));
    let before = replay_game(&game);
    assert_eq!(before["ok"], true, "replay failed as {before}");
    assert_eq!(before["value"]["currentStep"]["id"], "day2:announceDeaths");
    assert_eq!(
        before["value"]["ruleState"]["unannouncedNightDeathPlayerIds"],
        json!([])
    );
    let players_before = before["value"]["players"].clone();

    let proposal = propose(
        &game,
        json!({
            "type": "confirmStep",
            "payload": { "stepId": "day2:announceDeaths" }
        }),
    );
    assert_eq!(proposal["ok"], true, "proposal failed as {proposal}");
    assert_eq!(proposal["value"]["event"]["type"], "nightDeathsAnnounced");
    assert_eq!(
        proposal["value"]["event"]["payload"],
        json!({ "stepId": "day2:announceDeaths", "playerIds": [] })
    );
    assert_eq!(proposal["value"]["event"]["summary"], "밤 사망 발표: 없음");

    let confirmed = replay_with_event(&game, proposal["value"]["event"].clone());
    assert_eq!(confirmed["ok"], true, "replay failed as {confirmed}");
    assert_eq!(confirmed["value"]["currentStep"]["id"], "day2:whisper");
    assert_eq!(confirmed["value"]["players"], players_before);
}

#[test]
fn replay_rejects_night_death_announcements_that_do_not_match_unannounced_ids() {
    let game = game_with_events(Value::Array(announce_death_events()));
    for player_ids in [
        json!([]),
        json!(["player-2"]),
        json!(["player-1", "player-2"]),
    ] {
        let forged = night_deaths_announced_event(player_ids);
        let replayed = replay_with_event(&game, forged);
        assert_eq!(
            replayed["ok"], false,
            "mismatched announcement replayed as {replayed}"
        );
        assert_eq!(replayed["error"]["code"], "REPLAY_FAILED");
        assert!(replayed.get("value").is_none());
    }
}

#[test]
fn imp_death_has_operational_summary_and_ravenkeeper_follow_up_hint() {
    let mut events = ravenkeeper_check_events();
    events.pop();
    let game = game_with_events(Value::Array(events));
    let proposal = propose_imp_attack(&game, "player-1");

    assert_eq!(proposal["ok"], true, "proposal failed as {proposal}");
    assert_eq!(
        proposal["value"]["event"]["payload"]["resolution"]["outcome"],
        json!({ "kind": "death", "playerId": "player-1" })
    );
    assert_eq!(
        proposal["value"]["event"]["summary"],
        "5번 Imp(임프) → 1번 Raven(까마귀지기) 공격 · 사망"
    );
    assert_eq!(proposal["value"]["warnings"], json!([]));
    assert_eq!(
        proposal["value"]["followUpSteps"],
        json!([{
            "kind": "ravenkeeperReveal",
            "stepId": "night:ravenkeeper",
            "playerId": "player-1"
        }])
    );
}

#[test]
fn monk_prevented_imp_attack_has_stable_warning_and_operational_summary() {
    let game = game_with_events(Value::Array(imp_ready_with_monk_protection()));
    let proposal = propose_imp_attack(&game, "player-1");

    assert_eq!(proposal["ok"], true, "proposal failed as {proposal}");
    assert_eq!(
        proposal["value"]["event"]["payload"]["resolution"]["outcome"],
        json!({
            "kind": "prevented",
            "reason": "monkProtection",
            "sourceEventId": "evt-night:monk"
        })
    );
    assert_warning_code(&proposal, "DEMON_ATTACK_PREVENTED");
    assert_eq!(
        proposal["value"]["event"]["summary"],
        "5번 Imp(임프) → 1번 Target(군인) 공격 · 사망 없음 (수도사 보호)"
    );
}

#[test]
fn already_dead_imp_target_has_stable_warning_and_operational_summary() {
    let game = game_with_events(Value::Array(imp_ready_with_dead_target()));
    let proposal = propose_imp_attack(&game, "player-1");

    assert_eq!(proposal["ok"], true, "proposal failed as {proposal}");
    assert_eq!(
        proposal["value"]["event"]["payload"]["resolution"]["outcome"],
        json!({ "kind": "noDeath", "reason": "alreadyDead" })
    );
    assert_warning_code(&proposal, "DEMON_ATTACK_TARGET_ALREADY_DEAD");
    assert_eq!(
        proposal["value"]["event"]["summary"],
        "5번 Imp(임프) → 1번 Target(군인) 공격 · 사망 없음 (이미 사망)"
    );
}

#[test]
fn poisoned_imp_has_no_effect_warning_and_operational_summary() {
    let game = game_with_events(Value::Array(imp_ready_while_poisoned()));
    let proposal = propose_imp_attack(&game, "player-1");

    assert_eq!(proposal["ok"], true, "proposal failed as {proposal}");
    assert_eq!(
        proposal["value"]["event"]["payload"]["resolution"]["outcome"],
        json!({ "kind": "noDeath", "reason": "actorImpaired" })
    );
    assert_warning_code(&proposal, "NIGHT_ACTION_NO_EFFECT");
    assert_eq!(
        proposal["value"]["event"]["summary"],
        "5번 Imp(임프) → 1번 Target(군인) 공격 · 사망 없음 (행동자 중독)"
    );
}

#[test]
fn poisoned_imp_targeting_mayor_does_not_require_an_inapplicable_mayor_decision() {
    let game = game_with_events(Value::Array(imp_ready_while_poisoned_targeting("mayor")));
    let current = replay_game(&game);

    assert_eq!(current["ok"], true, "replay failed as {current}");
    assert_eq!(current["value"]["currentStep"]["id"], "night:imp");
    assert!(
        current["value"]["currentStep"]["requiredInput"]["mayorDecision"].is_null(),
        "impaired Imp exposed an inapplicable Mayor decision: {current}"
    );

    let proposal = propose_imp_attack(&game, "player-1");
    assert_eq!(proposal["ok"], true, "proposal failed as {proposal}");
    assert_eq!(
        proposal["value"]["event"]["payload"]["resolution"],
        json!({
            "kind": "impAttack",
            "targetPlayerId": "player-1",
            "mayorContext": { "kind": "notApplicable" },
            "outcome": { "kind": "noDeath", "reason": "actorImpaired" }
        })
    );
    assert_warning_code(&proposal, "NIGHT_ACTION_NO_EFFECT");

    let unnecessary_decision = propose(
        &game,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "night:imp",
                "input": {
                    "playerIds": ["player-1"],
                    "mayorDecision": { "kind": "mayorDies" }
                }
            }
        }),
    );
    assert_eq!(unnecessary_decision["ok"], false);
    assert_eq!(
        unnecessary_decision["error"]["code"],
        "INVALID_MAYOR_DECISION"
    );

    let original_event_count = game["game"]["events"].as_array().unwrap().len();
    let replayed = replay_with_event(&game, proposal["value"]["event"].clone());
    assert_eq!(
        replayed["ok"], true,
        "confirmed event failed replay as {replayed}"
    );
    assert_eq!(replayed["value"]["eventCount"], original_event_count + 1);
    assert_eq!(replayed["value"]["currentStep"]["id"], "night:empath");
    assert_eq!(replayed["value"]["players"][0]["alive"], true);
}

fn propose(game: &Value, command: Value) -> Value {
    serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap()
}

fn propose_imp_attack(game: &Value, target_player_id: &str) -> Value {
    propose(
        game,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "night:imp",
                "input": { "playerIds": [target_player_id] }
            }
        }),
    )
}

fn assert_warning_code(proposal: &Value, expected_code: &str) {
    assert!(
        proposal["value"]["warnings"]
            .as_array()
            .unwrap()
            .iter()
            .any(|warning| warning["code"] == expected_code),
        "missing warning {expected_code}: {proposal}"
    );
}

fn replay(events: Vec<Value>) -> Value {
    replay_game(&game_with_events(Value::Array(events)))
}

fn replay_game(game: &Value) -> Value {
    serde_json::from_str(&replay_json(&game.to_string())).unwrap()
}

fn replay_with_event(game: &Value, event: Value) -> Value {
    let mut events = game["game"]["events"].as_array().unwrap().clone();
    events.push(event);
    replay(events)
}

fn target_check<'a>(checks: &'a [Value], player_id: &str) -> &'a Value {
    checks
        .iter()
        .find(|check| check["targetPlayerIds"] == json!([player_id]))
        .unwrap_or_else(|| panic!("missing target check for {player_id}: {checks:#?}"))
}

fn poison_event(step_id: &str, actor_player_id: &str, target_player_id: &str) -> Value {
    json!({
        "id": format!("evt-{step_id}"),
        "type": "nightActionResolved",
        "phase": step_id.split(':').next().unwrap(),
        "payload": {
            "stepId": step_id,
            "actorPlayerId": actor_player_id,
            "resolution": {
                "kind": "poison",
                "targetPlayerId": target_player_id,
                "applied": true
            }
        },
        "summary": "독 지정 확정",
        "createdAt": "2026-01-01T00:00:00.000Z"
    })
}

fn imp_death_event(step_id: &str, actor_player_id: &str, target_player_id: &str) -> Value {
    json!({
        "id": format!("evt-{step_id}"),
        "type": "nightActionResolved",
        "phase": step_id.split(':').next().unwrap(),
        "payload": {
            "stepId": step_id,
            "actorPlayerId": actor_player_id,
            "resolution": {
                "kind": "impAttack",
                "targetPlayerId": target_player_id,
                "outcome": { "kind": "death", "playerId": target_player_id }
            }
        },
        "summary": "임프 공격 사망 확정",
        "createdAt": "2026-01-01T00:00:00.000Z"
    })
}

fn imp_ready_base(players: Value) -> Vec<Value> {
    vec![
        setup_event_with_players(players),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event("phaseStepConfirmed", "firstNight:chef"),
        phase_event("phaseStepConfirmed", "firstNight:empath"),
        phase_event("phaseStepConfirmed", "firstNight:toDay"),
        phase_event("phaseStepConfirmed", "day:announceDeaths"),
        phase_event("phaseStepConfirmed", "day:whisper"),
        phase_event("phaseStepConfirmed", "day:discussion"),
        phase_event("phaseStepSkipped", "day:nomination:1"),
        no_execution_event("day:execution"),
        phase_event("phaseStepConfirmed", "day:toNight"),
    ]
}

fn standard_imp_players(fourth_player: Value) -> Value {
    json!([
        { "id": "player-1", "seat": 1, "name": "Target", "actualCharacter": "soldier", "shownCharacter": "soldier" },
        { "id": "player-2", "seat": 2, "name": "Chef", "actualCharacter": "chef", "shownCharacter": "chef" },
        { "id": "player-3", "seat": 3, "name": "Empath", "actualCharacter": "empath", "shownCharacter": "empath" },
        fourth_player,
        { "id": "player-5", "seat": 5, "name": "Imp", "actualCharacter": "imp", "shownCharacter": "imp" }
    ])
}

fn imp_ready_with_monk_protection() -> Vec<Value> {
    let mut events = imp_ready_base(standard_imp_players(json!({
        "id": "player-4", "seat": 4, "name": "Monk",
        "actualCharacter": "monk", "shownCharacter": "monk"
    })));
    events.push(json!({
        "id": "evt-night:monk",
        "type": "nightActionResolved",
        "phase": "night",
        "payload": {
            "stepId": "night:monk",
            "actorPlayerId": "player-4",
            "resolution": {
                "kind": "monkProtection",
                "targetPlayerId": "player-1",
                "applied": true
            }
        },
        "summary": "수도승 보호 확정",
        "createdAt": "2026-01-01T00:00:00.000Z"
    }));
    events
}

fn imp_ready_with_dead_target() -> Vec<Value> {
    let mut events = imp_ready_base(standard_imp_players(json!({
        "id": "player-4", "seat": 4, "name": "Saint",
        "actualCharacter": "saint", "shownCharacter": "saint"
    })));
    events.insert(1, death_event("player-1"));
    events
}

fn imp_ready_while_poisoned() -> Vec<Value> {
    imp_ready_while_poisoned_targeting("soldier")
}

fn imp_ready_while_poisoned_targeting(target_character: &str) -> Vec<Value> {
    let players = standard_imp_players(json!({
        "id": "player-4", "seat": 4, "name": "Poisoner",
        "actualCharacter": "poisoner", "shownCharacter": "poisoner"
    }));
    let mut players = players.as_array().unwrap().clone();
    players[0]["actualCharacter"] = json!(target_character);
    players[0]["shownCharacter"] = json!(target_character);
    let mut events = vec![
        setup_event_with_players(Value::Array(players)),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event("phaseStepSkipped", "firstNight:poisoner"),
        phase_event("phaseStepConfirmed", "firstNight:chef"),
        phase_event("phaseStepConfirmed", "firstNight:empath"),
        phase_event("phaseStepConfirmed", "firstNight:toDay"),
        phase_event("phaseStepConfirmed", "day:announceDeaths"),
        phase_event("phaseStepConfirmed", "day:whisper"),
        phase_event("phaseStepConfirmed", "day:discussion"),
        phase_event("phaseStepSkipped", "day:nomination:1"),
        no_execution_event("day:execution"),
        phase_event("phaseStepConfirmed", "day:toNight"),
    ];
    events.push(poison_event("night:poisoner", "player-4", "player-5"));
    events
}

fn ravenkeeper_check_events() -> Vec<Value> {
    let mut events = vec![
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Raven", "actualCharacter": "ravenkeeper", "shownCharacter": "ravenkeeper" },
            { "id": "player-2", "seat": 2, "name": "Spy", "actualCharacter": "spy", "shownCharacter": "spy" },
            { "id": "player-3", "seat": 3, "name": "Recluse", "actualCharacter": "recluse", "shownCharacter": "recluse" },
            { "id": "player-4", "seat": 4, "name": "Soldier", "actualCharacter": "soldier", "shownCharacter": "soldier" },
            { "id": "player-5", "seat": 5, "name": "Imp", "actualCharacter": "imp", "shownCharacter": "imp" }
        ])),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
    ];
    events.push(confirm_current_step(&events, "firstNight:spy"));
    events.extend([
        phase_event("phaseStepConfirmed", "firstNight:toDay"),
        phase_event("phaseStepConfirmed", "day:announceDeaths"),
        phase_event("phaseStepConfirmed", "day:whisper"),
        phase_event("phaseStepConfirmed", "day:discussion"),
        phase_event("phaseStepSkipped", "day:nomination:1"),
        no_execution_event("day:execution"),
        phase_event("phaseStepConfirmed", "day:toNight"),
    ]);
    events.push(imp_death_event("night:imp", "player-5", "player-1"));
    events
}

fn undertaker_spy_events() -> Vec<Value> {
    let mut events = vec![
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Undertaker", "actualCharacter": "undertaker", "shownCharacter": "undertaker" },
            { "id": "player-2", "seat": 2, "name": "Spy", "actualCharacter": "spy", "shownCharacter": "spy" },
            { "id": "player-3", "seat": 3, "name": "Soldier", "actualCharacter": "soldier", "shownCharacter": "soldier" },
            { "id": "player-4", "seat": 4, "name": "Saint", "actualCharacter": "saint", "shownCharacter": "saint" },
            { "id": "player-5", "seat": 5, "name": "Imp", "actualCharacter": "imp", "shownCharacter": "imp" }
        ])),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
    ];
    events.push(confirm_current_step(&events, "firstNight:spy"));
    events.extend([
        phase_event("phaseStepConfirmed", "firstNight:toDay"),
        phase_event("phaseStepConfirmed", "day:announceDeaths"),
        phase_event("phaseStepConfirmed", "day:whisper"),
        phase_event("phaseStepConfirmed", "day:discussion"),
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
    events
}

fn announce_death_events() -> Vec<Value> {
    let mut events = ravenkeeper_check_events();
    events.push(phase_event("phaseStepSkipped", "night:ravenkeeper"));
    events.push(confirm_current_step(&events, "night:spy"));
    events.push(phase_event("phaseStepConfirmed", "night:toDay"));
    events
}

fn empty_announce_death_events() -> Vec<Value> {
    let mut events = ravenkeeper_check_events();
    events.pop();
    events.push(phase_event("phaseStepSkipped", "night:imp"));
    events.push(confirm_current_step(&events, "night:spy"));
    events.push(phase_event("phaseStepConfirmed", "night:toDay"));
    events
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

fn night_deaths_announced_event(player_ids: Value) -> Value {
    json!({
        "id": "evt-day-announce-deaths",
        "type": "nightDeathsAnnounced",
        "phase": "day",
        "payload": { "stepId": "day2:announceDeaths", "playerIds": player_ids },
        "summary": "밤 사망 공개 확정",
        "createdAt": "2026-01-01T00:00:00.000Z"
    })
}

fn confirm_current_step(events: &[Value], step_id: &str) -> Value {
    let game = game_with_events(Value::Array(events.to_vec()));
    let proposal = propose(
        &game,
        json!({
            "type": "confirmStep",
            "payload": { "stepId": step_id }
        }),
    );
    assert_eq!(
        proposal["ok"], true,
        "fixture could not confirm {step_id}: {proposal}"
    );
    proposal["value"]["event"].clone()
}

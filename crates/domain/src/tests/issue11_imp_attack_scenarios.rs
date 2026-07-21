use super::support::*;
use crate::*;
use serde_json::{json, Value};

#[test]
fn sober_actual_soldier_prevents_a_direct_imp_attack_without_a_source_event() {
    let game = imp_step_game(vec![]);
    let proposal = propose_imp_attack(&game, "player-2", None);
    assert_eq!(proposal["ok"], true, "proposal failed as {proposal}");
    assert_eq!(
        proposal["value"]["event"]["payload"]["resolution"],
        json!({
            "kind": "impAttack",
            "targetPlayerId": "player-2",
            "mayorContext": { "kind": "notApplicable" },
            "outcome": { "kind": "soldierProtected", "playerId": "player-2" }
        })
    );
    let replayed = replay_with_event(&game, proposal["value"]["event"].clone());
    assert_eq!(replayed["ok"], true, "replay failed as {replayed}");
    assert_eq!(replayed["value"]["players"][1]["alive"], true);
}

#[test]
fn eligible_mayor_requires_an_explicit_die_or_bounce_decision() {
    let game = imp_step_game(vec![]);
    let current = replay(&game);
    assert_eq!(current["ok"], true, "replay failed as {current}");
    assert_eq!(current["value"]["currentStep"]["id"], "night:imp");
    assert_eq!(
        current["value"]["currentStep"]["requiredInput"]["mayorDecision"],
        json!({
            "mayorPlayerId": "player-1",
            "bounceTargetPlayerIds": [
                "player-2", "player-3", "player-4", "player-5", "player-6", "player-7"
            ]
        })
    );

    let missing = propose_imp_attack(&game, "player-1", None);
    assert_eq!(
        missing["ok"], false,
        "missing decision succeeded as {missing}"
    );
    assert_eq!(missing["error"]["code"], "MISSING_MAYOR_DECISION");

    let dies = propose_imp_attack(&game, "player-1", Some(json!({ "kind": "mayorDies" })));
    assert_eq!(dies["ok"], true, "Mayor-dies proposal failed as {dies}");
    assert_eq!(
        dies["value"]["event"]["payload"]["resolution"],
        json!({
            "kind": "impAttack",
            "targetPlayerId": "player-1",
            "mayorContext": { "kind": "mayorDies", "mayorPlayerId": "player-1" },
            "outcome": { "kind": "death", "playerId": "player-1" }
        })
    );

    let bounced = propose_imp_attack(
        &game,
        "player-1",
        Some(json!({ "kind": "bounce", "targetPlayerId": "player-4" })),
    );
    assert_eq!(bounced["ok"], true, "bounce proposal failed as {bounced}");
    assert_eq!(
        bounced["value"]["event"]["summary"],
        "7번 Imp(임프) → 1번 Mayor(시장) 공격 · 4번 Washer(세탁부)에게 바운스 · 사망"
    );
    assert_eq!(
        bounced["value"]["event"]["payload"]["resolution"],
        json!({
            "kind": "impAttack",
            "targetPlayerId": "player-1",
            "mayorContext": {
                "kind": "bounced",
                "mayorPlayerId": "player-1",
                "bounceTargetPlayerId": "player-4"
            },
            "outcome": { "kind": "death", "playerId": "player-4" }
        })
    );
}

#[test]
fn mayor_bounces_to_dead_soldier_or_monk_protected_players_produce_no_death() {
    let dead_game = imp_step_game(vec![death_event("player-4")]);
    let dead = bounce(&dead_game, "player-4");
    assert_eq!(
        dead["value"]["event"]["payload"]["resolution"]["outcome"],
        json!({ "kind": "noDeath", "reason": "alreadyDead" })
    );

    let soldier_game = imp_step_game(vec![]);
    let soldier = bounce(&soldier_game, "player-2");
    assert_eq!(
        soldier["value"]["event"]["payload"]["resolution"]["outcome"],
        json!({ "kind": "soldierProtected", "playerId": "player-2" })
    );

    let monk_game = imp_step_game(vec![monk_protection_event("player-4")]);
    let monk = bounce(&monk_game, "player-4");
    assert_eq!(
        monk["value"]["event"]["payload"]["resolution"]["outcome"],
        json!({
            "kind": "prevented",
            "reason": "monkProtection",
            "sourceEventId": "night-monk-protection"
        })
    );
}

#[test]
fn ineligible_mayor_targets_do_not_require_a_mayor_decision() {
    let cases = [
        (
            "dead",
            imp_step_game(vec![death_event("player-1")]),
            json!({ "kind": "noDeath", "reason": "alreadyDead" }),
        ),
        (
            "poisoned",
            imp_step_game_with_poisoned_mayor(),
            json!({ "kind": "death", "playerId": "player-1" }),
        ),
        (
            "Monk-protected",
            imp_step_game(vec![monk_protection_event("player-1")]),
            json!({
                "kind": "prevented",
                "reason": "monkProtection",
                "sourceEventId": "night-monk-protection"
            }),
        ),
    ];

    for (label, game, expected_outcome) in cases {
        let current = replay(&game);
        assert_eq!(
            current["ok"], true,
            "{label} Mayor replay failed as {current}"
        );
        assert!(
            current["value"]["currentStep"]["requiredInput"]["mayorDecision"].is_null(),
            "{label} Mayor exposed an inapplicable decision: {current}"
        );

        let proposal = propose_imp_attack(&game, "player-1", None);
        assert_eq!(
            proposal["ok"], true,
            "{label} Mayor proposal failed as {proposal}"
        );
        assert_eq!(
            proposal["value"]["event"]["payload"]["resolution"]["outcome"], expected_outcome,
            "{label} Mayor outcome changed"
        );
    }
}

fn bounce(game: &Value, target_player_id: &str) -> Value {
    let proposal = propose_imp_attack(
        game,
        "player-1",
        Some(json!({ "kind": "bounce", "targetPlayerId": target_player_id })),
    );
    assert_eq!(proposal["ok"], true, "bounce failed as {proposal}");
    proposal
}

fn imp_step_game(extra_before_imp: Vec<Value>) -> Value {
    let mut events = vec![
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Mayor", "actualCharacter": "mayor", "shownCharacter": "mayor" },
            { "id": "player-2", "seat": 2, "name": "Soldier", "actualCharacter": "soldier", "shownCharacter": "soldier" },
            { "id": "player-3", "seat": 3, "name": "Monk", "actualCharacter": "monk", "shownCharacter": "monk" },
            { "id": "player-4", "seat": 4, "name": "Washer", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
            { "id": "player-5", "seat": 5, "name": "Chef", "actualCharacter": "chef", "shownCharacter": "chef" },
            { "id": "player-6", "seat": 6, "name": "Poisoner", "actualCharacter": "poisoner", "shownCharacter": "poisoner" },
            { "id": "player-7", "seat": 7, "name": "Imp", "actualCharacter": "imp", "shownCharacter": "imp" }
        ])),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event("phaseStepSkipped", "firstNight:poisoner"),
        phase_event("phaseStepSkipped", "firstNight:washerwoman"),
        phase_event("phaseStepSkipped", "firstNight:chef"),
        phase_event("phaseStepConfirmed", "firstNight:toDay"),
        phase_event("phaseStepConfirmed", "day:announceDeaths"),
        phase_event("phaseStepConfirmed", "day:whisper"),
        phase_event("phaseStepConfirmed", "day:discussion"),
        phase_event("phaseStepSkipped", "day:nomination:1"),
        no_execution_event("day:execution"),
        phase_event("phaseStepConfirmed", "day:toNight"),
        phase_event("phaseStepSkipped", "night:poisoner"),
    ];
    if extra_before_imp.iter().any(|event| {
        event["type"] == "nightActionResolved"
            && event["payload"]["resolution"]["kind"] == "monkProtection"
    }) {
        events.extend(extra_before_imp);
    } else {
        events.push(phase_event("phaseStepSkipped", "night:monk"));
        events.extend(extra_before_imp);
    }
    game_with_events(Value::Array(events))
}

fn imp_step_game_with_poisoned_mayor() -> Value {
    let mut game = imp_step_game(vec![]);
    let events = game["game"]["events"].as_array_mut().unwrap();
    let poisoner_step = events
        .iter_mut()
        .find(|event| event["payload"]["stepId"] == "night:poisoner")
        .expect("night Poisoner step should exist");
    *poisoner_step = json!({
        "id": "night-poison",
        "type": "nightActionResolved",
        "phase": "night",
        "payload": {
            "stepId": "night:poisoner",
            "actorPlayerId": "player-6",
            "resolution": {
                "kind": "poison",
                "targetPlayerId": "player-1",
                "applied": true
            }
        },
        "summary": "시장 중독",
        "createdAt": "2026-01-01T00:00:00.000Z"
    });
    game
}

fn monk_protection_event(target_player_id: &str) -> Value {
    json!({
        "id": "night-monk-protection",
        "type": "nightActionResolved",
        "phase": "night",
        "payload": {
            "stepId": "night:monk",
            "actorPlayerId": "player-3",
            "resolution": {
                "kind": "monkProtection",
                "targetPlayerId": target_player_id,
                "applied": true
            }
        },
        "summary": "수도사 보호",
        "createdAt": "2026-01-01T00:00:00.000Z"
    })
}

fn propose_imp_attack(
    game: &Value,
    target_player_id: &str,
    mayor_decision: Option<Value>,
) -> Value {
    let mut input = json!({ "playerIds": [target_player_id] });
    if let Some(decision) = mayor_decision {
        input["mayorDecision"] = decision;
    }
    propose(
        game,
        json!({
            "type": "confirmStep",
            "payload": { "stepId": "night:imp", "input": input }
        }),
    )
}

fn replay(game: &Value) -> Value {
    serde_json::from_str(&replay_json(&game.to_string())).unwrap()
}

fn propose(game: &Value, command: Value) -> Value {
    serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap()
}

fn replay_with_event(game: &Value, event: Value) -> Value {
    let mut events = game["game"]["events"].as_array().unwrap().clone();
    events.push(event);
    replay(&game_with_events(Value::Array(events)))
}

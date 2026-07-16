use super::support::*;
use crate::*;
use serde_json::{json, Value};

#[test]
fn imp_self_kill_with_five_alive_fixes_healthy_scarlet_woman_as_successor() {
    let game = imp_step_game(true);
    let attack = propose_imp_self_kill(&game, "player-7");
    assert_eq!(attack["ok"], true, "self-kill failed as {attack}");
    let game = with_event(&game, attack["value"]["event"].clone());
    let pending = replay(&game);
    assert_eq!(pending["ok"], true, "succession replay failed as {pending}");
    assert_eq!(
        pending["value"]["currentStep"]["id"],
        format!(
            "{}:demonSuccession",
            attack["value"]["event"]["id"].as_str().unwrap()
        )
    );
    assert_eq!(
        pending["value"]["currentStep"]["stepType"],
        "demonSuccession"
    );
    assert_eq!(
        pending["value"]["currentStep"]["requiredInput"]["demonSuccession"],
        json!({
            "kind": "fixed",
            "triggerEventId": attack["value"]["event"]["id"],
            "successorPlayerId": "player-6"
        })
    );

    let confirmation = propose(
        &game,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": pending["value"]["currentStep"]["id"],
                "input": { "successorPlayerId": "player-6" }
            }
        }),
    );
    assert_eq!(
        confirmation["ok"], true,
        "confirmation failed as {confirmation}"
    );
    assert_eq!(
        confirmation["value"]["event"]["type"],
        "demonSuccessionConfirmed"
    );
    assert_eq!(
        confirmation["value"]["event"]["payload"],
        json!({
            "triggerImpDeathEventId": attack["value"]["event"]["id"],
            "deathCause": "impSelfKill",
            "previousImpPlayerId": "player-7",
            "successorPlayerId": "player-6",
            "successorPreviousActualCharacter": "scarletWoman",
            "newCharacter": "imp",
            "source": "scarletWoman"
        })
    );
    assert_eq!(
        confirmation["value"]["revealPayload"],
        json!({ "kind": "newImp", "playerId": "player-6", "characterId": "imp" })
    );

    let transformed = replay_with_event(&game, confirmation["value"]["event"].clone());
    assert_eq!(
        transformed["ok"], true,
        "transformed replay failed as {transformed}"
    );
    assert_eq!(transformed["value"]["players"][5]["actualCharacter"], "imp");
    assert_eq!(transformed["value"]["players"][5]["shownCharacter"], "imp");
}

#[test]
fn imp_self_kill_without_fixed_scarlet_woman_selects_only_living_actual_minions() {
    let game = imp_step_game(false);
    let attack = propose_imp_self_kill(&game, "player-5");
    let game = with_event(&game, attack["value"]["event"].clone());
    let pending = replay(&game);
    assert_eq!(pending["ok"], true, "succession replay failed as {pending}");
    assert_eq!(
        pending["value"]["currentStep"]["requiredInput"]["demonSuccession"],
        json!({
            "kind": "selectable",
            "triggerEventId": attack["value"]["event"]["id"],
            "allowedPlayerIds": ["player-4"]
        })
    );
}

#[test]
fn confirmed_healthy_saint_execution_adds_undoable_warning_without_ending_game() {
    let mut events = saint_execution_events();
    let death = events.pop().unwrap();
    let before = replay(&game_with_events(Value::Array(events.clone())));
    assert!(before["value"]["warnings"]
        .as_array()
        .unwrap()
        .iter()
        .all(|warning| { warning["code"] != "SAINT_EXECUTED_EVIL_WIN" }));

    events.push(death);
    let after = replay(&game_with_events(Value::Array(events)));
    assert_eq!(after["ok"], true, "Saint replay failed as {after}");
    assert!(after["value"]["warnings"]
        .as_array()
        .unwrap()
        .contains(&json!({
            "code": "SAINT_EXECUTED_EVIL_WIN",
            "severity": "warning",
            "messageKo": "성자 처형 사망: 악 승리 확인 필요",
            "winningTeam": "evil"
        })));
    assert_eq!(after["value"]["phase"], "day");
    assert!(after["value"].get("gameEnded").is_none());
}

fn imp_step_game(with_scarlet_woman: bool) -> Value {
    let players = if with_scarlet_woman {
        json!([
            { "id": "player-1", "seat": 1, "name": "Washer", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
            { "id": "player-2", "seat": 2, "name": "Chef", "actualCharacter": "chef", "shownCharacter": "chef" },
            { "id": "player-3", "seat": 3, "name": "Empath", "actualCharacter": "empath", "shownCharacter": "empath" },
            { "id": "player-4", "seat": 4, "name": "Soldier", "actualCharacter": "soldier", "shownCharacter": "soldier" },
            { "id": "player-5", "seat": 5, "name": "Mayor", "actualCharacter": "mayor", "shownCharacter": "mayor" },
            { "id": "player-6", "seat": 6, "name": "Scarlet", "actualCharacter": "scarletWoman", "shownCharacter": "scarletWoman" },
            { "id": "player-7", "seat": 7, "name": "Imp", "actualCharacter": "imp", "shownCharacter": "imp" }
        ])
    } else {
        json!([
            { "id": "player-1", "seat": 1, "name": "Washer", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
            { "id": "player-2", "seat": 2, "name": "Chef", "actualCharacter": "chef", "shownCharacter": "chef" },
            { "id": "player-3", "seat": 3, "name": "Empath", "actualCharacter": "empath", "shownCharacter": "empath" },
            { "id": "player-4", "seat": 4, "name": "Poisoner", "actualCharacter": "poisoner", "shownCharacter": "poisoner" },
            { "id": "player-5", "seat": 5, "name": "Imp", "actualCharacter": "imp", "shownCharacter": "imp" }
        ])
    };
    let imp_id = if with_scarlet_woman {
        "player-7"
    } else {
        "player-5"
    };
    let mut events = vec![
        setup_event_with_players(players),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
    ];
    if !with_scarlet_woman {
        events.push(phase_event("phaseStepSkipped", "firstNight:poisoner"));
    }
    events.extend([
        phase_event("phaseStepSkipped", "firstNight:washerwoman"),
        phase_event("phaseStepSkipped", "firstNight:chef"),
        phase_event("phaseStepSkipped", "firstNight:empath"),
        phase_event("phaseStepConfirmed", "firstNight:toDay"),
        phase_event("phaseStepConfirmed", "day:announceDeaths"),
        phase_event("phaseStepConfirmed", "day:whisper"),
        phase_event("phaseStepConfirmed", "day:discussion"),
        phase_event("phaseStepSkipped", "day:nomination:1"),
        no_execution_event("day:execution"),
        phase_event("phaseStepConfirmed", "day:toNight"),
    ]);
    if !with_scarlet_woman {
        events.push(phase_event("phaseStepSkipped", "night:poisoner"));
    }
    let game = game_with_events(Value::Array(events));
    let replayed = replay(&game);
    assert_eq!(
        replayed["value"]["currentStep"]["id"], "night:imp",
        "wrong Imp step for {imp_id}: {replayed}"
    );
    game
}

fn propose_imp_self_kill(game: &Value, imp_player_id: &str) -> Value {
    propose(
        game,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "night:imp",
                "input": { "playerIds": [imp_player_id] }
            }
        }),
    )
}

fn saint_execution_events() -> Vec<Value> {
    vec![
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Washer", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
            { "id": "player-2", "seat": 2, "name": "Chef", "actualCharacter": "chef", "shownCharacter": "chef" },
            { "id": "player-3", "seat": 3, "name": "Saint", "actualCharacter": "saint", "shownCharacter": "saint" },
            { "id": "player-4", "seat": 4, "name": "Poisoner", "actualCharacter": "poisoner", "shownCharacter": "poisoner" },
            { "id": "player-5", "seat": 5, "name": "Imp", "actualCharacter": "imp", "shownCharacter": "imp" }
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
        nomination_vote_event(
            "day:nomination:1",
            "player-1",
            "player-3",
            ["player-1", "player-2", "player-3"],
        ),
        phase_event("phaseStepSkipped", "day:nomination:2"),
        json!({
            "id": "execution-saint",
            "type": "executionConfirmed",
            "phase": "day",
            "payload": {
                "stepId": "day:execution",
                "input": { "execute": true, "playerId": "player-3" }
            },
            "summary": "성자 처형",
            "createdAt": "2026-01-01T00:00:00.000Z"
        }),
        json!({
            "id": "death-saint",
            "type": "deathConfirmed",
            "phase": "day",
            "payload": { "stepId": "day:executionDeath", "playerId": "player-3" },
            "summary": "성자 사망",
            "createdAt": "2026-01-01T00:00:00.000Z"
        }),
    ]
}

fn replay(game: &Value) -> Value {
    serde_json::from_str(&replay_json(&game.to_string())).unwrap()
}

fn propose(game: &Value, command: Value) -> Value {
    serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap()
}

fn with_event(game: &Value, event: Value) -> Value {
    let mut events = game["game"]["events"].as_array().unwrap().clone();
    events.push(event);
    game_with_events(Value::Array(events))
}

fn replay_with_event(game: &Value, event: Value) -> Value {
    replay(&with_event(game, event))
}

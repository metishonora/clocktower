use serde_json::{json, Value};

use crate::{propose_json, replay_json};

use super::support::{
    death_event, game_with_events, no_execution_event, phase_event, setup_event,
    setup_event_with_players,
};

#[test]
fn replay_surfaces_demon_death_and_two_living_without_auto_ending() {
    let game = game_with_events(json!([
        setup_event(),
        death_event("player-5"),
        death_event("player-1"),
        death_event("player-2")
    ]));

    let actual = replay(&game);
    assert_eq!(actual["ok"], true, "win warning replay failed as {actual}");
    assert_eq!(actual["value"]["gameEnd"], Value::Null);
    let warnings = actual["value"]["warnings"].as_array().unwrap();
    assert!(warnings.contains(&json!({
        "code": "DEMON_DEAD_GOOD_WIN",
        "severity": "warning",
        "messageKo": "악마 사망: 선 승리 확인 필요",
        "winningTeam": "good"
    })));
    assert!(warnings.contains(&json!({
        "code": "TWO_LIVING_PLAYERS_EVIL_WIN",
        "severity": "warning",
        "messageKo": "생존자 2명: 악 승리 확인 필요",
        "winningTeam": "evil"
    })));
}

#[test]
fn explicit_end_game_is_canonical_replayable_and_undoable() {
    let game = game_with_events(json!([setup_event()]));
    let proposal = propose(
        &game,
        json!({
            "type": "endGame",
            "payload": { "winningTeam": "evil", "expectedEventCount": 1 }
        }),
    );
    assert_eq!(
        proposal["ok"], true,
        "end-game proposal failed as {proposal}"
    );
    assert_eq!(proposal["value"]["event"]["type"], "gameEnded");
    assert_eq!(
        proposal["value"]["event"]["payload"],
        json!({ "winningTeam": "evil" })
    );
    assert_eq!(
        proposal["value"]["event"]["summary"],
        "게임 종료 · 악팀 승리"
    );

    let ended_game = with_event(&game, proposal["value"]["event"].clone());
    let ended = replay(&ended_game);
    assert_eq!(ended["ok"], true, "ended replay failed as {ended}");
    assert_eq!(
        ended["value"]["gameEnd"],
        json!({ "eventId": "game-ended-2", "winningTeam": "evil" })
    );
    assert_eq!(ended["value"]["currentStep"], Value::Null);
    assert_eq!(ended["value"]["phaseOverview"], json!([]));

    let blocked = propose(
        &ended_game,
        json!({ "type": "endGame", "payload": { "winningTeam": "good", "expectedEventCount": 2 } }),
    );
    assert_eq!(blocked["error"]["code"], "GAME_ALREADY_ENDED");

    let undone = replay(&game);
    assert_eq!(undone["ok"], true);
    assert_eq!(undone["value"]["gameEnd"], Value::Null);
    assert_ne!(undone["value"]["currentStep"], Value::Null);
}

#[test]
fn replay_rejects_events_after_game_end() {
    let game = game_with_events(json!([
        setup_event(),
        {
            "id": "game-ended-2",
            "type": "gameEnded",
            "phase": "firstNight",
            "payload": { "winningTeam": "good" },
            "summary": "게임 종료 · 선팀 승리",
            "createdAt": "2026-01-01T00:00:00.000Z"
        },
        death_event("player-1")
    ]));

    let actual = replay(&game);
    assert_eq!(actual["error"]["code"], "REPLAY_FAILED");
}

#[test]
fn pending_demon_succession_suppresses_the_good_win_warning() {
    let game = game_with_events(Value::Array(vec![
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Washer", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
            { "id": "player-2", "seat": 2, "name": "Chef", "actualCharacter": "chef", "shownCharacter": "chef" },
            { "id": "player-3", "seat": 3, "name": "Empath", "actualCharacter": "empath", "shownCharacter": "empath" },
            { "id": "player-4", "seat": 4, "name": "Soldier", "actualCharacter": "soldier", "shownCharacter": "soldier" },
            { "id": "player-5", "seat": 5, "name": "Mayor", "actualCharacter": "mayor", "shownCharacter": "mayor" },
            { "id": "player-6", "seat": 6, "name": "Scarlet", "actualCharacter": "scarletWoman", "shownCharacter": "scarletWoman" },
            { "id": "player-7", "seat": 7, "name": "Imp", "actualCharacter": "imp", "shownCharacter": "imp" }
        ])),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
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
    ]));
    let attack = propose(
        &game,
        json!({
            "type": "confirmStep",
            "payload": { "stepId": "night:imp", "input": { "playerIds": ["player-7"] } }
        }),
    );
    assert_eq!(attack["ok"], true, "Imp self-kill failed as {attack}");

    let replayed = replay(&with_event(&game, attack["value"]["event"].clone()));
    assert_eq!(
        replayed["value"]["currentStep"]["stepType"],
        "demonSuccession"
    );
    assert!(!warning_codes(&replayed).contains(&"DEMON_DEAD_GOOD_WIN"));
}

#[test]
fn healthy_actual_mayor_with_three_alive_and_no_execution_surfaces_good_win() {
    let events = vec![
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
        death_event("player-2"),
        death_event("player-3"),
        death_event("player-4"),
        death_event("player-5"),
        phase_event("phaseStepSkipped", "day:nomination:1"),
        no_execution_event("day:execution"),
    ];
    let actual = replay(&game_with_events(Value::Array(events)));
    assert_eq!(actual["ok"], true, "Mayor replay failed as {actual}");
    assert!(actual["value"]["warnings"]
        .as_array()
        .unwrap()
        .contains(&json!({
            "code": "MAYOR_GOOD_WIN",
            "severity": "warning",
            "messageKo": "시장 무처형 조건: 선 승리 확인 필요",
            "winningTeam": "good"
        })));
}

#[test]
fn poisoned_mayor_does_not_surface_the_good_win_warning() {
    let events = vec![
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
        poison_event("firstNight:poisoner", "player-6", "player-1"),
        phase_event("phaseStepSkipped", "firstNight:washerwoman"),
        phase_event("phaseStepSkipped", "firstNight:chef"),
        phase_event("phaseStepConfirmed", "firstNight:toDay"),
        phase_event("phaseStepConfirmed", "day:announceDeaths"),
        phase_event("phaseStepConfirmed", "day:whisper"),
        phase_event("phaseStepConfirmed", "day:discussion"),
        death_event("player-2"),
        death_event("player-3"),
        death_event("player-4"),
        death_event("player-5"),
        phase_event("phaseStepSkipped", "day:nomination:1"),
        no_execution_event("day:execution"),
    ];
    let actual = replay(&game_with_events(Value::Array(events)));
    assert_eq!(
        actual["ok"], true,
        "poisoned Mayor replay failed as {actual}"
    );
    assert!(!warning_codes(&actual).contains(&"MAYOR_GOOD_WIN"));
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

fn warning_codes(result: &Value) -> Vec<&str> {
    result["value"]["warnings"]
        .as_array()
        .unwrap()
        .iter()
        .filter_map(|warning| warning["code"].as_str())
        .collect()
}

fn poison_event(step_id: &str, actor_player_id: &str, target_player_id: &str) -> Value {
    json!({
        "id": format!("evt-{step_id}"),
        "type": "nightActionResolved",
        "phase": step_id.split(':').next().unwrap(),
        "payload": {
            "stepId": step_id,
            "actorPlayerId": actor_player_id,
            "resolution": { "kind": "poison", "targetPlayerId": target_player_id, "applied": true }
        },
        "summary": "독 지정 확정",
        "createdAt": "2026-01-01T00:00:00.000Z"
    })
}

use super::support::*;
use crate::*;
use serde_json::{json, Value};

#[test]
fn butler_cannot_choose_self_as_master() {
    let game = game_before_butler();
    let replay: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();
    assert_eq!(replay["ok"], true, "replay failed as {replay:#}");
    assert_eq!(replay["value"]["currentStep"]["id"], "firstNight:butler");
    assert_eq!(
        replay["value"]["currentStep"]["requiredInput"]["allowedPlayerIds"],
        json!(["player-1", "player-3", "player-4", "player-5"])
    );

    let result = call_propose(
        &game,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "firstNight:butler",
                "input": { "playerIds": ["player-2"] }
            }
        }),
    );

    assert_eq!(result["ok"], false);
    assert_eq!(result["error"]["code"], "INVALID_BUTLER_MASTER");
    assert!(result.get("value").is_none());
}

#[test]
fn replay_exposes_the_current_days_butler_master() {
    let game = game_at_vote(Some("player-1"), ButlerCondition::Healthy);
    let replay: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();

    assert_eq!(replay["ok"], true, "replay failed as {replay:#}");
    assert_eq!(
        replay["value"]["ruleState"]["butlerVote"],
        json!({
            "butlerPlayerId": "player-2",
            "masterPlayerId": "player-1",
            "restrictionApplies": true
        })
    );
}

#[test]
fn healthy_living_butler_vote_without_master_is_omitted_on_confirmation() {
    let game = game_at_vote(Some("player-1"), ButlerCondition::Healthy);

    let without_master = confirm_vote(&game, &["player-2", "player-3"]);
    assert_eq!(
        without_master["ok"], true,
        "vote failed as {without_master:#}"
    );
    assert_eq!(
        without_master["value"]["event"]["payload"]["voterIds"],
        json!(["player-3"])
    );

    let with_master = confirm_vote(&game, &["player-1", "player-2"]);
    assert_eq!(with_master["ok"], true, "vote failed as {with_master:#}");
    assert_eq!(
        with_master["value"]["event"]["payload"]["voterIds"],
        json!(["player-1", "player-2"])
    );
}

#[test]
fn skipped_butler_master_causes_the_butler_vote_to_be_omitted() {
    let game = game_at_vote(None, ButlerCondition::Healthy);
    let replay: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();
    assert_eq!(
        replay["value"]["ruleState"]["butlerVote"],
        json!({
            "butlerPlayerId": "player-2",
            "restrictionApplies": true
        })
    );

    let vote = confirm_vote(&game, &["player-2"]);
    assert_eq!(vote["ok"], true, "vote failed as {vote:#}");
    assert_eq!(vote["value"]["event"]["payload"]["voterIds"], json!([]));
}

#[test]
fn poisoned_or_dead_butler_uses_only_existing_vote_rules() {
    let poisoned_game = game_at_vote(Some("player-1"), ButlerCondition::Poisoned);
    let poisoned_replay: Value =
        serde_json::from_str(&replay_json(&poisoned_game.to_string())).unwrap();
    assert_eq!(
        poisoned_replay["value"]["ruleState"]["butlerVote"]["restrictionApplies"],
        false
    );
    let poisoned_vote = confirm_vote(&poisoned_game, &["player-2"]);
    assert_eq!(
        poisoned_vote["ok"], true,
        "poisoned vote failed as {poisoned_vote:#}"
    );

    let dead_game = game_at_vote(Some("player-1"), ButlerCondition::Dead);
    let dead_replay: Value = serde_json::from_str(&replay_json(&dead_game.to_string())).unwrap();
    assert_eq!(
        dead_replay["value"]["ruleState"]["butlerVote"]["restrictionApplies"],
        false
    );
    let dead_vote = confirm_vote(&dead_game, &["player-2"]);
    assert_eq!(dead_vote["ok"], true, "dead vote failed as {dead_vote:#}");
    assert_eq!(
        dead_vote["value"]["event"]["payload"]["ghostVoteSpentPlayerIds"],
        json!(["player-2"])
    );
}

#[test]
fn legacy_confirmed_butler_vote_without_master_still_replays() {
    let mut game = game_at_vote(Some("player-1"), ButlerCondition::Healthy);
    let events = game["game"]["events"].as_array_mut().unwrap();
    let started = events.pop().expect("active nomination event");
    let nomination_event_id = started["id"].as_str().unwrap();
    events.push(started.clone());
    events.push(json!({
        "id": "legacy-butler-vote",
        "type": "nominationVoteConfirmed",
        "phase": "day",
        "payload": {
            "stepId": "day:nomination:1:vote",
            "nominationEventId": nomination_event_id,
            "voterIds": ["player-2"],
            "ghostVoteSpentPlayerIds": []
        },
        "summary": "기존 집사 투표 확정",
        "createdAt": "2026-01-01T00:00:00.000Z"
    }));

    let replay: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();
    assert_eq!(replay["ok"], true, "legacy replay failed as {replay:#}");
    assert_eq!(
        replay["value"]["dayState"]["nominations"][0]["voterIds"],
        json!(["player-2"])
    );
}

#[test]
fn dead_master_with_an_unspent_ghost_vote_can_enable_the_butler() {
    let mut game = game_at_vote(Some("player-1"), ButlerCondition::Healthy);
    let events = game["game"]["events"].as_array_mut().unwrap();
    let day_start = events
        .iter()
        .position(|event| event["payload"]["stepId"] == "day:announceDeaths")
        .expect("day announcement event");
    events.insert(day_start, death_event("player-1"));

    let vote = confirm_vote(&game, &["player-1", "player-2"]);
    assert_eq!(vote["ok"], true, "vote failed as {vote:#}");
    assert_eq!(
        vote["value"]["event"]["payload"]["ghostVoteSpentPlayerIds"],
        json!(["player-1"])
    );
}

#[test]
fn manual_poison_annotation_does_not_disable_the_butler_rule() {
    let mut game = game_at_vote(Some("player-1"), ButlerCondition::Healthy);
    let events = game["game"]["events"].as_array_mut().unwrap();
    let day_start = events
        .iter()
        .position(|event| event["payload"]["stepId"] == "day:announceDeaths")
        .expect("day announcement event");
    events.insert(
        day_start,
        json!({
            "id": "manual-poison-marker",
            "type": "playerAnnotationsUpdated",
            "phase": "day",
            "payload": {
                "playerId": "player-2",
                "systemTokenIds": ["poisoned"],
                "scriptTokens": [],
                "notes": "수동 표시"
            },
            "summary": "수동 중독 표시",
            "createdAt": "2026-01-01T00:00:00.000Z"
        }),
    );

    let replay: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();
    assert_eq!(
        replay["value"]["ruleState"]["butlerVote"]["restrictionApplies"],
        true
    );
    let vote = confirm_vote(&game, &["player-2"]);
    assert_eq!(vote["ok"], true, "vote failed as {vote:#}");
    assert_eq!(vote["value"]["event"]["payload"]["voterIds"], json!([]));
}

#[test]
fn legacy_self_master_replays_as_missing_and_cannot_authorize_a_new_vote() {
    let game = game_at_vote(Some("player-2"), ButlerCondition::Healthy);
    let replay: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();
    assert_eq!(replay["ok"], true, "legacy replay failed as {replay:#}");
    assert_eq!(
        replay["value"]["ruleState"]["butlerVote"],
        json!({
            "butlerPlayerId": "player-2",
            "restrictionApplies": true
        })
    );
    let vote = confirm_vote(&game, &["player-2"]);
    assert_eq!(vote["ok"], true, "vote failed as {vote:#}");
    assert_eq!(vote["value"]["event"]["payload"]["voterIds"], json!([]));
}

#[derive(Clone, Copy)]
enum ButlerCondition {
    Healthy,
    Poisoned,
    Dead,
}

fn game_before_butler() -> Value {
    game_with_events(json!([
        butler_setup_event(),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event("phaseStepSkipped", "firstNight:poisoner"),
        phase_event("phaseStepConfirmed", "firstNight:chef"),
        phase_event("phaseStepConfirmed", "firstNight:empath")
    ]))
}

fn game_at_vote(master_id: Option<&str>, condition: ButlerCondition) -> Value {
    let mut events = vec![
        butler_setup_event(),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
    ];
    events.push(match condition {
        ButlerCondition::Poisoned => poison_event("player-2"),
        ButlerCondition::Healthy | ButlerCondition::Dead => {
            phase_event("phaseStepSkipped", "firstNight:poisoner")
        }
    });
    events.extend([
        phase_event("phaseStepConfirmed", "firstNight:chef"),
        phase_event("phaseStepConfirmed", "firstNight:empath"),
        master_id.map_or_else(
            || phase_event("phaseStepSkipped", "firstNight:butler"),
            |master_id| {
                phase_event_with_input(
                    "phaseStepConfirmed",
                    "firstNight:butler",
                    json!({ "playerIds": [master_id] }),
                )
            },
        ),
        phase_event("phaseStepConfirmed", "firstNight:toDay"),
    ]);
    if matches!(condition, ButlerCondition::Dead) {
        events.push(death_event("player-2"));
    }
    events.extend([
        phase_event("phaseStepConfirmed", "day:announceDeaths"),
        phase_event("phaseStepConfirmed", "day:whisper"),
        phase_event("phaseStepConfirmed", "day:discussion"),
    ]);
    let game = game_with_events(Value::Array(events));
    let started = call_propose(
        &game,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "day:nomination:1",
                "input": { "nominatorId": "player-3", "nomineeId": "player-5" }
            }
        }),
    );
    assert_eq!(started["ok"], true, "nomination failed as {started:#}");
    with_event(game, started["value"]["event"].clone())
}

fn butler_setup_event() -> Value {
    setup_event_with_players(json!([
        { "id": "player-1", "seat": 1, "name": "Master", "actualCharacter": "chef", "shownCharacter": "chef" },
        { "id": "player-2", "seat": 2, "name": "Butler", "actualCharacter": "butler", "shownCharacter": "butler" },
        { "id": "player-3", "seat": 3, "name": "Nominator", "actualCharacter": "empath", "shownCharacter": "empath" },
        { "id": "player-4", "seat": 4, "name": "Poisoner", "actualCharacter": "poisoner", "shownCharacter": "poisoner" },
        { "id": "player-5", "seat": 5, "name": "Imp", "actualCharacter": "imp", "shownCharacter": "imp" }
    ]))
}

fn poison_event(target_player_id: &str) -> Value {
    json!({
        "id": "evt-firstNight:poisoner",
        "type": "nightActionResolved",
        "phase": "firstNight",
        "payload": {
            "stepId": "firstNight:poisoner",
            "actorPlayerId": "player-4",
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

fn confirm_vote(game: &Value, voter_ids: &[&str]) -> Value {
    call_propose(
        game,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "day:nomination:1:vote",
                "input": { "voterIds": voter_ids }
            }
        }),
    )
}

fn call_propose(game: &Value, command: Value) -> Value {
    serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap()
}

fn with_event(mut game: Value, event: Value) -> Value {
    game["game"]["events"].as_array_mut().unwrap().push(event);
    game
}

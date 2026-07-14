use serde_json::{json, Value};

pub(super) const EMPTY_GAME: &str = r#"{
      "schemaVersion": 1,
      "game": {
        "id": "game-1",
        "name": "Smoke",
        "createdAt": "2026-01-01T00:00:00.000Z",
        "updatedAt": "2026-01-01T00:00:00.000Z",
        "events": []
      }
    }"#;

pub(super) fn game_with_events(events: Value) -> Value {
    json!({
        "schemaVersion": 1,
        "game": {
            "id": "game-1",
            "name": "Setup",
            "createdAt": "2026-01-01T00:00:00.000Z",
            "updatedAt": "2026-01-01T00:00:00.000Z",
            "events": events
        }
    })
}

pub(super) fn setup_event() -> Value {
    setup_event_with_players(json!([
        { "id": "player-1", "seat": 1, "name": "Ada", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
        { "id": "player-2", "seat": 2, "name": "Bert", "actualCharacter": "chef", "shownCharacter": "chef" },
        { "id": "player-3", "seat": 3, "name": "Cora", "actualCharacter": "empath", "shownCharacter": "empath" },
        { "id": "player-4", "seat": 4, "name": "Dev", "actualCharacter": "fortuneTeller", "shownCharacter": "fortuneTeller" },
        { "id": "player-5", "seat": 5, "name": "Eve", "actualCharacter": "imp", "shownCharacter": "imp" }
    ]))
}

pub(super) fn setup_event_with_minion() -> Value {
    setup_event_with_players(json!([
        { "id": "player-1", "seat": 1, "name": "Ada", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
        { "id": "player-2", "seat": 2, "name": "Bert", "actualCharacter": "chef", "shownCharacter": "chef" },
        { "id": "player-3", "seat": 3, "name": "Cora", "actualCharacter": "empath", "shownCharacter": "empath" },
        { "id": "player-4", "seat": 4, "name": "Dev", "actualCharacter": "poisoner", "shownCharacter": "poisoner" },
        { "id": "player-5", "seat": 5, "name": "Eve", "actualCharacter": "imp", "shownCharacter": "imp" }
    ]))
}

pub(super) fn setup_event_with_players(players: Value) -> Value {
    json!({
        "id": "evt-1",
        "type": "setupConfirmed",
        "phase": "setup",
        "payload": { "players": players },
        "summary": "초기 설정 확정: 5명",
        "createdAt": "2026-01-01T00:00:00.000Z"
    })
}

pub(super) fn death_event(player_id: &str) -> Value {
    json!({
        "id": format!("death-{player_id}"),
        "type": "deathConfirmed",
        "phase": "night",
        "payload": { "playerId": player_id },
        "summary": "사망 확정",
        "createdAt": "2026-01-01T00:00:00.000Z"
    })
}

pub(super) fn nomination_vote_event<const N: usize>(
    step_id: &str,
    nominator_id: &str,
    nominee_id: &str,
    voter_ids: [&str; N],
) -> Value {
    let voter_ids = voter_ids.to_vec();
    let vote_count = voter_ids.len();
    json!({
        "id": format!("evt-{step_id}"),
        "type": "nominationVoteConfirmed",
        "phase": "day",
        "payload": {
            "stepId": step_id,
            "input": {
                "stepId": step_id,
                "nominatorId": nominator_id,
                "nomineeId": nominee_id,
                "voterIds": voter_ids,
                "voteCount": vote_count,
                "ghostVoteSpentPlayerIds": [],
                "updatesExecutionCandidate": vote_count >= 3
            }
        },
        "summary": "지명 투표 확정",
        "createdAt": "2026-01-01T00:00:00.000Z"
    })
}

pub(super) fn no_execution_event(step_id: &str) -> Value {
    json!({
        "id": format!("evt-{step_id}"),
        "type": "noExecutionConfirmed",
        "phase": "day",
        "payload": {
            "stepId": step_id,
            "input": { "execute": false, "playerId": null }
        },
        "summary": "처형 없음 확정",
        "createdAt": "2026-01-01T00:00:00.000Z"
    })
}

pub(super) fn phase_event(event_type: &str, step_id: &str) -> Value {
    let input = if event_type == "phaseStepConfirmed" {
        if ["washerwoman", "librarian", "investigator", "fortuneTeller"]
            .iter()
            .any(|character| step_id.ends_with(character))
        {
            if step_id.ends_with("washerwoman") {
                json!({ "playerIds": ["player-1", "player-2"], "characterId": "chef" })
            } else if step_id.ends_with("librarian") {
                json!({ "playerIds": ["player-1", "player-2"], "characterId": "drunk" })
            } else if step_id.ends_with("investigator") {
                json!({ "playerIds": ["player-1", "player-2"], "characterId": "poisoner" })
            } else {
                json!({ "playerIds": ["player-1", "player-2"] })
            }
        } else if ["poisoner", "monk", "imp", "ravenkeeper", "butler"]
            .iter()
            .any(|character| step_id.ends_with(character))
        {
            json!({ "playerIds": ["player-1"] })
        } else {
            Value::Null
        }
    } else {
        Value::Null
    };

    phase_event_with_input(event_type, step_id, input)
}

pub(super) fn phase_event_with_input(event_type: &str, step_id: &str, input: Value) -> Value {
    json!({
        "id": format!("evt-{step_id}"),
        "type": event_type,
        "phase": step_id.split(':').next().unwrap(),
        "payload": { "stepId": step_id, "input": input },
        "summary": step_id,
        "createdAt": "2026-01-01T00:00:00.000Z"
    })
}

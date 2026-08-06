use serde_json::{json, Value};

pub(super) const EMPTY_GAME: &str = r#"{
      "schemaVersion": 2,
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
        "schemaVersion": 2,
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
    json!({
        "id": format!("evt-{step_id}"),
        "type": "nominationVoteConfirmed",
        "phase": "day",
        "payload": {
            "stepId": step_id,
            "nominatorId": nominator_id,
            "nomineeId": nominee_id,
            "voterIds": voter_ids,
            "ghostVoteSpentPlayerIds": []
        },
        "summary": "지목 투표 확정",
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

pub(super) fn snv_demon_bluff_input(step: &Value) -> Value {
    let character_ids = step["requiredInput"]["allowedCharacterIds"]
        .as_array()
        .expect("S&V Demon information should expose its legal bluff catalog")
        .iter()
        .take(3)
        .cloned()
        .collect::<Vec<_>>();
    assert_eq!(character_ids.len(), 3, "S&V needs three legal Demon bluffs");
    json!({ "characterIds": character_ids })
}

pub(super) fn snv_day_execution_command(state: &Value, nominee_id: &str) -> Option<Value> {
    let step = &state["value"]["currentStep"];
    match step["requiredInput"]["kind"].as_str()? {
        "nomination" => {
            if state["value"]["dayState"]["executionCandidate"].is_object() {
                return Some(json!({ "type": "skipStep", "payload": { "stepId": step["id"] } }));
            }
            let nominator_id = state["value"]["dayState"]["eligibleNominatorIds"]
                .as_array()?
                .iter()
                .filter_map(Value::as_str)
                .find(|id| *id != nominee_id)?;
            Some(json!({ "type": "confirmStep", "payload": {
                "stepId": step["id"],
                "input": { "nominatorId": nominator_id, "nomineeId": nominee_id }
            }}))
        }
        "nominationVote" => {
            let threshold = state["value"]["dayState"]["executionVoteThreshold"].as_u64()? as usize;
            let voter_ids = state["value"]["players"]
                .as_array()?
                .iter()
                .filter(|player| player["alive"] == true)
                .filter_map(|player| player["id"].as_str())
                .take(threshold)
                .collect::<Vec<_>>();
            (voter_ids.len() == threshold).then(|| {
                json!({ "type": "confirmStep", "payload": {
                    "stepId": step["id"], "input": { "voterIds": voter_ids }
                }})
            })
        }
        "executionDecision" => Some(json!({ "type": "confirmStep", "payload": {
            "stepId": step["id"], "input": { "execute": true }
        }})),
        "executionDeathDecision" => Some(json!({ "type": "confirmStep", "payload": {
            "stepId": step["id"], "input": { "died": true }
        }})),
        _ => None,
    }
}

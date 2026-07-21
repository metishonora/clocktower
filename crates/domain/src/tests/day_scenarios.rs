use super::support::*;
use crate::*;
use serde_json::{json, Value};

#[test]
fn day_advances_through_typed_whisper_and_discussion_steps_before_nominations() {
    let game = game_with_events(json!([
        setup_event(),
        death_event("player-2"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event("phaseStepConfirmed", "firstNight:washerwoman"),
        phase_event("phaseStepConfirmed", "firstNight:chef"),
        phase_event("phaseStepConfirmed", "firstNight:empath"),
        phase_event("phaseStepConfirmed", "firstNight:fortuneTeller"),
        phase_event("phaseStepConfirmed", "firstNight:toDay"),
        phase_event("phaseStepConfirmed", "day:announceDeaths")
    ]));

    let actual: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();

    assert_eq!(actual["ok"], true);
    assert_eq!(actual["value"]["phase"], "day");
    assert_eq!(actual["value"]["currentStep"]["id"], "day:whisper");
    assert_eq!(actual["value"]["currentStep"]["stepType"], "whisper");
    assert_eq!(actual["value"]["players"][1]["alive"], false);

    let (game, after_whisper) = confirm_and_replay(game, "day:whisper");
    assert_eq!(after_whisper["ok"], true);
    assert_eq!(
        after_whisper["value"]["currentStep"]["id"],
        "day:discussion"
    );
    assert_eq!(
        after_whisper["value"]["currentStep"]["stepType"],
        "discussion"
    );

    let (_, after_discussion) = confirm_and_replay(game, "day:discussion");
    assert_eq!(after_discussion["ok"], true);
    assert_eq!(
        after_discussion["value"]["currentStep"]["id"],
        "day:nomination:1"
    );
    assert_eq!(
        after_discussion["value"]["currentStep"]["requiredInput"]["kind"],
        "nomination"
    );
}

#[test]
fn confirming_nomination_vote_spends_valid_ghost_votes_and_derives_candidate() {
    let game = game_with_events(json!([
        setup_event(),
        death_event("player-2"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event("phaseStepConfirmed", "firstNight:washerwoman"),
        phase_event("phaseStepConfirmed", "firstNight:chef"),
        phase_event("phaseStepConfirmed", "firstNight:empath"),
        phase_event("phaseStepConfirmed", "firstNight:fortuneTeller"),
        phase_event("phaseStepConfirmed", "firstNight:toDay"),
        phase_event("phaseStepConfirmed", "day:announceDeaths"),
        phase_event("phaseStepConfirmed", "day:whisper"),
        phase_event("phaseStepConfirmed", "day:discussion")
    ]));
    let start_command = json!({
        "type": "confirmStep",
        "payload": {
            "stepId": "day:nomination:1",
            "input": {
                "nominatorId": "player-1",
                "nomineeId": "player-5"
            }
        }
    });
    let started: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &start_command.to_string())).unwrap();
    assert_eq!(started["ok"], true, "start failed as {started}");
    assert_eq!(
        started["value"]["event"]["summary"],
        "지목 확정: 1번 Ada(세탁부) → 5번 Eve(임프)"
    );
    let mut started_events = game["game"]["events"].as_array().unwrap().clone();
    started_events.push(started["value"]["event"].clone());
    let started_game = game_with_events(Value::Array(started_events));
    let vote_command = json!({
        "type": "confirmStep",
        "payload": {
            "stepId": "day:nomination:1:vote",
            "input": { "voterIds": ["player-1", "player-2", "player-3"] }
        }
    });
    let proposal: Value = serde_json::from_str(&propose_json(
        &started_game.to_string(),
        &vote_command.to_string(),
    ))
    .unwrap();

    assert_eq!(proposal["ok"], true);
    assert_eq!(
        proposal["value"]["event"]["summary"],
        "지목 투표 확정: 1번 Ada(세탁부) → 5번 Eve(임프), 3표"
    );
    assert_eq!(
        proposal["value"]["event"]["type"],
        "nominationVoteConfirmed"
    );
    assert_eq!(
        proposal["value"]["event"]["payload"],
        json!({
            "stepId": "day:nomination:1:vote",
            "nominationEventId": started["value"]["event"]["id"],
            "voterIds": ["player-1", "player-2", "player-3"],
            "ghostVoteSpentPlayerIds": ["player-2"]
        })
    );
    assert_eq!(proposal["value"]["preview"]["voteCount"], 3);
    assert_eq!(
        proposal["value"]["preview"]["ghostVoteSpentPlayerIds"],
        json!(["player-2"])
    );
    assert!(proposal["value"]["preview"]
        .get("updatesExecutionCandidate")
        .is_none());
    assert_eq!(
        proposal["value"]["preview"]["executionStanding"],
        json!({
            "executionVoteThreshold": 2,
            "highestVoteCount": 3,
            "executionCandidate": { "nomineeId": "player-5", "voteCount": 3 }
        })
    );

    let mut events = started_game["game"]["events"].as_array().unwrap().clone();
    events.push(proposal["value"]["event"].clone());
    let replayed: Value = serde_json::from_str(&replay_json(
        &game_with_events(Value::Array(events)).to_string(),
    ))
    .unwrap();

    assert_eq!(replayed["ok"], true);
    assert_eq!(replayed["value"]["players"][1]["ghostVoteUsed"], true);
    assert_eq!(
        replayed["value"]["dayState"]["nominations"][0],
        json!({
            "stepId": "day:nomination:1",
            "nominatorId": "player-1",
            "nomineeId": "player-5",
            "voterIds": ["player-1", "player-2", "player-3"],
            "voteCount": 3,
            "ghostVoteSpentPlayerIds": ["player-2"]
        })
    );
    assert_eq!(
        replayed["value"]["dayState"]["executionCandidate"],
        json!({ "nomineeId": "player-5", "voteCount": 3 })
    );
    assert_eq!(replayed["value"]["currentStep"]["id"], "day:nomination:2");

    let without_latest_nomination = game_with_events(started_game["game"]["events"].clone());
    let undone: Value =
        serde_json::from_str(&replay_json(&without_latest_nomination.to_string())).unwrap();
    assert_eq!(undone["ok"], true);
    assert_eq!(undone["value"]["players"][1]["ghostVoteUsed"], false);
}

#[test]
fn execution_confirmation_is_separate_from_death_state() {
    let game = game_with_events(json!([
        setup_event(),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event("phaseStepConfirmed", "firstNight:washerwoman"),
        phase_event("phaseStepConfirmed", "firstNight:chef"),
        phase_event("phaseStepConfirmed", "firstNight:empath"),
        phase_event("phaseStepConfirmed", "firstNight:fortuneTeller"),
        phase_event("phaseStepConfirmed", "firstNight:toDay"),
        phase_event("phaseStepConfirmed", "day:announceDeaths"),
        phase_event("phaseStepConfirmed", "day:whisper"),
        phase_event("phaseStepConfirmed", "day:discussion"),
        nomination_vote_event(
            "day:nomination:1",
            "player-1",
            "player-5",
            ["player-1", "player-2", "player-3"]
        ),
        phase_event("phaseStepSkipped", "day:nomination:2")
    ]));
    let command = json!({
        "type": "confirmStep",
        "payload": {
            "stepId": "day:execution",
            "input": { "execute": true }
        }
    });

    let proposal: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

    assert_eq!(proposal["ok"], true);
    assert_eq!(proposal["value"]["event"]["type"], "executionConfirmed");

    let mut events = game["game"]["events"].as_array().unwrap().clone();
    events.push(proposal["value"]["event"].clone());
    let replayed: Value = serde_json::from_str(&replay_json(
        &game_with_events(Value::Array(events)).to_string(),
    ))
    .unwrap();

    assert_eq!(replayed["ok"], true);
    assert_eq!(
        replayed["value"]["dayState"]["confirmedExecution"]["playerId"],
        "player-5"
    );
    assert_eq!(replayed["value"]["players"][4]["alive"], true);
    assert_eq!(replayed["value"]["currentStep"]["id"], "day:executionDeath");
    assert_eq!(
        replayed["value"]["currentStep"]["stepType"],
        "executionDeath"
    );
    assert_eq!(
        replayed["value"]["currentStep"]["requiredInput"]["kind"],
        "executionDeathDecision"
    );
    assert_eq!(
        replayed["value"]["currentStep"]["requiredInput"]["target"],
        "execution"
    );
    assert_eq!(replayed["value"]["currentStep"]["playerId"], "player-5");
    assert_ne!(
        replayed["value"]["currentStep"]["requiredInput"]["executionSurvivalAllowed"],
        true
    );
}

#[test]
fn execution_death_confirmation_has_its_own_event_and_is_undoable() {
    let (game, after_execution) = confirmed_execution_game();
    assert_eq!(after_execution["value"]["players"][4]["alive"], true);

    let command = json!({
        "type": "confirmStep",
        "payload": {
            "stepId": "day:executionDeath",
            "input": { "died": true }
        }
    });
    let proposal: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

    assert_eq!(proposal["ok"], true);
    assert_eq!(proposal["value"]["event"]["type"], "deathConfirmed");
    assert_eq!(
        proposal["value"]["event"]["payload"],
        json!({ "stepId": "day:executionDeath", "playerId": "player-5" })
    );

    let mut confirmed_events = game["game"]["events"].as_array().unwrap().clone();
    confirmed_events.push(proposal["value"]["event"].clone());
    let confirmed: Value = serde_json::from_str(&replay_json(
        &game_with_events(Value::Array(confirmed_events)).to_string(),
    ))
    .unwrap();
    assert_eq!(confirmed["ok"], true);
    assert_eq!(confirmed["value"]["players"][4]["alive"], false);
    assert_eq!(confirmed["value"]["currentStep"]["id"], "day:toNight");

    let undone: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();
    assert_eq!(undone["ok"], true);
    assert_eq!(undone["value"]["players"][4]["alive"], true);
    assert_eq!(undone["value"]["currentStep"]["id"], "day:executionDeath");
}

#[test]
fn trouble_brewing_rejects_execution_survival_as_a_proposal_or_imported_event() {
    let (game, _) = confirmed_execution_game();
    let command = json!({
        "type": "confirmStep",
        "payload": {
            "stepId": "day:executionDeath",
            "input": { "died": false }
        }
    });
    let proposal: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();
    assert_eq!(proposal["ok"], false);
    assert!(proposal.get("value").is_none());

    let mut imported_events = game["game"]["events"].as_array().unwrap().clone();
    imported_events.push(json!({
        "id": "evt-day-execution-survival",
        "type": "executionSurvivalConfirmed",
        "phase": "day",
        "payload": { "stepId": "day:executionDeath", "playerId": "player-5" },
        "summary": "처형 후 생존 확정",
        "createdAt": "2026-01-01T00:00:00.000Z"
    }));
    let imported: Value = serde_json::from_str(&replay_json(
        &game_with_events(Value::Array(imported_events)).to_string(),
    ))
    .unwrap();
    assert_eq!(imported["ok"], false);
    assert_eq!(imported["error"]["code"], "REPLAY_FAILED");
    assert!(imported.get("value").is_none());
}

#[test]
fn replay_rejects_execution_confirmed_with_a_false_execute_flag() {
    assert_replay_rejects_execution_event("executionConfirmed", false, Some("player-5"));
}

#[test]
fn replay_rejects_execution_confirmed_for_a_player_other_than_the_candidate() {
    assert_replay_rejects_execution_event("executionConfirmed", true, Some("player-4"));
}

#[test]
fn replay_rejects_execution_confirmed_without_a_player() {
    assert_replay_rejects_execution_event("executionConfirmed", true, None);
}

#[test]
fn replay_rejects_no_execution_confirmed_with_a_true_execute_flag() {
    assert_replay_rejects_execution_event("noExecutionConfirmed", true, None);
}

#[test]
fn replay_rejects_no_execution_confirmed_with_a_player() {
    assert_replay_rejects_execution_event("noExecutionConfirmed", false, Some("player-5"));
}

#[test]
fn replay_allows_no_execution_even_when_an_execution_candidate_exists() {
    let game = execution_ready_game();
    let mut events = game["game"]["events"].as_array().unwrap().clone();
    events.push(execution_event("noExecutionConfirmed", false, None));

    let actual: Value = serde_json::from_str(&replay_json(
        &game_with_events(Value::Array(events)).to_string(),
    ))
    .unwrap();
    assert_eq!(actual["ok"], true, "valid no-execution failed as {actual}");
    assert_eq!(actual["value"]["currentStep"]["id"], "day:toNight");
}

#[test]
fn replay_rejects_execution_confirmed_using_the_current_nomination_step_id() {
    assert_replay_rejects_execution_event_at_current_nomination(
        "executionConfirmed",
        true,
        Some("player-5"),
    );
}

#[test]
fn replay_rejects_no_execution_confirmed_using_the_current_nomination_step_id() {
    assert_replay_rejects_execution_event_at_current_nomination(
        "noExecutionConfirmed",
        false,
        None,
    );
}

#[test]
fn replay_rejects_execution_survival_for_a_player_dead_at_the_event_time() {
    let (game, _) = confirmed_execution_game();
    let mut events = game["game"]["events"].as_array().unwrap().clone();
    events.extend([
        death_event("player-5"),
        json!({
            "id": "evt-dead-player-survival",
            "type": "executionSurvivalConfirmed",
            "phase": "day",
            "payload": { "stepId": "day:executionDeath", "playerId": "player-5" },
            "summary": "이미 사망한 플레이어의 처형 후 생존",
            "createdAt": "2026-01-01T00:00:00.000Z"
        }),
    ]);

    let actual: Value = serde_json::from_str(&replay_json(
        &game_with_events(Value::Array(events)).to_string(),
    ))
    .unwrap();
    assert_eq!(actual["ok"], false);
    assert_eq!(actual["error"]["code"], "REPLAY_FAILED");
    assert!(actual.get("value").is_none());
}

#[test]
fn later_day_execution_death_step_keeps_the_cycle_prefix() {
    let mut events = day_events(
        setup_event_with_players(five_players()),
        &five_player_first_night_steps(),
        &[],
    );
    events.extend([
        nomination_event(1, "player-1", "player-5", 3),
        phase_event("phaseStepSkipped", "day:nomination:2"),
        no_execution_event("day:execution"),
        phase_event("phaseStepConfirmed", "day:toNight"),
        phase_event("phaseStepConfirmed", "night:imp"),
        phase_event("phaseStepConfirmed", "night:fortuneTeller"),
        phase_event("phaseStepConfirmed", "night:toDay"),
        day_cycle_phase_event("phaseStepConfirmed", "day2:announceDeaths"),
        day_cycle_phase_event("phaseStepConfirmed", "day2:whisper"),
        day_cycle_phase_event("phaseStepConfirmed", "day2:discussion"),
        nomination_event_for_step("day2:nomination:1", "player-1", "player-5", 3),
        day_cycle_phase_event("phaseStepSkipped", "day2:nomination:2"),
    ]);
    let game = game_with_events(Value::Array(events));
    let command = json!({
        "type": "confirmStep",
        "payload": {
            "stepId": "day2:execution",
            "input": { "execute": true }
        }
    });
    let proposal: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();
    assert_eq!(proposal["ok"], true, "proposal failed as {proposal}");
    let mut events = game["game"]["events"].as_array().unwrap().clone();
    events.push(proposal["value"]["event"].clone());
    let replayed: Value = serde_json::from_str(&replay_json(
        &game_with_events(Value::Array(events)).to_string(),
    ))
    .unwrap();

    assert_eq!(replayed["ok"], true, "replay failed as {replayed}");
    assert_eq!(
        replayed["value"]["currentStep"]["id"],
        "day2:executionDeath"
    );
}

#[test]
fn no_execution_requires_explicit_confirmation() {
    let game = game_with_events(json!([
        setup_event(),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event("phaseStepConfirmed", "firstNight:washerwoman"),
        phase_event("phaseStepConfirmed", "firstNight:chef"),
        phase_event("phaseStepConfirmed", "firstNight:empath"),
        phase_event("phaseStepConfirmed", "firstNight:fortuneTeller"),
        phase_event("phaseStepConfirmed", "firstNight:toDay"),
        phase_event("phaseStepConfirmed", "day:announceDeaths"),
        phase_event("phaseStepConfirmed", "day:whisper"),
        phase_event("phaseStepConfirmed", "day:discussion"),
        phase_event("phaseStepSkipped", "day:nomination:1")
    ]));
    let command = json!({
        "type": "confirmStep",
        "payload": {
            "stepId": "day:execution",
            "input": { "execute": false }
        }
    });

    let actual: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

    assert_eq!(actual["ok"], true);
    assert_eq!(actual["value"]["event"]["type"], "noExecutionConfirmed");

    let mut events = game["game"]["events"].as_array().unwrap().clone();
    events.push(actual["value"]["event"].clone());
    let replayed: Value = serde_json::from_str(&replay_json(
        &game_with_events(Value::Array(events)).to_string(),
    ))
    .unwrap();
    assert_eq!(replayed["ok"], true);
    assert_eq!(replayed["value"]["currentStep"]["id"], "day:toNight");
}

#[test]
fn nomination_preview_and_replay_share_tied_and_new_high_execution_standing() {
    for (existing, nomination_number, nominee_id, vote_count, expected) in [
        (
            vec![nomination_event(1, "player-1", "player-5", 5)],
            2,
            "player-6",
            5,
            json!({
                "executionVoteThreshold": 4,
                "highestVoteCount": 5,
                "executionCandidate": null
            }),
        ),
        (
            vec![
                nomination_event(1, "player-1", "player-5", 5),
                nomination_event(2, "player-2", "player-6", 3),
            ],
            3,
            "player-7",
            6,
            json!({
                "executionVoteThreshold": 4,
                "highestVoteCount": 6,
                "executionCandidate": { "nomineeId": "player-7", "voteCount": 6 }
            }),
        ),
    ] {
        let mut events = day_events(
            setup_event_with_players(seven_players()),
            &seven_player_first_night_steps(),
            &[],
        );
        events.extend(existing);
        let game = game_with_events(Value::Array(events));
        let voter_ids = (1..=vote_count)
            .map(|seat| format!("player-{seat}"))
            .collect::<Vec<_>>();
        let start_command = json!({
            "type": "confirmStep",
            "payload": {
                "stepId": format!("day:nomination:{nomination_number}"),
                "input": {
                    "nominatorId": format!("player-{nomination_number}"),
                    "nomineeId": nominee_id
                }
            }
        });
        let started: Value =
            serde_json::from_str(&propose_json(&game.to_string(), &start_command.to_string()))
                .unwrap();
        assert_eq!(started["ok"], true, "start failed as {started}");
        let mut started_events = game["game"]["events"].as_array().unwrap().clone();
        started_events.push(started["value"]["event"].clone());
        let started_game = game_with_events(Value::Array(started_events));
        let vote_command = json!({
            "type": "confirmStep",
            "payload": {
                "stepId": format!("day:nomination:{nomination_number}:vote"),
                "input": { "voterIds": voter_ids }
            }
        });
        let proposal: Value = serde_json::from_str(&propose_json(
            &started_game.to_string(),
            &vote_command.to_string(),
        ))
        .unwrap();
        assert_eq!(proposal["ok"], true, "proposal failed as {proposal}");
        assert_eq!(proposal["value"]["preview"]["executionStanding"], expected);

        let mut confirmed_events = started_game["game"]["events"].as_array().unwrap().clone();
        confirmed_events.push(proposal["value"]["event"].clone());
        let replayed: Value = serde_json::from_str(&replay_json(
            &game_with_events(Value::Array(confirmed_events)).to_string(),
        ))
        .unwrap();
        assert_eq!(replayed["ok"], true, "replay failed as {replayed}");
        assert_eq!(
            json!({
                "executionVoteThreshold": replayed["value"]["dayState"]["executionVoteThreshold"],
                "highestVoteCount": replayed["value"]["dayState"]["highestVoteCount"],
                "executionCandidate": replayed["value"]["dayState"]
                    .get("executionCandidate")
                    .cloned()
                    .unwrap_or(Value::Null)
            }),
            expected
        );
    }
}

#[test]
fn replay_exposes_representative_execution_vote_thresholds_with_a_minimum_of_one() {
    for (players, first_night_steps, dead_player_ids, expected) in [
        (five_players(), five_player_first_night_steps(), vec![], 3),
        (six_players(), six_player_first_night_steps(), vec![], 3),
        (seven_players(), seven_player_first_night_steps(), vec![], 4),
        (eight_players(), eight_player_first_night_steps(), vec![], 4),
        (
            five_players(),
            five_player_first_night_steps(),
            vec!["player-2", "player-3", "player-4", "player-5"],
            1,
        ),
        (
            five_players(),
            five_player_first_night_steps(),
            vec!["player-1", "player-2", "player-3", "player-4", "player-5"],
            1,
        ),
    ] {
        let game = day_game(players, &first_night_steps, &dead_player_ids);
        let actual: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();

        assert_eq!(
            actual["ok"], true,
            "candidate fixture failed to replay: {actual}"
        );
        assert_eq!(
            actual["value"]["dayState"]["executionVoteThreshold"], expected,
            "unexpected threshold with dead players {dead_player_ids:?}"
        );
    }
}

#[test]
fn replay_derives_top_ties_lower_ties_and_a_new_unique_high_from_all_nominations() {
    for (nominations, highest_vote_count, expected_candidate) in [
        (
            vec![
                nomination_event(1, "player-1", "player-5", 5),
                nomination_event(2, "player-2", "player-6", 5),
            ],
            5,
            Value::Null,
        ),
        (
            vec![
                nomination_event(1, "player-1", "player-5", 5),
                nomination_event(2, "player-2", "player-6", 3),
                nomination_event(3, "player-3", "player-7", 3),
            ],
            5,
            json!({ "nomineeId": "player-5", "voteCount": 5 }),
        ),
        (
            vec![
                nomination_event(1, "player-1", "player-5", 5),
                nomination_event(2, "player-2", "player-6", 5),
                nomination_event(3, "player-3", "player-7", 6),
            ],
            6,
            json!({ "nomineeId": "player-7", "voteCount": 6 }),
        ),
        (
            vec![
                nomination_event(1, "player-1", "player-5", 3),
                nomination_event(2, "player-2", "player-6", 3),
            ],
            3,
            Value::Null,
        ),
    ] {
        let mut events = day_events(
            setup_event_with_players(seven_players()),
            &seven_player_first_night_steps(),
            &[],
        );
        events.extend(nominations);
        let actual: Value = serde_json::from_str(&replay_json(
            &game_with_events(Value::Array(events)).to_string(),
        ))
        .unwrap();

        assert_eq!(
            actual["ok"], true,
            "candidate fixture failed to replay: {actual}"
        );
        assert_eq!(
            actual["value"]["dayState"]["highestVoteCount"],
            highest_vote_count
        );
        assert_eq!(
            actual["value"]["dayState"]
                .get("executionCandidate")
                .cloned()
                .unwrap_or(Value::Null),
            expected_candidate
        );
    }
}

#[test]
fn replay_rejects_invalid_nomination_integrity_instead_of_returning_partial_state() {
    let invalid_nomination_sets = [
        vec![
            nomination_event_with_ghost_spending(
                1,
                "player-1",
                "player-4",
                &["player-1", "player-2", "player-3"],
                &["player-2"],
            ),
            nomination_event_with_ghost_spending(
                2,
                "player-1",
                "player-5",
                &["player-1", "player-3"],
                &[],
            ),
        ],
        vec![
            nomination_event_with_ghost_spending(
                1,
                "player-1",
                "player-5",
                &["player-1", "player-2", "player-3"],
                &["player-2"],
            ),
            nomination_event_with_ghost_spending(
                2,
                "player-3",
                "player-5",
                &["player-1", "player-3"],
                &[],
            ),
        ],
        vec![nomination_event_with_ghost_spending(
            1,
            "player-2",
            "player-5",
            &["player-1", "player-3"],
            &[],
        )],
        vec![nomination_event_with_ghost_spending(
            1,
            "player-99",
            "player-5",
            &["player-1", "player-3"],
            &[],
        )],
        vec![nomination_event_with_ghost_spending(
            1,
            "player-1",
            "player-99",
            &["player-1", "player-3"],
            &[],
        )],
        vec![nomination_event_with_ghost_spending(
            1,
            "player-1",
            "player-5",
            &["player-1", "player-1"],
            &[],
        )],
        vec![nomination_event_with_ghost_spending(
            1,
            "player-1",
            "player-5",
            &["player-1", "player-99"],
            &[],
        )],
        vec![nomination_event_without_voters(1, "player-1", "player-5")],
        vec![nomination_event_with_extra_vote_count(
            1, "player-1", "player-5",
        )],
        vec![nomination_event_with_wrong_phase(1, "player-1", "player-5")],
        vec![nomination_event_with_ghost_spending(
            1,
            "player-1",
            "player-5",
            &["player-1", "player-3"],
            &["player-2"],
        )],
        vec![
            nomination_event_with_ghost_spending(
                1,
                "player-1",
                "player-5",
                &["player-1", "player-2"],
                &["player-2"],
            ),
            nomination_event_with_ghost_spending(
                2,
                "player-3",
                "player-4",
                &["player-2", "player-3"],
                &["player-2"],
            ),
        ],
    ];

    for nominations in invalid_nomination_sets {
        let mut events = five_player_day_events_with_dead_player_two();
        events.extend(nominations);
        let actual: Value = serde_json::from_str(&replay_json(
            &game_with_events(Value::Array(events)).to_string(),
        ))
        .unwrap();

        assert_eq!(actual["ok"], false, "invalid log replayed as {actual}");
        assert!(
            actual.get("value").is_none(),
            "partial replay leaked as {actual}"
        );
    }
}

#[test]
fn replay_rejects_nomination_before_discussion_is_confirmed() {
    let mut events = day_events(
        setup_event_with_players(five_players()),
        &five_player_first_night_steps(),
        &[],
    );
    events.retain(|event| event["payload"]["stepId"] != "day:discussion");
    events.push(nomination_event(1, "player-1", "player-5", 3));

    let actual: Value = serde_json::from_str(&replay_json(
        &game_with_events(Value::Array(events)).to_string(),
    ))
    .unwrap();

    assert_eq!(actual["ok"], false);
    assert!(actual.get("value").is_none());
}

#[test]
fn proposal_rejects_repeated_nominators_nominees_and_dead_nominators() {
    let invalid_commands = [
        ("player-1", "player-4"),
        ("player-3", "player-5"),
        ("player-2", "player-4"),
    ];

    for (nominator_id, nominee_id) in invalid_commands {
        let mut events = five_player_day_events_with_dead_player_two();
        events.push(nomination_event_with_ghost_spending(
            1,
            "player-1",
            "player-5",
            &["player-1", "player-2", "player-3"],
            &["player-2"],
        ));
        let game = game_with_events(Value::Array(events));
        let command = json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "day:nomination:2",
                "input": {
                    "nominatorId": nominator_id,
                    "nomineeId": nominee_id,
                    "voterIds": ["player-1", "player-3"]
                }
            }
        });
        let actual: Value =
            serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

        assert_eq!(
            actual["ok"], false,
            "invalid proposal succeeded as {actual}"
        );
    }
}

#[test]
fn proposal_rejects_a_dead_nominee_with_invalid_step_input() {
    let game = game_with_events(Value::Array(five_player_day_events_with_dead_player_two()));
    let command = json!({
        "type": "confirmStep",
        "payload": {
            "stepId": "day:nomination:1",
            "input": {
                "nominatorId": "player-1",
                "nomineeId": "player-2",
                "voterIds": ["player-1", "player-3"]
            }
        }
    });

    let actual: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

    assert_eq!(actual["ok"], false, "dead nominee was accepted as {actual}");
    assert_eq!(actual["error"]["code"], "INVALID_STEP_INPUT");
}

#[test]
fn replay_rejects_a_dead_nominee_without_returning_partial_state() {
    let mut events = five_player_day_events_with_dead_player_two();
    events.push(nomination_event_with_ghost_spending(
        1,
        "player-1",
        "player-2",
        &["player-1", "player-3"],
        &[],
    ));

    let actual: Value = serde_json::from_str(&replay_json(
        &game_with_events(Value::Array(events)).to_string(),
    ))
    .unwrap();

    assert_eq!(actual["ok"], false, "dead nominee replayed as {actual}");
    assert_eq!(actual["error"]["code"], "REPLAY_FAILED");
    assert!(
        actual.get("value").is_none(),
        "partial replay leaked as {actual}"
    );
}

#[test]
fn day_state_exposes_independent_nomination_role_eligibility_in_seat_order() {
    let mut events = five_player_day_events_with_dead_player_two();
    events.push(nomination_event_with_ghost_spending(
        1,
        "player-1",
        "player-5",
        &["player-1", "player-3"],
        &[],
    ));
    let game = game_with_events(Value::Array(events));

    let replayed: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();

    assert_eq!(
        replayed["ok"], true,
        "valid nomination failed as {replayed}"
    );
    assert_eq!(
        replayed["value"]["dayState"]["eligibleNominatorIds"],
        json!(["player-3", "player-4", "player-5"])
    );
    assert_eq!(
        replayed["value"]["dayState"]["eligibleNomineeIds"],
        json!(["player-1", "player-3", "player-4"])
    );

    let swapped_roles = json!({
        "type": "confirmStep",
        "payload": {
            "stepId": "day:nomination:2",
            "input": {
                "nominatorId": "player-5",
                "nomineeId": "player-1",
                "voterIds": []
            }
        }
    });
    let proposal: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &swapped_roles.to_string())).unwrap();
    assert_eq!(
        proposal["ok"], true,
        "independent roles failed as {proposal}"
    );
}

#[test]
fn self_nomination_is_allowed_and_uses_both_roles_for_the_day() {
    let game = game_with_events(Value::Array(five_player_day_events_with_dead_player_two()));
    let command = json!({
        "type": "confirmStep",
        "payload": {
            "stepId": "day:nomination:1",
            "input": {
                "nominatorId": "player-3",
                "nomineeId": "player-3",
                "voterIds": []
            }
        }
    });

    let proposal: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();
    assert_eq!(proposal["ok"], true, "self-nomination failed as {proposal}");

    let mut events = game["game"]["events"].as_array().unwrap().clone();
    events.push(proposal["value"]["event"].clone());
    let replayed: Value = serde_json::from_str(&replay_json(
        &game_with_events(Value::Array(events)).to_string(),
    ))
    .unwrap();
    assert_eq!(replayed["ok"], true);
    assert_eq!(
        replayed["value"]["dayState"]["eligibleNominatorIds"],
        json!(["player-1", "player-4", "player-5"])
    );
    assert_eq!(
        replayed["value"]["dayState"]["eligibleNomineeIds"],
        json!(["player-1", "player-4", "player-5"])
    );
}

#[test]
fn nomination_role_eligibility_resets_on_the_next_day() {
    let mut events = day_events(
        setup_event_with_players(five_players()),
        &five_player_first_night_steps(),
        &[],
    );
    events.extend([
        nomination_event_with_ghost_spending(1, "player-1", "player-5", &[], &[]),
        phase_event("phaseStepSkipped", "day:nomination:2"),
        no_execution_event("day:execution"),
        phase_event("phaseStepConfirmed", "day:toNight"),
        phase_event("phaseStepConfirmed", "night:imp"),
        phase_event("phaseStepConfirmed", "night:fortuneTeller"),
        phase_event("phaseStepConfirmed", "night:toDay"),
        day_cycle_phase_event("phaseStepConfirmed", "day2:announceDeaths"),
        day_cycle_phase_event("phaseStepConfirmed", "day2:whisper"),
        day_cycle_phase_event("phaseStepConfirmed", "day2:discussion"),
    ]);

    let actual: Value = serde_json::from_str(&replay_json(
        &game_with_events(Value::Array(events)).to_string(),
    ))
    .unwrap();
    let all_players = json!(["player-1", "player-2", "player-3", "player-4", "player-5"]);

    assert_eq!(actual["ok"], true, "next Day failed to replay as {actual}");
    assert_eq!(actual["value"]["currentStep"]["id"], "day2:nomination:1");
    assert_eq!(
        actual["value"]["dayState"]["eligibleNominatorIds"],
        all_players
    );
    assert_eq!(
        actual["value"]["dayState"]["eligibleNomineeIds"],
        all_players
    );
}

fn day_cycle_phase_event(event_type: &str, step_id: &str) -> Value {
    let mut event = phase_event(event_type, step_id);
    event["phase"] = json!("day");
    event
}

fn confirmed_execution_game() -> (Value, Value) {
    let game = execution_ready_game();
    let command = json!({
        "type": "confirmStep",
        "payload": {
            "stepId": "day:execution",
            "input": { "execute": true }
        }
    });
    let proposal: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();
    assert_eq!(proposal["ok"], true);
    let mut events = game["game"]["events"].as_array().unwrap().clone();
    events.push(proposal["value"]["event"].clone());
    let game = game_with_events(Value::Array(events));
    let replayed: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();
    (game, replayed)
}

fn execution_ready_game() -> Value {
    let mut events = day_events(
        setup_event_with_players(five_players()),
        &five_player_first_night_steps(),
        &[],
    );
    events.extend([
        nomination_event(1, "player-1", "player-5", 3),
        phase_event("phaseStepSkipped", "day:nomination:2"),
    ]);
    game_with_events(Value::Array(events))
}

fn assert_replay_rejects_execution_event_at_current_nomination(
    event_type: &str,
    execute: bool,
    player_id: Option<&str>,
) {
    let mut events = day_events(
        setup_event_with_players(five_players()),
        &five_player_first_night_steps(),
        &[],
    );
    events.extend([
        nomination_event(1, "player-1", "player-5", 3),
        execution_event_for_step(event_type, "day:nomination:2", execute, player_id),
    ]);

    let actual: Value = serde_json::from_str(&replay_json(
        &game_with_events(Value::Array(events)).to_string(),
    ))
    .unwrap();
    assert_eq!(
        actual["ok"], false,
        "{event_type} incorrectly completed the nomination step: {actual}"
    );
    assert_eq!(actual["error"]["code"], "REPLAY_FAILED");
    assert!(actual.get("value").is_none());
}

fn assert_replay_rejects_execution_event(event_type: &str, execute: bool, player_id: Option<&str>) {
    let game = execution_ready_game();
    let mut events = game["game"]["events"].as_array().unwrap().clone();
    events.push(execution_event(event_type, execute, player_id));

    let actual: Value = serde_json::from_str(&replay_json(
        &game_with_events(Value::Array(events)).to_string(),
    ))
    .unwrap();
    assert_eq!(
        actual["ok"], false,
        "manipulated {event_type} execute={execute} player={player_id:?} replayed as {actual}"
    );
    assert_eq!(actual["error"]["code"], "REPLAY_FAILED");
    assert!(actual.get("value").is_none());
}

fn execution_event(event_type: &str, execute: bool, player_id: Option<&str>) -> Value {
    execution_event_for_step(event_type, "day:execution", execute, player_id)
}

fn execution_event_for_step(
    event_type: &str,
    step_id: &str,
    execute: bool,
    player_id: Option<&str>,
) -> Value {
    json!({
        "id": format!("evt-manipulated-{event_type}-{execute}-{player_id:?}"),
        "type": event_type,
        "phase": "day",
        "payload": {
            "stepId": step_id,
            "input": { "execute": execute, "playerId": player_id }
        },
        "summary": "조작된 처형 이벤트",
        "createdAt": "2026-01-01T00:00:00.000Z"
    })
}

fn confirm_and_replay(game: Value, step_id: &str) -> (Value, Value) {
    let command = json!({
        "type": "confirmStep",
        "payload": { "stepId": step_id }
    });
    let proposal: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();
    assert_eq!(proposal["ok"], true);
    let mut events = game["game"]["events"].as_array().unwrap().clone();
    events.push(proposal["value"]["event"].clone());
    let game = game_with_events(Value::Array(events));
    let replayed: Value = serde_json::from_str(&replay_json(&game.to_string())).unwrap();
    (game, replayed)
}

fn day_game(players: Value, first_night_steps: &[&str], dead_player_ids: &[&str]) -> Value {
    game_with_events(Value::Array(day_events(
        setup_event_with_players(players),
        first_night_steps,
        dead_player_ids,
    )))
}

fn day_events(setup: Value, first_night_steps: &[&str], dead_player_ids: &[&str]) -> Vec<Value> {
    let mut events = vec![setup];
    events.extend(
        dead_player_ids
            .iter()
            .map(|player_id| death_event(player_id)),
    );
    events.extend(
        first_night_steps
            .iter()
            .map(|step_id| phase_event("phaseStepConfirmed", step_id)),
    );
    events.push(phase_event("phaseStepConfirmed", "day:announceDeaths"));
    events.push(phase_event("phaseStepConfirmed", "day:whisper"));
    events.push(phase_event("phaseStepConfirmed", "day:discussion"));
    events
}

fn five_player_day_events_with_dead_player_two() -> Vec<Value> {
    day_events(
        setup_event_with_players(five_players()),
        &five_player_first_night_steps(),
        &["player-2"],
    )
}

fn nomination_event(
    number: usize,
    nominator_id: &str,
    nominee_id: &str,
    vote_count: usize,
) -> Value {
    let voter_ids = (1..=vote_count)
        .map(|seat| format!("player-{seat}"))
        .collect::<Vec<_>>();
    nomination_event_with_ghost_spending(
        number,
        nominator_id,
        nominee_id,
        &voter_ids.iter().map(String::as_str).collect::<Vec<_>>(),
        &[],
    )
}

fn nomination_event_for_step(
    step_id: &str,
    nominator_id: &str,
    nominee_id: &str,
    vote_count: usize,
) -> Value {
    let voter_ids = (1..=vote_count)
        .map(|seat| format!("player-{seat}"))
        .collect::<Vec<_>>();
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

fn nomination_event_with_ghost_spending(
    number: usize,
    nominator_id: &str,
    nominee_id: &str,
    voter_ids: &[&str],
    ghost_vote_spent_player_ids: &[&str],
) -> Value {
    let step_id = format!("day:nomination:{number}");
    json!({
        "id": format!("evt-{step_id}"),
        "type": "nominationVoteConfirmed",
        "phase": "day",
        "payload": {
            "stepId": step_id,
            "nominatorId": nominator_id,
            "nomineeId": nominee_id,
            "voterIds": voter_ids,
            "ghostVoteSpentPlayerIds": ghost_vote_spent_player_ids
        },
        "summary": "지목 투표 확정",
        "createdAt": "2026-01-01T00:00:00.000Z"
    })
}

fn nomination_event_without_voters(number: usize, nominator_id: &str, nominee_id: &str) -> Value {
    let mut event = nomination_event_with_ghost_spending(
        number,
        nominator_id,
        nominee_id,
        &["player-1", "player-3"],
        &[],
    );
    event["payload"].as_object_mut().unwrap().remove("voterIds");
    event
}

fn nomination_event_with_extra_vote_count(
    number: usize,
    nominator_id: &str,
    nominee_id: &str,
) -> Value {
    let mut event = nomination_event_with_ghost_spending(
        number,
        nominator_id,
        nominee_id,
        &["player-1", "player-3"],
        &[],
    );
    event["payload"]["voteCount"] = json!(2);
    event
}

fn nomination_event_with_wrong_phase(number: usize, nominator_id: &str, nominee_id: &str) -> Value {
    let mut event = nomination_event_with_ghost_spending(
        number,
        nominator_id,
        nominee_id,
        &["player-1", "player-3"],
        &[],
    );
    event["phase"] = json!("night");
    event
}

fn five_player_first_night_steps() -> Vec<&'static str> {
    vec![
        "firstNight:demonInfo",
        "firstNight:washerwoman",
        "firstNight:chef",
        "firstNight:empath",
        "firstNight:fortuneTeller",
        "firstNight:toDay",
    ]
}

fn six_player_first_night_steps() -> Vec<&'static str> {
    five_player_first_night_steps()
}

fn seven_player_first_night_steps() -> Vec<&'static str> {
    five_player_first_night_steps()
}

fn eight_player_first_night_steps() -> Vec<&'static str> {
    five_player_first_night_steps()
}

fn five_players() -> Value {
    json!([
        { "id": "player-1", "seat": 1, "name": "Ada", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
        { "id": "player-2", "seat": 2, "name": "Bert", "actualCharacter": "chef", "shownCharacter": "chef" },
        { "id": "player-3", "seat": 3, "name": "Cora", "actualCharacter": "empath", "shownCharacter": "empath" },
        { "id": "player-4", "seat": 4, "name": "Dev", "actualCharacter": "fortuneTeller", "shownCharacter": "fortuneTeller" },
        { "id": "player-5", "seat": 5, "name": "Eve", "actualCharacter": "imp", "shownCharacter": "imp" }
    ])
}

fn six_players() -> Value {
    json!([
        { "id": "player-1", "seat": 1, "name": "Ada", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
        { "id": "player-2", "seat": 2, "name": "Bert", "actualCharacter": "chef", "shownCharacter": "chef" },
        { "id": "player-3", "seat": 3, "name": "Cora", "actualCharacter": "empath", "shownCharacter": "empath" },
        { "id": "player-4", "seat": 4, "name": "Dev", "actualCharacter": "fortuneTeller", "shownCharacter": "fortuneTeller" },
        { "id": "player-5", "seat": 5, "name": "Eve", "actualCharacter": "recluse", "shownCharacter": "recluse" },
        { "id": "player-6", "seat": 6, "name": "Fay", "actualCharacter": "imp", "shownCharacter": "imp" }
    ])
}

fn seven_players() -> Value {
    json!([
        { "id": "player-1", "seat": 1, "name": "Ada", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
        { "id": "player-2", "seat": 2, "name": "Bert", "actualCharacter": "chef", "shownCharacter": "chef" },
        { "id": "player-3", "seat": 3, "name": "Cora", "actualCharacter": "empath", "shownCharacter": "empath" },
        { "id": "player-4", "seat": 4, "name": "Dev", "actualCharacter": "fortuneTeller", "shownCharacter": "fortuneTeller" },
        { "id": "player-5", "seat": 5, "name": "Eve", "actualCharacter": "recluse", "shownCharacter": "recluse" },
        { "id": "player-6", "seat": 6, "name": "Fay", "actualCharacter": "saint", "shownCharacter": "saint" },
        { "id": "player-7", "seat": 7, "name": "Gus", "actualCharacter": "imp", "shownCharacter": "imp" }
    ])
}

fn eight_players() -> Value {
    json!([
        { "id": "player-1", "seat": 1, "name": "Ada", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
        { "id": "player-2", "seat": 2, "name": "Bert", "actualCharacter": "chef", "shownCharacter": "chef" },
        { "id": "player-3", "seat": 3, "name": "Cora", "actualCharacter": "empath", "shownCharacter": "empath" },
        { "id": "player-4", "seat": 4, "name": "Dev", "actualCharacter": "fortuneTeller", "shownCharacter": "fortuneTeller" },
        { "id": "player-5", "seat": 5, "name": "Eve", "actualCharacter": "recluse", "shownCharacter": "recluse" },
        { "id": "player-6", "seat": 6, "name": "Fay", "actualCharacter": "saint", "shownCharacter": "saint" },
        { "id": "player-7", "seat": 7, "name": "Gus", "actualCharacter": "soldier", "shownCharacter": "soldier" },
        { "id": "player-8", "seat": 8, "name": "Hana", "actualCharacter": "imp", "shownCharacter": "imp" }
    ])
}

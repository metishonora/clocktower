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
        "nominationVote"
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
    let command = json!({
        "type": "confirmStep",
        "payload": {
            "stepId": "day:nomination:1",
            "input": {
                "nominatorId": "player-1",
                "nomineeId": "player-5",
                "voterIds": ["player-1", "player-2", "player-3"]
            }
        }
    });

    let proposal: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

    assert_eq!(proposal["ok"], true);
    assert_eq!(
        proposal["value"]["event"]["type"],
        "nominationVoteConfirmed"
    );
    assert_eq!(
        proposal["value"]["event"]["payload"],
        json!({
            "stepId": "day:nomination:1",
            "nominatorId": "player-1",
            "nomineeId": "player-5",
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

    let mut events = game["game"]["events"].as_array().unwrap().clone();
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
        "summary": "지명 투표 확정",
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

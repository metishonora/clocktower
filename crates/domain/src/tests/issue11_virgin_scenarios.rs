use super::support::*;
use crate::*;
use serde_json::{json, Value};

#[test]
fn first_townsfolk_nomination_spends_virgin_and_creates_distinct_death_follow_up() {
    let game = virgin_day_game();
    let before = replay(&game);
    assert_eq!(before["ok"], true, "day setup failed as {before}");
    assert_eq!(before["value"]["currentStep"]["id"], "day:nomination:1");
    assert_eq!(
        before["value"]["currentStep"]["requiredInput"]["kind"],
        "nomination"
    );
    assert_eq!(
        before["value"]["ruleState"]["virginAbility"],
        json!({ "actorPlayerId": "player-3", "spent": false })
    );

    let proposal = propose(
        &game,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "day:nomination:1",
                "input": {
                    "nominatorId": "player-1",
                    "nomineeId": "player-3"
                }
            }
        }),
    );
    assert_eq!(proposal["ok"], true, "proposal failed as {proposal}");
    assert_eq!(proposal["value"]["event"]["type"], "nominationStarted");
    assert_eq!(
        proposal["value"]["event"]["payload"],
        json!({
            "stepId": "day:nomination:1",
            "nominatorId": "player-1",
            "nomineeId": "player-3",
            "registrationJudgments": [],
            "virginResolution": {
                "kind": "spentAndNominatorExecuted",
                "virginPlayerId": "player-3",
                "impairmentContext": { "kind": "healthy" }
            }
        })
    );

    let confirmed = replay_with_event(&game, proposal["value"]["event"].clone());
    assert_eq!(confirmed["ok"], true, "replay failed as {confirmed}");
    assert_eq!(
        confirmed["value"]["currentStep"]["id"],
        "day:nomination:1:virginDeath"
    );
    assert_eq!(
        confirmed["value"]["currentStep"]["stepType"],
        "executionDeath"
    );
    assert_eq!(confirmed["value"]["currentStep"]["playerId"], "player-1");
    assert_eq!(confirmed["value"]["players"][0]["alive"], true);
    assert_eq!(
        confirmed["value"]["ruleState"]["virginAbility"],
        json!({
            "actorPlayerId": "player-3",
            "spent": true,
            "spentByNominationEventId": proposal["value"]["event"]["id"]
        })
    );
}

#[test]
fn spy_registration_is_per_nomination_and_can_trigger_the_virgin() {
    let game = virgin_day_game();
    let before = replay(&game);
    assert_eq!(
        before["value"]["currentStep"]["requiredInput"]["playerRegistrationOptions"],
        json!([{ "playerId": "player-4", "registeredAs": "townsfolk" }])
    );
    let proposal = propose(
        &game,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "day:nomination:1",
                "input": {
                    "nominatorId": "player-4",
                    "nomineeId": "player-3"
                },
                "registrationJudgments": [{
                    "playerId": "player-4",
                    "registeredAs": "townsfolk"
                }]
            }
        }),
    );

    assert_eq!(proposal["ok"], true, "proposal failed as {proposal}");
    assert_eq!(
        proposal["value"]["event"]["payload"]["registrationJudgments"],
        json!([{ "playerId": "player-4", "registeredAs": "townsfolk" }])
    );
    assert_eq!(
        proposal["value"]["event"]["payload"]["virginResolution"]["kind"],
        "spentAndNominatorExecuted"
    );
}

#[test]
fn non_townsfolk_nomination_spends_virgin_then_links_a_separate_vote() {
    let game = virgin_day_game();
    let started = propose(
        &game,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "day:nomination:1",
                "input": {
                    "nominatorId": "player-5",
                    "nomineeId": "player-3"
                }
            }
        }),
    );
    assert_eq!(started["ok"], true, "proposal failed as {started}");
    assert_eq!(
        started["value"]["event"]["payload"]["virginResolution"]["kind"],
        "spentNoExecution"
    );

    let game = with_event(&game, started["value"]["event"].clone());
    let pending_vote = replay(&game);
    assert_eq!(pending_vote["ok"], true, "replay failed as {pending_vote}");
    assert_eq!(
        pending_vote["value"]["currentStep"]["id"],
        "day:nomination:1:vote"
    );
    assert_eq!(
        pending_vote["value"]["currentStep"]["requiredInput"]["kind"],
        "nominationVote"
    );
    assert_eq!(
        pending_vote["value"]["dayState"]["activeNomination"],
        json!({
            "eventId": started["value"]["event"]["id"],
            "stepId": "day:nomination:1",
            "nominatorId": "player-5",
            "nomineeId": "player-3"
        })
    );
    assert!(!pending_vote["value"]["dayState"]["eligibleNominatorIds"]
        .as_array()
        .unwrap()
        .contains(&json!("player-5")));
    assert!(!pending_vote["value"]["dayState"]["eligibleNomineeIds"]
        .as_array()
        .unwrap()
        .contains(&json!("player-3")));

    let vote = propose(
        &game,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "day:nomination:1:vote",
                "input": { "voterIds": ["player-1", "player-2", "player-3"] }
            }
        }),
    );
    assert_eq!(vote["ok"], true, "vote proposal failed as {vote}");
    assert_eq!(vote["value"]["event"]["type"], "nominationVoteConfirmed");
    assert_eq!(
        vote["value"]["event"]["payload"],
        json!({
            "stepId": "day:nomination:1:vote",
            "nominationEventId": started["value"]["event"]["id"],
            "voterIds": ["player-1", "player-2", "player-3"],
            "ghostVoteSpentPlayerIds": []
        })
    );

    let after_vote = replay_with_event(&game, vote["value"]["event"].clone());
    assert_eq!(after_vote["ok"], true, "vote replay failed as {after_vote}");
    assert_eq!(after_vote["value"]["currentStep"]["id"], "day:nomination:2");
    assert!(after_vote["value"]["dayState"]
        .get("activeNomination")
        .is_none());
    assert_eq!(
        after_vote["value"]["dayState"]["nominations"][0]["nominatorId"],
        "player-5"
    );
}

#[test]
fn undertaker_learns_the_nominator_killed_by_the_virgin() {
    let game = virgin_day_game();
    let started = propose(
        &game,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "day:nomination:1",
                "input": { "nominatorId": "player-1", "nomineeId": "player-3" }
            }
        }),
    );
    let game = with_event(&game, started["value"]["event"].clone());
    let death = propose(
        &game,
        json!({
            "type": "confirmStep",
            "payload": { "stepId": "day:nomination:1:virginDeath", "input": { "died": true } }
        }),
    );
    assert_eq!(death["ok"], true, "death proposal failed as {death}");
    let game = with_event(&game, death["value"]["event"].clone());
    let to_night = propose(
        &game,
        json!({ "type": "confirmStep", "payload": { "stepId": "day:toNight" } }),
    );
    assert_eq!(
        to_night["ok"], true,
        "night transition failed as {to_night}"
    );
    let game = with_event(&game, to_night["value"]["event"].clone());
    let imp = propose(
        &game,
        json!({ "type": "skipStep", "payload": { "stepId": "night:imp" } }),
    );
    assert_eq!(imp["ok"], true, "Imp skip failed as {imp}");
    let game = with_event(&game, imp["value"]["event"].clone());
    let after = replay(&game);

    assert_eq!(after["ok"], true, "replay failed as {after}");
    assert_eq!(after["value"]["currentStep"]["id"], "night:undertaker");
    assert_eq!(
        after["value"]["currentStep"]["informationPrompt"]["targetChecks"][0]["targetPlayerIds"],
        json!(["player-1"])
    );
    assert_eq!(
        after["value"]["currentStep"]["informationPrompt"]["targetChecks"][0]["computedResult"],
        json!({ "kind": "character", "characterId": "washerwoman" })
    );
}

fn virgin_day_game() -> Value {
    game_with_events(json!([
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Washer", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
            { "id": "player-2", "seat": 2, "name": "Undertaker", "actualCharacter": "undertaker", "shownCharacter": "undertaker" },
            { "id": "player-3", "seat": 3, "name": "Virgin", "actualCharacter": "virgin", "shownCharacter": "virgin" },
            { "id": "player-4", "seat": 4, "name": "Spy", "actualCharacter": "spy", "shownCharacter": "spy" },
            { "id": "player-5", "seat": 5, "name": "Imp", "actualCharacter": "imp", "shownCharacter": "imp" }
        ])),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event("phaseStepSkipped", "firstNight:washerwoman"),
        phase_event("phaseStepSkipped", "firstNight:spy"),
        phase_event("phaseStepConfirmed", "firstNight:toDay"),
        phase_event("phaseStepConfirmed", "day:announceDeaths"),
        phase_event("phaseStepConfirmed", "day:whisper"),
        phase_event("phaseStepConfirmed", "day:discussion")
    ]))
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

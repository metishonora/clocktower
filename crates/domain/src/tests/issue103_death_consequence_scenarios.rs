use crate::{propose_json, replay_json};
use serde_json::{json, Value};

fn setup_event() -> Value {
    json!({
        "id": "setup-issue-103",
        "type": "setupConfirmed",
        "phase": "setup",
        "payload": { "players": [
            { "id": "player-1", "seat": 1, "name": "Sweetheart", "actualCharacter": "sweetheart", "shownCharacter": "sweetheart" },
            { "id": "player-2", "seat": 2, "name": "Barber", "actualCharacter": "barber", "shownCharacter": "barber" },
            { "id": "player-3", "seat": 3, "name": "Klutz", "actualCharacter": "klutz", "shownCharacter": "klutz" },
            { "id": "player-4", "seat": 4, "name": "Clockmaker", "actualCharacter": "clockmaker", "shownCharacter": "clockmaker" },
            { "id": "player-5", "seat": 5, "name": "Savant", "actualCharacter": "savant", "shownCharacter": "savant" },
            { "id": "player-6", "seat": 6, "name": "Pit-Hag", "actualCharacter": "pitHag", "shownCharacter": "pitHag" },
            { "id": "player-7", "seat": 7, "name": "Vortox", "actualCharacter": "vortox", "shownCharacter": "vortox" }
        ] },
        "summary": "issue 103 setup",
        "createdAt": "2026-07-28T00:00:00.000Z"
    })
}

fn game(events: Vec<Value>) -> Value {
    json!({
        "schemaVersion": 3,
        "game": {
            "id": "game-issue-103",
            "name": "Death consequences",
            "scriptId": "sectsAndViolets",
            "createdAt": "2026-07-28T00:00:00.000Z",
            "updatedAt": "2026-07-28T00:00:00.000Z",
            "events": events
        }
    })
}

fn replay(events: &[Value]) -> Value {
    serde_json::from_str(&replay_json(&game(events.to_vec()).to_string())).unwrap()
}

fn propose(events: &[Value], command: Value) -> Value {
    serde_json::from_str(&propose_json(
        &game(events.to_vec()).to_string(),
        &command.to_string(),
    ))
    .unwrap()
}

fn append(events: &mut Vec<Value>, command: Value) -> Value {
    let proposal = propose(events, command);
    assert_eq!(proposal["ok"], true, "proposal failed: {proposal}");
    events.push(proposal["value"]["event"].clone());
    proposal
}

fn default_command(state: &Value, demon_target: &str) -> Value {
    let step = &state["value"]["currentStep"];
    let step_id = step["id"].as_str().expect("step id");
    match step["requiredInput"]["kind"].as_str().unwrap_or("none") {
        "nomination" => json!({ "type": "skipStep", "payload": { "stepId": step_id } }),
        "executionDecision" => {
            json!({ "type": "confirmStep", "payload": { "stepId": step_id, "input": { "execute": false } } })
        }
        "characterTransformation" => json!({
            "type": "confirmStep",
            "payload": { "stepId": step_id, "input": { "playerIds": ["player-6"], "characterIds": ["pitHag"] } }
        }),
        "playerIds" if step_id.contains(":demon:") => json!({
            "type": "confirmStep",
            "payload": { "stepId": step_id, "input": { "playerIds": [demon_target] } }
        }),
        "number" => json!({
            "type": "confirmStep",
            "payload": {
                "stepId": step_id,
                "input": null,
                "deliveredResult": {
                    "kind": "number",
                    "value": step["informationPrompt"]["numberChoices"][0]["value"]
                }
            }
        }),
        _ if step["support"] == "manual" => json!({
            "type": "resolveManualStep",
            "payload": { "stepId": step_id, "outcome": "handled" }
        }),
        _ => json!({ "type": "confirmStep", "payload": { "stepId": step_id, "input": null } }),
    }
}

fn advance_until(
    events: &mut Vec<Value>,
    demon_target: &str,
    wanted: impl Fn(&Value) -> bool,
) -> Value {
    for _ in 0..96 {
        let state = replay(events);
        assert_eq!(state["ok"], true, "replay failed: {state}");
        if wanted(&state) {
            return state;
        }
        let command = default_command(&state, demon_target);
        let proposal = propose(events, command.clone());
        assert_eq!(
            proposal["ok"], true,
            "proposal failed for state {state} with {command}: {proposal}"
        );
        events.push(proposal["value"]["event"].clone());
    }
    panic!("wanted state was not reached")
}

fn attack(events: &mut Vec<Value>, target_player_id: &str) -> Value {
    let demon = advance_until(events, target_player_id, |state| {
        state["value"]["phase"] == "night"
            && state["value"]["currentStep"]["id"]
                .as_str()
                .is_some_and(|id| id.contains(":demon:"))
    });
    append(events, default_command(&demon, target_player_id))
}

#[test]
fn sweetheart_death_is_immediately_pending_and_resolves_to_replayable_permanent_drunk() {
    let mut events = vec![setup_event()];
    let death = attack(&mut events, "player-1");
    let source_event_id = death["value"]["event"]["id"].as_str().unwrap();

    let pending = replay(&events);
    assert_eq!(
        pending["value"]["pendingDeathConsequences"][0]["kind"],
        "sweetheart"
    );
    assert_eq!(
        pending["value"]["pendingDeathConsequences"][0]["sourceEventId"],
        source_event_id
    );
    let step_id = pending["value"]["pendingDeathConsequences"][0]["stepId"]
        .as_str()
        .unwrap();

    let expected_event_count = events.len();
    let resolved = append(
        &mut events,
        json!({
            "type": "resolveSweetheartConsequence",
            "payload": {
                "stepId": step_id,
                "targetPlayerId": "player-5",
                "expectedEventCount": expected_event_count
            }
        }),
    );
    assert_eq!(
        resolved["value"]["event"]["type"],
        "sweetheartConsequenceResolved"
    );
    assert_eq!(
        resolved["value"]["event"]["payload"]["outcome"]["kind"],
        "drunkApplied"
    );

    let after = replay(&events);
    assert!(after["value"]["pendingDeathConsequences"]
        .as_array()
        .is_none_or(Vec::is_empty));
    assert!(after["value"]["ruleState"]["activeImpairments"]
        .as_array()
        .unwrap()
        .iter()
        .any(|impairment| {
            impairment["kind"] == "drunk"
                && impairment["playerId"] == "player-5"
                && impairment["sourceCharacterId"] == "sweetheart"
        }));

    events.pop();
    let undone = replay(&events);
    assert_eq!(
        undone["value"]["pendingDeathConsequences"][0]["kind"],
        "sweetheart"
    );
    assert!(!undone["value"]["ruleState"]["activeImpairments"]
        .as_array()
        .unwrap()
        .iter()
        .any(|impairment| impairment["sourceCharacterId"] == "sweetheart"));
}

#[test]
fn barber_death_lets_the_storyteller_choose_a_living_demon_and_atomically_swap_two_players() {
    let mut events = vec![setup_event()];
    attack(&mut events, "player-2");
    let pending = replay(&events);
    assert_eq!(
        pending["value"]["pendingDeathConsequences"][0]["kind"],
        "barber"
    );
    assert_eq!(
        pending["value"]["pendingDeathConsequences"][0]["eligibleChooserPlayerIds"],
        json!(["player-7"])
    );
    let step_id = pending["value"]["pendingDeathConsequences"][0]["stepId"]
        .as_str()
        .unwrap();

    let expected_event_count = events.len();
    let swapped = append(
        &mut events,
        json!({
            "type": "resolveBarberConsequence",
            "payload": {
                "stepId": step_id,
                "chooserDemonPlayerId": "player-7",
                "decision": { "kind": "swap", "playerIds": ["player-4", "player-5"] },
                "expectedEventCount": expected_event_count
            }
        }),
    );
    assert_eq!(
        swapped["value"]["event"]["type"],
        "barberConsequenceResolved"
    );
    assert_eq!(
        swapped["value"]["event"]["payload"]["outcome"]["kind"],
        "swapped"
    );

    let mut forged_events = events.clone();
    let forged = forged_events.last_mut().unwrap();
    forged["payload"]["outcome"]["identityTransitions"][0]["after"]["actualCharacter"] =
        json!("vortox");
    forged["payload"]["outcome"]["identityTransitions"][0]["after"]["shownCharacter"] =
        json!("vortox");
    assert_eq!(
        replay(&forged_events)["ok"],
        false,
        "forged Barber outcome replayed"
    );

    let after = replay(&events);
    let clockmaker = after["value"]["players"]
        .as_array()
        .unwrap()
        .iter()
        .find(|player| player["id"] == "player-4")
        .unwrap();
    let savant = after["value"]["players"]
        .as_array()
        .unwrap()
        .iter()
        .find(|player| player["id"] == "player-5")
        .unwrap();
    assert_eq!(clockmaker["actualCharacter"], "savant");
    assert_eq!(savant["actualCharacter"], "clockmaker");
    assert_eq!(
        after["value"]["pendingIdentityReveals"][0]["payload"]["playerId"],
        "player-4"
    );
    assert_eq!(
        after["value"]["pendingIdentityReveals"][1]["payload"]["playerId"],
        "player-5"
    );
}

#[test]
fn night_klutz_waits_for_death_announcement_then_evil_choice_forces_a_separate_game_end_event() {
    let mut events = vec![setup_event()];
    attack(&mut events, "player-3");
    let before_announcement = replay(&events);
    assert!(before_announcement["value"]["pendingDeathConsequences"]
        .as_array()
        .is_none_or(Vec::is_empty));

    let announcement = advance_until(&mut events, "player-3", |state| {
        state["value"]["currentStep"]["id"]
            .as_str()
            .is_some_and(|id| id.ends_with(":announceDeaths"))
    });
    append(&mut events, default_command(&announcement, "player-3"));

    let pending = replay(&events);
    assert_eq!(
        pending["value"]["pendingDeathConsequences"][0]["kind"],
        "klutz"
    );
    let step_id = pending["value"]["pendingDeathConsequences"][0]["stepId"]
        .as_str()
        .unwrap();
    let expected_event_count = events.len();
    let choice = append(
        &mut events,
        json!({
            "type": "resolveKlutzConsequence",
            "payload": {
                "stepId": step_id,
                "targetPlayerId": "player-7",
                "expectedEventCount": expected_event_count
            }
        }),
    );
    assert_eq!(choice["value"]["event"]["type"], "klutzChoiceResolved");
    assert_eq!(
        choice["value"]["event"]["payload"]["outcome"],
        json!({
            "kind": "teamLost", "losingTeam": "good", "winningTeam": "evil"
        })
    );

    let mut forged_events = events.clone();
    forged_events.last_mut().unwrap()["payload"]["outcome"] = json!({ "kind": "safe" });
    assert_eq!(
        replay(&forged_events)["ok"],
        false,
        "forged Klutz outcome replayed"
    );

    let forced = replay(&events);
    assert_eq!(
        forced["value"]["pendingForcedGameEnd"]["winningTeam"],
        "evil"
    );
    let blocked = propose(
        &events,
        json!({
            "type": "confirmStep",
            "payload": { "stepId": forced["value"]["currentStep"]["id"], "input": null }
        }),
    );
    assert_eq!(blocked["ok"], false);

    let expected_event_count = events.len();
    let ended = append(
        &mut events,
        json!({
            "type": "endGame",
            "payload": { "winningTeam": "evil", "expectedEventCount": expected_event_count }
        }),
    );
    assert_eq!(ended["value"]["event"]["type"], "gameEnded");
    assert_eq!(
        ended["value"]["event"]["payload"]["source"]["kind"],
        "klutzChoice"
    );
    assert_eq!(replay(&events)["value"]["gameEnd"]["winningTeam"], "evil");

    let mut forged_end = events.clone();
    forged_end.last_mut().unwrap()["payload"]["winningTeam"] = json!("good");
    assert_eq!(
        replay(&forged_end)["ok"],
        false,
        "mismatched forced winner replayed"
    );
}

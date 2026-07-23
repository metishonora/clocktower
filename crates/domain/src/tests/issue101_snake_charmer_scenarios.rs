use crate::{propose_json, replay_json};
use serde_json::{json, Value};

fn setup_event(players: Value) -> Value {
    json!({
        "id": "setup-1",
        "type": "setupConfirmed",
        "phase": "setup",
        "payload": { "players": players },
        "summary": "초기 설정 확정: 7명",
        "createdAt": "2026-07-23T00:00:00.000Z"
    })
}

fn standard_setup() -> Value {
    setup_event(json!([
        { "id": "player-1", "seat": 1, "name": "Snake", "actualCharacter": "snakeCharmer", "shownCharacter": "snakeCharmer" },
        { "id": "player-2", "seat": 2, "name": "Clock", "actualCharacter": "clockmaker", "shownCharacter": "clockmaker" },
        { "id": "player-3", "seat": 3, "name": "Dreamer", "actualCharacter": "dreamer", "shownCharacter": "dreamer" },
        { "id": "player-4", "seat": 4, "name": "Seamstress", "actualCharacter": "seamstress", "shownCharacter": "seamstress" },
        { "id": "player-5", "seat": 5, "name": "Mathematician", "actualCharacter": "mathematician", "shownCharacter": "mathematician" },
        { "id": "player-6", "seat": 6, "name": "Pit-Hag", "actualCharacter": "pitHag", "shownCharacter": "pitHag" },
        { "id": "player-7", "seat": 7, "name": "Vigormortis", "actualCharacter": "vigormortis", "shownCharacter": "vigormortis" }
    ]))
}

fn game(events: Vec<Value>) -> Value {
    json!({
        "schemaVersion": 3,
        "game": {
            "id": "game-issue-101",
            "name": "Snake Charmer",
            "scriptId": "sectsAndViolets",
            "createdAt": "2026-07-23T00:00:00.000Z",
            "updatedAt": "2026-07-23T00:00:00.000Z",
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

fn advance_to_snake_charmer(events: &mut Vec<Value>, later_night_only: bool) -> Value {
    for _ in 0..96 {
        let state = replay(events);
        assert_eq!(state["ok"], true, "replay failed: {state}");
        let step = &state["value"]["currentStep"];
        if step["character"] == "snakeCharmer"
            && (!later_night_only || state["value"]["phase"] == "night")
        {
            return state;
        }
        let step_id = step["id"].as_str().expect("step id");
        let command = if step["requiredInput"]["kind"] == "nomination" {
            json!({ "type": "skipStep", "payload": { "stepId": step_id } })
        } else if step["requiredInput"]["kind"] == "executionDecision" {
            json!({ "type": "confirmStep", "payload": { "stepId": step_id, "input": { "execute": false } } })
        } else if step["support"] == "manual" {
            json!({ "type": "resolveManualStep", "payload": { "stepId": step_id, "outcome": "handled" } })
        } else if step["id"].as_str().is_some_and(|id| id.contains(":demon:")) {
            json!({ "type": "confirmStep", "payload": { "stepId": step_id, "input": { "playerIds": ["player-2"] } } })
        } else {
            json!({ "type": "confirmStep", "payload": { "stepId": step_id, "input": null } })
        };
        append(events, command);
    }
    panic!("did not reach Snake Charmer step");
}

fn snake_step_id(state: &Value) -> &str {
    state["value"]["currentStep"]["id"]
        .as_str()
        .expect("Snake Charmer step id")
}

#[test]
fn official_no_swap_and_vigormortis_swap_are_atomic_replayable_events() {
    let mut before = vec![standard_setup()];
    let state = advance_to_snake_charmer(&mut before, false);
    assert_eq!(snake_step_id(&state), "firstNight:snakeCharmer:player-1");
    assert_eq!(state["value"]["currentStep"]["support"], "automated");
    assert_eq!(
        state["value"]["currentStep"]["requiredInput"]["allowedPlayerIds"],
        json!(["player-1", "player-2", "player-3", "player-4", "player-5", "player-6", "player-7"])
    );

    let no_swap = propose(
        &before,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": snake_step_id(&state),
                "input": { "playerIds": ["player-6"] }
            }
        }),
    );
    assert_eq!(no_swap["ok"], true, "{no_swap}");
    assert_eq!(
        no_swap["value"]["event"]["type"],
        "snakeCharmerActionResolved"
    );
    assert_eq!(
        no_swap["value"]["event"]["payload"]["outcome"],
        json!({ "kind": "noSwap", "reason": "targetNotDemon" })
    );
    let mut no_swap_events = before.clone();
    no_swap_events.push(no_swap["value"]["event"].clone());
    let no_swap_replay = replay(&no_swap_events);
    assert_eq!(no_swap_replay["ok"], true, "{no_swap_replay}");
    assert_eq!(
        no_swap_replay["value"]["players"][0]["actualCharacter"],
        "snakeCharmer"
    );
    assert_eq!(
        no_swap_replay["value"]["ruleState"]["activeImpairments"],
        json!([])
    );

    let swap = propose(
        &before,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": snake_step_id(&state),
                "input": { "playerIds": ["player-7"] }
            }
        }),
    );
    assert_eq!(swap["ok"], true, "{swap}");
    assert_eq!(swap["value"]["event"]["type"], "snakeCharmerActionResolved");
    let transitions = &swap["value"]["event"]["payload"]["outcome"]["identityTransitions"];
    assert_eq!(transitions.as_array().map(Vec::len), Some(2));

    let mut swapped_events = before.clone();
    swapped_events.push(swap["value"]["event"].clone());
    let swapped = replay(&swapped_events);
    assert_eq!(swapped["ok"], true, "{swapped}");
    assert_eq!(
        &swapped["value"]["players"][0],
        &json!({
            "id": "player-1", "seat": 1, "name": "Snake",
            "actualCharacter": "vigormortis", "shownCharacter": "vigormortis", "alignment": "evil",
            "alive": true, "ghostVoteUsed": false, "deathAnnounced": false,
            "systemTokenIds": [], "scriptTokens": [], "notes": "",
            "identityHistory": [{
                "sourceEventId": swap["value"]["event"]["id"], "phase": "firstNight",
                "before": { "actualCharacter": "snakeCharmer", "shownCharacter": "snakeCharmer", "alignment": "good" },
                "after": { "actualCharacter": "vigormortis", "shownCharacter": "vigormortis", "alignment": "evil" }
            }]
        })
    );
    assert_eq!(
        swapped["value"]["players"][6]["actualCharacter"],
        "snakeCharmer"
    );
    assert_eq!(
        swapped["value"]["players"][6]["shownCharacter"],
        "snakeCharmer"
    );
    assert_eq!(swapped["value"]["players"][6]["alignment"], "good");
    assert_eq!(
        swapped["value"]["ruleState"]["activeImpairments"],
        json!([{
            "kind": "poisoned", "playerId": "player-7",
            "sourceEventId": swap["value"]["event"]["id"],
            "sourceCharacterId": "snakeCharmer", "expires": "never"
        }])
    );
    assert_eq!(
        swapped["value"]["pendingIdentityReveals"],
        json!([
            {
                "sourceEventId": swap["value"]["event"]["id"], "sequence": 1,
                "payload": { "kind": "characterChange", "playerId": "player-1", "alignment": "evil", "characterId": "vigormortis" }
            },
            {
                "sourceEventId": swap["value"]["event"]["id"], "sequence": 2,
                "payload": { "kind": "characterChange", "playerId": "player-7", "alignment": "good", "characterId": "snakeCharmer" }
            }
        ])
    );
    assert!(
        swapped["value"]["phaseOverview"]
            .as_array()
            .is_some_and(|steps| steps
                .iter()
                .all(|step| { step["id"] != "firstNight:snakeCharmer:player-7" })),
        "new Snake Charmer must not get a generated first-night step"
    );

    let undone = replay(&before);
    assert_eq!(
        undone["value"]["currentStep"]["id"],
        "firstNight:snakeCharmer:player-1"
    );
    assert_eq!(
        undone["value"]["players"][0]["actualCharacter"],
        "snakeCharmer"
    );
    assert_eq!(undone["value"]["ruleState"]["activeImpairments"], json!([]));
}

#[test]
fn ongoing_night_swap_moves_the_later_demon_action_and_poison_blocks_the_next_swap() {
    let mut events = vec![standard_setup()];
    let first_night = advance_to_snake_charmer(&mut events, false);
    append(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": { "stepId": snake_step_id(&first_night), "input": { "playerIds": ["player-6"] } }
        }),
    );
    let night = advance_to_snake_charmer(&mut events, true);
    assert_eq!(snake_step_id(&night), "night:snakeCharmer:player-1");
    append(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": { "stepId": snake_step_id(&night), "input": { "playerIds": ["player-7"] } }
        }),
    );

    let after_swap = replay(&events);
    assert!(
        after_swap["value"]["phaseOverview"]
            .as_array()
            .is_some_and(|steps| steps
                .iter()
                .all(|step| { step["id"] != "night:snakeCharmer:player-7" })),
        "new Snake Charmer must not get a generated step in the swap night"
    );

    for _ in 0..8 {
        let state = replay(&events);
        let step = &state["value"]["currentStep"];
        if step["character"] == "vigormortis" {
            assert_eq!(step["id"], "night:demon:player-1");
            assert_eq!(step["playerId"], "player-1");
            break;
        }
        assert_ne!(
            step["playerId"], "player-7",
            "new Snake Charmer acted again in the same slot"
        );
        append(
            &mut events,
            json!({ "type": "resolveManualStep", "payload": { "stepId": step["id"], "outcome": "handled" } }),
        );
    }
    let demon = replay(&events);
    assert_eq!(demon["value"]["currentStep"]["id"], "night:demon:player-1");

    let next_snake = advance_to_snake_charmer(&mut events, true);
    assert_eq!(next_snake["value"]["currentStep"]["playerId"], "player-7");
    let poisoned = append(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": { "stepId": snake_step_id(&next_snake), "input": { "playerIds": ["player-1"] } }
        }),
    );
    assert_eq!(
        poisoned["value"]["event"]["payload"]["outcome"],
        json!({ "kind": "noSwap", "reason": "actorImpaired" })
    );
    let replayed = replay(&events);
    assert_eq!(
        replayed["value"]["players"][0]["actualCharacter"],
        "vigormortis"
    );
    assert_eq!(
        replayed["value"]["players"][6]["actualCharacter"],
        "snakeCharmer"
    );
}

#[test]
fn duplicate_snake_charmers_have_deterministic_player_scoped_wake_steps() {
    let mut events = vec![setup_event(json!([
        { "id": "player-1", "seat": 1, "name": "Snake 1", "actualCharacter": "snakeCharmer", "shownCharacter": "snakeCharmer" },
        { "id": "player-2", "seat": 2, "name": "Snake 2", "actualCharacter": "snakeCharmer", "shownCharacter": "snakeCharmer" },
        { "id": "player-3", "seat": 3, "name": "Clock", "actualCharacter": "clockmaker", "shownCharacter": "clockmaker" },
        { "id": "player-4", "seat": 4, "name": "Dreamer", "actualCharacter": "dreamer", "shownCharacter": "dreamer" },
        { "id": "player-5", "seat": 5, "name": "Seamstress", "actualCharacter": "seamstress", "shownCharacter": "seamstress" },
        { "id": "player-6", "seat": 6, "name": "Pit-Hag", "actualCharacter": "pitHag", "shownCharacter": "pitHag" },
        { "id": "player-7", "seat": 7, "name": "Vortox", "actualCharacter": "vortox", "shownCharacter": "vortox" }
    ]))];
    let first = advance_to_snake_charmer(&mut events, false);
    assert_eq!(snake_step_id(&first), "firstNight:snakeCharmer:player-1");
    append(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": { "stepId": snake_step_id(&first), "input": { "playerIds": ["player-2"] } }
        }),
    );
    let second = replay(&events);
    assert_eq!(
        second["value"]["currentStep"]["id"],
        "firstNight:snakeCharmer:player-2"
    );
    assert_eq!(second["value"]["currentStep"]["playerId"], "player-2");
}

#[test]
fn historical_manual_snake_charmer_events_remain_replayable() {
    let mut events = vec![standard_setup()];
    let state = advance_to_snake_charmer(&mut events, false);
    assert_eq!(snake_step_id(&state), "firstNight:snakeCharmer:player-1");
    events.push(json!({
        "id": "legacy-snake-4",
        "type": "manualPhaseStepResolved",
        "phase": "firstNight",
        "payload": { "stepId": "firstNight:snakeCharmer", "outcome": "handled" },
        "summary": "수동 단계 처리: firstNight:snakeCharmer",
        "createdAt": "2026-07-22T00:00:00.000Z"
    }));

    let replayed = replay(&events);
    assert_eq!(replayed["ok"], true, "legacy replay failed: {replayed}");
    assert_ne!(
        replayed["value"]["currentStep"]["character"],
        "snakeCharmer"
    );
}

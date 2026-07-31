use crate::{propose_json, replay_json};
use serde_json::{json, Value};

use super::support::snv_demon_bluff_input;

fn setup_event() -> Value {
    json!({
        "id": "setup-1",
        "type": "setupConfirmed",
        "phase": "setup",
        "payload": { "players": [
            { "id": "player-1", "seat": 1, "name": "A", "actualCharacter": "philosopher", "shownCharacter": "philosopher" },
            { "id": "player-2", "seat": 2, "name": "B", "actualCharacter": "snakeCharmer", "shownCharacter": "snakeCharmer" },
            { "id": "player-3", "seat": 3, "name": "C", "actualCharacter": "clockmaker", "shownCharacter": "clockmaker" },
            { "id": "player-4", "seat": 4, "name": "D", "actualCharacter": "seamstress", "shownCharacter": "seamstress" },
            { "id": "player-5", "seat": 5, "name": "E", "actualCharacter": "mathematician", "shownCharacter": "mathematician" },
            { "id": "player-6", "seat": 6, "name": "F", "actualCharacter": "witch", "shownCharacter": "witch" },
            { "id": "player-7", "seat": 7, "name": "G", "actualCharacter": "vortox", "shownCharacter": "vortox" }
        ]},
        "summary": "초기 설정 확정: 7명",
        "createdAt": "2026-07-21T00:00:00.000Z"
    })
}

fn game(events: Vec<Value>) -> Value {
    json!({
        "schemaVersion": 3,
        "game": {
            "id": "game-snv-phase",
            "name": "S&V phase",
            "scriptId": "sectsAndViolets",
            "createdAt": "2026-07-21T00:00:00.000Z",
            "updatedAt": "2026-07-21T00:00:00.000Z",
            "events": events
        }
    })
}

#[test]
fn sects_and_violets_first_night_interleaves_system_and_present_character_steps() {
    let actual: Value =
        serde_json::from_str(&replay_json(&game(vec![setup_event()]).to_string())).unwrap();

    assert_eq!(actual["ok"], true, "{actual}");
    assert_eq!(actual["value"]["phase"], "firstNight");
    assert_eq!(
        actual["value"]["currentStep"]["id"],
        "firstNight:philosopher"
    );
    assert_eq!(actual["value"]["currentStep"]["support"], "manual");

    let ids = actual["value"]["phaseOverview"]
        .as_array()
        .unwrap()
        .iter()
        .map(|step| step["id"].as_str().unwrap())
        .collect::<Vec<_>>();
    assert_eq!(
        ids,
        [
            "firstNight:philosopher",
            "firstNight:minionInfo",
            "firstNight:demonInfo",
            "firstNight:snakeCharmer:player-2",
            "firstNight:witch",
            "firstNight:clockmaker",
            "firstNight:seamstress",
            "firstNight:mathematician",
            "firstNight:toDay",
        ]
    );
    assert_eq!(actual["value"]["phaseOverview"][1]["support"], "automated");
    assert_eq!(actual["value"]["phaseOverview"][2]["support"], "automated");
}

#[test]
fn manual_step_resolution_has_a_dedicated_replayable_outcome() {
    let before = game(vec![setup_event()]);
    let command = json!({
        "type": "resolveManualStep",
        "payload": {
            "stepId": "firstNight:philosopher",
            "outcome": "handled"
        }
    });
    let proposed: Value =
        serde_json::from_str(&propose_json(&before.to_string(), &command.to_string())).unwrap();

    assert_eq!(proposed["ok"], true, "{proposed}");
    assert_eq!(
        proposed["value"]["event"]["type"],
        "manualPhaseStepResolved"
    );
    assert_eq!(proposed["value"]["event"]["payload"]["outcome"], "handled");

    let mut events = vec![setup_event()];
    events.push(proposed["value"]["event"].clone());
    let replayed: Value = serde_json::from_str(&replay_json(&game(events).to_string())).unwrap();
    assert_eq!(replayed["ok"], true, "{replayed}");
    assert_eq!(
        replayed["value"]["currentStep"]["id"],
        "firstNight:minionInfo"
    );
    assert_eq!(replayed["value"]["currentStep"]["support"], "automated");
    assert_eq!(
        replayed["value"]["phaseOverview"][0]["status"],
        "manualComplete"
    );
}

#[test]
fn manual_and_automated_steps_reject_the_wrong_resolution_path() {
    let before = game(vec![setup_event()]);
    let confirm_manual = json!({
        "type": "confirmStep",
        "payload": { "stepId": "firstNight:philosopher" }
    });
    let rejected: Value = serde_json::from_str(&propose_json(
        &before.to_string(),
        &confirm_manual.to_string(),
    ))
    .unwrap();
    assert_eq!(rejected["error"]["code"], "STEP_REQUIRES_MANUAL_RESOLUTION");

    let resolve_automated = json!({
        "type": "resolveManualStep",
        "payload": { "stepId": "firstNight:minionInfo", "outcome": "notApplicable" }
    });
    let rejected: Value = serde_json::from_str(&propose_json(
        &before.to_string(),
        &resolve_automated.to_string(),
    ))
    .unwrap();
    assert_eq!(rejected["error"]["code"], "STALE_STEP");
}

#[test]
fn phase_mutations_reject_a_stale_event_count() {
    let before = game(vec![setup_event()]);
    let stale: Value = serde_json::from_str(&propose_json(
        &before.to_string(),
        &json!({
            "type": "resolveManualStep",
            "payload": {
                "stepId": "firstNight:philosopher",
                "outcome": "handled",
                "expectedEventCount": 0
            }
        })
        .to_string(),
    ))
    .unwrap();

    assert_eq!(stale["error"]["code"], "STALE_COMMAND", "{stale}");
}

fn append_current_resolution(events: &mut Vec<Value>) -> Value {
    let before = game(events.clone());
    let state: Value = serde_json::from_str(&replay_json(&before.to_string())).unwrap();
    assert_eq!(state["ok"], true, "{state}");
    let step = &state["value"]["currentStep"];
    let command = if step["character"] == "snakeCharmer" {
        json!({
            "type": "confirmStep",
            "payload": { "stepId": step["id"], "input": { "playerIds": ["player-6"] } }
        })
    } else if step["character"] == "witch" {
        json!({
            "type": "confirmStep",
            "payload": { "stepId": step["id"], "input": { "playerIds": ["player-7"] } }
        })
    } else if step["character"] == "seamstress" {
        json!({ "type": "skipStep", "payload": { "stepId": step["id"] } })
    } else if step["id"] == "firstNight:demonInfo" {
        json!({ "type": "confirmStep", "payload": {
            "stepId": step["id"], "input": snv_demon_bluff_input(step)
        } })
    } else if step["support"] == "manual" {
        json!({
            "type": "resolveManualStep",
            "payload": { "stepId": step["id"], "outcome": "handled" }
        })
    } else if step["informationPrompt"]["deliveryMode"] == "selectable"
        && step["informationPrompt"]["computedResult"]["kind"] == "number"
    {
        json!({ "type": "confirmStep", "payload": { "stepId": step["id"], "input": null, "deliveredResult": { "kind": "number", "value": step["informationPrompt"]["numberChoices"][0]["value"] } } })
    } else if step["informationPrompt"]["deliveryMode"] == "selectable"
        && step["informationPrompt"]["computedResult"]["kind"] == "boolean"
    {
        json!({ "type": "confirmStep", "payload": { "stepId": step["id"], "input": null, "deliveredResult": { "kind": "boolean", "value": step["informationPrompt"]["booleanChoices"][0]["value"] } } })
    } else {
        json!({
            "type": "confirmStep",
            "payload": { "stepId": step["id"] }
        })
    };
    let proposed: Value =
        serde_json::from_str(&propose_json(&before.to_string(), &command.to_string())).unwrap();
    assert_eq!(proposed["ok"], true, "{proposed}");
    events.push(proposed["value"]["event"].clone());
    state
}

#[test]
fn first_night_enters_the_canonical_day_flow_then_the_official_later_night_order() {
    let mut events = vec![setup_event()];
    for _ in 0..9 {
        append_current_resolution(&mut events);
    }

    let day: Value = serde_json::from_str(&replay_json(&game(events.clone()).to_string())).unwrap();
    assert_eq!(day["value"]["phase"], "day", "{day}");
    assert_eq!(day["value"]["currentStep"]["id"], "day:announceDeaths");
    assert_eq!(day["value"]["currentStep"]["support"], "automated");

    for _ in 0..3 {
        append_current_resolution(&mut events);
    }
    let nomination: Value =
        serde_json::from_str(&replay_json(&game(events.clone()).to_string())).unwrap();
    assert_eq!(nomination["value"]["currentStep"]["id"], "day:nomination:1");
    assert_eq!(
        nomination["value"]["dayState"]["eligibleNominatorIds"],
        json!(["player-1", "player-2", "player-3", "player-4", "player-5", "player-6", "player-7"])
    );

    append_proposed_event(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "day:nomination:1",
                "input": { "nominatorId": "player-1", "nomineeId": "player-5" }
            }
        }),
    );
    let vote: Value =
        serde_json::from_str(&replay_json(&game(events.clone()).to_string())).unwrap();
    assert_eq!(
        vote["value"]["currentStep"]["id"], "day:nomination:1:vote",
        "{vote}"
    );
    assert_eq!(
        vote["value"]["dayState"]["activeNomination"]["nomineeId"],
        "player-5"
    );

    append_proposed_event(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": {
                "stepId": "day:nomination:1:vote",
                "input": { "voterIds": ["player-1", "player-2", "player-3", "player-4"] }
            }
        }),
    );
    let next_nomination: Value =
        serde_json::from_str(&replay_json(&game(events.clone()).to_string())).unwrap();
    assert_eq!(
        next_nomination["value"]["currentStep"]["id"],
        "day:nomination:2"
    );
    assert_eq!(next_nomination["value"]["dayState"]["highestVoteCount"], 4);
    assert_eq!(
        next_nomination["value"]["dayState"]["executionCandidate"]["nomineeId"],
        "player-5"
    );

    append_proposed_event(
        &mut events,
        json!({
            "type": "skipStep",
            "payload": { "stepId": "day:nomination:2" }
        }),
    );
    let execution: Value =
        serde_json::from_str(&replay_json(&game(events.clone()).to_string())).unwrap();
    assert_eq!(execution["value"]["currentStep"]["id"], "day:execution");
    append_proposed_event(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": { "stepId": "day:execution", "input": { "execute": true } }
        }),
    );
    append_proposed_event(
        &mut events,
        json!({
            "type": "confirmStep",
            "payload": { "stepId": "day:executionDeath", "input": { "died": true } }
        }),
    );
    append_current_resolution(&mut events);

    let night: Value = serde_json::from_str(&replay_json(&game(events).to_string())).unwrap();
    assert_eq!(night["value"]["phase"], "night", "{night}");
    let ids = night["value"]["phaseOverview"]
        .as_array()
        .unwrap()
        .iter()
        .map(|step| step["id"].as_str().unwrap())
        .collect::<Vec<_>>();
    assert_eq!(
        ids,
        [
            "night:philosopher",
            "night:snakeCharmer:player-2",
            "night:witch",
            "night:demon:player-7",
            "night:seamstress",
            "night:toDay",
        ]
    );
    assert_eq!(night["value"]["phaseOverview"][3]["character"], "vortox");
    assert_eq!(night["value"]["phaseOverview"][3]["support"], "automated");
}

fn append_proposed_event(events: &mut Vec<Value>, command: Value) {
    let before = game(events.clone());
    let proposed: Value =
        serde_json::from_str(&propose_json(&before.to_string(), &command.to_string())).unwrap();
    assert_eq!(proposed["ok"], true, "{proposed}");
    events.push(proposed["value"]["event"].clone());
}

#[test]
fn not_applicable_is_distinct_from_a_handled_manual_step() {
    let event = json!({
        "id": "manual-2",
        "type": "manualPhaseStepResolved",
        "phase": "firstNight",
        "payload": {
            "stepId": "firstNight:philosopher",
            "outcome": "notApplicable"
        },
        "summary": "수동 단계 해당 없음",
        "createdAt": "2026-07-21T00:00:00.000Z"
    });
    let replayed: Value =
        serde_json::from_str(&replay_json(&game(vec![setup_event(), event]).to_string())).unwrap();
    assert_eq!(replayed["ok"], true, "{replayed}");
    assert_eq!(
        replayed["value"]["phaseOverview"][0]["status"],
        "notApplicable"
    );
}

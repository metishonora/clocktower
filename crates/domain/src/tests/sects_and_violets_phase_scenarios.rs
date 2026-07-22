use crate::{propose_json, replay_json};
use serde_json::{json, Value};

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
            "firstNight:snakeCharmer",
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

fn append_current_resolution(events: &mut Vec<Value>) -> Value {
    let before = game(events.clone());
    let state: Value = serde_json::from_str(&replay_json(&before.to_string())).unwrap();
    assert_eq!(state["ok"], true, "{state}");
    let step = &state["value"]["currentStep"];
    let command = if step["support"] == "manual" {
        json!({
            "type": "resolveManualStep",
            "payload": { "stepId": step["id"], "outcome": "handled" }
        })
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
fn first_night_enters_a_manual_day_bridge_then_the_official_later_night_order() {
    let mut events = vec![setup_event()];
    for _ in 0..9 {
        append_current_resolution(&mut events);
    }

    let day: Value = serde_json::from_str(&replay_json(&game(events.clone()).to_string())).unwrap();
    assert_eq!(day["value"]["phase"], "day", "{day}");
    assert_eq!(day["value"]["currentStep"]["id"], "day:manual");
    assert_eq!(day["value"]["currentStep"]["support"], "manual");

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
            "night:snakeCharmer",
            "night:witch",
            "night:vortox",
            "night:seamstress",
            "night:mathematician",
            "night:toDay",
        ]
    );
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

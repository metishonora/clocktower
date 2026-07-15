use super::support::*;
use crate::*;
use serde_json::{json, Value};

#[test]
fn second_normal_night_spy_uses_only_night2_poison_and_protection() {
    let game = game_with_events(json!([
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Chef", "actualCharacter": "chef", "shownCharacter": "chef" },
            { "id": "player-2", "seat": 2, "name": "Monk", "actualCharacter": "monk", "shownCharacter": "monk" },
            { "id": "player-3", "seat": 3, "name": "Poisoner", "actualCharacter": "poisoner", "shownCharacter": "poisoner" },
            { "id": "player-4", "seat": 4, "name": "Spy", "actualCharacter": "spy", "shownCharacter": "spy" },
            { "id": "player-5", "seat": 5, "name": "Imp", "actualCharacter": "imp", "shownCharacter": "imp" }
        ])),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event_with_input(
            "phaseStepConfirmed",
            "firstNight:poisoner",
            json!({ "playerIds": ["player-2"] })
        ),
        phase_event("phaseStepConfirmed", "firstNight:chef"),
        phase_event("phaseStepConfirmed", "firstNight:spy"),
        phase_event("phaseStepConfirmed", "firstNight:toDay"),
        phase_event("phaseStepConfirmed", "day:announceDeaths"),
        phase_event("phaseStepSkipped", "day:nomination:1"),
        no_execution_event("day:execution"),
        phase_event("phaseStepConfirmed", "day:toNight"),
        phase_event_with_input(
            "phaseStepConfirmed",
            "night:poisoner",
            json!({ "playerIds": ["player-2"] })
        ),
        phase_event_with_input(
            "phaseStepConfirmed",
            "night:monk",
            json!({ "playerIds": ["player-1"] })
        ),
        phase_event_with_input(
            "phaseStepConfirmed",
            "night:imp",
            json!({ "playerIds": ["player-5"] })
        ),
        phase_event("phaseStepConfirmed", "night:spy"),
        phase_event("phaseStepConfirmed", "night:toDay"),
        cycle_phase_event("phaseStepConfirmed", "day2:announceDeaths", Value::Null),
        cycle_phase_event("phaseStepSkipped", "day2:nomination:1", Value::Null),
        no_execution_event("day2:execution"),
        cycle_phase_event("phaseStepConfirmed", "day2:toNight", Value::Null),
        cycle_phase_event(
            "phaseStepConfirmed",
            "night2:poisoner",
            json!({ "playerIds": ["player-1"] })
        ),
        cycle_phase_event(
            "phaseStepConfirmed",
            "night2:monk",
            json!({ "playerIds": ["player-4"] })
        ),
        cycle_phase_event(
            "phaseStepConfirmed",
            "night2:imp",
            json!({ "playerIds": ["player-5"] })
        )
    ]));
    let command = json!({
        "type": "confirmStep",
        "payload": { "stepId": "night2:spy" }
    });

    let actual: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();

    assert_eq!(actual["ok"], true, "{actual:#}");
    let players = actual["value"]["revealPayload"]["players"]
        .as_array()
        .expect("Spy Reveal must contain players");
    assert_eq!(players[0]["reminderTokens"], json!(["poisoned"]));
    assert_eq!(players[1]["reminderTokens"], json!([]));
    assert_eq!(players[3]["reminderTokens"], json!(["protected"]));
}

fn cycle_phase_event(event_type: &str, step_id: &str, input: Value) -> Value {
    let mut event = phase_event_with_input(event_type, step_id, input);
    event["phase"] = json!(if step_id.starts_with("day") {
        "day"
    } else {
        "night"
    });
    event
}

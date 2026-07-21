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
        phase_event("phaseStepConfirmed", "day:whisper"),
        phase_event("phaseStepConfirmed", "day:discussion"),
        phase_event("phaseStepSkipped", "day:nomination:1"),
        no_execution_event("day:execution"),
        phase_event("phaseStepConfirmed", "day:toNight"),
        night_effect_event("night:poisoner", "player-3", "poison", "player-4"),
        night_effect_event("night:monk", "player-2", "monkProtection", "player-1"),
        phase_event_with_input(
            "phaseStepConfirmed",
            "night:imp",
            json!({ "playerIds": ["player-5"] })
        ),
        phase_event("phaseStepConfirmed", "night:spy"),
        phase_event("phaseStepConfirmed", "night:toDay"),
        cycle_phase_event("phaseStepConfirmed", "day2:announceDeaths", Value::Null),
        cycle_phase_event("phaseStepConfirmed", "day2:whisper", Value::Null),
        cycle_phase_event("phaseStepConfirmed", "day2:discussion", Value::Null),
        cycle_phase_event("phaseStepSkipped", "day2:nomination:1", Value::Null),
        no_execution_event("day2:execution"),
        cycle_phase_event("phaseStepConfirmed", "day2:toNight", Value::Null),
        night_effect_event("night2:poisoner", "player-3", "poison", "player-1"),
        night_effect_event("night2:monk", "player-2", "monkProtection", "player-4"),
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

fn night_effect_event(
    step_id: &str,
    actor_player_id: &str,
    kind: &str,
    target_player_id: &str,
) -> Value {
    json!({
        "id": format!("event-{step_id}"),
        "type": "nightActionResolved",
        "phase": "night",
        "payload": {
            "stepId": step_id,
            "actorPlayerId": actor_player_id,
            "resolution": {
                "kind": kind,
                "targetPlayerId": target_player_id,
                "applied": true
            }
        },
        "summary": step_id,
        "createdAt": "2026-01-01T00:00:00.000Z"
    })
}

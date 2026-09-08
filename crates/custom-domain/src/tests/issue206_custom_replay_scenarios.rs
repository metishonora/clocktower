#![cfg(feature = "custom-runtime-fixtures")]

use crate::{propose_json, replay_json};
use serde_json::{json, Value};

fn system(action_id: &str) -> Value {
    json!({ "kind": "system", "actionId": action_id })
}

fn character(character_id: &str, action_id: &str) -> Value {
    json!({
        "kind": "character",
        "characterId": character_id,
        "actionId": action_id,
    })
}

fn definition() -> Value {
    json!({
        "id": "issue-206-runtime-fixture",
        "name": "Issue 206 runtime fixture",
        "characterIds": [
            "philosopher", "washerwoman", "librarian", "undertaker", "monk", "ravenkeeper", "scarletWoman", "imp"
        ],
        "firstNightOrder": [
            system("dusk"),
            character("philosopher", "chooseAbility"),
            character("washerwoman", "learnTownsfolk"),
            character("librarian", "learnOutsider"),
            system("minionInfo"),
            system("demonInfo"),
            system("dawn")
        ]
    })
}

fn players() -> Value {
    json!([
        { "seat": 1, "name": "A", "actualCharacter": "philosopher" },
        { "seat": 2, "name": "B", "actualCharacter": "undertaker" },
        { "seat": 3, "name": "C", "actualCharacter": "scarletWoman" },
        { "seat": 4, "name": "D", "actualCharacter": "imp" },
        { "seat": 5, "name": "E", "actualCharacter": "monk" }
    ])
}

fn empty_game() -> Value {
    json!({
        "schemaVersion": 4,
        "game": {
            "script": { "type": "custom", "definition": definition() },
            "id": "issue-206-runtime-game",
            "name": "Issue 206 runtime game",
            "createdAt": "2026-09-07T00:00:00.000Z",
            "updatedAt": "2026-09-07T00:00:00.000Z",
            "events": []
        }
    })
}

fn propose(game: &Value, command: Value) -> Value {
    serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap()
}

fn replay(game: &Value) -> Value {
    serde_json::from_str(&replay_json(&game.to_string())).unwrap()
}

fn create_game() -> Value {
    let game = empty_game();
    let result = propose(
        &game,
        json!({ "type": "createGame", "payload": { "players": players() } }),
    );
    assert_eq!(result["ok"], true, "{result}");
    result["value"]["event"].clone()
}

fn game_with_setup() -> Value {
    let mut game = empty_game();
    game["game"]["events"] = json!([create_game()]);
    game
}

fn append(game: &mut Value, event: &Value) {
    game["game"]["events"]
        .as_array_mut()
        .expect("events should be an array")
        .push(event.clone());
}

fn current_step_id(state: &Value) -> &str {
    state["value"]["currentStep"]["id"]
        .as_str()
        .expect("replay should expose a current step")
}

fn confirm(game: &Value, step_id: &str, input: Option<Value>) -> Value {
    let event_count = game["game"]["events"]
        .as_array()
        .expect("events should be an array")
        .len();
    let mut payload = json!({
        "stepId": step_id,
        "expectedEventCount": event_count
    });
    if let Some(input) = input {
        payload["input"] = input;
    }
    let result = propose(game, json!({ "type": "confirmStep", "payload": payload }));
    assert_eq!(result["ok"], true, "{result}");
    result
}

#[test]
fn fixture_grant_uses_atomic_fold_and_projects_the_next_occurrence() {
    let mut game = game_with_setup();
    let before = replay(&game);
    assert_eq!(before["ok"], true, "{before}");
    assert_eq!(before["value"]["currentStep"]["character"], "philosopher");
    assert!(before["value"]["ruleState"].get("abilityGrants").is_none());

    let proposal = confirm(
        &game,
        current_step_id(&before),
        Some(json!({ "characterIds": ["washerwoman"] })),
    );
    assert_eq!(proposal["value"]["event"]["type"], "customActionConfirmed");
    assert_eq!(
        proposal["value"]["event"]["payload"]["result"]["kind"],
        "fixtureAbilityGranted"
    );
    append(&mut game, &proposal["value"]["event"]);

    let after = replay(&game);
    assert_eq!(after["ok"], true, "{after}");
    assert_eq!(after["value"]["phase"], "firstNight");
    assert_eq!(after["value"]["currentStep"]["character"], "washerwoman");
    assert_eq!(
        after["value"]["currentStep"]["abilityUse"]["ownerPlayerId"],
        "player-1"
    );
    assert_eq!(
        after["value"]["currentStep"]["abilityUse"]["characterId"],
        "washerwoman"
    );
    let philosopher_complete = after["value"]["phaseOverview"]
        .as_array()
        .unwrap()
        .iter()
        .find(|row| row["status"] == "complete")
        .expect("grant confirmation should retain a completed row");
    assert_eq!(
        philosopher_complete["id"],
        "firstNight:philosopher:chooseAbility:owner8:player-1:instance14:setup:player-1"
    );
    assert_eq!(
        philosopher_complete["actionRef"],
        json!({
            "kind": "character",
            "characterId": "philosopher",
            "actionId": "chooseAbility"
        })
    );
    assert_eq!(
        philosopher_complete["abilityUse"],
        json!({
            "ownerPlayerId": "player-1",
            "characterId": "philosopher",
            "abilityInstanceId": "setup:player-1"
        })
    );
    assert_eq!(
        after["value"]["ruleState"]["abilityGrants"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
    assert_eq!(
        after["value"]["players"][0]["actualCharacter"],
        "philosopher"
    );

    // A proposal is a dry run of the same fold and does not mutate the event prefix.
    let repeated = confirm(&game, current_step_id(&after), None);
    assert_eq!(repeated["value"]["event"]["type"], "customActionConfirmed");
    assert_eq!(game["game"]["events"].as_array().unwrap().len(), 2);
    assert_eq!(replay(&game), after);
}

#[test]
fn replay_reload_and_undo_keep_grant_and_prefix_progress_consistent() {
    let mut game = game_with_setup();
    let before = replay(&game);
    let philosopher = confirm(
        &game,
        current_step_id(&before),
        Some(json!({ "characterIds": ["washerwoman"] })),
    );
    append(&mut game, &philosopher["value"]["event"]);
    let washerwoman = replay(&game);
    assert_eq!(
        washerwoman["value"]["currentStep"]["character"],
        "washerwoman"
    );
    let washerwoman_step = washerwoman["value"]["currentStep"].clone();
    let washerwoman_event = confirm(&game, current_step_id(&washerwoman), None);
    append(&mut game, &washerwoman_event["value"]["event"]);
    let minion = replay(&game);
    assert_eq!(
        minion["value"]["currentStep"]["id"],
        "firstNight:system:minionInfo"
    );
    let washerwoman_complete = minion["value"]["phaseOverview"]
        .as_array()
        .unwrap()
        .iter()
        .find(|row| row["character"] == "washerwoman" && row["status"] == "complete")
        .expect("washerwoman confirmation should retain a completed row");
    assert_eq!(washerwoman_complete["id"], washerwoman_step["id"]);
    assert_eq!(
        washerwoman_complete["actionRef"],
        json!({
            "kind": "character",
            "characterId": "washerwoman",
            "actionId": "learnTownsfolk"
        })
    );
    assert_eq!(
        washerwoman_complete["abilityUse"]["ownerPlayerId"],
        "player-1"
    );
    assert_eq!(
        washerwoman_complete["abilityUse"]["characterId"],
        "washerwoman"
    );
    assert_eq!(
        washerwoman_complete["abilityUse"],
        washerwoman_step["abilityUse"]
    );
    assert_ne!(
        washerwoman_complete["abilityUse"]["abilityInstanceId"],
        "setup:player-1"
    );
    assert_eq!(
        washerwoman_complete["abilityOrigin"],
        json!({
            "kind": "acquired",
            "acquisitionEventId": "phase-step-2",
            "source": {
                "ownerPlayerId": "player-1",
                "characterId": "philosopher",
                "abilityInstanceId": "setup:player-1"
            }
        })
    );
    let minion_event = confirm(&game, "firstNight:system:minionInfo", None);
    assert_eq!(
        minion_event["value"]["revealPayload"]["kind"],
        "minionInformation"
    );
    assert_eq!(
        minion_event["value"]["revealPayload"]["minionPlayers"][0]["name"],
        "C"
    );
    append(&mut game, &minion_event["value"]["event"]);

    let demon = replay(&game);
    assert_eq!(
        demon["value"]["currentStep"]["id"],
        "firstNight:system:demonInfo"
    );
    let demon_event = confirm(
        &game,
        "firstNight:system:demonInfo",
        Some(json!({ "characterIds": ["washerwoman", "librarian", "ravenkeeper"] })),
    );
    assert_eq!(
        demon_event["value"]["revealPayload"]["kind"],
        "demonInformation"
    );
    assert_eq!(
        demon_event["value"]["revealPayload"]["minionPlayers"][0]["name"],
        "C"
    );
    append(&mut game, &demon_event["value"]["event"]);
    let before_dawn = replay(&game);
    assert_eq!(
        before_dawn["value"]["currentStep"]["id"],
        "firstNight:system:dawn"
    );

    let dawn = confirm(&game, "firstNight:system:dawn", None);
    append(&mut game, &dawn["value"]["event"]);
    let day = replay(&game);
    assert_eq!(day["value"]["phase"], "day");
    assert!(day["value"]["currentStep"].is_null());
    assert_eq!(day["value"]["phaseOverview"], json!([]));

    game["game"]["events"].as_array_mut().unwrap().pop();
    assert_eq!(replay(&game), before_dawn);
    game["game"]["events"].as_array_mut().unwrap().pop();
    let after_undo = replay(&game);
    assert_eq!(
        after_undo["value"]["currentStep"]["id"],
        "firstNight:system:demonInfo"
    );
    assert_eq!(
        after_undo["value"]["ruleState"]["abilityGrants"]
            .as_array()
            .unwrap()
            .len(),
        1
    );

    // Truncating the prefix at setup restores every replay-derived fact and progress field.
    game["game"]["events"].as_array_mut().unwrap().truncate(1);
    assert_eq!(replay(&game), before);
}

#[test]
fn forged_events_are_rejected_without_prefix_adoption() {
    let mut game = game_with_setup();
    let before = replay(&game);
    let proposal = confirm(
        &game,
        current_step_id(&before),
        Some(json!({ "characterIds": ["washerwoman"] })),
    );
    let mut forged = proposal["value"]["event"].clone();
    forged["payload"]["abilityUse"]["ownerPlayerId"] = json!("other-player");
    append(&mut game, &forged);
    let rejected = replay(&game);
    assert_eq!(
        rejected["error"]["code"], "INVALID_FIRST_NIGHT_ACTION_PROVENANCE",
        "{rejected}"
    );
    game["game"]["events"].as_array_mut().unwrap().pop();
    assert_eq!(replay(&game), before);
}

#[test]
fn post_dawn_events_are_rejected_at_the_end_boundary() {
    let mut game = game_with_setup();
    let philosopher = replay(&game);
    let philosopher_event = confirm(
        &game,
        current_step_id(&philosopher),
        Some(json!({ "characterIds": ["washerwoman"] })),
    );
    append(&mut game, &philosopher_event["value"]["event"]);

    let washerwoman = replay(&game);
    let washerwoman_event = confirm(&game, current_step_id(&washerwoman), None);
    append(&mut game, &washerwoman_event["value"]["event"]);

    let minion = replay(&game);
    let minion_event = confirm(&game, current_step_id(&minion), None);
    append(&mut game, &minion_event["value"]["event"]);

    let demon = replay(&game);
    let demon_event = confirm(
        &game,
        current_step_id(&demon),
        Some(json!({ "characterIds": ["washerwoman", "librarian", "ravenkeeper"] })),
    );
    append(&mut game, &demon_event["value"]["event"]);

    let dawn = replay(&game);
    let dawn_event = confirm(&game, current_step_id(&dawn), None);
    append(&mut game, &dawn_event["value"]["event"]);
    let day = replay(&game);
    assert_eq!(day["value"]["phase"], "day");

    let mut post_dawn_event = dawn_event["value"]["event"].clone();
    post_dawn_event["id"] = json!("phase-step-post-dawn");
    append(&mut game, &post_dawn_event);

    // Reusing a first-night event after the terminal dawn transition must fail at the fold
    // boundary rather than being silently ignored or adopted as a new prefix.
    let rejected = replay(&game);
    assert_eq!(
        rejected["error"]["code"], "INVALID_FIRST_NIGHT_ACTION_PROVENANCE",
        "{rejected}"
    );
}

#[test]
fn completed_snapshots_keep_pre_identity_system_reveals() {
    let mut game = empty_game();
    game["game"]["script"]["definition"] = json!({
        "id": "issue-206-identity-history",
        "name": "Issue 206 identity history",
        "characterIds": [
            "librarian", "dreamer", "spy", "imp", "saint", "scarletWoman", "ravenkeeper", "mayor",
            "undertaker", "monk", "soldier"
        ],
        "firstNightOrder": [
            system("dusk"),
            system("demonInfo"),
            character("dreamer", "learnCharacters"),
            character("librarian", "learnOutsider"),
            system("minionInfo"),
            character("spy", "inspectGrimoire"),
            system("dawn")
        ]
    });
    game["game"]["id"] = json!("issue-206-identity-history-game");
    let setup = propose(
        &game,
        json!({
            "type": "createGame",
            "payload": {
                "players": [
                    { "seat": 1, "name": "Librarian", "actualCharacter": "librarian" },
                    { "seat": 2, "name": "Dreamer", "actualCharacter": "dreamer" },
                    { "seat": 3, "name": "Scarlet", "actualCharacter": "scarletWoman" },
                    { "seat": 4, "name": "Imp", "actualCharacter": "imp" },
                    { "seat": 5, "name": "Undertaker", "actualCharacter": "undertaker" }
                ]
            }
        }),
    );
    assert_eq!(setup["ok"], true, "{setup}");
    append(&mut game, &setup["value"]["event"]);

    let demon_before = replay(&game);
    assert_eq!(
        demon_before["value"]["currentStep"]["id"],
        "firstNight:system:demonInfo"
    );
    let demon = confirm(
        &game,
        current_step_id(&demon_before),
        Some(json!({ "characterIds": ["saint", "ravenkeeper", "mayor"] })),
    );
    let historical_demon_reveal = demon["value"]["revealPayload"].clone();
    append(&mut game, &demon["value"]["event"]);

    let dreamer_before = replay(&game);
    assert_eq!(
        dreamer_before["value"]["currentStep"]["character"],
        "dreamer"
    );
    let dreamer = confirm(&game, current_step_id(&dreamer_before), None);
    let historical_dreamer_reveal = dreamer["value"]["revealPayload"].clone();
    assert_eq!(
        historical_dreamer_reveal,
        json!({ "kind": "dreamerInformation", "characterIds": ["dreamer", "dreamer"] })
    );
    append(&mut game, &dreamer["value"]["event"]);

    let librarian_before = replay(&game);
    assert_eq!(
        librarian_before["value"]["currentStep"]["character"],
        "librarian"
    );
    let identity = confirm(&game, current_step_id(&librarian_before), None);
    assert_eq!(
        identity["value"]["event"]["payload"]["result"],
        json!({ "kind": "fixtureIdentityChanged", "playerId": "player-1", "targetCharacterId": "spy" })
    );
    append(&mut game, &identity["value"]["event"]);

    let minion_before = replay(&game);
    assert_eq!(
        minion_before["value"]["currentStep"]["id"],
        "firstNight:system:minionInfo"
    );
    let minion = confirm(&game, current_step_id(&minion_before), None);
    let current_minion_reveal = minion["value"]["revealPayload"].clone();
    assert_eq!(
        current_minion_reveal["minionPlayers"],
        json!([
            { "seat": 1, "name": "Librarian" },
            { "seat": 3, "name": "Scarlet" }
        ])
    );
    append(&mut game, &minion["value"]["event"]);

    let after = replay(&game);
    let librarian_row = after["value"]["phaseOverview"]
        .as_array()
        .unwrap()
        .iter()
        .find(|row| row["character"] == "librarian" && row["status"] == "complete")
        .expect("identity completion should retain its original occurrence");
    assert_eq!(
        librarian_row["abilityUse"],
        json!({
            "ownerPlayerId": "player-1",
            "characterId": "librarian",
            "abilityInstanceId": "setup:player-1"
        })
    );

    let parsed = crate::boundary::parse_game_file(&game.to_string()).expect("game should parse");
    let snapshots = crate::game::completed_snapshots_for_tests(parsed)
        .expect("the actual replay fold should expose test snapshots");
    let demon_snapshot = snapshots
        .iter()
        .find(|snapshot| snapshot.step.id == "firstNight:system:demonInfo")
        .expect("demon info snapshot should be retained");
    assert_eq!(
        serde_json::to_value(demon_snapshot.reveal_payload.as_ref().unwrap()).unwrap(),
        historical_demon_reveal
    );
    let minion_snapshot = snapshots
        .iter()
        .find(|snapshot| snapshot.step.id == "firstNight:system:minionInfo")
        .expect("minion info snapshot should be retained");
    assert_eq!(
        serde_json::to_value(minion_snapshot.reveal_payload.as_ref().unwrap()).unwrap(),
        current_minion_reveal
    );
    let dreamer_snapshot = snapshots
        .iter()
        .find(|snapshot| snapshot.step.character.as_deref() == Some("dreamer"))
        .expect("typed information snapshot should be retained");
    assert_eq!(
        serde_json::to_value(dreamer_snapshot.reveal_payload.as_ref().unwrap()).unwrap(),
        historical_dreamer_reveal
    );
}

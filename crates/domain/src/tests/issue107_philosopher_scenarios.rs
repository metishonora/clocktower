use crate::{propose_json, replay_json};
use serde_json::{json, Value};

fn setup_event(demon: &str) -> Value {
    json!({
        "id": "setup-107",
        "type": "setupConfirmed",
        "phase": "setup",
        "payload": { "players": [
            { "id": "player-1", "seat": 1, "name": "Philosopher", "actualCharacter": "philosopher", "shownCharacter": "philosopher" },
            { "id": "player-2", "seat": 2, "name": "Artist", "actualCharacter": "artist", "shownCharacter": "artist" },
            { "id": "player-3", "seat": 3, "name": "Clockmaker", "actualCharacter": "clockmaker", "shownCharacter": "clockmaker" },
            { "id": "player-4", "seat": 4, "name": "Oracle", "actualCharacter": "oracle", "shownCharacter": "oracle" },
            { "id": "player-5", "seat": 5, "name": "Snake Charmer", "actualCharacter": "snakeCharmer", "shownCharacter": "snakeCharmer" },
            { "id": "player-6", "seat": 6, "name": "Mathematician", "actualCharacter": "mathematician", "shownCharacter": "mathematician" },
            { "id": "player-7", "seat": 7, "name": "Cerenovus", "actualCharacter": "cerenovus", "shownCharacter": "cerenovus" },
            { "id": "player-8", "seat": 8, "name": "Demon", "actualCharacter": demon, "shownCharacter": demon }
        ]},
        "summary": "초기 설정 확정: 철학자 회귀",
        "createdAt": "2026-08-04T00:00:00.000Z"
    })
}

fn game(events: &[Value]) -> Value {
    json!({
        "schemaVersion": 3,
        "game": {
            "id": "game-issue-107",
            "name": "Issue 107 Philosopher",
            "scriptId": "sectsAndViolets",
            "createdAt": "2026-08-04T00:00:00.000Z",
            "updatedAt": "2026-08-04T00:00:00.000Z",
            "events": events
        }
    })
}

fn replay(events: &[Value]) -> Value {
    serde_json::from_str(&replay_json(&game(events).to_string())).unwrap()
}

fn propose(events: &[Value], command: Value) -> Value {
    serde_json::from_str(&propose_json(
        &game(events).to_string(),
        &command.to_string(),
    ))
    .unwrap()
}

fn philosopher_step(events: &[Value]) -> Value {
    let state = replay(events);
    assert_eq!(state["ok"], true, "replay failed: {state}");
    let step = state["value"]["currentStep"].clone();
    assert_eq!(step["character"], "philosopher", "state={state}");
    assert_eq!(step["playerId"], "player-1", "state={state}");
    step
}

fn acquisition_proposal(events: &[Value], character_id: &str) -> Value {
    let step = philosopher_step(events);
    propose(
        events,
        json!({ "type": "confirmStep", "payload": {
            "stepId": step["id"],
            "expectedEventCount": events.len(),
            "input": { "characterIds": [character_id] }
        }}),
    )
}

fn append_acquisition(events: &mut Vec<Value>, character_id: &str) -> Value {
    let proposal = acquisition_proposal(events, character_id);
    assert_eq!(
        proposal["ok"], true,
        "Philosopher acquisition is not implemented: {proposal}"
    );
    let event = proposal["value"]["event"].clone();
    events.push(event.clone());
    event
}

fn has_reminder(state: &Value, player_id: &str, token_id: &str) -> bool {
    state["value"]["ruleState"]["automaticReminders"]
        .as_array()
        .is_some_and(|reminders| {
            reminders.iter().any(|reminder| {
                reminder["playerId"] == player_id
                    && reminder["characterId"] == "philosopher"
                    && reminder["tokenId"] == token_id
            })
        })
}

fn has_impairment(state: &Value, player_id: &str, source_event_id: &str) -> bool {
    state["value"]["ruleState"]["activeImpairments"]
        .as_array()
        .is_some_and(|impairments| {
            impairments.iter().any(|impairment| {
                impairment["kind"] == "drunk"
                    && impairment["playerId"] == player_id
                    && impairment["sourceEventId"] == source_event_id
                    && impairment["sourceCharacterId"] == "philosopher"
            })
        })
}

fn philosopher_grant<'a>(state: &'a Value, character_id: &str) -> &'a Value {
    state["value"]["ruleState"]["abilityGrants"]
        .as_array()
        .expect("ability grants projection")
        .iter()
        .find(|grant| grant["ownerPlayerId"] == "player-1" && grant["characterId"] == character_id)
        .expect("active Philosopher grant")
}

#[test]
fn philosopher_step_exposes_the_good_catalog_and_defers_without_spending() {
    let mut events = vec![setup_event("vortox")];
    let step = philosopher_step(&events);
    assert_eq!(step["requiredInput"]["kind"], "characterIds");
    assert_eq!(step["requiredInput"]["minSelections"], 1);
    assert_eq!(step["requiredInput"]["maxSelections"], 1);
    assert_eq!(
        step["requiredInput"]["allowedCharacterIds"],
        json!([
            "clockmaker",
            "dreamer",
            "snakeCharmer",
            "mathematician",
            "flowergirl",
            "townCrier",
            "oracle",
            "savant",
            "seamstress",
            "philosopher",
            "artist",
            "juggler",
            "sage",
            "mutant",
            "sweetheart",
            "barber",
            "klutz"
        ])
    );
    assert_eq!(step["canSkip"], true);

    let proposal = propose(
        &events,
        json!({ "type": "skipStep", "payload": {
            "stepId": step["id"],
            "expectedEventCount": events.len()
        }}),
    );
    assert_eq!(proposal["ok"], true, "defer proposal failed: {proposal}");
    assert_eq!(
        proposal["value"]["event"]["type"],
        "philosopherAbilityResolved"
    );
    assert_eq!(
        proposal["value"]["event"]["payload"]["outcome"]["kind"],
        "deferred"
    );
    events.push(proposal["value"]["event"].clone());
    let after = replay(&events);
    assert_eq!(after["ok"], true, "defer replay failed: {after}");
    assert!(after["value"]["ruleState"]["abilityGrants"]
        .as_array()
        .is_some_and(Vec::is_empty));
}

#[test]
fn out_of_play_dreamer_grant_keeps_identity_and_waits_for_its_first_night_order() {
    let mut events = vec![setup_event("vortox")];
    let base_ability_id = replay(&events)["value"]["players"][0]["abilityInstance"]["id"]
        .as_str()
        .unwrap()
        .to_string();
    let event = append_acquisition(&mut events, "dreamer");
    assert_eq!(event["type"], "philosopherAbilityResolved");
    assert_eq!(event["payload"]["selectedCharacterId"], "dreamer");
    assert_eq!(event["payload"]["actor"]["ownerPlayerId"], "player-1");
    assert_eq!(event["payload"]["actor"]["characterId"], "philosopher");
    assert_eq!(
        event["payload"]["actor"]["abilityInstanceId"],
        base_ability_id
    );
    assert_eq!(event["payload"]["outcome"]["kind"], "acquired");

    let after = replay(&events);
    assert_eq!(after["ok"], true, "acquisition replay failed: {after}");
    let philosopher = &after["value"]["players"][0];
    assert_eq!(philosopher["actualCharacter"], "philosopher");
    assert_eq!(philosopher["shownCharacter"], "philosopher");
    assert_eq!(philosopher["abilityInstance"]["id"], base_ability_id);

    let grant = philosopher_grant(&after, "dreamer");
    assert_eq!(grant["sourceEventId"], event["id"]);
    assert_eq!(grant["sourceAbilityInstanceId"], base_ability_id);
    assert_eq!(
        grant["abilityInstanceId"],
        event["payload"]["outcome"]["grantedAbilityInstanceId"]
    );
    assert_eq!(after["value"]["currentStep"]["id"], "firstNight:minionInfo");
    let overview = after["value"]["phaseOverview"].as_array().unwrap();
    let clockmaker_index = overview
        .iter()
        .position(|step| step["character"] == "clockmaker")
        .unwrap();
    let dreamer_index = overview
        .iter()
        .position(|step| step["character"] == "dreamer" && step["playerId"] == "player-1")
        .unwrap();
    let mathematician_index = overview
        .iter()
        .position(|step| step["character"] == "mathematician")
        .unwrap();
    assert!(clockmaker_index < dreamer_index);
    assert!(dreamer_index < mathematician_index);
    assert!(has_reminder(&after, "player-1", "isThePhilosopher"));
    assert!(!has_impairment(
        &after,
        "player-2",
        event["id"].as_str().unwrap()
    ));
}

#[test]
fn in_play_artist_grant_drinks_only_the_original_artist() {
    let mut events = vec![setup_event("vortox")];
    let event = append_acquisition(&mut events, "artist");
    let after = replay(&events);
    assert_eq!(after["ok"], true, "Artist grant replay failed: {after}");
    philosopher_grant(&after, "artist");

    assert_eq!(
        after["value"]["players"][0]["actualCharacter"],
        "philosopher"
    );
    assert!(has_impairment(
        &after,
        "player-2",
        event["id"].as_str().unwrap()
    ));
    assert!(has_reminder(&after, "player-2", "drunk"));
    assert!(!has_reminder(&after, "player-1", "isThePhilosopher"));
    assert!(!has_reminder(&after, "player-1", "drunk"));
}

#[test]
fn self_selection_is_terminal_self_drunk_without_a_recursive_grant() {
    let mut events = vec![setup_event("vortox")];
    let event = append_acquisition(&mut events, "philosopher");
    assert_eq!(event["payload"]["outcome"]["kind"], "selfDrunk");

    let after = replay(&events);
    assert_eq!(after["ok"], true, "self selection replay failed: {after}");
    assert!(after["value"]["ruleState"]["abilityGrants"]
        .as_array()
        .is_some_and(Vec::is_empty));
    assert!(has_impairment(
        &after,
        "player-1",
        event["id"].as_str().unwrap()
    ));
    assert!(has_reminder(&after, "player-1", "drunk"));
    assert!(!has_reminder(&after, "player-1", "isThePhilosopher"));
    assert_ne!(after["value"]["currentStep"]["character"], "philosopher");
}

#[test]
fn poisoned_selection_consumes_the_use_as_no_effect_without_a_grant() {
    let mut events = vec![setup_event("noDashii")];
    let before = replay(&events);
    assert!(before["value"]["ruleState"]["activeImpairments"]
        .as_array()
        .is_some_and(|impairments| impairments.iter().any(|impairment| {
            impairment["kind"] == "poisoned" && impairment["playerId"] == "player-1"
        })));

    let event = append_acquisition(&mut events, "dreamer");
    assert_eq!(event["payload"]["selectedCharacterId"], "dreamer");
    assert_eq!(event["payload"]["outcome"]["kind"], "noEffect");
    assert!(event["payload"]["outcome"]["impairments"]
        .as_array()
        .is_some_and(|impairments| impairments
            .iter()
            .any(|impairment| impairment["kind"] == "poisoned")));

    let after = replay(&events);
    assert_eq!(after["ok"], true, "no-effect replay failed: {after}");
    assert!(after["value"]["ruleState"]["abilityGrants"]
        .as_array()
        .is_some_and(Vec::is_empty));
    assert!(!has_reminder(&after, "player-1", "isThePhilosopher"));
    assert_ne!(after["value"]["currentStep"]["character"], "dreamer");
}

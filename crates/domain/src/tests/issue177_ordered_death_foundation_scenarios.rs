use crate::replay_json;
use serde_json::{json, Value};

fn fixture() -> Value {
    serde_json::from_str(include_str!(
        "../../../../fixtures/acceptance/shared/issue-177-ordered-death.json"
    ))
    .expect("Issue 177 fixture must be JSON")
}

fn replay(game: &Value) -> Value {
    serde_json::from_str(&replay_json(&game.to_string())).expect("core result must be JSON")
}

fn ordered_event_mut(game: &mut Value) -> &mut Value {
    game["game"]["events"]
        .as_array_mut()
        .expect("events")
        .iter_mut()
        .find(|event| event["type"] == "orderedDeathResolved")
        .expect("ordered Death event")
}

#[test]
fn ordered_action_preserves_provenance_and_applies_targets_in_sequence() {
    let game = fixture();
    let actual = replay(&game);

    assert_eq!(actual["ok"], true, "{actual}");
    assert_eq!(actual["value"]["eventCount"], 2);
    let players = actual["value"]["players"].as_array().expect("players");
    assert_eq!(
        players
            .iter()
            .find(|player| player["id"] == "player-1")
            .expect("prevented target")["alive"],
        true,
        "a prevented attempt must not create a Death"
    );
    assert_eq!(
        players
            .iter()
            .find(|player| player["id"] == "player-2")
            .expect("occurred target")["alive"],
        false,
        "the second ordered resolution must create the actual Death"
    );
    assert_eq!(
        actual["value"]["ruleState"]["unannouncedNightDeathPlayerIds"],
        json!(["player-2"]),
        "first-night public projection must include only actual Deaths in resolution order"
    );

    let persisted = game["game"]["events"][1]["payload"].clone();
    assert_eq!(game["game"]["events"][1]["id"], "ordered-death-event-1");
    assert_eq!(
        persisted["source"]["abilityUse"],
        json!({
            "ownerPlayerId": "player-7",
            "characterId": "shabaloth",
            "abilityInstanceId": "setup:player-7"
        })
    );
    assert_eq!(persisted["resolutions"][0]["sequence"], 1);
    assert_eq!(persisted["resolutions"][1]["sequence"], 2);
}

#[test]
fn malformed_order_prevention_and_bypass_combinations_are_rejected() {
    let mut cases = Vec::new();

    let mut duplicate_sequence = fixture();
    ordered_event_mut(&mut duplicate_sequence)["payload"]["resolutions"][1]["sequence"] = json!(1);
    cases.push(("duplicate sequence", duplicate_sequence));

    let mut missing_sequence = fixture();
    ordered_event_mut(&mut missing_sequence)["payload"]["resolutions"][1]["sequence"] = json!(3);
    cases.push(("missing sequence", missing_sequence));

    let mut reordered = fixture();
    ordered_event_mut(&mut reordered)["payload"]["resolutions"]
        .as_array_mut()
        .expect("resolutions")
        .swap(0, 1);
    cases.push(("array order differs from sequence", reordered));

    let mut missing_applied_candidate = fixture();
    ordered_event_mut(&mut missing_applied_candidate)["payload"]["resolutions"][0]["outcome"]
        ["preventionSequence"] = json!(2);
    cases.push((
        "prevented outcome points to no candidate",
        missing_applied_candidate,
    ));

    let mut contradictory_bypass = fixture();
    ordered_event_mut(&mut contradictory_bypass)["payload"]["resolutions"][0]["attempt"]
        ["bypassPolicy"] = json!({ "kind": "allTargetProtections" });
    cases.push((
        "bypass-all keeps an applied protection",
        contradictory_bypass,
    ));

    let mut occurred_with_applied_protection = fixture();
    ordered_event_mut(&mut occurred_with_applied_protection)["payload"]["resolutions"][0]
        ["outcome"] = json!({ "kind": "occurred", "playerId": "player-1" });
    cases.push((
        "occurred outcome keeps an applied protection",
        occurred_with_applied_protection,
    ));

    let mut no_effect_with_protection_checks = fixture();
    ordered_event_mut(&mut no_effect_with_protection_checks)["payload"]["resolutions"][0]
        ["outcome"] = json!({ "kind": "noEffect", "reason": "targetIneligible" });
    cases.push((
        "no-effect outcome keeps protection checks",
        no_effect_with_protection_checks,
    ));

    for (name, game) in cases {
        let actual = replay(&game);
        assert_eq!(
            actual["error"]["code"], "INVALID_DEATH_RESOLUTION",
            "{name}: {actual}"
        );
        assert!(actual.get("value").is_none(), "{name}: {actual}");
    }
}

#[test]
fn forged_ability_provenance_and_duplicate_action_event_identity_are_rejected() {
    let mut forged = fixture();
    ordered_event_mut(&mut forged)["payload"]["source"]["abilityUse"]["abilityInstanceId"] =
        json!("setup:player-3");
    let forged_actual = replay(&forged);
    assert_eq!(
        forged_actual["error"]["code"], "INVALID_EVENT_REFERENCE",
        "{forged_actual}"
    );

    let mut duplicated = fixture();
    let duplicate_event = duplicated["game"]["events"][1].clone();
    duplicated["game"]["events"]
        .as_array_mut()
        .expect("events")
        .push(duplicate_event);
    let duplicate_actual = replay(&duplicated);
    assert_eq!(
        duplicate_actual["error"]["code"], "DUPLICATE_EVENT_ID",
        "{duplicate_actual}"
    );
}

#[test]
fn execution_occurrence_survives_a_prevented_ordered_death_resolution() {
    let mut game = fixture();
    let execution = json!({
        "id": "execution-1",
        "type": "executionConfirmed",
        "phase": "day",
        "payload": {
            "stepId": "day:execution",
            "input": { "execute": true, "playerId": "player-1" }
        },
        "summary": "처형 확정",
        "createdAt": "2026-08-24T00:04:00.000Z"
    });
    let event = ordered_event_mut(&mut game);
    event["phase"] = json!("day");
    event["payload"]["source"] = json!({
        "kind": "execution",
        "executionEventId": "execution-1"
    });
    event["payload"]["resolutions"]
        .as_array_mut()
        .expect("resolutions")
        .truncate(1);
    game["game"]["events"]
        .as_array_mut()
        .expect("events")
        .insert(1, execution);

    let actual = replay(&game);
    assert_eq!(actual["ok"], true, "{actual}");
    assert_eq!(actual["value"]["eventCount"], 3);
    assert_eq!(
        actual["value"]["players"]
            .as_array()
            .expect("players")
            .iter()
            .find(|player| player["id"] == "player-1")
            .expect("executee")["alive"],
        true,
        "the execution remains canonical while its Death outcome is prevented"
    );
}

#[test]
fn no_effect_is_not_replayed_as_protection_or_death() {
    let mut game = fixture();
    let event = ordered_event_mut(&mut game);
    event["payload"]["resolutions"]
        .as_array_mut()
        .expect("resolutions")
        .push(json!({
            "sequence": 3,
            "attempt": {
                "targetPlayerId": "player-2",
                "bypassPolicy": { "kind": "none" }
            },
            "preventionChecks": [],
            "outcome": { "kind": "noEffect", "reason": "targetAlreadyDead" }
        }));

    let actual = replay(&game);
    assert_eq!(actual["ok"], true, "{actual}");
    assert_eq!(
        actual["value"]["ruleState"]["unannouncedNightDeathPlayerIds"],
        json!(["player-2"]),
        "the no-effect attempt must not duplicate the earlier actual Death"
    );
}

#[test]
fn bypass_policy_is_not_inferred_from_the_source_character_name() {
    let mut game = fixture();
    let setup_players = game["game"]["events"][0]["payload"]["players"]
        .as_array_mut()
        .expect("setup players");
    let assassin = setup_players
        .iter_mut()
        .find(|player| player["id"] == "player-6")
        .expect("Minion source");
    assassin["actualCharacter"] = json!("assassin");
    assassin["shownCharacter"] = json!("assassin");

    let event = ordered_event_mut(&mut game);
    event["payload"]["source"] = json!({
        "kind": "ability",
        "abilityUse": {
            "ownerPlayerId": "player-6",
            "characterId": "assassin",
            "abilityInstanceId": "setup:player-6"
        },
        "abilityOrigin": { "kind": "identityBound" }
    });
    event["payload"]["resolutions"]
        .as_array_mut()
        .expect("resolutions")
        .truncate(1);

    let actual = replay(&game);
    assert_eq!(actual["ok"], true, "{actual}");
    assert_eq!(
        actual["value"]["players"]
            .as_array()
            .expect("players")
            .iter()
            .find(|player| player["id"] == "player-1")
            .expect("target")["alive"],
        true,
        "explicit bypassPolicy:none must win over the Assassin Character name"
    );
}

#[test]
fn representative_legacy_death_event_keeps_its_schema_v3_meaning() {
    let fixture: Value = serde_json::from_str(include_str!(
        "../../../../fixtures/acceptance/trouble-brewing/night-death-public-announcement.json"
    ))
    .expect("legacy fixture JSON");

    let actual = replay(&fixture);
    assert_eq!(actual["ok"], true, "{actual}");
}

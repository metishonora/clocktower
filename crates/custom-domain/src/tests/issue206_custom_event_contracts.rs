use crate::{
    boundary::parse_event,
    model::{AbilityInstanceId, AbilityUseRef, Phase},
    state::{
        ActionOccurrence, ActionOccurrenceIdentity, CustomGameFacts, CustomGameState,
        FirstNightProgress,
    },
};
use serde_json::{json, Value};

fn custom_event() -> Value {
    json!({
        "id": "custom-action-1",
        "type": "customActionConfirmed",
        "phase": "firstNight",
        "payload": {
            "stepId": "firstNight:fixture:player-1:setup-1",
            "actionRef": {
                "kind": "character",
                "characterId": "washerwoman",
                "actionId": "learnTownsfolk"
            },
            "abilityUse": {
                "ownerPlayerId": "player-1",
                "characterId": "washerwoman",
                "abilityInstanceId": "setup-1:player-1"
            },
            "input": null,
            "result": { "kind": "noEffect" }
        },
        "summary": "custom action",
        "createdAt": "2026-09-07T00:00:00.000Z"
    })
}

#[test]
fn custom_action_envelope_round_trips_with_required_provenance_and_typed_result() {
    let parsed = parse_event(custom_event()).expect("custom event should parse");
    let encoded = serde_json::to_value(&parsed).expect("custom event should serialize");
    assert_eq!(encoded, custom_event());
}

#[test]
fn custom_action_envelope_rejects_unknown_common_payload_and_input_fields() {
    let mut unknown_common = custom_event();
    unknown_common["unexpected"] = json!(true);
    assert!(parse_event(unknown_common).is_err());

    let mut unknown_payload = custom_event();
    unknown_payload["payload"]["unexpected"] = json!(true);
    assert!(parse_event(unknown_payload).is_err());

    let mut unknown_input = custom_event();
    unknown_input["payload"]["input"] = json!({ "patch": { "alive": false } });
    assert!(parse_event(unknown_input).is_err());
}

#[test]
fn custom_action_envelope_rejects_missing_provenance_wrong_ref_and_fixture_result_in_production() {
    let mut missing_ability = custom_event();
    missing_ability["payload"]
        .as_object_mut()
        .unwrap()
        .remove("abilityUse");
    assert!(parse_event(missing_ability).is_err());

    let mut system_action = custom_event();
    system_action["payload"]["actionRef"] = json!({
        "kind": "system",
        "actionId": "dawn"
    });
    assert!(parse_event(system_action).is_err());

    let mut fixture_result = custom_event();
    fixture_result["payload"]["result"] = json!({
        "kind": "fixture",
        "value": { "alive": false }
    });
    assert!(parse_event(fixture_result).is_err());
}

#[cfg(feature = "custom-runtime-fixtures")]
#[test]
fn feature_fixture_result_round_trips_only_with_the_fixture_build() {
    let mut fixture_event = custom_event();
    fixture_event["payload"]["result"] = json!({
        "kind": "fixtureAbilityGranted",
        "targetCharacterId": "washerwoman"
    });
    let parsed = parse_event(fixture_event.clone()).expect("fixture build should parse its result");
    assert_eq!(
        serde_json::to_value(parsed).expect("fixture event should serialize"),
        fixture_event
    );

    let mut unknown_fields = fixture_event;
    unknown_fields["payload"]["result"]["unexpected"] = json!(true);
    assert!(parse_event(unknown_fields).is_err());
}

#[test]
fn state_scaffold_keeps_occurrence_identity_and_progress_separate_from_wire_contracts() {
    let action_ref = crate::contracts::FirstNightActionRef::Character {
        character_id: "washerwoman".into(),
        action_id: "learnTownsfolk".into(),
    };
    let ability_use = AbilityUseRef {
        owner_player_id: "player-1".into(),
        character_id: "washerwoman".into(),
        ability_instance_id: AbilityInstanceId::new("setup-1", "player-1"),
    };
    let occurrence = ActionOccurrence::character(action_ref.clone(), ability_use.clone())
        .expect("character occurrence should have matching provenance");
    let identity = occurrence.identity();
    assert_eq!(identity.action_ref, action_ref);
    assert_eq!(identity.ability_use, Some(ability_use));
    assert_eq!(occurrence.actor_player_id(), Some("player-1"));
    assert!(occurrence
        .step_id()
        .unwrap()
        .starts_with("firstNight:washerwoman:"));

    let progress = FirstNightProgress {
        immediate_origins: vec![],
        required_queue: vec![],
        available_occurrences: vec![],
        cursor: 1,
        current_occurrences: vec![occurrence.clone()],
        completed_occurrences: vec![ActionOccurrenceIdentity {
            simulation_source: None,
            follow_up_cause: None,
            action_cause: None,
            action_ref: crate::contracts::FirstNightActionRef::system("dusk"),
            ability_use: None,
        }],
        immediate_queue: vec![occurrence],
        completed_history: vec![],
        excluded_occurrences: vec![],
        ended: false,
    };
    let state = CustomGameState {
        phase: Phase::FirstNight,
        facts: CustomGameFacts::default(),
        progress: progress.clone(),
    };
    assert_eq!(state.progress, progress);
    assert_eq!(state.phase, Phase::FirstNight);
}

use std::collections::HashSet;

use serde_json::{json, Value};

use crate::{
    characters::{custom_script_catalog, resolve_custom_script, rules},
    contracts::{CustomScriptDefinition, ScriptId},
    model::CharacterKind,
    replay_json,
};

fn definition(character_ids: &[&str]) -> CustomScriptDefinition {
    CustomScriptDefinition {
        id: "custom-registry-contract".to_string(),
        name: "Registry contract".to_string(),
        character_ids: character_ids
            .iter()
            .map(|character_id| (*character_id).to_string())
            .collect(),
        first_night_order: None,
    }
}

fn custom_game(character_ids: &[&str]) -> Value {
    json!({
        "schemaVersion": 4,
        "game": {
            "script": {
                "type": "custom",
                "definition": {
                    "id": "custom-registry-contract",
                    "name": "Registry contract",
                    "characterIds": character_ids
                }
            },
            "id": "custom-registry-game",
            "name": "Registry game",
            "createdAt": "2026-09-03T00:00:00.000Z",
            "updatedAt": "2026-09-03T00:00:00.000Z",
            "events": []
        }
    })
}

fn replay(value: &Value) -> Value {
    serde_json::from_str(&replay_json(&value.to_string())).unwrap()
}

#[test]
fn custom_registry_exhaustively_projects_each_tb_and_snv_id_to_one_canonical_kind() {
    let catalog = custom_script_catalog();
    let ids = catalog.iter().map(|entry| entry.id).collect::<HashSet<_>>();

    assert_eq!(catalog.len(), 47);
    assert_eq!(ids.len(), catalog.len());

    let mut kind_counts = [0; 4];
    for entry in &catalog {
        let official_kinds = [ScriptId::TroubleBrewing, ScriptId::SectsAndViolets]
            .into_iter()
            .filter_map(|script_id| rules(script_id).character_kind(entry.id))
            .collect::<Vec<_>>();
        assert!(!official_kinds.is_empty(), "{}", entry.id);
        assert!(
            official_kinds.iter().all(|kind| *kind == entry.kind),
            "{}",
            entry.id
        );
        kind_counts[match entry.kind {
            CharacterKind::Townsfolk => 0,
            CharacterKind::Outsider => 1,
            CharacterKind::Minion => 2,
            CharacterKind::Demon => 3,
        }] += 1;
    }

    assert_eq!(kind_counts, [26, 8, 8, 5]);

    let all_character_ids = catalog.iter().map(|entry| entry.id).collect::<Vec<_>>();
    let context = resolve_custom_script(&definition(&all_character_ids)).unwrap();
    assert_eq!(context.character_ids(), all_character_ids);
    for entry in &catalog {
        assert_eq!(
            context.character_kind(entry.id),
            Some(entry.kind),
            "{}",
            entry.id
        );
    }
}

#[test]
fn mixed_definition_resolves_in_definition_order_with_roster_scoped_membership() {
    let context =
        resolve_custom_script(&definition(&["imp", "clockmaker", "washerwoman", "vortox"]))
            .unwrap();

    assert_eq!(
        context.character_ids(),
        ["imp", "clockmaker", "washerwoman", "vortox"]
    );
    assert!(context.contains("imp"));
    assert!(context.contains("clockmaker"));
    assert_eq!(context.character_kind("imp"), Some(CharacterKind::Demon));
    assert_eq!(
        context.character_kind("clockmaker"),
        Some(CharacterKind::Townsfolk)
    );
    assert!(!context.contains("chef"));
    assert_eq!(context.character_kind("chef"), None);
    assert_eq!(
        context.character_ids_of_kind(CharacterKind::Demon),
        ["imp", "vortox"]
    );
}

#[test]
fn empty_definition_resolves_but_cannot_invent_registry_membership() {
    let context = resolve_custom_script(&definition(&[])).unwrap();

    assert!(context.character_ids().is_empty());
    assert!(!context.contains("imp"));
    assert_eq!(context.character_kind("imp"), None);
}

#[test]
fn unsupported_case_different_and_bmr_ids_are_rejected_before_official_dispatch() {
    for character_id in ["futureCharacter", "Imp", "grandmother"] {
        let game = custom_game(&["washerwoman", character_id, "imp"]);
        let boundary_error = crate::boundary::parse_game_file(&game.to_string())
            .err()
            .expect("unsupported custom Character should fail at the shared GameFile boundary");
        assert_eq!(
            boundary_error.code, "UNSUPPORTED_CUSTOM_SCRIPT_CHARACTER",
            "{character_id}"
        );

        let actual = replay(&game);

        assert_eq!(
            actual["error"]["code"], "UNSUPPORTED_CUSTOM_SCRIPT_CHARACTER",
            "{character_id}: {actual}"
        );
        assert!(actual.get("value").is_none());
    }
}

#[test]
fn supported_custom_ids_pass_registry_resolution_into_custom_setup() {
    let actual = replay(&custom_game(&["washerwoman", "clockmaker", "imp"]));

    assert_eq!(actual["ok"], true, "{actual}");
    assert_eq!(actual["value"]["phase"], "setup");
}

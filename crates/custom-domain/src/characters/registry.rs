use std::collections::{HashMap, HashSet};

use serde::Serialize;

use super::{carousel, sects_and_violets, trouble_brewing};
use crate::{
    contracts::{CustomScriptDefinition, CustomScriptDefinitionDraft},
    error::{CoreError, ErrorKind},
    model::CharacterKind,
};

#[derive(Debug, Serialize, Copy, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CharacterRegistryEntry {
    pub(crate) id: &'static str,
    pub(crate) kind: CharacterKind,
}

/// Authoring/reference metadata only. These entries never become runtime characters.
#[derive(Debug, Serialize, Copy, Clone)]
pub(crate) struct ReferenceCharacterRegistryEntry {
    pub(crate) id: &'static str,
    pub(crate) kind: &'static str,
}

pub(crate) const REFERENCE_CHARACTERS: &[ReferenceCharacterRegistryEntry] =
    &[ReferenceCharacterRegistryEntry {
        id: "deviant",
        kind: "Traveller",
    }];

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ResolvedScriptContext {
    entries: Vec<CharacterRegistryEntry>,
    pub(crate) scheduled_night_deaths: bool,
    related_jinxes: Vec<crate::jinxes::JinxMetadata>,
    kinds_by_id: HashMap<&'static str, CharacterKind>,
}

// Issue #193 establishes this query seam before Epic 1 dispatch consumes it.
#[allow(dead_code)]
impl ResolvedScriptContext {
    pub(crate) fn related_jinxes(&self) -> &[crate::jinxes::JinxMetadata] {
        &self.related_jinxes
    }

    pub(crate) fn character_ids(&self) -> Vec<&'static str> {
        self.entries.iter().map(|entry| entry.id).collect()
    }

    pub(crate) fn contains(&self, character_id: &str) -> bool {
        self.kinds_by_id.contains_key(character_id)
    }

    pub(crate) fn character_kind(&self, character_id: &str) -> Option<CharacterKind> {
        self.kinds_by_id.get(character_id).copied()
    }

    pub(crate) fn character_ids_of_kind(&self, kind: CharacterKind) -> Vec<&'static str> {
        self.entries
            .iter()
            .filter_map(|entry| (entry.kind == kind).then_some(entry.id))
            .collect()
    }

    pub(crate) fn setup_modifiers(
        &self,
        actual_characters: &[String],
    ) -> Vec<crate::contracts::SetupModifier> {
        let active = actual_characters
            .iter()
            .map(String::as_str)
            .collect::<HashSet<_>>();
        self.entries
            .iter()
            .filter(|entry| active.contains(entry.id))
            .filter_map(|entry| {
                let amount = i32::from(trouble_brewing::custom_setup_outsider_delta(entry.id))
                    + i32::from(sects_and_violets::custom_setup_outsider_delta(entry.id));
                (amount != 0).then(|| crate::contracts::SetupModifier {
                    character_id: entry.id.to_owned(),
                    delta: crate::contracts::SetupCountDelta::outsider(amount),
                })
            })
            .collect()
    }
}

#[allow(dead_code)]
pub(crate) fn custom_demon_bluff_character_ids(
    context: &ResolvedScriptContext,
    actual_characters: &[String],
) -> Vec<String> {
    let assigned = actual_characters
        .iter()
        .map(String::as_str)
        .collect::<HashSet<_>>();
    context
        .entries
        .iter()
        .filter(|entry| {
            matches!(
                entry.kind,
                CharacterKind::Townsfolk | CharacterKind::Outsider
            ) && !assigned.contains(entry.id)
        })
        .map(|entry| entry.id.to_string())
        .collect()
}

#[allow(dead_code)]
pub(crate) fn custom_ability_acquisition_character_ids(
    context: &ResolvedScriptContext,
) -> Vec<String> {
    context
        .entries
        .iter()
        .filter(|entry| {
            matches!(
                entry.kind,
                CharacterKind::Townsfolk | CharacterKind::Outsider
            )
        })
        .map(|entry| entry.id.to_string())
        .collect()
}

#[allow(dead_code)]
pub(crate) fn custom_transformation_character_ids(context: &ResolvedScriptContext) -> Vec<String> {
    context
        .entries
        .iter()
        .map(|entry| entry.id.to_string())
        .collect()
}

pub(crate) fn custom_script_catalog() -> Vec<CharacterRegistryEntry> {
    trouble_brewing::custom_registry_entries()
        .into_iter()
        .chain(sects_and_violets::custom_registry_entries())
        .chain(carousel::custom_registry_entries())
        .chain(super::bad_moon_rising::custom_registry_entries())
        .map(|(id, kind)| CharacterRegistryEntry { id, kind })
        .collect()
}

pub(crate) fn validate_custom_script_definition(
    definition: &CustomScriptDefinition,
) -> Result<(), CoreError> {
    validate_custom_script_definition_fields(
        &definition.id,
        &definition.name,
        &definition.character_ids,
        definition.night_order_version,
    )
}

pub(crate) fn validate_custom_script_definition_draft(
    definition: &CustomScriptDefinitionDraft,
) -> Result<(), CoreError> {
    validate_custom_script_definition_fields(
        &definition.id,
        &definition.name,
        &definition.character_ids,
        definition.night_order_version,
    )
}

fn validate_custom_script_definition_fields(
    id: &str,
    name: &str,
    character_ids: &[String],
    night_order_version: Option<u32>,
) -> Result<(), CoreError> {
    if night_order_version.is_some_and(|v| v != 2)
        || id.trim().is_empty()
        || name.trim().is_empty()
        || character_ids
            .iter()
            .any(|character_id| character_id.trim().is_empty())
    {
        return Err(ErrorKind::MalformedCustomScriptDefinition.into_error());
    }

    let mut unique = HashSet::with_capacity(character_ids.len());
    if character_ids
        .iter()
        .any(|character_id| !unique.insert(character_id.as_str()))
    {
        return Err(ErrorKind::DuplicateCustomScriptCharacter.into_error());
    }

    Ok(())
}

pub(crate) fn resolve_custom_script(
    definition: &CustomScriptDefinition,
) -> Result<ResolvedScriptContext, CoreError> {
    let mut context = resolve_custom_script_ids(&definition.character_ids)?;
    context.scheduled_night_deaths = definition.night_order_version == Some(2);
    Ok(context)
}

pub(crate) fn resolve_custom_script_ids(
    character_ids: &[String],
) -> Result<ResolvedScriptContext, CoreError> {
    let catalog = custom_script_catalog()
        .into_iter()
        .map(|entry| (entry.id, entry))
        .collect::<HashMap<_, _>>();
    let mut seen = HashSet::with_capacity(character_ids.len());
    let mut entries = Vec::with_capacity(character_ids.len());

    for character_id in character_ids {
        if !seen.insert(character_id.as_str()) {
            return Err(ErrorKind::DuplicateCustomScriptCharacter.into_error());
        }
        if REFERENCE_CHARACTERS
            .iter()
            .any(|entry| entry.id == character_id)
        {
            continue;
        }
        let entry = catalog
            .get(character_id.as_str())
            .copied()
            .ok_or_else(|| ErrorKind::UnsupportedCustomScriptCharacter.into_error())?;
        entries.push(entry);
    }

    let kinds_by_id = entries.iter().map(|entry| (entry.id, entry.kind)).collect();
    Ok(ResolvedScriptContext {
        scheduled_night_deaths: false,
        entries,
        kinds_by_id,
        related_jinxes: crate::jinxes::production()?.related(character_ids),
    })
}

#[cfg(test)]
mod reference_tests {
    use super::*;
    use serde_json::{json, Value};

    #[test]
    fn reference_only_deviant_does_not_enter_runtime_choices() {
        let ids = vec!["imp".into(), "deviant".into(), "monk".into()];
        let context = resolve_custom_script_ids(&ids).unwrap();
        assert_eq!(context.character_ids(), vec!["imp", "monk"]);
        assert!(!custom_transformation_character_ids(&context).contains(&"deviant".into()));
        assert!(!custom_script_catalog().iter().any(|c| c.id == "deviant"));
        assert!(resolve_custom_script_ids(&["deviant".into(), "deviant".into()]).is_err());
        assert!(resolve_custom_script_ids(&["Deviant".into()]).is_err());
    }

    #[test]
    fn reference_only_pool_preserves_game_replay_but_rejects_deviant_assignment() {
        let mut game: Value = serde_json::from_str(include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../fixtures/acceptance/custom-first-night/compatibility/day.game.json"
        )))
        .unwrap();
        let mut baseline: Value =
            serde_json::from_str(&crate::replay_json(&game.to_string())).unwrap();
        assert_eq!(baseline["ok"], true);
        game["game"]["script"]["definition"]["characterIds"]
            .as_array_mut()
            .unwrap()
            .push(json!("deviant"));
        let result: Value = serde_json::from_str(&crate::replay_json(&game.to_string())).unwrap();
        baseline["value"]["script"] = game["game"]["script"].clone();
        assert_eq!(result, baseline);
        let mut players = game["game"]["events"][0]["payload"]["players"].clone();
        players[0]["actualCharacter"] = json!("deviant");
        players[0]["shownCharacter"] = json!("deviant");
        game["game"]["events"] = json!([]);
        let result: Value = serde_json::from_str(&crate::propose_json(
            &game.to_string(),
            &json!({
                "type":"createGame", "payload": {"players": players}
            })
            .to_string(),
        ))
        .unwrap();
        assert_eq!(result["ok"], false);
        assert_eq!(result["error"]["code"], "CHARACTER_NOT_IN_SCRIPT");
    }
}

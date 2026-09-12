use std::collections::{HashMap, HashSet};

use serde::Serialize;

use super::{sects_and_violets, trouble_brewing};
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

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ResolvedScriptContext {
    entries: Vec<CharacterRegistryEntry>,
    kinds_by_id: HashMap<&'static str, CharacterKind>,
}

// Issue #193 establishes this query seam before Epic 1 dispatch consumes it.
#[allow(dead_code)]
impl ResolvedScriptContext {
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

    pub(crate) fn setup_modifiers(&self, actual_characters: &[String]) -> Vec<crate::contracts::SetupModifier> {
        let active = actual_characters.iter().map(String::as_str).collect::<HashSet<_>>();
        self.entries.iter().filter(|entry| active.contains(entry.id)).filter_map(|entry| {
            let amount = i32::from(trouble_brewing::custom_setup_outsider_delta(entry.id))
                + i32::from(sects_and_violets::custom_setup_outsider_delta(entry.id));
            (amount != 0).then(|| crate::contracts::SetupModifier {
                character_id: entry.id.to_owned(), delta: crate::contracts::SetupCountDelta::outsider(amount)
            })
        }).collect()
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
    )
}

pub(crate) fn validate_custom_script_definition_draft(
    definition: &CustomScriptDefinitionDraft,
) -> Result<(), CoreError> {
    validate_custom_script_definition_fields(
        &definition.id,
        &definition.name,
        &definition.character_ids,
    )
}

fn validate_custom_script_definition_fields(
    id: &str,
    name: &str,
    character_ids: &[String],
) -> Result<(), CoreError> {
    if id.trim().is_empty()
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
    resolve_custom_script_ids(&definition.character_ids)
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
        let entry = catalog
            .get(character_id.as_str())
            .copied()
            .ok_or_else(|| ErrorKind::UnsupportedCustomScriptCharacter.into_error())?;
        entries.push(entry);
    }

    let kinds_by_id = entries.iter().map(|entry| (entry.id, entry.kind)).collect();
    Ok(ResolvedScriptContext {
        entries,
        kinds_by_id,
    })
}

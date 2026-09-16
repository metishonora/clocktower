pub(crate) mod registry;
pub(crate) mod sects_and_violets;
pub(crate) mod trouble_brewing;
pub(crate) use registry::*;

pub(crate) fn character_kind(id: &str) -> Option<crate::model::CharacterKind> {
    custom_script_catalog()
        .into_iter()
        .find(|entry| entry.id == id)
        .map(|entry| entry.kind)
}

pub(crate) fn notifies_identity_change(result: &crate::contracts::CustomActionResult) -> bool {
    trouble_brewing::notifies_identity_change(result) || sects_and_violets::notifies_identity_change(result)
}

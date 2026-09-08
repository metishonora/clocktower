pub(crate) mod registry;
mod sects_and_violets;
mod trouble_brewing;
pub(crate) use registry::*;

pub(crate) fn character_kind(id: &str) -> Option<crate::model::CharacterKind> {
    custom_script_catalog()
        .into_iter()
        .find(|entry| entry.id == id)
        .map(|entry| entry.kind)
}

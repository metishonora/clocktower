pub(crate) mod bad_moon_rising;
pub(crate) mod carousel;
pub(crate) mod registry;
pub(crate) mod sects_and_violets;
pub(crate) mod trouble_brewing;
pub(crate) use registry::*;

pub(crate) fn night_death_rules() -> Vec<crate::night_deaths::SourceRule> {
    #[cfg(feature = "custom-runtime-fixtures")]
    {
        vec![]
    }
    #[cfg(not(feature = "custom-runtime-fixtures"))]
    {
        vec![sects_and_violets::arbitrary_death_rule()]
    }
}

pub(crate) fn character_kind(id: &str) -> Option<crate::model::CharacterKind> {
    custom_script_catalog()
        .into_iter()
        .find(|entry| entry.id == id)
        .map(|entry| entry.kind)
}

pub(crate) fn notifies_identity_change(result: &crate::contracts::CustomActionResult) -> bool {
    trouble_brewing::notifies_identity_change(result)
        || sects_and_violets::notifies_identity_change(result)
}

use crate::model::CharacterKind;
pub(super) fn custom_registry_entries() -> Vec<(&'static str, CharacterKind)> {
    vec![
        ("washerwoman", CharacterKind::Townsfolk),
        ("librarian", CharacterKind::Townsfolk),
        ("investigator", CharacterKind::Townsfolk),
        ("chef", CharacterKind::Townsfolk),
        ("empath", CharacterKind::Townsfolk),
        ("fortuneTeller", CharacterKind::Townsfolk),
        ("undertaker", CharacterKind::Townsfolk),
        ("monk", CharacterKind::Townsfolk),
        ("ravenkeeper", CharacterKind::Townsfolk),
        ("virgin", CharacterKind::Townsfolk),
        ("slayer", CharacterKind::Townsfolk),
        ("soldier", CharacterKind::Townsfolk),
        ("mayor", CharacterKind::Townsfolk),
        ("butler", CharacterKind::Outsider),
        ("drunk", CharacterKind::Outsider),
        ("recluse", CharacterKind::Outsider),
        ("saint", CharacterKind::Outsider),
        ("poisoner", CharacterKind::Minion),
        ("spy", CharacterKind::Minion),
        ("scarletWoman", CharacterKind::Minion),
        ("baron", CharacterKind::Minion),
        ("imp", CharacterKind::Demon),
    ]
}
pub(super) fn custom_setup_outsider_delta(character_id: &str) -> i8 {
    if character_id == "baron" {
        2
    } else {
        0
    }
}

/// Per-check registration choices owned by the custom TB character rules. No identity mutation.
pub(crate) fn registration_allowed(
    actual: &str,
    judgment: &crate::model::RegistrationJudgment,
    context: &super::ResolvedScriptContext,
) -> bool {
    use crate::model::RegistrationValue as R;
    let kind = judgment
        .character_id
        .as_ref()
        .and_then(|id| context.character_kind(id));
    match (actual, judgment.registered_as) {
        ("spy", R::Good) => judgment.character_id.is_none(),
        ("recluse", R::Evil) => judgment.character_id.is_none(),
        ("spy", R::Townsfolk) => {
            judgment.character_id.is_none() || kind == Some(CharacterKind::Townsfolk)
        }
        ("spy", R::Outsider) => {
            judgment.character_id.is_none() || kind == Some(CharacterKind::Outsider)
        }
        ("recluse", R::Minion) => {
            judgment.character_id.is_none() || kind == Some(CharacterKind::Minion)
        }
        ("recluse", R::Demon) => {
            judgment.character_id.is_none() || kind == Some(CharacterKind::Demon)
        }
        _ => false,
    }
}

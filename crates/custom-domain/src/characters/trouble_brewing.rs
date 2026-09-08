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

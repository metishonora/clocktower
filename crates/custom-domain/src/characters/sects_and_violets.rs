use crate::model::CharacterKind;
pub(super) fn custom_registry_entries() -> Vec<(&'static str, CharacterKind)> {
    vec![
        ("clockmaker", CharacterKind::Townsfolk),
        ("dreamer", CharacterKind::Townsfolk),
        ("snakeCharmer", CharacterKind::Townsfolk),
        ("mathematician", CharacterKind::Townsfolk),
        ("flowergirl", CharacterKind::Townsfolk),
        ("townCrier", CharacterKind::Townsfolk),
        ("oracle", CharacterKind::Townsfolk),
        ("savant", CharacterKind::Townsfolk),
        ("seamstress", CharacterKind::Townsfolk),
        ("philosopher", CharacterKind::Townsfolk),
        ("artist", CharacterKind::Townsfolk),
        ("juggler", CharacterKind::Townsfolk),
        ("sage", CharacterKind::Townsfolk),
        ("mutant", CharacterKind::Outsider),
        ("sweetheart", CharacterKind::Outsider),
        ("barber", CharacterKind::Outsider),
        ("klutz", CharacterKind::Outsider),
        ("evilTwin", CharacterKind::Minion),
        ("witch", CharacterKind::Minion),
        ("cerenovus", CharacterKind::Minion),
        ("pitHag", CharacterKind::Minion),
        ("fangGu", CharacterKind::Demon),
        ("vigormortis", CharacterKind::Demon),
        ("noDashii", CharacterKind::Demon),
        ("vortox", CharacterKind::Demon),
    ]
}
pub(super) fn custom_setup_outsider_delta(character_id: &str) -> i8 {
    match character_id {
        "fangGu" => 1,
        "vigormortis" => -1,
        _ => 0,
    }
}

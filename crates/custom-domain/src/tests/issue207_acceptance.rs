//! Production registry ownership is exact and independent of fixture registration.
#[test]
fn all_snv_handlers_are_registered_with_nine_first_night_entries() {
    use crate::contracts::FirstNightActionRef;
    let registrations = crate::characters::sects_and_violets::registrations();
    let mut refs = registrations
        .iter()
        .map(|r| match &r.spec.action_ref {
            FirstNightActionRef::Character {
                character_id,
                action_id,
            } => format!("{character_id}:{action_id}"),
            _ => panic!("not a character"),
        })
        .collect::<Vec<_>>();
    refs.sort();
    assert_eq!(
        refs,
        vec![
            "barber:swapCharacters",
            "cerenovus:assignMadness",
            "clockmaker:learnSteps",
            "dreamer:learnCharacters",
            "evilTwin:assignTwin",
            "evilTwin:learnTwin",
            "fangGu:attackPlayer",
            "flowergirl:learnDemonVoted",
            "juggler:learnJuggles",
            "mathematician:learnCount",
            "mutant:resolveMadnessExecution",
            "noDashii:attackPlayer",
            "oracle:learnDeadEvilCount",
            "philosopher:chooseAbility",
            "pitHag:changeCharacter",
            "pitHag:chooseDeaths",
            "sage:learnDemon",
            "seamstress:compareAlignments",
            "snakeCharmer:choosePlayer",
            "sweetheart:makeDrunk",
            "townCrier:learnMinionNominated",
            "vigormortis:attackPlayer",
            "vigormortis:choosePoison",
            "vortox:attackPlayer",
            "witch:chooseCursedPlayer",
        ]
    );
    assert_eq!(
        registrations
            .iter()
            .filter(|r| r.spec.participates_in_first_night)
            .count(),
        9
    );
    assert!(registrations
        .iter()
        .all(|r| r.spec.action_ref == *r.handler.action_ref()));
}

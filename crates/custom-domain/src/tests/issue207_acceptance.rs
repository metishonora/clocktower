//! Production registry ownership is exact and independent of fixture registration.
#[test]
fn nine_ordered_snv_handlers_and_two_additional_actions_are_registered() {
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
            "cerenovus:assignMadness",
            "clockmaker:learnSteps",
            "dreamer:learnCharacters",
            "evilTwin:assignTwin",
            "evilTwin:learnTwin",
            "mathematician:learnCount",
            "mutant:resolveMadnessExecution",
            "philosopher:chooseAbility",
            "seamstress:compareAlignments",
            "snakeCharmer:choosePlayer",
            "witch:chooseCursedPlayer"
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

//! Production registry ownership is exact and independent of fixture registration.
#[test]
fn exactly_nine_distinct_snv_production_handlers_are_registered() {
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
            "evilTwin:learnTwin",
            "mathematician:learnCount",
            "philosopher:chooseAbility",
            "seamstress:compareAlignments",
            "snakeCharmer:choosePlayer",
            "witch:chooseCursedPlayer"
        ]
    );
    assert!(registrations.iter().all(
        |r| r.spec.participates_in_first_night && r.spec.action_ref == *r.handler.action_ref()
    ));
}

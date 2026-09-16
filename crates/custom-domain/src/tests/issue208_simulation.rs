//! Bounded provenance; these are not substitutes for Production Drunk/Philosopher scenarios.
use crate::{
    characters::resolve_custom_script_ids,
    contracts::{FirstNightActionRef, SetupPlayerInput},
    setup::player_from_setup_input_for_custom,
    state::CustomGameFacts,
};
#[test]
fn initial_drunk_has_shown_townsfolk_guidance_without_an_actual_grant_or_red_herring() {
    let context = resolve_custom_script_ids(&["drunk".into(), "fortuneTeller".into()]).unwrap();
    let player = player_from_setup_input_for_custom(
        &context,
        &SetupPlayerInput {
            id: Some("drunk".into()),
            seat: 1,
            name: "Drunk".into(),
            actual_character: "drunk".into(),
            shown_character: Some("fortuneTeller".into()),
        },
    )
    .unwrap();
    let mut state = CustomGameFacts::from_players(vec![player]);
    let action = |id: &str| FirstNightActionRef::Character {
        character_id: "fortuneTeller".into(),
        action_id: id.into(),
    };
    let occurrences = crate::simulation::occurrences(&state, &action("checkDemon")).unwrap();
    assert_eq!(occurrences.len(), 1);
    assert!(occurrences[0].ability_use.is_none());
    assert!(state.ability_grants.is_empty());
    assert!(
        crate::simulation::occurrences(&state, &action("assignRedHerring"))
            .unwrap()
            .is_empty()
    );
    state.players[0].alive = false;
    assert!(
        crate::simulation::occurrences(&state, &action("checkDemon"))
            .unwrap()
            .is_empty()
    );
}

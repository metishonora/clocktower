//! Bounded fact contracts; these do not stand in for Production acquisition acceptance.
use crate::{
    characters::{resolve_custom_script_ids, ResolvedScriptContext},
    contracts::{
        ActiveImpairment, ImpairmentExpiry, ImpairmentKind, PhilosopherChoiceFact,
        PhilosopherChoiceOutcome, SetupPlayerInput,
    },
    model::{AbilityInstanceId, AbilityUseRef},
    setup::player_from_setup_input_for_custom,
    state::CustomGameFacts,
};
pub(super) fn failed_choice() -> (ResolvedScriptContext, CustomGameFacts) {
    let context =
        resolve_custom_script_ids(&["philosopher".into(), "dreamer".into(), "noDashii".into()])
            .unwrap();
    let player = player_from_setup_input_for_custom(
        &context,
        &SetupPlayerInput {
            id: Some("p1".into()),
            seat: 1,
            name: "p1".into(),
            actual_character: "philosopher".into(),
            shown_character: None,
        },
    )
    .unwrap();
    let source = AbilityUseRef {
        owner_player_id: player.id.clone(),
        character_id: "philosopher".into(),
        ability_instance_id: player.ability_instance.id.clone(),
    };
    let mut facts = CustomGameFacts::from_players(vec![player]);
    facts.philosopher_choices.push(PhilosopherChoiceFact {
        source_event_id: "choice".into(),
        ability_use: source,
        character_id: "dreamer".into(),
        outcome: PhilosopherChoiceOutcome::Failed,
    });
    facts.active_impairments.push(ActiveImpairment {
        kind: ImpairmentKind::Poisoned,
        player_id: "p1".into(),
        source_event_id: "setup".into(),
        source_character_id: "noDashii".into(),
        expires: ImpairmentExpiry::WhileSourceAbilityActive,
    });
    (context, facts)
}
#[test]
fn simulation_recovery_and_source_loss_remove_participation_without_grants_or_rechoice() {
    use crate::{
        characters::sects_and_violets::simulation_occurrences, contracts::FirstNightActionRef,
    };
    let (_, facts) = failed_choice();
    let action = FirstNightActionRef::Character {
        character_id: "dreamer".into(),
        action_id: "learnCharacters".into(),
    };
    let initial = simulation_occurrences(&facts, &action).unwrap();
    assert_eq!(initial.len(), 1);
    assert!(initial[0].ability_use.is_none());
    assert_eq!(
        initial[0]
            .simulation_source
            .as_ref()
            .unwrap()
            .source_ability_use
            .character_id,
        "philosopher"
    );
    assert!(facts.ability_grants.is_empty());
    let mut recovered = facts.clone();
    recovered.active_impairments.clear();
    assert!(simulation_occurrences(&recovered, &action)
        .unwrap()
        .is_empty());
    assert_eq!(recovered.philosopher_choices, facts.philosopher_choices);
    let mut replaced = facts.clone();
    replaced.players[0].ability_instance.id = AbilityInstanceId::new("replacement", "p1");
    assert!(simulation_occurrences(&replaced, &action)
        .unwrap()
        .is_empty());
    assert_eq!(simulation_occurrences(&facts, &action).unwrap(), initial);
}

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

/// Failed-choice participation references the real source and exists only while impairment lasts.
pub(crate) fn simulation_occurrences(
    facts: &crate::state::CustomGameFacts,
    action_ref: &crate::contracts::FirstNightActionRef,
) -> Result<Vec<crate::state::ActionOccurrence>, crate::error::CoreError> {
    use crate::contracts::{
        FirstNightActionRef, PhilosopherChoiceOutcome, PhilosopherSimulationSource,
    };
    let FirstNightActionRef::Character { character_id, .. } = action_ref else {
        return Ok(vec![]);
    };
    let mut choices = facts
        .philosopher_choices
        .iter()
        .filter(|choice| {
            choice.outcome == PhilosopherChoiceOutcome::Failed
                && choice.character_id == *character_id
                && crate::reducer::current_ability_instance(facts, &choice.ability_use)
                && facts
                    .player(&choice.ability_use.owner_player_id)
                    .is_some_and(|p| p.alive)
                && facts
                    .active_impairments
                    .iter()
                    .any(|i| i.player_id == choice.ability_use.owner_player_id)
        })
        .collect::<Vec<_>>();
    // Stable sort retains confirmation order for the same owner.
    choices.sort_by_key(|choice| {
        facts
            .player(&choice.ability_use.owner_player_id)
            .map(|p| (p.seat, p.id.clone()))
    });
    choices
        .into_iter()
        .map(|choice| {
            crate::state::ActionOccurrence::from_parts(
                action_ref.clone(),
                None,
                Some(PhilosopherSimulationSource {
                    selection_event_id: choice.source_event_id.clone(),
                    source_ability_use: choice.ability_use.clone(),
                }),
                None,
            )
        })
        .collect()
}

/// Effect folding seam shared by Setup and confirmed facts. Character policies are added in Task 4.
pub(crate) fn resolve_effects(
    _context: &crate::characters::ResolvedScriptContext,
    _facts: &mut crate::state::CustomGameFacts,
) -> Result<(), crate::error::CoreError> {
    Ok(())
}

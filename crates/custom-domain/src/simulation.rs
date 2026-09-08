//! Guidance sources and usage, derived only from real identities and confirmed choices.
use crate::{
    contracts::{
        CustomActionResult, FirstNightActionRef, GuidanceCause, PhilosopherChoiceOutcome,
        PhilosopherSimulationSource,
    },
    error::CoreError,
    model::AbilityUseRef,
    reducer::current_ability_instance,
    state::{ActionOccurrence, CustomGameFacts},
};
#[derive(Clone)]
pub(crate) struct Guidance {
    pub(crate) source: PhilosopherSimulationSource,
    pub(crate) character_id: String,
}
fn living(facts: &CustomGameFacts, source: &AbilityUseRef) -> bool {
    current_ability_instance(facts, source)
        && facts
            .player(&source.owner_player_id)
            .is_some_and(|p| p.alive)
}
pub(crate) fn sources(facts: &CustomGameFacts) -> Vec<Guidance> {
    let mut roots = vec![];
    for choice in &facts.philosopher_choices {
        if choice.outcome == PhilosopherChoiceOutcome::Failed
            && choice.character_id != "philosopher"
            && living(facts, &choice.ability_use)
            && crate::effects::impaired(facts, &choice.ability_use.owner_player_id)
        {
            roots.push(Guidance {
                source: PhilosopherSimulationSource {
                    selection_event_id: choice.source_event_id.clone(),
                    source_ability_use: choice.ability_use.clone(),
                    guidance: None,
                },
                character_id: choice.character_id.clone(),
            });
        }
    }
    for player in &facts.players {
        if player.actual_character == "drunk" && player.alive {
            roots.push(Guidance {
                source: PhilosopherSimulationSource {
                    selection_event_id: player.ability_instance.source_event_id.clone(),
                    source_ability_use: AbilityUseRef {
                        owner_player_id: player.id.clone(),
                        character_id: "drunk".into(),
                        ability_instance_id: player.ability_instance.id.clone(),
                    },
                    guidance: Some(GuidanceCause::InitialDrunk),
                },
                character_id: player.shown_character.clone(),
            });
        }
    }
    for grant in &facts.ability_grants {
        if grant.character_id != "drunk" {
            continue;
        }
        let source = AbilityUseRef {
            owner_player_id: grant.owner_player_id.clone(),
            character_id: grant.character_id.clone(),
            ability_instance_id: grant.ability_instance_id.clone(),
        };
        if !living(facts, &source) {
            continue;
        }
        if let Some(preparation) = facts.preparations.iter().rev().find(|p| {
            p.occurrence.ability_use.as_ref() == Some(&source)
                && matches!(p.result, CustomActionResult::ShownCharacterAssigned { .. })
        }) {
            if let CustomActionResult::ShownCharacterAssigned { character_id } = &preparation.result
            {
                roots.push(Guidance {
                    source: PhilosopherSimulationSource {
                        selection_event_id: preparation.event_id.clone(),
                        source_ability_use: source,
                        guidance: Some(GuidanceCause::AcquiredDrunk),
                    },
                    character_id: character_id.clone(),
                });
            }
        }
    }
    for choice in &facts.confirmed_actions {
        let CustomActionResult::SimulationChoice {
            character_id: Some(character_id),
            spent: true,
        } = &choice.result
        else {
            continue;
        };
        if character_id == "philosopher" {
            continue;
        }
        let Some(parent) = &choice.occurrence.simulation_source else {
            continue;
        };
        if roots
            .iter()
            .any(|g| g.source == *parent && g.character_id == "philosopher")
        {
            roots.push(Guidance {
                source: PhilosopherSimulationSource {
                    selection_event_id: choice.event_id.clone(),
                    source_ability_use: parent.source_ability_use.clone(),
                    guidance: Some(GuidanceCause::Choice {
                        parent_event_id: parent.selection_event_id.clone(),
                    }),
                },
                character_id: character_id.clone(),
            });
        }
    }
    roots.sort_by_key(|g| {
        facts
            .player(&g.source.source_ability_use.owner_player_id)
            .map(|p| (p.seat, p.id.clone()))
    });
    roots
}
pub(crate) fn occurrences(
    facts: &CustomGameFacts,
    action_ref: &FirstNightActionRef,
) -> Result<Vec<ActionOccurrence>, CoreError> {
    let FirstNightActionRef::Character {
        character_id,
        action_id,
    } = action_ref
    else {
        return Ok(vec![]);
    };
    if matches!(
        action_id.as_str(),
        "assignRedHerring" | "assignShownCharacter" | "assignTwin" | "resolveMadnessExecution"
    ) {
        return Ok(vec![]);
    }
    sources(facts)
        .into_iter()
        .filter(|g| g.character_id == *character_id)
        .map(|g| ActionOccurrence::from_parts(action_ref.clone(), None, Some(g.source), None))
        .collect()
}
pub(crate) fn spent(facts: &CustomGameFacts, source: &PhilosopherSimulationSource) -> bool {
    facts.confirmed_actions.iter().any(|fact| {
        fact.occurrence.simulation_source.as_ref() == Some(source)
            && matches!(
                fact.result,
                CustomActionResult::Simulation { spent: true, .. }
                    | CustomActionResult::SimulationChoice { spent: true, .. }
            )
    })
}

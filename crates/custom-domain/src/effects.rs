//! Common, deterministic effect evaluation. Character modules provide candidate rules;
//! this module evaluates source dependencies against one snapshot per iteration.
use crate::{
    characters::ResolvedScriptContext,
    contracts::*,
    error::{CoreError, ErrorKind},
    model::AbilityUseRef,
    reducer::current_ability_instance,
    state::{CustomGameFacts, DurableImpairment},
};
#[derive(Clone)]
pub(crate) struct ImpairmentEffect {
    pub(crate) effect: DurableImpairment,
    pub(crate) requires_source: bool,
    pub(crate) ignore_self: bool,
    pub(crate) demon_harm: bool,
}
pub(crate) fn impaired(facts: &CustomGameFacts, player: &str) -> bool {
    facts
        .active_impairments
        .iter()
        .any(|e| e.player_id == player)
}
pub(crate) fn effective(facts: &CustomGameFacts, source: &AbilityUseRef) -> bool {
    current_ability_instance(facts, source)
        && facts
            .player(&source.owner_player_id)
            .is_some_and(|p| p.alive)
        && !impaired(facts, &source.owner_player_id)
}
pub(crate) fn impairment_causes(facts: &CustomGameFacts, player: &str) -> Vec<AbilityUseRef> {
    let mut result = vec![];
    for e in &facts.resolved_impairments {
        if e.impairment.player_id == player && !result.contains(&e.source_ability_use) {
            result.push(e.source_ability_use.clone());
        }
    }
    result
}
fn ordered(mut effects: Vec<DurableImpairment>) -> Vec<DurableImpairment> {
    effects.sort_by_key(|e| {
        (
            e.impairment.player_id.clone(),
            e.impairment.source_event_id.clone(),
            e.source_ability_use.owner_player_id.clone(),
            e.source_ability_use.ability_instance_id.clone(),
        )
    });
    effects.dedup();
    effects
}
pub(crate) fn resolve_effects(
    context: &ResolvedScriptContext,
    facts: &mut CustomGameFacts,
) -> Result<(), CoreError> {
    let previous = std::mem::take(&mut facts.resolved_impairments);
    facts
        .active_impairments
        .retain(|e| !previous.iter().any(|old| old.impairment == *e));
    let lost = facts
        .philosopher_choices
        .iter()
        .filter(|c| !current_ability_instance(facts, &c.ability_use))
        .map(|c| c.source_event_id.clone())
        .collect::<Vec<_>>();
    facts
        .ability_grants
        .retain(|g| !lost.contains(&g.source_event_id));
    let baseline = facts.active_impairments.clone();
    let mut candidates = facts
        .durable_impairments
        .iter()
        .cloned()
        .map(|effect| ImpairmentEffect {
            effect,
            requires_source: false,
            ignore_self: false,
            demon_harm: false,
        })
        .collect::<Vec<_>>();
    candidates.extend(crate::characters::trouble_brewing::impairment_candidates(
        facts,
    ));
    candidates.extend(crate::characters::sects_and_violets::impairment_candidates(
        context, facts,
    ));
    let mut active = vec![];
    let mut seen = vec![];
    loop {
        let mut view = facts.clone();
        view.active_impairments = baseline.clone();
        view.active_impairments.extend(
            active
                .iter()
                .map(|e: &DurableImpairment| e.impairment.clone()),
        );
        let next = ordered(
            candidates
                .iter()
                .filter(|candidate| {
                    let mut source_view = view.clone();
                    if candidate.ignore_self {
                        source_view
                            .active_impairments
                            .retain(|e| e != &candidate.effect.impairment);
                    }
                    if candidate.requires_source
                        && !effective(&source_view, &candidate.effect.source_ability_use)
                    {
                        return false;
                    }
                    if candidate.demon_harm {
                        // An effect blocked by Soldier cannot be used to invalidate that protection.
                        let mut protection_view = view.clone();
                        protection_view.active_impairments.retain(|e| {
                            !candidates
                                .iter()
                                .any(|c| c.demon_harm && c.effect.impairment == *e)
                        });
                        if crate::characters::trouble_brewing::demon_protected(
                            &protection_view,
                            &candidate.effect.impairment.player_id,
                        ) {
                            return false;
                        }
                    }
                    true
                })
                .map(|c| c.effect.clone())
                .collect(),
        );
        if next == active {
            break;
        }
        if seen.contains(&next) {
            return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
        }
        seen.push(active);
        active = next;
    }
    facts.active_impairments = baseline;
    for e in &active {
        if !facts.active_impairments.contains(&e.impairment) {
            facts.active_impairments.push(e.impairment.clone());
        }
    }
    facts.resolved_impairments = active;
    crate::characters::sects_and_violets::refresh_assignments(facts)?;
    crate::characters::trouble_brewing::refresh_assignments(facts);
    Ok(())
}

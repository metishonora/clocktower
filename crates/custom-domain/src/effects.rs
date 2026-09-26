mod lifetime;
pub(crate) use lifetime::*;
// Character modules provide candidates; one evaluator resolves their dependencies.
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
    pub(crate) demon_harm: bool,
}
pub(crate) fn impaired(facts: &CustomGameFacts, player: &str) -> bool {
    facts.active_impairments.iter().any(|e| {
        e.player_id == player && !crate::characters::carousel::scoped_self_impairment(facts, e)
    })
}
pub(crate) fn ability_impaired(facts: &CustomGameFacts, source: &AbilityUseRef) -> bool {
    !ability_impairments(facts, source).is_empty()
}
pub(crate) fn ability_impairments<'a>(
    facts: &'a CustomGameFacts,
    source: &AbilityUseRef,
) -> Vec<&'a ActiveImpairment> {
    let granted = crate::characters::carousel::boffin_granted(facts, source);
    facts
        .active_impairments
        .iter()
        .filter(|e| {
            e.player_id == source.owner_player_id
                && crate::characters::carousel::scoped_self_impairment(facts, e) == granted
        })
        .collect()
}
pub(crate) fn occurrence_impairment_kinds(
    facts: &CustomGameFacts,
    o: &crate::state::ActionOccurrence,
) -> Vec<ImpairmentKind> {
    let impairments = if let Some(source) = &o.ability_use {
        ability_impairments(facts, source)
    } else {
        facts
            .active_impairments
            .iter()
            .filter(|e| Some(e.player_id.as_str()) == o.actor_player_id())
            .collect()
    };
    let mut kinds = vec![];
    for impairment in impairments {
        if !kinds.contains(&impairment.kind) {
            kinds.push(impairment.kind);
        }
    }
    kinds
}
pub(crate) fn occurrence_impaired(
    facts: &CustomGameFacts,
    o: &crate::state::ActionOccurrence,
) -> bool {
    o.simulation_source.is_some()
        || o.ability_use
            .as_ref()
            .is_some_and(|s| ability_impaired(facts, s))
}
pub(crate) fn available(facts: &CustomGameFacts, source: &AbilityUseRef) -> bool {
    current_ability_instance(facts, source)
        && !crate::characters::carousel::preacher_suppressed(facts, source)
        && crate::characters::carousel::grant_enabled(facts, source)
}
pub(crate) fn suppressed(facts: &CustomGameFacts, source: &AbilityUseRef) -> bool {
    crate::characters::carousel::preacher_suppressed(facts, source)
}
pub(crate) fn effective(facts: &CustomGameFacts, source: &AbilityUseRef) -> bool {
    available(facts, source)
        && facts.player(&source.owner_player_id).is_some_and(|p| {
            p.alive || crate::characters::sects_and_violets::vigor_retains(facts, source)
        })
        && !ability_impaired(facts, source)
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
    crate::characters::carousel::expire_preacher(facts);
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
                    if candidate.effect.self_interaction == SelfInteraction::IgnoreOwnContribution {
                        source_view
                            .active_impairments
                            .retain(|e| e != &candidate.effect.impairment);
                    }
                    if !evaluate_rule(&source_view, &candidate.effect.rule).active() {
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
    facts.evaluated_effects = candidates
        .iter()
        .map(|c| {
            let mut view = facts.clone();
            if c.effect.self_interaction == SelfInteraction::IgnoreOwnContribution {
                view.active_impairments
                    .retain(|e| e != &c.effect.impairment);
            }
            let mut status = evaluate_rule(&view, &c.effect.rule);
            if status.active() && !facts.resolved_impairments.contains(&c.effect) {
                status = EffectStatus::Suspended(SuspendReason::Protected);
            }
            lifetime::evaluated(
                EffectCandidate {
                    kind: match c.effect.impairment.kind {
                        ImpairmentKind::Poisoned => EffectKind::Poison,
                        ImpairmentKind::Drunk => EffectKind::Drunk,
                    },
                    origin: c.effect.source_ability_use.clone(),
                    event_id: c.effect.impairment.source_event_id.clone(),
                    target: c.effect.impairment.player_id.clone(),
                    rule: c.effect.rule.clone(),
                    ended: false,
                },
                status,
            )
        })
        .collect();
    let assignments = crate::characters::sects_and_violets::effect_candidates(facts)
        .into_iter()
        .chain(crate::characters::trouble_brewing::effect_candidates(facts))
        .map(|c| evaluate(facts, c))
        .collect::<Vec<_>>();
    facts.evaluated_effects.extend(assignments);
    crate::characters::sects_and_violets::refresh_assignments(facts)?;
    crate::characters::trouble_brewing::refresh_assignments(facts);
    Ok(())
}

//! Registered sources for the single scheduled Storyteller death resolution.
//! Sources own activation and order preferences; this module owns common selection,
//! canonical source ordering and the read-only view consumed by the UI.
use crate::{
    characters::ResolvedScriptContext,
    contracts::{CustomActionResult, FirstNightActionRef},
    error::{CoreError, ErrorKind},
    event::{CustomFactChanges, PlayerLifeChange},
    model::{AbilityUseRef, StepInput, StepInputFields},
    state::{ConfirmedActionFact, CustomGameFacts},
};

pub(crate) struct SourceRule {
    pub(crate) trigger: FirstNightActionRef,
    pub(crate) default_after: Vec<FirstNightActionRef>,
    pub(crate) sources: fn(&CustomGameFacts) -> Vec<&ConfirmedActionFact>,
}
pub(crate) fn rules_for(context: &ResolvedScriptContext) -> Vec<SourceRule> {
    crate::characters::night_death_rules().into_iter().filter(|rule| {
        matches!(&rule.trigger, FirstNightActionRef::Character { character_id, .. } if context.contains(character_id))
    }).collect()
}
fn sources(facts: &CustomGameFacts) -> Vec<&ConfirmedActionFact> {
    let registered: Vec<_> = crate::characters::night_death_rules()
        .iter()
        .flat_map(|rule| (rule.sources)(facts))
        .map(|event| event.event_id.as_str())
        .collect();
    // Registration order never changes source attribution or persisted event order.
    facts
        .confirmed_actions
        .iter()
        .filter(|event| registered.contains(&event.event_id.as_str()))
        .collect()
}
fn resolved(facts: &CustomGameFacts) -> bool {
    facts.confirmed_actions.iter().any(|event| {
        event.occurrence.night == facts.night_number()
            && matches!(event.result, CustomActionResult::NightDeathsResolved { .. })
    })
}
pub(crate) fn pending_sources(facts: &CustomGameFacts) -> Vec<&ConfirmedActionFact> {
    if resolved(facts) {
        vec![]
    } else {
        sources(facts)
    }
}
pub(crate) fn resolve(
    facts: &CustomGameFacts,
    input: &StepInput,
) -> Result<(CustomActionResult, CustomFactChanges), CoreError> {
    let invalid = || ErrorKind::InvalidFirstNightActionProvenance.into_error();
    let sources = pending_sources(facts);
    let source = sources.first().ok_or_else(invalid)?;
    let fields = input.as_ref().ok_or_else(invalid)?;
    let targets = fields.player_ids.clone().ok_or_else(invalid)?;
    if fields
        != &(StepInputFields {
            player_ids: Some(targets.clone()),
            ..Default::default()
        })
        || targets
            .iter()
            .collect::<std::collections::HashSet<_>>()
            .len()
            != targets.len()
        || targets
            .iter()
            .any(|id| !facts.player(id).is_some_and(|p| p.alive))
    {
        return Err(invalid());
    }
    Ok((
        CustomActionResult::NightDeathsResolved {
            player_ids: targets.clone(),
            source_event_ids: sources.iter().map(|s| s.event_id.clone()).collect(),
        },
        CustomFactChanges::default()
            .with_death_source(source.occurrence.clone())
            .with_life_changes(
                targets
                    .into_iter()
                    .map(|player_id| PlayerLifeChange {
                        player_id,
                        alive: false,
                    })
                    .collect(),
            ),
    ))
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SourceView {
    event_id: String,
    ability_use: AbilityUseRef,
}
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NightDeathsView {
    status: &'static str,
    sources: Vec<SourceView>,
    pending_attack_event_ids: Vec<String>,
}
pub(crate) fn view(facts: &CustomGameFacts, enabled: bool) -> Option<NightDeathsView> {
    if !enabled {
        return None;
    }
    let sources = sources(facts);
    let first = sources.first()?;
    let pending = !resolved(facts);
    let pending_attack_event_ids = if pending {
        facts
            .confirmed_actions
            .iter()
            .skip_while(|event| event.event_id != first.event_id)
            .filter(|event| {
                event.occurrence.night == facts.night_number()
                    && matches!(
                        event.result,
                        CustomActionResult::NightAttack { died: false, .. }
                    )
            })
            .map(|event| event.event_id.clone())
            .collect()
    } else {
        vec![]
    };
    Some(NightDeathsView {
        status: if pending { "pending" } else { "resolved" },
        sources: sources
            .iter()
            .filter_map(|event| {
                event
                    .occurrence
                    .ability_use
                    .clone()
                    .map(|ability_use| SourceView {
                        event_id: event.event_id.clone(),
                        ability_use,
                    })
            })
            .collect(),
        pending_attack_event_ids,
    })
}

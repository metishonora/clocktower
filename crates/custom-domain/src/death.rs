//! One query for actual death attempts. Character modules own protection policy.
//! Decisions and consumption are replay-derived; this is not a saved command queue.
use crate::{
    contracts::AbilityUseRecord,
    model::AbilityUseRef,
    state::{ActionOccurrence, CustomGameFacts},
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Prevention {
    pub(crate) source: AbilityUseRef,
    pub(crate) consumed: bool,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Outcome {
    pub(crate) player_id: String,
    pub(crate) died: bool,
    pub(crate) prevention: Option<Prevention>,
    pub(crate) source_character_id: Option<String>,
}
pub(crate) struct Attempt<'a> {
    pub(crate) player_id: &'a str,
    pub(crate) execution: bool,
    pub(crate) unpreventable: bool,
}
pub(crate) type ProtectionRule = fn(&CustomGameFacts, &Attempt<'_>) -> Option<Prevention>;

pub(crate) fn decide(facts: &CustomGameFacts, attempt: Attempt<'_>) -> Outcome {
    let alive = facts.player(attempt.player_id).is_some_and(|p| p.alive);
    let prevention = if alive && !attempt.unpreventable {
        crate::characters::death_protection_rules()
            .into_iter()
            .find_map(|rule| rule(facts, &attempt))
    } else {
        None
    };
    Outcome {
        player_id: attempt.player_id.into(),
        died: alive && prevention.is_none(),
        prevention,
        source_character_id: None,
    }
}
pub(crate) type ConsumptionRule = fn(&CustomGameFacts, &Outcome) -> Vec<AbilityUseRef>;
pub(crate) fn consume(facts: &mut CustomGameFacts, outcome: &Outcome, event: &str) {
    let mut sources = outcome
        .prevention
        .as_ref()
        .filter(|p| p.consumed)
        .map(|p| p.source.clone())
        .into_iter()
        .collect::<Vec<_>>();
    for rule in crate::characters::death_consumption_rules() {
        sources.extend(rule(facts, outcome));
    }
    for source in sources {
        if !facts
            .ability_uses
            .iter()
            .any(|used| used.ability_use == source)
        {
            facts.ability_uses.push(AbilityUseRecord {
                source_event_id: event.into(),
                ability_use: source,
            });
        }
    }
}
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub(crate) struct NightResolution {
    pub(crate) unpreventable_player_ids: Vec<String>,
    pub(crate) outcomes: Vec<Outcome>,
    pub(crate) sources: Vec<(String, ActionOccurrence)>,
}
impl NightResolution {
    pub(crate) fn deaths(&self) -> Vec<String> {
        self.outcomes
            .iter()
            .filter(|o| o.died)
            .map(|o| o.player_id.clone())
            .collect()
    }
}
pub(crate) type FollowUpRule =
    fn(&CustomGameFacts, &ActionOccurrence, &str) -> Vec<(String, ActionOccurrence)>;
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Record {
    pub(crate) event_id: String,
    pub(crate) outcomes: Vec<Outcome>,
}
pub(crate) fn night(
    facts: &CustomGameFacts,
    source: &ActionOccurrence,
    targets: &[String],
    unpreventable: bool,
) -> NightResolution {
    let mut view = facts.clone();
    let mut result = NightResolution::default();
    let mut pending: std::collections::VecDeque<_> = targets
        .iter()
        .cloned()
        .map(|id| (id, source.clone(), unpreventable))
        .collect();
    while let Some((id, source, bypass)) = pending.pop_front() {
        if result.outcomes.iter().any(|o: &Outcome| o.player_id == id) {
            continue;
        }
        let mut outcome = decide(
            &view,
            Attempt {
                player_id: &id,
                execution: false,
                unpreventable: bypass,
            },
        );
        outcome.source_character_id = source.ability_use.as_ref().map(|s| s.character_id.clone());
        consume(&mut view, &outcome, "death-preview");
        if bypass {
            result.unpreventable_player_ids.push(id.clone());
        }
        if outcome.died {
            for rule in crate::characters::death_follow_up_rules() {
                pending.extend(
                    rule(&view, &source, &id)
                        .into_iter()
                        .map(|(id, source)| (id, source, false)),
                );
            }
            if let Some(p) = view.players.iter_mut().find(|p| p.id == id) {
                p.alive = false;
            }
            result.sources.push((id, source));
        }
        result.outcomes.push(outcome);
    }
    result
}

pub(crate) type AuditRule = fn(
    &CustomGameFacts,
    Option<&ActionOccurrence>,
    &Attempt<'_>,
    &Outcome,
    &str,
) -> Vec<crate::state::MalfunctionEvidence>;
pub(crate) fn audit(
    f: &CustomGameFacts,
    source: Option<&ActionOccurrence>,
    attempt: &Attempt<'_>,
    outcome: &Outcome,
    event: &str,
) -> Vec<crate::state::MalfunctionEvidence> {
    crate::characters::death_audit_rules()
        .into_iter()
        .flat_map(|rule| rule(f, source, attempt, outcome, event))
        .collect()
}

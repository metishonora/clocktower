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
#[derive(Clone, Copy)]
pub(crate) struct Attempt<'a> {
    pub(crate) player_id: &'a str,
    pub(crate) execution: bool,
    pub(crate) unpreventable: bool,
}
pub(crate) type ProtectionRule = fn(&CustomGameFacts, &Attempt<'_>) -> Option<Prevention>;

pub(crate) fn decide(facts: &CustomGameFacts, attempt: Attempt<'_>) -> Outcome {
    let alive = facts.player(attempt.player_id).is_some_and(|p| p.alive);
    let prevention = if alive && !attempt.unpreventable {
        protection(facts, &attempt)
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
/// The same source-bound query also explains a protection bypass before consumption.
pub(crate) fn protection(facts: &CustomGameFacts, attempt: &Attempt<'_>) -> Option<Prevention> {
    crate::characters::death_protection_rules()
        .into_iter()
        .find_map(|rule| rule(facts, attempt))
}

/// Read-only event-prefix explanations. These never enter a confirmed event or GameFile.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Explanation {
    pub(crate) player_id: String,
    pub(crate) reason: Reason,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub(crate) enum Reason {
    Protection {
        source: AbilityUseRef,
    },
    BypassedProtection {
        source: AbilityUseRef,
    },
    AlreadyDead,
    Impaired {
        source: AbilityUseRef,
        impairments: Vec<crate::contracts::ImpairmentKind>,
    },
    Redirected {
        source: AbilityUseRef,
    },
}
pub(crate) fn explanations(
    facts: &CustomGameFacts,
    attempt: &Attempt<'_>,
    outcome: &Outcome,
) -> Vec<Explanation> {
    let reason = if !facts.player(attempt.player_id).is_some_and(|p| p.alive) {
        Some(Reason::AlreadyDead)
    } else if let Some(prevention) = &outcome.prevention {
        Some(Reason::Protection {
            source: prevention.source.clone(),
        })
    } else if attempt.unpreventable {
        protection(
            facts,
            &Attempt {
                unpreventable: false,
                ..*attempt
            },
        )
        .map(|p| Reason::BypassedProtection { source: p.source })
    } else {
        None
    };
    reason
        .into_iter()
        .map(|reason| Explanation {
            player_id: attempt.player_id.into(),
            reason,
        })
        .collect()
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
    pub(crate) explanations: Vec<Explanation>,
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
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(crate) explanations: Vec<Explanation>,
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
        let attempt = Attempt {
            player_id: &id,
            execution: false,
            unpreventable: bypass,
        };
        let mut outcome = decide(&view, attempt);
        result
            .explanations
            .extend(explanations(&view, &attempt, &outcome));
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
        }
        // A prevented follow-up still belongs to its own ability, not the initiating attack.
        result.sources.push((id, source));
        result.outcomes.push(outcome);
    }
    result
}

/// Character policies select the failed effect; this helper retains the actual cause.
pub(crate) fn ability_failure(
    source: &ActionOccurrence,
    cause: &AbilityUseRef,
    effect: crate::state::FailedEffect,
    event: &str,
) -> Vec<crate::state::MalfunctionEvidence> {
    let Some(actor) = source.actor_player_id() else {
        return vec![];
    };
    if source.ability_use.as_ref() == Some(cause) {
        return vec![];
    }
    vec![crate::state::MalfunctionEvidence {
        daytime_step_id: None,
        cause_details: vec![],
        event_id: event.into(),
        occurrence: source.clone(),
        subject_player_id: actor.into(),
        outcome: crate::state::MalfunctionOutcome::EffectFailure { effect },
        causes: vec![cause.clone()],
    }]
}
pub(crate) fn prevented_failure(
    source: Option<&ActionOccurrence>,
    attempt: &Attempt<'_>,
    outcome: &Outcome,
    effect: crate::state::FailedEffect,
    event: &str,
) -> Vec<crate::state::MalfunctionEvidence> {
    // Execution abilities promise an execution, not a death (e.g. Virgin).
    if attempt.execution {
        return vec![];
    }
    match (source, &outcome.prevention) {
        (Some(source), Some(protection)) => {
            ability_failure(source, &protection.source, effect, event)
        }
        _ => vec![],
    }
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

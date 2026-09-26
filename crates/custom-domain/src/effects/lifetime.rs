//! Replay-derived effect validity. Origin explains an effect; a binding maintains it.
//! No serialized status or character-name fallback is accepted here.
use crate::{model::AbilityUseRef, reducer::current_ability_instance, state::CustomGameFacts};

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum EffectBinding {
    Ability(AbilityUseRef),
    DeathAbility(AbilityUseRef),
    ResultingIdentity(AbilityUseRef),
}
impl EffectBinding {
    pub(crate) fn source(&self) -> &AbilityUseRef {
        match self {
            Self::Ability(s) | Self::DeathAbility(s) | Self::ResultingIdentity(s) => s,
        }
    }
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum SelfInteraction {
    Suppress,
    IgnoreOwnContribution,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum EffectWindow {
    NoDeadline,
    ThroughDay(u16),
    Night(u32),
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct EffectRule {
    pub(crate) binding: EffectBinding,
    pub(crate) window: EffectWindow,
    pub(crate) established: bool,
}
impl EffectRule {
    pub(crate) fn ability(source: &AbilityUseRef, window: EffectWindow, established: bool) -> Self {
        Self {
            binding: EffectBinding::Ability(source.clone()),
            window,
            established,
        }
    }
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum EndReason {
    BindingLost,
    PeriodEnded,
    SourceDied,
    RuleEnded,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum SuspendReason {
    AbilityUnavailable,
    Impaired,
    Protected,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum EffectStatus {
    Active,
    NotApplied,
    Ended(EndReason),
    Suspended(SuspendReason),
}
impl EffectStatus {
    pub(crate) fn active(self) -> bool {
        self == Self::Active
    }
    pub(crate) fn visible(self) -> bool {
        !matches!(self, Self::Ended(_))
    }
    pub(crate) fn inactive_reason(self) -> Option<String> {
        match self {
            Self::Active | Self::Ended(_) => None,
            Self::NotApplied => Some("발동 당시 능력 무효".into()),
            Self::Suspended(SuspendReason::Impaired) => Some("원천 능력 취함·중독".into()),
            Self::Suspended(SuspendReason::AbilityUnavailable) => Some("원천 능력 비활성".into()),
            Self::Suspended(SuspendReason::Protected) => Some("대상 보호 중".into()),
        }
    }
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum EffectKind {
    Poison,
    Drunk,
    Curse,
    Madness,
    Master,
    Protection,
    Twin,
}
#[derive(Debug, Clone)]
pub(crate) struct EffectCandidate {
    pub(crate) kind: EffectKind,
    pub(crate) origin: AbilityUseRef,
    pub(crate) event_id: String,
    pub(crate) target: String,
    pub(crate) rule: EffectRule,
    /// A character-owned permanent boundary (e.g. a replaced relationship).
    pub(crate) ended: bool,
}
#[derive(Debug, Clone)]
pub(crate) struct EvaluatedEffect {
    candidate: EffectCandidate,
    status: EffectStatus,
}
impl EvaluatedEffect {
    pub(crate) fn matches(
        &self,
        kind: EffectKind,
        event: &str,
        source: &AbilityUseRef,
        target: &str,
    ) -> bool {
        self.candidate.kind == kind
            && self.candidate.event_id == event
            && self.candidate.origin == *source
            && self.candidate.target == target
    }
    pub(crate) fn status(&self) -> EffectStatus {
        self.status
    }
    pub(crate) fn kind(&self) -> EffectKind {
        self.candidate.kind
    }
    pub(crate) fn origin(&self) -> &AbilityUseRef {
        &self.candidate.origin
    }
    pub(crate) fn target(&self) -> &str {
        &self.candidate.target
    }
    pub(crate) fn event_id(&self) -> &str {
        &self.candidate.event_id
    }
}
pub(crate) fn evaluate_rule(f: &CustomGameFacts, rule: &EffectRule) -> EffectStatus {
    let in_period = match rule.window {
        EffectWindow::NoDeadline => true,
        EffectWindow::ThroughDay(day) => f.day.as_ref().is_none_or(|d| {
            if d.stage == crate::day::contracts::DayStage::Night {
                u32::from(day) > d.day
            } else {
                u32::from(day) == d.day
            }
        }),
        EffectWindow::Night(night) => {
            f.night_number() == night
                && f.day
                    .as_ref()
                    .is_none_or(|d| d.stage == crate::day::contracts::DayStage::Night)
        }
    };
    if !in_period {
        return EffectStatus::Ended(EndReason::PeriodEnded);
    }
    let source = rule.binding.source();
    let owned = match &rule.binding {
        EffectBinding::ResultingIdentity(s) => f.player(&s.owner_player_id).is_some_and(|p| {
            p.ability_instance.id == s.ability_instance_id && p.actual_character == s.character_id
        }),
        _ => current_ability_instance(f, source),
    };
    if !owned {
        return EffectStatus::Ended(EndReason::BindingLost);
    }
    if !matches!(rule.binding, EffectBinding::DeathAbility(_))
        && !f.player(&source.owner_player_id).is_some_and(|p| {
            p.alive || crate::characters::sects_and_violets::vigor_retains(f, source)
        })
    {
        return EffectStatus::Ended(EndReason::SourceDied);
    }
    if !rule.established {
        return EffectStatus::NotApplied;
    }
    if !super::available(f, source) {
        return EffectStatus::Suspended(SuspendReason::AbilityUnavailable);
    }
    if super::ability_impaired(f, source) {
        return EffectStatus::Suspended(SuspendReason::Impaired);
    }
    EffectStatus::Active
}
pub(crate) fn evaluate(f: &CustomGameFacts, candidate: EffectCandidate) -> EvaluatedEffect {
    let status = if candidate.ended {
        EffectStatus::Ended(EndReason::RuleEnded)
    } else {
        evaluate_rule(f, &candidate.rule)
    };
    EvaluatedEffect { candidate, status }
}
pub(super) fn evaluated(candidate: EffectCandidate, status: EffectStatus) -> EvaluatedEffect {
    EvaluatedEffect { candidate, status }
}
pub(crate) fn status(
    f: &CustomGameFacts,
    kind: EffectKind,
    event: &str,
    source: &AbilityUseRef,
    target: &str,
) -> EffectStatus {
    f.evaluated_effects
        .iter()
        .find(|e| e.matches(kind, event, source, target))
        .map_or(
            EffectStatus::Ended(EndReason::BindingLost),
            EvaluatedEffect::status,
        )
}

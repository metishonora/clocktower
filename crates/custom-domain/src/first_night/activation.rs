//! Pure activation decisions for newly owned first-night ability instances.
//!
//! The scheduler owns the cursor and queues, while this module owns only the small rule boundary
//! that decides how a newly available instance enters the current night.  Production currently
//! has no Character activation policy here: [`NoActionActivation`] deliberately suppresses new
//! instances until a Character rule supplies an explicit decision.  Tests and the fixture build
//! can inject a rule without teaching the common scheduler any Character-specific behavior.

use crate::{
    contracts::FirstNightActionRef,
    error::{CoreError, ErrorKind},
    first_night::ValidatedActionEvent,
    state::{ActionOccurrence, CustomGameFacts},
};

/// How a newly owned occurrence is admitted to the first-night progress model.
#[derive(Debug, Copy, Clone, PartialEq, Eq)]
pub(crate) enum ActivationDecision {
    /// Run after the triggering event and before ordinary ordered traversal resumes.
    RunImmediately,
    /// Leave the occurrence in its ordered entry when that entry has not been passed.
    JoinPendingOrder,
    /// Do not add this occurrence to this night's execution targets.
    Defer,
    /// The change does not create an execution target for this occurrence.
    NoAction,
}

/// Read-only context supplied to an activation rule.  A rule may inspect both fact prefixes and
/// the event that caused the ownership change, but cannot mutate progress or enqueue an action.
pub(crate) struct ActivationContext<'a> {
    pub(crate) event: &'a ValidatedActionEvent,
    pub(crate) previous_facts: &'a CustomGameFacts,
    pub(crate) next_facts: &'a CustomGameFacts,
    pub(crate) action_ref: &'a FirstNightActionRef,
    pub(crate) occurrence: &'a ActionOccurrence,
    /// Zero-based position of the confirmed event in this first-night prefix.  The scheduler
    /// supplies it so an activation rule can reason about stream order without looking at event
    /// IDs or timestamps.
    pub(crate) event_stream_index: usize,
    pub(crate) entry_index: usize,
    pub(crate) cursor: usize,
}

/// Injectable, pure activation policy.  Implementations must return a decision solely from the
/// supplied read-only context; the scheduler remains the only owner of cursor and queue state.
pub(crate) trait ActivationRule {
    fn decide(&self, context: &ActivationContext<'_>) -> Result<ActivationDecision, CoreError>;
}

/// Common production boundary until Character-specific activation policies are implemented.
/// Existing ownership is still projected by the scheduler; only newly owned instances receive
/// this default and therefore do not auto-run merely because they exist.
#[derive(Debug, Copy, Clone, Default)]
pub(crate) struct NoActionActivation;

impl ActivationRule for NoActionActivation {
    fn decide(&self, context: &ActivationContext<'_>) -> Result<ActivationDecision, CoreError> {
        if context.occurrence.ability_use.is_none()
            || !matches!(context.action_ref, FirstNightActionRef::Character { .. })
        {
            return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
        }
        Ok(ActivationDecision::NoAction)
    }
}

/// Naming used by the scheduler and fixture tests.  The alias keeps the public concept focused on
/// the first-night boundary while allowing callers to provide any pure rule implementation.
pub(crate) use ActivationRule as FirstNightActivationRule;

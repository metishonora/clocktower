use crate::{
    contracts::{FirstNightActionRef, FirstNightOrderPlan},
    error::{CoreError, ErrorKind},
    model::{AbilityOrigin, PhaseStep},
    state::{
        ActionOccurrence, CompletedActionOccurrence, CompletedActionSnapshot,
        FirstNightProgress as SchedulerProgress,
    },
};
use std::cmp::Ordering;

use super::{
    activation::{ActivationContext, ActivationDecision, ActivationRule},
    ActionContext, ActionRegistry, ValidatedActionEvent,
};

/// Pure first-night progress scheduler.  It owns neither Game facts nor Character outcomes: it
/// reads a prior/next rule view, identifies the confirmed occurrence, and calculates a new
/// cursor/occurrence/queue/history value.
pub(crate) struct NightScheduler<'a> {
    plan: &'a FirstNightOrderPlan,
    registry: &'a ActionRegistry,
    activation: &'a dyn ActivationRule,
    legacy_initial: bool,
}

impl<'a> NightScheduler<'a> {
    pub(crate) fn new(
        plan: &'a FirstNightOrderPlan,
        registry: &'a ActionRegistry,
        activation: &'a dyn ActivationRule,
    ) -> Self {
        Self {
            plan,
            registry,
            activation,
            legacy_initial: false,
        }
    }

    /// Replay-only admission of the old setup-preparation prefix. New proposals never use it.
    pub(crate) fn with_legacy_initial(mut self) -> Self {
        self.legacy_initial = true;
        self
    }

    pub(crate) fn legacy_initial_candidate(
        &self,
        context: &ActionContext<'_>,
        progress: &SchedulerProgress,
    ) -> Result<Option<ActionOccurrence>, CoreError> {
        if !progress.completed_history.iter().all(|entry| is_setup_preparation(&entry.occurrence)) {
            return Ok(None);
        }
        Ok(self.registry.additional_candidates(self.plan, context, progress, false)?
            .into_iter().next().filter(is_setup_preparation))
    }

    /// Older logs prepared every owner at an entry before any owner disclosed.
    /// Replay may admit only the next such preparation at the same configured entry.
    pub(crate) fn legacy_ordered_preparation_candidate(
        &self, context: &ActionContext<'_>, progress: &SchedulerProgress,
    ) -> Result<Option<ActionOccurrence>, CoreError> {
        let Some(action) = self.plan.0.get(progress.cursor) else { return Ok(None); };
        Ok(self.registry.additional_candidates(self.plan, context, progress, false)?
            .into_iter().find(|o| is_setup_preparation(o)
                && self.registry.linked_action(&o.action_ref).as_ref() == Some(action)))
    }

    /// Calculate initial progress from the current facts.  Dusk and every empty entry are
    /// passed permanently as the cursor advances; no action is auto-admitted by this call.
    pub(crate) fn initial_progress(
        &self,
        context: &ActionContext<'_>,
    ) -> Result<SchedulerProgress, CoreError> {
        let mut progress = SchedulerProgress::default();
        normalize_progress(self.plan, self.registry, context, &mut progress, false)?;
        Ok(progress)
    }

    /// Calculate progress after one already-validated event and an already-computed next facts
    /// view.  The previous progress, facts, and event are all borrowed read-only.  Completion is
    /// identified before any next-facts projection or activation admission occurs.
    pub(crate) fn advance(
        &self,
        previous: &SchedulerProgress,
        previous_context: &ActionContext<'_>,
        next_context: &ActionContext<'_>,
        event: &ValidatedActionEvent,
    ) -> Result<SchedulerProgress, CoreError> {
        self.advance_with_snapshot(previous, previous_context, next_context, event, None)
    }

    /// Variant used by the runtime fold when it has captured the exact Step/Reveal projection for
    /// the pre-event prefix. The scheduler still owns completion identity and ordering; the
    /// snapshot is merely carried alongside that identity for the projector.
    pub(crate) fn advance_with_snapshot(
        &self,
        previous: &SchedulerProgress,
        previous_context: &ActionContext<'_>,
        next_context: &ActionContext<'_>,
        event: &ValidatedActionEvent,
        snapshot: Option<CompletedActionSnapshot>,
    ) -> Result<SchedulerProgress, CoreError> {
        if previous.ended {
            return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
        }

        let mut next = previous.clone();
        dedupe_immediate_queue(&mut next);
        normalize_progress(self.plan, self.registry, previous_context, &mut next, self.legacy_initial)?;
        let occurrence = event.occurrence()?;
        let is_immediate = next
            .immediate_queue
            .first()
            .map(|candidate| candidate.identity() == occurrence.identity())
            .unwrap_or(false);
        let is_current = next
            .current_occurrences
            .first()
            .map(|candidate| candidate.identity() == occurrence.identity())
            .unwrap_or(false);

        if next.is_completed(&occurrence) || next.is_excluded(&occurrence) {
            return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
        }
        let is_required = next
            .required_queue
            .first()
            .is_some_and(|candidate| candidate == &occurrence);
        let is_optional = next.available_occurrences.contains(&occurrence);
        // Required preparations cannot be bypassed. Optional choices otherwise preserve cursor.
        if !next.required_queue.is_empty() && !is_required {
            return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
        }
        // Immediate work has strict precedence over the ordered cursor.  Likewise, only the
        // first occurrence in an entry may be confirmed at a time.
        if !is_required && !is_optional && !next.immediate_queue.is_empty() && !is_immediate {
            return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
        }
        if !is_required && !is_optional && next.immediate_queue.is_empty() && !is_current {
            return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
        }

        // This is intentionally before `admit_new_instances`: a source occurrence remains
        // complete even when its ability disappears from next facts, and re-projection cannot
        // repeat it under a replacement instance.
        let event_stream_index = next.completed_history.len();
        mark_completed(&mut next, &occurrence, event.event_id(), snapshot)?;

        if is_required {
            next.required_queue.remove(0);
        } else if is_optional {
            next.available_occurrences
                .retain(|candidate| candidate != &occurrence);
        } else if is_immediate {
            next.immediate_queue.remove(0);
        } else {
            next.current_occurrences.remove(0);
        }

        if is_dawn(&occurrence) {
            if !next.immediate_queue.is_empty() {
                return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
            }
            next.current_occurrences.clear();
            next.required_queue.clear();
            next.available_occurrences.clear();
            next.ended = true;
            next.cursor = self.plan.0.len();
            return Ok(next);
        }

        // Queue cleanup is based on the after-event rule view.  A removed or no-longer-
        // participating occurrence is not left as stale immediate work; completed history above
        // is deliberately retained.
        retain_live_immediate_queue(&mut next, self.registry, next_context)?;
        admit_new_instances(
            self.plan,
            &mut next,
            previous_context,
            next_context,
            event,
            event_stream_index,
            self.activation,
        )?;
        if let (Some(previous_facts), Some(next_facts)) = (
            previous_context.rule_service.facts(),
            next_context.rule_service.facts(),
        ) {
            let followups = self.registry.follow_up_candidates(
                self.plan,
                &super::activation::FollowUpContext {
                    previous_facts,
                    next_facts,
                    event,
                    event_stream_index,
                },
            )?;
            for occurrence in followups {
                if !next.is_terminal(&occurrence) && !next.immediate_queue.contains(&occurrence) {
                    next.immediate_queue.push(occurrence);
                }
            }
        }
        // Admission can add an immediate candidate whose action-specific projection is currently
        // suppressed.  Run the same projection-based cleanup after admission so stale queue rows
        // do not survive merely because ownership exists in the common rule service.
        retain_live_immediate_queue(&mut next, self.registry, next_context)?;
        normalize_progress(self.plan, self.registry, next_context, &mut next, false)?;
        Ok(next)
    }
}

/// Construct a pure scheduler for callers that prefer a free function over the small
/// [`NightScheduler`] wrapper.
pub(crate) fn initial_progress(
    plan: &FirstNightOrderPlan,
    registry: &ActionRegistry,
    context: &ActionContext<'_>,
) -> Result<SchedulerProgress, CoreError> {
    NightScheduler::new(plan, registry, &super::activation::NoActionActivation)
        .initial_progress(context)
}

/// Calculate the next state using an injected activation rule.  This is the main test and fixture
/// seam; the production default intentionally returns `NoAction` for newly owned instances.
pub(crate) fn advance_progress(
    plan: &FirstNightOrderPlan,
    registry: &ActionRegistry,
    previous: &SchedulerProgress,
    previous_context: &ActionContext<'_>,
    next_context: &ActionContext<'_>,
    event: &ValidatedActionEvent,
    activation: &dyn ActivationRule,
) -> Result<SchedulerProgress, CoreError> {
    NightScheduler::new(plan, registry, activation).advance(
        previous,
        previous_context,
        next_context,
        event,
    )
}

/// Same as [`advance_progress`] with an internal historical projection attached to the newly
/// completed occurrence. This keeps the public scheduler contract small while allowing the actual
/// custom runtime to preserve information revealed by an earlier facts prefix.
pub(crate) fn advance_progress_with_snapshot(
    plan: &FirstNightOrderPlan,
    registry: &ActionRegistry,
    previous: &SchedulerProgress,
    previous_context: &ActionContext<'_>,
    next_context: &ActionContext<'_>,
    event: &ValidatedActionEvent,
    activation: &dyn ActivationRule,
    snapshot: Option<CompletedActionSnapshot>,
) -> Result<SchedulerProgress, CoreError> {
    NightScheduler::new(plan, registry, activation).advance_with_snapshot(
        previous,
        previous_context,
        next_context,
        event,
        snapshot,
    )
}

/// A Step paired with the occurrence that produced it. The pair is an internal projection helper;
/// callers must retain the occurrence as the completion key rather than parsing the Step ID.
#[derive(Debug, Clone)]
pub(crate) struct ProjectedOccurrenceStep {
    pub(crate) occurrence: ActionOccurrence,
    pub(crate) step: PhaseStep,
}

/// Project all currently eligible pending occurrences using the same scheduler eligibility rules
/// used while advancing a replay. Ordered entries before the cursor are never reopened, and an
/// occurrence already in the immediate queue is never duplicated in its ordered entry.
pub(crate) fn project_pending_steps(
    plan: &FirstNightOrderPlan,
    registry: &ActionRegistry,
    context: &ActionContext<'_>,
    progress: &SchedulerProgress,
) -> Result<Vec<ProjectedOccurrenceStep>, CoreError> {
    if context
        .rule_service
        .facts()
        .is_some_and(|f| f.game_end.is_some())
    {
        return Ok(vec![]);
    }
    let mut normalized = progress.clone();
    dedupe_immediate_queue(&mut normalized);
    retain_live_immediate_queue(&mut normalized, registry, context)?;
    normalize_progress(plan, registry, context, &mut normalized, false)?;

    let pending_preparations = registry.additional_candidates(plan, context, &normalized, false)?;
    let mut projected = Vec::new();
    let mut seen = Vec::new();
    for occurrence in normalized
        .required_queue
        .iter()
        .chain(&normalized.immediate_queue)
        .chain(&pending_preparations)
    {
        if normalized.is_terminal(occurrence)
            || seen
                .iter()
                .any(|identity: &crate::state::ActionOccurrenceIdentity| {
                    *identity == occurrence.identity()
                })
        {
            continue;
        }
        let step = project_occurrence_step(registry, context, occurrence)?;
        seen.push(occurrence.identity());
        projected.push(ProjectedOccurrenceStep {
            occurrence: occurrence.clone(),
            step,
        });
    }

    for action_ref in plan.0.iter().skip(normalized.cursor) {
        if character_entry_has_no_nonterminal_occurrence(action_ref, context, &normalized)? {
            continue;
        }
        for occurrence in project_occurrences(action_ref, registry, context)? {
            if normalized.is_terminal(&occurrence)
                || normalized
                    .immediate_queue
                    .iter()
                    .any(|queued| queued.identity() == occurrence.identity())
                || seen
                    .iter()
                    .any(|identity| *identity == occurrence.identity())
            {
                continue;
            }
            let step = project_occurrence_step(registry, context, &occurrence)?;
            seen.push(occurrence.identity());
            projected.push(ProjectedOccurrenceStep { occurrence, step });
        }
    }
    Ok(projected)
}

/// Find the exact projected Step for one occurrence. This is the common bridge used for event
/// validation, historical snapshots, and the public current-step projection.
pub(crate) fn project_occurrence_step(
    registry: &ActionRegistry,
    context: &ActionContext<'_>,
    occurrence: &ActionOccurrence,
) -> Result<PhaseStep, CoreError> {
    registry
        .project_occurrence(context, occurrence)?
        .ok_or_else(|| ErrorKind::InvalidFirstNightActionProvenance.into_error())
}

fn occurrence_from_step(step: &PhaseStep) -> Result<ActionOccurrence, CoreError> {
    ActionOccurrence::from_step(step)
}

fn is_setup_preparation(occurrence: &ActionOccurrence) -> bool {
    matches!(&occurrence.action_cause,
        Some(crate::contracts::ActionCause::InitialPreparation { source_event_id }) if source_event_id == "setup")
}

fn normalize_progress(
    plan: &FirstNightOrderPlan,
    registry: &ActionRegistry,
    context: &ActionContext<'_>,
    progress: &mut SchedulerProgress,
    legacy_initial: bool,
) -> Result<(), CoreError> {
    if progress.ended
        || context
            .rule_service
            .facts()
            .is_some_and(|facts| facts.game_end.is_some())
    {
        progress.current_occurrences.clear();
        progress.immediate_queue.clear();
        progress.required_queue.clear();
        progress.available_occurrences.clear();
        return Ok(());
    }
    let required = registry.additional_candidates(plan, context, progress, false)?;
    progress.required_queue = required.iter().filter(|o| legacy_initial || !is_setup_preparation(o)).cloned().collect();
    progress.available_occurrences = if progress.required_queue.is_empty() {
        registry.additional_candidates(plan, context, progress, true)?
    } else {
        vec![]
    };
    if !progress.required_queue.is_empty() {
        return Ok(());
    }

    while progress.cursor < plan.0.len() {
        let action_ref = &plan.0[progress.cursor];
        if character_entry_has_no_nonterminal_occurrence(action_ref, context, progress)? {
            // A past or explicitly excluded Character entry has no executable projection left.
            // Its handler is therefore irrelevant for this replay prefix; requiring a lookup
            // here would turn a valid Defer/NoAction decision into a false unsupported-action
            // error. A live occurrence still falls through to `project_occurrences`, which
            // preserves the missing-handler boundary.
            progress.cursor += 1;
            progress.current_occurrences.clear();
            continue;
        }
        let first_owner = project_occurrences(action_ref, registry, context)?.into_iter()
            .find(|o| !progress.is_terminal(o) && !progress.immediate_queue.iter().any(|q| q.identity() == o.identity()));
        progress.required_queue = required.iter().filter(|o| {
            is_setup_preparation(o) && registry.linked_action(&o.action_ref).as_ref() == Some(action_ref)
                && first_owner.as_ref().is_none_or(|owner| owner.source() == o.source())
        }).cloned().collect();
        if !progress.required_queue.is_empty() {
            progress.available_occurrences.clear();
            progress.current_occurrences.clear();
            return Ok(());
        }
        let projected = project_occurrences(action_ref, registry, context)?;
        let queued = &progress.immediate_queue;
        let has_queued_current = projected.iter().any(|occurrence| {
            queued
                .iter()
                .any(|queued_occurrence| queued_occurrence.identity() == occurrence.identity())
        });
        let pending = projected
            .into_iter()
            .filter(|occurrence| {
                !progress.is_terminal(occurrence)
                    && !queued.iter().any(|queued_occurrence| {
                        queued_occurrence.identity() == occurrence.identity()
                    })
            })
            .collect::<Vec<_>>();
        if !pending.is_empty() {
            progress.current_occurrences = pending;
            return Ok(());
        }
        if has_queued_current {
            // The entry still owns immediate work.  Keep the normal cursor parked here so a
            // JoinPendingOrder candidate that appears while that queue drains is not treated as
            // a past entry.
            progress.current_occurrences.clear();
            return Ok(());
        }
        // Passing an empty entry is permanent.  No later projection may rewind the cursor.
        progress.cursor += 1;
        progress.current_occurrences.clear();
    }
    progress.current_occurrences.clear();
    Ok(())
}

fn character_entry_has_no_nonterminal_occurrence(
    action_ref: &FirstNightActionRef,
    context: &ActionContext<'_>,
    progress: &SchedulerProgress,
) -> Result<bool, CoreError> {
    if !matches!(action_ref, FirstNightActionRef::Character { .. }) {
        return Ok(false);
    }
    let active_instances = context.rule_service.try_active_instances(action_ref)?;
    for occurrence in context.rule_service.simulation_occurrences(action_ref)? {
        if !progress.is_terminal(&occurrence) || progress.immediate_queue.contains(&occurrence) {
            return Ok(false);
        }
    }
    if active_instances.is_empty() {
        return Ok(true);
    }
    for instance in active_instances {
        let occurrence = ActionOccurrence::character(action_ref.clone(), instance.ability_use)?;
        let queued = progress
            .immediate_queue
            .iter()
            .any(|queued| queued.identity() == occurrence.identity());
        if !progress.is_terminal(&occurrence) || queued {
            return Ok(false);
        }
    }
    Ok(true)
}

fn project_occurrences(
    action_ref: &FirstNightActionRef,
    registry: &ActionRegistry,
    context: &ActionContext<'_>,
) -> Result<Vec<ActionOccurrence>, CoreError> {
    if matches!(action_ref, FirstNightActionRef::Character { .. })
        && context
            .rule_service
            .try_active_instances(action_ref)?
            .is_empty()
        && context
            .rule_service
            .simulation_occurrences(action_ref)?
            .is_empty()
    {
        return Ok(Vec::new());
    }
    let active_instances = context.rule_service.try_active_instances(action_ref)?;
    let projected = registry.project(action_ref, context)?;
    let mut occurrences = Vec::with_capacity(projected.len());
    for step in projected {
        let occurrence = ActionOccurrence::from_step(&step)?;
        if let Some(ability_use) = occurrence.ability_use.as_ref() {
            if !active_instances
                .iter()
                .any(|instance| instance.ability_use == *ability_use)
            {
                return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
            }
        }
        occurrences.push(ProjectedOccurrence {
            seat: occurrence
                .ability_use
                .as_ref()
                .and_then(|ability_use| {
                    active_instances
                        .iter()
                        .find(|instance| instance.ability_use == *ability_use)
                        .map(|instance| instance.seat)
                })
                .or_else(|| {
                    context
                        .rule_service
                        .facts()
                        .and_then(|facts| {
                            occurrence.actor_player_id().and_then(|id| facts.player(id))
                        })
                        .map(|p| p.seat)
                })
                .unwrap_or(0),
            origin: occurrence
                .ability_use
                .as_ref()
                .and_then(|ability_use| {
                    active_instances
                        .iter()
                        .find(|instance| instance.ability_use == *ability_use)
                        .map(|instance| instance.ability_origin.clone())
                })
                .unwrap_or(AbilityOrigin::IdentityBound),
            occurrence,
        });
    }
    occurrences.sort_by(compare_projected_occurrences);
    if occurrences
        .windows(2)
        .any(|pair| pair[0].occurrence.identity() == pair[1].occurrence.identity())
    {
        return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
    }
    Ok(occurrences
        .into_iter()
        .map(|projected| projected.occurrence)
        .collect())
}

fn mark_completed(
    progress: &mut SchedulerProgress,
    occurrence: &ActionOccurrence,
    event_id: &str,
    snapshot: Option<CompletedActionSnapshot>,
) -> Result<(), CoreError> {
    if event_id.trim().is_empty() || progress.is_completed(occurrence) {
        return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
    }
    let identity = occurrence.identity();
    progress.completed_occurrences.push(identity);
    progress.completed_history.push(CompletedActionOccurrence {
        occurrence: occurrence.clone(),
        event_id: event_id.to_string(),
        step_id: occurrence.step_id()?,
        snapshot,
    });
    Ok(())
}

fn dedupe_immediate_queue(progress: &mut SchedulerProgress) {
    let completed = progress.completed_occurrences.clone();
    let excluded = progress.excluded_occurrences.clone();
    let mut seen = Vec::with_capacity(progress.immediate_queue.len());
    progress.immediate_queue.retain(|occurrence| {
        let identity = occurrence.identity();
        if completed.contains(&identity)
            || excluded.contains(&identity)
            || seen
                .iter()
                .any(|identity: &crate::state::ActionOccurrenceIdentity| {
                    *identity == occurrence.identity()
                })
        {
            return false;
        }
        seen.push(identity);
        true
    });
}

fn retain_live_immediate_queue(
    progress: &mut SchedulerProgress,
    registry: &ActionRegistry,
    context: &ActionContext<'_>,
) -> Result<(), CoreError> {
    let mut retained = Vec::with_capacity(progress.immediate_queue.len());
    for occurrence in progress.immediate_queue.drain(..) {
        let Some(action_ref) = character_action_ref(&occurrence) else {
            retained.push(occurrence);
            continue;
        };
        let _ = action_ref;
        if registry.project_occurrence(context, &occurrence)?.is_some() {
            retained.push(occurrence);
        }
    }
    progress.immediate_queue = retained;
    Ok(())
}

fn admit_new_instances(
    plan: &FirstNightOrderPlan,
    progress: &mut SchedulerProgress,
    previous_context: &ActionContext<'_>,
    next_context: &ActionContext<'_>,
    event: &ValidatedActionEvent,
    event_stream_index: usize,
    activation: &dyn ActivationRule,
) -> Result<(), CoreError> {
    let mut candidates = Vec::new();
    for (entry_index, action_ref) in plan.0.iter().enumerate() {
        let FirstNightActionRef::Character { .. } = action_ref else {
            continue;
        };
        let previous_simulations = previous_context
            .rule_service
            .simulation_occurrences(action_ref)?;
        for occurrence in next_context
            .rule_service
            .simulation_occurrences(action_ref)?
        {
            if previous_simulations.contains(&occurrence) {
                continue;
            }
            let seat = next_context
                .rule_service
                .facts()
                .and_then(|facts| occurrence.actor_player_id().and_then(|id| facts.player(id)))
                .map(|player| player.seat)
                .unwrap_or(0);
            candidates.push(NewOccurrence {
                entry_index,
                occurrence,
                seat,
                origin: AbilityOrigin::IdentityBound,
            });
        }
        let previous_owned = previous_context
            .rule_service
            .try_owned_instances(action_ref)?;
        let next_owned = next_context.rule_service.try_owned_instances(action_ref)?;
        for instance in next_owned {
            let already_owned = previous_owned.iter().any(|previous| {
                previous.ability_use == instance.ability_use
                    && previous.ability_origin == instance.ability_origin
            });
            if already_owned {
                continue;
            }
            let occurrence =
                ActionOccurrence::character(action_ref.clone(), instance.ability_use.clone())?;
            candidates.push(NewOccurrence {
                entry_index,
                occurrence,
                seat: instance.seat,
                origin: instance.ability_origin,
            });
        }
    }
    // All candidates from one confirmed event share its stream position because callers invoke
    // this function once per event.  Source provenance, seat, and instance identity make ties
    // deterministic without HashMap iteration or wall-clock data.
    candidates.sort_by(compare_new_occurrences);

    for candidate in candidates {
        if progress.is_terminal(&candidate.occurrence)
            || progress
                .immediate_queue
                .iter()
                .any(|queued| queued.identity() == candidate.occurrence.identity())
        {
            continue;
        }
        let decision = activation.decide(&ActivationContext {
            event,
            previous_facts: previous_context
                .rule_service
                .facts()
                .ok_or_else(|| ErrorKind::InvalidFirstNightActionProvenance.into_error())?,
            next_facts: next_context
                .rule_service
                .facts()
                .ok_or_else(|| ErrorKind::InvalidFirstNightActionProvenance.into_error())?,
            action_ref: &candidate.occurrence.action_ref,
            occurrence: &candidate.occurrence,
            event_stream_index,
            entry_index: candidate.entry_index,
            cursor: progress.cursor,
        })?;
        match decision {
            ActivationDecision::RunImmediately => {
                if !progress.ended {
                    progress.immediate_origins.push((candidate.occurrence.identity(), event.event_id().to_string()));
                    progress.immediate_queue.push(candidate.occurrence);
                }
            }
            ActivationDecision::JoinPendingOrder => {
                // The normal projection will include it only while the entry is still pending;
                // a past entry is never re-opened and the cursor is never rewound.
            }
            ActivationDecision::Defer | ActivationDecision::NoAction => {
                progress
                    .excluded_occurrences
                    .push(candidate.occurrence.identity());
            }
        }
    }
    Ok(())
}

struct NewOccurrence {
    entry_index: usize,
    occurrence: ActionOccurrence,
    seat: u8,
    origin: crate::model::AbilityOrigin,
}

struct ProjectedOccurrence {
    seat: u8,
    origin: AbilityOrigin,
    occurrence: ActionOccurrence,
}

fn compare_projected_occurrences(
    left: &ProjectedOccurrence,
    right: &ProjectedOccurrence,
) -> Ordering {
    origin_key(&left.origin)
        .cmp(&origin_key(&right.origin))
        .then_with(|| left.seat.cmp(&right.seat))
        .then_with(|| {
            occurrence_ability_key(&left.occurrence).cmp(&occurrence_ability_key(&right.occurrence))
        })
}

fn compare_new_occurrences(left: &NewOccurrence, right: &NewOccurrence) -> Ordering {
    origin_key(&left.origin)
        .cmp(&origin_key(&right.origin))
        .then_with(|| left.seat.cmp(&right.seat))
        .then_with(|| {
            occurrence_ability_key(&left.occurrence).cmp(&occurrence_ability_key(&right.occurrence))
        })
        .then_with(|| left.entry_index.cmp(&right.entry_index))
}

fn origin_key(origin: &crate::model::AbilityOrigin) -> (&str, &str, &str) {
    match origin {
        crate::model::AbilityOrigin::IdentityBound => ("", "", ""),
        crate::model::AbilityOrigin::Acquired {
            acquisition_event_id,
            source,
        } => (
            acquisition_event_id.as_str(),
            source.character_id.as_str(),
            source.ability_instance_id.as_str(),
        ),
    }
}

fn is_dawn(occurrence: &ActionOccurrence) -> bool {
    matches!(
        occurrence.action_ref,
        FirstNightActionRef::System {
            action_id: crate::contracts::SystemFirstNightActionId::Dawn
        }
    )
}

fn character_action_ref(occurrence: &ActionOccurrence) -> Option<&FirstNightActionRef> {
    match occurrence.action_ref {
        FirstNightActionRef::Character { .. } => Some(&occurrence.action_ref),
        FirstNightActionRef::System { .. } => None,
    }
}

fn occurrence_ability_key(occurrence: &ActionOccurrence) -> (&str, &str) {
    match occurrence.ability_use.as_ref() {
        Some(ability_use) => (
            ability_use.owner_player_id.as_str(),
            ability_use.ability_instance_id.as_str(),
        ),
        None => ("", ""),
    }
}

pub(super) fn sort_additional_occurrences(
    plan: &FirstNightOrderPlan,
    registry: &ActionRegistry,
    context: &ActionContext<'_>,
    occurrences: &mut [ActionOccurrence],
) {
    let index = |o: &ActionOccurrence| {
        registry.linked_action(&o.action_ref)
            .or_else(|| {
                let facts=context.rule_service.facts()?;
                let origin=o.ability_use.as_ref().and_then(|source|crate::reducer::recorded_ability(facts,source)).map(|ability|&ability.origin);
                let event_id=match origin {Some(AbilityOrigin::Acquired {acquisition_event_id,..})=>Some(acquisition_event_id.as_str()),_=>o.simulation_source.as_ref().map(|source|source.selection_event_id.as_str())}?;
                facts.confirmed_actions.iter().find(|action|action.event_id==event_id).map(|action|action.occurrence.action_ref.clone())
            })
            .and_then(|a| plan.0.iter().position(|p| *p == a))
            .unwrap_or(plan.0.len())
    };
    let projected = |o: &ActionOccurrence| ProjectedOccurrence {
        occurrence: o.clone(),
        seat: context
            .rule_service
            .facts()
            .and_then(|f| o.actor_player_id().and_then(|id| f.player(id)))
            .map(|p| p.seat)
            .unwrap_or(0),
        origin: context
            .rule_service
            .facts()
            .and_then(|f| {
                o.ability_use
                    .as_ref()
                    .and_then(|source| crate::reducer::recorded_ability(f, source))
            })
            .map(|p| p.origin.clone())
            .unwrap_or(AbilityOrigin::IdentityBound),
    };
    occurrences.sort_by(|a, b| {
        index(a)
            .cmp(&index(b))
            .then_with(|| compare_projected_occurrences(&projected(a), &projected(b)))
            .then_with(|| a.step_id().ok().cmp(&b.step_id().ok()))
    });
}

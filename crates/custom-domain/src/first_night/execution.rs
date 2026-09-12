//! Replay-only execution boundaries. Canonical events remain individual, unchanged facts.
use super::{ActionContext, ActionRegistry};
use crate::{
    error::{CoreError, ErrorKind},
    state::{ActionOccurrence, FirstNightProgress},
};
use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum DependencySource {
    Preparation,
    Relationship,
    ImmediateOrigin,
}
#[derive(Debug, Clone)]
pub(crate) struct ResolvedActionDependency {
    pub(crate) predecessor_occurrence: ActionOccurrence,
    pub(crate) predecessor_event_id: Option<String>,
    pub(crate) consumer_occurrence: ActionOccurrence,
    pub(crate) source_kind: DependencySource,
}
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StepExecution {
    pub(crate) id: String,
    pub(crate) root_step_id: String,
    pub(crate) display_step_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) predecessor_event_id: Option<String>,
    pub(crate) relation: &'static str,
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ActionExecution {
    pub(crate) id: String,
    pub(crate) root_step_id: String,
    pub(crate) display_step_id: String,
    pub(crate) step_ids: Vec<String>,
    pub(crate) event_ids: Vec<String>,
    pub(crate) status: &'static str,
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct LatestUndoUnit {
    pub(crate) id: String,
    pub(crate) execution_id: String,
    pub(crate) event_ids: Vec<String>,
    pub(crate) summary_step_id: String,
}
fn invalid() -> CoreError {
    ErrorKind::InvalidFirstNightActionProvenance.into_error()
}
fn same_source(a: &ActionOccurrence, b: &ActionOccurrence) -> bool {
    a.source() == b.source()
}

/// Resolve a real occurrence, never a Character-name/adjacency guess. Rule handlers choose the
/// source event; scheduler admission records whether a new instance was actually immediate.
pub(crate) fn resolve(
    registry: &ActionRegistry,
    context: &ActionContext<'_>,
    progress: &FirstNightProgress,
    occurrence: &ActionOccurrence,
    pending: &[ActionOccurrence],
) -> Result<Option<ResolvedActionDependency>, CoreError> {
    let entry = registry.lookup(&occurrence.action_ref)?;
    if !entry.spec.prerequisites.is_empty() {
        let candidates: Vec<_> = pending
            .iter()
            .filter(|p| {
                entry.spec.prerequisites.contains(&p.action_ref)
                    && same_source(p, occurrence)
                    && *p != occurrence
            })
            .collect();
        if candidates.len() > 1 {
            return Err(invalid());
        }
        if let Some(parent) = candidates.first() {
            return Ok(Some(ResolvedActionDependency {
                predecessor_occurrence: (*parent).clone(),
                predecessor_event_id: None,
                consumer_occurrence: occurrence.clone(),
                source_kind: dependency_kind(&entry.spec.continuation_sources)?,
            }));
        }
        if let Some(id) = entry.handler.dependency_event(context, occurrence)? {
            let parent = progress
                .completed_history
                .iter()
                .find(|p| p.event_id == id)
                .ok_or_else(invalid)?;
            if !entry
                .spec
                .prerequisites
                .contains(&parent.occurrence.action_ref)
                || !same_source(&parent.occurrence, occurrence)
            {
                return Err(invalid());
            }
            return Ok(Some(ResolvedActionDependency {
                predecessor_occurrence: parent.occurrence.clone(),
                predecessor_event_id: Some(id),
                consumer_occurrence: occurrence.clone(),
                source_kind: dependency_kind(&entry.spec.continuation_sources)?,
            }));
        }
    }
    if entry
        .spec
        .continuation_sources
        .contains(&DependencySource::ImmediateOrigin)
    {
        if let Some((_, id)) = progress.immediate_origins.iter().find(|(identity, _)| {
            *identity == occurrence.identity()
                || (identity.ability_use == occurrence.ability_use
                    && identity.simulation_source == occurrence.simulation_source
                    && registry.lookup(&identity.action_ref).is_ok_and(|consumer| {
                        consumer.spec.prerequisites.contains(&occurrence.action_ref)
                    }))
        }) {
            let parent = progress
                .completed_history
                .iter()
                .find(|p| p.event_id == *id)
                .ok_or_else(invalid)?;
            return Ok(Some(ResolvedActionDependency {
                predecessor_occurrence: parent.occurrence.clone(),
                predecessor_event_id: Some(id.clone()),
                consumer_occurrence: occurrence.clone(),
                source_kind: DependencySource::ImmediateOrigin,
            }));
        }
    }
    Ok(None)
}
fn dependency_kind(sources: &[DependencySource]) -> Result<DependencySource, CoreError> {
    let kinds: Vec<_> = sources
        .iter()
        .filter(|s| **s != DependencySource::ImmediateOrigin)
        .collect();
    if kinds.len() != 1 {
        return Err(invalid());
    }
    Ok(kinds[0].clone())
}

pub(crate) fn project(
    registry: &ActionRegistry,
    context: &ActionContext<'_>,
    progress: &FirstNightProgress,
    occurrence: &ActionOccurrence,
    pending: &[ActionOccurrence],
) -> Result<StepExecution, CoreError> {
    project_inner(
        registry,
        context,
        progress,
        occurrence,
        pending,
        &mut vec![],
    )
}
fn project_inner(
    registry: &ActionRegistry,
    context: &ActionContext<'_>,
    progress: &FirstNightProgress,
    occurrence: &ActionOccurrence,
    pending: &[ActionOccurrence],
    visiting: &mut Vec<ActionOccurrence>,
) -> Result<StepExecution, CoreError> {
    if visiting.contains(occurrence) {
        return Err(invalid());
    }
    visiting.push(occurrence.clone());
    let own = occurrence.step_id()?;
    let mut result = StepExecution {
        id: own.clone(),
        root_step_id: own.clone(),
        display_step_id: own.clone(),
        predecessor_event_id: None,
        relation: "independent",
    };
    if let Some(dependency) = resolve(registry, context, progress, occurrence, pending)? {
        if dependency.consumer_occurrence != *occurrence
            || dependency.predecessor_occurrence == *occurrence
        {
            return Err(invalid());
        }
        let _source_kind = dependency.source_kind;
        if let Some(id) = dependency.predecessor_event_id {
            let parent = progress
                .completed_history
                .iter()
                .find(|p| p.event_id == id)
                .ok_or_else(invalid)?;
            let parent_execution = parent
                .snapshot
                .as_ref()
                .and_then(|s| s.step.execution.as_ref());
            let latest = progress
                .completed_history
                .last()
                .and_then(|p| p.snapshot.as_ref())
                .and_then(|s| s.step.execution.as_ref());
            // Membership was frozen when the parent confirmed. Only the live contiguous suffix
            // can continue. A past source is retained as a reference in a new execution.
            if let (Some(parent), Some(latest)) = (parent_execution, latest) {
                if parent.id == latest.id
                    && progress
                        .next_occurrence()
                        .is_some_and(|next| next == occurrence)
                {
                    result.id = parent.id.clone();
                    result.root_step_id = parent.root_step_id.clone();
                    result.relation = "continuation";
                } else {
                    result.relation = "reference";
                }
            } else {
                result.relation = "reference";
            }
            result.predecessor_event_id = Some(id);
        } else {
            let parent = project_inner(
                registry,
                context,
                progress,
                &dependency.predecessor_occurrence,
                pending,
                visiting,
            )?;
            result.id = parent.id;
            result.root_step_id = parent.root_step_id;
            result.relation = "continuation";
        }
    }
    visiting.pop();
    // A pending consumer is the visible action for its preparation, using exactly the same
    // declared prerequisite and source as resolution above.
    let consumers: Vec<_> = pending
        .iter()
        .filter(|p| {
            same_source(p, occurrence)
                && registry
                    .lookup(&p.action_ref)
                    .is_ok_and(|e| e.spec.prerequisites.contains(&occurrence.action_ref))
        })
        .collect();
    if consumers.len() > 1 {
        return Err(invalid());
    }
    if let Some(consumer) = consumers.first() {
        result.display_step_id = consumer.step_id()?;
    }
    Ok(result)
}

pub(crate) fn units(
    progress: &FirstNightProgress,
    pending: &[crate::model::PhaseStep],
) -> Result<(Vec<ActionExecution>, Option<LatestUndoUnit>), CoreError> {
    let mut units: Vec<ActionExecution> = vec![];
    for completed in &progress.completed_history {
        let execution = completed
            .snapshot
            .as_ref()
            .and_then(|s| s.step.execution.as_ref())
            .ok_or_else(invalid)?;
        if units.last().is_none_or(|u| u.id != execution.id) {
            if units.iter().any(|u| u.id == execution.id) {
                return Err(invalid());
            }
            units.push(ActionExecution {
                id: execution.id.clone(),
                root_step_id: execution.root_step_id.clone(),
                display_step_id: execution.display_step_id.clone(),
                step_ids: vec![],
                event_ids: vec![],
                status: "complete",
            });
        }
        let unit = units.last_mut().ok_or_else(invalid)?;
        unit.step_ids.push(completed.step_id.clone());
        unit.event_ids.push(completed.event_id.clone());
        unit.display_step_id = execution.display_step_id.clone();
    }
    for unit in &mut units {
        if !unit.step_ids.contains(&unit.display_step_id) {
            unit.status = "interrupted";
        }
    }
    let latest = units.last().map(|u| LatestUndoUnit {
        id: u.event_ids.last().unwrap().clone(),
        execution_id: u.id.clone(),
        event_ids: u.event_ids.clone(),
        summary_step_id: u.display_step_id.clone(),
    });
    for step in pending {
        let execution = step.execution.as_ref().ok_or_else(invalid)?;
        let index = if let Some(index) = units.iter().position(|u| u.id == execution.id) {
            index
        } else {
            units.push(ActionExecution {
                id: execution.id.clone(),
                root_step_id: execution.root_step_id.clone(),
                display_step_id: execution.display_step_id.clone(),
                step_ids: vec![],
                event_ids: vec![],
                status: "pending",
            });
            units.len() - 1
        };
        let unit = &mut units[index];
        if !unit.step_ids.contains(&step.id) {
            unit.step_ids.push(step.id.clone());
        }
        if !unit.event_ids.is_empty() {
            unit.status = "active";
        }
        if execution.display_step_id != execution.root_step_id {
            unit.display_step_id = execution.display_step_id.clone();
        }
    }
    Ok((units, latest))
}

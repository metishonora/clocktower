use std::collections::HashSet;

use crate::{
    contracts::FirstNightOrderPlan,
    error::{CoreError, ErrorKind},
    model::PhaseStep,
};

use super::{ActionContext, ActionRegistry, ConfirmedActionEvent};

pub(crate) fn compose_steps(
    plan: &FirstNightOrderPlan,
    registry: &ActionRegistry,
    context: &ActionContext<'_>,
) -> Result<Vec<PhaseStep>, CoreError> {
    let mut steps = Vec::new();
    for action_ref in &plan.0 {
        steps.extend(registry.project(action_ref, context)?);
    }
    Ok(steps)
}

#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub(crate) struct FirstNightProgress {
    pub(crate) completed_step_ids: HashSet<String>,
}

pub(crate) fn reduce_progress(
    progress: &FirstNightProgress,
    event: &ConfirmedActionEvent,
) -> Result<FirstNightProgress, CoreError> {
    if event.step_id.trim().is_empty() || progress.completed_step_ids.contains(&event.step_id) {
        return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
    }
    let mut next = progress.clone();
    next.completed_step_ids.insert(event.step_id.clone());
    Ok(next)
}

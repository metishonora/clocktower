//! Custom-owned information shape helpers. Character truth stays with its rules.
use crate::error::{CoreError, ErrorKind};
use crate::model::{InformationResult, StepInput, StepInputFields};
pub(crate) fn targets(
    input: &StepInput,
    count: usize,
    actor: &str,
) -> Result<Vec<String>, CoreError> {
    targets_with_policy(input, count, actor, false)
}
pub(crate) fn targets_with_policy(
    input: &StepInput,
    count: usize,
    actor: &str,
    allow_self: bool,
) -> Result<Vec<String>, CoreError> {
    let fields = input
        .as_ref()
        .ok_or_else(|| ErrorKind::InvalidStepInput.into_error())?;
    let ids = fields
        .player_ids
        .as_ref()
        .ok_or_else(|| ErrorKind::InvalidStepInput.into_error())?;
    if ids.len() != count
        || (!allow_self && ids.iter().any(|id| id == actor))
        || ids.iter().enumerate().any(|(i, id)| ids[..i].contains(id))
        || *fields
            != (StepInputFields {
                player_ids: Some(ids.clone()),
                ..Default::default()
            })
    {
        return Err(ErrorKind::InvalidStepInput.into_error());
    }
    Ok(ids.clone())
}
pub(crate) fn equivalent(a: &InformationResult, b: &InformationResult) -> bool {
    match (a, b) {
        (
            InformationResult::CharacterPair { character_ids: a },
            InformationResult::CharacterPair { character_ids: b },
        ) => a.len() == b.len() && a.iter().all(|id| b.contains(id)),
        _ => a == b,
    }
}

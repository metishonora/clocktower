use std::collections::HashSet;

use crate::{
    characters::phase_input_suggestion_pool,
    contracts::{GameFile, PhaseInputSuggestion, PhaseInputSuggestionRequest},
    error::{CoreError, ErrorKind},
    model::{RequiredInputKind, StepInput},
};

pub(crate) fn suggest_phase_input(
    game_file: GameFile,
    request: PhaseInputSuggestionRequest,
) -> Result<PhaseInputSuggestion, CoreError> {
    let replayed = crate::replay::replay(game_file)?;
    let step = replayed
        .current_step
        .ok_or_else(|| ErrorKind::NoCurrentStep.into_error())?;
    if step.id != request.step_id {
        return Err(ErrorKind::StaleStep.into_error());
    }
    if !step.required_input.supports_random_suggestion {
        return Err(ErrorKind::UnsupportedDraftSuggestion.into_error());
    }

    let impaired = step
        .information_prompt
        .as_ref()
        .is_some_and(|prompt| !prompt.active_reasons.is_empty());
    let pool = phase_input_suggestion_pool(&step, &replayed.players, impaired);
    let input = select_input(
        &step.required_input.kind,
        pool,
        &request.current_input,
        request.choice_token,
    )?;

    Ok(PhaseInputSuggestion {
        step_id: step.id,
        input,
    })
}

fn select_input(
    kind: &RequiredInputKind,
    pool: Vec<StepInput>,
    current_input: &StepInput,
    choice_token: u32,
) -> Result<StepInput, CoreError> {
    if pool.is_empty() {
        return Err(ErrorKind::NoValidDraftSuggestion.into_error());
    }
    let alternatives = pool
        .iter()
        .filter(|candidate| !same_semantic_input(kind, candidate, current_input))
        .cloned()
        .collect::<Vec<_>>();
    let choices = if alternatives.is_empty() {
        &pool
    } else {
        &alternatives
    };
    Ok(choices[(choice_token as usize) % choices.len()].clone())
}

fn same_semantic_input(kind: &RequiredInputKind, left: &StepInput, right: &StepInput) -> bool {
    let (Some(left), Some(right)) = (left.as_ref(), right.as_ref()) else {
        return false;
    };
    match kind {
        RequiredInputKind::SetupInfo => {
            if left.zero_outsiders == Some(true) {
                return right.zero_outsiders == Some(true)
                    && right.player_ids.as_ref().is_none_or(Vec::is_empty)
                    && right.character_id.is_none()
                    && right.character_ids.as_ref().is_none_or(Vec::is_empty);
            }
            left.character_id == right.character_id
                && unordered_equal(left.player_ids.as_deref(), right.player_ids.as_deref())
                && right.zero_outsiders != Some(true)
                && right.character_ids.as_ref().is_none_or(Vec::is_empty)
        }
        RequiredInputKind::CharacterIds => {
            unordered_equal(
                left.character_ids.as_deref(),
                right.character_ids.as_deref(),
            ) && right.player_ids.as_ref().is_none_or(Vec::is_empty)
                && right.character_id.is_none()
                && right.zero_outsiders != Some(true)
        }
        _ => false,
    }
}

fn unordered_equal(left: Option<&[String]>, right: Option<&[String]>) -> bool {
    let (Some(left), Some(right)) = (left, right) else {
        return false;
    };
    left.len() == right.len()
        && left.iter().collect::<HashSet<_>>() == right.iter().collect::<HashSet<_>>()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_complete_pool_returns_stable_no_valid_error() {
        let error = select_input(&RequiredInputKind::SetupInfo, Vec::new(), &None, 0).unwrap_err();
        assert_eq!(error.code, "NO_VALID_DRAFT_SUGGESTION");
    }
}

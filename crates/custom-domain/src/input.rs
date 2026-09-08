use crate::characters::character_kind;
use crate::{
    error::{CoreError, ErrorKind},
    model::*,
};
use std::collections::HashSet;
pub(crate) fn simple_step(
    phase: Phase,
    id_prefix: &str,
    name: &'static str,
    step_type: StepType,
    required_input: RequiredInput,
    can_skip: bool,
) -> PhaseStep {
    PhaseStep {
        id: format!("{id_prefix}:{name}"),
        phase,
        step_type,
        character: None,
        player_id: None,
        ability_use: None,
        ability_origin: None,
        required_input,
        can_skip,
        support: crate::model::PhaseStepSupport::Automated,
        information_prompt: None,
        pre_action_reveal: None,
        action_ref: None,
    }
}

pub(crate) fn phase_transition_step(
    phase: Phase,
    id_prefix: &str,
    name: &'static str,
    next_phase: RequiredInputKind,
) -> PhaseStep {
    PhaseStep {
        id: format!("{id_prefix}:{name}"),
        phase,
        step_type: StepType::PhaseTransition,
        character: None,
        player_id: None,
        ability_use: None,
        ability_origin: None,
        required_input: RequiredInput {
            kind: next_phase,
            target: Some(InputTarget::Phase),
            min_selections: None,
            max_selections: None,
            setup_info: None,
            character_kind: None,
            allowed_character_ids: None,
            allowed_player_ids: None,
            dependent_player_selections: vec![],
            player_registration_options: None,
            zero_allowed: false,
            supports_random_suggestion: false,
            player_id: None,
            survival_allowed: None,
            execution_survival_allowed: false,
            mayor_decision: None,
            demon_succession: None,
            optional: false,
        },
        can_skip: false,
        support: crate::model::PhaseStepSupport::Automated,
        information_prompt: None,
        pre_action_reveal: None,
        action_ref: None,
    }
}

pub(crate) fn required_none() -> RequiredInput {
    RequiredInput {
        kind: RequiredInputKind::None,
        target: None,
        min_selections: None,
        max_selections: None,
        setup_info: None,
        character_kind: None,
        allowed_character_ids: None,
        allowed_player_ids: None,
        dependent_player_selections: vec![],
        player_registration_options: None,
        zero_allowed: false,
        supports_random_suggestion: false,
        player_id: None,
        survival_allowed: None,
        execution_survival_allowed: false,
        mayor_decision: None,
        demon_succession: None,
        optional: false,
    }
}

pub(crate) fn required_characters(
    min: u8,
    max: u8,
    allowed_character_ids: Option<Vec<String>>,
    supports_random_suggestion: bool,
) -> RequiredInput {
    RequiredInput {
        kind: RequiredInputKind::CharacterIds,
        target: Some(InputTarget::Characters),
        min_selections: Some(min),
        max_selections: Some(max),
        setup_info: None,
        character_kind: None,
        allowed_character_ids,
        allowed_player_ids: None,
        dependent_player_selections: vec![],
        player_registration_options: None,
        zero_allowed: false,
        supports_random_suggestion,
        player_id: None,
        survival_allowed: None,
        execution_survival_allowed: false,
        mayor_decision: None,
        demon_succession: None,
        optional: min == 0,
    }
}

pub(crate) fn validate_required_input(
    input: &RequiredInput,
    typed_value: &StepInput,
    players: &[Player],
) -> Result<(), CoreError> {
    if input.kind == RequiredInputKind::CharacterTransformation {
        let mut player_input = input.clone();
        player_input.kind = RequiredInputKind::PlayerIds;
        player_input.target = Some(InputTarget::Player);
        validate_required_input(&player_input, typed_value, players)?;
        let character_ids = typed_value
            .as_ref()
            .and_then(|value| value.character_ids.as_ref())
            .ok_or_else(|| ErrorKind::MalformedCommand.into_error())?;
        if character_ids.len() != 1 {
            return Err(if character_ids.is_empty() {
                ErrorKind::MissingStepInput.into_error()
            } else {
                ErrorKind::TooMuchStepInput.into_error()
            });
        }
        if input
            .allowed_character_ids
            .as_ref()
            .is_some_and(|allowed| !allowed.contains(&character_ids[0]))
        {
            return Err(ErrorKind::InvalidStepInput.into_error());
        }
        return Ok(());
    }
    if input.kind == RequiredInputKind::MadnessAssignment {
        let mut player_input = input.clone();
        player_input.kind = RequiredInputKind::PlayerIds;
        validate_required_input(&player_input, typed_value, players)?;
        let character_id = typed_value
            .as_ref()
            .and_then(|value| value.character_id.as_ref())
            .ok_or_else(|| ErrorKind::MissingStepInput.into_error())?;
        if input
            .allowed_character_ids
            .as_ref()
            .is_some_and(|allowed| !allowed.iter().any(|id| id == character_id))
        {
            return Err(ErrorKind::InvalidStepInput.into_error());
        }
        return Ok(());
    }
    if input.kind == RequiredInputKind::Number {
        return validate_number_input(typed_value);
    }
    if matches!(
        input.kind,
        RequiredInputKind::Nomination
            | RequiredInputKind::NominationVote
            | RequiredInputKind::ExecutionDecision
            | RequiredInputKind::ExecutionDeathDecision
            | RequiredInputKind::SlayerDeathDecision
            | RequiredInputKind::DemonSuccession
    ) {
        return Ok(());
    }
    if input.target == Some(InputTarget::Characters) {
        return validate_character_selection(input, typed_value);
    }
    if input.target != Some(InputTarget::Player) && input.target != Some(InputTarget::Players) {
        return Ok(());
    }

    let player_ids = typed_value
        .as_ref()
        .and_then(|value| value.player_ids.as_ref())
        .ok_or_else(|| ErrorKind::MalformedCommand.into_error())?;
    let mut unique_player_ids = HashSet::new();
    let roster_player_ids = players
        .iter()
        .map(|player| player.id.as_str())
        .collect::<HashSet<_>>();
    for player_id in player_ids {
        let player_id = player_id.as_str();
        if !unique_player_ids.insert(player_id) || !roster_player_ids.contains(player_id) {
            return Err(ErrorKind::InvalidStepInput.into_error());
        }
        if input
            .allowed_player_ids
            .as_ref()
            .is_some_and(|allowed| !allowed.iter().any(|id| id == player_id))
        {
            return Err(ErrorKind::InvalidStepInput.into_error());
        }
    }

    let count = player_ids.len();
    if let Some(min) = input.min_selections {
        if count < usize::from(min) {
            return Err(ErrorKind::MissingStepInput.into_error());
        }
    }
    if let Some(max) = input.max_selections {
        if count > usize::from(max) {
            return Err(ErrorKind::TooMuchStepInput.into_error());
        }
    }

    Ok(())
}

pub(crate) fn validate_number_input(value: &StepInput) -> Result<(), CoreError> {
    let Some(value) = value.as_ref() else {
        return Ok(());
    };

    let Some(number) = value.value.or(value.displayed_value) else {
        return Err(ErrorKind::MalformedCommand.into_error());
    };
    if number <= 15 {
        return Ok(());
    }

    Err(ErrorKind::InvalidStepInput.into_error())
}

pub(crate) fn validate_character_selection(
    input: &RequiredInput,
    value: &StepInput,
) -> Result<(), CoreError> {
    let character_ids = value
        .as_ref()
        .and_then(|value| value.character_ids.as_ref())
        .cloned()
        .unwrap_or_default();
    let mut unique_character_ids = HashSet::new();
    let allowed_character_ids = input.allowed_character_ids.as_ref().map(|character_ids| {
        character_ids
            .iter()
            .map(String::as_str)
            .collect::<HashSet<_>>()
    });
    for character_id in &character_ids {
        let character_id = character_id.as_str();
        let unknown_without_explicit_catalog =
            allowed_character_ids.is_none() && character_kind(character_id).is_none();
        if !unique_character_ids.insert(character_id)
            || unknown_without_explicit_catalog
            || allowed_character_ids
                .as_ref()
                .is_some_and(|allowed| !allowed.contains(character_id))
        {
            return Err(ErrorKind::InvalidStepInput.into_error());
        }
    }

    let count = character_ids.len();
    if let Some(min) = input.min_selections {
        if count < usize::from(min) {
            return Err(ErrorKind::MissingStepInput.into_error());
        }
    }
    if let Some(max) = input.max_selections {
        if count > usize::from(max) {
            return Err(ErrorKind::TooMuchStepInput.into_error());
        }
    }

    Ok(())
}

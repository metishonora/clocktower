use crate::model::{
    InputTarget, Phase, PhaseStep, PhaseStepStatus, Player, RequiredInput, RequiredInputKind,
    SetupInfoKind, StepInput, StepType,
};
use crate::{
    characters::{character_kind, has_actual_outsider, setup_info_character_is_represented},
    error::{CoreError, ErrorKind},
};
use std::collections::{HashMap, HashSet};

pub(crate) fn step_status(
    step_id: &str,
    statuses: &HashMap<String, PhaseStepStatus>,
) -> PhaseStepStatus {
    statuses
        .get(step_id)
        .copied()
        .unwrap_or(PhaseStepStatus::Waiting)
}

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
        required_input,
        can_skip,
        information_prompt: None,
        pre_action_reveal: None,
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
        required_input: RequiredInput {
            kind: next_phase,
            target: Some(InputTarget::Phase),
            min_selections: None,
            max_selections: None,
            setup_info: None,
            character_kind: None,
            allowed_character_ids: None,
            allowed_player_ids: None,
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
        information_prompt: None,
        pre_action_reveal: None,
    }
}

pub(crate) fn phase_prefix(phase: &str, cycle: usize) -> String {
    if cycle <= 1 {
        phase.to_string()
    } else {
        format!("{phase}{cycle}")
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
    if input.kind == RequiredInputKind::SetupInfo {
        return validate_setup_info_input(
            input
                .setup_info
                .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?,
            typed_value,
            players,
        );
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

pub(crate) fn validate_setup_info_input(
    setup_info: SetupInfoKind,
    value: &StepInput,
    players: &[Player],
) -> Result<(), CoreError> {
    let value = value
        .as_ref()
        .ok_or_else(|| ErrorKind::MalformedCommand.into_error())?;
    if value.zero_outsiders == Some(true) {
        let player_count = value.player_ids.as_ref().map_or(0, Vec::len);
        if setup_info == SetupInfoKind::Librarian
            && player_count == 0
            && value.character_id.is_none()
            && !has_actual_outsider(players)
        {
            return Ok(());
        }
        return Err(ErrorKind::InvalidStepInput.into_error());
    }

    let player_ids = validate_player_ids(value.player_ids.as_deref(), players)?;
    if player_ids.len() != 2 {
        return Err(ErrorKind::MissingStepInput.into_error());
    }

    let Some(character_id) = value.character_id.as_deref() else {
        return Err(ErrorKind::MissingStepInput.into_error());
    };
    if character_kind(character_id).is_none() {
        return Err(ErrorKind::UnknownCharacter.into_error());
    }
    if !setup_info_character_is_represented(setup_info, character_id, &player_ids, players) {
        return Err(ErrorKind::InvalidStepInput.into_error());
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
        if !unique_character_ids.insert(character_id)
            || character_kind(character_id).is_none()
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

pub(crate) fn validate_player_ids(
    player_ids: Option<&[String]>,
    players: &[Player],
) -> Result<Vec<String>, CoreError> {
    let player_ids = player_ids.ok_or_else(|| ErrorKind::MalformedCommand.into_error())?;
    let mut unique_player_ids = HashSet::new();
    let roster_player_ids = players
        .iter()
        .map(|player| player.id.as_str())
        .collect::<HashSet<_>>();
    let mut valid_ids = Vec::new();
    for player_id in player_ids {
        let player_id = player_id.as_str();
        if !unique_player_ids.insert(player_id) || !roster_player_ids.contains(player_id) {
            return Err(ErrorKind::InvalidStepInput.into_error());
        }
        valid_ids.push(player_id.to_string());
    }

    Ok(valid_ids)
}

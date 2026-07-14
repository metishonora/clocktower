use std::collections::HashSet;

use crate::{
    characters::{
        computed_information_result, number_result_with_registration_judgments,
        registration_candidate_player_ids,
    },
    contracts::{GameEvent, GameEventKind},
    error::{CoreError, ErrorKind},
    model::{
        ConfirmedInformation, DeliveryContext, DeliveryReason, InformationActor,
        InformationDeliveryMode, InformationPrompt, InformationResult, PhaseStep, Player,
        RegistrationJudgment, RegistrationValue, StepInput,
    },
};

pub(crate) fn information_prompt(
    step: &PhaseStep,
    players: &[Player],
    events: &[GameEvent],
) -> Option<InformationPrompt> {
    let computed_result = computed_information_result(step, players, &None)?;
    if !matches!(computed_result, InformationResult::Number { .. }) {
        return None;
    }

    let active_reasons = active_delivery_reasons(step, players, events);
    let registration_candidate_player_ids = registration_candidate_player_ids(step, players);
    let delivery_mode = if active_reasons.is_empty() && registration_candidate_player_ids.is_empty()
    {
        InformationDeliveryMode::Fixed
    } else {
        InformationDeliveryMode::Selectable
    };

    Some(InformationPrompt {
        computed_result,
        delivery_mode,
        active_reasons,
        registration_candidate_player_ids,
    })
}

pub(crate) fn confirmed_information(
    step: &PhaseStep,
    players: &[Player],
    events: &[GameEvent],
    input: &StepInput,
    delivered_result: Option<InformationResult>,
    registration_judgments: Vec<RegistrationJudgment>,
) -> Result<Option<ConfirmedInformation>, CoreError> {
    let Some(computed_result) = computed_information_result(step, players, input) else {
        if delivered_result.is_some() || !registration_judgments.is_empty() {
            return Err(ErrorKind::UnexpectedDeliveredInformation.into_error());
        }
        return Ok(None);
    };

    let supports_discretion = matches!(computed_result, InformationResult::Number { .. });
    let mut reasons = if supports_discretion {
        active_delivery_reasons(step, players, events)
    } else {
        Vec::new()
    };
    let registration_candidates = if supports_discretion {
        registration_candidate_player_ids(step, players)
    } else {
        Vec::new()
    };
    if !registration_candidates.is_empty() && registration_judgments.is_empty() {
        return Err(ErrorKind::MissingRegistrationJudgment.into_error());
    }
    let has_active_impairment = !reasons.is_empty();
    if !registration_judgments.is_empty() {
        validate_registration_judgments(step, players, &registration_judgments)?;
        if !has_active_impairment {
            validate_registration_delivery(
                step,
                players,
                &registration_judgments,
                delivered_result.as_ref(),
            )?;
        }
        reasons.push(DeliveryReason::RegistrationJudgment {
            judgments: registration_judgments,
        });
    }

    let (delivered_result, delivery_context) = if reasons.is_empty() {
        if delivered_result.is_some() {
            return Err(ErrorKind::UnexpectedDeliveredInformation.into_error());
        }
        (computed_result.clone(), DeliveryContext::Fixed)
    } else {
        let delivered_result =
            delivered_result.ok_or_else(|| ErrorKind::MissingDeliveredInformation.into_error())?;
        validate_matching_result_kind(&computed_result, &delivered_result)?;
        (delivered_result, DeliveryContext::Discretionary { reasons })
    };

    Ok(Some(ConfirmedInformation {
        actor: step.player_id.as_ref().zip(step.character.as_ref()).map(
            |(player_id, character_id)| InformationActor {
                player_id: player_id.clone(),
                character_id: character_id.clone(),
            },
        ),
        target_player_ids: input
            .as_ref()
            .and_then(|value| value.player_ids.clone())
            .unwrap_or_default(),
        computed_result,
        delivered_result,
        delivery_context,
    }))
}

fn validate_registration_delivery(
    step: &PhaseStep,
    players: &[Player],
    judgments: &[RegistrationJudgment],
    delivered_result: Option<&InformationResult>,
) -> Result<(), CoreError> {
    let expected = number_result_with_registration_judgments(step, players, judgments)
        .ok_or_else(|| ErrorKind::InvalidRegistrationJudgment.into_error())?;
    if delivered_result == Some(&InformationResult::Number { value: expected }) {
        Ok(())
    } else {
        Err(ErrorKind::InvalidDeliveredInformation.into_error())
    }
}

pub(crate) fn validate_confirmed_information(
    step: &PhaseStep,
    players: &[Player],
    prior_events: &[GameEvent],
    input: &StepInput,
    information: Option<&ConfirmedInformation>,
) -> Result<(), CoreError> {
    let Some(information) = information else {
        // Explicit schema-version-1 compatibility rule: historical events did not persist
        // Delivered Information, so replay validates the original step input only.
        return Ok(());
    };

    let registration_judgments = match &information.delivery_context {
        DeliveryContext::Fixed => Vec::new(),
        DeliveryContext::Discretionary { reasons } => reasons
            .iter()
            .find_map(|reason| match reason {
                DeliveryReason::RegistrationJudgment { judgments } => Some(judgments.clone()),
                _ => None,
            })
            .unwrap_or_default(),
    };
    let delivered_result = match information.delivery_context {
        DeliveryContext::Fixed => None,
        DeliveryContext::Discretionary { .. } => Some(information.delivered_result.clone()),
    };
    let expected = confirmed_information(
        step,
        players,
        prior_events,
        input,
        delivered_result,
        registration_judgments,
    )?;
    if expected.as_ref() == Some(information) {
        Ok(())
    } else {
        Err(ErrorKind::ReplayFailed.into_error())
    }
}

fn active_delivery_reasons(
    step: &PhaseStep,
    players: &[Player],
    events: &[GameEvent],
) -> Vec<DeliveryReason> {
    let Some(actor_id) = step.player_id.as_deref() else {
        return Vec::new();
    };
    let mut reasons = Vec::new();
    if players
        .iter()
        .any(|player| player.id == actor_id && player.actual_character == "drunk")
    {
        reasons.push(DeliveryReason::Drunk);
    }
    if let Some(reason) = poison_reason(step, actor_id, players, events) {
        reasons.push(reason);
    }
    reasons
}

fn poison_reason(
    step: &PhaseStep,
    actor_id: &str,
    players: &[Player],
    events: &[GameEvent],
) -> Option<DeliveryReason> {
    let prefix = step.id.rsplit_once(':')?.0;
    let poisoner = players
        .iter()
        .find(|player| player.actual_character == "poisoner")?;
    events.iter().rev().find_map(|event| {
        let GameEventKind::PhaseStepConfirmed { payload } = &event.kind else {
            return None;
        };
        if payload.step_id != format!("{prefix}:poisoner") {
            return None;
        }
        let targets_actor = payload
            .input
            .as_ref()
            .and_then(|input| input.player_ids.as_ref())
            .is_some_and(|player_ids| player_ids.iter().any(|player_id| player_id == actor_id));
        targets_actor.then(|| DeliveryReason::Poisoned {
            poisoner_player_id: poisoner.id.clone(),
            poison_event_id: event.id.clone(),
        })
    })
}

fn validate_registration_judgments(
    step: &PhaseStep,
    players: &[Player],
    judgments: &[RegistrationJudgment],
) -> Result<(), CoreError> {
    let candidates = registration_candidate_player_ids(step, players)
        .into_iter()
        .collect::<HashSet<_>>();
    let mut seen = HashSet::new();
    let valid = !candidates.is_empty()
        && judgments.len() == candidates.len()
        && judgments.iter().all(|judgment| {
            candidates.contains(&judgment.player_id)
                && seen.insert(judgment.player_id.as_str())
                && matches!(
                    judgment.registered_as,
                    RegistrationValue::Good | RegistrationValue::Evil
                )
        });
    if valid {
        Ok(())
    } else {
        Err(ErrorKind::InvalidRegistrationJudgment.into_error())
    }
}

fn validate_matching_result_kind(
    computed: &InformationResult,
    delivered: &InformationResult,
) -> Result<(), CoreError> {
    let matches = matches!(
        (computed, delivered),
        (
            InformationResult::Number { .. },
            InformationResult::Number { value: 0..=15 }
        ) | (
            InformationResult::SetupInfo { .. },
            InformationResult::SetupInfo { .. }
        ) | (
            InformationResult::TeamInfo { .. },
            InformationResult::TeamInfo { .. }
        ) | (
            InformationResult::SpyGrimoire { .. },
            InformationResult::SpyGrimoire { .. }
        )
    );
    if matches {
        Ok(())
    } else {
        Err(ErrorKind::InvalidDeliveredInformation.into_error())
    }
}

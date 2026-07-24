use std::collections::HashSet;

use crate::{
    characters::{
        computed_information_result, legal_number_choices,
        number_result_with_registration_judgments, registration_candidate_player_ids,
        setup_info_input_is_valid_impaired, setup_info_input_is_valid_normal,
        setup_info_input_is_valid_registration, setup_info_registration_options,
        spy_grimoire_result,
    },
    contracts::{GameEvent, GameEventKind, NightActionResolution},
    error::{CoreError, ErrorKind},
    model::{
        ConfirmedInformation, DeliveryContext, DeliveryReason, InformationActor,
        InformationDeliveryMode, InformationPrompt, InformationResult, PhaseStep, Player,
        RegistrationJudgment, RegistrationValue, RequiredInputKind, StepInput,
    },
};

pub(crate) fn information_prompt(
    step: &PhaseStep,
    players: &[Player],
    events: &[GameEvent],
) -> Option<InformationPrompt> {
    let is_number = step.required_input.kind == RequiredInputKind::Number;
    let is_setup_info = step.required_input.kind == RequiredInputKind::SetupInfo;
    let target_checks = crate::characters::target_information_checks(step, players, events);
    if !is_number && !is_setup_info && target_checks.is_empty() {
        return None;
    }

    let active_reasons = active_delivery_reasons(step, players, events);
    let registration_candidate_player_ids = if is_number {
        registration_candidate_player_ids(step, players)
    } else {
        Vec::new()
    };
    let number_choices = if is_number {
        legal_number_choices(step, players, !active_reasons.is_empty())
    } else {
        Vec::new()
    };
    let setup_info_registration_options = if is_setup_info {
        setup_info_registration_options(step, players)
    } else {
        Vec::new()
    };
    let delivery_mode = if active_reasons.is_empty()
        && number_choices.len() <= 1
        && setup_info_registration_options.is_empty()
        && target_checks.iter().all(|check| check.choices.len() <= 1)
    {
        InformationDeliveryMode::Fixed
    } else {
        InformationDeliveryMode::Selectable
    };

    Some(InformationPrompt {
        computed_result: computed_information_result(step, players, &None),
        delivery_mode,
        active_reasons,
        registration_candidate_player_ids,
        number_choices,
        boolean_choices: Vec::new(),
        setup_info_registration_options,
        target_checks,
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
    let target_checks = crate::characters::target_information_checks(step, players, events);
    if !target_checks.is_empty() {
        let targets = if step.character.as_deref() == Some("undertaker") {
            target_checks[0].target_player_ids.clone()
        } else {
            target_player_ids(input)
        };
        let check = target_checks
            .iter()
            .find(|check| check.target_player_ids == targets)
            .ok_or_else(|| ErrorKind::InvalidStepInput.into_error())?;
        let choice = if let Some(delivered) = delivered_result {
            check
                .choices
                .iter()
                .find(|choice| {
                    choice.result == delivered
                        && choice.registration_judgments == registration_judgments
                })
                .ok_or_else(|| {
                    if registration_judgments.is_empty() {
                        ErrorKind::InvalidDeliveredInformation.into_error()
                    } else {
                        ErrorKind::InvalidRegistrationJudgment.into_error()
                    }
                })?
        } else {
            check
                .choices
                .iter()
                .find(|choice| choice.is_computed && choice.registration_judgments.is_empty())
                .ok_or_else(|| ErrorKind::MissingDeliveredInformation.into_error())?
        };
        let context = if choice.is_computed && choice.registration_judgments.is_empty() {
            DeliveryContext::Fixed
        } else {
            DeliveryContext::Discretionary {
                reasons: if choice.registration_judgments.is_empty() {
                    active_delivery_reasons(step, players, events)
                } else {
                    vec![DeliveryReason::RegistrationJudgment {
                        judgments: choice.registration_judgments.clone(),
                    }]
                },
            }
        };
        return Ok(Some(ConfirmedInformation {
            actor: information_actor(step),
            target_player_ids: targets,
            computed_result: Some(check.computed_result.clone()),
            delivered_result: choice.result.clone(),
            delivery_context: context,
        }));
    }
    if step.required_input.kind == RequiredInputKind::SetupInfo {
        let selected_result = computed_information_result(step, players, input)
            .ok_or_else(|| ErrorKind::InvalidStepInput.into_error())?;
        return confirmed_setup_information(
            step,
            players,
            events,
            input,
            selected_result,
            delivered_result,
            registration_judgments,
        )
        .map(Some);
    }

    let computed_result = if step.character.as_deref() == Some("spy") {
        spy_information_result(step, players, events)
    } else {
        computed_information_result(step, players, input)
    };
    let Some(computed_result) = computed_result else {
        if delivered_result.is_some() || !registration_judgments.is_empty() {
            return Err(ErrorKind::UnexpectedDeliveredInformation.into_error());
        }
        return Ok(None);
    };

    if matches!(computed_result, InformationResult::Number { .. }) {
        return confirmed_number_information(
            step,
            players,
            events,
            input,
            computed_result,
            delivered_result,
            registration_judgments,
        )
        .map(Some);
    }

    if !registration_judgments.is_empty() {
        return Err(ErrorKind::InvalidRegistrationJudgment.into_error());
    }
    if delivered_result.is_some() {
        return Err(ErrorKind::UnexpectedDeliveredInformation.into_error());
    }

    Ok(Some(ConfirmedInformation {
        actor: information_actor(step),
        target_player_ids: target_player_ids(input),
        computed_result: Some(computed_result.clone()),
        delivered_result: computed_result,
        delivery_context: DeliveryContext::Fixed,
    }))
}

fn spy_information_result(
    step: &PhaseStep,
    players: &[Player],
    events: &[GameEvent],
) -> Option<InformationResult> {
    let prefix = step.id.rsplit_once(':')?.0;
    let current_cycle_start = if is_normal_night_prefix(prefix) {
        events
            .iter()
            .rposition(|event| matches!(
                &event.kind,
                GameEventKind::PhaseStepConfirmed { payload } if payload.step_id.ends_with(":toNight")
            ))
            .map_or(0, |index| index + 1)
    } else {
        0
    };
    let current_cycle = &events[current_cycle_start..];
    let poisoned = confirmed_step_targets(current_cycle, &format!("{prefix}:poisoner"));
    let protected = if is_normal_night_prefix(prefix) {
        confirmed_step_targets(current_cycle, &format!("{prefix}:monk"))
    } else {
        Vec::new()
    };
    Some(spy_grimoire_result(players, &poisoned, &protected))
}

fn is_normal_night_prefix(prefix: &str) -> bool {
    prefix.starts_with("night")
}

fn confirmed_step_targets(events: &[GameEvent], step_id: &str) -> Vec<String> {
    events
        .iter()
        .rev()
        .find_map(|event| match &event.kind {
            GameEventKind::NightActionResolved { payload } if payload.step_id == step_id => {
                match &payload.resolution {
                    NightActionResolution::Poison {
                        target_player_id,
                        applied: true,
                        ..
                    }
                    | NightActionResolution::MonkProtection {
                        target_player_id,
                        applied: true,
                        ..
                    } => Some(vec![target_player_id.clone()]),
                    _ => Some(Vec::new()),
                }
            }
            GameEventKind::PhaseStepConfirmed { payload } if payload.step_id == step_id => Some(
                payload
                    .input
                    .as_ref()
                    .and_then(|input| input.player_ids.clone())
                    .unwrap_or_default(),
            ),
            GameEventKind::PhaseStepSkipped { payload } if payload.step_id == step_id => {
                Some(Vec::new())
            }
            _ => None,
        })
        .unwrap_or_default()
}

fn confirmed_number_information(
    step: &PhaseStep,
    players: &[Player],
    events: &[GameEvent],
    input: &StepInput,
    computed_result: InformationResult,
    delivered_result: Option<InformationResult>,
    registration_judgments: Vec<RegistrationJudgment>,
) -> Result<ConfirmedInformation, CoreError> {
    let impairment_reasons = active_delivery_reasons(step, players, events);
    let impaired = !impairment_reasons.is_empty();
    let choices = legal_number_choices(step, players, impaired);

    let (delivered_result, delivery_context) = if impaired {
        if !registration_judgments.is_empty() {
            return Err(ErrorKind::InvalidRegistrationJudgment.into_error());
        }
        let delivered =
            delivered_result.ok_or_else(|| ErrorKind::MissingDeliveredInformation.into_error())?;
        let InformationResult::Number { value } = delivered else {
            return Err(ErrorKind::InvalidDeliveredInformation.into_error());
        };
        if !choices.iter().any(|choice| choice.value == value) {
            return Err(ErrorKind::InvalidDeliveredInformation.into_error());
        }
        (
            InformationResult::Number { value },
            DeliveryContext::Discretionary {
                reasons: impairment_reasons,
            },
        )
    } else if delivered_result.is_none() && registration_judgments.is_empty() {
        (computed_result.clone(), DeliveryContext::Fixed)
    } else {
        if registration_judgments.is_empty() && !choices.iter().any(|choice| !choice.is_computed) {
            return Err(ErrorKind::UnexpectedDeliveredInformation.into_error());
        }
        let delivered =
            delivered_result.ok_or_else(|| ErrorKind::MissingDeliveredInformation.into_error())?;
        let InformationResult::Number { value } = delivered else {
            return Err(ErrorKind::InvalidDeliveredInformation.into_error());
        };
        let valid = choices.iter().any(|choice| {
            !choice.is_computed
                && choice.value == value
                && choice.registration_judgments == registration_judgments
        });
        if !valid {
            return Err(ErrorKind::InvalidRegistrationJudgment.into_error());
        }
        (
            InformationResult::Number { value },
            DeliveryContext::Discretionary {
                reasons: vec![DeliveryReason::RegistrationJudgment {
                    judgments: registration_judgments,
                }],
            },
        )
    };

    Ok(ConfirmedInformation {
        actor: information_actor(step),
        target_player_ids: target_player_ids(input),
        computed_result: Some(computed_result),
        delivered_result,
        delivery_context,
    })
}

fn confirmed_setup_information(
    step: &PhaseStep,
    players: &[Player],
    events: &[GameEvent],
    input: &StepInput,
    selected_result: InformationResult,
    delivered_result: Option<InformationResult>,
    registration_judgments: Vec<RegistrationJudgment>,
) -> Result<ConfirmedInformation, CoreError> {
    if delivered_result.is_some() {
        return Err(ErrorKind::UnexpectedDeliveredInformation.into_error());
    }
    let setup_info = step
        .required_input
        .setup_info
        .ok_or_else(|| ErrorKind::InvalidStepInput.into_error())?;
    let impairment_reasons = active_delivery_reasons(step, players, events);
    let (computed_result, delivery_context) = if !impairment_reasons.is_empty() {
        if !registration_judgments.is_empty() {
            return Err(ErrorKind::InvalidRegistrationJudgment.into_error());
        }
        if !setup_info_input_is_valid_impaired(setup_info, input, players) {
            return Err(ErrorKind::InvalidStepInput.into_error());
        }
        (
            None,
            DeliveryContext::Discretionary {
                reasons: impairment_reasons,
            },
        )
    } else if registration_judgments.is_empty() {
        if !setup_info_input_is_valid_normal(setup_info, input, players) {
            return Err(ErrorKind::InvalidStepInput.into_error());
        }
        (Some(selected_result.clone()), DeliveryContext::Fixed)
    } else {
        if !setup_info_input_is_valid_registration(step, input, players, &registration_judgments) {
            return Err(ErrorKind::InvalidRegistrationJudgment.into_error());
        }
        (
            Some(selected_result.clone()),
            DeliveryContext::Discretionary {
                reasons: vec![DeliveryReason::RegistrationJudgment {
                    judgments: registration_judgments,
                }],
            },
        )
    };

    Ok(ConfirmedInformation {
        actor: information_actor(step),
        target_player_ids: target_player_ids(input),
        computed_result,
        delivered_result: selected_result,
        delivery_context,
    })
}

fn information_actor(step: &PhaseStep) -> Option<InformationActor> {
    step.player_id
        .as_ref()
        .zip(step.character.as_ref())
        .map(|(player_id, character_id)| InformationActor {
            player_id: player_id.clone(),
            character_id: character_id.clone(),
        })
}

fn target_player_ids(input: &StepInput) -> Vec<String> {
    input
        .as_ref()
        .and_then(|value| value.player_ids.clone())
        .unwrap_or_default()
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
        // Delivered Information. Setup-information still needs the rule that applied to the
        // actor at the time: impaired actors could receive any ability-shaped result, while
        // sober actors remain constrained to the computed roster truth.
        if let Some(setup_info) = step.required_input.setup_info {
            let valid = if active_delivery_reasons(step, players, prior_events).is_empty() {
                setup_info_input_is_valid_normal(setup_info, input, players)
            } else {
                setup_info_input_is_valid_impaired(setup_info, input, players)
            };
            if !valid {
                return Err(ErrorKind::InvalidStepInput.into_error());
            }
        }
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
    let delivered_result = match (&information.delivery_context, step.required_input.kind) {
        (_, RequiredInputKind::SetupInfo) | (DeliveryContext::Fixed, _) => None,
        (DeliveryContext::Discretionary { .. }, _) => Some(information.delivered_result.clone()),
    };
    let expected = confirmed_information(
        step,
        players,
        prior_events,
        input,
        delivered_result,
        registration_judgments,
    );
    if expected
        .as_ref()
        .is_ok_and(|expected| expected.as_ref() == Some(information))
    {
        Ok(())
    } else if legacy_numeric_registration_information_is_valid(
        step,
        players,
        prior_events,
        input,
        information,
    ) || legacy_spy_information_is_valid(step, players, input, information)
    {
        Ok(())
    } else {
        Err(ErrorKind::ReplayFailed.into_error())
    }
}

fn legacy_spy_information_is_valid(
    step: &PhaseStep,
    players: &[Player],
    input: &StepInput,
    information: &ConfirmedInformation,
) -> bool {
    if step.character.as_deref() != Some("spy")
        || information.actor != information_actor(step)
        || information.target_player_ids != target_player_ids(input)
        || information.delivery_context != DeliveryContext::Fixed
    {
        return false;
    }
    let expected = spy_grimoire_result(players, &[], &[]);
    information
        .computed_result
        .as_ref()
        .is_some_and(|result| legacy_spy_result_matches(result, &expected))
        && legacy_spy_result_matches(&information.delivered_result, &expected)
}

fn legacy_spy_result_matches(actual: &InformationResult, expected: &InformationResult) -> bool {
    let (
        InformationResult::SpyGrimoire { players: actual },
        InformationResult::SpyGrimoire { players: expected },
    ) = (actual, expected)
    else {
        return false;
    };
    actual.len() == expected.len()
        && actual.iter().zip(expected).all(|(actual, expected)| {
            actual.player_id == expected.player_id
                && actual.seat == expected.seat
                && actual.name == expected.name
                && actual.character_id == expected.character_id
                && actual.alive.is_none()
                && actual.ghost_vote_used.is_none()
                && actual.reminder_tokens.is_none()
        })
}

fn legacy_numeric_registration_information_is_valid(
    step: &PhaseStep,
    players: &[Player],
    prior_events: &[GameEvent],
    input: &StepInput,
    information: &ConfirmedInformation,
) -> bool {
    let Some(computed_result @ InformationResult::Number { .. }) =
        computed_information_result(step, players, input)
    else {
        return false;
    };
    if information.computed_result.as_ref() != Some(&computed_result)
        || information.actor != information_actor(step)
        || information.target_player_ids != target_player_ids(input)
    {
        return false;
    }
    let DeliveryContext::Discretionary { reasons } = &information.delivery_context else {
        return false;
    };
    let Some(judgments) = reasons.iter().find_map(|reason| match reason {
        DeliveryReason::RegistrationJudgment { judgments } => Some(judgments),
        _ => None,
    }) else {
        return false;
    };
    if !legacy_alignment_judgments_are_valid(step, players, judgments) {
        return false;
    }
    let active_reasons = active_delivery_reasons(step, players, prior_events);
    let mut expected_reasons = active_reasons.clone();
    expected_reasons.push(DeliveryReason::RegistrationJudgment {
        judgments: judgments.clone(),
    });
    if reasons != &expected_reasons {
        return false;
    }
    if active_reasons.is_empty() {
        number_result_with_registration_judgments(step, players, judgments).is_some_and(
            |expected| {
                information.delivered_result == InformationResult::Number { value: expected }
            },
        )
    } else {
        matches!(
            information.delivered_result,
            InformationResult::Number { value: 0..=15 }
        )
    }
}

fn legacy_alignment_judgments_are_valid(
    step: &PhaseStep,
    players: &[Player],
    judgments: &[RegistrationJudgment],
) -> bool {
    let candidates = registration_candidate_player_ids(step, players)
        .into_iter()
        .collect::<HashSet<_>>();
    let mut seen = HashSet::new();
    !candidates.is_empty()
        && judgments.len() == candidates.len()
        && judgments.iter().all(|judgment| {
            judgment.character_id.is_none()
                && candidates.contains(&judgment.player_id)
                && seen.insert(judgment.player_id.as_str())
                && matches!(
                    judgment.registered_as,
                    RegistrationValue::Good | RegistrationValue::Evil
                )
        })
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

pub(crate) fn actor_is_impaired(
    step: &PhaseStep,
    players: &[Player],
    events: &[GameEvent],
) -> bool {
    !active_delivery_reasons(step, players, events).is_empty()
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
    let last_to_night = events.iter().rposition(|event| matches!(&event.kind, GameEventKind::PhaseStepConfirmed { payload } if payload.step_id.ends_with(":toNight")));
    events
        .iter()
        .enumerate()
        .rev()
        .find_map(|(index, event)| match &event.kind {
            GameEventKind::NightActionResolved { payload } => match &payload.resolution {
                crate::contracts::NightActionResolution::Poison {
                    target_player_id,
                    applied: true,
                    ..
                } if target_player_id == actor_id
                    && last_to_night.is_none_or(|boundary| index > boundary)
                    && players.iter().any(|player| {
                        player.id == payload.actor_player_id
                            && player.alive
                            && player.actual_character == "poisoner"
                    }) =>
                {
                    Some(DeliveryReason::Poisoned {
                        poisoner_player_id: payload.actor_player_id.clone(),
                        poison_event_id: event.id.clone(),
                    })
                }
                _ => None,
            },
            GameEventKind::PhaseStepConfirmed { payload }
                if payload.step_id == format!("{prefix}:poisoner") =>
            {
                payload
                    .input
                    .as_ref()
                    .and_then(|input| input.player_ids.as_ref())
                    .is_some_and(|ids| ids.iter().any(|id| id == actor_id))
                    .then(|| DeliveryReason::Poisoned {
                        poisoner_player_id: poisoner.id.clone(),
                        poison_event_id: event.id.clone(),
                    })
            }
            _ => None,
        })
}

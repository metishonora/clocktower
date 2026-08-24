use crate::{
    contracts::{
        DeathBypassPolicy, GameEvent, GameEventKind, OrderedDeathOutcome,
        OrderedDeathResolvedPayload, OrderedDeathSource, PhilosopherAbilityOutcome,
        PreventionDecision,
    },
    error::{CoreError, ErrorKind},
    model::{AbilityOrigin, AbilityUseRef, Phase, Player},
};

pub(crate) fn validate_contract(payload: &OrderedDeathResolvedPayload) -> Result<(), CoreError> {
    if payload.resolutions.is_empty() {
        return invalid_resolution();
    }

    for (resolution_index, resolution) in payload.resolutions.iter().enumerate() {
        if resolution.sequence != (resolution_index + 1) as u32 {
            return invalid_resolution();
        }
        for (check_index, check) in resolution.prevention_checks.iter().enumerate() {
            if check.sequence != (check_index + 1) as u32 {
                return invalid_resolution();
            }
        }

        let applied = resolution
            .prevention_checks
            .iter()
            .filter(|check| check.decision == PreventionDecision::Applied)
            .collect::<Vec<_>>();
        if applied.len() > 1 {
            return invalid_resolution();
        }

        match resolution.attempt.bypass_policy {
            DeathBypassPolicy::None
                if resolution
                    .prevention_checks
                    .iter()
                    .any(|check| check.decision == PreventionDecision::Bypassed) =>
            {
                return invalid_resolution();
            }
            DeathBypassPolicy::AllTargetProtections
                if resolution
                    .prevention_checks
                    .iter()
                    .any(|check| check.decision != PreventionDecision::Bypassed) =>
            {
                return invalid_resolution();
            }
            _ => {}
        }

        match &resolution.outcome {
            OrderedDeathOutcome::Prevented {
                prevention_sequence,
            } if applied.len() == 1 && applied[0].sequence == *prevention_sequence => {}
            OrderedDeathOutcome::Prevented { .. } => return invalid_resolution(),
            OrderedDeathOutcome::Occurred { .. } if applied.is_empty() => {}
            OrderedDeathOutcome::Occurred { .. } => return invalid_resolution(),
            OrderedDeathOutcome::NoEffect { .. } if resolution.prevention_checks.is_empty() => {}
            OrderedDeathOutcome::NoEffect { .. } => return invalid_resolution(),
        }
    }
    Ok(())
}

pub(crate) fn apply_ordered_death(
    players: &mut [Player],
    prior_events: &[GameEvent],
    payload: &OrderedDeathResolvedPayload,
) -> Result<(), CoreError> {
    validate_contract(payload)?;
    if let OrderedDeathSource::Ability {
        ability_use,
        ability_origin,
    } = &payload.source
    {
        validate_ability_reference(players, prior_events, ability_use, ability_origin)?;
    }

    for resolution in &payload.resolutions {
        if !players
            .iter()
            .any(|player| player.id == resolution.attempt.target_player_id)
        {
            return invalid_resolution();
        }
        for check in &resolution.prevention_checks {
            validate_ability_reference(
                players,
                prior_events,
                &check.source.ability_use,
                &check.source.ability_origin,
            )?;
        }

        match &resolution.outcome {
            OrderedDeathOutcome::Occurred { player_id } => {
                let Some(player) = players
                    .iter_mut()
                    .find(|player| player.id == *player_id && player.alive)
                else {
                    return invalid_resolution();
                };
                player.alive = false;
            }
            OrderedDeathOutcome::NoEffect { reason }
                if *reason == crate::contracts::OrderedDeathNoEffectReason::TargetAlreadyDead =>
            {
                if !players
                    .iter()
                    .any(|player| player.id == resolution.attempt.target_player_id && !player.alive)
                {
                    return invalid_resolution();
                }
            }
            OrderedDeathOutcome::Prevented { .. } | OrderedDeathOutcome::NoEffect { .. } => {}
        }
    }
    Ok(())
}

fn validate_ability_reference(
    players: &[Player],
    prior_events: &[GameEvent],
    ability_use: &AbilityUseRef,
    origin: &AbilityOrigin,
) -> Result<(), CoreError> {
    match origin {
        AbilityOrigin::IdentityBound => {
            let valid = players.iter().any(|player| {
                player.id == ability_use.owner_player_id
                    && player.ability_instance.id == ability_use.ability_instance_id
                    && player.ability_instance.character_id == ability_use.character_id
            });
            if !valid {
                return Err(ErrorKind::InvalidEventReference.into_error());
            }
        }
        AbilityOrigin::Acquired {
            acquisition_event_id,
            source,
        } => {
            let valid_owner = players.iter().any(|player| {
                player.id == ability_use.owner_player_id
                    && player.ability_instance.id == source.ability_instance_id
                    && player.ability_instance.character_id == source.character_id
            });
            let valid = valid_owner
                && source.owner_player_id == ability_use.owner_player_id
                && prior_events.iter().any(|event| {
                    if event.id != *acquisition_event_id {
                        return false;
                    }
                    matches!(
                        &event.kind,
                        GameEventKind::PhilosopherAbilityResolved { payload }
                            if payload.actor == *source
                                && payload.selected_character_id.as_deref()
                                    == Some(ability_use.character_id.as_str())
                                && matches!(
                                    &payload.outcome,
                                    PhilosopherAbilityOutcome::Acquired {
                                        granted_ability_instance_id
                                    } if granted_ability_instance_id
                                        == &ability_use.ability_instance_id
                                )
                    )
                });
            if !valid {
                return Err(ErrorKind::InvalidEventReference.into_error());
            }
        }
    }
    Ok(())
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct DeathFact<'a> {
    pub(crate) event_id: &'a str,
    pub(crate) sequence: u32,
    pub(crate) player_id: &'a str,
}

pub(crate) fn event_death_facts(event: &GameEvent) -> Vec<DeathFact<'_>> {
    let players = match &event.kind {
        GameEventKind::DeathConfirmed { payload } => vec![(1, payload.player_id.as_str())],
        GameEventKind::NightActionResolved { payload } => match &payload.resolution {
            crate::contracts::NightActionResolution::ImpAttack {
                outcome: crate::contracts::ImpAttackOutcome::Death { player_id },
                ..
            } => vec![(1, player_id.as_str())],
            crate::contracts::NightActionResolution::DemonAttack {
                outcome: crate::contracts::DemonAttackOutcome::Deaths { deaths, .. },
                ..
            } => deaths
                .iter()
                .enumerate()
                .map(|(index, death)| ((index + 1) as u32, death.player_id.as_str()))
                .collect(),
            crate::contracts::NightActionResolution::DemonAttack {
                outcome: crate::contracts::DemonAttackOutcome::FangGuJump { death, .. },
                ..
            } => vec![(1, death.player_id.as_str())],
            _ => vec![],
        },
        GameEventKind::PitHagArbitraryDeathsConfirmed { payload } => payload
            .deaths
            .iter()
            .enumerate()
            .map(|(index, death)| ((index + 1) as u32, death.player_id.as_str()))
            .collect(),
        GameEventKind::OrderedDeathResolved { payload } => payload
            .resolutions
            .iter()
            .filter_map(|resolution| match &resolution.outcome {
                OrderedDeathOutcome::Occurred { player_id } => {
                    Some((resolution.sequence, player_id.as_str()))
                }
                _ => None,
            })
            .collect(),
        _ => vec![],
    };
    players
        .into_iter()
        .map(|(sequence, player_id)| DeathFact {
            event_id: &event.id,
            sequence,
            player_id,
        })
        .collect()
}

pub(crate) fn unannounced_night_deaths(events: &[GameEvent]) -> Vec<String> {
    let mut deaths = Vec::new();
    for event in events {
        match &event.kind {
            GameEventKind::NightActionResolved { .. }
            | GameEventKind::PitHagArbitraryDeathsConfirmed { .. }
            | GameEventKind::OrderedDeathResolved { .. }
                if matches!(event.phase, Phase::FirstNight | Phase::Night) =>
            {
                for fact in event_death_facts(event) {
                    if !deaths.iter().any(|player_id| player_id == fact.player_id) {
                        deaths.push(fact.player_id.to_string());
                    }
                }
            }
            GameEventKind::NightDeathsAnnounced { payload } => {
                deaths.retain(|player_id| !payload.player_ids.contains(player_id));
            }
            _ => {}
        }
    }
    deaths
}

fn invalid_resolution<T>() -> Result<T, CoreError> {
    Err(ErrorKind::InvalidDeathResolution.into_error())
}

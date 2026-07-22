use crate::{
    characters::{
        character_kind, character_steps, first_night_order, legal_demon_bluff_character_ids,
        night_order,
    },
    contracts::{
        ActiveRuleEffect, GameEvent, GameEventKind, ImpAttackOutcome, NightActionResolution,
    },
    model::{
        CharacterKind, InputTarget, Phase, PhaseStep, Player, PreActionReveal, RequiredInput,
        RequiredInputKind, StepType,
    },
    phase::{phase_prefix, phase_transition_step, required_characters, required_none, simple_step},
};

pub(crate) fn first_night_steps(players: &[Player], events: &[GameEvent]) -> Vec<PhaseStep> {
    let mut steps = Vec::new();
    if players.iter().any(|player| {
        matches!(
            character_kind(&player.actual_character),
            Some(CharacterKind::Minion)
        )
    }) {
        steps.push(simple_step(
            Phase::FirstNight,
            "firstNight",
            "minionInfo",
            StepType::EvilInfo,
            required_none(),
            false,
        ));
    }
    if players.iter().any(|player| {
        matches!(
            character_kind(&player.actual_character),
            Some(CharacterKind::Demon)
        )
    }) {
        steps.push(simple_step(
            Phase::FirstNight,
            "firstNight",
            "demonInfo",
            StepType::EvilInfo,
            required_characters(0, 3, Some(legal_demon_bluff_character_ids(players)), true),
            false,
        ));
    }

    let mut character_steps = character_steps(
        Phase::FirstNight,
        "firstNight",
        players,
        first_night_order(),
    );
    enrich_targets(&mut character_steps, players, events);
    if let Some(index) = character_steps.iter().position(|step| {
        step.character.as_deref() == Some("fortuneTeller")
            && step.player_id.as_ref().is_some_and(|id| {
                players
                    .iter()
                    .any(|p| p.id == *id && p.actual_character == "fortuneTeller")
            })
    }) {
        let assigned = events
            .iter()
            .any(|event| matches!(event.kind, GameEventKind::RedHerringAssigned { .. }));
        if !assigned {
            let actor = character_steps[index].player_id.clone();
            character_steps.insert(
                index,
                PhaseStep {
                    id: "firstNight:fortuneTellerRedHerring".into(),
                    phase: Phase::FirstNight,
                    step_type: StepType::RedHerringAssignment,
                    character: Some("fortuneTeller".into()),
                    player_id: actor,
                    required_input: RequiredInput {
                        kind: RequiredInputKind::PlayerIds,
                        target: Some(InputTarget::Player),
                        min_selections: Some(1),
                        max_selections: Some(1),
                        setup_info: None,
                        character_kind: None,
                        allowed_character_ids: None,
                        allowed_player_ids: Some(
                            players
                                .iter()
                                .filter(|p| {
                                    p.alignment == crate::model::Alignment::Good
                                        || p.actual_character == "spy"
                                })
                                .map(|p| p.id.clone())
                                .collect(),
                        ),
                        player_registration_options: Some(
                            players
                                .iter()
                                .filter(|p| p.actual_character == "spy")
                                .map(|p| crate::model::RegistrationJudgment {
                                    player_id: p.id.clone(),
                                    registered_as: crate::model::RegistrationValue::Good,
                                    character_id: None,
                                })
                                .collect(),
                        ),
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
                },
            );
        }
    }
    steps.extend(character_steps);
    steps.push(phase_transition_step(
        Phase::FirstNight,
        "firstNight",
        "toDay",
        RequiredInputKind::Day,
    ));
    steps
}

pub(crate) fn night_steps(
    players: &[Player],
    events: &[GameEvent],
    cycle: usize,
) -> Vec<PhaseStep> {
    let prefix = phase_prefix("night", cycle);
    let mut steps = character_steps(Phase::Night, &prefix, players, night_order());
    steps.retain(|step| {
        step.player_id
            .as_ref()
            .is_none_or(|id| players.iter().any(|p| p.id == *id && p.alive))
    });
    steps.retain(|step| step.character.as_deref() != Some("ravenkeeper"));
    if imp_succeeded_during_night(events, &prefix) {
        steps.retain(|step| step.character.as_deref() != Some("imp"));
    }
    if !events
        .iter()
        .any(|e| matches!(e.kind, GameEventKind::RedHerringAssigned { .. }))
    {
        if let Some(pos) = steps.iter().position(|s| {
            s.character.as_deref() == Some("fortuneTeller")
                && s.player_id.as_ref().is_some_and(|id| {
                    players
                        .iter()
                        .any(|p| p.id == *id && p.actual_character == "fortuneTeller")
                })
        }) {
            let actor = steps[pos].player_id.clone();
            steps.insert(
                pos,
                PhaseStep {
                    id: format!("{prefix}:fortuneTellerRedHerring"),
                    phase: Phase::Night,
                    step_type: StepType::RedHerringAssignment,
                    character: Some("fortuneTeller".into()),
                    player_id: actor,
                    required_input: RequiredInput {
                        kind: RequiredInputKind::PlayerIds,
                        target: Some(InputTarget::Player),
                        min_selections: Some(1),
                        max_selections: Some(1),
                        setup_info: None,
                        character_kind: None,
                        allowed_character_ids: None,
                        allowed_player_ids: Some(
                            players
                                .iter()
                                .filter(|p| {
                                    p.alignment == crate::model::Alignment::Good
                                        || p.actual_character == "spy"
                                })
                                .map(|p| p.id.clone())
                                .collect(),
                        ),
                        player_registration_options: Some(
                            players
                                .iter()
                                .filter(|p| p.actual_character == "spy")
                                .map(|p| crate::model::RegistrationJudgment {
                                    player_id: p.id.clone(),
                                    registered_as: crate::model::RegistrationValue::Good,
                                    character_id: None,
                                })
                                .collect(),
                        ),
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
                },
            );
        }
    }
    let executed_dead = previous_executed_death(events, cycle);
    steps.retain(|step| step.character.as_deref() != Some("undertaker") || executed_dead.is_some());
    let raven_id = events.iter().find_map(|event| match &event.kind {
        GameEventKind::NightActionResolved { payload } if payload.step_id.starts_with(&prefix) => {
            match &payload.resolution {
                NightActionResolution::ImpAttack {
                    outcome: ImpAttackOutcome::Death { player_id },
                    ..
                } if players
                    .iter()
                    .any(|p| p.id == *player_id && p.actual_character == "ravenkeeper") =>
                {
                    Some(player_id.clone())
                }
                _ => None,
            }
        }
        _ => None,
    });
    if let Some(raven_id) = raven_id {
        let pos = steps
            .iter()
            .position(|s| s.character.as_deref() == Some("imp"))
            .map_or(0, |pos| pos + 1);
        steps.insert(pos, custom_character_step(&prefix, "ravenkeeper", raven_id));
    }
    attach_day_succession_reveal(&mut steps, events, cycle);
    enrich_targets(&mut steps, players, events);
    steps
        .into_iter()
        .chain([phase_transition_step(
            Phase::Night,
            &prefix,
            "toDay",
            RequiredInputKind::Day,
        )])
        .collect()
}

fn custom_character_step(prefix: &str, character: &str, player_id: String) -> PhaseStep {
    PhaseStep {
        id: format!("{prefix}:{character}"),
        phase: Phase::Night,
        step_type: StepType::Character,
        character: Some(character.into()),
        player_id: Some(player_id),
        required_input: crate::characters::character_required_input(character),
        can_skip: true,
        support: crate::model::PhaseStepSupport::Automated,
        information_prompt: None,
        pre_action_reveal: None,
    }
}

fn attach_day_succession_reveal(steps: &mut [PhaseStep], events: &[GameEvent], cycle: usize) {
    let day_prefix = phase_prefix("day", cycle);
    let night_imp_step_id = format!("{}:imp", phase_prefix("night", cycle));
    let Some((succession_index, succession_event, payload)) = events
        .iter()
        .enumerate()
        .rev()
        .find_map(|(index, event)| {
            let GameEventKind::DemonSuccessionConfirmed { payload } = &event.kind else {
                return None;
            };
            let triggered_this_day = events.iter().any(|candidate| {
                candidate.id == payload.trigger_imp_death_event_id
                    && matches!(
                        &candidate.kind,
                        GameEventKind::DeathConfirmed { payload: death }
                            if death.step_id.as_ref().is_some_and(|step_id| {
                                step_id == &day_prefix || step_id.starts_with(&format!("{day_prefix}:"))
                            })
                    )
            });
            (event.phase == Phase::Day && payload.new_character == "imp" && triggered_this_day)
                .then_some((index, event, payload))
        })
    else {
        return;
    };
    let imp_step_finished =
        events
            .iter()
            .skip(succession_index + 1)
            .any(|event| match &event.kind {
                GameEventKind::NightActionResolved { payload } => {
                    payload.step_id == night_imp_step_id
                }
                GameEventKind::PhaseStepSkipped { payload } => payload.step_id == night_imp_step_id,
                _ => false,
            });
    if imp_step_finished {
        return;
    }
    if let Some(step) = steps.iter_mut().find(|step| {
        step.id == night_imp_step_id
            && step.player_id.as_deref() == Some(payload.successor_player_id.as_str())
    }) {
        step.pre_action_reveal = Some(PreActionReveal {
            kind: "characterChange",
            source_event_id: succession_event.id.clone(),
            player_id: payload.successor_player_id.clone(),
            alignment: "evil",
            character_id: "imp",
        });
    }
}

fn imp_succeeded_during_night(events: &[GameEvent], prefix: &str) -> bool {
    let imp_step_id = format!("{prefix}:imp");
    events.iter().any(|event| {
        let GameEventKind::DemonSuccessionConfirmed { payload } = &event.kind else {
            return false;
        };
        event.phase == Phase::Night
            && events.iter().any(|candidate| {
                candidate.id == payload.trigger_imp_death_event_id
                    && matches!(
                        &candidate.kind,
                        GameEventKind::NightActionResolved { payload: action }
                            if action.step_id == imp_step_id
                    )
            })
    })
}

pub(crate) fn previous_executed_death(events: &[GameEvent], cycle: usize) -> Option<String> {
    let prefix = phase_prefix("day", cycle);
    let normal_execution = events.iter().find_map(|e| match &e.kind {
        GameEventKind::ExecutionConfirmed { payload }
            if payload.step_id == format!("{prefix}:execution") =>
        {
            payload.input.player_id.clone()
        }
        _ => None,
    });
    if let Some(executed) = normal_execution {
        if events.iter().any(|e| matches!(&e.kind, GameEventKind::DeathConfirmed { payload } if payload.step_id.as_deref() == Some(format!("{prefix}:executionDeath").as_str()) && payload.player_id == executed)) {
            return Some(executed);
        }
    }

    events.iter().find_map(|event| {
        let GameEventKind::NominationStarted { payload } = &event.kind else {
            return None;
        };
        if !payload
            .step_id
            .starts_with(format!("{prefix}:nomination:").as_str())
            || !matches!(
                payload.virgin_resolution,
                crate::contracts::VirginResolution::SpentAndNominatorExecuted { .. }
            )
        {
            return None;
        }
        let death_step_id = format!("{}:virginDeath", payload.step_id);
        events
            .iter()
            .any(|candidate| {
                matches!(
                    &candidate.kind,
                    GameEventKind::DeathConfirmed { payload: death }
                        if death.step_id.as_deref() == Some(death_step_id.as_str())
                            && death.player_id == payload.nominator_id
                )
            })
            .then(|| payload.nominator_id.clone())
    })
}

fn enrich_targets(steps: &mut [PhaseStep], players: &[Player], events: &[GameEvent]) {
    let active_poison = active_night_poison(events, players);
    let active_protection = active_night_protection(events, players);
    for step in steps {
        if matches!(
            step.required_input.target,
            Some(InputTarget::Player | InputTarget::Players)
        ) {
            let mut ids = players.iter().map(|p| p.id.clone()).collect::<Vec<_>>();
            if step
                .character
                .as_deref()
                .is_some_and(|character| !crate::characters::character_can_target_self(character))
            {
                ids.retain(|id| Some(id.as_str()) != step.player_id.as_deref());
            }
            step.required_input.allowed_player_ids = Some(ids);
        }
        if step.character.as_deref() == Some("imp") {
            step.required_input.mayor_decision = step.player_id.as_deref().and_then(|actor| {
                crate::characters::mayor_decision_prompt(
                    players,
                    actor,
                    active_poison.as_ref(),
                    active_protection.as_ref(),
                )
            });
        }
    }
}

pub(crate) fn active_night_poison(
    events: &[GameEvent],
    players: &[Player],
) -> Option<ActiveRuleEffect> {
    let last_to_night = events.iter().rposition(|event| {
        matches!(
            &event.kind,
            GameEventKind::PhaseStepConfirmed { payload } if payload.step_id.ends_with(":toNight")
        )
    });
    events
        .iter()
        .enumerate()
        .rev()
        .find_map(|(index, event)| match &event.kind {
            GameEventKind::NightActionResolved { payload }
                if matches!(
                    payload.resolution,
                    NightActionResolution::Poison { applied: true, .. }
                ) && last_to_night.is_none_or(|boundary| index > boundary)
                    && players.iter().any(|player| {
                        player.id == payload.actor_player_id
                            && player.alive
                            && player.actual_character == "poisoner"
                    }) =>
            {
                let NightActionResolution::Poison {
                    target_player_id, ..
                } = &payload.resolution
                else {
                    unreachable!()
                };
                Some(ActiveRuleEffect {
                    player_id: target_player_id.clone(),
                    source_player_id: payload.actor_player_id.clone(),
                    source_event_id: event.id.clone(),
                })
            }
            _ => None,
        })
}

pub(crate) fn active_night_protection(
    events: &[GameEvent],
    players: &[Player],
) -> Option<ActiveRuleEffect> {
    let last_to_night = events.iter().rposition(|event| {
        matches!(
            &event.kind,
            GameEventKind::PhaseStepConfirmed { payload } if payload.step_id.ends_with(":toNight")
        )
    });
    let last_to_day = events.iter().rposition(|event| {
        matches!(
            &event.kind,
            GameEventKind::PhaseStepConfirmed { payload } if payload.step_id.ends_with(":toDay")
        )
    });
    events
        .iter()
        .enumerate()
        .rev()
        .find_map(|(index, event)| match &event.kind {
            GameEventKind::NightActionResolved { payload }
                if matches!(
                    payload.resolution,
                    NightActionResolution::MonkProtection { applied: true, .. }
                ) && last_to_night.is_some_and(|boundary| index > boundary)
                    && last_to_day.is_none_or(|boundary| index > boundary)
                    && players.iter().any(|player| {
                        player.id == payload.actor_player_id
                            && player.alive
                            && player.actual_character == "monk"
                    }) =>
            {
                let NightActionResolution::MonkProtection {
                    target_player_id, ..
                } = &payload.resolution
                else {
                    unreachable!()
                };
                Some(ActiveRuleEffect {
                    player_id: target_player_id.clone(),
                    source_player_id: payload.actor_player_id.clone(),
                    source_event_id: event.id.clone(),
                })
            }
            _ => None,
        })
}

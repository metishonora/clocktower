//! Custom daytime orchestration. All facts are replayed and validated before adoption.
pub(crate) mod contracts;
use crate::{
    characters::ResolvedScriptContext,
    contracts::{GameEvent, GameEventKind, Proposal},
    error::{CoreError, ErrorKind},
    model::Phase,
    state::{CustomGameFacts, CustomGameState},
};
use contracts::*;

fn invalid() -> CoreError {
    ErrorKind::InvalidStepInput.into_error()
}
pub(crate) fn step_id(facts: &CustomGameFacts) -> Result<String, CoreError> {
    let day = facts.day.as_ref().ok_or_else(invalid)?;
    Ok(format!(
        "day:{}:{:?}:after{}:{}",
        day.day,
        day.stage,
        facts.prefix_event_id.len(),
        facts.prefix_event_id
    ))
}
fn participants(
    context: &ResolvedScriptContext,
    facts: &CustomGameFacts,
) -> Result<Vec<DayParticipant>, CoreError> {
    facts
        .players
        .iter()
        .map(|p| {
            Ok(DayParticipant {
                player_id: p.id.clone(),
                character_id: p.actual_character.clone(),
                alignment: p.alignment,
                character_kind: context
                    .character_kind(&p.actual_character)
                    .ok_or_else(invalid)?,
                alive: p.alive,
                ghost_vote_used: p.ghost_vote_used,
                abilities: facts
                    .ability_provenance
                    .iter()
                    .filter(|a| {
                        a.ability_use.owner_player_id == p.id
                            && crate::reducer::current_ability_instance(facts, &a.ability_use)
                    })
                    .map(|a| a.ability_use.clone())
                    .collect(),
                impairments: facts
                    .active_impairments
                    .iter()
                    .filter(|e| e.player_id == p.id)
                    .cloned()
                    .collect(),
            })
        })
        .collect()
}
pub(crate) fn view(facts: &CustomGameFacts) -> Option<DayView> {
    let day = facts.day.as_ref()?;
    let threshold = facts
        .players
        .iter()
        .filter(|p| p.alive)
        .count()
        .div_ceil(2)
        .max(1);
    let highest = day
        .nominations
        .iter()
        .filter_map(|n| n.counted_voter_ids.as_ref().map(Vec::len))
        .max()
        .unwrap_or(0);
    let leaders: Vec<_> = day
        .nominations
        .iter()
        .filter(|n| {
            n.counted_voter_ids
                .as_ref()
                .is_some_and(|v| v.len() == highest)
        })
        .collect();
    Some(DayView {
        vote_dependencies: crate::characters::trouble_brewing::day_vote_dependencies(facts),
        townsfolk_registration_nominator_ids:
            crate::characters::trouble_brewing::day_registration_ids(facts, "spy"),
        first_nomination_target_ids:
            crate::characters::trouble_brewing::day_first_nomination_targets(facts),
        demon_registration_target_ids: crate::characters::trouble_brewing::day_registration_ids(
            facts, "recluse",
        ),
        available_actions: crate::characters::trouble_brewing::day_actions(facts)
            .into_iter()
            .chain(crate::characters::sects_and_violets::day_actions(facts))
            .collect(),
        ability_records: day.ability_records.clone(),
        madness: crate::characters::sects_and_violets::day_madness(facts),
        pending_death: day.pending_death.clone(),
        pending_game_end: day.pending_game_end.clone(),
        consequences: day.consequences.clone(),
        deaths: day.deaths.clone(),
        day: day.day,
        stage: day.stage,
        step_id: step_id(facts).ok()?,
        nominations: day.nominations.clone(),
        execution: day.execution.clone(),
        eligible_nominator_ids: facts
            .players
            .iter()
            .filter(|p| p.alive && !day.nominations.iter().any(|n| n.nominator_id == p.id))
            .map(|p| p.id.clone())
            .collect(),
        eligible_nominee_ids: facts
            .players
            .iter()
            .filter(|p| !day.nominations.iter().any(|n| n.nominee_id == p.id))
            .map(|p| p.id.clone())
            .collect(),
        eligible_voter_ids: facts
            .players
            .iter()
            .filter(|p| p.alive || !p.ghost_vote_used)
            .map(|p| p.id.clone())
            .collect(),
        execution_vote_threshold: threshold,
        highest_vote_count: highest,
        execution_candidate_id: if highest >= threshold && leaders.len() == 1 {
            Some(leaders[0].nominee_id.clone())
        } else {
            None
        },
    })
}
pub(crate) fn propose(
    context: &ResolvedScriptContext,
    state: &CustomGameState,
    command: DayCommand,
    event_count: usize,
    created_at: String,
) -> Result<Proposal, CoreError> {
    if command.step_id != step_id(&state.facts)? || command.expected_event_count != event_count {
        return Err(ErrorKind::StaleCommand.into_error());
    }
    let id = format!("day-event-{}", event_count + 1);
    let (_, result) = resolve(context, state, &id, &command.input)?;
    let day = state.facts.day.as_ref().ok_or_else(invalid)?.day;
    let summary = summary(&command.input);
    Ok(Proposal {
        event: GameEvent {
            id,
            phase: Phase::Day,
            summary: summary.into(),
            created_at,
            kind: GameEventKind::DayConfirmed {
                payload: DayConfirmed {
                    step_id: command.step_id,
                    day,
                    input: command.input,
                    result,
                },
            },
        },
        warnings: vec![],
        follow_up_steps: vec![],
        preview: serde_json::json!({"summary": summary}),
        reveal_payload: None,
    })
}
pub(crate) fn apply(
    context: &ResolvedScriptContext,
    state: &CustomGameState,
    event: &GameEvent,
) -> Result<CustomGameState, CoreError> {
    let GameEventKind::DayConfirmed { payload } = &event.kind else {
        return Err(ErrorKind::EventNotSupportedByScript.into_error());
    };
    if event.phase != Phase::Day
        || payload.step_id != step_id(&state.facts)?
        || Some(payload.day) != state.facts.day.as_ref().map(|d| d.day)
    {
        return Err(ErrorKind::StaleStep.into_error());
    }
    let (next, result) = resolve(context, state, &event.id, &payload.input)?;
    if result != payload.result {
        return Err(ErrorKind::ReplayFailed.into_error());
    }
    Ok(next)
}
fn resolve(
    context: &ResolvedScriptContext,
    state: &CustomGameState,
    event_id: &str,
    input: &DayInput,
) -> Result<(CustomGameState, DayOutcome), CoreError> {
    if state.phase != Phase::Day || state.facts.game_end.is_some() {
        return Err(ErrorKind::DayActionWrongPhase.into_error());
    }
    let facts = &state.facts;
    let prior = facts.day.as_ref().ok_or_else(invalid)?;
    let current = view(facts).ok_or_else(invalid)?;
    if prior.pending_game_end.is_some()
        && !matches!(input, DayInput::ConfirmGameEnd | DayInput::EndGame { .. })
    {
        return Err(ErrorKind::GameAlreadyEnded.into_error());
    }
    if crate::characters::sects_and_violets::day_has_pending_consequence(prior)
        && !matches!(
            input,
            DayInput::ResolveConsequence { .. }
                | DayInput::ConfirmGameEnd
                | DayInput::EndGame { .. }
        )
    {
        return Err(invalid());
    }
    let mut next = state.clone();
    let mut day = prior.clone();
    let mut result = DayOutcome {
        stage: day.stage,
        participants: participants(context, facts)?,
        counted_voter_ids: vec![],
        ghost_vote_spent_player_ids: vec![],
        death_player_ids: vec![],
        ability_record: None,
        pending_death: None,
        pending_game_end: None,
        consequences: vec![],
    };
    let mut root_event_id = event_id.to_string();
    match input {
        DayInput::Advance => {
            day.stage = match day.stage {
                DayStage::Announcement => {
                    for p in &mut next.facts.players {
                        if !p.alive {
                            p.death_announced = true;
                        }
                    }
                    DayStage::Whisper
                }
                DayStage::Whisper => DayStage::Discussion,
                DayStage::Discussion => DayStage::Nomination,
                _ => return Err(invalid()),
            };
        }
        DayInput::Nominate {
            nominator_id,
            nominee_id,
            spy_as_townsfolk,
        } => {
            if day.stage != DayStage::Nomination
                || !current.eligible_nominator_ids.contains(nominator_id)
                || !current.eligible_nominee_ids.contains(nominee_id)
            {
                return Err(invalid());
            }
            result.participants = participants(context, facts)?;
            day.nominations.push(NominationRecord {
                event_id: event_id.into(),
                nominator_id: nominator_id.clone(),
                nominee_id: nominee_id.clone(),
                nomination_participants: result.participants.clone(),
                vote_participants: None,
                voter_ids: None,
                counted_voter_ids: None,
                ghost_vote_spent_player_ids: vec![],
            });
            day.stage = DayStage::Voting;
            let executed = crate::characters::trouble_brewing::day_nomination(
                context,
                facts,
                &mut next.facts,
                &mut day,
                event_id,
                nominator_id,
                nominee_id,
                *spy_as_townsfolk,
            )?;
            if !executed {
                crate::characters::sects_and_violets::day_witch(
                    facts,
                    &mut day,
                    nominator_id,
                    event_id,
                )?;
            }
        }
        DayInput::Vote { voter_ids } => {
            if day.stage != DayStage::Voting {
                return Err(invalid());
            }
            let mut unique = std::collections::HashSet::new();
            for id in voter_ids {
                if !unique.insert(id) || !current.eligible_voter_ids.contains(id) {
                    return Err(invalid());
                }
            }
            result.participants = participants(context, facts)?;
            result.counted_voter_ids =
                crate::characters::trouble_brewing::day_counted_voters(facts, voter_ids);
            for id in &result.counted_voter_ids {
                let p = next
                    .facts
                    .players
                    .iter_mut()
                    .find(|p| &p.id == id)
                    .ok_or_else(invalid)?;
                if !p.alive {
                    p.ghost_vote_used = true;
                    result.ghost_vote_spent_player_ids.push(id.clone());
                }
            }
            let nomination = day.nominations.last_mut().ok_or_else(invalid)?;
            nomination.voter_ids = Some(voter_ids.clone());
            nomination.counted_voter_ids = Some(result.counted_voter_ids.clone());
            nomination.vote_participants = Some(result.participants.clone());
            nomination.ghost_vote_spent_player_ids = result.ghost_vote_spent_player_ids.clone();
            day.stage = DayStage::Nomination;
        }
        DayInput::CloseNominations => {
            if day.stage != DayStage::Nomination {
                return Err(invalid());
            }
            day.stage = DayStage::Execution;
        }
        DayInput::ConfirmExecution {} => {
            if day.stage != DayStage::Execution {
                return Err(invalid());
            }
            let player_id = &current.execution_candidate_id;
            day.execution = Some(ExecutionRecord {
                event_id: event_id.into(),
                player_id: player_id.clone(),
                death_event_id: None,
                died: false,
            });
            if let Some(id) = player_id
                .as_ref()
                .filter(|id| facts.player(id).is_some_and(|p| p.alive))
            {
                pending_death(
                    &mut day,
                    id,
                    DayDeathCause::Execution,
                    None,
                    event_id,
                    DayStage::NightReady,
                )?;
            } else {
                day.stage = DayStage::NightReady;
                if player_id.is_none() {
                    day.pending_game_end =
                        crate::characters::trouble_brewing::day_no_execution(facts, event_id)
                            .filter(|_| {
                                !crate::characters::sects_and_violets::day_good_win_blocked(facts)
                            })
                            .or_else(|| {
                                crate::characters::sects_and_violets::day_no_execution(
                                    facts, event_id,
                                )
                            });
                }
            }
        }
        DayInput::ConfirmDeath => {
            let pending = day.pending_death.take().ok_or_else(invalid)?;
            let id = &pending.player_id;
            let player = next
                .facts
                .players
                .iter_mut()
                .find(|p| &p.id == id)
                .ok_or_else(invalid)?;
            if !player.alive {
                return Err(invalid());
            }
            player.alive = false;
            player.death_announced = true;
            let execution = matches!(
                pending.cause,
                DayDeathCause::Execution | DayDeathCause::Virgin | DayDeathCause::Madness
            );
            if execution {
                let record = day.execution.as_mut().ok_or_else(invalid)?;
                record.died = true;
                record.death_event_id = Some(event_id.into());
                day.pending_game_end =
                    crate::characters::trouble_brewing::day_execution_end(facts, id, event_id)
                        .or_else(|| {
                            crate::characters::sects_and_violets::day_execution_end(
                                facts, id, event_id,
                            )
                        });
            }
            result.death_player_ids.push(id.clone());
            root_event_id = pending.root_event_id.clone();
            day.stage = pending.resume_stage;
            day.deaths.push(DayDeathRecord {
                event_id: event_id.into(),
                day: day.day,
                cause: pending.clone(),
                participant: result
                    .participants
                    .iter()
                    .find(|p| &p.player_id == id)
                    .ok_or_else(invalid)?
                    .clone(),
            });
            crate::characters::sects_and_violets::day_death_consequences(
                facts, &mut day, id, event_id,
            );
            crate::characters::trouble_brewing::death_succession(
                context,
                facts,
                &mut next.facts,
                id,
                event_id,
            )?;
        }
        DayInput::UseAbility { action_id, record } => {
            let action = current
                .available_actions
                .iter()
                .find(|a| &a.id == action_id)
                .ok_or_else(|| ErrorKind::DayActionUnavailable.into_error())?;
            match record {
                DayAbilityInput::Slayer { .. } => {
                    crate::characters::trouble_brewing::day_use_ability(
                        context, facts, &mut day, event_id, action, record,
                    )?
                }
                _ => crate::characters::sects_and_violets::day_use_ability(action, record)?,
            }
            if let Some(source) = &action.ability_use {
                if crate::characters::trouble_brewing::day_is_once(&action.character_id)
                    || crate::characters::sects_and_violets::day_is_once(&action.character_id)
                {
                    next.facts
                        .ability_uses
                        .push(crate::contracts::AbilityUseRecord {
                            source_event_id: event_id.into(),
                            ability_use: source.clone(),
                        });
                }
            }
            let entry = DayAbilityRecord {
                event_id: event_id.into(),
                day: day.day,
                action: action.clone(),
                record: record.clone(),
            };
            result.ability_record = Some(entry.clone());
            day.ability_records.push(entry);
        }
        DayInput::CheckMadness {
            assignment_id,
            violation,
        } => {
            let assignment = current
                .madness
                .iter()
                .find(|a| &a.id == assignment_id && a.can_check && a.violation != Some(*violation))
                .ok_or_else(|| ErrorKind::MadnessAssignmentUnavailable.into_error())?;
            day.madness_checks.push((assignment.id.clone(), *violation));
        }
        DayInput::ExecuteMadness { assignment_id } => {
            let assignment = current
                .madness
                .iter()
                .find(|a| &a.id == assignment_id && a.can_execute)
                .ok_or_else(|| ErrorKind::MadnessExecutionUnavailable.into_error())?;
            pending_death(
                &mut day,
                &assignment.target_player_id,
                DayDeathCause::Madness,
                Some(assignment.source.clone()),
                event_id,
                DayStage::NightReady,
            )?;
        }
        DayInput::ResolveConsequence {
            consequence_id,
            player_id,
        } => {
            let consequence = day
                .consequences
                .iter()
                .find(|c| &c.id == consequence_id && !c.resolved)
                .ok_or_else(invalid)?;
            root_event_id = day
                .deaths
                .iter()
                .find(|d| d.event_id == consequence.death_event_id)
                .ok_or_else(invalid)?
                .cause
                .root_event_id
                .clone();
            crate::characters::sects_and_violets::day_resolve_consequence(
                facts,
                &mut next.facts,
                &mut day,
                consequence_id,
                player_id,
                event_id,
            )?;
        }
        DayInput::EndGame { winning_alignment } => {
            next.facts.game_end = Some(
                day.pending_game_end
                    .take()
                    .filter(|e| e.winning_alignment == *winning_alignment)
                    .unwrap_or(crate::contracts::CustomGameEnd {
                        winning_alignment: *winning_alignment,
                        reason: crate::contracts::CustomGameEndReason::StorytellerDecision,
                        source_event_id: event_id.into(),
                    }),
            );
        }
        DayInput::ConfirmGameEnd => {
            let end = day.pending_game_end.take().ok_or_else(invalid)?;
            root_event_id = day
                .history
                .iter()
                .find(|h| h.event_id == end.source_event_id)
                .map(|h| h.root_event_id.clone())
                .unwrap_or_else(|| end.source_event_id.clone());
            next.facts.game_end = Some(end);
        }
        DayInput::BeginNight => {
            if day.stage != DayStage::NightReady || day.execution.is_none() {
                return Err(invalid());
            }
            day.stage = DayStage::Night;
            next.phase = Phase::Night;
            crate::characters::trouble_brewing::begin_night_identity_reveals(&mut next.facts, event_id);
        }
    }
    crate::characters::sects_and_violets::day_record_malfunctions(
        facts,
        &mut next.facts,
        input,
        event_id,
    )?;
    next.facts.day = Some(day.clone());
    crate::effects::resolve_effects(context, &mut next.facts)?;
    if matches!(
        input,
        DayInput::ConfirmDeath | DayInput::ResolveConsequence { .. }
    ) && day.pending_game_end.is_none()
    {
        day.pending_game_end = common_game_end(context, &next.facts, &day, event_id);
    }
    result.stage = day.stage;
    result.pending_death = day.pending_death.clone();
    result.pending_game_end = day.pending_game_end.clone();
    result.consequences = day.consequences.clone();
    day.history.push(DayHistoryEntry {
        event_id: event_id.into(),
        step_id: current.step_id,
        root_event_id,
    });
    next.facts.day = Some(day);
    next.facts.prefix_event_id = event_id.into();
    record_first_days(&mut next.facts);
    Ok((next, result))
}
fn summary(input: &DayInput) -> &'static str {
    match input {
        DayInput::EndGame { .. } => "이야기꾼 게임 종료",
        DayInput::UseAbility { .. } => "낮 능력 기록",
        DayInput::CheckMadness { .. } => "집착 판정",
        DayInput::ExecuteMadness { .. } => "집착 위반 처형",
        DayInput::ResolveConsequence { .. } => "사망 후속 처리",
        DayInput::ConfirmGameEnd => "게임 종료 확정",
        DayInput::Advance => "낮 진행",
        DayInput::Nominate { .. } => "지목 확정",
        DayInput::Vote { .. } => "투표 확정",
        DayInput::CloseNominations => "지목 종료",
        DayInput::ConfirmExecution {} => "투표 결과에 따른 처형 처리",
        DayInput::ConfirmDeath => "사망 확정",
        DayInput::BeginNight => "다음 밤 시작",
    }
}
pub(crate) fn executions(
    facts: &CustomGameFacts,
    mut units: Vec<crate::first_night::execution::ActionExecution>,
    previous_undo: Option<crate::first_night::execution::LatestUndoUnit>,
) -> (
    Vec<crate::first_night::execution::ActionExecution>,
    Option<crate::first_night::execution::LatestUndoUnit>,
) {
    use crate::first_night::execution::{ActionExecution, LatestUndoUnit};
    let Some(day) = &facts.day else {
        return (units, previous_undo);
    };
    for entry in facts
        .past_days
        .iter()
        .chain(std::iter::once(day))
        .flat_map(|d| &d.history)
    {
        // Night units and day history are collected separately before chronological sorting.
        // A dawn-triggered win must join its night source even after past-day units were added.
        if let Some(last) = units
            .iter_mut()
            .find(|u| u.event_ids.contains(&entry.root_event_id))
        {
            last.event_ids.push(entry.event_id.clone());
            last.step_ids.push(entry.step_id.clone());
        } else {
            units.push(ActionExecution {
                id: format!("day-execution:{}", entry.event_id),
                root_step_id: entry.step_id.clone(),
                display_step_id: entry.step_id.clone(),
                step_ids: vec![entry.step_id.clone()],
                event_ids: vec![entry.event_id.clone()],
                status: "complete",
            });
        }
    }
    let undo = units.last().and_then(|u| {
        Some(LatestUndoUnit {
            id: u.event_ids.last()?.clone(),
            execution_id: u.id.clone(),
            event_ids: u.event_ids.clone(),
            summary_step_id: u.display_step_id.clone(),
        })
    });
    (units, undo)
}

/// Source identities are shared across UI, command validation and usage records.
pub(crate) fn ability_actions(
    facts: &CustomGameFacts,
    characters: &[&str],
) -> Vec<DayAbilityAction> {
    let Some(day) = &facts.day else {
        return vec![];
    };
    if day.stage == DayStage::Night
        || day.pending_death.is_some()
        || day.pending_game_end.is_some()
        || facts.game_end.is_some()
        || crate::characters::sects_and_violets::day_has_pending_consequence(day)
    {
        return vec![];
    }
    let mut actions = vec![];
    for record in &facts.ability_provenance {
        let source = &record.ability_use;
        if !characters.contains(&source.character_id.as_str())
            || !crate::reducer::current_ability_instance(facts, source)
            || !facts
                .player(&source.owner_player_id)
                .is_some_and(|p| p.alive)
        {
            continue;
        }
        let id = format!(
            "day-ability:{}",
            serde_json::to_string(source).expect("ability source")
        );
        actions.push(DayAbilityAction {
            id,
            actor_player_id: source.owner_player_id.clone(),
            character_id: source.character_id.clone(),
            ability_use: Some(source.clone()),
            simulation_source: None,
            effective: crate::effects::effective(facts, source),
            impaired: crate::effects::impaired(facts, &source.owner_player_id),
            vortox: !facts.vortox_sources.is_empty(),
        });
    }
    for guidance in crate::simulation::sources(facts) {
        if !characters.contains(&guidance.character_id.as_str()) {
            continue;
        }
        let id = format!(
            "day-guidance:{}:{}",
            guidance.character_id,
            serde_json::to_string(&guidance.source).expect("guidance source")
        );
        let vortox = !facts.vortox_sources.is_empty()
            && guidance.source.source_ability_use.character_id != "drunk";
        actions.push(DayAbilityAction {
            id,
            actor_player_id: guidance.source.source_ability_use.owner_player_id.clone(),
            character_id: guidance.character_id,
            ability_use: None,
            simulation_source: Some(guidance.source),
            effective: false,
            impaired: true,
            vortox,
        });
    }
    actions.retain(|a| {
        !facts
            .past_days
            .iter()
            .chain(std::iter::once(day))
            .flat_map(|d| &d.ability_records)
            .any(|r| {
                r.action.id == a.id
                    && (!crate::characters::sects_and_violets::day_repeats_daily(&a.character_id)
                        || r.day == day.day)
            })
            && (!crate::characters::sects_and_violets::day_first_day_only(&a.character_id)
                || facts
                    .day_ability_first_days
                    .iter()
                    .find(|(id, _)| id == &a.id)
                    .is_none_or(|(_, first)| *first == day.day))
    });
    actions.sort_by_key(|a| {
        (
            facts.player(&a.actor_player_id).map(|p| p.seat),
            a.id.clone(),
        )
    });
    actions
}
pub(crate) fn enter(facts: &mut CustomGameFacts, day_number: u32) {
    if let Some(previous) = facts.day.take() {
        facts.past_days.push(previous);
    }
    facts.malfunction_audit.clear();
    facts.day = Some(DayProgress::new(day_number));
    record_first_days(facts);
}
pub(crate) fn enter_after_night(
    context: &ResolvedScriptContext,
    facts: &mut CustomGameFacts,
    day_number: u32,
    event_id: &str,
) {
    enter(facts, day_number);
    let end = facts
        .day
        .as_ref()
        .and_then(|day| common_game_end(context, facts, day, event_id));
    if let Some(day) = &mut facts.day {
        day.pending_game_end = end;
    }
}
fn record_first_days(facts: &mut CustomGameFacts) {
    let Some(day_number) = facts.day.as_ref().map(|d| d.day) else {
        return;
    };
    for action in crate::characters::sects_and_violets::day_actions(facts)
        .into_iter()
        .filter(|a| crate::characters::sects_and_violets::day_first_day_only(&a.character_id))
    {
        if !facts
            .day_ability_first_days
            .iter()
            .any(|(id, _)| id == &action.id)
        {
            facts.day_ability_first_days.push((action.id, day_number));
        }
    }
}
pub(crate) fn pending_death(
    day: &mut DayProgress,
    player_id: &str,
    cause: DayDeathCause,
    source: Option<crate::model::AbilityUseRef>,
    root: &str,
    resume: DayStage,
) -> Result<(), CoreError> {
    if day.pending_death.is_some() {
        return Err(invalid());
    }
    let execution = matches!(
        cause,
        DayDeathCause::Execution | DayDeathCause::Virgin | DayDeathCause::Madness
    );
    if execution {
        day.execution = Some(ExecutionRecord {
            event_id: root.into(),
            player_id: Some(player_id.into()),
            death_event_id: None,
            died: false,
        });
    }
    day.pending_death = Some(PendingDayDeath {
        player_id: player_id.into(),
        cause,
        source,
        root_event_id: root.into(),
        resume_stage: resume,
    });
    day.stage = if execution {
        DayStage::ExecutionDeath
    } else {
        DayStage::Death
    };
    Ok(())
}
fn common_game_end(
    context: &ResolvedScriptContext,
    facts: &CustomGameFacts,
    day: &DayProgress,
    event_id: &str,
) -> Option<crate::contracts::CustomGameEnd> {
    use crate::{
        contracts::{CustomGameEnd, CustomGameEndReason},
        model::{Alignment, CharacterKind},
    };
    if crate::characters::sects_and_violets::day_waits_for_win(day) {
        return None;
    }
    let alive = facts.players.iter().filter(|p| p.alive).count();
    let demon_alive = facts.players.iter().any(|p| {
        p.alive && context.character_kind(&p.actual_character) == Some(CharacterKind::Demon)
    });
    let good_blocked = crate::characters::sects_and_violets::day_good_win_blocked(facts);
    let (winning_alignment, reason) = if !demon_alive && !good_blocked {
        (Alignment::Good, CustomGameEndReason::DemonAbsent)
    } else if alive <= 2 {
        (Alignment::Evil, CustomGameEndReason::TwoLivingPlayers)
    } else {
        return None;
    };
    Some(CustomGameEnd {
        winning_alignment,
        reason,
        source_event_id: event_id.into(),
    })
}

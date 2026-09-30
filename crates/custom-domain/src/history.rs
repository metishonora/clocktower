//! Read-only event-time context. Built during validated replay, never persisted or used by rules.
use crate::{
    contracts::{GameEvent, GameEventKind, RevealPayload},
    day::contracts::{DayConsequence, DayInput, DayMadness, PendingDayDeath},
    model::{IdentityState, Phase, PlayerIdentityTransition},
    state::CustomGameState,
};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct EventHistoryContext {
    pub(crate) event_id: String,
    pub(crate) phase: Phase,
    pub(crate) cycle: u32,
    pub(crate) actor_character_id: Option<String>,
    pub(crate) identity_changes: Vec<PlayerIdentityTransition>,
    pub(crate) system_reveal: Option<RevealPayload>,
    pub(crate) pending_night_death: bool,
    pub(crate) recipient_player_ids: Vec<String>,
    pub(crate) game_end: Option<crate::contracts::CustomGameEnd>,
    pub(crate) nomination: Option<HistoryNomination>,
    pub(crate) execution_player_id: Option<String>,
    pub(crate) death: Option<PendingDayDeath>,
    pub(crate) consequence: Option<DayConsequence>,
    pub(crate) madness: Option<DayMadness>,
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct HistoryNomination {
    nominator_id: String,
    nominee_id: String,
}

pub(crate) fn context(
    event: &GameEvent,
    previous: &CustomGameState,
    next: &CustomGameState,
    scheduled_deaths: bool,
) -> EventHistoryContext {
    let mut row = EventHistoryContext {
        event_id: event.id.clone(),
        phase: event.phase,
        cycle: previous.facts.night_number(),
        actor_character_id: None,
        identity_changes: vec![],
        system_reveal: None,
        pending_night_death: false,
        recipient_player_ids: vec![],
        game_end: next.facts.game_end.clone(),
        nomination: None,
        execution_player_id: None,
        death: None,
        consequence: None,
        madness: None,
    };
    let mut actor = None;
    match &event.kind {
        GameEventKind::SetupConfirmed { .. } => {
            row.cycle = 0;
        }
        GameEventKind::CustomActionConfirmed { payload } => {
            actor = payload
                .ability_use
                .as_ref()
                .map(|a| a.owner_player_id.as_str())
                .or_else(|| {
                    payload
                        .simulation_source
                        .as_ref()
                        .map(|s| s.source_ability_use.owner_player_id.as_str())
                });
            row.pending_night_death = crate::night_deaths::view(&next.facts, scheduled_deaths)
                .is_some_and(|v| v.pending_attack_event_ids.contains(&event.id));
        }
        GameEventKind::PhaseStepConfirmed { payload } => {
            actor = payload
                .ability_use
                .as_ref()
                .map(|a| a.owner_player_id.as_str());
            row.system_reveal = next
                .progress
                .completed_history
                .iter()
                .find(|c| c.event_id == event.id)
                .and_then(|c| c.snapshot.as_ref())
                .and_then(|s| s.reveal_payload.clone());
        }
        GameEventKind::DayConfirmed { payload } => {
            row.cycle = payload.day;
            actor = payload
                .result
                .ability_record
                .as_ref()
                .map(|r| r.action.actor_player_id.as_str());
            if let Some(day) = &previous.facts.day {
                match &payload.input {
                    DayInput::Vote { .. } => {
                        row.nomination = day.nominations.last().map(|n| HistoryNomination {
                            nominator_id: n.nominator_id.clone(),
                            nominee_id: n.nominee_id.clone(),
                        });
                    }
                    DayInput::ConfirmDeath => {
                        row.death = day.pending_death.clone();
                    }
                    DayInput::ResolveConsequence { consequence_id, .. } => {
                        row.consequence = day
                            .consequences
                            .iter()
                            .find(|c| c.id == *consequence_id)
                            .cloned();
                    }
                    DayInput::CheckMadness { assignment_id, .. }
                    | DayInput::ExecuteMadness { assignment_id } => {
                        row.madness = crate::day::view(&previous.facts)
                            .and_then(|d| d.madness.into_iter().find(|m| m.id == *assignment_id));
                    }
                    DayInput::ConfirmExecution { .. } => {
                        row.execution_player_id = next
                            .facts
                            .day
                            .as_ref()
                            .and_then(|d| d.execution.as_ref())
                            .and_then(|e| e.player_id.clone());
                    }
                    _ => {}
                }
            }
        }
    }
    if let Some(reveal) = &row.system_reveal {
        row.recipient_player_ids = previous
            .facts
            .players
            .iter()
            .filter(|p| match reveal {
                RevealPayload::DemonInformation { .. } => {
                    crate::characters::character_kind(&p.actual_character)
                        == Some(crate::model::CharacterKind::Demon)
                }
                RevealPayload::MinionInformation { minion_players, .. } => minion_players
                    .iter()
                    .any(|recipient| recipient.seat == p.seat),
                _ => false,
            })
            .map(|p| p.id.clone())
            .collect();
    }
    row.actor_character_id = actor
        .and_then(|id| previous.facts.player(id))
        .map(|p| p.actual_character.clone());
    if !matches!(event.kind, GameEventKind::SetupConfirmed { .. }) {
        for after in &next.facts.players {
            if let Some(before) = previous.facts.player(&after.id) {
                let identity = |p: &crate::model::Player| IdentityState {
                    actual_character: p.actual_character.clone(),
                    shown_character: p.shown_character.clone(),
                    alignment: p.alignment,
                };
                if identity(before) != identity(after) {
                    row.identity_changes.push(PlayerIdentityTransition {
                        player_id: after.id.clone(),
                        before: identity(before),
                        after: identity(after),
                    });
                }
            }
        }
    }
    row
}

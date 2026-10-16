//! Phase-independent victory conditions, evaluated after atomic character consequences.
use crate::{
    characters::ResolvedScriptContext,
    contracts::{CustomGameEnd, CustomGameEndReason},
    model::{Alignment, CharacterKind},
    state::CustomGameFacts,
};

pub(crate) fn common(
    context: &ResolvedScriptContext,
    facts: &CustomGameFacts,
    event_id: &str,
) -> Option<CustomGameEnd> {
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

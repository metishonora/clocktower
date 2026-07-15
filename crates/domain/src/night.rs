use crate::{
    characters::{
        character_kind, character_steps, first_night_order, legal_demon_bluff_character_ids,
        night_order,
    },
    model::{CharacterKind, Phase, PhaseStep, Player, RequiredInputKind, StepType},
    phase::{phase_prefix, phase_transition_step, required_characters, required_none, simple_step},
};

pub(crate) fn first_night_steps(players: &[Player]) -> Vec<PhaseStep> {
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

    steps.extend(character_steps(
        Phase::FirstNight,
        "firstNight",
        players,
        first_night_order(),
    ));
    steps.push(phase_transition_step(
        Phase::FirstNight,
        "firstNight",
        "toDay",
        RequiredInputKind::Day,
    ));
    steps
}

pub(crate) fn night_steps(players: &[Player], cycle: usize) -> Vec<PhaseStep> {
    let prefix = phase_prefix("night", cycle);
    character_steps(Phase::Night, &prefix, players, night_order())
        .into_iter()
        .chain([phase_transition_step(
            Phase::Night,
            &prefix,
            "toDay",
            RequiredInputKind::Day,
        )])
        .collect()
}

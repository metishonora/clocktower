use crate::{
    error::{CoreError, ErrorKind},
    model::Phase,
};

use super::TbCharacterId;

#[derive(Debug, Copy, Clone, PartialEq, Eq)]
pub(crate) enum TbPhaseKey {
    FirstNight,
    Day { cycle: usize },
    Night { cycle: usize },
}

impl TbPhaseKey {
    pub(crate) const fn phase(self) -> Phase {
        match self {
            Self::FirstNight => Phase::FirstNight,
            Self::Day { .. } => Phase::Day,
            Self::Night { .. } => Phase::Night,
        }
    }

    pub(crate) fn prefix(self) -> String {
        match self {
            Self::FirstNight => "firstNight".into(),
            Self::Day { cycle: 1 } => "day".into(),
            Self::Day { cycle } => format!("day{cycle}"),
            Self::Night { cycle: 1 } => "night".into(),
            Self::Night { cycle } => format!("night{cycle}"),
        }
    }

    pub(crate) const fn cycle(self) -> usize {
        match self {
            Self::FirstNight => 1,
            Self::Day { cycle } | Self::Night { cycle } => cycle,
        }
    }
}

#[derive(Debug, Copy, Clone, PartialEq, Eq)]
pub(crate) enum TbSemanticStep {
    Character(TbCharacterId),
    MinionInfo,
    DemonInfo,
    FortuneTellerRedHerring,
    AnnounceDeaths,
    Whisper,
    Discussion,
    Nomination { sequence: usize },
    NominationVote { sequence: usize },
    Execution,
    ExecutionDeath,
    VirginDeath,
    SlayerDeath,
    ToDay,
    ToNight,
    DemonSuccession,
}

#[derive(Debug, Copy, Clone, PartialEq, Eq)]
pub(crate) struct TbStepKey {
    pub(crate) phase: TbPhaseKey,
    pub(crate) semantic: TbSemanticStep,
}

impl TbStepKey {
    pub(crate) fn parse(value: &str, event_phase: Phase) -> Result<Self, CoreError> {
        if let Some(prefix) = value.strip_suffix(":demonSuccession") {
            if prefix.is_empty() {
                return Err(ErrorKind::ReplayFailed.into_error());
            }
            return Ok(Self {
                phase: phase_from_event(event_phase)?,
                semantic: TbSemanticStep::DemonSuccession,
            });
        }

        let parts = value.split(':').collect::<Vec<_>>();
        let Some(prefix) = parts.first().copied() else {
            return Err(ErrorKind::ReplayFailed.into_error());
        };
        let phase = parse_phase(prefix)?;
        if phase.phase() != event_phase {
            return Err(ErrorKind::ReplayFailed.into_error());
        }
        let semantic = match parts.as_slice() {
            [_, "minionInfo"] => TbSemanticStep::MinionInfo,
            [_, "demonInfo"] => TbSemanticStep::DemonInfo,
            [_, "fortuneTellerRedHerring"] => TbSemanticStep::FortuneTellerRedHerring,
            [_, "announceDeaths"] => TbSemanticStep::AnnounceDeaths,
            [_, "whisper"] => TbSemanticStep::Whisper,
            [_, "discussion"] => TbSemanticStep::Discussion,
            [_, "nomination", sequence] => TbSemanticStep::Nomination {
                sequence: parse_sequence(sequence)?,
            },
            [_, "nominationVote", sequence] | [_, "nomination", sequence, "vote"] => {
                TbSemanticStep::NominationVote {
                    sequence: parse_sequence(sequence)?,
                }
            }
            [_, "execution"] => TbSemanticStep::Execution,
            [_, "executionDeath"] => TbSemanticStep::ExecutionDeath,
            [_, "virginDeath"] | [_, "nomination", _, "virginDeath"] => TbSemanticStep::VirginDeath,
            [_, "discussion", "slayerDeath"] => TbSemanticStep::SlayerDeath,
            [_, "toDay"] => TbSemanticStep::ToDay,
            [_, "toNight"] => TbSemanticStep::ToNight,
            [_, character, actor_id] if valid_actor_suffix(actor_id) => {
                TbCharacterId::parse(character)
                    .map(TbSemanticStep::Character)
                    .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?
            }
            [_, character] => TbCharacterId::parse(character)
                .map(TbSemanticStep::Character)
                .ok_or_else(|| ErrorKind::ReplayFailed.into_error())?,
            _ => return Err(ErrorKind::ReplayFailed.into_error()),
        };
        Ok(Self { phase, semantic })
    }
}

fn parse_phase(value: &str) -> Result<TbPhaseKey, CoreError> {
    if value == "firstNight" {
        return Ok(TbPhaseKey::FirstNight);
    }
    if value == "day" {
        return Ok(TbPhaseKey::Day { cycle: 1 });
    }
    if value == "night" {
        return Ok(TbPhaseKey::Night { cycle: 1 });
    }
    if let Some(cycle) = value.strip_prefix("day") {
        return Ok(TbPhaseKey::Day {
            cycle: parse_sequence(cycle)?,
        });
    }
    if let Some(cycle) = value.strip_prefix("night") {
        return Ok(TbPhaseKey::Night {
            cycle: parse_sequence(cycle)?,
        });
    }
    Err(ErrorKind::ReplayFailed.into_error())
}

fn phase_from_event(phase: Phase) -> Result<TbPhaseKey, CoreError> {
    match phase {
        Phase::FirstNight => Ok(TbPhaseKey::FirstNight),
        Phase::Day => Ok(TbPhaseKey::Day { cycle: 1 }),
        Phase::Night => Ok(TbPhaseKey::Night { cycle: 1 }),
        Phase::Setup => Err(ErrorKind::ReplayFailed.into_error()),
    }
}

fn parse_sequence(value: &str) -> Result<usize, CoreError> {
    value
        .parse::<usize>()
        .ok()
        .filter(|value| *value > 0)
        .ok_or_else(|| ErrorKind::ReplayFailed.into_error())
}

fn valid_actor_suffix(value: &str) -> bool {
    !value.is_empty()
        && !matches!(
            value,
            "minionInfo"
                | "demonInfo"
                | "fortuneTellerRedHerring"
                | "announceDeaths"
                | "whisper"
                | "discussion"
                | "nomination"
                | "nominationVote"
                | "vote"
                | "execution"
                | "executionDeath"
                | "virginDeath"
                | "slayerDeath"
                | "toDay"
                | "toNight"
                | "demonSuccession"
        )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_stable_and_legacy_tb_step_shapes_once_at_the_boundary() {
        let cases = [
            (
                "firstNight:poisoner",
                Phase::FirstNight,
                TbPhaseKey::FirstNight,
                TbSemanticStep::Character(TbCharacterId::Poisoner),
            ),
            (
                "day:nomination:1",
                Phase::Day,
                TbPhaseKey::Day { cycle: 1 },
                TbSemanticStep::Nomination { sequence: 1 },
            ),
            (
                "day6:executionDeath",
                Phase::Day,
                TbPhaseKey::Day { cycle: 6 },
                TbSemanticStep::ExecutionDeath,
            ),
            (
                "night3:fortuneTeller",
                Phase::Night,
                TbPhaseKey::Night { cycle: 3 },
                TbSemanticStep::Character(TbCharacterId::FortuneTeller),
            ),
            (
                "firstNight:washerwoman:player-2",
                Phase::FirstNight,
                TbPhaseKey::FirstNight,
                TbSemanticStep::Character(TbCharacterId::Washerwoman),
            ),
            (
                "day:discussion:slayerDeath",
                Phase::Day,
                TbPhaseKey::Day { cycle: 1 },
                TbSemanticStep::SlayerDeath,
            ),
        ];
        for (raw, event_phase, phase, semantic) in cases {
            assert_eq!(
                TbStepKey::parse(raw, event_phase).expect("valid TB step key"),
                TbStepKey { phase, semantic }
            );
        }
    }

    #[test]
    fn rejects_unknown_or_phase_mismatched_step_ids() {
        for (raw, phase) in [
            ("night0:imp", Phase::Night),
            ("night:unknown", Phase::Night),
            ("day:discussion", Phase::Night),
            ("night:washerwoman:", Phase::Night),
            ("night:washerwoman:player-1:extra", Phase::Night),
            ("night:washerwoman:toDay", Phase::Night),
        ] {
            assert!(TbStepKey::parse(raw, phase).is_err(), "accepted {raw}");
        }
    }
}

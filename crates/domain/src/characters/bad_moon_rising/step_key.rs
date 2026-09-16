#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum PhaseKey {
    FirstNight,
    Day(usize),
    Night(usize),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum SemanticStep<'a> {
    ToDay,
    ToNight,
    MinionInfo,
    DemonInfo,
    ManualDay,
    Character {
        kind: &'a str,
        actor_id: Option<&'a str>,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct StepKey<'a> {
    phase: PhaseKey,
    phase_token: &'a str,
    segments: Vec<&'a str>,
}

impl<'a> StepKey<'a> {
    pub(super) fn parse(raw: &'a str) -> Option<Self> {
        let mut parts = raw.split(':');
        let phase_token = parts.next()?;
        let phase = parse_phase(phase_token)?;
        let segments = parts.collect::<Vec<_>>();
        if segments.is_empty()
            || segments.len() > 2
            || segments.iter().any(|segment| segment.is_empty())
        {
            return None;
        }
        Some(Self {
            phase,
            phase_token,
            segments,
        })
    }

    pub(super) fn phase(&self) -> PhaseKey {
        self.phase
    }

    pub(super) fn phase_token(&self) -> &'a str {
        self.phase_token
    }

    pub(super) fn semantic_step(&self) -> SemanticStep<'a> {
        match self.segments[0] {
            "toDay" => SemanticStep::ToDay,
            "toNight" => SemanticStep::ToNight,
            "minionInfo" => SemanticStep::MinionInfo,
            "demonInfo" => SemanticStep::DemonInfo,
            "manual" => SemanticStep::ManualDay,
            kind => SemanticStep::Character {
                kind,
                actor_id: self.segments.get(1).copied(),
            },
        }
    }
}

fn parse_phase(value: &str) -> Option<PhaseKey> {
    if value == "firstNight" {
        return Some(PhaseKey::FirstNight);
    }
    parse_cycle(value, "day")
        .map(PhaseKey::Day)
        .or_else(|| parse_cycle(value, "night").map(PhaseKey::Night))
}

fn parse_cycle(value: &str, prefix: &str) -> Option<usize> {
    let suffix = value.strip_prefix(prefix)?;
    if suffix.is_empty() {
        return Some(1);
    }
    let cycle = suffix.parse::<usize>().ok()?;
    (cycle > 0).then_some(cycle)
}

#[cfg(test)]
mod tests {
    use super::{PhaseKey, SemanticStep, StepKey};

    #[test]
    fn parses_bmr_phase_cycles_and_typed_semantics() {
        let shabaloth = StepKey::parse("night2:shabalothAttack:player-4").unwrap();
        assert_eq!(shabaloth.phase(), PhaseKey::Night(2));
        assert_eq!(shabaloth.phase_token(), "night2");
        assert_eq!(
            shabaloth.semantic_step(),
            SemanticStep::Character {
                kind: "shabalothAttack",
                actor_id: Some("player-4")
            }
        );
        assert_eq!(
            StepKey::parse("firstNight:minionInfo")
                .unwrap()
                .semantic_step(),
            SemanticStep::MinionInfo
        );
    }

    #[test]
    fn rejects_unknown_phases_and_ambiguous_shapes() {
        assert!(StepKey::parse("later:sailor").is_none());
        assert!(StepKey::parse("night::sailor").is_none());
        assert!(StepKey::parse("night:sailor:player-1:extra").is_none());
    }
}

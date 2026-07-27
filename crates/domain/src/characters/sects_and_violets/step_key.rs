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
    Nomination { ordinal: usize },
    Demon { actor_id: Option<&'a str> },
    PitHag { actor_id: Option<&'a str> },
    SnakeCharmer { actor_id: Option<&'a str> },
    Other { kind: &'a str },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct StepKey<'a> {
    raw: &'a str,
    phase_token: &'a str,
    phase: PhaseKey,
    segments: Vec<&'a str>,
}

impl<'a> StepKey<'a> {
    pub(super) fn parse(raw: &'a str) -> Option<Self> {
        let mut parts = raw.split(':');
        let phase_token = parts.next()?;
        let phase = parse_phase(phase_token)?;
        let segments = parts.collect::<Vec<_>>();
        if segments.is_empty() || segments.iter().any(|segment| segment.is_empty()) {
            return None;
        }
        Some(Self {
            raw,
            phase_token,
            phase,
            segments,
        })
    }

    pub(super) fn phase(&self) -> PhaseKey {
        self.phase
    }

    pub(super) fn phase_token(&self) -> &'a str {
        self.phase_token
    }

    pub(super) fn is_in_phase(&self, phase_token: &str) -> bool {
        self.phase_token == phase_token
    }

    pub(super) fn tail(&self) -> &'a str {
        self.segments.last().copied().unwrap_or(self.raw)
    }

    pub(super) fn semantic_step(&self) -> SemanticStep<'a> {
        if self.tail() == "toDay" {
            return SemanticStep::ToDay;
        }
        if self.tail() == "toNight" {
            return SemanticStep::ToNight;
        }
        if let Some(index) = self
            .segments
            .iter()
            .position(|segment| *segment == "nomination")
        {
            let ordinal = self
                .segments
                .get(index + 1)
                .and_then(|value| value.parse().ok())
                .unwrap_or_default();
            return SemanticStep::Nomination { ordinal };
        }
        if let Some(index) = self.segments.iter().position(|segment| *segment == "demon") {
            return SemanticStep::Demon {
                actor_id: self.segments.get(index + 1).copied(),
            };
        }
        if let Some(index) = self
            .segments
            .iter()
            .position(|segment| *segment == "pitHag")
        {
            return SemanticStep::PitHag {
                actor_id: self
                    .segments
                    .get(index + 1)
                    .or_else(|| {
                        index
                            .checked_sub(1)
                            .and_then(|index| self.segments.get(index))
                    })
                    .copied(),
            };
        }
        if let Some(index) = self
            .segments
            .iter()
            .position(|segment| *segment == "snakeCharmer")
        {
            return SemanticStep::SnakeCharmer {
                actor_id: self
                    .segments
                    .get(index + 1)
                    .or_else(|| {
                        index
                            .checked_sub(1)
                            .and_then(|index| self.segments.get(index))
                    })
                    .copied(),
            };
        }
        SemanticStep::Other { kind: self.tail() }
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
    fn parses_phase_cycle_semantic_kind_and_actor_without_string_shape_checks() {
        let key = StepKey::parse("night4:pitHag:player-2").expect("typed step");
        assert_eq!(key.phase(), PhaseKey::Night(4));
        assert_eq!(
            key.semantic_step(),
            SemanticStep::PitHag {
                actor_id: Some("player-2")
            }
        );
        assert!(key.is_in_phase("night4"));
    }

    #[test]
    fn rejects_unknown_phases_and_empty_segments_at_the_parser_seam() {
        assert!(StepKey::parse("later:pitHag:player-2").is_none());
        assert!(StepKey::parse("night2::player-2").is_none());
    }
}

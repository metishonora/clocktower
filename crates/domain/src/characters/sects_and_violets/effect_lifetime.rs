//! Official SnV's replay-derived bindings. These are not persisted and do not
//! depend on the custom runtime. An event's cause is not necessarily its owner.
use super::*;

#[derive(Clone)]
pub(super) enum Binding {
    DeathAbility(AbilityUseRef),
    ResultingIdentity(AbilityUseRef),
}
#[derive(Clone, Copy, PartialEq, Eq)]
pub(super) enum Status {
    Active,
    Suspended,
    Ended,
}
#[derive(Clone)]
pub(super) struct Effect {
    pub(super) impairment: ActiveImpairment,
    binding: Binding,
}
impl Effect {
    pub(super) fn status(
        &self,
        players: &[Player],
        events: &[GameEvent],
        impairments: &[ActiveImpairment],
    ) -> Status {
        let source = match &self.binding {
            Binding::DeathAbility(s) | Binding::ResultingIdentity(s) => s,
        };
        let owned = match &self.binding {
            Binding::DeathAbility(_) => {
                ability_actors_for_character(players, events, &source.character_id)
                    .iter()
                    .any(|a| a.ability == *source)
            }
            Binding::ResultingIdentity(_) => players.iter().any(|p| {
                p.id == source.owner_player_id
                    && p.ability_instance.id == source.ability_instance_id
                    && p.actual_character == source.character_id
                    && p.alive
            }),
        };
        if !owned {
            return Status::Ended;
        }
        // Both rules intentionally maintain a self-inflicted impairment. Other
        // contributions still disable their owner, including an acquired ability.
        if impairments
            .iter()
            .any(|i| i != &self.impairment && i.player_id == source.owner_player_id)
        {
            Status::Suspended
        } else {
            Status::Active
        }
    }
}
pub(super) fn candidates(events: &[GameEvent]) -> Vec<Effect> {
    events
        .iter()
        .filter_map(|event| match &event.kind {
            GameEventKind::SnakeCharmerActionResolved { payload } => match &payload.outcome {
                SnakeCharmerActionOutcome::Swap {
                    impairment,
                    identity_transitions,
                } => {
                    let resulting = identity_transitions
                        .iter()
                        .find(|t| t.player_id == impairment.player_id)?;
                    Some(Effect {
                        impairment: impairment.clone(),
                        binding: Binding::ResultingIdentity(AbilityUseRef {
                            owner_player_id: resulting.player_id.clone(),
                            character_id: resulting.after.actual_character.clone(),
                            ability_instance_id: AbilityInstanceId::new(
                                &event.id,
                                &resulting.player_id,
                            ),
                        }),
                    })
                }
                _ => None,
            },
            GameEventKind::SweetheartConsequenceResolved { payload } => match &payload.outcome {
                SweetheartConsequenceOutcome::DrunkApplied { impairment } => Some(Effect {
                    impairment: impairment.clone(),
                    binding: Binding::DeathAbility(AbilityUseRef {
                        owner_player_id: payload.trigger.player_id.clone(),
                        character_id: "sweetheart".into(),
                        ability_instance_id: payload.trigger.source_ability_instance_id.clone(),
                    }),
                }),
                _ => None,
            },
            _ => None,
        })
        .collect()
}

/// The legacy madness event has no serialized ability reference. Reconstruct
/// ownership from the acquisition event boundary, never from a matching name.
pub(super) fn owned_at_assignment(
    player: &Player,
    assignment: &GameEvent,
    events: &[GameEvent],
) -> bool {
    player.ability_instance.source_event_id == "setup"
        || events
            .iter()
            .position(|e| e.id == player.ability_instance.source_event_id)
            .zip(events.iter().position(|e| e.id == assignment.id))
            .is_some_and(|(acquired, assigned)| acquired < assigned)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn death_binding_suspends_recovers_and_ends_on_exact_identity_loss() {
        let input: crate::contracts::SetupPlayerInput = serde_json::from_value(json!({
            "id":"sweet", "seat":1, "name":"Sweet", "actualCharacter":"sweetheart", "shownCharacter":"sweetheart"
        })).unwrap();
        let mut player =
            player_from_setup_input_for_script(crate::contracts::ScriptId::SectsAndViolets, &input)
                .unwrap();
        player.alive = false;
        let effect = Effect {
            impairment: ActiveImpairment {
                kind: ImpairmentKind::Drunk,
                player_id: "target".into(),
                source_event_id: "death".into(),
                source_character_id: "sweetheart".into(),
                expires: ImpairmentExpiry::Never,
            },
            binding: Binding::DeathAbility(identity_bound_ability_actor(&player).ability),
        };
        let poison = ActiveImpairment {
            kind: ImpairmentKind::Poisoned,
            player_id: "sweet".into(),
            source_event_id: "other".into(),
            source_character_id: "noDashii".into(),
            expires: ImpairmentExpiry::WhileSourceAbilityActive,
        };
        assert!(effect.status(&[player.clone()], &[], &[]) == Status::Active);
        assert!(effect.status(&[player.clone()], &[], &[poison]) == Status::Suspended);
        assert!(effect.status(&[player.clone()], &[], &[]) == Status::Active);
        player.ability_instance.id = AbilityInstanceId::new("reacquired", "sweet");
        assert!(effect.status(&[player], &[], &[]) == Status::Ended);
    }
}

/// Cerenovus may execute during the following day OR night. Do not expire an
/// assignment at dusk, or carry it into a second day if no new assignment exists.
pub(super) fn within_assignment_window(assigned: &str, current: &str) -> bool {
    let Some(assigned) = SnvStepKey::parse(assigned) else {
        return false;
    };
    let Some(current) = SnvStepKey::parse(current) else {
        return false;
    };
    let start = match assigned.phase() {
        SnvPhaseKey::FirstNight => 0,
        SnvPhaseKey::Night(n) => n,
        SnvPhaseKey::Day(_) => return false,
    };
    let now = match current.phase() {
        SnvPhaseKey::FirstNight => 0,
        SnvPhaseKey::Day(n) | SnvPhaseKey::Night(n) => n,
    };
    now >= start && now <= start + 1
}

#[cfg(test)]
mod window_tests {
    use super::within_assignment_window;
    #[test]
    fn cerenovus_window_includes_following_night_but_not_another_day() {
        for (assigned, valid, expired) in [
            (
                "firstNight:cerenovus:p1",
                vec!["firstNight:toDay", "day:nomination", "night:pitHag:p2"],
                "day2:nomination",
            ),
            (
                "night:cerenovus:p1",
                vec!["night:toDay", "day2:nomination", "night2:pitHag:p2"],
                "day3:nomination",
            ),
        ] {
            for step in valid {
                assert!(within_assignment_window(assigned, step));
            }
            assert!(!within_assignment_window(assigned, expired));
        }
    }
}

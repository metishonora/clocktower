use crate::model::CharacterKind;
pub(super) fn custom_registry_entries() -> Vec<(&'static str, CharacterKind)> {
    vec![
        ("clockmaker", CharacterKind::Townsfolk),
        ("dreamer", CharacterKind::Townsfolk),
        ("snakeCharmer", CharacterKind::Townsfolk),
        ("mathematician", CharacterKind::Townsfolk),
        ("flowergirl", CharacterKind::Townsfolk),
        ("townCrier", CharacterKind::Townsfolk),
        ("oracle", CharacterKind::Townsfolk),
        ("savant", CharacterKind::Townsfolk),
        ("seamstress", CharacterKind::Townsfolk),
        ("philosopher", CharacterKind::Townsfolk),
        ("artist", CharacterKind::Townsfolk),
        ("juggler", CharacterKind::Townsfolk),
        ("sage", CharacterKind::Townsfolk),
        ("mutant", CharacterKind::Outsider),
        ("sweetheart", CharacterKind::Outsider),
        ("barber", CharacterKind::Outsider),
        ("klutz", CharacterKind::Outsider),
        ("evilTwin", CharacterKind::Minion),
        ("witch", CharacterKind::Minion),
        ("cerenovus", CharacterKind::Minion),
        ("pitHag", CharacterKind::Minion),
        ("fangGu", CharacterKind::Demon),
        ("vigormortis", CharacterKind::Demon),
        ("noDashii", CharacterKind::Demon),
        ("vortox", CharacterKind::Demon),
    ]
}
pub(super) fn custom_setup_outsider_delta(character_id: &str) -> i8 {
    match character_id {
        "fangGu" => 1,
        "vigormortis" => -1,
        _ => 0,
    }
}

/// Failed-choice participation references the real source and exists only while impairment lasts.
pub(crate) fn simulation_occurrences(
    facts: &crate::state::CustomGameFacts,
    action_ref: &crate::contracts::FirstNightActionRef,
) -> Result<Vec<crate::state::ActionOccurrence>, crate::error::CoreError> {
    use crate::contracts::{
        FirstNightActionRef, PhilosopherChoiceOutcome, PhilosopherSimulationSource,
    };
    let FirstNightActionRef::Character { character_id, .. } = action_ref else {
        return Ok(vec![]);
    };
    let mut choices = facts
        .philosopher_choices
        .iter()
        .filter(|choice| {
            choice.outcome == PhilosopherChoiceOutcome::Failed
                && choice.character_id != "philosopher"
                && choice.character_id == *character_id
                && crate::reducer::current_ability_instance(facts, &choice.ability_use)
                && facts
                    .player(&choice.ability_use.owner_player_id)
                    .is_some_and(|p| p.alive)
                && facts
                    .active_impairments
                    .iter()
                    .any(|i| i.player_id == choice.ability_use.owner_player_id)
        })
        .collect::<Vec<_>>();
    // Stable sort retains confirmation order for the same owner.
    choices.sort_by_key(|choice| {
        facts
            .player(&choice.ability_use.owner_player_id)
            .map(|p| (p.seat, p.id.clone()))
    });
    choices
        .into_iter()
        .map(|choice| {
            crate::state::ActionOccurrence::from_parts(
                action_ref.clone(),
                None,
                Some(PhilosopherSimulationSource {
                    selection_event_id: choice.source_event_id.clone(),
                    source_ability_use: choice.ability_use.clone(),
                }),
                None,
            )
        })
        .collect()
}

use crate::{
    characters::{custom_ability_acquisition_character_ids, ResolvedScriptContext},
    contracts::{
        AbilityUseRecord, ActiveImpairment, CustomActionResult, FirstNightActionRef, FollowUpCause,
        ImpairmentExpiry, ImpairmentKind, MadnessAssignment, PhilosopherChoiceFact,
        PhilosopherChoiceOutcome, SnakeCharmerOutcome, TwinRelationship, WitchCurse,
    },
    error::{CoreError, ErrorKind},
    event::{AbilityGrantChange, CustomActionEventDraft, CustomFactChanges, SnvFactChanges},
    first_night::{
        ActionContext, ActionEventDraft, ActionHandler, ActionInput, ActionSpec, ActivationContext,
        ActivationDecision, ActivationRule, RegisteredAction,
    },
    model::{
        AbilityOrigin, AbilityUseRef, IdentityState, InputTarget, Phase, PhaseStep,
        PhaseStepSupport, Player, PlayerIdentityTransition, RequiredInputKind, StepInput,
        StepInputFields, StepType,
    },
    reducer::{current_ability_instance, recorded_ability},
    state::{
        ActionOccurrence, CustomGameFacts, DurableImpairment, FailedEffect, MalfunctionEvidence,
        MalfunctionOutcome,
    },
};

fn invalid() -> CoreError {
    ErrorKind::InvalidStepInput.into_error()
}
fn provenance_error() -> CoreError {
    ErrorKind::InvalidFirstNightActionProvenance.into_error()
}
fn action(character: &str, id: &str) -> FirstNightActionRef {
    FirstNightActionRef::Character {
        character_id: character.into(),
        action_id: id.into(),
    }
}
fn identity(player: &Player) -> IdentityState {
    IdentityState {
        actual_character: player.actual_character.clone(),
        shown_character: player.shown_character.clone(),
        alignment: player.alignment,
    }
}
fn player_source(player: &Player) -> AbilityUseRef {
    AbilityUseRef {
        owner_player_id: player.id.clone(),
        character_id: player.actual_character.clone(),
        ability_instance_id: player.ability_instance.id.clone(),
    }
}
pub(crate) fn impaired(facts: &CustomGameFacts, player_id: &str) -> bool {
    facts
        .active_impairments
        .iter()
        .any(|effect| effect.player_id == player_id)
}
pub(crate) fn effective(facts: &CustomGameFacts, source: &AbilityUseRef) -> bool {
    current_ability_instance(facts, source)
        && facts
            .player(&source.owner_player_id)
            .is_some_and(|p| p.alive)
        && !impaired(facts, &source.owner_player_id)
}

/// Rebuild only derived effects, retaining independent fixture/other durable impairment facts.
/// No Dashii checks current Townsfolk identity, including dead neighbours (official almanac).
pub(crate) fn resolve_effects(
    context: &ResolvedScriptContext,
    facts: &mut CustomGameFacts,
) -> Result<(), CoreError> {
    let previous_effects = std::mem::take(&mut facts.resolved_impairments);
    facts.active_impairments.retain(|impairment| {
        !previous_effects
            .iter()
            .any(|old| old.impairment == *impairment)
    });
    let lost_choices = facts
        .philosopher_choices
        .iter()
        .filter(|choice| !current_ability_instance(facts, &choice.ability_use))
        .map(|choice| choice.source_event_id.clone())
        .collect::<Vec<_>>();
    facts
        .ability_grants
        .retain(|grant| !lost_choices.contains(&grant.source_event_id));
    let mut effects = facts.durable_impairments.clone();
    for effect in &effects {
        if !facts.active_impairments.contains(&effect.impairment) {
            facts.active_impairments.push(effect.impairment.clone());
        }
    }
    let mut players = facts.players.clone();
    players.sort_by_key(|p| p.seat);
    for (index, player) in players.iter().enumerate() {
        if player.actual_character != "noDashii" || !effective(facts, &player_source(player)) {
            continue;
        }
        for clockwise in [true, false] {
            let target = (1..players.len())
                .map(|distance| {
                    if clockwise {
                        (index + distance) % players.len()
                    } else {
                        (index + players.len() - distance) % players.len()
                    }
                })
                .map(|i| &players[i])
                .find(|p| {
                    context.character_kind(&p.actual_character) == Some(CharacterKind::Townsfolk)
                });
            if let Some(target) = target {
                let effect = DurableImpairment {
                    source_ability_use: player_source(player),
                    impairment: ActiveImpairment {
                        kind: ImpairmentKind::Poisoned,
                        player_id: target.id.clone(),
                        source_event_id: player.ability_instance.source_event_id.clone(),
                        source_character_id: "noDashii".into(),
                        expires: ImpairmentExpiry::WhileSourceAbilityActive,
                    },
                };
                if !effects.contains(&effect) {
                    facts.active_impairments.push(effect.impairment.clone());
                    effects.push(effect);
                }
            }
        }
    }
    for choice in facts.philosopher_choices.clone() {
        if choice.outcome == PhilosopherChoiceOutcome::Failed
            || !effective(facts, &choice.ability_use)
        {
            continue;
        }
        let targets = if choice.outcome == PhilosopherChoiceOutcome::SelfDrunk {
            vec![choice.ability_use.owner_player_id.clone()]
        } else {
            facts
                .players
                .iter()
                .filter(|p| p.actual_character == choice.character_id)
                .map(|p| p.id.clone())
                .collect()
        };
        for target in targets {
            let effect = DurableImpairment {
                source_ability_use: choice.ability_use.clone(),
                impairment: ActiveImpairment {
                    kind: ImpairmentKind::Drunk,
                    player_id: target,
                    source_event_id: choice.source_event_id.clone(),
                    source_character_id: "philosopher".into(),
                    expires: ImpairmentExpiry::WhileSourceAbilityActive,
                },
            };
            facts.active_impairments.push(effect.impairment.clone());
            effects.push(effect);
        }
    }
    facts.resolved_impairments = effects;
    let curses = facts
        .witch_curses
        .iter()
        .map(|r| {
            r.initially_effective
                && effective(facts, &r.ability_use)
                && facts.players.iter().filter(|p| p.alive).count() > 3
        })
        .collect::<Vec<_>>();
    for (r, active) in facts.witch_curses.iter_mut().zip(curses) {
        r.effective = active;
    }
    let madness = facts
        .madness_assignments
        .iter()
        .map(|r| r.initially_effective && effective(facts, &r.ability_use))
        .collect::<Vec<_>>();
    for (r, active) in facts.madness_assignments.iter_mut().zip(madness) {
        r.effective = active;
    }
    let twins = facts
        .twin_relationships
        .iter()
        .enumerate()
        .map(|(i, r)| {
            effective(facts, &r.ability_use)
                && !facts.twin_relationships[i + 1..]
                    .iter()
                    .any(|later| later.ability_use == r.ability_use)
        })
        .collect::<Vec<_>>();
    for (r, active) in facts.twin_relationships.iter_mut().zip(twins) {
        r.effective = active;
    }

    facts.vortox_sources = facts
        .players
        .iter()
        .filter(|p| p.actual_character == "vortox")
        .map(player_source)
        .filter(|source| effective(facts, source))
        .collect();
    Ok(())
}

pub(crate) fn impairment_causes(facts: &CustomGameFacts, player_id: &str) -> Vec<AbilityUseRef> {
    let mut sources = vec![];
    for effect in facts
        .resolved_impairments
        .iter()
        .filter(|effect| effect.impairment.player_id == player_id)
    {
        if !sources.contains(&effect.source_ability_use) {
            sources.push(effect.source_ability_use.clone());
        }
    }
    sources
}

pub(crate) struct SnvActivation;
impl ActivationRule for SnvActivation {
    fn decide(&self, context: &ActivationContext<'_>) -> Result<ActivationDecision, CoreError> {
        let FirstNightActionRef::Character { character_id, .. } = context.action_ref else {
            return Err(provenance_error());
        };
        if character_id == "snakeCharmer"
            && matches!(context.event, crate::first_night::ValidatedActionEvent::Custom(event) if matches!(event.payload().result, CustomActionResult::SnakeCharmer { outcome: SnakeCharmerOutcome::Swapped, .. }))
            && context
                .occurrence
                .ability_use
                .as_ref()
                .is_some_and(|source| {
                    context
                        .next_facts
                        .player(&source.owner_player_id)
                        .is_some_and(|player| {
                            player.ability_instance.source_event_id == context.event.event_id()
                        })
                })
        {
            return Ok(ActivationDecision::NoAction);
        }
        if character_id == "clockmaker" {
            return Ok(ActivationDecision::RunImmediately);
        }
        Ok(if context.entry_index >= context.cursor {
            ActivationDecision::JoinPendingOrder
        } else {
            ActivationDecision::Defer
        })
    }
}

pub(crate) fn registrations() -> Vec<RegisteredAction> {
    [
        (
            "philosopher",
            "chooseAbility",
            RequiredInputKind::CharacterIds,
        ),
        ("snakeCharmer", "choosePlayer", RequiredInputKind::PlayerIds),
        ("evilTwin", "learnTwin", RequiredInputKind::PlayerIds),
        ("witch", "chooseCursedPlayer", RequiredInputKind::PlayerIds),
        (
            "cerenovus",
            "assignMadness",
            RequiredInputKind::MadnessAssignment,
        ),
    ]
    .into_iter()
    .map(|(character, id, kind)| {
        let action_ref = action(character, id);
        RegisteredAction {
            spec: ActionSpec {
                action_ref: action_ref.clone(),
                participates_in_first_night: true,
                required_input_kind: kind,
                support: PhaseStepSupport::Automated,
            },
            handler: Box::new(SnvHandler { action_ref }),
        }
    })
    .collect()
}
struct SnvHandler {
    action_ref: FirstNightActionRef,
}
impl SnvHandler {
    fn character(&self) -> &str {
        match &self.action_ref {
            FirstNightActionRef::Character { character_id, .. } => character_id,
            _ => unreachable!(),
        }
    }
    fn eligible(
        &self,
        context: &ActionContext<'_>,
        occurrence: &ActionOccurrence,
    ) -> Result<bool, CoreError> {
        let facts = context.rule_service.facts().ok_or_else(provenance_error)?;
        if occurrence.action_ref != self.action_ref {
            return Ok(false);
        }
        if !occurrence
            .actor_player_id()
            .and_then(|id| facts.player(id))
            .is_some_and(|player| player.alive)
        {
            return Ok(false);
        }
        if occurrence.simulation_source.is_some() {
            return Ok(simulation_occurrences(facts, &self.action_ref)?.contains(occurrence));
        }
        let source = occurrence
            .ability_use
            .as_ref()
            .ok_or_else(provenance_error)?;
        if let Some(cause) = &occurrence.follow_up_cause {
            return Ok(self.character() == "evilTwin"
                && twin_needs_repair(facts, source)
                && facts
                    .twin_relationships
                    .iter()
                    .rev()
                    .find(|r| r.ability_use == *source)
                    .is_some_and(|r| r.source_event_id == cause.relationship_event_id)
                && facts
                    .confirmed_actions
                    .iter()
                    .any(|e| e.event_id == cause.trigger_event_id));
        }
        Ok(current_ability_instance(facts, source)
            && !(self.character() == "philosopher"
                && facts
                    .ability_uses
                    .iter()
                    .any(|used| used.ability_use == *source)))
    }
    fn step(
        &self,
        context: &ActionContext<'_>,
        occurrence: &ActionOccurrence,
    ) -> Result<PhaseStep, CoreError> {
        let definition = context
            .rule_service
            .definition()
            .ok_or_else(provenance_error)?;
        let facts = context.rule_service.facts().ok_or_else(provenance_error)?;
        let mut input = crate::input::required_none();
        if self.character() == "philosopher" {
            input = crate::input::required_characters(
                1,
                1,
                Some(custom_ability_acquisition_character_ids(definition)),
                false,
            );
            input.optional = true;
        } else {
            input.kind = RequiredInputKind::PlayerIds;
            input.target = Some(InputTarget::Player);
            input.min_selections = Some(1);
            input.max_selections = Some(1);
            input.allowed_player_ids = Some(
                facts
                    .players
                    .iter()
                    .filter(|p| self.character() != "snakeCharmer" || p.alive)
                    .filter(|p| {
                        self.character() != "evilTwin"
                            || facts
                                .player(occurrence.actor_player_id().unwrap_or(""))
                                .is_some_and(|a| a.alignment != p.alignment)
                    })
                    .map(|p| p.id.clone())
                    .collect(),
            );
        }
        if self.character() == "cerenovus" {
            input.kind = RequiredInputKind::MadnessAssignment;
            input.allowed_character_ids =
                Some(custom_ability_acquisition_character_ids(definition));
        }
        let origin = occurrence
            .ability_use
            .as_ref()
            .map(|source| {
                recorded_ability(facts, source)
                    .map(|record| record.origin.clone())
                    .ok_or_else(provenance_error)
            })
            .transpose()?;
        Ok(PhaseStep {
            id: occurrence.step_id()?,
            phase: Phase::FirstNight,
            step_type: StepType::Character,
            character: Some(self.character().into()),
            player_id: occurrence.actor_player_id().map(str::to_owned),
            ability_use: occurrence.ability_use.clone(),
            ability_origin: origin,
            simulation_source: occurrence.simulation_source.clone(),
            follow_up_cause: occurrence.follow_up_cause.clone(),
            required_input: input,
            can_skip: false,
            support: PhaseStepSupport::Automated,
            information_prompt: None,
            pre_action_reveal: None,
            action_ref: Some(self.action_ref.clone()),
        })
    }
    fn resolve(
        &self,
        context: &ActionContext<'_>,
        occurrence: &ActionOccurrence,
        input: &ActionInput,
        event_id: &str,
    ) -> Result<(CustomActionResult, CustomFactChanges), CoreError> {
        if event_id.trim().is_empty() || !self.eligible(context, occurrence)? {
            return Err(provenance_error());
        }
        if input.delivered_result.is_some() || !input.registration_judgments.is_empty() {
            return Err(ErrorKind::UnexpectedDeliveredInformation.into_error());
        }
        let facts = context.rule_service.facts().ok_or_else(provenance_error)?;
        let definition = context
            .rule_service
            .definition()
            .ok_or_else(provenance_error)?;
        let actor = facts
            .player(occurrence.actor_player_id().ok_or_else(provenance_error)?)
            .ok_or_else(provenance_error)?;
        let mut changes = SnvFactChanges::default();
        match self.character() {
            "philosopher" => {
                let Some(fields) = &input.input else {
                    return Ok((
                        CustomActionResult::PhilosopherDeferred,
                        CustomFactChanges::default(),
                    ));
                };
                let choices = fields.character_ids.as_ref().ok_or_else(invalid)?;
                if choices.len() != 1
                    || *fields
                        != (StepInputFields {
                            character_ids: Some(choices.clone()),
                            ..Default::default()
                        })
                    || !custom_ability_acquisition_character_ids(definition).contains(&choices[0])
                {
                    return Err(invalid());
                }
                let source = occurrence
                    .ability_use
                    .clone()
                    .ok_or_else(provenance_error)?;
                let outcome = if impaired(facts, &actor.id) {
                    PhilosopherChoiceOutcome::Failed
                } else if choices[0] == "philosopher" {
                    PhilosopherChoiceOutcome::SelfDrunk
                } else {
                    PhilosopherChoiceOutcome::Acquired
                };
                changes.spent = Some(AbilityUseRecord {
                    source_event_id: event_id.into(),
                    ability_use: source.clone(),
                });
                changes.philosopher_choice = Some(PhilosopherChoiceFact {
                    source_event_id: event_id.into(),
                    ability_use: source.clone(),
                    character_id: choices[0].clone(),
                    outcome,
                });
                if outcome == PhilosopherChoiceOutcome::Failed {
                    let causes = impairment_causes(facts, &actor.id);
                    if !causes.is_empty() {
                        changes.audit.push(MalfunctionEvidence {
                            event_id: event_id.into(),
                            occurrence: occurrence.clone(),
                            subject_player_id: actor.id.clone(),
                            outcome: MalfunctionOutcome::EffectFailure {
                                effect: FailedEffect::PhilosopherAcquisition,
                            },
                            causes,
                        });
                    }
                }
                let grants = if outcome == PhilosopherChoiceOutcome::Acquired {
                    vec![AbilityGrantChange {
                        owner_player_id: actor.id.clone(),
                        character_id: choices[0].clone(),
                        source,
                    }]
                } else {
                    vec![]
                };
                Ok((
                    CustomActionResult::PhilosopherChoice {
                        character_id: choices[0].clone(),
                        outcome,
                    },
                    CustomFactChanges::resolved(vec![], grants, changes),
                ))
            }
            "snakeCharmer" => {
                let target_id = one_player(&input.input)?;
                let target = facts
                    .player(target_id)
                    .filter(|p| p.alive)
                    .ok_or_else(invalid)?;
                if occurrence.simulation_source.is_some() {
                    return Ok((
                        CustomActionResult::Simulation {
                            information: None,
                            spent: false,
                        },
                        CustomFactChanges::default(),
                    ));
                }
                let source = occurrence
                    .ability_use
                    .clone()
                    .ok_or_else(provenance_error)?;
                let demon = definition.character_kind(&target.actual_character)
                    == Some(CharacterKind::Demon);
                let outcome = if !demon {
                    SnakeCharmerOutcome::NotDemon
                } else if impaired(facts, &actor.id) {
                    SnakeCharmerOutcome::Impaired
                } else {
                    SnakeCharmerOutcome::Swapped
                };
                let mut identities = vec![];
                if outcome == SnakeCharmerOutcome::Swapped {
                    if actor.id == target.id {
                        return Err(invalid());
                    }
                    identities.push(PlayerIdentityTransition {
                        player_id: actor.id.clone(),
                        before: identity(actor),
                        after: identity(target),
                    });
                    identities.push(PlayerIdentityTransition {
                        player_id: target.id.clone(),
                        before: identity(target),
                        after: identity(actor),
                    });
                    changes.durable_impairments.push(DurableImpairment {
                        source_ability_use: source,
                        impairment: ActiveImpairment {
                            kind: ImpairmentKind::Poisoned,
                            player_id: target.id.clone(),
                            source_event_id: event_id.into(),
                            source_character_id: "snakeCharmer".into(),
                            expires: ImpairmentExpiry::Never,
                        },
                    });
                } else if outcome == SnakeCharmerOutcome::Impaired {
                    let causes = impairment_causes(facts, &actor.id);
                    if !causes.is_empty() {
                        changes.audit.push(MalfunctionEvidence {
                            event_id: event_id.into(),
                            occurrence: occurrence.clone(),
                            subject_player_id: actor.id.clone(),
                            outcome: MalfunctionOutcome::EffectFailure {
                                effect: FailedEffect::SnakeCharmerSwap,
                            },
                            causes,
                        });
                    }
                }
                Ok((
                    CustomActionResult::SnakeCharmer {
                        target_player_id: target.id.clone(),
                        outcome,
                    },
                    CustomFactChanges::resolved(identities, vec![], changes),
                ))
            }
            "evilTwin" | "witch" | "cerenovus" => {
                let fields = input.input.as_ref().ok_or_else(invalid)?;
                let ids = fields.player_ids.as_ref().ok_or_else(invalid)?;
                if ids.len() != 1 {
                    return Err(invalid());
                }
                let selected_character = if self.character() == "cerenovus" {
                    let character = fields.character_id.as_ref().ok_or_else(invalid)?;
                    if !custom_ability_acquisition_character_ids(definition).contains(character) {
                        return Err(invalid());
                    }
                    Some(character.clone())
                } else {
                    None
                };
                if *fields
                    != (StepInputFields {
                        player_ids: Some(ids.clone()),
                        character_id: selected_character.clone(),
                        ..Default::default()
                    })
                {
                    return Err(invalid());
                }
                let target = facts.player(&ids[0]).ok_or_else(invalid)?;
                if self.character() == "evilTwin" && target.alignment == actor.alignment {
                    return Err(invalid());
                }
                let source = occurrence
                    .ability_use
                    .clone()
                    .ok_or_else(provenance_error)?;
                let active = effective(facts, &source);
                let result = match self.character() {
                    "evilTwin" => {
                        changes.twin_relationship = Some(TwinRelationship {
                            source_event_id: event_id.into(),
                            ability_use: source,
                            target_player_id: target.id.clone(),
                            effective: active,
                        });
                        CustomActionResult::EvilTwin {
                            target_player_id: target.id.clone(),
                            effective: active,
                        }
                    }
                    "witch" => {
                        let active = active && facts.players.iter().filter(|p| p.alive).count() > 3;
                        changes.witch_curse = Some(WitchCurse {
                            source_event_id: event_id.into(),
                            ability_use: source,
                            target_player_id: target.id.clone(),
                            day: 1,
                            initially_effective: active,
                            effective: active,
                        });
                        CustomActionResult::Witch {
                            target_player_id: target.id.clone(),
                            day: 1,
                            effective: active,
                        }
                    }
                    _ => {
                        let character_id = selected_character.unwrap();
                        changes.madness_assignment = Some(MadnessAssignment {
                            source_event_id: event_id.into(),
                            ability_use: source,
                            target_player_id: target.id.clone(),
                            character_id: character_id.clone(),
                            day: 1,
                            initially_effective: active,
                            effective: active,
                        });
                        CustomActionResult::Cerenovus {
                            target_player_id: target.id.clone(),
                            character_id,
                            day: 1,
                            effective: active,
                        }
                    }
                };
                Ok((result, CustomFactChanges::resolved(vec![], vec![], changes)))
            }
            _ => Err(ErrorKind::FirstNightActionHandlerUnavailable.into_error()),
        }
    }
}
fn one_player(input: &StepInput) -> Result<&str, CoreError> {
    let fields = input.as_ref().ok_or_else(invalid)?;
    let ids = fields.player_ids.as_ref().ok_or_else(invalid)?;
    if ids.len() != 1
        || *fields
            != (StepInputFields {
                player_ids: Some(ids.clone()),
                ..Default::default()
            })
    {
        return Err(invalid());
    }
    Ok(&ids[0])
}
fn twin_needs_repair(facts: &CustomGameFacts, source: &AbilityUseRef) -> bool {
    effective(facts, source)
        && facts
            .twin_relationships
            .iter()
            .rev()
            .find(|r| r.ability_use == *source)
            .is_some_and(|r| {
                facts
                    .player(&source.owner_player_id)
                    .zip(facts.player(&r.target_player_id))
                    .is_some_and(|(a, b)| a.alignment == b.alignment)
            })
}
impl crate::first_night::FollowUpRule for SnvHandler {
    fn candidates(
        &self,
        context: &crate::first_night::FollowUpContext<'_>,
    ) -> Result<Vec<ActionOccurrence>, CoreError> {
        if self.character() != "evilTwin" {
            return Ok(vec![]);
        }
        let mut result = vec![];
        for relation in &context.next_facts.twin_relationships {
            let source = &relation.ability_use;
            if !twin_needs_repair(context.previous_facts, source)
                && twin_needs_repair(context.next_facts, source)
                && context
                    .next_facts
                    .twin_relationships
                    .iter()
                    .rev()
                    .find(|r| r.ability_use == *source)
                    .is_some_and(|r| r.source_event_id == relation.source_event_id)
            {
                result.push(ActionOccurrence::from_parts(
                    self.action_ref.clone(),
                    Some(source.clone()),
                    None,
                    Some(FollowUpCause {
                        trigger_event_id: context.event.event_id().into(),
                        relationship_event_id: relation.source_event_id.clone(),
                    }),
                )?);
            }
        }
        Ok(result)
    }
}
impl ActionHandler for SnvHandler {
    fn follow_up_rule(&self) -> Option<&dyn crate::first_night::FollowUpRule> {
        (self.character() == "evilTwin").then_some(self)
    }

    fn action_ref(&self) -> &FirstNightActionRef {
        &self.action_ref
    }
    fn permits_defer(&self) -> bool {
        self.character() == "philosopher"
    }
    fn project(
        &self,
        _spec: &ActionSpec,
        context: &ActionContext<'_>,
    ) -> Result<Vec<PhaseStep>, CoreError> {
        let mut occurrences = context
            .rule_service
            .try_owned_instances(&self.action_ref)?
            .into_iter()
            .map(|instance| {
                ActionOccurrence::character(self.action_ref.clone(), instance.ability_use)
            })
            .collect::<Result<Vec<_>, _>>()?;
        occurrences.extend(
            context
                .rule_service
                .simulation_occurrences(&self.action_ref)?,
        );
        let mut steps = vec![];
        for occurrence in occurrences {
            if self.eligible(context, &occurrence)? {
                steps.push(self.step(context, &occurrence)?);
            }
        }
        Ok(steps)
    }
    fn project_occurrence(
        &self,
        _spec: &ActionSpec,
        context: &ActionContext<'_>,
        occurrence: &ActionOccurrence,
    ) -> Result<Option<PhaseStep>, CoreError> {
        if self.eligible(context, occurrence)? {
            Ok(Some(self.step(context, occurrence)?))
        } else {
            Ok(None)
        }
    }
    fn propose(
        &self,
        spec: &ActionSpec,
        context: &ActionContext<'_>,
        occurrence: &ActionOccurrence,
        input: &StepInput,
    ) -> Result<ActionEventDraft, CoreError> {
        self.propose_input(
            spec,
            context,
            occurrence,
            &ActionInput {
                input: input.clone(),
                delivered_result: None,
                registration_judgments: vec![],
            },
        )
    }
    fn propose_input(
        &self,
        _spec: &ActionSpec,
        context: &ActionContext<'_>,
        occurrence: &ActionOccurrence,
        input: &ActionInput,
    ) -> Result<ActionEventDraft, CoreError> {
        let (result, _) = self.resolve(context, occurrence, input, context.event_id)?;
        Ok(ActionEventDraft::Custom(CustomActionEventDraft {
            step_id: occurrence.step_id()?,
            action_ref: self.action_ref.clone(),
            ability_use: occurrence.ability_use.clone(),
            simulation_source: occurrence.simulation_source.clone(),
            follow_up_cause: occurrence.follow_up_cause.clone(),
            input: input.input.clone(),
            delivered_result: input.delivered_result.clone(),
            registration_judgments: input.registration_judgments.clone(),
            result,
        }))
    }
    fn validate_event(
        &self,
        spec: &ActionSpec,
        context: &ActionContext<'_>,
        occurrence: &ActionOccurrence,
        draft: &ActionEventDraft,
    ) -> Result<CustomFactChanges, CoreError> {
        self.validate_event_with_id(spec, context, occurrence, draft, context.event_id)
    }
    fn validate_event_with_id(
        &self,
        _spec: &ActionSpec,
        context: &ActionContext<'_>,
        occurrence: &ActionOccurrence,
        draft: &ActionEventDraft,
        event_id: &str,
    ) -> Result<CustomFactChanges, CoreError> {
        let ActionEventDraft::Custom(draft) = draft else {
            return Err(provenance_error());
        };
        let (expected, changes) = self.resolve(
            context,
            occurrence,
            &ActionInput {
                input: draft.input.clone(),
                delivered_result: draft.delivered_result.clone(),
                registration_judgments: draft.registration_judgments.clone(),
            },
            event_id,
        )?;
        if expected != draft.result {
            return Err(invalid());
        }
        Ok(changes)
    }
}

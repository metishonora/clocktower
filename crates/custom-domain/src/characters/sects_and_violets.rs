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
        ("clockmaker", "learnSteps", RequiredInputKind::None),
        ("dreamer", "learnCharacters", RequiredInputKind::PlayerIds),
        (
            "seamstress",
            "compareAlignments",
            RequiredInputKind::PlayerIds,
        ),
        ("mathematician", "learnCount", RequiredInputKind::None),
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
            && !(matches!(self.character(), "philosopher" | "seamstress")
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
        } else if !matches!(self.character(), "clockmaker" | "mathematician") {
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
        if matches!(self.character(), "dreamer" | "seamstress") {
            input.allowed_player_ids = Some(
                facts
                    .players
                    .iter()
                    .filter(|p| Some(p.id.as_str()) != occurrence.actor_player_id())
                    .map(|p| p.id.clone())
                    .collect(),
            );
            let count = if self.character() == "seamstress" {
                2
            } else {
                1
            };
            input.min_selections = Some(count);
            input.max_selections = Some(count);
            input.optional = self.character() == "seamstress";
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
            information_prompt: if self.is_information() {
                Some(self.information_prompt(context, occurrence)?)
            } else {
                None
            },
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
        if self.is_information() {
            return self.resolve_information(context, occurrence, input, event_id);
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
                            cause_details: impairment_details(facts, &actor.id),
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
                            cause_details: impairment_details(facts, &actor.id),
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
        matches!(self.character(), "philosopher" | "seamstress")
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

use crate::information::equivalent;
use crate::model::{
    Alignment, ConfirmedInformation, DeliveryContext, DeliveryReason, InformationActor,
    InformationDeliveryMode, InformationPrompt, InformationResult, NumberInformationChoice,
    RegistrationJudgment, RegistrationValue, TargetInformationCheck, TargetInformationChoice,
};

struct InformationOptions {
    actual: Vec<InformationResult>,
    allowed: Vec<InformationResult>,
    reasons: Vec<DeliveryReason>,
    causes: Vec<AbilityUseRef>,
}
fn good_kind(kind: Option<CharacterKind>) -> bool {
    matches!(
        kind,
        Some(CharacterKind::Townsfolk | CharacterKind::Outsider)
    )
}
fn registration_source(facts: &CustomGameFacts, player_id: &str) -> Option<AbilityUseRef> {
    if impaired(facts, player_id) {
        return None;
    }
    // Both native misregistration abilities explicitly continue while dead.
    facts
        .ability_provenance
        .iter()
        .map(|p| p.ability_use.clone())
        .find(|source| {
            source.owner_player_id == player_id
                && matches!(source.character_id.as_str(), "spy" | "recluse")
                && current_ability_instance(facts, source)
        })
}
impl SnvHandler {
    fn is_information(&self) -> bool {
        matches!(
            self.character(),
            "clockmaker" | "dreamer" | "seamstress" | "mathematician"
        )
    }
    fn information_targets(
        &self,
        facts: &CustomGameFacts,
        occurrence: &ActionOccurrence,
        input: &StepInput,
    ) -> Result<Vec<String>, CoreError> {
        let actor = occurrence.actor_player_id().ok_or_else(provenance_error)?;
        let ids = match self.character() {
            "dreamer" => crate::information::targets(input, 1, actor)?,
            "seamstress" => crate::information::targets(input, 2, actor)?,
            _ => {
                if input.is_some() {
                    return Err(invalid());
                }
                vec![]
            }
        };
        if ids.iter().any(|id| facts.player(id).is_none()) {
            return Err(invalid());
        }
        Ok(ids)
    }
    fn truth(
        &self,
        definition: &ResolvedScriptContext,
        facts: &CustomGameFacts,
        actor: &str,
        targets: &[String],
        judgments: &[RegistrationJudgment],
    ) -> Result<Vec<InformationResult>, CoreError> {
        let mut kinds = facts
            .players
            .iter()
            .map(|p| definition.character_kind(&p.actual_character))
            .collect::<Vec<_>>();
        let mut alignments = facts
            .players
            .iter()
            .map(|p| p.alignment)
            .collect::<Vec<_>>();
        let mut characters = facts
            .players
            .iter()
            .map(|p| p.actual_character.clone())
            .collect::<Vec<_>>();
        for (i, j) in judgments.iter().enumerate() {
            if judgments[..i]
                .iter()
                .any(|previous| previous.player_id == j.player_id)
            {
                return Err(invalid());
            }
            let source = registration_source(facts, &j.player_id).ok_or_else(invalid)?;
            if !super::trouble_brewing::registration_allowed(&source.character_id, j, definition) {
                return Err(invalid());
            }
            let index = facts
                .players
                .iter()
                .position(|p| p.id == j.player_id)
                .ok_or_else(invalid)?;
            match self.character() {
                "dreamer" => {
                    if !targets.contains(&j.player_id) || j.character_id.is_none() {
                        return Err(invalid());
                    }
                    characters[index] = j.character_id.clone().unwrap();
                }
                "seamstress" => {
                    if !targets.contains(&j.player_id)
                        || !matches!(
                            j.registered_as,
                            RegistrationValue::Good | RegistrationValue::Evil
                        )
                        || j.character_id.is_some()
                    {
                        return Err(invalid());
                    }
                    alignments[index] = if j.registered_as == RegistrationValue::Good {
                        Alignment::Good
                    } else {
                        Alignment::Evil
                    };
                }
                "clockmaker" => {
                    if j.character_id.is_some() {
                        return Err(invalid());
                    }
                    kinds[index] = Some(match j.registered_as {
                        RegistrationValue::Townsfolk => CharacterKind::Townsfolk,
                        RegistrationValue::Outsider => CharacterKind::Outsider,
                        RegistrationValue::Minion => CharacterKind::Minion,
                        RegistrationValue::Demon => CharacterKind::Demon,
                        _ => return Err(invalid()),
                    });
                }
                _ => return Err(invalid()),
            }
        }
        match self.character() {
            "clockmaker" => {
                let mut seats = (0..facts.players.len()).collect::<Vec<_>>();
                seats.sort_by_key(|i| facts.players[*i].seat);
                let n = seats.len();
                let mut distance = None;
                for (a, i) in seats
                    .iter()
                    .enumerate()
                    .filter(|(_, i)| kinds[**i] == Some(CharacterKind::Demon))
                {
                    for (b, j) in seats
                        .iter()
                        .enumerate()
                        .filter(|(_, j)| kinds[**j] == Some(CharacterKind::Minion))
                    {
                        if i != j {
                            let gap = a.abs_diff(b);
                            let value = gap.min(n - gap) as u64;
                            distance = Some(distance.map_or(value, |old: u64| old.min(value)));
                        }
                    }
                }
                Ok(vec![InformationResult::Number {
                    value: distance.unwrap_or(0),
                }])
            }
            "dreamer" => {
                let index = facts
                    .players
                    .iter()
                    .position(|p| p.id == targets[0])
                    .ok_or_else(invalid)?;
                let actual = &characters[index];
                let good = good_kind(definition.character_kind(actual));
                Ok(definition
                    .character_ids()
                    .into_iter()
                    .filter(|id| good_kind(definition.character_kind(id)) != good)
                    .map(|id| InformationResult::CharacterPair {
                        character_ids: if good {
                            vec![actual.clone(), id.into()]
                        } else {
                            vec![id.into(), actual.clone()]
                        },
                    })
                    .collect())
            }
            "seamstress" => {
                let values = targets
                    .iter()
                    .map(|id| {
                        facts
                            .players
                            .iter()
                            .position(|p| &p.id == id)
                            .map(|i| alignments[i])
                    })
                    .collect::<Option<Vec<_>>>()
                    .ok_or_else(invalid)?;
                Ok(vec![InformationResult::Boolean {
                    value: values[0] == values[1],
                }])
            }
            "mathematician" => {
                let subjects=facts.malfunction_audit.iter().filter(|e|!(e.subject_player_id==actor && matches!(&e.occurrence.action_ref,FirstNightActionRef::Character{character_id,..}if character_id=="mathematician"))).map(|e|e.subject_player_id.as_str()).collect::<std::collections::BTreeSet<_>>();
                Ok(vec![InformationResult::Number {
                    value: subjects.len() as u64,
                }])
            }
            _ => Err(invalid()),
        }
    }
    fn information_options(
        &self,
        definition: &ResolvedScriptContext,
        facts: &CustomGameFacts,
        occurrence: &ActionOccurrence,
        targets: &[String],
        judgments: &[RegistrationJudgment],
    ) -> Result<InformationOptions, CoreError> {
        let actor = occurrence.actor_player_id().ok_or_else(provenance_error)?;
        let actual = self.truth(definition, facts, actor, targets, &[])?;
        let judged = self.truth(definition, facts, actor, targets, judgments)?;
        let mut reasons = vec![];
        let mut causes = vec![];
        for impairment in facts
            .active_impairments
            .iter()
            .filter(|e| e.player_id == actor)
        {
            let reason = match impairment.kind {
                ImpairmentKind::Drunk => DeliveryReason::Drunk,
                ImpairmentKind::Poisoned => {
                    let owner = facts
                        .resolved_impairments
                        .iter()
                        .find(|e| e.impairment == *impairment)
                        .map(|e| e.source_ability_use.owner_player_id.clone())
                        .ok_or_else(provenance_error)?;
                    DeliveryReason::Poisoned {
                        poisoner_player_id: owner,
                        poison_event_id: impairment.source_event_id.clone(),
                    }
                }
            };
            if !reasons.contains(&reason) {
                reasons.push(reason);
            }
        }
        causes.extend(impairment_causes(facts, actor));
        for source in &facts.vortox_sources {
            reasons.push(DeliveryReason::Vortox {
                demon_player_id: source.owner_player_id.clone(),
            });
            if !causes.contains(source) {
                causes.push(source.clone());
            }
        }
        if !judgments.is_empty() {
            reasons.push(DeliveryReason::RegistrationJudgment {
                judgments: judgments.to_vec(),
            });
            for j in judgments {
                let source = registration_source(facts, &j.player_id).ok_or_else(invalid)?;
                if !causes.contains(&source) {
                    causes.push(source);
                }
            }
        }
        let mut allowed = if impaired(facts, actor) || !facts.vortox_sources.is_empty() {
            match self.character() {
                "clockmaker" => (0..=(facts.players.len() / 2) as u64)
                    .map(|value| InformationResult::Number { value })
                    .collect(),
                "mathematician" => (0..=facts.players.len() as u64)
                    .map(|value| InformationResult::Number { value })
                    .collect(),
                "seamstress" => vec![
                    InformationResult::Boolean { value: false },
                    InformationResult::Boolean { value: true },
                ],
                "dreamer" => {
                    let mut pairs = vec![];
                    for good in definition
                        .character_ids()
                        .into_iter()
                        .filter(|id| good_kind(definition.character_kind(id)))
                    {
                        for evil in definition
                            .character_ids()
                            .into_iter()
                            .filter(|id| !good_kind(definition.character_kind(id)))
                        {
                            pairs.push(InformationResult::CharacterPair {
                                character_ids: vec![good.into(), evil.into()],
                            });
                        }
                    }
                    pairs
                }
                _ => return Err(invalid()),
            }
        } else {
            judged
        };
        // Approved policy: Vortox falsity is checked against actual facts before registration.
        if !facts.vortox_sources.is_empty() {
            allowed.retain(|candidate| !actual.iter().any(|truth| equivalent(candidate, truth)));
        }
        if actual.is_empty() || allowed.is_empty() {
            return Err(ErrorKind::InvalidDeliveredInformation.into_error());
        }
        if self.character() == "dreamer" {
            reasons.insert(0, DeliveryReason::AbilityChoice);
        }
        Ok(InformationOptions {
            actual,
            allowed,
            reasons,
            causes,
        })
    }
    fn resolve_information(
        &self,
        context: &ActionContext<'_>,
        occurrence: &ActionOccurrence,
        input: &ActionInput,
        event_id: &str,
    ) -> Result<(CustomActionResult, CustomFactChanges), CoreError> {
        if self.character() == "seamstress" && input.input.is_none() {
            if input.delivered_result.is_some() || !input.registration_judgments.is_empty() {
                return Err(invalid());
            }
            return Ok((
                if occurrence.simulation_source.is_some() {
                    CustomActionResult::Simulation {
                        information: None,
                        spent: false,
                    }
                } else {
                    CustomActionResult::SeamstressDeferred
                },
                CustomFactChanges::default(),
            ));
        }
        let facts = context.rule_service.facts().ok_or_else(provenance_error)?;
        let definition = context
            .rule_service
            .definition()
            .ok_or_else(provenance_error)?;
        let targets = self.information_targets(facts, occurrence, &input.input)?;
        let options = self.information_options(
            definition,
            facts,
            occurrence,
            &targets,
            &input.registration_judgments,
        )?;
        let delivered = match &input.delivered_result {
            Some(value) => options
                .allowed
                .iter()
                .find(|candidate| equivalent(candidate, value))
                .cloned()
                .ok_or_else(|| ErrorKind::InvalidDeliveredInformation.into_error())?,
            None if options.reasons.is_empty() && options.allowed.len() == 1 => {
                options.allowed[0].clone()
            }
            None => return Err(ErrorKind::MissingDeliveredInformation.into_error()),
        };
        let actor = occurrence.actor_player_id().ok_or_else(provenance_error)?;
        let mut changes = SnvFactChanges::default();
        let spent = self.character() == "seamstress";
        if spent {
            if let Some(source) = &occurrence.ability_use {
                changes.spent = Some(AbilityUseRecord {
                    source_event_id: event_id.into(),
                    ability_use: source.clone(),
                });
            }
        }
        if !options
            .actual
            .iter()
            .any(|truth| equivalent(truth, &delivered))
            && !options.causes.is_empty()
        {
            changes.audit.push(MalfunctionEvidence {
                cause_details: options
                    .reasons
                    .iter()
                    .filter(|r| !matches!(r, DeliveryReason::AbilityChoice))
                    .cloned()
                    .collect(),
                event_id: event_id.into(),
                occurrence: occurrence.clone(),
                subject_player_id: actor.into(),
                outcome: MalfunctionOutcome::IncorrectInformation {
                    delivered_result: delivered.clone(),
                },
                causes: options.causes,
            });
        }
        let information = ConfirmedInformation {
            actor: Some(InformationActor {
                player_id: actor.into(),
                character_id: self.character().into(),
            }),
            target_player_ids: targets,
            computed_result: options.actual.first().cloned(),
            delivered_result: delivered,
            delivery_context: if options.reasons.is_empty() {
                DeliveryContext::Fixed
            } else {
                DeliveryContext::Discretionary {
                    reasons: options.reasons,
                }
            },
        };
        let result = if occurrence.simulation_source.is_some() {
            CustomActionResult::Simulation {
                information: Some(information),
                spent,
            }
        } else {
            CustomActionResult::InformationDelivered { information, spent }
        };
        Ok((result, CustomFactChanges::resolved(vec![], vec![], changes)))
    }
    fn registration_variants(
        &self,
        definition: &ResolvedScriptContext,
        facts: &CustomGameFacts,
        targets: &[String],
    ) -> Vec<Vec<RegistrationJudgment>> {
        let mut variants = vec![vec![]];
        for player in &facts.players {
            let Some(source) = registration_source(facts, &player.id) else {
                continue;
            };
            if self.character() == "mathematician"
                || (self.character() != "clockmaker" && !targets.contains(&player.id))
            {
                continue;
            }
            let mut options = vec![];
            let values = if source.character_id == "spy" {
                vec![
                    RegistrationValue::Good,
                    RegistrationValue::Townsfolk,
                    RegistrationValue::Outsider,
                ]
            } else {
                vec![
                    RegistrationValue::Evil,
                    RegistrationValue::Minion,
                    RegistrationValue::Demon,
                ]
            };
            for value in values {
                match self.character() {
                    "seamstress"
                        if matches!(value, RegistrationValue::Good | RegistrationValue::Evil) =>
                    {
                        options.push(RegistrationJudgment {
                            player_id: player.id.clone(),
                            registered_as: value,
                            character_id: None,
                        })
                    }
                    "clockmaker"
                        if !matches!(value, RegistrationValue::Good | RegistrationValue::Evil) =>
                    {
                        options.push(RegistrationJudgment {
                            player_id: player.id.clone(),
                            registered_as: value,
                            character_id: None,
                        })
                    }
                    "dreamer" => {
                        for id in definition.character_ids() {
                            let j = RegistrationJudgment {
                                player_id: player.id.clone(),
                                registered_as: value,
                                character_id: Some(id.into()),
                            };
                            if super::trouble_brewing::registration_allowed(
                                &source.character_id,
                                &j,
                                definition,
                            ) {
                                options.push(j);
                            }
                        }
                    }
                    _ => {}
                }
            }
            let previous = variants.clone();
            for existing in previous {
                for j in &options {
                    let mut next = existing.clone();
                    next.push(j.clone());
                    variants.push(next);
                }
            }
        }
        variants
    }
    fn information_prompt(
        &self,
        context: &ActionContext<'_>,
        occurrence: &ActionOccurrence,
    ) -> Result<InformationPrompt, CoreError> {
        let facts = context.rule_service.facts().ok_or_else(provenance_error)?;
        let definition = context
            .rule_service
            .definition()
            .ok_or_else(provenance_error)?;
        let actor = occurrence.actor_player_id().ok_or_else(provenance_error)?;
        let candidates = facts
            .players
            .iter()
            .filter(|p| p.id != actor)
            .map(|p| p.id.clone())
            .collect::<Vec<_>>();
        let target_sets = match self.character() {
            "dreamer" => candidates.iter().map(|id| vec![id.clone()]).collect(),
            "seamstress" => {
                let mut pairs = vec![];
                for (i, a) in candidates.iter().enumerate() {
                    for b in &candidates[i + 1..] {
                        pairs.push(vec![a.clone(), b.clone()]);
                    }
                }
                pairs
            }
            _ => vec![vec![]],
        };
        let mut prompt = InformationPrompt {
            computed_result: None,
            delivery_mode: InformationDeliveryMode::Fixed,
            active_reasons: vec![],
            registration_candidate_player_ids: vec![],
            number_choices: vec![],
            number_constraint: None,
            boolean_choices: vec![],
            setup_info_registration_options: vec![],
            target_checks: vec![],
            mathematician_audit: None,
        };
        for targets in target_sets {
            let mut choices = vec![];
            let mut baseline = None;
            for judgments in self.registration_variants(definition, facts, &targets) {
                let options =
                    self.information_options(definition, facts, occurrence, &targets, &judgments)?;
                baseline = options.actual.first().cloned();
                for reason in options.reasons {
                    if !prompt.active_reasons.contains(&reason) {
                        prompt.active_reasons.push(reason);
                    }
                }
                for j in &judgments {
                    if !prompt
                        .registration_candidate_player_ids
                        .contains(&j.player_id)
                    {
                        prompt
                            .registration_candidate_player_ids
                            .push(j.player_id.clone());
                    }
                }
                for value in options.allowed {
                    let is_computed = options.actual.iter().any(|truth| equivalent(&value, truth));
                    if targets.is_empty() {
                        if let InformationResult::Number { value } = value {
                            prompt.number_choices.push(NumberInformationChoice {
                                value,
                                is_computed,
                                registration_judgments: judgments.clone(),
                            });
                        }
                    } else {
                        choices.push(TargetInformationChoice {
                            result: value,
                            is_computed,
                            registration_judgments: judgments.clone(),
                        });
                    }
                }
            }
            if targets.is_empty() {
                prompt.computed_result = baseline;
            } else {
                prompt.target_checks.push(TargetInformationCheck {
                    target_player_ids: targets,
                    computed_result: baseline.ok_or_else(invalid)?,
                    choices,
                });
            }
        }
        if !prompt.active_reasons.is_empty() {
            prompt.delivery_mode = InformationDeliveryMode::Selectable;
        }
        if self.character() == "mathematician" {
            prompt.mathematician_audit = Some(mathematician_audit(facts, actor)?);
        }
        Ok(prompt)
    }
}

fn mathematician_audit(
    facts: &CustomGameFacts,
    actor: &str,
) -> Result<crate::model::MathematicianAudit, CoreError> {
    use crate::model::{
        AbnormalAbilityAuditRecord, AbnormalAbilityEffect, AbnormalAbilityEvidence,
        AbnormalAbilityOutcome, MathematicianAudit,
    };
    let mut records: Vec<AbnormalAbilityAuditRecord> = vec![];
    for evidence in &facts.malfunction_audit {
        let FirstNightActionRef::Character { character_id, .. } = &evidence.occurrence.action_ref
        else {
            return Err(provenance_error());
        };
        if evidence.subject_player_id == actor && character_id == "mathematician" {
            continue;
        }
        // A simulated action is attributed to the real failed Philosopher, never a fake grant.
        let source = evidence
            .occurrence
            .ability_use
            .as_ref()
            .or_else(|| {
                evidence
                    .occurrence
                    .simulation_source
                    .as_ref()
                    .map(|s| &s.source_ability_use)
            })
            .ok_or_else(provenance_error)?;
        let event = facts
            .confirmed_actions
            .iter()
            .find(|e| e.event_id == evidence.event_id)
            .ok_or_else(provenance_error)?;
        let info = match &event.result {
            CustomActionResult::InformationDelivered { information, .. }
            | CustomActionResult::Simulation {
                information: Some(information),
                ..
            } => Some(information),
            _ => None,
        };
        let outcome = match &evidence.outcome {
            MalfunctionOutcome::IncorrectInformation { delivered_result } => {
                AbnormalAbilityOutcome::IncorrectInformation {
                    computed_result: info
                        .and_then(|i| i.computed_result.clone())
                        .ok_or_else(provenance_error)?,
                    delivered_result: delivered_result.clone(),
                }
            }
            MalfunctionOutcome::EffectFailure { effect } => AbnormalAbilityOutcome::EffectFailure {
                effect: match effect {
                    FailedEffect::PhilosopherAcquisition => {
                        AbnormalAbilityEffect::PhilosopherAcquisition
                    }
                    FailedEffect::SnakeCharmerSwap => AbnormalAbilityEffect::SnakeCharmerSwap,
                    FailedEffect::WitchCurse => AbnormalAbilityEffect::WitchCurse,
                    FailedEffect::CerenovusMadness => AbnormalAbilityEffect::CerenovusMadness,
                    FailedEffect::EvilTwinRelationship => {
                        AbnormalAbilityEffect::EvilTwinRelationship
                    }
                },
            },
        };
        let causes = evidence.cause_details.clone();
        let item = AbnormalAbilityEvidence {
            resolution_event_id: evidence.event_id.clone(),
            step_id: evidence.occurrence.step_id()?,
            phase: Phase::FirstNight,
            character_id: character_id.clone(),
            ability_instance_id: source.ability_instance_id.clone(),
            outcome,
            causes,
        };
        if let Some(record) = records.iter_mut().find(|r| {
            r.subject_player_id == evidence.subject_player_id
                && r.ability_instance_id == source.ability_instance_id
        }) {
            record.evidence.push(item);
        } else {
            records.push(AbnormalAbilityAuditRecord {
                subject_player_id: evidence.subject_player_id.clone(),
                character_id: source.character_id.clone(),
                ability_instance_id: source.ability_instance_id.clone(),
                evidence: vec![item],
            });
        }
    }
    Ok(MathematicianAudit { records })
}

fn impairment_details(facts: &CustomGameFacts, actor: &str) -> Vec<DeliveryReason> {
    facts
        .resolved_impairments
        .iter()
        .filter(|e| e.impairment.player_id == actor)
        .map(|e| match e.impairment.kind {
            ImpairmentKind::Drunk => DeliveryReason::Drunk,
            ImpairmentKind::Poisoned => DeliveryReason::Poisoned {
                poisoner_player_id: e.source_ability_use.owner_player_id.clone(),
                poison_event_id: e.impairment.source_event_id.clone(),
            },
        })
        .collect()
}

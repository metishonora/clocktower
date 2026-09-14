use crate::contracts::ActionCause;
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

pub(crate) use crate::simulation::occurrences as simulation_occurrences;

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
pub(crate) use crate::effects::{effective, impaired, impairment_causes, resolve_effects};
pub(crate) fn impairment_candidates(
    context: &ResolvedScriptContext,
    facts: &CustomGameFacts,
) -> Vec<crate::effects::ImpairmentEffect> {
    use crate::effects::ImpairmentEffect;
    let mut candidates = vec![];
    for death in &facts.night_deaths {
        if !vigor_death_active(facts, death) {
            continue;
        }
        let Some(target) = vigor_choice(facts, &death.event_id) else {
            continue;
        };
        if !vigor_targets(facts, &death.player.id)
            .iter()
            .any(|p| p == target)
        {
            continue;
        }
        let source = death.source.ability_use.as_ref().unwrap();
        candidates.push(ImpairmentEffect {
            effect: DurableImpairment {
                source_ability_use: source.clone(),
                impairment: ActiveImpairment {
                    kind: ImpairmentKind::Poisoned,
                    player_id: target.into(),
                    source_event_id: death.event_id.clone(),
                    source_character_id: "vigormortis".into(),
                    expires: ImpairmentExpiry::WhileSourceAbilityActive,
                },
            },
            requires_source: true,
            ignore_self: false,
            demon_harm: true,
        });
    }
    let mut players = facts.players.clone();
    players.sort_by_key(|p| p.seat);
    for (index, player) in players.iter().enumerate() {
        if player.actual_character != "noDashii" {
            continue;
        }
        for clockwise in [true, false] {
            let target = (1..players.len())
                .map(|d| {
                    if clockwise {
                        (index + d) % players.len()
                    } else {
                        (index + players.len() - d) % players.len()
                    }
                })
                .map(|i| &players[i])
                .find(|p| {
                    context.character_kind(&p.actual_character) == Some(CharacterKind::Townsfolk)
                });
            if let Some(target) = target {
                candidates.push(ImpairmentEffect {
                    effect: DurableImpairment {
                        source_ability_use: player_source(player),
                        impairment: ActiveImpairment {
                            kind: ImpairmentKind::Poisoned,
                            player_id: target.id.clone(),
                            source_event_id: player.ability_instance.source_event_id.clone(),
                            source_character_id: "noDashii".into(),
                            expires: ImpairmentExpiry::WhileSourceAbilityActive,
                        },
                    },
                    requires_source: true,
                    ignore_self: false,
                    demon_harm: true,
                });
            }
        }
    }
    for choice in &facts.philosopher_choices {
        if choice.outcome == PhilosopherChoiceOutcome::Failed {
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
        for player_id in targets {
            candidates.push(ImpairmentEffect {
                effect: DurableImpairment {
                    source_ability_use: choice.ability_use.clone(),
                    impairment: ActiveImpairment {
                        kind: ImpairmentKind::Drunk,
                        player_id,
                        source_event_id: choice.source_event_id.clone(),
                        source_character_id: "philosopher".into(),
                        expires: ImpairmentExpiry::WhileSourceAbilityActive,
                    },
                },
                requires_source: true,
                ignore_self: choice.outcome == PhilosopherChoiceOutcome::SelfDrunk,
                demon_harm: false,
            });
        }
    }
    candidates
}
pub(crate) fn refresh_assignments(facts: &mut CustomGameFacts) -> Result<(), CoreError> {
    let curses = facts
        .witch_curses
        .iter()
        .map(|r| {
            r.initially_effective
                && daytime_effect_in_lifetime(facts, r.day)
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
        .map(|r| {
            r.initially_effective
                && daytime_effect_in_lifetime(facts, r.day)
                && effective(facts, &r.ability_use)
        })
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
        // A replacement created by a demon's own kill starts attacking next night.
        if matches!(context.action_ref,FirstNightActionRef::Character {action_id,..} if action_id=="attackPlayer")
            && matches!(context.event,crate::first_night::ValidatedActionEvent::Custom(e) if matches!(e.payload().result,CustomActionResult::NightAttack {..}))
        {
            return Ok(ActivationDecision::Defer);
        }
        if matches!(
            character_id.as_str(),
            "clockmaker" | "washerwoman" | "librarian" | "investigator" | "chef"
        ) {
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
        ("flowergirl", "learnDemonVoted", RequiredInputKind::None),
        ("townCrier", "learnMinionNominated", RequiredInputKind::None),
        ("oracle", "learnDeadEvilCount", RequiredInputKind::None),
        ("juggler", "learnJuggles", RequiredInputKind::None),
        ("evilTwin", "learnTwin", RequiredInputKind::None),
        ("evilTwin", "assignTwin", RequiredInputKind::PlayerIds),
        (
            "mutant",
            "resolveMadnessExecution",
            RequiredInputKind::ExecutionDecision,
        ),
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
                prerequisites: if id == "learnTwin" {
                    vec![action("evilTwin", "assignTwin")]
                } else {
                    vec![]
                },
                continuation_sources: if id == "resolveMadnessExecution" {
                    vec![]
                } else {
                    vec![
                        crate::first_night::execution::DependencySource::Relationship,
                        crate::first_night::execution::DependencySource::ImmediateOrigin,
                    ]
                },
                action_ref: action_ref.clone(),
                participates_in_first_night: !matches!(
                    id,
                    "assignTwin"
                        | "resolveMadnessExecution"
                        | "learnDemonVoted"
                        | "learnMinionNominated"
                        | "learnDeadEvilCount"
                        | "learnJuggles"
                ),
                required_input_kind: kind,
                support: PhaseStepSupport::Automated,
            },
            handler: Box::new(SnvHandler { action_ref }),
        }
    })
    .chain(other_night_registrations())
    .collect()
}
struct SnvHandler {
    action_ref: FirstNightActionRef,
}
impl SnvHandler {
    fn id(&self) -> &str {
        match &self.action_ref {
            FirstNightActionRef::Character { action_id, .. } => action_id,
            _ => unreachable!(),
        }
    }
    fn mutant_candidates(&self, c: &ActionContext<'_>) -> Result<Vec<ActionOccurrence>, CoreError> {
        if self.character() != "mutant" {
            return Ok(vec![]);
        }
        let facts = c.rule_service.facts().ok_or_else(invalid)?;
        if facts.game_end.is_some() {
            return Ok(vec![]);
        }
        c.rule_service
            .try_owned_instances(&self.action_ref)?
            .into_iter()
            .filter(|i| {
                facts
                    .player(&i.ability_use.owner_player_id)
                    .is_some_and(|p| p.alive)
            })
            .map(|i| {
                ActionOccurrence::from_all_parts(
                    self.action_ref.clone(),
                    Some(i.ability_use),
                    None,
                    None,
                    Some(crate::contracts::ActionCause::Optional {
                        prefix_event_id: facts.prefix_event_id.clone(),
                    }),
                )
            })
            .collect()
    }
    fn twin_candidates(
        &self,
        context: &ActionContext<'_>,
    ) -> Result<Vec<ActionOccurrence>, CoreError> {
        use crate::contracts::ActionCause;
        if self.character() != "evilTwin" {
            return Ok(vec![]);
        }
        let facts = context.rule_service.facts().ok_or_else(invalid)?;
        let mut result = vec![];
        for instance in context.rule_service.try_owned_instances(&self.action_ref)? {
            let source = instance.ability_use;
            if !facts
                .player(&source.owner_player_id)
                .is_some_and(|p| p.alive)
            {
                continue;
            }
            let relation = facts
                .twin_relationships
                .iter()
                .rev()
                .find(|r| r.ability_use == source);
            let prior_informed = facts.confirmed_actions.iter().any(|f| {
                f.occurrence.ability_use.as_ref() == Some(&source)
                    && matches!(f.result, CustomActionResult::TwinInformed { .. })
            });
            let cause = if self.id() == "assignTwin" {
                match relation {
                    None => Some(ActionCause::InitialPreparation {
                        source_event_id: facts
                            .player(&source.owner_player_id)
                            .unwrap()
                            .ability_instance
                            .source_event_id
                            .clone(),
                    }),
                    Some(r) if twin_needs_repair(facts, &source) => {
                        Some(ActionCause::RequiredPreparation {
                            trigger_event_id: facts.prefix_event_id.clone(),
                            previous_preparation_event_id: Some(r.source_event_id.clone()),
                        })
                    }
                    _ => None,
                }
            } else {
                relation.filter(|r|prior_informed&&!twin_needs_repair(facts,&source)&&!facts.confirmed_actions.iter().any(|f|matches!(&f.result,CustomActionResult::TwinInformed{relationship_event_id,..} if *relationship_event_id==r.source_event_id))).map(|r|ActionCause::Delivery{preparation_event_id:r.source_event_id.clone()})
            };
            if let Some(cause) = cause {
                result.push(ActionOccurrence::from_all_parts(
                    self.action_ref.clone(),
                    Some(source),
                    None,
                    None,
                    Some(cause),
                )?);
            }
        }
        Ok(result)
    }
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
        if matches!(
            self.character(),
            "flowergirl" | "townCrier" | "oracle" | "juggler"
        ) && facts.night_number() == 1
        {
            return Ok(false);
        }
        if self.character() == "clockmaker"
            && facts.confirmed_actions.iter().any(|a| {
                a.occurrence.source() == occurrence.source()
                    && a.occurrence.action_ref == self.action_ref
            })
        {
            return Ok(false);
        }
        if self.character() == "juggler"
            && !facts.day.as_ref().is_some_and(|d| {
                d.ability_records.iter().any(|r| {
                    r.action.ability_use == occurrence.ability_use
                        && r.action.simulation_source == occurrence.simulation_source
                        && matches!(
                            r.record,
                            crate::day::contracts::DayAbilityInput::Juggler { .. }
                        )
                })
            })
        {
            return Ok(false);
        }
        if occurrence.action_ref != self.action_ref {
            return Ok(false);
        }
        if !occurrence
            .actor_player_id()
            .and_then(|id| facts.player(id))
            .is_some_and(|player| {
                player.alive
                    || occurrence
                        .ability_use
                        .as_ref()
                        .is_some_and(|s| vigor_can_act(facts, s))
            })
        {
            return Ok(false);
        }
        if occurrence.simulation_source.is_some() {
            return Ok(simulation_occurrences(facts, &self.action_ref)?
                .contains(&occurrence.clone().in_night(1))
                && !(matches!(self.character(), "philosopher" | "seamstress")
                    && crate::simulation::spent(
                        facts,
                        occurrence.simulation_source.as_ref().unwrap(),
                    )));
        }
        let source = occurrence
            .ability_use
            .as_ref()
            .ok_or_else(provenance_error)?;
        if self.character() == "mutant" {
            return Ok(self
                .mutant_candidates(context)?
                .contains(&occurrence.clone().in_night(1)));
        }
        if self.character() == "evilTwin" {
            if occurrence.follow_up_cause.is_some() {
                return Ok(false);
            }
            if self.id() == "assignTwin" || occurrence.action_cause.is_some() {
                return Ok(self
                    .twin_candidates(context)?
                    .contains(&occurrence.clone().in_night(1)));
            }
            return Ok(current_ability_instance(facts, source)
                && facts
                    .twin_relationships
                    .iter()
                    .any(|r| r.ability_use == *source)
                && !facts.confirmed_actions.iter().any(|f| {
                    f.occurrence.ability_use.as_ref() == Some(source)
                        && matches!(f.result, CustomActionResult::TwinInformed { .. })
                }));
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
        } else if !matches!(
            self.character(),
            "clockmaker" | "mathematician" | "flowergirl" | "townCrier" | "oracle" | "juggler"
        ) {
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
        if self.character() == "evilTwin" && self.id() == "learnTwin" {
            input = crate::input::required_none();
        }
        if self.character() == "mutant" {
            input = crate::input::required_none();
            input.kind = RequiredInputKind::ExecutionDecision;
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
            execution: None,
            information_flow: None,
            madness: if self.character() == "mutant" {
                let check = mutant_check(facts, occurrence);
                let source_effective = occurrence
                    .ability_use
                    .as_ref()
                    .is_some_and(|source| effective(facts, source));
                Some(crate::model::MadnessState {
                    check,
                    source_effective,
                    can_check: check != Some(crate::model::MadnessCheckResult::Violation),
                    can_execute: source_effective,
                })
            } else {
                None
            },
            id: occurrence.step_id()?,
            phase: Phase::FirstNight,
            step_type: StepType::Character,
            character: Some(self.character().into()),
            player_id: occurrence.actor_player_id().map(str::to_owned),
            ability_use: occurrence.ability_use.clone(),
            ability_origin: origin,
            simulation_source: occurrence.simulation_source.clone(),
            follow_up_cause: occurrence.follow_up_cause.clone(),
            action_cause: occurrence.action_cause.clone(),
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
        if self.character() == "mutant" {
            let fields = input.input.as_ref().ok_or_else(invalid)?;
            if let Some(result) = fields.madness_check {
                if *fields
                    != (StepInputFields {
                        madness_check: Some(result),
                        ..Default::default()
                    })
                    || mutant_check(facts, occurrence)
                        == Some(crate::model::MadnessCheckResult::Violation)
                    || mutant_check(facts, occurrence) == Some(result)
                {
                    return Err(invalid());
                }
                return Ok((
                    CustomActionResult::MutantJudgment { result },
                    CustomFactChanges::default(),
                ));
            }
            let execute = fields.execute.ok_or_else(invalid)?;
            if *fields
                != (StepInputFields {
                    execute: Some(execute),
                    ..Default::default()
                })
            {
                return Err(invalid());
            }
            let source = occurrence.ability_use.as_ref().ok_or_else(invalid)?;
            let executed = execute && effective(facts, source);
            let died = executed && actor.alive;
            let causes = impairment_causes(facts, &actor.id);
            let audit = if execute && !executed && !causes.is_empty() {
                vec![MalfunctionEvidence {
                    daytime_step_id: None,
                    event_id: event_id.into(),
                    occurrence: occurrence.clone(),
                    subject_player_id: actor.id.clone(),
                    outcome: MalfunctionOutcome::EffectFailure {
                        effect: FailedEffect::MutantExecution,
                    },
                    causes,
                    cause_details: impairment_details(facts, &actor.id),
                }]
            } else {
                vec![]
            };
            let good_twin = actor.alignment == crate::model::Alignment::Good
                && facts.twin_relationships.iter().any(|r| {
                    r.effective
                        && (r.target_player_id == actor.id
                            || r.ability_use.owner_player_id == actor.id)
                });
            let end = if executed && good_twin {
                Some(crate::contracts::CustomGameEnd {
                    winning_alignment: crate::model::Alignment::Evil,
                    reason: crate::contracts::CustomGameEndReason::GoodTwinExecuted,
                    source_event_id: event_id.into(),
                })
            } else {
                None
            };
            return Ok((
                CustomActionResult::MutantExecution {
                    execute,
                    executed,
                    died,
                },
                CustomFactChanges::default()
                    .with_execution(
                        if died {
                            Some(crate::event::PlayerLifeChange {
                                player_id: actor.id.clone(),
                                alive: false,
                            })
                        } else {
                            None
                        },
                        end,
                    )
                    .with_audit(audit),
            ));
        }
        if self.character() == "evilTwin" && self.id() == "learnTwin" {
            if input.input.is_some() {
                return Err(invalid());
            }
            let source = occurrence
                .ability_use
                .as_ref()
                .ok_or_else(provenance_error)?;
            let relation = facts
                .twin_relationships
                .iter()
                .rev()
                .find(|r| r.ability_use == *source)
                .ok_or_else(invalid)?;
            return Ok((
                CustomActionResult::TwinInformed {
                    relationship_event_id: relation.source_event_id.clone(),
                    target_player_id: relation.target_player_id.clone(),
                    effective: effective(facts, source),
                },
                CustomFactChanges::default(),
            ));
        }
        let mut changes = SnvFactChanges::default();
        let mut audit = vec![];
        match self.character() {
            "philosopher" => {
                let Some(fields) = &input.input else {
                    return Ok((
                        if occurrence.simulation_source.is_some() {
                            CustomActionResult::SimulationChoice {
                                character_id: None,
                                spent: false,
                            }
                        } else {
                            CustomActionResult::PhilosopherDeferred
                        },
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
                if let Some(sim) = &occurrence.simulation_source {
                    let causes = if sim.source_ability_use.character_id == "drunk" {
                        vec![sim.source_ability_use.clone()]
                    } else {
                        impairment_causes(facts, &actor.id)
                    };
                    if !causes.is_empty() {
                        audit.push(MalfunctionEvidence {
                            daytime_step_id: None,
                            cause_details: vec![DeliveryReason::Drunk],
                            event_id: event_id.into(),
                            occurrence: occurrence.clone(),
                            subject_player_id: actor.id.clone(),
                            outcome: MalfunctionOutcome::EffectFailure {
                                effect: FailedEffect::PhilosopherAcquisition,
                            },
                            causes,
                        });
                    }
                    return Ok((
                        CustomActionResult::SimulationChoice {
                            character_id: Some(choices[0].clone()),
                            spent: true,
                        },
                        CustomFactChanges::default().with_audit(audit),
                    ));
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
                        audit.push(MalfunctionEvidence {
                            daytime_step_id: None,
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
                    CustomFactChanges::resolved(vec![], grants, changes).with_audit(audit),
                ))
            }
            "snakeCharmer" => {
                let target_id = one_player(&input.input)?;
                let target = facts
                    .player(target_id)
                    .filter(|p| p.alive)
                    .ok_or_else(invalid)?;
                if let Some(sim) = &occurrence.simulation_source {
                    let causes = if sim.source_ability_use.character_id == "drunk" {
                        vec![sim.source_ability_use.clone()]
                    } else {
                        impairment_causes(facts, &actor.id)
                    };
                    if definition.character_kind(&target.actual_character)
                        == Some(CharacterKind::Demon)
                        && !causes.is_empty()
                    {
                        audit.push(MalfunctionEvidence {
                            daytime_step_id: None,
                            event_id: event_id.into(),
                            occurrence: occurrence.clone(),
                            subject_player_id: actor.id.clone(),
                            outcome: MalfunctionOutcome::EffectFailure {
                                effect: FailedEffect::SnakeCharmerSwap,
                            },
                            causes,
                            cause_details: vec![DeliveryReason::Drunk],
                        });
                    }
                    return Ok((
                        CustomActionResult::Simulation {
                            information: None,
                            spent: false,
                        },
                        CustomFactChanges::default().with_audit(audit),
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
                        audit.push(MalfunctionEvidence {
                            daytime_step_id: None,
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
                    CustomFactChanges::resolved(identities, vec![], changes).with_audit(audit),
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
                        CustomActionResult::TwinAssigned {
                            target_player_id: target.id.clone(),
                        }
                    }
                    "witch" => {
                        let active = active && facts.players.iter().filter(|p| p.alive).count() > 3;
                        changes.witch_curse = Some(WitchCurse {
                            source_event_id: event_id.into(),
                            ability_use: source,
                            target_player_id: target.id.clone(),
                            day: u16::try_from(facts.night_number()).map_err(|_| invalid())?,
                            initially_effective: active,
                            effective: active,
                        });
                        CustomActionResult::Witch {
                            target_player_id: target.id.clone(),
                            day: u16::try_from(facts.night_number()).map_err(|_| invalid())?,
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
                            day: u16::try_from(facts.night_number()).map_err(|_| invalid())?,
                            initially_effective: active,
                            effective: active,
                        });
                        CustomActionResult::Cerenovus {
                            target_player_id: target.id.clone(),
                            character_id,
                            day: u16::try_from(facts.night_number()).map_err(|_| invalid())?,
                            effective: active,
                        }
                    }
                };
                Ok((result, {
                    let changes =
                        CustomFactChanges::resolved(vec![], vec![], changes).with_audit(audit);
                    if self.id() == "assignTwin" {
                        changes.with_preparation()
                    } else {
                        changes
                    }
                }))
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
impl ActionHandler for SnvHandler {
    fn pending_after_prerequisite(
        &self,
        context: &ActionContext<'_>,
        predecessor: &ActionOccurrence,
    ) -> Result<Option<PhaseStep>, CoreError> {
        if self.id() != "learnTwin" {
            return Ok(None);
        }
        let consumer = ActionOccurrence::character(
            self.action_ref.clone(),
            predecessor
                .ability_use
                .clone()
                .ok_or_else(provenance_error)?,
        )?;
        Ok(Some(self.step(context, &consumer)?))
    }

    fn dependency_event(
        &self,
        context: &ActionContext<'_>,
        occurrence: &ActionOccurrence,
    ) -> Result<Option<String>, CoreError> {
        if self.id() != "learnTwin" {
            return Ok(None);
        }
        let facts = context.rule_service.facts().ok_or_else(provenance_error)?;
        Ok(facts
            .twin_relationships
            .iter()
            .rev()
            .find(|r| Some(&r.ability_use) == occurrence.ability_use.as_ref())
            .map(|r| r.source_event_id.clone()))
    }

    fn required_occurrences(
        &self,
        c: &ActionContext<'_>,
        _: &crate::state::FirstNightProgress,
    ) -> Result<Vec<ActionOccurrence>, CoreError> {
        self.twin_candidates(c)
    }

    fn optional_occurrences(
        &self,
        c: &ActionContext<'_>,
        _: &crate::state::FirstNightProgress,
    ) -> Result<Vec<ActionOccurrence>, CoreError> {
        self.mutant_candidates(c)
    }
    fn follow_up_rule(&self) -> Option<&dyn crate::first_night::FollowUpRule> {
        None
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
        if self.character() == "mutant" {
            return self
                .mutant_candidates(context)?
                .iter()
                .map(|o| self.step(context, o))
                .collect();
        }
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
            action_cause: occurrence.action_cause.clone(),
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
            "clockmaker"
                | "dreamer"
                | "seamstress"
                | "mathematician"
                | "flowergirl"
                | "townCrier"
                | "oracle"
                | "juggler"
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
        occurrence: &ActionOccurrence,
        targets: &[String],
        judgments: &[RegistrationJudgment],
    ) -> Result<Vec<InformationResult>, CoreError> {
        let actor = occurrence.actor_player_id().ok_or_else(invalid)?;
        if matches!(self.character(), "flowergirl" | "townCrier") {
            return historical_day_truth(self.character(), definition, facts, judgments);
        }
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
            if j.scope.is_some() {
                return Err(invalid());
            }
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
                "seamstress" | "oracle" => {
                    if (self.character() == "seamstress" && !targets.contains(&j.player_id))
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
            "oracle" => Ok(vec![InformationResult::Number {
                value: facts
                    .players
                    .iter()
                    .enumerate()
                    .filter(|(i, p)| !p.alive && alignments[*i] == Alignment::Evil)
                    .count() as u64,
            }]),
            "juggler" => {
                let count = facts
                    .day
                    .as_ref()
                    .and_then(|d| {
                        d.ability_records.iter().rev().find_map(|r| match r.record {
                            crate::day::contracts::DayAbilityInput::Juggler { correct_count }
                                if r.action.actor_player_id == actor
                                    && r.action.ability_use == occurrence.ability_use
                                    && r.action.simulation_source
                                        == occurrence.simulation_source =>
                            {
                                Some(correct_count)
                            }
                            _ => None,
                        })
                    })
                    .ok_or_else(invalid)?;
                Ok(vec![InformationResult::Number {
                    value: u64::from(count),
                }])
            }
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
        let actual = self.truth(definition, facts, occurrence, targets, &[])?;
        let judged = self.truth(definition, facts, occurrence, targets, judgments)?;
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
        if let Some(sim) = &occurrence.simulation_source {
            if !reasons.contains(&DeliveryReason::Drunk) {
                reasons.push(DeliveryReason::Drunk);
            }
            if sim.source_ability_use.character_id == "drunk"
                && !causes.contains(&sim.source_ability_use)
            {
                causes.push(sim.source_ability_use.clone());
            }
        }
        let vortox_applies = !facts.vortox_sources.is_empty()
            && !occurrence
                .simulation_source
                .as_ref()
                .is_some_and(|s| s.source_ability_use.character_id == "drunk");
        for source in facts.vortox_sources.iter().filter(|_| vortox_applies) {
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
                let source = if matches!(self.character(), "flowergirl" | "townCrier") {
                    historical_day_participants(self.character(), facts)
                        .into_iter()
                        .filter(|p| p.player_id == j.player_id)
                        .find_map(super::trouble_brewing::historical_registration_source)
                } else {
                    registration_source(facts, &j.player_id)
                }
                .ok_or_else(invalid)?;
                if !causes.contains(&source) {
                    causes.push(source);
                }
            }
        }
        let mut allowed =
            if impaired(facts, actor) || occurrence.simulation_source.is_some() || vortox_applies {
                match self.character() {
                    "clockmaker" => (0..=(facts.players.len() / 2) as u64)
                        .map(|value| InformationResult::Number { value })
                        .collect(),
                    "mathematician" | "oracle" => (0..=facts.players.len() as u64)
                        .map(|value| InformationResult::Number { value })
                        .collect(),
                    "juggler" => (0..=5)
                        .map(|value| InformationResult::Number { value })
                        .collect(),
                    "seamstress" | "flowergirl" | "townCrier" => vec![
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
        if vortox_applies {
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
        let mut audit = vec![];
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
            audit.push(MalfunctionEvidence {
                daytime_step_id: None,
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
        Ok((
            result,
            CustomFactChanges::resolved(vec![], vec![], changes).with_audit(audit),
        ))
    }
    fn registration_variants(
        &self,
        definition: &ResolvedScriptContext,
        facts: &CustomGameFacts,
        targets: &[String],
    ) -> Vec<Vec<RegistrationJudgment>> {
        if matches!(self.character(), "flowergirl" | "townCrier") {
            return historical_day_variants(self.character(), definition, facts);
        }
        let mut variants = vec![vec![]];
        for player in &facts.players {
            let Some(source) = registration_source(facts, &player.id) else {
                continue;
            };
            if self.character() == "mathematician"
                || (!matches!(self.character(), "clockmaker" | "oracle")
                    && !targets.contains(&player.id))
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
                    "seamstress" | "oracle"
                        if matches!(value, RegistrationValue::Good | RegistrationValue::Evil) =>
                    {
                        options.push(RegistrationJudgment {
                            scope: None,
                            player_id: player.id.clone(),
                            registered_as: value,
                            character_id: None,
                        })
                    }
                    "clockmaker"
                        if !matches!(value, RegistrationValue::Good | RegistrationValue::Evil) =>
                    {
                        options.push(RegistrationJudgment {
                            scope: None,
                            player_id: player.id.clone(),
                            registered_as: value,
                            character_id: None,
                        })
                    }
                    "dreamer" => {
                        for id in definition.character_ids() {
                            let j = RegistrationJudgment {
                                scope: None,
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
                        if let InformationResult::Boolean { value } = value {
                            prompt
                                .boolean_choices
                                .push(crate::model::BooleanInformationChoice {
                                    value,
                                    is_computed,
                                    registration_judgments: judgments.clone(),
                                });
                        }
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
                let fixed_character_id = if self.character() == "dreamer" {
                    targets.first().and_then(|id| facts.players.iter().find(|p| &p.id == id))
                        .filter(|player| !choices.is_empty() && choices.iter().all(|choice|
                            matches!(&choice.result, InformationResult::CharacterPair { character_ids }
                                if character_ids.contains(&player.actual_character))))
                        .map(|player| player.actual_character.clone())
                } else {
                    None
                };
                prompt.target_checks.push(TargetInformationCheck {
                    fixed_character_id,
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
        let outcome = match &evidence.outcome {
            MalfunctionOutcome::DayInformation { truthful_count } => {
                AbnormalAbilityOutcome::DayInformation {
                    truthful_count: *truthful_count,
                }
            }
            MalfunctionOutcome::InvalidSavantPattern { truthful_count } => {
                AbnormalAbilityOutcome::InvalidSavantPattern {
                    truthful_count: *truthful_count,
                }
            }
            MalfunctionOutcome::IncorrectInformation { delivered_result } => {
                AbnormalAbilityOutcome::IncorrectInformation {
                    delivered_result: delivered_result.clone(),
                }
            }
            MalfunctionOutcome::EffectFailure { effect } => AbnormalAbilityOutcome::EffectFailure {
                effect: match effect {
                    FailedEffect::DemonDeath => AbnormalAbilityEffect::DemonDeath,
                    FailedEffect::PitHagCharacterChange => {
                        AbnormalAbilityEffect::PitHagCharacterChange
                    }
                    FailedEffect::WitchDeath => AbnormalAbilityEffect::WitchDeath,
                    FailedEffect::SweetheartDrunkenness => {
                        AbnormalAbilityEffect::SweetheartDrunkenness
                    }
                    FailedEffect::VortoxExecution => AbnormalAbilityEffect::VortoxExecution,
                    FailedEffect::PoisonerPoison => AbnormalAbilityEffect::PoisonerPoison,
                    FailedEffect::ButlerMaster => AbnormalAbilityEffect::ButlerMaster,
                    FailedEffect::MutantExecution => AbnormalAbilityEffect::MutantExecution,
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
            step_id: evidence
                .daytime_step_id
                .clone()
                .unwrap_or(evidence.occurrence.step_id()?),
            phase: if evidence.daytime_step_id.is_some() {
                Phase::Day
            } else if evidence.occurrence.night == 1 {
                Phase::FirstNight
            } else {
                Phase::Night
            },
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

fn mutant_check(
    facts: &CustomGameFacts,
    occurrence: &ActionOccurrence,
) -> Option<crate::model::MadnessCheckResult> {
    facts.confirmed_actions.iter().rev().find_map(|fact| {
        if fact.occurrence.ability_use != occurrence.ability_use {
            return None;
        }
        match &fact.result {
            CustomActionResult::MutantJudgment { result } => Some(*result),
            _ => None,
        }
    })
}

pub(crate) fn day_actions(facts: &CustomGameFacts) -> Vec<crate::day::contracts::DayAbilityAction> {
    crate::day::ability_actions(facts, &["artist", "savant", "juggler"])
}
pub(crate) fn day_use_ability(
    action: &crate::day::contracts::DayAbilityAction,
    input: &crate::day::contracts::DayAbilityInput,
) -> Result<(), CoreError> {
    use crate::day::contracts::DayAbilityInput;
    let text = |v: &str| v.trim() == v && v.chars().count() <= 500;
    let valid = match input {
        DayAbilityInput::Artist {
            question, truthful, ..
        } => {
            action.character_id == "artist"
                && text(question)
                && if action.vortox {
                    !*truthful
                } else {
                    action.impaired || *truthful
                }
        }
        DayAbilityInput::Savant { statements } => {
            action.character_id == "savant"
                && statements.iter().all(|s| text(&s.text))
                && if action.vortox {
                    statements.iter().all(|s| !s.truthful)
                } else {
                    action.impaired || statements.iter().filter(|s| s.truthful).count() == 1
                }
        }
        DayAbilityInput::Juggler { correct_count } => {
            action.character_id == "juggler" && *correct_count <= 5
        }
        _ => false,
    };
    if valid {
        Ok(())
    } else {
        Err(ErrorKind::InvalidDayActionRecord.into_error())
    }
}
pub(crate) fn day_witch(
    facts: &CustomGameFacts,
    day: &mut crate::day::contracts::DayProgress,
    nominator: &str,
    event_id: &str,
) -> Result<(), CoreError> {
    use crate::day::contracts::{DayDeathCause, DayStage};
    if let Some(curse) = facts
        .witch_curses
        .iter()
        .find(|c| c.target_player_id == nominator && u32::from(c.day) == day.day && c.effective)
    {
        crate::day::pending_death(
            day,
            nominator,
            DayDeathCause::Witch,
            Some(curse.ability_use.clone()),
            event_id,
            DayStage::Voting,
        )?;
    }
    Ok(())
}
pub(crate) fn day_madness(facts: &CustomGameFacts) -> Vec<crate::day::contracts::DayMadness> {
    use crate::day::contracts::{DayMadness, DayStage};
    let Some(day) = &facts.day else {
        return vec![];
    };
    let open = day.stage != DayStage::Night
        && day.pending_death.is_none()
        && day.pending_game_end.is_none()
        && facts.game_end.is_none()
        && !day
            .consequences
            .iter()
            .any(|c| !c.resolved && c.source.character_id != "barber");
    let executed = day
        .execution
        .as_ref()
        .is_some_and(|e| e.player_id.is_some());
    let mut items = vec![];
    for record in &facts.ability_provenance {
        let source = &record.ability_use;
        if source.character_id != "mutant"
            || !current_ability_instance(facts, source)
            || !facts
                .player(&source.owner_player_id)
                .is_some_and(|p| p.alive)
        {
            continue;
        }
        let id = format!("mutant:{}", serde_json::to_string(source).expect("source"));
        let violation = day
            .madness_checks
            .iter()
            .rev()
            .find(|(key, _)| key == &id)
            .map(|(_, v)| *v)
            .or_else(|| {
                facts.confirmed_actions.iter().rev().find_map(|a| {
                    if a.occurrence.ability_use.as_ref() == Some(source) {
                        match a.result {
                            CustomActionResult::MutantJudgment { result } => {
                                Some(result == crate::model::MadnessCheckResult::Violation)
                            }
                            _ => None,
                        }
                    } else {
                        None
                    }
                })
            });
        items.push(DayMadness {
            id,
            source: source.clone(),
            target_player_id: source.owner_player_id.clone(),
            character_id: None,
            effective: effective(facts, source),
            violation,
            can_check: open && violation != Some(true),
            can_execute: open && !executed && effective(facts, source),
        });
    }
    for assignment in &facts.madness_assignments {
        if u32::from(assignment.day) != day.day
            || !current_ability_instance(facts, &assignment.ability_use)
            || !facts
                .player(&assignment.target_player_id)
                .is_some_and(|p| p.alive)
        {
            continue;
        }
        let id = format!("cerenovus:{}", assignment.source_event_id);
        let violation = day
            .madness_checks
            .iter()
            .rev()
            .find(|(key, _)| key == &id)
            .map(|(_, v)| *v);
        items.push(DayMadness {
            id,
            source: assignment.ability_use.clone(),
            target_player_id: assignment.target_player_id.clone(),
            character_id: Some(assignment.character_id.clone()),
            effective: assignment.effective,
            violation,
            can_check: open && violation != Some(true),
            can_execute: open && !executed && assignment.effective,
        });
    }
    items
}
pub(crate) fn day_good_win_blocked(facts: &CustomGameFacts) -> bool {
    facts
        .twin_relationships
        .iter()
        .any(|r| r.effective && facts.player(&r.target_player_id).is_some_and(|p| p.alive))
}
pub(crate) fn day_execution_end(
    facts: &CustomGameFacts,
    target: &str,
    event_id: &str,
) -> Option<crate::contracts::CustomGameEnd> {
    if facts
        .player(target)
        .is_some_and(|p| p.alignment == crate::model::Alignment::Good)
        && facts.twin_relationships.iter().any(|r| {
            r.effective && (r.target_player_id == target || r.ability_use.owner_player_id == target)
        })
    {
        Some(crate::contracts::CustomGameEnd {
            winning_alignment: crate::model::Alignment::Evil,
            reason: crate::contracts::CustomGameEndReason::GoodTwinExecuted,
            source_event_id: event_id.into(),
        })
    } else {
        None
    }
}
pub(crate) fn day_no_execution(
    facts: &CustomGameFacts,
    event_id: &str,
) -> Option<crate::contracts::CustomGameEnd> {
    (!facts.vortox_sources.is_empty()).then(|| crate::contracts::CustomGameEnd {
        winning_alignment: crate::model::Alignment::Evil,
        reason: crate::contracts::CustomGameEndReason::VortoxNoExecution,
        source_event_id: event_id.into(),
    })
}
pub(crate) fn day_death_consequences(
    prior: &CustomGameFacts,
    day: &mut crate::day::contracts::DayProgress,
    player_id: &str,
    event_id: &str,
) {
    for r in &prior.ability_provenance {
        let source = &r.ability_use;
        if source.owner_player_id != player_id
            || !current_ability_instance(prior, source)
            || !["sweetheart", "klutz", "barber"].contains(&source.character_id.as_str())
        {
            continue;
        }
        day.consequences
            .push(crate::day::contracts::DayConsequence {
                id: format!(
                    "death:{}:{}",
                    event_id,
                    serde_json::to_string(source).expect("source")
                ),
                death_event_id: event_id.into(),
                source: source.clone(),
                impaired_at_death: impaired(prior, player_id),
                alignment_at_death: prior.player(player_id).expect("death player").alignment,
                resolved: false,
                target_player_id: None,
            });
    }
}
pub(crate) fn day_resolve_consequence(
    prior: &CustomGameFacts,
    next: &mut CustomGameFacts,
    day: &mut crate::day::contracts::DayProgress,
    id: &str,
    target: &Option<String>,
    event_id: &str,
) -> Result<(), CoreError> {
    use crate::{
        contracts::{CustomGameEnd, CustomGameEndReason},
        model::Alignment,
    };
    let c = day
        .consequences
        .iter_mut()
        .find(|c| c.id == id && !c.resolved && c.source.character_id != "barber")
        .ok_or_else(invalid)?;
    if c.impaired_at_death {
        if target.is_some() {
            return Err(invalid());
        }
    } else {
        let target = target
            .as_ref()
            .and_then(|id| prior.player(id))
            .ok_or_else(invalid)?;
        match c.source.character_id.as_str() {
            "sweetheart" => next.durable_impairments.push(DurableImpairment {
                source_ability_use: c.source.clone(),
                impairment: ActiveImpairment {
                    kind: ImpairmentKind::Drunk,
                    player_id: target.id.clone(),
                    source_event_id: event_id.into(),
                    source_character_id: "sweetheart".into(),
                    expires: ImpairmentExpiry::Never,
                },
            }),
            "klutz" => {
                if !target.alive {
                    return Err(invalid());
                }
                if target.alignment != Alignment::Good {
                    day.pending_game_end = Some(CustomGameEnd {
                        winning_alignment: if c.alignment_at_death == Alignment::Good {
                            Alignment::Evil
                        } else {
                            Alignment::Good
                        },
                        reason: CustomGameEndReason::KlutzChoice,
                        source_event_id: event_id.into(),
                    });
                }
            }
            _ => return Err(invalid()),
        }
    }
    c.resolved = true;
    c.target_player_id = target.clone();
    Ok(())
}

fn daytime_effect_in_lifetime(facts: &CustomGameFacts, day: u16) -> bool {
    facts.day.as_ref().is_none_or(|d| {
        if d.stage == crate::day::contracts::DayStage::Night {
            u32::from(day) > d.day
        } else {
            u32::from(day) == d.day
        }
    })
}

pub(crate) fn day_is_once(character: &str) -> bool {
    matches!(character, "artist" | "juggler")
}
pub(crate) fn day_repeats_daily(character: &str) -> bool {
    character == "savant"
}
pub(crate) fn day_first_day_only(character: &str) -> bool {
    character == "juggler"
}
pub(crate) fn day_has_pending_consequence(day: &crate::day::contracts::DayProgress) -> bool {
    day.consequences
        .iter()
        .any(|c| !c.resolved && c.source.character_id != "barber")
}
pub(crate) fn day_waits_for_win(day: &crate::day::contracts::DayProgress) -> bool {
    day.consequences
        .iter()
        .any(|c| !c.resolved && c.source.character_id == "klutz")
}

/// Retain event-time evidence for the following Mathematician wake. Guidance does not
/// invent a real Artist/Savant ability; its actual failed source is recorded separately.
pub(crate) fn day_record_malfunctions(
    prior: &CustomGameFacts,
    next: &mut CustomGameFacts,
    input: &crate::day::contracts::DayInput,
    event_id: &str,
) -> Result<(), CoreError> {
    use crate::day::contracts::{DayAbilityInput, DayInput};
    let mut failures = vec![];
    match input {
        DayInput::UseAbility { action_id, record } => {
            if let Some(action) = day_actions(prior).into_iter().find(|a| a.id == *action_id) {
                if let Some(source) = action.ability_use {
                    let outcome = match record {
                        DayAbilityInput::Artist {
                            truthful: false, ..
                        } => Some(MalfunctionOutcome::DayInformation { truthful_count: 0 }),
                        DayAbilityInput::Savant { statements } => {
                            let truthful_count =
                                statements.iter().filter(|s| s.truthful).count() as u8;
                            (truthful_count != 1).then_some(
                                MalfunctionOutcome::InvalidSavantPattern { truthful_count },
                            )
                        }
                        _ => None,
                    };
                    if let Some(outcome) = outcome {
                        failures.push((source, outcome, true));
                    }
                }
            }
        }
        DayInput::Nominate { nominator_id, .. } => {
            if prior.players.iter().filter(|p| p.alive).count() > 3 {
                for curse in &prior.witch_curses {
                    if curse.target_player_id == *nominator_id
                        && daytime_effect_in_lifetime(prior, curse.day)
                        && current_ability_instance(prior, &curse.ability_use)
                        && prior
                            .player(&curse.ability_use.owner_player_id)
                            .is_some_and(|p| p.alive)
                        && !curse.effective
                    {
                        failures.push((
                            curse.ability_use.clone(),
                            MalfunctionOutcome::EffectFailure {
                                effect: FailedEffect::WitchDeath,
                            },
                            false,
                        ));
                    }
                }
            }
        }
        DayInput::ConfirmDeath => {
            if let Some(death) = prior.day.as_ref().and_then(|d| d.pending_death.as_ref()) {
                for r in &prior.ability_provenance {
                    if r.ability_use.character_id == "sweetheart"
                        && r.ability_use.owner_player_id == death.player_id
                        && current_ability_instance(prior, &r.ability_use)
                        && impaired(prior, &death.player_id)
                    {
                        failures.push((
                            r.ability_use.clone(),
                            MalfunctionOutcome::EffectFailure {
                                effect: FailedEffect::SweetheartDrunkenness,
                            },
                            false,
                        ));
                    }
                }
            }
        }
        DayInput::ConfirmExecution {}
            if crate::day::view(prior).is_some_and(|d| d.execution_candidate_id.is_none()) =>
        {
            for r in &prior.ability_provenance {
                if r.ability_use.character_id == "vortox"
                    && current_ability_instance(prior, &r.ability_use)
                    && prior
                        .player(&r.ability_use.owner_player_id)
                        .is_some_and(|p| p.alive)
                    && impaired(prior, &r.ability_use.owner_player_id)
                {
                    failures.push((
                        r.ability_use.clone(),
                        MalfunctionOutcome::EffectFailure {
                            effect: FailedEffect::VortoxExecution,
                        },
                        false,
                    ));
                }
            }
        }
        _ => {}
    }
    for (source, outcome, information) in failures {
        let mut causes = impairment_causes(prior, &source.owner_player_id);
        let mut cause_details = impairment_details(prior, &source.owner_player_id);
        if information {
            for vortox in &prior.vortox_sources {
                if !causes.contains(vortox) {
                    causes.push(vortox.clone());
                }
                cause_details.push(DeliveryReason::Vortox {
                    demon_player_id: vortox.owner_player_id.clone(),
                });
            }
        }
        if causes.is_empty() {
            continue;
        }
        let occurrence = ActionOccurrence::from_parts(
            FirstNightActionRef::Character {
                character_id: source.character_id.clone(),
                action_id: "daytimeAbility".into(),
            },
            Some(source.clone()),
            None,
            None,
        )?;
        next.malfunction_audit.push(MalfunctionEvidence {
            daytime_step_id: Some(crate::day::step_id(prior)?),
            cause_details,
            event_id: event_id.into(),
            occurrence,
            subject_player_id: source.owner_player_id,
            outcome,
            causes,
        });
    }
    Ok(())
}

use crate::reminders::{ReminderContext, ReminderHandler};
pub(crate) fn reminder_handlers() -> Vec<ReminderHandler> {
    vec![
        ReminderHandler {
            character_id: "flowergirl",
            project: flowergirl_reminders,
        },
        ReminderHandler {
            character_id: "townCrier",
            project: town_crier_reminders,
        },
        ReminderHandler {
            character_id: "philosopher",
            project: philosopher_reminders,
        },
        ReminderHandler {
            character_id: "snakeCharmer",
            project: |c| c.impairments(),
        },
        ReminderHandler {
            character_id: "noDashii",
            project: |c| c.impairments(),
        },
        ReminderHandler {
            character_id: "vigormortis",
            project: vigor_reminders,
        },
        ReminderHandler {
            character_id: "sweetheart",
            project: |c| c.impairments(),
        },
        ReminderHandler {
            character_id: "witch",
            project: witch_reminders,
        },
        ReminderHandler {
            character_id: "cerenovus",
            project: cerenovus_reminders,
        },
        ReminderHandler {
            character_id: "evilTwin",
            project: twin_reminders,
        },
        ReminderHandler {
            character_id: "seamstress",
            project: |c| c.spent(),
        },
        ReminderHandler {
            character_id: "artist",
            project: |c| c.spent(),
        },
        ReminderHandler {
            character_id: "juggler",
            project: juggler_reminders,
        },
        ReminderHandler {
            character_id: "barber",
            project: barber_reminders,
        },
        ReminderHandler {
            character_id: "mathematician",
            project: mathematician_reminders,
        },
    ]
}
fn philosopher_reminders(c: &ReminderContext<'_>) -> Vec<crate::model::AutomaticReminder> {
    let mut reminders = c.impairments();
    reminders.extend(c.spent());
    for grant in &c.facts.ability_grants {
        if c.ability().is_some_and(|source| {
            source.owner_player_id == grant.owner_player_id
                && source.ability_instance_id == grant.source_ability_instance_id
        }) && !c
            .facts
            .players
            .iter()
            .any(|p| p.actual_character == grant.character_id)
        {
            let mut token = c.token(c.owner(), "isThePhilosopher", &grant.source_event_id);
            token.label = "철학자임".into();
            token.description = "철학자가 이 캐릭터의 능력을 가집니다.".into();
            reminders.push(token);
        }
    }
    reminders
}
fn reminder_day_in_lifetime(facts: &CustomGameFacts, day: u16) -> bool {
    facts.day.as_ref().is_none_or(|d| {
        if d.stage == crate::day::contracts::DayStage::Night {
            u32::from(day) > d.day
        } else {
            u32::from(day) == d.day
        }
    })
}
fn witch_reminders(c: &ReminderContext<'_>) -> Vec<crate::model::AutomaticReminder> {
    c.facts
        .witch_curses
        .iter()
        .filter(|r| c.matches_ability(&r.ability_use) && reminder_day_in_lifetime(c.facts, r.day))
        .map(|r| c.token(&r.target_player_id, "cursed", &r.source_event_id))
        .collect()
}
fn cerenovus_reminders(c: &ReminderContext<'_>) -> Vec<crate::model::AutomaticReminder> {
    c.facts
        .madness_assignments
        .iter()
        .filter(|r| c.matches_ability(&r.ability_use) && reminder_day_in_lifetime(c.facts, r.day))
        .map(|r| c.token(&r.target_player_id, "mad", &r.source_event_id))
        .collect()
}
fn twin_reminders(c: &ReminderContext<'_>) -> Vec<crate::model::AutomaticReminder> {
    c.facts
        .twin_relationships
        .iter()
        .filter(|r| c.matches_ability(&r.ability_use) && r.effective)
        .map(|r| c.token(&r.target_player_id, "twin", &r.source_event_id))
        .collect()
}
fn juggler_reminders(c: &ReminderContext<'_>) -> Vec<crate::model::AutomaticReminder> {
    if !c.living() {
        return vec![];
    }
    let Some(day) = &c.facts.day else {
        return vec![];
    };
    day.ability_records
        .iter()
        .filter_map(|r| {
            if !c.matches_parts(
                r.action.ability_use.as_ref(),
                r.action.simulation_source.as_ref(),
            ) {
                return None;
            }
            let crate::day::contracts::DayAbilityInput::Juggler { correct_count } = r.record else {
                return None;
            };
            let mut token = c.token(&r.action.actor_player_id, "correct", &r.event_id);
            token.label = "정답".into();
            token.description = "첫 낮 추측의 정답 수입니다.".into();
            token.count = Some(correct_count);
            Some(token)
        })
        .collect()
}
fn barber_reminders(c: &ReminderContext<'_>) -> Vec<crate::model::AutomaticReminder> {
    let Some(day) = &c.facts.day else {
        return vec![];
    };
    day.consequences
        .iter()
        .filter(|r| !r.resolved && c.matches_ability(&r.source))
        .map(|r| {
            let mut token = c.token(
                &r.source.owner_player_id,
                "haircutsTonight",
                &r.death_event_id,
            );
            token.label = "오늘 밤 이발".into();
            token.description = "오늘 밤 처리할 이발사 사망입니다.".into();
            token.inactive_reason = r.impaired_at_death.then(|| "사망 당시 취함·중독".into());
            token
        })
        .collect()
}
fn mathematician_reminders(c: &ReminderContext<'_>) -> Vec<crate::model::AutomaticReminder> {
    if !c.living() {
        return vec![];
    }
    let mut seen = std::collections::HashSet::new();
    c.facts
        .malfunction_audit
        .iter()
        .filter(|e| {
            c.facts
                .day
                .as_ref()
                .is_none_or(|day| day.history.iter().any(|h| h.event_id == e.event_id))
        })
        .filter(|e| seen.insert(&e.subject_player_id))
        .map(|e| {
            let mut token = c.token(&e.subject_player_id, "abnormal", &e.event_id);
            token.label = "비정상".into();
            token.description = "낮에 다른 능력의 영향으로 비정상 작동했습니다.".into();
            token
        })
        .collect()
}

fn flowergirl_reminders(c: &ReminderContext<'_>) -> Vec<crate::model::AutomaticReminder> {
    if !c.living() {
        return vec![];
    }
    let Some(day) = &c.facts.day else {
        return vec![];
    };
    let nomination = day.nominations.iter().find(|n| {
        n.voter_ids.as_ref().is_some_and(|ids| {
            n.vote_participants.as_ref().is_some_and(|players| {
                players
                    .iter()
                    .any(|p| ids.contains(&p.player_id) && p.character_kind == CharacterKind::Demon)
            })
        })
    });
    let mut token = c.token(
        c.owner(),
        if nomination.is_some() {
            "demonVoted"
        } else {
            "demonDidNotVote"
        },
        nomination
            .map(|n| n.event_id.as_str())
            .unwrap_or(&c.facts.prefix_event_id),
    );
    token.label = if nomination.is_some() {
        "악마 투표함"
    } else {
        "악마 투표 안 함"
    }
    .into();
    token.description = if nomination.is_some() {
        "오늘 악마가 처형 투표에 참여했습니다."
    } else {
        "오늘 악마가 처형 투표에 참여하지 않았습니다."
    }
    .into();
    vec![token]
}
fn town_crier_reminders(c: &ReminderContext<'_>) -> Vec<crate::model::AutomaticReminder> {
    if !c.living() {
        return vec![];
    }
    let Some(day) = &c.facts.day else {
        return vec![];
    };
    let nomination = day.nominations.iter().find(|n| {
        n.nomination_participants
            .iter()
            .any(|p| p.player_id == n.nominator_id && p.character_kind == CharacterKind::Minion)
    });
    let mut token = c.token(
        c.owner(),
        if nomination.is_some() {
            "minionNominated"
        } else {
            "minionDidNotNominate"
        },
        nomination
            .map(|n| n.event_id.as_str())
            .unwrap_or(&c.facts.prefix_event_id),
    );
    token.label = if nomination.is_some() {
        "하수인 지목함"
    } else {
        "하수인 지목 안 함"
    }
    .into();
    token.description = if nomination.is_some() {
        "오늘 하수인이 처형 지목에 나섰습니다."
    } else {
        "오늘 하수인이 처형 지목에 나서지 않았습니다."
    }
    .into();
    vec![token]
}

// Other-night actions use the same registry validation and reducer as first-night actions.
fn other_night_registrations() -> Vec<RegisteredAction> {
    [
        (
            "pitHag",
            "changeCharacter",
            RequiredInputKind::CharacterTransformation,
        ),
        ("pitHag", "chooseDeaths", RequiredInputKind::PlayerIds),
        ("fangGu", "attackPlayer", RequiredInputKind::PlayerIds),
        ("noDashii", "attackPlayer", RequiredInputKind::PlayerIds),
        ("vortox", "attackPlayer", RequiredInputKind::PlayerIds),
        ("vigormortis", "attackPlayer", RequiredInputKind::PlayerIds),
        ("vigormortis", "choosePoison", RequiredInputKind::PlayerIds),
        ("barber", "swapCharacters", RequiredInputKind::PlayerIds),
        ("sweetheart", "makeDrunk", RequiredInputKind::PlayerIds),
        ("sage", "learnDemon", RequiredInputKind::None),
    ]
    .into_iter()
    .map(|(character, id, kind)| {
        let action_ref = action(character, id);
        RegisteredAction {
            spec: ActionSpec {
                action_ref: action_ref.clone(),
                participates_in_first_night: false,
                required_input_kind: kind,
                support: PhaseStepSupport::Automated,
                prerequisites: vec![],
                continuation_sources: vec![
                    crate::first_night::execution::DependencySource::ImmediateOrigin,
                ],
            },
            handler: Box::new(SnvNightHandler { action_ref }),
        }
    })
    .collect()
}
struct SnvNightHandler {
    action_ref: FirstNightActionRef,
}
impl SnvNightHandler {
    fn character(&self) -> &str {
        match &self.action_ref {
            FirstNightActionRef::Character { character_id, .. } => character_id,
            _ => unreachable!(),
        }
    }
    fn id(&self) -> &str {
        match &self.action_ref {
            FirstNightActionRef::Character { action_id, .. } => action_id,
            _ => unreachable!(),
        }
    }
    fn occurrences(&self, facts: &CustomGameFacts) -> Result<Vec<ActionOccurrence>, CoreError> {
        if facts.night_number() == 1
            && !matches!(self.character(), "barber" | "sweetheart" | "sage")
        {
            return Ok(vec![]);
        }
        let mut result = vec![];
        if self.id() == "choosePoison" {
            for death in &facts.night_deaths {
                if !vigor_death_active(facts, death) {
                    continue;
                }
                let targets = vigor_targets(facts, &death.player.id);
                if !targets.is_empty()
                    && !vigor_choice(facts, &death.event_id)
                        .is_some_and(|id| targets.iter().any(|t| t == id))
                {
                    result.push(ActionOccurrence::from_all_parts(
                        self.action_ref.clone(),
                        death.source.ability_use.clone(),
                        None,
                        None,
                        Some(ActionCause::Effect {
                            trigger_event_id: facts.prefix_event_id.clone(),
                            effect_event_id: death.event_id.clone(),
                        }),
                    )?);
                }
            }
        } else if self.id() == "chooseDeaths" {
            for event in &facts.confirmed_actions {
                if event.occurrence.night == facts.night_number()
                    && matches!(
                        event.result,
                        CustomActionResult::PitHagChange {
                            created_demon: true,
                            ..
                        }
                    )
                {
                    result.push(ActionOccurrence::from_all_parts(
                        self.action_ref.clone(),
                        event.occurrence.ability_use.clone(),
                        None,
                        None,
                        Some(ActionCause::Effect {
                            trigger_event_id: event.event_id.clone(),
                            effect_event_id: event.event_id.clone(),
                        }),
                    )?);
                }
            }
        } else if matches!(self.character(), "barber" | "sweetheart" | "sage") {
            for death in facts
                .night_deaths
                .iter()
                .filter(|d| d.night == facts.night_number())
            {
                if self.character() == "sage"
                    && !matches!(&death.source.action_ref,FirstNightActionRef::Character {action_id,..} if action_id=="attackPlayer")
                {
                    continue;
                }
                for source in death
                    .abilities
                    .iter()
                    .filter(|a| a.character_id == self.character())
                {
                    result.push(ActionOccurrence::from_all_parts(
                        self.action_ref.clone(),
                        Some(source.clone()),
                        None,
                        None,
                        Some(ActionCause::Death {
                            death_event_id: death.event_id.clone(),
                        }),
                    )?);
                }
            }
            for death in facts
                .night_deaths
                .iter()
                .filter(|d| d.night == facts.night_number())
            {
                if self.character() == "sage"
                    && !matches!(&death.source.action_ref,FirstNightActionRef::Character {action_id,..} if action_id=="attackPlayer")
                {
                    continue;
                }
                for g in death
                    .guidance
                    .iter()
                    .filter(|g| g.character_id == self.character())
                {
                    result.push(ActionOccurrence::from_all_parts(
                        self.action_ref.clone(),
                        None,
                        Some(g.source.clone()),
                        None,
                        Some(ActionCause::Death {
                            death_event_id: death.event_id.clone(),
                        }),
                    )?);
                }
            }
            if self.character() == "barber" {
                if let Some(day) = &facts.day {
                    for c in &day.consequences {
                        if c.source.character_id == "barber" && !c.resolved {
                            result.push(ActionOccurrence::from_all_parts(
                                self.action_ref.clone(),
                                Some(c.source.clone()),
                                None,
                                None,
                                Some(ActionCause::Death {
                                    death_event_id: c.death_event_id.clone(),
                                }),
                            )?);
                        }
                    }
                }
            }
        } else {
            for record in &facts.ability_provenance {
                let source = &record.ability_use;
                if source.character_id == self.character()
                    && current_ability_instance(facts, source)
                    && facts
                        .player(&source.owner_player_id)
                        .is_some_and(|p| p.alive || vigor_can_act(facts, source))
                {
                    result.push(ActionOccurrence::character(
                        self.action_ref.clone(),
                        source.clone(),
                    )?);
                }
            }
        }
        result.retain(|o| {
            !facts
                .confirmed_actions
                .iter()
                .any(|e| e.occurrence == o.clone().in_night(facts.night_number()))
        });
        Ok(result)
    }
    fn death_effective(&self, facts: &CustomGameFacts, o: &ActionOccurrence) -> bool {
        let Some(ActionCause::Death { death_event_id }) = &o.action_cause else {
            return false;
        };
        facts
            .night_deaths
            .iter()
            .find(|d| d.event_id == *death_event_id)
            .is_some_and(|d| {
                o.ability_use
                    .as_ref()
                    .is_some_and(|a| d.effective_abilities.contains(a))
            })
            || facts.day.as_ref().is_some_and(|d| {
                d.consequences.iter().any(|c| {
                    c.death_event_id == *death_event_id
                        && Some(&c.source) == o.ability_use.as_ref()
                        && !c.impaired_at_death
                })
            })
    }
    fn step(&self, c: &ActionContext<'_>, o: &ActionOccurrence) -> Result<PhaseStep, CoreError> {
        let facts = c.rule_service.facts().ok_or_else(invalid)?;
        let definition = c.rule_service.definition().ok_or_else(invalid)?;
        let mut input = crate::input::required_none();
        if self.character() != "sage" {
            input.kind = if self.id() == "changeCharacter" {
                RequiredInputKind::CharacterTransformation
            } else {
                RequiredInputKind::PlayerIds
            };
            input.target = Some(InputTarget::Players);
            input.min_selections =
                Some(if matches!(self.id(), "chooseDeaths" | "swapCharacters") {
                    0
                } else {
                    1
                });
            input.max_selections = Some(if self.id() == "chooseDeaths" {
                facts.players.len() as u8
            } else if self.character() == "barber" {
                2
            } else {
                1
            });
            input.optional = self.character() == "barber";
            input.allowed_player_ids = Some(
                facts
                    .players
                    .iter()
                    .filter(|p| self.id() != "chooseDeaths" || p.alive)
                    .map(|p| p.id.clone())
                    .collect(),
            );
            if self.character() == "barber" {
                input.allowed_player_ids = Some(
                    facts
                        .players
                        .iter()
                        .filter(|p| {
                            definition.character_kind(&p.actual_character)
                                != Some(CharacterKind::Demon)
                        })
                        .map(|p| p.id.clone())
                        .collect(),
                );
                input.allowed_chooser_player_ids = Some(
                    facts
                        .players
                        .iter()
                        .filter(|p| {
                            p.alive
                                && definition.character_kind(&p.actual_character)
                                    == Some(CharacterKind::Demon)
                        })
                        .map(|p| p.id.clone())
                        .collect(),
                );
            }
            if self.id() == "choosePoison" {
                if let Some(ActionCause::Effect {
                    effect_event_id, ..
                }) = &o.action_cause
                {
                    if let Some(death) = facts
                        .night_deaths
                        .iter()
                        .find(|d| d.event_id == *effect_event_id)
                    {
                        input.allowed_player_ids = Some(vigor_targets(facts, &death.player.id));
                    }
                }
            }
            if self.id() == "changeCharacter" {
                input.allowed_character_ids = Some(
                    definition
                        .character_ids()
                        .into_iter()
                        .map(str::to_owned)
                        .collect(),
                );
            }
        }
        let mut step = crate::input::simple_step(
            Phase::FirstNight,
            "custom",
            "action",
            StepType::Character,
            input,
            false,
        );
        step.id = o.step_id()?;
        step.character = Some(self.character().into());
        step.player_id = o.actor_player_id().map(str::to_owned);
        step.ability_use = o.ability_use.clone();
        step.simulation_source = o.simulation_source.clone();
        step.action_cause = o.action_cause.clone();
        step.action_ref = Some(self.action_ref.clone());
        step.ability_origin = o
            .ability_use
            .as_ref()
            .and_then(|a| recorded_ability(facts, a))
            .map(|r| r.origin.clone());
        if self.character() == "sage" {
            let (choices, reasons) = self.sage_options(facts, definition, o);
            let computed = choices
                .iter()
                .find(|c| c.is_computed)
                .or(choices.first())
                .map(|c| c.result.clone());
            step.information_prompt = Some(InformationPrompt {
                computed_result: computed.clone(),
                delivery_mode: InformationDeliveryMode::Selectable,
                active_reasons: reasons,
                registration_candidate_player_ids: vec![],
                number_choices: vec![],
                number_constraint: None,
                boolean_choices: vec![],
                setup_info_registration_options: vec![],
                target_checks: computed
                    .map(|computed_result| {
                        vec![TargetInformationCheck {
                            fixed_character_id: None,
                            target_player_ids: vec![],
                            computed_result,
                            choices,
                        }]
                    })
                    .unwrap_or_default(),
                mathematician_audit: None,
            });
        }
        Ok(step)
    }
    fn sage_options(
        &self,
        facts: &CustomGameFacts,
        definition: &ResolvedScriptContext,
        o: &ActionOccurrence,
    ) -> (Vec<TargetInformationChoice>, Vec<DeliveryReason>) {
        let active = self.death_effective(facts, o);
        let vortox = !facts.vortox_sources.is_empty()
            && !o
                .simulation_source
                .as_ref()
                .is_some_and(|s| s.source_ability_use.character_id == "drunk");
        let mut reasons = vec![DeliveryReason::AbilityChoice];
        if !active {
            if let Some(ActionCause::Death { death_event_id }) = &o.action_cause {
                if let Some(d) = facts
                    .night_deaths
                    .iter()
                    .find(|d| d.event_id == *death_event_id)
                {
                    let mut view = facts.clone();
                    view.resolved_impairments = d.resolved_impairments.clone();
                    reasons.extend(impairment_details(&view, &d.player.id));
                }
            }
            if o.simulation_source.is_some()
                && !reasons.iter().any(|r| matches!(r, DeliveryReason::Drunk))
            {
                reasons.push(DeliveryReason::Drunk);
            }
        }
        if vortox {
            reasons.extend(facts.vortox_sources.iter().map(|s| DeliveryReason::Vortox {
                demon_player_id: s.owner_player_id.clone(),
            }));
        }
        let mut choices = vec![];
        for (i, a) in facts.players.iter().enumerate() {
            for b in facts.players.iter().skip(i + 1) {
                let truthful = [a, b].iter().any(|p| {
                    p.alive
                        && definition.character_kind(&p.actual_character)
                            == Some(CharacterKind::Demon)
                });
                if (!active || truthful) && !vortox || vortox && !truthful {
                    choices.push(TargetInformationChoice {
                        result: InformationResult::PlayerPair {
                            player_ids: vec![a.id.clone(), b.id.clone()],
                        },
                        is_computed: truthful,
                        registration_judgments: vec![],
                    });
                }
            }
        }
        (choices, reasons)
    }
    fn resolve(
        &self,
        c: &ActionContext<'_>,
        o: &ActionOccurrence,
        input: &ActionInput,
    ) -> Result<(CustomActionResult, CustomFactChanges), CoreError> {
        let facts = c.rule_service.facts().ok_or_else(invalid)?;
        let definition = c.rule_service.definition().ok_or_else(invalid)?;
        if !self.occurrences(facts)?.contains(&o.clone().in_night(1)) {
            return Err(provenance_error());
        }
        if self.character() == "sage" {
            if input.input.is_some() || !input.registration_judgments.is_empty() {
                return Err(invalid());
            }
            let delivered = input
                .delivered_result
                .as_ref()
                .ok_or_else(|| ErrorKind::MissingDeliveredInformation.into_error())?;
            let InformationResult::PlayerPair { player_ids } = delivered else {
                return Err(invalid());
            };
            if player_ids.len() != 2
                || player_ids[0] == player_ids[1]
                || player_ids.iter().any(|id| facts.player(id).is_none())
            {
                return Err(invalid());
            }
            let (choices, reasons) = self.sage_options(facts, definition, o);
            let selected = choices
                .iter()
                .find(|c| equivalent(&c.result, delivered))
                .ok_or_else(|| ErrorKind::InvalidDeliveredInformation.into_error())?;
            let information = crate::model::ConfirmedInformation {
                actor: Some(crate::model::InformationActor {
                    player_id: o.actor_player_id().ok_or_else(invalid)?.into(),
                    character_id: "sage".into(),
                }),
                target_player_ids: vec![],
                computed_result: selected.is_computed.then(|| delivered.clone()),
                delivered_result: delivered.clone(),
                delivery_context: crate::model::DeliveryContext::Discretionary { reasons },
            };
            return Ok((
                if o.simulation_source.is_some() {
                    CustomActionResult::Simulation {
                        information: Some(information),
                        spent: false,
                    }
                } else {
                    CustomActionResult::InformationDelivered {
                        information,
                        spent: false,
                    }
                },
                CustomFactChanges::default(),
            ));
        }
        if o.simulation_source.is_some() {
            let actor = o.actor_player_id().ok_or_else(invalid)?;
            if self.character() == "barber"
                && input.input.as_ref().is_none_or(|f| {
                    *f == StepInputFields::default()
                        || *f
                            == StepInputFields {
                                player_ids: Some(vec![]),
                                ..Default::default()
                            }
                })
                && input.delivered_result.is_none()
                && input.registration_judgments.is_empty()
            {
                return Ok((
                    CustomActionResult::Simulation {
                        information: None,
                        spent: false,
                    },
                    CustomFactChanges::default(),
                ));
            }
            let count = if self.character() == "barber" { 2 } else { 1 };
            let ids = crate::information::targets_with_policy(&input.input, count, actor, true)?;
            if input.delivered_result.is_some()
                || !input.registration_judgments.is_empty()
                || ids.iter().any(|id| facts.player(id).is_none())
            {
                return Err(invalid());
            }
            return Ok((
                CustomActionResult::Simulation {
                    information: None,
                    spent: false,
                },
                CustomFactChanges::default(),
            ));
        }
        let source = o.ability_use.as_ref().ok_or_else(provenance_error)?;
        if input.delivered_result.is_some() || !input.registration_judgments.is_empty() {
            return Err(invalid());
        }
        let fields = input.input.clone().unwrap_or_default();
        let targets = fields.player_ids.clone().unwrap_or_default();
        if targets
            .iter()
            .collect::<std::collections::HashSet<_>>()
            .len()
            != targets.len()
            || targets.iter().any(|id| facts.player(id).is_none())
        {
            return Err(invalid());
        }
        if self.id() == "changeCharacter" {
            let characters = fields
                .character_ids
                .clone()
                .filter(|ids| ids.len() == 1)
                .ok_or_else(invalid)?;
            let character = characters[0].clone();
            if targets.len() != 1
                || definition.character_kind(&character).is_none()
                || fields
                    != (StepInputFields {
                        player_ids: Some(targets.clone()),
                        character_ids: Some(characters),
                        ..Default::default()
                    })
            {
                return Err(invalid());
            }
            let target = facts.player(&targets[0]).unwrap();
            let changed = effective(facts, source)
                && !facts
                    .players
                    .iter()
                    .any(|p| p.actual_character == character);
            let created_demon = changed
                && definition.character_kind(&character) == Some(CharacterKind::Demon)
                && definition.character_kind(&target.actual_character)
                    != Some(CharacterKind::Demon);
            let changes = if changed {
                vec![night_identity(target, &character, target.alignment)]
            } else {
                vec![]
            };
            return Ok((
                CustomActionResult::PitHagChange {
                    target_player_id: target.id.clone(),
                    character_id: character,
                    changed,
                    created_demon,
                },
                CustomFactChanges::resolved(changes, vec![], Default::default()),
            ));
        }
        if self.id() == "chooseDeaths" {
            if fields
                != (StepInputFields {
                    player_ids: Some(targets.clone()),
                    ..Default::default()
                })
                || targets.iter().any(|id| !facts.player(id).unwrap().alive)
            {
                return Err(invalid());
            }
            return Ok((
                CustomActionResult::ArbitraryDeaths {
                    player_ids: targets.clone(),
                },
                CustomFactChanges::default().with_life_changes(
                    targets
                        .into_iter()
                        .map(|player_id| crate::event::PlayerLifeChange {
                            player_id,
                            alive: false,
                        })
                        .collect(),
                ),
            ));
        }
        if self.id() == "choosePoison" {
            let Some(ActionCause::Effect {
                effect_event_id, ..
            }) = &o.action_cause
            else {
                return Err(invalid());
            };
            let death = facts
                .night_deaths
                .iter()
                .find(|d| d.event_id == *effect_event_id)
                .ok_or_else(invalid)?;
            if fields
                != (StepInputFields {
                    player_ids: Some(targets.clone()),
                    ..Default::default()
                })
                || targets.len() != 1
                || !vigor_targets(facts, &death.player.id).contains(&targets[0])
            {
                return Err(invalid());
            }
            return Ok((
                CustomActionResult::VigormortisPoison {
                    death_event_id: death.event_id.clone(),
                    target_player_id: targets[0].clone(),
                },
                CustomFactChanges::default(),
            ));
        }
        if self.character() == "barber" {
            if fields
                != (StepInputFields {
                    player_ids: fields.player_ids.clone(),
                    chooser_player_id: fields.chooser_player_id.clone(),
                    ..Default::default()
                })
                || !matches!(targets.len(), 0 | 2)
            {
                return Err(invalid());
            }
            let active = self.death_effective(facts, o);
            if !targets.is_empty()
                && (!active
                    || !fields.chooser_player_id.as_ref().is_some_and(|id| {
                        facts.player(id).is_some_and(|p| {
                            p.alive
                                && definition.character_kind(&p.actual_character)
                                    == Some(CharacterKind::Demon)
                        })
                    }))
            {
                return Err(invalid());
            }
            if targets.iter().any(|id| {
                definition.character_kind(&facts.player(id).unwrap().actual_character)
                    == Some(CharacterKind::Demon)
            }) {
                return Err(invalid());
            }
            let changes = if targets.len() == 2 {
                let a = facts.player(&targets[0]).unwrap();
                let b = facts.player(&targets[1]).unwrap();
                if a.actual_character == b.actual_character {
                    vec![]
                } else {
                    vec![
                        night_identity(a, &b.actual_character, a.alignment),
                        night_identity(b, &a.actual_character, b.alignment),
                    ]
                }
            } else {
                vec![]
            };
            return Ok((
                CustomActionResult::BarberSwap {
                    player_ids: targets,
                    chooser_player_id: fields.chooser_player_id,
                    effective: active,
                },
                CustomFactChanges::resolved(changes, vec![], Default::default()),
            ));
        }
        if targets.len() != 1 {
            return Err(invalid());
        }
        let target = facts.player(&targets[0]).unwrap();
        if self.character() == "sweetheart" {
            if fields
                != (StepInputFields {
                    player_ids: Some(targets),
                    ..Default::default()
                })
            {
                return Err(invalid());
            }
            let active = self.death_effective(facts, o);
            let mut snv = SnvFactChanges::default();
            if active {
                snv.durable_impairments
                    .push(crate::state::DurableImpairment {
                        source_ability_use: source.clone(),
                        impairment: ActiveImpairment {
                            kind: ImpairmentKind::Drunk,
                            player_id: target.id.clone(),
                            source_event_id: c.event_id.into(),
                            source_character_id: "sweetheart".into(),
                            expires: ImpairmentExpiry::Never,
                        },
                    });
            }
            return Ok((
                CustomActionResult::SweetheartDrunk {
                    target_player_id: target.id.clone(),
                    effective: active,
                },
                CustomFactChanges::resolved(vec![], vec![], snv),
            ));
        }
        // Each demon owns its transformation/effect rules. TB owns Soldier, Monk and Mayor.
        if fields
            != (StepInputFields {
                player_ids: Some(targets),
                mayor_decision: fields.mayor_decision.clone(),
                ..Default::default()
            })
        {
            return Err(invalid());
        }
        let killed = super::trouble_brewing::demon_attack_target(
            facts,
            source,
            target,
            &fields.mayor_decision,
        )?;
        let mut dead = killed.filter(|_| !demon_deaths_arbitrary(facts));
        let mut identities = vec![];
        let mut snv = SnvFactChanges::default();
        if self.character() == "fangGu"
            && dead.is_some()
            && definition.character_kind(&target.actual_character) == Some(CharacterKind::Outsider)
            && !facts
                .ability_uses
                .iter()
                .any(|u| u.ability_use.character_id == "fangGu")
        {
            dead = Some(source.owner_player_id.clone());
            identities.push(night_identity(target, "fangGu", Alignment::Evil));
            snv.spent = Some(AbilityUseRecord {
                source_event_id: c.event_id.into(),
                ability_use: source.clone(),
            });
        }
        let changes = CustomFactChanges::resolved(identities.clone(), vec![], snv)
            .with_life_changes(
                dead.iter()
                    .map(|id| crate::event::PlayerLifeChange {
                        player_id: id.clone(),
                        alive: false,
                    })
                    .collect(),
            );
        Ok((
            CustomActionResult::NightAttack {
                target_player_id: target.id.clone(),
                died: dead.is_some(),
                killed_player_id: dead,
                identity_changes: identities,
            },
            changes,
        ))
    }
}
fn night_identity(
    player: &Player,
    character: &str,
    alignment: Alignment,
) -> PlayerIdentityTransition {
    PlayerIdentityTransition {
        player_id: player.id.clone(),
        before: IdentityState {
            actual_character: player.actual_character.clone(),
            shown_character: player.shown_character.clone(),
            alignment: player.alignment,
        },
        after: IdentityState {
            actual_character: character.into(),
            shown_character: character.into(),
            alignment,
        },
    }
}
pub(crate) fn demon_deaths_arbitrary(facts: &CustomGameFacts) -> bool {
    facts.confirmed_actions.iter().any(|a| {
        a.occurrence.night == facts.night_number()
            && matches!(
                a.result,
                CustomActionResult::PitHagChange {
                    created_demon: true,
                    ..
                }
            )
    })
}
impl crate::first_night::FollowUpRule for SnvNightHandler {
    fn candidates(
        &self,
        c: &crate::first_night::FollowUpContext<'_>,
    ) -> Result<Vec<ActionOccurrence>, CoreError> {
        if !matches!(
            self.id(),
            "choosePoison" | "chooseDeaths" | "swapCharacters" | "makeDrunk" | "learnDemon"
        ) {
            return Ok(vec![]);
        }
        if self.character() == "barber"
            && c.plan
                .0
                .iter()
                .position(|a| *a == self.action_ref)
                .is_some_and(|i| i >= c.cursor)
        {
            return Ok(vec![]);
        }
        Ok(self
            .occurrences(c.next_facts)?
            .into_iter()
            .filter(|o| match &o.action_cause {
                Some(ActionCause::Death { death_event_id }) => death_event_id == c.event.event_id(),
                Some(ActionCause::Effect {
                    trigger_event_id, ..
                }) => trigger_event_id == c.event.event_id(),
                _ => false,
            })
            .collect())
    }
}
impl ActionHandler for SnvNightHandler {
    fn action_ref(&self) -> &FirstNightActionRef {
        &self.action_ref
    }
    fn historical_source(&self, c: &ActionContext<'_>, o: &ActionOccurrence) -> bool {
        o.action_cause.is_some()
            && c.rule_service.facts().is_some_and(|f| {
                self.occurrences(f)
                    .is_ok_and(|os| os.contains(&o.clone().in_night(1)))
            })
    }
    fn follow_up_rule(&self) -> Option<&dyn crate::first_night::FollowUpRule> {
        Some(self)
    }
    fn project(&self, _: &ActionSpec, c: &ActionContext<'_>) -> Result<Vec<PhaseStep>, CoreError> {
        self.occurrences(c.rule_service.facts().ok_or_else(invalid)?)?
            .iter()
            .map(|o| self.step(c, o))
            .collect()
    }
    fn propose(
        &self,
        s: &ActionSpec,
        c: &ActionContext<'_>,
        o: &ActionOccurrence,
        input: &StepInput,
    ) -> Result<ActionEventDraft, CoreError> {
        self.propose_input(
            s,
            c,
            o,
            &ActionInput {
                input: input.clone(),
                delivered_result: None,
                registration_judgments: vec![],
            },
        )
    }
    fn propose_input(
        &self,
        _: &ActionSpec,
        c: &ActionContext<'_>,
        o: &ActionOccurrence,
        input: &ActionInput,
    ) -> Result<ActionEventDraft, CoreError> {
        let (result, _) = self.resolve(c, o, input)?;
        Ok(ActionEventDraft::Custom(CustomActionEventDraft {
            step_id: o.step_id()?,
            action_ref: o.action_ref.clone(),
            ability_use: o.ability_use.clone(),
            simulation_source: o.simulation_source.clone(),
            follow_up_cause: o.follow_up_cause.clone(),
            action_cause: o.action_cause.clone(),
            input: input.input.clone(),
            delivered_result: input.delivered_result.clone(),
            registration_judgments: input.registration_judgments.clone(),
            result,
        }))
    }
    fn validate_event(
        &self,
        s: &ActionSpec,
        c: &ActionContext<'_>,
        o: &ActionOccurrence,
        d: &ActionEventDraft,
    ) -> Result<CustomFactChanges, CoreError> {
        self.validate_event_with_id(s, c, o, d, c.event_id)
    }
    fn validate_event_with_id(
        &self,
        _: &ActionSpec,
        c: &ActionContext<'_>,
        o: &ActionOccurrence,
        d: &ActionEventDraft,
        _: &str,
    ) -> Result<CustomFactChanges, CoreError> {
        let ActionEventDraft::Custom(d) = d else {
            return Err(invalid());
        };
        let (result, changes) = self.resolve(
            c,
            o,
            &ActionInput {
                input: d.input.clone(),
                delivered_result: d.delivered_result.clone(),
                registration_judgments: d.registration_judgments.clone(),
            },
        )?;
        if d.result != result {
            return Err(invalid());
        }
        let facts = c.rule_service.facts().ok_or_else(invalid)?;
        let failed = match &result {
            CustomActionResult::NightAttack { died: false, .. }
                if !demon_deaths_arbitrary(facts) =>
            {
                Some(FailedEffect::DemonDeath)
            }
            CustomActionResult::PitHagChange {
                changed: false,
                character_id,
                ..
            } if !facts
                .players
                .iter()
                .any(|p| p.actual_character == *character_id) =>
            {
                Some(FailedEffect::PitHagCharacterChange)
            }
            CustomActionResult::SweetheartDrunk {
                effective: false, ..
            } => Some(FailedEffect::SweetheartDrunkenness),
            _ => None,
        };
        let mut audit = failed
            .map(|effect| night_impairment_failure(facts, o, c.event_id, effect))
            .unwrap_or_default();
        if self.character() == "sage" {
            let information = match &result {
                CustomActionResult::InformationDelivered { information, .. } => Some(information),
                CustomActionResult::Simulation { information, .. } => information.as_ref(),
                _ => None,
            };
            if let Some(information) = information {
                let definition = c.rule_service.definition().ok_or_else(invalid)?;
                let (choices, reasons) = self.sage_options(facts, definition, o);
                if choices.iter().any(|choice| {
                    !choice.is_computed && equivalent(&choice.result, &information.delivered_result)
                }) {
                    let actor = o.actor_player_id().ok_or_else(invalid)?;
                    let mut causes = vec![];
                    if let Some(ActionCause::Death { death_event_id }) = &o.action_cause {
                        if let Some(death) = facts
                            .night_deaths
                            .iter()
                            .find(|d| d.event_id == *death_event_id)
                        {
                            causes.extend(
                                death
                                    .resolved_impairments
                                    .iter()
                                    .filter(|e| e.impairment.player_id == actor)
                                    .map(|e| e.source_ability_use.clone()),
                            );
                        }
                    }
                    if !o
                        .simulation_source
                        .as_ref()
                        .is_some_and(|s| s.source_ability_use.character_id == "drunk")
                    {
                        causes.extend(facts.vortox_sources.iter().cloned());
                    }
                    if let Some(sim) = &o.simulation_source {
                        causes.push(sim.source_ability_use.clone());
                    }
                    causes.dedup();
                    if !causes.is_empty() {
                        audit.push(MalfunctionEvidence {
                            daytime_step_id: None,
                            cause_details: reasons
                                .into_iter()
                                .filter(|r| !matches!(r, DeliveryReason::AbilityChoice))
                                .collect(),
                            event_id: c.event_id.into(),
                            occurrence: o.clone(),
                            subject_player_id: actor.into(),
                            outcome: MalfunctionOutcome::IncorrectInformation {
                                delivered_result: information.delivered_result.clone(),
                            },
                            causes,
                        });
                    }
                }
            }
        }
        Ok(changes.with_audit(audit))
    }
}

fn vigor_death_active(facts: &CustomGameFacts, death: &crate::state::NightDeathRecord) -> bool {
    vigor_death_retained(facts, death)
        && death
            .source
            .ability_use
            .as_ref()
            .is_some_and(|s| !impaired(facts, &s.owner_player_id))
        && !impaired(facts, &death.player.id)
}
fn vigor_death_retained(facts: &CustomGameFacts, death: &crate::state::NightDeathRecord) -> bool {
    let Some(source) = &death.source.ability_use else {
        return false;
    };
    source.character_id == "vigormortis"
        && current_ability_instance(facts, source)
        && facts
            .player(&source.owner_player_id)
            .is_some_and(|p| p.alive)
        && facts
            .player(&death.player.id)
            .is_some_and(|p| !p.alive && is_minion(&p.actual_character))
        && is_minion(&death.player.actual_character)
}
fn is_minion(character: &str) -> bool {
    custom_registry_entries()
        .into_iter()
        .chain(super::trouble_brewing::custom_registry_entries())
        .any(|(id, kind)| id == character && kind == CharacterKind::Minion)
}
pub(crate) fn vigor_can_act(facts: &CustomGameFacts, source: &AbilityUseRef) -> bool {
    is_minion(&source.character_id)
        && facts
            .night_deaths
            .iter()
            .any(|d| d.player.id == source.owner_player_id && vigor_death_retained(facts, d))
}
pub(crate) fn vigor_retains(facts: &CustomGameFacts, source: &AbilityUseRef) -> bool {
    is_minion(&source.character_id)
        && facts
            .night_deaths
            .iter()
            .any(|d| d.player.id == source.owner_player_id && vigor_death_active(facts, d))
}
fn vigor_targets(facts: &CustomGameFacts, owner: &str) -> Vec<String> {
    let mut players = facts.players.iter().collect::<Vec<_>>();
    players.sort_by_key(|p| p.seat);
    let Some(index) = players.iter().position(|p| p.id == owner) else {
        return vec![];
    };
    let n = players.len();
    let mut result = vec![];
    for direction in [1, n - 1] {
        if let Some(target) = (1..n)
            .map(|distance| players[(index + direction * distance) % n])
            .find(|p| {
                custom_registry_entries()
                    .into_iter()
                    .chain(super::trouble_brewing::custom_registry_entries())
                    .any(|(id, kind)| id == p.actual_character && kind == CharacterKind::Townsfolk)
            })
        {
            if !result.contains(&target.id) {
                result.push(target.id.clone());
            }
        }
    }
    result
}
fn vigor_choice<'a>(facts: &'a CustomGameFacts, event_id: &str) -> Option<&'a str> {
    facts
        .confirmed_actions
        .iter()
        .rev()
        .find_map(|e| match &e.result {
            CustomActionResult::VigormortisPoison {
                death_event_id,
                target_player_id,
            } if death_event_id == event_id => Some(target_player_id.as_str()),
            _ => None,
        })
}

fn vigor_reminders(c: &ReminderContext<'_>) -> Vec<crate::model::AutomaticReminder> {
    let mut tokens = c.impairments();
    tokens.extend(
        c.facts
            .night_deaths
            .iter()
            .filter(|d| {
                d.source
                    .ability_use
                    .as_ref()
                    .is_some_and(|s| c.matches_ability(s))
                    && vigor_death_retained(c.facts, d)
            })
            .map(|d| {
                let mut token = c.token(&d.player.id, "hasAbility", &d.event_id);
                token.inactive_reason =
                    (!vigor_death_active(c.facts, d)).then(|| "능력 비활성".into());
                token
            }),
    );
    tokens
}

pub(crate) fn night_impairment_failure(
    facts: &CustomGameFacts,
    o: &ActionOccurrence,
    event_id: &str,
    effect: FailedEffect,
) -> Vec<MalfunctionEvidence> {
    let Some(actor) = o.actor_player_id() else {
        return vec![];
    };
    let mut frozen;
    let facts = if let Some(ActionCause::Death { death_event_id }) = &o.action_cause {
        if let Some(death) = facts
            .night_deaths
            .iter()
            .find(|d| d.event_id == *death_event_id)
        {
            frozen = facts.clone();
            frozen.resolved_impairments = death.resolved_impairments.clone();
            &frozen
        } else {
            facts
        }
    } else {
        facts
    };
    let causes = impairment_causes(facts, actor);
    if causes.is_empty() {
        return vec![];
    }
    vec![MalfunctionEvidence {
        daytime_step_id: None,
        cause_details: impairment_details(facts, actor),
        event_id: event_id.into(),
        occurrence: o.clone(),
        subject_player_id: actor.into(),
        outcome: MalfunctionOutcome::EffectFailure { effect },
        causes,
    }]
}

fn historical_day_participants<'a>(
    character: &str,
    facts: &'a CustomGameFacts,
) -> Vec<&'a crate::day::contracts::DayParticipant> {
    let Some(day) = &facts.day else {
        return vec![];
    };
    day.nominations
        .iter()
        .flat_map(|n| {
            if character == "flowergirl" {
                n.vote_participants
                    .iter()
                    .flatten()
                    .filter(|p| {
                        n.voter_ids
                            .as_ref()
                            .is_some_and(|ids| ids.contains(&p.player_id))
                    })
                    .collect::<Vec<_>>()
            } else {
                n.nomination_participants
                    .iter()
                    .filter(|p| p.player_id == n.nominator_id)
                    .collect()
            }
        })
        .collect()
}
fn historical_day_truth(
    character: &str,
    definition: &ResolvedScriptContext,
    facts: &CustomGameFacts,
    judgments: &[RegistrationJudgment],
) -> Result<Vec<InformationResult>, CoreError> {
    let participants = historical_day_participants(character, facts);
    for (i, j) in judgments.iter().enumerate() {
        if j.scope.is_some()
            || j.character_id.is_some()
            || judgments[..i].iter().any(|p| p.player_id == j.player_id)
            || !matches!(
                j.registered_as,
                RegistrationValue::Townsfolk
                    | RegistrationValue::Outsider
                    | RegistrationValue::Minion
                    | RegistrationValue::Demon
            )
            || !participants
                .iter()
                .filter(|p| p.player_id == j.player_id)
                .any(|p| {
                    super::trouble_brewing::historical_registration_source(p).is_some_and(|s| {
                        super::trouble_brewing::registration_allowed(&s.character_id, j, definition)
                    })
                })
        {
            return Err(invalid());
        }
    }
    let expected = if character == "flowergirl" {
        CharacterKind::Demon
    } else {
        CharacterKind::Minion
    };
    let found = participants.into_iter().any(|p| {
        let kind = judgments
            .iter()
            .find(|j| {
                j.player_id == p.player_id
                    && super::trouble_brewing::historical_registration_source(p).is_some_and(|s| {
                        super::trouble_brewing::registration_allowed(&s.character_id, j, definition)
                    })
            })
            .map(|j| match j.registered_as {
                RegistrationValue::Townsfolk => CharacterKind::Townsfolk,
                RegistrationValue::Outsider => CharacterKind::Outsider,
                RegistrationValue::Minion => CharacterKind::Minion,
                _ => CharacterKind::Demon,
            })
            .unwrap_or(p.character_kind);
        kind == expected
    });
    Ok(vec![InformationResult::Boolean { value: found }])
}
fn historical_day_variants(
    character: &str,
    definition: &ResolvedScriptContext,
    facts: &CustomGameFacts,
) -> Vec<Vec<RegistrationJudgment>> {
    let mut variants = vec![vec![]];
    let mut seen = std::collections::HashSet::new();
    for p in historical_day_participants(character, facts) {
        let Some(source) = super::trouble_brewing::historical_registration_source(p) else {
            continue;
        };
        if !seen.insert(p.player_id.clone()) {
            continue;
        }
        let original = variants.clone();
        for value in [
            RegistrationValue::Townsfolk,
            RegistrationValue::Outsider,
            RegistrationValue::Minion,
            RegistrationValue::Demon,
        ] {
            let j = RegistrationJudgment {
                scope: None,
                player_id: p.player_id.clone(),
                registered_as: value,
                character_id: None,
            };
            if super::trouble_brewing::registration_allowed(&source.character_id, &j, definition) {
                for v in &original {
                    let mut v = v.clone();
                    v.push(j.clone());
                    variants.push(v);
                }
            }
        }
    }
    variants
}

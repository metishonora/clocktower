//! Carousel policies. Common flow consumes typed projections, never Character names.
use crate::{effects::effective, state::CustomGameFacts};

pub(super) fn wakes_actor(action: &crate::contracts::FirstNightActionRef) -> bool {
    matches!(action, crate::contracts::FirstNightActionRef::Character {character_id, action_id}
        if matches!((character_id.as_str(),action_id.as_str()),
            ("preacher", "choosePlayer") | ("boffin", "grantAbility") |
            ("balloonist", "learnPlayer") | ("pixie", "learnTownsfolk") | ("nightwatchman", "choosePlayer")))
}

pub(super) fn custom_registry_entries() -> Vec<(&'static str, crate::model::CharacterKind)> {
    vec![
        ("preacher", crate::model::CharacterKind::Townsfolk),
        ("zealot", crate::model::CharacterKind::Outsider),
        ("nightwatchman", crate::model::CharacterKind::Townsfolk),
        ("pixie", crate::model::CharacterKind::Townsfolk),
        ("balloonist", crate::model::CharacterKind::Townsfolk),
        ("boffin", crate::model::CharacterKind::Minion),
        ("marionette", crate::model::CharacterKind::Minion),
    ]
}

use crate::{
    contracts::{AbilityUseRecord, CustomActionResult, FirstNightActionRef},
    error::{CoreError, ErrorKind},
    event::{CustomActionEventDraft, CustomFactChanges, PlayerNotification, SnvFactChanges},
    first_night::{
        ActionContext, ActionEventDraft, ActionHandler, ActionInput, ActionSpec, RegisteredAction,
    },
    model::{
        DeliveryReason, InformationDeliveryMode, InformationPrompt, InformationResult, InputTarget,
        Phase, PhaseStep, PhaseStepSupport, RequiredInputKind, StepInput, StepType,
        TargetInformationCheck, TargetInformationChoice,
    },
    state::{ActionOccurrence, FailedEffect, MalfunctionEvidence, MalfunctionOutcome},
};

fn invalid() -> CoreError {
    ErrorKind::InvalidStepInput.into_error()
}

#[derive(Debug, Clone)]
pub(crate) struct PreacherSelection {
    pub(crate) source: crate::model::AbilityUseRef,
    pub(crate) source_identity: crate::model::AbilityInstanceId,
    pub(crate) target: crate::model::AbilityUseRef,
    pub(crate) event_id: String,
}
pub(crate) fn apply_preacher(
    f: &mut CustomGameFacts,
    event: &crate::event::ValidatedCustomEvent,
) -> Result<(), CoreError> {
    if let CustomActionResult::PreacherSelected {
        target_player_id,
        effective: true,
    } = &event.payload().result
    {
        let source = event.occurrence()?.ability_use.ok_or_else(invalid)?;
        let source_identity = f
            .player(&source.owner_player_id)
            .ok_or_else(invalid)?
            .ability_instance
            .id
            .clone();
        let target = identity_ability(f.player(target_player_id).ok_or_else(invalid)?);
        if !f
            .preacher_selections
            .iter()
            .any(|s| s.source == source && s.target == target)
        {
            f.preacher_selections.push(PreacherSelection {
                source,
                source_identity,
                target,
                event_id: event.id().into(),
            });
        }
    }
    Ok(())
}
pub(crate) fn expire_preacher(f: &mut CustomGameFacts) {
    let keep = f
        .preacher_selections
        .iter()
        .map(|s| {
            crate::reducer::current_ability_instance(f, &s.source)
                && f.player(&s.source.owner_player_id)
                    .is_some_and(|p| p.alive && p.ability_instance.id == s.source_identity)
                && f.player(&s.target.owner_player_id)
                    .is_some_and(|p| p.ability_instance.id == s.target.ability_instance_id)
        })
        .collect::<Vec<_>>();
    let mut i = 0;
    f.preacher_selections.retain(|_| {
        let k = keep[i];
        i += 1;
        k
    });
}
/// Suppression is not impairment, and does not destroy ownership/spent-use history.
pub(crate) fn preacher_suppressed(
    f: &CustomGameFacts,
    ability: &crate::model::AbilityUseRef,
) -> bool {
    f.preacher_selections.iter().any(|s| {
        s.target.owner_player_id == ability.owner_player_id
            && f.player(&s.target.owner_player_id)
                .is_some_and(|p| p.ability_instance.id == s.target.ability_instance_id)
            && crate::reducer::current_ability_instance(f, &s.source)
            && f.player(&s.source.owner_player_id)
                .is_some_and(|p| p.alive && p.ability_instance.id == s.source_identity)
            && !crate::effects::ability_impaired(f, &s.source)
            && grant_enabled(f, &s.source)
    })
}

struct Preacher {
    action_ref: FirstNightActionRef,
}
impl Preacher {
    fn occurrences(&self, c: &ActionContext<'_>) -> Result<Vec<ActionOccurrence>, CoreError> {
        let f = facts(c)?;
        let mut os = c
            .rule_service
            .try_owned_instances(&self.action_ref)?
            .into_iter()
            .map(|i| ActionOccurrence::character(self.action_ref.clone(), i.ability_use))
            .collect::<Result<Vec<_>, _>>()?;
        os.extend(c.rule_service.simulation_occurrences(&self.action_ref)?);
        os.retain(|o| {
            o.actor_player_id()
                .and_then(|id| f.player(id))
                .is_some_and(|p| p.alive)
        });
        Ok(os)
    }
    fn variants(
        &self,
        c: &ActionContext<'_>,
        target: &str,
    ) -> Result<Vec<Vec<crate::model::RegistrationJudgment>>, CoreError> {
        let f = facts(c)?;
        let d = c.rule_service.definition().ok_or_else(invalid)?;
        let mut variants = vec![vec![]];
        for value in [
            crate::model::RegistrationValue::Minion,
            crate::model::RegistrationValue::Townsfolk,
        ] {
            let js = vec![crate::model::RegistrationJudgment {
                scope: None,
                player_id: target.into(),
                registered_as: value,
                character_id: None,
            }];
            if super::registered_identity(d, f, target, &js).is_ok() {
                variants.push(js);
            }
        }
        Ok(variants)
    }
    fn step(&self, c: &ActionContext<'_>, o: &ActionOccurrence) -> Result<PhaseStep, CoreError> {
        let f = facts(c)?;
        let d = c.rule_service.definition().ok_or_else(invalid)?;
        let mut step = base_step(c, o, "preacher")?;
        step.required_input.kind = RequiredInputKind::PlayerIds;
        step.required_input.target = Some(InputTarget::Player);
        step.required_input.min_selections = Some(1);
        step.required_input.max_selections = Some(1);
        step.required_input.allowed_player_ids =
            Some(f.players.iter().map(|p| p.id.clone()).collect());
        let mut checks = vec![];
        for p in &f.players {
            let truth = InformationResult::Boolean {
                value: d.character_kind(&p.actual_character)
                    == Some(crate::model::CharacterKind::Minion),
            };
            let choices = self
                .variants(c, &p.id)?
                .into_iter()
                .map(|js| {
                    let value = super::registered_identity(d, f, &p.id, &js)?.1
                        == crate::model::CharacterKind::Minion;
                    Ok(TargetInformationChoice {
                        result: InformationResult::Boolean { value },
                        is_computed: js.is_empty(),
                        registration_judgments: js,
                    })
                })
                .collect::<Result<Vec<_>, CoreError>>()?;
            checks.push(TargetInformationCheck {
                number_constraint: None,
                wake_audit: vec![],
                fixed_character_id: None,
                target_player_ids: vec![p.id.clone()],
                computed_result: truth,
                choices,
            });
        }
        step.information_prompt = Some(InformationPrompt {
            computed_result: None,
            delivery_mode: InformationDeliveryMode::Selectable,
            active_reasons: vec![],
            registration_candidate_player_ids: vec![],
            number_choices: vec![],
            number_constraint: None,
            boolean_choices: vec![],
            setup_info_registration_options: vec![],
            target_checks: checks,
            mathematician_audit: None,
        });
        Ok(step)
    }
    fn resolve(
        &self,
        c: &ActionContext<'_>,
        o: &ActionOccurrence,
        input: &ActionInput,
        event: &str,
    ) -> Result<(CustomActionResult, CustomFactChanges), CoreError> {
        if !self.occurrences(c)?.contains(&o.clone().in_night(1)) {
            return Err(invalid());
        }
        let f = facts(c)?;
        let d = c.rule_service.definition().ok_or_else(invalid)?;
        let targets = crate::information::targets_with_policy(
            &input.input,
            1,
            o.actor_player_id().ok_or_else(invalid)?,
            true,
        )?;
        let target = f.player(&targets[0]).ok_or_else(invalid)?;
        if !self
            .variants(c, &target.id)?
            .contains(&input.registration_judgments)
        {
            return Err(invalid());
        }
        let minion = super::registered_identity(d, f, &target.id, &input.registration_judgments)?.1
            == crate::model::CharacterKind::Minion;
        if input
            .delivered_result
            .as_ref()
            .is_some_and(|r| *r != InformationResult::Boolean { value: minion })
        {
            return Err(invalid());
        }
        let works = o.ability_use.as_ref().is_some_and(|s| effective(f, s));
        let affected =
            minion && !crate::jinxes::production()?.immune_to("preacher", &target.actual_character);
        let notifications = if works && affected {
            vec![PlayerNotification::Preacher {
                recipient_id: target.id.clone(),
            }]
        } else {
            vec![]
        };
        let audit = if affected && !works {
            super::sects_and_violets::night_impairment_failure(
                f,
                o,
                event,
                FailedEffect::PreacherSuppression,
            )
        } else {
            vec![]
        };
        Ok((
            if o.simulation_source.is_some() {
                CustomActionResult::Simulation {
                    information: None,
                    spent: false,
                }
            } else {
                CustomActionResult::PreacherSelected {
                    target_player_id: target.id.clone(),
                    effective: works && affected,
                }
            },
            CustomFactChanges::default()
                .with_player_notifications(notifications)
                .with_audit(audit),
        ))
    }
}
fn preacher_registration() -> RegisteredAction {
    let action_ref = FirstNightActionRef::Character {
        character_id: "preacher".into(),
        action_id: "choosePlayer".into(),
    };
    RegisteredAction {
        spec: ActionSpec {
            action_ref: action_ref.clone(),
            prerequisites: vec![],
            continuation_sources: vec![
                crate::first_night::execution::DependencySource::ImmediateOrigin,
            ],
            participates_in_first_night: true,
            required_input_kind: RequiredInputKind::PlayerIds,
            support: PhaseStepSupport::Automated,
        },
        handler: Box::new(Preacher { action_ref }),
    }
}
impl ActionHandler for Preacher {
    fn action_ref(&self) -> &FirstNightActionRef {
        &self.action_ref
    }
    fn project(&self, _: &ActionSpec, c: &ActionContext<'_>) -> Result<Vec<PhaseStep>, CoreError> {
        self.occurrences(c)?
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
        let (result, _) = self.resolve(c, o, input, c.event_id)?;
        Ok(ActionEventDraft::Custom(CustomActionEventDraft {
            step_id: o.step_id()?,
            action_ref: self.action_ref.clone(),
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
        draft: &ActionEventDraft,
    ) -> Result<CustomFactChanges, CoreError> {
        self.validate_event_with_id(s, c, o, draft, c.event_id)
    }
    fn validate_event_with_id(
        &self,
        _: &ActionSpec,
        c: &ActionContext<'_>,
        o: &ActionOccurrence,
        draft: &ActionEventDraft,
        event: &str,
    ) -> Result<CustomFactChanges, CoreError> {
        let ActionEventDraft::Custom(d) = draft else {
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
            event,
        )?;
        if result != d.result {
            return Err(invalid());
        }
        Ok(changes)
    }
}

pub(crate) fn receives_minion_information(character: &str) -> bool {
    character != "marionette"
}
pub(crate) fn needs_apparent_identity(actual: &str, shown: &str) -> bool {
    actual == "marionette" && shown == "marionette"
}
pub(crate) fn normalize_marionette(
    d: &super::ResolvedScriptContext,
    p: &crate::contracts::SetupPlayerInput,
) -> Option<Result<crate::contracts::SetupPlayerInput, CoreError>> {
    if p.actual_character != "marionette" {
        return None;
    }
    Some((|| {
        let shown = p.shown_character.as_deref().ok_or_else(invalid)?;
        if !d
            .character_kind(shown)
            .is_some_and(|k| k.alignment() == crate::model::Alignment::Good)
        {
            return Err(invalid());
        }
        let mut p = p.clone();
        p.id = Some(p.id.unwrap_or_else(|| format!("player-{}", p.seat)));
        p.name = p.name.trim().into();
        Ok(p)
    })())
}
pub(crate) fn setup_adjacencies(
    context: &super::ResolvedScriptContext,
    characters: &[String],
) -> Vec<[String; 2]> {
    if !characters.iter().any(|id| id == "marionette") {
        return vec![];
    }
    characters
        .iter()
        .find(|id| context.character_kind(id) == Some(crate::model::CharacterKind::Demon))
        .map(|demon| vec![["marionette".into(), demon.clone()]])
        .unwrap_or_default()
}

pub(crate) fn validate_marionette_setup(
    d: &super::ResolvedScriptContext,
    players: &[crate::contracts::SetupPlayerInput],
) -> Result<(), CoreError> {
    for p in players
        .iter()
        .filter(|p| p.actual_character == "marionette")
    {
        normalize_marionette(d, p).ok_or_else(invalid)??;
        if !players.iter().any(|other| {
            d.character_kind(&other.actual_character) == Some(crate::model::CharacterKind::Demon)
                && (p.seat.abs_diff(other.seat) == 1
                    || usize::from(p.seat.abs_diff(other.seat)) == players.len() - 1)
        }) {
            return Err(ErrorKind::InvalidMarionetteSeating.into_error());
        }
    }
    Ok(())
}
pub(crate) fn marionette_identities(f: &CustomGameFacts) -> Vec<crate::contracts::RevealIdentity> {
    let mut ps = f
        .players
        .iter()
        .filter(|p| p.actual_character == "marionette")
        .map(|p| crate::contracts::RevealIdentity {
            seat: p.seat,
            name: p.name.clone(),
        })
        .collect::<Vec<_>>();
    ps.sort_by_key(|p| p.seat);
    ps
}
pub(crate) fn marionette_guidance(f: &CustomGameFacts) -> Vec<crate::simulation::Guidance> {
    f.players
        .iter()
        .filter(|p| {
            p.alive && p.actual_character == "marionette" && p.shown_character != "marionette"
        })
        .map(|p| crate::simulation::Guidance {
            source: crate::contracts::PhilosopherSimulationSource {
                selection_event_id: p.ability_instance.source_event_id.clone(),
                source_ability_use: identity_ability(p),
                guidance: Some(crate::contracts::GuidanceCause::Marionette),
            },
            character_id: p.shown_character.clone(),
        })
        .collect()
}
pub(crate) fn apply_marionette(
    f: &mut CustomGameFacts,
    event: &crate::event::ValidatedCustomEvent,
) -> Result<(), CoreError> {
    if let CustomActionResult::MarionetteShown { character_id } = &event.payload().result {
        let source = event.occurrence()?.ability_use.ok_or_else(invalid)?;
        let p = f
            .players
            .iter_mut()
            .find(|p| p.id == source.owner_player_id)
            .ok_or_else(invalid)?;
        p.shown_character = character_id.clone();
    }
    Ok(())
}
pub(crate) fn notify_new_demons(
    d: &super::ResolvedScriptContext,
    before: &CustomGameFacts,
    after: &mut CustomGameFacts,
    event: &str,
) {
    let demons = after
        .players
        .iter()
        .filter(|p| {
            p.alive
                && d.character_kind(&p.actual_character) == Some(crate::model::CharacterKind::Demon)
                && before
                    .player(&p.id)
                    .is_some_and(|old| old.ability_instance.id != p.ability_instance.id)
        })
        .cloned()
        .collect::<Vec<_>>();
    let marionettes = after
        .players
        .iter()
        .filter(|p| p.actual_character == "marionette" && p.shown_character != "marionette")
        .cloned()
        .collect::<Vec<_>>();
    for demon in demons {
        for marionette in &marionettes {
            let sequence = after
                .pending_identity_reveals
                .iter()
                .filter(|r| r.source_event_id == event)
                .map(|r| r.sequence)
                .max()
                .map_or(0, |n| n + 1);
            after
                .pending_identity_reveals
                .push(crate::contracts::PendingIdentityReveal {
                    delivery_event_id: None,
                    source_event_id: event.into(),
                    sequence,
                    payload: crate::contracts::RevealPayload::MarionetteInformation {
                        kind: "marionetteInformation",
                        recipient_player: crate::contracts::RevealPlayer {
                            player_id: demon.id.clone(),
                            seat: demon.seat,
                            name: demon.name.clone(),
                        },
                        marionette_player: crate::contracts::RevealPlayer {
                            player_id: marionette.id.clone(),
                            seat: marionette.seat,
                            name: marionette.name.clone(),
                        },
                    },
                });
        }
    }
}
struct Marionette {
    action_ref: FirstNightActionRef,
}
impl Marionette {
    fn candidates(&self, c: &ActionContext<'_>) -> Result<Vec<ActionOccurrence>, CoreError> {
        let f = facts(c)?;
        c.rule_service
            .try_owned_instances(&self.action_ref)?
            .into_iter()
            .filter(|i| {
                f.player(&i.ability_use.owner_player_id).is_some_and(|p| {
                    needs_apparent_identity(&p.actual_character, &p.shown_character)
                })
            })
            .map(|i| {
                let mut o = ActionOccurrence::character(self.action_ref.clone(), i.ability_use)?;
                o.action_cause = Some(crate::contracts::ActionCause::InitialPreparation {
                    source_event_id: f.prefix_event_id.clone(),
                });
                Ok(o)
            })
            .collect()
    }
    fn resolve(
        &self,
        c: &ActionContext<'_>,
        o: &ActionOccurrence,
        input: &ActionInput,
    ) -> Result<(CustomActionResult, CustomFactChanges), CoreError> {
        if !self.candidates(c)?.iter().any(|a| same_source(a, o))
            || input.delivered_result.is_some()
            || !input.registration_judgments.is_empty()
        {
            return Err(invalid());
        }
        let f = facts(c)?;
        let d = c.rule_service.definition().ok_or_else(invalid)?;
        let fields = input.input.as_ref().ok_or_else(invalid)?;
        let chars = fields.character_ids.as_ref().ok_or_else(invalid)?;
        if chars.len() != 1
            || !d
                .character_kind(&chars[0])
                .is_some_and(|k| k.alignment() == crate::model::Alignment::Good)
            || *fields
                != (crate::model::StepInputFields {
                    character_ids: Some(chars.clone()),
                    ..Default::default()
                })
        {
            return Err(invalid());
        }
        let actor = o.actor_player_id().ok_or_else(invalid)?;
        let mut notices = vec![PlayerNotification::ApparentIdentity {
            recipient_id: actor.into(),
            character_id: chars[0].clone(),
            alignment: crate::model::Alignment::Good,
        }];
        notices.extend(
            f.players
                .iter()
                .filter(|p| {
                    p.alive
                        && d.character_kind(&p.actual_character)
                            == Some(crate::model::CharacterKind::Demon)
                })
                .map(|p| PlayerNotification::Marionette {
                    recipient_id: p.id.clone(),
                    marionette_id: actor.into(),
                }),
        );
        Ok((
            CustomActionResult::MarionetteShown {
                character_id: chars[0].clone(),
            },
            CustomFactChanges::default().with_player_notifications(notices),
        ))
    }
}
impl ActionHandler for Marionette {
    fn action_ref(&self) -> &FirstNightActionRef {
        &self.action_ref
    }
    fn required_occurrences(
        &self,
        c: &ActionContext<'_>,
        _: &crate::state::FirstNightProgress,
    ) -> Result<Vec<ActionOccurrence>, CoreError> {
        self.candidates(c)
    }
    fn project(&self, _: &ActionSpec, c: &ActionContext<'_>) -> Result<Vec<PhaseStep>, CoreError> {
        let d = c.rule_service.definition().ok_or_else(invalid)?;
        self.candidates(c)?
            .iter()
            .map(|o| {
                let mut s = base_step(c, o, "marionette")?;
                s.required_input = crate::input::required_characters(
                    1,
                    1,
                    Some(
                        d.character_ids()
                            .into_iter()
                            .filter(|id| {
                                d.character_kind(id)
                                    .is_some_and(|k| k.alignment() == crate::model::Alignment::Good)
                            })
                            .map(str::to_owned)
                            .collect(),
                    ),
                    false,
                );
                Ok(s)
            })
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
        Ok(ActionEventDraft::Custom(CustomActionEventDraft {
            step_id: o.step_id()?,
            action_ref: self.action_ref.clone(),
            ability_use: o.ability_use.clone(),
            simulation_source: None,
            follow_up_cause: o.follow_up_cause.clone(),
            action_cause: o.action_cause.clone(),
            input: input.input.clone(),
            delivered_result: None,
            registration_judgments: vec![],
            result: self.resolve(c, o, input)?.0,
        }))
    }
    fn validate_event(
        &self,
        _: &ActionSpec,
        c: &ActionContext<'_>,
        o: &ActionOccurrence,
        d: &ActionEventDraft,
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
        if result != d.result {
            return Err(invalid());
        }
        Ok(changes)
    }
}

#[derive(Debug, Clone)]
pub(crate) struct BoffinAssignment {
    pub(crate) source: crate::model::AbilityUseRef,
    pub(crate) demon: crate::model::AbilityUseRef,
    pub(crate) character_id: String,
    pub(crate) event_id: String,
    pub(crate) informed: bool,
}
pub(crate) fn jinx_registrations() -> Vec<crate::jinxes::RegisteredJinx> {
    vec![
        crate::jinxes::RegisteredJinx {
            id: "balloonist--marionette",
            characters: ["balloonist", "marionette"],
            evidence: &["issue237_marionette_balloonist_setup"],
            rules: vec![crate::jinxes::Rule::ShownSetupAbility(|actual, shown| {
                (actual == "marionette" && shown == "balloonist").then_some("balloonist")
            })],
        },
        crate::jinxes::RegisteredJinx {
            id: "marionette--mathematician",
            characters: ["marionette", "mathematician"],
            evidence: &["issue237_marionette_mathematician"],
            rules: vec![crate::jinxes::Rule::SimulationCause(|o| {
                o.simulation_source
                    .as_ref()
                    .filter(|s| s.source_ability_use.character_id == "marionette")
                    .map(|s| s.source_ability_use.clone())
            })],
        },
        crate::jinxes::RegisteredJinx {
            id: "boffin--drunk",
            characters: ["boffin", "drunk"],
            evidence: &["issue237_boffin_excludes_drunk"],
            rules: vec![crate::jinxes::Rule::ForbidGrantedAbility(
                |source, ability| source == "boffin" && ability == "drunk",
            )],
        },
    ]
}
pub(crate) fn product_jinx_registrations() -> Vec<(crate::jinxes::RegisteredJinx, &'static str)> {
    use crate::jinxes::{RegisteredJinx, Rule};
    vec![
        (
            RegisteredJinx {
                id: "boffin--preacher",
                characters: ["boffin", "preacher"],
                evidence: &["issue251_boffin_preacher"],
                rules: vec![Rule::ForbidGrantedAbility(|source, ability| {
                    source == "boffin" && ability == "preacher"
                })],
            },
            "과학자는 전도사 능력을 줄 수 없습니다.",
        ),
        (
            RegisteredJinx {
                id: "marionette--preacher",
                characters: ["marionette", "preacher"],
                evidence: &["issue251_marionette_preacher"],
                rules: vec![Rule::EffectImmunity(|source, target| {
                    source == "preacher" && target == "marionette"
                })],
            },
            "꼭두각시는 전도사 능력에 영향 받지 않습니다.",
        ),
    ]
}
pub(crate) fn may_acquire(
    f: &CustomGameFacts,
    source: &crate::model::AbilityUseRef,
    character: &str,
) -> bool {
    !(source.character_id == "boffin" || boffin_granted(f, source))
        || crate::jinxes::production()
            .is_ok_and(|j| !j.forbids_granted_ability("boffin", character))
}
pub(crate) fn acquisition_choices(
    d: &super::ResolvedScriptContext,
    f: &CustomGameFacts,
    o: &ActionOccurrence,
) -> Vec<String> {
    let source = o
        .ability_use
        .as_ref()
        .or_else(|| o.simulation_source.as_ref().map(|s| &s.source_ability_use));
    super::custom_ability_acquisition_character_ids(d)
        .into_iter()
        .filter(|id| source.is_none_or(|s| may_acquire(f, s, id)))
        .collect()
}
pub(crate) fn boffin_choices(
    d: &super::ResolvedScriptContext,
    characters: &[String],
) -> Result<Vec<String>, CoreError> {
    let jinxes = crate::jinxes::production()?;
    Ok(d.character_ids()
        .into_iter()
        .filter(|id| {
            d.character_kind(id)
                .is_some_and(|k| k.alignment() == crate::model::Alignment::Good)
                && !characters.iter().any(|c| c == id)
                && !jinxes.forbids_granted_ability("boffin", id)
        })
        .map(str::to_owned)
        .collect())
}
pub(crate) fn validate_boffin_setup(
    d: &super::ResolvedScriptContext,
    players: &[crate::contracts::SetupPlayerInput],
    ability: Option<&str>,
) -> Result<(), CoreError> {
    let roles = players
        .iter()
        .map(|p| p.actual_character.clone())
        .collect::<Vec<_>>();
    if roles.iter().any(|r| r == "boffin") {
        if !ability.is_some_and(|id| {
            boffin_choices(d, &roles).is_ok_and(|ids| ids.iter().any(|s| s == id))
        }) {
            return Err(ErrorKind::InvalidSetupChoice.into_error());
        }
    } else if ability.is_some() {
        return Err(ErrorKind::InvalidSetupChoice.into_error());
    }
    Ok(())
}
fn identity_ability(p: &crate::model::Player) -> crate::model::AbilityUseRef {
    crate::model::AbilityUseRef {
        owner_player_id: p.id.clone(),
        character_id: p.ability_instance.character_id.clone(),
        ability_instance_id: p.ability_instance.id.clone(),
    }
}
pub(crate) fn initial_boffin(
    f: &mut CustomGameFacts,
    ability: Option<&str>,
    event: &str,
) -> Result<(), CoreError> {
    let Some(ability) = ability else {
        return Ok(());
    };
    let source = f
        .players
        .iter()
        .find(|p| p.actual_character == "boffin")
        .map(identity_ability)
        .ok_or_else(invalid)?;
    let demon = f
        .players
        .iter()
        .find(|p| {
            super::custom_script_catalog()
                .iter()
                .any(|e| e.id == p.actual_character && e.kind == crate::model::CharacterKind::Demon)
        })
        .map(identity_ability)
        .ok_or_else(invalid)?;
    f.boffin_assignments.push(BoffinAssignment {
        source: source.clone(),
        demon: demon.clone(),
        character_id: ability.into(),
        event_id: event.into(),
        informed: false,
    });
    crate::reducer::apply_ability_grant(
        f,
        event,
        &crate::event::AbilityGrantChange {
            owner_player_id: demon.owner_player_id,
            character_id: ability.into(),
            source,
        },
    );
    Ok(())
}
fn current_boffin_assignment<'a>(
    f: &'a CustomGameFacts,
    source: &crate::model::AbilityUseRef,
) -> Option<&'a BoffinAssignment> {
    f.boffin_assignments.iter().rev().find(|a| {
        a.source == *source
            && f.player(&a.demon.owner_player_id)
                .is_some_and(|p| p.alive && p.ability_instance.id == a.demon.ability_instance_id)
    })
}
pub(crate) fn apply_boffin_assignment(
    f: &mut CustomGameFacts,
    event: &crate::event::ValidatedCustomEvent,
) -> Result<(), CoreError> {
    let CustomActionResult::BoffinGranted {
        target_player_id,
        character_id,
    } = &event.payload().result
    else {
        return Ok(());
    };
    let source = event.occurrence()?.ability_use.ok_or_else(invalid)?;
    let demon = f
        .player(target_player_id)
        .map(identity_ability)
        .ok_or_else(invalid)?;
    if let Some(a) = f
        .boffin_assignments
        .iter_mut()
        .find(|a| a.source == source && a.demon == demon && !a.informed)
    {
        a.informed = true;
    } else {
        f.boffin_assignments.push(BoffinAssignment {
            source,
            demon,
            character_id: character_id.clone(),
            event_id: event.id().into(),
            informed: true,
        });
    }
    Ok(())
}
/// Availability is distinct from ownership: a temporarily impaired Boffin must
/// not erase the Demon's spent use or a nested Philosopher choice.
pub(crate) fn grant_enabled(f: &CustomGameFacts, ability: &crate::model::AbilityUseRef) -> bool {
    match crate::reducer::recorded_ability(f, ability).map(|r| &r.origin) {
        Some(crate::model::AbilityOrigin::Acquired { source, .. }) => {
            if source.character_id == "boffin" {
                effective(f, source)
            } else {
                grant_enabled(f, source)
            }
        }
        _ => true,
    }
}
pub(crate) fn boffin_granted(f: &CustomGameFacts, ability: &crate::model::AbilityUseRef) -> bool {
    match crate::reducer::recorded_ability(f, ability).map(|r| &r.origin) {
        Some(crate::model::AbilityOrigin::Acquired { source, .. }) => {
            source.character_id == "boffin" || boffin_granted(f, source)
        }
        _ => false,
    }
}
pub(crate) fn scoped_self_impairment(
    f: &CustomGameFacts,
    e: &crate::contracts::ActiveImpairment,
) -> bool {
    f.philosopher_choices.iter().any(|choice| {
        choice.source_event_id == e.source_event_id
            && choice.ability_use.owner_player_id == e.player_id
            && choice.outcome == crate::contracts::PhilosopherChoiceOutcome::SelfDrunk
            && boffin_granted(f, &choice.ability_use)
    })
}
struct Boffin {
    action_ref: FirstNightActionRef,
}
impl Boffin {
    fn candidates(&self, c: &ActionContext<'_>) -> Result<Vec<ActionOccurrence>, CoreError> {
        if c.rule_service
            .try_owned_instances(&self.action_ref)?
            .is_empty()
        {
            return Ok(vec![]);
        }
        let f = facts(c)?;
        let d = c.rule_service.definition().ok_or_else(invalid)?;
        if !f.players.iter().any(|p| {
            p.alive
                && d.character_kind(&p.actual_character) == Some(crate::model::CharacterKind::Demon)
        }) {
            return Ok(vec![]);
        }
        c.rule_service
            .try_owned_instances(&self.action_ref)?
            .into_iter()
            .filter(|i| {
                f.player(&i.ability_use.owner_player_id).is_some_and(|p| {
                    p.alive || super::sects_and_violets::vigor_can_act(f, &i.ability_use)
                }) && current_boffin_assignment(f, &i.ability_use).is_none_or(|a| !a.informed)
            })
            .map(|i| {
                let mut o = ActionOccurrence::character(self.action_ref.clone(), i.ability_use)?;
                o.action_cause = Some(crate::contracts::ActionCause::InitialPreparation {
                    source_event_id: f.prefix_event_id.clone(),
                });
                Ok(o)
            })
            .collect()
    }
    fn step(&self, c: &ActionContext<'_>, o: &ActionOccurrence) -> Result<PhaseStep, CoreError> {
        let f = facts(c)?;
        let d = c.rule_service.definition().ok_or_else(invalid)?;
        let source = o.ability_use.as_ref().ok_or_else(invalid)?;
        let initial = current_boffin_assignment(f, source);
        let mut s = base_step(c, o, "boffin")?;
        s.required_input.kind = RequiredInputKind::CharacterTransformation;
        s.required_input.target = Some(InputTarget::Player);
        s.required_input.min_selections = Some(1);
        s.required_input.max_selections = Some(1);
        s.required_input.allowed_player_ids = Some(
            initial
                .map(|a| vec![a.demon.owner_player_id.clone()])
                .unwrap_or_else(|| {
                    f.players
                        .iter()
                        .filter(|p| {
                            p.alive
                                && d.character_kind(&p.actual_character)
                                    == Some(crate::model::CharacterKind::Demon)
                        })
                        .map(|p| p.id.clone())
                        .collect()
                }),
        );
        s.required_input.allowed_character_ids = Some(match initial {
            Some(a) => vec![a.character_id.clone()],
            None => boffin_choices(
                d,
                &f.players
                    .iter()
                    .map(|p| p.actual_character.clone())
                    .collect::<Vec<_>>(),
            )?,
        });
        Ok(s)
    }
    fn resolve(
        &self,
        c: &ActionContext<'_>,
        o: &ActionOccurrence,
        input: &ActionInput,
    ) -> Result<(CustomActionResult, CustomFactChanges), CoreError> {
        if !self.candidates(c)?.iter().any(|a| same_source(a, o))
            || input.delivered_result.is_some()
            || !input.registration_judgments.is_empty()
        {
            return Err(invalid());
        }
        let f = facts(c)?;
        let s = self.step(c, o)?;
        let fields = input.input.as_ref().ok_or_else(invalid)?;
        let targets = fields.player_ids.as_ref().ok_or_else(invalid)?;
        let chars = fields.character_ids.as_ref().ok_or_else(invalid)?;
        if targets.len() != 1
            || chars.len() != 1
            || !s
                .required_input
                .allowed_player_ids
                .as_ref()
                .unwrap()
                .contains(&targets[0])
            || !s
                .required_input
                .allowed_character_ids
                .as_ref()
                .unwrap()
                .contains(&chars[0])
            || *fields
                != (crate::model::StepInputFields {
                    player_ids: Some(targets.clone()),
                    character_ids: Some(chars.clone()),
                    ..Default::default()
                })
        {
            return Err(invalid());
        }
        let source = o.ability_use.as_ref().ok_or_else(invalid)?;
        let grants = if current_boffin_assignment(f, source).is_some() {
            vec![]
        } else {
            vec![crate::event::AbilityGrantChange {
                owner_player_id: targets[0].clone(),
                character_id: chars[0].clone(),
                source: source.clone(),
            }]
        };
        let notices = [
            (source.owner_player_id.clone(), true),
            (targets[0].clone(), false),
        ]
        .into_iter()
        .map(
            |(recipient_id, recipient_is_source)| PlayerNotification::GrantedAbility {
                recipient_id,
                recipient_is_source,
                character_id: chars[0].clone(),
                source_character_id: "boffin".into(),
            },
        )
        .collect();
        Ok((
            CustomActionResult::BoffinGranted {
                target_player_id: targets[0].clone(),
                character_id: chars[0].clone(),
            },
            CustomFactChanges::resolved(vec![], grants, SnvFactChanges::default())
                .with_player_notifications(notices),
        ))
    }
}
impl ActionHandler for Boffin {
    fn action_ref(&self) -> &FirstNightActionRef {
        &self.action_ref
    }
    fn required_occurrences(
        &self,
        c: &ActionContext<'_>,
        _: &crate::state::FirstNightProgress,
    ) -> Result<Vec<ActionOccurrence>, CoreError> {
        self.candidates(c)
    }
    fn project(&self, _: &ActionSpec, c: &ActionContext<'_>) -> Result<Vec<PhaseStep>, CoreError> {
        self.candidates(c)?
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
        Ok(ActionEventDraft::Custom(CustomActionEventDraft {
            step_id: o.step_id()?,
            action_ref: self.action_ref.clone(),
            ability_use: o.ability_use.clone(),
            simulation_source: None,
            follow_up_cause: o.follow_up_cause.clone(),
            action_cause: o.action_cause.clone(),
            input: input.input.clone(),
            delivered_result: None,
            registration_judgments: vec![],
            result: self.resolve(c, o, input)?.0,
        }))
    }
    fn validate_event(
        &self,
        _: &ActionSpec,
        c: &ActionContext<'_>,
        o: &ActionOccurrence,
        d: &ActionEventDraft,
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
        if result != d.result {
            return Err(invalid());
        }
        Ok(changes)
    }
}

pub(crate) fn setup_modifiers(
    characters: &[String],
    choice: Option<&str>,
) -> Result<Vec<crate::contracts::SetupModifier>, CoreError> {
    match choice {
        None => Ok(vec![]),
        Some("balloonist:0" | "balloonist:1") if characters.iter().any(|c| c == "balloonist") => {
            Ok(vec![crate::contracts::SetupModifier {
                character_id: "balloonist".into(),
                delta: crate::contracts::SetupCountDelta::outsider(
                    if choice == Some("balloonist:1") { 1 } else { 0 },
                ),
            }])
        }
        _ => Err(ErrorKind::InvalidSetupChoice.into_error()),
    }
}

struct Balloonist {
    action_ref: FirstNightActionRef,
}
impl Balloonist {
    fn candidates(&self, c: &ActionContext<'_>) -> Result<Vec<ActionOccurrence>, CoreError> {
        let f = facts(c)?;
        let mut os = c
            .rule_service
            .try_owned_instances(&self.action_ref)?
            .into_iter()
            .map(|i| ActionOccurrence::character(self.action_ref.clone(), i.ability_use))
            .collect::<Result<Vec<_>, _>>()?;
        os.extend(c.rule_service.simulation_occurrences(&self.action_ref)?);
        os.retain(|o| {
            o.actor_player_id()
                .and_then(|id| f.player(id))
                .is_some_and(|p| p.alive)
                && !f.confirmed_actions.iter().any(|a| {
                    same_source(o, &a.occurrence)
                        && a.occurrence.night == f.night_number()
                        && matches!(a.result, CustomActionResult::BalloonistLearned { .. })
                })
        });
        Ok(os)
    }
    fn choices(
        &self,
        c: &ActionContext<'_>,
        o: &ActionOccurrence,
    ) -> Result<Vec<TargetInformationCheck>, CoreError> {
        use crate::model::{CharacterKind as K, RegistrationJudgment, RegistrationValue as R};
        let f = facts(c)?;
        let d = c.rule_service.definition().ok_or_else(invalid)?;
        let previous = f.confirmed_actions.iter().rev().find_map(|a| {
            if same_source(&a.occurrence, o) {
                if let CustomActionResult::BalloonistLearned {
                    registered_kind, ..
                } = a.result
                {
                    Some(registered_kind)
                } else {
                    None
                }
            } else {
                None
            }
        });
        let impaired = crate::effects::occurrence_impaired(f, o);
        let vortox = !f.vortox_sources.is_empty() && crate::simulation::townsfolk_observer(o);
        Ok(f.players
            .iter()
            .filter_map(|p| {
                let actual = d.character_kind(&p.actual_character)?;
                let mut variants = vec![(actual, vec![])];
                if !impaired && !vortox {
                    if let Some(source) = super::registration_source(f, &p.id) {
                        for (kind, value) in [
                            (K::Townsfolk, R::Townsfolk),
                            (K::Outsider, R::Outsider),
                            (K::Minion, R::Minion),
                            (K::Demon, R::Demon),
                        ] {
                            let j = RegistrationJudgment {
                                scope: None,
                                player_id: p.id.clone(),
                                registered_as: value,
                                character_id: None,
                            };
                            if kind != actual
                                && super::registration_allowed(&source.character_id, &j, d)
                            {
                                variants.push((kind, vec![j]));
                            }
                        }
                    }
                }
                let result = InformationResult::Player {
                    player_id: p.id.clone(),
                };
                let choices = variants
                    .into_iter()
                    .filter(|(kind, _)| {
                        previous.is_none_or(|last| {
                            if vortox {
                                *kind == last
                            } else {
                                impaired || *kind != last
                            }
                        })
                    })
                    .map(|(_, registration_judgments)| TargetInformationChoice {
                        is_computed: previous.is_none_or(|last| last != actual),
                        result: result.clone(),
                        registration_judgments,
                    })
                    .collect::<Vec<_>>();
                (!choices.is_empty()).then(|| TargetInformationCheck {
                    number_constraint: None,
                    wake_audit: vec![],
                    target_player_ids: vec![p.id.clone()],
                    computed_result: result,
                    fixed_character_id: None,
                    choices,
                })
            })
            .collect())
    }
    fn resolve(
        &self,
        c: &ActionContext<'_>,
        o: &ActionOccurrence,
        input: &ActionInput,
        event: &str,
    ) -> Result<(CustomActionResult, CustomFactChanges), CoreError> {
        if !self.candidates(c)?.iter().any(|a| same_source(a, o)) {
            return Err(invalid());
        }
        let f = facts(c)?;
        let d = c.rule_service.definition().ok_or_else(invalid)?;
        let targets = crate::information::targets_with_policy(
            &input.input,
            1,
            o.actor_player_id().ok_or_else(invalid)?,
            true,
        )?;
        let target = &targets[0];
        let expected = InformationResult::Player {
            player_id: target.clone(),
        };
        if input
            .delivered_result
            .as_ref()
            .is_some_and(|r| r != &expected)
            || !self.choices(c, o)?.iter().any(|check| {
                check.target_player_ids == targets
                    && check
                        .choices
                        .iter()
                        .any(|choice| choice.registration_judgments == input.registration_judgments)
            })
        {
            return Err(invalid());
        }
        let kind = super::registered_identity(d, f, target, &input.registration_judgments)?.1;
        let previous = f.confirmed_actions.iter().rev().find_map(|a| {
            if same_source(&a.occurrence, o) {
                if let CustomActionResult::BalloonistLearned {
                    registered_kind, ..
                } = a.result
                {
                    Some(registered_kind)
                } else {
                    None
                }
            } else {
                None
            }
        });
        let mut audit = vec![];
        if previous == Some(kind) {
            let actor = o.actor_player_id().ok_or_else(invalid)?;
            let mut causes = crate::effects::impairment_causes(f, actor);
            causes.extend(crate::jinxes::production()?.simulation_causes(o));
            if o.ability_use.is_some() {
                causes.extend(f.vortox_sources.clone());
            }
            if !causes.is_empty() {
                audit.push(MalfunctionEvidence {
                    daytime_step_id: None,
                    cause_details: vortox_reasons(f),
                    event_id: event.into(),
                    occurrence: o.clone(),
                    subject_player_id: actor.into(),
                    outcome: MalfunctionOutcome::IncorrectInformation {
                        delivered_result: expected,
                    },
                    causes,
                });
            }
        }
        Ok((
            CustomActionResult::BalloonistLearned {
                target_player_id: target.clone(),
                registered_kind: kind,
            },
            CustomFactChanges::default().with_audit(audit),
        ))
    }
}
impl ActionHandler for Balloonist {
    fn action_ref(&self) -> &FirstNightActionRef {
        &self.action_ref
    }
    fn project(&self, _: &ActionSpec, c: &ActionContext<'_>) -> Result<Vec<PhaseStep>, CoreError> {
        self.candidates(c)?
            .into_iter()
            .map(|o| {
                let mut step = base_step(c, &o, "balloonist")?;
                let checks = self.choices(c, &o)?;
                step.required_input.kind = RequiredInputKind::PlayerIds;
                step.required_input.target = Some(InputTarget::Player);
                step.required_input.min_selections = Some(1);
                step.required_input.max_selections = Some(1);
                step.required_input.allowed_player_ids = Some(
                    checks
                        .iter()
                        .map(|v| v.target_player_ids[0].clone())
                        .collect(),
                );
                step.information_prompt = Some(InformationPrompt {
                    computed_result: None,
                    delivery_mode: InformationDeliveryMode::Selectable,
                    active_reasons: if crate::simulation::townsfolk_observer(&o) {
                        vortox_reasons(facts(c)?)
                    } else {
                        vec![]
                    },
                    registration_candidate_player_ids: vec![],
                    number_choices: vec![],
                    number_constraint: None,
                    boolean_choices: vec![],
                    setup_info_registration_options: vec![],
                    mathematician_audit: None,
                    target_checks: checks,
                });
                Ok(step)
            })
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
        Ok(ActionEventDraft::Custom(CustomActionEventDraft {
            step_id: o.step_id()?,
            action_ref: self.action_ref.clone(),
            ability_use: o.ability_use.clone(),
            simulation_source: o.simulation_source.clone(),
            follow_up_cause: o.follow_up_cause.clone(),
            action_cause: o.action_cause.clone(),
            input: input.input.clone(),
            delivered_result: input.delivered_result.clone(),
            registration_judgments: input.registration_judgments.clone(),
            result: self.resolve(c, o, input, c.event_id)?.0,
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
        event: &str,
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
            event,
        )?;
        if result != d.result {
            return Err(invalid());
        }
        Ok(changes)
    }
}

pub(crate) fn activation(
    c: &crate::first_night::ActivationContext<'_>,
) -> Option<crate::first_night::ActivationDecision> {
    matches!(c.action_ref, FirstNightActionRef::Character {character_id, action_id} if character_id == "pixie" && action_id == "learnTownsfolk").then_some(crate::first_night::ActivationDecision::RunImmediately)
}

pub(super) fn base_step(
    c: &ActionContext<'_>,
    o: &ActionOccurrence,
    character: &str,
) -> Result<PhaseStep, CoreError> {
    let f = facts(c)?;
    Ok(PhaseStep {
        ability_impairments: None,
        execution: None,
        information_flow: None,
        madness: None,
        id: o.step_id()?,
        phase: Phase::FirstNight,
        step_type: StepType::Character,
        character: Some(character.into()),
        player_id: o.actor_player_id().map(str::to_owned),
        ability_use: o.ability_use.clone(),
        ability_origin: o
            .ability_use
            .as_ref()
            .and_then(|s| crate::reducer::recorded_ability(f, s))
            .map(|r| r.origin.clone()),
        required_input: crate::input::required_none(),
        can_skip: false,
        support: PhaseStepSupport::Automated,
        information_prompt: None,
        pre_action_reveal: None,
        action_ref: Some(o.action_ref.clone()),
        simulation_source: o.simulation_source.clone(),
        follow_up_cause: o.follow_up_cause.clone(),
        action_cause: o.action_cause.clone(),
    })
}

#[derive(Debug, Clone)]
pub(crate) struct PixieResolution {
    pub(crate) bond_event_id: String,
    pub(crate) death_event_id: String,
    pub(crate) acquired: bool,
    pub(crate) simulated: bool,
}
fn same_source(a: &ActionOccurrence, b: &ActionOccurrence) -> bool {
    a.ability_use == b.ability_use && a.simulation_source == b.simulation_source
}
fn pixie_choices(
    d: &super::ResolvedScriptContext,
    f: &CustomGameFacts,
    o: &ActionOccurrence,
    target: &str,
) -> Vec<TargetInformationChoice> {
    let Some(p) = f.player(target) else {
        return vec![];
    };
    let impaired = crate::effects::occurrence_impaired(f, o);
    pixie_learned_characters(d, f, o, target)
        .into_iter()
        .map(|id| {
            let registration_judgments =
                if !impaired && pixie_spy(f, target) && p.actual_character != id {
                    vec![crate::model::RegistrationJudgment {
                        scope: None,
                        player_id: target.into(),
                        registered_as: crate::model::RegistrationValue::Townsfolk,
                        character_id: Some(id.clone()),
                    }]
                } else {
                    vec![]
                };
            TargetInformationChoice {
                is_computed: id == p.actual_character,
                result: InformationResult::Character { character_id: id },
                registration_judgments,
            }
        })
        .collect()
}
fn pixie_spy(f: &CustomGameFacts, target: &str) -> bool {
    super::registration_sources(f)
        .iter()
        .any(|source| source.owner_player_id == target && source.character_id == "spy")
}
fn pixie_bond<'a>(
    f: &'a CustomGameFacts,
    o: &ActionOccurrence,
) -> Option<&'a crate::state::ConfirmedActionFact> {
    f.confirmed_actions.iter().find(|a| {
        same_source(&a.occurrence, o) && matches!(a.result, CustomActionResult::PixieLearned { .. })
    })
}
fn pixie_pending(f: &CustomGameFacts, bond: &crate::state::ConfirmedActionFact) -> bool {
    !f.pixie_resolutions
        .iter()
        .any(|r| r.bond_event_id == bond.event_id)
        && bond
            .occurrence
            .actor_player_id()
            .and_then(|id| f.player(id))
            .is_some_and(|p| p.alive)
        && if let Some(source) = &bond.occurrence.ability_use {
            crate::reducer::current_ability_instance(f, source)
        } else {
            crate::simulation::sources(f).iter().any(|g| {
                Some(&g.source) == bond.occurrence.simulation_source.as_ref()
                    && g.character_id == "pixie"
            })
        }
}
fn pixie_assignment_id(bond: &crate::state::ConfirmedActionFact) -> String {
    format!("pixie:{}", bond.event_id)
}
pub(crate) fn grant_source_available(
    f: &CustomGameFacts,
    ability: &crate::model::AbilityUseRef,
) -> bool {
    let Some(record) = crate::reducer::recorded_ability(f, ability) else {
        return false;
    };
    match &record.origin {
        crate::model::AbilityOrigin::Acquired {
            source,
            acquisition_event_id,
        } if source.character_id == "boffin" => {
            crate::reducer::current_ability_instance(f, source)
                && f.boffin_assignments.iter().any(|a| {
                    a.source == *source
                        && a.event_id == *acquisition_event_id
                        && a.demon.owner_player_id == ability.owner_player_id
                        && f.player(&ability.owner_player_id)
                            .is_some_and(|p| p.ability_instance.id == a.demon.ability_instance_id)
                })
        }
        crate::model::AbilityOrigin::Acquired { source, .. }
            if matches!(source.character_id.as_str(), "pixie" | "philosopher") =>
        {
            crate::reducer::current_ability_instance(f, source)
        }
        _ => true,
    }
}
fn pixie_check(
    f: &CustomGameFacts,
    bond: &crate::state::ConfirmedActionFact,
) -> Option<crate::model::MadnessCheckResult> {
    use crate::model::MadnessCheckResult::{Clear, Violation};
    let id = pixie_assignment_id(bond);
    let day = f.past_days.iter().chain(f.day.iter()).rev().find_map(|d| {
        d.madness_checks
            .iter()
            .rev()
            .find(|(key, _)| key == &id)
            .map(|(_, v)| (d.day, if *v { Violation } else { Clear }))
    });
    let night = f.confirmed_actions.iter().rev().find_map(|a| {
        if same_source(&a.occurrence, &bond.occurrence) {
            if let CustomActionResult::PixieJudgment { result } = a.result {
                Some((a.occurrence.night, result))
            } else {
                None
            }
        } else {
            None
        }
    });
    match (day, night) {
        (Some((d, r)), Some((n, s))) => Some(if n > d { s } else { r }),
        (Some((_, r)), None) | (None, Some((_, r))) => Some(r),
        _ => None,
    }
}
pub(crate) fn pixie_day_madness(f: &CustomGameFacts) -> Vec<crate::day::contracts::DayMadness> {
    let Some(day) = &f.day else { return vec![] };
    let open = day.stage != crate::day::contracts::DayStage::Night
        && day.pending_death.is_none()
        && day.pending_game_end.is_none()
        && f.game_end.is_none()
        && !day
            .consequences
            .iter()
            .any(|c| !c.resolved && c.source.character_id != "barber");
    f.confirmed_actions
        .iter()
        .filter_map(|bond| {
            let CustomActionResult::PixieLearned { character_id, .. } = &bond.result else {
                return None;
            };
            if !pixie_pending(f, bond) {
                return None;
            }
            let source = bond.occurrence.ability_use.clone().or_else(|| {
                bond.occurrence
                    .simulation_source
                    .as_ref()
                    .map(|s| s.source_ability_use.clone())
            })?;
            Some(crate::day::contracts::DayMadness {
                observer_character_id: Some("pixie".into()),
                id: pixie_assignment_id(bond),
                target_player_id: source.owner_player_id.clone(),
                source,
                character_id: Some(character_id.clone()),
                effective: bond
                    .occurrence
                    .ability_use
                    .as_ref()
                    .is_some_and(|s| effective(f, s)),
                violation: pixie_check(f, bond)
                    .map(|c| c == crate::model::MadnessCheckResult::Violation),
                can_check: open,
                can_execute: false,
            })
        })
        .collect()
}

/// Resolve only a living-to-dead transition. The event-time assessment is final,
/// and poisoning recovery cannot retroactively create a grant.
pub(crate) fn resolve_pixie_deaths(
    before: &CustomGameFacts,
    after: &mut CustomGameFacts,
    event: &str,
) {
    for bond in &before.confirmed_actions {
        let CustomActionResult::PixieLearned {
            target_player_id,
            character_id,
        } = &bond.result
        else {
            continue;
        };
        if before
            .pixie_resolutions
            .iter()
            .any(|r| r.bond_event_id == bond.event_id)
            || !before.player(target_player_id).is_some_and(|p| p.alive)
            || !after.player(target_player_id).is_some_and(|p| !p.alive)
        {
            continue;
        }
        let acquired = bond.occurrence.ability_use.as_ref().is_some_and(|s| {
            pixie_can_acquire(
                before,
                s,
                pixie_check(before, bond) == Some(crate::model::MadnessCheckResult::Clear),
            ) && after.player(&s.owner_player_id).is_some_and(|p| p.alive)
                && crate::reducer::current_ability_instance(after, s)
                && may_acquire(after, s, character_id)
        });
        if acquired {
            let source = bond.occurrence.ability_use.as_ref().unwrap();
            crate::reducer::apply_ability_grant(
                after,
                event,
                &crate::event::AbilityGrantChange {
                    owner_player_id: source.owner_player_id.clone(),
                    character_id: character_id.clone(),
                    source: source.clone(),
                },
            );
        }
        let simulated = bond.occurrence.simulation_source.is_some()
            && pixie_pending(before, bond)
            && pixie_check(before, bond) == Some(crate::model::MadnessCheckResult::Clear)
            && bond
                .occurrence
                .actor_player_id()
                .and_then(|id| after.player(id))
                .is_some_and(|p| p.alive);
        after.pixie_resolutions.push(PixieResolution {
            bond_event_id: bond.event_id.clone(),
            death_event_id: event.into(),
            acquired,
            simulated,
        });
    }
}

pub(crate) fn simulated_pixie_grants(
    f: &CustomGameFacts,
    parents: &[crate::simulation::Guidance],
) -> Vec<crate::simulation::Guidance> {
    f.pixie_resolutions
        .iter()
        .filter(|r| r.simulated)
        .filter_map(|r| {
            let bond = f
                .confirmed_actions
                .iter()
                .find(|b| b.event_id == r.bond_event_id)?;
            let parent = bond.occurrence.simulation_source.as_ref()?;
            if !parents
                .iter()
                .any(|g| g.source == *parent && g.character_id == "pixie")
            {
                return None;
            }
            let CustomActionResult::PixieLearned { character_id, .. } = &bond.result else {
                return None;
            };
            Some(crate::simulation::Guidance {
                source: crate::contracts::PhilosopherSimulationSource {
                    selection_event_id: r.death_event_id.clone(),
                    source_ability_use: parent.source_ability_use.clone(),
                    guidance: Some(crate::contracts::GuidanceCause::PixieAcquisition {
                        bond_event_id: r.bond_event_id.clone(),
                    }),
                },
                character_id: character_id.clone(),
            })
        })
        .collect()
}

struct Pixie {
    action_ref: FirstNightActionRef,
}
impl Pixie {
    fn judging(&self) -> bool {
        matches!(&self.action_ref,FirstNightActionRef::Character {action_id,..} if action_id=="assessMadness")
    }
    fn candidates(&self, c: &ActionContext<'_>) -> Result<Vec<ActionOccurrence>, CoreError> {
        let f = facts(c)?;
        if f.game_end.is_some() {
            return Ok(vec![]);
        }
        let mut os = c
            .rule_service
            .try_owned_instances(&self.action_ref)?
            .into_iter()
            .map(|i| ActionOccurrence::character(self.action_ref.clone(), i.ability_use))
            .collect::<Result<Vec<_>, _>>()?;
        os.extend(c.rule_service.simulation_occurrences(&self.action_ref)?);
        os.retain(|o| {
            o.actor_player_id()
                .and_then(|id| f.player(id))
                .is_some_and(|p| p.alive)
                && if self.judging() {
                    pixie_bond(f, o).is_some_and(|b| pixie_pending(f, b))
                } else {
                    pixie_bond(f, o).is_none()
                }
        });
        if self.judging() {
            for o in &mut os {
                o.action_cause = Some(crate::contracts::ActionCause::Optional {
                    prefix_event_id: f.prefix_event_id.clone(),
                });
            }
        }
        Ok(os)
    }
    fn step(&self, c: &ActionContext<'_>, o: &ActionOccurrence) -> Result<PhaseStep, CoreError> {
        let f = facts(c)?;
        let mut step = base_step(c, o, "pixie")?;
        if self.judging() {
            step.required_input = crate::input::required_none();
            step.required_input.kind = RequiredInputKind::ExecutionDecision;
            step.information_prompt = None;
            step.madness = Some(crate::model::MadnessState {
                character_id: pixie_bond(f, o).and_then(|b| {
                    if let CustomActionResult::PixieLearned { character_id, .. } = &b.result {
                        Some(character_id.clone())
                    } else {
                        None
                    }
                }),
                check: pixie_bond(f, o).and_then(|b| pixie_check(f, b)),
                source_effective: o.ability_use.as_ref().is_some_and(|s| effective(f, s)),
                can_check: true,
                can_execute: false,
            });
            return Ok(step);
        }
        let definition = c.rule_service.definition().ok_or_else(invalid)?;
        step.required_input.kind = RequiredInputKind::PlayerIds;
        step.required_input.target = Some(InputTarget::Player);
        step.required_input.min_selections = Some(1);
        step.required_input.max_selections = Some(1);
        let checks = f
            .players
            .iter()
            .filter_map(|p| {
                let choices = pixie_choices(definition, f, o, &p.id);
                if choices.is_empty() {
                    return None;
                }
                let truth = InformationResult::Character {
                    character_id: p.actual_character.clone(),
                };
                Some(TargetInformationCheck {
                    number_constraint: None,
                    wake_audit: vec![],
                    target_player_ids: vec![p.id.clone()],
                    computed_result: truth.clone(),
                    fixed_character_id: None,
                    choices,
                })
            })
            .collect::<Vec<_>>();
        step.required_input.allowed_player_ids = Some(
            checks
                .iter()
                .map(|c| c.target_player_ids[0].clone())
                .collect(),
        );
        step.information_prompt = Some(InformationPrompt {
            computed_result: None,
            delivery_mode: InformationDeliveryMode::Selectable,
            active_reasons: if crate::simulation::townsfolk_observer(o) {
                vortox_reasons(f)
            } else {
                vec![]
            },
            registration_candidate_player_ids: vec![],
            number_choices: vec![],
            number_constraint: None,
            boolean_choices: vec![],
            setup_info_registration_options: vec![],
            mathematician_audit: None,
            target_checks: checks,
        });
        Ok(step)
    }
    fn resolve(
        &self,
        c: &ActionContext<'_>,
        o: &ActionOccurrence,
        input: &ActionInput,
    ) -> Result<CustomActionResult, CoreError> {
        let f = facts(c)?;
        if !self.candidates(c)?.iter().any(|a| same_source(a, o)) {
            return Err(invalid());
        }
        if self.judging() {
            let fields = input.input.as_ref().ok_or_else(invalid)?;
            let result = fields.madness_check.ok_or_else(invalid)?;
            if *fields
                != (crate::model::StepInputFields {
                    madness_check: Some(result),
                    ..Default::default()
                })
                || input.delivered_result.is_some()
                || !input.registration_judgments.is_empty()
            {
                return Err(invalid());
            }
            return Ok(CustomActionResult::PixieJudgment { result });
        }
        let targets = crate::information::targets_with_policy(
            &input.input,
            1,
            o.actor_player_id().ok_or_else(invalid)?,
            true,
        )?;
        let target = targets.first().ok_or_else(invalid)?;
        let choices = pixie_choices(
            c.rule_service.definition().ok_or_else(invalid)?,
            f,
            o,
            target,
        );
        let choice = match &input.delivered_result {
            Some(r) => choices.iter().find(|c| {
                &c.result == r && c.registration_judgments == input.registration_judgments
            }),
            None if choices.len() == 1
                && choices[0].registration_judgments == input.registration_judgments =>
            {
                choices.first()
            }
            _ => None,
        }
        .ok_or_else(|| ErrorKind::InvalidDeliveredInformation.into_error())?;
        let InformationResult::Character { character_id } = &choice.result else {
            return Err(invalid());
        };
        let character_id = character_id.clone();
        Ok(CustomActionResult::PixieLearned {
            target_player_id: target.clone(),
            character_id,
        })
    }
}
impl ActionHandler for Pixie {
    fn action_ref(&self) -> &FirstNightActionRef {
        &self.action_ref
    }
    fn required_occurrences(
        &self,
        c: &ActionContext<'_>,
        _: &crate::state::FirstNightProgress,
    ) -> Result<Vec<ActionOccurrence>, CoreError> {
        if !self.judging() && c.night_number() > 1 {
            self.candidates(c)
        } else {
            Ok(vec![])
        }
    }
    fn optional_occurrences(
        &self,
        c: &ActionContext<'_>,
        _: &crate::state::FirstNightProgress,
    ) -> Result<Vec<ActionOccurrence>, CoreError> {
        if self.judging() {
            self.candidates(c)
        } else {
            Ok(vec![])
        }
    }
    fn project(&self, _: &ActionSpec, c: &ActionContext<'_>) -> Result<Vec<PhaseStep>, CoreError> {
        self.candidates(c)?
            .into_iter()
            .map(|o| self.step(c, &o))
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
        Ok(ActionEventDraft::Custom(CustomActionEventDraft {
            step_id: o.step_id()?,
            action_ref: self.action_ref.clone(),
            ability_use: o.ability_use.clone(),
            simulation_source: o.simulation_source.clone(),
            follow_up_cause: o.follow_up_cause.clone(),
            action_cause: o.action_cause.clone(),
            input: input.input.clone(),
            delivered_result: input.delivered_result.clone(),
            registration_judgments: input.registration_judgments.clone(),
            result: self.resolve(c, o, input)?,
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
        event_id: &str,
    ) -> Result<CustomFactChanges, CoreError> {
        let ActionEventDraft::Custom(d) = d else {
            return Err(invalid());
        };
        if self.resolve(
            c,
            o,
            &ActionInput {
                input: d.input.clone(),
                delivered_result: d.delivered_result.clone(),
                registration_judgments: d.registration_judgments.clone(),
            },
        )? != d.result
        {
            return Err(invalid());
        }
        let f = facts(c)?;
        let mut audit = vec![];
        if let CustomActionResult::PixieLearned {
            target_player_id,
            character_id,
        } = &d.result
        {
            let registered_truth = d.registration_judgments.iter().any(|j| {
                j.player_id == *target_player_id && j.character_id.as_ref() == Some(character_id)
            });
            if !registered_truth
                && !f
                    .player(target_player_id)
                    .is_some_and(|p| p.actual_character == *character_id)
            {
                let actor = o.actor_player_id().ok_or_else(invalid)?;
                let mut causes = crate::effects::impairment_causes(f, actor);
                causes.extend(f.vortox_sources.clone());
                for cause in crate::jinxes::production()?.simulation_causes(o) {
                    if !causes.contains(&cause) {
                        causes.push(cause);
                    }
                }
                if !causes.is_empty() {
                    audit.push(MalfunctionEvidence {
                        daytime_step_id: None,
                        cause_details: vortox_reasons(f),
                        event_id: event_id.into(),
                        occurrence: o.clone(),
                        subject_player_id: actor.into(),
                        outcome: MalfunctionOutcome::IncorrectInformation {
                            delivered_result: InformationResult::Character {
                                character_id: character_id.clone(),
                            },
                        },
                        causes,
                    });
                }
            }
        }
        Ok(CustomFactChanges::default().with_audit(audit))
    }
}
fn facts<'a>(c: &'a ActionContext<'_>) -> Result<&'a CustomGameFacts, CoreError> {
    c.rule_service.facts().ok_or_else(invalid)
}
fn vortox_reasons(f: &CustomGameFacts) -> Vec<DeliveryReason> {
    f.vortox_sources
        .iter()
        .map(|s| DeliveryReason::Vortox {
            demon_player_id: s.owner_player_id.clone(),
        })
        .collect()
}

/// The selected player is the death trigger, not necessarily the Character the
/// Pixie learns. Keep these two facts separate even when truthful information
/// currently makes them equal. Vortox takes precedence over impairment.
pub(crate) fn pixie_learned_characters(
    definition: &super::ResolvedScriptContext,
    f: &CustomGameFacts,
    source: &ActionOccurrence,
    target_id: &str,
) -> Vec<String> {
    use crate::model::CharacterKind;
    let Some(target) = f.player(target_id) else {
        return vec![];
    };
    let impaired = crate::effects::occurrence_impaired(f, source);
    // A healthy Pixie must mark a Townsfolk even though Vortox changes the
    // information. Impairment permits an arbitrary marked player.
    if !impaired
        && !pixie_spy(f, target_id)
        && definition.character_kind(&target.actual_character) != Some(CharacterKind::Townsfolk)
    {
        return vec![];
    }
    definition
        .character_ids_of_kind(CharacterKind::Townsfolk)
        .into_iter()
        .filter(|id| {
            if source
                .ability_use
                .as_ref()
                .or_else(|| {
                    source
                        .simulation_source
                        .as_ref()
                        .map(|s| &s.source_ability_use)
                })
                .is_some_and(|s| !may_acquire(f, s, id))
            {
                return false;
            }
            if !f.vortox_sources.is_empty() && crate::simulation::townsfolk_observer(source) {
                !f.players.iter().any(|p| p.actual_character == *id)
            } else if impaired {
                true
            } else {
                target.actual_character == *id || pixie_spy(f, target_id)
            }
        })
        .map(str::to_owned)
        .collect()
}

/// Evaluate at the target's actual death, before subsequent recovery. No
/// Storyteller prompt or Vortox effectiveness gate belongs to acquisition.
pub(crate) fn pixie_can_acquire(
    f: &CustomGameFacts,
    source: &crate::model::AbilityUseRef,
    sufficiently_mad: bool,
) -> bool {
    sufficiently_mad && source.character_id == "pixie" && effective(f, source)
}

pub(crate) fn registrations() -> Vec<RegisteredAction> {
    let action_ref = FirstNightActionRef::Character {
        character_id: "nightwatchman".into(),
        action_id: "choosePlayer".into(),
    };
    let mut entries = vec![RegisteredAction {
        spec: ActionSpec {
            prerequisites: vec![],
            continuation_sources: vec![
                crate::first_night::execution::DependencySource::ImmediateOrigin,
            ],
            action_ref: action_ref.clone(),
            participates_in_first_night: true,
            required_input_kind: RequiredInputKind::PlayerIds,
            support: PhaseStepSupport::Automated,
        },
        handler: Box::new(Nightwatchman { action_ref }),
    }];
    for (id, kind) in [
        ("learnTownsfolk", RequiredInputKind::PlayerIds),
        ("assessMadness", RequiredInputKind::ExecutionDecision),
    ] {
        let action_ref = FirstNightActionRef::Character {
            character_id: "pixie".into(),
            action_id: id.into(),
        };
        entries.push(RegisteredAction {
            spec: ActionSpec {
                action_ref: action_ref.clone(),
                prerequisites: vec![],
                continuation_sources: vec![
                    crate::first_night::execution::DependencySource::ImmediateOrigin,
                ],
                participates_in_first_night: id == "learnTownsfolk",
                required_input_kind: kind,
                support: PhaseStepSupport::Automated,
            },
            handler: Box::new(Pixie { action_ref }),
        });
    }
    let action_ref = FirstNightActionRef::Character {
        character_id: "balloonist".into(),
        action_id: "learnPlayer".into(),
    };
    entries.push(RegisteredAction {
        spec: ActionSpec {
            action_ref: action_ref.clone(),
            prerequisites: vec![],
            continuation_sources: vec![
                crate::first_night::execution::DependencySource::ImmediateOrigin,
            ],
            participates_in_first_night: true,
            required_input_kind: RequiredInputKind::PlayerIds,
            support: PhaseStepSupport::Automated,
        },
        handler: Box::new(Balloonist { action_ref }),
    });
    let action_ref = FirstNightActionRef::Character {
        character_id: "boffin".into(),
        action_id: "grantAbility".into(),
    };
    entries.push(RegisteredAction {
        spec: ActionSpec {
            action_ref: action_ref.clone(),
            prerequisites: vec![],
            continuation_sources: vec![
                crate::first_night::execution::DependencySource::ImmediateOrigin,
            ],
            participates_in_first_night: false,
            required_input_kind: RequiredInputKind::CharacterTransformation,
            support: PhaseStepSupport::Automated,
        },
        handler: Box::new(Boffin { action_ref }),
    });
    let action_ref = FirstNightActionRef::Character {
        character_id: "marionette".into(),
        action_id: "assignShownCharacter".into(),
    };
    entries.push(RegisteredAction {
        spec: ActionSpec {
            action_ref: action_ref.clone(),
            prerequisites: vec![],
            continuation_sources: vec![
                crate::first_night::execution::DependencySource::ImmediateOrigin,
            ],
            participates_in_first_night: false,
            required_input_kind: RequiredInputKind::CharacterIds,
            support: PhaseStepSupport::Automated,
        },
        handler: Box::new(Marionette { action_ref }),
    });
    entries.push(preacher_registration());
    entries
}

fn is_marionette_simulation(o: &ActionOccurrence) -> bool {
    o.simulation_source
        .as_ref()
        .is_some_and(|s| s.source_ability_use.character_id == "marionette")
}

pub(crate) fn reminder_handlers() -> Vec<crate::reminders::ReminderHandler> {
    vec![
        crate::reminders::ReminderHandler {
            character_id: "preacher",
            project: |c| {
                c.facts
                    .preacher_selections
                    .iter()
                    .filter(|s| c.matches_ability(&s.source))
                    .map(|s| {
                        let mut token =
                            c.token(&s.target.owner_player_id, "noAbility", &s.event_id);
                        if !effective(c.facts, &s.source) {
                            token.inactive_reason = Some("전도사 능력 비활성".into());
                        }
                        token
                    })
                    .collect()
            },
        },
        crate::reminders::ReminderHandler {
            character_id: "marionette",
            project: |c| {
                if c.current() {
                    vec![c.token(c.owner(), "isTheMarionette", &c.facts.prefix_event_id)]
                } else {
                    vec![]
                }
            },
        },
        crate::reminders::ReminderHandler {
            character_id: "boffin",
            project: |c| {
                if !c.current() {
                    return vec![];
                }
                c.facts
                    .boffin_assignments
                    .iter()
                    .filter(|a| {
                        c.matches_ability(&a.source)
                            && c.facts.player(&a.demon.owner_player_id).is_some_and(|p| {
                                p.ability_instance.id == a.demon.ability_instance_id
                            })
                    })
                    .map(|a| {
                        let mut token =
                            c.token(&a.demon.owner_player_id, "grantedAbility", &a.event_id);
                        token.label = a.character_id.clone();
                        token.description = "과학자가 부여함".into();
                        if !effective(c.facts, &a.source) {
                            token.inactive_reason = Some("과학자 능력 비활성".into());
                        }
                        token
                    })
                    .collect()
            },
        },
        crate::reminders::ReminderHandler {
            character_id: "balloonist",
            project: |c| {
                if !c.living() {
                    return vec![];
                }
                c.facts
                    .confirmed_actions
                    .iter()
                    .rev()
                    .find_map(|b| {
                        if c.matches_occurrence(&b.occurrence) {
                            if let CustomActionResult::BalloonistLearned {
                                target_player_id, ..
                            } = &b.result
                            {
                                Some(vec![c.token(target_player_id, "know", &b.event_id)])
                            } else {
                                None
                            }
                        } else {
                            None
                        }
                    })
                    .unwrap_or_default()
            },
        },
        crate::reminders::ReminderHandler {
            character_id: "pixie",
            project: |c| {
                if !c.living() {
                    return vec![];
                }
                c.facts
                    .confirmed_actions
                    .iter()
                    .filter_map(|b| {
                        let CustomActionResult::PixieLearned {
                            target_player_id, ..
                        } = &b.result
                        else {
                            return None;
                        };
                        if !c.matches_occurrence(&b.occurrence) {
                            return None;
                        }
                        match c
                            .facts
                            .pixie_resolutions
                            .iter()
                            .find(|r| r.bond_event_id == b.event_id)
                        {
                            // Keep simulated acquisition for scheduling, not as a real-ability marker.
                            Some(r) if r.simulated && is_marionette_simulation(&b.occurrence) => {
                                None
                            }
                            Some(r) if r.acquired || r.simulated => {
                                Some(c.token(target_player_id, "hasAbility", &r.death_event_id))
                            }
                            Some(_) => None,
                            None => Some(c.token(target_player_id, "mad", &b.event_id)),
                        }
                    })
                    .collect()
            },
        },
        crate::reminders::ReminderHandler {
            character_id: "nightwatchman",
            project: |c| {
                let mut tokens = c.spent();
                if c.current() {
                    for event in &c.facts.confirmed_actions {
                        if c.matches_occurrence(&event.occurrence)
                            && !is_marionette_simulation(&event.occurrence)
                            && matches!(
                                event.result,
                                CustomActionResult::Simulation { spent: true, .. }
                            )
                        {
                            tokens.push(c.token(c.owner(), "noAbility", &event.event_id));
                        }
                    }
                }
                tokens
            },
        },
    ]
}

struct Nightwatchman {
    action_ref: FirstNightActionRef,
}
impl Nightwatchman {
    fn eligible(&self, c: &ActionContext<'_>, o: &ActionOccurrence) -> Result<bool, CoreError> {
        let f = facts(c)?;
        if o.action_ref != self.action_ref
            || !o
                .actor_player_id()
                .and_then(|id| f.player(id))
                .is_some_and(|p| p.alive)
        {
            return Ok(false);
        }
        if let Some(source) = &o.ability_use {
            return Ok(crate::reducer::current_ability_instance(f, source)
                && !f.ability_uses.iter().any(|u| u.ability_use == *source));
        }
        Ok(o.simulation_source
            .as_ref()
            .is_some_and(|source| !crate::simulation::spent(f, source))
            && crate::simulation::occurrences(f, &self.action_ref)?
                .contains(&o.clone().in_night(1)))
    }
    fn works(&self, f: &CustomGameFacts, o: &ActionOccurrence) -> bool {
        o.ability_use.as_ref().is_some_and(|s| effective(f, s))
    }
    fn choices(&self, f: &CustomGameFacts, o: &ActionOccurrence) -> Vec<InformationResult> {
        if !self.works(f, o) {
            return vec![];
        }
        let actor = o.actor_player_id().unwrap_or("");
        f.players
            .iter()
            .filter(|p| {
                if f.vortox_sources.is_empty() {
                    p.id == actor
                } else {
                    p.id != actor
                }
            })
            .map(|p| InformationResult::Player {
                player_id: p.id.clone(),
            })
            .collect()
    }
    fn step(&self, c: &ActionContext<'_>, o: &ActionOccurrence) -> Result<PhaseStep, CoreError> {
        let f = facts(c)?;
        let mut input = crate::input::required_none();
        input.kind = RequiredInputKind::PlayerIds;
        input.target = Some(InputTarget::Player);
        input.min_selections = Some(1);
        input.max_selections = Some(1);
        input.optional = true;
        input.allowed_player_ids = Some(f.players.iter().map(|p| p.id.clone()).collect());
        let truth = InformationResult::Player {
            player_id: o.actor_player_id().ok_or_else(invalid)?.into(),
        };
        let choices = self.choices(f, o);
        let reasons = if self.works(f, o) {
            vortox_reasons(f)
        } else {
            vec![]
        };
        let prompt = (!choices.is_empty()).then(|| InformationPrompt {
            computed_result: Some(truth.clone()),
            delivery_mode: if reasons.is_empty() {
                InformationDeliveryMode::Fixed
            } else {
                InformationDeliveryMode::Selectable
            },
            active_reasons: reasons,
            registration_candidate_player_ids: vec![],
            number_choices: vec![],
            number_constraint: None,
            boolean_choices: vec![],
            setup_info_registration_options: vec![],
            mathematician_audit: None,
            target_checks: f
                .players
                .iter()
                .map(|p| TargetInformationCheck {
                    number_constraint: None,
                    wake_audit: vec![],
                    target_player_ids: vec![p.id.clone()],
                    computed_result: truth.clone(),
                    fixed_character_id: None,
                    choices: choices
                        .iter()
                        .map(|r| TargetInformationChoice {
                            result: r.clone(),
                            is_computed: *r == truth,
                            registration_judgments: vec![],
                        })
                        .collect(),
                })
                .collect(),
        });
        Ok(PhaseStep {
            ability_impairments: None,
            execution: None,
            information_flow: None,
            madness: None,
            id: o.step_id()?,
            phase: Phase::FirstNight,
            step_type: StepType::Character,
            character: Some("nightwatchman".into()),
            player_id: o.actor_player_id().map(str::to_owned),
            ability_use: o.ability_use.clone(),
            ability_origin: o
                .ability_use
                .as_ref()
                .and_then(|s| crate::reducer::recorded_ability(f, s))
                .map(|r| r.origin.clone()),
            required_input: input,
            can_skip: false,
            support: PhaseStepSupport::Automated,
            information_prompt: prompt,
            pre_action_reveal: None,
            action_ref: Some(self.action_ref.clone()),
            simulation_source: o.simulation_source.clone(),
            follow_up_cause: o.follow_up_cause.clone(),
            action_cause: o.action_cause.clone(),
        })
    }
    fn resolve(
        &self,
        c: &ActionContext<'_>,
        o: &ActionOccurrence,
        input: &ActionInput,
        event: &str,
    ) -> Result<(CustomActionResult, CustomFactChanges), CoreError> {
        if !self.eligible(c, o)? || !input.registration_judgments.is_empty() {
            return Err(invalid());
        }
        let f = facts(c)?;
        if input.input.is_none() {
            if input.delivered_result.is_some() {
                return Err(invalid());
            }
            return Ok((
                if o.simulation_source.is_some() {
                    CustomActionResult::Simulation {
                        information: None,
                        spent: false,
                    }
                } else {
                    CustomActionResult::NoEffect
                },
                CustomFactChanges::default(),
            ));
        }
        let targets = crate::information::targets_with_policy(
            &input.input,
            1,
            o.actor_player_id().ok_or_else(invalid)?,
            true,
        )?;
        let target = targets.first().ok_or_else(invalid)?;
        if f.player(target).is_none() {
            return Err(invalid());
        }
        let choices = self.choices(f, o);
        let selected = match &input.delivered_result {
            Some(r) if choices.contains(r) => Some(r.clone()),
            Some(_) => return Err(ErrorKind::InvalidDeliveredInformation.into_error()),
            None if choices.len() == 1 => choices.first().cloned(),
            None if choices.is_empty() => None,
            None => return Err(ErrorKind::MissingDeliveredInformation.into_error()),
        };
        let revealed = match selected {
            Some(InformationResult::Player { player_id }) => Some(player_id),
            _ => None,
        };
        let mut changes = SnvFactChanges::default();
        if let Some(source) = &o.ability_use {
            changes.spent = Some(AbilityUseRecord {
                source_event_id: event.into(),
                ability_use: source.clone(),
            });
        }
        let mut audit = if !self.works(f, o) {
            super::sects_and_violets::night_impairment_failure(
                f,
                o,
                event,
                FailedEffect::NightwatchmanNotification,
            )
        } else {
            vec![]
        };
        if let Some(id) = &revealed {
            if Some(id.as_str()) != o.actor_player_id() {
                audit.push(MalfunctionEvidence {
                    daytime_step_id: None,
                    cause_details: vortox_reasons(f),
                    event_id: event.into(),
                    occurrence: o.clone(),
                    subject_player_id: o.actor_player_id().unwrap().into(),
                    outcome: MalfunctionOutcome::IncorrectInformation {
                        delivered_result: InformationResult::Player {
                            player_id: id.clone(),
                        },
                    },
                    causes: f.vortox_sources.clone(),
                });
            }
        }
        let notifications = revealed
            .as_ref()
            .map(|id| PlayerNotification::Nightwatchman {
                recipient_id: target.clone(),
                revealed_player_id: id.clone(),
            })
            .into_iter()
            .collect();
        Ok((
            if o.simulation_source.is_some() {
                CustomActionResult::Simulation {
                    information: None,
                    spent: true,
                }
            } else {
                CustomActionResult::NightwatchmanUsed {
                    target_player_id: target.clone(),
                    revealed_player_id: revealed,
                }
            },
            CustomFactChanges::resolved(vec![], vec![], changes)
                .with_audit(audit)
                .with_player_notifications(notifications),
        ))
    }
}
impl ActionHandler for Nightwatchman {
    fn action_ref(&self) -> &FirstNightActionRef {
        &self.action_ref
    }
    fn permits_defer(&self) -> bool {
        true
    }
    fn project(&self, _: &ActionSpec, c: &ActionContext<'_>) -> Result<Vec<PhaseStep>, CoreError> {
        let mut os = c
            .rule_service
            .try_owned_instances(&self.action_ref)?
            .into_iter()
            .map(|i| ActionOccurrence::character(self.action_ref.clone(), i.ability_use))
            .collect::<Result<Vec<_>, _>>()?;
        os.extend(c.rule_service.simulation_occurrences(&self.action_ref)?);
        os.into_iter()
            .filter_map(|o| match self.eligible(c, &o) {
                Ok(true) => Some(self.step(c, &o)),
                Ok(false) => None,
                Err(e) => Some(Err(e)),
            })
            .collect()
    }
    fn propose(
        &self,
        spec: &ActionSpec,
        c: &ActionContext<'_>,
        o: &ActionOccurrence,
        input: &StepInput,
    ) -> Result<ActionEventDraft, CoreError> {
        self.propose_input(
            spec,
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
        let (result, _) = self.resolve(c, o, input, c.event_id)?;
        Ok(ActionEventDraft::Custom(CustomActionEventDraft {
            step_id: o.step_id()?,
            action_ref: self.action_ref.clone(),
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
        spec: &ActionSpec,
        c: &ActionContext<'_>,
        o: &ActionOccurrence,
        draft: &ActionEventDraft,
    ) -> Result<CustomFactChanges, CoreError> {
        self.validate_event_with_id(spec, c, o, draft, c.event_id)
    }
    fn validate_event_with_id(
        &self,
        _: &ActionSpec,
        c: &ActionContext<'_>,
        o: &ActionOccurrence,
        draft: &ActionEventDraft,
        event: &str,
    ) -> Result<CustomFactChanges, CoreError> {
        let ActionEventDraft::Custom(d) = draft else {
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
            event,
        )?;
        if result != d.result {
            return Err(invalid());
        }
        Ok(changes)
    }
}

/// Required votes belong to current, effective abilities, not a player's shown role
/// or alignment. Project in seating order and count a player only once even if
/// several independent instances impose the same obligation.
pub(crate) fn forced_voter_ids(facts: &CustomGameFacts) -> Vec<String> {
    if facts.players.iter().filter(|p| p.alive).count() < 5 {
        return vec![];
    }
    let mut players = facts.players.iter().filter(|p| p.alive).collect::<Vec<_>>();
    players.sort_by_key(|p| p.seat);
    players
        .into_iter()
        .filter(|p| {
            facts.ability_provenance.iter().any(|record| {
                let source = &record.ability_use;
                source.owner_player_id == p.id
                    && source.character_id == "zealot"
                    && effective(facts, source)
            })
        })
        .map(|p| p.id.clone())
        .collect()
}

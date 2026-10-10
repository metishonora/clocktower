//! Supported BMR characters in the custom runtime. Wake truth is derived from
//! canonical action records, never from the UI's current role or night-sheet rows.
use crate::{
    contracts::{CustomActionResult, FirstNightActionRef},
    error::{CoreError, ErrorKind},
    event::{CustomActionEventDraft, CustomFactChanges},
    first_night::{
        ActionContext, ActionEventDraft, ActionHandler, ActionInput, ActionSpec, RegisteredAction,
    },
    model::*,
    state::{ActionOccurrence, MalfunctionEvidence, MalfunctionOutcome},
};

pub(super) fn custom_registry_entries() -> Vec<(&'static str, CharacterKind)> {
    vec![
        ("chambermaid", CharacterKind::Townsfolk),
        ("fool", CharacterKind::Townsfolk),
        ("gambler", CharacterKind::Townsfolk),
        ("devilsAdvocate", CharacterKind::Minion),
        ("assassin", CharacterKind::Minion),
        ("grandmother", CharacterKind::Townsfolk),
        ("moonchild", CharacterKind::Outsider),
    ]
}
fn invalid() -> CoreError {
    ErrorKind::InvalidStepInput.into_error()
}

pub(crate) fn jinx_registrations() -> Vec<crate::jinxes::RegisteredJinx> {
    vec![crate::jinxes::RegisteredJinx {
        id: "chambermaid--mathematician",
        characters: ["chambermaid", "mathematician"],
        evidence: &["issue251_chambermaid_mathematician_forecast"],
        rules: vec![crate::jinxes::Rule::ForecastWake(|observer, subject| {
            observer == "chambermaid" && subject == "mathematician"
        })],
    }]
}

fn own_ability_wake(action: &FirstNightActionRef) -> bool {
    super::trouble_brewing::wakes_actor(action)
        || super::sects_and_violets::wakes_actor(action)
        || super::carousel::wakes_actor(action)
        || matches!(action, FirstNightActionRef::Character { character_id, action_id } if matches!((character_id.as_str(), action_id.as_str()), ("chambermaid","learnCount") | ("grandmother","learnGrandchild") | ("gambler","guessCharacter") | ("devilsAdvocate","protectExecution") | ("assassin","killPlayer")))
}

fn audit(c: &ActionContext<'_>, targets: &[String]) -> Result<Vec<WakeAuditRecord>, CoreError> {
    let f = c.rule_service.facts().ok_or_else(invalid)?;
    let forecast = if crate::jinxes::production()?.forecasts_wake("chambermaid", "mathematician") {
        let registration = super::sects_and_violets::registrations()
            .into_iter()
            .find(|r| {
                r.spec.action_ref == FirstNightActionRef::character("mathematician", "learnCount")
            })
            .ok_or_else(invalid)?;
        registration
            .handler
            .project(&registration.spec, c)?
            .into_iter()
            .filter(|s| {
                s.ability_use
                    .as_ref()
                    .is_none_or(|a| crate::effects::available(f, a))
            })
            .collect()
    } else {
        vec![]
    };
    Ok(targets
        .iter()
        .map(|id| {
            let mut evidence = f
                .confirmed_actions
                .iter()
                .filter(|a| {
                    a.occurrence.night == f.night_number()
                        && a.occurrence.actor_player_id() == Some(id.as_str())
                        && own_ability_wake(&a.occurrence.action_ref)
                })
                .filter_map(|a| {
                    let FirstNightActionRef::Character { character_id, .. } =
                        &a.occurrence.action_ref
                    else {
                        return None;
                    };
                    Some(WakeEvidence {
                        character_id: character_id.clone(),
                        event_id: Some(a.event_id.clone()),
                        forecast: false,
                    })
                })
                .collect::<Vec<_>>();
            if evidence.is_empty() && forecast.iter().any(|s| s.player_id.as_ref() == Some(id)) {
                evidence.push(WakeEvidence {
                    character_id: "mathematician".into(),
                    event_id: None,
                    forecast: true,
                });
            }
            WakeAuditRecord {
                player_id: id.clone(),
                woke: !evidence.is_empty(),
                evidence,
            }
        })
        .collect())
}

struct Chambermaid {
    action_ref: FirstNightActionRef,
}
impl Chambermaid {
    fn occurrences(&self, c: &ActionContext<'_>) -> Result<Vec<ActionOccurrence>, CoreError> {
        let f = c.rule_service.facts().ok_or_else(invalid)?;
        let mut result = c
            .rule_service
            .try_owned_instances(&self.action_ref)?
            .into_iter()
            .map(|i| ActionOccurrence::character(self.action_ref.clone(), i.ability_use))
            .collect::<Result<Vec<_>, _>>()?;
        result.extend(c.rule_service.simulation_occurrences(&self.action_ref)?);
        result.retain(|o| {
            o.actor_player_id().is_some_and(|id| {
                f.player(id).is_some_and(|p| p.alive)
                    && f.players.iter().filter(|p| p.alive && p.id != id).count() >= 2
            })
        });
        Ok(result)
    }
    fn reasons(&self, c: &ActionContext<'_>, o: &ActionOccurrence) -> Vec<DeliveryReason> {
        let f = c.rule_service.facts().expect("custom facts");
        let mut reasons = if crate::effects::occurrence_impaired(f, o) {
            super::sects_and_violets::impairment_details(f, o.actor_player_id().unwrap_or_default())
        } else {
            vec![]
        };
        if o.simulation_source.is_some() && reasons.is_empty() {
            reasons.push(DeliveryReason::Drunk);
        }
        if crate::simulation::townsfolk_observer(o) {
            reasons.extend(f.vortox_sources.iter().map(|s| DeliveryReason::Vortox {
                demon_player_id: s.owner_player_id.clone(),
            }));
        }
        reasons
    }
    fn step(&self, c: &ActionContext<'_>, o: &ActionOccurrence) -> Result<PhaseStep, CoreError> {
        let f = c.rule_service.facts().ok_or_else(invalid)?;
        let mut step = super::carousel::base_step(c, o, "chambermaid")?;
        let eligible = f
            .players
            .iter()
            .filter(|p| p.alive && Some(p.id.as_str()) != o.actor_player_id())
            .map(|p| p.id.clone())
            .collect::<Vec<_>>();
        step.required_input.kind = RequiredInputKind::PlayerIds;
        step.required_input.target = Some(InputTarget::Player);
        step.required_input.min_selections = Some(2);
        step.required_input.max_selections = Some(2);
        step.required_input.allowed_player_ids = Some(eligible.clone());
        let reasons = self.reasons(c, o);
        let vortox = reasons
            .iter()
            .any(|r| matches!(r, DeliveryReason::Vortox { .. }));
        let mut checks = vec![];
        let eligible_audit = audit(c, &eligible)?;
        for (i, first) in eligible.iter().enumerate() {
            for second in &eligible[i + 1..] {
                let target_player_ids = vec![first.clone(), second.clone()];
                let wake_audit = eligible_audit
                    .iter()
                    .filter(|r| target_player_ids.contains(&r.player_id))
                    .cloned()
                    .collect::<Vec<_>>();
                let value = wake_audit.iter().filter(|r| r.woke).count() as u64;
                let computed_result = InformationResult::Number { value };
                checks.push(TargetInformationCheck {
                    alignment_options: vec![],
                    target_player_ids,
                    fixed_character_id: None,
                    computed_result: computed_result.clone(),
                    wake_audit,
                    number_constraint: (!reasons.is_empty()).then_some(
                        NumberInformationConstraint {
                            min: 0,
                            max: 9_007_199_254_740_991,
                            excluded_values: if vortox { vec![value] } else { vec![] },
                        },
                    ),
                    choices: if reasons.is_empty() {
                        vec![TargetInformationChoice {
                            result: computed_result,
                            is_computed: true,
                            registration_judgments: vec![],
                        }]
                    } else {
                        vec![]
                    },
                });
            }
        }
        step.information_prompt = Some(InformationPrompt {
            computed_result: None,
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
        if !self.occurrences(c)?.contains(&o.clone().in_night(1))
            || !input.registration_judgments.is_empty()
        {
            return Err(invalid());
        }
        let actor = o.actor_player_id().ok_or_else(invalid)?;
        let targets = crate::information::targets(&input.input, 2, actor)?;
        let step = self.step(c, o)?;
        let prompt = step.information_prompt.ok_or_else(invalid)?;
        let check = prompt
            .target_checks
            .iter()
            .find(|r| r.target_player_ids.iter().all(|id| targets.contains(id)))
            .ok_or_else(invalid)?;
        let truth = check.computed_result.clone();
        let delivered = input
            .delivered_result
            .clone()
            .or_else(|| check.number_constraint.is_none().then(|| truth.clone()))
            .ok_or_else(|| ErrorKind::MissingDeliveredInformation.into_error())?;
        let InformationResult::Number { value } = delivered else {
            return Err(invalid());
        };
        if let Some(range) = &check.number_constraint {
            if value < range.min || value > range.max || range.excluded_values.contains(&value) {
                return Err(ErrorKind::InvalidDeliveredInformation.into_error());
            }
        } else if delivered != truth {
            return Err(ErrorKind::InvalidDeliveredInformation.into_error());
        }
        let f = c.rule_service.facts().ok_or_else(invalid)?;
        let mut changes = CustomFactChanges::default();
        if delivered != truth {
            let mut causes = crate::effects::impairment_causes(f, actor);
            causes.extend(crate::jinxes::production()?.simulation_causes(o));
            if crate::simulation::townsfolk_observer(o) {
                causes.extend(f.vortox_sources.clone());
            }
            if !causes.is_empty() {
                changes = changes.with_audit(vec![MalfunctionEvidence {
                    daytime_step_id: None,
                    event_id: event.into(),
                    occurrence: o.clone(),
                    subject_player_id: actor.into(),
                    outcome: MalfunctionOutcome::IncorrectInformation {
                        delivered_result: delivered.clone(),
                    },
                    causes,
                    cause_details: prompt.active_reasons.clone(),
                }]);
            }
        }
        let information = ConfirmedInformation {
            actor: Some(InformationActor {
                player_id: actor.into(),
                character_id: "chambermaid".into(),
            }),
            target_player_ids: targets,
            computed_result: Some(truth),
            delivered_result: delivered,
            delivery_context: if prompt.active_reasons.is_empty() {
                DeliveryContext::Fixed
            } else {
                DeliveryContext::Discretionary {
                    reasons: prompt.active_reasons,
                }
            },
        };
        Ok((
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
            changes,
        ))
    }
}
pub(crate) fn registrations() -> Vec<RegisteredAction> {
    let action_ref = FirstNightActionRef::character("chambermaid", "learnCount");
    let mut entries = vec![RegisteredAction {
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
        handler: Box::new(Chambermaid { action_ref }),
    }];
    for (character, action, first, kind) in [
        (
            "grandmother",
            "learnGrandchild",
            true,
            RequiredInputKind::PlayerIds,
        ),
        ("moonchild", "resolveDeath", false, RequiredInputKind::None),
        (
            "gambler",
            "guessCharacter",
            false,
            RequiredInputKind::CharacterTransformation,
        ),
        (
            "devilsAdvocate",
            "protectExecution",
            true,
            RequiredInputKind::PlayerIds,
        ),
        (
            "assassin",
            "killPlayer",
            false,
            RequiredInputKind::PlayerIds,
        ),
    ] {
        let action_ref = FirstNightActionRef::character(character, action);
        entries.push(RegisteredAction {
            spec: ActionSpec {
                action_ref: action_ref.clone(),
                prerequisites: vec![],
                continuation_sources: vec![
                    crate::first_night::execution::DependencySource::ImmediateOrigin,
                ],
                participates_in_first_night: first,
                required_input_kind: kind,
                support: PhaseStepSupport::Automated,
            },
            handler: Box::new(BmrAction {
                action_ref,
                character,
            }),
        });
    }
    entries
}
impl ActionHandler for Chambermaid {
    fn action_ref(&self) -> &FirstNightActionRef {
        &self.action_ref
    }
    fn project(&self, _: &ActionSpec, c: &ActionContext<'_>) -> Result<Vec<PhaseStep>, CoreError> {
        self.occurrences(c)?
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

pub(crate) fn death_protection_rules() -> Vec<crate::death::ProtectionRule> {
    vec![advocate_protection, fool_protection]
}
fn fool_protection(
    facts: &crate::state::CustomGameFacts,
    attempt: &crate::death::Attempt<'_>,
) -> Option<crate::death::Prevention> {
    facts
        .ability_provenance
        .iter()
        .find(|record| {
            let source = &record.ability_use;
            source.character_id == "fool"
                && source.owner_player_id == attempt.player_id
                && crate::effects::effective(facts, source)
                && !facts
                    .ability_uses
                    .iter()
                    .any(|used| used.ability_use == *source)
        })
        .map(|record| crate::death::Prevention {
            source: record.ability_use.clone(),
            consumed: true,
        })
}

struct BmrAction {
    action_ref: FirstNightActionRef,
    character: &'static str,
}
impl BmrAction {
    fn occurrences(&self, c: &ActionContext<'_>) -> Result<Vec<ActionOccurrence>, CoreError> {
        let f = c.rule_service.facts().ok_or_else(invalid)?;
        if self.character == "moonchild" {
            return f
                .moonchild_choices
                .iter()
                .filter(|choice| choice.night == f.night_number())
                .map(|choice| {
                    ActionOccurrence::from_all_parts(
                        self.action_ref.clone(),
                        Some(choice.source.clone()),
                        None,
                        None,
                        Some(crate::contracts::ActionCause::Death {
                            death_event_id: choice.death_event_id.clone(),
                        }),
                    )
                })
                .collect();
        }
        let mut list = c
            .rule_service
            .try_owned_instances(&self.action_ref)?
            .into_iter()
            .map(|i| ActionOccurrence::character(self.action_ref.clone(), i.ability_use))
            .collect::<Result<Vec<_>, _>>()?;
        list.extend(c.rule_service.simulation_occurrences(&self.action_ref)?);
        list.retain(|o| {
            f.player(o.actor_player_id().unwrap_or_default())
                .is_some_and(|p| {
                    p.alive
                        || o.ability_use
                            .as_ref()
                            .is_some_and(|a| super::sects_and_violets::vigor_can_act(f, a))
                })
                && (self.character != "assassin"
                    || (!o.ability_use.as_ref().is_some_and(|source| {
                        f.ability_uses.iter().any(|u| u.ability_use == *source)
                    }) && !o
                        .simulation_source
                        .as_ref()
                        .is_some_and(|source| crate::simulation::spent(f, source))))
        });
        Ok(list)
    }
    fn step(&self, c: &ActionContext<'_>, o: &ActionOccurrence) -> Result<PhaseStep, CoreError> {
        let f = c.rule_service.facts().ok_or_else(invalid)?;
        let d = c.rule_service.definition().ok_or_else(invalid)?;
        let mut step = super::carousel::base_step(c, o, self.character)?;
        if self.character == "moonchild" {
            return Ok(step);
        }
        if self.character == "grandmother" {
            return grandmother_step(c, o, step);
        }
        step.required_input.kind = if self.character == "gambler" {
            RequiredInputKind::CharacterTransformation
        } else {
            RequiredInputKind::PlayerIds
        };
        step.required_input.target = Some(InputTarget::Player);
        step.required_input.min_selections = Some(1);
        step.required_input.max_selections = Some(1);
        step.required_input.optional = self.character == "assassin";
        step.can_skip = self.character == "assassin";
        step.required_input.allowed_player_ids = Some(
            f.players
                .iter()
                .filter(|p| {
                    self.character != "devilsAdvocate"
                        || (p.alive && !last_advocate_target(f, o).is_some_and(|id| id == p.id))
                })
                .map(|p| p.id.clone())
                .collect(),
        );
        if self.character == "gambler" {
            step.required_input.allowed_character_ids =
                Some(d.character_ids().into_iter().map(str::to_owned).collect());
            step.required_input.player_registration_options = Some(
                f.players
                    .iter()
                    .flat_map(|p| {
                        let source = super::registration_source(f, &p.id);
                        d.character_ids().into_iter().filter_map(move |id| {
                            let kind = d.character_kind(id)?;
                            let allowed =
                                source
                                    .as_ref()
                                    .is_some_and(|s| match s.character_id.as_str() {
                                        "spy" => matches!(
                                            kind,
                                            CharacterKind::Townsfolk | CharacterKind::Outsider
                                        ),
                                        "recluse" => matches!(
                                            kind,
                                            CharacterKind::Minion | CharacterKind::Demon
                                        ),
                                        _ => false,
                                    });
                            allowed.then(|| RegistrationJudgment {
                                scope: None,
                                player_id: p.id.clone(),
                                registered_as: match kind {
                                    CharacterKind::Townsfolk => RegistrationValue::Townsfolk,
                                    CharacterKind::Outsider => RegistrationValue::Outsider,
                                    CharacterKind::Minion => RegistrationValue::Minion,
                                    CharacterKind::Demon => RegistrationValue::Demon,
                                },
                                character_id: Some(id.into()),
                            })
                        })
                    })
                    .collect(),
            );
        }
        Ok(step)
    }
    fn resolve(
        &self,
        c: &ActionContext<'_>,
        o: &ActionOccurrence,
        input: &ActionInput,
        event: &str,
    ) -> Result<(CustomActionResult, CustomFactChanges), CoreError> {
        let f = c.rule_service.facts().ok_or_else(invalid)?;
        let d = c.rule_service.definition().ok_or_else(invalid)?;
        if !self.occurrences(c)?.contains(&o.clone().in_night(1)) {
            return Err(invalid());
        }
        if self.character == "grandmother" {
            return grandmother_resolve(c, o, input);
        }
        if input.delivered_result.is_some() {
            return Err(invalid());
        }
        if self.character == "moonchild" {
            return moonchild_resolve(f, o, input);
        }
        if self.character == "assassin"
            && input.input.is_none()
            && input.registration_judgments.is_empty()
        {
            return Ok((
                CustomActionResult::AssassinUsed {
                    target_player_id: None,
                    spent: false,
                    deaths: vec![],
                },
                CustomFactChanges::default(),
            ));
        }
        let fields = input.input.as_ref().ok_or_else(invalid)?;
        let targets = fields
            .player_ids
            .as_ref()
            .filter(|ids| ids.len() == 1)
            .ok_or_else(invalid)?;
        let id = &targets[0];
        if !self
            .step(c, o)?
            .required_input
            .allowed_player_ids
            .unwrap_or_default()
            .contains(id)
        {
            return Err(invalid());
        }
        if *fields
            != (StepInputFields {
                player_ids: Some(targets.clone()),
                character_ids: if self.character == "gambler" {
                    fields.character_ids.clone()
                } else {
                    None
                },
                ..Default::default()
            })
        {
            return Err(invalid());
        }
        if self.character != "gambler" && !input.registration_judgments.is_empty() {
            return Err(invalid());
        }
        if self.character == "gambler" {
            fields
                .character_ids
                .as_ref()
                .filter(|v| v.len() == 1 && d.contains(&v[0]))
                .ok_or_else(invalid)?;
            if input
                .registration_judgments
                .iter()
                .any(|j| j.player_id != *id || j.scope.is_some())
            {
                return Err(invalid());
            }
            super::registered_identity(d, f, id, &input.registration_judgments)?;
        }
        if o.simulation_source.is_some() {
            return Ok((
                CustomActionResult::Simulation {
                    information: None,
                    spent: self.character == "assassin",
                },
                CustomFactChanges::default(),
            ));
        }
        let source = o.ability_use.as_ref().ok_or_else(invalid)?;
        let active = crate::effects::effective(f, source);
        if self.character == "devilsAdvocate" {
            return Ok((
                CustomActionResult::DevilsAdvocateProtected {
                    target_player_id: id.clone(),
                    night: f.night_number(),
                    effective: active,
                },
                CustomFactChanges::default(),
            ));
        }
        if self.character == "gambler" {
            let guesses = fields
                .character_ids
                .as_ref()
                .filter(|v| v.len() == 1 && d.contains(&v[0]))
                .ok_or_else(invalid)?;
            if input
                .registration_judgments
                .iter()
                .any(|j| j.player_id != *id || j.scope.is_some())
            {
                return Err(invalid());
            }
            let registered = super::registered_identity(d, f, id, &input.registration_judgments)?;
            let correct = registered.0 == guesses[0];
            let targets = if active && !correct {
                vec![source.owner_player_id.clone()]
            } else {
                vec![]
            };
            let deaths = crate::death::night(f, o, &targets, false);
            return Ok((
                CustomActionResult::GamblerGuessed {
                    target_player_id: id.clone(),
                    character_id: guesses[0].clone(),
                    correct,
                    effective: active,
                    deaths: deaths.outcomes.clone(),
                },
                CustomFactChanges::default().with_resolved_deaths(deaths),
            ));
        }
        let deaths =
            crate::death::night(f, o, &if active { vec![id.clone()] } else { vec![] }, true);
        Ok((
            CustomActionResult::AssassinUsed {
                target_player_id: Some(id.clone()),
                spent: true,
                deaths: deaths.outcomes.clone(),
            },
            CustomFactChanges::resolved(
                vec![],
                vec![],
                crate::event::SnvFactChanges {
                    spent: Some(crate::contracts::AbilityUseRecord {
                        source_event_id: event.into(),
                        ability_use: source.clone(),
                    }),
                    ..Default::default()
                },
            )
            .with_resolved_deaths(deaths),
        ))
    }
}
impl ActionHandler for BmrAction {
    fn historical_source(&self, c: &ActionContext<'_>, o: &ActionOccurrence) -> bool {
        self.character == "moonchild"
            && self
                .occurrences(c)
                .is_ok_and(|list| list.contains(&o.clone().in_night(1)))
    }
    fn permits_defer(&self) -> bool {
        self.character == "assassin"
    }
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
        let ActionEventDraft::Custom(draft) = draft else {
            return Err(invalid());
        };
        let (result, changes) = self.resolve(
            c,
            o,
            &ActionInput {
                input: draft.input.clone(),
                delivered_result: draft.delivered_result.clone(),
                registration_judgments: draft.registration_judgments.clone(),
            },
            event,
        )?;
        if result != draft.result {
            return Err(invalid());
        }
        let f = c.rule_service.facts().ok_or_else(invalid)?;
        let failed = match &result {
            CustomActionResult::Simulation { .. } if self.character == "gambler" => {
                let fields = draft.input.as_ref().ok_or_else(invalid)?;
                let target = fields
                    .player_ids
                    .as_ref()
                    .and_then(|ids| ids.first())
                    .ok_or_else(invalid)?;
                let guess = fields
                    .character_ids
                    .as_ref()
                    .and_then(|ids| ids.first())
                    .ok_or_else(invalid)?;
                let definition = c.rule_service.definition().ok_or_else(invalid)?;
                let registered = super::registered_identity(
                    definition,
                    f,
                    target,
                    &draft.registration_judgments,
                )?;
                (registered.0 != *guess).then_some(crate::state::FailedEffect::GamblerDeath)
            }
            CustomActionResult::GamblerGuessed {
                correct: false,
                effective: false,
                ..
            } => Some(crate::state::FailedEffect::GamblerDeath),
            CustomActionResult::MoonchildResolved {
                chosen_good: true,
                effective: false,
                target_player_id,
                ..
            } if f.player(target_player_id).is_some_and(|p| p.alive) => {
                Some(crate::state::FailedEffect::MoonchildDeath)
            }
            CustomActionResult::AssassinUsed {
                spent: true,
                target_player_id: Some(id),
                deaths,
                ..
            } if deaths.is_empty() && f.player(id).is_some_and(|p| p.alive) => {
                Some(crate::state::FailedEffect::AssassinDeath)
            }
            _ => None,
        };
        let mut audit = failed
            .map(|effect| {
                // Moonchild checks tonight's impairment, retaining the death that caused its action.
                super::sects_and_violets::current_night_impairment_failure(f, o, event, effect)
            })
            .unwrap_or_default();
        if let CustomActionResult::GrandmotherLearned { information, .. }
        | CustomActionResult::Simulation {
            information: Some(information),
            ..
        } = &result
        {
            if information.computed_result.as_ref() != Some(&information.delivered_result) {
                let mut causes =
                    crate::effects::impairment_causes(f, o.actor_player_id().unwrap_or_default());
                causes.extend(crate::jinxes::production()?.simulation_causes(o));
                if crate::simulation::townsfolk_observer(o) {
                    causes.extend(f.vortox_sources.iter().cloned());
                }
                if !causes.is_empty() {
                    audit.push(MalfunctionEvidence {
                        daytime_step_id: None,
                        event_id: event.into(),
                        occurrence: o.clone(),
                        subject_player_id: o.actor_player_id().unwrap_or_default().into(),
                        outcome: MalfunctionOutcome::IncorrectInformation {
                            delivered_result: information.delivered_result.clone(),
                        },
                        causes,
                        cause_details: vec![],
                    });
                }
            }
        }
        Ok(changes.with_audit(audit))
    }
}
fn last_advocate_target<'a>(
    f: &'a crate::state::CustomGameFacts,
    o: &ActionOccurrence,
) -> Option<&'a str> {
    f.confirmed_actions.iter().rev().find_map(|e| {
        if e.occurrence.ability_use != o.ability_use
            || e.occurrence.simulation_source != o.simulation_source
        {
            return None;
        }
        match &e.result {
            CustomActionResult::DevilsAdvocateProtected {
                target_player_id,
                night,
                ..
            } if *night + 1 == f.night_number() => Some(target_player_id.as_str()),
            _ => None,
        }
    })
}
fn advocate_protection(
    f: &crate::state::CustomGameFacts,
    attempt: &crate::death::Attempt<'_>,
) -> Option<crate::death::Prevention> {
    if !attempt.execution
        || f.day
            .as_ref()
            .is_none_or(|d| d.stage == crate::day::contracts::DayStage::Night)
    {
        return None;
    }
    f.confirmed_actions.iter().rev().find_map(|e| {
        let CustomActionResult::DevilsAdvocateProtected {
            target_player_id,
            night,
            effective,
        } = &e.result
        else {
            return None;
        };
        let source = e.occurrence.ability_use.as_ref()?;
        (target_player_id == attempt.player_id
            && crate::effects::evaluate_rule(
                f,
                &crate::effects::EffectRule::ability(
                    source,
                    crate::effects::EffectWindow::ThroughDay(*night as u16),
                    *effective,
                ),
            )
            .active())
        .then(|| crate::death::Prevention {
            source: source.clone(),
            consumed: false,
        })
    })
}

fn grandmother_step(
    c: &ActionContext<'_>,
    o: &ActionOccurrence,
    mut step: PhaseStep,
) -> Result<PhaseStep, CoreError> {
    let f = c.rule_service.facts().ok_or_else(invalid)?;
    let d = c.rule_service.definition().ok_or_else(invalid)?;
    let impaired = crate::effects::occurrence_impaired(f, o);
    let vortox = crate::simulation::townsfolk_observer(o) && !f.vortox_sources.is_empty();
    let mut reasons = if impaired {
        super::sects_and_violets::impairment_details(f, o.actor_player_id().unwrap_or_default())
    } else {
        vec![]
    };
    if impaired && reasons.is_empty() {
        reasons.push(DeliveryReason::Drunk);
    }
    if vortox {
        reasons.extend(f.vortox_sources.iter().map(|s| DeliveryReason::Vortox {
            demon_player_id: s.owner_player_id.clone(),
        }));
    }
    let mut checks = vec![];
    for p in f
        .players
        .iter()
        .filter(|p| Some(p.id.as_str()) != o.actor_player_id())
    {
        let spy = super::registration_source(f, &p.id).is_some_and(|s| s.character_id == "spy");
        // This selection establishes the real relationship. False delivery may name somebody else.
        if o.simulation_source.is_none() && p.alignment != Alignment::Good && !spy {
            continue;
        }
        let truth = InformationResult::Character {
            character_id: p.actual_character.clone(),
        };
        let mut choices = vec![];
        for id in d.character_ids() {
            let good_kind = matches!(
                d.character_kind(id),
                Some(CharacterKind::Townsfolk | CharacterKind::Outsider)
            );
            let registration = (!impaired && spy && good_kind).then(|| RegistrationJudgment {
                scope: None,
                player_id: p.id.clone(),
                registered_as: if d.character_kind(id) == Some(CharacterKind::Townsfolk) {
                    RegistrationValue::Townsfolk
                } else {
                    RegistrationValue::Outsider
                },
                character_id: Some(id.into()),
            });
            let truthful = (p.alignment == Alignment::Good && id == p.actual_character)
                || registration.is_some();
            if (vortox && truthful) || (!vortox && !impaired && !truthful) {
                continue;
            }
            choices.push(TargetInformationChoice {
                result: InformationResult::Character {
                    character_id: id.into(),
                },
                is_computed: truthful,
                registration_judgments: registration.into_iter().collect(),
            });
        }
        if impaired || vortox {
            for shown in f.players.iter().filter(|shown| shown.id != p.id && Some(shown.id.as_str()) != o.actor_player_id()) {
                for id in d.character_ids() {
                    choices.push(TargetInformationChoice {
                        result: InformationResult::PlayerCharacter { player_id: shown.id.clone(), character_id: id.into() },
                        is_computed: false,
                        registration_judgments: vec![],
                    });
                }
            }
        }
        if !choices.is_empty() {
            checks.push(TargetInformationCheck {
                target_player_ids: vec![p.id.clone()],
                fixed_character_id: None,
                computed_result: truth,
                choices,
                number_constraint: None,
                alignment_options: vec![],
                wake_audit: vec![],
            });
        }
    }
    step.required_input.kind = RequiredInputKind::PlayerIds;
    step.required_input.target = Some(InputTarget::Player);
    step.required_input.min_selections = Some(1);
    step.required_input.max_selections = Some(1);
    step.required_input.allowed_player_ids = Some(
        checks
            .iter()
            .map(|c| c.target_player_ids[0].clone())
            .collect(),
    );
    step.information_prompt = Some(InformationPrompt {
        computed_result: None,
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
        target_checks: checks,
        mathematician_audit: None,
    });
    Ok(step)
}
fn grandmother_resolve(
    c: &ActionContext<'_>,
    o: &ActionOccurrence,
    input: &ActionInput,
) -> Result<(CustomActionResult, CustomFactChanges), CoreError> {
    let fields = input.input.as_ref().ok_or_else(invalid)?;
    let targets = fields
        .player_ids
        .as_ref()
        .filter(|v| v.len() == 1)
        .ok_or_else(invalid)?;
    if *fields
        != (StepInputFields {
            player_ids: Some(targets.clone()),
            ..Default::default()
        })
    {
        return Err(invalid());
    }
    let prompt = grandmother_step(c, o, super::carousel::base_step(c, o, "grandmother")?)?
        .information_prompt
        .ok_or_else(invalid)?;
    let check = prompt
        .target_checks
        .iter()
        .find(|v| v.target_player_ids == *targets)
        .ok_or_else(invalid)?;
    let delivered = input
        .delivered_result
        .clone()
        .or_else(|| (prompt.active_reasons.is_empty()).then(|| check.computed_result.clone()))
        .ok_or_else(invalid)?;
    let choice = check
        .choices
        .iter()
        .find(|v| v.result == delivered && v.registration_judgments == input.registration_judgments)
        .ok_or_else(invalid)?;
    let (delivered_targets, computed) = match &delivered {
        InformationResult::PlayerCharacter { player_id, .. } => {
            let InformationResult::Character { character_id } = &check.computed_result else { return Err(invalid()); };
            (vec![player_id.clone()], InformationResult::PlayerCharacter { player_id: targets[0].clone(), character_id: character_id.clone() })
        }
        _ => (targets.clone(), if choice.is_computed { choice.result.clone() } else { check.computed_result.clone() }),
    };
    let information = ConfirmedInformation {
        actor: Some(InformationActor {
            player_id: o.actor_player_id().ok_or_else(invalid)?.into(),
            character_id: "grandmother".into(),
        }),
        target_player_ids: delivered_targets,
        computed_result: Some(computed),
        delivered_result: delivered,
        delivery_context: if prompt.active_reasons.is_empty() {
            DeliveryContext::Fixed
        } else {
            DeliveryContext::Discretionary {
                reasons: prompt.active_reasons,
            }
        },
    };
    Ok((
        if o.simulation_source.is_some() {
            CustomActionResult::Simulation {
                information: Some(information),
                spent: false,
            }
        } else {
            CustomActionResult::GrandmotherLearned {
                target_player_id: targets[0].clone(),
                information,
            }
        },
        CustomFactChanges::default(),
    ))
}
pub(crate) fn grandmother_death(
    f: &crate::state::CustomGameFacts,
    killer: &ActionOccurrence,
    victim: &str,
) -> Vec<(String, ActionOccurrence)> {
    if !killer
        .ability_use
        .as_ref()
        .is_some_and(|s| super::character_kind(&s.character_id) == Some(CharacterKind::Demon))
    {
        return vec![];
    }
    f.confirmed_actions
        .iter()
        .filter_map(|e| {
            let CustomActionResult::GrandmotherLearned {
                target_player_id, ..
            } = &e.result
            else {
                return None;
            };
            let source = e.occurrence.ability_use.as_ref()?;
            if target_player_id != victim || !crate::effects::effective(f, source) {
                return None;
            }
            // The grandparent dies from their own ability, retaining the initiating action's atomic Undo.
            Some((
                source.owner_player_id.clone(),
                e.occurrence.clone().in_night(f.night_number()),
            ))
        })
        .collect()
}

#[derive(Debug, Clone)]
pub(crate) struct MoonchildChoice {
    pub(crate) source: AbilityUseRef,
    pub(crate) event_id: String,
    pub(crate) death_event_id: String,
    pub(crate) target_player_id: String,
    pub(crate) chosen_good: bool,
    pub(crate) night: u32,
}
fn moonchild_resolve(
    f: &crate::state::CustomGameFacts,
    o: &ActionOccurrence,
    input: &ActionInput,
) -> Result<(CustomActionResult, CustomFactChanges), CoreError> {
    if input.input.is_some() || !input.registration_judgments.is_empty() {
        return Err(invalid());
    }
    let choice = f
        .moonchild_choices
        .iter()
        .find(|c| Some(&c.source) == o.ability_use.as_ref() && c.night == f.night_number())
        .ok_or_else(invalid)?;
    let active = crate::effects::evaluate_rule(
        f,
        &crate::effects::EffectRule {
            binding: crate::effects::EffectBinding::DeathAbility(choice.source.clone()),
            window: crate::effects::EffectWindow::Night(choice.night),
            established: true,
        },
    )
    .active();
    let targets = if active && choice.chosen_good {
        vec![choice.target_player_id.clone()]
    } else {
        vec![]
    };
    let deaths = crate::death::night(f, o, &targets, false);
    Ok((
        CustomActionResult::MoonchildResolved {
            target_player_id: choice.target_player_id.clone(),
            chosen_good: choice.chosen_good,
            effective: active,
            deaths: deaths.outcomes.clone(),
        },
        CustomFactChanges::default().with_resolved_deaths(deaths),
    ))
}
fn moonchild_consequence(
    day: &mut crate::day::contracts::DayProgress,
    source: &AbilityUseRef,
    event: &str,
    impaired: bool,
    alignment: Alignment,
) {
    let id = format!(
        "death:{}:{}",
        event,
        serde_json::to_string(source).expect("source")
    );
    if day.consequences.iter().any(|c| c.id == id) {
        return;
    }
    day.consequences
        .push(crate::day::contracts::DayConsequence {
            id,
            death_event_id: event.into(),
            source: source.clone(),
            impaired_at_death: impaired,
            alignment_at_death: alignment,
            resolved: false,
            target_player_id: None,
        });
}
pub(crate) fn day_death_consequences(
    f: &crate::state::CustomGameFacts,
    day: &mut crate::day::contracts::DayProgress,
    victim: &str,
    event: &str,
) {
    for r in &f.ability_provenance {
        let s = &r.ability_use;
        if s.owner_player_id == victim
            && s.character_id == "moonchild"
            && crate::effects::available(f, s)
        {
            moonchild_consequence(
                day,
                s,
                event,
                crate::effects::ability_impaired(f, s),
                f.player(victim).expect("victim").alignment,
            );
        }
    }
}
pub(crate) fn announced_deaths(
    f: &crate::state::CustomGameFacts,
    day: &mut crate::day::contracts::DayProgress,
) {
    let number = day.day;
    for death in f
        .night_deaths
        .iter()
        .filter(|d| d.night == number && !d.player.death_announced)
    {
        for source in death
            .abilities
            .iter()
            .filter(|s| s.character_id == "moonchild")
        {
            moonchild_consequence(
                day,
                source,
                &death.event_id,
                !death.effective_abilities.contains(source),
                death.player.alignment,
            );
        }
    }
}
pub(crate) fn resolve_moonchild(
    d: &super::ResolvedScriptContext,
    f: &crate::state::CustomGameFacts,
    next: &mut crate::state::CustomGameFacts,
    day: &mut crate::day::contracts::DayProgress,
    id: &str,
    target: &Option<String>,
    judgments: &[RegistrationJudgment],
    event: &str,
) -> Result<(), CoreError> {
    let c = day
        .consequences
        .iter_mut()
        .find(|c| c.id == id && !c.resolved && c.source.character_id == "moonchild")
        .ok_or_else(invalid)?;
    let p = target
        .as_ref()
        .and_then(|id| f.player(id))
        .filter(|p| p.alive)
        .ok_or_else(invalid)?;
    if judgments.iter().any(|j| {
        j.player_id != p.id
            || j.scope.is_some()
            || j.character_id.is_some()
            || !matches!(
                j.registered_as,
                RegistrationValue::Good | RegistrationValue::Evil
            )
    }) {
        return Err(invalid());
    }
    let good = super::registered_identity(d, f, &p.id, judgments)?.2 == Alignment::Good;
    next.moonchild_choices.push(MoonchildChoice {
        source: c.source.clone(),
        event_id: event.into(),
        death_event_id: c.death_event_id.clone(),
        target_player_id: p.id.clone(),
        chosen_good: good,
        night: day.day + 1,
    });
    c.resolved = true;
    c.target_player_id = Some(p.id.clone());
    Ok(())
}

pub(crate) fn activation(
    c: &crate::first_night::ActivationContext<'_>,
) -> Option<crate::first_night::ActivationDecision> {
    matches!(c.action_ref,FirstNightActionRef::Character {character_id,action_id} if character_id=="grandmother" && action_id=="learnGrandchild").then_some(crate::first_night::ActivationDecision::RunImmediately)
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ExecutionEffect {
    pub(crate) source: AbilityUseRef,
    pub(crate) spent: bool,
}
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ExecutionPreview {
    pub(crate) outcome: crate::death::Outcome,
    pub(crate) effects: Vec<ExecutionEffect>,
}
pub(crate) fn execution_preview(
    f: &crate::state::CustomGameFacts,
    target: &str,
) -> Option<ExecutionPreview> {
    let mut effects = vec![];
    if let Some(prevention) = advocate_protection(
        f,
        &crate::death::Attempt {
            player_id: target,
            execution: true,
            unpreventable: false,
        },
    ) {
        effects.push(ExecutionEffect {
            source: prevention.source,
            spent: false,
        });
    }
    for record in &f.ability_provenance {
        let source = &record.ability_use;
        if source.owner_player_id == target
            && source.character_id == "fool"
            && crate::effects::available(f, source)
        {
            let spent = f.ability_uses.iter().any(|u| u.ability_use == *source);
            if spent || crate::effects::effective(f, source) {
                effects.push(ExecutionEffect {
                    source: source.clone(),
                    spent,
                });
            }
        }
    }
    (!effects.is_empty()).then(|| ExecutionPreview {
        outcome: crate::death::decide(
            f,
            crate::death::Attempt {
                player_id: target,
                execution: true,
                unpreventable: false,
            },
        ),
        effects,
    })
}
pub(crate) fn alignment_registrations(
    f: &crate::state::CustomGameFacts,
) -> Vec<RegistrationJudgment> {
    f.players
        .iter()
        .filter_map(|p| {
            let source = super::registration_source(f, &p.id)?;
            let registered_as = match source.character_id.as_str() {
                "spy" => RegistrationValue::Good,
                "recluse" => RegistrationValue::Evil,
                _ => return None,
            };
            Some(RegistrationJudgment {
                scope: None,
                player_id: p.id.clone(),
                registered_as,
                character_id: None,
            })
        })
        .collect()
}
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ScheduledDeathView {
    pub(crate) source: AbilityUseRef,
    pub(crate) event_id: String,
    pub(crate) target_player_id: String,
    pub(crate) chosen_good: bool,
    pub(crate) night: u32,
    pub(crate) preview: Option<CustomActionResult>,
}
pub(crate) fn scheduled_deaths(f: &crate::state::CustomGameFacts) -> Vec<ScheduledDeathView> {
    f.moonchild_choices
        .iter()
        .map(|c| {
            let preview = (c.night == f.night_number())
                .then(|| {
                    let o = ActionOccurrence::character(
                        FirstNightActionRef::character("moonchild", "resolveDeath"),
                        c.source.clone(),
                    )
                    .expect("source")
                    .in_night(c.night);
                    moonchild_resolve(
                        f,
                        &o,
                        &ActionInput {
                            input: None,
                            delivered_result: None,
                            registration_judgments: vec![],
                        },
                    )
                    .ok()
                    .map(|r| r.0)
                })
                .flatten();
            ScheduledDeathView {
                source: c.source.clone(),
                event_id: c.event_id.clone(),
                target_player_id: c.target_player_id.clone(),
                chosen_good: c.chosen_good,
                night: c.night,
                preview,
            }
        })
        .collect()
}
pub(crate) fn reminder_handlers() -> Vec<crate::reminders::ReminderHandler> {
    use crate::reminders::ReminderHandler;
    vec![
        ReminderHandler {
            character_id: "fool",
            project: |c| c.spent(),
        },
        ReminderHandler {
            character_id: "assassin",
            project: |c| {
                let mut result = c.spent();
                if c.current() {
                    for e in &c.facts.confirmed_actions {
                        if c.matches_occurrence(&e.occurrence)
                            && matches!(
                                e.result,
                                CustomActionResult::Simulation { spent: true, .. }
                            )
                        {
                            result.push(c.token(c.owner(), "noAbility", &e.event_id));
                        }
                    }
                }
                result
            },
        },
        ReminderHandler {
            character_id: "grandmother",
            project: |c| {
                if !c.current() {
                    return vec![];
                }
                c.facts
                    .confirmed_actions
                    .iter()
                    .filter(|e| c.matches_occurrence(&e.occurrence))
                    .filter_map(|e| match &e.result {
                        CustomActionResult::GrandmotherLearned {
                            target_player_id, ..
                        } => Some(c.token(target_player_id, "grandchild", &e.event_id)),
                        CustomActionResult::Simulation {
                            information: Some(info),
                            ..
                        } => info
                            .target_player_ids
                            .first()
                            .map(|id| c.token(id, "grandchild", &e.event_id)),
                        _ => None,
                    })
                    .collect()
            },
        },
        ReminderHandler {
            character_id: "devilsAdvocate",
            project: |c| {
                c.facts
                    .confirmed_actions
                    .iter()
                    .filter(|e| c.matches_occurrence(&e.occurrence))
                    .filter_map(|e| {
                        let CustomActionResult::DevilsAdvocateProtected {
                            target_player_id,
                            night,
                            effective,
                        } = &e.result
                        else {
                            return None;
                        };
                        let source = e.occurrence.ability_use.as_ref()?;
                        let status = crate::effects::evaluate_rule(
                            c.facts,
                            &crate::effects::EffectRule::ability(
                                source,
                                crate::effects::EffectWindow::ThroughDay(*night as u16),
                                *effective,
                            ),
                        );
                        if !status.visible() {
                            return None;
                        }
                        let mut token =
                            c.token(target_player_id, "executionProtected", &e.event_id);
                        token.inactive_reason = status.inactive_reason();
                        Some(token)
                    })
                    .collect()
            },
        },
        ReminderHandler {
            character_id: "moonchild",
            project: |c| {
                c.facts
                    .moonchild_choices
                    .iter()
                    .filter(|choice| {
                        c.matches_ability(&choice.source)
                            && choice.chosen_good
                            && choice.night >= c.facts.night_number()
                            && !c.facts.confirmed_actions.iter().any(|e| {
                                e.occurrence.ability_use.as_ref() == Some(&choice.source)
                                    && e.occurrence.night == choice.night
                                    && matches!(
                                        e.result,
                                        CustomActionResult::MoonchildResolved { .. }
                                    )
                            })
                    })
                    .map(|choice| {
                        c.token(&choice.target_player_id, "diesTonight", &choice.event_id)
                    })
                    .collect()
            },
        },
    ]
}

pub(crate) fn death_audit(
    f: &crate::state::CustomGameFacts,
    killer: Option<&ActionOccurrence>,
    attempt: &crate::death::Attempt<'_>,
    outcome: &crate::death::Outcome,
    event: &str,
) -> Vec<MalfunctionEvidence> {
    use crate::state::FailedEffect;
    let failed =
        killer
            .and_then(|o| o.ability_use.as_ref())
            .and_then(|s| match s.character_id.as_str() {
                "gambler" => Some(FailedEffect::GamblerDeath),
                "moonchild" => Some(FailedEffect::MoonchildDeath),
                "grandmother" => Some(FailedEffect::GrandmotherDeath),
                _ => None,
            });
    let mut audit = failed
        .map(|effect| crate::death::prevented_failure(killer, attempt, outcome, effect, event))
        .unwrap_or_default();
    if !outcome.died {
        return audit;
    }
    if attempt.unpreventable {
        if let (Some(killer), Some(protection)) = (
            killer.and_then(|o| o.ability_use.as_ref()),
            fool_protection(f, attempt),
        ) {
            let o = ActionOccurrence::character(
                FirstNightActionRef::character("fool", "preventDeath"),
                protection.source,
            )
            .expect("fool source")
            .in_night(f.night_number());
            audit.extend(crate::death::ability_failure(
                &o,
                killer,
                FailedEffect::FoolProtection,
                event,
            ));
        }
    } else {
        for r in &f.ability_provenance {
            let s = &r.ability_use;
            if s.owner_player_id == attempt.player_id
                && s.character_id == "fool"
                && crate::effects::available(f, s)
                && !f.ability_uses.iter().any(|u| u.ability_use == *s)
            {
                let o = ActionOccurrence::character(
                    FirstNightActionRef::character("fool", "preventDeath"),
                    s.clone(),
                )
                .expect("fool source")
                .in_night(f.night_number());
                audit.extend(super::sects_and_violets::night_impairment_failure(
                    f,
                    &o,
                    event,
                    crate::state::FailedEffect::FoolProtection,
                ));
            }
        }
    }
    let demon = killer
        .and_then(|o| o.ability_use.as_ref())
        .is_some_and(|s| super::character_kind(&s.character_id) == Some(CharacterKind::Demon));
    for e in &f.confirmed_actions {
        let Some(s) = &e.occurrence.ability_use else {
            continue;
        };
        if !crate::effects::available(f, s)
            || !f.player(&s.owner_player_id).is_some_and(|p| p.alive)
        {
            continue;
        }
        let effect = match &e.result {
            CustomActionResult::GrandmotherLearned {
                target_player_id, ..
            } if demon && target_player_id == attempt.player_id => {
                Some(crate::state::FailedEffect::GrandmotherDeath)
            }
            CustomActionResult::DevilsAdvocateProtected {
                target_player_id,
                night,
                ..
            } if attempt.execution
                && target_player_id == attempt.player_id
                && f.day.as_ref().is_some_and(|d| d.day == *night) =>
            {
                Some(crate::state::FailedEffect::DevilsAdvocateProtection)
            }
            _ => None,
        };
        if let Some(effect) = effect {
            audit.extend(super::sects_and_violets::night_impairment_failure(
                f,
                &e.occurrence.clone().in_night(f.night_number()),
                event,
                effect,
            ));
        }
    }
    audit
}

/// The first actual death also spends Fool when drunk, poisoned or overridden.
/// Other protection does not spend it because no death occurs.
pub(crate) fn fool_death_consumption(
    f: &crate::state::CustomGameFacts,
    outcome: &crate::death::Outcome,
) -> Vec<AbilityUseRef> {
    if !outcome.died {
        return vec![];
    }
    f.ability_provenance
        .iter()
        .map(|r| &r.ability_use)
        .filter(|s| {
            s.character_id == "fool"
                && s.owner_player_id == outcome.player_id
                && crate::effects::available(f, s)
        })
        .cloned()
        .collect()
}

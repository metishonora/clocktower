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
    vec![("chambermaid", CharacterKind::Townsfolk)]
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
        || *action == FirstNightActionRef::character("chambermaid", "learnCount")
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
    vec![RegisteredAction {
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
    }]
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

use std::collections::HashMap;

use crate::{
    contracts::{FirstNightActionRef, FirstNightOrderPlan},
    custom::first_night::{
        compose_steps, reduce_progress, system_action_registry, ActionContext, ActionHandler,
        ActionRegistry, ActionSpec, ActiveAbilityInstance, ConfirmedActionEvent,
        FirstNightProgress, FirstNightRuleService, RegisteredAction,
    },
    error::{CoreError, ErrorKind},
    model::{
        AbilityInstanceId, AbilityOrigin, AbilityUseRef, Phase, PhaseStep, PhaseStepSupport,
        StepType,
    },
    phase::required_none,
};

fn action(character_id: &str, action_id: &str) -> FirstNightActionRef {
    FirstNightActionRef::Character {
        character_id: character_id.to_string(),
        action_id: action_id.to_string(),
    }
}

struct FixtureRules {
    instances: HashMap<FirstNightActionRef, Vec<ActiveAbilityInstance>>,
    minion_present: bool,
    demon_present: bool,
}

impl Default for FixtureRules {
    fn default() -> Self {
        Self {
            instances: HashMap::new(),
            minion_present: true,
            demon_present: true,
        }
    }
}

impl FirstNightRuleService for FixtureRules {
    fn active_instances(&self, action_ref: &FirstNightActionRef) -> Vec<ActiveAbilityInstance> {
        self.instances.get(action_ref).cloned().unwrap_or_default()
    }

    fn has_minion(&self) -> bool {
        self.minion_present
    }

    fn has_demon(&self) -> bool {
        self.demon_present
    }

    fn legal_demon_bluff_character_ids(&self) -> Vec<String> {
        vec!["soldier".into(), "mayor".into(), "saint".into()]
    }
}

struct FixtureHandler {
    identity: FirstNightActionRef,
}

impl ActionHandler for FixtureHandler {
    fn action_ref(&self) -> &FirstNightActionRef {
        &self.identity
    }

    fn project(
        &self,
        _spec: &ActionSpec,
        context: &ActionContext<'_>,
    ) -> Result<Vec<PhaseStep>, CoreError> {
        let mut instances = context.rule_service.active_instances(&self.identity);
        instances.sort_by(|left, right| {
            left.seat.cmp(&right.seat).then_with(|| {
                left.ability_use
                    .ability_instance_id
                    .cmp(&right.ability_use.ability_instance_id)
            })
        });
        Ok(instances
            .into_iter()
            .map(|instance| PhaseStep {
                id: format!(
                    "firstNight:fixture:{}:{}",
                    instance.seat,
                    instance.ability_use.ability_instance_id.as_str(),
                ),
                phase: Phase::FirstNight,
                step_type: StepType::Character,
                character: Some(instance.ability_use.character_id.clone()),
                player_id: Some(instance.ability_use.owner_player_id.clone()),
                ability_use: Some(instance.ability_use),
                ability_origin: Some(instance.ability_origin),
                required_input: required_none(),
                can_skip: false,
                support: PhaseStepSupport::Automated,
                information_prompt: None,
                pre_action_reveal: None,
                action_ref: Some(self.identity.clone()),
            })
            .collect())
    }

    fn propose(
        &self,
        _spec: &ActionSpec,
        _context: &ActionContext<'_>,
        step: &PhaseStep,
    ) -> Result<ConfirmedActionEvent, CoreError> {
        Ok(ConfirmedActionEvent {
            action_ref: self.identity.clone(),
            step_id: step.id.clone(),
            ability_use: step.ability_use.clone(),
        })
    }

    fn validate_event(
        &self,
        _spec: &ActionSpec,
        _context: &ActionContext<'_>,
        event: &ConfirmedActionEvent,
    ) -> Result<(), CoreError> {
        if event.action_ref != self.identity {
            return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
        }
        Ok(())
    }
}

fn instance(seat: u8, player_id: &str, source: &str) -> ActiveAbilityInstance {
    ActiveAbilityInstance {
        seat,
        ability_use: AbilityUseRef {
            owner_player_id: player_id.to_string(),
            character_id: "fixtureCharacter".to_string(),
            ability_instance_id: AbilityInstanceId::new(source, player_id),
        },
        ability_origin: AbilityOrigin::IdentityBound,
    }
}

fn registration(
    spec_ref: FirstNightActionRef,
    handler_ref: FirstNightActionRef,
) -> RegisteredAction {
    RegisteredAction {
        spec: ActionSpec {
            action_ref: spec_ref,
            participates_in_first_night: true,
            required_input_kind: crate::model::RequiredInputKind::None,
            support: PhaseStepSupport::Automated,
        },
        handler: Box::new(FixtureHandler {
            identity: handler_ref,
        }),
    }
}

#[test]
fn registry_rejects_duplicate_and_spec_handler_identity_mismatch_without_fallback() {
    let alpha = action("fixtureCharacter", "alpha");
    let beta = action("fixtureCharacter", "beta");

    let mismatch =
        ActionRegistry::new(vec![registration(alpha.clone(), beta.clone())]).unwrap_err();
    assert_eq!(mismatch.code, "FIRST_NIGHT_ACTION_REGISTRATION_INVALID");

    let duplicate = ActionRegistry::new(vec![
        registration(alpha.clone(), alpha.clone()),
        registration(alpha.clone(), alpha.clone()),
    ])
    .unwrap_err();
    assert_eq!(duplicate.code, "FIRST_NIGHT_ACTION_REGISTRATION_INVALID");

    let registry = ActionRegistry::new(vec![registration(alpha.clone(), alpha)]).unwrap();
    let missing = registry.lookup(&beta).unwrap_err();
    assert_eq!(missing.code, "FIRST_NIGHT_ACTION_HANDLER_UNAVAILABLE");
}

#[test]
fn composer_projects_zero_one_or_many_instances_in_stable_identity_order_without_mutation() {
    let alpha = action("fixtureCharacter", "alpha");
    let beta = action("fixtureCharacter", "beta");
    let gamma = action("fixtureCharacter", "gamma");
    let registry = ActionRegistry::new(vec![
        registration(alpha.clone(), alpha.clone()),
        registration(beta.clone(), beta.clone()),
        registration(gamma.clone(), gamma.clone()),
    ])
    .unwrap();
    let mut rules = FixtureRules::default();
    rules
        .instances
        .insert(beta.clone(), vec![instance(2, "p2", "setup-1")]);
    rules.instances.insert(
        gamma.clone(),
        vec![
            instance(3, "p3", "grant-2"),
            instance(1, "p1", "setup-1"),
            instance(3, "p3b", "grant-1"),
        ],
    );
    let context = ActionContext {
        rule_service: &rules,
    };
    let plan = FirstNightOrderPlan(vec![alpha, beta, gamma.clone()]);

    let first = compose_steps(&plan, &registry, &context).unwrap();
    let second = compose_steps(&plan, &registry, &context).unwrap();
    assert_eq!(first.len(), 4);
    assert_eq!(
        first
            .iter()
            .map(|step| step.player_id.as_deref().unwrap())
            .collect::<Vec<_>>(),
        ["p2", "p1", "p3b", "p3"],
    );
    assert_eq!(
        serde_json::to_value(first).unwrap(),
        serde_json::to_value(second).unwrap(),
    );
    assert_eq!(rules.instances[&gamma].len(), 3);
}

#[test]
fn composer_skips_character_with_no_active_instances_before_handler_lookup() {
    let skipped = action("fixtureCharacter", "skipped");
    let handled = action("fixtureCharacter", "handled");
    let registry =
        ActionRegistry::new(vec![registration(handled.clone(), handled.clone())]).unwrap();
    let mut rules = FixtureRules::default();
    rules
        .instances
        .insert(handled.clone(), vec![instance(1, "p1", "setup-1")]);
    let context = ActionContext {
        rule_service: &rules,
    };

    let steps = compose_steps(
        &FirstNightOrderPlan(vec![skipped, handled]),
        &registry,
        &context,
    )
    .unwrap();

    assert_eq!(steps.len(), 1);
    assert_eq!(steps[0].player_id.as_deref(), Some("p1"));
}

#[test]
fn composer_errors_when_active_character_has_no_handler() {
    let missing = action("fixtureCharacter", "missing");
    let registry = ActionRegistry::new(Vec::new()).unwrap();
    let mut rules = FixtureRules::default();
    rules
        .instances
        .insert(missing.clone(), vec![instance(1, "p1", "setup-1")]);
    let context = ActionContext {
        rule_service: &rules,
    };

    let error =
        compose_steps(&FirstNightOrderPlan(vec![missing]), &registry, &context).unwrap_err();

    assert_eq!(error.code, "FIRST_NIGHT_ACTION_HANDLER_UNAVAILABLE");
}

#[test]
fn composer_preserves_relative_order_around_skipped_character_action() {
    let before = action("fixtureCharacter", "before");
    let skipped = action("fixtureCharacter", "skipped");
    let after = action("fixtureCharacter", "after");
    let registry = ActionRegistry::new(vec![
        registration(before.clone(), before.clone()),
        registration(after.clone(), after.clone()),
    ])
    .unwrap();
    let mut rules = FixtureRules::default();
    rules
        .instances
        .insert(before, vec![instance(1, "p1", "setup-1")]);
    rules
        .instances
        .insert(after, vec![instance(2, "p2", "setup-2")]);
    let context = ActionContext {
        rule_service: &rules,
    };

    let steps = compose_steps(
        &FirstNightOrderPlan(vec![
            action("fixtureCharacter", "before"),
            skipped,
            action("fixtureCharacter", "after"),
        ]),
        &registry,
        &context,
    )
    .unwrap();

    assert_eq!(
        steps
            .iter()
            .map(|step| step.player_id.as_deref().unwrap())
            .collect::<Vec<_>>(),
        ["p1", "p2"],
    );
}

#[test]
fn proposal_replay_validation_and_reducer_share_action_identity_and_events_alone_change_progress() {
    let alpha = action("fixtureCharacter", "alpha");
    let registry = ActionRegistry::new(vec![registration(alpha.clone(), alpha.clone())]).unwrap();
    let mut rules = FixtureRules::default();
    rules
        .instances
        .insert(alpha.clone(), vec![instance(1, "p1", "setup-1")]);
    let context = ActionContext {
        rule_service: &rules,
    };
    let plan = FirstNightOrderPlan(vec![alpha.clone()]);
    let steps = compose_steps(&plan, &registry, &context).unwrap();

    let event = registry.propose(&alpha, &context, &steps[0]).unwrap();
    registry.validate_event(&alpha, &context, &event).unwrap();
    let forged = ConfirmedActionEvent {
        action_ref: action("fixtureCharacter", "beta"),
        ..event.clone()
    };
    assert_eq!(
        registry
            .validate_event(&alpha, &context, &forged)
            .unwrap_err()
            .code,
        "INVALID_FIRST_NIGHT_ACTION_PROVENANCE",
    );

    let initial = FirstNightProgress::default();
    let unchanged = initial.clone();
    registry.propose(&alpha, &context, &steps[0]).unwrap();
    assert_eq!(
        initial, unchanged,
        "handler invocation must not mutate replay state"
    );
    let reduced = reduce_progress(&initial, &event).unwrap();
    assert_eq!(
        initial, unchanged,
        "reducer returns new replay-derived state"
    );
    assert!(reduced.completed_step_ids.contains(&event.step_id));
}

#[test]
fn system_and_character_actions_interleave_in_one_ordered_composer() {
    let character = action("fixtureCharacter", "alpha");
    let mut registry = system_action_registry().unwrap();
    registry
        .register(registration(character.clone(), character.clone()))
        .unwrap();
    let mut rules = FixtureRules::default();
    rules
        .instances
        .insert(character.clone(), vec![instance(1, "p1", "setup-1")]);
    let context = ActionContext {
        rule_service: &rules,
    };
    let plan = FirstNightOrderPlan(vec![
        FirstNightActionRef::system("dusk"),
        FirstNightActionRef::system("minionInfo"),
        character,
        FirstNightActionRef::system("demonInfo"),
        FirstNightActionRef::system("dawn"),
    ]);

    let steps = compose_steps(&plan, &registry, &context).unwrap();
    assert_eq!(
        steps
            .iter()
            .map(|step| step.id.as_str())
            .collect::<Vec<_>>(),
        [
            "firstNight:system:minionInfo",
            "firstNight:fixture:1:setup-1:p1",
            "firstNight:system:demonInfo",
            "firstNight:system:dawn",
        ],
    );
}

#[test]
fn system_info_actions_are_skipped_when_alignment_is_absent() {
    let registry = system_action_registry().unwrap();
    let rules = FixtureRules {
        minion_present: false,
        demon_present: false,
        ..FixtureRules::default()
    };
    let context = ActionContext {
        rule_service: &rules,
    };
    let plan = FirstNightOrderPlan(vec![
        FirstNightActionRef::system("dusk"),
        FirstNightActionRef::system("minionInfo"),
        FirstNightActionRef::system("demonInfo"),
        FirstNightActionRef::system("dawn"),
    ]);

    let steps = compose_steps(&plan, &registry, &context).unwrap();

    assert_eq!(
        steps
            .iter()
            .map(|step| step.id.as_str())
            .collect::<Vec<_>>(),
        ["firstNight:system:dawn"],
    );
}

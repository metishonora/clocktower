use std::collections::HashMap;

use crate::{
    contracts::{
        FirstNightActionRef, FirstNightOrderPlan, GameEvent, GameEventKind, PhaseStepEventPayload,
    },
    error::{CoreError, ErrorKind},
    first_night::{
        advance_progress, initial_progress, ActionContext, ActionEventDraft, ActionHandler,
        ActionRegistry, ActionSpec, ActivationContext, ActivationDecision, ActivationRule,
        ActiveAbilityInstance, FirstNightRuleService, RegisteredAction,
    },
    input::required_none,
    model::{
        AbilityInstanceId, AbilityOrigin, AbilityUseRef, Phase, PhaseStep, PhaseStepSupport,
        RequiredInputKind, StepInput, StepType,
    },
    state::{ActionOccurrence, ActionOccurrenceIdentity, CustomGameFacts},
};

#[derive(Clone)]
struct SchedulerRules {
    owned: HashMap<FirstNightActionRef, Vec<ActiveAbilityInstance>>,
    active: HashMap<FirstNightActionRef, Vec<ActiveAbilityInstance>>,
    facts: CustomGameFacts,
}

impl Default for SchedulerRules {
    fn default() -> Self {
        Self {
            owned: HashMap::new(),
            active: HashMap::new(),
            facts: CustomGameFacts::default(),
        }
    }
}

impl FirstNightRuleService for SchedulerRules {
    fn active_instances(&self, action_ref: &FirstNightActionRef) -> Vec<ActiveAbilityInstance> {
        self.active.get(action_ref).cloned().unwrap_or_default()
    }

    fn try_active_instances(
        &self,
        action_ref: &FirstNightActionRef,
    ) -> Result<Vec<ActiveAbilityInstance>, CoreError> {
        Ok(self.active_instances(action_ref))
    }

    fn try_owned_instances(
        &self,
        action_ref: &FirstNightActionRef,
    ) -> Result<Vec<ActiveAbilityInstance>, CoreError> {
        Ok(self.owned.get(action_ref).cloned().unwrap_or_default())
    }

    fn facts(&self) -> Option<&CustomGameFacts> {
        Some(&self.facts)
    }

    fn has_minion(&self) -> bool {
        false
    }

    fn has_demon(&self) -> bool {
        false
    }

    fn legal_demon_bluff_character_ids(&self) -> Vec<String> {
        vec![]
    }

    fn validate_character_membership(&self, _character_id: &str) -> Result<(), CoreError> {
        Ok(())
    }
}

struct FixtureHandler {
    action_ref: FirstNightActionRef,
}

impl ActionHandler for FixtureHandler {
    fn action_ref(&self) -> &FirstNightActionRef {
        &self.action_ref
    }

    fn project(
        &self,
        _spec: &ActionSpec,
        context: &ActionContext<'_>,
    ) -> Result<Vec<PhaseStep>, CoreError> {
        let mut instances = context
            .rule_service
            .try_active_instances(&self.action_ref)?;
        instances.sort_by(|left, right| {
            left.seat
                .cmp(&right.seat)
                .then_with(|| {
                    left.ability_use
                        .owner_player_id
                        .cmp(&right.ability_use.owner_player_id)
                })
                .then_with(|| {
                    left.ability_use
                        .ability_instance_id
                        .cmp(&right.ability_use.ability_instance_id)
                })
        });
        instances
            .into_iter()
            .map(|instance| {
                let occurrence = ActionOccurrence::character(
                    self.action_ref.clone(),
                    instance.ability_use.clone(),
                )?;
                Ok(PhaseStep {
                    simulation_source: None,
                    follow_up_cause: None,
                    action_cause: None,
                    id: occurrence.step_id()?,
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
                    action_ref: Some(self.action_ref.clone()),
                })
            })
            .collect()
    }

    fn propose(
        &self,
        _spec: &ActionSpec,
        _context: &ActionContext<'_>,
        occurrence: &ActionOccurrence,
        input: &StepInput,
    ) -> Result<ActionEventDraft, CoreError> {
        if input.is_some() {
            return Err(ErrorKind::InvalidStepInput.into_error());
        }
        Ok(ActionEventDraft::Custom(
            crate::event::CustomActionEventDraft {
                simulation_source: None,
                follow_up_cause: None,
                action_cause: None,
                delivered_result: None,
                registration_judgments: vec![],
                step_id: occurrence.step_id()?,
                action_ref: self.action_ref.clone(),
                ability_use: occurrence.ability_use.clone(),
                input: input.clone(),
                result: crate::contracts::CustomActionResult::NoEffect,
            },
        ))
    }

    fn validate_event(
        &self,
        _spec: &ActionSpec,
        _context: &ActionContext<'_>,
        _occurrence: &ActionOccurrence,
        draft: &ActionEventDraft,
    ) -> Result<crate::event::CustomFactChanges, CoreError> {
        let ActionEventDraft::Custom(custom) = draft else {
            return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
        };
        if custom.input.is_some()
            || !matches!(
                custom.result,
                crate::contracts::CustomActionResult::NoEffect
            )
        {
            return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
        }
        Ok(crate::event::CustomFactChanges::default())
    }
}

struct ActivationFixture {
    decisions: HashMap<FirstNightActionRef, ActivationDecision>,
    occurrence_decisions: Vec<(ActionOccurrenceIdentity, ActivationDecision)>,
}

impl ActivationRule for ActivationFixture {
    fn decide(&self, context: &ActivationContext<'_>) -> Result<ActivationDecision, CoreError> {
        Ok(self
            .occurrence_decisions
            .iter()
            .find(|(identity, _)| *identity == context.occurrence.identity())
            .map(|(_, decision)| *decision)
            .or_else(|| self.decisions.get(context.action_ref).copied())
            .unwrap_or(ActivationDecision::NoAction))
    }
}

struct RejectingActivation;

impl ActivationRule for RejectingActivation {
    fn decide(&self, _context: &ActivationContext<'_>) -> Result<ActivationDecision, CoreError> {
        Err(ErrorKind::InvalidFirstNightActionProvenance.into_error())
    }
}

fn action(action_id: &str) -> FirstNightActionRef {
    FirstNightActionRef::Character {
        character_id: "fixtureCharacter".to_string(),
        action_id: action_id.to_string(),
    }
}

fn instance(seat: u8, owner: &str, source: &str) -> ActiveAbilityInstance {
    instance_with_origin(seat, owner, source, AbilityOrigin::IdentityBound)
}

fn instance_with_origin(
    seat: u8,
    owner: &str,
    source: &str,
    ability_origin: AbilityOrigin,
) -> ActiveAbilityInstance {
    ActiveAbilityInstance {
        seat,
        ability_use: AbilityUseRef {
            owner_player_id: owner.to_string(),
            character_id: "fixtureCharacter".to_string(),
            ability_instance_id: AbilityInstanceId::new(source, owner),
        },
        ability_origin,
    }
}

fn registration(action_ref: FirstNightActionRef) -> RegisteredAction {
    RegisteredAction {
        spec: ActionSpec {
            action_ref: action_ref.clone(),
            participates_in_first_night: true,
            required_input_kind: RequiredInputKind::None,
            support: PhaseStepSupport::Automated,
        },
        handler: Box::new(FixtureHandler { action_ref }),
    }
}

fn context(rules: &SchedulerRules) -> ActionContext<'_> {
    ActionContext {
        event_id: "",
        rule_service: rules,
    }
}

fn character_event(
    registry: &ActionRegistry,
    context: &ActionContext<'_>,
    occurrence: &ActionOccurrence,
    id: &str,
) -> crate::first_night::ValidatedActionEvent {
    let draft = registry
        .propose(&occurrence.action_ref, context, occurrence, &None)
        .expect("fixture occurrence should produce a draft");
    let ActionEventDraft::Custom(draft) = draft else {
        panic!("fixture action should use the custom envelope");
    };
    let payload = draft.into_payload();
    let event = GameEvent {
        id: id.to_string(),
        kind: GameEventKind::CustomActionConfirmed { payload },
        phase: Phase::FirstNight,
        summary: "fixture".to_string(),
        created_at: "2026-09-07T00:00:00.000Z".to_string(),
    };
    registry
        .validate_event(occurrence, context, &event)
        .expect("fixture event should validate")
}

fn system_event(
    registry: &ActionRegistry,
    context: &ActionContext<'_>,
    action_ref: FirstNightActionRef,
    id: &str,
) -> crate::first_night::ValidatedActionEvent {
    let occurrence = ActionOccurrence::system(action_ref.clone()).unwrap();
    let draft = registry
        .propose(&action_ref, context, &occurrence, &None)
        .expect("system occurrence should produce a draft");
    let ActionEventDraft::System(draft) = draft else {
        panic!("system action should use the legacy envelope");
    };
    let event = GameEvent {
        id: id.to_string(),
        kind: GameEventKind::PhaseStepConfirmed {
            payload: Box::new(PhaseStepEventPayload {
                step_id: draft.step_id,
                action_ref: Some(draft.action_ref),
                ability_use: None,
                input: draft.input,
                information: None,
            }),
        },
        phase: Phase::FirstNight,
        summary: "system".to_string(),
        created_at: "2026-09-07T00:00:00.000Z".to_string(),
    };
    registry
        .validate_event(&occurrence, context, &event)
        .expect("system event should validate")
}

fn registry(actions: &[FirstNightActionRef]) -> ActionRegistry {
    let mut registry =
        crate::first_night::system_action_registry().expect("system registry should build");
    for action_ref in actions {
        registry
            .register(registration(action_ref.clone()))
            .expect("fixture action should register");
    }
    registry
}

fn plan(actions: &[FirstNightActionRef]) -> FirstNightOrderPlan {
    let mut refs = actions.to_vec();
    refs.push(FirstNightActionRef::system("dawn"));
    FirstNightOrderPlan(refs)
}

fn rules_for(
    owned: impl IntoIterator<Item = (FirstNightActionRef, Vec<ActiveAbilityInstance>)>,
    active: impl IntoIterator<Item = (FirstNightActionRef, Vec<ActiveAbilityInstance>)>,
) -> SchedulerRules {
    SchedulerRules {
        owned: owned.into_iter().collect(),
        active: active.into_iter().collect(),
        ..SchedulerRules::default()
    }
}

#[test]
fn scheduler_passes_empty_entries_and_orders_zero_one_and_many_occurrences() {
    let empty = action("empty");
    let one = action("one");
    let many = action("many");
    let registry = registry(&[empty.clone(), one.clone(), many.clone()]);
    let one_instance = instance(2, "p2", "setup");
    let many_instances = vec![
        instance(3, "a-seat-three", "b"),
        instance(1, "z-seat-one", "a"),
        instance(3, "m-seat-three", "a"),
    ];
    let rules = rules_for(
        [
            (one.clone(), vec![one_instance.clone()]),
            (many.clone(), many_instances.clone()),
        ],
        [
            (one.clone(), vec![one_instance]),
            (many.clone(), many_instances),
        ],
    );
    let context = context(&rules);
    let plan = plan(&[empty.clone(), one.clone(), many.clone()]);
    let progress = initial_progress(&plan, &registry, &context).unwrap();
    assert_eq!(progress.cursor, 1);
    assert_eq!(
        progress
            .current_occurrences
            .iter()
            .map(|occurrence| occurrence.actor_player_id().unwrap())
            .collect::<Vec<_>>(),
        vec!["p2"],
    );

    let one_event = character_event(
        &registry,
        &context,
        &progress.current_occurrences[0],
        "one-event",
    );
    let activation = ActivationFixture {
        decisions: HashMap::new(),
        occurrence_decisions: Vec::new(),
    };
    let after_one = advance_progress(
        &plan,
        &registry,
        &progress,
        &context,
        &context,
        &one_event,
        &activation,
    )
    .unwrap();
    let after_one_repeat = advance_progress(
        &plan,
        &registry,
        &progress,
        &context,
        &context,
        &one_event,
        &activation,
    )
    .unwrap();
    assert_eq!(after_one, after_one_repeat);
    assert_eq!(progress.cursor, 1, "the previous progress stays immutable");
    assert_eq!(after_one.cursor, 2);
    assert_eq!(
        after_one
            .current_occurrences
            .iter()
            .map(|occurrence| (
                occurrence.actor_player_id().unwrap(),
                occurrence
                    .ability_use
                    .as_ref()
                    .unwrap()
                    .ability_instance_id
                    .as_str(),
            ))
            .collect::<Vec<_>>(),
        vec![
            ("z-seat-one", "a:z-seat-one"),
            ("a-seat-three", "b:a-seat-three"),
            ("m-seat-three", "a:m-seat-three"),
        ],
        "many instances use literal seat then identity order even when IDs disagree",
    );

    let first_many_event = character_event(
        &registry,
        &context,
        &after_one.current_occurrences[0],
        "many-event-1",
    );
    let after_first_many = advance_progress(
        &plan,
        &registry,
        &after_one,
        &context,
        &context,
        &first_many_event,
        &activation,
    )
    .unwrap();
    assert_eq!(
        after_first_many
            .current_occurrences
            .iter()
            .map(|occurrence| occurrence.actor_player_id().unwrap())
            .collect::<Vec<_>>(),
        vec!["a-seat-three", "m-seat-three"],
        "the first many occurrence is completed exactly once",
    );
}

#[test]
fn scheduler_keeps_completed_occurrences_distinct_when_current_entry_has_multiple_instances() {
    let current = action("current");
    let registry = registry(&[current.clone()]);
    let first = instance(1, "p1", "setup");
    let second = instance(2, "p2", "setup");
    let third = instance(3, "p3", "grant");
    let before_rules = rules_for(
        [(current.clone(), vec![first.clone(), second.clone()])],
        [(current.clone(), vec![first.clone(), second.clone()])],
    );
    let after_rules = rules_for(
        [(
            current.clone(),
            vec![first.clone(), second.clone(), third.clone()],
        )],
        [(
            current.clone(),
            vec![first.clone(), second.clone(), third.clone()],
        )],
    );
    let before_context = context(&before_rules);
    let after_context = context(&after_rules);
    let plan = plan(&[current.clone()]);
    let initial = initial_progress(&plan, &registry, &before_context).unwrap();
    let first_occurrence = initial.current_occurrences[0].clone();
    let event = character_event(&registry, &before_context, &first_occurrence, "event-1");
    let activation = ActivationFixture {
        decisions: [(current.clone(), ActivationDecision::JoinPendingOrder)]
            .into_iter()
            .collect(),
        occurrence_decisions: Vec::new(),
    };
    let next = advance_progress(
        &plan,
        &registry,
        &initial,
        &before_context,
        &after_context,
        &event,
        &activation,
    )
    .unwrap();
    assert_eq!(initial.current_occurrences[0], first_occurrence);
    assert_eq!(next.completed_occurrences.len(), 1);
    assert_eq!(next.completed_history.len(), 1);
    assert_eq!(
        next.current_occurrences
            .iter()
            .map(|occurrence| occurrence.actor_player_id().unwrap())
            .collect::<Vec<_>>(),
        ["p2", "p3"],
    );
    assert!(!next
        .current_occurrences
        .iter()
        .any(|occurrence| occurrence.identity() == first_occurrence.identity()));
}

#[test]
fn scheduler_defer_and_no_action_close_past_entries_without_reprojection() {
    let source = action("source");
    let target = action("target");
    let registry = registry(&[source.clone(), target.clone()]);
    let source_instance = instance(1, "source-player", "setup");
    let target_instance = instance(2, "target-player", "grant");
    let before_rules = rules_for(
        [(source.clone(), vec![source_instance.clone()])],
        [(source.clone(), vec![source_instance.clone()])],
    );
    let after_rules = rules_for(
        [
            (source.clone(), vec![source_instance.clone()]),
            (target.clone(), vec![target_instance.clone()]),
        ],
        [
            (source.clone(), vec![source_instance.clone()]),
            (target.clone(), vec![target_instance.clone()]),
        ],
    );
    let before_context = context(&before_rules);
    let after_context = context(&after_rules);
    let plan = plan(&[source.clone(), target.clone()]);
    let initial = initial_progress(&plan, &registry, &before_context).unwrap();
    let source_occurrence = initial.current_occurrences[0].clone();
    let event = character_event(
        &registry,
        &before_context,
        &source_occurrence,
        "source-event",
    );
    for decision in [ActivationDecision::Defer, ActivationDecision::NoAction] {
        let activation = ActivationFixture {
            decisions: [(target.clone(), decision)].into_iter().collect(),
            occurrence_decisions: Vec::new(),
        };
        let next = advance_progress(
            &plan,
            &registry,
            &initial,
            &before_context,
            &after_context,
            &event,
            &activation,
        )
        .unwrap();
        assert_eq!(next.cursor, 2, "closed target must stay past the cursor");
        assert!(next
            .current_occurrences
            .iter()
            .all(|occurrence| occurrence.action_ref != target));
        assert!(next.immediate_queue.is_empty());
        assert!(next.excluded_occurrences.iter().any(|key| {
            key.action_ref == target && key.ability_use == Some(target_instance.ability_use.clone())
        }));

        let dawn = system_event(
            &registry,
            &after_context,
            FirstNightActionRef::system("dawn"),
            "dawn",
        );
        let ended = advance_progress(
            &plan,
            &registry,
            &next,
            &after_context,
            &after_context,
            &dawn,
            &activation,
        )
        .unwrap();
        assert!(ended.ended);
        assert!(ended.immediate_queue.is_empty());
        assert!(ended
            .completed_history
            .iter()
            .all(|completed| completed.occurrence.action_ref != target));
    }
}

#[test]
fn scheduler_join_pending_admits_new_instance_only_while_entry_is_pending() {
    let source = action("source");
    let target = action("target");
    let registry = registry(&[source.clone(), target.clone()]);
    let source_instance = instance(1, "source-player", "setup");
    let target_instance = instance(2, "target-player", "grant");
    let before_rules = rules_for(
        [(source.clone(), vec![source_instance.clone()])],
        [(source.clone(), vec![source_instance.clone()])],
    );
    let after_rules = rules_for(
        [
            (source.clone(), vec![source_instance.clone()]),
            (target.clone(), vec![target_instance.clone()]),
        ],
        [
            (source.clone(), vec![source_instance.clone()]),
            (target.clone(), vec![target_instance.clone()]),
        ],
    );
    let before_context = context(&before_rules);
    let after_context = context(&after_rules);
    let plan = plan(&[source.clone(), target.clone()]);
    let initial = initial_progress(&plan, &registry, &before_context).unwrap();
    let source_occurrence = initial.current_occurrences[0].clone();
    let event = character_event(
        &registry,
        &before_context,
        &source_occurrence,
        "source-event",
    );
    let activation = ActivationFixture {
        decisions: [(target.clone(), ActivationDecision::JoinPendingOrder)]
            .into_iter()
            .collect(),
        occurrence_decisions: Vec::new(),
    };
    let next = advance_progress(
        &plan,
        &registry,
        &initial,
        &before_context,
        &after_context,
        &event,
        &activation,
    )
    .unwrap();
    assert_eq!(next.cursor, 1);
    assert_eq!(next.current_occurrences.len(), 1);
    assert_eq!(
        next.current_occurrences[0].identity(),
        target_instance_occurrence(&target, &target_instance)
    );
}

#[test]
fn scheduler_join_pending_for_past_entry_never_rewinds_the_cursor() {
    let target = action("target");
    let source = action("source");
    let registry = registry(&[target.clone(), source.clone()]);
    let target_instance = instance(1, "target-player", "grant");
    let source_instance = instance(2, "source-player", "setup");
    let before_rules = rules_for(
        [
            (target.clone(), vec![target_instance.clone()]),
            (source.clone(), vec![source_instance.clone()]),
        ],
        [(source.clone(), vec![source_instance.clone()])],
    );
    let after_rules = rules_for(
        [
            (target.clone(), vec![target_instance.clone()]),
            (source.clone(), vec![source_instance.clone()]),
        ],
        [
            (target.clone(), vec![target_instance]),
            (source.clone(), vec![source_instance.clone()]),
        ],
    );
    let before_context = context(&before_rules);
    let after_context = context(&after_rules);
    let plan = plan(&[target.clone(), source.clone()]);
    let initial = initial_progress(&plan, &registry, &before_context).unwrap();
    assert_eq!(
        initial.cursor, 1,
        "the inactive target entry is already past"
    );
    let source_occurrence = initial.current_occurrences[0].clone();
    let event = character_event(
        &registry,
        &before_context,
        &source_occurrence,
        "source-event",
    );
    let activation = ActivationFixture {
        decisions: [(target.clone(), ActivationDecision::JoinPendingOrder)]
            .into_iter()
            .collect(),
        occurrence_decisions: Vec::new(),
    };
    let next = advance_progress(
        &plan,
        &registry,
        &initial,
        &before_context,
        &after_context,
        &event,
        &activation,
    )
    .unwrap();
    assert_eq!(next.cursor, 2, "a past JoinPending entry cannot rewind");
    assert!(next
        .current_occurrences
        .iter()
        .all(|occurrence| occurrence.action_ref != target));
    assert!(next.immediate_queue.is_empty());
}

#[test]
fn scheduler_reprojects_an_existing_owned_instance_when_participation_changes() {
    let source = action("source");
    let target = action("target");
    let registry = registry(&[source.clone(), target.clone()]);
    let source_instance = instance(1, "source-player", "setup");
    let target_instance = instance(2, "target-player", "owned-before-night");
    let before_rules = rules_for(
        [
            (source.clone(), vec![source_instance.clone()]),
            (target.clone(), vec![target_instance.clone()]),
        ],
        [(source.clone(), vec![source_instance.clone()])],
    );
    let after_rules = rules_for(
        [
            (source.clone(), vec![source_instance.clone()]),
            (target.clone(), vec![target_instance.clone()]),
        ],
        [
            (source.clone(), vec![source_instance.clone()]),
            (target.clone(), vec![target_instance.clone()]),
        ],
    );
    let before_context = context(&before_rules);
    let after_context = context(&after_rules);
    let plan = plan(&[source.clone(), target.clone()]);
    let initial = initial_progress(&plan, &registry, &before_context).unwrap();
    let source_occurrence = initial.current_occurrences[0].clone();
    let event = character_event(
        &registry,
        &before_context,
        &source_occurrence,
        "source-event",
    );
    let next = advance_progress(
        &plan,
        &registry,
        &initial,
        &before_context,
        &after_context,
        &event,
        &RejectingActivation,
    )
    .unwrap();
    assert_eq!(next.cursor, 1);
    assert_eq!(
        next.current_occurrences[0].identity(),
        target_instance_occurrence(&target, &target_instance),
        "participation re-projection does not depend on a new-instance decision",
    );
}

#[test]
fn scheduler_removes_a_new_immediate_occurrence_when_after_facts_do_not_participate() {
    let source = action("source");
    let target = action("target");
    let registry = registry(&[source.clone(), target.clone()]);
    let source_instance = instance(1, "source-player", "setup");
    let target_instance = instance(2, "target-player", "grant");
    let before_rules = rules_for(
        [(source.clone(), vec![source_instance.clone()])],
        [(source.clone(), vec![source_instance.clone()])],
    );
    let after_rules = rules_for(
        [
            (source.clone(), vec![source_instance.clone()]),
            (target.clone(), vec![target_instance]),
        ],
        [(source.clone(), vec![source_instance.clone()])],
    );
    let before_context = context(&before_rules);
    let after_context = context(&after_rules);
    let plan = plan(&[source.clone(), target.clone()]);
    let initial = initial_progress(&plan, &registry, &before_context).unwrap();
    let source_occurrence = initial.current_occurrences[0].clone();
    let event = character_event(
        &registry,
        &before_context,
        &source_occurrence,
        "source-event",
    );
    let activation = ActivationFixture {
        decisions: [(target.clone(), ActivationDecision::RunImmediately)]
            .into_iter()
            .collect(),
        occurrence_decisions: Vec::new(),
    };
    let next = advance_progress(
        &plan,
        &registry,
        &initial,
        &before_context,
        &after_context,
        &event,
        &activation,
    )
    .unwrap();
    assert!(next.immediate_queue.is_empty());
    assert_eq!(next.cursor, 2);
    assert!(next
        .current_occurrences
        .iter()
        .all(|occurrence| occurrence.action_ref != target));
    assert!(next.excluded_occurrences.is_empty());
}

#[test]
fn scheduler_does_not_lookup_a_missing_handler_for_an_excluded_entry() {
    let source = action("source");
    let target = action("target");
    let registry = registry(&[source.clone()]);
    let source_instance = instance(1, "source-player", "setup");
    let target_instance = instance(2, "target-player", "grant");
    let before_rules = rules_for(
        [(source.clone(), vec![source_instance.clone()])],
        [(source.clone(), vec![source_instance.clone()])],
    );
    let after_rules = rules_for(
        [
            (source.clone(), vec![source_instance.clone()]),
            (target.clone(), vec![target_instance]),
        ],
        [
            (source.clone(), vec![source_instance.clone()]),
            (target.clone(), vec![instance(2, "target-player", "grant")]),
        ],
    );
    let before_context = context(&before_rules);
    let after_context = context(&after_rules);
    let plan = plan(&[source.clone(), target.clone()]);
    let initial = initial_progress(&plan, &registry, &before_context).unwrap();
    let source_occurrence = initial.current_occurrences[0].clone();
    let source_event = character_event(
        &registry,
        &before_context,
        &source_occurrence,
        "source-event",
    );
    let no_action = ActivationFixture {
        decisions: [(target.clone(), ActivationDecision::NoAction)]
            .into_iter()
            .collect(),
        occurrence_decisions: Vec::new(),
    };
    let excluded = advance_progress(
        &plan,
        &registry,
        &initial,
        &before_context,
        &after_context,
        &source_event,
        &no_action,
    )
    .unwrap();
    assert_eq!(excluded.cursor, 2);
    assert!(excluded
        .current_occurrences
        .iter()
        .all(|occurrence| { occurrence.action_ref != target }));

    let join_pending = ActivationFixture {
        decisions: [(target.clone(), ActivationDecision::JoinPendingOrder)]
            .into_iter()
            .collect(),
        occurrence_decisions: Vec::new(),
    };
    assert!(advance_progress(
        &plan,
        &registry,
        &initial,
        &before_context,
        &after_context,
        &source_event,
        &join_pending,
    )
    .is_err());
}

#[test]
fn scheduler_keeps_cursor_parked_for_join_pending_during_immediate_drain() {
    let source = action("source");
    let target = action("target");
    let registry = registry(&[source.clone(), target.clone()]);
    let source_instance = instance(1, "source-player", "setup");
    let target_a = instance(2, "z-owner", "grant-a");
    let target_b = instance(3, "a-owner", "grant-b");
    let before_rules = rules_for(
        [(source.clone(), vec![source_instance.clone()])],
        [(source.clone(), vec![source_instance.clone()])],
    );
    let after_first_rules = rules_for(
        [
            (source.clone(), vec![source_instance.clone()]),
            (target.clone(), vec![target_a.clone()]),
        ],
        [
            (source.clone(), vec![source_instance.clone()]),
            (target.clone(), vec![target_a.clone()]),
        ],
    );
    let after_second_rules = rules_for(
        [
            (source.clone(), vec![source_instance.clone()]),
            (target.clone(), vec![target_a.clone(), target_b.clone()]),
        ],
        [
            (source.clone(), vec![source_instance.clone()]),
            (target.clone(), vec![target_a.clone(), target_b.clone()]),
        ],
    );
    let before_context = context(&before_rules);
    let after_first_context = context(&after_first_rules);
    let after_second_context = context(&after_second_rules);
    let plan = plan(&[source.clone(), target.clone()]);
    let initial = initial_progress(&plan, &registry, &before_context).unwrap();
    let source_occurrence = initial.current_occurrences[0].clone();
    let source_event = character_event(
        &registry,
        &before_context,
        &source_occurrence,
        "source-event",
    );
    let first_activation = ActivationFixture {
        decisions: [(target.clone(), ActivationDecision::RunImmediately)]
            .into_iter()
            .collect(),
        occurrence_decisions: Vec::new(),
    };
    let queued = advance_progress(
        &plan,
        &registry,
        &initial,
        &before_context,
        &after_first_context,
        &source_event,
        &first_activation,
    )
    .unwrap();
    assert_eq!(queued.cursor, 1);
    assert!(queued.current_occurrences.is_empty());
    assert_eq!(queued.immediate_queue.len(), 1);
    let immediate_occurrence = queued.immediate_queue[0].clone();
    let immediate_event = character_event(
        &registry,
        &after_first_context,
        &immediate_occurrence,
        "immediate-event",
    );
    let target_b_identity = target_instance_occurrence(&target, &target_b);
    let later_activation = ActivationFixture {
        decisions: [(target.clone(), ActivationDecision::RunImmediately)]
            .into_iter()
            .collect(),
        occurrence_decisions: [(
            target_b_identity.clone(),
            ActivationDecision::JoinPendingOrder,
        )]
        .into_iter()
        .collect(),
    };
    let after_immediate = advance_progress(
        &plan,
        &registry,
        &queued,
        &after_first_context,
        &after_second_context,
        &immediate_event,
        &later_activation,
    )
    .unwrap();
    assert!(after_immediate.immediate_queue.is_empty());
    assert_eq!(after_immediate.cursor, 1, "the current entry remains open");
    assert_eq!(after_immediate.current_occurrences.len(), 1);
    assert_eq!(
        after_immediate.current_occurrences[0].identity(),
        target_b_identity
    );
}

#[test]
fn scheduler_returns_late_activation_error_without_mutating_previous_progress() {
    let source = action("source");
    let target = action("target");
    let registry = registry(&[source.clone(), target.clone()]);
    let source_instance = instance(1, "source-player", "setup");
    let target_instance = instance(2, "target-player", "grant");
    let before_rules = rules_for(
        [(source.clone(), vec![source_instance.clone()])],
        [(source.clone(), vec![source_instance.clone()])],
    );
    let after_rules = rules_for(
        [
            (source.clone(), vec![source_instance.clone()]),
            (target.clone(), vec![target_instance]),
        ],
        [
            (source.clone(), vec![source_instance.clone()]),
            (target.clone(), vec![instance(2, "target-player", "grant")]),
        ],
    );
    let before_context = context(&before_rules);
    let after_context = context(&after_rules);
    let plan = plan(&[source.clone(), target]);
    let initial = initial_progress(&plan, &registry, &before_context).unwrap();
    let snapshot = initial.clone();
    let source_occurrence = initial.current_occurrences[0].clone();
    let event = character_event(
        &registry,
        &before_context,
        &source_occurrence,
        "source-event",
    );
    assert!(advance_progress(
        &plan,
        &registry,
        &initial,
        &before_context,
        &after_context,
        &event,
        &RejectingActivation,
    )
    .is_err());
    assert_eq!(
        initial, snapshot,
        "failed scheduling does not adopt a partial clone"
    );
}

#[test]
fn scheduler_immediate_queue_runs_before_order_and_deduplicates_by_occurrence_identity() {
    let source = action("source");
    let target_a = action("targetA");
    let target_b = action("targetB");
    let registry = registry(&[source.clone(), target_a.clone(), target_b.clone()]);
    let source_instance = instance(1, "source-player", "setup");
    let target_a_instance = instance(3, "a-player", "grant-a");
    let target_b_instance = instance(2, "b-player", "grant-b");
    let before_rules = rules_for(
        [(source.clone(), vec![source_instance.clone()])],
        [(source.clone(), vec![source_instance.clone()])],
    );
    let after_rules = rules_for(
        [
            (source.clone(), vec![source_instance.clone()]),
            (target_a.clone(), vec![target_a_instance.clone()]),
            (target_b.clone(), vec![target_b_instance.clone()]),
        ],
        [
            (source.clone(), vec![source_instance.clone()]),
            (target_a.clone(), vec![target_a_instance.clone()]),
            (target_b.clone(), vec![target_b_instance.clone()]),
        ],
    );
    let before_context = context(&before_rules);
    let after_context = context(&after_rules);
    let plan = plan(&[source.clone(), target_a.clone(), target_b.clone()]);
    let initial = initial_progress(&plan, &registry, &before_context).unwrap();
    let source_occurrence = initial.current_occurrences[0].clone();
    let event = character_event(
        &registry,
        &before_context,
        &source_occurrence,
        "source-event",
    );
    let activation = ActivationFixture {
        decisions: [
            (target_a.clone(), ActivationDecision::RunImmediately),
            (target_b.clone(), ActivationDecision::RunImmediately),
        ]
        .into_iter()
        .collect(),
        occurrence_decisions: Vec::new(),
    };
    let queued = advance_progress(
        &plan,
        &registry,
        &initial,
        &before_context,
        &after_context,
        &event,
        &activation,
    )
    .unwrap();
    assert_eq!(queued.immediate_queue.len(), 2);
    assert_eq!(
        queued.immediate_queue[0].actor_player_id(),
        Some("b-player")
    );
    assert_eq!(
        queued.immediate_queue[1].actor_player_id(),
        Some("a-player")
    );
    assert!(queued.current_occurrences.is_empty());
    assert_eq!(
        queued.cursor, 1,
        "normal cursor stays parked while its queue drains"
    );

    let first_immediate = queued.immediate_queue[0].clone();
    let immediate_event =
        character_event(&registry, &after_context, &first_immediate, "immediate-1");
    let mut duplicated_queue = queued.clone();
    duplicated_queue
        .immediate_queue
        .push(duplicated_queue.immediate_queue[0].clone());
    let after_first = advance_progress(
        &plan,
        &registry,
        &duplicated_queue,
        &after_context,
        &after_context,
        &immediate_event,
        &activation,
    )
    .unwrap();
    assert_eq!(after_first.immediate_queue.len(), 1);
    assert_eq!(
        after_first.immediate_queue[0].actor_player_id(),
        Some("a-player")
    );
    assert_eq!(after_first.completed_history.len(), 2);

    let second_immediate = after_first.immediate_queue[0].clone();
    let second_event = character_event(&registry, &after_context, &second_immediate, "immediate-2");
    let after_second = advance_progress(
        &plan,
        &registry,
        &after_first,
        &after_context,
        &after_context,
        &second_event,
        &activation,
    )
    .unwrap();
    assert!(after_second.immediate_queue.is_empty());
    assert_eq!(after_second.cursor, 3);
    assert_eq!(
        after_second.current_occurrences[0].action_ref,
        FirstNightActionRef::system("dawn")
    );
    assert_eq!(after_second.completed_history.len(), 3);
    assert_eq!(
        after_second
            .completed_history
            .iter()
            .filter(|completed| completed.occurrence.identity() == first_immediate.identity())
            .count(),
        1,
        "immediate work is not repeated during ordered traversal",
    );
    let dawn = system_event(
        &registry,
        &after_context,
        FirstNightActionRef::system("dawn"),
        "dawn",
    );
    let ended = advance_progress(
        &plan,
        &registry,
        &after_second,
        &after_context,
        &after_context,
        &dawn,
        &activation,
    )
    .unwrap();
    assert!(ended.ended);
}

#[test]
fn scheduler_retains_completed_history_after_ability_loss_and_rejects_reopen_after_dawn() {
    let current = action("current");
    let registry = registry(&[current.clone()]);
    let acting = instance(1, "p1", "setup");
    let before_rules = rules_for(
        [(current.clone(), vec![acting.clone()])],
        [(current.clone(), vec![acting.clone()])],
    );
    let after_rules = rules_for([], []);
    let before_context = context(&before_rules);
    let after_context = context(&after_rules);
    let plan = plan(&[current.clone()]);
    let initial = initial_progress(&plan, &registry, &before_context).unwrap();
    let occurrence = initial.current_occurrences[0].clone();
    let event = character_event(&registry, &before_context, &occurrence, "complete");
    let activation = ActivationFixture {
        decisions: HashMap::new(),
        occurrence_decisions: Vec::new(),
    };
    let completed = advance_progress(
        &plan,
        &registry,
        &initial,
        &before_context,
        &after_context,
        &event,
        &activation,
    )
    .unwrap();
    assert_eq!(completed.completed_history.len(), 1);
    assert_eq!(
        completed.completed_history[0].occurrence.identity(),
        occurrence.identity()
    );

    let dawn = system_event(
        &registry,
        &after_context,
        FirstNightActionRef::system("dawn"),
        "dawn",
    );
    let ended = advance_progress(
        &plan,
        &registry,
        &completed,
        &after_context,
        &after_context,
        &dawn,
        &activation,
    )
    .unwrap();
    assert!(ended.ended);
    assert!(ended.current_occurrences.is_empty());
    assert!(advance_progress(
        &plan,
        &registry,
        &ended,
        &after_context,
        &after_context,
        &dawn,
        &activation,
    )
    .is_err());
}

#[test]
fn character_occurrence_step_ids_encode_actor_and_instance_lengths() {
    let action_ref = action("collision");
    let left = AbilityUseRef {
        owner_player_id: "a:b".to_string(),
        character_id: "fixtureCharacter".to_string(),
        ability_instance_id: AbilityInstanceId::new("source", "c"),
    };
    let right = AbilityUseRef {
        owner_player_id: "a".to_string(),
        character_id: "fixtureCharacter".to_string(),
        ability_instance_id: AbilityInstanceId::new("source", "b:c"),
    };
    let left = ActionOccurrence::character(action_ref.clone(), left).unwrap();
    let right = ActionOccurrence::character(action_ref, right).unwrap();
    assert_ne!(left.step_id().unwrap(), right.step_id().unwrap());
}

fn target_instance_occurrence(
    action_ref: &FirstNightActionRef,
    instance: &ActiveAbilityInstance,
) -> crate::state::ActionOccurrenceIdentity {
    ActionOccurrence::character(action_ref.clone(), instance.ability_use.clone())
        .unwrap()
        .identity()
}

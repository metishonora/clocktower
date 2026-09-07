use crate::{
    characters::{resolve_custom_script_ids, ResolvedScriptContext},
    contracts::{
        CustomActionResult, FirstNightActionRef, GameEvent, GameEventKind, SetupPlayerInput,
    },
    custom::{
        event::ValidatedCustomEvent,
        first_night::{
            fixture_action_registry, ActionContext, ActionEventDraft, ActionHandler,
            ActionRegistry, ActionSpec, ActiveAbilityInstance, FirstNightRuleService,
            RegisteredAction, SystemActionEventDraft,
        },
        rules::CustomRuleService,
        state::{ActionOccurrence, CustomGameFacts},
    },
    error::CoreError,
    model::{
        AbilityInstanceId, AbilityUseRef, InformationResult, Phase, PhaseStep, PhaseStepSupport,
        RequiredInputKind, StepInput, StepInputFields,
    },
    setup::player_from_setup_input_for_custom,
};

fn context(character_ids: &[&str]) -> ResolvedScriptContext {
    resolve_custom_script_ids(
        &character_ids
            .iter()
            .map(|character_id| (*character_id).to_string())
            .collect::<Vec<_>>(),
    )
    .expect("fixture characters should resolve")
}

fn player(
    context: &ResolvedScriptContext,
    id: &str,
    seat: u8,
    character_id: &str,
) -> crate::model::Player {
    player_from_setup_input_for_custom(
        context,
        &SetupPlayerInput {
            id: Some(id.to_string()),
            seat,
            name: id.to_string(),
            actual_character: character_id.to_string(),
            shown_character: None,
        },
    )
    .expect("fixture player should resolve")
}

fn action(character_id: &str, action_id: &str) -> FirstNightActionRef {
    FirstNightActionRef::Character {
        character_id: character_id.to_string(),
        action_id: action_id.to_string(),
    }
}

fn ability_use(player: &crate::model::Player) -> AbilityUseRef {
    AbilityUseRef {
        owner_player_id: player.id.clone(),
        character_id: player.actual_character.clone(),
        ability_instance_id: player.ability_instance.id.clone(),
    }
}

fn custom_event(draft: &ActionEventDraft, id: &str) -> GameEvent {
    let ActionEventDraft::Custom(draft) = draft else {
        unreachable!("fixture action should produce a custom draft")
    };
    GameEvent {
        id: id.to_string(),
        kind: GameEventKind::CustomActionConfirmed {
            payload: draft.clone().into_payload(),
        },
        phase: Phase::FirstNight,
        summary: "fixture action".to_string(),
        created_at: "2026-09-07T00:00:00.000Z".to_string(),
    }
}

fn validated_custom(
    event: &crate::custom::first_night::ValidatedActionEvent,
) -> &ValidatedCustomEvent {
    let crate::custom::first_night::ValidatedActionEvent::Custom(event) = event else {
        unreachable!("fixture event should validate as custom")
    };
    event
}

#[test]
fn custom_fixture_proposal_and_replay_share_one_canonical_event_boundary() {
    let context = context(&["washerwoman", "philosopher", "chef", "imp"]);
    let acting_player = player(&context, "p1", 1, "washerwoman");
    let facts = CustomGameFacts::from_players(vec![acting_player.clone()]);
    let rules = CustomRuleService::new(&context, &facts);
    let action_context = ActionContext {
        rule_service: &rules,
    };
    let registry = fixture_action_registry().expect("test fixture registration should compose");
    let action_ref = action("washerwoman", "learnTownsfolk");
    let occurrence = ActionOccurrence::character(action_ref.clone(), ability_use(&acting_player))
        .expect("fixture occurrence should be valid");
    let input: StepInput = None;

    let draft = registry
        .propose(&action_ref, &action_context, &occurrence, &input)
        .expect("fixture proposal should validate");
    assert_eq!(draft.action_ref(), &action_ref);
    assert_eq!(draft.step_id(), occurrence.step_id().unwrap());
    assert_eq!(draft.input(), &input);
    assert!(matches!(
        &draft,
        ActionEventDraft::Custom(custom)
            if matches!(custom.result, CustomActionResult::NoEffect)
    ));

    let wire_event = custom_event(&draft, "fixture-no-effect-1");
    let validated = registry
        .validate_event(&occurrence, &action_context, &wire_event)
        .expect("the same event should validate during replay");
    let custom = validated_custom(&validated);
    assert_eq!(custom.id(), "fixture-no-effect-1");
    assert_eq!(custom.step_id(), occurrence.step_id().unwrap());
    assert!(custom.fact_changes().is_empty());

    let repeated = registry
        .propose(&action_ref, &action_context, &occurrence, &input)
        .expect("repeated proposal should validate");
    assert_eq!(repeated.action_ref(), draft.action_ref());
    assert_eq!(repeated.step_id(), draft.step_id());
    assert_eq!(repeated.input(), draft.input());
    assert_eq!(facts.players.len(), 1);
    assert_eq!(facts.players[0].actual_character, "washerwoman");
}

#[test]
fn custom_boundary_rejects_step_action_actor_instance_input_and_result_tampering() {
    let context = context(&["washerwoman", "philosopher", "chef", "imp"]);
    let acting_player = player(&context, "p1", 1, "washerwoman");
    let facts = CustomGameFacts::from_players(vec![acting_player.clone()]);
    let rules = CustomRuleService::new(&context, &facts);
    let action_context = ActionContext {
        rule_service: &rules,
    };
    let registry = fixture_action_registry().expect("test fixture registration should compose");
    let action_ref = action("washerwoman", "learnTownsfolk");
    let occurrence = ActionOccurrence::character(action_ref.clone(), ability_use(&acting_player))
        .expect("fixture occurrence should be valid");
    let draft = registry
        .propose(&action_ref, &action_context, &occurrence, &None)
        .unwrap();
    let valid = custom_event(&draft, "fixture-tamper-base");

    let mut tampered = vec![valid.clone()];
    for event in &mut tampered {
        let GameEventKind::CustomActionConfirmed { payload } = &mut event.kind else {
            unreachable!()
        };
        payload.step_id.push_str(":forged");
    }
    let mut action_tampered = valid.clone();
    let GameEventKind::CustomActionConfirmed { payload } = &mut action_tampered.kind else {
        unreachable!()
    };
    payload.action_ref = action("washerwoman", "differentAction");
    tampered.push(action_tampered);

    let mut actor_tampered = valid.clone();
    let GameEventKind::CustomActionConfirmed { payload } = &mut actor_tampered.kind else {
        unreachable!()
    };
    payload.ability_use.owner_player_id = "other-player".to_string();
    tampered.push(actor_tampered);

    let mut instance_tampered = valid.clone();
    let GameEventKind::CustomActionConfirmed { payload } = &mut instance_tampered.kind else {
        unreachable!()
    };
    payload.ability_use.ability_instance_id = AbilityInstanceId::new("forged", "other-player");
    tampered.push(instance_tampered);

    let mut input_tampered = valid.clone();
    let GameEventKind::CustomActionConfirmed { payload } = &mut input_tampered.kind else {
        unreachable!()
    };
    payload.input = Some(StepInputFields {
        value: Some(7),
        ..StepInputFields::default()
    });
    tampered.push(input_tampered);

    let mut result_tampered = valid.clone();
    let GameEventKind::CustomActionConfirmed { payload } = &mut result_tampered.kind else {
        unreachable!()
    };
    payload.result = CustomActionResult::Information {
        value: InformationResult::Boolean { value: true },
    };
    tampered.push(result_tampered);

    for event in tampered {
        assert!(
            registry
                .validate_event(&occurrence, &action_context, &event)
                .is_err(),
            "tampered custom event should not cross the semantic boundary"
        );
    }
}

#[test]
fn custom_boundary_requires_definition_membership_even_for_a_registered_action() {
    let context = context(&["philosopher"]);
    let acting_player = player(&context, "p1", 1, "philosopher");
    let facts = CustomGameFacts::from_players(vec![acting_player.clone()]);
    let rules = CustomRuleService::new(&context, &facts);
    let action_context = ActionContext {
        rule_service: &rules,
    };
    let registry = fixture_action_registry().expect("test fixture registration should compose");
    let action_ref = action("washerwoman", "learnTownsfolk");
    let occurrence = ActionOccurrence::character(
        action_ref.clone(),
        AbilityUseRef {
            owner_player_id: acting_player.id,
            character_id: "washerwoman".to_string(),
            ability_instance_id: AbilityInstanceId::new("setup", "p1"),
        },
    )
    .unwrap();

    let error = registry
        .propose(&action_ref, &action_context, &occurrence, &None)
        .expect_err("an out-of-definition action must fail before handler acceptance");
    assert_eq!(error.code, "CHARACTER_NOT_IN_SCRIPT");
}

struct InputMismatchHandler {
    action_ref: FirstNightActionRef,
}

impl ActionHandler for InputMismatchHandler {
    fn action_ref(&self) -> &FirstNightActionRef {
        &self.action_ref
    }

    fn project(
        &self,
        _spec: &ActionSpec,
        _context: &ActionContext<'_>,
    ) -> Result<Vec<PhaseStep>, CoreError> {
        Ok(Vec::new())
    }

    fn propose(
        &self,
        _spec: &ActionSpec,
        _context: &ActionContext<'_>,
        occurrence: &ActionOccurrence,
        _input: &StepInput,
    ) -> Result<ActionEventDraft, CoreError> {
        Ok(ActionEventDraft::System(SystemActionEventDraft {
            action_ref: self.action_ref.clone(),
            step_id: occurrence.step_id()?,
            input: None,
        }))
    }

    fn validate_event(
        &self,
        _spec: &ActionSpec,
        _context: &ActionContext<'_>,
        _occurrence: &ActionOccurrence,
        _draft: &ActionEventDraft,
    ) -> Result<crate::custom::event::CustomFactChanges, CoreError> {
        Ok(crate::custom::event::CustomFactChanges::default())
    }
}

struct SystemRules;

impl FirstNightRuleService for SystemRules {
    fn active_instances(&self, _action_ref: &FirstNightActionRef) -> Vec<ActiveAbilityInstance> {
        Vec::new()
    }

    fn try_active_instances(
        &self,
        _action_ref: &FirstNightActionRef,
    ) -> Result<Vec<ActiveAbilityInstance>, CoreError> {
        Ok(Vec::new())
    }

    fn has_minion(&self) -> bool {
        false
    }

    fn has_demon(&self) -> bool {
        false
    }

    fn legal_demon_bluff_character_ids(&self) -> Vec<String> {
        Vec::new()
    }

    fn validate_character_membership(&self, _character_id: &str) -> Result<(), CoreError> {
        Ok(())
    }
}

#[test]
fn proposal_rejects_a_handler_that_changes_the_command_input() {
    let action_ref = FirstNightActionRef::system("dawn");
    let registry = ActionRegistry::new(vec![RegisteredAction {
        spec: ActionSpec {
            action_ref: action_ref.clone(),
            participates_in_first_night: true,
            required_input_kind: RequiredInputKind::Day,
            support: PhaseStepSupport::Automated,
        },
        handler: Box::new(InputMismatchHandler {
            action_ref: action_ref.clone(),
        }),
    }])
    .unwrap();
    let rules = SystemRules;
    let context = ActionContext {
        rule_service: &rules,
    };
    let occurrence = ActionOccurrence::system(action_ref.clone()).unwrap();
    let input = Some(StepInputFields {
        value: Some(9),
        ..StepInputFields::default()
    });

    let error = registry
        .propose(&action_ref, &context, &occurrence, &input)
        .expect_err("a handler cannot substitute a different command input");
    assert_eq!(error.code, "INVALID_STEP_INPUT");
}

#[cfg(feature = "custom-runtime-fixtures")]
#[test]
fn feature_fixture_typed_grant_result_becomes_private_fact_changes_and_reduces() {
    let context = context(&["philosopher", "washerwoman", "chef", "imp"]);
    let acting_player = player(&context, "p1", 1, "philosopher");
    let facts = CustomGameFacts::from_players(vec![acting_player.clone()]);
    let rules = CustomRuleService::new(&context, &facts);
    let action_context = ActionContext {
        rule_service: &rules,
    };
    let registry = fixture_action_registry().expect("feature fixture registration should compose");
    let action_ref = action("philosopher", "chooseAbility");
    let occurrence =
        ActionOccurrence::character(action_ref.clone(), ability_use(&acting_player)).unwrap();
    let input = Some(StepInputFields {
        character_ids: Some(vec!["washerwoman".to_string()]),
        ..StepInputFields::default()
    });

    let draft = registry
        .propose(&action_ref, &action_context, &occurrence, &input)
        .expect("fixed grant input should be accepted");
    assert!(matches!(
        &draft,
        ActionEventDraft::Custom(custom)
            if matches!(
                custom.result,
                CustomActionResult::FixtureAbilityGranted { ref target_character_id }
                    if target_character_id == "washerwoman"
            )
    ));
    let event = custom_event(&draft, "fixture-grant-1");
    let validated = registry
        .validate_event(&occurrence, &action_context, &event)
        .expect("fixed grant result should cross the semantic boundary");
    let custom = validated_custom(&validated);
    assert_eq!(custom.fact_changes().ability_grants().len(), 1);
    assert_eq!(
        custom.fact_changes().ability_grants()[0].owner_player_id,
        "p1"
    );
    assert_eq!(
        custom.fact_changes().ability_grants()[0].source,
        ability_use(&acting_player)
    );

    let reduced = crate::custom::reducer::reduce_custom_facts(&context, &facts, custom)
        .expect("validated fixture grant should reduce to facts");
    assert_eq!(reduced.players[0].actual_character, "philosopher");
    assert_eq!(reduced.ability_grants.len(), 1);
    assert_eq!(reduced.ability_grants[0].character_id, "washerwoman");
    assert_eq!(reduced.ability_grants[0].source_event_id, "fixture-grant-1");
    assert_eq!(facts.ability_grants.len(), 0);
}

//! Bounded mutable-fact cases complement the Production JSON sequences in issue207_acquisition.
use crate::{
    characters::{
        resolve_custom_script_ids,
        sects_and_violets::{registrations, resolve_effects},
        ResolvedScriptContext,
    },
    contracts::{
        ActiveImpairment, ImpairmentExpiry, ImpairmentKind, PhilosopherChoiceFact,
        PhilosopherChoiceOutcome, SetupPlayerInput,
    },
    first_night::{ActionContext, ActionInput},
    model::{AbilityGrant, AbilityInstanceId, AbilityOrigin, AbilityUseRef, StepInputFields},
    rules::CustomRuleService,
    state::{AbilityProvenance, CustomGameFacts, DurableImpairment},
};
fn facts(roster: &[&str]) -> (ResolvedScriptContext, CustomGameFacts) {
    let mut pool = roster.iter().map(|id| id.to_string()).collect::<Vec<_>>();
    pool.extend([
        "artist".into(),
        "savant".into(),
        "philosopher".into(),
        "snakeCharmer".into(),
        "noDashii".into(),
    ]);
    pool.sort();
    pool.dedup();
    let context = resolve_custom_script_ids(&pool).unwrap();
    let players = roster
        .iter()
        .enumerate()
        .map(|(i, id)| {
            crate::setup::player_from_setup_input_for_custom(
                &context,
                &SetupPlayerInput {
                    id: Some(format!("p{}", i + 1)),
                    seat: (i + 1) as u8,
                    name: id.to_string(),
                    actual_character: id.to_string(),
                    shown_character: None,
                },
            )
            .unwrap()
        })
        .collect();
    (context, CustomGameFacts::from_players(players))
}
fn source(facts: &CustomGameFacts, index: usize) -> AbilityUseRef {
    let p = &facts.players[index];
    AbilityUseRef {
        owner_player_id: p.id.clone(),
        character_id: p.actual_character.clone(),
        ability_instance_id: p.ability_instance.id.clone(),
    }
}
#[test]
fn no_dashii_skips_other_types_but_keeps_dead_townsfolk_and_other_poison() {
    let (context, mut state) = facts(&[
        "philosopher",
        "mutant",
        "noDashii",
        "scarletWoman",
        "artist",
    ]);
    state.players[0].alive = false;
    state.durable_impairments.push(DurableImpairment {
        source_ability_use: source(&state, 0),
        impairment: ActiveImpairment {
            kind: ImpairmentKind::Poisoned,
            player_id: "p5".into(),
            source_event_id: "swap".into(),
            source_character_id: "snakeCharmer".into(),
            expires: ImpairmentExpiry::Never,
        },
    });
    resolve_effects(&context, &mut state).unwrap();
    assert!(state
        .active_impairments
        .iter()
        .any(|e| e.player_id == "p1" && e.source_character_id == "noDashii"));
    assert_eq!(
        state
            .active_impairments
            .iter()
            .filter(|e| e.player_id == "p5")
            .count(),
        2
    );
    state.players[2].alive = false;
    resolve_effects(&context, &mut state).unwrap();
    assert_eq!(state.active_impairments.len(), 1);
    assert_eq!(state.active_impairments[0].source_event_id, "swap");
}
#[test]
fn acquired_grant_survives_impairment_but_source_replacement_removes_ownership_only() {
    let (context, mut state) = facts(&["philosopher", "artist", "savant"]);
    let original = source(&state, 0);
    let grant_id = AbilityInstanceId::new("choice", "p1");
    state.philosopher_choices.push(PhilosopherChoiceFact {
        source_event_id: "choice".into(),
        ability_use: original.clone(),
        character_id: "artist".into(),
        outcome: PhilosopherChoiceOutcome::Acquired,
    });
    state.ability_grants.push(AbilityGrant {
        owner_player_id: "p1".into(),
        character_id: "artist".into(),
        source_event_id: "choice".into(),
        source_ability_instance_id: original.ability_instance_id.clone(),
        ability_instance_id: grant_id.clone(),
    });
    state.ability_provenance.push(AbilityProvenance {
        ability_use: AbilityUseRef {
            owner_player_id: "p1".into(),
            character_id: "artist".into(),
            ability_instance_id: grant_id.clone(),
        },
        origin: AbilityOrigin::Acquired {
            acquisition_event_id: "choice".into(),
            source: original,
        },
    });
    resolve_effects(&context, &mut state).unwrap();
    assert!(state.active_impairments.iter().any(|e| e.player_id == "p2"));
    let external = ActiveImpairment {
        kind: ImpairmentKind::Poisoned,
        player_id: "p1".into(),
        source_event_id: "other".into(),
        source_character_id: "noDashii".into(),
        expires: ImpairmentExpiry::WhileSourceAbilityActive,
    };
    state.active_impairments.push(external.clone());
    resolve_effects(&context, &mut state).unwrap();
    assert!(!state.active_impairments.iter().any(|e| e.player_id == "p2"));
    assert_eq!(state.ability_grants[0].ability_instance_id, grant_id);
    state
        .active_impairments
        .retain(|effect| effect != &external);
    resolve_effects(&context, &mut state).unwrap();
    assert!(state.active_impairments.iter().any(|e| e.player_id == "p2"));
    assert_eq!(state.ability_grants[0].ability_instance_id, grant_id);
    state.players[0].actual_character = "savant".into();
    state.players[0].ability_instance.id = AbilityInstanceId::new("replacement", "p1");
    state.players[0].ability_instance.character_id = "savant".into();
    resolve_effects(&context, &mut state).unwrap();
    assert!(state.ability_grants.is_empty());
    assert!(state.active_impairments.is_empty());
    assert_eq!(state.philosopher_choices.len(), 1);
    assert!(state
        .ability_provenance
        .iter()
        .any(|record| record.ability_use.ability_instance_id == grant_id));
}
#[test]
fn snake_dead_target_is_rejected_without_adopting_effects() {
    let (context, mut state) = facts(&["snakeCharmer", "noDashii", "artist"]);
    let occurrence = crate::state::ActionOccurrence::character(
        crate::contracts::FirstNightActionRef::Character {
            character_id: "snakeCharmer".into(),
            action_id: "choosePlayer".into(),
        },
        source(&state, 0),
    )
    .unwrap();
    let entry = registrations()
        .into_iter()
        .find(|entry| entry.spec.action_ref == occurrence.action_ref)
        .unwrap();
    state.players[1].alive = false;
    let rules = CustomRuleService::new(&context, &state);
    let input = ActionInput {
        input: Some(StepInputFields {
            player_ids: Some(vec!["p2".into()]),
            ..Default::default()
        }),
        delivered_result: None,
        registration_judgments: vec![],
    };
    assert!(entry
        .handler
        .propose_input(
            &entry.spec,
            &ActionContext {
                event_id: "candidate",
                rule_service: &rules
            },
            &occurrence,
            &input
        )
        .is_err());
    assert!(state.players[1].actual_character == "noDashii");
    assert!(state.durable_impairments.is_empty());
}
#[test]
fn snv_activation_runs_new_clockmaker_immediately_and_does_not_reopen_passed_slots() {
    use crate::{
        contracts::{
            CustomActionConfirmedPayload, CustomActionResult, FirstNightActionRef, GameEvent,
            GameEventKind,
        },
        event::CustomFactChanges,
        first_night::{
            ActivationContext, ActivationDecision, ActivationRule, ValidatedActionEvent,
            ValidatedCustomEvent,
        },
        model::Phase,
        state::ActionOccurrence,
    };
    let (_, state) = facts(&["philosopher", "artist", "savant"]);
    let actual = source(&state, 0);
    let payload = CustomActionConfirmedPayload {
        step_id: "choice".into(),
        action_ref: FirstNightActionRef::Character {
            character_id: "philosopher".into(),
            action_id: "chooseAbility".into(),
        },
        ability_use: Some(actual),
        simulation_source: None,
        follow_up_cause: None,
        input: None,
        delivered_result: None,
        registration_judgments: vec![],
        result: CustomActionResult::PhilosopherDeferred,
    };
    let event = ValidatedActionEvent::Custom(ValidatedCustomEvent::for_tests(
        GameEvent {
            id: "choice".into(),
            phase: Phase::FirstNight,
            summary: "policy fixture".into(),
            created_at: "t".into(),
            kind: GameEventKind::CustomActionConfirmed {
                payload: payload.clone(),
            },
        },
        payload,
        CustomFactChanges::default(),
    ));
    for (character, entry, expected) in [
        ("clockmaker", 0, ActivationDecision::RunImmediately),
        ("dreamer", 0, ActivationDecision::Defer),
        ("dreamer", 3, ActivationDecision::JoinPendingOrder),
    ] {
        let action = FirstNightActionRef::Character {
            character_id: character.into(),
            action_id: "test".into(),
        };
        let occurrence = ActionOccurrence::character(
            action.clone(),
            AbilityUseRef {
                owner_player_id: "p1".into(),
                character_id: character.into(),
                ability_instance_id: AbilityInstanceId::new("choice", "p1"),
            },
        )
        .unwrap();
        let context = ActivationContext {
            event: &event,
            previous_facts: &state,
            next_facts: &state,
            action_ref: &action,
            occurrence: &occurrence,
            event_stream_index: 1,
            entry_index: entry,
            cursor: 2,
        };
        assert_eq!(
            crate::characters::sects_and_violets::SnvActivation
                .decide(&context)
                .unwrap(),
            expected
        );
    }
}

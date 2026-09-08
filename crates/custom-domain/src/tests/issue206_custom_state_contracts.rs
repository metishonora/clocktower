use crate::{
    characters::{resolve_custom_script_ids, ResolvedScriptContext},
    contracts::{
        ActiveImpairment, CustomActionConfirmedPayload, CustomActionResult, FirstNightActionRef,
        GameEvent, GameEventKind, ImpairmentExpiry, ImpairmentKind, SetupPlayerInput,
    },
    event::{AbilityGrantChange, CustomFactChanges, PlayerLifeChange, ValidatedCustomEvent},
    first_night::FirstNightRuleService,
    model::{
        AbilityInstanceId, AbilityOrigin, AbilityUseRef, Alignment, IdentityState, Phase, Player,
        PlayerIdentityTransition,
    },
    reducer::{current_ability_instance, recorded_ability_instance, reduce_custom_facts},
    rules::CustomRuleService,
    setup::player_from_setup_input_for_custom,
    state::{AbilityProvenance, CustomGameFacts},
};

fn context(character_ids: &[&str]) -> ResolvedScriptContext {
    resolve_custom_script_ids(
        &character_ids
            .iter()
            .map(|character_id| (*character_id).to_string())
            .collect::<Vec<_>>(),
    )
    .expect("test characters should be supported by the custom catalog")
}

fn player(context: &ResolvedScriptContext, id: &str, seat: u8, character_id: &str) -> Player {
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
    .expect("test player should be valid")
}

fn action(character_id: &str) -> FirstNightActionRef {
    FirstNightActionRef::Character {
        character_id: character_id.to_string(),
        action_id: "fixtureAction".to_string(),
    }
}

fn event(
    id: &str,
    ability_use: AbilityUseRef,
    character_id: &str,
    fact_changes: CustomFactChanges,
) -> ValidatedCustomEvent {
    let action_ref = action(character_id);
    let payload = CustomActionConfirmedPayload {
        simulation_source: None,
        follow_up_cause: None,
        action_cause: None,
        delivered_result: None,
        registration_judgments: vec![],
        step_id: format!("firstNight:{character_id}:{id}"),
        action_ref: action_ref.clone(),
        ability_use: Some(ability_use),
        input: None,
        result: CustomActionResult::NoEffect,
    };
    ValidatedCustomEvent::for_tests(
        GameEvent {
            id: id.to_string(),
            kind: GameEventKind::CustomActionConfirmed {
                payload: payload.clone(),
            },
            phase: Phase::FirstNight,
            summary: "fixture event".to_string(),
            created_at: "2026-09-07T00:00:00.000Z".to_string(),
        },
        payload,
        fact_changes,
    )
}

fn ability_use(player: &Player) -> AbilityUseRef {
    AbilityUseRef {
        owner_player_id: player.id.clone(),
        character_id: player.actual_character.clone(),
        ability_instance_id: player.ability_instance.id.clone(),
    }
}

fn identity_state(player: &Player) -> IdentityState {
    IdentityState {
        actual_character: player.actual_character.clone(),
        shown_character: player.shown_character.clone(),
        alignment: player.alignment,
    }
}

#[test]
fn issue206_custom_state_reducer_changes_identity_and_instance_atomically() {
    let context = context(&["washerwoman", "imp", "chef"]);
    let source = player(&context, "p1", 1, "washerwoman");
    let previous = CustomGameFacts::from_players(vec![source.clone()]);
    let old_ability = ability_use(&source);
    let transition = PlayerIdentityTransition {
        player_id: source.id.clone(),
        before: identity_state(&source),
        // Alignment is a recorded Player fact and is intentionally not inferred from the new
        // Character's catalog kind by this common reducer.
        after: IdentityState {
            actual_character: "imp".to_string(),
            shown_character: "imp".to_string(),
            alignment: Alignment::Good,
        },
    };
    let reduced = reduce_custom_facts(
        &context,
        &previous,
        &event(
            "identity-1",
            old_ability.clone(),
            "washerwoman",
            CustomFactChanges::test_identity_change(transition),
        ),
    )
    .expect("valid identity transition should reduce");

    assert_eq!(previous.players[0].actual_character, "washerwoman");
    assert_eq!(
        previous.players[0].ability_instance.id,
        old_ability.ability_instance_id
    );
    assert_eq!(reduced.players[0].actual_character, "imp");
    assert_eq!(reduced.players[0].shown_character, "imp");
    assert_eq!(reduced.players[0].alignment, Alignment::Good);
    assert_eq!(reduced.players[0].ability_instance.character_id, "imp");
    assert_eq!(
        reduced.players[0].ability_instance.id.as_str(),
        "identity-1:p1"
    );
    assert_eq!(reduced.players[0].identity_history.len(), 1);

    assert!(recorded_ability_instance(&reduced, &old_ability));
    assert!(!current_ability_instance(&reduced, &old_ability));
    let current = AbilityUseRef {
        owner_player_id: "p1".to_string(),
        character_id: "imp".to_string(),
        ability_instance_id: reduced.players[0].ability_instance.id.clone(),
    };
    assert!(current_ability_instance(&reduced, &current));
}

#[test]
fn issue206_custom_state_reducer_retains_grant_source_and_distinguishes_instances() {
    let context = context(&["washerwoman", "chef", "imp"]);
    let source = player(&context, "p1", 1, "washerwoman");
    let owner = player(&context, "p2", 2, "chef");
    let previous = CustomGameFacts::from_players(vec![source.clone(), owner.clone()]);
    let source_ability = ability_use(&source);
    let changes = CustomFactChanges::test_with(
        vec![],
        vec![
            AbilityGrantChange {
                owner_player_id: owner.id.clone(),
                character_id: "washerwoman".to_string(),
                source: source_ability.clone(),
            },
            AbilityGrantChange {
                owner_player_id: owner.id.clone(),
                character_id: "imp".to_string(),
                source: source_ability.clone(),
            },
        ],
        vec![],
        vec![],
        vec![],
        vec![],
    );
    let reduced = reduce_custom_facts(
        &context,
        &previous,
        &event(
            "grant-1",
            source_ability.clone(),
            "washerwoman",
            changes.clone(),
        ),
    )
    .expect("valid grants should reduce");
    let repeated = reduce_custom_facts(
        &context,
        &previous,
        &event("grant-1", source_ability.clone(), "washerwoman", changes),
    )
    .expect("repeating the same reduction should succeed");

    assert_eq!(reduced.ability_grants.len(), 2);
    assert_eq!(
        reduced
            .ability_grants
            .iter()
            .map(|grant| grant.ability_instance_id.as_str())
            .collect::<Vec<_>>(),
        repeated
            .ability_grants
            .iter()
            .map(|grant| grant.ability_instance_id.as_str())
            .collect::<Vec<_>>()
    );
    assert_ne!(
        reduced.ability_grants[0].ability_instance_id,
        reduced.ability_grants[1].ability_instance_id
    );

    let rules = CustomRuleService::new(&context, &reduced);
    let washerwoman_instances = rules.owned_instances(&action("washerwoman"));
    let acquired = washerwoman_instances
        .iter()
        .find(|instance| instance.ability_use.owner_player_id == owner.id)
        .expect("acquired washerwoman ability should be projected");
    assert_eq!(
        acquired.ability_origin,
        AbilityOrigin::Acquired {
            acquisition_event_id: "grant-1".to_string(),
            source: source_ability.clone(),
        }
    );
    assert!(rules.owns_ability(&acquired.ability_use));

    // The source may become dead or change identity without invalidating recorded provenance.
    let after_identity = reduce_custom_facts(
        &context,
        &reduced,
        &event(
            "identity-2",
            source_ability.clone(),
            "washerwoman",
            CustomFactChanges::test_identity_change(PlayerIdentityTransition {
                player_id: source.id.clone(),
                before: identity_state(&source),
                after: IdentityState {
                    actual_character: "imp".to_string(),
                    shown_character: "imp".to_string(),
                    alignment: Alignment::Evil,
                },
            }),
        ),
    )
    .expect("identity replacement should reduce");
    assert!(recorded_ability_instance(&after_identity, &source_ability));
    assert!(!current_ability_instance(&after_identity, &source_ability));
    let after_rules = CustomRuleService::new(&context, &after_identity);
    let retained = after_rules
        .owned_instances(&action("washerwoman"))
        .into_iter()
        .find(|instance| instance.ability_use.owner_player_id == owner.id)
        .expect("grant should survive source identity replacement");
    assert_eq!(
        retained.ability_origin,
        AbilityOrigin::Acquired {
            acquisition_event_id: "grant-1".to_string(),
            source: source_ability,
        }
    );
}

#[test]
fn issue206_custom_state_rule_service_exposes_facts_without_universal_participation_filter() {
    let context = context(&["washerwoman", "imp"]);
    let source = player(&context, "p1", 1, "washerwoman");
    let previous = CustomGameFacts::from_players(vec![source.clone()]);
    let source_ability = ability_use(&source);
    let impairment = ActiveImpairment {
        kind: ImpairmentKind::Poisoned,
        player_id: source.id.clone(),
        source_event_id: "impair-1".to_string(),
        source_character_id: "imp".to_string(),
        expires: ImpairmentExpiry::Never,
    };
    let impaired = reduce_custom_facts(
        &context,
        &previous,
        &event(
            "impair-1",
            source_ability.clone(),
            "washerwoman",
            CustomFactChanges::test_impairment_addition(impairment.clone()),
        ),
    )
    .expect("valid impairment should reduce");
    let rules = CustomRuleService::new(&context, &impaired);

    assert_eq!(rules.player_alive("p1"), Some(true));
    assert!(rules.is_impaired("p1"));
    assert_eq!(rules.impairments_for("p1"), vec![impairment.clone()]);
    assert_eq!(rules.active_instances(&action("washerwoman")).len(), 1);
    assert_eq!(
        rules
            .instances_where(&action("washerwoman"), |_, facts| {
                facts.active_impairments.is_empty()
            })
            .len(),
        0,
        "an action-owned predicate can suppress this occurrence"
    );

    let dead = reduce_custom_facts(
        &context,
        &impaired,
        &event(
            "life-1",
            source_ability.clone(),
            "washerwoman",
            CustomFactChanges::test_life_change(PlayerLifeChange {
                player_id: "p1".to_string(),
                alive: false,
            }),
        ),
    )
    .expect("valid life change should reduce");
    let dead_rules = CustomRuleService::new(&context, &dead);
    assert_eq!(dead_rules.player_alive("p1"), Some(false));
    assert_eq!(dead_rules.active_instances(&action("washerwoman")).len(), 1);

    let restored_facts = reduce_custom_facts(
        &context,
        &dead,
        &event(
            "impair-remove",
            source_ability,
            "washerwoman",
            CustomFactChanges::test_impairment_removal(impairment),
        ),
    )
    .expect("valid impairment removal should reduce");
    assert!(!CustomRuleService::new(&context, &restored_facts).is_impaired("p1"));
}

#[test]
fn issue206_custom_state_reducer_rejects_membership_late_without_partial_state() {
    let context = context(&["washerwoman", "chef", "imp"]);
    let source = player(&context, "p1", 1, "washerwoman");
    let owner = player(&context, "p2", 2, "chef");
    let previous = CustomGameFacts::from_players(vec![source.clone(), owner.clone()]);
    let old_source = ability_use(&source);
    let valid_identity = PlayerIdentityTransition {
        player_id: source.id.clone(),
        before: identity_state(&source),
        after: IdentityState {
            actual_character: "imp".to_string(),
            shown_character: "imp".to_string(),
            alignment: Alignment::Evil,
        },
    };
    let invalid_changes = CustomFactChanges::test_with(
        vec![valid_identity],
        vec![AbilityGrantChange {
            owner_player_id: owner.id.clone(),
            character_id: "outsideDefinition".to_string(),
            source: old_source.clone(),
        }],
        vec![],
        vec![],
        vec![],
        vec![],
    );
    let error = reduce_custom_facts(
        &context,
        &previous,
        &event(
            "atomic-invalid",
            old_source.clone(),
            "washerwoman",
            invalid_changes,
        ),
    )
    .expect_err("out-of-definition grants must fail");
    assert_eq!(error.code, "CHARACTER_NOT_IN_SCRIPT");
    assert_eq!(previous.players[0].actual_character, "washerwoman");
    assert_eq!(
        previous.players[0].ability_instance.id,
        old_source.ability_instance_id
    );
    assert!(previous.ability_grants.is_empty());

    let collision_changes = CustomFactChanges::test_with(
        vec![PlayerIdentityTransition {
            player_id: source.id.clone(),
            before: identity_state(&source),
            after: IdentityState {
                actual_character: "imp".to_string(),
                shown_character: "imp".to_string(),
                alignment: Alignment::Evil,
            },
        }],
        vec![AbilityGrantChange {
            owner_player_id: source.id.clone(),
            character_id: "chef".to_string(),
            source: old_source.clone(),
        }],
        vec![],
        vec![],
        vec![],
        vec![],
    );
    let collision_safe = reduce_custom_facts(
        &context,
        &previous,
        &event(
            "collision-safe",
            old_source.clone(),
            "washerwoman",
            collision_changes,
        ),
    )
    .expect("identity and source-aware grant IDs should remain distinct");
    assert_ne!(
        collision_safe.players[0].ability_instance.id,
        collision_safe.ability_grants[0].ability_instance_id
    );

    let duplicate_grants = CustomFactChanges::test_with(
        vec![],
        vec![
            AbilityGrantChange {
                owner_player_id: owner.id.clone(),
                character_id: "imp".to_string(),
                source: old_source.clone(),
            },
            AbilityGrantChange {
                owner_player_id: owner.id.clone(),
                character_id: "imp".to_string(),
                source: old_source.clone(),
            },
        ],
        vec![],
        vec![],
        vec![],
        vec![],
    );
    assert!(reduce_custom_facts(
        &context,
        &previous,
        &event(
            "collision-duplicate",
            old_source,
            "washerwoman",
            duplicate_grants
        ),
    )
    .is_err());
    assert!(previous.ability_grants.is_empty());
}

#[test]
fn issue206_custom_state_provenance_ledger_is_used_for_grant_sources() {
    let context = context(&["washerwoman", "chef"]);
    let source = player(&context, "p1", 1, "washerwoman");
    let owner = player(&context, "p2", 2, "chef");
    let source_use = ability_use(&source);
    let mut facts = CustomGameFacts::from_players(vec![source.clone(), owner.clone()]);
    facts.ability_provenance.clear();
    facts.ability_provenance.push(AbilityProvenance {
        ability_use: source_use.clone(),
        origin: AbilityOrigin::IdentityBound,
    });

    let grant = AbilityGrantChange {
        owner_player_id: owner.id.clone(),
        character_id: "washerwoman".to_string(),
        source: source_use.clone(),
    };
    let reduced = reduce_custom_facts(
        &context,
        &facts,
        &event(
            "ledger-grant",
            source_use.clone(),
            "washerwoman",
            CustomFactChanges::test_ability_grant(grant),
        ),
    )
    .expect("exact recorded source should authorize a grant");

    let mut forged_source = source_use;
    forged_source.character_id = "chef".to_string();
    assert!(reduce_custom_facts(
        &context,
        &reduced,
        &event(
            "ledger-forged",
            forged_source.clone(),
            "chef",
            CustomFactChanges::test_ability_grant(AbilityGrantChange {
                owner_player_id: owner.id,
                character_id: "chef".to_string(),
                source: forged_source,
            }),
        ),
    )
    .is_err());
}

#[test]
fn issue206_custom_state_grant_ids_encode_delimiters_and_source_identity() {
    let context = context(&["washerwoman", "chef", "imp"]);
    let source_one = player(&context, "source:one", 1, "washerwoman");
    let source_two = player(&context, "source-two", 2, "chef");
    let owner = player(&context, "owner", 3, "imp");
    let shared_instance_id = AbilityInstanceId::new("source", "shared");
    let first_source = AbilityUseRef {
        owner_player_id: source_one.id.clone(),
        character_id: source_one.actual_character.clone(),
        ability_instance_id: shared_instance_id.clone(),
    };
    let second_source = AbilityUseRef {
        owner_player_id: source_two.id.clone(),
        character_id: source_two.actual_character.clone(),
        ability_instance_id: shared_instance_id,
    };
    let mut previous = CustomGameFacts::from_players(vec![source_one, source_two, owner.clone()]);
    previous.ability_provenance.extend([
        AbilityProvenance {
            ability_use: first_source.clone(),
            origin: AbilityOrigin::IdentityBound,
        },
        AbilityProvenance {
            ability_use: second_source.clone(),
            origin: AbilityOrigin::IdentityBound,
        },
    ]);
    let changes = CustomFactChanges::test_with(
        vec![],
        vec![
            AbilityGrantChange {
                owner_player_id: owner.id.clone(),
                character_id: "imp".to_string(),
                source: first_source,
            },
            AbilityGrantChange {
                owner_player_id: owner.id,
                character_id: "imp".to_string(),
                source: second_source,
            },
        ],
        vec![],
        vec![],
        vec![],
        vec![],
    );
    let reduced = reduce_custom_facts(
        &context,
        &previous,
        &event(
            "grant:event:with:delimiters",
            ability_use(&previous.players[0]),
            "washerwoman",
            changes,
        ),
    )
    .expect("source-distinct grants should remain distinguishable");

    assert_eq!(reduced.ability_grants.len(), 2);
    assert_ne!(
        reduced.ability_grants[0].ability_instance_id,
        reduced.ability_grants[1].ability_instance_id
    );
}

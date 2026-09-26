//! Persistent-effect regression cases through production commands and bounded facts.
use super::issue223_day::production;
use super::issue225_nights::{begin_night, character, day, replay, step, system};
use serde_json::{json, Value};
fn has_effect(state: &Value, source: &str, target: &str) -> bool {
    state["ruleState"]["activeImpairments"]
        .as_array()
        .is_some_and(|a| {
            a.iter()
                .any(|e| e["sourceCharacterId"] == source && e["playerId"] == target)
        })
}
fn change(game: &mut Value, player: &str, role: &str) {
    step(
        game,
        character("pitHag", "changeCharacter"),
        json!({"playerIds":[player],"characterIds":[role]}),
        None,
    );
}
fn sweet_game() -> Value {
    production(
        &[
            "soldier",
            "virgin",
            "slayer",
            "artist",
            "sweetheart",
            "ravenkeeper",
            "pitHag",
            "imp",
        ],
        json!({}),
    )
}
fn night_sweetheart() -> Value {
    let mut g = sweet_game();
    begin_night(&mut g);
    change(&mut g, "p7", "pitHag");
    step(
        &mut g,
        character("imp", "attackPlayer"),
        json!({"playerIds":["p5"]}),
        None,
    );
    step(
        &mut g,
        character("sweetheart", "makeDrunk"),
        json!({"playerIds":["p2"]}),
        None,
    );
    assert!(has_effect(&replay(&g), "sweetheart", "p2"));
    step(&mut g, system("dawn"), Value::Null, None);
    begin_night(&mut g);
    g
}
#[test]
fn reported_snake_poison_ends_when_pit_hag_replaces_new_snake() {
    let mut g: Value = serde_json::from_str(include_str!(
        "../../../../fixtures/acceptance/vortox-pit-hag/reported-game.json"
    ))
    .unwrap();
    g["game"]["events"].as_array_mut().unwrap().truncate(24);
    assert!(has_effect(&replay(&g), "snakeCharmer", "player-1"));
    change(&mut g, "player-1", "vortox");
    assert!(
        !has_effect(&replay(&g), "snakeCharmer", "player-1"),
        "BUG: new Vortox still has the former Snake Charmer's poison"
    );
}
#[test]
fn snake_poison_ends_after_barber_swap() {
    let mut g = production(
        &[
            "snakeCharmer",
            "virgin",
            "barber",
            "slayer",
            "soldier",
            "pitHag",
            "imp",
            "artist",
        ],
        json!({"choosePlayer":{"playerIds":["p7"]}}),
    );
    begin_night(&mut g);
    step(
        &mut g,
        character("snakeCharmer", "choosePlayer"),
        json!({"playerIds":["p7"]}),
        None,
    );
    change(&mut g, "p6", "pitHag");
    step(
        &mut g,
        character("imp", "attackPlayer"),
        json!({"playerIds":["p3"]}),
        None,
    );
    step(
        &mut g,
        character("barber", "swapCharacters"),
        json!({"playerIds":["p7","p2"],"chooserPlayerId":"p1"}),
        None,
    );
    let state = replay(&g);
    assert_eq!(state["players"][6]["actualCharacter"], "virgin");
    assert!(
        !has_effect(&state, "snakeCharmer", "p7"),
        "BUG: old Snake Charmer stays poisoned after Barber replacement"
    );
    assert!(!has_effect(&state, "snakeCharmer", "p2"));
}
#[test]
fn night_sweetheart_effect_ends_when_dead_source_changes() {
    let mut g = night_sweetheart();
    change(&mut g, "p5", "saint");
    assert!(
        !has_effect(&replay(&g), "sweetheart", "p2"),
        "BUG: dead Sweetheart changed to Saint still drunks the victim"
    );
}
#[test]
fn day_sweetheart_effect_ends_when_dead_source_changes() {
    let mut g = sweet_game();
    for _ in 0..3 {
        day(&mut g, json!({"kind":"advance"}));
    }
    day(
        &mut g,
        json!({"kind":"nominate","nominatorId":"p1","nomineeId":"p5"}),
    );
    day(
        &mut g,
        json!({"kind":"vote","voterIds":["p1","p2","p3","p4","p5"]}),
    );
    day(&mut g, json!({"kind":"closeNominations"}));
    day(&mut g, json!({"kind":"confirmExecution"}));
    day(&mut g, json!({"kind":"confirmDeath"}));
    let state = replay(&g);
    let id = state["day"]["consequences"][0]["id"].clone();
    day(
        &mut g,
        json!({"kind":"resolveConsequence","consequenceId":id,"playerId":"p2"}),
    );
    assert!(has_effect(&replay(&g), "sweetheart", "p2"));
    day(&mut g, json!({"kind":"beginNight"}));
    change(&mut g, "p5", "saint");
    assert!(
        !has_effect(&replay(&g), "sweetheart", "p2"),
        "BUG: day-death Sweetheart effect survives source replacement"
    );
}
#[test]
fn control_sweetheart_effect_survives_recipient_change() {
    let mut g = night_sweetheart();
    change(&mut g, "p2", "saint");
    assert!(
        has_effect(&replay(&g), "sweetheart", "p2"),
        "Recipient replacement must not clear somebody else's ongoing effect"
    );
}
#[test]
fn control_poisoner_source_change_expires_poison_but_recipient_change_does_not() {
    for target in ["p1", "p2"] {
        let mut g = production(
            &[
                "poisoner",
                "virgin",
                "soldier",
                "slayer",
                "artist",
                "pitHag",
                "imp",
                "sage",
                "flowergirl",
                "townCrier",
            ],
            json!({"choosePoisonTarget":{"playerIds":["p2"]}}),
        );
        begin_night(&mut g);
        step(
            &mut g,
            character("poisoner", "choosePoisonTarget"),
            json!({"playerIds":["p2"]}),
            None,
        );
        assert!(has_effect(&replay(&g), "poisoner", "p2"));
        change(&mut g, target, "saint");
        assert_eq!(has_effect(&replay(&g), "poisoner", "p2"), target == "p2");
    }
}
#[test]
fn control_philosopher_source_change_expires_grant_and_drunk() {
    let mut g = production(
        &[
            "philosopher",
            "artist",
            "soldier",
            "slayer",
            "virgin",
            "pitHag",
            "imp",
        ],
        json!({"chooseAbility":{"characterIds":["artist"]}}),
    );
    assert!(has_effect(&replay(&g), "philosopher", "p2"));
    begin_night(&mut g);
    change(&mut g, "p1", "saint");
    assert!(!has_effect(&replay(&g), "philosopher", "p2"));
    assert!(replay(&g)["ruleState"]["abilityGrants"]
        .as_array()
        .is_none_or(|a| a.is_empty()));
}
#[test]
fn control_witch_and_cerenovus_source_change_expires_assignment() {
    for (role, action, collection, input) in [
        (
            "witch",
            "chooseCursedPlayer",
            "witchCurses",
            json!({"playerIds":["p2"]}),
        ),
        (
            "cerenovus",
            "assignMadness",
            "madnessAssignments",
            json!({"playerIds":["p2"],"characterId":"soldier"}),
        ),
    ] {
        for target in ["p1", "p2"] {
            let mut inputs = json!({});
            inputs[action] = input.clone();
            let mut g = production(
                &[
                    role,
                    "virgin",
                    "soldier",
                    "slayer",
                    "artist",
                    "pitHag",
                    "imp",
                    "sage",
                    "flowergirl",
                    "townCrier",
                ],
                inputs,
            );
            begin_night(&mut g);
            step(&mut g, character(role, action), input.clone(), None);
            change(&mut g, target, "saint");
            let state = replay(&g);
            let entries = if role == "cerenovus" {
                &state[collection]
            } else {
                &state["ruleState"][collection]
            };
            assert_eq!(
                entries.as_array().unwrap().last().unwrap()["effective"],
                target == "p2"
            );
        }
    }
}

#[test]
fn witch_reminder_expires_when_source_changes() {
    check_expired_reminder(
        "witch",
        "chooseCursedPlayer",
        json!({"playerIds":["p2"]}),
        "cursed",
    );
}
#[test]
fn cerenovus_reminder_expires_when_source_changes() {
    check_expired_reminder(
        "cerenovus",
        "assignMadness",
        json!({"playerIds":["p2"],"characterId":"soldier"}),
        "mad",
    );
}
fn check_expired_reminder(role: &str, action: &str, input: Value, token: &str) {
    let mut inputs = json!({});
    inputs[action] = input.clone();
    let mut g = production(
        &[
            role,
            "virgin",
            "soldier",
            "slayer",
            "artist",
            "pitHag",
            "imp",
            "sage",
            "flowergirl",
            "townCrier",
        ],
        inputs,
    );
    begin_night(&mut g);
    step(&mut g, character(role, action), input, None);
    change(&mut g, "p1", "saint");
    let state = replay(&g);
    let reminders = state["ruleState"]["automaticReminders"].as_array().unwrap();
    assert!(!reminders.iter().any(|r|r["characterId"]==role && r["tokenId"]==token),"BUG: removed {role} ability still projects an active-looking {token} marker: {reminders:?}");
}
#[test]
fn sweetheart_effect_pauses_when_dead_source_is_poisoned_bounded() {
    use super::issue207_impairments::{facts, source};
    use crate::{
        contracts::{ActiveImpairment, ImpairmentExpiry, ImpairmentKind},
        state::DurableImpairment,
    };
    let (context, mut f) = facts(&["sweetheart", "artist", "poisoner"]);
    f.players[0].alive = false;
    f.durable_impairments.push(DurableImpairment {
        self_interaction: crate::effects::SelfInteraction::IgnoreOwnContribution,
        rule: crate::effects::EffectRule {
            binding: crate::effects::EffectBinding::DeathAbility(source(&f, 0)),
            window: crate::effects::EffectWindow::NoDeadline,
            established: true,
        },
        source_ability_use: source(&f, 0),
        impairment: ActiveImpairment {
            player_id: "p2".into(),
            kind: ImpairmentKind::Drunk,
            source_event_id: "death".into(),
            source_character_id: "sweetheart".into(),
            expires: ImpairmentExpiry::Never,
        },
    });
    crate::effects::resolve_effects(&context, &mut f).unwrap();
    assert!(f.active_impairments.iter().any(|e| e.player_id == "p2"));
    f.active_impairments.push(ActiveImpairment {
        player_id: "p1".into(),
        kind: ImpairmentKind::Poisoned,
        source_event_id: "poison".into(),
        source_character_id: "poisoner".into(),
        expires: ImpairmentExpiry::WhileSourceAbilityActive,
    });
    crate::effects::resolve_effects(&context, &mut f).unwrap();
    assert!(
        !f.active_impairments.iter().any(|e| e.player_id == "p2"),
        "BUG: Sweetheart drunk does not suspend when the dead source is poisoned"
    );
}

#[test]
fn butler_reminder_expires_when_source_changes() {
    let mut g = production(
        &[
            "soldier",
            "virgin",
            "slayer",
            "artist",
            "butler",
            "ravenkeeper",
            "pitHag",
            "imp",
        ],
        json!({"chooseMaster":{"playerIds":["p2"]}}),
    );
    // Custom scripts permit this authored order. No other-night event exists yet.
    let order = g["game"]["script"]["definition"]["otherNightOrder"]
        .as_array_mut()
        .unwrap();
    let at = order
        .iter()
        .position(|a| a["characterId"] == "butler")
        .unwrap();
    let action = order.remove(at);
    order.insert(1, action);
    begin_night(&mut g);
    step(
        &mut g,
        character("butler", "chooseMaster"),
        json!({"playerIds":["p2"]}),
        None,
    );
    change(&mut g, "p5", "saint");
    let state = replay(&g);
    assert!(
        !state["ruleState"]["automaticReminders"]
            .as_array()
            .into_iter()
            .flatten()
            .any(|r| r["characterId"] == "butler" && r["tokenId"] == "master"),
        "BUG: replaced Butler still projects the former master marker"
    );
}

#[test]
fn reported_legacy_game_diagnoses_first_incompatible_boundary_without_rewriting_history() {
    let original: Value = serde_json::from_str(include_str!(
        "../../../../fixtures/acceptance/vortox-pit-hag/reported-game.json"
    ))
    .unwrap();
    let mut failed = None;
    for count in 1..=original["game"]["events"].as_array().unwrap().len() {
        let mut prefix = original.clone();
        prefix["game"]["events"]
            .as_array_mut()
            .unwrap()
            .truncate(count);
        let result: Value = serde_json::from_str(&crate::replay_json(&prefix.to_string())).unwrap();
        if result["ok"] != true {
            failed = Some((count, result));
            break;
        }
    }
    assert_eq!(
        failed.as_ref().map(|(count, _)| *count),
        Some(29),
        "first incompatible boundary: {failed:?}"
    );
}

#[test]
fn suspended_death_effect_recovers_but_reacquiring_same_character_does_not_revive_it() {
    use super::issue207_impairments::{facts, source};
    use crate::{contracts::*, effects::*, model::AbilityInstanceId, state::DurableImpairment};
    let (context, mut f) = facts(&["sweetheart", "artist", "poisoner"]);
    f.players[0].alive = false;
    let origin = source(&f, 0);
    f.durable_impairments.push(DurableImpairment {
        source_ability_use: origin.clone(),
        rule: EffectRule {
            binding: EffectBinding::DeathAbility(origin),
            window: EffectWindow::NoDeadline,
            established: true,
        },
        self_interaction: SelfInteraction::IgnoreOwnContribution,
        impairment: ActiveImpairment {
            player_id: "p2".into(),
            kind: ImpairmentKind::Drunk,
            source_event_id: "death".into(),
            source_character_id: "sweetheart".into(),
            expires: ImpairmentExpiry::Never,
        },
    });
    resolve_effects(&context, &mut f).unwrap();
    let before = f.clone();
    f.poisoner_choices.push(TargetAssignment {
        source_event_id: "poison".into(),
        ability_use: source(&f, 2),
        target_player_id: "p1".into(),
        day: 1,
        initially_effective: true,
        effective: true,
    });
    resolve_effects(&context, &mut f).unwrap();
    assert!(!impaired(&f, "p2"));
    let marker = crate::reminders::project(&f)
        .into_iter()
        .find(|r| r.character_id == "sweetheart")
        .unwrap();
    assert!(marker.inactive_reason.is_some());
    assert_eq!(
        f.evaluated_effects
            .iter()
            .find(|e| e.kind() == EffectKind::Drunk)
            .unwrap()
            .status(),
        EffectStatus::Suspended(SuspendReason::Impaired)
    );
    f.players[2].alive = false;
    resolve_effects(&context, &mut f).unwrap();
    assert!(impaired(&f, "p2"));
    assert!(crate::reminders::project(&f)
        .iter()
        .find(|r| r.character_id == "sweetheart")
        .unwrap()
        .inactive_reason
        .is_none());
    // The same character name with a new instance is a new ability.
    f.players[0].ability_instance.id = AbilityInstanceId::new("reacquired", "p1");
    resolve_effects(&context, &mut f).unwrap();
    assert!(!impaired(&f, "p2"));
    assert!(!crate::reminders::project(&f)
        .iter()
        .any(|r| r.character_id == "sweetheart"));
    assert_eq!(f.durable_impairments.len(), 1); // historical cause retained
    let mut undo = before;
    resolve_effects(&context, &mut undo).unwrap();
    assert!(impaired(&undo, "p2"));
}

#[test]
fn overlapping_effects_lose_only_the_contribution_whose_binding_ended() {
    use super::issue207_impairments::{facts, source};
    use crate::{contracts::*, effects::*, model::AbilityInstanceId, state::DurableImpairment};
    let (context, mut f) = facts(&["snakeCharmer", "sweetheart", "poisoner"]);
    f.durable_impairments.push(DurableImpairment {
        source_ability_use: source(&f, 0),
        rule: EffectRule {
            binding: EffectBinding::ResultingIdentity(source(&f, 0)),
            window: EffectWindow::NoDeadline,
            established: true,
        },
        self_interaction: SelfInteraction::IgnoreOwnContribution,
        impairment: ActiveImpairment {
            player_id: "p1".into(),
            kind: ImpairmentKind::Poisoned,
            source_event_id: "swap".into(),
            source_character_id: "snakeCharmer".into(),
            expires: ImpairmentExpiry::Never,
        },
    });
    f.players[1].alive = false;
    f.durable_impairments.push(DurableImpairment {
        source_ability_use: source(&f, 1),
        rule: EffectRule {
            binding: EffectBinding::DeathAbility(source(&f, 1)),
            window: EffectWindow::NoDeadline,
            established: true,
        },
        self_interaction: SelfInteraction::IgnoreOwnContribution,
        impairment: ActiveImpairment {
            player_id: "p1".into(),
            kind: ImpairmentKind::Drunk,
            source_event_id: "death".into(),
            source_character_id: "sweetheart".into(),
            expires: ImpairmentExpiry::Never,
        },
    });
    resolve_effects(&context, &mut f).unwrap();
    assert!(impaired(&f, "p1"));
    f.players[0].actual_character = "artist".into();
    f.players[0].ability_instance.id = AbilityInstanceId::new("change", "p1");
    resolve_effects(&context, &mut f).unwrap();
    assert_eq!(f.active_impairments.len(), 1);
    assert_eq!(f.active_impairments[0].source_character_id, "sweetheart");
    assert!(!crate::reminders::project(&f)
        .iter()
        .any(|r| r.character_id == "snakeCharmer"));
}

#[test]
fn mutually_disabling_effects_fail_deterministically_instead_of_selecting_an_iteration() {
    use super::issue207_impairments::{facts, source};
    use crate::{contracts::TargetAssignment, effects::resolve_effects};
    let (context, mut f) = facts(&["poisoner", "poisoner", "artist"]);
    for (owner, target) in [(0, "p2"), (1, "p1")] {
        f.poisoner_choices.push(TargetAssignment {
            source_event_id: format!("choice-{owner}"),
            ability_use: source(&f, owner),
            target_player_id: target.into(),
            day: 1,
            initially_effective: true,
            effective: true,
        });
    }
    assert!(resolve_effects(&context, &mut f).is_err());
    f.poisoner_choices.reverse();
    assert!(resolve_effects(&context, &mut f).is_err());
}

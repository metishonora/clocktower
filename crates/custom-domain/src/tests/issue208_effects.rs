//! Bounded effect facts. Production selection and death are covered by later action suites.
use super::issue207_impairments::{facts, source};
use crate::{
    contracts::TargetAssignment,
    effects::{impaired, resolve_effects},
};
fn poison(state: &mut crate::state::CustomGameFacts, owner: usize, target: &str, success: bool) {
    state.poisoner_choices.push(TargetAssignment {
        source_event_id: "poison-choice".into(),
        ability_use: source(state, owner),
        target_player_id: target.into(),
        day: 1,
        initially_effective: success,
        effective: success,
    });
}
#[test]
fn self_poison_is_stable_and_source_death_ends_only_its_effect() {
    let (context, mut state) = facts(&["poisoner", "artist", "noDashii", "savant"]);
    poison(&mut state, 0, "p1", true);
    resolve_effects(&context, &mut state).unwrap();
    assert!(impaired(&state, "p1"));
    let expected = state.active_impairments.clone();
    for _ in 0..5 {
        resolve_effects(&context, &mut state).unwrap();
        assert_eq!(state.active_impairments, expected);
    }
    state.players[0].alive = false;
    resolve_effects(&context, &mut state).unwrap();
    assert!(!impaired(&state, "p1"));
    assert!(impaired(&state, "p2"));
    assert!(impaired(&state, "p4"));
}
#[test]
fn failed_poison_does_not_start_after_recovery() {
    let (context, mut state) = facts(&["poisoner", "artist", "savant"]);
    poison(&mut state, 0, "p2", false);
    resolve_effects(&context, &mut state).unwrap();
    assert!(!impaired(&state, "p2"));
}
#[test]
fn soldier_blocks_no_dashii_without_skipping_but_external_poison_disables_protection() {
    let (context, mut state) = facts(&["noDashii", "soldier", "artist", "savant", "poisoner"]);
    resolve_effects(&context, &mut state).unwrap();
    assert!(!impaired(&state, "p2"));
    assert!(!impaired(&state, "p3"));
    assert!(impaired(&state, "p4"));
    poison(&mut state, 4, "p2", true);
    resolve_effects(&context, &mut state).unwrap();
    assert_eq!(
        state
            .active_impairments
            .iter()
            .filter(|e| e.player_id == "p2")
            .count(),
        2
    );
    assert!(!impaired(&state, "p3"));
    state.players[4].alive = false;
    resolve_effects(&context, &mut state).unwrap();
    assert!(!impaired(&state, "p2"));
}
#[test]
fn source_storage_order_does_not_change_effect_results() {
    let (context, mut state) = facts(&["poisoner", "artist", "noDashii", "savant"]);
    poison(&mut state, 0, "p2", true);
    let mut reordered = state.clone();
    reordered.players.reverse();
    reordered.ability_provenance.reverse();
    resolve_effects(&context, &mut state).unwrap();
    resolve_effects(&context, &mut reordered).unwrap();
    assert_eq!(state.resolved_impairments, reordered.resolved_impairments);
}
#[test]
fn acquired_soldier_blocks_no_dashii_and_recovers_after_external_poison_ends() {
    use crate::{contracts::*, model::*, state::*};
    let (context, mut state) = facts(&["noDashii", "philosopher", "artist", "soldier", "poisoner"]);
    let parent = source(&state, 1);
    let id = AbilityInstanceId::new("choice", "p2");
    state.philosopher_choices.push(PhilosopherChoiceFact {
        source_event_id: "choice".into(),
        ability_use: parent.clone(),
        character_id: "soldier".into(),
        outcome: PhilosopherChoiceOutcome::Acquired,
    });
    state.ability_grants.push(AbilityGrant {
        owner_player_id: "p2".into(),
        character_id: "soldier".into(),
        source_event_id: "choice".into(),
        source_ability_instance_id: parent.ability_instance_id.clone(),
        ability_instance_id: id.clone(),
    });
    state.ability_provenance.push(AbilityProvenance {
        ability_use: AbilityUseRef {
            owner_player_id: "p2".into(),
            character_id: "soldier".into(),
            ability_instance_id: id,
        },
        origin: AbilityOrigin::Acquired {
            acquisition_event_id: "choice".into(),
            source: parent,
        },
    });
    resolve_effects(&context, &mut state).unwrap();
    assert!(!impaired(&state, "p2"));
    assert!(!impaired(&state, "p3"));
    poison(&mut state, 4, "p2", true);
    resolve_effects(&context, &mut state).unwrap();
    assert_eq!(
        state
            .active_impairments
            .iter()
            .filter(|e| e.player_id == "p2")
            .count(),
        2
    );
    state.players[4].alive = false;
    resolve_effects(&context, &mut state).unwrap();
    assert!(!impaired(&state, "p2"));
    assert_eq!(state.ability_grants.len(), 1);
}
#[test]
fn successful_poison_temporarily_stops_and_resumes_without_replacing_assignment() {
    use crate::contracts::*;
    let (context, mut state) = facts(&["poisoner", "artist", "savant"]);
    poison(&mut state, 0, "p2", true);
    resolve_effects(&context, &mut state).unwrap();
    assert!(state.poisoner_choices[0].effective);
    let external = ActiveImpairment {
        kind: ImpairmentKind::Drunk,
        player_id: "p1".into(),
        source_event_id: "external".into(),
        source_character_id: "philosopher".into(),
        expires: ImpairmentExpiry::Never,
    };
    state.active_impairments.push(external.clone());
    resolve_effects(&context, &mut state).unwrap();
    assert!(!impaired(&state, "p2"));
    assert!(!state.poisoner_choices[0].effective);
    state.active_impairments.retain(|e| e != &external);
    resolve_effects(&context, &mut state).unwrap();
    assert!(impaired(&state, "p2"));
    assert!(state.poisoner_choices[0].effective);
    assert_eq!(state.poisoner_choices.len(), 1);
}

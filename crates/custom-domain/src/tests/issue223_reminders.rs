//! Source/lifetime contracts complement the JSON replay/Undo and WASM acceptance suites.
use super::issue207_impairments::{facts, source};
use crate::{
    contracts::{ActiveImpairment, ImpairmentExpiry, ImpairmentKind},
    day::contracts::{DayConsequence, DayProgress, DayStage, ExecutionRecord},
    model::{AbilityGrant, AbilityInstanceId, AbilityOrigin, Alignment},
    reminders::project,
    state::{AbilityProvenance, CustomGameFacts, DurableImpairment},
};
fn executed(f: &mut CustomGameFacts) {
    let mut day = DayProgress::new(1);
    day.execution = Some(ExecutionRecord {
        event_id: "execution".into(),
        player_id: Some("p2".into()),
        death_event_id: Some("death".into()),
        died: true,
    });
    f.day = Some(day);
}
fn undertaker_count(f: &CustomGameFacts) -> usize {
    project(f)
        .iter()
        .filter(|r| r.character_id == "undertaker")
        .count()
}
#[test]
fn dispatch_requires_recorded_source_and_current_instance_not_just_character_name() {
    let (_, mut f) = facts(&["undertaker", "soldier"]);
    executed(&mut f);
    assert_eq!(undertaker_count(&f), 1);
    let ledger = f.ability_provenance.clone();
    f.ability_provenance.clear();
    assert_eq!(undertaker_count(&f), 0);
    f.ability_provenance = ledger;
    f.players[0].ability_instance.id = AbilityInstanceId::new("replacement", "p1");
    assert_eq!(undertaker_count(&f), 0);
    assert!(f.day.as_ref().unwrap().execution.as_ref().unwrap().died);
}
#[test]
fn acquired_undertaker_has_its_own_instance_and_shared_markers_are_not_duplicated() {
    let (_, mut f) = facts(&["philosopher", "soldier", "undertaker"]);
    executed(&mut f);
    let parent = source(&f, 0);
    let grant = AbilityGrant {
        owner_player_id: "p1".into(),
        character_id: "undertaker".into(),
        source_event_id: "choice".into(),
        source_ability_instance_id: parent.ability_instance_id.clone(),
        ability_instance_id: AbilityInstanceId::new("grant", "p1"),
    };
    let ability = crate::model::AbilityUseRef {
        owner_player_id: grant.owner_player_id.clone(),
        character_id: grant.character_id.clone(),
        ability_instance_id: grant.ability_instance_id.clone(),
    };
    f.ability_provenance.push(AbilityProvenance {
        ability_use: ability,
        origin: AbilityOrigin::Acquired {
            acquisition_event_id: "choice".into(),
            source: parent,
        },
    });
    f.ability_grants.push(grant);
    assert_eq!(undertaker_count(&f), 1);
    f.players[2].alive = false;
    assert_eq!(undertaker_count(&f), 1); // the acquired ability still observes the execution
    f.ability_grants.clear();
    assert_eq!(undertaker_count(&f), 0); // old provenance cannot keep the ability active
}
#[test]
fn failed_philosopher_guidance_is_not_an_actual_ability_and_ends_on_recovery() {
    let (_, mut f) = super::issue207_rule_state::failed_choice();
    f.philosopher_choices[0].character_id = "undertaker".into();
    executed(&mut f);
    assert_eq!(undertaker_count(&f), 1);
    assert!(!f
        .ability_provenance
        .iter()
        .any(|r| r.ability_use.character_id == "undertaker"));
    assert!(f.ability_grants.is_empty());
    f.active_impairments.clear();
    assert_eq!(undertaker_count(&f), 0);
}
#[test]
fn poison_does_not_remove_the_living_undertaker_reminder() {
    let (_, mut f) = facts(&["undertaker", "soldier"]);
    executed(&mut f);
    f.active_impairments.push(ActiveImpairment {
        kind: ImpairmentKind::Poisoned,
        player_id: "p1".into(),
        source_event_id: "poison".into(),
        source_character_id: "poisoner".into(),
        expires: ImpairmentExpiry::Never,
    });
    assert_eq!(undertaker_count(&f), 1);
    f.players[0].alive = false;
    assert_eq!(undertaker_count(&f), 0);
}
#[test]
fn dead_barber_keeps_death_bound_token_until_handoff_is_resolved() {
    let (_, mut f) = facts(&["barber", "soldier"]);
    executed(&mut f);
    let ability = source(&f, 0);
    f.day.as_mut().unwrap().consequences.push(DayConsequence {
        id: "barber-death".into(),
        death_event_id: "death".into(),
        source: ability,
        impaired_at_death: true,
        alignment_at_death: Alignment::Good,
        resolved: false,
        target_player_id: None,
    });
    f.players[0].alive = false;
    f.players[0].ability_instance.id = AbilityInstanceId::new("changed", "p1");
    let tokens = project(&f);
    assert_eq!(tokens.len(), 1);
    assert_eq!(tokens[0].token_id, "haircutsTonight");
    assert_eq!(tokens[0].source_event_id.as_deref(), Some("death"));
    assert!(tokens[0].inactive_reason.is_some());
    f.day.as_mut().unwrap().consequences[0].resolved = true;
    assert!(project(&f).is_empty());
}
#[test]
fn durable_poison_uses_historical_source_and_same_projection_for_spy_and_board() {
    let (context, mut f) = facts(&["snakeCharmer", "soldier"]);
    f.durable_impairments.push(DurableImpairment {
        source_ability_use: source(&f, 0),
        impairment: ActiveImpairment {
            kind: ImpairmentKind::Poisoned,
            player_id: "p2".into(),
            source_event_id: "swap".into(),
            source_character_id: "snakeCharmer".into(),
            expires: ImpairmentExpiry::Never,
        },
    });
    f.players[0].alive = false;
    f.players[0].ability_instance.id = AbilityInstanceId::new("swap", "p1");
    crate::effects::resolve_effects(&context, &mut f).unwrap();
    let tokens = project(&f);
    assert_eq!(tokens.len(), 1);
    assert_eq!(tokens[0].character_id, "snakeCharmer");
    assert_eq!(crate::reminders::for_player(&f, "p2"), tokens);
    assert_eq!(
        crate::projection::rule_state(&f).automatic_reminders,
        tokens
    );
}
#[test]
fn cerenovus_token_lifetime_is_independent_of_target_death_and_expires_at_night() {
    let (_, mut f) = facts(&["cerenovus", "soldier"]);
    executed(&mut f);
    f.madness_assignments
        .push(crate::contracts::MadnessAssignment {
            source_event_id: "madness".into(),
            ability_use: source(&f, 0),
            target_player_id: "p2".into(),
            character_id: "klutz".into(),
            day: 1,
            initially_effective: true,
            effective: true,
        });
    f.players[1].alive = false;
    assert_eq!(project(&f)[0].token_id, "mad");
    assert_eq!(undertaker_count(&f), 0);
    f.day.as_mut().unwrap().stage = DayStage::Night;
    assert!(project(&f).is_empty());
}
#[test]
fn registered_handlers_have_unique_supported_character_ids() {
    let mut seen = std::collections::HashSet::new();
    for h in crate::characters::trouble_brewing::reminder_handlers()
        .into_iter()
        .chain(crate::characters::sects_and_violets::reminder_handlers())
        .chain(crate::characters::carousel::reminder_handlers())
    {
        assert!(seen.insert(h.character_id));
        assert!(crate::characters::character_kind(h.character_id).is_some());
    }
}

#[test]
fn philosopher_identity_marker_requires_a_live_grant_without_an_original_character() {
    let (_, mut f) = facts(&["philosopher", "soldier"]);
    let parent = source(&f, 0);
    f.ability_grants.push(AbilityGrant {
        owner_player_id: "p1".into(),
        character_id: "artist".into(),
        source_event_id: "choice".into(),
        source_ability_instance_id: parent.ability_instance_id,
        ability_instance_id: AbilityInstanceId::new("grant", "p1"),
    });
    let has_marker =
        |f: &CustomGameFacts| project(f).iter().any(|r| r.token_id == "isThePhilosopher");
    assert!(has_marker(&f));
    f.players[1].actual_character = "artist".into();
    assert!(!has_marker(&f));
    f.players[1].actual_character = "soldier".into();
    f.ability_grants.clear();
    assert!(!has_marker(&f));
}

#[test]
fn every_supported_character_has_an_audited_reminder_policy() {
    // Explicit exclusions: a catalog addition must be reviewed instead of silently lacking tokens.
    let no_automatic_token = [
        "chambermaid",
        "zealot",
        "chef",
        "empath",
        "ravenkeeper",
        "soldier",
        "mayor",
        "recluse",
        "saint",
        "spy",
        "baron",
        "clockmaker",
        "dreamer",
        "oracle",
        "savant",
        "sage",
        "mutant",
        "klutz",
        "pitHag",
        "vortox",
    ];
    let subsequent_night_only = ["imp", "fangGu"];
    let handlers = crate::characters::trouble_brewing::reminder_handlers()
        .into_iter()
        .chain(crate::characters::sects_and_violets::reminder_handlers())
        .chain(crate::characters::carousel::reminder_handlers())
        .map(|h| h.character_id)
        .collect::<Vec<_>>();
    for entry in crate::characters::custom_script_catalog() {
        let policies = [
            handlers.contains(&entry.id),
            no_automatic_token.contains(&entry.id),
            subsequent_night_only.contains(&entry.id),
        ];
        assert_eq!(
            policies.into_iter().filter(|b| *b).count(),
            1,
            "{} must have exactly one audited policy",
            entry.id
        );
    }
    assert_eq!(
        handlers.len() + no_automatic_token.len() + subsequent_night_only.len(),
        55
    );
}

#[test]
fn observer_markers_use_action_time_identity_and_raw_votes_then_reset_at_dawn() {
    use crate::{
        day::contracts::{DayParticipant, NominationRecord},
        model::CharacterKind,
    };
    let (_, mut f) = facts(&["flowergirl", "townCrier", "scarletWoman", "vortox"]);
    assert!(!project(&f)
        .iter()
        .any(|r| r.character_id == "flowergirl" || r.character_id == "townCrier"));
    let snapshot = f
        .players
        .iter()
        .map(|p| DayParticipant {
            player_id: p.id.clone(),
            character_id: p.actual_character.clone(),
            alignment: p.alignment,
            character_kind: crate::characters::character_kind(&p.actual_character).unwrap(),
            alive: p.alive,
            ghost_vote_used: false,
            abilities: vec![],
            impairments: vec![],
        })
        .collect::<Vec<_>>();
    let mut day = DayProgress::new(1);
    day.nominations.push(NominationRecord {
        event_id: "nomination".into(),
        nominator_id: "p3".into(),
        nominee_id: "p2".into(),
        nomination_participants: snapshot.clone(),
        vote_event_id: Some("vote".into()),
        vote_participants: Some(snapshot),
        voter_ids: Some(vec!["p4".into()]),
        counted_voter_ids: Some(vec![]),
        ghost_vote_spent_player_ids: vec![],
    });
    f.day = Some(day);
    // Current identities no longer match the action-time minion and demon.
    f.players[2].actual_character = "soldier".into();
    f.players[3].actual_character = "soldier".into();
    let ids = |f: &CustomGameFacts| {
        project(f)
            .into_iter()
            .filter(|r| r.character_id == "flowergirl" || r.character_id == "townCrier")
            .map(|r| r.token_id)
            .collect::<Vec<_>>()
    };
    assert_eq!(ids(&f), ["demonVoted", "minionNominated"]);
    f.day.as_mut().unwrap().stage = DayStage::Night;
    assert_eq!(ids(&f), ["demonVoted", "minionNominated"]);
    f.day = Some(DayProgress::new(2));
    assert_eq!(ids(&f), ["demonDidNotVote", "minionDidNotNominate"]);
    f.players[0].alive = false;
    f.players[1].alive = false;
    assert!(ids(&f).is_empty());
    assert_eq!(
        crate::characters::character_kind("vortox"),
        Some(CharacterKind::Demon)
    );
}

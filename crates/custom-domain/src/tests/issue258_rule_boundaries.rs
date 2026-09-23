use super::issue207_acquisition::{confirm, replay};
use super::issue207_information::proposal;
use super::issue225_nights::{character, day, step, system};
use super::issue237_carousel::configured_game;
use serde_json::{json, Value};

fn game(roster: &[&str]) -> Value {
    let mut g = configured_game(roster, None, "nightwatchman");
    if replay(&g)["currentStep"]["character"] != "preacher" {
        team(&mut g);
    }
    g
}
fn team(g: &mut Value) {
    if replay(g)["currentStep"]["actionRef"]["actionId"] == "minionInfo" {
        confirm(g, Value::Null);
    }
    confirm(g, json!({"characterIds":["soldier","mayor","saint"]}));
}
fn append_proposal(g: &mut Value, p: &Value) {
    assert_eq!(p["ok"], true, "{p}");
    g["game"]["events"]
        .as_array_mut()
        .unwrap()
        .push(p["value"]["event"].clone());
    replay(g);
}
fn assert_reload_and_undo(before: &Value, after: &Value) {
    let mut loaded: Value = serde_json::from_str(&after.to_string()).unwrap();
    assert_eq!(replay(&loaded), replay(after));
    loaded["game"]["events"]
        .as_array_mut()
        .unwrap()
        .truncate(before["game"]["events"].as_array().unwrap().len());
    assert_eq!(replay(&loaded), replay(before));
}
#[test]
fn suppressed_spy_cannot_misregister_in_snv() {
    let roster = ["preacher", "seamstress", "savant", "spy", "imp"];
    let mut healthy = game(&roster);
    confirm(&mut healthy, json!({"playerIds":["p3"]}));
    team(&mut healthy);
    let input = json!({"playerIds":["p3","p4"]});
    let lie = json!({"kind":"boolean","value":true});
    let judgments = vec![json!({"playerId":"p4","registeredAs":"good"})];
    let accepted = proposal(
        &healthy,
        input.clone(),
        Some(lie.clone()),
        judgments.clone(),
    );
    let before = healthy.clone();
    append_proposal(&mut healthy, &accepted);
    assert_reload_and_undo(&before, &healthy);

    let mut suppressed = game(&roster);
    confirm(&mut suppressed, json!({"playerIds":["p4"]}));
    team(&mut suppressed);
    assert_eq!(
        replay(&suppressed)["currentStep"]["character"],
        "seamstress"
    );
    assert_eq!(
        proposal(&suppressed, input.clone(), Some(lie), judgments)["ok"],
        false
    );
    // A structurally valid event from the unsuppressed game cannot bypass replay validation.
    let mut forged = suppressed.clone();
    forged["game"]["events"]
        .as_array_mut()
        .unwrap()
        .push(accepted["value"]["event"].clone());
    assert_eq!(super::issue225_nights::result(&forged)["ok"], false);
    let correct = proposal(
        &suppressed,
        input,
        Some(json!({"kind":"boolean","value":false})),
        vec![],
    );
    let before = suppressed.clone();
    append_proposal(&mut suppressed, &correct);
    assert_reload_and_undo(&before, &suppressed);
}

#[test]
fn suppressed_spy_is_not_a_pixie_townsfolk_candidate() {
    let mut accepted = Value::Null;
    for suppressed in [false, true] {
        let mut g = game(&["preacher", "pixie", "savant", "spy", "imp"]);
        confirm(
            &mut g,
            json!({"playerIds":[if suppressed { "p4" } else { "p3" }]}),
        );
        team(&mut g);
        let state = replay(&g);
        assert_eq!(state["currentStep"]["character"], "pixie");
        assert_eq!(
            state["currentStep"]["requiredInput"]["allowedPlayerIds"]
                .as_array()
                .unwrap()
                .contains(&json!("p4")),
            !suppressed
        );
        let p = proposal(
            &g,
            json!({"playerIds":["p4"]}),
            Some(json!({"kind":"character","characterId":"soldier"})),
            vec![json!({"playerId":"p4","registeredAs":"townsfolk","characterId":"soldier"})],
        );
        assert_eq!(p["ok"], !suppressed, "{p}");
        if suppressed {
            g["game"]["events"]
                .as_array_mut()
                .unwrap()
                .push(accepted["value"]["event"].clone());
            assert_eq!(super::issue225_nights::result(&g)["ok"], false);
        } else {
            accepted = p.clone();
            let before = g.clone();
            append_proposal(&mut g, &p);
            assert_reload_and_undo(&before, &g);
        }
    }
}

#[test]
fn vigormortis_includes_new_townsfolk_neighbors() {
    use super::issue225_nights::begin_night;
    for neighbor in ["nightwatchman", "chambermaid", "savant"] {
        let mut g = configured_game(
            &[
                "soldier",
                "virgin",
                "slayer",
                "ravenkeeper",
                "undertaker",
                neighbor,
                "witch",
                "vigormortis",
            ],
            None,
            "nightwatchman",
        );
        for _ in 0..30 {
            let state = replay(&g);
            if state["phase"] == "day" {
                break;
            }
            let st = &state["currentStep"];
            let input = match st["actionRef"]["actionId"].as_str().unwrap() {
                "chooseCursedPlayer" => json!({"playerIds":["p1"]}),
                "learnCount" => json!({"playerIds":["p1","p7"]}),
                "demonInfo" => {
                    json!({"characterIds":st["requiredInput"]["allowedCharacterIds"].as_array().unwrap()[..3]})
                }
                _ => Value::Null,
            };
            confirm(&mut g, input);
        }
        assert_eq!(replay(&g)["phase"], "day");
        begin_night(&mut g);
        step(
            &mut g,
            character("witch", "chooseCursedPlayer"),
            json!({"playerIds":["p1"]}),
            None,
        );
        if replay(&g)["currentStep"]["character"] == "nightwatchman" {
            confirm(&mut g, Value::Null);
        }
        step(
            &mut g,
            character("vigormortis", "attackPlayer"),
            json!({"playerIds":["p7"]}),
            None,
        );
        let state = replay(&g);
        assert_eq!(
            state["currentStep"]["actionRef"],
            character("vigormortis", "choosePoison")
        );
        assert_eq!(
            state["currentStep"]["requiredInput"]["allowedPlayerIds"],
            json!(["p1", "p6"]),
            "{neighbor}"
        );
        assert_eq!(
            proposal(&g, json!({"playerIds":["p5"]}), None, vec![])["ok"],
            false
        );
        let before = g.clone();
        confirm(&mut g, json!({"playerIds":["p6"]}));
        assert!(replay(&g)["ruleState"]["activeImpairments"]
            .as_array()
            .unwrap()
            .iter()
            .any(|e| e["playerId"] == "p6" && e["sourceCharacterId"] == "vigormortis"));
        assert_reload_and_undo(&before, &g);
    }
}

fn suppressed_spy_day() -> Value {
    let mut g = game(&[
        "preacher",
        "townCrier",
        "flowergirl",
        "undertaker",
        "slayer",
        "spy",
        "imp",
    ]);
    confirm(&mut g, json!({"playerIds":["p6"]}));
    team(&mut g);
    step(&mut g, system("dawn"), Value::Null, None);
    for _ in 0..3 {
        day(&mut g, json!({"kind":"advance"}));
    }
    g
}
fn execute(g: &mut Value, target: &str) {
    day(
        g,
        json!({"kind":"nominate","nominatorId":"p6","nomineeId":target}),
    );
    day(g, json!({"kind":"vote","voterIds":["p2","p3","p4","p6"]}));
    day(g, json!({"kind":"closeNominations"}));
    day(g, json!({"kind":"confirmExecution"}));
    day(g, json!({"kind":"confirmDeath"}));
}
#[test]
fn historical_nomination_and_vote_keep_suppression_after_preacher_dies() {
    let mut g = suppressed_spy_day();
    execute(&mut g, "p1");
    // The Spy owns its ability throughout; recovery must not rewrite event-time availability.
    let nominated = &replay(&g)["day"]["nominations"][0];
    assert!(nominated.get("voteEventId").is_none());
    assert!(nominated["nominationParticipants"][5]["abilities"]
        .as_array()
        .unwrap()
        .iter()
        .any(|a| a["characterId"] == "spy"));
    day(&mut g, json!({"kind":"beginNight"}));
    step(
        &mut g,
        character("imp", "attackPlayer"),
        json!({"playerIds":["p5"]}),
        None,
    );
    step(
        &mut g,
        character("undertaker", "learnExecutedCharacter"),
        Value::Null,
        None,
    );
    for (observer, actual) in [("flowergirl", false), ("townCrier", true)] {
        let state = replay(&g);
        assert_eq!(state["currentStep"]["character"], observer);
        assert!(
            !state["currentStep"]["informationPrompt"]["registrationCandidatePlayerIds"]
                .as_array()
                .unwrap()
                .contains(&json!("p6"))
        );
        let p = proposal(
            &g,
            Value::Null,
            Some(json!({"kind":"boolean","value":false})),
            vec![json!({"playerId":"p6","registeredAs":"townsfolk"})],
        );
        assert_eq!(p["ok"], false, "{observer}: {p}");
        let before = g.clone();
        confirm(&mut g, Value::Null);
        assert_eq!(
            g["game"]["events"].as_array().unwrap().last().unwrap()["payload"]["result"]
                ["information"]["deliveredResult"]["value"],
            actual
        );
        assert_reload_and_undo(&before, &g);
    }
    assert_eq!(
        replay(&g)["currentStep"]["character"],
        "spy",
        "Current ability has recovered"
    );
}
#[test]
fn undertaker_uses_death_time_suppression_even_after_source_dies() {
    let mut g = suppressed_spy_day();
    execute(&mut g, "p6");
    day(&mut g, json!({"kind":"beginNight"}));
    step(
        &mut g,
        character("preacher", "choosePlayer"),
        json!({"playerIds":["p7"]}),
        None,
    );
    step(
        &mut g,
        character("imp", "attackPlayer"),
        json!({"playerIds":["p1"]}),
        None,
    );
    assert_eq!(replay(&g)["currentStep"]["character"], "undertaker");
    let p = proposal(
        &g,
        Value::Null,
        Some(json!({"kind":"character","characterId":"soldier"})),
        vec![json!({"playerId":"p6","registeredAs":"townsfolk","characterId":"soldier"})],
    );
    assert_eq!(p["ok"], false, "{p}");
    let before = g.clone();
    let event = confirm(&mut g, Value::Null);
    assert_eq!(
        event["payload"]["result"]["information"]["deliveredResult"]["characterId"],
        "spy"
    );
    assert_reload_and_undo(&before, &g);
}

#[test]
fn registration_preserves_dead_abilities_and_preacher_pause_recovery() {
    use super::issue207_impairments::{facts, source};
    use crate::{
        characters::registration_source,
        contracts::{ActiveImpairment, ImpairmentExpiry, ImpairmentKind},
    };
    for character in ["spy", "recluse"] {
        let (_, mut f) = facts(&["preacher", character, "imp"]);
        let original = source(&f, 1);
        f.players[1].alive = false;
        assert_eq!(registration_source(&f, "p2"), Some(original.clone()));
        f.active_impairments.push(ActiveImpairment {
            player_id: "p2".into(),
            kind: ImpairmentKind::Poisoned,
            source_event_id: "poison".into(),
            source_character_id: "poisoner".into(),
            expires: ImpairmentExpiry::Never,
        });
        assert!(registration_source(&f, "p2").is_none());
        f.active_impairments.clear();
        assert_eq!(registration_source(&f, "p2"), Some(original));
        f.players[1].ability_instance.id = crate::model::AbilityInstanceId::new("replaced", "p2");
        assert!(registration_source(&f, "p2").is_none());
    }
    let (_, mut f) = facts(&["preacher", "spy", "imp"]);
    let spy = source(&f, 1);
    f.preacher_selections
        .push(crate::characters::carousel::PreacherSelection {
            source: source(&f, 0),
            source_identity: f.players[0].ability_instance.id.clone(),
            target: spy.clone(),
            event_id: "preached".into(),
        });
    assert!(registration_source(&f, "p2").is_none());
    f.active_impairments.push(ActiveImpairment {
        player_id: "p1".into(),
        kind: ImpairmentKind::Poisoned,
        source_event_id: "poison".into(),
        source_character_id: "poisoner".into(),
        expires: ImpairmentExpiry::Never,
    });
    assert_eq!(registration_source(&f, "p2"), Some(spy.clone()));
    f.active_impairments.clear();
    assert!(registration_source(&f, "p2").is_none());
    f.players[0].alive = false;
    assert_eq!(registration_source(&f, "p2"), Some(spy));
}

#[test]
fn boffin_registration_and_sage_jinx_share_source_availability_and_ability_impairment() {
    use super::issue207_impairments::{facts, source};
    use crate::{
        characters::registration_source,
        contracts::{ActiveImpairment, ImpairmentExpiry, ImpairmentKind},
        jinxes::RegistrationContext,
    };
    let (_, mut f) = facts(&["sage", "boffin", "imp"]);
    let boffin = source(&f, 1);
    f.boffin_assignments
        .push(crate::characters::carousel::BoffinAssignment {
            source: boffin.clone(),
            demon: source(&f, 2),
            character_id: "recluse".into(),
            event_id: "boffin-grant".into(),
            informed: true,
        });
    crate::reducer::apply_ability_grant(
        &mut f,
        "boffin-grant",
        &crate::event::AbilityGrantChange {
            owner_player_id: "p3".into(),
            character_id: "recluse".into(),
            source: boffin,
        },
    );
    let granted = registration_source(&f, "p3").expect("Boffin-granted Recluse is active");
    let observer = crate::state::ActionOccurrence::character(
        crate::contracts::FirstNightActionRef::Character {
            character_id: "sage".into(),
            action_id: "learnDemon".into(),
        },
        source(&f, 0),
    )
    .unwrap();
    let jinx = crate::jinxes::production().unwrap();
    let candidates = |f: &crate::state::CustomGameFacts| {
        jinx.registrations(&RegistrationContext {
            facts: f,
            observer: &observer,
            target_id: "p3",
        })
    };
    assert_eq!(candidates(&f).len(), 1);
    f.active_impairments.push(ActiveImpairment {
        player_id: "p3".into(),
        kind: ImpairmentKind::Poisoned,
        source_event_id: "poison".into(),
        source_character_id: "poisoner".into(),
        expires: ImpairmentExpiry::Never,
    });
    assert_eq!(
        registration_source(&f, "p3"),
        Some(granted.clone()),
        "Demon poison does not impair its Boffin ability"
    );
    assert_eq!(candidates(&f).len(), 1);
    f.active_impairments[0].player_id = "p2".into();
    assert!(registration_source(&f, "p3").is_none());
    assert!(candidates(&f).is_empty());
    assert!(f
        .ability_grants
        .iter()
        .any(|g| g.ability_instance_id == granted.ability_instance_id));
    f.active_impairments.clear();
    assert_eq!(registration_source(&f, "p3"), Some(granted));
    assert_eq!(candidates(&f).len(), 1);
    f.players[1].alive = false;
    assert!(registration_source(&f, "p3").is_none());
    assert!(candidates(&f).is_empty());
}

#[test]
fn historical_boffin_registration_uses_ability_impairment_at_each_event_prefix() {
    let mut g = configured_game(
        &[
            "flowergirl",
            "townCrier",
            "soldier",
            "virgin",
            "slayer",
            "sage",
            "oracle",
            "boffin",
            "poisoner",
            "imp",
        ],
        Some("recluse"),
        "nightwatchman",
    );
    for _ in 0..10 {
        let state = replay(&g);
        if state["phase"] == "day" {
            break;
        }
        let st = &state["currentStep"];
        let input = match st["actionRef"]["actionId"].as_str().unwrap() {
            "grantAbility" => json!({"playerIds":["p10"],"characterIds":["recluse"]}),
            "demonInfo" => {
                json!({"characterIds":st["requiredInput"]["allowedCharacterIds"].as_array().unwrap()[..3]})
            }
            "choosePoisonTarget" => json!({"playerIds":["p10"]}),
            "minionInfo" | "dawn" => Value::Null,
            _ => panic!("Unexpected action: {st}"),
        };
        confirm(&mut g, input);
    }
    assert_eq!(replay(&g)["phase"], "day");
    for _ in 0..3 {
        day(&mut g, json!({"kind":"advance"}));
    }
    day(
        &mut g,
        json!({"kind":"nominate","nominatorId":"p10","nomineeId":"p4"}),
    );
    day(&mut g, json!({"kind":"vote","voterIds":["p10"]}));
    day(&mut g, json!({"kind":"closeNominations"}));
    day(&mut g, json!({"kind":"confirmExecution"}));
    day(&mut g, json!({"kind":"beginNight"}));
    step(
        &mut g,
        character("poisoner", "choosePoisonTarget"),
        json!({"playerIds":["p8"]}),
        None,
    );
    step(
        &mut g,
        character("imp", "attackPlayer"),
        json!({"playerIds":["p3"]}),
        None,
    );
    for (observer, value) in [("flowergirl", false), ("townCrier", true)] {
        assert_eq!(replay(&g)["currentStep"]["character"], observer);
        let accepted = proposal(
            &g,
            Value::Null,
            Some(json!({"kind":"boolean","value":value})),
            vec![json!({"playerId":"p10","registeredAs":"minion"})],
        );
        let before = g.clone();
        append_proposal(&mut g, &accepted);
        assert_reload_and_undo(&before, &g);
    }
}

use super::issue207_acquisition::{confirm, replay};
use super::issue225_nights::{begin_night, day};
use super::issue237_carousel::configured_game;
use serde_json::{json, Value};

fn first_night(g: &mut Value) {
    first_night_until(g, None);
}
fn first_night_until(g: &mut Value, stop: Option<&str>) {
    for _ in 0..25 {
        let s = replay(g);
        if s["phase"] == "day" {
            return;
        }
        let step = &s["currentStep"];
        if stop.is_some_and(|id| step["character"] == id) { return; }
        if step["character"] == "mathematician" {
            super::issue225_nights::step(
                g,
                step["actionRef"].clone(),
                Value::Null,
                Some(step["informationPrompt"]["computedResult"].clone()),
            );
            continue;
        }
        let input = match step["actionRef"]["actionId"].as_str().unwrap() {
            "minionInfo" | "learnTwin" | "dawn" => Value::Null,
            "assignTwin" => json!({"playerIds":["p1"]}),
            "assignMadness" => json!({"playerIds":["p1"],"characterId":"artist"}),
            "demonInfo" => {
                json!({"characterIds":step["requiredInput"]["allowedCharacterIds"].as_array().unwrap()[..3]})
            }
            "grantAbility" => {
                json!({"playerIds":step["requiredInput"]["allowedPlayerIds"],"characterIds":step["requiredInput"]["allowedCharacterIds"]})
            }
            "choosePlayer" if step["character"] == "preacher" => json!({"playerIds":["p6"]}),
            "learnGrandchild" => json!({"playerIds":["p2"]}),
            "protectExecution" => json!({"playerIds":["p1"]}),
            "choosePoisonTarget" => json!({"playerIds":["p1"]}),
            "chooseCursedPlayer" => json!({"playerIds":["p1"]}),
            _ if step["requiredInput"]["optional"] == true => Value::Null,
            _ => panic!("Unexpected step {step}"),
        };
        confirm(g, input);
    }
    panic!("First night did not finish");
}
fn game(minion: &str) -> Value {
    let mut g = configured_game(
        &[
            "fool", "soldier", "mayor", "artist", "savant", minion, "imp",
        ],
        None,
        "nightwatchman",
    );
    first_night(&mut g);
    g
}
fn alive(g: &Value, id: &str) -> bool {
    replay(g)["players"]
        .as_array()
        .unwrap()
        .iter()
        .find(|p| p["id"] == id)
        .unwrap()["alive"]
        .as_bool()
        .unwrap()
}
fn execute(g: &mut Value) {
    for _ in 0..3 {
        day(g, json!({"kind":"advance"}));
    }
    day(
        g,
        json!({"kind":"nominate","nominatorId":"p2","nomineeId":"p1"}),
    );
    let voters = replay(g)["players"].as_array().unwrap().iter().map(|p| p["id"].clone()).collect::<Vec<_>>();
    day(g, json!({"kind":"vote","voterIds":voters}));
    day(g, json!({"kind":"closeNominations"}));
    day(g, json!({"kind":"confirmExecution"}));
}
#[test]
fn fool_imp_first_attempt_consumes_and_undo_restores_then_second_attempt_kills() {
    let mut g = game("assassin");
    begin_night(&mut g);
    let before = g.clone();
    let e = confirm(&mut g, json!({"playerIds":["p1"]}));
    assert_eq!(e["payload"]["result"]["died"], false);
    assert!(alive(&g, "p1"));
    let after = replay(&g);
    let restored: Value = serde_json::from_str(&g.to_string()).unwrap();
    assert_eq!(replay(&restored), after);
    let mut undo = g.clone();
    undo["game"]["events"]
        .as_array_mut()
        .unwrap()
        .truncate(before["game"]["events"].as_array().unwrap().len());
    assert_eq!(replay(&undo), replay(&before));
    confirm(&mut g, Value::Null);
    if replay(&g)["phase"] != "day" {
        confirm(&mut g, Value::Null);
    }
    begin_night(&mut g);
    confirm(&mut g, json!({"playerIds":["p1"]}));
    assert!(!alive(&g, "p1"));
}
#[test]
fn assassin_bypasses_unused_fool_and_spends() {
    let mut g = game("assassin");
    begin_night(&mut g);
    confirm(&mut g, json!({"playerIds":["p2"]})); // Soldier stops this attack.
    let e = confirm(&mut g, json!({"playerIds":["p1"]}));
    assert_eq!(e["payload"]["result"]["spent"], true);
    assert_eq!(
        e["payload"]["result"]["deaths"][0]["prevention"],
        Value::Null
    );
    assert!(!alive(&g, "p1"));
}
#[test]
fn fool_execution_is_one_confirmation_and_does_not_record_a_death() {
    let mut g = game("assassin");
    execute(&mut g);
    let s = replay(&g);
    assert_eq!(s["day"]["stage"], "nightReady");
    assert_eq!(s["day"]["execution"]["died"], false);
    assert!(alive(&g, "p1"));
}
#[test]
fn advocate_precedes_fool_and_expiration_leaves_first_prevention_available() {
    let mut g = game("devilsAdvocate");
    execute(&mut g);
    assert!(alive(&g, "p1"));
    assert_eq!(replay(&g)["day"]["stage"], "nightReady");
    day(&mut g, json!({"kind":"beginNight"}));
    confirm(&mut g, json!({"playerIds":["p2"]}));
    let e = confirm(&mut g, json!({"playerIds":["p1"]}));
    assert_eq!(e["payload"]["result"]["died"], false);
    assert!(alive(&g, "p1"));
}
#[test]
fn witch_and_poisoned_fool_use_the_same_actual_death_boundary() {
    let mut g = game("witch");
    for _ in 0..3 {
        day(&mut g, json!({"kind":"advance"}));
    }
    day(
        &mut g,
        json!({"kind":"nominate","nominatorId":"p1","nomineeId":"p2"}),
    );
    assert_eq!(replay(&g)["day"]["stage"], "death");
    day(&mut g, json!({"kind":"confirmDeath"}));
    assert!(alive(&g, "p1"));
    let mut poisoned = game("poisoner");
    execute(&mut poisoned);
    assert_eq!(replay(&poisoned)["day"]["stage"], "executionDeath");
    day(&mut poisoned, json!({"kind":"confirmDeath"}));
    assert!(!alive(&poisoned, "p1"));
    assert!(replay(&poisoned)["ruleState"]["abilityUses"]
        .as_array()
        .unwrap()
        .iter()
        .any(|u| u["abilityUse"]["characterId"] == "fool"));
}

fn finish_night(g: &mut Value) {
    for _ in 0..12 {
        let state = replay(g);
        if state["phase"] == "day" {
            return;
        }
        let a = state["currentStep"]["actionRef"]["actionId"]
            .as_str()
            .unwrap();
        let input = match a {
            "attackPlayer" => json!({"playerIds":["p2"]}),
            "protectExecution" => json!({"playerIds":["p2"]}),
            _ => Value::Null,
        };
        confirm(g, input);
    }
    panic!("night did not end");
}
#[test]
fn grandmother_demon_chain_preserves_two_causes_and_one_undo_unit() {
    let mut g = configured_game(
        &[
            "grandmother",
            "artist",
            "fool",
            "mayor",
            "savant",
            "assassin",
            "imp",
        ],
        None,
        "nightwatchman",
    );
    first_night(&mut g);
    begin_night(&mut g);
    let before = g.clone();
    let e = confirm(&mut g, json!({"playerIds":["p2"]}));
    assert!(!alive(&g, "p1") && !alive(&g, "p2"));
    let state = replay(&g);
    let records = state["ruleState"]["deathResolutions"].as_array().unwrap();
    let outcomes = &records.last().unwrap()["outcomes"];
    assert_eq!(outcomes[0]["sourceCharacterId"], "imp");
    assert_eq!(outcomes[1]["sourceCharacterId"], "grandmother");
    assert!(state["latestUndoUnit"]["eventIds"]
        .as_array()
        .unwrap()
        .contains(&e["id"]));
    let mut undo = g.clone();
    undo["game"]["events"].as_array_mut().unwrap().pop();
    assert_eq!(replay(&undo), replay(&before));
    let mut non_demon = before;
    confirm(&mut non_demon, json!({"playerIds":["p3"]}));
    confirm(&mut non_demon, json!({"playerIds":["p2"]}));
    assert!(alive(&non_demon, "p1"));
}
#[test]
fn gambler_wrong_correct_and_poisoned_results_are_canonical() {
    for (minion, guess, correct, effective, dies) in [
        ("assassin", "gambler", true, true, false),
        ("assassin", "imp", false, true, true),
        ("poisoner", "imp", false, false, false),
    ] {
        let mut g = configured_game(
            &[
                "gambler", "soldier", "fool", "mayor", "artist", minion, "imp",
            ],
            None,
            "nightwatchman",
        );
        first_night(&mut g);
        begin_night(&mut g);
        if minion == "poisoner" {
            confirm(&mut g, json!({"playerIds":["p1"]}));
        }
        let event = confirm(&mut g, json!({"playerIds":["p1"],"characterIds":[guess]}));
        assert_eq!(event["payload"]["result"]["correct"], correct);
        assert_eq!(event["payload"]["result"]["effective"], effective);
        assert_eq!(alive(&g, "p1"), !dies);
        let roundtrip: Value = serde_json::from_str(&g.to_string()).unwrap();
        assert_eq!(replay(&roundtrip), replay(&g));
    }
}
#[test]
fn moonchild_night_announcement_records_choice_and_checks_at_following_night() {
    let mut g = configured_game(
        &[
            "fool",
            "soldier",
            "artist",
            "savant",
            "mayor",
            "moonchild",
            "assassin",
            "imp",
        ],
        None,
        "nightwatchman",
    );
    first_night(&mut g);
    begin_night(&mut g);
    confirm(&mut g, json!({"playerIds":["p6"]}));
    finish_night(&mut g);
    assert!(replay(&g)["day"]["consequences"]
        .as_array()
        .unwrap()
        .is_empty());
    day(&mut g, json!({"kind":"advance"}));
    let c = replay(&g)["day"]["consequences"][0].clone();
    assert_eq!(c["source"]["characterId"], "moonchild");
    day(
        &mut g,
        json!({"kind":"resolveConsequence","consequenceId":c["id"],"playerId":"p1"}),
    );
    for _ in 0..2 {
        day(&mut g, json!({"kind":"advance"}));
    }
    day(&mut g, json!({"kind":"closeNominations"}));
    day(&mut g, json!({"kind":"confirmExecution"}));
    day(&mut g, json!({"kind":"beginNight"}));
    confirm(&mut g, json!({"playerIds":["p2"]}));
    confirm(&mut g, Value::Null);
    assert_eq!(replay(&g)["currentStep"]["character"], "moonchild");
    let e = confirm(&mut g, Value::Null);
    assert_eq!(
        e["payload"]["result"]["deaths"][0]["prevention"]["source"]["characterId"],
        "fool"
    );
    assert!(alive(&g, "p1"));
}
#[test]
fn public_moonchild_registration_is_frozen_and_backward_compatible() {
    let mut g = configured_game(
        &[
            "artist",
            "soldier",
            "savant",
            "fool",
            "recluse",
            "moonchild",
            "assassin",
            "imp",
            "mayor",
        ],
        None,
        "nightwatchman",
    );
    first_night(&mut g);
    begin_night(&mut g);
    confirm(&mut g, json!({"playerIds":["p6"]}));
    finish_night(&mut g);
    day(&mut g, json!({"kind":"advance"}));
    let c = replay(&g)["day"]["consequences"][0].clone();
    let before = g.clone();
    day(
        &mut g,
        json!({"kind":"resolveConsequence","consequenceId":c["id"],"playerId":"p5","registrationJudgments":[{"playerId":"p5","registeredAs":"evil"}]}),
    );
    assert_eq!(
        replay(&g)["ruleState"]["scheduledDeaths"][0]["chosenGood"],
        false
    );
    let imported: Value = serde_json::from_str(&g.to_string()).unwrap();
    assert_eq!(replay(&g), replay(&imported));
    let mut actual = before;
    day(
        &mut actual,
        json!({"kind":"resolveConsequence","consequenceId":c["id"],"playerId":"p5"}),
    );
    assert_eq!(
        replay(&actual)["ruleState"]["scheduledDeaths"][0]["chosenGood"],
        true
    );
}

fn resolve_bmr(
    context: &crate::characters::ResolvedScriptContext,
    facts: &crate::state::CustomGameFacts,
    character: &str,
    input: Value,
    judgments: Vec<crate::model::RegistrationJudgment>,
) -> (
    crate::contracts::CustomActionResult,
    crate::event::CustomFactChanges,
) {
    let entry=crate::characters::bad_moon_rising::registrations().into_iter().find(|e| matches!(&e.spec.action_ref,crate::contracts::FirstNightActionRef::Character {character_id,..} if character_id==character)).unwrap();
    let rules = crate::rules::CustomRuleService::new(context, facts);
    let c = crate::first_night::ActionContext {
        event_id: "bmr-contract",
        rule_service: &rules,
    };
    let step = entry.handler.project(&entry.spec, &c).unwrap().remove(0);
    let occurrence = crate::state::ActionOccurrence::from_all_parts(
        entry.spec.action_ref.clone(),
        step.ability_use,
        step.simulation_source,
        step.follow_up_cause,
        step.action_cause,
    )
    .unwrap()
    .in_night(facts.night_number());
    let input = crate::first_night::ActionInput {
        input: serde_json::from_value(input).unwrap(),
        delivered_result: None,
        registration_judgments: judgments,
    };
    let draft = entry
        .handler
        .propose_input(&entry.spec, &c, &occurrence, &input)
        .unwrap();
    let changes = entry
        .handler
        .validate_event(&entry.spec, &c, &occurrence, &draft)
        .unwrap();
    let crate::first_night::ActionEventDraft::Custom(draft) = draft else {
        panic!("character event")
    };
    (draft.result, changes)
}
fn poison(f: &mut crate::state::CustomGameFacts, target: &str) {
    f.active_impairments
        .push(crate::contracts::ActiveImpairment {
            kind: crate::contracts::ImpairmentKind::Poisoned,
            player_id: target.into(),
            source_event_id: "poison".into(),
            source_character_id: "poisoner".into(),
            expires: crate::contracts::ImpairmentExpiry::Never,
        });
}
#[test]
fn gambler_death_uses_the_shared_protection_for_an_acquired_fool_instance() {
    use crate::model::*;
    use crate::state::*;
    let (d, mut f) = super::issue207_impairments::facts(&["gambler", "fool", "poisoner", "imp"]);
    let parent = super::issue207_impairments::source(&f, 0);
    let grant = AbilityGrant {
        owner_player_id: "p1".into(),
        character_id: "fool".into(),
        source_event_id: "acquire".into(),
        source_ability_instance_id: parent.ability_instance_id.clone(),
        ability_instance_id: AbilityInstanceId::new("acquire", "p1"),
    };
    let source = AbilityUseRef {
        owner_player_id: grant.owner_player_id.clone(),
        character_id: grant.character_id.clone(),
        ability_instance_id: grant.ability_instance_id.clone(),
    };
    f.ability_grants.push(grant);
    f.ability_provenance.push(AbilityProvenance {
        ability_use: source.clone(),
        origin: AbilityOrigin::Acquired {
            acquisition_event_id: "acquire".into(),
            source: parent,
        },
    });
    let input = json!({"playerIds":["p1"],"characterIds":["imp"]});
    let (result, changes) = resolve_bmr(&d, &f, "gambler", input.clone(), vec![]);
    let crate::contracts::CustomActionResult::GamblerGuessed { deaths, .. } = result else {
        panic!("gambler")
    };
    assert_eq!(deaths[0].prevention.as_ref().unwrap().source, source);
    assert!(changes.life_changes().is_empty());
    crate::death::consume(&mut f, &deaths[0], "first");
    let (_, second) = resolve_bmr(&d, &f, "gambler", input, vec![]);
    assert_eq!(second.life_changes()[0].player_id, "p1");
}
#[test]
fn gambler_registration_supports_spy_and_recluse() {
    use crate::model::*;
    let (d, f) = super::issue207_impairments::facts(&["gambler", "spy", "recluse", "imp"]);
    for (target, guess, kind) in [
        ("p2", "artist", RegistrationValue::Townsfolk),
        ("p3", "imp", RegistrationValue::Demon),
    ] {
        let (result, _) = resolve_bmr(
            &d,
            &f,
            "gambler",
            json!({"playerIds":[target],"characterIds":[guess]}),
            vec![RegistrationJudgment {
                scope: None,
                player_id: target.into(),
                registered_as: kind,
                character_id: Some(guess.into()),
            }],
        );
        assert!(matches!(
            result,
            crate::contracts::CustomActionResult::GamblerGuessed { correct: true, .. }
        ));
    }
}
#[test]
fn moonchild_checks_impairment_at_resolution_and_uses_frozen_alignment() {
    use crate::characters::bad_moon_rising::MoonchildChoice;
    let (d, mut f) =
        super::issue207_impairments::facts(&["moonchild", "artist", "poisoner", "fool"]);
    f.day = Some(crate::day::contracts::DayProgress::new(1));
    f.day.as_mut().unwrap().stage = crate::day::contracts::DayStage::Night;
    let source = super::issue207_impairments::source(&f, 0);
    f.players[0].alive = false;
    f.moonchild_choices.push(MoonchildChoice {
        source: source.clone(),
        event_id: "choice".into(),
        death_event_id: "death".into(),
        target_player_id: "p2".into(),
        chosen_good: true,
        night: 2,
    });
    f.players[1].alignment = crate::model::Alignment::Evil;
    let (result, _) = resolve_bmr(&d, &f, "moonchild", Value::Null, vec![]);
    assert!(
        matches!(result,crate::contracts::CustomActionResult::MoonchildResolved {effective:true,deaths,..} if deaths[0].died)
    );
    poison(&mut f, "p1");
    let (result, _) = resolve_bmr(&d, &f, "moonchild", Value::Null, vec![]);
    assert!(
        matches!(result,crate::contracts::CustomActionResult::MoonchildResolved {effective:false,deaths,..} if deaths.is_empty())
    );
    f.active_impairments.clear();
    f.players[1].alive = false;
    let (_, changes) = resolve_bmr(&d, &f, "moonchild", Value::Null, vec![]);
    assert!(changes.life_changes().is_empty());
    f.players[1].alive = true;
    f.players[0].ability_instance.id = crate::model::AbilityInstanceId::new("changed", "p1");
    let (result, _) = resolve_bmr(&d, &f, "moonchild", Value::Null, vec![]);
    assert!(matches!(
        result,
        crate::contracts::CustomActionResult::MoonchildResolved {
            effective: false,
            ..
        }
    ));
}
#[test]
fn poisoned_assassin_spends_without_killing_and_protection_cannot_intercept_a_healthy_hit() {
    let (d, mut f) = super::issue207_impairments::facts(&["assassin", "fool", "poisoner"]);
    poison(&mut f, "p1");
    let (result, changes) = resolve_bmr(&d, &f, "assassin", json!({"playerIds":["p2"]}), vec![]);
    assert!(
        matches!(result,crate::contracts::CustomActionResult::AssassinUsed {spent:true,deaths,..} if deaths.is_empty())
    );
    assert!(changes.life_changes().is_empty());
    f.active_impairments.clear();
    let (_, changes) = resolve_bmr(&d, &f, "assassin", json!({"playerIds":["p2"]}), vec![]);
    assert_eq!(changes.life_changes()[0].player_id, "p2");
    assert!(changes.resolved_deaths().outcomes[0].prevention.is_none());
}
#[test]
fn current_default_places_arbitrary_deaths_after_assassin_without_rewriting_explicit_order() {
    let draft = json!({"id":"order271","name":"order","nightOrderVersion":2,"characterIds":["pitHag","assassin","imp","artist"]});
    let result: Value = serde_json::from_str(&crate::custom_other_night_plan_json(
        &json!({"customDefinition":draft}).to_string(),
    ))
    .unwrap();
    assert_eq!(result["ok"], true, "{result}");
    let plan = result["value"]["plan"].as_array().unwrap();
    let at = |id: &str| plan.iter().position(|a| a["actionId"] == id).unwrap();
    assert!(at("resolveNightDeaths") > at("killPlayer"));
    let mut explicit = draft;
    let mut reordered = plan.clone();
    let resolution = reordered.remove(at("resolveNightDeaths"));
    let before_assassin = reordered
        .iter()
        .position(|a| a["actionId"] == "killPlayer")
        .unwrap();
    reordered.insert(before_assassin, resolution);
    explicit["otherNightOrder"] = json!(reordered);
    let result: Value = serde_json::from_str(&crate::custom_other_night_plan_json(
        &json!({"customDefinition":explicit}).to_string(),
    ))
    .unwrap();
    assert_eq!(result["value"]["plan"], json!(reordered));
}

#[test]
fn acquired_grandmother_runs_immediately_with_its_own_relation() {
    let mut g = configured_game(
        &[
            "philosopher",
            "grandmother",
            "soldier",
            "artist",
            "savant",
            "assassin",
            "imp",
        ],
        None,
        "nightwatchman",
    );
    for _ in 0..5 {
        let s = replay(&g);
        if s["currentStep"]["character"] == "philosopher" {
            break;
        }
        let input = if s["currentStep"]["actionRef"]["actionId"] == "demonInfo" {
            json!({"characterIds":s["currentStep"]["requiredInput"]["allowedCharacterIds"].as_array().unwrap()[..3]})
        } else {
            Value::Null
        };
        confirm(&mut g, input);
    }
    confirm(&mut g, json!({"characterIds":["grandmother"]}));
    let s = replay(&g);
    assert_eq!(s["currentStep"]["character"], "grandmother");
    assert_eq!(s["currentStep"]["abilityUse"]["ownerPlayerId"], "p1");
    let event = confirm(&mut g, json!({"playerIds":["p3"]}));
    assert_eq!(event["payload"]["result"]["targetPlayerId"], "p3");
    assert_eq!(replay(&g)["players"][0]["actualCharacter"], "philosopher");
}
#[test]
fn boffin_fool_blocks_execution_without_changing_the_demons_identity() {
    let mut g = configured_game(
        &[
            "artist",
            "soldier",
            "mayor",
            "savant",
            "ravenkeeper",
            "boffin",
            "imp",
        ],
        Some("fool"),
        "nightwatchman",
    );
    first_night(&mut g);
    for _ in 0..3 {
        day(&mut g, json!({"kind":"advance"}));
    }
    day(
        &mut g,
        json!({"kind":"nominate","nominatorId":"p1","nomineeId":"p7"}),
    );
    day(
        &mut g,
        json!({"kind":"vote","voterIds":["p1","p2","p3","p4"]}),
    );
    day(&mut g, json!({"kind":"closeNominations"}));
    day(&mut g, json!({"kind":"confirmExecution"}));
    let s = replay(&g);
    assert!(alive(&g, "p7"));
    assert_eq!(
        s["day"]["execution"]["prevention"]["source"]["characterId"],
        "fool"
    );
    assert_eq!(s["players"][6]["actualCharacter"], "imp");
    assert!(s["gameEnd"].is_null());
}
#[test]
fn suppression_disables_assassin_and_vigormortis_retains_its_unspent_dead_ability() {
    use crate::{characters::carousel::PreacherSelection, contracts::*, state::*};
    let (d, mut f) =
        super::issue207_impairments::facts(&["preacher", "assassin", "vigormortis", "fool"]);
    let entry = crate::characters::bad_moon_rising::registrations()
        .into_iter()
        .find(|e| e.spec.action_ref == FirstNightActionRef::character("assassin", "killPlayer"))
        .unwrap();
    let source = super::issue207_impairments::source(&f, 1);
    f.preacher_selections.push(PreacherSelection {
        source: super::issue207_impairments::source(&f, 0),
        source_identity: f.players[0].ability_instance.id.clone(),
        target: source.clone(),
        event_id: "preach".into(),
    });
    assert!(crate::effects::suppressed(&f, &source));
    assert!(!crate::effects::effective(&f, &source));
    f.preacher_selections.clear();
    let killer = ActionOccurrence::character(
        FirstNightActionRef::character("vigormortis", "attackPlayer"),
        super::issue207_impairments::source(&f, 2),
    )
    .unwrap();
    f.night_deaths.push(NightDeathRecord {
        event_id: "vigor-kill".into(),
        night: 1,
        player: f.players[1].clone(),
        source: killer,
        abilities: vec![source.clone()],
        effective_abilities: vec![source.clone()],
        guidance: vec![],
        impairments: vec![],
        resolved_impairments: vec![],
    });
    f.players[1].alive = false;
    let (result, _) = resolve_bmr(&d, &f, "assassin", json!({"playerIds":["p4"]}), vec![]);
    assert!(
        matches!(result,CustomActionResult::AssassinUsed {spent:true,deaths,..} if deaths[0].died)
    );
    f.ability_uses.push(AbilityUseRecord {
        source_event_id: "spent".into(),
        ability_use: source,
    });
    let rules = crate::rules::CustomRuleService::new(&d, &f);
    assert!(entry
        .handler
        .project(
            &entry.spec,
            &crate::first_night::ActionContext {
                event_id: "spent",
                rule_service: &rules
            }
        )
        .unwrap()
        .is_empty());
}
#[test]
fn assassin_is_immediate_while_pit_hag_deaths_remain_pending() {
    use crate::{contracts::*, state::*};
    let (d, mut f) = super::issue207_impairments::facts(&["assassin", "fool", "pitHag", "imp"]);
    let occurrence = ActionOccurrence::character(
        FirstNightActionRef::character("pitHag", "changeCharacter"),
        super::issue207_impairments::source(&f, 2),
    )
    .unwrap();
    f.confirmed_actions.push(ConfirmedActionFact {
        event_id: "created-demon".into(),
        occurrence,
        result: CustomActionResult::PitHagChange {
            target_player_id: "p4".into(),
            character_id: "imp".into(),
            changed: true,
            created_demon: true,
        },
        registration_judgments: vec![],
    });
    assert_eq!(crate::night_deaths::pending_sources(&f).len(), 1);
    let (_, changes) = resolve_bmr(&d, &f, "assassin", json!({"playerIds":["p2"]}), vec![]);
    assert_eq!(changes.life_changes()[0].player_id, "p2");
    assert!(changes.resolved_deaths().outcomes[0].prevention.is_none());
    assert_eq!(crate::night_deaths::pending_sources(&f).len(), 1);
}
#[test]
fn mathematician_evidence_distinguishes_failed_death_from_a_correct_poisoned_guess() {
    use crate::{contracts::*, state::*};
    let (d, mut f) = super::issue207_impairments::facts(&["gambler", "fool", "poisoner", "imp"]);
    f.poisoner_choices.push(TargetAssignment {
        source_event_id: "poison".into(),
        ability_use: super::issue207_impairments::source(&f, 2),
        target_player_id: "p1".into(),
        day: 1,
        initially_effective: true,
        effective: true,
    });
    crate::effects::resolve_effects(&d, &mut f).unwrap();
    let (_, wrong) = resolve_bmr(
        &d,
        &f,
        "gambler",
        json!({"playerIds":["p1"],"characterIds":["imp"]}),
        vec![],
    );
    assert!(matches!(
        wrong.audit()[0].outcome,
        MalfunctionOutcome::EffectFailure {
            effect: FailedEffect::GamblerDeath
        }
    ));
    let (_, right) = resolve_bmr(
        &d,
        &f,
        "gambler",
        json!({"playerIds":["p1"],"characterIds":["gambler"]}),
        vec![],
    );
    assert!(right.audit().is_empty());
    f.poisoner_choices[0].target_player_id = "p2".into();
    crate::effects::resolve_effects(&d, &mut f).unwrap();
    let attempt = crate::death::Attempt {
        player_id: "p2",
        execution: false,
        unpreventable: false,
    };
    let outcome = crate::death::decide(
        &f,
        crate::death::Attempt {
            player_id: "p2",
            execution: false,
            unpreventable: false,
        },
    );
    assert!(outcome.died);
    assert!(matches!(
        crate::death::audit(&f, None, &attempt, &outcome, "failed-protection")[0].outcome,
        MalfunctionOutcome::EffectFailure {
            effect: FailedEffect::FoolProtection
        }
    ));
    assert!(crate::death::audit(
        &f,
        None,
        &crate::death::Attempt {
            player_id: "p2",
            execution: false,
            unpreventable: true
        },
        &outcome,
        "assassin"
    )
    .is_empty());
}

#[test]
fn preacher_suppressed_assassin_does_not_enter_the_public_night_queue() {
    let mut g = configured_game(
        &[
            "preacher", "soldier", "fool", "mayor", "artist", "assassin", "imp",
        ],
        None,
        "nightwatchman",
    );
    first_night(&mut g);
    begin_night(&mut g);
    assert_eq!(replay(&g)["currentStep"]["character"], "preacher");
    confirm(&mut g, json!({"playerIds":["p6"]}));
    confirm(&mut g, json!({"playerIds":["p2"]}));
    assert_eq!(replay(&g)["currentStep"]["actionRef"]["actionId"], "dawn");
}

#[test]
fn grandmother_chain_uses_her_current_health_and_original_ability_source() {
    use crate::{contracts::*, state::*};
    let (d, mut f) =
        super::issue207_impairments::facts(&["grandmother", "artist", "poisoner", "imp"]);
    let (result, _) = resolve_bmr(&d, &f, "grandmother", json!({"playerIds":["p2"]}), vec![]);
    let source = super::issue207_impairments::source(&f, 0);
    let relation = ActionOccurrence::character(
        FirstNightActionRef::character("grandmother", "learnGrandchild"),
        source,
    )
    .unwrap();
    f.confirmed_actions.push(ConfirmedActionFact {
        event_id: "relation".into(),
        occurrence: relation,
        result,
        registration_judgments: vec![],
    });
    let killer = ActionOccurrence::character(
        FirstNightActionRef::character("imp", "attackPlayer"),
        super::issue207_impairments::source(&f, 3),
    )
    .unwrap();
    assert_eq!(
        crate::death::night(&f, &killer, &["p2".into()], false).deaths(),
        vec!["p2", "p1"]
    );
    poison(&mut f, "p1");
    assert_eq!(
        crate::death::night(&f, &killer, &["p2".into()], false).deaths(),
        vec!["p2"]
    );
    f.active_impairments.clear();
    poison(&mut f, "p2");
    assert_eq!(
        crate::death::night(&f, &killer, &["p2".into()], false).deaths(),
        vec!["p2", "p1"]
    );
    f.players[0].ability_instance.id = crate::model::AbilityInstanceId::new("new-identity", "p1");
    assert_eq!(
        crate::death::night(&f, &killer, &["p2".into()], false).deaths(),
        vec!["p2"]
    );
}
#[test]
fn advocate_execution_does_not_kill_saint_or_create_undertaker_information() {
    let mut g = configured_game(
        &[
            "saint",
            "undertaker",
            "artist",
            "fool",
            "mayor",
            "savant",
            "devilsAdvocate",
            "imp",
        ],
        None,
        "nightwatchman",
    );
    first_night(&mut g);
    execute(&mut g);
    assert!(alive(&g, "p1"));
    assert!(replay(&g)["gameEnd"].is_null());
    day(&mut g, json!({"kind":"beginNight"}));
    confirm(&mut g, json!({"playerIds":["p3"]}));
    confirm(&mut g, json!({"playerIds":["p4"]}));
    assert_eq!(replay(&g)["currentStep"]["actionRef"]["actionId"], "dawn");
}
#[test]
fn drunk_gambler_records_the_guess_without_a_real_death() {
    let mut g = configured_game(
        &[
            "drunk", "soldier", "fool", "mayor", "artist", "savant", "assassin", "imp",
        ],
        None,
        "gambler",
    );
    first_night(&mut g);
    begin_night(&mut g);
    let event = confirm(&mut g, json!({"playerIds":["p1"],"characterIds":["imp"]}));
    assert_eq!(event["payload"]["result"]["kind"], "simulation");
    assert!(alive(&g, "p1"));
    assert!(!event["payload"]["simulationSource"].is_null());
}

#[test]
fn grandmother_relation_stays_good_when_poisoned_but_delivery_can_be_false() {
    let (d, mut f) =
        super::issue207_impairments::facts(&["grandmother", "artist", "poisoner", "imp"]);
    poison(&mut f, "p1");
    let entry = crate::characters::bad_moon_rising::registrations()
        .into_iter()
        .find(|e| {
            e.spec.action_ref
                == crate::contracts::FirstNightActionRef::character(
                    "grandmother",
                    "learnGrandchild",
                )
        })
        .unwrap();
    let rules = crate::rules::CustomRuleService::new(&d, &f);
    let c = crate::first_night::ActionContext {
        event_id: "poisoned-info",
        rule_service: &rules,
    };
    let step = entry.handler.project(&entry.spec, &c).unwrap().remove(0);
    assert_eq!(step.required_input.allowed_player_ids.unwrap(), vec!["p2"]);
    assert!(step.information_prompt.unwrap().target_checks[0]
        .choices
        .iter()
        .any(|choice| choice.result
            == crate::model::InformationResult::Character {
                character_id: "imp".into()
            }));
}

#[test]
fn drunk_gambler_failure_reuses_the_existing_mathematician_jinx() {
    let mut g = configured_game(
        &[
            "drunk",
            "soldier",
            "fool",
            "mayor",
            "mathematician",
            "artist",
            "assassin",
            "imp",
        ],
        None,
        "gambler",
    );
    first_night(&mut g);
    begin_night(&mut g);
    confirm(&mut g, json!({"playerIds":["p2"],"characterIds":["imp"]}));
    confirm(&mut g, json!({"playerIds":["p2"]}));
    confirm(&mut g, Value::Null);
    let s = replay(&g);
    assert_eq!(s["currentStep"]["character"], "mathematician");
    assert_eq!(
        s["currentStep"]["informationPrompt"]["computedResult"]["value"],
        1
    );
}


#[test]
fn protected_good_twin_execution_still_ends_the_game_and_undo_restores_it() {
    for roster in [
        vec!["fool", "soldier", "mayor", "artist", "savant", "evilTwin", "imp"],
        vec!["artist", "soldier", "mayor", "savant", "ravenkeeper", "slayer", "fool", "evilTwin", "devilsAdvocate", "imp"],
        vec!["artist", "soldier", "mayor", "fool", "savant", "evilTwin", "imp"],
    ] {
        let protected = roster[0] == "fool" || roster.contains(&"devilsAdvocate");
        let mut g = configured_game(&roster, None, "nightwatchman");
        first_night(&mut g);
        execute(&mut g);
        if !protected { day(&mut g, json!({"kind":"confirmDeath"})); }
        let state = replay(&g);
        assert_eq!(state["day"]["execution"]["died"], !protected);
        assert_eq!(alive(&g, "p1"), protected);
        assert_eq!(state["day"]["pendingGameEnd"]["reason"], "goodTwinExecuted");
        assert_eq!(state["day"]["pendingGameEnd"]["winningAlignment"], "evil");
        let restored: Value = serde_json::from_str(&g.to_string()).unwrap();
        assert_eq!(replay(&restored), state);
        g["game"]["events"].as_array_mut().unwrap().pop();
        assert!(replay(&g)["day"]["pendingGameEnd"].is_null());
        assert!(alive(&g, "p1"));
    }
}

#[test]
fn protected_good_twin_virgin_and_madness_executions_also_end_the_game() {
    for madness in [false, true] {
        let roster = if madness {
            vec!["fool", "soldier", "mayor", "artist", "savant", "slayer", "ravenkeeper", "evilTwin", "cerenovus", "imp"]
        } else {
            vec!["fool", "virgin", "mayor", "artist", "savant", "evilTwin", "imp"]
        };
        let mut g = configured_game(&roster, None, "nightwatchman");
        first_night(&mut g);
        if madness {
            let id = replay(&g)["day"]["madness"][0]["id"].clone();
            day(&mut g, json!({"kind":"checkMadness","assignmentId":id,"violation":true}));
            day(&mut g, json!({"kind":"executeMadness","assignmentId":id}));
        } else {
            for _ in 0..3 { day(&mut g, json!({"kind":"advance"})); }
            day(&mut g, json!({"kind":"nominate","nominatorId":"p1","nomineeId":"p2"}));
        }
        day(&mut g, json!({"kind":"confirmDeath"}));
        assert!(alive(&g, "p1"));
        assert_eq!(replay(&g)["day"]["execution"]["died"], false);
        assert_eq!(replay(&g)["day"]["pendingGameEnd"]["reason"], "goodTwinExecuted");
    }
}

#[test]
fn boffin_fool_imp_self_attack_projects_the_same_survival_as_confirmation() {
    let mut g = configured_game(
        &["artist", "soldier", "mayor", "savant", "ravenkeeper", "boffin", "imp"],
        Some("fool"), "nightwatchman",
    );
    first_night(&mut g);
    begin_night(&mut g);
    let before = g.clone();
    let successors = |g: &Value| replay(g)["currentStep"]["requiredInput"]["attackOptions"].as_array().unwrap().iter()
        .find(|v| v["targetPlayerId"] == "p7").unwrap()["successorPlayerIds"].clone();
    assert_eq!(successors(&g), json!([]));
    let event = confirm(&mut g, json!({"playerIds":["p7"]}));
    assert_eq!(event["payload"]["result"]["died"], false);
    assert!(alive(&g, "p7"));
    let mut undone = g.clone();
    undone["game"]["events"].as_array_mut().unwrap().pop();
    assert_eq!(replay(&undone), replay(&before));
    confirm(&mut g, Value::Null);
    begin_night(&mut g);
    assert_eq!(successors(&g), json!(["p6"]));
    confirm(&mut g, json!({"playerIds":["p7"],"successorPlayerId":"p6"}));
    assert!(!alive(&g, "p7"));
    assert_eq!(replay(&g)["players"][5]["actualCharacter"], "imp");
}

#[test]
fn grandmother_false_person_is_saved_independently_of_the_real_relationship() {
    use super::issue225_nights::{append, propose};
    let mut g = configured_game(
        &["grandmother", "artist", "soldier", "mayor", "mathematician", "poisoner", "imp"],
        None, "nightwatchman",
    );
    first_night_until(&mut g, Some("grandmother"));
    let before = g.clone();
    let command = json!({"type":"confirmStep","payload":{
        "stepId":replay(&g)["currentStep"]["id"],"input":{"playerIds":["p2"]},
        "deliveredResult":{"kind":"playerCharacter","playerId":"p7","characterId":"artist"}
    }});
    for bad in [
        json!({"kind":"playerCharacter","characterId":"artist"}),
        json!({"kind":"playerCharacter","playerId":"missing","characterId":"artist"}),
    ] {
        let mut invalid = command.clone(); invalid["payload"]["deliveredResult"] = bad;
        assert_eq!(propose(&g, invalid)["ok"], false);
    }
    let event = append(&mut g, command);
    let mut invalid = g.clone();
    invalid["game"]["events"].as_array_mut().unwrap().last_mut().unwrap()["payload"]["result"]["information"]["deliveredResult"]["playerId"] = json!("p6");
    assert_eq!(serde_json::from_str::<Value>(&crate::replay_json(&invalid.to_string())).unwrap()["ok"], false);
    let result = &event["payload"]["result"];
    assert_eq!(result["targetPlayerId"], "p2");
    assert_eq!(result["information"]["targetPlayerIds"], json!(["p7"]));
    assert_eq!(result["information"]["computedResult"], json!({"kind":"playerCharacter","playerId":"p2","characterId":"artist"}));
    let state = replay(&g);
    assert_eq!(state["currentStep"]["character"], "mathematician");
    assert_eq!(state["currentStep"]["informationPrompt"]["computedResult"]["value"], 1);
    let restored: Value = serde_json::from_str(&g.to_string()).unwrap();
    assert_eq!(replay(&restored), state);
    let mut undone = g.clone(); undone["game"]["events"].as_array_mut().unwrap().pop();
    assert_eq!(replay(&undone), replay(&before));
    first_night(&mut g);
    begin_night(&mut g);
    confirm(&mut g, json!({"playerIds":["p3"]})); // Restore Grandmother's ability.
    let event = confirm(&mut g, json!({"playerIds":["p2"]}));
    assert!(!alive(&g, "p1") && !alive(&g, "p2"));
    assert!(alive(&g, "p7"));
    assert_eq!(event["payload"]["result"]["targetPlayerId"], "p2");
}

#[test]
fn healthy_grandmother_rejects_a_false_person_and_keeps_the_legacy_result() {
    use super::issue225_nights::propose;
    let mut g = configured_game(&["grandmother", "artist", "soldier", "mayor", "fool", "assassin", "imp"], None, "nightwatchman");
    first_night_until(&mut g, Some("grandmother"));
    assert_eq!(propose(&g, json!({"type":"confirmStep","payload":{
        "stepId":replay(&g)["currentStep"]["id"],"input":{"playerIds":["p2"]},
        "deliveredResult":{"kind":"playerCharacter","playerId":"p7","characterId":"artist"}
    }}))["ok"], false);
    let event = confirm(&mut g, json!({"playerIds":["p2"]}));
    assert_eq!(event["payload"]["result"]["information"]["deliveredResult"], json!({"kind":"character","characterId":"artist"}));
}

#[test]
fn moonchild_current_night_impairment_keeps_death_provenance_through_replay() {
    for (poisoned_at_death, poisoned_tonight) in [(false, true), (true, false), (true, true)] {
        let mut g = configured_game(
            &["artist", "soldier", "fool", "slayer", "mayor", "moonchild", "recluse", "poisoner", "imp"],
            None,
            "nightwatchman",
        );
        first_night(&mut g);
        begin_night(&mut g);
        confirm(&mut g, json!({"playerIds":[if poisoned_at_death { "p6" } else { "p1" }]}));
        confirm(&mut g, json!({"playerIds":["p6"]}));
        finish_night(&mut g);
        day(&mut g, json!({"kind":"advance"}));
        let consequence = replay(&g)["day"]["consequences"][0].clone();
        day(&mut g, json!({"kind":"resolveConsequence","consequenceId":consequence["id"],"playerId":"p1"}));
        for _ in 0..2 {
            day(&mut g, json!({"kind":"advance"}));
        }
        day(&mut g, json!({"kind":"closeNominations"}));
        day(&mut g, json!({"kind":"confirmExecution"}));
        day(&mut g, json!({"kind":"beginNight"}));
        confirm(&mut g, json!({"playerIds":[if poisoned_tonight { "p6" } else { "p1" }]}));
        confirm(&mut g, json!({"playerIds":["p2"]})); // Healthy Soldier survives.
        let before = replay(&g);
        assert_eq!(before["currentStep"]["character"], "moonchild");
        let cause = before["currentStep"]["actionCause"].clone();
        assert_eq!(cause["kind"], "death");
        let event = confirm(&mut g, Value::Null);
        assert_eq!(event["payload"]["actionCause"], cause);
        assert_eq!(event["payload"]["result"]["effective"], !poisoned_tonight);
        assert_eq!(alive(&g, "p1"), poisoned_tonight);
        let after = replay(&g);
        assert_eq!(after["currentStep"]["actionRef"]["actionId"], "dawn");
        let restored: Value = serde_json::from_str(&g.to_string()).unwrap();
        assert_eq!(replay(&restored), after);
        g["game"]["events"].as_array_mut().unwrap().pop();
        assert_eq!(replay(&g), before);
    }
}

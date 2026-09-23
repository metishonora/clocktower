use super::issue207_acquisition::{confirm, replay};
use super::issue225_nights::{character, step};
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
fn check(g: &Value, ids: &[&str]) -> Value {
    replay(g)["currentStep"]["informationPrompt"]["targetChecks"]
        .as_array()
        .unwrap()
        .iter()
        .find(|c| {
            c["targetPlayerIds"]
                .as_array()
                .unwrap()
                .iter()
                .all(|id| ids.contains(&id.as_str().unwrap()))
        })
        .unwrap()
        .clone()
}
#[test]
fn preacher_suppresses_without_wake_or_math_abnormality_and_replays() {
    let mut g = game(&[
        "preacher",
        "chambermaid",
        "mathematician",
        "artist",
        "savant",
        "poisoner",
        "imp",
    ]);
    let before = g.clone();
    let event = confirm(&mut g, json!({"playerIds":["p6"]}));
    assert_eq!(
        event["payload"]["result"],
        json!({"kind":"preacherSelected","targetPlayerId":"p6","effective":true})
    );
    let state = replay(&g);
    let notification = state["pendingIdentityReveals"]
        .as_array()
        .unwrap()
        .iter()
        .find(|n| n["payload"]["kind"] == "preacherInformation")
        .unwrap();
    assert_eq!(notification["payload"].as_object().unwrap().len(), 2);
    team(&mut g);
    assert_eq!(replay(&g)["currentStep"]["character"], "chambermaid");
    assert_eq!(check(&g, &["p6", "p7"])["computedResult"]["value"], 0);
    assert_eq!(check(&g, &["p1", "p3"])["computedResult"]["value"], 2);
    step(
        &mut g,
        character("chambermaid", "learnCount"),
        json!({"playerIds":["p6","p7"]}),
        None,
    );
    assert_eq!(
        replay(&g)["currentStep"]["informationPrompt"]["computedResult"]["value"],
        0
    );
    let mut undo = g.clone();
    undo["game"]["events"]
        .as_array_mut()
        .unwrap()
        .truncate(before["game"]["events"].as_array().unwrap().len());
    assert_eq!(replay(&undo), replay(&before));
}
#[test]
fn preacher_marionette_jinx_keeps_simulated_wake_without_notification_or_token() {
    let mut g = game(&[
        "preacher",
        "chambermaid",
        "mathematician",
        "artist",
        "savant",
        "marionette",
        "imp",
    ]);
    confirm(&mut g, json!({"playerIds":["p6"]}));
    team(&mut g);
    assert_eq!(replay(&g)["currentStep"]["character"], "nightwatchman");
    assert!(replay(&g)["ruleState"]["automaticReminders"]
        .as_array()
        .is_none_or(|a| a.iter().all(|r| r["characterId"] != "preacher")));
    assert!(replay(&g)["pendingIdentityReveals"]
        .as_array()
        .is_none_or(|a| a
            .iter()
            .all(|r| r["payload"]["kind"] != "preacherInformation")));
    confirm(&mut g, Value::Null);
    assert_eq!(check(&g, &["p6", "p7"])["computedResult"]["value"], 1);
}
#[test]
fn chambermaid_counts_declined_poisoned_wake_not_notification_or_starting_team_info() {
    let mut g = game(&[
        "chambermaid",
        "nightwatchman",
        "mathematician",
        "artist",
        "savant",
        "poisoner",
        "imp",
    ]);
    confirm(&mut g, json!({"playerIds":["p2"]}));
    confirm(&mut g, Value::Null);
    assert_eq!(check(&g, &["p2", "p7"])["computedResult"]["value"], 1);
    assert_eq!(check(&g, &["p3", "p6"])["computedResult"]["value"], 2);
    let mut h = game(&[
        "chambermaid",
        "nightwatchman",
        "mathematician",
        "artist",
        "savant",
        "poisoner",
        "imp",
    ]);
    confirm(&mut h, json!({"playerIds":["p5"]}));
    confirm(&mut h, json!({"playerIds":["p4"]}));
    assert_eq!(check(&h, &["p4", "p7"])["computedResult"]["value"], 0);
}
#[test]
fn chambermaid_discretion_accepts_above_two_and_vortox_rejects_truth_and_forgery() {
    for demon in ["imp", "vortox"] {
        let mut g = game(&[
            "chambermaid",
            "nightwatchman",
            "mathematician",
            "artist",
            "savant",
            "poisoner",
            demon,
        ]);
        confirm(&mut g, json!({"playerIds":["p1"]}));
        confirm(&mut g, Value::Null);
        let state = replay(&g);
        let check = check(&g, &["p4", "p5"]);
        assert_eq!(check["computedResult"]["value"], 0);
        assert_eq!(check["numberConstraint"]["max"], 9_007_199_254_740_991u64);
        let command = json!({"type":"confirmStep","payload":{"stepId":state["currentStep"]["id"],"expectedEventCount":g["game"]["events"].as_array().unwrap().len(),"input":{"playerIds":["p4","p5"]},"deliveredResult":{"kind":"number","value":0}}});
        let proposal: Value =
            serde_json::from_str(&crate::propose_json(&g.to_string(), &command.to_string()))
                .unwrap();
        assert_eq!(proposal["ok"], demon != "vortox");
        step(
            &mut g,
            character("chambermaid", "learnCount"),
            json!({"playerIds":["p4","p5"]}),
            Some(json!({"kind":"number","value":7})),
        );
        let event = g["game"]["events"].as_array().unwrap().last().unwrap();
        assert_eq!(
            event["payload"]["result"]["information"]["deliveredResult"]["value"],
            7
        );
        let mut forged = g.clone();
        forged["game"]["events"]
            .as_array_mut()
            .unwrap()
            .last_mut()
            .unwrap()["payload"]["result"]["information"]["computedResult"]["value"] = json!(2);
        let bad: Value = serde_json::from_str(&crate::replay_json(&forged.to_string())).unwrap();
        assert_eq!(bad["ok"], false);
    }
}

use super::issue207_impairments::{facts, source};
use crate::{
    characters::carousel::{expire_preacher, PreacherSelection},
    contracts::{ActiveImpairment, ImpairmentExpiry, ImpairmentKind},
    effects::{effective, resolve_effects},
    model::AbilityInstanceId,
};
fn bind(f: &mut crate::state::CustomGameFacts) {
    f.preacher_selections.push(PreacherSelection {
        source: source(f, 0),
        source_identity: f.players[0].ability_instance.id.clone(),
        target: source(f, 1),
        event_id: "preached".into(),
    });
}
#[test]
fn preacher_effect_pauses_recovers_and_permanently_expires_on_either_character_change_or_death() {
    let (d, mut f) = facts(&["preacher", "poisoner", "imp"]);
    bind(&mut f);
    assert!(!effective(&f, &source(&f, 1)));
    f.active_impairments.push(ActiveImpairment {
        kind: ImpairmentKind::Poisoned,
        player_id: "p1".into(),
        source_event_id: "poison".into(),
        source_character_id: "poisoner".into(),
        expires: ImpairmentExpiry::Never,
    });
    assert!(effective(&f, &source(&f, 1)));
    assert!(crate::reminders::project(&f)
        .iter()
        .any(|t| t.character_id == "preacher" && t.inactive_reason.is_some()));
    f.active_impairments.clear();
    assert!(!effective(&f, &source(&f, 1)));
    for index in [0, 1] {
        let mut changed = f.clone();
        changed.players[index].ability_instance.id =
            AbilityInstanceId::new("changed", &changed.players[index].id);
        expire_preacher(&mut changed);
        assert!(changed.preacher_selections.is_empty());
    }
    f.players[0].alive = false;
    resolve_effects(&d, &mut f).unwrap();
    assert!(f.preacher_selections.is_empty());
    assert!(effective(&f, &source(&f, 1)));
}
#[test]
fn preacher_disables_spy_registration_and_boffin_source() {
    let (_, mut f) = facts(&["preacher", "spy", "imp"]);
    bind(&mut f);
    assert!(crate::characters::trouble_brewing::registration_source(&f, "p2").is_none());
    let (_, mut f) = facts(&["preacher", "boffin", "imp"]);
    bind(&mut f);
    assert!(!effective(&f, &source(&f, 1)));
    assert!(!crate::characters::carousel::may_acquire(
        &f,
        &source(&f, 1),
        "preacher"
    ));
    assert!(crate::characters::carousel::may_acquire(
        &f,
        &source(&f, 0),
        "preacher"
    ));
}
#[test]
fn chambermaid_not_woken_without_two_living_others() {
    let (d, mut f) = facts(&["chambermaid", "poisoner", "imp"]);
    f.players[1].alive = false;
    let service = crate::rules::CustomRuleService::new(&d, &f);
    let context = crate::first_night::ActionContext {
        rule_service: &service,
        event_id: "test",
    };
    let registration = crate::characters::bad_moon_rising::registrations().remove(0);
    assert!(registration
        .handler
        .project(&registration.spec, &context)
        .unwrap()
        .is_empty());
}

fn grant(
    f: &mut crate::state::CustomGameFacts,
    from: &crate::model::AbilityUseRef,
    owner: &str,
    character: &str,
    event: &str,
) -> crate::model::AbilityUseRef {
    crate::reducer::apply_ability_grant(
        f,
        event,
        &crate::event::AbilityGrantChange {
            owner_player_id: owner.into(),
            character_id: character.into(),
            source: from.clone(),
        },
    );
    f.ability_provenance.last().unwrap().ability_use.clone()
}

#[test]
fn boffin_preacher_ban_follows_philosopher_and_pixie_provenance_but_not_normal_acquisition() {
    use crate::characters::carousel::may_acquire;
    let (_, mut f) = facts(&["boffin", "philosopher", "pixie", "preacher", "imp"]);
    let boffin = source(&f, 0);
    for intermediary in ["philosopher", "pixie"] {
        let borrowed = grant(&mut f, &boffin, "p5", intermediary, intermediary);
        assert!(!may_acquire(&f, &borrowed, "preacher"));
        assert!(may_acquire(&f, &borrowed, "chambermaid"));
        let nested = grant(
            &mut f,
            &borrowed,
            "p5",
            "pixie",
            &format!("nested-{intermediary}"),
        );
        assert!(!may_acquire(&f, &nested, "preacher"));
    }
    assert!(may_acquire(&f, &source(&f, 1), "preacher"));
    assert!(may_acquire(&f, &source(&f, 2), "preacher"));
}

#[test]
fn chambermaid_forecasts_acquired_math_and_keeps_historical_wake_after_identity_change() {
    use crate::{
        contracts::{CustomActionResult, FirstNightActionRef},
        state::{ActionOccurrence, ConfirmedActionFact},
    };
    let (d, mut f) = facts(&[
        "chambermaid",
        "philosopher",
        "mathematician",
        "boffin",
        "imp",
    ]);
    let philo = source(&f, 1);
    grant(&mut f, &philo, "p2", "mathematician", "philo-math");
    let boffin = source(&f, 3);
    let borrowed = grant(&mut f, &boffin, "p5", "nightwatchman", "boffin-watch");
    f.confirmed_actions.push(ConfirmedActionFact {
        registration_judgments: vec![],
        event_id: "watch-declined".into(),
        occurrence: ActionOccurrence::character(
            FirstNightActionRef::character("nightwatchman", "choosePlayer"),
            borrowed,
        )
        .unwrap()
        .in_night(f.night_number()),
        result: CustomActionResult::Simulation {
            information: None,
            spent: false,
        },
    });
    f.players[4].actual_character = "artist".into();
    f.players[4].ability_instance.id = AbilityInstanceId::new("identity-change", "p5");
    f.players[4].ability_instance.character_id = "artist".into();
    let service = crate::rules::CustomRuleService::new(&d, &f);
    let c = crate::first_night::ActionContext {
        rule_service: &service,
        event_id: "chambermaid",
    };
    let r = crate::characters::bad_moon_rising::registrations().remove(0);
    let steps = r.handler.project(&r.spec, &c).unwrap();
    let check = steps[0]
        .information_prompt
        .as_ref()
        .unwrap()
        .target_checks
        .iter()
        .find(|c| c.target_player_ids == ["p2", "p5"])
        .unwrap();
    assert_eq!(
        check.computed_result,
        crate::model::InformationResult::Number { value: 2 }
    );
    assert!(check.wake_audit[0].evidence[0].forecast);
    assert_eq!(
        check.wake_audit[1].evidence[0].event_id.as_deref(),
        Some("watch-declined")
    );
    assert_eq!(
        check.wake_audit[1].evidence[0].character_id,
        "nightwatchman"
    );
}

#[test]
fn poisoned_preacher_does_not_suppress_or_notify_and_math_counts_failed_attempt() {
    let mut g = game(&[
        "preacher",
        "chambermaid",
        "mathematician",
        "artist",
        "savant",
        "poisoner",
        "imp",
    ]);
    let order = g["game"]["script"]["definition"]["firstNightOrder"]
        .as_array_mut()
        .unwrap();
    let index = order
        .iter()
        .position(|r| r["characterId"] == "poisoner")
        .unwrap();
    let poisoner = order.remove(index);
    let index = order
        .iter()
        .position(|r| r["characterId"] == "preacher")
        .unwrap();
    order.insert(index, poisoner);
    confirm(&mut g, json!({"playerIds":["p1"]}));
    let event = confirm(&mut g, json!({"playerIds":["p6"]}));
    assert_eq!(event["payload"]["result"]["effective"], false);
    assert!(replay(&g)["pendingIdentityReveals"]
        .as_array()
        .is_none_or(|r| r
            .iter()
            .all(|n| n["payload"]["kind"] != "preacherInformation")));
    team(&mut g);
    step(
        &mut g,
        character("chambermaid", "learnCount"),
        json!({"playerIds":["p1","p6"]}),
        None,
    );
    assert_eq!(
        replay(&g)["currentStep"]["informationPrompt"]["computedResult"]["value"],
        1
    );
}

use super::issue207_acquisition::{confirm, replay};
use super::issue237_carousel::configured_game;
use serde_json::{json, Value};

fn advance_to(game: &mut Value, character: Option<&str>, poison: &str) {
    for _ in 0..30 {
        let s = replay(game);
        if s["phase"] == "day" || character.is_some_and(|c| s["currentStep"]["character"] == c) {
            return;
        }
        let step = &s["currentStep"];
        let input = match step["actionRef"]["actionId"].as_str().unwrap() {
            "minionInfo" | "dawn" => Value::Null,
            "demonInfo" => {
                json!({"characterIds":step["requiredInput"]["allowedCharacterIds"].as_array().unwrap()[..3]})
            }
            "choosePoisonTarget" => json!({"playerIds":[poison]}),
            "grantAbility" => {
                json!({"playerIds":[step["requiredInput"]["allowedPlayerIds"][0]],"characterIds":["noble"]})
            }
            _ if step["requiredInput"]["optional"] == true => Value::Null,
            _ => panic!("Unhandled preparation: {step}"),
        };
        confirm(game, input);
    }
    panic!("Did not reach requested character");
}
fn ready(roster: &[&str], poison: &str) -> Value {
    let mut g = configured_game(
        roster,
        roster.contains(&"boffin").then_some("noble"),
        "noble",
    );
    advance_to(&mut g, Some("noble"), poison);
    assert_eq!(replay(&g)["currentStep"]["character"], "noble");
    g
}
fn propose(g: &Value, ids: Value, judgments: Value, delivered: Option<Value>) -> Value {
    let mut payload = json!({"stepId":replay(g)["currentStep"]["id"],"input":{"playerIds":ids},"registrationJudgments":judgments});
    if let Some(d) = delivered {
        payload["deliveredResult"] = d;
    }
    serde_json::from_str(&crate::propose_json(
        &g.to_string(),
        &json!({"type":"confirmStep","payload":payload}).to_string(),
    ))
    .unwrap()
}
fn append(g: &mut Value, p: &Value) {
    assert_eq!(p["ok"], true, "{p}");
    g["game"]["events"]
        .as_array_mut()
        .unwrap()
        .push(p["value"]["event"].clone());
    replay(g);
}
fn j(id: &str, alignment: &str) -> Value {
    json!([{"playerId":id,"registeredAs":alignment}])
}

#[test]
fn noble_validates_three_distinct_people_and_freezes_only_public_identities() {
    let g = ready(&["noble", "artist", "soldier", "poisoner", "imp"], "p2");
    for ids in [
        json!([]),
        json!(["p2", "p3"]),
        json!(["p2", "p2", "p4"]),
        json!(["p2", "p3", "missing"]),
        json!(["p1", "p2", "p3"]),
        json!(["p2", "p4", "p5"]),
    ] {
        assert_eq!(propose(&g, ids, json!([]), None)["ok"], false);
    }
    let p = propose(&g, json!(["p4", "p3", "p2"]), json!([]), None);
    assert_eq!(p["ok"], true, "{p}");
    assert_eq!(
        p["value"]["revealPayload"],
        json!({"kind":"nobleInformation","candidatePlayers":[{"playerId":"p2","seat":2,"name":"P2"},{"playerId":"p3","seat":3,"name":"P3"},{"playerId":"p4","seat":4,"name":"P4"}]})
    );
    assert_eq!(
        p["value"]["event"]["payload"]["result"]["information"]["deliveredResult"],
        json!({"kind":"playerGroup","playerIds":["p2","p3","p4"]})
    );
    assert_eq!(
        propose(
            &g,
            json!(["p2", "p3", "p4"]),
            json!([]),
            Some(json!({"kind":"playerGroup","playerIds":["p1","p3","p4"]}))
        )["ok"],
        false
    );
    assert_eq!(
        propose(&g, json!(["p2", "p3", "p4"]), j("p2", "evil"), None)["ok"],
        false
    );
}

#[test]
fn noble_registration_is_scoped_to_the_selected_set_and_saved_for_replay() {
    let g = ready(
        &[
            "noble", "recluse", "artist", "savant", "soldier", "mayor", "spy", "imp",
        ],
        "p1",
    );
    for (ids, judgments) in [
        (json!(["p2", "p3", "p4"]), j("p2", "evil")),
        (json!(["p3", "p7", "p8"]), j("p7", "good")),
    ] {
        assert_eq!(propose(&g, ids.clone(), json!([]), None)["ok"], false);
        let mut saved = g.clone();
        let p = propose(&saved, ids, judgments.clone(), None);
        append(&mut saved, &p);
        assert_eq!(
            saved["game"]["events"].as_array().unwrap().last().unwrap()["payload"]
                ["registrationJudgments"],
            judgments
        );
        let state = replay(&saved);
        assert_eq!(
            state["ruleState"]["automaticReminders"]
                .as_array()
                .unwrap()
                .iter()
                .filter(|t| t["characterId"] == "noble")
                .count(),
            3
        );
        let event = saved["game"]["events"]
            .as_array_mut()
            .unwrap()
            .last_mut()
            .unwrap();
        event["payload"]["registrationJudgments"] = json!([]);
        let invalid: Value = serde_json::from_str(&crate::replay_json(&saved.to_string())).unwrap();
        assert_eq!(invalid["ok"], false);
    }
    assert_eq!(
        propose(&g, json!(["p3", "p4", "p8"]), j("p2", "evil"), None)["ok"],
        false
    );
}

#[test]
fn noble_poison_drunk_and_vortox_preserve_their_distinct_information_constraints() {
    let poisoned = ready(&["noble", "artist", "soldier", "poisoner", "imp"], "p1");
    for ids in [
        json!(["p1", "p2", "p3"]),
        json!(["p2", "p3", "p4"]),
        json!(["p2", "p4", "p5"]),
    ] {
        assert_eq!(propose(&poisoned, ids, json!([]), None)["ok"], true);
    }
    for poison in ["p1", "p2"] {
        let vortox = ready(
            &["noble", "artist", "soldier", "poisoner", "vortox"],
            poison,
        );
        assert_eq!(
            propose(&vortox, json!(["p1", "p2", "p3"]), json!([]), None)["ok"],
            true
        );
        assert_eq!(
            propose(&vortox, json!(["p2", "p4", "p5"]), json!([]), None)["ok"],
            true
        );
        assert_eq!(
            propose(&vortox, json!(["p2", "p3", "p4"]), json!([]), None)["ok"],
            false
        );
    }
    let drunk = ready(
        &["drunk", "artist", "soldier", "mayor", "poisoner", "imp"],
        "p2",
    );
    let p = propose(&drunk, json!(["p1", "p2", "p3"]), json!([]), None);
    assert_eq!(p["ok"], true, "{p}");
    assert_eq!(
        p["value"]["event"]["payload"]["result"]["kind"],
        "simulation"
    );
    let marionette = ready(
        &["artist", "soldier", "mayor", "marionette", "vortox"],
        "p2",
    );
    assert_eq!(
        propose(&marionette, json!(["p1", "p2", "p5"]), json!([]), None)["ok"],
        true,
        "Marionette is not a Townsfolk observer"
    );
}

#[test]
fn noble_vortox_uses_actual_alignment_and_ignores_registration() {
    let g = ready(
        &[
            "noble", "recluse", "artist", "savant", "soldier", "mayor", "spy", "vortox",
        ],
        "p1",
    );
    assert_eq!(
        propose(&g, json!(["p2", "p3", "p8"]), j("p2", "evil"), None)["ok"],
        false
    );
    assert_eq!(
        propose(&g, json!(["p3", "p7", "p8"]), j("p7", "good"), None)["ok"],
        false
    );
    assert_eq!(
        propose(&g, json!(["p3", "p7", "p8"]), json!([]), None)["ok"],
        true
    );
}

#[test]
fn noble_completion_undo_and_future_nights_keep_one_information_per_ability() {
    let mut g = ready(&["noble", "artist", "soldier", "poisoner", "imp"], "p2");
    let before = g.clone();
    let p = propose(&g, json!(["p2", "p3", "p4"]), json!([]), None);
    append(&mut g, &p);
    assert_ne!(replay(&g)["currentStep"]["character"], "noble");
    let saved: Value = serde_json::from_str(&crate::confirmed_event_reveal_json(
        &g.to_string(),
        p["value"]["event"]["id"].as_str().unwrap(),
    ))
    .unwrap();
    assert_eq!(saved["ok"], true);
    assert_eq!(saved["value"], p["value"]["revealPayload"]);
    g["game"]["events"].as_array_mut().unwrap().pop();
    assert_eq!(g, before);
    assert_eq!(replay(&g)["currentStep"]["character"], "noble");
    append(&mut g, &p);
    advance_to(&mut g, None, "p2");
    super::issue225_nights::begin_night(&mut g);
    let state = replay(&g);
    assert!(!state["phaseOverview"]
        .as_array()
        .unwrap()
        .iter()
        .any(|s| s["character"] == "noble"));
}

#[test]
fn noble_acquisition_is_immediate_for_philosopher_boffin_and_midgame_creation() {
    let mut g = configured_game(
        &["philosopher", "artist", "soldier", "poisoner", "imp"],
        None,
        "noble",
    );
    advance_to(&mut g, Some("philosopher"), "p2");
    confirm(&mut g, json!({"characterIds":["noble"]}));
    assert_eq!(replay(&g)["currentStep"]["character"], "noble");
    let p = propose(&g, json!(["p2", "p3", "p4"]), json!([]), None);
    append(&mut g, &p);
    assert_eq!(
        p["value"]["event"]["payload"]["abilityUse"]["characterId"],
        "noble"
    );
    let b = ready(&["artist", "soldier", "mayor", "boffin", "imp"], "p1");
    assert_eq!(replay(&b)["currentStep"]["playerId"], "p5");
    assert_eq!(
        propose(&b, json!(["p1", "p2", "p5"]), json!([]), None)["ok"],
        true
    );
    let mut h = configured_game(
        &["artist", "soldier", "mayor", "pitHag", "imp"],
        None,
        "noble",
    );
    advance_to(&mut h, None, "p1");
    super::issue225_nights::begin_night(&mut h);
    super::issue225_nights::step(
        &mut h,
        super::issue225_nights::character("pitHag", "changeCharacter"),
        json!({"playerIds":["p2"],"characterIds":["noble"]}),
        None,
    );
    assert_eq!(replay(&h)["currentStep"]["character"], "noble");
    assert_eq!(
        propose(&h, json!(["p1", "p2", "p5"]), json!([]), None)["ok"],
        true
    );
}

#[test]
fn noble_acquired_by_pixie_during_day_runs_once_next_night_and_survives_replay_undo() {
    use super::issue225_nights::{begin_night, character, day, step, system};

    let mut g = configured_game(
        &["noble", "pixie", "soldier", "poisoner", "imp"],
        None,
        "noble",
    );
    advance_to(&mut g, Some("pixie"), "p3");
    confirm(&mut g, json!({"playerIds":["p1"]}));
    advance_to(&mut g, Some("noble"), "p3");
    let original = propose(&g, json!(["p2", "p3", "p4"]), json!([]), None);
    append(&mut g, &original);
    advance_to(&mut g, None, "p3");

    let assignment = replay(&g)["day"]["madness"][0]["id"].clone();
    day(
        &mut g,
        json!({"kind":"checkMadness","assignmentId":assignment,"violation":false}),
    );
    for _ in 0..3 {
        day(&mut g, json!({"kind":"advance"}));
    }
    for input in [
        json!({"kind":"nominate","nominatorId":"p2","nomineeId":"p1"}),
        json!({"kind":"vote","voterIds":["p1","p2","p3"]}),
        json!({"kind":"closeNominations"}),
        json!({"kind":"confirmExecution"}),
        json!({"kind":"confirmDeath"}),
        json!({"kind":"beginNight"}),
    ] {
        day(&mut g, input);
    }

    let pending = replay(&g);
    assert_eq!(pending["nightNumber"], 2);
    assert_eq!(pending["currentStep"]["character"], "noble");
    assert_eq!(pending["currentStep"]["playerId"], "p2");
    let source = pending["currentStep"]["abilityUse"].clone();
    assert_eq!(source["ownerPlayerId"], "p2");
    assert_eq!(source["characterId"], "noble");
    g = serde_json::from_str(&g.to_string()).unwrap();
    assert_eq!(replay(&g), pending);

    let p = propose(&g, json!(["p1", "p3", "p4"]), json!([]), None);
    append(&mut g, &p);
    assert_eq!(p["value"]["event"]["payload"]["abilityUse"], source);
    assert_eq!(replay(&g)["currentStep"]["character"], "poisoner");
    let history: Value = serde_json::from_str(&crate::confirmed_event_reveal_json(
        &g.to_string(),
        p["value"]["event"]["id"].as_str().unwrap(),
    ))
    .unwrap();
    assert_eq!(history["ok"], true, "{history}");
    assert_eq!(history["value"], p["value"]["revealPayload"]);

    g["game"]["events"].as_array_mut().unwrap().pop();
    assert_eq!(replay(&g), pending);
    append(&mut g, &p);
    step(
        &mut g,
        character("poisoner", "choosePoisonTarget"),
        json!({"playerIds":["p3"]}),
        None,
    );
    step(
        &mut g,
        character("imp", "attackPlayer"),
        json!({"playerIds":["p4"]}),
        None,
    );
    step(&mut g, system("dawn"), Value::Null, None);
    begin_night(&mut g);
    let third_night = replay(&g);
    assert_eq!(third_night["nightNumber"], 3);
    assert!(!third_night["phaseOverview"]
        .as_array()
        .unwrap()
        .iter()
        .any(|s| s["character"] == "noble"));
    assert_eq!(
        g["game"]["events"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|e| e["payload"]["actionRef"]["characterId"] == "noble"
                && e["payload"]["abilityUse"] == source)
            .count(),
        1
    );
}

//! Production JSON paths. Expectations are independent of handler internals.
use super::issue207_acquisition::replay;
use super::issue207_information::{number, proposal, take};
use serde_json::{json, Value};
pub(super) fn seed(id: &str) -> Value {
    let seeds: Value = serde_json::from_str(include_str!(
        "../../../../fixtures/acceptance/custom-first-night/issue208/scenarios.json"
    ))
    .unwrap();
    seeds
        .as_array()
        .unwrap()
        .iter()
        .find(|s| s["id"] == id)
        .unwrap()
        .clone()
}
pub(super) fn start(seed: &Value) -> Value {
    let mut game = json!({"schemaVersion":4,"game":{"id":"208","name":"208","script":{"type":"custom","definition":seed["definition"]},"createdAt":"t","updatedAt":"t","events":[]}});
    let result: Value = serde_json::from_str(&crate::propose_json(
        &game.to_string(),
        &json!({"type":"createGame","payload":seed["setupInput"]}).to_string(),
    ))
    .unwrap();
    assert_eq!(result["ok"], true, "{result}");
    game["game"]["events"]
        .as_array_mut()
        .unwrap()
        .push(result["value"]["event"].clone());
    game
}
pub(super) fn system(game: &mut Value) {
    take(game, "minionInfo", Value::Null, None, vec![]);
    take(
        game,
        "demonInfo",
        json!({"characterIds":["artist","savant","juggler"]}),
        None,
        vec![],
    );
}
#[test]
fn drunk_empath_jinx_counts_only_incorrect_delivery_and_survives_reload_undo() {
    for (delivered, count) in [(0, 1), (2, 0)] {
        let mut game = start(&seed("drunk-empath-math"));
        system(&mut game);
        take(
            &mut game,
            "poisoner",
            json!({"playerIds":["monk"]}),
            None,
            vec![],
        );
        assert_eq!(
            replay(&game)["currentStep"]["simulationSource"]["sourceAbilityUse"]["characterId"],
            "drunk"
        );
        let before = game.clone();
        take(&mut game, "empath", Value::Null, number(delivered), vec![]);
        let after = replay(&game);
        assert_eq!(
            after["currentStep"]["informationPrompt"]["computedResult"]["value"],
            count
        );
        assert!(after["ruleState"]["abilityGrants"]
            .as_array()
            .is_none_or(|g| g.is_empty()));
        let loaded: Value = serde_json::from_str(&game.to_string()).unwrap();
        assert_eq!(replay(&loaded), after);
        game["game"]["events"].as_array_mut().unwrap().pop();
        assert_eq!(replay(&game), replay(&before));
    }
}
#[test]
fn chef_uses_independent_recluse_edge_judgments_and_rejects_nonadjacent_scope() {
    let mut game = start(&seed("chef-recluse-edge"));
    system(&mut game);
    take(
        &mut game,
        "poisoner",
        json!({"playerIds":["monk"]}),
        None,
        vec![],
    );
    let state = replay(&game);
    let choices = state["currentStep"]["informationPrompt"]["numberChoices"]
        .as_array()
        .unwrap();
    let choice = choices.iter().find(|c| c["value"] == 1).unwrap();
    let judgments = choice["registrationJudgments"].as_array().unwrap().clone();
    assert!(judgments
        .iter()
        .any(|j| j["scope"]["kind"] == "adjacentPair"));
    let mut bad = judgments.clone();
    bad[0]["scope"]["playerIds"] = json!(["chef", "imp"]);
    assert_eq!(proposal(&game, Value::Null, number(1), bad)["ok"], false);
    let delivery = take(&mut game, "chef", Value::Null, number(1), judgments);
    assert_eq!(delivery["revealPayload"]["value"], 1);
}
#[test]
fn no_dashii_does_not_skip_protected_soldier_and_poisoner_adds_its_own_poison() {
    let mut game = start(&seed("soldier-no-dashii"));
    system(&mut game);
    take(
        &mut game,
        "poisoner",
        json!({"playerIds":["empath"]}),
        None,
        vec![],
    );
    let state = replay(&game);
    let effects = state["ruleState"]["activeImpairments"].as_array().unwrap();
    assert!(!effects.iter().any(|e| e["playerId"] == "soldier"));
    assert!(effects
        .iter()
        .any(|e| e["playerId"] == "monk" && e["sourceCharacterId"] == "noDashii"));
    assert!(effects
        .iter()
        .any(|e| e["playerId"] == "empath" && e["sourceCharacterId"] == "poisoner"));
}
pub(super) fn roster_game(roster: &[(&str, Option<&str>)]) -> Value {
    let mut seed = seed("drunk-empath-math");
    seed["setupInput"]["players"]=json!(roster.iter().enumerate().map(|(i,(actual,shown))|{let mut p=json!({"id":format!("p{}",i+1),"seat":i+1,"name":format!("P{}",i+1),"actualCharacter":actual});if let Some(shown)=shown{p["shownCharacter"]=json!(shown);}p}).collect::<Vec<_>>());
    start(&seed)
}
#[test]
fn acquired_drunk_keeps_real_philosopher_spent_and_separate_guidance_choice() {
    let mut game = roster_game(&[
        ("philosopher", None),
        ("mathematician", None),
        ("monk", None),
        ("virgin", None),
        ("slayer", None),
        ("scarletWoman", None),
        ("imp", None),
    ]);
    system(&mut game);
    take(
        &mut game,
        "philosopher",
        json!({"characterIds":["drunk"]}),
        None,
        vec![],
    );
    let before = replay(&game);
    assert_eq!(
        before["currentStep"]["actionRef"]["actionId"],
        "assignShownCharacter"
    );
    take(
        &mut game,
        "assignShownCharacter",
        json!({"characterIds":["philosopher"]}),
        None,
        vec![],
    );
    let guidance = replay(&game);
    assert_eq!(guidance["currentStep"]["character"], "philosopher");
    assert!(guidance["currentStep"]["abilityUse"].is_null());
    take(
        &mut game,
        "philosopher",
        json!({"characterIds":["chef"]}),
        None,
        vec![],
    );
    assert_eq!(replay(&game)["currentStep"]["character"], "chef");
    take(&mut game, "chef", Value::Null, number(1), vec![]);
    let state = replay(&game);
    assert_eq!(state["players"][0]["actualCharacter"], "philosopher");
    assert_eq!(state["players"][0]["shownCharacter"], "philosopher");
    assert_eq!(
        state["ruleState"]["abilityUses"].as_array().unwrap().len(),
        1
    );
    assert_eq!(
        state["ruleState"]["abilityGrants"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
    assert_eq!(
        state["ruleState"]["abilityGrants"][0]["characterId"],
        "drunk"
    );
}
#[test]
fn acquired_starting_information_prepares_then_runs_before_resuming_order() {
    let mut game = roster_game(&[
        ("philosopher", None),
        ("mathematician", None),
        ("monk", None),
        ("virgin", None),
        ("slayer", None),
        ("scarletWoman", None),
        ("imp", None),
    ]);
    system(&mut game);
    take(
        &mut game,
        "philosopher",
        json!({"characterIds":["washerwoman"]}),
        None,
        vec![],
    );
    take(
        &mut game,
        "prepareInformation",
        json!({"playerIds":["p1","p3"],"characterId":"monk","correctPlayerId":"p3"}),
        None,
        vec![],
    );
    let delivered = take(&mut game, "learnTownsfolk", Value::Null, None, vec![]);
    assert!(delivered["event"]["payload"]["result"]["preparationEventId"].is_string());
    assert_eq!(delivered["revealPayload"]["revealedCharacterId"], "monk");
    assert_eq!(replay(&game)["currentStep"]["character"], "mathematician");
}
#[test]
fn separate_fortune_teller_sources_can_share_red_herring_and_normal_yes_is_not_failure() {
    let mut game = roster_game(&[
        ("philosopher", None),
        ("fortuneTeller", None),
        ("mathematician", None),
        ("monk", None),
        ("virgin", None),
        ("scarletWoman", None),
        ("imp", None),
    ]);
    take(
        &mut game,
        "assignRedHerring",
        json!({"playerIds":["p4"]}),
        None,
        vec![],
    );
    system(&mut game);
    take(
        &mut game,
        "philosopher",
        json!({"characterIds":["fortuneTeller"]}),
        None,
        vec![],
    );
    take(
        &mut game,
        "assignRedHerring",
        json!({"playerIds":["p4"]}),
        None,
        vec![],
    );
    let state = replay(&game);
    assert_eq!(
        state["ruleState"]["preparations"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|p| p["result"]["kind"] == "redHerringAssigned")
            .count(),
        2
    );
    // Native comes before acquired; its Phantom Philosopher drunkenness allows this truthful result.
    take(
        &mut game,
        "checkDemon",
        json!({"playerIds":["p2","p4"]}),
        Some(json!({"kind":"boolean","value":true})),
        vec![],
    );
    let healthy = take(
        &mut game,
        "checkDemon",
        json!({"playerIds":["p1","p4"]}),
        None,
        vec![],
    );
    assert_eq!(healthy["revealPayload"]["hasDemon"], true);
    assert_eq!(
        replay(&game)["currentStep"]["informationPrompt"]["computedResult"]["value"],
        0
    );
}
#[test]
fn librarian_zero_counts_actual_drunk_as_outsider_and_vortox_requires_false_proposition() {
    let mut normal = roster_game(&[
        ("librarian", None),
        ("mathematician", None),
        ("monk", None),
        ("virgin", None),
        ("slayer", None),
        ("scarletWoman", None),
        ("imp", None),
    ]);
    take(
        &mut normal,
        "prepareInformation",
        json!({"zeroOutsiders":true}),
        None,
        vec![],
    );
    system(&mut normal);
    let zero = take(&mut normal, "learnOutsider", Value::Null, None, vec![]);
    assert_eq!(zero["revealPayload"]["zeroOutsiders"], true);
    let mut vortox = roster_game(&[
        ("librarian", None),
        ("mathematician", None),
        ("monk", None),
        ("virgin", None),
        ("slayer", None),
        ("drunk", Some("soldier")),
        ("scarletWoman", None),
        ("vortox", None),
    ]);
    // True 'one of these is Drunk' is forbidden by Vortox, despite being an allowed outsider identity.
    assert_eq!(
        proposal(
            &vortox,
            json!({"playerIds":["p1","p6"],"characterId":"drunk","correctPlayerId":"p6"}),
            None,
            vec![]
        )["ok"],
        false
    );
    take(
        &mut vortox,
        "prepareInformation",
        json!({"zeroOutsiders":true}),
        None,
        vec![],
    );
    system(&mut vortox);
    take(&mut vortox, "learnOutsider", Value::Null, None, vec![]);
    assert_eq!(
        replay(&vortox)["currentStep"]["informationPrompt"]["computedResult"]["value"],
        1
    );
}
#[test]
fn recovery_requires_repreparation_and_preserves_earlier_spy_snapshot() {
    let mut input = seed("drunk-empath-math");
    let roster = [
        "washerwoman",
        "noDashii",
        "chef",
        "mathematician",
        "snakeCharmer",
        "monk",
        "virgin",
        "slayer",
        "poisoner",
        "spy",
    ];
    input["setupInput"]["players"]=json!(roster.iter().enumerate().map(|(i,c)|json!({"id":format!("p{}",i+1),"seat":i+1,"name":format!("P{}",i+1),"actualCharacter":c})).collect::<Vec<_>>());
    let order = input["definition"]["firstNightOrder"]
        .as_array_mut()
        .unwrap();
    let index = order
        .iter()
        .position(|a| a["characterId"] == "spy")
        .unwrap();
    let spy = order.remove(index);
    order.insert(3, spy);
    let mut game = start(&input);
    take(
        &mut game,
        "prepareInformation",
        json!({"playerIds":["p7","p8"],"characterId":"monk","correctPlayerId":"p7"}),
        None,
        vec![],
    );
    system(&mut game);
    let spy = take(&mut game, "inspectGrimoire", Value::Null, None, vec![]);
    let snapshot = spy["event"]["payload"]["result"].clone();
    take(
        &mut game,
        "choosePoisonTarget",
        json!({"playerIds":["p8"]}),
        None,
        vec![],
    );
    take(
        &mut game,
        "choosePlayer",
        json!({"playerIds":["p2"]}),
        None,
        vec![],
    );
    let pending = replay(&game);
    assert_eq!(
        pending["currentStep"]["actionRef"]["actionId"],
        "prepareInformation"
    );
    assert_eq!(
        pending["currentStep"]["actionCause"]["kind"],
        "requiredPreparation"
    );
    assert_eq!(
        proposal(
            &game,
            json!({"playerIds":["p7","p8"],"characterId":"monk","correctPlayerId":"p7"}),
            None,
            vec![]
        )["ok"],
        false
    );
    take(
        &mut game,
        "prepareInformation",
        json!({"playerIds":["p1","p4"],"characterId":"mathematician","correctPlayerId":"p4"}),
        None,
        vec![],
    );
    let learned = take(&mut game, "learnTownsfolk", Value::Null, None, vec![]);
    assert_eq!(
        learned["revealPayload"]["revealedCharacterId"],
        "mathematician"
    );
    let saved = game["game"]["events"]
        .as_array()
        .unwrap()
        .iter()
        .find(|e| e["id"] == spy["event"]["id"])
        .unwrap();
    assert_eq!(saved["payload"]["result"], snapshot);
}

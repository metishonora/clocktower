//! Character-policy contracts. These do not replace public command/replay acceptance.
use super::issue207_acquisition::{confirm, replay};
use crate::{
    characters::carousel::forced_voter_ids,
    contracts::{ActiveImpairment, ImpairmentExpiry, ImpairmentKind},
    model::{AbilityInstanceId, Alignment},
    state::CustomGameFacts,
};
use serde_json::{json, Value};

fn carousel_game(roster: &[&str]) -> Value {
    configured_game(
        roster,
        roster.contains(&"boffin").then_some("nightwatchman"),
        "nightwatchman",
    )
}
pub(super) fn configured_game(roster: &[&str], boffin_ability: Option<&str>, shown: &str) -> Value {
    let mut pool = vec![
        "nightwatchman",
        "zealot",
        "philosopher",
        "poisoner",
        "imp",
        "vortox",
        "soldier",
        "mayor",
        "saint",
    ];
    for role in roster
        .iter()
        .copied()
        .chain(boffin_ability)
        .chain(std::iter::once(shown))
    {
        if !pool.contains(&role) {
            pool.push(role);
        }
    }
    let mut definition = json!({"id":"carousel237","name":"Carousel", "characterIds":pool});
    for (field, query) in [
        (
            "firstNightOrder",
            crate::custom_first_night_plan_json as fn(&str) -> String,
        ),
        ("otherNightOrder", crate::custom_other_night_plan_json),
    ] {
        let result: Value =
            serde_json::from_str(&query(&json!({"customDefinition":definition}).to_string()))
                .unwrap();
        assert_eq!(result["ok"], true, "{result}");
        definition[field] = result["value"]["plan"].clone();
    }
    let mut game = json!({"schemaVersion":5,"game":{"id":"carousel237","name":"Carousel","script":{"type":"custom","definition":definition},"createdAt":"2026-09-19T00:00:00Z","updatedAt":"2026-09-19T00:00:00Z","events":[]}});
    let players = roster.iter().enumerate().map(|(i,c)| {
        let mut player=json!({"id":format!("p{}",i+1),"seat":i+1,"name":format!("P{}",i+1),"actualCharacter":c});
        if ["drunk","marionette"].contains(c) { player["shownCharacter"]=json!(shown); }
        player
    }).collect::<Vec<_>>();
    let result: Value = serde_json::from_str(&crate::propose_json(
        &game.to_string(),
        &json!({"type":"createGame","payload":{"players":players,"boffinAbility":boffin_ability}})
            .to_string(),
    ))
    .unwrap();
    assert_eq!(result["ok"], true, "{result}");
    game["game"]["events"]
        .as_array_mut()
        .unwrap()
        .push(result["value"]["event"].clone());
    let checked: Value = serde_json::from_str(&crate::replay_json(&game.to_string())).unwrap();
    assert_eq!(checked["ok"], true, "{checked}\n{game}");
    game
}

fn review_first_night(game: &mut Value, poison_target: Option<&str>) {
    for _ in 0..30 {
        let state = replay(game);
        if state["phase"] == "day" {
            return;
        }
        let step = &state["currentStep"];
        let input = match step["actionRef"]["actionId"].as_str().unwrap() {
            "grantAbility" => {
                json!({"playerIds":[step["requiredInput"]["allowedPlayerIds"][0]],"characterIds":[step["requiredInput"]["allowedCharacterIds"][0]]})
            }
            "minionInfo" | "dawn" => Value::Null,
            "demonInfo" => {
                json!({"characterIds":step["requiredInput"]["allowedCharacterIds"].as_array().unwrap()[..3]})
            }
            "choosePoisonTarget" => json!({"playerIds":[poison_target.unwrap()]}),
            _ if step["requiredInput"]["optional"] == true => Value::Null,
            _ if step["requiredInput"]["kind"] == "none" => Value::Null,
            _ => panic!("Unexpected first-night action: {step}"),
        };
        let delivered = (step["requiredInput"]["kind"] == "none")
            .then(|| step["informationPrompt"]["computedResult"].clone())
            .filter(|v| !v.is_null());
        super::issue225_nights::step(game, step["actionRef"].clone(), input, delivered);
    }
    panic!("First night did not finish");
}
fn review_execute(game: &mut Value, target: &str) {
    use super::issue225_nights::day;
    for _ in 0..3 {
        day(game, json!({"kind":"advance"}));
    }
    day(
        game,
        json!({"kind":"nominate","nominatorId":"p1","nomineeId":target}),
    );
    let voters = replay(game)["players"]
        .as_array()
        .unwrap()
        .iter()
        .map(|p| p["id"].clone())
        .collect::<Vec<_>>();
    day(game, json!({"kind":"vote","voterIds":voters}));
    day(game, json!({"kind":"closeNominations"}));
    day(game, json!({"kind":"confirmExecution"}));
    day(game, json!({"kind":"confirmDeath"}));
}
fn review_day_proposal(game: &Value, input: Value) -> Value {
    super::issue225_nights::propose(
        game,
        json!({"type":"confirmDay","payload":{
            "stepId":replay(game)["day"]["stepId"],
            "expectedEventCount":game["game"]["events"].as_array().unwrap().len(),"input":input
        }}),
    )
}

#[test]
fn boffin_review_team_victories_use_the_ability_owners_alignment() {
    use super::issue225_nights::{begin_night, day};
    let roster = ["savant", "artist", "soldier", "boffin", "imp"];
    let mut saint = configured_game(&roster, Some("saint"), "nightwatchman");
    review_first_night(&mut saint, None);
    review_execute(&mut saint, "p5");
    assert_eq!(
        replay(&saint)["day"]["pendingGameEnd"]["winningAlignment"],
        "good"
    );
    assert_eq!(
        replay(&saint)["day"]["pendingGameEnd"]["reason"],
        "saintExecuted"
    );

    let mut mayor = configured_game(&roster, Some("mayor"), "nightwatchman");
    review_first_night(&mut mayor, None);
    for target in ["p1", "p2"] {
        begin_night(&mut mayor);
        confirm(&mut mayor, json!({"playerIds":[target]}));
        confirm(&mut mayor, Value::Null);
    }
    for _ in 0..3 {
        day(&mut mayor, json!({"kind":"advance"}));
    }
    day(&mut mayor, json!({"kind":"closeNominations"}));
    let before = mayor.clone();
    day(&mut mayor, json!({"kind":"confirmExecution"}));
    assert_eq!(
        replay(&mayor)["day"]["pendingGameEnd"]["winningAlignment"],
        "evil"
    );
    assert_eq!(
        replay(&mayor)["day"]["pendingGameEnd"]["reason"],
        "mayorNoExecution"
    );
    let restored: Value = serde_json::from_str(&mayor.to_string()).unwrap();
    assert_eq!(replay(&restored), replay(&mayor));
    mayor["game"]["events"].as_array_mut().unwrap().pop();
    assert_eq!(replay(&mayor), replay(&before));
}

#[test]
fn boffin_review_day_information_checks_grant_availability_and_ability_impairment() {
    let roster = [
        "savant",
        "seamstress",
        "soldier",
        "mayor",
        "virgin",
        "sage",
        "oracle",
        "boffin",
        "poisoner",
        "imp",
    ];
    for role in ["artist", "empath"] {
        for target in ["p8", "p10"] {
            let mut game = configured_game(&roster, Some(role), "nightwatchman");
            review_first_night(&mut game, Some(target));
            if role == "empath" {
                let deliveries = game["game"]["events"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .filter(|e| e["payload"]["abilityUse"]["characterId"] == "empath")
                    .collect::<Vec<_>>();
                assert_eq!(deliveries.len(), if target == "p8" { 0 } else { 1 });
                if target == "p10" {
                    assert!(!deliveries[0]["payload"]["result"]
                        .to_string()
                        .contains("poisoned"));
                }
                continue;
            }
            let state = replay(&game);
            let actions = state["day"]["availableActions"].as_array().unwrap();
            let action = actions.iter().find(|a| a["actorPlayerId"] == "p10");
            if target == "p8" {
                assert!(action.is_none());
                continue;
            }
            let action = action.unwrap();
            assert_eq!(action["effective"], true);
            assert_eq!(action["impaired"], false);
            for truthful in [true, false] {
                let proposal = review_day_proposal(
                    &game,
                    json!({"kind":"useAbility","actionId":action["id"],"record":{
                        "kind":"artist","question":"질문","answer":"yes","truthful":truthful
                    }}),
                );
                assert_eq!(proposal["ok"], truthful, "{proposal}");
            }
        }
    }
}

#[test]
fn boffin_review_day_grant_recovers_without_spending_its_use() {
    use super::issue225_nights::{begin_night, day};
    let roster = [
        "savant",
        "seamstress",
        "soldier",
        "mayor",
        "virgin",
        "sage",
        "oracle",
        "boffin",
        "poisoner",
        "imp",
    ];
    let mut game = configured_game(&roster, Some("artist"), "nightwatchman");
    review_first_night(&mut game, Some("p8"));
    assert!(!replay(&game)["day"]["availableActions"]
        .as_array()
        .unwrap()
        .iter()
        .any(|a| a["actorPlayerId"] == "p10"));
    begin_night(&mut game);
    confirm(&mut game, json!({"playerIds":["p9"]}));
    confirm(&mut game, json!({"playerIds":["p2"]}));
    review_first_night(&mut game, None);
    let state = replay(&game);
    let action = state["day"]["availableActions"]
        .as_array()
        .unwrap()
        .iter()
        .find(|a| a["actorPlayerId"] == "p10")
        .unwrap();
    assert_eq!(action["effective"], true);
    day(
        &mut game,
        json!({"kind":"useAbility","actionId":action["id"],"record":{"kind":"artist","question":"질문","answer":"yes","truthful":true}}),
    );
    assert!(!replay(&game)["day"]["availableActions"]
        .as_array()
        .unwrap()
        .iter()
        .any(|a| a["actorPlayerId"] == "p10"));
}

#[test]
fn boffin_review_disabled_death_grants_do_not_apply_effects() {
    let roster = [
        "savant",
        "artist",
        "soldier",
        "mayor",
        "virgin",
        "sage",
        "oracle",
        "seamstress",
        "mathematician",
        "boffin",
        "poisoner",
        "scarletWoman",
        "imp",
    ];
    for role in ["sweetheart", "barber", "klutz"] {
        for target in ["p10", "p13"] {
            let mut game = configured_game(&roster, Some(role), "nightwatchman");
            review_first_night(&mut game, Some(target));
            review_execute(&mut game, "p13");
            let state = replay(&game);
            assert_eq!(state["players"][11]["actualCharacter"], "imp");
            let consequences = state["day"]["consequences"].as_array().unwrap();
            assert_eq!(
                consequences.len(),
                if target == "p10" { 0 } else { 1 },
                "{state}"
            );
            if target == "p13" {
                assert_eq!(consequences[0]["impairedAtDeath"], false);
            }
            let restored: Value = serde_json::from_str(&game.to_string()).unwrap();
            assert_eq!(replay(&restored), state);
        }
    }
}

#[test]
fn marionette_review_day_information_is_not_forced_false_by_vortox() {
    let roster = ["soldier", "mayor", "virgin", "marionette", "vortox"];
    for role in ["artist", "savant"] {
        let mut game = configured_game(&roster, None, role);
        review_first_night(&mut game, None);
        let state = replay(&game);
        let action = state["day"]["availableActions"]
            .as_array()
            .unwrap()
            .iter()
            .find(|a| a["actorPlayerId"] == "p4")
            .unwrap();
        assert_eq!(action["vortox"], false);
        for truthful in [true, false] {
            let record = if role == "artist" {
                json!({"kind":"artist","question":"질문","answer":"yes","truthful":truthful})
            } else {
                json!({"kind":"savant","statements":[{"text":"하나","truthful":truthful},{"text":"둘","truthful":truthful}]})
            };
            let proposal = review_day_proposal(
                &game,
                json!({"kind":"useAbility","actionId":action["id"],"record":record}),
            );
            assert_eq!(proposal["ok"], true, "{proposal}");
        }
    }
}

#[test]
fn marionette_starts_hidden_and_never_receives_minion_information() {
    let mut game = carousel_game(&["savant", "artist", "soldier", "marionette", "vortox"]);
    assert_eq!(
        replay(&game)["currentStep"]["actionRef"]["actionId"],
        "demonInfo"
    );
    let p = super::issue207_acquisition::propose(
        &game,
        json!({"characterIds":["nightwatchman","mayor","saint"]}),
    );
    assert_eq!(p["value"]["revealPayload"]["minionPlayers"], json!([]));
    assert_eq!(
        p["value"]["revealPayload"]["marionettePlayers"],
        json!([{"seat":4,"name":"P4"}])
    );
    confirm(
        &mut game,
        json!({"characterIds":["nightwatchman","mayor","saint"]}),
    );
    let s = replay(&game);
    assert_eq!(s["players"][3]["actualCharacter"], "marionette");
    assert_eq!(s["players"][3]["alignment"], "evil");
    assert_eq!(s["currentStep"]["character"], "nightwatchman");
    assert_eq!(
        s["currentStep"]["simulationSource"]["guidance"]["kind"],
        "marionette"
    );
    confirm(&mut game, json!({"playerIds":["p1"]}));
    assert!(replay(&game)["pendingIdentityReveals"]
        .as_array()
        .is_none_or(Vec::is_empty));
    let mut invalid = game.clone();
    invalid["game"]["events"][0]["payload"]["players"][3]["seat"] = json!(2);
    invalid["game"]["events"][0]["payload"]["players"][1]["seat"] = json!(4);
    assert_eq!(super::issue225_nights::result(&invalid)["ok"], false);
}

#[test]
fn marionette_setup_reports_adjacency_separately_from_invalid_seat_numbers() {
    let mut game = carousel_game(&["soldier", "savant", "artist", "marionette", "imp"]);
    let players = game["game"]["events"][0]["payload"]["players"].clone();
    game["game"]["events"] = json!([]);
    let propose = |players: Value| -> Value {
        serde_json::from_str(&crate::propose_json(
            &game.to_string(),
            &json!({"type":"createGame","payload":{"players":players}}).to_string(),
        ))
        .unwrap()
    };
    let mut non_neighbor = players.clone();
    non_neighbor[3]["seat"] = json!(2);
    non_neighbor[1]["seat"] = json!(4);
    let result = propose(non_neighbor);
    assert_eq!(result["ok"], false);
    assert_eq!(result["error"]["code"], "INVALID_MARIONETTE_SEATING");
    assert_eq!(
        result["error"]["messageKo"],
        "꼭두각시는 악마의 양옆 중 한 자리에 배치해야 합니다."
    );
    assert_eq!(propose(players.clone())["ok"], true);
    let mut wraparound = players.clone();
    wraparound[3]["seat"] = json!(1);
    wraparound[0]["seat"] = json!(4);
    assert_eq!(propose(wraparound)["ok"], true);
    let mut duplicate = players;
    duplicate[0]["seat"] = json!(2);
    assert_eq!(propose(duplicate)["error"]["code"], "INVALID_SEATING");
}

#[test]
fn issue237_marionette_balloonist_setup() {
    let game = carousel_game(&["balloonist", "savant", "artist", "marionette", "imp"]);
    for delta in [0, 1] {
        let r:Value=serde_json::from_str(&crate::setup_distribution_json(&json!({"customDefinition":game["game"]["script"]["definition"],"playerCount":5,"actualCharacters":["marionette","imp"],"marionetteCharacter":"balloonist","setupChoiceId":format!("balloonist:{delta}")}).to_string())).unwrap();
        assert_eq!(r["ok"], true, "{r}");
        assert_eq!(r["value"]["Outsider"], delta);
    }
}

#[test]
fn issue237_marionette_mathematician() {
    let mut game = carousel_game(&["mathematician", "savant", "artist", "marionette", "imp"]);
    confirm(
        &mut game,
        json!({"characterIds":["nightwatchman","mayor","saint"]}),
    );
    confirm(&mut game, json!({"playerIds":["p1"]}));
    let s = replay(&game);
    assert_eq!(s["currentStep"]["character"], "mathematician");
    assert_eq!(
        s["currentStep"]["informationPrompt"]["computedResult"]["value"],
        1
    );
    assert!(s["ruleState"]["abilityGrants"]
        .as_array()
        .is_none_or(Vec::is_empty));
    assert!(s["ruleState"]["guidance"][0]["spent"].as_bool().unwrap());
    assert!(s["pendingIdentityReveals"]
        .as_array()
        .is_none_or(Vec::is_empty));
    let tokens = s["ruleState"]["automaticReminders"].as_array().unwrap();
    assert!(!tokens.iter().any(|t| t["characterId"] == "nightwatchman"));
    assert!(tokens.iter().any(|t| t["characterId"] == "marionette"));
    assert!(tokens
        .iter()
        .any(|t| t["characterId"] == "mathematician" && t["tokenId"] == "abnormal"));
}

#[test]
fn pit_hag_marionette_reveals_apparent_identity_then_informs_demon() {
    use super::issue225_nights::begin_night;
    let mut game = carousel_game(&["savant", "artist", "soldier", "pitHag", "imp"]);
    // Add an unused character to both valid authored pools without an ordered action.
    game["game"]["script"]["definition"]["characterIds"]
        .as_array_mut()
        .unwrap()
        .push(json!("marionette"));
    confirm(&mut game, Value::Null);
    confirm(
        &mut game,
        json!({"characterIds":["nightwatchman","mayor","saint"]}),
    );
    confirm(&mut game, Value::Null);
    begin_night(&mut game);
    confirm(
        &mut game,
        json!({"playerIds":["p2"],"characterIds":["marionette"]}),
    );
    let before = replay(&game);
    assert_eq!(before["currentStep"]["character"], "marionette");
    assert!(before["pendingIdentityReveals"]
        .as_array()
        .is_none_or(Vec::is_empty));
    confirm(&mut game, json!({"characterIds":["nightwatchman"]}));
    let s = replay(&game);
    let rs = s["pendingIdentityReveals"].as_array().unwrap();
    assert_eq!(rs.len(), 2);
    assert_eq!(rs[0]["payload"]["kind"], "characterChange");
    assert_eq!(rs[0]["payload"]["characterId"], "nightwatchman");
    assert_eq!(rs[1]["payload"]["kind"], "marionetteInformation");
    assert_eq!(rs[1]["payload"]["recipientPlayer"]["playerId"], "p5");
    assert_eq!(s["players"][1]["actualCharacter"], "marionette");
    assert_eq!(s["players"][1]["alignment"], "good");
    game["game"]["events"].as_array_mut().unwrap().pop();
    assert_eq!(replay(&game)["currentStep"]["character"], "marionette");
}

#[test]
fn boffin_assigns_a_new_demon_without_preserving_the_former_demons_grant() {
    let mut game = carousel_game(&["snakeCharmer", "savant", "artist", "boffin", "imp"]);
    confirm(
        &mut game,
        json!({"playerIds":["p5"],"characterIds":["nightwatchman"]}),
    );
    confirm(&mut game, Value::Null);
    confirm(
        &mut game,
        json!({"characterIds":["nightwatchman","mayor","saint"]}),
    );
    assert_eq!(replay(&game)["currentStep"]["character"], "snakeCharmer");
    let before_swap = game.clone();
    confirm(&mut game, json!({"playerIds":["p5"]}));
    let s = replay(&game);
    assert_eq!(s["currentStep"]["character"], "boffin");
    assert_eq!(
        s["currentStep"]["requiredInput"]["allowedPlayerIds"],
        json!(["p1"])
    );
    // History keeps grant provenance; it no longer confers an action on the former Demon.
    assert!(s["ruleState"]["abilityGrants"]
        .as_array()
        .is_none_or(Vec::is_empty));
    assert!(!s["phaseOverview"]
        .as_array()
        .unwrap()
        .iter()
        .any(|x| x["step"]["character"] == "nightwatchman" && x["step"]["playerId"] == "p5"));
    let before = game.clone();
    confirm(
        &mut game,
        json!({"playerIds":["p1"],"characterIds":["nightwatchman"]}),
    );
    let s = replay(&game);
    assert_eq!(s["ruleState"]["abilityGrants"].as_array().unwrap().len(), 1);
    assert!(s["ruleState"]["abilityGrants"]
        .as_array()
        .unwrap()
        .iter()
        .any(|g| g["ownerPlayerId"] == "p1" && g["characterId"] == "nightwatchman"));
    assert_eq!(s["players"][0]["actualCharacter"], "imp");
    assert_eq!(s["currentStep"]["character"], "nightwatchman");
    assert_eq!(s["currentStep"]["playerId"], "p1");
    assert_eq!(replay(&before)["currentStep"]["character"], "boffin");
    // Replaying/undoing to the original identity restores the original grant.
    assert_eq!(
        replay(&before_swap)["ruleState"]["abilityGrants"][0]["ownerPlayerId"],
        "p5"
    );
}

fn pixie_game(vortox: bool) -> Value {
    let mut game = carousel_game(&[
        "pixie",
        "savant",
        "artist",
        "poisoner",
        if vortox { "vortox" } else { "imp" },
    ]);
    loop {
        let step = replay(&game)["currentStep"].clone();
        match step["actionRef"]["actionId"].as_str().unwrap() {
            "minionInfo" => {
                confirm(&mut game, Value::Null);
            }
            "demonInfo" => {
                confirm(
                    &mut game,
                    json!({"characterIds":["soldier","mayor","saint"]}),
                );
            }
            "choosePoisonTarget" => {
                confirm(&mut game, json!({"playerIds":["p4"]}));
            }
            "learnTownsfolk" => break,
            other => panic!("unexpected {other}"),
        }
    }
    game
}

#[test]
fn issue237_boffin_excludes_drunk_and_preserves_the_demons_identity() {
    let mut game = carousel_game(&["savant", "artist", "soldier", "boffin", "imp"]);
    let s = replay(&game);
    assert_eq!(s["currentStep"]["character"], "boffin");
    assert_eq!(
        s["currentStep"]["requiredInput"]["allowedCharacterIds"],
        json!(["nightwatchman"])
    );
    assert_eq!(s["players"][4]["actualCharacter"], "imp");
    assert_eq!(
        s["ruleState"]["abilityGrants"][0]["characterId"],
        "nightwatchman"
    );
    confirm(
        &mut game,
        json!({"playerIds":["p5"],"characterIds":["nightwatchman"]}),
    );
    let notices = replay(&game)["pendingIdentityReveals"].clone();
    assert_eq!(notices.as_array().unwrap().len(), 2);
    assert_eq!(notices[0]["payload"]["recipientPlayer"]["playerId"], "p4");
    assert_eq!(notices[1]["payload"]["recipientPlayer"]["playerId"], "p5");
    assert_eq!(notices[0]["payload"]["recipientIsSource"], true);
    assert_eq!(notices[1]["payload"]["recipientIsSource"], false);
    assert_ne!(notices[0]["sequence"], notices[1]["sequence"]);
    confirm(&mut game, Value::Null);
    confirm(
        &mut game,
        json!({"characterIds":["nightwatchman","mayor","saint"]}),
    );
    assert_eq!(replay(&game)["currentStep"]["character"], "nightwatchman");
    confirm(&mut game, json!({"playerIds":["p1"]}));
    assert_eq!(replay(&game)["players"][4]["actualCharacter"], "imp");
    let mut bad = game.clone();
    bad["game"]["events"][0]["payload"]["boffinAbility"] = json!("soldier");
    assert_eq!(super::issue225_nights::result(&bad)["ok"], false);
    let d = crate::characters::resolve_custom_script_ids(
        &["boffin", "drunk", "nightwatchman", "imp"].map(str::to_owned),
    )
    .unwrap();
    assert_eq!(
        crate::characters::carousel::boffin_choices(&d, &["boffin".into(), "imp".into()]).unwrap(),
        vec!["nightwatchman"]
    );
}

#[test]
fn boffin_impairment_suspends_grant_but_demon_poison_does_not() {
    use super::issue225_nights::begin_night;
    for target in ["p8", "p10"] {
        let mut game = carousel_game(&[
            "savant", "artist", "soldier", "mayor", "virgin", "sage", "oracle", "boffin",
            "poisoner", "imp",
        ]);
        confirm(
            &mut game,
            json!({"playerIds":["p10"],"characterIds":["nightwatchman"]}),
        );
        confirm(&mut game, Value::Null);
        confirm(
            &mut game,
            json!({"characterIds":["nightwatchman","saint","zealot"]}),
        );
        confirm(&mut game, json!({"playerIds":[target]}));
        let step = replay(&game)["currentStep"].clone();
        if target == "p10" {
            assert_eq!(step["character"], "nightwatchman");
            confirm(&mut game, json!({"playerIds":["p1"]}));
            assert!(replay(&game)["pendingIdentityReveals"]
                .as_array()
                .unwrap()
                .iter()
                .any(|r| r["payload"]["kind"] == "nightwatchmanInformation"));
        } else {
            assert_eq!(step["actionRef"]["actionId"], "dawn");
        }
        confirm(&mut game, Value::Null);
        begin_night(&mut game);
        confirm(&mut game, json!({"playerIds":["p9"]}));
        confirm(&mut game, json!({"playerIds":["p2"]}));
        // Oracle precedes Nightwatchman on other nights.
        confirm(&mut game, Value::Null);
        if target == "p8" {
            assert_eq!(replay(&game)["currentStep"]["character"], "nightwatchman");
        } else {
            assert_ne!(
                replay(&game)["currentStep"]["character"],
                "nightwatchman",
                "used ability must remain spent"
            );
        }
        assert_eq!(
            replay(&game)["ruleState"]["abilityGrants"]
                .as_array()
                .unwrap()
                .len(),
            1
        );
    }
}

#[test]
fn balloonist_tracks_each_sources_previous_information_and_allows_dead_players() {
    use super::issue225_nights::begin_night;
    for poisoned in [false, true] {
        let mut game = carousel_game(&["balloonist", "savant", "artist", "poisoner", "imp"]);
        confirm(&mut game, Value::Null);
        confirm(
            &mut game,
            json!({"characterIds":["soldier","mayor","saint"]}),
        );
        confirm(&mut game, json!({"playerIds":["p4"]}));
        let first =
            super::issue207_information::proposal(&game, json!({"playerIds":["p2"]}), None, vec![]);
        assert_eq!(first["ok"], true, "{first}");
        assert_eq!(
            first["value"]["revealPayload"],
            json!({"kind":"learnedPlayer","sourceCharacterId":"balloonist","player":{"playerId":"p2","seat":2,"name":"P2"}})
        );
        game["game"]["events"]
            .as_array_mut()
            .unwrap()
            .push(first["value"]["event"].clone());
        confirm(&mut game, Value::Null);
        begin_night(&mut game);
        confirm(
            &mut game,
            json!({"playerIds":[if poisoned {"p1"}else{"p4"}]}),
        );
        confirm(&mut game, json!({"playerIds":["p3"]}));
        let s = replay(&game);
        assert_eq!(s["currentStep"]["character"], "balloonist");
        let allowed = s["currentStep"]["requiredInput"]["allowedPlayerIds"]
            .as_array()
            .unwrap();
        assert_eq!(allowed.contains(&json!("p3")), poisoned);
        assert!(allowed.contains(&json!("p4")));
        let invalid =
            super::issue207_information::proposal(&game, json!({"playerIds":["p2"]}), None, vec![]);
        assert_eq!(invalid["ok"], poisoned, "{invalid}");
        confirm(
            &mut game,
            json!({"playerIds":[if poisoned {"p3"}else{"p4"}]}),
        );
        let s = replay(&game);
        let tokens = s["ruleState"]["automaticReminders"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|t| t["characterId"] == "balloonist")
            .collect::<Vec<_>>();
        assert_eq!(tokens.len(), 1);
        assert_eq!(tokens[0]["playerId"], if poisoned { "p3" } else { "p4" });
        game["game"]["events"].as_array_mut().unwrap().pop();
        assert_eq!(replay(&game)["currentStep"]["character"], "balloonist");
    }
}

#[test]
fn balloonist_setup_discretion_is_optional_validated_and_replayable() {
    let game = carousel_game(&["balloonist", "savant", "artist", "poisoner", "imp"]);
    let d = &game["game"]["script"]["definition"];
    for (choice, count) in [
        (Value::Null, 0),
        (json!("balloonist:0"), 0),
        (json!("balloonist:1"), 1),
    ] {
        let r:Value=serde_json::from_str(&crate::setup_distribution_json(&json!({"customDefinition":d,"playerCount":5,"actualCharacters":["balloonist","imp"],"setupChoiceId":choice}).to_string())).unwrap();
        assert_eq!(r["ok"], true, "{r}");
        assert_eq!(r["value"]["Outsider"], count);
    }
    let mut extra = game.clone();
    extra["game"]["events"] = json!([]);
    let players = json!([{"id":"p1","seat":1,"name":"A","actualCharacter":"balloonist"},{"id":"p2","seat":2,"name":"B","actualCharacter":"savant"},{"id":"p3","seat":3,"name":"C","actualCharacter":"zealot"},{"id":"p4","seat":4,"name":"D","actualCharacter":"poisoner"},{"id":"p5","seat":5,"name":"E","actualCharacter":"imp"}]);
    let p = super::issue225_nights::propose(
        &extra,
        json!({"type":"createGame","payload":{"players":players,"setupChoiceId":"balloonist:1"}}),
    );
    assert_eq!(p["ok"], true, "{p}");
    extra["game"]["events"]
        .as_array_mut()
        .unwrap()
        .push(p["value"]["event"].clone());
    replay(&extra);
    let mut wrong_count = extra.clone();
    wrong_count["game"]["events"][0]["payload"]["setupChoiceId"] = json!("balloonist:0");
    assert_eq!(super::issue225_nights::result(&wrong_count)["ok"], false);
    extra["game"]["events"][0]["payload"]["setupChoiceId"] = json!("balloonist:2");
    assert_eq!(super::issue225_nights::result(&extra)["ok"], false);
}
#[test]
fn pixie_public_information_is_private_and_acquisition_is_automatic_at_death() {
    use super::issue225_nights::day;
    for vortox in [false, true] {
        let mut game = pixie_game(vortox);
        let shown = if vortox { "nightwatchman" } else { "artist" };
        let proposal = super::issue207_information::proposal(
            &game,
            json!({"playerIds":["p3"]}),
            Some(json!({"kind":"character","characterId":shown})),
            vec![],
        );
        assert_eq!(proposal["ok"], true, "{proposal}");
        assert_eq!(
            proposal["value"]["revealPayload"],
            json!({"kind":"learnedCharacter","sourceCharacterId":"pixie","characterId":shown})
        );
        game["game"]["events"]
            .as_array_mut()
            .unwrap()
            .push(proposal["value"]["event"].clone());
        assert_eq!(replay(&game)["availableActions"][0]["character"], "pixie");
        confirm(&mut game, Value::Null); // dawn
        let assignment = replay(&game)["day"]["madness"][0]["id"].clone();
        day(
            &mut game,
            json!({"kind":"checkMadness","assignmentId":assignment,"violation":false}),
        );
        for _ in 0..3 {
            day(&mut game, json!({"kind":"advance"}));
        }
        day(
            &mut game,
            json!({"kind":"nominate","nominatorId":"p1","nomineeId":"p3"}),
        );
        day(
            &mut game,
            json!({"kind":"vote","voterIds":["p1","p2","p3"]}),
        );
        day(&mut game, json!({"kind":"closeNominations"}));
        day(&mut game, json!({"kind":"confirmExecution"}));
        day(&mut game, json!({"kind":"confirmDeath"}));
        let state = replay(&game);
        assert_eq!(state["ruleState"]["abilityGrants"][0]["characterId"], shown);
        assert_eq!(state["players"][0]["actualCharacter"], "pixie");
        assert!(state["day"]["madness"].as_array().unwrap().is_empty());
        assert!(state["pendingIdentityReveals"]
            .as_array()
            .is_none_or(Vec::is_empty));
        assert!(state["ruleState"]["automaticReminders"]
            .as_array()
            .unwrap()
            .iter()
            .any(|t| t["characterId"] == "pixie"
                && t["tokenId"] == "hasAbility"
                && t["playerId"] == "p3"));
        game["game"]["events"].as_array_mut().unwrap().pop();
        assert!(replay(&game)["ruleState"]["abilityGrants"]
            .as_array()
            .is_none_or(Vec::is_empty));
    }
}
fn until_watchman(game: &mut Value, poison_target: Option<&str>, acquire: bool) {
    loop {
        let step = replay(game)["currentStep"].clone();
        match step["actionRef"]["actionId"].as_str().unwrap() {
            "minionInfo" => {
                confirm(game, Value::Null);
            }
            "demonInfo" => {
                confirm(game, json!({"characterIds":["soldier","mayor","saint"]}));
            }
            "chooseAbility" => {
                confirm(
                    game,
                    if acquire {
                        json!({"characterIds":["nightwatchman"]})
                    } else {
                        Value::Null
                    },
                );
            }
            "choosePoisonTarget" => {
                confirm(game, json!({"playerIds":[poison_target.unwrap_or("p2")]}));
            }
            "compareAlignments" => {
                confirm(game, Value::Null);
            }
            "choosePlayer" => {
                assert_eq!(step["character"], "nightwatchman");
                break;
            }
            other => panic!("unexpected {other}"),
        }
    }
}

#[test]
fn pixie_failed_death_is_final_and_clears_both_action_and_reminder() {
    use super::issue225_nights::day;
    for sufficient in [None, Some(false), Some(true)] {
        let mut game = pixie_game(false);
        if sufficient == Some(true) {
            let events = game["game"]["events"].as_array_mut().unwrap();
            events.pop(); // replace Poisoner action with actual poisoning of Pixie
            confirm(&mut game, json!({"playerIds":["p1"]}));
        }
        let p = super::issue207_information::proposal(
            &game,
            json!({"playerIds":["p3"]}),
            Some(json!({"kind":"character","characterId":"artist"})),
            vec![],
        );
        assert_eq!(p["ok"], true, "{p}");
        game["game"]["events"]
            .as_array_mut()
            .unwrap()
            .push(p["value"]["event"].clone());
        confirm(&mut game, Value::Null);
        if let Some(sufficient) = sufficient {
            let id = replay(&game)["day"]["madness"][0]["id"].clone();
            day(
                &mut game,
                json!({"kind":"checkMadness","assignmentId":id,"violation":!sufficient}),
            );
        }
        for _ in 0..3 {
            day(&mut game, json!({"kind":"advance"}));
        }
        day(
            &mut game,
            json!({"kind":"nominate","nominatorId":"p1","nomineeId":"p3"}),
        );
        day(
            &mut game,
            json!({"kind":"vote","voterIds":["p1","p2","p3"]}),
        );
        day(&mut game, json!({"kind":"closeNominations"}));
        day(&mut game, json!({"kind":"confirmExecution"}));
        day(&mut game, json!({"kind":"confirmDeath"}));
        let s = replay(&game);
        assert!(s["ruleState"]["abilityGrants"]
            .as_array()
            .is_none_or(Vec::is_empty));
        assert!(s["day"]["madness"].as_array().unwrap().is_empty());
        assert!(!s["ruleState"]["automaticReminders"]
            .as_array()
            .unwrap()
            .iter()
            .any(|r| r["characterId"] == "pixie"));
        day(&mut game, json!({"kind":"beginNight"}));
        assert!(replay(&game)["ruleState"]["abilityGrants"]
            .as_array()
            .is_none_or(Vec::is_empty));
    }
}

#[test]
fn pixie_day_acquired_start_information_is_scheduled_once_next_night() {
    use super::issue225_nights::day;
    let mut game = pixie_game(true);
    // An out-of-play Clockmaker is learned under Vortox.
    let definition = &mut game["game"]["script"]["definition"];
    definition["characterIds"]
        .as_array_mut()
        .unwrap()
        .push(json!("clockmaker"));
    definition
        .as_object_mut()
        .unwrap()
        .remove("firstNightOrder");
    let plan: Value = serde_json::from_str(&crate::custom_first_night_plan_json(
        &json!({"customDefinition":definition}).to_string(),
    ))
    .unwrap();
    assert_eq!(plan["ok"], true);
    definition["firstNightOrder"] = plan["value"]["plan"].clone();
    let p = super::issue207_information::proposal(
        &game,
        json!({"playerIds":["p3"]}),
        Some(json!({"kind":"character","characterId":"clockmaker"})),
        vec![],
    );
    assert_eq!(p["ok"], true, "{p}");
    game["game"]["events"]
        .as_array_mut()
        .unwrap()
        .push(p["value"]["event"].clone());
    confirm(&mut game, Value::Null);
    let id = replay(&game)["day"]["madness"][0]["id"].clone();
    day(
        &mut game,
        json!({"kind":"checkMadness","assignmentId":id,"violation":false}),
    );
    for _ in 0..3 {
        day(&mut game, json!({"kind":"advance"}));
    }
    day(
        &mut game,
        json!({"kind":"nominate","nominatorId":"p1","nomineeId":"p3"}),
    );
    day(
        &mut game,
        json!({"kind":"vote","voterIds":["p1","p2","p3"]}),
    );
    day(&mut game, json!({"kind":"closeNominations"}));
    day(&mut game, json!({"kind":"confirmExecution"}));
    day(&mut game, json!({"kind":"confirmDeath"}));
    day(&mut game, json!({"kind":"beginNight"}));
    let state = replay(&game);
    assert_eq!(state["currentStep"]["character"], "clockmaker", "{state}");
    let p = super::issue207_information::proposal(
        &game,
        Value::Null,
        Some(json!({"kind":"number","value":0})),
        vec![],
    );
    assert_eq!(p["ok"], true, "{p}");
    game["game"]["events"]
        .as_array_mut()
        .unwrap()
        .push(p["value"]["event"].clone());
    assert_ne!(replay(&game)["currentStep"]["character"], "clockmaker");
}

#[test]
fn drunk_pixie_has_only_simulated_acquisition_and_never_an_actual_grant() {
    assert_simulated_pixie_acquisition(false);
}

#[test]
fn marionette_pixie_keeps_simulated_acquisition_without_ability_tokens() {
    assert_simulated_pixie_acquisition(true);
}

fn assert_simulated_pixie_acquisition(marionette: bool) {
    use super::issue225_nights::day;
    let mut game = if marionette {
        carousel_game(&["marionette", "savant", "artist", "soldier", "imp"])
    } else {
        carousel_game(&["drunk", "savant", "artist", "soldier", "poisoner", "imp"])
    };
    let d = &mut game["game"]["script"]["definition"];
    d["characterIds"]
        .as_array_mut()
        .unwrap()
        .push(json!("pixie"));
    d.as_object_mut().unwrap().remove("firstNightOrder");
    let p: Value = serde_json::from_str(&crate::custom_first_night_plan_json(
        &json!({"customDefinition":d}).to_string(),
    ))
    .unwrap();
    assert_eq!(p["ok"], true, "{p}");
    d["firstNightOrder"] = p["value"]["plan"].clone();
    game["game"]["events"][0]["payload"]["players"][0]["shownCharacter"] = json!("pixie");
    for _ in 0..5 {
        let step = replay(&game)["currentStep"].clone();
        match step["actionRef"]["actionId"].as_str().unwrap() {
            "minionInfo" => {
                confirm(&mut game, Value::Null);
            }
            "demonInfo" => {
                confirm(
                    &mut game,
                    json!({"characterIds":["mayor","saint","zealot"]}),
                );
            }
            "choosePoisonTarget" => {
                confirm(&mut game, json!({"playerIds":["p5"]}));
            }
            "learnTownsfolk" => break,
            other => panic!("unexpected {other}"),
        }
    }
    let p = super::issue207_information::proposal(
        &game,
        json!({"playerIds":["p3"]}),
        Some(json!({"kind":"character","characterId":"artist"})),
        vec![],
    );
    assert_eq!(p["ok"], true, "{p}");
    game["game"]["events"]
        .as_array_mut()
        .unwrap()
        .push(p["value"]["event"].clone());
    confirm(&mut game, Value::Null);
    let id = replay(&game)["day"]["madness"][0]["id"].clone();
    day(
        &mut game,
        json!({"kind":"checkMadness","assignmentId":id,"violation":false}),
    );
    for _ in 0..3 {
        day(&mut game, json!({"kind":"advance"}));
    }
    day(
        &mut game,
        json!({"kind":"nominate","nominatorId":"p1","nomineeId":"p3"}),
    );
    day(
        &mut game,
        json!({"kind":"vote","voterIds":["p1","p2","p3"]}),
    );
    day(&mut game, json!({"kind":"closeNominations"}));
    day(&mut game, json!({"kind":"confirmExecution"}));
    let before_death = game.clone();
    day(&mut game, json!({"kind":"confirmDeath"}));
    let s = replay(&game);
    assert!(s["ruleState"]["abilityGrants"]
        .as_array()
        .is_none_or(Vec::is_empty));
    assert!(
        s["day"]["availableActions"]
            .as_array()
            .unwrap()
            .iter()
            .any(|a| a["characterId"] == "artist"
                && a["simulationSource"]["sourceAbilityUse"]["ownerPlayerId"] == "p1"),
        "{s}"
    );
    assert!(s["day"]["madness"].as_array().unwrap().is_empty());
    let tokens = s["ruleState"]["automaticReminders"].as_array().unwrap();
    assert_eq!(
        tokens
            .iter()
            .any(|t| t["characterId"] == "pixie" && t["tokenId"] == "hasAbility"),
        !marionette
    );
    assert!(!tokens
        .iter()
        .any(|t| t["characterId"] == "pixie" && t["tokenId"] == "mad"));
    assert!(replay(&before_death)["ruleState"]["automaticReminders"]
        .as_array()
        .unwrap()
        .iter()
        .any(|t| t["characterId"] == "pixie" && t["tokenId"] == "mad"));
}

#[test]
fn nightwatchman_confirmed_notification_is_private_spent_and_undoable() {
    let mut game = carousel_game(&["nightwatchman", "savant", "artist", "poisoner", "imp"]);
    until_watchman(&mut game, None, false);
    let event = confirm(&mut game, json!({"playerIds":["p2"]}));
    let state = replay(&game);
    assert_eq!(
        state["pendingIdentityReveals"][0]["payload"],
        json!({"kind":"nightwatchmanInformation","recipientPlayer":{"playerId":"p2","seat":2,"name":"P2"},"nightwatchmanPlayer":{"playerId":"p1","seat":1,"name":"P1"}})
    );
    assert_eq!(
        state["ruleState"]["abilityUses"][0]["abilityUse"]["characterId"],
        "nightwatchman"
    );
    assert!(state["ruleState"]["automaticReminders"]
        .as_array()
        .unwrap()
        .iter()
        .any(|r| r["characterId"] == "nightwatchman" && r["tokenId"] == "noAbility"));
    let mut forged = game.clone();
    forged["game"]["events"]
        .as_array_mut()
        .unwrap()
        .last_mut()
        .unwrap()["payload"]["result"]["revealedPlayerId"] = json!("p4");
    let invalid: Value = serde_json::from_str(&crate::replay_json(&forged.to_string())).unwrap();
    assert_eq!(invalid["ok"], false);
    assert_eq!(event["payload"]["result"]["kind"], "nightwatchmanUsed");
    game["game"]["events"].as_array_mut().unwrap().pop();
    assert!(replay(&game)["pendingIdentityReveals"]
        .as_array()
        .is_none_or(Vec::is_empty));
    confirm(&mut game, Value::Null);
    assert!(replay(&game)["ruleState"]["abilityUses"]
        .as_array()
        .is_none_or(Vec::is_empty));
}

#[test]
fn nightwatchman_poison_spends_without_notifying_and_records_failure() {
    let mut game = carousel_game(&["nightwatchman", "savant", "artist", "poisoner", "imp"]);
    until_watchman(&mut game, Some("p1"), false);
    let event = confirm(&mut game, json!({"playerIds":["p2"]}));
    assert!(event["payload"]["result"]["revealedPlayerId"].is_null());
    let state = replay(&game);
    assert!(state["pendingIdentityReveals"]
        .as_array()
        .is_none_or(Vec::is_empty));
    assert_eq!(
        state["ruleState"]["abilityUses"].as_array().unwrap().len(),
        1
    );
}

#[test]
fn nightwatchman_vortox_rejects_true_identity_and_freezes_the_selected_lie() {
    let mut game = carousel_game(&["nightwatchman", "savant", "artist", "poisoner", "vortox"]);
    until_watchman(&mut game, None, false);
    let input = json!({"playerIds":["p2"]});
    let true_info = super::issue207_information::proposal(
        &game,
        input.clone(),
        Some(json!({"kind":"player","playerId":"p1"})),
        vec![],
    );
    assert_eq!(true_info["ok"], false);
    let lie = super::issue207_information::proposal(
        &game,
        input,
        Some(json!({"kind":"player","playerId":"p3"})),
        vec![],
    );
    assert_eq!(lie["ok"], true, "{lie}");
    game["game"]["events"]
        .as_array_mut()
        .unwrap()
        .push(lie["value"]["event"].clone());
    assert_eq!(
        replay(&game)["pendingIdentityReveals"][0]["payload"]["nightwatchmanPlayer"]["playerId"],
        "p3"
    );
}

#[test]
fn acquired_nightwatchman_uses_same_notification_without_changing_identity() {
    let mut game = carousel_game(&["philosopher", "savant", "artist", "poisoner", "imp"]);
    until_watchman(&mut game, None, true);
    confirm(&mut game, json!({"playerIds":["p2"]}));
    let state = replay(&game);
    assert_eq!(state["players"][0]["actualCharacter"], "philosopher");
    assert_eq!(
        state["pendingIdentityReveals"][0]["payload"]["nightwatchmanPlayer"]["playerId"],
        "p1"
    );
}

#[test]
fn drunk_nightwatchman_spends_only_simulated_use_and_never_notifies() {
    let mut game = carousel_game(&["drunk", "savant", "artist", "seamstress", "poisoner", "imp"]);
    until_watchman(&mut game, None, false);
    let event = confirm(&mut game, json!({"playerIds":["p2"]}));
    assert_eq!(event["payload"]["result"]["kind"], "simulation");
    assert_eq!(event["payload"]["result"]["spent"], true);
    let state = replay(&game);
    assert!(state["pendingIdentityReveals"]
        .as_array()
        .is_none_or(Vec::is_empty));
    assert!(state["ruleState"]["abilityUses"]
        .as_array()
        .is_none_or(Vec::is_empty));
    assert!(state["ruleState"]["automaticReminders"]
        .as_array()
        .unwrap()
        .iter()
        .any(|t| t["characterId"] == "nightwatchman" && t["tokenId"] == "noAbility"));
}

#[test]
fn deferred_nightwatchman_can_use_on_a_later_night_but_cannot_use_twice() {
    use super::issue225_nights::begin_night;
    let mut game = carousel_game(&["nightwatchman", "savant", "artist", "poisoner", "imp"]);
    until_watchman(&mut game, None, false);
    confirm(&mut game, Value::Null);
    confirm(&mut game, Value::Null); // dawn
    begin_night(&mut game);
    for _ in 0..10 {
        let step = replay(&game)["currentStep"].clone();
        match step["actionRef"]["actionId"].as_str().unwrap() {
            "choosePoisonTarget" => {
                confirm(&mut game, json!({"playerIds":["p2"]}));
            }
            "attackPlayer" => {
                confirm(&mut game, json!({"playerIds":["p3"]}));
            }
            "choosePlayer" => break,
            other => panic!("unexpected {other}"),
        }
    }
    assert_eq!(replay(&game)["currentStep"]["character"], "nightwatchman");
    confirm(&mut game, json!({"playerIds":["p1"]})); // self is a legal recipient
    let state = replay(&game);
    assert_eq!(
        state["pendingIdentityReveals"][0]["payload"]["recipientPlayer"]["playerId"],
        "p1"
    );
    assert_eq!(
        state["ruleState"]["abilityUses"].as_array().unwrap().len(),
        1
    );
    assert_ne!(state["currentStep"]["character"], "nightwatchman");
}

#[test]
fn pixie_first_information_separates_the_marked_player_and_learned_role() {
    use crate::{
        characters::{carousel::pixie_learned_characters, resolve_custom_script_ids},
        contracts::FirstNightActionRef,
        state::ActionOccurrence,
    };
    let definition =
        resolve_custom_script_ids(&["soldier", "artist", "savant", "imp"].map(str::to_owned))
            .unwrap();
    let mut f = facts();
    f.players[0].actual_character = "pixie".into();
    f.players[0].ability_instance.character_id = "pixie".into();
    f.players[2].actual_character = "imp".into();
    let source = crate::model::AbilityUseRef {
        owner_player_id: "p1".into(),
        character_id: "pixie".into(),
        ability_instance_id: f.players[0].ability_instance.id.clone(),
    };
    let occurrence = ActionOccurrence::character(
        FirstNightActionRef::Character {
            character_id: "pixie".into(),
            action_id: "learnTownsfolk".into(),
        },
        source.clone(),
    )
    .unwrap();
    assert_eq!(
        pixie_learned_characters(&definition, &f, &occurrence, "p2"),
        ["soldier"]
    );
    assert!(pixie_learned_characters(&definition, &f, &occurrence, "p3").is_empty());
    f.vortox_sources.push(source.clone());
    assert_eq!(
        pixie_learned_characters(&definition, &f, &occurrence, "p2"),
        ["artist", "savant"]
    );
    // Even dead Characters remain in play; death does not create a false role.
    f.players[1].alive = false;
    assert!(
        !pixie_learned_characters(&definition, &f, &occurrence, "p2").contains(&"soldier".into())
    );
    f.active_impairments.push(ActiveImpairment {
        kind: ImpairmentKind::Poisoned,
        player_id: "p1".into(),
        source_event_id: "poison".into(),
        source_character_id: "poisoner".into(),
        expires: ImpairmentExpiry::WhileSourceAbilityActive,
    });
    assert_eq!(
        pixie_learned_characters(&definition, &f, &occurrence, "p3"),
        ["artist", "savant"],
        "Vortox overrides poisoning"
    );
    f.vortox_sources.clear();
    assert_eq!(
        pixie_learned_characters(&definition, &f, &occurrence, "p3"),
        ["soldier", "artist", "savant"]
    );
    assert!(pixie_learned_characters(&definition, &f, &occurrence, "missing").is_empty());
}

#[test]
fn pixie_acquisition_depends_on_health_at_death_not_truthfulness() {
    use crate::characters::carousel::pixie_can_acquire;
    let mut f = facts();
    let source = &mut f.ability_provenance[0].ability_use;
    source.character_id = "pixie".into();
    let source = source.clone();
    f.players[0].actual_character = "pixie".into();
    f.players[0].ability_instance.character_id = "pixie".into();
    f.vortox_sources.push(source.clone());
    assert!(pixie_can_acquire(&f, &source, true));
    assert!(!pixie_can_acquire(&f, &source, false));
    for kind in [ImpairmentKind::Poisoned, ImpairmentKind::Drunk] {
        f.active_impairments = vec![ActiveImpairment {
            kind,
            player_id: "p1".into(),
            source_event_id: "impair".into(),
            source_character_id: "poisoner".into(),
            expires: ImpairmentExpiry::WhileSourceAbilityActive,
        }];
        assert!(!pixie_can_acquire(&f, &source, true));
    }
    f.active_impairments.clear();
    f.players[0].alive = false;
    assert!(!pixie_can_acquire(&f, &source, true));
}

fn facts() -> CustomGameFacts {
    let (_, seed) = super::issue207_rule_state::failed_choice();
    let players = (1..=6)
        .map(|seat| {
            let mut p = seed.players[0].clone();
            p.id = format!("p{seat}");
            p.seat = seat;
            p.actual_character = if seat == 1 { "zealot" } else { "soldier" }.into();
            p.shown_character = p.actual_character.clone();
            p.ability_instance.id = AbilityInstanceId::new("setup", &p.id);
            p.ability_instance.character_id = p.actual_character.clone();
            p
        })
        .collect();
    CustomGameFacts::from_players(players)
}

#[test]
fn zealot_obligation_has_exact_five_living_boundary_and_ignores_alignment() {
    let mut f = facts();
    assert_eq!(forced_voter_ids(&f), ["p1"]);
    f.players[0].alignment = Alignment::Evil;
    f.players[5].alive = false;
    assert_eq!(forced_voter_ids(&f), ["p1"]);
    f.players[4].alive = false;
    assert!(forced_voter_ids(&f).is_empty());
    f.players[4].alive = true;
    assert_eq!(forced_voter_ids(&f), ["p1"]);
}

#[test]
fn zealot_obligation_ends_on_death_impairment_and_identity_loss() {
    let mut f = facts();
    f.players[0].alive = false;
    assert!(forced_voter_ids(&f).is_empty());
    f.players[0].alive = true;
    f.active_impairments.push(ActiveImpairment {
        kind: ImpairmentKind::Poisoned,
        player_id: "p1".into(),
        source_event_id: "poison".into(),
        source_character_id: "poisoner".into(),
        expires: ImpairmentExpiry::WhileSourceAbilityActive,
    });
    assert!(forced_voter_ids(&f).is_empty());
    f.active_impairments.clear();
    assert_eq!(forced_voter_ids(&f), ["p1"]);
    f.players[0].actual_character = "soldier".into();
    f.players[0].ability_instance.id = AbilityInstanceId::new("change", "p1");
    f.players[0].ability_instance.character_id = "soldier".into();
    assert!(
        forced_voter_ids(&f).is_empty(),
        "historical provenance is not current ownership"
    );
}

#[test]
fn zealot_shown_role_does_not_create_a_voting_obligation() {
    let mut f = facts();
    f.players[0].actual_character = "marionette".into();
    f.players[0].ability_instance.character_id = "marionette".into();
    f.players[0].ability_instance.id = AbilityInstanceId::new("puppet", "p1");
    assert_eq!(f.players[0].shown_character, "zealot");
    assert!(forced_voter_ids(&f).is_empty());
}

#[test]
fn zealot_acquired_instances_are_counted_once_and_removed_by_exact_source() {
    use crate::model::{AbilityGrant, AbilityOrigin, AbilityUseRef};
    use crate::state::AbilityProvenance;
    let mut f = facts();
    let source = f.ability_provenance[0].ability_use.clone();
    for event in ["grant-one", "grant-two"] {
        let instance = AbilityInstanceId::new(event, "p2");
        f.ability_grants.push(AbilityGrant {
            owner_player_id: "p2".into(),
            character_id: "zealot".into(),
            source_event_id: event.into(),
            source_ability_instance_id: source.ability_instance_id.clone(),
            ability_instance_id: instance.clone(),
        });
        f.ability_provenance.push(AbilityProvenance {
            ability_use: AbilityUseRef {
                owner_player_id: "p2".into(),
                character_id: "zealot".into(),
                ability_instance_id: instance,
            },
            origin: AbilityOrigin::Acquired {
                acquisition_event_id: event.into(),
                source: source.clone(),
            },
        });
    }
    assert_eq!(forced_voter_ids(&f), ["p1", "p2"]);
    f.ability_grants.remove(0);
    assert_eq!(forced_voter_ids(&f), ["p1", "p2"]);
    f.ability_grants.clear();
    assert_eq!(forced_voter_ids(&f), ["p1"]);
}

#[test]
fn zealot_public_vote_command_replay_and_undo_require_the_real_vote() {
    use serde_json::{json, Value};
    let mut game: Value = serde_json::from_str(include_str!(
        "../../../../fixtures/acceptance/custom-first-night/compatibility/day.game.json"
    ))
    .unwrap();
    game["game"]["script"]["definition"]["characterIds"]
        .as_array_mut()
        .unwrap()
        .push(json!("zealot"));
    let player = &mut game["game"]["events"][0]["payload"]["players"][4];
    player["actualCharacter"] = json!("zealot");
    player["shownCharacter"] = json!("zealot");
    let replay = |g: &Value| -> Value {
        let r: Value = serde_json::from_str(&crate::replay_json(&g.to_string())).unwrap();
        assert_eq!(r["ok"], true, "{r}");
        r["value"].clone()
    };
    let propose =
        |g: &Value, input: Value| -> Value {
            let r = replay(g);
            serde_json::from_str(&crate::propose_json(&g.to_string(), &json!({
            "type":"confirmDay", "payload": {"stepId":r["day"]["stepId"],
            "expectedEventCount":g["game"]["events"].as_array().unwrap().len(), "input":input}
        }).to_string())).unwrap()
        };
    assert_eq!(replay(&game)["day"]["forcedVoterIds"], json!(["p5"]));
    for input in [
        json!({"kind":"advance"}),
        json!({"kind":"advance"}),
        json!({"kind":"advance"}),
        json!({"kind":"nominate","nominatorId":"p1","nomineeId":"p2"}),
    ] {
        let r = propose(&game, input);
        assert_eq!(r["ok"], true, "{r}");
        game["game"]["events"]
            .as_array_mut()
            .unwrap()
            .push(r["value"]["event"].clone());
    }
    let missing = propose(&game, json!({"kind":"vote","voterIds":["p1","p2"]}));
    assert_eq!(
        missing["ok"], false,
        "omitting the required voter must fail"
    );
    let accepted = propose(&game, json!({"kind":"vote","voterIds":["p1","p2","p5"]}));
    assert_eq!(accepted["ok"], true, "{accepted}");
    game["game"]["events"]
        .as_array_mut()
        .unwrap()
        .push(accepted["value"]["event"].clone());
    assert_eq!(
        replay(&game)["day"]["nominations"][0]["voterIds"],
        json!(["p1", "p2", "p5"])
    );
    let mut forged = game.clone();
    forged["game"]["events"]
        .as_array_mut()
        .unwrap()
        .last_mut()
        .unwrap()["payload"]["input"]["voterIds"] = json!(["p1", "p2"]);
    let rejected: Value = serde_json::from_str(&crate::replay_json(&forged.to_string())).unwrap();
    assert_eq!(rejected["ok"], false);
    game["game"]["events"].as_array_mut().unwrap().pop();
    assert_eq!(replay(&game)["day"]["forcedVoterIds"], json!(["p5"]));
}

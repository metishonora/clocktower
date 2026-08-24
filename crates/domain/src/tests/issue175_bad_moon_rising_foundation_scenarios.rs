use crate::{propose_json, replay_json, setup_distribution_json};
use serde_json::{json, Value};
use std::collections::HashSet;

const TOWNSFOLK: [&str; 13] = [
    "grandmother",
    "sailor",
    "chambermaid",
    "exorcist",
    "innkeeper",
    "gambler",
    "gossip",
    "courtier",
    "professor",
    "minstrel",
    "teaLady",
    "pacifist",
    "fool",
];
const OUTSIDERS: [&str; 4] = ["tinker", "moonchild", "goon", "lunatic"];
const MINIONS: [&str; 4] = ["godfather", "devilsAdvocate", "assassin", "mastermind"];
const DEMONS: [&str; 4] = ["zombuul", "pukka", "shabaloth", "po"];

fn empty_game() -> Value {
    json!({
        "schemaVersion": 3,
        "game": {
            "id": "game-bmr-foundation",
            "name": "Bad Moon Rising foundation",
            "scriptId": "badMoonRising",
            "createdAt": "2026-08-24T00:00:00.000Z",
            "updatedAt": "2026-08-24T00:00:00.000Z",
            "events": []
        }
    })
}

fn game_with_events(events: Vec<Value>) -> Value {
    let mut game = empty_game();
    game["game"]["events"] = Value::Array(events);
    game
}

fn setup_players(character_ids: &[&str]) -> Vec<Value> {
    character_ids
        .iter()
        .enumerate()
        .map(|(index, character_id)| {
            let mut player = json!({
                "seat": index + 1,
                "name": format!("Player {}", index + 1),
                "actualCharacter": character_id,
            });
            if *character_id == "lunatic" {
                player["shownCharacter"] = json!("shabaloth");
            }
            player
        })
        .collect()
}

fn create_command(character_ids: &[&str], setup_choice_id: Option<&str>) -> Value {
    let mut payload = json!({ "players": setup_players(character_ids) });
    if let Some(choice) = setup_choice_id {
        payload["setupChoiceId"] = json!(choice);
    }
    json!({ "type": "createGame", "payload": payload })
}

fn propose_create(character_ids: &[&str], setup_choice_id: Option<&str>) -> Value {
    serde_json::from_str(&propose_json(
        &empty_game().to_string(),
        &create_command(character_ids, setup_choice_id).to_string(),
    ))
    .unwrap()
}

fn setup_event(character_ids: &[&str], setup_choice_id: Option<&str>) -> Value {
    let proposed = propose_create(character_ids, setup_choice_id);
    assert_eq!(proposed["ok"], true, "setup proposal failed: {proposed}");
    proposed["value"]["event"].clone()
}

fn setup_distribution(player_count: usize, actual_characters: &[&str]) -> Value {
    serde_json::from_str(&setup_distribution_json(
        &json!({
            "scriptId": "badMoonRising",
            "playerCount": player_count,
            "actualCharacters": actual_characters,
        })
        .to_string(),
    ))
    .unwrap()
}

#[test]
fn bmr_script_identity_and_official_character_ids_are_accepted_only_by_bmr() {
    let empty: Value = serde_json::from_str(&replay_json(&empty_game().to_string())).unwrap();
    assert_eq!(empty["ok"], true, "{empty}");
    assert_eq!(empty["value"]["scriptId"], "badMoonRising");
    assert_eq!(empty["value"]["phase"], "setup");

    let all_ids = TOWNSFOLK
        .iter()
        .chain(OUTSIDERS.iter())
        .chain(MINIONS.iter())
        .chain(DEMONS.iter())
        .copied()
        .collect::<Vec<_>>();
    assert_eq!(all_ids.len(), 25);
    assert_eq!(all_ids.iter().copied().collect::<HashSet<_>>().len(), 25);

    let base = [
        "grandmother",
        "sailor",
        "chambermaid",
        "exorcist",
        "innkeeper",
        "devilsAdvocate",
        "zombuul",
    ];
    for (kind, ids, slot) in [
        ("Townsfolk", TOWNSFOLK.as_slice(), 0),
        ("Outsider", OUTSIDERS.as_slice(), 0),
        ("Minion", MINIONS.as_slice(), 5),
        ("Demon", DEMONS.as_slice(), 6),
    ] {
        for character_id in ids {
            let mut roster = base;
            roster[slot] = character_id;
            let choice = roster.contains(&"godfather").then_some("addOutsider");
            let actual = propose_create(&roster, choice);
            assert_eq!(
                actual["ok"], true,
                "{kind} {character_id} should belong to BMR: {actual}"
            );
        }
    }

    for foreign_id in ["washerwoman", "clockmaker", "notACharacter"] {
        let mut roster = base;
        roster[0] = foreign_id;
        let actual = propose_create(&roster, None);
        assert_eq!(actual["error"]["code"], "UNKNOWN_CHARACTER", "{actual}");
    }
}

#[test]
fn bmr_supports_the_official_seven_to_fifteen_player_setup_table_only() {
    for (player_count, expected) in [
        (7, [5, 0, 1, 1]),
        (8, [5, 1, 1, 1]),
        (9, [5, 2, 1, 1]),
        (10, [7, 0, 2, 1]),
        (11, [7, 1, 2, 1]),
        (12, [7, 2, 2, 1]),
        (13, [9, 0, 3, 1]),
        (14, [9, 1, 3, 1]),
        (15, [9, 2, 3, 1]),
    ] {
        let actual = setup_distribution(player_count, &[]);
        assert_eq!(actual["ok"], true, "{player_count} Players: {actual}");
        assert_eq!(
            actual["value"],
            json!({
                "Townsfolk": expected[0],
                "Outsider": expected[1],
                "Minion": expected[2],
                "Demon": expected[3],
            })
        );
    }

    for player_count in [6, 16] {
        let query = setup_distribution(player_count, &[]);
        assert_eq!(query["error"]["code"], "INVALID_PLAYER_COUNT", "{query}");

        let roster = (0..player_count)
            .map(|index| TOWNSFOLK[index % TOWNSFOLK.len()])
            .collect::<Vec<_>>();
        let create = propose_create(&roster, None);
        assert_eq!(create["error"]["code"], "INVALID_PLAYER_COUNT", "{create}");
    }
}

#[test]
fn godfather_returns_only_valid_options_and_never_selects_one_implicitly() {
    let seven = setup_distribution(7, &["godfather"]);
    assert_eq!(
        seven["value"],
        json!({
            "options": [{
                "id": "addOutsider",
                "distribution": { "Townsfolk": 4, "Outsider": 1, "Minion": 1, "Demon": 1 }
            }]
        }),
        "{seven}"
    );

    let eight = setup_distribution(8, &["godfather"]);
    assert_eq!(
        eight["value"],
        json!({
            "options": [{
                "id": "addOutsider",
                "distribution": { "Townsfolk": 4, "Outsider": 2, "Minion": 1, "Demon": 1 }
            }, {
                "id": "removeOutsider",
                "distribution": { "Townsfolk": 6, "Outsider": 0, "Minion": 1, "Demon": 1 }
            }]
        }),
        "{eight}"
    );

    let seven_roster = [
        "grandmother",
        "sailor",
        "chambermaid",
        "exorcist",
        "innkeeper",
        "godfather",
        "zombuul",
    ];
    for choice in [None, Some("removeOutsider"), Some("notAChoice")] {
        let actual = propose_create(&seven_roster, choice);
        assert_eq!(actual["error"]["code"], "INVALID_SETUP_CHOICE", "{actual}");
    }
}

#[test]
fn confirmed_godfather_choice_and_lunatic_identity_survive_event_and_replay() {
    let roster = [
        "grandmother",
        "sailor",
        "chambermaid",
        "exorcist",
        "innkeeper",
        "lunatic",
        "godfather",
        "zombuul",
    ];
    let event = setup_event(&roster, Some("removeOutsider"));
    assert_eq!(event["payload"]["setupChoiceId"], "removeOutsider");
    let lunatic = event["payload"]["players"]
        .as_array()
        .unwrap()
        .iter()
        .find(|player| player["actualCharacter"] == "lunatic")
        .unwrap();
    assert_eq!(lunatic["shownCharacter"], "shabaloth");

    let exported = game_with_events(vec![event]);
    let imported: Value = serde_json::from_str(&exported.to_string()).unwrap();
    let replayed: Value = serde_json::from_str(&replay_json(&imported.to_string())).unwrap();
    assert_eq!(replayed["ok"], true, "{replayed}");
    assert_eq!(replayed["value"]["setupChoiceId"], "removeOutsider");
    assert!(
        replayed["value"]["ruleState"]
            .get("automaticReminders")
            .is_none(),
        "foundation metadata must not generate runtime reminders: {replayed}"
    );
    let replayed_lunatic = replayed["value"]["players"]
        .as_array()
        .unwrap()
        .iter()
        .find(|player| player["actualCharacter"] == "lunatic")
        .unwrap();
    assert_eq!(replayed_lunatic["shownCharacter"], "shabaloth");
}

#[test]
fn lunatic_requires_a_shown_bmr_demon() {
    let roster = [
        "grandmother",
        "sailor",
        "chambermaid",
        "exorcist",
        "innkeeper",
        "lunatic",
        "zombuul",
    ];
    for shown_character in [None, Some("grandmother"), Some("imp")] {
        let mut command = create_command(&roster, None);
        let lunatic = command["payload"]["players"]
            .as_array_mut()
            .unwrap()
            .iter_mut()
            .find(|player| player["actualCharacter"] == "lunatic")
            .unwrap();
        match shown_character {
            Some(character) => lunatic["shownCharacter"] = json!(character),
            None => {
                lunatic.as_object_mut().unwrap().remove("shownCharacter");
            }
        }
        let actual: Value = serde_json::from_str(&propose_json(
            &empty_game().to_string(),
            &command.to_string(),
        ))
        .unwrap();
        assert_eq!(
            actual["error"]["code"], "INVALID_LUNATIC_SHOWN_CHARACTER",
            "{actual}"
        );
    }
}

#[test]
fn first_night_phase_overview_matches_the_official_roster_filtered_order() {
    let roster = [
        "sailor",
        "courtier",
        "grandmother",
        "chambermaid",
        "lunatic",
        "godfather",
        "devilsAdvocate",
        "pukka",
    ];
    let replayed: Value = serde_json::from_str(&replay_json(
        &game_with_events(vec![setup_event(&roster, Some("addOutsider"))]).to_string(),
    ))
    .unwrap();
    assert_eq!(replayed["ok"], true, "{replayed}");
    let overview = replayed["value"]["phaseOverview"].as_array().unwrap();
    assert_eq!(
        overview
            .iter()
            .map(|step| step["id"].as_str().unwrap())
            .collect::<Vec<_>>(),
        vec![
            "firstNight:minionInfo",
            "firstNight:lunatic",
            "firstNight:demonInfo",
            "firstNight:sailor",
            "firstNight:courtier",
            "firstNight:godfather",
            "firstNight:devilsAdvocate",
            "firstNight:pukka",
            "firstNight:grandmother",
            "firstNight:chambermaid",
            "firstNight:toDay",
        ]
    );
    for step in overview.iter().filter(|step| step["character"].is_string()) {
        assert_eq!(step["support"], "manual", "{step}");
    }
}

fn append_current_resolution(events: &mut Vec<Value>) -> Value {
    let before = game_with_events(events.clone());
    let replayed: Value = serde_json::from_str(&replay_json(&before.to_string())).unwrap();
    assert_eq!(replayed["ok"], true, "{replayed}");
    let step = &replayed["value"]["currentStep"];
    let command = if step["support"] == "manual" {
        json!({
            "type": "resolveManualStep",
            "payload": { "stepId": step["id"], "outcome": "notApplicable" }
        })
    } else if step["requiredInput"]["kind"] == "characterIds" {
        let count = step["requiredInput"]["minSelections"]
            .as_u64()
            .unwrap_or_default() as usize;
        let choices = step["requiredInput"]["allowedCharacterIds"]
            .as_array()
            .unwrap()
            .iter()
            .take(count)
            .cloned()
            .collect::<Vec<_>>();
        json!({
            "type": "confirmStep",
            "payload": { "stepId": step["id"], "input": { "characterIds": choices } }
        })
    } else {
        json!({ "type": "confirmStep", "payload": { "stepId": step["id"] } })
    };
    let proposed: Value =
        serde_json::from_str(&propose_json(&before.to_string(), &command.to_string())).unwrap();
    assert_eq!(proposed["ok"], true, "{proposed}");
    events.push(proposed["value"]["event"].clone());
    replayed
}

fn advance_to_later_night(roster: &[&str]) -> Value {
    let choice = roster.contains(&"godfather").then_some("addOutsider");
    let mut events = vec![setup_event(roster, choice)];
    for _ in 0..64 {
        let replayed: Value =
            serde_json::from_str(&replay_json(&game_with_events(events.clone()).to_string()))
                .unwrap();
        assert_eq!(replayed["ok"], true, "{replayed}");
        if replayed["value"]["phase"] == "night" {
            return replayed;
        }
        append_current_resolution(&mut events);
    }
    panic!("BMR did not reach later night through its explicit phase boundaries");
}

fn expected_later_night_ids(roster: &[&str]) -> Vec<&'static str> {
    let in_play = roster.iter().copied().collect::<HashSet<_>>();
    let mut expected = Vec::new();
    for (character, step_id) in [
        ("sailor", "night:sailor"),
        ("innkeeper", "night:innkeeper"),
        ("courtier", "night:courtier"),
        ("gambler", "night:gambler"),
        ("devilsAdvocate", "night:devilsAdvocate"),
        ("lunatic", "night:lunatic"),
        ("exorcist", "night:exorcist"),
        ("zombuul", "night:zombuul"),
        ("pukka", "night:pukka"),
    ] {
        if in_play.contains(character) {
            expected.push(step_id);
        }
    }
    if in_play.contains("shabaloth") {
        expected.push("night:shabalothResurrection");
        expected.push("night:shabalothAttack");
    }
    if in_play.contains("po") {
        expected.push("night:po");
    }
    for (character, step_id) in [
        ("assassin", "night:assassin"),
        ("godfather", "night:godfather"),
        ("professor", "night:professor"),
        ("gossip", "night:gossip"),
        ("tinker", "night:tinker"),
        ("moonchild", "night:moonchild"),
        ("grandmother", "night:grandmother"),
        ("chambermaid", "night:chambermaid"),
    ] {
        if in_play.contains(character) {
            expected.push(step_id);
        }
    }
    expected.push("night:toDay");
    expected
}

#[test]
fn later_night_phase_overview_preserves_every_official_demon_position() {
    let base = [
        "sailor",
        "innkeeper",
        "courtier",
        "gambler",
        "exorcist",
        "professor",
        "gossip",
        "grandmother",
        "chambermaid",
        "tinker",
        "moonchild",
        "lunatic",
        "devilsAdvocate",
        "godfather",
        "zombuul",
    ];
    for demon in DEMONS {
        let mut roster = base;
        roster[14] = demon;
        let replayed = advance_to_later_night(&roster);
        let actual = replayed["value"]["phaseOverview"]
            .as_array()
            .unwrap()
            .iter()
            .map(|step| step["id"].as_str().unwrap())
            .collect::<Vec<_>>();
        assert_eq!(actual, expected_later_night_ids(&roster), "{replayed}");
    }

    let mut assassin_roster = base;
    assassin_roster[6] = "assassin";
    let replayed = advance_to_later_night(&assassin_roster);
    let actual = replayed["value"]["phaseOverview"]
        .as_array()
        .unwrap()
        .iter()
        .map(|step| step["id"].as_str().unwrap())
        .collect::<Vec<_>>();
    assert_eq!(actual, expected_later_night_ids(&assassin_roster));
}

#[test]
fn bmr_manual_steps_reject_automated_confirmation_and_replay_explicit_outcomes() {
    let roster = [
        "sailor",
        "courtier",
        "grandmother",
        "chambermaid",
        "lunatic",
        "devilsAdvocate",
        "pukka",
    ];
    let mut events = vec![setup_event(&roster, None)];
    let automated_as_manual: Value = serde_json::from_str(&propose_json(
        &game_with_events(events.clone()).to_string(),
        &json!({
            "type": "resolveManualStep",
            "payload": { "stepId": "firstNight:minionInfo", "outcome": "handled" }
        })
        .to_string(),
    ))
    .unwrap();
    assert_eq!(
        automated_as_manual["error"]["code"], "STEP_IS_AUTOMATED",
        "{automated_as_manual}"
    );

    append_current_resolution(&mut events);
    let before_lunatic = game_with_events(events.clone());
    let automated_confirmation: Value = serde_json::from_str(&propose_json(
        &before_lunatic.to_string(),
        &json!({ "type": "confirmStep", "payload": { "stepId": "firstNight:lunatic" } })
            .to_string(),
    ))
    .unwrap();
    assert_eq!(
        automated_confirmation["error"]["code"], "STEP_REQUIRES_MANUAL_RESOLUTION",
        "{automated_confirmation}"
    );

    let handled: Value = serde_json::from_str(&propose_json(
        &before_lunatic.to_string(),
        &json!({
            "type": "resolveManualStep",
            "payload": { "stepId": "firstNight:lunatic", "outcome": "handled" }
        })
        .to_string(),
    ))
    .unwrap();
    assert_eq!(handled["ok"], true, "{handled}");
    events.push(handled["value"]["event"].clone());
    let replayed: Value =
        serde_json::from_str(&replay_json(&game_with_events(events).to_string())).unwrap();
    let lunatic = replayed["value"]["phaseOverview"]
        .as_array()
        .unwrap()
        .iter()
        .find(|step| step["id"] == "firstNight:lunatic")
        .unwrap();
    assert_eq!(lunatic["status"], "manualComplete");
}

use super::issue207_acquisition::replay;
use super::issue225_nights::{day, step};
use super::issue237_carousel::configured_game;
use serde_json::{json, Value};

fn game() -> Value {
    let mut g = configured_game(
        &[
            "grandmother",
            "gambler",
            "fool",
            "noble",
            "soldier",
            "artist",
            "mayor",
            "moonchild",
            "golem",
            "devilsAdvocate",
            "assassin",
            "imp",
        ],
        None,
        "noble",
    );
    for _ in 0..30 {
        let state = replay(&g);
        if state["phase"] == "day" {
            break;
        }
        let s = &state["currentStep"];
        let input = match s["actionRef"]["actionId"].as_str().unwrap() {
            "demonInfo" => {
                json!({"characterIds":s["requiredInput"]["allowedCharacterIds"].as_array().unwrap()[..3]})
            }
            "minionInfo" | "dawn" => Value::Null,
            "protectExecution" => json!({"playerIds":["p5"]}),
            "learnGrandchild" => json!({"playerIds":["p4"]}),
            "learnPlayers" => json!({"playerIds":["p1","p2","p10"]}),
            _ => panic!("unexpected first night step: {s}"),
        };
        step(&mut g, s["actionRef"].clone(), input, None);
    }
    for _ in 0..3 {
        day(&mut g, json!({"kind":"advance"}));
    }
    g
}
fn nominate(g: &mut Value, target: &str) -> Value {
    day(
        g,
        json!({"kind":"nominate","nominatorId":"p9","nomineeId":target}),
    );
    g["game"]["events"]
        .as_array()
        .unwrap()
        .last()
        .unwrap()
        .clone()
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
fn round_trip_and_undo(g: &Value, before: &Value, event_count: usize) {
    let loaded: Value = serde_json::from_str(&g.to_string()).unwrap();
    assert_eq!(replay(&loaded), replay(g));
    let mut undone = loaded;
    for _ in 0..event_count {
        undone["game"]["events"].as_array_mut().unwrap().pop();
    }
    assert_eq!(replay(&undone), replay(before));
}
fn next_night(g: &mut Value, attack: &str) {
    day(g, json!({"kind":"vote","voterIds":[]}));
    day(g, json!({"kind":"closeNominations"}));
    day(g, json!({"kind":"confirmExecution"}));
    day(g, json!({"kind":"beginNight"}));
    for _ in 0..30 {
        let state = replay(g);
        if state["phase"] == "day" {
            return;
        }
        let s = &state["currentStep"];
        let input = match s["actionRef"]["actionId"].as_str().unwrap() {
            "guessCharacter" => json!({"playerIds":["p2"],"characterIds":["gambler"]}),
            "protectExecution" => json!({"playerIds":["p6"]}),
            "attackPlayer" => json!({"playerIds":[attack]}),
            "killPlayer" | "resolveDeath" | "dusk" | "dawn" => Value::Null,
            _ => panic!("unexpected step: {s}"),
        };
        step(g, s["actionRef"].clone(), input, None);
    }
    panic!("day not reached");
}

#[test]
fn all_eight_golem_fool_preview_consumption_replay_undo_and_later_death() {
    let mut g = game();
    let before = g.clone();
    let state = replay(&g);
    let preview = state["day"]["golemNominationOptions"]
        .as_array()
        .unwrap()
        .iter()
        .find(|o| o["targetPlayerId"] == "p3")
        .unwrap();
    assert_eq!(preview["outcome"], "protected");
    let event = nominate(&mut g, "p3");
    assert_eq!(event["payload"]["result"]["golemEffects"], json!([preview]));
    assert!(alive(&g, "p3"));
    let state = replay(&g);
    for role in ["golem", "fool"] {
        assert!(state["ruleState"]["abilityUses"]
            .as_array()
            .unwrap()
            .iter()
            .any(|u| u["abilityUse"]["characterId"] == role));
    }
    assert_eq!(state["day"]["stage"], "voting");
    assert_eq!(state["latestUndoUnit"]["eventIds"], json!([event["id"]]));
    round_trip_and_undo(&g, &before, 1);
    next_night(&mut g, "p3");
    assert!(!alive(&g, "p3"));
}

#[test]
fn all_eight_golem_kills_noble_grandchild_without_grandmother_chain() {
    let mut g = game();
    let before = g.clone();
    assert!(g["game"]["events"]
        .as_array()
        .unwrap()
        .iter()
        .any(|e| e["payload"]["actionRef"]["characterId"] == "noble"));
    let event = nominate(&mut g, "p4");
    assert_eq!(event["payload"]["result"]["deathPlayerIds"], json!(["p4"]));
    assert!(!alive(&g, "p4"));
    assert!(alive(&g, "p1"));
    assert_eq!(replay(&g)["day"]["deaths"][0]["cause"]["cause"], "golem");
    round_trip_and_undo(&g, &before, 1);
}

#[test]
fn all_eight_golem_moonchild_choice_blocks_vote_and_resolves_that_night() {
    let mut g = game();
    let before = g.clone();
    let nomination = nominate(&mut g, "p8");
    let state = replay(&g);
    let c = state["day"]["consequences"]
        .as_array()
        .unwrap()
        .iter()
        .find(|c| c["source"]["characterId"] == "moonchild")
        .unwrap();
    let command = json!({"type":"confirmDay","payload":{"stepId":state["day"]["stepId"],
        "input":{"kind":"vote","voterIds":[]}}});
    let rejected: Value =
        serde_json::from_str(&crate::propose_json(&g.to_string(), &command.to_string())).unwrap();
    assert_eq!(rejected["ok"], false);
    day(
        &mut g,
        json!({"kind":"resolveConsequence","consequenceId":c["id"],"playerId":"p4"}),
    );
    let choice = g["game"]["events"].as_array().unwrap().last().unwrap();
    assert_eq!(
        replay(&g)["latestUndoUnit"]["eventIds"],
        json!([nomination["id"], choice["id"]])
    );
    round_trip_and_undo(&g, &before, 2);
    next_night(&mut g, "p5");
    assert!(!alive(&g, "p4"));
    assert!(alive(&g, "p1"));
    assert!(alive(&g, "p5"));
    let loaded: Value = serde_json::from_str(&g.to_string()).unwrap();
    assert_eq!(replay(&loaded), replay(&g));
}

//! T13 approved read-only execution contracts at the public JSON boundary.
//! These assertions intentionally fail until execution projection is implemented.
use super::issue207_acquisition::{confirm, replay};
use serde_json::{json, Value};
fn twin() -> Value { super::issue207_relationships::game("evilTwin") }
fn execution(state: &Value) -> &Value {
    assert!(state.get("actionExecutions").is_some(), "T13 P1: missing Core actionExecutions");
    assert!(state.get("latestUndoUnit").is_some(), "T13 P1: missing Core latestUndoUnit");
    &state["currentStep"]["execution"]
}
#[test]
fn t13_dependency_parent_is_the_confirmed_assignment_and_shared_with_undo() {
    let mut game = twin();
    let pending = replay(&game);
    let root = execution(&pending)["id"].clone();
    assert!(root.is_string());
    let assignment = confirm(&mut game, json!({"playerIds":["p1"]}));
    let after = replay(&game);
    assert_eq!(execution(&after)["id"], root);
    assert_eq!(execution(&after)["predecessorEventId"], assignment["id"]);
    assert_eq!(execution(&after)["relation"], "continuation");
    let informed = confirm(&mut game, Value::Null);
    let complete = replay(&game);
    assert_eq!(complete["latestUndoUnit"]["eventIds"], json!([assignment["id"], informed["id"]]));
    assert_eq!(complete["latestUndoUnit"]["id"], informed["id"]);
}
#[test]
fn t13_partial_dependency_undo_does_not_include_system_information_or_setup() {
    let mut game = twin();
    let assignment = confirm(&mut game, json!({"playerIds":["p1"]}));
    let state = replay(&game); execution(&state);
    assert_eq!(state["latestUndoUnit"]["eventIds"], json!([assignment["id"]]));
    let serialized = game.to_string();
    assert!(!serialized.contains("actionExecutions"));
    assert!(!serialized.contains("latestUndoUnit"));
}
#[test]
fn t13_reassignment_does_not_pull_a_past_relationship_or_intervening_swap_into_undo() {
    let mut game=twin();
    let old=confirm(&mut game,json!({"playerIds":["p1"]}));
    confirm(&mut game,Value::Null);
    let swap=confirm(&mut game,json!({"playerIds":["p7"]}));
    let repair=confirm(&mut game,json!({"playerIds":["p2"]}));
    let informed=confirm(&mut game,Value::Null);
    let state=replay(&game); execution(&state);
    let ids=&state["latestUndoUnit"]["eventIds"];
    assert_eq!(ids,&json!([repair["id"],informed["id"]]));
    assert!(!ids.as_array().unwrap().contains(&old["id"]));
    assert!(!ids.as_array().unwrap().contains(&swap["id"]));
}
#[test]
fn t13_independent_action_closes_dependency_execution_even_if_next_in_stream() {
    let mut game=twin();
    confirm(&mut game,json!({"playerIds":["p1"]}));confirm(&mut game,Value::Null);
    let next=confirm(&mut game,json!({"playerIds":["p2"]}));
    let state=replay(&game);execution(&state);
    assert_eq!(state["latestUndoUnit"]["eventIds"],json!([next["id"]]));
}
#[test]
fn t13_wrong_dependency_reference_is_rejected_without_adopting_the_suffix() {
    let mut game=twin();confirm(&mut game,json!({"playerIds":["p1"]}));
    let before=game.clone();let mut event=super::issue207_acquisition::propose(&game,Value::Null)["value"]["event"].clone();
    event["payload"]["result"]["relationshipEventId"]=json!("not-the-assignment");
    game["game"]["events"].as_array_mut().unwrap().push(event);
    let rejected:Value=serde_json::from_str(&crate::replay_json(&game.to_string())).unwrap();
    assert_eq!(rejected["ok"],false);
    assert_eq!(replay(&before)["currentStep"]["actionRef"]["actionId"],"learnTwin");
}
#[test]
fn t13_registered_action_scope_matches_the_approved_twenty_nine_contracts() {
    use crate::contracts::FirstNightActionRef;
    let mut actual:Vec<String>=crate::first_night::catalog::production_actions().into_iter().map(|(a,_)|match a {
        FirstNightActionRef::System{action_id}=>format!("system.{}",serde_json::to_value(action_id).unwrap().as_str().unwrap()),
        FirstNightActionRef::Character{character_id,action_id}=>format!("{character_id}.{action_id}"),
    }).collect();
    let mut expected=vec!["system.dusk","system.minionInfo","system.demonInfo","system.dawn","fortuneTeller.assignRedHerring","washerwoman.prepareInformation","librarian.prepareInformation","investigator.prepareInformation","drunk.assignShownCharacter","poisoner.choosePoisonTarget","butler.chooseMaster","snakeCharmer.choosePlayer","witch.chooseCursedPlayer","evilTwin.assignTwin","washerwoman.learnTownsfolk","librarian.learnOutsider","investigator.learnMinion","chef.learnEvilPairs","empath.learnEvilNeighbors","clockmaker.learnSteps","mathematician.learnCount","fortuneTeller.checkDemon","dreamer.learnCharacters","seamstress.compareAlignments","philosopher.chooseAbility","cerenovus.assignMadness","evilTwin.learnTwin","mutant.resolveMadnessExecution","spy.inspectGrimoire"];
    actual.sort();expected.sort();assert_eq!(actual,expected);
}

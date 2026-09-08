//! Production split relationship and legacy rejection.
use serde_json::json;
#[test]
fn assignment_is_not_a_player_reveal_and_old_combined_event_cannot_replace_it() {
    let game = super::issue207_relationships::game("evilTwin");
    let proposal = super::issue207_acquisition::propose(&game, json!({"playerIds":["p1"]}));
    assert_eq!(proposal["ok"], true);
    assert!(proposal["value"]["revealPayload"].is_null());
    let mut forged = game.clone();
    let mut event = proposal["value"]["event"].clone();
    event["payload"]["actionRef"]["actionId"] = json!("learnTwin");
    event["payload"]["result"] = json!({"kind":"evilTwin","targetPlayerId":"p1","effective":true});
    forged["game"]["events"].as_array_mut().unwrap().push(event);
    let rejected: serde_json::Value =
        serde_json::from_str(&crate::replay_json(&forged.to_string())).unwrap();
    assert_eq!(rejected["ok"], false);
    assert_eq!(game["game"]["events"].as_array().unwrap().len(), 1);
}

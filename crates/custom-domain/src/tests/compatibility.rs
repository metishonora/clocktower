use crate::{custom_script_catalog_json, propose_json, replay_json};
use serde_json::Value;

#[test]
fn production_prefixes_and_proposals_preserve_frozen_baseline() {
    let captured: Value = serde_json::from_str(include_str!(
        "../../../../fixtures/acceptance/custom-first-night/compatibility/production-trace.json"
    ))
    .unwrap();
    let trace = captured["trace"].as_array().unwrap();
    for (index, prefix) in trace.iter().enumerate() {
        let replay: Value =
            serde_json::from_str(&replay_json(&prefix["game"].to_string())).unwrap();
        assert_eq!(replay["ok"], true, "prefix {index}: {replay}");
        assert_eq!(replay["value"], prefix["replay"], "prefix {index}");
        if index > 0 {
            let previous = trace[index - 1]["game"].to_string();
            let command = prefix["command"].to_string();
            let proposed: Value = serde_json::from_str(&propose_json(&previous, &command)).unwrap();
            assert_eq!(proposed["ok"], true, "proposal {index}: {proposed}");
            assert_eq!(proposed["value"], prefix["proposal"], "proposal {index}");
            assert_eq!(
                propose_json(&previous, &command),
                propose_json(&previous, &command)
            );
        }
    }
}

#[test]
fn complete_catalog_matches_frozen_production_order_and_kinds() {
    let baseline: Value = serde_json::from_str(include_str!(
        "../../../../fixtures/acceptance/custom-first-night/compatibility/catalog.json"
    ))
    .unwrap();
    let current: Value = serde_json::from_str(&custom_script_catalog_json()).unwrap();
    assert_eq!(current, baseline);
}

#[test]
fn independent_boundary_rejects_official_games_and_duplicate_event_ids() {
    let baseline: Value = serde_json::from_str(include_str!(
        "../../../../fixtures/acceptance/custom-first-night/compatibility/day.game.json"
    ))
    .unwrap();
    let mut duplicate = baseline.clone();
    duplicate["game"]["events"][1]["id"] = duplicate["game"]["events"][0]["id"].clone();
    let result: Value = serde_json::from_str(&replay_json(&duplicate.to_string())).unwrap();
    assert_eq!(result["error"]["code"], "DUPLICATE_EVENT_ID");
    for script in ["troubleBrewing", "sectsAndViolets", "badMoonRising"] {
        let mut official = baseline.clone();
        official["game"]["script"] = serde_json::json!({"type":"official","scriptId":script});
        let result: Value = serde_json::from_str(&replay_json(&official.to_string())).unwrap();
        assert_eq!(result["ok"], false);
    }
}

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn replay(game_file_json: &str) -> String {
    clocktower_custom_domain::replay_json(game_file_json)
}

#[wasm_bindgen]
pub fn propose(game_file_json: &str, command_json: &str) -> String {
    clocktower_custom_domain::propose_json(game_file_json, command_json)
}

#[wasm_bindgen]
pub fn setup_distribution(request_json: &str) -> String {
    clocktower_custom_domain::setup_distribution_json(request_json)
}

#[wasm_bindgen]
pub fn custom_script_catalog() -> String {
    clocktower_custom_domain::custom_script_catalog_json()
}

#[wasm_bindgen]
pub fn custom_first_night_plan(request_json: &str) -> String {
    clocktower_custom_domain::custom_first_night_plan_json(request_json)
}

#[cfg(test)]
mod tests {

    use super::*;

    const CUSTOM_DEFINITION: &str = r#"{
  "id": "issue-198-definition",
  "name": "Issue 198 definition",
  "characterIds": [
    "undertaker", "monk", "ravenkeeper", "virgin", "slayer",
    "scarletWoman", "imp", "philosopher", "washerwoman", "librarian", "chef"
  ],
  "firstNightOrder": [
    { "kind": "system", "actionId": "dusk" },
    { "kind": "system", "actionId": "demonInfo" },
    { "kind": "character", "characterId": "philosopher", "actionId": "chooseAbility" },
    { "kind": "system", "actionId": "minionInfo" },
    { "kind": "character", "characterId": "washerwoman", "actionId": "learnTownsfolk" },
    { "kind": "character", "characterId": "librarian", "actionId": "learnOutsider" },
    { "kind": "character", "characterId": "chef", "actionId": "learnEvilPairs" },
    { "kind": "system", "actionId": "dawn" }
  ]
}"#;

    const CUSTOM_PLAYERS: &str = r#"[
  { "id": "p1", "seat": 1, "name": "Undertaker", "actualCharacter": "undertaker", "shownCharacter": "undertaker" },
  { "id": "p2", "seat": 2, "name": "Monk", "actualCharacter": "monk", "shownCharacter": "monk" },
  { "id": "p3", "seat": 3, "name": "Ravenkeeper", "actualCharacter": "ravenkeeper", "shownCharacter": "ravenkeeper" },
  { "id": "p4", "seat": 4, "name": "Virgin", "actualCharacter": "virgin", "shownCharacter": "virgin" },
  { "id": "p5", "seat": 5, "name": "Slayer", "actualCharacter": "slayer", "shownCharacter": "slayer" },
  { "id": "p6", "seat": 6, "name": "Scarlet Woman", "actualCharacter": "scarletWoman", "shownCharacter": "scarletWoman" },
  { "id": "p7", "seat": 7, "name": "Imp", "actualCharacter": "imp", "shownCharacter": "imp" }
]"#;

    const SETUP_EVENT: &str = r#"{
  "id": "setup-1",
  "type": "setupConfirmed",
  "phase": "setup",
  "payload": { "players": [
    { "id": "p1", "seat": 1, "name": "Undertaker", "actualCharacter": "undertaker", "shownCharacter": "undertaker" },
    { "id": "p2", "seat": 2, "name": "Monk", "actualCharacter": "monk", "shownCharacter": "monk" },
    { "id": "p3", "seat": 3, "name": "Ravenkeeper", "actualCharacter": "ravenkeeper", "shownCharacter": "ravenkeeper" },
    { "id": "p4", "seat": 4, "name": "Virgin", "actualCharacter": "virgin", "shownCharacter": "virgin" },
    { "id": "p5", "seat": 5, "name": "Slayer", "actualCharacter": "slayer", "shownCharacter": "slayer" },
    { "id": "p6", "seat": 6, "name": "Scarlet Woman", "actualCharacter": "scarletWoman", "shownCharacter": "scarletWoman" },
    { "id": "p7", "seat": 7, "name": "Imp", "actualCharacter": "imp", "shownCharacter": "imp" }
  ] },
  "summary": "setup",
  "createdAt": "2026-09-07T00:00:00.000Z"
}"#;

    const EMPTY_GAME: &str = r#"{
  "schemaVersion": 2,
  "game": {
    "id": "game-1",
    "name": "Smoke",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z",
    "events": []
  }
}"#;

    #[test]
    fn wasm_adapter_preserves_the_custom_first_night_plan_contract() {
        let request = r#"{
      "customDefinition": {
        "id": "mixed",
        "name": "Mixed",
        "characterIds": ["philosopher", "poisoner", "imp"]
      }
    }"#;
        assert_eq!(
            custom_first_night_plan(request),
            clocktower_custom_domain::custom_first_night_plan_json(request),
        );
        assert!(custom_first_night_plan(request).contains(r#""actionId":"minionInfo""#));
    }

    #[test]
    fn wasm_adapter_create_and_replay_use_the_definition_owned_order() {
        let proposal = propose(
            &custom_game(CUSTOM_DEFINITION, "[]"),
            &format!(r#"{{"type":"createGame","payload":{{"players":{CUSTOM_PLAYERS}}}}}"#),
        );
        assert!(proposal.contains(r#""ok":true"#), "{proposal}");
        assert!(proposal.contains(r#""type":"setupConfirmed"#), "{proposal}");
        assert!(proposal.contains(r#""payload":{"players"#), "{proposal}");
        assert!(!proposal.contains("firstNightOrderPlan"), "{proposal}");

        let replayed = replay(&custom_game(CUSTOM_DEFINITION, &format!("[{SETUP_EVENT}]")));
        assert!(replayed.contains(r#""ok":true"#), "{replayed}");
        assert!(
            replayed.contains(r#""currentStep":{"id":"firstNight:system:demonInfo"#),
            "{replayed}"
        );
        assert!(
            !replayed.contains(r#""id":"firstNight:philosopher"#),
            "{replayed}"
        );
        assert!(
            !replayed.contains(r#""id":"firstNight:washerwoman"#),
            "{replayed}"
        );
        assert!(
            replayed.find(r#""id":"firstNight:system:demonInfo"#)
                < replayed.find(r#""id":"firstNight:system:minionInfo"#),
            "{replayed}"
        );
        assert!(
            replayed.find(r#""id":"firstNight:system:minionInfo"#)
                < replayed.find(r#""id":"firstNight:system:dawn"#),
            "{replayed}"
        );
    }

    #[test]
    fn wasm_adapter_rejects_legacy_order_fields_even_when_null() {
        for first_night_order_plan in [r#"[{"kind":"system","actionId":"dusk"}]"#, "null"] {
            let command = format!(
                r#"{{"type":"createGame","payload":{{"players":{CUSTOM_PLAYERS},"firstNightOrderPlan":{first_night_order_plan}}}}}"#
            );
            let command_result = propose(&custom_game(CUSTOM_DEFINITION, "[]"), &command);
            assert_error(&command_result, "MALFORMED_COMMAND");

            let event = format!(
                r#"{{"id":"setup-1","type":"setupConfirmed","phase":"setup","payload":{{"players":{CUSTOM_PLAYERS},"firstNightOrderPlan":{first_night_order_plan}}},"summary":"setup","createdAt":"2026-09-07T00:00:00.000Z"}}"#
            );
            let event_result = replay(&custom_game(CUSTOM_DEFINITION, &format!("[{event}]")));
            assert_error(&event_result, "MALFORMED_EVENT");
        }
    }

    #[test]
    fn wasm_adapter_rejects_invalid_definition_plans_and_roster_members() {
        let invalid_plans = [
            // Missing the complete-pool Chef action.
            r#"[
          {"kind":"system","actionId":"dusk"},
          {"kind":"system","actionId":"demonInfo"},
          {"kind":"character","characterId":"philosopher","actionId":"chooseAbility"},
          {"kind":"system","actionId":"minionInfo"},
          {"kind":"character","characterId":"washerwoman","actionId":"learnTownsfolk"},
          {"kind":"character","characterId":"librarian","actionId":"learnOutsider"},
          {"kind":"system","actionId":"dawn"}
        ]"#,
            // Duplicate system action.
            r#"[
          {"kind":"system","actionId":"dusk"},
          {"kind":"system","actionId":"dusk"},
          {"kind":"system","actionId":"demonInfo"},
          {"kind":"character","characterId":"philosopher","actionId":"chooseAbility"},
          {"kind":"system","actionId":"minionInfo"},
          {"kind":"character","characterId":"washerwoman","actionId":"learnTownsfolk"},
          {"kind":"character","characterId":"librarian","actionId":"learnOutsider"},
          {"kind":"character","characterId":"chef","actionId":"learnEvilPairs"},
          {"kind":"system","actionId":"dawn"}
        ]"#,
            // Unknown action reference.
            r#"[
          {"kind":"system","actionId":"dusk"},
          {"kind":"system","actionId":"demonInfo"},
          {"kind":"character","characterId":"notACharacter","actionId":"doSomething"},
          {"kind":"character","characterId":"philosopher","actionId":"chooseAbility"},
          {"kind":"system","actionId":"minionInfo"},
          {"kind":"character","characterId":"washerwoman","actionId":"learnTownsfolk"},
          {"kind":"character","characterId":"librarian","actionId":"learnOutsider"},
          {"kind":"character","characterId":"chef","actionId":"learnEvilPairs"},
          {"kind":"system","actionId":"dawn"}
        ]"#,
            // Known character with a mismatched action.
            r#"[
          {"kind":"system","actionId":"dusk"},
          {"kind":"system","actionId":"demonInfo"},
          {"kind":"character","characterId":"philosopher","actionId":"wrongAction"},
          {"kind":"system","actionId":"minionInfo"},
          {"kind":"character","characterId":"washerwoman","actionId":"learnTownsfolk"},
          {"kind":"character","characterId":"librarian","actionId":"learnOutsider"},
          {"kind":"character","characterId":"chef","actionId":"learnEvilPairs"},
          {"kind":"system","actionId":"dawn"}
        ]"#,
        ];
        for plan in invalid_plans {
            let definition = definition_with_plan(plan);
            let result = replay(&custom_game(&definition, "[]"));
            assert_error(&result, "INVALID_FIRST_NIGHT_ORDER_PLAN");
        }

        let out_of_pool_players = CUSTOM_PLAYERS.replace(
            r#""actualCharacter": "slayer""#,
            r#""actualCharacter": "soldier""#,
        );
        let command =
            format!(r#"{{"type":"createGame","payload":{{"players":{out_of_pool_players}}}}}"#);
        let result = propose(&custom_game(CUSTOM_DEFINITION, "[]"), &command);
        assert_error(&result, "CHARACTER_NOT_IN_SCRIPT");
    }

    #[test]
    fn wasm_adapter_rejects_wrong_first_night_provenance_and_order() {
        let wrong_provenance = r#"{
      "id": "phase-step-2",
      "type": "phaseStepConfirmed",
      "phase": "firstNight",
      "payload": {
        "stepId": "firstNight:system:demonInfo",
        "actionRef": { "kind": "system", "actionId": "minionInfo" },
        "input": { "characterIds": ["washerwoman", "librarian", "chef"] }
      },
      "summary": "wrong provenance",
      "createdAt": "2026-09-07T00:00:01.000Z"
    }"#;
        let result = replay(&custom_game(
            CUSTOM_DEFINITION,
            &format!("[{SETUP_EVENT},{wrong_provenance}]"),
        ));
        assert_error(&result, "INVALID_FIRST_NIGHT_ACTION_PROVENANCE");

        let wrong_order = r#"{
      "id": "phase-step-2",
      "type": "phaseStepConfirmed",
      "phase": "firstNight",
      "payload": {
        "stepId": "firstNight:system:minionInfo",
        "actionRef": { "kind": "system", "actionId": "minionInfo" },
        "input": null
      },
      "summary": "wrong order",
      "createdAt": "2026-09-07T00:00:01.000Z"
    }"#;
        let result = replay(&custom_game(
            CUSTOM_DEFINITION,
            &format!("[{SETUP_EVENT},{wrong_order}]"),
        ));
        assert_error(&result, "INVALID_FIRST_NIGHT_ACTION_PROVENANCE");
    }

    #[test]
    fn wasm_adapter_reports_missing_active_character_handlers_explicitly() {
        let definition = r#"{
      "id": "issue-198-active-handler",
      "name": "Issue 198 active handler",
      "characterIds": ["undertaker", "monk", "ravenkeeper", "virgin", "philosopher", "scarletWoman", "imp"],
      "firstNightOrder": [
        { "kind": "system", "actionId": "dusk" },
        { "kind": "character", "characterId": "philosopher", "actionId": "chooseAbility" },
        { "kind": "system", "actionId": "minionInfo" },
        { "kind": "system", "actionId": "demonInfo" },
        { "kind": "system", "actionId": "dawn" }
      ]
    }"#;
        let event = SETUP_EVENT
            .replace(
                r#""actualCharacter": "slayer""#,
                r#""actualCharacter": "philosopher""#,
            )
            .replace(r#""name": "Slayer""#, r#""name": "Philosopher""#)
            .replace(
                r#""shownCharacter": "slayer""#,
                r#""shownCharacter": "philosopher""#,
            );
        let result = replay(&custom_game(definition, &format!("[{event}]")));
        assert_error(&result, "FIRST_NIGHT_ACTION_HANDLER_UNAVAILABLE");
    }

    fn custom_game(definition: &str, events: &str) -> String {
        format!(
            r#"{{"schemaVersion":4,"game":{{"script":{{"type":"custom","definition":{definition}}},"id":"issue-198-game","name":"Issue 198 game","createdAt":"2026-09-07T00:00:00.000Z","updatedAt":"2026-09-07T00:00:00.000Z","events":{events}}}}}"#
        )
    }

    fn definition_with_plan(plan: &str) -> String {
        format!(
            r#"{{"id":"issue-198-definition","name":"Issue 198 definition","characterIds":["undertaker","monk","ravenkeeper","virgin","slayer","scarletWoman","imp","philosopher","washerwoman","librarian","chef"],"firstNightOrder":{plan}}}"#
        )
    }

    fn assert_error(response: &str, code: &str) {
        assert!(
            response.contains(r#""ok":false"#),
            "expected {code}: {response}"
        );
        assert!(
            response.contains(&format!(r#""code":"{code}"#)),
            "expected {code}: {response}"
        );
    }
}

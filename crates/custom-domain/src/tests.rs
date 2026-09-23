mod compatibility;
mod custom_first_night_fixture;
mod issue192_custom_game_file_contract_scenarios;
mod issue193_custom_script_registry_scenarios;
mod issue194_custom_setup_scenarios;
mod issue195_custom_first_night_scenarios;
mod issue195_first_night_runtime_contracts;
mod issue198_custom_definition_contract_scenarios;
mod issue206_custom_action_contracts;
mod issue206_custom_event_contracts;
#[cfg(feature = "custom-runtime-fixtures")]
mod issue206_custom_replay_scenarios;
mod issue206_custom_state_contracts;
mod issue206_night_scheduler_contracts;
#[cfg(not(feature = "custom-runtime-fixtures"))]
mod issue251_characters;

mod issue207_contracts;
mod issue207_rule_state;
mod issue207_scheduler;

#[cfg(not(feature = "custom-runtime-fixtures"))]
mod issue207_acquisition;

#[cfg(not(feature = "custom-runtime-fixtures"))]
mod issue207_acceptance;
#[cfg(not(feature = "custom-runtime-fixtures"))]
mod issue207_assignments;
mod issue207_impairments;
#[cfg(not(feature = "custom-runtime-fixtures"))]
mod issue207_information;
#[cfg(not(feature = "custom-runtime-fixtures"))]
mod issue207_mathematician;
#[cfg(not(feature = "custom-runtime-fixtures"))]
mod issue207_relationships;

mod issue208_contracts;

mod issue208_effects;
mod issue208_simulation;

mod issue208_scheduler;

#[cfg(not(feature = "custom-runtime-fixtures"))]
mod issue208_information;
#[cfg(not(feature = "custom-runtime-fixtures"))]
mod issue208_mutant;
mod issue208_preparations;
#[cfg(not(feature = "custom-runtime-fixtures"))]
mod issue208_twins;

#[cfg(not(feature = "custom-runtime-fixtures"))]
mod issue209_registry;

#[cfg(not(feature = "custom-runtime-fixtures"))]
mod issue220_action_dependencies;

mod issue223_day;

#[cfg(not(feature = "custom-runtime-fixtures"))]
mod issue223_reminders;

#[cfg(not(feature = "custom-runtime-fixtures"))]
mod issue225_nights;

/// Explicit test fixture order, independent of the production plan authoring implementation.
fn other_order_json(ids: &serde_json::Value) -> serde_json::Value {
    let catalog = [
        ("philosopher", "chooseAbility"),
        ("poisoner", "choosePoisonTarget"),
        ("snakeCharmer", "choosePlayer"),
        ("monk", "protectPlayer"),
        ("witch", "chooseCursedPlayer"),
        ("cerenovus", "assignMadness"),
        ("pitHag", "changeCharacter"),
        ("imp", "attackPlayer"),
        ("fangGu", "attackPlayer"),
        ("noDashii", "attackPlayer"),
        ("vortox", "attackPlayer"),
        ("vigormortis", "attackPlayer"),
        ("barber", "swapCharacters"),
        ("empath", "learnEvilNeighbors"),
        ("fortuneTeller", "checkDemon"),
        ("undertaker", "learnExecutedCharacter"),
        ("dreamer", "learnCharacters"),
        ("flowergirl", "learnDemonVoted"),
        ("townCrier", "learnMinionNominated"),
        ("oracle", "learnDeadEvilCount"),
        ("seamstress", "compareAlignments"),
        ("juggler", "learnJuggles"),
        ("butler", "chooseMaster"),
        ("spy", "inspectGrimoire"),
        ("mathematician", "learnCount"),
    ];
    let mut result = vec![serde_json::json!({"kind":"system","actionId":"dusk"})];
    for (character, action) in catalog {
        if ids
            .as_array()
            .is_some_and(|ids| ids.iter().any(|id| id == character))
        {
            result.push(
                serde_json::json!({"kind":"character","characterId":character,"actionId":action}),
            );
        }
    }
    result.push(serde_json::json!({"kind":"system","actionId":"dawn"}));
    serde_json::json!(result)
}

#[cfg(not(feature = "custom-runtime-fixtures"))]
mod issue213_jinxes;

#[cfg(not(feature = "custom-runtime-fixtures"))]
mod issue232_regressions;

#[cfg(not(feature = "custom-runtime-fixtures"))]
mod issue237_carousel;

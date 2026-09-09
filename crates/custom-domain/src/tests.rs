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

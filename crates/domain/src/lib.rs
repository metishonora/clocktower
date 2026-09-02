mod annotations;
mod boundary;
mod characters;
mod contracts;
mod day;
mod death;
mod error;
mod identity;
mod information;
mod messages;
mod model;
mod night;
mod phase;
mod proposal;
mod replay;
mod setup;
mod suggestion;

pub fn replay_json(game_file_json: &str) -> String {
    boundary::replay_json(game_file_json)
}

pub fn propose_json(game_file_json: &str, command_json: &str) -> String {
    boundary::propose_json(game_file_json, command_json)
}

pub fn setup_distribution_json(request_json: &str) -> String {
    boundary::setup_distribution_json(request_json)
}

pub fn suggest_phase_input_json(game_file_json: &str, request_json: &str) -> String {
    boundary::suggest_phase_input_json(game_file_json, request_json)
}

pub fn custom_script_catalog_json() -> String {
    serde_json::to_string(&characters::custom_script_catalog())
        .expect("custom script catalog serialization should not fail")
}

#[cfg(test)]
mod tests;

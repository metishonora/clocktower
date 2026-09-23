mod boundary;
mod characters;
mod contracts;
mod error;
mod event;
mod first_night;
mod game;
mod identity;
mod information;
mod input;
mod jinxes;
mod messages;
mod model;
mod night_deaths;
mod projection;
mod reducer;
mod reminders;
mod rules;
mod setup;
mod state;
pub fn replay_json(game: &str) -> String {
    boundary::replay_json(game)
}
pub fn propose_json(game: &str, command: &str) -> String {
    boundary::propose_json(game, command)
}
pub fn setup_distribution_json(request: &str) -> String {
    boundary::setup_distribution_json(request)
}
pub fn custom_first_night_plan_json(request: &str) -> String {
    boundary::custom_first_night_plan_json(request)
}
pub fn custom_script_catalog_json() -> String {
    serde_json::to_string(&characters::custom_script_catalog()).expect("catalog serialization")
}

/// Build-time metadata for characters supported only in the editor and reference document.
pub fn custom_reference_character_catalog_json() -> String {
    serde_json::to_string(characters::REFERENCE_CHARACTERS)
        .expect("reference catalog serialization")
}

#[cfg(test)]
mod tests;

mod effects;

mod simulation;

pub fn confirmed_event_reveal_json(game: &str, event_id: &str) -> String {
    boundary::to_json(
        boundary::parse_game_file(game)
            .and_then(|file| game::confirmed_event_reveal(file, event_id)),
    )
}

mod day;

/// Read-only authoring query; completed files must already carry the explicit order.
pub fn custom_other_night_plan_json(request: &str) -> String {
    boundary::custom_other_night_plan_json(request)
}

mod scenario_reference;
pub fn scenario_jinxes_json(request: &str) -> String {
    scenario_reference::query_json(request)
}

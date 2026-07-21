mod sects_and_violets;
mod trouble_brewing;

// This explicit list is the current script-rule seam used by the shared engine. Keep private
// helpers inside the script module and add S&V behavior through `ScriptRules`, not another
// wildcard export or script checks scattered through callers.
pub(crate) use trouble_brewing::{
    butler_vote_state, character_can_target_self, character_kind, character_required_input,
    character_steps, computed_information_result, demon_dead_without_successor, first_night_order,
    has_actual_outsider, imp_self_kill_successor_ids, is_townsfolk, is_valid_script_token,
    legal_demon_bluff_character_ids, legal_number_choices, mayor_decision_prompt,
    mayor_win_eligible, night_order, number_result_with_registration_judgments,
    phase_input_suggestion_pool, registration_candidate_player_ids, resolve_imp_attack,
    scarlet_woman_successor, setup_info_character_is_represented,
    setup_info_input_is_valid_impaired, setup_info_input_is_valid_normal,
    setup_info_input_is_valid_registration, setup_info_registration_options, slayer_registration,
    spy_grimoire_result, target_information_checks, validate_butler_voters, virgin_resolution,
};

use crate::{
    contracts::{Command, GameEvent, ScriptId},
    error::{CoreError, ErrorKind},
};

#[derive(Debug, Copy, Clone)]
pub(crate) enum ScriptRules {
    TroubleBrewing,
    SectsAndViolets,
}

pub(crate) fn rules(script_id: ScriptId) -> ScriptRules {
    match script_id {
        ScriptId::TroubleBrewing => ScriptRules::TroubleBrewing,
        ScriptId::SectsAndViolets => ScriptRules::SectsAndViolets,
    }
}

impl ScriptRules {
    pub(crate) fn validate_replay_events(self, events: &[GameEvent]) -> Result<(), CoreError> {
        match self {
            Self::TroubleBrewing => Ok(()),
            Self::SectsAndViolets if events.is_empty() => Ok(()),
            Self::SectsAndViolets => Err(ErrorKind::EventNotSupportedByScript.into_error()),
        }
    }

    pub(crate) fn validate_command(self, command: &Command) -> Result<(), CoreError> {
        match (self, command) {
            (Self::SectsAndViolets, Command::CreateGame { .. }) => {
                Err(ErrorKind::ScriptNotImplemented.into_error())
            }
            (Self::SectsAndViolets, _) => Err(ErrorKind::CommandNotSupportedByScript.into_error()),
            _ => Ok(()),
        }
    }

    pub(crate) fn setup_has_baron_adjustment(
        self,
        actual_characters: &[String],
    ) -> Result<bool, CoreError> {
        match self {
            Self::TroubleBrewing => Ok(actual_characters.iter().any(|id| id == "baron")),
            Self::SectsAndViolets if actual_characters.is_empty() => Ok(false),
            Self::SectsAndViolets => Err(ErrorKind::ScriptNotImplemented.into_error()),
        }
    }
}

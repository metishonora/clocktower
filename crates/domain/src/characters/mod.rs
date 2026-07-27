mod sects_and_violets;
mod trouble_brewing;

pub(crate) use sects_and_violets::{
    propose_phase_command as propose_snv_phase_command, replay as replay_snv,
};

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
    contracts::{Command, GameEvent, GameEventKind, ScriptId, SetupDistribution},
    error::{CoreError, ErrorKind},
    model::CharacterKind,
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
            Self::SectsAndViolets
                if events.iter().all(|event| {
                    matches!(
                        event.kind,
                        GameEventKind::SetupConfirmed { .. }
                            | GameEventKind::PhaseStepConfirmed { .. }
                            | GameEventKind::ManualPhaseStepResolved { .. }
                            | GameEventKind::NightActionResolved { .. }
                            | GameEventKind::NightDeathsAnnounced { .. }
                            | GameEventKind::NominationStarted { .. }
                            | GameEventKind::NominationVoteConfirmed { .. }
                            | GameEventKind::PhaseStepSkipped { .. }
                            | GameEventKind::ExecutionConfirmed { .. }
                            | GameEventKind::NoExecutionConfirmed { .. }
                            | GameEventKind::DeathConfirmed { .. }
                            | GameEventKind::SnakeCharmerActionResolved { .. }
                            | GameEventKind::PlayerTransitioned { .. }
                            | GameEventKind::PlayerAnnotationsUpdated { .. }
                            | GameEventKind::DayActionRecorded { .. }
                            | GameEventKind::MadnessAssigned { .. }
                            | GameEventKind::MadnessCheckRecorded { .. }
                            | GameEventKind::MadnessExecutionConfirmed { .. }
                    )
                }) =>
            {
                Ok(())
            }
            Self::SectsAndViolets => Err(ErrorKind::EventNotSupportedByScript.into_error()),
        }
    }

    pub(crate) fn validate_command(self, command: &Command) -> Result<(), CoreError> {
        match (self, command) {
            (
                Self::SectsAndViolets,
                Command::CreateGame { .. }
                | Command::ConfirmStep { .. }
                | Command::SkipStep { .. }
                | Command::ResolveManualStep { .. }
                | Command::RecordDayAction { .. }
                | Command::RecordMadnessCheck { .. }
                | Command::ExecuteMadness { .. },
            ) => Ok(()),
            (Self::SectsAndViolets, _) => Err(ErrorKind::CommandNotSupportedByScript.into_error()),
            _ => Ok(()),
        }
    }

    pub(crate) fn minimum_player_count(self) -> usize {
        match self {
            Self::TroubleBrewing => 5,
            Self::SectsAndViolets => 7,
        }
    }

    pub(crate) fn character_kind(self, character: &str) -> Option<CharacterKind> {
        match self {
            Self::TroubleBrewing => trouble_brewing::character_kind(character),
            Self::SectsAndViolets => sects_and_violets::character_kind(character),
        }
    }

    pub(crate) fn is_townsfolk(self, character: &str) -> bool {
        self.character_kind(character) == Some(CharacterKind::Townsfolk)
    }

    pub(crate) fn adjust_setup_distribution(
        self,
        base: SetupDistribution,
        actual_characters: &[String],
    ) -> SetupDistribution {
        match self {
            Self::TroubleBrewing
                if actual_characters
                    .iter()
                    .any(|character| character == "baron") =>
            {
                SetupDistribution {
                    townsfolk: base.townsfolk.saturating_sub(2),
                    outsider: base.outsider + 2,
                    ..base
                }
            }
            Self::SectsAndViolets => {
                let has_fang_gu = actual_characters
                    .iter()
                    .any(|character| character == "fangGu");
                let vigormortis_removes_outsider = base.outsider > 0
                    && actual_characters
                        .iter()
                        .any(|character| character == "vigormortis");
                SetupDistribution {
                    townsfolk: base.townsfolk + usize::from(vigormortis_removes_outsider)
                        - usize::from(has_fang_gu),
                    outsider: base.outsider + usize::from(has_fang_gu)
                        - usize::from(vigormortis_removes_outsider),
                    ..base
                }
            }
            _ => base,
        }
    }
}

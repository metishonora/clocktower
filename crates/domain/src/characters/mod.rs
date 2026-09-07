mod bad_moon_rising;
pub(crate) mod registry;
mod sects_and_violets;
mod trouble_brewing;

pub(crate) use registry::{
    custom_demon_bluff_character_ids, custom_script_catalog, resolve_custom_script,
    resolve_custom_script_ids, validate_custom_script_definition,
    validate_custom_script_definition_draft, ResolvedScriptContext,
};

#[cfg(test)]
pub(crate) use registry::{
    custom_ability_acquisition_character_ids, custom_transformation_character_ids,
};

#[cfg(test)]
pub(crate) use sects_and_violets::{
    ability_state_build_count as snv_ability_state_build_count,
    event_application_count as snv_event_application_count,
    phase_step_build_count as snv_phase_step_build_count,
    replay_player_pass_count as snv_replay_player_pass_count,
    reset_ability_state_build_count as reset_snv_ability_state_build_count,
    reset_event_application_count as reset_snv_event_application_count,
    reset_phase_step_build_count as reset_snv_phase_step_build_count,
    reset_replay_player_pass_count as reset_snv_replay_player_pass_count,
};
// This explicit list is the current script-rule seam used by the shared engine. Keep private
// helpers inside the script module and add S&V behavior through `ScriptRules`, not another
// wildcard export or script checks scattered through callers.
pub(crate) use trouble_brewing::step_key::{TbPhaseKey, TbSemanticStep, TbStepKey};
pub(crate) use trouble_brewing::TbCharacterId;
pub(crate) use trouble_brewing::{
    active_rule_effects, automatic_reminders, butler_vote_state, character_can_target_self,
    character_kind, character_required_input, character_steps, computed_information_result,
    counted_butler_voter_ids, demon_dead_without_successor, first_night_order, has_actual_outsider,
    imp_self_kill_successor_ids, is_townsfolk, is_valid_script_token,
    legal_demon_bluff_character_ids, legal_number_choices, mayor_decision_prompt,
    mayor_win_eligible, night_order, number_result_with_registration_judgments,
    registration_candidate_player_ids, resolve_imp_attack, scarlet_woman_successor,
    setup_info_character_is_represented, setup_info_input_is_valid_impaired,
    setup_info_input_is_valid_normal, setup_info_input_is_valid_registration,
    setup_info_registration_options, slayer_can_use_on_day_step, slayer_registration,
    spy_grimoire_result, target_information_checks, virgin_resolution,
};

use crate::{
    contracts::{
        Command, GameEvent, GameEventKind, GameFile, Proposal, ReplayState, ScriptId,
        SetupDistribution, SetupDistributionResult,
    },
    error::{CoreError, ErrorKind},
    model::CharacterKind,
};

#[derive(Debug, Copy, Clone)]
pub(crate) enum ScriptRules {
    TroubleBrewing,
    SectsAndViolets,
    BadMoonRising,
}

pub(crate) fn rules(script_id: ScriptId) -> ScriptRules {
    match script_id {
        ScriptId::TroubleBrewing => ScriptRules::TroubleBrewing,
        ScriptId::SectsAndViolets => ScriptRules::SectsAndViolets,
        ScriptId::BadMoonRising => ScriptRules::BadMoonRising,
    }
}

impl ScriptRules {
    pub(crate) fn replay(self, game_file: GameFile) -> Result<ReplayState, CoreError> {
        match self {
            Self::TroubleBrewing => crate::replay::replay_trouble_brewing(game_file),
            Self::SectsAndViolets => sects_and_violets::replay(game_file),
            Self::BadMoonRising => bad_moon_rising::replay(game_file),
        }
    }

    pub(crate) fn propose(
        self,
        game_file: &GameFile,
        command: Command,
    ) -> Result<Proposal, CoreError> {
        match (self, command) {
            (_, Command::CreateGame { payload }) => {
                crate::proposal::propose_create_game(game_file, payload)
            }
            (Self::TroubleBrewing, command) => {
                crate::proposal::propose_trouble_brewing(game_file, command)
            }
            (Self::SectsAndViolets, command) => {
                sects_and_violets::propose_phase_command(game_file, command)
            }
            (Self::BadMoonRising, command) => {
                bad_moon_rising::propose_phase_command(game_file, command)
            }
        }
    }

    pub(crate) fn validate_replay_events(self, events: &[GameEvent]) -> Result<(), CoreError> {
        if !matches!(self, Self::BadMoonRising)
            && events.iter().any(|event| {
                matches!(
                    &event.kind,
                    GameEventKind::SetupConfirmed { payload }
                        if payload.setup_choice_id.is_some()
                )
            })
        {
            return Err(ErrorKind::EventNotSupportedByScript.into_error());
        }
        if events.iter().any(|event| {
            matches!(
                &event.kind,
                GameEventKind::PhaseStepConfirmed { payload }
                    if payload.action_ref.is_some() || payload.ability_use.is_some()
            )
        }) {
            return Err(ErrorKind::EventNotSupportedByScript.into_error());
        }

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
                            | GameEventKind::WitchCurseAssigned { .. }
                            | GameEventKind::EvilTwinPairAssigned { .. }
                            | GameEventKind::NominationVoteConfirmed { .. }
                            | GameEventKind::PhaseStepSkipped { .. }
                            | GameEventKind::PhilosopherAbilityResolved { .. }
                            | GameEventKind::ExecutionConfirmed { .. }
                            | GameEventKind::NoExecutionConfirmed { .. }
                            | GameEventKind::DeathConfirmed { .. }
                            | GameEventKind::OrderedDeathResolved { .. }
                            | GameEventKind::SnakeCharmerActionResolved { .. }
                            | GameEventKind::PitHagTransformationResolved { .. }
                            | GameEventKind::PitHagArbitraryDeathsConfirmed { .. }
                            | GameEventKind::PlayerTransitioned { .. }
                            | GameEventKind::PlayerAnnotationsUpdated { .. }
                            | GameEventKind::DayActionRecorded { .. }
                            | GameEventKind::MadnessAssigned { .. }
                            | GameEventKind::MadnessCheckRecorded { .. }
                            | GameEventKind::MadnessExecutionConfirmed { .. }
                            | GameEventKind::VigormortisPoisonTargetChanged { .. }
                            | GameEventKind::SweetheartConsequenceResolved { .. }
                            | GameEventKind::BarberConsequenceResolved { .. }
                            | GameEventKind::KlutzChoiceResolved { .. }
                            | GameEventKind::GameEnded { .. }
                    )
                }) =>
            {
                Ok(())
            }
            Self::SectsAndViolets => Err(ErrorKind::EventNotSupportedByScript.into_error()),
            Self::BadMoonRising
                if events.iter().all(|event| {
                    matches!(
                        event.kind,
                        GameEventKind::SetupConfirmed { .. }
                            | GameEventKind::PhaseStepConfirmed { .. }
                            | GameEventKind::ManualPhaseStepResolved { .. }
                            | GameEventKind::PhaseStepSkipped { .. }
                            | GameEventKind::ExecutionConfirmed { .. }
                            | GameEventKind::OrderedDeathResolved { .. }
                    )
                }) =>
            {
                Ok(())
            }
            Self::BadMoonRising => Err(ErrorKind::EventNotSupportedByScript.into_error()),
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
                | Command::ExecuteMadness { .. }
                | Command::ResolveVigormortisPoison { .. }
                | Command::ResolveSweetheartConsequence { .. }
                | Command::ResolveBarberConsequence { .. }
                | Command::ResolveKlutzConsequence { .. }
                | Command::EndGame { .. },
            ) => Ok(()),
            (Self::SectsAndViolets, _) => Err(ErrorKind::CommandNotSupportedByScript.into_error()),
            (
                Self::BadMoonRising,
                Command::CreateGame { .. }
                | Command::ConfirmStep { .. }
                | Command::SkipStep { .. }
                | Command::ResolveManualStep { .. },
            ) => Ok(()),
            (Self::BadMoonRising, _) => Err(ErrorKind::CommandNotSupportedByScript.into_error()),
            _ => Ok(()),
        }
    }

    pub(crate) fn minimum_player_count(self) -> usize {
        match self {
            Self::TroubleBrewing => 5,
            Self::SectsAndViolets | Self::BadMoonRising => 7,
        }
    }

    pub(crate) fn character_kind(self, character: &str) -> Option<CharacterKind> {
        match self {
            Self::TroubleBrewing => trouble_brewing::character_kind(character),
            Self::SectsAndViolets => sects_and_violets::character_kind(character),
            Self::BadMoonRising => bad_moon_rising::character_kind(character),
        }
    }

    pub(crate) fn is_townsfolk(self, character: &str) -> bool {
        self.character_kind(character) == Some(CharacterKind::Townsfolk)
    }

    pub(crate) fn is_demon(self, character: &str) -> bool {
        self.character_kind(character) == Some(CharacterKind::Demon)
    }

    pub(crate) fn phase_input_suggestion_pool(
        self,
        step: &crate::model::PhaseStep,
        players: &[crate::model::Player],
        impaired: bool,
    ) -> Vec<crate::model::StepInput> {
        match self {
            Self::TroubleBrewing => {
                trouble_brewing::phase_input_suggestion_pool(step, players, impaired)
            }
            Self::SectsAndViolets => sects_and_violets::phase_input_suggestion_pool(step, players),
            Self::BadMoonRising => vec![],
        }
    }

    pub(crate) fn setup_distribution_result(
        self,
        base: SetupDistribution,
        actual_characters: &[String],
    ) -> SetupDistributionResult {
        match self {
            Self::BadMoonRising => {
                bad_moon_rising::setup_distribution_result(base, actual_characters)
            }
            _ => SetupDistributionResult::Distribution(
                self.adjust_setup_distribution(base, actual_characters),
            ),
        }
    }

    pub(crate) fn selected_setup_distribution(
        self,
        base: SetupDistribution,
        actual_characters: &[String],
        setup_choice_id: Option<&str>,
    ) -> Result<SetupDistribution, CoreError> {
        match self {
            Self::BadMoonRising => bad_moon_rising::selected_setup_distribution(
                base,
                actual_characters,
                setup_choice_id,
            ),
            _ if setup_choice_id.is_some() => Err(ErrorKind::InvalidSetupChoice.into_error()),
            _ => Ok(self.adjust_setup_distribution(base, actual_characters)),
        }
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
            Self::BadMoonRising => base,
            _ => base,
        }
    }
}

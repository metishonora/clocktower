//! Typed daytime input and event evidence. Nothing here is a generic state patch.
use crate::{
    contracts::ActiveImpairment,
    model::{AbilityUseRef, Alignment, CharacterKind},
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) enum DayStage {
    Announcement,
    Whisper,
    Discussion,
    Nomination,
    Voting,
    Execution,
    ExecutionDeath,
    Death,
    NightReady,
    Night,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub(crate) enum DayInput {
    Advance,
    Nominate {
        nominator_id: String,
        nominee_id: String,
        #[serde(default)]
        spy_as_townsfolk: bool,
    },
    Vote {
        voter_ids: Vec<String>,
    },
    CloseNominations,
    ConfirmExecution {},
    ConfirmDeath,
    BeginNight,
    UseAbility {
        action_id: String,
        record: DayAbilityInput,
    },
    CheckMadness {
        assignment_id: String,
        violation: bool,
    },
    ExecuteMadness {
        assignment_id: String,
    },
    ResolveConsequence {
        consequence_id: String,
        player_id: Option<String>,
    },
    ConfirmGameEnd,
    EndGame {
        winning_alignment: Alignment,
    },
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct DayCommand {
    pub(crate) step_id: String,
    pub(crate) expected_event_count: usize,
    pub(crate) input: DayInput,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct DayParticipant {
    pub(crate) player_id: String,
    pub(crate) character_id: String,
    pub(crate) alignment: Alignment,
    pub(crate) character_kind: CharacterKind,
    pub(crate) alive: bool,
    pub(crate) ghost_vote_used: bool,
    pub(crate) abilities: Vec<AbilityUseRef>,
    pub(crate) impairments: Vec<ActiveImpairment>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct DayOutcome {
    pub(crate) stage: DayStage,
    pub(crate) participants: Vec<DayParticipant>,
    pub(crate) counted_voter_ids: Vec<String>,
    pub(crate) ghost_vote_spent_player_ids: Vec<String>,
    pub(crate) death_player_ids: Vec<String>,
    pub(crate) ability_record: Option<DayAbilityRecord>,
    pub(crate) pending_death: Option<PendingDayDeath>,
    pub(crate) pending_game_end: Option<crate::contracts::CustomGameEnd>,
    pub(crate) consequences: Vec<DayConsequence>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct DayConfirmed {
    pub(crate) step_id: String,
    pub(crate) day: u32,
    pub(crate) input: DayInput,
    pub(crate) result: DayOutcome,
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NominationRecord {
    pub(crate) event_id: String,
    pub(crate) nominator_id: String,
    pub(crate) nominee_id: String,
    pub(crate) nomination_participants: Vec<DayParticipant>,
    pub(crate) vote_participants: Option<Vec<DayParticipant>>,
    pub(crate) voter_ids: Option<Vec<String>>,
    pub(crate) counted_voter_ids: Option<Vec<String>>,
    pub(crate) ghost_vote_spent_player_ids: Vec<String>,
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ExecutionRecord {
    pub(crate) event_id: String,
    pub(crate) player_id: Option<String>,
    pub(crate) death_event_id: Option<String>,
    pub(crate) died: bool,
}
#[derive(Debug, Clone)]
pub(crate) struct DayHistoryEntry {
    pub(crate) event_id: String,
    pub(crate) step_id: String,
    pub(crate) root_event_id: String,
}
#[derive(Debug, Clone)]
pub(crate) struct DayProgress {
    pub(crate) day: u32,
    pub(crate) stage: DayStage,
    pub(crate) nominations: Vec<NominationRecord>,
    pub(crate) execution: Option<ExecutionRecord>,
    pub(crate) history: Vec<DayHistoryEntry>,
    pub(crate) pending_death: Option<PendingDayDeath>,
    pub(crate) pending_game_end: Option<crate::contracts::CustomGameEnd>,
    pub(crate) ability_records: Vec<DayAbilityRecord>,
    pub(crate) madness_checks: Vec<(String, bool)>,
    pub(crate) consequences: Vec<DayConsequence>,
    pub(crate) deaths: Vec<DayDeathRecord>,
}
impl DayProgress {
    pub(crate) fn new(day: u32) -> Self {
        Self {
            day,
            stage: DayStage::Announcement,
            nominations: vec![],
            execution: None,
            history: vec![],
            pending_death: None,
            pending_game_end: None,
            ability_records: vec![],
            madness_checks: vec![],
            consequences: vec![],
            deaths: vec![],
        }
    }
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DayView {
    pub(crate) vote_dependencies: Vec<DayVoteDependency>,
    pub(crate) townsfolk_registration_nominator_ids: Vec<String>,
    pub(crate) first_nomination_target_ids: Vec<String>,
    pub(crate) demon_registration_target_ids: Vec<String>,
    pub(crate) available_actions: Vec<DayAbilityAction>,
    pub(crate) ability_records: Vec<DayAbilityRecord>,
    pub(crate) madness: Vec<DayMadness>,
    pub(crate) pending_death: Option<PendingDayDeath>,
    pub(crate) pending_game_end: Option<crate::contracts::CustomGameEnd>,
    pub(crate) consequences: Vec<DayConsequence>,
    pub(crate) deaths: Vec<DayDeathRecord>,
    pub(crate) day: u32,
    pub(crate) stage: DayStage,
    pub(crate) step_id: String,
    pub(crate) nominations: Vec<NominationRecord>,
    pub(crate) execution: Option<ExecutionRecord>,
    pub(crate) eligible_nominator_ids: Vec<String>,
    pub(crate) eligible_nominee_ids: Vec<String>,
    pub(crate) eligible_voter_ids: Vec<String>,
    pub(crate) execution_vote_threshold: usize,
    pub(crate) highest_vote_count: usize,
    pub(crate) execution_candidate_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub(crate) enum DayAbilityInput {
    Artist {
        question: String,
        answer: ArtistAnswer,
        truthful: bool,
    },
    Savant {
        statements: [DayStatement; 2],
    },
    Juggler {
        correct_count: u8,
    },
    Slayer {
        target_player_id: String,
        recluse_as_demon: bool,
    },
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ArtistAnswer {
    Yes,
    No,
    Unknown,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct DayStatement {
    pub(crate) text: String,
    pub(crate) truthful: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct DayAbilityAction {
    pub(crate) id: String,
    pub(crate) actor_player_id: String,
    pub(crate) character_id: String,
    pub(crate) ability_use: Option<AbilityUseRef>,
    pub(crate) simulation_source: Option<crate::contracts::PhilosopherSimulationSource>,
    pub(crate) effective: bool,
    pub(crate) impaired: bool,
    pub(crate) vortox: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct DayAbilityRecord {
    pub(crate) event_id: String,
    pub(crate) day: u32,
    pub(crate) action: DayAbilityAction,
    pub(crate) record: DayAbilityInput,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) enum DayDeathCause {
    Execution,
    Virgin,
    Madness,
    Witch,
    Slayer,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct PendingDayDeath {
    pub(crate) player_id: String,
    pub(crate) cause: DayDeathCause,
    pub(crate) source: Option<AbilityUseRef>,
    pub(crate) root_event_id: String,
    pub(crate) resume_stage: DayStage,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct DayDeathRecord {
    pub(crate) event_id: String,
    pub(crate) day: u32,
    pub(crate) cause: PendingDayDeath,
    pub(crate) participant: DayParticipant,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct DayConsequence {
    pub(crate) id: String,
    pub(crate) death_event_id: String,
    pub(crate) source: AbilityUseRef,
    pub(crate) impaired_at_death: bool,
    pub(crate) alignment_at_death: Alignment,
    pub(crate) resolved: bool,
    pub(crate) target_player_id: Option<String>,
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DayMadness {
    pub(crate) id: String,
    pub(crate) source: AbilityUseRef,
    pub(crate) target_player_id: String,
    pub(crate) character_id: Option<String>,
    pub(crate) effective: bool,
    pub(crate) violation: Option<bool>,
    pub(crate) can_check: bool,
    pub(crate) can_execute: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DayVoteDependency {
    pub(crate) voter_id: String,
    pub(crate) required_voter_id: String,
}

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Copy, Clone)]
pub(crate) enum Phase {
    #[serde(rename = "setup")]
    Setup,
    #[serde(rename = "firstNight")]
    FirstNight,
    #[serde(rename = "day")]
    Day,
    #[serde(rename = "night")]
    Night,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Copy, Clone)]
pub(crate) enum StepType {
    #[serde(rename = "evilInfo")]
    EvilInfo,
    #[serde(rename = "character")]
    Character,
    #[serde(rename = "phaseTransition")]
    PhaseTransition,
    #[serde(rename = "announcement")]
    Announcement,
    #[serde(rename = "nomination")]
    Nomination,
    #[serde(rename = "execution")]
    Execution,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Copy, Clone)]
pub(crate) enum RequiredInputKind {
    #[serde(rename = "none")]
    None,
    #[serde(rename = "playerIds")]
    PlayerIds,
    #[serde(rename = "characterIds")]
    CharacterIds,
    #[serde(rename = "setupInfo")]
    SetupInfo,
    #[serde(rename = "number")]
    Number,
    #[serde(rename = "nominationVote")]
    NominationVote,
    #[serde(rename = "executionDecision")]
    ExecutionDecision,
    #[serde(rename = "day")]
    Day,
    #[serde(rename = "night")]
    Night,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Copy, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) enum InputTarget {
    Player,
    Players,
    Characters,
    SetupInfo,
    Number,
    Nomination,
    Execution,
    Phase,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Copy, Clone)]
#[serde(rename_all = "lowercase")]
pub(crate) enum NumericReason {
    Drunk,
    Poisoned,
    Registration,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub(crate) enum InformationResult {
    Number {
        value: usize,
    },
    SetupInfo {
        player_ids: Vec<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        character_id: Option<String>,
        zero_outsiders: bool,
    },
    TeamInfo {
        demon_player_ids: Vec<String>,
        minion_player_ids: Vec<String>,
        bluff_character_ids: Vec<String>,
    },
    SpyGrimoire {
        players: Vec<InformationPlayer>,
    },
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct InformationPlayer {
    pub(crate) player_id: String,
    pub(crate) seat: u8,
    pub(crate) name: String,
    pub(crate) character_id: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Copy, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) enum RegistrationValue {
    Good,
    Evil,
    Townsfolk,
    Outsider,
    Minion,
    Demon,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RegistrationJudgment {
    pub(crate) player_id: String,
    pub(crate) registered_as: RegistrationValue,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct InformationActor {
    pub(crate) player_id: String,
    pub(crate) character_id: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub(crate) enum DeliveryReason {
    Drunk,
    Poisoned {
        poisoner_player_id: String,
        poison_event_id: String,
    },
    RegistrationJudgment {
        judgments: Vec<RegistrationJudgment>,
    },
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[serde(tag = "type", rename_all = "camelCase")]
pub(crate) enum DeliveryContext {
    Fixed,
    Discretionary { reasons: Vec<DeliveryReason> },
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ConfirmedInformation {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) actor: Option<InformationActor>,
    pub(crate) target_player_ids: Vec<String>,
    pub(crate) computed_result: InformationResult,
    pub(crate) delivered_result: InformationResult,
    pub(crate) delivery_context: DeliveryContext,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Copy, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) enum InformationDeliveryMode {
    Fixed,
    Selectable,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct InformationPrompt {
    pub(crate) computed_result: InformationResult,
    pub(crate) delivery_mode: InformationDeliveryMode,
    pub(crate) active_reasons: Vec<DeliveryReason>,
    pub(crate) registration_candidate_player_ids: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Copy, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) enum SetupInfoKind {
    Washerwoman,
    Librarian,
    Investigator,
}

pub(crate) type StepInput = Option<StepInputFields>;

#[derive(Debug, Default, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StepInputFields {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) player_ids: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) character_ids: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) character_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) zero_outsiders: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) value: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) true_value: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) displayed_value: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) reason: Option<Option<NumericReason>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) nominator_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) nominee_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) voter_ids: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) execute: Option<bool>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PhaseStep {
    pub(crate) id: String,
    pub(crate) phase: Phase,
    pub(crate) step_type: StepType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) character: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) player_id: Option<String>,
    pub(crate) required_input: RequiredInput,
    pub(crate) can_skip: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) information_prompt: Option<InformationPrompt>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RequiredInput {
    pub(crate) kind: RequiredInputKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) target: Option<InputTarget>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) min_selections: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) max_selections: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) setup_info: Option<SetupInfoKind>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) character_kind: Option<CharacterKind>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) allowed_character_ids: Option<Vec<String>>,
    #[serde(skip_serializing_if = "is_false")]
    pub(crate) zero_allowed: bool,
    pub(crate) optional: bool,
}

fn is_false(value: &bool) -> bool {
    !*value
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PhaseOverviewItem {
    pub(crate) id: String,
    pub(crate) phase: Phase,
    pub(crate) step_type: StepType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) character: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) player_id: Option<String>,
    pub(crate) required_input: RequiredInput,
    pub(crate) can_skip: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) information_prompt: Option<InformationPrompt>,
    pub(crate) status: PhaseStepStatus,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NominationVoteInput {
    pub(crate) nominator_id: String,
    pub(crate) nominee_id: String,
    pub(crate) voter_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ExecutionDecisionInput {
    pub(crate) execute: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DayState {
    pub(crate) nominations: Vec<NominationRecord>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) execution_candidate: Option<ExecutionCandidate>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) confirmed_execution: Option<ConfirmedExecution>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NominationRecord {
    pub(crate) step_id: String,
    pub(crate) nominator_id: String,
    pub(crate) nominee_id: String,
    pub(crate) voter_ids: Vec<String>,
    pub(crate) vote_count: usize,
    pub(crate) ghost_vote_spent_player_ids: Vec<String>,
    pub(crate) updates_execution_candidate: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ExecutionCandidate {
    pub(crate) nominee_id: String,
    pub(crate) vote_count: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ConfirmedExecution {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) player_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Player {
    pub(crate) id: String,
    pub(crate) seat: u8,
    pub(crate) name: String,
    pub(crate) actual_character: String,
    pub(crate) shown_character: String,
    pub(crate) alignment: Alignment,
    pub(crate) alive: bool,
    pub(crate) ghost_vote_used: bool,
    pub(crate) death_announced: bool,
    pub(crate) notes: String,
}

#[derive(Debug, Serialize, PartialEq, Eq, Copy, Clone)]
#[serde(rename_all = "lowercase")]
pub(crate) enum Alignment {
    Good,
    Evil,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CoreWarning {
    pub(crate) code: String,
    pub(crate) severity: &'static str,
    pub(crate) message_ko: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Copy, Clone)]
#[serde(rename_all = "PascalCase")]
pub(crate) enum CharacterKind {
    Townsfolk,
    Outsider,
    Minion,
    Demon,
}

impl CharacterKind {
    pub(crate) fn alignment(self) -> Alignment {
        match self {
            CharacterKind::Townsfolk | CharacterKind::Outsider => Alignment::Good,
            CharacterKind::Minion | CharacterKind::Demon => Alignment::Evil,
        }
    }
}

#[derive(Debug, Serialize, Copy, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) enum PhaseStepStatus {
    Waiting,
    Current,
    Complete,
    Skipped,
    NeedsFollowUp,
}

impl PhaseStepStatus {
    pub(crate) fn is_done(self) -> bool {
        matches!(self, PhaseStepStatus::Complete | PhaseStepStatus::Skipped)
    }
}

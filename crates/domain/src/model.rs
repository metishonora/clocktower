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
    #[serde(rename = "whisper")]
    Whisper,
    #[serde(rename = "discussion")]
    Discussion,
    #[serde(rename = "nomination")]
    Nomination,
    #[serde(rename = "execution")]
    Execution,
    #[serde(rename = "executionDeath")]
    ExecutionDeath,
    #[serde(rename = "slayerDeath")]
    SlayerDeath,
    #[serde(rename = "demonSuccession")]
    DemonSuccession,
    #[serde(rename = "redHerringAssignment")]
    RedHerringAssignment,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Copy, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) enum PhaseStepSupport {
    Automated,
    Manual,
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
    #[serde(rename = "nomination")]
    Nomination,
    #[serde(rename = "executionDecision")]
    ExecutionDecision,
    #[serde(rename = "executionDeathDecision")]
    ExecutionDeathDecision,
    #[serde(rename = "slayerDeathDecision")]
    SlayerDeathDecision,
    #[serde(rename = "demonSuccession")]
    DemonSuccession,
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
    Boolean {
        value: bool,
    },
    Character {
        character_id: String,
    },
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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) alive: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) ghost_vote_used: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) reminder_tokens: Option<Vec<SpyReminderToken>>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Copy, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) enum SpyReminderToken {
    Poisoned,
    Protected,
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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) character_id: Option<String>,
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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) computed_result: Option<InformationResult>,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) computed_result: Option<InformationResult>,
    pub(crate) delivery_mode: InformationDeliveryMode,
    pub(crate) active_reasons: Vec<DeliveryReason>,
    pub(crate) registration_candidate_player_ids: Vec<String>,
    pub(crate) number_choices: Vec<NumberInformationChoice>,
    pub(crate) setup_info_registration_options: Vec<SetupInfoRegistrationOption>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub(crate) target_checks: Vec<TargetInformationCheck>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TargetInformationCheck {
    pub(crate) target_player_ids: Vec<String>,
    pub(crate) computed_result: InformationResult,
    pub(crate) choices: Vec<TargetInformationChoice>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TargetInformationChoice {
    pub(crate) result: InformationResult,
    pub(crate) is_computed: bool,
    pub(crate) registration_judgments: Vec<RegistrationJudgment>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NumberInformationChoice {
    pub(crate) value: usize,
    pub(crate) is_computed: bool,
    pub(crate) registration_judgments: Vec<RegistrationJudgment>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SetupInfoRegistrationOption {
    pub(crate) player_id: String,
    pub(crate) registered_as: RegistrationValue,
    pub(crate) character_ids: Vec<String>,
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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) died: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) mayor_decision: Option<MayorDecisionInput>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) successor_player_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub(crate) enum MayorDecisionInput {
    MayorDies,
    Bounce { target_player_id: String },
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
    pub(crate) support: PhaseStepSupport,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) information_prompt: Option<InformationPrompt>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) pre_action_reveal: Option<PreActionReveal>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PreActionReveal {
    pub(crate) kind: &'static str,
    pub(crate) source_event_id: String,
    pub(crate) player_id: String,
    pub(crate) alignment: &'static str,
    pub(crate) character_id: &'static str,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) allowed_player_ids: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) player_registration_options: Option<Vec<RegistrationJudgment>>,
    #[serde(skip_serializing_if = "is_false")]
    pub(crate) zero_allowed: bool,
    #[serde(skip_serializing_if = "is_false")]
    pub(crate) supports_random_suggestion: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) player_id: Option<String>,
    #[serde(rename = "survivalAllowed", skip_serializing_if = "Option::is_none")]
    pub(crate) survival_allowed: Option<bool>,
    #[serde(skip_serializing_if = "is_false")]
    pub(crate) execution_survival_allowed: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) mayor_decision: Option<MayorDecisionPrompt>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) demon_succession: Option<DemonSuccessionPrompt>,
    pub(crate) optional: bool,
}

#[derive(Debug, Serialize, Clone)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub(crate) enum DemonSuccessionPrompt {
    Fixed {
        trigger_event_id: String,
        successor_player_id: String,
    },
    Selectable {
        trigger_event_id: String,
        allowed_player_ids: Vec<String>,
    },
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MayorDecisionPrompt {
    pub(crate) mayor_player_id: String,
    pub(crate) bounce_target_player_ids: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SlayerAbilityState {
    pub(crate) actor_player_id: String,
    pub(crate) spent: bool,
    pub(crate) can_use_now: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct VirginAbilityState {
    pub(crate) actor_player_id: String,
    pub(crate) spent: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) spent_by_nomination_event_id: Option<String>,
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
    pub(crate) support: PhaseStepSupport,
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
pub(crate) struct NominationInput {
    pub(crate) nominator_id: String,
    pub(crate) nominee_id: String,
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
    pub(crate) eligible_nominator_ids: Vec<String>,
    pub(crate) eligible_nominee_ids: Vec<String>,
    pub(crate) execution_vote_threshold: usize,
    pub(crate) highest_vote_count: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) execution_candidate: Option<ExecutionCandidate>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) confirmed_execution: Option<ConfirmedExecution>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) active_nomination: Option<ActiveNomination>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ActiveNomination {
    pub(crate) event_id: String,
    pub(crate) step_id: String,
    pub(crate) nominator_id: String,
    pub(crate) nominee_id: String,
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
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ExecutionCandidate {
    pub(crate) nominee_id: String,
    pub(crate) vote_count: usize,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ExecutionStanding {
    pub(crate) execution_vote_threshold: usize,
    pub(crate) highest_vote_count: usize,
    pub(crate) execution_candidate: Option<ExecutionCandidate>,
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
    pub(crate) system_token_ids: Vec<SystemTokenId>,
    pub(crate) script_tokens: Vec<ScriptTokenRef>,
    pub(crate) notes: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Hash, Copy, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) enum SystemTokenId {
    Drunk,
    Poisoned,
    Protected,
    NoAbility,
    AbilitySpent,
    NeedsFollowUp,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Hash, Clone)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ScriptTokenRef {
    pub(crate) character_id: String,
    pub(crate) token_id: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Copy, Clone)]
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) winning_team: Option<Alignment>,
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
    ManualComplete,
    NotApplicable,
}

impl PhaseStepStatus {
    pub(crate) fn is_done(self) -> bool {
        matches!(
            self,
            PhaseStepStatus::Complete
                | PhaseStepStatus::Skipped
                | PhaseStepStatus::ManualComplete
                | PhaseStepStatus::NotApplicable
        )
    }
}

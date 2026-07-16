use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::model::{
    ConfirmedInformation, CoreWarning, DayState, InformationResult, Phase, PhaseOverviewItem,
    PhaseStep, Player, RegistrationJudgment, StepInput,
};

pub(crate) struct GameFile {
    pub(crate) schema_version: u32,
    pub(crate) game: Game,
}

#[derive(Debug)]
pub(crate) struct Game {
    pub(crate) updated_at: Option<String>,
    pub(crate) events: Vec<GameEvent>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RawGameFile {
    pub(crate) schema_version: u32,
    pub(crate) game: RawGame,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RawGame {
    pub(crate) updated_at: Option<String>,
    pub(crate) events: Vec<Value>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct Discriminator {
    #[serde(rename = "type")]
    pub(crate) kind: String,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub(crate) enum Command {
    #[serde(rename = "smoke")]
    Smoke,
    #[serde(rename = "createGame")]
    CreateGame { payload: CreateGamePayload },
    #[serde(rename = "confirmStep")]
    ConfirmStep { payload: PhaseStepCommandPayload },
    #[serde(rename = "skipStep")]
    SkipStep { payload: PhaseStepCommandPayload },
    #[serde(rename = "useSlayerAbility")]
    UseSlayerAbility {
        payload: UseSlayerAbilityCommandPayload,
    },
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct UseSlayerAbilityCommandPayload {
    pub(crate) discussion_step_id: String,
    pub(crate) expected_event_count: usize,
    pub(crate) actor_player_id: String,
    pub(crate) target_player_id: String,
    pub(crate) target_registration: SlayerTargetRegistration,
}

#[derive(Debug, Deserialize, PartialEq, Eq)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub(crate) enum SlayerTargetRegistration {
    Canonical,
    RecluseAsDemon { registered_character_id: String },
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SetupPlayerInput {
    #[serde(default)]
    pub(crate) id: Option<String>,
    pub(crate) seat: u8,
    pub(crate) name: String,
    pub(crate) actual_character: String,
    #[serde(default)]
    pub(crate) shown_character: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CreateGamePayload {
    pub(crate) players: Vec<SetupPlayerInput>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PhaseStepCommandPayload {
    pub(crate) step_id: String,
    #[serde(default)]
    pub(crate) input: StepInput,
    #[serde(default)]
    pub(crate) delivered_result: Option<InformationResult>,
    #[serde(default)]
    pub(crate) registration_judgments: Vec<RegistrationJudgment>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SetupDistributionRequest {
    pub(crate) player_count: usize,
    #[serde(default)]
    pub(crate) actual_characters: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct PhaseInputSuggestionRequest {
    pub(crate) step_id: String,
    #[serde(default)]
    pub(crate) current_input: StepInput,
    pub(crate) choice_token: u32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PhaseInputSuggestion {
    pub(crate) step_id: String,
    pub(crate) input: StepInput,
}

#[derive(Debug, Serialize, PartialEq, Eq, Copy, Clone)]
#[serde(rename_all = "PascalCase")]
pub(crate) struct SetupDistribution {
    pub(crate) townsfolk: usize,
    pub(crate) outsider: usize,
    pub(crate) minion: usize,
    pub(crate) demon: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ReplayState {
    pub(crate) schema_version: u32,
    pub(crate) event_count: usize,
    pub(crate) phase: Phase,
    pub(crate) players: Vec<Player>,
    pub(crate) current_step: Option<PhaseStep>,
    pub(crate) phase_overview: Vec<PhaseOverviewItem>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) day_state: Option<DayState>,
    pub(crate) warnings: Vec<CoreWarning>,
    pub(crate) rule_state: RuleState,
}

#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuleState {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) red_herring_player_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) active_poison: Option<ActiveRuleEffect>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) active_protection: Option<ActiveRuleEffect>,
    pub(crate) unannounced_night_death_player_ids: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) slayer_ability: Option<crate::model::SlayerAbilityState>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ActiveRuleEffect {
    pub(crate) player_id: String,
    pub(crate) source_player_id: String,
    pub(crate) source_event_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Proposal {
    pub(crate) event: GameEvent,
    pub(crate) warnings: Vec<CoreWarning>,
    pub(crate) follow_up_steps: Vec<Value>,
    pub(crate) preview: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) reveal_payload: Option<RevealPayload>,
}

#[derive(Debug, Serialize)]
#[serde(untagged)]
pub(crate) enum RevealPayload {
    Text {
        #[serde(rename = "messageKo")]
        message_ko: String,
        #[serde(rename = "labelKo", skip_serializing_if = "Option::is_none")]
        label_ko: Option<String>,
        #[serde(rename = "valueKo", skip_serializing_if = "Option::is_none")]
        value_ko: Option<String>,
        #[serde(rename = "previewMessageKo", skip_serializing_if = "Option::is_none")]
        preview_message_ko: Option<String>,
    },
    SpyGrimoire {
        kind: &'static str,
        players: Vec<crate::model::InformationPlayer>,
    },
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GameEvent {
    pub(crate) id: String,
    #[serde(flatten)]
    pub(crate) kind: GameEventKind,
    pub(crate) phase: Phase,
    pub(crate) summary: String,
    pub(crate) created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub(crate) enum GameEventKind {
    #[serde(rename = "smokeConfirmed")]
    SmokeConfirmed { payload: SmokeEventPayload },
    #[serde(rename = "setupConfirmed")]
    SetupConfirmed { payload: SetupEventPayload },
    #[serde(rename = "phaseStepConfirmed")]
    PhaseStepConfirmed { payload: Box<PhaseStepEventPayload> },
    #[serde(rename = "phaseStepSkipped")]
    PhaseStepSkipped { payload: StepIdPayload },
    #[serde(rename = "phaseStepNeedsFollowUp")]
    PhaseStepNeedsFollowUp { payload: StepIdPayload },
    #[serde(rename = "nominationVoteConfirmed")]
    NominationVoteConfirmed { payload: NominationEventPayload },
    #[serde(rename = "executionConfirmed")]
    ExecutionConfirmed { payload: ExecutionEventPayload },
    #[serde(rename = "noExecutionConfirmed")]
    NoExecutionConfirmed { payload: ExecutionEventPayload },
    #[serde(rename = "deathConfirmed")]
    DeathConfirmed { payload: DeathEventPayload },
    #[serde(rename = "executionSurvivalConfirmed")]
    ExecutionSurvivalConfirmed {
        payload: ExecutionSurvivalEventPayload,
    },
    #[serde(rename = "redHerringAssigned")]
    RedHerringAssigned { payload: RedHerringAssignedPayload },
    #[serde(rename = "nightActionResolved")]
    NightActionResolved { payload: NightActionResolvedPayload },
    #[serde(rename = "nightDeathsAnnounced")]
    NightDeathsAnnounced {
        payload: NightDeathsAnnouncedPayload,
    },
    #[serde(rename = "slayerAbilityUsed")]
    SlayerAbilityUsed { payload: SlayerAbilityUsedPayload },
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SlayerAbilityUsedPayload {
    pub(crate) discussion_step_id: String,
    pub(crate) actor_player_id: String,
    pub(crate) target_player_id: String,
    pub(crate) impairment_context: SlayerImpairmentContext,
    pub(crate) registration_context: SlayerRegistrationContext,
    pub(crate) outcome: SlayerOutcome,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub(crate) enum SlayerImpairmentContext {
    Healthy,
    Poisoned {
        source_player_id: String,
        source_event_id: String,
    },
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub(crate) enum SlayerRegistrationContext {
    Canonical {
        registered_as_demon: bool,
    },
    RecluseDecision {
        registered_as_demon: bool,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        registered_character_id: Option<String>,
    },
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub(crate) enum SlayerOutcome {
    NoEffect { reason: SlayerNoEffectReason },
    DeathPending { player_id: String },
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) enum SlayerNoEffectReason {
    ActorPoisoned,
    TargetNotDemon,
    TargetAlreadyDead,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct RedHerringAssignedPayload {
    pub(crate) step_id: String,
    pub(crate) player_id: String,
    pub(crate) registration_judgments: Vec<RegistrationJudgment>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct NightActionResolvedPayload {
    pub(crate) step_id: String,
    pub(crate) actor_player_id: String,
    pub(crate) resolution: NightActionResolution,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub(crate) enum NightActionResolution {
    Poison {
        target_player_id: String,
        applied: bool,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        no_effect_reason: Option<NightActionNoEffectReason>,
    },
    MonkProtection {
        target_player_id: String,
        applied: bool,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        no_effect_reason: Option<NightActionNoEffectReason>,
    },
    ImpAttack {
        target_player_id: String,
        outcome: ImpAttackOutcome,
    },
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) enum NightActionNoEffectReason {
    ActorImpaired,
    NotActualCharacter,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub(crate) enum ImpAttackOutcome {
    Death {
        player_id: String,
    },
    Prevented {
        reason: ImpPreventionReason,
        source_event_id: String,
    },
    NoDeath {
        reason: ImpNoDeathReason,
    },
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ImpPreventionReason {
    MonkProtection,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ImpNoDeathReason {
    AlreadyDead,
    ActorImpaired,
    NotActualCharacter,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct NightDeathsAnnouncedPayload {
    pub(crate) step_id: String,
    pub(crate) player_ids: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub(crate) struct SmokeEventPayload {
    pub(crate) source: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub(crate) struct SetupEventPayload {
    pub(crate) players: Vec<SetupPlayerInput>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StepIdPayload {
    pub(crate) step_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PhaseStepEventPayload {
    pub(crate) step_id: String,
    #[serde(default)]
    pub(crate) input: StepInput,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) information: Option<ConfirmedInformation>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct NominationEventPayload {
    pub(crate) step_id: String,
    pub(crate) nominator_id: String,
    pub(crate) nominee_id: String,
    pub(crate) voter_ids: Vec<String>,
    pub(crate) ghost_vote_spent_player_ids: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ExecutionEventPayload {
    pub(crate) step_id: String,
    pub(crate) input: ExecutionEventInput,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ExecutionEventInput {
    pub(crate) execute: bool,
    #[serde(default)]
    pub(crate) player_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct DeathEventPayload {
    pub(crate) player_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) step_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ExecutionSurvivalEventPayload {
    pub(crate) step_id: String,
    pub(crate) player_id: String,
}

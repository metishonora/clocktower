use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::model::{
    CoreWarning, DayState, NominationRecord, Phase, PhaseOverviewItem, PhaseStep, Player, StepInput,
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
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SetupDistributionRequest {
    pub(crate) player_count: usize,
    #[serde(default)]
    pub(crate) actual_characters: Vec<String>,
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
#[serde(rename_all = "camelCase")]
pub(crate) struct RevealPayload {
    pub(crate) message_ko: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) preview_message_ko: Option<String>,
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
    PhaseStepConfirmed { payload: PhaseStepEventPayload },
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
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NominationEventPayload {
    pub(crate) step_id: String,
    pub(crate) input: NominationRecord,
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
#[serde(rename_all = "camelCase")]
pub(crate) struct DeathEventPayload {
    pub(crate) player_id: String,
}

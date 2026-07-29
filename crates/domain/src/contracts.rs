use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::model::{
    AbilityInstanceId, Alignment, ConfirmedInformation, CoreWarning, DayState, InformationResult,
    Phase, PhaseOverviewItem, PhaseStep, Player, PlayerIdentityTransition, PlayerTransition,
    RegistrationJudgment, ScriptTokenRef, StepInput, SystemTokenId,
};

pub(crate) struct GameFile {
    pub(crate) schema_version: u32,
    pub(crate) script_id: ScriptId,
    pub(crate) game: Game,
}

#[derive(Debug, Deserialize, Serialize, Copy, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ScriptId {
    TroubleBrewing,
    SectsAndViolets,
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
    #[serde(default)]
    pub(crate) script_id: Option<ScriptId>,
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
    #[serde(rename = "resolveManualStep")]
    ResolveManualStep {
        payload: ResolveManualStepCommandPayload,
    },
    #[serde(rename = "useSlayerAbility")]
    UseSlayerAbility {
        payload: UseSlayerAbilityCommandPayload,
    },
    #[serde(rename = "recordDayAction")]
    RecordDayAction {
        payload: RecordDayActionCommandPayload,
    },
    #[serde(rename = "recordMadnessCheck")]
    RecordMadnessCheck {
        payload: RecordMadnessCheckCommandPayload,
    },
    #[serde(rename = "executeMadness")]
    ExecuteMadness {
        payload: ExecuteMadnessCommandPayload,
    },
    #[serde(rename = "endGame")]
    EndGame { payload: EndGameCommandPayload },
    #[serde(rename = "updatePlayerAnnotations")]
    UpdatePlayerAnnotations {
        payload: UpdatePlayerAnnotationsCommandPayload,
    },
    #[serde(rename = "resolveVigormortisPoison")]
    ResolveVigormortisPoison {
        payload: ResolveVigormortisPoisonCommandPayload,
    },
    #[serde(rename = "resolveSweetheartConsequence")]
    ResolveSweetheartConsequence {
        payload: ResolveSweetheartConsequenceCommandPayload,
    },
    #[serde(rename = "resolveBarberConsequence")]
    ResolveBarberConsequence {
        payload: ResolveBarberConsequenceCommandPayload,
    },
    #[serde(rename = "resolveKlutzConsequence")]
    ResolveKlutzConsequence {
        payload: ResolveKlutzConsequenceCommandPayload,
    },
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ResolveSweetheartConsequenceCommandPayload {
    pub(crate) step_id: String,
    #[serde(default)]
    pub(crate) target_player_id: Option<String>,
    pub(crate) expected_event_count: usize,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ResolveBarberConsequenceCommandPayload {
    pub(crate) step_id: String,
    #[serde(default)]
    pub(crate) chooser_demon_player_id: Option<String>,
    #[serde(default)]
    pub(crate) decision: Option<BarberDecision>,
    pub(crate) expected_event_count: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub(crate) enum BarberDecision {
    Decline,
    Swap { player_ids: Vec<String> },
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ResolveKlutzConsequenceCommandPayload {
    pub(crate) step_id: String,
    #[serde(default)]
    pub(crate) target_player_id: Option<String>,
    pub(crate) expected_event_count: usize,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ResolveVigormortisPoisonCommandPayload {
    pub(crate) source_event_id: String,
    pub(crate) target_player_id: String,
    pub(crate) expected_event_count: usize,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ResolveManualStepCommandPayload {
    pub(crate) step_id: String,
    pub(crate) outcome: ManualPhaseStepOutcome,
    #[serde(default)]
    pub(crate) expected_event_count: Option<usize>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Copy, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ManualPhaseStepOutcome {
    Handled,
    NotApplicable,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct UpdatePlayerAnnotationsCommandPayload {
    pub(crate) player_id: String,
    pub(crate) expected_event_count: usize,
    pub(crate) system_token_ids: Vec<SystemTokenId>,
    pub(crate) script_tokens: Vec<ScriptTokenRef>,
    pub(crate) notes: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct EndGameCommandPayload {
    pub(crate) winning_team: Alignment,
    pub(crate) expected_event_count: usize,
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct RecordDayActionCommandPayload {
    pub(crate) day_id: String,
    pub(crate) expected_event_count: usize,
    pub(crate) actor_player_id: String,
    pub(crate) record: DayActionRecord,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct RecordMadnessCheckCommandPayload {
    pub(crate) assignment_id: String,
    pub(crate) expected_event_count: usize,
    pub(crate) result: MadnessCheckResult,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ExecuteMadnessCommandPayload {
    pub(crate) assignment_id: String,
    pub(crate) expected_event_count: usize,
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
    pub(crate) expected_event_count: Option<usize>,
    #[serde(default)]
    pub(crate) input: StepInput,
    #[serde(default)]
    pub(crate) delivered_result: Option<InformationResult>,
    #[serde(default)]
    pub(crate) registration_judgments: Vec<RegistrationJudgment>,
}

impl Command {
    pub(crate) const DISCRIMINATORS: &'static [&'static str] = &[
        "smoke",
        "createGame",
        "confirmStep",
        "skipStep",
        "resolveManualStep",
        "useSlayerAbility",
        "recordDayAction",
        "recordMadnessCheck",
        "executeMadness",
        "endGame",
        "updatePlayerAnnotations",
        "resolveVigormortisPoison",
        "resolveSweetheartConsequence",
        "resolveBarberConsequence",
        "resolveKlutzConsequence",
    ];

    pub(crate) fn expected_event_count(&self) -> Option<usize> {
        match self {
            Self::Smoke | Self::CreateGame { .. } => None,
            Self::ConfirmStep { payload } | Self::SkipStep { payload } => {
                payload.expected_event_count
            }
            Self::ResolveManualStep { payload } => payload.expected_event_count,
            Self::UseSlayerAbility { payload } => Some(payload.expected_event_count),
            Self::RecordDayAction { payload } => Some(payload.expected_event_count),
            Self::RecordMadnessCheck { payload } => Some(payload.expected_event_count),
            Self::ExecuteMadness { payload } => Some(payload.expected_event_count),
            Self::EndGame { payload } => Some(payload.expected_event_count),
            Self::UpdatePlayerAnnotations { payload } => Some(payload.expected_event_count),
            Self::ResolveVigormortisPoison { payload } => Some(payload.expected_event_count),
            Self::ResolveSweetheartConsequence { payload } => Some(payload.expected_event_count),
            Self::ResolveBarberConsequence { payload } => Some(payload.expected_event_count),
            Self::ResolveKlutzConsequence { payload } => Some(payload.expected_event_count),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SetupDistributionRequest {
    pub(crate) script_id: ScriptId,
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
    pub(crate) script_id: ScriptId,
    pub(crate) event_count: usize,
    pub(crate) phase: Phase,
    pub(crate) players: Vec<Player>,
    pub(crate) current_step: Option<PhaseStep>,
    pub(crate) phase_overview: Vec<PhaseOverviewItem>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) day_state: Option<DayState>,
    pub(crate) warnings: Vec<CoreWarning>,
    pub(crate) rule_state: RuleState,
    pub(crate) game_end: Option<GameEndState>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub(crate) pending_identity_reveals: Vec<PendingIdentityReveal>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub(crate) available_day_actions: Vec<AvailableDayAction>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub(crate) day_action_records: Vec<ConfirmedDayActionRecord>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub(crate) madness_assignments: Vec<MadnessAssignmentState>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) pending_madness_execution: Option<PendingMadnessExecution>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub(crate) pending_vigormortis_poison_choices: Vec<PendingVigormortisPoisonChoice>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub(crate) pending_death_consequences: Vec<PendingDeathConsequence>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) pending_forced_game_end: Option<PendingForcedGameEnd>,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PendingDeathConsequence {
    pub(crate) step_id: String,
    pub(crate) kind: DeathConsequenceKind,
    pub(crate) source_event_id: String,
    pub(crate) death_sequence: u8,
    pub(crate) actor_player_id: String,
    pub(crate) source_ability_instance_id: AbilityInstanceId,
    pub(crate) actor_impaired_at_trigger: bool,
    #[serde(skip_serializing)]
    pub(crate) actor_alignment_at_trigger: Alignment,
    pub(crate) allowed_player_ids: Vec<String>,
    pub(crate) eligible_chooser_player_ids: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Copy, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) enum DeathConsequenceKind {
    Sweetheart,
    Barber,
    Klutz,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PendingForcedGameEnd {
    pub(crate) source_event_id: String,
    pub(crate) winning_team: Alignment,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PendingVigormortisPoisonChoice {
    pub(crate) source_event_id: String,
    pub(crate) vigormortis_player_id: String,
    pub(crate) minion_player_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) previous_target_player_id: Option<String>,
    pub(crate) allowed_player_ids: Vec<String>,
    pub(crate) reason: VigormortisPoisonInvalidReason,
}

#[derive(Debug, Serialize, Deserialize, Copy, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) enum VigormortisPoisonInvalidReason {
    NoCurrentTarget,
    TargetNotTownsfolk,
    TargetNotNearestTownsfolk,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AvailableDayAction {
    pub(crate) actor_player_id: String,
    pub(crate) character_id: String,
    pub(crate) day_id: String,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ConfirmedDayActionRecord {
    pub(crate) event_id: String,
    pub(crate) day_id: String,
    pub(crate) actor_player_id: String,
    pub(crate) character_id: String,
    pub(crate) record: DayActionRecord,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MadnessAssignmentState {
    pub(crate) assignment_id: String,
    pub(crate) source_player_id: String,
    pub(crate) source_character_id: String,
    pub(crate) target_player_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) required_character_id: Option<String>,
    pub(crate) status: MadnessStatus,
    pub(crate) source_effective: bool,
    pub(crate) can_check: bool,
    pub(crate) can_execute: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) violation_check_event_id: Option<String>,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PendingMadnessExecution {
    pub(crate) event_id: String,
    pub(crate) assignment_id: String,
    pub(crate) source_character_id: String,
    pub(crate) target_player_id: String,
    pub(crate) interrupted_step_id: String,
}

#[derive(Debug, Serialize, Deserialize, Copy, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) enum MadnessStatus {
    Unchecked,
    Clear,
    Violated,
}

#[derive(Debug, Serialize, Deserialize, Copy, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) enum MadnessCheckResult {
    Clear,
    Violation,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GameEndState {
    pub(crate) event_id: String,
    pub(crate) winning_team: Alignment,
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
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub(crate) unannounced_night_resurrection_player_ids: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) slayer_ability: Option<crate::model::SlayerAbilityState>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) virgin_ability: Option<crate::model::VirginAbilityState>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) butler_vote: Option<ButlerVoteState>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) active_impairments: Option<Vec<ActiveImpairment>>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub(crate) automatic_reminders: Vec<AutomaticReminder>,
}

#[derive(Debug, Serialize, PartialEq, Eq, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AutomaticReminder {
    pub(crate) player_id: String,
    pub(crate) character_id: String,
    pub(crate) token_id: String,
    pub(crate) label: String,
    pub(crate) description: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ActiveImpairment {
    pub(crate) kind: ImpairmentKind,
    pub(crate) player_id: String,
    pub(crate) source_event_id: String,
    pub(crate) source_character_id: String,
    pub(crate) expires: ImpairmentExpiry,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Copy, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ImpairmentKind {
    Poisoned,
    Drunk,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Copy, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ImpairmentExpiry {
    Never,
    WhileSourceAbilityActive,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ButlerVoteState {
    pub(crate) butler_player_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) master_player_id: Option<String>,
    pub(crate) restriction_applies: bool,
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

#[derive(Debug, Serialize, Clone)]
#[serde(untagged)]
pub(crate) enum RevealPayload {
    SpyGrimoire {
        kind: &'static str,
        players: Vec<crate::model::InformationPlayer>,
    },
    MinionInformation {
        kind: &'static str,
        #[serde(rename = "demonPlayers")]
        demon_players: Vec<RevealIdentity>,
        #[serde(rename = "minionPlayers")]
        minion_players: Vec<RevealIdentity>,
    },
    DemonInformation {
        kind: &'static str,
        #[serde(rename = "minionPlayers")]
        minion_players: Vec<RevealIdentity>,
        #[serde(rename = "bluffCharacterIds")]
        bluff_character_ids: Vec<String>,
    },
    SetupInformation {
        kind: &'static str,
        #[serde(rename = "characterId")]
        character_id: String,
        #[serde(rename = "candidatePlayers")]
        candidate_players: Vec<RevealPlayer>,
        #[serde(
            rename = "revealedCharacterId",
            skip_serializing_if = "Option::is_none"
        )]
        revealed_character_id: Option<String>,
        #[serde(rename = "zeroOutsiders")]
        zero_outsiders: bool,
    },
    NumericInformation {
        kind: &'static str,
        #[serde(rename = "characterId")]
        character_id: String,
        value: usize,
    },
    BooleanInformation {
        kind: &'static str,
        #[serde(rename = "characterId")]
        character_id: String,
        value: bool,
    },
    FortuneTellerInformation {
        kind: &'static str,
        #[serde(rename = "targetPlayers")]
        target_players: Vec<RevealPlayer>,
        #[serde(rename = "hasDemon")]
        has_demon: bool,
    },
    CharacterInformation {
        kind: &'static str,
        #[serde(rename = "characterId")]
        character_id: String,
        #[serde(rename = "targetPlayer")]
        target_player: RevealPlayer,
        #[serde(rename = "revealedCharacterId")]
        revealed_character_id: String,
    },
    DreamerInformation {
        kind: &'static str,
        #[serde(rename = "characterIds")]
        character_ids: Vec<String>,
    },
    SeamstressInformation {
        kind: &'static str,
        #[serde(rename = "targetPlayers")]
        target_players: Vec<RevealPlayer>,
        #[serde(rename = "sameAlignment")]
        same_alignment: bool,
    },
    SageInformation {
        kind: &'static str,
        #[serde(rename = "candidatePlayers")]
        candidate_players: Vec<RevealPlayer>,
    },
    CharacterChange {
        kind: &'static str,
        #[serde(rename = "playerId")]
        player_id: String,
        alignment: String,
        #[serde(rename = "characterId")]
        character_id: String,
    },
    MadnessAssignment {
        kind: &'static str,
        #[serde(rename = "playerId")]
        player_id: String,
        #[serde(rename = "characterId")]
        character_id: String,
    },
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PendingIdentityReveal {
    pub(crate) source_event_id: String,
    pub(crate) sequence: u8,
    pub(crate) payload: RevealPayload,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RevealPlayer {
    pub(crate) player_id: String,
    pub(crate) seat: u8,
    pub(crate) name: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RevealIdentity {
    pub(crate) seat: u8,
    pub(crate) name: String,
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
    #[serde(rename = "manualPhaseStepResolved")]
    ManualPhaseStepResolved {
        payload: ManualPhaseStepResolvedPayload,
    },
    #[serde(rename = "nominationVoteConfirmed")]
    NominationVoteConfirmed { payload: NominationEventPayload },
    #[serde(rename = "nominationStarted")]
    NominationStarted { payload: NominationStartedPayload },
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
    #[serde(rename = "dayActionRecorded")]
    DayActionRecorded { payload: DayActionRecordedPayload },
    #[serde(rename = "madnessAssigned")]
    MadnessAssigned { payload: MadnessAssignedPayload },
    #[serde(rename = "madnessCheckRecorded")]
    MadnessCheckRecorded {
        payload: MadnessCheckRecordedPayload,
    },
    #[serde(rename = "madnessExecutionConfirmed")]
    MadnessExecutionConfirmed {
        payload: MadnessExecutionConfirmedPayload,
    },
    #[serde(rename = "demonSuccessionConfirmed")]
    DemonSuccessionConfirmed {
        payload: DemonSuccessionConfirmedPayload,
    },
    #[serde(rename = "snakeCharmerActionResolved")]
    SnakeCharmerActionResolved {
        payload: SnakeCharmerActionResolvedPayload,
    },
    #[serde(rename = "pitHagTransformationResolved")]
    PitHagTransformationResolved {
        payload: PitHagTransformationResolvedPayload,
    },
    #[serde(rename = "pitHagArbitraryDeathsConfirmed")]
    PitHagArbitraryDeathsConfirmed {
        payload: PitHagArbitraryDeathsConfirmedPayload,
    },
    #[serde(rename = "playerTransitioned")]
    PlayerTransitioned { payload: PlayerTransitionedPayload },
    #[serde(rename = "gameEnded")]
    GameEnded { payload: GameEndedPayload },
    #[serde(rename = "playerAnnotationsUpdated")]
    PlayerAnnotationsUpdated {
        payload: PlayerAnnotationsUpdatedPayload,
    },
    #[serde(rename = "vigormortisPoisonTargetChanged")]
    VigormortisPoisonTargetChanged {
        payload: VigormortisPoisonTargetChangedPayload,
    },
    #[serde(rename = "sweetheartConsequenceResolved")]
    SweetheartConsequenceResolved {
        payload: SweetheartConsequenceResolvedPayload,
    },
    #[serde(rename = "barberConsequenceResolved")]
    BarberConsequenceResolved {
        payload: BarberConsequenceResolvedPayload,
    },
    #[serde(rename = "klutzChoiceResolved")]
    KlutzChoiceResolved { payload: KlutzChoiceResolvedPayload },
}

impl GameEventKind {
    pub(crate) const DISCRIMINATORS: &'static [&'static str] = &[
        "smokeConfirmed",
        "setupConfirmed",
        "phaseStepConfirmed",
        "phaseStepSkipped",
        "phaseStepNeedsFollowUp",
        "manualPhaseStepResolved",
        "nominationVoteConfirmed",
        "nominationStarted",
        "executionConfirmed",
        "noExecutionConfirmed",
        "deathConfirmed",
        "executionSurvivalConfirmed",
        "redHerringAssigned",
        "nightActionResolved",
        "nightDeathsAnnounced",
        "slayerAbilityUsed",
        "dayActionRecorded",
        "madnessAssigned",
        "madnessCheckRecorded",
        "madnessExecutionConfirmed",
        "demonSuccessionConfirmed",
        "snakeCharmerActionResolved",
        "pitHagTransformationResolved",
        "pitHagArbitraryDeathsConfirmed",
        "playerTransitioned",
        "gameEnded",
        "playerAnnotationsUpdated",
        "vigormortisPoisonTargetChanged",
        "sweetheartConsequenceResolved",
        "barberConsequenceResolved",
        "klutzChoiceResolved",
    ];
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct DeathTriggerRef {
    pub(crate) source_event_id: String,
    pub(crate) death_sequence: u8,
    pub(crate) player_id: String,
    pub(crate) source_ability_instance_id: AbilityInstanceId,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SweetheartConsequenceResolvedPayload {
    pub(crate) step_id: String,
    pub(crate) trigger: DeathTriggerRef,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) target_player_id: Option<String>,
    pub(crate) outcome: SweetheartConsequenceOutcome,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub(crate) enum SweetheartConsequenceOutcome {
    DrunkApplied {
        impairment: ActiveImpairment,
    },
    NoEffect {
        reason: DeathConsequenceNoEffectReason,
    },
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct BarberConsequenceResolvedPayload {
    pub(crate) step_id: String,
    pub(crate) trigger: DeathTriggerRef,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) chooser_demon_player_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) decision: Option<BarberDecision>,
    pub(crate) outcome: BarberConsequenceOutcome,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub(crate) enum BarberConsequenceOutcome {
    Declined,
    Swapped {
        identity_transitions: Vec<PlayerIdentityTransition>,
    },
    NoChangeSameCharacter,
    NoEffect {
        reason: DeathConsequenceNoEffectReason,
    },
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct KlutzChoiceResolvedPayload {
    pub(crate) step_id: String,
    pub(crate) trigger: DeathTriggerRef,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) target_player_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) actor_alignment: Option<Alignment>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) target_alignment: Option<Alignment>,
    pub(crate) outcome: KlutzChoiceOutcome,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub(crate) enum KlutzChoiceOutcome {
    Safe,
    ActorImpaired,
    TeamLost {
        losing_team: Alignment,
        winning_team: Alignment,
    },
}

#[derive(Debug, Serialize, Deserialize, Copy, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) enum DeathConsequenceNoEffectReason {
    ActorImpairedAtDeath,
    NoLivingDemon,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct VigormortisPoisonTargetChangedPayload {
    pub(crate) source_event_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) previous_target_player_id: Option<String>,
    pub(crate) target_player_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct PlayerTransitionedPayload {
    pub(crate) step_id: String,
    pub(crate) source_player_id: String,
    pub(crate) source_character_id: String,
    pub(crate) transitions: Vec<PlayerTransition>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SnakeCharmerActionResolvedPayload {
    pub(crate) step_id: String,
    pub(crate) actor_player_id: String,
    pub(crate) target_player_id: String,
    pub(crate) outcome: SnakeCharmerActionOutcome,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub(crate) enum SnakeCharmerActionOutcome {
    NoSwap {
        reason: SnakeCharmerNoSwapReason,
    },
    Swap {
        identity_transitions: Vec<PlayerIdentityTransition>,
        impairment: ActiveImpairment,
    },
}

#[derive(Debug, Serialize, Deserialize, Copy, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) enum SnakeCharmerNoSwapReason {
    TargetNotDemon,
    ActorImpaired,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct PitHagTransformationResolvedPayload {
    pub(crate) step_id: String,
    pub(crate) actor_player_id: String,
    pub(crate) target_player_id: String,
    pub(crate) character_id: String,
    pub(crate) outcome: PitHagTransformationOutcome,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub(crate) enum PitHagTransformationOutcome {
    NoChange {
        reason: PitHagNoChangeReason,
    },
    Changed {
        identity_transition: PlayerIdentityTransition,
        created_demon: bool,
    },
}

#[derive(Debug, Serialize, Deserialize, Copy, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) enum PitHagNoChangeReason {
    CharacterAlreadyInPlay,
    ActorImpaired,
    NotActualCharacter,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct PitHagArbitraryDeathsConfirmedPayload {
    pub(crate) step_id: String,
    pub(crate) source_transformation_event_id: String,
    pub(crate) deaths: Vec<NightDeath>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ManualPhaseStepResolvedPayload {
    pub(crate) step_id: String,
    pub(crate) outcome: ManualPhaseStepOutcome,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct PlayerAnnotationsUpdatedPayload {
    pub(crate) player_id: String,
    pub(crate) system_token_ids: Vec<SystemTokenId>,
    pub(crate) script_tokens: Vec<ScriptTokenRef>,
    pub(crate) notes: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct GameEndedPayload {
    pub(crate) winning_team: Alignment,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) source: Option<GameEndSource>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub(crate) enum GameEndSource {
    KlutzChoice { source_event_id: String },
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct DemonSuccessionConfirmedPayload {
    pub(crate) trigger_imp_death_event_id: String,
    pub(crate) death_cause: DemonDeathCause,
    pub(crate) previous_imp_player_id: String,
    pub(crate) successor_player_id: String,
    pub(crate) successor_previous_actual_character: String,
    pub(crate) new_character: String,
    pub(crate) source: DemonSuccessionSource,
}

#[derive(Debug, Serialize, Deserialize, Copy, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) enum DemonDeathCause {
    Execution,
    Slayer,
    ImpSelfKill,
}

#[derive(Debug, Serialize, Deserialize, Copy, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) enum DemonSuccessionSource {
    ScarletWoman,
    ImpSelfKill,
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
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct DayActionRecordedPayload {
    pub(crate) day_id: String,
    pub(crate) actor_player_id: String,
    pub(crate) character_id: String,
    pub(crate) record: DayActionRecord,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct MadnessAssignedPayload {
    pub(crate) step_id: String,
    pub(crate) source_player_id: String,
    pub(crate) target_player_id: String,
    pub(crate) required_character_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct MadnessCheckRecordedPayload {
    pub(crate) assignment_id: String,
    pub(crate) source_player_id: String,
    pub(crate) source_character_id: String,
    pub(crate) target_player_id: String,
    pub(crate) result: MadnessCheckResult,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct MadnessExecutionConfirmedPayload {
    pub(crate) assignment_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) check_event_id: Option<String>,
    pub(crate) source_player_id: String,
    pub(crate) source_character_id: String,
    pub(crate) target_player_id: String,
    pub(crate) interrupted_step_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub(crate) enum DayActionRecord {
    Artist {
        question: String,
        answer: ArtistAnswer,
    },
    Savant {
        reference_sentences: Vec<String>,
    },
    Juggler {
        correct_count: u8,
    },
}

#[derive(Debug, Serialize, Deserialize, Copy, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ArtistAnswer {
    Yes,
    No,
    Unknown,
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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) actor_character_id: Option<String>,
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
        #[serde(default)]
        mayor_context: MayorAttackContext,
        outcome: ImpAttackOutcome,
    },
    DemonAttack {
        target_player_id: String,
        outcome: DemonAttackOutcome,
    },
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub(crate) enum DemonAttackOutcome {
    Deaths {
        deaths: Vec<NightDeath>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        vigormortis_effect: Option<VigormortisEffect>,
    },
    FangGuJump {
        death: NightDeath,
        source_ability_instance_id: AbilityInstanceId,
        identity_transition: PlayerIdentityTransition,
    },
    NoEffect {
        reason: DemonAttackNoEffectReason,
    },
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct VigormortisEffect {
    pub(crate) minion_player_id: String,
    pub(crate) source_ability_instance_id: AbilityInstanceId,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) poison_target_player_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct NightDeath {
    pub(crate) player_id: String,
    pub(crate) cause: NightDeathCause,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub(crate) enum NightDeathCause {
    DemonAttack {
        actor_player_id: String,
        actor_character_id: String,
        target_player_id: String,
    },
    PitHagArbitraryDeath {
        actor_player_id: String,
        source_transformation_event_id: String,
    },
}

#[derive(Debug, Serialize, Deserialize, Copy, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) enum DemonAttackNoEffectReason {
    TargetAlreadyDead,
    ActorImpaired,
    NotActualCharacter,
    PitHagCreatedDemon,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq, Default)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub(crate) enum MayorAttackContext {
    #[default]
    NotApplicable,
    MayorDies {
        mayor_player_id: String,
    },
    Bounced {
        mayor_player_id: String,
        bounce_target_player_id: String,
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
    SoldierProtected {
        player_id: String,
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
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub(crate) resurrected_player_ids: Vec<String>,
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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) nomination_event_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) nominator_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) nominee_id: Option<String>,
    pub(crate) voter_ids: Vec<String>,
    pub(crate) ghost_vote_spent_player_ids: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct NominationStartedPayload {
    pub(crate) step_id: String,
    pub(crate) nominator_id: String,
    pub(crate) nominee_id: String,
    pub(crate) registration_judgments: Vec<RegistrationJudgment>,
    pub(crate) virgin_resolution: VirginResolution,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub(crate) enum VirginResolution {
    NotApplicable,
    SpentNoExecution {
        virgin_player_id: String,
        impairment_context: VirginImpairmentContext,
    },
    SpentAndNominatorExecuted {
        virgin_player_id: String,
        impairment_context: VirginImpairmentContext,
    },
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub(crate) enum VirginImpairmentContext {
    Healthy,
    Poisoned {
        source_player_id: String,
        source_event_id: String,
    },
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

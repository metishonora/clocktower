use crate::model::*;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
pub(crate) struct GameFile {
    pub(crate) schema_version: u32,
    pub(crate) script: ScriptReference,
    pub(crate) game: Game,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub(crate) enum ScriptReference {
    Custom { definition: CustomScriptDefinition },
}

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct CustomScriptDefinition {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) character_ids: Vec<String>,
    pub(crate) first_night_order: FirstNightOrderPlan,
}

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct CustomScriptDefinitionDraft {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) character_ids: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) first_night_order: Option<FirstNightOrderPlan>,
}

#[derive(Debug, Deserialize, Serialize, Copy, Clone, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub(crate) enum SystemFirstNightActionId {
    Dusk,
    MinionInfo,
    DemonInfo,
    Dawn,
    #[serde(other)]
    Unknown,
}

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq, Eq, Hash)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub(crate) enum FirstNightActionRef {
    System {
        action_id: SystemFirstNightActionId,
    },
    Character {
        character_id: String,
        action_id: String,
    },
}

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq, Eq)]
#[serde(transparent)]
pub(crate) struct FirstNightOrderPlan(pub(crate) Vec<FirstNightActionRef>);

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct CustomFirstNightPlanRequest {
    pub(crate) custom_definition: CustomScriptDefinitionDraft,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CustomFirstNightPlanResult {
    pub(crate) source: FirstNightPlanSource,
    pub(crate) plan: FirstNightOrderPlan,
}

#[derive(Debug, Serialize, Copy, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) enum FirstNightPlanSource {
    Definition,
    Default,
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
    #[serde(flatten)]
    pub(crate) fields: HashMap<String, Value>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct Discriminator {
    #[serde(rename = "type")]
    pub(crate) kind: String,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub(crate) enum Command {
    CreateGame { payload: CreateGamePayload },
    ConfirmStep { payload: PhaseStepCommandPayload },
}
impl Command {
    pub(crate) const DISCRIMINATORS: &'static [&'static str] = &["createGame", "confirmStep"];
    pub(crate) fn expected_event_count(&self) -> Option<usize> {
        match self {
            Self::ConfirmStep { payload } => payload.expected_event_count,
            _ => None,
        }
    }
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
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct CreateGamePayload {
    pub(crate) players: Vec<SetupPlayerInput>,
    #[serde(default)]
    pub(crate) setup_choice_id: Option<String>,
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SetupDistributionRequest {
    pub(crate) custom_definition: CustomScriptDefinition,
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

#[derive(Debug, Serialize, PartialEq, Eq, Clone)]
#[serde(untagged)]
pub(crate) enum SetupDistributionResult {
    Distribution(SetupDistribution),
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ReplayState {
    pub(crate) schema_version: u32,
    #[serde(flatten)]
    pub(crate) script_identity: ReplayScriptIdentity,
    pub(crate) event_count: usize,
    pub(crate) phase: Phase,
    pub(crate) players: Vec<Player>,
    pub(crate) current_step: Option<PhaseStep>,
    pub(crate) phase_overview: Vec<PhaseOverviewItem>,
    pub(crate) warnings: Vec<CoreWarning>,
    pub(crate) rule_state: RuleState,
    pub(crate) game_end: Option<Value>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub(crate) pending_identity_reveals: Vec<PendingIdentityReveal>,
}

#[derive(Debug, Serialize)]
#[serde(untagged)]
pub(crate) enum ReplayScriptIdentity {
    Custom { script: ScriptReference },
}

#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuleState {
    pub(crate) unannounced_night_death_player_ids: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) active_impairments: Option<Vec<ActiveImpairment>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) ability_grants: Option<Vec<AbilityGrant>>,
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
        value: u64,
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
    EvilTwinPair {
        kind: &'static str,
        players: Vec<EvilTwinRevealPlayer>,
    },
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct EvilTwinRevealPlayer {
    pub(crate) player_id: String,
    pub(crate) seat: u8,
    pub(crate) name: String,
    pub(crate) alignment: Alignment,
    pub(crate) character_id: String,
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

/// Typed result for the custom Character-action envelope.  Fixture-only result kinds are kept out
/// of the default production contract and may be added by the dedicated fixture feature.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub(crate) enum CustomActionResult {
    Information {
        value: InformationResult,
    },
    NoEffect,
    /// A bounded state-changing outcome used only by the dedicated fixture WASM build.  The
    /// production contract intentionally has no fixture result discriminator.
    #[cfg(feature = "custom-runtime-fixtures")]
    FixtureAbilityGranted {
        target_character_id: String,
    },
    /// A bounded identity transition used only by the dedicated fixture WASM build.  The
    /// reducer still derives the complete before/after identity from the preceding facts.
    #[cfg(feature = "custom-runtime-fixtures")]
    FixtureIdentityChanged {
        player_id: String,
        target_character_id: String,
    },
    /// Remove one previously acquired ability instance.  The complete provenance is carried so
    /// replay can reject a value that does not identify an existing grant exactly.
    #[cfg(feature = "custom-runtime-fixtures")]
    FixtureAbilityRemoved {
        owner_player_id: String,
        character_id: String,
        ability_instance_id: AbilityInstanceId,
    },
    /// Change one player's life fact.  This is a fixture transition, not a production death rule.
    #[cfg(feature = "custom-runtime-fixtures")]
    FixtureLifeChanged {
        player_id: String,
        alive: bool,
    },
    /// Add a finite impairment fact; source event and source Character are established by the
    /// validating handler rather than accepted from the wire.
    #[cfg(feature = "custom-runtime-fixtures")]
    FixtureImpairmentAdded {
        player_id: String,
        impairment_kind: ImpairmentKind,
    },
    /// Remove an exact impairment fact, retaining its source provenance in the event envelope.
    #[cfg(feature = "custom-runtime-fixtures")]
    FixtureImpairmentRemoved {
        player_id: String,
        impairment_kind: ImpairmentKind,
        source_event_id: String,
        source_character_id: String,
        expires: ImpairmentExpiry,
    },
}

/// Persisted payload for a custom Character action confirmation.  This lives with the other wire
/// contracts so `contracts.rs` does not depend on a feature module for its serialized schema.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct CustomActionConfirmedPayload {
    pub(crate) step_id: String,
    pub(crate) action_ref: FirstNightActionRef,
    pub(crate) ability_use: AbilityUseRef,
    pub(crate) input: StepInput,
    pub(crate) result: CustomActionResult,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type", rename_all = "camelCase")]
pub(crate) enum GameEventKind {
    SetupConfirmed {
        payload: SetupEventPayload,
    },
    PhaseStepConfirmed {
        payload: Box<PhaseStepEventPayload>,
    },
    CustomActionConfirmed {
        payload: CustomActionConfirmedPayload,
    },
}
impl GameEventKind {
    pub(crate) const DISCRIMINATORS: &'static [&'static str] = &[
        "setupConfirmed",
        "phaseStepConfirmed",
        "customActionConfirmed",
    ];
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SetupEventPayload {
    pub(crate) players: Vec<SetupPlayerInput>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) setup_choice_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PhaseStepEventPayload {
    pub(crate) step_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) action_ref: Option<FirstNightActionRef>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) ability_use: Option<AbilityUseRef>,
    #[serde(default)]
    pub(crate) input: StepInput,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) information: Option<ConfirmedInformation>,
}

impl FirstNightActionRef {
    pub(crate) fn system(action_id: &str) -> Self {
        let action_id = match action_id {
            "dusk" => SystemFirstNightActionId::Dusk,
            "minionInfo" => SystemFirstNightActionId::MinionInfo,
            "demonInfo" => SystemFirstNightActionId::DemonInfo,
            "dawn" => SystemFirstNightActionId::Dawn,
            _ => panic!("unknown system first-night action: {action_id}"),
        };
        Self::System { action_id }
    }
}

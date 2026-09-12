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
#[serde(rename_all = "PascalCase")]
pub(crate) struct SetupCountDelta {
    pub(crate) townsfolk: i32,
    pub(crate) outsider: i32,
    pub(crate) minion: i32,
    pub(crate) demon: i32,
}
impl SetupCountDelta {
    pub(crate) fn outsider(amount: i32) -> Self {
        Self { townsfolk: -amount, outsider: amount, minion: 0, demon: 0 }
    }
}
#[derive(Debug, Serialize, PartialEq, Eq, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SetupModifier {
    pub(crate) character_id: String,
    pub(crate) delta: SetupCountDelta,
}
#[derive(Debug, Serialize, PartialEq, Eq, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SetupAdjustment {
    pub(crate) base: SetupDistribution,
    pub(crate) modifiers: Vec<SetupModifier>,
    pub(crate) requested_delta: SetupCountDelta,
    pub(crate) applied_delta: SetupCountDelta,
    pub(crate) limited: bool,
}
#[derive(Debug, Serialize, PartialEq, Eq, Clone)]
pub(crate) struct SetupDistributionResult {
    #[serde(flatten)]
    pub(crate) distribution: SetupDistribution,
    pub(crate) adjustment: SetupAdjustment,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ReplayState {
    pub(crate) action_executions: Vec<crate::first_night::execution::ActionExecution>,
    pub(crate) latest_undo_unit: Option<crate::first_night::execution::LatestUndoUnit>,
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
    pub(crate) game_end: Option<CustomGameEnd>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub(crate) available_actions: Vec<PhaseStep>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub(crate) pending_identity_reveals: Vec<PendingIdentityReveal>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(crate) madness_assignments: Vec<MadnessAssignment>,
}

#[derive(Debug, Serialize)]
#[serde(untagged)]
pub(crate) enum ReplayScriptIdentity {
    Custom { script: ScriptReference },
}

#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuleState {
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(crate) automatic_reminders: Vec<AutomaticReminder>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(crate) preparations: Vec<PreparationRecord>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(crate) poisoner_choices: Vec<TargetAssignment>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(crate) master_choices: Vec<TargetAssignment>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(crate) guidance: Vec<GuidanceRecord>,
    pub(crate) unannounced_night_death_player_ids: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) active_impairments: Option<Vec<ActiveImpairment>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) ability_grants: Option<Vec<AbilityGrant>>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(crate) ability_uses: Vec<AbilityUseRecord>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(crate) philosopher_choices: Vec<PhilosopherChoiceFact>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(crate) witch_curses: Vec<WitchCurse>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(crate) twin_relationships: Vec<TwinRelationship>,
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
    MutantExecution {
        kind: &'static str,
        player: RevealPlayer,
        executed: bool,
        died: bool,
    },
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
    RedHerringAssigned {
        target_player_id: String,
    },
    InformationPrepared {
        preparation: InformationPreparation,
    },
    PreparedInformationDelivered {
        preparation_event_id: String,
        information: ConfirmedInformation,
        spent: bool,
    },
    TwinAssigned {
        target_player_id: String,
    },
    TwinInformed {
        relationship_event_id: String,
        target_player_id: String,
        effective: bool,
    },
    ShownCharacterAssigned {
        character_id: String,
    },
    Poisoner {
        target_player_id: String,
        day: u16,
        effective: bool,
    },
    Butler {
        target_player_id: String,
        day: u16,
        effective: bool,
    },
    MutantJudgment { result: crate::model::MadnessCheckResult },
    MutantExecution {
        execute: bool,
        executed: bool,
        died: bool,
    },

    Information {
        value: InformationResult,
    },
    NoEffect,
    PhilosopherDeferred,
    PhilosopherChoice {
        character_id: String,
        outcome: PhilosopherChoiceOutcome,
    },
    SnakeCharmer {
        target_player_id: String,
        outcome: SnakeCharmerOutcome,
    },
    EvilTwin {
        target_player_id: String,
        effective: bool,
    },
    Witch {
        target_player_id: String,
        day: u16,
        effective: bool,
    },
    Cerenovus {
        target_player_id: String,
        character_id: String,
        day: u16,
        effective: bool,
    },
    SeamstressDeferred,
    InformationDelivered {
        information: ConfirmedInformation,
        spent: bool,
    },
    SimulationChoice {
        character_id: Option<String>,
        spent: bool,
    },
    Simulation {
        information: Option<ConfirmedInformation>,
        spent: bool,
    },
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

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) enum PhilosopherChoiceOutcome {
    Acquired,
    SelfDrunk,
    Failed,
}
#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) enum SnakeCharmerOutcome {
    Swapped,
    Impaired,
    NotDemon,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct AbilityUseRecord {
    pub(crate) source_event_id: String,
    pub(crate) ability_use: AbilityUseRef,
}
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct PhilosopherChoiceFact {
    pub(crate) source_event_id: String,
    pub(crate) ability_use: AbilityUseRef,
    pub(crate) character_id: String,
    pub(crate) outcome: PhilosopherChoiceOutcome,
}
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct TwinRelationship {
    pub(crate) source_event_id: String,
    pub(crate) ability_use: AbilityUseRef,
    pub(crate) target_player_id: String,
    pub(crate) effective: bool,
}
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct WitchCurse {
    pub(crate) source_event_id: String,
    pub(crate) ability_use: AbilityUseRef,
    pub(crate) target_player_id: String,
    pub(crate) day: u16,
    pub(crate) initially_effective: bool,
    pub(crate) effective: bool,
}
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct MadnessAssignment {
    pub(crate) source_event_id: String,
    pub(crate) ability_use: AbilityUseRef,
    pub(crate) target_player_id: String,
    pub(crate) character_id: String,
    pub(crate) day: u16,
    pub(crate) initially_effective: bool,
    pub(crate) effective: bool,
}

/// Reasons for additional occurrences; these refer to confirmed facts, never a saved cursor.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub(crate) enum ActionCause {
    InitialPreparation {
        source_event_id: String,
    },
    RequiredPreparation {
        trigger_event_id: String,
        previous_preparation_event_id: Option<String>,
    },
    Delivery {
        preparation_event_id: String,
    },
    Optional {
        prefix_event_id: String,
    },
}
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub(crate) enum GuidanceCause {
    InitialDrunk,
    AcquiredDrunk,
    Choice { parent_event_id: String },
}
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct CustomGameEnd {
    pub(crate) winning_alignment: crate::model::Alignment,
    pub(crate) reason: CustomGameEndReason,
    pub(crate) source_event_id: String,
}
#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) enum CustomGameEndReason {
    GoodTwinExecuted,
}
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct InformationPreparation {
    pub(crate) information: InformationResult,
    pub(crate) correct_player_id: Option<String>,
}

/// Simulation provenance always points to the real Philosopher, never a fabricated grant.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct PhilosopherSimulationSource {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) guidance: Option<GuidanceCause>,
    pub(crate) selection_event_id: String,
    pub(crate) source_ability_use: AbilityUseRef,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct FollowUpCause {
    pub(crate) trigger_event_id: String,
    pub(crate) relationship_event_id: String,
}

/// Persisted payload for a custom Character action confirmation.  This lives with the other wire
/// contracts so `contracts.rs` does not depend on a feature module for its serialized schema.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct CustomActionConfirmedPayload {
    pub(crate) step_id: String,
    pub(crate) action_ref: FirstNightActionRef,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) ability_use: Option<AbilityUseRef>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) simulation_source: Option<PhilosopherSimulationSource>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) follow_up_cause: Option<FollowUpCause>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) action_cause: Option<crate::contracts::ActionCause>,
    pub(crate) input: StepInput,
    pub(crate) result: CustomActionResult,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) delivered_result: Option<crate::model::InformationResult>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub(crate) registration_judgments: Vec<crate::model::RegistrationJudgment>,
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

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct TargetAssignment {
    pub(crate) source_event_id: String,
    pub(crate) ability_use: AbilityUseRef,
    pub(crate) target_player_id: String,
    pub(crate) day: u16,
    pub(crate) initially_effective: bool,
    pub(crate) effective: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PreparationRecord {
    pub(crate) source_event_id: String,
    pub(crate) action_ref: FirstNightActionRef,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) ability_use: Option<AbilityUseRef>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) simulation_source: Option<PhilosopherSimulationSource>,
    pub(crate) result: CustomActionResult,
    pub(crate) registration_judgments: Vec<RegistrationJudgment>,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GuidanceRecord {
    pub(crate) source: PhilosopherSimulationSource,
    pub(crate) character_id: String,
    pub(crate) spent: bool,
}

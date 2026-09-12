use crate::contracts::{FirstNightActionRef, SystemFirstNightActionId};

pub(crate) const SYSTEM_ACTIONS: [SystemFirstNightActionId; 4] = [
    SystemFirstNightActionId::Dusk,
    SystemFirstNightActionId::MinionInfo,
    SystemFirstNightActionId::DemonInfo,
    SystemFirstNightActionId::Dawn,
];

// Snapshot of TPI botc-release resources/data/nightsheet.json `firstNight`, filtered to the
// currently supported TB/S&V action catalog. This is deliberately not a merge of script-local
// ranks. The ordered snapshot is used only when authoring a draft omits its order; the same
// catalog supplies the Character action set used to validate completed definitions.
pub(crate) const ORDERED_ACTIONS: [(&str, &str); 18] = [
    ("philosopher", "chooseAbility"),
    ("poisoner", "choosePoisonTarget"),
    ("snakeCharmer", "choosePlayer"),
    ("evilTwin", "learnTwin"),
    ("witch", "chooseCursedPlayer"),
    ("cerenovus", "assignMadness"),
    ("washerwoman", "learnTownsfolk"),
    ("librarian", "learnOutsider"),
    ("investigator", "learnMinion"),
    ("chef", "learnEvilPairs"),
    ("empath", "learnEvilNeighbors"),
    ("fortuneTeller", "checkDemon"),
    ("butler", "chooseMaster"),
    ("clockmaker", "learnSteps"),
    ("dreamer", "learnCharacters"),
    ("seamstress", "compareAlignments"),
    ("spy", "inspectGrimoire"),
    ("mathematician", "learnCount"),
];

/// Registered keys outside the regular night order. Dependencies belong to ActionSpec.
pub(crate) const ADDITIONAL_ACTIONS: [(&str, &str); 7] = [
    ("fortuneTeller", "assignRedHerring"),
    ("washerwoman", "prepareInformation"),
    ("librarian", "prepareInformation"),
    ("investigator", "prepareInformation"),
    ("evilTwin", "assignTwin"),
    ("drunk", "assignShownCharacter"),
    ("mutant", "resolveMadnessExecution"),
];
pub(crate) fn is_additional(action: &crate::contracts::FirstNightActionRef) -> bool {
    matches!(action, crate::contracts::FirstNightActionRef::Character { character_id, action_id }
        if ADDITIONAL_ACTIONS.iter().any(|(c, a)| c == character_id && a == action_id))
}
/// Complete production declaration. The boolean denotes membership in the regular order,
/// not whether a preparation or optional action can occur during the first night.
#[cfg_attr(feature = "custom-runtime-fixtures", allow(dead_code))]
pub(crate) fn production_actions() -> Vec<(FirstNightActionRef, bool)> {
    SYSTEM_ACTIONS
        .into_iter()
        .map(|action_id| (FirstNightActionRef::System { action_id }, true))
        .chain(
            ORDERED_ACTIONS
                .into_iter()
                .map(|(character_id, action_id)| {
                    (
                        FirstNightActionRef::Character {
                            character_id: character_id.into(),
                            action_id: action_id.into(),
                        },
                        true,
                    )
                }),
        )
        .chain(
            ADDITIONAL_ACTIONS
                .into_iter()
                .map(|(character_id, action_id)| {
                    (
                        FirstNightActionRef::Character {
                            character_id: character_id.into(),
                            action_id: action_id.into(),
                        },
                        false,
                    )
                }),
        )
        .collect()
}

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

/// Registered actions outside the user-owned regular night order. The linked action is used
/// only to place preparation/history; it never creates another definition-order entry.
pub(crate) const ADDITIONAL_ACTIONS: [(&str, &str, Option<(&str, &str)>); 7] = [
    (
        "fortuneTeller",
        "assignRedHerring",
        Some(("fortuneTeller", "checkDemon")),
    ),
    (
        "washerwoman",
        "prepareInformation",
        Some(("washerwoman", "learnTownsfolk")),
    ),
    (
        "librarian",
        "prepareInformation",
        Some(("librarian", "learnOutsider")),
    ),
    (
        "investigator",
        "prepareInformation",
        Some(("investigator", "learnMinion")),
    ),
    ("evilTwin", "assignTwin", Some(("evilTwin", "learnTwin"))),
    (
        "drunk",
        "assignShownCharacter",
        Some(("philosopher", "chooseAbility")),
    ),
    ("mutant", "resolveMadnessExecution", None),
];
pub(crate) fn is_additional(action: &crate::contracts::FirstNightActionRef) -> bool {
    matches!(action, crate::contracts::FirstNightActionRef::Character { character_id, action_id }
        if ADDITIONAL_ACTIONS.iter().any(|(c, a, _)| c == character_id && a == action_id))
}
pub(crate) fn linked_action(
    action: &crate::contracts::FirstNightActionRef,
) -> Option<crate::contracts::FirstNightActionRef> {
    use crate::contracts::FirstNightActionRef;
    let FirstNightActionRef::Character {
        character_id,
        action_id,
    } = action
    else {
        return Some(action.clone());
    };
    ADDITIONAL_ACTIONS
        .iter()
        .find(|(c, a, _)| c == character_id && a == action_id)
        .map(|(_, _, link)| {
            link.map(|(c, a)| FirstNightActionRef::Character {
                character_id: c.into(),
                action_id: a.into(),
            })
        })
        .unwrap_or_else(|| Some(action.clone()))
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
                .map(|(character_id, action_id, _)| {
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

use std::collections::HashSet;

use crate::contracts::{FirstNightActionRef, FirstNightOrderPlan};
use serde_json::Value;

// Explicit test snapshot of the supported first-night Character actions. Keep this fixture
// independent from the production default generator so complete-definition tests exercise the
// JSON contract instead of repairing incomplete input through runtime logic.
const FIRST_NIGHT_ACTIONS: [(&str, &str); 18] = [
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

pub(super) fn complete_order(character_ids: &[&str]) -> FirstNightOrderPlan {
    let selected = character_ids.iter().copied().collect::<HashSet<_>>();
    let mut entries = vec![
        FirstNightActionRef::system("dusk"),
        FirstNightActionRef::system("minionInfo"),
        FirstNightActionRef::system("demonInfo"),
    ];
    for (character_id, action_id) in FIRST_NIGHT_ACTIONS {
        if selected.contains(character_id) {
            entries.push(FirstNightActionRef::Character {
                character_id: character_id.to_string(),
                action_id: action_id.to_string(),
            });
        }
    }
    entries.push(FirstNightActionRef::system("dawn"));
    FirstNightOrderPlan(entries)
}

pub(super) fn complete_order_json(character_ids: &[&str]) -> Value {
    serde_json::to_value(complete_order(character_ids)).expect("test plan should serialize")
}

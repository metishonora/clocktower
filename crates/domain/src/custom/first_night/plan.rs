use std::collections::HashSet;

use crate::{
    characters::{resolve_custom_script, ResolvedScriptContext},
    contracts::{
        CustomFirstNightPlanResult, CustomScriptDefinition, FirstNightActionRef,
        FirstNightOrderPlan, FirstNightPlanSource, SystemFirstNightActionId,
    },
    error::{CoreError, ErrorKind},
};

// Snapshot of TPI botc-release resources/data/nightsheet.json `firstNight`, filtered to the
// currently supported TB/S&V action catalog. This is deliberately not a merge of script-local
// ranks. Persisted defaults must only change as an explicit contract migration.
const GLOBAL_CHARACTER_ORDER: [(&str, &str); 18] = [
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

fn character(character_id: &str, action_id: &str) -> FirstNightActionRef {
    FirstNightActionRef::Character {
        character_id: character_id.to_string(),
        action_id: action_id.to_string(),
    }
}

fn default_plan(context: &ResolvedScriptContext) -> FirstNightOrderPlan {
    let mut entries = vec![FirstNightActionRef::system("dusk")];
    for (character_id, action_id) in GLOBAL_CHARACTER_ORDER {
        if character_id == "poisoner" {
            entries.push(FirstNightActionRef::system("minionInfo"));
            entries.push(FirstNightActionRef::system("demonInfo"));
        }
        if context.contains(character_id) {
            entries.push(character(character_id, action_id));
        }
    }
    entries.push(FirstNightActionRef::system("dawn"));
    FirstNightOrderPlan(entries)
}

fn expected_actions(context: &ResolvedScriptContext) -> HashSet<FirstNightActionRef> {
    default_plan(context).0.into_iter().collect()
}

pub(crate) fn validate_plan(
    context: &ResolvedScriptContext,
    plan: &FirstNightOrderPlan,
) -> Result<(), CoreError> {
    let Some(FirstNightActionRef::System {
        action_id: SystemFirstNightActionId::Dusk,
    }) = plan.0.first()
    else {
        return Err(ErrorKind::InvalidFirstNightOrderPlan.into_error());
    };
    let Some(FirstNightActionRef::System {
        action_id: SystemFirstNightActionId::Dawn,
    }) = plan.0.last()
    else {
        return Err(ErrorKind::InvalidFirstNightOrderPlan.into_error());
    };

    if plan.0.iter().any(|entry| match entry {
        FirstNightActionRef::Character {
            character_id,
            action_id,
        } => character_id.trim().is_empty() || action_id.trim().is_empty(),
        FirstNightActionRef::System { .. } => false,
    }) {
        return Err(ErrorKind::InvalidFirstNightOrderPlan.into_error());
    }

    let actual = plan.0.iter().cloned().collect::<HashSet<_>>();
    let expected = expected_actions(context);
    if actual.len() != plan.0.len() || actual != expected {
        return Err(ErrorKind::InvalidFirstNightOrderPlan.into_error());
    }
    Ok(())
}

pub(crate) fn effective_plan(
    definition: &CustomScriptDefinition,
) -> Result<CustomFirstNightPlanResult, CoreError> {
    let context = resolve_custom_script(definition)?;
    if let Some(plan) = definition.first_night_order.clone() {
        validate_plan(&context, &plan)?;
        Ok(CustomFirstNightPlanResult {
            source: FirstNightPlanSource::Definition,
            plan,
        })
    } else {
        Ok(CustomFirstNightPlanResult {
            source: FirstNightPlanSource::Default,
            plan: default_plan(&context),
        })
    }
}

pub(crate) fn plan_for_definition(
    definition: &CustomScriptDefinition,
) -> Result<FirstNightOrderPlan, CoreError> {
    effective_plan(definition).map(|result| result.plan)
}

use std::collections::HashSet;

use crate::{
    characters::{
        resolve_custom_script, resolve_custom_script_ids, validate_custom_script_definition,
        validate_custom_script_definition_draft, ResolvedScriptContext,
    },
    contracts::{
        CustomFirstNightPlanResult, CustomScriptDefinition, CustomScriptDefinitionDraft,
        FirstNightActionRef, FirstNightOrderPlan, FirstNightPlanSource, SystemFirstNightActionId,
    },
    error::{CoreError, ErrorKind},
};

use super::catalog::{ORDERED_ACTIONS, SYSTEM_ACTIONS};

fn character(character_id: &str, action_id: &str) -> FirstNightActionRef {
    FirstNightActionRef::Character {
        character_id: character_id.to_string(),
        action_id: action_id.to_string(),
    }
}

fn default_plan(context: &ResolvedScriptContext) -> FirstNightOrderPlan {
    let mut entries = vec![FirstNightActionRef::system("dusk")];
    for (character_id, action_id) in ORDERED_ACTIONS {
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
    let mut expected = HashSet::with_capacity(ORDERED_ACTIONS.len() + SYSTEM_ACTIONS.len());
    expected.extend(
        SYSTEM_ACTIONS
            .into_iter()
            .map(|action_id| FirstNightActionRef::System { action_id }),
    );
    expected.extend(
        ORDERED_ACTIONS
            .into_iter()
            .filter(|(character_id, _)| context.contains(character_id))
            .map(|(character_id, action_id)| character(character_id, action_id)),
    );
    expected
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

pub(crate) fn plan_for_definition(
    definition: &CustomScriptDefinition,
) -> Result<FirstNightOrderPlan, CoreError> {
    validate_custom_script_definition(definition)?;
    let context = resolve_custom_script(definition)?;
    validate_plan(&context, &definition.first_night_order)?;
    validate_other_plan(&context, &definition.other_night_order)?;
    Ok(definition.first_night_order.clone())
}

pub(crate) fn plan_for_draft(
    definition: &CustomScriptDefinitionDraft,
) -> Result<CustomFirstNightPlanResult, CoreError> {
    validate_custom_script_definition_draft(definition)?;
    let context = resolve_custom_script_ids(&definition.character_ids)?;
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

/// Authoring only. Never called as a fallback by completed definition or replay paths.
pub(crate) fn default_other_plan(
    context: &ResolvedScriptContext,
) -> crate::contracts::OtherNightOrderPlan {
    crate::contracts::OtherNightOrderPlan(
        std::iter::once(FirstNightActionRef::system("dusk"))
            .chain(
                super::catalog::OTHER_ORDERED_ACTIONS
                    .iter()
                    .filter(|(id, _)| context.contains(id))
                    .map(|(id, action)| character(id, action)),
            )
            .chain(std::iter::once(FirstNightActionRef::system("dawn")))
            .collect(),
    )
}
pub(crate) fn validate_other_plan(
    context: &ResolvedScriptContext,
    plan: &crate::contracts::OtherNightOrderPlan,
) -> Result<(), CoreError> {
    let entries = &plan.0;
    let expected = default_other_plan(context)
        .0
        .into_iter()
        .collect::<HashSet<_>>();
    let actual = entries.iter().cloned().collect::<HashSet<_>>();
    if entries.first() != Some(&FirstNightActionRef::system("dusk"))
        || entries.last() != Some(&FirstNightActionRef::system("dawn"))
        || actual.len() != entries.len()
        || actual != expected
    {
        return Err(ErrorKind::InvalidOtherNightOrderPlan.into_error());
    }
    Ok(())
}
pub(crate) fn other_plan_for_draft(
    definition: &CustomScriptDefinitionDraft,
) -> Result<CustomFirstNightPlanResult, CoreError> {
    validate_custom_script_definition_draft(definition)?;
    let context = resolve_custom_script_ids(&definition.character_ids)?;
    let (source, plan) = if let Some(plan) = &definition.other_night_order {
        validate_other_plan(&context, plan)?;
        (FirstNightPlanSource::Definition, plan.clone())
    } else {
        (FirstNightPlanSource::Default, default_other_plan(&context))
    };
    Ok(CustomFirstNightPlanResult {
        source,
        plan: FirstNightOrderPlan(plan.0),
    })
}

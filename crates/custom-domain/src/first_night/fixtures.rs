//! Build-gated Character handlers used by the Issue #206 contract tests.
//!
//! These handlers exercise the canonical draft, validation, reducer, scheduler, and projection
//! seams without claiming to implement any production Character rule. The small state-changing
//! outcomes are compiled for domain unit tests and the dedicated `custom-runtime-fixtures` WASM
//! build only. The default generated WASM contains just the system registrations.

use crate::{
    contracts::{CustomActionResult, FirstNightActionRef},
    error::{CoreError, ErrorKind},
    input::{required_none, validate_required_input},
    model::{
        Phase, PhaseStep, PhaseStepSupport, RequiredInput, RequiredInputKind, StepInput,
        StepInputFields, StepType,
    },
    state::ActionOccurrence,
};

use super::{
    ActionContext, ActionEventDraft, ActionHandler, ActionSpec, ActiveAbilityInstance,
    RegisteredAction, ValidatedActionEvent,
};
use crate::event::CustomFactChanges;

#[cfg(feature = "custom-runtime-fixtures")]
use crate::{
    contracts::{ActiveImpairment, ImpairmentExpiry, ImpairmentKind},
    input::required_characters,
    model::{AbilityUseRef, IdentityState, PlayerIdentityTransition},
};

const FIXTURE_SOURCE_EVENT_ID: &str = "fixture-proposal";

fn fixture_action() -> FirstNightActionRef {
    FirstNightActionRef::Character {
        character_id: "washerwoman".to_string(),
        action_id: "learnTownsfolk".to_string(),
    }
}

#[cfg(feature = "custom-runtime-fixtures")]
fn action(character_id: &str, action_id: &str) -> FirstNightActionRef {
    FirstNightActionRef::Character {
        character_id: character_id.to_string(),
        action_id: action_id.to_string(),
    }
}

#[cfg(feature = "custom-runtime-fixtures")]
fn identity_action() -> FirstNightActionRef {
    action("librarian", "learnOutsider")
}

#[cfg(feature = "custom-runtime-fixtures")]
fn identity_pending_action() -> FirstNightActionRef {
    action("butler", "chooseMaster")
}

#[cfg(feature = "custom-runtime-fixtures")]
fn loss_action() -> FirstNightActionRef {
    action("chef", "learnEvilPairs")
}

#[cfg(feature = "custom-runtime-fixtures")]
fn life_action() -> FirstNightActionRef {
    action("mathematician", "learnCount")
}

#[cfg(feature = "custom-runtime-fixtures")]
fn impairment_add_action() -> FirstNightActionRef {
    action("clockmaker", "learnSteps")
}

#[cfg(feature = "custom-runtime-fixtures")]
fn impairment_remove_action() -> FirstNightActionRef {
    action("spy", "inspectGrimoire")
}

#[cfg(feature = "custom-runtime-fixtures")]
fn information_action() -> FirstNightActionRef {
    action("dreamer", "learnCharacters")
}

#[cfg(feature = "custom-runtime-fixtures")]
fn identity_target(action_ref: &FirstNightActionRef) -> Option<&'static str> {
    if action_ref == &identity_action() {
        Some("spy")
    } else if action_ref == &identity_pending_action() {
        Some("washerwoman")
    } else {
        None
    }
}

/// Fixed grant targets are deliberately finite and action-specific. The result does not accept a
/// caller-selected arbitrary Character, and the registry still checks definition membership.
#[cfg(feature = "custom-runtime-fixtures")]
fn grant_target(action_ref: &FirstNightActionRef) -> Option<&'static str> {
    if action_ref == &action("philosopher", "chooseAbility") {
        return Some("washerwoman");
    }
    if action_ref == &action("investigator", "learnMinion") {
        return Some("spy");
    }
    if action_ref == &action("seamstress", "compareAlignments") {
        return Some("dreamer");
    }
    if action_ref == &action("empath", "learnEvilNeighbors") {
        return Some("mathematician");
    }
    None
}

/// Activation policy owned by this fixture rather than by the production runtime. Each fixed
/// grant target exercises one of the four scheduler decisions. Existing C behavior remains the
/// same: Philosopher granting Washerwoman joins an unpassed ordered entry.
#[cfg(feature = "custom-runtime-fixtures")]
#[derive(Debug, Copy, Clone, Default)]
pub(super) struct FixtureActivation;

#[cfg(feature = "custom-runtime-fixtures")]
impl super::activation::ActivationRule for FixtureActivation {
    fn decide(
        &self,
        context: &super::activation::ActivationContext<'_>,
    ) -> Result<super::activation::ActivationDecision, CoreError> {
        let target = match context.event {
            ValidatedActionEvent::Custom(event) => event
                .fact_changes()
                .ability_grants()
                .first()
                .map(|grant| grant.character_id.as_str()),
            ValidatedActionEvent::System(_) => None,
        };
        let decision = match target {
            Some("washerwoman") => super::activation::ActivationDecision::JoinPendingOrder,
            Some("spy") => super::activation::ActivationDecision::RunImmediately,
            Some("dreamer") => super::activation::ActivationDecision::Defer,
            Some("mathematician") => super::activation::ActivationDecision::NoAction,
            _ => super::activation::ActivationDecision::NoAction,
        };
        Ok(decision)
    }
}

struct FixtureHandler {
    action_ref: FirstNightActionRef,
}

impl ActionHandler for FixtureHandler {
    fn action_ref(&self) -> &FirstNightActionRef {
        &self.action_ref
    }

    fn project(
        &self,
        _spec: &ActionSpec,
        context: &ActionContext<'_>,
    ) -> Result<Vec<PhaseStep>, CoreError> {
        let instances = context
            .rule_service
            .try_owned_instances(&self.action_ref)?
            .into_iter()
            .filter(|instance| participates(&self.action_ref, instance, context))
            .collect::<Vec<_>>();
        instances
            .into_iter()
            .map(|instance| {
                let required_input = required_input_for(&self.action_ref, context);
                project_instance(&self.action_ref, instance, required_input)
            })
            .collect()
    }

    fn propose(
        &self,
        _spec: &ActionSpec,
        context: &ActionContext<'_>,
        occurrence: &ActionOccurrence,
        input: &StepInput,
    ) -> Result<ActionEventDraft, CoreError> {
        let ability_use = occurrence
            .ability_use
            .clone()
            .ok_or_else(|| ErrorKind::InvalidFirstNightActionProvenance.into_error())?;
        let result = propose_result(&self.action_ref, context, &ability_use, input)?;
        Ok(ActionEventDraft::Custom(
            crate::event::CustomActionEventDraft {
                simulation_source: None,
                follow_up_cause: None,
                action_cause: None,
                delivered_result: None,
                registration_judgments: vec![],
                step_id: occurrence.step_id()?,
                action_ref: self.action_ref.clone(),
                ability_use: Some(ability_use),
                input: input.clone(),
                result,
            },
        ))
    }

    fn validate_event(
        &self,
        spec: &ActionSpec,
        context: &ActionContext<'_>,
        occurrence: &ActionOccurrence,
        draft: &ActionEventDraft,
    ) -> Result<CustomFactChanges, CoreError> {
        self.validate_event_for_id(spec, context, occurrence, draft, FIXTURE_SOURCE_EVENT_ID)
    }

    #[cfg(feature = "custom-runtime-fixtures")]
    fn validate_event_with_id(
        &self,
        spec: &ActionSpec,
        context: &ActionContext<'_>,
        occurrence: &ActionOccurrence,
        draft: &ActionEventDraft,
        event_id: &str,
    ) -> Result<CustomFactChanges, CoreError> {
        self.validate_event_for_id(spec, context, occurrence, draft, event_id)
    }
}

impl FixtureHandler {
    fn validate_event_for_id(
        &self,
        _spec: &ActionSpec,
        context: &ActionContext<'_>,
        occurrence: &ActionOccurrence,
        draft: &ActionEventDraft,
        event_id: &str,
    ) -> Result<CustomFactChanges, CoreError> {
        let ActionEventDraft::Custom(custom) = draft else {
            return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
        };
        let expected_ability = occurrence
            .ability_use
            .clone()
            .ok_or_else(|| ErrorKind::InvalidFirstNightActionProvenance.into_error())?;

        #[cfg(not(feature = "custom-runtime-fixtures"))]
        {
            let _ = (context, expected_ability, event_id);
            if custom.input.is_some() || !matches!(custom.result, CustomActionResult::NoEffect) {
                return Err(ErrorKind::FirstNightActionHandlerUnavailable.into_error());
            }
            return Ok(CustomFactChanges::default());
        }

        #[cfg(feature = "custom-runtime-fixtures")]
        {
            let facts = context
                .rule_service
                .facts()
                .ok_or_else(|| ErrorKind::InvalidFirstNightActionProvenance.into_error())?;
            validate_result(
                &self.action_ref,
                context,
                facts,
                &expected_ability,
                &custom.input,
                &custom.result,
                event_id,
            )
        }
    }
}

#[cfg(feature = "custom-runtime-fixtures")]
fn propose_result(
    action_ref: &FirstNightActionRef,
    context: &ActionContext<'_>,
    ability_use: &crate::model::AbilityUseRef,
    input: &StepInput,
) -> Result<CustomActionResult, CoreError> {
    let facts = context
        .rule_service
        .facts()
        .ok_or_else(|| ErrorKind::InvalidFirstNightActionProvenance.into_error())?;
    if let Some(target) = grant_target(action_ref) {
        validate_grant_input(input, target)?;
        context.rule_service.validate_character_membership(target)?;
        return Ok(CustomActionResult::FixtureAbilityGranted {
            target_character_id: target.to_string(),
        });
    }
    if *action_ref == fixture_action() {
        if input.is_some() {
            return Err(ErrorKind::InvalidStepInput.into_error());
        }
        return Ok(CustomActionResult::NoEffect);
    }
    if let Some(target_character_id) = identity_target(action_ref) {
        if input.is_some() {
            return Err(ErrorKind::InvalidStepInput.into_error());
        }
        context
            .rule_service
            .validate_character_membership(target_character_id)?;
        return Ok(CustomActionResult::FixtureIdentityChanged {
            player_id: ability_use.owner_player_id.clone(),
            target_character_id: target_character_id.to_string(),
        });
    }
    if *action_ref == loss_action() {
        if input.is_some() {
            return Err(ErrorKind::InvalidStepInput.into_error());
        }
        return Ok(first_grant(facts)
            .map(|grant| CustomActionResult::FixtureAbilityRemoved {
                owner_player_id: grant.owner_player_id.clone(),
                character_id: grant.character_id.clone(),
                ability_instance_id: grant.ability_instance_id.clone(),
            })
            .unwrap_or(CustomActionResult::NoEffect));
    }
    if *action_ref == life_action() {
        let player_id = one_player_input(input)?;
        ensure_player(facts, &player_id)?;
        return Ok(CustomActionResult::FixtureLifeChanged {
            player_id,
            alive: false,
        });
    }
    if *action_ref == impairment_add_action() {
        let player_id = one_player_input(input)?;
        ensure_player(facts, &player_id)?;
        return Ok(CustomActionResult::FixtureImpairmentAdded {
            player_id,
            impairment_kind: ImpairmentKind::Poisoned,
        });
    }
    if *action_ref == impairment_remove_action() {
        if input.is_some() {
            return Err(ErrorKind::InvalidStepInput.into_error());
        }
        return Ok(first_impairment(facts)
            .map(|impairment| CustomActionResult::FixtureImpairmentRemoved {
                player_id: impairment.player_id.clone(),
                impairment_kind: impairment.kind,
                source_event_id: impairment.source_event_id.clone(),
                source_character_id: impairment.source_character_id.clone(),
                expires: impairment.expires,
            })
            .unwrap_or(CustomActionResult::NoEffect));
    }
    if *action_ref == information_action() {
        if input.is_some() {
            return Err(ErrorKind::InvalidStepInput.into_error());
        }
        return Ok(CustomActionResult::Information {
            value: crate::model::InformationResult::CharacterPair {
                character_ids: vec![
                    ability_use.character_id.clone(),
                    ability_use.character_id.clone(),
                ],
            },
        });
    }
    Err(ErrorKind::FirstNightActionHandlerUnavailable.into_error())
}

#[cfg(not(feature = "custom-runtime-fixtures"))]
fn propose_result(
    action_ref: &FirstNightActionRef,
    _context: &ActionContext<'_>,
    _ability_use: &crate::model::AbilityUseRef,
    input: &StepInput,
) -> Result<CustomActionResult, CoreError> {
    // Preserve the original feature-off Washerwoman fixture used by the domain contract tests.
    // All state-changing fixture actions are absent from this build and therefore unavailable.
    if *action_ref == fixture_action() {
        if input.is_some() {
            return Err(ErrorKind::InvalidStepInput.into_error());
        }
        return Ok(CustomActionResult::NoEffect);
    }
    Err(ErrorKind::FirstNightActionHandlerUnavailable.into_error())
}

#[cfg(feature = "custom-runtime-fixtures")]
fn validate_result(
    action_ref: &FirstNightActionRef,
    context: &ActionContext<'_>,
    facts: &crate::state::CustomGameFacts,
    expected_ability: &crate::model::AbilityUseRef,
    input: &StepInput,
    result: &CustomActionResult,
    event_id: &str,
) -> Result<CustomFactChanges, CoreError> {
    if let Some(target) = grant_target(action_ref) {
        validate_grant_input(input, target)?;
        if !matches!(
            result,
            CustomActionResult::FixtureAbilityGranted { target_character_id }
                if target_character_id == target
        ) {
            return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
        }
        context.rule_service.validate_character_membership(target)?;
        return Ok(CustomFactChanges::fixture_ability_grant(
            crate::event::AbilityGrantChange {
                owner_player_id: expected_ability.owner_player_id.clone(),
                character_id: target.to_string(),
                source: expected_ability.clone(),
            },
        ));
    }
    if *action_ref == fixture_action() {
        if input.is_some() || !matches!(result, CustomActionResult::NoEffect) {
            return Err(ErrorKind::InvalidStepInput.into_error());
        }
        return Ok(CustomFactChanges::default());
    }
    if let Some(expected_target_character_id) = identity_target(action_ref) {
        if input.is_some() {
            return Err(ErrorKind::InvalidStepInput.into_error());
        }
        let CustomActionResult::FixtureIdentityChanged {
            player_id,
            target_character_id,
        } = result
        else {
            return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
        };
        if player_id != &expected_ability.owner_player_id
            || target_character_id != expected_target_character_id
        {
            return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
        }
        context
            .rule_service
            .validate_character_membership(target_character_id)?;
        let player = facts
            .players
            .iter()
            .find(|player| player.id == *player_id)
            .ok_or_else(|| ErrorKind::InvalidFirstNightActionProvenance.into_error())?;
        if player.actual_character == *target_character_id {
            return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
        }
        return Ok(CustomFactChanges::fixture_identity_change(
            PlayerIdentityTransition {
                player_id: player.id.clone(),
                before: identity_state(player),
                after: IdentityState {
                    actual_character: target_character_id.clone(),
                    shown_character: target_character_id.clone(),
                    alignment: crate::characters::custom_script_catalog()
                        .into_iter()
                        .find(|entry| entry.id == target_character_id)
                        .map(|entry| entry.kind.alignment())
                        .ok_or_else(|| ErrorKind::CharacterNotInScript.into_error())?,
                },
            },
        ));
    }
    if *action_ref == loss_action() {
        if input.is_some() {
            return Err(ErrorKind::InvalidStepInput.into_error());
        }
        let Some(grant) = first_grant(facts) else {
            if matches!(result, CustomActionResult::NoEffect) {
                return Ok(CustomFactChanges::default());
            }
            return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
        };
        let CustomActionResult::FixtureAbilityRemoved {
            owner_player_id,
            character_id,
            ability_instance_id,
        } = result
        else {
            return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
        };
        if owner_player_id != &grant.owner_player_id
            || character_id != &grant.character_id
            || ability_instance_id != &grant.ability_instance_id
        {
            return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
        }
        return Ok(CustomFactChanges::fixture_ability_removal(AbilityUseRef {
            owner_player_id: owner_player_id.clone(),
            character_id: character_id.clone(),
            ability_instance_id: ability_instance_id.clone(),
        }));
    }
    if *action_ref == life_action() {
        let expected_player_id = one_player_input(input)?;
        let CustomActionResult::FixtureLifeChanged { player_id, alive } = result else {
            return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
        };
        if player_id != &expected_player_id || *alive {
            return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
        }
        let player = ensure_player(facts, player_id)?;
        if !player.alive {
            return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
        }
        return Ok(CustomFactChanges::fixture_life_change(
            crate::event::PlayerLifeChange {
                player_id: player_id.clone(),
                alive: false,
            },
        ));
    }
    if *action_ref == impairment_add_action() {
        let expected_player_id = one_player_input(input)?;
        let CustomActionResult::FixtureImpairmentAdded {
            player_id,
            impairment_kind,
        } = result
        else {
            return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
        };
        if player_id != &expected_player_id || *impairment_kind != ImpairmentKind::Poisoned {
            return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
        }
        ensure_player(facts, player_id)?;
        if facts
            .active_impairments
            .iter()
            .any(|impairment| impairment.player_id == *player_id)
        {
            return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
        }
        return Ok(CustomFactChanges::fixture_impairment_addition(
            ActiveImpairment {
                kind: *impairment_kind,
                player_id: player_id.clone(),
                source_event_id: event_id.to_string(),
                source_character_id: expected_ability.character_id.clone(),
                expires: ImpairmentExpiry::Never,
            },
        ));
    }
    if *action_ref == impairment_remove_action() {
        if input.is_some() {
            return Err(ErrorKind::InvalidStepInput.into_error());
        }
        let Some(expected) = first_impairment(facts) else {
            if matches!(result, CustomActionResult::NoEffect) {
                return Ok(CustomFactChanges::default());
            }
            return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
        };
        let CustomActionResult::FixtureImpairmentRemoved {
            player_id,
            impairment_kind,
            source_event_id,
            source_character_id,
            expires,
        } = result
        else {
            return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
        };
        let actual = ActiveImpairment {
            kind: *impairment_kind,
            player_id: player_id.clone(),
            source_event_id: source_event_id.clone(),
            source_character_id: source_character_id.clone(),
            expires: *expires,
        };
        if *expected != actual {
            return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
        }
        return Ok(CustomFactChanges::fixture_impairment_removal(
            expected.clone(),
        ));
    }
    if *action_ref == information_action() {
        if input.is_some()
            || !matches!(
                result,
                CustomActionResult::Information {
                    value: crate::model::InformationResult::CharacterPair { character_ids }
                } if character_ids == &vec![
                    expected_ability.character_id.clone(),
                    expected_ability.character_id.clone(),
                ]
            )
        {
            return Err(ErrorKind::InvalidStepInput.into_error());
        }
        context
            .rule_service
            .validate_character_membership(&expected_ability.character_id)?;
        return Ok(CustomFactChanges::default());
    }
    Err(ErrorKind::FirstNightActionHandlerUnavailable.into_error())
}

#[cfg(feature = "custom-runtime-fixtures")]
fn validate_grant_input(input: &StepInput, target: &str) -> Result<(), CoreError> {
    let required = required_characters(1, 1, Some(vec![target.to_string()]), false);
    validate_required_input(&required, input, &[])?;
    let expected = Some(StepInputFields {
        character_ids: Some(vec![target.to_string()]),
        ..StepInputFields::default()
    });
    if input != &expected {
        return Err(ErrorKind::InvalidStepInput.into_error());
    }
    Ok(())
}

#[cfg(feature = "custom-runtime-fixtures")]
fn one_player_input(input: &StepInput) -> Result<String, CoreError> {
    let Some(value) = input.as_ref() else {
        return Err(ErrorKind::MissingStepInput.into_error());
    };
    let Some(player_ids) = value.player_ids.as_ref() else {
        return Err(ErrorKind::InvalidStepInput.into_error());
    };
    if player_ids.len() != 1
        || input
            != &Some(StepInputFields {
                player_ids: Some(player_ids.clone()),
                ..StepInputFields::default()
            })
    {
        return Err(ErrorKind::InvalidStepInput.into_error());
    }
    Ok(player_ids[0].clone())
}

#[cfg(feature = "custom-runtime-fixtures")]
fn ensure_player<'a>(
    facts: &'a crate::state::CustomGameFacts,
    player_id: &str,
) -> Result<&'a crate::model::Player, CoreError> {
    facts
        .players
        .iter()
        .find(|player| player.id == player_id)
        .ok_or_else(|| ErrorKind::InvalidStepInput.into_error())
}

#[cfg(feature = "custom-runtime-fixtures")]
fn first_grant(facts: &crate::state::CustomGameFacts) -> Option<&crate::model::AbilityGrant> {
    facts.ability_grants.first()
}

#[cfg(feature = "custom-runtime-fixtures")]
fn first_impairment(facts: &crate::state::CustomGameFacts) -> Option<&ActiveImpairment> {
    facts.active_impairments.first()
}

#[cfg(feature = "custom-runtime-fixtures")]
fn identity_state(player: &crate::model::Player) -> IdentityState {
    IdentityState {
        actual_character: player.actual_character.clone(),
        shown_character: player.shown_character.clone(),
        alignment: player.alignment,
    }
}

#[cfg(feature = "custom-runtime-fixtures")]
fn participates(
    action_ref: &FirstNightActionRef,
    instance: &ActiveAbilityInstance,
    context: &ActionContext<'_>,
) -> bool {
    // Washerwoman intentionally remains projected while impaired. The finite Mathematician life
    // action and Dreamer information action use the normal living/unimpaired predicate, proving
    // these questions stay action-owned rather than being collapsed into one shared filter.
    if *action_ref != action("mathematician", "learnCount") && *action_ref != information_action() {
        return true;
    }
    let Some(facts) = context.rule_service.facts() else {
        return true;
    };
    let Some(player) = facts
        .players
        .iter()
        .find(|player| player.id == instance.ability_use.owner_player_id)
    else {
        return false;
    };
    player.alive
        && !facts
            .active_impairments
            .iter()
            .any(|impairment| impairment.player_id == player.id)
}

#[cfg(not(feature = "custom-runtime-fixtures"))]
fn participates(
    _action_ref: &FirstNightActionRef,
    _instance: &ActiveAbilityInstance,
    _context: &ActionContext<'_>,
) -> bool {
    true
}

fn project_instance(
    action_ref: &FirstNightActionRef,
    instance: ActiveAbilityInstance,
    required_input: RequiredInput,
) -> Result<PhaseStep, CoreError> {
    let occurrence = ActionOccurrence::character(action_ref.clone(), instance.ability_use.clone())?;
    Ok(PhaseStep {
                    execution: None,
                    information_flow: None,
                    madness: None,
        simulation_source: None,
        follow_up_cause: None,
        action_cause: None,
        id: occurrence.step_id()?,
        phase: Phase::FirstNight,
        step_type: StepType::Character,
        character: Some(instance.ability_use.character_id.clone()),
        player_id: Some(instance.ability_use.owner_player_id.clone()),
        ability_use: Some(instance.ability_use),
        ability_origin: Some(instance.ability_origin),
        required_input,
        can_skip: false,
        support: PhaseStepSupport::Automated,
        information_prompt: None,
        pre_action_reveal: None,
        action_ref: Some(action_ref.clone()),
    })
}

fn required_input_for(
    action_ref: &FirstNightActionRef,
    context: &ActionContext<'_>,
) -> RequiredInput {
    #[cfg(feature = "custom-runtime-fixtures")]
    {
        if let Some(target) = grant_target(action_ref) {
            return required_characters(1, 1, Some(vec![target.to_string()]), false);
        }
        if *action_ref == life_action() || *action_ref == impairment_add_action() {
            let mut required = required_none();
            required.kind = RequiredInputKind::PlayerIds;
            required.target = Some(crate::model::InputTarget::Player);
            required.min_selections = Some(1);
            required.max_selections = Some(1);
            required.allowed_player_ids = context.rule_service.facts().map(|facts| {
                facts
                    .players
                    .iter()
                    .map(|player| player.id.clone())
                    .collect()
            });
            return required;
        }
    }
    let _ = (action_ref, context);
    required_none()
}

/// Default registrations retain the small C fixture pair for domain contract tests. The
/// additional finite state fixtures are compiled only into the generated fixture artifact.
pub(super) fn registrations() -> Vec<RegisteredAction> {
    let mut registrations = vec![RegisteredAction {
        spec: ActionSpec {
            prerequisites: vec![],
            continuation_sources: vec![],
            action_ref: fixture_action(),
            participates_in_first_night: true,
            required_input_kind: RequiredInputKind::None,
            support: PhaseStepSupport::Automated,
        },
        handler: Box::new(FixtureHandler {
            action_ref: fixture_action(),
        }),
    }];

    #[cfg(feature = "custom-runtime-fixtures")]
    {
        let character_actions = [
            ("philosopher", "chooseAbility"),
            ("investigator", "learnMinion"),
            ("seamstress", "compareAlignments"),
            ("empath", "learnEvilNeighbors"),
            ("librarian", "learnOutsider"),
            ("butler", "chooseMaster"),
            ("chef", "learnEvilPairs"),
            ("mathematician", "learnCount"),
            ("clockmaker", "learnSteps"),
            ("spy", "inspectGrimoire"),
            ("dreamer", "learnCharacters"),
        ];
        for (character_id, action_id) in character_actions {
            let action_ref = action(character_id, action_id);
            if action_ref == fixture_action() {
                continue;
            }
            registrations.push(RegisteredAction {
                spec: ActionSpec {
                    prerequisites: vec![],
                    continuation_sources: vec![],
                    action_ref: action_ref.clone(),
                    participates_in_first_night: true,
                    required_input_kind: if grant_target(&action_ref).is_some() {
                        RequiredInputKind::CharacterIds
                    } else if action_ref == life_action() || action_ref == impairment_add_action() {
                        RequiredInputKind::PlayerIds
                    } else {
                        RequiredInputKind::None
                    },
                    support: PhaseStepSupport::Automated,
                },
                handler: Box::new(FixtureHandler { action_ref }),
            });
        }
    }
    registrations
}

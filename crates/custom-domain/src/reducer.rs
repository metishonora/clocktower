//! Pure replay reducer for custom-game facts.
//!
//! The reducer consumes an event that has already crossed the custom event validation boundary.
//! It calculates a new facts value and never mutates its input.  The finite fact-change collection
//! lives in `event.rs`; no JSON value, arbitrary patch, cursor command, or scheduler decision is
//! accepted here.

use std::collections::HashSet;

use crate::{
    characters::ResolvedScriptContext,
    contracts::ActiveImpairment,
    error::{CoreError, ErrorKind},
    model::{
        AbilityInstance, AbilityInstanceId, AbilityOrigin, AbilityUseRef, IdentityHistoryEntry,
        IdentityState, Player, PlayerIdentityTransition,
    },
    setup::validate_custom_character_membership,
};

use super::{
    event::{AbilityGrantChange, CustomFactChanges, PlayerLifeChange, ValidatedCustomEvent},
    state::{AbilityProvenance, CustomGameFacts},
};

/// Calculate the facts after one already-validated custom event.
///
/// Validation is intentionally split from this function.  `ValidatedCustomEvent` cannot be
/// created from a wire value, and this reducer still checks that each typed fact is consistent with
/// the preceding facts before adopting a clone.  All checks happen before mutation of the clone so
/// a late failure cannot expose a partially reduced value.
pub(crate) fn reduce_custom_facts(
    context: &ResolvedScriptContext,
    previous: &CustomGameFacts,
    event: &ValidatedCustomEvent,
) -> Result<CustomGameFacts, CoreError> {
    if event.id().trim().is_empty() || event.phase() != crate::model::Phase::FirstNight {
        return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
    }

    validate_changes(context, previous, event)?;

    let mut next = previous.clone();
    apply_changes(&mut next, event)?;
    apply_snv_facts(&mut next, event)?;
    crate::characters::sects_and_violets::resolve_effects(context, &mut next)?;
    Ok(next)
}

/// Alias used by callers that treat the module as the custom facts reducer itself.
pub(crate) fn reduce(
    context: &ResolvedScriptContext,
    previous: &CustomGameFacts,
    event: &ValidatedCustomEvent,
) -> Result<CustomGameFacts, CoreError> {
    reduce_custom_facts(context, previous, event)
}

fn validate_changes(
    context: &ResolvedScriptContext,
    previous: &CustomGameFacts,
    event: &ValidatedCustomEvent,
) -> Result<(), CoreError> {
    let changes = event.fact_changes();
    let mut instance_ids = previous_instance_ids(previous);
    validate_identity_changes(
        context,
        previous,
        event,
        changes.identity_changes(),
        &mut instance_ids,
    )?;
    validate_life_changes(previous, changes.life_changes())?;
    validate_grant_changes(
        context,
        previous,
        event,
        changes.ability_grants(),
        &mut instance_ids,
    )?;
    validate_grant_removals(previous, changes.ability_removals())?;
    validate_impairment_changes(context, previous, event, changes)?;
    Ok(())
}

fn validate_identity_changes(
    context: &ResolvedScriptContext,
    previous: &CustomGameFacts,
    event: &ValidatedCustomEvent,
    changes: &[PlayerIdentityTransition],
    instance_ids: &mut HashSet<AbilityInstanceId>,
) -> Result<(), CoreError> {
    let mut players = HashSet::with_capacity(changes.len());
    for transition in changes {
        if !players.insert(transition.player_id.as_str()) {
            return Err(invalid_fact());
        }
        let player = previous
            .players
            .iter()
            .find(|player| player.id == transition.player_id)
            .ok_or_else(invalid_fact)?;
        if identity_state(player) != transition.before
            || transition.before.actual_character == transition.after.actual_character
        {
            return Err(invalid_fact());
        }
        validate_custom_character_membership(context, &transition.after.actual_character)?;
        validate_custom_character_membership(context, &transition.after.shown_character)?;
        if !instance_ids.insert(AbilityInstanceId::new(event.id(), &transition.player_id)) {
            return Err(invalid_fact());
        }
    }
    Ok(())
}

fn validate_life_changes(
    previous: &CustomGameFacts,
    changes: &[PlayerLifeChange],
) -> Result<(), CoreError> {
    let mut players = HashSet::with_capacity(changes.len());
    for change in changes {
        if !players.insert(change.player_id.as_str()) {
            return Err(invalid_fact());
        }
        let player = previous
            .players
            .iter()
            .find(|player| player.id == change.player_id)
            .ok_or_else(invalid_fact)?;
        if player.alive == change.alive {
            return Err(invalid_fact());
        }
    }
    Ok(())
}

fn validate_grant_changes(
    context: &ResolvedScriptContext,
    previous: &CustomGameFacts,
    event: &ValidatedCustomEvent,
    changes: &[AbilityGrantChange],
    instance_ids: &mut HashSet<AbilityInstanceId>,
) -> Result<(), CoreError> {
    for transition in changes {
        if transition.owner_player_id.trim().is_empty()
            || transition.source.owner_player_id.trim().is_empty()
            || transition.source.character_id.trim().is_empty()
            || transition
                .source
                .ability_instance_id
                .as_str()
                .trim()
                .is_empty()
        {
            return Err(invalid_fact());
        }
        validate_custom_character_membership(context, &transition.character_id)?;
        validate_custom_character_membership(context, &transition.source.character_id)?;
        if !previous
            .players
            .iter()
            .any(|player| player.id == transition.owner_player_id)
        {
            return Err(invalid_fact());
        }
        if !previous
            .players
            .iter()
            .any(|player| player.id == transition.source.owner_player_id)
        {
            return Err(invalid_fact());
        }
        if !recorded_ability_instance(previous, &transition.source) {
            return Err(invalid_fact());
        }

        // Ability instance IDs are deterministic for one event and owner.  Rejecting a collision
        // keeps two grants from silently becoming the same occurrence identity.
        let instance_id = grant_instance_id(event.id(), transition);
        if !instance_ids.insert(instance_id) {
            return Err(invalid_fact());
        }
    }
    Ok(())
}

fn validate_grant_removals(
    previous: &CustomGameFacts,
    removals: &[AbilityUseRef],
) -> Result<(), CoreError> {
    let mut removed = HashSet::with_capacity(removals.len());
    for ability_use in removals {
        if !removed.insert(ability_use_key(ability_use)) {
            return Err(invalid_fact());
        }
        let Some(grant) = previous.ability_grants.iter().find(|grant| {
            grant.owner_player_id == ability_use.owner_player_id
                && grant.character_id == ability_use.character_id
                && grant.ability_instance_id == ability_use.ability_instance_id
        }) else {
            return Err(invalid_fact());
        };
        if grant.owner_player_id.trim().is_empty() || grant.character_id.trim().is_empty() {
            return Err(invalid_fact());
        }
    }
    Ok(())
}

fn validate_impairment_changes(
    context: &ResolvedScriptContext,
    previous: &CustomGameFacts,
    event: &ValidatedCustomEvent,
    changes: &CustomFactChanges,
) -> Result<(), CoreError> {
    let mut additions = HashSet::with_capacity(changes.impairment_additions().len());
    for impairment in changes.impairment_additions() {
        validate_impairment(context, previous, event, impairment)?;
        if !additions.insert(impairment_key(impairment))
            || previous
                .active_impairments
                .iter()
                .any(|existing| existing == impairment)
        {
            return Err(invalid_fact());
        }
    }

    let mut removals = HashSet::with_capacity(changes.impairment_removals().len());
    for impairment in changes.impairment_removals() {
        if !removals.insert(impairment_key(impairment))
            || !previous
                .active_impairments
                .iter()
                .any(|existing| existing == impairment)
        {
            return Err(invalid_fact());
        }
    }
    Ok(())
}

fn validate_impairment(
    context: &ResolvedScriptContext,
    previous: &CustomGameFacts,
    event: &ValidatedCustomEvent,
    impairment: &ActiveImpairment,
) -> Result<(), CoreError> {
    if impairment.source_event_id != event.id()
        || impairment.player_id.trim().is_empty()
        || impairment.source_character_id.trim().is_empty()
        || !previous
            .players
            .iter()
            .any(|player| player.id == impairment.player_id)
    {
        return Err(invalid_fact());
    }
    validate_custom_character_membership(context, &impairment.source_character_id)
}

fn apply_changes(
    next: &mut CustomGameFacts,
    event: &ValidatedCustomEvent,
) -> Result<(), CoreError> {
    for transition in event.fact_changes().identity_changes() {
        apply_identity_change(next, event, transition)?;
    }
    for change in event.fact_changes().life_changes() {
        let player = next
            .players
            .iter_mut()
            .find(|player| player.id == change.player_id)
            .ok_or_else(invalid_fact)?;
        player.alive = change.alive;
    }
    for change in event.fact_changes().ability_grants() {
        let ability_instance_id = grant_instance_id(event.id(), change);
        next.ability_grants.push(crate::model::AbilityGrant {
            owner_player_id: change.owner_player_id.clone(),
            character_id: change.character_id.clone(),
            source_event_id: event.id().to_string(),
            source_ability_instance_id: change.source.ability_instance_id.clone(),
            ability_instance_id: ability_instance_id.clone(),
        });
        next.ability_provenance.push(AbilityProvenance {
            ability_use: AbilityUseRef {
                owner_player_id: change.owner_player_id.clone(),
                character_id: change.character_id.clone(),
                ability_instance_id,
            },
            origin: AbilityOrigin::Acquired {
                acquisition_event_id: event.id().to_string(),
                source: change.source.clone(),
            },
        });
    }
    for ability_use in event.fact_changes().ability_removals() {
        next.ability_grants.retain(|grant| {
            !(grant.owner_player_id == ability_use.owner_player_id
                && grant.character_id == ability_use.character_id
                && grant.ability_instance_id == ability_use.ability_instance_id)
        });
    }
    next.active_impairments
        .extend(event.fact_changes().impairment_additions().iter().cloned());
    for impairment in event.fact_changes().impairment_removals() {
        next.active_impairments
            .retain(|existing| existing != impairment);
    }
    sort_facts(next);
    Ok(())
}

fn apply_identity_change(
    next: &mut CustomGameFacts,
    event: &ValidatedCustomEvent,
    transition: &PlayerIdentityTransition,
) -> Result<(), CoreError> {
    let player = next
        .players
        .iter_mut()
        .find(|player| player.id == transition.player_id)
        .ok_or_else(invalid_fact)?;
    let before = identity_state(player);
    if before != transition.before {
        return Err(invalid_fact());
    }
    player.actual_character = transition.after.actual_character.clone();
    player.shown_character = transition.after.shown_character.clone();
    player.alignment = transition.after.alignment;
    player.ability_instance = AbilityInstance {
        id: AbilityInstanceId::new(event.id(), &player.id),
        character_id: player.actual_character.clone(),
        source_event_id: event.id().to_string(),
    };
    player.identity_history.push(IdentityHistoryEntry {
        source_event_id: event.id().to_string(),
        phase: event.phase(),
        before: transition.before.clone(),
        after: transition.after.clone(),
    });
    next.ability_provenance.push(AbilityProvenance {
        ability_use: AbilityUseRef {
            owner_player_id: player.id.clone(),
            character_id: player.actual_character.clone(),
            ability_instance_id: player.ability_instance.id.clone(),
        },
        origin: AbilityOrigin::IdentityBound,
    });
    // Acquired grants retain their recorded source instance.  A later rule may decide whether an
    // old source remains effective; the reducer must preserve that provenance for replay and undo.
    Ok(())
}

fn grant_instance_id(event_id: &str, change: &AbilityGrantChange) -> AbilityInstanceId {
    // `AbilityInstanceId::new` supplies the canonical opaque ID wrapper.  Encode every identity
    // component with its byte length before concatenating it: raw `:` (or any other delimiter)
    // in an event, Player, Character, or source instance ID must not make two grant tuples share
    // one string identity.
    let source = encode_grant_parts(&[
        event_id,
        &change.source.owner_player_id,
        &change.source.character_id,
        change.source.ability_instance_id.as_str(),
        &change.character_id,
    ]);
    let owner = encode_grant_part(&change.owner_player_id);
    AbilityInstanceId::new(&source, &owner)
}

fn encode_grant_parts(parts: &[&str]) -> String {
    let mut encoded = String::from("customGrant:");
    for part in parts {
        encoded.push_str(&encode_grant_part(part));
    }
    encoded
}

fn encode_grant_part(part: &str) -> String {
    format!("{}#{part}", part.len())
}

fn previous_instance_ids(previous: &CustomGameFacts) -> HashSet<AbilityInstanceId> {
    previous
        .players
        .iter()
        .map(|player| player.ability_instance.id.clone())
        .chain(
            previous
                .ability_grants
                .iter()
                .map(|grant| grant.ability_instance_id.clone()),
        )
        .chain(
            previous
                .ability_provenance
                .iter()
                .map(|record| record.ability_use.ability_instance_id.clone()),
        )
        .collect()
}

/// Check an ability reference against the recorded provenance ledger.  Source activity is a
/// separate participation/effectiveness decision and is intentionally not checked here.
pub(crate) fn recorded_ability_instance(
    facts: &CustomGameFacts,
    ability_use: &AbilityUseRef,
) -> bool {
    recorded_ability(facts, ability_use).is_some()
}

/// Return the one exact provenance record for an ability use.  Duplicate identity records are
/// treated as malformed rather than resolved by whichever order happened to be stored first.
pub(crate) fn recorded_ability<'a>(
    facts: &'a CustomGameFacts,
    ability_use: &AbilityUseRef,
) -> Option<&'a AbilityProvenance> {
    let mut records = facts
        .ability_provenance
        .iter()
        .filter(|record| record.ability_use == *ability_use);
    let record = records.next()?;
    records.next().is_none().then_some(record)
}

/// Resolve the Character for an ability instance recorded by the facts aggregate.  The exact
/// source is retained in the internal ledger; no source Character is guessed from the current
/// Player identity or from an instance-ID naming convention.
pub(crate) fn recorded_ability_character(
    facts: &CustomGameFacts,
    ability_use: &AbilityUseRef,
) -> Option<String> {
    recorded_ability(facts, ability_use).map(|record| record.ability_use.character_id.clone())
}

/// Determine whether an ability reference is currently owned by its Player.  Historical records
/// remain available for provenance checks but are not eligible to act after replacement.
pub(crate) fn current_ability_instance(
    facts: &CustomGameFacts,
    ability_use: &AbilityUseRef,
) -> bool {
    facts.players.iter().any(|player| {
        player.id == ability_use.owner_player_id
            && player.ability_instance.id == ability_use.ability_instance_id
            && player.ability_instance.character_id == ability_use.character_id
    }) || facts.ability_grants.iter().any(|grant| {
        grant.owner_player_id == ability_use.owner_player_id
            && grant.ability_instance_id == ability_use.ability_instance_id
            && grant.character_id == ability_use.character_id
    })
}

fn identity_state(player: &Player) -> IdentityState {
    IdentityState {
        actual_character: player.actual_character.clone(),
        shown_character: player.shown_character.clone(),
        alignment: player.alignment,
    }
}

fn sort_facts(facts: &mut CustomGameFacts) {
    facts.ability_provenance.sort_by(|left, right| {
        left.ability_use
            .owner_player_id
            .cmp(&right.ability_use.owner_player_id)
            .then_with(|| {
                left.ability_use
                    .character_id
                    .cmp(&right.ability_use.character_id)
            })
            .then_with(|| {
                left.ability_use
                    .ability_instance_id
                    .cmp(&right.ability_use.ability_instance_id)
            })
            .then_with(|| {
                provenance_origin_key(&left.origin).cmp(&provenance_origin_key(&right.origin))
            })
    });
    facts.ability_grants.sort_by(|left, right| {
        left.owner_player_id
            .cmp(&right.owner_player_id)
            .then_with(|| left.character_id.cmp(&right.character_id))
            .then_with(|| left.ability_instance_id.cmp(&right.ability_instance_id))
            .then_with(|| left.source_event_id.cmp(&right.source_event_id))
            .then_with(|| {
                left.source_ability_instance_id
                    .cmp(&right.source_ability_instance_id)
            })
    });
    facts.active_impairments.sort_by(|left, right| {
        left.player_id
            .cmp(&right.player_id)
            .then_with(|| left.source_event_id.cmp(&right.source_event_id))
            .then_with(|| left.source_character_id.cmp(&right.source_character_id))
            .then_with(|| impairment_kind_rank(left.kind).cmp(&impairment_kind_rank(right.kind)))
            .then_with(|| {
                impairment_expiry_rank(left.expires).cmp(&impairment_expiry_rank(right.expires))
            })
    });
}

fn provenance_origin_key(origin: &AbilityOrigin) -> (&str, &str, &str, &str, &str) {
    match origin {
        AbilityOrigin::IdentityBound => ("identityBound", "", "", "", ""),
        AbilityOrigin::Acquired {
            acquisition_event_id,
            source,
        } => (
            "acquired",
            acquisition_event_id.as_str(),
            source.owner_player_id.as_str(),
            source.character_id.as_str(),
            source.ability_instance_id.as_str(),
        ),
    }
}

fn impairment_key(impairment: &ActiveImpairment) -> String {
    format!(
        "{}\u{1f}{}\u{1f}{}\u{1f}{:?}\u{1f}{:?}",
        impairment.player_id,
        impairment.source_event_id,
        impairment.source_character_id,
        impairment.kind,
        impairment.expires,
    )
}

fn ability_use_key(ability_use: &AbilityUseRef) -> String {
    format!(
        "{}\u{1f}{}\u{1f}{}",
        ability_use.owner_player_id,
        ability_use.character_id,
        ability_use.ability_instance_id.as_str(),
    )
}

fn impairment_kind_rank(kind: crate::contracts::ImpairmentKind) -> u8 {
    match kind {
        crate::contracts::ImpairmentKind::Poisoned => 0,
        crate::contracts::ImpairmentKind::Drunk => 1,
    }
}

fn impairment_expiry_rank(expiry: crate::contracts::ImpairmentExpiry) -> u8 {
    match expiry {
        crate::contracts::ImpairmentExpiry::Never => 0,
        crate::contracts::ImpairmentExpiry::WhileSourceAbilityActive => 1,
    }
}

fn invalid_fact() -> CoreError {
    ErrorKind::InvalidFirstNightActionProvenance.into_error()
}

fn apply_snv_facts(
    next: &mut CustomGameFacts,
    event: &ValidatedCustomEvent,
) -> Result<(), CoreError> {
    let changes = event.fact_changes().snv();
    let occurrence = event.occurrence()?;
    if occurrence.simulation_source.is_some() && !event.fact_changes().is_empty() {
        // Simulated information may contribute audit, but cannot mutate a real ability or effect.
        if changes.spent.is_some()
            || changes.philosopher_choice.is_some()
            || changes.twin_relationship.is_some()
            || changes.witch_curse.is_some()
            || changes.madness_assignment.is_some()
            || !changes.durable_impairments.is_empty()
            || !event.fact_changes().identity_changes().is_empty()
            || !event.fact_changes().ability_grants().is_empty()
            || !event.fact_changes().ability_removals().is_empty()
            || !event.fact_changes().life_changes().is_empty()
            || !event.fact_changes().impairment_additions().is_empty()
            || !event.fact_changes().impairment_removals().is_empty()
        {
            return Err(invalid_fact());
        }
    }
    if let Some(spent) = &changes.spent {
        if spent.source_event_id != event.id()
            || occurrence.ability_use.as_ref() != Some(&spent.ability_use)
            || next
                .ability_uses
                .iter()
                .any(|used| used.ability_use == spent.ability_use)
        {
            return Err(invalid_fact());
        }
        next.ability_uses.push(spent.clone());
    }
    if let Some(choice) = &changes.philosopher_choice {
        if choice.source_event_id != event.id()
            || occurrence.ability_use.as_ref() != Some(&choice.ability_use)
        {
            return Err(invalid_fact());
        }
        next.philosopher_choices.push(choice.clone());
    }
    if let Some(relation) = &changes.twin_relationship {
        if relation.source_event_id != event.id()
            || occurrence.ability_use.as_ref() != Some(&relation.ability_use)
        {
            return Err(invalid_fact());
        }
        next.twin_relationships.push(relation.clone());
    }
    if let Some(curse) = &changes.witch_curse {
        if curse.source_event_id != event.id()
            || occurrence.ability_use.as_ref() != Some(&curse.ability_use)
        {
            return Err(invalid_fact());
        }
        next.witch_curses.push(curse.clone());
    }
    if let Some(assignment) = &changes.madness_assignment {
        if assignment.source_event_id != event.id()
            || occurrence.ability_use.as_ref() != Some(&assignment.ability_use)
        {
            return Err(invalid_fact());
        }
        next.madness_assignments.push(assignment.clone());
    }
    for impairment in &changes.durable_impairments {
        if impairment.impairment.source_event_id != event.id()
            || occurrence.ability_use.as_ref() != Some(&impairment.source_ability_use)
        {
            return Err(invalid_fact());
        }
        next.durable_impairments.push(impairment.clone());
    }
    for evidence in &changes.audit {
        if evidence.event_id != event.id()
            || evidence.occurrence != occurrence
            || evidence.causes.is_empty()
            || next.player(&evidence.subject_player_id).is_none()
        {
            return Err(invalid_fact());
        }
        next.malfunction_audit.push(evidence.clone());
    }
    for (sequence, transition) in event.fact_changes().identity_changes().iter().enumerate() {
        if matches!(
            event.payload().result,
            crate::contracts::CustomActionResult::SnakeCharmer {
                outcome: crate::contracts::SnakeCharmerOutcome::Swapped,
                ..
            }
        ) {
            next.pending_identity_reveals
                .push(crate::contracts::PendingIdentityReveal {
                    source_event_id: event.id().into(),
                    sequence: sequence as u8,
                    payload: crate::contracts::RevealPayload::CharacterChange {
                        kind: "characterChange",
                        player_id: transition.player_id.clone(),
                        character_id: transition.after.shown_character.clone(),
                        alignment: match transition.after.alignment {
                            crate::model::Alignment::Good => "good",
                            crate::model::Alignment::Evil => "evil",
                        }
                        .into(),
                    },
                });
        }
    }
    next.confirmed_actions
        .push(crate::state::ConfirmedActionFact {
            event_id: event.id().into(),
            occurrence,
            result: event.payload().result.clone(),
        });
    Ok(())
}

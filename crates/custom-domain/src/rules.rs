//! Read-only rule queries over replay-derived custom facts.
//!
//! This service owns no replay cursor and does not calculate Character outcomes.  It only combines
//! the current identity-bound abilities with recorded grants, resolves their provenance, and
//! exposes ownership/fact queries while leaving participation and effectiveness predicates to the
//! action that owns those rules.

use std::cmp::Ordering;

use crate::{
    characters::{custom_demon_bluff_character_ids, ResolvedScriptContext},
    contracts::FirstNightActionRef,
    error::{CoreError, ErrorKind},
    model::{AbilityOrigin, AbilityUseRef, CharacterKind},
};

use super::{
    first_night::{ActiveAbilityInstance, FirstNightRuleService},
    reducer::{current_ability_instance, recorded_ability},
    state::CustomGameFacts,
};

/// Read-only queries needed by the custom first-night registry and future reducer/scheduler layers.
pub(crate) struct CustomRuleService<'a> {
    context: &'a ResolvedScriptContext,
    facts: &'a CustomGameFacts,
}

impl<'a> CustomRuleService<'a> {
    pub(crate) fn new(context: &'a ResolvedScriptContext, facts: &'a CustomGameFacts) -> Self {
        Self { context, facts }
    }

    pub(crate) fn facts(&self) -> &'a CustomGameFacts {
        self.facts
    }

    pub(crate) fn definition_contains(&self, character_id: &str) -> bool {
        self.context.contains(character_id)
    }

    /// Return every currently recorded instance of the action's Character ability.  This query is
    /// about ownership, so an impaired or dead owner remains represented.  Invalid historical
    /// grant provenance is reported by the fallible query rather than synthesized into a different
    /// ability identity.
    pub(crate) fn owned_instances(
        &self,
        action_ref: &FirstNightActionRef,
    ) -> Vec<ActiveAbilityInstance> {
        self.try_owned_instances(action_ref)
            .expect("custom facts must retain exact acquired-ability provenance")
    }

    /// Fallible form used at validation boundaries.  A grant without its exact source record is
    /// malformed internal state; it is reported instead of being silently dropped or assigned a
    /// guessed Character.
    pub(crate) fn try_owned_instances(
        &self,
        action_ref: &FirstNightActionRef,
    ) -> Result<Vec<ActiveAbilityInstance>, CoreError> {
        let FirstNightActionRef::Character { character_id, .. } = action_ref else {
            return Ok(Vec::new());
        };

        let mut instances = self
            .facts
            .players
            .iter()
            .filter(|player| player.actual_character == *character_id)
            .map(|player| ActiveAbilityInstance {
                seat: player.seat,
                ability_use: AbilityUseRef {
                    owner_player_id: player.id.clone(),
                    character_id: character_id.clone(),
                    ability_instance_id: player.ability_instance.id.clone(),
                },
                ability_origin: AbilityOrigin::IdentityBound,
            })
            .collect::<Vec<_>>();

        for grant in self
            .facts
            .ability_grants
            .iter()
            .filter(|grant| grant.character_id == *character_id)
        {
            let owner = self
                .facts
                .players
                .iter()
                .find(|player| player.id == grant.owner_player_id)
                .ok_or_else(|| ErrorKind::InvalidFirstNightActionProvenance.into_error())?;
            let grant_use = AbilityUseRef {
                owner_player_id: grant.owner_player_id.clone(),
                character_id: grant.character_id.clone(),
                ability_instance_id: grant.ability_instance_id.clone(),
            };
            let record = recorded_ability(self.facts, &grant_use)
                .ok_or_else(|| ErrorKind::InvalidFirstNightActionProvenance.into_error())?;
            let AbilityOrigin::Acquired {
                acquisition_event_id,
                source: recorded_source,
            } = &record.origin
            else {
                return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
            };
            if record.ability_use.character_id != grant.character_id
                || *acquisition_event_id != grant.source_event_id
                || recorded_source.ability_instance_id != grant.source_ability_instance_id
                || recorded_ability(self.facts, recorded_source).is_none()
            {
                return Err(ErrorKind::InvalidFirstNightActionProvenance.into_error());
            }
            instances.push(ActiveAbilityInstance {
                seat: owner.seat,
                ability_use: record.ability_use.clone(),
                ability_origin: record.origin.clone(),
            });
        }

        sort_instances(&mut instances);
        Ok(instances)
    }

    /// Apply an action-owned participation predicate to the owned instances.  The common service
    /// supplies facts and identity; it does not decide whether life, impairment, or another
    /// Character-specific condition suppresses an occurrence.
    pub(crate) fn instances_where<P>(
        &self,
        action_ref: &FirstNightActionRef,
        predicate: P,
    ) -> Vec<ActiveAbilityInstance>
    where
        P: Fn(&ActiveAbilityInstance, &CustomGameFacts) -> bool,
    {
        self.owned_instances(action_ref)
            .into_iter()
            .filter(|instance| predicate(instance, self.facts))
            .collect()
    }

    pub(crate) fn owns_ability(&self, ability_use: &AbilityUseRef) -> bool {
        current_ability_instance(self.facts, ability_use)
    }

    pub(crate) fn player_alive(&self, player_id: &str) -> Option<bool> {
        self.facts
            .players
            .iter()
            .find(|player| player.id == player_id)
            .map(|player| player.alive)
    }

    pub(crate) fn is_impaired(&self, player_id: &str) -> bool {
        self.facts
            .active_impairments
            .iter()
            .any(|impairment| impairment.player_id == player_id)
    }

    pub(crate) fn impairments_for(
        &self,
        player_id: &str,
    ) -> Vec<crate::contracts::ActiveImpairment> {
        self.facts
            .active_impairments
            .iter()
            .filter(|impairment| impairment.player_id == player_id)
            .cloned()
            .collect()
    }
}

impl FirstNightRuleService for CustomRuleService<'_> {
    fn active_instances(&self, action_ref: &FirstNightActionRef) -> Vec<ActiveAbilityInstance> {
        self.owned_instances(action_ref)
    }

    fn try_active_instances(
        &self,
        action_ref: &FirstNightActionRef,
    ) -> Result<Vec<ActiveAbilityInstance>, CoreError> {
        self.try_owned_instances(action_ref)
    }

    fn try_owned_instances(
        &self,
        action_ref: &FirstNightActionRef,
    ) -> Result<Vec<ActiveAbilityInstance>, CoreError> {
        CustomRuleService::try_owned_instances(self, action_ref)
    }

    fn facts(&self) -> Option<&CustomGameFacts> {
        Some(self.facts)
    }

    fn simulation_occurrences(
        &self,
        action_ref: &FirstNightActionRef,
    ) -> Result<Vec<crate::state::ActionOccurrence>, CoreError> {
        crate::characters::sects_and_violets::simulation_occurrences(self.facts, action_ref)
    }
    fn definition(&self) -> Option<&crate::characters::ResolvedScriptContext> {
        Some(self.context)
    }

    fn has_minion(&self) -> bool {
        self.facts.players.iter().any(|player| {
            self.context.character_kind(&player.actual_character) == Some(CharacterKind::Minion)
        })
    }

    fn has_demon(&self) -> bool {
        self.facts.players.iter().any(|player| {
            self.context.character_kind(&player.actual_character) == Some(CharacterKind::Demon)
        })
    }

    fn legal_demon_bluff_character_ids(&self) -> Vec<String> {
        custom_demon_bluff_character_ids(
            self.context,
            &self
                .facts
                .players
                .iter()
                .map(|player| player.actual_character.clone())
                .collect::<Vec<_>>(),
        )
    }

    fn validate_character_membership(&self, character_id: &str) -> Result<(), CoreError> {
        if self.definition_contains(character_id) {
            Ok(())
        } else {
            Err(ErrorKind::CharacterNotInScript.into_error())
        }
    }
}

fn sort_instances(instances: &mut [ActiveAbilityInstance]) {
    instances.sort_by(compare_instances);
}

fn compare_instances(left: &ActiveAbilityInstance, right: &ActiveAbilityInstance) -> Ordering {
    left.seat
        .cmp(&right.seat)
        .then_with(|| {
            left.ability_use
                .owner_player_id
                .cmp(&right.ability_use.owner_player_id)
        })
        .then_with(|| {
            left.ability_use
                .character_id
                .cmp(&right.ability_use.character_id)
        })
        .then_with(|| {
            origin_source_key(&left.ability_origin).cmp(&origin_source_key(&right.ability_origin))
        })
        .then_with(|| {
            left.ability_use
                .ability_instance_id
                .cmp(&right.ability_use.ability_instance_id)
        })
}

fn origin_source_key(origin: &AbilityOrigin) -> (&str, &str, &str) {
    match origin {
        AbilityOrigin::IdentityBound => ("", "", ""),
        AbilityOrigin::Acquired {
            acquisition_event_id,
            source,
        } => (
            acquisition_event_id.as_str(),
            source.character_id.as_str(),
            source.ability_instance_id.as_str(),
        ),
    }
}

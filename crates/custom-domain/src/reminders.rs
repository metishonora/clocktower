//! Read-only, source-bound character reminder dispatch. No token is a persisted fact.
use crate::{
    contracts::FirstNightActionRef,
    model::{AbilityUseRef, AutomaticReminder},
    state::{ActionOccurrence, ActionSource, CustomGameFacts},
};

pub(crate) struct ReminderHandler {
    pub(crate) character_id: &'static str,
    pub(crate) project: fn(&ReminderContext<'_>) -> Vec<AutomaticReminder>,
}

pub(crate) struct ReminderContext<'a> {
    pub(crate) facts: &'a CustomGameFacts,
    character_id: &'a str,
    source: &'a ActionSource,
    current: bool,
}
impl ReminderContext<'_> {
    pub(crate) fn ability(&self) -> Option<&AbilityUseRef> {
        match self.source {
            ActionSource::ActualAbility(s) => Some(s),
            ActionSource::PhilosopherSimulation(_) => None,
        }
    }
    pub(crate) fn owner(&self) -> &str {
        match self.source {
            ActionSource::ActualAbility(s) => &s.owner_player_id,
            ActionSource::PhilosopherSimulation(s) => &s.source_ability_use.owner_player_id,
        }
    }
    pub(crate) fn current(&self) -> bool {
        self.current
    }
    // Handlers opt in to this condition; durable death/effect reminders must not use it.
    pub(crate) fn living(&self) -> bool {
        self.current && self.facts.player(self.owner()).is_some_and(|p| p.alive)
    }
    pub(crate) fn matches_ability(&self, source: &AbilityUseRef) -> bool {
        self.ability() == Some(source)
    }
    pub(crate) fn matches_occurrence(&self, occurrence: &ActionOccurrence) -> bool {
        self.matches_parts(
            occurrence.ability_use.as_ref(),
            occurrence.simulation_source.as_ref(),
        ) && matches!(&occurrence.action_ref, FirstNightActionRef::Character { character_id, .. } if character_id == self.character_id)
    }
    pub(crate) fn matches_parts(
        &self,
        ability: Option<&AbilityUseRef>,
        simulation: Option<&crate::contracts::PhilosopherSimulationSource>,
    ) -> bool {
        match self.source {
            ActionSource::ActualAbility(s) => ability == Some(s) && simulation.is_none(),
            ActionSource::PhilosopherSimulation(s) => simulation == Some(s) && ability.is_none(),
        }
    }
    pub(crate) fn token(&self, player: &str, token: &str, event: &str) -> AutomaticReminder {
        AutomaticReminder {
            player_id: player.into(),
            character_id: self.character_id.into(),
            token_id: token.into(),
            label: token.into(),
            description: token.into(),
            count: None,
            source_event_id: Some(event.into()),
            inactive_reason: None,
        }
    }
    pub(crate) fn effects(
        &self,
        kind: crate::effects::EffectKind,
        token: &str,
    ) -> Vec<AutomaticReminder> {
        self.facts
            .evaluated_effects
            .iter()
            .filter(|e| {
                e.kind() == kind && self.matches_ability(e.origin()) && e.status().visible()
            })
            .map(|e| {
                let mut r = self.token(e.target(), token, e.event_id());
                r.inactive_reason = e.status().inactive_reason();
                r
            })
            .collect()
    }
    pub(crate) fn impairments(&self) -> Vec<AutomaticReminder> {
        self.effects(crate::effects::EffectKind::Poison, "poisoned")
            .into_iter()
            .chain(self.effects(crate::effects::EffectKind::Drunk, "drunk"))
            .collect()
    }
    pub(crate) fn spent(&self) -> Vec<AutomaticReminder> {
        self.facts
            .ability_uses
            .iter()
            .filter(|u| self.current && self.matches_ability(&u.ability_use))
            .map(|u| self.token(self.owner(), "noAbility", &u.source_event_id))
            .collect()
    }
}

pub(crate) fn project(facts: &CustomGameFacts) -> Vec<AutomaticReminder> {
    #[cfg(feature = "custom-runtime-fixtures")]
    {
        let _ = facts;
        vec![]
    }
    #[cfg(not(feature = "custom-runtime-fixtures"))]
    {
        let handlers = crate::characters::trouble_brewing::reminder_handlers()
            .into_iter()
            .chain(crate::characters::sects_and_violets::reminder_handlers())
            .chain(crate::characters::carousel::reminder_handlers());
        let guidance = crate::simulation::sources(facts);
        let mut sources: Vec<(String, ActionSource, bool)> = facts
            .ability_provenance
            .iter()
            .map(|r| {
                (
                    r.ability_use.character_id.clone(),
                    ActionSource::ActualAbility(r.ability_use.clone()),
                    crate::reducer::current_ability_instance(facts, &r.ability_use),
                )
            })
            .collect();
        // Retain confirmed guidance for historical preparation tokens even after it ends.
        for occurrence in facts
            .preparations
            .iter()
            .map(|p| &p.occurrence)
            .chain(facts.confirmed_actions.iter().map(|a| &a.occurrence))
        {
            if let (FirstNightActionRef::Character { character_id, .. }, Some(s)) =
                (&occurrence.action_ref, &occurrence.simulation_source)
            {
                let entry = (
                    character_id.clone(),
                    ActionSource::PhilosopherSimulation(s.clone()),
                    guidance
                        .iter()
                        .any(|g| g.source == *s && g.character_id == *character_id),
                );
                if !sources.contains(&entry) {
                    sources.push(entry);
                }
            }
        }
        for g in guidance {
            let entry = (
                g.character_id,
                ActionSource::PhilosopherSimulation(g.source),
                true,
            );
            if !sources.contains(&entry) {
                sources.push(entry);
            }
        }
        let mut result = vec![];
        for handler in handlers {
            for (character_id, source, current) in &sources {
                if character_id != handler.character_id {
                    continue;
                }
                let context = ReminderContext {
                    facts,
                    character_id,
                    source,
                    current: *current,
                };
                for token in (handler.project)(&context) {
                    debug_assert_eq!(token.character_id, *character_id);
                    // Shared information may have several observers; don't duplicate its marker.
                    if !result.contains(&token) {
                        result.push(token);
                    }
                }
            }
        }
        result
    }
}

pub(crate) fn for_player(facts: &CustomGameFacts, player: &str) -> Vec<AutomaticReminder> {
    project(facts)
        .into_iter()
        .filter(|r| r.player_id == player)
        .collect()
}

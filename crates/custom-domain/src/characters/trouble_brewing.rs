use crate::model::CharacterKind;
pub(super) fn custom_registry_entries() -> Vec<(&'static str, CharacterKind)> {
    vec![
        ("washerwoman", CharacterKind::Townsfolk),
        ("librarian", CharacterKind::Townsfolk),
        ("investigator", CharacterKind::Townsfolk),
        ("chef", CharacterKind::Townsfolk),
        ("empath", CharacterKind::Townsfolk),
        ("fortuneTeller", CharacterKind::Townsfolk),
        ("undertaker", CharacterKind::Townsfolk),
        ("monk", CharacterKind::Townsfolk),
        ("ravenkeeper", CharacterKind::Townsfolk),
        ("virgin", CharacterKind::Townsfolk),
        ("slayer", CharacterKind::Townsfolk),
        ("soldier", CharacterKind::Townsfolk),
        ("mayor", CharacterKind::Townsfolk),
        ("butler", CharacterKind::Outsider),
        ("drunk", CharacterKind::Outsider),
        ("recluse", CharacterKind::Outsider),
        ("saint", CharacterKind::Outsider),
        ("poisoner", CharacterKind::Minion),
        ("spy", CharacterKind::Minion),
        ("scarletWoman", CharacterKind::Minion),
        ("baron", CharacterKind::Minion),
        ("imp", CharacterKind::Demon),
    ]
}
pub(super) fn custom_setup_outsider_delta(character_id: &str) -> i8 {
    if character_id == "baron" {
        2
    } else {
        0
    }
}

/// Per-check registration choices owned by the custom TB character rules. No identity mutation.
pub(crate) fn registration_allowed(
    actual: &str,
    judgment: &crate::model::RegistrationJudgment,
    context: &super::ResolvedScriptContext,
) -> bool {
    use crate::model::RegistrationValue as R;
    let kind = judgment
        .character_id
        .as_ref()
        .and_then(|id| context.character_kind(id));
    match (actual, judgment.registered_as) {
        ("spy", R::Good) => judgment.character_id.is_none(),
        ("recluse", R::Evil) => judgment.character_id.is_none(),
        ("spy", R::Townsfolk) => {
            judgment.character_id.is_none() || kind == Some(CharacterKind::Townsfolk)
        }
        ("spy", R::Outsider) => {
            judgment.character_id.is_none() || kind == Some(CharacterKind::Outsider)
        }
        ("recluse", R::Minion) => {
            judgment.character_id.is_none() || kind == Some(CharacterKind::Minion)
        }
        ("recluse", R::Demon) => {
            judgment.character_id.is_none() || kind == Some(CharacterKind::Demon)
        }
        _ => false,
    }
}

pub(crate) fn demon_protected(facts: &crate::state::CustomGameFacts, player_id: &str) -> bool {
    facts.ability_provenance.iter().any(|record| {
        record.ability_use.owner_player_id == player_id
            && record.ability_use.character_id == "soldier"
            && crate::effects::effective(facts, &record.ability_use)
    })
}
pub(crate) fn impairment_candidates(
    facts: &crate::state::CustomGameFacts,
) -> Vec<crate::effects::ImpairmentEffect> {
    facts
        .poisoner_choices
        .iter()
        .filter(|choice| choice.initially_effective)
        .map(|choice| crate::effects::ImpairmentEffect {
            effect: crate::state::DurableImpairment {
                source_ability_use: choice.ability_use.clone(),
                impairment: crate::contracts::ActiveImpairment {
                    kind: crate::contracts::ImpairmentKind::Poisoned,
                    player_id: choice.target_player_id.clone(),
                    source_event_id: choice.source_event_id.clone(),
                    source_character_id: "poisoner".into(),
                    expires: crate::contracts::ImpairmentExpiry::WhileSourceAbilityActive,
                },
            },
            requires_source: true,
            ignore_self: choice.target_player_id == choice.ability_use.owner_player_id,
            demon_harm: false,
        })
        .collect()
}

use crate::{
    characters::ResolvedScriptContext,
    contracts::*,
    effects::{effective, impaired},
    error::{CoreError, ErrorKind},
    event::{CustomActionEventDraft, CustomFactChanges},
    first_night::*,
    model::*,
    state::*,
};
fn invalid() -> CoreError {
    ErrorKind::InvalidStepInput.into_error()
}
fn reference(character: &str, id: &str) -> FirstNightActionRef {
    FirstNightActionRef::Character {
        character_id: character.into(),
        action_id: id.into(),
    }
}
pub(crate) fn registration_source(facts: &CustomGameFacts, id: &str) -> Option<AbilityUseRef> {
    if impaired(facts, id) {
        return None;
    }
    facts
        .ability_provenance
        .iter()
        .map(|p| p.ability_use.clone())
        .find(|s| {
            s.owner_player_id == id
                && matches!(s.character_id.as_str(), "spy" | "recluse")
                && crate::reducer::current_ability_instance(facts, s)
        })
}
fn same_source(a: &ActionOccurrence, b: &ActionOccurrence) -> bool {
    a.ability_use == b.ability_use && a.simulation_source == b.simulation_source
}
fn last_preparation<'a>(
    facts: &'a CustomGameFacts,
    o: &ActionOccurrence,
) -> Option<&'a ConfirmedActionFact> {
    facts
        .preparations
        .iter()
        .rev()
        .find(|p| same_source(&p.occurrence, o) && p.occurrence.action_ref == o.action_ref)
}
fn prefix(facts: &CustomGameFacts) -> String {
    if facts.prefix_event_id.is_empty() {
        "setup".into()
    } else {
        facts.prefix_event_id.clone()
    }
}
fn source_event(facts: &CustomGameFacts, o: &ActionOccurrence) -> String {
    o.simulation_source
        .as_ref()
        .map(|s| s.selection_event_id.clone())
        .or_else(|| {
            o.ability_use
                .as_ref()
                .and_then(|s| crate::reducer::recorded_ability(facts, s))
                .map(|r| match &r.origin {
                    AbilityOrigin::IdentityBound => facts
                        .player(&r.ability_use.owner_player_id)
                        .unwrap()
                        .ability_instance
                        .source_event_id
                        .clone(),
                    AbilityOrigin::Acquired {
                        acquisition_event_id,
                        ..
                    } => acquisition_event_id.clone(),
                })
        })
        .unwrap_or_else(|| prefix(facts))
}
pub(crate) fn registered_identity(
    definition: &ResolvedScriptContext,
    facts: &CustomGameFacts,
    id: &str,
    judgments: &[RegistrationJudgment],
) -> Result<(String, CharacterKind, Alignment), CoreError> {
    let player = facts.player(id).ok_or_else(invalid)?;
    let mut identity = (
        player.actual_character.clone(),
        definition
            .character_kind(&player.actual_character)
            .ok_or_else(invalid)?,
        player.alignment,
    );
    let selected = judgments
        .iter()
        .filter(|j| j.player_id == id)
        .collect::<Vec<_>>();
    if selected.len() > 1 {
        return Err(invalid());
    }
    if let Some(j) = selected.first() {
        let source = registration_source(facts, id).ok_or_else(invalid)?;
        if !registration_allowed(&source.character_id, j, definition) {
            return Err(invalid());
        }
        if let Some(c) = &j.character_id {
            identity.0 = c.clone();
        }
        match j.registered_as {
            RegistrationValue::Good => identity.2 = Alignment::Good,
            RegistrationValue::Evil => identity.2 = Alignment::Evil,
            RegistrationValue::Townsfolk => {
                identity.1 = CharacterKind::Townsfolk;
                identity.2 = Alignment::Good;
            }
            RegistrationValue::Outsider => {
                identity.1 = CharacterKind::Outsider;
                identity.2 = Alignment::Good;
            }
            RegistrationValue::Minion => {
                identity.1 = CharacterKind::Minion;
                identity.2 = Alignment::Evil;
            }
            RegistrationValue::Demon => {
                identity.1 = CharacterKind::Demon;
                identity.2 = Alignment::Evil;
            }
        }
    }
    Ok(identity)
}
fn required_kind(c: &str) -> CharacterKind {
    match c {
        "washerwoman" => CharacterKind::Townsfolk,
        "librarian" => CharacterKind::Outsider,
        _ => CharacterKind::Minion,
    }
}
fn regular_id(c: &str) -> &str {
    match c {
        "washerwoman" => "learnTownsfolk",
        "librarian" => "learnOutsider",
        "investigator" => "learnMinion",
        "chef" => "learnEvilPairs",
        "empath" => "learnEvilNeighbors",
        "fortuneTeller" => "checkDemon",
        "poisoner" => "choosePoisonTarget",
        "butler" => "chooseMaster",
        "spy" => "inspectGrimoire",
        _ => "",
    }
}
fn is_start_info(c: &str) -> bool {
    matches!(c, "washerwoman" | "librarian" | "investigator")
}
fn info_done(facts: &CustomGameFacts, o: &ActionOccurrence, c: &str) -> bool {
    facts.confirmed_actions.iter().any(|f| {
        same_source(&f.occurrence, o) && f.occurrence.action_ref == reference(c, regular_id(c))
    })
}
fn vortox_applies(facts: &CustomGameFacts, o: &ActionOccurrence, c: &str) -> bool {
    !facts.vortox_sources.is_empty()
        && custom_registry_entries()
            .iter()
            .any(|(id, kind)| *id == c && *kind == CharacterKind::Townsfolk)
        && !o
            .simulation_source
            .as_ref()
            .is_some_and(|s| s.source_ability_use.character_id == "drunk")
}
fn has_discretion(facts: &CustomGameFacts, o: &ActionOccurrence) -> bool {
    o.simulation_source.is_some() || o.actor_player_id().is_some_and(|id| impaired(facts, id))
}
fn information_true(
    definition: &ResolvedScriptContext,
    facts: &CustomGameFacts,
    c: &str,
    preparation: &InformationPreparation,
    judgments: &[RegistrationJudgment],
) -> Result<bool, CoreError> {
    if judgments
        .iter()
        .any(|j| j.scope.is_some() || facts.player(&j.player_id).is_none())
    {
        return Err(invalid());
    }
    let InformationResult::SetupInfo {
        player_ids,
        character_id,
        zero_outsiders,
    } = &preparation.information
    else {
        return Err(invalid());
    };
    if *zero_outsiders {
        if c != "librarian"
            || !player_ids.is_empty()
            || character_id.is_some()
            || preparation.correct_player_id.is_some()
        {
            return Err(invalid());
        }
        return facts
            .players
            .iter()
            .map(|p| {
                registered_identity(definition, facts, &p.id, judgments)
                    .map(|(_, k, _)| k != CharacterKind::Outsider)
            })
            .try_fold(true, |all, x| x.map(|v| all && v));
    }
    let character = character_id.as_ref().ok_or_else(invalid)?;
    if definition.character_kind(character) != Some(required_kind(c))
        || player_ids.len() != 2
        || player_ids[0] == player_ids[1]
        || !preparation
            .correct_player_id
            .as_ref()
            .is_some_and(|id| player_ids.contains(id))
        || judgments.iter().any(|j| !player_ids.contains(&j.player_id))
    {
        return Err(invalid());
    }
    let identities = player_ids
        .iter()
        .map(|id| registered_identity(definition, facts, id, judgments))
        .collect::<Result<Vec<_>, _>>()?;
    Ok(identities.iter().any(|(id, _, _)| id == character))
}
fn validate_preparation(
    definition: &ResolvedScriptContext,
    facts: &CustomGameFacts,
    c: &str,
    o: &ActionOccurrence,
    p: &InformationPreparation,
    judgments: &[RegistrationJudgment],
) -> Result<(), CoreError> {
    let judged = information_true(definition, facts, c, p, judgments)?;
    let actual = information_true(definition, facts, c, p, &[])?;
    if vortox_applies(facts, o, c) {
        if actual {
            return Err(ErrorKind::InvalidDeliveredInformation.into_error());
        }
    } else if !has_discretion(facts, o) && !judged {
        return Err(ErrorKind::InvalidDeliveredInformation.into_error());
    }
    if !has_discretion(facts, o) && !vortox_applies(facts, o, c) {
        if let (
            Some(correct),
            InformationResult::SetupInfo {
                character_id: Some(character),
                ..
            },
        ) = (&p.correct_player_id, &p.information)
        {
            if registered_identity(definition, facts, correct, judgments)?.0 != *character {
                return Err(invalid());
            }
        }
    }
    Ok(())
}
pub(crate) fn registrations() -> Vec<RegisteredAction> {
    [
        ("fortuneTeller", "assignRedHerring"),
        ("washerwoman", "prepareInformation"),
        ("librarian", "prepareInformation"),
        ("investigator", "prepareInformation"),
        ("drunk", "assignShownCharacter"),
        ("washerwoman", "learnTownsfolk"),
        ("librarian", "learnOutsider"),
        ("investigator", "learnMinion"),
        ("chef", "learnEvilPairs"),
        ("empath", "learnEvilNeighbors"),
        ("fortuneTeller", "checkDemon"),
        ("poisoner", "choosePoisonTarget"),
        ("butler", "chooseMaster"),
        ("spy", "inspectGrimoire"),
    ]
    .into_iter()
    .map(|(c, a)| {
        let action_ref = reference(c, a);
        RegisteredAction {
            spec: ActionSpec {
                action_ref: action_ref.clone(),
                participates_in_first_night: a == regular_id(c),
                required_input_kind: if a == "prepareInformation" {
                    RequiredInputKind::SetupInfo
                } else if a == "assignShownCharacter" {
                    RequiredInputKind::CharacterIds
                } else if matches!(c, "fortuneTeller" | "poisoner" | "butler") {
                    RequiredInputKind::PlayerIds
                } else if a == regular_id(c) {
                    RequiredInputKind::None
                } else {
                    RequiredInputKind::PlayerIds
                },
                support: PhaseStepSupport::Automated,
            },
            handler: Box::new(TbHandler { action_ref }),
        }
    })
    .collect()
}
struct TbHandler {
    action_ref: FirstNightActionRef,
}
impl TbHandler {
    fn character(&self) -> &str {
        match &self.action_ref {
            FirstNightActionRef::Character { character_id, .. } => character_id,
            _ => unreachable!(),
        }
    }
    fn id(&self) -> &str {
        match &self.action_ref {
            FirstNightActionRef::Character { action_id, .. } => action_id,
            _ => unreachable!(),
        }
    }
    fn bases(&self, c: &ActionContext<'_>) -> Result<Vec<ActionOccurrence>, CoreError> {
        let facts = c.rule_service.facts().ok_or_else(invalid)?;
        let mut bases = c
            .rule_service
            .try_owned_instances(&self.action_ref)?
            .into_iter()
            .filter(|i| {
                facts
                    .player(&i.ability_use.owner_player_id)
                    .is_some_and(|p| p.alive)
            })
            .map(|i| ActionOccurrence::character(self.action_ref.clone(), i.ability_use))
            .collect::<Result<Vec<_>, _>>()?;
        bases.extend(crate::simulation::occurrences(facts, &self.action_ref)?);
        Ok(bases)
    }
    fn needed(&self, c: &ActionContext<'_>, base: &ActionOccurrence) -> Result<bool, CoreError> {
        let facts = c.rule_service.facts().ok_or_else(invalid)?;
        let definition = c.rule_service.definition().ok_or_else(invalid)?;
        let prior = last_preparation(facts, base);
        Ok(match self.id() {
            "assignShownCharacter" => {
                base.ability_use.as_ref().is_some_and(|s| {
                    facts
                        .ability_grants
                        .iter()
                        .any(|g| g.ability_instance_id == s.ability_instance_id)
                }) && prior.is_none()
            }
            "assignRedHerring" => match prior {
                None => true,
                Some(p) => match &p.result {
                    CustomActionResult::RedHerringAssigned { target_player_id } => {
                        registered_identity(
                            definition,
                            facts,
                            target_player_id,
                            &p.registration_judgments,
                        )
                        .map(|(_, _, a)| a != Alignment::Good)
                        .unwrap_or(true)
                    }
                    _ => true,
                },
            },
            "prepareInformation" => {
                !info_done(facts, base, self.character())
                    && match prior {
                        None => true,
                        Some(p) => match &p.result {
                            CustomActionResult::InformationPrepared { preparation } => {
                                validate_preparation(
                                    definition,
                                    facts,
                                    self.character(),
                                    base,
                                    preparation,
                                    &p.registration_judgments,
                                )
                                .is_err()
                            }
                            _ => true,
                        },
                    }
            }
            _ => false,
        })
    }
    fn preparation_candidates(
        &self,
        c: &ActionContext<'_>,
        optional: bool,
    ) -> Result<Vec<ActionOccurrence>, CoreError> {
        let facts = c.rule_service.facts().ok_or_else(invalid)?;
        let mut result = vec![];
        for mut base in self.bases(c)? {
            let prior = last_preparation(facts, &base);
            let needed = self.needed(c, &base)?;
            if optional {
                if self.id() != "prepareInformation"
                    || prior.is_none()
                    || needed
                    || info_done(facts, &base, self.character())
                {
                    continue;
                }
                base.action_cause = Some(ActionCause::Optional {
                    prefix_event_id: prefix(facts),
                });
            } else {
                if !needed {
                    continue;
                }
                base.action_cause = Some(match prior {
                    None => ActionCause::InitialPreparation {
                        source_event_id: source_event(facts, &base),
                    },
                    Some(p) => ActionCause::RequiredPreparation {
                        trigger_event_id: prefix(facts),
                        previous_preparation_event_id: Some(p.event_id.clone()),
                    },
                });
            }
            result.push(base);
        }
        Ok(result)
    }
    fn step(&self, c: &ActionContext<'_>, o: &ActionOccurrence) -> Result<PhaseStep, CoreError> {
        let definition = c.rule_service.definition().ok_or_else(invalid)?;
        let facts = c.rule_service.facts().ok_or_else(invalid)?;
        let mut input = crate::input::required_none();
        match self.id() {
            "assignShownCharacter" => {
                input = crate::input::required_characters(
                    1,
                    1,
                    Some(
                        definition
                            .character_ids()
                            .into_iter()
                            .filter(|id| {
                                definition.character_kind(id) == Some(CharacterKind::Townsfolk)
                            })
                            .map(str::to_owned)
                            .collect(),
                    ),
                    false,
                )
            }
            "prepareInformation" => {
                input.kind = RequiredInputKind::SetupInfo;
                input.target = Some(InputTarget::SetupInfo);
                input.allowed_player_ids =
                    Some(facts.players.iter().map(|p| p.id.clone()).collect());
                input.allowed_character_ids = Some(
                    definition
                        .character_ids()
                        .into_iter()
                        .filter(|id| {
                            definition.character_kind(id) == Some(required_kind(self.character()))
                        })
                        .map(str::to_owned)
                        .collect(),
                );
                input.zero_allowed = self.character() == "librarian";
            }
            id if id == regular_id(self.character())
                && !matches!(self.character(), "fortuneTeller" | "poisoner" | "butler") => {}
            _ => {
                input.kind = RequiredInputKind::PlayerIds;
                input.target = Some(InputTarget::Players);
                let count = if self.id() == "checkDemon" { 2 } else { 1 };
                input.min_selections = Some(count);
                input.max_selections = Some(count);
                input.allowed_player_ids = Some(
                    facts
                        .players
                        .iter()
                        .filter(|p| {
                            self.character() != "butler"
                                || Some(p.id.as_str()) != o.actor_player_id()
                        })
                        .map(|p| p.id.clone())
                        .collect(),
                );
            }
        }
        let mut step = crate::input::simple_step(
            Phase::FirstNight,
            "custom",
            "action",
            StepType::Character,
            input,
            false,
        );
        step.id = o.step_id()?;
        step.character = Some(self.character().into());
        step.player_id = o.actor_player_id().map(str::to_owned);
        step.ability_use = o.ability_use.clone();
        step.simulation_source = o.simulation_source.clone();
        step.action_cause = o.action_cause.clone();
        step.action_ref = Some(self.action_ref.clone());
        step.ability_origin = o
            .ability_use
            .as_ref()
            .and_then(|s| crate::reducer::recorded_ability(facts, s))
            .map(|r| r.origin.clone());
        if self.id() == regular_id(self.character())
            && !matches!(self.character(), "poisoner" | "butler")
        {
            step.information_prompt = self.prompt(c, o)?;
        }
        Ok(step)
    }
    fn prompt(
        &self,
        c: &ActionContext<'_>,
        o: &ActionOccurrence,
    ) -> Result<Option<InformationPrompt>, CoreError> {
        let facts = c.rule_service.facts().ok_or_else(invalid)?;
        let definition = c.rule_service.definition().ok_or_else(invalid)?;
        let (reasons, _) = information_causes(facts, o, self.character(), &[])?;
        let mut prompt = InformationPrompt {
            computed_result: None,
            delivery_mode: if reasons.is_empty() {
                InformationDeliveryMode::Fixed
            } else {
                InformationDeliveryMode::Selectable
            },
            active_reasons: reasons,
            registration_candidate_player_ids: vec![],
            number_choices: vec![],
            number_constraint: None,
            boolean_choices: vec![],
            setup_info_registration_options: vec![],
            target_checks: vec![],
            mathematician_audit: None,
        };
        if is_start_info(self.character()) {
            return Ok(None);
        }
        let mut players = facts.players.iter().collect::<Vec<_>>();
        players.sort_by_key(|p| p.seat);
        let target_sets = if self.character() == "fortuneTeller" {
            let mut prep = o.clone();
            prep.action_ref = reference("fortuneTeller", "assignRedHerring");
            if o.ability_use.is_some() && last_preparation(facts, &prep).is_none() {
                return Ok(None);
            }
            let mut sets = vec![];
            for (i, a) in players.iter().enumerate() {
                for b in &players[i + 1..] {
                    sets.push(vec![a.id.clone(), b.id.clone()]);
                }
            }
            sets
        } else {
            vec![vec![]]
        };
        for targets in target_sets {
            let actual = self.truth(definition, facts, o, &targets, &[])?;
            let variants = if self.character() == "chef" {
                let mut totals = std::collections::BTreeMap::from([(0u64, vec![])]);
                for i in 0..players.len() {
                    let edge = vec![
                        players[i].id.clone(),
                        players[(i + 1) % players.len()].id.clone(),
                    ];
                    let variants = alignment_variants(
                        facts,
                        &edge,
                        Some(RegistrationScope::AdjacentPair {
                            player_ids: edge.clone(),
                        }),
                    );
                    let mut next = std::collections::BTreeMap::new();
                    for (count, prior) in &totals {
                        for js in &variants {
                            let plain = js
                                .iter()
                                .cloned()
                                .map(|mut j| {
                                    j.scope = None;
                                    j
                                })
                                .collect::<Vec<_>>();
                            let evil = edge
                                .iter()
                                .map(|id| {
                                    registered_identity(definition, facts, id, &plain)
                                        .map(|(_, _, a)| a == Alignment::Evil)
                                })
                                .collect::<Result<Vec<_>, _>>()?
                                .iter()
                                .all(|x| *x);
                            let mut joined = prior.clone();
                            joined.extend(js.clone());
                            next.entry(count + u64::from(evil)).or_insert(joined);
                        }
                    }
                    totals = next;
                }
                totals.into_values().collect::<Vec<_>>()
            } else if self.character() == "empath" {
                let index = players
                    .iter()
                    .position(|p| Some(p.id.as_str()) == o.actor_player_id())
                    .ok_or_else(invalid)?;
                let n = players.len();
                let mut ids = vec![];
                for dir in [1, n - 1] {
                    for d in 1..n {
                        let p = players[(index + dir * d) % n];
                        if p.alive {
                            if !ids.contains(&p.id) {
                                ids.push(p.id.clone());
                            }
                            break;
                        }
                    }
                }
                alignment_variants(facts, &ids, None)
            } else if self.character() == "fortuneTeller" {
                demon_variants(facts, &targets)
            } else {
                vec![vec![]]
            };
            let mut choices = vec![];
            for js in variants {
                let result = self.truth(definition, facts, o, &targets, &js)?;
                if !choices
                    .iter()
                    .any(|c: &TargetInformationChoice| c.result == result)
                {
                    choices.push(TargetInformationChoice {
                        is_computed: result == actual,
                        result,
                        registration_judgments: js,
                    });
                }
            }
            if has_discretion(facts, o) || vortox_applies(facts, o, self.character()) {
                let all = match &actual {
                    InformationResult::Number { .. } => (0..=if self.character() == "empath" {
                        2
                    } else {
                        players.len() as u64
                    })
                        .map(|value| InformationResult::Number { value })
                        .collect(),
                    InformationResult::Boolean { .. } => vec![
                        InformationResult::Boolean { value: false },
                        InformationResult::Boolean { value: true },
                    ],
                    _ => vec![actual.clone()],
                };
                choices = all
                    .into_iter()
                    .map(|result| TargetInformationChoice {
                        is_computed: result == actual,
                        result,
                        registration_judgments: vec![],
                    })
                    .collect();
            }
            if vortox_applies(facts, o, self.character()) {
                choices.retain(|choice| choice.result != actual);
            }
            for choice in &choices {
                for j in &choice.registration_judgments {
                    if !prompt
                        .registration_candidate_player_ids
                        .contains(&j.player_id)
                    {
                        prompt
                            .registration_candidate_player_ids
                            .push(j.player_id.clone());
                    }
                }
            }
            if self.character() == "fortuneTeller" {
                prompt.target_checks.push(TargetInformationCheck {
                    target_player_ids: targets,
                    computed_result: actual,
                    choices,
                });
            } else {
                prompt.computed_result = Some(actual);
                for choice in choices {
                    if let InformationResult::Number { value } = choice.result {
                        prompt.number_choices.push(NumberInformationChoice {
                            value,
                            is_computed: choice.is_computed,
                            registration_judgments: choice.registration_judgments,
                        });
                    }
                }
                prompt.number_choices.sort_by_key(|c| c.value);
            }
        }
        if !prompt.registration_candidate_player_ids.is_empty() {
            prompt.delivery_mode = InformationDeliveryMode::Selectable;
        }
        Ok(Some(prompt))
    }
    fn truth(
        &self,
        definition: &ResolvedScriptContext,
        facts: &CustomGameFacts,
        o: &ActionOccurrence,
        targets: &[String],
        judgments: &[RegistrationJudgment],
    ) -> Result<InformationResult, CoreError> {
        let actor = o.actor_player_id().ok_or_else(invalid)?;
        let mut players = facts.players.iter().collect::<Vec<_>>();
        players.sort_by_key(|p| p.seat);
        let identities = |ids: &[String],
                          js: &[RegistrationJudgment]|
         -> Result<Vec<(String, CharacterKind, Alignment)>, CoreError> {
            if js
                .iter()
                .any(|j| !ids.contains(&j.player_id) || j.scope.is_some())
            {
                return Err(invalid());
            }
            ids.iter()
                .map(|id| registered_identity(definition, facts, id, js))
                .collect()
        };
        Ok(match self.character() {
            "chef" => {
                let mut count = 0;
                let edges = (0..players.len())
                    .map(|i| {
                        vec![
                            players[i].id.clone(),
                            players[(i + 1) % players.len()].id.clone(),
                        ]
                    })
                    .collect::<Vec<_>>();
                for j in judgments {
                    if let Some(RegistrationScope::AdjacentPair { player_ids }) = &j.scope {
                        if !edges.contains(player_ids) || !player_ids.contains(&j.player_id) {
                            return Err(invalid());
                        }
                    } else if !players.iter().any(|p| p.id == j.player_id) {
                        return Err(invalid());
                    }
                }
                for edge in edges {
                    let js = judgments.iter().filter(|j| edge.contains(&j.player_id) && j.scope.as_ref().is_none_or(|scope| matches!(scope, RegistrationScope::AdjacentPair{player_ids} if *player_ids == edge))).cloned().map(|mut j| {j.scope=None;j}).collect::<Vec<_>>();
                    if identities(&edge, &js)?
                        .iter()
                        .all(|(_, _, a)| *a == Alignment::Evil)
                    {
                        count += 1;
                    }
                }
                InformationResult::Number { value: count }
            }
            "empath" => {
                let index = players
                    .iter()
                    .position(|p| p.id == actor)
                    .ok_or_else(invalid)?;
                let n = players.len();
                let mut neighbors = vec![];
                for direction in [1, n - 1] {
                    for distance in 1..n {
                        let p = players[(index + direction * distance) % n];
                        if p.alive {
                            if !neighbors.contains(&p.id) {
                                neighbors.push(p.id.clone());
                            }
                            break;
                        }
                    }
                }
                InformationResult::Number {
                    value: identities(&neighbors, judgments)?
                        .iter()
                        .filter(|(_, _, a)| *a == Alignment::Evil)
                        .count() as u64,
                }
            }
            "fortuneTeller" => {
                let mut prep = o.clone();
                prep.action_ref = reference("fortuneTeller", "assignRedHerring");
                let red = last_preparation(facts, &prep).and_then(|p| {
                    if let CustomActionResult::RedHerringAssigned { target_player_id } = &p.result {
                        Some(target_player_id)
                    } else {
                        None
                    }
                });
                if o.ability_use.is_some() && red.is_none() {
                    return Err(invalid());
                }
                InformationResult::Boolean {
                    value: identities(targets, judgments)?
                        .iter()
                        .any(|(_, k, _)| *k == CharacterKind::Demon)
                        || red.is_some_and(|id| targets.contains(id)),
                }
            }
            "spy" => {
                if !judgments.is_empty() {
                    return Err(invalid());
                }
                InformationResult::SpyGrimoire {
                    players: players
                        .iter()
                        .map(|p| InformationPlayer {
                            player_id: p.id.clone(),
                            seat: p.seat,
                            name: p.name.clone(),
                            character_id: p.actual_character.clone(),
                            alignment: Some(p.alignment),
                            alive: Some(p.alive),
                            ghost_vote_used: Some(p.ghost_vote_used),
                            reminder_tokens: Some(
                                if facts.active_impairments.iter().any(|e| {
                                    e.player_id == p.id && e.kind == ImpairmentKind::Poisoned
                                }) {
                                    vec![SpyReminderToken::Poisoned]
                                } else {
                                    vec![]
                                },
                            ),
                            automatic_reminders: spy_reminders(facts, &p.id),
                        })
                        .collect(),
                }
            }
            _ => return Err(invalid()),
        })
    }
    fn resolve_regular(
        &self,
        c: &ActionContext<'_>,
        o: &ActionOccurrence,
        input: &ActionInput,
    ) -> Result<(CustomActionResult, CustomFactChanges), CoreError> {
        let facts = c.rule_service.facts().ok_or_else(invalid)?;
        let definition = c.rule_service.definition().ok_or_else(invalid)?;
        let actor = o.actor_player_id().ok_or_else(invalid)?;
        let targets = if matches!(self.character(), "fortuneTeller" | "poisoner" | "butler") {
            crate::information::targets_with_policy(
                &input.input,
                if self.character() == "fortuneTeller" {
                    2
                } else {
                    1
                },
                actor,
                self.character() != "butler",
            )?
        } else {
            if input.input.is_some() {
                return Err(invalid());
            }
            vec![]
        };
        if targets.iter().any(|id| facts.player(id).is_none()) {
            return Err(invalid());
        }
        if matches!(self.character(), "poisoner" | "butler") {
            if input.delivered_result.is_some() || !input.registration_judgments.is_empty() {
                return Err(invalid());
            }
            let source = o.ability_use.clone().ok_or_else(invalid)?;
            let active = effective(facts, &source);
            let choice = TargetAssignment {
                source_event_id: c.event_id.into(),
                ability_use: source,
                target_player_id: targets[0].clone(),
                day: 1,
                initially_effective: active,
                effective: active,
            };
            let (details, causes) = information_causes(facts, o, self.character(), &[])?;
            let audit = if !active && !causes.is_empty() {
                vec![MalfunctionEvidence {
                    event_id: c.event_id.into(),
                    occurrence: o.clone(),
                    subject_player_id: actor.into(),
                    outcome: MalfunctionOutcome::EffectFailure {
                        effect: if self.character() == "poisoner" {
                            FailedEffect::PoisonerPoison
                        } else {
                            FailedEffect::ButlerMaster
                        },
                    },
                    cause_details: details,
                    causes,
                }]
            } else {
                vec![]
            };
            return Ok(if self.character() == "poisoner" {
                (
                    CustomActionResult::Poisoner {
                        target_player_id: targets[0].clone(),
                        day: 1,
                        effective: active,
                    },
                    CustomFactChanges::default()
                        .with_poisoner(choice)
                        .with_audit(audit),
                )
            } else {
                (
                    CustomActionResult::Butler {
                        target_player_id: targets[0].clone(),
                        day: 1,
                        effective: active,
                    },
                    CustomFactChanges::default()
                        .with_master(choice)
                        .with_audit(audit),
                )
            });
        }
        let actual = self.truth(definition, facts, o, &targets, &[])?;
        let judged = self.truth(
            definition,
            facts,
            o,
            &targets,
            &input.registration_judgments,
        )?;
        let (reasons, causes) =
            information_causes(facts, o, self.character(), &input.registration_judgments)?;
        let delivered = match &input.delivered_result {
            Some(v) => v.clone(),
            None if reasons.is_empty() => judged.clone(),
            None => return Err(ErrorKind::MissingDeliveredInformation.into_error()),
        };
        let shape = match (&actual, &delivered) {
            (InformationResult::Number { .. }, InformationResult::Number { value }) => {
                *value
                    <= if self.character() == "empath" {
                        2
                    } else {
                        facts.players.len() as u64
                    }
            }
            (InformationResult::Boolean { .. }, InformationResult::Boolean { .. }) => true,
            (
                InformationResult::SpyGrimoire { players: actual },
                InformationResult::SpyGrimoire { players },
            ) => {
                players.len() == actual.len()
                    && players.iter().zip(actual).all(|(p, a)| {
                        p.player_id == a.player_id
                            && p.seat == a.seat
                            && p.name == a.name
                            && p.alignment.is_some()
                            && p.alive.is_some()
                            && p.ghost_vote_used.is_some()
                            && p.reminder_tokens.is_some()
                            && definition.character_kind(&p.character_id).is_some()
                    })
            }
            _ => false,
        };
        if !shape
            || (vortox_applies(facts, o, self.character()) && delivered == actual)
            || (!has_discretion(facts, o)
                && !vortox_applies(facts, o, self.character())
                && delivered != judged)
        {
            return Err(ErrorKind::InvalidDeliveredInformation.into_error());
        }
        let audit = if delivered != actual && !causes.is_empty() {
            vec![MalfunctionEvidence {
                event_id: c.event_id.into(),
                occurrence: o.clone(),
                subject_player_id: actor.into(),
                outcome: MalfunctionOutcome::IncorrectInformation {
                    delivered_result: delivered.clone(),
                },
                cause_details: reasons.clone(),
                causes,
            }]
        } else {
            vec![]
        };
        let information = ConfirmedInformation {
            actor: Some(InformationActor {
                player_id: actor.into(),
                character_id: self.character().into(),
            }),
            target_player_ids: targets,
            computed_result: Some(actual),
            delivered_result: delivered,
            delivery_context: if reasons.is_empty() {
                DeliveryContext::Fixed
            } else {
                DeliveryContext::Discretionary { reasons }
            },
        };
        Ok((
            if o.simulation_source.is_some() {
                CustomActionResult::Simulation {
                    information: Some(information),
                    spent: false,
                }
            } else {
                CustomActionResult::InformationDelivered {
                    information,
                    spent: false,
                }
            },
            CustomFactChanges::default().with_audit(audit),
        ))
    }
    fn deliver_prepared(
        &self,
        c: &ActionContext<'_>,
        o: &ActionOccurrence,
        input: &ActionInput,
    ) -> Result<(CustomActionResult, CustomFactChanges), CoreError> {
        if input.input.is_some()
            || input.delivered_result.is_some()
            || !input.registration_judgments.is_empty()
        {
            return Err(invalid());
        }
        let facts = c.rule_service.facts().ok_or_else(invalid)?;
        let definition = c.rule_service.definition().ok_or_else(invalid)?;
        let mut prep_source = o.clone();
        prep_source.action_ref = reference(self.character(), "prepareInformation");
        let prior = last_preparation(facts, &prep_source).ok_or_else(invalid)?;
        let CustomActionResult::InformationPrepared { preparation } = &prior.result else {
            return Err(invalid());
        };
        validate_preparation(
            definition,
            facts,
            self.character(),
            o,
            preparation,
            &prior.registration_judgments,
        )?;
        let actual_true = information_true(definition, facts, self.character(), preparation, &[])?;
        let actor = o.actor_player_id().ok_or_else(invalid)?;
        let (reasons, causes) =
            information_causes(facts, o, self.character(), &prior.registration_judgments)?;
        let InformationResult::SetupInfo { player_ids, .. } = &preparation.information else {
            return Err(invalid());
        };
        let information = ConfirmedInformation {
            actor: Some(InformationActor {
                player_id: actor.into(),
                character_id: self.character().into(),
            }),
            target_player_ids: player_ids.clone(),
            computed_result: if actual_true {
                Some(preparation.information.clone())
            } else {
                None
            },
            delivered_result: preparation.information.clone(),
            delivery_context: if reasons.is_empty() {
                DeliveryContext::Fixed
            } else {
                DeliveryContext::Discretionary {
                    reasons: reasons.clone(),
                }
            },
        };
        let audit = if !actual_true && !causes.is_empty() {
            vec![MalfunctionEvidence {
                event_id: c.event_id.into(),
                occurrence: o.clone(),
                subject_player_id: actor.into(),
                outcome: MalfunctionOutcome::IncorrectInformation {
                    delivered_result: preparation.information.clone(),
                },
                cause_details: reasons,
                causes,
            }]
        } else {
            vec![]
        };
        Ok((
            CustomActionResult::PreparedInformationDelivered {
                preparation_event_id: prior.event_id.clone(),
                information,
                spent: false,
            },
            CustomFactChanges::default().with_audit(audit),
        ))
    }
    fn resolve(
        &self,
        c: &ActionContext<'_>,
        o: &ActionOccurrence,
        input: &ActionInput,
    ) -> Result<(CustomActionResult, CustomFactChanges), CoreError> {
        let facts = c.rule_service.facts().ok_or_else(invalid)?;
        let definition = c.rule_service.definition().ok_or_else(invalid)?;
        if self.id() == regular_id(self.character()) {
            return if is_start_info(self.character()) {
                self.deliver_prepared(c, o, input)
            } else {
                self.resolve_regular(c, o, input)
            };
        }
        if input.delivered_result.is_some() {
            return Err(ErrorKind::UnexpectedDeliveredInformation.into_error());
        }
        let fields = input.input.as_ref().ok_or_else(invalid)?;
        let result = match self.id() {
            "assignRedHerring" => {
                let ids = crate::information::targets_with_policy(
                    &input.input,
                    1,
                    o.actor_player_id().unwrap_or(""),
                    true,
                )?;
                if input
                    .registration_judgments
                    .iter()
                    .any(|j| j.player_id != ids[0] || j.scope.is_some())
                    || registered_identity(
                        definition,
                        facts,
                        &ids[0],
                        &input.registration_judgments,
                    )?
                    .2 != Alignment::Good
                {
                    return Err(invalid());
                }
                CustomActionResult::RedHerringAssigned {
                    target_player_id: ids[0].clone(),
                }
            }
            "assignShownCharacter" => {
                if !input.registration_judgments.is_empty() {
                    return Err(invalid());
                }
                let ids = fields.character_ids.as_ref().ok_or_else(invalid)?;
                if ids.len() != 1
                    || definition.character_kind(&ids[0]) != Some(CharacterKind::Townsfolk)
                    || *fields
                        != (StepInputFields {
                            character_ids: Some(ids.clone()),
                            ..Default::default()
                        })
                {
                    return Err(invalid());
                }
                CustomActionResult::ShownCharacterAssigned {
                    character_id: ids[0].clone(),
                }
            }
            "prepareInformation" => {
                let zero = fields.zero_outsiders == Some(true);
                let p = InformationPreparation {
                    information: InformationResult::SetupInfo {
                        player_ids: fields.player_ids.clone().unwrap_or_default(),
                        character_id: fields.character_id.clone(),
                        zero_outsiders: zero,
                    },
                    correct_player_id: fields.correct_player_id.clone(),
                };
                if *fields
                    != (StepInputFields {
                        player_ids: fields.player_ids.clone(),
                        character_id: fields.character_id.clone(),
                        zero_outsiders: fields.zero_outsiders,
                        correct_player_id: fields.correct_player_id.clone(),
                        ..Default::default()
                    })
                {
                    return Err(invalid());
                }
                validate_preparation(
                    definition,
                    facts,
                    self.character(),
                    o,
                    &p,
                    &input.registration_judgments,
                )?;
                CustomActionResult::InformationPrepared { preparation: p }
            }
            _ => return Err(ErrorKind::FirstNightActionHandlerUnavailable.into_error()),
        };
        Ok((result, CustomFactChanges::default().with_preparation()))
    }
}
impl ActionHandler for TbHandler {
    fn action_ref(&self) -> &FirstNightActionRef {
        &self.action_ref
    }
    fn required_occurrences(
        &self,
        c: &ActionContext<'_>,
        _: &FirstNightProgress,
    ) -> Result<Vec<ActionOccurrence>, CoreError> {
        self.preparation_candidates(c, false)
    }
    fn optional_occurrences(
        &self,
        c: &ActionContext<'_>,
        _: &FirstNightProgress,
    ) -> Result<Vec<ActionOccurrence>, CoreError> {
        self.preparation_candidates(c, true)
    }
    fn project(&self, _: &ActionSpec, c: &ActionContext<'_>) -> Result<Vec<PhaseStep>, CoreError> {
        if self.id() == regular_id(self.character()) {
            return self
                .bases(c)?
                .iter()
                .filter(|o| !info_done(c.rule_service.facts().unwrap(), o, self.character()))
                .map(|o| self.step(c, o))
                .collect();
        }
        self.preparation_candidates(c, false)?
            .iter()
            .chain(self.preparation_candidates(c, true)?.iter())
            .map(|o| self.step(c, o))
            .collect()
    }
    fn propose(
        &self,
        s: &ActionSpec,
        c: &ActionContext<'_>,
        o: &ActionOccurrence,
        input: &StepInput,
    ) -> Result<ActionEventDraft, CoreError> {
        self.propose_input(
            s,
            c,
            o,
            &ActionInput {
                input: input.clone(),
                delivered_result: None,
                registration_judgments: vec![],
            },
        )
    }
    fn propose_input(
        &self,
        _: &ActionSpec,
        c: &ActionContext<'_>,
        o: &ActionOccurrence,
        input: &ActionInput,
    ) -> Result<ActionEventDraft, CoreError> {
        let (result, _) = self.resolve(c, o, input)?;
        Ok(ActionEventDraft::Custom(CustomActionEventDraft {
            step_id: o.step_id()?,
            action_ref: o.action_ref.clone(),
            ability_use: o.ability_use.clone(),
            simulation_source: o.simulation_source.clone(),
            follow_up_cause: o.follow_up_cause.clone(),
            action_cause: o.action_cause.clone(),
            input: input.input.clone(),
            delivered_result: input.delivered_result.clone(),
            registration_judgments: input.registration_judgments.clone(),
            result,
        }))
    }
    fn validate_event(
        &self,
        s: &ActionSpec,
        c: &ActionContext<'_>,
        o: &ActionOccurrence,
        d: &ActionEventDraft,
    ) -> Result<CustomFactChanges, CoreError> {
        self.validate_event_with_id(s, c, o, d, c.event_id)
    }
    fn validate_event_with_id(
        &self,
        _: &ActionSpec,
        c: &ActionContext<'_>,
        o: &ActionOccurrence,
        d: &ActionEventDraft,
        _: &str,
    ) -> Result<CustomFactChanges, CoreError> {
        let ActionEventDraft::Custom(d) = d else {
            return Err(invalid());
        };
        let (expected, changes) = self.resolve(
            c,
            o,
            &ActionInput {
                input: d.input.clone(),
                delivered_result: d.delivered_result.clone(),
                registration_judgments: d.registration_judgments.clone(),
            },
        )?;
        if expected != d.result {
            return Err(invalid());
        }
        Ok(changes)
    }
}

fn information_causes(
    facts: &CustomGameFacts,
    o: &ActionOccurrence,
    character: &str,
    judgments: &[RegistrationJudgment],
) -> Result<(Vec<DeliveryReason>, Vec<AbilityUseRef>), CoreError> {
    let actor = o.actor_player_id().ok_or_else(invalid)?;
    let mut reasons = vec![];
    let mut causes = crate::effects::impairment_causes(facts, actor);
    for impairment in facts
        .active_impairments
        .iter()
        .filter(|i| i.player_id == actor)
    {
        let reason = match impairment.kind {
            ImpairmentKind::Drunk => DeliveryReason::Drunk,
            ImpairmentKind::Poisoned => DeliveryReason::Poisoned {
                poisoner_player_id: facts
                    .resolved_impairments
                    .iter()
                    .find(|e| e.impairment == *impairment)
                    .ok_or_else(invalid)?
                    .source_ability_use
                    .owner_player_id
                    .clone(),
                poison_event_id: impairment.source_event_id.clone(),
            },
        };
        if !reasons.contains(&reason) {
            reasons.push(reason);
        }
    }
    if let Some(sim) = &o.simulation_source {
        if !reasons.contains(&DeliveryReason::Drunk) {
            reasons.push(DeliveryReason::Drunk);
        }
        if sim.source_ability_use.character_id == "drunk"
            && !causes.contains(&sim.source_ability_use)
        {
            causes.push(sim.source_ability_use.clone());
        }
    }
    if vortox_applies(facts, o, character) {
        for source in &facts.vortox_sources {
            reasons.push(DeliveryReason::Vortox {
                demon_player_id: source.owner_player_id.clone(),
            });
            if !causes.contains(source) {
                causes.push(source.clone());
            }
        }
    }
    if !judgments.is_empty() {
        reasons.push(DeliveryReason::RegistrationJudgment {
            judgments: judgments.to_vec(),
        });
        for j in judgments {
            let source = registration_source(facts, &j.player_id).ok_or_else(invalid)?;
            if !causes.contains(&source) {
                causes.push(source);
            }
        }
    }
    Ok((reasons, causes))
}

fn spy_reminders(facts: &CustomGameFacts, player: &str) -> Vec<AutomaticReminder> {
    let mut result = vec![];
    let mut latest = vec![];
    for prep in facts.preparations.iter().rev() {
        if latest.iter().any(|o: &&ActionOccurrence| {
            same_source(o, &prep.occurrence) && o.action_ref == prep.occurrence.action_ref
        }) {
            continue;
        }
        latest.push(&prep.occurrence);
        let FirstNightActionRef::Character { character_id, .. } = &prep.occurrence.action_ref
        else {
            continue;
        };
        let token = match &prep.result {
            CustomActionResult::RedHerringAssigned { target_player_id }
                if target_player_id == player =>
            {
                Some("redHerring")
            }
            CustomActionResult::InformationPrepared { preparation } => {
                match &preparation.information {
                    InformationResult::SetupInfo { player_ids, .. }
                        if player_ids.iter().any(|id| id == player) =>
                    {
                        Some(
                            if preparation.correct_player_id.as_deref() == Some(player) {
                                match character_id.as_str() {
                                    "washerwoman" => "townsfolk",
                                    "librarian" => "outsider",
                                    _ => "minion",
                                }
                            } else {
                                "wrong"
                            },
                        )
                    }
                    _ => None,
                }
            }
            _ => None,
        };
        if let Some(token) = token {
            result.push(AutomaticReminder {
                player_id: player.into(),
                character_id: character_id.clone(),
                token_id: token.into(),
                label: token.into(),
                description: token.into(),
                count: None,
                inactive_reason: None,
                source_event_id: Some(prep.event_id.clone()),
            });
        }
    }
    let mut add = |character: &str, token: &str, event: &str| {
        result.push(AutomaticReminder {
            player_id: player.into(),
            character_id: character.into(),
            token_id: token.into(),
            label: token.into(),
            description: token.into(),
            count: None,
            source_event_id: Some(event.into()),
            inactive_reason: None,
        })
    };
    if let Some(p) = facts
        .player(player)
        .filter(|p| p.actual_character == "drunk")
    {
        add("drunk", "isTheDrunk", &p.ability_instance.source_event_id);
    }
    for grant in facts
        .ability_grants
        .iter()
        .filter(|g| g.owner_player_id == player && g.character_id == "drunk")
    {
        add("drunk", "isTheDrunk", &grant.source_event_id);
    }
    for effect in facts
        .active_impairments
        .iter()
        .filter(|e| e.player_id == player)
    {
        add(
            &effect.source_character_id,
            if effect.kind == ImpairmentKind::Poisoned {
                "poisoned"
            } else {
                "drunk"
            },
            &effect.source_event_id,
        );
    }
    for choice in facts
        .master_choices
        .iter()
        .filter(|c| c.target_player_id == player)
    {
        add("butler", "master", &choice.source_event_id);
    }
    for curse in facts
        .witch_curses
        .iter()
        .filter(|c| c.target_player_id == player)
    {
        add("witch", "cursed", &curse.source_event_id);
    }
    for madness in facts
        .madness_assignments
        .iter()
        .filter(|c| c.target_player_id == player)
    {
        add("cerenovus", "mad", &madness.source_event_id);
    }
    for twin in facts
        .twin_relationships
        .iter()
        .filter(|c| c.effective && c.target_player_id == player)
    {
        add("evilTwin", "twin", &twin.source_event_id);
    }
    for used in facts
        .ability_uses
        .iter()
        .filter(|c| c.ability_use.owner_player_id == player)
    {
        add(
            &used.ability_use.character_id,
            "noAbility",
            &used.source_event_id,
        );
    }
    result
}
pub(crate) fn refresh_assignments(facts: &mut CustomGameFacts) {
    let poison = facts
        .poisoner_choices
        .iter()
        .map(|c| {
            facts.resolved_impairments.iter().any(|e| {
                e.impairment.source_event_id == c.source_event_id
                    && e.source_ability_use == c.ability_use
            })
        })
        .collect::<Vec<_>>();
    let masters = facts
        .master_choices
        .iter()
        .map(|c| c.initially_effective && effective(facts, &c.ability_use))
        .collect::<Vec<_>>();
    for (c, active) in facts.poisoner_choices.iter_mut().zip(poison) {
        c.effective = active;
    }
    for (c, active) in facts.master_choices.iter_mut().zip(masters) {
        c.effective = active;
    }
}
pub(crate) fn activation(context: &ActivationContext<'_>) -> Option<ActivationDecision> {
    let FirstNightActionRef::Character { character_id, .. } = context.action_ref else {
        return None;
    };
    if !custom_registry_entries()
        .iter()
        .any(|(id, _)| *id == character_id)
    {
        return None;
    }
    Some(if is_start_info(character_id) || character_id == "chef" {
        ActivationDecision::RunImmediately
    } else if context.entry_index >= context.cursor {
        ActivationDecision::JoinPendingOrder
    } else {
        ActivationDecision::Defer
    })
}

fn alignment_variants(
    facts: &CustomGameFacts,
    ids: &[String],
    scope: Option<RegistrationScope>,
) -> Vec<Vec<RegistrationJudgment>> {
    let mut variants = vec![vec![]];
    for id in ids {
        if let Some(source) = registration_source(facts, id) {
            let value = if source.character_id == "spy" {
                RegistrationValue::Good
            } else {
                RegistrationValue::Evil
            };
            let old = variants.clone();
            for mut js in old {
                js.push(RegistrationJudgment {
                    player_id: id.clone(),
                    registered_as: value,
                    character_id: None,
                    scope: scope.clone(),
                });
                variants.push(js);
            }
        }
    }
    variants
}
fn demon_variants(facts: &CustomGameFacts, ids: &[String]) -> Vec<Vec<RegistrationJudgment>> {
    let mut variants = vec![vec![]];
    for id in ids {
        if registration_source(facts, id).is_some_and(|s| s.character_id == "recluse") {
            let old = variants.clone();
            for mut js in old {
                js.push(RegistrationJudgment {
                    player_id: id.clone(),
                    registered_as: RegistrationValue::Demon,
                    character_id: None,
                    scope: None,
                });
                variants.push(js);
            }
        }
    }
    variants
}

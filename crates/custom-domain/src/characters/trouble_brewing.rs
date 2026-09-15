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
        .filter(|choice| choice.initially_effective && day_effect_in_lifetime(facts, choice.day))
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
        "monk" => "protectPlayer",
        "imp" => "attackPlayer",
        "undertaker" => "learnExecutedCharacter",
        "ravenkeeper" => "learnCharacter",
        _ => "",
    }
}
fn is_start_info(c: &str) -> bool {
    matches!(c, "washerwoman" | "librarian" | "investigator")
}
fn info_done(facts: &CustomGameFacts, o: &ActionOccurrence, c: &str) -> bool {
    facts.confirmed_actions.iter().any(|f| {
        same_source(&f.occurrence, o)
            && f.occurrence.action_ref == reference(c, regular_id(c))
            && (is_start_info(c)
                || c == "chef"
                || (f.occurrence.night == facts.night_number()
                    && (c != "ravenkeeper" || f.occurrence.action_cause == o.action_cause)))
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
        || preparation
            .correct_player_id
            .as_ref()
            .is_some_and(|id| !player_ids.contains(id))
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
// Match the original TB reminder contract: identify a unique candidate from the
// selected identity/registration; arbitrary impaired information has no invented correct seat.
fn identified_setup_player(
    facts: &CustomGameFacts,
    information: &InformationResult,
    judgments: &[RegistrationJudgment],
) -> Option<String> {
    let InformationResult::SetupInfo {
        player_ids,
        character_id: Some(character),
        zero_outsiders: false,
    } = information
    else {
        return None;
    };
    let registered = judgments
        .iter()
        .filter(|j| player_ids.contains(&j.player_id) && j.character_id.as_ref() == Some(character))
        .collect::<Vec<_>>();
    if registered.len() == 1 {
        return Some(registered[0].player_id.clone());
    }
    let matching = player_ids
        .iter()
        .filter(|id| {
            facts.player(id).is_some_and(|p| {
                p.actual_character == *character
                    || p.actual_character == "drunk" && p.shown_character == *character
            })
        })
        .collect::<Vec<_>>();
    (matching.len() == 1).then(|| matching[0].clone())
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
/// Candidate projection and confirmation share the same character validation. UI code never
/// guesses the correct token or whether a registration is legal for an impaired ability.
fn preparation_choices(
    definition: &ResolvedScriptContext,
    facts: &CustomGameFacts,
    character: &str,
    occurrence: &ActionOccurrence,
) -> Result<Vec<SetupInformationChoice>, CoreError> {
    let roles = definition
        .character_ids()
        .into_iter()
        .filter(|id| definition.character_kind(id) == Some(required_kind(character)))
        .collect::<Vec<_>>();
    let mut choices = vec![];
    let mut add = |preparation: InformationPreparation,
                   registration_judgments: Vec<RegistrationJudgment>| {
        if validate_preparation(
            definition,
            facts,
            character,
            occurrence,
            &preparation,
            &registration_judgments,
        )
        .is_ok()
        {
            let choice = SetupInformationChoice {
                preparation,
                registration_judgments,
            };
            choices.push(choice);
        }
    };
    for (index, first) in facts.players.iter().enumerate() {
        for second in facts.players.iter().skip(index + 1) {
            for role in &roles {
                let information = InformationResult::SetupInfo {
                    player_ids: vec![first.id.clone(), second.id.clone()],
                    character_id: Some((*role).into()),
                    zero_outsiders: false,
                };
                // Original TB setupInfoRegistrationJudgments: actual identity first;
                // otherwise the first eligible selected registration source in seat order.
                // The shown identity supplies the necessary registration, not an extra UI.
                let represented = [first, second].iter().any(|p| p.actual_character == *role);
                let judgments = if represented
                    || has_discretion(facts, occurrence)
                    || vortox_applies(facts, occurrence, character)
                {
                    vec![]
                } else {
                    [first, second]
                        .iter()
                        .find_map(|p| {
                            let source = registration_source(facts, &p.id)?;
                            let judgment = RegistrationJudgment {
                                scope: None,
                                player_id: p.id.clone(),
                                registered_as: match required_kind(character) {
                                    CharacterKind::Townsfolk => RegistrationValue::Townsfolk,
                                    CharacterKind::Outsider => RegistrationValue::Outsider,
                                    _ => RegistrationValue::Minion,
                                },
                                character_id: Some((*role).into()),
                            };
                            registration_allowed(&source.character_id, &judgment, definition)
                                .then_some(vec![judgment])
                        })
                        .unwrap_or_default()
                };
                let correct_player_id = identified_setup_player(facts, &information, &judgments);
                add(
                    InformationPreparation {
                        information,
                        correct_player_id,
                    },
                    judgments,
                );
            }
        }
    }
    if character == "librarian" {
        add(
            InformationPreparation {
                information: InformationResult::SetupInfo {
                    player_ids: vec![],
                    character_id: None,
                    zero_outsiders: true,
                },
                correct_player_id: None,
            },
            vec![],
        );
    }
    Ok(choices)
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
        ("monk", "protectPlayer"),
        ("imp", "attackPlayer"),
        ("undertaker", "learnExecutedCharacter"),
        ("ravenkeeper", "learnCharacter"),
    ]
    .into_iter()
    .map(|(c, a)| {
        let action_ref = reference(c, a);
        RegisteredAction {
            spec: ActionSpec {
                prerequisites: match (c, a) {
                    ("washerwoman", "learnTownsfolk")
                    | ("librarian", "learnOutsider")
                    | ("investigator", "learnMinion") => vec![reference(c, "prepareInformation")],
                    ("fortuneTeller", "checkDemon") => vec![reference(c, "assignRedHerring")],
                    _ => vec![],
                },
                continuation_sources: vec![
                    crate::first_night::execution::DependencySource::Preparation,
                    crate::first_night::execution::DependencySource::ImmediateOrigin,
                ],
                action_ref: action_ref.clone(),
                participates_in_first_night: crate::first_night::catalog::ORDERED_ACTIONS
                    .contains(&(c, a)),
                required_input_kind: if a == "prepareInformation" {
                    RequiredInputKind::SetupInfo
                } else if a == "assignShownCharacter" {
                    RequiredInputKind::CharacterIds
                } else if matches!(
                    c,
                    "fortuneTeller" | "poisoner" | "butler" | "monk" | "imp" | "ravenkeeper"
                ) {
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
        if self.character() == "ravenkeeper" {
            return raven_occurrences(facts, &self.action_ref);
        }

        if self.character() == "undertaker"
            && !facts.day.as_ref().is_some_and(|d| {
                d.deaths.iter().any(|death| {
                    death.cause.cause == crate::day::contracts::DayDeathCause::Execution
                })
            })
        {
            return Ok(vec![]);
        }
        let mut bases = c
            .rule_service
            .try_owned_instances(&self.action_ref)?
            .into_iter()
            .filter(|i| {
                facts
                    .player(&i.ability_use.owner_player_id)
                    .is_some_and(|p| {
                        p.alive || super::sects_and_violets::vigor_can_act(facts, &i.ability_use)
                    })
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
                && !matches!(
                    self.character(),
                    "fortuneTeller" | "poisoner" | "butler" | "monk" | "imp" | "ravenkeeper"
                ) => {}
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
                            !matches!(self.character(), "butler" | "monk")
                                || Some(p.id.as_str()) != o.actor_player_id()
                        })
                        .map(|p| p.id.clone())
                        .collect(),
                );
            }
        }
        if self.id() == "assignRedHerring" {
            let registrations = facts
                .players
                .iter()
                .filter_map(|p| {
                    let source = registration_source(facts, &p.id)?;
                    (source.character_id == "spy").then(|| RegistrationJudgment {
                        scope: None,
                        player_id: p.id.clone(),
                        registered_as: RegistrationValue::Good,
                        character_id: None,
                    })
                })
                .collect::<Vec<_>>();
            input.allowed_player_ids = Some(
                facts
                    .players
                    .iter()
                    .filter(|p| {
                        p.alignment == Alignment::Good
                            || registrations.iter().any(|j| j.player_id == p.id)
                    })
                    .map(|p| p.id.clone())
                    .collect(),
            );
            input.player_registration_options = Some(registrations);
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
        if self.character() == "imp" {
            let scarlet = facts.players.iter().filter(|p| p.alive).count() >= 5
                && facts.ability_provenance.iter().any(|r| {
                    r.ability_use.character_id == "scarletWoman" && effective(facts, &r.ability_use)
                });
            step.required_input.allowed_successor_player_ids = Some(if scarlet {
                vec![]
            } else {
                facts
                    .players
                    .iter()
                    .filter(|p| {
                        p.alive
                            && definition.character_kind(&p.actual_character)
                                == Some(CharacterKind::Minion)
                    })
                    .map(|p| p.id.clone())
                    .collect()
            });
        }
        if self.character() == "imp" {
            let successors = step.required_input.allowed_successor_player_ids.clone().unwrap_or_default();
            enrich_attack_input(facts, o.ability_use.as_ref(), &mut step.required_input, &successors);
        }
        step.ability_origin = o
            .ability_use
            .as_ref()
            .and_then(|s| crate::reducer::recorded_ability(facts, s))
            .map(|r| r.origin.clone());
        if (self.id() == regular_id(self.character())
            && !matches!(self.character(), "poisoner" | "butler" | "monk" | "imp"))
            || (self.id() == "prepareInformation" && is_start_info(self.character()))
        {
            step.information_prompt = self.prompt(c, o)?;
        }
        if is_start_info(self.character()) {
            let mut source = o.clone();
            source.action_ref = reference(self.character(), "prepareInformation");
            let prior = last_preparation(facts, &source);
            let preparation = if self.id() == "prepareInformation" {
                Some(o.clone())
            } else if let Some(prior) = prior {
                Some(prior.occurrence.clone())
            } else {
                TbHandler {
                    action_ref: reference(self.character(), "prepareInformation"),
                }
                .preparation_candidates(c, false)?
                .into_iter()
                .find(|candidate| same_source(candidate, o))
            };
            if let Some(preparation) = preparation {
                step.information_flow = Some(crate::model::InformationFlow {
                    id: if prior.is_some() && self.id() != "prepareInformation" {
                        preparation.step_id()?
                    } else {
                        preparation.in_night(c.night_number()).step_id()?
                    },
                    preparation_event_id: if self.id() == "prepareInformation" {
                        None
                    } else {
                        prior.map(|p| p.event_id.clone())
                    },
                });
            }
        }
        Ok(step)
    }
    fn prompt(
        &self,
        c: &ActionContext<'_>,
        o: &ActionOccurrence,
    ) -> Result<Option<InformationPrompt>, CoreError> {
        let facts = c.rule_service.facts().ok_or_else(invalid)?;
        let view = death_information_facts(facts, o)?;
        let facts = view.as_ref();
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
        if self.character() == "undertaker" {
            let actual = self.truth(definition, facts, o, &[], &[])?;
            let death = facts
                .day
                .as_ref()
                .and_then(|d| {
                    d.deaths
                        .iter()
                        .rev()
                        .find(|d| d.cause.cause == crate::day::contracts::DayDeathCause::Execution)
                })
                .ok_or_else(invalid)?;
            let source = historical_registration_source(&death.participant);
            let mut choices = vec![];
            for id in definition.character_ids() {
                let result = InformationResult::Character {
                    character_id: id.into(),
                };
                if vortox_applies(facts, o, self.character()) && result == actual {
                    continue;
                }
                let mut judgments = vec![];
                if result != actual
                    && !has_discretion(facts, o)
                    && !vortox_applies(facts, o, self.character())
                {
                    let Some(source) = &source else {
                        continue;
                    };
                    let registered_as = match definition.character_kind(id).unwrap() {
                        CharacterKind::Townsfolk => RegistrationValue::Townsfolk,
                        CharacterKind::Outsider => RegistrationValue::Outsider,
                        CharacterKind::Minion => RegistrationValue::Minion,
                        CharacterKind::Demon => RegistrationValue::Demon,
                    };
                    let j = RegistrationJudgment {
                        scope: None,
                        player_id: death.participant.player_id.clone(),
                        registered_as,
                        character_id: Some(id.into()),
                    };
                    if !registration_allowed(&source.character_id, &j, definition) {
                        continue;
                    }
                    judgments.push(j);
                }
                choices.push(TargetInformationChoice {
                    is_computed: result == actual,
                    result,
                    registration_judgments: judgments,
                });
            }
            if source.is_some() {
                prompt
                    .registration_candidate_player_ids
                    .push(death.participant.player_id.clone());
                prompt.delivery_mode = InformationDeliveryMode::Selectable;
            }
            prompt.computed_result = Some(actual.clone());
            prompt.target_checks.push(TargetInformationCheck {
                fixed_character_id: None,
                target_player_ids: vec![death.participant.player_id.clone()],
                computed_result: actual,
                choices,
            });
            return Ok(Some(prompt));
        }
        if self.character() == "ravenkeeper" {
            for player in &facts.players {
                let actual = self.truth(definition, facts, o, &[player.id.clone()], &[])?;
                let mut choices = vec![TargetInformationChoice {
                    result: actual.clone(),
                    is_computed: true,
                    registration_judgments: vec![],
                }];
                if has_discretion(facts, o) || vortox_applies(facts, o, self.character()) {
                    choices = definition
                        .character_ids()
                        .into_iter()
                        .map(|id| InformationResult::Character {
                            character_id: id.into(),
                        })
                        .filter(|v| !vortox_applies(facts, o, self.character()) || *v != actual)
                        .map(|result| TargetInformationChoice {
                            is_computed: result == actual,
                            result,
                            registration_judgments: vec![],
                        })
                        .collect();
                } else if let Some(source) = registration_source(facts, &player.id) {
                    for id in definition.character_ids() {
                        let registered_as = match definition.character_kind(id).unwrap() {
                            CharacterKind::Townsfolk => RegistrationValue::Townsfolk,
                            CharacterKind::Outsider => RegistrationValue::Outsider,
                            CharacterKind::Minion => RegistrationValue::Minion,
                            CharacterKind::Demon => RegistrationValue::Demon,
                        };
                        let j = RegistrationJudgment {
                            scope: None,
                            player_id: player.id.clone(),
                            registered_as,
                            character_id: Some(id.into()),
                        };
                        if registration_allowed(&source.character_id, &j, definition) {
                            choices.push(TargetInformationChoice {
                                result: InformationResult::Character {
                                    character_id: id.into(),
                                },
                                is_computed: id == player.actual_character,
                                registration_judgments: vec![j],
                            });
                        }
                    }
                }
                prompt.target_checks.push(TargetInformationCheck {
                    fixed_character_id: None,
                    target_player_ids: vec![player.id.clone()],
                    computed_result: actual,
                    choices,
                });
            }
            return Ok(Some(prompt));
        }
        if is_start_info(self.character()) {
            return Ok(Some(prompt));
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
                // Preserve per-edge results and also expose uniform team choices used by
                // the original TB editor. Equal numeric outcomes can have distinct witnesses.
                let mut variants = totals.into_values().collect::<Vec<_>>();
                variants.extend(alignment_variants(
                    facts,
                    &players.iter().map(|p| p.id.clone()).collect::<Vec<_>>(),
                    None,
                ));
                variants
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
                if !choices.iter().any(|c: &TargetInformationChoice| {
                    c.result == result && c.registration_judgments == js
                }) {
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
                    fixed_character_id: None,
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
            "ravenkeeper" => InformationResult::Character {
                character_id: identities(
                    &[targets.first().ok_or_else(invalid)?.clone()],
                    judgments,
                )?[0]
                    .0
                    .clone(),
            },
            "undertaker" => {
                let death = facts
                    .day
                    .as_ref()
                    .and_then(|d| {
                        d.deaths.iter().rev().find(|death| {
                            death.cause.cause == crate::day::contracts::DayDeathCause::Execution
                        })
                    })
                    .ok_or_else(invalid)?;
                let p = &death.participant;
                if judgments.len() > 1
                    || judgments.iter().any(|j| {
                        j.player_id != p.player_id
                            || j.scope.is_some()
                            || j.character_id.is_none()
                            || !historical_registration_source(p).is_some_and(|source| {
                                registration_allowed(&source.character_id, j, definition)
                            })
                    })
                {
                    return Err(invalid());
                }
                InformationResult::Character {
                    character_id: judgments
                        .first()
                        .and_then(|j| j.character_id.clone())
                        .unwrap_or_else(|| p.character_id.clone()),
                }
            }
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
                            automatic_reminders: crate::reminders::for_player(facts, &p.id),
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
        let view = death_information_facts(facts, o)?;
        let facts = view.as_ref();
        let definition = c.rule_service.definition().ok_or_else(invalid)?;
        let actor = o.actor_player_id().ok_or_else(invalid)?;
        let targets = if matches!(
            self.character(),
            "fortuneTeller" | "poisoner" | "butler" | "monk" | "imp" | "ravenkeeper"
        ) {
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
            if self.character() == "undertaker" {
                vec![facts
                    .day
                    .as_ref()
                    .and_then(|d| {
                        d.deaths.iter().rev().find(|death| {
                            death.cause.cause == crate::day::contracts::DayDeathCause::Execution
                        })
                    })
                    .ok_or_else(invalid)?
                    .participant
                    .player_id
                    .clone()]
            } else {
                vec![]
            }
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
                day: u16::try_from(facts.night_number()).map_err(|_| invalid())?,
                initially_effective: active,
                effective: active,
            };
            let (details, causes) = information_causes(facts, o, self.character(), &[])?;
            let audit = if !active && !causes.is_empty() {
                vec![MalfunctionEvidence {
                    daytime_step_id: None,
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
                        day: u16::try_from(facts.night_number()).map_err(|_| invalid())?,
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
                        day: u16::try_from(facts.night_number()).map_err(|_| invalid())?,
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
                InformationResult::Character { .. },
                InformationResult::Character { character_id },
            ) => definition.character_kind(character_id).is_some(),
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
                daytime_step_id: None,
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
                daytime_step_id: None,
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
        if matches!(self.character(), "monk" | "imp") {
            if input.delivered_result.is_some() || !input.registration_judgments.is_empty() {
                return Err(invalid());
            }
            let actor = o.actor_player_id().ok_or_else(invalid)?;
            let fields = input.input.as_ref().ok_or_else(invalid)?;
            let ids = fields.player_ids.clone().ok_or_else(invalid)?;
            if ids.len() != 1 || (self.character() == "monk" && ids[0] == actor) {
                return Err(invalid());
            }
            if *fields
                != (StepInputFields {
                    player_ids: Some(ids.clone()),
                    mayor_decision: if self.character() == "imp" {
                        fields.mayor_decision.clone()
                    } else {
                        None
                    },
                    successor_player_id: if self.character() == "imp" {
                        fields.successor_player_id.clone()
                    } else {
                        None
                    },
                    ..Default::default()
                })
            {
                return Err(invalid());
            }
            let target = ids[0].clone();
            let player = facts.player(&target).ok_or_else(invalid)?;
            if self.character() == "monk" && o.simulation_source.is_some() {
                return Ok((
                    CustomActionResult::Simulation {
                        information: None,
                        spent: false,
                    },
                    CustomFactChanges::default(),
                ));
            }
            let source = o.ability_use.as_ref().ok_or_else(invalid)?;
            let active = effective(facts, source);
            if self.character() == "monk" {
                return Ok((
                    CustomActionResult::MonkProtection {
                        target_player_id: target.clone(),
                        effective: active,
                    },
                    CustomFactChanges::default().with_monk(TargetAssignment {
                        source_event_id: c.event_id.into(),
                        ability_use: source.clone(),
                        target_player_id: target,
                        day: u16::try_from(facts.night_number()).map_err(|_| invalid())?,
                        initially_effective: active,
                        effective: active,
                    }),
                ));
            }
            let killed = demon_attack_target(facts, source, player, &fields.mayor_decision)?;
            let mut identities = vec![];
            let mut eligible: Vec<_> = facts
                .players
                .iter()
                .filter(|p| {
                    p.alive
                        && p.id != actor
                        && definition.character_kind(&p.actual_character)
                            == Some(CharacterKind::Minion)
                })
                .collect();
            eligible.sort_by_key(|p| p.seat);
            let scarlet = facts.players.iter().filter(|p| p.alive).count() >= 5
                && facts.ability_provenance.iter().any(|r| {
                    r.ability_use.character_id == "scarletWoman" && effective(facts, &r.ability_use)
                });
            if killed.as_deref() == Some(actor) && target == actor && scarlet {
                if fields.successor_player_id.is_some() {
                    return Err(invalid());
                }
                // Scarlet Woman owns the fixed succession in the death reducer.
            } else if killed.as_deref() == Some(actor) && target == actor && !eligible.is_empty() {
                let successor = fields
                    .successor_player_id
                    .as_ref()
                    .and_then(|id| eligible.iter().find(|p| p.id == *id))
                    .ok_or_else(invalid)?;
                identities.push(PlayerIdentityTransition {
                    player_id: successor.id.clone(),
                    before: IdentityState {
                        actual_character: successor.actual_character.clone(),
                        shown_character: successor.shown_character.clone(),
                        alignment: successor.alignment,
                    },
                    after: IdentityState {
                        actual_character: "imp".into(),
                        shown_character: "imp".into(),
                        alignment: successor.alignment,
                    },
                });
            } else if fields.successor_player_id.is_some() {
                return Err(invalid());
            }
            return Ok((
                CustomActionResult::NightAttack {
                    target_player_id: target,
                    killed_player_id: killed.clone(),
                    died: killed.is_some(),
                    identity_changes: identities.clone(),
                },
                CustomFactChanges::resolved(identities, vec![], Default::default())
                    .with_audit(
                        if killed.is_none()
                            && !super::sects_and_violets::demon_deaths_arbitrary(facts)
                        {
                            super::sects_and_violets::night_impairment_failure(
                                facts,
                                o,
                                c.event_id,
                                FailedEffect::DemonDeath,
                            )
                        } else {
                            vec![]
                        },
                    )
                    .with_life_changes(
                        killed
                            .into_iter()
                            .map(|player_id| crate::event::PlayerLifeChange {
                                player_id,
                                alive: false,
                            })
                            .collect(),
                    ),
            ));
        }
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
                    correct_player_id: fields.correct_player_id.clone().or_else(|| {
                        identified_setup_player(
                            facts,
                            &InformationResult::SetupInfo {
                                player_ids: fields.player_ids.clone().unwrap_or_default(),
                                character_id: fields.character_id.clone(),
                                zero_outsiders: zero,
                            },
                            &input.registration_judgments,
                        )
                    }),
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
impl crate::first_night::FollowUpRule for TbHandler {
    fn candidates(
        &self,
        c: &crate::first_night::FollowUpContext<'_>,
    ) -> Result<Vec<ActionOccurrence>, CoreError> {
        if self.character() != "ravenkeeper" {
            return Ok(vec![]);
        }
        Ok(raven_occurrences(c.next_facts,&self.action_ref)?.into_iter().filter(|o|
            matches!(&o.action_cause,Some(ActionCause::Death {death_event_id}) if death_event_id==c.event.event_id())).collect())
    }
}
impl ActionHandler for TbHandler {
    fn historical_source(&self, c: &ActionContext<'_>, o: &ActionOccurrence) -> bool {
        self.character() == "ravenkeeper"
            && self
                .bases(c)
                .is_ok_and(|bases| bases.iter().any(|b| b.clone().in_night(o.night) == *o))
    }
    fn follow_up_rule(&self) -> Option<&dyn crate::first_night::FollowUpRule> {
        (self.character() == "ravenkeeper").then_some(self)
    }

    fn dependency_event(
        &self,
        context: &ActionContext<'_>,
        occurrence: &ActionOccurrence,
    ) -> Result<Option<String>, CoreError> {
        if let Some(ActionCause::Delivery {
            preparation_event_id,
        }) = &occurrence.action_cause
        {
            return Ok(Some(preparation_event_id.clone()));
        }
        if self.id() == "checkDemon"
            || (is_start_info(self.character()) && self.id() == regular_id(self.character()))
        {
            let mut preparation = occurrence.clone();
            preparation.action_ref = reference(
                self.character(),
                if self.id() == "checkDemon" {
                    "assignRedHerring"
                } else {
                    "prepareInformation"
                },
            );
            return Ok(last_preparation(
                context.rule_service.facts().ok_or_else(invalid)?,
                &preparation,
            )
            .map(|p| p.event_id.clone()));
        }
        Ok(None)
    }

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
    fn enrich_input(
        &self,
        c: &ActionContext<'_>,
        o: &ActionOccurrence,
        step: &mut PhaseStep,
    ) -> Result<(), CoreError> {
        if self.id() == "prepareInformation" {
            let choices = preparation_choices(
                c.rule_service.definition().ok_or_else(invalid)?,
                c.rule_service.facts().ok_or_else(invalid)?,
                self.character(),
                o,
            )?;
            step.required_input.zero_allowed = choices.iter().any(|choice| {
                matches!(
                    choice.preparation.information,
                    InformationResult::SetupInfo {
                        zero_outsiders: true,
                        ..
                    }
                )
            });
            step.required_input.setup_information_choices = Some(choices);
        }
        Ok(())
    }
    fn project(&self, _: &ActionSpec, c: &ActionContext<'_>) -> Result<Vec<PhaseStep>, CoreError> {
        if c.night_number() == 1 && matches!(self.character(), "monk" | "imp" | "undertaker") {
            return Ok(vec![]);
        }

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
            let source = if character == "undertaker" {
                facts
                    .day
                    .as_ref()
                    .and_then(|d| {
                        d.deaths.iter().rev().find(|d| {
                            d.cause.cause == crate::day::contracts::DayDeathCause::Execution
                        })
                    })
                    .and_then(|d| historical_registration_source(&d.participant))
            } else {
                registration_source(facts, &j.player_id)
            }
            .ok_or_else(invalid)?;
            if !causes.contains(&source) {
                causes.push(source);
            }
        }
    }
    Ok((reasons, causes))
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
        .map(|c| {
            c.initially_effective
                && effective(facts, &c.ability_use)
                && day_effect_in_lifetime(facts, c.day)
        })
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
    Some(
        if character_id == "imp"
            && matches!(context.event,crate::first_night::ValidatedActionEvent::Custom(e) if matches!(e.payload().result,CustomActionResult::NightAttack {..}))
        {
            ActivationDecision::Defer
        } else if is_start_info(character_id) || character_id == "chef" {
            ActivationDecision::RunImmediately
        } else if context.entry_index >= context.cursor {
            ActivationDecision::JoinPendingOrder
        } else {
            ActivationDecision::Defer
        },
    )
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

/// Count submitted votes under every currently effective Butler instance. Submitted voters
/// remain separately recorded so later information can use the facts at the vote.
pub(crate) fn day_counted_voters(facts: &CustomGameFacts, voters: &[String]) -> Vec<String> {
    voters
        .iter()
        .filter(|id| {
            !facts.master_choices.iter().any(|choice| {
                choice.ability_use.owner_player_id == **id
                    && choice.effective
                    && effective(facts, &choice.ability_use)
                    && !voters.contains(&choice.target_player_id)
            })
        })
        .cloned()
        .collect()
}

pub(crate) fn day_actions(facts: &CustomGameFacts) -> Vec<crate::day::contracts::DayAbilityAction> {
    if facts
        .day
        .as_ref()
        .is_some_and(|d| d.stage == crate::day::contracts::DayStage::NightReady)
    {
        return vec![];
    }
    crate::day::ability_actions(facts, &["slayer"])
}
pub(crate) fn day_nomination(
    context: &ResolvedScriptContext,
    prior: &CustomGameFacts,
    next: &mut CustomGameFacts,
    day: &mut crate::day::contracts::DayProgress,
    event_id: &str,
    nominator: &str,
    nominee: &str,
    spy_as_townsfolk: bool,
) -> Result<bool, CoreError> {
    use crate::day::contracts::{DayDeathCause, DayStage};
    let virgin = prior.ability_provenance.iter().find(|r| {
        r.ability_use.owner_player_id == nominee
            && r.ability_use.character_id == "virgin"
            && crate::reducer::current_ability_instance(prior, &r.ability_use)
            && prior.player(nominee).is_some_and(|p| p.alive)
            && !prior
                .ability_uses
                .iter()
                .any(|u| u.ability_use == r.ability_use)
    });
    let Some(virgin) = virgin else {
        if spy_as_townsfolk {
            return Err(invalid());
        }
        return Ok(false);
    };
    let actor = prior.player(nominator).ok_or_else(invalid)?;
    if spy_as_townsfolk
        && !registration_source(prior, &actor.id).is_some_and(|s| s.character_id == "spy")
    {
        return Err(invalid());
    }
    next.ability_uses.push(AbilityUseRecord {
        source_event_id: event_id.into(),
        ability_use: virgin.ability_use.clone(),
    });
    if effective(prior, &virgin.ability_use)
        && (context.character_kind(&actor.actual_character) == Some(CharacterKind::Townsfolk)
            || spy_as_townsfolk)
    {
        crate::day::pending_death(
            day,
            nominator,
            DayDeathCause::Virgin,
            Some(virgin.ability_use.clone()),
            event_id,
            DayStage::NightReady,
        )?;
        return Ok(true);
    }
    Ok(false)
}
pub(crate) fn day_use_ability(
    context: &ResolvedScriptContext,
    prior: &CustomGameFacts,
    day: &mut crate::day::contracts::DayProgress,
    event_id: &str,
    action: &crate::day::contracts::DayAbilityAction,
    input: &crate::day::contracts::DayAbilityInput,
) -> Result<(), CoreError> {
    use crate::day::contracts::{DayAbilityInput, DayDeathCause};
    let DayAbilityInput::Slayer {
        target_player_id,
        recluse_as_demon,
    } = input
    else {
        return Err(invalid());
    };
    if action.character_id != "slayer" {
        return Err(invalid());
    }
    let target = prior.player(target_player_id).ok_or_else(invalid)?;
    if *recluse_as_demon
        && !registration_source(prior, &target.id).is_some_and(|s| s.character_id == "recluse")
    {
        return Err(invalid());
    }
    let demon = context.character_kind(&target.actual_character) == Some(CharacterKind::Demon)
        || *recluse_as_demon;
    if action.effective && target.alive && demon {
        crate::day::pending_death(
            day,
            &target.id,
            DayDeathCause::Slayer,
            action.ability_use.clone(),
            event_id,
            day.stage,
        )?;
    }
    Ok(())
}
pub(crate) fn day_no_execution(prior: &CustomGameFacts, event_id: &str) -> Option<CustomGameEnd> {
    if prior.players.iter().filter(|p| p.alive).count() == 3
        && prior
            .ability_provenance
            .iter()
            .any(|r| r.ability_use.character_id == "mayor" && effective(prior, &r.ability_use))
    {
        Some(CustomGameEnd {
            winning_alignment: Alignment::Good,
            reason: CustomGameEndReason::MayorNoExecution,
            source_event_id: event_id.into(),
        })
    } else {
        None
    }
}
pub(crate) fn day_execution_end(
    prior: &CustomGameFacts,
    player_id: &str,
    event_id: &str,
) -> Option<CustomGameEnd> {
    prior
        .ability_provenance
        .iter()
        .any(|r| {
            r.ability_use.owner_player_id == player_id
                && r.ability_use.character_id == "saint"
                && effective(prior, &r.ability_use)
        })
        .then(|| CustomGameEnd {
            winning_alignment: Alignment::Evil,
            reason: CustomGameEndReason::SaintExecuted,
            source_event_id: event_id.into(),
        })
}
pub(crate) fn death_succession(
    context: &ResolvedScriptContext,
    prior: &CustomGameFacts,
    next: &mut CustomGameFacts,
    dead_id: &str,
    event_id: &str,
) -> Result<(), CoreError> {
    let dead = prior.player(dead_id).ok_or_else(invalid)?;
    if context.character_kind(&dead.actual_character) != Some(CharacterKind::Demon)
        || prior.players.iter().filter(|p| p.alive).count() < 5
    {
        return Ok(());
    }
    let mut successors: Vec<_> = prior
        .ability_provenance
        .iter()
        .filter(|r| {
            r.ability_use.character_id == "scarletWoman"
                && effective(prior, &r.ability_use)
                && r.ability_use.owner_player_id != dead_id
                && next
                    .player(&r.ability_use.owner_player_id)
                    .is_some_and(|p| p.alive)
        })
        .collect();
    successors.sort_by_key(|r| prior.player(&r.ability_use.owner_player_id).map(|p| p.seat));
    // Every owned Scarlet Woman instance receives its own identity transition.
    for successor in successors {
        let player = next
            .players
            .iter_mut()
            .find(|p| p.id == successor.ability_use.owner_player_id)
            .ok_or_else(invalid)?;
        if player.actual_character == dead.actual_character {
            continue;
        }
        let before = IdentityState {
            actual_character: player.actual_character.clone(),
            shown_character: player.shown_character.clone(),
            alignment: player.alignment,
        };
        player.actual_character = dead.actual_character.clone();
        player.shown_character = dead.actual_character.clone();
        let after = IdentityState {
            actual_character: player.actual_character.clone(),
            shown_character: player.shown_character.clone(),
            alignment: player.alignment,
        };
        player.ability_instance = AbilityInstance {
            id: AbilityInstanceId::new(event_id, &player.id),
            character_id: player.actual_character.clone(),
            source_event_id: event_id.into(),
        };
        next.scarlet_successions
            .push(crate::state::ScarletSuccession {
                source: successor.ability_use.clone(),
                event_id: event_id.into(),
            });
        // Identity changes immediately; a daytime successor learns this at night.
        let daytime = prior.day.as_ref().is_none_or(|d| d.stage != crate::day::contracts::DayStage::Night);
        let reveals = if daytime { &mut next.scarlet_day_reveals } else { &mut next.pending_identity_reveals };
        reveals.push(PendingIdentityReveal {
            delivery_event_id: None,
            source_event_id: event_id.into(),
            sequence: reveals
                .iter()
                .filter(|r| r.source_event_id == event_id)
                .count() as u8,
            payload: RevealPayload::CharacterChange {
                kind: "characterChange",
                player_id: player.id.clone(),
                alignment: if player.alignment == Alignment::Good {
                    "good"
                } else {
                    "evil"
                }
                .into(),
                character_id: player.shown_character.clone(),
            },
        });
        player.identity_history.push(IdentityHistoryEntry {
            source_event_id: event_id.into(),
            phase: if prior
                .day
                .as_ref()
                .is_some_and(|d| d.stage == crate::day::contracts::DayStage::Night)
            {
                Phase::Night
            } else {
                Phase::Day
            },
            before,
            after,
        });
        next.ability_provenance.push(AbilityProvenance {
            ability_use: AbilityUseRef {
                owner_player_id: player.id.clone(),
                character_id: player.actual_character.clone(),
                ability_instance_id: player.ability_instance.id.clone(),
            },
            origin: AbilityOrigin::IdentityBound,
        });
    }
    Ok(())
}

fn day_effect_in_lifetime(facts: &CustomGameFacts, day: u16) -> bool {
    facts.day.as_ref().is_none_or(|d| {
        if d.stage == crate::day::contracts::DayStage::Night {
            u32::from(day) > d.day
        } else {
            u32::from(day) == d.day
        }
    })
}

pub(crate) fn day_is_once(character: &str) -> bool {
    character == "slayer"
}

pub(crate) fn day_vote_dependencies(
    facts: &CustomGameFacts,
) -> Vec<crate::day::contracts::DayVoteDependency> {
    facts
        .master_choices
        .iter()
        .filter(|c| c.effective && effective(facts, &c.ability_use))
        .map(|c| crate::day::contracts::DayVoteDependency {
            voter_id: c.ability_use.owner_player_id.clone(),
            required_voter_id: c.target_player_id.clone(),
        })
        .collect()
}
pub(crate) fn day_registration_ids(facts: &CustomGameFacts, character: &str) -> Vec<String> {
    facts
        .players
        .iter()
        .filter(|p| registration_source(facts, &p.id).is_some_and(|s| s.character_id == character))
        .map(|p| p.id.clone())
        .collect()
}
pub(crate) fn day_first_nomination_targets(facts: &CustomGameFacts) -> Vec<String> {
    facts
        .players
        .iter()
        .filter(|p| {
            p.alive
                && facts.ability_provenance.iter().any(|r| {
                    r.ability_use.owner_player_id == p.id
                        && r.ability_use.character_id == "virgin"
                        && crate::reducer::current_ability_instance(facts, &r.ability_use)
                        && !facts
                            .ability_uses
                            .iter()
                            .any(|u| u.ability_use == r.ability_use)
                })
        })
        .map(|p| p.id.clone())
        .collect()
}

// Source-bound reminder handlers share facts with action handlers, without scheduling an action.
use crate::reminders::{ReminderContext, ReminderHandler};
pub(crate) fn reminder_handlers() -> Vec<ReminderHandler> {
    vec![
        ReminderHandler {
            character_id: "monk",
            project: monk_reminders,
        },
        ReminderHandler {
            character_id: "scarletWoman",
            project: scarlet_reminders,
        },
        ReminderHandler {
            character_id: "washerwoman",
            project: setup_reminders,
        },
        ReminderHandler {
            character_id: "librarian",
            project: setup_reminders,
        },
        ReminderHandler {
            character_id: "investigator",
            project: setup_reminders,
        },
        ReminderHandler {
            character_id: "fortuneTeller",
            project: setup_reminders,
        },
        ReminderHandler {
            character_id: "drunk",
            project: drunk_reminders,
        },
        ReminderHandler {
            character_id: "poisoner",
            project: |c| c.impairments(),
        },
        ReminderHandler {
            character_id: "butler",
            project: butler_reminders,
        },
        ReminderHandler {
            character_id: "virgin",
            project: |c| c.spent(),
        },
        ReminderHandler {
            character_id: "slayer",
            project: |c| c.spent(),
        },
        ReminderHandler {
            character_id: "undertaker",
            project: undertaker_reminders,
        },
    ]
}
fn setup_reminders(c: &ReminderContext<'_>) -> Vec<AutomaticReminder> {
    let mut result = vec![];
    let mut seen = vec![];
    for prep in c
        .facts
        .preparations
        .iter()
        .rev()
        .filter(|p| c.matches_occurrence(&p.occurrence))
    {
        if seen.contains(&prep.occurrence.action_ref) {
            continue;
        }
        seen.push(prep.occurrence.action_ref.clone());
        match &prep.result {
            CustomActionResult::RedHerringAssigned { target_player_id } => {
                result.push(c.token(target_player_id, "redHerring", &prep.event_id))
            }
            CustomActionResult::InformationPrepared { preparation } => {
                if let (InformationResult::SetupInfo { player_ids, .. }, Some(correct)) =
                    (&preparation.information, &preparation.correct_player_id)
                {
                    for player in player_ids {
                        let token = if player != correct {
                            "wrong"
                        } else {
                            match &prep.occurrence.action_ref {
                                FirstNightActionRef::Character { character_id, .. }
                                    if character_id == "washerwoman" =>
                                {
                                    "townsfolk"
                                }
                                FirstNightActionRef::Character { character_id, .. }
                                    if character_id == "librarian" =>
                                {
                                    "outsider"
                                }
                                _ => "minion",
                            }
                        };
                        result.push(c.token(player, token, &prep.event_id));
                    }
                }
            }
            _ => {}
        }
    }
    result
}
fn drunk_reminders(c: &ReminderContext<'_>) -> Vec<AutomaticReminder> {
    if !c.current() {
        return vec![];
    }
    let Some(source) = c.ability() else {
        return vec![];
    };
    let event = c
        .facts
        .players
        .iter()
        .find(|p| p.ability_instance.id == source.ability_instance_id)
        .map(|p| &p.ability_instance.source_event_id)
        .or_else(|| {
            c.facts
                .ability_grants
                .iter()
                .find(|g| g.ability_instance_id == source.ability_instance_id)
                .map(|g| &g.source_event_id)
        });
    event
        .map(|event| vec![c.token(c.owner(), "isTheDrunk", event)])
        .unwrap_or_default()
}
fn butler_reminders(c: &ReminderContext<'_>) -> Vec<AutomaticReminder> {
    c.facts
        .master_choices
        .iter()
        .filter(|choice| {
            c.matches_ability(&choice.ability_use) && day_effect_in_lifetime(c.facts, choice.day)
        })
        .map(|choice| c.token(&choice.target_player_id, "master", &choice.source_event_id))
        .collect()
}
fn undertaker_reminders(c: &ReminderContext<'_>) -> Vec<AutomaticReminder> {
    if !c.living() {
        return vec![];
    }
    let Some(execution) = c
        .facts
        .day
        .as_ref()
        .and_then(|d| d.execution.as_ref())
        .filter(|e| e.died)
    else {
        return vec![];
    };
    let (Some(player), Some(event)) = (&execution.player_id, &execution.death_event_id) else {
        return vec![];
    };
    let mut token = c.token(player, "diedToday", event);
    token.label = "오늘 사망".into();
    token.description = "오늘 처형으로 사망한 플레이어입니다.".into();
    vec![token]
}

fn scarlet_reminders(c: &ReminderContext<'_>) -> Vec<AutomaticReminder> {
    c.facts
        .scarlet_successions
        .iter()
        .filter(|r| c.matches_ability(&r.source))
        .map(|r| {
            let mut token = c.token(c.owner(), "isTheDemon", &r.event_id);
            token.label = "악마임".into();
            token.description = "붉은 여인이 악마를 승계했습니다.".into();
            token
        })
        .collect()
}

/// Resolve TB protections and Mayor redirection for any actual demon attack.
pub(crate) fn demon_attack_target(
    facts: &CustomGameFacts,
    source: &AbilityUseRef,
    target: &Player,
    mayor: &Option<MayorDecisionInput>,
) -> Result<Option<String>, CoreError> {
    let protected = |id: &str| {
        demon_protected(facts, id)
            || facts.monk_protections.iter().any(|p| {
                p.target_player_id == id
                    && u32::from(p.day) == facts.night_number()
                    && p.initially_effective
                    && effective(facts, &p.ability_use)
            })
    };
    if !effective(facts, source)
        || !target.alive
        || protected(&target.id)
        || super::sects_and_violets::demon_deaths_arbitrary(facts)
    {
        if mayor.is_some() {
            return Err(invalid());
        }
        return Ok(None);
    }
    let is_mayor = facts.ability_provenance.iter().any(|r| {
        r.ability_use.owner_player_id == target.id
            && r.ability_use.character_id == "mayor"
            && effective(facts, &r.ability_use)
    });
    if is_mayor {
        match mayor.as_ref().ok_or_else(invalid)? {
            MayorDecisionInput::MayorDies => Ok(Some(target.id.clone())),
            MayorDecisionInput::Bounce { target_player_id } => {
                if *target_player_id == target.id {
                    return Err(invalid());
                }
                let redirected = facts.player(target_player_id).ok_or_else(invalid)?;
                Ok((redirected.alive && !protected(target_player_id))
                    .then_some(target_player_id.clone()))
            }
        }
    } else {
        if mayor.is_some() {
            return Err(invalid());
        }
        Ok(Some(target.id.clone()))
    }
}

fn raven_occurrences(
    facts: &CustomGameFacts,
    reference: &FirstNightActionRef,
) -> Result<Vec<ActionOccurrence>, CoreError> {
    let mut result = vec![];
    for d in facts
        .night_deaths
        .iter()
        .filter(|d| d.night == facts.night_number())
    {
        for a in d
            .abilities
            .iter()
            .filter(|a| a.character_id == "ravenkeeper")
        {
            result.push(ActionOccurrence::from_all_parts(
                reference.clone(),
                Some(a.clone()),
                None,
                None,
                Some(ActionCause::Death {
                    death_event_id: d.event_id.clone(),
                }),
            )?);
        }
        for g in d
            .guidance
            .iter()
            .filter(|g| g.character_id == "ravenkeeper")
        {
            result.push(ActionOccurrence::from_all_parts(
                reference.clone(),
                None,
                Some(g.source.clone()),
                None,
                Some(ActionCause::Death {
                    death_event_id: d.event_id.clone(),
                }),
            )?);
        }
    }
    Ok(result)
}

// Only the dying actor's impairment is frozen; a target's registration is evaluated now.
fn death_information_facts<'a>(
    facts: &'a CustomGameFacts,
    o: &ActionOccurrence,
) -> Result<std::borrow::Cow<'a, CustomGameFacts>, CoreError> {
    let Some(ActionCause::Death { death_event_id }) = &o.action_cause else {
        return Ok(std::borrow::Cow::Borrowed(facts));
    };
    let death = facts
        .night_deaths
        .iter()
        .find(|d| d.event_id == *death_event_id)
        .ok_or_else(invalid)?;
    let actor = o.actor_player_id().ok_or_else(invalid)?;
    let mut view = facts.clone();
    view.active_impairments.retain(|e| e.player_id != actor);
    view.active_impairments.extend(
        death
            .impairments
            .iter()
            .filter(|e| e.player_id == actor)
            .cloned(),
    );
    view.resolved_impairments
        .retain(|e| e.impairment.player_id != actor);
    view.resolved_impairments.extend(
        death
            .resolved_impairments
            .iter()
            .filter(|e| e.impairment.player_id == actor)
            .cloned(),
    );
    Ok(std::borrow::Cow::Owned(view))
}

fn monk_reminders(c: &ReminderContext<'_>) -> Vec<AutomaticReminder> {
    if c.facts
        .day
        .as_ref()
        .is_some_and(|d| d.stage != crate::day::contracts::DayStage::Night)
    {
        return vec![];
    }
    c.facts
        .monk_protections
        .iter()
        .filter(|p| c.matches_ability(&p.ability_use) && u32::from(p.day) == c.facts.night_number())
        .map(|p| {
            let mut token = c.token(&p.target_player_id, "safe", &p.source_event_id);
            token.inactive_reason = (!p.initially_effective || !effective(c.facts, &p.ability_use))
                .then(|| "능력 비활성".into());
            token
        })
        .collect()
}

pub(crate) fn historical_registration_source(
    p: &crate::day::contracts::DayParticipant,
) -> Option<AbilityUseRef> {
    if !p.impairments.is_empty() {
        return None;
    }
    p.abilities
        .iter()
        .find(|s| matches!(s.character_id.as_str(), "spy" | "recluse"))
        .cloned()
}

/// Candidate input projection reuses attack resolution; UI never infers protection or Mayor eligibility.
pub(crate) fn enrich_attack_input(
    facts: &CustomGameFacts,
    source: Option<&AbilityUseRef>,
    input: &mut crate::model::RequiredInput,
    successors: &[String],
) {
    input.attack_options = Some(facts.players.iter().map(|target| {
        let mut mayor_decision = None;
        let mut successor_player_ids = vec![];
        if let Some(source) = source {
            let killed = demon_attack_target(facts, source, target, &None);
            if killed.is_err() && demon_attack_target(facts, source, target, &Some(MayorDecisionInput::MayorDies)).is_ok() {
                mayor_decision = Some(crate::model::MayorDecisionPrompt {
                    mayor_player_id: target.id.clone(),
                    bounce_target_player_ids: facts.players.iter().filter(|p| p.id != target.id).map(|p| p.id.clone()).collect(),
                });
            }
            if killed.ok().flatten().as_deref() == Some(source.owner_player_id.as_str()) && target.id == source.owner_player_id {
                successor_player_ids = successors.iter().filter(|id| **id != source.owner_player_id).cloned().collect();
            }
        }
        crate::model::AttackTargetOption { target_player_id: target.id.clone(), mayor_decision, successor_player_ids }
    }).collect());
}

pub(crate) fn notifies_identity_change(result: &crate::contracts::CustomActionResult) -> bool {
    matches!(result, crate::contracts::CustomActionResult::NightAttack { .. })
}

/// Release daytime succession notices only once the next night has begun.
pub(crate) fn begin_night_identity_reveals(facts: &mut CustomGameFacts, event_id: &str) {
    for mut reveal in std::mem::take(&mut facts.scarlet_day_reveals) {
        let RevealPayload::CharacterChange { ref player_id, ref character_id, .. } = reveal.payload else { continue; };
        if !facts.player(player_id).is_some_and(|p| p.alive && p.actual_character == *character_id) {
            continue;
        }
        reveal.delivery_event_id = Some(event_id.into());
        reveal.sequence = facts.pending_identity_reveals.iter().filter(|r| r.source_event_id == reveal.source_event_id).count() as u8;
        facts.pending_identity_reveals.push(reveal);
    }
}

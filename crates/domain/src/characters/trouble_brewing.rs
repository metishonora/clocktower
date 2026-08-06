pub(crate) mod step_key;

use crate::contracts::{
    ActiveRuleEffect, ButlerVoteState, GameEvent, GameEventKind, ImpAttackOutcome,
    ImpNoDeathReason, ImpPreventionReason, MayorAttackContext, NightActionResolution,
    SlayerRegistrationContext, SlayerTargetRegistration, VirginImpairmentContext, VirginResolution,
};
use crate::error::ErrorKind;
use crate::model::{
    Alignment, CharacterKind, InformationPlayer, InformationResult, InputTarget,
    MayorDecisionInput, MayorDecisionPrompt, NumberInformationChoice, Phase, PhaseStep, Player,
    RegistrationJudgment, RegistrationValue, RequiredInput, RequiredInputKind, SetupInfoKind,
    SetupInfoRegistrationOption, SpyReminderToken, StepInput, StepInputFields, StepType,
};
use std::collections::{BTreeMap, HashMap, HashSet};

#[derive(Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub(crate) enum TbCharacterId {
    Washerwoman,
    Librarian,
    Investigator,
    Chef,
    Empath,
    FortuneTeller,
    Undertaker,
    Monk,
    Ravenkeeper,
    Virgin,
    Slayer,
    Soldier,
    Mayor,
    Butler,
    Drunk,
    Recluse,
    Saint,
    Poisoner,
    Spy,
    ScarletWoman,
    Baron,
    Imp,
}

#[derive(Debug, Copy, Clone, PartialEq, Eq)]
pub(crate) enum TbActivityRequirement {
    Always,
    Alive,
    Triggered,
}

#[derive(Debug, Copy, Clone)]
struct TbCharacterMetadata {
    kind: CharacterKind,
    first_night_order: Option<u8>,
    night_order: Option<u8>,
    activity: TbActivityRequirement,
    automated: bool,
}

impl TbCharacterId {
    pub(crate) const ALL: [Self; 22] = [
        Self::Washerwoman,
        Self::Librarian,
        Self::Investigator,
        Self::Chef,
        Self::Empath,
        Self::FortuneTeller,
        Self::Undertaker,
        Self::Monk,
        Self::Ravenkeeper,
        Self::Virgin,
        Self::Slayer,
        Self::Soldier,
        Self::Mayor,
        Self::Butler,
        Self::Drunk,
        Self::Recluse,
        Self::Saint,
        Self::Poisoner,
        Self::Spy,
        Self::ScarletWoman,
        Self::Baron,
        Self::Imp,
    ];

    pub(crate) fn parse(value: &str) -> Option<Self> {
        Some(match value {
            "washerwoman" => Self::Washerwoman,
            "librarian" => Self::Librarian,
            "investigator" => Self::Investigator,
            "chef" => Self::Chef,
            "empath" => Self::Empath,
            "fortuneTeller" => Self::FortuneTeller,
            "undertaker" => Self::Undertaker,
            "monk" => Self::Monk,
            "ravenkeeper" => Self::Ravenkeeper,
            "virgin" => Self::Virgin,
            "slayer" => Self::Slayer,
            "soldier" => Self::Soldier,
            "mayor" => Self::Mayor,
            "butler" => Self::Butler,
            "drunk" => Self::Drunk,
            "recluse" => Self::Recluse,
            "saint" => Self::Saint,
            "poisoner" => Self::Poisoner,
            "spy" => Self::Spy,
            "scarletWoman" => Self::ScarletWoman,
            "baron" => Self::Baron,
            "imp" => Self::Imp,
            _ => return None,
        })
    }

    pub(crate) const fn as_str(self) -> &'static str {
        match self {
            Self::Washerwoman => "washerwoman",
            Self::Librarian => "librarian",
            Self::Investigator => "investigator",
            Self::Chef => "chef",
            Self::Empath => "empath",
            Self::FortuneTeller => "fortuneTeller",
            Self::Undertaker => "undertaker",
            Self::Monk => "monk",
            Self::Ravenkeeper => "ravenkeeper",
            Self::Virgin => "virgin",
            Self::Slayer => "slayer",
            Self::Soldier => "soldier",
            Self::Mayor => "mayor",
            Self::Butler => "butler",
            Self::Drunk => "drunk",
            Self::Recluse => "recluse",
            Self::Saint => "saint",
            Self::Poisoner => "poisoner",
            Self::Spy => "spy",
            Self::ScarletWoman => "scarletWoman",
            Self::Baron => "baron",
            Self::Imp => "imp",
        }
    }

    const fn metadata(self) -> TbCharacterMetadata {
        use TbActivityRequirement::{Alive, Always, Triggered};
        use TbCharacterId::*;
        let kind = match self {
            Washerwoman | Librarian | Investigator | Chef | Empath | FortuneTeller | Undertaker
            | Monk | Ravenkeeper | Virgin | Slayer | Soldier | Mayor => CharacterKind::Townsfolk,
            Butler | Drunk | Recluse | Saint => CharacterKind::Outsider,
            Poisoner | Spy | ScarletWoman | Baron => CharacterKind::Minion,
            Imp => CharacterKind::Demon,
        };
        let first_night_order = match self {
            Poisoner => Some(1),
            Washerwoman => Some(2),
            Librarian => Some(3),
            Investigator => Some(4),
            Chef => Some(5),
            Empath => Some(6),
            FortuneTeller => Some(7),
            Butler => Some(8),
            Spy => Some(9),
            _ => None,
        };
        let night_order = match self {
            Poisoner => Some(1),
            Monk => Some(2),
            Imp => Some(3),
            Ravenkeeper => Some(4),
            Empath => Some(5),
            FortuneTeller => Some(6),
            Undertaker => Some(7),
            Butler => Some(8),
            Spy => Some(9),
            _ => None,
        };
        let activity = match self {
            Baron | Drunk | Recluse | Saint | Soldier => Always,
            Ravenkeeper | Undertaker | Virgin | Slayer | ScarletWoman => Triggered,
            _ => Alive,
        };
        let automated = !matches!(self, Baron | Drunk | Recluse | Saint | Soldier);
        TbCharacterMetadata {
            kind,
            first_night_order,
            night_order,
            activity,
            automated,
        }
    }
}

pub(crate) fn demon_dead_without_successor(players: &[Player], succession_pending: bool) -> bool {
    !succession_pending
        && !players
            .iter()
            .any(|player| player.alive && player.actual_character == "imp")
}

pub(crate) fn mayor_win_eligible(
    players: &[Player],
    active_poison: Option<&ActiveRuleEffect>,
) -> bool {
    players.iter().filter(|player| player.alive).count() == 3
        && players.iter().any(|player| {
            player.alive
                && player.actual_character == "mayor"
                && active_poison.is_none_or(|poison| poison.player_id != player.id)
        })
}

pub(crate) fn character_can_target_self(character: &str) -> bool {
    !matches!(
        TbCharacterId::parse(character),
        Some(TbCharacterId::Monk | TbCharacterId::Butler)
    )
}

pub(crate) fn butler_vote_state(
    players: &[Player],
    events: &[GameEvent],
    active_poison: Option<&ActiveRuleEffect>,
) -> Option<ButlerVoteState> {
    let butler = players
        .iter()
        .rev()
        .find(|player| player.actual_character == "butler")?;
    let last_to_day = events.iter().rposition(|event| {
        matches!(
            &event.kind,
            GameEventKind::PhaseStepConfirmed { payload }
                if step_key::TbStepKey::parse(&payload.step_id, event.phase)
                    .is_ok_and(|key| key.semantic == step_key::TbSemanticStep::ToDay)
        )
    });
    let last_to_night = events.iter().rposition(|event| {
        matches!(
            &event.kind,
            GameEventKind::PhaseStepConfirmed { payload }
                if step_key::TbStepKey::parse(&payload.step_id, event.phase)
                    .is_ok_and(|key| key.semantic == step_key::TbSemanticStep::ToNight)
        )
    });
    let current_day_boundary =
        last_to_day.filter(|to_day| last_to_night.is_none_or(|to_night| to_day > &to_night));
    let master_player_id = current_day_boundary.and_then(|boundary| {
        let GameEventKind::PhaseStepConfirmed { payload: to_day } = &events[boundary].kind else {
            unreachable!()
        };
        let prefix = step_key::TbStepKey::parse(&to_day.step_id, events[boundary].phase)
            .ok()?
            .phase
            .prefix();
        let butler_step_id = format!("{prefix}:butler");
        events[..boundary]
            .iter()
            .rev()
            .find_map(|event| match &event.kind {
                GameEventKind::PhaseStepConfirmed { payload }
                    if payload.step_id == butler_step_id =>
                {
                    payload
                        .input
                        .as_ref()
                        .and_then(|input| input.player_ids.as_ref())
                        .and_then(|ids| ids.first())
                        .filter(|master_id| {
                            master_id.as_str() != butler.id
                                && players.iter().any(|player| player.id == **master_id)
                        })
                        .cloned()
                }
                _ => None,
            })
    });
    let restriction_applies =
        butler.alive && active_poison.is_none_or(|poison| poison.player_id != butler.id);

    Some(ButlerVoteState {
        butler_player_id: butler.id.clone(),
        master_player_id,
        restriction_applies,
    })
}

pub(crate) fn validate_butler_voters(
    state: Option<&ButlerVoteState>,
    voter_ids: &[String],
) -> Result<(), crate::error::CoreError> {
    let Some(state) = state.filter(|state| state.restriction_applies) else {
        return Ok(());
    };
    if !voter_ids.contains(&state.butler_player_id) {
        return Ok(());
    }
    if state
        .master_player_id
        .as_ref()
        .is_some_and(|master_id| voter_ids.contains(master_id))
    {
        return Ok(());
    }
    Err(ErrorKind::ButlerMasterVoteRequired.into_error())
}

pub(crate) fn virgin_resolution(
    players: &[Player],
    nominator_id: &str,
    nominee_id: &str,
    judgments: &[RegistrationJudgment],
    already_spent: bool,
    active_poison: Option<&ActiveRuleEffect>,
) -> Result<VirginResolution, crate::error::CoreError> {
    let nominator = players
        .iter()
        .find(|player| player.id == nominator_id)
        .ok_or_else(|| ErrorKind::InvalidStepInput.into_error())?;
    let nominee = players
        .iter()
        .find(|player| player.id == nominee_id)
        .ok_or_else(|| ErrorKind::InvalidStepInput.into_error())?;
    if nominee.actual_character != "virgin" || already_spent {
        if !judgments.is_empty() {
            return Err(ErrorKind::InvalidRegistrationJudgment.into_error());
        }
        return Ok(VirginResolution::NotApplicable);
    }

    let spy_registered_as_townsfolk = if nominator.actual_character == "spy" {
        match judgments {
            [] => false,
            [judgment]
                if judgment.player_id == nominator.id
                    && judgment.registered_as == RegistrationValue::Townsfolk
                    && judgment.character_id.is_none() =>
            {
                true
            }
            _ => return Err(ErrorKind::InvalidRegistrationJudgment.into_error()),
        }
    } else {
        if !judgments.is_empty() {
            return Err(ErrorKind::InvalidRegistrationJudgment.into_error());
        }
        false
    };
    let impairment_context = active_poison
        .filter(|poison| poison.player_id == nominee.id)
        .map(|poison| VirginImpairmentContext::Poisoned {
            source_player_id: poison.source_player_id.clone(),
            source_event_id: poison.source_event_id.clone(),
        })
        .unwrap_or(VirginImpairmentContext::Healthy);
    let nominator_is_townsfolk = character_kind(&nominator.actual_character)
        == Some(CharacterKind::Townsfolk)
        || spy_registered_as_townsfolk;
    if nominator_is_townsfolk && matches!(impairment_context, VirginImpairmentContext::Healthy) {
        Ok(VirginResolution::SpentAndNominatorExecuted {
            virgin_player_id: nominee.id.clone(),
            impairment_context,
        })
    } else {
        Ok(VirginResolution::SpentNoExecution {
            virgin_player_id: nominee.id.clone(),
            impairment_context,
        })
    }
}

pub(crate) fn mayor_decision_prompt(
    players: &[Player],
    actor_player_id: &str,
    active_poison: Option<&ActiveRuleEffect>,
    active_protection: Option<&ActiveRuleEffect>,
) -> Option<MayorDecisionPrompt> {
    let actor = players.iter().find(|player| player.id == actor_player_id)?;
    if !actor.alive
        || actor.actual_character != "imp"
        || is_poisoned(active_poison, actor_player_id)
    {
        return None;
    }
    let mayor = players.iter().find(|player| {
        player.alive
            && player.actual_character == "mayor"
            && active_poison.is_none_or(|poison| poison.player_id != player.id)
            && active_protection.is_none_or(|protection| protection.player_id != player.id)
    })?;
    Some(MayorDecisionPrompt {
        mayor_player_id: mayor.id.clone(),
        bounce_target_player_ids: players
            .iter()
            .filter(|player| player.id != mayor.id)
            .map(|player| player.id.clone())
            .collect(),
    })
}

pub(crate) fn scarlet_woman_successor<'a>(
    players: &'a [Player],
    active_poison: Option<&ActiveRuleEffect>,
) -> Option<&'a Player> {
    (players.iter().filter(|player| player.alive).count() >= 5)
        .then(|| {
            players.iter().find(|player| {
                player.alive
                    && player.actual_character == "scarletWoman"
                    && active_poison.is_none_or(|poison| poison.player_id != player.id)
            })
        })
        .flatten()
}

pub(crate) fn imp_self_kill_successor_ids(players: &[Player]) -> Vec<String> {
    players
        .iter()
        .filter(|player| {
            player.alive && character_kind(&player.actual_character) == Some(CharacterKind::Minion)
        })
        .map(|player| player.id.clone())
        .collect()
}

pub(crate) fn resolve_imp_attack(
    players: &[Player],
    actor_player_id: &str,
    target_player_id: &str,
    mayor_decision: Option<&MayorDecisionInput>,
    active_poison: Option<&ActiveRuleEffect>,
    active_protection: Option<&ActiveRuleEffect>,
) -> Result<NightActionResolution, crate::error::CoreError> {
    let actor = players
        .iter()
        .find(|player| player.id == actor_player_id)
        .ok_or_else(|| ErrorKind::InvalidStepInput.into_error())?;
    let target = players
        .iter()
        .find(|player| player.id == target_player_id)
        .ok_or_else(|| ErrorKind::InvalidStepInput.into_error())?;
    let not_applicable = MayorAttackContext::NotApplicable;
    if actor.actual_character != "imp" {
        reject_unnecessary_mayor_decision(mayor_decision)?;
        return Ok(imp_attack(
            target_player_id,
            not_applicable,
            ImpAttackOutcome::NoDeath {
                reason: ImpNoDeathReason::NotActualCharacter,
            },
        ));
    }
    if is_poisoned(active_poison, actor_player_id) {
        reject_unnecessary_mayor_decision(mayor_decision)?;
        return Ok(imp_attack(
            target_player_id,
            not_applicable,
            ImpAttackOutcome::NoDeath {
                reason: ImpNoDeathReason::ActorImpaired,
            },
        ));
    }
    if !target.alive {
        reject_unnecessary_mayor_decision(mayor_decision)?;
        return Ok(imp_attack(
            target_player_id,
            not_applicable,
            ImpAttackOutcome::NoDeath {
                reason: ImpNoDeathReason::AlreadyDead,
            },
        ));
    }
    if let Some(protection) = protection_for(active_protection, target_player_id) {
        reject_unnecessary_mayor_decision(mayor_decision)?;
        return Ok(imp_attack(
            target_player_id,
            not_applicable,
            ImpAttackOutcome::Prevented {
                reason: ImpPreventionReason::MonkProtection,
                source_event_id: protection.source_event_id.clone(),
            },
        ));
    }
    if target.actual_character == "soldier" && !is_poisoned(active_poison, target_player_id) {
        reject_unnecessary_mayor_decision(mayor_decision)?;
        return Ok(imp_attack(
            target_player_id,
            not_applicable,
            ImpAttackOutcome::SoldierProtected {
                player_id: target.id.clone(),
            },
        ));
    }
    if target.actual_character == "mayor" && !is_poisoned(active_poison, target_player_id) {
        let decision =
            mayor_decision.ok_or_else(|| ErrorKind::MissingMayorDecision.into_error())?;
        return match decision {
            MayorDecisionInput::MayorDies => Ok(imp_attack(
                target_player_id,
                MayorAttackContext::MayorDies {
                    mayor_player_id: target.id.clone(),
                },
                ImpAttackOutcome::Death {
                    player_id: target.id.clone(),
                },
            )),
            MayorDecisionInput::Bounce {
                target_player_id: bounce_target_player_id,
            } => {
                let bounce_target = players
                    .iter()
                    .find(|player| player.id == *bounce_target_player_id)
                    .filter(|player| player.id != target.id)
                    .ok_or_else(|| ErrorKind::InvalidMayorDecision.into_error())?;
                let context = MayorAttackContext::Bounced {
                    mayor_player_id: target.id.clone(),
                    bounce_target_player_id: bounce_target.id.clone(),
                };
                let outcome = if !bounce_target.alive {
                    ImpAttackOutcome::NoDeath {
                        reason: ImpNoDeathReason::AlreadyDead,
                    }
                } else if let Some(protection) =
                    protection_for(active_protection, &bounce_target.id)
                {
                    ImpAttackOutcome::Prevented {
                        reason: ImpPreventionReason::MonkProtection,
                        source_event_id: protection.source_event_id.clone(),
                    }
                } else if bounce_target.actual_character == "soldier"
                    && !is_poisoned(active_poison, &bounce_target.id)
                {
                    ImpAttackOutcome::SoldierProtected {
                        player_id: bounce_target.id.clone(),
                    }
                } else {
                    ImpAttackOutcome::Death {
                        player_id: bounce_target.id.clone(),
                    }
                };
                Ok(imp_attack(target_player_id, context, outcome))
            }
        };
    }
    reject_unnecessary_mayor_decision(mayor_decision)?;
    Ok(imp_attack(
        target_player_id,
        not_applicable,
        ImpAttackOutcome::Death {
            player_id: target.id.clone(),
        },
    ))
}

fn imp_attack(
    target_player_id: &str,
    mayor_context: MayorAttackContext,
    outcome: ImpAttackOutcome,
) -> NightActionResolution {
    NightActionResolution::ImpAttack {
        target_player_id: target_player_id.into(),
        mayor_context,
        outcome,
    }
}

fn reject_unnecessary_mayor_decision(
    decision: Option<&MayorDecisionInput>,
) -> Result<(), crate::error::CoreError> {
    if decision.is_some() {
        Err(ErrorKind::InvalidMayorDecision.into_error())
    } else {
        Ok(())
    }
}

fn is_poisoned(active_poison: Option<&ActiveRuleEffect>, player_id: &str) -> bool {
    active_poison.is_some_and(|poison| poison.player_id == player_id)
}

fn protection_for<'a>(
    active_protection: Option<&'a ActiveRuleEffect>,
    player_id: &str,
) -> Option<&'a ActiveRuleEffect> {
    active_protection.filter(|protection| protection.player_id == player_id)
}

pub(crate) fn slayer_registration(
    target: &Player,
    choice: &SlayerTargetRegistration,
) -> Result<SlayerRegistrationContext, crate::error::CoreError> {
    match (target.actual_character.as_str(), choice) {
        ("recluse", SlayerTargetRegistration::Canonical) => {
            Ok(SlayerRegistrationContext::RecluseDecision {
                registered_as_demon: false,
                registered_character_id: None,
            })
        }
        (
            "recluse",
            SlayerTargetRegistration::RecluseAsDemon {
                registered_character_id,
            },
        ) if registered_character_id == "imp" => Ok(SlayerRegistrationContext::RecluseDecision {
            registered_as_demon: true,
            registered_character_id: Some("imp".into()),
        }),
        ("recluse", _) | (_, SlayerTargetRegistration::RecluseAsDemon { .. }) => {
            Err(ErrorKind::InvalidSlayerRegistration.into_error())
        }
        ("imp", SlayerTargetRegistration::Canonical) => Ok(SlayerRegistrationContext::Canonical {
            registered_as_demon: true,
        }),
        (_, SlayerTargetRegistration::Canonical) => Ok(SlayerRegistrationContext::Canonical {
            registered_as_demon: false,
        }),
    }
}

const TOWNSFOLK: &[&str] = &[
    "washerwoman",
    "librarian",
    "investigator",
    "chef",
    "empath",
    "fortuneTeller",
    "undertaker",
    "monk",
    "ravenkeeper",
    "virgin",
    "slayer",
    "soldier",
    "mayor",
];

const OUTSIDERS: &[&str] = &["butler", "drunk", "recluse", "saint"];

const MINIONS: &[&str] = &["poisoner", "spy", "scarletWoman", "baron"];

const DEMONS: &[&str] = &["imp"];

pub(crate) fn first_night_order() -> Vec<&'static str> {
    let mut ids = TbCharacterId::ALL
        .into_iter()
        .filter_map(|id| {
            id.metadata()
                .first_night_order
                .map(|order| (order, id.as_str()))
        })
        .collect::<Vec<_>>();
    ids.sort_by_key(|(order, _)| *order);
    ids.into_iter().map(|(_, id)| id).collect()
}

pub(crate) fn night_order() -> Vec<&'static str> {
    let mut ids = TbCharacterId::ALL
        .into_iter()
        .filter_map(|id| id.metadata().night_order.map(|order| (order, id.as_str())))
        .collect::<Vec<_>>();
    ids.sort_by_key(|(order, _)| *order);
    ids.into_iter().map(|(_, id)| id).collect()
}

pub(crate) fn has_actual_outsider(players: &[Player]) -> bool {
    players
        .iter()
        .any(|player| character_kind(&player.actual_character) == Some(CharacterKind::Outsider))
}

pub(crate) fn legal_demon_bluff_character_ids(players: &[Player]) -> Vec<String> {
    let assigned_actual_characters = players
        .iter()
        .map(|player| player.actual_character.as_str())
        .collect::<HashSet<_>>();

    TOWNSFOLK
        .iter()
        .chain(OUTSIDERS)
        .copied()
        .filter(|character_id| !assigned_actual_characters.contains(character_id))
        .map(str::to_string)
        .collect()
}

pub(crate) fn phase_input_suggestion_pool(
    step: &PhaseStep,
    players: &[Player],
    impaired: bool,
) -> Vec<StepInput> {
    if step_key::TbStepKey::parse(&step.id, step.phase)
        .is_ok_and(|key| key.semantic == step_key::TbSemanticStep::DemonInfo)
        && step.required_input.kind == RequiredInputKind::CharacterIds
    {
        let legal = legal_demon_bluff_character_ids(players);
        let mut suggestions = Vec::new();
        for first in 0..legal.len() {
            for second in (first + 1)..legal.len() {
                for third in (second + 1)..legal.len() {
                    suggestions.push(Some(StepInputFields {
                        character_ids: Some(vec![
                            legal[first].clone(),
                            legal[second].clone(),
                            legal[third].clone(),
                        ]),
                        ..StepInputFields::default()
                    }));
                }
            }
        }
        return suggestions;
    }

    let Some(setup_info) = step.required_input.setup_info else {
        return Vec::new();
    };
    let character_ids = match setup_info_kind(setup_info) {
        CharacterKind::Townsfolk => TOWNSFOLK,
        CharacterKind::Outsider => OUTSIDERS,
        CharacterKind::Minion => MINIONS,
        CharacterKind::Demon => DEMONS,
    };
    let mut suggestions = Vec::new();
    if setup_info == SetupInfoKind::Librarian && (impaired || !has_actual_outsider(players)) {
        suggestions.push(Some(StepInputFields {
            zero_outsiders: Some(true),
            ..StepInputFields::default()
        }));
        if !impaired {
            return suggestions;
        }
    }

    for character_id in character_ids {
        for first in 0..players.len() {
            for second in (first + 1)..players.len() {
                if players[first].id == players[second].id {
                    continue;
                }
                if impaired
                    || players[first].actual_character == *character_id
                    || players[second].actual_character == *character_id
                {
                    suggestions.push(Some(StepInputFields {
                        player_ids: Some(vec![
                            players[first].id.clone(),
                            players[second].id.clone(),
                        ]),
                        character_id: Some((*character_id).to_string()),
                        ..StepInputFields::default()
                    }));
                }
            }
        }
    }
    suggestions
}

pub(crate) fn setup_info_character_is_represented(
    setup_info: SetupInfoKind,
    character_id: &str,
    candidate_player_ids: &[String],
    players: &[Player],
) -> bool {
    let required_kind = match setup_info {
        SetupInfoKind::Washerwoman => CharacterKind::Townsfolk,
        SetupInfoKind::Librarian => CharacterKind::Outsider,
        SetupInfoKind::Investigator => CharacterKind::Minion,
    };
    if character_kind(character_id) != Some(required_kind) {
        return false;
    }

    players.iter().any(|player| {
        player.actual_character == character_id && candidate_player_ids.contains(&player.id)
    })
}

pub(crate) fn setup_info_registration_options(
    step: &PhaseStep,
    players: &[Player],
) -> Vec<SetupInfoRegistrationOption> {
    let Some(setup_info) = step.required_input.setup_info else {
        return Vec::new();
    };
    let (actual_character, registered_as, character_ids) = match setup_info {
        SetupInfoKind::Washerwoman => ("spy", RegistrationValue::Townsfolk, TOWNSFOLK),
        SetupInfoKind::Librarian => ("spy", RegistrationValue::Outsider, OUTSIDERS),
        SetupInfoKind::Investigator => ("recluse", RegistrationValue::Minion, MINIONS),
    };

    players
        .iter()
        .filter(|player| player.actual_character == actual_character)
        .map(|player| SetupInfoRegistrationOption {
            player_id: player.id.clone(),
            registered_as,
            character_ids: character_ids
                .iter()
                .map(|character_id| (*character_id).to_string())
                .collect(),
        })
        .collect()
}

pub(crate) fn setup_info_input_is_valid_normal(
    setup_info: SetupInfoKind,
    input: &StepInput,
    players: &[Player],
) -> bool {
    let Some(value) = input.as_ref() else {
        return false;
    };
    if value.zero_outsiders == Some(true) {
        return setup_info == SetupInfoKind::Librarian
            && value.player_ids.as_ref().is_none_or(Vec::is_empty)
            && value.character_id.is_none()
            && !has_actual_outsider(players);
    }
    let Some(player_ids) = structurally_valid_setup_player_ids(value, players) else {
        return false;
    };
    let Some(character_id) = value.character_id.as_deref() else {
        return false;
    };
    setup_info_character_is_represented(setup_info, character_id, &player_ids, players)
}

pub(crate) fn setup_info_input_is_valid_impaired(
    setup_info: SetupInfoKind,
    input: &StepInput,
    players: &[Player],
) -> bool {
    let Some(value) = input.as_ref() else {
        return false;
    };
    if value.zero_outsiders == Some(true) {
        return setup_info == SetupInfoKind::Librarian
            && value.player_ids.as_ref().is_none_or(Vec::is_empty)
            && value.character_id.is_none();
    }
    if structurally_valid_setup_player_ids(value, players).is_none() {
        return false;
    }
    value.character_id.as_deref().is_some_and(|character_id| {
        character_kind(character_id) == Some(setup_info_kind(setup_info))
    })
}

pub(crate) fn setup_info_input_is_valid_registration(
    step: &PhaseStep,
    input: &StepInput,
    players: &[Player],
    judgments: &[RegistrationJudgment],
) -> bool {
    let Some(value) = input.as_ref() else {
        return false;
    };
    if value.zero_outsiders == Some(true) || judgments.len() != 1 {
        return false;
    }
    let Some(player_ids) = structurally_valid_setup_player_ids(value, players) else {
        return false;
    };
    let Some(character_id) = value.character_id.as_deref() else {
        return false;
    };
    let judgment = &judgments[0];
    player_ids.contains(&judgment.player_id)
        && judgment.character_id.as_deref() == Some(character_id)
        && setup_info_registration_options(step, players)
            .iter()
            .any(|option| {
                option.player_id == judgment.player_id
                    && option.registered_as == judgment.registered_as
                    && option.character_ids.iter().any(|id| id == character_id)
            })
}

fn structurally_valid_setup_player_ids(
    value: &crate::model::StepInputFields,
    players: &[Player],
) -> Option<Vec<String>> {
    let player_ids = value.player_ids.as_ref()?;
    let roster_ids = players
        .iter()
        .map(|player| player.id.as_str())
        .collect::<HashSet<_>>();
    let unique = player_ids
        .iter()
        .map(String::as_str)
        .collect::<HashSet<_>>();
    (player_ids.len() == 2
        && unique.len() == 2
        && player_ids.iter().all(|id| roster_ids.contains(id.as_str())))
    .then(|| player_ids.clone())
}

fn setup_info_kind(setup_info: SetupInfoKind) -> CharacterKind {
    match setup_info {
        SetupInfoKind::Washerwoman => CharacterKind::Townsfolk,
        SetupInfoKind::Librarian => CharacterKind::Outsider,
        SetupInfoKind::Investigator => CharacterKind::Minion,
    }
}

fn awakening_character(player: &Player) -> &str {
    if player.actual_character == "drunk" {
        player.shown_character.as_str()
    } else {
        player.actual_character.as_str()
    }
}

pub(crate) fn evil_neighbor_pair_count(players: &[Player]) -> usize {
    let seated = seated_players(players);
    if seated.len() < 2 {
        return 0;
    }

    seated
        .iter()
        .enumerate()
        .filter(|(index, player)| {
            player.alignment == Alignment::Evil
                && seated[(index + 1) % seated.len()].alignment == Alignment::Evil
        })
        .count()
}

pub(crate) fn empath_evil_neighbor_count(players: &[Player], player_id: &str) -> Option<usize> {
    let seated = seated_players(players);
    let index = seated.iter().position(|player| player.id == player_id)?;
    let neighbor_indexes = alive_neighbor_indexes(&seated, index);

    Some(
        neighbor_indexes
            .iter()
            .filter(|neighbor_index| seated[**neighbor_index].alignment == Alignment::Evil)
            .count(),
    )
}

pub(crate) fn computed_information_result(
    step: &PhaseStep,
    players: &[Player],
    input: &StepInput,
) -> Option<InformationResult> {
    if step.step_type == StepType::EvilInfo {
        let demon_player_ids = players
            .iter()
            .filter(|player| character_kind(&player.actual_character) == Some(CharacterKind::Demon))
            .map(|player| player.id.clone())
            .collect();
        let minion_player_ids = players
            .iter()
            .filter(|player| {
                character_kind(&player.actual_character) == Some(CharacterKind::Minion)
            })
            .map(|player| player.id.clone())
            .collect();
        let bluff_character_ids = if step_key::TbStepKey::parse(&step.id, step.phase)
            .is_ok_and(|key| key.semantic == step_key::TbSemanticStep::DemonInfo)
        {
            input
                .as_ref()
                .and_then(|value| value.character_ids.clone())
                .unwrap_or_default()
        } else {
            Vec::new()
        };
        return Some(InformationResult::TeamInfo {
            demon_player_ids,
            minion_player_ids,
            bluff_character_ids,
        });
    }

    match step.character.as_deref()? {
        "washerwoman" | "librarian" | "investigator" => {
            let input = input.as_ref()?;
            Some(InformationResult::SetupInfo {
                player_ids: input.player_ids.clone().unwrap_or_default(),
                character_id: input.character_id.clone(),
                zero_outsiders: input.zero_outsiders == Some(true),
            })
        }
        "chef" => Some(InformationResult::Number {
            value: evil_neighbor_pair_count(players) as u64,
        }),
        "empath" => Some(InformationResult::Number {
            value: empath_evil_neighbor_count(players, step.player_id.as_deref()?)? as u64,
        }),
        "spy" => Some(spy_grimoire_result(players, &[], &[])),
        _ => None,
    }
}

pub(crate) fn spy_grimoire_result(
    players: &[Player],
    poisoned_player_ids: &[String],
    protected_player_ids: &[String],
) -> InformationResult {
    InformationResult::SpyGrimoire {
        players: seated_players(players)
            .into_iter()
            .map(|player| {
                let mut reminder_tokens = Vec::new();
                if poisoned_player_ids.contains(&player.id) {
                    reminder_tokens.push(SpyReminderToken::Poisoned);
                }
                if protected_player_ids.contains(&player.id) {
                    reminder_tokens.push(SpyReminderToken::Protected);
                }
                InformationPlayer {
                    player_id: player.id.clone(),
                    seat: player.seat,
                    name: player.name.clone(),
                    character_id: player.actual_character.clone(),
                    alive: Some(player.alive),
                    ghost_vote_used: Some(player.ghost_vote_used),
                    reminder_tokens: Some(reminder_tokens),
                }
            })
            .collect(),
    }
}

pub(crate) fn registration_candidate_player_ids(
    step: &PhaseStep,
    players: &[Player],
) -> Vec<String> {
    let eligible_ids = match step.character.as_deref() {
        Some("empath") => {
            let Some(actor_id) = step.player_id.as_deref() else {
                return Vec::new();
            };
            let seated = seated_players(players);
            let Some(index) = seated.iter().position(|player| player.id == actor_id) else {
                return Vec::new();
            };
            alive_neighbor_indexes(&seated, index)
                .into_iter()
                .map(|index| seated[index].id.as_str())
                .collect::<HashSet<_>>()
        }
        Some("chef") => players.iter().map(|player| player.id.as_str()).collect(),
        _ => return Vec::new(),
    };

    players
        .iter()
        .filter(|player| {
            eligible_ids.contains(player.id.as_str())
                && matches!(player.actual_character.as_str(), "spy" | "recluse")
        })
        .map(|player| player.id.clone())
        .collect()
}

pub(crate) fn number_result_with_registration_judgments(
    step: &PhaseStep,
    players: &[Player],
    judgments: &[RegistrationJudgment],
) -> Option<usize> {
    let registered_alignment = |player: &Player| {
        judgments
            .iter()
            .find(|judgment| judgment.player_id == player.id)
            .and_then(|judgment| match judgment.registered_as {
                RegistrationValue::Good => Some(Alignment::Good),
                RegistrationValue::Evil => Some(Alignment::Evil),
                _ => None,
            })
            .unwrap_or(player.alignment)
    };

    match step.character.as_deref()? {
        "chef" => {
            let seated = seated_players(players);
            if seated.len() < 2 {
                return Some(0);
            }
            Some(
                seated
                    .iter()
                    .enumerate()
                    .filter(|(index, player)| {
                        registered_alignment(player) == Alignment::Evil
                            && registered_alignment(seated[(index + 1) % seated.len()])
                                == Alignment::Evil
                    })
                    .count(),
            )
        }
        "empath" => {
            let seated = seated_players(players);
            let actor_id = step.player_id.as_deref()?;
            let index = seated.iter().position(|player| player.id == actor_id)?;
            Some(
                alive_neighbor_indexes(&seated, index)
                    .iter()
                    .filter(|neighbor_index| {
                        registered_alignment(seated[**neighbor_index]) == Alignment::Evil
                    })
                    .count(),
            )
        }
        _ => None,
    }
}

pub(crate) fn legal_number_choices(
    step: &PhaseStep,
    players: &[Player],
    impaired: bool,
) -> Vec<NumberInformationChoice> {
    let Some(InformationResult::Number { value: computed }) =
        computed_information_result(step, players, &None)
    else {
        return Vec::new();
    };

    if impaired {
        let max = match step.character.as_deref() {
            Some("chef") => players.len(),
            Some("empath") => {
                let Some(actor_id) = step.player_id.as_deref() else {
                    return Vec::new();
                };
                let seated = seated_players(players);
                let Some(index) = seated.iter().position(|player| player.id == actor_id) else {
                    return Vec::new();
                };
                alive_neighbor_indexes(&seated, index).len()
            }
            _ => return Vec::new(),
        };
        return (0..=max)
            .map(|value| NumberInformationChoice {
                value: value as u64,
                is_computed: value as u64 == computed,
                registration_judgments: Vec::new(),
            })
            .collect();
    }

    let candidates = registration_candidate_player_ids(step, players);
    let mut by_value = BTreeMap::<u64, Vec<RegistrationJudgment>>::new();
    by_value.insert(computed, Vec::new());
    for mask in 0..(1usize << candidates.len()) {
        let judgments = candidates
            .iter()
            .enumerate()
            .map(|(index, player_id)| RegistrationJudgment {
                player_id: player_id.clone(),
                registered_as: if mask & (1 << index) == 0 {
                    RegistrationValue::Good
                } else {
                    RegistrationValue::Evil
                },
                character_id: None,
            })
            .collect::<Vec<_>>();
        let Some(value) = number_result_with_registration_judgments(step, players, &judgments)
        else {
            continue;
        };
        if value as u64 != computed {
            by_value.entry(value as u64).or_insert(judgments);
        }
    }

    by_value
        .into_iter()
        .map(|(value, registration_judgments)| NumberInformationChoice {
            value,
            is_computed: value == computed,
            registration_judgments,
        })
        .collect()
}

pub(crate) fn alive_neighbor_indexes(players: &[&Player], index: usize) -> Vec<usize> {
    if players.len() < 2 {
        return Vec::new();
    }

    let mut indexes = Vec::new();
    for distance in 1..players.len() {
        let left = (index + players.len() - distance) % players.len();
        if players[left].alive {
            indexes.push(left);
            break;
        }
    }
    for distance in 1..players.len() {
        let right = (index + distance) % players.len();
        if players[right].alive && !indexes.contains(&right) {
            indexes.push(right);
            break;
        }
    }
    indexes
}

pub(crate) fn seated_players(players: &[Player]) -> Vec<&Player> {
    let mut seated = players.iter().collect::<Vec<_>>();
    seated.sort_by_key(|player| player.seat);
    seated
}

pub(crate) fn character_steps(
    phase: Phase,
    id_prefix: &str,
    players: &[Player],
    order: &[&str],
) -> Vec<PhaseStep> {
    let waking_characters = players
        .iter()
        .fold(HashMap::new(), |mut waking_characters, player| {
            let character = awakening_character(player);
            let replace = waking_characters
                .get(character)
                .is_none_or(|current: &&Player| player.alive || !current.alive);
            if replace {
                waking_characters.insert(character, player);
            }
            waking_characters
        });
    let mut emitted = HashSet::new();

    order
        .iter()
        .filter_map(|character| {
            if !waking_characters.contains_key(character) || !emitted.insert(*character) {
                return None;
            }

            let metadata = TbCharacterId::parse(character)?.metadata();
            let actor = waking_characters.get(character)?;
            Some(PhaseStep {
                id: format!("{id_prefix}:{character}"),
                phase,
                step_type: StepType::Character,
                character: Some((*character).to_string()),
                player_id: Some(actor.id.clone()),
                ability_use: None,
                ability_origin: None,
                required_input: character_required_input(character),
                can_skip: metadata.activity != TbActivityRequirement::Always,
                support: if metadata.automated {
                    crate::model::PhaseStepSupport::Automated
                } else {
                    crate::model::PhaseStepSupport::Manual
                },
                information_prompt: None,
                pre_action_reveal: None,
            })
        })
        .collect()
}

pub(crate) fn target_information_checks(
    step: &PhaseStep,
    players: &[Player],
    events: &[crate::contracts::GameEvent],
) -> Vec<crate::model::TargetInformationCheck> {
    if step.step_type != StepType::Character {
        return Vec::new();
    }
    use crate::model::{TargetInformationCheck, TargetInformationChoice};
    let last_to_night = events.iter().rposition(|event| {
        matches!(&event.kind,
        crate::contracts::GameEventKind::PhaseStepConfirmed { payload }
            if step_key::TbStepKey::parse(&payload.step_id, event.phase)
                .is_ok_and(|key| key.semantic == step_key::TbSemanticStep::ToNight))
    });
    let impaired = step.player_id.as_ref().is_some_and(|actor| {
        players.iter().any(|p| p.id == *actor && p.actual_character == "drunk")
            || events.iter().enumerate().rev().any(|(index, e)| matches!(&e.kind, crate::contracts::GameEventKind::NightActionResolved { payload }
                if matches!(&payload.resolution, crate::contracts::NightActionResolution::Poison { target_player_id, applied: true, .. } if target_player_id == actor)
                && last_to_night.is_none_or(|boundary| index > boundary)
                && players.iter().any(|p| p.id == payload.actor_player_id && p.alive && p.actual_character == "poisoner")))
    });
    let fixed = |target_player_ids: Vec<String>, computed_result: InformationResult| {
        TargetInformationCheck {
            target_player_ids,
            choices: vec![TargetInformationChoice {
                result: computed_result.clone(),
                is_computed: true,
                registration_judgments: vec![],
            }],
            computed_result,
        }
    };
    match step.character.as_deref() {
        Some("fortuneTeller") => {
            let red = events.iter().find_map(|e| match &e.kind {
                crate::contracts::GameEventKind::RedHerringAssigned { payload } => {
                    Some(payload.player_id.as_str())
                }
                _ => None,
            });
            let demon_player_ids = players
                .iter()
                .filter(|p| p.actual_character == "imp")
                .map(|p| p.id.as_str())
                .collect::<HashSet<_>>();
            let mut result = vec![];
            for i in 0..players.len() {
                for j in i + 1..players.len() {
                    let ids = vec![players[i].id.clone(), players[j].id.clone()];
                    let yes = ids.iter().any(|id| {
                        demon_player_ids.contains(id.as_str()) || Some(id.as_str()) == red
                    });
                    let mut check = fixed(ids.clone(), InformationResult::Boolean { value: yes });
                    if impaired {
                        check.choices = [false, true]
                            .into_iter()
                            .map(|value| TargetInformationChoice {
                                result: InformationResult::Boolean { value },
                                is_computed: value == yes,
                                registration_judgments: vec![],
                            })
                            .collect();
                    } else if !yes {
                        for p in players
                            .iter()
                            .filter(|p| p.actual_character == "recluse" && ids.contains(&p.id))
                        {
                            check.choices.push(TargetInformationChoice {
                                result: InformationResult::Boolean { value: true },
                                is_computed: false,
                                registration_judgments: vec![RegistrationJudgment {
                                    player_id: p.id.clone(),
                                    registered_as: RegistrationValue::Demon,
                                    character_id: None,
                                }],
                            });
                        }
                    }
                    result.push(check);
                }
            }
            result
        }
        Some("ravenkeeper") => players
            .iter()
            .map(|p| {
                let mut check = fixed(
                    vec![p.id.clone()],
                    InformationResult::Character {
                        character_id: p.actual_character.clone(),
                    },
                );
                if impaired {
                    check.choices = TOWNSFOLK
                        .iter()
                        .chain(OUTSIDERS)
                        .chain(MINIONS)
                        .chain(DEMONS)
                        .map(|id| TargetInformationChoice {
                            result: InformationResult::Character {
                                character_id: (*id).into(),
                            },
                            is_computed: *id == p.actual_character,
                            registration_judgments: vec![],
                        })
                        .collect();
                } else if p.actual_character == "spy" {
                    check
                        .choices
                        .extend(TOWNSFOLK.iter().map(|id| TargetInformationChoice {
                            result: InformationResult::Character {
                                character_id: (*id).into(),
                            },
                            is_computed: false,
                            registration_judgments: vec![RegistrationJudgment {
                                player_id: p.id.clone(),
                                registered_as: RegistrationValue::Townsfolk,
                                character_id: Some((*id).into()),
                            }],
                        }));
                } else if p.actual_character == "recluse" {
                    check
                        .choices
                        .extend(MINIONS.iter().map(|id| TargetInformationChoice {
                            result: InformationResult::Character {
                                character_id: (*id).into(),
                            },
                            is_computed: false,
                            registration_judgments: vec![RegistrationJudgment {
                                player_id: p.id.clone(),
                                registered_as: RegistrationValue::Minion,
                                character_id: Some((*id).into()),
                            }],
                        }));
                    check
                        .choices
                        .extend(DEMONS.iter().map(|id| TargetInformationChoice {
                            result: InformationResult::Character {
                                character_id: (*id).into(),
                            },
                            is_computed: false,
                            registration_judgments: vec![RegistrationJudgment {
                                player_id: p.id.clone(),
                                registered_as: RegistrationValue::Demon,
                                character_id: Some((*id).into()),
                            }],
                        }));
                }
                check
            })
            .collect(),
        Some("undertaker") => {
            let cycle = step_key::TbStepKey::parse(&step.id, step.phase)
                .map(|key| key.phase.cycle())
                .unwrap_or(1);
            crate::night::previous_executed_death(events, cycle)
                .and_then(|id| {
                    players.iter().find(|p| p.id == id).map(|p| {
                        let mut check = fixed(
                            vec![id],
                            InformationResult::Character {
                                character_id: p.actual_character.clone(),
                            },
                        );
                        if impaired {
                            check.choices = TOWNSFOLK
                                .iter()
                                .chain(OUTSIDERS)
                                .chain(MINIONS)
                                .chain(DEMONS)
                                .map(|id| TargetInformationChoice {
                                    result: InformationResult::Character {
                                        character_id: (*id).into(),
                                    },
                                    is_computed: *id == p.actual_character,
                                    registration_judgments: vec![],
                                })
                                .collect();
                        } else if p.actual_character == "spy" {
                            check.choices.extend(TOWNSFOLK.iter().map(|character_id| {
                                TargetInformationChoice {
                                    result: InformationResult::Character {
                                        character_id: (*character_id).into(),
                                    },
                                    is_computed: false,
                                    registration_judgments: vec![RegistrationJudgment {
                                        player_id: p.id.clone(),
                                        registered_as: RegistrationValue::Townsfolk,
                                        character_id: Some((*character_id).into()),
                                    }],
                                }
                            }));
                        } else if p.actual_character == "recluse" {
                            check.choices.extend(MINIONS.iter().map(|character_id| {
                                TargetInformationChoice {
                                    result: InformationResult::Character {
                                        character_id: (*character_id).into(),
                                    },
                                    is_computed: false,
                                    registration_judgments: vec![RegistrationJudgment {
                                        player_id: p.id.clone(),
                                        registered_as: RegistrationValue::Minion,
                                        character_id: Some((*character_id).into()),
                                    }],
                                }
                            }));
                            check.choices.extend(DEMONS.iter().map(|character_id| {
                                TargetInformationChoice {
                                    result: InformationResult::Character {
                                        character_id: (*character_id).into(),
                                    },
                                    is_computed: false,
                                    registration_judgments: vec![RegistrationJudgment {
                                        player_id: p.id.clone(),
                                        registered_as: RegistrationValue::Demon,
                                        character_id: Some((*character_id).into()),
                                    }],
                                }
                            }));
                        }
                        check
                    })
                })
                .into_iter()
                .collect()
        }
        _ => vec![],
    }
}

pub(crate) fn character_required_input(character: &str) -> RequiredInput {
    let Some(character) = TbCharacterId::parse(character) else {
        return required_none();
    };
    match character {
        TbCharacterId::Poisoner
        | TbCharacterId::Monk
        | TbCharacterId::Imp
        | TbCharacterId::Ravenkeeper
        | TbCharacterId::Butler => required_players(1, 1),
        TbCharacterId::Washerwoman => required_setup_info(
            SetupInfoKind::Washerwoman,
            CharacterKind::Townsfolk,
            2,
            2,
            false,
        ),
        TbCharacterId::Librarian => required_setup_info(
            SetupInfoKind::Librarian,
            CharacterKind::Outsider,
            0,
            2,
            true,
        ),
        TbCharacterId::Investigator => required_setup_info(
            SetupInfoKind::Investigator,
            CharacterKind::Minion,
            2,
            2,
            false,
        ),
        TbCharacterId::FortuneTeller => required_players(2, 2),
        TbCharacterId::Chef | TbCharacterId::Empath => RequiredInput {
            kind: RequiredInputKind::Number,
            target: Some(InputTarget::Number),
            min_selections: Some(0),
            max_selections: None,
            setup_info: None,
            character_kind: None,
            allowed_character_ids: None,
            allowed_player_ids: None,
            dependent_player_selections: vec![],
            player_registration_options: None,
            zero_allowed: false,
            supports_random_suggestion: false,
            player_id: None,
            survival_allowed: None,
            execution_survival_allowed: false,
            mayor_decision: None,
            demon_succession: None,
            optional: true,
        },
        TbCharacterId::Undertaker
        | TbCharacterId::Virgin
        | TbCharacterId::Slayer
        | TbCharacterId::Soldier
        | TbCharacterId::Mayor
        | TbCharacterId::Drunk
        | TbCharacterId::Recluse
        | TbCharacterId::Saint
        | TbCharacterId::Spy
        | TbCharacterId::ScarletWoman
        | TbCharacterId::Baron => required_none(),
    }
}

pub(crate) fn character_kind(character: &str) -> Option<CharacterKind> {
    TbCharacterId::parse(character).map(|id| id.metadata().kind)
}

pub(crate) fn is_townsfolk(character: &str) -> bool {
    matches!(character_kind(character), Some(CharacterKind::Townsfolk))
}

pub(crate) fn is_valid_script_token(character_id: &str, token_id: &str) -> bool {
    matches!(
        (character_id, token_id),
        ("butler", "master")
            | ("drunk", "isTheDrunk")
            | ("fortuneTeller", "redHerring")
            | ("imp", "dead")
            | ("investigator", "minion")
            | ("investigator", "wrong")
            | ("librarian", "outsider")
            | ("librarian", "wrong")
            | ("monk", "safe")
            | ("poisoner", "poisoned")
            | ("scarletWoman", "isTheDemon")
            | ("slayer", "noAbility")
            | ("undertaker", "diedToday")
            | ("virgin", "noAbility")
            | ("washerwoman", "townsfolk")
            | ("washerwoman", "wrong")
    )
}

fn required_none() -> RequiredInput {
    RequiredInput {
        kind: RequiredInputKind::None,
        target: None,
        min_selections: None,
        max_selections: None,
        setup_info: None,
        character_kind: None,
        allowed_character_ids: None,
        allowed_player_ids: None,
        dependent_player_selections: vec![],
        player_registration_options: None,
        zero_allowed: false,
        supports_random_suggestion: false,
        player_id: None,
        survival_allowed: None,
        execution_survival_allowed: false,
        mayor_decision: None,
        demon_succession: None,
        optional: false,
    }
}

fn required_players(min: u8, max: u8) -> RequiredInput {
    RequiredInput {
        kind: RequiredInputKind::PlayerIds,
        target: Some(if max == 1 {
            InputTarget::Player
        } else {
            InputTarget::Players
        }),
        min_selections: Some(min),
        max_selections: Some(max),
        setup_info: None,
        character_kind: None,
        allowed_character_ids: None,
        allowed_player_ids: None,
        dependent_player_selections: vec![],
        player_registration_options: None,
        zero_allowed: false,
        supports_random_suggestion: false,
        player_id: None,
        survival_allowed: None,
        execution_survival_allowed: false,
        mayor_decision: None,
        demon_succession: None,
        optional: min == 0,
    }
}

fn required_setup_info(
    kind: SetupInfoKind,
    character_kind: CharacterKind,
    min: u8,
    max: u8,
    zero_allowed: bool,
) -> RequiredInput {
    RequiredInput {
        kind: RequiredInputKind::SetupInfo,
        target: Some(InputTarget::Players),
        min_selections: Some(min),
        max_selections: Some(max),
        setup_info: Some(kind),
        character_kind: Some(character_kind),
        allowed_character_ids: None,
        allowed_player_ids: None,
        dependent_player_selections: vec![],
        player_registration_options: None,
        zero_allowed,
        supports_random_suggestion: true,
        player_id: None,
        survival_allowed: None,
        execution_survival_allowed: false,
        mayor_decision: None,
        demon_succession: None,
        optional: false,
    }
}

#[cfg(test)]
mod catalog_tests {
    use super::*;

    #[test]
    fn typed_catalog_is_exhaustive_unique_and_round_trips_all_twenty_two_ids() {
        let ids = TbCharacterId::ALL
            .into_iter()
            .map(TbCharacterId::as_str)
            .collect::<HashSet<_>>();
        assert_eq!(ids.len(), 22);
        for id in TbCharacterId::ALL {
            assert_eq!(TbCharacterId::parse(id.as_str()), Some(id));
        }
        assert_eq!(TbCharacterId::parse("unknown"), None);
    }

    #[test]
    fn typed_catalog_owns_kind_and_wake_order_metadata() {
        let count = |kind| {
            TbCharacterId::ALL
                .into_iter()
                .filter(|id| id.metadata().kind == kind)
                .count()
        };
        assert_eq!(count(CharacterKind::Townsfolk), 13);
        assert_eq!(count(CharacterKind::Outsider), 4);
        assert_eq!(count(CharacterKind::Minion), 4);
        assert_eq!(count(CharacterKind::Demon), 1);
        assert_eq!(
            first_night_order(),
            [
                "poisoner",
                "washerwoman",
                "librarian",
                "investigator",
                "chef",
                "empath",
                "fortuneTeller",
                "butler",
                "spy"
            ]
        );
        assert_eq!(
            night_order(),
            [
                "poisoner",
                "monk",
                "imp",
                "ravenkeeper",
                "empath",
                "fortuneTeller",
                "undertaker",
                "butler",
                "spy"
            ]
        );
        assert!(TbCharacterId::ALL.into_iter().all(|id| {
            let metadata = id.metadata();
            metadata.automated || metadata.activity != TbActivityRequirement::Alive
        }));
    }
}

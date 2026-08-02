use crate::{
    contracts::{GameEndCause, RevealIdentity, RevealPayload, RevealPlayer, SetupDistribution},
    model::{
        ConfirmedInformation, CoreWarning, DeliveryContext, DeliveryReason, ExecutionStanding,
        InformationResult, NominationRecord, PhaseStep, Player, StepInput,
    },
};
use serde_json::{json, Value};

pub(crate) fn smoke_event_summary() -> String {
    "스모크 명령 확인".to_string()
}

pub(crate) fn smoke_preview() -> Value {
    json!({ "messageKo": "코어 계약 정상" })
}

pub(crate) fn setup_event_summary(player_count: usize) -> String {
    format!("초기 설정 확정: {player_count}명")
}

pub(crate) fn setup_preview(player_count: usize) -> Value {
    json!({ "messageKo": format!("플레이어 {player_count}명 설정을 확정합니다.") })
}

pub(crate) fn game_end_reason_ko(cause: GameEndCause) -> &'static str {
    match cause {
        GameEndCause::DemonAbsent => "살아 있는 악마가 없습니다.",
        GameEndCause::TwoLivingPlayers => "생존자가 2명 이하로 남았습니다.",
        GameEndCause::KlutzChoice => "얼뜨기가 악한 팀을 선택했습니다.",
        GameEndCause::EvilTwinExecution => "선한 쌍둥이가 처형되었습니다.",
        GameEndCause::VortoxNoExecution => "보르톡스가 존재하지만 낮에 아무도 처형되지 않았습니다.",
    }
}

pub(crate) fn phase_step_event_summary(
    step: &PhaseStep,
    players: &[Player],
    input: &StepInput,
    information: Option<&ConfirmedInformation>,
    skip: bool,
) -> String {
    let action = if skip { "건너뜀" } else { "확정" };
    if !skip {
        if let Some(summary) = phase_step_summary(step, players, input, information) {
            return summary;
        }
    }
    format!("단계 {action}: {}", step.id)
}

pub(crate) fn phase_step_preview(skip: bool) -> Value {
    let action = if skip { "건너뜀" } else { "확정" };
    json!({ "messageKo": format!("현재 단계를 {action}합니다.") })
}

pub(crate) fn nomination_closed_event_summary() -> String {
    "지목 종료".to_string()
}

pub(crate) fn nomination_closed_preview() -> Value {
    json!({ "messageKo": "지목을 종료하고 처형 확인으로 이동합니다." })
}

pub(crate) fn nomination_vote_event_summary(
    players: &[Player],
    record: &NominationRecord,
) -> String {
    let nominee = player_verbose_label(players, &record.nominee_id);
    let nominator = player_verbose_label(players, &record.nominator_id);
    format!(
        "지목 투표 확정: {nominator} → {nominee}, {}표",
        record.vote_count
    )
}

pub(crate) fn nomination_vote_preview(
    record: &NominationRecord,
    execution_standing: &ExecutionStanding,
) -> Value {
    json!({
        "messageKo": format!("{}표로 지목 투표를 확정합니다.", record.vote_count),
        "voteCount": record.vote_count,
        "ghostVoteSpentPlayerIds": &record.ghost_vote_spent_player_ids,
        "executionStanding": execution_standing,
    })
}

pub(crate) fn execution_death_event_summary(players: &[Player], player_id: &str) -> String {
    format!("사망 확정: {}", player_verbose_label(players, player_id))
}

pub(crate) fn execution_death_preview() -> Value {
    json!({ "messageKo": "처형된 플레이어의 사망을 확정합니다." })
}

pub(crate) fn execution_survival_event_summary(players: &[Player], player_id: &str) -> String {
    format!(
        "처형 후 생존 확정: {}",
        player_verbose_label(players, player_id)
    )
}

pub(crate) fn execution_event_summary(players: &[Player], player_id: Option<&str>) -> String {
    if let Some(player_id) = player_id {
        format!("처형 확정: {}", player_verbose_label(players, player_id))
    } else {
        "처형 없음 확정".to_string()
    }
}

pub(crate) fn execution_preview(execute: bool) -> Value {
    json!({
        "messageKo": if execute { "처형을 확정합니다." } else { "처형 없음을 확정합니다." }
    })
}

pub(crate) fn setup_distribution_warning(expected: &SetupDistribution) -> CoreWarning {
    CoreWarning {
        code: "SETUP_DISTRIBUTION_MISMATCH".to_string(),
        severity: "warning",
        message_ko: format!(
            "Trouble Brewing 권장 구성은 주민 {}, 외지인 {}, 하수인 {}, 악마 {}명입니다.",
            expected.townsfolk, expected.outsider, expected.minion, expected.demon
        ),
        winning_team: None,
    }
}

pub(crate) fn duplicate_actual_character_warning() -> CoreWarning {
    CoreWarning {
        code: "DUPLICATE_ACTUAL_CHARACTER".to_string(),
        severity: "warning",
        message_ko: "중복된 실제 캐릭터가 있습니다.".to_string(),
        winning_team: None,
    }
}

pub(crate) fn phase_step_reveal_payload(
    step: &PhaseStep,
    information: &ConfirmedInformation,
    players: &[Player],
) -> Option<RevealPayload> {
    let delivered_result = &information.delivered_result;
    match delivered_result {
        InformationResult::Boolean { value }
            if step.character.as_deref() == Some("fortuneTeller") =>
        {
            Some(RevealPayload::FortuneTellerInformation {
                kind: "fortuneTellerInformation",
                target_players: reveal_players(players, &information.target_player_ids)?,
                has_demon: *value,
            })
        }
        InformationResult::Character { character_id }
            if matches!(
                step.character.as_deref(),
                Some("undertaker" | "ravenkeeper")
            ) =>
        {
            Some(RevealPayload::CharacterInformation {
                kind: "characterInformation",
                character_id: step.character.clone()?,
                target_player: reveal_players(players, &information.target_player_ids)?
                    .into_iter()
                    .next()?,
                revealed_character_id: character_id.clone(),
            })
        }
        InformationResult::CharacterPair { character_ids }
            if step.character.as_deref() == Some("dreamer") =>
        {
            Some(RevealPayload::DreamerInformation {
                kind: "dreamerInformation",
                character_ids: character_ids.clone(),
            })
        }
        InformationResult::Boolean { value } if step.character.as_deref() == Some("seamstress") => {
            Some(RevealPayload::SeamstressInformation {
                kind: "seamstressInformation",
                target_players: reveal_players(players, &information.target_player_ids)?,
                same_alignment: *value,
            })
        }
        InformationResult::PlayerPair { player_ids }
            if step.character.as_deref() == Some("sage") =>
        {
            Some(RevealPayload::SageInformation {
                kind: "sageInformation",
                candidate_players: reveal_players(players, player_ids)?,
            })
        }
        InformationResult::Number { value }
            if matches!(
                step.character.as_deref(),
                Some("chef" | "empath" | "clockmaker" | "oracle" | "juggler")
            ) =>
        {
            Some(RevealPayload::NumericInformation {
                kind: "numericInformation",
                character_id: step.character.clone()?,
                value: *value,
            })
        }
        InformationResult::Boolean { value }
            if matches!(step.character.as_deref(), Some("flowergirl" | "townCrier")) =>
        {
            Some(RevealPayload::BooleanInformation {
                kind: "booleanInformation",
                character_id: step.character.clone()?,
                value: *value,
            })
        }
        InformationResult::SetupInfo {
            player_ids,
            character_id,
            zero_outsiders,
        } => setup_info_result_reveal_payload(
            step.character.as_deref()?,
            player_ids,
            character_id.as_deref(),
            *zero_outsiders,
            players,
        ),
        InformationResult::TeamInfo {
            demon_player_ids,
            minion_player_ids,
            bluff_character_ids,
        } => team_info_reveal_payload(
            step,
            players,
            demon_player_ids,
            minion_player_ids,
            bluff_character_ids,
        ),
        InformationResult::SpyGrimoire { players } => Some(RevealPayload::SpyGrimoire {
            kind: "spyGrimoire",
            players: players.clone(),
        }),
        _ => None,
    }
}

pub(crate) fn phase_step_summary(
    step: &PhaseStep,
    players: &[Player],
    input: &StepInput,
    information: Option<&ConfirmedInformation>,
) -> Option<String> {
    if let Some(information) = information {
        if let InformationResult::TeamInfo {
            demon_player_ids,
            minion_player_ids,
            bluff_character_ids,
        } = &information.delivered_result
        {
            let player_list = |ids: &[String]| {
                let values = ids
                    .iter()
                    .map(|id| player_verbose_label(players, id))
                    .collect::<Vec<_>>();
                list_or_none(&values)
            };
            if step.id.ends_with(":minionInfo") {
                return Some(format!(
                    "하수인 정보 전달 · 악마: {} · 하수인: {}",
                    player_list(demon_player_ids),
                    player_list(minion_player_ids)
                ));
            }
            if step.id.ends_with(":demonInfo") {
                let bluffs = bluff_character_ids
                    .iter()
                    .map(|id| character_label(id).to_string())
                    .collect::<Vec<_>>();
                return Some(format!(
                    "악마 정보 전달 · 하수인: {} · 블러프: {}",
                    player_list(minion_player_ids),
                    list_or_none(&bluffs)
                ));
            }
        }
    }

    let character = step.character.as_deref()?;
    if character == "butler" {
        let actor = step.player_id.as_deref()?;
        let target = input.as_ref()?.player_ids.as_ref()?.first()?;
        return Some(format!(
            "{} → {} · 주인 선택",
            player_ability_label(players, actor, character),
            player_verbose_label(players, target)
        ));
    }

    let information = information?;
    let actor = information.actor.as_ref()?;
    let actor_label = player_ability_label(players, &actor.player_id, &actor.character_id);
    let targets = information
        .target_player_ids
        .iter()
        .map(|id| player_verbose_label(players, id))
        .collect::<Vec<_>>();
    let audit = information_audit_suffix(character, information);

    match character {
        "washerwoman" | "librarian" | "investigator" => {
            setup_information_summary(character, &actor_label, information, players)
        }
        "chef" => number_result(information).map(|count| {
            format!("{actor_label}가 서로 이웃한 악한 팀 {count}쌍을 확인했습니다.{audit}")
        }),
        "empath" => number_result(information).map(|count| {
            format!(
                "{actor_label}가 살아있는 양옆 이웃 중 악한 팀 {count}명을 확인했습니다.{audit}"
            )
        }),
        "clockmaker" => number_result(information).map(|count| {
            format!("{actor_label}가 악마와 하수인의 거리 {count}칸을 확인했습니다.{audit}")
        }),
        "flowergirl" => boolean_result(information).map(|voted| {
            format!(
                "{actor_label}가 오늘 악마의 투표를 확인했습니다: {}{audit}",
                if voted {
                    "투표함"
                } else {
                    "투표하지 않음"
                }
            )
        }),
        "townCrier" => boolean_result(information).map(|nominated| {
            format!(
                "{actor_label}가 오늘 하수인의 지목을 확인했습니다: {}{audit}",
                if nominated {
                    "지목함"
                } else {
                    "지목하지 않음"
                }
            )
        }),
        "oracle" => number_result(information).map(|count| {
            format!("{actor_label}가 죽은 악한 플레이어 {count}명을 확인했습니다.{audit}")
        }),
        "dreamer" => Some(format!(
            "{actor_label}가 {}의 캐릭터 후보를 확인했습니다.{audit}",
            targets.join(", ")
        )),
        "seamstress" => boolean_result(information).map(|same| {
            format!(
                "{actor_label}가 {}의 진영을 비교했습니다: {}{audit}",
                targets.join(", "),
                if same { "같음" } else { "다름" }
            )
        }),
        "sage" => Some(format!(
            "{actor_label}가 악마 후보 두 명을 확인했습니다.{audit}"
        )),
        "fortuneTeller" => boolean_result(information).map(|has_demon| {
            format!(
                "{actor_label}가 {}를 확인: 악마 {}{audit}",
                targets.join(", "),
                if has_demon { "있음" } else { "없음" }
            )
        }),
        "undertaker" => character_result(information).map(|character_id| {
            format!(
                "{actor_label}가 {}를 확인 · 처형된 플레이어의 캐릭터: {}{audit}",
                targets.join(", "),
                character_label(character_id)
            )
        }),
        "ravenkeeper" => character_result(information).map(|character_id| {
            format!(
                "{actor_label}가 {}를 확인 · 대상의 캐릭터: {}{audit}",
                targets.join(", "),
                character_label(character_id)
            )
        }),
        "spy" => Some(format!("{actor_label}가 마도서를 확인했습니다.{audit}")),
        _ => None,
    }
}

fn number_result(information: &ConfirmedInformation) -> Option<u64> {
    match &information.delivered_result {
        InformationResult::Number { value } => Some(*value),
        _ => None,
    }
}

fn boolean_result(information: &ConfirmedInformation) -> Option<bool> {
    match &information.delivered_result {
        InformationResult::Boolean { value } => Some(*value),
        _ => None,
    }
}

fn character_result(information: &ConfirmedInformation) -> Option<&str> {
    match &information.delivered_result {
        InformationResult::Character { character_id } => Some(character_id),
        _ => None,
    }
}

fn setup_information_summary(
    kind: &str,
    actor_label: &str,
    information: &ConfirmedInformation,
    players: &[Player],
) -> Option<String> {
    let InformationResult::SetupInfo {
        player_ids,
        character_id,
        zero_outsiders,
    } = &information.delivered_result
    else {
        return None;
    };
    let audit = information_audit_suffix(kind, information);
    if kind == "librarian" && *zero_outsiders {
        return Some(format!(
            "{actor_label}가 외지인 없음을 확인했습니다.{audit}"
        ));
    }
    Some(format!(
        "{actor_label}가 {} 중 한 명을 {}로 확인했습니다.{audit}",
        player_ids
            .iter()
            .map(|id| player_verbose_label(players, id))
            .collect::<Vec<_>>()
            .join(", "),
        character_label(character_id.as_deref()?)
    ))
}

fn information_audit_suffix(kind: &str, information: &ConfirmedInformation) -> String {
    let reasons = delivery_context_label(&information.delivery_context);
    let Some(computed) = information.computed_result.as_ref() else {
        return if reasons.is_empty() {
            String::new()
        } else {
            format!(" ({})", reasons.trim_start_matches(" · "))
        };
    };
    if computed == &information.delivered_result
        && matches!(information.delivery_context, DeliveryContext::Fixed)
    {
        return String::new();
    }
    let actual = information_result_label(kind, computed);
    match (actual, reasons.is_empty()) {
        (Some(actual), false) => format!(" (실제 {actual}{reasons})"),
        (Some(actual), true) => format!(" (실제 {actual})"),
        (None, false) => format!(" ({})", reasons.trim_start_matches(" · ")),
        (None, true) => String::new(),
    }
}

fn information_result_label(kind: &str, result: &InformationResult) -> Option<String> {
    match result {
        InformationResult::Boolean { value } if kind == "fortuneTeller" => {
            Some(format!("악마 {}", if *value { "있음" } else { "없음" }))
        }
        InformationResult::Character { character_id } => {
            Some(character_label(character_id).to_string())
        }
        InformationResult::Number { value } if kind == "chef" => Some(format!("{value}쌍")),
        InformationResult::Number { value } if kind == "empath" => Some(format!("{value}명")),
        InformationResult::Number { value } if kind == "clockmaker" => Some(format!("{value}칸")),
        InformationResult::Number { value } if kind == "oracle" => Some(format!("{value}명")),
        InformationResult::Boolean { value } if kind == "flowergirl" => Some(
            if *value {
                "투표함"
            } else {
                "투표하지 않음"
            }
            .into(),
        ),
        InformationResult::Boolean { value } if kind == "townCrier" => Some(
            if *value {
                "지목함"
            } else {
                "지목하지 않음"
            }
            .into(),
        ),
        _ => None,
    }
}

fn delivery_context_label(context: &DeliveryContext) -> String {
    let DeliveryContext::Discretionary { reasons } = context else {
        return String::new();
    };
    let labels = reasons
        .iter()
        .map(|reason| match reason {
            DeliveryReason::AbilityChoice => "능력 선택",
            DeliveryReason::Drunk => "술취함",
            DeliveryReason::Poisoned { .. } => "중독",
            DeliveryReason::Vortox { .. } => "보르톡스",
            DeliveryReason::RegistrationJudgment { .. } => "등록 판정",
        })
        .collect::<Vec<_>>();
    if labels.is_empty() {
        String::new()
    } else {
        format!(" · {}", labels.join(", "))
    }
}

fn setup_info_result_reveal_payload(
    kind: &str,
    player_ids: &[String],
    character_id: Option<&str>,
    zero_outsiders: bool,
    players: &[Player],
) -> Option<RevealPayload> {
    if kind == "librarian" && zero_outsiders {
        return Some(RevealPayload::SetupInformation {
            kind: "setupInformation",
            character_id: kind.to_string(),
            candidate_players: vec![],
            revealed_character_id: None,
            zero_outsiders: true,
        });
    }
    let character_id = character_id?;
    Some(RevealPayload::SetupInformation {
        kind: "setupInformation",
        character_id: kind.to_string(),
        candidate_players: reveal_players(players, player_ids)?,
        revealed_character_id: Some(character_id.to_string()),
        zero_outsiders: false,
    })
}

fn reveal_players(players: &[Player], player_ids: &[String]) -> Option<Vec<RevealPlayer>> {
    player_ids
        .iter()
        .map(|player_id| {
            players
                .iter()
                .find(|player| player.id == *player_id)
                .map(|player| RevealPlayer {
                    player_id: player.id.clone(),
                    seat: player.seat,
                    name: player.name.clone(),
                })
        })
        .collect()
}

fn team_info_reveal_payload(
    step: &PhaseStep,
    players: &[Player],
    demon_player_ids: &[String],
    minion_player_ids: &[String],
    bluff_character_ids: &[String],
) -> Option<RevealPayload> {
    let player_identities = |ids: &[String]| -> Option<Vec<RevealIdentity>> {
        let mut identities = ids
            .iter()
            .map(|id| {
                players
                    .iter()
                    .find(|player| player.id == *id)
                    .map(|player| RevealIdentity {
                        seat: player.seat,
                        name: player.name.clone(),
                    })
            })
            .collect::<Option<Vec<_>>>()?;
        identities.sort_by_key(|player| player.seat);
        Some(identities)
    };
    if step.id.ends_with(":minionInfo") {
        return Some(RevealPayload::MinionInformation {
            kind: "minionInformation",
            demon_players: player_identities(demon_player_ids)?,
            minion_players: player_identities(minion_player_ids)?,
        });
    }
    if step.id.ends_with(":demonInfo") {
        return Some(RevealPayload::DemonInformation {
            kind: "demonInformation",
            minion_players: player_identities(minion_player_ids)?,
            bluff_character_ids: bluff_character_ids.to_vec(),
        });
    }
    None
}

pub(crate) fn list_or_none(values: &[String]) -> String {
    if values.is_empty() {
        "없음".to_string()
    } else {
        values.join(", ")
    }
}

pub(crate) fn player_verbose_label(players: &[Player], player_id: &str) -> String {
    players
        .iter()
        .find(|player| player.id == player_id)
        .map(|player| {
            format!(
                "{}번 {}({})",
                player.seat,
                player.name,
                character_label(&player.actual_character)
            )
        })
        .unwrap_or_else(|| player_id.to_string())
}

pub(crate) fn player_ability_label(
    players: &[Player],
    player_id: &str,
    ability_character: &str,
) -> String {
    players
        .iter()
        .find(|player| player.id == player_id)
        .map(|player| {
            let ability = character_label(ability_character);
            let actual = character_label(&player.actual_character);
            if player.actual_character == ability_character {
                format!("{}번 {}({ability})", player.seat, player.name)
            } else {
                format!(
                    "{}번 {}({ability} 능력, 실제 {actual})",
                    player.seat, player.name
                )
            }
        })
        .unwrap_or_else(|| player_id.to_string())
}

pub(crate) fn character_label(character: &str) -> &'static str {
    match character {
        "washerwoman" => "세탁부",
        "librarian" => "사서",
        "investigator" => "수사관",
        "chef" => "요리사",
        "empath" => "초공감자",
        "fortuneTeller" => "점쟁이",
        "undertaker" => "장의사",
        "monk" => "수도사",
        "ravenkeeper" => "까마귀지기",
        "virgin" => "성결자",
        "slayer" => "처단자",
        "soldier" => "군인",
        "mayor" => "시장",
        "butler" => "집사",
        "drunk" => "주정뱅이",
        "recluse" => "은둔자",
        "saint" => "성자",
        "poisoner" => "독살범",
        "spy" => "첩자",
        "scarletWoman" => "탕녀",
        "baron" => "남작",
        "imp" => "임프",
        "clockmaker" => "시계공",
        "dreamer" => "꿈꾸는 자",
        "snakeCharmer" => "뱀 조련사",
        "mathematician" => "수학자",
        "flowergirl" => "꽃팔이 소녀",
        "townCrier" => "포고꾼",
        "oracle" => "예언자",
        "savant" => "백치천재",
        "seamstress" => "재봉사",
        "philosopher" => "철학자",
        "artist" => "화가",
        "juggler" => "곡예사",
        "sage" => "현자",
        "mutant" => "변종",
        "sweetheart" => "사랑꾼",
        "barber" => "이발사",
        "klutz" => "얼뜨기",
        "evilTwin" => "사악한 쌍둥이",
        "witch" => "마녀",
        "cerenovus" => "세레노버스",
        "pitHag" => "마귀할멈",
        "fangGu" => "팡 구",
        "vigormortis" => "비고르모르티스",
        "noDashii" => "노 다시",
        "vortox" => "보르톡스",
        _ => "알 수 없음",
    }
}

#[cfg(test)]
mod tests {
    use super::character_label;

    #[test]
    fn trouble_brewing_character_labels_match_the_official_korean_edition() {
        let expected = [
            ("washerwoman", "세탁부"),
            ("librarian", "사서"),
            ("investigator", "수사관"),
            ("chef", "요리사"),
            ("empath", "초공감자"),
            ("fortuneTeller", "점쟁이"),
            ("undertaker", "장의사"),
            ("monk", "수도사"),
            ("ravenkeeper", "까마귀지기"),
            ("virgin", "성결자"),
            ("slayer", "처단자"),
            ("soldier", "군인"),
            ("mayor", "시장"),
            ("butler", "집사"),
            ("drunk", "주정뱅이"),
            ("recluse", "은둔자"),
            ("saint", "성자"),
            ("poisoner", "독살범"),
            ("spy", "첩자"),
            ("scarletWoman", "탕녀"),
            ("baron", "남작"),
            ("imp", "임프"),
        ];

        for (character_id, label) in expected {
            assert_eq!(character_label(character_id), label);
        }
    }

    #[test]
    fn sects_and_violets_character_labels_match_the_official_korean_edition() {
        let expected = [
            ("clockmaker", "시계공"),
            ("dreamer", "꿈꾸는 자"),
            ("snakeCharmer", "뱀 조련사"),
            ("mathematician", "수학자"),
            ("flowergirl", "꽃팔이 소녀"),
            ("townCrier", "포고꾼"),
            ("oracle", "예언자"),
            ("savant", "백치천재"),
            ("seamstress", "재봉사"),
            ("philosopher", "철학자"),
            ("artist", "화가"),
            ("juggler", "곡예사"),
            ("sage", "현자"),
            ("mutant", "변종"),
            ("sweetheart", "사랑꾼"),
            ("barber", "이발사"),
            ("klutz", "얼뜨기"),
            ("evilTwin", "사악한 쌍둥이"),
            ("witch", "마녀"),
            ("cerenovus", "세레노버스"),
            ("pitHag", "마귀할멈"),
            ("fangGu", "팡 구"),
            ("vigormortis", "비고르모르티스"),
            ("noDashii", "노 다시"),
            ("vortox", "보르톡스"),
        ];

        for (character_id, label) in expected {
            assert_eq!(character_label(character_id), label);
        }
    }
}

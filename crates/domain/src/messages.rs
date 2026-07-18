use crate::{
    contracts::{RevealPayload, RevealPlayer, SetupDistribution},
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
    "지명 종료".to_string()
}

pub(crate) fn nomination_closed_preview() -> Value {
    json!({ "messageKo": "지명을 종료하고 처형 확인으로 이동합니다." })
}

pub(crate) fn nomination_vote_event_summary(
    players: &[Player],
    record: &NominationRecord,
) -> String {
    let nominee = player_verbose_label(players, &record.nominee_id);
    let nominator = player_verbose_label(players, &record.nominator_id);
    format!(
        "지명 투표 확정: {nominator} → {nominee}, {}표",
        record.vote_count
    )
}

pub(crate) fn nomination_vote_preview(
    record: &NominationRecord,
    execution_standing: &ExecutionStanding,
) -> Value {
    json!({
        "messageKo": format!("{}표로 지명 투표를 확정합니다.", record.vote_count),
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
            "Trouble Brewing 권장 구성은 마을주민 {}, 외부인 {}, 하수인 {}, 악마 {}명입니다.",
            expected.townsfolk, expected.outsider, expected.minion, expected.demon
        ),
        winning_team: None,
    }
}

pub(crate) fn duplicate_actual_character_warning() -> CoreWarning {
    CoreWarning {
        code: "DUPLICATE_ACTUAL_CHARACTER".to_string(),
        severity: "warning",
        message_ko: "중복된 Actual Character가 있습니다.".to_string(),
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
        InformationResult::Number { value }
            if matches!(step.character.as_deref(), Some("chef" | "empath")) =>
        {
            Some(RevealPayload::NumericInformation {
                kind: "numericInformation",
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

fn number_result(information: &ConfirmedInformation) -> Option<usize> {
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
            "{actor_label}가 외부인 없음을 확인했습니다.{audit}"
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
            DeliveryReason::Drunk => "술취함",
            DeliveryReason::Poisoned { .. } => "중독",
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
    let player_character_labels = |ids: &[String]| {
        ids.iter()
            .filter_map(|id| players.iter().find(|player| player.id == *id))
            .map(player_character_label)
            .collect::<Vec<_>>()
    };
    let demons = player_character_labels(demon_player_ids);
    let minions = player_character_labels(minion_player_ids);
    if step.id.ends_with(":minionInfo") {
        return Some(RevealPayload::Text {
            message_ko: format!(
                "하수인 정보:\n악마: {}\n하수인: {}",
                list_or_none(&demons),
                list_or_none(&minions)
            ),
            label_ko: None,
            value_ko: None,
            preview_message_ko: None,
        });
    }
    if step.id.ends_with(":demonInfo") {
        let bluffs = bluff_character_ids
            .iter()
            .map(|character| character_label(character).to_string())
            .collect::<Vec<_>>();
        return Some(RevealPayload::Text {
            message_ko: format!(
                "악마 정보:\n하수인: {}\n블러프: {}",
                list_or_none(&minions),
                list_or_none(&bluffs)
            ),
            label_ko: None,
            value_ko: None,
            preview_message_ko: None,
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

pub(crate) fn player_character_label(player: &Player) -> String {
    format!(
        "{}번 {} - {}",
        player.seat,
        player.name,
        character_label(&player.actual_character)
    )
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
        "investigator" => "조사관",
        "chef" => "요리사",
        "empath" => "공감능력자",
        "fortuneTeller" => "점쟁이",
        "undertaker" => "장의사",
        "monk" => "수도사",
        "ravenkeeper" => "까마귀지기",
        "virgin" => "처녀",
        "slayer" => "학살자",
        "soldier" => "군인",
        "mayor" => "시장",
        "butler" => "집사",
        "drunk" => "술꾼",
        "recluse" => "은둔자",
        "saint" => "성자",
        "poisoner" => "독살자",
        "spy" => "스파이",
        "scarletWoman" => "붉은 여인",
        "baron" => "남작",
        "imp" => "임프",
        _ => "알 수 없음",
    }
}

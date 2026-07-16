use crate::{
    contracts::{RevealPayload, SetupDistribution},
    model::{
        ConfirmedInformation, CoreWarning, DeliveryContext, DeliveryReason, ExecutionStanding,
        InformationResult, NominationRecord, PhaseStep, Player, StepInput, StepInputFields,
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
    let nominee =
        player_label(players, &record.nominee_id).unwrap_or_else(|| "알 수 없음".to_string());
    let nominator =
        player_label(players, &record.nominator_id).unwrap_or_else(|| "알 수 없음".to_string());
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
    format!(
        "사망 확정: {}",
        player_label(players, player_id).unwrap_or_else(|| player_id.to_string())
    )
}

pub(crate) fn execution_death_preview() -> Value {
    json!({ "messageKo": "처형된 플레이어의 사망을 확정합니다." })
}

pub(crate) fn execution_survival_event_summary(players: &[Player], player_id: &str) -> String {
    format!(
        "처형 후 생존 확정: {}",
        player_label(players, player_id).unwrap_or_else(|| player_id.to_string())
    )
}

pub(crate) fn execution_event_summary(players: &[Player], player_id: Option<&str>) -> String {
    if let Some(player_id) = player_id {
        format!(
            "처형 확정: {}",
            player_label(players, player_id).unwrap_or_else(|| player_id.to_string())
        )
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
    delivered_result: &InformationResult,
    players: &[Player],
) -> Option<RevealPayload> {
    match delivered_result {
        InformationResult::Boolean { value } => Some(RevealPayload::Text {
            message_ko: if *value { "예" } else { "아니요" }.to_string(),
            label_ko: None,
            value_ko: Some(if *value { "예" } else { "아니요" }.to_string()),
            preview_message_ko: None,
        }),
        InformationResult::Character { character_id } => Some(RevealPayload::Text {
            message_ko: character_label(character_id).to_string(),
            label_ko: None,
            value_ko: Some(character_label(character_id).to_string()),
            preview_message_ko: None,
        }),
        InformationResult::Number { value: count } if step.character.as_deref() == Some("chef") => {
            Some(RevealPayload::Text {
                message_ko: format!("서로 이웃한 악 팀 쌍은 {count}쌍입니다."),
                label_ko: Some("서로 이웃한 악한 팀 쌍".to_string()),
                value_ko: Some(format!("{count}쌍")),
                preview_message_ko: None,
            })
        }
        InformationResult::Number { value: count }
            if step.character.as_deref() == Some("empath") =>
        {
            Some(RevealPayload::Text {
                message_ko: format!("살아있는 양옆 이웃 중 악 팀은 {count}명입니다."),
                label_ko: Some("살아있는 양옆 이웃 중 악한 팀".to_string()),
                value_ko: Some(format!("{count}명")),
                preview_message_ko: None,
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
    match step.character.as_deref()? {
        "washerwoman" | "librarian" | "investigator" => {
            setup_info_summary(step.character.as_deref()?, input, players)
        }
        "chef" => numeric_information_summary("요리사", "쌍", information?),
        "empath" => numeric_information_summary("공감능력자", "명", information?),
        _ => None,
    }
}

fn numeric_information_summary(
    character_label: &str,
    unit: &str,
    information: &ConfirmedInformation,
) -> Option<String> {
    let Some(InformationResult::Number { value: true_value }) =
        information.computed_result.as_ref()
    else {
        return None;
    };
    let InformationResult::Number {
        value: displayed_value,
    } = information.delivered_result
    else {
        return None;
    };
    let context = delivery_context_label(&information.delivery_context);
    let audit_detail = match &information.delivery_context {
        DeliveryContext::Fixed => String::new(),
        DeliveryContext::Discretionary { .. } => {
            format!(" (실제 {true_value}{unit}{context})")
        }
    };
    Some(format!(
        "{character_label}가 {displayed_value}{unit}을 확인했습니다.{audit_detail}"
    ))
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
        return Some(RevealPayload::Text {
            message_ko: "사서 정보: 외부인은 0명입니다.".to_string(),
            label_ko: None,
            value_ko: None,
            preview_message_ko: None,
        });
    }
    let character_id = character_id?;
    let candidates = player_ids
        .iter()
        .map(|player_id| player_label(players, player_id))
        .collect::<Option<Vec<_>>>()?;
    Some(RevealPayload::Text {
        message_ko: format!(
            "{} 정보: {} 중 한 명은 {}입니다.",
            setup_info_label(kind),
            candidates.join(" 또는 "),
            character_label(character_id)
        ),
        label_ko: None,
        value_ko: None,
        preview_message_ko: None,
    })
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

pub(crate) fn setup_info_summary(
    kind: &str,
    input: &StepInput,
    players: &[Player],
) -> Option<String> {
    let input = input.as_ref()?;
    if kind == "librarian" && input.zero_outsiders == Some(true) {
        return Some("사서 정보 확정: 외부인 0명".to_string());
    }

    let character_id = input.character_id.as_deref()?;
    let candidates = setup_info_candidate_labels(input, players)?;
    Some(format!(
        "{} 정보 확정: {} 중 {}",
        setup_info_label(kind),
        candidates.join(", "),
        character_label(character_id)
    ))
}

pub(crate) fn setup_info_candidate_labels(
    input: &StepInputFields,
    players: &[Player],
) -> Option<Vec<String>> {
    input
        .player_ids
        .as_ref()?
        .iter()
        .map(String::as_str)
        .map(|player_id| player_label(players, player_id))
        .collect()
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

pub(crate) fn player_label(players: &[Player], player_id: &str) -> Option<String> {
    players
        .iter()
        .find(|player| player.id == player_id)
        .map(|player| format!("{}번 {}", player.seat, player.name))
}

pub(crate) fn setup_info_label(kind: &str) -> &'static str {
    match kind {
        "washerwoman" => "세탁부",
        "librarian" => "사서",
        "investigator" => "조사관",
        _ => "정보",
    }
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

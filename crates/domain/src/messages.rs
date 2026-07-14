use crate::{
    characters::{
        character_kind, empath_evil_neighbor_count, evil_neighbor_pair_count, seated_players,
    },
    contracts::{RevealPayload, SetupDistribution},
    model::{
        CharacterKind, CoreWarning, NominationRecord, NumericReason, PhaseStep, Player, StepInput,
        StepInputFields, StepType,
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
    skip: bool,
) -> String {
    let action = if skip { "건너뜀" } else { "확정" };
    if !skip {
        if let Some(summary) = phase_step_summary(step, players, input) {
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
        "지명 투표 확정: {nominator} → {nominee}, {}표{}",
        record.vote_count,
        if record.updates_execution_candidate {
            ", 처형 후보 갱신"
        } else {
            ""
        }
    )
}

pub(crate) fn nomination_vote_preview(record: &NominationRecord) -> Value {
    json!({
        "messageKo": format!("{}표로 지명 투표를 확정합니다.", record.vote_count),
        "voteCount": record.vote_count,
        "ghostVoteSpentPlayerIds": &record.ghost_vote_spent_player_ids,
        "updatesExecutionCandidate": record.updates_execution_candidate
    })
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
    }
}

pub(crate) fn duplicate_actual_character_warning() -> CoreWarning {
    CoreWarning {
        code: "DUPLICATE_ACTUAL_CHARACTER".to_string(),
        severity: "warning",
        message_ko: "중복된 Actual Character가 있습니다.".to_string(),
    }
}

pub(crate) fn phase_step_reveal_payload(
    step: &PhaseStep,
    players: &[Player],
    input: &StepInput,
) -> Option<RevealPayload> {
    if step.step_type == StepType::EvilInfo {
        return evil_info_reveal_payload(step, players, input);
    }

    match step.character.as_deref()? {
        "washerwoman" => setup_info_reveal_payload("washerwoman", input, players),
        "librarian" => setup_info_reveal_payload("librarian", input, players),
        "investigator" => setup_info_reveal_payload("investigator", input, players),
        "chef" => Some(RevealPayload {
            message_ko: format!(
                "서로 이웃한 악 팀 쌍은 {}쌍입니다.",
                numeric_input_value(input).unwrap_or_else(|| evil_neighbor_pair_count(players))
            ),
            preview_message_ko: None,
        }),
        "empath" => Some(RevealPayload {
            message_ko: format!(
                "살아있는 양옆 이웃 중 악 팀은 {}명입니다.",
                empath_evil_neighbor_count(players, step.player_id.as_deref()?)?
            ),
            preview_message_ko: None,
        }),
        "spy" => Some(RevealPayload {
            message_ko: format!("스파이 그리모어:\n{}", grimoire_lines(players).join("\n")),
            preview_message_ko: Some("스파이 그리모어 Reveal 준비됨".to_string()),
        }),
        _ => None,
    }
}

pub(crate) fn phase_step_summary(
    step: &PhaseStep,
    players: &[Player],
    input: &StepInput,
) -> Option<String> {
    match step.character.as_deref()? {
        "washerwoman" | "librarian" | "investigator" => {
            setup_info_summary(step.character.as_deref()?, input, players)
        }
        "chef" => {
            let true_value = input
                .as_ref()
                .and_then(|input| input.true_value)
                .unwrap_or_else(|| evil_neighbor_pair_count(players));
            let displayed_value = input
                .as_ref()
                .and_then(|input| input.displayed_value)
                .unwrap_or(true_value);
            Some(format!(
                "요리사 정보 확정: 실제 {true_value}쌍, 표시 {displayed_value}쌍{}",
                input
                    .as_ref()
                    .and_then(|input| input.reason.flatten())
                    .map(|reason| format!(" ({})", chef_reason_label(reason)))
                    .unwrap_or_default()
            ))
        }
        _ => None,
    }
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

pub(crate) fn setup_info_reveal_payload(
    kind: &str,
    input: &StepInput,
    players: &[Player],
) -> Option<RevealPayload> {
    let input = input.as_ref()?;
    if kind == "librarian" && input.zero_outsiders == Some(true) {
        return Some(RevealPayload {
            message_ko: "사서 정보: 외부인은 0명입니다.".to_string(),
            preview_message_ko: None,
        });
    }

    let character_id = input.character_id.as_deref()?;
    let candidates = setup_info_candidate_labels(input, players)?;
    Some(RevealPayload {
        message_ko: format!(
            "{} 정보: {} 중 한 명은 {}입니다.",
            setup_info_label(kind),
            candidates.join(" 또는 "),
            character_label(character_id)
        ),
        preview_message_ko: None,
    })
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

pub(crate) fn evil_info_reveal_payload(
    step: &PhaseStep,
    players: &[Player],
    input: &StepInput,
) -> Option<RevealPayload> {
    let demons = players
        .iter()
        .filter(|player| {
            matches!(
                character_kind(&player.actual_character),
                Some(CharacterKind::Demon)
            )
        })
        .map(player_character_label)
        .collect::<Vec<_>>();
    let minions = players
        .iter()
        .filter(|player| {
            matches!(
                character_kind(&player.actual_character),
                Some(CharacterKind::Minion)
            )
        })
        .map(player_character_label)
        .collect::<Vec<_>>();

    if step.id.ends_with(":minionInfo") {
        return Some(RevealPayload {
            message_ko: format!(
                "하수인 정보:\n악마: {}\n하수인: {}",
                list_or_none(&demons),
                list_or_none(&minions)
            ),
            preview_message_ko: None,
        });
    }
    if step.id.ends_with(":demonInfo") {
        let bluffs = input
            .as_ref()
            .and_then(|input| input.character_ids.as_ref())
            .map(|character_ids| {
                character_ids
                    .iter()
                    .map(|character| character_label(character))
                    .collect::<Vec<_>>()
                    .join(", ")
            })
            .filter(|bluffs| !bluffs.is_empty())
            .unwrap_or_else(|| "없음".to_string());
        return Some(RevealPayload {
            message_ko: format!(
                "악마 정보:\n하수인: {}\n블러프: {bluffs}",
                list_or_none(&minions)
            ),
            preview_message_ko: None,
        });
    }

    None
}

pub(crate) fn grimoire_lines(players: &[Player]) -> Vec<String> {
    seated_players(players)
        .iter()
        .map(|player| player_character_label(player))
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

pub(crate) fn chef_reason_label(reason: NumericReason) -> &'static str {
    match reason {
        NumericReason::Drunk => "술취함",
        NumericReason::Poisoned => "중독",
        NumericReason::Registration => "등록 판정",
    }
}

pub(crate) fn numeric_input_value(input: &StepInput) -> Option<usize> {
    input.as_ref()?.value.or(input.as_ref()?.displayed_value)
}

pub(crate) fn numeric_input_reason(input: &StepInput) -> Option<NumericReason> {
    input.as_ref()?.reason.flatten()
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

use crate::model::*;
use serde_json::{json, Value};
pub(crate) fn setup_event_summary(player_count: usize) -> String {
    format!("초기 설정 확정: {player_count}명")
}

pub(crate) fn setup_preview(player_count: usize) -> Value {
    json!({ "messageKo": format!("플레이어 {player_count}명 설정을 확정합니다.") })
}

pub(crate) fn phase_step_preview(skip: bool) -> Value {
    let action = if skip { "건너뜀" } else { "확정" };
    json!({ "messageKo": format!("현재 단계를 {action}합니다.") })
}

pub(crate) fn phase_step_event_summary(
    step: &PhaseStep,
    _players: &[Player],
    _input: &StepInput,
    _information: Option<&ConfirmedInformation>,
    skip: bool,
) -> String {
    let action = if skip { "건너뜀" } else { "확정" };
    format!("단계 {action}: {}", step.id)
}

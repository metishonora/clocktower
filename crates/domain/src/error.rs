use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CoreError {
    pub(crate) code: &'static str,
    pub(crate) message_ko: &'static str,
}

#[derive(Debug, Copy, Clone)]
pub(crate) enum ErrorKind {
    MalformedGameFile,
    UnsupportedSchemaVersion,
    MalformedCommand,
    UnsupportedCommand,
    MalformedEvent,
    UnsupportedEvent,
    CommandNotSupportedByScript,
    EventNotSupportedByScript,
    MalformedRequest,
    InvalidPlayerCount,
    InvalidPlayer,
    UnknownCharacter,
    InvalidDrunkShownCharacter,
    InvalidSeating,
    ReplayFailed,
    InvalidStepInput,
    InvalidButlerMaster,
    ButlerMasterVoteRequired,
    GhostVoteAlreadySpent,
    MissingStepInput,
    TooMuchStepInput,
    GameAlreadyHasEvents,
    NoCurrentStep,
    StaleStep,
    StepCannotBeSkipped,
    StepRequiresManualResolution,
    StepIsAutomated,
    NoExecutionCandidate,
    ExecutionSurvivalNotAllowed,
    MissingDeliveredInformation,
    UnexpectedDeliveredInformation,
    InvalidDeliveredInformation,
    InvalidRegistrationJudgment,
    UnsupportedDraftSuggestion,
    NoValidDraftSuggestion,
    SlayerWrongPhase,
    StaleCommand,
    InvalidSlayerActor,
    SlayerAlreadyUsed,
    InvalidSlayerTarget,
    InvalidSlayerRegistration,
    DayActionWrongPhase,
    InvalidDayActionActor,
    DayActionUnavailable,
    InvalidDayActionRecord,
    MadnessCheckWrongPhase,
    MadnessAssignmentUnavailable,
    MadnessCheckUnchanged,
    MadnessViolationLatched,
    MadnessExecutionUnavailable,
    MissingMayorDecision,
    InvalidMayorDecision,
    InvalidPlayerAnnotations,
    GameAlreadyEnded,
}

impl ErrorKind {
    pub(crate) fn into_error(self) -> CoreError {
        let (code, message_ko) = match self {
            Self::MalformedGameFile => {
                ("MALFORMED_GAME_FILE", "게임 파일 형식이 올바르지 않습니다.")
            }
            Self::UnsupportedSchemaVersion => (
                "UNSUPPORTED_SCHEMA_VERSION",
                "지원하지 않는 게임 파일 버전입니다.",
            ),
            Self::MalformedCommand => ("MALFORMED_COMMAND", "명령 형식이 올바르지 않습니다."),
            Self::UnsupportedCommand => ("UNSUPPORTED_COMMAND", "지원하지 않는 명령입니다."),
            Self::MalformedEvent => ("MALFORMED_EVENT", "이벤트 형식이 올바르지 않습니다."),
            Self::UnsupportedEvent => ("UNSUPPORTED_EVENT", "지원하지 않는 이벤트입니다."),
            Self::CommandNotSupportedByScript => (
                "COMMAND_NOT_SUPPORTED_BY_SCRIPT",
                "현재 스크립트에서 지원하지 않는 명령입니다.",
            ),
            Self::EventNotSupportedByScript => (
                "EVENT_NOT_SUPPORTED_BY_SCRIPT",
                "현재 스크립트에서 지원하지 않는 이벤트입니다.",
            ),
            Self::MalformedRequest => ("MALFORMED_REQUEST", "요청 형식이 올바르지 않습니다."),
            Self::InvalidPlayerCount => (
                "INVALID_PLAYER_COUNT",
                "플레이어는 5명 이상 15명 이하이어야 합니다.",
            ),
            Self::InvalidPlayer => ("INVALID_PLAYER", "플레이어 이름을 입력해야 합니다."),
            Self::UnknownCharacter => ("UNKNOWN_CHARACTER", "지원하지 않는 캐릭터입니다."),
            Self::InvalidDrunkShownCharacter => (
                "INVALID_DRUNK_SHOWN_CHARACTER",
                "주정뱅이에게 보여준 캐릭터는 주민이어야 합니다.",
            ),
            Self::InvalidSeating => (
                "INVALID_SEATING",
                "좌석 번호는 1번부터 순서대로 배정해야 합니다.",
            ),
            Self::ReplayFailed => ("REPLAY_FAILED", "확정 이벤트를 재생할 수 없습니다."),
            Self::InvalidStepInput => ("INVALID_STEP_INPUT", "현재 단계 입력이 올바르지 않습니다."),
            Self::InvalidButlerMaster => (
                "INVALID_BUTLER_MASTER",
                "집사는 자신을 주인으로 선택할 수 없습니다.",
            ),
            Self::ButlerMasterVoteRequired => (
                "BUTLER_MASTER_VOTE_REQUIRED",
                "집사는 주인이 현재 투표에 참여한 경우에만 투표할 수 있습니다.",
            ),
            Self::GhostVoteAlreadySpent => (
                "GHOST_VOTE_ALREADY_SPENT",
                "이미 유령표를 사용한 플레이어가 포함되어 있습니다.",
            ),
            Self::MissingStepInput => ("MISSING_STEP_INPUT", "현재 단계에 필요한 입력이 없습니다."),
            Self::TooMuchStepInput => ("TOO_MUCH_STEP_INPUT", "현재 단계 입력이 너무 많습니다."),
            Self::GameAlreadyHasEvents => (
                "GAME_ALREADY_HAS_EVENTS",
                "이미 확정된 이벤트가 있는 게임입니다.",
            ),
            Self::NoCurrentStep => ("NO_CURRENT_STEP", "진행할 현재 단계가 없습니다."),
            Self::StaleStep => ("STALE_STEP", "현재 단계와 일치하지 않는 명령입니다."),
            Self::StepCannotBeSkipped => ("STEP_CANNOT_BE_SKIPPED", "건너뛸 수 없는 단계입니다."),
            Self::StepRequiresManualResolution => (
                "STEP_REQUIRES_MANUAL_RESOLUTION",
                "수동 단계는 수동 처리 결과로 완료해야 합니다.",
            ),
            Self::StepIsAutomated => (
                "STEP_IS_AUTOMATED",
                "자동화 단계는 수동 처리할 수 없습니다.",
            ),
            Self::NoExecutionCandidate => ("NO_EXECUTION_CANDIDATE", "처형 후보가 없습니다."),
            Self::ExecutionSurvivalNotAllowed => (
                "EXECUTION_SURVIVAL_NOT_ALLOWED",
                "현재 스크립트에서는 처형 후 생존을 확정할 수 없습니다.",
            ),
            Self::MissingDeliveredInformation => (
                "MISSING_DELIVERED_INFORMATION",
                "전달할 정보를 명시해야 합니다.",
            ),
            Self::UnexpectedDeliveredInformation => (
                "UNEXPECTED_DELIVERED_INFORMATION",
                "현재 단계에서는 전달 정보를 선택할 수 없습니다.",
            ),
            Self::InvalidDeliveredInformation => (
                "INVALID_DELIVERED_INFORMATION",
                "전달할 정보의 형식이나 값이 올바르지 않습니다.",
            ),
            Self::InvalidRegistrationJudgment => (
                "INVALID_REGISTRATION_JUDGMENT",
                "현재 정보 확인에 적용할 수 없는 등록 판정입니다.",
            ),
            Self::UnsupportedDraftSuggestion => (
                "UNSUPPORTED_DRAFT_SUGGESTION",
                "현재 단계에서는 무작위 입력을 추천할 수 없습니다.",
            ),
            Self::NoValidDraftSuggestion => (
                "NO_VALID_DRAFT_SUGGESTION",
                "무작위 추천을 만들 수 없습니다. 실제 캐릭터 배정과 현재 단계 조건을 확인하세요.",
            ),
            Self::SlayerWrongPhase => (
                "SLAYER_WRONG_PHASE",
                "토론 중에만 처단자 능력을 사용할 수 있습니다.",
            ),
            Self::StaleCommand => (
                "STALE_COMMAND",
                "게임 상태가 변경되었습니다. 다시 선택하세요.",
            ),
            Self::InvalidSlayerActor => (
                "INVALID_SLAYER_ACTOR",
                "능력을 사용할 수 있는 처단자가 아닙니다.",
            ),
            Self::SlayerAlreadyUsed => ("SLAYER_ALREADY_USED", "처단자 능력을 이미 사용했습니다."),
            Self::InvalidSlayerTarget => {
                ("INVALID_SLAYER_TARGET", "처단자 대상을 찾을 수 없습니다.")
            }
            Self::InvalidSlayerRegistration => (
                "INVALID_SLAYER_REGISTRATION",
                "대상의 악마 등록 판정이 올바르지 않습니다.",
            ),
            Self::DayActionWrongPhase => (
                "DAY_ACTION_WRONG_PHASE",
                "낮에만 이 능력을 기록할 수 있습니다.",
            ),
            Self::InvalidDayActionActor => (
                "INVALID_DAY_ACTION_ACTOR",
                "현재 이 낮 능력을 사용할 수 있는 플레이어가 아닙니다.",
            ),
            Self::DayActionUnavailable => (
                "DAY_ACTION_UNAVAILABLE",
                "이 낮 능력의 사용 기회가 없습니다.",
            ),
            Self::InvalidDayActionRecord => (
                "INVALID_DAY_ACTION_RECORD",
                "낮 능력 기록의 형식이나 값이 올바르지 않습니다.",
            ),
            Self::MadnessCheckWrongPhase => (
                "MADNESS_CHECK_WRONG_PHASE",
                "광기 준수 여부는 낮에만 기록할 수 있습니다.",
            ),
            Self::MadnessAssignmentUnavailable => (
                "MADNESS_ASSIGNMENT_UNAVAILABLE",
                "현재 확인할 수 있는 광기 지시가 아닙니다.",
            ),
            Self::MadnessCheckUnchanged => (
                "MADNESS_CHECK_UNCHANGED",
                "같은 광기 판정은 다시 기록하지 않습니다.",
            ),
            Self::MadnessViolationLatched => (
                "MADNESS_VIOLATION_LATCHED",
                "확인된 광기 위반은 되돌리기 전까지 유지됩니다.",
            ),
            Self::MadnessExecutionUnavailable => (
                "MADNESS_EXECUTION_UNAVAILABLE",
                "현재 이 광기 위반으로 처형할 수 없습니다.",
            ),
            Self::MissingMayorDecision => (
                "MISSING_MAYOR_DECISION",
                "시장 사망 또는 튕김 결정을 선택해야 합니다.",
            ),
            Self::InvalidMayorDecision => (
                "INVALID_MAYOR_DECISION",
                "현재 공격에 적용할 수 없는 시장 결정입니다.",
            ),
            Self::InvalidPlayerAnnotations => (
                "INVALID_PLAYER_ANNOTATIONS",
                "플레이어 토큰 또는 Notes 입력이 올바르지 않습니다.",
            ),
            Self::GameAlreadyEnded => ("GAME_ALREADY_ENDED", "이미 종료된 게임입니다."),
        };
        CoreError { code, message_ko }
    }
}

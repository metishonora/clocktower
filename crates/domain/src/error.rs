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
    MalformedRequest,
    InvalidPlayerCount,
    InvalidPlayer,
    UnknownCharacter,
    InvalidDrunkShownCharacter,
    InvalidSeating,
    ReplayFailed,
    InvalidStepInput,
    GhostVoteAlreadySpent,
    MissingStepInput,
    TooMuchStepInput,
    GameAlreadyHasEvents,
    NoCurrentStep,
    StaleStep,
    StepCannotBeSkipped,
    NoExecutionCandidate,
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
            Self::MalformedRequest => ("MALFORMED_REQUEST", "요청 형식이 올바르지 않습니다."),
            Self::InvalidPlayerCount => (
                "INVALID_PLAYER_COUNT",
                "플레이어는 5명 이상 15명 이하이어야 합니다.",
            ),
            Self::InvalidPlayer => ("INVALID_PLAYER", "플레이어 이름을 입력해야 합니다."),
            Self::UnknownCharacter => ("UNKNOWN_CHARACTER", "지원하지 않는 캐릭터입니다."),
            Self::InvalidDrunkShownCharacter => (
                "INVALID_DRUNK_SHOWN_CHARACTER",
                "Drunk의 Shown Character는 마을주민이어야 합니다.",
            ),
            Self::InvalidSeating => (
                "INVALID_SEATING",
                "좌석 번호는 1번부터 순서대로 배정해야 합니다.",
            ),
            Self::ReplayFailed => ("REPLAY_FAILED", "확정 이벤트를 재생할 수 없습니다."),
            Self::InvalidStepInput => ("INVALID_STEP_INPUT", "현재 단계 입력이 올바르지 않습니다."),
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
            Self::NoExecutionCandidate => ("NO_EXECUTION_CANDIDATE", "처형 후보가 없습니다."),
        };
        CoreError { code, message_ko }
    }
}

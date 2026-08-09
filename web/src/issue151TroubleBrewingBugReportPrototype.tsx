import { useEffect, useMemo, useRef, useState } from "react";
import { ProductionApplicationShell } from "./shared-ui/ProductionApplicationShell";
import "./features/trouble-brewing/troubleBrewingProduction.css";
import "./issue151TroubleBrewingBugReportPrototype.css";

type SurfaceSpecimen = "setup-night" | "live-night" | "live-day";
type ReviewState = "ready" | "missing" | "oversized" | "copy-failed" | "save-failed";
type DeliveryFeedback = "copied" | "saved" | "email-opened";

type TroubleBrewingReproductionContext = {
  activeTab: "roles" | "play";
  replayPhase: "setup" | "night" | "day";
  currentStepId: string | null;
  currentStepType: string | null;
  eventCount: number;
};

export type TroubleBrewingBugReport = {
  subject: "[Clocktower Trouble Brewing] 버그 제보";
  body: string;
  attachmentJson: string;
  reportType: "clocktower.trouble-brewing.bug-report";
  reportSchemaVersion: 2;
  filename: string;
  reproductionContext: TroubleBrewingReproductionContext;
  fixture: TroubleBrewingFixture;
};

type TroubleBrewingFixture = {
  schemaVersion: 3;
  game: {
    scriptId: "troubleBrewing";
    id: string;
    name: "Redacted bug report";
    createdAt: string;
    updatedAt: string;
    events: Array<{
      id: string;
      type: string;
      phase: "setup" | "night" | "day";
      summary: string;
      createdAt: string;
      payload: Record<string, unknown>;
    }>;
  };
};

const SUBJECT: TroubleBrewingBugReport["subject"] = "[Clocktower Trouble Brewing] 버그 제보";
const REPORT_TYPE: TroubleBrewingBugReport["reportType"] = "clocktower.trouble-brewing.bug-report";
const REPORT_SCHEMA_VERSION = 2 as const;
const FILENAME_PREFIX = "clocktower-trouble-brewing-bug-report";
const REPORT_FILENAME = `${FILENAME_PREFIX}-2026-08-09T10-15-00-000Z.json`;

const surfaceSpecs: Array<{ id: SurfaceSpecimen; label: string }> = [
  { id: "setup-night", label: "설정 · 밤" },
  { id: "live-night", label: "라이브 · 밤" },
  { id: "live-day", label: "라이브 · 낮" },
];

const reportStates: Array<{ id: ReviewState; label: string }> = [
  { id: "ready", label: "기본" },
  { id: "missing", label: "이메일 불가" },
  { id: "oversized", label: "긴 보고서" },
  { id: "copy-failed", label: "복사 실패" },
  { id: "save-failed", label: "저장 실패" },
];

const surfaceData: Record<SurfaceSpecimen, {
  theme: "day" | "night";
  label: string;
  stage: "roles" | "play";
  context: Omit<TroubleBrewingReproductionContext, "eventCount">;
  currentStepLabel: string;
  currentStepDetail: string;
}> = {
  "setup-night": {
    theme: "night",
    label: "설정",
    stage: "roles",
    context: {
      activeTab: "roles",
      replayPhase: "setup",
      currentStepId: null,
      currentStepType: null,
    },
    currentStepLabel: "직업 구성",
    currentStepDetail: "아직 확정된 canonical 이벤트가 없습니다.",
  },
  "live-night": {
    theme: "night",
    label: "라이브",
    stage: "play",
    context: {
      activeTab: "play",
      replayPhase: "night",
      currentStepId: "night:imp",
      currentStepType: "character",
    },
    currentStepLabel: "밤 진행",
    currentStepDetail: "현재 단계 · 악마 행동",
  },
  "live-day": {
    theme: "day",
    label: "라이브",
    stage: "play",
    context: {
      activeTab: "play",
      replayPhase: "day",
      currentStepId: "day:nomination",
      currentStepType: "nomination",
    },
    currentStepLabel: "낮 진행",
    currentStepDetail: "현재 단계 · 지명 및 투표",
  },
};

const fixtureEvents: Record<Exclude<SurfaceSpecimen, "setup-night">, TroubleBrewingFixture["game"]["events"]> = {
  "live-night": [
    {
      id: "event-setup-confirmed",
      type: "setupConfirmed",
      phase: "setup",
      summary: "초기 설정 확정",
      createdAt: "2026-08-09T10:00:00.000Z",
      payload: { players: [] },
    },
    {
      id: "event-night-step",
      type: "phaseStepConfirmed",
      phase: "night",
      summary: "밤 단계 확인",
      createdAt: "2026-08-09T10:01:00.000Z",
      payload: { stepId: "night:imp", input: null },
    },
  ],
  "live-day": [
    {
      id: "event-setup-confirmed",
      type: "setupConfirmed",
      phase: "setup",
      summary: "초기 설정 확정",
      createdAt: "2026-08-09T10:00:00.000Z",
      payload: { players: [] },
    },
    {
      id: "event-night-step",
      type: "phaseStepSkipped",
      phase: "night",
      summary: "밤 단계 건너뜀",
      createdAt: "2026-08-09T10:10:00.000Z",
      payload: { stepId: "night:toDay" },
    },
    {
      id: "event-day-step",
      type: "phaseStepConfirmed",
      phase: "day",
      summary: "낮 단계 확인",
      createdAt: "2026-08-09T10:11:00.000Z",
      payload: { stepId: "day:nomination", input: null },
    },
    {
      id: "event-annotations",
      type: "playerAnnotationsUpdated",
      phase: "day",
      summary: "토큰 상태 갱신",
      createdAt: "2026-08-09T10:14:00.000Z",
      payload: { playerId: "seat-1", systemTokenIds: [], scriptTokens: [], notes: "" },
    },
  ],
};

export function Issue151TroubleBrewingBugReportPrototype() {
  const [surface, setSurface] = useState<SurfaceSpecimen>("setup-night");
  const [reviewState, setReviewState] = useState<ReviewState>("ready");
  const [dialogOpen, setDialogOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const current = surfaceData[surface];

  function closeDialog() {
    setDialogOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  function openDialog(nextState: ReviewState = "ready") {
    setReviewState(nextState);
    setDialogOpen(true);
  }

  function chooseSurface(nextSurface: SurfaceSpecimen) {
    setSurface(nextSurface);
    setDialogOpen(true);
  }

  return (
    <div className="issue151ReviewRoot">
      <section className="issue151ReviewControls" aria-label="Issue 151 fixture 검토 도구">
        <div className="issue151ReviewControlsHeading">
          <strong>ISSUE #151 · REVIEW</strong>
          <span>production 화면 밖의 검토 도구</span>
        </div>
        <div className="issue151ReviewGroups">
          <div className="issue151ReviewGroup" role="group" aria-label="표면 specimen">
            <span>표면</span>
            {surfaceSpecs.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                aria-pressed={surface === candidate.id}
                onClick={() => chooseSurface(candidate.id)}
              >
                {candidate.label}
              </button>
            ))}
          </div>
          <div className="issue151ReviewGroup" role="group" aria-label="보고서 상태 specimen">
            <span>보고서</span>
            {reportStates.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                aria-pressed={reviewState === candidate.id}
                onClick={() => openDialog(candidate.id)}
              >
                {candidate.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <ProductionApplicationShell
        ariaLabel="Trouble Brewing 게임 버그 제보 fixture"
        theme={current.theme}
        motion="none"
        title="Trouble Brewing"
        eyebrow="STORYTELLER CONSOLE"
        subtitle="7명 · canonical 상태 검토"
        leading={<a className="snvScriptHomeLink" href="/clocktower/" onClick={(event) => event.preventDefault()} aria-label="스크립트 선택">←</a>}
        headerActionsAriaLabel="현재 페이즈와 되돌리기"
        headerActions={<>
          <button
            type="button"
            className="snvGlobalUndo empty"
            data-visual-state="muted"
            aria-hidden="true"
            tabIndex={-1}
            disabled
          >
            <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M12.2 9.2 6.5 14.8l5.7 5.7" /><path d="M7.2 14.8h10.2a8 8 0 1 1-6.3 12.9" /></svg>
          </button>
          <span className="tbPhaseMark" role="img" aria-label={current.theme === "day" ? "낮" : "밤"}>{current.theme === "day" ? "☀" : "☾"}</span>
        </>}
        utilities={[
          { id: "new-game", label: "새 게임", className: "snvNewGameTab" },
          { id: "storage", label: "저장 / 불러오기", className: "snvStorageTab" },
          {
            id: "bug-report",
            label: "버그 제보",
            className: "snvBugReportTrigger",
            buttonRef: triggerRef,
            onSelect: () => openDialog(),
          },
        ]}
        stages={[
          { id: "roles", label: "직업", active: current.stage === "roles", className: current.stage === "roles" ? "active" : "" },
          { id: "seating", label: "마도서", disabled: current.stage !== "roles" },
          { id: "play", label: "진행", active: current.stage === "play", className: current.stage === "play" ? "active" : "" },
        ]}
        onNavigate={() => undefined}
        className="tbProductionShell issue151ProductionShell"
      >
        <TroubleBrewingFixtureSurface surface={surface} />
      </ProductionApplicationShell>

      {dialogOpen ? (
        <TroubleBrewingBugReportDialog
          surface={surface}
          state={reviewState}
          onClose={closeDialog}
        />
      ) : null}
    </div>
  );
}

function TroubleBrewingFixtureSurface({ surface }: { surface: SurfaceSpecimen }) {
  const current = surfaceData[surface];
  const isSetup = surface === "setup-night";
  return (
    <section
      className={`issue151FixtureSurface ${isSetup ? "issue151SetupSurface" : "issue151LiveSurface"}`}
      aria-label={`${current.label} Trouble Brewing fixture`}
    >
      <header className="issue151FixtureSurfaceHeader">
        <div>
          <span>CANONICAL {isSetup ? "SETUP" : "LIVE"}</span>
          <h2>{current.currentStepLabel}</h2>
        </div>
        <strong>{current.theme === "day" ? "낮" : "밤"}</strong>
      </header>
      <div className="issue151FixtureGrid">
        <article className="issue151StatusCard">
          <span>현재 컨텍스트</span>
          <strong>{current.currentStepDetail}</strong>
          <p>{isSetup ? "설정 초안과 플레이어 이름은 이 화면에 포함하지 않습니다." : "canonical 이벤트로 재현 가능한 진행 상태입니다."}</p>
        </article>
        <article className="issue151TokenCard" aria-label="자동 리마인더와 토큰 상태">
          <span>리마인더 · 토큰</span>
          <div>
            <strong>{isSetup ? "대기 중" : current.theme === "day" ? "처형 대기" : "악마 공격"}</strong>
            <small>{isSetup ? "canonical 이벤트 0건" : "자동 리마인더 · 수동 토큰 분리"}</small>
          </div>
        </article>
      </div>
      <p className="issue151FixtureCaption">버그 제보 dialog의 재현 컨텍스트만 검토하는 fixture입니다.</p>
    </section>
  );
}

function TroubleBrewingBugReportDialog({
  surface,
  state,
  onClose,
}: {
  surface: SurfaceSpecimen;
  state: ReviewState;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [symptom, setSymptom] = useState("");
  const [includeOriginal, setIncludeOriginal] = useState(false);
  const [feedback, setFeedback] = useState<DeliveryFeedback>();
  const current = surfaceData[surface];
  const report = useMemo(
    () => buildTroubleBrewingBugReport(surface, symptom, includeOriginal),
    [includeOriginal, surface, symptom],
  );

  useEffect(() => {
    closeRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        "button:not(:disabled), textarea:not(:disabled), input:not(:disabled), summary",
      ) ?? []);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const unavailable = state === "missing" || state === "copy-failed" || state === "save-failed";
  const recovery = state === "oversized" ? "oversized" : state === "missing" ? "missing" : undefined;
  const previewStatus = includeOriginal ? "원본 포함(검토용)" : "이름 제거됨";

  function updateSymptom(value: string) {
    setSymptom(value);
    setFeedback(undefined);
  }

  return (
    <div
      className={`issue151BugReportBackdrop issue151${current.theme === "day" ? "Day" : "Night"}`}
      data-theme={current.theme}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section
        ref={dialogRef}
        className="issue151BugReportDialog"
        role="dialog"
        aria-modal="true"
        aria-label="버그 제보"
        aria-labelledby="issue151-bug-report-title"
        data-theme={current.theme}
        data-report-type={report.reportType}
        data-report-schema-version={report.reportSchemaVersion}
        data-script-id="troubleBrewing"
        data-report-subject={report.subject}
        data-filename-reference={report.filename}
      >
        <header>
          <div>
            <span>Clocktower Trouble Brewing</span>
            <h2 id="issue151-bug-report-title">버그 제보</h2>
          </div>
          <button ref={closeRef} type="button" aria-label="버그 제보 닫기" onClick={onClose}>×</button>
        </header>
        <div className="issue151BugReportBody">
          <label className="issue151BugReportDescription">
            <span>무슨 문제가 있었나요?</span>
            <textarea
              rows={3}
              value={symptom}
              onChange={(event) => updateSymptom(event.target.value)}
            />
          </label>

          <section className="issue151BugReportPrivacy" aria-label="제보 데이터 안내">
            <div><span aria-hidden="true">✓</span><p><strong>포함</strong> 좌석·직업·진영, 확정 이벤트와 이벤트 시간, 앱·기기 정보</p></div>
            <div><span aria-hidden="true">−</span><p><strong>제외</strong> 플레이어 이름과 Storyteller 메모, 설정 초안</p></div>
          </section>

          <details className="issue151BugReportPreview">
            <summary>
              <span>{recovery === "oversized" ? "보고서 파일 미리보기" : "전송 내용 미리보기"}</span>
              <small>{previewStatus} · {report.reproductionContext.eventCount} events</small>
            </summary>
            <pre data-preview-content="true">{recovery === "oversized" ? report.attachmentJson : report.body}</pre>
          </details>

          <details className="issue151BugReportOriginal">
            <summary>저장·불러오기 문제인가요?</summary>
            <label>
              <input
                type="checkbox"
                checked={includeOriginal}
                onChange={(event) => setIncludeOriginal(event.target.checked)}
              />
              <span>원본 GameFile JSON도 포함</span>
            </label>
            <p>원본에는 플레이어 이름과 메모가 들어 있을 수 있습니다. 직렬화 또는 불러오기 문제를 제보할 때만 선택하세요. 이 prototype에서는 fixture 상태만 바뀝니다.</p>
          </details>

          {state === "oversized" ? (
            <div className="issue151BugReportRecovery" role="status">
              <strong>이메일 본문으로 보내기에는 보고서가 깁니다.</strong>
              <p>보고서 파일을 저장한 뒤, 메일로 전송 부탁드립니다.</p>
            </div>
          ) : state === "missing" ? (
            <div className="issue151BugReportRecovery" role="status">
              <strong>제보 이메일 주소가 설정되지 않았습니다.</strong>
              <p>내용은 그대로 유지했습니다. 보고서를 복사하거나 파일로 저장해 첨부하세요.</p>
            </div>
          ) : state === "copy-failed" ? (
            <div className="issue151BugReportFailure" role="alert">
              <strong>보고서를 복사하지 못했습니다. 파일로 저장해 주세요.</strong>
              <p>브라우저의 클립보드 권한을 확인한 뒤 다시 시도하세요.</p>
            </div>
          ) : state === "save-failed" ? (
            <div className="issue151BugReportFailure" role="alert">
              <strong>보고서 파일을 저장하지 못했습니다. 다시 시도해 주세요.</strong>
              <p>파일 저장 대신 보고서를 복사해 첨부할 수 있습니다.</p>
            </div>
          ) : null}

          {feedback === "copied" ? <p className="issue151BugReportSuccess" role="status">보고서를 클립보드에 복사했습니다.</p> : null}
          {feedback === "saved" ? <p className="issue151BugReportSuccess" role="status">보고서 파일을 저장했습니다.</p> : null}
          {feedback === "email-opened" ? <p className="issue151BugReportSuccess" role="status">메일 작성 동작은 prototype에서 열지 않습니다.</p> : null}
        </div>
        <footer>
          <button type="button" onClick={onClose}>취소</button>
          {state === "oversized" ? (
            <>
              <button type="button" onClick={() => setFeedback("saved")}>보고서 파일 저장</button>
              <button type="button" className="primary" onClick={() => setFeedback("email-opened")}>메일 전송</button>
            </>
          ) : unavailable ? (
            <>
              <button type="button" onClick={() => setFeedback("saved")}>파일 저장</button>
              <button type="button" onClick={() => setFeedback("copied")}>보고서 복사</button>
            </>
          ) : (
            <button type="button" className="primary" onClick={() => setFeedback("email-opened")}>이메일 작성</button>
          )}
        </footer>
      </section>
    </div>
  );
}

export function buildTroubleBrewingBugReport(
  surface: SurfaceSpecimen,
  symptom = "",
  includeOriginalGameFile = false,
): TroubleBrewingBugReport {
  const current = surfaceData[surface];
  const events = surface === "setup-night" ? [] : fixtureEvents[surface];
  const reproductionContext: TroubleBrewingReproductionContext = {
    ...current.context,
    eventCount: events.length,
  };
  const fixture: TroubleBrewingFixture = {
    schemaVersion: 3,
    game: {
      scriptId: "troubleBrewing",
      id: `issue-151-${surface}`,
      name: "Redacted bug report",
      createdAt: "2026-08-09T10:00:00.000Z",
      updatedAt: "2026-08-09T10:15:00.000Z",
      events,
    },
  };
  const metadata = [
    `reportSchemaVersion: ${REPORT_SCHEMA_VERSION}`,
    "schemaVersion: 3",
    "scriptId: troubleBrewing",
    "appVersion: prototype",
    "buildCommit: issue-151",
    "pageUrl: /clocktower/trouble-brewing/",
    "userAgent: prototype review",
    "viewport: 390x844",
    "gameUpdatedAt: 2026-08-09T10:15:00.000Z",
  ];
  const body = [
    "# Clocktower Trouble Brewing 버그 제보",
    "",
    "[사용자 제보]",
    "문제 설명:",
    symptom.trim() || "(작성하지 않음)",
    "",
    "[환경]",
    ...metadata,
    "",
    "[개인정보 처리]",
    "게임 이름 및 플레이어 이름 대체됨 · Storyteller 메모 제거됨 · 설정 초안 제외",
    "",
    "[재현 컨텍스트]",
    "```json",
    JSON.stringify(reproductionContext, null, 2),
    "```",
    "",
    "[재현 Fixture]",
    "```json",
    JSON.stringify(fixture, null, 2),
    "```",
    ...(includeOriginalGameFile ? ["", "[원본 GameFile JSON — fixture-only opt-in]", "```json", JSON.stringify(fixture, null, 2), "```"] : []),
  ].join("\n");
  const attachment = {
    reportSchemaVersion: REPORT_SCHEMA_VERSION,
    reportType: REPORT_TYPE,
    userReport: { symptom: symptom.trim() || null },
    environment: {
      appVersion: "prototype",
      buildCommit: "issue-151",
      pageUrl: "/clocktower/trouble-brewing/",
      userAgent: "prototype review",
      viewport: { width: 390, height: 844 },
    },
    redaction: {
      gameName: "replaced",
      playerNames: "seatLabels",
      storytellerNotes: "removed",
    },
    reproductionContext,
    fixture,
    ...(includeOriginalGameFile ? { originalGameFile: fixture } : {}),
  };
  return {
    subject: SUBJECT,
    body,
    attachmentJson: JSON.stringify(attachment, null, 2),
    reportType: REPORT_TYPE,
    reportSchemaVersion: REPORT_SCHEMA_VERSION,
    filename: REPORT_FILENAME,
    reproductionContext,
    fixture,
  };
}

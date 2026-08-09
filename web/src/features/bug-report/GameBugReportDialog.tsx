import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { GameFile } from "../../core/types.js";
import {
  browserBugReportDelivery,
  bugReportEmailAvailability,
  bugReportMailto,
  type BugReportDelivery,
  type BugReportEmailAvailability,
} from "../../bugReportDelivery.js";
import "./gameBugReport.css";

export type BugReportEnvironment = {
  appVersion: string;
  buildCommit: string;
  pageUrl: string;
  userAgent: string;
  viewport: { width: number; height: number };
};

export type BugReportContext = {
  eventCount?: number;
  [key: string]: unknown;
};

export type BugReportMetadata = {
  reportSchemaVersion: number;
  schemaVersion: number;
  scriptId: string;
  appVersion: string;
  buildCommit: string;
  pageUrl: string;
  userAgent: string;
  viewport: string;
  gameUpdatedAt: string;
  eventCount: number;
  [key: string]: unknown;
};

export type BugReportBuildInput<TContext extends BugReportContext = BugReportContext> = {
  gameFile: GameFile;
  symptom: string;
  environment: BugReportEnvironment;
  reproductionContext: TContext;
  includeOriginalGameFile: boolean;
};

export type BugReportResult<TContext extends BugReportContext = BugReportContext> = {
  subject: string;
  body: string;
  attachmentJson: string;
  metadata: BugReportMetadata;
  fixture: GameFile;
  reproductionContext: TContext & { eventCount: number };
  reportType?: string;
  reportSchemaVersion?: number;
  filename?: string;
};

export type BugReportBuilder<TContext extends BugReportContext = BugReportContext> = (
  input: BugReportBuildInput<TContext>,
) => BugReportResult<TContext>;

/**
 * The prefix is intentionally part of the theme adapter rather than being
 * inferred from script text. It keeps the production S&V selectors stable
 * while allowing a script to bring a complete visual treatment of its own.
 */
export type BugReportDialogTheme = {
  id: string;
  classPrefix: string;
};

export const sectsAndVioletsBugReportTheme: BugReportDialogTheme = {
  id: "sects-and-violets",
  classPrefix: "snv",
};

export const troubleBrewingBugReportTheme: BugReportDialogTheme = {
  id: "trouble-brewing",
  classPrefix: "tb",
};

export type GameBugReportDialogProps<TContext extends BugReportContext = BugReportContext> = {
  gameFile: GameFile;
  environment: BugReportEnvironment;
  reproductionContext: TContext;
  recipient: string;
  delivery?: BugReportDelivery;
  onClose: () => void;
  builder: BugReportBuilder<TContext>;
  theme?: BugReportDialogTheme;
  scriptName: string;
  scriptId: string;
  downloadPrefix: string;
  /** S&V keeps this identity in the subject/body only; TB shows it in the dialog header. */
  showBrandName?: boolean;
  privacyIncluded?: string;
  privacyExcluded?: string;
  originalFileWarning?: string;
  originalFileDescription?: string;
  originalFileLabel?: string;
  previewIncludedLabel?: string;
  metadataMailto?: (recipient: string, report: BugReportResult<TContext>) => string;
};

type DeliveryFeedback = "copied" | "copyFailed" | "downloaded" | "downloadFailed" | "emailFailed";
type RecoveryReason = BugReportEmailAvailability | "emailFailed";

const DEFAULT_PRIVACY_INCLUDED = "좌석·직업·진영, 확정 이벤트와 이벤트 시간, 앱·기기 정보";
const DEFAULT_PRIVACY_EXCLUDED = "플레이어 이름과 Storyteller 메모";
const DEFAULT_ORIGINAL_FILE_WARNING = "원본에는 플레이어 이름과 메모가 들어 있을 수 있습니다. 직렬화 또는 불러오기 문제를 제보할 때만 선택하세요.";

export function GameBugReportDialog<TContext extends BugReportContext>({
  gameFile,
  environment,
  reproductionContext,
  recipient,
  delivery = browserBugReportDelivery,
  onClose,
  builder,
  theme = sectsAndVioletsBugReportTheme,
  scriptName,
  scriptId,
  downloadPrefix,
  showBrandName = true,
  privacyIncluded = DEFAULT_PRIVACY_INCLUDED,
  privacyExcluded = DEFAULT_PRIVACY_EXCLUDED,
  originalFileWarning = DEFAULT_ORIGINAL_FILE_WARNING,
  originalFileDescription,
  originalFileLabel = "원본 GameFile JSON도 포함",
  previewIncludedLabel = "원본 포함",
  metadataMailto,
}: GameBugReportDialogProps<TContext>) {
  const [symptom, setSymptom] = useState("");
  const [includeOriginal, setIncludeOriginal] = useState(false);
  const [feedback, setFeedback] = useState<DeliveryFeedback>();
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = `game-bug-report-title-${useId().replace(/:/g, "")}`;
  const classFor = (part: string) => `gameBugReport${part} ${theme.classPrefix}BugReport${part}`;
  const report = useMemo(
    () => builder({
      gameFile,
      symptom,
      environment,
      reproductionContext,
      includeOriginalGameFile: includeOriginal,
    }),
    [builder, environment, gameFile, includeOriginal, reproductionContext, symptom],
  );
  const mailtoUrl = useMemo(() => bugReportMailto(recipient, report), [recipient, report]);
  const metadataMailtoUrl = useMemo(
    () => metadataMailto?.(recipient, report) ?? defaultMetadataMailto(recipient, report, scriptName),
    [metadataMailto, recipient, report, scriptName],
  );
  const emailAvailability = bugReportEmailAvailability(recipient, mailtoUrl);
  const recoveryReason: RecoveryReason = feedback === "emailFailed" ? "emailFailed" : emailAvailability;
  const needsRecovery = recoveryReason !== "ready";
  const eventCount = typeof report.reproductionContext.eventCount === "number"
    ? report.reproductionContext.eventCount
    : report.metadata.eventCount;

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

  function updateSymptom(value: string) {
    setSymptom(value);
    setFeedback(undefined);
  }

  function updateOriginalJson(checked: boolean) {
    setIncludeOriginal(checked);
    setFeedback(undefined);
  }

  function openEmail() {
    if (recoveryReason !== "ready" && recoveryReason !== "oversized") return;
    try {
      delivery.openEmail(recoveryReason === "oversized" ? metadataMailtoUrl : mailtoUrl);
    } catch {
      setFeedback("emailFailed");
    }
  }

  async function copyReport() {
    try {
      await delivery.copyReport(report.body);
      setFeedback("copied");
    } catch {
      setFeedback("copyFailed");
    }
  }

  function downloadReport() {
    try {
      delivery.downloadReport(
        report.attachmentJson,
        `${downloadPrefix}${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
      );
      setFeedback("downloaded");
    } catch {
      setFeedback("downloadFailed");
    }
  }

  return (
    <div
      className={classFor("Backdrop")}
      data-theme={theme.id}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section
        ref={dialogRef}
        className={classFor("Dialog")}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-theme={theme.id}
        data-script-id={scriptId}
        data-report-type={report.reportType}
        data-report-schema-version={String(report.reportSchemaVersion ?? report.metadata.reportSchemaVersion)}
        data-report-subject={report.subject}
        data-filename-prefix={downloadPrefix}
      >
        <header>
          <div>
            {showBrandName ? <span>{scriptName}</span> : null}
            <h2 id={titleId}>버그 제보</h2>
          </div>
          <button ref={closeRef} type="button" aria-label="버그 제보 닫기" onClick={onClose}>×</button>
        </header>
        <div className={classFor("Body")}>
          <label className={classFor("Description")}>
            <span>무슨 문제가 있었나요?</span>
            <textarea rows={3} value={symptom} onChange={(event) => updateSymptom(event.target.value)} />
          </label>

          <section className={classFor("Privacy")} aria-label="제보 데이터 안내">
            <div><span aria-hidden="true">✓</span><p><strong>포함</strong> {privacyIncluded}</p></div>
            <div><span aria-hidden="true">−</span><p><strong>제외</strong> {privacyExcluded}</p></div>
          </section>

          <details className={classFor("Preview")}>
            <summary>
              <span>{recoveryReason === "oversized" ? "보고서 파일 미리보기" : "전송 내용 미리보기"}</span>
              <small>{includeOriginal ? previewIncludedLabel : "이름 제거됨"} · {eventCount} events</small>
            </summary>
            <pre data-preview-content="true">{recoveryReason === "oversized" ? report.attachmentJson : report.body}</pre>
          </details>

          <details className={classFor("Original")}>
            <summary>저장·불러오기 문제인가요?</summary>
            <label>
              <input type="checkbox" checked={includeOriginal} onChange={(event) => updateOriginalJson(event.target.checked)} />
              <span>{originalFileLabel}</span>
            </label>
            <p>{originalFileWarning}{originalFileDescription ? ` ${originalFileDescription}` : ""}</p>
          </details>

          {needsRecovery ? <RecoveryNotice reason={recoveryReason} className={classFor("Recovery")} /> : null}
          {feedback === "copied" ? <p className={classFor("Success")} role="status">보고서를 클립보드에 복사했습니다.</p> : null}
          {feedback === "downloaded" ? <p className={classFor("Success")} role="status">보고서 파일을 저장했습니다.</p> : null}
          {feedback === "copyFailed" ? <p className={classFor("Failure")} role="alert">보고서를 복사하지 못했습니다. 파일로 저장해 주세요.</p> : null}
          {feedback === "downloadFailed" ? <p className={classFor("Failure")} role="alert">보고서 파일을 저장하지 못했습니다. 다시 시도해 주세요.</p> : null}
        </div>
        <footer>
          <button type="button" onClick={onClose}>취소</button>
          {recoveryReason === "oversized" ? (
            <>
              <button type="button" onClick={downloadReport}>보고서 파일 저장</button>
              <button type="button" className="primary" onClick={openEmail}>메일 전송</button>
            </>
          ) : (
            needsRecovery ? (
              <>
                <button type="button" onClick={downloadReport}>파일 저장</button>
                <button type="button" onClick={() => void copyReport()}>보고서 복사</button>
              </>
            ) : <button type="button" className="primary" onClick={openEmail}>이메일 작성</button>
          )}
        </footer>
      </section>
    </div>
  );
}

function RecoveryNotice({ reason, className }: { reason: RecoveryReason; className: string }) {
  const title = reason === "oversized"
    ? "이메일 본문으로 보내기에는 보고서가 깁니다."
    : reason === "recipientMissing"
      ? "제보 이메일 주소가 설정되지 않았습니다."
      : "메일 앱을 열지 못했습니다.";
  return (
    <div className={className} role="status">
      <strong>{title}</strong>
      <p>{reason === "oversized"
        ? "보고서 파일을 저장한 뒤, 메일로 전송 부탁드립니다."
        : "내용은 그대로 유지했습니다. 보고서를 복사하거나 파일로 저장해 첨부하세요."}</p>
    </div>
  );
}

function defaultMetadataMailto<TContext extends BugReportContext>(
  recipient: string,
  report: BugReportResult<TContext>,
  scriptName: string,
) {
  const metadata = report.metadata;
  const body = [
    `# ${scriptName} 버그 제보`,
    "",
    "저장한 JSON 보고서 파일을 이 메일에 첨부해 주세요.",
    "",
    "[메타데이터]",
    `reportSchemaVersion: ${metadata.reportSchemaVersion}`,
    `schemaVersion: ${metadata.schemaVersion}`,
    `scriptId: ${metadata.scriptId}`,
    `appVersion: ${metadata.appVersion}`,
    `buildCommit: ${metadata.buildCommit}`,
    `pageUrl: ${metadata.pageUrl}`,
    `viewport: ${metadata.viewport}`,
    `gameUpdatedAt: ${metadata.gameUpdatedAt}`,
    `eventCount: ${metadata.eventCount}`,
  ].join("\n");
  return `mailto:${encodeURIComponent(recipient.trim())}?subject=${encodeURIComponent(report.subject)}&body=${encodeURIComponent(body)}`;
}

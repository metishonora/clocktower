import { useEffect, useMemo, useRef, useState } from "react";
import type { GameFile } from "../../core/types.js";
import {
  browserBugReportDelivery,
  bugReportEmailAvailability,
  bugReportMailto,
  bugReportMetadataMailto,
  type BugReportDelivery,
  type BugReportEmailAvailability,
} from "../../bugReportDelivery.js";
import {
  buildSectsAndVioletsBugReport,
  type SectsAndVioletsBugReportContextInput,
  type SectsAndVioletsBugReportEnvironment,
} from "../../sectsAndVioletsBugReport.js";
import "./sectsAndVioletsBugReport.css";

type DeliveryFeedback = "copied" | "copyFailed" | "downloaded" | "downloadFailed" | "emailFailed";

export function SectsAndVioletsBugReportDialog({
  gameFile,
  environment,
  reproductionContext,
  recipient,
  delivery = browserBugReportDelivery,
  onClose,
}: {
  gameFile: GameFile;
  environment: SectsAndVioletsBugReportEnvironment;
  reproductionContext: SectsAndVioletsBugReportContextInput;
  recipient: string;
  delivery?: BugReportDelivery;
  onClose: () => void;
}) {
  const [symptom, setSymptom] = useState("");
  const [includeOriginal, setIncludeOriginal] = useState(false);
  const [feedback, setFeedback] = useState<DeliveryFeedback>();
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const report = useMemo(() => buildSectsAndVioletsBugReport({
    gameFile,
    symptom,
    environment,
    reproductionContext,
    includeOriginalGameFile: includeOriginal,
  }), [environment, gameFile, includeOriginal, reproductionContext, symptom]);
  const mailtoUrl = useMemo(() => bugReportMailto(recipient, report), [recipient, report]);
  const metadataMailtoUrl = useMemo(
    () => bugReportMetadataMailto(recipient, report),
    [recipient, report],
  );
  const emailAvailability = bugReportEmailAvailability(recipient, mailtoUrl);
  const recoveryReason = feedback === "emailFailed" ? "emailFailed" : emailAvailability;
  const needsRecovery = recoveryReason !== "ready";

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
        `clocktower-snv-bug-report-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
      );
      setFeedback("downloaded");
    } catch {
      setFeedback("downloadFailed");
    }
  }

  return (
    <div className="snvBugReportBackdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="snvBugReportDialog" role="dialog" aria-modal="true" aria-labelledby="snv-bug-report-title">
        <header>
          <h2 id="snv-bug-report-title">버그 제보</h2>
          <button ref={closeRef} type="button" aria-label="버그 제보 닫기" onClick={onClose}>×</button>
        </header>
        <div className="snvBugReportBody">
          <label className="snvBugReportDescription">
            <span>무슨 문제가 있었나요?</span>
            <textarea rows={3} value={symptom} onChange={(event) => updateSymptom(event.target.value)} />
          </label>

          <section className="snvBugReportPrivacy" aria-label="제보 데이터 안내">
            <div><span aria-hidden="true">✓</span><p><strong>포함</strong> 좌석·직업·진영, 확정 이벤트와 이벤트 시간, 앱·기기 정보</p></div>
            <div><span aria-hidden="true">−</span><p><strong>제외</strong> 플레이어 이름과 Storyteller 메모</p></div>
          </section>

          <details className="snvBugReportPreview">
            <summary><span>{recoveryReason === "oversized" ? "보고서 파일 미리보기" : "전송 내용 미리보기"}</span><small>{includeOriginal ? "원본 포함" : "이름 제거됨"} · {gameFile.game.events.length} events</small></summary>
            <pre>{recoveryReason === "oversized" ? report.attachmentJson : report.body}</pre>
          </details>

          <details className="snvBugReportOriginal">
            <summary>저장·불러오기 문제인가요?</summary>
            <label><input type="checkbox" checked={includeOriginal} onChange={(event) => updateOriginalJson(event.target.checked)} /><span>원본 게임 JSON도 포함</span></label>
            <p>원본에는 플레이어 이름과 메모가 들어 있을 수 있습니다. 직렬화 또는 불러오기 문제를 제보할 때만 선택하세요.</p>
          </details>

          {needsRecovery ? <RecoveryNotice reason={recoveryReason} /> : null}
          {feedback === "copied" ? <p className="snvBugReportSuccess" role="status">보고서를 클립보드에 복사했습니다.</p> : null}
          {feedback === "downloaded" ? <p className="snvBugReportSuccess" role="status">보고서 파일을 저장했습니다.</p> : null}
          {feedback === "copyFailed" ? <p className="snvBugReportFailure" role="alert">보고서를 복사하지 못했습니다. 파일로 저장해 주세요.</p> : null}
          {feedback === "downloadFailed" ? <p className="snvBugReportFailure" role="alert">보고서 파일을 저장하지 못했습니다. 다시 시도해 주세요.</p> : null}
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

function RecoveryNotice({ reason }: { reason: BugReportEmailAvailability | "emailFailed" }) {
  const title = reason === "oversized"
    ? "이메일 본문으로 보내기에는 보고서가 깁니다."
    : reason === "recipientMissing"
      ? "제보 이메일 주소가 설정되지 않았습니다."
      : "메일 앱을 열지 못했습니다.";
  return (
    <div className="snvBugReportRecovery" role="status">
      <strong>{title}</strong>
      <p>{reason === "oversized"
        ? "보고서 파일을 저장한 뒤, 메일로 전송 부탁드립니다."
        : "내용은 그대로 유지했습니다. 보고서를 복사하거나 파일로 저장해 첨부하세요."}</p>
    </div>
  );
}

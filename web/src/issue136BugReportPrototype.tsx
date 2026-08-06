import { useEffect, useRef, useState } from "react";
import "./sectsAndVioletsFoundationPrototype.css";
import "./issue136BugReportPrototype.css";

type ReviewState = "ready" | "oversized" | "copied";

const previewReport = `# Clocktower S&V 버그 제보

[사용자 제보]
문제 설명:
2일차 밤에 꿈꾸는 자 정보를 확인한 뒤 진행 버튼이 비활성화되었습니다.

[환경]
reportSchemaVersion: 2
schemaVersion: 3
scriptId: sectsAndViolets
viewport: 1024x1366

[개인정보 처리]
게임 이름 및 플레이어 이름 대체됨 · Storyteller 메모 제거됨

[재현 컨텍스트]
\`\`\`json
{"activeTab":"play","replayPhase":"night","currentStepId":"night2:dreamer","currentStepType":"character","eventCount":6}
\`\`\`

[재현 Fixture]
\`\`\`json
{"schemaVersion":3,"game":{"scriptId":"sectsAndViolets","id":"game-136","name":"Redacted bug report","createdAt":"2026-08-06T10:00:00.000Z","updatedAt":"2026-08-06T10:30:00.000Z","events":[{"id":"event-1","type":"setupConfirmed","phase":"setup","payload":{"players":[{"id":"player-1","seat":1,"name":"1번 플레이어","actualCharacter":"philosopher"}]},"summary":"초기 설정 확정","createdAt":"2026-08-06T10:00:00.000Z"}]}}
\`\`\``;

const events = [
  "초기 설정 확정: 7명",
  "철학자 단계 처리 완료",
  "하수인 정보 공개 완료",
  "악마 정보 공개 완료",
  "꿈꾸는 자: 3번 서준 → 5번 지우",
  "1일차 낮 시작",
];

export function Issue136BugReportPrototype() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reviewState, setReviewState] = useState<ReviewState>("ready");
  const [isDay, setIsDay] = useState(true);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function openDialog(state: ReviewState = "ready") {
    setReviewState(state);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  return (
    <main className={`snvFoundationPrototype issue136Prototype ${isDay ? "snvDayMode" : ""}`}>
      <a className="snvScriptHomeLink" href="/clocktower/" aria-label="스크립트 선택으로 돌아가기">←</a>
      <header className="snvPrototypeHeader">
        <div>
          <span className="snvEyebrow">SECTS &amp; VIOLETS</span>
          <h1>섹츠 앤 바이올렛</h1>
          <p>Storyteller Console · 7명</p>
        </div>
        <span className="snvPhaseMark" aria-label="2일차 낮">Ⅱ</span>
      </header>

      <aside className="issue136ReviewBar" aria-label="프로토타입 검토 컨트롤">
        <div><strong>ISSUE #136 · REVIEW</strong><span>production 화면 밖의 검토 도구</span></div>
        <div>
          <button type="button" aria-pressed={isDay} onClick={() => setIsDay(true)}>낮</button>
          <button type="button" aria-pressed={!isDay} onClick={() => setIsDay(false)}>밤</button>
          <button type="button" onClick={() => openDialog("ready")}>기본 dialog</button>
          <button type="button" onClick={() => openDialog("oversized")}>긴 보고서</button>
          <button type="button" onClick={() => openDialog("copied")}>복사 완료</button>
        </div>
      </aside>

      <nav className="snvUtilityTabs" aria-label="게임 관리">
        <button type="button" className="snvNewGameTab">새 게임</button>
        <button type="button" className="snvStorageTab active">저장 / 불러오기</button>
        <button ref={triggerRef} type="button" className="issue136ReportTrigger" onClick={() => openDialog()}>버그 제보</button>
      </nav>
      <p className="snvAutosaveStatus">자동 저장 완료 14:32:18</p>
      <nav className="snvSurfaceTabs" aria-label="S&V 화면">
        <button type="button">직업 선택</button><button type="button">마도서</button><button type="button">진행</button>
      </nav>

      <section className="issue136StorageSurface snvTabPanel" aria-label="저장 및 불러오기">
        <div className="issue136StorageActions">
          <article><span>현재 게임</span><h2>JSON 내보내기</h2><button type="button">export JSON</button></article>
          <article><span>저장된 게임</span><h2>JSON 가져오기</h2><button type="button">import JSON</button></article>
        </div>
        <article className="issue136EventLog">
          <header><div><span>CANONICAL HISTORY</span><h2>이벤트 로그</h2></div><strong>{events.length} events</strong></header>
          <ol>{events.map((event, index) => <li key={event}><span>{String(index + 1).padStart(2, "0")}</span><p>{event}</p></li>)}</ol>
        </article>
      </section>

      {dialogOpen ? <BugReportDialog state={reviewState} onClose={closeDialog} /> : null}
    </main>
  );
}

function BugReportDialog({
  state,
  onClose,
}: {
  state: ReviewState;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [includeOriginal, setIncludeOriginal] = useState(false);

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
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
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

  return (
    <div className="issue136DialogBackdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="issue136Dialog" role="dialog" aria-modal="true" aria-labelledby="issue136-title">
        <header>
          <h2 id="issue136-title">버그 제보</h2>
          <button ref={closeRef} type="button" aria-label="버그 제보 닫기" onClick={onClose}>×</button>
        </header>
        <div className="issue136DialogBody">
          <label>
            <span>무슨 문제가 있었나요?</span>
            <textarea rows={3} defaultValue="2일차 밤에 꿈꾸는 자 정보를 확인한 뒤 진행 버튼이 비활성화되었습니다." />
          </label>

          <section className="issue136PrivacySummary" aria-label="제보 데이터 안내">
            <div><span aria-hidden="true">✓</span><p><strong>포함</strong> 좌석·직업·진영, 확정 이벤트와 이벤트 시간, 앱·기기 정보</p></div>
            <div><span aria-hidden="true">−</span><p><strong>제외</strong> 플레이어 이름과 Storyteller 메모</p></div>
          </section>

          <details className="issue136Preview">
            <summary><span>{state === "oversized" ? "보고서 파일 미리보기" : "전송 내용 미리보기"}</span><small>이름 제거됨 · {events.length} events</small></summary>
            <pre>{previewReport}</pre>
          </details>

          <details className="issue136OriginalJson">
            <summary>저장·불러오기 문제인가요?</summary>
            <label><input type="checkbox" checked={includeOriginal} onChange={(event) => setIncludeOriginal(event.target.checked)} /><span>원본 게임 JSON도 포함</span></label>
            <p>원본에는 플레이어 이름과 메모가 들어 있을 수 있습니다. 직렬화 또는 불러오기 문제를 제보할 때만 선택하세요.</p>
          </details>

          {state === "oversized" ? (
            <div className="issue136Recovery" role="status"><strong>이메일 본문으로 보내기에는 보고서가 깁니다.</strong><p>보고서 파일을 저장한 뒤, 메일로 전송 부탁드립니다.</p></div>
          ) : state === "copied" ? (
            <div className="issue136Copied" role="status">보고서를 클립보드에 복사했습니다.</div>
          ) : null}
        </div>
        <footer>
          <button type="button" onClick={onClose}>취소</button>
          {state === "oversized" ? <><button type="button">보고서 파일 저장</button><button type="button" className="primary">메일 전송</button></> : <button type="button" className="primary">이메일 작성</button>}
        </footer>
      </section>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import "./manualTokensNotesPrototype.css";

type Scenario = "normal" | "voting" | "automatic" | "failure" | "busy";
type SystemTokenId = "drunk" | "poisoned" | "protected" | "noAbility" | "abilitySpent" | "needsFollowUp";

type ScriptTokenRef = {
  id: string;
  character: string;
  label: string;
};

type PrototypePlayer = {
  id: string;
  seat: number;
  name: string;
  character: string;
  alignment: "good" | "evil";
  automaticTokens: string[];
  systemTokenIds: SystemTokenId[];
  scriptTokenIds: string[];
  notes: string;
};

type AnnotationDraft = Pick<PrototypePlayer, "systemTokenIds" | "scriptTokenIds" | "notes">;

const systemTokens: Array<{ id: SystemTokenId; label: string }> = [
  { id: "drunk", label: "술취함" },
  { id: "poisoned", label: "중독" },
  { id: "protected", label: "보호" },
  { id: "noAbility", label: "능력 없음" },
  { id: "abilitySpent", label: "능력 소모" },
  { id: "needsFollowUp", label: "후속 처리" },
];

const scriptTokens: ScriptTokenRef[] = [
  { id: "butler:master", character: "집사", label: "주인" },
  { id: "drunk:isTheDrunk", character: "술꾼", label: "술꾼임" },
  { id: "fortuneTeller:redHerring", character: "점쟁이", label: "오답 대상" },
  { id: "imp:dead", character: "임프", label: "사망" },
  { id: "investigator:minion", character: "조사관", label: "하수인" },
  { id: "investigator:wrong", character: "조사관", label: "오답" },
  { id: "librarian:outsider", character: "사서", label: "이방인" },
  { id: "librarian:wrong", character: "사서", label: "오답" },
  { id: "monk:safe", character: "수도사", label: "안전" },
  { id: "poisoner:poisoned", character: "독살자", label: "중독" },
  { id: "scarletWoman:isTheDemon", character: "붉은 여인", label: "악마임" },
  { id: "slayer:noAbility", character: "학살자", label: "능력 없음" },
  { id: "undertaker:diedToday", character: "장의사", label: "오늘 사망" },
  { id: "virgin:noAbility", character: "처녀", label: "능력 없음" },
  { id: "washerwoman:townsfolk", character: "세탁부", label: "마을 주민" },
  { id: "washerwoman:wrong", character: "세탁부", label: "오답" },
];

const initialPlayers: PrototypePlayer[] = [
  player("p1", 1, "민지", "세탁부"),
  player("p2", 2, "준호", "요리사"),
  player("p3", 3, "서연", "공감능력자"),
  { ...player("p4", 4, "도윤", "점쟁이"), automaticTokens: ["중독"] },
  { ...player("p5", 5, "하린", "수도사"), automaticTokens: ["보호"] },
  { ...player("p6", 6, "현우", "학살자"), systemTokenIds: ["abilitySpent"], notes: "능력 사용 확인" },
  { ...player("p7", 7, "유진", "독살자", "evil"), scriptTokenIds: ["poisoner:poisoned"] },
  player("p8", 8, "태오", "임프", "evil"),
];

export function ManualTokensNotesPrototype() {
  const [scenario, setScenario] = useState<Scenario>("normal");
  const [players, setPlayers] = useState(initialPlayers);
  const [editingPlayerId, setEditingPlayerId] = useState<string>();
  const [draft, setDraft] = useState<AnnotationDraft>();
  const [eventCount, setEventCount] = useState(0);
  const [voterIds, setVoterIds] = useState<string[]>([]);
  const [selectedSeatId, setSelectedSeatId] = useState<string>();
  const [error, setError] = useState<string>();
  const [latestSummary, setLatestSummary] = useState("낮 토론 시작");
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const longPressActivated = useRef(false);
  const editingPlayer = players.find((candidate) => candidate.id === editingPlayerId);
  const busy = scenario === "busy";

  function changeScenario(next: Scenario) {
    setScenario(next);
    setEditingPlayerId(undefined);
    setDraft(undefined);
    setError(undefined);
    setVoterIds([]);
    setSelectedSeatId(undefined);
  }

  function openEditor(playerId: string) {
    if (busy) return;
    const selected = players.find((candidate) => candidate.id === playerId);
    if (!selected) return;
    setEditingPlayerId(playerId);
    setDraft({
      systemTokenIds: [...selected.systemTokenIds],
      scriptTokenIds: [...selected.scriptTokenIds],
      notes: selected.notes,
    });
    setError(undefined);
  }

  function closeEditor() {
    setEditingPlayerId(undefined);
    setDraft(undefined);
    setError(undefined);
  }

  function confirmDraft() {
    if (!editingPlayer || !draft || !isChanged(editingPlayer, draft)) return;
    if (scenario === "failure") {
      setError("다른 이벤트가 먼저 확정되어 저장하지 못했습니다. 입력은 유지했습니다.");
      return;
    }
    const systemCount = draft.systemTokenIds.length;
    const scriptCount = draft.scriptTokenIds.length;
    setPlayers((current) => current.map((candidate) => (
      candidate.id === editingPlayer.id ? { ...candidate, ...draft } : candidate
    )));
    setEventCount((current) => current + 1);
    setLatestSummary(`${editingPlayer.seat}번 ${editingPlayer.name} · 수동 토큰 ${systemCount + scriptCount}개 · Notes ${draft.notes ? "수정" : "없음"}`);
    closeEditor();
  }

  function activateSeat(playerId: string) {
    if (longPressActivated.current) {
      longPressActivated.current = false;
      return;
    }
    if (scenario === "voting") {
      setVoterIds((current) => current.includes(playerId)
        ? current.filter((candidate) => candidate !== playerId)
        : [...current, playerId]);
      return;
    }
    setSelectedSeatId((current) => current === playerId ? undefined : playerId);
  }

  function startLongPress(event: PointerEvent<HTMLButtonElement>, playerId: string) {
    if (busy) return;
    longPressActivated.current = false;
    window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      longPressActivated.current = true;
      openEditor(playerId);
    }, 500);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function cancelLongPress() {
    window.clearTimeout(longPressTimer.current);
  }

  useEffect(() => () => window.clearTimeout(longPressTimer.current), []);

  return (
    <main className="annotationPrototype">
      <header className="annotationPrototypeHeader">
        <div>
          <p>PROTOTYPE · ISSUE #10</p>
          <h1>수동 토큰과 Player Notes</h1>
        </div>
        <nav aria-label="프로토타입 시나리오">
          <button className={scenario === "normal" ? "selected" : ""} type="button" onClick={() => changeScenario("normal")}>일반 진행</button>
          <button className={scenario === "voting" ? "selected" : ""} type="button" onClick={() => changeScenario("voting")}>투표 중</button>
          <button className={scenario === "automatic" ? "selected" : ""} type="button" onClick={() => changeScenario("automatic")}>자동 상태 비교</button>
          <button className={scenario === "failure" ? "selected" : ""} type="button" onClick={() => changeScenario("failure")}>확정 실패</button>
          <button className={scenario === "busy" ? "selected" : ""} type="button" onClick={() => changeScenario("busy")}>Reveal 보호</button>
        </nav>
      </header>

      <section className="annotationPrototypeWorkspace">
        <section className="annotationPrototypeGrimoire" aria-label="프로토타입 그리모어">
          <div className="annotationTableCenter">
            <span>{scenario === "voting" ? "투표 입력" : "낮 1일차"}</span>
            <strong>{scenario === "voting" ? `${voterIds.length}표` : "토론"}</strong>
            <small>{busy ? "Reveal 완료 대기" : "길게 눌러 편집"}</small>
          </div>
          {players.map((candidate, index) => {
            const angle = (360 / players.length) * index - 90;
            const position = {
              "--seat-x": `${50 + 38 * Math.cos((angle * Math.PI) / 180)}%`,
              "--seat-y": `${50 + 38 * Math.sin((angle * Math.PI) / 180)}%`,
              "--token-offset-x": `${-108 * Math.cos((angle * Math.PI) / 180)}px`,
              "--token-offset-y": `${-94 * Math.sin((angle * Math.PI) / 180)}px`,
            } as CSSProperties;
            const selected = voterIds.includes(candidate.id) || selectedSeatId === candidate.id;
            const manualBadges = annotationBadges(candidate);
            const automaticEdge = Math.cos((angle * Math.PI) / 180) < 0 ? "edgeLeft" : "edgeRight";
            return (
              <div
                className="annotationSeat"
                style={position}
                role="group"
                aria-label={`${candidate.seat}번 ${candidate.name} 좌석`}
                key={candidate.id}
              >
                <div className={`annotationSeatCard ${candidate.alignment} ${selected ? "selected" : ""} ${candidate.notes ? "hasNotes" : ""}`}>
                  <button
                    type="button"
                    className="annotationSeatMain"
                    aria-label={`${candidate.seat}번 ${candidate.name} ${scenario === "voting" ? "투표 선택" : "좌석 선택"}`}
                    aria-pressed={selected}
                    disabled={busy}
                    onClick={() => activateSeat(candidate.id)}
                    onPointerDown={(event) => startLongPress(event, candidate.id)}
                    onPointerUp={cancelLongPress}
                    onPointerCancel={cancelLongPress}
                    onPointerLeave={cancelLongPress}
                  >
                    <span>{candidate.seat}</span>
                    <strong>{candidate.name}</strong>
                    <small>{candidate.character}</small>
                    {candidate.notes ? <span className="annotationNotePreview" aria-label="Notes 미리보기">{candidate.notes}</span> : null}
                  </button>
                  <div className={`annotationAutomaticTokens ${automaticEdge}`}>
                    {candidate.automaticTokens.map((label) => (
                      <span className={`automatic ${automaticTokenClass(label)}`} key={`auto-${label}`}>{label}</span>
                    ))}
                  </div>
                </div>
                <div className="annotationManualTokens" aria-label="수동 토큰">
                  {manualBadges.slice(0, 2).map((badge) => (
                    <span className="manual prominent" aria-label={badge.accessibleLabel} key={badge.key}>{badge.label}</span>
                  ))}
                  {manualBadges.length > 2 ? <span className="manual prominent overflow">+{manualBadges.length - 2}</span> : null}
                </div>
              </div>
            );
          })}
        </section>

        <aside className="annotationPrototypeRail">
          <section className="annotationCurrentStep">
            <div><p>현재 단계</p><span>{busy ? "보호됨" : "진행 중"}</span></div>
            <h2>{scenario === "voting" ? "지명 투표" : "자유 토론"}</h2>
            {scenario === "voting" ? <strong>선택된 손 · {voterIds.length}명</strong> : <strong>현재 처형 후보 · 없음</strong>}
            <button type="button" disabled={busy}>확정</button>
          </section>

          <section className="annotationPrototypeLegend" aria-label="토큰 표시 구분">
            <p>표시 구분</p>
            <div><span className="automatic poisoned">중독</span><small>자동 규칙 상태</small></div>
            <div><span className="automatic protected">보호</span><small>자동 규칙 상태</small></div>
            <div><span className="manual prominent">후속 처리</span><small>카드 바깥 수동 토큰</small></div>
            <div><span className="noteSample">다음 낮 확인</span><small>카드 하단 Notes 미리보기</small></div>
          </section>

          <section className="annotationPrototypeLog" aria-label="프로토타입 이벤트 로그">
            <div><p>이벤트 로그</p><span>{14 + eventCount}건</span></div>
            <ol><li>낮 토론 시작</li>{eventCount ? <li>{latestSummary}</li> : null}</ol>
          </section>
        </aside>
      </section>

      <output data-testid="manual-tokens-notes-prototype-state" className="annotationPrototypeState">
        {JSON.stringify({
          scenario,
          eventCount,
          selectedPlayerId: editingPlayerId ?? null,
          selectedSeatId: selectedSeatId ?? null,
          voterIds,
          players: Object.fromEntries(players.map((candidate) => [candidate.id, candidate])),
        })}
      </output>

      {editingPlayer && draft ? (
        <AnnotationDialog
          player={editingPlayer}
          draft={draft}
          error={error}
          onDraft={setDraft}
          onCancel={closeEditor}
          onConfirm={confirmDraft}
        />
      ) : null}
    </main>
  );
}

function AnnotationDialog({ player: currentPlayer, draft, error, onDraft, onCancel, onConfirm }: {
  player: PrototypePlayer;
  draft: AnnotationDraft;
  error?: string;
  onDraft: (draft: AnnotationDraft) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const changed = isChanged(currentPlayer, draft);
  const dialogRef = useRef<HTMLElement>(null);
  const groupedScriptTokens = useMemo(() => {
    const groups = new Map<string, ScriptTokenRef[]>();
    scriptTokens.forEach((token) => groups.set(token.character, [...(groups.get(token.character) ?? []), token]));
    return [...groups.entries()];
  }, []);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  function toggleSystemToken(tokenId: SystemTokenId) {
    onDraft({
      ...draft,
      systemTokenIds: draft.systemTokenIds.includes(tokenId)
        ? draft.systemTokenIds.filter((candidate) => candidate !== tokenId)
        : [...draft.systemTokenIds, tokenId],
    });
  }

  function toggleScriptToken(tokenId: string) {
    onDraft({
      ...draft,
      scriptTokenIds: draft.scriptTokenIds.includes(tokenId)
        ? draft.scriptTokenIds.filter((candidate) => candidate !== tokenId)
        : [...draft.scriptTokenIds, tokenId],
    });
  }

  return (
    <div className="annotationDialogBackdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel();
    }}>
      <section ref={dialogRef} tabIndex={-1} className="annotationDialog" role="dialog" aria-modal="true" aria-label={`${currentPlayer.seat}번 ${currentPlayer.name} 토큰 및 Notes`}>
        <header>
          <div><span>{currentPlayer.seat}</span><div><p>{currentPlayer.character}</p><h2>{currentPlayer.name}</h2></div></div>
          <button type="button" aria-label="닫기" onClick={onCancel}>×</button>
        </header>

        {currentPlayer.automaticTokens.length ? (
          <section className="annotationAutomaticState" aria-label="자동 규칙 상태">
            <strong>자동 규칙 상태</strong>
            {currentPlayer.automaticTokens.map((label) => <span key={label}>{label}</span>)}
          </section>
        ) : null}

        <div className="annotationDialogContent">
          <fieldset>
            <legend>System Tokens</legend>
            <div className="annotationTokenGrid systemGrid">
              {systemTokens.map((token) => (
                <button
                  type="button"
                  aria-label={`System Token · ${token.label}`}
                  aria-pressed={draft.systemTokenIds.includes(token.id)}
                  className={draft.systemTokenIds.includes(token.id) ? "selected" : ""}
                  onClick={() => toggleSystemToken(token.id)}
                  key={token.id}
                >{token.label}</button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Script Tokens</legend>
            <div className="annotationScriptGroups">
              {groupedScriptTokens.map(([character, tokens]) => (
                <section key={character}>
                  <strong>{character}</strong>
                  <div>{tokens.map((token) => (
                    <button
                      type="button"
                      aria-label={`Script Token · ${token.character} · ${token.label}`}
                      aria-pressed={draft.scriptTokenIds.includes(token.id)}
                      className={draft.scriptTokenIds.includes(token.id) ? "selected" : ""}
                      onClick={() => toggleScriptToken(token.id)}
                      key={token.id}
                    >{token.label}</button>
                  ))}</div>
                </section>
              ))}
            </div>
          </fieldset>

          <label className="annotationNotesField">
            <span><strong>Notes</strong><small>{draft.notes.length} / 1,000</small></span>
            <textarea
              aria-label="Notes"
              maxLength={1000}
              rows={4}
              value={draft.notes}
              onChange={(event) => onDraft({ ...draft, notes: event.target.value })}
              placeholder="이 플레이어에게만 필요한 운영 메모"
            />
          </label>
          {error ? <p className="annotationDialogError" role="alert">{error}</p> : null}
        </div>

        <footer>
          <span>{changed ? "변경 사항 있음" : "변경 사항 없음"}</span>
          <div><button type="button" onClick={onCancel}>취소</button><button type="button" disabled={!changed} onClick={onConfirm}>수정 확정</button></div>
        </footer>
      </section>
    </div>
  );
}

function annotationBadges(candidate: PrototypePlayer) {
  return [
    ...candidate.systemTokenIds.map((tokenId) => ({
      key: `system-${tokenId}`,
      label: systemTokens.find((token) => token.id === tokenId)?.label ?? tokenId,
      accessibleLabel: `수동 System Token · ${systemTokens.find((token) => token.id === tokenId)?.label ?? tokenId}`,
    })),
    ...candidate.scriptTokenIds.map((tokenId) => {
      const token = scriptTokens.find((candidateToken) => candidateToken.id === tokenId);
      return {
        key: `script-${tokenId}`,
        label: token?.label ?? tokenId,
        accessibleLabel: token ? `수동 Script Token · ${token.character} · ${token.label}` : `수동 Script Token · ${tokenId}`,
      };
    }),
  ];
}

function automaticTokenClass(label: string) {
  if (label === "중독") return "poisoned";
  if (label === "보호") return "protected";
  return "automaticGeneric";
}

function isChanged(currentPlayer: PrototypePlayer, draft: AnnotationDraft) {
  return currentPlayer.notes !== draft.notes
    || currentPlayer.systemTokenIds.join("|") !== draft.systemTokenIds.join("|")
    || currentPlayer.scriptTokenIds.join("|") !== draft.scriptTokenIds.join("|");
}

function player(id: string, seat: number, name: string, character: string, alignment: "good" | "evil" = "good"): PrototypePlayer {
  return { id, seat, name, character, alignment, automaticTokens: [], systemTokenIds: [], scriptTokenIds: [], notes: "" };
}

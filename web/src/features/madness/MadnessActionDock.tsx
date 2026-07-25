import { useEffect, useState, type CSSProperties } from "react";
import type { MadnessAssignmentState, MadnessCheckResult, Player } from "../../core/types";
import { sectsAndVioletsCharacterAsset } from "../../sectsAndVioletsCharacterAssets";
import { sectsAndVioletsCharacters } from "../../sectsAndVioletsCharacters";
import "./madnessActionDock.css";

export function MadnessActionDock({
  players,
  assignments,
  phaseLabel,
  theme,
  precedingActionCount,
  busy,
  onRecord,
  onExecute,
}: {
  players: Player[];
  assignments: MadnessAssignmentState[];
  phaseLabel: string;
  theme: "day" | "night";
  precedingActionCount: number;
  busy: boolean;
  onRecord: (assignmentId: string, result: MadnessCheckResult) => void;
  onExecute: (assignmentId: string) => void;
}) {
  const [activeId, setActiveId] = useState<string>();
  const [confirmingId, setConfirmingId] = useState<string>();
  const active = assignments.find((assignment) => assignment.assignmentId === activeId);
  const confirming = assignments.find((assignment) => assignment.assignmentId === confirmingId);

  useEffect(() => {
    if (activeId && !assignments.some((assignment) => assignment.assignmentId === activeId)) {
      setActiveId(undefined);
    }
    if (confirmingId && !assignments.some((assignment) => assignment.assignmentId === confirmingId)) {
      setConfirmingId(undefined);
    }
  }, [activeId, assignments, confirmingId]);

  if (assignments.length === 0) return null;

  const dockActionCount = Math.max(0, precedingActionCount);
  const dockStyle = {
    "--snv-madness-dock-offset": `${dockActionCount * 62}px`,
    "--snv-madness-mobile-dock-offset": `${dockActionCount * 58}px`,
  } as CSSProperties;

  return (
    <>
      {active ? (
        <MadnessPanel
          assignment={active}
          players={players}
          phaseLabel={phaseLabel}
          theme={theme}
          busy={busy}
          onRecord={onRecord}
          onExecute={() => setConfirmingId(active.assignmentId)}
          onClose={() => setActiveId(undefined)}
        />
      ) : null}
      <div className={`snvMadnessDock ${theme}`} style={dockStyle} aria-label="집착 확인 자유 행동">
        {assignments.map((assignment) => {
          const target = playerById(players, assignment.targetPlayerId);
          const sourceLabel = assignment.sourceCharacterId === "mutant" ? "변종" : "세레노버스";
          const asset = sectsAndVioletsCharacterAsset(assignment.sourceCharacterId);
          const selected = assignment.assignmentId === activeId;
          return (
            <button
              key={assignment.assignmentId}
              type="button"
              className={`${selected ? "selected " : ""}${assignment.status === "violated" ? "violated" : ""}`}
              aria-label={`${sourceLabel} 집착 확인 ${selected ? "닫기" : "열기"}, ${playerLabel(target)}`}
              aria-expanded={selected}
              disabled={busy}
              onClick={() => setActiveId(selected ? undefined : assignment.assignmentId)}
            >
              {selected ? <span aria-hidden="true">×</span> : asset ? <img src={asset.src} alt="" /> : sourceLabel.slice(0, 1)}
              {assignment.status === "violated" ? <i aria-label="위반">!</i> : null}
            </button>
          );
        })}
      </div>
      {confirming ? (
        <MadnessExecutionDialog
          assignment={confirming}
          target={playerById(players, confirming.targetPlayerId)}
          theme={theme}
          busy={busy}
          onCancel={() => setConfirmingId(undefined)}
          onConfirm={() => {
            setConfirmingId(undefined);
            onExecute(confirming.assignmentId);
          }}
        />
      ) : null}
    </>
  );
}

function MadnessPanel({
  assignment,
  players,
  phaseLabel,
  theme,
  busy,
  onRecord,
  onExecute,
  onClose,
}: {
  assignment: MadnessAssignmentState;
  players: Player[];
  phaseLabel: string;
  theme: "day" | "night";
  busy: boolean;
  onRecord: (assignmentId: string, result: MadnessCheckResult) => void;
  onExecute: () => void;
  onClose: () => void;
}) {
  const target = playerById(players, assignment.targetPlayerId);
  const targetLabel = playerLabel(target);
  const mutant = assignment.sourceCharacterId === "mutant";
  const requiredCharacter = characterLabel(assignment.requiredCharacterId);
  const statusLabel = assignment.status === "violated" ? "위반 발견"
    : assignment.status === "clear" ? "위반 없음"
      : "확인 전";

  return (
    <section className={`snvMadnessPanel ${theme}`} aria-label={`${targetLabel} 집착 확인`}>
      <header>
        <div>
          <span>{phaseLabel} · {mutant ? "변종" : "세레노버스"}</span>
          <h2>{mutant ? `${targetLabel} 외지인 집착 확인` : `${targetLabel} 집착 확인`}</h2>
        </div>
        <button type="button" aria-label="집착 확인 닫기" onClick={onClose}>×</button>
      </header>
      <p className="snvMadnessQuestion">
        {mutant
          ? `${targetLabel}이 외지인임을 주장하며 집착하였나요?`
          : `${targetLabel}이 ${requiredCharacter}에 충분히 집착하였나요?`}
      </p>
      <div className="snvMadnessStatus" data-status={assignment.status}>
        <span>현재 상태</span><strong>{statusLabel}</strong>
      </div>
      <div className="snvMadnessResults">
        {mutant ? (
          <>
            <button type="button" className="violation" disabled={busy || !assignment.canCheck} onClick={() => onRecord(assignment.assignmentId, "violation")}>외지인임을 집착함</button>
            <button type="button" disabled={busy || !assignment.canCheck} onClick={() => onRecord(assignment.assignmentId, "clear")}>위반 없음</button>
          </>
        ) : (
          <>
            <button type="button" disabled={busy || !assignment.canCheck} onClick={() => onRecord(assignment.assignmentId, "clear")}>충분히 집착함</button>
            <button type="button" className="violation" disabled={busy || !assignment.canCheck} onClick={() => onRecord(assignment.assignmentId, "violation")}>충분히 집착하지 않음</button>
          </>
        )}
      </div>
      {!assignment.sourceEffective ? <p className="snvMadnessUnavailable">능력 효력이 없어 처형할 수 없습니다.</p> : null}
      {assignment.status === "violated" ? (
        <button type="button" className="snvMadnessExecute" disabled={busy || !assignment.canExecute} onClick={onExecute}>{targetLabel} 처형</button>
      ) : null}
    </section>
  );
}

function MadnessExecutionDialog({ assignment, target, theme, busy, onCancel, onConfirm }: {
  assignment: MadnessAssignmentState;
  target?: Player;
  theme: "day" | "night";
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const targetLabel = playerLabel(target);
  return (
    <div className="snvMadnessDialogBackdrop">
      <section className={`snvMadnessDialog ${theme}`} role="alertdialog" aria-modal="true" aria-label={`${targetLabel} 처형 확인`}>
        <span>{assignment.sourceCharacterId === "mutant" ? "변종" : "세레노버스"} 집착 위반</span>
        <h2>{targetLabel}을 처형할까요?</h2>
        <p>처형을 확정하면 현재 진행이 중단됩니다. 사망은 다음 단계에서 별도로 확인합니다.</p>
        <div>
          <button type="button" disabled={busy} onClick={onCancel}>취소</button>
          <button type="button" className="destructive" disabled={busy} onClick={onConfirm}>처형 확정</button>
        </div>
      </section>
    </div>
  );
}

function playerById(players: Player[], playerId: string): Player | undefined {
  return players.find((player) => player.id === playerId);
}

function playerLabel(player?: Player): string {
  return player ? `[${player.seat}번 ${player.name}]` : "[대상 없음]";
}

function characterLabel(characterId?: string): string {
  return sectsAndVioletsCharacters.find((character) => character.id === characterId)?.name ?? characterId ?? "선택한 캐릭터";
}

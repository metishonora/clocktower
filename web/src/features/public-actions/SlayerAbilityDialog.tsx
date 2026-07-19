import { useEffect, useRef, useState } from "react";
import type { Player, UseSlayerAbilityPayload } from "../../core/types";
import { characterLabel } from "../../setupDraft";

export function SlayerAbilityDialog({ actor, players, busy, onClose, onConfirm }: {
  actor: Player; players: Player[]; busy: boolean; onClose: () => void;
  onConfirm: (targetPlayerId: string, registration: UseSlayerAbilityPayload["targetRegistration"]) => void;
}) {
  const [targetId, setTargetId] = useState<string>();
  const [recluseDecision, setRecluseDecision] = useState<"canonical" | "demon">();
  const dialogRef = useRef<HTMLDivElement>(null);
  const target = players.find((player) => player.id === targetId);
  const ready = Boolean(target && (target.actualCharacter !== "recluse" || recluseDecision));

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !dialogRef.current) return;
      const controls = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled])')];
      if (!controls.length) return;
      const first = controls[0]; const last = controls.at(-1)!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [onClose]);

  return (
    <div
      className="slayerDialogBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div ref={dialogRef} className="slayerDialog" role="dialog" aria-modal="true" aria-label="처단자 능력 사용">
        <header>
          <div><small>공개 능력</small><h2>처단자 능력 사용</h2></div>
          <button type="button" aria-label="닫기" onClick={onClose}>×</button>
        </header>

        <div className="slayerActor">
          <span aria-hidden="true">S</span>
          <div><small>행동자</small><strong>{actor.seat}번 {actor.name} · {characterLabel(actor.actualCharacter)}</strong></div>
        </div>

        <fieldset className="slayerTargets">
          <legend>대상</legend>
          <div>
            {players.map((player) => (
              <button
                type="button"
                key={player.id}
                className={`${player.id === targetId ? "selected" : ""} ${player.alive ? "" : "dead"}`}
                aria-label={`${player.seat}번 ${player.name}${player.alive ? "" : " · 사망"}`}
                aria-pressed={player.id === targetId}
                onClick={() => { setTargetId(player.id); setRecluseDecision(undefined); }}
              >
                <span>{player.seat}</span><strong>{player.name}</strong>{player.alive ? null : <small>사망</small>}
              </button>
            ))}
          </div>
        </fieldset>

        {target?.actualCharacter === "recluse" ? (
          <fieldset className="slayerRegistration">
            <legend>이번 판정의 은둔자 등록</legend>
            <button type="button" className={recluseDecision === "canonical" ? "selected" : ""} aria-pressed={recluseDecision === "canonical"} onClick={() => setRecluseDecision("canonical")}>악마로 등록하지 않음</button>
            <button type="button" className={recluseDecision === "demon" ? "selected" : ""} aria-pressed={recluseDecision === "demon"} onClick={() => setRecluseDecision("demon")}>악마로 등록</button>
          </fieldset>
        ) : null}

        <div className="slayerReview">
          <small>확정할 행동</small>
          <strong>{target ? `${actor.seat}번 ${actor.name} → ${target.seat}번 ${target.name}` : "대상을 선택하세요"}</strong>
          {target?.actualCharacter === "recluse" && recluseDecision ? (
            <span>{recluseDecision === "demon" ? "은둔자 · 악마로 등록" : "은둔자 · 악마로 등록하지 않음"}</span>
          ) : null}
        </div>
        <p className="slayerWarning">확정하면 결과와 관계없이 이 플레이어의 능력이 소모됩니다.</p>
        <footer>
          <button type="button" onClick={onClose}>취소</button>
          <button
            type="button"
            className="primaryButton"
            disabled={!ready || busy}
            onClick={() => target && onConfirm(target.id, recluseDecision === "demon" ? { kind: "recluseAsDemon", registeredCharacterId: "imp" } : { kind: "canonical" })}
          >
            처단자 사용 확정
          </button>
        </footer>
      </div>
    </div>
  );
}

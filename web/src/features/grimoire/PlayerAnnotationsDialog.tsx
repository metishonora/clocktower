import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type {
  CoreResult,
  Player,
  PlayerAnnotationsInput,
  Proposal,
  ScriptTokenRef,
  SystemTokenId,
} from "../../core/types";
import { CharacterIcon } from "../../components/CharacterIcon";
import { CharacterRulesButton } from "../../components/CharacterRulesCard";
import { characterLabel } from "../../setupDraft";
import { sameScriptToken, scriptTokens, systemTokens } from "./playerAnnotations";

export function PlayerAnnotationsDialog({
  player,
  busy,
  onCancel,
  onConfirm,
}: {
  player: Player;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (playerId: string, annotations: PlayerAnnotationsInput) => Promise<CoreResult<Proposal> | undefined>;
}) {
  const [draft, setDraft] = useState<PlayerAnnotationsInput>(() => ({
    systemTokenIds: [...player.systemTokenIds],
    scriptTokens: player.scriptTokens.map((token) => ({ ...token })),
    notes: player.notes,
  }));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [rulesOpen, setRulesOpen] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const groupedScriptTokens = useMemo(() => {
    const groups = new Map<string, typeof scriptTokens>();
    scriptTokens.forEach((token) => groups.set(token.character, [...(groups.get(token.character) ?? []), token]));
    return [...groups.entries()];
  }, []);
  const changed = player.notes !== draft.notes
    || player.systemTokenIds.join("|") !== draft.systemTokenIds.join("|")
    || JSON.stringify(player.scriptTokens) !== JSON.stringify(draft.scriptTokens);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending && !rulesOpen) onCancel();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, pending, rulesOpen]);

  function toggleSystemToken(tokenId: SystemTokenId) {
    setDraft((current) => ({
      ...current,
      systemTokenIds: current.systemTokenIds.includes(tokenId)
        ? current.systemTokenIds.filter((candidate) => candidate !== tokenId)
        : [...current.systemTokenIds, tokenId],
    }));
    setError(undefined);
  }

  function toggleScriptToken(token: ScriptTokenRef) {
    setDraft((current) => ({
      ...current,
      scriptTokens: current.scriptTokens.some((candidate) => sameScriptToken(candidate, token))
        ? current.scriptTokens.filter((candidate) => !sameScriptToken(candidate, token))
        : [...current.scriptTokens, { characterId: token.characterId, tokenId: token.tokenId }],
    }));
    setError(undefined);
  }

  async function confirm() {
    if (!changed || pending || busy) return;
    setPending(true);
    setError(undefined);
    const result = await onConfirm(player.id, draft);
    setPending(false);
    if (result?.ok) {
      onCancel();
      return;
    }
    setError(result?.error.messageKo ?? "현재 상태에서는 플레이어 표시를 수정할 수 없습니다.");
  }

  return createPortal(
    <div className="playerAnnotationsBackdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !pending) onCancel();
    }}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="playerAnnotationsDialog"
        role="dialog"
        aria-modal="true"
        aria-label={`${player.seat}번 ${player.name} 토큰 및 Notes`}
      >
        <header>
          <CharacterIcon characterId={player.actualCharacter} className="playerAnnotationsCharacterIcon" />
          <div className="playerAnnotationsIdentity">
            <h2>{player.name}</h2>
            <div className="playerAnnotationsMeta">
              <span>좌석 {player.seat}</span>
              <i aria-hidden="true" />
              <strong>{characterLabel(player.actualCharacter)}</strong>
              <CharacterRulesButton
                characterId={player.actualCharacter}
                className="playerAnnotationsRulesButton"
                ariaLabel={`${characterLabel(player.actualCharacter)} 세부 규칙 보기`}
                onOpenChange={setRulesOpen}
              />
            </div>
          </div>
          <button className="playerAnnotationsClose" type="button" aria-label="닫기" disabled={pending} onClick={onCancel}>×</button>
        </header>
        <div className="playerAnnotationsContent">
          <fieldset>
            <legend>System Tokens</legend>
            <div className="playerAnnotationSystemGrid">
              {systemTokens.map((token) => (
                <button
                  type="button"
                  aria-label={`System Token · ${token.label}`}
                  aria-pressed={draft.systemTokenIds.includes(token.id)}
                  className={draft.systemTokenIds.includes(token.id) ? "selected" : ""}
                  disabled={pending || busy}
                  onClick={() => toggleSystemToken(token.id)}
                  key={token.id}
                >{token.label}</button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Script Tokens</legend>
            <div className="playerAnnotationScriptGroups">
              {groupedScriptTokens.map(([character, tokens]) => (
                <section key={character}>
                  <strong>{character}</strong>
                  <div>{tokens.map((token) => {
                    const selected = draft.scriptTokens.some((candidate) => sameScriptToken(candidate, token));
                    return (
                      <button
                        type="button"
                        aria-label={`Script Token · ${token.character} · ${token.label}`}
                        aria-pressed={selected}
                        className={selected ? "selected" : ""}
                        disabled={pending || busy}
                        onClick={() => toggleScriptToken(token)}
                        key={`${token.characterId}:${token.tokenId}`}
                      >{token.label}</button>
                    );
                  })}</div>
                </section>
              ))}
            </div>
          </fieldset>
          <label className="playerAnnotationsNotes">
            <span><strong>Notes</strong><small>{draft.notes.length} / 1,000</small></span>
            <textarea
              aria-label="Notes"
              maxLength={1000}
              rows={4}
              value={draft.notes}
              disabled={pending || busy}
              onChange={(event) => { setDraft((current) => ({ ...current, notes: event.target.value })); setError(undefined); }}
              placeholder="이 플레이어에게만 필요한 운영 메모"
            />
          </label>
          {error ? <p className="playerAnnotationsError" role="alert">{error}</p> : null}
        </div>
        <footer>
          <span>{changed ? "변경 사항 있음" : "변경 사항 없음"}</span>
          <div>
            <button type="button" disabled={pending} onClick={onCancel}>취소</button>
            <button type="button" disabled={!changed || pending || busy} onClick={() => { void confirm(); }}>
              {pending ? "확정 중" : "수정 확정"}
            </button>
          </div>
        </footer>
      </section>
    </div>,
    document.body,
  );
}

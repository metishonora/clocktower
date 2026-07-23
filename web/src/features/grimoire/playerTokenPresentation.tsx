import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { sectsAndVioletsCharacterDetail } from "../../characterDetails";
import { CharacterDetailButton } from "../../components/CharacterRulesCard";
import "./playerTokenPresentation.css";

export type PlayerTokenVisualKind = "assignment" | "impairment" | "relationship" | "usage";

export type PlayerTokenPresentation = Readonly<{
  instanceId: string;
  label: string;
  sourceLabel: string;
  sourceIconSrc?: string;
  visualKind: PlayerTokenVisualKind;
  description?: string;
}>;

export type PlayerTokensByPlayerId = Readonly<Record<string, readonly PlayerTokenPresentation[]>>;

export type PlayerTokenDetailIdentity = Readonly<{
  characterId: string;
  seat: number;
  name: string;
  characterLabel: string;
  characterKindLabel: string;
  characterIconSrc?: string;
  characterAbility: string;
  alignment: "good" | "evil";
}>;

export function PlayerTokenCountBadge({
  count,
  position,
  mobilePosition,
}: {
  count: number;
  position: { x: number; y: number };
  mobilePosition: { x: number; y: number };
}) {
  if (count === 0) return null;
  const badgeOffset = inwardOffset(position, 48);
  const mobileBadgeOffset = inwardOffset(mobilePosition, 37);
  return (
    <span
      className="playerTokenCountBadge"
      aria-hidden="true"
      style={{
        "--token-seat-x": `${position.x}%`,
        "--token-seat-y": `${position.y}%`,
        "--token-mobile-seat-x": `${mobilePosition.x}%`,
        "--token-mobile-seat-y": `${mobilePosition.y}%`,
        "--token-badge-x": `${badgeOffset.x}px`,
        "--token-badge-y": `${badgeOffset.y}px`,
        "--token-mobile-badge-x": `${mobileBadgeOffset.x}px`,
        "--token-mobile-badge-y": `${mobileBadgeOffset.y}px`,
      } as CSSProperties}
    >+{count}</span>
  );
}

export function PlayerTokenList({ tokens }: { tokens: readonly PlayerTokenPresentation[] }) {
  if (tokens.length === 0) return null;
  return (
    <section className="playerPinnedTokenArea" aria-label="부착된 토큰">
      <ul aria-label={`부착된 토큰 ${tokens.length}개`}>
        {tokens.map((token) => (
          <li aria-label={`${token.label} · 출처 ${token.sourceLabel}`} key={token.instanceId}>
            <div className={`playerPinnedToken ${token.visualKind}`} title={token.description}>
              <span className="playerPinnedTokenSource">{token.sourceLabel}</span>
              {token.sourceIconSrc ? (
                <img src={token.sourceIconSrc} alt={`${token.sourceLabel} 출처`} />
              ) : (
                <span className="playerPinnedTokenFallback" aria-hidden="true">
                  {token.sourceLabel.trim().slice(0, 1) || "?"}
                </span>
              )}
              <strong>{token.label}</strong>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PlayerTokenDetailDialog({
  player,
  tokens,
  theme,
  onClose,
}: {
  player: PlayerTokenDetailIdentity;
  tokens: readonly PlayerTokenPresentation[];
  theme: "day" | "night";
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [characterDetailOpen, setCharacterDetailOpen] = useState(false);

  useEffect(() => {
    closeRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (characterDetailOpen) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), a[href]") ?? [],
      );
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
  }, [characterDetailOpen, onClose]);

  return createPortal(
    <div
      className={`playerTokenDetailBackdrop ${theme}`}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        ref={dialogRef}
        className="playerTokenDetailDialog"
        role="dialog"
        aria-modal="true"
        aria-label={`${player.seat}번 ${player.name} 플레이어 상세`}
      >
        <header>
          <CharacterDetailButton
            details={sectsAndVioletsCharacterDetail(player.characterId)}
            className="playerTokenCharacterIdentityButton"
            theme={theme === "day" ? "snv-day" : "snv-night"}
            onOpenChange={setCharacterDetailOpen}
          >
            {player.characterIconSrc ? <img src={player.characterIconSrc} alt={`${player.characterLabel} 공식 캐릭터 아이콘`} /> : null}
            <strong>{player.characterLabel}</strong>
          </CharacterDetailButton>
          <div>
            <span>좌석 {player.seat} · {player.characterKindLabel}</span>
            <h2>{player.name}</h2>
          </div>
          <span
            className={`snvAlignmentIcon alignment-${player.alignment} playerTokenDetailAlignment`}
            role="img"
            aria-label={`현재 진영 · ${player.alignment === "evil" ? "악" : "선"}`}
          >{player.alignment === "evil" ? "악" : "선"}</span>
          <button ref={closeRef} className="playerTokenDetailClose" type="button" aria-label="플레이어 상세 닫기" onClick={onClose}>×</button>
        </header>
        <div className="playerTokenDetailBody">
          <section className="playerTokenCharacterSummary" aria-label="캐릭터 정보">
            <span>캐릭터 능력</span>
            <p>{player.characterAbility}</p>
          </section>
          <PlayerTokenList tokens={tokens} />
        </div>
      </section>
    </div>,
    document.body,
  );
}

function inwardOffset(position: { x: number; y: number }, distance: number) {
  const x = 50 - position.x;
  const y = 50 - position.y;
  const magnitude = Math.hypot(x, y) || 1;
  return { x: x / magnitude * distance, y: y / magnitude * distance };
}

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { characterPresentation } from '../../custom/authoring/characterPresentation';
type Night = 'first';
export type OrderEntry = { id: string; label: string; kind: 'boundary' | 'system' | 'character'; characterId?: string; conditional?: boolean; invalid?: 'unknown' | 'duplicate' };
function assetFor(id?: string) { const entry = id ? characterPresentation(id) : undefined; return entry ? { src: entry.image } : undefined; }
export function OrderPanel({
  night,
  entries,
  title,
  labelledBy,
  busy,
  onMove,
  onRestore,
}: {
  night: Night;
  entries: readonly OrderEntry[];
  title?: string;
  labelledBy?: string;
  busy: boolean;
  onMove: (night: Night, id: string, direction: -1 | 1) => void;
  onRestore: (night: Night) => void;
}) {
  const movableEntries = entries.filter((entry) => entry.kind !== "boundary");
  const orderListRef = useRef<HTMLOListElement>(null);
  const previousPositions = useRef(new Map<string, DOMRect>());
  const activeMove = useRef<string | null>(null);
  const moveUnlockTimer = useRef<number | null>(null);
  const [isReordering, setIsReordering] = useState(false);

  useEffect(() => () => {
    if (moveUnlockTimer.current !== null) window.clearTimeout(moveUnlockTimer.current);
  }, []);

  useLayoutEffect(() => {
    const items = orderListRef.current?.querySelectorAll<HTMLElement>("[data-order-entry]");
    if (!items) return;

    const nextPositions = new Map<string, DOMRect>();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const selectedId = activeMove.current;
    items.forEach((item) => {
      const id = item.dataset.orderEntry;
      const nextPosition = item.getBoundingClientRect();
      if (!id || nextPosition.height === 0) return;

      nextPositions.set(id, nextPosition);
      const previousPosition = previousPositions.current.get(id);
      const offset = previousPosition ? previousPosition.top - nextPosition.top : 0;
      if (!selectedId || reduceMotion || Math.abs(offset) < 1) return;

      const selected = id === selectedId;
      item.animate(selected ? [
        { offset: 0, transform: `translate3d(0, ${offset}px, 0) scale(1)`, zIndex: "4" },
        { offset: .2, transform: `translate3d(7px, ${offset * .82}px, 0) scale(1.025)`, zIndex: "4" },
        { offset: .78, transform: `translate3d(7px, ${offset * .08}px, 0) scale(1.025)`, zIndex: "4" },
        { offset: 1, transform: "translate3d(0, 0, 0) scale(1)", zIndex: "4" },
      ] : [
        { offset: 0, transform: `translate3d(0, ${offset}px, 0)`, zIndex: "2" },
        { offset: .12, transform: `translate3d(0, ${offset}px, 0)`, zIndex: "2" },
        { offset: 1, transform: "translate3d(0, 0, 0)", zIndex: "2" },
      ], {
        duration: selected ? 720 : 660,
        delay: selected ? 0 : 55,
        easing: "cubic-bezier(.4, 0, .2, 1)",
        fill: "both",
      });
    });
    previousPositions.current = nextPositions;
    activeMove.current = null;
  }, [entries]);

  function moveWithAnimation(id: string, direction: -1 | 1) {
    if (moveUnlockTimer.current !== null) return;
    const items = orderListRef.current?.querySelectorAll<HTMLElement>("[data-order-entry]");
    const visiblePositions = new Map<string, DOMRect>();
    items?.forEach((item) => {
      const entryId = item.dataset.orderEntry;
      const position = item.getBoundingClientRect();
      if (entryId && position.height > 0) visiblePositions.set(entryId, position);
      item.getAnimations().forEach((animation) => animation.cancel());
    });
    previousPositions.current = visiblePositions;
    activeMove.current = id;
    onMove(night, id, direction);

    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIsReordering(true);
      moveUnlockTimer.current = window.setTimeout(() => {
        moveUnlockTimer.current = null;
        setIsReordering(false);
      }, 760);
    }
  }

  return (
    <section className="issue202Gate3OrderPanel" aria-labelledby={labelledBy} aria-label={labelledBy ? undefined : `${title} 순서`}>
      {title ? <header><h2>{title}</h2><span>{movableEntries.length} actions</span></header> : null}
      <ol
        ref={orderListRef}
        style={{
          "--issue202-order-track-height": `${34 + entries.length * 79}px`,
          "--issue202-order-track-height-mobile": `${34 + entries.length * 74}px`,
        } as React.CSSProperties}
      >
        {entries.map((entry, index) => {
          const movable = entry.kind !== "boundary";
          const icon = entry.kind === "character" ? assetFor(entry.characterId) : undefined;
          return (
            <li
              key={entry.id}
              data-order-entry={entry.id}
              className={`is-${entry.kind}${entry.conditional ? " is-conditional" : ""}${entry.invalid ? " is-invalid" : ""}`}
            >
              <div className="issue202Gate3Plaque">
                <span className="issue202Gate3PlaqueHole is-left" aria-hidden="true" />
                <span className="issue202Gate3Index" aria-hidden="true">{entry.kind === "boundary" ? "◆" : index}</span>
                <span className="issue202Gate3Token" aria-hidden="true">
                  {icon ? <img src={icon.src} alt="" /> : entry.kind === "boundary" ? index === 0 ? "☾" : "☀" : "◇"}
                </span>
                <span className="issue202Gate3EntryCopy">
                  <strong>{entry.label}</strong>
                  <small>{entry.invalid === "unknown" ? "알 수 없는 항목" : entry.invalid === "duplicate" ? "중복" : entry.kind === "boundary" ? "고정 경계" : entry.kind === "system" ? "시스템 행동" : entry.conditional ? "조건부 행동" : "캐릭터 행동"}</small>
                </span>
                {movable ? (
                  <span className="issue202Gate3MoveButtons">
                    <button type="button" disabled={busy || isReordering || index <= 1} aria-label={`${entry.label} 위로 이동`} onClick={() => moveWithAnimation(entry.id, -1)}>↑</button>
                    <button type="button" disabled={busy || isReordering || index >= entries.length - 2} aria-label={`${entry.label} 아래로 이동`} onClick={() => moveWithAnimation(entry.id, 1)}>↓</button>
                  </span>
                ) : <span className="issue202Gate3Fixed">고정</span>}
                <span className="issue202Gate3PlaqueHole is-right" aria-hidden="true" />
              </div>
            </li>
          );
        })}
      </ol>
      <button type="button" className="issue202Gate3Restore" disabled={busy || isReordering} onClick={() => onRestore(night)}>{title ?? (night === "first" ? "첫날 밤" : "이후 밤")} 기본값 복원</button>
    </section>
  );
}

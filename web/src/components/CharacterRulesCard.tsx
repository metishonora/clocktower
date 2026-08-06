import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { CharacterDetail } from "../characterDetails";
import "./CharacterRulesCard.css";

export function CharacterDetailButton({
  details,
  children,
  className = "",
  theme = "light",
  onOpenChange,
}: {
  details?: CharacterDetail;
  children: ReactNode;
  className?: string;
  theme?: "light" | "snv-day" | "snv-night";
  onOpenChange?: (open: boolean) => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const sourceRef = useRef<HTMLAnchorElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeCard();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], summary") ?? [],
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!details) return null;

  function closeCard() {
    setOpen(false);
    onOpenChange?.(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  function openCard() {
    setOpen(true);
    onOpenChange?.(true);
  }

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={`characterDetailIdentityButton ${className}`.trim()}
        aria-label={`${details.label} 캐릭터 상세 열기`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={openCard}
      >
        {children}
      </button>
      {open ? createPortal((
        <div className={`characterRulesBackdrop ${theme}`} onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeCard();
        }}>
          <section
            ref={dialogRef}
            className="characterRulesCard"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <header className="characterRulesHeader">
              {details.iconSrc ? <img src={details.iconSrc} alt="" className="characterRulesIcon" /> : null}
              <div>
                {details.kindLabel ? <small>{details.kindLabel}</small> : null}
                <h2 id={titleId}>{details.label} 캐릭터 상세</h2>
              </div>
              <button
                type="button"
                ref={closeRef}
                className="characterRulesClose"
                aria-label="캐릭터 상세 닫기"
                onClick={closeCard}
                onKeyDown={(event) => {
                  if (event.key === "Tab" && event.shiftKey) {
                    event.preventDefault();
                    sourceRef.current?.focus();
                  }
                }}
              >×</button>
            </header>

            <div className="characterRulesBody">
              <section>
                <h3>공식 능력</h3>
                <p className="characterRulesAbility">{details.ability}</p>
              </section>
              <section>
                <h3>핵심 판정</h3>
                <ul>{details.rulings.map((ruling) => <li key={ruling}>{ruling}</li>)}</ul>
              </section>
              <section>
                <h3>진행 방법</h3>
                <ol>{details.howToRun.map((instruction) => <li key={instruction}>{instruction}</li>)}</ol>
              </section>
              {details.reminders.length ? (
                <section className="characterRulesReminders">
                  <h3>리마인더</h3>
                  <ul>
                    {details.reminders.map((reminder) => (
                      <li key={`${reminder.label}-${reminder.count}`}>
                        <strong>{reminder.label} × {reminder.count}</strong>
                        <span>{reminder.description}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              <details className="characterRulesExample">
                <summary>공식 예시 {details.examples.length}개 보기</summary>
                <ol>
                  {details.examples.map((example) => (
                    <li key={example.id}>{example.text}</li>
                  ))}
                </ol>
              </details>
              <a
                ref={sourceRef}
                href={details.sourceUrl}
                target="_blank"
                rel="noreferrer"
                onKeyDown={(event) => {
                  if (event.key === "Tab" && !event.shiftKey) {
                    event.preventDefault();
                    closeRef.current?.focus();
                  }
                }}
              >공식 규칙 열기</a>
            </div>
          </section>
        </div>
      ), document.body) : null}
    </>
  );
}

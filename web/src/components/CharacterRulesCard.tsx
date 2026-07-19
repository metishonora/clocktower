import { useEffect, useRef, useState, type CSSProperties } from "react";
import { characterRulesFor } from "../characterRules";
import { characterKind, kindLabels } from "../setupDraft";
import { CharacterIcon } from "./CharacterIcon";
import "./CharacterRulesCard.css";

export function CharacterRulesButton({
  characterId,
  ariaLabel,
  className = "",
  style,
}: {
  characterId?: string;
  ariaLabel: string;
  className?: string;
  style?: CSSProperties;
}) {
  const rules = characterRulesFor(characterId);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeCard();
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>("button, a[href], summary") ?? [],
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
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  if (!rules) return null;

  function closeCard() {
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  const kind = characterKind(rules.id);

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={`characterRulesInfoButton ${className}`.trim()}
        style={style}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        ⓘ
      </button>
      {open ? (
        <div className="characterRulesBackdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeCard();
        }}>
          <section
            ref={dialogRef}
            className="characterRulesCard"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`character-rules-${rules.id}-title`}
          >
            <header className="characterRulesHeader">
              <CharacterIcon characterId={rules.id} className="characterRulesIcon" />
              <div>
                {kind ? <small>{kindLabels[kind]}</small> : null}
                <h2 id={`character-rules-${rules.id}-title`}>{rules.label} 세부 규칙</h2>
              </div>
              <button type="button" ref={closeRef} className="characterRulesClose" aria-label="세부 규칙 닫기" onClick={closeCard}>×</button>
            </header>

            <div className="characterRulesBody">
              <section>
                <h3>공식 능력</h3>
                <p className="characterRulesAbility">{rules.ability}</p>
              </section>
              <section>
                <h3>핵심 판정</h3>
                <ul>{rules.rulings.map((ruling) => <li key={ruling}>{ruling}</li>)}</ul>
              </section>
              <section>
                <h3>진행 방법</h3>
                <ol>{rules.howToRun.map((instruction) => <li key={instruction}>{instruction}</li>)}</ol>
              </section>
              <details className="characterRulesExample">
                <summary>예시 보기</summary>
                <ol>
                  {rules.examples.map((example, index) => (
                    <li key={`${rules.id}-example-${index}`}>{example}</li>
                  ))}
                </ol>
              </details>
              <a href={rules.sourceUrl} target="_blank" rel="noreferrer">공식 규칙</a>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

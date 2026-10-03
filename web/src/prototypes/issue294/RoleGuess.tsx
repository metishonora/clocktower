import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { characters, characterKinds, kindLabels, type CharacterKind } from '../../setupDraft';
import { characterAsset } from '../../characterAssets';
import './roleGuesses.css';

export function RoleGuessChip({ name, value, expanded, buttonRef, onClick }: {
  name: string;
  value?: string;
  expanded: boolean;
  buttonRef: RefObject<HTMLButtonElement | null>;
  onClick: () => void;
}) {
  const guessed = characterAsset(value);
  return <button ref={buttonRef} type="button" className={`rg-chip ${guessed ? 'has-guess' : ''}`}
    aria-label={guessed ? `${name}의 직업 추측: ${guessed.label}, 변경` : `${name}의 직업 추측 입력`}
    aria-expanded={expanded} aria-controls={expanded ? 'rg-picker' : undefined} onClick={onClick}>
    {guessed ? <><img src={guessed.src} alt="" /><span className="rg-chip-name">{guessed.label}</span></>
      : <><span aria-hidden="true">＋</span><span className="rg-chip-name">직업 추측</span></>}
  </button>;
}

export function MessageRoleGuess({ value }: { value?: string }) {
  const guessed = characterAsset(value);
  return guessed ? <span className="rg-message-guess" aria-label={`추측 직업: ${guessed.label}`}><img src={guessed.src} alt="" /><span>{guessed.label}</span></span> : null;
}

export function RoleGuessPicker({ name, value, onSelect }: {
  name: string;
  value?: string;
  onSelect: (id?: string) => void;
}) {
  const [kind, setKind] = useState<CharacterKind>(() => characters.find((role) => role.id === value)?.kind ?? 'Townsfolk');
  const heading = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);
  return <section id="rg-picker" className="rg-picker" aria-labelledby="rg-title">
    <div className="rg-heading"><h3 id="rg-title" ref={heading} tabIndex={-1}>직업 추측</h3></div>
    <div className="rg-kinds" role="group" aria-label="직업 분류">{characterKinds.map((option) => <button key={option} type="button" aria-pressed={kind === option} onClick={() => setKind(option)}>{kindLabels[option]}</button>)}</div>
    <div className="rg-catalog" role="group" aria-label={`${name}의 ${kindLabels[kind]} 직업 추측`}>
      {characters.filter((role) => role.kind === kind).map((role) => <button key={role.id} type="button" aria-pressed={value === role.id} onClick={() => onSelect(role.id)}>
        <img src={characterAsset(role.id)!.src} alt="" /><span>{role.label}</span>{value === role.id && <b aria-hidden="true">✓</b>}
      </button>)}
    </div>
    {value && <button className="rg-clear" type="button" onClick={() => onSelect()}>추측 지우기</button>}
  </section>;
}

import type { ReactNode } from 'react';
import '../features/evil-information/sectsAndVioletsEvilInformation.css';
/** SnV's actual evil-information task, with script-specific candidates supplied as data. */
export function EvilInformationTask({isDemon,characters,wakePlayers,selectedCharacterIds,revealed,busy,suggesting,onToggle,onShuffle,onReveal,onContinue}: {
  isDemon:boolean; characters:{id:string;name:string;icon:ReactNode}[]; wakePlayers:{seat:number;name:string}[];
  selectedCharacterIds:string[];revealed:boolean;busy:boolean;suggesting:boolean;
  onToggle:(id:string)=>void;onShuffle:()=>void;onReveal:()=>void;onContinue:()=>void;
}) {
  if (!isDemon) {
    return (
      <article className="snvCurrentStep snvEvilInformationTask snvMinionInformationTask">
        <p className="snvCurrentStepLabel">현재 할 일</p>
        <h3>하수인 정보</h3>
        <WakeInstruction players={wakePlayers} />
        <div className="snvEvilInformationTaskActions">
          <button type="button" className="prominent" disabled={busy} onClick={onReveal}>
            정보 공개
          </button>
          <button type="button" disabled={busy || !revealed} onClick={onContinue}>
            다음으로
          </button>
        </div>
      </article>
    );
  }

  const allowed = characters.map(c => c.id);
  const complete = selectedCharacterIds.length === 3;
  return (
    <article className="snvCurrentStep snvEvilInformationTask snvDemonInformationTask">
      <header>
        <div>
          <p className="snvCurrentStepLabel">현재 할 일</p>
          <h3>악마 정보</h3>
        </div>
        <span className={complete ? "complete" : undefined}>{selectedCharacterIds.length} / 3</span>
      </header>
      <WakeInstruction players={wakePlayers} />

      <div className="snvBluffCandidateGrid" aria-label="사용 가능한 속임수">
        {allowed.map((characterId) => {
          const character = characters.find(c => c.id === characterId)!;
          const selected = selectedCharacterIds.includes(characterId);
          return (
            <button
              type="button"
              className={selected ? "selected" : undefined}
              aria-pressed={selected}
              aria-label={`${character.name}${selected ? ", 선택됨" : ""}`}
              disabled={busy || suggesting || revealed || (!selected && complete)}
              onClick={() => onToggle(characterId)}
              key={characterId}
            >
              {character.icon}
              <strong>{character.name}</strong>
              {selected ? <small>선택됨</small> : null}
            </button>
          );
        })}
      </div>

      <div className="snvEvilInformationTaskActions">
        <button
          type="button"
          className="snvBluffShuffle"
          aria-label="속임수 무작위 추천"
          title="무작위 추천"
          disabled={busy || suggesting || revealed}
          onClick={onShuffle}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h2.3c4.2 0 4.7 10 9.2 10H20" />
            <path d="m17 14 3 3-3 3" />
            <path d="M4 17h2.3c1.8 0 2.9-1.8 4-4" />
            <path d="M15.5 7H20" />
            <path d="m17 4 3 3-3 3" />
          </svg>
        </button>
        <button
          type="button"
          className="prominent"
          disabled={busy || suggesting || !complete}
          onClick={onReveal}
        >
          정보 공개
        </button>
        <button
          type="button"
          className="snvEvilInformationNext"
          disabled={busy || !revealed}
          onClick={onContinue}
        >
          다음으로
        </button>
      </div>
    </article>
  );
}

function WakeInstruction({ players }: { players: Array<{ seat: number; name: string }> }) {
  const playerText = players.map((player) => `${player.seat}번 ${player.name}`).join(", ");
  return (
    <p className="snvEvilInformationWakeInstruction">
      <strong>{playerText}</strong>를 깨웁니다.
    </p>
  );
}

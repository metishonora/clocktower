import type { ReactNode } from "react";
import type { EvilInformationRevealPayload, PhaseStep } from "../../core/types.js";
import { sectsAndVioletsCharacterAsset } from "../../sectsAndVioletsCharacterAssets.js";
import { sectsAndVioletsCharacters } from "../../sectsAndVioletsCharacters.js";

export function SectsAndVioletsEvilInformationTask({
  step,
  selectedCharacterIds,
  busy,
  suggesting,
  onToggle,
  onShuffle,
  onConfirm,
}: {
  step: PhaseStep;
  selectedCharacterIds: string[];
  busy: boolean;
  suggesting: boolean;
  onToggle: (characterId: string) => void;
  onShuffle: () => void;
  onConfirm: () => void;
}) {
  const isDemon = step.id.endsWith(":demonInfo");
  if (!isDemon) {
    return (
      <article className="snvCurrentStep snvEvilInformationTask snvMinionInformationTask">
        <p className="snvCurrentStepLabel">현재 할 일</p>
        <h3>하수인 정보</h3>
        <p>하수인을 깨우고 악마를 확인시킵니다.</p>
        <div className="snvEvilInformationTaskActions">
          <button type="button" className="prominent" disabled={busy} onClick={onConfirm}>
            정보 확정
          </button>
        </div>
      </article>
    );
  }

  const allowed = step.requiredInput.allowedCharacterIds ?? [];
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

      <div className="snvBluffCandidateGrid" aria-label="사용 가능한 속임수">
        {allowed.map((characterId) => {
          const character = characterFor(characterId);
          const selected = selectedCharacterIds.includes(characterId);
          return (
            <button
              type="button"
              className={selected ? "selected" : undefined}
              aria-pressed={selected}
              aria-label={`${character.name}${selected ? ", 선택됨" : ""}`}
              disabled={busy || suggesting || (!selected && complete)}
              onClick={() => onToggle(characterId)}
              key={characterId}
            >
              <CharacterIcon characterId={characterId} />
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
          disabled={busy || suggesting}
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
          className="snvBluffConfirm"
          disabled={busy || suggesting || !complete}
          onClick={onConfirm}
        >
          속임수 확정
        </button>
      </div>
    </article>
  );
}

export function SectsAndVioletsEvilInformationFollowup({
  payload,
  busy,
  onReveal,
  onContinue,
}: {
  payload: EvilInformationRevealPayload;
  busy: boolean;
  onReveal: () => void;
  onContinue: () => void;
}) {
  const label = payload.kind === "minionInformation" ? "하수인 정보" : "악마 정보";
  return (
    <article className="snvCurrentStep snvEvilInformationFollowup">
      <p className="snvCurrentStepLabel">확정된 정보</p>
      <h3>{label}</h3>
      <div className="snvEvilInformationFollowupActions">
        <button type="button" className="prominent" disabled={busy} onClick={onReveal}>
          플레이어에게 공개
        </button>
        <button type="button" disabled={busy} onClick={onContinue}>
          다음 단계로 계속
        </button>
      </div>
    </article>
  );
}

export function SectsAndVioletsEvilInformationReveal({
  payload,
  onClose,
}: {
  payload: EvilInformationRevealPayload;
  onClose: () => void;
}) {
  const isMinion = payload.kind === "minionInformation";
  return (
    <div className="snvInformationRevealBackdrop">
      <section
        className="snvInformationReveal snvEvilInformationReveal"
        role="dialog"
        aria-modal="true"
        aria-label={isMinion ? "하수인 정보 공개" : "악마 정보 공개"}
      >
        <header className="snvEvilInformationRevealHeading">
          <h1>{isMinion ? "당신은 하수인입니다" : "당신은 악마입니다"}</h1>
        </header>

        {isMinion ? (
          <RevealSection label="악마">
            <IdentityCards players={payload.demonPlayers} />
          </RevealSection>
        ) : (
          <>
            <RevealSection number="01" label="당신의 하수인">
              <IdentityCards players={payload.minionPlayers} />
            </RevealSection>
            <RevealSection number="02" label="속임수">
              <div className="snvEvilInformationCharacterCards">
                {payload.bluffCharacterIds.map((characterId) => (
                  <article key={characterId}>
                    <span><CharacterIcon characterId={characterId} /></span>
                    <strong>{characterFor(characterId).name}</strong>
                  </article>
                ))}
              </div>
            </RevealSection>
          </>
        )}
        <button type="button" aria-label="악한 팀 정보 공개 닫기" onClick={onClose}>
          확인했다면 눈을 감으세요
        </button>
      </section>
    </div>
  );
}

function RevealSection({
  number,
  label,
  children,
}: {
  number?: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <section className="snvEvilInformationRevealSection" aria-label={label}>
      <header>
        {number ? <span>{number}</span> : null}
        <h2>{label}</h2>
      </header>
      {children}
    </section>
  );
}

function IdentityCards({ players }: {
  players: Array<{ seat: number; name: string }>;
}) {
  return (
    <div className="snvEvilInformationIdentityCards">
      {players.map((player) => (
        <article key={player.seat}>
          <span>{player.seat}</span>
          <strong>{player.name}</strong>
        </article>
      ))}
    </div>
  );
}

function CharacterIcon({ characterId }: { characterId: string }) {
  const asset = sectsAndVioletsCharacterAsset(characterId);
  return asset ? <img src={asset.src} alt={`${asset.label} 공식 캐릭터 아이콘`} /> : null;
}

function characterFor(characterId: string) {
  const character = sectsAndVioletsCharacters.find((candidate) => candidate.id === characterId);
  if (!character) throw new Error(`Unknown S&V character: ${characterId}`);
  return character;
}

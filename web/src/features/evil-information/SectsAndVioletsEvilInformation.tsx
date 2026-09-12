import { EvilInformationTask } from '../../shared-ui/EvilInformationTask.js';
import type { ReactNode } from "react";
import type { EvilInformationRevealPayload, PhaseStep } from "../../core/types.js";
import { sectsAndVioletsCharacterAsset } from "../../sectsAndVioletsCharacterAssets.js";
import { sectsAndVioletsCharacters } from "../../sectsAndVioletsCharacters.js";

export function SectsAndVioletsEvilInformationTask({
  step,
  wakePlayers,
  selectedCharacterIds,
  revealed,
  busy,
  suggesting,
  onToggle,
  onShuffle,
  onReveal,
  onContinue,
}: {
  step: PhaseStep;
  wakePlayers: Array<{ seat: number; name: string }>;
  selectedCharacterIds: string[];
  revealed: boolean;
  busy: boolean;
  suggesting: boolean;
  onToggle: (characterId: string) => void;
  onShuffle: () => void;
  onReveal: () => void;
  onContinue: () => void;
}) {
  return <EvilInformationTask isDemon={step.id.endsWith(':demonInfo')} characters={(step.requiredInput.allowedCharacterIds ?? []).map(id => ({id,name:characterFor(id).name,icon:<CharacterIcon characterId={id}/>}))}
    wakePlayers={wakePlayers} selectedCharacterIds={selectedCharacterIds} revealed={revealed} busy={busy} suggesting={suggesting}
    onToggle={onToggle} onShuffle={onShuffle} onReveal={onReveal} onContinue={onContinue}/>;
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
        className={`snvInformationReveal snvEvilInformationReveal${isMinion ? " snvMinionInformationReveal" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={isMinion ? "하수인 정보 공개" : "악마 정보 공개"}
      >
        <header className="snvEvilInformationRevealHeading">
          <h1>{isMinion ? "당신은 하수인입니다" : "당신은 악마입니다"}</h1>
        </header>

        {isMinion ? (
          <RevealSection label="악마는">
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
        <button type="button" onClick={onClose}>
          확인했으면 눈을 감으세요
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

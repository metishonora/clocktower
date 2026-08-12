import { Fragment } from "react";
import type {
  EvilInformationRevealPayload,
  EvilTwinPairRevealPayload,
  FortuneTellerInformationRevealPayload,
  RevealPayload,
  RevealPlayer,
  RoleInformationRevealPayload,
} from "../../core/types.js";
import {
  scalarInformationLabel,
  scalarInformationValueLabel,
  type ScalarInformationCharacterId,
} from "../../core/informationPresentation.js";
import { CharacterIcon } from "../../components/CharacterIcon.js";
import { characterLabel } from "../../setupDraft.js";
import { SectsAndVioletsReveal } from "../reveal/SectsAndVioletsReveal.js";
import "../identity-change/characterChangeReveal.css";
import "./troubleBrewingRevealScreen.css";

const CLOSE_LABEL = "확인했으면 눈을 감으세요";

/**
 * The Trouble Brewing player-facing Reveal presentation.
 *
 * Spy reveals intentionally remain in TroubleBrewingLiveGrimoire. This
 * component owns the common information/reveal shell used by all other TB
 * payloads and keeps the payload semantics intact while #153 fills in any
 * character-specific wording and edge-case copy.
 */
export function TroubleBrewingRevealScreen({
  payload,
  onClose,
}: {
  payload: RevealPayload;
  onClose: () => void;
}) {
  if (!("kind" in payload)) {
    return (
      <SectsAndVioletsReveal
        dialogLabel="플레이어 공개 화면"
        className="snvProductionInformationReveal tbInformationReveal tb-textReveal"
        closeLabel={CLOSE_LABEL}
        onClose={onClose}
      >
        <TextContent payload={payload} />
      </SectsAndVioletsReveal>
    );
  }
  if (payload.kind === "spyGrimoire") return null;
  if (payload.kind === "evilTwinPair") return <EvilTwinReveal payload={payload} onClose={onClose} />;
  if (payload.kind === "minionInformation" || payload.kind === "demonInformation") {
    return <EvilInformationReveal payload={payload} onClose={onClose} />;
  }
  if (payload.kind === "characterChange") {
    const alignment = payload.alignment === "good" ? "선" : "악";
    return (
      <SectsAndVioletsReveal
        dialogLabel="직업 변경 공개 1/1"
        backdropAriaLabel="플레이어 공개 화면"
        className={`snakeCharmerReveal ${payload.alignment}`}
        closeLabel={CLOSE_LABEL}
        onClose={onClose}
      >
        <div className="snakeCharmerRevealIdentity">
          <h1>당신의 직업이 변경되었습니다</h1>
          <CharacterIcon characterId={payload.characterId} />
          <h2>{displayCharacterLabel(payload.characterId, payload.alignment)}</h2>
          <span className="snakeCharmerRevealAlignment" aria-label={`현재 진영 · ${alignment}`}>{alignment}</span>
        </div>
      </SectsAndVioletsReveal>
    );
  }

  return (
    <SectsAndVioletsReveal
      dialogLabel={dialogLabel(payload)}
      backdropAriaLabel="플레이어 공개 화면"
      className={`snvProductionInformationReveal tbInformationReveal tb-${payload.kind}`}
      closeLabel={CLOSE_LABEL}
      onClose={onClose}
    >
      <InformationContent payload={payload} />
    </SectsAndVioletsReveal>
  );
}

function InformationContent({ payload }: { payload: Exclude<RevealPayload, { kind: "spyGrimoire" | "evilTwinPair" | "minionInformation" | "demonInformation" | "characterChange" }> }) {
  if (!("kind" in payload)) return <TextContent payload={payload} />;

  switch (payload.kind) {
    case "setupInformation":
      return <SetupInformationContent payload={payload} />;
    case "fortuneTellerInformation":
      return <FortuneTellerContent payload={payload} />;
    case "numericInformation":
      return (
        <>
          <span className="tbRevealEyebrow">{characterLabel(payload.characterId)} 정보</span>
          <CharacterIcon characterId={payload.characterId} className="tbRevealIcon" />
          <p className="tbRevealDescription">{numericInformationPrompt(payload.characterId)}</p>
          <h2>{scalarInformationValueLabel(payload.characterId, payload.value)}</h2>
        </>
      );
    case "booleanInformation":
      return (
        <>
          <CharacterIcon characterId={payload.characterId} className="tbRevealIcon" />
          <span className="tbRevealEyebrow">{characterLabel(payload.characterId)} 정보</span>
          <h2 className="tbRevealValue">{scalarInformationValueLabel(payload.characterId, payload.value)}</h2>
          <p className="tbRevealDescription">{scalarInformationLabel(payload.characterId)}</p>
        </>
      );
    case "characterInformation":
      const revealedCharacter = characterLabel(payload.revealedCharacterId);
      return (
        <>
          <span className="tbRevealEyebrow">{characterLabel(payload.characterId)} 정보</span>
          <RevealSeatCards players={[payload.targetPlayer]} ariaLabel="확인 대상" />
          <p className="tbRevealDescription">이 자의 직업은…</p>
          <RevealedCharacter characterId={payload.revealedCharacterId} label={revealedCharacter} />
        </>
      );
    case "dreamerInformation":
      return (
        <>
          <CharacterIcon characterId="dreamer" className="tbRevealIcon" />
          <span className="tbRevealEyebrow">꿈꾸는 자 정보</span>
          <h2>이 자는…</h2>
          <div className="tbRevealCharacterPair" aria-label="가능한 캐릭터">
            <CharacterCard characterId={payload.characterIds[0]} />
            <b aria-hidden="true">또는</b>
            <CharacterCard characterId={payload.characterIds[1]} />
          </div>
        </>
      );
    case "seamstressInformation":
      return (
        <>
          <CharacterIcon characterId="seamstress" className="tbRevealIcon" />
          <span className="tbRevealEyebrow">재봉사 정보</span>
          <h2>{payload.sameAlignment ? "같은 진영" : "다른 진영"}</h2>
          <p className="tbRevealDescription">선택한 두 플레이어는…</p>
          <RevealPlayers players={payload.targetPlayers} ariaLabel="확인한 플레이어" separator="그리고" />
        </>
      );
    case "sageInformation":
      return (
        <>
          <CharacterIcon characterId="sage" className="tbRevealIcon" />
          <span className="tbRevealEyebrow">현자 정보</span>
          <h2>당신을 죽인 악마는…</h2>
          <RevealPlayers players={payload.candidatePlayers} ariaLabel="악마 후보" separator="또는" />
        </>
      );
    default:
      return <TextContent payload={payload} />;
  }
}

function SetupInformationContent({ payload }: { payload: Extract<RoleInformationRevealPayload, { kind: "setupInformation" }> }) {
  const role = characterLabel(payload.characterId);
  if (payload.zeroOutsiders) {
    return (
      <>
        <span className="tbRevealEyebrow">{role} 정보</span>
        <h2>외지인이 없습니다</h2>
      </>
    );
  }

  const revealed = characterLabel(payload.revealedCharacterId);
  return (
    <>
      <span className="tbRevealEyebrow">{role} 정보</span>
      <RevealSeatCards players={payload.candidatePlayers} ariaLabel="후보 좌석" />
      <p className="tbRevealDescription">둘 중 한 명은</p>
      <RevealedCharacter characterId={payload.revealedCharacterId} label={revealed} />
    </>
  );
}

function FortuneTellerContent({ payload }: { payload: FortuneTellerInformationRevealPayload }) {
  return (
    <>
      <CharacterIcon characterId="fortuneTeller" className="tbRevealIcon" />
      <span className="tbRevealEyebrow">점쟁이 정보</span>
      <h2>이 중에 악마는…</h2>
      <RevealPlayers players={payload.targetPlayers} ariaLabel="확인한 플레이어" separator="그리고" />
      <strong className={`tbRevealValue ${payload.hasDemon ? "yes" : "no"}`}>{payload.hasDemon ? "있음" : "없음"}</strong>
    </>
  );
}

function EvilInformationReveal({ payload, onClose }: { payload: EvilInformationRevealPayload; onClose: () => void }) {
  const minion = payload.kind === "minionInformation";
  return (
    <SectsAndVioletsReveal
      dialogLabel={minion ? "하수인 정보 공개" : "악마 정보 공개"}
      backdropAriaLabel="플레이어 공개 화면"
      className={`snvEvilInformationReveal tbInformationReveal tbEvilInformationReveal${minion ? " tbMinionInformationReveal" : ""}`}
      closeLabel={CLOSE_LABEL}
      onClose={onClose}
    >
      <header className="tbEvilInformationHeading">
        <span>{minion ? "하수인 정보" : "악마 정보"}</span>
        <h1>{minion ? "당신은 하수인입니다" : "당신은 악마입니다"}</h1>
      </header>

      {minion ? (
        <>
          <RevealSection number="01" label="악마는">
            <IdentityCards players={payload.demonPlayers} />
          </RevealSection>
          <RevealSection number="02" label="동료 하수인">
            <IdentityCards players={payload.minionPlayers} />
          </RevealSection>
        </>
      ) : (
        <>
          <RevealSection number="01" label="당신의 하수인">
            <IdentityCards players={payload.minionPlayers} />
          </RevealSection>
          <RevealSection number="02" label="속임수">
            <div className="tbRevealCharacterCards">
              {payload.bluffCharacterIds.length === 0 ? <strong className="tbRevealEmpty">없음</strong> : null}
              {payload.bluffCharacterIds.map((characterId) => <CharacterCard characterId={characterId} key={characterId} />)}
            </div>
          </RevealSection>
        </>
      )}
    </SectsAndVioletsReveal>
  );
}

function RevealSection({ number, label, children }: { number?: string; label: string; children: React.ReactNode }) {
  return (
    <section className="tbRevealSection" aria-label={label}>
      <header>
        {number ? <span>{number}</span> : null}
        <h2>{label}</h2>
      </header>
      {children}
    </section>
  );
}

function IdentityCards({ players }: { players: Array<{ seat: number; name: string }> }) {
  return (
    <div className="tbRevealIdentityCards">
      {players.length === 0 ? <strong className="tbRevealEmpty">없음</strong> : null}
      {players.map((player) => (
        <article key={player.seat}>
          <span>{player.seat}</span>
          <strong>{player.seat}번 {player.name}</strong>
        </article>
      ))}
    </div>
  );
}

function RevealPlayers({ players, ariaLabel, separator }: { players: readonly RevealPlayer[]; ariaLabel: string; separator?: string }) {
  return (
    <div className="tbRevealPlayerPair" aria-label={ariaLabel}>
      {players.map((player, index) => <Fragment key={player.playerId}>
        <div className="tbRevealPlayerCard">
          <span>플레이어</span>
          <strong>{player.seat}번 {player.name}</strong>
        </div>
        {separator && index < players.length - 1 ? <b aria-hidden="true">{separator}</b> : null}
      </Fragment>)}
    </div>
  );
}

function RevealSeatCards({ players, ariaLabel }: { players: readonly RevealPlayer[]; ariaLabel: string }) {
  return (
    <div className="tbRevealSeatCards" role="group" aria-label={ariaLabel}>
      {players.map((player) => (
        <article key={player.playerId} aria-label={`${player.seat}번 ${player.name} 좌석`}>
          <span>{player.seat}</span>
          <strong>{player.seat}번 {player.name}</strong>
        </article>
      ))}
    </div>
  );
}

function RevealedCharacter({ characterId, label }: { characterId: string; label: string }) {
  return (
    <div className="tbRevealCharacterIdentity" role="group" aria-label={`공개 직업 ${label}`}>
      <CharacterIcon characterId={characterId} decorative />
      <h2>{label}</h2>
    </div>
  );
}

function CharacterCard({ characterId }: { characterId: string }) {
  return (
    <article className="tbRevealCharacterCard">
      <span><CharacterIcon characterId={characterId} /></span>
      <strong>{displayCharacterLabel(characterId)}</strong>
    </article>
  );
}

function EvilTwinReveal({ payload, onClose }: { payload: EvilTwinPairRevealPayload; onClose: () => void }) {
  return (
    <SectsAndVioletsReveal
      dialogLabel="쌍둥이 정보 공개"
      backdropAriaLabel="플레이어 공개 화면"
      className="snvProductionInformationReveal tbInformationReveal tbEvilTwinReveal"
      closeLabel={CLOSE_LABEL}
      onClose={onClose}
    >
      <span className="tbRevealEyebrow">사악한 쌍둥이</span>
      <h2>여러분은 쌍둥이입니다</h2>
      <p className="tbRevealDescription">상대와 직업을 확인하십시오</p>
      <div className="tbRevealTwinPair" aria-label="쌍둥이 플레이어">
        {payload.players.map((player) => (
          <article key={player.playerId}>
            <span>{player.seat}번 · {player.name}</span>
            <CharacterIcon characterId={player.characterId} decorative />
            <strong>{displayCharacterLabel(player.characterId, player.alignment)}</strong>
            <small>{player.alignment === "good" ? "선" : "악"}</small>
          </article>
        ))}
      </div>
    </SectsAndVioletsReveal>
  );
}

function TextContent({ payload }: { payload: Extract<RevealPayload, { messageKo: string }> }) {
  const label = payload.labelKo?.trim();
  const value = label ? payload.valueKo?.trim() || payload.messageKo : payload.messageKo;
  return (
    <>
      <span className="tbRevealEyebrow">플레이어 공개</span>
      <h2>{label || "확인하세요"}</h2>
      <p className="tbRevealDescription">{value}</p>
    </>
  );
}

function dialogLabel(payload: Exclude<RevealPayload, { kind: "spyGrimoire" | "evilTwinPair" | "minionInformation" | "demonInformation" }>) {
  if (!("kind" in payload)) return "플레이어 공개 화면";
  switch (payload.kind) {
    case "setupInformation":
    case "numericInformation":
    case "booleanInformation":
      return `${characterLabel(payload.characterId)} 정보 공개`;
    case "fortuneTellerInformation": return "점쟁이 정보 공개";
    case "characterInformation": return `${characterLabel(payload.characterId)} 정보 공개`;
    case "dreamerInformation": return "꿈꾸는 자 정보 공개";
    case "seamstressInformation": return "재봉사 정보 공개";
    case "sageInformation": return "현자 정보 공개";
    case "characterChange": return "역할 변경 공개";
    default: return "플레이어 공개 화면";
  }
}

function displayCharacterLabel(characterId: string, alignment?: "good" | "evil") {
  if (alignment === "good" && characterId === "evilTwin") return "쌍둥이";
  return characterLabel(characterId);
}

function numericInformationPrompt(characterId: ScalarInformationCharacterId) {
  if (characterId === "empath") return "양옆 이웃 중 악한 팀";
  return scalarInformationLabel(characterId);
}

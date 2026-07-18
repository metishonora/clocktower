import type { CSSProperties } from "react";
import type { EvilInformationRevealPayload, RevealIdentity, RevealPayload, RevealPlayer, RoleInformationRevealPayload, SpyGrimoireRevealPayload, TextRevealPayload } from "./core/types.js";
import { isRoleInformationRevealPayload, isSpyGrimoireRevealPayload } from "./core/revealPayload.js";
import { characterLabel } from "./setupDraft.js";
import { spySeatPosition } from "./spyGrimoireLayout.js";
import { CharacterIcon } from "./components/CharacterIcon.js";

export function RevealPreview({
  payload,
  onShow,
  disabled = false,
}: {
  payload: RevealPayload;
  onShow: () => void;
  disabled?: boolean;
}) {
  if (isSpyGrimoireRevealPayload(payload)) return null;
  if (isRoleInformationRevealPayload(payload)) {
    return (
      <section className="revealPreview" aria-label="Reveal 미리보기">
        <p className="revealPreviewMessage">{roleInformationTitle(payload)}</p>
        <button type="button" className="primaryButton" onClick={onShow} disabled={disabled}>플레이어에게 공개</button>
      </section>
    );
  }
  return (
    <section className="revealPreview" aria-label="Reveal 미리보기">
      <div className="sectionHeader compact">
        <div>
          <p className="eyebrow">Reveal 미리보기</p>
          <h2>플레이어에게 보일 내용</h2>
        </div>
      </div>
      <p className="revealPreviewMessage">{payload.previewMessageKo ?? payload.messageKo}</p>
      <button type="button" className="primaryButton" onClick={onShow} disabled={disabled}>
        플레이어에게 공개
      </button>
    </section>
  );
}

export function RevealScreen({ payload, onClose }: { payload: RevealPayload; onClose: () => void }) {
  if (isSpyGrimoireRevealPayload(payload)) {
    return <SpyGrimoireReveal payload={payload} onClose={onClose} />;
  }
  if (isRoleInformationRevealPayload(payload)) return <RoleInformationReveal payload={payload} onClose={onClose} />;
  return <TextReveal payload={payload} onClose={onClose} />;
}

function RoleInformationReveal({ payload, onClose }: { payload: RoleInformationRevealPayload; onClose: () => void }) {
  if (payload.kind === "minionInformation" || payload.kind === "demonInformation") {
    return <EvilInformationReveal payload={payload} onClose={onClose} />;
  }
  let content;
  if (payload.kind === "setupInformation") {
    content = payload.zeroOutsiders ? (
      <><h1>사서 정보</h1><strong className="roleInformationEmpty">외부인은 없습니다.</strong></>
    ) : (
      <>
        <h1>{characterLabel(payload.characterId)} 정보</h1>
        <p>{setupInformationDescription(payload.characterId)}</p>
        <CharacterResult characterId={payload.revealedCharacterId} />
        <RevealPlayers players={payload.candidatePlayers} />
      </>
    );
  } else if (payload.kind === "numericInformation") {
    content = <><h1>{characterLabel(payload.characterId)} 정보</h1><p>{payload.characterId === "chef" ? "서로 이웃한 악 팀" : "살아있는 양옆 이웃 중 악 팀"}</p><strong className="roleInformationValue">{payload.value}{payload.characterId === "chef" ? "쌍" : "명"}</strong></>;
  } else if (payload.kind === "fortuneTellerInformation") {
    content = <><h1>점쟁이 정보</h1><p>이 중에 악마는…</p><RevealPlayers players={payload.targetPlayers} /><strong className={`roleInformationValue boolean ${payload.hasDemon ? "yes" : "no"}`}>{payload.hasDemon ? "있음" : "없음"}</strong></>;
  } else if (payload.kind === "characterInformation") {
    content = <><h1>{characterLabel(payload.characterId)} 정보</h1><p>이 자의 직업은…</p><RevealPlayers players={[payload.targetPlayer]} /><CharacterResult characterId={payload.revealedCharacterId} /></>;
  } else {
    content = <><h1>당신의 역할이 변경되었습니다.</h1><span className={`roleInformationAlignment ${payload.alignment}`}>{payload.alignment === "good" ? "선" : "악"}</span><CharacterResult characterId={payload.characterId} /></>;
  }
  return (
    <main className="revealShell" aria-label="플레이어 공개 화면" data-player-id={payload.kind === "characterChange" ? payload.playerId : undefined}>
      <section className="roleInformationCard">
        <div className="roleInformationContent">{content}</div>
        <button type="button" className="revealCloseButton" onClick={onClose}>확인했다면 눈을 감으세요.</button>
      </section>
    </main>
  );
}

function EvilInformationReveal({ payload, onClose }: { payload: EvilInformationRevealPayload; onClose: () => void }) {
  const isMinionInformation = payload.kind === "minionInformation";
  return (
    <main className="revealShell evilInformationReveal" aria-label="플레이어 공개 화면">
      <header className="evilInformationHeading">
        <p>{isMinionInformation ? "하수인 정보" : "악마 정보"}</p>
        <h1>{isMinionInformation ? "악마와 동료 하수인을 확인하세요" : "하수인과 블러프를 확인하세요"}</h1>
      </header>
      <section className="evilInformationCard" aria-label={isMinionInformation ? "하수인 정보 내용" : "악마 정보 내용"}>
        {isMinionInformation ? <IdentityGroup label="악마" players={payload.demonPlayers} demon /> : null}
        <IdentityGroup label="하수인" players={payload.minionPlayers} />
        {payload.kind === "demonInformation" ? (
          <section className="evilInformationGroup evilInformationBluffs" aria-labelledby="evil-information-bluffs">
            <h2 id="evil-information-bluffs">블러프</h2>
            <div className="evilInformationBluffGrid">
              {payload.bluffCharacterIds.length === 0 ? <strong className="evilInformationEmpty">없음</strong> : null}
              {payload.bluffCharacterIds.map((characterId) => (
                <div key={characterId}>
                  <CharacterIcon characterId={characterId} />
                  <strong>{characterLabel(characterId)}</strong>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </section>
      <button type="button" className="revealCloseButton evilInformationClose" onClick={onClose}>확인했다면 눈을 감으세요.</button>
    </main>
  );
}

function IdentityGroup({ label, players, demon = false }: { label: string; players: RevealIdentity[]; demon?: boolean }) {
  const headingId = `evil-information-${label}`;
  return (
    <section className="evilInformationGroup" aria-labelledby={headingId}>
      <h2 id={headingId}>{label}</h2>
      <div className="evilInformationIdentities">
        {players.length === 0 ? <strong className="evilInformationEmpty">없음</strong> : null}
        {players.map((player) => (
          <div className={demon ? "demon" : undefined} key={player.seat}>
            <span>{player.seat}</span>
            <strong>{player.seat}번 {player.name}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function RevealPlayers({ players }: { players: readonly RevealPlayer[] }) {
  return <div className="roleInformationPlayers" aria-label="확인 대상">{players.map((player) => <div key={player.playerId}><span>{player.seat}</span><strong>{player.name}</strong></div>)}</div>;
}

function CharacterResult({ characterId }: { characterId: string }) {
  return <div className="roleInformationCharacter"><CharacterIcon characterId={characterId} /><strong>{characterLabel(characterId)}</strong></div>;
}

function setupInformationDescription(characterId: "washerwoman" | "librarian" | "investigator") {
  return characterId === "washerwoman" ? "둘 중 한 명은 이 마을주민입니다." : characterId === "librarian" ? "둘 중 한 명은 이 외부인입니다." : "둘 중 한 명은 이 하수인입니다.";
}

function roleInformationTitle(payload: RoleInformationRevealPayload) {
  if (payload.kind === "characterChange") return "역할 변경";
  if (payload.kind === "fortuneTellerInformation") return "점쟁이 정보";
  if (payload.kind === "minionInformation") return "하수인 정보";
  if (payload.kind === "demonInformation") return "악마 정보";
  return `${characterLabel(payload.characterId)} 정보`;
}

function TextReveal({ payload, onClose }: { payload: TextRevealPayload; onClose: () => void }) {
  const label = payload.labelKo?.trim();
  const structuredValue = label ? payload.valueKo?.trim() : undefined;
  const value = structuredValue || payload.messageKo;

  return (
    <main className="revealShell" aria-label="플레이어 공개 화면">
      <section className={`revealCard ${label ? "structuredRevealCard" : ""}`}>
        {label ? <h1 className="revealPlayerLabel">{label}</h1> : null}
        <p>{value}</p>
        <button type="button" className="revealCloseButton" onClick={onClose}>
          확인했다면 눈을 감으세요.
        </button>
      </section>
    </main>
  );
}

function SpyGrimoireReveal({
  payload,
  onClose,
}: {
  payload: SpyGrimoireRevealPayload;
  onClose: () => void;
}) {
  const count = payload.players.length;
  return (
    <main className={`spyGrimoireReveal count${count}`} aria-label="플레이어 공개 화면">
      <header className="spyGrimoireRevealHeader">
        <div>
          <p className="spyGrimoireEyebrow">SPY</p>
          <h1>그리모어를 확인하세요</h1>
        </div>
        <p>{count}명 · 읽기 전용</p>
      </header>

      <section className="spyGrimoireSeatMap" aria-label="Spy 그리모어 좌석 배치">
        <div className="spyGrimoireLegend" aria-label="상태 범례">
          <span>실제 캐릭터: 좌석 카드에 표시</span>
          <span>● 생존 / † 사망</span>
          <span>○ 유령 투표 미사용 · ◉ 유령 투표 사용</span>
        </div>
        {payload.players.map((player, index) => {
          const position = spySeatPosition(index, count);
          const style = {
            "--spy-seat-x": `${position.x}%`,
            "--spy-seat-y": `${position.y}%`,
          } as CSSProperties;
          const character = characterLabel(player.characterId);
          return (
            <article
              key={player.playerId}
              className={`spyGrimoireSeat ${player.alive ? "isAlive" : "isDead"}`}
              style={style}
              role="group"
              aria-label={`좌석 ${player.seat}, ${player.name}, 실제 캐릭터 ${character}, ${player.alive ? "생존" : "사망"}, 유령 투표 ${player.ghostVoteUsed ? "사용" : "미사용"}`}
            >
              <div className="spyGrimoireSeatHeading">
                <span>{player.seat}</span>
                <strong>{player.name}</strong>
              </div>
              <p className="spyGrimoireCharacter">{character}</p>
              <div className="spyGrimoireStatuses" aria-hidden="true">
                <span title={player.alive ? "생존" : "사망"}>{player.alive ? "●" : "†"}</span>
                <span title={`유령 투표 ${player.ghostVoteUsed ? "사용" : "미사용"}`}>
                  {player.ghostVoteUsed ? "◉" : "○"}
                </span>
              </div>
              {player.reminderTokens.length > 0 ? (
                <div className="spyGrimoireTokens">
                  {player.reminderTokens.map((token) => (
                    <span key={token}>{token === "poisoned" ? "중독" : "보호"}</span>
                  ))}
                </div>
              ) : null}
            </article>
          );
        })}
      </section>

      <button className="spyGrimoireClose" type="button" onClick={onClose}>
        확인했다면 눈을 감으세요.
      </button>
    </main>
  );
}

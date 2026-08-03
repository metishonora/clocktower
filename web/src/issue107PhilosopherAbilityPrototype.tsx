import { Fragment, useState, type CSSProperties } from "react";
import {
  PlayerTokenCountBadge,
  PlayerTokenDetailDialog,
  type PlayerTokenPresentation,
} from "./features/grimoire/playerTokenPresentation";
import { sectsAndVioletsCharacterAsset } from "./sectsAndVioletsCharacterAssets";
import { sectsAndVioletsCharacters } from "./sectsAndVioletsCharacters";
import { grimoireHeights, rectangularSeatPositions } from "./sectsAndVioletsGrimoireLayout";
import "./sectsAndVioletsFoundationPrototype.css";
import "./features/phase-control/sectsAndVioletsInformationTask.css";
import "./issue107PhilosopherAbilityPrototype.css";

type PrototypeState = "selection" | "dreamer" | "artist" | "self" | "mathematician";
type Surface = "progress" | "grimoire";

const states: Array<{ id: PrototypeState; label: string }> = [
  { id: "selection", label: "선택 전" },
  { id: "dreamer", label: "꿈꾸는 자" },
  { id: "artist", label: "화가 · 게임 안" },
  { id: "self", label: "자기 선택" },
  { id: "mathematician", label: "수학자 사용" },
];

const goodCharacters = sectsAndVioletsCharacters.filter(
  (character) => character.kind === "townsfolk" || character.kind === "outsider",
);

const players = [
  { seat: 1, name: "민서", characterId: "clockmaker", alignment: "good" },
  { seat: 2, name: "준호", characterId: "philosopher", alignment: "good" },
  { seat: 3, name: "서윤", characterId: "oracle", alignment: "good" },
  { seat: 4, name: "지우", characterId: "snakeCharmer", alignment: "good" },
  { seat: 5, name: "수빈", characterId: "artist", alignment: "good" },
  { seat: 6, name: "유나", characterId: "witch", alignment: "evil" },
  { seat: 7, name: "도윤", characterId: "vigormortis", alignment: "evil" },
] as const;

export function Issue107PhilosopherAbilityPrototype() {
  const [state, setState] = useState<PrototypeState>(prototypeStateFromLocation);
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [surface, setSurface] = useState<Surface>(prototypeSurfaceFromLocation);
  const phase = state === "mathematician" ? "3일차 밤" : state === "selection" || state === "dreamer" ? "1일차 밤" : "2일차 밤";

  return (
    <div className="issue107Prototype">
      <aside className="issue107ReviewStrip" aria-label="이슈 107 검토 컨트롤">
        <span>프로토타입 상태</span>
        <div>
          {states.map((candidate, index) => (
            <button
              key={candidate.id}
              type="button"
              aria-pressed={state === candidate.id}
              onClick={() => {
                setState(candidate.id);
                setSelectedCharacterId("");
              }}
            >
              <b>{index + 1}</b>{candidate.label}
            </button>
          ))}
        </div>
      </aside>

      <main className="snvFoundationPrototype snvNightMode issue107LiveScreen" aria-label="이슈 107 철학자 능력 획득 라이브 화면">
        <a className="snvScriptHomeLink" href="#" aria-label="스크립트 선택">←</a>
        <header className="snvPrototypeHeader">
          <div>
            <span className="snvEyebrow">STORYTELLER CONSOLE</span>
            <h1>Sects &amp; Violets</h1>
            <p>7–15명</p>
          </div>
          <div className="snvPhaseActions" aria-label="현재 페이즈와 되돌리기">
            <button type="button" className="snvGlobalUndo empty" aria-hidden="true" tabIndex={-1} disabled>
              <svg viewBox="0 0 32 32" aria-hidden="true">
                <path d="M12.2 9.2 6.5 14.8l5.7 5.7" />
                <path d="M7.2 14.8h10.2a8 8 0 1 1-6.3 12.9" />
              </svg>
            </button>
            <span className="snvPhaseMark snvMoonMark" role="img" aria-label="밤">☾</span>
          </div>
        </header>

        <nav className="snvUtilityTabs" aria-label="게임 데이터">
          <button type="button" className="snvNewGameTab">새 게임</button>
          <button type="button" className="snvStorageTab">저장 / 불러오기</button>
        </nav>
        <nav className="snvSurfaceTabs" aria-label="작업 단계">
          <button type="button">직업</button>
          <button
            type="button"
            className={surface === "grimoire" ? "active" : undefined}
            aria-current={surface === "grimoire" ? "page" : undefined}
            onClick={() => setSurface("grimoire")}
          >마도서</button>
          <button
            type="button"
            className={surface === "progress" ? "active" : undefined}
            aria-current={surface === "progress" ? "page" : undefined}
            onClick={() => setSurface("progress")}
          >진행</button>
        </nav>

        {surface === "progress" ? (
        <section className="snvManualSurface snvFirstNightSurface snvTabPanel snvNightSurface issue107Progress" aria-label={`${phase} 진행`}>
          <header className="snvFirstNightHeader">
            <button type="button" aria-label="마도서로 이동">← 마도서</button>
            <div className="snvProgressPhaseHeader"><h2>{phase}</h2></div>
          </header>

          <div className="snvFirstNightPrimary">
            <PhilosopherStep
              state={state}
              selectedCharacterId={selectedCharacterId}
              onSelect={setSelectedCharacterId}
            />
          </div>

          <ol className="snvPhaseOverview" aria-label="밤 행동 순서">
            <li className="complete"><span>완료</span><strong>악마 정보</strong></li>
            <li className="current"><span>현재</span><strong>{state === "mathematician" ? "철학자 · 수학자" : "철학자"}</strong></li>
            <li><span>다음</span><strong>뱀 조련사</strong></li>
            <li><span>대기</span><strong>마녀</strong></li>
          </ol>
        </section>
        ) : (
          <GrimoireSurface state={state} phase={phase} onReturn={() => setSurface("progress")} />
        )}
      </main>
    </div>
  );
}

function PhilosopherStep({
  state,
  selectedCharacterId,
  onSelect,
}: {
  state: PrototypeState;
  selectedCharacterId: string;
  onSelect: (characterId: string) => void;
}) {
  if (state === "selection") {
    return (
      <article className="snvCurrentStep issue107Step" aria-label="철학자 능력 선택">
        <p className="snvCurrentStepLabel">현재 할 일</p>
        <ActorIdentity characterId="philosopher" playerName="2번 준호" />
        <CharacterSummary characterId="philosopher" />
        <label className="issue107AbilitySelect">
          <span>능력</span>
          <select aria-label="얻을 선한 캐릭터 능력" value={selectedCharacterId} onChange={(event) => onSelect(event.target.value)}>
            <option value="">선택</option>
            {goodCharacters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}
          </select>
        </label>
        <div className="snvStepActions">
          <button type="button" disabled={!selectedCharacterId}>선택 확정</button>
          <button type="button" className="secondary">이번 밤 보류</button>
        </div>
      </article>
    );
  }

  if (state === "dreamer") {
    return (
      <article className="snvCurrentStep issue107Step" aria-label="꿈꾸는 자 능력 획득 결과">
        <p className="snvCurrentStepLabel">획득 완료</p>
        <ActorIdentity characterId="philosopher" playerName="2번 준호" />
        <AcquiredAbility characterId="dreamer" />
        <div className="snvStepActions"><button type="button">다음 단계</button></div>
      </article>
    );
  }

  if (state === "artist") {
    return (
      <article className="snvCurrentStep issue107Step" aria-label="화가 능력 획득 결과">
        <p className="snvCurrentStepLabel">획득 완료</p>
        <ActorIdentity characterId="philosopher" playerName="2번 준호" />
        <AcquiredAbility characterId="artist" />
        <div className="snvStepActions"><button type="button">다음 단계</button></div>
      </article>
    );
  }

  if (state === "self") {
    return (
      <article className="snvCurrentStep issue107Step" aria-label="철학자 자기 선택 결과">
        <p className="snvCurrentStepLabel">현재 할 일</p>
        <ActorIdentity characterId="philosopher" playerName="2번 준호" drunk />
        <CharacterSummary characterId="philosopher" />
        <div className="snvStepActions"><button type="button">다음 단계</button></div>
      </article>
    );
  }

  return (
    <article className="snvCurrentStep issue107Step" aria-label="획득한 수학자 능력 사용">
      <p className="snvCurrentStepLabel">현재 할 일</p>
      <ActorIdentity characterId="philosopher" playerName="2번 준호" />
      <AcquiredAbility characterId="mathematician" />
      <div className="snvStepActions"><button type="button" className="informationReveal prominent">정보 공개</button></div>
    </article>
  );
}

function GrimoireSurface({
  state,
  phase,
  onReturn,
}: {
  state: PrototypeState;
  phase: string;
  onReturn: () => void;
}) {
  const [detailsSeat, setDetailsSeat] = useState<number>();
  const positions = rectangularSeatPositions(players.length, false);
  const mobilePositions = rectangularSeatPositions(players.length, true);
  const heights = grimoireHeights(players.length);
  const acquiredCharacterId = acquiredAbilityForState(state);
  const acquiredCharacterInPlay = Boolean(
    acquiredCharacterId && players.some((player) => player.characterId === acquiredCharacterId),
  );
  const sizeStyle = {
    "--grimoire-height": `${heights.desktop}px`,
    "--mobile-grimoire-height": `${heights.mobile}px`,
  } as CSSProperties;
  const detailsPlayer = players.find((player) => player.seat === detailsSeat);
  const detailsCharacterId = detailsPlayer
    ? displayedCharacterForPlayer(detailsPlayer.characterId, acquiredCharacterId, acquiredCharacterInPlay)
    : undefined;
  const detailsCharacter = detailsCharacterId ? characterById(detailsCharacterId) : undefined;
  const detailsAsset = detailsCharacterId ? sectsAndVioletsCharacterAsset(detailsCharacterId) : undefined;
  const detailsTokens = detailsPlayer
    ? tokensForPlayer(detailsPlayer.characterId, state, acquiredCharacterId, acquiredCharacterInPlay)
    : [];

  return (
    <section className="snvSeatingSurface snvTabPanel issue107GrimoireSurface" aria-label={`${phase} 마도서`}>
      <div className="snvSeatingToolbar" aria-label="마도서 도구">
        <button type="button" className="snvToolbarBack" aria-label="진행으로 돌아가기" onClick={onReturn}>←</button>
        <div className="snvCurrentActorLegend" aria-label="현재 행동자 안내"><span aria-hidden="true" />현재 행동자</div>
      </div>
      <div className="snvSeatingWorkspace stable" style={sizeStyle}>
        <div className="snvGrimoireDraft rectangular" aria-label={`${players.length}자리 마도서`} style={sizeStyle}>
          {players.map((player, index) => {
            const position = positions[index];
            const mobilePosition = mobilePositions[index];
            const philosopherSeat = player.characterId === "philosopher";
            const displayedCharacterId = displayedCharacterForPlayer(
              player.characterId,
              acquiredCharacterId,
              acquiredCharacterInPlay,
            );
            const character = characterById(displayedCharacterId);
            const asset = sectsAndVioletsCharacterAsset(displayedCharacterId);
            const tokens = tokensForPlayer(
              player.characterId,
              state,
              acquiredCharacterId,
              acquiredCharacterInPlay,
            );
            return (
              <Fragment key={player.seat}>
                <button
                  type="button"
                  className={`assigned alignment-${player.alignment} kind-${character?.kind}${philosopherSeat ? " snvCurrentActorSeat issue107PhilosopherSeat" : ""}`}
                  aria-label={`${player.seat}번 ${player.name}, ${character?.name}, ${tokens.length > 0 ? `토큰 ${tokens.length}개` : "토큰 없음"}`}
                  style={{
                    "--seat-x": `${position.x}%`,
                    "--seat-y": `${position.y}%`,
                    "--mobile-seat-x": `${mobilePosition.x}%`,
                    "--mobile-seat-y": `${mobilePosition.y}%`,
                  } as CSSProperties}
                  onClick={() => setDetailsSeat(player.seat)}
                >
                  <span className="snvSeatNumber">{player.seat}</span>
                  {asset ? <img src={asset.src} alt="" /> : null}
                  <span className="snvSeatPlayerName">{player.name}</span>
                  <small>{character?.name}</small>
                </button>
                <PlayerTokenCountBadge
                  count={tokens.length}
                  position={position}
                  mobilePosition={mobilePosition}
                  theme="night"
                />
              </Fragment>
            );
          })}
          <div className="snvGrimoireCenter live">
            <strong>{phase}</strong>
            <span>철학자</span>
            <button type="button" onClick={onReturn}>진행 →</button>
          </div>
        </div>
      </div>
      {detailsPlayer && detailsCharacterId && detailsCharacter ? (
        <PlayerTokenDetailDialog
          player={{
            characterId: detailsCharacterId,
            seat: detailsPlayer.seat,
            name: detailsPlayer.name,
            characterLabel: detailsCharacter.name,
            characterKindLabel: characterKindLabel(detailsCharacter.kind),
            characterIconSrc: detailsAsset?.src,
            characterAbility: detailsCharacter.ability,
            alignment: detailsPlayer.alignment,
          }}
          tokens={detailsTokens}
          theme="night"
          onClose={() => setDetailsSeat(undefined)}
        />
      ) : null}
    </section>
  );
}

function displayedCharacterForPlayer(
  characterId: string,
  acquiredCharacterId: string | undefined,
  acquiredCharacterInPlay: boolean,
) {
  return characterId === "philosopher" && acquiredCharacterId && !acquiredCharacterInPlay
    ? acquiredCharacterId
    : characterId;
}

function tokensForPlayer(
  characterId: string,
  state: PrototypeState,
  acquiredCharacterId?: string,
  acquiredCharacterInPlay = false,
): readonly PlayerTokenPresentation[] {
  const philosopherAsset = sectsAndVioletsCharacterAsset("philosopher");
  if (characterId === "philosopher" && acquiredCharacterId && !acquiredCharacterInPlay) {
    return [{
      instanceId: "philosopher-identity",
      label: "철학자임",
      sourceLabel: "철학자",
      sourceIconSrc: philosopherAsset?.src,
      visualKind: "assignment",
    }];
  }
  if (characterId === "philosopher" && state === "self") {
    return [{
      instanceId: "philosopher-self-drunk",
      label: "취함",
      sourceLabel: "철학자",
      sourceIconSrc: philosopherAsset?.src,
      visualKind: "impairment",
    }];
  }
  if (characterId === "artist" && state === "artist") {
    return [{
      instanceId: "artist-drunk-by-philosopher",
      label: "취함",
      sourceLabel: "철학자",
      sourceIconSrc: philosopherAsset?.src,
      visualKind: "impairment",
    }];
  }
  return [];
}

function characterKindLabel(kind: string) {
  if (kind === "townsfolk") return "주민";
  if (kind === "outsider") return "외지인";
  if (kind === "minion") return "하수인";
  return "악마";
}

function ActorIdentity({
  characterId,
  playerName,
  drunk = false,
}: {
  characterId: string;
  playerName: string;
  drunk?: boolean;
}) {
  const character = characterById(characterId);
  return (
    <div className="snvCurrentStepIdentity snvInformationIdentity snvInformationPendingIdentity issue107ActorIdentity">
      <CharacterIcon characterId={characterId} />
      <div>
        <span className="snvInformationRoleLine">
          <span className="snvCurrentStepRoleName" role="heading" aria-level={3}>{character?.name}</span>
          {drunk ? (
            <span className="snvInformationInfluenceBadges" aria-label="정보 영향">
              <em className="snvInformationInfluenceBadge drunk">취함</em>
            </span>
          ) : null}
        </span>
        <strong>{playerName}</strong>
      </div>
    </div>
  );
}

function CharacterSummary({ characterId }: { characterId: string }) {
  const character = characterById(characterId);
  return <p className="snvInformationAbility">{character?.ability}</p>;
}

function AcquiredAbility({ characterId }: { characterId: string }) {
  const character = characterById(characterId);
  return (
    <section className="issue107AbilityResult" aria-label={`획득 능력 · ${character?.name}`}>
      <span>획득 능력</span>
      <CharacterIcon characterId={characterId} />
      <div>
        <strong>{character?.name}</strong>
        <p>{character?.ability}</p>
      </div>
    </section>
  );
}

function CharacterIcon({ characterId }: { characterId: string }) {
  const asset = sectsAndVioletsCharacterAsset(characterId);
  return asset ? <img src={asset.src} alt="" /> : null;
}

function characterById(characterId: string) {
  return sectsAndVioletsCharacters.find((character) => character.id === characterId);
}

function acquiredAbilityForState(state: PrototypeState) {
  if (state === "dreamer") return "dreamer";
  if (state === "artist") return "artist";
  if (state === "mathematician") return "mathematician";
  return undefined;
}

function prototypeStateFromLocation(): PrototypeState {
  if (typeof window === "undefined") return "selection";
  const requested = new URLSearchParams(window.location.search).get("prototypeState");
  return states.some((state) => state.id === requested) ? requested as PrototypeState : "selection";
}

function prototypeSurfaceFromLocation(): Surface {
  if (typeof window === "undefined") return "progress";
  return new URLSearchParams(window.location.search).get("prototypeSurface") === "grimoire"
    ? "grimoire"
    : "progress";
}

export const issue107PrototypeTokens = { characterCount: goodCharacters.length } as const;

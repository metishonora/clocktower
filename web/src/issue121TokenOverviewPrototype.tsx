import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import {
  PlayerTokenList,
  type PlayerTokenPresentation,
} from "./features/grimoire/playerTokenPresentation";
import { sectsAndVioletsCharacterAsset } from "./sectsAndVioletsCharacterAssets";
import { sectsAndVioletsCharacters } from "./sectsAndVioletsCharacters";
import { rectangularSeatPositions } from "./sectsAndVioletsGrimoireLayout";
import "./issue121TokenOverviewPrototype.css";

export type { PlayerTokenPresentation } from "./features/grimoire/playerTokenPresentation";

type PrototypePlayer = {
  id: string;
  seat: number;
  name: string;
  characterId: string;
  tokens: PlayerTokenPresentation[];
};

const prototypePlayers: PrototypePlayer[] = [
  player(1, "민서", "mutant", [
    token("cerenovus-mutant", "집착", "세레노버스", "cerenovus", "assignment", "세레노버스가 지정한 캐릭터라고 주장해야 합니다."),
  ]),
  player(2, "준호", "philosopher", [
    token("philosopher-ability", "능력", "철학자", "philosopher", "usage", "철학자가 얻은 능력을 표시합니다."),
  ]),
  player(3, "서준", "fangGu", [
    token("fang-gu-once", "한 번", "팡 구", "fangGu", "usage", "첫 외지인 사망 능력의 사용 여부를 표시합니다."),
  ]),
  player(4, "지우", "clockmaker", [
    token("cerenovus-clockmaker", "집착", "세레노버스", "cerenovus", "assignment", "시계공이라고 집착해야 합니다."),
  ]),
  player(5, "현우", "juggler", [
    token("juggler-used", "사용", "곡예사", "juggler", "usage", "곡예를 한 플레이어입니다."),
  ]),
  player(6, "유나", "dreamer", [
    token("no-dashii-poison", "중독", "노 다시", "noDashii", "impairment", "노 다시에게 가장 가까운 주민입니다."),
    token("evil-twin-pair", "쌍둥이", "사악한 쌍둥이", "evilTwin", "relationship", "사악한 쌍둥이와 짝인 선한 플레이어입니다."),
  ]),
  player(7, "도윤", "pitHag", [
    token("witch-curse", "저주", "마녀", "witch", "assignment", "마녀가 지목한 플레이어입니다."),
  ]),
  player(8, "하린", "sweetheart", [
    token("sweetheart-drunk", "취함", "사랑꾼", "sweetheart", "impairment", "사랑꾼의 죽음으로 취한 상태입니다."),
  ]),
  player(9, "예진", "artist", [
    token("cerenovus-artist", "집착", "세레노버스", "cerenovus", "assignment", "세레노버스가 지정한 캐릭터라고 주장해야 합니다."),
  ]),
  player(10, "민재", "witch", [
    token("witch-cursed", "저주", "마녀", "witch", "assignment", "마녀가 지목한 플레이어입니다."),
    token("no-dashii-poison-2", "중독", "노 다시", "noDashii", "impairment", "노 다시에게 가장 가까운 주민입니다."),
    token("evil-twin-pair-2", "쌍둥이", "사악한 쌍둥이", "evilTwin", "relationship", "사악한 쌍둥이와 연결되어 있습니다."),
  ]),
  player(11, "채원", "oracle", [
    token("no-dashii-poison-3", "중독", "노 다시", "noDashii", "impairment", "노 다시에게 가장 가까운 주민입니다."),
  ]),
  player(12, "수아", "noDashii", [
    token("mathematician-abnormal", "비정상", "수학자", "mathematician", "usage", "비정상적으로 작동한 능력을 표시합니다."),
  ]),
  player(13, "다은", "savant", [
    token("cerenovus-savant", "집착", "세레노버스", "cerenovus", "assignment", "세레노버스가 지정한 캐릭터라고 주장해야 합니다."),
  ]),
  player(14, "지호", "townCrier", [
    token("town-crier-nominated", "지목", "포고꾼", "townCrier", "usage", "오늘 하수인이 지명했음을 표시합니다."),
  ]),
  player(15, "태윤", "sage", [
    token("evil-twin-pair-3", "쌍둥이", "사악한 쌍둥이", "evilTwin", "relationship", "사악한 쌍둥이와 짝인 선한 플레이어입니다."),
  ]),
];

export function Issue121TokenOverviewPrototype() {
  const [playerCount, setPlayerCount] = useState(15);
  const [mode, setMode] = useState<"overview" | "action">("overview");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>();
  const [actionPlayerId, setActionPlayerId] = useState<string>();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const seatRefs = useRef(new Map<string, HTMLButtonElement>());
  const visiblePlayers = prototypePlayers.slice(0, playerCount);
  const desktopPositions = useMemo(() => rectangularSeatPositions(playerCount, false), [playerCount]);
  const mobilePositions = useMemo(() => rectangularSeatPositions(playerCount, true), [playerCount]);
  const selectedPlayer = visiblePlayers.find((player) => player.id === selectedPlayerId);

  useEffect(() => {
    if (!selectedPlayer) return;
    closeButtonRef.current?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Tab") {
        event.preventDefault();
        closeButtonRef.current?.focus();
      } else if (event.key === "Escape") {
        closeDetails();
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedPlayer]);

  function changeMode(nextMode: "overview" | "action") {
    setMode(nextMode);
    setSelectedPlayerId(undefined);
    setActionPlayerId(undefined);
  }

  function closeDetails() {
    const returningPlayerId = selectedPlayerId;
    setSelectedPlayerId(undefined);
    requestAnimationFrame(() => returningPlayerId && seatRefs.current.get(returningPlayerId)?.focus());
  }

  return (
    <main className="issue121Prototype" aria-label="이슈 121 토큰 표시 프로토타입">
      <header className="issue121Header">
        <div>
          <span>ISSUE 121 · PLAYER TOKEN REVIEW</span>
          <h1>Sects &amp; Violets</h1>
          <p>마도서 토큰 정보 위계</p>
        </div>
        <div className="issue121PhaseMark" aria-label="2일차 낮">
          <b>2</b><span>낮</span>
        </div>
      </header>

      <section className="issue121ReviewBar" aria-label="프로토타입 화면 선택">
        <label className="issue121PlayerCount">
          <span>인원</span>
          <select
            aria-label="프로토타입 인원"
            value={playerCount}
            onChange={(event) => {
              setPlayerCount(Number(event.target.value));
              setSelectedPlayerId(undefined);
              setActionPlayerId(undefined);
            }}
          >
            {Array.from({ length: 11 }, (_, index) => index + 5).map((count) => (
              <option value={count} key={count}>{count}명</option>
            ))}
          </select>
        </label>
        <button type="button" aria-pressed={mode === "overview"} onClick={() => changeMode("overview")}>평상시 overview</button>
        <button type="button" aria-pressed={mode === "action"} onClick={() => changeMode("action")}>지명 · 투표 · 공격</button>
      </section>

      <section
        className={`issue121Grimoire ${mode}`}
        role="region"
        aria-label={mode === "overview" ? "평상시 마도서 overview" : "액션 선택 마도서"}
      >
        <div className="issue121TableGlow" aria-hidden="true" />
        <div className="issue121Center">
          <strong>2일차 낮</strong>
          <span>12:38</span>
          <button type="button">진행 →</button>
        </div>

        {visiblePlayers.map((currentPlayer, index) => {
          const character = characterFor(currentPlayer.characterId);
          const asset = sectsAndVioletsCharacterAsset(currentPlayer.characterId);
          const position = desktopPositions[index];
          const mobilePosition = mobilePositions[index];
          const badgeOffset = inwardBadgeOffset(position, 48);
          const mobileBadgeOffset = inwardBadgeOffset(mobilePosition, 37);
          const actionSelected = actionPlayerId === currentPlayer.id;
          const tokenCountLabel = currentPlayer.tokens.length > 0
            ? `, 토큰 ${currentPlayer.tokens.length}개`
            : ", 토큰 없음";
          const accessibleName = mode === "overview"
            ? `${currentPlayer.seat}번 ${currentPlayer.name} 좌석, ${character?.name ?? "미할당"}${tokenCountLabel}`
            : `${currentPlayer.seat}번 ${currentPlayer.name} ${actionSelected ? "선택됨" : "선택"}`;

          return (
            <button
              ref={(node) => {
                if (node) seatRefs.current.set(currentPlayer.id, node);
                else seatRefs.current.delete(currentPlayer.id);
              }}
              type="button"
              className={`issue121Seat kind-${character?.kind ?? "townsfolk"}${actionSelected ? " actionSelected" : ""}`}
              style={{
                "--seat-x": `${position.x}%`,
                "--seat-y": `${position.y}%`,
                "--mobile-seat-x": `${mobilePosition.x}%`,
                "--mobile-seat-y": `${mobilePosition.y}%`,
                "--badge-x": `${badgeOffset.x}px`,
                "--badge-y": `${badgeOffset.y}px`,
                "--mobile-badge-x": `${mobileBadgeOffset.x}px`,
                "--mobile-badge-y": `${mobileBadgeOffset.y}px`,
              } as CSSProperties}
              aria-label={accessibleName}
              aria-pressed={mode === "action" ? actionSelected : undefined}
              onClick={() => {
                if (mode === "action") {
                  setActionPlayerId((current) => current === currentPlayer.id ? undefined : currentPlayer.id);
                } else {
                  setSelectedPlayerId(currentPlayer.id);
                }
              }}
              key={currentPlayer.id}
            >
              <span className="issue121SeatNumber">{currentPlayer.seat}</span>
              {asset ? <img src={asset.src} alt="" /> : <span className="issue121MissingAsset">?</span>}
              <strong>{currentPlayer.name}</strong>
              <small>{character?.name}</small>
              {mode === "overview" && currentPlayer.tokens.length > 0 ? (
                <span className="issue121TokenCount" aria-hidden="true">+{currentPlayer.tokens.length}</span>
              ) : null}
            </button>
          );
        })}
      </section>

      {mode === "action" ? (
        <aside className="issue121ActionTray" aria-label="현재 마도서 작업">
          <span>지명 대상</span>
          <strong>{visiblePlayers.find((player) => player.id === actionPlayerId)?.name ?? "선택 대기"}</strong>
          <button type="button" disabled={!actionPlayerId}>선택 확정</button>
        </aside>
      ) : null}

      {selectedPlayer ? (
        <PlayerDetails player={selectedPlayer} closeButtonRef={closeButtonRef} onClose={closeDetails} />
      ) : null}
    </main>
  );
}

function PlayerDetails({
  player: currentPlayer,
  closeButtonRef,
  onClose,
}: {
  player: PrototypePlayer;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  const character = characterFor(currentPlayer.characterId);
  const asset = sectsAndVioletsCharacterAsset(currentPlayer.characterId);
  return (
    <div className="issue121DetailBackdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="issue121PlayerDetail" role="dialog" aria-modal="true" aria-label={`${currentPlayer.seat}번 ${currentPlayer.name} 플레이어 상세`}>
        <header>
          {asset ? <img src={asset.src} alt="" /> : null}
          <div>
            <span>좌석 {currentPlayer.seat}</span>
            <h2>{currentPlayer.name}</h2>
            <strong>{character?.name}</strong>
          </div>
          <button ref={closeButtonRef} type="button" aria-label="플레이어 상세 닫기" onClick={onClose}>×</button>
        </header>
        <div className="issue121DetailBody">
          <section className="issue121CharacterSummary" aria-label="캐릭터 정보">
            <span>캐릭터 능력</span>
            <p>{character?.ability}</p>
          </section>
          <PlayerTokenList tokens={currentPlayer.tokens} />
        </div>
      </section>
    </div>
  );
}

function player(
  seat: number,
  name: string,
  characterId: string,
  tokens: PlayerTokenPresentation[] = [],
): PrototypePlayer {
  return { id: `player-${seat}`, seat, name, characterId, tokens };
}

function token(
  instanceId: string,
  label: string,
  sourceLabel: string,
  sourceCharacterId: string,
  visualKind: PlayerTokenPresentation["visualKind"],
  description: string,
): PlayerTokenPresentation {
  const sourceAsset = sectsAndVioletsCharacterAsset(sourceCharacterId);
  if (!sourceAsset) throw new Error(`Missing prototype token source asset: ${sourceCharacterId}`);
  return { instanceId, label, sourceLabel, sourceIconSrc: sourceAsset.src, visualKind, description };
}

function characterFor(characterId: string) {
  return sectsAndVioletsCharacters.find((character) => character.id === characterId);
}

function inwardBadgeOffset(position: { x: number; y: number }, distance: number) {
  const x = 50 - position.x;
  const y = 50 - position.y;
  const magnitude = Math.hypot(x, y) || 1;
  return { x: x / magnitude * distance, y: y / magnitude * distance };
}

import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import { sectsAndVioletsCharacterAsset } from "./sectsAndVioletsCharacterAssets";
import { sectsAndVioletsCharacters } from "./sectsAndVioletsCharacters";
import { rectangularSeatPositions } from "./sectsAndVioletsGrimoireLayout";
import {
  PlayerTokenList,
  type PlayerTokenPresentation,
} from "./features/grimoire/playerTokenPresentation";
import "./issue121TokenOverviewPrototype.css";
import "./issue135InactiveTokenPrototype.css";

type ReviewState = "active" | "impaired" | "reassigned" | "restored";

type PrototypeToken = Readonly<{
  instanceId: string;
  label: string;
  sourceLabel: string;
  sourceCharacterId: string;
  visualKind: "assignment" | "impairment" | "relationship" | "usage";
  description: string;
  status: "active" | "inactive";
  inactiveReason?: string;
}>;

type PrototypePlayer = Readonly<{
  id: string;
  seat: number;
  name: string;
  characterId: string;
  tokens: readonly PrototypeToken[];
}>;

const reviewStates: ReadonlyArray<{
  id: ReviewState;
  label: string;
  summary: string;
}> = [
  { id: "active", label: "1 · 정상", summary: "노 다시의 중독 토큰이 현재 최근접 주민에게 적용됩니다." },
  { id: "impaired", label: "2 · 노 다시 취함", summary: "배치는 유지되고 중독 토큰만 X 상태로 바뀝니다." },
  { id: "reassigned", label: "3 · 대상 직업 변경", summary: "기존 주민이 외지인이 되어 새 최근접 주민으로 X 토큰이 이동합니다." },
  { id: "restored", label: "4 · 취함 해제", summary: "현재 대상은 유지되고 X만 제거되어 다시 활성화됩니다." },
];

export function Issue135InactiveTokenPrototype() {
  const [reviewState, setReviewState] = useState<ReviewState>("active");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("player-1");
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const seatRefs = useRef(new Map<string, HTMLButtonElement>());
  const players = useMemo(() => playersFor(reviewState), [reviewState]);
  const desktopPositions = useMemo(() => rectangularSeatPositions(players.length, false), [players.length]);
  const mobilePositions = useMemo(() => rectangularSeatPositions(players.length, true), [players.length]);
  const selectedPlayer = players.find((player) => player.id === selectedPlayerId);
  const currentReview = reviewStates.find((state) => state.id === reviewState)!;

  useEffect(() => {
    if (!selectedPlayer) return;
    closeButtonRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeDetails();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedPlayer]);

  function selectReviewState(nextState: ReviewState) {
    setReviewState(nextState);
    setSelectedPlayerId(nextState === "reassigned" || nextState === "restored" ? "player-3" : "player-1");
  }

  function closeDetails() {
    const returningPlayerId = selectedPlayerId;
    setSelectedPlayerId("");
    requestAnimationFrame(() => seatRefs.current.get(returningPlayerId)?.focus());
  }

  return (
    <div className="issue135ReviewRoot">
      <aside className="issue135ReviewControls" aria-label="프로토타입 리뷰 상태">
        <div>
          <span>REVIEW CONTROLS</span>
          <strong>{currentReview.summary}</strong>
        </div>
        <div role="group" aria-label="노 다시 토큰 상태 전환">
          {reviewStates.map((state) => (
            <button
              type="button"
              aria-pressed={reviewState === state.id}
              onClick={() => selectReviewState(state.id)}
              key={state.id}
            >{state.label}</button>
          ))}
        </div>
      </aside>

      <main className="issue121Prototype issue135Prototype" aria-label="이슈 135 무효 토큰 프로토타입">
        <header className="issue121Header">
          <div>
            <span>SECTS &amp; VIOLETS · GRIMOIRE</span>
            <h1>Sects &amp; Violets</h1>
            <p>마도서</p>
          </div>
          <div className="issue121PhaseMark" aria-label="2일차 낮">
            <b>2</b><span>낮</span>
          </div>
        </header>

        <section className="issue121Grimoire overview" role="region" aria-label="낮 마도서">
          <div className="issue121TableGlow" aria-hidden="true" />
          <div className="issue121Center">
            <strong>2일차 낮</strong>
            <span>12:38</span>
            <button type="button">진행 →</button>
          </div>

          {players.map((currentPlayer, index) => {
            const character = characterFor(currentPlayer.characterId);
            const asset = sectsAndVioletsCharacterAsset(currentPlayer.characterId);
            const position = desktopPositions[index];
            const mobilePosition = mobilePositions[index];
            const badgeOffset = inwardBadgeOffset(position, 48);
            const mobileBadgeOffset = inwardBadgeOffset(mobilePosition, 37);
            const tokenCountLabel = currentPlayer.tokens.length > 0
              ? `토큰 ${currentPlayer.tokens.length}개`
              : "토큰 없음";

            return (
              <button
                ref={(node) => {
                  if (node) seatRefs.current.set(currentPlayer.id, node);
                  else seatRefs.current.delete(currentPlayer.id);
                }}
                type="button"
                className={`issue121Seat kind-${character?.kind ?? "townsfolk"}`}
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
                aria-label={`${currentPlayer.seat}번 ${currentPlayer.name} 좌석, ${character?.name}, ${tokenCountLabel}`}
                onClick={() => setSelectedPlayerId(currentPlayer.id)}
                key={currentPlayer.id}
              >
                <span className="issue121SeatNumber">{currentPlayer.seat}</span>
                {asset ? <img src={asset.src} alt="" /> : <span className="issue121MissingAsset">?</span>}
                <strong>{currentPlayer.name}</strong>
                <small>{character?.name}</small>
                {currentPlayer.tokens.length > 0 ? (
                  <span className="issue121TokenCount" aria-hidden="true">+{currentPlayer.tokens.length}</span>
                ) : null}
              </button>
            );
          })}
        </section>

        {selectedPlayer ? (
          <PlayerDetails player={selectedPlayer} closeButtonRef={closeButtonRef} onClose={closeDetails} />
        ) : null}
      </main>
    </div>
  );
}

function PlayerDetails({
  player,
  closeButtonRef,
  onClose,
}: {
  player: PrototypePlayer;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  const character = characterFor(player.characterId);
  const asset = sectsAndVioletsCharacterAsset(player.characterId);
  return (
    <div className="issue121DetailBackdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="issue121PlayerDetail" role="dialog" aria-modal="true" aria-label={`${player.seat}번 ${player.name} 플레이어 상세`}>
        <header>
          {asset ? <img src={asset.src} alt="" /> : null}
          <div>
            <span>좌석 {player.seat}</span>
            <h2>{player.name}</h2>
            <strong>{character?.name}</strong>
          </div>
          <button ref={closeButtonRef} type="button" aria-label="플레이어 상세 닫기" onClick={onClose}>×</button>
        </header>
        <div className="issue121DetailBody">
          <section className="issue121CharacterSummary" aria-label="캐릭터 정보">
            <span>캐릭터 능력</span>
            <p>{character?.ability}</p>
          </section>
          <PlayerTokenList tokens={player.tokens.map(toPlayerTokenPresentation)} theme="night" />
        </div>
      </section>
    </div>
  );
}

function toPlayerTokenPresentation(token: PrototypeToken): PlayerTokenPresentation {
  return {
    instanceId: token.instanceId,
    label: token.label,
    sourceLabel: token.sourceLabel,
    sourceIconSrc: sectsAndVioletsCharacterAsset(token.sourceCharacterId)?.src,
    visualKind: token.visualKind,
    description: token.description,
    inactiveReason: token.status === "inactive" ? token.inactiveReason : undefined,
  };
}

function playersFor(reviewState: ReviewState): readonly PrototypePlayer[] {
  const sourceImpaired = reviewState === "impaired" || reviewState === "reassigned";
  const targetReassigned = reviewState === "reassigned" || reviewState === "restored";
  const poisonStatus = sourceImpaired ? "inactive" as const : "active" as const;
  const poison = token(
    "no-dashii-poison",
    "중독",
    "노 다시",
    "noDashii",
    "impairment",
    "노 다시 양쪽의 가장 가까운 주민입니다.",
    poisonStatus,
    poisonStatus === "inactive" ? "노 다시가 취해 능력이 일시적으로 무효입니다" : undefined,
  );
  return [
    player(1, "유나", targetReassigned ? "mutant" : "dreamer", [
      ...(targetReassigned ? [] : [poison]),
      token("evil-twin-pair", "쌍둥이", "사악한 쌍둥이", "evilTwin", "relationship", "사악한 쌍둥이와 짝인 선한 플레이어입니다."),
    ]),
    player(2, "수아", "noDashii", sourceImpaired ? [
      token("philosopher-drunk", "취함", "철학자", "philosopher", "impairment", "철학자의 능력으로 취했습니다."),
    ] : []),
    player(3, "지우", "clockmaker", [
      ...(targetReassigned ? [poison] : []),
      token("witch-curse", "저주", "마녀", "witch", "assignment", "다음 낮 지명하면 사망합니다."),
    ]),
    player(4, "민서", "philosopher", [
      token("philosopher-marker", "철학자임", "철학자", "philosopher", "assignment", "철학자가 게임 밖 캐릭터의 능력을 가집니다."),
    ]),
    player(5, "도윤", "pitHag"),
    player(6, "하린", "sweetheart", [
      token("sweetheart-drunk", "취함", "사랑꾼", "sweetheart", "impairment", "사랑꾼의 죽음으로 영구히 취한 상태입니다."),
    ]),
    player(7, "민재", "evilTwin"),
    player(8, "예진", "witch", [
      token("artist-spent", "능력 없음", "화가", "artist", "usage", "화가의 게임당 한 번 능력을 이미 사용했습니다."),
    ]),
    player(9, "태윤", "fangGu", [
      token("fang-gu-once", "한 번", "팡 구", "fangGu", "usage", "첫 외지인 이동이 사용되었습니다."),
    ]),
  ];
}

function player(
  seat: number,
  name: string,
  characterId: string,
  tokens: readonly PrototypeToken[] = [],
): PrototypePlayer {
  return { id: `player-${seat}`, seat, name, characterId, tokens };
}

function token(
  instanceId: string,
  label: string,
  sourceLabel: string,
  sourceCharacterId: string,
  visualKind: PrototypeToken["visualKind"],
  description: string,
  status: PrototypeToken["status"] = "active",
  inactiveReason?: string,
): PrototypeToken {
  return { instanceId, label, sourceLabel, sourceCharacterId, visualKind, description, status, inactiveReason };
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

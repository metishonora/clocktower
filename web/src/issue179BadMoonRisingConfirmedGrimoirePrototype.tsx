import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { badMoonRisingCharacters, type BadMoonRisingCharacter } from "./badMoonRisingCharacters";
import {
  PlayerTokenCountBadge,
  PlayerTokenList,
  type PlayerTokenPresentation,
} from "./features/grimoire/playerTokenPresentation";
import {
  Issue179BadMoonRisingGrimoirePrototype,
  type AssignmentMap,
  type FixtureId,
} from "./issue179BadMoonRisingGrimoirePrototype";
import { ProductionApplicationShell } from "./shared-ui/ProductionApplicationShell";
import {
  GrimoirePresentation,
  RectangularGrimoireBoard,
  grimoireHeights,
  rectangularSeatPositions,
} from "./shared-ui/GrimoirePresentation";
import "./issue179BadMoonRisingShellPrototype.css";
import "./issue179BadMoonRisingGrimoirePrototype.css";
import "./features/grimoire/playerTokenPresentation.css";
import "./features/grimoire/sectsAndVioletsSeatStates.css";
import "./issue179BadMoonRisingConfirmedGrimoirePrototype.css";

type Theme = "day" | "night";
type ReviewMode = "confirmed" | "lunatic" | "zombuul";

const playerNames = [
  "서윤", "도윤", "지우", "하준", "민서", "현우", "수아", "준서",
  "예린", "시우", "다은", "민준", "유나", "건우", "채원",
];

const confirmedRoleIds: Record<FixtureId, string[]> = {
  seven: ["grandmother", "sailor", "chambermaid", "exorcist", "tinker", "godfather", "pukka"],
  fifteen: [
    "grandmother", "sailor", "chambermaid", "exorcist", "innkeeper", "gambler", "gossip", "courtier", "professor",
    "tinker", "goon", "godfather", "devilsAdvocate", "assassin", "pukka",
  ],
};

const lunaticRoleIds = [
  "grandmother", "sailor", "chambermaid", "exorcist", "innkeeper", "gambler", "gossip", "courtier", "professor",
  "lunatic", "goon", "godfather", "devilsAdvocate", "assassin", "pukka",
];

const zombuulRoleIds = [
  "grandmother", "sailor", "chambermaid", "exorcist", "innkeeper", "gambler", "gossip", "courtier", "professor",
  "tinker", "goon", "godfather", "devilsAdvocate", "assassin", "zombuul",
];

const zombuulFirstDeathToken: PlayerTokenPresentation = {
  instanceId: "zombuul-dead",
  label: "사망",
  sourceLabel: "좀버얼",
  visualKind: "usage",
  description: "공개상 사망으로 등록되지만 실제로는 생존합니다.",
};

export function Issue179BadMoonRisingConfirmedGrimoirePrototype({
  reviewMode = "confirmed",
}: {
  reviewMode?: ReviewMode;
}) {
  const isLunaticReview = reviewMode === "lunatic";
  const isZombuulReview = reviewMode === "zombuul";
  const isSpecialReview = isLunaticReview || isZombuulReview;
  const [fixtureId, setFixtureId] = useState<FixtureId>(isSpecialReview ? "fifteen" : "seven");
  const [theme, setTheme] = useState<Theme>("night");
  const [selectedSeat, setSelectedSeat] = useState<number | undefined>(isLunaticReview ? 10 : isZombuulReview ? 15 : undefined);
  const [returnConfirmOpen, setReturnConfirmOpen] = useState(false);
  const [returnedToAssignment, setReturnedToAssignment] = useState(false);
  const returnTriggerRef = useRef<HTMLButtonElement>(null);
  const returnCancelRef = useRef<HTMLButtonElement>(null);
  const roleIds = isLunaticReview ? lunaticRoleIds : isZombuulReview ? zombuulRoleIds : confirmedRoleIds[fixtureId];
  const assignments = useMemo<AssignmentMap>(
    () => Object.fromEntries(roleIds.map((roleId, index) => [index + 1, roleId])),
    [roleIds],
  );
  const playerCount = roleIds.length;
  const lunaticSeat = isLunaticReview ? roleIds.indexOf("lunatic") + 1 : undefined;
  const apparentDeadSeat = isZombuulReview ? roleIds.indexOf("zombuul") + 1 : undefined;
  const shownAssignments = lunaticSeat ? { [lunaticSeat]: "pukka" } : undefined;

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Bad Moon Rising · Clocktower";
    return () => {
      document.title = previousTitle;
    };
  }, []);

  useEffect(() => {
    if (!returnConfirmOpen) return;
    returnCancelRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeReturnConfirmation();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [returnConfirmOpen]);

  function applyFixture(nextFixture: FixtureId) {
    setFixtureId(nextFixture);
    setSelectedSeat(undefined);
    setReturnConfirmOpen(false);
  }

  function closeReturnConfirmation() {
    setReturnConfirmOpen(false);
    window.setTimeout(() => returnTriggerRef.current?.focus(), 0);
  }

  if (returnedToAssignment) {
    return <Issue179BadMoonRisingGrimoirePrototype
      initialFixtureId={fixtureId}
      initialAssignmentsOverride={assignments}
      initialRoleIdsOverride={roleIds}
    />;
  }

  return (
    <div className="issue179ReviewRoot issue179GrimoireReviewRoot">
      <section className="issue179ReviewControls" aria-label="프로토타입 검토 설정">
        <div className="issue179ReviewIdentity">
          <strong>ISSUE #179 · {isLunaticReview ? "2C" : isZombuulReview ? "2D" : "2B"}</strong>
          <span>{isLunaticReview ? "미치광이 Actual / Shown" : isZombuulReview ? "좀버얼 사망 리마인더" : "확정된 마도서"}</span>
        </div>
        {isSpecialReview ? <button type="button" onClick={() => setSelectedSeat(isLunaticReview ? lunaticSeat : apparentDeadSeat)}>{isLunaticReview ? "미치광이" : "좀버얼"} 상세 열기</button> : <div role="group" aria-label="인원 검토">
          <button type="button" aria-pressed={fixtureId === "seven"} onClick={() => applyFixture("seven")}>7인 · 읽기 전용</button>
          <button type="button" aria-pressed={fixtureId === "fifteen"} onClick={() => applyFixture("fifteen")}>15인 · 읽기 전용</button>
        </div>}
        <div role="group" aria-label="테마 검토">
          <button type="button" aria-pressed={theme === "night"} onClick={() => setTheme("night")}>Night</button>
          <button type="button" aria-pressed={theme === "day"} onClick={() => setTheme("day")}>Day</button>
        </div>
      </section>

      <div className="issue179ProductFrame">
        <ProductionApplicationShell
          ariaLabel="Bad Moon Rising 게임"
          theme={theme}
          motion="none"
          eyebrow="STORYTELLER CONSOLE"
          title="Bad Moon Rising"
          subtitle={`${playerCount}명`}
          leading={<span className={`issue179SkyDisc ${theme}`} role="img" aria-label={theme === "day" ? "낮 · 해" : "밤 · 혈월"} />}
          headerActionsAriaLabel="되돌리기"
          headerActions={<button type="button" className="snvGlobalUndo empty" data-visual-state="muted" aria-hidden="true" tabIndex={-1} disabled>
            <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M12.2 9.2 6.5 14.8l5.7 5.7" /><path d="M7.2 14.8h10.2a8 8 0 1 1-6.3 12.9" /></svg>
          </button>}
          utilities={[
            { id: "new-game", label: "새 게임", className: "snvNewGameTab", disabled: true },
            { id: "storage", label: "저장 / 불러오기", disabled: true },
            { id: "bug-report", label: "버그 제보", className: "snvBugReportTrigger", disabled: true },
          ]}
          stages={[
            { id: "roles", label: "직업" },
            { id: "seating", label: "마도서", active: true },
            { id: "play", label: "진행", disabled: true },
          ]}
          onNavigate={() => undefined}
          className={`issue179BmrShell issue179BmrGrimoireShell issue179ConfirmedShell ${theme === "day" ? "issue179Day" : "issue179Night"}`}
          classes={{
            header: "snvPrototypeHeader issue179Header",
            eyebrow: "snvEyebrow issue179Eyebrow",
            headerActions: "snvPhaseActions issue179HeaderActions",
            utilities: "snvUtilityTabs issue179Utilities",
            stages: "snvSurfaceTabs issue179Stages",
          }}
        >
          <ConfirmedGrimoire
            playerCount={playerCount}
            assignments={assignments}
            shownAssignments={shownAssignments}
            apparentDeadSeat={apparentDeadSeat}
            selectedSeat={selectedSeat}
            theme={theme}
            returnTriggerRef={returnTriggerRef}
            onSeatSelect={setSelectedSeat}
            onCloseDetails={() => setSelectedSeat(undefined)}
            onRequestReturn={() => setReturnConfirmOpen(true)}
          />
          {returnConfirmOpen ? <div
            className="snvDetailsBackdrop issue179ReturnBackdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeReturnConfirmation();
            }}
          >
            <section className="snvReturnDialog issue179ReturnDialog" role="dialog" aria-modal="true" aria-label="진행 상태 초기화 확인">
              <h2>배치 단계로 돌아갈까요?</h2>
              <p>진행 중인 게임과 모든 상태가 초기화됩니다. 좌석 이름과 직업 배치는 유지됩니다.</p>
              <div>
                <button ref={returnCancelRef} type="button" onClick={closeReturnConfirmation}>취소</button>
                <button type="button" className="snvDestructiveAction" onClick={() => setReturnedToAssignment(true)}>초기화하고 돌아가기</button>
              </div>
            </section>
          </div> : null}
        </ProductionApplicationShell>
      </div>
    </div>
  );
}

function ConfirmedGrimoire({
  playerCount,
  assignments,
  shownAssignments,
  apparentDeadSeat,
  selectedSeat,
  theme,
  returnTriggerRef,
  onSeatSelect,
  onCloseDetails,
  onRequestReturn,
}: {
  playerCount: number;
  assignments: AssignmentMap;
  shownAssignments?: AssignmentMap;
  apparentDeadSeat?: number;
  selectedSeat?: number;
  theme: Theme;
  returnTriggerRef: React.RefObject<HTMLButtonElement | null>;
  onSeatSelect: (seat: number) => void;
  onCloseDetails: () => void;
  onRequestReturn: () => void;
}) {
  const desktopPositions = useMemo(() => rectangularSeatPositions(playerCount, false), [playerCount]);
  const mobilePositions = useMemo(() => rectangularSeatPositions(playerCount, true), [playerCount]);
  const heights = grimoireHeights(playerCount);
  const sizeStyle = {
    "--grimoire-height": `${heights.desktop}px`,
    "--mobile-grimoire-height": `${heights.mobile}px`,
  } as CSSProperties;
  const selectedCharacter = characterById(selectedSeat ? assignments[selectedSeat] : undefined);
  const selectedShownCharacter = characterById(selectedSeat ? shownAssignments?.[selectedSeat] : undefined);

  return <>
    <GrimoirePresentation
      className={`snvSeatingSurface snvTabPanel issue179GrimoireSurface issue179ConfirmedSurface${apparentDeadSeat ? " issue116GrimoireSurface" : ""}`}
      ariaLabel="확정된 Bad Moon Rising 마도서"
      toolbar={<div className="snvSeatingToolbar issue179GrimoireToolbar" aria-label="확정된 마도서 도구">
        <button
          ref={returnTriggerRef}
          type="button"
          className="snvToolbarBack destructive"
          aria-label="배치로 돌아가기"
          onClick={onRequestReturn}
        ><span aria-hidden="true">←</span></button>
        <span className="issue179ConfirmedLabel">배치 확정</span>
      </div>}
      workspaceClassName="snvSeatingWorkspace stable issue179GrimoireWorkspace issue179ConfirmedWorkspace"
      style={sizeStyle}
      board={<RectangularGrimoireBoard
        className="snvGrimoireDraft rectangular issue179GrimoireBoard issue179ConfirmedBoard"
        centerClassName="snvGrimoireCenter issue179GrimoireCenter issue179ConfirmedCenter"
        ariaLabel={`${playerCount}자리 확정 마도서`}
        style={sizeStyle}
        seats={Array.from({ length: playerCount }, (_, index) => {
          const seat = index + 1;
          const character = characterById(assignments[seat])!;
          const shownCharacter = characterById(shownAssignments?.[seat]);
          const displayedCharacter = shownCharacter ?? character;
          const playerName = playerNames[index];
          return {
            id: `seat-${seat}`,
            position: desktopPositions[index],
            mobilePosition: mobilePositions[index],
            className: `fixedSize assigned alignment-${roleAlignment(character)} kind-${character.kind}${seat === apparentDeadSeat ? " snvDeadSeat issue179ApparentDeadSeat" : ""}${selectedSeat === seat ? " selected" : ""}`,
            ariaLabel: shownCharacter
              ? `${seat}번 좌석, ${playerName}, ${shownCharacter.name}로 표시된 ${character.name}, 상세 보기`
              : seat === apparentDeadSeat
                ? `${seat}번 좌석, ${playerName}, ${character.name}, 공개상 사망, 유령표 남음, 실제 생존, 상세 보기`
                : `${seat}번 좌석, ${playerName}, ${character.name}, 상세 보기`,
            pressed: selectedSeat === seat,
            onSelect: () => onSeatSelect(seat),
            content: <>
              <span className="snvSeatNumber">{seat}</span>
              <CharacterMedallion character={displayedCharacter} seat />
              <span className="snvSeatPlayerName">{playerName}</span>
              <small>{displayedCharacter.name}</small>
            </>,
            afterSeat: seat === apparentDeadSeat ? <PlayerTokenCountBadge
              count={1}
              position={desktopPositions[index]}
              mobilePosition={mobilePositions[index]}
              theme={theme}
            /> : undefined,
          };
        })}
        center={<><strong>{playerCount}/{playerCount}</strong><span>배치 확정</span></>}
      />}
    />
    {selectedSeat && selectedCharacter ? <ConfirmedPlayerDetailDialog
      seat={selectedSeat}
      character={selectedCharacter}
      shownCharacter={selectedShownCharacter}
      apparentDead={selectedSeat === apparentDeadSeat}
      theme={theme}
      onClose={onCloseDetails}
    /> : null}
  </>;
}

function ConfirmedPlayerDetailDialog({
  seat,
  character,
  shownCharacter,
  apparentDead = false,
  theme,
  onClose,
}: {
  seat: number;
  character: BadMoonRisingCharacter;
  shownCharacter?: BadMoonRisingCharacter;
  apparentDead?: boolean;
  theme: Theme;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const alignment = roleAlignment(character);

  useEffect(() => {
    closeRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), a[href]") ?? []);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      className={`playerTokenDetailBackdrop issue179BmrDetailBackdrop ${theme}`}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        ref={dialogRef}
        className="playerTokenDetailDialog issue179BmrDetailDialog"
        role="dialog"
        aria-modal="true"
        aria-label={`${seat}번 ${playerNames[seat - 1]} 플레이어 상세`}
      >
        <header>
          <div className="playerTokenCharacterIdentityButton issue179BmrDetailIdentity" aria-label={`${character.name} 직업`}>
            <CharacterMedallion character={character} />
            <strong>{character.name}</strong>
          </div>
          <div>
            <span>좌석 {seat} · {kindLabel(character)}</span>
            <h2>{playerNames[seat - 1]}</h2>
          </div>
          <span
            className={`snvAlignmentIcon alignment-${alignment} playerTokenDetailAlignment`}
            role="img"
            aria-label={`현재 진영 · ${alignment === "evil" ? "악" : "선"}`}
          >{alignment === "evil" ? "악" : "선"}</span>
          <button ref={closeRef} className="playerTokenDetailClose" type="button" aria-label="플레이어 상세 닫기" onClick={onClose}>×</button>
        </header>
        <div className="playerTokenDetailBody">
          {shownCharacter ? <section className="issue179LunaticIdentityComparison" aria-label="미치광이 실제 직업과 보여준 직업">
            <article className="actual">
              <span>실제 직업</span>
              <div><CharacterMedallion character={character} /><p><strong>{character.name}</strong><small>{kindLabel(character)} · 선</small></p></div>
            </article>
            <article className="shown">
              <span>보여준 직업</span>
              <div><CharacterMedallion character={shownCharacter} /><p><strong>{shownCharacter.name}</strong><small>{kindLabel(shownCharacter)}로 보임</small></p></div>
            </article>
          </section> : null}
          <section className="playerTokenCharacterSummary" aria-label="캐릭터 정보">
            <span>{shownCharacter ? "실제 캐릭터 능력" : "캐릭터 능력"}</span>
            <p>{character.ability}</p>
          </section>
          {apparentDead
            ? <PlayerTokenList tokens={[zombuulFirstDeathToken]} theme={theme} />
            : <section className={`playerPinnedTokenArea issue179BmrTokenPlaceholder ${theme}`} aria-label="부착된 캐릭터 토큰 영역">
              <div aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <p><strong>캐릭터 토큰</strong><span>자리 표시자</span></p>
            </section>}
        </div>
      </section>
    </div>,
    document.body,
  );
}

function CharacterMedallion({ character, seat = false }: { character: BadMoonRisingCharacter; seat?: boolean }) {
  return <span className={`issue179CharacterMedallion kind-${character.kind}${seat ? " seat" : ""}`} aria-hidden="true">
    <span>{character.name.slice(0, character.name.length > 3 ? 2 : 1)}</span>
  </span>;
}

function characterById(id?: string) {
  return badMoonRisingCharacters.find((character) => character.id === id);
}

function roleAlignment(character: BadMoonRisingCharacter) {
  return character.kind === "minion" || character.kind === "demon" ? "evil" : "good";
}

function kindLabel(character: BadMoonRisingCharacter) {
  if (character.kind === "townsfolk") return "주민";
  if (character.kind === "outsider") return "외지인";
  if (character.kind === "minion") return "하수인";
  return "악마";
}

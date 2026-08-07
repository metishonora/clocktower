import { useMemo, useState, type CSSProperties } from "react";
import { characterAsset } from "./characterAssets";
import { troubleBrewingCharacterDetail } from "./characterDetails";
import { CharacterDetailButton } from "./components/CharacterRulesCard";
import {
  GrimoirePresentation,
  RectangularGrimoireBoard,
  grimoireHeights,
  rectangularSeatPositions,
} from "./shared-ui/GrimoirePresentation";
import { PlayPresentation } from "./shared-ui/PlayPresentation";
import { ProductionApplicationShell } from "./shared-ui/ProductionApplicationShell";
import { RoleCatalog, SetupPresentation } from "./shared-ui/SetupPresentation";
import {
  characterKinds,
  characters,
  kindLabels,
  type Character,
  type CharacterKind,
} from "./setupDraft";
import "./issue148TroubleBrewingAdaptationPrototype.css";

type Stage = "setup" | "grimoire" | "play";
type FixtureMode = "setup" | "grimoire" | "confirmed" | "play";
type Theme = "day" | "night";
type Distribution = Record<CharacterKind, number>;

const reviewPlayerCounts = [5, 6, 7, 15] as const;
const allPlayerCounts = Array.from({ length: 11 }, (_, index) => index + 5);
const playerNames = [
  "민지", "서연", "준호", "지우", "도윤", "하린", "현우", "유나",
  "태오", "수빈", "은지", "민재", "가영", "정우", "태윤",
];
const townsfolkOrder = [
  "washerwoman", "fortuneTeller", "chef", "empath", "undertaker", "monk", "ravenkeeper",
  "virgin", "slayer", "soldier", "mayor", "librarian", "investigator",
];
const outsiderOrder = ["drunk", "saint", "recluse", "butler"];
const baronMinionOrder = ["baron", "poisoner", "spy", "scarletWoman"];
const playMinionOrder = ["poisoner", "spy", "scarletWoman", "baron"];
const firstNightOrder = [
  "하수인 정보", "악마 정보", "독살범", "세탁부", "사서", "수사관", "요리사", "초공감자", "점쟁이", "집사", "첩자",
];

const baseDistributions: Record<number, Distribution> = {
  5: distribution(3, 0, 1, 1),
  6: distribution(3, 1, 1, 1),
  7: distribution(5, 0, 1, 1),
  8: distribution(5, 1, 1, 1),
  9: distribution(5, 2, 1, 1),
  10: distribution(7, 0, 2, 1),
  11: distribution(7, 1, 2, 1),
  12: distribution(7, 2, 2, 1),
  13: distribution(9, 0, 3, 1),
  14: distribution(9, 1, 3, 1),
  15: distribution(9, 2, 3, 1),
};

export function Issue148TroubleBrewingAdaptationPrototype() {
  const [playerCount, setPlayerCount] = useState(7);
  const [fixtureMode, setFixtureMode] = useState<FixtureMode>("setup");
  const [theme, setTheme] = useState<Theme>("night");
  const [activeStage, setActiveStage] = useState<Stage>("setup");
  const [selectedIds, setSelectedIds] = useState(() => baronRoster(7));
  const [activeCharacterId, setActiveCharacterId] = useState("baron");
  const [rosterConfirmed, setRosterConfirmed] = useState(false);
  const [seatingConfirmed, setSeatingConfirmed] = useState(false);
  const [seatAssignments, setSeatAssignments] = useState<Record<number, string>>({});
  const [seatNames, setSeatNames] = useState(() => fixtureSeatNames(7));
  const [selectedSeat, setSelectedSeat] = useState<number>();
  const [pendingCharacterId, setPendingCharacterId] = useState<string>();
  const [drunkShownCharacterId, setDrunkShownCharacterId] = useState("");

  const effectiveDistribution = setupDistribution(playerCount, selectedIds.includes("baron"));
  const selectedByKind = countKinds(selectedIds);
  const rosterComplete = characterKinds.every(
    (kind) => selectedByKind[kind] === effectiveDistribution[kind],
  );
  const assignedCount = Object.keys(seatAssignments).length;
  const drunkAssigned = Object.values(seatAssignments).includes("drunk");
  const seatingComplete = assignedCount === playerCount && (!drunkAssigned || Boolean(drunkShownCharacterId));

  const applyFixture = (mode: FixtureMode, count = playerCount) => {
    const useBaronRoster = mode === "setup" || mode === "grimoire";
    const roster = useBaronRoster ? baronRoster(count) : firstPlayRoster(count);
    const assignments = mode === "setup" ? {} : assignmentsFor(roster);
    setFixtureMode(mode);
    setPlayerCount(count);
    setSelectedIds(roster);
    setActiveCharacterId(useBaronRoster ? "baron" : "poisoner");
    setRosterConfirmed(mode !== "setup");
    setSeatingConfirmed(mode === "confirmed" || mode === "play");
    setSeatAssignments(assignments);
    setSeatNames(fixtureSeatNames(count));
    setSelectedSeat(undefined);
    setPendingCharacterId(undefined);
    setDrunkShownCharacterId(mode === "grimoire" ? "" : roster.includes("drunk") ? "fortuneTeller" : "");
    setActiveStage(mode === "setup" ? "setup" : mode === "play" ? "play" : "grimoire");
    if (mode === "play") setTheme("night");
  };

  const chooseReviewCount = (count: number) => applyFixture(fixtureMode, count);

  const choosePlayerCount = (count: number) => {
    if (rosterConfirmed) return;
    applyFixture("setup", count);
  };

  const toggleCharacter = (characterId: string) => {
    setActiveCharacterId(characterId);
    if (rosterConfirmed || characterId === "imp") return;
    setSelectedIds((current) => current.includes(characterId)
      ? current.filter((id) => id !== characterId)
      : [...current, characterId]);
  };

  const confirmRoster = () => {
    if (!rosterComplete) return;
    setRosterConfirmed(true);
    setActiveStage("grimoire");
    setSeatAssignments({});
    setSelectedSeat(undefined);
    setPendingCharacterId(undefined);
    setDrunkShownCharacterId("");
  };

  const assignCharacter = (seat: number, characterId: string) => {
    setSeatAssignments((current) => {
      const next = Object.fromEntries(
        Object.entries(current).filter(([assignedSeat, assignedId]) => (
          Number(assignedSeat) === seat || assignedId !== characterId
        )),
      ) as Record<number, string>;
      if (current[seat] === characterId) {
        delete next[seat];
      } else {
        next[seat] = characterId;
      }
      return next;
    });
    setSelectedSeat(seat);
    setPendingCharacterId(undefined);
  };

  const chooseSeat = (seat: number) => {
    if (seatingConfirmed) {
      setSelectedSeat(seat);
      return;
    }
    if (pendingCharacterId) {
      assignCharacter(seat, pendingCharacterId);
      return;
    }
    setSelectedSeat(seat);
  };

  const chooseRosterRole = (characterId: string) => {
    if (seatingConfirmed) return;
    if (selectedSeat) {
      assignCharacter(selectedSeat, characterId);
      return;
    }
    setPendingCharacterId((current) => current === characterId ? undefined : characterId);
  };

  const randomizeAssignments = () => {
    const shuffled = shuffle(selectedIds);
    setSeatAssignments(assignmentsFor(shuffled));
    setSelectedSeat(undefined);
    setPendingCharacterId(undefined);
  };

  const resetAssignments = () => {
    setSeatAssignments({});
    setSelectedSeat(undefined);
    setPendingCharacterId(undefined);
    setDrunkShownCharacterId("");
  };

  const confirmSeating = () => {
    if (!seatingComplete) return;
    setSeatingConfirmed(true);
    setSelectedSeat(undefined);
  };

  const returnToAssignment = () => {
    setSeatingConfirmed(false);
    setSelectedSeat(undefined);
    setPendingCharacterId(undefined);
  };

  const navigate = (destination: string) => {
    if (destination === "storage") return;
    if (destination === "new-game") {
      applyFixture("setup", playerCount);
      return;
    }
    if (destination === "setup") setActiveStage("setup");
    if (destination === "grimoire" && rosterConfirmed) setActiveStage("grimoire");
    if (destination === "play" && seatingConfirmed) setActiveStage("play");
  };

  const subtitle = playerCount <= 6
    ? `${playerCount}명 · 하수인·악마 정보 생략`
    : `${playerCount}명 · 첫날 밤 악 진영 정보 포함`;

  return (
    <div className="issue148ReviewRoot">
      <section className="issue148ReviewControls" aria-label="프로토타입 검토 도구">
        <div>
          <strong>검토 상태</strong>
          <button type="button" aria-pressed={fixtureMode === "setup"} onClick={() => applyFixture("setup")}>직업 시료</button>
          <button type="button" aria-pressed={fixtureMode === "grimoire"} onClick={() => applyFixture("grimoire")}>마도서 편집 시료</button>
          <button type="button" aria-pressed={fixtureMode === "confirmed"} onClick={() => applyFixture("confirmed")}>확정 검토 시료</button>
          <button type="button" aria-pressed={fixtureMode === "play"} onClick={() => applyFixture("play", 7)}>첫 Play 시료</button>
        </div>
        <div>
          <strong>인원 시료</strong>
          {reviewPlayerCounts.map((count) => (
            <button key={count} type="button" aria-pressed={playerCount === count} onClick={() => chooseReviewCount(count)}>{count}인 시료</button>
          ))}
        </div>
        <div>
          <strong>브랜드 토큰</strong>
          <button type="button" aria-pressed={theme === "day"} onClick={() => setTheme("day")}>낮 테마</button>
          <button type="button" aria-pressed={theme === "night"} onClick={() => setTheme("night")}>밤 테마</button>
        </div>
      </section>

      <ProductionApplicationShell
        ariaLabel="Trouble Brewing adaptation prototype"
        theme={theme}
        motion="none"
        title="Trouble Brewing"
        eyebrow="ISSUE 148 · SHARED SHELL ADAPTATION"
        subtitle={subtitle}
        headerActionsAriaLabel="현재 페이즈와 되돌리기"
        headerActions={<>
          <button
            type="button"
            className="snvGlobalUndo empty"
            data-visual-state="muted"
            aria-hidden="true"
            tabIndex={-1}
            disabled
          >
            <svg viewBox="0 0 32 32" aria-hidden="true">
              <path d="M12.2 9.2 6.5 14.8l5.7 5.7" />
              <path d="M7.2 14.8h10.2a8 8 0 1 1-6.3 12.9" />
            </svg>
          </button>
          <span className={`snvPhaseMark issue148PhaseMark ${theme}`} aria-label={theme === "day" ? "낮 테마" : "밤 테마"}>{theme === "day" ? "☀" : "☾"}</span>
        </>}
        utilities={[
          { id: "new-game", label: "새 게임", className: "snvNewGameTab" },
          { id: "storage", label: "저장 / 불러오기" },
          { id: "bug-report", label: "버그 제보", className: "snvBugReportTrigger" },
        ]}
        stages={[
          { id: "setup", label: "직업", active: activeStage === "setup" },
          { id: "grimoire", label: "마도서", active: activeStage === "grimoire", disabled: !rosterConfirmed },
          { id: "play", label: "진행", active: activeStage === "play", disabled: !seatingConfirmed },
        ]}
        onNavigate={navigate}
        className="issue148TroubleBrewingShell"
      >
        {activeStage === "setup" ? (
          <TroubleBrewingSetup
            playerCount={playerCount}
            selectedIds={selectedIds}
            selectedByKind={selectedByKind}
            requiredByKind={effectiveDistribution}
            activeCharacterId={activeCharacterId}
            rosterConfirmed={rosterConfirmed}
            rosterComplete={rosterComplete}
            onPlayerCountSelect={choosePlayerCount}
            onCharacterSelect={toggleCharacter}
            onConfirmRoster={confirmRoster}
          />
        ) : activeStage === "grimoire" ? (
          <TroubleBrewingGrimoire
            playerCount={playerCount}
            selectedIds={selectedIds}
            seatAssignments={seatAssignments}
            seatNames={seatNames}
            selectedSeat={selectedSeat}
            pendingCharacterId={pendingCharacterId}
            drunkShownCharacterId={drunkShownCharacterId}
            assignedCount={assignedCount}
            seatingComplete={seatingComplete}
            seatingConfirmed={seatingConfirmed}
            theme={theme}
            onGoToSetup={() => setActiveStage("setup")}
            onReturnToAssignment={returnToAssignment}
            onRandomize={randomizeAssignments}
            onReset={resetAssignments}
            onSeatSelect={chooseSeat}
            onCloseInspector={() => setSelectedSeat(undefined)}
            onSeatNameChange={(seat, name) => setSeatNames((current) => ({ ...current, [seat]: name }))}
            onCharacterSelect={chooseRosterRole}
            onShownCharacterSelect={setDrunkShownCharacterId}
            onConfirm={confirmSeating}
            onGoToPlay={() => setActiveStage("play")}
          />
        ) : (
          <TroubleBrewingPlay
            playerCount={playerCount}
            onGoToGrimoire={() => setActiveStage("grimoire")}
          />
        )}
      </ProductionApplicationShell>
    </div>
  );
}

function TroubleBrewingSetup({
  playerCount,
  selectedIds,
  selectedByKind,
  requiredByKind,
  activeCharacterId,
  rosterConfirmed,
  rosterComplete,
  onPlayerCountSelect,
  onCharacterSelect,
  onConfirmRoster,
}: {
  playerCount: number;
  selectedIds: string[];
  selectedByKind: Distribution;
  requiredByKind: Distribution;
  activeCharacterId: string;
  rosterConfirmed: boolean;
  rosterComplete: boolean;
  onPlayerCountSelect: (count: number) => void;
  onCharacterSelect: (characterId: string) => void;
  onConfirmRoster: () => void;
}) {
  const activeCharacter = character(activeCharacterId);
  const asset = characterAsset(activeCharacter.id);
  const hasBaron = selectedIds.includes("baron");

  return (
    <SetupPresentation
      ariaLabel="Trouble Brewing 설정 검토"
      className="snvSetupSurface snvTabPanel issue148SetupSurface"
      controls={<div className="snvSetupControls issue148SetupControls">
        <section className="snvControlCard">
          <span>플레이어</span>
          <div className="snvChoiceRow issue148PlayerCounts">
            {allPlayerCounts.map((count) => (
              <button key={count} type="button" aria-pressed={playerCount === count} disabled={rosterConfirmed} onClick={() => onPlayerCountSelect(count)}>{count}명</button>
            ))}
          </div>
        </section>
        <section className="snvControlCard">
          <span>악마</span>
          <button
            type="button"
            className="issue148PinnedDemon"
            aria-label="임프 직업 요약 보기"
            aria-pressed="true"
            onClick={() => onCharacterSelect("imp")}
          >
            <img src={characterAsset("imp")?.src} alt="" />
            <strong>임프</strong>
          </button>
        </section>
        <section className="snvDistributionFlow" aria-label="인원 구성">
          <DistributionValues values={requiredByKind} />
          <p className={`snvModifierNote ${hasBaron ? "active" : ""}`}>
            {hasBaron ? "남작 · 외지인 +2 / 주민 -2" : "남작 없음 · 인원 보정 없음"}
          </p>
        </section>
      </div>}
      catalog={<RoleCatalog
        ariaLabel="Trouble Brewing 직업 선택 패널"
        className={`snvCatalogPreview issue148Catalog${rosterConfirmed ? " rosterConfirmed" : ""}`}
        groupsClassName="snvCatalogGroups"
        groups={characterKinds.map((kind) => ({
          id: kind,
          label: kindLabels[kind],
          selectedCount: selectedByKind[kind],
          requiredCount: requiredByKind[kind],
          roles: characters.filter((candidate) => candidate.kind === kind).map((candidate) => {
            const selected = selectedIds.includes(candidate.id);
            const capacityReached = !selected && selectedByKind[kind] >= requiredByKind[kind];
            return {
              id: candidate.id,
              label: candidate.label,
              selected,
              disabled: !selected && (rosterConfirmed || capacityReached),
              ariaLabel: candidate.label,
            };
          }),
        }))}
        onSelect={onCharacterSelect}
        renderRole={(role) => <>
          {characterAsset(role.id) ? <img src={characterAsset(role.id)?.src} alt="" /> : null}
          <span>{role.label}</span>
        </>}
      />}
      detail={<aside className="snvRoleDetail fixed floatingAction issue148RoleDetail" aria-label="직업 설명">
        <div className="snvRoleDetailIdentity issue148RoleIdentity">
          {asset ? <img className="snvRoleDetailIcon" src={asset.src} alt={`${activeCharacter.label} 공식 캐릭터 아이콘`} /> : null}
          <div className="snvRoleDetailCopy">
            <div><span>{kindLabels[activeCharacter.kind]}</span></div>
            <h2>{activeCharacter.label}</h2>
            <p>{activeCharacter.abilitySummary}</p>
          </div>
        </div>
        <div className="snvRoleDetailActions">
          <button type="button" className="snvConfirmRoster snvStageForward prominent" disabled={rosterConfirmed || !rosterComplete} onClick={onConfirmRoster}>
            <span>{rosterConfirmed ? "확정된 직업" : "직업 선택 확정"}</span><small aria-hidden="true">마도서 →</small>
          </button>
        </div>
      </aside>}
    />
  );
}

function TroubleBrewingGrimoire({
  playerCount,
  selectedIds,
  seatAssignments,
  seatNames,
  selectedSeat,
  pendingCharacterId,
  drunkShownCharacterId,
  assignedCount,
  seatingComplete,
  seatingConfirmed,
  theme,
  onGoToSetup,
  onReturnToAssignment,
  onRandomize,
  onReset,
  onSeatSelect,
  onCloseInspector,
  onSeatNameChange,
  onCharacterSelect,
  onShownCharacterSelect,
  onConfirm,
  onGoToPlay,
}: {
  playerCount: number;
  selectedIds: string[];
  seatAssignments: Record<number, string>;
  seatNames: Record<number, string>;
  selectedSeat?: number;
  pendingCharacterId?: string;
  drunkShownCharacterId: string;
  assignedCount: number;
  seatingComplete: boolean;
  seatingConfirmed: boolean;
  theme: Theme;
  onGoToSetup: () => void;
  onReturnToAssignment: () => void;
  onRandomize: () => void;
  onReset: () => void;
  onSeatSelect: (seat: number) => void;
  onCloseInspector: () => void;
  onSeatNameChange: (seat: number, name: string) => void;
  onCharacterSelect: (characterId: string) => void;
  onShownCharacterSelect: (characterId: string) => void;
  onConfirm: () => void;
  onGoToPlay: () => void;
}) {
  const desktopPositions = useMemo(() => rectangularSeatPositions(playerCount, false), [playerCount]);
  const mobilePositions = useMemo(() => rectangularSeatPositions(playerCount, true), [playerCount]);
  const heights = grimoireHeights(playerCount);
  const sizeStyle = {
    "--grimoire-height": `${heights.desktop}px`,
    "--mobile-grimoire-height": `${heights.mobile}px`,
  } as CSSProperties;
  const currentActorSeat = Number(Object.entries(seatAssignments).find(([, id]) => id === "poisoner")?.[0]) || undefined;
  const selectedCharacterId = selectedSeat ? seatAssignments[selectedSeat] : undefined;
  const selectedCharacter = selectedCharacterId ? character(selectedCharacterId) : undefined;
  const selectedShownCharacter = selectedCharacter?.id === "drunk" && drunkShownCharacterId
    ? character(drunkShownCharacterId)
    : undefined;

  return (
    <GrimoirePresentation
      ariaLabel="Trouble Brewing 마도서 배치"
      className={`snvSeatingSurface snvTabPanel issue148GrimoireSurface ${seatingConfirmed ? "confirmed" : "editing"}`}
      toolbar={<div className="snvSeatingToolbar" aria-label="마도서 배치 도구">
        {seatingConfirmed ? <>
          <button type="button" className="snvToolbarBack destructive" aria-label="배치로 돌아가기" onClick={onReturnToAssignment}><span aria-hidden="true">←</span></button>
          {currentActorSeat ? <div className="snvCurrentActorLegend" aria-label="현재 행동자 안내"><span aria-hidden="true" />현재 행동자</div> : null}
        </> : <>
          <button type="button" className="snvToolbarBack" aria-label="직업 선택으로 돌아가기" onClick={onGoToSetup}><span aria-hidden="true">←</span></button>
          <button type="button" onClick={onRandomize}>무작위 배치</button>
          <button type="button" onClick={onReset}>배치 초기화</button>
        </>}
      </div>}
      workspaceClassName="snvSeatingWorkspace stable"
      style={sizeStyle}
      board={<RectangularGrimoireBoard
        ariaLabel={`${playerCount}자리 Trouble Brewing 마도서`}
        className="snvGrimoireDraft rectangular issue148GrimoireBoard"
        centerClassName={`snvGrimoireCenter ${seatingConfirmed ? "live" : ""}`}
        style={sizeStyle}
        seats={Array.from({ length: playerCount }, (_, index) => {
          const seat = index + 1;
          const characterId = seatAssignments[seat];
          const assignedCharacter = characterId ? character(characterId) : undefined;
          const asset = characterAsset(characterId);
          const isCurrentActor = seatingConfirmed && currentActorSeat === seat;
          const shownCharacter = characterId === "drunk" && drunkShownCharacterId
            ? character(drunkShownCharacterId)
            : undefined;
          const identityLabel = assignedCharacter
            ? assignedCharacter.id === "drunk"
              ? `실제 주정뱅이, 표시 ${shownCharacter?.label ?? "미선택"}`
              : assignedCharacter.label
            : "미할당";
          return {
            id: `seat-${seat}`,
            position: desktopPositions[index],
            mobilePosition: mobilePositions[index],
            className: `fixedSize ${selectedSeat === seat ? "selected " : ""}${isCurrentActor ? "snvCurrentActorSeat " : ""}${assignedCharacter ? `assigned alignment-${alignmentFor(assignedCharacter)} kind-${assignedCharacter.kind.toLowerCase()} character-${assignedCharacter.id}` : "unassigned"}`,
            ariaLabel: `${seat}번 좌석, ${seatNames[seat]}, ${identityLabel}${isCurrentActor ? ", 현재 행동자" : ""}`,
            pressed: selectedSeat === seat,
            onSelect: () => onSeatSelect(seat),
            content: <>
              <span className="snvSeatNumber">{seat}</span>
              {asset ? <img src={asset.src} alt="" /> : null}
              <span className="snvSeatPlayerName">{seatNames[seat]}</span>
              <small>{assignedCharacter?.label ?? "미할당"}</small>
              {assignedCharacter?.id === "drunk" ? (
                <span
                  className={`issue148ShownCharacterToken ${shownCharacter ? "assigned" : "missing"}`}
                  role="img"
                  aria-label={shownCharacter ? `보여준 직업 ${shownCharacter.label} 토큰` : "보여준 직업 미선택 토큰"}
                >
                  {shownCharacter && characterAsset(shownCharacter.id)
                    ? <img src={characterAsset(shownCharacter.id)?.src} alt="" />
                    : <span aria-hidden="true">?</span>}
                </span>
              ) : null}
            </>,
          };
        })}
        center={<>
          <strong>{seatingConfirmed ? "1일차 밤" : `${assignedCount}/${playerCount}`}</strong>
          <span>{seatingConfirmed ? "00:00" : "배치"}</span>
          {seatingConfirmed ? <button type="button" onClick={onGoToPlay}>진행 →</button> : null}
        </>}
      />}
      inspector={<>
        {selectedSeat ? <button type="button" className="snvMobileSeatPanelBackdrop" aria-label="좌석 편집 패널 닫기 배경" onClick={onCloseInspector} /> : null}
        {seatingConfirmed ? (
          <aside className={`snvLiveSeatDetails issue148PlayerDetails transitionIn ${selectedSeat ? "mobileOpen" : "mobileCollapsed"}`} aria-label="좌석 상세 정보">
            {selectedSeat && selectedCharacter ? <>
              <header className="issue148PlayerDetailsHeader">
                <div className="issue148PlayerHeaderRole">
                  {characterAsset(selectedCharacter.id) ? <img src={characterAsset(selectedCharacter.id)?.src} alt="" /> : null}
                  <strong>{selectedCharacter.label}</strong>
                </div>
                <div>
                  <span>{selectedSeat}번 좌석 · {kindLabels[selectedCharacter.kind]}</span>
                  <h2>{seatNames[selectedSeat]}</h2>
                </div>
                <span
                  className={`snvAlignmentIcon alignment-${alignmentFor(selectedCharacter)} issue148PlayerAlignment`}
                  role="img"
                  aria-label={`현재 진영 · ${alignmentFor(selectedCharacter) === "evil" ? "악" : "선"}`}
                >{alignmentFor(selectedCharacter) === "evil" ? "악" : "선"}</span>
                <button type="button" className="issue148PlayerDetailsClose" aria-label="플레이어 상세 닫기" onClick={onCloseInspector}>×</button>
              </header>
              <div className="issue148PlayerDetailsBody">
                {selectedCharacter.id === "drunk" && selectedShownCharacter ? (
                  <section className="issue148DrunkIdentities" aria-label="주정뱅이 아이덴티티">
                    <article>
                      <span>실제 직업</span>
                      <div>
                        {characterAsset(selectedCharacter.id) ? <img src={characterAsset(selectedCharacter.id)?.src} alt="" /> : null}
                        <strong>{selectedCharacter.label}</strong>
                      </div>
                    </article>
                    <article className="shown">
                      <span>보여준 직업</span>
                      <div>
                        {characterAsset(selectedShownCharacter.id) ? <img src={characterAsset(selectedShownCharacter.id)?.src} alt="" /> : null}
                        <strong>{selectedShownCharacter.label}</strong>
                      </div>
                    </article>
                  </section>
                ) : null}
                <section className="issue148CharacterAbility" aria-label="캐릭터 정보">
                  <span>캐릭터 능력</span>
                  <p>{selectedCharacter.abilitySummary}</p>
                </section>
              </div>
            </> : <span>좌석을 선택하세요</span>}
          </aside>
        ) : (
          <aside className={`snvSeatingTray contentHeight issue148SeatInspector ${selectedSeat ? "mobileOpen" : "mobileCollapsed"}`} aria-label="선택한 좌석 편집">
            {selectedSeat ? <div className="snvSeatInspector fixed compactTwoRow">
              <div className="snvSeatInspectorHeader">
                <span>{selectedSeat}번 좌석</span>
                <strong>{selectedCharacter?.label ?? "미할당"}</strong>
                <span className={`snvAlignmentIcon ${selectedCharacter ? `alignment-${alignmentFor(selectedCharacter)}` : "unassigned"}`}>{selectedCharacter ? alignmentFor(selectedCharacter) === "evil" ? "악" : "선" : "-"}</span>
              </div>
              <label className="issue148NameField"><input type="text" aria-label={`${selectedSeat}번 좌석 이름`} value={seatNames[selectedSeat]} onChange={(event) => onSeatNameChange(selectedSeat, event.target.value)} /></label>
              {selectedCharacter?.id === "drunk" ? <div className="issue148DrunkEditor">
                <label><span>보여준 직업</span>
                  <select aria-label="보여준 직업" value={drunkShownCharacterId} onChange={(event) => onShownCharacterSelect(event.target.value)}>
                    <option value="">선택 필요</option>
                    {characters.filter((candidate) => candidate.kind === "Townsfolk").map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}
                  </select>
                </label>
              </div> : null}
            </div> : null}
            <div className="snvSelectedRosterTray">
              {selectedIds.map((id) => {
                const rosterCharacter = character(id);
                const assignedSeat = Number(Object.entries(seatAssignments).find(([, assignedId]) => assignedId === id)?.[0]) || undefined;
                const selectedForSeat = selectedSeat !== undefined && seatAssignments[selectedSeat] === id;
                return <button
                  key={id}
                  type="button"
                  className={`${assignedSeat ? "assigned " : ""}${selectedForSeat ? "selectedForSeat " : ""}compact`}
                  aria-label={assignedSeat ? `${rosterCharacter.label}, ${assignedSeat}번 배치됨` : `${rosterCharacter.label} 배치`}
                  aria-pressed={selectedForSeat || pendingCharacterId === id}
                  onClick={() => onCharacterSelect(id)}
                >
                  {characterAsset(id) ? <img className="compactIcon" src={characterAsset(id)?.src} alt="" /> : null}
                  <span>{rosterCharacter.label}</span>
                </button>;
              })}
            </div>
          </aside>
        )}
      </>}
      actionsClassName={`snvSeatingActions ${seatingConfirmed ? "placeholder" : ""}`}
      actions={!seatingConfirmed ? <button type="button" className="snvConfirmRoster snvConfirmSeating prominent floatingAction" disabled={!seatingComplete} onClick={onConfirm}>배치 확정</button> : undefined}
    />
  );
}

function TroubleBrewingPlay({
  playerCount,
  onGoToGrimoire,
}: {
  playerCount: number;
  onGoToGrimoire: () => void;
}) {
  const order = playerCount <= 6 ? firstNightOrder.slice(2) : firstNightOrder;
  return (
    <PlayPresentation
      ariaLabel="Trouble Brewing 첫 Play 전환"
      className="snvManualSurface snvTabPanel issue148PlaySurface"
      headerClassName="snvFirstNightHeader issue148PlayHeader"
      primaryClassName="snvFirstNightPrimary issue148PlayPrimary"
      phaseHeader={<>
        <button type="button" aria-label="마도서로 이동" onClick={onGoToGrimoire}>← 마도서</button>
        <div className="snvProgressPhaseHeader">
          <h2>1일차 밤</h2>
          <time className="snvProgressRuntime" aria-label="1일차 밤 경과 시간 00:00">00:00</time>
        </div>
      </>}
      currentTask={<article className="snvCurrentStep issue148CurrentTask" role="group" aria-label="독살범 대상 선택">
        <p className="snvCurrentStepLabel">현재 할 일</p>
        <CharacterDetailButton
          details={troubleBrewingCharacterDetail("poisoner")}
          className="snvCurrentStepIdentity interactive issue148ProgressActor"
          theme="snv-night"
        >
          <img src={characterAsset("poisoner")?.src} alt="독살범 공식 캐릭터 아이콘" />
          <span className="snvCurrentStepRoleName" role="heading" aria-level={3}>독살범</span>
        </CharacterDetailButton>
        <strong className="issue148ProgressPlayer">4번 지우</strong>
        <p className="issue148ProgressAbility">{character("poisoner").abilitySummary}</p>
        <div className="snvStepActions">
          <button type="button" onClick={onGoToGrimoire}>← 대상 선택</button>
        </div>
      </article>}
      phaseOrder={
        <ol className="snvPhaseOverview issue148PhaseOrder" aria-label="첫날 밤 순서">
          {order.map((label) => {
            const originalIndex = firstNightOrder.indexOf(label);
            const current = label === "독살범";
            const complete = originalIndex < firstNightOrder.indexOf("독살범");
            return <li key={label} className={current ? "current" : complete ? "complete" : ""}><span>{current ? "현재" : complete ? "완료" : "대기"}</span><strong>{label}</strong></li>;
          })}
        </ol>
      }
    />
  );
}

function DistributionValues({ values }: { values: Distribution }) {
  return <div className="snvDistributionCard emphasized"><h2>인원 구성</h2><div className="snvDistributionValues">
    {characterKinds.map((kind) => <div key={kind} aria-label={`인원 구성 ${kindLabels[kind]} ${values[kind]}명`}><strong>{values[kind]}</strong><span>{kindLabels[kind]}</span></div>)}
  </div></div>;
}

function distribution(Townsfolk: number, Outsider: number, Minion: number, Demon: number): Distribution {
  return { Townsfolk, Outsider, Minion, Demon };
}

function setupDistribution(playerCount: number, hasBaron: boolean): Distribution {
  const base = baseDistributions[playerCount];
  return hasBaron
    ? { ...base, Townsfolk: Math.max(0, base.Townsfolk - 2), Outsider: base.Outsider + 2 }
    : { ...base };
}

function baronRoster(playerCount: number): string[] {
  const counts = setupDistribution(playerCount, true);
  return [
    ...townsfolkOrder.slice(0, counts.Townsfolk),
    ...outsiderOrder.slice(0, counts.Outsider),
    ...baronMinionOrder.slice(0, counts.Minion),
    "imp",
  ];
}

function firstPlayRoster(playerCount: number): string[] {
  const counts = setupDistribution(playerCount, false);
  const roster = [
    ...townsfolkOrder.slice(0, counts.Townsfolk),
    ...outsiderOrder.slice(0, counts.Outsider),
    ...playMinionOrder.slice(0, counts.Minion),
    "imp",
  ];
  const poisonerIndex = roster.indexOf("poisoner");
  if (poisonerIndex >= 0) {
    roster.splice(poisonerIndex, 1);
    roster.splice(Math.min(3, roster.length - 1), 0, "poisoner");
  }
  return roster;
}

function countKinds(ids: string[]): Distribution {
  return ids.reduce((counts, id) => {
    counts[character(id).kind] += 1;
    return counts;
  }, distribution(0, 0, 0, 0));
}

function character(id: string): Character {
  return characters.find((candidate) => candidate.id === id) ?? characters[0];
}

function assignmentsFor(ids: string[]): Record<number, string> {
  return Object.fromEntries(ids.map((id, index) => [index + 1, id]));
}

function fixtureSeatNames(playerCount: number): Record<number, string> {
  return Object.fromEntries(Array.from({ length: playerCount }, (_, index) => [index + 1, playerNames[index]]));
}

function alignmentFor(candidate: Character): "good" | "evil" {
  return candidate.kind === "Minion" || candidate.kind === "Demon" ? "evil" : "good";
}

function shuffle<T>(values: T[]): T[] {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { badMoonRisingCharacters, type BadMoonRisingCharacter } from "./badMoonRisingCharacters";
import { ProductionApplicationShell } from "./shared-ui/ProductionApplicationShell";
import {
  GrimoirePresentation,
  RectangularGrimoireBoard,
  grimoireHeights,
  rectangularSeatPositions,
} from "./shared-ui/GrimoirePresentation";
import "./issue179BadMoonRisingShellPrototype.css";
import "./issue179BadMoonRisingGrimoirePrototype.css";

type Theme = "day" | "night";
export type FixtureId = "seven" | "fifteen";
export type AssignmentMap = Record<number, string>;

const playerNames = [
  "서윤", "도윤", "지우", "하준", "민서", "현우", "수아", "준서",
  "예린", "시우", "다은", "민준", "유나", "건우", "채원",
];

const fixtureRoleIds: Record<FixtureId, string[]> = {
  seven: ["grandmother", "sailor", "chambermaid", "exorcist", "lunatic", "godfather", "zombuul"],
  fifteen: [
    "grandmother", "sailor", "chambermaid", "exorcist", "innkeeper", "gambler", "gossip", "courtier", "professor",
    "tinker", "goon", "godfather", "devilsAdvocate", "assassin", "zombuul",
  ],
};

const initialAssignments: Record<FixtureId, AssignmentMap> = {
  seven: {
    1: "grandmother",
    2: "sailor",
    3: "chambermaid",
    4: "exorcist",
    5: "lunatic",
  },
  fifteen: {
    1: "grandmother",
    2: "sailor",
    3: "chambermaid",
    4: "exorcist",
    5: "innkeeper",
    6: "gambler",
    7: "gossip",
    8: "courtier",
    9: "professor",
    10: "tinker",
    11: "goon",
    12: "godfather",
    13: "devilsAdvocate",
  },
};

const kindLabels = {
  townsfolk: "주민",
  outsider: "외지인",
  minion: "하수인",
  demon: "악마",
} as const;

export function Issue179BadMoonRisingGrimoirePrototype({
  initialFixtureId = "seven",
  initialAssignmentsOverride,
  initialRoleIdsOverride,
}: {
  initialFixtureId?: FixtureId;
  initialAssignmentsOverride?: AssignmentMap;
  initialRoleIdsOverride?: string[];
} = {}) {
  const initialPlayerCount = initialFixtureId === "seven" ? 7 : 15;
  const [fixtureId, setFixtureId] = useState<FixtureId>(initialFixtureId);
  const [theme, setTheme] = useState<Theme>("night");
  const [assignments, setAssignments] = useState<AssignmentMap>(() => ({
    ...(initialAssignmentsOverride ?? initialAssignments[initialFixtureId]),
  }));
  const [seatNames, setSeatNames] = useState<Record<number, string>>(() => namesForCount(initialPlayerCount));
  const [selectedSeat, setSelectedSeat] = useState<number>();
  const [pendingRoleId, setPendingRoleId] = useState<string>();
  const [confirmed, setConfirmed] = useState(false);
  const [roleIdsOverride, setRoleIdsOverride] = useState<string[] | undefined>(initialRoleIdsOverride);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Bad Moon Rising · Clocktower";
    return () => {
      document.title = previousTitle;
    };
  }, []);

  const roleIds = roleIdsOverride ?? fixtureRoleIds[fixtureId];
  const playerCount = fixtureId === "seven" ? 7 : 15;
  const assignedCount = Object.keys(assignments).length;
  const seatingComplete = assignedCount === playerCount;
  const selectedRole = characterById(selectedSeat ? assignments[selectedSeat] : pendingRoleId);

  function applyFixture(nextFixture: FixtureId) {
    const nextCount = nextFixture === "seven" ? 7 : 15;
    setFixtureId(nextFixture);
    setRoleIdsOverride(undefined);
    setAssignments({ ...initialAssignments[nextFixture] });
    setSeatNames(namesForCount(nextCount));
    setSelectedSeat(undefined);
    setPendingRoleId(undefined);
    setConfirmed(false);
  }

  function assignRoleToSeat(roleId: string, seat: number, preserveSelectedSeat = false) {
    setAssignments((current) => {
      const next = { ...current };
      for (const [assignedSeat, assignedRoleId] of Object.entries(next)) {
        if (assignedRoleId === roleId) delete next[Number(assignedSeat)];
      }
      next[seat] = roleId;
      return next;
    });
    setSelectedSeat(preserveSelectedSeat ? seat : undefined);
    setPendingRoleId(undefined);
    setConfirmed(false);
  }

  function chooseSeat(seat: number) {
    if (pendingRoleId) {
      assignRoleToSeat(pendingRoleId, seat);
      return;
    }
    setSelectedSeat((current) => current === seat ? undefined : seat);
  }

  function chooseRole(roleId: string) {
    const assignedSeat = Number(Object.entries(assignments).find(([, assignedRoleId]) => assignedRoleId === roleId)?.[0]);
    if (selectedSeat) {
      if (assignments[selectedSeat] === roleId) {
        setAssignments((current) => {
          const next = { ...current };
          delete next[selectedSeat];
          return next;
        });
        setPendingRoleId(undefined);
        setConfirmed(false);
        return;
      }
      assignRoleToSeat(roleId, selectedSeat, true);
      return;
    }
    if (assignedSeat) {
      setAssignments((current) => {
        const next = { ...current };
        delete next[assignedSeat];
        return next;
      });
      setPendingRoleId(undefined);
      setConfirmed(false);
      return;
    }
    setPendingRoleId((current) => current === roleId ? undefined : roleId);
  }

  function randomize() {
    const next: AssignmentMap = {};
    roleIds.forEach((roleId, index) => {
      next[((index * 4 + 2) % playerCount) + 1] = roleId;
    });
    setAssignments(next);
    setSelectedSeat(undefined);
    setPendingRoleId(undefined);
    setConfirmed(false);
  }

  function resetAssignments() {
    setAssignments({});
    setSelectedSeat(undefined);
    setPendingRoleId(undefined);
    setConfirmed(false);
  }

  return (
    <div className="issue179ReviewRoot issue179GrimoireReviewRoot">
      <section className="issue179ReviewControls" aria-label="프로토타입 검토 설정">
        <div className="issue179ReviewIdentity">
          <strong>ISSUE #179 · 2A</strong>
          <span>마도서 기본 배치</span>
        </div>
        <div role="group" aria-label="인원 검토">
          <button type="button" aria-pressed={fixtureId === "seven"} onClick={() => applyFixture("seven")}>7인 · 기본 배치</button>
          <button type="button" aria-pressed={fixtureId === "fifteen"} onClick={() => applyFixture("fifteen")}>15인 · 최대 배치</button>
        </div>
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
            { id: "new-game", label: "새 게임", className: "snvNewGameTab", onSelect: () => applyFixture(fixtureId) },
            { id: "storage", label: "저장 / 불러오기", disabled: true },
            { id: "bug-report", label: "버그 제보", className: "snvBugReportTrigger", disabled: true },
          ]}
          stages={[
            { id: "roles", label: "직업" },
            { id: "seating", label: "마도서", active: true },
            { id: "play", label: "진행", disabled: true },
          ]}
          onNavigate={() => undefined}
          className={`issue179BmrShell issue179BmrGrimoireShell ${theme === "day" ? "issue179Day" : "issue179Night"}`}
          classes={{
            header: "snvPrototypeHeader issue179Header",
            eyebrow: "snvEyebrow issue179Eyebrow",
            headerActions: "snvPhaseActions issue179HeaderActions",
            utilities: "snvUtilityTabs issue179Utilities",
            stages: "snvSurfaceTabs issue179Stages",
          }}
        >
          <AssignmentSurface
            playerCount={playerCount}
            roleIds={roleIds}
            assignments={assignments}
            seatNames={seatNames}
            selectedSeat={selectedSeat}
            pendingRoleId={pendingRoleId}
            selectedRole={selectedRole}
            assignedCount={assignedCount}
            seatingComplete={seatingComplete}
            confirmed={confirmed}
            onRandomize={randomize}
            onReset={resetAssignments}
            onSeatSelect={chooseSeat}
            onRoleSelect={chooseRole}
            onSeatNameChange={(seat, value) => setSeatNames((current) => ({ ...current, [seat]: value }))}
            onCloseInspector={() => setSelectedSeat(undefined)}
            onConfirm={() => setConfirmed(true)}
          />
        </ProductionApplicationShell>
      </div>
    </div>
  );
}

function AssignmentSurface({
  playerCount,
  roleIds,
  assignments,
  seatNames,
  selectedSeat,
  pendingRoleId,
  selectedRole,
  assignedCount,
  seatingComplete,
  confirmed,
  onRandomize,
  onReset,
  onSeatSelect,
  onRoleSelect,
  onSeatNameChange,
  onCloseInspector,
  onConfirm,
}: {
  playerCount: number;
  roleIds: string[];
  assignments: AssignmentMap;
  seatNames: Record<number, string>;
  selectedSeat?: number;
  pendingRoleId?: string;
  selectedRole?: BadMoonRisingCharacter;
  assignedCount: number;
  seatingComplete: boolean;
  confirmed: boolean;
  onRandomize: () => void;
  onReset: () => void;
  onSeatSelect: (seat: number) => void;
  onRoleSelect: (roleId: string) => void;
  onSeatNameChange: (seat: number, value: string) => void;
  onCloseInspector: () => void;
  onConfirm: () => void;
}) {
  const desktopPositions = useMemo(() => rectangularSeatPositions(playerCount, false), [playerCount]);
  const mobilePositions = useMemo(() => rectangularSeatPositions(playerCount, true), [playerCount]);
  const heights = grimoireHeights(playerCount);
  const sizeStyle = {
    "--grimoire-height": `${heights.desktop}px`,
    "--mobile-grimoire-height": `${heights.mobile}px`,
  } as CSSProperties;

  return (
    <GrimoirePresentation
      className="snvSeatingSurface snvTabPanel assignmentStarted issue179GrimoireSurface"
      ariaLabel="Bad Moon Rising 마도서 배치"
      toolbar={<div className="snvSeatingToolbar issue179GrimoireToolbar" aria-label="마도서 배치 도구">
        <button type="button" className="snvToolbarBack" aria-label="직업 선택으로 돌아가기"><span aria-hidden="true">←</span></button>
        <button type="button" onClick={onRandomize}>무작위 배치</button>
        <button type="button" onClick={onReset}>배치 초기화</button>
      </div>}
      workspaceClassName="snvSeatingWorkspace stable issue179GrimoireWorkspace"
      style={sizeStyle}
      board={<RectangularGrimoireBoard
        className="snvGrimoireDraft rectangular issue179GrimoireBoard"
        centerClassName="snvGrimoireCenter issue179GrimoireCenter"
        ariaLabel={`${playerCount}자리 마도서`}
        style={sizeStyle}
        seats={Array.from({ length: playerCount }, (_, index) => {
          const seat = index + 1;
          const role = characterById(assignments[seat]);
          const playerName = seatNames[seat]?.trim() || `플레이어 ${seat}`;
          return {
            id: `seat-${seat}`,
            position: desktopPositions[index],
            mobilePosition: mobilePositions[index],
            className: `fixedSize ${selectedSeat === seat ? "selected " : ""}${role ? `assigned alignment-${roleAlignment(role)} kind-${role.kind}` : "unassigned"}`,
            ariaLabel: `${seat}번 좌석, ${playerName}, ${role?.name ?? "미할당"}`,
            pressed: selectedSeat === seat,
            onSelect: () => onSeatSelect(seat),
            content: <>
              <span className="snvSeatNumber">{seat}</span>
              {role ? <CharacterMedallion character={role} seat /> : <span className="issue179EmptySeat" aria-hidden="true">+</span>}
              <span className="snvSeatPlayerName">{playerName}</span>
              <small>{role?.name ?? "미할당"}</small>
            </>,
          };
        })}
        center={<>
          <strong>{assignedCount}/{playerCount}</strong>
          <span>{pendingRoleId ? `${selectedRole?.name ?? "직업"} 선택` : selectedSeat ? `${selectedSeat}번 좌석` : "배치"}</span>
        </>}
      />}
      inspector={<>
        {selectedSeat ? <button type="button" className="snvMobileSeatPanelBackdrop" aria-label="좌석 설정 패널 닫기 배경" onClick={onCloseInspector} /> : null}
        <aside className={`snvSeatingTray contentHeight issue179AssignmentTray ${selectedSeat ? "mobileOpen" : "mobileCollapsed"}`} aria-label="배치할 직업">
          {selectedSeat ? <div className="snvSeatInspector fixed compactTwoRow issue179SeatInspector" aria-label="좌석 편집기">
            <div className="snvSeatInspectorHeader">
              <span>{selectedSeat}번 좌석</span>
              <strong>{characterById(assignments[selectedSeat])?.name ?? "미할당"}</strong>
              <span className={`snvAlignmentIcon ${assignments[selectedSeat] ? `alignment-${roleAlignment(characterById(assignments[selectedSeat]))}` : "unassigned"}`} aria-label={assignments[selectedSeat] ? `${roleAlignment(characterById(assignments[selectedSeat])) === "evil" ? "악한" : "선한"} 진영` : "진영 미정"}>
                {assignments[selectedSeat] ? roleAlignment(characterById(assignments[selectedSeat])) === "evil" ? "악" : "선" : "-"}
              </span>
            </div>
            <input type="text" aria-label={`${selectedSeat}번 좌석 이름`} placeholder="플레이어 이름" value={seatNames[selectedSeat] ?? ""} onChange={(event) => onSeatNameChange(selectedSeat, event.target.value)} />
          </div> : null}
          <div className="snvSelectedRosterTray issue179SelectedRosterTray">
            {roleIds.map((roleId) => {
              const role = characterById(roleId)!;
              const assignedSeat = Number(Object.entries(assignments).find(([, assignedRoleId]) => assignedRoleId === roleId)?.[0]);
              const selectedForSeat = Boolean(selectedSeat && assignments[selectedSeat] === roleId);
              return <button
                key={roleId}
                type="button"
                className={`${assignedSeat ? "assigned " : ""}${selectedForSeat ? "selectedForSeat " : ""}compact kind-${role.kind}`}
                aria-label={assignedSeat ? `${role.name}, ${assignedSeat}번 배치됨` : `${role.name} 배치`}
                aria-pressed={selectedForSeat || pendingRoleId === roleId}
                onClick={() => onRoleSelect(roleId)}
              >
                <CharacterMedallion character={role} compact />
                <span><strong>{role.name}</strong><small>{kindLabels[role.kind]}</small></span>
              </button>;
            })}
          </div>
        </aside>
      </>}
      actionsClassName="snvSeatingActions issue179SeatingActions"
      actions={<button type="button" className="snvConfirmRoster snvConfirmSeating prominent floatingAction" disabled={!seatingComplete || confirmed} onClick={onConfirm}>
        {confirmed ? "배치 확정됨" : seatingComplete ? "배치 확정" : `${playerCount - assignedCount}자리 남음`}
      </button>}
    />
  );
}

function CharacterMedallion({ character, compact = false, seat = false }: { character: BadMoonRisingCharacter; compact?: boolean; seat?: boolean }) {
  return <span className={`issue179CharacterMedallion kind-${character.kind}${compact ? " compact" : ""}${seat ? " seat" : ""}`} aria-hidden="true">
    <span>{character.name.slice(0, character.name.length > 3 ? 2 : 1)}</span>
  </span>;
}

function characterById(id?: string) {
  return badMoonRisingCharacters.find((character) => character.id === id);
}

function roleAlignment(character?: BadMoonRisingCharacter) {
  return character?.kind === "minion" || character?.kind === "demon" ? "evil" : "good";
}

function namesForCount(count: number) {
  return Object.fromEntries(playerNames.slice(0, count).map((name, index) => [index + 1, name]));
}

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { badMoonRisingCharacters, type BadMoonRisingCharacter } from "./badMoonRisingCharacters";
import { FuneralIcon } from "./features/grimoire/SeatStateIcons";
import {
  GrimoirePresentation,
  RectangularGrimoireBoard,
  grimoireHeights,
  rectangularSeatPositions,
} from "./shared-ui/GrimoirePresentation";
import { GrimoireToolbar } from "./shared-ui/GrimoireToolbar";
import { ProductionApplicationShell } from "./shared-ui/ProductionApplicationShell";
import "./shared-ui/styles/playPresentation.css";
import "./features/grimoire/sectsAndVioletsSeatStates.css";
import "./issue179BadMoonRisingShellPrototype.css";
import "./issue179BadMoonRisingGrimoirePrototype.css";
import "./issue179BadMoonRisingOrderedDeathPrototype.css";

type Theme = "day" | "night";

const playerNames = [
  "서윤", "도윤", "지우", "하준", "민서", "현우", "수아", "준서",
  "예린", "시우", "다은", "민준", "유나", "건우", "채원",
];

const roleIds = [
  "grandmother", "sailor", "chambermaid", "exorcist", "innkeeper", "gambler", "gossip", "courtier", "professor",
  "tinker", "goon", "godfather", "devilsAdvocate", "assassin", "shabaloth",
] as const;

const orderedResults = [
  { seat: 3, order: "첫 번째", player: "3번 지우", outcome: "사망", dead: true },
  { seat: 8, order: "두 번째", player: "8번 준서", outcome: "생존", dead: false },
] as const;

export function Issue179BadMoonRisingOrderedDeathPrototype() {
  const [theme, setTheme] = useState<Theme>("night");

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Bad Moon Rising · 복수 공격 결과";
    return () => { document.title = previousTitle; };
  }, []);

  return (
    <div className="issue179ReviewRoot issue179OrderedDeathReviewRoot">
      <section className="issue179ReviewControls" aria-label="프로토타입 검토 설정">
        <div className="issue179ReviewIdentity">
          <strong>ISSUE #179 · 3C</strong>
          <span>둘째 밤 · 대상 선택 직후</span>
        </div>
        <span className="issue179OrderedDeathFixtureLabel">순서 1 사망 · 순서 2 생존</span>
        <div role="group" aria-label="테마 검토">
          <button type="button" aria-pressed={theme === "night"} onClick={() => setTheme("night")}>Night</button>
          <button type="button" aria-pressed={theme === "day"} onClick={() => setTheme("day")}>Day</button>
        </div>
      </section>

      <div className="issue179ProductFrame">
        <ProductionApplicationShell
          ariaLabel="Bad Moon Rising 둘째 밤 복수 공격 결과"
          theme={theme}
          motion="none"
          eyebrow="STORYTELLER CONSOLE"
          title="Bad Moon Rising"
          subtitle="15명"
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
            { id: "play", label: "진행" },
          ]}
          onNavigate={() => undefined}
          className={`issue179BmrShell issue179BmrGrimoireShell issue179OrderedDeathShell ${theme === "day" ? "issue179Day" : "issue179Night"}`}
          classes={{
            header: "snvPrototypeHeader issue179Header",
            eyebrow: "snvEyebrow issue179Eyebrow",
            headerActions: "snvPhaseActions issue179HeaderActions",
            utilities: "snvUtilityTabs issue179Utilities",
            stages: "snvSurfaceTabs issue179Stages",
          }}
        >
          <OrderedDeathGrimoire theme={theme} />
        </ProductionApplicationShell>
      </div>
    </div>
  );
}

function OrderedDeathGrimoire({ theme }: { theme: Theme }) {
  const playerCount = roleIds.length;
  const desktopPositions = useMemo(() => rectangularSeatPositions(playerCount, false), [playerCount]);
  const mobilePositions = useMemo(() => rectangularSeatPositions(playerCount, true), [playerCount]);
  const heights = grimoireHeights(playerCount);
  const sizeStyle = {
    "--grimoire-height": `${heights.desktop}px`,
    "--mobile-grimoire-height": `${heights.mobile}px`,
  } as CSSProperties;

  return (
    <GrimoirePresentation
      className={`snvSeatingSurface snvTabPanel issue179GrimoireSurface issue116GrimoireSurface issue116AttackMode issue179OrderedDeathSurface ${theme === "day" ? "snvDayMode" : "snvNightMode"}`}
      ariaLabel="샤발로스 공격 결과 마도서"
      toolbar={<GrimoireToolbar phaseLabel="둘째 밤" showCurrentActor />}
      workspaceClassName="snvSeatingWorkspace stable issue179GrimoireWorkspace issue179OrderedDeathWorkspace"
      style={sizeStyle}
      board={<RectangularGrimoireBoard
        className="snvGrimoireDraft rectangular issue179GrimoireBoard issue179OrderedDeathBoard"
        centerClassName="snvGrimoireCenter live issue179GrimoireCenter issue116PhaseClock"
        centerAriaLabel="현재 단계"
        ariaLabel="15자리 마도서, 샤발로스 공격 처리 완료"
        style={sizeStyle}
        seats={roleIds.map((roleId, index) => {
          const seat = index + 1;
          const character = characterById(roleId)!;
          const result = orderedResults.find((candidate) => candidate.seat === seat);
          const actor = roleId === "shabaloth";
          const dead = result?.dead ?? false;
          return {
            id: `seat-${seat}`,
            position: desktopPositions[index],
            mobilePosition: mobilePositions[index],
            className: `fixedSize assigned alignment-${roleAlignment(character)} kind-${character.kind}${actor ? " snvCurrentActorSeat snvSeatStateActor" : ""}${result ? " snvSeatStateTarget issue179SettledTarget" : " snvSettledOtherSeat"}${dead ? " snvDeadSeat" : ""}`,
            ariaLabel: `${seat}번 좌석, ${playerNames[index]}, ${character.name}${result ? `, ${result.order} 공격 대상, ${result.outcome}` : ""}`,
            interactive: false,
            content: <>
              <span className="snvSeatNumber">{seat}</span>
              <CharacterMedallion character={character} />
              {dead ? <FuneralIcon /> : null}
              <span className="snvSeatPlayerName">{playerNames[index]}</span>
              <small>{result ? `${result.order} · ${result.outcome}` : character.name}</small>
            </>,
          };
        })}
        center={<><strong>둘째 밤</strong><time aria-label="둘째 밤 경과 시간 8분 26초">08:26</time></>}
      />}
      inspector={<OrderedDeathResultPanel />}
    />
  );
}

function OrderedDeathResultPanel() {
  return (
    <aside className="issue116SelectionPanel snvSelectionCompletePanel issue179OrderedDeathResultPanel" aria-label="현재 마도서 작업">
      <header className="issue116SelectionHeader"><h2>샤발로스 공격 결과</h2></header>
      <dl>
        {orderedResults.map((result) => (
          <div key={result.seat} className={result.dead ? "death" : "survived"}>
            <dt>{result.order}</dt>
            <dd><span>{result.player}</span><strong>{result.outcome}</strong></dd>
          </div>
        ))}
      </dl>
      <button type="button" className="issue116PrimaryAction issue116NextAction">다음 →</button>
    </aside>
  );
}

function CharacterMedallion({ character }: { character: BadMoonRisingCharacter }) {
  return <span className={`issue179CharacterMedallion kind-${character.kind} seat`} aria-hidden="true">
    <span>{character.name.slice(0, character.name.length > 3 ? 2 : 1)}</span>
  </span>;
}

function characterById(id: string) {
  return badMoonRisingCharacters.find((character) => character.id === id);
}

function roleAlignment(character: BadMoonRisingCharacter) {
  return character.kind === "minion" || character.kind === "demon" ? "evil" : "good";
}

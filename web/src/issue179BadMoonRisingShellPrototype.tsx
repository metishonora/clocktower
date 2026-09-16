import { useEffect, useMemo, useState } from "react";
import {
  badMoonRisingCharacters,
  type BadMoonRisingCharacter,
  type BadMoonRisingCharacterKind,
} from "./badMoonRisingCharacters";
import { ProductionApplicationShell } from "./shared-ui/ProductionApplicationShell";
import { RoleCatalog, SetupPresentation } from "./shared-ui/SetupPresentation";
import "./issue179BadMoonRisingShellPrototype.css";

type Theme = "day" | "night";
type SetupChoiceId = "addOutsider" | "removeOutsider";
type SetupReviewState = "seven-no-godfather" | "seven-required" | "nine-compare";
type Distribution = Record<BadMoonRisingCharacterKind, number>;

const kindOrder: BadMoonRisingCharacterKind[] = ["townsfolk", "outsider", "minion", "demon"];
const kindLabels: Record<BadMoonRisingCharacterKind, string> = {
  townsfolk: "주민",
  outsider: "외지인",
  minion: "하수인",
  demon: "악마",
};
const playerCounts = Array.from({ length: 9 }, (_, index) => index + 7);
const demonIds = ["zombuul", "pukka", "shabaloth", "po"];
const baseDistributions: Record<number, Distribution> = {
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
const townsfolkOrder = [
  "grandmother", "sailor", "chambermaid", "exorcist", "innkeeper", "gambler", "gossip",
  "courtier", "professor", "minstrel", "teaLady", "pacifist", "fool",
];
const outsiderOrder = ["lunatic", "goon", "moonchild", "tinker"];
const minionOrder = ["godfather", "devilsAdvocate", "assassin", "mastermind"];

export function Issue179BadMoonRisingShellPrototype() {
  const [reviewState, setReviewState] = useState<SetupReviewState>("seven-required");
  const [theme, setTheme] = useState<Theme>("night");
  const initial = reviewFixture("seven-required");
  const [playerCount, setPlayerCount] = useState(initial.playerCount);
  const [selectedIds, setSelectedIds] = useState(initial.selectedIds);
  const [setupChoiceId, setSetupChoiceId] = useState<SetupChoiceId | undefined>(initial.setupChoiceId);
  const [demonId, setDemonId] = useState(initial.demonId);
  const [activeCharacterId, setActiveCharacterId] = useState("godfather");
  const [rosterConfirmed, setRosterConfirmed] = useState(false);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Bad Moon Rising · Clocktower";
    return () => {
      document.title = previousTitle;
    };
  }, []);

  const hasGodfather = selectedIds.includes("godfather");
  const availableChoices = godfatherChoices(playerCount, hasGodfather);
  const displayedGodfatherChoices = godfatherChoices(playerCount, true);
  const previewChoice = setupChoiceId ?? availableChoices[0];
  const requiredByKind = adjustedDistribution(playerCount, previewChoice);
  const selectedByKind = useMemo(() => countKinds(selectedIds), [selectedIds]);
  const rosterComplete = kindOrder.every((kind) => selectedByKind[kind] === requiredByKind[kind]);
  const setupChoiceComplete = !hasGodfather || setupChoiceId !== undefined;
  const activeCharacter = character(activeCharacterId);

  const applyReviewState = (nextState: SetupReviewState) => {
    const fixture = reviewFixture(nextState);
    setReviewState(nextState);
    setPlayerCount(fixture.playerCount);
    setSelectedIds(fixture.selectedIds);
    setSetupChoiceId(fixture.setupChoiceId);
    setDemonId(fixture.demonId);
    setActiveCharacterId("godfather");
    setRosterConfirmed(false);
  };

  const choosePlayerCount = (nextCount: number) => {
    if (rosterConfirmed) return;
    setPlayerCount(nextCount);
    setSetupChoiceId(undefined);
    setSelectedIds([demonId]);
    setActiveCharacterId(demonId);
  };

  const chooseDemon = (nextDemonId: string) => {
    if (rosterConfirmed) return;
    setDemonId(nextDemonId);
    setSelectedIds((current) => [
      ...current.filter((id) => !demonIds.includes(id)),
      nextDemonId,
    ]);
    setActiveCharacterId(nextDemonId);
  };

  const chooseCharacter = (characterId: string) => {
    setActiveCharacterId(characterId);
    if (rosterConfirmed || demonIds.includes(characterId)) return;
    setSelectedIds((current) => {
      if (current.includes(characterId)) {
        if (characterId === "godfather") setSetupChoiceId(undefined);
        return current.filter((id) => id !== characterId);
      }
      if (characterId === "godfather") {
        const choices = godfatherChoices(playerCount, true);
        setSetupChoiceId(choices.length === 1 ? choices[0] : undefined);
      }
      return [...current, characterId];
    });
  };

  const chooseSetupOption = (choiceId: SetupChoiceId) => {
    if (rosterConfirmed) return;
    setSetupChoiceId(choiceId);
  };

  const resetCurrentFixture = () => applyReviewState(reviewState);

  return (
    <div className="issue179ReviewRoot">
      <section className="issue179ReviewControls" aria-label="BMR Setup 프로토타입 검토 도구">
        <div className="issue179ReviewIdentity">
          <strong>1차 · Setup 검토</strong>
          <span>제품 프레임 밖 review controls</span>
        </div>
        <div role="group" aria-label="Setup 검토 상태">
          <button
            type="button"
            aria-pressed={reviewState === "seven-no-godfather"}
            onClick={() => applyReviewState("seven-no-godfather")}
          >7인 · 대부 없음</button>
          <button
            type="button"
            aria-pressed={reviewState === "seven-required"}
            onClick={() => applyReviewState("seven-required")}
          >7인 · 단일 보정</button>
          <button
            type="button"
            aria-pressed={reviewState === "nine-compare"}
            onClick={() => applyReviewState("nine-compare")}
          >9인 · 양방향 비교</button>
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
          leading={<span
            className={`issue179SkyDisc ${theme}`}
            role="img"
            aria-label={theme === "day" ? "낮 · 해" : "밤 · 혈월"}
          />}
          headerActionsAriaLabel="되돌리기"
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
          </>}
          utilities={[
            { id: "new-game", label: "새 게임", className: "snvNewGameTab", onSelect: resetCurrentFixture },
            { id: "storage", label: "저장 / 불러오기", disabled: true },
            { id: "bug-report", label: "버그 제보", className: "snvBugReportTrigger", disabled: true },
          ]}
          stages={[
            { id: "roles", label: "직업", active: true },
            { id: "seating", label: "마도서", disabled: true },
            { id: "play", label: "진행", disabled: true },
          ]}
          onNavigate={() => undefined}
          className={`issue179BmrShell ${theme === "day" ? "issue179Day" : "issue179Night"}`}
          classes={{
            header: "snvPrototypeHeader issue179Header",
            eyebrow: "snvEyebrow issue179Eyebrow",
            headerActions: "snvPhaseActions issue179HeaderActions",
            utilities: "snvUtilityTabs issue179Utilities",
            stages: "snvSurfaceTabs issue179Stages",
          }}
        >
          <SetupPresentation
            ariaLabel="Bad Moon Rising 직업 설정"
            className={`snvSetupSurface snvTabPanel issue179SetupSurface${hasGodfather ? " hasGodfatherAdjustment" : ""}`}
            controls={<div className="snvSetupControls issue179SetupControls">
              <section className="snvControlCard">
                <span>플레이어</span>
                <div className="snvChoiceRow issue179PlayerCounts">
                  {playerCounts.map((count) => (
                    <button
                      key={count}
                      type="button"
                      aria-pressed={playerCount === count}
                      disabled={rosterConfirmed}
                      onClick={() => choosePlayerCount(count)}
                    >{count}명</button>
                  ))}
                </div>
              </section>

              <section className="snvControlCard">
                <span>악마</span>
                <div className="issue179DemonChoices">
                  {demonIds.map((id) => {
                    const demon = character(id);
                    return <button
                      key={id}
                      type="button"
                      aria-pressed={demonId === id}
                      disabled={rosterConfirmed}
                      onClick={() => chooseDemon(id)}
                    >
                      <CharacterMedallion character={demon} compact />
                      <strong>{demon.name}</strong>
                    </button>;
                  })}
                </div>
              </section>

              <div
                className={`issue179SetupChoiceReveal${hasGodfather ? " visible" : ""}`}
                aria-hidden={!hasGodfather}
              >
                <div>
                  <section className="issue179SetupChoice" aria-labelledby="issue179SetupChoiceTitle">
                    <div>
                      <span>대부 보정</span>
                      <strong id="issue179SetupChoiceTitle">인원 구성을 선택하세요</strong>
                    </div>
                    <div className="issue179SetupChoiceOptions">
                      {displayedGodfatherChoices.map((choiceId) => (
                        <button
                          key={choiceId}
                          type="button"
                          aria-pressed={setupChoiceId === choiceId}
                          disabled={rosterConfirmed || !hasGodfather}
                          onClick={() => chooseSetupOption(choiceId)}
                        >
                          <strong>{choiceId === "addOutsider" ? "외지인 +1" : "외지인 -1"}</strong>
                          <span>{choiceId === "addOutsider" ? "주민 -1" : "주민 +1"}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                </div>
              </div>

              <section className="snvDistributionFlow issue179DistributionFlow" aria-label="인원 구성">
                <DistributionValues values={requiredByKind} />
              </section>
            </div>}
            catalog={<RoleCatalog
              ariaLabel="Bad Moon Rising 직업 선택 패널"
              className={`snvCatalogPreview issue179Catalog${rosterConfirmed ? " rosterConfirmed" : ""}`}
              groupsClassName="snvCatalogGroups"
              groups={kindOrder.map((kind) => ({
                id: kind,
                label: kindLabels[kind],
                selectedCount: selectedByKind[kind],
                requiredCount: requiredByKind[kind],
                roles: badMoonRisingCharacters
                  .filter((candidate) => candidate.kind === kind)
                  .map((candidate) => {
                    const selected = selectedIds.includes(candidate.id);
                    const demonLocked = kind === "demon";
                    const capacityReached = !selected && selectedByKind[kind] >= requiredByKind[kind];
                    return {
                      id: candidate.id,
                      label: candidate.name,
                      selected,
                      disabled: rosterConfirmed ? !selected : demonLocked || capacityReached,
                      ariaLabel: candidate.name,
                    };
                  }),
              }))}
              onSelect={chooseCharacter}
              renderRole={(role) => {
                const roleCharacter = character(role.id);
                return <>
                  <CharacterMedallion character={roleCharacter} compact />
                  <span>{role.label}</span>
                </>;
              }}
            />}
            detail={<aside className="snvRoleDetail fixed floatingAction issue179RoleDetail" aria-label="직업 설명">
              {hasGodfather ? <div
                className="issue179MobileGodfatherAdjustment"
                role="group"
                aria-label="대부 보정"
              >
                <span>대부 보정</span>
                <div>
                  {displayedGodfatherChoices.map((choiceId) => (
                    <button
                      key={choiceId}
                      type="button"
                      aria-label={`대부 보정: ${choiceId === "addOutsider" ? "외지인 +1, 주민 -1" : "외지인 -1, 주민 +1"}`}
                      aria-pressed={setupChoiceId === choiceId}
                      disabled={rosterConfirmed}
                      onClick={() => chooseSetupOption(choiceId)}
                    >외지인 {choiceId === "addOutsider" ? "+1" : "-1"}</button>
                  ))}
                </div>
              </div> : null}
              <div
                className="snvRoleDetailIdentity issue179RoleIdentity"
                role="group"
                aria-label={`${activeCharacter.name} 직업 설명`}
              >
                <CharacterMedallion character={activeCharacter} />
                <span className="snvRoleDetailCopy">
                  <span><span>{kindLabels[activeCharacter.kind]}</span></span>
                  <strong>{activeCharacter.name}</strong>
                  <small>{activeCharacter.ability}</small>
                </span>
              </div>
              <div className="snvRoleDetailActions issue179RoleActions">
                <button
                  type="button"
                  className="snvConfirmRoster snvStageForward prominent"
                  disabled={rosterConfirmed || !rosterComplete || !setupChoiceComplete}
                  onClick={() => setRosterConfirmed(true)}
                >
                  <span>{rosterConfirmed ? "확정된 직업" : "직업 선택 확정"}</span>
                  <small aria-hidden="true">마도서 →</small>
                </button>
              </div>
            </aside>}
          />
        </ProductionApplicationShell>
      </div>
    </div>
  );
}

function CharacterMedallion({
  character,
  compact = false,
}: {
  character: BadMoonRisingCharacter;
  compact?: boolean;
}) {
  return <span
    className={`issue179CharacterMedallion kind-${character.kind}${compact ? " compact" : ""}`}
    aria-hidden="true"
  >
    <span>{character.name.slice(0, 1)}</span>
  </span>;
}

function DistributionValues({ values }: { values: Distribution }) {
  return <div className="snvDistributionCard emphasized">
    <h2>인원 구성</h2>
    <div className="snvDistributionValues">
      {kindOrder.map((kind) => (
        <div key={kind} aria-label={`인원 구성 ${kindLabels[kind]} ${values[kind]}명`}>
          <strong>{values[kind]}</strong>
          <span>{kindLabels[kind]}</span>
        </div>
      ))}
    </div>
  </div>;
}

function reviewFixture(state: SetupReviewState) {
  if (state === "nine-compare") {
    return {
      playerCount: 9,
      selectedIds: rosterFor(9, "removeOutsider", "pukka"),
      setupChoiceId: "removeOutsider" as SetupChoiceId,
      demonId: "pukka",
    };
  }
  if (state === "seven-no-godfather") {
    return {
      playerCount: 7,
      selectedIds: [
        ...townsfolkOrder.slice(0, 5),
        "devilsAdvocate",
        "zombuul",
      ],
      setupChoiceId: undefined,
      demonId: "zombuul",
    };
  }
  return {
    playerCount: 7,
    selectedIds: rosterFor(7, "addOutsider", "zombuul"),
    setupChoiceId: "addOutsider" as SetupChoiceId,
    demonId: "zombuul",
  };
}

function rosterFor(playerCount: number, choiceId: SetupChoiceId, demonId: string): string[] {
  const counts = adjustedDistribution(playerCount, choiceId);
  return [
    ...townsfolkOrder.slice(0, counts.townsfolk),
    ...outsiderOrder.slice(0, counts.outsider),
    ...minionOrder.slice(0, counts.minion),
    demonId,
  ];
}

function godfatherChoices(playerCount: number, hasGodfather: boolean): SetupChoiceId[] {
  if (!hasGodfather) return [];
  return baseDistributions[playerCount].outsider === 0
    ? ["addOutsider"]
    : ["addOutsider", "removeOutsider"];
}

function adjustedDistribution(playerCount: number, choiceId?: SetupChoiceId): Distribution {
  const base = baseDistributions[playerCount];
  if (choiceId === "addOutsider") {
    return { ...base, townsfolk: base.townsfolk - 1, outsider: base.outsider + 1 };
  }
  if (choiceId === "removeOutsider") {
    return { ...base, townsfolk: base.townsfolk + 1, outsider: base.outsider - 1 };
  }
  return { ...base };
}

function countKinds(ids: string[]): Distribution {
  return ids.reduce<Distribution>((counts, id) => {
    counts[character(id).kind] += 1;
    return counts;
  }, distribution(0, 0, 0, 0));
}

function distribution(
  townsfolk: number,
  outsider: number,
  minion: number,
  demon: number,
): Distribution {
  return { townsfolk, outsider, minion, demon };
}

function character(id: string): BadMoonRisingCharacter {
  return badMoonRisingCharacters.find((candidate) => candidate.id === id)
    ?? badMoonRisingCharacters[0];
}

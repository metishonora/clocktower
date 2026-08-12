import { useMemo, useState, type ReactNode } from "react";
import { troubleBrewingCharacterDetail } from "./characterDetails";
import type { PhaseStep, Player, RuleState } from "./core/types";
import { CharacterIcon } from "./components/CharacterIcon";
import { CharacterDetailButton } from "./components/CharacterRulesCard";
import { ImpairmentBadges } from "./features/phase-control/ImpairmentBadges";
import { TroubleBrewingGrimoireAssignment } from "./features/trouble-brewing/TroubleBrewingGrimoireAssignment";
import { TroubleBrewingLiveFlow } from "./features/trouble-brewing/TroubleBrewingLiveFlow";
import {
  TroubleBrewingLiveGrimoire,
  type TroubleBrewingSelectionChoices,
} from "./features/trouble-brewing/TroubleBrewingLiveGrimoire";
import type { NominationDraft } from "./features/voting/useNominationDraft";
import { SectsAndVioletsReveal } from "./features/reveal/SectsAndVioletsReveal";
import { SnvGameEndDialog, SnvGameEndDock } from "./features/snv-game-end/SnvGameEnd";
import { PlayPresentation } from "./shared-ui/PlayPresentation";
import { ProductionApplicationShell } from "./shared-ui/ProductionApplicationShell";
import {
  assignActualCharacter,
  characters,
  characterLabel,
  createSetupDraft,
  createSetupDraftFromConfirmedPlayers,
  resetActualCharacters,
  resizeSetupDraft,
  setDrunkShownCharacter,
  unassignActualCharacter,
  updateDraftPlayer,
  type Character,
  type SetupDraft,
} from "./setupDraft";
import "./features/phase-control/sectsAndVioletsInformationTask.css";
import "./features/identity-change/characterChangeReveal.css";
import "./features/day-actions/dayActionDock.css";
import "./features/trouble-brewing/troubleBrewingProduction.css";
import "./features/trouble-brewing/troubleBrewingRevealScreen.css";
import "./issue153TroubleBrewingCharacterPrototypes.css";

type Theme = "day" | "night";
type FixtureStage = "roles" | "grimoire" | "referenceGrimoire" | "progress" | "next";
type SetupInformationReturnStage = "progress" | "next";
type InformationStatus = "healthy" | "poisoned";
type OutsiderFixture = "present" | "none";
type PrototypeCharacterId = "washerwoman" | "librarian" | "investigator";

const ZERO_OUTSIDERS = "zero-outsiders";

const washerwoman = characters.find(({ id }) => id === "washerwoman") as Character;
const librarian = characters.find(({ id }) => id === "librarian") as Character;
const investigator = characters.find(({ id }) => id === "investigator") as Character;
const chef = characters.find(({ id }) => id === "chef") as Character;
const empath = characters.find(({ id }) => id === "empath") as Character;
const fortuneTeller = characters.find(({ id }) => id === "fortuneTeller") as Character;
const undertaker = characters.find(({ id }) => id === "undertaker") as Character;
const monk = characters.find(({ id }) => id === "monk") as Character;
const ravenkeeper = characters.find(({ id }) => id === "ravenkeeper") as Character;
const virgin = characters.find(({ id }) => id === "virgin") as Character;
const slayer = characters.find(({ id }) => id === "slayer") as Character;
const soldier = characters.find(({ id }) => id === "soldier") as Character;
const mayor = characters.find(({ id }) => id === "mayor") as Character;
const butler = characters.find(({ id }) => id === "butler") as Character;
const drunk = characters.find(({ id }) => id === "drunk") as Character;
const recluse = characters.find(({ id }) => id === "recluse") as Character;
const saint = characters.find(({ id }) => id === "saint") as Character;
const poisoner = characters.find(({ id }) => id === "poisoner") as Character;
const spy = characters.find(({ id }) => id === "spy") as Character;
const scarletWoman = characters.find(({ id }) => id === "scarletWoman") as Character;
const imp = characters.find(({ id }) => id === "imp") as Character;

/** Each fixture is exposed on its own review route; there is no character picker. */
export const TROUBLE_BREWING_CHARACTER_FIXTURES = [
  { id: washerwoman.id, label: washerwoman.label, kind: washerwoman.kind },
  { id: librarian.id, label: librarian.label, kind: librarian.kind },
  { id: investigator.id, label: investigator.label, kind: investigator.kind },
  { id: chef.id, label: chef.label, kind: chef.kind },
  { id: empath.id, label: empath.label, kind: empath.kind },
  { id: fortuneTeller.id, label: fortuneTeller.label, kind: fortuneTeller.kind },
  { id: undertaker.id, label: undertaker.label, kind: undertaker.kind },
  { id: monk.id, label: monk.label, kind: monk.kind },
  { id: ravenkeeper.id, label: ravenkeeper.label, kind: ravenkeeper.kind },
  { id: virgin.id, label: virgin.label, kind: virgin.kind },
  { id: slayer.id, label: slayer.label, kind: slayer.kind },
  { id: soldier.id, label: soldier.label, kind: soldier.kind },
  { id: mayor.id, label: mayor.label, kind: mayor.kind },
  { id: butler.id, label: butler.label, kind: butler.kind },
  { id: drunk.id, label: drunk.label, kind: drunk.kind },
  { id: recluse.id, label: recluse.label, kind: recluse.kind },
  { id: saint.id, label: saint.label, kind: saint.kind },
  { id: poisoner.id, label: poisoner.label, kind: poisoner.kind },
  { id: spy.id, label: spy.label, kind: spy.kind },
  { id: scarletWoman.id, label: scarletWoman.label, kind: scarletWoman.kind },
] as const;

type NumericInformationDefinition = {
  character: Character;
  truth: number;
  unit: "쌍" | "명";
  revealLabel: string;
};

const chefInformation: NumericInformationDefinition = {
  character: chef,
  truth: 1,
  unit: "쌍",
  revealLabel: "서로 이웃한 악한 팀",
};

const empathInformation: NumericInformationDefinition = {
  character: empath,
  truth: 1,
  unit: "명",
  revealLabel: "살아있는 양옆 이웃 중 악한 팀",
};

type PrototypeDefinition = {
  character: Character;
  characterId: PrototypeCharacterId;
  characterKind: "Townsfolk" | "Outsider" | "Minion";
  resultCharacterId: string;
  players: Player[];
};

function prototypeDefinition(characterId: PrototypeCharacterId, outsiderFixture: OutsiderFixture): PrototypeDefinition {
  const isLibrarian = characterId === "librarian";
  const isInvestigator = characterId === "investigator";
  return {
    character: isLibrarian ? librarian : isInvestigator ? investigator : washerwoman,
    characterId,
    characterKind: isLibrarian ? "Outsider" : isInvestigator ? "Minion" : "Townsfolk",
    resultCharacterId: isLibrarian ? "saint" : isInvestigator ? "poisoner" : "soldier",
    players: [
      fixturePlayer("issue153-1", 1, "민지", characterId, "good"),
      fixturePlayer("issue153-2", 2, "서연", "chef", "good"),
      fixturePlayer("issue153-3", 3, "준호", "empath", "good"),
      fixturePlayer("issue153-4", 4, "지우", "poisoner", "evil"),
      fixturePlayer("issue153-5", 5, "도윤", "imp", "evil"),
      fixturePlayer("issue153-6", 6, "하린", isLibrarian && outsiderFixture === "present" ? "saint" : "soldier", "good"),
    ],
  };
}

function prototypeStep(definition: PrototypeDefinition, status: InformationStatus): PhaseStep {
  return {
    id: `issue153-${definition.characterId}-information`,
    phase: "firstNight",
    stepType: "character",
    character: definition.characterId,
    playerId: "issue153-1",
    requiredInput: {
      kind: "setupInfo",
      target: "setupInfo",
      minSelections: 2,
      maxSelections: 2,
      setupInfo: definition.characterId,
      characterKind: definition.characterKind,
      allowedCharacterIds: [definition.resultCharacterId],
      zeroAllowed: definition.characterId === "librarian",
      optional: false,
    },
    canSkip: false,
    support: "manual",
    informationPrompt: status === "poisoned" ? {
      deliveryMode: "selectable",
      activeReasons: [{
        type: "poisoned",
        poisonerPlayerId: "issue153-4",
        poisonEventId: `issue153-poisoned-${definition.characterId}`,
      }],
      registrationCandidatePlayerIds: [],
      numberChoices: [],
      setupInfoRegistrationOptions: [],
    } : undefined,
  };
}

function setupInformationReminders(
  characterId: PrototypeCharacterId,
  informationStatus: InformationStatus,
  shownCharacterId: string,
  selectedPlayers: Player[],
): NonNullable<RuleState["automaticReminders"]> {
  if (informationStatus !== "healthy" || shownCharacterId === ZERO_OUTSIDERS || selectedPlayers.length !== 2) {
    return [];
  }
  const correctPlayer = selectedPlayers.find((player) => player.actualCharacter === shownCharacterId);
  const wrongPlayer = selectedPlayers.find((player) => player.id !== correctPlayer?.id);
  if (!correctPlayer || !wrongPlayer) return [];

  const correctToken = characterId === "washerwoman"
    ? { tokenId: "townsfolk", label: "주민", description: "세탁부 정보에서 주민으로 식별된 플레이어입니다." }
    : characterId === "librarian"
      ? { tokenId: "outsider", label: "외지인", description: "사서 정보에서 외지인으로 식별된 플레이어입니다." }
      : { tokenId: "minion", label: "하수인", description: "수사관 정보에서 하수인으로 식별된 플레이어입니다." };
  const sourceEventId = `issue153-${characterId}-setup-information`;

  return [
    {
      playerId: correctPlayer.id,
      characterId,
      ...correctToken,
      sourceEventId,
    },
    {
      playerId: wrongPlayer.id,
      characterId,
      tokenId: "wrong",
      label: "오답",
      description: "설정 정보에서 함께 제시된 다른 플레이어입니다.",
      sourceEventId,
    },
  ];
}

export function Issue153TroubleBrewingCharacterPrototypes() {
  return <SetupInformationPrototype characterId="washerwoman" />;
}

export function Issue153LibrarianPrototype() {
  return <SetupInformationPrototype characterId="librarian" />;
}

export function Issue153InvestigatorPrototype() {
  return <SetupInformationPrototype characterId="investigator" />;
}

export function Issue153ChefPrototype() {
  return <NumericInformationPrototype definition={chefInformation} />;
}

export function Issue153EmpathPrototype() {
  return <NumericInformationPrototype definition={empathInformation} />;
}

export function Issue153FortuneTellerPrototype() {
  return <FortuneTellerPrototype />;
}

export function Issue153UndertakerPrototype() {
  return <UndertakerPrototype />;
}

export function Issue153MonkPrototype() {
  return <MonkPrototype />;
}

export function Issue153RavenkeeperPrototype() {
  return <RavenkeeperPrototype />;
}

export function Issue153VirginPrototype() {
  return <VirginPrototype />;
}

export function Issue153SlayerPrototype() {
  return <SlayerPrototype />;
}

export function Issue153SoldierPrototype() {
  return <SoldierPrototype />;
}

export function Issue153MayorPrototype() {
  return <MayorPrototype />;
}

export function Issue153ButlerPrototype() {
  return <ButlerPrototype />;
}

export function Issue153DrunkPrototype() {
  return <DrunkPrototype />;
}

export function Issue153ReclusePrototype() {
  return <ReclusePrototype />;
}

export function Issue153SaintPrototype() {
  return <SaintPrototype />;
}

export function Issue153PoisonerPrototype() {
  return <PoisonerPrototype />;
}

export function Issue153SpyPrototype() {
  return <SpyPrototype />;
}

export function Issue153ScarletWomanPrototype() {
  return <ScarletWomanPrototype />;
}

function NumericInformationPrototype({ definition }: { definition: NumericInformationDefinition }) {
  const { character, truth, unit, revealLabel } = definition;
  const [theme, setTheme] = useState<Theme>("night");
  const [informationStatus, setInformationStatus] = useState<InformationStatus>("healthy");
  const [stage, setStage] = useState<FixtureStage>("progress");
  const [deliveredNumber, setDeliveredNumber] = useState("0");
  const [revealOpen, setRevealOpen] = useState(false);
  const [revealReviewed, setRevealReviewed] = useState(false);
  const deliveredNumberValid = /^\d+$/.test(deliveredNumber) && Number.isSafeInteger(Number(deliveredNumber));
  const revealedNumber = informationStatus === "healthy" ? truth : deliveredNumberValid ? Number(deliveredNumber) : undefined;

  function reset(status = informationStatus) {
    setInformationStatus(status);
    setStage("progress");
    setDeliveredNumber("0");
    setRevealOpen(false);
    setRevealReviewed(false);
  }

  return (
    <div className="issue153ReviewRoot">
      <ReviewControls
        character={character}
        informationStatus={informationStatus}
        outsiderFixture="present"
        theme={theme}
        onInformationStatusChange={reset}
        onOutsiderFixtureChange={() => undefined}
        onThemeChange={setTheme}
        onReset={() => reset()}
      />
      <ProductionApplicationShell
        ariaLabel={`${character.label} 전체 흐름 fixture`}
        theme={theme}
        motion="none"
        title="Trouble Brewing"
        eyebrow={`ISSUE 153 · ${character.id.toUpperCase()} FLOW`}
        subtitle={`${character.label} · 주민`}
        leading={<span className="issue153FixtureMarker" aria-hidden="true">TB</span>}
        headerActions={<span className="tbPhaseMark" role="img" aria-label={theme === "night" ? "밤" : "낮"}>{theme === "night" ? "☾" : "☀"}</span>}
        headerActionsAriaLabel="현재 페이즈"
        utilities={[
          { id: "new-game", label: "새 게임", disabled: true },
          { id: "storage", label: "저장 / 불러오기", disabled: true },
          { id: "bug-report", label: "버그 제보", disabled: true },
        ]}
        stages={[
          { id: "roles", label: "직업", active: stage === "roles", onSelect: () => setStage("roles") },
          { id: "seating", label: "마도서", active: false, disabled: true },
          { id: "play", label: "진행", active: stage === "progress" || stage === "next", onSelect: () => setStage("progress") },
        ]}
        onNavigate={(next) => { if (next === "roles") setStage("roles"); if (next === "play") setStage("progress"); }}
        className="tbProductionShell issue153ProductionShell"
      >
        {stage === "roles" ? (
          <RoleSelection
            character={character}
            directToProgress
            directActionLabel="정보 확인"
            informationStatus={informationStatus}
            theme={theme}
            onConfirm={() => setStage("progress")}
          />
        ) : null}
        {stage === "progress" || stage === "next" ? (
          <PlayPresentation
            ariaLabel={`${character.label} production-like fixture`}
            className={`snvManualSurface tbPlaySurface issue153PlaySurface ${theme === "day" ? "snvDaySurface" : "snvNightSurface"}`}
            headerClassName="snvFirstNightHeader tbPlayHeader"
            primaryClassName="snvFirstNightPrimary tbPlayPrimary issue153PlayPrimary"
            phaseHeader={<PhaseHeader backLabel="직업" />}
            currentTask={stage === "progress" ? (
              <NumericInformationProgress
                character={character}
                truth={truth}
                unit={unit}
                deliveredNumber={deliveredNumber}
                informationStatus={informationStatus}
                theme={theme}
                revealReviewed={revealReviewed}
                onDeliveredNumberChange={setDeliveredNumber}
                onOpenReveal={() => setRevealOpen(true)}
                onNext={() => setStage("next")}
              />
            ) : <NextStage character={character} />}
            phaseOrder={<PhaseOrder character={character} stage={stage} skipGrimoire />}
          />
        ) : null}
        {revealOpen && revealedNumber !== undefined ? (
          <NumericInformationReveal
            character={character}
            label={revealLabel}
            unit={unit}
            value={revealedNumber}
            onClose={() => { setRevealOpen(false); setRevealReviewed(true); }}
          />
        ) : null}
      </ProductionApplicationShell>
    </div>
  );
}

type UndertakerStage = "progress" | "grimoire" | "next";

const undertakerPlayers: Player[] = [
  fixturePlayer("issue153-undertaker-1", 1, "민지", "undertaker", "good"),
  fixturePlayer("issue153-undertaker-2", 2, "서연", "chef", "good"),
  fixturePlayer("issue153-undertaker-3", 3, "준호", "empath", "good"),
  { ...fixturePlayer("issue153-undertaker-4", 4, "지우", "mayor", "good"), alive: false, deathAnnounced: true },
  fixturePlayer("issue153-undertaker-5", 5, "도윤", "imp", "evil"),
  fixturePlayer("issue153-undertaker-6", 6, "하린", "soldier", "good"),
];

const undertakerExecutedPlayer = undertakerPlayers[3];
const undertakerTruthCharacterId = "mayor";

function UndertakerPrototype() {
  const [theme, setTheme] = useState<Theme>("night");
  const [informationStatus, setInformationStatus] = useState<InformationStatus>("healthy");
  const [stage, setStage] = useState<UndertakerStage>("progress");
  const [grimoireReturnStage, setGrimoireReturnStage] = useState<"progress" | "next">("progress");
  const [deliveredCharacterId, setDeliveredCharacterId] = useState("");
  const [revealOpen, setRevealOpen] = useState(false);
  const [revealReviewed, setRevealReviewed] = useState(false);
  const revealedCharacterId = informationStatus === "healthy" ? undertakerTruthCharacterId : deliveredCharacterId;
  const ruleState: RuleState = {
    unannouncedNightDeathPlayerIds: [],
    automaticReminders: [{
      playerId: undertakerExecutedPlayer.id,
      characterId: "undertaker",
      tokenId: "diedToday",
      label: "오늘 사망",
      description: "오늘 낮 처형으로 사망한 플레이어입니다.",
      sourceEventId: "issue153-undertaker-execution-death",
    }],
  };

  function reset(status = informationStatus) {
    setInformationStatus(status);
    setStage("progress");
    setGrimoireReturnStage("progress");
    setDeliveredCharacterId("");
    setRevealOpen(false);
    setRevealReviewed(false);
  }

  function openGrimoire() {
    if (stage === "grimoire") return;
    setGrimoireReturnStage(stage);
    setStage("grimoire");
  }

  function returnToProgress() {
    setStage(grimoireReturnStage);
  }

  return (
    <div className="issue153ReviewRoot">
      <ReviewControls
        character={undertaker}
        informationStatus={informationStatus}
        outsiderFixture="present"
        theme={theme}
        onInformationStatusChange={reset}
        onOutsiderFixtureChange={() => undefined}
        onThemeChange={setTheme}
        onReset={() => reset()}
      />
      <ProductionApplicationShell
        ariaLabel="장의사 전체 흐름 fixture"
        theme={theme}
        motion="none"
        title="Trouble Brewing"
        eyebrow="ISSUE 153 · UNDERTAKER FLOW"
        subtitle="장의사 · 주민"
        leading={<span className="issue153FixtureMarker" aria-hidden="true">TB</span>}
        headerActions={<span className="tbPhaseMark" role="img" aria-label={theme === "night" ? "밤" : "낮"}>{theme === "night" ? "☾" : "☀"}</span>}
        headerActionsAriaLabel="현재 페이즈"
        utilities={[
          { id: "new-game", label: "새 게임", disabled: true },
          { id: "storage", label: "저장 / 불러오기", disabled: true },
          { id: "bug-report", label: "버그 제보", disabled: true },
        ]}
        stages={[
          { id: "roles", label: "직업", disabled: true },
          { id: "seating", label: "마도서", active: stage === "grimoire", onSelect: openGrimoire },
          { id: "play", label: "진행", active: stage !== "grimoire", onSelect: returnToProgress },
        ]}
        onNavigate={(next) => { if (next === "seating") openGrimoire(); if (next === "play") returnToProgress(); }}
        className="tbProductionShell issue153ProductionShell"
      >
        {stage === "grimoire" ? (
          <section className="issue153GrimoireStage" aria-label="장의사 마도서 열람">
            <TroubleBrewingLiveGrimoire
              players={undertakerPlayers}
              phaseLabel="2일차 밤"
              phaseRuntime="00:00"
              theme={theme}
              busy={false}
              gameEnded={false}
              interactionLocked
              ruleState={ruleState}
              onGoToProgress={returnToProgress}
              progressActionLabel="진행 →"
            />
          </section>
        ) : (
          <PlayPresentation
            ariaLabel="장의사 production-like fixture"
            className={`snvManualSurface tbPlaySurface issue153PlaySurface ${theme === "day" ? "snvDaySurface" : "snvNightSurface"}`}
            headerClassName="snvFirstNightHeader tbPlayHeader"
            primaryClassName="snvFirstNightPrimary tbPlayPrimary issue153PlayPrimary"
            phaseHeader={<PhaseHeader phaseLabel="2일차 밤" />}
            currentTask={stage === "progress" ? (
              <UndertakerInformationTask
                informationStatus={informationStatus}
                theme={theme}
                deliveredCharacterId={deliveredCharacterId}
                revealReviewed={revealReviewed}
                onDeliveredCharacterChange={setDeliveredCharacterId}
                onOpenReveal={() => setRevealOpen(true)}
                onNext={() => setStage("next")}
              />
            ) : <NextStage character={undertaker} />}
            phaseOrder={<UndertakerPhaseOrder stage={stage} />}
          />
        )}
        {revealOpen && revealedCharacterId ? (
          <UndertakerReveal
            characterId={revealedCharacterId}
            onClose={() => { setRevealOpen(false); setRevealReviewed(true); }}
          />
        ) : null}
      </ProductionApplicationShell>
    </div>
  );
}

function UndertakerInformationTask({
  informationStatus,
  theme,
  deliveredCharacterId,
  revealReviewed,
  onDeliveredCharacterChange,
  onOpenReveal,
  onNext,
}: {
  informationStatus: InformationStatus;
  theme: Theme;
  deliveredCharacterId: string;
  revealReviewed: boolean;
  onDeliveredCharacterChange: (characterId: string) => void;
  onOpenReveal: () => void;
  onNext: () => void;
}) {
  const poisoned = informationStatus === "poisoned";
  const canReveal = !poisoned || deliveredCharacterId.length > 0;
  return (
    <article className="snvCurrentStep snvInformationTask tbCurrentTask issue153SetupInformationProgressCard" aria-label="장의사 정보">
      <p className="snvCurrentStepLabel">현재 할 일</p>
      <PrototypeActorIdentity character={undertaker} informationStatus={informationStatus} theme={theme} />
      <p className="issue153ProgressAbility">{undertaker.abilitySummary}</p>
      <div className="issue153TargetSummary" aria-label="장의사 대상"><span>대상</span><strong>{undertakerExecutedPlayer.seat}번 {undertakerExecutedPlayer.name}</strong></div>
      <dl className="snvInformationValues issue153ScalarTruth" role="group" aria-label="장의사 진실">
        <div><dt>진실</dt><dd>{characterLabel(undertakerTruthCharacterId)}</dd></div>
      </dl>
      {poisoned ? (
        <label className="issue153CharacterSelect">
          <span>전달할 캐릭터</span>
          <select aria-label="전달할 캐릭터" disabled={revealReviewed} value={deliveredCharacterId} onChange={(event) => onDeliveredCharacterChange(event.target.value)}>
            <option value="">선택하세요</option>
            {characters.map((character) => <option key={character.id} value={character.id}>{character.label}</option>)}
          </select>
        </label>
      ) : null}
      <div className="snvStepActions snvInformationActions issue153TaskActions">
        <button
          type="button"
          className={["informationReveal", revealReviewed ? "issue153SecondaryReveal" : "prominent", poisoned ? "poisoned" : ""].filter(Boolean).join(" ")}
          disabled={!canReveal}
          onClick={onOpenReveal}
        >{poisoned ? "중독 정보 공개" : "정보 공개"}</button>
        {revealReviewed ? <button type="button" className="issue153PrimaryAction" onClick={onNext}>다음 단계</button> : null}
      </div>
    </article>
  );
}

function UndertakerReveal({ characterId, onClose }: { characterId: string; onClose: () => void }) {
  const revealedCharacter = characters.find((character) => character.id === characterId);
  return (
    <SectsAndVioletsReveal
      dialogLabel="장의사 정보 공개"
      backdropAriaLabel="플레이어 공개 화면"
      className="snvProductionInformationReveal tbInformationReveal issue153SetupInformationReveal"
      closeLabel="확인했으면 눈을 감으세요"
      onClose={onClose}
    >
      <header className="issue153RevealHeader"><span>장의사 정보</span></header>
      <div className="issue153RevealSeatCards" role="group" aria-label="처형 사망자">
        <article className="issue153RevealSeatCard" aria-label={`${undertakerExecutedPlayer.seat}번 ${undertakerExecutedPlayer.name} 좌석`}>
          <span>{undertakerExecutedPlayer.seat}</span>
          <strong>{undertakerExecutedPlayer.seat}번 {undertakerExecutedPlayer.name}</strong>
        </article>
      </div>
      <p className="issue153RevealPrompt">이 자의 직업은…</p>
      {revealedCharacter ? (
        <div className="issue153RevealResult" role="group" aria-label={`공개 직업 ${revealedCharacter.label}`}>
          <CharacterIcon characterId={revealedCharacter.id} />
          <h2>{revealedCharacter.label}</h2>
        </div>
      ) : null}
    </SectsAndVioletsReveal>
  );
}

function UndertakerPhaseOrder({ stage }: { stage: UndertakerStage }) {
  const current = stage === "next" ? 2 : 1;
  return (
    <ol className="snvPhaseOverview issue153PhaseOrder" aria-label="장의사 단계 순서">
      {["오늘 처형", "정보 공개", "다음 단계"].map((label, index) => (
        <li className={index < current ? "complete" : index === current ? "current" : undefined} key={label}>
          <span>{index < current ? "완료" : index === current ? "현재" : "대기"}</span><strong>{label}</strong>
        </li>
      ))}
    </ol>
  );
}

type MonkStage = "progress" | "selection" | "referenceGrimoire" | "next";

const monkPlayers: Player[] = [
  fixturePlayer("issue153-monk-1", 1, "민지", "monk", "good"),
  fixturePlayer("issue153-monk-2", 2, "서연", "chef", "good"),
  fixturePlayer("issue153-monk-3", 3, "준호", "empath", "good"),
  fixturePlayer("issue153-monk-4", 4, "지우", "mayor", "good"),
  fixturePlayer("issue153-monk-5", 5, "도윤", "imp", "evil"),
  fixturePlayer("issue153-monk-6", 6, "하린", "soldier", "good"),
];

const monkStep: PhaseStep = {
  id: "night2:monk",
  phase: "night",
  stepType: "character",
  character: "monk",
  playerId: monkPlayers[0].id,
  requiredInput: {
    kind: "playerIds",
    target: "player",
    minSelections: 1,
    maxSelections: 1,
    allowedPlayerIds: monkPlayers.slice(1).map((player) => player.id),
    optional: false,
  },
  canSkip: false,
  support: "manual",
};

function MonkPrototype() {
  const [theme, setTheme] = useState<Theme>("night");
  const [informationStatus, setInformationStatus] = useState<InformationStatus>("healthy");
  const [stage, setStage] = useState<MonkStage>("progress");
  const [referenceReturnStage, setReferenceReturnStage] = useState<"progress" | "next">("progress");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const selectedPlayer = monkPlayers.find((player) => player.id === selectedPlayerIds[0]);
  const selectionConfirmed = (stage === "next" || stage === "referenceGrimoire") && Boolean(selectedPlayer);
  const protectionApplied = informationStatus === "healthy" && selectionConfirmed;
  const ruleState: RuleState = {
    unannouncedNightDeathPlayerIds: [],
    activeProtection: protectionApplied && selectedPlayer ? {
      playerId: selectedPlayer.id,
      sourcePlayerId: monkPlayers[0].id,
      sourceEventId: "issue153-monk-protection",
    } : undefined,
    automaticReminders: selectionConfirmed && selectedPlayer ? [{
      playerId: selectedPlayer.id,
      characterId: "monk",
      tokenId: "safe",
      label: "안전",
      description: "수도사가 오늘 밤 악마로부터 보호한 대상입니다.",
      sourceEventId: "issue153-monk-protection",
      inactiveReason: informationStatus === "poisoned"
        ? "수도사가 중독되어 능력이 일시적으로 무효입니다."
        : undefined,
    }] : [],
  };

  function reset(status = informationStatus) {
    setInformationStatus(status);
    setStage("progress");
    setReferenceReturnStage("progress");
    setSelectedPlayerIds([]);
  }

  function startSelection() {
    setSelectedPlayerIds([]);
    setStage("selection");
  }

  function togglePlayer(playerId: string) {
    setSelectedPlayerIds((current) => current[0] === playerId ? [] : [playerId]);
  }

  function openReferenceGrimoire() {
    if (stage === "selection" || stage === "referenceGrimoire") return;
    setReferenceReturnStage(stage);
    setStage("referenceGrimoire");
  }

  function returnFromReferenceGrimoire() {
    setStage(referenceReturnStage);
  }

  function cancelSelection() {
    setSelectedPlayerIds([]);
    setStage("progress");
  }

  function openProgress() {
    if (stage === "selection") cancelSelection();
    else if (stage === "referenceGrimoire") returnFromReferenceGrimoire();
  }

  return (
    <div className="issue153ReviewRoot">
      <ReviewControls
        character={monk}
        informationStatus={informationStatus}
        outsiderFixture="present"
        theme={theme}
        description="진행 탭과 마도서의 보호 대상 선택, 공식 토큰 흐름을 검토합니다."
        onInformationStatusChange={reset}
        onOutsiderFixtureChange={() => undefined}
        onThemeChange={setTheme}
        onReset={() => reset()}
      />
      <ProductionApplicationShell
        ariaLabel="수도사 전체 흐름 fixture"
        theme={theme}
        motion="none"
        title="Trouble Brewing"
        eyebrow="ISSUE 153 · MONK FLOW"
        subtitle="수도사 · 주민"
        leading={<span className="issue153FixtureMarker" aria-hidden="true">TB</span>}
        headerActions={<span className="tbPhaseMark" role="img" aria-label={theme === "night" ? "밤" : "낮"}>{theme === "night" ? "☾" : "☀"}</span>}
        headerActionsAriaLabel="현재 페이즈"
        utilities={[
          { id: "new-game", label: "새 게임", disabled: true },
          { id: "storage", label: "저장 / 불러오기", disabled: true },
          { id: "bug-report", label: "버그 제보", disabled: true },
        ]}
        stages={[
          { id: "roles", label: "직업", disabled: true },
          { id: "seating", label: "마도서", active: stage === "selection" || stage === "referenceGrimoire", onSelect: openReferenceGrimoire },
          { id: "play", label: "진행", active: stage === "progress" || stage === "next", onSelect: openProgress },
        ]}
        onNavigate={(next) => {
          if (next === "seating") openReferenceGrimoire();
          if (next === "play") openProgress();
        }}
        className="tbProductionShell issue153ProductionShell"
      >
        {stage === "selection" ? (
          <section className="issue153GrimoireStage" aria-label="수도사 마도서 선택">
            <TroubleBrewingLiveGrimoire
              players={monkPlayers}
              currentStep={monkStep}
              phaseLabel="2일차 밤"
              phaseRuntime="00:00"
              theme={theme}
              busy={false}
              gameEnded={false}
              handoff="target"
              phasePlayerSelection={{ selectedPlayerIds, allowedPlayerIds: monkStep.requiredInput.allowedPlayerIds, disabled: false, onTogglePlayer: togglePlayer }}
              onConfirmSelection={() => setStage("next")}
              onResetSelection={() => setSelectedPlayerIds([])}
              onCancelSelection={cancelSelection}
              selectionReady={selectedPlayerIds.length === 1}
            />
          </section>
        ) : stage === "referenceGrimoire" ? (
          <section className="issue153GrimoireStage" aria-label="수도사 마도서 열람">
            <TroubleBrewingLiveGrimoire
              players={monkPlayers}
              phaseLabel="2일차 밤"
              phaseRuntime="00:00"
              theme={theme}
              busy={false}
              gameEnded={false}
              interactionLocked
              ruleState={ruleState}
              onGoToProgress={returnFromReferenceGrimoire}
              progressActionLabel="진행 →"
            />
          </section>
        ) : (
          <PlayPresentation
            ariaLabel="수도사 production-like fixture"
            className={`snvManualSurface tbPlaySurface issue153PlaySurface ${theme === "day" ? "snvDaySurface" : "snvNightSurface"}`}
            headerClassName="snvFirstNightHeader tbPlayHeader"
            primaryClassName="snvFirstNightPrimary tbPlayPrimary issue153PlayPrimary"
            phaseHeader={<PhaseHeader phaseLabel="2일차 밤" />}
            currentTask={stage === "progress" ? (
              <MonkProtectionTask informationStatus={informationStatus} theme={theme} onChooseTarget={startSelection} />
            ) : (
              <article className="issue153NextStage" aria-label="수도사 다음 단계"><span>NEXT STEP</span><h2>수도사 행동 완료</h2><p>보호 대상 선택을 완료했습니다.</p></article>
            )}
            phaseOrder={<MonkPhaseOrder stage={stage} />}
          />
        )}
      </ProductionApplicationShell>
    </div>
  );
}

function MonkProtectionTask({
  informationStatus,
  theme,
  onChooseTarget,
}: {
  informationStatus: InformationStatus;
  theme: Theme;
  onChooseTarget: () => void;
}) {
  return (
    <article className="snvCurrentStep snvInformationTask tbCurrentTask issue153SetupInformationProgressCard" aria-label="수도사 보호 대상 선택">
      <p className="snvCurrentStepLabel">현재 할 일</p>
      <PrototypeActorIdentity character={monk} informationStatus={informationStatus} theme={theme} />
      <p className="issue153ProgressAbility">{monk.abilitySummary}</p>
      <div className="snvStepActions snvInformationActions issue153TaskActions">
        <button type="button" className="issue153PrimaryAction" onClick={onChooseTarget}>대상 선택</button>
      </div>
    </article>
  );
}

function MonkPhaseOrder({ stage }: { stage: MonkStage }) {
  const current = stage === "next" ? 1 : 0;
  return (
    <ol className="snvPhaseOverview issue153PhaseOrder" aria-label="수도사 단계 순서">
      {["보호 대상 선택", "다음 단계"].map((label, index) => (
        <li className={index < current ? "complete" : index === current ? "current" : undefined} key={label}>
          <span>{index < current ? "완료" : index === current ? "현재" : "대기"}</span><strong>{label}</strong>
        </li>
      ))}
    </ol>
  );
}

type RavenkeeperStage = "targetProgress" | "targetGrimoire" | "referenceGrimoire" | "information" | "next";
type RavenkeeperProgressStage = Exclude<RavenkeeperStage, "targetGrimoire" | "referenceGrimoire">;

const ravenkeeperPlayers: Player[] = [
  { ...fixturePlayer("issue153-ravenkeeper-1", 1, "민지", "ravenkeeper", "good"), alive: false },
  fixturePlayer("issue153-ravenkeeper-2", 2, "서연", "chef", "good"),
  fixturePlayer("issue153-ravenkeeper-3", 3, "준호", "empath", "good"),
  fixturePlayer("issue153-ravenkeeper-4", 4, "지우", "mayor", "good"),
  fixturePlayer("issue153-ravenkeeper-5", 5, "도윤", "imp", "evil"),
  fixturePlayer("issue153-ravenkeeper-6", 6, "하린", "soldier", "good"),
];

const ravenkeeperStep: PhaseStep = {
  id: "night2:ravenkeeper",
  phase: "night",
  stepType: "character",
  character: "ravenkeeper",
  playerId: ravenkeeperPlayers[0].id,
  requiredInput: {
    kind: "playerIds",
    target: "player",
    minSelections: 1,
    maxSelections: 1,
    allowedPlayerIds: ravenkeeperPlayers.map((player) => player.id),
    optional: false,
  },
  canSkip: false,
  support: "manual",
};

function RavenkeeperPrototype() {
  const [theme, setTheme] = useState<Theme>("night");
  const [informationStatus, setInformationStatus] = useState<InformationStatus>("healthy");
  const [stage, setStage] = useState<RavenkeeperStage>("targetProgress");
  const [referenceReturnStage, setReferenceReturnStage] = useState<RavenkeeperProgressStage>("targetProgress");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [deliveredCharacterId, setDeliveredCharacterId] = useState("");
  const [revealOpen, setRevealOpen] = useState(false);
  const [revealReviewed, setRevealReviewed] = useState(false);
  const selectedPlayer = ravenkeeperPlayers.find((player) => player.id === selectedPlayerIds[0]);
  const revealedCharacterId = informationStatus === "healthy" ? selectedPlayer?.actualCharacter ?? "" : deliveredCharacterId;
  const ruleState: RuleState = {
    unannouncedNightDeathPlayerIds: [ravenkeeperPlayers[0].id],
    automaticReminders: [],
  };

  function reset(status = informationStatus) {
    setInformationStatus(status);
    setStage("targetProgress");
    setReferenceReturnStage("targetProgress");
    setSelectedPlayerIds([]);
    setDeliveredCharacterId("");
    setRevealOpen(false);
    setRevealReviewed(false);
  }

  function startTargetSelection() {
    setSelectedPlayerIds([]);
    setStage("targetGrimoire");
  }

  function togglePlayer(playerId: string) {
    setSelectedPlayerIds((current) => current[0] === playerId ? [] : [playerId]);
  }

  function confirmTarget() {
    if (selectedPlayerIds.length !== 1) return;
    setDeliveredCharacterId("");
    setRevealReviewed(false);
    setStage("information");
  }

  function cancelTargetSelection() {
    setSelectedPlayerIds([]);
    setStage("targetProgress");
  }

  function openReferenceGrimoire() {
    if (stage === "targetGrimoire" || stage === "referenceGrimoire") return;
    setReferenceReturnStage(stage);
    setStage("referenceGrimoire");
  }

  function openProgress() {
    if (stage === "targetGrimoire") cancelTargetSelection();
    else if (stage === "referenceGrimoire") setStage(referenceReturnStage);
  }

  return (
    <div className="issue153ReviewRoot">
      <ReviewControls
        character={ravenkeeper}
        informationStatus={informationStatus}
        outsiderFixture="present"
        theme={theme}
        description="밤 사망 후 마도서 대상 선택과 직업 정보 공개 흐름을 검토합니다."
        onInformationStatusChange={reset}
        onOutsiderFixtureChange={() => undefined}
        onThemeChange={setTheme}
        onReset={() => reset()}
      />
      <ProductionApplicationShell
        ariaLabel="까마귀지기 전체 흐름 fixture"
        theme={theme}
        motion="none"
        title="Trouble Brewing"
        eyebrow="ISSUE 153 · RAVENKEEPER FLOW"
        subtitle="까마귀지기 · 주민"
        leading={<span className="issue153FixtureMarker" aria-hidden="true">TB</span>}
        headerActions={<span className="tbPhaseMark" role="img" aria-label={theme === "night" ? "밤" : "낮"}>{theme === "night" ? "☾" : "☀"}</span>}
        headerActionsAriaLabel="현재 페이즈"
        utilities={[
          { id: "new-game", label: "새 게임", disabled: true },
          { id: "storage", label: "저장 / 불러오기", disabled: true },
          { id: "bug-report", label: "버그 제보", disabled: true },
        ]}
        stages={[
          { id: "roles", label: "직업", disabled: true },
          { id: "seating", label: "마도서", active: stage === "targetGrimoire" || stage === "referenceGrimoire", onSelect: openReferenceGrimoire },
          { id: "play", label: "진행", active: stage !== "targetGrimoire" && stage !== "referenceGrimoire", onSelect: openProgress },
        ]}
        onNavigate={(next) => {
          if (next === "seating") openReferenceGrimoire();
          if (next === "play") openProgress();
        }}
        className="tbProductionShell issue153ProductionShell"
      >
        {stage === "targetGrimoire" ? (
          <section className="issue153GrimoireStage" aria-label="까마귀지기 마도서 선택">
            <TroubleBrewingLiveGrimoire
              players={ravenkeeperPlayers}
              currentStep={ravenkeeperStep}
              phaseLabel="2일차 밤"
              phaseRuntime="00:00"
              theme={theme}
              busy={false}
              gameEnded={false}
              handoff="target"
              phasePlayerSelection={{ selectedPlayerIds, allowedPlayerIds: ravenkeeperStep.requiredInput.allowedPlayerIds, disabled: false, onTogglePlayer: togglePlayer }}
              onConfirmSelection={confirmTarget}
              onResetSelection={() => setSelectedPlayerIds([])}
              onCancelSelection={cancelTargetSelection}
              selectionReady={selectedPlayerIds.length === 1}
            />
          </section>
        ) : stage === "referenceGrimoire" ? (
          <section className="issue153GrimoireStage" aria-label="까마귀지기 마도서 열람">
            <TroubleBrewingLiveGrimoire
              players={ravenkeeperPlayers}
              phaseLabel="2일차 밤"
              phaseRuntime="00:00"
              theme={theme}
              busy={false}
              gameEnded={false}
              interactionLocked
              ruleState={ruleState}
              onGoToProgress={() => setStage(referenceReturnStage)}
              progressActionLabel="진행 →"
            />
          </section>
        ) : (
          <PlayPresentation
            ariaLabel="까마귀지기 production-like fixture"
            className={`snvManualSurface tbPlaySurface issue153PlaySurface ${theme === "day" ? "snvDaySurface" : "snvNightSurface"}`}
            headerClassName="snvFirstNightHeader tbPlayHeader"
            primaryClassName="snvFirstNightPrimary tbPlayPrimary issue153PlayPrimary"
            phaseHeader={<PhaseHeader phaseLabel="2일차 밤" />}
            currentTask={stage === "targetProgress" ? (
              <RavenkeeperTargetTask informationStatus={informationStatus} theme={theme} onChooseTarget={startTargetSelection} />
            ) : stage === "information" && selectedPlayer ? (
              <RavenkeeperInformationTask
                player={selectedPlayer}
                informationStatus={informationStatus}
                theme={theme}
                truthCharacterId={selectedPlayer.actualCharacter}
                deliveredCharacterId={deliveredCharacterId}
                revealReviewed={revealReviewed}
                onDeliveredCharacterChange={setDeliveredCharacterId}
                onOpenReveal={() => setRevealOpen(true)}
                onNext={() => setStage("next")}
              />
            ) : (
              <article className="issue153NextStage" aria-label="까마귀지기 다음 단계"><span>NEXT STEP</span><h2>까마귀지기 행동 완료</h2><p>직업 정보 공개를 완료했습니다.</p></article>
            )}
            phaseOrder={<RavenkeeperPhaseOrder stage={stage} referenceReturnStage={referenceReturnStage} />}
          />
        )}
        {revealOpen && selectedPlayer && revealedCharacterId ? (
          <RavenkeeperReveal
            player={selectedPlayer}
            characterId={revealedCharacterId}
            onClose={() => { setRevealOpen(false); setRevealReviewed(true); }}
          />
        ) : null}
      </ProductionApplicationShell>
    </div>
  );
}

function RavenkeeperTargetTask({
  informationStatus,
  theme,
  onChooseTarget,
}: {
  informationStatus: InformationStatus;
  theme: Theme;
  onChooseTarget: () => void;
}) {
  return (
    <article className="snvCurrentStep snvInformationTask tbCurrentTask issue153SetupInformationProgressCard" aria-label="까마귀지기 대상 선택">
      <p className="snvCurrentStepLabel">현재 할 일</p>
      <PrototypeActorIdentity character={ravenkeeper} informationStatus={informationStatus} theme={theme} />
      <p className="issue153ProgressAbility">{ravenkeeper.abilitySummary}</p>
      <div className="snvStepActions snvInformationActions issue153TaskActions">
        <button type="button" className="issue153PrimaryAction" onClick={onChooseTarget}>대상 선택</button>
      </div>
    </article>
  );
}

function RavenkeeperInformationTask({
  player,
  informationStatus,
  theme,
  truthCharacterId,
  deliveredCharacterId,
  revealReviewed,
  onDeliveredCharacterChange,
  onOpenReveal,
  onNext,
}: {
  player: Player;
  informationStatus: InformationStatus;
  theme: Theme;
  truthCharacterId: string;
  deliveredCharacterId: string;
  revealReviewed: boolean;
  onDeliveredCharacterChange: (characterId: string) => void;
  onOpenReveal: () => void;
  onNext: () => void;
}) {
  const poisoned = informationStatus === "poisoned";
  const canReveal = !poisoned || deliveredCharacterId.length > 0;
  return (
    <article className="snvCurrentStep snvInformationTask tbCurrentTask issue153SetupInformationProgressCard" aria-label="까마귀지기 정보">
      <p className="snvCurrentStepLabel">현재 할 일</p>
      <PrototypeActorIdentity character={ravenkeeper} informationStatus={informationStatus} theme={theme} />
      <p className="issue153ProgressAbility">{ravenkeeper.abilitySummary}</p>
      <div className="issue153TargetSummary" aria-label="까마귀지기 대상"><span>대상</span><strong>{player.seat}번 {player.name}</strong></div>
      <dl className="snvInformationValues issue153ScalarTruth" role="group" aria-label="까마귀지기 진실">
        <div><dt>진실</dt><dd>{characterLabel(truthCharacterId)}</dd></div>
      </dl>
      {poisoned ? (
        <label className="issue153CharacterSelect">
          <span>전달할 캐릭터</span>
          <select aria-label="전달할 캐릭터" disabled={revealReviewed} value={deliveredCharacterId} onChange={(event) => onDeliveredCharacterChange(event.target.value)}>
            <option value="">선택하세요</option>
            {characters.map((character) => <option key={character.id} value={character.id}>{character.label}</option>)}
          </select>
        </label>
      ) : null}
      <div className="snvStepActions snvInformationActions issue153TaskActions">
        <button
          type="button"
          className={["informationReveal", revealReviewed ? "issue153SecondaryReveal" : "prominent", poisoned ? "poisoned" : ""].filter(Boolean).join(" ")}
          disabled={!canReveal}
          onClick={onOpenReveal}
        >{poisoned ? "중독 정보 공개" : "정보 공개"}</button>
        {revealReviewed ? <button type="button" className="issue153PrimaryAction" onClick={onNext}>다음 단계</button> : null}
      </div>
    </article>
  );
}

function RavenkeeperReveal({ player, characterId, onClose }: { player: Player; characterId: string; onClose: () => void }) {
  const revealedCharacter = characters.find((character) => character.id === characterId);
  return (
    <SectsAndVioletsReveal
      dialogLabel="까마귀지기 정보 공개"
      backdropAriaLabel="플레이어 공개 화면"
      className="snvProductionInformationReveal tbInformationReveal issue153SetupInformationReveal"
      closeLabel="확인했으면 눈을 감으세요"
      onClose={onClose}
    >
      <header className="issue153RevealHeader"><span>까마귀지기 정보</span></header>
      <div className="issue153RevealSeatCards" role="group" aria-label="확인 대상">
        <article className="issue153RevealSeatCard" aria-label={`${player.seat}번 ${player.name} 좌석`}>
          <span>{player.seat}</span>
          <strong>{player.seat}번 {player.name}</strong>
        </article>
      </div>
      <p className="issue153RevealPrompt">이 자의 직업은…</p>
      {revealedCharacter ? (
        <div className="issue153RevealResult" role="group" aria-label={`공개 직업 ${revealedCharacter.label}`}>
          <CharacterIcon characterId={revealedCharacter.id} />
          <h2>{revealedCharacter.label}</h2>
        </div>
      ) : null}
    </SectsAndVioletsReveal>
  );
}

function RavenkeeperPhaseOrder({
  stage,
  referenceReturnStage,
}: {
  stage: RavenkeeperStage;
  referenceReturnStage: RavenkeeperProgressStage;
}) {
  const effectiveStage = stage === "referenceGrimoire" ? referenceReturnStage : stage;
  const current = effectiveStage === "targetProgress" || effectiveStage === "targetGrimoire"
    ? 1
    : effectiveStage === "information" ? 2 : 3;
  return (
    <ol className="snvPhaseOverview issue153PhaseOrder" aria-label="까마귀지기 단계 순서">
      {["밤 사망", "대상 선택", "정보 공개", "다음 단계"].map((label, index) => (
        <li className={index < current ? "complete" : index === current ? "current" : undefined} key={label}>
          <span>{index < current ? "완료" : index === current ? "현재" : "대기"}</span><strong>{label}</strong>
        </li>
      ))}
    </ol>
  );
}

type VirginStage = "nomination" | "vote" | "reference" | "next";

const virginPlayers: Player[] = [
  fixturePlayer("issue153-virgin-1", 1, "민지", "virgin", "good"),
  fixturePlayer("issue153-virgin-2", 2, "서연", "chef", "good"),
  fixturePlayer("issue153-virgin-3", 3, "준호", "empath", "good"),
  fixturePlayer("issue153-virgin-4", 4, "지우", "poisoner", "evil"),
  fixturePlayer("issue153-virgin-5", 5, "도윤", "imp", "evil"),
  fixturePlayer("issue153-virgin-6", 6, "하린", "soldier", "good"),
];

const virginNominationStep: PhaseStep = {
  id: "issue153-virgin-day-nomination",
  phase: "day",
  stepType: "nomination",
  requiredInput: { kind: "nomination", target: "nomination", optional: false },
  canSkip: true,
  support: "manual",
};

function VirginPrototype() {
  const [theme, setTheme] = useState<Theme>("day");
  const [informationStatus, setInformationStatus] = useState<InformationStatus>("healthy");
  const [stage, setStage] = useState<VirginStage>("nomination");
  const [nominationDraft, setNominationDraft] = useState<NominationDraft>({ nominatorId: "", nomineeId: "", voterIds: [] });
  const [confirmedNomination, setConfirmedNomination] = useState<NominationDraft>();
  const [abilitySpent, setAbilitySpent] = useState(false);
  const [deathConfirmed, setDeathConfirmed] = useState(false);
  const [triggerRevealOpen, setTriggerRevealOpen] = useState(false);
  const virginPlayer = virginPlayers[0];
  const poisoned = informationStatus === "poisoned";
  const displayedPlayers = useMemo(() => virginPlayers.map((player) => (
    deathConfirmed && player.id === confirmedNomination?.nominatorId
      ? { ...player, alive: false, deathAnnounced: true }
      : player
  )), [confirmedNomination?.nominatorId, deathConfirmed]);
  const nominator = displayedPlayers.find((player) => player.id === confirmedNomination?.nominatorId);
  const ruleState: RuleState = {
    unannouncedNightDeathPlayerIds: [],
    activePoison: poisoned ? {
      playerId: virginPlayer.id,
      sourcePlayerId: virginPlayers[3].id,
      sourceEventId: "issue153-virgin-poison",
    } : undefined,
    virginAbility: { actorPlayerId: virginPlayer.id, spent: abilitySpent },
    automaticReminders: [
      ...(poisoned ? [{
        playerId: virginPlayer.id,
        characterId: "poisoner",
        tokenId: "poisoned",
        label: "중독",
        description: "독살범의 능력으로 현재 중독된 상태입니다.",
        sourceEventId: "issue153-virgin-poison",
      }] : []),
      ...(abilitySpent ? [{
        playerId: virginPlayer.id,
        characterId: "virgin",
        tokenId: "noAbility",
        label: "능력 없음",
        description: "성결자의 첫 유효 지목 판정으로 능력이 소모되었습니다.",
        sourceEventId: "issue153-virgin-nomination",
      }] : []),
    ],
  };
  const dayState = {
    nominations: [],
    eligibleNominatorIds: displayedPlayers.filter((player) => player.alive).map((player) => player.id),
    eligibleNomineeIds: displayedPlayers.filter((player) => player.alive).map((player) => player.id),
    executionVoteThreshold: 3,
    highestVoteCount: 0,
    activeNomination: confirmedNomination ? {
      eventId: "issue153-virgin-nomination",
      stepId: virginNominationStep.id,
      nominatorId: confirmedNomination.nominatorId,
      nomineeId: confirmedNomination.nomineeId,
    } : undefined,
  };

  function reset(status = informationStatus) {
    setInformationStatus(status);
    setStage("nomination");
    setNominationDraft({ nominatorId: "", nomineeId: "", voterIds: [] });
    setConfirmedNomination(undefined);
    setAbilitySpent(false);
    setDeathConfirmed(false);
    setTriggerRevealOpen(false);
  }

  function confirmNomination() {
    if (!nominationDraft.nominatorId || !nominationDraft.nomineeId) return;
    const selectedNominator = virginPlayers.find((player) => player.id === nominationDraft.nominatorId);
    const selectedNominee = virginPlayers.find((player) => player.id === nominationDraft.nomineeId);
    const triggersVirgin = selectedNominee?.actualCharacter === "virgin" && !abilitySpent;
    const nominatorKind = characters.find((character) => character.id === selectedNominator?.actualCharacter)?.kind;
    setConfirmedNomination(nominationDraft);
    if (triggersVirgin) setAbilitySpent(true);
    if (triggersVirgin && !poisoned && nominatorKind === "Townsfolk") {
      setTriggerRevealOpen(true);
      return;
    }
    setStage("vote");
  }

  function closeTriggerReveal() {
    setTriggerRevealOpen(false);
    setDeathConfirmed(true);
    setStage("next");
  }

  function confirmVote() {
    setStage("next");
  }

  return (
    <div className="issue153ReviewRoot">
      <ReviewControls
        character={virgin}
        informationStatus={informationStatus}
        outsiderFixture="present"
        theme={theme}
        description="낮 지명 확정에서 성결자 발동 Reveal과 즉시 처형 후 낮 종료를 검토합니다."
        onInformationStatusChange={reset}
        onOutsiderFixtureChange={() => undefined}
        onThemeChange={setTheme}
        onReset={() => reset()}
      />
      <ProductionApplicationShell
        ariaLabel="성결자 전체 흐름 fixture"
        theme={theme}
        motion="none"
        title="Trouble Brewing"
        eyebrow="ISSUE 153 · VIRGIN FLOW"
        subtitle="1일차 낮 · 지명 및 투표"
        leading={<span className="issue153FixtureMarker" aria-hidden="true">TB</span>}
        headerActions={<span className="tbPhaseMark" role="img" aria-label={theme === "night" ? "밤" : "낮"}>{theme === "night" ? "☾" : "☀"}</span>}
        headerActionsAriaLabel="현재 페이즈"
        utilities={[
          { id: "new-game", label: "새 게임", disabled: true },
          { id: "storage", label: "저장 / 불러오기", disabled: true },
          { id: "bug-report", label: "버그 제보", disabled: true },
        ]}
        stages={[
          { id: "roles", label: "직업", disabled: true },
          {
            id: "seating",
            label: "마도서",
            active: stage === "nomination" || stage === "vote" || stage === "reference",
            onSelect: stage === "next" ? () => setStage("reference") : undefined,
          },
          { id: "play", label: "진행", active: stage === "next", disabled: stage !== "next", onSelect: () => setStage("next") },
        ]}
        onNavigate={(next) => {
          if (next === "seating" && stage === "next") setStage("reference");
          if (next === "play" && stage === "reference") setStage("next");
        }}
        className="tbProductionShell issue153ProductionShell"
      >
        {stage === "nomination" ? (
          <section className="issue153GrimoireStage" aria-label="낮 지명 선택 마도서">
            <TroubleBrewingLiveGrimoire
              players={displayedPlayers}
              currentStep={virginNominationStep}
              phaseLabel="1일차 낮"
              phaseRuntime="00:00"
              theme={theme}
              busy={false}
              gameEnded={false}
              handoff="nomination"
              dayState={dayState}
              nominationVoting={{ draft: nominationDraft, onChange: setNominationDraft }}
              ruleState={ruleState}
              onConfirmSelection={confirmNomination}
              onResetSelection={() => setNominationDraft({ nominatorId: "", nomineeId: "", voterIds: [] })}
              onCancelSelection={() => setNominationDraft({ nominatorId: "", nomineeId: "", voterIds: [] })}
              selectionReady={Boolean(nominationDraft.nominatorId && nominationDraft.nomineeId)}
            />
          </section>
        ) : stage === "vote" ? (
          <section className="issue153GrimoireStage" aria-label="낮 투표 집계 마도서">
            <TroubleBrewingLiveGrimoire
              players={displayedPlayers}
              currentStep={virginNominationStep}
              phaseLabel="1일차 낮"
              phaseRuntime="00:00"
              theme={theme}
              busy={false}
              gameEnded={false}
              handoff="vote"
              dayState={dayState}
              nominationVoting={{ draft: nominationDraft, onChange: setNominationDraft }}
              ruleState={ruleState}
              onConfirmSelection={confirmVote}
              onResetSelection={() => setNominationDraft((current) => ({ ...current, voterIds: [] }))}
              onCancelSelection={() => setStage("next")}
              selectionReady
            />
          </section>
        ) : stage === "reference" ? (
          <section className="issue153GrimoireStage" aria-label="성결자 마도서 열람">
            <TroubleBrewingLiveGrimoire
              players={displayedPlayers}
              phaseLabel="1일차 낮"
              phaseRuntime="00:00"
              theme={theme}
              busy={false}
              gameEnded={false}
              interactionLocked
              ruleState={ruleState}
              onGoToProgress={() => setStage("next")}
              progressActionLabel="진행 →"
            />
          </section>
        ) : (
          <PlayPresentation
            ariaLabel="성결자 지명 투표 완료"
            className={`snvManualSurface tbPlaySurface issue153PlaySurface ${theme === "day" ? "snvDaySurface" : "snvNightSurface"}`}
            headerClassName="snvFirstNightHeader tbPlayHeader"
            primaryClassName="snvFirstNightPrimary tbPlayPrimary issue153PlayPrimary"
            phaseHeader={<PhaseHeader phaseLabel="1일차 낮" />}
            currentTask={deathConfirmed ? (
              <article className="issue153NextStage" aria-label="낮 종료"><span>DAY ENDED</span><h2>1일차 낮 종료</h2><p>성결자 능력으로 처형이 발생해 즉시 밤으로 넘어갑니다.</p></article>
            ) : (
              <article className="issue153NextStage" aria-label="성결자 다음 단계"><span>VOTE CONFIRMED</span><h2>투표 확인 완료</h2><p>{nominationDraft.voterIds.length}표로 투표를 확정했습니다.</p></article>
            )}
            phaseOrder={deathConfirmed ? (
              <ol className="snvPhaseOverview issue153PhaseOrder" aria-label="낮 단계 순서"><li className="complete"><span>완료</span><strong>지명 확정</strong></li><li className="complete"><span>완료</span><strong>성결자 발동</strong></li><li className="complete"><span>완료</span><strong>지명자 처형</strong></li><li className="current"><span>현재</span><strong>낮 종료</strong></li></ol>
            ) : (
              <ol className="snvPhaseOverview issue153PhaseOrder" aria-label="낮 단계 순서"><li className="complete"><span>완료</span><strong>지명 확정</strong></li><li className="complete"><span>완료</span><strong>성결자 판정</strong></li><li className="complete"><span>완료</span><strong>투표 집계</strong></li><li className="current"><span>현재</span><strong>다음 단계</strong></li></ol>
            )}
          />
        )}
        {triggerRevealOpen && nominator ? (
          <SectsAndVioletsReveal
            dialogLabel="성결자 능력 발동"
            backdropAriaLabel="성결자 공개 화면"
            className="snvProductionInformationReveal tbInformationReveal issue153SetupInformationReveal issue153VirginTriggerReveal"
            closeLabel="확인하고 낮을 종료하세요"
            onClose={closeTriggerReveal}
          >
            <header className="issue153RevealHeader"><span>성결자 능력</span></header>
            <CharacterIcon characterId="virgin" />
            <strong className="issue153VirginTriggerPlayer">{nominator.seat}번 {nominator.name}</strong>
            <h2>즉시 처형됩니다</h2>
          </SectsAndVioletsReveal>
        ) : null}
      </ProductionApplicationShell>
    </div>
  );
}
const slayerPlayers: Player[] = [
  fixturePlayer("issue153-slayer-1", 1, "민지", "slayer", "good"),
  fixturePlayer("issue153-slayer-2", 2, "서연", "chef", "good"),
  fixturePlayer("issue153-slayer-3", 3, "준호", "empath", "good"),
  fixturePlayer("issue153-slayer-4", 4, "지우", "recluse", "good"),
  fixturePlayer("issue153-slayer-5", 5, "도윤", "imp", "evil"),
  fixturePlayer("issue153-slayer-6", 6, "하린", "soldier", "good"),
];

function SlayerPrototype() {
  const [theme, setTheme] = useState<Theme>("day");
  const [informationStatus, setInformationStatus] = useState<InformationStatus>("healthy");
  const [actionOpen, setActionOpen] = useState(false);
  const [targetPlayerId, setTargetPlayerId] = useState<string>();
  const [recluseAsDemon, setRecluseAsDemon] = useState<boolean>();
  const [abilitySpent, setAbilitySpent] = useState(false);
  const [revealOpen, setRevealOpen] = useState(false);
  const [outcome, setOutcome] = useState<"death" | "noEffect">();
  const [deathConfirmed, setDeathConfirmed] = useState(false);
  const target = slayerPlayers.find((player) => player.id === targetPlayerId);
  const poisoned = informationStatus === "poisoned";
  const displayedPlayers = useMemo(() => slayerPlayers.map((player) => (
    deathConfirmed && player.id === targetPlayerId ? { ...player, alive: false, deathAnnounced: true } : player
  )), [deathConfirmed, targetPlayerId]);
  const ruleState: RuleState = {
    unannouncedNightDeathPlayerIds: [],
    activePoison: poisoned ? {
      playerId: slayerPlayers[0].id,
      sourcePlayerId: "issue153-slayer-poisoner",
      sourceEventId: "issue153-slayer-poison",
    } : undefined,
    slayerAbility: { actorPlayerId: slayerPlayers[0].id, spent: abilitySpent, canUseNow: !abilitySpent },
    automaticReminders: [
      ...(poisoned ? [{
        playerId: slayerPlayers[0].id,
        characterId: "poisoner",
        tokenId: "poisoned",
        label: "중독",
        description: "독살범의 능력으로 현재 중독된 상태입니다.",
        sourceEventId: "issue153-slayer-poison",
      }] : []),
      ...(abilitySpent ? [{
        playerId: slayerPlayers[0].id,
        characterId: "slayer",
        tokenId: "noAbility",
        label: "능력 없음",
        description: "처단자 공개 능력을 사용했습니다.",
        sourceEventId: "issue153-slayer-action",
      }] : []),
    ],
  };

  function reset(status = informationStatus) {
    setInformationStatus(status);
    setActionOpen(false);
    setTargetPlayerId(undefined);
    setRecluseAsDemon(undefined);
    setAbilitySpent(false);
    setRevealOpen(false);
    setOutcome(undefined);
    setDeathConfirmed(false);
  }

  function toggleAction() {
    setActionOpen((current) => !current);
    setTargetPlayerId(undefined);
    setRecluseAsDemon(undefined);
  }

  function confirmAction() {
    if (!target || (target.actualCharacter === "recluse" && recluseAsDemon === undefined)) return;
    const hit = !poisoned && (target.actualCharacter === "imp" || (target.actualCharacter === "recluse" && recluseAsDemon));
    setAbilitySpent(true);
    setActionOpen(false);
    setOutcome(hit ? "death" : "noEffect");
    setRevealOpen(true);
  }

  function closeReveal() {
    setRevealOpen(false);
    if (outcome === "death") setDeathConfirmed(true);
  }

  return (
    <div className="issue153ReviewRoot">
      <ReviewControls
        character={slayer}
        informationStatus={informationStatus}
        outsiderFixture="present"
        theme={theme}
        description="SnV 낮 자유 행동 UI에서 처단자 대상 선택, 적중 사망과 무효 결과를 검토합니다."
        onInformationStatusChange={reset}
        onOutsiderFixtureChange={() => undefined}
        onThemeChange={setTheme}
        onReset={() => reset()}
      />
      <ProductionApplicationShell
        ariaLabel="처단자 전체 흐름 fixture"
        theme={theme}
        motion="none"
        title="Trouble Brewing"
        eyebrow="ISSUE 153 · SLAYER FLOW"
        subtitle="1일차 낮 · 자유 행동"
        leading={<span className="issue153FixtureMarker" aria-hidden="true">TB</span>}
        headerActions={<span className="tbPhaseMark" role="img" aria-label={theme === "night" ? "밤" : "낮"}>{theme === "night" ? "☾" : "☀"}</span>}
        headerActionsAriaLabel="현재 페이즈"
        utilities={[
          { id: "new-game", label: "새 게임", disabled: true },
          { id: "storage", label: "저장 / 불러오기", disabled: true },
          { id: "bug-report", label: "버그 제보", disabled: true },
        ]}
        stages={[
          { id: "roles", label: "직업", disabled: true },
          { id: "seating", label: "마도서", active: true },
          { id: "play", label: "진행", disabled: true },
        ]}
        onNavigate={() => undefined}
        className="tbProductionShell issue153ProductionShell issue153SlayerShell"
      >
        <section className="issue153GrimoireStage" aria-label="처단자 낮 마도서">
          <TroubleBrewingLiveGrimoire
            players={displayedPlayers}
            phaseLabel="1일차 낮"
            phaseRuntime="00:00"
            theme={theme}
            busy={false}
            gameEnded={false}
            interactionLocked
            ruleState={ruleState}
            onGoToProgress={() => undefined}
            progressActionLabel="진행 →"
          />
          {!abilitySpent ? (
            <SlayerFreeAction
              open={actionOpen}
              poisoned={poisoned}
              targetPlayerId={targetPlayerId}
              recluseAsDemon={recluseAsDemon}
              onToggle={toggleAction}
              onTargetChange={(playerId) => { setTargetPlayerId(playerId); setRecluseAsDemon(undefined); }}
              onRecluseRegistrationChange={setRecluseAsDemon}
              onConfirm={confirmAction}
            />
          ) : null}
        </section>
        {revealOpen && target && outcome ? <SlayerAbilityReveal target={target} outcome={outcome} onClose={closeReveal} /> : null}
      </ProductionApplicationShell>
    </div>
  );
}

function SlayerFreeAction({
  open,
  poisoned,
  targetPlayerId,
  recluseAsDemon,
  onToggle,
  onTargetChange,
  onRecluseRegistrationChange,
  onConfirm,
}: {
  open: boolean;
  poisoned: boolean;
  targetPlayerId?: string;
  recluseAsDemon?: boolean;
  onToggle: () => void;
  onTargetChange: (playerId: string) => void;
  onRecluseRegistrationChange: (registered: boolean) => void;
  onConfirm: () => void;
}) {
  const target = slayerPlayers.find((player) => player.id === targetPlayerId);
  const ready = Boolean(target && (target.actualCharacter !== "recluse" || recluseAsDemon !== undefined));
  return <>
    {open ? (
      <section className="snvDayActionPanel snvDayActionPanel--slayer issue153SlayerActionPanel" role="dialog" aria-label="처단자 능력 사용">
        <header className="snvDayActionHeader">
          <CharacterDetailButton details={troubleBrewingCharacterDetail("slayer")} className="snvDayActionIdentity" theme="tb-day">
            <CharacterIcon characterId="slayer" />
            <div>
              <span>1일차 낮 · 1번 민지</span>
              <span className="snvDayActionRoleLine"><h2>처단자</h2>{poisoned ? <ImpairmentBadges impairments={["poisoned"]} label="정보 영향" /> : null}</span>
            </div>
          </CharacterDetailButton>
          <p>{slayer.abilitySummary}</p>
        </header>
        <div className="snvDayActionForm issue153SlayerActionForm">
          <fieldset className="issue153SlayerTargets">
            <legend>대상</legend>
            <div>
              {slayerPlayers.map((player) => <button
                type="button"
                key={player.id}
                className={player.id === targetPlayerId ? "selected" : ""}
                aria-label={`${player.seat}번 ${player.name}`}
                aria-pressed={player.id === targetPlayerId}
                onClick={() => onTargetChange(player.id)}
              ><span>{player.seat}</span><strong>{player.name}</strong></button>)}
            </div>
          </fieldset>
          {target?.actualCharacter === "recluse" ? (
            <fieldset className="issue153SlayerRegistration">
              <legend>이번 판정의 은둔자 취급</legend>
              <div>
                <button type="button" className={recluseAsDemon === false ? "selected" : ""} aria-pressed={recluseAsDemon === false} onClick={() => onRecluseRegistrationChange(false)}>악마로 취급하지 않음</button>
                <button type="button" className={recluseAsDemon === true ? "selected" : ""} aria-pressed={recluseAsDemon === true} onClick={() => onRecluseRegistrationChange(true)}>악마로 취급</button>
              </div>
            </fieldset>
          ) : null}
          <button type="button" className={`snvDayActionConfirm ${poisoned ? "poisoned" : "normal"}`} disabled={!ready} onClick={onConfirm}>{poisoned ? "중독 처단자 능력 사용" : "처단자 능력 사용"}</button>
        </div>
      </section>
    ) : null}
    <div className="snvDayActionDock issue153SlayerActionDock" aria-label="사용 가능한 낮 자유 행동">
      <button type="button" className={open ? "selected" : ""} aria-label={open ? "처단자 행동 창 닫기" : "처단자 행동 열기, 1번 민지"} aria-expanded={open} onClick={onToggle}>
        {open ? <span aria-hidden="true">×</span> : <CharacterIcon characterId="slayer" />}
      </button>
    </div>
  </>;
}

function SlayerAbilityReveal({ target, outcome, onClose }: {
  target: Player;
  outcome: "death" | "noEffect";
  onClose: () => void;
}) {
  return (
    <SectsAndVioletsReveal
      dialogLabel="처단자 능력 공개"
      backdropAriaLabel="처단자 공개 화면"
      className="snvProductionInformationReveal tbInformationReveal issue153SetupInformationReveal issue153SlayerAbilityReveal"
      closeLabel="확인"
      onClose={onClose}
    >
      <header className="issue153RevealHeader"><span>처단자 능력</span></header>
      <CharacterIcon characterId="slayer" />
      {outcome === "death" ? (
        <h2><span>{target.seat}번 {target.name} 사망</span></h2>
      ) : (
        <h2><span>아무런 일도</span><span>일어나지 않음</span></h2>
      )}
    </SectsAndVioletsReveal>
  );
}

type SoldierStage = "progress" | "selection" | "resolved" | "reference" | "next";
type SoldierProgressStage = "progress" | "next";

const soldierPlayers: Player[] = [
  fixturePlayer("issue153-soldier-1", 1, "민지", "soldier", "good"),
  fixturePlayer("issue153-soldier-2", 2, "서연", "chef", "good"),
  fixturePlayer("issue153-soldier-3", 3, "준호", "empath", "good"),
  fixturePlayer("issue153-soldier-4", 4, "지우", "poisoner", "evil"),
  fixturePlayer("issue153-soldier-5", 5, "도윤", "imp", "evil"),
  fixturePlayer("issue153-soldier-6", 6, "하린", "monk", "good"),
];

const soldierImpStep: PhaseStep = {
  id: "night2:imp",
  phase: "night",
  stepType: "character",
  character: "imp",
  playerId: soldierPlayers[4].id,
  requiredInput: {
    kind: "playerIds",
    target: "player",
    minSelections: 1,
    maxSelections: 1,
    allowedPlayerIds: soldierPlayers.map((player) => player.id),
    optional: false,
  },
  canSkip: false,
  support: "manual",
};

function SoldierPrototype() {
  const [theme, setTheme] = useState<Theme>("night");
  const [informationStatus, setInformationStatus] = useState<InformationStatus>("healthy");
  const [stage, setStage] = useState<SoldierStage>("progress");
  const [referenceReturnStage, setReferenceReturnStage] = useState<SoldierProgressStage>("progress");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const selectedPlayer = soldierPlayers.find((player) => player.id === selectedPlayerIds[0]);
  const poisoned = informationStatus === "poisoned";
  const soldierTargeted = selectedPlayer?.actualCharacter === "soldier";
  const soldierDied = stage !== "progress" && stage !== "selection" && soldierTargeted && poisoned;
  const resolvedPlayers = soldierDied
    ? soldierPlayers.map((player) => player.actualCharacter === "soldier" ? { ...player, alive: false } : player)
    : soldierPlayers;
  const ruleState: RuleState = {
    unannouncedNightDeathPlayerIds: soldierDied ? [soldierPlayers[0].id] : [],
    activePoison: poisoned ? {
      playerId: soldierPlayers[0].id,
      sourcePlayerId: soldierPlayers[3].id,
      sourceEventId: "issue153-soldier-poison",
    } : undefined,
    automaticReminders: poisoned ? [{
      playerId: soldierPlayers[0].id,
      characterId: "poisoner",
      tokenId: "poisoned",
      label: "중독",
      description: "독살범의 능력으로 현재 중독된 상태입니다.",
      sourceEventId: "issue153-soldier-poison",
    }] : [],
  };

  function reset(status = informationStatus) {
    setInformationStatus(status);
    setStage("progress");
    setReferenceReturnStage("progress");
    setSelectedPlayerIds([]);
  }

  function startSelection() {
    setSelectedPlayerIds([]);
    setStage("selection");
  }

  function togglePlayer(playerId: string) {
    setSelectedPlayerIds((current) => current[0] === playerId ? [] : [playerId]);
  }

  function confirmAttack() {
    if (!selectedPlayer) return;
    setStage("resolved");
  }

  function openReferenceGrimoire() {
    if (stage === "selection" || stage === "resolved" || stage === "reference") return;
    setReferenceReturnStage(stage);
    setStage("reference");
  }

  function openProgress() {
    if (stage === "selection") {
      setSelectedPlayerIds([]);
      setStage("progress");
    } else if (stage === "reference") {
      setStage(referenceReturnStage);
    }
  }

  return (
    <div className="issue153ReviewRoot">
      <ReviewControls
        character={soldier}
        informationStatus={informationStatus}
        outsiderFixture="present"
        theme={theme}
        description="악마 공격 대상 선택 안에서 군인의 지속 보호와 중독 시 사망 결과를 검토합니다."
        onInformationStatusChange={reset}
        onOutsiderFixtureChange={() => undefined}
        onThemeChange={setTheme}
        onReset={() => reset()}
      />
      <ProductionApplicationShell
        ariaLabel="군인 전체 흐름 fixture"
        theme={theme}
        motion="none"
        title="Trouble Brewing"
        eyebrow="ISSUE 153 · SOLDIER FLOW"
        subtitle="2일차 밤 · 악마 공격"
        leading={<span className="issue153FixtureMarker" aria-hidden="true">TB</span>}
        headerActions={<span className="tbPhaseMark" role="img" aria-label={theme === "night" ? "밤" : "낮"}>{theme === "night" ? "☾" : "☀"}</span>}
        headerActionsAriaLabel="현재 페이즈"
        utilities={[
          { id: "new-game", label: "새 게임", disabled: true },
          { id: "storage", label: "저장 / 불러오기", disabled: true },
          { id: "bug-report", label: "버그 제보", disabled: true },
        ]}
        stages={[
          { id: "roles", label: "직업", disabled: true },
          { id: "seating", label: "마도서", active: stage === "selection" || stage === "resolved" || stage === "reference", onSelect: openReferenceGrimoire },
          { id: "play", label: "진행", active: stage !== "selection" && stage !== "resolved" && stage !== "reference", onSelect: openProgress },
        ]}
        onNavigate={(next) => { if (next === "seating") openReferenceGrimoire(); if (next === "play") openProgress(); }}
        className="tbProductionShell issue153ProductionShell"
      >
        {stage === "selection" ? (
          <section className="issue153GrimoireStage" aria-label="임프 공격 대상 선택">
            <TroubleBrewingLiveGrimoire
              players={soldierPlayers}
              currentStep={soldierImpStep}
              phaseLabel="2일차 밤"
              phaseRuntime="00:00"
              theme={theme}
              busy={false}
              gameEnded={false}
              handoff="target"
              phasePlayerSelection={{ selectedPlayerIds, allowedPlayerIds: soldierImpStep.requiredInput.allowedPlayerIds, disabled: false, onTogglePlayer: togglePlayer }}
              ruleState={ruleState}
              onConfirmSelection={confirmAttack}
              onResetSelection={() => setSelectedPlayerIds([])}
              onCancelSelection={() => { setSelectedPlayerIds([]); setStage("progress"); }}
              selectionReady={selectedPlayerIds.length === 1}
            />
          </section>
        ) : stage === "resolved" ? (
          <section className="issue153GrimoireStage" aria-label="임프 공격 처리 완료">
            <TroubleBrewingLiveGrimoire
              players={resolvedPlayers}
              currentStep={soldierImpStep}
              phaseLabel="2일차 밤"
              phaseRuntime="00:00"
              theme={theme}
              busy={false}
              gameEnded={false}
              handoff="target"
              phasePlayerSelection={{ selectedPlayerIds, allowedPlayerIds: soldierImpStep.requiredInput.allowedPlayerIds, disabled: true, onTogglePlayer: () => undefined }}
              ruleState={ruleState}
              selectionReady
              completedSelection={{ title: "악마 공격 결과", onContinue: () => setStage("next") }}
            />
          </section>
        ) : stage === "reference" ? (
          <section className="issue153GrimoireStage" aria-label="군인 마도서 열람">
            <TroubleBrewingLiveGrimoire
              players={resolvedPlayers}
              phaseLabel="2일차 밤"
              phaseRuntime="00:00"
              theme={theme}
              busy={false}
              gameEnded={false}
              interactionLocked
              ruleState={ruleState}
              onGoToProgress={() => setStage(referenceReturnStage)}
              progressActionLabel="진행 →"
            />
          </section>
        ) : (
          <PlayPresentation
            ariaLabel="군인 production-like fixture"
            className={`snvManualSurface tbPlaySurface issue153PlaySurface ${theme === "day" ? "snvDaySurface" : "snvNightSurface"}`}
            headerClassName="snvFirstNightHeader tbPlayHeader"
            primaryClassName="snvFirstNightPrimary tbPlayPrimary issue153PlayPrimary"
            phaseHeader={<PhaseHeader phaseLabel="2일차 밤" />}
            currentTask={stage === "progress" ? (
              <ImpAttackTask theme={theme} onChooseTarget={startSelection} />
            ) : (
              <article className="issue153NextStage" aria-label="군인 다음 단계"><span>NEXT STEP</span><h2>악마 공격 처리 완료</h2><p>군인 능력 판정을 반영하고 다음 밤 행동으로 이동합니다.</p></article>
            )}
            phaseOrder={<SoldierPhaseOrder stage={stage} />}
          />
        )}
      </ProductionApplicationShell>
    </div>
  );
}

function ImpAttackTask({ theme, onChooseTarget }: { theme: Theme; onChooseTarget: () => void }) {
  return (
    <article className="snvCurrentStep tbCurrentTask issue153SetupInformationProgressCard" aria-label="임프 공격">
      <p className="snvCurrentStepLabel">현재 할 일</p>
      <PrototypeActorIdentity character={imp} informationStatus="healthy" theme={theme} playerLabel="5번 도윤" />
      <p className="issue153ProgressAbility">{imp.abilitySummary}</p>
      <div className="snvStepActions issue153TaskActions"><button type="button" className="issue153PrimaryAction" onClick={onChooseTarget}>대상 선택</button></div>
    </article>
  );
}

function SoldierPhaseOrder({ stage }: { stage: SoldierStage }) {
  const current = stage === "progress" || stage === "selection" ? 0 : 1;
  return (
    <ol className="snvPhaseOverview issue153PhaseOrder" aria-label="군인 단계 순서">
      {["악마 공격", "다음 단계"].map((label, index) => <li className={index < current ? "complete" : index === current ? "current" : undefined} key={label}><span>{index < current ? "완료" : index === current ? "현재" : "대기"}</span><strong>{label}</strong></li>)}
    </ol>
  );
}

type MayorStage = "progress" | "selection" | "bounceSelection" | "resolved" | "reference" | "next";
type MayorProgressStage = "progress" | "next";
type MayorAttackDecision = { kind: "mayorDies" } | { kind: "bounce"; targetPlayerId: string };

const mayorPlayers: Player[] = [
  fixturePlayer("issue153-mayor-1", 1, "민지", "mayor", "good"),
  fixturePlayer("issue153-mayor-2", 2, "서연", "chef", "good"),
  fixturePlayer("issue153-mayor-3", 3, "준호", "empath", "good"),
  fixturePlayer("issue153-mayor-4", 4, "지우", "poisoner", "evil"),
  fixturePlayer("issue153-mayor-5", 5, "도윤", "imp", "evil"),
  fixturePlayer("issue153-mayor-6", 6, "하린", "soldier", "good"),
];

function mayorImpStep(poisoned: boolean): PhaseStep {
  return {
    id: "night2:imp",
    phase: "night",
    stepType: "character",
    character: "imp",
    playerId: mayorPlayers[4].id,
    requiredInput: {
      kind: "playerIds",
      target: "player",
      minSelections: 1,
      maxSelections: 1,
      allowedPlayerIds: mayorPlayers.map((player) => player.id),
      optional: false,
      mayorDecision: poisoned ? undefined : {
        mayorPlayerId: mayorPlayers[0].id,
        bounceTargetPlayerIds: mayorPlayers.slice(1).map((player) => player.id),
      },
    },
    canSkip: false,
    support: "manual",
  };
}

const mayorBounceStep: PhaseStep = {
  id: "night2:mayorBounce",
  phase: "night",
  stepType: "character",
  character: "mayor",
  playerId: mayorPlayers[4].id,
  requiredInput: {
    kind: "playerIds",
    target: "player",
    minSelections: 1,
    maxSelections: 1,
    allowedPlayerIds: mayorPlayers.slice(1).map((player) => player.id),
    optional: false,
  },
  canSkip: false,
  support: "manual",
};

function MayorPrototype() {
  const [theme, setTheme] = useState<Theme>("night");
  const [informationStatus, setInformationStatus] = useState<InformationStatus>("healthy");
  const [stage, setStage] = useState<MayorStage>("progress");
  const [referenceReturnStage, setReferenceReturnStage] = useState<MayorProgressStage>("progress");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [attackTargetPlayerId, setAttackTargetPlayerId] = useState<string>();
  const [decision, setDecision] = useState<MayorAttackDecision>();
  const poisoned = informationStatus === "poisoned";
  const currentStep = mayorImpStep(poisoned);
  const selectedPlayer = mayorPlayers.find((player) => player.id === selectedPlayerIds[0]);
  const attackTarget = mayorPlayers.find((player) => player.id === (attackTargetPlayerId ?? selectedPlayerIds[0]));
  const healthyMayorTargeted = stage === "selection" && selectedPlayer?.actualCharacter === "mayor" && !poisoned;
  const resolved = stage === "resolved" || stage === "reference" || stage === "next";
  const deadPlayerId = resolved && attackTarget
    ? decision?.kind === "bounce" ? decision.targetPlayerId : attackTarget.id
    : undefined;
  const resolvedPlayers = mayorPlayers.map((player) => player.id === deadPlayerId ? { ...player, alive: false } : player);
  const deadPlayer = resolvedPlayers.find((player) => player.id === deadPlayerId);
  const ruleState: RuleState = {
    unannouncedNightDeathPlayerIds: deadPlayerId ? [deadPlayerId] : [],
    activePoison: poisoned ? {
      playerId: mayorPlayers[0].id,
      sourcePlayerId: mayorPlayers[3].id,
      sourceEventId: "issue153-mayor-poison",
    } : undefined,
    automaticReminders: poisoned ? [{
      playerId: mayorPlayers[0].id,
      characterId: "poisoner",
      tokenId: "poisoned",
      label: "중독",
      description: "독살범의 능력으로 현재 중독된 상태입니다.",
      sourceEventId: "issue153-mayor-poison",
    }] : [],
  };

  function reset(status = informationStatus) {
    setInformationStatus(status);
    setStage("progress");
    setReferenceReturnStage("progress");
    setSelectedPlayerIds([]);
    setAttackTargetPlayerId(undefined);
    setDecision(undefined);
  }

  function startSelection() {
    setSelectedPlayerIds([]);
    setAttackTargetPlayerId(undefined);
    setDecision(undefined);
    setStage("selection");
  }

  function togglePlayer(playerId: string) {
    setSelectedPlayerIds((current) => current[0] === playerId ? [] : [playerId]);
    setDecision(undefined);
  }

  function confirmAttack() {
    if (!selectedPlayer || (healthyMayorTargeted && !decision)) return;
    setAttackTargetPlayerId(selectedPlayer.id);
    setStage("resolved");
  }

  function chooseMayorDecision(id: string) {
    if (id === "mayorDies") {
      setDecision({ kind: "mayorDies" });
      return;
    }
    if (!selectedPlayer) return;
    setAttackTargetPlayerId(selectedPlayer.id);
    setSelectedPlayerIds([]);
    setDecision(undefined);
    setStage("bounceSelection");
  }

  function confirmBounce() {
    if (!selectedPlayer) return;
    setDecision({ kind: "bounce", targetPlayerId: selectedPlayer.id });
    setStage("resolved");
  }

  function openReferenceGrimoire() {
    if (stage === "selection" || stage === "bounceSelection" || stage === "resolved" || stage === "reference") return;
    setReferenceReturnStage(stage);
    setStage("reference");
  }

  function openProgress() {
    if (stage === "selection" || stage === "bounceSelection") {
      setSelectedPlayerIds([]);
      setAttackTargetPlayerId(undefined);
      setDecision(undefined);
      setStage("progress");
    } else if (stage === "reference") {
      setStage(referenceReturnStage);
    }
  }

  const decisionSelectedId = decision?.kind === "mayorDies" ? "mayorDies" : undefined;
  const completedSummary = decision?.kind === "bounce" && attackTarget && deadPlayer
    ? [
        { label: "공격 대상", value: `${attackTarget.seat}번 ${attackTarget.name} · 생존` },
        { label: "대신 사망", value: `${deadPlayer.seat}번 ${deadPlayer.name} · 사망` },
      ]
    : attackTarget
      ? [{ label: "공격 대상", value: `${attackTarget.seat}번 ${attackTarget.name} · ${deadPlayerId === attackTarget.id ? "사망" : "생존"}` }]
      : [];

  return (
    <div className="issue153ReviewRoot">
      <ReviewControls
        character={mayor}
        informationStatus={informationStatus}
        outsiderFixture="present"
        theme={theme}
        description="임프가 시장을 공격했을 때 본인 사망과 대체 사망 결정을 마도서 안에서 검토합니다."
        onInformationStatusChange={reset}
        onOutsiderFixtureChange={() => undefined}
        onThemeChange={setTheme}
        onReset={() => reset()}
      />
      <ProductionApplicationShell
        ariaLabel="시장 전체 흐름 fixture"
        theme={theme}
        motion="none"
        title="Trouble Brewing"
        eyebrow="ISSUE 153 · MAYOR FLOW"
        subtitle="2일차 밤 · 악마 공격"
        leading={<span className="issue153FixtureMarker" aria-hidden="true">TB</span>}
        headerActions={<span className="tbPhaseMark" role="img" aria-label={theme === "night" ? "밤" : "낮"}>{theme === "night" ? "☾" : "☀"}</span>}
        headerActionsAriaLabel="현재 페이즈"
        utilities={[
          { id: "new-game", label: "새 게임", disabled: true },
          { id: "storage", label: "저장 / 불러오기", disabled: true },
          { id: "bug-report", label: "버그 제보", disabled: true },
        ]}
        stages={[
          { id: "roles", label: "직업", disabled: true },
          { id: "seating", label: "마도서", active: stage === "selection" || stage === "bounceSelection" || stage === "resolved" || stage === "reference", onSelect: openReferenceGrimoire },
          { id: "play", label: "진행", active: stage !== "selection" && stage !== "bounceSelection" && stage !== "resolved" && stage !== "reference", onSelect: openProgress },
        ]}
        onNavigate={(next) => { if (next === "seating") openReferenceGrimoire(); if (next === "play") openProgress(); }}
        className="tbProductionShell issue153ProductionShell"
      >
        {stage === "selection" ? (
          <section className="issue153GrimoireStage" aria-label="임프 공격 대상 선택">
            <TroubleBrewingLiveGrimoire
              players={mayorPlayers}
              currentStep={currentStep}
              phaseLabel="2일차 밤"
              phaseRuntime="00:00"
              theme={theme}
              busy={false}
              gameEnded={false}
              handoff="target"
              phasePlayerSelection={{ selectedPlayerIds, allowedPlayerIds: currentStep.requiredInput.allowedPlayerIds, disabled: false, onTogglePlayer: togglePlayer }}
              ruleState={ruleState}
              selectionChoices={healthyMayorTargeted ? {
                label: "시장 공격 결과",
                selectedId: decisionSelectedId,
                options: [
                  { id: "mayorDies", label: "시장이 사망" },
                  { id: "bounce", label: "다른 플레이어가 대신 사망" },
                ],
                onChange: chooseMayorDecision,
              } : undefined}
              onConfirmSelection={confirmAttack}
              onResetSelection={() => { setSelectedPlayerIds([]); setDecision(undefined); }}
              onCancelSelection={() => { setSelectedPlayerIds([]); setDecision(undefined); setStage("progress"); }}
              selectionReady={Boolean(selectedPlayer && (!healthyMayorTargeted || decision))}
            />
          </section>
        ) : stage === "bounceSelection" ? (
          <section className="issue153GrimoireStage" aria-label="시장 대신 사망 대상 선택">
            <TroubleBrewingLiveGrimoire
              players={mayorPlayers}
              currentStep={mayorBounceStep}
              phaseLabel="2일차 밤"
              phaseRuntime="00:00"
              theme={theme}
              busy={false}
              gameEnded={false}
              handoff="target"
              phasePlayerSelection={{ selectedPlayerIds, allowedPlayerIds: mayorBounceStep.requiredInput.allowedPlayerIds, disabled: false, onTogglePlayer: togglePlayer }}
              seatMarkers={[{ playerId: mayorPlayers[0].id, label: "공격 대상", className: "snvSeatStateTarget tbSeatStateAttack" }]}
              ruleState={ruleState}
              onConfirmSelection={confirmBounce}
              onResetSelection={() => setSelectedPlayerIds([])}
              onCancelSelection={() => { setSelectedPlayerIds([mayorPlayers[0].id]); setAttackTargetPlayerId(undefined); setDecision(undefined); setStage("selection"); }}
              selectionReady={selectedPlayerIds.length === 1}
            />
          </section>
        ) : stage === "resolved" ? (
          <section className="issue153GrimoireStage" aria-label="임프 공격 처리 완료">
            <TroubleBrewingLiveGrimoire
              players={resolvedPlayers}
              currentStep={decision?.kind === "bounce" ? mayorBounceStep : currentStep}
              phaseLabel="2일차 밤"
              phaseRuntime="00:00"
              theme={theme}
              busy={false}
              gameEnded={false}
              handoff="target"
              phasePlayerSelection={{ selectedPlayerIds, allowedPlayerIds: decision?.kind === "bounce" ? mayorBounceStep.requiredInput.allowedPlayerIds : currentStep.requiredInput.allowedPlayerIds, disabled: true, onTogglePlayer: () => undefined }}
              seatMarkers={decision?.kind === "bounce" ? [{ playerId: mayorPlayers[0].id, label: "공격 대상", className: "snvSeatStateTarget tbSeatStateAttack" }] : undefined}
              ruleState={ruleState}
              selectionReady
              completedSelection={{ title: "악마 공격 결과", summary: completedSummary, onContinue: () => setStage("next") }}
            />
          </section>
        ) : stage === "reference" ? (
          <section className="issue153GrimoireStage" aria-label="시장 마도서 열람">
            <TroubleBrewingLiveGrimoire
              players={resolvedPlayers}
              phaseLabel="2일차 밤"
              phaseRuntime="00:00"
              theme={theme}
              busy={false}
              gameEnded={false}
              interactionLocked
              ruleState={ruleState}
              onGoToProgress={() => setStage(referenceReturnStage)}
              progressActionLabel="진행 →"
            />
          </section>
        ) : (
          <PlayPresentation
            ariaLabel="시장 production-like fixture"
            className={`snvManualSurface tbPlaySurface issue153PlaySurface ${theme === "day" ? "snvDaySurface" : "snvNightSurface"}`}
            headerClassName="snvFirstNightHeader tbPlayHeader"
            primaryClassName="snvFirstNightPrimary tbPlayPrimary issue153PlayPrimary"
            phaseHeader={<PhaseHeader phaseLabel="2일차 밤" />}
            currentTask={stage === "progress" ? (
              <ImpAttackTask theme={theme} onChooseTarget={startSelection} />
            ) : (
              <article className="issue153NextStage" aria-label="시장 다음 단계"><span>NEXT STEP</span><h2>악마 공격 처리 완료</h2><p>시장 능력 판정을 반영하고 다음 밤 행동으로 이동합니다.</p></article>
            )}
            phaseOrder={<MayorPhaseOrder stage={stage} />}
          />
        )}
      </ProductionApplicationShell>
    </div>
  );
}

function MayorPhaseOrder({ stage }: { stage: MayorStage }) {
  const current = stage === "progress" || stage === "selection" || stage === "bounceSelection" ? 0 : 1;
  return (
    <ol className="snvPhaseOverview issue153PhaseOrder" aria-label="시장 단계 순서">
      {["악마 공격", "다음 단계"].map((label, index) => <li className={index < current ? "complete" : index === current ? "current" : undefined} key={label}><span>{index < current ? "완료" : index === current ? "현재" : "대기"}</span><strong>{label}</strong></li>)}
    </ol>
  );
}

type ButlerStage = "progress" | "selection" | "vote" | "referenceGrimoire" | "next";

type ButlerVoteResult = {
  effectiveVoterIds: string[];
  butlerVoteSummary: string;
};

const butlerPlayers: Player[] = [
  fixturePlayer("issue153-butler-1", 1, "민지", "butler", "good"),
  fixturePlayer("issue153-butler-2", 2, "서연", "chef", "good"),
  fixturePlayer("issue153-butler-3", 3, "준호", "empath", "good"),
  fixturePlayer("issue153-butler-4", 4, "지우", "poisoner", "evil"),
  fixturePlayer("issue153-butler-5", 5, "도윤", "imp", "evil"),
  fixturePlayer("issue153-butler-6", 6, "하린", "soldier", "good"),
];

const butlerStep: PhaseStep = {
  id: "night2:butler",
  phase: "night",
  stepType: "character",
  character: "butler",
  playerId: butlerPlayers[0].id,
  requiredInput: {
    kind: "playerIds",
    target: "player",
    minSelections: 1,
    maxSelections: 1,
    allowedPlayerIds: butlerPlayers.slice(1).map((player) => player.id),
    optional: false,
  },
  canSkip: false,
  support: "manual",
};

function ButlerPrototype() {
  const [theme, setTheme] = useState<Theme>("night");
  const [informationStatus, setInformationStatus] = useState<InformationStatus>("healthy");
  const [stage, setStage] = useState<ButlerStage>("progress");
  const [referenceReturnStage, setReferenceReturnStage] = useState<"progress" | "next">("progress");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [nominationDraft, setNominationDraft] = useState<NominationDraft>({
    nominatorId: butlerPlayers[1].id,
    nomineeId: butlerPlayers[4].id,
    voterIds: [],
  });
  const [voteResult, setVoteResult] = useState<ButlerVoteResult>();
  const selectedPlayer = butlerPlayers.find((player) => player.id === selectedPlayerIds[0]);
  const selectionConfirmed = stage !== "progress" && stage !== "selection" && Boolean(selectedPlayer);
  const poisoned = informationStatus === "poisoned";
  const ruleState: RuleState = {
    unannouncedNightDeathPlayerIds: [],
    butlerVote: selectionConfirmed ? {
      butlerPlayerId: butlerPlayers[0].id,
      masterPlayerId: selectedPlayer?.id,
      restrictionApplies: !poisoned,
    } : undefined,
    activePoison: poisoned ? {
      playerId: butlerPlayers[0].id,
      sourcePlayerId: butlerPlayers[3].id,
      sourceEventId: "issue153-butler-poison",
    } : undefined,
    automaticReminders: selectionConfirmed && selectedPlayer ? [{
      playerId: selectedPlayer.id,
      characterId: "butler",
      tokenId: "master",
      label: "주인",
      description: "집사가 다음 날 투표 제한을 따르는 주인입니다.",
      sourceEventId: "issue153-butler-master",
      inactiveReason: poisoned
        ? "집사가 중독되어 투표 제한이 일시적으로 무효입니다."
        : undefined,
    }] : [],
  };
  const votingRuleState: RuleState = { ...ruleState, butlerVote: undefined };
  const dayState = {
    nominations: [],
    eligibleNominatorIds: butlerPlayers.map((player) => player.id),
    eligibleNomineeIds: butlerPlayers.map((player) => player.id),
    executionVoteThreshold: 3,
    highestVoteCount: 0,
    activeNomination: {
      eventId: "issue153-butler-nomination",
      stepId: "day1:nomination:vote",
      nominatorId: nominationDraft.nominatorId,
      nomineeId: nominationDraft.nomineeId,
    },
  };

  function reset(status = informationStatus) {
    setInformationStatus(status);
    setStage("progress");
    setReferenceReturnStage("progress");
    setSelectedPlayerIds([]);
    setNominationDraft({
      nominatorId: butlerPlayers[1].id,
      nomineeId: butlerPlayers[4].id,
      voterIds: [],
    });
    setVoteResult(undefined);
  }

  function startSelection() {
    setSelectedPlayerIds([]);
    setStage("selection");
  }

  function togglePlayer(playerId: string) {
    setSelectedPlayerIds((current) => current[0] === playerId ? [] : [playerId]);
  }

  function openReferenceGrimoire() {
    if (stage === "selection" || stage === "vote" || stage === "referenceGrimoire") return;
    setReferenceReturnStage(stage);
    setStage("referenceGrimoire");
  }

  function returnFromReferenceGrimoire() {
    setStage(referenceReturnStage);
  }

  function cancelSelection() {
    setSelectedPlayerIds([]);
    setStage("progress");
  }

  function openProgress() {
    if (stage === "selection") cancelSelection();
    else if (stage === "referenceGrimoire") returnFromReferenceGrimoire();
  }

  function confirmVote() {
    const butlerSelected = nominationDraft.voterIds.includes(butlerPlayers[0].id);
    const masterSelected = Boolean(selectedPlayer && nominationDraft.voterIds.includes(selectedPlayer.id));
    const unsupportedButlerVote = !poisoned && butlerSelected && !masterSelected;
    setVoteResult({
      effectiveVoterIds: unsupportedButlerVote
        ? nominationDraft.voterIds.filter((playerId) => playerId !== butlerPlayers[0].id)
        : nominationDraft.voterIds,
      butlerVoteSummary: !butlerSelected
        ? "미투표"
        : poisoned
          ? "유효 · 중독으로 제한 없음"
          : masterSelected
            ? "유효 · 주인 함께 투표"
            : "무효 · 주인 미투표",
    });
  }

  return (
    <div className="issue153ReviewRoot">
      <ReviewControls
        character={butler}
        informationStatus={informationStatus}
        outsiderFixture="present"
        theme={theme}
        description="밤의 주인 선택부터 낮 투표 판정, 공식 주인 토큰과 중독 시 무효 표시를 검토합니다."
        onInformationStatusChange={reset}
        onOutsiderFixtureChange={() => undefined}
        onThemeChange={setTheme}
        onReset={() => reset()}
      />
      <ProductionApplicationShell
        ariaLabel="집사 전체 흐름 fixture"
        theme={theme}
        motion="none"
        title="Trouble Brewing"
        eyebrow="ISSUE 153 · BUTLER FLOW"
        subtitle="집사 · 밤 선택과 낮 투표"
        leading={<span className="issue153FixtureMarker" aria-hidden="true">TB</span>}
        headerActions={<span className="tbPhaseMark" role="img" aria-label={theme === "night" ? "밤" : "낮"}>{theme === "night" ? "☾" : "☀"}</span>}
        headerActionsAriaLabel="현재 페이즈"
        utilities={[
          { id: "new-game", label: "새 게임", disabled: true },
          { id: "storage", label: "저장 / 불러오기", disabled: true },
          { id: "bug-report", label: "버그 제보", disabled: true },
        ]}
        stages={[
          { id: "roles", label: "직업", disabled: true },
          { id: "seating", label: "마도서", active: stage === "selection" || stage === "vote" || stage === "referenceGrimoire", onSelect: openReferenceGrimoire },
          { id: "play", label: "진행", active: stage === "progress" || stage === "next", onSelect: openProgress },
        ]}
        onNavigate={(next) => {
          if (next === "seating") openReferenceGrimoire();
          if (next === "play") openProgress();
        }}
        className="tbProductionShell issue153ProductionShell"
      >
        {stage === "selection" ? (
          <section className="issue153GrimoireStage" aria-label="집사 마도서 선택">
            <TroubleBrewingLiveGrimoire
              players={butlerPlayers}
              currentStep={butlerStep}
              phaseLabel="2일차 밤"
              phaseRuntime="00:00"
              theme={theme}
              busy={false}
              gameEnded={false}
              handoff="target"
              phasePlayerSelection={{ selectedPlayerIds, allowedPlayerIds: butlerStep.requiredInput.allowedPlayerIds, disabled: false, onTogglePlayer: togglePlayer }}
              ruleState={ruleState}
              onConfirmSelection={() => setStage("vote")}
              onResetSelection={() => setSelectedPlayerIds([])}
              onCancelSelection={cancelSelection}
              selectionReady={selectedPlayerIds.length === 1}
            />
          </section>
        ) : stage === "vote" ? (
          <section className="issue153GrimoireStage" aria-label="집사 낮 투표 집계">
            <TroubleBrewingLiveGrimoire
              players={butlerPlayers}
              phaseLabel="1일차 낮"
              phaseRuntime="00:00"
              theme={theme}
              busy={false}
              gameEnded={false}
              handoff="vote"
              dayState={dayState}
              nominationVoting={{ draft: nominationDraft, onChange: setNominationDraft }}
              ruleState={votingRuleState}
              onConfirmSelection={confirmVote}
              onResetSelection={() => setNominationDraft((current) => ({ ...current, voterIds: [] }))}
              onCancelSelection={() => setStage("next")}
              selectionReady
              completedSelection={voteResult ? {
                title: "투표 집계 결과",
                summary: [
                  { label: "유효표", value: `${voteResult.effectiveVoterIds.length}표` },
                  { label: "집사 표", value: voteResult.butlerVoteSummary },
                ],
                actionLabel: "다음 →",
                onContinue: () => setStage("next"),
              } : undefined}
            />
          </section>
        ) : stage === "referenceGrimoire" ? (
          <section className="issue153GrimoireStage" aria-label="집사 마도서 열람">
            <TroubleBrewingLiveGrimoire
              players={butlerPlayers}
              phaseLabel="2일차 밤"
              phaseRuntime="00:00"
              theme={theme}
              busy={false}
              gameEnded={false}
              interactionLocked
              ruleState={ruleState}
              onGoToProgress={returnFromReferenceGrimoire}
              progressActionLabel="진행 →"
            />
          </section>
        ) : (
          <PlayPresentation
            ariaLabel="집사 production-like fixture"
            className={`snvManualSurface tbPlaySurface issue153PlaySurface ${theme === "day" ? "snvDaySurface" : "snvNightSurface"}`}
            headerClassName="snvFirstNightHeader tbPlayHeader"
            primaryClassName="snvFirstNightPrimary tbPlayPrimary issue153PlayPrimary"
            phaseHeader={<PhaseHeader phaseLabel="2일차 밤" />}
            currentTask={stage === "progress" ? (
              <ButlerMasterTask informationStatus={informationStatus} theme={theme} onChooseTarget={startSelection} />
            ) : (
              <article className="issue153NextStage" aria-label="집사 다음 단계"><span>NEXT STEP</span><h2>집사 흐름 완료</h2><p>주인 선택과 낮 투표 판정을 완료했습니다.</p></article>
            )}
            phaseOrder={<ButlerPhaseOrder stage={stage} />}
          />
        )}
      </ProductionApplicationShell>
    </div>
  );
}

function ButlerMasterTask({
  informationStatus,
  theme,
  onChooseTarget,
}: {
  informationStatus: InformationStatus;
  theme: Theme;
  onChooseTarget: () => void;
}) {
  return (
    <article className="snvCurrentStep snvInformationTask tbCurrentTask issue153SetupInformationProgressCard" aria-label="집사 주인 선택">
      <p className="snvCurrentStepLabel">현재 할 일</p>
      <PrototypeActorIdentity character={butler} informationStatus={informationStatus} theme={theme} />
      <p className="issue153ProgressAbility">{butler.abilitySummary}</p>
      <div className="snvStepActions snvInformationActions issue153TaskActions">
        <button type="button" className="issue153PrimaryAction" onClick={onChooseTarget}>대상 선택</button>
      </div>
    </article>
  );
}

function ButlerPhaseOrder({ stage }: { stage: ButlerStage }) {
  const current = stage === "progress" || stage === "selection" ? 0 : stage === "vote" ? 1 : 2;
  return (
    <ol className="snvPhaseOverview issue153PhaseOrder" aria-label="집사 단계 순서">
      {["주인 선택", "낮 투표", "다음 단계"].map((label, index) => <li className={index < current ? "complete" : index === current ? "current" : undefined} key={label}><span>{index < current ? "완료" : index === current ? "현재" : "대기"}</span><strong>{label}</strong></li>)}
    </ol>
  );
}

type DrunkStage = "assignment" | "progress" | "referenceGrimoire";

const drunkRosterIds = ["drunk", "chef", "empath", "poisoner", "imp", "soldier"];
const drunkPlayerNames = ["민지", "서연", "준호", "지우", "도윤", "하린"];

function createDrunkFixtureDraft(): SetupDraft {
  let draft = resizeSetupDraft(createSetupDraft(), drunkRosterIds.length);
  drunkRosterIds.forEach((characterId, index) => {
    draft = assignActualCharacter(draft, characterId, index + 1);
    draft = updateDraftPlayer(draft, index + 1, { name: drunkPlayerNames[index] });
  });
  return {
    ...draft,
    selectedSeat: 0,
    selectedCharacterIds: drunkRosterIds,
    rosterConfirmed: true,
    setupStage: "seating",
  };
}

function DrunkPrototype() {
  const [theme, setTheme] = useState<Theme>("night");
  const [stage, setStage] = useState<DrunkStage>("assignment");
  const [draft, setDraft] = useState<SetupDraft>(createDrunkFixtureDraft);
  const drunkDraftPlayer = draft.players.find((player) => player.actualCharacter === "drunk");
  const shownCharacter = characters.find((candidate) => candidate.id === drunkDraftPlayer?.shownCharacter);
  const livePlayers = draft.players.flatMap((player) => {
    if (!player.actualCharacter) return [];
    const character = characters.find((candidate) => candidate.id === player.actualCharacter);
    return [{
      ...fixturePlayer(
        `issue153-drunk-${player.seat}`,
        player.seat,
        player.name,
        player.actualCharacter,
        character?.kind === "Minion" || character?.kind === "Demon" ? "evil" : "good",
      ),
      shownCharacter: player.actualCharacter === "drunk" ? player.shownCharacter ?? "" : player.actualCharacter,
    }];
  });
  const drunkLivePlayer = livePlayers.find((player) => player.actualCharacter === "drunk");
  const ruleState: RuleState = {
    unannouncedNightDeathPlayerIds: [],
    activeImpairments: drunkLivePlayer ? [{
      kind: "drunk",
      playerId: drunkLivePlayer.id,
      sourceEventId: "issue153-drunk-identity",
      sourceCharacterId: "drunk",
      expires: "never",
    }] : [],
  };
  const seatingComplete = draft.players.every((player) => (
    Boolean(player.actualCharacter) && (player.actualCharacter !== "drunk" || Boolean(player.shownCharacter))
  ));

  function reset() {
    setDraft(createDrunkFixtureDraft());
    setStage("assignment");
  }

  function assignRosterCharacter(characterId: string) {
    setDraft((current) => {
      const selectedPlayer = current.players.find((player) => player.seat === current.selectedSeat);
      return selectedPlayer?.actualCharacter === characterId
        ? unassignActualCharacter(current)
        : assignActualCharacter(current, characterId);
    });
  }

  function randomizeAssignments() {
    const shuffled = [...drunkRosterIds];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    setDraft((current) => ({
      ...shuffled.reduce(
        (next, characterId, index) => assignActualCharacter(next, characterId, index + 1),
        resetActualCharacters(current),
      ),
      selectedSeat: 0,
    }));
  }

  return (
    <div className="issue153ReviewRoot">
      <ReviewControls
        character={drunk}
        informationStatus="healthy"
        outsiderFixture="present"
        theme={theme}
        description="실제 주정뱅이와 보여준 주민의 설정, 진행 중 취함 표시, 이야기꾼 전용 아이덴티티를 검토합니다."
        showInformationStatus={false}
        onInformationStatusChange={() => undefined}
        onOutsiderFixtureChange={() => undefined}
        onThemeChange={setTheme}
        onReset={reset}
      />
      <ProductionApplicationShell
        ariaLabel="주정뱅이 전체 흐름 fixture"
        theme={theme}
        motion="none"
        title="Trouble Brewing"
        eyebrow="ISSUE 153 · DRUNK FLOW"
        subtitle="주정뱅이 · 실제와 보여준 직업"
        leading={<span className="issue153FixtureMarker" aria-hidden="true">TB</span>}
        headerActions={<span className="tbPhaseMark" role="img" aria-label={theme === "night" ? "밤" : "낮"}>{theme === "night" ? "☾" : "☀"}</span>}
        headerActionsAriaLabel="현재 페이즈"
        utilities={[
          { id: "new-game", label: "새 게임", disabled: true },
          { id: "storage", label: "저장 / 불러오기", disabled: true },
          { id: "bug-report", label: "버그 제보", disabled: true },
        ]}
        stages={[
          { id: "roles", label: "직업", disabled: true },
          {
            id: "seating",
            label: "마도서",
            active: stage === "assignment" || stage === "referenceGrimoire",
            onSelect: stage === "progress" ? () => setStage("referenceGrimoire") : undefined,
          },
          { id: "play", label: "진행", active: stage === "progress", disabled: stage === "assignment", onSelect: () => setStage("progress") },
        ]}
        onNavigate={(next) => {
          if (next === "seating" && stage === "progress") setStage("referenceGrimoire");
          if (next === "play" && stage === "referenceGrimoire") setStage("progress");
        }}
        className="tbProductionShell issue153ProductionShell"
      >
        {stage === "assignment" ? (
          <TroubleBrewingGrimoireAssignment
            draft={draft}
            selectedIds={drunkRosterIds}
            seatingComplete={seatingComplete}
            busy={false}
            onGoToSetup={() => undefined}
            onRandomize={randomizeAssignments}
            onReset={() => setDraft((current) => ({ ...resetActualCharacters(current), selectedSeat: 0 }))}
            onSeatSelect={(seat) => setDraft((current) => ({ ...current, selectedSeat: seat }))}
            onCloseInspector={() => setDraft((current) => ({ ...current, selectedSeat: 0 }))}
            onSeatNameChange={(seat, name) => setDraft((current) => updateDraftPlayer(current, seat, { name }))}
            onCharacterSelect={assignRosterCharacter}
            onShownCharacterSelect={(characterId) => setDraft((current) => setDrunkShownCharacter(current, characterId))}
            onConfirm={() => setStage("progress")}
          />
        ) : stage === "referenceGrimoire" ? (
          <section className="issue153GrimoireStage" aria-label="주정뱅이 마도서 열람">
            <TroubleBrewingLiveGrimoire
              players={livePlayers}
              phaseLabel="첫날 밤"
              phaseRuntime="00:00"
              theme={theme}
              busy={false}
              gameEnded={false}
              interactionLocked
              ruleState={ruleState}
              onGoToProgress={() => setStage("progress")}
              progressActionLabel="진행 →"
            />
          </section>
        ) : shownCharacter && drunkDraftPlayer ? (
          <PlayPresentation
            ariaLabel="주정뱅이 표시 직업 fixture"
            className={`snvManualSurface tbPlaySurface issue153PlaySurface ${theme === "day" ? "snvDaySurface" : "snvNightSurface"}`}
            headerClassName="snvFirstNightHeader tbPlayHeader"
            primaryClassName="snvFirstNightPrimary tbPlayPrimary issue153PlayPrimary"
            phaseHeader={<PhaseHeader phaseLabel="첫날 밤" />}
            currentTask={<DrunkShownCharacterTask character={shownCharacter} playerLabel={`${drunkDraftPlayer.seat}번 ${drunkDraftPlayer.name}`} theme={theme} />}
            phaseOrder={<ol className="snvPhaseOverview issue153PhaseOrder" aria-label="주정뱅이 단계 순서"><li className="current"><span>현재</span><strong>{shownCharacter.label} 단계</strong></li></ol>}
          />
        ) : null}
      </ProductionApplicationShell>
    </div>
  );
}

function DrunkShownCharacterTask({ character, playerLabel, theme }: { character: Character; playerLabel: string; theme: Theme }) {
  return (
    <article className="snvCurrentStep snvInformationTask tbCurrentTask issue153SetupInformationProgressCard" aria-label="주정뱅이 표시 직업 진행">
      <p className="snvCurrentStepLabel">현재 할 일</p>
      <CharacterDetailButton
        details={troubleBrewingCharacterDetail(drunk.id)}
        className="snvCurrentStepIdentity interactive snvInformationIdentity tbProgressActor issue153ProgressIdentity"
        theme={theme === "day" ? "tb-day" : "tb-night"}
      >
        <CharacterIcon characterId={drunk.id} />
        <div>
          <span className="snvCurrentStepRoleName" role="heading" aria-level={3}>{drunk.label}</span>
          <strong>{playerLabel}</strong>
        </div>
      </CharacterDetailButton>
      <section className="issue153DrunkShownAbility" aria-label={`보여준 직업 · ${character.label}`}>
        <span className="issue153DrunkShownLabel">보여준 직업</span>
        <CharacterDetailButton
          details={troubleBrewingCharacterDetail(character.id)}
          className="issue153DrunkShownIdentity interactive"
          theme={theme === "day" ? "tb-day" : "tb-night"}
        >
          <CharacterIcon characterId={character.id} />
          <div>
            <span className="snvInformationRoleLine">
              <span className="issue153DrunkShownName" role="heading" aria-level={4}>{character.label}</span>
              <ImpairmentBadges impairments={["drunk"]} label="능력 상태" />
            </span>
            <p>{character.abilitySummary}</p>
          </div>
        </CharacterDetailButton>
      </section>
    </article>
  );
}

type RecluseScenario = "fortuneTeller" | "empath";
type RecluseStage = "fortuneGrimoire" | "information" | "next";

const recluseFortunePlayers: Player[] = [
  fixturePlayer("issue153-recluse-fortune-1", 1, "민지", "fortuneTeller", "good"),
  fixturePlayer("issue153-recluse-fortune-2", 2, "서연", "recluse", "good"),
  fixturePlayer("issue153-recluse-fortune-3", 3, "준호", "chef", "good"),
  fixturePlayer("issue153-recluse-fortune-4", 4, "지우", "poisoner", "evil"),
  fixturePlayer("issue153-recluse-fortune-5", 5, "도윤", "imp", "evil"),
  fixturePlayer("issue153-recluse-fortune-6", 6, "하린", "soldier", "good"),
];

const recluseFortuneStep: PhaseStep = {
  id: "night2:fortuneTeller",
  phase: "night",
  stepType: "character",
  character: "fortuneTeller",
  playerId: recluseFortunePlayers[0].id,
  requiredInput: {
    kind: "playerIds",
    target: "players",
    minSelections: 2,
    maxSelections: 2,
    optional: false,
  },
  canSkip: false,
  support: "manual",
};

function ReclusePrototype() {
  const [theme, setTheme] = useState<Theme>("night");
  const [informationStatus, setInformationStatus] = useState<InformationStatus>("healthy");
  const [scenario, setScenario] = useState<RecluseScenario>("fortuneTeller");
  const [stage, setStage] = useState<RecluseStage>("fortuneGrimoire");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [registrationChoice, setRegistrationChoice] = useState<"canonical" | "registered">();
  const [revealOpen, setRevealOpen] = useState(false);
  const [revealReviewed, setRevealReviewed] = useState(false);
  const poisoned = informationStatus === "poisoned";
  const reclusePlayerId = recluseFortunePlayers[1].id;
  const selectedPlayers = selectedPlayerIds.flatMap((id) => {
    const player = recluseFortunePlayers.find((candidate) => candidate.id === id);
    return player ? [player] : [];
  });
  const recluseSelected = selectedPlayerIds.includes(reclusePlayerId);
  const registrationRequired = recluseSelected && !poisoned;
  const fortuneSelectionReady = selectedPlayerIds.length === 2 && (!registrationRequired || registrationChoice !== undefined);
  const fortuneResultHasDemon = selectedPlayers.some((player) => player.actualCharacter === "imp")
    || (registrationRequired && registrationChoice === "registered");
  const empathReady = poisoned || registrationChoice !== undefined;
  const empathTruth = !poisoned && registrationChoice === "registered" ? 1 : 0;
  const selectionChoices: TroubleBrewingSelectionChoices | undefined = registrationRequired ? {
    label: "이번 판정의 은둔자 취급",
    selectedId: registrationChoice,
    options: [
      { id: "canonical", label: "악마로 취급하지 않음" },
      { id: "registered", label: "악마로 취급" },
    ],
    onChange: (id) => setRegistrationChoice(id as "canonical" | "registered"),
  } : undefined;
  const ruleState: RuleState = {
    unannouncedNightDeathPlayerIds: [],
    activePoison: poisoned ? {
      playerId: reclusePlayerId,
      sourcePlayerId: recluseFortunePlayers[3].id,
      sourceEventId: "issue153-recluse-poisoned",
    } : undefined,
  };

  function reset(status = informationStatus, nextScenario = scenario) {
    setInformationStatus(status);
    setScenario(nextScenario);
    setStage(nextScenario === "fortuneTeller" ? "fortuneGrimoire" : "information");
    setSelectedPlayerIds([]);
    setRegistrationChoice(undefined);
    setRevealOpen(false);
    setRevealReviewed(false);
  }

  function toggleFortuneTarget(playerId: string) {
    setSelectedPlayerIds((current) => current.includes(playerId)
      ? current.filter((id) => id !== playerId)
      : current.length < 2 ? [...current, playerId] : current);
    if (playerId === reclusePlayerId) setRegistrationChoice(undefined);
  }

  return (
    <div className="issue153ReviewRoot">
      <ReviewControls
        character={recluse}
        informationStatus={informationStatus}
        outsiderFixture="present"
        theme={theme}
        description="은둔자 취급은 별도 단계가 아니라, 현재 능력의 대상 또는 결과를 확정하는 자리에서 함께 결정합니다."
        additionalControls={<label>판정 사례<select aria-label="판정 사례" value={scenario} onChange={(event) => reset(informationStatus, event.target.value as RecluseScenario)}><option value="fortuneTeller">점쟁이 · 마도서</option><option value="empath">초공감자 · 진행</option></select></label>}
        onInformationStatusChange={(status) => reset(status)}
        onOutsiderFixtureChange={() => undefined}
        onThemeChange={setTheme}
        onReset={() => reset()}
      />
      <ProductionApplicationShell
        ariaLabel="은둔자 판정 fixture"
        theme={theme}
        motion="none"
        title="Trouble Brewing"
        eyebrow="ISSUE 153 · RECLUSE FLOW"
        subtitle="은둔자 · 판정 시점의 취급"
        leading={<span className="issue153FixtureMarker" aria-hidden="true">TB</span>}
        headerActions={<span className="tbPhaseMark" role="img" aria-label={theme === "night" ? "밤" : "낮"}>{theme === "night" ? "☾" : "☀"}</span>}
        headerActionsAriaLabel="현재 페이즈"
        utilities={[
          { id: "new-game", label: "새 게임", disabled: true },
          { id: "storage", label: "저장 / 불러오기", disabled: true },
          { id: "bug-report", label: "버그 제보", disabled: true },
        ]}
        stages={[
          { id: "roles", label: "직업", disabled: true },
          { id: "seating", label: "마도서", active: stage === "fortuneGrimoire", disabled: scenario === "empath" || stage !== "fortuneGrimoire" },
          { id: "play", label: "진행", active: stage !== "fortuneGrimoire", disabled: stage === "fortuneGrimoire" },
        ]}
        onNavigate={() => undefined}
        className="tbProductionShell issue153ProductionShell"
      >
        {stage === "fortuneGrimoire" ? (
          <section className="issue153GrimoireStage" aria-label="점쟁이 은둔자 대상 선택">
            <TroubleBrewingLiveGrimoire
              players={recluseFortunePlayers}
              currentStep={recluseFortuneStep}
              phaseLabel="2일차 밤"
              phaseRuntime="00:00"
              theme={theme}
              busy={false}
              gameEnded={false}
              handoff="target"
              phasePlayerSelection={{ selectedPlayerIds, disabled: false, onTogglePlayer: toggleFortuneTarget }}
              ruleState={ruleState}
              selectionChoices={selectionChoices}
              selectionReady={fortuneSelectionReady}
              onConfirmSelection={() => setStage("information")}
              onResetSelection={() => { setSelectedPlayerIds([]); setRegistrationChoice(undefined); }}
              onCancelSelection={() => undefined}
            />
          </section>
        ) : (
          <PlayPresentation
            ariaLabel="은둔자 판정 production-like fixture"
            className={`snvManualSurface tbPlaySurface issue153PlaySurface ${theme === "day" ? "snvDaySurface" : "snvNightSurface"}`}
            headerClassName="snvFirstNightHeader tbPlayHeader"
            primaryClassName="snvFirstNightPrimary tbPlayPrimary issue153PlayPrimary"
            phaseHeader={<PhaseHeader phaseLabel="2일차 밤" />}
            currentTask={stage === "next" ? <NextStage character={recluse} /> : scenario === "fortuneTeller" ? (
              <FortuneTellerInformationTask
                players={selectedPlayers}
                truthHasDemon={fortuneResultHasDemon}
                deliveredHasDemon={fortuneResultHasDemon}
                informationStatus="healthy"
                theme={theme}
                revealReviewed={revealReviewed}
                onDeliveredHasDemonChange={() => undefined}
                onOpenReveal={() => setRevealOpen(true)}
                onNext={() => setStage("next")}
              />
            ) : (
              <RecluseEmpathTask
                poisoned={poisoned}
                theme={theme}
                registrationChoice={registrationChoice}
                revealReviewed={revealReviewed}
                onRegistrationChange={setRegistrationChoice}
                onOpenReveal={() => setRevealOpen(true)}
                onNext={() => setStage("next")}
              />
            )}
            phaseOrder={<ReclusePhaseOrder scenario={scenario} stage={stage} ready={scenario === "fortuneTeller" || empathReady} revealReviewed={revealReviewed} />}
          />
        )}
        {revealOpen && scenario === "fortuneTeller" ? (
          <FortuneTellerReveal players={selectedPlayers} hasDemon={fortuneResultHasDemon} onClose={() => { setRevealOpen(false); setRevealReviewed(true); }} />
        ) : null}
        {revealOpen && scenario === "empath" ? (
          <NumericInformationReveal character={empath} label="살아있는 양옆 이웃 중 악한 팀" unit="명" value={empathTruth} onClose={() => { setRevealOpen(false); setRevealReviewed(true); }} />
        ) : null}
      </ProductionApplicationShell>
    </div>
  );
}

function RecluseEmpathTask({
  poisoned,
  theme,
  registrationChoice,
  revealReviewed,
  onRegistrationChange,
  onOpenReveal,
  onNext,
}: {
  poisoned: boolean;
  theme: Theme;
  registrationChoice?: "canonical" | "registered";
  revealReviewed: boolean;
  onRegistrationChange: (value: "canonical" | "registered") => void;
  onOpenReveal: () => void;
  onNext: () => void;
}) {
  const ready = poisoned || registrationChoice !== undefined;
  const truth = !poisoned && registrationChoice === "registered" ? 1 : 0;
  return (
    <article className="snvCurrentStep snvInformationTask tbCurrentTask issue153SetupInformationProgressCard" aria-label="은둔자 초공감자 판정">
      <p className="snvCurrentStepLabel">현재 할 일</p>
      <PrototypeActorIdentity character={empath} informationStatus="healthy" theme={theme} />
      <p className="issue153ProgressAbility">{empath.abilitySummary}</p>
      {!poisoned ? (
        <fieldset className="issue153RegistrationDecision">
          <legend>이번 판정의 은둔자 취급</legend>
          <div>
            <button type="button" disabled={revealReviewed} className={registrationChoice === "canonical" ? "selected" : ""} aria-pressed={registrationChoice === "canonical"} onClick={() => onRegistrationChange("canonical")}>악한 팀으로 취급하지 않음</button>
            <button type="button" disabled={revealReviewed} className={registrationChoice === "registered" ? "selected" : ""} aria-pressed={registrationChoice === "registered"} onClick={() => onRegistrationChange("registered")}>악한 팀으로 취급</button>
          </div>
        </fieldset>
      ) : null}
      <dl className="snvInformationValues issue153ScalarTruth" role="group" aria-label="초공감자 진실">
        <div><dt>진실</dt><dd>{ready ? `${truth}명` : "선택 필요"}</dd></div>
      </dl>
      <div className="snvStepActions snvInformationActions issue153TaskActions">
        <button type="button" className={["informationReveal", revealReviewed ? "issue153SecondaryReveal" : "prominent"].filter(Boolean).join(" ")} disabled={!ready} onClick={onOpenReveal}>정보 공개</button>
        {revealReviewed ? <button type="button" className="issue153PrimaryAction" onClick={onNext}>다음 단계</button> : null}
      </div>
    </article>
  );
}

function ReclusePhaseOrder({ scenario, stage, ready, revealReviewed }: { scenario: RecluseScenario; stage: RecluseStage; ready: boolean; revealReviewed: boolean }) {
  const current = stage === "fortuneGrimoire" ? 0 : stage === "next" || revealReviewed ? 2 : ready ? 1 : 0;
  const labels = scenario === "fortuneTeller" ? ["대상·취급 선택", "정보 공개", "다음 단계"] : ["은둔자 취급", "정보 공개", "다음 단계"];
  return (
    <ol className="snvPhaseOverview issue153PhaseOrder" aria-label="은둔자 판정 단계 순서">
      {labels.map((label, index) => (
        <li className={index < current ? "complete" : index === current ? "current" : undefined} key={label}>
          <span>{index < current ? "완료" : index === current ? "현재" : "대기"}</span><strong>{label}</strong>
        </li>
      ))}
    </ol>
  );
}

type SaintStage = "nomination" | "vote" | "voteResult" | "next" | "ended" | "reference";

const saintPlayers: Player[] = [
  fixturePlayer("issue153-saint-1", 1, "민지", "saint", "good"),
  fixturePlayer("issue153-saint-2", 2, "서연", "chef", "good"),
  fixturePlayer("issue153-saint-3", 3, "준호", "empath", "good"),
  fixturePlayer("issue153-saint-4", 4, "지우", "poisoner", "evil"),
  fixturePlayer("issue153-saint-5", 5, "도윤", "imp", "evil"),
  fixturePlayer("issue153-saint-6", 6, "하린", "soldier", "good"),
];

const saintNominationStep: PhaseStep = {
  id: "issue153-saint-day-nomination",
  phase: "day",
  stepType: "nomination",
  requiredInput: { kind: "nomination", target: "nomination", optional: false },
  canSkip: true,
  support: "manual",
};

const saintGameEndReason = "성자가 처형으로 사망해 악한 팀이 승리합니다.";

function SaintPrototype() {
  const [theme, setTheme] = useState<Theme>("day");
  const [informationStatus, setInformationStatus] = useState<InformationStatus>("healthy");
  const [stage, setStage] = useState<SaintStage>("nomination");
  const [referenceReturnStage, setReferenceReturnStage] = useState<"next" | "ended">("next");
  const [nominationDraft, setNominationDraft] = useState<NominationDraft>({ nominatorId: "", nomineeId: "", voterIds: [] });
  const [executionConfirmed, setExecutionConfirmed] = useState(false);
  const [gameEndPending, setGameEndPending] = useState(false);
  const poisoned = informationStatus === "poisoned";
  const saintPlayer = saintPlayers[0];
  const nominee = saintPlayers.find((player) => player.id === nominationDraft.nomineeId);
  const displayedPlayers = saintPlayers.map((player) => executionConfirmed && player.id === saintPlayer.id
    ? { ...player, alive: false, deathAnnounced: true }
    : player);
  const ruleState: RuleState = {
    unannouncedNightDeathPlayerIds: [],
    activePoison: poisoned ? {
      playerId: saintPlayer.id,
      sourcePlayerId: saintPlayers[3].id,
      sourceEventId: "issue153-saint-poison",
    } : undefined,
    automaticReminders: poisoned ? [{
      playerId: saintPlayer.id,
      characterId: "poisoner",
      tokenId: "poisoned",
      label: "중독",
      description: "독살범의 능력으로 현재 중독된 상태입니다.",
      sourceEventId: "issue153-saint-poison",
    }] : [],
  };
  const dayState = {
    nominations: [],
    eligibleNominatorIds: displayedPlayers.filter((player) => player.alive).map((player) => player.id),
    eligibleNomineeIds: displayedPlayers.filter((player) => player.alive).map((player) => player.id),
    executionVoteThreshold: 3,
    highestVoteCount: nominationDraft.voterIds.length,
    activeNomination: nominationDraft.nominatorId && nominationDraft.nomineeId ? {
      eventId: "issue153-saint-nomination",
      stepId: saintNominationStep.id,
      nominatorId: nominationDraft.nominatorId,
      nomineeId: nominationDraft.nomineeId,
    } : undefined,
  };
  const pendingGameEnd = {
    sourceEventId: "issue153-saint-execution",
    winningTeam: "evil",
    cause: "saintExecution",
    reasonKo: saintGameEndReason,
  } as const;
  const gameEnd = {
    eventId: "issue153-saint-game-end",
    sourceEventId: pendingGameEnd.sourceEventId,
    winningTeam: pendingGameEnd.winningTeam,
    cause: pendingGameEnd.cause,
    reasonKo: pendingGameEnd.reasonKo,
  } as const;

  function reset(status = informationStatus) {
    setInformationStatus(status);
    setStage("nomination");
    setReferenceReturnStage("next");
    setNominationDraft({ nominatorId: "", nomineeId: "", voterIds: [] });
    setExecutionConfirmed(false);
    setGameEndPending(false);
  }

  function confirmNomination() {
    if (!nominationDraft.nominatorId || !nominationDraft.nomineeId) return;
    setNominationDraft((current) => ({ ...current, voterIds: [] }));
    setStage("vote");
  }

  function confirmVote() {
    setStage("voteResult");
  }

  function executeNominee() {
    if (nominee?.id !== saintPlayer.id) return;
    setExecutionConfirmed(true);
    if (poisoned) {
      setStage("next");
      return;
    }
    setGameEndPending(true);
  }

  function confirmGameEnd() {
    setGameEndPending(false);
    setStage("ended");
  }

  function openReferenceGrimoire() {
    if (stage !== "next" && stage !== "ended") return;
    setReferenceReturnStage(stage);
    setStage("reference");
  }

  return (
    <div className="issue153ReviewRoot">
      <ReviewControls
        character={saint}
        informationStatus={informationStatus}
        outsiderFixture="present"
        theme={theme}
        description="성자의 처형 사망이 낮 종료 시 게임 종료로 이어지는 흐름을 검토합니다."
        onInformationStatusChange={reset}
        onOutsiderFixtureChange={() => undefined}
        onThemeChange={setTheme}
        onReset={() => reset()}
      />
      <ProductionApplicationShell
        ariaLabel="성자 전체 흐름 fixture"
        theme={theme}
        motion="none"
        title="Trouble Brewing"
        eyebrow="ISSUE 153 · SAINT FLOW"
        subtitle="1일차 낮 · 지명, 투표, 처형"
        leading={<span className="issue153FixtureMarker" aria-hidden="true">TB</span>}
        headerActions={<span className="tbPhaseMark" role="img" aria-label={theme === "night" ? "밤" : "낮"}>{theme === "night" ? "☾" : "☀"}</span>}
        headerActionsAriaLabel="현재 페이즈"
        utilities={[
          { id: "new-game", label: "새 게임", disabled: true },
          { id: "storage", label: "저장 / 불러오기", disabled: true },
          { id: "bug-report", label: "버그 제보", disabled: true },
        ]}
        stages={[
          { id: "roles", label: "직업", disabled: true },
          { id: "seating", label: "마도서", active: stage === "nomination" || stage === "vote" || stage === "voteResult" || stage === "reference", onSelect: openReferenceGrimoire },
          { id: "play", label: "진행", active: stage === "next" || stage === "ended", disabled: stage !== "next" && stage !== "ended" && stage !== "reference", onSelect: () => { if (stage === "reference") setStage(referenceReturnStage); } },
        ]}
        onNavigate={(next) => { if (next === "seating") openReferenceGrimoire(); if (next === "play" && stage === "reference") setStage(referenceReturnStage); }}
        className="tbProductionShell issue153ProductionShell"
      >
        {stage === "nomination" ? (
          <section className="issue153GrimoireStage" aria-label="성자 지명 선택 마도서">
            <TroubleBrewingLiveGrimoire
              players={displayedPlayers}
              currentStep={saintNominationStep}
              phaseLabel="1일차 낮"
              phaseRuntime="00:00"
              theme={theme}
              busy={false}
              gameEnded={false}
              handoff="nomination"
              dayState={dayState}
              nominationVoting={{ draft: nominationDraft, onChange: setNominationDraft }}
              ruleState={ruleState}
              onConfirmSelection={confirmNomination}
              onResetSelection={() => setNominationDraft({ nominatorId: "", nomineeId: "", voterIds: [] })}
              onCancelSelection={() => setNominationDraft({ nominatorId: "", nomineeId: "", voterIds: [] })}
              selectionReady={Boolean(nominationDraft.nominatorId && nominationDraft.nomineeId)}
            />
          </section>
        ) : stage === "vote" || stage === "voteResult" ? (
          <section className="issue153GrimoireStage" aria-label={stage === "vote" ? "성자 처형 투표 마도서" : "성자 투표 결과 마도서"}>
            <TroubleBrewingLiveGrimoire
              players={displayedPlayers}
              currentStep={saintNominationStep}
              phaseLabel="1일차 낮"
              phaseRuntime="00:00"
              theme={theme}
              busy={false}
              gameEnded={false}
              handoff="vote"
              dayState={dayState}
              nominationVoting={{ draft: nominationDraft, onChange: setNominationDraft }}
              ruleState={ruleState}
              onConfirmSelection={confirmVote}
              onResetSelection={() => setNominationDraft((current) => ({ ...current, voterIds: [] }))}
              onCancelSelection={() => setStage("nomination")}
              selectionReady={nominationDraft.voterIds.length >= dayState.executionVoteThreshold}
              completedSelection={stage === "voteResult" ? {
                title: "투표 결과",
                summary: [
                  { label: "득표", value: `${nominationDraft.voterIds.length}표` },
                  { label: "처형 예정", value: `${saintPlayer.seat}번 ${saintPlayer.name} · ${saint.label}` },
                ],
                actionLabel: "낮 종료 및 처형",
                onContinue: executeNominee,
              } : undefined}
            />
          </section>
        ) : stage === "reference" ? (
          <section className="issue153GrimoireStage" aria-label="성자 마도서 열람">
            <TroubleBrewingLiveGrimoire
              players={displayedPlayers}
              phaseLabel={referenceReturnStage === "ended" ? "게임 종료" : "1일차 낮 종료"}
              phaseRuntime="00:00"
              theme={theme}
              busy={false}
              gameEnded={referenceReturnStage === "ended"}
              interactionLocked
              ruleState={ruleState}
              onGoToProgress={() => setStage(referenceReturnStage)}
              progressActionLabel="진행 →"
            />
          </section>
        ) : (
          <PlayPresentation
            ariaLabel="성자 처형 결과"
            className={`snvManualSurface tbPlaySurface issue153PlaySurface ${theme === "day" ? "snvDaySurface" : "snvNightSurface"}`}
            headerClassName="snvFirstNightHeader tbPlayHeader"
            primaryClassName="snvFirstNightPrimary tbPlayPrimary issue153PlayPrimary"
            phaseHeader={<PhaseHeader phaseLabel={stage === "ended" ? "게임 종료" : "1일차 낮 종료"} />}
            currentTask={stage === "ended" ? (
              <article className="issue153NextStage" aria-label="성자 게임 종료"><span>GAME ENDED</span><SnvGameEndDock gameEnd={gameEnd} /></article>
            ) : (
              <article className="issue153NextStage" aria-label="성자 처형 후 낮 종료"><span>DAY ENDED</span><h2>1일차 낮 종료</h2><p>성자는 사망했지만 중독으로 능력이 발동하지 않았습니다.</p></article>
            )}
            phaseOrder={<SaintPhaseOrder stage={stage} poisoned={poisoned} />}
          />
        )}
        {gameEndPending ? <SnvGameEndDialog pending={pendingGameEnd} busy={false} onConfirm={confirmGameEnd} /> : null}
      </ProductionApplicationShell>
    </div>
  );
}

function SaintPhaseOrder({ stage, poisoned }: { stage: SaintStage; poisoned: boolean }) {
  const current = stage === "nomination" ? 0 : stage === "vote" || stage === "voteResult" ? 1 : stage === "next" || stage === "ended" || stage === "reference" ? 2 : 0;
  const finalLabel = poisoned ? "다음 밤" : "게임 종료";
  return (
    <ol className="snvPhaseOverview issue153PhaseOrder" aria-label="성자 처형 단계 순서">
      {["지명", "투표·처형", finalLabel].map((label, index) => <li className={index < current ? "complete" : index === current ? "current" : undefined} key={label}><span>{index < current ? "완료" : index === current ? "현재" : "대기"}</span><strong>{label}</strong></li>)}
    </ol>
  );
}

type PoisonerStage = "progress" | "selection" | "resolved" | "reference" | "next";

const poisonerPlayers: Player[] = [
  fixturePlayer("issue153-poisoner-1", 1, "민지", "poisoner", "evil"),
  fixturePlayer("issue153-poisoner-2", 2, "서연", "chef", "good"),
  fixturePlayer("issue153-poisoner-3", 3, "준호", "empath", "good"),
  fixturePlayer("issue153-poisoner-4", 4, "지우", "recluse", "good"),
  fixturePlayer("issue153-poisoner-5", 5, "도윤", "imp", "evil"),
  fixturePlayer("issue153-poisoner-6", 6, "하린", "soldier", "good"),
];

const poisonerStep: PhaseStep = {
  id: "night2:poisoner",
  phase: "night",
  stepType: "character",
  character: "poisoner",
  playerId: poisonerPlayers[0].id,
  requiredInput: {
    kind: "playerIds",
    target: "player",
    minSelections: 1,
    maxSelections: 1,
    allowedPlayerIds: poisonerPlayers.map((player) => player.id),
    optional: false,
  },
  canSkip: false,
  support: "manual",
};

function PoisonerPrototype() {
  const [theme, setTheme] = useState<Theme>("night");
  const [informationStatus, setInformationStatus] = useState<InformationStatus>("healthy");
  const [stage, setStage] = useState<PoisonerStage>("progress");
  const [referenceReturnStage, setReferenceReturnStage] = useState<"progress" | "next">("progress");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const selectedPlayer = poisonerPlayers.find((player) => player.id === selectedPlayerIds[0]);
  const poisoned = informationStatus === "poisoned";
  const selectionConfirmed = stage === "resolved" || stage === "reference" || stage === "next";
  const effectApplied = selectionConfirmed && Boolean(selectedPlayer) && !poisoned;
  const targetReminder = selectionConfirmed && selectedPlayer ? {
    playerId: selectedPlayer.id,
    characterId: "poisoner",
    tokenId: "poisoned",
    label: "중독",
    description: "독살범의 능력으로 오늘 밤과 다음 낮 동안 중독된 대상입니다.",
    sourceEventId: "issue153-poisoner-target",
    inactiveReason: poisoned ? "독살범이 중독되어 능력이 일시적으로 무효입니다." : undefined,
  } : undefined;
  const sourcePoisonReminder = poisoned ? {
    playerId: poisonerPlayers[0].id,
    characterId: "poisoner",
    tokenId: "poisoned-source",
    label: "중독",
    description: "독살범이 다른 효과로 현재 중독된 상태입니다.",
    sourceEventId: "issue153-poisoner-source-poison",
  } : undefined;
  const ruleState: RuleState = {
    unannouncedNightDeathPlayerIds: [],
    activePoison: effectApplied && selectedPlayer ? {
      playerId: selectedPlayer.id,
      sourcePlayerId: poisonerPlayers[0].id,
      sourceEventId: "issue153-poisoner-target",
    } : poisoned ? {
      playerId: poisonerPlayers[0].id,
      sourcePlayerId: "issue153-poisoner-external-source",
      sourceEventId: "issue153-poisoner-source-poison",
    } : undefined,
    automaticReminders: [
      ...(sourcePoisonReminder ? [sourcePoisonReminder] : []),
      ...(targetReminder ? [targetReminder] : []),
    ],
  };

  function reset(status = informationStatus) {
    setInformationStatus(status);
    setStage("progress");
    setReferenceReturnStage("progress");
    setSelectedPlayerIds([]);
  }

  function startSelection() {
    setSelectedPlayerIds([]);
    setStage("selection");
  }

  function togglePlayer(playerId: string) {
    setSelectedPlayerIds((current) => current[0] === playerId ? [] : [playerId]);
  }

  function openReferenceGrimoire() {
    if (stage === "selection" || stage === "resolved" || stage === "reference") return;
    setReferenceReturnStage(stage);
    setStage("reference");
  }

  function openProgress() {
    if (stage === "selection") {
      setSelectedPlayerIds([]);
      setStage("progress");
    } else if (stage === "reference") {
      setStage(referenceReturnStage);
    }
  }

  return (
    <div className="issue153ReviewRoot">
      <ReviewControls
        character={poisoner}
        informationStatus={informationStatus}
        outsiderFixture="present"
        theme={theme}
        description="밤 대상 선택과 중독 토큰의 적용 및 무효 상태를 검토합니다."
        onInformationStatusChange={reset}
        onOutsiderFixtureChange={() => undefined}
        onThemeChange={setTheme}
        onReset={() => reset()}
      />
      <ProductionApplicationShell
        ariaLabel="독살범 전체 흐름 fixture"
        theme={theme}
        motion="none"
        title="Trouble Brewing"
        eyebrow="ISSUE 153 · POISONER FLOW"
        subtitle="2일차 밤 · 중독 대상 선택"
        leading={<span className="issue153FixtureMarker" aria-hidden="true">TB</span>}
        headerActions={<span className="tbPhaseMark" role="img" aria-label={theme === "night" ? "밤" : "낮"}>{theme === "night" ? "☾" : "☀"}</span>}
        headerActionsAriaLabel="현재 페이즈"
        utilities={[
          { id: "new-game", label: "새 게임", disabled: true },
          { id: "storage", label: "저장 / 불러오기", disabled: true },
          { id: "bug-report", label: "버그 제보", disabled: true },
        ]}
        stages={[
          { id: "roles", label: "직업", disabled: true },
          { id: "seating", label: "마도서", active: stage === "selection" || stage === "resolved" || stage === "reference", onSelect: openReferenceGrimoire },
          { id: "play", label: "진행", active: stage === "progress" || stage === "next", onSelect: openProgress },
        ]}
        onNavigate={(next) => { if (next === "seating") openReferenceGrimoire(); if (next === "play") openProgress(); }}
        className="tbProductionShell issue153ProductionShell"
      >
        {stage === "selection" || stage === "resolved" ? (
          <section className="issue153GrimoireStage" aria-label={stage === "selection" ? "독살범 중독 대상 마도서" : "독살범 중독 결과 마도서"}>
            <TroubleBrewingLiveGrimoire
              players={poisonerPlayers}
              currentStep={poisonerStep}
              phaseLabel="2일차 밤"
              phaseRuntime="00:00"
              theme={theme}
              busy={false}
              gameEnded={false}
              handoff="target"
              phasePlayerSelection={{ selectedPlayerIds, allowedPlayerIds: poisonerStep.requiredInput.allowedPlayerIds, disabled: stage === "resolved", onTogglePlayer: togglePlayer }}
              ruleState={ruleState}
              onConfirmSelection={() => setStage("resolved")}
              onResetSelection={() => setSelectedPlayerIds([])}
              onCancelSelection={() => { setSelectedPlayerIds([]); setStage("progress"); }}
              selectionReady={selectedPlayerIds.length === 1}
              completedSelection={stage === "resolved" && selectedPlayer ? {
                title: "중독 적용 결과",
                summary: [{ label: "중독 대상", value: `${selectedPlayer.seat}번 ${selectedPlayer.name} · ${effectApplied ? "중독" : "효력 없음"}` }],
                onContinue: () => setStage("next"),
              } : undefined}
            />
          </section>
        ) : stage === "reference" ? (
          <section className="issue153GrimoireStage" aria-label="독살범 마도서 열람">
            <TroubleBrewingLiveGrimoire
              players={poisonerPlayers}
              phaseLabel="2일차 밤"
              phaseRuntime="00:00"
              theme={theme}
              busy={false}
              gameEnded={false}
              interactionLocked
              ruleState={ruleState}
              onGoToProgress={() => setStage(referenceReturnStage)}
              progressActionLabel="진행 →"
            />
          </section>
        ) : (
          <PlayPresentation
            ariaLabel="독살범 production-like fixture"
            className={`snvManualSurface tbPlaySurface issue153PlaySurface ${theme === "day" ? "snvDaySurface" : "snvNightSurface"}`}
            headerClassName="snvFirstNightHeader tbPlayHeader"
            primaryClassName="snvFirstNightPrimary tbPlayPrimary issue153PlayPrimary"
            phaseHeader={<PhaseHeader phaseLabel="2일차 밤" />}
            currentTask={stage === "progress" ? (
              <PoisonerTargetTask informationStatus={informationStatus} theme={theme} onChooseTarget={startSelection} />
            ) : (
              <article className="issue153NextStage" aria-label="독살범 다음 단계"><span>NEXT STEP</span><h2>독살범 행동 완료</h2><p>중독 대상 선택을 반영했습니다.</p></article>
            )}
            phaseOrder={<PoisonerPhaseOrder stage={stage} />}
          />
        )}
      </ProductionApplicationShell>
    </div>
  );
}

function PoisonerTargetTask({ informationStatus, theme, onChooseTarget }: { informationStatus: InformationStatus; theme: Theme; onChooseTarget: () => void }) {
  return (
    <article className="snvCurrentStep snvInformationTask tbCurrentTask issue153SetupInformationProgressCard" aria-label="독살범 중독 대상 선택">
      <p className="snvCurrentStepLabel">현재 할 일</p>
      <PrototypeActorIdentity character={poisoner} informationStatus={informationStatus} theme={theme} />
      <p className="issue153ProgressAbility">{poisoner.abilitySummary}</p>
      <div className="snvStepActions snvInformationActions issue153TaskActions"><button type="button" className="issue153PrimaryAction" onClick={onChooseTarget}>대상 선택</button></div>
    </article>
  );
}

function PoisonerPhaseOrder({ stage }: { stage: PoisonerStage }) {
  const current = stage === "next" ? 1 : 0;
  return (
    <ol className="snvPhaseOverview issue153PhaseOrder" aria-label="독살범 단계 순서">
      {["중독 대상 선택", "다음 단계"].map((label, index) => <li className={index < current ? "complete" : index === current ? "current" : undefined} key={label}><span>{index < current ? "완료" : index === current ? "현재" : "대기"}</span><strong>{label}</strong></li>)}
    </ol>
  );
}

type SpyStage = "progress" | "reference" | "next";

const spyPlayers: Player[] = [
  fixturePlayer("issue153-spy-1", 1, "민지", "spy", "evil"),
  fixturePlayer("issue153-spy-2", 2, "서연", "chef", "good"),
  fixturePlayer("issue153-spy-3", 3, "준호", "empath", "good"),
  fixturePlayer("issue153-spy-4", 4, "지우", "poisoner", "evil"),
  fixturePlayer("issue153-spy-5", 5, "도윤", "imp", "evil"),
  fixturePlayer("issue153-spy-6", 6, "하린", "soldier", "good"),
];

const falseSpyPlayers = spyPlayers.map((player) => {
  if (player.seat === 2) return { ...player, actualCharacter: "soldier", shownCharacter: "soldier" };
  if (player.seat === 6) return { ...player, actualCharacter: "chef", shownCharacter: "chef" };
  return player;
});

function SpyPrototype() {
  const [theme, setTheme] = useState<Theme>("night");
  const [informationStatus, setInformationStatus] = useState<InformationStatus>("healthy");
  const [stage, setStage] = useState<SpyStage>("progress");
  const [revealOpen, setRevealOpen] = useState(false);
  const [revealReviewed, setRevealReviewed] = useState(false);
  const poisoned = informationStatus === "poisoned";
  const actualRuleState: RuleState = {
    unannouncedNightDeathPlayerIds: [],
    activePoison: poisoned ? {
      playerId: spyPlayers[0].id,
      sourcePlayerId: spyPlayers[3].id,
      sourceEventId: "issue153-spy-poisoned",
    } : {
      playerId: spyPlayers[2].id,
      sourcePlayerId: spyPlayers[3].id,
      sourceEventId: "issue153-spy-actual-poison",
    },
    activeProtection: {
      playerId: spyPlayers[5].id,
      sourcePlayerId: spyPlayers[5].id,
      sourceEventId: "issue153-spy-actual-protection",
    },
  };
  const falseRuleState: RuleState = {
    unannouncedNightDeathPlayerIds: [],
    activePoison: {
      playerId: falseSpyPlayers[3].id,
      sourcePlayerId: falseSpyPlayers[3].id,
      sourceEventId: "issue153-spy-false-poison",
    },
    activeProtection: {
      playerId: falseSpyPlayers[1].id,
      sourcePlayerId: falseSpyPlayers[5].id,
      sourceEventId: "issue153-spy-false-protection",
    },
  };
  const revealPlayers = poisoned ? falseSpyPlayers : spyPlayers;
  const revealRuleState = poisoned ? falseRuleState : actualRuleState;
  const revealDraft = createSetupDraftFromConfirmedPlayers(revealPlayers.map((player) => ({
    seat: player.seat,
    name: player.name,
    actualCharacter: player.actualCharacter,
    shownCharacter: player.shownCharacter,
  })));

  function reset(status = informationStatus) {
    setInformationStatus(status);
    setStage("progress");
    setRevealOpen(false);
    setRevealReviewed(false);
  }

  if (revealOpen) {
    return (
      <div className="issue153ReviewRoot">
        <ReviewControls
          character={spy}
          informationStatus={informationStatus}
          outsiderFixture="present"
          theme={theme}
          description="실제 마도서의 잠긴 공개 흐름과 중독 시 별도로 준비된 거짓 마도서 전달을 검토합니다."
          onInformationStatusChange={reset}
          onOutsiderFixtureChange={() => undefined}
          onThemeChange={setTheme}
          onReset={() => reset()}
        />
        <TroubleBrewingLiveFlow
          draft={revealDraft}
          activeStage="seating"
          theme={theme}
          busy={false}
          storageReady
          warnings={[]}
          canUndo={false}
          interactionLocked
          grimoire={<TroubleBrewingLiveGrimoire
            players={revealPlayers}
            phaseLabel="첫날 밤"
            phaseRuntime="00:00"
            theme={theme}
            busy={false}
            gameEnded={false}
            ruleState={revealRuleState}
            interactionLocked
            progressActionLabel="확인 완료"
            onGoToProgress={() => { setRevealOpen(false); setRevealReviewed(true); }}
          />}
          progress={<span aria-hidden="true" />}
          storage={<span aria-hidden="true" />}
          onStageChange={() => undefined}
          onReset={() => undefined}
          onRequestUndo={() => undefined}
        />
      </div>
    );
  }

  return (
    <div className="issue153ReviewRoot">
      <ReviewControls
        character={spy}
        informationStatus={informationStatus}
        outsiderFixture="present"
        theme={theme}
        description="실제 마도서의 잠긴 공개 흐름과 중독 시 별도로 준비된 거짓 마도서 전달을 검토합니다."
        onInformationStatusChange={reset}
        onOutsiderFixtureChange={() => undefined}
        onThemeChange={setTheme}
        onReset={() => reset()}
      />
      <ProductionApplicationShell
        ariaLabel="첩자 전체 흐름 fixture"
        theme={theme}
        motion="none"
        title="Trouble Brewing"
        eyebrow="ISSUE 153 · SPY FLOW"
        subtitle="첫날 밤 · 마도서 공개"
        leading={<span className="issue153FixtureMarker" aria-hidden="true">TB</span>}
        headerActions={<span className="tbPhaseMark" role="img" aria-label={theme === "night" ? "밤" : "낮"}>{theme === "night" ? "☾" : "☀"}</span>}
        headerActionsAriaLabel="현재 페이즈"
        utilities={[
          { id: "new-game", label: "새 게임", disabled: true },
          { id: "storage", label: "저장 / 불러오기", disabled: true },
          { id: "bug-report", label: "버그 제보", disabled: true },
        ]}
        stages={[
          { id: "roles", label: "직업", disabled: true },
          { id: "seating", label: "마도서", active: stage === "reference", onSelect: () => setStage("reference") },
          { id: "play", label: "진행", active: stage === "progress" || stage === "next", onSelect: () => setStage(stage === "next" ? "next" : "progress") },
        ]}
        onNavigate={(next) => { if (next === "seating") setStage("reference"); if (next === "play") setStage(stage === "next" ? "next" : "progress"); }}
        className="tbProductionShell issue153ProductionShell"
      >
        {stage === "reference" ? (
          <section className="issue153GrimoireStage" aria-label="첩자 실제 마도서 열람">
            <TroubleBrewingLiveGrimoire
              players={spyPlayers}
              phaseLabel="첫날 밤"
              phaseRuntime="00:00"
              theme={theme}
              busy={false}
              gameEnded={false}
              interactionLocked
              ruleState={actualRuleState}
              onGoToProgress={() => setStage("progress")}
              progressActionLabel="진행 →"
            />
          </section>
        ) : (
          <PlayPresentation
            ariaLabel="첩자 production-like fixture"
            className={`snvManualSurface tbPlaySurface issue153PlaySurface ${theme === "day" ? "snvDaySurface" : "snvNightSurface"}`}
            headerClassName="snvFirstNightHeader tbPlayHeader"
            primaryClassName="snvFirstNightPrimary tbPlayPrimary issue153PlayPrimary"
            phaseHeader={<PhaseHeader phaseLabel="첫날 밤" />}
            currentTask={stage === "progress" ? (
              <SpyInformationTask
                informationStatus={informationStatus}
                theme={theme}
                revealReviewed={revealReviewed}
                onOpenReveal={() => setRevealOpen(true)}
                onNext={() => setStage("next")}
              />
            ) : <NextStage character={spy} />}
            phaseOrder={<SpyPhaseOrder stage={stage} />}
          />
        )}
      </ProductionApplicationShell>
    </div>
  );
}

function SpyInformationTask({
  informationStatus,
  theme,
  revealReviewed,
  onOpenReveal,
  onNext,
}: {
  informationStatus: InformationStatus;
  theme: Theme;
  revealReviewed: boolean;
  onOpenReveal: () => void;
  onNext: () => void;
}) {
  const poisoned = informationStatus === "poisoned";
  const revealLabel = poisoned
    ? revealReviewed ? "중독 마도서 다시 공개" : "중독 마도서 공개"
    : revealReviewed ? "마도서 다시 공개" : "마도서 공개";
  return (
    <article className="snvCurrentStep snvInformationTask tbCurrentTask issue153SetupInformationProgressCard" aria-label="첩자 마도서 정보">
      <p className="snvCurrentStepLabel">현재 할 일</p>
      <PrototypeActorIdentity character={spy} informationStatus={informationStatus} theme={theme} />
      <p className="issue153ProgressAbility">{spy.abilitySummary}</p>
      <div className="snvStepActions snvInformationActions issue153TaskActions">
        <button
          type="button"
          className={["informationReveal", revealReviewed ? "issue153SecondaryReveal" : "prominent", poisoned ? "poisoned" : ""].filter(Boolean).join(" ")}
          onClick={onOpenReveal}
        >{revealLabel}</button>
        {revealReviewed ? <button type="button" className="issue153PrimaryAction" onClick={onNext}>다음 단계</button> : null}
      </div>
    </article>
  );
}

function SpyPhaseOrder({ stage }: { stage: SpyStage }) {
  const current = stage === "next" ? 1 : 0;
  return (
    <ol className="snvPhaseOverview issue153PhaseOrder" aria-label="첩자 단계 순서">
      {["마도서 공개", "다음 단계"].map((label, index) => <li className={index < current ? "complete" : index === current ? "current" : undefined} key={label}><span>{index < current ? "완료" : index === current ? "현재" : "대기"}</span><strong>{label}</strong></li>)}
    </ol>
  );
}

type ScarletWomanFixture = "five" | "four";
type ScarletWomanScenario = "execution" | "selfKill";
type ScarletWomanStage = "vote" | "voteResult" | "selfKill" | "result" | "notice" | "next" | "gameEnd" | "reference";

const scarletWomanPlayers: Player[] = [
  fixturePlayer("issue153-scarlet-1", 1, "민지", "washerwoman", "good"),
  fixturePlayer("issue153-scarlet-2", 2, "서연", "chef", "good"),
  fixturePlayer("issue153-scarlet-3", 3, "준호", "empath", "good"),
  { ...fixturePlayer("issue153-scarlet-4", 4, "지우", "soldier", "good"), alive: false, deathAnnounced: true },
  fixturePlayer("issue153-scarlet-5", 5, "도윤", "scarletWoman", "evil"),
  fixturePlayer("issue153-scarlet-6", 6, "하린", "imp", "evil"),
];

const scarletWomanVoteStep: PhaseStep = {
  id: "issue153-scarlet-day-vote",
  phase: "day",
  stepType: "nomination",
  requiredInput: { kind: "nominationVote", target: "nomination", optional: false },
  canSkip: false,
  support: "manual",
};

const scarletWomanSelfKillStep: PhaseStep = {
  id: "issue153-scarlet-night-imp",
  phase: "night",
  stepType: "character",
  character: "imp",
  playerId: scarletWomanPlayers[5].id,
  requiredInput: {
    kind: "playerIds",
    target: "player",
    minSelections: 1,
    maxSelections: 1,
    allowedPlayerIds: [scarletWomanPlayers[5].id],
    optional: false,
  },
  canSkip: false,
  support: "manual",
};

function ScarletWomanPrototype() {
  const [theme, setTheme] = useState<Theme>("day");
  const [informationStatus, setInformationStatus] = useState<InformationStatus>("healthy");
  const [fixture, setFixture] = useState<ScarletWomanFixture>("five");
  const [scenario, setScenario] = useState<ScarletWomanScenario>("execution");
  const [stage, setStage] = useState<ScarletWomanStage>("vote");
  const [referenceReturnStage, setReferenceReturnStage] = useState<"next" | "gameEnd">("next");
  const [gameEndPending, setGameEndPending] = useState(false);
  const [changeRevealOpen, setChangeRevealOpen] = useState(false);
  const [nominationDraft, setNominationDraft] = useState<NominationDraft>({
    nominatorId: scarletWomanPlayers[1].id,
    nomineeId: scarletWomanPlayers[5].id,
    voterIds: [],
  });
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const poisoned = informationStatus === "poisoned";
  const successionEligible = fixture === "five" && !poisoned;
  const successor = scarletWomanPlayers[4];
  const formerImp = scarletWomanPlayers[5];
  const deathResolved = stage !== "vote" && stage !== "voteResult" && stage !== "selfKill";
  const nightPhase = scenario === "selfKill" || stage === "notice" || stage === "next";
  const basePlayers = scarletWomanPlayers.map((player) => fixture === "four" && player.seat === 3
    ? { ...player, alive: false, deathAnnounced: true }
    : player);
  const displayedPlayers = basePlayers.map((player) => {
    if (deathResolved && player.id === formerImp.id) return { ...player, alive: false, deathAnnounced: true };
    if (deathResolved && successionEligible && player.id === successor.id) {
      return { ...player, actualCharacter: "imp", shownCharacter: "imp" };
    }
    return player;
  });
  const ruleState: RuleState = {
    unannouncedNightDeathPlayerIds: [],
    activePoison: poisoned ? {
      playerId: successor.id,
      sourcePlayerId: "issue153-scarlet-poison-source",
      sourceEventId: "issue153-scarlet-poison",
    } : undefined,
    automaticReminders: [
      ...(poisoned ? [{
        playerId: successor.id,
        characterId: "poisoner",
        tokenId: "poisoned",
        label: "중독",
        description: "탕녀가 악마 사망 시점에 중독된 상태입니다.",
        sourceEventId: "issue153-scarlet-poison",
      }] : []),
      ...(deathResolved && successionEligible ? [{
        playerId: successor.id,
        characterId: "scarletWoman",
        tokenId: "isTheDemon",
        label: "악마임",
        description: "탕녀가 사망한 임프를 승계해 새 임프가 되었습니다.",
        sourceEventId: "issue153-scarlet-succession",
      }] : []),
    ],
  };
  const gameEndReason = poisoned
    ? "중독된 탕녀는 악마를 승계하지 못했습니다."
    : "임프가 사망했고 새 악마가 없어 선한 팀이 승리합니다.";
  const pendingGameEnd = {
    sourceEventId: "issue153-scarlet-imp-death",
    winningTeam: "good",
    cause: "demonAbsent",
    reasonKo: gameEndReason,
  } as const;
  const gameEnd = {
    eventId: "issue153-scarlet-game-end",
    sourceEventId: pendingGameEnd.sourceEventId,
    winningTeam: pendingGameEnd.winningTeam,
    cause: pendingGameEnd.cause,
    reasonKo: pendingGameEnd.reasonKo,
  } as const;
  const dayState = {
    nominations: [],
    eligibleNominatorIds: basePlayers.filter((player) => player.alive).map((player) => player.id),
    eligibleNomineeIds: basePlayers.filter((player) => player.alive).map((player) => player.id),
    executionVoteThreshold: 3,
    highestVoteCount: nominationDraft.voterIds.length,
    activeNomination: {
      eventId: "issue153-scarlet-imp-nomination",
      stepId: scarletWomanVoteStep.id,
      nominatorId: nominationDraft.nominatorId,
      nomineeId: nominationDraft.nomineeId,
    },
  };

  function reset(nextStatus = informationStatus, nextFixture = fixture, nextScenario = scenario) {
    setInformationStatus(nextStatus);
    setFixture(nextFixture);
    setScenario(nextScenario);
    setTheme(nextScenario === "selfKill" ? "night" : "day");
    setStage(nextScenario === "selfKill" ? "selfKill" : "vote");
    setReferenceReturnStage("next");
    setGameEndPending(false);
    setChangeRevealOpen(false);
    setNominationDraft({ nominatorId: scarletWomanPlayers[1].id, nomineeId: formerImp.id, voterIds: [] });
    setSelectedPlayerIds([]);
  }

  function resolveImpDeath() {
    if (successionEligible) {
      setStage("result");
      return;
    }
    setStage("gameEnd");
    setGameEndPending(true);
  }

  function openReference() {
    if (stage !== "next" && stage !== "gameEnd") return;
    setReferenceReturnStage(stage);
    setStage("reference");
  }

  return (
    <div className="issue153ReviewRoot">
      <ReviewControls
        character={scarletWoman}
        informationStatus={informationStatus}
        outsiderFixture="present"
        theme={theme}
        description="투표 처형과 임프 자살에서 탕녀가 새 임프가 되는 실제 흐름을 각각 검토합니다."
        additionalControls={<><label>악마 사망 상황<select aria-label="악마 사망 상황" value={scenario} onChange={(event) => reset(informationStatus, fixture, event.target.value as ScarletWomanScenario)}><option value="execution">투표로 처형</option><option value="selfKill">임프가 자신을 공격</option></select></label><label>승계 조건<select aria-label="승계 조건" value={fixture} onChange={(event) => reset(informationStatus, event.target.value as ScarletWomanFixture, scenario)}><option value="five">사망 직전 5명 생존</option><option value="four">사망 직전 4명 생존</option></select></label></>}
        onInformationStatusChange={(status) => reset(status, fixture, scenario)}
        onOutsiderFixtureChange={() => undefined}
        onThemeChange={setTheme}
        onReset={() => reset()}
      />
      <ProductionApplicationShell
        ariaLabel="탕녀 전체 흐름 fixture"
        theme={theme}
        motion="none"
        title="Trouble Brewing"
        eyebrow="ISSUE 153 · SCARLET WOMAN FLOW"
        subtitle={scenario === "execution"
          ? stage === "notice" || stage === "next" ? "1일차 밤 · 새 임프 안내" : "1일차 낮 · 임프 처형"
          : "1일차 밤 · 임프 자살"}
        leading={<span className="issue153FixtureMarker" aria-hidden="true">TB</span>}
        headerActions={<span className="tbPhaseMark" role="img" aria-label={nightPhase ? "밤" : "낮"}>{nightPhase ? "☾" : "☀"}</span>}
        headerActionsAriaLabel="현재 페이즈"
        utilities={[
          { id: "new-game", label: "새 게임", disabled: true },
          { id: "storage", label: "저장 / 불러오기", disabled: true },
          { id: "bug-report", label: "버그 제보", disabled: true },
        ]}
        stages={[
          { id: "roles", label: "직업", disabled: true },
          { id: "seating", label: "마도서", active: stage === "vote" || stage === "voteResult" || stage === "selfKill" || stage === "result" || stage === "reference", onSelect: openReference },
          { id: "play", label: "진행", active: stage === "notice" || stage === "next" || stage === "gameEnd", onSelect: () => { if (stage === "reference") setStage(referenceReturnStage); } },
        ]}
        onNavigate={(next) => { if (next === "seating") openReference(); if (next === "play" && stage === "reference") setStage(referenceReturnStage); }}
        className="tbProductionShell issue153ProductionShell"
      >
        {stage === "vote" || stage === "voteResult" ? (
          <section className="issue153GrimoireStage" aria-label={stage === "vote" ? "임프 처형 투표 마도서" : "임프 처형 투표 결과 마도서"}>
            <TroubleBrewingLiveGrimoire
              players={displayedPlayers}
              currentStep={scarletWomanVoteStep}
              phaseLabel="1일차 낮"
              phaseRuntime="00:00"
              theme={theme}
              busy={false}
              gameEnded={false}
              handoff="vote"
              dayState={dayState}
              nominationVoting={{ draft: nominationDraft, onChange: setNominationDraft }}
              ruleState={ruleState}
              onConfirmSelection={() => setStage("voteResult")}
              onResetSelection={() => setNominationDraft((current) => ({ ...current, voterIds: [] }))}
              selectionReady={nominationDraft.voterIds.length >= dayState.executionVoteThreshold}
              completedSelection={stage === "voteResult" ? {
                title: "투표 결과",
                summary: [
                  { label: "득표", value: `${nominationDraft.voterIds.length}표` },
                  { label: "처형 예정", value: `${formerImp.seat}번 ${formerImp.name} · 임프` },
                ],
                actionLabel: "낮 종료 및 처형",
                onContinue: resolveImpDeath,
              } : undefined}
            />
          </section>
        ) : stage === "selfKill" ? (
          <section className="issue153GrimoireStage" aria-label="임프 자살 대상 선택 마도서">
            <TroubleBrewingLiveGrimoire
              players={displayedPlayers}
              currentStep={scarletWomanSelfKillStep}
              phaseLabel="1일차 밤"
              phaseRuntime="00:00"
              theme={theme}
              busy={false}
              gameEnded={false}
              handoff="target"
              phasePlayerSelection={{
                selectedPlayerIds,
                allowedPlayerIds: scarletWomanSelfKillStep.requiredInput.kind === "playerIds" ? scarletWomanSelfKillStep.requiredInput.allowedPlayerIds : [],
                disabled: false,
                onTogglePlayer: (playerId) => setSelectedPlayerIds((current) => current[0] === playerId ? [] : [playerId]),
              }}
              ruleState={ruleState}
              onConfirmSelection={resolveImpDeath}
              onResetSelection={() => setSelectedPlayerIds([])}
              selectionReady={selectedPlayerIds[0] === formerImp.id}
            />
          </section>
        ) : stage === "result" ? (
          <section className="issue153GrimoireStage" aria-label="탕녀 승계 결과 마도서">
            <TroubleBrewingLiveGrimoire
              players={displayedPlayers}
              phaseLabel={scenario === "execution" ? "1일차 낮 종료" : "1일차 밤"}
              phaseRuntime="00:00"
              theme={theme}
              busy={false}
              gameEnded={false}
              handoff="target"
              ruleState={ruleState}
              completedSelection={{
                title: scenario === "execution" ? "악마 승계 완료" : "임프 자살 · 악마 승계 완료",
                summary: [
                  { label: scenario === "execution" ? "처형" : "자살", value: `${formerImp.seat}번 ${formerImp.name} · 사망` },
                  { label: "새 악마", value: `${successor.seat}번 ${successor.name} · 임프` },
                ],
                actionLabel: scenario === "execution" ? "밤 시작 →" : "새 임프에게 안내",
                onContinue: () => { setTheme("night"); setStage("notice"); },
              }}
            />
          </section>
        ) : stage === "reference" ? (
          <section className="issue153GrimoireStage" aria-label="탕녀 승계 마도서 열람">
            <TroubleBrewingLiveGrimoire
              players={displayedPlayers}
              phaseLabel={referenceReturnStage === "gameEnd" ? "게임 종료" : scenario === "execution" ? "1일차 밤" : "1일차 밤 · 임프 자살 후"}
              phaseRuntime="00:00"
              theme={theme}
              busy={false}
              gameEnded={referenceReturnStage === "gameEnd"}
              interactionLocked
              ruleState={ruleState}
              onGoToProgress={() => setStage(referenceReturnStage)}
              progressActionLabel="진행 →"
            />
          </section>
        ) : (
          <PlayPresentation
            ariaLabel="탕녀 production-like fixture"
            className={`snvManualSurface tbPlaySurface issue153PlaySurface ${theme === "day" ? "snvDaySurface" : "snvNightSurface"}`}
            headerClassName="snvFirstNightHeader tbPlayHeader"
            primaryClassName="snvFirstNightPrimary tbPlayPrimary issue153PlayPrimary"
            phaseHeader={<PhaseHeader phaseLabel={stage === "gameEnd" ? "게임 종료" : scenario === "execution" ? "1일차 밤" : "1일차 밤"} />}
            currentTask={stage === "notice" ? (
              <ScarletWomanChangeNotice onReveal={() => setChangeRevealOpen(true)} />
            ) : stage === "next" ? (
              <article className="issue153NextStage" aria-label="탕녀 다음 단계"><span>NEXT STEP</span><h2>{scenario === "execution" ? "새 임프 행동 준비" : "밤 행동 계속"}</h2><p>{scenario === "execution" ? "역할 변경 안내를 마쳤습니다. 새 임프의 첫 밤 행동을 진행합니다." : "새 임프는 같은 밤에 다시 행동하지 않습니다. 남은 밤 행동을 계속합니다."}</p></article>
            ) : (
              <article className="issue153NextStage" aria-label="탕녀 승계 불가 게임 종료"><span>GAME ENDED</span><SnvGameEndDock gameEnd={gameEnd} /></article>
            )}
            phaseOrder={<ScarletWomanPhaseOrder scenario={scenario} stage={stage} />}
          />
        )}
        {gameEndPending ? <SnvGameEndDialog pending={pendingGameEnd} busy={false} onConfirm={() => setGameEndPending(false)} /> : null}
        {changeRevealOpen ? <TroubleBrewingImpChangeReveal
          onClose={() => { setChangeRevealOpen(false); setStage("next"); }}
        /> : null}
      </ProductionApplicationShell>
    </div>
  );
}

function ScarletWomanChangeNotice({ onReveal }: { onReveal: () => void }) {
  return (
    <article className="snvCurrentStep tbCurrentTask issue153SetupInformationProgressCard" aria-label="새 임프 직업 변경 안내">
      <p className="snvCurrentStepLabel">먼저 안내할 플레이어</p>
      <h3>새 임프 직업 변경 안내</h3>
      <strong className="tbProgressPlayer tbProgressPlayerStandalone">5번 도윤 · 임프</strong>
      <div className="snvStepActions issue153TaskActions"><button type="button" className="issue153PrimaryAction" onClick={onReveal}>플레이어에게 공개</button></div>
    </article>
  );
}

function TroubleBrewingImpChangeReveal({ onClose }: { onClose: () => void }) {
  return (
    <SectsAndVioletsReveal
      dialogLabel="역할 변경 공개 1/1"
      className="snakeCharmerReveal evil"
      closeLabel="확인했으면 눈을 감으세요"
      onClose={onClose}
    >
      <div className="snakeCharmerRevealIdentity">
        <h1>당신의 직업이 변경되었습니다</h1>
        <CharacterIcon characterId="imp" />
        <h2>임프</h2>
        <span className="snakeCharmerRevealAlignment" aria-label="현재 진영 · 악">악</span>
      </div>
    </SectsAndVioletsReveal>
  );
}

function ScarletWomanPhaseOrder({ scenario, stage }: { scenario: ScarletWomanScenario; stage: ScarletWomanStage }) {
  const current = stage === "vote" || stage === "voteResult" || stage === "selfKill"
    ? 0
    : stage === "result"
      ? 1
      : stage === "notice"
        ? 2
        : 3;
  const labels = scenario === "execution"
    ? ["임프 투표·처형", "탕녀 자동 승계", "새 임프 안내", stage === "gameEnd" ? "게임 종료" : "새 임프 행동"]
    : ["임프 자기 공격", "탕녀 자동 승계", "새 임프 즉시 안내", stage === "gameEnd" ? "게임 종료" : "남은 밤 행동"];
  return (
    <ol className="snvPhaseOverview issue153PhaseOrder" aria-label="탕녀 승계 단계 순서">
      {labels.map((label, index) => <li className={index < current ? "complete" : index === current ? "current" : undefined} key={label}><span>{index < current ? "완료" : index === current ? "현재" : "대기"}</span><strong>{label}</strong></li>)}
    </ol>
  );
}

type FortuneTellerStage =
  | "redHerringProgress"
  | "redHerringGrimoire"
  | "targetProgress"
  | "targetGrimoire"
  | "referenceGrimoire"
  | "information"
  | "next";

type FortuneTellerReferenceReturnStage = "information" | "next";

const fortuneTellerPlayers: Player[] = [
  fixturePlayer("issue153-fortune-1", 1, "민지", "fortuneTeller", "good"),
  fixturePlayer("issue153-fortune-2", 2, "서연", "chef", "good"),
  fixturePlayer("issue153-fortune-3", 3, "준호", "empath", "good"),
  fixturePlayer("issue153-fortune-4", 4, "지우", "poisoner", "evil"),
  fixturePlayer("issue153-fortune-5", 5, "도윤", "imp", "evil"),
  fixturePlayer("issue153-fortune-6", 6, "하린", "soldier", "good"),
];

function FortuneTellerPrototype() {
  const [theme, setTheme] = useState<Theme>("night");
  const [informationStatus, setInformationStatus] = useState<InformationStatus>("healthy");
  const [stage, setStage] = useState<FortuneTellerStage>("redHerringProgress");
  const [referenceReturnStage, setReferenceReturnStage] = useState<FortuneTellerReferenceReturnStage>("information");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [redHerringPlayerId, setRedHerringPlayerId] = useState<string>();
  const [deliveredHasDemon, setDeliveredHasDemon] = useState(false);
  const [revealOpen, setRevealOpen] = useState(false);
  const [revealReviewed, setRevealReviewed] = useState(false);
  const selectedPlayers = selectedPlayerIds.flatMap((id) => fortuneTellerPlayers.filter((player) => player.id === id));
  const truthHasDemon = selectedPlayers.some((player) =>
    player.id === redHerringPlayerId || characters.find((candidate) => candidate.id === player.actualCharacter)?.kind === "Demon",
  );
  const grimoireOpen = stage === "redHerringGrimoire" || stage === "targetGrimoire" || stage === "referenceGrimoire";
  const redHerringSelection = stage === "redHerringProgress" || stage === "redHerringGrimoire";
  const allowedRedHerringPlayerIds = fortuneTellerPlayers.filter((player) => player.alignment === "good").map((player) => player.id);
  const ruleState: RuleState = {
    redHerringPlayerId,
    activePoison: informationStatus === "poisoned" ? {
      playerId: fortuneTellerPlayers[0].id,
      sourcePlayerId: fortuneTellerPlayers[3].id,
      sourceEventId: "issue153-fortune-poison",
    } : undefined,
    unannouncedNightDeathPlayerIds: [],
    automaticReminders: redHerringPlayerId ? [{
      playerId: redHerringPlayerId,
      characterId: "fortuneTeller",
      tokenId: "redHerring",
      label: "착각 대상",
      description: "점쟁이에게 악마로 보이는 선한 플레이어입니다.",
      sourceEventId: "issue153-fortune-red-herring",
    }] : undefined,
  };

  function reset(status = informationStatus) {
    setInformationStatus(status);
    setStage("redHerringProgress");
    setReferenceReturnStage("information");
    setSelectedPlayerIds([]);
    setRedHerringPlayerId(undefined);
    setDeliveredHasDemon(false);
    setRevealOpen(false);
    setRevealReviewed(false);
  }

  function openGrimoire() {
    if (stage === "information" || stage === "next") {
      setReferenceReturnStage(stage);
      setStage("referenceGrimoire");
      return;
    }
    setSelectedPlayerIds([]);
    setStage(redHerringSelection ? "redHerringGrimoire" : "targetGrimoire");
  }

  function togglePlayer(playerId: string) {
    const maximum = stage === "redHerringGrimoire" ? 1 : 2;
    setSelectedPlayerIds((current) => current.includes(playerId)
      ? current.filter((id) => id !== playerId)
      : current.length < maximum ? [...current, playerId] : current);
  }

  function confirmSelection() {
    if (stage === "redHerringGrimoire" && selectedPlayerIds.length === 1) {
      setRedHerringPlayerId(selectedPlayerIds[0]);
      setSelectedPlayerIds([]);
      setStage("targetGrimoire");
      return;
    }
    if (stage === "targetGrimoire" && selectedPlayerIds.length === 2) {
      const hasDemon = selectedPlayerIds.some((id) => {
        const player = fortuneTellerPlayers.find((candidate) => candidate.id === id);
        return id === redHerringPlayerId || characters.find((candidate) => candidate.id === player?.actualCharacter)?.kind === "Demon";
      });
      setDeliveredHasDemon(hasDemon);
      setStage("information");
    }
  }

  function navigate(next: string) {
    if (next === "seating") openGrimoire();
    if (next === "play" && stage === "referenceGrimoire") setStage(referenceReturnStage);
    else if (next === "play" && grimoireOpen) setStage(stage === "redHerringGrimoire" ? "redHerringProgress" : "targetProgress");
  }

  return (
    <div className="issue153ReviewRoot">
      <ReviewControls
        character={fortuneTeller}
        informationStatus={informationStatus}
        outsiderFixture="present"
        theme={theme}
        onInformationStatusChange={reset}
        onOutsiderFixtureChange={() => undefined}
        onThemeChange={setTheme}
        onReset={() => reset()}
      />
      <ProductionApplicationShell
        ariaLabel="점쟁이 전체 흐름 fixture"
        theme={theme}
        motion="none"
        title="Trouble Brewing"
        eyebrow="ISSUE 153 · FORTUNE TELLER FLOW"
        subtitle="점쟁이 · 주민"
        leading={<span className="issue153FixtureMarker" aria-hidden="true">TB</span>}
        headerActions={<span className="tbPhaseMark" role="img" aria-label={theme === "night" ? "밤" : "낮"}>{theme === "night" ? "☾" : "☀"}</span>}
        headerActionsAriaLabel="현재 페이즈"
        utilities={[
          { id: "new-game", label: "새 게임", disabled: true },
          { id: "storage", label: "저장 / 불러오기", disabled: true },
          { id: "bug-report", label: "버그 제보", disabled: true },
        ]}
        stages={[
          { id: "roles", label: "직업", active: false, disabled: true },
          { id: "seating", label: "마도서", active: grimoireOpen, onSelect: openGrimoire },
          { id: "play", label: "진행", active: !grimoireOpen, onSelect: () => navigate("play") },
        ]}
        onNavigate={navigate}
        className="tbProductionShell issue153ProductionShell"
      >
        {stage === "referenceGrimoire" ? (
          <section className="issue153GrimoireStage" aria-label="점쟁이 마도서 열람">
            <TroubleBrewingLiveGrimoire
              players={fortuneTellerPlayers}
              phaseLabel="첫날 밤"
              phaseRuntime="00:00"
              theme={theme}
              busy={false}
              gameEnded={false}
              ruleState={ruleState}
              onGoToProgress={() => setStage(referenceReturnStage)}
              progressActionLabel="진행 →"
            />
          </section>
        ) : grimoireOpen ? (
          <FortuneTellerGrimoireStage
            theme={theme}
            mode={stage === "redHerringGrimoire" ? "redHerring" : "targets"}
            players={fortuneTellerPlayers}
            selectedPlayerIds={selectedPlayerIds}
            allowedPlayerIds={stage === "redHerringGrimoire" ? allowedRedHerringPlayerIds : undefined}
            ruleState={ruleState}
            onTogglePlayer={togglePlayer}
            onConfirm={confirmSelection}
            onReset={() => setSelectedPlayerIds([])}
            onCancel={() => setStage(stage === "redHerringGrimoire" ? "redHerringProgress" : "targetProgress")}
          />
        ) : (
          <PlayPresentation
            ariaLabel="점쟁이 production-like fixture"
            className={`snvManualSurface tbPlaySurface issue153PlaySurface ${theme === "day" ? "snvDaySurface" : "snvNightSurface"}`}
            headerClassName="snvFirstNightHeader tbPlayHeader"
            primaryClassName="snvFirstNightPrimary tbPlayPrimary issue153PlayPrimary"
            phaseHeader={<PhaseHeader backLabel="마도서" />}
            currentTask={stage === "redHerringProgress" ? (
              <FortuneTellerPendingTask
                kind="redHerring"
                informationStatus={informationStatus}
                theme={theme}
                onChooseTargets={openGrimoire}
              />
            ) : stage === "targetProgress" ? (
              <FortuneTellerPendingTask
                kind="targets"
                informationStatus={informationStatus}
                theme={theme}
                onChooseTargets={openGrimoire}
              />
            ) : stage === "information" ? (
              <FortuneTellerInformationTask
                players={selectedPlayers}
                truthHasDemon={truthHasDemon}
                deliveredHasDemon={deliveredHasDemon}
                informationStatus={informationStatus}
                theme={theme}
                revealReviewed={revealReviewed}
                onDeliveredHasDemonChange={setDeliveredHasDemon}
                onOpenReveal={() => setRevealOpen(true)}
                onNext={() => setStage("next")}
              />
            ) : <NextStage character={fortuneTeller} />}
            phaseOrder={<FortuneTellerPhaseOrder stage={stage} />}
          />
        )}
        {revealOpen ? (
          <FortuneTellerReveal
            players={selectedPlayers}
            hasDemon={informationStatus === "healthy" ? truthHasDemon : deliveredHasDemon}
            onClose={() => { setRevealOpen(false); setRevealReviewed(true); }}
          />
        ) : null}
      </ProductionApplicationShell>
    </div>
  );
}

function fortuneTellerStep(mode: "redHerring" | "targets", allowedPlayerIds?: string[]): PhaseStep {
  return {
    id: mode === "redHerring" ? "firstNight:fortuneTellerDecoy" : "firstNight:fortuneTeller",
    phase: "firstNight",
    stepType: mode === "redHerring" ? "redHerringAssignment" : "character",
    character: "fortuneTeller",
    playerId: fortuneTellerPlayers[0].id,
    requiredInput: {
      kind: "playerIds",
      target: "players",
      minSelections: mode === "redHerring" ? 1 : 2,
      maxSelections: mode === "redHerring" ? 1 : 2,
      allowedPlayerIds,
      optional: false,
    },
    canSkip: false,
    support: "manual",
  };
}

function FortuneTellerGrimoireStage({
  theme,
  mode,
  players,
  selectedPlayerIds,
  allowedPlayerIds,
  ruleState,
  onTogglePlayer,
  onConfirm,
  onReset,
  onCancel,
}: {
  theme: Theme;
  mode: "redHerring" | "targets";
  players: Player[];
  selectedPlayerIds: string[];
  allowedPlayerIds?: string[];
  ruleState: RuleState;
  onTogglePlayer: (playerId: string) => void;
  onConfirm: () => void;
  onReset: () => void;
  onCancel: () => void;
}) {
  const requiredCount = mode === "redHerring" ? 1 : 2;
  return (
    <section className="issue153GrimoireStage" aria-label={mode === "redHerring" ? "점쟁이 착각 대상 선택" : "점쟁이 정보 대상 선택"}>
      <TroubleBrewingLiveGrimoire
        players={players}
        currentStep={fortuneTellerStep(mode, allowedPlayerIds)}
        phaseLabel="첫날 밤"
        phaseRuntime="00:00"
        theme={theme}
        busy={false}
        gameEnded={false}
        handoff="target"
        phasePlayerSelection={{ selectedPlayerIds, allowedPlayerIds, disabled: false, onTogglePlayer }}
        ruleState={ruleState}
        onConfirmSelection={onConfirm}
        onResetSelection={onReset}
        onCancelSelection={onCancel}
        selectionReady={selectedPlayerIds.length === requiredCount}
      />
    </section>
  );
}

function FortuneTellerPendingTask({
  kind,
  informationStatus,
  theme,
  onChooseTargets,
}: {
  kind: "redHerring" | "targets";
  informationStatus: InformationStatus;
  theme: Theme;
  onChooseTargets: () => void;
}) {
  return (
    <article className="snvCurrentStep snvInformationTask tbCurrentTask issue153SetupInformationProgressCard" aria-label={kind === "redHerring" ? "점쟁이 착각 대상 지정" : "점쟁이 정보"}>
      <p className="snvCurrentStepLabel">현재 할 일</p>
      <PrototypeActorIdentity character={fortuneTeller} informationStatus={informationStatus} theme={theme} />
      <p className="issue153ProgressAbility">{fortuneTeller.abilitySummary}</p>
      <div className="snvStepActions snvInformationActions issue153TaskActions">
        <button type="button" className="issue153PrimaryAction" onClick={onChooseTargets}>대상 선택</button>
      </div>
    </article>
  );
}

function PrototypeActorIdentity({
  character,
  informationStatus,
  theme,
  playerLabel = "1번 민지",
}: {
  character: Character;
  informationStatus: InformationStatus;
  theme: Theme;
  playerLabel?: string;
}) {
  return (
    <CharacterDetailButton
      details={troubleBrewingCharacterDetail(character.id)}
      className="snvCurrentStepIdentity interactive snvInformationIdentity tbProgressActor issue153ProgressIdentity"
      theme={theme === "day" ? "tb-day" : "tb-night"}
    >
      <CharacterIcon characterId={character.id} />
      <div>
        <span className="snvInformationRoleLine">
          <span className="snvCurrentStepRoleName" role="heading" aria-level={3}>{character.label}</span>
          <ImpairmentBadges impairments={informationStatus === "poisoned" ? ["poisoned"] : []} label="정보 영향" />
        </span>
        <strong>{playerLabel}</strong>
      </div>
    </CharacterDetailButton>
  );
}

function FortuneTellerInformationTask({
  players,
  truthHasDemon,
  deliveredHasDemon,
  informationStatus,
  theme,
  revealReviewed,
  onDeliveredHasDemonChange,
  onOpenReveal,
  onNext,
}: {
  players: Player[];
  truthHasDemon: boolean;
  deliveredHasDemon: boolean;
  informationStatus: InformationStatus;
  theme: Theme;
  revealReviewed: boolean;
  onDeliveredHasDemonChange: (value: boolean) => void;
  onOpenReveal: () => void;
  onNext: () => void;
}) {
  const poisoned = informationStatus === "poisoned";
  const choices = truthHasDemon ? [true, false] : [false, true];
  return (
    <article className="snvCurrentStep snvInformationTask tbCurrentTask issue153SetupInformationProgressCard" aria-label="점쟁이 정보">
      <p className="snvCurrentStepLabel">현재 할 일</p>
      <PrototypeActorIdentity character={fortuneTeller} informationStatus={informationStatus} theme={theme} />
      <p className="issue153ProgressAbility">{fortuneTeller.abilitySummary}</p>
      <div className="issue153TargetSummary" aria-label="점쟁이 대상"><span>대상</span><strong>{players.map((player) => `${player.seat}번 ${player.name}`).join(" · ")}</strong></div>
      <dl className="snvInformationValues issue153ScalarTruth" role="group" aria-label="점쟁이 결과">
        <div><dt>결과</dt><dd>{truthHasDemon ? "있음" : "없음"}</dd></div>
      </dl>
      {poisoned ? (
        <label className="issue153CharacterSelect">
          <span>전달할 정보</span>
          <select aria-label="전달할 정보" disabled={revealReviewed} value={String(deliveredHasDemon)} onChange={(event) => onDeliveredHasDemonChange(event.target.value === "true")}>
            {choices.map((choice) => <option value={String(choice)} key={String(choice)}>{choice ? "있음" : "없음"}</option>)}
          </select>
        </label>
      ) : null}
      <div className="snvStepActions snvInformationActions issue153TaskActions">
        <button type="button" className={["informationReveal", revealReviewed ? "issue153SecondaryReveal" : "prominent", poisoned ? "poisoned" : ""].filter(Boolean).join(" ")} onClick={onOpenReveal}>{poisoned ? "중독 정보 공개" : "정보 공개"}</button>
        {revealReviewed ? <button type="button" className="issue153PrimaryAction" onClick={onNext}>다음 단계</button> : null}
      </div>
    </article>
  );
}

function FortuneTellerReveal({ players, hasDemon, onClose }: { players: Player[]; hasDemon: boolean; onClose: () => void }) {
  return (
    <SectsAndVioletsReveal
      dialogLabel="점쟁이 정보 공개"
      backdropAriaLabel="플레이어 공개 화면"
      className="snvProductionInformationReveal tbInformationReveal issue153SetupInformationReveal issue153FortuneTellerReveal"
      closeLabel="확인했으면 눈을 감으세요"
      onClose={onClose}
    >
      <header className="issue153RevealHeader"><span>점쟁이 정보</span></header>
      <div className="issue153ScalarRevealIdentity"><CharacterIcon characterId="fortuneTeller" /></div>
      <p className="issue153RevealPrompt">이 중에 악마는…</p>
      <div className="issue153RevealSeatCards" role="group" aria-label="확인한 플레이어">
        {players.map((player) => (
          <article className="issue153RevealSeatCard" key={player.id} aria-label={`${player.seat}번 ${player.name} 좌석`}>
            <span>{player.seat}</span>
            <strong>{player.seat}번 {player.name}</strong>
          </article>
        ))}
      </div>
      <strong className="issue153ScalarRevealValue">{hasDemon ? "있음" : "없음"}</strong>
    </SectsAndVioletsReveal>
  );
}

function FortuneTellerPhaseOrder({ stage }: { stage: FortuneTellerStage }) {
  const current = stage === "redHerringProgress" || stage === "redHerringGrimoire" ? 0
    : stage === "targetProgress" || stage === "targetGrimoire" ? 1 : 2;
  return (
    <ol className="snvPhaseOverview issue153PhaseOrder" aria-label="점쟁이 단계 순서">
      {["착각 대상", "정보 대상", "정보 공개"].map((label, index) => (
        <li className={index < current ? "complete" : index === current ? "current" : undefined} key={label}>
          <span>{index < current ? "완료" : index === current ? "현재" : "대기"}</span><strong>{label}</strong>
        </li>
      ))}
    </ol>
  );
}

function SetupInformationPrototype({ characterId }: { characterId: PrototypeCharacterId }) {
  const [outsiderFixture, setOutsiderFixture] = useState<OutsiderFixture>("present");
  const definition = prototypeDefinition(characterId, outsiderFixture);
  const { character, characterKind, players } = definition;
  const [theme, setTheme] = useState<Theme>("night");
  const [informationStatus, setInformationStatus] = useState<InformationStatus>("healthy");
  const [stage, setStage] = useState<FixtureStage>("roles");
  const [referenceReturnStage, setReferenceReturnStage] = useState<SetupInformationReturnStage>("progress");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [shownCharacterId, setShownCharacterId] = useState("");
  const [revealOpen, setRevealOpen] = useState(false);
  const [revealReviewed, setRevealReviewed] = useState(false);

  const selectedPlayers = useMemo(
    () => selectedPlayerIds.flatMap((id) => players.filter((player) => player.id === id)),
    [players, selectedPlayerIds],
  );
  const availableCharacterChoices = useMemo(
    () => informationStatus === "poisoned"
      ? characters.filter((candidate) => candidate.kind === characterKind)
      : selectedPlayers
        .map((player) => characters.find((candidate) => candidate.id === player.actualCharacter))
        .filter((candidate): candidate is Character => Boolean(candidate && candidate.kind === characterKind)),
    [characterId, characterKind, informationStatus, selectedPlayers],
  );
  const zeroOutsiders = shownCharacterId === ZERO_OUTSIDERS;
  const healthyZeroOutsiders = characterId === "librarian" && informationStatus === "healthy" && outsiderFixture === "none";
  const selectionHasTruthfulCharacter = selectedPlayerIds.length === 2 && (
    informationStatus === "poisoned" || availableCharacterChoices.length > 0
  );
  const canOpenProgress = zeroOutsiders || (selectedPlayerIds.length === 2 && shownCharacterId.length > 0);
  const canOpenGrimoire = !healthyZeroOutsiders && stage !== "roles";
  const canOpenProgressTab = (selectionHasTruthfulCharacter || healthyZeroOutsiders) && stage !== "roles";
  const referenceRuleState: RuleState = {
    unannouncedNightDeathPlayerIds: [],
    automaticReminders: setupInformationReminders(
      characterId,
      informationStatus,
      shownCharacterId,
      selectedPlayers,
    ),
  };

  function resetFixture() {
    setStage(healthyZeroOutsiders ? "progress" : "roles");
    setReferenceReturnStage("progress");
    setSelectedPlayerIds([]);
    setShownCharacterId(healthyZeroOutsiders ? ZERO_OUTSIDERS : "");
    setRevealOpen(false);
    setRevealReviewed(false);
  }

  function changeInformationStatus(status: InformationStatus) {
    setInformationStatus(status);
    const directToZeroOutsiders = characterId === "librarian" && status === "healthy" && outsiderFixture === "none";
    setStage(directToZeroOutsiders ? "progress" : "roles");
    setReferenceReturnStage("progress");
    setSelectedPlayerIds([]);
    setShownCharacterId(directToZeroOutsiders ? ZERO_OUTSIDERS : "");
    setRevealOpen(false);
    setRevealReviewed(false);
  }

  function changeOutsiderFixture(fixture: OutsiderFixture) {
    setOutsiderFixture(fixture);
    const directToZeroOutsiders = characterId === "librarian" && informationStatus === "healthy" && fixture === "none";
    setStage(directToZeroOutsiders ? "progress" : "roles");
    setReferenceReturnStage("progress");
    setSelectedPlayerIds([]);
    setShownCharacterId(directToZeroOutsiders ? ZERO_OUTSIDERS : "");
    setRevealOpen(false);
    setRevealReviewed(false);
  }

  function navigateTo(next: string) {
    if (next === "roles") setStage("roles");
    if (next === "seating" && canOpenGrimoire) {
      if ((stage === "progress" || stage === "next") && canOpenProgress) {
        setReferenceReturnStage(stage);
        setStage("referenceGrimoire");
      } else {
        setStage("grimoire");
      }
    }
    if (next === "play" && canOpenProgressTab) {
      setStage(stage === "referenceGrimoire" ? referenceReturnStage : "progress");
    }
  }

  function confirmRoleSelection() {
    if (healthyZeroOutsiders) setShownCharacterId(ZERO_OUTSIDERS);
    setStage(healthyZeroOutsiders ? "progress" : "grimoire");
  }

  function togglePlayer(playerId: string) {
    setSelectedPlayerIds((current) => {
      if (current.includes(playerId)) return current.filter((id) => id !== playerId);
      if (current.length >= 2) return current;
      return [...current, playerId];
    });
  }

  function confirmPlayerSelection() {
    if (selectionHasTruthfulCharacter) setStage("progress");
  }

  function closeReveal() {
    setRevealOpen(false);
    setRevealReviewed(true);
  }


  function changeShownCharacter(characterId: string) {
    setShownCharacterId(characterId);
    if (characterId === ZERO_OUTSIDERS) setSelectedPlayerIds([]);
  }

  const selectedTargetSummary = selectedPlayers.length === 2
    ? `${selectedPlayers[0].seat}번 ${selectedPlayers[0].name} · ${selectedPlayers[1].seat}번 ${selectedPlayers[1].name}`
    : "두 플레이어를 선택하세요";

  return (
    <div className="issue153ReviewRoot">
      <ReviewControls
        character={character}
        informationStatus={informationStatus}
        outsiderFixture={outsiderFixture}
        theme={theme}
        onInformationStatusChange={changeInformationStatus}
        onOutsiderFixtureChange={changeOutsiderFixture}
        onThemeChange={setTheme}
        onReset={resetFixture}
      />

      <ProductionApplicationShell
        ariaLabel={`${character.label} 전체 흐름 fixture`}
        theme={theme}
        motion="none"
        title="Trouble Brewing"
        eyebrow={`ISSUE 153 · ${characterId.toUpperCase()} FLOW`}
        subtitle={`${character.label} · 주민`}
        leading={<span className="issue153FixtureMarker" aria-hidden="true">TB</span>}
        headerActions={<span className="tbPhaseMark" role="img" aria-label={theme === "night" ? "밤" : "낮"}>{theme === "night" ? "☾" : "☀"}</span>}
        headerActionsAriaLabel="현재 페이즈"
        utilities={[
          { id: "new-game", label: "새 게임", disabled: true },
          { id: "storage", label: "저장 / 불러오기", disabled: true },
          { id: "bug-report", label: "버그 제보", disabled: true },
        ]}
        stages={[
          { id: "roles", label: "직업", active: stage === "roles", onSelect: () => navigateTo("roles") },
          { id: "seating", label: "마도서", active: stage === "grimoire" || stage === "referenceGrimoire", disabled: !canOpenGrimoire, onSelect: () => navigateTo("seating") },
          { id: "play", label: "진행", active: stage === "progress" || stage === "next", disabled: !canOpenProgressTab, onSelect: () => navigateTo("play") },
        ]}
        onNavigate={navigateTo}
        className="tbProductionShell issue153ProductionShell"
      >
        {stage === "roles" ? <RoleSelection character={character} directToProgress={healthyZeroOutsiders} informationStatus={informationStatus} theme={theme} onConfirm={confirmRoleSelection} /> : null}
        {stage === "grimoire" ? (
          <GrimoireStage
            theme={theme}
            character={character}
            currentStep={prototypeStep(definition, informationStatus)}
            players={players}
            selectedPlayerIds={selectedPlayerIds}
            onTogglePlayer={togglePlayer}
            onConfirm={confirmPlayerSelection}
            onReset={() => setSelectedPlayerIds([])}
            onCancel={() => setStage("roles")}
            selectionReady={selectionHasTruthfulCharacter}
          />
        ) : null}
        {stage === "referenceGrimoire" ? (
          <section className="issue153GrimoireStage" aria-label={`${character.label} 마도서 열람`}>
            <TroubleBrewingLiveGrimoire
              players={players}
              phaseLabel="첫날 밤"
              phaseRuntime="00:00"
              theme={theme}
              busy={false}
              gameEnded={false}
              interactionLocked
              ruleState={referenceRuleState}
              onGoToProgress={() => setStage(referenceReturnStage)}
              progressActionLabel="진행 →"
            />
          </section>
        ) : null}
        {stage === "progress" || stage === "next" ? (
          <PlayPresentation
            ariaLabel={`${character.label} production-like fixture`}
            className={`snvManualSurface tbPlaySurface issue153PlaySurface ${theme === "day" ? "snvDaySurface" : "snvNightSurface"}`}
            headerClassName="snvFirstNightHeader tbPlayHeader"
            primaryClassName="snvFirstNightPrimary tbPlayPrimary issue153PlayPrimary"
            phaseHeader={<PhaseHeader />}
            currentTask={stage === "progress" ? (
              <SetupInformationProgress
                character={character}
                includeZeroOutsiders={characterId === "librarian" && (informationStatus === "poisoned" || healthyZeroOutsiders)}
                informationStatus={informationStatus}
                fixedTruthLabel={healthyZeroOutsiders ? "외지인 없음" : undefined}
                showTargetSummary={!healthyZeroOutsiders && !zeroOutsiders}
                zeroOutsiders={zeroOutsiders}
                theme={theme}
                selectedTargetSummary={selectedTargetSummary}
                characterChoices={availableCharacterChoices}
                shownCharacterId={shownCharacterId}
                revealReviewed={revealReviewed}
                canOpenReveal={canOpenProgress}
                onCharacterChange={changeShownCharacter}
                onOpenReveal={() => setRevealOpen(true)}
                onNext={() => setStage("next")}
              />
            ) : <NextStage character={character} />}
            phaseOrder={<PhaseOrder character={character} stage={stage} />}
          />
        ) : null}

        {revealOpen ? <SetupInformationReveal character={character} characterId={shownCharacterId} players={selectedPlayers} zeroOutsiders={zeroOutsiders} onClose={closeReveal} /> : null}
      </ProductionApplicationShell>
    </div>
  );
}

function ReviewControls({
  character,
  informationStatus,
  outsiderFixture,
  theme,
  description = "역할 선택부터 마도서 대상 선택, 진행 정보 공개까지 한 경로를 검토합니다.",
  showInformationStatus = true,
  additionalControls,
  onInformationStatusChange,
  onOutsiderFixtureChange,
  onThemeChange,
  onReset,
}: {
  character: Character;
  informationStatus: InformationStatus;
  outsiderFixture: OutsiderFixture;
  theme: Theme;
  description?: string;
  showInformationStatus?: boolean;
  additionalControls?: ReactNode;
  onInformationStatusChange: (status: InformationStatus) => void;
  onOutsiderFixtureChange: (fixture: OutsiderFixture) => void;
  onThemeChange: (theme: Theme) => void;
  onReset: () => void;
}) {
  return (
    <section className="issue153ReviewControls" aria-label="Issue 153 Trouble Brewing 검토 도구">
      <header>
        <span>ISSUE 153 · {character.id.toUpperCase()} FLOW</span>
        <h1>{character.label} 전체 흐름</h1>
        <p>{description}</p>
      </header>
      <div className="issue153ReviewOptions">
        <label>
          테마
          <select aria-label="테마" value={theme} onChange={(event) => onThemeChange(event.target.value as Theme)}>
            <option value="night">밤</option>
            <option value="day">낮</option>
          </select>
        </label>
        {showInformationStatus ? <label>
          {character.label} 상태
          <select aria-label={`${character.label} 상태`} value={informationStatus} onChange={(event) => onInformationStatusChange(event.target.value as InformationStatus)}>
            <option value="healthy">정상</option>
            <option value="poisoned">중독</option>
          </select>
        </label> : null}
        {character.id === "librarian" ? (
          <label>
            외지인 구성
            <select aria-label="외지인 구성" value={outsiderFixture} onChange={(event) => onOutsiderFixtureChange(event.target.value as OutsiderFixture)}>
              <option value="present">성자 있음</option>
              <option value="none">외지인 없음</option>
            </select>
          </label>
        ) : null}
        {additionalControls}
        <button type="button" className="issue153ResetButton" onClick={onReset}>초기화</button>
      </div>
    </section>
  );
}

function PhaseHeader({ backLabel = "마도서", phaseLabel = "첫날 밤" }: { backLabel?: string; phaseLabel?: string }) {
  const label = phaseLabel;
  return <>
    <span className="issue153BackLabel">← {backLabel}</span>
    <div className="snvProgressPhaseHeader"><h2>{label}</h2><time aria-label={`${label} 경과 시간 00:00`}>00:00</time></div>
  </>;
}

function RoleSelection({
  character,
  directToProgress,
  directActionLabel = "정보 선택",
  informationStatus,
  theme,
  onConfirm,
}: {
  character: Character;
  directToProgress: boolean;
  directActionLabel?: string;
  informationStatus: InformationStatus;
  theme: Theme;
  onConfirm: () => void;
}) {
  return (
    <section className="issue153RoleSelection" aria-label={`${character.label} 직업 선택`}>
      <p className="snvCurrentStepLabel">현재 할 일</p>
      <CharacterDetailButton
        details={troubleBrewingCharacterDetail(character.id)}
        className="snvCurrentStepIdentity interactive snvInformationIdentity issue153RoleIdentity"
        theme={theme === "day" ? "tb-day" : "tb-night"}
      >
        <CharacterIcon characterId={character.id} />
        <div>
          <span className="snvInformationRoleLine">
            <span className="snvCurrentStepRoleName" role="heading" aria-level={3}>{character.label}</span>
            <ImpairmentBadges impairments={informationStatus === "poisoned" ? ["poisoned"] : []} label="정보 영향" />
          </span>
          <strong>1번 민지</strong>
        </div>
      </CharacterDetailButton>
      <p className="issue153RoleAbility">{character.abilitySummary}</p>
      <button type="button" className="issue153PrimaryAction issue153RoleConfirm" aria-label={directToProgress ? directActionLabel : "좌석 선택"} onClick={onConfirm}>
        <span>{directToProgress ? directActionLabel : "좌석 선택"}</span><small aria-hidden="true">{directToProgress ? "진행 →" : "마도서 →"}</small>
      </button>
    </section>
  );
}

function GrimoireStage({
  theme,
  character,
  currentStep,
  players,
  selectedPlayerIds,
  onTogglePlayer,
  onConfirm,
  onReset,
  onCancel,
  selectionReady,
}: {
  theme: Theme;
  character: Character;
  currentStep: PhaseStep;
  players: Player[];
  selectedPlayerIds: string[];
  onTogglePlayer: (playerId: string) => void;
  onConfirm: () => void;
  onReset: () => void;
  onCancel: () => void;
  selectionReady: boolean;
}) {
  return (
    <section className="issue153GrimoireStage" aria-label={`${character.label} 마도서 선택`}>
      <TroubleBrewingLiveGrimoire
        players={players}
        currentStep={currentStep}
        phaseLabel="첫날 밤"
        phaseRuntime="00:00"
        theme={theme}
        busy={false}
        gameEnded={false}
        handoff="target"
        setupInformationSelection={{
          selectedPlayerIds,
          disabled: false,
          onTogglePlayer,
        }}
        onConfirmSelection={onConfirm}
        onResetSelection={onReset}
        onCancelSelection={onCancel}
        selectionReady={selectionReady}
      />
    </section>
  );
}

function SetupInformationProgress({
  character,
  includeZeroOutsiders,
  informationStatus,
  fixedTruthLabel,
  showTargetSummary,
  zeroOutsiders,
  theme,
  selectedTargetSummary,
  characterChoices,
  shownCharacterId,
  revealReviewed,
  canOpenReveal,
  onCharacterChange,
  onOpenReveal,
  onNext,
}: {
  character: Character;
  includeZeroOutsiders: boolean;
  informationStatus: InformationStatus;
  fixedTruthLabel?: string;
  showTargetSummary: boolean;
  zeroOutsiders: boolean;
  theme: Theme;
  selectedTargetSummary: string;
  characterChoices: Character[];
  shownCharacterId: string;
  revealReviewed: boolean;
  canOpenReveal: boolean;
  onCharacterChange: (characterId: string) => void;
  onOpenReveal: () => void;
  onNext: () => void;
}) {
  const revealActionLabel = informationStatus === "poisoned" ? "중독 정보 공개" : "정보 공개";
  const revealClassName = [
    "informationReveal",
    revealReviewed ? "issue153SecondaryReveal" : "prominent",
    informationStatus === "poisoned" ? "poisoned" : "",
  ].filter(Boolean).join(" ");

  return (
    <article className="snvCurrentStep snvInformationTask tbCurrentTask issue153SetupInformationProgressCard" aria-label={`${character.label} 정보`}>
      <p className="snvCurrentStepLabel">현재 할 일</p>
      <CharacterDetailButton
        details={troubleBrewingCharacterDetail(character.id)}
        className="snvCurrentStepIdentity interactive snvInformationIdentity tbProgressActor issue153ProgressIdentity"
        theme={theme === "day" ? "tb-day" : "tb-night"}
      >
        <CharacterIcon characterId={character.id} />
        <div>
          <span className="snvInformationRoleLine">
            <span className="snvCurrentStepRoleName" role="heading" aria-level={3}>{character.label}</span>
            <ImpairmentBadges impairments={informationStatus === "poisoned" ? ["poisoned"] : []} label="정보 영향" />
          </span>
          <strong>1번 민지</strong>
        </div>
      </CharacterDetailButton>
      <p className="issue153ProgressAbility">{character.abilitySummary}</p>
      {showTargetSummary ? <div className="issue153TargetSummary" aria-label={`${character.label} 후보 대상`}><span>대상</span><strong>{selectedTargetSummary}</strong></div> : null}
      {fixedTruthLabel ? (
        <div className="issue153TargetSummary issue153TruthSummary" aria-label={`${character.label} 대상`}>
          <span>대상</span><strong>{fixedTruthLabel}</strong>
        </div>
      ) : (
        <label className="issue153CharacterSelect">
          <span>보여줄 캐릭터</span>
          <select aria-label="보여줄 캐릭터" disabled={revealReviewed} value={shownCharacterId} onChange={(event) => onCharacterChange(event.target.value)}>
            <option value="">선택하세요</option>
            {characterChoices.map((character) => <option key={character.id} value={character.id}>{character.label}</option>)}
            {includeZeroOutsiders ? <option value={ZERO_OUTSIDERS}>외지인 없음</option> : null}
          </select>
        </label>
      )}
      <div className="snvStepActions snvInformationActions issue153TaskActions">
        <button type="button" className={revealClassName} disabled={!canOpenReveal} onClick={onOpenReveal}>{revealActionLabel}</button>
        {revealReviewed ? <button type="button" className="issue153PrimaryAction" onClick={onNext}>다음 단계</button> : null}
      </div>
    </article>
  );
}

function SetupInformationReveal({
  character,
  characterId,
  players,
  zeroOutsiders,
  onClose,
}: {
  character: Character;
  characterId: string;
  players: Player[];
  zeroOutsiders: boolean;
  onClose: () => void;
}) {
  return (
    <SectsAndVioletsReveal
      dialogLabel={`${character.label} 정보 공개`}
      backdropAriaLabel="플레이어 공개 화면"
      className="snvProductionInformationReveal tbInformationReveal issue153SetupInformationReveal"
      closeLabel="확인했으면 눈을 감으세요"
      onClose={onClose}
    >
      <header className="issue153RevealHeader"><span>{character.label} 정보</span></header>
      {zeroOutsiders ? (
        <div className="issue153ZeroOutsidersResult">
          <h2>외지인이 없습니다</h2>
        </div>
      ) : (
        <>
          <div className="issue153RevealSeatCards" role="group" aria-label="후보 좌석">
            {players.map((player) => (
              <article className="issue153RevealSeatCard" key={player.id} aria-label={`${player.seat}번 ${player.name} 좌석`}>
                <span>{player.seat}</span>
                <strong>{player.seat}번 {player.name}</strong>
              </article>
            ))}
          </div>
          <p className="issue153RevealPrompt">둘 중 한 명은</p>
          <div className="issue153RevealResult" role="group" aria-label={`공개 직업 ${characterLabel(characterId)}`}>
            <CharacterIcon characterId={characterId} />
            <h2>{characterLabel(characterId)}</h2>
          </div>
        </>
      )}
    </SectsAndVioletsReveal>
  );
}

function NumericInformationProgress({
  character,
  truth,
  unit,
  deliveredNumber,
  informationStatus,
  theme,
  revealReviewed,
  onDeliveredNumberChange,
  onOpenReveal,
  onNext,
}: {
  character: Character;
  truth: number;
  unit: "쌍" | "명";
  deliveredNumber: string;
  informationStatus: InformationStatus;
  theme: Theme;
  revealReviewed: boolean;
  onDeliveredNumberChange: (value: string) => void;
  onOpenReveal: () => void;
  onNext: () => void;
}) {
  const poisoned = informationStatus === "poisoned";
  const canReveal = !poisoned || (/^\d+$/.test(deliveredNumber) && Number.isSafeInteger(Number(deliveredNumber)));
  return (
    <article className="snvCurrentStep snvInformationTask tbCurrentTask issue153SetupInformationProgressCard" aria-label={`${character.label} 정보`}>
      <p className="snvCurrentStepLabel">현재 할 일</p>
      <CharacterDetailButton
        details={troubleBrewingCharacterDetail(character.id)}
        className="snvCurrentStepIdentity interactive snvInformationIdentity tbProgressActor issue153ProgressIdentity"
        theme={theme === "day" ? "tb-day" : "tb-night"}
      >
        <CharacterIcon characterId={character.id} />
        <div>
          <span className="snvInformationRoleLine">
            <span className="snvCurrentStepRoleName" role="heading" aria-level={3}>{character.label}</span>
            <ImpairmentBadges impairments={poisoned ? ["poisoned"] : []} label="정보 영향" />
          </span>
          <strong>1번 민지</strong>
        </div>
      </CharacterDetailButton>
      <p className="issue153ProgressAbility">{character.abilitySummary}</p>
      <dl className="snvInformationValues issue153ScalarTruth" role="group" aria-label={`${character.label} 진실`}>
        <div><dt>진실</dt><dd>{truth}{unit}</dd></div>
      </dl>
      {poisoned ? (
        <label className="issue153NumericDelivery">
          <span>전달할 정보</span>
          <div><input aria-label="전달할 정보" type="number" min="0" step="1" inputMode="numeric" disabled={revealReviewed} value={deliveredNumber} onChange={(event) => onDeliveredNumberChange(event.target.value)} /><strong>{unit}</strong></div>
        </label>
      ) : null}
      <div className="snvStepActions snvInformationActions issue153TaskActions">
        <button
          type="button"
          className={["informationReveal", revealReviewed ? "issue153SecondaryReveal" : "prominent", poisoned ? "poisoned" : ""].filter(Boolean).join(" ")}
          disabled={!canReveal}
          onClick={onOpenReveal}
        >{poisoned ? "중독 정보 공개" : "정보 공개"}</button>
        {revealReviewed ? <button type="button" className="issue153PrimaryAction" onClick={onNext}>다음 단계</button> : null}
      </div>
    </article>
  );
}

function NumericInformationReveal({
  character,
  label,
  unit,
  value,
  onClose,
}: {
  character: Character;
  label: string;
  unit: "쌍" | "명";
  value: number;
  onClose: () => void;
}) {
  return (
    <SectsAndVioletsReveal
      dialogLabel={`${character.label} 정보 공개`}
      backdropAriaLabel="플레이어 공개 화면"
      className="snvProductionInformationReveal tbInformationReveal issue153SetupInformationReveal issue153ScalarInformationReveal"
      closeLabel="확인했으면 눈을 감으세요"
      onClose={onClose}
    >
      <header className="issue153RevealHeader"><span>{character.label} 정보</span></header>
      <div className="issue153ScalarRevealIdentity"><CharacterIcon characterId={character.id} /></div>
      <p className="issue153ScalarRevealLabel">{label}</p>
      <strong className="issue153ScalarRevealValue">{value}{unit}</strong>
    </SectsAndVioletsReveal>
  );
}

function NextStage({ character }: { character: Character }) {
  return <section className="issue153NextStage" aria-label={`${character.label} 다음 단계`}><span>NEXT STEP</span><h2>{character.label} 다음 단계</h2><p>{character.label} 정보 공개 검토가 완료되었습니다.</p></section>;
}

function PhaseOrder({ character, stage, skipGrimoire = false }: { character: Character; stage: FixtureStage; skipGrimoire?: boolean }) {
  const current = stage === "roles" ? 0 : stage === "grimoire" ? 1 : 2;
  return <ol className="snvPhaseOverview issue153PhaseOrder" aria-label={`${character.label} 단계 순서`}>
    {["직업", "마도서", "진행"].map((label, index) => {
      const skipped = skipGrimoire && index === 1;
      return <li className={skipped ? "complete" : index < current ? "complete" : index === current ? "current" : undefined} key={label}><span>{skipped ? "생략" : index < current ? "완료" : index === current ? "현재" : "대기"}</span><strong>{label}</strong></li>;
    })}
  </ol>;
}

function fixturePlayer(id: string, seat: number, name: string, actualCharacter: string, alignment: "good" | "evil"): Player {
  return {
    id,
    seat,
    name,
    actualCharacter,
    shownCharacter: actualCharacter,
    alignment,
    alive: true,
    ghostVoteUsed: false,
    deathAnnounced: false,
    systemTokenIds: [],
    scriptTokens: [],
    notes: "",
  };
}

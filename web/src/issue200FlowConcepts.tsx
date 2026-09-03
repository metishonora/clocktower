import { useEffect, useRef, useState, type ChangeEvent } from "react";
import manuscriptDollyMaster from "./assets/prototypes/issue-200/continuous-manuscript-dolly-master-v6.png";
import { characterAsset } from "./characterAssets";
import { customScriptCharacters } from "./customScriptRegistry";
import { sectsAndVioletsCharacterAsset } from "./sectsAndVioletsCharacterAssets";
import { sectsAndVioletsCharacters } from "./sectsAndVioletsCharacters";
import { characters, type CharacterKind } from "./setupDraft";
import "./issue200FlowConcepts.css";

type JourneyStep = "scenario" | "characters" | "review";
type ScriptSource = "troubleBrewing" | "sectsAndViolets";
type SourceFilter = "all" | ScriptSource;
type KindFilter = "all" | CharacterKind;

type ImportedGameState = {
  fileName: string;
  resumeAvailable: boolean;
  referencedCharacterIds: string[];
};

type CatalogCharacter = {
  id: string;
  kind: CharacterKind;
  label: string;
  englishLabel: string;
  ability: string;
  source: ScriptSource;
  image: string;
};

const journeySteps: Array<{
  id: JourneyStep;
  number: string;
  label: string;
  note: string;
}> = [
  { id: "scenario", number: "1", label: "시나리오", note: "첫 장을 고른다" },
  { id: "characters", number: "2", label: "캐릭터", note: "초상을 꿰어 넣는다" },
  { id: "review", number: "3", label: "검토", note: "구성을 바로잡는다" },
];

const kindOrder: CharacterKind[] = ["Townsfolk", "Outsider", "Minion", "Demon"];
const kindLabels: Record<CharacterKind, string> = {
  Townsfolk: "주민",
  Outsider: "외지인",
  Minion: "하수인",
  Demon: "악마",
};
const sourceLabels: Record<ScriptSource, string> = {
  troubleBrewing: "TB",
  sectsAndViolets: "S&V",
};
const sourceOrder: ScriptSource[] = ["troubleBrewing", "sectsAndViolets"];
const recommendedMinimums: Record<CharacterKind, number> = {
  Townsfolk: 13,
  Outsider: 4,
  Minion: 4,
  Demon: 4,
};
const englishCharacterLabels: Record<string, string> = {
  washerwoman: "Washerwoman",
  librarian: "Librarian",
  investigator: "Investigator",
  chef: "Chef",
  empath: "Empath",
  fortuneTeller: "Fortune Teller",
  undertaker: "Undertaker",
  monk: "Monk",
  ravenkeeper: "Ravenkeeper",
  virgin: "Virgin",
  slayer: "Slayer",
  soldier: "Soldier",
  mayor: "Mayor",
  butler: "Butler",
  drunk: "Drunk",
  recluse: "Recluse",
  saint: "Saint",
  poisoner: "Poisoner",
  spy: "Spy",
  scarletWoman: "Scarlet Woman",
  baron: "Baron",
  imp: "Imp",
  clockmaker: "Clockmaker",
  dreamer: "Dreamer",
  snakeCharmer: "Snake Charmer",
  mathematician: "Mathematician",
  flowergirl: "Flowergirl",
  townCrier: "Town Crier",
  oracle: "Oracle",
  savant: "Savant",
  seamstress: "Seamstress",
  philosopher: "Philosopher",
  artist: "Artist",
  juggler: "Juggler",
  sage: "Sage",
  mutant: "Mutant",
  sweetheart: "Sweetheart",
  barber: "Barber",
  klutz: "Klutz",
  evilTwin: "Evil Twin",
  witch: "Witch",
  cerenovus: "Cerenovus",
  pitHag: "Pit-Hag",
  fangGu: "Fang Gu",
  vigormortis: "Vigormortis",
  noDashii: "No Dashii",
  vortox: "Vortox",
};
const koreanNameCollator = new Intl.Collator("ko-KR", { sensitivity: "base" });

const tbById = new Map(characters.map((character) => [character.id, character]));
const snvById = new Map(sectsAndVioletsCharacters.map((character) => [character.id, character]));
const catalog: CatalogCharacter[] = customScriptCharacters.map(({ id, kind }) => {
  const tbCharacter = tbById.get(id);
  if (tbCharacter) {
    return {
      id,
      kind,
      label: tbCharacter.label,
      englishLabel: englishCharacterLabels[id] ?? id,
      ability: tbCharacter.abilitySummary,
      source: "troubleBrewing",
      image: characterAsset(id)?.src ?? "",
    };
  }
  const snvCharacter = snvById.get(id);
  if (!snvCharacter) throw new Error(`Custom catalog metadata is missing for ${id}`);
  return {
    id,
    kind,
    label: snvCharacter.name,
    englishLabel: englishCharacterLabels[id] ?? id,
    ability: snvCharacter.ability,
    source: "sectsAndViolets",
    image: sectsAndVioletsCharacterAsset(id)?.src ?? "",
  };
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectReferencedCharacters(value: unknown, knownIds: Set<string>, collected: Set<string>) {
  if (typeof value === "string") {
    if (knownIds.has(value)) collected.add(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectReferencedCharacters(item, knownIds, collected));
    return;
  }
  if (isRecord(value)) {
    Object.values(value).forEach((item) => collectReferencedCharacters(item, knownIds, collected));
  }
}

function parseImportedGame(json: string, fileName: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("게임 JSON 형식이 올바르지 않습니다.");
  }
  if (!isRecord(parsed) || ![2, 3, 4].includes(Number(parsed.schemaVersion)) || !isRecord(parsed.game)) {
    throw new Error("지원하는 Clocktower 게임 JSON이 아닙니다.");
  }

  const game = parsed.game;
  if (
    typeof game.id !== "string"
    || typeof game.createdAt !== "string"
    || typeof game.updatedAt !== "string"
    || !Array.isArray(game.events)
  ) {
    throw new Error("게임 진행 기록을 읽을 수 없습니다.");
  }
  const events = game.events.filter(isRecord);
  const script = isRecord(game.script) ? game.script : undefined;
  const definition = script?.type === "custom" && isRecord(script.definition) ? script.definition : undefined;
  const scriptId = parsed.schemaVersion === 2
    ? "troubleBrewing"
    : typeof game.scriptId === "string"
      ? game.scriptId
      : script?.type === "official" && typeof script.scriptId === "string"
        ? script.scriptId
        : undefined;

  let characterIds: string[];
  if (definition) {
    if (!Array.isArray(definition.characterIds)) throw new Error("커스텀 시나리오의 직업 목록을 읽을 수 없습니다.");
    characterIds = definition.characterIds.filter((id): id is string => typeof id === "string");
  } else if (scriptId === "troubleBrewing") {
    characterIds = catalog.filter((character) => character.source === "troubleBrewing").map((character) => character.id);
  } else if (scriptId === "sectsAndViolets") {
    characterIds = catalog.filter((character) => character.source === "sectsAndViolets").map((character) => character.id);
  } else {
    throw new Error("현재 시안에서 지원하지 않는 시나리오입니다.");
  }

  const knownCharacterIds = new Set(catalog.map((character) => character.id));
  const uniqueCharacterIds = [...new Set(characterIds)];
  if (uniqueCharacterIds.some((id) => !knownCharacterIds.has(id))) {
    throw new Error("아직 지원하지 않는 직업이 포함되어 있습니다.");
  }

  const customName = typeof definition?.name === "string" ? definition.name.trim() : "";
  const gameName = typeof game.name === "string" ? game.name.trim() : "";
  const hasSetup = events.some((event) => event.type === "setupConfirmed");
  const hasEnded = events.some((event) => event.type === "gameEnded");
  const referencedCharacterIds = new Set<string>();
  collectReferencedCharacters(events, knownCharacterIds, referencedCharacterIds);

  return {
    name: customName || gameName,
    characterIds: uniqueCharacterIds,
    importedGame: {
      fileName,
      resumeAvailable: hasSetup && !hasEnded,
      referencedCharacterIds: [...referencedCharacterIds],
    } satisfies ImportedGameState,
  };
}

export function Issue200FlowConcepts({ onExit }: { onExit?: () => void } = {}) {
  const [step, setStep] = useState<JourneyStep>("scenario");
  const [selectedScriptAction, setSelectedScriptAction] = useState<"new" | "load">("new");
  const [scenarioName, setScenarioName] = useState("");
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>([]);
  const [activeKind, setActiveKind] = useState<KindFilter>("Townsfolk");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [query, setQuery] = useState("");
  const [focusedCharacterId, setFocusedCharacterId] = useState<string | null>(null);
  const [importedGame, setImportedGame] = useState<ImportedGameState | null>(null);
  const [importError, setImportError] = useState("");
  const [wideLayout, setWideLayout] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const originalViewportContentRef = useRef<string | undefined>(undefined);
  const currentIndex = journeySteps.findIndex((candidate) => candidate.id === step);
  const counts = Object.fromEntries(kindOrder.map((kind) => [kind, 0])) as Record<CharacterKind, number>;
  selectedCharacterIds.forEach((id) => {
    const character = catalog.find((candidate) => candidate.id === id);
    if (character) counts[character.kind] += 1;
  });
  const sourceCounts = Object.fromEntries(sourceOrder.map((source) => [source, 0])) as Record<ScriptSource, number>;
  selectedCharacterIds.forEach((id) => {
    const character = catalog.find((candidate) => candidate.id === id);
    if (character) sourceCounts[character.source] += 1;
  });
  const normalizedQuery = query.trim().toLocaleLowerCase("ko");
  const visibleCharacters = catalog
    .filter((character) => (
      (activeKind === "all" || character.kind === activeKind) &&
      (sourceFilter === "all" || character.source === sourceFilter) &&
      (normalizedQuery.length === 0 ||
        character.label.toLocaleLowerCase("ko").includes(normalizedQuery) ||
        character.englishLabel.toLocaleLowerCase("en").includes(normalizedQuery))
    ))
    .sort((left, right) => koreanNameCollator.compare(left.label, right.label));
  const focusedCharacter = catalog.find((character) => character.id === focusedCharacterId);
  const selectedCharacters = catalog
    .filter((character) => selectedCharacterIds.includes(character.id))
    .sort((left, right) => {
      const kindDifference = kindOrder.indexOf(left.kind) - kindOrder.indexOf(right.kind);
      return kindDifference || koreanNameCollator.compare(left.label, right.label);
    });
  const removedReferencedCharacters = importedGame?.referencedCharacterIds.filter(
    (characterId) => !selectedCharacterIds.includes(characterId),
  ) ?? [];
  const resumeAvailable = Boolean(importedGame?.resumeAvailable && removedReferencedCharacters.length === 0);
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "이어지는 원고 시안 · Clocktower";
    return () => { document.title = previousTitle; };
  }, []);

  useEffect(() => {
    const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (!viewport) return;
    originalViewportContentRef.current ??= viewport.content;
    viewport.content = wideLayout
      ? "width=1440, initial-scale=1.0"
      : originalViewportContentRef.current;
    return () => {
      viewport.content = originalViewportContentRef.current ?? "width=device-width, initial-scale=1.0";
    };
  }, [wideLayout]);

  const move = (direction: -1 | 1) => {
    const nextIndex = Math.min(journeySteps.length - 1, Math.max(0, currentIndex + direction));
    setStep(journeySteps[nextIndex].id);
  };

  const openCharacters = () => {
    setScenarioName("");
    setSelectedCharacterIds([]);
    setImportedGame(null);
    setImportError("");
    setActiveKind("Townsfolk");
    setSourceFilter("all");
    setQuery("");
    setFocusedCharacterId(null);
    setStep("characters");
  };

  const importGame = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      const loaded = parseImportedGame(await file.text(), file.name);
      setScenarioName(loaded.name);
      setSelectedCharacterIds(loaded.characterIds);
      setImportedGame(loaded.importedGame);
      setImportError("");
      setFocusedCharacterId(null);
      setStep("review");
    } catch (error) {
      setImportedGame(null);
      setImportError(error instanceof Error ? error.message : "게임 파일을 불러오지 못했습니다.");
    }
  };

  const toggleCharacter = (characterId: string) => {
    setFocusedCharacterId(characterId);
    setSelectedCharacterIds((current) => current.includes(characterId)
      ? current.filter((id) => id !== characterId)
      : [...current, characterId]);
  };

  return (
    <div className={`issue200JourneyReview${wideLayout ? " issue200JourneyWide" : ""}`}>
      <main className="issue200JourneyCanvas" aria-label="이어지는 원고 전체 경로 시안">
        <svg className="issue200InkFilters" aria-hidden="true">
          <defs>
            <filter id="issue200-ink-edge" x="-4%" y="-14%" width="108%" height="128%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.72"
                numOctaves="2"
                seed="17"
                result="paperNoise"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="paperNoise"
                scale="0.55"
                xChannelSelector="R"
                yChannelSelector="B"
              />
            </filter>
          </defs>
        </svg>

        <figure className={`issue200JourneyFrame is-${step}`} aria-live="polite">
          <img src={manuscriptDollyMaster} alt="" />
        </figure>

        <div className="issue200JourneyVignette" aria-hidden="true" />
        {step === "scenario" ? (
          <section className="issue200ScriptSheet panel-transparent" aria-labelledby="issue200-script-title">
            <input
              ref={importInputRef}
              className="issue200FileInput"
              type="file"
              accept="application/json,.json"
              hidden
              onChange={importGame}
            />
            <header>
              <h1 id="issue200-script-title">Ⅰ. 시나리오 선택</h1>
            </header>

            <div className="issue200ScriptChoices" role="group" aria-label="시나리오 작업 선택">
              <button
                type="button"
                aria-pressed={selectedScriptAction === "new"}
                onClick={() => {
                  setSelectedScriptAction("new");
                  setImportError("");
                }}
              >
                <strong>새롭게 작성한다</strong>
              </button>
              <button
                type="button"
                aria-pressed={selectedScriptAction === "load"}
                onClick={() => {
                  setSelectedScriptAction("load");
                  setImportError("");
                }}
              >
                <strong>기존 시나리오를 불러온다</strong>
              </button>
            </div>

            <p className={`issue200ScriptImportStatus${importError ? " is-error" : ""}`} role={importError ? "alert" : undefined}>
              {importError}
            </p>

            <button
              type="button"
              className="issue200ScriptContinue"
              onClick={selectedScriptAction === "load"
                ? () => importInputRef.current?.click()
                : openCharacters}
            >
              <span>{selectedScriptAction === "load" ? "JSON 파일을 선택한다" : "다음으로"}</span>
            </button>
          </section>
        ) : step === "characters" ? (
          <CharacterSelectionSheet
            name={scenarioName}
            selectedIds={selectedCharacterIds}
            counts={counts}
            activeKind={activeKind}
            sourceFilter={sourceFilter}
            query={query}
            characters={visibleCharacters}
            focusedCharacter={focusedCharacter}
            onNameChange={setScenarioName}
            onActiveKindChange={(kind) => {
              setActiveKind(kind);
              setQuery("");
              setFocusedCharacterId(null);
            }}
            onSourceFilterChange={(source) => {
              setSourceFilter(source);
              setQuery("");
              setFocusedCharacterId(null);
            }}
            onQueryChange={(nextQuery) => {
              setQuery(nextQuery);
              if (nextQuery.trim().length > 0) {
                setActiveKind("all");
                setSourceFilter("all");
              }
              setFocusedCharacterId(null);
            }}
            onToggleCharacter={toggleCharacter}
            onCloseCharacter={() => setFocusedCharacterId(null)}
            onBack={() => setStep("scenario")}
            onContinue={() => setStep("review")}
          />
        ) : (
          <ReviewSheet
            name={scenarioName}
            selectedCharacters={selectedCharacters}
            counts={counts}
            sourceCounts={sourceCounts}
            allowUnnamed={Boolean(importedGame)}
            resumeAvailable={resumeAvailable}
            resumeBlockedByChanges={Boolean(importedGame?.resumeAvailable && removedReferencedCharacters.length > 0)}
            onBack={() => setStep("characters")}
          />
        )}

        <button
          type="button"
          className="issue200JourneyEdge issue200JourneyPrevious"
          aria-label="이전 장면"
          disabled={currentIndex === 0 && !onExit}
          onClick={() => {
            if (currentIndex === 0 && onExit) onExit();
            else move(-1);
          }}
        ><span aria-hidden="true">‹</span></button>
        <button
          type="button"
          className="issue200JourneyEdge issue200JourneyNext"
          aria-label="다음 장면"
          disabled={currentIndex === journeySteps.length - 1}
          onClick={() => move(1)}
        ><span aria-hidden="true">›</span></button>
      </main>

      <aside className="issue200JourneyDock" aria-label="프로토타입 검토 도구">
        <div className="issue200JourneyIdentity">
          <small>ISSUE #200 · VISUAL STUDY</small>
          <strong>한 권의 원고가 멀어지는 경로</strong>
        </div>

        <nav className="issue200JourneySteps" aria-label="검토 장면">
          {journeySteps.map((candidate, index) => (
            <button
              key={candidate.id}
              type="button"
              aria-pressed={step === candidate.id}
              onClick={() => setStep(candidate.id)}
            >
              <span>{candidate.number}</span>
              <strong>{candidate.label}</strong>
              {index < journeySteps.length - 1 ? <i aria-hidden="true" /> : null}
            </button>
          ))}
        </nav>

        <button
          type="button"
          className="issue200JourneyWideToggle"
          aria-pressed={wideLayout}
          onClick={() => setWideLayout((current) => !current)}
        >{wideLayout ? "화면 맞춤" : "넓게 보기"}</button>
      </aside>
    </div>
  );
}

function ReviewSheet({
  name,
  selectedCharacters,
  counts,
  sourceCounts,
  allowUnnamed,
  resumeAvailable,
  resumeBlockedByChanges,
  onBack,
}: {
  name: string;
  selectedCharacters: CatalogCharacter[];
  counts: Record<CharacterKind, number>;
  sourceCounts: Record<ScriptSource, number>;
  allowUnnamed: boolean;
  resumeAvailable: boolean;
  resumeBlockedByChanges: boolean;
  onBack: () => void;
}) {
  const selectedCount = selectedCharacters.length;
  const missingName = name.trim().length === 0;
  const missingCharacters = selectedCount === 0;
  const missingNameBlocks = missingName && !allowUnnamed;
  const hasBlocker = missingNameBlocks || missingCharacters;
  const shortages = kindOrder.filter((kind) => counts[kind] < recommendedMinimums[kind]);

  return (
    <section className="issue200ReviewSheet" aria-labelledby="issue200-review-title">
      <header>
        <h1 id="issue200-review-title">Ⅲ. 구성 검토</h1>
      </header>

      <div className="issue200ReviewScroll">
        <dl className="issue200ReviewSummary">
          <div>
            <dt>시나리오</dt>
            <dd className={missingName ? "is-missing" : undefined}>{missingName ? "이름 없음" : name.trim()}</dd>
          </div>
          <div>
            <dt>캐릭터</dt>
            <dd className={missingCharacters ? "is-missing" : undefined}>{selectedCount}명</dd>
          </div>
          {kindOrder.map((kind) => (
            <div key={kind}>
              <dt>{kindLabels[kind]}</dt>
              <dd>{counts[kind]}</dd>
            </div>
          ))}
          <div className="issue200ReviewSources">
            <dt>출처</dt>
            <dd>
              {sourceOrder.map((source) => (
                <span key={source}><b>{sourceLabels[source]}</b> {sourceCounts[source]}</span>
              ))}
            </dd>
          </div>
        </dl>

        <div className="issue200ReviewRoster" aria-label="선택된 캐릭터">
          {selectedCharacters.length === 0 ? (
            <p className="issue200ReviewRosterEmpty">선택된 캐릭터가 없습니다.</p>
          ) : kindOrder.map((kind) => {
            const charactersOfKind = selectedCharacters.filter((character) => character.kind === kind);
            if (charactersOfKind.length === 0) return null;
            return (
              <section key={kind} className={`issue200ReviewKind kind-${kind.toLowerCase()}`}>
                <h2>{kindLabels[kind]} <small>{charactersOfKind.length}</small></h2>
                <ul>
                  {charactersOfKind.map((character) => (
                    <li key={character.id}>
                      <span>
                        {character.image ? <img src={character.image} alt="" /> : <b>{character.label[0]}</b>}
                      </span>
                      <div>
                        <strong>{character.label}</strong>
                        <small>{character.englishLabel}</small>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>

      <div className="issue200ReviewFindings" aria-live="polite">
        {missingNameBlocks ? <p className="is-blocked">시나리오 이름을 입력해야 합니다.</p> : null}
        {missingCharacters ? <p className="is-blocked">캐릭터를 한 명 이상 선택해야 합니다.</p> : null}
        {resumeBlockedByChanges ? <p className="is-warning">진행 기록에 사용된 직업이 제외되어 새 게임으로만 시작할 수 있습니다.</p> : null}
        {!missingCharacters && shortages.length > 0 ? (
          <section className="issue200ReviewRecommendation" aria-label="캐릭터 종류별 후보 수 검토">
            <ul>
              {shortages.map((kind) => (
                <li key={kind}>{kindLabels[kind]} 수가 부족합니다.</li>
              ))}
            </ul>
          </section>
        ) : null}
        {!hasBlocker && shortages.length === 0 ? <p className="is-ready">권장 최소 구성을 충족합니다.</p> : null}
      </div>

      <footer>
        <button type="button" className="issue200ReviewBack" onClick={onBack}>돌아간다</button>
        <button
          type="button"
          className={`issue200ReviewStart${resumeAvailable ? "" : " is-primary"}`}
          disabled={hasBlocker}
        >새 게임</button>
        {resumeAvailable ? (
          <button type="button" className="issue200ReviewResume is-primary">이어서 진행</button>
        ) : null}
      </footer>
    </section>
  );
}

function CharacterSelectionSheet({
  name,
  selectedIds,
  counts,
  activeKind,
  sourceFilter,
  query,
  characters: visibleCharacters,
  focusedCharacter,
  onNameChange,
  onActiveKindChange,
  onSourceFilterChange,
  onQueryChange,
  onToggleCharacter,
  onCloseCharacter,
  onBack,
  onContinue,
}: {
  name: string;
  selectedIds: string[];
  counts: Record<CharacterKind, number>;
  activeKind: KindFilter;
  sourceFilter: SourceFilter;
  query: string;
  characters: CatalogCharacter[];
  focusedCharacter?: CatalogCharacter;
  onNameChange: (name: string) => void;
  onActiveKindChange: (kind: CharacterKind) => void;
  onSourceFilterChange: (source: SourceFilter) => void;
  onQueryChange: (query: string) => void;
  onToggleCharacter: (characterId: string) => void;
  onCloseCharacter: () => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <section className="issue200CharacterSheet" aria-labelledby="issue200-character-title">
      <header className="issue200CharacterHeader">
        <h1 id="issue200-character-title">Ⅱ. 캐릭터 선택</h1>
      </header>

      <div className="issue200CharacterFields">
        <label className="issue200CharacterName">
          <span>시나리오 이름</span>
          <input
            value={name}
            maxLength={60}
            placeholder="이름을 입력하세요"
            onChange={(event) => onNameChange(event.target.value)}
          />
        </label>
        <label className="issue200CharacterSearch">
          <span>캐릭터 검색</span>
          <input
            type="search"
            value={query}
            placeholder="한글·영문 이름으로 찾기"
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>
      </div>

      <div className="issue200CharacterFilters">
        <div className="issue200CharacterKinds" role="tablist" aria-label="캐릭터 종류">
          {kindOrder.map((kind) => (
            <button
              key={kind}
              type="button"
              className={`kind-${kind.toLowerCase()}`}
              role="tab"
              aria-selected={activeKind === kind}
              onClick={() => onActiveKindChange(kind)}
            >{kindLabels[kind]} <small>{counts[kind]}</small></button>
          ))}
        </div>
        <div className="issue200CharacterSources" role="group" aria-label="원본 스크립트">
          {(["all", "troubleBrewing", "sectsAndViolets"] as SourceFilter[]).map((source) => (
            <button
              key={source}
              type="button"
              aria-pressed={sourceFilter === source}
              onClick={() => onSourceFilterChange(source)}
            >{source === "all" ? "전체" : sourceLabels[source]}</button>
          ))}
        </div>
      </div>

      <div className="issue200CharacterCatalog">
        <div className="issue200CharacterGrid" aria-live="polite">
          {visibleCharacters.map((character) => {
            const selected = selectedIds.includes(character.id);
            return (
              <button
                key={character.id}
                type="button"
                className={`kind-${character.kind.toLowerCase()}`}
                aria-pressed={selected}
                aria-describedby={focusedCharacter?.id === character.id ? "issue200-character-detail" : undefined}
                onClick={() => onToggleCharacter(character.id)}
              >
                <span>
                  {character.image ? <img src={character.image} alt="" /> : <b>{character.label[0]}</b>}
                  <i aria-hidden="true">✓</i>
                </span>
                <strong>{character.label}</strong>
              </button>
            );
          })}
          {visibleCharacters.length === 0 ? <p>검색 결과가 없습니다.</p> : null}
        </div>

      </div>

      <footer className={`issue200CharacterFooter${focusedCharacter ? " has-detail" : ""}`}>
        {focusedCharacter ? (
          <aside className={`issue200CharacterDetail kind-${focusedCharacter.kind.toLowerCase()}`} id="issue200-character-detail" aria-live="polite">
            <span className="issue200CharacterDetailToken">
              {focusedCharacter.image ? <img src={focusedCharacter.image} alt="" /> : <b>{focusedCharacter.label[0]}</b>}
            </span>
            <div>
              <header>
                <h2>{focusedCharacter.label}</h2>
                <small>{focusedCharacter.englishLabel} · {kindLabels[focusedCharacter.kind]} · {sourceLabels[focusedCharacter.source]}</small>
              </header>
              <p>{focusedCharacter.ability}</p>
            </div>
            <button type="button" aria-label="직업 요약 닫기" onClick={onCloseCharacter}>×</button>
          </aside>
        ) : null}
        <div>
          <button type="button" className="issue200CharacterBack" onClick={onBack}>이전으로</button>
          <button type="button" className="issue200CharacterContinue" onClick={onContinue}>선택 완료</button>
        </div>
      </footer>
    </section>
  );
}

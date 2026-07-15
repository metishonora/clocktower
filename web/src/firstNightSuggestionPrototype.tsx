import { useMemo, useState } from "react";
import "./firstNightSuggestionPrototype.css";
import type { Player } from "./core/types";
import { Grimoire } from "./features/grimoire/Grimoire";
import {
  characterLabel,
  characters,
  createSetupDraftFromConfirmedPlayers,
  type CharacterKind,
} from "./setupDraft";

// PROTOTYPE issue #46: the accepted inline placement, isolated from production
// core, store, commands, events, persistence, and Reveal behavior.

export type ScenarioKey =
  | "washerwoman"
  | "librarian"
  | "librarianZero"
  | "investigator"
  | "impairedInvestigator"
  | "demon"
  | "unavailable";

export type SuggestionDraft = {
  playerIds: string[];
  characterId: string;
  zeroOutsiders: boolean;
  characterIds: string[];
};

export type PrototypeRandomIndex = (upperExclusive: number) => number;

type PrototypeScenario = {
  key: ScenarioKey;
  tabLabel: string;
  title: string;
  description: string;
  mode: "setupInfo" | "demon";
  actorId?: string;
  characterKind?: CharacterKind;
  impaired?: boolean;
  players: Player[];
  allowedCharacterIds?: string[];
  initialDraft: SuggestionDraft;
};

const prototypePlayers: Player[] = [
  player("player-1", 1, "민지", "washerwoman", "washerwoman", "good"),
  player("player-2", 2, "준호", "chef", "chef", "good"),
  player("player-3", 3, "서연", "undertaker", "undertaker", "good"),
  player("player-4", 4, "도윤", "librarian", "librarian", "good"),
  player("player-5", 5, "하린", "saint", "saint", "good"),
  player("player-6", 6, "지우", "butler", "butler", "good"),
  player("player-7", 7, "유나", "investigator", "investigator", "good"),
  player("player-8", 8, "태오", "poisoner", "poisoner", "evil"),
  player("player-9", 9, "가람", "imp", "imp", "evil"),
  player("player-10", 10, "현우", "spy", "spy", "evil"),
  player("player-11", 11, "수빈", "drunk", "investigator", "good"),
];

const noOutsiderPlayers = prototypePlayers.map((candidate) =>
  candidate.id === "player-5"
    ? { ...candidate, actualCharacter: "fortuneTeller", shownCharacter: "fortuneTeller" }
    : candidate.id === "player-6"
      ? { ...candidate, actualCharacter: "monk", shownCharacter: "monk" }
      : candidate.id === "player-11"
        ? { ...candidate, actualCharacter: "ravenkeeper", shownCharacter: "ravenkeeper" }
        : candidate,
);

const scenarios: PrototypeScenario[] = [
  setupScenario("washerwoman", "세탁부", "정상 세탁부 정보", "player-1", "Townsfolk"),
  setupScenario("librarian", "사서", "실제 외부인이 있는 사서 정보", "player-4", "Outsider"),
  {
    ...setupScenario("librarianZero", "사서 0명", "실제 외부인이 없는 사서 정보", "player-4", "Outsider"),
    players: noOutsiderPlayers,
    description: "Actual Outsider가 없으므로 외부인 0명 입력을 선택합니다.",
  },
  setupScenario("investigator", "조사관", "정상 조사관 정보", "player-7", "Minion"),
  {
    ...setupScenario("impairedInvestigator", "술취한 조사관", "술꾼·중독 상태의 조사관 정보", "player-11", "Minion"),
    impaired: true,
    description: "서로 다른 후보 두 명과 조사관 능력 형태의 하수인 캐릭터를 선택합니다.",
  },
  {
    key: "demon",
    tabLabel: "악마 블러프",
    title: "악마 정보 블러프",
    description: "사용 가능한 미사용 선한 캐릭터 중 정확히 세 개를 선택합니다.",
    mode: "demon",
    players: prototypePlayers,
    allowedCharacterIds: ["fortuneTeller", "monk", "ravenkeeper", "virgin", "mayor", "soldier"],
    initialDraft: emptyDraft(),
  },
  {
    key: "unavailable",
    tabLabel: "방어적 실패",
    title: "블러프 후보가 부족한 방어적 상태",
    description: "정상 Trouble Brewing 설정에서는 도달하지 않아야 하는 방어적 실패 예시입니다.",
    mode: "demon",
    players: prototypePlayers,
    allowedCharacterIds: ["fortuneTeller", "monk"],
    initialDraft: demonDraft(["fortuneTeller"]),
  },
];

export function FirstNightSuggestionPrototype({
  randomIndex = cryptoRandomIndex,
}: {
  randomIndex?: PrototypeRandomIndex;
} = {}) {
  const [scenarioKey, setScenarioKey] = useState<ScenarioKey>(() => urlScenario());
  const initialScenario = scenarioByKey(scenarioKey);
  const [draft, setDraft] = useState<SuggestionDraft>(() => cloneDraft(initialScenario.initialDraft));
  const [hasSuggested, setHasSuggested] = useState(false);
  const [failure, setFailure] = useState<string>();
  const scenario = scenarioByKey(scenarioKey);
  const suggestionPool = useMemo(() => buildSuggestionPool(scenario), [scenario]);
  const actor = scenario.actorId ? scenario.players.find((candidate) => candidate.id === scenario.actorId) : undefined;
  const characterOptions = setupCharacterOptions(scenario, draft);
  const grimoireDraft = useMemo(
    () =>
      createSetupDraftFromConfirmedPlayers(
        scenario.players.map((candidate) => ({
          seat: candidate.seat,
          name: candidate.name,
          actualCharacter: candidate.actualCharacter,
          shownCharacter: candidate.shownCharacter,
        })),
      ),
    [scenario],
  );

  function chooseScenario(nextKey: ScenarioKey) {
    const next = scenarioByKey(nextKey);
    setScenarioKey(next.key);
    setDraft(cloneDraft(next.initialDraft));
    setHasSuggested(false);
    setFailure(undefined);
    updateUrl(next.key);
  }

  function suggest() {
    if (suggestionPool.length === 0) {
      setFailure(
        scenario.mode === "demon"
          ? "블러프 후보가 3개 미만입니다. Actual Character 배정과 사용 가능한 Trouble Brewing 캐릭터를 확인하세요. 현재 입력은 유지했습니다."
          : "무작위 추천을 만들 수 없습니다. Actual Character 배정과 현재 단계 조건을 확인하세요. 현재 입력은 유지했습니다.",
      );
      return;
    }
    const different = suggestionPool.filter((candidate) => draftSignature(candidate) !== draftSignature(draft));
    const choices = different.length > 0 ? different : suggestionPool;
    const index = randomIndex(choices.length);
    if (!Number.isInteger(index) || index < 0 || index >= choices.length) {
      throw new RangeError(`randomIndex returned ${index} for ${choices.length} choices`);
    }
    setDraft(cloneDraft(choices[index]));
    setHasSuggested(true);
    setFailure(undefined);
  }

  function updateManually(next: SuggestionDraft) {
    setDraft(next);
    setFailure(undefined);
  }

  function togglePlayer(playerId: string) {
    const selected = draft.playerIds.includes(playerId);
    const playerIds = selected
      ? draft.playerIds.filter((selectedId) => selectedId !== playerId)
      : draft.playerIds.length >= 2
        ? draft.playerIds
        : [...draft.playerIds, playerId];
    if (playerIds === draft.playerIds) return;
    const next = { ...draft, playerIds, zeroOutsiders: false };
    const options = setupCharacterOptions(scenario, next);
    if (!options.some((character) => character.id === next.characterId)) next.characterId = "";
    updateManually(next);
  }

  function toggleBluff(characterId: string) {
    const characterIds = draft.characterIds.includes(characterId)
      ? draft.characterIds.filter((selectedId) => selectedId !== characterId)
      : draft.characterIds.length >= 3
        ? draft.characterIds
        : [...draft.characterIds, characterId];
    if (characterIds === draft.characterIds) return;
    updateManually({ ...draft, characterIds });
  }

  const suggestionAction = (
    <button type="button" className="suggestionActionButton" onClick={suggest}>
      {hasSuggested ? "다시 추천" : "무작위 추천"}
    </button>
  );

  return (
    <main className="firstNightSuggestionPrototype">
      <header className="suggestionPrototypeHeader">
        <div>
          <p className="eyebrow">이슈 #46 프로토타입 · 이야기꾼 전용</p>
          <h1>첫 밤 정보 입력</h1>
        </div>
        <span className="phaseBadge">첫 번째 밤</span>
      </header>

      <nav className="suggestionScenarioTabs" aria-label="무작위 추천 프로토타입 시나리오">
        {scenarios.map((item) => (
          <button type="button" className={item.key === scenario.key ? "selected" : ""} aria-pressed={item.key === scenario.key} onClick={() => chooseScenario(item.key)} key={item.key}>
            {item.tabLabel}
          </button>
        ))}
      </nav>

      <section className="suggestionScenarioSummary">
        <div><strong>{scenario.title}</strong><span>{scenario.description}</span></div>
      </section>

      <div className="suggestionPrototypeWorkspace">
        <section className="panel grimoire suggestionPrototypeGrimoire">
          <div className="sectionHeader"><div><p className="eyebrow">그리모어 · 실제 상태</p><h2>Trouble Brewing</h2></div><span className="phaseBadge">{scenario.players.length}명</span></div>
          <Grimoire players={scenario.players} draft={grimoireDraft} onDraftChange={() => undefined} busy={false} />
        </section>

        <aside className="panel suggestionPrototypeActionPanel">
          <div className="sectionHeader compact">
            <div><p className="eyebrow">첫 번째 밤</p><h2>{actor ? `${characterLabel(actor.shownCharacter)}: ${actor.seat}번 ${actor.name}` : "악마 정보"}</h2></div>
            <span className="phaseBadge">{draftReady(scenario, draft) ? "확정 가능" : "입력 중"}</span>
          </div>

          {scenario.mode === "setupInfo" ? (
            <section className="suggestionCandidateInput" aria-label="설정 정보 후보 입력">
              <div className="suggestionInputHeader"><strong>후보 2명</strong>{suggestionAction}</div>
              {draft.zeroOutsiders ? (
                <button type="button" className="suggestionZeroDraft selected" aria-pressed="true" onClick={() => updateManually({ ...draft, zeroOutsiders: false })}>외부인 0명</button>
              ) : (
                <div className="suggestionCandidateGrid">
                  {scenario.players.map((candidate) => (
                    <button type="button" className={draft.playerIds.includes(candidate.id) ? "selected" : ""} aria-pressed={draft.playerIds.includes(candidate.id)} onClick={() => togglePlayer(candidate.id)} key={candidate.id}>
                      <span>{candidate.seat}</span><span><strong>{candidate.name}</strong><small>실제: {characterLabel(candidate.actualCharacter)}</small></span>
                    </button>
                  ))}
                </div>
              )}
              {!draft.zeroOutsiders ? (
                <label>보여줄 캐릭터<select value={draft.characterId} onChange={(event) => updateManually({ ...draft, characterId: event.target.value })}><option value="">선택</option>{characterOptions.map((character) => <option value={character.id} key={character.id}>{character.label}</option>)}</select></label>
              ) : null}
            </section>
          ) : (
            <section className="suggestionCandidateInput" aria-label="악마 블러프 입력">
              <div className="suggestionInputHeader"><strong>블러프 캐릭터 {draft.characterIds.length} / 3</strong>{suggestionAction}</div>
              <div className="suggestionBluffGrid">
                {(scenario.allowedCharacterIds ?? []).map((characterId) => (
                  <button type="button" className={draft.characterIds.includes(characterId) ? "selected" : ""} aria-pressed={draft.characterIds.includes(characterId)} onClick={() => toggleBluff(characterId)} key={characterId}>{characterLabel(characterId)}</button>
                ))}
              </div>
            </section>
          )}

          {failure ? <p className="suggestionFailure" role="alert">{failure}</p> : null}
          <div className="suggestionPrototypeActions">
            <button type="button" className="primaryButton" disabled={!draftReady(scenario, draft)}>확정</button>
          </div>
        </aside>
      </div>
    </main>
  );
}

export function prototypeSuggestionPool(scenarioKey: ScenarioKey): SuggestionDraft[] {
  return buildSuggestionPool(scenarioByKey(scenarioKey)).map(cloneDraft);
}

export function cryptoRandomIndex(upperExclusive: number): number {
  if (!Number.isSafeInteger(upperExclusive) || upperExclusive <= 0 || upperExclusive > 0x1_0000_0000) {
    throw new RangeError(`invalid random upper bound: ${upperExclusive}`);
  }
  const range = 0x1_0000_0000;
  const limit = range - (range % upperExclusive);
  const value = new Uint32Array(1);
  do globalThis.crypto.getRandomValues(value);
  while (value[0] >= limit);
  return value[0] % upperExclusive;
}

function buildSuggestionPool(scenario: PrototypeScenario): SuggestionDraft[] {
  if (scenario.mode === "demon") {
    return combinations(scenario.allowedCharacterIds ?? [], 3).map(demonDraft);
  }
  const relevantCharacters = characters.filter((character) => character.kind === scenario.characterKind);
  const actualOutsiderExists = scenario.players.some((candidate) => relevantCharacters.some((character) => character.id === candidate.actualCharacter));
  if (scenario.characterKind === "Outsider" && !actualOutsiderExists) {
    return [{ ...emptyDraft(), zeroOutsiders: true }];
  }
  const pairs = combinations(scenario.players, 2);
  return relevantCharacters.flatMap((character) =>
    pairs
      .filter((pair) => scenario.impaired || pair.some((candidate) => candidate.actualCharacter === character.id))
      .map((pair) => setupDraft(pair.map((candidate) => candidate.id), character.id)),
  );
}

function combinations<T>(values: T[], count: number): T[][] {
  if (count === 0) return [[]];
  return values.flatMap((value, index) =>
    combinations(values.slice(index + 1), count - 1).map((rest) => [value, ...rest]),
  );
}

function setupCharacterOptions(scenario: PrototypeScenario, draft: SuggestionDraft) {
  if (scenario.mode !== "setupInfo") return [];
  if (scenario.impaired) return characters.filter((character) => character.kind === scenario.characterKind);
  const represented = new Set(scenario.players.filter((candidate) => draft.playerIds.includes(candidate.id)).map((candidate) => candidate.actualCharacter));
  return characters.filter((character) => character.kind === scenario.characterKind && represented.has(character.id));
}

function draftReady(scenario: PrototypeScenario, draft: SuggestionDraft) {
  if (scenario.mode === "demon") return draft.characterIds.length <= 3;
  if (draft.zeroOutsiders) return scenario.characterKind === "Outsider";
  return draft.playerIds.length === 2 && draft.characterId.length > 0;
}

function updateUrl(scenario: ScenarioKey) {
  const url = new URL(window.location.href);
  url.searchParams.set("prototype", "first-night-suggestion");
  url.searchParams.set("scenario", scenario);
  url.searchParams.delete("variant");
  window.history.replaceState(null, "", url);
}

function urlScenario(): ScenarioKey {
  const value = new URLSearchParams(window.location.search).get("scenario");
  return scenarios.some((scenario) => scenario.key === value) ? (value as ScenarioKey) : "washerwoman";
}

function scenarioByKey(key: ScenarioKey) {
  return scenarios.find((scenario) => scenario.key === key) ?? scenarios[0];
}

function draftSignature(draft: SuggestionDraft) {
  return JSON.stringify({
    ...draft,
    playerIds: [...draft.playerIds].sort(),
    characterIds: [...draft.characterIds].sort(),
  });
}

function setupScenario(key: ScenarioKey, tabLabel: string, title: string, actorId: string, characterKind: CharacterKind): PrototypeScenario {
  return {
    key,
    tabLabel,
    title,
    description: `실제 ${characterKind === "Townsfolk" ? "마을주민" : characterKind === "Outsider" ? "외부인" : "하수인"} 한 명을 포함하는 서로 다른 후보 두 명과 그 캐릭터를 선택합니다.`,
    mode: "setupInfo",
    actorId,
    characterKind,
    players: prototypePlayers,
    initialDraft: emptyDraft(),
  };
}

function emptyDraft(): SuggestionDraft {
  return { playerIds: [], characterId: "", zeroOutsiders: false, characterIds: [] };
}

function setupDraft(playerIds: string[], characterId: string): SuggestionDraft {
  return { ...emptyDraft(), playerIds, characterId };
}

function demonDraft(characterIds: string[]): SuggestionDraft {
  return { ...emptyDraft(), characterIds };
}

function cloneDraft(draft: SuggestionDraft): SuggestionDraft {
  return { ...draft, playerIds: [...draft.playerIds], characterIds: [...draft.characterIds] };
}

function player(id: string, seat: number, name: string, actualCharacter: string, shownCharacter: string, alignment: Player["alignment"]): Player {
  return { id, seat, name, actualCharacter, shownCharacter, alignment, alive: true, ghostVoteUsed: false, deathAnnounced: false, notes: "" };
}

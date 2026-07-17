import { useMemo, useState } from "react";
import type { Player } from "./core/types";
import { Grimoire } from "./features/grimoire/Grimoire";
import { RevealScreen } from "./reveal";
import {
  characterKind,
  characterLabel,
  characters,
  createSetupDraftFromConfirmedPlayers,
  kindLabels,
  type Character,
  type CharacterKind,
} from "./setupDraft";

// PROTOTYPE issue #45: confirm the Drunk delivered-information
// interaction before changing the production phase-control flow.

type ScenarioKey =
  | "chefRecluse"
  | "fixedWasherwoman"
  | "poisonedLibrarian"
  | "drunkInvestigator"
  | "registrationInvestigator";
type SetupInfoCharacter = "chef" | "washerwoman" | "librarian" | "investigator";
type DeliveryMode = "fixed" | "impaired" | "registration";

type SetupInfoDraft = {
  playerIds: string[];
  characterId: string;
  zeroOutsiders: boolean;
};

type PrototypeScenario = {
  key: ScenarioKey;
  tabLabel: string;
  title: string;
  description: string;
  actorId: string;
  characterId: SetupInfoCharacter;
  characterKind: CharacterKind;
  deliveryMode: DeliveryMode;
  reasonLabel?: string;
  baseline: SetupInfoDraft;
  delivered: SetupInfoDraft;
  registrationPlayerId?: string;
};

const prototypePlayers: Player[] = [
  player("player-1", 1, "민지", "washerwoman", "washerwoman", "good"),
  player("player-2", 2, "준호", "chef", "chef", "good"),
  player("player-3", 3, "서연", "drunk", "investigator", "good"),
  player("player-4", 4, "도윤", "librarian", "librarian", "good"),
  player("player-5", 5, "하린", "saint", "saint", "good"),
  player("player-6", 6, "지우", "poisoner", "poisoner", "evil"),
  player("player-7", 7, "현우", "spy", "spy", "evil"),
  player("player-8", 8, "유나", "investigator", "investigator", "good"),
  player("player-9", 9, "태오", "imp", "imp", "evil"),
  player("player-10", 10, "가람", "recluse", "recluse", "good"),
];

const scenarios: PrototypeScenario[] = [
  {
    key: "chefRecluse",
    tabLabel: "등록 · 요리사",
    title: "은둔자와 악마가 이웃한 경우",
    description: "이웃 관계를 확인하고 요리사에게 전달할 0 또는 1을 바로 선택합니다.",
    actorId: "player-2",
    characterId: "chef",
    characterKind: "Townsfolk",
    deliveryMode: "registration",
    reasonLabel: "등록 판정",
    baseline: draft([], ""),
    delivered: draft(["player-1", "player-2"], "chef"),
  },
  {
    key: "fixedWasherwoman",
    tabLabel: "고정 · 세탁부",
    title: "정상 세탁부",
    description: "재량이 없으므로 유효한 설정 정보를 한 번만 선택하고 그대로 전달합니다.",
    actorId: "player-1",
    characterId: "washerwoman",
    characterKind: "Townsfolk",
    deliveryMode: "fixed",
    baseline: draft(["player-2", "player-7"], "chef"),
    delivered: draft(["player-2", "player-7"], "chef"),
  },
  {
    key: "poisonedLibrarian",
    tabLabel: "중독 · 사서",
    title: "중독된 사서",
    description: "실제 정보 입력 없이 아무 두 명과 외부인 하나, 또는 외부인 0명을 바로 선택합니다.",
    actorId: "player-4",
    characterId: "librarian",
    characterKind: "Outsider",
    deliveryMode: "impaired",
    reasonLabel: "중독",
    baseline: draft([], ""),
    delivered: draft([], "", true),
  },
  {
    key: "drunkInvestigator",
    tabLabel: "술꾼 · 조사관",
    title: "조사관이라고 생각하는 술꾼",
    description: "중독된 사서와 같은 방식으로, 아무 두 명과 하수인 하나를 한 번만 선택합니다.",
    actorId: "player-3",
    characterId: "investigator",
    characterKind: "Minion",
    deliveryMode: "impaired",
    reasonLabel: "술취함",
    baseline: draft([], ""),
    delivered: draft(["player-5", "player-10"], "scarletWoman"),
  },
  {
    key: "registrationInvestigator",
    tabLabel: "등록 · 조사관",
    title: "은둔자 등록 판정",
    description: "은둔자를 후보에 넣으면 전달 가능한 하수인 목록이 자동으로 늘어납니다.",
    actorId: "player-8",
    characterId: "investigator",
    characterKind: "Minion",
    deliveryMode: "registration",
    reasonLabel: "등록 판정",
    baseline: draft([], ""),
    delivered: draft(["player-5", "player-10"], "scarletWoman"),
    registrationPlayerId: "player-10",
  },
];

export function SetupInfoDiscretionPrototype() {
  const initialScenario = scenarioFromUrl();
  const [scenarioKey, setScenarioKey] = useState<ScenarioKey>(initialScenario.key);
  const [baseline, setBaseline] = useState<SetupInfoDraft>(cloneDraft(initialScenario.baseline));
  const [delivered, setDelivered] = useState<SetupInfoDraft>(cloneDraft(initialScenario.delivered));
  const [chefDeliveredValue, setChefDeliveredValue] = useState<0 | 1>(1);
  const [confirmedPreview, setConfirmedPreview] = useState(false);
  const [revealOpen, setRevealOpen] = useState(false);
  const scenario = scenarios.find((item) => item.key === scenarioKey) ?? scenarios[0];
  const actor = playerById(scenario.actorId);
  const baselineCharacters = representedCharacters(baseline.playerIds, scenario.characterKind);
  const deliveredCharacters =
    scenario.deliveryMode === "registration"
      ? registrationAdjustedCharacters(delivered.playerIds, scenario)
      : characters.filter((character) => character.kind === scenario.characterKind);
  const baselineValid = validBaseline(scenario, baseline);
  const deliveredValid = validDelivered(scenario, delivered);
  const confirmReady = scenario.deliveryMode === "fixed" ? baselineValid : deliveredValid;
  const deliveredResult = scenario.deliveryMode === "fixed" ? baseline : delivered;
  const grimoireDraft = useMemo(
    () =>
      createSetupDraftFromConfirmedPlayers(
        prototypePlayers.map((candidate) => ({
          seat: candidate.seat,
          name: candidate.name,
          actualCharacter: candidate.actualCharacter,
          shownCharacter: candidate.shownCharacter,
        })),
      ),
    [],
  );

  function selectScenario(nextKey: ScenarioKey) {
    const next = scenarios.find((item) => item.key === nextKey) ?? scenarios[0];
    setScenarioKey(next.key);
    setBaseline(cloneDraft(next.baseline));
    setDelivered(cloneDraft(next.delivered));
    setChefDeliveredValue(1);
    setConfirmedPreview(false);
    setRevealOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.set("scenario", next.key);
    window.history.replaceState(null, "", url);
  }

  function updateBaseline(next: SetupInfoDraft) {
    setBaseline(next);
    setConfirmedPreview(false);
  }

  function updateDelivered(next: SetupInfoDraft) {
    setDelivered(next);
    setConfirmedPreview(false);
  }

  if (revealOpen) {
    return (
      <RevealScreen
        payload={{
          messageKo:
            scenario.key === "chefRecluse"
              ? `요리사 정보: 서로 이웃한 악한 플레이어는 ${chefDeliveredValue}쌍입니다.`
              : resultMessage(scenario, deliveredResult),
        }}
        onClose={() => setRevealOpen(false)}
      />
    );
  }

  return (
    <main className="setupInfoDiscretionPrototype">
      <header className="discretionPrototypeHeader">
        <div>
          <p className="eyebrow">이슈 #45 프로토타입 · 이야기꾼 전용</p>
          <h1>정상 기준 정보와 전달 정보 분리</h1>
          <p>이 화면은 상호작용 확인용이며 이벤트를 저장하거나 게임 상태를 변경하지 않습니다.</p>
        </div>
        <span className="phaseBadge">첫 번째 밤</span>
      </header>

      <nav className="discretionScenarioTabs" aria-label="설정 정보 재량 시나리오">
        {scenarios.map((item) => (
          <button
            type="button"
            className={item.key === scenario.key ? "selected" : ""}
            aria-pressed={item.key === scenario.key}
            onClick={() => selectScenario(item.key)}
            key={item.key}
          >
            {item.tabLabel}
          </button>
        ))}
      </nav>

      <UtilityPanels />

      <section className="discretionScenarioSummary" aria-live="polite">
        <div>
          <strong>{scenario.title}</strong>
          <span>{scenario.description}</span>
        </div>
        <span className={`discretionReadiness ${scenario.key === "chefRecluse" || confirmReady ? "ready" : "incomplete"}`}>
          {scenario.key === "chefRecluse" || confirmReady ? "확정 가능" : "입력 확인 필요"}
        </span>
      </section>

      {scenario.key === "chefRecluse" ? (
        <ChefRegistrationPrototype
          actor={actor}
          grimoireDraft={grimoireDraft}
          deliveredValue={chefDeliveredValue}
          confirmed={confirmedPreview}
          onDeliveredValueChange={(value) => {
            setChefDeliveredValue(value);
            setConfirmedPreview(false);
          }}
          onConfirm={() => setConfirmedPreview(true)}
          onReveal={() => setRevealOpen(true)}
        />
      ) : (
      <div className="discretionPrototypeWorkspace">
        <section className="panel grimoire discretionPrototypeGrimoire">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">그리모어 · 실제 상태</p>
              <h2>Trouble Brewing</h2>
            </div>
            <span className="phaseBadge">10명</span>
          </div>
          <Grimoire players={prototypePlayers} draft={grimoireDraft} onDraftChange={() => undefined} busy={false} />
        </section>

        <aside className="panel discretionActionPanel">
          <ActorCard actor={actor} shownCharacterId={scenario.characterId} reasonLabel={scenario.reasonLabel} />

          <InfoEditor
            ariaLabel={scenario.deliveryMode === "fixed" ? "기준 설정 정보" : "전달 설정 정보"}
            title="플레이어에게 전달할 정보"
            description={singleEditorDescription(scenario)}
            scenario={scenario}
            draftValue={scenario.deliveryMode === "fixed" ? baseline : delivered}
            characterOptions={scenario.deliveryMode === "fixed" ? baselineCharacters : deliveredCharacters}
            showActualContext
            constrainToActual={scenario.deliveryMode === "fixed"}
            zeroAllowed={scenario.key === "poisonedLibrarian"}
            registrationPlayerId={scenario.deliveryMode === "registration" ? scenario.registrationPlayerId : undefined}
            onChange={scenario.deliveryMode === "fixed" ? updateBaseline : updateDelivered}
          />

          <div className="discretionPrototypeActions">
            <button type="button" className="secondaryButton" onClick={() => selectScenario(scenario.key)}>
              입력 초기화
            </button>
            <button
              type="button"
              className="primaryButton"
              disabled={!confirmReady}
              onClick={() => setConfirmedPreview(true)}
            >
              프로토타입 확정
            </button>
          </div>

          {confirmedPreview ? (
            <section className="discretionConfirmedPreview" aria-label="확정 정보 미리보기">
              <div>
                <span>플레이어에게 전달할 정보</span>
                <strong>{resultLabel(scenario, deliveredResult)}</strong>
              </div>
              {scenario.reasonLabel ? <small>전달 사유: {scenario.reasonLabel}</small> : null}
              <button type="button" className="secondaryButton" onClick={() => setRevealOpen(true)}>
                안전한 Reveal 미리보기
              </button>
            </section>
          ) : null}
        </aside>
      </div>
      )}
    </main>
  );
}

function UtilityPanels() {
  return (
    <section className="discretionUtilityPanels" aria-label="접을 수 있는 보조 패널">
      <details>
        <summary>
          <span>세팅 및 불러오기</span>
          <small>필요할 때 펼치기</small>
        </summary>
        <div>
          <button type="button" className="secondaryButton">게임 불러오기</button>
          <button type="button" className="secondaryButton">현재 게임 내보내기</button>
        </div>
      </details>
      <details>
        <summary>
          <span>이벤트 로그</span>
          <small>필요할 때 펼치기</small>
        </summary>
        <ol>
          <li>첫 번째 밤 시작</li>
          <li>독살자가 4번 도윤을 선택</li>
        </ol>
      </details>
    </section>
  );
}

function ChefRegistrationPrototype({
  actor,
  grimoireDraft,
  deliveredValue,
  confirmed,
  onDeliveredValueChange,
  onConfirm,
  onReveal,
}: {
  actor: Player;
  grimoireDraft: ReturnType<typeof createSetupDraftFromConfirmedPlayers>;
  deliveredValue: 0 | 1;
  confirmed: boolean;
  onDeliveredValueChange: (value: 0 | 1) => void;
  onConfirm: () => void;
  onReveal: () => void;
}) {
  const imp = playerById("player-9");
  const recluse = playerById("player-10");
  return (
    <div className="discretionPrototypeWorkspace">
      <section className="panel grimoire discretionPrototypeGrimoire">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">그리모어 · 실제 상태</p>
            <h2>Trouble Brewing</h2>
          </div>
          <span className="phaseBadge">10명</span>
        </div>
        <Grimoire players={prototypePlayers} draft={grimoireDraft} onDraftChange={() => undefined} busy={false} />
      </section>

      <aside className="panel discretionActionPanel">
        <ActorCard actor={actor} shownCharacterId="chef" reasonLabel="등록 판정" />

        <section className="chefNeighborPanel" aria-label="요리사 이웃 정보 선택">
          <div className="chefNeighborDiagram" aria-label="9번 태오와 10번 가람은 이웃">
            <PlayerPortrait player={imp} />
            <div className="neighborConnector">
              <span>이웃</span>
              <i aria-hidden="true" />
            </div>
            <PlayerPortrait player={recluse} />
          </div>

          <div className="chefResultChoices" aria-label="요리사에게 전달할 정보">
            <div>
              <button
                type="button"
                className={deliveredValue === 0 ? "selected truth" : "truth"}
                aria-pressed={deliveredValue === 0}
                onClick={() => onDeliveredValueChange(0)}
              >
                <span>진실</span>
                <strong>0</strong>
              </button>
              <button
                type="button"
                className={deliveredValue === 1 ? "selected alternate" : "alternate"}
                aria-pressed={deliveredValue === 1}
                onClick={() => onDeliveredValueChange(1)}
              >
                <span>거짓</span>
                <strong>1</strong>
              </button>
            </div>
          </div>
        </section>

        <div className="discretionPrototypeActions">
          <button type="button" className="secondaryButton" onClick={() => onDeliveredValueChange(1)}>
            입력 초기화
          </button>
          <button type="button" className="primaryButton" onClick={onConfirm}>
            프로토타입 확정
          </button>
        </div>

        {confirmed ? (
          <section className="discretionConfirmedPreview" aria-label="확정 정보 미리보기">
            <div>
              <span>플레이어에게 전달할 정보</span>
              <strong>서로 이웃한 악한 플레이어 {deliveredValue}쌍</strong>
            </div>
            <button type="button" className="secondaryButton" onClick={onReveal}>
              안전한 Reveal 미리보기
            </button>
          </section>
        ) : null}
      </aside>
    </div>
  );
}

function PlayerPortrait({ player: candidate }: { player: Player }) {
  const kind = characterKind(candidate.actualCharacter)?.toLowerCase() ?? "townsfolk";
  return (
    <div className={`chefPlayerPortrait character-kind-${kind}`}>
      <span>{characters.find((character) => character.id === candidate.actualCharacter)?.icon ?? candidate.seat}</span>
      <strong>{candidate.name}</strong>
      <small>{candidate.seat}번 · 실제 {characterLabel(candidate.actualCharacter)}</small>
    </div>
  );
}

function ActorCard({
  actor,
  shownCharacterId,
  reasonLabel,
}: {
  actor: Player;
  shownCharacterId: SetupInfoCharacter;
  reasonLabel?: string;
}) {
  const shownCharacter = characters.find((character) => character.id === shownCharacterId);
  const differs = actor.actualCharacter !== shownCharacterId;
  return (
    <article className="discretionActorCard">
      <span className={`discretionActorToken character-kind-${shownCharacter?.kind.toLowerCase() ?? "townsfolk"}`}>
        {shownCharacter?.icon ?? shownCharacterId.slice(0, 1).toUpperCase()}
      </span>
      <div>
        <p className="eyebrow">현재 행동</p>
        <h2>{characterLabel(shownCharacterId)}: {actor.seat}번 {actor.name}</h2>
        <div className="discretionActorBadges">
          {shownCharacter ? <span>{kindLabels[shownCharacter.kind]}</span> : null}
          {reasonLabel ? <span className="warning">{reasonLabel}</span> : <span>정상</span>}
          {differs ? <span className="warning">실제 {characterLabel(actor.actualCharacter)}</span> : null}
        </div>
        {shownCharacter ? <p>{shownCharacter.abilitySummary}</p> : null}
      </div>
    </article>
  );
}

function InfoEditor({
  ariaLabel,
  title,
  description,
  scenario,
  draftValue,
  characterOptions,
  showActualContext,
  constrainToActual,
  zeroAllowed,
  registrationPlayerId,
  onChange,
}: {
  ariaLabel: string;
  title: string;
  description: string;
  scenario: PrototypeScenario;
  draftValue: SetupInfoDraft;
  characterOptions: Character[];
  showActualContext: boolean;
  constrainToActual: boolean;
  zeroAllowed: boolean;
  registrationPlayerId?: string;
  onChange: (value: SetupInfoDraft) => void;
}) {
  function togglePlayer(playerId: string) {
    const nextPlayerIds = draftValue.playerIds.includes(playerId)
      ? draftValue.playerIds.filter((selectedId) => selectedId !== playerId)
      : draftValue.playerIds.length >= 2
        ? draftValue.playerIds
        : [...draftValue.playerIds, playerId];
    const nextOptions = constrainToActual
      ? representedCharacters(nextPlayerIds, scenario.characterKind)
      : scenario.deliveryMode === "registration"
        ? registrationAdjustedCharacters(nextPlayerIds, scenario)
        : characterOptions;
    const nextCharacterId = nextOptions.some((character) => character.id === draftValue.characterId)
      ? draftValue.characterId
      : nextOptions[0]?.id ?? "";
    onChange({ playerIds: nextPlayerIds, characterId: nextCharacterId, zeroOutsiders: false });
  }

  return (
    <section className="discretionInfoEditor" aria-label={ariaLabel}>
      <header>
        <div>
          <span>{title}</span>
          <small>{description}</small>
        </div>
        <strong>{draftValue.zeroOutsiders ? "0명" : `${draftValue.playerIds.length} / 2`}</strong>
      </header>

      {zeroAllowed ? (
        <div className="discretionZeroChoices" aria-label="전달할 외부인 수">
          <button
            type="button"
            className={!draftValue.zeroOutsiders ? "selected" : ""}
            aria-pressed={!draftValue.zeroOutsiders}
            onClick={() => onChange({ playerIds: [], characterId: "", zeroOutsiders: false })}
          >
            <span>2명 정보</span>
            <small>후보와 외부인을 선택</small>
          </button>
          <button
            type="button"
            className={draftValue.zeroOutsiders ? "selected alternate" : "alternate"}
            aria-pressed={draftValue.zeroOutsiders}
            onClick={() => onChange({ playerIds: [], characterId: "", zeroOutsiders: true })}
          >
            <span>0명 정보</span>
            <small>선택 가능한 거짓 정보</small>
          </button>
        </div>
      ) : null}

      {!draftValue.zeroOutsiders ? (
        <>
          <div className="discretionCandidateGrid" aria-label={`${title} 후보 선택`}>
            {prototypePlayers.map((candidate) => {
              const selected = draftValue.playerIds.includes(candidate.id);
              const requiredByRegistration = registrationPlayerId === candidate.id;
              return (
                <button
                  type="button"
                  className={`${selected ? "selected" : ""} ${requiredByRegistration ? "registrationCandidate" : ""} character-kind-${characterKind(candidate.actualCharacter)?.toLowerCase() ?? "townsfolk"}`}
                  aria-pressed={selected}
                  onClick={() => togglePlayer(candidate.id)}
                  key={candidate.id}
                >
                  <b>{candidate.seat}</b>
                  <span>
                    <strong>{candidate.name}</strong>
                    {showActualContext ? <small>실제: {characterLabel(candidate.actualCharacter)}</small> : null}
                    {showActualContext && candidate.actualCharacter !== candidate.shownCharacter ? (
                      <small>본인 인식: {characterLabel(candidate.shownCharacter)}</small>
                    ) : null}
                    {requiredByRegistration ? <small>등록 대상</small> : null}
                  </span>
                </button>
              );
            })}
          </div>

          <label className="discretionCharacterChoice">
            <span>{constrainToActual ? "성립하는 캐릭터" : "전달할 캐릭터"}</span>
            <select
              value={draftValue.characterId}
              disabled={characterOptions.length === 0}
              onChange={(event) => onChange({ ...draftValue, characterId: event.target.value })}
            >
              {characterOptions.length === 0 ? <option value="">선택 필요</option> : null}
              {characterOptions.map((character) => (
                <option value={character.id} key={character.id}>
                  {character.label}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : null}
    </section>
  );
}

function validBaseline(scenario: PrototypeScenario, value: SetupInfoDraft): boolean {
  if (value.zeroOutsiders) return false;
  if (value.playerIds.length !== 2 || !value.characterId) return false;
  return representedCharacters(value.playerIds, scenario.characterKind).some(
    (character) => character.id === value.characterId,
  );
}

function validDelivered(
  scenario: PrototypeScenario,
  value: SetupInfoDraft,
): boolean {
  if (scenario.deliveryMode === "fixed") return true;
  if (value.zeroOutsiders) return scenario.characterId === "librarian";
  if (value.playerIds.length !== 2 || !value.characterId) return false;
  if (characterKind(value.characterId) !== scenario.characterKind) return false;
  if (scenario.deliveryMode !== "registration") return true;
  return registrationAdjustedCharacters(value.playerIds, scenario).some(
    (character) => character.id === value.characterId,
  );
}

function representedCharacters(playerIds: string[], kind: CharacterKind): Character[] {
  const representedIds = new Set(
    prototypePlayers
      .filter((candidate) => playerIds.includes(candidate.id) && characterKind(candidate.actualCharacter) === kind)
      .map((candidate) => candidate.actualCharacter),
  );
  return characters.filter((character) => representedIds.has(character.id));
}

function registrationAdjustedCharacters(playerIds: string[], scenario: PrototypeScenario): Character[] {
  const represented = representedCharacters(playerIds, scenario.characterKind);
  if (!scenario.registrationPlayerId || !playerIds.includes(scenario.registrationPlayerId)) return represented;
  const ids = new Set([...represented.map((character) => character.id), ...characters
    .filter((character) => character.kind === scenario.characterKind)
    .map((character) => character.id)]);
  return characters.filter((character) => ids.has(character.id));
}

function resultLabel(scenario: PrototypeScenario, value: SetupInfoDraft): string {
  if (value.zeroOutsiders) return "외부인 0명";
  const names = value.playerIds.map((playerId) => {
    const candidate = playerById(playerId);
    return `${candidate.seat}번 ${candidate.name}`;
  });
  return `${names.join(" 또는 ")} · ${characterLabel(value.characterId)}`;
}

function resultMessage(scenario: PrototypeScenario, value: SetupInfoDraft): string {
  if (value.zeroOutsiders) return `${characterLabel(scenario.characterId)} 정보: 외부인은 0명입니다.`;
  return `${characterLabel(scenario.characterId)} 정보: ${resultLabel(scenario, value).replace(" · ", " 중 한 명은 ")}입니다.`;
}

function singleEditorDescription(scenario: PrototypeScenario): string {
  if (scenario.deliveryMode === "registration") {
    return "은둔자가 후보에 포함되면 전달 가능한 하수인 목록이 자동으로 늘어납니다.";
  }
  if (scenario.characterId === "librarian") {
    return "중독 상태이므로 아무 두 명과 외부인 하나, 또는 외부인 0명을 선택할 수 있습니다.";
  }
  if (scenario.deliveryMode === "impaired") {
    return `술취한 상태이므로 아무 두 명과 ${kindLabels[scenario.characterKind]} 하나를 선택할 수 있습니다.`;
  }
  return "실제 상태에서 성립하는 후보와 캐릭터만 선택할 수 있습니다.";
}

function scenarioFromUrl(): PrototypeScenario {
  const key = new URLSearchParams(window.location.search).get("scenario");
  return scenarios.find((scenario) => scenario.key === key) ?? scenarios[0];
}

function playerById(playerId: string): Player {
  return prototypePlayers.find((candidate) => candidate.id === playerId) ?? prototypePlayers[0];
}

function draft(playerIds: string[], characterId: string, zeroOutsiders = false): SetupInfoDraft {
  return { playerIds, characterId, zeroOutsiders };
}

function cloneDraft(value: SetupInfoDraft): SetupInfoDraft {
  return { ...value, playerIds: [...value.playerIds] };
}

function player(
  id: string,
  seat: number,
  name: string,
  actualCharacter: string,
  shownCharacter: string,
  alignment: Player["alignment"],
): Player {
  return {
    id,
    seat,
    name,
    actualCharacter,
    shownCharacter,
    alignment,
    alive: true,
    ghostVoteUsed: false,
    deathAnnounced: false,
    systemTokenIds: [],
    scriptTokens: [],
    notes: "",
  };
}

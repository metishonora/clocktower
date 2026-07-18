import { useMemo, useState } from "react";
import type { Player } from "./core/types";
import { Grimoire } from "./features/grimoire/Grimoire";
import { RevealScreen } from "./reveal";
import {
  characterKind,
  characterLabel,
  characters,
  createSetupDraftFromConfirmedPlayers,
  type CharacterKind,
} from "./setupDraft";

// PROTOTYPE issue #30: compare Storyteller-only character context placement
// before changing the production setup-information input.

type PrototypeVariant = "A" | "B" | "C";
type SetupInfoCharacter = "washerwoman" | "librarian" | "investigator";

const variants: Array<{
  id: PrototypeVariant;
  name: string;
  description: string;
}> = [
  {
    id: "A",
    name: "모든 후보에 표시",
    description: "선택 전에 모든 플레이어의 실제 캐릭터를 바로 확인합니다.",
  },
  {
    id: "B",
    name: "선택 카드만 확장",
    description: "선택한 후보 카드 안에서만 실제 캐릭터 맥락을 펼칩니다.",
  },
  {
    id: "C",
    name: "별도 비교 영역",
    description: "후보 버튼은 간결하게 두고 선택한 두 명을 아래에서 비교합니다.",
  },
];

const setupInfoCharacters: Array<{
  id: SetupInfoCharacter;
  label: string;
  kind: CharacterKind;
}> = [
  { id: "washerwoman", label: "세탁부", kind: "Townsfolk" },
  { id: "librarian", label: "사서", kind: "Outsider" },
  { id: "investigator", label: "조사관", kind: "Minion" },
];

const prototypePlayers: Player[] = [
  player("player-1", 1, "민지", "washerwoman", "washerwoman", "good"),
  player("player-2", 2, "준호", "chef", "chef", "good"),
  player("player-3", 3, "서연", "drunk", "monk", "good"),
  player("player-4", 4, "도윤", "librarian", "librarian", "good"),
  player("player-5", 5, "하린", "saint", "saint", "good"),
  player("player-6", 6, "지우", "poisoner", "poisoner", "evil"),
  player("player-7", 7, "현우", "imp", "imp", "evil"),
  player("player-8", 8, "유나", "investigator", "investigator", "good"),
  player("player-9", 9, "태오", "spy", "spy", "evil"),
];

const defaultCandidates: Record<SetupInfoCharacter, string[]> = {
  washerwoman: ["player-2", "player-7"],
  librarian: ["player-3", "player-5"],
  investigator: ["player-2", "player-6"],
};

export function SetupInfoContextPrototype() {
  const [variant, setVariant] = useState<PrototypeVariant>(() => urlVariant());
  const [setupInfoCharacter, setSetupInfoCharacter] = useState<SetupInfoCharacter>("librarian");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>(defaultCandidates.librarian);
  const [selectedCharacterId, setSelectedCharacterId] = useState("drunk");
  const [revealOpen, setRevealOpen] = useState(false);
  const scenario = setupInfoCharacters.find((item) => item.id === setupInfoCharacter) ?? setupInfoCharacters[0];
  const selectedPlayers = selectedPlayerIds.flatMap((playerId) => {
    const selected = prototypePlayers.find((candidate) => candidate.id === playerId);
    return selected ? [selected] : [];
  });
  const validCharacters = useMemo(
    () => representedCharacters(selectedPlayerIds, scenario.kind),
    [scenario.kind, selectedPlayerIds],
  );
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

  function selectVariant(nextVariant: PrototypeVariant) {
    setVariant(nextVariant);
    const url = new URL(window.location.href);
    url.searchParams.set("variant", nextVariant);
    window.history.replaceState(null, "", url);
  }

  function selectSetupInfoCharacter(nextCharacter: SetupInfoCharacter) {
    const nextScenario = setupInfoCharacters.find((item) => item.id === nextCharacter) ?? setupInfoCharacters[0];
    const nextPlayerIds = defaultCandidates[nextCharacter];
    const nextCharacters = representedCharacters(nextPlayerIds, nextScenario.kind);
    setSetupInfoCharacter(nextCharacter);
    setSelectedPlayerIds(nextPlayerIds);
    setSelectedCharacterId(nextCharacters[0]?.id ?? "");
  }

  function togglePlayer(playerId: string) {
    const nextPlayerIds = selectedPlayerIds.includes(playerId)
      ? selectedPlayerIds.filter((selectedId) => selectedId !== playerId)
      : selectedPlayerIds.length >= 2
        ? selectedPlayerIds
        : [...selectedPlayerIds, playerId];
    const nextCharacters = representedCharacters(nextPlayerIds, scenario.kind);
    setSelectedPlayerIds(nextPlayerIds);
    setSelectedCharacterId((current) =>
      nextCharacters.some((character) => character.id === current) ? current : nextCharacters[0]?.id ?? "",
    );
  }

  if (revealOpen) {
    const candidateLabels = selectedPlayers.map((candidate) => `${candidate.seat}번 ${candidate.name}`);
    return (
      <RevealScreen
        payload={{
          messageKo: `${scenario.label} 정보: ${candidateLabels.join(" 또는 ")} 중 한 명은 ${characterLabel(selectedCharacterId)}입니다.`,
        }}
        onClose={() => setRevealOpen(false)}
      />
    );
  }

  return (
    <main className="setupInfoContextPrototype">
      <header className="contextPrototypeHeader">
        <div>
          <p className="eyebrow">이슈 #30 프로토타입</p>
          <h1>후보 캐릭터 맥락 표시</h1>
          <p>이 화면은 이야기꾼 전용입니다. 플레이어 Reveal에는 실제 캐릭터와 Grimoire가 전달되지 않습니다.</p>
        </div>
        <div className="contextVariantTabs" aria-label="프로토타입 표시 방식">
          {variants.map((item) => (
            <button
              type="button"
              className={item.id === variant ? "selected" : ""}
              aria-pressed={item.id === variant}
              onClick={() => selectVariant(item.id)}
              key={item.id}
            >
              <span>{item.id}</span>
              <strong>{item.name}</strong>
            </button>
          ))}
        </div>
      </header>

      <section className="contextPrototypeDecision" aria-live="polite">
        <strong>{variants.find((item) => item.id === variant)?.name}</strong>
        <span>{variants.find((item) => item.id === variant)?.description}</span>
      </section>

      <div className="contextPrototypeWorkspace">
        <section className="panel grimoire contextPrototypeGrimoire">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">그리모어 · 이야기꾼 전용</p>
              <h2>Trouble Brewing</h2>
            </div>
            <span className="phaseBadge">첫 번째 밤</span>
          </div>
          <Grimoire
            players={prototypePlayers}
            draft={grimoireDraft}
            busy={false}
          />
        </section>

        <aside className="panel contextPrototypeAction" data-variant={variant}>
          <div className="sectionHeader compact">
            <div>
              <p className="eyebrow">첫 번째 밤 · 설정 정보</p>
              <h2>{scenario.label}: 후보 2명 선택</h2>
            </div>
            <span className="phaseBadge">{selectedPlayerIds.length} / 2</span>
          </div>

          <div className="contextScenarioTabs" aria-label="설정 정보 캐릭터">
            {setupInfoCharacters.map((item) => (
              <button
                type="button"
                className={item.id === setupInfoCharacter ? "selected" : ""}
                aria-pressed={item.id === setupInfoCharacter}
                onClick={() => selectSetupInfoCharacter(item.id)}
                key={item.id}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="contextCandidateGrid" aria-label="설정 정보 후보 선택">
            {prototypePlayers.map((candidate) => {
              const selected = selectedPlayerIds.includes(candidate.id);
              return (
                <button
                  type="button"
                  className={selected ? "selected" : ""}
                  aria-pressed={selected}
                  onClick={() => togglePlayer(candidate.id)}
                  key={candidate.id}
                >
                  <span className="contextCandidateIdentity">
                    <b>{candidate.seat}</b>
                    <strong>{candidate.name}</strong>
                  </span>
                  {variant === "A" || (variant === "B" && selected) ? (
                    <CharacterContext player={candidate} compact={variant === "A"} />
                  ) : null}
                </button>
              );
            })}
          </div>

          {variant === "C" ? <SelectedCandidateComparison players={selectedPlayers} /> : null}

          <label className="contextCharacterChoice">
            <span>보여줄 캐릭터</span>
            <select
              value={selectedCharacterId}
              disabled={validCharacters.length === 0}
              onChange={(event) => setSelectedCharacterId(event.target.value)}
            >
              {validCharacters.length === 0 ? <option value="">유효한 캐릭터 없음</option> : null}
              {validCharacters.map((character) => (
                <option value={character.id} key={character.id}>
                  {character.label}
                </option>
              ))}
            </select>
            <small>선택된 후보의 실제 캐릭터 중 {kindLabel(scenario.kind)}만 표시합니다.</small>
          </label>

          <div className="contextPrototypeActions">
            <button
              type="button"
              className="secondaryButton"
              disabled={selectedPlayerIds.length !== 2 || !selectedCharacterId}
              onClick={() => setRevealOpen(true)}
            >
              안전한 Reveal 확인
            </button>
            <button type="button" className="primaryButton" disabled>
              프로토타입에서는 확정하지 않음
            </button>
          </div>

          <p className="contextRegistrationNote">
            Spy/Recluse 등록은 후보의 실제 캐릭터와 별개인 체크별 이야기꾼 판정이므로 이 프로토타입 선택지에는 포함하지 않았습니다.
          </p>
        </aside>
      </div>
    </main>
  );
}

function CharacterContext({ player, compact = false }: { player: Player; compact?: boolean }) {
  const differs = player.actualCharacter !== player.shownCharacter;
  return (
    <span className={`contextCharacterMeta ${differs ? "drunk" : ""} ${compact ? "compact" : ""}`}>
      <small>실제: {characterLabel(player.actualCharacter)}</small>
      {differs ? <small>본인 인식: {characterLabel(player.shownCharacter)}</small> : null}
    </span>
  );
}

function SelectedCandidateComparison({ players }: { players: Player[] }) {
  return (
    <section className="contextCandidateComparison" aria-label="선택한 후보 비교">
      <div>
        <span>선택한 후보</span>
        <strong>{players.length} / 2</strong>
      </div>
      <section>
        {players.length === 0 ? <p>비교할 후보를 선택하세요.</p> : null}
        {players.map((candidate) => (
          <article key={candidate.id}>
            <b>{candidate.seat}</b>
            <div>
              <strong>{candidate.name}</strong>
              <CharacterContext player={candidate} />
            </div>
          </article>
        ))}
      </section>
    </section>
  );
}

function representedCharacters(playerIds: string[], kind: CharacterKind) {
  const representedIds = new Set(
    prototypePlayers
      .filter((candidate) => playerIds.includes(candidate.id) && characterKind(candidate.actualCharacter) === kind)
      .map((candidate) => candidate.actualCharacter),
  );
  return characters.filter((character) => representedIds.has(character.id));
}

function kindLabel(kind: CharacterKind): string {
  if (kind === "Townsfolk") return "마을주민";
  if (kind === "Outsider") return "외부인";
  if (kind === "Minion") return "하수인";
  return "악마";
}

function urlVariant(): PrototypeVariant {
  const variant = new URLSearchParams(window.location.search).get("variant");
  return variant === "A" || variant === "B" || variant === "C" ? variant : "C";
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

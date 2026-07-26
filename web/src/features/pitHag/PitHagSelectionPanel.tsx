import type { Player } from "../../core/types";
import { sectsAndVioletsCharacterAsset } from "../../sectsAndVioletsCharacterAssets";
import {
  sectsAndVioletsCharacters,
  type SectsAndVioletsCharacterKind,
} from "../../sectsAndVioletsCharacters";
import "./pitHagSelectionPanel.css";

const kindOrder: SectsAndVioletsCharacterKind[] = ["townsfolk", "outsider", "minion", "demon"];
const kindLabels: Record<SectsAndVioletsCharacterKind, string> = {
  townsfolk: "주민",
  outsider: "외지인",
  minion: "하수인",
  demon: "악마",
};

export function PitHagSelectionPanel({
  players,
  targetPlayerId,
  characterId,
  allowedCharacterIds,
  operationBusy = false,
  onCharacterChange,
  onConfirm,
}: {
  players: Player[];
  targetPlayerId?: string;
  characterId?: string;
  allowedCharacterIds: string[];
  operationBusy?: boolean;
  onCharacterChange: (characterId: string) => void;
  onConfirm: () => void;
}) {
  const target = players.find((player) => player.id === targetPlayerId);
  const selected = sectsAndVioletsCharacters.find((character) => character.id === characterId);
  const asset = sectsAndVioletsCharacterAsset(selected?.id);
  const inPlay = selected ? players.some((player) => player.actualCharacter === selected.id) : false;
  const ready = Boolean(target && selected);
  const alignmentLabel = target?.alignment === "evil" ? "악" : "선";

  return (
    <aside className="issue116SelectionPanel pitHagTaskPanel" aria-label="마귀할멈 선택">
      <header className="issue116SelectionHeader"><h2>마귀할멈 선택</h2></header>
      <ol className="pitHagTaskSteps">
        <li className={target ? "complete" : "current"}>
          <span>1</span><div><small>대상</small><strong>{target ? `${target.seat}번 ${target.name}${target.alive ? "" : " · 사망"}` : "-"}</strong></div>
        </li>
        <li className={selected ? "complete" : target ? "current" : ""}>
          <span>2</span><div><small>새 캐릭터</small><strong>{selected?.name ?? "-"}</strong></div>
        </li>
      </ol>
      <label className="pitHagCharacterPicker">
        <span>바꿀 캐릭터</span>
        <select
          aria-label="바꿀 캐릭터"
          value={characterId ?? ""}
          disabled={operationBusy}
          onChange={(event) => onCharacterChange(event.currentTarget.value)}
        >
          <option value="" disabled>캐릭터를 선택하세요</option>
          {kindOrder.map((kind) => (
            <optgroup label={kindLabels[kind]} key={kind}>
              {sectsAndVioletsCharacters
                .filter((character) => character.kind === kind && allowedCharacterIds.includes(character.id))
                .map((character) => (
                  <option value={character.id} key={character.id}>
                    {character.name}{players.some((player) => player.actualCharacter === character.id) ? " · 게임 중" : ""}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      {selected ? (
        <section
          className={`pitHagCharacterResult${inPlay ? " blocked" : selected.kind === "demon" ? " demon" : ""}`}
          aria-label={`선택한 직업 ${selected.name} · ${target ? alignmentLabel : "미선택"} 진영`}
          aria-live="polite"
        >
          {asset ? <img src={asset.src} alt="" /> : null}
          <strong>{selected.name}</strong>
          <span
            className={`pitHagAlignmentIcon ${target?.alignment ?? "unknown"}`}
            aria-label={target ? `${alignmentLabel} 진영` : "진영 미선택"}
          >
            {target ? alignmentLabel : "—"}
          </span>
        </section>
      ) : (
        <section className="pitHagCharacterPlaceholder" aria-live="polite">
          <span aria-hidden="true">?</span><strong>캐릭터를 선택하세요</strong>
        </section>
      )}
      <button
        type="button"
        className="issue116PrimaryAction"
        disabled={!ready || operationBusy}
        onClick={onConfirm}
      >
        {inPlay ? "변화 없음 확정" : "변신 확정"}
      </button>
    </aside>
  );
}

export type PitHagDemonIntent = {
  actorLabel: string;
  targetLabel: string;
};

export function PitHagArbitraryDeathsPanel({
  players,
  selectedPlayerIds,
  demonIntents,
  operationBusy = false,
  onConfirm,
}: {
  players: Player[];
  selectedPlayerIds: string[];
  demonIntents: PitHagDemonIntent[];
  operationBusy?: boolean;
  onConfirm: () => void;
}) {
  const selectedPlayers = selectedPlayerIds
    .map((id) => players.find((player) => player.id === id))
    .filter((player): player is Player => Boolean(player));
  return (
    <aside className="issue116SelectionPanel pitHagTaskPanel pitHagDeathPanel" aria-label="임의 사망 결과">
      <header className="issue116SelectionHeader"><h2>그 밤의 사망 결과</h2></header>
      {demonIntents.length > 0 ? (
        <section className="pitHagDemonIntents" aria-label="악마가 선택한 대상">
          <span>악마 선택 기록</span>
          {demonIntents.map((intent, index) => (
            <p key={`${intent.actorLabel}-${index}`}><b>{intent.actorLabel}</b><i>→</i>{intent.targetLabel}</p>
          ))}
        </section>
      ) : null}
      <div className="pitHagDeathCount"><span>임의 사망</span><strong>{selectedPlayers.length}명</strong></div>
      <ul className="pitHagDeathList">
        {selectedPlayers.length === 0
          ? <li className="empty">사망자 없음</li>
          : selectedPlayers.map((player) => <li key={player.id}>{player.seat}번 {player.name}</li>)}
      </ul>
      <p className="pitHagCauseNote">선택한 사망은 모두 마귀할멈 원인으로 기록됩니다.</p>
      <button type="button" className="issue116PrimaryAction" disabled={operationBusy} onClick={onConfirm}>
        {selectedPlayers.length === 0 ? "사망자 없음 확정" : `사망 ${selectedPlayers.length}명 확정`}
      </button>
    </aside>
  );
}

import { useEffect, useState } from "react";
import { CharacterIcon } from "../../components/CharacterIcon";
import { CharacterDetailButton } from "../../components/CharacterRulesCard";
import { troubleBrewingCharacterDetail } from "../../characterDetails";
import type { ActiveImpairment, Player, UseSlayerAbilityPayload } from "../../core/types";
import { characters } from "../../setupDraft";
import { PlayerImpairmentBadges, visibleImpairmentsForPlayer } from "../phase-control/ImpairmentBadges";
import "../day-actions/dayActionDock.css";

export function SlayerAbilityAction({ actor, players, activeImpairments, busy, onConfirm }: {
  actor: Player;
  players: Player[];
  activeImpairments?: readonly ActiveImpairment[];
  busy: boolean;
  onConfirm: (
    targetPlayerId: string,
    registration: UseSlayerAbilityPayload["targetRegistration"],
  ) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [targetId, setTargetId] = useState<string>();
  const [recluseDecision, setRecluseDecision] = useState<"canonical" | "demon">();
  const target = players.find((player) => player.id === targetId);
  const targetImpaired = visibleImpairmentsForPlayer(activeImpairments, target?.id).length > 0;
  const needsRecluseDecision = target?.actualCharacter === "recluse" && !targetImpaired;
  const ready = Boolean(target && (!needsRecluseDecision || recluseDecision));
  const actorImpairment = visibleImpairmentsForPlayer(activeImpairments, actor.id)[0];
  const abilitySummary = characters.find((character) => character.id === "slayer")?.abilitySummary;

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, []);

  function toggle() {
    setOpen((current) => !current);
    setTargetId(undefined);
    setRecluseDecision(undefined);
  }

  return (
    <>
      <div className={`snvDayActionScrollClearance${open ? " open" : ""}`} aria-hidden="true" />
      {open ? (
        <section className="snvDayActionPanel snvDayActionPanel--slayer tbSlayerActionPanel" role="dialog" aria-label="처단자 능력 사용">
          <header className="snvDayActionHeader">
            <CharacterDetailButton
              details={troubleBrewingCharacterDetail("slayer")}
              className="snvDayActionIdentity"
              theme="tb-day"
            >
              <CharacterIcon characterId="slayer" />
              <div>
                <span>낮 · {actor.seat}번 {actor.name}</span>
                <span className="snvDayActionRoleLine">
                  <h2>처단자</h2>
                  <PlayerImpairmentBadges
                    activeImpairments={activeImpairments}
                    playerId={actor.id}
                    label="능력 영향"
                  />
                </span>
              </div>
            </CharacterDetailButton>
            {abilitySummary ? <p>{abilitySummary}</p> : null}
          </header>

          <div className="snvDayActionForm tbSlayerActionForm">
            <fieldset className="tbSlayerTargets">
              <legend>대상</legend>
              <div>
                {players.map((player) => (
                  <button
                    type="button"
                    key={player.id}
                    className={player.id === targetId ? "selected" : ""}
                    aria-label={`${player.seat}번 ${player.name}${player.alive ? "" : " · 사망"}`}
                    aria-pressed={player.id === targetId}
                    onClick={() => {
                      setTargetId(player.id);
                      setRecluseDecision(undefined);
                    }}
                  >
                    <span>{player.seat}</span>
                    <strong>{player.name}</strong>
                    {player.alive ? null : <small>사망</small>}
                  </button>
                ))}
              </div>
            </fieldset>

            {needsRecluseDecision ? (
              <fieldset className="tbSlayerRegistration">
                <legend>이번 판정의 은둔자 취급</legend>
                <div>
                  <button type="button" className={recluseDecision === "canonical" ? "selected" : ""} aria-pressed={recluseDecision === "canonical"} onClick={() => setRecluseDecision("canonical")}>악마로 취급하지 않음</button>
                  <button type="button" className={recluseDecision === "demon" ? "selected" : ""} aria-pressed={recluseDecision === "demon"} onClick={() => setRecluseDecision("demon")}>악마로 취급</button>
                </div>
              </fieldset>
            ) : null}

            <button
              type="button"
              className={`snvDayActionConfirm ${actorImpairment ?? "normal"}`}
              disabled={!ready || busy}
              onClick={() => {
                if (!target) return;
                setOpen(false);
                void onConfirm(
                  target.id,
                  recluseDecision === "demon"
                    ? { kind: "recluseAsDemon", registeredCharacterId: "imp" }
                    : { kind: "canonical" },
                );
              }}
            >
              {actorImpairment === "poisoned" ? "중독 처단자 능력 사용" : "처단자 능력 사용"}
            </button>
          </div>
        </section>
      ) : null}

      <div className="snvDayActionDock tbSlayerActionDock" aria-label="사용 가능한 낮 자유 행동">
        <button
          type="button"
          className={open ? "selected" : ""}
          aria-label={open ? "처단자 행동 창 닫기" : `처단자 행동 열기, ${actor.seat}번 ${actor.name}`}
          aria-expanded={open}
          disabled={busy}
          onClick={toggle}
        >
          {open ? <span aria-hidden="true">×</span> : <CharacterIcon characterId="slayer" />}
        </button>
      </div>
    </>
  );
}

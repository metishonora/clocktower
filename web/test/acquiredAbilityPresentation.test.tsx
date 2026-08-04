import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import type { PhaseStep, Player } from "../src/core/types";
import { sectsAndVioletsCharacters } from "../src/sectsAndVioletsCharacters";
import {
  acquiredAbilityCharacterForStep,
  AcquiredAbilityPresentation,
  isAcquiredAbility,
} from "../src/features/phase-control/acquiredAbilityPresentation";

const actor: Player = {
  id: "player-1",
  seat: 1,
  name: "도윤",
  actualCharacter: "philosopher",
  shownCharacter: "philosopher",
  alignment: "good",
  alive: true,
  ghostVoteUsed: false,
  deathAnnounced: false,
  systemTokenIds: [],
  scriptTokens: [],
  notes: "",
};

const goodCharacterIds = sectsAndVioletsCharacters
  .filter((character) => character.kind === "townsfolk" || character.kind === "outsider")
  .map((character) => character.id);

test("acquired identity presentation is data-driven for every non-self good Philosopher grant", () => {
  const nonSelfGoodCharacters = goodCharacterIds.filter((characterId) => characterId !== actor.actualCharacter);
  expect(nonSelfGoodCharacters).toHaveLength(16);

  for (const characterId of nonSelfGoodCharacters) {
    const step: PhaseStep = {
      id: `night:ability:${characterId}`,
      phase: "night",
      stepType: "character",
      character: characterId,
      playerId: actor.id,
      abilityUse: {
        ownerPlayerId: actor.id,
        characterId,
        abilityInstanceId: `grant-${characterId}`,
      },
      requiredInput: { kind: "none", optional: false },
      canSkip: false,
    };
    const acquiredCharacter = sectsAndVioletsCharacters.find((candidate) => candidate.id === characterId)!;
    const html = renderToStaticMarkup(
      <AcquiredAbilityPresentation
        actor={actor}
        abilityCharacterId={acquiredAbilityCharacterForStep(step, actor)!}
      />,
    );

    expect(acquiredAbilityCharacterForStep(step, actor)).toBe(characterId);
    expect(html).toContain("철학자");
    expect(html).toContain("도윤");
    expect(html).toContain("획득한 능력");
    expect(html).toContain(acquiredCharacter.name);
    expect(html).toContain(acquiredCharacter.ability.replaceAll('"', "&quot;"));
  }
});

test("self-selection is not presented as an acquired ability", () => {
  expect(isAcquiredAbility("philosopher", "philosopher")).toBe(false);
  const selfStep: PhaseStep = {
    id: "firstNight:philosopher",
    phase: "firstNight",
    stepType: "character",
    character: "philosopher",
    playerId: actor.id,
    abilityUse: {
      ownerPlayerId: actor.id,
      characterId: "philosopher",
      abilityInstanceId: "self-selection",
    },
    requiredInput: { kind: "none", optional: false },
    canSkip: false,
  };
  expect(acquiredAbilityCharacterForStep(selfStep, actor)).toBeUndefined();
  expect(renderToStaticMarkup(
    <AcquiredAbilityPresentation actor={actor} abilityCharacterId="philosopher" />,
  )).toBe("");
});

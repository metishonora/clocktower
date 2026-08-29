import { badMoonRisingCharacters, type BadMoonRisingCharacterKind } from "./badMoonRisingCharacters.js";
import { BAD_MOON_RISING } from "./core/scripts.js";
import type {
  GameFile,
  Player,
  SetupChoiceId,
  SetupDistribution,
  SetupDistributionOption,
} from "./core/types.js";
import type { WebSessionSnapshot } from "./webSessionStorage.js";

export type BmrTab = "roles" | "seating" | "play" | "storage";

export type BmrSetupState = {
  playerCount: number;
  selectedIds: string[];
  setupChoiceId?: SetupChoiceId;
  rosterConfirmed: boolean;
  seatingConfirmed: boolean;
  seatAssignments: Record<number, string>;
  seatNames: Record<number, string>;
  shownCharacters: Record<number, string>;
};

export type BmrPresentation = {
  activeTab?: BmrTab;
};

export type BmrWebSessionSnapshot = WebSessionSnapshot<BmrSetupState | null, BmrPresentation>;

export const BMR_KIND_ORDER: BadMoonRisingCharacterKind[] = [
  "townsfolk",
  "outsider",
  "minion",
  "demon",
];

export const BMR_KIND_LABELS: Record<BadMoonRisingCharacterKind, string> = {
  townsfolk: "주민",
  outsider: "외지인",
  minion: "하수인",
  demon: "악마",
};

export function createBmrSetupDraft(): BmrSetupState {
  return {
    playerCount: 7,
    selectedIds: ["pukka"],
    rosterConfirmed: false,
    seatingConfirmed: false,
    seatAssignments: {},
    seatNames: {},
    shownCharacters: {},
  };
}

export function createBmrGameFile(now = new Date()): GameFile {
  const timestamp = now.toISOString();
  return {
    schemaVersion: 3,
    game: {
      scriptId: BAD_MOON_RISING,
      id: "local-bmr-game",
      name: "Bad Moon Rising",
      createdAt: timestamp,
      updatedAt: timestamp,
      events: [],
    },
  };
}

export function createBmrWebSessionSnapshot(
  canonical: GameFile,
  setupDraft: BmrSetupState | null,
  presentation: BmrPresentation,
  savedAt = new Date().toISOString(),
): BmrWebSessionSnapshot {
  return {
    version: 1,
    scriptId: BAD_MOON_RISING,
    savedAt,
    canonical,
    setupDraft,
    presentation,
  };
}

export function restoreBmrSetupDraft(
  stored: BmrSetupState | null,
  players: Player[],
  setupChoiceId?: SetupChoiceId,
): BmrSetupState {
  if (players.length === 0) return stored ?? createBmrSetupDraft();
  const seatAssignments = Object.fromEntries(players.map((player) => [player.seat, player.actualCharacter]));
  const seatNames = Object.fromEntries(players.map((player) => [player.seat, player.name]));
  const shownCharacters = Object.fromEntries(players.flatMap((player) =>
    player.actualCharacter === "lunatic" && player.shownCharacter !== player.actualCharacter
      ? [[player.seat, player.shownCharacter]]
      : [],
  ));
  return {
    playerCount: players.length,
    selectedIds: players.map((player) => player.actualCharacter),
    setupChoiceId,
    rosterConfirmed: true,
    seatingConfirmed: true,
    seatAssignments,
    seatNames,
    shownCharacters,
  };
}

export function countBmrKinds(characterIds: string[]): Record<BadMoonRisingCharacterKind, number> {
  const counts = { townsfolk: 0, outsider: 0, minion: 0, demon: 0 };
  for (const id of characterIds) {
    const character = badMoonRisingCharacters.find((candidate) => candidate.id === id);
    if (character) counts[character.kind] += 1;
  }
  return counts;
}

export function distributionByKind(distribution: SetupDistribution) {
  return {
    townsfolk: distribution.Townsfolk,
    outsider: distribution.Outsider,
    minion: distribution.Minion,
    demon: distribution.Demon,
  } satisfies Record<BadMoonRisingCharacterKind, number>;
}

export function selectedSetupDistribution(
  value: SetupDistribution | { options: SetupDistributionOption[] } | undefined,
  setupChoiceId?: SetupChoiceId,
): SetupDistribution | undefined {
  if (!value) return undefined;
  if (!("options" in value)) return value;
  return value.options.find((option) => option.id === setupChoiceId)?.distribution
    ?? value.options[0]?.distribution;
}

export function bmrCharacter(characterId: string | undefined) {
  return badMoonRisingCharacters.find((candidate) => candidate.id === characterId);
}

export function defaultBmrAlignment(characterId: string): "good" | "evil" {
  const kind = bmrCharacter(characterId)?.kind;
  return kind === "minion" || kind === "demon" ? "evil" : "good";
}

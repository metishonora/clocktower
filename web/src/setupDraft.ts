export type CharacterKind = "Townsfolk" | "Outsider" | "Minion" | "Demon";

export type Character = {
  id: string;
  label: string;
  kind: CharacterKind;
};

export type DraftPlayer = {
  seat: number;
  name: string;
  actualCharacter?: string;
  shownCharacter?: string;
};

export type SetupDraft = {
  players: DraftPlayer[];
  selectedSeat: number;
};

export type CreateGamePlayerInput = {
  seat: number;
  name: string;
  actualCharacter: string;
  shownCharacter?: string;
};

export const characters: Character[] = [
  { id: "washerwoman", label: "세탁부", kind: "Townsfolk" },
  { id: "librarian", label: "사서", kind: "Townsfolk" },
  { id: "investigator", label: "조사관", kind: "Townsfolk" },
  { id: "chef", label: "요리사", kind: "Townsfolk" },
  { id: "empath", label: "공감능력자", kind: "Townsfolk" },
  { id: "fortuneTeller", label: "점쟁이", kind: "Townsfolk" },
  { id: "undertaker", label: "장의사", kind: "Townsfolk" },
  { id: "monk", label: "수도사", kind: "Townsfolk" },
  { id: "ravenkeeper", label: "까마귀지기", kind: "Townsfolk" },
  { id: "virgin", label: "처녀", kind: "Townsfolk" },
  { id: "slayer", label: "학살자", kind: "Townsfolk" },
  { id: "soldier", label: "군인", kind: "Townsfolk" },
  { id: "mayor", label: "시장", kind: "Townsfolk" },
  { id: "butler", label: "집사", kind: "Outsider" },
  { id: "drunk", label: "술꾼", kind: "Outsider" },
  { id: "recluse", label: "은둔자", kind: "Outsider" },
  { id: "saint", label: "성자", kind: "Outsider" },
  { id: "poisoner", label: "독살자", kind: "Minion" },
  { id: "spy", label: "스파이", kind: "Minion" },
  { id: "scarletWoman", label: "붉은 여인", kind: "Minion" },
  { id: "baron", label: "남작", kind: "Minion" },
  { id: "imp", label: "임프", kind: "Demon" },
];

export const characterKinds: CharacterKind[] = ["Townsfolk", "Outsider", "Minion", "Demon"];

export const kindLabels: Record<CharacterKind, string> = {
  Townsfolk: "마을주민",
  Outsider: "외부인",
  Minion: "하수인",
  Demon: "악마",
};

export function createDraftPlayer(seat: number): DraftPlayer {
  return {
    seat,
    name: `플레이어 ${seat}`,
  };
}

export function createSetupDraft(playerCount = 5): SetupDraft {
  return {
    players: Array.from({ length: playerCount }, (_, index) => createDraftPlayer(index + 1)),
    selectedSeat: 1,
  };
}

export function resizeSetupDraft(draft: SetupDraft, playerCount: number): SetupDraft {
  const nextCount = Math.max(5, Math.min(15, playerCount));
  const players = Array.from(
    { length: nextCount },
    (_, index) => draft.players[index] ?? createDraftPlayer(index + 1),
  ).map((player, index) => ({ ...player, seat: index + 1 }));

  return {
    players,
    selectedSeat: Math.min(draft.selectedSeat, nextCount),
  };
}

export function selectSeat(draft: SetupDraft, selectedSeat: number): SetupDraft {
  if (!draft.players.some((player) => player.seat === selectedSeat)) return draft;
  return { ...draft, selectedSeat };
}

export function updateDraftPlayer(
  draft: SetupDraft,
  seat: number,
  patch: Partial<Pick<DraftPlayer, "name">>,
): SetupDraft {
  return {
    ...draft,
    players: draft.players.map((player) =>
      player.seat === seat ? { ...player, ...patch } : player,
    ),
  };
}

export function assignActualCharacter(
  draft: SetupDraft,
  actualCharacter: string,
  seat = draft.selectedSeat,
): SetupDraft {
  if (!characterKind(actualCharacter)) return draft;

  return {
    ...draft,
    selectedSeat: seat,
    players: draft.players.map((player) => {
      if (player.seat !== seat && player.actualCharacter === actualCharacter) {
        return withoutAssignment(player);
      }

      if (player.seat !== seat) return player;

      return {
        ...player,
        actualCharacter,
        shownCharacter:
          actualCharacter === "drunk"
            ? validDrunkShownCharacter(player.shownCharacter)
            : undefined,
      };
    }),
  };
}

export function unassignActualCharacter(draft: SetupDraft, seat = draft.selectedSeat): SetupDraft {
  return {
    ...draft,
    players: draft.players.map((player) => (player.seat === seat ? withoutAssignment(player) : player)),
  };
}

export function setDrunkShownCharacter(
  draft: SetupDraft,
  shownCharacter: string,
  seat = draft.selectedSeat,
): SetupDraft {
  if (shownCharacter && !isTownsfolk(shownCharacter)) return draft;

  return {
    ...draft,
    players: draft.players.map((player) =>
      player.seat === seat && player.actualCharacter === "drunk"
        ? { ...player, shownCharacter: shownCharacter || undefined }
        : player,
    ),
  };
}

export function toCreateGamePlayers(players: DraftPlayer[]): CreateGamePlayerInput[] | undefined {
  if (players.some((player) => !player.actualCharacter)) return undefined;
  if (
    players.some(
      (player) =>
        player.actualCharacter === "drunk" && !validDrunkShownCharacter(player.shownCharacter),
    )
  ) {
    return undefined;
  }

  return players.map((player) => {
    const actualCharacter = player.actualCharacter!;
    const input: CreateGamePlayerInput = {
      seat: player.seat,
      name: player.name,
      actualCharacter,
    };
    if (actualCharacter === "drunk") {
      input.shownCharacter = player.shownCharacter;
    }
    return input;
  });
}

export function characterLabel(characterId?: string): string {
  if (!characterId) return "미배정";
  return characters.find((character) => character.id === characterId)?.label ?? characterId;
}

export function characterKind(characterId?: string): CharacterKind | undefined {
  return characters.find((character) => character.id === characterId)?.kind;
}

export function isTownsfolk(characterId?: string): boolean {
  return characterKind(characterId) === "Townsfolk";
}

export function drunkShownCharacterOptions(): Character[] {
  return characters.filter((character) => character.kind === "Townsfolk");
}

function validDrunkShownCharacter(characterId?: string): string | undefined {
  return isTownsfolk(characterId) ? characterId : undefined;
}

function withoutAssignment(player: DraftPlayer): DraftPlayer {
  return {
    seat: player.seat,
    name: player.name,
  };
}

export type CharacterKind = "Townsfolk" | "Outsider" | "Minion" | "Demon";

export type Character = {
  id: string;
  label: string;
  kind: CharacterKind;
  icon: string;
  abilitySummary: string;
};

export type DraftPlayer = {
  seat: number;
  name: string;
  actualCharacter?: string;
  shownCharacter?: string;
};

export type SeatPosition = {
  x: number;
  y: number;
};

export type SeatPositions = Record<number, SeatPosition>;

export type SeatLayoutPreset = "circle" | "oval" | "longTable" | "horseshoe";

export type SetupDraft = {
  players: DraftPlayer[];
  selectedSeat: number;
  seatLayoutPreset: SeatLayoutPreset;
  seatPositions: SeatPositions;
};

export type CreateGamePlayerInput = {
  seat: number;
  name: string;
  actualCharacter: string;
  shownCharacter?: string;
};

export const characters: Character[] = [
  { id: "washerwoman", label: "세탁부", kind: "Townsfolk", icon: "W", abilitySummary: "마을주민 1명과 후보 2명을 확인합니다." },
  { id: "librarian", label: "사서", kind: "Townsfolk", icon: "L", abilitySummary: "외부인 1명과 후보 2명을 확인합니다." },
  { id: "investigator", label: "조사관", kind: "Townsfolk", icon: "I", abilitySummary: "하수인 1명과 후보 2명을 확인합니다." },
  { id: "chef", label: "요리사", kind: "Townsfolk", icon: "C", abilitySummary: "서로 이웃한 악 팀 쌍의 수를 듣습니다." },
  { id: "empath", label: "공감능력자", kind: "Townsfolk", icon: "E", abilitySummary: "밤마다 살아있는 양옆 이웃 중 악 팀 수를 듣습니다." },
  { id: "fortuneTeller", label: "점쟁이", kind: "Townsfolk", icon: "F", abilitySummary: "두 명 중 악마가 있는지 확인합니다." },
  { id: "undertaker", label: "장의사", kind: "Townsfolk", icon: "U", abilitySummary: "전날 처형으로 죽은 플레이어의 캐릭터를 듣습니다." },
  { id: "monk", label: "수도사", kind: "Townsfolk", icon: "M", abilitySummary: "자신이 아닌 한 명을 악마로부터 보호합니다." },
  { id: "ravenkeeper", label: "까마귀지기", kind: "Townsfolk", icon: "R", abilitySummary: "밤에 죽으면 한 명의 캐릭터를 확인합니다." },
  { id: "virgin", label: "처녀", kind: "Townsfolk", icon: "V", abilitySummary: "처음 지명한 마을주민을 즉시 처형할 수 있습니다." },
  { id: "slayer", label: "학살자", kind: "Townsfolk", icon: "S", abilitySummary: "게임 중 한 번 악마라고 생각한 플레이어를 쏩니다." },
  { id: "soldier", label: "군인", kind: "Townsfolk", icon: "S", abilitySummary: "악마에게 죽지 않습니다." },
  { id: "mayor", label: "시장", kind: "Townsfolk", icon: "M", abilitySummary: "세 명 생존과 무처형으로 승리할 수 있습니다." },
  { id: "butler", label: "집사", kind: "Outsider", icon: "B", abilitySummary: "주인이 투표할 때만 투표할 수 있습니다." },
  { id: "drunk", label: "술꾼", kind: "Outsider", icon: "D", abilitySummary: "마을주민이라고 생각하지만 실제로는 능력이 없습니다." },
  { id: "recluse", label: "은둔자", kind: "Outsider", icon: "R", abilitySummary: "악 팀이나 하수인/악마로 등록될 수 있습니다." },
  { id: "saint", label: "성자", kind: "Outsider", icon: "S", abilitySummary: "처형으로 죽으면 악 팀이 승리합니다." },
  { id: "poisoner", label: "독살자", kind: "Minion", icon: "P", abilitySummary: "밤마다 한 명을 다음 해질녘까지 중독시킵니다." },
  { id: "spy", label: "스파이", kind: "Minion", icon: "S", abilitySummary: "밤마다 그리모어를 보고 선 팀으로 등록될 수 있습니다." },
  { id: "scarletWoman", label: "붉은 여인", kind: "Minion", icon: "S", abilitySummary: "악마가 죽으면 새 악마가 될 수 있습니다." },
  { id: "baron", label: "남작", kind: "Minion", icon: "B", abilitySummary: "게임 시작 시 외부인이 2명 더 많아집니다." },
  { id: "imp", label: "임프", kind: "Demon", icon: "I", abilitySummary: "밤마다 한 명을 죽입니다." },
];

export const characterKinds: CharacterKind[] = ["Townsfolk", "Outsider", "Minion", "Demon"];
export const seatLayoutPresets: SeatLayoutPreset[] = ["circle", "oval", "longTable", "horseshoe"];

export const kindLabels: Record<CharacterKind, string> = {
  Townsfolk: "마을주민",
  Outsider: "외부인",
  Minion: "하수인",
  Demon: "악마",
};

export const seatLayoutPresetLabels: Record<SeatLayoutPreset, string> = {
  circle: "원형",
  oval: "타원",
  longTable: "긴 테이블",
  horseshoe: "ㄷ자",
};

const SEAT_POSITION_MIN_X = 8;
const SEAT_POSITION_MAX_X = 92;
const SEAT_POSITION_MIN_Y = 12;
const SEAT_POSITION_MAX_Y = 88;
const CIRCLE_RADIUS = 36;
const OVAL_HORIZONTAL_RADIUS = 41;
const OVAL_VERTICAL_RADIUS = 28;
const TABLE_EDGE_START = 18;
const TABLE_EDGE_END = 82;
const HORSESHOE_RIGHT_LEG_END = 0.34;
const HORSESHOE_BOTTOM_END = 0.67;

export function createDraftPlayer(seat: number): DraftPlayer {
  return {
    seat,
    name: `플레이어 ${seat}`,
  };
}

export function createSetupDraft(playerCount = 5): SetupDraft {
  const players = Array.from({ length: playerCount }, (_, index) => createDraftPlayer(index + 1));

  return {
    players,
    selectedSeat: 1,
    seatLayoutPreset: "circle",
    seatPositions: seatLayoutPositions(players.length, "circle"),
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
    seatLayoutPreset: draft.seatLayoutPreset,
    seatPositions: resizeSeatPositions(draft.seatPositions, nextCount, draft.seatLayoutPreset),
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

export function setSeatLayoutPreset(draft: SetupDraft, preset: SeatLayoutPreset): SetupDraft {
  return {
    ...draft,
    seatLayoutPreset: preset,
    seatPositions: seatLayoutPositions(draft.players.length, preset),
  };
}

export function resetSeatLayout(draft: SetupDraft): SetupDraft {
  return setSeatLayoutPreset(draft, "circle");
}

export function updateSeatPosition(
  draft: SetupDraft,
  seat: number,
  position: SeatPosition,
): SetupDraft {
  if (!draft.players.some((player) => player.seat === seat)) return draft;

  return {
    ...draft,
    seatPositions: {
      ...draft.seatPositions,
      [seat]: clampSeatPosition(position),
    },
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

export function resetActualCharacters(draft: SetupDraft): SetupDraft {
  return {
    ...draft,
    players: draft.players.map(withoutAssignment),
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

export function seatLayoutPositions(playerCount: number, preset: SeatLayoutPreset): SeatPositions {
  if (preset === "oval") return ovalSeatPositions(playerCount);
  if (preset === "longTable") return longTableSeatPositions(playerCount);
  if (preset === "horseshoe") return horseshoeSeatPositions(playerCount);
  return circleSeatPositions(playerCount);
}

function circleSeatPositions(playerCount: number): SeatPositions {
  return ellipseSeatPositions(playerCount, CIRCLE_RADIUS, CIRCLE_RADIUS);
}

function ovalSeatPositions(playerCount: number): SeatPositions {
  return ellipseSeatPositions(playerCount, OVAL_HORIZONTAL_RADIUS, OVAL_VERTICAL_RADIUS);
}

function ellipseSeatPositions(
  playerCount: number,
  horizontalRadius: number,
  verticalRadius: number,
): SeatPositions {
  return Array.from({ length: playerCount }, (_, index) => {
    const angle = clockwiseSeatAngle(index, playerCount);
    return [
      index + 1,
      {
        x: 50 + Math.cos(angle) * horizontalRadius,
        y: 50 + Math.sin(angle) * verticalRadius,
      },
    ] as const;
  }).reduce<SeatPositions>(toSeatPositions, {});
}

function longTableSeatPositions(playerCount: number): SeatPositions {
  const rightCount = Math.ceil(playerCount / 2);
  const leftCount = playerCount - rightCount;

  return Array.from({ length: playerCount }, (_, index) => {
    const onRightSide = index < rightCount;
    const sideIndex = onRightSide ? index : index - rightCount;
    const sideCount = onRightSide ? rightCount : leftCount;

    return [
      index + 1,
      {
        x: onRightSide ? TABLE_EDGE_END : TABLE_EDGE_START,
        y: onRightSide
          ? TABLE_EDGE_START + (sideIndex * (TABLE_EDGE_END - TABLE_EDGE_START)) / Math.max(1, sideCount - 1)
          : TABLE_EDGE_END - (sideIndex * (TABLE_EDGE_END - TABLE_EDGE_START)) / Math.max(1, sideCount - 1),
      },
    ] as const;
  }).reduce<SeatPositions>(toSeatPositions, {});
}

function horseshoeSeatPositions(playerCount: number): SeatPositions {
  return Array.from({ length: playerCount }, (_, index) => {
    const progress = playerCount === 1 ? 0 : index / (playerCount - 1);
    if (progress < HORSESHOE_RIGHT_LEG_END) {
      return [
        index + 1,
        {
          x: TABLE_EDGE_END,
          y: TABLE_EDGE_START + (progress / HORSESHOE_RIGHT_LEG_END) * (TABLE_EDGE_END - TABLE_EDGE_START),
        },
      ] as const;
    }
    if (progress < HORSESHOE_BOTTOM_END) {
      return [
        index + 1,
        {
          x:
            TABLE_EDGE_END -
            ((progress - HORSESHOE_RIGHT_LEG_END) / (HORSESHOE_BOTTOM_END - HORSESHOE_RIGHT_LEG_END)) *
              (TABLE_EDGE_END - TABLE_EDGE_START),
          y: TABLE_EDGE_END,
        },
      ] as const;
    }
    return [
      index + 1,
      {
        x: TABLE_EDGE_START,
        y:
          TABLE_EDGE_END -
          ((progress - HORSESHOE_BOTTOM_END) / (1 - HORSESHOE_BOTTOM_END)) *
            (TABLE_EDGE_END - TABLE_EDGE_START),
      },
    ] as const;
  }).reduce<SeatPositions>(toSeatPositions, {});
}

function resizeSeatPositions(
  currentPositions: SeatPositions,
  playerCount: number,
  preset: SeatLayoutPreset,
): SeatPositions {
  const presetPositions = seatLayoutPositions(playerCount, preset);
  return Array.from({ length: playerCount }, (_, index) => {
    const seat = index + 1;
    return [seat, currentPositions[seat] ?? presetPositions[seat]] as const;
  }).reduce<SeatPositions>(toSeatPositions, {});
}

function toSeatPositions(
  positions: SeatPositions,
  [seat, position]: readonly [number, SeatPosition],
): SeatPositions {
  positions[seat] = position;
  return positions;
}

function clockwiseSeatAngle(index: number, playerCount: number): number {
  return -Math.PI / 4 + (Math.PI * 2 * index) / playerCount;
}

function clampSeatPosition(position: SeatPosition): SeatPosition {
  return {
    x: Math.max(SEAT_POSITION_MIN_X, Math.min(SEAT_POSITION_MAX_X, position.x)),
    y: Math.max(SEAT_POSITION_MIN_Y, Math.min(SEAT_POSITION_MAX_Y, position.y)),
  };
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

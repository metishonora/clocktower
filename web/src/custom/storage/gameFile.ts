import type { GameFile, GameFileV4, ScriptReference, CustomScriptDefinition, GameEvent, SeatLayoutState } from "../core/types.js";
import { parseFirstNightOrderPlan, parseGameEvent } from "../core/validation.js";
import { resolveCustomScriptDefinition } from "../characterCatalog.js";


export function exportGameFileJson(gameFile: GameFile, exportedAt = new Date()): string {
  const canonical = canonicalGameFile(gameFile);
  return JSON.stringify(
    {
      ...canonical,
      exportedAt: exportedAt.toISOString(),
    },
    null,
    2,
  );
}


export function parseGameFileJson(json: string): GameFileV4 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("게임 파일 형식이 올바르지 않습니다.");
  }

  return validateGameFile(parsed);
}


function validateGameFile(value: unknown): GameFileV4 {
  if (!isRecord(value)) {
    throw new Error("게임 파일 형식이 올바르지 않습니다.");
  }
  if (value.schemaVersion !== 4) {
    throw new Error("지원하지 않는 게임 파일 버전입니다.");
  }
  if (!isRecord(value.game)) {
    throw new Error("게임 파일 형식이 올바르지 않습니다.");
  }
  const script = parseStoredScriptReference(value.schemaVersion, value.game);
  if (
    typeof value.game.id !== "string" ||
    typeof value.game.name !== "string" ||
    typeof value.game.createdAt !== "string" ||
    typeof value.game.updatedAt !== "string" ||
    !Array.isArray(value.game.events)
  ) {
    throw new Error("게임 파일 형식이 올바르지 않습니다.");
  }

  const events = value.game.events.map(parseGameEvent);
  const seatLayout = parseSeatLayout(value.ui, events);
  const ui = seatLayout ? { seatLayout } : undefined;

  return {
    schemaVersion: 4,
    ...(ui ? { ui } : {}),
    game: {
      script,
      id: value.game.id,
      name: value.game.name,
      createdAt: value.game.createdAt,
      updatedAt: value.game.updatedAt,
      events,
    },
  };
}
function parseStoredScriptReference(_schemaVersion: unknown, game: Record<string, unknown>): ScriptReference { if (Object.hasOwn(game, "scriptId") || !Object.hasOwn(game, "script")) throw malformedGameFile(); return parseScriptReference(game.script); }
function parseScriptReference(value: unknown): ScriptReference { if (!isRecord(value) || value.type !== "custom" || !hasExactKeys(value, ["type", "definition"])) throw malformedGameFile(); return { type: "custom", definition: parseCustomScriptDefinition(value.definition) }; }


export function parseCustomScriptDefinition(value: unknown): CustomScriptDefinition {
  if (
    !isRecord(value)
    || !hasExactKeys(value, ["id", "name", "characterIds", "firstNightOrder"])
    || typeof value.id !== "string"
    || value.id.trim().length === 0
    || typeof value.name !== "string"
    || value.name.trim().length === 0
    || !Array.isArray(value.characterIds)
    || !value.characterIds.every(
      (characterId) => typeof characterId === "string" && characterId.trim().length > 0,
    )
  ) {
    throw new Error("커스텀 시나리오 정의가 올바르지 않습니다.");
  }
  if (new Set(value.characterIds).size !== value.characterIds.length) {
    throw new Error("커스텀 시나리오에 중복된 캐릭터가 있습니다.");
  }
  return resolveCustomScriptDefinition({
    id: value.id,
    name: value.name,
    characterIds: [...value.characterIds],
    firstNightOrder: parseFirstNightOrderPlan(value.firstNightOrder),
  });
}
function canonicalGameFile(gameFile: GameFile): GameFileV4 { return validateGameFile(gameFile); }


function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}


function malformedGameFile(): Error {
  return new Error("게임 파일 형식이 올바르지 않습니다.");
}


function parseSeatLayout(ui: unknown, events: GameEvent[]): SeatLayoutState | undefined {
  if (ui === undefined) return undefined;
  if (!isRecord(ui)) throw invalidSeatLayout();
  if (ui.seatLayout === undefined) return undefined;
  if (!isRecord(ui.seatLayout)) throw invalidSeatLayout();

  const { preset, positions } = ui.seatLayout;
  if (
    preset !== "circle" &&
    preset !== "oval" &&
    preset !== "longTable" &&
    preset !== "horseshoe"
  ) {
    throw invalidSeatLayout();
  }
  if (!isRecord(positions)) throw invalidSeatLayout();

  const setupEvent = events.find((event) => event.type === "setupConfirmed");
  if (!setupEvent) throw invalidSeatLayout();
  const expectedSeats = new Set(setupEvent.payload.players.map((player) => player.seat));
  const parsedPositions: SeatLayoutState["positions"] = {};

  for (const [seatKey, position] of Object.entries(positions)) {
    const seat = Number(seatKey);
    if (
      !Number.isInteger(seat) ||
      seat < 1 ||
      seat > 15 ||
      !expectedSeats.has(seat) ||
      !isRecord(position) ||
      typeof position.x !== "number" ||
      !Number.isFinite(position.x) ||
      position.x < 8 ||
      position.x > 92 ||
      typeof position.y !== "number" ||
      !Number.isFinite(position.y) ||
      position.y < 12 ||
      position.y > 88
    ) {
      throw invalidSeatLayout();
    }
    parsedPositions[seat] = { x: position.x, y: position.y };
  }

  if (
    Object.keys(parsedPositions).length !== expectedSeats.size ||
    [...expectedSeats].some((seat) => parsedPositions[seat] === undefined)
  ) {
    throw invalidSeatLayout();
  }

  return { preset, positions: parsedPositions };
}


function invalidSeatLayout(): Error {
  return new Error("좌석 배치 정보가 올바르지 않습니다.");
}


function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

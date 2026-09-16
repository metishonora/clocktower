import type { GameFile, ScriptReference } from "./types.js";

export type ScriptId = "troubleBrewing" | "sectsAndViolets" | "badMoonRising";

export const TROUBLE_BREWING = "troubleBrewing" as const;
export const SECTS_AND_VIOLETS = "sectsAndViolets" as const;
export const BAD_MOON_RISING = "badMoonRising" as const;

export function isScriptId(value: unknown): value is ScriptId {
  return value === TROUBLE_BREWING || value === SECTS_AND_VIOLETS || value === BAD_MOON_RISING;
}

export function gameFileScriptReference(gameFile: GameFile): ScriptReference {
  return gameFile.schemaVersion === 4
    ? gameFile.game.script
    : { type: "official", scriptId: gameFile.game.scriptId };
}

export function officialGameFileScriptId(gameFile: GameFile): ScriptId | undefined {
  const reference = gameFileScriptReference(gameFile);
  return reference.type === "official" ? reference.scriptId : undefined;
}

export function scriptStorageKey(scriptId: ScriptId): string {
  return `latest:${scriptId}`;
}

export function scriptDisplayName(scriptId: ScriptId): string {
  switch (scriptId) {
    case TROUBLE_BREWING:
      return "Trouble Brewing";
    case SECTS_AND_VIOLETS:
      return "Sects & Violets";
    case BAD_MOON_RISING:
      return "Bad Moon Rising";
  }
}

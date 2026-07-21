export type ScriptId = "troubleBrewing" | "sectsAndViolets";

export const TROUBLE_BREWING: ScriptId = "troubleBrewing";
export const SECTS_AND_VIOLETS: ScriptId = "sectsAndViolets";

export function isScriptId(value: unknown): value is ScriptId {
  return value === TROUBLE_BREWING || value === SECTS_AND_VIOLETS;
}

export function scriptStorageKey(scriptId: ScriptId): string {
  return `latest:${scriptId}`;
}

export function scriptDisplayName(scriptId: ScriptId): string {
  return scriptId === TROUBLE_BREWING ? "Trouble Brewing" : "Sects & Violets";
}

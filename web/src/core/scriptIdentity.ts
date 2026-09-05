import type {
  CustomScriptDefinition,
  FirstNightActionRef,
  GameFile,
  ReplayState,
  ScriptReference,
} from "./types.js";

export function replayStateScriptReference(replayState: ReplayState): ScriptReference {
  return replayState.script === undefined
    ? { type: "official", scriptId: replayState.scriptId }
    : structuredClone(replayState.script);
}

export function sameScriptReference(
  left: ScriptReference,
  right: ScriptReference,
): boolean {
  if (left.type !== right.type) return false;
  if (left.type === "official" && right.type === "official") {
    return left.scriptId === right.scriptId;
  }
  if (left.type !== "custom" || right.type !== "custom") return false;
  return sameCustomScriptDefinition(left.definition, right.definition);
}

export function sameCustomScriptDefinition(
  left: CustomScriptDefinition,
  right: CustomScriptDefinition,
): boolean {
  return left.id === right.id
    && left.name === right.name
    && sameOrderedStrings(left.characterIds, right.characterIds)
    && sameFirstNightOrder(left.firstNightOrder, right.firstNightOrder);
}

export function customGameCanResumeWithDefinition(
  gameFile: GameFile,
  definition: CustomScriptDefinition,
): boolean {
  if (gameFile.schemaVersion !== 4 || gameFile.game.script.type !== "custom") return false;
  return sameCustomScriptDefinition(gameFile.game.script.definition, definition);
}

export function cloneScriptReference(reference: ScriptReference): ScriptReference {
  return structuredClone(reference);
}

function sameOrderedStrings(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameFirstNightOrder(
  left: FirstNightActionRef[] | undefined,
  right: FirstNightActionRef[] | undefined,
): boolean {
  if (left === undefined || right === undefined) return left === right;
  return left.length === right.length
    && left.every((action, index) => sameFirstNightAction(action, right[index]));
}

function sameFirstNightAction(
  left: FirstNightActionRef,
  right: FirstNightActionRef | undefined,
): boolean {
  if (!right || left.kind !== right.kind) return false;
  return left.kind === "system" && right.kind === "system"
    ? left.actionId === right.actionId
    : left.kind === "character" && right.kind === "character"
      && left.characterId === right.characterId
      && left.actionId === right.actionId;
}

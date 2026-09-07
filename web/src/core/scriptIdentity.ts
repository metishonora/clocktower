import type {
  CustomScriptDefinition,
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
    && sameOrderedActions(left.firstNightOrder, right.firstNightOrder);
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

function sameOrderedActions(
  left: CustomScriptDefinition["firstNightOrder"],
  right: CustomScriptDefinition["firstNightOrder"],
): boolean {
  // The public type requires both plans. Keep malformed JavaScript callers from
  // turning an identity check into an exception at a session boundary.
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  return left.length === right.length
    && left.every((action, index) => {
      const other = right[index];
      if (!other || action.kind !== other.kind) return false;
      return action.kind === "system" && other.kind === "system"
        ? action.actionId === other.actionId
        : action.kind === "character" && other.kind === "character"
          && action.characterId === other.characterId
          && action.actionId === other.actionId;
    });
}

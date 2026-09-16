import type {
  ReplayState,
  ScriptReference,
} from "./types.js";
export function replayStateScriptReference(state: ReplayState): ScriptReference { return { type: "official", scriptId: state.scriptId }; }
export function sameScriptReference(left: ScriptReference, right: ScriptReference): boolean { return left.type === "official" && right.type === "official" && left.scriptId === right.scriptId; }




export function cloneScriptReference(reference: ScriptReference): ScriptReference {
  return structuredClone(reference);
}

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { initSync } from "../src/generated/clocktower_wasm/clocktower_wasm.js";
import { wasmCoreAdapter } from "../src/core/wasmClient";
import type { Command, GameEvent, GameFile, Proposal, ReplayState } from "../src/core/types";

let initialized = false;

export function realWasmCore() {
  if (!initialized) {
    const bytes = Uint8Array.from(readFileSync(resolve(
      process.cwd(),
      "src/generated/clocktower_wasm/clocktower_wasm_bg.wasm",
    )));
    initSync({ module: bytes });
    initialized = true;
  }
  return wasmCoreAdapter;
}

export async function replayOrThrow(gameFile: GameFile): Promise<ReplayState> {
  const result = await realWasmCore().replay(gameFile);
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.messageKo}`);
  return result.value;
}

export async function proposeAndAppend(gameFile: GameFile, command: Command): Promise<Proposal> {
  let canonicalCommand = command;
  if (
    command.type === "confirmStep"
    && command.payload.stepId === "firstNight:demonInfo"
    && command.payload.input == null
  ) {
    const state = await replayOrThrow(gameFile);
    const allowed = state.currentStep?.requiredInput.kind === "characterIds"
      ? state.currentStep.requiredInput.allowedCharacterIds ?? []
      : [];
    canonicalCommand = {
      ...command,
      payload: {
        ...command.payload,
        input: { characterIds: allowed.slice(0, 3) },
      },
    };
  }
  const result = await realWasmCore().propose(gameFile, canonicalCommand);
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.messageKo}`);
  gameFile.game.events.push(result.value.event);
  return result.value;
}

export function phaseEvent(type: "phaseStepConfirmed" | "phaseStepSkipped", stepId: string, input: unknown = null): GameEvent {
  return {
    id: `seed-${stepId}`,
    type,
    phase: stepId.startsWith("firstNight") ? "firstNight" : stepId.startsWith("day") ? "day" : "night",
    payload: type === "phaseStepConfirmed" ? { stepId, input } : { stepId },
    summary: stepId,
    createdAt: "2026-01-01T00:00:00.000Z",
  } as GameEvent;
}

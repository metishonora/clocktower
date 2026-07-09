import type { Command, CoreResult, GameFile, Proposal, ReplayState } from "./types";
import init, {
  propose as wasmPropose,
  replay as wasmReplay,
} from "../generated/clocktower_wasm/clocktower_wasm.js";

let initPromise: Promise<void> | undefined;

async function ensureWasm(): Promise<void> {
  initPromise ??= init().then(() => undefined);
  return initPromise;
}

export async function replay(gameFile: GameFile): Promise<CoreResult<ReplayState>> {
  await ensureWasm();
  return JSON.parse(wasmReplay(JSON.stringify(gameFile)));
}

export async function propose(
  gameFile: GameFile,
  command: Command,
): Promise<CoreResult<Proposal>> {
  await ensureWasm();
  return JSON.parse(wasmPropose(JSON.stringify(gameFile), JSON.stringify(command)));
}

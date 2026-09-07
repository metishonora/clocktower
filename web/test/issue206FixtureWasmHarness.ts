import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { initSync } from "../.codex-tmp/issue206-wasm/clocktower_wasm.js";
import { wasmCoreAdapter } from "../src/core/wasmClient.js";
import type { Command, GameFile, Proposal, ReplayState } from "../src/core/types.js";

let initialized = false;

/**
 * Initialize the generated fixture artifact while returning the same public adapter used by the
 * application.  Keeping the adapter here avoids a second test-only replay or event fold.
 */
export function issue206FixtureWasmCore() {
  if (!initialized) {
    const bytes = Uint8Array.from(readFileSync(resolve(
      process.cwd(),
      ".codex-tmp/issue206-wasm/clocktower_wasm_bg.wasm",
    )));
    initSync({ module: bytes });
    initialized = true;
  }
  return wasmCoreAdapter;
}
export async function fixtureReplayOrThrow(gameFile: GameFile): Promise<ReplayState> {
  const result = await issue206FixtureWasmCore().replay(gameFile);
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.messageKo}`);
  return result.value;
}

export async function fixtureProposeOrThrow(
  gameFile: GameFile,
  command: Command,
): Promise<Proposal> {
  const result = await issue206FixtureWasmCore().propose(gameFile, command);
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.messageKo}`);
  return result.value;
}

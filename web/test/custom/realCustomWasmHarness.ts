import { readFileSync } from "node:fs"; import { resolve } from "node:path"; import { initSync } from "../../src/generated/clocktower_custom_wasm/clocktower_custom_wasm.js"; import { wasmCoreAdapter } from "../../src/custom/core/wasmClient.js";
let initialized = false;
export function realWasmCore() { if (!initialized) { initSync({ module: readFileSync(resolve(process.cwd(), "src/generated/clocktower_custom_wasm/clocktower_custom_wasm_bg.wasm")) }); initialized = true; } return wasmCoreAdapter; }

import type { GameFile, ReplayState } from "../../src/custom/core/types.js";
export async function replayOrThrow(game: GameFile): Promise<ReplayState> { const result = await realWasmCore().replay(game); if (!result.ok) throw new Error(`${result.error.code}: ${result.error.messageKo}`); return result.value; }

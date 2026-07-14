import type {
  Command,
  CoreResult,
  GameFile,
  Proposal,
  ReplayState,
  SetupDistribution,
  SetupDistributionRequest,
} from "./types.js";
import type { CoreAdapter } from "./coreAdapter.js";
import init, {
  propose as wasmPropose,
  replay as wasmReplay,
  setup_distribution as wasmSetupDistribution,
} from "../generated/clocktower_wasm/clocktower_wasm.js";

let initPromise: Promise<void> | undefined;
let initialized = false;

async function ensureWasm(): Promise<void> {
  initPromise ??= init().then(() => {
    initialized = true;
  });
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

export async function setupDistribution(
  request: SetupDistributionRequest,
): Promise<CoreResult<SetupDistribution>> {
  await ensureWasm();
  return JSON.parse(wasmSetupDistribution(JSON.stringify(request)));
}

export function setupDistributionSync(
  request: SetupDistributionRequest,
): CoreResult<SetupDistribution> | undefined {
  if (!initialized) return undefined;
  return JSON.parse(wasmSetupDistribution(JSON.stringify(request)));
}

export const wasmCoreAdapter: CoreAdapter = {
  replay,
  propose,
  setupDistribution,
  setupDistributionSync,
};

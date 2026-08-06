import type {
  Command,
  CoreResult,
  GameFile,
  PhaseInputSuggestion,
  PhaseInputSuggestionRequest,
  Proposal,
  ReplayState,
  SetupDistribution,
  SetupDistributionRequest,
} from "./types.js";
import type { CoreAdapter } from "./coreAdapter.js";
import { memoizeLatestJsonRequest, serializeReplayRequest } from "./latestJsonRequestCache.js";
import { withExpectedEventCount } from "./streamVersion.js";
import {
  parseCoreResult,
  parseProposal,
  parsePhaseInputSuggestion,
  parseReplayState,
  parseSetupDistribution,
} from "./validation.js";
import init, {
  propose as wasmPropose,
  replay as wasmReplay,
  setup_distribution as wasmSetupDistribution,
  suggest_phase_input as wasmSuggestPhaseInput,
} from "../generated/clocktower_wasm/clocktower_wasm.js";

let initPromise: Promise<void> | undefined;
let initialized = false;

async function ensureWasm(): Promise<void> {
  initPromise ??= init().then(() => {
    initialized = true;
  });
  return initPromise;
}

const replayLatest = memoizeLatestJsonRequest<GameFile, CoreResult<ReplayState>>(
  async (gameFileJson) => {
    await ensureWasm();
    return parseCoreResult(JSON.parse(wasmReplay(gameFileJson)), parseReplayState);
  },
  serializeReplayRequest,
);

export function replay(gameFile: GameFile): Promise<CoreResult<ReplayState>> {
  return replayLatest(gameFile);
}

export async function propose(
  gameFile: GameFile,
  command: Command,
): Promise<CoreResult<Proposal>> {
  await ensureWasm();
  const versionedCommand = withExpectedEventCount(gameFile, command);
  return parseCoreResult(
    JSON.parse(wasmPropose(JSON.stringify(gameFile), JSON.stringify(versionedCommand))),
    parseProposal,
  );
}

export async function setupDistribution(
  request: SetupDistributionRequest,
): Promise<CoreResult<SetupDistribution>> {
  await ensureWasm();
  return parseCoreResult(
    JSON.parse(wasmSetupDistribution(JSON.stringify(request))),
    parseSetupDistribution,
  );
}

export function setupDistributionSync(
  request: SetupDistributionRequest,
): CoreResult<SetupDistribution> | undefined {
  if (!initialized) return undefined;
  return parseCoreResult(
    JSON.parse(wasmSetupDistribution(JSON.stringify(request))),
    parseSetupDistribution,
  );
}

export async function suggestPhaseInput(
  gameFile: GameFile,
  request: PhaseInputSuggestionRequest,
): Promise<CoreResult<PhaseInputSuggestion>> {
  await ensureWasm();
  return parseCoreResult(
    JSON.parse(wasmSuggestPhaseInput(JSON.stringify(gameFile), JSON.stringify(request))),
    parsePhaseInputSuggestion,
  );
}

export const wasmCoreAdapter: CoreAdapter = {
  replay,
  propose,
  setupDistribution,
  setupDistributionSync,
  suggestPhaseInput,
};

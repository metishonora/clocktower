import type {
  Command,
  CoreResult,
  CustomFirstNightPlanResult,
  CustomScriptDefinitionDraft,
  GameFile,
  PhaseInputSuggestion,
  PhaseInputSuggestionRequest,
  Proposal,
  ReplayState,
  SetupDistributionResult,
  SetupDistributionRequest,
} from "./types.js";
import type { CoreAdapter } from "./coreAdapter.js";
import type { CustomDefinitionValidator } from "./customDefinitionValidator.js";
import { memoizeLatestJsonRequest, serializeReplayRequest } from "./latestJsonRequestCache.js";
import { withExpectedEventCount } from "./streamVersion.js";
import {
  parseCoreResult,
  parseCustomFirstNightPlanResult,
  parseProposal,
  parsePhaseInputSuggestion,
  parseReplayState,
  parseSetupDistribution,
} from "./validation.js";
import init, {
  custom_script_catalog as wasmCustomScriptCatalog,
  custom_first_night_plan as wasmCustomFirstNightPlan,
  propose as wasmPropose,
  replay as wasmReplay,
  setup_distribution as wasmSetupDistribution,
  suggest_phase_input as wasmSuggestPhaseInput,
} from "../generated/clocktower_wasm/clocktower_wasm.js";

export type CustomScriptCatalogEntry = {
  id: string;
  kind: "Townsfolk" | "Outsider" | "Minion" | "Demon";
};

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
): Promise<CoreResult<SetupDistributionResult>> {
  await ensureWasm();
  return parseCoreResult(
    JSON.parse(wasmSetupDistribution(JSON.stringify(request))),
    parseSetupDistribution,
  );
}

export function setupDistributionSync(
  request: SetupDistributionRequest,
): CoreResult<SetupDistributionResult> | undefined {
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

export async function customScriptCatalog(): Promise<CustomScriptCatalogEntry[]> {
  await ensureWasm();
  return JSON.parse(wasmCustomScriptCatalog()) as CustomScriptCatalogEntry[];
}

export async function customFirstNightPlan(
  customDefinition: CustomScriptDefinitionDraft,
): Promise<CoreResult<CustomFirstNightPlanResult>> {
  await ensureWasm();
  return queryCustomFirstNightPlan(customDefinition);
}

function queryCustomFirstNightPlan(
  customDefinition: CustomScriptDefinitionDraft,
): CoreResult<CustomFirstNightPlanResult> {
  return parseCoreResult(
    JSON.parse(wasmCustomFirstNightPlan(JSON.stringify({ customDefinition }))),
    parseCustomFirstNightPlanResult,
  );
}

export async function loadCustomDefinitionValidator(): Promise<CustomDefinitionValidator> {
  await ensureWasm();
  return (definition) => {
    // Validation must never enter the authoring query's missing-order proposal path.
    if (!Array.isArray(definition.firstNightOrder)) {
      throw new Error("커스텀 시나리오에 첫날 밤 순서가 필요합니다.");
    }
    const result = queryCustomFirstNightPlan(definition);
    if (!result.ok) throw new Error(result.error.messageKo);
    if (result.value.source !== "definition") {
      throw new Error("커스텀 시나리오의 명시적 첫날 밤 순서를 검증하지 못했습니다.");
    }
  };
}

export const wasmCoreAdapter: CoreAdapter = {
  replay,
  propose,
  setupDistribution,
  setupDistributionSync,
  suggestPhaseInput,
};

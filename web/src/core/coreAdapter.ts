import type {
  Command,
  CoreResult,
  GameFile,
  PhaseInputSuggestion,
  PhaseInputSuggestionRequest,
  Proposal,
  ReplayState,
  SetupDistributionResult,
  SetupDistributionRequest,
} from "./types.js";
export type CoreAdapter = {
  replay(gameFile: GameFile): Promise<CoreResult<ReplayState>>;
  propose(gameFile: GameFile, command: Command): Promise<CoreResult<Proposal>>;
  setupDistribution(request: SetupDistributionRequest): Promise<CoreResult<SetupDistributionResult>>;
  setupDistributionSync(request: SetupDistributionRequest): CoreResult<SetupDistributionResult> | undefined;
  suggestPhaseInput(
    gameFile: GameFile,
    request: PhaseInputSuggestionRequest,
  ): Promise<CoreResult<PhaseInputSuggestion>>;
};

import type {
  Command,
  CoreResult,
  GameFile,
  Proposal,
  ReplayState,
  RevealPayload,
  SetupDistributionResult,
  SetupDistributionRequest,
} from "./types.js";
export type CoreAdapter = {
  confirmedEventReveal?(gameFile: GameFile, eventId: string): Promise<CoreResult<RevealPayload | null>>;
  replay(gameFile: GameFile): Promise<CoreResult<ReplayState>>;
  propose(gameFile: GameFile, command: Command): Promise<CoreResult<Proposal>>;
  setupDistribution(request: SetupDistributionRequest): Promise<CoreResult<SetupDistributionResult>>;
  setupDistributionSync(request: SetupDistributionRequest): CoreResult<SetupDistributionResult> | undefined;
};

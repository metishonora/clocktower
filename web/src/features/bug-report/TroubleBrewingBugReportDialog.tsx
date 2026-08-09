import type { GameFile } from "../../core/types.js";
import {
  bugReportMetadataMailto,
  type BugReportDelivery,
} from "../../bugReportDelivery.js";
import {
  buildTroubleBrewingBugReport,
  type TroubleBrewingBugReportContextInput,
  type TroubleBrewingBugReportEnvironment,
} from "../../troubleBrewingBugReport.js";
import {
  GameBugReportDialog,
  troubleBrewingBugReportTheme,
} from "./GameBugReportDialog.js";

export type TroubleBrewingBugReportDialogTheme = "day" | "night";

/**
 * Trouble Brewing's caller owns the phase and focus trigger. The wrapper only
 * selects the approved forest/parchment adapter and report builder.
 */
export function TroubleBrewingBugReportDialog({
  gameFile,
  environment,
  reproductionContext,
  recipient,
  delivery,
  onClose,
  theme = "night",
}: {
  gameFile: GameFile;
  environment: TroubleBrewingBugReportEnvironment;
  reproductionContext: TroubleBrewingBugReportContextInput;
  recipient: string;
  delivery?: BugReportDelivery;
  onClose: () => void;
  theme?: TroubleBrewingBugReportDialogTheme;
}) {
  return (
    <GameBugReportDialog
      gameFile={gameFile}
      environment={environment}
      reproductionContext={reproductionContext}
      recipient={recipient}
      delivery={delivery}
      onClose={onClose}
      builder={buildTroubleBrewingBugReport}
      theme={{ ...troubleBrewingBugReportTheme, id: theme }}
      scriptName="Clocktower Trouble Brewing"
      scriptId="troubleBrewing"
      downloadPrefix="clocktower-trouble-brewing-bug-report-"
      privacyExcluded="플레이어 이름과 Storyteller 메모, 설정 초안"
      previewIncludedLabel="원본 포함(검토용)"
      metadataMailto={(email, report) => bugReportMetadataMailto(
        email,
        report,
        "Clocktower Trouble Brewing 버그 제보",
      )}
    />
  );
}

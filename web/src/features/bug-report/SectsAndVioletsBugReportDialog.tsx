import type { GameFile } from "../../core/types.js";
import {
  bugReportMetadataMailto,
  type BugReportDelivery,
} from "../../bugReportDelivery.js";
import {
  buildSectsAndVioletsBugReport,
  type SectsAndVioletsBugReportContextInput,
  type SectsAndVioletsBugReportEnvironment,
} from "../../sectsAndVioletsBugReport.js";
import {
  GameBugReportDialog,
  sectsAndVioletsBugReportTheme,
} from "./GameBugReportDialog.js";
import "./sectsAndVioletsBugReport.css";

/**
 * S&V's public props intentionally remain unchanged. The script-specific
 * builder and purple class prefix are now adapters around the shared dialog.
 */
export function SectsAndVioletsBugReportDialog({
  gameFile,
  environment,
  reproductionContext,
  recipient,
  delivery,
  onClose,
}: {
  gameFile: GameFile;
  environment: SectsAndVioletsBugReportEnvironment;
  reproductionContext: SectsAndVioletsBugReportContextInput;
  recipient: string;
  delivery?: BugReportDelivery;
  onClose: () => void;
}) {
  return (
    <GameBugReportDialog
      gameFile={gameFile}
      environment={environment}
      reproductionContext={reproductionContext}
      recipient={recipient}
      delivery={delivery}
      onClose={onClose}
      builder={buildSectsAndVioletsBugReport}
      theme={sectsAndVioletsBugReportTheme}
      scriptName="Clocktower S&V"
      scriptId="sectsAndViolets"
      downloadPrefix="clocktower-snv-bug-report-"
      showBrandName={false}
      originalFileLabel="원본 게임 JSON도 포함"
      metadataMailto={(email, report) => bugReportMetadataMailto(
        email,
        report,
      )}
    />
  );
}

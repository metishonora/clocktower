import { useState } from "react";
import {
  SectsAndVioletsGameSurface,
  type SnvPresentation,
  type SnvSetupDraft,
} from "./sectsAndVioletsGame";
import type { CoreAdapter } from "./core/coreAdapter";
import { wasmCoreAdapter } from "./core/wasmClient";
import { SECTS_AND_VIOLETS } from "./core/scripts";
import {
  IndexedDbWebSessionStorageDriver,
  type CompatibleWebSessionStorage,
} from "./webSessionStorage";
import {
  DEFAULT_BUG_REPORT_EMAIL,
  type BugReportDelivery,
} from "./bugReportDelivery";

export function SectsAndVioletsApp({
  coreAdapter = wasmCoreAdapter,
  storageDriver,
  bugReportEmail = import.meta.env.VITE_BUG_REPORT_EMAIL?.trim() || DEFAULT_BUG_REPORT_EMAIL,
  bugReportDelivery,
}: {
  coreAdapter?: CoreAdapter;
  storageDriver?: CompatibleWebSessionStorage<SnvSetupDraft, SnvPresentation>;
  bugReportEmail?: string;
  bugReportDelivery?: BugReportDelivery;
} = {}) {
  const [storage] = useState<CompatibleWebSessionStorage<SnvSetupDraft, SnvPresentation>>(
    () => storageDriver
      ?? new IndexedDbWebSessionStorageDriver<SnvSetupDraft, SnvPresentation>(SECTS_AND_VIOLETS),
  );
  return (
    <SectsAndVioletsGameSurface
      coreAdapter={coreAdapter}
      storageDriver={storage}
      bugReportEmail={bugReportEmail}
      bugReportDelivery={bugReportDelivery}
      production
    />
  );
}

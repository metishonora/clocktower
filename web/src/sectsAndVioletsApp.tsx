import { useState } from "react";
import { SectsAndVioletsGameSurface } from "./sectsAndVioletsGame";
import type { CoreAdapter } from "./core/coreAdapter";
import { wasmCoreAdapter } from "./core/wasmClient";
import { SECTS_AND_VIOLETS } from "./core/scripts";
import { IndexedDbGameStorageDriver, type GameStorageDriver } from "./gameStorage";
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
  storageDriver?: GameStorageDriver;
  bugReportEmail?: string;
  bugReportDelivery?: BugReportDelivery;
} = {}) {
  const [storage] = useState<GameStorageDriver>(
    () => storageDriver ?? new IndexedDbGameStorageDriver(SECTS_AND_VIOLETS),
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

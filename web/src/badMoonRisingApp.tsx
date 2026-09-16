import { useState } from "react";
import { BadMoonRisingGameSurface, type BmrPresentation, type BmrSetupDraft } from "./badMoonRisingGame.js";
import type { CoreAdapter } from "./core/coreAdapter.js";
import { BAD_MOON_RISING } from "./core/scripts.js";
import { wasmCoreAdapter } from "./core/wasmClient.js";
import {
  IndexedDbWebSessionStorageDriver,
  type CompatibleWebSessionStorage,
} from "./webSessionStorage.js";

export function BadMoonRisingApp({
  coreAdapter = wasmCoreAdapter,
  storageDriver,
}: {
  coreAdapter?: CoreAdapter;
  storageDriver?: CompatibleWebSessionStorage<BmrSetupDraft, BmrPresentation>;
} = {}) {
  const [storage] = useState<CompatibleWebSessionStorage<BmrSetupDraft, BmrPresentation>>(
    () => storageDriver ?? new IndexedDbWebSessionStorageDriver<BmrSetupDraft, BmrPresentation>(BAD_MOON_RISING),
  );
  return <BadMoonRisingGameSurface coreAdapter={coreAdapter} storageDriver={storage} />;
}

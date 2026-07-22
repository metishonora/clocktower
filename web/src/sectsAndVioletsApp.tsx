import { useState } from "react";
import { SectsAndVioletsFoundation } from "./sectsAndVioletsFoundationPrototype";
import type { CoreAdapter } from "./core/coreAdapter";
import { wasmCoreAdapter } from "./core/wasmClient";
import { SECTS_AND_VIOLETS } from "./core/scripts";
import { IndexedDbGameStorageDriver, type GameStorageDriver } from "./gameStorage";

export function SectsAndVioletsApp({
  coreAdapter = wasmCoreAdapter,
  storageDriver,
}: {
  coreAdapter?: CoreAdapter;
  storageDriver?: GameStorageDriver;
} = {}) {
  const [storage] = useState<GameStorageDriver>(
    () => storageDriver ?? new IndexedDbGameStorageDriver(SECTS_AND_VIOLETS),
  );
  return (
    <SectsAndVioletsFoundation
      coreAdapter={coreAdapter}
      storageDriver={storage}
      production
    />
  );
}

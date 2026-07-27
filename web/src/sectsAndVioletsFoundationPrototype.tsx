import type { CoreAdapter } from "./core/coreAdapter";
import type { GameStorageDriver } from "./gameStorage";
import {
  SectsAndVioletsGameSurface,
  SectsAndVioletsFoundationPrototype,
  grimoireHeights,
  rectangularSeatPositions,
} from "./sectsAndVioletsGame";

export { grimoireHeights, rectangularSeatPositions, SectsAndVioletsFoundationPrototype };

export function SectsAndVioletsFoundation({
  coreAdapter,
  storageDriver,
}: {
  coreAdapter?: CoreAdapter;
  storageDriver?: GameStorageDriver;
} = {}) {
  return (
    <SectsAndVioletsGameSurface
      coreAdapter={coreAdapter}
      storageDriver={storageDriver}
    />
  );
}

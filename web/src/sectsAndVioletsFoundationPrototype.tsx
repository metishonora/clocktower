import type { CoreAdapter } from "./core/coreAdapter";
import type { CompatibleWebSessionStorage } from "./webSessionStorage";
import type { SnvPresentation, SnvSetupDraft } from "./sectsAndVioletsGame";
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
  storageDriver?: CompatibleWebSessionStorage<SnvSetupDraft, SnvPresentation>;
} = {}) {
  return (
    <SectsAndVioletsGameSurface
      coreAdapter={coreAdapter}
      storageDriver={storageDriver}
    />
  );
}

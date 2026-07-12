import { equal } from "node:assert/strict";
import test from "node:test";
import { setupFormBusy } from "./setupReadiness.js";

test("setup controls stay usable while setup hint counts are still loading", () => {
  equal(
    setupFormBusy({
      commandBusy: false,
      storageReady: true,
    }),
    false,
  );
});

test("setup controls are disabled while storage or a command is busy", () => {
  equal(
    setupFormBusy({
      commandBusy: false,
      storageReady: false,
    }),
    true,
  );
  equal(
    setupFormBusy({
      commandBusy: true,
      storageReady: true,
    }),
    true,
  );
});

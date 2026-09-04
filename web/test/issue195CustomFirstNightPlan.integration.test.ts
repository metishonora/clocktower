import { describe, expect, it } from "vitest";

import { customFirstNightPlan } from "../src/core/wasmClient.js";

describe("Issue #195 custom first-night read-only WASM contract", () => {
  it("returns the same typed semantic action order exposed by the Rust boundary", async () => {
    const result = await customFirstNightPlan({
      id: "mixed",
      name: "Mixed",
      characterIds: ["philosopher", "poisoner", "imp"],
    });

    expect(result).toEqual({
      ok: true,
      value: {
        source: "default",
        plan: [
          { kind: "system", actionId: "dusk" },
          { kind: "character", characterId: "philosopher", actionId: "chooseAbility" },
          { kind: "system", actionId: "minionInfo" },
          { kind: "system", actionId: "demonInfo" },
          { kind: "character", characterId: "poisoner", actionId: "choosePoisonTarget" },
          { kind: "system", actionId: "dawn" },
        ],
      },
    });
  });
});

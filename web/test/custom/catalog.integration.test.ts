import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { customScriptCharacters } from "../../src/custom/characterCatalog";
import { customScriptCatalog } from "../../src/custom/core/wasmClient";

beforeAll(() => {
  const wasm = readFileSync(resolve(
    process.cwd(),
    "src/generated/clocktower_custom_wasm/clocktower_custom_wasm_bg.wasm",
  ));
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).endsWith("clocktower_custom_wasm_bg.wasm")) {
      return new Response(wasm, { headers: { "Content-Type": "application/wasm" } });
    }
    throw new Error(`unexpected fetch: ${String(input)}`);
  }));
});

afterAll(() => vi.unstubAllGlobals());

test("generated WASM and TypeScript expose the same custom Character IDs and kinds", async () => {
  expect(await customScriptCatalog()).toEqual(customScriptCharacters);
});

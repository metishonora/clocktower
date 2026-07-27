import { equal, notEqual } from "node:assert/strict";
import test from "node:test";
import type { GameFile } from "./types.js";
import { memoizeLatestJsonRequest, serializeReplayRequest } from "./latestJsonRequestCache.js";

test("consecutive structurally identical requests reuse the latest replay result", async () => {
  let requestCount = 0;
  const request = memoizeLatestJsonRequest(async (serializedInput: string) => {
    requestCount += 1;
    return { serializedInput, requestCount };
  });
  const firstInput = { game: { updatedAt: "one", events: [{ id: "event-1" }] } };

  const first = request(firstInput);
  const duplicate = request(structuredClone(firstInput));

  equal(first, duplicate);
  equal((await duplicate).requestCount, 1);
  equal(requestCount, 1);

  const changed = request({ game: { updatedAt: "two", events: [{ id: "event-1" }] } });
  notEqual(changed, first);
  equal((await changed).requestCount, 2);
  equal(requestCount, 2);
});

test("a rejected request is not retained as the latest replay result", async () => {
  let requestCount = 0;
  const request = memoizeLatestJsonRequest(async () => {
    requestCount += 1;
    if (requestCount === 1) throw new Error("temporary failure");
    return requestCount;
  });
  const input = { game: { updatedAt: "one", events: [] } };

  await request(input).catch(() => undefined);

  equal(await request(input), 2);
  equal(requestCount, 2);
});

test("a replay cache can ignore UI-only and timestamp changes", async () => {
  let requestCount = 0;
  const request = memoizeLatestJsonRequest(
    async (serializedInput: string) => {
      requestCount += 1;
      return { serializedInput, requestCount };
    },
    serializeReplayRequest,
  );
  const firstInput = {
    schemaVersion: 3,
    ui: { sectsAndVioletsSession: undefined },
    game: {
      scriptId: "sectsAndViolets",
      id: "game-1",
      name: "first name",
      createdAt: "created",
      updatedAt: "one",
      events: [],
    },
  } satisfies GameFile;
  const first = request(firstInput);
  const uiOnlyChange = request({
    ...firstInput,
    ui: undefined,
    game: { ...firstInput.game, name: "renamed", updatedAt: "two" },
  });

  equal(first, uiOnlyChange);
  equal((await uiOnlyChange).requestCount, 1);
  equal(requestCount, 1);
});

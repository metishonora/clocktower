import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";
import { IDBFactory } from "fake-indexeddb";

beforeEach(() => {
  Object.defineProperty(globalThis, "indexedDB", {
    configurable: true,
    value: new IDBFactory(),
  });
});

afterEach(() => {
  cleanup();
});

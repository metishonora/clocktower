import { beforeEach } from "vitest";
import { IDBFactory } from "fake-indexeddb";
beforeEach(() => { Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: new IDBFactory() }); });

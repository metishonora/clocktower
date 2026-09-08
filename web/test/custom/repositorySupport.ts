import { IndexedDbCustomScriptRepository } from "../../src/custom/storage/definitionRepository.js";

// Unit tests isolate persistence behavior; real-WASM integration tests cover domain validation.
export function createTestCustomScriptRepository(idb: IDBFactory): IndexedDbCustomScriptRepository {
  return new IndexedDbCustomScriptRepository(idb, async () => () => { });
}

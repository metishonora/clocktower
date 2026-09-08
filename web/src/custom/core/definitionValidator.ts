import type { CustomScriptDefinition } from "./types.js";

/** Prepared synchronous validation keeps WASM initialization outside IndexedDB transactions. */
export type CustomDefinitionValidator = (definition: CustomScriptDefinition) => void;
export type LoadCustomDefinitionValidator = () => Promise<CustomDefinitionValidator>;

import { equal } from "node:assert/strict";
import test from "node:test";
import type { Command, GameEvent, ScriptReference } from "./types.js";
import {
  commandDiscriminators,
  eventDiscriminators,
  scriptReferenceDiscriminators,
} from "./wireDiscriminators.js";

type Equal<Left, Right> =
  (<Type>() => Type extends Left ? 1 : 2) extends
  (<Type>() => Type extends Right ? 1 : 2) ? true : false;

const commandTypeParity: Equal<(typeof commandDiscriminators)[number], Command["type"]> = true;
const eventTypeParity: Equal<(typeof eventDiscriminators)[number], GameEvent["type"]> = true;
const scriptReferenceTypeParity: Equal<
  (typeof scriptReferenceDiscriminators)[number],
  ScriptReference["type"]
> = true;

test("generated wire discriminator mirrors cover the TypeScript command and event unions", () => {
  equal(commandTypeParity, true);
  equal(eventTypeParity, true);
  equal(scriptReferenceTypeParity, true);
});

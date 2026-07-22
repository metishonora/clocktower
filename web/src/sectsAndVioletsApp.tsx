import { SectsAndVioletsFoundation } from "./sectsAndVioletsFoundationPrototype";
import { wasmCoreAdapter } from "./core/wasmClient";

export function SectsAndVioletsApp() {
  return <SectsAndVioletsFoundation coreAdapter={wasmCoreAdapter} production />;
}

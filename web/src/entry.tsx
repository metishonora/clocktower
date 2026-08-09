import React from "react";
import { createRoot } from "react-dom/client";
import { wasmCoreAdapter } from "./core/wasmClient";
import { IndexedDbWebSessionStorageDriver } from "./webSessionStorage";
import { TROUBLE_BREWING } from "./core/scripts";
import type { TbSessionPresentation } from "./gameStore";
import type { SetupDraft } from "./setupDraft";
import { App } from "./main";
import { registerSW } from "virtual:pwa-register";

const storageDriver = new IndexedDbWebSessionStorageDriver<SetupDraft, TbSessionPresentation>(
  TROUBLE_BREWING,
);
registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App scriptId={TROUBLE_BREWING} coreAdapter={wasmCoreAdapter} storageDriver={storageDriver} />
  </React.StrictMode>,
);

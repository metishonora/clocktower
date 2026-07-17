import React from "react";
import { createRoot } from "react-dom/client";
import { wasmCoreAdapter } from "./core/wasmClient";
import { IndexedDbGameStorageDriver } from "./gameStorage";
import { App } from "./main";
import { registerSW } from "virtual:pwa-register";

const storageDriver = new IndexedDbGameStorageDriver();
registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App coreAdapter={wasmCoreAdapter} storageDriver={storageDriver} />
  </React.StrictMode>,
);

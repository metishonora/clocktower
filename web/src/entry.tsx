import React from "react";
import { createRoot } from "react-dom/client";
import { wasmCoreAdapter } from "./core/wasmClient";
import { IndexedDbGameStorageDriver } from "./gameStorage";
import { App } from "./main";

const storageDriver = new IndexedDbGameStorageDriver();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App coreAdapter={wasmCoreAdapter} storageDriver={storageDriver} />
  </React.StrictMode>,
);

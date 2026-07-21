import React from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { ScriptLanding } from "./features/script-selection/ScriptLanding";

registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ScriptLanding />
  </React.StrictMode>,
);

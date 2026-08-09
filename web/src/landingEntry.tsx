import React from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { ScriptLanding } from "./features/script-selection/ScriptLanding";
import { isPromoCardSampleRequest } from "./promoCardPrototypeRoute";

registerSW({ immediate: true });

const DevPromoCardPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./promoCardPrototype");
      return { default: module.PromoCardPrototype };
    })
  : undefined;

const promoCardRequested =
  DevPromoCardPrototype && isPromoCardSampleRequest(window.location);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {promoCardRequested ? (
      <React.Suspense fallback={null}>
        <DevPromoCardPrototype />
      </React.Suspense>
    ) : (
      <ScriptLanding />
    )}
  </React.StrictMode>,
);

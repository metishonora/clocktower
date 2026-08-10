import React from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { ScriptLanding } from "./features/script-selection/ScriptLanding";
import {
  isPromoCardProductionRequest,
  resolvePromoCardDesign,
  resolvePromoCardRoute,
} from "./promoCardPrototypeRoute";

registerSW({ immediate: true });

const PromoCardPrototypeEntry = React.lazy(async () => {
  const module = await import("./promoCardPrototype");
  return { default: module.PromoCardPrototype };
});

const productionPromoCardRequested = isPromoCardProductionRequest(window.location);
const devPromoCardRoute = !productionPromoCardRequested && import.meta.env.DEV
  ? resolvePromoCardRoute(window.location)
  : undefined;
const promoCardRoute = productionPromoCardRequested
  ? "trouble-brewing"
  : devPromoCardRoute;
const promoCardDesign = productionPromoCardRequested
  ? "vellum"
  : promoCardRoute === "trouble-brewing"
    ? resolvePromoCardDesign(window.location)
    : undefined;
const promoCardRequested = productionPromoCardRequested || Boolean(devPromoCardRoute);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {promoCardRequested && promoCardRoute ? (
      <React.Suspense fallback={null}>
        <PromoCardPrototypeEntry
          variant={promoCardRoute}
          design={promoCardDesign}
          idleGlowHint={promoCardRoute === "trouble-brewing"}
        />
      </React.Suspense>
    ) : (
      <ScriptLanding />
    )}
  </React.StrictMode>,
);

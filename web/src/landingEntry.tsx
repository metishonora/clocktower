import React from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { ScriptLanding } from "./features/script-selection/ScriptLanding";
import {
  resolvePromoCardDesign,
  resolvePromoCardProductionRoute,
  resolvePromoCardRoute,
} from "./promoCardPrototypeRoute";

registerSW({ immediate: true });

const PromoCardPrototypeEntry = React.lazy(async () => {
  const module = await import("./promoCardPrototype");
  return { default: module.PromoCardPrototype };
});

const productionPromoCardRoute = resolvePromoCardProductionRoute(window.location);
const devPromoCardRoute = !productionPromoCardRoute && import.meta.env.DEV
  ? resolvePromoCardRoute(window.location)
  : undefined;
const promoCardRoute = productionPromoCardRoute ?? devPromoCardRoute;
const promoCardDesign = productionPromoCardRoute
  ? "vellum"
  : promoCardRoute === "trouble-brewing"
    ? resolvePromoCardDesign(window.location)
    : promoCardRoute === "sects-and-violets"
      ? "vellum"
    : undefined;
const promoCardRequested = Boolean(productionPromoCardRoute || devPromoCardRoute);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {promoCardRequested && promoCardRoute ? (
      <React.Suspense fallback={null}>
        <PromoCardPrototypeEntry
          variant={promoCardRoute}
          design={promoCardDesign}
          idleGlowHint={promoCardRoute !== "sample"}
        />
      </React.Suspense>
    ) : (
      <ScriptLanding />
    )}
  </React.StrictMode>,
);

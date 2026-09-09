import React from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { CustomScenarioLanding } from "./customScenarioLanding";
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

const DevIssue200CustomScriptPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./issue200CustomScriptPrototype");
      return { default: module.Issue200CustomScriptPrototype };
    })
  : undefined;

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
const issue200PrototypeRequested =
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).get("prototype") === "issue-200-custom-script";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {issue200PrototypeRequested && DevIssue200CustomScriptPrototype ? (
      <React.Suspense fallback={null}>
        <DevIssue200CustomScriptPrototype />
      </React.Suspense>
    ) : promoCardRequested && promoCardRoute ? (
      <React.Suspense fallback={null}>
        <PromoCardPrototypeEntry
          variant={promoCardRoute}
          design={promoCardDesign}
          idleGlowHint={promoCardRoute !== "sample"}
        />
      </React.Suspense>
    ) : (
      <CustomScenarioLanding />
    )}
  </React.StrictMode>,
);

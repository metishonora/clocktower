import React from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { ScriptLanding } from "./features/script-selection/ScriptLanding";
import {
  resolveExpiredInvitationPrototypeRoute,
  resolvePromoCardDesign,
  resolvePromoCardProductionRoute,
  resolvePromoCardRoute,
} from "./promoCardPrototypeRoute";

registerSW({ immediate: true });

const PromoCardPrototypeEntry = React.lazy(async () => {
  const module = await import("./promoCardPrototype");
  return { default: module.PromoCardPrototype };
});

const ExpiredInvitationPrototypeEntry = React.lazy(async () => {
  const module = await import("./expiredInvitationPrototype");
  return { default: module.ExpiredInvitationPrototype };
});

const productionPromoCardRoute = resolvePromoCardProductionRoute(window.location);
const devExpiredInvitationRoute = !productionPromoCardRoute && import.meta.env.DEV
  ? resolveExpiredInvitationPrototypeRoute(window.location)
  : undefined;
const expiredInvitationRoute = productionPromoCardRoute ?? devExpiredInvitationRoute;
const devPromoCardRoute = !expiredInvitationRoute && import.meta.env.DEV
  ? resolvePromoCardRoute(window.location)
  : undefined;
const promoCardRoute = devPromoCardRoute;
const promoCardDesign = promoCardRoute === "trouble-brewing"
    ? resolvePromoCardDesign(window.location)
    : promoCardRoute === "sects-and-violets"
      ? "vellum"
    : undefined;
const promoCardRequested = Boolean(devPromoCardRoute);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {expiredInvitationRoute ? (
      <React.Suspense fallback={null}>
        <ExpiredInvitationPrototypeEntry variant={expiredInvitationRoute} />
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
      <ScriptLanding />
    )}
  </React.StrictMode>,
);

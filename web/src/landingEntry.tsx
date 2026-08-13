import React from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { ScriptLanding } from "./features/script-selection/ScriptLanding";
import {
  isPublishedPromoCardSampleRequest,
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
const publishedSampleRequested = !productionPromoCardRoute
  && isPublishedPromoCardSampleRequest(window.location);
const devExpiredInvitationRoute = !productionPromoCardRoute && !publishedSampleRequested && import.meta.env.DEV
  ? resolveExpiredInvitationPrototypeRoute(window.location)
  : undefined;
const expiredInvitationRoute = productionPromoCardRoute ?? devExpiredInvitationRoute;
const devPromoCardRoute = !expiredInvitationRoute && !publishedSampleRequested && import.meta.env.DEV
  ? resolvePromoCardRoute(window.location)
  : undefined;
const promoCardRoute = publishedSampleRequested ? "trouble-brewing" : devPromoCardRoute;
const promoCardDesign = promoCardRoute === "trouble-brewing"
    ? resolvePromoCardDesign(window.location)
    : promoCardRoute === "sects-and-violets"
      ? "vellum"
    : undefined;
const promoCardRequested = Boolean(publishedSampleRequested || devPromoCardRoute);

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
          hideDateAndPlace={publishedSampleRequested}
        />
      </React.Suspense>
    ) : (
      <ScriptLanding />
    )}
  </React.StrictMode>,
);

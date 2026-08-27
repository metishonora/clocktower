import React from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { ScriptLanding } from "./features/script-selection/ScriptLanding";
import {
  isPublishedPromoCardSampleRequest,
  resolveActivePromoCardProductionRoute,
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

const expiredProductionPromoCardRoute = resolvePromoCardProductionRoute(window.location);
const activeProductionPromoCardRoute = resolveActivePromoCardProductionRoute(window.location);
const publishedSampleRequested = !expiredProductionPromoCardRoute
  && !activeProductionPromoCardRoute
  && isPublishedPromoCardSampleRequest(window.location);
const devExpiredInvitationRoute = !expiredProductionPromoCardRoute
  && !activeProductionPromoCardRoute
  && !publishedSampleRequested
  && import.meta.env.DEV
  ? resolveExpiredInvitationPrototypeRoute(window.location)
  : undefined;
const expiredInvitationRoute = expiredProductionPromoCardRoute ?? devExpiredInvitationRoute;
const devPromoCardRoute = !expiredInvitationRoute
  && !activeProductionPromoCardRoute
  && !publishedSampleRequested
  && import.meta.env.DEV
  ? resolvePromoCardRoute(window.location)
  : undefined;
const promoCardRoute = publishedSampleRequested
  ? "trouble-brewing"
  : activeProductionPromoCardRoute ?? devPromoCardRoute;
const promoCardDesign = promoCardRoute === "trouble-brewing"
    ? resolvePromoCardDesign(window.location)
    : promoCardRoute === "sects-and-violets"
      ? "vellum"
    : undefined;
const promoCardRequested = Boolean(
  publishedSampleRequested || activeProductionPromoCardRoute || devPromoCardRoute,
);
const is260923Invitation = promoCardRoute === "sects-and-violets"
  && (activeProductionPromoCardRoute === "sects-and-violets"
    || (import.meta.env.DEV
      && new URLSearchParams(window.location.search).get("prototype") === "260923"));
const promoCardDateOverride = is260923Invitation
    ? "날짜: 26년 9월 23일(수)"
    : undefined;

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
          hideAcceptanceLink={publishedSampleRequested}
          dateOverride={promoCardDateOverride}
          headingOverride={promoCardDateOverride ? "광기가 피어나는 마을로 여러분을 초대합니다." : undefined}
          headingLinesOverride={promoCardDateOverride
            ? ["광기가 피어나는 마을로", "여러분을 초대합니다."]
            : undefined}
          timeOverride={promoCardDateOverride ? "시간: 19:00~" : undefined}
          placeOverride={promoCardDateOverride ? "장소: 추후 협의" : undefined}
          hideGameName={Boolean(promoCardDateOverride)}
          hideGenre={Boolean(promoCardDateOverride)}
          spaciousCopy={Boolean(promoCardDateOverride)}
          showVioletStamp={Boolean(promoCardDateOverride)}
          openHint={promoCardDateOverride ? "초대장을 확인해보세요" : undefined}
          idleGlowDelayMs={promoCardDateOverride ? 1000 : undefined}
        />
      </React.Suspense>
    ) : (
      <ScriptLanding />
    )}
  </React.StrictMode>,
);

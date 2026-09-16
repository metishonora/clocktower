import React from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { CustomScenarioLanding } from "./customScenarioLanding";
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

const DevIssue200CustomScriptPrototype = import.meta.env.DEV
  ? React.lazy(async () => {
      const module = await import("./issue200CustomScriptPrototype");
      return { default: module.Issue200CustomScriptPrototype };
    })
  : undefined;

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
const issue200PrototypeRequested =
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).get("prototype") === "issue-200-custom-script";
const promoCardRequested = Boolean(
  publishedSampleRequested || activeProductionPromoCardRoute || devPromoCardRoute,
);
const invitationPathname = window.location.pathname.replace(/\/+$/, "");
const is260923Invitation = promoCardRoute === "sects-and-violets"
  && ((activeProductionPromoCardRoute === "sects-and-violets"
    && (invitationPathname.endsWith("/invitation/260923")
      || invitationPathname.endsWith("/invitation/260923-2")))
    || (!activeProductionPromoCardRoute && import.meta.env.DEV
      && new URLSearchParams(window.location.search).get("prototype") === "260923"));
const is260921Invitation = promoCardRoute === "sects-and-violets"
  && ((activeProductionPromoCardRoute === "sects-and-violets"
    && invitationPathname.endsWith("/invitation/260921"))
    || (!activeProductionPromoCardRoute && import.meta.env.DEV
      && new URLSearchParams(window.location.search).get("prototype") === "260921"));
const promoCardDateOverride = is260923Invitation
    ? "날짜: 26년 9월 23일(수)"
    : is260921Invitation ? "날짜: 26년 9월 21일 (월)" : undefined;

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {issue200PrototypeRequested && DevIssue200CustomScriptPrototype ? (
      <React.Suspense fallback={null}>
        <DevIssue200CustomScriptPrototype />
      </React.Suspense>
    ) : expiredInvitationRoute ? (
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
          headingOverride={is260921Invitation
            ? "뒤엉키는 진실 속에서 당신의 믿음을 시험합니다."
            : promoCardDateOverride ? "광기가 피어나는 마을로 여러분을 초대합니다." : undefined}
          headingLinesOverride={is260921Invitation
            ? ["뒤엉키는 진실 속에서", "당신의 믿음을 시험합니다."]
            : promoCardDateOverride
            ? ["광기가 피어나는 마을로", "여러분을 초대합니다."]
            : undefined}
          timeOverride={is260921Invitation ? "시간: 18:00~" : promoCardDateOverride ? "시간: 19:00~" : undefined}
          placeOverride={is260921Invitation
            ? "장소: 삼성사옥 1층 회의실"
            : promoCardDateOverride ? "장소: 추후 협의" : undefined}
          runtimeOverride={is260921Invitation ? "예상 런타임: 2~3시간" : undefined}
          compactHeading={is260921Invitation}
          hideGameName={Boolean(promoCardDateOverride)}
          hideGenre={Boolean(promoCardDateOverride)}
          hideCapacity={is260921Invitation}
          spaciousCopy={Boolean(promoCardDateOverride)}
          showVioletStamp={is260923Invitation}
          showEntangledStaffStamp={is260921Invitation}
          openHint={promoCardDateOverride ? "초대장을 확인해보세요" : undefined}
          idleGlowDelayMs={promoCardDateOverride ? 1000 : undefined}
        />
      </React.Suspense>
    ) : (
      <CustomScenarioLanding />
    )}
  </React.StrictMode>,
);

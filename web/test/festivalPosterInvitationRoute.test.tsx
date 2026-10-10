import { describe, expect, test } from "vitest";
import { isFestivalPosterInvitationRequest } from "../src/festivalPosterInvitationRoute";
import {
  resolveActivePromoCardProductionRoute,
  resolvePromoCardProductionRoute,
} from "../src/promoCardPrototypeRoute";

describe("261016 festival poster invitation route", () => {
  test.each([
    "/invitation/261016",
    "/invitation/261016/",
    "/clocktower/invitation/261016",
    "/clocktower/invitation/261016/",
  ])("matches %s", (pathname) => {
    expect(isFestivalPosterInvitationRequest({ pathname })).toBe(true);
  });

  test.each([
    "/clocktower/invitation/2610160",
    "/clocktower/invitation/260923",
    "/clocktower/invitation/sample",
    "/clocktower/",
  ])("does not match %s", (pathname) => {
    expect(isFestivalPosterInvitationRequest({ pathname })).toBe(false);
  });

  test("stays independent of the wax-seal invitation routes", () => {
    const location = { pathname: "/clocktower/invitation/261016/", search: "" };
    expect(resolvePromoCardProductionRoute(location)).toBeUndefined();
    expect(resolveActivePromoCardProductionRoute(location)).toBeUndefined();
  });
});

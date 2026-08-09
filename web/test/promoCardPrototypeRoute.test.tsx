import { describe, expect, test } from "vitest";
import { isPromoCardSampleRequest } from "../src/promoCardPrototypeRoute";

describe("promo card sample route", () => {
  test.each([
    "/invitation/sample",
    "/invitation/sample/",
    "/clocktower/invitation/sample",
    "/clocktower/invitation/sample/",
  ])("matches the extensionless sample path %s", (pathname) => {
    expect(isPromoCardSampleRequest({ pathname, search: "" })).toBe(true);
  });

  test.each([
    "/invitation/sample.html",
    "/clocktower/invitation",
    "/clocktower/invitation/other",
  ])("does not match another path %s", (pathname) => {
    expect(isPromoCardSampleRequest({ pathname, search: "" })).toBe(false);
  });

  test("keeps the existing query link as a compatibility alias", () => {
    expect(isPromoCardSampleRequest({ pathname: "/clocktower/", search: "?prototype=promo-card" })).toBe(true);
  });
});

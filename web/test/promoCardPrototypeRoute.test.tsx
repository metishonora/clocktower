import { describe, expect, test } from "vitest";
import {
  isPromoCardSampleRequest,
  isPromoCardProductionRequest,
  resolvePromoCardDesign,
  resolvePromoCardProductionRoute,
  resolvePromoCardRoute,
} from "../src/promoCardPrototypeRoute";

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

  test("preserves a custom deployment base before the sample suffix", () => {
    expect(isPromoCardSampleRequest({ pathname: "/custom-base/invitation/sample/", search: "" })).toBe(true);
  });

  test("keeps the existing query link as a compatibility alias", () => {
    expect(isPromoCardSampleRequest({ pathname: "/clocktower/", search: "?prototype=promo-card" })).toBe(true);
    expect(resolvePromoCardRoute({ pathname: "/clocktower/", search: "?prototype=promo-card" })).toBe("sample");
  });

  test.each([
    "/invitation/trouble-brewing",
    "/invitation/trouble-brewing/",
    "/clocktower/invitation/trouble-brewing",
    "/clocktower/invitation/trouble-brewing/",
  ])("matches the extensionless Trouble Brewing path %s", (pathname) => {
    expect(resolvePromoCardRoute({ pathname, search: "" })).toBe("trouble-brewing");
  });

  test.each([
    "/invitation/trouble-brewing.html",
    "/clocktower/invitation/trouble-brewing.html",
    "/clocktower/invitation/trouble-brewing-other",
  ])("does not match another Trouble Brewing path %s", (pathname) => {
    expect(resolvePromoCardRoute({ pathname, search: "" })).toBeUndefined();
  });

  test.each([
    "/invitation/sects-and-violets",
    "/invitation/sects-and-violets/",
    "/clocktower/invitation/sects-and-violets",
    "/clocktower/invitation/sects-and-violets/",
  ])("matches the extensionless Sects & Violets prototype path %s", (pathname) => {
    expect(resolvePromoCardRoute({ pathname, search: "" })).toBe("sects-and-violets");
  });

  test.each([
    "/invitation/260813",
    "/invitation/260813/",
    "/clocktower/invitation/260813",
    "/clocktower/invitation/260813/",
  ])("matches the Sects & Violets production invitation path %s", (pathname) => {
    expect(resolvePromoCardProductionRoute({ pathname, search: "" })).toBe("sects-and-violets");
    expect(isPromoCardProductionRequest({ pathname, search: "" })).toBe(true);
  });

  test.each([
    "/invitation/260816",
    "/invitation/260816/",
    "/clocktower/invitation/260816",
    "/clocktower/invitation/260816/",
  ])("matches the production invitation path %s", (pathname) => {
    expect(resolvePromoCardProductionRoute({ pathname, search: "" })).toBe("trouble-brewing");
    expect(isPromoCardProductionRequest({ pathname, search: "" })).toBe(true);
  });

  test.each([
    "/invitation/260816.html",
    "/invitation/260813.html",
    "/clocktower/invitation/260816-other",
    "/clocktower/invitation/260813/extra",
    "/clocktower/invitation/260816/extra",
    "/clocktower/invitation/sects-and-violets.html",
  ])("does not match another production invitation path %s", (pathname) => {
    expect(resolvePromoCardProductionRoute({ pathname, search: "" })).toBeUndefined();
    expect(isPromoCardProductionRequest({ pathname, search: "" })).toBe(false);
  });

  test.each([
    ["vellum", "vellum"],
    ["chancery", "chancery"],
    ["rag-paper", "rag-paper"],
  ])("resolves the TB letter design query %s", (query, design) => {
    expect(
      resolvePromoCardDesign({
        pathname: "/clocktower/invitation/trouble-brewing",
        search: `?design=${query}`,
      }),
    ).toBe(design);
  });

  test.each(["", "?design=unknown", "?design=vellum&design=unknown", "?design=archive"])(
    "falls back to the vellum design for %s",
    (search) => {
      expect(
        resolvePromoCardDesign({
          pathname: "/clocktower/invitation/trouble-brewing",
          search,
        }),
      ).toBe("vellum");
    },
  );
});

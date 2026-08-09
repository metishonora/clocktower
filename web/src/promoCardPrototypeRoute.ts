type LocationLike = Pick<Location, "pathname" | "search">;

export type PromoCardRoute = "sample" | "trouble-brewing";
export type PromoCardDesign = "vellum" | "chancery" | "rag-paper";

const PROMO_CARD_DESIGNS: readonly PromoCardDesign[] = [
  "vellum",
  "chancery",
  "rag-paper",
];

const ROUTE_PATHS: Record<PromoCardRoute, readonly string[]> = {
  sample: ["/invitation/sample", "/clocktower/invitation/sample"],
  "trouble-brewing": [
    "/invitation/trouble-brewing",
    "/clocktower/invitation/trouble-brewing",
  ],
};

const PRODUCTION_INVITATION_PATHS = [
  "/invitation/260816",
  "/clocktower/invitation/260816",
] as const;

function normalizePathname(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, "");
  return normalized || "/";
}

export function resolvePromoCardRoute(
  location: LocationLike,
): PromoCardRoute | undefined {
  const pathname = normalizePathname(location.pathname);

  if (new URLSearchParams(location.search).get("prototype") === "promo-card") {
    return "sample";
  }

  if (pathname.endsWith("/invitation/sample")) return "sample";

  for (const [route, paths] of Object.entries(ROUTE_PATHS) as [
    PromoCardRoute,
    readonly string[],
  ][]) {
    if (paths.includes(pathname)) return route;
  }

  return undefined;
}

export function isPromoCardProductionRequest(location: LocationLike): boolean {
  return PRODUCTION_INVITATION_PATHS.includes(
    normalizePathname(location.pathname) as (typeof PRODUCTION_INVITATION_PATHS)[number],
  );
}

export function isPromoCardSampleRequest(location: LocationLike): boolean {
  return resolvePromoCardRoute(location) === "sample";
}

export function resolvePromoCardDesign(
  location: LocationLike,
): PromoCardDesign {
  if (resolvePromoCardRoute(location) !== "trouble-brewing") {
    return "vellum";
  }

  const designValues = new URLSearchParams(location.search).getAll("design");
  if (designValues.length !== 1) return "vellum";

  const [design] = designValues;
  return PROMO_CARD_DESIGNS.includes(design as PromoCardDesign)
    ? (design as PromoCardDesign)
    : "vellum";
}

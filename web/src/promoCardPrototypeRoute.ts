type LocationLike = Pick<Location, "pathname" | "search">;

export type PromoCardRoute = "sample" | "trouble-brewing" | "sects-and-violets";
export type PromoCardProductionRoute = Exclude<PromoCardRoute, "sample">;
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
  "sects-and-violets": [
    "/invitation/sects-and-violets",
    "/clocktower/invitation/sects-and-violets",
  ],
};

const PRODUCTION_INVITATION_PATHS: Record<
  PromoCardProductionRoute,
  readonly string[]
> = {
  "trouble-brewing": [
    "/invitation/260816",
    "/clocktower/invitation/260816",
  ],
  "sects-and-violets": [
    "/invitation/260813",
    "/clocktower/invitation/260813",
  ],
};

const EXPIRED_INVITATION_PROTOTYPE_PATHS: Record<
  Exclude<PromoCardRoute, "sample">,
  readonly string[]
> = {
  "trouble-brewing": [
    "/invitation/expired/trouble-brewing",
    "/clocktower/invitation/expired/trouble-brewing",
  ],
  "sects-and-violets": [
    "/invitation/expired/sects-and-violets",
    "/clocktower/invitation/expired/sects-and-violets",
  ],
};

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

export function resolvePromoCardProductionRoute(
  location: LocationLike,
): PromoCardProductionRoute | undefined {
  const pathname = normalizePathname(location.pathname);

  for (const [route, paths] of Object.entries(PRODUCTION_INVITATION_PATHS) as [
    PromoCardProductionRoute,
    readonly string[],
  ][]) {
    if (paths.includes(pathname)) return route;
  }

  return undefined;
}

/**
 * Development-only review paths for the discarded, already-open invitation
 * state. Production date routes intentionally do not pass through here.
 */
export function resolveExpiredInvitationPrototypeRoute(
  location: LocationLike,
): Exclude<PromoCardRoute, "sample"> | undefined {
  const pathname = normalizePathname(location.pathname);

  for (const [route, paths] of Object.entries(EXPIRED_INVITATION_PROTOTYPE_PATHS) as [
    Exclude<PromoCardRoute, "sample">,
    readonly string[],
  ][]) {
    if (paths.includes(pathname)) return route;
  }

  return undefined;
}

export function isPromoCardProductionRequest(location: LocationLike): boolean {
  return resolvePromoCardProductionRoute(location) !== undefined;
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

type LocationLike = Pick<Location, "pathname" | "search">;

const SAMPLE_ROUTE_SUFFIX = "/invitation/sample";

export function isPromoCardSampleRequest(location: LocationLike): boolean {
  const pathname = location.pathname.replace(/\/+$/, "");
  return (
    pathname.endsWith(SAMPLE_ROUTE_SUFFIX) ||
    new URLSearchParams(location.search).get("prototype") === "promo-card"
  );
}

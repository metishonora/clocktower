type LocationLike = Pick<Location, "pathname">;

const FESTIVAL_POSTER_INVITATION_SUFFIX = "/invitation/261016";

export function isFestivalPosterInvitationRequest(location: LocationLike): boolean {
  return location.pathname.replace(/\/+$/, "").endsWith(FESTIVAL_POSTER_INVITATION_SUFFIX);
}

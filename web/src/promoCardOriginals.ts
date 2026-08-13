import letterChanceryTextureUrl from "./assets/promo/letter-parchment-sheepskin-v1.jpg";
import letterRagTextureUrl from "./assets/promo/letter-rag-paper-v1.jpg";
import letterVellumTextureUrl from "./assets/promo/letter-vellum-calfskin-v1.jpg";
import waxSealSnvUrl from "./assets/promo/wax-seal-snv.png";
import waxSealTbUrl from "./assets/promo/wax-seal-tb.png";
import type { PromoCardDesign } from "./promoCardPrototypeRoute";

export type InvitationOriginalVariant = "trouble-brewing" | "sects-and-violets";

export type InvitationOriginal = {
  from: string;
  heading: string;
  headingLines: readonly [string, string];
  gameName: string;
  genre: string;
  capacity: string;
  date: string;
  time: string;
  place: string;
  runtime: string;
  letterTextures: Record<PromoCardDesign, string>;
  sealUrl: string;
};

const LETTER_TEXTURES: Record<PromoCardDesign, string> = {
  vellum: letterVellumTextureUrl,
  chancery: letterChanceryTextureUrl,
  "rag-paper": letterRagTextureUrl,
};

/**
 * The approved, unopened invitation copy and asset pairings. Keeping this
 * data separate lets an invitation be reused after the public page moves to a
 * later state, without recovering its copy from a historical deployment.
 */
export const INVITATION_ORIGINALS: Record<
  InvitationOriginalVariant,
  InvitationOriginal
> = {
  "trouble-brewing": {
    from: "From 이야기꾼",
    heading: "밤이 깃든 마을로 여러분을 초대합니다.",
    headingLines: ["밤이 깃든 마을로", "여러분을 초대합니다."],
    gameName: "게임 이름: 시계탑에 흐른 피",
    genre: "장르: 마피아",
    capacity: "정원: 10-15인",
    date: "날짜: 26년 8월 16일(주일)",
    time: "시간: 18:00~",
    place: "장소: 노량진교회",
    runtime: "예상 런타임: 3시간",
    letterTextures: LETTER_TEXTURES,
    sealUrl: waxSealTbUrl,
  },
  "sects-and-violets": {
    from: "From 이야기꾼",
    heading: "뒤엉킨 진실 속으로, 여러분을 다시 한 번 초대합니다.",
    headingLines: ["뒤엉킨 진실 속으로,", "여러분을 다시 한 번 초대합니다."],
    gameName: "게임 이름: 시계탑에 흐른 피",
    genre: "장르: 마피아",
    capacity: "정원: 10-15인",
    date: "날짜: 26년 8월 13일(목)",
    time: "시간: 18:00~",
    place: "장소: 삼성사옥 1층 회의실",
    runtime: "예상 런타임: 3시간",
    letterTextures: LETTER_TEXTURES,
    sealUrl: waxSealSnvUrl,
  },
};

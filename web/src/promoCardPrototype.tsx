import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";
import envelopeTextureUrl from "./assets/promo/envelope-texture-v1.webp";
import letterTextureUrl from "./assets/promo/letter-texture-v1.webp";
import waxSealUrl from "./assets/promo/wax-seal.png";
import {
  INVITATION_ORIGINALS,
  type InvitationOriginalVariant,
} from "./promoCardOriginals";
import type { PromoCardDesign } from "./promoCardPrototypeRoute";
import "./promoCardPrototype.css";

const PROMO_CARD_SIZE = 640;

export type PromoCardVariant = "sample" | InvitationOriginalVariant;

type PromoCardPrototypeProps = {
  variant?: PromoCardVariant;
  design?: PromoCardDesign;
  idleGlowHint?: boolean;
  hideDateAndPlace?: boolean;
  hideAcceptanceLink?: boolean;
};

function renderInkGlyphs(text: string, seedOffset = 0) {
  const graphemes = text.match(/\P{Mark}\p{Mark}*/gu) ?? Array.from(text);
  return graphemes.map((character, index) => {
    const seed = ((index + 1) * 37 + seedOffset * 53) % 997;
    const rotation = ((seed % 11) - 5) * 0.35;
    const scaleX = 0.93 + (seed % 13) * 0.01;
    const scaleY = 0.96 + (Math.floor(seed / 7) % 9) * 0.01;
    const opacity = 0.78 + (seed % 12) * 0.018;
    const baseline = ((seed % 9) - 4) * 0.32;
    const stroke = 0.05 + (seed % 5) * 0.075;
    const bleedX = ((seed % 5) - 2) * 0.16;
    const bleedY = ((Math.floor(seed / 5) % 5) - 2) * 0.12;
    const bleedBlur = 0.25 + (seed % 4) * 0.13;
    const weight = 390 + (seed % 4) * 30;
    return (
      <span
        key={`${seedOffset}-${index}`}
        className="promoGlyph"
        data-glyph={character === " " ? "" : character}
        data-glyph-index={`${seedOffset}-${index}`}
        style={{
          "--glyph-seed": seed,
          "--glyph-rotate": `${rotation}deg`,
          "--glyph-scale-x": scaleX,
          "--glyph-scale-y": scaleY,
          "--glyph-opacity": opacity,
          "--glyph-y": `${baseline}px`,
          "--glyph-stroke": `${stroke}px`,
          "--glyph-bleed-x": `${bleedX}px`,
          "--glyph-bleed-y": `${bleedY}px`,
          "--glyph-bleed-blur": `${bleedBlur}px`,
          "--glyph-weight": weight,
        } as CSSProperties}
      >
        {character === " " ? "\u00a0" : character}
      </span>
    );
  });
}

function renderInkText(text: string, seedOffset = 0) {
  return (
    <>
      <span className="promoInkAccessible">{text}</span>
      <span className="promoInkVisual" aria-hidden="true">
        {renderInkGlyphs(text, seedOffset)}
      </span>
    </>
  );
}

export function PromoCardPrototype({
  variant = "sample",
  design = "vellum",
  idleGlowHint = false,
  hideDateAndPlace = false,
  hideAcceptanceLink = false,
}: PromoCardPrototypeProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [opened, setOpened] = useState(false);
  const isTroubleBrewing = variant === "trouble-brewing";
  const isSectsAndViolets = variant === "sects-and-violets";
  const invitation = variant === "sample" ? undefined : INVITATION_ORIGINALS[variant];
  const isThemedInvitation = Boolean(invitation);
  const themedDesign = invitation ? design : undefined;
  const letterTexture = invitation
    ? invitation.letterTextures[design]
    : letterTextureUrl;
  const sealUrl = invitation?.sealUrl ?? waxSealUrl;
  const invitationDate = hideDateAndPlace ? "날짜: -" : invitation?.date ?? "";
  const invitationPlace = hideDateAndPlace ? "장소: -" : invitation?.place ?? "";

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const updateScale = () => {
      const frameWidth = frame.getBoundingClientRect().width;
      if (frameWidth > 0) setScale(Math.min(1, frameWidth / PROMO_CARD_SIZE));
    };
    const observer = new ResizeObserver(updateScale);

    updateScale();
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  return (
    <main className="promoPrototype" aria-label="홍보 카드 프로토타입">
      {isThemedInvitation ? (
        <svg
          className="promoInkFilterDefs"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <filter
              id="promo-ink-distress"
              colorInterpolationFilters="sRGB"
              x="-4%"
              y="-8%"
              width="108%"
              height="116%"
            >
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.04 0.12"
                numOctaves="2"
                seed="19"
                result="inkNoise"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="inkNoise"
                scale="2.35"
                xChannelSelector="R"
                yChannelSelector="G"
                result="inkEdges"
              />
              <feMorphology in="inkEdges" operator="dilate" radius="0.16" result="inkPool" />
              <feGaussianBlur in="inkPool" stdDeviation="0.38" result="inkBleed" />
              <feComponentTransfer in="inkBleed" result="softInkBleed">
                <feFuncA type="linear" slope="0.34" />
              </feComponentTransfer>
              <feMerge>
                <feMergeNode in="softInkBleed" />
                <feMergeNode in="inkEdges" />
              </feMerge>
            </filter>
          </defs>
        </svg>
      ) : null}
      <div ref={frameRef} className="promoCardFrame">
        <article
          className={[
            "promoCard",
            isThemedInvitation ? "promoCard--tb" : "",
            isSectsAndViolets ? "promoCard--snv" : "",
            themedDesign ? `promoCard--tb-${themedDesign}` : "",
            idleGlowHint ? "hasIdleGlowHint" : "",
            opened ? "isOpen" : "",
          ].filter(Boolean).join(" ")}
          aria-label={opened ? "뜯어진 봉투 속 초대장" : "밀봉된 초대장 봉투"}
          data-promo-design={themedDesign}
          data-promo-variant={isThemedInvitation ? variant : undefined}
          style={{
            "--envelope-texture": `url(${envelopeTextureUrl})`,
            "--letter-texture": `url(${letterTexture})`,
            transform: `scale(${scale})`,
          } as CSSProperties}
        >
          <section
            className="promoLetter"
            aria-label="초대장 본문"
            aria-hidden={!opened}
            data-letter-material={themedDesign}
          >
            <span className="promoLetterRule" aria-hidden="true" />
            <header className="promoLetterHeader">
              {invitation ? (
                <p aria-label="From 이야기꾼">{renderInkText("From 이야기꾼", 1)}</p>
              ) : (
                <p>AN INVITATION AFTER DARK</p>
              )}
            </header>

            <div className={invitation ? "promoLetterCopy promoLetterCopy--tb" : "promoLetterCopy"}>
              {invitation ? (
                <>
                  <h1 aria-label={invitation.heading}>
                    <span className="promoInkAccessible">{invitation.heading}</span>
                    <span className="promoInkVisual" aria-hidden="true">
                      {invitation.headingLines.map((line, index) => (
                        <span className="promoInkLine" key={line}>
                          {renderInkGlyphs(line, index + 2)}
                        </span>
                      ))}
                    </span>
                  </h1>
                  <div className="promoEventDetails" role="group" aria-label="초대 일정">
                    <p aria-label={invitation.gameName}>{renderInkText(invitation.gameName, 4)}</p>
                    <p className="promoGenre" aria-label={invitation.genre}>{renderInkText(invitation.genre, 5)}</p>
                    <p aria-label={invitation.capacity}>{renderInkText(invitation.capacity, 6)}</p>
                    <p aria-label={invitationDate}>{renderInkText(invitationDate, 7)}</p>
                    <p aria-label={invitation.time}>{renderInkText(invitation.time, 8)}</p>
                    <p aria-label={invitationPlace}>{renderInkText(invitationPlace, 9)}</p>
                    <p aria-label={invitation.runtime}>{renderInkText(invitation.runtime, 10)}</p>
                  </div>
                </>
              ) : (
                <>
                  <p className="promoKicker">그날 밤,</p>
                  <h1>
                    당신의 자리가
                    <br />
                    비어 있습니다.
                  </h1>
                  <p className="promoBody">
                    모든 이야기는
                    <br />
                    누군가 문을 여는 순간 시작됩니다.
                  </p>
                </>
              )}
            </div>

            {isTroubleBrewing && opened && !hideAcceptanceLink ? (
              <a
                className="promoAcceptanceLink"
                href="https://invite.kakao.com/tc/bA5MLDMhPD"
                aria-label="초대 수락하기"
              >
                <span>초대 수락하기</span>
              </a>
            ) : null}

            <span className="promoLetterFooter" aria-hidden="true" />
          </section>

          <div
            className={[
              "promoEnvelope",
              isThemedInvitation ? "promoEnvelope--packet" : "",
            ].filter(Boolean).join(" ")}
            aria-hidden="true"
          >
            <span className="promoEnvelopeBase" />
            <span className="promoEnvelopeThroat" />
            <span className="promoEnvelopeTear" />
            <span className="promoEnvelopeFlap" />
            <img className="promoSeal" src={sealUrl} alt="" />
          </div>

          <button
            type="button"
            className="promoOpenTrigger"
            aria-label={opened ? "초대장이 열렸습니다" : "봉투 열기"}
            aria-expanded={opened}
            onClick={() => setOpened(true)}
          />
        </article>
      </div>
    </main>
  );
}

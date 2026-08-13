import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";
import envelopeTextureUrl from "./assets/promo/envelope-texture-v1.webp";
import {
  INVITATION_ORIGINALS,
  type InvitationOriginalVariant,
} from "./promoCardOriginals";
import "./expiredInvitationPrototype.css";

const CARD_SIZE = 640;

export const EXPIRED_INVITATION_NOTICE = "이미 쓰임을 다한 것 같다.";

type ExpiredInvitationPrototypeProps = {
  variant: InvitationOriginalVariant;
};

export function ExpiredInvitationPrototype({
  variant,
}: ExpiredInvitationPrototypeProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const invitation = INVITATION_ORIGINALS[variant];

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const updateScale = () => {
      const width = frame.getBoundingClientRect().width;
      if (width > 0) setScale(Math.min(1, width / CARD_SIZE));
    };

    if (typeof ResizeObserver === "undefined") {
      updateScale();
      return;
    }

    const observer = new ResizeObserver(updateScale);

    updateScale();
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  return (
    <main className="expiredInvitationPrototype" aria-label="폐기된 초대장">
      <div ref={frameRef} className="expiredInvitationFrame">
        <article
          className={`expiredInvitation expiredInvitation--${variant}`}
          aria-label={EXPIRED_INVITATION_NOTICE}
          data-invitation-variant={variant}
          style={{
            "--expired-envelope-texture": `url(${envelopeTextureUrl})`,
            "--expired-letter-texture": `url(${invitation.letterTextures.vellum})`,
            "--expired-seal": `url(${invitation.sealUrl})`,
            transform: `scale(${scale})`,
          } as CSSProperties}
        >
          <span className="expiredInvitation__room" aria-hidden="true" />
          <span className="expiredInvitation__debris" aria-hidden="true" />
          <div className="expiredInvitation__discardedStack" aria-hidden="true">
            <span className="expiredInvitation__packetFlap" />

            <section className="expiredInvitation__letter">
              <span className="expiredInvitation__edge expiredInvitation__edge--top" />
              <span className="expiredInvitation__edge expiredInvitation__edge--bottom" />
              <span className="expiredInvitation__burnHole" />
              <div className="expiredInvitation__details" aria-hidden="true">
                <span className="expiredInvitation__scrawl expiredInvitation__scrawl--short">~~~~~~</span>
                <span className="expiredInvitation__scrawl expiredInvitation__scrawl--title">~~~~~~~~~~~</span>
                <span className="expiredInvitation__scrawl">~~~~~~~  ~~~~~</span>
                <span className="expiredInvitation__scrawl expiredInvitation__scrawl--long">~~~~~~~~~~~~~~</span>
                <span className="expiredInvitation__scrawl">~~~~~  ~~~~~~~~</span>
                <span className="expiredInvitation__scrawl expiredInvitation__scrawl--medium">~~~~~~~~~~</span>
                <span className="expiredInvitation__scrawl expiredInvitation__scrawl--faded">~~~~~~  ~~~~~</span>
              </div>
            </section>

            <span className="expiredInvitation__packet" />
            <span className="expiredInvitation__waxRemnant" />
          </div>

          <p className="expiredInvitation__notice">{EXPIRED_INVITATION_NOTICE}</p>
        </article>
      </div>
    </main>
  );
}

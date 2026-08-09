import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";
import envelopeTextureUrl from "./assets/promo/envelope-texture-v1.webp";
import letterTextureUrl from "./assets/promo/letter-texture-v1.webp";
import waxSealUrl from "./assets/promo/wax-seal.png";
import "./promoCardPrototype.css";

const PROMO_CARD_SIZE = 640;

export function PromoCardPrototype() {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [opened, setOpened] = useState(false);

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
      <div ref={frameRef} className="promoCardFrame">
        <article
          className={`promoCard ${opened ? "isOpen" : ""}`}
          aria-label={opened ? "뜯어진 봉투 속 초대장" : "밀봉된 초대장 봉투"}
          style={{
            "--envelope-texture": `url(${envelopeTextureUrl})`,
            "--letter-texture": `url(${letterTextureUrl})`,
            transform: `scale(${scale})`,
          } as CSSProperties}
        >
          <section className="promoLetter" aria-label="초대장 본문" aria-hidden={!opened}>
          <span className="promoLetterRule" aria-hidden="true" />
          <header className="promoLetterHeader">
            <p>AN INVITATION AFTER DARK</p>
          </header>

          <div className="promoLetterCopy">
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
          </div>

          <span className="promoLetterFooter" aria-hidden="true" />
          </section>

          <div className="promoEnvelope" aria-hidden="true">
            <span className="promoEnvelopeBase" />
            <span className="promoEnvelopeThroat" />
            <span className="promoEnvelopeTear" />
            <span className="promoEnvelopeFlap" />
            <img className="promoSeal" src={waxSealUrl} alt="" />
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

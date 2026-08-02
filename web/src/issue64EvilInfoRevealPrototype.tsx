import { useState } from "react";
import { CharacterIcon } from "./components/CharacterIcon";
import { characterLabel } from "./setupDraft";
import "./issue64EvilInfoRevealPrototype.css";

type Audience = "minion" | "demon";
type PrototypeView = "followup" | "reveal";

type PlayerIdentity = {
  seat: number;
  name: string;
};

const demon: PlayerIdentity = { seat: 5, name: "하린" };
const minions: PlayerIdentity[] = [
  { seat: 4, name: "도윤" },
  { seat: 7, name: "유진" },
];
const bluffCharacterIds = ["librarian", "undertaker", "butler"];

const copy = {
  minion: {
    tab: "하수인 정보",
    operationalTitle: "하수인 깨우기 · 악마와 동료 하수인 확인",
    revealTitle: "악마와 동료 하수인을 확인하세요",
    contentLabel: "하수인 정보 내용",
  },
  demon: {
    tab: "악마 정보",
    operationalTitle: "악마 깨우기 · 하수인과 블러프 확인",
    revealTitle: "하수인과 블러프를 확인하세요",
    contentLabel: "악마 정보 내용",
  },
} as const;

export function Issue64EvilInfoRevealPrototype() {
  const [audience, setAudience] = useState<Audience>("minion");
  const [view, setView] = useState<PrototypeView>("followup");
  const [replayReady, setReplayReady] = useState(true);

  if (view === "reveal") {
    return <EvilInfoReveal audience={audience} onClose={() => setView("followup")} />;
  }

  return (
    <main className="issue64Prototype">
      <header className="issue64PrototypeHeader">
        <div>
          <p>PROTOTYPE · ISSUE #64</p>
          <h1>첫날 밤 악 진영 정보 Reveal</h1>
        </div>
        <div className="issue64PrototypeControls">
          <nav aria-label="정보 화면 선택">
            {(["minion", "demon"] as const).map((value) => (
              <button
                type="button"
                aria-pressed={audience === value}
                key={value}
                onClick={() => setAudience(value)}
              >
                {copy[value].tab}
              </button>
            ))}
          </nav>
          <button
            type="button"
            className="issue64StateToggle"
            aria-pressed={!replayReady}
            onClick={() => setReplayReady((ready) => !ready)}
          >
            리플레이 대기 상태 보기
          </button>
        </div>
      </header>

      <section className="issue64StorytellerCanvas">
        <section className="issue64Followup" aria-label="확정된 Reveal 후속 조치">
          <header>
            <p>첫 밤 · 후속 조치</p>
            <h2>{copy[audience].operationalTitle}</h2>
          </header>

          <div className="issue64FollowupActions">
            <button type="button" className="issue64Primary" onClick={() => setView("reveal")}>
              플레이어에게 공개
            </button>
            <button type="button" className="issue64Secondary" disabled={!replayReady}>
              다음 단계로 계속
            </button>
          </div>
          {!replayReady ? <p className="issue64Waiting">다음 단계 준비 중</p> : null}
        </section>
      </section>
    </main>
  );
}

function EvilInfoReveal({ audience, onClose }: { audience: Audience; onClose: () => void }) {
  return (
    <main className="issue64PlayerReveal" aria-label="플레이어 공개 화면">
      <header className="issue64RevealHeading">
        <p>{copy[audience].tab}</p>
        <h1>{copy[audience].revealTitle}</h1>
      </header>

      <section className="issue64RevealCard" aria-label={copy[audience].contentLabel}>
        {audience === "minion" ? (
          <>
            <IdentityGroup label="악마" players={[demon]} emphasis="demon" />
            <IdentityGroup label="하수인" players={minions} />
          </>
        ) : (
          <>
            <IdentityGroup label="하수인" players={minions} />
            <section className="issue64RevealGroup issue64Bluffs" aria-labelledby="issue64-bluffs-heading">
              <h2 id="issue64-bluffs-heading">블러프</h2>
              <div className="issue64BluffGrid">
                {bluffCharacterIds.map((characterId) => (
                  <article key={characterId}>
                    <CharacterIcon characterId={characterId} />
                    <strong>{characterLabel(characterId)}</strong>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </section>

      <button type="button" className="issue64RevealClose" onClick={onClose}>
        확인했으면 눈을 감으세요
      </button>
    </main>
  );
}

function IdentityGroup({
  label,
  players,
  emphasis,
}: {
  label: string;
  players: PlayerIdentity[];
  emphasis?: "demon";
}) {
  const headingId = `issue64-${label}-heading`;
  return (
    <section className="issue64RevealGroup" aria-labelledby={headingId}>
      <h2 id={headingId}>{label}</h2>
      <div className="issue64IdentityGrid">
        {players.map((player) => (
          <article className={emphasis === "demon" ? "demon" : undefined} key={player.seat}>
            <span>{player.seat}</span>
            <strong>{player.seat}번 {player.name}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

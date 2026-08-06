import { useEffect, useState } from "react";
import type { ScriptId } from "../../core/scripts";
import { CommunityContentNotice } from "../../components/CommunityContentNotice";
import "./scriptLanding.css";

const scripts = {
  troubleBrewing: {
    name: "Trouble Brewing",
    logo: "/clocktower/assets/scripts/trouble-brewing.png",
    href: "/clocktower/trouble-brewing/",
    synopsis: (
      <>
        <p>
          먹구름이 레이븐스우드 블러프 위로 밀려들고, 평온하던 마을의 익숙한 풍경이 하나씩 낯선
          징조로 바뀌기 시작합니다. 바람은 계절답지 않게 따뜻하고, 굴뚝과 창문 너머에서는 정체를
          알 수 없는 연기와 향기가 번집니다. 주민들은 문을 걸어 잠그고 아이들을 불러들이지만,
          돌길과 담쟁이벽 사이를 스치는 인기척까지 막을 수는 없습니다. 평범한 이웃의 얼굴 뒤에
          무엇이 숨어 있는지 아무도 확신하지 못합니다.
        </p>
        <p>
          멀리서 울리는 천둥보다 더 두려운 것은 숲에서 되돌아오는 설명할 수 없는 소리입니다.
          수도원이 내려다보는 어둠 속에서는 누군가가 집과 집 사이를 오가고, 오래된 미신을 기억하는
          이들은 흩어진 징후들을 하나의 경고로 읽어 냅니다. 이 마을에는 이미 악이 들어왔습니다.
          살아남으려면 사람들의 말과 침묵, 진실과 거짓을 가려내 악의 정체를 찾아야 합니다.
        </p>
      </>
    ),
  },
  sectsAndViolets: {
    name: "Sects & Violets",
    logo: "/clocktower/assets/scripts/sects-and-violets.png",
    href: "/clocktower/sects-and-violets/",
    synopsis: (
      <>
        <p>
          찬란한 봄이 지나고 따뜻한 여름이 찾아옵니다. 레이븐스우드 블러프의 정원과 창가에는 꽃이
          넘쳐나고, 산책로에는 음악과 웃음이 이어집니다. 화가와 철학자, 떠돌이 공연자까지 한데 모인
          마을은 축제의 열기로 가득합니다. 좋은 술과 구경거리에 취한 주민들에게 지금은 걱정이라고는
          찾아보기 힘든 계절입니다. 겉으로 보이는 풍경만 믿는다면 말입니다.
        </p>
        <p>
          축제의 불빛이 닿지 않는 폐허와 지하 동굴에서는 전혀 다른 모임이 열립니다. 마녀와 비밀
          종파는 서로의 계획을 감춘 채 마을의 몰락을 준비하고, 선량한 이들의 지식과 정체마저
          흔들려 합니다. 아름다운 계절일수록 어둠은 더 능숙하게 숨어듭니다. 화려한 꽃과 소문,
          예언이 뒤엉킨 가운데 주민들은 무엇이 진실이고 누가 여전히 같은 편인지 밝혀내야 합니다.
        </p>
      </>
    ),
  },
} satisfies Record<ScriptId, {
  name: string;
  logo: string;
  href: string;
  synopsis: React.ReactNode;
}>;

export function ScriptLanding({
  onNavigate = (href) => window.location.assign(href),
}: {
  onNavigate?: (href: string) => void;
}) {
  const [selectedScript, setSelectedScript] = useState<ScriptId>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!loading || !selectedScript) return;
    const timer = window.setTimeout(() => onNavigate(scripts[selectedScript].href), 650);
    return () => window.clearTimeout(timer);
  }, [loading, onNavigate, selectedScript]);

  if (!selectedScript) {
    return (
      <main className="scriptLandingPage scriptLandingSelectionSurface">
        <section className="scriptLandingChoices" aria-label="스크립트 선택">
          <h1 className="visuallyHidden">스크립트 선택</h1>
          {(Object.keys(scripts) as ScriptId[]).map((scriptId) => {
            const script = scripts[scriptId];
            return (
              <button
                key={scriptId}
                type="button"
                className={`officialScriptChoice ${scriptId}`}
                aria-label={`${script.name} 선택`}
                onClick={() => setSelectedScript(scriptId)}
              >
                <img src={script.logo} alt={script.name} />
              </button>
            );
          })}
        </section>
        <CommunityContentNotice />
      </main>
    );
  }

  const script = scripts[selectedScript];
  return (
    <main className={`scriptLandingPage scriptSynopsisTheme ${selectedScript}`}>
      <button
        type="button"
        className="scriptLandingBack"
        aria-label="스크립트 선택"
        onClick={() => setSelectedScript(undefined)}
      >
        ←
      </button>
      <article className="scriptSynopsisCard">
        <img className="scriptSynopsisLogo" src={script.logo} alt="" />
        <h1 className="visuallyHidden">{script.name}</h1>
        <div className="scriptSynopsisCopy">{script.synopsis}</div>
        <button
          type="button"
          className="scriptConfirmButton"
          aria-label={`${script.name} 선택 확정`}
          disabled={loading}
          onClick={() => setLoading(true)}
        >
          선택
        </button>
      </article>
      {loading ? (
        <div className="scriptLoadingScreen" role="status" aria-live="polite">
          <img src={script.logo} alt="" />
          <span>{script.name} 준비 중</span>
        </div>
      ) : null}
    </main>
  );
}

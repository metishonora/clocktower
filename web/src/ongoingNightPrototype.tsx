import { useMemo, useState } from "react";
import "./ongoingNightPrototype.css";

type Scenario = "red-herring" | "effects" | "imp" | "information" | "announcement-empty" | "announcement";
type InfoRole = "fortuneTeller";

const players = [
  { id: "p1", seat: 1, name: "민지", character: "점쟁이", team: "good" },
  { id: "p2", seat: 2, name: "준호", character: "첩자", team: "evil" },
  { id: "p3", seat: 3, name: "서연", character: "은둔자", team: "good" },
  { id: "p4", seat: 4, name: "도윤", character: "수도사", team: "good" },
  { id: "p5", seat: 5, name: "하린", character: "까마귀지기", team: "good" },
  { id: "p6", seat: 6, name: "지우", character: "독살범", team: "evil" },
  { id: "p7", seat: 7, name: "현우", character: "임프", team: "evil" },
];

const scenarioLabels: Record<Scenario, string> = {
  "red-herring": "레드 헤링",
  effects: "중독 · 보호",
  imp: "임프 결과",
  information: "정보",
  "announcement-empty": "사망 없음",
  announcement: "사망 있음",
};

export function OngoingNightPrototype() {
  const [scenario, setScenario] = useState<Scenario>("red-herring");
  const [selectedIds, setSelectedIds] = useState<string[]>(["p2"]);
  const [impOutcome, setImpOutcome] = useState<"prevented" | "ravenkeeperDeath">("prevented");
  const infoRole: InfoRole = "fortuneTeller";
  const delivered = "악마 있음";
  const [confirmed, setConfirmed] = useState(false);

  const badges: Record<string, string> = scenario === "effects" ? { p1: "중독", p3: "보호" } : {};
  const state = useMemo(
    () => ({ scenario, selectedPlayerIds: selectedIds, impOutcome, infoRole, delivered, confirmed, badges }),
    [scenario, selectedIds, impOutcome, infoRole, delivered, confirmed],
  );

  function chooseScenario(next: Scenario) {
    setScenario(next);
    setConfirmed(false);
    if (next === "red-herring") setSelectedIds(["p2"]);
    if (next === "effects") setSelectedIds([]);
    if (next === "imp") { setImpOutcome("prevented"); setSelectedIds(["p3"]); }
    if (next === "information") setSelectedIds(["p3", "p7"]);
    if (next === "announcement-empty") setSelectedIds([]);
    if (next === "announcement") setSelectedIds(["p5"]);
  }

  function toggle(id: string, max = 1) {
    setConfirmed(false);
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      return max === 1 ? [id] : current.length < max ? [...current, id] : current;
    });
  }

  function changeImpOutcome(value: "prevented" | "ravenkeeperDeath") {
    setImpOutcome(value);
    setSelectedIds([value === "prevented" ? "p3" : "p5"]);
    setConfirmed(false);
  }

  return (
    <main className="onpShell">
      <header className="onpHeader">
        <div><span className="onpEyebrow">ONGOING NIGHT</span><h1>밤 행동 프로토타입</h1></div>
        <span className="onpPhase">둘째 밤 · 3/7</span>
      </header>
      <nav className="onpTabs" aria-label="시나리오">
        {(Object.keys(scenarioLabels) as Scenario[]).map((key) => (
          <button key={key} aria-pressed={scenario === key} onClick={() => chooseScenario(key)}>{scenarioLabels[key]}</button>
        ))}
      </nav>
      <section className="onpLayout">
        <Grimoire selectedIds={selectedIds} badges={badges} disabled={scenario === "effects" || scenario === "imp" || scenario === "information" || scenario === "announcement-empty" || scenario === "announcement"} onSelect={(id) => toggle(id)} />
        <aside className="onpPanel" aria-label="밤 행동 패널">
          {scenario === "red-herring" && <RedHerring selectedIds={selectedIds} onSelect={(id) => toggle(id)} />}
          {scenario === "effects" && <Effects />}
          {scenario === "imp" && <Imp outcome={impOutcome} onChange={changeImpOutcome} />}
          {scenario === "information" && <Information />}
          {scenario === "announcement-empty" && <Announcement empty />}
          {scenario === "announcement" && <Announcement empty={false} />}
          {scenario !== "effects" && <button className="onpConfirm" onClick={() => setConfirmed(true)}>{scenario === "announcement-empty" ? "사망자 없음 발표 확정" : scenario === "announcement" ? "사망 발표 확정" : scenario === "information" ? "Reveal" : "확정"}</button>}
          {confirmed && <div className="onpConfirmed" role="status">확정됨</div>}
        </aside>
      </section>
      <output hidden data-testid="ongoing-night-prototype-state">{JSON.stringify(state)}</output>
    </main>
  );
}

function Grimoire({ selectedIds, badges, disabled, onSelect }: { selectedIds: string[]; badges: Record<string, string>; disabled: boolean; onSelect: (id: string) => void }) {
  return <section className="onpMap" aria-label="마도서">
    <div className="onpMapTitle"><strong>마도서</strong></div>
    <div className="onpSeats">{players.map((player) => <button key={player.id} disabled={disabled} className={`onpSeat ${player.team} ${selectedIds.includes(player.id) ? "selected" : ""}`} aria-pressed={selectedIds.includes(player.id)} onClick={() => onSelect(player.id)}>
      <span className="onpSeatNo">{player.seat}</span><strong>{player.name}</strong><small>{player.character}</small>
      {badges[player.id] && <em className={`onpSeatBadge ${badges[player.id] === "중독" ? "poison" : "protect"}`}>{badges[player.id]}</em>}
    </button>)}</div>
  </section>;
}

function RedHerring({ selectedIds, onSelect }: { selectedIds: string[]; onSelect: (id: string) => void }) {
  return <><PanelHeading kicker="점쟁이" title="레드 헤링 지정" value="1명" />
    <div className="onpChoiceList" aria-label="레드 헤링 대상">{players.filter((p) => p.team === "good" || p.character === "첩자").map((p) => <button key={p.id} aria-pressed={selectedIds.includes(p.id)} onClick={() => onSelect(p.id)}>{p.seat}번 {p.name}<span>{p.character}</span></button>)}</div>
  </>;
}

function Effects() {
  return <><PanelHeading kicker="규칙 상태" title="적용 중 효과" value="2" />
    <div className="onpEffect"><span className="poison">중독</span><div><b>1번 민지</b><small>출처 6번 지우 · evt-night-poisoner</small></div></div>
    <div className="onpEffect"><span className="protect">보호</span><div><b>3번 서연</b><small>출처 4번 도윤 · 이번 밤</small></div></div>
  </>;
}

function Imp({ outcome, onChange }: { outcome: "prevented" | "ravenkeeperDeath"; onChange: (value: "prevented" | "ravenkeeperDeath") => void }) {
  return <><PanelHeading kicker="7번 현우 · 임프" title="공격 결과" value={outcome === "prevented" ? "사망 없음" : "사망"} />
    <div className="onpSegment"><button aria-pressed={outcome === "prevented"} onClick={() => onChange("prevented")}>수도사 보호</button><button aria-pressed={outcome === "ravenkeeperDeath"} onClick={() => onChange("ravenkeeperDeath")}>까마귀지기 사망</button></div>
    <div className="onpOutcome"><b>{outcome === "prevented" ? "3번 서연 - 수도승에 의해 보호됨" : "5번 하린 - 사망"}</b></div>
  </>;
}

function Information() {
  return <><div className="onpResultHeading"><h2>점쟁이 결과</h2></div>
    <div className="onpResult"><span>결과</span><strong>악마 있음</strong></div>
  </>;
}

function Announcement({ empty }: { empty: boolean }) {
  return <><PanelHeading kicker="다음 날" title="밤 사망 발표" value={empty ? "0명" : "1명"} />{empty
    ? <div className="onpDeath onpDeathEmpty"><b>사망자 없음</b></div>
    : <div className="onpDeath"><span className="onpDeathIcon" aria-label="사망">✕</span><span className="onpDeathNumber">5번</span><b>하린</b></div>}
  </>;
}

function PanelHeading({ kicker, title, value }: { kicker: string; title: string; value: string }) {
  return <div className="onpPanelHeading"><span>{kicker}</span><h2>{title}</h2><strong>{value}</strong></div>;
}

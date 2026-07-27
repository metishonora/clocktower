import type { Player } from "../../core/types";
import "./nightResultsAnnouncement.css";

export function NightResultsAnnouncement({
  players,
  deathPlayerIds,
  resurrectionPlayerIds,
}: {
  players: Player[];
  deathPlayerIds: string[];
  resurrectionPlayerIds: string[];
}) {
  const labels = (playerIds: string[]) => playerIds.flatMap((id) => {
    const player = players.find((candidate) => candidate.id === id);
    return player ? [`${player.seat}번 ${player.name}`] : [];
  });
  const deaths = labels(deathPlayerIds);
  const resurrections = labels(resurrectionPlayerIds);
  return (
    <section className="nightResultsAnnouncement" aria-label="밤 결과 확인">
      <dl>
        <div className="deaths"><dt>사망자:</dt><dd>{deaths.length > 0 ? deaths.join(", ") : "없음"}</dd></div>
        <div className="resurrections"><dt>부활:</dt><dd>{resurrections.length > 0 ? resurrections.join(", ") : "없음"}</dd></div>
      </dl>
    </section>
  );
}

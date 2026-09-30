import './styles/grimoireVoting.css';

/** Presentation only: each runtime supplies its existing count and threshold. */
export function GrimoireVoteSummary({nominee, count, threshold, thresholdLabel, completed=false}: {
  nominee?: {seat:number; name:string};
  count:number;
  threshold:number;
  thresholdLabel:'처형 기준'|'후보 기준';
  completed?:boolean;
}) {
  return <>
    <div className="grimoireVoteNomineeIdentity">
      <span>피지목자</span>
      <strong>{nominee ? `${nominee.seat}번 ${nominee.name}` : '선택 전'}</strong>
    </div>
    <div className="grimoireVoteCount" aria-live="polite" aria-atomic="true">
      <div><span>{completed?'확정':'현재'}</span><strong>{count}<small>표</small></strong></div>
      <span aria-hidden="true">/</span>
      <div><span>{thresholdLabel}</span><strong>{threshold}<small>표</small></strong></div>
    </div>
  </>;
}

export function VoteNomineeBadge() {
  return <span className="grimoireVoteNomineeBadge" aria-hidden="true">피지목자</span>;
}

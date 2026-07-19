import { useMemo } from "react";
import type { Player } from "../../core/types";
import { countCharacterKinds } from "../../setupDraft";

export function ConfirmedSetup({
  players,
  canRecoverSetup,
  onRecoverSetup,
  onExport,
  onImport,
  onReset,
}: {
  players: Player[];
  canRecoverSetup: boolean;
  onRecoverSetup: () => void;
  onExport: () => void;
  onImport: () => void;
  onReset: () => void;
}) {
  const counts = useMemo(() => countCharacterKinds(players), [players]);

  return (
    <>
      <h2>초기 Grimoire 준비됨</h2>
      <dl className="counts">
        <div>
          <dt>주민</dt>
          <dd>{counts.Townsfolk}</dd>
        </div>
        <div>
          <dt>외지인</dt>
          <dd>{counts.Outsider}</dd>
        </div>
        <div>
          <dt>하수인</dt>
          <dd>{counts.Minion}</dd>
        </div>
        <div>
          <dt>악마</dt>
          <dd>{counts.Demon}</dd>
        </div>
      </dl>
      <div className="confirmedActions">
        {canRecoverSetup ? (
          <button type="button" className="secondaryButton" onClick={onRecoverSetup}>
            설정 다시 수정
          </button>
        ) : null}
        <button type="button" className="secondaryButton" onClick={onExport}>
          JSON 내보내기
        </button>
        <button type="button" className="secondaryButton" onClick={onImport}>
          JSON 가져오기
        </button>
        <button type="button" className="secondaryButton" onClick={onReset}>
          새 설정
        </button>
      </div>
    </>
  );
}

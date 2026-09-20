import type {GameEndState,PendingGameEnd} from '../../core/types';
import {GameEndDialog,GameEndDock} from '../../shared-ui/GameEndPresentation';

export function SnvGameEndDialog({pending,busy,onConfirm}:{pending:PendingGameEnd;busy:boolean;onConfirm:()=>void}) {
 return <GameEndDialog winningTeam={pending.winningTeam} reason={pending.reasonKo} busy={busy} onConfirm={onConfirm}/>;
}
export function SnvGameEndDock({gameEnd}:{gameEnd:GameEndState}) {
 return <GameEndDock winningTeam={gameEnd.winningTeam} reason={gameEnd.reasonKo}/>;
}

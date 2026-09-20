import type {GameFile,PhaseStep,ReplayState} from '../custom/core/types';
import {previousBalloonistInformation} from '../custom/grimoire/carouselPresentation';

export function CustomBalloonistPrevious({file,step,replay}:{file:GameFile;step:PhaseStep|undefined;replay:ReplayState}) {
  if(step?.character!=='balloonist')return null;
  const previous=previousBalloonistInformation(file,step);
  const player=previous&&replay.players.find(p=>p.id===previous.targetPlayerId);
  const kind=previous&&({Townsfolk:'주민',Outsider:'외지인',Minion:'하수인',Demon:'악마'})[previous.registeredKind];
  return <div className="customCarouselTarget"><span>직전 정보</span><strong>{previous?`${player?`${player.seat}번 ${player.name}`:previous.targetPlayerId} · ${kind}`:'없음'}</strong></div>;
}

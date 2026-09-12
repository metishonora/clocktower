import {actionAdapter} from '../../grimoire-custom/actions/registry';
import type { GameFileV4, PhaseStep } from '../core/types';
export function actionInputIdentity(file:GameFileV4,step?:PhaseStep):string {return JSON.stringify({game:file.game,step:step?.id,execution:step?.execution.id,ability:step?.abilityUse,cause:step?.actionCause,simulation:step?.simulationSource});}
export const actionLabels:Record<string,string>={dusk:'첫날 밤 준비',minionInfo:'하수인 정보',demonInfo:'악마 정보',dawn:'첫날 밤 마치기',prepareInformation:'정보 준비',assignShownCharacter:'표시 배역 지정',assignRedHerring:'붉은 청어 지정',assignTwin:'쌍둥이 지정',learnTwin:'쌍둥이 통지',chooseAbility:'능력 선택',choosePlayer:'대상 선택',choosePoisonTarget:'중독 대상',chooseMaster:'주인 선택',chooseCursedPlayer:'저주 대상',assignMadness:'광기 지정',resolveMadnessExecution:'처형 판단'};

export type TaskStage='preparation'|'action'|'delivery'|'transition'|'end';
export type ActionEditor='team'|'setup'|'ability'|'players'|'madness'|'execution'|'information'|'none';
export function actionPresentation(step:PhaseStep):{stage:TaskStage;editor:ActionEditor}|undefined {
 const adapter=actionAdapter(step);return adapter?{stage:adapter.stage,editor:adapter.inputView}:undefined;
}

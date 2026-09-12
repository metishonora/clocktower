import {CustomRegistrationControls} from './CustomRegistrationControls';
import '../shared-ui/styles/liveTargetStates.css';
import {GrimoireSeatContent} from '../shared-ui/GrimoireSeatContent';
import {GrimoireHandoffView,GrimoireNotificationPrompt} from '../shared-ui/GrimoireHandoffView';
import '../features/grimoire/sectsAndVioletsSeatStates.css';
import { taskPresentationModel } from './taskPresentationModel';
import { CustomSetupInformationInputs } from './CustomSetupInformationInputs';
import { troubleBrewingCharacterDetail, sectsAndVioletsCharacterDetail } from '../characterDetails';
import { useState } from 'react';
import { GrimoirePresentation, RectangularGrimoireBoard, grimoireHeights, rectangularSeatPositions } from '../shared-ui/GrimoirePresentation';
import { GrimoireToolbar } from '../shared-ui/GrimoireToolbar';
import { CharacterAbilityInput } from '../shared-ui/InformationInputPresentation';
import { GrimoireSelectionPanel } from '../shared-ui/GrimoireSelectionPanel';
import type { CSSProperties } from 'react';
import type { FirstNightController } from '../custom/grimoire/firstNightController';
import { customPlayerTokens } from './customPlayerPresentation';
import { PlayerTokenCountBadge, PlayerTokenDetailDialog } from '../features/grimoire/playerTokenPresentation';
import type { GameFile, ReplayState } from '../custom/core/types';
import { characterPresentation, kindLabels } from '../custom/authoring/characterPresentation';

export function CustomGrimoireBoard({ file, replay, onProgress, controller, onSelectionDone, runtime, onRestart }: { runtime?:string; file: GameFile; replay: ReplayState; onProgress: () => void; onRestart?: () => void; controller:FirstNightController; onSelectionDone:()=>void }) {
  const [seat,setSeat] = useState<number>();
  const player = replay.players.find(p => p.seat === seat);
  const role = player && characterPresentation(player.actualCharacter);
  const shown = player && characterPresentation(player.shownCharacter);
  const state=controller.getSnapshot(), handoff=state.handoff, step=handoff?.step ?? controller.step;
  const model=taskPresentationModel(controller);
  const selecting=state.selecting, completed=handoff?.stage==='result', notification=handoff?.stage==='notification'?handoff.notifications[handoff.notificationIndex]:undefined, ids=completed||notification?handoff?.playerIds ?? []:controller.selectedPlayerIds;
  const desktop=rectangularSeatPositions(replay.players.length,false), mobile=rectangularSeatPositions(replay.players.length,true), heights=grimoireHeights(replay.players.length);
  const style={'--grimoire-height':`${heights.desktop}px`,'--mobile-grimoire-height':`${heights.mobile}px`} as CSSProperties;
  const characterRequired=['madnessAssignment','characterTransformation'].includes(step?.requiredInput.kind ?? '');
  const minimum=state.selectionKind==='delivery'?2:model.selection.minPlayers;
  return <><GrimoirePresentation ariaLabel="마도서" className={`snvSeatingSurface bmrGrimoireSurface issue116GrimoireSurface confirmed${handoff?' issue116HandoffActive issue116AttackMode':''}`} workspaceClassName={`snvSeatingWorkspace bmrGrimoireWorkspace stable${selecting||completed?'':' confirmed'}`} style={style}
    toolbar={<GrimoireToolbar showCurrentActor={!!step?.playerId}>{!selecting&&!handoff&&onRestart&&<button type="button" className="snvToolbarBack destructive" aria-label="배치로 돌아가기" disabled={state.busy||state.public||state.saveStatus!=='saved'} onClick={onRestart}><span aria-hidden="true">←</span></button>}{selecting && <button type="button" disabled={state.busy} onClick={()=>{controller.cancelSelection();onSelectionDone();}}>취소</button>}</GrimoireToolbar>}
    board={<RectangularGrimoireBoard ariaLabel={`${replay.players.length}자리 마도서`} className="snvGrimoireDraft bmrGrimoireBoard" centerClassName={`snvGrimoireCenter live issue116PhaseClock${notification&&'kind' in notification&&notification.kind==='evilTwinPair'?' evilTwinCenterPrompt':''}`} style={style}
      seats={replay.players.map((p,index)=>{const c=characterPresentation(p.actualCharacter);return {id:p.id,position:file.ui?.seatLayout?.positions[p.seat] ?? desktop[index],mobilePosition:mobile[index],afterSeat:<PlayerTokenCountBadge count={replay.ruleState.automaticReminders?.filter(t=>t.playerId===p.id).length ?? 0} position={file.ui?.seatLayout?.positions[p.seat] ?? desktop[index]} mobilePosition={mobile[index]} theme={replay.phase==='day'?'day':'night'}/>,className:`assigned alignment-${p.alignment} kind-${c?.kind.toLowerCase()}${!p.alive?' snvDeadSeat':''}${ids.includes(p.id)&&(selecting||completed||notification)?` snvSeatStateSelected snvSeatStateTarget${step?.character==='poisoner'?' tbSeatStatePoison snvSeatStatePoisonTarget':' tbSeatStateSelection'}`:''}${(selecting||completed)&&ids.length>=minimum&&!ids.includes(p.id)&&(step?.abilityUse?.ownerPlayerId ?? step?.playerId)!==p.id?' snvSettledOtherSeat':''}${selecting&&!controller.canSelectPlayer(p.id)?' issue116IneligibleSeat':''}${(step?.abilityUse?.ownerPlayerId ?? step?.playerId)===p.id?' snvCurrentActorSeat snvSeatStateActor':''}`,ariaLabel:`${p.seat}번 ${p.name}, ${c?.label}`,pressed:selecting?ids.includes(p.id):seat===p.seat,disabled:state.busy || completed || !!notification || (selecting&&!controller.canSelectPlayer(p.id)),onSelect:()=>selecting?controller.togglePlayer(p.id):setSeat(p.seat),content:<GrimoireSeatContent seat={p.seat} name={p.name} alive={p.alive} icon={<img src={c?.image} alt=""/>} label={ids.includes(p.id)&&(selecting||completed)?step?.character==='poisoner'?'중독':step?.character==='butler'?'주인':step?.actionRef?.actionId==='assignRedHerring'?'착각':'선택':c?.label ?? p.actualCharacter}/>};})}
      center={notification && 'kind' in notification && ['madnessAssignment','characterChange','evilTwinPair'].includes(notification.kind)?<GrimoireNotificationPrompt kind={notification.kind as 'madnessAssignment'|'characterChange'|'evilTwinPair'} players={notification.kind==='evilTwinPair'?notification.players:[]} sequence={handoff!.notificationIndex+1} total={handoff!.notifications.length} playerLabel={'playerId' in notification ? (()=>{const p=replay.players.find(p=>p.id===notification.playerId);return p?`${p.seat}번 ${p.name}`:'플레이어';})():'플레이어'} onReveal={controller.showNotification}/>:<><strong>{replay.phase==='day'?'첫날 낮':'첫날 밤'}</strong><time aria-label="경과 시간">{runtime}</time>{!handoff&&<button type="button" onClick={onProgress}>진행 →</button>}</>}/>}
    inspector={(selecting||completed) && <GrimoireHandoffView showReset={!['cerenovus','witch','snakeCharmer','evilTwin'].includes(step?.character ?? '')} title={handoffTitle(step,completed)} completed={completed} busy={state.busy} ready={controller.selectionReady}
      rows={['cerenovus','witch','snakeCharmer','evilTwin'].includes(step?.character ?? '')?[{label:'행동자',value:person(step?.abilityUse?.ownerPlayerId ?? step?.playerId,replay)},{label:'선택 대상',value:person(ids[0],replay)}]:ids.map((id,index)=>({label:ids.length>1?`${index+1}번째`:step?.character==='poisoner'?'중독 대상':step?.character==='butler'?'주인':'선택 대상',value:person(id,replay)}))}
      confirmLabel={step?.character==='cerenovus'?`${person(ids[0],replay)} 집착 지정`:step?.character==='witch'?`${person(ids[0],replay)} 저주 확정`:'선택 확정'}
      onReset={()=>controller.updateInput({playerIds:[],treatments:{},judgments:[],correct:'',choiceIndex:'',delivery:undefined})}
      onContinue={()=>{controller.finishHandoff();onSelectionDone();}}
      onConfirm={()=>{void controller.acceptSelection().then(()=>{if(!controller.getSnapshot().handoff)onSelectionDone();});}}>
      {!completed&&step?.character==='fortuneTeller'&&<CustomRegistrationControls controller={controller}/>}
      {!completed&&<CustomSetupInformationInputs controller={controller} location="board"/>}
      {!completed&&characterRequired&&<CharacterAbilityInput label="집착할 캐릭터" ariaLabel="집착할 캐릭터" value={state.inputDraft.characterIds[0] ?? ''} options={(step?.requiredInput.allowedCharacterIds ?? []).map(id=>({id,label:characterPresentation(id)?.label ?? id}))} disabled={state.busy} onChange={id=>controller.updateInput({characterIds:id?[id]:[]})}/>}
    </GrimoireHandoffView>}

  />{player && role && <PlayerTokenDetailDialog appearance="bmr" theme={replay.phase === 'day' ? 'day' : 'night'} onClose={()=>setSeat(undefined)}
    player={{characterId:role.id,seat:player.seat,name:player.name,characterLabel:role.label,characterKindLabel:kindLabels[role.kind],characterAbility:role.ability,characterIconSrc:role.image,alignment:player.alignment}}
    characterDetails={role.source === 'troubleBrewing' ? troubleBrewingCharacterDetail(role.id) : sectsAndVioletsCharacterDetail(role.id)}
    tokens={customPlayerTokens(replay.ruleState.automaticReminders?.filter(t=>t.playerId===player.id) ?? [])}
    identityDetails={shown && shown.id !== role.id && <section className="bmrLunaticIdentityComparison" aria-label="실제 직업과 보여준 직업">
      <article><span>실제 직업</span><div><img src={role.image} alt=""/><strong>{role.label}</strong></div></article>
      <article><span>보여준 직업</span><div><img src={shown.image} alt=""/><strong>{shown.label}</strong></div></article>
    </section>}
    details={<>{replay.ruleState.abilityGrants?.filter(g=>g.ownerPlayerId===player.id).map(g=><p key={g.abilityInstanceId}>획득 능력 · {characterPresentation(g.characterId)?.label ?? g.characterId}</p>)}</>}
  />}</>;
}

function person(id:string|undefined,replay:ReplayState){const p=replay.players.find(p=>p.id===id);return p?`${p.seat}번 ${p.name}`:'선택 전';}
function handoffTitle(step:import('../custom/core/types').PhaseStep|undefined,complete:boolean){const id=step?.character??'';const names:Record<string,string>={cerenovus:'세레노버스 집착 지정',witch:'저주 대상 선택',snakeCharmer:'뱀 조련사',evilTwin:'쌍둥이 지정',poisoner:'독살범 능력',butler:'집사 능력',dreamer:'한 명을 선택',seamstress:'두 명 선택',fortuneTeller:'점쟁이 능력',washerwoman:'세탁부 능력',librarian:'사서 능력',investigator:'수사관 능력'};const title=step?.actionRef?.actionId==='assignRedHerring'?'착각 지정':names[id]??characterPresentation(id)?.label??'';return complete?`${title} 결과`:title;}

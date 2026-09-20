import {CharacterDetailButton} from '../components/CharacterRulesCard';
import {characterPresentation} from '../custom/authoring/characterPresentation';
import {marionetteProgressNotification} from '../custom/grimoire/carouselPresentation';
import type {FirstNightController} from '../custom/grimoire/firstNightController';
import {RoleInformationTaskView} from '../shared-ui/RoleInformationTaskView';
import {AbilityOwnerView} from '../shared-ui/AbilityIdentityView';
import {customCharacterDetail} from './customCharacterDetails';

/** Same task for selecting the cover and each isolated, persisted recipient reveal. */
export function CustomMarionetteTask({controller}:{controller:FirstNightController}) {
  const state=controller.getSnapshot(),step=controller.step;
  const notification=marionetteProgressNotification(state);
  const toDemon=notification?.kind==='marionetteInformation';
  const puppetId=notification?.kind==='characterChange'?notification.playerId:toDemon?notification.marionettePlayer.playerId:step?.abilityUse?.ownerPlayerId??step?.playerId;
  const puppet=state.replay.players.find(p=>p.id===puppetId);
  const person=(p:{seat:number;name:string}|undefined)=>p?`${p.seat}번 ${p.name}`:'선택 필요';
  const role=characterPresentation('marionette')!;
  const cover=state.inputDraft.characterIds[0]??'';
  const allowed=step?.requiredInput.allowedCharacterIds??[];
  const busy=state.busy||state.public||state.saveStatus!=='saved';
  const reveal=async()=>{
    if(notification){controller.showNotification();return;}
    const eventCount=state.file.game.events.length;
    await controller.prepareCurrent();
    const next=controller.getSnapshot();
    // A failed validation/save never opens a secret. Closing the first secret never opens the second.
    if(next.file.game.events.length>eventCount&&!next.error&&next.saveStatus==='saved'&&marionetteProgressNotification(next))controller.showNotification();
  };
  return <RoleInformationTaskView className="bmrCurrentStep" ariaLabel="꼭두각시 보여줄 직업 지정"
    identity={<><AbilityOwnerView icon={<img src={role.image} alt=""/>} role={<span className="snvCurrentStepRoleName" role="heading" aria-level={3}>{role.label}</span>} player={<strong>{person(puppet)}</strong>} wrap={children=><CharacterDetailButton details={customCharacterDetail(role.id)} theme={state.replay.phase==='day'?'bmr-day':'bmr-night'} className="snvCurrentStepIdentity interactive snvInformationIdentity issue107ActorIdentity">{children}</CharacterDetailButton>}/><p className="snvInformationAbility">{role.ability}</p></>}
    needsTargets={false} busy={busy} revealed={false} canReveal={!!notification||allowed.includes(cover)} onReveal={()=>void reveal()} revealLabel={toDemon?'악마에게 공개':'본인에게 변경 직업 공개'}>
    <div className="customCarouselTarget"><span>{toDemon?'공개 대상 · 악마':'공개 대상'}</span><strong>{person(toDemon?notification.recipientPlayer:puppet)}</strong></div>
    {toDemon?<div className="customCarouselTarget"><span>꼭두각시</span><strong>{person(puppet)}</strong></div>:notification?.kind==='characterChange'?<div className="customCarouselTarget"><span>믿는 직업</span><strong>{characterPresentation(notification.characterId)?.label}</strong></div>:<label className="customCarouselSelect">믿는 직업<select value={cover} disabled={busy} onChange={e=>controller.updateInput({characterIds:[e.target.value]})}><option value="" disabled>선택 필요</option>{allowed.map(id=><option key={id} value={id}>{characterPresentation(id)?.label}</option>)}</select></label>}
  </RoleInformationTaskView>;
}

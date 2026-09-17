import {customSeatCharacter} from './customPlayerPresentation';
import {useSyncExternalStore, type CSSProperties} from 'react';
import type {FirstNightController} from '../custom/grimoire/firstNightController';
import {characterPresentation} from '../custom/authoring/characterPresentation';
import {GrimoirePresentation, RectangularGrimoireBoard, rectangularSeatPositions, grimoireHeights} from '../shared-ui/GrimoirePresentation';
import {GrimoireToolbar} from '../shared-ui/GrimoireToolbar';
import {GrimoireSelectionPanel} from '../shared-ui/GrimoireSelectionPanel';
import {GrimoireSeatContent} from '../shared-ui/GrimoireSeatContent';
import {NominationArrow} from '../shared-ui/NominationArrow';
import '../features/grimoire/sectsAndVioletsSeatStates.css';
import '../shared-ui/styles/liveTargetStates.css';

/** Same seat-selection, arrow and result-panel presentation as the official live grimoire. */
export function CustomDayBoard({controller}:{controller:FirstNightController}) {
  const state=useSyncExternalStore(controller.subscribe,controller.getSnapshot);
  const h=state.dayHandoff!,day=state.replay.day!,players=state.replay.players;
  const voting=h.kind==='vote',busy=state.busy||state.public||state.saveStatus!=='saved';
  const desktop=rectangularSeatPositions(players.length,false).map((p,i)=>state.file.ui?.seatLayout?.positions[players[i].seat]??p);
  const mobile=rectangularSeatPositions(players.length,true),heights=grimoireHeights(players.length);
  const style={'--grimoire-height':`${heights.desktop}px`,'--mobile-grimoire-height':`${heights.mobile}px`} as CSSProperties;
  const person=(id?:string)=>{const p=players.find(p=>p.id===id);return p?`${p.seat}번 ${p.name}`:'선택 전';};
  const count=h.complete?h.countedVotes??0:h.voterIds.filter(id=>!day.voteDependencies.some(d=>d.voterId===id&&!h.voterIds.includes(d.requiredVoterId))).length;
  const previousVotes=day.nominations.filter(n=>n.countedVoterIds!==null&&(!h.complete||n.eventId!==day.nominations.at(-1)?.eventId));
  const highest=Math.max(0,...previousVotes.map(n=>n.countedVoterIds!.length));
  const targetVotes=Math.max(day.executionVoteThreshold,highest+(previousVotes.length?1:0));
  const ready=voting||!!(h.nominatorId&&h.nomineeId);
  const nominator=players.find(p=>p.id===h.nominatorId),nominee=players.find(p=>p.id===h.nomineeId);
  const confirmLabel=voting?`${count}표로 투표 확정`:!nominator?'지명자를 선택하세요':!nominee?'피지명자를 선택하세요':`${nominator.seat}번 → ${nominee.seat}번 지명 확정`;
  return <GrimoirePresentation ariaLabel="마도서" className={`snvSeatingSurface bmrGrimoireSurface issue116GrimoireSurface confirmed issue116HandoffActive ${voting?'issue116VoteMode':'issue116NominationMode'}`} workspaceClassName="snvSeatingWorkspace bmrGrimoireWorkspace stable" style={style}
    toolbar={<GrimoireToolbar showCurrentActor={false}>{!h.complete&&<button type="button" disabled={busy} onClick={()=>void controller.cancelDayHandoff()}>{voting&&controller.canCancelDayVote?'투표 취소 →':'돌아가기 →'}</button>}</GrimoireToolbar>}
    board={<RectangularGrimoireBoard ariaLabel={`${players.length}자리 마도서`} className="snvGrimoireDraft bmrGrimoireBoard" style={style}
      seats={players.map((p,i)=>{
        const role=customSeatCharacter(p);
        const self=!voting&&h.nominatorId===p.id&&h.nomineeId===p.id;
        const selected=voting?h.voterIds.includes(p.id):h.nominatorId===p.id||h.nomineeId===p.id;
        const selectionLabel=voting?selected?'투표':undefined:self?'지명자 · 피지명자':h.nominatorId===p.id?'지명자':h.nomineeId===p.id?'피지명자':undefined;
        const selectionClass=voting?selected?' issue116VoterSeat':'':self?' issue116NominatorSeat issue116NomineeSeat issue116SelfNominationSeat':h.nominatorId===p.id?' issue116NominatorSeat':h.nomineeId===p.id?' issue116NomineeSeat':'';
        const eligible=voting?day.eligibleVoterIds.includes(p.id):(h.nominatorId?day.eligibleNomineeIds:day.eligibleNominatorIds).includes(p.id);
        const ghost=voting&&!p.alive&&!p.ghostVoteUsed,spent=voting&&!p.alive&&p.ghostVoteUsed;
        return {id:p.id,position:desktop[i],mobilePosition:mobile[i],pressed:selected,disabled:busy||h.complete||!eligible,
          ariaLabel:`${p.seat}번 좌석, ${p.name}, ${role?.label}, ${p.alive?'생존':p.ghostVoteUsed?'사망 · 유령표 사용함':'사망 · 유령표 사용 가능'}${selectionLabel?`, ${selectionLabel}`:''}`,
          className:`assigned alignment-${p.alignment} kind-${characterPresentation(p.actualCharacter)?.kind.toLowerCase()}${!p.alive?' snvDeadSeat':''}${ghost?' snvGhostVoteAvailable':''}${spent?' snvGhostVoteSpent':''}${selected?' issue116SelectedSeat snvSeatStateSelected':''}${selected&&!p.alive?' snvSeatStateStrong':''}${selectionClass}${!eligible?' issue116IneligibleSeat':''}`,
          onSelect:()=>controller.selectDayPlayer(p.id),
          content:<GrimoireSeatContent seat={p.seat} name={p.name} alive={p.alive} ghostVoteUsed={p.ghostVoteUsed} icon={<img src={role?.image} alt=""/>} label={selectionLabel??role?.label??''}/>};
      })}
      overlay={!voting&&nominator&&nominee?<NominationArrow nominatorIndex={players.indexOf(nominator)} nomineeIndex={players.indexOf(nominee)} desktopPositions={desktop} mobilePositions={mobile} label={`${nominator.name} → ${nominee.name} 지명`} markerPrefix="customDayNomination"/>:undefined}/>} 
    inspector={<GrimoireSelectionPanel title={h.complete?'투표 결과':voting?'투표':'지명'} completed={h.complete}
      reset={!h.complete&&<button type="button" disabled={busy} onClick={controller.resetDayHandoff}>{voting?'투표 초기화 X':'지명 초기화 X'}</button>}
      action={h.complete?<button type="button" className="issue116PrimaryAction issue116VoteCompleteAction" disabled={busy} onClick={controller.finishDayHandoff}>투표 완료 →</button>:<button type="button" className="issue116PrimaryAction" disabled={busy||!ready} onClick={()=>void controller.confirmDayHandoff()}>{confirmLabel}</button>}>
      {voting?<dl className="issue116VoteSummary"><div><dt>지명</dt><dd>{person(h.nominatorId)} → {person(h.nomineeId)}</dd></div><div><dt>현재</dt><dd className={count>=targetVotes?'thresholdMet':''}>{count}표</dd><span aria-hidden="true">/</span><dd>{previousVotes.length?'후보':'처형'} 기준 {targetVotes}표</dd></div></dl>:<dl><div><dt>지명자</dt><dd>{person(h.nominatorId)}</dd></div><div><dt>피지명자</dt><dd>{person(h.nomineeId)}</dd></div></dl>}
      {!voting&&day.townsfolkRegistrationNominatorIds.includes(h.nominatorId??'')&&day.firstNominationTargetIds.includes(h.nomineeId??'')&&<label><input type="checkbox" checked={h.spyAsTownsfolk} disabled={busy} onChange={e=>controller.setDaySpyRegistration(e.target.checked)}/>이번 판정에서 마을주민으로 취급</label>}
    </GrimoireSelectionPanel>}/>
}

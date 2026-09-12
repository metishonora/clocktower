import { CustomRoleSetup } from './CustomRoleSetup';
import { useCustomUtilities, type CustomUtilityActions } from './CustomUtilities';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { ProductionApplicationShell } from '../shared-ui/ProductionApplicationShell';
import { AssignmentSurface, type AssignmentCharacter } from '../shared-ui/AssignmentSurface';
import { GrimoireSetupController, rosterComplete } from '../custom/grimoire/setupController';
import { characterPresentation } from '../custom/authoring/characterPresentation';
import './customGrimoireSetup.css';
import './customBmrTheme.css';

/** Existing official presentations, with custom-owned state and rules supplied as data. */
export function CustomGrimoireSetup({ controller, onNewGame, onNewScenario, onImport }: { controller: GrimoireSetupController } & CustomUtilityActions) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const { draft, definition, replay, tab } = state;
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [controller, tab]);
  const [selectedSeat, setSelectedSeat] = useState<number>();
  const [pendingId, setPendingId] = useState<string>();
  const locked = state.busy || !!replay || state.saveFailed;
  const utilities = useCustomUtilities({definition,busy:locked,onNewGame,onNewScenario,onImport});
  const complete = rosterComplete(state);
  const assigned = draft.players.filter(player => player.actualCharacter).length;
  const selected = draft.players.find(player => player.seat === selectedSeat);
  const characters: AssignmentCharacter[] = definition.characterIds.map(id => {
    const role = characterPresentation(id)!;
    return { id, name: role.label, kind: role.kind.toLowerCase() as AssignmentCharacter['kind'], image: role.image };
  });
  function chooseSeat(seat: number) {
    if (locked) return;
    if (pendingId) { controller.assignCharacter(seat, pendingId); setPendingId(undefined); setSelectedSeat(undefined); }
    else setSelectedSeat(current => current === seat ? undefined : seat);
  }
  function chooseCharacter(id: string) {
    if (locked) return;
    if (selectedSeat) { controller.assignCharacter(selectedSeat, selected?.actualCharacter === id ? '' : id); setPendingId(undefined); }
    else {
      const assignedPlayer = draft.players.find(player => player.actualCharacter === id);
      if (assignedPlayer) { controller.assignCharacter(assignedPlayer.seat, ''); setPendingId(undefined); }
      else setPendingId(current => current === id ? undefined : id);
    }
  }
  return <ProductionApplicationShell ariaLabel="커스텀 시나리오 마도서" theme="night" title={definition.name} eyebrow="STORYTELLER CONSOLE"
    className="customGrimoireSetup bmrProductionShell customBmrTheme" classes={{ header: 'snvPrototypeHeader bmrHeader', eyebrow: 'snvEyebrow',
      headerActions: 'snvPhaseActions bmrHeaderActions', utilities: 'snvUtilityTabs', stages: 'snvSurfaceTabs' }}
    leading={<span className="bmrSkyDisc night" role="img" aria-label="밤 · 혈월"/>}
    utilities={utilities.destinations} stages={[
      { id: 'roles', label: '직업', active: tab === 'roles', className: tab === 'roles' ? 'active' : '' },
      { id: 'seating', label: '마도서', active: tab === 'seating', className: tab === 'seating' ? 'active' : '', disabled: !state.rosterConfirmed && !replay },
      { id: 'play', label: '진행', active: tab === 'play', className: tab === 'play' ? 'active' : '', disabled: !replay },
    ]} onNavigate={id => { utilities.close(); controller.navigate(id as typeof tab); }}>
    {state.error && <div className="customSetupError" role="alert"><p>{state.error}</p>
      {state.saveFailed ? <button type="button" disabled={state.busy} onClick={() => void controller.retrySave()}>저장 다시 시도</button>
        : !state.distribution && !state.distributionPending ? <button type="button" disabled={locked} onClick={() => void controller.retryDistribution()}>구성 다시 확인</button> : null}
    </div>}
    {utilities.storageOpen ? null : tab === 'roles' ? <CustomRoleSetup definition={definition} draft={draft} rosterConfirmed={state.rosterConfirmed} distribution={state.distribution} adjustment={state.adjustment} distributionPending={state.distributionPending} locked={locked} complete={complete} onPlayerCount={controller.setPlayerCount} onDemon={controller.selectDemon} canSelect={controller.canSelectCharacter} onToggle={controller.toggleCharacter} onConfirm={controller.confirmRoster}/> : <AssignmentSurface
      draft={{ playerCount:draft.playerCount, selectedIds:draft.selectedIds, seatingConfirmed:!!replay,
        seatAssignments:Object.fromEntries(draft.players.filter(p => p.actualCharacter).map(p => [p.seat,p.actualCharacter])),
        seatNames:Object.fromEntries(draft.players.map(p => [p.seat,p.name])),
        shownCharacters:Object.fromEntries(draft.players.filter(p => p.shownCharacter).map(p => [p.seat,p.shownCharacter!])) }}
      characters={characters} ariaLabel="마도서 배치"
      alignmentForId={id => ['minion','demon'].includes(characters.find(c => c.id === id)?.kind ?? '') ? 'evil' : 'good'}
      renderCharacter={(id,size) => <img className={size === 'compact' ? 'compactIcon' : undefined} src={characterPresentation(id)?.image} alt="" />}
      selectedSeat={selectedSeat} pendingCharacterId={pendingId} seatingComplete={complete && assigned === draft.playerCount && !draft.players.some(p => p.actualCharacter === 'drunk' && !p.shownCharacter)} busy={locked}
      shownChoices={{ drunk:{ label:'표시 배역', options:characters.filter(c => c.kind === 'townsfolk') } }}
      seatingIssue={assigned < draft.playerCount ? '모든 좌석에 직업을 배치하세요.' : draft.players.some(p => p.actualCharacter === 'drunk' && !p.shownCharacter) ? '주정뱅이에게 보여줄 배역을 선택하세요.' : undefined}
      onReturn={() => controller.navigate('roles')}
      onRandomize={() => { controller.randomizeAssignments(); setSelectedSeat(undefined); setPendingId(undefined); }}
      onReset={() => { controller.clearAssignments(); setSelectedSeat(undefined); setPendingId(undefined); }}
      onSeat={chooseSeat} onCharacter={chooseCharacter} onName={controller.setPlayerName} onShownCharacter={controller.setShownCharacter}
      onClose={() => setSelectedSeat(undefined)} onConfirm={() => void controller.confirm()} onGoToProgress={() => controller.navigate('play')} />}
    {utilities.content}
  </ProductionApplicationShell>;
}

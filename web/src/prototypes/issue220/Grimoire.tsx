import { useEffect, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { ProductionApplicationShell } from '../../shared-ui/ProductionApplicationShell';
import { RoleCatalog, SetupPresentation } from '../../shared-ui/SetupPresentation';
import { GrimoirePresentation, RectangularGrimoireBoard, grimoireHeights, rectangularSeatPositions } from '../../shared-ui/GrimoirePresentation';
import { GrimoireSetupController, rosterComplete } from './fixtureController';
import { characterPresentation, countsFor, kindOrder, kindLabels } from '../../custom/authoring/characterPresentation';
import './grimoire.css';
import { NightFlow } from './NightFlow';

/** Isolated local-state presentation prototype; production components/styles reused read-only. */
export function CustomGrimoireSetup({ controller }: { controller: GrimoireSetupController }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const { draft, definition, replay, tab } = state;
  useEffect(() => { document.querySelector('.p220Console')?.scrollTo({ top: 0, behavior: 'instant' }); }, [controller, tab]);
  const [selectedSeat, setSelectedSeat] = useState<number>();
  const [focusedId, setFocusedId] = useState<string>();
  const focused = focusedId ? characterPresentation(focusedId) : undefined;
  const counts = countsFor(draft.selectedIds);
  const locked = state.busy || !!replay || state.saveFailed;
  const complete = rosterComplete(state);
  const assigned = draft.players.filter(player => player.actualCharacter).length;
  const players = replay?.players ?? draft.players;
  const selected = players.find(player => player.seat === selectedSeat);
  const heights = grimoireHeights(draft.playerCount);
  const desktop = rectangularSeatPositions(draft.playerCount, false);
  const mobile = rectangularSeatPositions(draft.playerCount, true);
  const size = { '--grimoire-height': `${heights.desktop}px`, '--mobile-grimoire-height': `${heights.mobile}px` } as CSSProperties;
  const actions = <div className="customSetupActions">
    {state.error && <p role="alert">{state.error}</p>}
    {state.saveFailed ? <button type="button" disabled={state.busy} onClick={() => void controller.retrySave()}>저장 다시 시도</button>
      : !state.distribution && !state.distributionPending ? <button type="button" disabled={locked} onClick={() => void controller.retryDistribution()}>구성 다시 확인</button> : null}
    {!replay && tab === 'roles' && <button type="button" className="snvPrimaryAction" disabled={!complete || locked} onClick={() => controller.navigate('seating')}>마도서 배치로</button>}
    {!replay && tab === 'seating' && <button type="button" className="snvPrimaryAction" disabled={!complete || locked || assigned !== draft.playerCount} onClick={() => void controller.confirm()}>{state.busy ? '설정 확인 중…' : '게임 설정 확정'}</button>}
  </div>;
  return <ProductionApplicationShell ariaLabel="커스텀 시나리오 마도서" theme="night" title={definition.name} eyebrow="STORYTELLER CONSOLE"
    className="customGrimoireSetup snvNightMode" classes={{ root: 'snvFoundationPrototype', header: 'snvPrototypeHeader', eyebrow: 'snvEyebrow',
      headerActions: 'snvPhaseActions', utilities: 'snvUtilityTabs', stages: 'snvSurfaceTabs' }}
    headerActions={<span className="snvPhaseMark snvMoonMark" role="img" aria-label="밤">☾</span>}
    utilities={[]} stages={[
      { id: 'roles', label: '직업', active: tab === 'roles', className: tab === 'roles' ? 'active' : '' },
      { id: 'seating', label: '마도서', active: tab === 'seating', className: tab === 'seating' ? 'active' : '', disabled: !complete && !replay },
      { id: 'play', label: '진행', active: tab === 'play', className: tab === 'play' ? 'active' : '', disabled: !replay },
    ]} onNavigate={id => controller.navigate(id as typeof tab)}>
    {tab === 'roles' ? <>
      <SetupPresentation ariaLabel="커스텀 게임 설정" className="snvSetupSurface snvTabPanel"
        controls={<div className="snvSetupControls">
          <section className="snvControlCard"><h2>플레이어</h2><div className="snvChoiceRow">
            {Array.from({ length: 11 }, (_, index) => index + 5).map(count => <button type="button" key={count} aria-pressed={draft.playerCount === count}
              disabled={locked} onClick={() => controller.setPlayerCount(count)}>{count}명</button>)}
          </div></section>
          <section className="snvControlCard" aria-label="인원 구성"><h2>인원 구성</h2>
            <div className="customSetupDistribution" aria-live="polite">{kindOrder.map(kind => <div key={kind}><span>{kindLabels[kind]}</span><strong>{counts[kind]} / {state.distribution?.[kind] ?? '—'}</strong></div>)}</div>
          </section>
        </div>}
        catalog={<RoleCatalog ariaLabel="직업 선택 패널" className="snvCatalogPreview" groupsClassName="snvCatalogGroups"
          groups={kindOrder.map(kind => ({ id: kind, label: kindLabels[kind], selectedCount: counts[kind], requiredCount: state.distribution?.[kind] ?? 0,
            roles: definition.characterIds.map(characterPresentation).filter(role => role?.kind === kind).map(role => ({ id: role!.id, label: role!.label,
              selected: draft.selectedIds.includes(role!.id), disabled: state.busy || state.saveFailed })) }))}
          onSelect={id => { setFocusedId(id); if (!locked) controller.toggleCharacter(id); }}
          renderRole={role => <><img src={characterPresentation(role.id)?.image} alt="" /><span>{role.label}</span></>} />}
        detail={focused ? <aside className="snvRoleDetail customSetupRoleDetail" aria-label="직업 설명"><img src={focused.image} alt="" /><h2>{focused.label}</h2><p>{focused.ability}</p></aside> : undefined} />
      {actions}
    </> : tab === 'seating' ? <GrimoirePresentation ariaLabel="마도서 배치" className="snvSeatingSurface snvTabPanel assignmentStarted"
      workspaceClassName="snvSeatingWorkspace stable" style={size}
      toolbar={<div className="snvSeatingToolbar"><button type="button" onClick={() => controller.navigate('roles')}>← 직업</button>
        {!replay && <><button type="button" disabled={locked} onClick={controller.assignRemaining}>선택 순서로 배치</button><button type="button" disabled={locked} onClick={controller.clearAssignments}>배치 초기화</button></>}
      </div>}
      board={<RectangularGrimoireBoard ariaLabel={`${draft.playerCount}자리 마도서`} className="snvGrimoireDraft rectangular" centerClassName="snvGrimoireCenter" style={size}
        seats={players.map((player, index) => {
          const role = characterPresentation(player.actualCharacter);
          const kind = role?.kind.toLowerCase();
          return { id: `seat-${player.seat}`, position: desktop[index], mobilePosition: mobile[index], pressed: selectedSeat === player.seat,
            className: `fixedSize ${selectedSeat === player.seat ? 'selected ' : ''}${role ? `assigned kind-${kind}` : 'unassigned'}`,
            ariaLabel: `${player.seat}번 좌석, ${player.name}, ${role?.label ?? '미할당'}`, onSelect: () => setSelectedSeat(player.seat),
            content: <><span className="snvSeatNumber">{player.seat}</span>{role && <img src={role.image} alt="" />}<span className="snvSeatPlayerName">{player.name}</span><small>{role?.label ?? '미할당'}</small></> };
        })} center={<><strong>{assigned}/{draft.playerCount}</strong><span>배치</span></>} />}
      inspector={<aside className="customSetupInspector" aria-label="좌석 설정">
        {selected ? <><header><h2>{selected.seat}번 좌석</h2><button type="button" aria-label="좌석 설정 닫기" onClick={() => setSelectedSeat(undefined)}>×</button></header>
          <label>이름<input value={selected.name} disabled={locked} onChange={event => controller.setPlayerName(selected.seat, event.currentTarget.value)} /></label>
          <label>실제 배역<select value={selected.actualCharacter} disabled={locked} onChange={event => controller.assignCharacter(selected.seat, event.currentTarget.value)}>
            <option value="">미할당</option>{draft.selectedIds.map(id => <option key={id} value={id} disabled={draft.players.some(player => player.seat !== selected.seat && player.actualCharacter === id)}>{characterPresentation(id)?.label}</option>)}
          </select></label>
          {selected.actualCharacter === 'drunk' && <label>표시 배역<select value={selected.shownCharacter ?? ''} disabled={locked}
            onChange={event => controller.setShownCharacter(selected.seat, event.currentTarget.value)}><option value="">선택하세요</option>
            {definition.characterIds.map(characterPresentation).filter(role => role?.kind === 'Townsfolk').map(role => <option key={role!.id} value={role!.id}>{role!.label}</option>)}
          </select></label>}
          {selected.actualCharacter && <p>{characterPresentation(selected.actualCharacter)?.ability}</p>}
        </> : <p>좌석을 선택하세요.</p>}
      </aside>} actions={actions} /> : <NightFlow controller={controller} />}
  </ProductionApplicationShell>;
}

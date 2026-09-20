import {afterEach, expect, it} from 'vitest';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {CustomDayBoard} from '../src/grimoire-custom/CustomDayBoard';
import {FirstNightController, type GrimoireSession} from '../src/custom/grimoire/firstNightController';
import {daytime, dayInput, toNominations} from './custom/issue223Support';
import {realWasmCore} from './custom/realCustomWasmHarness';

afterEach(cleanup);

// Supply a Core projection to the real production controller and board. Character
// eligibility is deliberately not calculated in this UI contract test.
async function board(forcedVoterIds: string[]) {
  const {app, play} = await daytime();
  await toNominations(play);
  await dayInput(play, {kind:'nominate', nominatorId:'p1', nomineeId:'p2', spyAsTownsfolk:false});
  const file = play.getSnapshot().file;
  const replay = structuredClone(play.getSnapshot().replay);
  replay.day!.forcedVoterIds = forcedVoterIds;
  const session = {snapshot:{canonical:file}, replay} as GrimoireSession;
  const controller = new FirstNightController(session, realWasmCore());
  controller.beginDayHandoff();
  app.dispose();
  return controller;
}

it('preselects forced votes, prevents toggling and preserves them on reset', async () => {
  const controller = await board(['p1']);
  render(<CustomDayBoard controller={controller}/>);
  const forced = screen.getByRole('button', {name:/1번 좌석.*강제 투표/}) as HTMLButtonElement;
  expect(forced.disabled).toBe(true);
  expect(forced.getAttribute('aria-pressed')).toBe('true');
  expect(forced.classList.contains('customForcedVoteSeat')).toBe(true);
  expect(screen.getByRole('button', {name:'1표로 투표 확정'})).toBeDefined();
  controller.selectDayPlayer('p1');
  expect(controller.getSnapshot().dayHandoff!.voterIds).toEqual(['p1']);
  fireEvent.click(screen.getByRole('button', {name:/2번 좌석/}));
  expect(screen.getByRole('button', {name:'2표로 투표 확정'})).toBeDefined();
  fireEvent.click(screen.getByRole('button', {name:'투표 초기화 X'}));
  expect(controller.getSnapshot().dayHandoff!.voterIds).toEqual(['p1']);
  expect(screen.getByRole('button', {name:'1표로 투표 확정'})).toBeDefined();
  controller.dispose();
});

it('uses normal voting when the Core releases the obligation', async () => {
  const controller = await board([]);
  render(<CustomDayBoard controller={controller}/>);
  expect(screen.queryByText('강제 투표')).toBeNull();
  const seat = screen.getByRole('button', {name:/1번 좌석/}) as HTMLButtonElement;
  expect(seat.disabled).toBe(false);
  fireEvent.click(seat);
  expect(controller.getSnapshot().dayHandoff!.voterIds).toEqual(['p1']);
  fireEvent.click(screen.getByRole('button', {name:'투표 초기화 X'}));
  expect(controller.getSnapshot().dayHandoff!.voterIds).toEqual([]);
  controller.dispose();
});

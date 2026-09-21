import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CustomGrimoireApplication } from '../src/grimoire-custom/CustomGrimoireApplication';
import { CustomBrowserNavigation, customRouteUrl, readCustomRoute, scenarioUrl, grimoireUrl } from '../src/custom/grimoire/customRoutes';
import { started, stored } from './custom/issue220Support';
import { IndexedDbCustomWebSessionStorageDriver } from '../src/custom/storage/sessionStorage';

beforeEach(() => {
  history.replaceState({}, '', scenarioUrl);
  Object.defineProperty(window, 'matchMedia', {configurable: true, value: vi.fn(() => ({matches: true}))});
  window.scrollTo = vi.fn();
});
afterEach(() => { cleanup(); history.replaceState({}, '', scenarioUrl); });

it('round-trips opaque game IDs and rejects ambiguous game/setup URLs', () => {
  const id = 'game /한글?&+';
  expect(readCustomRoute(new URL(customRouteUrl({kind:'game',gameId:id}), location.origin))).toEqual({kind:'game',gameId:id});
  for (const query of ['game=', 'game=a&game=b', 'game=a&mode=setup', 'mode=unknown'])
    expect(readCustomRoute(new URL(`${grimoireUrl}?${query}`, location.origin))).toEqual({kind:'invalid'});
});

it('restores a direct game address under StrictMode without history markers or a public reveal', async () => {
  const first = await started(); first.app.dispose(); const before = await stored();
  history.replaceState({}, '', customRouteUrl({kind:'game', gameId:before.canonical.game.id}));
  render(<StrictMode><CustomGrimoireApplication onExit={()=>{}}/></StrictMode>);
  await screen.findByRole('main', {name:'커스텀 마도서'});
  expect(screen.queryByRole('heading', {name:'Ⅰ. 시나리오 선택'})).toBeNull();
  expect(screen.queryByRole('dialog')).toBeNull(); expect(await stored()).toEqual(before);
  fireEvent.click(screen.getByRole('button', {name:'저장 / 불러오기'}));
  fireEvent.click(screen.getByRole('button', {name:'자동 저장 목록'}));
  await screen.findByRole('list', {name:'저장된 게임'});
  expect(location.pathname).toBe(grimoireUrl);
  fireEvent.click(screen.getByRole('button', {name:/이어하기/}));
  await screen.findByRole('main', {name:'커스텀 마도서'});
  expect(new URL(location.href).searchParams.get('game')).toBe(before.canonical.game.id);
});

it('shows setup recovery and preserves the saved game instead of reopening setup', async () => {
  const first = await started(); first.app.dispose(); const before = await stored();
  history.replaceState({}, '', `${grimoireUrl}?mode=setup`);
  render(<CustomGrimoireApplication onExit={()=>{}}/>);
  await screen.findByText('게임 설정이 저장되지 않았습니다.');
  await screen.findByRole('list', {name:'저장된 게임'});
  expect(await stored()).toEqual(before);
});

it('offers manual recovery at an unknown game address without displaying the editor', async () => {
  history.replaceState({}, '', `${grimoireUrl}?game=missing`);
  render(<CustomGrimoireApplication onExit={()=>{}}/>);
  await screen.findByText('해당 게임의 저장 기록이 없습니다.');
  expect(screen.queryByRole('heading', {name:'Ⅰ. 시나리오 선택'})).toBeNull();
  fireEvent.click(screen.getByRole('button', {name:'자동 저장 목록'}));
  await screen.findByText('자동 저장된 게임이 없습니다.');
});

it('distinguishes unavailable storage from an empty list and supports retry', async () => {
  history.replaceState({}, '', grimoireUrl);
  vi.spyOn(IndexedDbCustomWebSessionStorageDriver, 'listSessions').mockRejectedValueOnce(Error('denied'));
  render(<CustomGrimoireApplication onExit={()=>{}}/>);
  await screen.findByText('자동 저장 목록을 읽지 못했습니다. 다시 시도하세요.');
  expect(screen.queryByText('자동 저장된 게임이 없습니다.')).toBeNull();
  fireEvent.click(screen.getByRole('button', {name:'다시 시도'}));
  await screen.findByText('자동 저장된 게임이 없습니다.');
});

it('waits for a save before browser back, restores the URL while waiting, and retains forward history', async () => {
  let status: 'ready' | 'waiting' | 'blocked' = 'ready';
  let finish!: (value: boolean) => void;
  const wait = () => status === 'waiting' ? new Promise<boolean>(resolve => {finish=resolve;}) : Promise.resolve(status === 'ready');
  const apply = vi.fn();
  const nav = new CustomBrowserNavigation({navigationStatus:()=>status, waitForNavigation:wait, needsUnloadConfirmation:()=>status!=='ready'}, apply);
  const disconnect = nav.connect();
  await nav.navigate({kind:'library'}); await nav.navigate({kind:'game',gameId:'pending'});
  status = 'waiting';
  act(() => history.back());
  await waitFor(() => {expect(finish).toBeTypeOf('function');expect(location.search).toBe('?game=pending');});
  expect(apply).toHaveBeenLastCalledWith({kind:'game',gameId:'pending'});
  nav.activate({kind:'game',gameId:'saved'});
  status = 'ready'; finish(true);
  await waitFor(() => expect(apply).toHaveBeenLastCalledWith({kind:'library'}));
  act(() => history.forward());
  await waitFor(() => expect(apply).toHaveBeenLastCalledWith({kind:'game',gameId:'saved'}));
  disconnect();
});

it('keeps the current game and history position when a save fails during browser back', async () => {
  let blocked = false;
  const apply = vi.fn();
  const nav = new CustomBrowserNavigation({navigationStatus:()=>blocked?'blocked':'ready',waitForNavigation:async()=>!blocked,needsUnloadConfirmation:()=>blocked}, apply);
  const disconnect = nav.connect();
  await nav.navigate({kind:'library'}); await nav.navigate({kind:'game',gameId:'failed'});
  blocked = true; act(() => history.back());
  await new Promise(resolve => setTimeout(resolve, 30));
  expect(location.search).toBe('?game=failed'); expect(apply).toHaveBeenLastCalledWith({kind:'game',gameId:'failed'});
  blocked = false; act(() => history.back());
  await waitFor(() => expect(apply).toHaveBeenLastCalledWith({kind:'library'})); disconnect();
});

it('protects document exits only while persistence needs attention and removes the listener on disconnect', () => {
  let unsaved = false;
  const nav = new CustomBrowserNavigation({navigationStatus:()=> 'ready', waitForNavigation:async()=>true,
    needsUnloadConfirmation:()=>unsaved}, vi.fn());
  const disconnect = nav.connect();
  const exiting = () => {
    const event = new Event('beforeunload', {cancelable:true});
    window.dispatchEvent(event); return event.defaultPrevented;
  };
  expect(exiting()).toBe(false);
  unsaved = true; expect(exiting()).toBe(true);
  unsaved = false; expect(exiting()).toBe(false);
  disconnect(); unsaved = true; expect(exiting()).toBe(false);
});

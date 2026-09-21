import { expect, it, vi } from 'vitest';
import { IndexedDbCustomWebSessionStorageDriver as Driver } from '../../src/custom/storage/sessionStorage';
import { CustomGrimoireApplicationController } from '../../src/custom/grimoire/applicationController';
import { definition, started, stored } from './issue220Support';
import { realWasmCore } from './realCustomWasmHarness';

async function put(key: string, value: unknown) {
  await new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('clocktower', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('game');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result, tx = db.transaction('game', 'readwrite');
      tx.objectStore('game').put(value, key);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  });
}

it('lists existing sessions by durable save time and isolates malformed and official records', async () => {
  const { app } = await started(); app.dispose();
  const first = await stored();
  first.savedAt = '2026-09-20T10:00:00.000Z';
  await put(`session:custom:${definition.id}`, first);
  const second = structuredClone(first);
  second.customScriptId = second.canonical.game.script.definition.id = 'same-name';
  second.canonical.game.id = 'second-game'; second.savedAt = '2026-09-21T10:00:00.000Z';
  await put('session:custom:same-name', second);
  await put('session:custom:broken', { broken: true });
  await put('session:official:tb', { official: true });
  const list = await Driver.listSessions();
  expect(list.records.map(record => record.gameId)).toEqual(['second-game', first.canonical.game.id]);
  expect(list.records.map(record => record.name)).toEqual([definition.name, definition.name]);
  expect(list.unreadableIds).toEqual(['broken']);
  expect(await stored()).toEqual(first);
});

it('restores by exact game ID without writing, including savedAt and private presentation', async () => {
  const { app } = await started(); app.dispose();
  const before = await stored(), activated = vi.fn();
  const next = new CustomGrimoireApplicationController(realWasmCore(), activated);
  await next.restoreGame(before.canonical.game.id);
  expect(next.getSnapshot().screen).toBe('play');
  expect(next.play!.session.snapshot).toEqual(before);
  expect(next.play!.getSnapshot().public).toBe(false);
  expect(await stored()).toEqual(before);
  next.dispose();
});

it('does not follow an old game URL into its replacement or a replacement after list lookup', async () => {
  const first = await started(); first.app.dispose(); const before = await stored();
  const second = await started(); second.app.dispose(); const replacement = await stored();
  const app = new CustomGrimoireApplicationController(realWasmCore(), vi.fn());
  await app.restoreGame(before.canonical.game.id);
  expect(app.play).toBeUndefined(); expect(app.getSnapshot().error).toContain('없습니다');
  vi.spyOn(Driver, 'listSessions').mockResolvedValueOnce({ records: [{ customScriptId: definition.id,
    gameId: before.canonical.game.id, name: definition.name, savedAt: before.savedAt }], unreadableIds: [] });
  await app.restoreGame(before.canonical.game.id);
  expect(app.play).toBeUndefined(); expect(await stored()).toEqual(replacement); app.dispose();
});

it('ignores a restore that completes after leaving its route and reports storage access failures', async () => {
  const first = await started(); first.app.dispose(); const before = await stored();
  let resolve!: (value: Awaited<ReturnType<typeof Driver.listSessions>>) => void;
  vi.spyOn(Driver, 'listSessions').mockReturnValueOnce(new Promise(done => { resolve = done; }));
  const app = new CustomGrimoireApplicationController(realWasmCore(), vi.fn());
  const restore = app.restoreGame(before.canonical.game.id);
  expect(app.needsUnloadConfirmation()).toBe(false);
  app.openLibrary(); resolve({ records: [{ customScriptId: definition.id, gameId: before.canonical.game.id,
    name: definition.name, savedAt: before.savedAt }], unreadableIds: [] }); await restore;
  expect(app.getSnapshot().screen).toBe('library'); expect(app.play).toBeUndefined();
  vi.spyOn(Driver, 'listSessions').mockRejectedValueOnce(Error('storage unavailable'));
  await app.restoreGame(before.canonical.game.id);
  expect(app.getSnapshot().error).toContain('storage unavailable'); expect(await stored()).toEqual(before); app.dispose();
});
